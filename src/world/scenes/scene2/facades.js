import * as THREE from 'three';
import { boxGeo, cbox, cyl, compose } from './kit.js';
import { cellUV } from './art.js';
import { rng as seeded } from '../../build.js';

// Procedural street facades for Rue des Tanneurs (replaces the Kenney city blocks). Every building is
// a mass box in a look recipe (brick, render...) plus trims, windows with surrounds, casements,
// persiennes, balconies, doors and shopfronts, all added to one Batch: the whole street costs about a
// dozen draw calls. Windows are built in a local frame (origin at the window centre on the facade
// plane, +Z = out of the wall) and placed with a parent matrix, so the same code dresses both rows
// and No. 14's end wall.

export const FRONT_X = 5.95;
export const GF = 4.0; // ground-floor height (string course on top)
export const FLOOR = 3.0; // upper storeys
export const ATTIC = 0.7; // cornice + parapet band
export const heightOf = (n) => GF + n * FLOOR + ATTIC;

// side -1 = left (facade faces +X), +1 = right (faces -X). z0 > z1. n = storeys above the ground
// floor. gf: 'door' | 'shop' | 'garage' | 'blank' | 'named' (scene2.js dresses the named shops).
// R4: 'encre' (ENCRE FINE) was B1, a door-and-window front: `was: 'door'` keeps its random draws so
// the rest of the street keeps its shutters. Gérard's building grew to five levels for Lou's 4th-floor
// window: `rngStoreys` keeps the street's draws for the first two, the others use their own seed;
// `windows` forces single windows ('storey,column').
export const BUILDINGS = [
  // Left
  { id: 'A1', side: -1, z0: 14, z1: 7.4, n: 3, recipe: 'render', gfRecipe: 'brickPlaster', gf: 'door', door: 1, balcony: 0, seed: 11 },
  { id: 'A2', side: -1, z0: 7.4, z1: 1.2, n: 2, recipe: 'brickPlaster', gf: 'shop', shop: 'LAVERIE', seed: 12 },
  { id: 'A3', side: -1, z0: 1.2, z1: -5.6, n: 3, recipe: 'brick', gfRecipe: 'render', gf: 'door', door: 0, balcony: 1, seed: 13 },
  { id: 'bakery', side: -1, z0: -5.7, z1: -11.95, n: 2, recipe: 'painted', gf: 'named', seed: 14 },
  { id: 'marco', side: -1, z0: -32.05, z1: -36.35, n: 4, rngStoreys: 2, windows: { '3,0': { shutters: 'open' } }, recipe: 'render', gfRecipe: 'brickPlaster', gf: 'named', seed: 15 },
  { id: 'encre', side: -1, z0: -36.5, z1: -42.2, n: 3, recipe: 'brickPlaster', gf: 'named', was: 'door', door: 1, balcony: 0, seed: 16 },
  { id: 'B2', side: -1, z0: -42.2, z1: -47.9, n: 2, recipe: 'brick', gfRecipe: 'render', gf: 'shop', shop: null, seed: 17 },
  // Right
  { id: 'C1', side: 1, z0: 14, z1: 7.8, n: 2, recipe: 'brick', gf: 'shop', shop: 'QUINCAILLERIE', seed: 21 },
  { id: 'C2', side: 1, z0: 7.8, z1: 0.6, n: 3, recipe: 'render', gfRecipe: 'brickPlaster', gf: 'door', door: 1, balcony: 0, seed: 22 },
  { id: 'C3', side: 1, z0: 0.6, z1: -6.2, n: 2, recipe: 'painted', gf: 'door', door: 1, seed: 23 },
  { id: 'gable', side: 1, z0: -6.3, z1: -13.7, n: 3, recipe: 'brick', gf: 'blank', blind: true, seed: 24 },
  { id: 'D', side: 1, z0: -13.8, z1: -20.2, n: 3, recipe: 'render', gfRecipe: 'brick', gf: 'shop', shop: null, balcony: 1, seed: 25 },
  { id: 'tube', side: 1, z0: -20.3, z1: -24.5, n: 2, recipe: 'brickPlaster', gf: 'named', seed: 26 },
  { id: 'E', side: 1, z0: -24.6, z1: -31.2, n: 3, recipe: 'brick', gfRecipe: 'render', gf: 'door', door: 0, balcony: 0, seed: 27 },
  { id: 'durand', side: 1, z0: -31.3, z1: -36.7, n: 2, recipe: 'brickPlaster', gf: 'named', seed: 28 },
  { id: 'F1', side: 1, z0: -36.8, z1: -42.0, n: 2, recipe: 'render', gfRecipe: 'brickPlaster', gf: 'garage', seed: 29 },
  { id: 'F2', side: 1, z0: -42.0, z1: -47.9, n: 3, recipe: 'brick', gf: 'door', door: 1, balcony: 1, seed: 30 },
];

