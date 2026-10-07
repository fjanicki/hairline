import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL || '/';

/** Resolve an asset path. 'kenney/x.glb', 'assets/kenney/x.glb' and '/assets/kenney/x.glb' all work. */
export function assetUrl(path) {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  let p = path.replace(/^\/+/, '');
  if (!p.startsWith('assets/')) p = 'assets/' + p;
  return BASE + p;
}

// Approximate native sizes [w, h, d] of the Kenney props (docs/asset-bounds.txt),
// used to size the grey-box fallback when a GLB fails to load.
const NATIVE_SIZE = {
  'kenney/arena/banner.glb': [0.60, 1.02, 0.22],
  'kenney/arena/column-damaged.glb': [0.60, 0.72, 0.60],
  'kenney/arena/trophy.glb': [0.56, 0.48, 0.46],
  'kenney/city/building-a.glb': [0.88, 1.29, 0.94],
  'kenney/city/building-b.glb': [0.98, 1.29, 0.94],
  'kenney/city/building-c.glb': [0.88, 0.89, 1.10],
  'kenney/city/building-d.glb': [0.84, 1.29, 0.90],
  'kenney/city/building-e.glb': [1.64, 0.89, 1.00],
  'kenney/city/building-f.glb': [0.84, 1.69, 1.03],
  'kenney/city/building-g.glb': [0.98, 1.69, 0.92],
  'kenney/city/building-h.glb': [0.88, 1.29, 1.00],
  'kenney/city/detail-awning.glb': [0.40, 0.40, 0.15],
  'kenney/city/low-detail-building-a.glb': [0.50, 2.00, 0.50],
  'kenney/city/low-detail-building-b.glb': [0.50, 2.23, 0.50],
  'kenney/city/low-detail-building-c.glb': [0.50, 2.25, 0.50],
  'kenney/city/low-detail-building-d.glb': [0.50, 1.75, 0.50],
  'kenney/furniture/bedSingle.glb': [1.62, 0.51, 1.89],
  'kenney/furniture/bench.glb': [0.40, 0.47, 0.20],
  'kenney/furniture/books.glb': [0.15, 0.10, 0.09],
  'kenney/furniture/cabinetTelevision.glb': [0.80, 0.31, 0.25],
  'kenney/furniture/cardboardBoxClosed.glb': [0.21, 0.28, 0.21],
  'kenney/furniture/cardboardBoxOpen.glb': [0.37, 0.28, 0.21],
  'kenney/furniture/chair.glb': [0.20, 0.47, 0.20],
  'kenney/furniture/doorway.glb': [0.49, 1.01, 0.15],
  'kenney/furniture/kitchenCabinet.glb': [0.43, 0.45, 0.48],
  'kenney/furniture/kitchenFridge.glb': [0.43, 0.92, 0.32],
  'kenney/furniture/lampRoundFloor.glb': [0.16, 0.86, 0.18],
  'kenney/furniture/loungeSofa.glb': [0.98, 0.46, 0.41],
  'kenney/furniture/pottedPlant.glb': [0.25, 0.54, 0.29],
  'kenney/furniture/rugRectangle.glb': [1.57, 0.01, 0.92],
  'kenney/furniture/sideTable.glb': [0.53, 0.38, 0.22],
  'kenney/furniture/table.glb': [0.84, 0.33, 0.45],
  'kenney/furniture/tableCoffee.glb': [0.66, 0.23, 0.40],
  'kenney/furniture/televisionVintage.glb': [0.41, 0.27, 0.27],
  'kenney/furniture/trashcan.glb': [0.50, 0.91, 0.44],
  'kenney/furniture/wallWindow.glb': [1.00, 1.29, 0.09],
  'kenney/nature/fence_simple.glb': [1.00, 0.35, 0.07],
  'kenney/nature/grass.glb': [0.38, 0.25, 0.39],
  'kenney/nature/grass_large.glb': [0.41, 0.25, 0.41],
  'kenney/nature/log.glb': [0.23, 0.17, 0.70],
  'kenney/nature/plant_bush.glb': [0.40, 0.24, 0.40],
  'kenney/nature/rock_largeA.glb': [0.78, 0.26, 1.02],
  'kenney/nature/stump_old.glb': [0.36, 0.27, 0.38],
  'kenney/nature/tree_cone_fall.glb': [0.52, 1.43, 0.52],
  'kenney/nature/tree_default_fall.glb': [0.76, 1.71, 0.66],
  'kenney/nature/tree_oak_fall.glb': [0.64, 1.23, 0.74],
  'kenney/nature/tree_simple_fall.glb': [0.36, 1.52, 0.40],
  'kenney/nature/tree_thin_fall.glb': [0.68, 1.49, 0.62],
  'kenney/retro/detail-barrier-strong-damaged.glb': [0.66, 0.33, 0.24],
  'kenney/retro/detail-bench.glb': [0.60, 0.41, 0.32],
  'kenney/retro/detail-dumpster-open.glb': [0.60, 0.55, 0.48],
  'kenney/retro/detail-light-single.glb': [0.08, 0.96, 0.26],
  'kenney/retro/pallet.glb': [1.00, 0.15, 1.00],
  'kenney/retro/planks.glb': [1.12, 0.10, 0.58],
  'kenney/retro/tree-small.glb': [0.78, 0.30, 0.78],
  'kenney/retro/detail-bricks-type-a.glb': [0.58, 0.20, 0.54],
  'kenney/retro/detail-cables-type-a.glb': [1.00, 0.14, 0.02],
  'kenney/retro/detail-dumpster-closed.glb': [0.60, 0.54, 0.45],
  'kenney/retro/pallet-small.glb': [0.50, 0.15, 0.58],
  'kenney/retro/scaffolding-floor.glb': [1.00, 0.07, 1.00],
  'kenney/retro/scaffolding-poles.glb': [1.00, 1.00, 1.00],
  'kenney/retro/scaffolding-structure.glb': [1.00, 1.00, 1.00],
  'kenney/retro/wall-a-door.glb': [1.00, 1.00, 1.00],
  'kenney/retro/wall-a-flat.glb': [1.00, 1.00, 0.02],
  'kenney/retro/wall-a-garage.glb': [1.00, 1.00, 1.00],
  'kenney/retro/wall-a-window.glb': [1.00, 1.00, 1.00],
  'kenney/survival/barrel-open.glb': [0.24, 0.34, 0.24],
  'kenney/survival/barrel.glb': [0.24, 0.34, 0.24],
  'kenney/survival/bottle-large.glb': [0.08, 0.14, 0.08],
  'kenney/survival/box-large.glb': [0.24, 0.25, 0.50],
  'kenney/survival/box-open.glb': [0.24, 0.31, 0.24],
  'kenney/survival/box.glb': [0.24, 0.25, 0.24],
  'kenney/survival/bucket.glb': [0.14, 0.19, 0.14],
  'kenney/survival/chest.glb': [0.26, 0.21, 0.39],
  'kenney/survival/metal-panel-screws.glb': [0.50, 0.50, 0.07],
  'kenney/survival/metal-panel.glb': [0.50, 0.50, 0.06],
  'kenney/survival/resource-planks.glb': [0.38, 0.09, 0.62],
  'kenney/survival/resource-wood.glb': [0.20, 0.06, 0.08],
  'kenney/survival/signpost.glb': [0.21, 0.46, 0.04],
  'kenney/survival/structure-metal-doorway.glb': [0.54, 0.50, 0.29],
  'kenney/survival/structure-metal-roof.glb': [0.54, 0.50, 0.56],
  'kenney/survival/structure-metal-wall.glb': [0.54, 0.50, 0.09],
  'kenney/survival/tool-axe.glb': [0.11, 0.26, 0.04],
  'kenney/survival/tool-hammer.glb': [0.08, 0.15, 0.04],
  'kenney/survival/tool-shovel.glb': [0.08, 0.29, 0.04],
  'kenney/survival/workbench-anvil.glb': [0.32, 0.30, 0.30],
  'kenney/survival/workbench-grind.glb': [0.26, 0.31, 0.32],
  'kenney/survival/workbench.glb': [0.30, 0.24, 0.30],
  'kenney/retro/wall-broken-type-a.glb': [1.00, 0.40, 0.08],
  'kenney/roads/construction-barrier.glb': [0.14, 0.13, 0.22],
  'kenney/roads/construction-cone.glb': [0.08, 0.09, 0.08],
  'kenney/roads/construction-fence.glb': [0.08, 0.18, 0.38],
  'kenney/roads/dumpster.glb': [0.38, 0.25, 0.37],
  'kenney/roads/light-curved.glb': [0.06, 0.67, 0.23],
  'kenney/roads/light-square.glb': [0.06, 0.60, 0.24],
  'kenney/roads/road-straight.glb': [1.00, 0.02, 1.00],
};

