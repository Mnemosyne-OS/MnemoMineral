/* node --test src/crystal/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  cellEdges, cellMatrix, toCartesian, expandSupercell, computeBonds,
  COVALENT_RADII, ELEMENT_COLORS,
} from './geometry.js';
import { expandToCell } from './expand.mjs';

const CUBIC = { a: 5, b: 5, c: 5, alpha: 90, beta: 90, gamma: 90 };
const HEX = { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 };

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

test('a cell has twelve edges, four of each length', () => {
  const edges = cellEdges({ a: 3, b: 5, c: 7, alpha: 90, beta: 90, gamma: 90 });
  assert.equal(edges.length, 12);
  const lengths = edges.map(([p, q]) => Math.round(dist(p, q) * 1000) / 1000).sort((x, y) => x - y);
  assert.deepEqual(lengths, [3, 3, 3, 3, 5, 5, 5, 5, 7, 7, 7, 7]);
});

test('a 120 degree cell is not drawn as a rectangle', () => {
  // The gamma=120 corner must be 4.913 from the origin along b, but NOT on the
  // y axis. A matrix that ignored the angle would put it at (0, 4.913, 0).
  const M = cellMatrix(HEX);
  const b = toCartesian(M, [0, 1, 0]);
  assert.ok(Math.abs(dist(b, { x: 0, y: 0, z: 0 }) - 4.913) < 1e-6, 'length of b');
  assert.ok(b.x < -2.4, `b should lean back along x, got ${b.x}`);
});

test('the supercell repeats n^3 times and keeps the elements', () => {
  const atoms = [['Fe', 0, 0, 0, 1], ['S', 0.25, 0.25, 0.25, 1]];
  assert.equal(expandSupercell(atoms, CUBIC, 1).length, 2);
  const big = expandSupercell(atoms, CUBIC, 2);
  assert.equal(big.length, 16);
  assert.equal(big.filter((a) => a.elem === 'Fe').length, 8);
  // the repeat is a translation of one cell edge, not a scaling
  const xs = [...new Set(big.map((a) => Math.round(a.x * 1000) / 1000))].sort((p, q) => p - q);
  assert.deepEqual(xs, [0, 1.25, 5, 6.25]);
});

test('an atom with no radius in the table is reported, never treated as radius zero', () => {
  const atoms = [
    { elem: 'Fe', x: 0, y: 0, z: 0 },
    { elem: 'Xx', x: 1.5, y: 0, z: 0 },
  ];
  const { unknownElements } = computeBonds(atoms);
  assert.deepEqual(unknownElements, ['Xx']);
});

test('a known structure gets the bonds a mineralogist would expect', () => {
  const cif = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'gate', 'cif', '9000594.cif'), 'utf8');
  const r = expandToCell(cif);
  const atoms = expandSupercell(r.atoms.map((a) => [a.elem, ...a.f, 1]), r.cell, 2);
  const { bonds, unknownElements, truncated } = computeBonds(atoms);
  assert.deepEqual(unknownElements, [], 'pyrite holds no exotic element');
  assert.equal(truncated, false);

  // Every Fe in the INTERIOR of the 2x2x2 block sits in an S6 octahedron, and
  // every S has one S neighbour (the S-S pair that makes it a disulfide).
  const nb = new Map();
  for (const [i, j] of bonds) {
    if (!nb.has(i)) nb.set(i, []); if (!nb.has(j)) nb.set(j, []);
    nb.get(i).push(j); nb.get(j).push(i);
  }
  const ss = bonds.filter(([i, j]) => atoms[i].elem === 'S' && atoms[j].elem === 'S');
  assert.ok(ss.length > 0, 'the S-S pair of pyrite must be bonded');
  const fes = bonds.filter(([i, j]) => atoms[i].elem !== atoms[j].elem);
  assert.ok(fes.length > 0, 'Fe-S bonds must exist');
  // no Fe-Fe bonds: nearest Fe-Fe in pyrite is 3.82 A, far beyond 2 x 1.32 x 1.15
  const feFe = bonds.filter(([i, j]) => atoms[i].elem === 'Fe' && atoms[j].elem === 'Fe');
  assert.equal(feFe.length, 0, 'Fe-Fe at 3.82 A must not be drawn as a bond');
});

test('bond finding does not depend on the order atoms arrive in', () => {
  const cif = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'gate', 'cif', '1011172.cif'), 'utf8');
  const r = expandToCell(cif);
  const flat = r.atoms.map((a) => [a.elem, ...a.f, 1]);
  const a1 = expandSupercell(flat, r.cell, 2);
  const a2 = expandSupercell([...flat].reverse(), r.cell, 2);
  assert.equal(computeBonds(a1).bonds.length, computeBonds(a2).bonds.length);
});

test('the bond cap announces itself instead of quietly drawing fewer', () => {
  const atoms = [];
  for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) atoms.push({ elem: 'C', x: i * 0.8, y: j * 0.8, z: 0 });
  const r = computeBonds(atoms, { maxBonds: 50 });
  assert.equal(r.bonds.length, 50);
  assert.equal(r.truncated, true);
});

test('every element in the colour table has a radius, so nothing draws without one', () => {
  for (const el of Object.keys(ELEMENT_COLORS)) {
    assert.ok(COVALENT_RADII[el] !== undefined, `${el} has a colour but no covalent radius`);
  }
});
