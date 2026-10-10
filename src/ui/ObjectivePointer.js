import * as THREE from 'three';
import './objective-pointer.css';

// Wayfinding: a small chevron toward the current required hotspot, with its distance, whenever
// that spot is off-screen or far (> NEAR m). Only in free-roam play (hidden in dialogue, cards,
// menus, minigames, cinematics and while paused).

const NEAR = 8; // metres: closer than this and on screen, no pointer
const EDGE = 54; // px inset from the screen edge
const AIM_Y = 1.2; // aim at chest height above the spot
const SMOOTH = 14;
const ZONES_EVERY = 0.2; // seconds between HUD keep-out rect refreshes (the watch slides when it docks)
// HUD panels the pointer keeps clear of: the docked watch (with its straps) and the docked notebook.
const ZONE_SELECTORS = ['.watch.show', '.notebook.show'];

/**
 * Fallback targets for chapters whose objective is a place rather than a hotspot, keyed by chapter
 * id. fn(ctx) returns [x, z] or null.
 */
export const WAYPOINTS = {
  // Ch2 "Walk.": the street ends at Odile's scaffold (the arrival beat fires at z < -42).
  street: ({ player }) => (player.position.z > -42 ? [-0.5, -44.2] : null),
};

// A dark under-stroke, then the ink stroke: legible on a bright road line as well as on the dark chip.
const CHEVRON =
  '<svg viewBox="0 0 18 18" aria-hidden="true">' +
  '<path d="M6.5 3.5 L12.5 9 L6.5 14.5" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M6.5 3.5 L12.5 9 L6.5 14.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();

export class ObjectivePointer {
  /** deps: { root (DOM parent), camera, hotspots, player, rig (CameraRig: freeRoam()), getDirector, ctx } */
  constructor({ root, camera, hotspots, player, rig, getDirector, ctx }) {
    Object.assign(this, { root, camera, hotspots, player, rig, getDirector, ctx });
    this.updateWhilePaused = true;
    this.enabled = true;
    const el = document.createElement('div');
    el.className = 'objptr';
    el.innerHTML = `<div class="chev">${CHEVRON}</div><div class="dist"></div>`;
    root.appendChild(el);
    this.el = el;
    this.chev = el.querySelector('.chev');
    this.distEl = el.querySelector('.dist');
    this.state = { visible: false, id: null, dist: null, onScreen: false, x: 0, y: 0, angle: 0, avoided: false };
    this._zones = [];
    this._zonesIn = 0;
    this._scale = 0;
    this._x = null;
    this._y = 0;
    this._a = 0;
    this._text = '';
  }

  /** The nearest active, enabled, required hotspot, else the chapter waypoint: { id, x, z, radius }. */
  target() {
    const p = this.player.root.position;
    let best = null;
    let bestD = Infinity;
    for (const s of this.hotspots.spots.values()) {
      if (!s.required || !s.active || s.busy) continue;
      let on = false;
      try {
        on = s.enabled();
      } catch {
        on = false;
      }
      if (!on) continue;
      const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
      if (d < bestD) {
        bestD = d;
        best = { id: s.id, x: s.pos.x, y: s.pos.y, z: s.pos.z, radius: s.radius };
      }
    }
    if (best) return best;
    const id = this.getDirector?.()?.chapter?.id;
    // A chapter can point at a place for a while: ctx.waypoint = [x, z] (null when it's reached).
    const w = this.ctx?.waypoint ?? WAYPOINTS[id]?.(this.ctx || { player: this.player });
    return w ? { id: `waypoint:${id}`, x: w[0], y: 0, z: w[1], radius: 1.5 } : null;
  }

  _hide() {
    if (this.state.visible) this.el.classList.remove('show');
    Object.assign(this.state, { visible: false, id: null, dist: null, onScreen: false, avoided: false });
    this._x = null; // re-seed the smoothing next time
  }

  /** Screen rects of the visible HUD panels (padded by the caller), refreshed every ZONES_EVERY s. */
  _refreshZones(raw) {
    this._zonesIn -= raw;
    if (this._zonesIn > 0) return;
    this._zonesIn = ZONES_EVERY;
    const zones = [];
    for (const sel of ZONE_SELECTORS) {
      for (const e of this.root.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const z = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        for (const c of e.children) {
          // the watch straps hang outside its box
          const q = c.getBoundingClientRect();
          if (q.width < 1 || q.height < 1) continue;
          z.left = Math.min(z.left, q.left);
          z.top = Math.min(z.top, q.top);
          z.right = Math.max(z.right, q.right);
          z.bottom = Math.max(z.bottom, q.bottom);
        }
        zones.push(z);
      }
    }
    this._zones = zones;
  }

