# Mineral

An atlas of crystal structures, wired to your own memory.

3,667 minerals, each drawn as the contents of its **real unit cell** — symmetry
applied, atoms on special positions counted once — from public-domain data, with
its COD id, its Nickel–Strunz class and its space group on screen. Ask what your
own notes already say about the mineral you are looking at. Works fully offline.
Then let it quiz you, drawing the wrong answers from the same Nickel–Strunz class
so the right one is never free.

Port 5221. Permissions: `vault:read`, `vault:write`.

## Install

In Mnemosyne OS, open the MnemoHub, choose « Add a cartridge », and paste this
repository's URL: `https://github.com/Mnemosyne-OS/MnemoMineral`.

Nothing is built on your machine: the cartridge is served from its own
`index.html`, its structures in `public/` and the 3Dmol.js viewer in `vendor/`.

## The one thing worth knowing

**The viewer does not do the crystallography.** A CIF does not contain a crystal;
it contains an asymmetric unit plus a list of symmetry operators. Measured
against quartz, calcite and pyrite, **3Dmol.js and Mol\* both return the
asymmetric unit** (2 / 3 / 2 atoms where the cells hold 9 / 30 / 12), and asked
to apply symmetry explicitly they return the same wrong numbers as each other
(12 / 108 / 48), because both are built for macromolecules where no atom ever
sits on a symmetry axis. Minerals sit on them constantly.

Shipped as-is, quartz would read Si:O = 5:6 instead of 1:2.

So the expansion is ours (`src/crystal/expand.mjs`), it happens at build time,
and it is checked against published cell contents and published bond lengths
before anything ships. The full measurement is in [gate/GATE.md](./gate/GATE.md)
and can be re-run.

## Layout

```
index.html            the cartridge
src/
  app.js              orchestration
  viewer.js           3Dmol as a renderer only
  review-ui.js        the quiz surface
  i18n.js             en / fr / es
  crystal/
    expand.mjs        CIF -> unit cell contents   (the one copy)
    geometry.js       cell box, supercell, bonds
  mnemo/
    memory.js         "ask my notes"  -- the three silences
    review.js         Leitner scheduling + distractor choice
    levels.js         one level per Nickel-Strunz class
    session.js        a session as one chronicle
scripts/              the build pipeline (see data/CORPUS.md)
gate/                 the GO/NO-GO measurement, re-runnable
public/               what ships: index.json + one JSON per mineral
```

## Building

```bash
node scripts/vendor.mjs                 # 3Dmol (BSD-3) + cartridge SDK (MIT)
node scripts/harvest-cod.mjs            # COD metadata      ~40 min, ~300 MB, gitignored
node scripts/fetch-wikidata-species.mjs # the species list
node scripts/build-catalogue.mjs        # the join            --max-old-space-size=6144
node scripts/build-structures.mjs       # the CIFs, expanded
```

`data/CORPUS.md` records what each stage measured, including what was dropped.

## Testing

```bash
node --test "src/**/*.test.mjs"          # 55 unit tests
node src/mutation-check.mjs             # 25 mutants against the app logic
cd gate && node mutation-check.mjs      # 6 mutants against the expander
```

There is **no `package.json`**, deliberately. `apps/*` is a pnpm workspace glob,
so adding one would make this a workspace package, require a lockfile update and
fail CI's `--frozen-lockfile` until someone ran an install. The cartridge is
plain ES modules plus one vendored UMD viewer and needs neither a bundler nor a
dependency, which is also why it installs and runs exactly as it sits here.

## Licences

Data is CC0 (COD, Wikidata), the viewer is BSD-3, the cartridge is MIT. Every
licence was read at source and the URLs are in [NOTICE.md](./NOTICE.md) —
including the one that came back **no**: RRUFF's licence could not be established
at source, so no RRUFF data is used.
