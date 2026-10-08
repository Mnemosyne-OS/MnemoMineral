/*
 * Harvest COD metadata (not CIFs) for every entry, in windows small enough that
 * the server both answers and answers COMPLETELY.
 *
 * Two failure modes were measured on 2026-09-09, and neither announces itself:
 *
 *  1. `format=csv` stops at roughly 21 000 rows in SILENCE. Space group 14
 *     returned 21 005 CSV rows where `format=lst` returned 160 600 ids for the
 *     identical filter -- a corpus built on the CSV alone is amputated by 87%.
 *  2. A large enough response kills the connection outright ("other side
 *     closed"), and retrying the same request just fails again.
 *
 * So: `lst` is asked FIRST -- it is cheap and it does not truncate -- and its
 * count decides. A window over the cap is split before any CSV is requested; a
 * window under it is fetched and its row count must equal the id count or the
 * window is split and refetched. A window that cannot be split small enough is
 * REPORTED with its shortfall, never quietly dropped.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://www.crystallography.net/cod/result';
const OUT = path.join(process.cwd(), 'data', 'cod-raw');
const POLITE_MS = 400;
const CHUNK_MAX = 15000;  // rows per CSV request, safely under the ~21k truncation
const MAX_DEPTH = 26;

/*
 * Cell volumes are not spread evenly over [0, 1e6] -- almost everything is under
 * 4000 cubic angstroms. Halving that range from the top spends nine rounds of
 * probing on empty space before the windows become useful, which is what made
 * the first version of this script unusably slow. Start from a ladder shaped
 * like the data, and only binary-split what is still too big.
 */
const VOLUME_LADDER = [0, 200, 400, 700, 1000, 1500, 2000, 3000, 4000, 6000, 10000, 20000, 1_000_000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(params, format, attempt = 0) {
  const q = new URLSearchParams({ ...params, format });
  try {
    const res = await fetch(`${BASE}?${q}`, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (attempt < 3) {
      await sleep(1500 * (attempt + 1));
      return get(params, format, attempt + 1);
    }
    return null; // the caller decides whether to split or to report
  }
}

const countIds = (t) => (t ? t.split('\n').filter((l) => /^\d+$/.test(l.trim())).length : -1);
const countRows = (t) => (t ? t.split('\n').filter((l) => l.startsWith('"')).length : -1);

/**
 * @param {{sg:number, vmin:number, vmax:number, zmin?:number, zmax?:number}} win
 */
function paramsOf(win) {
  const p = { space_group_number: String(win.sg), vmin: String(win.vmin), vmax: String(win.vmax) };
  if (win.zmin !== undefined) { p.minZ = String(win.zmin); p.maxZ = String(win.zmax); }
  return p;
}

/** Halve a window: on volume while that is possible, then on Z. */
function split(win) {
  if (win.vmax - win.vmin > 0.01) {
    const mid = (win.vmin + win.vmax) / 2;
    return [{ ...win, vmax: mid }, { ...win, vmin: mid }];
  }
  if (win.zmin === undefined) return [{ ...win, zmin: 0, zmax: 8 }, { ...win, zmin: 8, zmax: 100000 }];
  if (win.zmax - win.zmin > 1) {
    const mid = Math.floor((win.zmin + win.zmax) / 2);
    if (mid > win.zmin && mid < win.zmax) return [{ ...win, zmax: mid }, { ...win, zmin: mid }];
  }
  return null;
}

async function harvest(win, depth, out, report) {
  const params = paramsOf(win);
  const lst = await get(params, 'lst');
  const ids = countIds(lst);
  await sleep(POLITE_MS);

  if (ids === -1) { report.unresolved.push({ ...win, why: 'the id listing itself failed' }); return 0; }
  if (ids === 0) return 0;

  const tooBig = ids > CHUNK_MAX;
  if (!tooBig) {
    const csv = await get(params, 'csv');
    await sleep(POLITE_MS);
    const rows = countRows(csv);
    if (rows === ids) { out.push(csv); return rows; }
    report.truncated.push({ ...win, ids, rows });
  }

  if (depth >= MAX_DEPTH) {
    report.unresolved.push({ ...win, ids, why: 'max depth reached' });
    return 0;
  }
  const halves = split(win);
  if (!halves) { report.unresolved.push({ ...win, ids, why: 'window cannot be split further' }); return 0; }

  let total = 0;
  for (const h of halves) total += await harvest(h, depth + 1, out, report);
  return total;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const reportPath = path.join(OUT, '_harvest-report.json');
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    : { truncated: [], unresolved: [], perSpaceGroup: {} };
  report.truncated ??= []; report.unresolved ??= []; report.perSpaceGroup ??= {};
  report.startedAt = new Date().toISOString();

  const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  const groups = only.length ? only : Array.from({ length: 230 }, (_, i) => i + 1);

  let grand = 0;
  for (const sg of groups) {
    const file = path.join(OUT, `sg-${String(sg).padStart(3, '0')}.csv`);
    if (fs.existsSync(file)) {
      const rows = countRows(fs.readFileSync(file, 'utf8'));
      report.perSpaceGroup[sg] = { rows, cached: true };
      grand += rows;
      continue;
    }
    const out = [];
    const before = report.unresolved.length;
    // One probe for the whole group first: most space groups fit in a single
    // request, and only the crowded ones are worth walking the ladder for.
    let rows = 0;
    const whole = { sg, vmin: 0, vmax: 1_000_000 };
    const wholeIds = countIds(await get(paramsOf(whole), 'lst'));
    await sleep(POLITE_MS);
    if (wholeIds <= 0) {
      report.perSpaceGroup[sg] = { rows: 0 };
      fs.writeFileSync(file, '');
      process.stdout.write(`sg ${sg}: 0 rows\n`);
      continue;
    }
    if (wholeIds <= CHUNK_MAX) {
      rows = await harvest(whole, 0, out, report);
    } else {
      for (let i = 0; i < VOLUME_LADDER.length - 1; i++) {
        rows += await harvest({ sg, vmin: VOLUME_LADDER[i], vmax: VOLUME_LADDER[i + 1] }, 1, out, report);
      }
    }
    fs.writeFileSync(file, out.join('\n'));
    // The group's own id count is the yardstick: harvesting fewer rows than the
    // server says exist is exactly the silent amputation this script is for.
    report.perSpaceGroup[sg] = { expected: wholeIds, rows, missing: wholeIds - rows,
                                 unresolved: report.unresolved.length - before };
    grand += rows;
    const short = wholeIds - rows;
    process.stdout.write(`sg ${sg}: ${rows}/${wholeIds} rows${short ? '  SHORT BY ' + short : ''}\n`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  report.finishedAt = new Date().toISOString();
  report.totalRows = grand;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\ntotal rows harvested: ${grand}`);
  console.log(`windows that came back truncated: ${report.truncated.length}`);
  console.log(`windows still unresolved: ${report.unresolved.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
