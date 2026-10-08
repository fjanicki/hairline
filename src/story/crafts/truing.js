import * as THREE from 'three';
import { L } from '../script.js';
import { craftPointer } from './pointer.js';
import { makeDust } from './juice.js';

// Truing by ear (docs/DESIGN.md R3.4): turn the wheel spoke by spoke, pluck the one at 12 o'clock,
// tighten or loosen it a quarter turn until it sings the note. A slack spoke lets the rim wander and
// rub the pad exactly there. Ch4 Week 4 (Sami's bike) and Ch5 (Ines's wheel).

const clamp = THREE.MathUtils.clamp;
const N = 16;
const STEP = (Math.PI * 2) / N;
const IN_TUNE = 0.05;
const BUMP = THREE.MathUtils.degToRad(40);
const smooth = (k) => k * k * (3 - 2 * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mod = (i) => ((i % N) + N) % N;

/** Spoke pitch (Hz) for a tension (1 = right). */
export function spokeFreq(tension, f0 = 523) {
  return f0 * Math.sqrt(Math.max(0, tension));
}

/** A plucked spoke: a sine at f plus a triangle at 2.003 f, exponential decay, a 15 ms tick on the attack. */
export function pluck(audio, freq, { volume = 0.16, decay = 0.7 } = {}) {
  if (!audio?.ok) return;
  const ac = audio.ctx;
  const t = ac.currentTime;
  const voice = (type, f, vol, dur) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.fx);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  voice('sine', freq, volume, decay);
  voice('triangle', freq * 2.003, volume * 0.32, decay * 0.6);
  audio.noise({ type: 'highpass', freq: 2600, q: 0.7, dur: 0.015, volume: volume * 0.45, tail: 0.01 });
}

const chalkMat = () => new THREE.MeshBasicMaterial({ color: '#e9e4d6', fog: false });

/**
 * trueWheel(ctx, d, {rig, faults, text = L.ch4.week4.truing, f0 = 523, onSpokeTrue(i)})
 *   -> Promise<{skipped, assisted, plucks, secs, overTight}>
 * rig: a bikeRig rig (src/world/bikeRig.js). faults: [[spoke, tension], ...]. `text` gives flat,
 * barks.{who, clunk, hitting, notFixed, ping, higher} and assisted; the hint, gauge and pitch words
 * always come from L.ch4.week4.truing. Ends with the wheel true, one clear pluck and the wheel
 * spinning free (rig.setSpin(0.6)); the caller does the reveal.
 */
