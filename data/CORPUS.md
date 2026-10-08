# The corpus — what is in it, what was dropped, and why

Built 2026-09-09. Every number here comes from a report file written by the
script that produced it, not from this document. Rebuild with:

```bash
node scripts/harvest-cod.mjs            # COD metadata, ~40 min, ~300 MB (gitignored)
node scripts/fetch-wikidata-species.mjs # the species list
node scripts/build-catalogue.mjs        # the join
node scripts/build-structures.mjs       # the CIFs, expanded
```

## What ships

**3,667 minerals**, 20 MB of expanded unit cells plus a 964 KB index. Nothing is
downloaded at runtime.

## Where it came from

### The structures — Crystallography Open Database, CC0

All 230 space groups were walked. **525,281 rows** harvested against 519,979 ids
the server reported, **0 windows unresolved, 0 truncated**.

The full COD is 534,912 entries; the ~15,000 difference is what the search
excludes by default (retracted entries, and duplicates/theoretical/error-flagged
records) plus entries carrying no space-group number.

⚠️ Two silent failure modes were measured and are guarded in the harvester:

- `format=csv` stops at roughly **21,000 rows without saying so**. Space group 14
  returned 21,005 CSV rows where `format=lst` returned **160,600 ids** for the
  identical filter — a corpus built on the CSV alone is amputated by 87%.
- A large enough response kills the connection outright, and retrying the same
  request fails the same way.

So the id listing is asked first, its count decides whether to split, and every
space group reports harvested-against-expected. That check then caught a defect
in the harvester's own chunking, in the direction nobody looks for: four space
groups came back **over** count, because the volume windows share boundaries and
COD's filter is inclusive at both ends. 99 duplicate rows, deduplicated on COD id.

### The species — Wikidata, CC0

**6,304 mineral species** (`P31` → *mineral species*), of which 6,239 carry an
IMA symbol, 5,701 a formula and 4,821 a Nickel–Strunz class.

## The funnel

| Stage | Count |
|---|---:|
| COD rows read | 525,182 |
| — carrying no mineral name at all | 509,903 |
| Rows carrying a mineral name | **15,279** |
| — whose text is not a name shape | 123 |
| — matching no known species | 2,441 |
| Structures behind a matched species | 12,715 |
| **Species matched** | **3,688** |
| — whose CIF holds no atom sites | 21 |
| **Minerals shipped** | **3,667** |

Only **2.9%** of the COD carries a mineral name. That is the real shape of the
database and the reason this is an atlas of minerals rather than of the COD.

## What was dropped, and why that is right

COD's `mineral` field is free text, not a name. It holds `pyrite at 3.1 GPa`,
`NiS2 at 32 kbar`, `Et2NH2`, `forsterite` (lowercase), `Muscovite 2M1`,
`Hilgardite-3A`. A ladder of candidate forms is tried, and only an **exact**
match against a known species is accepted — nothing matches on substrings,
because a text search for "pyrite" also returns arsenopyrite and chalcopyrite.

A Levinson suffix is deliberately **not** stripped: `-(Ce)` and `-(K)` name the
dominant element and separate species that mineralogy keeps apart.

The most frequently unmatched strings, and what they actually are:

| String | × | What it is |
|---|---:|---|
| Olivine | 127 | a **series**, not a species (forsterite–fayalite) |
| Iron | 98 | the element; Wikidata's "iron" is not the mineral species |
| Nickel | 60 | same |
| Magnesiowuestite | 60 | a solid solution, not a species |
| Lime | 58 | ambiguous between the mineral and the material |
| Cobalt, Tungsten, Beryllium, Hydrogen | 42/42/38/34 | elements on synthetic structures |
| **Rhodocrosite** | **40** | a **misspelling** of rhodochrosite, in the COD itself |
| Feldspar | 31 | a group name |
| Biotite | 29 | discredited as a species in 1998; a series name |

Almost all of these are correct exclusions: an atlas that listed "Neon" and
"Hydrogen" as minerals would be worse, not richer. The one that genuinely costs
something is **Rhodocrosite** — 40 structures lost to a typo in the source. It is
left unmatched on purpose. Correcting a spelling is guessing, and a corpus that
guesses is a corpus you cannot check.

## Which structure represents a mineral

A mineral is not a structure: the 3,667 shipped minerals stand in front of
**12,715** COD entries. Quartz alone has dozens — different temperatures,
pressures and teams — and none of them *is* quartz.

One entry is chosen as the face of each species by a written rule, in order:

1. it must be drawable at all (six cell parameters and a space group);
2. prefer ambient conditions over a pressure or temperature study;
3. prefer a cell measured near room temperature;
4. prefer a cell measured near room pressure;
5. lowest COD id, so the choice is deterministic.

Every mineral's card shows the COD id it is showing and how many other
structures of that mineral exist, so the choice is visible rather than implied.

## The 21 that were dropped at the last step

All 21 are `NO_SITES`: COD entries that name a mineral and carry no atom
coordinates — old records whose only atom row is `? ? ? ?`. COD 1010760, named
Pyrite with `Z = 0` and no space group, is the example kept as a test fixture.
They are refused rather than shipped as empty structures.

## What is not measured

- The chosen "face" structure of each mineral has **not** been reviewed by a
  mineralogist. The rule above is defensible and deterministic; it is not
  expert judgement.
- Partial occupancy is carried and displayed but not resolved: a site shared by
  four rare-earth elements ships as four atoms with fractional occupancies, and
  the card says so rather than pretending to a single composition.
- Nothing here checks that a shipped structure is the *published* structure of
  that mineral beyond the four checked in `gate/GATE.md`.
