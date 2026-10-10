import { openStage, cachedLayer, bottomShade, drawGhost, pickLine, gameText, strideBuzz, clamp, lerp, rng, HAND, INK } from './lib/games-b-stage.js';

// STENCIL (docs/DESIGN-R4.md; docs/SCRIPT-R4.md §7.6.3, Ch6 Week 7, Jo's date): a fine-line swallow
// printed on transfer paper on her light table, traced in one continuous line with the mouse held down.
// The ink only advances while the pen follows the line; steady speed gives a clean purple line, too slow
// and the hand trembles (a visible wobble), too fast and the pen skips (gaps). Jo comments, delighted
// whatever happens.
//
//   await playGame('stencil', ctx, d, {
//     text,           // L.games.stencil: { hint, gauge, band: {slow, fast, good}, lines: {slow, fast,
//                     //   steady} (or flat: slow, fast, steady), tiers: {good, middle, poor}, buzz,
//                     //   buzzJo, buzzReply }   lines are strings or arrays (a random pick)
//     who = 'Jo',
//     mode = 'line',  // 'line': the swallow as one path (about 6–8 s at a good pace); 'strokes': eight
//     idle = 5,       // seconds without input before her hand guides his (tier middle at best)
//   })  -> { tier (skip: middle), score (0..1), image (PNG data URL of the traced stencil), assisted,
//            coverage (inked share), wobble, slow / fast (share of the line drawn too slow / too fast),
//            paceMax, skipped }
// The module's own extra lines (intro, off, lift, assist) only play when no `text` is given (gameText()).

const NB = '\u202f'; // narrow no-break space
const FR = {
  who: 'Jo',
  hint: 'Maintenir le clic et suivre le dessin, à vitesse égale',
  gauge: 'TRAIT',
  band: { slow: 'TREMBLE', fast: 'SAUTE', good: 'BIEN' },
  lines: {
    slow: [`Ça tremble. T’as peur du papier${NB}?`, 'Avance. Le papier mord pas.'],
    fast: ['Tu sautes. C’est pas une course, champion.', 'Wo. C’est une hirondelle, pas un sprint.'],
    steady: 'Là. Là, c’est beau.',
    // Extras (not in the script): quiet once the chapter passes `text`.
    intro: `Tu suis la ligne. Pas trop vite, pas trop lent. Comme une job de nuit${NB}: régulier.`,
    off: ['Câline, t’es rendu dans le ciel.', 'La ligne est là. Juste là.'],
    lift: 'Tu peux lever le crayon. Tu reprends au point.',
    assist: 'Donne ta main. Je te montre le rythme.',
  },
  tiers: {
    good: 'Ben là. C’est propre. J’aime pas ça, je voulais rire.',
    middle: 'Ta ligne avance comme un gars qui pense à sa ligne.',
    poor: 'C’est tout croche. C’est parfait. J’adore.',
  },
  buzz: `FRÉQUENCE CARDIAQUE ÉLEVÉE. SÉANCE INTENSE${NB}?`,
  buzzJo: 'Ta montre trouve que t’as le cœur qui bat vite.',
  buzzReply: 'Elle exagère. Un peu.',
};
const EXTRAS = ['lines.intro', 'lines.off', 'lines.lift', 'lines.assist'];

const TAU = Math.PI * 2;
const SHEET = { x: 760, y: 318, w: 700, h: 520 };
const ART = { cx: 580, cy: 330, s: 0.78 }; // the swallow's local box (0..1000 x 0..700) into the sheet
const STEP = 3; // design px between path samples
const SLOW = 120; // design px/s: under this the hand wobbles
const FAST = 620; // over this the pen skips
const TOL = 42; // how far off the line the pen may be and still follow it
const PURPLE = '#5b2f93';

