/*
 * The Mnemosyne seam: what this cartridge adds to a crystal viewer.
 *
 * A mineral carries identifiers that are stable across languages, spellings and
 * sources -- an IMA name, a Nickel-Strunz class, a COD entry, a Wikidata Q-id.
 * That is what turns a structure viewer into an INDEX into the human's own
 * memory: select a mineral, and ask what you already know about it.
 *
 * The three rules below are carried over verbatim in intent from the Atlas
 * cartridge, because each one was a decision, not a default.
 *
 * 1. IT IS A BUTTON, NOT A SUBSCRIPTION. `mnemosyne.query` is an LLM call with
 *    RAG attached, so it costs a cloud inference on a cloud route. Firing one
 *    every time a mineral is clicked would bill someone for browsing.
 *
 * 2. THE ANSWER IS BOUND TO THE MINERAL IT WAS ASKED ABOUT. Every state resets
 *    when the qid changes. Showing calcite's answer under aragonite's title is
 *    not a stale render, it is a fabricated fact about two minerals that a
 *    formula alone already fails to tell apart.
 *
 * 3. THE THREE SILENCES ARE THREE DIFFERENT SENTENCES. "Opened outside the
 *    shell", "memory refused" and "your memory holds nothing about this
 *    mineral" send a reader to three different next steps. Merged into one grey
 *    line, two of the three people are sent to fix the wrong thing -- and the
 *    third, who simply has no notes yet, is told the feature is broken.
 */

/** The host's own words for "you are not embedded" (cartridge-sdk index.ts). */
const NO_HOST = 'No Mnemosyne host';

/**
 * The question carries the NAME and the KEYS, because doc 116 section 3 is that
 * a mineral is not its formula: calcite and aragonite are both CaCO3 and are
 * told apart by their space group.
 */
export function buildQuestion(m) {
  const bits = [`COD ${m.cod}`];
  if (m.strunz) bits.push(`Nickel-Strunz ${m.strunz}`);
  if (m.spaceGroup) bits.push(`space group ${m.spaceGroup}`);
  return (
    `What do my own notes say about the mineral ${m.name.en} (${bits.join(', ')})? ` +
    `Answer only from my memory. If my memory holds nothing about it, say exactly: NOTHING IN MEMORY.`
  );
}

/** Read the text out of whatever shape the host returned. */
export function answerTextOf(result) {
  if (!result) return '';
  return String(result.text ?? result.response ?? result.content ?? result.answer ?? '').trim();
}

/**
 * Classify one reply. Pure, so the three silences can be tested without a host.
 * Returns { kind: 'answered'|'empty'|'failed', text?, message? }
 */
export function classify(result) {
  if (result && result.success === false) {
    return { kind: 'failed', message: result.error || 'Memory did not answer.' };
  }
  const text = answerTextOf(result);
  // An empty reply and a "nothing found" reply are the same fact for the
  // reader, and neither is an error. Silence here means "no notes yet", never
  // "this does not work".
  if (!text || /NOTHING IN MEMORY/i.test(text)) return { kind: 'empty' };
  return { kind: 'answered', text };
}

export function classifyError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(NO_HOST)
    ? { kind: 'no-host' }
    : { kind: 'failed', message };
}

/**
 * The panel. Plain DOM: it is mounted into `host` and re-rendered on change.
 * `sdk` is injected so the tests can drive it without a Mnemosyne host.
 */
export function createMemoryPanel({ host, sdk, t }) {
  let phase = { kind: 'idle' };
  let mineral = null;
  // Guards a reply that lands after the human has already moved to another
  // mineral: the promise cannot be cancelled, so the ANSWER is dropped.
  let asked = null;

  function render() {
    host.innerHTML = '';
    if (!mineral) return;

    const h = document.createElement('h3');
    h.textContent = t('memory.title');
    host.appendChild(h);

    const button = (labelKey) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ghost memory-ask';
      b.textContent = t(labelKey);
      b.addEventListener('click', ask);
      return b;
    };
    const note = (text, cls, role) => {
      const p = document.createElement('p');
      p.className = 'memory-note' + (cls ? ' ' + cls : '');
      if (role) p.setAttribute('role', role);
      p.textContent = text;
      return p;
    };

    if (phase.kind === 'idle') {
      host.appendChild(button('memory.ask'));
      host.appendChild(note(t('memory.note')));
    } else if (phase.kind === 'asking') {
      host.appendChild(note(t('memory.reading'), 'memory-busy', 'status'));
    } else if (phase.kind === 'answered') {
      const p = document.createElement('p');
      p.className = 'memory-answer';
      p.textContent = phase.text;
      host.appendChild(p);
      host.appendChild(button('memory.askAgain'));
    } else if (phase.kind === 'empty') {
      host.appendChild(note(t('memory.nothing', { name: mineral.name.en })));
      host.appendChild(button('memory.askAgain'));
    } else if (phase.kind === 'no-host') {
      host.appendChild(note(t('memory.outside')));
    } else if (phase.kind === 'failed') {
      host.appendChild(note(t('memory.failed', { why: phase.message }), 'memory-error', 'alert'));
      host.appendChild(button('memory.tryAgain'));
    }
  }

  async function ask() {
    if (!mineral) return;
    const token = mineral.qid;
    asked = token;
    phase = { kind: 'asking' };
    render();
    try {
      const result = await sdk.query(buildQuestion(mineral));
      if (asked !== token) return;
      phase = classify(result);
    } catch (err) {
      if (asked !== token) return;
      // Never swallowed: a cartridge that fails quietly is indistinguishable
      // from one that is thinking.
      console.warn('[mineral] memory query failed:', err);
      phase = classifyError(err);
    }
    render();
  }

  return {
    show(m) {
      mineral = m;
      phase = { kind: 'idle' };
      asked = null;
      render();
    },
    destroy() { asked = null; host.innerHTML = ''; },
    /* test seams */
    get phase() { return phase; },
    ask,
  };
}
