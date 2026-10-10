import * as THREE from 'three';
import { L } from '../story/script.js';
import { retext } from '../story/i18n.js';
import { pocket, kindOf, fillItem, itemIcon, refusal, giftLines, needsLines, personName } from '../story/items.js';

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

const toList = (v) => (v == null ? [] : Array.isArray(v) ? v.slice() : [v]);

/**
 * Proximity interactions. The nearest enabled spot within its radius shows "[E] prompt";
 * E fires onInteract only while director.state === 'play'.
 * `auto: true` spots are zones: they fire on entering the radius, with no prompt.
 *
 * Items (story/items.js, docs/SCRIPT-R4.md §1): E with an item held uses it on the spot. A spot that
 * `needs` an item fires with it (onUse(item) or onInteract); with nothing held, a needed item in the
 * pocket is used by itself (required items never need the pocket UI); with none, the spot says its
 * needs line and does not fire. An item the spot `accepts` runs onUse without firing the spot. Any other
 * item gets a refusal (the person's, or the item kind's on an object). A `person` spot takes gifts the
 * text has a reply for (L.items.give.<item>.<person>) or that onGift handles.
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
    this._gen = 0;
    this.current = null;
  }

  /**
   * opts: { id, pos:[x,z]|[x,y,z]|Vector3, radius=1.6, prompt=L.ui.interact, required=false,
   *         enabled:()=>bool, once=true, auto=false, marker=true, onInteract: async (spot)=>{},
   *         ringColor=0xc9b48a (floor ring tint), ringOpacity=1 (multiplies the ring's pulse/proximity
   *         opacity; < 1 for dark floors where the stock chalk ring glares),
   *         items: needs: id | [ids] (any one opens the spot), needsLine: lines (said without it; default
   *         L.items.needs.generic), accepts: id | [ids] (used without firing the spot), onUse: async (item,
   *         spot) => {} (for needs and accepts; needs fall back to onInteract), person: 'odile' (a character:
   *         their refusals, gifts), object: 'door' (item-specific refusals), onGift: async (item, spot) => {}
   *         (after the gift is taken; replaces the text reply), usePrompt (prompt while a needed or accepted
   *         item is held; default: the spot's own prompt), takesGifts: () => bool (false: a held gift
   *         is ignored and E interacts as with empty hands, e.g. before the person's interview) }
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
      needs: toList(opts.needs),
      needsLine: opts.needsLine ?? null,
      accepts: toList(opts.accepts),
      onUse: opts.onUse,
      person: opts.person ?? null,
      object: opts.object ?? null,
      onGift: opts.onGift,
      usePrompt: opts.usePrompt ?? null,
      takesGifts: opts.takesGifts ?? null,
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
    this._gen = (this._gen || 0) + 1;
    const p = this.getPlayer();
    if (p) p.held = 0;
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

  /**
   * Fire a spot programmatically (debug/skip). Returns a Promise for completion. A spot that needs an
   * item fires as if it were used (the held or pocketed one, else the first it needs).
   */
  trigger(id) {
    const s = this.spots.get(id);
    if (!s) return this.fired.has(id) ? Promise.resolve('done') : this.waitFor(id);
    if (s.busy) return this.waitFor(id);
    const item = s.needs.length ? (s.needs.find((i) => i === pocket.selected()) ?? s.needs.find((i) => pocket.has(i)) ?? s.needs[0]) : null;
    return this._fire(s, item);
  }

  /** The Director (set by Director.start): item lines are said through d.say (skippable, frozen). */
  bindDirector(d) {
    this.director = d;
  }

  /**
   * While a spot's action runs, the player can't walk off and no other spot answers E (Player.held):
   * a scene's pauses (a camera move, a wait) used to let a second spot start on top of it (R4 PT57 #1).
   * Auto zones don't hold: they fire on walking in.
   */
  _hold(s, on) {
    if (s.auto) return;
    const p = this.getPlayer();
    if (!p) return;
    if (on) {
      s._heldGen = this._gen;
      p.held = (p.held || 0) + 1;
    } else if (s._heldGen === this._gen) p.held = Math.max(0, (p.held || 0) - 1); // a cleared chapter's spot no longer counts
  }

  /** Is any spot's action running (no other spot answers E then)? */
  anyBusy() {
    for (const s of this.spots.values()) if (s.busy && !s.auto) return true;
    return false;
  }

  async _fire(s, item = null) {
    s.busy = true;
    this._hold(s, true);
    if (item && pocket.selected() === item) pocket.select(null); // used: back in the pocket
    try {
      if (item && s.onUse) await s.onUse(item, s);
      else await s.onInteract?.(s);
    } catch (err) {
      console.error('[hotspots] onInteract failed for', s.id, err);
    }
    this._hold(s, false);
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

  // ------------------------------------------------------------- items

  /** E on spot s: the held item, a needed item from the pocket, or a plain interact. */
  /** A held gift this person spot ignores for now (takesGifts() false: talk first); E then talks. */
  _giftWaits(s, held) {
    return !!held && !!s.person && kindOf(held) === 'gift' && !!s.takesGifts && !s.takesGifts();
  }

  _press(s) {
    const held = pocket.selected();
    if (held && !this._giftWaits(s, held)) return this._use(s, held);
    if (s.needs.length) {
      const have = s.needs.find((id) => pocket.has(id));
      if (have) return this._fire(s, have);
      return this._aside(s, () => this._say(needsLines(s.needsLine)));
    }
    return this._fire(s);
  }

  _use(s, id) {
    if (s.needs.includes(id)) return this._fire(s, id);
    if (s.accepts.includes(id) && s.onUse) {
      pocket.select(null);
      return this._aside(s, () => s.onUse(id, s));
    }
    return this._aside(s, async () => {
      if (s.person && kindOf(id) === 'gift' && (s.onGift || giftLines(id, s.person))) {
        pocket.give(id, s.person);
        if (s.onGift) await s.onGift(id, s);
        else await this._say(giftLines(id, s.person));
        return;
      }
      const r = refusal(id, s);
      if (r.buzz) this.ui.watchBuzz?.(r.buzz);
      await this._say(r.lines);
    });
  }

  /** Run fn with the spot busy, without firing it (no count, no once, waiters keep waiting). */
  async _aside(s, fn) {
    s.busy = true;
    this._hold(s, true);
    try {
      await fn();
    } catch (err) {
      console.error('[hotspots] item action failed for', s.id, err);
    }
    this._hold(s, false);
    s.busy = false;
  }

  async _say(lines) {
    if (!lines?.length) return;
    if (this.director) return this.director.say(lines);
    for (const l of lines) this.ui.thought(l.text, 3, { who: l.inner ? undefined : l.who ?? undefined });
  }

  /** [prompt text, icon url | null] for spot s, given the held item. */
  _promptFor(s) {
    const own = retext(s.prompt) ?? L.ui.interact;
    const held = pocket.selected();
    if (!held || this._giftWaits(s, held)) {
      const need = s.needs.find((id) => pocket.has(id));
      return [own, need ? itemIcon(need) : null]; // the needed tool shows by the prompt
    }
    if (s.needs.includes(held) || s.accepts.includes(held)) return [retext(s.usePrompt) ?? own, itemIcon(held)];
    const U = L.items?.ui || {};
    const gift = s.person && kindOf(held) === 'gift';
    return [fillItem(gift ? U.give : U.use, held, { who: personName(s.person) }), itemIcon(held)];
  }

  update(_dt, raw) {
    this.t += raw;
    const player = this.getPlayer();
    const state = this.getState();
    const canAct = state === 'play' && player && !player.frozen && !(player.held > 0) && !player.scripted && !this.ui.modal && !this.anyBusy();
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
    // retext: a prompt captured before the key labels changed shows the current ones.
    if (this.current) this.ui._spotPrompt(...this._promptFor(this.current));
    else this.ui._spotPrompt(null);
    if (this.current && this.input.pressed.has('KeyE')) {
      this.input.consume('KeyE');
      this._press(this.current);
      this.ui._spotPrompt(null);
    }
  }
}
