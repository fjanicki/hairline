import * as THREE from 'three';

// PBR material library (ctx.materials). Reads public/assets/materials/materials.json (written by
// scripts/assets/materials.sh; see docs/assets/materials.md) and serves cached MeshStandardMaterials.
//
// Every material is <id>/{color (sRGB), normal (OpenGL), arm (R = AO, G = roughness, B = metalness)}.jpg,
// with a real-world tile size in metres in the manifest. Two ways to map them:
//   'uv'    - the stock three.js slots (map, normalMap, aoMap/roughnessMap/metalnessMap = arm), repeat
//             = worldSize / tile. For planes and meshes whose UVs span the surface once.
//   'world' - box projection in world space, picked per pixel from the world normal (floors use XZ,
//             walls XY or ZY), with analytic gradients so face edges have no mip seam. Scale stays
//             consistent on any box, wall or merged mesh without UV work.
// On top, two weathering layers driven by world position (shared grime masks, one set for all):
//   grime   - macro albedo breakup against tiling, a splash-back dirt band at the foot of walls,
//             rain/rust leaks under every storey line (3.2 m), vertical smudges, floor blotches
//   wet     - darker albedo and lower roughness, puddles (grime/puddles.png, flat mirror-ish water
//             with the normal map flattened), a wet splash band at the foot of walls
// Missing textures or manifest: materials stay on their flat fallback colour; nothing throws.

const BASE = `${import.meta.env.BASE_URL || '/'}assets/materials/`;
const LUMA = new THREE.Vector3(0.2126, 0.7152, 0.0722);

// ------------------------------------------------------------------ shader patch

const VERT_PARS = /* glsl */ `
varying vec3 vHlW;
varying vec3 vHlN;`;

const VERT_MAIN = /* glsl */ `
{
  vec4 hlP = vec4( transformed, 1.0 );
  vec3 hlNo = objectNormal;
  #ifdef USE_BATCHING
    hlP = batchingMatrix * hlP;
    hlNo = mat3( batchingMatrix ) * hlNo;
  #endif
  #ifdef USE_INSTANCING
    hlP = instanceMatrix * hlP;
    hlNo = mat3( instanceMatrix ) * hlNo;
  #endif
  hlP = modelMatrix * hlP;
  vHlW = hlP.xyz;
  vHlN = normalize( mat3( modelMatrix ) * hlNo );
}`;

const FRAG_PARS = /* glsl */ `
varying vec3 vHlW;
varying vec3 vHlN;
uniform float hlGrime, hlWet, hlDesat, hlGroundY, hlPuddleTile;
uniform sampler2D hlMacro, hlStreaks, hlLeaks, hlEdge, hlPuddles;
#ifdef HL_DETAIL
  uniform sampler2D hlColorMap, hlNormalMap, hlArmMap;
  uniform vec2 hlTileInv;
  uniform vec3 hlColorScale;
  uniform float hlAlbedoMix, hlNormalScale, hlAO, hlRoughScale, hlRoughMix;
#endif`;

