import * as THREE from 'three';
import { L } from '../script.js';
import * as B from '../../world/build.js';
import { makeSteer } from '../minigames.js';
import { craftPointer } from './pointer.js';
import { brushHiss } from './juice.js';

// Sign-writing (docs/DESIGN.md R3.1): single-stroke capitals, a primed board that takes paint, and
// letter(), the steered-brush minigame (Ch4's OPEN, Ch5's KEBAB).

const clamp = THREE.MathUtils.clamp;

const arc = (cx, cy, rx, ry, a0, a1, n) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
};

/**
 * One single-path polyline per capital, in a unit em box: y down, 0 = cap line, 1 = baseline,
 * x from 0 (the advance is the largest x). A stroke may run back over itself (E's arm, K's arm).
 */
export const GLYPHS = Object.freeze({
  O: arc(0.36, 0.5, 0.36, 0.5, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2, 48), // from the top, anticlockwise
  P: [[0, 1], [0, 0], [0.3, 0], ...arc(0.3, 0.26, 0.26, 0.26, -Math.PI / 2, Math.PI / 2, 18), [0, 0.52]],
  E: [[0.56, 0], [0, 0], [0, 0.5], [0.46, 0.5], [0, 0.5], [0, 1], [0.6, 1]],
  N: [[0, 1], [0, 0], [0.66, 1], [0.66, 0]],
  K: [[0, 0], [0, 1], [0, 0.58], [0.6, 0], [0.12, 0.464], [0.62, 1]],
  B: [[0, 1], [0, 0], [0.32, 0], ...arc(0.32, 0.235, 0.235, 0.235, -Math.PI / 2, Math.PI / 2, 14), [0, 0.47], [0.36, 0.47], ...arc(0.36, 0.735, 0.265, 0.265, -Math.PI / 2, Math.PI / 2, 16), [0, 1]],
  A: [[0, 1], [0.34, 0], [0.68, 1], [0.554, 0.63], [0.126, 0.63]],
});

/** Arc-length table for a polyline: {pts, cum, length}. */
function measure(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] };
}

/**
 * Lay a word of GLYPHS into the box {x, y, w, h} (canvas px): cap height h (shrunk to fit w), letters
 * `gap` em apart, centred. Returns one stroke per letter: [{pts, cum, length}] in px.
 */
export function layoutWord(word, { x = 0, y = 0, w = 1024, h = 256, gap = 0.12 } = {}) {
  const glyphs = [...String(word).toUpperCase()].map((ch) => GLYPHS[ch]).filter(Boolean);
  const adv = glyphs.map((g) => Math.max(...g.map((p) => p[0])));
  const total = adv.reduce((a, b) => a + b, 0) + gap * Math.max(0, glyphs.length - 1);
  const s = Math.min(h, w / Math.max(1e-6, total));
  let cx = x + (w - total * s) / 2;
  const cy = y + (h - s) / 2;
  return glyphs.map((g, i) => {
    const pts = g.map(([u, v]) => [cx + u * s, cy + v * s]);
    cx += (adv[i] + gap) * s;
    return measure(pts);
  });
}

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * A primed sign board (w x h m) lettered with `word` in GLYPHS strokes, with chalk guides and an
 * optional faded `ghost` of the same word (a CSS colour) under the primer's grain. Same API as Ch4's
 * OPEN board: {group, face, brush, canvas, size, paths, pointAt, paintTo, lift, setBrush, perfect,
 * guides, update, snapshot, worldAt}. Call update() once a frame (letter() does it while it runs).
 */
