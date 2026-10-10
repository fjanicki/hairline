import * as THREE from 'three';
import { takeStage, layer, gamePointer, texts, say, bag, setTips, tipsFromHint, clamp, damp, frNum, eyeOf, pointOf, disposeTree, esc, debugHook } from './lib/games-a-kit.js';
import './photo.css';

// PHOTO (docs/DESIGN-R4.md "New minigames", Ch5 clue photos): Hugo's phone over the live scene. The
// mouse aims inside a small cone, the wheel zooms, holding the left button is the half-press (a short
// focus pull) and letting go fires the shutter. The print slides in: the real rendered frame. Scored
// on framing (the clue in the inner box, the right size, in focus). Three shots, then the phone frames it
// itself (docs/SCRIPT-R4.md §6.5.1: the auto-shot counts as good); left alone 15 s, the same.
//
//   await playGame('photo', ctx, d, {
//     target,               // THREE.Object3D (its bounding-box centre) or a world point [x, y, z]
//     radius,               // the clue's size in metres (default: from the object's bounds, else 0.25)
//     from,                 // camera position (default: Hugo's eyes, a step toward the target)
//     cone = [16, 10],      // aim limit (degrees, yaw / pitch) around the opening direction
//     size = [0.2, 0.62],   // good size: the clue's radius as a share of the frame's half-height
//     shots = 3, idle = 15, // tries before the auto-frame; seconds without input before it
//     caption,              // pencilled on the print (default text.caption)
//     who,                  // speaker for the feedback lines (default: Hugo's inner voice)
//     text,                 // L.games.photo: { hint, gauge, focus: { sharp, soft }, counter, label, caption,
//                           //   blurry[], offFrame[], tooFar[], tooClose[], assist (a stage line) }
//   })  -> { tier ('good' for a good shot or the auto-shot; 'middle'/'poor' never come from the auto-shot),
//            own (the player's best shot: 'good'|'middle'|'poor'|null), image (the print, a small JPEG
//            data URL), photo (the frame alone), shots, assisted, skipped, best: { framed, size, focus } }
// The success line is the chapter's (a blocking think after the game), so the game says nothing on a good shot.

export const id = 'photo';

// French fallbacks, used only when the chapter passes nothing (the writer's text replaces them).
// (The script's own lines, docs/SCRIPT-R4.md §6.5.1, so a chapter that passes nothing still reads right.)
const FALLBACK = {
  hint: 'Viser à la souris · molette : zoom · maintenir le clic pour la mise au point, relâcher pour prendre la photo',
  gauge: 'NETTETÉ',
  focus: { sharp: 'NET', soft: 'FLOU' },
  counter: 'Photo {n}/3',
  label: 'PHOTO',
  caption: 'Pièce à conviction',
  blurry: ['Floue. J’ai bougé. Je ne bouge jamais, d’habitude.', 'Floue. Le téléphone a fait la mise au point sur mon pouce.'],
  offFrame: ['Superbe photo du trottoir.', 'J’ai photographié le ciel. Il n’a rien huilé, lui.'],
  tooFar: ['On voit la rue. On ne voit pas l’indice. On voit surtout la rue.'],
  tooClose: ['Trop près. Ça pourrait être n’importe quoi. Un genou.'],
  assist: 'Le téléphone fait la mise au point tout seul. Il a l’air soulagé.',
};
const WHY = { blur: 'blurry', off: 'offFrame', far: 'tooFar', close: 'tooClose' };

const DEG = Math.PI / 180;
const TIERS = ['poor', 'middle', 'good'];
const PRINT = { w: 280, h: 330, pad: 16, photoH: 210 };

