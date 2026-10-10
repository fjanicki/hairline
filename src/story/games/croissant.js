import { openStage, cachedLayer, bottomShade, drawGhost, pickLine, gameText, fill, strideBuzz, clamp, lerp, smooth, rng, HAND, INK, SAFE_BOTTOM } from './lib/games-b-stage.js';

// CROISSANT (docs/DESIGN-R4.md; docs/SCRIPT-R4.md §6.5.3, Ch5 Week 3, 4 h 10): Mme Benali's floured
// counter, three croissants. Roll: one steady drag along the dough triangle, wide end to tip. Fold: drag
// the two ends down and in. Steadiness and direction of the roll, then the symmetry of the fold, give
// each croissant's grade (perfect / ok / moon, or fast / slow when the roll's timing is off); Benali
// barks every one (they come out as moons). Colour returns as they bake (egg wash, then gold).
//
//   await playGame('croissant', ctx, d, {
//     text,            // L.games.croissant: { hint, cue: {roll, fold}, counter ('Croissant {n}/3'),
//                      //   grades: {perfect, ok, moon, fast, slow}, assist, tiers: {good, middle, poor},
//                      //   buzz, buzzReply }   lines are strings or arrays (a random pick)
//     who = 'Mme Benali',
//     count = 3,
//     idle = 8,        // seconds without input before her hands do that croissant (graded ok)
//   })  -> { tier (by perfect count: all / >= 1 / none; skip: middle), perfect, score (0..1),
//            croissants: [{ grade, score, roll, curve, rollSecs, assisted }], skipped }
// The module's own extra lines (intro, tips) only play when no `text` is given (see gameText()).

const NB = '\u202f'; // narrow no-break space
const FR = {
  who: 'Mme Benali',
  hint: 'Rouler : glisser du côté large vers la pointe, d’un seul geste · Plier : glisser les deux bouts vers le bas',
  cue: { roll: `Rouler${NB}!`, fold: `Plier${NB}!` },
  counter: 'Croissant {n}/{count}',
  grades: {
    perfect: 'Ça, c’est un croissant.',
    ok: 'Un croissant de lune. Il fera l’affaire.',
    moon: ['C’est une lune. Encore une.', 'Pleine lune, celle-là. Elle n’est même plus croissante.'],
    fast: 'Doucement. La pâte n’est pas en retard.',
    slow: 'Vous la réchauffez avec les mains. Elle n’aime pas ça.',
  },
  assist: 'Laissez. Regardez mes mains.',
  tiers: {
    good: `Pas une lune. Vous êtes sûr de n’avoir jamais fait ça${NB}?`,
    middle: 'Moitié croissants, moitié lunes. Ça fait un beau ciel.',
    poor: 'Que des lunes. C’est un calendrier.',
  },
  buzz: `PÉTRISSAGE DÉTECTÉ. LANCER LA SÉANCE${NB}?`,
  buzzReply: '…Non. Mais j’y ai pensé.',
  // Extras (not in the script): quiet once the chapter passes `text`.
  intro: 'Du côté large vers la pointe. Sans appuyer. On ne repasse pas.',
  tips: {
    start: 'Par le côté large, monsieur Revel. La pointe, c’est la fin.',
    wobble: 'Droit devant. La pâte n’aime pas qu’on hésite.',
    lift: 'On ne lâche pas en route.',
  },
};
const EXTRAS = ['intro', 'tips.start', 'tips.wobble', 'tips.lift'];
// Roll timing (s): under `fast` or over `slow` grades the croissant fast / slow (the script's good band is
// 0.6–1.4 s; these are the edges past which Benali says so).
const TIMING = { fast: 0.5, slow: 2.6 };

const TAU = Math.PI * 2;
const CX = 800; // dough centre
const BASE_Y = 520; // the triangle's wide end
const TIP_Y = 150;
const BASE_W = 440;
const C_Y = 335; // the shaped croissant's centre
const HALF = 235; // half-length of the rolled log
const THETA = 1.5; // end angle (rad) at bend 1
const TARGET = 0.8; // the crescent's ideal bend
const N = 18; // centreline points per side

// Raw dough to baked: two palettes the croissant blends between as it bakes.
const RAW = ['#fbedcf', '#efd8aa', '#d7b884', '#b9976a'];
const GOLD = ['#f6c46a', '#d8892f', '#a95a1d', '#6d3410'];
const mixHex = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

