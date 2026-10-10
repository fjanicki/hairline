import * as THREE from 'three';
import { keyText } from '../../../core/KeyLabels.js';
import './games-a-paper.css';

// Shared plumbing for the GAMES-A minigames (photo, puncture, keyring, stakeout; docs/DESIGN-R4.md
// "New minigames"): take the stage (camera, player, director state, mouse look) and give it back,
// a DOM layer under #ui, a mouse that also knows the right button, and the text fallbacks.

export const clamp = THREE.MathUtils.clamp;
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const smooth = (k) => k * k * (3 - 2 * k);
/** French decimal comma for a number shown in the HUD (1.5 -> '1,5'). */
export const frNum = (v, decimals = 1) => v.toFixed(decimals).replace('.', ',');

/**
 * Text for a game: the chapter's strings (opts.text) over the module's French fallbacks, one level
 * deep (an object key in opts.text replaces only the keys it gives). Key tokens are resolved.
 */
export function texts(fallback, given) {
  const out = {};
  for (const [k, v] of Object.entries(fallback)) {
    const g = given?.[k];
    if (g === undefined || g === null) out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && typeof g === 'object' && !Array.isArray(g)) out[k] = { ...v, ...g };
    else out[k] = g;
  }
  for (const [k, v] of Object.entries(given || {})) if (!(k in out)) out[k] = v;
  return resolveKeys(out);
}

function resolveKeys(v) {
  if (typeof v === 'string') return keyText(v);
  if (Array.isArray(v)) return v.map(resolveKeys);
  if (v && typeof v === 'object' && !(v instanceof THREE.Object3D)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveKeys(x)]));
  return v;
}

/**
 * A line in the lower third: a string is Hugo's inner thought, { who, text } a spoken bark.
 * `who` overrides the line's own speaker. Never throws.
 */
export function say(ctx, line, secs = 2.6, who) {
  if (!line) return;
  const text = typeof line === 'string' ? line : line.text;
  const by = who ?? (typeof line === 'object' ? line.who : undefined);
  if (!text) return;
  try {
    ctx.ui.thought(text, secs, by ? { who: by } : undefined);
  } catch (err) {
    console.error('[games-a] thought failed', err);
  }
}

/** Pick a line from a list without repeating the previous pick. */
export function bag(list) {
  let last = -1;
  return () => {
    if (!list?.length) return null;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last) i = (i + 1) % list.length;
    last = i;
    return list[i];
  };
}

/**
 * Take the stage for a minigame: the camera goes to a fixed shot (the camera rig only answers the
 * mouse in follow mode, so mouse look is suspended and the pointer lock released), the player is
 * frozen, hotspots go quiet ('cutscene') and the letterbox comes off. restore() gives all of it back
 * and eases the camera to wherever it was (the follow shot, or the chapter's fixed shot).
 * opts: { hidePlayer = false, letterbox = false, focusSlot = 3, rain = 1 }
 * rain < 1 thins the chapter's rain streaks (build.rain(): named 'rain'): in a close shot a half-metre
 * streak right in front of the lens reads as a rod across the frame.
 */
