# NOTICE

This cartridge redistributes data and code that are not ours. Each line below is
a licence condition or a licence *decision*, not a courtesy. Every licence was
read at the URL given, on 2026-09-09, not taken from a secondary source.

## Crystal structures — CC0 (public domain)

> All data in the COD and the database itself are dedicated to the public domain
> and licensed under the CC0 License.

- Project: **Crystallography Open Database (COD)**
- Licence read at: https://www.crystallography.net/cod/
- Entry pages: `https://www.crystallography.net/cod/<id>.html`
- CIF files: `https://www.crystallography.net/cod/<id>.cif`

CC0 requires no attribution and permits redistribution, including commercially.
The credit above is given anyway, because knowing where a datum came from is
part of judging it — and because every structure in this cartridge can be traced
back to a COD id, which is the point of the whole thing.

⚠️ The full COD archive is **26.6 GB** (`Content-Length` on
`https://www.crystallography.net/archives/cod-cifs-mysql.tgz`, measured
2026-09-09), not the 7.3 GB quoted in the design brief. It is not downloaded and
not redistributed. This cartridge ships a filtered subset; how it was filtered,
and how many entries were dropped and why, is in `data/CORPUS.md`.

## Mineral species, names and classification — CC0

Species names, Nickel–Strunz classes, IMA symbols and Wikidata Q-ids come from
**Wikidata**, which is CC0.

- Endpoint: https://query.wikidata.org/sparql
- Properties used: `P31` (instance of *mineral species*, Q12089225),
  `P713` (Nickel–Strunz), `P274` (chemical formula), `P10113` (IMA symbol),
  and `rdfs:label` in en / fr / es.

Measured 2026-09-09: **6 304** mineral species, of which 6 239 carry an IMA
symbol, 4 821 a Nickel–Strunz class and 5 701 a formula.

🚨 Wikidata labels are **not** the IMA register. A species is shown as
IMA-recognised only when it actually carries an IMA symbol; the other 65 are not
silently promoted, and a species with no Strunz class shows `—`, never a guess.

## Viewer — BSD-3-Clause

**3Dmol.js**, https://github.com/3dmol/3Dmol.js — licence text read at
`https://raw.githubusercontent.com/3dmol/3Dmol.js/master/LICENSE`, and the npm
package metadata agrees (`license: BSD-3-Clause`, version 2.5.2).

3Dmol.js incorporates code from GLmol, Three.js and jQuery, all under the same
or compatible permissive terms; its LICENSE file carries those notices and is
redistributed with it.

⚠️ **The viewer is not asked to do crystallography.** It renders atoms we have
already placed. See `gate/GATE.md` for why: 3Dmol.js and Mol\* both return the
asymmetric unit rather than the unit cell, and both return the same wrong count
when asked to apply symmetry, because neither deduplicates atoms sitting on
special positions — which minerals do constantly and proteins never do.

## What is deliberately NOT used

### RRUFF — licence not established, so not used

The design brief flagged that secondary sources describe RRUFF as carrying "a
Creative Commons licence" without saying which, and that the gap between CC BY
and CC BY-NC is the gap between usable and forbidden here.

Checked at source on 2026-09-09:

- https://rruff.info/
- https://rruff.info/about/about_general.php
- https://rruff.net/about/

**No licence statement was found on any of them** — those pages are mineral-name
indexes. The licence therefore remains unestablished, and per the standing rule
(doc 90) the answer to an unestablished licence is no. **No RRUFF data is used.**
The COD is sufficient and is unambiguously CC0.

This is a "not established", not a "forbidden": if someone locates a licence
statement at source, this decision can be revisited. Until then it stays no.

### Mol\* — measured, not shipped

**Mol\*** (MIT, https://www.npmjs.com/package/molstar) was measured against the
same three structures during the gate. It behaves identically to 3Dmol.js on
small-molecule CIFs and is 5 MB against 0.5 MB. It is not a dependency; its
numbers are recorded in `gate/GATE.md` because a comparison you cannot check is
an assertion.

### ChemDoodle Web Components, JSmol

Both can expand crystal symmetry. **ChemDoodle Web Components is GPL-3** outside
internal use, and **JSmol derives from Jmol and carries LGPL**. A Hub cartridge
that embeds GPL code becomes GPL, and the Hub serves commercial software.
Neither is used, and neither was downloaded.

## The fixtures in `gate/cif/`

Five CIF files from the COD, kept in the tree so the gate's numbers can be
re-measured rather than believed. CC0, as above. They are listed with the reason
each one is there in `gate/README.md`.