/** The counter: wooden planks, a flour drift, the rolling pin, the egg-wash bowl and the tray. */
function drawCounter(g, S) {
  const b = S.bounds();
  const R = rng(52);
  // Planks (beech, warm), across the whole window.
  g.fillStyle = '#9c7048';
  g.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
  const plank = 118;
  for (let y = Math.floor(b.y0 / plank) * plank; y < b.y1; y += plank) {
    const tone = 0.9 + R() * 0.2;
    g.fillStyle = `rgb(${Math.round(164 * tone)},${Math.round(120 * tone)},${Math.round(80 * tone)})`;
    g.fillRect(b.x0 - 2, y + 2, b.x1 - b.x0 + 4, plank - 3);
    g.strokeStyle = 'rgba(60, 36, 18, 0.18)';
    g.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) {
      const yy = y + 8 + R() * (plank - 16);
      g.beginPath();
      g.moveTo(b.x0, yy);
      for (let x = b.x0; x < b.x1; x += 80) g.lineTo(x + 80, yy + Math.sin(x * 0.004 + k) * 3 + (R() - 0.5) * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(40, 24, 12, 0.5)';
    g.fillRect(b.x0 - 2, y, b.x1 - b.x0 + 4, 2.5);
  }
  // Flour: overlapping soft drifts under the dough (thicker where the dough was worked), then specks.
  for (let i = 0; i < 9; i++) {
    const fx = CX + (R() - 0.5) * 520;
    const fy = 340 + (R() - 0.5) * 300;
    const rr = 140 + R() * 200;
    const fl = g.createRadialGradient(fx, fy, 10, fx, fy, rr);
    fl.addColorStop(0, `rgba(248, 244, 234, ${0.32 + R() * 0.2})`);
    fl.addColorStop(0.6, 'rgba(244, 238, 224, 0.14)');
    fl.addColorStop(1, 'rgba(244, 238, 224, 0)');
    g.fillStyle = fl;
    g.beginPath();
    g.ellipse(fx, fy, rr * 1.3, rr * 0.8, R() - 0.5, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 1600; i++) {
    const a = R() * TAU;
    const r = Math.pow(R(), 0.6) * 620;
    const x = CX + Math.cos(a) * r * 1.4;
    const y = 340 + Math.sin(a) * r * 0.75;
    g.fillStyle = `rgba(250, 247, 240, ${0.18 + R() * 0.5})`;
    g.fillRect(x, y, 1 + R() * 2.4, 1 + R() * 2.4);
  }
  // Finger marks in the flour.
  g.strokeStyle = 'rgba(160, 120, 80, 0.16)';
  g.lineCap = 'round';
  g.lineWidth = 10;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(560 + i * 18, 560);
    g.quadraticCurveTo(540 + i * 22, 600, 500 + i * 30, 610);
    g.stroke();
  }
  // Rolling pin, top left.
  g.save();
  g.translate(250, 210);
  g.rotate(-0.42);
  g.shadowColor = 'rgba(40, 20, 8, 0.45)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  const pin = g.createLinearGradient(0, -30, 0, 30);
  pin.addColorStop(0, '#e9c48e');
  pin.addColorStop(0.45, '#c99a5e');
  pin.addColorStop(1, '#8f6234');
  g.fillStyle = pin;
  g.beginPath();
  g.roundRect(-190, -30, 380, 60, 26);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = '#7a5028';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.roundRect(s > 0 ? 186 : -256, -12, 70, 24, 10);
    g.fill();
  }
  g.fillStyle = 'rgba(250, 246, 236, 0.5)';
  g.fillRect(-150, -18, 280, 6);
  g.restore();
  // Egg-wash bowl and brush, bottom left.
  g.save();
  g.translate(300, 470);
  g.shadowColor = 'rgba(40, 20, 8, 0.4)';
  g.shadowBlur = 20;
  g.shadowOffsetY = 8;
  g.fillStyle = '#e8e2d4';
  g.beginPath();
  g.arc(0, 0, 78, 0, TAU);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = '#2f5d7a';
  g.beginPath();
  g.arc(0, 0, 78, 0, TAU);
  g.lineWidth = 7;
  g.strokeStyle = '#2f5d7a';
  g.stroke();
  const yolk = g.createRadialGradient(-14, -12, 6, 0, 0, 62);
  yolk.addColorStop(0, '#ffd56a');
  yolk.addColorStop(1, '#e8a22c');
  g.fillStyle = yolk;
  g.beginPath();
  g.arc(0, 0, 62, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.55)';
  g.beginPath();
  g.ellipse(-22, -24, 16, 7, -0.6, 0, TAU);
  g.fill();
  g.rotate(0.7);
  g.fillStyle = '#6b4a2a';
  g.fillRect(30, -6, 140, 12);
  g.fillStyle = '#d8c39a';
  g.fillRect(0, -9, 36, 18);
  g.restore();
  // The tray, right: a black steel sheet with baking paper.
  g.save();
  g.shadowColor = 'rgba(30, 16, 6, 0.5)';
  g.shadowBlur = 26;
  g.shadowOffsetY = 12;
  g.fillStyle = '#2b2a28';
  g.beginPath();
  g.roundRect(1190, 110, 330, 470, 14);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = '#e9dfc8';
  g.beginPath();
  g.roundRect(1206, 126, 298, 438, 6);
  g.fill();
  g.strokeStyle = 'rgba(120, 90, 50, 0.08)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(1210 + R() * 290, 130);
    g.lineTo(1210 + R() * 290, 560);
    g.stroke();
  }
  g.restore();
}