const CHARACTER_HEIGHT = 1.8;
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * A skinned (or capsule fallback) character.
 *   root  - Group you position/rotate in the world (Xbot faces +Z at rotation.y = 0)
 *   model - inner object (scaled model). Offset/rotate it for poses; keep root for placement.
 */
export class Character {
  constructor({ root, model, mixer, actions, materials, isFallback, name }) {
    this.root = root;
    this.model = model;
    this.mixer = mixer;
    this.actions = actions;
    this.materials = materials;
    this.isFallback = isFallback;
    this.name = name;
    this.current = null;
    this.opacity = 1;
    this.persistent = false;
    this.alive = true;
    this._fade = null;
    this._bones = new Map();
    root.userData.character = this;
  }

  /** Cross-fade to clip `name` (idle, walk, run, sad, sneak, agree, headShake). Returns the action or null. */
  play(name, fade = 0.25, { timeScale = 1, once = false } = {}) {
    const next = this.actions[name];
    if (!next) {
      this.current = name;
      return null;
    }
    if (this.current === name) return next;
    const prev = this.current ? this.actions[this.current] : null;
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (prev && prev !== next) prev.crossFadeTo(next, Math.max(0.0001, fade), false);
    else if (fade > 0) next.fadeIn(fade);
    this.current = name;
    return next;
  }

