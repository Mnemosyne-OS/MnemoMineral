/*
 * Join what COD has (structures) to what Wikidata has (species), and choose ONE
 * reference structure per mineral.
 *
 * Doc 116 section 3: a mineral and a structure are not the same thing. Quartz
 * has dozens of COD entries -- different temperatures, pressures and teams --
 * and none of them IS quartz. So the catalogue has two levels, and the entry
 * chosen as the face of a species is chosen by a written rule, not by luck.
 *
 * Doc 116 section 4.2: an entry with no mineral name is not "unknown", it is
 * OUT OF THE CORPUS -- we are building an atlas of minerals, not of the COD --
 * and the count of what was dropped, and why, is written to the report.
 *
 * Measured on the raw data before this was written:
 *  - only ~3.5% of COD entries carry a mineral name at all;
 *  - the field is free text, not a name: "pyrite at 3.1 GPa", "NiS2 at 32 kbar",
 *    "Et2NH2", "forsterite" (lowercase), "Hilgardite-3A";
 *  - a text search for "pyrite" also returns arsenopyrite and chalcopyrite, so
 *    nothing here matches on substrings.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
const RAW = path.join(DATA, 'cod-raw');

// ---------------------------------------------------------------- CSV reading

/**
 * RFC4180-ish reader: COD quotes every field and escapes quotes by doubling.
 *
 * Hands each row to a callback rather than returning an array. The harvest is
 * around half a million rows of forty fields; materialising an object per row
 * ran Node out of heap at ~4 GB, and only about 3.5% of them are ever wanted.
 */
function parseCsv(text, onRow) {
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); onRow(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); onRow(row); }
}

/**
 * Read every harvested row, once.
 *
 * The harvest walks overlapping volume windows and COD's vmin/vmax filter is
 * inclusive at BOTH ends, so a structure whose volume sits exactly on a window
 * boundary comes back twice. Measured on space group 14: 160 661 rows for
 * 160 600 ids. Deduplicated on the COD id, which is the identity.
 */
function readCodRows() {
  const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.csv')).sort();
  const out = [];
  const seen = new Set();
  let duplicates = 0;
  let header = null;
  let total = 0;
  let noMineralField = 0;
  for (const f of files) {
    const text = fs.readFileSync(path.join(RAW, f), 'utf8');
    let mineralCol = -1;
    parseCsv(text, (row) => {
      if (!row.length || row.every((c) => c === '')) return;
      if (row[0] === 'file') { header = row; mineralCol = row.indexOf('mineral'); return; }
      if (row[0].startsWith('#') || !header) return;
      const id = row[0];
      if (!/^\d+$/.test(id)) return;
      if (seen.has(id)) { duplicates++; return; }
      seen.add(id);
      total++;
      // Keep only the rows this atlas could ever be about. An entry with no
      // mineral name is not "unknown", it is out of the corpus (section 4.2).
      if (mineralCol === -1 || !(row[mineralCol] || '').trim()) { noMineralField++; return; }
      const rec = {};
      header.forEach((h, i) => { rec[h] = row[i] ?? ''; });
      out.push(rec);
    });
  }
  return { rows: out, files: files.length, duplicates, total, noMineralField };
}

// ------------------------------------------------------------ name normalising

/**
 * COD's `mineral` field is free text. Reduce it to a candidate species name, or
 * to null when what it holds is plainly not one.
 *
 * Never invents: everything it produces still has to MATCH a known species, and
 * anything that does not match is dropped and counted.
 */
