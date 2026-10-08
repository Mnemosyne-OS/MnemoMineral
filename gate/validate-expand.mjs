/*
 * GATE section 1.3 -- does the own expander reproduce PUBLISHED unit-cell
 * contents? The expected numbers come from Z x formula and from the site
 * multiplicities written in the files, NOT from our own output.
 *
 * Three checks, because the first one alone does not measure the other two:
 *   A. the cell contents (count and composition)
 *   B. every atom lies INSIDE the cell, 0 <= f < 1
 *   C. an absent value is absent -- never an atom at the origin
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { expandToCell, cifValue, cifNumber, readSites } from '../src/crystal/expand.mjs';

const CASES = [
  { name: 'quartz low', cod: '1011172', sg: 'P 31 2 1',  Z: 3, want: { Si: 3, O: 6 },        total: 9 },
  { name: 'calcite',    cod: '1547350', sg: 'R -3 c :H', Z: 6, want: { Ca: 6, C: 6, O: 18 }, total: 30 },
  { name: 'pyrite',     cod: '9000594', sg: 'P a -3',    Z: 4, want: { Fe: 4, S: 8 },        total: 12 },
  { name: 'marcasite',  cod: '1011013', sg: 'P n n m',   Z: 2, want: { Fe: 2, S: 4 },        total: 6 },
];

const failures = [];
const rows = [];

// --- A. cell contents, and B. everything inside the cell -------------------
for (const c of CASES) {
  const text = fs.readFileSync(path.join(__dirname, 'cif', c.cod + '.cif'), 'utf8');
  const r = expandToCell(text);
  if (r.error) {
    failures.push(c.name + ': ' + r.error);
    rows.push({ mineral: c.name, cod: c.cod, sg: c.sg, got: 'ERROR ' + r.error, expected: c.total, inCell: '-', verdict: 'FAIL' });
    continue;
  }
  const elems = {};
  for (const a of r.atoms) elems[a.elem] = (elems[a.elem] || 0) + 1;
  const countOk =
    r.atoms.length === c.total &&
    Object.keys(c.want).every((e) => elems[e] === c.want[e]) &&
    Object.keys(elems).length === Object.keys(c.want).length;
  const outside = r.atoms.filter((a) => a.f.some((v) => v < 0 || v >= 1));
  const inCellOk = outside.length === 0;
  if (!countOk) failures.push(c.name + ': cell contents ' + JSON.stringify(elems) + ' != ' + JSON.stringify(c.want));
  if (!inCellOk) failures.push(c.name + ': ' + outside.length + ' atom(s) outside the unit cell');
  rows.push({
    mineral: c.name, cod: c.cod, sg: c.sg, ops: r.ops, sites: r.sites,
    got: r.atoms.length + ' ' + JSON.stringify(elems),
    expected: c.total + ' ' + JSON.stringify(c.want),
    inCell: inCellOk ? 'all' : outside.length + ' OUTSIDE',
    verdict: countOk && inCellOk ? 'MATCH' : 'MISMATCH',
  });
}
console.table(rows);

// --- C. absent is absent ---------------------------------------------------
const absent = [];
for (const v of ['?', '.', '', "'?'"]) {
  if (cifValue(v) !== null) absent.push('cifValue(' + JSON.stringify(v) + ') should be null, got ' + JSON.stringify(cifValue(v)));
  if (cifNumber(v) !== null) absent.push('cifNumber(' + JSON.stringify(v) + ') should be null, got ' + JSON.stringify(cifNumber(v)));
}
// legal CIF numbers that a naive regex drops
for (const [v, want] of [['0.', 0], ['1.', 1], ['.5', 0.5], ['-0.465', -0.465], ['0.415(3)', 0.415]]) {
  const got = cifNumber(v);
  if (!got || Math.abs(got.value - want) > 1e-9) absent.push('cifNumber(' + JSON.stringify(v) + ') should be ' + want + ', got ' + JSON.stringify(got));
}
if (cifNumber('0.415(3)').sigma === null) absent.push('the uncertainty of 0.415(3) was dropped in silence');

// a row whose coordinates are "?" is NOT an atom at the origin
const SYNTHETIC = [
  'data_test', '_cell_length_a 5.0', '_cell_length_b 5.0', '_cell_length_c 5.0',
  '_cell_angle_alpha 90', '_cell_angle_beta 90', '_cell_angle_gamma 90',
  'loop_', '_symmetry_equiv_pos_as_xyz', 'x,y,z',
  'loop_', '_atom_site_label', '_atom_site_type_symbol',
  '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z',
  'Fe1 Fe ? ? ?', 'S1 S 0.25 0.25 0.25', '',
].join('\n');
const synth = readSites(SYNTHETIC);
if (synth.length !== 1 || synth[0].elem !== 'S') {
  absent.push('a "? ? ?" site produced ' + synth.length + ' site(s): ' + JSON.stringify(synth.map((s) => s.elem)));
}
// and the real entry that carries no structure at all must refuse, not invent
const empty = expandToCell(fs.readFileSync(path.join(__dirname, 'cif', '1010760.cif'), 'utf8'));
if (!empty.error) absent.push('COD 1010760 carries no structure but expanded to ' + empty.atoms.length + ' atoms');

console.log('\nabsent-value checks: ' + (absent.length === 0 ? 'all pass' : 'FAILED'));
for (const a of absent) console.log('  - ' + a);
failures.push(...absent);

console.log('\n' + (CASES.length - rows.filter((r) => r.verdict !== 'MATCH').length) + '/' + CASES.length + ' reproduce the published unit cell');
if (failures.length) console.log(failures.length + ' failure(s)');
process.exit(failures.length === 0 ? 0 : 1);
