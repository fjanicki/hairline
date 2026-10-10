import { MeshStandardMaterial } from 'three';

// HAIRLINE art bible: named surface recipes and per-chapter lighting, shared by every scene so the
// same street (Ch2 at dusk in the rain, Ch7 at golden hour) is built from the same materials.
//
//   look.surface('street.asphalt')            -> cached MeshStandardMaterial (world-mapped PBR + weather)
//   look.surface('facade.brick', { grime: 1 }) -> same recipe, overrides merged
//   look.recipe('street.asphalt')             -> the raw recipe object (read-only)
//   look.chapter                              -> the active scene look (LOOKS / CHAPTER_LOOKS[i]); set by main.js
//   LIGHTING.<preset>                         -> HDRI + grade data the Mood presets spread in
//
// The recipe `level` is the target mean albedo (linear luminance) every texture is normalised to,
// so a black asphalt and a pale render sit in the same value band the grade was tuned for
// (sRGB ~#707070-#b0b0b0 for walls and floors, darker for roads). Weather (wet, grime) comes from the
// active chapter unless the call overrides it. Without the material files every recipe falls back
// to its flat `color`.

/**
 * Surface recipes. id = materials.json id; scale = tile multiplier (world mapping); level = target
 * mean albedo (linear); tint multiplies; wet/grime are multipliers on the chapter's weather (0 = never).
 */
export const SURFACES = {
  // Street (Ch2, Ch3, Ch5-Ch7): same recipes every time; the look's weather makes Ch2 wet, Ch7 dry.
  'street.asphalt': { id: 'street_asphalt_wet', color: '#4a4b4d', level: 0.075, roughness: 1, grime: 0.8, wet: 1 },
  'street.cobbles': { id: 'street_cobbles', color: '#4e4e50', level: 0.08, grime: 0.8, wet: 1 },
  'street.pavement': { id: 'street_pavement', color: '#7c7b76', level: 0.16, grime: 0.9, wet: 0.9 },
  'street.kerb': { id: 'concrete_grimy', color: '#74726d', level: 0.15, scale: 0.6, grime: 1, wet: 0.8 },
  'facade.brick': { id: 'facade_brick_dark', color: '#7a5a4c', level: 0.13, grime: 1, wet: 0.6 },
  'facade.brickPainted': { id: 'facade_brick_painted', color: '#a49c8a', level: 0.3, grime: 1, wet: 0.6 },
  'facade.brickPlaster': { id: 'facade_brick_plaster', color: '#8e7464', level: 0.18, grime: 1, wet: 0.6 },
  'facade.render': { id: 'facade_render', color: '#9c968a', level: 0.26, grime: 1, wet: 0.6 },
  'shutter.rust': { id: 'shutter_rusty', color: '#6f6a62', level: 0.16, roughness: 1, grime: 0.6, wet: 0.4 },
  'metal.green': { id: 'metal_painted_green', color: '#3f5446', level: 0.1, grime: 0.6, wet: 0.4 },
  'metal.rust': { id: 'metal_painted_rusty', color: '#8a8378', level: 0.22, tint: '#d4d0cc', grime: 0.5, wet: 0.4 },
  'metal.corrugated': { id: 'metal_corrugated_rusty', color: '#6c5a4c', level: 0.14, grime: 0.6, wet: 0.4 },
  'concrete.grimy': { id: 'concrete_grimy', color: '#7d7b76', level: 0.2, grime: 1, wet: 0.6 },
  'mural.wall': { id: 'wall_mural_render', color: '#b9b2a2', level: 0.36, grime: 0.7, wet: 0.5 },
  // Flat (Ch1)
  'interior.floorboards': { id: 'flat_floorboards', color: '#6e6254', level: 0.13, grime: 0.6, wet: 0 },
  'interior.plaster': { id: 'plaster_painted', color: '#a59e8c', level: 0.3, grime: 0.8, wet: 0 },
  'interior.tile': { id: 'tile_white_long', color: '#b4b2aa', level: 0.4, grime: 0.8, wet: 0 },
  'interior.fabric': { id: 'fabric_wool', color: '#5d5f62', level: 0.1, grime: 0.3, wet: 0, scale: 1.5 },
  // Workshop (Ch4-Ch6, Ch7 open garage)
  'workshop.concrete': { id: 'workshop_floor_concrete', color: '#7a7268', level: 0.16, grime: 0.8, wet: 0 },
  'workshop.brick': { id: 'brick_whitewashed', color: '#a8a296', level: 0.32, grime: 1, wet: 0 },
  'workshop.timber': { id: 'wood_planks_weathered', color: '#6e6050', level: 0.14, grime: 0.6, wet: 0 },
  'workshop.paintedWood': { id: 'wood_planks_painted', color: '#a8a496', level: 0.32, grime: 0.6, wet: 0 },
  'workshop.plywood': { id: 'wood_plywood', color: '#a08a68', level: 0.24, grime: 0.4, wet: 0 },
  'workshop.steel': { id: 'metal_plate_worn', color: '#55565a', level: 0.09, grime: 0.6, wet: 0 },
};

