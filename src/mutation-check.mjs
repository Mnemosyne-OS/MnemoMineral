/*
 * Break each decision on purpose and require the suite to notice.
 *
 * A mutant that SURVIVES means the tests agree with the code without measuring
 * it: they were written by the same reading that produced it. Every survivor
 * below has to be either killed by a new test or argued to be equivalent.
 *
 *   node src/mutation-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(HERE, '..');

const TESTS = [
  'src/mnemo/review.test.mjs',
  'src/mnemo/memory.test.mjs',
  'src/mnemo/levels.test.mjs',
  'src/crystal/geometry.test.mjs',
];

const MUTANTS = [
  { file: 'src/mnemo/review.js', name: 'a miss steps the card down one box instead of to the front',
    from: 'const box = correct ? Math.min(card.box + 1, MAX_BOX) : 0;',
    to: 'const box = correct ? Math.min(card.box + 1, MAX_BOX) : Math.max(0, card.box - 1);' },
  { file: 'src/mnemo/review.js', name: 'the top box is allowed to overflow',
    from: 'const box = correct ? Math.min(card.box + 1, MAX_BOX) : 0;',
    to: 'const box = correct ? card.box + 1 : 0;' },
  { file: 'src/mnemo/review.js', name: 'unseen minerals are asked before what is due',
    from: 'for (const q of [...due, ...unseen]) {',
    to: 'for (const q of [...unseen, ...due]) {' },
  { file: 'src/mnemo/review.js', name: 'the queue cap is ignored',
    from: '    if (queue.length >= limit) break;',
    to: '    if (false) break;' },
  { file: 'src/mnemo/review.js', name: 'distractors are drawn from the whole corpus',
    from: '  const picked = shuffle(sameClass).slice(0, wanted);',
    to: '  const picked = shuffle([...sameClass, ...others]).slice(0, wanted);' },
  { file: 'src/mnemo/review.js', name: 'the wider-pool fallback is not reported',
    from: '  const fromWiderPool = picked.length < wanted;',
    to: '  const fromWiderPool = false;' },
  { file: 'src/mnemo/review.js', name: 'a question is served with too few options',
    from: '  if (picked.length < wanted) return null;   // not enough minerals to ask at all',
    to: '  if (false) return null;' },
  { file: 'src/mnemo/review.js', name: 'the options are not shuffled',
    from: '  return { options: shuffle([answer, ...picked]), fromWiderPool };',
    to: '  return { options: [answer, ...picked], fromWiderPool };' },
  { file: 'src/mnemo/review.js', name: 'cards outside the chosen class are asked anyway',
    from: '  const due = dueCards(cards, now).filter((c) => inPool.has(c.qid)).map((c) => c.qid);',
    to: '  const due = dueCards(cards, now).map((c) => c.qid);' },
  { file: 'src/mnemo/review.js', name: 'cards that are not due yet come back anyway',
    from: '    .filter((c) => c.due <= now)',
    to: '    .filter(() => true)' },

  { file: 'src/mnemo/memory.js', name: 'an empty memory is reported as a failure',
    from: "  if (!text || /NOTHING IN MEMORY/i.test(text)) return { kind: 'empty' };",
    to: "  if (!text || /NOTHING IN MEMORY/i.test(text)) return { kind: 'failed', message: 'no answer' };" },
  { file: 'src/mnemo/memory.js', name: 'being outside the shell is merged into a generic failure',
    from: "  return message.includes(NO_HOST)\n    ? { kind: 'no-host' }\n    : { kind: 'failed', message };",
    to: "  return { kind: 'failed', message };" },
  { file: 'src/mnemo/memory.js', name: 'the question drops the identifiers and keeps only the name',
    from: "  const bits = [`COD ${m.cod}`];",
    to: '  const bits = [];' },
  { file: 'src/mnemo/memory.js', name: 'a refusal is read as an answer',
    from: "  if (result && result.success === false) {",
    to: '  if (false) {' },

  { file: 'src/mnemo/levels.js', name: 'minerals with no class are dropped in silence',
    from: '    if (code === null) { unclassified++; continue; }',
    to: '    if (code === null) { continue; }' },
  { file: 'src/mnemo/levels.js', name: 'an unknown class renders as undefined',
    from: "      name: (CLASS_NAMES[code] && (CLASS_NAMES[code][locale] || CLASS_NAMES[code].en)) || `Class ${code}`,",
    to: '      name: CLASS_NAMES[code] && CLASS_NAMES[code][locale],' },
  { file: 'src/mnemo/levels.js', name: 'the locale is ignored and everything is English',
    from: '      name: (CLASS_NAMES[code] && (CLASS_NAMES[code][locale] || CLASS_NAMES[code].en)) || `Class ${code}`,',
    to: '      name: (CLASS_NAMES[code] && CLASS_NAMES[code].en) || `Class ${code}`,' },

  { file: 'src/mnemo/session.js', name: 'the missed minerals are left out of the chronicle',
    from: '  if (wrong.length) {',
    to: '  if (false) {' },
  { file: 'src/mnemo/session.js', name: 'the day is taken in UTC rather than where the human is',
    from: '  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;',
    to: '  return d.toISOString().slice(0, 10);' },
  { file: 'src/mnemo/session.js', name: 'the source of the structures is not recorded',
    from: "    'Asked as four-option questions with the wrong answers drawn from the same ' +\n    'Nickel-Strunz class. Structures from the Crystallography Open Database (CC0).',",
    to: "    'A review session.'," },

  { file: 'src/crystal/geometry.js', name: 'an element with no radius is treated as radius zero',
    from: '    if (r === undefined) { unknown.add(el); return DEFAULT_RADIUS; }',
    to: '    if (r === undefined) { return 0; }' },
  { file: 'src/crystal/geometry.js', name: 'the cell angles are ignored',
    from: '  const cg = Math.cos(cell.gamma * d);\n  const sg = Math.sin(cell.gamma * d);',
    to: '  const cg = 0;\n  const sg = 1;' },
  { file: 'src/crystal/geometry.js', name: 'the bond cap is hit without saying so',
    from: '        if (bonds.length >= maxBonds) { truncated = true; break outer; }',
    to: '        if (bonds.length >= maxBonds) { break outer; }' },
  { file: 'src/crystal/geometry.js', name: 'the bond tolerance is loose enough to bond anything',
    from: "  const tolerance = (options && options.tolerance) || 1.15;",
    to: '  const tolerance = (options && options.tolerance) || 1.8;' },
  { file: 'src/crystal/geometry.js', name: 'the supercell scales the cell instead of translating it',
    from: '      const f = [a[1] + i, a[2] + j, a[3] + k];',
    to: '      const f = [a[1] * (i + 1), a[2] * (j + 1), a[3] * (k + 1)];' },
];

function runTests() {
  try {
    execFileSync(process.execPath, ['--test', ...TESTS], { cwd: APP, stdio: 'pipe' });
    return 'green';
  } catch {
    return 'RED';
  }
}

const originals = new Map();
for (const m of MUTANTS) {
  if (!originals.has(m.file)) originals.set(m.file, fs.readFileSync(path.join(APP, m.file), 'utf8'));
}

console.log('baseline:', runTests());

let killed = 0;
const rows = [];
try {
  for (const m of MUTANTS) {
    const src = originals.get(m.file);
    if (!src.includes(m.from)) {
      rows.push({ file: m.file.split('/').pop(), mutant: m.name, verdict: 'ANCHOR NOT FOUND' });
      continue;
    }
    fs.writeFileSync(path.join(APP, m.file), src.replace(m.from, m.to));
    const r = runTests();
    fs.writeFileSync(path.join(APP, m.file), src);
    if (r === 'RED') killed++;
    rows.push({ file: m.file.split('/').pop(), mutant: m.name, verdict: r === 'RED' ? 'killed' : 'SURVIVED' });
  }
} finally {
  for (const [f, src] of originals) fs.writeFileSync(path.join(APP, f), src);
}

console.table(rows);
console.log(`\n${killed}/${MUTANTS.length} mutants killed`);
const restored = [...originals].every(([f, src]) => fs.readFileSync(path.join(APP, f), 'utf8') === src);
console.log('sources restored: ' + restored);
process.exit(killed === MUTANTS.length && restored ? 0 : 1);