export function makeLetterBoard({ w = 0.56, h = 0.36, px = [1024, 512], base = '#e6dcc4', paint = '#a3392b', word = 'OPEN', ghost = null } = {}) {
  const [CW, CH] = px;
  const R = B.rng(word.length * 131 + 7);
  const paintC = canvas(CW, CH);
  const pg = paintC.getContext('2d');
  B.paintNoise(pg, CW, CH, base, 0.035);
  for (let i = 0; i < 120; i++) {
    pg.strokeStyle = R() < 0.5 ? 'rgba(255,252,240,0.08)' : 'rgba(120,100,70,0.05)';
    pg.lineWidth = 1 + R() * 3;
    const y = R() * CH;
    pg.beginPath();
    pg.moveTo(0, y);
    pg.lineTo(CW, y + (R() - 0.5) * 8);
    pg.stroke();
  }
  const margin = CW * 0.08;
  const capH = CH * 0.5;
  const paths = layoutWord(word, { x: margin, y: (CH - capH) / 2, w: CW - margin * 2, h: capH });
  if (ghost) {
    // The old lettering, sun-bleached into the grain: wider, softer, broken up.
    pg.save();
    pg.lineCap = 'round';
    pg.lineJoin = 'round';
    pg.strokeStyle = ghost;
    pg.lineWidth = CH * 0.05;
    for (const p of paths) {
      pg.beginPath();
      p.pts.forEach(([u, v], i) => (i ? pg.lineTo(u + 3, v + 2) : pg.moveTo(u + 3, v + 2)));
      pg.stroke();
    }
    pg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) {
      pg.fillStyle = `rgba(0,0,0,${0.2 + R() * 0.5})`;
      pg.fillRect(R() * CW, R() * CH, 4 + R() * 30, 1 + R() * 3);
    }
    pg.restore();
    // Primer behind what the weather took off.
    pg.save();
    pg.globalCompositeOperation = 'destination-over';
    pg.fillStyle = base;
    pg.fillRect(0, 0, CW, CH);
    pg.restore();
  }
  const edge = pg.createLinearGradient(0, 0, 0, CH);
  edge.addColorStop(0, 'rgba(90,70,40,0.12)');
  edge.addColorStop(0.15, 'rgba(90,70,40,0)');
  edge.addColorStop(0.85, 'rgba(90,70,40,0)');
  edge.addColorStop(1, 'rgba(90,70,40,0.16)');
  pg.fillStyle = edge;
  pg.fillRect(0, 0, CW, CH);

  const pointAt = (path, s) => {
    const { pts, cum, length } = path;
    s = clamp(s, 0, length);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };

  // Chalk guides: cap line, baseline and the dashed strokes.
  const guideC = canvas(CW, CH);
  {
    const g = guideC.getContext('2d');
    const top = (CH - capH) / 2;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.5;
    g.setLineDash([10, 8]);
    for (const y of [top, top + capH]) {
      g.beginPath();
      g.moveTo(margin * 0.6, y);
      g.lineTo(CW - margin * 0.6, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(250,250,250,0.6)';
    g.lineWidth = 3;
    g.setLineDash([7, 6]);
    for (const p of paths) {
      g.beginPath();
      p.pts.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
      g.stroke();
    }
  }

  const display = canvas(CW, CH);
  const dg = display.getContext('2d');
  const tex = new THREE.CanvasTexture(display);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let guides = true;
  let dirty = true;
  const redraw = () => {
    dg.drawImage(paintC, 0, 0);
    if (guides) {
      dg.globalAlpha = 0.55;
      dg.drawImage(guideC, 0, 0);
      dg.globalAlpha = 1;
    }
    tex.needsUpdate = true;
    dirty = false;
  };
  redraw();

  const lw = Math.max(6, CH * 0.018);
  let last = null;
  const seg = (a, b) => {
    // Main body + two thin bristle tracks, slightly offset.
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    pg.lineCap = 'round';
    pg.strokeStyle = paint;
    pg.globalAlpha = 0.93;
    pg.lineWidth = lw;
    pg.beginPath();
    pg.moveTo(a[0], a[1]);
    pg.lineTo(b[0], b[1]);
    pg.stroke();
    pg.globalAlpha = 0.35;
    pg.lineWidth = 1.6;
    pg.strokeStyle = 'rgba(60,20,16,0.9)';
    for (const o of [-lw / 3, lw * 0.29]) {
      pg.beginPath();
      pg.moveTo(a[0] + nx * o, a[1] + ny * o);
      pg.lineTo(b[0] + nx * o, b[1] + ny * o);
      pg.stroke();
    }
    pg.globalAlpha = 1;
    dirty = true;
  };

  const group = new THREE.Group();
  group.name = 'letter-board';
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  face.position.set(0, 0, 0.007);
  face.receiveShadow = true;
  face.name = 'letter-board-face';
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.012), B.mat('#5b4a38', { roughness: 0.85, surface: false }));
  back.castShadow = true;
  group.add(face, back);
  // The liner brush: tip at the origin, handle up and toward the camera.
  const brush = new THREE.Group();
  brush.add(
    new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.018, 8).rotateX(Math.PI).translate(0, 0.009, 0), B.mat('#5a2a20', { roughness: 0.8, surface: false })),
    new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 8).translate(0, 0.027, 0), B.mat('#b9b8b0', { roughness: 0.3, metalness: 0.8, surface: false })),
    new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.005, 0.2, 8).translate(0, 0.136, 0), B.mat('#2c2a28', { roughness: 0.5, surface: false })),
  );
  brush.rotation.set(0.95, 0, -0.55);
  brush.visible = false;
  face.add(brush);

  const toLocal = (u, v, lift = 0) => new THREE.Vector3((u / CW - 0.5) * w, (0.5 - v / CH) * h, 0.002 + lift);

  return {
    group,
    face,
    back,
    brush,
    material,
    canvas: paintC,
    paths,
    pointAt,
    size: [CW, CH],
    paintTo(u, v) {
      const p = [u, v];
      if (last) seg(last, p);
      last = p;
    },
    lift() {
      last = null;
    },
    setBrush(on, u = CW / 2, v = CH / 2, lift = 0) {
      brush.visible = on;
      brush.position.copy(toLocal(u, v, lift));
    },
    guides(on) {
      guides = on;
      dirty = true;
    },
    /** Paint a whole stroke perfectly (skip / fallback). */
    perfect(i) {
      const p = paths[i];
      last = null;
      for (let s = 0; s <= p.length; s += 6) {
        const q = pointAt(p, s);
        if (last) seg(last, q);
        last = q;
      }
      last = null;
    },
    /** A copy of the finished sign (primer + paint, no guides). */
    snapshot() {
      const c = canvas(CW, CH);
      c.getContext('2d').drawImage(paintC, 0, 0);
      return c;
    },
    update() {
      if (dirty) redraw();
    },
    worldAt(u, v) {
      return face.localToWorld(toLocal(u, v));
    },
    dispose() {
      tex.dispose();
    },
  };
}

