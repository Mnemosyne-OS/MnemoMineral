/*
 * The review surface. The scheduling and the choice of distractors live in
 * mnemo/review.js and are pure; this file only puts them on screen.
 *
 * The schedule is kept in the host-side state mirror (doc 73), so it survives
 * the iframe's origin changing under it. A session is written to memory only on
 * a gesture (mnemo/session.js).
 */
import { buildQueue, fileCard, newCard, pickOptions, MIN_OPTIONS } from './mnemo/review.js';
import { composeSession, writeSession } from './mnemo/session.js';

const STATE_KEY = 'mineral.review.cards';

async function loadCards(sdk) {
  try {
    const res = await sdk.stateGet(STATE_KEY);
    const value = res && (res.value ?? res.data ?? res);
    return value && typeof value === 'object' ? value : {};
  } catch (err) {
    // A schedule we cannot read is an empty schedule for this session, not a
    // crash -- but it is never silently treated as "nothing is due ever".
    console.warn('[mineral] could not read the review schedule:', err);
    return {};
  }
}

async function saveCards(sdk, cards) {
  try {
    await sdk.stateSet(STATE_KEY, cards);
    return true;
  } catch (err) {
    console.warn('[mineral] could not write the review schedule:', err);
    return false;
  }
}

export async function openReview({ host, t, sdk, levels, unclassified, locale }) {
  host.hidden = false;
  host.innerHTML = '';

  const sheet = document.createElement('div');
  sheet.className = 'sheet sheet-review';
  host.appendChild(sheet);

  const close = () => { host.hidden = true; host.innerHTML = ''; };

  const header = document.createElement('div');
  header.className = 'sheet-head';
  const h = document.createElement('h2');
  h.textContent = t('review.title');
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'ghost'; x.textContent = t('review.close');
  x.addEventListener('click', close);
  header.append(h, x);
  sheet.appendChild(header);

  const body = document.createElement('div');
  body.className = 'sheet-body';
  sheet.appendChild(body);

  const cards = await loadCards(sdk);

  // ------------------------------------------------------------ level picker
  function renderPicker() {
    body.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = t('review.pickLevel');
    body.appendChild(p);

    const grid = document.createElement('div');
    grid.className = 'levels';

    const all = levels.flatMap((l) => l.members);
    const entries = [{ name: t('review.allLevels'), members: all }, ...levels];

    for (const level of entries) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level';
      b.textContent = t('review.level', { name: level.name, n: level.members.length });
      // A class too small to build a question says so instead of offering a
      // button that produces a question with the answer visible.
      if (level.members.length < MIN_OPTIONS) {
        b.disabled = true;
        b.title = t('review.tooFew', { n: level.members.length, min: MIN_OPTIONS });
      }
      b.addEventListener('click', () => start(level));
      grid.appendChild(b);
    }
    body.appendChild(grid);

    if (unclassified > 0) {
      const note = document.createElement('p');
      note.className = 'sheet-note';
      note.textContent = t('review.unclassified', { n: unclassified });
      body.appendChild(note);
    }
  }

  // ---------------------------------------------------------------- the quiz
  function start(level) {
    const now = Date.now();
    const queue = buildQueue(level.members, cards, now, 20);
    const results = [];
    let i = 0;

    function ask() {
      if (i >= queue.length) return finish();
      const answer = level.members.find((m) => m.qid === queue[i]);
      const picked = pickOptions(answer, level.members);
      if (!picked) return finish();

      body.innerHTML = '';

      const q = document.createElement('p');
      q.className = 'quiz-q';
      q.textContent = t('review.question');
      body.appendChild(q);

      const fig = document.createElement('div');
      fig.className = 'quiz-fig';
      // What is shown is the structure's own facts, never its name. Built with
      // textContent rather than innerHTML: a formula is data, and data does not
      // get to be markup.
      const line = (cls, text) => {
        const d = document.createElement('div');
        d.className = cls;
        d.textContent = text;
        return d;
      };
      fig.append(
        line('quiz-formula', answer.formula || ''),
        line('quiz-sg', answer.spaceGroup || ''),
        line('quiz-el', (answer.elements || []).join(' · ')),
        line('quiz-atoms', t('review.atoms', { n: answer.atomsInCell })),
      );
      body.appendChild(fig);

      const opts = document.createElement('div');
      opts.className = 'quiz-options';
      for (const o of picked.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quiz-option';
        b.textContent = o.name[locale] || o.name.en;
        b.addEventListener('click', () => answered(answer, o, picked.fromWiderPool));
        opts.appendChild(b);
      }
      body.appendChild(opts);

      const prog = document.createElement('p');
      prog.className = 'sheet-note';
      prog.textContent = `${i + 1} / ${queue.length}`;
      body.appendChild(prog);
    }

    async function answered(answer, chosen, fromWiderPool) {
      const correct = chosen.qid === answer.qid;
      const now2 = Date.now();
      cards[answer.qid] = fileCard(cards[answer.qid] || newCard(answer.qid), correct, now2);
      results.push({ mineral: answer, chosen, correct, fromWiderPool });

      body.innerHTML = '';
      const verdict = document.createElement('p');
      verdict.className = correct ? 'verdict is-right' : 'verdict is-wrong';
      verdict.textContent = correct
        ? t('review.right')
        : t('review.wrong', { name: answer.name[locale] || answer.name.en });
      body.appendChild(verdict);

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'ghost';
      next.textContent = t('review.next');
      next.addEventListener('click', () => { i++; ask(); });
      body.appendChild(next);
      next.focus();
    }

    async function finish() {
      await saveCards(sdk, cards);
      body.innerHTML = '';
      const right = results.filter((r) => r.correct).length;
      const p = document.createElement('p');
      p.className = 'quiz-done';
      p.textContent = t('review.done', { right, n: results.length });
      body.appendChild(p);

      if (results.length) {
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'ghost';
        save.textContent = t('review.save');
        save.addEventListener('click', async () => {
          save.disabled = true;
          const chronicle = composeSession({
            now: Date.now(), results, levelName: level.name, locale,
          });
          const out = await writeSession(sdk, chronicle);
          const msg = document.createElement('p');
          msg.className = out.ok ? 'sheet-note' : 'memory-error';
          msg.textContent = out.ok ? t('review.saved') : t('review.saveFailed', { why: out.why });
          body.appendChild(msg);
          if (!out.ok) save.disabled = false;
        });
        body.appendChild(save);
      }
    }

    ask();
  }

  renderPicker();
}