// The swallow, in fine line: one entry per traced stroke (M / C / Q commands, local units).
// Head and back, throat and belly, two tail streamers, the raised wing, the lower wing, two feathers.
const SWALLOW = [
  [['M', 268, 287], ['C', 288, 255, 338, 240, 382, 258], ['C', 432, 280, 500, 305, 560, 330]],
  [['M', 270, 293], ['C', 285, 320, 332, 342, 402, 352], ['C', 470, 362, 522, 352, 562, 341]],
  [['M', 560, 330], ['C', 680, 302, 800, 270, 912, 236], ['C', 800, 288, 690, 322, 588, 343]],
  [['M', 588, 345], ['C', 700, 372, 812, 410, 920, 446], ['C', 800, 426, 690, 386, 562, 343]],
  [['M', 395, 266], ['C', 420, 178, 522, 84, 664, 38], ['C', 614, 108, 594, 150, 562, 186], ['Q', 548, 204, 532, 214], ['Q', 518, 236, 503, 248], ['Q', 492, 270, 478, 292]],
  [['M', 432, 352], ['C', 404, 440, 332, 542, 244, 622], ['C', 318, 584, 380, 524, 420, 482], ['Q', 452, 448, 470, 422], ['Q', 492, 394, 502, 358]],
  [['M', 446, 238], ['C', 494, 176, 548, 128, 604, 92]],
  [['M', 440, 392], ['C', 410, 446, 372, 498, 330, 546]],
];

/** A stroke's commands as a dense polyline in design px: [[x, y], ...]. */
function rawPoints(cmds) {
  const raw = [];
  let cx = 0;
  let cy = 0;
  const T = (x, y) => [SHEET.x + (x - ART.cx) * ART.s, SHEET.y + (y - ART.cy) * ART.s];
  for (const c of cmds) {
    if (c[0] === 'M') {
      [cx, cy] = [c[1], c[2]];
      raw.push(T(cx, cy));
    } else if (c[0] === 'C') {
      for (let i = 1; i <= 32; i++) {
        const t = i / 32;
        const u = 1 - t;
        const x = u * u * u * cx + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5];
        const y = u * u * u * cy + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
        raw.push(T(x, y));
      }
      [cx, cy] = [c[5], c[6]];
    } else if (c[0] === 'Q') {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        raw.push(T(u * u * cx + 2 * u * t * c[1] + t * t * c[3], u * u * cy + 2 * u * t * c[2] + t * t * c[4]));
      }
      [cx, cy] = [c[3], c[4]];
    }
  }
  return raw;
}

/** Sample a stroke's commands into an even polyline (design px): { x, y (Float32Array), len, n }. */
const sampleStroke = (cmds) => resample(rawPoints(cmds));

/** An even polyline (STEP apart) through raw points. */
function resample(raw) {
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const len = cum[cum.length - 1];
  const n = Math.max(2, Math.ceil(len / STEP) + 1);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * len;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const k = (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    xs[i] = lerp(raw[j][0], raw[j + 1][0], k);
    ys[i] = lerp(raw[j][1], raw[j + 1][1], k);
  }
  return { x: xs, y: ys, len, n, step: len / (n - 1) };
}

/**
 * The swallow as one continuous line (docs/SCRIPT-R4.md §7.6.3; fine-line work is often one line): from
 * the head along the back, out round the raised wing and back, on along the back, out along both tail
 * streamers, home along the belly with a detour round the lower wing. The two small feathers stay print.
 */