export async function play(ctx, d, opts = {}) {
  const { engine, audio, cam, camera } = ctx;
  const T = texts(FALLBACK, opts.text);
  const canvas = ctx.renderer.domElement;

  // The clue: the chapter's, or a placeholder (test mode) a few metres ahead of Hugo.
  let placeholder = null;
  let target = opts.target;
  if (!target) {
    placeholder = makePlaceholder(ctx);
    target = placeholder;
  }
  const at = pointOf(target, new THREE.Vector3());
  let radius = opts.radius;
  if (!radius && target.isObject3D) {
    const s = new THREE.Box3().setFromObject(target).getBoundingSphere(new THREE.Sphere());
    radius = clamp(s.radius * 0.8, 0.05, 3);
  }
  radius = radius || 0.25;
  const [coneYaw, conePitch] = (opts.cone || [16, 10]).map((v) => v * DEG);
  const [sizeMin, sizeMax] = opts.size || [0.2, 0.62];
  const maxShots = opts.shots ?? 3;
  const idleAfter = opts.idle ?? 15;
  const caption = opts.caption ?? T.caption;
  const lineFor = Object.fromEntries(Object.values(WHY).map((k) => [k, bag(Array.isArray(T[k]) ? T[k] : [T[k]])]));
  const who = opts.who;

  // The eye: Hugo's, a step toward the clue so his own head never fills the frame.
  const eye = opts.from ? pointOf(opts.from, new THREE.Vector3(), { centre: false }) : eyeOf(ctx);
  if (!opts.from) {
    const step = new THREE.Vector3(at.x - eye.x, 0, at.z - eye.z);
    if (step.lengthSq() > 1e-4) eye.addScaledVector(step.normalize(), 0.25);
  }
  const toClue = at.clone().sub(eye);
  const dist = toClue.length();
  const clueYaw = Math.atan2(toClue.x, toClue.z);
  const cluePitch = Math.asin(clamp(toClue.y / Math.max(1e-6, dist), -1, 1));
  // The opening direction is off the clue a little, so the player has to look for it.
  const side = Math.random() < 0.5 ? -1 : 1;
  const baseYaw = clueYaw + side * coneYaw * 0.45;
  const basePitch = cluePitch + conePitch * 0.3;
  const fovMax = opts.fovMax ?? 50;
  const fovMin = opts.fovMin ?? 14;

  const stage = takeStage(ctx, d, { hidePlayer: opts.hidePlayer ?? true });
  const P = gamePointer(ctx);
  canvas.style.cursor = 'none';
  const prevFilter = canvas.style.filter;

  // ---------------------------------------------------------------- the viewfinder (DOM)
  const L = layer(
    ctx,
    'ga-photo',
    `<div class="ph-dim"></div>
     <div class="ph-phone"><div class="ph-screen">
       <div class="ph-grid"></div>
       <div class="ph-box"><i></i><i></i><i></i><i></i></div>
       <div class="ph-reticle"></div>
       <div class="ph-label">${esc(T.label)}</div>
       <div class="ph-side"><div class="ph-zoom">1×</div><div class="ph-shutter"></div><div class="ph-shots"></div><div class="ph-count"></div></div>
       <div class="ga-meter ph-meter"><div class="ga-label">${esc(T.gauge)}</div><div class="ga-track"><div class="ga-fill"></div></div><div class="ph-sharp"></div></div>
       <div class="ph-flash"></div>
     </div></div>
     <div class="ph-prints"></div>
     <div class="ga-tips"></div>`,
  );
  const el = (s) => L.querySelector(s);
  const screenEl = el('.ph-screen');
  const reticle = el('.ph-reticle');
  const zoomEl = el('.ph-zoom');
  const shotsEl = el('.ph-shots');
  const flashEl = el('.ph-flash');
  const printsEl = el('.ph-prints');
  const shutterEl = el('.ph-shutter');
  setTips(el('.ga-tips'), tipsFromHint(T.hint));
  const countEl = el('.ph-count');
  const meterEl = el('.ph-meter');
  const meterFill = meterEl.querySelector('.ga-fill');
  const sharpEl = el('.ph-sharp');
  const drawShots = (left) => {
    shotsEl.innerHTML = Array.from({ length: maxShots }, (_, i) => `<i class="${i < left ? '' : 'used'}"></i>`).join('');
    countEl.textContent = String(T.counter || '').replace('{n}', String(Math.min(maxShots, maxShots - left + 1)));
  };
  drawShots(maxShots);
  requestAnimationFrame(() => L.classList.add('show'));

  // ---------------------------------------------------------------- state
  const s = {
    t: 0,
    idle: 0,
    yaw: baseYaw,
    pitch: basePitch,
    fov: fovMax,
    fovShown: fovMax,
    focus: 0, // 0 soft .. 1 sharp
    pull: -1, // seconds into a focus pull, -1 = none
    lockYaw: 0,
    lockPitch: 0,
    lockFov: 0,
    shots: 0,
    best: null,
    bestPrint: null,
    phase: 'aim', // aim | auto | print | done
    phaseT: 0,
    assisted: false,
    autoReason: null,
    moved: false,
  };
  const dir = new THREE.Vector3();
  const look = new THREE.Vector3();
  const proj = new THREE.Vector3();
  let aimYaw = baseYaw;
  let aimPitch = basePitch;
  let autoFrom = null;
  const n1 = noise(7);
  const n2 = noise(31);
  // Tests: where the clue sits on the mouse's map (window NDC), and the live state.
  const unhook = debugHook(ctx, id, { s, clueNdc: () => ({ x: (baseYaw - clueYaw) / coneYaw, y: (cluePitch - basePitch) / conePitch }), measure: () => measure() });

  const applyCam = () => {
    // Hand tremor: steadier while the button is held (braced for the shot).
    const amp = (P.down ? 0.12 : 0.32) * DEG * (s.phase === 'auto' ? 0.3 : 1);
    const y = s.yaw + amp * n1(s.t);
    const p = s.pitch + amp * n2(s.t);
    dir.set(Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y));
    look.copy(eye).addScaledVector(dir, 10);
    cam.set({ pos: eye, look, fov: s.fovShown });
  };

  /** The clue in the viewfinder: centre (viewfinder NDC), size (radius / half-height), visible. */
  const measure = () => {
    const vf = screenEl.getBoundingClientRect();
    const cv = canvas.getBoundingClientRect();
    proj.copy(at).project(camera);
    const sx = cv.width / Math.max(1, vf.width);
    const sy = cv.height / Math.max(1, vf.height);
    const x = proj.x * sx;
    const y = proj.y * sy;
    const d2 = camera.position.distanceTo(at);
    const size = (radius / Math.max(1e-3, d2 * Math.tan((camera.fov * DEG) / 2))) * sy;
    return { x, y, size, front: proj.z < 1 };
  };
  const grade = (m, focus) => {
    const framed = m.front && Math.abs(m.x) <= 0.46 && Math.abs(m.y) <= 0.52;
    const sized = m.size >= sizeMin && m.size <= sizeMax;
    const sharp = focus >= 0.8;
    const score = (framed ? 1 : 0) + (sized && framed ? 1 : 0) + (sharp ? 1 : 0);
    const tier = score >= 3 ? 'good' : score >= 2 ? 'middle' : 'poor';
    let why = 'good';
    if (!m.front || Math.abs(m.x) > 1 || Math.abs(m.y) > 1) why = 'off';
    else if (!framed) why = 'off';
    else if (m.size < sizeMin) why = 'far';
    else if (m.size > sizeMax) why = 'close';
    else if (!sharp) why = 'blur';
    return { tier, framed, sized, sharp, why, size: m.size };
  };

  // ---------------------------------------------------------------- capture + print
  const shutter = (auto) => {
    if (!auto) s.shots++;
    audio.sfx('camera_shutter', { volume: 0.45, fallback: (a) => a.tick({ volume: 0.35 }) });
    retick(flashEl, 'go');
    retick(shutterEl, 'go');
    const g = grade(measure(), s.focus);
    const photo = capture(ctx, screenEl, s.focus);
    const item = { g, photo: photo.url, print: drawPrint(photo.canvas, caption, g), auto };
    // The player's best shot keeps the grade; the auto-frame's picture is the one the case keeps.
    if (auto) s.autoShot = item;
    else if (!s.best || TIERS.indexOf(g.tier) > TIERS.indexOf(s.best.g.tier)) s.best = item;
    showPrint(printsEl, item.print, s.shots + (auto ? 1 : 0));
    drawShots(maxShots - s.shots);
    return item;
  };

  // ---------------------------------------------------------------- the loop
  const r = await d.until((dt) => {
    const raw = engine.rawDt || dt;
    s.t += raw;
    s.phaseT += raw;
    P.update();
    if (P.touched) s.idle = 0;
    else s.idle += raw;

    if (s.phase === 'aim') {
      // Aim: the mouse over the window maps onto the cone (the centre of the window = straight ahead).
      if (P.inside && (P.moved || s.moved)) {
        s.moved = true;
        aimYaw = baseYaw - P.ndc.x * coneYaw;
        aimPitch = basePitch + P.ndc.y * conePitch;
      }
      if (P.wheel) s.fov = clamp(s.fov * Math.pow(1.14, P.wheel), fovMin, fovMax);
      // Half-press: a short focus pull, then locked while held (unless the shot changes a lot).
      if (P.pressed) {
        s.pull = 0;
        audio.tone({ freq: 2100, dur: 0.035, volume: 0.035, attack: 0.003 });
      }
      if (P.down && s.pull >= 0) {
        s.pull += raw;
        s.focus = pullCurve(s.pull);
        if (s.pull >= 0.5 && s.lockFov === 0) {
          s.lockFov = s.fov;
          s.lockYaw = s.yaw;
          s.lockPitch = s.pitch;
          audio.tone({ freq: 2600, dur: 0.04, volume: 0.05, attack: 0.003 });
          audio.tone({ freq: 2600, dur: 0.04, volume: 0.05, attack: 0.003, delay: 0.09 });
        }
        if (s.lockFov && (Math.abs(s.fov - s.lockFov) > 2.5 || Math.hypot(s.yaw - s.lockYaw, s.pitch - s.lockPitch) > 3 * DEG)) {
          // Moved off the subject: the lens hunts again.
          s.pull = 0;
          s.lockFov = 0;
        }
      } else if (!P.down) s.focus = damp(s.focus, 0, 1.2, raw);
      if (P.released && s.shots < maxShots) {
        const shot = shutter(false);
        s.pull = -1;
        s.lockFov = 0;
        if (shot.g.tier !== 'good') say(ctx, lineFor[WHY[shot.g.why]]?.(), 2.8, who);
        s.phase = 'print';
        s.phaseT = 0;
        s.next = shot.g.tier === 'good' ? 'done' : s.shots >= maxShots ? 'auto' : 'aim';
        if (s.next === 'auto') s.autoReason = 'shots';
      }
      if (s.idle >= idleAfter && s.phase === 'aim') {
        s.phase = 'auto';
        s.phaseT = 0;
        s.autoReason = 'idle';
      }
      if (s.phase === 'auto') autoFrom = null;
    } else if (s.phase === 'print') {
      s.focus = damp(s.focus, 0, 1.5, raw);
      if (s.phaseT >= (s.next === 'done' ? 2.2 : 1.6)) {
        s.phase = s.next;
        s.phaseT = 0;
        if (s.phase === 'auto') autoFrom = null;
      }
    } else if (s.phase === 'auto') {
      // Hugo does it: centre the clue, zoom to fit, pull focus, shoot.
      if (!autoFrom) {
        autoFrom = { yaw: aimYaw, pitch: aimPitch, fov: s.fov };
        s.assisted = true;
        say(ctx, T.assist, 2.6); // a stage line: no speaker
      }
      const k = Math.min(1, s.phaseT / 1.3);
      const e = k * k * (3 - 2 * k);
      const want = clamp((2 * Math.atan(radius / (dist * 0.3))) / DEG, fovMin, fovMax);
      aimYaw = autoFrom.yaw + (clueYaw - autoFrom.yaw) * e;
      aimPitch = autoFrom.pitch + (cluePitch - autoFrom.pitch) * e;
      s.fov = autoFrom.fov + (want - autoFrom.fov) * e;
      if (s.phaseT >= 1.3) s.focus = pullCurve(s.phaseT - 1.3);
      if (s.phaseT >= 1.85 && !s.autoShot) {
        s.focus = 1;
        shutter(true);
        s.phase = 'print';
        s.phaseT = 0;
        s.next = 'done';
      }
    } else if (s.phase === 'done') return true;

    // Ease the aim and the zoom; the frame follows.
    s.yaw = damp(s.yaw, aimYaw, s.phase === 'auto' ? 30 : 11, raw);
    s.pitch = damp(s.pitch, aimPitch, s.phase === 'auto' ? 30 : 11, raw);
    s.fovShown = damp(s.fovShown, s.fov, 12, raw);
    applyCam();
    // Depth of field, the cheap way: the whole canvas softens until the lens has found the subject.
    const blur = (1 - s.focus) * 2.4;
    const f = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
    if (f !== s.filter) {
      s.filter = f;
      canvas.style.filter = f;
    }
    // The sharpness gauge, while the lens works (half-press or the auto-frame).
    const showMeter = (P.down && s.pull >= 0) || (s.phase === 'auto' && s.phaseT >= 1.2) || (s.phase === 'print' && s.phaseT < 0.6);
    meterEl.classList.toggle('on', showMeter);
    if (showMeter) {
      meterFill.style.width = `${Math.round(s.focus * 100)}%`;
      const word = s.focus >= 0.8 ? T.focus.sharp : T.focus.soft;
      if (sharpEl.textContent !== word) sharpEl.textContent = word;
      sharpEl.classList.toggle('sharp', s.focus >= 0.8);
    }
    reticle.classList.toggle('pulling', s.pull >= 0 && s.focus < 0.95 && P.down);
    reticle.classList.toggle('locked', s.focus >= 0.95 && (P.down || s.phase === 'auto'));
    const zoom = frNum(fovMax / s.fovShown) + '×';
    if (zoom !== s.zoomText) {
      s.zoomText = zoom;
      zoomEl.textContent = zoom;
    }
    return false;
  });

  // ---------------------------------------------------------------- end
  const skipped = r === 'skipped';
  if (skipped && !s.best && !s.autoShot) {
    // Skipped: the auto-frame, at once, so the case still gets its photo.
    aimYaw = s.yaw = clueYaw;
    aimPitch = s.pitch = cluePitch;
    s.fov = s.fovShown = clamp((2 * Math.atan(radius / (dist * 0.3))) / DEG, fovMin, fovMax);
    s.focus = 1;
    applyCam();
    shutter(true);
  }
  P.dispose();
  unhook();
  canvas.style.filter = prevFilter;
  L.classList.remove('show');
  setTimeout(() => L.remove(), 400);
  stage.restore();
  if (placeholder) disposeTree(placeholder);
  const best = s.best;
  const shown = s.autoShot || best;
  // The auto-shot (three tries, idle, skip) counts as good (SCRIPT-R4 §6.5.1); `own` keeps the player's best.
  const tier = s.autoShot ? 'good' : best ? best.g.tier : 'good';
  return {
    tier,
    own: best ? best.g.tier : null,
    image: shown?.print || null,
    photo: shown?.photo || null,
    shots: s.shots,
    assisted: s.assisted,
    skipped,
    best: best ? { framed: best.g.framed, size: +best.g.size.toFixed(2), focus: best.g.sharp } : null,
  };
}

