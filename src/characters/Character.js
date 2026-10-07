import * as THREE from 'three';
import { CLIP_ALIASES, CLIP_ROOT, CLIP_SPEED, boneName } from './cast.js';

const _q = new THREE.Quaternion();
const _x = new THREE.Vector3(1, 0, 0);

/**
 * A skinned (or capsule fallback) character.
 *   root  - Group you position/rotate in the world (faces +Z at rotation.y = 0)
 *   model - inner Group at the feet (character scale). Offset/rotate it for poses; keep root for placement.
 *   rig   - the skinned model inside `model` (pelvis-height offset and clip compensation live here)
 */
export class Character {
  constructor({ root, model, mixer, actions, materials, isFallback, name, rig = null, kit = null, outfits = null, outfit = null, bones = null }) {
    this.root = root;
    this.model = model;
    this.rig = rig;
    this.mixer = mixer;
    this.actions = actions;
    this.materials = materials;
    this.isFallback = isFallback;
    this.name = name;
    this.current = null;
    this.opacity = 1;
    this.persistent = false;
    this.alive = true;
    this.stoop = 0;
    this._fade = null;
    this._bones = new Map();
    this._boneMap = bones; // Map(name -> Bone) for skinned characters
    this._kit = kit;
    this._outfits = outfits; // { name: { recipe, meshes, slots } }
    this.outfit = null;
    this._baseY = 0; // pelvis offset of the current rig, rig units
    this._comp = new THREE.Vector2(); // clip compensation (y, z), rig units: legacy offsets and seated roots
    this._compTo = new THREE.Vector2();
    this._compRate = 8;
    root.userData.character = this;
    if (outfits && outfit) this.setOutfit(outfit);
  }

  /** Recipe of the current outfit (null for the capsule). */
  get recipe() {
    return this._outfits?.[this.outfit]?.recipe || null;
  }

  /**
   * Cross-fade to clip `name`. Our names (docs/assets/characters.md: idle, walk, run, sprint, talk,
   * sit_idle, kneel_work, paint, ...) and the old Xbot names ('sad', 'sneak', 'agree', 'headShake')
   * both work. Returns the action or null (unknown clip, or the capsule).
   */
  play(name, fade = 0.25, { timeScale, once = false } = {}) {
    const alias = CLIP_ALIASES[name];
    const next = this.actions[name] || (alias && this.actions[alias.clip]);
    if (!next) {
      this.current = name;
      return null;
    }
    if (this.current === name) return next;
    const prev = this.current ? this.actions[this.current] || this.actions[CLIP_ALIASES[this.current]?.clip] : null;
    if (prev !== next) {
      next.reset();
      next.enabled = true;
      next.setEffectiveTimeScale(timeScale ?? alias?.timeScale ?? 1);
      next.setEffectiveWeight(1);
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.play();
      if (prev) prev.crossFadeTo(next, Math.max(0.0001, fade), false);
      else if (fade > 0) next.fadeIn(fade);
    }
    const s = this.model.scale.y || 1;
    const clipName = next.getClip().name;
    this._compTo.set((alias?.y || 0) / s, CLIP_ROOT[clipName]?.z || 0);
    this._compRate = fade > 0.001 ? 3 / fade : 1e4;
    this.current = name;
    return next;
  }

  /**
   * The timeScale at which locomotion clip `name` ('walk', 'run', ...) covers `v` m/s of ground, so
   * the planted foot stays put: v / (CLIP_SPEED x the stride scale, model.scale.z = scale x slim).
   */
  strideRate(name, v) {
    const speed = CLIP_SPEED[CLIP_ALIASES[name]?.clip ?? name];
    return speed ? v / (speed * (this.model.scale.z || 1)) : 1;
  }

  /** Find a skeleton bone. Mixamo short names ('Hips', 'LeftLeg', 'RightHand') map to the Universal rig. */
  bone(name) {
    if (this._bones.has(name)) return this._bones.get(name);
    let found = null;
    if (this._boneMap) found = this._boneMap.get(boneName(name)) || this._boneMap.get(name) || null;
    this._bones.set(name, found);
    return found;
  }