/** Croissant geometry: centreline points and half-widths for bends (bl, br), into reused arrays. */
function shape(geo, bl, br, roll, asym) {
  const { px, py, nx, ny, w } = geo;
  const thick = lerp(14, 64, Math.sqrt(roll));
  const len = HALF * lerp(1, 0.93, roll);
  const step = len / N;
  const mid = N;
  px[mid] = 0;
  py[mid] = 0;
  nx[mid] = 0;
  ny[mid] = -1;
  w[mid] = thick;
  for (const side of [1, -1]) {
    const bend = side > 0 ? br : bl;
    let x = 0;
    let y = 0;
    for (let i = 1; i <= N; i++) {
      const s = i / N;
      const th = bend * THETA * Math.pow(s, 1.15);
      // Right side heads +x and turns down (clockwise); the left mirrors it.
      const dx = Math.cos(th) * side;
      const dy = Math.sin(th);
      x += dx * step;
      y += dy * step;
      const j = mid + side * i;
      px[j] = x;
      py[j] = y;
      // Outward normal (the crescent's back, up when the ends bend down): the tangent turned a quarter.
      nx[j] = side > 0 ? dy : -dy;
      ny[j] = side > 0 ? -dx : dx;
      const taper = 1 - 0.95 * Math.pow(s, 1.9);
      w[j] = thick * taper * (1 + asym * side * s * 0.5);
    }
  }
  // Recentre on the bounding box, so a bent croissant stays where the log was.
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let j = 0; j <= 2 * N; j++) {
    y0 = Math.min(y0, py[j] - w[j]);
    y1 = Math.max(y1, py[j] + w[j]);
  }
  geo.cy = -(y0 + y1) / 2;
  return geo;
}

function makeGeo() {
  const n = 2 * N + 1;
  return { px: new Float32Array(n), py: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), w: new Float32Array(n), cy: 0 };
}

