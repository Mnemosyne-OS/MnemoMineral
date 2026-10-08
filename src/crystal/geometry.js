/*
 * Turning an expanded unit cell into things that can be drawn: the cell box,
 * the repeated cell, and the bonds.
 *
 * Pure, and separate from the viewer, so the arithmetic can be tested without a
 * WebGL context.
 */

/** Fractional-to-cartesian matrix. Same convention as the expander. */
export function cellMatrix(cell) {
  const d = Math.PI / 180;
  const ca = Math.cos(cell.alpha * d);
  const cb = Math.cos(cell.beta * d);
  const cg = Math.cos(cell.gamma * d);
  const sg = Math.sin(cell.gamma * d);
  const vol = Math.sqrt(1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg);
  return [
    [cell.a, cell.b * cg, cell.c * cb],
    [0, cell.b * sg, (cell.c * (ca - cb * cg)) / sg],
    [0, 0, (cell.c * vol) / sg],
  ];
}

export function toCartesian(M, f) {
  return {
    x: M[0][0] * f[0] + M[0][1] * f[1] + M[0][2] * f[2],
    y: M[1][0] * f[0] + M[1][1] * f[1] + M[1][2] * f[2],
    z: M[2][0] * f[0] + M[2][1] * f[1] + M[2][2] * f[2],
  };
}

/** The twelve edges of the cell parallelepiped, as cartesian pairs. */
export function cellEdges(cell) {
  const M = cellMatrix(cell);
  const corner = (i, j, k) => toCartesian(M, [i, j, k]);
  const c = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) c.push({ i, j, k, p: corner(i, j, k) });
  const edges = [];
  for (const a of c) {
    for (const b of c) {
      const diff = Math.abs(a.i - b.i) + Math.abs(a.j - b.j) + Math.abs(a.k - b.k);
      if (diff !== 1) continue;
      // each edge once
      if (a.i > b.i || a.j > b.j || a.k > b.k) continue;
      edges.push([a.p, b.p]);
    }
  }
  return edges;
}

/**
 * Repeat the cell. `atoms` are [element, fx, fy, fz, occupancy] as shipped.
 * Returns cartesian atoms, each keeping the fractional coordinate it came from.
 */
export function expandSupercell(atoms, cell, n) {
  const M = cellMatrix(cell);
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    for (const a of atoms) {
      const f = [a[1] + i, a[2] + j, a[3] + k];
      const p = toCartesian(M, f);
      out.push({ elem: a[0], occupancy: a[4] === undefined ? 1 : a[4], f, ...p });
    }
  }
  return out;
}

/*
 * Covalent radii in angstroms (Cordero et al. 2008, the values every viewer
 * uses). Only what the corpus actually contains needs to be here; an element
 * that is missing gets DEFAULT_RADIUS and is reported, never silently treated
 * as radius zero -- that would draw no bonds at all and look like a clean
 * structure rather than a gap in this table.
 */
export const COVALENT_RADII = {
  H: 0.31, Li: 1.28, Be: 0.96, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57,
  Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02,
  K: 2.03, Ca: 1.76, Sc: 1.70, Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39,
  Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22, Ga: 1.22, Ge: 1.20,
  As: 1.19, Se: 1.20, Br: 1.20, Rb: 2.20, Sr: 1.95, Y: 1.90, Zr: 1.75,
  Nb: 1.64, Mo: 1.54, Tc: 1.47, Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45,
  Cd: 1.44, In: 1.42, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Cs: 2.44,
  Ba: 2.15, La: 2.07, Ce: 2.04, Pr: 2.03, Nd: 2.01, Sm: 1.98, Eu: 1.98,
  Gd: 1.96, Tb: 1.94, Dy: 1.92, Ho: 1.92, Er: 1.89, Tm: 1.90, Yb: 1.87,
  Lu: 1.87, Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41,
  Pt: 1.36, Au: 1.36, Hg: 1.32, Tl: 1.45, Pb: 1.46, Bi: 1.48, Po: 1.40,
  Th: 2.06, U: 1.96, Np: 1.90, Pu: 1.87,
};
export const DEFAULT_RADIUS = 1.5;

/** Jmol/CPK colours, the palette every chemistry viewer shares. */
export const ELEMENT_COLORS = {
  H: 0xffffff, C: 0x909090, N: 0x3050f8, O: 0xff0d0d, F: 0x90e050,
  Na: 0xab5cf2, Mg: 0x8aff00, Al: 0xbfa6a6, Si: 0xf0c8a0, P: 0xff8000,
  S: 0xffff30, Cl: 0x1ff01f, K: 0x8f40d4, Ca: 0x3dff00, Ti: 0xbfc2c7,
  Cr: 0x8a99c7, Mn: 0x9c7ac7, Fe: 0xe06633, Co: 0xf090a0, Ni: 0x50d050,
  Cu: 0xc88033, Zn: 0x7d80b0, As: 0xbd80e3, Se: 0xffa100, Br: 0xa62929,
  Sr: 0x00ff00, Zr: 0x94e0e0, Ag: 0xc0c0c0, Sn: 0x668080, Sb: 0x9e63b5,
  Ba: 0x00c900, La: 0x70d4ff, Ce: 0xffffc7, W: 0x2194d6, Au: 0xffd123,
  Hg: 0xb8b8d0, Pb: 0x575961, Bi: 0x9e4fb5, U: 0x008fff,
};
export const DEFAULT_COLOR = 0xdd77ff;

/**
 * Bonds, by a rule stated on screen: two atoms are bonded when they are closer
 * than the sum of their covalent radii times `tolerance`.
 *
 * This is a DRAWING convention, not a chemical fact, and minerals are where the
 * difference bites -- an ionic contact is not a covalent bond. Which is why the
 * rule is written down, is the same for every structure, and can be switched
 * off.
 *
 * Returns { bonds, unknownElements } -- the second is never empty in silence.
 */
export function computeBonds(atoms, options) {
  const tolerance = (options && options.tolerance) || 1.15;
  const maxBonds = (options && options.maxBonds) || 20000;
  const unknown = new Set();
  const radius = (el) => {
    const r = COVALENT_RADII[el];
    if (r === undefined) { unknown.add(el); return DEFAULT_RADIUS; }
    return r;
  };

  // Bucket by a grid the size of the longest plausible bond, so this stays
  // linear-ish instead of quadratic on a 2x2x2 supercell of a zeolite.
  let maxR = 0;
  for (const a of atoms) maxR = Math.max(maxR, radius(a.elem));
  const cut = maxR * 2 * tolerance;
  const cell = Math.max(cut, 0.5);
  const buckets = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  atoms.forEach((a, i) => {
    const k = key(a.x, a.y, a.z);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });

  const bonds = [];
  let truncated = false;
  outer:
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const bx = Math.floor(a.x / cell), by = Math.floor(a.y / cell), bz = Math.floor(a.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = buckets.get(`${bx + dx},${by + dy},${bz + dz}`);
      if (!list) continue;
      for (const j of list) {
        if (j <= i) continue;
        const b = atoms[j];
        const limit = (radius(a.elem) + radius(b.elem)) * tolerance;
        const ddx = a.x - b.x, ddy = a.y - b.y, ddz = a.z - b.z;
        const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d2 > limit * limit || d2 < 1e-6) continue;
        bonds.push([i, j]);
        if (bonds.length >= maxBonds) { truncated = true; break outer; }
      }
    }
  }
  return { bonds, unknownElements: [...unknown], truncated };
}
