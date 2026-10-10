import * as THREE from 'three';
import { takeStage, layer, gamePointer, texts, say, setTips, tipsFromHint, clamp, damp, smooth, eyeOf, pointOf, disposeTree, exhale, esc, debugHook } from './lib/games-a-kit.js';
import { bicycle, lightCone } from '../../world/build.js';
import './stakeout.css';

// STAKEOUT (docs/DESIGN-R4.md "New minigames", Ch6 Week 9; docs/SCRIPT-R4.md §7.6.5): first person from
// the bench at 3 a.m. The mouse looks around inside a clamped arc (the window maps onto it, like the
// photo's cone); keep the shadow inside the soft attention frame while staying out of the streetlight
// (leaning too far toward the lamp puts Hugo's face in it). When the shadow stops and looks round
// (telegraphed: he stops, a pencil « ? »), hold the right button to hold your breath; the SOUFFLE
// gauge drains, so let go once he turns away. No fail: lose him for 4 s and he walks his loop again.
// After two losses, 30 s with him mostly out of view, or 8 s without input, Hugo's eyes follow him on
// their own (the assist).
// The game ends when he reaches the end of his path (CYCLES DURAND), whatever the score.
//
//   await playGame('stakeout', ctx, d, {
//     suspect,              // a Character (from assets.makeCharacter) or an Object3D the game walks along
//                           //   the path; missing: a test M. Durand pushing a bike on the current scene
//     path,                 // [[x, z] | [x, y, z] | { at, look: true, wait }]: his route; `look` = he stops
//                           //   there and looks round; `wait` = a plain pause (s). Default: across the
//                           //   view in front of the bench, one look-round half way
//     speed,                // m/s (default: the character's pace × 0.85 ≈ 0.5, the script's 1.8 km/h)
//     height = 1.65,        // his height (the « ? » floats over it; the frame tests his chest)
//     clickAt,              // [x, y, z] in his local space: where the freewheel's « clic » is drawn
//     from,                 // the eye: [x, y, z] (default: Hugo's seated eye height where he is)
//     facing,               // yaw the arc is centred on (radians, 0 = +Z; default: toward the path)
//     arc = [50, 15],       // look limits (degrees, yaw / pitch) around it
//     lamp,                 // the streetlight's world point: its side of the arc is the bright one
//     light = { side: 1, from: 0.66 }, // or the bright side directly: +1 right / -1 left, from = share of the arc
//     lookSecs = 2.6,       // how long a look-round lasts
//     breathSecs = 6,       // a full breath held
//     lostAfter = 4,        // seconds out of the frame before he is lost
//     who = 'Jo',           // who whispers the barks
//     onArrive,             // async ({ suspect, skipped }) => {}: runs when he reaches the end, with the
//                           //   stakeout shot still held (the STRIDE bravo menu goes here)
//     text,                 // L.games.stakeout: { hint, gauge, seen, click, barks: { approach, still, light,
//                           //   looks, breathe, close, lost }, lost (Hugo's thought) }
//   })  -> { tier, observed (0..1: the share of his route seen from the shadow), caughtLooks, looks, losses,
//            assisted, skipped, secs }

export const id = 'stakeout';

// French fallbacks, used only when the chapter passes nothing (docs/SCRIPT-R4.md §7.6.5).
const FALLBACK = {
  hint: 'Souris : garder l’ombre dans le cadre · rester hors de la lumière · clic droit maintenu : retenir son souffle',
  gauge: 'SOUFFLE',
  seen: 'EN VUE',
  click: 'clic',
  barks: {
    approach: 'Y s’en vient.',
    still: 'Bouge pas.',
    light: 'La lumière ! Recule.',
    looks: 'Respire pas.',
    breathe: 'Ok. Respire un peu.',
    close: 'Il nous a vus ? Non. Ok.',
    lost: 'Il a tourné au coin.',
  },
  lost: 'Il fait une boucle. Il va repasser. Je connais les boucles.',
};

const DEG = Math.PI / 180;
const FRAME = { x: 0.56, y: 0.6 }; // the attention frame, in screen NDC (matches .so-frame)
// The look-round, in seconds: he stops (the « ? »), turns to the bench, looks, turns back.
const TELE = 0.9;
const TURN = 0.5;