  /** Move (x, y) out of any HUD panel to the nearest point beside it that stays on screen. */
  _avoid(x, y, W, H, s) {
    const pad = 26 * s;
    const m = 18 * s;
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      const z = this._zones.find((r) => x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad);
      if (!z) break;
      let best = null;
      let bestD = Infinity;
      for (const [cx, cy] of [
        [z.left - pad, y],
        [z.right + pad, y],
        [x, z.top - pad],
        [x, z.bottom + pad],
      ]) {
        if (cx < m || cx > W - m || cy < m || cy > H - m) continue;
        const d = Math.hypot(cx - x, cy - y);
        if (d < bestD) {
          bestD = d;
          best = [cx, cy];
        }
      }
      if (!best) break;
      [x, y] = best;
      moved = true;
    }
    return { x, y, moved };
  }

  update(_dt, raw) {
    const t = this.enabled && this.rig.freeRoam() ? this.target() : null;
    if (!t) return this._hide();
    const pp = this.player.root.position;
    const dist = Math.hypot(pp.x - t.x, pp.z - t.z);
    if (dist <= (t.radius ?? 1.5)) return this._hide();

    const cam = this.camera;
    cam.updateMatrixWorld();
    _p.set(t.x, (t.y || 0) + AIM_Y, t.z);
    _c.copy(_p).applyMatrix4(cam.matrixWorldInverse); // camera space (looks down -Z)
    const behind = _c.z > -0.2;
    _p.project(cam);
    const onScreen = !behind && Math.abs(_p.x) < 0.9 && Math.abs(_p.y) < 0.86;
    if (onScreen && dist <= NEAR) return this._hide();

    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.min(1.35, Math.max(0.95, H / 900)); // chip and label scale with the viewport
    if (s !== this._scale) {
      this._scale = s;
      this.el.style.setProperty('--s', s.toFixed(3));
    }
    this._refreshZones(raw);
    let x;
    let y;
    let angle; // chevron direction, screen space (radians, 0 = right, +y down)
    let lx; // label offset
    let ly;
    if (onScreen) {
      // Far but visible: a chevron just above the target, pointing down at it.
      x = (_p.x * 0.5 + 0.5) * W;
      y = (-_p.y * 0.5 + 0.5) * H - 30 * s;
      angle = Math.PI / 2;
      lx = 0;
      ly = -30 * s;
    } else {
      // Off-screen: on the inset screen rectangle, toward the target.
      let dx = _c.x;
      let dy = -_c.y; // screen y grows downward
      if (behind) {
        dy = Math.abs(_c.z) * 0.6 + Math.abs(dy); // behind you: along the bottom, left or right
        if (Math.abs(dx) < 0.05) dx = 0.05 * Math.sign(dx || 1);
      }
      const hx = W / 2 - EDGE;
      const hy = H / 2 - EDGE;
      const k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
      x = W / 2 + dx * k;
      y = H / 2 + dy * k;
      angle = Math.atan2(dy, dx);
      lx = -Math.cos(angle) * 40 * s;
      ly = -Math.sin(angle) * 28 * s;
    }
    // Keep clear of the watch and the notebook (at 1280 x 800 the behind-right edge spot is the
    // watch). On screen, the chevron then sits beside the panel and points at the target.
    const av = this._avoid(x, y, W, H, s);
    if (av.moved) {
      if (onScreen) {
        const tx = (_p.x * 0.5 + 0.5) * W;
        const ty = (-_p.y * 0.5 + 0.5) * H;
        angle = Math.atan2(ty - av.y, tx - av.x);
        lx = -Math.cos(angle) * 40 * s;
        ly = -Math.sin(angle) * 28 * s;
      }
      x = av.x;
      y = av.y;
    }
    if (this._zones.length) {
      // The label's usual (inward) side may be over a panel: try above, below, then the far side.
      const hw = 26 * s;
      const hh = 11 * s;
      const free = ([ox, oy]) => {
        const cx = x + ox;
        const cy = y + oy;
        if (cx - hw < 0 || cx + hw > W || cy - hh < 0 || cy + hh > H) return false;
        return !this._zones.some((z) => cx + hw > z.left && cx - hw < z.right && cy + hh > z.top && cy - hh < z.bottom);
      };
      const pick = [[lx, ly], [0, -30 * s], [0, 30 * s], [-lx, -ly]].find(free);
      if (pick) [lx, ly] = pick;
    }
    // Smooth (and take the short way round for the angle).
    if (this._x === null) {
      this._x = x;
      this._y = y;
      this._a = angle;
    } else {
      const a = 1 - Math.exp(-SMOOTH * raw);
      this._x += (x - this._x) * a;
      this._y += (y - this._y) * a;
      let da = angle - this._a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this._a += da * a;
    }
    this.el.style.transform = `translate(${this._x.toFixed(1)}px, ${this._y.toFixed(1)}px)`;
    this.chev.style.transform = `rotate(${this._a.toFixed(3)}rad)`;
    this.distEl.style.left = `${lx.toFixed(1)}px`;
    this.distEl.style.top = `${ly.toFixed(1)}px`;
    const text = (this.ctx?.L?.ui?.distance ?? '{n} m').replace('{n}', Math.round(dist));
    if (text !== this._text) {
      this.distEl.textContent = text;
      this._text = text;
    }
    if (!this.state.visible) this.el.classList.add('show');
    Object.assign(this.state, { visible: true, id: t.id, dist: +dist.toFixed(1), onScreen, avoided: av.moved, x: Math.round(this._x), y: Math.round(this._y), angle: +((this._a * 180) / Math.PI).toFixed(1) });
  }
}
