# Doc 116 section 1 — the GO / NO-GO gate

Measured 2026-09-09. Every number below is reproducible from this folder:

```
node validate-expand.cjs     # cell contents, in-cell, absent values
node validate-geometry.cjs   # bond lengths against published values
node validate-render.cjs     # expanded cell -> XYZ -> 3Dmol, round trip
node mutation-check.cjs      # do the checks above actually discriminate
node measure-3dmol.cjs       # what 3Dmol.js does with a CIF
```

## Verdict: **GO**, by the section 1.3 route (our own expander), not by a viewer.

---

## 1. The three test structures

The doc named quartz, calcite and pyrite. Its example COD id (`9000025`) is
**Biotite**, not quartz — it was written from reasoning, not looked up. The ids
below were found through the COD search and verified against the file contents.

| COD | Mineral | Space group | Z | Sites in asym. unit | Published cell content |
|---|---|---|---|---|---|
| 1011172 | Quartz low | P 3<sub>1</sub> 2 1 | 3 | 2 (Si 3a, O 6c) | **9** = 3 Si + 6 O |
| 1547350 | Calcite | R -3 c :H | 6 | 3 (Ca 6b, C 6a, O 18e) | **30** = 6 Ca + 6 C + 18 O |
| 9000594 | Pyrite | P a -3 | 4 | 2 (Fe 4a, S 8c) | **12** = 4 Fe + 8 S |
| 1011013 | Marcasite | P n n m | 2 | 2 | **6** = 2 Fe + 4 S (added: 4th space group) |

The expected counts are established **twice, independently**: from Z x formula,
and from the site multiplicities written in the files themselves. They agree.
Neither comes from our own output.

## 2. What the viewers do (section 1.2)

Both viewers were measured, and **they behave identically**:

| Viewer | Default | With symmetry explicitly requested |
|---|---|---|
| **3Dmol.js** 2.5.2 | asymmetric unit only (2 / 3 / 2) | `doAssembly + duplicateAssemblyAtoms` -> **12 / 108 / 48** |
| **Mol\*** 4.18.0 | asymmetric unit only (2 / 3 / 2) | `buildSymmetryRange` -> **12 / 108 / 48** |

Expected: 9 / 30 / 12.

Neither is a rendering bug. 3Dmol applies the operators **correctly** — this was
checked by hand: its atom 2 for quartz is exactly `-y, x-y, 1/3+z` applied to the
Si site, and its atom 4 is exactly `y-x, -x, 2/3+z`. What neither viewer does is

- **wrap** the result back into the cell (3Dmol's pyrite atoms span
  x ∈ [-2.09, 4.79] Å for a = 5.41 Å), and
- **deduplicate** copies that land on the same point.

Both libraries are built for macromolecules, where no atom sits on a symmetry
axis, so deduplication is never needed. Minerals sit on special positions
constantly: quartz's Si is on the 3a site, so six operators produce three atoms.
That is the whole gap, and it explains why two independent codebases give the
same wrong numbers.

Consequence if shipped as-is: quartz would show **Si:O = 5:6** instead of 1:2 —
a false picture of a real object, which is what section 1.4 forbids.

Licences, read at source: **3Dmol.js BSD-3-Clause**, **Mol\* MIT**. Both are on
the right side of section 0.1 condition 1. The licence was never the problem.

## 3. The section 1.3 fallback, implemented and measured

`expand.cjs` — pure, no viewer, no crystallography library. Parses the operators
the CIF carries (`_symmetry_equiv_pos_as_xyz` **and** the modern
`_space_group_symop_operation_xyz`, which 3Dmol's parser does not mention at
all), applies them to the fractional coordinates, wraps into [0,1), deduplicates
with a periodic tolerance, converts to cartesian.

**Cell contents — 4/4 exact:**

| Mineral | Space group | ops | sites | Expanded | Published |
|---|---|---|---|---|---|
| Quartz low | P 3<sub>1</sub> 2 1 | 6 | 2 | 9 {Si:3, O:6} | 9 {Si:3, O:6} |
| Calcite | R -3 c :H | 36 | 3 | 30 {Ca:6, C:6, O:18} | 30 {Ca:6, C:6, O:18} |
| Pyrite | P a -3 | 24 | 2 | 12 {Fe:4, S:8} | 12 {Fe:4, S:8} |
| Marcasite | P n n m | 8 | 2 | 6 {Fe:2, S:4} | 6 {Fe:2, S:4} |

**Geometry — 4/4 within 0.021 Å of published bond lengths.** The count alone
never touches the fractional-to-cartesian step, so it cannot prove the picture:

| Structure | Bond | Measured | Published |
|---|---|---|---|
| Quartz | Si–O | 1.606 Å | 1.61 Å |
| Calcite | C–O | 1.272 Å | 1.281 Å |
| Pyrite | Fe–S | 2.264 Å | 2.262 Å |
| Pyrite | S–S | 2.156 Å | 2.177 Å |

**Round trip — 8/8 exact.** Expanded cell and 2x2x2 supercell written as XYZ and
read back by 3Dmol.js: same count, same elements, worst coordinate delta
5e-7 Å (the XYZ writer's own 6-decimal rounding).

**Mutation check — 6/6 killed.** Two mutants survived the first pass, and both
were real gaps in the checks rather than equivalent mutants:

| Mutant | First pass | After |
|---|---|---|
| no wrap into the cell | **survived** — both checks were translation-invariant | killed by asserting every atom has 0 ≤ f < 1 |
| no dedupe of special positions | killed | killed |
| identity operator only | killed | killed |
| cell angles ignored | killed (geometry only) | killed |
| `?` read as zero | **survived** — no gate CIF had `?` coordinates | killed by a synthetic site and by COD 1010760 |
| trailing decimal point rejected | killed | killed |

## 4. What this cost, and what it found in passing

Three of the first CIFs touched were already the traps the doc names:

- **COD 1011013** is **Marcasite**, not pyrite — same formula FeS₂, different
  space group. Section 4.3, met on the third file opened.
- **COD 1010760** is named Pyrite, declares `Z = 0`, carries no space group and
  its only atom row is `? ? ? ?`. An entry that names a mineral and contains no
  structure. The expander refuses it (`NO_SYMOPS`) rather than inventing an atom
  at the origin.
- **`0.` is a legal CIF number.** A regex demanding a digit after the decimal
  point silently dropped quartz's entire Si site — 2 of 3 structures still
  passed, which is exactly how this would have shipped unnoticed.
- Text search on the COD matches **arseno**pyrite, **chalco**pyrite,
  **nitro**calcite. Lot 2 must match `_chemical_name_mineral` exactly, not as a
  substring.

## 5. What is NOT established

- ⛔ **Nothing has been seen running in a browser.** The 3Dmol measurements are
  made against its real shipped bundle through its real parser, headless in
  Node. No pixel has been rendered, in the app or out of it.
- ⚠️ The expander is measured on **4 structures and 4 space groups**, not on the
  COD at scale. Occupancies below 1, disordered sites and `_atom_site_symmetry_multiplicity`
  cross-checks are not yet exercised.
- ⚠️ Mol\* was measured through its `cif-core` reader and `buildSymmetryRange`.
  A different Mol\* entry point may behave differently; that was not explored,
  because the fallback route removed the need.
