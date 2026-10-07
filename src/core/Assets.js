import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from '../characters/Character.js';
import { CharacterKit } from '../characters/CharacterKit.js';
import { halve } from './Materials.js';

export { Character };

const BASE = import.meta.env.BASE_URL || '/';

/** Resolve an asset path. 'kenney/x.glb', 'assets/kenney/x.glb' and '/assets/kenney/x.glb' all work. */
export function assetUrl(path) {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  let p = path.replace(/^\/+/, '');
  if (!p.startsWith('assets/')) p = 'assets/' + p;
  return BASE + p;
}

// Approximate native sizes [w, h, d] in metres of every shipped prop (Kenney: docs/asset-bounds.txt;
// Poly Haven: .cache/dl/props/props.json, written by scripts/assets/props.sh), so a GLB that fails to load becomes a grey box of the
// right proportions.
const NATIVE_SIZE = {
  'kenney/city/low-detail-building-a.glb': [0.50, 2.00, 0.50],
  'kenney/city/low-detail-building-b.glb': [0.50, 2.23, 0.50],
  'kenney/city/low-detail-building-c.glb': [0.50, 2.25, 0.50],
  'kenney/city/low-detail-building-d.glb': [0.50, 1.75, 0.50],
  'kenney/roads/construction-cone.glb': [0.08, 0.09, 0.08],
  'kenney/roads/light-square.glb': [0.06, 0.60, 0.24],
  'kenney/retro/detail-bench.glb': [0.60, 0.41, 0.32],
  'kenney/retro/detail-bricks-type-a.glb': [0.58, 0.20, 0.54],
  'kenney/retro/detail-dumpster-closed.glb': [0.60, 0.54, 0.45],
  'kenney/retro/pallet-small.glb': [0.50, 0.15, 0.58],
  'kenney/survival/bottle-large.glb': [0.08, 0.14, 0.08],
  'props/crt_tv.glb': [0.60, 0.46, 0.47],
  'props/sofa_worn.glb': [2.73, 1.12, 0.93],
  'props/iron_bed.glb': [0.91, 1.20, 2.00],
  'props/cardboard_box.glb': [0.39, 0.34, 0.52],
  'props/trash_bag.glb': [0.53, 0.57, 0.46],
  'props/wrist_watch.glb': [0.04, 0.01, 0.22],
  'props/steel_shelves.glb': [1.10, 2.14, 0.50],
  'props/fluoro_light.glb': [0.91, 0.03, 0.04],
  'props/bench_vice.glb': [0.20, 0.28, 0.40],
  'props/spanner.glb': [0.06, 0.02, 0.34],
  'props/drill.glb': [0.18, 0.18, 0.05],
  'props/hammer.glb': [0.10, 0.30, 0.02],
  'props/handsaw.glb': [0.04, 0.17, 0.63],
  'props/pliers.glb': [0.06, 0.18, 0.02],
  'props/screwdriver.glb': [0.03, 0.21, 0.03],
  'props/tape_measure.glb': [0.04, 0.07, 0.17],
  'props/paint_can.glb': [0.12, 0.15, 0.12],
  'props/oil_can.glb': [0.27, 0.24, 0.10],
  'props/toolbox.glb': [0.40, 0.30, 0.27],
  'props/stool.glb': [0.42, 0.44, 0.44],
  'props/stepladder.glb': [0.96, 1.33, 0.50],
  'props/bulb.glb': [0.06, 0.10, 0.06],
  'props/track_pump.glb': [0.26, 0.58, 0.10],
  'props/radio.glb': [0.72, 0.47, 0.19],
  'props/bin_metal.glb': [0.77, 0.91, 0.55],
  'props/barrel.glb': [0.63, 0.93, 0.64],
  'props/crate_wood.glb': [0.82, 0.35, 0.41],
  'props/milk_crate.glb': [0.30, 0.26, 0.41],
  'props/cafe_set.glb': [0.74, 0.86, 1.72],
  'props/chair_painted.glb': [0.43, 0.96, 0.54],
  'props/road_barrier.glb': [1.56, 1.11, 0.44],
};