  /**
   * Switch outfit (Hugo: 'civilian' | 'runner' | 'runner_dawn'). Applies the outfit's rig
   * proportions and shows its meshes. Unknown names keep the current outfit.
   */
  setOutfit(name) {
    const o = this._outfits?.[name];
    if (!o || this.outfit === name) return;
    this.outfit = name;
    for (const [k, v] of Object.entries(this._outfits)) for (const m of v.meshes) m.visible = k === name;
    const r = o.recipe;
    this._kit.applyRig(this._boneMap, r.rig);
    this._baseY = this._kit.pelvisOffset(r.rig);
    this.stoop = r.stoop || 0;
    const head = this._boneMap.get('Head');
    if (head) head.scale.setScalar(r.head || 1);
    const s = r.scale ?? 1;
    const slim = r.slim ?? 1;
    this.model.scale.set(s * slim, s, s * slim);
    this._applyRigY();
    if (this._hideFoot) this.hideLeftFoot(true);
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

  /** Recolour the main garment (shirt/blouse and sleeves; the kit top on a runner). */
  setTint(color) {
    if (color === undefined || color === null) return;
    const o = this._outfits?.[this.outfit];
    if (!o) {
      const c = new THREE.Color(color);
      for (const m of this.materials) if (m.userData.part === 'body') m.color.copy(c);
      return;
    }
    const r = o.recipe;
    if (r.kit) {
      r.kit.top = color;
      for (const m of new Set(o.slots.map((s) => s.material))) this._kit.setKit(m, r.kit);
      return;
    }
    for (const p of r.primary || []) this.setPartColor(p, color);
  }

  /** Recolour one part of the current outfit ('m_trousers2', 'f_blouse', 'hair_buns', ...). */
  setPartColor(part, color) {
    const o = this._outfits?.[this.outfit];
    if (!o) return;
    if (o.recipe.colors) o.recipe.colors[part] = color;
    // A garment part can carry skin (the sleeves' bare hands): that slot keeps the skin colour, or
    // Hugo's slate tint turned his hands into black gloves.
    for (const s of o.slots) if (s.part === part && !(s.kind === 'skin' && /sleeves/.test(part))) this._kit.colorSlot(s, o.recipe, color);
  }

  /**
   * Hide the left foot and lower leg of the current outfit's shoes/boots (the walking boot goes
   * over it). Vertices weighted to calf_l / foot_l / ball_l are discarded in the shader.
   */
  hideLeftFoot(on) {
    this._hideFoot = !!on;
    for (const [k, o] of Object.entries(this._outfits || {})) {
      for (const s of o.slots) {
        if (!/shoes|boots/.test(s.part)) continue;
        const hl = s.material.userData.hl;
        const show = !on || k !== this.outfit;
        hl.hideSlot.value = show ? -1 : s.slot;
        const bi = (n) => s.boneOffset + (this._kit.boneIndex.get(n) ?? -1000);
        hl.hideBones.value.set(bi('calf_l'), bi('foot_l'), bi('ball_l'), bi('ball_leaf_l'));
      }
    }
  }

  _applyRigY() {
    if (!this.rig) return;
    this.rig.position.y = this._baseY + this._comp.x;
    this.rig.position.z = this._comp.y;
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
      if (!this._comp.equals(this._compTo)) {
        this._comp.lerp(this._compTo, 1 - Math.exp(-this._compRate * dt));
        if (this._comp.distanceToSquared(this._compTo) < 1e-8) this._comp.copy(this._compTo);
      }
      this._applyRigY();
      if (this.stoop) {
        // Age: a rounded upper back and a forward head, on top of whatever clip plays.
        _q.setFromAxisAngle(_x, this.stoop);
        this._boneMap.get('spine_03')?.quaternion.multiply(_q);
        _q.setFromAxisAngle(_x, this.stoop * 0.8);
        this._boneMap.get('neck_01')?.quaternion.multiply(_q);
        // ...with the chin pushed forward, not the gaze dropped: the head tips back up.
        _q.setFromAxisAngle(_x, -this.stoop * 1.4);
        this._boneMap.get('Head')?.quaternion.multiply(_q);
      }
    }
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
    // Anything a chapter hung on the bones (brush, camera) that its group walk did not reach.
    this.root.traverse((o) => {
      if (o.userData.noDispose) return;
      o.geometry?.dispose();
      for (const m of [o.material].flat()) if (m && !m.userData.shared) m.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.model.traverse((o) => o.isSkinnedMesh && o.skeleton?.dispose()); // bone textures
  }
}