// Persienne paint, faded: slate blue, sage, cream, rust brown, bottle green, grey.
const SHUTTER_TINTS = ['#8c979e', '#8d9a86', '#c2b9a2', '#8a6e5c', '#6c8270', '#9a9a96'];
const DOOR_TINTS = ['#4f5f58', '#6a4a3e', '#4a5262', '#7a7466', '#5a4636'];
const ROLLER_TINTS = ['#b4b4b0', '#a8aeb2', '#b8b0a4'];

const SF = 0.13; // window surround width
const SD = 0.12; // surround depth (out of the wall)

/** World matrix for a facade-local frame at (along, y, out) on building side `side`. */
export function facadeFrame(side, z, y, out = 0) {
  return compose({ pos: [side * (FRONT_X - out), y, z], rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
}

/**
 * One window. parent: Matrix4 of the window centre on the facade plane (+Z out of the wall).
 * o: { w, h, shutters: 'open'|'half'|'closed'|null, shutterTint, lit: {cell, color} | null,
 *      balcony: bool, grille: bool, sill = true, keystone = false, dayGlass }
 */
export function addWindow(batch, parent, o) {
  const { w = 1.0, h = 1.7, shutters = null, shutterTint = '#8c979e', lit = null, balcony = false, grille = false, sill = true, keystone = false } = o;
  const P = { parent };
  // Glass (a dark reflective pane, or a lit interior from the atlas).
  if (lit) {
    const g = new THREE.PlaneGeometry(w - 0.04, h - 0.04);
    const uv = g.attributes.uv;
    const c = lit.cell;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, c[0] + uv.getX(i) * (c[2] - c[0]), c[1] + uv.getY(i) * (c[3] - c[1]));
    batch.add('winLit', g, { ...P, pos: [0, 0, 0.012], color: lit.color });
  } else batch.add('glass', new THREE.PlaneGeometry(w - 0.04, h - 0.04), { ...P, pos: [0, 0, 0.012] });
  // Surround (reveal): top and sides; the sill closes the bottom.
  batch.add('trim', cbox(w + SF * 2, SF, SD), { ...P, pos: [0, h / 2 + SF / 2, SD / 2] });
  for (const sx of [-1, 1]) batch.add('trim', cbox(SF, h, SD), { ...P, pos: [sx * (w / 2 + SF / 2), 0, SD / 2] });
  if (keystone) batch.add('trim', cbox(0.22, 0.3, SD + 0.04), { ...P, pos: [0, h / 2 + 0.12, (SD + 0.04) / 2] });
  else batch.add('trim', cbox(w + SF * 2 + 0.16, 0.09, SD + 0.05), { ...P, pos: [0, h / 2 + SF + 0.045, (SD + 0.05) / 2] }); // drip mould
  if (sill && !balcony) batch.add('trim', cbox(w + 0.34, 0.07, 0.26), { ...P, pos: [0, -h / 2 - 0.035, 0.11] });
  else batch.add('trim', cbox(w + SF * 2, 0.06, SD), { ...P, pos: [0, -h / 2 - 0.03, SD / 2] });
  // Casement: frame, a mullion, a transom (fanlight above).
  const fw = 0.05;
  const cz = 0.035;
  batch.add('casement', cbox(w, fw, 0.04), { ...P, pos: [0, h / 2 - fw / 2, cz] });
  batch.add('casement', cbox(w, fw, 0.04), { ...P, pos: [0, -h / 2 + fw / 2, cz] });
  for (const sx of [-1, 1]) batch.add('casement', cbox(fw, h, 0.04), { ...P, pos: [sx * (w / 2 - fw / 2), 0, cz] });
  batch.add('casement', cbox(0.04, h * 0.78, 0.04), { ...P, pos: [0, -h * 0.11, cz + 0.005] });
  batch.add('casement', cbox(w, 0.04, 0.04), { ...P, pos: [0, h * 0.28, cz + 0.005] });
  // Persiennes: two leaves hinged on the outside of the surround.
  if (shutters) {
    const phi = shutters === 'closed' ? 0.02 : shutters === 'half' ? Math.PI * 0.58 : Math.PI * 0.955;
    const lw = w / 2 + 0.02;
    for (const sx of [-1, 1]) {
      const hx = sx * (w / 2 + SF);
      // Leaf direction from the hinge: toward the centre at phi 0, flat against the wall at phi pi.
      const dx = -sx * Math.cos(phi);
      const dz = Math.sin(phi);
      const cx = hx + dx * (lw / 2);
      const czz = SD + 0.03 + dz * (lw / 2);
      const rotY = Math.atan2(-dz, dx);
      batch.add('persienne', cbox(lw, h + 0.06, 0.03), { ...P, pos: [cx, 0, czz], rotY, color: shutterTint });
    }
  }
  if (balcony) {
    const bw = w + 0.9;
    batch.add('trim', cbox(bw, 0.12, 0.55), { ...P, pos: [0, -h / 2 - 0.06, 0.275] });
    batch.add('trim', cbox(bw - 0.1, 0.1, 0.4), { ...P, pos: [0, -h / 2 - 0.17, 0.2] }); // corbel line
    addRailing(batch, parent, { len: bw - 0.06, y: -h / 2, z: 0.5, depth: 0.48 });
  }
  if (grille) {
    for (let x = -w / 2 + 0.1; x <= w / 2 - 0.09; x += 0.13) batch.add('iron', cbox(0.018, h - 0.1, 0.018), { ...P, pos: [x, 0, SD + 0.03] });
    for (const y of [-h / 2 + 0.12, h / 2 - 0.12]) batch.add('iron', cbox(w - 0.02, 0.025, 0.02), { ...P, pos: [0, y, SD + 0.04] });
  }
}

/** A wrought-iron balcony railing (front + two returns), base at local y, front at z. */
export function addRailing(batch, parent, { len, y, z, depth = 0.45, height = 0.95 }) {
  const P = { parent };
  batch.add('iron', cbox(len, 0.04, 0.05), { ...P, pos: [0, y + height, z] });
  batch.add('iron', cbox(len, 0.025, 0.025), { ...P, pos: [0, y + 0.12, z] });
  const n = Math.max(4, Math.round(len / 0.12));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    batch.add('iron', cbox(0.016, height - 0.02, 0.016), { ...P, pos: [x, y + height / 2, z] });
  }
  // A band of loops under the top rail (reads as ornament at a distance).
  batch.add('iron', cbox(len, 0.012, 0.012), { ...P, pos: [0, y + height - 0.16, z] });
  for (const sx of [-1, 1]) {
    batch.add('iron', cbox(0.04, 0.04, depth), { ...P, pos: [sx * (len / 2), y + height, z - depth / 2] });
    for (let k = 1; k < 4; k++) batch.add('iron', cbox(0.016, height - 0.02, 0.016), { ...P, pos: [sx * (len / 2), y + height / 2, z - (k / 4) * depth] });
  }
}