function oneLine() {
  const P = SWALLOW.map(rawPoints);
  const T = (x, y) => [SHEET.x + (x - ART.cx) * ART.s, SHEET.y + (y - ART.cy) * ART.s];
  const near = (pts, [x, y]) => {
    let best = 0;
    let bd = Infinity;
    pts.forEach((p, i) => {
      const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    return best;
  };
  const back = P[0];
  const belly = P[1].slice().reverse();
  const wingUp = P[4];
  const wingDown = P[5].slice().reverse();
  const b0 = near(back, T(395, 266));
  const b1 = near(back, wingUp[wingUp.length - 1]);
  const l0 = near(belly, wingDown[0]);
  const l1 = near(belly, wingDown[wingDown.length - 1]);
  return resample([
    ...back.slice(0, b0 + 1),
    ...wingUp,
    ...back.slice(b1),
    ...P[2],
    ...P[3],
    ...belly.slice(0, l0 + 1),
    ...wingDown,
    ...belly.slice(l1),
  ]);
}

/** Jo's station: black vinyl, a purple carbon edge under the sheet, ink caps, her stencil pen. */
function drawStation(g, S, strokes, meterWords) {
  const b = S.bounds();
  const R = rng(34);
  const bg = g.createRadialGradient(SHEET.x, SHEET.y, 100, SHEET.x, SHEET.y, 1100);
  bg.addColorStop(0, '#2a2326');
  bg.addColorStop(0.6, '#1a1517');
  bg.addColorStop(1, '#0d0a0b');
  g.fillStyle = bg;
  g.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
  // Oxblood warmth from her lamp, top left.
  const lamp = g.createRadialGradient(300, 0, 20, 300, 0, 900);
  lamp.addColorStop(0, 'rgba(160, 60, 70, 0.28)');
  lamp.addColorStop(1, 'rgba(107, 36, 48, 0)');
  g.fillStyle = lamp;
  g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255, 255, 255, ${R() * 0.035})`;
    g.fillRect(b.x0 + R() * (b.x1 - b.x0), b.y0 + R() * (b.y1 - b.y0), 1.5, 1.5);
  }
  // The carbon sheet, offset under the paper.
  g.save();
  g.translate(SHEET.x + 14, SHEET.y + 10);
  g.rotate(0.025);
  g.fillStyle = '#3f2266';
  g.shadowColor = 'rgba(0, 0, 0, 0.6)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 10;
  g.fillRect(-SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  g.restore();
  // The transfer sheet: thin, a little translucent (the carbon shows through as a cool tint).
  g.save();
  g.translate(SHEET.x, SHEET.y);
  g.rotate(-0.012);
  g.fillStyle = '#f3f1ec';
  g.fillRect(-SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  const tint = g.createLinearGradient(-SHEET.w / 2, 0, SHEET.w / 2, 0);
  tint.addColorStop(0, 'rgba(120, 100, 170, 0.07)');
  tint.addColorStop(1, 'rgba(120, 100, 170, 0.02)');
  g.fillStyle = tint;
  g.fillRect(-SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  // Perforated top strip of a thermal stencil.
  g.fillStyle = 'rgba(60, 50, 80, 0.12)';
  for (let x = -SHEET.w / 2 + 14; x < SHEET.w / 2; x += 18) g.fillRect(x, -SHEET.h / 2 + 10, 6, 3);
  g.restore();
  // The printed design: hairline grey, as from the thermal printer.
  g.save();
  g.strokeStyle = 'rgba(70, 72, 84, 0.62)';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const st of strokes) {
    g.beginPath();
    g.moveTo(st.x[0], st.y[0]);
    for (let i = 1; i < st.n; i++) g.lineTo(st.x[i], st.y[i]);
    g.stroke();
  }
  // The eye, three dots by the tail, the date line underneath: printed, not traced.
  const T = (x, y) => [SHEET.x + (x - ART.cx) * ART.s, SHEET.y + (y - ART.cy) * ART.s];
  g.fillStyle = 'rgba(50, 50, 60, 0.75)';
  const [ex, ey] = T(318, 276);
  g.beginPath();
  g.arc(ex, ey, 3.2, 0, TAU);
  g.fill();
  for (let i = 0; i < 3; i++) {
    const [dx, dy] = T(820 + i * 26, 520 + i * 14);
    g.beginPath();
    g.arc(dx, dy, 2.2, 0, TAU);
    g.fill();
  }
  g.restore();
  // Ink caps and her stencil pen, left.
  for (let i = 0; i < 3; i++) {
    const x = 210 + i * 64;
    const y = 470 - i * 30;
    g.fillStyle = '#d9d6cf';
    g.beginPath();
    g.ellipse(x, y, 24, 20, 0, 0, TAU);
    g.fill();
    g.fillStyle = i === 1 ? '#7d1d2c' : '#0b0b0c';
    g.beginPath();
    g.ellipse(x, y - 2, 18, 14, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath();
    g.ellipse(x - 6, y - 7, 6, 2.5, -0.4, 0, TAU);
    g.fill();
  }
  g.save();
  g.translate(250, 210);
  g.rotate(0.9);
  g.fillStyle = '#6b4aa6';
  g.fillRect(-90, -7, 170, 14);
  g.fillStyle = '#2a2a2c';
  g.fillRect(80, -7, 30, 14);
  g.fillStyle = '#d9d6cf';
  g.beginPath();
  g.moveTo(-90, -7);
  g.lineTo(-112, 0);
  g.lineTo(-90, 7);
  g.fill();
  g.restore();
  // The speed scale, pencil on a scrap of card, right of the sheet.
  g.save();
  g.translate(1235, 320);
  g.rotate(0.02);
  g.fillStyle = '#d9d3c2';
  g.shadowColor = 'rgba(0, 0, 0, 0.5)';
  g.shadowBlur = 12;
  g.fillRect(-58, meterWords.title ? -214 : -180, 116, meterWords.title ? 394 : 360);
  g.shadowColor = 'transparent';
  g.strokeStyle = INK.pencil;
  g.lineWidth = 2;
  g.strokeRect(-14, -150, 28, 300);
  g.fillStyle = 'rgba(156, 214, 112, 0.45)';
  const y0 = meterY(SLOW);
  const y1 = meterY(FAST);
  g.fillRect(-13, y1, 26, y0 - y1);
  g.fillStyle = INK.pencil;
  g.font = `20px ${HAND}`;
  g.textAlign = 'center';
  if (meterWords.title) {
    g.font = `bold 22px ${HAND}`;
    g.fillText(meterWords.title, 0, -188);
    g.font = `20px ${HAND}`;
  }
  g.fillText(meterWords.fast, 0, -158);
  g.fillText(meterWords.slow, 0, 172);
  g.save();
  g.translate(30, (y0 + y1) / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(meterWords.ok, 0, 6);
  g.restore();
  g.restore();
}

/** Speed (design px/s) to the scale's local y (bottom = slow). */
const meterY = (v) => 150 - clamp(v / 900, 0, 1) * 300;

export const id = 'stencil';

export async function play(ctx, d, opts = {}) {
  const T = gameText(FR, opts, EXTRAS);
  // Barks live under lines.<k>, or flat at the top of the text (the script lists them both ways).
  const L = { ...(T.lines || {}) };
  for (const k of ['slow', 'fast', 'steady']) if (opts.text?.[k]) L[k] = opts.text[k];
  const who = opts.who || T.who || ctx.L?.names?.jo || FR.who;
  const idleAfter = opts.idle ?? 5;
  const print = SWALLOW.map(sampleStroke);
  const strokes = opts.mode === 'strokes' ? print : [oneLine()];
  const total = strokes.reduce((a, s) => a + s.len, 0);
  const S = openStage(ctx, d, { cls: 'gb-stencil', cursor: 'none' });
  const { g, ui } = S;
  S.layer.gbStrokes = strokes; // tests trace these
  const bg = cachedLayer(S, (cg) => drawStation(cg, S, print, { slow: T.band?.slow, ok: T.band?.good, fast: T.band?.fast, title: T.gauge }));
  const memo = {};
  const audio = ctx.audio;

  // The ink, on its own canvas at 2x design over the sheet's box: drawn as it goes, blitted per frame.
  const IK = 2;
  const ix0 = SHEET.x - SHEET.w / 2;
  const iy0 = SHEET.y - SHEET.h / 2;
  const ink = document.createElement('canvas');
  ink.width = SHEET.w * IK;
  ink.height = SHEET.h * IK;
  const ig = ink.getContext('2d');
  ig.setTransform(IK, 0, 0, IK, -ix0 * IK, -iy0 * IK);
  ig.lineCap = 'round';
  ig.lineJoin = 'round';

  // A neighbour's machine buzzing in the back of the shop (low, in bursts).
  let buzz = null;
  try {
    if (audio?.ctx && audio.bus) {
      const ac = audio.ctx;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 118;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 640;
      const gn = ac.createGain();
      gn.gain.value = 0;
      o.connect(f).connect(gn).connect(audio.bus);
      o.start();
      buzz = { o, gn, on: false, next: 1.5 };
    }
  } catch {
    buzz = null;
  }

  let si = 0; // stroke index
  let sp = 0; // inked arc length along the current stroke
  let tracing = false;
  let pace = 0; // design px/s along the line (smoothed); what the slow / fast rule reads
  let last = null; // last ink point {x, y} (null = pen up / gap)
  let inked = 0;
  let wobSum = 0;
  let offSum = 0;
  let samples = 0;
  let slowN = 0;
  let fastN = 0;
  let paceMax = 0;
  let lifts = 0;
  let assisted = false;
  let ghost = null; // { x, y, k }
  let tipAt = -1e9;
  let steadyT = 0; // seconds in the band without a flaw
  let buzzed = false;
  let doneLen = 0; // length of the strokes already traced
  let strokeFlaw = false;
  let doneT = -1;
  let hissAt = 0;
  const stats = { slow: 0, fast: 0, off: 0 };

  const tip = (line, gap = 4) => {
    if (!line || S.ptr.t - tipAt < gap) return;
    tipAt = S.ptr.t;
    S.say(who, line, 2.8);
  };
  const setPhase = (ph) => (S.layer.dataset.phase = `${ph}:${si}`); // tests read it
  const at = (st, u) => {
    const f = clamp(u / st.step, 0, st.n - 1);
    const i = Math.min(st.n - 2, Math.floor(f));
    const k = f - i;
    return [lerp(st.x[i], st.x[i + 1], k), lerp(st.y[i], st.y[i + 1], k), st.x[i + 1] - st.x[i], st.y[i + 1] - st.y[i]];
  };
  /** Nearest arc length on stroke st to (x, y), searched in [a, b]. */
  const nearest = (st, x, y, a, b) => {
    let best = a;
    let bd = Infinity;
    const i0 = Math.max(0, Math.floor(a / st.step));
    const i1 = Math.min(st.n - 1, Math.ceil(b / st.step));
    for (let i = i0; i <= i1; i++) {
      const dd = (st.x[i] - x) ** 2 + (st.y[i] - y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i * st.step;
      }
    }
    return [best, Math.sqrt(bd)];
  };
  /** Ink up to arc length b on stroke st (from the ink cursor), with the pen's offset, wobble (slow) and skips (fast). */
  let inkU = 0; // arc length inked so far on the current stroke (whole STEPs; sp may run a little ahead)
  const inkTo = (st, b, px, py, v) => {
    const slowK = clamp((SLOW - v) / SLOW, 0, 1);
    const fastK = clamp((v - FAST) / FAST, 0, 1);
    for (; inkU + STEP <= b + 1e-3; ) {
      inkU += STEP;
      const u = inkU;
      const [x, y, tx, ty] = at(st, u);
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      // How far the pen is from the line (signed), softened: the hand drags the line with it a bit.
      const off = clamp((px - x) * nx + (py - y) * ny, -14, 14) * 0.45;
      const wob = slowK * 4.2 * (Math.sin(u * 0.23 + S.ptr.t * 9) * 0.6 + Math.sin(u * 0.71 + S.ptr.t * 23) * 0.4);
      const skip = fastK > 0.05 && (u / 22) % 1 < 0.25 + 0.6 * fastK;
      samples++;
      if (slowK > 0.25) slowN++;
      if (fastK > 0.04) fastN++;
      paceMax = Math.max(paceMax, v);
      wobSum += Math.abs(wob) / 4.2;
      offSum += Math.abs(off) / 6.3;
      if (skip) {
        last = null;
        continue;
      }
      inked += STEP;
      const ox = x + nx * (off + wob);
      const oy = y + ny * (off + wob);
      if (last) {
        ig.strokeStyle = 'rgba(91, 47, 147, 0.22)';
        ig.lineWidth = 4.2;
        ig.beginPath();
        ig.moveTo(last.x, last.y);
        ig.lineTo(ox, oy);
        ig.stroke();
        ig.strokeStyle = PURPLE;
        ig.lineWidth = 1.9;
        ig.stroke();
      }
      last = last || { x: 0, y: 0 };
      last.x = ox;
      last.y = oy;
    }
    if (slowK > 0.3) {
      stats.slow += 1;
      strokeFlaw = true;
    }
    if (fastK > 0.1) {
      stats.fast += 1;
      strokeFlaw = true;
    }
    return { slowK, fastK };
  };
  const nextStroke = () => {
    audio?.tick?.({ volume: 0.1 });
    strokeFlaw = false;
    doneLen += strokes[si].len;
    si++;
    sp = 0;
    inkU = 0;
    last = null;
    tracing = false;
    setPhase(si >= strokes.length ? 'done' : 'trace');
  };

  ui?.prompt(T.hint);
  S.say(who, L.intro, 3.6);
  setPhase('trace');

  const r = await d.until(() => {
    const raw = ctx.engine.rawDt || 0.016;
    const P = S.frame(raw);
    if (buzz && audio.ok) {
      buzz.next -= raw;
      if (buzz.next <= 0) {
        buzz.on = !buzz.on;
        buzz.next = buzz.on ? 1.5 + Math.random() * 2.5 : 1 + Math.random() * 3;
        buzz.gn.gain.setTargetAtTime(buzz.on ? 0.006 : 0, audio.ctx.currentTime, 0.08);
      }
    }

    if (si < strokes.length) {
      const st = strokes[si];
      const [sx, sy] = at(st, sp);
      if (!ghost) {
        if (P.pressed && Math.hypot(P.x - sx, P.y - sy) < 38) {
          tracing = true;
          last = null;
          pace = 260; // a fresh stroke starts neutral, not from the hop to the dot
        }
        if (tracing && P.down) {
          const [u, dist] = nearest(st, P.x, P.y, Math.max(0, sp - 9), sp + 70);
          pace += (Math.max(0, u - sp) / raw - pace) * (1 - Math.exp(-9 * raw));
          if (dist < TOL) {
            if (u > sp) {
              const { slowK, fastK } = inkTo(st, u, P.x, P.y, pace);
              sp = u;
              if (slowK > 0.6) tip(pickLine(L.slow, memo));
              else if (fastK > 0.25) tip(pickLine(L.fast, memo));
              // A good stretch: in the band for a while.
              steadyT = slowK > 0.3 || fastK > 0.1 ? 0 : steadyT + raw;
              if (steadyT > 2.5) {
                steadyT = 0;
                tip(pickLine(L.steady, memo));
              }
              // STRIDE, once, when she leans in to look (mid-trace).
              if (!buzzed && T.buzz && (doneLen + sp) / total > 0.42) {
                buzzed = true;
                tipAt = S.ptr.t + 4; // her barks wait for the gag
                strideBuzz(S, T.buzz, { reply: T.buzzJo, who, delay: 1.6 });
                if (T.buzzReply) setTimeout(() => !S.closed && S.say(null, T.buzzReply, 2.6), 5000);
              }
              if (S.ptr.t - hissAt > 0.09) {
                hissAt = S.ptr.t;
                audio?.noise?.({ type: 'bandpass', freq: 4200, q: 0.9, dur: 0.1, volume: 0.022 * clamp(pace / 400, 0.2, 1) });
              }
            }
          } else {
            stats.off++;
            strokeFlaw = true;
            last = null;
            if (dist > TOL * 1.6) tip(pickLine(L.off, memo));
          }
        }
        if (tracing && P.released && sp < st.len - 6) {
          tracing = false;
          lifts++;
          last = null;
          if (lifts === 2) tip(L.lift);
        }
        if (!tracing && P.idle > idleAfter) {
          ghost = { x: sx, y: sy, k: 0 };
          assisted = true;
          tip(L.assist, 0);
        }
      } else {
        // Her hand on his: a steady, slightly human pace (a touch of wobble at the turns).
        const v = 330;
        const u = Math.min(st.len, sp + v * raw);
        const [gx, gy] = at(st, u);
        ghost.x = gx;
        ghost.y = gy;
        inkTo(st, u, gx + Math.sin(u * 0.05) * 3, gy, v);
        sp = u;
      }
      if (sp >= st.len - 6) {
        inkTo(st, st.len, ...at(st, st.len).slice(0, 2), 300);
        nextStroke();
        if (ghost && si < strokes.length) {
          const [nx, ny] = at(strokes[si], 0);
          ghost.x = nx;
          ghost.y = ny;
        }
      }
    } else {
      ghost = null;
      if (doneT < 0) {
        doneT = 0;
        ui?.prompt(null);
      }
      doneT += raw;
      if (doneT > 0.15 && !S._endSaid) {
        S._endSaid = true;
        S.say(who, pickLine(T.tiers?.[tierOf(score())], memo), 3.8);
      }
      if (doneT > 2.6) return 'done';
    }

    // ------------------------------------------------------------- draw
    S.begin();
    bg.blit(g);
    // The next stroke: its untraced part a little darker, a pulsing start dot where the pen goes down.
    if (si < strokes.length) {
      const st = strokes[si];
      g.save();
      g.strokeStyle = 'rgba(40, 40, 52, 0.85)';
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.beginPath();
      const i0 = Math.floor(sp / st.step);
      g.moveTo(st.x[i0], st.y[i0]);
      for (let i = i0 + 1; i < st.n; i++) g.lineTo(st.x[i], st.y[i]);
      g.stroke();
      if (!tracing && !ghost) {
        const [sx, sy] = at(st, sp);
        const pulse = 0.5 + 0.5 * Math.sin(P.t * 5);
        g.fillStyle = PURPLE;
        g.beginPath();
        g.arc(sx, sy, 6, 0, TAU);
        g.fill();
        g.strokeStyle = `rgba(91, 47, 147, ${0.25 + 0.5 * pulse})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(sx, sy, 14 + pulse * 8, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
    g.drawImage(ink, ix0, iy0, SHEET.w, SHEET.h);
    // The speed needle on the scale.
    const v = ghost ? 330 : tracing && P.down ? pace : 0;
    g.save();
    g.translate(1235, 320);
    g.fillStyle = v > FAST || (tracing && v < SLOW) ? INK.red : INK.pencil;
    const ny = meterY(v);
    g.beginPath();
    g.moveTo(-24, ny);
    g.lineTo(-12, ny - 7);
    g.lineTo(-12, ny + 7);
    g.fill();
    g.fillRect(-14, ny - 1.5, 28, 3);
    g.restore();
    // Stroke count, small, on the sheet's corner (eight-stroke mode).
    if (strokes.length > 1) {
      g.fillStyle = 'rgba(60, 50, 80, 0.7)';
      g.font = `22px ${HAND}`;
      g.textAlign = 'right';
      g.fillText(`${Math.min(si + 1, strokes.length)} / ${strokes.length}`, SHEET.x + SHEET.w / 2 - 18, SHEET.y + SHEET.h / 2 - 16);
      g.textAlign = 'left';
    }
    // The pen (his) or her hand.
    if (ghost) drawGhost(g, ghost.x, ghost.y, true);
    else pen(g, P.x, P.y, tracing && P.down);
    bottomShade(S, 560, 0.7);
    return false;
  });

  ui?.prompt(null);
  if (buzz) {
    try {
      buzz.gn.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      buzz.o.stop(audio.ctx.currentTime + 0.3);
    } catch {
      /* already stopped */
    }
  }
  const skipped = r === 'skipped';
  if (skipped) {
    // Finish the drawing cleanly so the image is whole.
    for (; si < strokes.length; si++) {
      const st = strokes[si];
      last = null;
      inkTo(st, st.len, ...at(st, st.len).slice(0, 2), 300);
      inkU = 0;
    }
  }
  const image = exportImage(print, ink, ix0, iy0);
  S.close();
  const sc = score();
  return {
    tier: skipped ? 'middle' : tierOf(sc),
    score: +sc.toFixed(3),
    image,
    assisted,
    coverage: +(inked / total).toFixed(3),
    wobble: +(wobSum / Math.max(1, samples)).toFixed(3),
    slow: +(slowN / Math.max(1, samples)).toFixed(3),
    fast: +(fastN / Math.max(1, samples)).toFixed(3),
    paceMax: Math.round(paceMax),
    skipped,
  };

  function score() {
    // Coverage (fast skips) and steadiness (time spent too slow or too fast, and off the line).
    const n = Math.max(1, samples);
    const cov = clamp(inked / total, 0, 1);
    const steady = 1 - clamp((0.9 * slowN) / n + (1.2 * fastN) / n + 0.5 * (offSum / n), 0, 1);
    const s = 0.4 * cov + 0.6 * steady - Math.min(0.08, lifts * 0.01);
    return assisted ? Math.min(s, 0.7) : clamp(s, 0, 1);
  }
  function tierOf(s) {
    return s >= 0.8 ? 'good' : s >= 0.6 ? 'middle' : 'poor';
  }
}

