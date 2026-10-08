# Gate harness — doc 116 section 1

The evidence behind the GO verdict in [GATE.md](./GATE.md). Kept in the tree
because a verdict without a way to re-run it is an assertion.

## Running it

The viewer bundles are not committed (0.5 MB and 5 MB). Fetch them first:

```bash
mkdir -p lib
curl -sSL -o lib/3Dmol-min.js https://cdn.jsdelivr.net/npm/3dmol@2.5.2/build/3Dmol-min.js
```

Then:

```bash
node validate-expand.mjs     # cell contents, in-cell, absent values   (needs no bundle)
node validate-geometry.mjs   # bond lengths vs published values        (needs no bundle)
node validate-render.mjs     # expanded cell -> XYZ -> 3Dmol round trip
node mutation-check.mjs      # do the checks above actually discriminate
node measure-3dmol.mjs       # what 3Dmol.js alone does with a CIF
```

`validate-expand` and `validate-geometry` are the two that matter and neither
needs a download. All exit non-zero on failure.

The Mol\* half of the measurement needs the `molstar` package (5 MB) and was run
outside this tree; its numbers are in GATE.md section 2.

## The fixtures

Five CIF files from the Crystallography Open Database, **CC0** (public domain,
no attribution required — credited anyway, because knowing where a datum comes
from is part of judging it). Source: `https://www.crystallography.net/cod/<id>.cif`

| File | Why it is here |
|---|---|
| `1011172.cif` | Quartz low, P 3<sub>1</sub> 2 1 — Si on a special position, and a `0.` coordinate |
| `1547350.cif` | Calcite, R -3 c :H — 36 operators, the heaviest expansion |
| `9000594.cif` | Pyrite, P a -3 — cubic, 24 operators |
| `1011013.cif` | **Marcasite**, P n n m — same formula as pyrite, different structure |
| `1010760.cif` | Named Pyrite, `Z = 0`, no space group, atom row `? ? ? ?` — an entry that names a mineral and carries no structure |

The last two are not decoration: they are the two failure modes the expander has
to refuse rather than guess at.

## Where the expander lives

`src/crystal/expand.mjs`. There is exactly one copy: the validators and the
build pipeline both import it, and `mutation-check.mjs` patches that file. A
second copy kept "for the gate" would drift away from the one that ships, and
the gate would then be measuring code nobody runs.