/** A street door: stone surround, panelled leaf (recessed), fanlight, a low step. */
export function addDoor(batch, parent, { w = 1.25, h = 2.35, tint = '#4f5f58', lit = false, fan = 0.5 } = {}) {
  const P = { parent };
  const f = 0.2;
  const H = h + fan;
  batch.add('trim', cbox(w + f * 2, 0.24, 0.2), { ...P, pos: [0, H + 0.12, 0.1] });
  for (const sx of [-1, 1]) batch.add('trim', cbox(f, H, 0.18), { ...P, pos: [sx * (w / 2 + f / 2), H / 2, 0.09] });
  batch.add('door', cbox(w, h, 0.06), { ...P, pos: [0, h / 2, 0.03], color: tint });
  for (const sx of [-1, 1]) {
    batch.add('door', cbox(w / 2 - 0.16, h * 0.42, 0.03), { ...P, pos: [sx * (w / 4), h * 0.7, 0.07], color: tint });
    batch.add('door', cbox(w / 2 - 0.16, h * 0.3, 0.03), { ...P, pos: [sx * (w / 4), h * 0.24, 0.07], color: tint });
  }
  batch.add('casement', cbox(0.04, h, 0.03), { ...P, pos: [0, h / 2, 0.075] });
  batch.add('iron', cbox(0.03, 0.18, 0.04), { ...P, pos: [0.12, h * 0.48, 0.1] }); // handle
  if (fan > 0) {
    batch.add('casement', cbox(w, 0.06, 0.06), { ...P, pos: [0, h + 0.03, 0.03] });
    if (lit) batch.add('winLit', atlasQuad(w - 0.04, fan - 0.08, lit.cell), { ...P, pos: [0, h + fan / 2, 0.01], color: lit.color });
    else batch.add('glass', new THREE.PlaneGeometry(w - 0.04, fan - 0.08), { ...P, pos: [0, h + fan / 2, 0.01] });
    for (let k = 1; k < 4; k++) batch.add('casement', cbox(0.025, fan - 0.08, 0.03), { ...P, pos: [-w / 2 + (k / 4) * w, h + fan / 2, 0.025] });
  }
  batch.add('trim', cbox(w + f * 2 + 0.2, 0.06, 0.34), { ...P, pos: [0, 0.03, 0.17] }); // worn step
}

