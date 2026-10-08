/*
 * The atom COUNT can be right while the geometry is wrong: the count never
 * touches the fractional-to-cartesian step. So check the shortest cation-anion
 * distance against PUBLISHED bond lengths, under periodic boundary conditions.
 *
 * References (textbook values for these three structures):
 *   alpha-quartz  Si-O  1.605 / 1.614 A
 *   calcite       C-O   1.281 A
 *   pyrite        Fe-S  2.262 A   and   S-S  2.177 A
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { expandToCell, cellMatrix } from '../src/crystal/expand.mjs';

const CASES = [
  { name: 'quartz low', cod: '1011172', pair: ['Si', 'O'], expect: 1.61, tol: 0.03 },
  { name: 'calcite',    cod: '1547350', pair: ['C', 'O'],  expect: 1.281, tol: 0.03 },
  { name: 'pyrite',     cod: '9000594', pair: ['Fe', 'S'], expect: 2.262, tol: 0.03 },
  { name: 'pyrite S-S', cod: '9000594', pair: ['S', 'S'],  expect: 2.177, tol: 0.03 },
];

/** Shortest distance between two elements, minimum image over 27 cells. */
function shortestPair(atoms, cell, elemA, elemB) {
  const M = cellMatrix(cell);
  const A = atoms.filter((a) => a.elem === elemA);
  const B = atoms.filter((a) => a.elem === elemB);
  let best = Infinity;
  for (const a of A) {
    for (const b of B) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const f = [b.f[0] + dx - a.f[0], b.f[1] + dy - a.f[1], b.f[2] + dz - a.f[2]];
            const x = M[0][0] * f[0] + M[0][1] * f[1] + M[0][2] * f[2];
            const y = M[1][0] * f[0] + M[1][1] * f[1] + M[1][2] * f[2];
            const z = M[2][0] * f[0] + M[2][1] * f[1] + M[2][2] * f[2];
            const d = Math.sqrt(x * x + y * y + z * z);
            if (d > 1e-6 && d < best) best = d;
          }
        }
      }
    }
  }
  return best;
}

let pass = 0;
const rows = [];
for (const c of CASES) {
  const text = fs.readFileSync(path.join(__dirname, 'cif', c.cod + '.cif'), 'utf8');
  const r = expandToCell(text);
  const d = shortestPair(r.atoms, r.cell, c.pair[0], c.pair[1]);
  const ok = Math.abs(d - c.expect) <= c.tol;
  if (ok) pass++;
  rows.push({
    structure: c.name,
    bond: c.pair.join('-'),
    measured: d.toFixed(3) + ' A',
    published: c.expect + ' A',
    delta: (d - c.expect).toFixed(3),
    verdict: ok ? 'MATCH' : 'MISMATCH',
  });
}
console.table(rows);
console.log('\n' + pass + '/' + CASES.length + ' bond lengths match published values');
process.exit(pass === CASES.length ? 0 : 1);
