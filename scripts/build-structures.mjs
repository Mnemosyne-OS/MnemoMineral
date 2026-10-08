/*
 * Turn the catalogue into what the cartridge actually ships: one small JSON per
 * mineral holding the contents of its unit cell, already expanded.
 *
 * The expansion happens HERE, at build time, not in the browser: it is
 * deterministic, it is the thing the gate measured (gate/GATE.md), and doing it
 * once means the viewer only ever draws atoms that were already checked.
 *
 * A structure that cannot be expanded is DROPPED with its reason recorded. It is
 * never shipped half-expanded -- a crystal drawn without its symmetry is a false
 * picture of a real object, and that is the one thing this cartridge exists to
 * avoid (doc 116 section 1.4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { expandToCell } from '../src/crystal/expand.mjs';

const DATA = path.join(process.cwd(), 'data');
const CACHE = path.join(DATA, 'cif-cache');
const OUT = path.join(process.cwd(), 'public', 'structures');
const POLITE_MS = 250;
const CONCURRENCY = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCif(cod, attempt = 0) {
  const file = path.join(CACHE, `${cod}.cif`);
  if (fs.existsSync(file)) {
    const t = fs.readFileSync(file, 'utf8');
    if (t.includes('data_')) return t;      // a cached truncation is not a cache hit
  }
  try {
    const res = await fetch(`https://www.crystallography.net/cod/${cod}.cif`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text.includes('data_')) throw new Error('not a CIF');
    fs.writeFileSync(file, text);
    await sleep(POLITE_MS);
    return text;
  } catch (e) {
    if (attempt < 3) { await sleep(1200 * (attempt + 1)); return fetchCif(cod, attempt + 1); }
    return null;
  }
}

/** Round to keep the shipped files small; 3 decimals is 0.001 A. */
const r3 = (v) => Math.round(v * 1000) / 1000;

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const { minerals } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalogue.json'), 'utf8'));
  const limit = Number(process.argv[2]) || minerals.length;
  const todo = minerals.slice(0, limit);

  const failures = [];
  const index = [];
  let done = 0;

  async function worker(queue) {
    for (;;) {
      const m = queue.shift();
      if (!m) return;
      const cif = await fetchCif(m.cod);
      done++;
      if (done % 100 === 0) process.stdout.write(`  ${done}/${todo.length}\n`);
      if (!cif) { failures.push({ cod: m.cod, name: m.name.en, why: 'download failed' }); continue; }
      const r = expandToCell(cif);
      if (r.error) { failures.push({ cod: m.cod, name: m.name.en, why: r.error }); continue; }
      if (!r.atoms.length) { failures.push({ cod: m.cod, name: m.name.en, why: 'NO_ATOMS' }); continue; }

      const elements = {};
      for (const a of r.atoms) elements[a.elem] = (elements[a.elem] || 0) + 1;

      /*
       * Partial occupancy is not a rounding detail, it is a different claim.
       * Amphiboles, feldspars and garnets put several elements on ONE site with
       * fractional occupancies: actinolite comes out as Fe 14 / Mn 12 / Mg 14 /
       * Al 12 because every one of those shares positions with the others. The
       * atom count is then a count of POSSIBILITIES, not of atoms, and an app
       * that prints it flat says something false about a real mineral.
       */
      const partial = r.atoms.filter((a) => a.occupancy !== null && a.occupancy < 0.999);
      const occupancySum = r.atoms.reduce((n, a) => n + (a.occupancy === null ? 1 : a.occupancy), 0);
      // The CIF's own word for whether hydrogen was located. X-ray diffraction
      // sees hydrogen poorly, so a structure with no H is not a structure
      // without hydrogen -- the file says which, and the app repeats it.
      const hasHydrogen = elements.H > 0;

      fs.writeFileSync(path.join(OUT, `${m.qid}.json`), JSON.stringify({
        qid: m.qid, cod: m.cod, name: m.name, strunz: m.strunz, imaSymbol: m.imaSymbol,
        speciesFormula: m.speciesFormula, codFormula: m.codFormula,
        spaceGroup: m.spaceGroup, spaceGroupNumber: m.spaceGroupNumber, Z: m.Z,
        cell: { a: r3(r.cell.a), b: r3(r.cell.b), c: r3(r.cell.c),
                alpha: r3(r.cell.alpha), beta: r3(r.cell.beta), gamma: r3(r.cell.gamma) },
        symmetryOperators: r.ops,
        sitesInAsymmetricUnit: r.sites,
        atomsInCell: r.atoms.length,
        // How many of those sites are shared with another element.
        partiallyOccupiedAtoms: partial.length,
        occupancySum: r3(occupancySum),
        elements,
        hasHydrogen,
        otherStructures: m.otherStructures,
        atoms: r.atoms.map((a) => [a.elem, r3(a.f[0]), r3(a.f[1]), r3(a.f[2]),
          a.occupancy === null || a.occupancy >= 0.999 ? 1 : r3(a.occupancy)]),
      }));

      index.push({
        qid: m.qid, cod: m.cod, name: m.name, strunz: m.strunz, imaSymbol: m.imaSymbol,
        spaceGroup: m.spaceGroup, formula: m.speciesFormula || m.codFormula,
        atomsInCell: r.atoms.length, partiallyOccupiedAtoms: partial.length,
        elements: Object.keys(elements).sort(),
      });
    }
  }

  const queue = [...todo];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  index.sort((a, b) => (a.name.en || '').localeCompare(b.name.en || ''));
  const byReason = {};
  for (const f of failures) byReason[f.why] = (byReason[f.why] || 0) + 1;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'index.json'), JSON.stringify({
    builtAt: new Date().toISOString(),
    source: 'Crystallography Open Database (CC0) + Wikidata (CC0)',
    attempted: todo.length, shipped: index.length, dropped: failures.length, droppedByReason: byReason,
    minerals: index,
  }));
  fs.writeFileSync(path.join(DATA, 'structures-report.json'),
    JSON.stringify({ attempted: todo.length, shipped: index.length, failures }, null, 2));

  console.table([{ attempted: todo.length, shipped: index.length, dropped: failures.length }]);
  console.log('dropped by reason:', JSON.stringify(byReason));
}

main().catch((e) => { console.error(e); process.exit(1); });
