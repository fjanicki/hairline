import { openStage, cachedLayer, bottomShade, drawGhost, pickLine, gameText, fill, strideBuzz, clamp, lerp, smooth, rng, HAND, INK, SAFE_BOTTOM } from './lib/games-b-stage.js';

// KEBAB WRAP (docs/DESIGN-R4.md; docs/SCRIPT-R4.md §7.6.1, Ch6 Week 6, 1 h): Gérard's steel counter
// under the pink neon. He calls each order once, fast, changing his mind mid-call (an item he takes back
// is written, then struck, on the ticket); the player drags the bowls onto the flatbread in the called
// order, then drags the bread up to fold it. A wrong bowl bounces back and Gérard is outraged, warmly.
// Between the orders: the tea (no input; a glass to the end of the counter, a flat cap at the edge of the
// frame, dimes on the zinc, and as the door shuts the freewheel clicks four times). Idle: he shoves Hugo
// aside and does it himself, annoyed.
//
//   await playGame('kebab', ctx, d, {
//     text,           // L.games.kebab: { prompts: {fill, fold}, tubs ('Salade · Tomate · …' or an array,
//                     //   in bowl order), ticket, stamp, counter ('Kebab {n}/2'), orders: [{ call }],
//                     //   tea, lines: {wrong, excluded, fold, hurry, end: {good, middle, poor}}, assist,
//                     //   tiers (= lines.end), buzz }
//     who = 'Gérard',
//     orders,         // [{ call?, items: [id | { id, no: true }] }]: the items of each order (default:
//                     //   the script's two); bowl ids: salade, tomate, oignon, viande, frites, blanche,
//                     //   harissa (the red one: « Samouraï »)
//     fillings,       // [{ id, label }] other bowls (any id without art gets a plain bowl)
//     tea = true,     // the tea beat after the first order (needs text.tea); onTea() async runs with it
//                     //   (a d.say stage line, say) and the beat waits for it
//     idle = 7,       // seconds without input before he takes over
//   })  -> { mistakes, tier (by mistakes over all orders: 0–1 good / 2–4 middle / 5+ poor; assisted: poor;
//            skip: middle), assisted, orders: [{ mistakes, assisted }], skipped }
// The module's own extra lines (lines.done) only play when no `text` is given (see gameText()).

const NB = '\u202f'; // narrow no-break space
const BOWLS = ['salade', 'tomate', 'oignon', 'viande', 'frites', 'blanche', 'harissa'];
const FR = {
  who: 'Gérard',
  ticket: 'COMMANDE',
  stamp: 'CHEZ GÉRARD',
  counter: 'Kebab {n}/{count}',
  prompts: {
    fill: 'Glisser les garnitures sur la galette, dans l’ordre',
    fold: 'Glisser la galette vers le haut pour la plier',
  },
  tubs: ['Salade', 'Tomate', 'Oignons', 'Viande', 'Frites', 'Sauce blanche', 'Samouraï'],
  orders: [
    { call: `Une complète${NB}! Salade, tomate, oignons… non, pas d’oignons${NB}! Viande, sauce blanche.`, items: ['salade', 'tomate', { id: 'oignon', no: true }, 'viande', 'blanche'] },
    { call: 'Viande, frites dedans, samouraï. Pas de salade, il est allergique. À la salade.', items: ['viande', 'frites', 'harissa', { id: 'salade', no: true }] },
  ],
  tea: `Un thé${NB}! Sans sucre${NB}! Au bout du comptoir${NB}!`,
  lines: {
    wrong: [`Pas ça${NB}!`, 'J’ai dit tomate. Ça, c’est un oignon. Je connais mes légumes.'],
    excluded: 'Il a dit sans oignons. Il ment, mais il l’a dit.',
    hurry: [`Allez, allez${NB}!`, 'Le client, il vieillit.'],
    fold: `Plie${NB}! Serré${NB}!`,
    // Extra (not in the script): quiet once the chapter passes `text`.
    done: ['Pas mal. Pour un coureur.', 'Ça, c’est un kebab.', 'Je l’aurais fait plus vite. Mais pas mal.'],
  },
  assist: 'Pousse-toi.',
  tiers: {
    good: 'Pas mal. T’as des mains de kebab.',
    middle: 'Il tient. C’est un kebab honnête.',
    poor: 'On dirait un sac de couchage. Il paiera quand même.',
  },
  buzz: `ACTIVITÉ NON RECONNUE. ESSAYER LE YOGA${NB}?`,
};
const EXTRAS = ['lines.done'];
const tierOf = (mistakes, assisted) => (assisted || mistakes >= 5 ? 'poor' : mistakes >= 2 ? 'middle' : 'good');

const TAU = Math.PI * 2;
const BREAD = { x: 800, y: 398, rx: 244, ry: 158 };
const BOWL_Y = 140;
const BOWL_R = 64;
const SERVE_X = 1490;
const SERVE_Y = 300; // the first served wrap; the next ones stack 110 below

// Filling looks: palette and piece shape per id.
const LOOK = {
  salade: { c: ['#6fae3e', '#9fd05a', '#4d8a2a'], kind: 'shred', n: 44 },
  tomate: { c: ['#d2392b', '#e85a3c', '#a82a1f'], kind: 'dice', n: 18 },
  oignon: { c: ['#efe6f2', '#c9a3cf', '#f7f2f8'], kind: 'ring', n: 12 },
  viande: { c: ['#8a4a25', '#b8733a', '#4e260f'], kind: 'strip', n: 22 },
  frites: { c: ['#f2c14e', '#e8ad35', '#fbd979'], kind: 'stick', n: 16 },
  blanche: { c: ['#f6f2e6', '#ffffff', '#e2dccb'], kind: 'sauce', n: 1 },
  harissa: { c: ['#c8371f', '#e2552a', '#9a2412'], kind: 'sauce', n: 1 },
};
const TEA = { x: 1330, y: 520 }; // the end of the counter
const PLAIN = { c: ['#c9a36a', '#e0be86', '#9b7a48'], kind: 'dice', n: 12 };
const lookOf = (id) => LOOK[id] || PLAIN;