function atlasQuad(w, h, cell) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cell[0] + uv.getX(i) * (cell[2] - cell[0]), cell[1] + uv.getY(i) * (cell[3] - cell[1]));
  return g;
}

/**
 * A shopfront opening with a roller shutter down (or half up), its housing, guide rails and a fascia
 * board above. Returns the fascia's centre (local) so a text sign can sit on it.
 */
export function addShopfront(batch, parent, { w, h = 2.75, tint = '#b4b4b0', fasciaTint = '#3e4642', open = 0, glass = true } = {}) {
  const P = { parent };
  // Pilasters either side and the fascia board.
  for (const sx of [-1, 1]) batch.add('trim', cbox(0.3, 3.3, 0.16), { ...P, pos: [sx * (w / 2 + 0.15), 1.65, 0.08] });
  batch.add('door', cbox(w + 0.7, 0.62, 0.1), { ...P, pos: [0, 3.36, 0.06], color: fasciaTint });
  batch.add('trim', cbox(w + 0.9, 0.1, 0.24), { ...P, pos: [0, 3.72, 0.12] }); // cornice over the fascia
  // Shutter, housing, guide rails.
  const sh = h * (1 - open);
  if (sh > 0.02) batch.add('roller', cbox(w, sh, 0.05), { ...P, pos: [0, h - sh / 2, 0.05], color: tint });
  batch.add('roller', cbox(w + 0.12, 0.34, 0.32), { ...P, pos: [0, h + 0.17, 0.16], color: tint });
  for (const sx of [-1, 1]) batch.add('iron', cbox(0.07, h, 0.09), { ...P, pos: [sx * (w / 2 + 0.01), h / 2, 0.06] });
  batch.add('iron', cbox(w, 0.06, 0.08), { ...P, pos: [0, h - sh + 0.03, 0.08] }); // bottom bar
  if (open > 0 && glass) batch.add('glass', new THREE.PlaneGeometry(w - 0.1, h - sh - 0.1), { ...P, pos: [0, (h - sh) / 2, 0.01] });
  return { fascia: [0, 3.36, 0.115], w: w + 0.6 };
}

