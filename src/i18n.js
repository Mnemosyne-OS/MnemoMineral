/*
 * Three locales, because that is the product's floor (en / fr / es).
 *
 * Every string the cartridge can put on screen is here. A key with no
 * translation falls back to English and that is visible in the tests, not
 * hidden -- a missing string that renders as a key is a bug the user sees.
 */

const STRINGS = {
  en: {
    'rail.count': '{n} minerals',
    'rail.countFiltered': '{n} of {total}',
    'rail.search': 'Search a mineral, a formula, a class',
    'rail.none': 'Nothing matches that.',
    'rail.review': 'Review',
    'rail.credits': 'Source & credits',

    'stage.empty': 'Pick a mineral to see the contents of its unit cell.',
    'stage.cell': 'Unit cell',
    'stage.bonds': 'Bonds',
    'stage.repeat': 'Repeat',
    'stage.loading': 'Reading the structure…',
    'stage.failed': 'That structure would not load: {why}',

    'facts.formula': 'Formula',
    'facts.spaceGroup': 'Space group',
    'facts.strunz': 'Nickel–Strunz',
    'facts.cod': 'COD entry',
    'facts.cell': 'Cell',
    'facts.atoms': 'Atoms in the cell',
    'facts.operators': '{n} symmetry operators applied to {s} sites',
    'facts.other': '{n} other structures of this mineral are in the COD',
    'facts.otherOne': '1 other structure of this mineral is in the COD',
    'facts.noHydrogen': 'No hydrogen in this structure. X-ray diffraction sees hydrogen poorly, so this does not mean the mineral has none.',
    'facts.disorder': '{n} of these atoms share a site with another element. The count is of possible positions, not of atoms: the occupancies sum to {sum}.',
    'facts.unknown': '—',

    'memory.title': 'Your memory',
    'memory.ask': 'Ask what my notes say',
    'memory.askAgain': 'Ask again',
    'memory.tryAgain': 'Try again',
    'memory.reading': 'Reading your memory…',
    'memory.note': 'Costs one inference. Nothing is asked until you press.',
    'memory.nothing': 'Your memory holds nothing about {name} yet.',
    'memory.outside': 'Opened outside Mnemosyne, so there is no memory to ask.',
    'memory.failed': 'Memory did not answer: {why}',

    'review.title': 'Review',
    'review.close': 'Close',
    'review.pickLevel': 'Which class do you want to be asked about?',
    'review.allLevels': 'All classes',
    'review.question': 'Which mineral is this?',
    'review.atoms': '{n} atoms in the cell',
    'review.right': 'Right',
    'review.wrong': 'Not this one — it was {name}',
    'review.next': 'Next',
    'review.done': 'Done — {right} right out of {n}.',
    'review.save': 'Write this session to my memory',
    'review.saved': 'Written to your memory.',
    'review.saveFailed': 'Could not write it: {why}',
    'review.tooFew': 'This class holds {n} minerals, and a question needs at least {min}. Pick another.',
    'review.level': '{name} — {n}',
    'review.unclassified': '{n} minerals carry no Nickel–Strunz class and are in no level.',

    'credits.title': 'Source & credits',
    'credits.close': 'Close',
  },

  fr: {
    'rail.count': '{n} minéraux',
    'rail.countFiltered': '{n} sur {total}',
    'rail.search': 'Chercher un minéral, une formule, une classe',
    'rail.none': 'Rien ne correspond.',
    'rail.review': 'Réviser',
    'rail.credits': 'Source et crédits',

    'stage.empty': 'Choisissez un minéral pour voir le contenu de sa maille.',
    'stage.cell': 'Maille',
    'stage.bonds': 'Liaisons',
    'stage.repeat': 'Répéter',
    'stage.loading': 'Lecture de la structure…',
    'stage.failed': 'Cette structure n’a pas pu être chargée : {why}',

    'facts.formula': 'Formule',
    'facts.spaceGroup': 'Groupe d’espace',
    'facts.strunz': 'Nickel–Strunz',
    'facts.cod': 'Entrée COD',
    'facts.cell': 'Maille',
    'facts.atoms': 'Atomes dans la maille',
    'facts.operators': '{n} opérateurs de symétrie appliqués à {s} sites',
    'facts.other': '{n} autres structures de ce minéral sont dans la COD',
    'facts.otherOne': '1 autre structure de ce minéral est dans la COD',
    'facts.noHydrogen': 'Aucun hydrogène dans cette structure. La diffraction des rayons X voit mal l’hydrogène : cela ne veut pas dire que le minéral n’en contient pas.',
    'facts.disorder': '{n} de ces atomes partagent un site avec un autre élément. Le compte est celui des positions possibles, pas des atomes : les occupations totalisent {sum}.',
    'facts.unknown': '—',

    'memory.title': 'Votre mémoire',
    'memory.ask': 'Demander ce que disent mes notes',
    'memory.askAgain': 'Redemander',
    'memory.tryAgain': 'Réessayer',
    'memory.reading': 'Lecture de votre mémoire…',
    'memory.note': 'Coûte une inférence. Rien n’est demandé tant que vous n’appuyez pas.',
    'memory.nothing': 'Votre mémoire ne contient encore rien sur {name}.',
    'memory.outside': 'Ouvert hors de Mnemosyne : il n’y a pas de mémoire à interroger.',
    'memory.failed': 'La mémoire n’a pas répondu : {why}',

    'review.title': 'Révision',
    'review.close': 'Fermer',
    'review.pickLevel': 'Sur quelle classe voulez-vous être interrogé ?',
    'review.allLevels': 'Toutes les classes',
    'review.question': 'Quel minéral est-ce ?',
    'review.atoms': '{n} atomes dans la maille',
    'review.right': 'Juste',
    'review.wrong': 'Pas celui-là — c’était {name}',
    'review.next': 'Suivant',
    'review.done': 'Terminé — {right} bonnes réponses sur {n}.',
    'review.save': 'Écrire cette séance dans ma mémoire',
    'review.saved': 'Écrit dans votre mémoire.',
    'review.saveFailed': 'Impossible de l’écrire : {why}',
    'review.tooFew': 'Cette classe contient {n} minéraux, et une question en demande au moins {min}. Choisissez-en une autre.',
    'review.level': '{name} — {n}',
    'review.unclassified': '{n} minéraux ne portent aucune classe de Nickel–Strunz et ne sont dans aucun niveau.',

    'credits.title': 'Source et crédits',
    'credits.close': 'Fermer',
  },

  es: {
    'rail.count': '{n} minerales',
    'rail.countFiltered': '{n} de {total}',
    'rail.search': 'Buscar un mineral, una fórmula, una clase',
    'rail.none': 'Nada coincide.',
    'rail.review': 'Repasar',
    'rail.credits': 'Fuente y créditos',

    'stage.empty': 'Elige un mineral para ver el contenido de su celda unidad.',
    'stage.cell': 'Celda unidad',
    'stage.bonds': 'Enlaces',
    'stage.repeat': 'Repetir',
    'stage.loading': 'Leyendo la estructura…',
    'stage.failed': 'Esa estructura no se pudo cargar: {why}',

    'facts.formula': 'Fórmula',
    'facts.spaceGroup': 'Grupo espacial',
    'facts.strunz': 'Nickel–Strunz',
    'facts.cod': 'Entrada COD',
    'facts.cell': 'Celda',
    'facts.atoms': 'Átomos en la celda',
    'facts.operators': '{n} operadores de simetría aplicados a {s} sitios',
    'facts.other': 'Hay {n} estructuras más de este mineral en la COD',
    'facts.otherOne': 'Hay 1 estructura más de este mineral en la COD',
    'facts.noHydrogen': 'Sin hidrógeno en esta estructura. La difracción de rayos X ve mal el hidrógeno, así que esto no significa que el mineral no lo tenga.',
    'facts.disorder': '{n} de estos átomos comparten sitio con otro elemento. El recuento es de posiciones posibles, no de átomos: las ocupaciones suman {sum}.',
    'facts.unknown': '—',

    'memory.title': 'Tu memoria',
    'memory.ask': 'Preguntar qué dicen mis notas',
    'memory.askAgain': 'Preguntar otra vez',
    'memory.tryAgain': 'Reintentar',
    'memory.reading': 'Leyendo tu memoria…',
    'memory.note': 'Cuesta una inferencia. No se pregunta nada hasta que pulses.',
    'memory.nothing': 'Tu memoria aún no contiene nada sobre {name}.',
    'memory.outside': 'Abierto fuera de Mnemosyne, así que no hay memoria que consultar.',
    'memory.failed': 'La memoria no respondió: {why}',

    'review.title': 'Repaso',
    'review.close': 'Cerrar',
    'review.pickLevel': '¿Sobre qué clase quieres que te pregunte?',
    'review.allLevels': 'Todas las clases',
    'review.question': '¿Qué mineral es este?',
    'review.atoms': '{n} átomos en la celda',
    'review.right': 'Correcto',
    'review.wrong': 'Ese no — era {name}',
    'review.next': 'Siguiente',
    'review.done': 'Hecho — {right} aciertos de {n}.',
    'review.save': 'Escribir esta sesión en mi memoria',
    'review.saved': 'Escrito en tu memoria.',
    'review.saveFailed': 'No se pudo escribir: {why}',
    'review.tooFew': 'Esta clase tiene {n} minerales y una pregunta necesita al menos {min}. Elige otra.',
    'review.level': '{name} — {n}',
    'review.unclassified': '{n} minerales no tienen clase de Nickel–Strunz y no están en ningún nivel.',

    'credits.title': 'Fuente y créditos',
    'credits.close': 'Cerrar',
  },
};

export const LOCALES = Object.keys(STRINGS);

/** Pick a supported locale from a BCP-47 tag. Unknown falls back to English. */
export function resolveLocale(tag) {
  if (!tag) return 'en';
  const base = String(tag).toLowerCase().split(/[-_]/)[0];
  return LOCALES.includes(base) ? base : 'en';
}

export function makeT(locale) {
  const table = STRINGS[locale] || STRINGS.en;
  return function t(key, vars) {
    let s = table[key];
    if (s === undefined) s = STRINGS.en[key];
    if (s === undefined) return key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
  };
}

export { STRINGS };
