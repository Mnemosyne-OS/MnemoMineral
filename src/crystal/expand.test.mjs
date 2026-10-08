/*
 * The CIF reader's edge cases. Both of the bugs pinned here were found by
 * running the thing against the real database, not by reading the code: they
 * cost one whole structure and one whole atom site respectively, and both
 * failed in silence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSymop, cifNumber, cifValue, expandToCell } from './expand.mjs';

test('a magnitude may be written 1/2, 0.5 or .5', () => {
  // COD 7105575 (mullite) writes "x+.5". A pattern demanding a digit before the
  // point rejected the whole operator, and the structure was dropped.
  assert.deepEqual(parseSymop('x+.5, y, z')[0], [1, 0, 0, 0.5]);
  assert.deepEqual(parseSymop('x+0.5, y, z')[0], [1, 0, 0, 0.5]);
  assert.deepEqual(parseSymop('x+1/2, y, z')[0], [1, 0, 0, 0.5]);
  assert.deepEqual(parseSymop('0.5-x, y, z')[0], [-1, 0, 0, 0.5]);
});

test('the operators of a trigonal screw axis survive intact', () => {
  assert.deepEqual(parseSymop('-y, x-y, 1/3+z'), [
    [0, -1, 0, 0], [1, -1, 0, 0], [0, 0, 1, 1 / 3],
  ]);
});

test('a malformed operator is REFUSED, never half-read', () => {
  // A half-read operator would place atoms somewhere plausible and wrong.
  assert.equal(parseSymop('bogus, y, z'), null);
  assert.equal(parseSymop('x, y'), null);
  assert.equal(parseSymop('x, y, z, w'), null);
  assert.equal(parseSymop(''), null);
});

test('numbers with a bare decimal point on either side are read', () => {
  // "0." cost quartz its entire silicon site, and 2 of 3 test structures still
  // passed, which is exactly how it would have shipped.
  assert.equal(cifNumber('0.').value, 0);
  assert.equal(cifNumber('1.').value, 1);
  assert.equal(cifNumber('.5').value, 0.5);
  assert.equal(cifNumber('0.415(3)').value, 0.415);
  assert.equal(cifNumber('0.415(3)').sigma, 0.003);
});

test('an uncertainty is kept, not dropped in silence', () => {
  assert.equal(cifNumber('1.5432(3)').sigma, 0.0003);
  assert.equal(cifNumber('5.41').sigma, null);
});

test('? and . mean ABSENT, and absent is not zero', () => {
  for (const v of ['?', '.', '', "  ?  "]) {
    assert.equal(cifValue(v), null, JSON.stringify(v));
    assert.equal(cifNumber(v), null, JSON.stringify(v));
  }
});

test('a structure with no located atoms is refused rather than invented', () => {
  const cif = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'gate', 'cif', '1010760.cif'), 'utf8');
  const r = expandToCell(cif);
  assert.ok(r.error, 'COD 1010760 names a mineral and carries no structure');
  assert.equal(r.atoms, undefined);
});

test('the modern symmetry tag is accepted as well as the legacy one', () => {
  const base = [
    'data_t', '_cell_length_a 5', '_cell_length_b 5', '_cell_length_c 5',
    '_cell_angle_alpha 90', '_cell_angle_beta 90', '_cell_angle_gamma 90',
    'loop_', 'TAG', 'x,y,z', '-x,-y,-z',
    'loop_', '_atom_site_label', '_atom_site_type_symbol',
    '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z',
    'Na1 Na 0.25 0.25 0.25', '',
  ].join('\n');
  for (const tag of ['_symmetry_equiv_pos_as_xyz', '_space_group_symop_operation_xyz']) {
    const r = expandToCell(base.replace('TAG', tag));
    assert.ok(!r.error, `${tag} was not accepted: ${r.error}`);
    assert.equal(r.atoms.length, 2, tag);
  }
});
