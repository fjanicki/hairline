import * as THREE from 'three';

// The workshop's material set: timber and concrete with whitewashed brick, a painted dado and worn
// steel, all from the shared look recipes (world-mapped PBR, so merged meshes need no UV work).
// look.surface()/materials.get() results are cached and shared, so they are never mutated here; the
// street under the garage door is an owned material because its wetness changes over the weeks.
// Without the texture files every entry falls back to its flat colour.

export function makeSurfaces(ctx) {
  const look = ctx.look;
  const M = ctx.materials;
  const S = (name, opts = {}) => (look ? look.surface(name, opts) : new THREE.MeshStandardMaterial({ color: opts.color ?? '#8a8478', roughness: 0.9 }));
  const G = (id, opts, fallback) =>
    M ? M.get(id, { mapping: 'world', ...opts }) : new THREE.MeshStandardMaterial({ color: fallback, roughness: opts.roughness ? 0.6 : 0.9 });

  const s = {
    // Walls: whitewashed brick above, oil-painted brick dado below (vertex colours mark the cut caps).
    // Whitewash gone the colour of old tea: warmer and darker than the shared recipe.
    brick: G('brick_whitewashed', { tint: '#e0cfb4', level: 0.19, grime: 0.95, vertexColors: true }, '#8a8070'),
    dado: G('brick_whitewashed', { tint: '#7f9282', level: 0.075, roughness: 0.6, grime: 0.9, vertexColors: true }, '#56625a'),
    capDark: new THREE.MeshStandardMaterial({ color: '#211d19', roughness: 1 }),
    // Wood: weathered planks for the benches and trestles, a darker oiled version for tops and frames.
    timber: S('workshop.timber'),
    timberDark: G('wood_planks_weathered', { tint: '#a08a70', level: 0.075, roughness: 0.85, grime: 0.5 }, '#4e4236'),
    benchTop: G('wood_planks_weathered', { tint: '#b49a7a', level: 0.11, roughness: 0.9, grime: 0.55, scale: 0.7 }, '#6a5a48'),
    plywood: S('workshop.plywood'),
    paintedWood: S('workshop.paintedWood'),
    trim: G('wood_planks_painted', { tint: '#8f9a8c', level: 0.12, grime: 0.6, scale: 0.6 }, '#6c746a'),
    // Metal.
    steel: S('workshop.steel'),
    steelPainted: G('metal_painted_green', { tint: '#9aa3a0', level: 0.06, roughness: 0.9, grime: 0.4 }, '#33403a'),
    rust: S('metal.rust'),
    shutter: S('shutter.rust', { side: THREE.DoubleSide }),
    corrugated: S('metal.corrugated'),
    // Outside and the stairwell.
    facade: S('facade.brickPlaster'),
    render: S('facade.render'),
    kerb: S('street.kerb', { wet: 0.6 }),
    stairWall: S('interior.plaster', { side: THREE.BackSide, tint: '#8f8678' }),
    stairStep: G('wood_planks_weathered', { level: 0.07, grime: 0.6 }, '#4a4036'),
  };

  // Plain helpers that sit next to the PBR surfaces.
  s.black = new THREE.MeshStandardMaterial({ color: '#1b1a19', roughness: 0.55, metalness: 0.1 });
  s.rubber = new THREE.MeshStandardMaterial({ color: '#1d1c1b', roughness: 0.92 });
  s.chrome = new THREE.MeshStandardMaterial({ color: '#a7a9ab', roughness: 0.32, metalness: 0.9 });
  s.brass = new THREE.MeshStandardMaterial({ color: '#8f7a4e', roughness: 0.45, metalness: 0.85 });
  s.cord = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.7 });
  s.cloth = new THREE.MeshStandardMaterial({ color: '#a69a84', roughness: 1 });
  s.paper = new THREE.MeshStandardMaterial({ color: '#cfc6b0', roughness: 0.95 });
  if (M) {
    M.weather(s.cloth, { grime: 0.6 });
    M.weather(s.paper, { grime: 0.5 });
  }

  // The wet cobbles under the garage door: owned, so the rain can stop between the weeks.
  s.street = new THREE.MeshStandardMaterial({ color: '#5a5a5c', roughness: 0.9, metalness: 0 });
  if (M) M.enhance(s.street, 'street_cobbles', { albedo: 1, wet: 1, grime: 0.8, level: 0.08 });
  s.pavement = new THREE.MeshStandardMaterial({ color: '#7a7974', roughness: 0.9 });
  if (M) M.enhance(s.pavement, 'street_pavement', { albedo: 1, wet: 1, grime: 0.9, level: 0.15 });
  /** Day 5 rain (1) to the dry weeks (0.25): puddles and the darker wet albedo. */
  s.setWet = (k) => {
    if (!M) return;
    M.setWeather(s.street, { wet: k });
    M.setWeather(s.pavement, { wet: k });
  };
  // Owned materials are disposed with the chapter; shared ones are skipped by disposeGroup.
  return s;
}