/** One piece of a filling at (x, y), angle a, size s. */
function piece(g, kind, c, x, y, a, s, R) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.scale(s, s);
  if (kind === 'shred') {
    g.strokeStyle = c[(R() * 3) | 0];
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12, 0);
    g.bezierCurveTo(-4, -8, 4, 8, 12, -2);
    g.stroke();
  } else if (kind === 'dice') {
    g.fillStyle = c[0];
    g.beginPath();
    g.roundRect(-8, -7, 16, 14, 3);
    g.fill();
    g.fillStyle = c[1];
    g.fillRect(-5, -4, 6, 4);
    g.fillStyle = 'rgba(255, 230, 160, 0.8)';
    g.beginPath();
    g.arc(3, 2, 1.6, 0, TAU);
    g.arc(-2, 3, 1.4, 0, TAU);
    g.fill();
  } else if (kind === 'ring') {
    g.strokeStyle = c[1];
    g.lineWidth = 3.5;
    g.beginPath();
    g.ellipse(0, 0, 13, 9, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = c[0];
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 0, 8, 5, 0, 0, TAU);
    g.stroke();
  } else if (kind === 'strip') {
    // A shaved slice off the spit: an irregular flake, charred at the edge.
    g.fillStyle = c[2];
    g.beginPath();
    g.moveTo(-17, -3);
    g.quadraticCurveTo(-8, -10, 4, -7);
    g.quadraticCurveTo(15, -8, 18, 0);
    g.quadraticCurveTo(12, 8, 0, 6);
    g.quadraticCurveTo(-12, 9, -17, -3);
    g.fill();
    g.fillStyle = c[0];
    g.beginPath();
    g.moveTo(-13, -2);
    g.quadraticCurveTo(-5, -7, 4, -4);
    g.quadraticCurveTo(12, -5, 14, 0);
    g.quadraticCurveTo(9, 5, 0, 3);
    g.quadraticCurveTo(-9, 6, -13, -2);
    g.fill();
    g.fillStyle = c[1];
    g.fillRect(-7, -3, 12, 2);
  } else if (kind === 'stick') {
    g.fillStyle = c[1];
    g.beginPath();
    g.roundRect(-18, -4, 36, 8, 2);
    g.fill();
    g.fillStyle = c[2];
    g.fillRect(-16, -3, 30, 2.5);
  }
  g.restore();
}

/** A drizzle of sauce across a box: a seeded squiggle of small loops, thick, with a wet highlight. */
function drizzle(g, c, x, y, w, h, seed, width = 7) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [col, lw, dy] of [[c[2], width + 2, 1.5], [c[0], width, 0], [c[1], width * 0.35, -1.5]]) {
    const R = rng(seed);
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath();
    const tilt = (R() - 0.5) * 0.5;
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const px = x - w / 2 + u * w + Math.cos(u * 38 + seed) * 16;
      const py = y + (u - 0.5) * h * tilt + Math.sin(u * 38 + seed) * h * 0.16 + Math.sin(u * 5 + seed * 0.1) * h * 0.22 + dy;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
}