/** His stencil pen: a purple barrel leaning up-right from the nib. */
function pen(g, x, y, down) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.75);
  g.fillStyle = 'rgba(0, 0, 0, 0.3)';
  g.fillRect(8, down ? 2 : 8, 120, 12);
  g.fillStyle = '#6b4aa6';
  g.fillRect(10, -6, 120, 12);
  g.fillStyle = '#e6e2da';
  g.beginPath();
  g.moveTo(10, -6);
  g.lineTo(0, 0);
  g.lineTo(10, 6);
  g.fill();
  g.fillStyle = PURPLE;
  g.beginPath();
  g.arc(0, 0, 2.2, 0, TAU);
  g.fill();
  g.restore();
}

/** The traced stencil as a PNG data URL: the sheet, the faint print and the purple line. */
function exportImage(strokes, ink, ix0, iy0) {
  try {
    const c = document.createElement('canvas');
    c.width = SHEET.w;
    c.height = SHEET.h;
    const g = c.getContext('2d');
    g.fillStyle = '#f3f1ec';
    g.fillRect(0, 0, c.width, c.height);
    g.translate(-ix0, -iy0);
    g.strokeStyle = 'rgba(70, 72, 84, 0.35)';
    g.lineWidth = 1.2;
    for (const st of strokes) {
      g.beginPath();
      g.moveTo(st.x[0], st.y[0]);
      for (let i = 1; i < st.n; i++) g.lineTo(st.x[i], st.y[i]);
      g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(ink, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
