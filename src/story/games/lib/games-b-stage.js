import './games-b-stage.css';

// Shared stage for the GAMES-B minigames (croissant, kebab, stencil, deduction; docs/DESIGN-R4.md
// "New minigames"): a full-screen 2D layer under ctx.ui.root, a pointer read once per frame, the
// camera and hotspots held while it runs, and everything put back on close().
//
// The layer sits under the HUD (z 9), so ui.prompt / ui.hint / ui.thought still draw on top of it;
// the games keep their art clear of the bottom ~30% of the screen, where those lines land.
// Drawing is in a fixed design space (1600 x 900), letterboxed into the window and DPR-aware.

export const DESIGN_W = 1600;
export const DESIGN_H = 900;
/** Interactive art stays above this line (design px): the prompt and the barks live below it. */
export const SAFE_BOTTOM = 620;

export const HAND = "'Bradley Hand', 'Segoe Print', 'Noteworthy', 'Comic Neue', cursive";
export const SANS = "system-ui, -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif";
export const INK = { paper: '#d9d3c2', pencil: '#3b3a36', red: '#a3392b', ochre: '#d9a441' };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);

/** A line from a bag: a string, an array (random pick, never the same twice running), or null. */
export function pickLine(bag, memo) {
  if (!bag) return null;
  if (!Array.isArray(bag)) return bag;
  if (!bag.length) return null;
  let i = (Math.random() * bag.length) | 0;
  if (memo && bag.length > 1 && memo.last === bag[i]) i = (i + 1) % bag.length;
  if (memo) memo.last = bag[i];
  return bag[i];
}

/** Deep-merge the writer's text (opts) over a module's French fallbacks. Arrays and strings replace. */
export function mergeText(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && v && typeof v === 'object' && !Array.isArray(v) ? mergeText(base[k], v) : v;
  }
  return out;
}

/**
 * A game's text: the module's French fallbacks, under the top-level opts, under opts.text (the chapter's
 * L.games.<id>). `extras` are dotted paths of lines the module adds that the script doesn't have: once
 * opts.text is given they go quiet unless it has them too, so an unvoiced bark never lands between
 * voiced ones.
 */
export function gameText(fallback, opts = {}, extras = []) {
  const given = opts.text && typeof opts.text === 'object' ? opts.text : null;
  const T = mergeText(mergeText(structuredClone(fallback), opts), given || {});
  if (given) {
    for (const path of extras) {
      const keys = path.split('.');
      let src = given;
      for (const k of keys) src = src && typeof src === 'object' ? src[k] : undefined;
      if (src !== undefined) continue;
      let dst = T;
      for (const k of keys.slice(0, -1)) dst = dst && typeof dst === 'object' ? dst[k] : null;
      if (dst && typeof dst === 'object') dst[keys[keys.length - 1]] = null;
    }
  }
  return T;
}

/** Fill {n}, {count}... in a UI line. */
export const fill = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

/** The STRIDE watch buzz (ui.watchBuzz), then an optional reply line after `delay` seconds. Non-blocking. */
export function strideBuzz(S, text, { reply = null, who = null, delay = 2.6, secs = 3 } = {}) {
  if (!text) return;
  S.ui?.watchBuzz?.(text, secs);
  if (reply) setTimeout(() => !S.closed && S.say(who, reply, 3), delay * 1000);
}

const mkCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
};
export { mkCanvas as canvas };

