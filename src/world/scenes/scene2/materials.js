import * as THREE from 'three';

// Materials for every Batch key the street uses. Big surfaces are look.js recipes (shared with Ch5
// through the chapter weather); the small painted / iron / glass pieces are local materials, given
// the same world-space weathering through ctx.materials.weather so they sit in the same world.

/**
 * opts: { evening (dark: night glass), env (equirect texture for glass), windowTex, decalTex, posterTex,
 *         weather: { wet, ground, grime } (R4 variants: the street's own weather instead of the chapter's;
 *         ground = the street surfaces' wetness, default wet) }
 * Returns { [key]: { material, opts } } for Batch.material(key, material, opts).
 */
export function streetMaterials(ctx, { evening, env, windowTex, decalTex, posterTex, weather: sky = null }) {
  const look = ctx.look;
  const wet = sky?.wet ?? look?.chapter?.wet ?? (evening ? 1 : 0.25);
  // With a variant weather, each recipe's own wet / grime multipliers scale it (as look.weather does).
  const vw = (name) => {
    if (!sky || !look) return {};
    const r = look.recipe(name) || {};
    const w = name.startsWith('street.') ? sky.ground ?? sky.wet : sky.wet; // the ground can hold puddles longer
    return { wet: (r.wet ?? 1) * w, grime: (r.grime ?? 1) * (sky.grime ?? look.chapter?.grime ?? 0.8) };
  };
  const S = (name, o = {}) => (look ? look.surface(name, { ...vw(name), ...o }) : new THREE.MeshStandardMaterial({ color: '#8a8580', roughness: 0.9 }));
  const weather = (m, o) => (ctx.materials ? ctx.materials.weather(m, o) : m);
  const detail = { noOcclude: true };
  const flatOnly = { noOcclude: true, castShadow: false };

  const casement = weather(new THREE.MeshStandardMaterial({ color: '#3d3c38', roughness: 0.62, metalness: 0 }), { grime: 0.5, wet: wet * 0.5 });
  const iron = weather(new THREE.MeshStandardMaterial({ color: '#2c2e2d', roughness: 0.45, metalness: 0.5 }), { grime: 0.4, wet: wet * 0.6 });
  const cable = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.45, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: evening ? '#1a1f25' : '#39404a',
    roughness: evening ? 0.06 : 0.12,
    metalness: 0.1,
    envMap: env,
    envMapIntensity: evening ? 1.1 : 0.75,
  });
  const winLit = new THREE.MeshBasicMaterial({ map: windowTex, vertexColors: true });
  const lampGlass = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lampGlassFlicker = new THREE.MeshBasicMaterial({ vertexColors: true });
  const decal = new THREE.MeshStandardMaterial({
    map: decalTex,
    transparent: true,
    depthWrite: false,
    roughness: evening ? 0.46 : 0.75,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const poster = new THREE.MeshStandardMaterial({
    map: posterTex,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    roughness: evening ? 0.48 : 0.86,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const underlay = new THREE.MeshStandardMaterial({ color: '#27292a', roughness: 1 });
  const roomCeil = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 1 });

  return {
    // Facade masses (the camera rig's occluders: boxes only, cheap to raycast).
    brick: { material: S('facade.brick') },
    brickPlaster: { material: S('facade.brickPlaster') },
    render: { material: S('facade.render') },
    painted: { material: S('facade.brickPainted') },
    // Facade detail.
    trim: { material: S('concrete.grimy', { scale: 0.6 }), opts: detail },
    roller: { material: S('shutter.rust', { vertexColors: true }), opts: detail },
    persienne: { material: S('shutter.rust', { vertexColors: true, scale: 0.28, level: 0.22 }), opts: detail },
    door: { material: S('workshop.paintedWood', { vertexColors: true, scale: 0.6, wet: wet * 0.5, grime: 0.8 }), opts: detail },
    casement: { material: casement, opts: detail },
    glass: { material: glass, opts: flatOnly },
    winLit: { material: winLit, opts: flatOnly },
    iron: { material: iron, opts: detail },
    pipe: { material: S('metal.green'), opts: detail },
    steel: { material: S('metal.rust', { scale: 0.35 }), opts: detail },
    timber: { material: S('workshop.timber', { wet: wet * 0.8, grime: 0.7 }), opts: detail },
    corrugated: { material: S('metal.corrugated'), opts: detail },
    cable: { material: cable, opts: flatOnly },
    lampGlass: { material: lampGlass, opts: flatOnly },
    lampGlassFlicker: { material: lampGlassFlicker, opts: flatOnly },
    // Ground.
    asphalt: { material: S('street.asphalt'), opts: { castShadow: false } },
    cobbles: { material: S('street.cobbles'), opts: { castShadow: false } },
    kerb: { material: S('street.kerb'), opts: { castShadow: false } },
    pavement: { material: S('street.pavement'), opts: { castShadow: false } },
    underlay: { material: underlay, opts: flatOnly },
    decal: { material: decal, opts: { ...flatOnly, renderOrder: 1 } },
    poster: { material: poster, opts: { ...flatOnly, renderOrder: 1 } },
    // R4 rooms (scene2/rooms.js): the insides of ENCRE FINE and CYCLES DURAND.
    roomPlaster: { material: S('interior.plaster', { wet: 0 }), opts: { castShadow: false } },
    roomBoards: { material: S('interior.floorboards', { wet: 0 }), opts: { castShadow: false } },
    roomConcrete: { material: S('workshop.concrete', { wet: 0, grime: 1 }), opts: { castShadow: false } },
    roomCeil: { material: roomCeil, opts: { castShadow: false } },
  };
}