function drawBowl(g, f, x, y, label) {
  const L = lookOf(f.id);
  const R = rng(f.id.length * 97 + f.id.charCodeAt(0));
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.5)';
  g.shadowBlur = 16;
  g.shadowOffsetY = 8;
  const rim = g.createRadialGradient(x - 20, y - 20, 10, x, y, BOWL_R);
  rim.addColorStop(0, '#f0f2f4');
  rim.addColorStop(0.8, '#a9adb3');
  rim.addColorStop(1, '#6d7178');
  g.fillStyle = rim;
  g.beginPath();
  g.arc(x, y, BOWL_R, 0, TAU);
  g.fill();
  g.shadowColor = 'transparent';
  const inner = g.createRadialGradient(x + 10, y + 12, 6, x, y, BOWL_R - 8);
  inner.addColorStop(0, '#d8dbe0');
  inner.addColorStop(1, '#8b9097');
  g.fillStyle = inner;
  g.beginPath();
  g.arc(x, y, BOWL_R - 8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(x, y, BOWL_R - 10, 0, TAU);
  g.clip();
  if (L.kind === 'sauce') {
    const sg = g.createRadialGradient(x - 14, y - 16, 4, x, y, BOWL_R - 10);
    sg.addColorStop(0, L.c[1]);
    sg.addColorStop(0.7, L.c[0]);
    sg.addColorStop(1, L.c[2]);
    g.fillStyle = sg;
    g.fillRect(x - BOWL_R, y - BOWL_R, BOWL_R * 2, BOWL_R * 2);
    g.fillStyle = 'rgba(255, 255, 255, 0.5)';
    g.beginPath();
    g.ellipse(x - 18, y - 20, 14, 6, -0.5, 0, TAU);
    g.fill();
  } else {
    for (let i = 0; i < 70; i++) {
      const a = R() * TAU;
      const r = Math.sqrt(R()) * (BOWL_R - 16);
      piece(g, L.kind, L.c, x + Math.cos(a) * r, y + Math.sin(a) * r, R() * TAU, 0.9 + R() * 0.3, R);
    }
  }
  g.restore();
  // The tape label under it, in marker.
  g.save();
  g.translate(x, y + BOWL_R + 26);
  g.rotate((R() - 0.5) * 0.08);
  g.fillStyle = '#e9e2cf';
  g.shadowColor = 'rgba(0, 0, 0, 0.35)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.fillRect(-62, -17, 124, 34);
  g.shadowColor = 'transparent';
  g.fillStyle = INK.pencil;
  let size = 22;
  g.font = `600 ${size}px ${HAND}`;
  while (g.measureText(label).width > 114 && size > 14) g.font = `600 ${--size}px ${HAND}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 0, 1, 116);
  g.restore();
}

function drawCounter(g, S, fillings, bowlX) {
  const b = S.bounds();
  const R = rng(41);
  // Brushed steel.
  const st = g.createLinearGradient(0, b.y0, 0, b.y1);
  st.addColorStop(0, '#5d6268');
  st.addColorStop(0.5, '#9aa0a6');
  st.addColorStop(1, '#6a6f75');
  g.fillStyle = st;
  g.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
  for (let i = 0; i < 900; i++) {
    const y = b.y0 + R() * (b.y1 - b.y0);
    const x = b.x0 + R() * (b.x1 - b.x0);
    g.strokeStyle = R() < 0.5 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 60 + R() * 260, y + (R() - 0.5) * 1.5);
    g.stroke();
  }
  // Grease smudges and a wiped arc.
  for (let i = 0; i < 14; i++) {
    const x = b.x0 + R() * (b.x1 - b.x0);
    const y = 220 + R() * 420;
    const gr = g.createRadialGradient(x, y, 2, x, y, 40 + R() * 70);
    gr.addColorStop(0, 'rgba(60, 50, 30, 0.16)');
    gr.addColorStop(1, 'rgba(60, 50, 30, 0)');
    g.fillStyle = gr;
    g.fillRect(x - 120, y - 120, 240, 240);
  }
  // The paper sheet under the bread.
  g.save();
  g.translate(BREAD.x, BREAD.y);
  g.rotate(-0.06);
  g.shadowColor = 'rgba(0, 0, 0, 0.35)';
  g.shadowBlur = 14;
  g.shadowOffsetY = 6;
  g.fillStyle = '#efe9dc';
  g.fillRect(-300, -192, 600, 384);
  g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(163, 57, 43, 0.3)';
  g.lineWidth = 3;
  for (let i = -290; i < 290; i += 46) {
    g.beginPath();
    g.moveTo(i, -192);
    g.lineTo(i + 18, 192);
    g.stroke();
  }
  g.restore();
  fillings.forEach((f, i) => drawBowl(g, f, bowlX[i], BOWL_Y, f.label));
}

/** The flatbread (lavash): toasted, spotted. Cached per order in its own canvas (design px). */
function breadCanvas(seed) {
  const W = BREAD.rx * 2 + 40;
  const H = BREAD.ry * 2 + 40;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const R = rng(seed);
  const cx = W / 2;
  const cy = H / 2;
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const wob = 1 + Math.sin(a * 5 + seed) * 0.015 + (R() - 0.5) * 0.02;
    const x = cx + Math.cos(a) * BREAD.rx * wob;
    const y = cy + Math.sin(a) * BREAD.ry * wob;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  const gr = g.createRadialGradient(cx - 40, cy - 30, 20, cx, cy, BREAD.rx);
  gr.addColorStop(0, '#f6dfac');
  gr.addColorStop(0.75, '#e9c98a');
  gr.addColorStop(1, '#c99a57');
  g.fillStyle = gr;
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU;
    const r = Math.sqrt(R()) * BREAD.rx;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * (BREAD.ry / BREAD.rx);
    const s = 3 + R() * 9;
    const sp = g.createRadialGradient(x, y, 0, x, y, s);
    sp.addColorStop(0, 'rgba(120, 66, 22, 0.55)');
    sp.addColorStop(1, 'rgba(120, 66, 22, 0)');
    g.fillStyle = sp;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  g.restore();
  g.strokeStyle = 'rgba(150, 100, 50, 0.6)';
  g.lineWidth = 2;
  g.stroke();
  return { c, W, H };
}

export const id = 'kebab';

export async function play(ctx, d, opts = {}) {
  const T = gameText(FR, opts, EXTRAS);
  const L = T.lines || {};
  const who = opts.who || T.who || ctx.L?.names?.gerard || FR.who;
  // The bowls: the script's labels (`tubs`) on the module's seven, or the caller's own fillings.
  const tubs = Array.isArray(T.tubs) ? T.tubs : String(T.tubs || '').split(/\s*·\s*/);
  const fillings = opts.fillings || BOWLS.map((id, i) => ({ id, label: tubs[i] || id }));
  // An order's call is text; its items are mechanics (opts.orders, else the module's own).
  const nOrders = (opts.orders || T.orders || FR.orders).length;
  const orders = Array.from({ length: nOrders }, (_, i) => {
    const items = opts.orders?.[i]?.items || FR.orders[i]?.items || FR.orders[FR.orders.length - 1].items;
    return { call: T.orders?.[i]?.call ?? opts.orders?.[i]?.call ?? '', items: items.map((x) => (typeof x === 'string' ? { id: x, no: false } : { id: x.id, no: !!x.no })) };
  });
  const tiers = (opts.text && !opts.text.tiers && opts.text.lines?.end) || T.tiers || L.end || {};
  const teaOn = opts.tea !== false && !!T.tea && orders.length > 1;
  const idleAfter = opts.idle ?? 7;
  const S = openStage(ctx, d, { cls: 'gb-kebab', cursor: 'grab' });
  const { g, ui } = S;
  const n = fillings.length;
  const span = Math.min(1080, (n - 1) * 160);
  const bowlX = fillings.map((_, i) => 870 - span / 2 + (n > 1 ? (i / (n - 1)) * span : 0) + 60);
  const bg = cachedLayer(S, (cg) => drawCounter(cg, S, fillings, bowlX));
  const label = Object.fromEntries(fillings.map((f) => [f.id, f.label]));
  const memo = {};
  const audio = ctx.audio;
  audio?.preload?.(['tool_take', 'paint_drop', 'table_tock', 'page_flip']);
  const neon = audio?.loopSfx?.('neon_buzz', { volume: 0.05, bus: 'beds', highpass: 150, fade: 0.6 }) || null;
  const sizzle = audio?.loopSfx?.('spit_sizzle', { volume: 0.16, bus: 'beds', fade: 0.6 }) || null; // R4 Ch6 sounds

  let oi = 0; // order index
  let order = null;
  let need = []; // the ids to place, in order
  let placed = 0;
  let pieces = []; // {kind, c, x, y, a, s} on the bread (sauces: {sauce: true, ...})
  let bread = null;
  let reveal = 0; // ticket items shown
  let revealT = 0;
  let drag = null; // { id, x, y }
  let flyBack = null; // { id, x0, y0, x1, y1, t }
  let fold = 0; // 0..1
  let folding = null; // { y0 } while the fold drag is held
  let wrapT = 0;
  let phase = 'fill';
  let t = 0;
  let mistakes = 0;
  let orderMistakes = 0;
  let assisted = false;
  let orderAssisted = false;
  let ghost = null; // { x, y, down, step, t, from, to }
  let hurryAt = 0;
  let served = []; // finished wraps on the right
  const perOrder = [];
  let flicker = 1;
  let sizzleIn = 0;
  let scrap = 0;

  let tea = null; // the tea beat's state (kept after it, so the glass and the dimes stay on the zinc)
  let teaDone = true;
  let buzzed = false;
  let ticketHead = '';
  const startTea = () => {
    tea = { t: 0, glass: 0, coins: 0, cap: 0, clicks: 0 };
    teaDone = !opts.onTea;
    if (opts.onTea) Promise.resolve(opts.onTea()).finally(() => (teaDone = true));
    S.say(who, pickLine(T.tea, memo), 2.8);
    setPhase('tea');
  };
  const startOrder = () => {
    order = orders[oi];
    ticketHead = fill(T.counter, { n: oi + 1, count: orders.length });
    S.resetIdle();
    need = order.items.filter((x) => !x.no).map((x) => x.id);
    placed = 0;
    pieces = [];
    bread = breadCanvas(oi * 13 + 5);
    reveal = 0;
    revealT = 0;
    fold = 0;
    folding = null;
    wrapT = 0;
    orderMistakes = 0;
    orderAssisted = false;
    ghost = null;
    hurryAt = 0;
    S.say(who, order.call, 3.2 + order.items.length * 0.3);
    setPhase('fill');
  };
  const setPhase = (ph) => {
    phase = ph;
    t = 0;
    S.layer.dataset.phase = `${ph}:${oi}`; // tests read it
    ui?.prompt(ph === 'fill' ? T.prompts.fill : ph === 'fold' ? T.prompts.fold : null);
  };
  const inBread = (x, y) => ((x - BREAD.x) / BREAD.rx) ** 2 + ((y - BREAD.y) / BREAD.ry) ** 2 < 1.05;
  const bowlAt = (x, y) => {
    for (let i = 0; i < n; i++) if (Math.hypot(x - bowlX[i], y - BOWL_Y) < BOWL_R + 8) return i;
    return -1;
  };
  const addFilling = (id) => {
    const L2 = lookOf(id);
    const R = rng(oi * 101 + placed * 17 + id.length);
    if (L2.kind === 'sauce') pieces.push({ sauce: true, c: L2.c, seed: ((R() * 1e3) | 0) + 1, w: BREAD.rx * 1.05, h: BREAD.ry * 0.8 });
    else {
      for (let i = 0; i < L2.n; i++) {
        const a = R() * TAU;
        const r = Math.sqrt(R()) * 0.7;
        pieces.push({ kind: L2.kind, c: L2.c, x: BREAD.x + Math.cos(a) * r * BREAD.rx, y: BREAD.y + Math.sin(a) * r * BREAD.ry, a: R() * TAU, s: 1.1 + R() * 0.4, k: (R() * 3) | 0 });
      }
    }
    placed++;
    if (L2.kind === 'sauce') S.sfx('paint_drop', { volume: 0.35, rate: 0.8 }, (a) => a.tone({ freq: 700, to: 300, dur: 0.12, volume: 0.1 }));
    else S.sfx('table_tock', { volume: 0.18, rate: 0.7, lowpass: 1400 }, (a) => a.tick({ volume: 0.12 }));
  };
  const drop = (id, x, y) => {
    if (!inBread(x, y)) {
      flyBack = { id, x0: x, y0: y, x1: bowlX[fillings.findIndex((f) => f.id === id)], y1: BOWL_Y, t: 0 };
      return;
    }
    const expected = need[placed];
    if (id === expected) {
      addFilling(id);
      if (placed >= need.length) {
        setPhase('fold');
        S.say(who, L.fold, 2.4);
      }
      return;
    }
    mistakes++;
    orderMistakes++;
    const excluded = order.items.some((x) => x.no && x.id === id);
    S.say(who, excluded ? pickLine(L.excluded, memo) : pickLine(L.wrong, memo), 2.6);
    flyBack = { id, x0: x, y0: y, x1: bowlX[fillings.findIndex((f) => f.id === id)], y1: BOWL_Y, t: 0 };
    S.sfx('tool_take', { volume: 0.25, rate: 1.2 }, (a) => a.tick({ volume: 0.2 }));
  };
  const takeOver = () => {
    assisted = true;
    orderAssisted = true;
    S.say(who, pickLine(T.assist ?? L.assist, memo), 2.8);
    ghost = { x: S.ptr.x, y: S.ptr.y, down: false, t: 0, step: 'go' };
    drag = null;
  };

  startOrder();

  const r = await d.until(() => {
    const raw = ctx.engine.rawDt || 0.016;
    const P = S.frame(raw);
    t += raw;
    // Ticket: the called items appear at his pace.
    revealT += raw;
    if (reveal < order.items.length && revealT > 0.45) {
      revealT = 0;
      reveal++;
      scrap = 0.25;
    }
    scrap = Math.max(0, scrap - raw);
    // Neon "ambience": a flicker now and then (he insists it's on purpose).
    // R4 Ch6: opts.flicker false = rewired, steady (Week 6 on); the spit's recorded sizzle when loaded.
    flicker = opts.flicker === false ? 1 : Math.random() < 0.012 ? 0.35 : lerp(flicker, 1, 1 - Math.exp(-10 * raw));
    sizzleIn -= raw;
    if (!sizzle && sizzleIn <= 0) {
      sizzleIn = 0.18 + Math.random() * 0.35;
      audio?.noise?.({ type: 'highpass', freq: 3500 + Math.random() * 2500, q: 0.7, dur: 0.12 + Math.random() * 0.2, volume: 0.012 + Math.random() * 0.01 });
    }

    if (!buzzed && phase === 'fill' && oi === Math.min(1, orders.length - 1) && t > 1.6 && T.buzz) {
      buzzed = true;
      strideBuzz(S, T.buzz);
    }
    if (phase === 'fill') {
      if (!ghost) {
        if (P.pressed && !drag) {
          const i = bowlAt(P.x, P.y);
          if (i >= 0) {
            drag = { id: fillings[i].id, x: P.x, y: P.y };
            S.sfx('tool_take', { volume: 0.22, rate: 1.1 }, (a) => a.tick({ volume: 0.15 }));
          }
        }
        if (drag) {
          drag.x = P.x;
          drag.y = P.y;
          if (P.released || !P.down) {
            drop(drag.id, drag.x, drag.y);
            drag = null;
          }
        }
        if (!drag && P.idle > 3.5 && P.idle - raw <= 3.5 && reveal >= order.items.length) S.say(who, pickLine(L.hurry, memo), 2);
        if (!drag && P.idle > idleAfter) takeOver();
      }
    } else if (phase === 'fold') {
      if (!ghost) {
        if (P.pressed && inBread(P.x, P.y)) folding = { y0: P.y, f0: fold };
        if (folding && P.down) fold = clamp(folding.f0 + (folding.y0 - P.y) / 260, fold, 1);
        if (folding && (P.released || !P.down)) folding = null;
        if (!folding && P.idle > idleAfter) takeOver();
      }
      if (!folding && !ghost && fold < 1 && fold > 0) fold = Math.max(0, fold - raw * 0.6); // springs open unless pushed past
      if (fold >= 0.98) {
        fold = 1;
        folding = null;
        S.sfx('page_flip', { volume: 0.3, rate: 0.9 }, (a) => a.noise({ type: 'bandpass', freq: 2000, dur: 0.25, volume: 0.06 }));
        setPhase('wrap');
      }
    } else if (phase === 'wrap') {
      wrapT += raw;
      if (wrapT > 0.75 && t - raw <= 0.75) S.sfx('page_flip', { volume: 0.22, rate: 1.2 }, null);
      if (t > 1.0) {
        perOrder.push({ mistakes: orderMistakes, assisted: orderAssisted });
        if (!orderAssisted) S.say(who, pickLine(L.done, memo), 2.4);
        ghost = null;
        setPhase('serve');
      }
    } else if (phase === 'serve') {
      if (t > 0.55) {
        served.push({ y: SERVE_Y + served.length * 120, rot: (served.length % 2 ? 0.08 : -0.1) });
        oi++;
        if (oi >= orders.length) setPhase('end');
        else if (oi === 1 && teaOn) startTea();
        else startOrder();
      }
    } else if (phase === 'tea') {
      // No input: the glass to the end of the counter, the cap at the edge of the frame, the dimes, the click.
      tea.t = t;
      tea.glass = smooth(clamp((t - 0.4) / 1.1, 0, 1));
      tea.cap = clamp((t - 1.2) / 0.5, 0, 1) * clamp((3.3 - t) / 0.5, 0, 1);
      const coins = t < 2 ? 0 : Math.min(3, 1 + Math.floor((t - 2) / 0.22));
      if (coins > tea.coins) {
        tea.coins = coins;
        if (coins === 1) S.sfx('coins_drop', { volume: 0.3, highpass: 400 }, (a) => a.ping({ volume: 0.05, freq: 2600 })); // R4 Ch6 sounds (the dimes)
      }
      if (t > 1.5 && tea.glass >= 1 && !tea.set) {
        tea.set = true;
        S.sfx('mug_clink', { volume: 0.22, rate: 1.3 }, (a) => a.tick({ volume: 0.12 }));
      }
      // As the door shuts: the freewheel, four clicks, fading.
      const clicks = t < 3.3 ? 0 : Math.min(4, 1 + Math.floor((t - 3.3) / 0.38));
      if (clicks > tea.clicks) {
        tea.clicks = clicks;
        S.sfx('pawl_click', { volume: 0.35 * Math.pow(0.6, clicks - 1), lowpass: 3200 - clicks * 500 }, (a) => a.tick({ volume: 0.12 * Math.pow(0.6, clicks - 1) })); // R4 Ch6 sounds: the clue click
      }
      if (t > 5 && teaDone) startOrder();
    } else if (phase === 'end') {
      if (!S._endSaid) {
        S._endSaid = true;
        S.say(who, pickLine(tiers[tierOf(mistakes, assisted)], memo), 3.6);
      }
      if (t > 2.4) return 'done';
    }

    // Gérard's hands: the assist moves bowl to bread, then folds.
    if (ghost && (phase === 'fill' || phase === 'fold')) {
      ghost.t += raw;
      if (phase === 'fill') {
        const id = need[placed];
        const i = fillings.findIndex((f) => f.id === id);
        if (ghost.step === 'go') {
          const k = smooth(clamp(ghost.t / 0.28, 0, 1));
          ghost.x = lerp(ghost.from?.x ?? ghost.x, bowlX[i], k);
          ghost.y = lerp(ghost.from?.y ?? ghost.y, BOWL_Y, k);
          ghost.down = false;
          if (!ghost.from) ghost.from = { x: ghost.x, y: ghost.y };
          if (k >= 1) Object.assign(ghost, { step: 'carry', t: 0, from: { x: ghost.x, y: ghost.y } });
        } else {
          const k = smooth(clamp(ghost.t / 0.35, 0, 1));
          const tx = BREAD.x + Math.cos(placed * 2.1) * 60;
          const ty = BREAD.y + Math.sin(placed * 2.1) * 40;
          ghost.x = lerp(ghost.from.x, tx, k);
          ghost.y = lerp(ghost.from.y, ty, k);
          ghost.down = true;
          drag = { id, x: ghost.x, y: ghost.y };
          if (k >= 1) {
            drag = null;
            addFilling(id);
            Object.assign(ghost, { step: 'go', t: 0, from: { x: ghost.x, y: ghost.y } });
            if (placed >= need.length) {
              setPhase('fold');
              ghost.t = 0;
            }
          }
        }
      } else {
        const k = smooth(clamp(ghost.t / 0.6, 0, 1));
        ghost.x = BREAD.x;
        ghost.y = lerp(BREAD.y + BREAD.ry * 0.8, BREAD.y - BREAD.ry * 0.4, k);
        ghost.down = true;
        fold = k;
        if (k >= 1) {
          fold = 1;
          S.sfx('page_flip', { volume: 0.3, rate: 0.9 }, null);
          setPhase('wrap');
        }
      }
    }
    if (flyBack) {
      flyBack.t += raw / 0.3;
      if (flyBack.t >= 1) flyBack = null;
    }

    // ------------------------------------------------------------- draw
    S.begin();
    bg.blit(g);
    // Pink neon spill from above (CHEZ GÉRARD), flickering.
    const neonG = g.createRadialGradient(800, -260, 60, 800, -260, 980);
    neonG.addColorStop(0, `rgba(255, 70, 160, ${0.42 * flicker})`);
    neonG.addColorStop(1, 'rgba(255, 70, 160, 0)');
    g.fillStyle = neonG;
    g.fillRect(-200, -200, 2000, 1000);
    // The bowl being dragged from: a lift highlight.
    const hov = drag ? fillings.findIndex((f) => f.id === drag.id) : phase === 'fill' && !ghost ? bowlAt(P.x, P.y) : -1;
    if (hov >= 0) {
      g.strokeStyle = 'rgba(255, 236, 190, 0.85)';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(bowlX[hov], BOWL_Y, BOWL_R + 6, 0, TAU);
      g.stroke();
    }
    if (phase === 'fill' || phase === 'fold' || phase === 'wrap' || phase === 'serve') {
      const sx = phase === 'serve' ? lerp(BREAD.x, SERVE_X, smooth(clamp(t / 0.55, 0, 1))) : BREAD.x;
      const sy = phase === 'serve' ? lerp(BREAD.y, SERVE_Y + served.length * 120, smooth(clamp(t / 0.55, 0, 1))) : BREAD.y;
      if (phase === 'fill' || (phase === 'fold' && fold < 0.5)) {
        g.drawImage(bread.c, BREAD.x - bread.W / 2, BREAD.y - bread.H / 2, bread.W, bread.H);
        drawPieces(g, pieces, 1);
        if (phase === 'fold' && fold > 0) drawFlap(g, bread, fold);
      } else if (phase === 'fold') {
        drawFolded(g, bread, pieces, fold);
      } else {
        drawWrap(g, sx, sy, phase === 'wrap' ? smooth(clamp(t / 0.9, 0, 1)) : 1, phase === 'serve' ? lerp(1, 0.45, smooth(clamp(t / 0.55, 0, 1))) : 1, T.stamp, bread);
      }
      if (phase === 'fold' && !folding && !ghost) arrowUp(g, BREAD.x, BREAD.y + BREAD.ry - 10, 0.55 + 0.3 * Math.sin(P.t * 4));
    }
    for (const w of served) drawWrap(g, SERVE_X, w.y, 1, 0.45, T.stamp, null, w.rot);
    if (tea) drawTea(g, tea, S.bounds());
    drawTicket(g, T.ticket, ticketHead, order, reveal, placed, label, scrap);
    // The scoop in hand (or flying back to its bowl).
    if (drag) scoop(g, drag.id, drag.x, drag.y);
    if (flyBack) {
      const k = smooth(clamp(flyBack.t, 0, 1));
      scoop(g, flyBack.id, lerp(flyBack.x0, flyBack.x1, k), lerp(flyBack.y0, flyBack.y1, k) - Math.sin(k * Math.PI) * 60);
    }
    if (ghost && (phase === 'fill' || phase === 'fold')) drawGhost(g, ghost.x, ghost.y, ghost.down);
    bottomShade(S, SAFE_BOTTOM - 10, 0.85);
    return false;
  });

  neon?.stop?.(0.4);
  sizzle?.stop?.(0.4);
  S.close();
  const skipped = r === 'skipped';
  const tier = skipped ? 'middle' : tierOf(mistakes, assisted);
  return { mistakes, tier, assisted, orders: perOrder, skipped };
}

function drawPieces(g, pieces, alpha) {
  g.save();
  g.globalAlpha = alpha;
  for (const p of pieces) {
    if (p.sauce) drizzle(g, p.c, BREAD.x, BREAD.y, p.w, p.h, p.seed, 7);
    else piece(g, p.kind, p.c, p.x, p.y, p.a, p.s, () => p.k / 3);
  }
  g.restore();
}

/** The bottom of the bread lifting toward the hinge (fold < 0.5): a flap seen from below, foreshortened. */
function drawFlap(g, bread, fold) {
  const k = Math.cos(fold * Math.PI); // 1 flat .. 0 upright
  g.save();
  g.beginPath();
  g.ellipse(BREAD.x, BREAD.y, BREAD.rx + 4, BREAD.ry * Math.max(0.02, k), 0, 0, Math.PI);
  g.clip();
  g.fillStyle = '#efe9dc';
  g.fillRect(BREAD.x - BREAD.rx - 10, BREAD.y, BREAD.rx * 2 + 20, BREAD.ry + 20);
  g.drawImage(bread.c, BREAD.x - bread.W / 2, BREAD.y - (bread.H / 2) * k, bread.W, bread.H * k);
  g.fillStyle = `rgba(90, 50, 20, ${0.25 * (1 - k)})`;
  g.fillRect(BREAD.x - BREAD.rx - 10, BREAD.y, BREAD.rx * 2 + 20, BREAD.ry + 20);
  g.restore();
}

/** Past half way: the top half with its fillings, under the flap coming over it. */
function drawFolded(g, bread, pieces, fold) {
  const k = -Math.cos(fold * Math.PI); // 0 upright .. 1 folded flat over the top half
  g.save();
  g.beginPath();
  g.rect(BREAD.x - BREAD.rx - 20, BREAD.y - BREAD.ry - 20, BREAD.rx * 2 + 40, BREAD.ry + 20);
  g.clip();
  g.drawImage(bread.c, BREAD.x - bread.W / 2, BREAD.y - bread.H / 2, bread.W, bread.H);
  drawPieces(g, pieces, 1);
  g.restore();
  // The underside of the bread (paler, dusted), folded up over the fillings.
  g.save();
  g.translate(BREAD.x, BREAD.y);
  g.scale(1, -k);
  g.shadowColor = 'rgba(0, 0, 0, 0.35)';
  g.shadowBlur = 12;
  g.beginPath();
  g.ellipse(0, 0, BREAD.rx + 2, BREAD.ry, 0, 0, Math.PI);
  g.fillStyle = '#ecd29c';
  g.fill();
  g.shadowColor = 'transparent';
  g.clip();
  g.drawImage(bread.c, -bread.W / 2, -bread.H / 2, bread.W, bread.H);
  g.fillStyle = 'rgba(255, 245, 225, 0.2)';
  g.fillRect(-BREAD.rx, 0, BREAD.rx * 2, BREAD.ry);
  g.restore();
}

/** The wrap in its paper (k 0..1 grows it in after the fold), standing at a slant, open end up. */
function drawWrap(g, x, y, k, s, stamp, bread, rot = 0) {
  if (bread && k < 1) {
    g.save();
    g.globalAlpha = 1 - k;
    drawFolded(g, bread, [], 1);
    g.restore();
  }
  g.save();
  g.translate(x, y);
  g.rotate(rot - 0.32);
  g.scale(s * lerp(0.7, 1, k), s * lerp(0.7, 1, k));
  g.globalAlpha = k;
  g.shadowColor = 'rgba(0, 0, 0, 0.45)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  const bg = g.createLinearGradient(-62, 0, 62, 0);
  bg.addColorStop(0, '#c99a57');
  bg.addColorStop(0.4, '#f3d9a2');
  bg.addColorStop(1, '#b8874a');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(-62, -150, 124, 300, 54);
  g.fill();
  g.shadowColor = 'transparent';
  // The open end: fillings showing.
  g.fillStyle = '#5a2c12';
  g.beginPath();
  g.ellipse(0, -128, 52, 20, 0, 0, TAU);
  g.fill();
  const bits = ['#6fae3e', '#d2392b', '#b8733a', '#f2c14e', '#f6f2e6', '#9fd05a', '#c8371f'];
  for (let i = 0; i < 14; i++) {
    g.fillStyle = bits[i % bits.length];
    g.beginPath();
    g.ellipse(-40 + ((i * 37) % 80), -128 + ((i * 13) % 20) - 10, 9, 6, i, 0, TAU);
    g.fill();
  }
  // Paper: a cone round the bottom, folded on a slant, red pinstripes and his stamp.
  g.beginPath();
  g.moveTo(-68, -30);
  g.lineTo(68, -78);
  g.lineTo(66, 120);
  g.quadraticCurveTo(0, 168, -66, 120);
  g.closePath();
  g.fillStyle = '#f1ebdd';
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(163, 57, 43, 0.35)';
  g.lineWidth = 3;
  for (let i = -70; i < 80; i += 22) {
    g.beginPath();
    g.moveTo(i, -90);
    g.lineTo(i + 10, 170);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-68, -30);
  g.lineTo(68, -78);
  g.stroke();
  if (stamp) {
    g.save();
    g.translate(0, 40);
    g.rotate(-0.22);
    g.globalAlpha = k * 0.85;
    g.strokeStyle = '#c42a6a';
    g.fillStyle = '#c42a6a';
    g.lineWidth = 3;
    g.font = `700 22px ${HAND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = Math.min(118, g.measureText(stamp).width + 16);
    g.strokeRect(-tw / 2, -30, tw, 60);
    const words = String(stamp).split(' ');
    if (words.length > 1) {
      g.fillText(words[0], 0, -11, 108);
      g.fillText(words.slice(1).join(' '), 0, 13, 108);
    } else g.fillText(stamp, 0, 1, 108);
    g.restore();
  }
  g.restore();
}