/** Draw a croissant (geo from shape()) at (x, y), scale s, bake 0..1, shine 0..1 (the egg wash). */
function drawCroissant(g, geo, x, y, s, bake, shine = 0, shadow = true) {
  const { px, py, nx, ny, w } = geo;
  const n = 2 * N + 1;
  g.save();
  g.translate(x, y + geo.cy * s);
  g.scale(s, s);
  const outline = () => {
    g.beginPath();
    g.moveTo(px[0] + nx[0] * w[0], py[0] + ny[0] * w[0]);
    for (let j = 1; j < n; j++) g.lineTo(px[j] + nx[j] * w[j], py[j] + ny[j] * w[j]);
    for (let j = n - 1; j >= 0; j--) g.lineTo(px[j] - nx[j] * w[j] * 0.92, py[j] - ny[j] * w[j] * 0.92);
    g.closePath();
  };
  const c = [0, 1, 2, 3].map((i) => mixHex(RAW[i], GOLD[i], bake));
  const gr = g.createLinearGradient(0, -70, 0, 70);
  gr.addColorStop(0, c[0]);
  gr.addColorStop(0.35, c[1]);
  gr.addColorStop(0.8, c[2]);
  gr.addColorStop(1, c[3]);
  g.fillStyle = gr;
  outline();
  if (shadow) {
    g.shadowColor = 'rgba(70, 40, 16, 0.38)';
    g.shadowBlur = 18 * s;
    g.shadowOffsetY = 12 * s;
  }
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = mixHex('#c9a678', '#7a3d12', bake);
  g.lineWidth = 1.6;
  g.stroke();
  // Puffed lobes between the rolled layers: a soft light in each, so the body reads as rounds of dough.
  g.save();
  g.clip();
  const lobes = 7;
  for (let k = 0; k < lobes; k++) {
    const j = Math.round(((k + 0.5) / lobes) * (n - 1));
    const lx = px[j] + nx[j] * w[j] * 0.25;
    const ly = py[j] + ny[j] * w[j] * 0.25;
    const rr = Math.max(8, w[j] * 1.1);
    const lg = g.createRadialGradient(lx, ly, rr * 0.1, lx, ly, rr);
    lg.addColorStop(0, bake > 0.5 ? 'rgba(255, 214, 140, 0.42)' : 'rgba(255, 248, 230, 0.5)');
    lg.addColorStop(1, 'rgba(255, 240, 210, 0)');
    g.fillStyle = lg;
    g.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
  }
  g.restore();
  // The rolled layers: curved ridges across the body, darker in the folds.
  g.lineCap = 'round';
  for (let k = 1; k < lobes; k++) {
    const j = Math.round((k / lobes) * (n - 1));
    const ax = px[j] + nx[j] * w[j] * 0.97;
    const ay = py[j] + ny[j] * w[j] * 0.97;
    const bx = px[j] - nx[j] * w[j] * 0.88;
    const by = py[j] - ny[j] * w[j] * 0.88;
    const bow = (j - N) * 1.4;
    g.strokeStyle = mixHex('#c29b69', '#5e2c0c', bake);
    g.globalAlpha = 0.6;
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2 + bow, (ay + by) / 2, bx, by);
    g.stroke();
  }
  // Highlight along the back (and the egg wash's wet shine).
  g.globalAlpha = 0.16 + shine * 0.5;
  g.strokeStyle = shine > 0 ? '#fff6dc' : mixHex('#fffaf0', '#ffe2a0', bake);
  g.lineWidth = 4 + shine * 3;
  g.beginPath();
  for (let j = 6; j < n - 6; j++) {
    const xx = px[j] + nx[j] * w[j] * 0.55;
    const yy = py[j] + ny[j] * w[j] * 0.55;
    if (j === 6) g.moveTo(xx, yy);
    else g.lineTo(xx, yy);
  }
  g.stroke();
  g.restore();
}

/** The flat triangle (rolling): from the roll line at `p` (0 = base) to the tip, plus the log. */
function drawDough(g, p, lean, geo) {
  const yp = lerp(BASE_Y, TIP_Y, p);
  const half = (BASE_W / 2) * (1 - p);
  g.save();
  // Shadow, then the sheet.
  g.fillStyle = 'rgba(90, 60, 30, 0.18)';
  g.beginPath();
  g.moveTo(CX - half + 6 + lean, yp + 10);
  g.lineTo(CX + half + 6 + lean, yp + 10);
  g.lineTo(CX + 6, TIP_Y + 12);
  g.closePath();
  g.fill();
  const gr = g.createLinearGradient(0, TIP_Y, 0, BASE_Y);
  gr.addColorStop(0, '#f8e7c6');
  gr.addColorStop(1, '#eed5a6');
  g.fillStyle = gr;
  g.strokeStyle = '#d7b98a';
  g.lineWidth = 2;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(CX - half + lean, yp);
  g.lineTo(CX + half + lean, yp);
  g.lineTo(CX, TIP_Y);
  g.closePath();
  g.fill();
  g.stroke();
  // Laminated look: faint parallel lines and a few bubbles.
  g.strokeStyle = 'rgba(200, 160, 110, 0.22)';
  g.lineWidth = 1;
  for (let k = 1; k < 7; k++) {
    const yy = lerp(yp, TIP_Y, k / 7);
    const hw = half * (1 - k / 7);
    g.beginPath();
    g.moveTo(CX - hw * 0.9 + lean * (1 - k / 7), yy);
    g.lineTo(CX + hw * 0.9 + lean * (1 - k / 7), yy);
    g.stroke();
  }
  g.restore();
  // The rolled log at the roll line.
  if (p > 0.01) {
    shape(geo, 0, 0, p, 0);
    drawCroissant(g, geo, CX + lean, yp - 4, 1, 0, 0, true);
  }
}

