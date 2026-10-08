/*
 * The cartridge. Plain ES modules, no bundler: it installs and runs as it is.
 */
import { MnemoCartridgeSDK, applyDesignTokens, onHostConfig } from '../vendor/cartridge-sdk.js';
import { makeT, resolveLocale } from './i18n.js';
import { createViewer } from './viewer.js';
import { createMemoryPanel } from './mnemo/memory.js';
import { buildLevels } from './mnemo/levels.js';
import { openReview } from './review-ui.js';

// Must match "name" in mnemo-plugin.json -- the host keys permissions on it.
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-mineral');

const $ = (id) => document.getElementById(id);

const state = {
  t: makeT('en'),
  locale: 'en',
  index: null,
  selected: null,
  filter: '',
  viewer: null,
  memory: null,
  opts: { showCell: true, showBonds: true, repeat: 1 },
  structureCache: new Map(),
};

// ------------------------------------------------------------------ the rail

function matches(m, q) {
  if (!q) return true;
  const hay = [
    m.name.en, m.name.fr, m.name.es, m.formula, m.strunz, m.spaceGroup, m.imaSymbol,
    'COD ' + m.cod, ...(m.elements || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((term) => hay.includes(term));
}

function renderRail() {
  const list = $('list');
  const all = state.index.minerals;
  const shown = all.filter((m) => matches(m, state.filter));
  list.innerHTML = '';

  $('railCount').textContent = state.filter
    ? state.t('rail.countFiltered', { n: shown.length, total: all.length })
    : state.t('rail.count', { n: all.length });

  if (!shown.length) {
    const p = document.createElement('p');
    p.className = 'rail-none';
    p.textContent = state.t('rail.none');
    list.appendChild(p);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const m of shown) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'row' + (state.selected && state.selected.qid === m.qid ? ' is-on' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(!!state.selected && state.selected.qid === m.qid));
    b.dataset.qid = m.qid;

    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = m.name[state.locale] || m.name.en;

    const meta = document.createElement('span');
    meta.className = 'row-meta';
    meta.textContent = [m.formula, m.strunz].filter(Boolean).join('  ·  ') || state.t('facts.unknown');

    b.append(name, meta);
    b.addEventListener('click', () => select(m.qid));
    frag.appendChild(b);
  }
  list.appendChild(frag);
}

// ----------------------------------------------------------------- the facts

function factRow(label, value) {
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value;
  return [dt, dd];
}

function renderFacts(s) {
  const t = state.t;
  const facts = $('facts');
  facts.hidden = false;
  facts.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = s.name[state.locale] || s.name.en;
  facts.appendChild(h);

  if (s.imaSymbol) {
    const sym = document.createElement('p');
    sym.className = 'ima';
    sym.textContent = s.imaSymbol;
    facts.appendChild(sym);
  }

  const dl = document.createElement('dl');
  const unknown = t('facts.unknown');
  const cell = s.cell;
  const cellText = cell
    ? `${cell.a} × ${cell.b} × ${cell.c} Å,  ${cell.alpha}° ${cell.beta}° ${cell.gamma}°`
    : unknown;

  dl.append(
    ...factRow(t('facts.formula'), s.speciesFormula || s.codFormula || unknown),
    ...factRow(t('facts.spaceGroup'), s.spaceGroup || unknown),
    ...factRow(t('facts.strunz'), s.strunz || unknown),
    ...factRow(t('facts.cell'), cellText),
    ...factRow(t('facts.atoms'), String(s.atomsInCell)),
  );
  facts.appendChild(dl);

  const how = document.createElement('p');
  how.className = 'facts-how';
  how.textContent = t('facts.operators', { n: s.symmetryOperators, s: s.sitesInAsymmetricUnit });
  facts.appendChild(how);

  // Absent is not zero: a structure with no hydrogen located is not a mineral
  // without hydrogen, and saying so is the difference between teaching and
  // teaching something false.
  if (!s.hasHydrogen) {
    const p = document.createElement('p');
    p.className = 'facts-caveat';
    p.textContent = t('facts.noHydrogen');
    facts.appendChild(p);
  }
  if (s.partiallyOccupiedAtoms > 0) {
    const p = document.createElement('p');
    p.className = 'facts-caveat';
    p.textContent = t('facts.disorder', { n: s.partiallyOccupiedAtoms, sum: s.occupancySum });
    facts.appendChild(p);
  }

  const src = document.createElement('p');
  src.className = 'facts-source';
  const a = document.createElement('a');
  a.href = `https://www.crystallography.net/cod/${s.cod}.html`;
  a.target = '_blank';
  a.rel = 'noreferrer noopener';
  a.textContent = `${t('facts.cod')} ${s.cod}`;
  src.appendChild(a);
  if (s.otherStructures > 0) {
    const more = document.createElement('span');
    more.className = 'facts-more';
    more.textContent = s.otherStructures === 1
      ? t('facts.otherOne')
      : t('facts.other', { n: s.otherStructures });
    src.append(document.createElement('br'), more);
  }
  facts.appendChild(src);

  const memHost = document.createElement('div');
  memHost.className = 'memory';
  facts.appendChild(memHost);
  state.memory = createMemoryPanel({ host: memHost, sdk, t });
  state.memory.show(s);
}

// -------------------------------------------------------------- the selection

async function loadStructure(qid) {
  if (state.structureCache.has(qid)) return state.structureCache.get(qid);
  const res = await fetch(`./public/structures/${qid}.json`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const s = await res.json();
  state.structureCache.set(qid, s);
  return s;
}

async function select(qid) {
  const listed = state.index.minerals.find((m) => m.qid === qid);
  if (!listed) return;
  state.selected = listed;
  renderRail();
  $('stageEmpty').textContent = state.t('stage.loading');
  $('stageEmpty').hidden = false;

  let s;
  try {
    s = await loadStructure(qid);
  } catch (err) {
    // A structure that will not load says so where the structure would be.
    $('stageEmpty').textContent = state.t('stage.failed', { why: err.message });
    $('stageTools').hidden = true;
    return;
  }
  if (!state.selected || state.selected.qid !== qid) return;  // moved on already

  $('stageEmpty').hidden = true;
  $('stageTools').hidden = false;
  state.viewer.draw(s, state.opts);
  renderFacts(s);
}

// -------------------------------------------------------------------- credits

function openCredits() {
  const t = state.t;
  const ov = $('overlay');
  ov.hidden = false;
  ov.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'sheet';
  const h = document.createElement('h2');
  h.textContent = t('credits.title');
  const body = document.createElement('div');
  body.className = 'sheet-body';
  body.innerHTML = `
    <p><strong>Crystal structures</strong> — Crystallography Open Database, dedicated to the
    public domain under CC0. <a href="https://www.crystallography.net/cod/" target="_blank"
    rel="noreferrer noopener">crystallography.net/cod</a></p>
    <p><strong>Mineral species, names, Nickel–Strunz classes and IMA symbols</strong> —
    Wikidata, CC0. <a href="https://www.wikidata.org/" target="_blank"
    rel="noreferrer noopener">wikidata.org</a></p>
    <p><strong>Viewer</strong> — 3Dmol.js, BSD-3-Clause.</p>
    <p class="sheet-note">Every structure here is drawn as the contents of its unit cell:
    the symmetry operators in the source file are applied, atoms landing on the same point
    are counted once, and the result was checked against published cell contents and bond
    lengths before shipping. Bonds are a drawing convention — a line is drawn where two
    atoms are closer than the sum of their covalent radii times 1.15 — not a claim about
    chemistry.</p>
  `;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ghost';
  close.textContent = t('credits.close');
  close.addEventListener('click', () => { ov.hidden = true; ov.innerHTML = ''; });
  card.append(h, body, close);
  ov.appendChild(card);
}

// ----------------------------------------------------------------------- boot

function wireTools() {
  const redraw = () => {
    const s = state.viewer.current && state.viewer.current.structure;
    if (s) state.viewer.draw(s, state.opts);
  };
  $('showCell').addEventListener('change', (e) => { state.opts.showCell = e.target.checked; redraw(); });
  $('showBonds').addEventListener('change', (e) => { state.opts.showBonds = e.target.checked; redraw(); });
  $('repeat').addEventListener('change', (e) => { state.opts.repeat = Number(e.target.value); redraw(); });
}

function applyLocale(locale) {
  state.locale = resolveLocale(locale);
  state.t = makeT(state.locale);
  const t = state.t;
  $('search').placeholder = t('rail.search');
  $('reviewBtn').textContent = t('rail.review');
  $('creditsBtn').textContent = t('rail.credits');
  $('lblCell').textContent = t('stage.cell');
  $('lblBonds').textContent = t('stage.bonds');
  $('lblRepeat').textContent = t('stage.repeat');
  if (!state.selected) $('stageEmpty').textContent = t('stage.empty');
  if (state.index) renderRail();
}

async function boot() {
  // The host pushes its theme, tokens and language over postMessage. Outside
  // the shell nothing arrives, which is why the stylesheet carries fallbacks
  // for every token and the locale falls back to the browser's.
  // `applyDesignTokens` takes the token map -- calling it bare throws, and that
  // threw before anything rendered.
  onHostConfig((cfg) => {
    if (!cfg) return;
    if (cfg.tokens) applyDesignTokens(cfg.tokens);
    if (cfg.lang) applyLocale(cfg.lang);
  });

  applyLocale(navigator.language);

  const res = await fetch('./public/index.json');
  state.index = await res.json();

  state.viewer = createViewer($('viewer'));
  wireTools();
  renderRail();

  $('search').addEventListener('input', (e) => { state.filter = e.target.value; renderRail(); });
  $('creditsBtn').addEventListener('click', openCredits);
  $('reviewBtn').addEventListener('click', () => {
    const { levels, unclassified } = buildLevels(state.index.minerals, state.locale);
    openReview({ host: $('overlay'), t: state.t, sdk, levels, unclassified, locale: state.locale });
  });

  window.addEventListener('resize', () => state.viewer.resize());
}

boot().catch((err) => {
  // A cartridge that fails quietly is indistinguishable from one that is loading.
  console.error('[mineral] failed to start:', err);
  const el = $('stageEmpty');
  if (el) { el.hidden = false; el.textContent = String(err && err.message || err); }
});