  /** Find a skeleton bone by Mixamo short name ('Hips', 'Spine', 'LeftUpLeg', ...). */
  bone(name) {
    if (this._bones.has(name)) return this._bones.get(name);
    let found = null;
    this.model.traverse((o) => {
      if (!found && o.isBone && (o.name === 'mixamorig' + name || o.name === name)) found = o;
    });
    this._bones.set(name, found);
    return found;
  }

  setOpacity(a) {
    this.opacity = a;
    for (const m of this.materials) {
      m.transparent = a < 1;
      m.opacity = a;
      m.depthWrite = a > 0.6;
    }
    this.root.visible = a > 0.001;
  }

  /** Fade opacity to `to` over `secs`. Resolves when done. */
  fade(to, secs = 1) {
    return new Promise((resolve) => {
      this._fade?.resolve();
      this._fade = { from: this.opacity, to, t: 0, secs: Math.max(0.0001, secs), resolve };
    });
  }

  setTint(color) {
    const c = new THREE.Color(color);
    for (const m of this.materials) if (m.userData.part === 'body') m.color.copy(c);
  }

  update(dt) {
    this.mixer?.update(dt);
    if (this._fade) {
      const f = this._fade;
      f.t += dt;
      const k = Math.min(1, f.t / f.secs);
      this.setOpacity(f.from + (f.to - f.from) * k);
      if (k >= 1) {
        this._fade = null;
        f.resolve();
      }
    }
  }