export function candidateNames(raw) {
  if (!raw) return [];
  const out = [];
  const push = (s) => {
    s = String(s).replace(/[\s\-–]+$/, '').trim();
    if (s.length < 3) return;
    // a formula, not a name: "Et2NH2", "CaCO3"
    if (/\d/.test(s) && !/[-(\s]/.test(s)) return;
    if (!out.includes(s)) out.push(s);
  };

  let s = String(raw).trim();
  if (!s) return [];
  push(s);

  // "pyrite at 3.1 GPa", "NiS2 at 32 kbar", "quartz at 298 K"
  s = s.replace(/\s+at\s+.*$/i, '').trim();
  push(s);

  // "Quartz (low)", "Calcite [synthetic]" -- but NOT "Bastnasite-(Ce)".
  // A Levinson suffix is attached by a hyphen with no space and names the
  // dominant element; it is PART of the species name. Dropping it merges
  // species that mineralogy deliberately keeps apart.
  push(s.replace(/\s+[([].*$/, ''));

  // "Alum-K" is how COD sometimes writes "Alum-(K)".
  const levinson = s.match(/^(.*)[-–]([A-Z][a-z]?)$/);
  if (levinson) push(`${levinson[1]}-(${levinson[2]})`);

  // polytype / stacking suffixes: "Hilgardite-3A", "Antigorite-T", "Chlorite-1M"
  push(s.replace(/[-–]\s*\d*[A-Z][a-z]?\d*$/, ''));
  // the same notation written with a space: "Muscovite 2M1", "Kaolinite 1A"
  push(s.replace(/\s+\d+[A-Z][a-z]?\d*$/, ''));
  push(s.replace(/\s*[([].*$/, ''));

  return out;
}

const fold = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');

// ----------------------------------------------------------- choosing a facade

const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : null; };

/** Is every field this cartridge needs to DRAW the cell actually present? */
function isComplete(r) {
  return ['a', 'b', 'c', 'alpha', 'beta', 'gamma'].every((k) => num(r[k]) !== null && num(r[k]) > 0)
    && !!(r.sg || '').trim();
}

/**
 * Rank candidates for the face of a species. Written down rather than implicit,
 * because "which quartz is THE quartz" is a judgement and the reader deserves
 * to see it. Lower sorts first.
 */
function rank(r) {
  const mineralRaw = (r.mineral || '').trim();
  return [
    isComplete(r) ? 0 : 1,                                   // must be drawable
    /\bat\b|\bGPa\b|kbar|\bK\b|\bdeg\b/i.test(mineralRaw) ? 1 : 0, // ambient, not a P/T study
    num(r.celltemp) !== null && Math.abs(num(r.celltemp) - 293) > 40 ? 1 : 0,
    num(r.cellpressure) !== null && num(r.cellpressure) > 200 ? 1 : 0,
    Number(r.file),                                          // deterministic tie-break
  ];
}
const cmp = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };

// ------------------------------------------------------------------------ main

function main() {
  const species = JSON.parse(fs.readFileSync(path.join(DATA, 'wikidata-species.json'), 'utf8')).species;
  // one lookup key per label in any of the three core locales
  const byName = new Map();
  for (const s of species) {
    for (const label of [s.name.en, s.name.fr, s.name.es]) {
      if (!label) continue;
      const k = fold(label);
      if (k && !byName.has(k)) byName.set(k, s);
    }
  }

  const { rows, files, duplicates, total, noMineralField } = readCodRows();
  const dropped = { noMineralField, notANameShape: 0, noMatchingSpecies: 0 };
  const unmatchedSamples = new Map();
  const bySpecies = new Map();

  for (const r of rows) {
    const raw = (r.mineral || '').trim();
    const cands = candidateNames(raw);
    if (!cands.length) { dropped.notANameShape++; continue; }
    let sp = null;
    for (const c of cands) { sp = byName.get(fold(c)); if (sp) break; }
    if (!sp) {
      dropped.noMatchingSpecies++;
      unmatchedSamples.set(cands[0], (unmatchedSamples.get(cands[0]) || 0) + 1);
      continue;
    }
    if (!bySpecies.has(sp.qid)) bySpecies.set(sp.qid, { species: sp, entries: [] });
    bySpecies.get(sp.qid).entries.push(r);
  }

  const minerals = [];
  let noDrawable = 0;
  for (const { species: sp, entries } of bySpecies.values()) {
    const sorted = [...entries].sort((x, y) => cmp(rank(x), rank(y)));
    const pick = sorted[0];
    if (!isComplete(pick)) { noDrawable++; continue; }   // every candidate unusable
    minerals.push({
      qid: sp.qid,
      name: sp.name,
      strunz: sp.strunz,
      imaSymbol: sp.imaSymbol,
      speciesFormula: sp.formula,
      cod: Number(pick.file),
      codFormula: (pick.formula || '').replace(/^- | -$/g, '').trim() || null,
      spaceGroup: (pick.sg || '').trim() || null,
      spaceGroupNumber: num(pick.sgNumber),
      Z: num(pick.Z),
      cell: {
        a: num(pick.a), b: num(pick.b), c: num(pick.c),
        alpha: num(pick.alpha), beta: num(pick.beta), gamma: num(pick.gamma),
        volume: num(pick.vol),
      },
      otherStructures: entries.length - 1,
    });
  }
  minerals.sort((a, b) => (a.name.en || '').localeCompare(b.name.en || ''));

  const report = {
    builtAt: new Date().toISOString(),
    sourceFiles: files,
    codRowsRead: total,
    codRowsCarryingAMineralName: rows.length,
    duplicateRowsFromOverlappingWindows: duplicates,
    speciesKnown: species.length,
    dropped,
    speciesMatched: bySpecies.size,
    speciesWithNoDrawableStructure: noDrawable,
    mineralsRetained: minerals.length,
    structuresBehindThem: [...bySpecies.values()].reduce((n, v) => n + v.entries.length, 0),
    topUnmatchedNames: [...unmatchedSamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
  };

  fs.writeFileSync(path.join(DATA, 'catalogue.json'), JSON.stringify({ report, minerals }, null, 1));
  fs.writeFileSync(path.join(DATA, 'catalogue-report.json'), JSON.stringify(report, null, 2));

  console.table([{
    codRows: total,
    noMineralField: dropped.noMineralField,
    notANameShape: dropped.notANameShape,
    noMatchingSpecies: dropped.noMatchingSpecies,
    speciesMatched: bySpecies.size,
    noDrawable: noDrawable,
    minerals: minerals.length,
  }]);
  console.log('\ntop unmatched mineral strings:');
  console.log(report.topUnmatchedNames.slice(0, 15).map(([n, c]) => `  ${c}x  ${n}`).join('\n'));
}

main();