export function takeStage(ctx, d, { hidePlayer = false, letterbox = false, focusSlot = 3, rain = 1 } = {}) {
  const { cam, player, ui, mood } = ctx;
  const saved = {
    mode: cam.mode,
    pos: cam.pos.clone(),
    look: cam.lookAt.clone(),
    fov: cam.fovValue,
    roll: cam.roll,
    frozen: player.frozen,
    state: d.state,
    letterbox: ui.letterboxEl?.classList.contains('on'),
    visible: player.root.visible,
    focus: mood?.focus?.[focusSlot] ? { ...mood.focus[focusSlot] } : null,
    cursor: ctx.renderer.domElement.style.cursor,
  };
  player.frozen = true;
  if (d.state === 'play') d.state = 'cutscene';
  if (saved.letterbox !== letterbox) ui.letterbox(letterbox);
  if (hidePlayer) player.root.visible = false;
  cam.set({}); // fixed mode right away (no tween yet): the rig drops the mouse this frame
  const rains = [];
  if (rain < 1) {
    ctx.scene.traverse((o) => {
      const u = o.name === 'rain' && o.material?.uniforms?.uOpacity;
      if (u) rains.push({ u, was: u.value });
    });
    for (const r of rains) r.u.value = r.was * rain;
  }
  let restored = false;
  return {
    saved,
    restore({ ease = 0.6 } = {}) {
      if (restored) return;
      restored = true;
      for (const r of rains) if (Math.abs(r.u.value - r.was * rain) < 1e-4) r.u.value = r.was; // unless the chapter changed it meanwhile
      player.frozen = saved.frozen;
      player.root.visible = saved.visible;
      if (d.state === 'cutscene' && saved.state === 'play') d.state = 'play';
      if (saved.letterbox !== letterbox) ui.letterbox(saved.letterbox);
      if (saved.focus && mood?.focus?.[focusSlot]) Object.assign(mood.focus[focusSlot], saved.focus);
      ctx.renderer.domElement.style.cursor = saved.cursor;
      cam.setRoll(saved.roll);
      if (saved.mode === 'follow' && cam.target) {
        cam.fov(saved.fov);
        cam.follow(cam.target); // same offsets: an eased return to the follow shot, user look kept
      } else if (ease > 0) {
        cam.tween({ pos: saved.pos, look: saved.look, fov: saved.fov }, ease);
      } else cam.set({ pos: saved.pos, look: saved.look, fov: saved.fov });
    },
  };
}

/** A DOM layer for a game under #ui (the HUD's stacking level). remove() takes it out. */
export function layer(ctx, cls, html = '') {
  const root = ctx.ui?.root || document.getElementById('ui');
  const e = document.createElement('div');
  e.className = `ga-layer ${cls}`;
  e.innerHTML = html;
  root.appendChild(e);
  return e;
}

/** Escape text for innerHTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * A script hint ('Viser à la souris · molette : zoom · maintenir le clic…') as setTips() items: split on
 * ' · ', each part with the mouse chip its words call for (clic droit: right, molette: wheel, clic /
 * glisser / maintenir: left, else none).
 */
export function tipsFromHint(hint) {
  if (!hint) return [];
  if (Array.isArray(hint)) return hint;
  return String(hint)
    .split(/\s+·\s+/)
    .map((t) => {
      const l = t.toLowerCase();
      const b = /clic droit|bouton droit/.test(l) ? 'r' : /molette/.test(l) ? 'w' : /clic|glisser|maintenir|cliquer/.test(l) ? 'l' : '';
      return [b, t];
    });
}

/**
 * The games' prompt line: [[button, text], ...] where button is 'l' (left), 'r' (right), 'w' (wheel)
 * or '' (no chip). Fills el (a .ga-tips) only when the content changes.
 */
export function setTips(el, items) {
  const html = (items || [])
    .filter((it) => it && it[1])
    .map(([b, t]) => `<span>${b ? `<i class="ga-mouse ${b}"></i>` : ''}${esc(t)}</span>`)
    .join('');
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}

const CLICK_PX = 7;
const CLICK_MS = 350;

/**
 * Mouse for the R4 games (both buttons, hover, wheel). Like crafts/pointer.js it never takes the
 * pointer lock and accumulates events between frames; call update() once per frame, then read:
 *   x, y (CSS px), ndc (Vector2), inside (over the canvas), down / rdown (held), pressed / released /
 *   click, rpressed / rreleased, dragX / dragY (px moved with the left button held), moveX / moveY
 *   (px moved at all), wheel (notches, + = toward the user), moved (any motion this frame).
 * The context menu is blocked while it lives (right button = hold your breath).
 */