export async function play(ctx, d, opts = {}) {
  const { engine, audio, cam, player } = ctx;
  const T = texts(FALLBACK, opts.text);
  const who = opts.who ?? 'Jo';
  const [arcYaw, arcPitch] = (opts.arc || [50, 15]).map((v) => v * DEG);
  const lookSecs = opts.lookSecs ?? 2.6;
  const breathSecs = opts.breathSecs ?? 6;
  const lostAfter = opts.lostAfter ?? 4;

  // ---------------------------------------------------------------- the eye and the route
  const eye = opts.from ? pointOf(opts.from, new THREE.Vector3(), { centre: false }) : eyeOf(ctx, new THREE.Vector3(), 1.2);
  const fwd = new THREE.Vector3();
  ctx.camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const groundY = opts.suspect?.root?.position.y ?? opts.suspect?.position?.y ?? player.root.position.y;
  const rawPath = opts.path || defaultPath(eye, fwd, right);
  const path = rawPath.map((p) => {
    const q = Array.isArray(p) || p?.isVector3 ? { at: p } : p;
    const a = q.at;
    const v = a.isVector3 ? a.clone() : a.length === 2 ? new THREE.Vector3(a[0], groundY, a[1]) : new THREE.Vector3(a[0], a[1], a[2]);
    return { at: v, look: !!q.look, wait: q.wait || 0 };
  });
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const len = path[i].at.distanceTo(path[i - 1].at);
    seg.push({ from: total, len });
    path[i].u = total + len;
    total += len;
  }
  path[0].u = 0;
  // Where the route's middle is: the arc is centred on it unless the chapter says otherwise.
  const mid = path.reduce((v, p) => v.add(p.at), new THREE.Vector3()).multiplyScalar(1 / path.length);
  const baseYaw = opts.facing ?? Math.atan2(mid.x - eye.x, mid.z - eye.z);
  const basePitch = Math.atan2(mid.y + 1.1 - eye.y, Math.hypot(mid.x - eye.x, mid.z - eye.z));
  // Screen-right of the arc's centre (the yaw grows to the left: dir = (sin, cos)).
  const sideR = new THREE.Vector3(-Math.cos(baseYaw), 0, Math.sin(baseYaw));
  const yawN = (p) => wrapPi(baseYaw - Math.atan2(p.x - eye.x, p.z - eye.z)) / arcYaw; // + = right, 1 = arc edge

  // The bright side: the chapter's lamp, or the right edge of the arc.
  let lightSide = opts.light?.side ?? 1;
  let lightFrom = opts.light?.from ?? 0.66;
  const lampAt = opts.lamp ? pointOf(opts.lamp, new THREE.Vector3(), { centre: false }) : null;
  if (lampAt) {
    const n = yawN(lampAt);
    lightSide = n >= 0 ? 1 : -1;
    lightFrom = clamp(Math.abs(n) - 0.3, 0.4, 0.85);
  }

  // ---------------------------------------------------------------- the shadow
  const own = []; // test-mode things to dispose
  let char = null;
  let body;
  // Where the « clic » is drawn, in his local space (the rear hub of the bike he pushes).
  let bikeAt = opts.clickAt ? new THREE.Vector3(...opts.clickAt) : new THREE.Vector3(0, 0.5, 0);
  if (opts.suspect) {
    char = opts.suspect.root && opts.suspect.play ? opts.suspect : null;
    body = char ? char.root : opts.suspect;
    if (!body.parent) ctx.scene.add(body);
  } else {
    // Test mode: M. Durand (the cast's preset), pushing a dark old bike at his right hand.
    char = ctx.assets.makeCharacter({ preset: 'durand', name: 'stakeout-durand' });
    body = char.root;
    const bike = bicycle({ frame: '#2e3a33', rust: 0.55 });
    bike.position.set(-0.42, 0, 0.22);
    body.add(bike);
    own.push(bike);
    ctx.scene.add(body);
    if (!opts.clickAt) bikeAt = new THREE.Vector3(-0.42, 0.34, -0.28);
  }
  const speed = opts.speed ?? (char ? char.pace * 0.85 : 0.5);
  const height = opts.height ?? 1.65; // his height (the « ? » floats over it; the frame tests his chest)
  const hadVisible = body.visible;
  // Test mode: the streetlight's cone where the bright side is, so it reads.
  if (!opts.suspect && !lampAt) {
    const cone = lightCone({ length: 4.4, radius: 1.9, color: '#ffc27a', opacity: 0.32 });
    cone.position.copy(eye).addScaledVector(sideR, lightSide * 2.4).addScaledVector(fwd, 1.2);
    cone.position.y = groundY + 4.4;
    ctx.scene.add(cone);
    own.push(cone);
  }

  // ---------------------------------------------------------------- the stage
  const stage = takeStage(ctx, d, { hidePlayer: opts.hidePlayer ?? true, rain: 0.35 });
  const P = gamePointer(ctx);
  const canvas = ctx.renderer.domElement;
  canvas.style.cursor = 'none';
  const tmpTick = new THREE.Vector3();
  // R4 Ch6 sounds: one worn-pawl click per wheel turn (pawl_click, below), not a coasting hub's tick loop.
  const ticks = null;

  const L = layer(
    ctx,
    `ga-stakeout${lightSide < 0 ? ' left' : ''}`,
    `<div class="so-night"></div>
     <div class="so-light"></div>
     <div class="so-frame"><i></i><i></i><i></i><i></i></div>
     <div class="so-arrow"></div>
     <div class="so-mark">?</div>
     <div class="so-clicks"><span></span><span></span><span></span><span></span></div>
     <div class="so-meters">
       <div class="ga-meter so-seen"><div class="ga-label">${esc(T.seen)}</div><div class="ga-track"><div class="ga-fill"></div></div></div>
       <div class="ga-meter red so-breath"><div class="ga-label">${esc(T.gauge)}</div><div class="ga-track"><div class="ga-fill"></div></div></div>
     </div>
     <div class="ga-tips"></div>`,
  );
  const el = (q) => L.querySelector(q);
  const frameEl = el('.so-frame');
  const lightEl = el('.so-light');
  const arrowEl = el('.so-arrow');
  const markEl = el('.so-mark');
  const clickEls = [...L.querySelectorAll('.so-clicks span')];
  const seenEl = el('.so-seen');
  const seenFill = seenEl.querySelector('.ga-fill');
  const breathEl = el('.so-breath');
  const breathFill = breathEl.querySelector('.ga-fill');
  setTips(el('.ga-tips'), tipsFromHint(T.hint));
  for (const c of clickEls) c.textContent = T.click;
  requestAnimationFrame(() => L.classList.add('show'));

  // ---------------------------------------------------------------- state
  const route = total / Math.max(0.05, speed) + path.filter((p) => p.look).length * (lookSecs + TELE + TURN * 2);
  const s = {
    t: 0,
    idle: 0,
    moved: false,
    lx: 0, // the look, -1 (left edge of the arc) .. 1 (right edge)
    ly: 0,
    wantX: 0,
    wantY: 0,
    u: 0, // metres along the route
    phase: 'walk', // walk | wait | tele | turn | look | back | gone | arrive
    phaseT: 0,
    lookDone: new Set(),
    spotted: false, // he has been in the frame since he (re)appeared
    forced: false, // this look-round was set off by the light or a gasp
    lastForced: -99,
    caught: false,
    exposedT: 0,
    caughtLooks: 0,
    looks: 0,
    losses: 0,
    outT: 0,
    seenT: 0,
    light: 0,
    breath: 1,
    holding: false,
    heldT: 0,
    gasp: 0,
    assisted: false,
    inFrame: false,
    heading: 0,
    faceTo: 0,
    clickT: 0,
    clickN: 0,
    barkAt: -99,
    barked: new Set(),
    afterLook: null,
    fade: 1,
  };
  const dir = new THREE.Vector3();
  const look = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const chest = new THREE.Vector3();
  const head = new THREE.Vector3();
  const scr = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const unhook = debugHook(ctx, id, {
    s,
    body,
    // The mouse position (window NDC) that centres him; tests steer with it.
    aimFor: () => ({ x: clamp(yawN(chest) / 1.08, -1, 1), y: clamp(((Math.atan2(chest.y - eye.y, Math.hypot(chest.x - eye.x, chest.z - eye.z)) - basePitch) / arcPitch) / 1.1, -1, 1) }),
    light: { side: lightSide, from: lightFrom },
  });

  /** Bark a whispered line: at most one per 3 s unless it matters now (`force`); `once` per game. */
  const bark = (key, { force = false, once = false } = {}) => {
    const line = T.barks?.[key];
    if (!line || (once && s.barked.has(key))) return;
    if (!force && s.t - s.barkAt < 3) return;
    s.barkAt = s.t;
    s.barked.add(key);
    say(ctx, typeof line === 'string' ? { who, text: line } : line, 2.2, who);
  };

  const placeOnRoute = () => {
    let i = 0;
    while (i < seg.length - 1 && s.u > seg[i].from + seg[i].len) i++;
    const g = seg[i];
    const k = g.len > 0 ? clamp((s.u - g.from) / g.len, 0, 1) : 1;
    body.position.lerpVectors(path[i].at, path[i + 1].at, k);
    s.heading = Math.atan2(path[i + 1].at.x - path[i].at.x, path[i + 1].at.z - path[i].at.z);
  };
  const anim = (name) => {
    if (!char) return;
    if (name === 'walk') char.play('walk', 0.3, { timeScale: char.strideRate('walk', speed) });
    else char.play('idle', 0.35);
  };
  const setPhase = (p) => {
    s.phase = p;
    s.phaseT = 0;
  };
  /** Start a look-round where he stands (a route stop, the light, or a gasp). */
  const startLook = (forced) => {
    s.forced = forced;
    s.caught = false;
    s.exposedT = 0;
    s.looks++;
    if (forced) s.lastForced = s.t;
    anim('idle');
    setPhase('tele');
    bark('still', { force: true });
  };
  const restartLoop = () => {
    // A new pass: what counts is how much of one whole loop was seen.
    s.u = 0;
    s.seenT = 0;
    s.spotted = false;
    s.lookDone.clear();
    placeOnRoute();
    body.rotation.y = s.heading;
    anim('walk');
    setPhase('walk');
  };

  placeOnRoute();
  body.rotation.y = s.heading;
  body.visible = true;
  anim('walk');
  chest.copy(body.position).y += height * 0.72;

  const applyCam = () => {
    // Breathing sways the view a little; a held breath is dead still.
    const sway = (s.holding ? 0.08 : 1) * 0.25 * DEG;
    const yaw = baseYaw - s.lx * arcYaw + Math.sin(s.t * 0.9) * sway * 0.6;
    const pitch = basePitch + s.ly * arcPitch + Math.sin(s.t * 1.7) * sway;
    dir.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
    // Looking out to a side is leaning out to it: the eye goes with the head.
    camPos.copy(eye).addScaledVector(sideR, s.lx * 0.14);
    camPos.y -= Math.abs(s.lx) * 0.03;
    look.copy(camPos).addScaledVector(dir, 10);
    cam.set({ pos: camPos, look, fov: opts.fov ?? 52 });
    cam.setRoll?.(-s.lx * 2.2 * DEG);
    s.viewYaw = yaw;
    s.viewPitch = pitch;
  };

  /** He is in the attention frame: his chest within FRAME of the view centre. */
  const inFrame = () => {
    if (!body.visible || s.fade < 0.5) return false;
    const dx = chest.x - camPos.x;
    const dz = chest.z - camPos.z;
    const ry = wrapPi(s.viewYaw - Math.atan2(dx, dz));
    if (Math.abs(ry) > 80 * DEG) return false;
    const rp = Math.atan2(chest.y - camPos.y, Math.hypot(dx, dz)) - s.viewPitch;
    const vt = Math.tan(((opts.fov ?? 52) * DEG) / 2);
    const ht = vt * ctx.camera.aspect;
    s.ndcX = Math.tan(ry) / ht;
    s.ndcY = Math.tan(rp) / vt;
    return Math.abs(s.ndcX) <= FRAME.x && Math.abs(s.ndcY) <= FRAME.y;
  };

  // ---------------------------------------------------------------- the loop
  const r = await d.until((dt) => {
    const raw = Math.min(0.1, engine.rawDt || dt);
    s.t += raw;
    s.phaseT += raw;
    P.update();
    if (P.touched) s.idle = 0;
    else s.idle += raw;

    // -- the look: the mouse over the window maps onto the arc
    if (P.inside && (P.moved || s.moved)) {
      s.moved = true;
      s.wantX = clamp(P.ndc.x * 1.08, -1, 1);
      s.wantY = clamp(P.ndc.y * 1.1, -1, 1);
    }
    // The assist: two losses, 30 s with him mostly out of view, or 8 s without input.
    if (!s.assisted && (s.losses >= 2 || (s.t >= 30 && s.seenT < s.t * 0.6) || s.idle >= 8)) s.assisted = true;
    let aimX = s.wantX;
    let aimY = s.wantY;
    if (s.assisted && body.visible) {
      // Hugo's eyes follow him on their own, never as far as the light; the mouse still nudges.
      const hx = clamp(yawN(chest), -0.95, 0.95);
      const safe = lightSide > 0 ? Math.min(hx, lightFrom - 0.08) : Math.max(hx, -lightFrom + 0.08);
      const w = s.idle < 0.6 ? 0.55 : 1;
      aimX = s.wantX + (safe - s.wantX) * w;
      aimY = s.wantY * (1 - w);
    }
    s.lx = damp(s.lx, aimX, 5, raw);
    s.ly = damp(s.ly, aimY, 5, raw);

    // -- the breath (right button held)
    const wasHolding = s.holding;
    if (s.gasp > 0) s.gasp -= raw;
    s.holding = P.rdown && s.gasp <= 0 && s.breath > 0;
    if (s.holding) {
      s.heldT += raw;
      s.breath = Math.max(0, s.breath - raw / breathSecs);
      if (s.breath <= 0) {
        // Out of breath: a ragged gasp, loud enough to make him look round.
        s.holding = false;
        s.gasp = 1.4;
        exhale(audio, { gasp: true, volume: 0.22 });
        if (s.phase === 'walk' && s.t - s.lastForced > 6) startLook(true);
      }
    } else {
      if (wasHolding && s.breath > 0 && s.heldT > 0.6) exhale(audio, { volume: 0.12 });
      if (!P.rdown) s.heldT = 0;
      s.breath = Math.min(1, s.breath + raw * (s.gasp > 0 ? 0.1 : 0.28));
    }

    // -- the light: leaning out toward the lamp puts Hugo's face in it
    const over = (s.lx * lightSide - lightFrom) / (1 - lightFrom);
    if (over > 0) s.light = Math.min(1, s.light + raw * (0.7 + over * 1.6));
    else s.light = Math.max(0, s.light - raw * 0.9);
    if (s.light > 0.25) bark('light', { force: s.t - s.barkAt > 1.5 });
    const lit = s.light > 0.35;
    if (s.light >= 1 && s.phase === 'walk' && s.t - s.lastForced > 6) startLook(true);

    // -- the shadow: walk the route, stop and look round, lose him, arrive
    if (s.phase === 'walk') {
      const next = path.find((p, i) => i > 0 && (p.look || p.wait) && !s.lookDone.has(i) && p.u <= s.u + speed * raw + 1e-6);
      if (next) {
        s.u = next.u;
        s.lookDone.add(path.indexOf(next));
        placeOnRoute();
        if (next.look) startLook(false);
        else {
          anim('idle');
          s.waitFor = next.wait;
          setPhase('wait');
        }
      } else {
        s.u += speed * raw;
        if (s.u >= total) {
          s.u = total;
          placeOnRoute();
          anim('idle');
          setPhase('arrive');
        } else placeOnRoute();
      }
      s.faceTo = s.heading;
    } else if (s.phase === 'wait') {
      if (s.phaseT >= s.waitFor) {
        anim('walk');
        setPhase('walk');
      }
    } else if (s.phase === 'tele') {
      if (s.phaseT >= TELE) {
        setPhase('turn');
        bark('looks', { force: true });
      }
    } else if (s.phase === 'turn' || s.phase === 'look') {
      s.faceTo = Math.atan2(eye.x - body.position.x, eye.z - body.position.z);
      // Seen: breathing (not holding it), or in the light, for long enough while he looks this way.
      const exposed = !s.holding || lit;
      if (s.phase === 'look' || s.phaseT > TURN * 0.6) s.exposedT = exposed ? s.exposedT + raw : Math.max(0, s.exposedT - raw * 0.5);
      if (!s.caught && s.exposedT > 0.55) {
        s.caught = true;
        s.caughtLooks++;
        audio.tone({ freq: 196, to: 180, dur: 0.5, volume: 0.06, attack: 0.02 });
        audio.sfx('creak_wood', { volume: 0.18, fallback: false });
      }
      if (s.phase === 'turn' && s.phaseT >= TURN) setPhase('look');
      if (s.phase === 'look' && s.phaseT >= lookSecs + (s.caught ? 1 : 0)) {
        setPhase('back');
        s.afterLook = s.caught ? 'close' : 'breathe';
      }
    } else if (s.phase === 'back') {
      s.faceTo = s.heading;
      if (s.phaseT >= TURN) {
        if (s.afterLook === 'close') bark('close', { force: true });
        else if (s.holding) bark('breathe', { force: true });
        s.afterLook = null;
        anim('walk');
        setPhase('walk');
      }
    } else if (s.phase === 'gone') {
      // Round the block: out of sight, then back at the start of his loop.
      s.fade = Math.max(0, s.fade - raw * 1.5);
      char?.setOpacity?.(s.fade);
      if (s.fade <= 0) body.visible = false;
      if (s.phaseT >= 3) {
        body.visible = true;
        restartLoop();
      }
    } else if (s.phase === 'arrive') {
      if (s.phaseT >= 0.9) return true;
    }
    if (s.phase !== 'gone' && s.fade < 1) {
      s.fade = Math.min(1, s.fade + raw * 1.2);
      char?.setOpacity?.(s.fade);
    }
    // Turning, eased (a stooped old man turns slowly).
    body.rotation.y += wrapPi(s.faceTo - body.rotation.y) * (1 - Math.exp(-(s.phase === 'turn' || s.phase === 'back' ? 7 : 4) * raw));

    // -- the camera, then where he sits in it
    applyCam();
    chest.copy(body.position).y += height * 0.72;
    s.inFrame = inFrame();
    const onRoute = s.phase !== 'gone' && s.phase !== 'arrive';
    if (onRoute && !s.barked.has('approach') && s.inFrame) bark('approach', { once: true, force: true });
    if (onRoute && s.inFrame && !lit) s.seenT += raw;
    // Lost: out of the frame for lostAfter seconds while he walks (once he has been in it this loop).
    if (s.inFrame) s.spotted = true;
    if (onRoute && s.spotted && !s.inFrame && s.phase === 'walk') s.outT += raw;
    else s.outT = Math.max(0, s.outT - raw * 2);
    if (s.outT >= lostAfter && s.phase === 'walk') {
      s.outT = 0;
      s.losses++;
      bark('lost', { force: true });
      s.lostLine = s.t + 2.2;
      setPhase('gone');
    }
    if (s.lostLine && s.t >= s.lostLine) {
      s.lostLine = 0;
      say(ctx, T.lost, 3);
    }

    // -- sound: the freewheel ticks while he pushes the bike
    const ticking = s.phase === 'walk' && body.visible;
    ticks?.set?.(ticking ? 0.34 * s.fade : 0, 1, 0.25);
    if (ticking) {
      s.clickT += raw;
      if (s.clickT >= 1.45) {
        s.clickT = 0;
        if (!ticks) audio.sfx('pawl_click', { volume: 0.3 * s.fade, jitter: 0.03, pos: body.localToWorld(tmpTick.copy(bikeAt)).toArray(), ref: 3, fallback: (a) => a.tick({ volume: 0.05 }) });
        showClick();
      }
    }

    draw(lit);
    return false;
  });

  /** The « clic » caption at the rear hub, the sound's visual twin. */
  function showClick() {
    body.localToWorld(tmp.copy(bikeAt));
    P.project(tmp, scr);
    if (scr.z > 1 || scr.x < 0 || scr.x > innerWidth || scr.y < 0 || scr.y > innerHeight) return;
    const c = clickEls[s.clickN++ % clickEls.length];
    c.style.left = `${scr.x.toFixed(0)}px`;
    c.style.top = `${scr.y.toFixed(0)}px`;
    c.style.setProperty('--tilt', `${(Math.random() * 14 - 7).toFixed(1)}deg`);
    c.classList.remove('go');
    void c.offsetWidth;
    c.classList.add('go');
  }

  /** The overlay, per frame (only what changed). */
  function draw(lit) {
    const looking = s.phase === 'tele' || s.phase === 'turn' || s.phase === 'look';
    toggle(frameEl, 'in', s.inFrame && !lit);
    toggle(frameEl, 'warn', !s.inFrame && s.outT > 1.2);
    toggle(L, 'hold', s.holding);
    toggle(L, 'alert', looking);
    lightEl.style.opacity = (s.light * 0.95).toFixed(3);
    // The « ? » over his head while he looks round; « ! » once he has seen something.
    if (looking || (s.phase === 'back' && s.phaseT < 0.3)) {
      head.copy(body.position).y += height + 0.35;
      P.project(head, scr);
      const txt = s.caught ? '!' : '?';
      if (markEl.textContent !== txt) markEl.textContent = txt;
      markEl.style.transform = `translate(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px) translate(-50%, -100%) scale(${(0.7 + 0.3 * smooth(Math.min(1, s.phase === 'tele' ? s.phaseT / TELE : 1))).toFixed(3)})`;
      toggle(markEl, 'on', scr.z < 1);
      toggle(markEl, 'caught', s.caught);
    } else toggle(markEl, 'on', false);
    // Out of the frame: a pencil chevron on the frame's edge, toward him.
    const showArrow = body.visible && s.phase !== 'gone' && !s.inFrame && s.outT > 0.5;
    toggle(arrowEl, 'on', showArrow);
    if (showArrow) {
      const leftSide = (s.ndcX ?? 0) < 0;
      toggle(arrowEl, 'l', leftSide);
      const y = clamp(-(s.ndcY ?? 0), -FRAME.y, FRAME.y);
      arrowEl.style.top = `${(((y + 1) / 2) * 100).toFixed(1)}%`;
      toggle(arrowEl, 'warn', s.outT > lostAfter * 0.55);
    }
    const seen = clamp(s.seenT / route, 0, 1);
    seenFill.style.width = `${(seen * 100).toFixed(1)}%`;
    breathFill.style.width = `${(s.breath * 100).toFixed(1)}%`;
    toggle(breathEl, 'on', s.holding || s.breath < 0.999 || looking);
    toggle(breathEl, 'warn', s.holding && s.breath < 0.3);
  }

  // ---------------------------------------------------------------- end
  const skipped = r === 'skipped';
  if (skipped) {
    // Straight to the end of his route (the script: skip goes straight to the bravo).
    s.u = total;
    body.visible = true;
    char?.setOpacity?.(1);
    placeOnRoute();
    body.rotation.y = s.heading;
    anim('idle');
  }
  ticks?.stop?.(0.4);
  P.dispose();
  unhook();
  L.classList.remove('show');
  setTimeout(() => L.remove(), 400);
  if (opts.onArrive) {
    // The bravo menu (or whatever the chapter does there), with the stakeout shot still held.
    canvas.style.cursor = '';
    try {
      await opts.onArrive({ suspect: char || body, skipped });
    } catch (err) {
      console.error('[stakeout] onArrive failed', err);
    }
  }
  stage.restore();
  if (!opts.suspect) {
    for (const o of own) disposeTree(o);
    char?.dispose();
    ctx.assets.characters?.delete(char);
  } else {
    // The chapter's shadow stays where he got to; only what the game toggled comes back.
    if (!hadVisible) body.visible = false;
    char?.setOpacity?.(1);
  }
  const observed = skipped ? Math.max(0.6, clamp(s.seenT / route, 0, 1)) : clamp(s.seenT / route, 0, 1);
  const tier = skipped ? 'middle' : observed >= 0.7 && s.caughtLooks === 0 ? 'good' : observed >= 0.4 && s.caughtLooks <= 1 ? 'middle' : 'poor';
  return {
    tier,
    observed: Math.round(observed * 100) / 100,
    caughtLooks: s.caughtLooks,
    looks: s.looks,
    losses: s.losses,
    assisted: s.assisted,
    skipped,
    secs: Math.round(s.t * 10) / 10,
  };
}

// ------------------------------------------------------------------ helpers

function wrapPi(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function toggle(e, cls, on) {
  if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
}

/**
 * Test route: across the view in front of the bench, from the left (the bakery shutter) to the
 * right (CYCLES DURAND, near the lamp's side), with one look-round half way. About 37 s at 0.5 m/s.
 */
function defaultPath(eye, fwd, right) {
  const at = (f, r) => {
    const v = eye.clone().addScaledVector(fwd, f).addScaledVector(right, r);
    return [v.x, v.z];
  };
  return [at(10, -9), at(9.2, -4), { at: at(8.6, -0.6), look: true }, at(8, 3.5), at(7.4, 7.4)];
}