// Before <map_fragment>: box projection, detail samples, weathering masks.
const FRAG_PROJECT = /* glsl */ `
vec3 hlNw = normalize( vHlN );
vec3 hlA = abs( hlNw );
vec3 hlDx = dFdx( vHlW );
vec3 hlDy = dFdy( vHlW );
vec2 hlUV, hlGx, hlGy;
vec3 hlT, hlB;
if ( hlA.y >= hlA.x && hlA.y >= hlA.z ) {
  float s = hlNw.y < 0.0 ? -1.0 : 1.0;
  hlUV = vec2( vHlW.x, -s * vHlW.z ); hlGx = vec2( hlDx.x, -s * hlDx.z ); hlGy = vec2( hlDy.x, -s * hlDy.z );
  hlT = vec3( 1.0, 0.0, 0.0 ); hlB = vec3( 0.0, 0.0, -s );
} else if ( hlA.x >= hlA.z ) {
  float s = hlNw.x < 0.0 ? -1.0 : 1.0;
  hlUV = vec2( -s * vHlW.z, vHlW.y ); hlGx = vec2( -s * hlDx.z, hlDx.y ); hlGy = vec2( -s * hlDy.z, hlDy.y );
  hlT = vec3( 0.0, 0.0, -s ); hlB = vec3( 0.0, 1.0, 0.0 );
} else {
  float s = hlNw.z < 0.0 ? -1.0 : 1.0;
  hlUV = vec2( s * vHlW.x, vHlW.y ); hlGx = vec2( s * hlDx.x, hlDx.y ); hlGy = vec2( s * hlDy.x, hlDy.y );
  hlT = vec3( s, 0.0, 0.0 ); hlB = vec3( 0.0, 1.0, 0.0 );
}
float hlVert = 1.0 - smoothstep( 0.35, 0.75, hlA.y );
float hlFloor = smoothstep( 0.6, 0.9, hlNw.y );
float hlHY = vHlW.y - hlGroundY;
float hlDirt = 0.0;
float hlWetK = 0.0;
float hlPuddle = 0.0;
#ifdef HL_DETAIL
  vec2 hlD = hlUV * hlTileInv;
  vec2 hlDgx = hlGx * hlTileInv;
  vec2 hlDgy = hlGy * hlTileInv;
  vec3 hlCol = textureGrad( hlColorMap, hlD, hlDgx, hlDgy ).rgb;
  vec4 hlArm = textureGrad( hlArmMap, hlD, hlDgx, hlDgy );
#endif
#ifdef HL_WET
{
  float p = textureGrad( hlPuddles, vHlW.xz / hlPuddleTile, hlDx.xz / hlPuddleTile, hlDy.xz / hlPuddleTile ).r;
  hlPuddle = smoothstep( 0.38, 0.95, p ) * hlFloor * hlWet;
  float damp = smoothstep( 0.18, 0.4, p );
  float splash = 1.0 - smoothstep( 0.0, 0.7, hlHY );
  hlWetK = hlWet * max( hlFloor * ( 0.7 + 0.3 * damp ), hlVert * ( 0.3 + 0.7 * splash ) );
}
#endif`;

// After <map_fragment>: albedo layers.
const FRAG_ALBEDO = /* glsl */ `
#ifdef HL_DETAIL
  diffuseColor.rgb *= mix( vec3( 1.0 ), hlCol * hlColorScale, hlAlbedoMix );
#endif
#ifdef HL_DESAT
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), hlDesat );
#endif
#ifdef HL_GRIME
{
  float m1 = textureGrad( hlMacro, hlUV / 13.0, hlGx / 13.0, hlGy / 13.0 ).r;
  float m2 = textureGrad( hlMacro, hlUV / 4.3 + 0.37, hlGx / 4.3, hlGy / 4.3 ).r;
  diffuseColor.rgb *= mix( 1.0, 0.78 + 0.44 * m1, hlGrime );
  float edge = 0.0;
  if ( hlHY > -0.05 && hlHY < 1.15 ) edge = textureGrad( hlEdge, vec2( hlUV.x / 3.1, clamp( hlHY / 1.1, 0.0, 1.0 ) ), vec2( hlGx.x / 3.1, hlDx.y / 1.1 ), vec2( hlGy.x / 3.1, hlDy.y / 1.1 ) ).r;
  float leak = textureGrad( hlLeaks, vec2( hlUV.x / 4.6 + floor( hlHY / 3.2 ) * 0.31, fract( hlHY / 3.2 ) ), vec2( hlGx.x / 4.6, hlDx.y / 3.2 ), vec2( hlGy.x / 4.6, hlDy.y / 3.2 ) ).r;
  float streak = textureGrad( hlStreaks, hlUV / 1.7, hlGx / 1.7, hlGy / 1.7 ).r;
  float d = hlVert * ( 0.6 * edge + 0.42 * leak * smoothstep( 0.4, 1.2, hlHY ) + 0.16 * streak );
  d += hlFloor * 0.3 * smoothstep( 0.55, 0.8, m2 );
  hlDirt = clamp( hlGrime * d, 0.0, 0.75 );
  diffuseColor.rgb *= 1.0 - hlDirt;
  diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.93, 0.88, 0.8 ), hlDirt );
}
#endif
#ifdef HL_WET
  diffuseColor.rgb *= mix( 1.0, 0.72, hlWetK ) * mix( 1.0, 0.72, hlPuddle );
#endif`;

