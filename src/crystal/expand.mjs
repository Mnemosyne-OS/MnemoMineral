/*
 * Doc 116 section 1.3, implemented: expand a small-molecule CIF to the contents
 * of its unit cell using the symmetry operators the file carries itself.
 *
 * Pure. No viewer, no crystallography library. Input: CIF text.
 * Output: atoms in cartesian coordinates, one per distinct site in the cell.
 */

/** A CIF value. `?` and `.` mean ABSENT -- never zero, never the string. */
function cifValue(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().replace(/^['"]|['"]$/g, '');
  if (s === '' || s === '?' || s === '.') return null;
  return s;
}

/** "1.5432(3)" -> { value: 1.5432, sigma: 0.0003 }. Absent -> null. */
function cifNumber(raw) {
  const s = cifValue(raw);
  if (s === null) return null;
  // "0." and "1." are legal CIF numbers, so is ".5". A regex that demands a
  // digit after the point silently drops whole atom sites.
  const m = s.match(/^([-+]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?)(?:\(([0-9]+)\))?$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  let sigma = null;
  if (m[2] !== undefined) {
    const dot = m[1].indexOf('.');
    const decimals = dot === -1 ? 0 : m[1].length - dot - 1;
    sigma = parseInt(m[2], 10) * Math.pow(10, -decimals);
  }
  return { value, sigma };
}

/** Split a CIF line into tokens, respecting quotes. */
function tokenise(line) {
  const out = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) {
    out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return out;
}

/** Read every loop_ block: returns [{ tags, rows }]. */
function readLoops(text) {
  const lines = text.split(/\r?\n/);
  const loops = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== 'loop_') continue;
    const tags = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim().startsWith('_')) {
      tags.push(lines[j].trim().split(/\s+/)[0]);
      j++;
    }
    const rows = [];
    let buf = [];
    for (; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '' || t === 'loop_') break;
      if (t.startsWith('_') && buf.length === 0) break;
      if (t.startsWith('#')) continue;
      buf = buf.concat(tokenise(t));
      while (buf.length >= tags.length) rows.push(buf.splice(0, tags.length));
    }
    loops.push({ tags, rows });
    i = j - 1;
  }
  return loops;
}

/** A non-loop "_tag value" pair. */
function readTag(text, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp('^\\s*' + escaped + '\\s+(.+?)\\s*$', 'mi'));
  return m ? cifValue(m[1]) : null;
}

/** Symmetry operators. Accepts BOTH the legacy and the modern tag. */
const SYMOP_TAGS = ['_symmetry_equiv_pos_as_xyz', '_space_group_symop_operation_xyz'];

function readSymops(text) {
  for (const loop of readLoops(text)) {
    const idx = loop.tags.findIndex((t) => SYMOP_TAGS.includes(t.toLowerCase()));
    if (idx === -1) continue;
    return loop.rows.map((r) => cifValue(r[idx])).filter(Boolean);
  }
  for (const t of SYMOP_TAGS) {
    const v = readTag(text, t);
    if (v) return [v];
  }
  return [];
}

/** Parse "-x+1/2, y, z+1/3" into a 3x4 affine matrix over fractional coords. */
function parseSymop(op) {
  const parts = String(op).split(',');
  if (parts.length !== 3) return null;
  const rows = [];
  for (const part of parts) {
    const row = [0, 0, 0, 0];
    const cleaned = part.replace(/\s+/g, '').toLowerCase();
    if (cleaned === '') return null;
    // A magnitude may be written "1/2", "0.5" or ".5" -- COD carries all three,
    // and mullite (COD 7105575) writes "x+.5". A pattern that demands a digit
    // before the point rejects the whole operator and loses the structure.
    const re = /([+-]?)((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:\/(?:[0-9]+\.?[0-9]*|\.[0-9]+))?)?\*?([xyz])?/g;
    let m;
    let consumed = 0;
    while ((m = re.exec(cleaned))) {
      if (m[0] === '') {
        if (re.lastIndex >= cleaned.length) break;
        re.lastIndex++;
        continue;
      }
      consumed += m[0].length;
      const sign = m[1] === '-' ? -1 : 1;
      let mag = 1;
      if (m[2] !== undefined) {
        const slash = m[2].indexOf('/');
        mag = slash === -1
          ? parseFloat(m[2])
          : parseFloat(m[2].slice(0, slash)) / parseFloat(m[2].slice(slash + 1));
      }
      if (m[3]) row['xyz'.indexOf(m[3])] += sign * mag;
      else row[3] += sign * mag;
    }
    if (consumed !== cleaned.length) return null;
    rows.push(row);
  }
  return rows;
}

