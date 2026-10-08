/*
 * The 3D surface. 3Dmol.js is used ONLY as a renderer: it is handed atoms whose
 * positions were already computed and checked (gate/GATE.md), and it is never
 * asked to do crystallography, because measured against three known structures
 * it and Mol* both get the unit cell wrong in exactly the same way.
 *
 * Atoms are drawn as spheres and bonds as our own cylinders, so the bonding rule
 * on screen is the one written in geometry.js and stated in the interface --
 * not whatever heuristic the library happens to apply.
 */
import {
  cellEdges, expandSupercell, computeBonds, ELEMENT_COLORS, DEFAULT_COLOR,
  COVALENT_RADII, DEFAULT_RADIUS,
} from './crystal/geometry.js';

const CELL_COLOR = 0x7a8899;

export function createViewer(element) {
  if (!window.$3Dmol) throw new Error('3Dmol did not load');
  const viewer = window.$3Dmol.createViewer(element, { backgroundColor: 0x0b0d10 });
  let current = null;

  function draw(structure, opts) {
    const showCell = opts.showCell !== false;
    const showBonds = opts.showBonds !== false;
    const repeat = Math.max(1, Math.min(3, opts.repeat || 1));

    viewer.clear();
    const atoms = expandSupercell(structure.atoms, structure.cell, repeat);

    for (const a of atoms) {
      const colour = ELEMENT_COLORS[a.elem] ?? DEFAULT_COLOR;
      const r = (COVALENT_RADII[a.elem] ?? DEFAULT_RADIUS) * 0.32;
      viewer.addSphere({
        center: { x: a.x, y: a.y, z: a.z },
        radius: r,
        color: colour,
        // A site shared with another element is drawn see-through, so that
        // disorder is visible rather than implied by a footnote nobody reads.
        alpha: a.occupancy >= 0.999 ? 1 : Math.max(0.35, a.occupancy),
      });
    }

    let bondInfo = { bonds: [], unknownElements: [], truncated: false };
    if (showBonds) {
      bondInfo = computeBonds(atoms);
      for (const [i, j] of bondInfo.bonds) {
        const a = atoms[i], b = atoms[j];
        viewer.addCylinder({
          start: { x: a.x, y: a.y, z: a.z },
          end: { x: b.x, y: b.y, z: b.z },
          radius: 0.09,
          fromCap: 1, toCap: 1,
          color: 0x8b93a1,
        });
      }
    }

    if (showCell) {
      for (let i = 0; i < repeat; i++) for (let j = 0; j < repeat; j++) for (let k = 0; k < repeat; k++) {
        // Only the outer box when repeating, otherwise the interior grid hides
        // the structure it is supposed to frame.
        if (repeat > 1 && !(i === 0 && j === 0 && k === 0)) continue;
        for (const [p, q] of cellEdges(structure.cell)) {
          viewer.addCylinder({ start: p, end: q, radius: 0.035, color: CELL_COLOR, fromCap: 1, toCap: 1 });
        }
      }
    }

    viewer.zoomTo();
    viewer.render();
    current = { structure, atoms, bondInfo };
    return { atoms: atoms.length, ...bondInfo };
  }

  return {
    draw,
    resize() { viewer.resize(); viewer.render(); },
    clear() { viewer.clear(); viewer.render(); current = null; },
    get current() { return current; },
  };
}