const FRAG_ROUGH = /* glsl */ `
#ifdef HL_DETAIL
  roughnessFactor *= mix( 1.0, hlArm.g * hlRoughScale, hlRoughMix );
#endif
roughnessFactor = clamp( roughnessFactor + 0.15 * hlDirt, 0.03, 1.0 );
#ifdef HL_WET
  roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.42, hlWetK );
  roughnessFactor = mix( roughnessFactor, 0.12, hlPuddle );
#endif`;

const FRAG_METAL = /* glsl */ `
#if defined( HL_DETAIL ) && defined( HL_METAL )
  metalnessFactor *= hlArm.b;
#endif`;

const FRAG_NORMAL = /* glsl */ `
vec3 hlGeoN = normal;
#ifdef HL_DETAIL
{
  vec3 hlNm = textureGrad( hlNormalMap, hlD, hlDgx, hlDgy ).xyz * 2.0 - 1.0;
  hlNm.xy *= hlNormalScale;
  vec3 Tv = normalize( ( viewMatrix * vec4( hlT, 0.0 ) ).xyz );
  vec3 Bv = normalize( ( viewMatrix * vec4( hlB, 0.0 ) ).xyz );
  Tv = normalize( Tv - normal * dot( normal, Tv ) );
  Bv = normalize( Bv - normal * dot( normal, Bv ) - Tv * dot( Tv, Bv ) );
  normal = normalize( mat3( Tv, Bv, normal ) * hlNm );
}
#else
  #include <normal_fragment_maps>
#endif
#ifdef HL_WET
  normal = normalize( mix( normal, hlGeoN, hlPuddle ) );
#endif`;

const FRAG_AO = /* glsl */ `
#ifdef HL_DETAIL
{
  float ambientOcclusion = mix( 1.0, hlArm.r, hlAO );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
}
#else
  #include <aomap_fragment>
#endif`;

function onBeforeCompile(shader) {
  const u = this.userData.hlUniforms;
  if (u) Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>' + VERT_PARS)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + VERT_MAIN);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + FRAG_PARS)
    .replace('#include <map_fragment>', FRAG_PROJECT + '\n#include <map_fragment>' + FRAG_ALBEDO)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + FRAG_ROUGH)
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>' + FRAG_METAL)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
    .replace('#include <aomap_fragment>', FRAG_AO);
}

/** 1x1 linear data texture (fallback for a mask that has not loaded: neutral = no effect). */
function pixel(v) {
  const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

// Shared weathering masks: one uniform object per mask, assigned into every patched material, so
// swapping the texture once (when it loads) updates them all.
const GRIME_U = {
  hlMacro: { value: pixel(128) },
  hlStreaks: { value: pixel(0) },
  hlLeaks: { value: pixel(0) },
  hlEdge: { value: pixel(0) },
  hlPuddles: { value: pixel(0) },
};
const GRIME_FILES = {
  hlMacro: ['grime/macro.png', THREE.RepeatWrapping, THREE.RepeatWrapping],
  hlStreaks: ['grime/streaks.jpg', THREE.RepeatWrapping, THREE.RepeatWrapping],
  hlLeaks: ['grime/leaks.jpg', THREE.RepeatWrapping, THREE.RepeatWrapping],
  hlEdge: ['grime/edge_dirt.jpg', THREE.RepeatWrapping, THREE.ClampToEdgeWrapping],
  hlPuddles: ['grime/puddles.png', THREE.RepeatWrapping, THREE.RepeatWrapping],
};

/** Mean linear RGB of an image (16x16 downsample), for normalising detail albedo / roughness. */
function meanColor(image, srgb) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(image, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    const out = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < d.length; i += 4) {
      if (srgb) col.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
      else col.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.LinearSRGBColorSpace);
      out.x += col.r;
      out.y += col.g;
      out.z += col.b;
    }
    return out.multiplyScalar(1 / 256);
  } catch {
    return srgb ? new THREE.Vector3(0.2, 0.2, 0.2) : new THREE.Vector3(1, 0.7, 0);
  }
}