/** Cell -> fractional-to-cartesian matrix (a along x, b in the xy plane). */
function cellMatrix(cell) {
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

function readCell(text) {
  const g = (n) => {
    const v = cifNumber(readTag(text, '_cell_' + n));
    return v ? v.value : null;
  };
  const cell = {
    a: g('length_a'), b: g('length_b'), c: g('length_c'),
    alpha: g('angle_alpha'), beta: g('angle_beta'), gamma: g('angle_gamma'),
  };
  const ok = Object.values(cell).every((v) => v !== null && v > 0);
  return ok ? cell : null;
}

/** Element from _atom_site_type_symbol or, failing that, the label. */
function elementOf(typeSymbol, label) {
  const src = cifValue(typeSymbol) || cifValue(label) || '';
  const m = src.match(/^([A-Za-z]{1,2})/);
  if (!m) return null;
  return m[1][0].toUpperCase() + (m[1][1] || '').toLowerCase();
}

function readSites(text) {
  for (const loop of readLoops(text)) {
    const low = loop.tags.map((t) => t.toLowerCase());
    const ix = low.indexOf('_atom_site_fract_x');
    const iy = low.indexOf('_atom_site_fract_y');
    const iz = low.indexOf('_atom_site_fract_z');
    if (ix === -1 || iy === -1 || iz === -1) continue;
    const il = low.indexOf('_atom_site_label');
    const it = low.indexOf('_atom_site_type_symbol');
    const io = low.indexOf('_atom_site_occupancy');
    const sites = [];
    for (const r of loop.rows) {
      const x = cifNumber(r[ix]);
      const y = cifNumber(r[iy]);
      const z = cifNumber(r[iz]);
      if (!x || !y || !z) continue; // "? ? ?" is ABSENT, not the origin
      const elem = elementOf(it === -1 ? null : r[it], il === -1 ? null : r[il]);
      if (!elem) continue;
      const occ = io === -1 ? null : cifNumber(r[io]);
      sites.push({
        label: (il === -1 ? null : cifValue(r[il])) || elem,
        elem,
        f: [x.value, y.value, z.value],
        occupancy: occ ? occ.value : null,
      });
    }
    return sites;
  }
  return [];
}

const wrap01 = (v) => {
  const f = v - Math.floor(v);
  return f > 1 - 1e-4 ? 0 : f;
};

/**
 * Expand to the unit cell.
 * Returns { atoms, cell, ops, sites } or { error } -- never a half-expanded
 * structure, because a crystal drawn without its symmetry is a false picture
 * of a real object.
 */
function expandToCell(text, options) {
  const tolerance = (options && options.tolerance) || 0.02;
  const cell = readCell(text);
  if (!cell) return { error: 'NO_CELL' };
  const rawOps = readSymops(text);
  if (rawOps.length === 0) return { error: 'NO_SYMOPS' };
  const ops = rawOps.map(parseSymop);
  if (ops.some((o) => o === null)) return { error: 'BAD_SYMOP' };
  const sites = readSites(text);
  if (sites.length === 0) return { error: 'NO_SITES' };

  const M = cellMatrix(cell);
  const kept = [];
  for (const site of sites) {
    for (const op of ops) {
      const f = [0, 1, 2].map((i) =>
        wrap01(
          op[i][0] * site.f[0] + op[i][1] * site.f[1] + op[i][2] * site.f[2] + op[i][3],
        ),
      );
      const dup = kept.some(
        (k) =>
          k.elem === site.elem &&
          k.f.every((kv, i) => {
            const d = Math.abs(kv - f[i]);
            return Math.min(d, 1 - d) < tolerance;
          }),
      );
      if (dup) continue;
      kept.push({
        elem: site.elem,
        label: site.label,
        occupancy: site.occupancy,
        f,
        x: M[0][0] * f[0] + M[0][1] * f[1] + M[0][2] * f[2],
        y: M[1][0] * f[0] + M[1][1] * f[1] + M[1][2] * f[2],
        z: M[2][0] * f[0] + M[2][1] * f[1] + M[2][2] * f[2],
      });
    }
  }
  return { atoms: kept, cell, ops: rawOps.length, sites: sites.length };
}

export {
  expandToCell,
  cifValue,
  cifNumber,
  parseSymop,
  readSymops,
  readSites,
  readCell,
  cellMatrix,
};
