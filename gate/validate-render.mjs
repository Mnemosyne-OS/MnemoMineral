/*
 * The expander is only useful if the viewer draws exactly what it computed.
 * Build an XYZ from the expanded cell, hand it to 3Dmol.js, and check that the
 * atoms come back unchanged -- same count, same elements, same coordinates.
 *
 * A supercell is included because that is what the product will actually show.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
global.window = global; global.self = global;
global.document = {
  createElement: () => ({ style: {}, getContext: () => null, appendChild() {}, addEventListener() {} }),
  createElementNS: () => ({ style: {} }), addEventListener() {}, body: { appendChild() {} }, getElementById: () => null,
};
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });
global.HTMLElement = class {}; global.Image = class {};
await import('./lib/3Dmol-min.js');
const $3Dmol = global.$3Dmol;
import { expandToCell, cellMatrix } from '../src/crystal/expand.mjs';

/** Repeat the cell na x nb x nc. Returns atoms in cartesian coordinates. */
function supercell(atoms, cell, na, nb, nc) {
  const M = cellMatrix(cell);
  const out = [];
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) for (let k = 0; k < nc; k++) {
    for (const a of atoms) {
      const f = [a.f[0] + i, a.f[1] + j, a.f[2] + k];
      out.push({ elem: a.elem,
        x: M[0][0] * f[0] + M[0][1] * f[1] + M[0][2] * f[2],
        y: M[1][0] * f[0] + M[1][1] * f[1] + M[1][2] * f[2],
        z: M[2][0] * f[0] + M[2][1] * f[1] + M[2][2] * f[2] });
    }
  }
  return out;
}

function toXyz(atoms, comment) {
  const lines = [String(atoms.length), comment || ''];
  for (const a of atoms) {
    lines.push([a.elem, a.x.toFixed(6), a.y.toFixed(6), a.z.toFixed(6)].join(' '));
  }
  return lines.join('\n') + '\n';
}

const CASES = [
  { name: 'quartz low', cod: '1011172', cell: 9 },
  { name: 'calcite',    cod: '1547350', cell: 30 },
  { name: 'pyrite',     cod: '9000594', cell: 12 },
  { name: 'marcasite',  cod: '1011013', cell: 6 },
];

const failures = [];
const rows = [];
for (const c of CASES) {
  const text = fs.readFileSync(path.join(__dirname, 'cif', c.cod + '.cif'), 'utf8');
  const r = expandToCell(text);

  for (const [label, na, nb, nc] of [['1x1x1', 1, 1, 1], ['2x2x2', 2, 2, 2]]) {
    const mine = supercell(r.atoms, r.cell, na, nb, nc);
    const xyz = toXyz(mine, c.name + ' ' + label);
    let back = null, err = '';
    try {
      back = $3Dmol.Parsers.xyz(xyz, {})[0];
    } catch (e) { err = e.message; }

    let worstDelta = 0, elemOk = true;
    if (back && back.length === mine.length) {
      for (let i = 0; i < mine.length; i++) {
        if (back[i].elem !== mine[i].elem) elemOk = false;
        worstDelta = Math.max(worstDelta,
          Math.abs(back[i].x - mine[i].x), Math.abs(back[i].y - mine[i].y), Math.abs(back[i].z - mine[i].z));
      }
    }
    const expected = c.cell * na * nb * nc;
    const ok = !err && back && back.length === expected && mine.length === expected && elemOk && worstDelta < 1e-5;
    if (!ok) failures.push(c.name + ' ' + label + ': ' + (err || ('sent ' + mine.length + ', got back ' + (back ? back.length : 'null') + ', elements ' + (elemOk ? 'ok' : 'CHANGED') + ', worst delta ' + worstDelta)));
    rows.push({
      mineral: c.name, supercell: label,
      sent: mine.length, expected, readBack: back ? back.length : 'ERROR',
      elements: elemOk ? 'same' : 'CHANGED',
      worstDelta: worstDelta.toExponential(1) + ' A',
      verdict: ok ? 'ROUND TRIP OK' : 'FAIL',
    });
  }
}
console.table(rows);
console.log('\n' + (rows.length - failures.length) + '/' + rows.length + ' round trips through the 3Dmol.js XYZ reader are exact');
for (const f of failures) console.log('  - ' + f);
process.exit(failures.length === 0 ? 0 : 1);