export function gamePointer(ctx) {
  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster();
  const raw = { x: innerWidth / 2, y: innerHeight / 2, down: false, rdown: false, p: 0, r: 0, c: 0, rp: 0, rr: 0, dx: 0, dy: 0, mx: 0, my: 0, wheel: 0, at: null, seen: false };
  const P = {
    x: raw.x,
    y: raw.y,
    ndc: new THREE.Vector2(),
    inside: false,
    down: false,
    rdown: false,
    pressed: false,
    released: false,
    click: false,
    rpressed: false,
    rreleased: false,
    dragX: 0,
    dragY: 0,
    moveX: 0,
    moveY: 0,
    wheel: 0,
    moved: false,
    touched: false, // any input this frame (for idle timers)
    update,
    pick,
    project,
    dispose,
  };
  const ours = (e) => !e.target?.closest?.('button, .choices, .pause, .ui-interactive, .title');
  const onDown = (e) => {
    if (!ours(e)) return;
    raw.x = e.clientX;
    raw.y = e.clientY;
    raw.seen = true;
    if (e.button === 0) {
      raw.down = true;
      raw.p++;
      raw.at = { x: e.clientX, y: e.clientY, t: performance.now(), far: false };
    } else if (e.button === 2) {
      raw.rdown = true;
      raw.rp++;
    }
  };
  const onMove = (e) => {
    raw.mx += e.clientX - raw.x;
    raw.my += e.clientY - raw.y;
    if (raw.down) {
      raw.dx += e.clientX - raw.x;
      raw.dy += e.clientY - raw.y;
      if (raw.at && Math.hypot(e.clientX - raw.at.x, e.clientY - raw.at.y) > CLICK_PX) raw.at.far = true;
    }
    raw.x = e.clientX;
    raw.y = e.clientY;
    raw.seen = true;
  };
  const onUp = (e) => {
    if (e.button === 0 && raw.down) {
      raw.down = false;
      raw.r++;
      const a = raw.at;
      if (a && !a.far && performance.now() - a.t <= CLICK_MS) raw.c++;
      raw.at = null;
    } else if (e.button === 2 && raw.rdown) {
      raw.rdown = false;
      raw.rr++;
    }
  };
  const onWheel = (e) => {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    raw.wheel += px / 100;
  };
  const onMenu = (e) => e.preventDefault();
  const onBlur = () => {
    if (raw.down) raw.r++;
    if (raw.rdown) raw.rr++;
    raw.down = raw.rdown = false;
    raw.at = null;
  };
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('contextmenu', onMenu, true);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function update() {
    P.x = raw.x;
    P.y = raw.y;
    const r = canvas.getBoundingClientRect();
    P.ndc.set(((raw.x - r.left) / Math.max(1, r.width)) * 2 - 1, -((raw.y - r.top) / Math.max(1, r.height)) * 2 + 1);
    P.inside = raw.seen && Math.abs(P.ndc.x) <= 1 && Math.abs(P.ndc.y) <= 1;
    P.pressed = raw.p > 0;
    P.released = raw.r > 0;
    P.click = raw.c > 0;
    P.down = raw.down || (P.pressed && !P.released);
    P.rpressed = raw.rp > 0;
    P.rreleased = raw.rr > 0;
    P.rdown = raw.rdown || (P.rpressed && !P.rreleased);
    P.dragX = raw.dx;
    P.dragY = raw.dy;
    P.moveX = raw.mx;
    P.moveY = raw.my;
    P.moved = raw.mx !== 0 || raw.my !== 0;
    const n = raw.wheel > 0 ? Math.floor(raw.wheel) : Math.ceil(raw.wheel);
    P.wheel = clamp(n, -3, 3);
    const wheeled = raw.wheel !== 0;
    raw.wheel -= n;
    P.touched = P.pressed || P.released || P.rpressed || P.rreleased || P.down || P.rdown || P.moved || wheeled;
    raw.p = raw.r = raw.c = raw.rp = raw.rr = 0;
    raw.dx = raw.dy = raw.mx = raw.my = 0;
    return P;
  }
  function pick(objects, camera = ctx.camera) {
    if (!objects?.length) return null;
    ray.setFromCamera(P.ndc, camera);
    const hit = ray.intersectObjects(objects, true).find((h) => h.object.visible !== false);
    return hit || null;
  }
  /** World point -> CSS px on the canvas (out.z > 1: behind the camera). */
  function project(v, out = new THREE.Vector3(), camera = ctx.camera) {
    out.copy(v).project(camera);
    const r = canvas.getBoundingClientRect();
    const z = out.z;
    out.set(r.left + ((out.x + 1) / 2) * r.width, r.top + ((1 - out.y) / 2) * r.height, z);
    return out;
  }
  function dispose() {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('contextmenu', onMenu, true);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('wheel', onWheel);
  }
  return P;
}

