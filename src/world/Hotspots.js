import * as THREE from 'three';
import { L } from '../story/script.js';
import { retext } from '../story/i18n.js';

const RING_GEO = new THREE.RingGeometry(0.47, 0.51, 48).rotateX(-Math.PI / 2);
const BEAM_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, true).translate(0, 0.5, 0);

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xffe9b0) }, uAlpha: { value: 0.35 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vY;
      void main(){ gl_FragColor = vec4(uColor, uAlpha * pow(1. - clamp(vY, 0., 1.), 2.)); }`,
  });
}

const toV3 = (p) => {
  if (p?.isVector3) return p.clone();
  if (Array.isArray(p)) return p.length === 2 ? new THREE.Vector3(p[0], 0, p[1]) : new THREE.Vector3(p[0], p[1], p[2]);
  return new THREE.Vector3();
};

/**
 * Proximity interactions. The nearest enabled spot within its radius shows "[E] prompt";
 * E fires onInteract only while director.state === 'play'.
 * `auto: true` spots are zones: they fire on entering the radius, with no prompt.
 */
export class Hotspots {
  constructor({ scene, input, ui, getPlayer, getState }) {
    this.scene = scene;
    this.input = input;
    this.ui = ui;
    this.getPlayer = getPlayer;
    this.getState = getState;
    this.spots = new Map();
    this.fired = new Set();
    this._waiters = new Map(); // id -> [resolve]
    this.group = new THREE.Group();
    this.group.name = 'hotspots';
    this.group.userData.noDispose = true;
    scene.add(this.group);
    this.t = 0;
    this.current = null;
  }

  /**
   * opts: { id, pos:[x,z]|[x,y,z]|Vector3, radius=1.6, prompt=L.ui.interact, required=false,
   *         enabled:()=>bool, once=true, auto=false, marker=true, onInteract: async (spot)=>{},
   *         ringColor=0xc9b48a (floor ring tint), ringOpacity=1 (multiplies the ring's pulse/proximity
   *         opacity; < 1 for dark floors where the stock chalk ring glares) }
   */
  add(opts) {
    if (!opts?.id) throw new Error('hotspot needs an id');
    if (this.spots.has(opts.id)) this.remove(opts.id);
    const spot = {
      id: opts.id,
      pos: toV3(opts.pos),
      radius: opts.radius ?? 1.6,
      prompt: opts.prompt ?? null, // null = L.ui.interact
      required: !!opts.required,
      enabled: opts.enabled ?? (() => true),
      once: opts.once ?? true,
      auto: !!opts.auto,
      onInteract: opts.onInteract,
      active: true,
      busy: false,
      count: 0,
      marker: null,
      ringOpacity: opts.ringOpacity ?? 1,
    };
    this.fired.delete(spot.id);
    if (opts.marker ?? !spot.auto) spot.marker = this._marker(spot, opts.ringColor);
    this.spots.set(spot.id, spot);
    return spot;
  }

  _marker(spot, ringColor = 0xc9b48a) {
    const g = new THREE.Group();
    g.position.copy(spot.pos);
    g.position.y += 0.02;
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor, // default: dim warm chalk; reads on dark floors without glowing
      transparent: true,
      opacity: (spot.required ? 0.16 : 0.07) * spot.ringOpacity,
      toneMapped: false, // no effect with the composer (OutputPass tone-maps everything); kept for a canvas-only render
      depthWrite: false,
      fog: false,
    });
    const ring = new THREE.Mesh(RING_GEO, ringMat);
    ring.renderOrder = 5;
    g.add(ring);
    if (spot.required) {
      const beam = new THREE.Mesh(BEAM_GEO, beamMaterial());
      beam.scale.set(0.55, 1.7, 0.55);
      beam.renderOrder = 6;
      g.add(beam);
      g.userData.beam = beam;
    }
    g.userData.ring = ring;
    g.userData.phase = Math.random() * 6;
    this.group.add(g);
    return g;
  }

  get(id) {
    return this.spots.get(id);
  }

  /** Enable/disable a spot without removing it. */
  setActive(id, on) {
    const s = this.spots.get(id);
    if (s) s.active = on;
  }

  remove(id) {
    const s = this.spots.get(id);
    if (!s) return;
    if (s.marker) {
      this.group.remove(s.marker);
      s.marker.traverse((o) => o.material?.dispose());
    }
    this.spots.delete(id);
  }

  clear() {
    for (const id of [...this.spots.keys()]) this.remove(id);
    this.fired.clear();
    // Pending waiters from an unloaded chapter are released so nothing hangs.
    for (const list of this._waiters.values()) for (const r of list) r('cleared');
    this._waiters.clear();
    this.current = null;
    this.ui._spotPrompt(null);
  }

  /** Promise that resolves after spot `id` has fired and its onInteract finished. */
  waitFor(id) {
    if (this.fired.has(id)) return Promise.resolve('done');
    return new Promise((resolve) => {
      if (!this._waiters.has(id)) this._waiters.set(id, []);
      this._waiters.get(id).push(resolve);
    });
  }

  /** Fire a spot programmatically (debug/skip). Returns a Promise for completion. */
  trigger(id) {
    const s = this.spots.get(id);
    if (!s) return this.fired.has(id) ? Promise.resolve('done') : this.waitFor(id);
    if (s.busy) return this.waitFor(id);
    return this._fire(s);
  }

  async _fire(s) {
    s.busy = true;
    try {
      await s.onInteract?.(s);
    } catch (err) {
      console.error('[hotspots] onInteract failed for', s.id, err);
    }
    s.busy = false;
    s.count++;
    if (s.once) {
      this.remove(s.id);
      this.fired.add(s.id);
    }
    const list = this._waiters.get(s.id);
    if (list) {
      this._waiters.delete(s.id);
      for (const r of list) r('done');
    }
    return 'done';
  }

  update(_dt, raw) {
    this.t += raw;
    const player = this.getPlayer();
    const state = this.getState();
    const canAct = state === 'play' && player && !player.frozen && !player.scripted && !this.ui.modal;
    let best = null;
    let bestD = Infinity;
    for (const s of this.spots.values()) {
      let on = false;
      try {
        on = s.active && !s.busy && s.enabled();
      } catch {
        on = false;
      }
      if (s.marker) {
        s.marker.visible = on;
        if (on) {
          const k = 0.5 + 0.5 * Math.sin(this.t * 2.4 + s.marker.userData.phase);
          // Faint from across the room, brighter as the player closes in.
          const dist = player ? Math.hypot(player.root.position.x - s.pos.x, player.root.position.z - s.pos.z) : 99;
          const near = 1 - THREE.MathUtils.smoothstep(dist, s.radius ?? 1.5, (s.radius ?? 1.5) + 1.5);
          s.marker.userData.ring.scale.setScalar(1 + k * 0.08);
          s.marker.userData.ring.material.opacity = ((s.required ? 0.16 : 0.07) + k * 0.06 + near * 0.3) * s.ringOpacity;
          if (s.marker.userData.beam) s.marker.userData.beam.material.uniforms.uAlpha.value = 0.04 + k * 0.04 + near * 0.06;
        }
      }
      if (!on || !player) continue;
      const p = player.root.position;
      const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
      if (d > s.radius) continue;
      if (s.auto) {
        if (state === 'play') this._fire(s);
        continue;
      }
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    this.current = canAct ? best : null;
    // retext: a prompt captured before a language change shows in the current language.
    this.ui._spotPrompt(this.current ? retext(this.current.prompt) ?? L.ui.interact : null);
    if (this.current && this.input.pressed.has('KeyE')) {
      this.input.consume('KeyE');
      this._fire(this.current);
      this.ui._spotPrompt(null);
    }
  }
}