/** A pencil arrow with a dashed shaft (the gesture guide). */
function guideArrow(g, pts, a = 1) {
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = INK.pencil;
  g.lineWidth = 3;
  g.setLineDash([10, 9]);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  if (pts.length === 6) g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else g.lineTo(pts[2], pts[3]);
  g.stroke();
  g.setLineDash([]);
  const n = pts.length;
  const ex = pts[n - 2];
  const ey = pts[n - 1];
  const ang = Math.atan2(ey - pts[n - 3], ex - pts[n - 4]);
  g.beginPath();
  g.moveTo(ex - Math.cos(ang - 0.45) * 18, ey - Math.sin(ang - 0.45) * 18);
  g.lineTo(ex, ey);
  g.lineTo(ex - Math.cos(ang + 0.45) * 18, ey - Math.sin(ang + 0.45) * 18);
  g.stroke();
  g.restore();
}

export const id = 'croissant';

/** The end tier, by perfect croissants: all of them / at least one / none. */
const tierOf = (results) => {
  const n = results.filter((x) => x.grade === 'perfect').length;
  return n >= results.length ? 'good' : n >= 1 ? 'middle' : 'poor';
};

export async function play(ctx, d, opts = {}) {
  const T = gameText(FR, opts, EXTRAS);
  const who = opts.who || T.who || ctx.L?.names?.benali || FR.who;
  const count = Math.max(1, opts.count ?? 3);
  const idleAfter = opts.idle ?? 8;
  const S = openStage(ctx, d, { cls: 'gb-croissant', cursor: 'grab' });
  const { g, ui } = S;
  const bg = cachedLayer(S, (cg) => drawCounter(cg, S));
  const memo = {};
  const geo = makeGeo();
  const done = []; // finished croissants on the tray: {geo, x, y, rot, bake}
  const results = [];
  ctx.audio?.preload?.(['table_tock', 'body_thud', 'page_flip', 'brush_stroke']);

  // Per-croissant state.
  let phase = 'enter';
  let t = 0; // seconds in the phase
  let p = 0; // roll progress 0..1
  let lean = 0; // the log's sideways drift (bad direction)
  let rolling = false;
  let breaks = 0;
  let back = 0;
  let speeds = [];
  let devSum = 0;
  let devN = 0;
  let rollT = 0;
  let bl = 0;
  let br = 0;
  let lockL = false;
  let lockR = false;
  let grab = null; // 'L' | 'R' while an end is held
  let grabFrom = 0;
  let assisted = false;
  let ghost = null; // { x, y, down, k }
  let bake = 0;
  let shine = 0;
  let tipAt = -1e9;
  let rollScore = 0;
  let curveScore = 0;
  let enterX = 0;
  let foldT = 0; // seconds an end was held (the fold gesture)
  let buzzAt = -1; // the STRIDE buzz, once, after the first croissant
  let counterText = '';

  const tip = (line, gap = 3.2) => {
    if (S.ptr.t - tipAt < gap || !line) return;
    tipAt = S.ptr.t;
    S.say(who, line, 2.6);
  };
  const reset = () => {
    p = 0;
    lean = 0;
    rolling = false;
    breaks = 0;
    back = 0;
    speeds = [];
    devSum = 0;
    devN = 0;
    rollT = 0;
    foldT = 0;
    bl = br = 0;
    lockL = lockR = false;
    grab = null;
    assisted = false;
    ghost = null;
    bake = 0;
    shine = 0;
  };
  const setPhase = (ph) => {
    phase = ph;
    t = 0;
    S.layer.dataset.phase = `${ph}:${index}`; // tests read it
    counterText = fill(T.counter, { n: Math.min(index + 1, count), count });
    if (ph === 'roll' || ph === 'curve') S.resetIdle();
    if (ph === 'end') ui?.prompt(null);
    // Her call for each step, unless she's still talking (a grade line is never cut short).
    if (ph === 'roll' && !(index === 0 && T.intro)) tip(T.cue?.roll, 2.2);
    else if (ph === 'curve') tip(T.cue?.fold, 2.2);
  };
  const ends = () => {
    shape(geo, bl, br, 1, 0);
    return {
      lx: CX + geo.px[0],
      ly: C_Y + geo.cy + geo.py[0],
      rx: CX + geo.px[2 * N],
      ry: C_Y + geo.cy + geo.py[2 * N],
    };
  };

  const scoreRoll = () => {
    let mean = 0;
    for (const v of speeds) mean += v;
    mean /= Math.max(1, speeds.length);
    let sd = 0;
    for (const v of speeds) sd += (v - mean) * (v - mean);
    sd = Math.sqrt(sd / Math.max(1, speeds.length));
    const cv = sd / Math.max(1, mean);
    const steady = clamp(1 - (cv - 0.3) / 0.9, 0, 1);
    const dir = clamp(1 - devSum / Math.max(1, devN) / 70, 0, 1);
    const pace = rollT < 0.45 ? clamp(rollT / 0.45, 0, 1) : rollT > 4 ? clamp(1 - (rollT - 4) / 4, 0.3, 1) : 1;
    return clamp(0.45 * steady + 0.35 * dir + 0.2 * pace - 0.14 * breaks - 0.1 * Math.min(1, back / 60), 0, 1);
  };
  const scoreCurve = () => clamp(1 - (Math.abs(bl - TARGET) + Math.abs(br - TARGET)) * 0.85 - Math.abs(bl - br) * 0.9, 0, 1);

  let index = 0;
  ui?.prompt(T.hint);
  if (T.intro) ui?.thought(T.intro, 3.4, { who });
  setPhase('enter');

  const r = await d.until(() => {
    const raw = ctx.engine.rawDt || 0.016;
    const P = S.frame(raw);
    t += raw;

    // ------------------------------------------------------------- logic
    if (buzzAt > 0 && S.ptr.t > buzzAt) {
      buzzAt = -1;
      strideBuzz(S, T.buzz, { reply: T.buzzReply });
    }
    if (phase === 'enter') {
      enterX = lerp(-700, 0, smooth(clamp(t / 0.55, 0, 1)));
      if (t >= 0.55) {
        enterX = 0;
        setPhase('roll');
        S.sfx('body_thud', { volume: 0.18, lowpass: 700 }, (a) => a.thud({ volume: 0.15 }));
      }
    } else if (phase === 'roll') {
      const yp = lerp(BASE_Y, TIP_Y, p);
      const near = Math.abs(P.y - yp) < 80 && Math.abs(P.x - CX) < BASE_W / 2 + 60;
      if (P.pressed && !ghost) {
        if (near) rolling = true;
        else tip(T.tips?.start);
      }
      // Idle assist: her hand rolls it, steadily but not quite straight.
      if (!rolling && !ghost && P.idle > idleAfter) {
        ghost = { x: CX, y: yp + 6, down: true, k: 0 };
        assisted = true;
        tip(pickLine(T.assist, memo), 0);
      }
      let fx = P.x;
      let fy = P.y;
      let held = rolling && P.down;
      if (ghost) {
        ghost.k += raw;
        fy = lerp(BASE_Y + 6, TIP_Y - 10, smooth(clamp(ghost.k / 2.2, 0, 1)));
        fx = CX + Math.sin(ghost.k * 3.1) * 18;
        ghost.x = fx;
        ghost.y = fy;
        held = true;
      }
      if (held) {
        rollT += raw;
        const want = clamp((BASE_Y - fy) / (BASE_Y - TIP_Y), 0, 1);
        const before = p;
        if (want > p) p = Math.min(want, p + raw * 1.8); // the dough can't be rolled faster than this
        else back += Math.max(0, (want - p) * -(BASE_Y - TIP_Y)) * raw * 4;
        const dp = (p - before) * (BASE_Y - TIP_Y);
        if (dp > 0.2) speeds.push(dp / raw);
        if (speeds.length > 240) speeds.shift();
        const dev = Math.abs(fx - CX);
        devSum += dev;
        devN++;
        lean += (clamp((fx - CX) * 0.35, -60, 60) - lean) * (1 - Math.exp(-6 * raw));
        if (dp > 0.5 && Math.random() < 0.08) S.sfx('table_tock', { volume: 0.08, rate: 0.7, lowpass: 900 }, null);
        if (!ghost) {
          if (P.speed > 2600 && speeds.length > 3) tip(pickLine(T.grades?.fast, memo));
          else if (dev > 90) tip(T.tips?.wobble);
          else if (rollT > 4.5 && p < 0.6) tip(pickLine(T.grades?.slow, memo));
        }
      }
      if (rolling && P.released && !ghost && p < 0.97) {
        rolling = false;
        breaks++;
        tip(T.tips?.lift);
      }
      if (p >= 0.97) {
        p = 1;
        rolling = false;
        rollScore = assisted ? Math.min(scoreRoll(), 0.6) : scoreRoll();
        ghost = null;
        S.sfx('body_thud', { volume: 0.2, lowpass: 600 }, (a) => a.thud({ volume: 0.15 }));
        setPhase('settle');
      }
    } else if (phase === 'settle') {
      lean *= Math.exp(-8 * raw);
      if (t > 0.45) {
        setPhase('curve');
      }
    } else if (phase === 'curve') {
      const e = ends();
      if (P.pressed && !ghost && !grab) {
        const dL = Math.hypot(P.x - e.lx, P.y - e.ly);
        const dR = Math.hypot(P.x - e.rx, P.y - e.ry);
        if (!lockL && dL < 110 && (dL <= dR || lockR)) grab = 'L';
        else if (!lockR && dR < 110) grab = 'R';
        if (grab) {
          grabFrom = grab === 'L' ? bl : br;
          grab = { side: grab, x: P.x, y: P.y, from: grabFrom };
          S.sfx('table_tock', { volume: 0.12, rate: 0.6, lowpass: 800 }, null);
        }
      }
      // Once her hands are on this croissant they finish it (the fold follows the roll at once).
      if (!grab && !ghost && (assisted || P.idle > idleAfter - 1) && !(lockL && lockR)) {
        ghost = { x: lockL ? e.rx : e.lx, y: e.ly, down: true, k: 0, side: lockL ? 'R' : 'L', to: lockL ? 0.95 : 0.7 };
        assisted = true;
        if (!lockL && !lockR) tip(pickLine(T.assist, memo), 0);
      }
      if (grab && P.down) {
        foldT += raw;
        // Inward is down and toward the middle: project the drag on that direction.
        const sx = grab.side === 'L' ? 1 : -1;
        const dx = (P.x - grab.x) * sx;
        const dy = P.y - grab.y;
        const along = dx * 0.62 + dy * 0.78;
        const b = clamp(grab.from + along / 230, 0, 1.45);
        if (grab.side === 'L') bl = b;
        else br = b;
      }
      if (grab && (P.released || !P.down)) {
        const b = grab.side === 'L' ? bl : br;
        if (b > 0.18) {
          if (grab.side === 'L') lockL = true;
          else lockR = true;
          S.sfx('table_tock', { volume: 0.16, rate: 0.75, lowpass: 900 }, null);
        }
        grab = null;
      }
      if (ghost) {
        ghost.k += raw;
        const k = smooth(clamp(ghost.k / 0.9, 0, 1));
        const b = ghost.to * k;
        if (ghost.side === 'L') bl = b;
        else br = b;
        const ee = ends();
        ghost.x = ghost.side === 'L' ? ee.lx : ee.rx;
        ghost.y = ghost.side === 'L' ? ee.ly : ee.ry;
        if (ghost.k > 1.1) {
          if (ghost.side === 'L') lockL = true;
          else lockR = true;
          S.sfx('table_tock', { volume: 0.16, rate: 0.75, lowpass: 900 }, null);
          ghost = null;
        }
      }
      // Ends that aren't held or locked ease back straight.
      if (!lockL && grab?.side !== 'L' && ghost?.side !== 'L') bl *= Math.exp(-6 * raw);
      if (!lockR && grab?.side !== 'R' && ghost?.side !== 'R') br *= Math.exp(-6 * raw);
      if (lockL && lockR && !grab) {
        curveScore = assisted ? Math.min(scoreCurve(), 0.6) : scoreCurve();
        setPhase('bake');
        S.sfx('brush_stroke', { volume: 0.25, rate: 1.1 }, (a) => a.scrape({ volume: 0.1 }));
      }
    } else if (phase === 'bake') {
      // The egg wash (shine), then the oven's gold in a second: colour comes back on what he made.
      shine = clamp(t / 0.3, 0, 1) * clamp((1.6 - t) / 0.6, 0, 1);
      bake = smooth(clamp((t - 0.25) / 1.0, 0, 1));
      if (t > 1.35 && results.length === index) {
        const score = clamp(0.6 * rollScore + 0.4 * curveScore, 0, 1);
        // Her hands make an ok one; otherwise timing first (fast / slow), then the shape.
        const grade = assisted ? 'ok' : rollT < TIMING.fast || foldT < 0.2 ? 'fast' : rollT > TIMING.slow || foldT > 5 ? 'slow' : score >= 0.72 ? 'perfect' : score >= 0.45 ? 'ok' : 'moon';
        results.push({ grade, score: +score.toFixed(3), roll: +rollScore.toFixed(3), curve: +curveScore.toFixed(3), rollSecs: +rollT.toFixed(2), assisted });
        S.say(who, pickLine(T.grades?.[grade], memo), 3);
        tipAt = S.ptr.t;
        if (index === 0 && T.buzz) buzzAt = S.ptr.t + 3.2;
      }
      if (t > 1.9) setPhase('tray');
    } else if (phase === 'tray') {
      if (t > 1.2) {
        const slot = done.length;
        const g2 = makeGeo();
        shape(g2, bl, br, 1, 0);
        done.push({ geo: g2, x: 1355 + (slot % 2 ? 40 : -40), y: 215 + slot * 128, rot: (slot % 2 ? 0.2 : -0.15), bake: 1 });
        S.sfx('page_flip', { volume: 0.12, rate: 1.3 }, null);
        index++;
        if (index >= count) {
          setPhase('end');
        } else {
          reset();
          setPhase('enter');
        }
      }
    } else if (phase === 'end') {
      if (t > 0.05 && !S._endSaid) {
        S._endSaid = true;
        S.say(who, pickLine(T.tiers?.[tierOf(results)], memo), 3.4);
      }
      if (t > 2.2) return 'done';
    }

    // ------------------------------------------------------------- draw
    S.begin();
    bg.blit(g);
    for (const c of done) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      drawCroissant(g, c.geo, 0, 0, 0.42, 1, 0, true);
      g.restore();
    }
    if (phase === 'enter' || phase === 'roll') {
      g.save();
      g.translate(enterX, 0);
      drawDough(g, p, lean, geo);
      g.restore();
      if (phase === 'roll' && !rolling && !ghost) guideArrow(g, [CX, BASE_Y + 40, CX, TIP_Y - 12], 0.55 + 0.25 * Math.sin(P.t * 4));
    } else if (phase === 'settle') {
      shape(geo, 0, 0, 1, 0);
      const k = smooth(clamp(t / 0.45, 0, 1));
      drawCroissant(g, geo, CX + lean, lerp(TIP_Y - 4, C_Y, k), 1, 0, 0, true);
    } else if (phase === 'curve' || phase === 'bake') {
      shape(geo, bl, br, 1, 0);
      drawCroissant(g, geo, CX, C_Y, 1, bake, shine, true);
      if (phase === 'curve') {
        const e = ends();
        g.save();
        for (const [side, x, y, locked] of [['L', e.lx, e.ly, lockL], ['R', e.rx, e.ry, lockR]]) {
          if (locked) continue;
          const s = side === 'L' ? 1 : -1;
          if (!grab && !ghost) guideArrow(g, [x - s * 10, y - 50, x - s * 6, y + 70, x + s * 90, y + 120], 0.5 + 0.25 * Math.sin(P.t * 4));
          g.strokeStyle = INK.red;
          g.lineWidth = 3;
          g.globalAlpha = grab?.side === side ? 1 : 0.6 + 0.3 * Math.sin(P.t * 5);
          g.beginPath();
          g.arc(x, y, 30, 0, TAU);
          g.stroke();
        }
        g.restore();
      }
    } else if (phase === 'tray') {
      shape(geo, bl, br, 1, 0);
      const k = smooth(clamp(t / 0.6, 0, 1));
      const slot = done.length;
      drawCroissant(g, geo, lerp(CX, 1355 + (slot % 2 ? 40 : -40), k), lerp(C_Y, 215 + slot * 128, k), lerp(1, 0.42, k), 1, 0, true);
    }
    // The count, on a scrap of paper (her order pad).
    g.save();
    g.translate(150, 112);
    g.rotate(-0.05);
    g.fillStyle = '#efe9da';
    g.shadowColor = 'rgba(30, 16, 6, 0.35)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    g.fillRect(-100, -40, 230, 78);
    g.shadowColor = 'transparent';
    g.fillStyle = INK.pencil;
    g.font = `32px ${HAND}`;
    if (g.measureText(counterText).width > 210) g.font = `${Math.floor((32 * 210) / g.measureText(counterText).width)}px ${HAND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(counterText, 15, 2);
    g.restore();
    if (ghost) drawGhost(g, ghost.x, ghost.y, ghost.down);
    bottomShade(S, SAFE_BOTTOM - 10);
    return false;
  });

  S.close();
  const skipped = r === 'skipped';
  while (results.length < count) results.push({ grade: 'ok', score: 0.5, roll: 0.5, curve: 0.5, rollSecs: 0, assisted: true, skipped });
  const score = results.reduce((a, x) => a + x.score, 0) / results.length;
  const tier = skipped ? 'middle' : tierOf(results);
  const perfect = results.filter((x) => x.grade === 'perfect').length;
  return { tier, perfect, score: +score.toFixed(3), croissants: results, skipped };
}
