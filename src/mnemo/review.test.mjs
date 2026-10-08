import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCard, fileCard, dueCards, buildQueue, pickOptions, BOX_DAYS, MAX_BOX, MIN_OPTIONS,
} from './review.js';

const DAY = 86_400_000;
const T0 = 1_757_000_000_000;

const mineral = (qid, strunz) => ({ qid, strunz, name: { en: qid } });

test('a right answer moves the card up exactly one box', () => {
  let c = newCard('Q1');
  c = fileCard(c, true, T0);
  assert.equal(c.box, 1);
  assert.equal(c.due, T0 + BOX_DAYS[1] * DAY);
  c = fileCard(c, true, T0);
  assert.equal(c.box, 2);
});

test('a wrong answer goes back to box 0, not down one', () => {
  // Getting it wrong means the interval it just survived was too long, and
  // halving a too-long interval still leaves it too long.
  let c = newCard('Q1');
  for (let i = 0; i < 4; i++) c = fileCard(c, true, T0);
  assert.equal(c.box, 4);
  c = fileCard(c, false, T0);
  assert.equal(c.box, 0, 'a miss returns the card to the front, not one step back');
  assert.equal(c.due, T0);
});

test('the top box does not overflow', () => {
  let c = newCard('Q1');
  for (let i = 0; i < 20; i++) c = fileCard(c, true, T0);
  assert.equal(c.box, MAX_BOX);
  assert.ok(Number.isFinite(c.due));
});

test('a card counts its own history', () => {
  let c = newCard('Q1');
  c = fileCard(c, true, T0);
  c = fileCard(c, false, T0 + 1000);
  assert.deepEqual(
    { seen: c.seen, right: c.right, wrong: c.wrong, lastAnswered: c.lastAnswered },
    { seen: 2, right: 1, wrong: 1, lastAnswered: T0 + 1000 },
  );
});

test('only cards that are actually due come back, hardest first', () => {
  const cards = {
    hard: { ...newCard('hard'), box: 0, due: T0 - 10, lastAnswered: T0 - 10 },
    easy: { ...newCard('easy'), box: 3, due: T0 - 10, lastAnswered: T0 - 5 },
    later: { ...newCard('later'), box: 2, due: T0 + DAY },
  };
  const due = dueCards(cards, T0);
  assert.deepEqual(due.map((c) => c.qid), ['hard', 'easy']);
});

test('the queue puts what is due before what has never been seen', () => {
  const pool = [mineral('a', '4.AA'), mineral('b', '4.AA'), mineral('c', '4.AA')];
  const cards = { c: { ...newCard('c'), box: 0, due: T0 - 1 } };
  assert.deepEqual(buildQueue(pool, cards, T0, 10), ['c', 'a', 'b']);
});

test('the queue never repeats a mineral and honours its cap', () => {
  const pool = Array.from({ length: 40 }, (_, i) => mineral('q' + i, '4.AA'));
  const cards = { q5: { ...newCard('q5'), due: T0 - 1 } };
  const q = buildQueue(pool, cards, T0, 20);
  assert.equal(q.length, 20);
  assert.equal(new Set(q).size, 20);
});

test('a card for a mineral outside the chosen class is not asked', () => {
  const pool = [mineral('a', '4.AA')];
  const cards = { zzz: { ...newCard('zzz'), due: T0 - 1 } };
  assert.deepEqual(buildQueue(pool, cards, T0, 10), ['a']);
});

test('the wrong answers come from the same Nickel-Strunz class', () => {
  // A carbonate among sulfides is recognisable without knowing anything about
  // carbonates, which makes the question free.
  const answer = mineral('ans', '5.AB.05');
  const pool = [
    answer,
    mineral('c1', '5.AB.10'), mineral('c2', '5.CB.20'), mineral('c3', '5.DA.05'),
    mineral('s1', '2.AA.10'), mineral('s2', '2.BB.10'), mineral('s3', '2.CC.10'),
  ];
  for (let i = 0; i < 25; i++) {
    const { options, fromWiderPool } = pickOptions(answer, pool);
    assert.equal(options.length, MIN_OPTIONS);
    assert.equal(fromWiderPool, false);
    assert.ok(options.some((o) => o.qid === 'ans'), 'the answer must be among the options');
    for (const o of options) {
      assert.equal(o.strunz.split('.')[0], '5', `${o.qid} is not a carbonate`);
    }
  }
});

test('falling back to the wider pool is reported, not silent', () => {
  // A question that quietly got easier is a score that quietly stopped meaning
  // what it meant.
  const answer = mineral('ans', '6.AA.05');
  const pool = [answer, mineral('b', '6.AA.10'), mineral('x', '9.AA'), mineral('y', '9.BB')];
  const { options, fromWiderPool } = pickOptions(answer, pool);
  assert.equal(options.length, MIN_OPTIONS);
  assert.equal(fromWiderPool, true);
});

test('too few minerals to ask means no question, never a question with three options', () => {
  const answer = mineral('ans', '6.AA.05');
  assert.equal(pickOptions(answer, [answer, mineral('b', '6.AA.10')]), null);
});

test('a mineral with no class still gets a question, from the wider pool', () => {
  const answer = mineral('ans', null);
  const pool = [answer, mineral('a', '1.A'), mineral('b', '2.B'), mineral('c', '3.C')];
  const r = pickOptions(answer, pool);
  assert.equal(r.options.length, MIN_OPTIONS);
  assert.equal(r.fromWiderPool, true);
});

test('the options are shuffled, so the answer is not always in one place', () => {
  const answer = mineral('ans', '5.AB.05');
  const pool = [answer, mineral('a', '5.AB.10'), mineral('b', '5.AB.20'), mineral('c', '5.AB.30')];
  const positions = new Set();
  for (let i = 0; i < 60; i++) {
    positions.add(pickOptions(answer, pool).options.findIndex((o) => o.qid === 'ans'));
  }
  assert.ok(positions.size > 1, 'the answer landed in the same slot every time');
});
