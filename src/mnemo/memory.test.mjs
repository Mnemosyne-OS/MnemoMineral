import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestion, classify, classifyError, answerTextOf } from './memory.js';

const CALCITE = {
  qid: 'Q23757', cod: 1547350, name: { en: 'calcite' },
  strunz: '5.AB.05', spaceGroup: 'R -3 c :H',
};

test('the question carries the keys, not just the name', () => {
  // Calcite and aragonite are both CaCO3. A question that named only the
  // formula would be a question about two different minerals.
  const q = buildQuestion(CALCITE);
  assert.match(q, /calcite/);
  assert.match(q, /COD 1547350/);
  assert.match(q, /5\.AB\.05/);
  assert.match(q, /R -3 c :H/);
});

test('a mineral with no class or space group still asks a well-formed question', () => {
  const q = buildQuestion({ ...CALCITE, strunz: null, spaceGroup: null });
  assert.match(q, /COD 1547350/);
  assert.doesNotMatch(q, /null/);
});

test('the question tells the model to answer only from memory', () => {
  assert.match(buildQuestion(CALCITE), /only from my memory/i);
  assert.match(buildQuestion(CALCITE), /NOTHING IN MEMORY/);
});

test('an answer is read out of whichever field the host used', () => {
  assert.equal(answerTextOf({ text: ' a ' }), 'a');
  assert.equal(answerTextOf({ response: 'b' }), 'b');
  assert.equal(answerTextOf({ content: 'c' }), 'c');
  assert.equal(answerTextOf({ answer: 'd' }), 'd');
  assert.equal(answerTextOf(null), '');
});

test('an empty memory is EMPTY, never an error', () => {
  // Silence here means "no notes yet". Told as a failure, the person with no
  // notes concludes the feature is broken.
  assert.equal(classify({ text: '' }).kind, 'empty');
  assert.equal(classify({ text: 'NOTHING IN MEMORY' }).kind, 'empty');
  assert.equal(classify({ text: 'nothing in memory.' }).kind, 'empty');
  assert.equal(classify({}).kind, 'empty');
});

test('a refusal is a FAILURE and carries its reason', () => {
  const r = classify({ success: false, error: 'vault locked' });
  assert.equal(r.kind, 'failed');
  assert.equal(r.message, 'vault locked');
});

test('a refusal with no reason still says it failed', () => {
  assert.equal(classify({ success: false }).kind, 'failed');
  assert.ok(classify({ success: false }).message.length > 0);
});

test('a real answer is an ANSWER', () => {
  const r = classify({ text: 'Your notes from the field trip mention calcite twinning.' });
  assert.equal(r.kind, 'answered');
  assert.match(r.text, /twinning/);
});

test('the three silences stay three different verdicts', () => {
  // "outside the shell", "memory refused" and "nothing in memory" send a reader
  // to three different next steps.
  const outside = classifyError(new Error('No Mnemosyne host detected'));
  const refused = classifyError(new Error('timed out'));
  const empty = classify({ text: '' });
  assert.equal(outside.kind, 'no-host');
  assert.equal(refused.kind, 'failed');
  assert.equal(empty.kind, 'empty');
  assert.equal(new Set([outside.kind, refused.kind, empty.kind]).size, 3);
});

test('a thrown non-Error still produces a reason', () => {
  const r = classifyError('boom');
  assert.equal(r.kind, 'failed');
  assert.match(r.message, /boom/);
});
