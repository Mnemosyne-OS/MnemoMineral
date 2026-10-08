/*
 * One level per Nickel-Strunz class, derived from the corpus that actually
 * loaded rather than written down in advance.
 *
 * A hard-coded list of ten classes would keep claiming ten after the corpus
 * changed underneath it. The names are ours; the membership is the data's.
 */

/** The ten top-level Nickel-Strunz classes. The code is the first field of e.g. "4.DA.05". */
const CLASS_NAMES = {
  1: { en: 'Elements', fr: 'Éléments natifs', es: 'Elementos' },
  2: { en: 'Sulfides & sulfosalts', fr: 'Sulfures et sulfosels', es: 'Sulfuros y sulfosales' },
  3: { en: 'Halides', fr: 'Halogénures', es: 'Haluros' },
  4: { en: 'Oxides & hydroxides', fr: 'Oxydes et hydroxydes', es: 'Óxidos e hidróxidos' },
  5: { en: 'Carbonates & nitrates', fr: 'Carbonates et nitrates', es: 'Carbonatos y nitratos' },
  6: { en: 'Borates', fr: 'Borates', es: 'Boratos' },
  7: { en: 'Sulfates', fr: 'Sulfates', es: 'Sulfatos' },
  8: { en: 'Phosphates, arsenates & vanadates', fr: 'Phosphates, arséniates et vanadates', es: 'Fosfatos, arseniatos y vanadatos' },
  9: { en: 'Silicates', fr: 'Silicates', es: 'Silicatos' },
  10: { en: 'Organic compounds', fr: 'Composés organiques', es: 'Compuestos orgánicos' },
};

export function classCodeOf(mineral) {
  const first = (mineral.strunz || '').split('.')[0];
  return /^\d+$/.test(first) ? Number(first) : null;
}

/**
 * Build the levels present in this corpus.
 *
 * Minerals with no Nickel-Strunz class are NOT dropped and NOT filed under a
 * made-up class: they are counted, and the count is shown, because "we do not
 * know this one's class" is a fact about the corpus the reader is entitled to.
 */
export function buildLevels(minerals, locale = 'en') {
  const byClass = new Map();
  let unclassified = 0;
  for (const m of minerals) {
    const code = classCodeOf(m);
    if (code === null) { unclassified++; continue; }
    if (!byClass.has(code)) byClass.set(code, []);
    byClass.get(code).push(m);
  }
  const levels = [...byClass.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, members]) => ({
      code,
      name: (CLASS_NAMES[code] && (CLASS_NAMES[code][locale] || CLASS_NAMES[code].en)) || `Class ${code}`,
      members,
      count: members.length,
    }));
  return { levels, unclassified };
}

export { CLASS_NAMES };
