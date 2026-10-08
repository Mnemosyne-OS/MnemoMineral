/*
 * Writing a review session into the human's memory.
 *
 * ONE chronicle per session, on a gesture, never automatically. A cartridge
 * that writes to a vault on its own turns someone's memory into a log of what
 * an app did, and the point of this vault is that they chose what is in it.
 *
 * The text is built here and is pure, so what gets written can be tested
 * without a host and read by a human before it is sent.
 */

const pad = (n) => String(n).padStart(2, '0');

/** ISO date in local time -- the day the human had, not the day UTC had. */
export function localDay(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Compose the chronicle.
 *
 * It names what was asked and what was answered, and it says which minerals
 * were missed -- that is the part worth recalling later. It does NOT claim
 * mastery: a right answer to a four-option question is one data point.
 */
export function composeSession({ now, results, levelName, locale = 'en' }) {
  const right = results.filter((r) => r.correct);
  const wrong = results.filter((r) => !r.correct);
  const day = localDay(now);

  const lines = [];
  lines.push(`# Mineral review — ${day}`);
  lines.push('');
  lines.push(`Scope: ${levelName}`);
  lines.push(`Score: ${right.length} of ${results.length}`);
  lines.push('');

  if (wrong.length) {
    lines.push('## Missed');
    for (const r of wrong) {
      const bits = [r.mineral.name.en];
      if (r.mineral.strunz) bits.push(`Nickel-Strunz ${r.mineral.strunz}`);
      if (r.mineral.spaceGroup) bits.push(r.mineral.spaceGroup);
      bits.push(`COD ${r.mineral.cod}`);
      const answered = r.chosen ? ` — answered ${r.chosen.name.en}` : '';
      lines.push(`- ${bits.join(', ')}${answered}`);
    }
    lines.push('');
  }

  if (right.length) {
    lines.push('## Recognised');
    lines.push(right.map((r) => r.mineral.name.en).join(', '));
    lines.push('');
  }

  lines.push(
    'Asked as four-option questions with the wrong answers drawn from the same ' +
    'Nickel-Strunz class. Structures from the Crystallography Open Database (CC0).',
  );

  return {
    title: `Mineral review — ${day}`,
    content: lines.join('\n'),
    locale,
    stats: { asked: results.length, right: right.length, wrong: wrong.length },
  };
}

/**
 * Write it. Returns { ok } or { ok: false, why } -- never throws at the caller,
 * because the caller is a button and a button has to say what happened.
 */
export async function writeSession(sdk, chronicle) {
  try {
    const res = await sdk.ingest(chronicle.content, { title: chronicle.title });
    if (res && res.success === false) return { ok: false, why: res.error || 'refused' };
    return { ok: true };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.warn('[mineral] could not write the session:', why);
    return { ok: false, why };
  }
}
