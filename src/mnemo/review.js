/*
 * Spaced repetition, and the choice of what to ask.
 *
 * Pure: no clock of its own, no storage of its own. Every function takes `now`
 * and a state object and returns a new one. That is what makes the schedule
 * testable without waiting five days for a card to come due.
 */

/** Leitner boxes, in days. Box 0 is "ask me again in this session". */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export const MAX_BOX = BOX_DAYS.length - 1;
const DAY_MS = 86_400_000;

/** A card that has never been seen. */
export function newCard(qid) {
  return { qid, box: 0, due: 0, seen: 0, right: 0, wrong: 0, lastAnswered: null };
}

/**
 * File a card after an answer.
 *
 * A right answer moves it up one box, a wrong answer sends it back to box 0 --
 * not down one. Getting it wrong means the interval it just survived was too
 * long, and halving it still leaves it too long.
 */
export function fileCard(card, correct, now) {
  const box = correct ? Math.min(card.box + 1, MAX_BOX) : 0;
  return {
    ...card,
    box,
    due: now + BOX_DAYS[box] * DAY_MS,
    seen: card.seen + 1,
    right: card.right + (correct ? 1 : 0),
    wrong: card.wrong + (correct ? 0 : 1),
    lastAnswered: now,
  };
}

/** Cards due now, hardest first, then least recently seen. */
export function dueCards(cards, now) {
  return Object.values(cards)
    .filter((c) => c.due <= now)
    .sort((a, b) => (a.box - b.box) || ((a.lastAnswered ?? 0) - (b.lastAnswered ?? 0)));
}

/**
 * Build the queue for a session: everything due, then unseen minerals, capped.
 *
 * Unseen cards come after due ones because forgetting what you half-know costs
 * more than not yet meeting something new.
 */
export function buildQueue(pool, cards, now, limit = 20) {
  const inPool = new Set(pool.map((m) => m.qid));
  const due = dueCards(cards, now).filter((c) => inPool.has(c.qid)).map((c) => c.qid);
  const unseen = pool.filter((m) => !cards[m.qid]).map((m) => m.qid);
  const queue = [];
  for (const q of [...due, ...unseen]) {
    if (queue.length >= limit) break;
    if (!queue.includes(q)) queue.push(q);
  }
  return queue;
}

/**
 * How many options a question needs. Fewer than this and the answer is free.
 */
export const MIN_OPTIONS = 4;

/**
 * Pick the wrong answers.
 *
 * 🚨 Distractors come from the SAME Nickel-Strunz class as the answer. Asking
 * "which is this?" against minerals from another class makes the question free:
 * a carbonate among sulfides is recognisable without knowing anything about
 * carbonates. Same-class distractors are what makes the question a question.
 *
 * Falls back to the wider pool only when the class cannot fill the options, and
 * SAYS so via `fromWiderPool`, because a question that quietly got easier is a
 * score that quietly stopped meaning what it meant.
 */
export function pickOptions(answer, pool, rand = Math.random) {
  const classOf = (m) => (m.strunz || '').split('.')[0] || null;
  const cls = classOf(answer);
  const sameClass = pool.filter((m) => m.qid !== answer.qid && cls && classOf(m) === cls);
  const others = pool.filter((m) => m.qid !== answer.qid && (!cls || classOf(m) !== cls));

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const wanted = MIN_OPTIONS - 1;
  const picked = shuffle(sameClass).slice(0, wanted);
  const fromWiderPool = picked.length < wanted;
  if (fromWiderPool) picked.push(...shuffle(others).slice(0, wanted - picked.length));
  if (picked.length < wanted) return null;   // not enough minerals to ask at all

  return { options: shuffle([answer, ...picked]), fromWiderPool };
}
