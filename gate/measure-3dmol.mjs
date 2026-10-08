/* GATE §1.2 — does 3Dmol.js expand CIF symmetry to the full unit cell? */
import fs from 'node:fs';
global.window = global; global.self = global;
global.document = { createElement: () => ({ style:{}, getContext:()=>null, appendChild(){}, addEventListener(){} }),
  createElementNS: () => ({ style:{} }), addEventListener(){}, body:{appendChild(){}}, getElementById:()=>null };
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });
global.HTMLElement = class {}; global.Image = class {};
await import('./lib/3Dmol-min.js');
const $3Dmol = global.$3Dmol;

const CASES = [
  { key:'quartz',  id:'1011172', sg:'P 31 2 1', asym:2, cell:9  },
  { key:'calcite', id:'1547350', sg:'R -3 c :H', asym:3, cell:30 },
  { key:'pyrite',  id:'9000594', sg:'P a -3',   asym:2, cell:12 },
];
const OPTS = [
  ['default',              {}],
  ['doAssembly',           { doAssembly:true }],
  ['duplicateAssemblyAtoms',{ duplicateAssemblyAtoms:true }],
  ['both',                 { doAssembly:true, duplicateAssemblyAtoms:true }],
];

const out = [];
for (const c of CASES) {
  const text = fs.readFileSync(`./cif/${c.id}.cif`, 'utf8');
  for (const [label, o] of OPTS) {
    let n = null, err = '';
    try {
      const frames = $3Dmol.Parsers.cif(text, Object.assign({}, o));
      n = (frames && frames[0]) ? frames[0].length : 0;
    } catch (e) { err = e.message; }
    const verdict = err ? 'ERROR' : n === c.cell ? 'FULL CELL' : n === c.asym ? 'ASYM ONLY' : `other(${n})`;
    out.push({ mineral:c.key, cod:c.id, sg:c.sg, opts:label, atoms:n, expectedCell:c.cell, asymUnit:c.asym, verdict, err });
  }
}
console.table(out.map(r => ({ mineral:r.mineral, opts:r.opts, atoms:r.atoms, cell:r.expectedCell, asym:r.asymUnit, verdict:r.verdict + (r.err?' '+r.err:'') })));
fs.writeFileSync('./results-3dmol.json', JSON.stringify(out, null, 2));
