/*
 * A validator that is green the first time proves nothing. Break the expander
 * on purpose, one change at a time, and require the validators to go red.
 * A mutant that SURVIVES means the check does not measure what it claims to.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { execFileSync } from 'node:child_process';

const SRC = path.join(__dirname, '..', 'src', 'crystal', 'expand.mjs');
const BACKUP = fs.readFileSync(SRC, 'utf8');

const MUTANTS = [
  { name: 'no wrap into the cell',
    from: '  const f = v - Math.floor(v);\n  return f > 1 - 1e-4 ? 0 : f;',
    to: '  return v;' },
  { name: 'no dedupe of special positions',
    from: '      if (dup) continue;',
    to: '      if (false && dup) continue;' },
  { name: 'identity operator only',
    from: '    for (const op of ops) {',
    to: '    for (const op of ops.slice(0, 1)) {' },
  { name: 'cell angles ignored (all 90 deg)',
    from: '  const cg = Math.cos(cell.gamma * d);\n  const sg = Math.sin(cell.gamma * d);',
    to: '  const cg = 0;\n  const sg = 1;' },
  { name: 'question mark read as zero',
    from: "  if (s === '' || s === '?' || s === '.') return null;",
    to: "  if (s === '') return null;\n  if (s === '?' || s === '.') return '0';" },
  { name: 'trailing decimal point rejected again',
    from: '/^([-+]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:[eE][-+]?[0-9]+)?)(?:\\(([0-9]+)\\))?$/',
    to: '/^([-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)(?:\\(([0-9]+)\\))?$/' },
];

function runValidators() {
  const results = {};
  for (const v of ['validate-expand.mjs', 'validate-geometry.mjs']) {
    try {
      execFileSync(process.execPath, [path.join(__dirname, v)], { stdio: 'pipe' });
      results[v] = 'green';
    } catch (e) {
      results[v] = 'RED';
    }
  }
  return results;
}

console.log('baseline:', JSON.stringify(runValidators()));

let killed = 0;
const rows = [];
try {
  for (const m of MUTANTS) {
    if (!BACKUP.includes(m.from)) {
      rows.push({ mutant: m.name, expand: 'n/a', geometry: 'n/a', verdict: 'ANCHOR NOT FOUND' });
      continue;
    }
    fs.writeFileSync(SRC, BACKUP.replace(m.from, m.to));
    const r = runValidators();
    const dead = r['validate-expand.mjs'] === 'RED' || r['validate-geometry.mjs'] === 'RED';
    if (dead) killed++;
    rows.push({
      mutant: m.name,
      expand: r['validate-expand.mjs'],
      geometry: r['validate-geometry.mjs'],
      verdict: dead ? 'killed' : 'SURVIVED',
    });
  }
} finally {
  fs.writeFileSync(SRC, BACKUP);
}
console.table(rows);
console.log('\n' + killed + '/' + MUTANTS.length + ' mutants killed');
const restored = fs.readFileSync(SRC, 'utf8') === BACKUP;
console.log('source restored: ' + restored);
process.exit(killed === MUTANTS.length && restored ? 0 : 1);