/** A half-size canvas copy of an image (low tier). Falls back to the image itself. */
export function halve(image) {
  try {
    const w = Math.max(1, image.width >> 1);
    const h = Math.max(1, image.height >> 1);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, w, h);
    return c;
  } catch {
    return image;
  }
}

const sizeOf = (v) => (Array.isArray(v) ? [v[0], v[1] ?? v[0]] : [v, v]);

export class Materials {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{anisotropy?: number}} opts
   */
  constructor(renderer, { anisotropy = 8, halfRes = false } = {}) {
    this.renderer = renderer;
    this.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
    // Low tier: every set map is halved on load (1k -> 512, 2k -> 1k), a quarter of the GPU memory.
    // Decided at boot; a live tier switch keeps what is loaded.
    this.halfRes = halfRes;
    this.loader = new THREE.TextureLoader();
    /** id -> { source, tile:[w,h], ... } from materials.json ({} if it failed). */
    this.manifest = {};
    this._sets = new Map(); // id -> { color, normal, arm, ok, promise, colorAvg, armAvg }
    this._clones = new Map(); // id|map|ru|rv -> repeated clone (shares the GPU texture)
    this._cache = new Map(); // get() key -> material
    this._patched = 0; // materials patched so far (stats)
    this.ready = null;
  }

  /** Load the manifest and the shared grime masks. Never rejects. */
  init() {
    if (this.ready) return this.ready;
    const manifest = fetch(`${BASE}materials.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((j) => (this.manifest = j || {}))
      .catch((err) => console.warn('[hairline] materials.json missing, surfaces use flat colours:', err?.message || err));
    const masks = Object.entries(GRIME_FILES).map(([k, [file, ws, wt]]) =>
      this._load(file, false)
        .then((t) => {
          t.wrapS = ws;
          t.wrapT = wt;
          t.anisotropy = this.anisotropy;
          GRIME_U[k].value = t;
        })
        .catch(() => console.warn('[hairline] grime mask missing (no effect):', file)),
    );
    this.ready = Promise.all([manifest, ...masks]).then(() => this);
    return this.ready;
  }

  /** True if id is in the manifest. */
  has(id) {
    return !!this.manifest[id];
  }

  /** Real-world tile size [w, h] in metres (2 m when unknown). */
  tile(id) {
    const t = this.manifest[id]?.tile;
    return t ? [t[0], t[1] ?? t[0]] : [2, 2];
  }

  _load(file, srgb) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        BASE + file,
        (t) => {
          if (this.halfRes && !file.startsWith('grime/')) t.image = halve(t.image);
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = this.anisotropy;
          t.userData.shared = true;
          resolve(t);
        },
        undefined,
        reject,
      );
    });
  }

  /** The texture set for id: loads once. set.ok is false if any map failed. */
  _set(id, upload = true) {
    let s = this._sets.get(id);
    if (s) {
      if (upload) s.wantUpload = true; // a chapter now needs a set a prefetch started
      if (upload && s.ok && !s.resident) {
        // Prefetched, or evicted by retain(): upload now (the images are in memory).
        for (const t of [s.color, s.normal, s.arm]) this.renderer.initTexture(t);
        s.resident = true;
      }
      return s;
    }
    s = { ok: false, failed: false, wantUpload: upload };
    this._sets.set(id, s);
    if (!this.has(id)) {
      s.failed = true;
      s.promise = Promise.resolve(s);
      if (Object.keys(this.manifest).length) console.warn('[hairline] unknown material id:', id);
      return s;
    }
    s.promise = Promise.all([this._load(`${id}/color.jpg`, true), this._load(`${id}/normal.jpg`, false), this._load(`${id}/arm.jpg`, false)])
      .then(([color, normal, arm]) => {
        Object.assign(s, { color, normal, arm, ok: true, resident: false });
        s.colorAvg = meanColor(color.image, true);
        s.armAvg = meanColor(arm.image, false);
        // Upload now (chapter builds run behind the fade), not on the first visible frame. A
        // background prefetch only downloads; the chapter's preload() uploads.
        if (s.wantUpload) {
          for (const t of [color, normal, arm]) this.renderer.initTexture(t);
          s.resident = true;
        }
        return s;
      })
      .catch((err) => {
        s.failed = true;
        console.warn('[hairline] material textures missing, flat colour fallback:', id, err?.message || err?.type || '');
        return s;
      });
    return s;
  }

  /**
   * Load the textures for ids (and upload them). Resolves when done, or after `timeout` ms anyway
   * (a slow network never blocks a chapter; late materials pop in).
   */
  preload(ids, { timeout = 8000, upload = true } = {}) {
    const all = Promise.all(
      [...new Set(ids)]
        .filter((id) => this.has(id))
        .map((id) => this._set(id, upload).promise),
    );
    return Promise.race([all, new Promise((r) => setTimeout(r, timeout))]);
  }

  /**
   * The decoded image of one map of a set ('color' | 'normal' | 'arm'), for canvas work (Ch4's door
   * takes the plywood grain). Loads the set without uploading it. Resolves null when unavailable.
   */
  image(id, map = 'color') {
    if (!this.has(id)) return Promise.resolve(null);
    const s = this._set(id, false);
    return s.promise.then((set) => (set.ok ? set[map]?.image ?? null : null));
  }

  /**
   * Free the GPU copies of every loaded set not in `keep` (main.js: the current and the next
   * chapter's ids). The textures, images and cached materials stay: a set that is needed again is
   * uploaded by preload(), or by the renderer on first use. Returns the number of sets evicted.
   */
  retain(keep) {
    const k = new Set(keep);
    let n = 0;
    for (const [id, s] of this._sets) {
      if (k.has(id) || !s.ok || !s.resident) continue;
      for (const t of [s.color, s.normal, s.arm]) t.dispose();
      for (const [key, t] of this._clones) if (key.startsWith(id + '|')) t.dispose();
      s.resident = false;
      n++;
    }
    return n;
  }

  _repeated(set, id, map, ru, rv) {
    const key = `${id}|${map}|${ru.toFixed(3)}|${rv.toFixed(3)}`;
    let t = this._clones.get(key);
    if (!t) {
      t = set[map].clone();
      t.repeat.set(ru, rv);
      t.userData.shared = true;
      this._clones.set(key, t);
    }
    return t;
  }

  /**
   * A cached PBR MeshStandardMaterial. Same id + opts = same material (marked userData.shared, so
   * chapter disposal leaves it alone). opts:
   *   mapping='uv'      'uv' (stock slots, repeat from worldSize / repeat) or 'world' (box projection)
   *   worldSize         [w, h] or number: surface size in metres -> repeat = size / tile ('uv')
   *   repeat            [u, v] explicit repeat ('uv'; wins over worldSize)
   *   scale=1           tile size multiplier ('world'; 2 = features twice as big)
   *   tint='#ffffff'    multiplies the albedo (pull a material towards the chapter palette)
   *   level             target mean albedo (linear luminance, e.g. 0.18); the tint is scaled to hit it
   *   roughness=1, metalness=1   multipliers on the ARM channels
   *   normalScale=1, aoIntensity=1
   *   grime=0 (0..1), wet=0 (0..1), groundY=0 (world y of the ground, for the wall bands),
   *   puddleTile=6 (m per puddle-mask tile)
   *   color             fallback flat colour while loading / if textures are missing (default: tint x mean)
   *   side, transparent, opacity, polygonOffset... any other MeshStandardMaterial parameter
   */
  get(id, opts = {}) {
    const key = id + '|' + JSON.stringify(opts);
    let m = this._cache.get(key);
    if (m) return m;
    const {
      mapping = 'uv',
      worldSize,
      repeat,
      scale = 1,
      tint = '#ffffff',
      level,
      roughness = 1,
      metalness = 1,
      normalScale = 1,
      aoIntensity = 1,
      grime = 0,
      wet = 0,
      groundY = 0,
      puddleTile = 6,
      color,
      ...params
    } = opts;
    m = new THREE.MeshStandardMaterial({ color: color ?? '#86837c', roughness: 0.85, metalness: 0, ...params });
    m.name = `hl:${id}`;
    m.userData.shared = true;
    m.userData.materialId = id;
    this._cache.set(key, m);
    if (grime || wet) this._patch(m, { grime, wet, groundY, puddleTile });

    const set = this._set(id);
    const apply = () => {
      if (!set.ok) return;
      m.color.set(tint);
      // level: normalise the texture's mean albedo (linear luminance) so every surface sits in the
      // value band the grade was tuned for.
      if (level) m.color.multiplyScalar(level / Math.max(1e-3, set.colorAvg.dot(LUMA)));
      m.roughness = roughness;
      m.metalness = metalness;
      if (mapping === 'world') {
        const [tw, th] = this.tile(id);
        this._patch(m, {
          grime,
          wet,
          groundY,
          puddleTile,
          detail: { set, tileInv: [1 / (tw * scale), 1 / (th * scale)], albedo: 1, colorScale: [1, 1, 1], roughScale: 1, roughMix: 1, normalScale, ao: aoIntensity, metal: true },
        });
      } else {
        const [tw, th] = this.tile(id);
        let ru = 1;
        let rv = 1;
        if (repeat) [ru, rv] = sizeOf(repeat);
        else if (worldSize !== undefined) {
          const [sw, sh] = sizeOf(worldSize);
          ru = sw / tw;
          rv = sh / th;
        }
        m.map = this._repeated(set, id, 'color', ru, rv);
        m.normalMap = this._repeated(set, id, 'normal', ru, rv);
        const arm = this._repeated(set, id, 'arm', ru, rv);
        m.aoMap = arm;
        m.roughnessMap = arm;
        m.metalnessMap = arm;
        m.aoMapIntensity = aoIntensity;
        m.normalScale.set(normalScale, normalScale);
      }
      m.needsUpdate = true;
    };
    if (set.ok) apply();
    else {
      // Fallback colour until the maps arrive: the tint, at roughly the texture's brightness.
      if (color === undefined) m.color.set(tint).multiplyScalar(0.5);
      set.promise.then(apply);
    }
    return m;
  }

  /**
   * Layer a material's detail onto an EXISTING material (keeps its own map, e.g. a grimeTexture
   * canvas, and its roughness): world-projected normal + AO, roughness variation around the
   * material's own value, and the albedo multiplied by the detail colour normalised to its mean (so
   * the overall value does not change). Patches in place and returns the material. opts:
   *   albedo=1 (0..1, how much of the detail colour), normalScale=1, ao=1, scale=1 (tile multiplier),
   *   roughnessVar=1 (0 = keep flat roughness), grime=0, wet=0, groundY=0, puddleTile=6,
   *   level (target mean albedo, linear): a surface brighter than 1.25 x level is pulled down to it
   *   (a white canvas sidewalk would otherwise glare next to PBR asphalt); darker ones are kept
   */
  enhance(material, id, opts = {}) {
    if (!material?.isMeshStandardMaterial) return material;
    const { albedo = 1, normalScale = 1, ao = 1, scale = 1, roughnessVar = 1, grime = 0, wet = 0, groundY = 0, puddleTile = 6, level } = opts;
    if (level) {
      const mm = material.map?.image ? meanColor(material.map.image, material.map.colorSpace === THREE.SRGBColorSpace) : new THREE.Vector3(1, 1, 1);
      const c = material.color;
      const lum = c.r * mm.x * LUMA.x + c.g * mm.y * LUMA.y + c.b * mm.z * LUMA.z;
      const hi = level * 1.25;
      if (lum > hi) c.multiplyScalar(hi / lum);
    }
    material.userData.materialId = id;
    if (grime || wet) this._patch(material, { grime, wet, groundY, puddleTile });
    const set = this._set(id);
    const apply = () => {
      if (!set.ok) return;
      const [tw, th] = this.tile(id);
      const ca = set.colorAvg;
      const lum = Math.max(1e-3, ca.dot(LUMA));
      // Normalise by the mean luminance with a little of the hue kept (brick stays brick-ish).
      const cs = [0.35 / Math.max(ca.x, 1e-3) + 0.65 / lum, 0.35 / Math.max(ca.y, 1e-3) + 0.65 / lum, 0.35 / Math.max(ca.z, 1e-3) + 0.65 / lum];
      this._patch(material, {
        grime,
        wet,
        groundY,
        puddleTile,
        detail: { set, tileInv: [1 / (tw * scale), 1 / (th * scale)], albedo, colorScale: cs, roughScale: 1 / Math.max(0.05, set.armAvg.y), roughMix: roughnessVar, normalScale, ao, metal: false },
      });
      material.needsUpdate = true;
    };
    if (set.ok) apply();
    else set.promise.then(apply);
    return material;
  }

  /** Grime / wet / desaturation only (no detail maps) on any MeshStandardMaterial. Patches in place. */
  weather(material, { grime = 0, wet = 0, desat = 0, groundY = 0, puddleTile = 6 } = {}) {
    if (!material?.isMeshStandardMaterial) return material;
    this._patch(material, { grime, wet, desat, groundY, puddleTile });
    material.needsUpdate = true;
    return material;
  }

  /** Change grime / wet live on a patched material (e.g. Ch5 puddles drying). */
  setWeather(material, { grime, wet } = {}) {
    const u = material?.userData?.hlUniforms;
    if (!u) return this.weather(material, { grime: grime ?? 0, wet: wet ?? 0 });
    const cfg = material.userData.hl;
    if (grime !== undefined) u.hlGrime.value = grime;
    if (wet !== undefined) u.hlWet.value = wet;
    // Defines only flip when a layer appears for the first time.
    if ((grime > 0 && !cfg.grime) || (wet > 0 && !cfg.wet)) this._patch(material, { ...cfg, grime: grime ?? cfg.grime, wet: wet ?? cfg.wet });
    return material;
  }

  /** Install / update the onBeforeCompile patch. cfg merges over the previous one. */
  _patch(m, cfg) {
    const prev = m.userData.hl || {};
    const c = { ...prev, ...cfg };
    if (!cfg.detail && prev.detail) c.detail = prev.detail;
    m.userData.hl = c;
    let u = m.userData.hlUniforms;
    if (!u) {
      u = {
        ...GRIME_U,
        hlGrime: { value: 0 },
        hlWet: { value: 0 },
        hlDesat: { value: 0 },
        hlGroundY: { value: 0 },
        hlPuddleTile: { value: 6 },
        hlColorMap: { value: null },
        hlNormalMap: { value: null },
        hlArmMap: { value: null },
        hlTileInv: { value: new THREE.Vector2(0.5, 0.5) },
        hlColorScale: { value: new THREE.Vector3(1, 1, 1) },
        hlAlbedoMix: { value: 1 },
        hlNormalScale: { value: 1 },
        hlAO: { value: 1 },
        hlRoughScale: { value: 1 },
        hlRoughMix: { value: 1 },
      };
      m.userData.hlUniforms = u;
      this._patched++;
    }
    u.hlGrime.value = c.grime || 0;
    u.hlWet.value = c.wet || 0;
    u.hlDesat.value = c.desat || 0;
    u.hlGroundY.value = c.groundY || 0;
    u.hlPuddleTile.value = c.puddleTile || 6;
    const d = c.detail;
    const defines = { ...(m.defines || {}) };
    for (const k of ['HL_DETAIL', 'HL_METAL', 'HL_GRIME', 'HL_WET', 'HL_DESAT']) delete defines[k];
    if (d) {
      u.hlColorMap.value = d.set.color;
      u.hlNormalMap.value = d.set.normal;
      u.hlArmMap.value = d.set.arm;
      u.hlTileInv.value.set(d.tileInv[0], d.tileInv[1]);
      u.hlColorScale.value.set(...d.colorScale);
      u.hlAlbedoMix.value = d.albedo;
      u.hlNormalScale.value = d.normalScale;
      u.hlAO.value = d.ao;
      u.hlRoughScale.value = d.roughScale;
      u.hlRoughMix.value = d.roughMix;
      defines.HL_DETAIL = '';
      if (d.metal) defines.HL_METAL = '';
    }
    if (c.grime > 0) defines.HL_GRIME = '';
    if (c.wet > 0) defines.HL_WET = '';
    if (c.desat > 0) defines.HL_DESAT = '';
    m.defines = defines;
    const key = 'hl' + Object.keys(defines).filter((k) => k.startsWith('HL_')).sort().join(',');
    m.customProgramCacheKey = () => key;
    m.onBeforeCompile = onBeforeCompile;
    m.needsUpdate = true;
  }

  /**
   * Make Kenney GLBs (palette-atlas UVs, glossy flat colours) sit next to PBR surfaces: rougher, not
   * metallic, a little darker and desaturated, with world-space grime. Shared Kenney materials get
   * one restyled clone each (cached), so every instance stays consistent. Skips skinned meshes and
   * anything with userData.noRestyle. opts: { roughness=0.82, metalness=0.05, grime=0.55, desat=0.18,
   * darken=0.9, wet=0, groundY=0 }. Returns the number of materials restyled.
   */
  restyleKenney(object, opts = {}) {
    const { roughness = 0.82, metalness = 0.05, grime = 0.55, desat = 0.18, darken = 0.9, wet = 0, groundY = 0 } = opts;
    const key = JSON.stringify([roughness, metalness, grime, desat, darken, wet, groundY]);
    let n = 0;
    object?.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.userData.noRestyle || o.userData.restyled) return;
      const swap = (src) => {
        if (!src?.isMeshStandardMaterial || src.userData.hlRestyle) return src;
        let byKey = this._restyled?.get(src);
        if (!byKey) {
          (this._restyled ??= new WeakMap()).set(src, (byKey = new Map()));
        }
        let r = byKey.get(key);
        if (!r) {
          r = src.clone();
          r.roughness = Math.max(r.roughness, roughness);
          r.metalness = Math.min(r.metalness, metalness);
          r.color.multiplyScalar(darken);
          r.userData.hlRestyle = true;
          this._patch(r, { grime, wet, desat, groundY });
          byKey.set(key, r);
          n++;
        }
        return r;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      o.userData.restyled = true;
    });
    return n;
  }

  /** Change the anisotropy of every loaded texture (quality tier). */
  setAnisotropy(n) {
    const a = Math.min(n, this.renderer.capabilities.getMaxAnisotropy());
    if (a === this.anisotropy) return;
    this.anisotropy = a;
    const all = [...this._clones.values(), ...Object.values(GRIME_U).map((u) => u.value)];
    for (const s of this._sets.values()) if (s.ok) all.push(s.color, s.normal, s.arm);
    for (const t of all) {
      if (!t || t.isDataTexture) continue;
      t.anisotropy = a;
      t.needsUpdate = true;
    }
  }

  stats() {
    let loaded = 0;
    for (const s of this._sets.values()) if (s.ok) loaded++;
    return { manifest: Object.keys(this.manifest).length, loaded, sets: this._sets.size, materials: this._cache.size, patched: this._patched };
  }
}