/**
 * HDRI facts (docs/assets/materials.md): the key light's direction in three.js world space with
 * environmentRotation 0, used to auto-align the HDRI's key with the preset's sunDir.
 */
export const HDRI = {
  night_street: { key: [0.9, 0.43, 0.01] },
  dawn_fog: { key: [0.7, 0.06, 0.72] },
  golden_street: { key: [0.75, 0.43, 0.5] },
  interior_dim: { key: [0.81, 0.21, 0.55] },
  workshop: { key: [0.76, 0.47, 0.45] },
};

/**
 * Per-preset lighting + grade data (Mood presets spread these in; see Mood.js for every field).
 *   env / envIntensity / envIntensityHope  HDRI id and its strength at hope 0 / 1 (every HDRI is
 *                                          normalised to a mean radiance of 1 when it loads)
 *   envRotation (rad, Y) or envAlign (rotate the HDRI key onto sunDir)
 *   ao, bloom, bloomThreshold, heightFog, heightFogFalloff, heightFogY, lift/gamma/gain,
 *   splitShadow / splitHigh / split, shoulder, ca
 */
export const LIGHTING = {
  // Ch1: the window (key of interior_dim) turned to the back wall; it only fills and reflects.
  flat: {
    env: 'interior_dim',
    envIntensity: 0.12,
    envRotation: 2.16,
    ao: 1,
    bloom: 0.55,
    bloomThreshold: 1.25,
    lift: [0.006, 0.009, 0.006],
    gamma: [1, 1.02, 0.98],
    splitShadow: '#56705f',
    splitHigh: '#d8ceb4',
    split: 0.22,
    shoulder: 0.6,
    ca: 0.5,
  },
  // Ch2: sodium night street for the wet reflections only; the lamps stay the key.
  street: {
    env: 'night_street',
    envIntensity: 0.045,
    envIntensityHope: 0.06,
    envAlign: true,
    ao: 0.9,
    bloom: 0.7,
    bloomThreshold: 3,
    heightFog: 0.025,
    heightFogFalloff: 0.55,
    lift: [0.004, 0.007, 0.01],
    splitShadow: '#4e6672',
    splitHigh: '#e2b77e',
    split: 0.28,
    shoulder: 0.7,
    ca: 0.6,
  },
  // Ch3: cold fog dawn, low sun ahead (-Z).
  dawnrun: {
    env: 'dawn_fog',
    envIntensity: 0.12,
    envAlign: true,
    ao: 0.8,
    bloom: 0.55,
    bloomThreshold: 3.5,
    heightFog: 0.035,
    heightFogFalloff: 0.35,
    lift: [0.004, 0.008, 0.014],
    splitShadow: '#4a6488',
    splitHigh: '#dcecff',
    split: 0.2,
    shoulder: 0.6,
    ca: 0.4,
  },
  // Ch4: the workshop HDRI fills under the tungsten bulb.
  workshop: {
    env: 'workshop',
    envIntensity: 0.13,
    envIntensityHope: 0.18,
    envAlign: true,
    ao: 1,
    bloom: 0.6,
    bloomThreshold: 1.3,
    lift: [0.008, 0.006, 0.003],
    splitShadow: '#5a5446',
    splitHigh: '#f0cf9c',
    split: 0.24,
    shoulder: 0.6,
    ca: 0.45,
  },
  // Ch7 day: late afternoon after the rain, warming with hope (ch7.js overrides most of it).
  wall: {
    env: 'golden_street',
    envIntensity: 0.06,
    envIntensityHope: 0.09,
    envAlign: false,
    ao: 0.85,
    bloom: 0.45,
    bloomThreshold: 2.5,
    heightFog: 0.012,
    heightFogFalloff: 0.4,
    lift: [0.004, 0.005, 0.006],
    splitShadow: '#5b6670',
    splitHigh: '#efd6aa',
    split: 0.18,
    shoulder: 0.5,
    ca: 0.35,
  },
  // Ch7 final walk: gold from the far end of the street.
  golden: {
    env: 'golden_street',
    envIntensity: 0.12,
    envAlign: true,
    ao: 0.8,
    bloom: 0.5,
    bloomThreshold: 2.5,
    heightFog: 0.025,
    heightFogFalloff: 0.35,
    lift: [0.008, 0.005, 0.002],
    splitShadow: '#5e5a6a',
    splitHigh: '#ffd79a',
    split: 0.22,
    shoulder: 0.5,
    ca: 0.3,
  },
  // The colour-returns end (title backdrop, final card).
  bright: {
    env: 'golden_street',
    envIntensity: 0.2,
    envAlign: true,
    ao: 0.7,
    bloom: 0.4,
    bloomThreshold: 2,
    split: 0,
    envBackground: 0.45,
  },
};