  dispose() {
    this.alive = false;
    this.mixer?.stopAllAction();
    this._fade?.resolve();
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
    this.model.traverse((o) => o.isSkinnedMesh && o.skeleton?.dispose()); // bone textures
  }
}

export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    this.xbot = null; // { scene, clips, scale }
    this.xbotFailed = false;
    this.characters = new Set();
    this._props = new Map(); // url -> Promise<{scene, size} | null>
    this._textures = new Map();
    this.texLoader = new THREE.TextureLoader();
  }

  /** Load the Xbot once. onProgress(0..1). Never rejects. */
  async loadCore(onProgress = () => {}) {
    try {
      const gltf = await this.loader.loadAsync(assetUrl('models/Xbot.glb'), (e) => {
        if (e.total) onProgress(Math.min(1, e.loaded / e.total));
      });
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      _box.setFromObject(scene, true);
      _box.getSize(_size);
      const scale = _size.y > 0.01 ? CHARACTER_HEIGHT / _size.y : 1;
      // A fixed, padded bounding sphere per skinned mesh (bind pose x1.5) so clones can be frustum-
      // culled in the main and shadow passes. Poses (crouch, fall) move model.position/rotation,
      // which the world matrix already includes; clones copy the sphere.
      scene.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        o.computeBoundingSphere();
        o.boundingSphere.radius *= 1.5;
      });
      const clips = {};
      for (const c of gltf.animations) clips[c.name] = c;
      // The two pose clips are 3-frame clips whose last frame is the pose: keep only that frame.
      for (const [src, dst] of [['sad_pose', 'sad'], ['sneak_pose', 'sneak']]) {
        if (clips[src]) clips[dst] = THREE.AnimationUtils.subclip(clips[src], dst, 2, 3, 30);
      }
      this.xbot = { scene, clips, scale };
      console.info('[hairline] Character model from mixamo.com (via three.js examples).');
    } catch (err) {
      console.warn('[hairline:assets] Xbot.glb failed to load, using capsule fallback', err);
      this.xbotFailed = true;
    }
    onProgress(1);
    return !!this.xbot;
  }

  /**
   * Create a character. Returns a Character; never throws.
   * opts: { tint, joints, scale=1, name, roughness=0.75, metalness=0.05, castShadow=true }
   */
  makeCharacter({ tint = 0x2a3550, joints, scale = 1, name = 'character', roughness = 0.75, metalness = 0.05, castShadow = true } = {}) {
    const root = new THREE.Group();
    root.name = name;
    let char;
    try {
      if (!this.xbot) throw new Error('no xbot');
      const model = SkeletonUtils.clone(this.xbot.scene);
      model.scale.setScalar(this.xbot.scale * scale);
      const body = new THREE.Color(tint);
      const jointColor = joints !== undefined ? new THREE.Color(joints) : body.clone().multiplyScalar(0.55);
      const materials = [];
      const cloned = new Map();
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = castShadow;
        o.receiveShadow = true;
        o.frustumCulled = !o.isSkinnedMesh || !!o.boundingSphere; // padded bind-pose sphere (see loadCore)
        let m = cloned.get(o.material);
        if (!m) {
          m = o.material.clone();
          const isJoint = /joint/i.test(o.material.name);
          m.userData.part = isJoint ? 'joints' : 'body';
          m.color.copy(isJoint ? jointColor : body);
          m.roughness = roughness;
          m.metalness = isJoint ? Math.max(metalness, 0.2) : metalness;
          cloned.set(o.material, m);
          materials.push(m);
        }
        o.material = m;
      });
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const [k, clip] of Object.entries(this.xbot.clips)) actions[k] = mixer.clipAction(clip);
      char = new Character({ root, model, mixer, actions, materials, isFallback: false, name });
      char.play('idle', 0);
      mixer.update(Math.random() * 2); // desync idles
    } catch (err) {
      char = this._capsule(root, { tint, scale, name, castShadow });
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