const CHARACTER_HEIGHT = 1.8;
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    this.kit = new CharacterKit(this.loader, assetUrl); // Quaternius characters (src/characters)
    this.charactersFailed = false;
    this.characters = new Set();
    this.halfRes = false; // main.js: true on the low tier
    this._props = new Map(); // url -> Promise<{scene, size} | null>
    this._textures = new Map();
    this.texLoader = new THREE.TextureLoader();
  }

  /** Load the character set once (parts, clips, kit masks). onProgress(0..1). Never rejects. */
  async loadCore(onProgress = () => {}) {
    try {
      await this.kit.load(onProgress);
      console.info('[hairline] Characters and animations: Quaternius (CC0).');
    } catch (err) {
      console.warn('[hairline] characters failed to load, using capsule fallback', err?.message || err);
      this.charactersFailed = true;
    }
    onProgress(1);
    return this.kit.ready;
  }

  /**
   * Create a character. Returns a Character; never throws.
   * opts: { preset: 'hugo'|'odile'|'sami'|'bastien'|'ines'|'marco'|'mme'|'runner'|'spectator'|'passerby',
   *         variant (preset tokens: 'm' | 'f' | 'long' | 'rain'; Hugo: 'civilian' | 'runner' | 'runner_dawn'),
   *         tint (main garment / kit top), scale (overrides the preset's), name, seed (extras' look;
   *         defaults to name), castShadow=true }
   */
  makeCharacter({ preset = 'passerby', variant, tint, scale, name = 'character', seed, castShadow = true } = {}) {
    const root = new THREE.Group();
    root.name = name;
    let char;
    try {
      if (!this.kit.ready) throw new Error('no characters');
      const { outfits, current } = this.kit.recipes(preset, variant, seed ?? name);
      const built = this.kit.build(outfits, { castShadow, overrides: { tint, scale } });
      const model = new THREE.Group();
      model.name = 'model';
      model.add(built.rig);
      root.add(model);
      const mixer = new THREE.AnimationMixer(built.rig);
      const actions = {};
      for (const [k, clip] of Object.entries(this.kit.clips)) actions[k] = mixer.clipAction(clip);
      char = new Character({
        root,
        model,
        rig: built.rig,
        mixer,
        actions,
        materials: built.materials,
        isFallback: false,
        name,
        kit: this.kit,
        outfits: built.outfits,
        outfit: current,
        bones: built.bones,
      });
      char.preset = preset;
      char.play('idle', 0);
      mixer.update(Math.random() * 2); // desync idles
    } catch (err) {
      if (this.kit.ready) console.warn('[hairline] makeCharacter failed, capsule for', name, err);
      const s = scale ?? { odile: 0.94, sami: 0.72, mme: 0.92 }[preset] ?? 1;
      char = this._capsule(root, { tint: tint ?? 0x4a5260, scale: s, name, castShadow });
    }
    root.traverse((o) => (o.userData.noDispose = true));
    this.characters.add(char);
    return char;
  }

  _capsule(root, { tint, scale, name, castShadow }) {
    const model = new THREE.Group();
    const h = CHARACTER_HEIGHT * scale;
    const r = 0.25 * scale;
    const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.8 });
    mat.userData.part = 'body';
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, h - 2 * r, 4, 12), mat);
    body.position.y = h / 2;
    body.castShadow = castShadow;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 0.3, r * 0.6), mat);
    nose.position.set(0, h * 0.85, r * 0.9); // shows facing (+Z)
    model.add(body, nose);
    root.add(model);
    return new Character({ root, model, mixer: null, actions: {}, materials: [mat], isFallback: true, name });
  }

  /** Dispose every non-persistent character (called on chapter unload). */
  releaseCharacters() {
    for (const c of [...this.characters]) {
      if (c.persistent) continue;
      c.dispose();
      this.characters.delete(c);
    }
  }

  update(dt) {
    for (const c of this.characters) if (c.alive) c.update(dt);
  }

  _loadProp(url) {
    if (!this._props.has(url)) {
      this._props.set(
        url,
        this.loader.loadAsync(url).then(
          (gltf) => {
            const scene = gltf.scene;
            if (this.halfRes) {
              // Low tier: halve every texture before its first upload (a quarter of the memory).
              const done = new Set();
              scene.traverse((o) => {
                for (const m of o.isMesh ? [o.material].flat() : []) {
                  for (const t of Object.values(m)) {
                    if (!t?.isTexture || done.has(t.source) || !(t.image?.width > 256)) continue;
                    done.add(t.source);
                    t.image = halve(t.image);
                    t.needsUpdate = true;
                  }
                }
              });
            }
            scene.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(scene);
            return { scene, box };
          },
          (err) => {
            console.warn('[hairline:assets] prop failed, using grey box:', url, err?.message || err);
            return null;
          },
        ),
      );
    }
    return this._props.get(url);
  }

  /**
   * Free the GPU copies (geometry, textures) of cached prop scenes whose path is not in `keep` (paths
   * as in look.js; main.js keeps the current and the next chapter's). The parsed scenes stay cached,
   * so a prop used again is simply uploaded again on first draw. Returns the number released.
   */
  releaseProps(keep) {
    const k = new Set(keep.map((p) => assetUrl(p)));
    let n = 0;
    for (const [url, pending] of this._props) {
      if (k.has(url)) continue;
      n++;
      pending.then((src) =>
        src?.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry?.dispose();
          for (const m of [o.material].flat()) for (const v of Object.values(m || {})) if (v?.isTexture) v.dispose();
        }),
      );
    }
    return n;
  }

  /** Warm the cache for several prop paths (fire and forget). */
  preload(paths) {
    return Promise.all(paths.map((p) => this._loadProp(assetUrl(p))));
  }

  /**
   * Load a GLB prop normalised to real-world size. Never rejects.
   * opts: { height (m), width (m, used when no height), tint (multiplies colours), color (replaces colours),
   *         center=true (footprint centred on x/z, bottom at y=0), castShadow=true, receiveShadow=true }
   * Returns a Group; group.userData.size is the final Vector3 size in metres.
   */
  async prop(path, opts = {}) {
    const { height, width, tint, color, center = true, castShadow = true, receiveShadow = true } = opts;
    const url = assetUrl(path);
    const key = path.replace(/^\/?(assets\/)?/, '');
    const src = await this._loadProp(url);
    const pivot = new THREE.Group();
    pivot.name = 'prop:' + key;

    if (!src) {
      const n = NATIVE_SIZE[key] || [0.6, 1, 0.6];
      const k = height ? height / n[1] : width ? width / n[0] : 1;
      const geo = new THREE.BoxGeometry(n[0] * k, n[1] * k, n[2] * k);
      const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color ?? 0x777777, roughness: 0.9 }));
      box.position.y = (n[1] * k) / 2;
      box.castShadow = castShadow;
      box.receiveShadow = receiveShadow;
      pivot.add(box);
      pivot.userData.size = new THREE.Vector3(n[0] * k, n[1] * k, n[2] * k);
      pivot.userData.isFallback = true;
      return pivot;
    }

    const inner = src.scene.clone(true);
    src.box.getSize(_size);
    src.box.getCenter(_center);
    const k = height ? height / Math.max(_size.y, 1e-4) : width ? width / Math.max(_size.x, 1e-4) : 1;
    inner.scale.multiplyScalar(k);
    if (center) inner.position.set(-_center.x * k, -src.box.min.y * k, -_center.z * k);
    const tintColor = tint !== undefined ? new THREE.Color(tint) : null;
    const setColor = color !== undefined ? new THREE.Color(color) : null;
    inner.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = castShadow;
      o.receiveShadow = receiveShadow;
      if (tintColor || setColor) {
        o.material = o.material.clone();
        if (setColor) o.material.color.copy(setColor);
        if (tintColor) o.material.color.multiply(tintColor);
      } else {
        o.userData.noDispose = true; // shares cached geometry/material
      }
      o.userData.sharedGeometry = true;
    });
    pivot.add(inner);
    pivot.userData.size = _size.clone().multiplyScalar(k);
    pivot.userData.isFallback = false;
    return pivot;
  }

  /** Cached texture loader. opts: { repeat:[u,v], srgb=true }. A failed load yields a 1x1 grey texture. */
  texture(path, { repeat, srgb = true } = {}) {
    const url = assetUrl(path);
    let entry = this._textures.get(url);
    if (!entry) {
      entry = { base: null, loaded: false, clones: [] };
      entry.base = this.texLoader.load(
        url,
        () => {
          entry.loaded = true;
          for (const c of entry.clones) c.needsUpdate = true;
          entry.clones.length = 0;
        },
        undefined,
        () => console.warn('[hairline:assets] texture failed', url),
      );
      this._textures.set(url, entry);
    }
    const base = entry.base;
    const tex = base.clone();
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
    }
    tex.anisotropy = 4;
    if (entry.loaded) tex.needsUpdate = true;
    else entry.clones.push(tex);
    return tex;
  }
}