/**
 * Scene looks, by name. main.js activates one before each scene build (a chapter's own build, or a
 * mid-chapter d.scene() swap) so the shared build.js helpers pick the right recipes for big surfaces the
 * scenes did not tag:
 *   ground  - large build.ground() planes          slab - thin, large build.box() slabs (sidewalks)
 *   facade  - tall, wide build.box() blocks         walls - build.mat() with a grimeTexture map
 *   wet / grime - weather multipliers               kenney - restyleKenney() options for Kenney props
 *   cones   - add soft light cones under street lamps and spot lights
 *   hdris   - every HDRI the scene may switch to (preloaded with it)
 *   materials / props - everything the build loads (SCENE_ASSETS below; preloaded with it)
 */
export const LOOKS = {
  flat: { key: 'flat', ground: 'interior.floorboards', slab: 'interior.floorboards', facade: 'interior.plaster', walls: 'interior.plaster', wet: 0, grime: 0.8, kenney: { grime: 0.5, desat: 0.15 }, cones: false, hdris: ['interior_dim'] },
  evening: { key: 'evening', ground: 'street.asphalt', slab: 'street.pavement', facade: 'facade.brick', walls: 'facade.render', wet: 1, grime: 1, kenney: { grime: 0.7, desat: 0.2, wet: 0.7 }, cones: true, hdris: ['night_street'] },
  dawnrun: { key: 'dawnrun', ground: 'street.asphalt', slab: 'street.pavement', facade: 'concrete.grimy', walls: 'concrete.grimy', wet: 0.7, grime: 0.8, kenney: { grime: 0.5, desat: 0.15, wet: 0.5 }, cones: true, hdris: ['dawn_fog'] },
  workshop: { key: 'workshop', ground: 'workshop.concrete', slab: 'workshop.timber', facade: 'workshop.brick', walls: 'workshop.brick', wet: 0, grime: 0.9, kenney: { grime: 0.6, desat: 0.15 }, cones: true, hdris: ['workshop'] },
  wall: { key: 'wall', ground: 'street.asphalt', slab: 'street.pavement', facade: 'facade.brick', walls: 'facade.render', wet: 0.25, grime: 0.8, kenney: { grime: 0.55, desat: 0.15, wet: 0.15 }, cones: false, hdris: ['golden_street'] },
};

/**
 * Every PBR set and prop each look's build loads (measured from the builds; Kenney pieces by path, Poly
 * Haven props by id). main.js fetches them in parallel up front: on the loading screen for the first
 * chapter, behind the fade for the others. A stale list only costs time, never correctness.
 */