/**
 * LETTERING: one stroke per path over the chalk guides. The path point advances on its own (`speed`
 * board widths/s); the tip = path point + an offset that drifts (smooth noise, growing over a stroke)
 * and that WASD (or a mouse drag) corrects in screen space, with no momentum. Score = mean |offset|
 * over the word. Idle is fine (bounded drift, scores "middle"); steadying it scores "good"; a skip
 * paints the guides perfectly and returns 0. Brush hiss while the tip moves.
 * opts: {speed = 0.45, kpx = 34 (px per unit offset), lead = 1.1 (s before the first stroke),
 *        gap = 0.7 (s between strokes), steer (makeSteer opts), hint = L.hints.steer, onStroke(i, board)}
 */
export async function letter(ctx, d, board, opts = {}) {
  const {
    speed: widths = 0.45,
    kpx: KPX = 34,
    lead: lead0 = 1.1,
    gap = 0.7,
    steer: steerOpts = { dims: 2, drift: 0.7, driftGrow: 0.2, gain: 0.9, recenter: 0.35 },
    hint = L.hints.steer,
    onStroke,
    brushVolume: brushLoopVolume = 0.08,
  } = opts;
  const { ui, input, audio } = ctx;
  const Bd = board;
  const [CW] = Bd.size;
  const speed = widths * CW; // px/s along the path
  const P = craftPointer(ctx);
  const io = { x: 0, y: 0 };
  let i = 0;
  let s = 0;
  let phase = 'lead';
  let wait = lead0;
  let sum = 0;
  let n = 0;
  let steer = null;
  let tip = null;
  if (hint) ui.prompt(hint);
  // The liner on the board (docs/assets/sfx.md Ch4): brush_wall_loop, gain 0.08 x tip speed and
  // playbackRate 0.9-1.1 with it; silent between strokes. Without the file, the procedural hiss.
  const loop = brushLoopVolume > 0 && audio?.loopSfx && audio.sfxBank?.has('brush_wall_loop') ? audio.loopSfx('brush_wall_loop', { volume: 0, bus: 'fx', fade: 0.05 }) : null;
  const brushSound = (k) => {
    if (!loop) return brushHiss(audio, k);
    const q = clamp(k, 0, 1.3);
    loop.set(brushLoopVolume * q, 0.9 + 0.2 * Math.min(1, q), 0.06);
  };
  const lead = () => {
    loop?.set(0, null, 0.08);
    const [u, v] = Bd.paths[i].pts[0];
    Bd.setBrush(true, u, v, 0.025);
  };
  lead();
  const r = await d.until((dt) => {
    P.update();
    Bd.update();
    if (!(dt > 0)) return false;
    if (phase === 'lead') {
      wait -= dt;
      lead();
      if (wait <= 0) {
        phase = 'draw';
        s = 0;
        tip = null;
        steer = makeSteer({ ...steerOpts, seed: 101 + i * 37 }); // idle lands in the middle tier
        Bd.lift();
      }
      return false;
    }
    // Keys (WASD / arrows) plus a gentle mouse drag (about 250 px/s for a full correction).
    const dn = input.down;
    const kx = (dn.has('KeyD') || dn.has('ArrowRight') ? 1 : 0) - (dn.has('KeyA') || dn.has('ArrowLeft') ? 1 : 0);
    const ky = (dn.has('KeyW') || dn.has('ArrowUp') ? 1 : 0) - (dn.has('KeyS') || dn.has('ArrowDown') ? 1 : 0);
    const mx = P.down ? P.dragX / (250 * dt) : 0;
    const my = P.down ? -P.dragY / (250 * dt) : 0;
    io.x = clamp(kx + mx, -1, 1);
    io.y = clamp(ky + my, -1, 1);
    const path = Bd.paths[i];
    const off = steer.step(dt, io);
    s += speed * dt;
    const [u, v] = Bd.pointAt(path, s);
    const tu = u + off.x * KPX;
    const tv = v - off.y * KPX; // W = up on screen = -v on the canvas
    if (tip) brushSound(Math.hypot(tu - tip[0], tv - tip[1]) / Math.max(1e-6, speed * dt));
    tip = [tu, tv];
    Bd.paintTo(tu, tv);
    Bd.setBrush(true, tu, tv, 0);
    sum += off.length();
    n++;
    if (s >= path.length) {
      Bd.lift();
      try {
        onStroke?.(i, Bd);
      } catch (err) {
        console.error('[letters] onStroke failed', err);
      }
      i++;
      if (i >= Bd.paths.length) return true;
      phase = 'lead';
      wait = gap;
    }
    return false;
  });
  P.dispose();
  loop?.stop(0.12);
  if (hint) ui.prompt(null);
  if (r === 'skipped') for (let k = i; k < Bd.paths.length; k++) Bd.perfect(k);
  Bd.lift();
  Bd.setBrush(false);
  Bd.update();
  return n > 0 && r !== 'skipped' ? sum / n : 0;
}
