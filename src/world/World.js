import { disposeGroup } from './build.js';

/**
 * Holds the current chapter's built scene. ctx.world.
 *   current - whatever chapter.build(ctx) returned ({ group, bounds, spots, update?, dispose?, ...extras })
 *   group / bounds / spots - shortcuts into current
 */
export class World {
  constructor({ scene, assets }) {
    this.scene = scene;
    this.assets = assets;
    this.current = null;
    this.group = null;
    this.bounds = [];
    this.spots = {};
    this._hooks = new Set();
  }

  load(result) {
    this.unload();
    const r = result || {};
    this.current = r;
    this.group = r.group || null;
    this.bounds = r.bounds || [];
    this.spots = r.spots || {};
    if (this.group) this.scene.add(this.group);
  }

  unload() {
    const r = this.current;
    this._hooks.clear();
    if (!r) return;
    try {
      r.dispose?.();
    } catch (err) {
      console.error('[world] dispose failed', err);
    }
    // The group first: props a chapter parented to an NPC's bones (brushes, a camera) are still under
    // the group then. Releasing the characters first would detach them before the walk.
    disposeGroup(r.group);
    this.assets.releaseCharacters();
    this.current = null;
    this.group = null;
    this.bounds = [];
    this.spots = {};
  }

  /** Add objects to the current chapter group (disposed on unload). */
  add(...objs) {
    this.group?.add(...objs);
    return objs[0];
  }

  /** Per-frame hook for this chapter only: fn(dt, rawDt). Returns off(). */
  onUpdate(fn) {
    this._hooks.add(fn);
    return () => this._hooks.delete(fn);
  }

  update(dt, raw) {
    try {
      this.current?.update?.(dt, raw);
    } catch (err) {
      console.error('[world] update failed', err);
    }
    for (const fn of this._hooks) {
      try {
        fn(dt, raw);
      } catch (err) {
        console.error('[world] hook failed', err);
        this._hooks.delete(fn);
      }
    }
  }
}