/** The tea beat: a glass on its saucer slides to the end of the counter; a flat cap, out of focus, at the
 * frame's right edge; three dimes on the zinc. */
function drawTea(g, tea, b) {
  const gx = lerp(820, TEA.x, tea.glass);
  const gy = lerp(250, TEA.y, tea.glass) - Math.sin(tea.glass * Math.PI) * 30;
  // The cap: drawn off-canvas and thrown back by its shadow, so it lands soft (out of focus) everywhere.
  if (tea.cap > 0) {
    g.save();
    g.globalAlpha = tea.cap;
    const k = g.getTransform().a; // shadows are in device px, not design px
    g.shadowBlur = 9 * k;
    g.shadowOffsetX = 4000 * k;
    const cx = b.x1 - 95 - 4000;
    const blob = (color, x, y, rx, ry, rot = 0) => {
      g.shadowColor = color;
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = '#000';
    blob('rgba(40, 34, 30, 0.85)', cx + 10, 600, 150, 110); // shoulders, a cardigan
    blob('rgba(120, 92, 74, 0.8)', cx + 2, 452, 46, 56); // the face, turned away
    blob('rgba(52, 46, 40, 0.95)', cx + 6, 404, 66, 26, -0.1); // the cap's crown
    blob('rgba(52, 46, 40, 0.95)', cx - 52, 420, 44, 10, -0.18); // its brim
    g.restore();
  }
  // Dimes.
  for (let i = 0; i < tea.coins; i++) {
    const x = TEA.x - 70 + i * 22;
    const y = TEA.y + 46 - (i % 2) * 8;
    g.fillStyle = '#b08a4a';
    g.beginPath();
    g.ellipse(x, y, 13, 9, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d9b46a';
    g.beginPath();
    g.ellipse(x - 1, y - 1.5, 10, 6.5, 0.2, 0, Math.PI * 2);
    g.fill();
  }
  if (tea.glass <= 0 && tea.t < 0.4) return;
  // Saucer, glass, tea (amber), a mint leaf.
  g.save();
  g.translate(gx, gy);
  g.fillStyle = 'rgba(0, 0, 0, 0.3)';
  g.beginPath();
  g.ellipse(6, 26, 50, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8e4da';
  g.beginPath();
  g.ellipse(0, 20, 46, 13, 0, 0, Math.PI * 2);
  g.fill();
  const tg = g.createLinearGradient(-18, -40, 18, 20);
  tg.addColorStop(0, '#d98a2a');
  tg.addColorStop(1, '#8a3c0e');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(-17, -34);
  g.quadraticCurveTo(-22, -6, -13, 16);
  g.lineTo(13, 16);
  g.quadraticCurveTo(22, -6, 17, -34);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.fillRect(-12, -30, 4, 36);
  g.fillStyle = '#4e8a3a';
  g.beginPath();
  g.ellipse(6, -36, 9, 4, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawTicket(g, title, head, order, reveal, placed, label, scrap) {
  g.save();
  g.translate(70, 250);
  g.rotate(-0.035);
  g.shadowColor = 'rgba(0, 0, 0, 0.45)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 5;
  g.fillStyle = '#f3efe4';
  g.fillRect(0, 0, 230, 340);
  g.shadowColor = 'transparent';
  // Torn bottom edge.
  g.fillStyle = '#f3efe4';
  g.beginPath();
  for (let x = 0; x <= 230; x += 10) g.lineTo(x, 340 + (x % 20 ? 5 : 0));
  g.lineTo(230, 330);
  g.lineTo(0, 330);
  g.fill();
  // The clip.
  g.fillStyle = '#5e6268';
  g.fillRect(85, -14, 60, 22);
  g.fillStyle = INK.pencil;
  g.font = `700 21px ${HAND}`;
  g.textBaseline = 'alphabetic';
  g.fillText(title, 18, 40, 200);
  g.font = `19px ${HAND}`;
  g.fillStyle = 'rgba(59, 58, 54, 0.75)';
  g.fillText(head, 18, 64, 200);
  g.fillStyle = INK.pencil;
  g.strokeStyle = 'rgba(59, 58, 54, 0.4)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(16, 76);
  g.lineTo(214, 76);
  g.stroke();
  g.font = `24px ${HAND}`;
  let k = 0; // index among the items to place
  for (let i = 0; i < reveal && i < order.items.length; i++) {
    const it = order.items[i];
    const y = 108 + i * 32;
    const isDone = !it.no && k++ < placed;
    g.fillStyle = it.no ? 'rgba(59, 58, 54, 0.55)' : INK.pencil;
    const txt = label[it.id] || it.id;
    g.fillText(txt, 40, y, 170);
    if (it.no) {
      const w = Math.min(170, g.measureText(txt).width);
      g.strokeStyle = INK.red;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(34, y - 8);
      g.lineTo(46 + w, y - 11);
      g.stroke();
    } else if (isDone) {
      g.strokeStyle = '#3d7a3a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(14, y - 10);
      g.lineTo(21, y - 2);
      g.lineTo(32, y - 20);
      g.stroke();
    }
  }
  // A pencil scratch while he writes.
  if (scrap > 0) {
    g.fillStyle = 'rgba(59, 58, 54, 0.6)';
    g.beginPath();
    g.arc(200, 92 + Math.max(0, reveal - 1) * 34 - 8, 3, 0, TAU);
    g.fill();
  }
  g.restore();
}

function scoop(g, id, x, y) {
  const L = lookOf(id);
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.45)';
  g.shadowBlur = 14;
  g.shadowOffsetY = 10;
  if (L.kind === 'sauce') {
    const sg = g.createRadialGradient(x - 6, y - 6, 2, x, y, 30);
    sg.addColorStop(0, L.c[1]);
    sg.addColorStop(1, L.c[0]);
    g.fillStyle = sg;
    g.beginPath();
    g.ellipse(x, y, 30, 22, 0, 0, TAU);
    g.fill();
  } else {
    const R = rng(id.length * 7 + 1);
    for (let i = 0; i < 12; i++) {
      const a = R() * TAU;
      const r = Math.sqrt(R()) * 26;
      piece(g, L.kind, L.c, x + Math.cos(a) * r, y + Math.sin(a) * r, R() * TAU, 1.1, R);
    }
  }
  g.restore();
}

function arrowUp(g, x, y, a) {
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = '#fff3d6';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.setLineDash([12, 10]);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 170);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.moveTo(x - 18, y - 150);
  g.lineTo(x, y - 172);
  g.lineTo(x + 18, y - 150);
  g.stroke();
  g.restore();
}
