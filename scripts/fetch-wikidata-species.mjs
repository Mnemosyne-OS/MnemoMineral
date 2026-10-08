/*
 * The list of mineral SPECIES, from Wikidata (CC0).
 *
 * Doc 116 section 3: a mineral and a structure are not the same thing. COD gives
 * structures; this gives the species they are structures OF, with the two stable
 * identifiers the cartridge keys on -- the Q-id and the Nickel-Strunz class --
 * plus labels in the product's three core locales.
 *
 * Deliberately NOT the IMA list itself: that is not published under a licence we
 * have established. Wikidata is CC0 and carries the IMA symbol as a property, so
 * an entry that has one can be shown as IMA-recognised without redistributing a
 * list we do not have the right to.
 */
import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'MnemoMineral/0.1 (mineral atlas cartridge; local research use)';
const OUT = path.join(process.cwd(), 'data');

const QUERY = `
SELECT ?m ?en ?fr ?es ?strunz ?formula ?ima WHERE {
  ?m wdt:P31 wd:Q12089225 .
  OPTIONAL { ?m wdt:P713  ?strunz }
  OPTIONAL { ?m wdt:P274  ?formula }
  OPTIONAL { ?m wdt:P10113 ?ima }
  OPTIONAL { ?m rdfs:label ?en FILTER(lang(?en) = "en") }
  OPTIONAL { ?m rdfs:label ?fr FILTER(lang(?fr) = "fr") }
  OPTIONAL { ?m rdfs:label ?es FILTER(lang(?es) = "es") }
}`;

async function run(query) {
  const res = await fetch(ENDPOINT + '?query=' + encodeURIComponent(query), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

const lit = (b, k) => (b[k] && b[k].value ? b[k].value : null);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const json = await run(QUERY);
  const bindings = json.results.bindings;

  // One row per species. A species with several Strunz codes or formulas comes
  // back as several bindings; keep the first and count the rest rather than
  // pretending each is a different mineral.
  const byQid = new Map();
  let extraRows = 0;
  for (const b of bindings) {
    const uri = lit(b, 'm');
    if (!uri) continue;
    const qid = uri.split('/').pop();
    if (byQid.has(qid)) { extraRows++; continue; }
    byQid.set(qid, {
      qid,
      name: { en: lit(b, 'en'), fr: lit(b, 'fr'), es: lit(b, 'es') },
      strunz: lit(b, 'strunz'),
      formula: lit(b, 'formula'),
      imaSymbol: lit(b, 'ima'),
    });
  }

  const species = [...byQid.values()];
  const withEn = species.filter((s) => s.name.en).length;
  const withStrunz = species.filter((s) => s.strunz).length;
  const withFormula = species.filter((s) => s.formula).length;
  const withIma = species.filter((s) => s.imaSymbol).length;

  fs.writeFileSync(path.join(OUT, 'wikidata-species.json'),
    JSON.stringify({
      source: 'https://query.wikidata.org/sparql',
      licence: 'CC0-1.0',
      fetchedAt: new Date().toISOString(),
      counts: { bindings: bindings.length, species: species.length, extraRowsCollapsed: extraRows,
                withEnglishName: withEn, withStrunz, withFormula, withImaSymbol: withIma },
      species,
    }, null, 2));

  console.table([{
    bindings: bindings.length, species: species.length, collapsed: extraRows,
    englishName: withEn, strunz: withStrunz, formula: withFormula, imaSymbol: withIma,
  }]);
  console.log('\nwritten to data/wikidata-species.json');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