const SCENE_ASSETS = {
  flat: { materials: ['fabric_wool', 'flat_floorboards', 'metal_painted_rusty', 'metal_plate_worn', 'plaster_painted', 'tile_white_long', 'wood_planks_painted', 'wood_plywood'],
    props: ['cardboard_box', 'crt_tv', 'fluoro_light', 'iron_bed', 'paint_can', 'sofa_worn', 'trash_bag', 'wrist_watch'] },
  evening: { materials: ['brick_whitewashed', 'concrete_grimy', 'facade_brick_dark', 'facade_brick_painted', 'facade_brick_plaster', 'facade_render', 'metal_corrugated_rusty', 'metal_painted_green', 'metal_painted_rusty', 'shutter_rusty', 'street_asphalt_wet', 'street_cobbles', 'street_pavement', 'wall_mural_render', 'wood_planks_painted', 'wood_planks_weathered', 'workshop_floor_concrete'],
    props: ['kenney/city/low-detail-building-a.glb', 'kenney/city/low-detail-building-b.glb', 'kenney/city/low-detail-building-c.glb', 'kenney/city/low-detail-building-d.glb', 'kenney/retro/detail-bricks-type-a.glb', 'kenney/retro/pallet-small.glb', 'kenney/roads/construction-cone.glb', 'kenney/survival/bottle-large.glb', 'barrel', 'bin_metal', 'cafe_set', 'cardboard_box', 'crate_wood', 'milk_crate', 'paint_can', 'trash_bag'] },
  dawnrun: { materials: ['concrete_grimy', 'facade_brick_dark', 'facade_brick_painted', 'facade_brick_plaster', 'facade_render', 'metal_painted_green', 'metal_painted_rusty', 'shutter_rusty', 'street_asphalt_wet', 'street_cobbles', 'street_pavement'],
    props: ['kenney/retro/detail-dumpster-closed.glb', 'kenney/retro/pallet-small.glb', 'bin_metal', 'milk_crate', 'road_barrier', 'trash_bag'] },
  workshop: { materials: ['brick_whitewashed', 'concrete_grimy', 'facade_brick_plaster', 'facade_render', 'metal_corrugated_rusty', 'metal_painted_green', 'metal_painted_rusty', 'metal_plate_worn', 'plaster_painted', 'shutter_rusty', 'street_cobbles', 'street_pavement', 'wood_planks_painted', 'wood_planks_weathered', 'wood_plywood', 'workshop_floor_concrete'],
    props: ['barrel', 'bench_vice', 'bulb', 'cardboard_box', 'chair_painted', 'crate_wood', 'drill', 'fluoro_light', 'hammer', 'handsaw', 'oil_can', 'paint_can', 'pliers', 'radio', 'screwdriver', 'spanner', 'steel_shelves', 'stool', 'tape_measure', 'toolbox', 'track_pump'] },
  wall: { materials: ['brick_whitewashed', 'concrete_grimy', 'fabric_wool', 'facade_brick_dark', 'facade_brick_painted', 'facade_brick_plaster', 'facade_render', 'metal_corrugated_rusty', 'metal_painted_green', 'metal_painted_rusty', 'shutter_rusty', 'street_asphalt_wet', 'street_cobbles', 'street_pavement', 'wall_mural_render', 'wood_planks_painted', 'wood_planks_weathered', 'wood_plywood', 'workshop_floor_concrete'],
    props: ['kenney/city/low-detail-building-a.glb', 'kenney/city/low-detail-building-b.glb', 'kenney/city/low-detail-building-c.glb', 'kenney/city/low-detail-building-d.glb', 'kenney/survival/bottle-large.glb', 'barrel', 'bench_vice', 'bin_metal', 'bulb', 'cafe_set', 'cardboard_box', 'chair_painted', 'crate_wood', 'fluoro_light', 'hammer', 'handsaw', 'milk_crate', 'oil_can', 'paint_can', 'pliers', 'radio', 'screwdriver', 'spanner', 'steel_shelves', 'stepladder', 'stool', 'toolbox', 'track_pump', 'trash_bag', 'wrist_watch'] },
};
// R4 sets on the street (scene2/encre.js, durand.js): ENCRE FINE's plaster and boards in every street
// variant (Ch2 and the wall too), so the street looks preload them.
for (const k of ['evening', 'wall']) SCENE_ASSETS[k].materials.push('plaster_painted', 'flat_floorboards');
for (const [k, a] of Object.entries(SCENE_ASSETS)) Object.assign(LOOKS[k], {
  materials: a.materials,
  props: a.props.map((p) => (p.includes('/') ? p : `props/${p}.glb`)),
});

/**
 * The R4 street variants (buildScene2 'day' and 'night'): Ch5 and Ch6 by day, Ch5's 4 a.m. bakery and Ch6's
 * nights (their other scenes, the workshop and the flat, use LOOKS.workshop / LOOKS.flat). scene2 sets its
 * own weather for these variants (wet 0.4 by day, 1 at night), so `wet` / `grime` here only reach the props
 * and the boot. Night keeps the sodium cones. The matching mood presets are scene2.js STREET_MOODS.
 */