/**
 * One building. Adds its mass, trims, windows, ground floor and a downpipe to the batch.
 * opts: { evening, rng, litCells, shopSigns: [] (filled with {text, parent, w}),
 *         lights = true (false: the night layout with every window dark; the draws are the same),
 *         hollow: Set of ids whose ground-floor mass scene2/rooms.js replaces with a room }
 */
export function addBuilding(batch, b, { evening, rng, litCells, shopSigns, lights = true, hollow = null }) {
  const s = b.side;
  const W = b.z0 - b.z1;
  const zc = (b.z0 + b.z1) / 2;
  const H = heightOf(b.n);
  const depth = 8;
  const mx = s * (FRONT_X + depth / 2);
  // Mass: the ground floor and the upper storeys can differ (render over brick, brick over render).
  const upper = b.recipe;
  const lower = b.gfRecipe || b.recipe;
  if (!hollow?.has(b.id)) batch.add(lower, boxGeo(depth, GF, W), { pos: [mx, 0, zc] });
  batch.add(upper, boxGeo(depth, H - GF, W), { pos: [mx, GF, zc] });
  // Trims: plinth, string course, cornice, coping, party-wall strips.
  batch.add('trim', boxGeo(0.1, 0.45, W), { pos: [s * FRONT_X, 0, zc] });
  batch.add('trim', boxGeo(0.18, 0.2, W), { pos: [s * FRONT_X, GF - 0.1, zc] });
  batch.add('trim', boxGeo(0.56, 0.22, W), { pos: [s * FRONT_X, H - ATTIC + 0.12, zc] });
  batch.add('trim', boxGeo(0.34, 0.12, W), { pos: [s * FRONT_X, H - ATTIC, zc] });
  batch.add('trim', boxGeo(0.3, 0.1, W), { pos: [s * (FRONT_X + 0.05), H, zc] });
  for (const z of [b.z0 - 0.16, b.z1 + 0.16]) batch.add(upper === 'brick' ? 'trim' : upper, boxGeo(0.12, H - GF - 0.1, 0.32), { pos: [s * FRONT_X, GF + 0.1, z] });
  // Roof: a chimney stack or two.
  for (let k = 0; k < 1 + (rng() < 0.5 ? 1 : 0); k++) {
    const cz = b.z1 + 0.8 + rng() * (W - 1.6);
    batch.add('brick', boxGeo(0.6 + rng() * 0.4, 1.2 + rng() * 1.2, 0.5), { pos: [s * (FRONT_X + 2 + rng() * 3), H, cz] });
  }

  // Upper storeys.
  const cols = b.blind ? 0 : Math.max(1, Math.floor(W / 2.45));
  const step = W / Math.max(1, cols);
  const tint = SHUTTER_TINTS[(b.seed * 7) % SHUTTER_TINTS.length];
  const extra = b.rngStoreys !== undefined ? seeded(b.seed * 97) : null;
  for (let k = 0; k < b.n; k++) {
    const yb = GF + k * FLOOR;
    const balcony = b.balcony === k;
    const rng2 = extra && k >= b.rngStoreys ? extra : rng;
    for (let i = 0; i < cols; i++) {
      const z = b.z0 - step * (i + 0.5);
      const h = balcony ? 2.3 : 1.7;
      const y = balcony ? yb + 0.2 + h / 2 : yb + 0.95 + h / 2;
      const r = rng2();
      const shutters = r < 0.18 ? 'closed' : r < 0.32 ? 'half' : r < 0.85 ? 'open' : null;
      let lit = evening && shutters !== 'closed' && rng2() < 0.16 ? { cell: litCells[(rng2() * litCells.length) | 0], color: litColor(rng2) } : null;
      if (!lights) lit = null;
      const o = { w: 1.0, h, shutters, shutterTint: rng2() < 0.85 ? tint : SHUTTER_TINTS[(rng2() * SHUTTER_TINTS.length) | 0], lit, balcony, keystone: b.recipe === 'brick' && k === 0 };
      addWindow(batch, facadeFrame(s, z, y), { ...o, ...(b.windows?.[`${k},${i}`] || {}) });
    }
  }

  // Ground floor.
  if (b.gf === 'door' || b.gf === 'blank') {
    const doorCol = b.gf === 'blank' ? -1 : Math.min(cols - 1, b.door ?? 0);
    const gcols = Math.max(1, cols);
    for (let i = 0; i < gcols; i++) {
      const z = b.z0 - (W / gcols) * (i + 0.5);
      if (i === doorCol) {
        const lit = evening && rng() < 0.5 && lights ? { cell: litCells[3], color: '#b89a70' } : null;
        addDoor(batch, facadeFrame(s, z, 0), { tint: DOOR_TINTS[(b.seed + i) % DOOR_TINTS.length], lit });
      } else if (b.gf === 'door') {
        addWindow(batch, facadeFrame(s, z, 1.85), { w: 1.0, h: 1.6, grille: true, shutters: rng() < 0.4 ? 'closed' : null, shutterTint: tint });
      }
    }
    if (b.gf === 'blank') {
      // A steel service door near the corner.
      batch.add('roller', boxGeo(0.06, 2.1, 1.0), { pos: [s * (FRONT_X - 0.02), 0, b.z1 + 1.1], color: '#9a9c98' });
      batch.add('trim', boxGeo(0.16, 0.16, 1.3), { pos: [s * FRONT_X, 2.1, b.z1 + 1.1] });
    }
  } else if (b.gf === 'shop' || b.gf === 'garage') {
    const w = Math.min(b.gf === 'garage' ? 3.2 : 4.6, W - 1.6);
    const zShop = zc + (b.gf === 'shop' ? 0.35 : 0);
    const r = addShopfront(batch, facadeFrame(s, zShop, 0), { w, tint: ROLLER_TINTS[b.seed % ROLLER_TINTS.length], fasciaTint: b.gf === 'garage' ? '#55524c' : '#3e4642' });
    if (b.shop && shopSigns) shopSigns.push({ text: b.shop, parent: facadeFrame(s, zShop, 0), pos: r.fascia, w: Math.min(r.w, 4.2) });
    // A door beside the shop if there is room.
    const dz = zShop - (w / 2 + 0.9);
    if (dz - 0.75 > b.z1 + 0.35) addDoor(batch, facadeFrame(s, dz, 0), { w: 1.0, h: 2.25, fan: 0.4, tint: DOOR_TINTS[b.seed % DOOR_TINTS.length] });
  } else if (b.gf === 'named' && b.was === 'door') {
    // The draws its old door-and-window front made (see BUILDINGS).
    const doorCol = Math.min(cols - 1, b.door ?? 0);
    for (let i = 0; i < Math.max(1, cols); i++) if (i !== doorCol || evening) rng();
  }

  // Downpipe at the low end, with brackets, a hopper and a shoe.
  const pz = b.z1 + 0.32;
  const px = s * (FRONT_X - 0.1);
  batch.add('pipe', cyl(0.055, 0.055, H - 0.4, 10), { pos: [px, 0.12, pz] });
  batch.add('pipe', cbox(0.22, 0.22, 0.22), { pos: [px, H - 0.45, pz] });
  batch.add('pipe', cyl(0.07, 0.055, 0.14, 10), { pos: [s * (FRONT_X - 0.16), 0.0, pz], rot: [0, 0, s * 0.6] });
  for (let y = 1.6; y < H - 0.6; y += 2.1) batch.add('iron', cbox(0.16, 0.05, 0.14), { pos: [s * (FRONT_X - 0.06), y, pz] });
}

function litColor(rng) {
  const r = rng();
  if (r < 0.15) return new THREE.Color('#8fa6c0').multiplyScalar(0.9); // a TV
  const k = 0.75 + rng() * 0.7;
  return new THREE.Color('#ffd7a0').multiplyScalar(k);
}

/** The lit-window atlas cells (2 x 2). */
export const LIT_CELLS = [0, 1, 2, 3].map((i) => cellUV(i, 2));