export async function trueWheel(ctx, d, opts = {}) {
  const { rig, faults = [[4, 0.6]], text = L.ch4.week4.truing, f0 = 523, onSpokeTrue } = opts;
  const { ui, input, audio, engine } = ctx;
  const H = L.ch4.week4.truing;
  const T = new Array(N).fill(1);
  for (const [i, t] of faults) T[mod(i)] = clamp(t, 0.4, 1.4);
  const out = (i) => Math.abs(T[i] - 1) > IN_TUNE + 1e-6;
  const allTrue = () => !T.some((_, i) => out(i));

  // The rim: each spoke off tension pulls it to its side over +-40 deg (cos^2 bump).
  const lateralAt = (a) => {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      if (T[i] === 1) continue;
      const x = wrap(a - i * STEP);
      if (Math.abs(x) >= BUMP) continue;
      const c = Math.cos((x / BUMP) * (Math.PI / 2));
      sum += (T[i] - 1) * (i % 2 ? 1 : -1) * c * c;
    }
    return 0.07 * sum;
  };
  // pos: wheel position in spokes (spoke round(pos) is at 12 o'clock): rig angle = TOP - pos * STEP.
  const angleOf = (p) => rig.TOP - p * STEP;
  let pos = (rig.TOP - (rig.st?.angle || 0)) / STEP; // from wherever the wheel stopped
  let from = pos;
  let to = pos;
  let easeT = 1;
  let easeDur = 0.12;
  const goTo = (p, dur = 0.12) => {
    from = pos;
    to = p;
    easeT = 0;
    easeDur = dur;
  };
  const at = () => mod(Math.round(to));
  rig.setAngle(angleOf(pos));
  goTo(Math.round(pos), 0.3);
  // The rim is read at the pluck point (the chalk tick), not at the pads 33° round: so the rub, and
  // the flash and puff at the pad, come exactly when the guilty spoke is the one under the tick.
  rig.setLateral((ang) => lateralAt(rig.TOP - ang));
  const prevRub = rig.onRub;
  const dust = makeDust(ctx, { max: 48, size: 0.01 });
  const padAt = new THREE.Vector3();
  // Sound (docs/assets/sfx.md Ch4): the rub is a recorded brake_rub, louder the further the rim is out
  // (the pad flash is its twin); the quarter turn is spoke_key; the pluck stays synthesized, because
  // its pitch (523 Hz x sqrt(tension)) is the information.
  rig.onRub = (dev) => {
    audio.sfx('brake_rub', { volume: Math.min(0.45, 0.15 + dev * 10), pos: rig.pads, fallback: (a) => a.tick({ volume: Math.min(0.3, dev * 10) }) });
    rig.pads.getWorldPosition(padAt);
    dust.emit(padAt, { n: 7, color: '#c98a5a', speed: 0.35, spread: 0.8, life: 0.7 });
  };

  // Screen direction: + pos moves the top of the rim right on screen? (D and a right drag do that.)
  const scr = (p) => {
    const a = angleOf(p);
    const v = new THREE.Vector3(0, Math.sin(a) * rig.R, Math.cos(a) * rig.R);
    return rig.rear.parent.localToWorld(v).project(ctx.camera).x;
  };
  rig.group.updateMatrixWorld(true);
  const dirSign = scr(0.25) >= scr(0) ? 1 : -1;

  // Spokes: their own vertex-coloured material, so a plucked one can brighten and shiver.
  const sp = rig.spokes;
  const geo = sp.geometry;
  const posAttr = geo.attributes.position;
  const rest = Float32Array.from(posAttr.array);
  const baseMat = sp.material;
  const baseCol = baseMat.color.clone().multiplyScalar(0.8); // a touch dimmer, so a plucked one stands out
  const mat = new THREE.LineBasicMaterial({ color: '#ffffff', vertexColors: true });
  const cols = new Float32Array(posAttr.count * 3);
  for (let k = 0; k < posAttr.count; k++) cols.set([baseCol.r, baseCol.g, baseCol.b], k * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  sp.material = mat;
  const vib = new Float32Array(N).fill(-1); // seconds since the pluck, -1 = still
  const hot = new THREE.Color(1.7, 1.6, 1.4); // over 1: the plucked spoke catches the bloom
  const tmp = new THREE.Color();
  const shiver = (dt) => {
    let any = false;
    for (let i = 0; i < N; i++) {
      if (vib[i] < 0) continue;
      vib[i] += dt;
      const k = vib[i] / 0.6;
      const v = 2 * i + 1; // the rim end
      if (k >= 1) {
        vib[i] = -1;
        posAttr.array[v * 3] = rest[v * 3];
        for (const e of [2 * i, v]) cols.set([baseCol.r, baseCol.g, baseCol.b], e * 3);
      } else {
        any = true;
        const amp = 0.004 * (1 - k) * (1 - k);
        posAttr.array[v * 3] = rest[v * 3] + amp * Math.sin(vib[i] * Math.PI * 2 * 22);
        tmp.copy(baseCol).lerp(hot, 1 - k);
        for (const e of [2 * i, v]) cols.set([tmp.r, tmp.g, tmp.b], e * 3);
      }
      geo.attributes.color.needsUpdate = true;
    }
    posAttr.needsUpdate = true;
    return any;
  };
  let offShiver = ctx.world.onUpdate((dt, raw) => shiver(raw));

  // Chalk: a fixed tick on the tyre at 12 o'clock (the pluck point), and a mark on the rim (assist).
  const R = rig.R;
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.006), chalkMat());
  tick.position.set(0, Math.sin(rig.TOP) * (R + 0.002), Math.cos(rig.TOP) * (R + 0.002)); // at 12 o'clock, whichever way up
  tick.rotation.x = Math.PI / 2 - rig.TOP;
  rig.yaw.add(tick);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.005), chalkMat());
  mark.visible = false;
  rig.rear.add(mark);
  let marked = -1;
  const markSpoke = (i) => {
    marked = i;
    const a = i * STEP;
    mark.position.set(0, Math.sin(a) * (R - 0.036), Math.cos(a) * (R - 0.036));
    mark.rotation.set(-a, 0, 0);
    mark.visible = true;
  };

  // Feedback.
  const barks = text.barks || H.barks || {};
  const who = barks.who || 'Sami';
  let lastBark = -1e9;
  const bark = (key) => {
    const line = barks[key];
    if (!line || s.t - lastBark < 5) return;
    lastBark = s.t;
    ui.thought(line, 2.4, { who });
  };
  let lastF = null;
  let lastOver = false;
  const gauge = () => {
    if (lastF === null) return;
    const r = lastF / f0;
    const word = r < 0.975 ? H.pitch.flat : r > 1.025 ? H.pitch.sharp : H.pitch.true;
    ui.gauge(H.gauge, { value: r, min: 0.75, max: 1.25, band: [0.975, 1.025], text: word, warn: lastOver });
  };

  const s = { t: 0, idle: 0, sinceTrue: 0, stage: 0, stageT: 0, plucks: 0, overTight: false, assisted: false };
  const pluckTimes = [];
  let pending = null; // {i, in}: the auto-pluck after a quarter turn
  let higherSaid = false;
  let notFixedSaid = false;
  let held = null; // {code, dir, next}
  let wheelAt = -1e9; // the last scroll event
  let wheelArmed = true;
  let started = false; // the first input: the "you're stuck" timer waits for it
  let doneT = -1;

  let pluckAt = -1e9;
  const doPluck = (i, manual) => {
    s.plucks++;
    pluckAt = s.t;
    vib[i] = 0;
    const f = spokeFreq(T[i], f0);
    lastF = f;
    lastOver = T[i] > 1.15;
    if (lastOver) {
      audio.ping({ freq: 1900 });
      bark('ping');
    } else pluck(audio, f);
    if (manual) {
      pluckTimes.push(s.t);
      while (pluckTimes.length && s.t - pluckTimes[0] > 1.5) pluckTimes.shift();
      if (pluckTimes.length >= 3) {
        pluckTimes.length = 0;
        bark('hitting');
      }
    }
  };
  const quarter = (dir) => {
    const i = at();
    const was = T[i];
    T[i] = clamp(Math.round((was + 0.1 * dir) * 100) / 100, 0.4, 1.4);
    audio.sfx('spoke_key', { volume: 0.25, rate: 1.3 });
    pending = { i, in: 0.12 };
    if (dir > 0 && T[i] > 1.15 && s.stage < 2) s.overTight = true; // he wound it past the note
    if (dir < 0 && Math.abs(was - 1) <= IN_TUNE + 1e-6) bark('clunk');
    if (dir > 0 && was < 1 - IN_TUNE && T[i] < 1 - IN_TUNE && !higherSaid) {
      higherSaid = true;
      bark('higher');
    }
    if (out(i) === false && Math.abs(was - 1) > IN_TUNE + 1e-6) {
      s.sinceTrue = 0;
      if (marked === i) mark.visible = false;
      try {
        onSpokeTrue?.(i);
      } catch (err) {
        console.error('[truing] onSpokeTrue failed', err);
      }
    }
  };
  // The spoke the assist works on: the flattest one out of tune (or the worst sharp one).
  const worst = () => {
    let best = -1;
    let score = -1;
    for (let i = 0; i < N; i++) {
      if (!out(i)) continue;
      const sc = (1 - T[i]) * 2 + Math.abs(T[i] - 1); // flat first
      if (sc > score) {
        score = sc;
        best = i;
      }
    }
    return best;
  };
  const nearest = (i) => i + N * Math.round((pos - i) / N);
  const turnTo = (i) => {
    const p = nearest(i);
    goTo(p, clamp(Math.abs(p - pos) * 0.12, 0.25, 1.0));
  };

  const P = craftPointer(ctx);
  let dragging = false;
  ui.prompt(text.hint ?? H.hint);
  const KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Space'];

  const r = await d.until((dt) => {
    P.update();
    const raw = engine.rawDt || dt;
    s.t += raw;
    if (started) s.sinceTrue += raw;
    s.stageT += raw;
    s.idle += raw;

    // Ease the wheel.
    if (easeT < 1) {
      easeT = Math.min(1, easeT + raw / easeDur);
      pos = from + (to - from) * smooth(easeT);
    }
    if (pending) {
      pending.in -= raw;
      if (pending.in <= 0) {
        doPluck(pending.i, false);
        pending = null;
      }
    }

    if (doneT >= 0) {
      rig.setAngle(angleOf(pos));
      gauge();
      return s.t - doneT >= 0.5;
    }

    const auto = s.stage === 2;
    const touched = KEYS.some((k) => input.pressed.has(k)) || P.pressed || P.wheel !== 0;
    if (touched && !auto) {
      started = true;
      s.idle = 0;
      notFixedSaid = false;
    }

    if (!auto) {
      // Turn: A / D (arrows) step a spoke, repeating at 6/s while held; or drag.
      const dirOf = (c) => (c === 'KeyD' || c === 'ArrowRight' ? 1 : -1) * dirSign;
      for (const c of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']) {
        if (input.pressed.has(c)) {
          held = { code: c, dir: dirOf(c), next: 0.3 };
          goTo(Math.round(to) + held.dir);
        }
      }
      if (held) {
        if (!input.down.has(held.code)) held = null;
        else if ((held.next -= raw) <= 0) {
          held.next = 1 / 6;
          goTo(Math.round(to) + held.dir);
        }
      }
      if (P.down && P.dragX) {
        dragging = true;
        s.idle = 0;
        started = true;
        pos += (P.dragX * 0.01 * dirSign) / STEP;
        to = from = pos;
        easeT = 1;
      }
      if (dragging && !P.down) {
        dragging = false;
        goTo(Math.round(pos), 0.15);
      }
      // Pluck: Space or a click.
      if (input.pressed.has('Space') || P.click) doPluck(at(), true);
      // Quarter turn: W / S (arrows), or the scroll wheel (toward you tightens), throttled.
      if (input.pressed.has('KeyW') || input.pressed.has('ArrowUp')) quarter(1);
      else if (input.pressed.has('KeyS') || input.pressed.has('ArrowDown')) quarter(-1);
      else if (P.wheel && wheelArmed) {
        wheelArmed = false; // one quarter turn per gesture: a trackpad swipe (and its momentum) is one
        quarter(Math.sign(P.wheel));
      }
      if (P.scrolling) wheelAt = s.t;
      else if (!wheelArmed && s.t - wheelAt >= 0.35) wheelArmed = true;

      // Barks and the assist.
      if (s.idle >= 5 && !notFixedSaid && !allTrue()) {
        notFixedSaid = true;
        bark('notFixed');
      }
      if (s.stage === 0 && !allTrue() && (s.sinceTrue >= 15 || s.idle >= (started ? 8 : 10))) {
        s.stage = 1;
        s.stageT = 0;
        if (text.flat) d.thought(text.flat, 3);
        const i = worst();
        if (i >= 0) {
          markSpoke(i);
          turnTo(i);
        }
      } else if (s.stage === 1 && !allTrue() && (s.stageT >= 20 || s.idle >= 20)) {
        s.stage = 2;
        s.stageT = 0;
        s.assisted = true;
        held = null;
        dragging = false;
      }
    } else if (s.stageT >= 0.45 && easeT >= 1 && !pending) {
      // The assist finishes it: to each bad spoke, a quarter turn at a time, plucking as it goes.
      s.stageT = 0;
      const i = worst();
      if (i >= 0) {
        if (at() !== i || Math.abs(pos - Math.round(pos)) > 1e-3) {
          markSpoke(i);
          turnTo(i);
        } else quarter(T[i] < 1 ? 1 : -1);
      }
    }

    rig.setAngle(angleOf(pos));
    gauge();
    if (allTrue() && easeT >= 1 && !pending && s.t - pluckAt >= 0.4) {
      // True: one clear pluck of the note, and the rim runs silent.
      doneT = s.t;
      mark.visible = false;
      vib[at()] = 0;
      pluck(audio, f0);
      lastF = f0;
      lastOver = false;
      if (s.assisted) {
        const a = text.assisted ?? H.assisted;
        if (a) ui.thought(a.text ?? a, 2.6, { who: a.who || who });
      }
    }
    return false;
  });

  P.dispose();
  ui.prompt(null);
  ui.gauge(null);
  const skipped = r === 'skipped';
  if (skipped) T.fill(1);
  rig.setLateral(null);
  rig.setWobble(0);
  rig.onRub = prevRub;
  dust.dispose();
  rig.setSpin(0.6);
  tick.removeFromParent();
  mark.removeFromParent();
  for (const m of [tick, mark]) {
    m.geometry.dispose();
    m.material.dispose();
  }
  // Let the last shiver ring out, then give the spokes their own material back.
  offShiver();
  let left = 0.7;
  offShiver = ctx.world.onUpdate((dt, raw) => {
    left -= raw;
    if (shiver(raw) && left > 0) return;
    offShiver();
    posAttr.array.set(rest);
    posAttr.needsUpdate = true;
    sp.material = baseMat;
    geo.deleteAttribute('color');
    mat.dispose();
  });
  return { skipped, assisted: s.assisted, plucks: s.plucks, secs: Math.round(s.t * 10) / 10, overTight: s.overTight };
}