// ------------------------------------------------------------------ helpers

/** A focus pull: the lens overshoots, comes back, settles (0 -> 1 over ~0.5 s). */
function pullCurve(t) {
  if (t <= 0) return 0;
  if (t < 0.18) return (t / 0.18) * 0.85;
  if (t < 0.3) return 0.85 - ((t - 0.18) / 0.12) * 0.35;
  if (t < 0.5) return 0.5 + ((t - 0.3) / 0.2) * 0.5;
  return 1;
}

/** Smooth noise in [-1, 1] (a few incommensurate sines). */
function noise(seed) {
  const f = [0.7, 1.13, 1.91].map((k, i) => k * (1 + ((seed * (i + 3)) % 7) / 40));
  const p = f.map((_, i) => (seed * 1.7 + i * 2.1) % 6.28);
  return (t) => 0.55 * Math.sin(t * f[0] * 6.28 + p[0]) + 0.3 * Math.sin(t * f[1] * 6.28 + p[1]) + 0.15 * Math.sin(t * f[2] * 6.28 + p[2]);
}

function retick(e, cls) {
  e.classList.remove(cls);
  void e.offsetWidth;
  e.classList.add(cls);
}

/** Copy the viewfinder's part of the rendered frame into a small canvas (blurred if out of focus). */
function capture(ctx, screenEl, focus) {
  const src = ctx.renderer.domElement;
  // A fresh frame, read in the same task: the drawing buffer is only valid until the browser composites.
  ctx.engine.post.render(0);
  const vf = screenEl.getBoundingClientRect();
  const cv = src.getBoundingClientRect();
  const kx = src.width / Math.max(1, cv.width);
  const ky = src.height / Math.max(1, cv.height);
  const out = document.createElement('canvas');
  out.width = PRINT.w - PRINT.pad * 2;
  out.height = PRINT.photoH;
  const g = out.getContext('2d');
  const blur = (1 - focus) * 2.2;
  if (blur > 0.1) g.filter = `blur(${blur.toFixed(1)}px)`;
  // Cover-fit the viewfinder rect into the print's window.
  // The middle 88% of the viewfinder: the print reads at a glance, the way phones crop a print.
  const sw = vf.width * kx * 0.88;
  const sh = vf.height * ky * 0.88;
  const want = out.width / out.height;
  let cw = sw;
  let ch = sw / want;
  if (ch > sh) {
    ch = sh;
    cw = sh * want;
  }
  const sx = (vf.left - cv.left + vf.width / 2) * kx - cw / 2;
  const sy = (vf.top - cv.top + vf.height / 2) * ky - ch / 2;
  try {
    g.drawImage(src, sx, sy, cw, ch, 0, 0, out.width, out.height);
  } catch (err) {
    console.warn('[photo] capture failed', err);
  }
  g.filter = 'none';
  // A phone print on a cheap printer: a touch warm, a touch faded.
  g.fillStyle = 'rgba(255, 236, 200, 0.08)';
  g.fillRect(0, 0, out.width, out.height);
  return { canvas: out, url: out.toDataURL('image/jpeg', 0.82) };
}