/** Dispose every geometry / material / texture under obj (not shared ones) and detach it. */
export function disposeTree(obj) {
  if (!obj) return;
  obj.removeFromParent();
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap']) if (m[k] && !m[k].userData?.shared) m[k].dispose();
      m.dispose();
    }
  });
}

/** Where the player's eyes are (world), standing or sitting. */
export function eyeOf(ctx, out = new THREE.Vector3(), height = 1.62) {
  ctx.player.root.getWorldPosition(out);
  out.y += height;
  return out;
}

/** A Vector3 from an Object3D (its world position, or its bounding-box centre), an array or a vector. */
export function pointOf(t, out = new THREE.Vector3(), { centre = true } = {}) {
  if (!t) return null;
  if (t.isObject3D) {
    if (centre) {
      const box = new THREE.Box3().setFromObject(t);
      if (!box.isEmpty()) return box.getCenter(out);
    }
    return t.getWorldPosition(out);
  }
  if (Array.isArray(t)) return out.set(t[0], t[1], t[2]);
  if (t.isVector3) return out.copy(t);
  return null;
}

// ------------------------------------------------------------------ procedural cues

/** A small bubble breaking the surface: a quick upward sine blip (bigger = lower). */
export function bloop(audio, { size = 1, volume = 0.1 } = {}) {
  if (!audio?.ok) return;
  const f = (900 + Math.random() * 500) / Math.max(0.5, size);
  audio.tone({ freq: f, to: f * 1.9, dur: 0.06 + 0.03 * size, volume: volume * Math.min(1.4, size), attack: 0.004 });
}

/** A lock cylinder giving: a dry click and a low thunk. */
export function clack(audio, { volume = 0.35 } = {}) {
  if (!audio?.ok) return;
  audio.noise({ type: 'bandpass', freq: 2600, q: 2.5, dur: 0.02, volume, tail: 0.04 });
  audio.tone({ freq: 140, to: 90, dur: 0.12, volume: volume * 0.8, attack: 0.003, delay: 0.015 });
}

/** Keys on a ring knocking together. */
export function jingle(audio, { volume = 0.12, n = 4 } = {}) {
  if (!audio?.ok) return;
  for (let i = 0; i < n; i++) {
    const f = 2400 + Math.random() * 2600;
    audio.tone({ freq: f, to: f * 0.98, dur: 0.09 + Math.random() * 0.08, type: 'triangle', volume: volume * (0.5 + Math.random() * 0.5), attack: 0.002, delay: i * (0.03 + Math.random() * 0.05) });
  }
}

/** A held breath let go: a soft low exhale. gasp: the louder, ragged one. */
export function exhale(audio, { gasp = false, volume = 0.16 } = {}) {
  if (!audio?.ok) return;
  if (gasp) audio.sfx('breath_tired', { volume: volume * 2, fallback: (a) => a.noise({ type: 'lowpass', freq: 900, q: 0.6, dur: 0.5, volume: volume * 1.6, attack: 0.03, tail: 0.25 }) });
  else audio.noise({ type: 'lowpass', freq: 700, q: 0.6, dur: 0.6, volume, attack: 0.12, tail: 0.3 });
}

/** ?debug=1 only: window.__gamesA[id] = obj (live state for tests); returns a remover. */
export function debugHook(ctx, id, obj) {
  if (!ctx.flags?.debug) return () => {};
  const reg = (window.__gamesA ||= {});
  reg[id] = obj;
  return () => {
    if (reg[id] === obj) delete reg[id];
  };
}