export const STREET_LOOKS = {
  day: { ...LOOKS.wall, key: 'day', wet: 0.4, grime: 0.9, kenney: { grime: 0.6, desat: 0.15, wet: 0.3 }, cones: false, hdris: ['dawn_fog', 'golden_street'] },
  night: { ...LOOKS.evening, key: 'night', wet: 1, grime: 1, cones: true, hdris: ['night_street'] },
};
Object.assign(LOOKS, STREET_LOOKS);

/**
 * Chapter looks, by chapter index (0 = Ch1; Revision 4 order, docs/SCRIPT-R4.md §0.3): the look of the
 * chapter's own build. A chapter may name another with `look: 'workshop'` (Ch5 and Ch6 open in the
 * workshop); mid-chapter scene swaps (Director.scene) name theirs in the set (story/sets.js).
 */
export const CHAPTER_LOOKS = [LOOKS.flat, LOOKS.evening, LOOKS.dawnrun, LOOKS.workshop, STREET_LOOKS.day, STREET_LOOKS.day, LOOKS.wall];

/** A look from a chapter index, a LOOKS name or a look object (null if unknown). */
export function resolveLook(ref) {
  if (ref && typeof ref === 'object') return ref;
  if (typeof ref === 'number') return CHAPTER_LOOKS[ref] || null;
  if (typeof ref === 'string') return LOOKS[ref] || null;
  return null;
}

/** The shared look. main.js binds the Materials instance and switches chapters. */
export const look = {
  materials: null,
  chapter: null,
  index: -1,

  bind(materials) {
    this.materials = materials;
    return this;
  },

  /** Activate a look before a scene builds (main.js): a chapter index, a LOOKS name or a look object. */
  begin(ref) {
    this.index = typeof ref === 'number' ? ref : this.index;
    this.chapter = resolveLook(ref);
    return this.chapter;
  },

  /** The recipe for a surface name (undefined if unknown). */
  recipe(name) {
    return SURFACES[name];
  },

  /** Material ids a look uses (chapter index, LOOKS name or look object; default: the active look). */
  materialIds(ref) {
    const c = ref === undefined ? this.chapter : resolveLook(ref);
    if (!c) return [];
    const ids = [c.ground, c.slab, c.facade, c.walls].map((n) => SURFACES[n]?.id).filter(Boolean);
    return [...new Set([...ids, ...(c.materials || [])])];
  },

  /** Weather for a recipe in the active chapter, with call overrides winning. */
  weather(r, opts = {}) {
    const c = this.chapter || { wet: 0, grime: 0.7 };
    return {
      wet: opts.wet ?? (r.wet ?? 1) * (c.wet ?? 0),
      grime: opts.grime ?? (r.grime ?? 1) * (c.grime ?? 0.7),
    };
  },

  /**
   * A cached material for a named surface. opts override the recipe and the chapter weather:
   * { mapping='world', scale, tint, level, roughness, normalScale, grime, wet, groundY, worldSize, repeat, ... }
   * (see Materials.get). Without a bound Materials instance (or for an unknown name) it returns a
   * plain flat-colour MeshStandardMaterial.
   */
  surface(name, opts = {}) {
    const r = SURFACES[name];
    if (!r) console.warn('[hairline] unknown look surface:', name);
    const rec = r || { id: '', color: '#888888' };
    const { id, wet: _w, grime: _g, ...base } = rec;
    const w = this.weather(rec, opts);
    const o = { mapping: 'world', ...base, ...opts, ...w };
    if (!this.materials || !r) return flat(o.color);
    return this.materials.get(id, o);
  },

  /**
   * Layer a named surface's detail over an existing material (keeps its map and roughness; see
   * Materials.enhance). Used by build.js to upgrade the scenes' own grime canvases.
   */
  enhance(material, name, opts = {}) {
    const r = SURFACES[name];
    if (!r || !this.materials || !material?.isMeshStandardMaterial || material.userData.hlLook) return material;
    material.userData.hlLook = name;
    const w = this.weather(r, opts);
    return this.materials.enhance(material, r.id, { scale: r.scale ?? 1, level: r.level, ...opts, ...w });
  },
};

const _flat = new Map();
function flat(color) {
  let m = _flat.get(color);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    m.userData.shared = true;
    _flat.set(color, m);
  }
  return m;
}
