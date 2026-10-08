import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLevels, classCodeOf } from './levels.js';
import { composeSession, localDay } from './session.js';

const m = (qid, strunz) => ({ qid, strunz, name: { en: qid }, cod: 1000 + qid.length, spaceGroup: 'P 1' });

test('the class is the first field of the Nickel-Strunz code', () => {
  assert.equal(classCodeOf({ strunz: '4.DA.05' }), 4);
  assert.equal(classCodeOf({ strunz: '10.CA.05' }), 10);
  assert.equal(classCodeOf({ strunz: null }), null);
  assert.equal(classCodeOf({ strunz: 'nonsense' }), null);
});

test('levels come from the corpus, not from a list written in advance', () => {
  const { levels } = buildLevels([m('a', '4.AA'), m('b', '4.BB'), m('c', '9.AA')]);
  assert.deepEqual(levels.map((l) => l.code), [4, 9]);
  assert.deepEqual(levels.map((l) => l.count), [2, 1]);
});

test('levels are named, and named in the asked-for locale', () => {
  const { levels } = buildLevels([m('a', '5.AA')], 'fr');
  assert.equal(levels[0].name, 'Carbonates et nitrates');
  assert.equal(buildLevels([m('a', '5.AA')], 'en').levels[0].name, 'Carbonates & nitrates');
});

test('an unknown class code gets a name rather than rendering as undefined', () => {
  const { levels } = buildLevels([m('a', '77.AA')]);
  assert.match(levels[0].name, /77/);
});

test('minerals with no class are COUNTED, not dropped and not filed under a made-up class', () => {
  const { levels, unclassified } = buildLevels([m('a', '4.AA'), m('b', null), m('c', '')]);
  assert.equal(unclassified, 2);
  assert.equal(levels.length, 1);
  assert.equal(levels.reduce((n, l) => n + l.count, 0), 1);
});

test('a session names what was missed, because that is the part worth recalling', () => {
  const results = [
    { mineral: { ...m('quartz', '4.DA.05'), name: { en: 'quartz' } }, chosen: { name: { en: 'quartz' } }, correct: true },
    { mineral: { ...m('calcite', '5.AB.05'), name: { en: 'calcite' } }, chosen: { name: { en: 'aragonite' } }, correct: false },
  ];
  const c = composeSession({ now: Date.parse('2026-09-09T14:00:00'), results, levelName: 'All classes' });
  assert.match(c.title, /2026-09-09/);
  assert.match(c.content, /Score: 1 of 2/);
  assert.match(c.content, /## Missed/);
  assert.match(c.content, /calcite/);
  assert.match(c.content, /answered aragonite/);
  assert.match(c.content, /## Recognised/);
  assert.deepEqual(c.stats, { asked: 2, right: 1, wrong: 1 });
});

test('a clean sheet writes no Missed section', () => {
  const results = [{ mineral: m('quartz', '4.DA.05'), chosen: {}, correct: true }];
  const c = composeSession({ now: Date.now(), results, levelName: 'Oxides' });
  assert.doesNotMatch(c.content, /## Missed/);
  assert.match(c.content, /## Recognised/);
});

test('the session says where the structures came from', () => {
  const c = composeSession({ now: Date.now(), results: [], levelName: 'x' });
  assert.match(c.content, /Crystallography Open Database/);
  assert.match(c.content, /CC0/);
});

test('the day is the human local day, not the UTC one', () => {
  /*
   * The timezone is PINNED here rather than taken from the machine. This test
   * first passed while the bug it is meant to catch was present: the developer
   * machine sits at UTC-4, so the hour it happened to pick fell on the same day
   * in both calendars and the assertion could not tell them apart. A test whose
   * discrimination depends on where it runs is not a test.
   *
   * Both signs are checked, because an hour that straddles midnight west of UTC
   * does not straddle it east of UTC.
   */
  const tz = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Paris';                     // UTC+2 in September
    // 01:00 in Paris is 23:00 the previous day in UTC.
    assert.equal(localDay(Date.parse('2026-09-08T23:00:00Z')), '2026-09-09');

    process.env.TZ = 'America/New_York';                 // UTC-4 in September
    // 22:00 in New York is 02:00 the next day in UTC.
    assert.equal(localDay(Date.parse('2026-09-10T02:00:00Z')), '2026-09-09');
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
});