/** The print: cream border, the photo, a pencil caption and the grade in signwriter red. */
function drawPrint(photo, caption, g) {
  const c = document.createElement('canvas');
  c.width = PRINT.w;
  c.height = PRINT.h;
  const x = c.getContext('2d');
  x.fillStyle = '#ece6d6';
  x.fillRect(0, 0, c.width, c.height);
  // Paper tooth.
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(90, 80, 60, ${(Math.random() * 0.05).toFixed(3)})`;
    x.fillRect(Math.random() * c.width, Math.random() * c.height, 1.4, 1.4);
  }
  x.drawImage(photo, PRINT.pad, PRINT.pad, PRINT.w - PRINT.pad * 2, PRINT.photoH);
  x.strokeStyle = 'rgba(40, 36, 30, 0.35)';
  x.strokeRect(PRINT.pad + 0.5, PRINT.pad + 0.5, PRINT.w - PRINT.pad * 2 - 1, PRINT.photoH - 1);
  const hand = getComputedStyle(document.documentElement).getPropertyValue('--hand').trim() || 'cursive';
  x.fillStyle = '#3b3a36';
  x.font = `26px ${hand}`;
  x.textBaseline = 'middle';
  x.fillText(caption || '', PRINT.pad + 4, PRINT.pad + PRINT.photoH + 50, PRINT.w - PRINT.pad * 2 - 60);
  // The grade: a signwriter-red tick, a wavy line (middle) or a cross.
  x.strokeStyle = '#a3392b';
  x.lineWidth = 3.2;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const gx = PRINT.w - 46;
  const gy = PRINT.pad + PRINT.photoH + 50;
  x.beginPath();
  if (g.tier === 'good') {
    x.moveTo(gx - 12, gy);
    x.lineTo(gx - 3, gy + 10);
    x.lineTo(gx + 16, gy - 14);
  } else if (g.tier === 'middle') {
    x.moveTo(gx - 14, gy + 2);
    x.bezierCurveTo(gx - 6, gy - 10, gx + 2, gy + 12, gx + 16, gy - 2);
  } else {
    x.moveTo(gx - 12, gy - 12);
    x.lineTo(gx + 12, gy + 12);
    x.moveTo(gx + 12, gy - 12);
    x.lineTo(gx - 12, gy + 12);
  }
  x.stroke();
  return c.toDataURL('image/jpeg', 0.8); // small: the item system keeps it
}

/** Slide a print in over the right of the frame; older prints shuffle down the pile. */
function showPrint(host, url, n) {
  for (const old of host.children) old.classList.add('old');
  const p = document.createElement('div');
  p.className = 'ph-print';
  p.style.setProperty('--rot', `${(n % 2 ? -1 : 1) * (2 + Math.random() * 3)}deg`);
  p.innerHTML = `<img alt="" src="${url}">`;
  host.appendChild(p);
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('in')));
  while (host.children.length > 3) host.firstChild.remove();
}

/** Test mode: a clue to shoot when the chapter gives none (a chalk-marked crate on the ground). */
function makePlaceholder(ctx) {
  const g = new THREE.Group();
  g.name = 'photo-placeholder';
  const fwd = new THREE.Vector3();
  ctx.camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const p = ctx.player.root.position;
  g.position.set(p.x + fwd.x * 4.5 + fwd.z * 1.2, p.y, p.z + fwd.z * 4.5 - fwd.x * 1.2);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.32), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.85 }));
  crate.position.y = 0.17;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: 0.7 }));
  tag.position.set(0, 0.2, 0.161);
  crate.castShadow = true;
  g.add(crate, tag);
  g.lookAt(ctx.player.root.position.x, p.y, ctx.player.root.position.z);
  ctx.scene.add(g);
  return g;
}
