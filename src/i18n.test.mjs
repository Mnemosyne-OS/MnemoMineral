/*
 * The house rule: every key exists in en, fr AND es. A key present in one
 * locale and missing in another does not crash -- it silently falls back to
 * English, so the surface reads as half-translated to exactly the people who
 * cannot tell it from a deliberate choice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS, LOCALES, makeT, resolveLocale } from './i18n.js';

test('the three core locales carry exactly the same keys', () => {
  const en = Object.keys(STRINGS.en).sort();
  for (const loc of LOCALES) {
    const keys = Object.keys(STRINGS[loc]).sort();
    const missing = en.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !en.includes(k));
    assert.deepEqual(missing, [], `${loc} is missing: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `${loc} has keys English does not: ${extra.join(', ')}`);
  }
});

test('en, fr and es are all present', () => {
  assert.deepEqual(LOCALES.sort(), ['en', 'es', 'fr']);
});

test('a placeholder in English exists in every translation of that key', () => {
  // A dropped {n} turns a sentence with a number into a sentence without one,
  // and nothing throws.
  const holders = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const key of Object.keys(STRINGS.en)) {
    const want = holders(STRINGS.en[key]);
    for (const loc of LOCALES) {
      assert.deepEqual(holders(STRINGS[loc][key]), want, `${loc} "${key}"`);
    }
  }
});

test('an unknown locale falls back to English rather than rendering keys', () => {
  assert.equal(resolveLocale('de'), 'en');
  assert.equal(resolveLocale(null), 'en');
  assert.equal(resolveLocale('fr-CA'), 'fr');
  assert.equal(resolveLocale('es_MX'), 'es');
  assert.equal(makeT('de')('rail.review'), 'Review');
});

test('substitution replaces every placeholder and leaves unknown ones visible', () => {
  const t = makeT('en');
  assert.equal(t('review.done', { right: 3, n: 5 }), 'Done — 3 right out of 5.');
  // An unsupplied variable stays as itself: visible, and obviously a bug.
  assert.match(t('review.done', { right: 3 }), /\{n\}/);
});

test('an unknown key returns the key, which is loud rather than blank', () => {
  assert.equal(makeT('en')('no.such.key'), 'no.such.key');
});

test('every key in the tables is actually used somewhere in the source', () => {
  // A key nobody reads is a translation cost with no surface, and usually the
  // fossil of a renamed string.
  const dir = path.join(import.meta.dirname);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|mjs)$/.test(e.name) && !e.name.includes('.test.') && e.name !== 'i18n.js') files.push(p);
    }
  };
  walk(dir);
  const source = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const unused = Object.keys(STRINGS.en).filter((k) => !source.includes(`'${k}'`));
  assert.deepEqual(unused, [], `unused keys: ${unused.join(', ')}`);
});