/** Seeded PRNG (mulberry32), same as world/build.js rng() but local so the lib has no three.js import. */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grain over a filled area of `g` (canvas px): per-pixel noise of +-spread (0..1). */
export function grain(g, w, h, spread = 0.05, seed = 3) {
  const R = rng(seed);
  const img = g.getImageData(0, 0, w, h);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (R() - 0.5) * 2 * spread * 255;
    p[i] += n;
    p[i + 1] += n;
    p[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** Wrap `text` to `maxW` (current g.font). Returns lines (cached by the caller if it draws per frame). */
export function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const t = line ? `${line} ${word}` : word;
      if (line && g.measureText(t).width > maxW) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Strip the *emphasis* markers the UI renders, for text drawn on a canvas. */
export const plain = (s) => String(s ?? '').replace(/\*/g, '');

/** A ghost hand (the idle assist's cursor): a soft fingertip with a pencil ring. */
export function drawGhost(g, x, y, down = false, a = 1) {
  g.save();
  g.globalAlpha = 0.85 * a;
  g.translate(x, y);
  g.fillStyle = 'rgba(255, 250, 238, 0.55)';
  g.strokeStyle = 'rgba(59, 58, 54, 0.75)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, down ? 13 : 16, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.setLineDash([3, 5]);
  g.beginPath();
  g.arc(0, 0, down ? 22 : 28, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/**
 * Open the stage. opts: { cls (extra class on the layer), cursor ('crosshair'...) }.
 * Returns S:
 *   ui                      ctx.ui
 *   layer, canvas, g        the DOM layer (pointer events on), its full-screen canvas and 2D context
 *   W, H, scale, ox, oy     window size (css px) and the design-space fit (design px * scale + offset)
 *   ptr                     { x, y (design px), down, pressed, released, moved, idle (s since the last
 *                             real input), speed (design px/s, smoothed) } - read after S.frame()
 *   frame(raw)              call first in every d.until frame; updates ptr; returns ptr
 *   flush()                 forget input queued while no frame loop ran (after a d.say between loops)
 *   resetIdle()             restart ptr.idle (a new step: its assist waits the full time again)
 *   begin()                 g transform = design space (and clears); draw after it
 *   onResize(fn)            fn() after a window resize (rebuild cached art)
 *   say(who, text, secs)    a bark (ui.thought with a speaker; no `who` = Hugo's inner line)
 *   sfx(name, opts, fb)     audio.sfx with a procedural fallback fn(audio) (or none)
 *   toDesign(cx, cy)        client px to design px (into a reused object)
 *   close()                 restores state, frozen, prompt, pointer lock; removes the layer (faded)
 */
export function openStage(ctx, d, { cls = '', cursor = 'default' } = {}) {
  const { ui, player } = ctx;
  const root = ui?.root || document.getElementById('ui') || document.body;
  const layer = document.createElement('div');
  layer.className = `gb-layer ${cls}`.trim();
  const canvas = document.createElement('canvas');
  canvas.className = 'gb-canvas';
  layer.appendChild(canvas);
  root.appendChild(layer);
  layer.style.cursor = cursor;
  const g = canvas.getContext('2d');

  // Hold the world: 'cutscene' keeps the camera rig off the mouse and the hotspots quiet (CameraRig
  // freeRoam() is false), and the player still. A game started from inside a cinematic keeps it.
  const prev = { state: d.state, frozen: player?.frozen };
  if (d.state === 'play') d.state = 'cutscene';
  if (player) player.frozen = true;
  if (document.pointerLockElement) document.exitPointerLock?.();

  const S = {
    ui,
    layer,
    canvas,
    g,
    W: 0,
    H: 0,
    dpr: 1,
    scale: 1,
    ox: 0,
    oy: 0,
    ptr: { x: DESIGN_W / 2, y: DESIGN_H / 2, down: false, pressed: false, released: false, moved: false, idle: 0, speed: 0, t: 0 },
    closed: false,
  };
  const resizers = [];
  const fit = () => {
    S.W = window.innerWidth;
    S.H = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(S.W * S.dpr);
    canvas.height = Math.round(S.H * S.dpr);
    S.scale = Math.min(S.W / DESIGN_W, S.H / DESIGN_H);
    S.ox = (S.W - DESIGN_W * S.scale) / 2;
    S.oy = (S.H - DESIGN_H * S.scale) / 2;
    for (const fn of resizers) fn();
  };
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  fit();

  // Pointer: events accumulate between frames, so a quick tap is never lost.
  const raw = { x: S.ptr.x, y: S.ptr.y, down: false, presses: 0, releases: 0, moved: false };
  const pt = { x: 0, y: 0 };
  S.toDesign = (cx, cy) => {
    pt.x = (cx - S.ox) / S.scale;
    pt.y = (cy - S.oy) / S.scale;
    return pt;
  };
  const at = (e) => {
    S.toDesign(e.clientX, e.clientY);
    raw.x = pt.x;
    raw.y = pt.y;
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    at(e);
    raw.down = true;
    raw.presses++;
    raw.moved = true;
    try {
      layer.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic event */
    }
    e.preventDefault();
  };
  const onMove = (e) => {
    at(e);
    raw.moved = true;
  };
  const onUp = (e) => {
    if (e.button !== 0 || !raw.down) return;
    at(e);
    raw.down = false;
    raw.releases++;
  };
  const onBlur = () => {
    if (raw.down) raw.releases++;
    raw.down = false;
  };
  layer.addEventListener('pointerdown', onDown);
  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerup', onUp);
  layer.addEventListener('pointercancel', onUp);
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', onBlur);

  let lastX = S.ptr.x;
  let lastY = S.ptr.y;
  S.frame = (rawDt) => {
    const P = S.ptr;
    const dt = Math.max(1e-3, rawDt || 0.016);
    P.t += dt;
    P.pressed = raw.presses > 0;
    P.released = raw.releases > 0;
    P.down = raw.down || (P.pressed && !P.released);
    P.moved = raw.moved;
    P.x = raw.x;
    P.y = raw.y;
    const v = Math.hypot(P.x - lastX, P.y - lastY) / dt;
    P.speed += (v - P.speed) * (1 - Math.exp(-14 * dt));
    P.vx = (P.x - lastX) / dt;
    P.vy = (P.y - lastY) / dt;
    lastX = P.x;
    lastY = P.y;
    P.idle = P.pressed || P.down || raw.moved ? 0 : P.idle + dt;
    raw.presses = raw.releases = 0;
    raw.moved = false;
    return P;
  };
  /** Drop input that arrived while the game wasn't reading it (a dialogue click between frame loops). */
  S.flush = () => {
    raw.presses = raw.releases = 0;
    raw.moved = false;
    raw.down = false;
    S.ptr.idle = 0;
  };
  /** Restart the idle clock (a new step begins: the assist waits its full time again). */
  S.resetIdle = () => (S.ptr.idle = 0);
  S.begin = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const k = S.scale * S.dpr;
    g.setTransform(k, 0, 0, k, S.ox * S.dpr, S.oy * S.dpr);
  };
  /** Fill the whole window (outside the design box too) with a backdrop, in design space. */
  S.fillAll = (style) => {
    g.fillStyle = style;
    g.fillRect(-S.ox / S.scale - 2, -S.oy / S.scale - 2, S.W / S.scale + 4, S.H / S.scale + 4);
  };
  /** The window's edges in design px (the art may bleed out to them). */
  S.bounds = () => ({ x0: -S.ox / S.scale, y0: -S.oy / S.scale, x1: (S.W - S.ox) / S.scale, y1: (S.H - S.oy) / S.scale });
  S.onResize = (fn) => resizers.push(fn);
  S.say = (who, text, secs = 3.2) => (text ? ui?.thought(text, secs, who ? { who } : {}) : null);
  S.sfx = (name, opts = {}, fb) => {
    const a = ctx.audio;
    if (!a) return null;
    if (!a.sfx) return fb ? fb(a) : null;
    return a.sfx(name, { ...opts, fallback: fb ? (au) => fb(au) : false });
  };
  requestAnimationFrame(() => layer.classList.add('show'));

  S.close = () => {
    if (S.closed) return;
    S.closed = true;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('blur', onBlur);
    layer.removeEventListener('pointerdown', onDown);
    layer.removeEventListener('pointermove', onMove);
    layer.removeEventListener('pointerup', onUp);
    layer.removeEventListener('pointercancel', onUp);
    ui?.prompt(null);
    if (player) player.frozen = prev.frozen;
    // Only hand 'play' back if nothing else changed the state while the game ran.
    if (d.state === 'cutscene' && prev.state === 'play') d.state = 'play';
    layer.classList.remove('show');
    layer.style.pointerEvents = 'none';
    setTimeout(() => layer.remove(), 420);
  };
  return S;
}

/** Cache an offscreen canvas at window resolution, rebuilt on resize: draw(g) runs in design space. */
export function cachedLayer(S, draw) {
  const c = document.createElement('canvas');
  const cg = c.getContext('2d');
  const build = () => {
    c.width = S.canvas.width;
    c.height = S.canvas.height;
    const k = S.scale * S.dpr;
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.clearRect(0, 0, c.width, c.height);
    cg.setTransform(k, 0, 0, k, S.ox * S.dpr, S.oy * S.dpr);
    draw(cg);
  };
  build();
  S.onResize(build);
  return {
    canvas: c,
    rebuild: build,
    /** Blit in device space (call right after S.begin()). */
    blit(g) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(c, 0, 0);
      g.restore();
    },
  };
}

/** The dark band at the bottom of the window, so the prompt and the barks stay readable on any art. */
export function bottomShade(S, from = SAFE_BOTTOM - 20, a = 0.82) {
  const { g } = S;
  const b = S.bounds();
  const gr = g.createLinearGradient(0, from, 0, b.y1);
  gr.addColorStop(0, 'rgba(12, 10, 8, 0)');
  gr.addColorStop(0.35, `rgba(12, 10, 8, ${a * 0.7})`);
  gr.addColorStop(1, `rgba(12, 10, 8, ${a})`);
  g.fillStyle = gr;
  g.fillRect(b.x0 - 2, from, b.x1 - b.x0 + 4, b.y1 - from + 2);
}
