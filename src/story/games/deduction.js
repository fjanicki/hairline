import { openStage, cachedLayer, bottomShade, drawGhost, pickLine, mergeText, clamp, lerp, smooth, rng, wrap, plain, canvas as mkCanvas, HAND, SANS, INK, SAFE_BOTTOM } from './lib/games-b-stage.js';

// DEDUCTION (docs/DESIGN-R4.md "New minigames"; docs/SCRIPT-R4.md §7.6.4, §9.3, §9.4): the corkboard in
// Hugo's flat, Week 9. Three columns pinned on cork: the questions, the clue cards (the case tab's
// clues), the suspects. Drag a clue onto a question; the right one pins itself there, then pull the red
// wool from its pin to a suspect. The right suspect ties the string; anyone else plays that suspect's
// wrong-accusation scene and the wool drops back. (Dropping a clue straight on a suspect does both at
// once.) After two wrong tries Odile phones in a hint and the right clues glow; after four she comes up
// and the strings draw themselves. It ends when every question is tied to someone: « RÉSOLU ».
//
// opts:
//   clues      [{ id, title (or name), note, image? (data URL) } | id]   the cards; a bare id reads
//              ctx.L.caseFile.clues[id]. Default: every case-file clue.
//   suspects   [{ id, name, photo? (data URL), initials?, why?, tint? } | id]   bare ids read
//              ctx.L.caseFile.suspects[id]. Default: the script's eight (Hugo's own pin included).
//   questions  [{ id, text?, clue (id or [ids]), suspect? }]   text defaults to text.questions[id];
//              suspect defaults to `culprit`. Default: q1 segmentD52, q2 slat52, q3 freewheelClick.
//   culprit = 'durand'
//   text       L.games.deduction: { title, columns, hint (the prompt line), stamp, questions: {id: text},
//              wrongClue[], rightClue: {qid}, toCulprit: {qid}, wrongSuspect[], buzz, idle }
//   wrongLines { suspectId: line | [lines] | [{ who, text, inner? }] }   a wrong accusation: plain lines
//              are Hugo's thought (non-blocking); dialogue lines play as d.say (the §9.3 scenes; the
//              second time the same suspect is accused only the last line plays).
//   onAccuse(id, { count, question }) async     the chapter's own scene instead of wrongLines
//   hint, hint2  Odile's phone-ins after `hintAfter` (2) and `solveAfter` (4) wrong tries: a line
//              (her bark) or dialogue lines (d.say). After hint2 the strings draw themselves.
//   onHint(level) async                         the chapter's own hint scene instead
//   hintWho = 'Odile'
//   autoString = false   cut list B: a right clue ties itself to the culprit (one drag per question)
//   idle = { buzz: 20, wiggle: 30, hand: 8, again: 6 }   seconds without input: STRIDE buzz (once),
//              the right clue wiggles, then a hand does that question; `again` for the next ones.
// Returns { wrong, culprit, accused: [ids, in order], hinted (0..2), assisted, solved, tier, skipped }.

const NB = ' '; // narrow no-break space (French typography before ? ! ; and inside « »)
const FR = {
  title: `QUI RÉPARE LA RUE${NB}?`,
  columns: 'QUESTIONS · INDICES · SUSPECTS',
  hint: 'Glisser un indice sur une question · puis tirer le fil vers un suspect',
  stamp: 'RÉSOLU',
  questions: {
    q1: `Qui passe dans la rue à 3${NB}h${NB}?`,
    q2: `Qui coupe à 52${NB}?`,
    q3: `Qui fait clic${NB}?`,
  },
  wrongClue: ['Ça ne répond pas à la question.', 'C’est un indice. Pas pour cette question-là.', 'Non. Mesurer deux fois. Punaiser une fois.'],
  rightClue: {
    q1: 'D.52. Quelqu’un qui marche à trois heures, et qui compte en cinquante-deux.',
    q2: 'Cinquante-deux centimètres. Le gabarit de l’établi de la boutique.',
    q3: 'Un clic par tour. Un vélo noir, depuis 1974.',
  },
  toCulprit: {
    q1: 'D comme Durand. Cinquante-deux ans de boutique.',
    q2: 'Il coupe comme il a toujours coupé.',
    q3: 'Le même vélo. Le même clic. Toutes les nuits.',
  },
  wrongSuspect: ['Non. Ça ne tient pas.', 'Pas lui. Pas elle. Pas comme ça.'],
  buzz: 'ACTIVITÉ CÉRÉBRALE NON RECONNUE.',
  idle: 'Une question à la fois. Comme les kilomètres.',
  hintWho: 'Odile',
  hint1: 'Cinquante-deux ans. Cinquante-deux centimètres. Ça fait beaucoup de cinquante-deux pour un hasard.',
  hint2: `Albert Durand. Tu tires tes fils, ou je le fais${NB}?`,
};

const DEFAULT_CLUES = ['cleanKey', 'photoHinge', 'slat52', 'blueChip', 'slipperPrint', 'louPhoto', 'segmentD52', 'receipts', 'freewheelClick', 'shopPhoto'];
const DEFAULT_SUSPECTS = ['sami', 'lou', 'gerard', 'benali', 'bastien', 'jo', 'hugo', 'durand'];
const DEFAULT_QUESTIONS = [
  { id: 'q1', clue: 'segmentD52' },
  { id: 'q2', clue: 'slat52' },
  { id: 'q3', clue: 'freewheelClick' },
];
// Portrait tints (the cast's colours) and a sketched detail per known suspect.
const TINT = { sami: '#3d6b8c', lou: '#6a4f8a', gerard: '#a8445c', benali: '#b8893f', bastien: '#3f8a6a', jo: '#6b2430', hugo: '#4d5560', durand: '#6e5a44', oldman: '#6e5a44' };
const PALETTE = ['#4b6a7c', '#7a5a3a', '#5a6b3e', '#7c4a5a', '#3e5a6b'];

const TAU = Math.PI * 2;
const RES = 2; // sprites are drawn at 2x design px
const PAD = 16; // sprite margin for the baked shadow
// Layout (design px, 1600 x 900; the cards stay above SAFE_BOTTOM).
const TOP = 150;
const BOTTOM = 596;
const Q = { x: 192, w: 284, h: 128 };
const SLOT = { x: 448, w: 150, h: 92 };
const CL = { x0: 556, w: 164, h: 100, gap: 12, cols: 3 };
const SU = { x0: 1108, w: 212, h: 104, gap: 18, cols: 2 };
const ZOOM = { w: 380, h: 236 };

const hash = (s) => {
  let h = 7;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const shade = (hex, k) => {
  const p = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
  return `rgb(${f((p >> 16) & 255)},${f((p >> 8) & 255)},${f(p & 255)})`;
};

/** A sprite: an offscreen canvas at RES, with PAD around (w, h) for the shadow; draw(g) in local design px. */
function sprite(w, h, draw) {
  const c = mkCanvas((w + PAD * 2) * RES, (h + PAD * 2) * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  g.translate(PAD, PAD);
  draw(g);
  return { c, w, h };
}
function blit(g, sp, x, y, rot = 0, s = 1, a = 1) {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (s !== 1) g.scale(s, s);
  if (a !== 1) g.globalAlpha = a;
  g.drawImage(sp.c, -sp.w / 2 - PAD, -sp.h / 2 - PAD, sp.w + PAD * 2, sp.h + PAD * 2);
  g.restore();
}

/** An index card (cream, faint blue rules, the red rule at the top), with its shadow. */
function indexCard(g, w, h, seed, { tone = '#efe9d9', rules = true, red = true, redY = 25 } = {}) {
  const R = rng(seed);
  g.save();
  g.shadowColor = 'rgba(30, 16, 6, 0.45)';
  g.shadowBlur = 9;
  g.shadowOffsetX = 2;
  g.shadowOffsetY = 5;
  g.fillStyle = tone;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 1 + R() * 1.5);
  g.lineTo(w - R() * 1.5, h);
  g.lineTo(R() * 1.5, h - 1);
  g.closePath();
  g.fill();
  g.restore();
  // Paper tooth, a little yellowing at one edge.
  g.save();
  g.clip();
  const yl = g.createLinearGradient(0, 0, w, h);
  yl.addColorStop(0, 'rgba(190, 160, 100, 0.10)');
  yl.addColorStop(0.5, 'rgba(190, 160, 100, 0)');
  yl.addColorStop(1, 'rgba(150, 120, 70, 0.12)');
  g.fillStyle = yl;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = `rgba(80, 60, 30, ${R() * 0.06})`;
    g.fillRect(R() * w, R() * h, 1, 1);
  }
  if (rules) {
    g.strokeStyle = 'rgba(80, 120, 170, 0.22)';
    g.lineWidth = 0.8;
    for (let y = redY + 9; y < h - 6; y += 17) {
      g.beginPath();
      g.moveTo(4, y);
      g.lineTo(w - 4, y);
      g.stroke();
    }
  }
  if (red) {
    g.strokeStyle = 'rgba(190, 70, 60, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(3, redY);
    g.lineTo(w - 3, redY);
    g.stroke();
  }
  g.restore();
}

/** Text in the notebook hand, wrapped, at most maxLines (the last one ellipsed). Returns the height used. */
function handText(g, text, x, y, maxW, size, lh, maxLines, color = INK.pencil, font = HAND) {
  g.font = `${size}px ${font}`;
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  let lines = wrap(g, plain(text), maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
  }
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return lines.length * lh;
}

/** A small photo (an <img> or a painted stand-in) in a white border. */
function photoThumb(g, img, x, y, w, h, seed) {
  g.fillStyle = '#f7f4ec';
  g.fillRect(x - 4, y - 4, w + 8, h + 12);
  g.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  g.strokeRect(x - 4, y - 4, w + 8, h + 12);
  if (img && img.complete && img.naturalWidth) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / k;
    const sh = h / k;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  } else {
    const R = rng(seed);
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#5d6670');
    gr.addColorStop(1, '#2b2f35');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255, 220, 150, 0.35)';
    g.beginPath();
    g.arc(x + w * (0.3 + R() * 0.4), y + h * 0.35, h * 0.28, 0, TAU);
    g.fill();
  }
}

function clueSprite(c, w, h, big, img) {
  return sprite(w, h, (g) => {
    // The small card leaves room at the top for its pin.
    indexCard(g, w, h, hash(c.id) + (big ? 9 : 0), { redY: big ? 40 : 37 });
    const k = big ? 1.6 : 1;
    let x = 10 * k;
    let tw = w - 20 * k;
    const hasImg = !!c.image;
    if (hasImg) {
      const iw = big ? 120 : 44;
      photoThumb(g, img, w - iw - 10 * k, big ? 52 : 44, iw, iw * 0.75, hash(c.id));
      tw -= iw + 8;
    }
    // Title: a hand-lettered heading over the red rule.
    g.font = `bold ${big ? 26 : 16.5}px ${HAND}`;
    const title = plain(c.title);
    let ts = big ? 26 : 16.5;
    while (g.measureText(title).width > w - 18 * k && ts > (big ? 18 : 12.5)) {
      ts -= 0.5;
      g.font = `bold ${ts}px ${HAND}`;
    }
    g.fillStyle = INK.pencil;
    g.fillText(title, x, big ? 32 : 32);
    handText(g, c.note, x, big ? 68 : 53, tw, big ? 21 : 13, big ? 27 : 16, big ? 6 : 3, '#45423b');
  });
}

/** A painted stand-in portrait: the suspect's colour, a pencil bust, one detail they're known by. */
function portrait(g, s, x, y, w, h, img) {
  if (img && img.complete && img.naturalWidth) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / k;
    const sh = h / k;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    return;
  }
  const tint = s.tint || TINT[s.id] || PALETTE[hash(s.id) % PALETTE.length];
  const bg = g.createRadialGradient(x + w * 0.5, y + h * 0.35, 4, x + w * 0.5, y + h * 0.5, w * 0.8);
  bg.addColorStop(0, shade(tint, 0.45));
  bg.addColorStop(1, shade(tint, -0.25));
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const cx = x + w / 2;
  const dark = shade(tint, -0.62);
  g.fillStyle = dark;
  // Shoulders and head.
  g.beginPath();
  g.ellipse(cx, y + h * 1.02, w * 0.42, h * 0.36, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx, y + h * 0.46, w * 0.18, h * 0.21, 0, 0, TAU);
  g.fill();
  g.strokeStyle = shade(tint, 0.6);
  g.fillStyle = shade(tint, -0.75);
  g.lineWidth = 2;
  g.lineCap = 'round';
  const id = s.id;
  if (id === 'durand' || id === 'oldman') {
    // A flat cap.
    g.beginPath();
    g.ellipse(cx + w * 0.03, y + h * 0.31, w * 0.22, h * 0.07, -0.08, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + w * 0.16, y + h * 0.34, w * 0.1, h * 0.03, 0, 0, TAU);
    g.fill();
  } else if (id === 'jo') {
    // A high bun, and the fine lines of a sleeve on one shoulder.
    g.beginPath();
    g.arc(cx + w * 0.03, y + h * 0.22, w * 0.08, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255, 235, 225, 0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(cx - w * 0.28, y + h * 0.88 + i * 4, 8 + i * 3, 3.6, 5.2);
      g.stroke();
    }
  } else if (id === 'lou') {
    // A hood up.
    g.beginPath();
    g.ellipse(cx, y + h * 0.47, w * 0.24, h * 0.27, 0, Math.PI, TAU);
    g.lineTo(cx + w * 0.26, y + h * 0.75);
    g.lineTo(cx - w * 0.26, y + h * 0.75);
    g.fill();
  } else if (id === 'bastien') {
    g.strokeStyle = '#e8f0e0';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - w * 0.18, y + h * 0.39);
    g.lineTo(cx + w * 0.18, y + h * 0.37);
    g.stroke();
  } else if (id === 'gerard') {
    g.strokeStyle = shade(tint, 0.55);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - w * 0.08, y + h * 0.55);
    g.quadraticCurveTo(cx, y + h * 0.51, cx + w * 0.08, y + h * 0.55);
    g.stroke();
  } else if (id === 'sami') {
    // A cap, backwards.
    g.beginPath();
    g.ellipse(cx, y + h * 0.31, w * 0.19, h * 0.08, 0, Math.PI, TAU);
    g.fill();
    g.fillRect(cx - w * 0.3, y + h * 0.29, w * 0.14, h * 0.035);
  } else if (id === 'benali') {
    // Flour on the shoulders.
    g.fillStyle = 'rgba(255, 252, 240, 0.5)';
    for (let i = 0; i < 26; i++) g.fillRect(cx - w * 0.36 + ((i * 37) % 100) / 100 * w * 0.72, y + h * (0.76 + ((i * 13) % 10) / 100), 2, 2);
  } else if (id === 'hugo') {
    // A race bib on the chest; the number is a question.
    g.fillStyle = '#f1efe8';
    g.fillRect(cx - w * 0.15, y + h * 0.76, w * 0.3, h * 0.18);
    g.fillStyle = '#b8352a';
    g.font = `bold ${h * 0.14}px ${SANS}`;
    g.textAlign = 'center';
    g.fillText('?', cx, y + h * 0.9);
    g.textAlign = 'left';
  }
  // Photo grain and a corner light leak.
  const R = rng(hash(id));
  for (let i = 0; i < (w * h) / 14; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'}, ${R() * 0.07})`;
    g.fillRect(x + R() * w, y + R() * h, 1, 1);
  }
  g.restore();
}

function suspectSprite(s, w, h, big, img) {
  return sprite(w, h, (g) => {
    // A polaroid on its side: the photo left, the name in pencil on the white.
    g.save();
    g.shadowColor = 'rgba(25, 14, 6, 0.5)';
    g.shadowBlur = 10;
    g.shadowOffsetX = 2;
    g.shadowOffsetY = 6;
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, w, h);
    g.restore();
    const ph = h - 16;
    const pw = big ? ph * 0.86 : ph;
    portrait(g, s, 8, 8, pw, ph, img);
    const tx = pw + 18;
    const tw = w - tx - 10;
    g.fillStyle = INK.pencil;
    let size = big ? 34 : 24;
    g.font = `bold ${size}px ${HAND}`;
    while (g.measureText(plain(s.name)).width > tw && size > 14) {
      size -= 1;
      g.font = `bold ${size}px ${HAND}`;
    }
    const nameLines = wrap(g, plain(s.name), tw).slice(0, 2);
    nameLines.forEach((l, i) => g.fillText(l, tx, (big ? 44 : 34) + i * (size + 2)));
    if (s.why) handText(g, s.why, tx, (big ? 44 : 34) + nameLines.length * (size + 2) + (big ? 6 : 0), tw, big ? 19 : 12.5, big ? 24 : 15, big ? 6 : nameLines.length > 1 ? 1 : 3, '#5a564c');
  });
}

function questionSprite(q, n, w, h) {
  return sprite(w, h, (g) => {
    indexCard(g, w, h, 300 + n, { tone: '#f1ecdf' });
    g.fillStyle = INK.red;
    g.font = `bold 22px ${HAND}`;
    g.fillText(`${n}.`, 10, 20);
    handText(g, q.text, 14, 52, w - 26, 23.5, 25, 3, INK.pencil);
  });
}

/** A plastic push-pin seen from above, sprite at RES. */
function pinSprite(color) {
  return sprite(16, 16, (g) => {
    g.fillStyle = 'rgba(20, 10, 4, 0.45)';
    g.beginPath();
    g.ellipse(11, 12, 7, 5, 0.4, 0, TAU);
    g.fill();
    const gr = g.createRadialGradient(5.5, 5.5, 1, 8, 8, 8);
    gr.addColorStop(0, shade(color, 0.55));
    gr.addColorStop(0.5, color);
    gr.addColorStop(1, shade(color, -0.45));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(8, 8, 7.2, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.7)';
    g.beginPath();
    g.ellipse(5.6, 5.2, 2.2, 1.4, -0.6, 0, TAU);
    g.fill();
  });
}

function stampSprite(text) {
  const w = 560;
  const h = 170;
  return sprite(w, h, (g) => {
    g.strokeStyle = 'rgba(176, 38, 30, 0.9)';
    g.fillStyle = 'rgba(176, 38, 30, 0.9)';
    g.lineWidth = 9;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 3;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.font = `900 92px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 92;
    while (g.measureText(text).width > w - 80 && size > 40) {
      size -= 2;
      g.font = `900 ${size}px ${SANS}`;
    }
    g.fillText(text.split('').join(' '), w / 2, h / 2 + 4);
    // Worn rubber: knock specks out of the ink.
    const R = rng(1979);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) {
      g.globalAlpha = 0.3 + R() * 0.7;
      g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 2.5);
    }
  });
}

/** The board: cork across the window, a pine frame at its edges, the title strip and the column tape. */
function drawBoard(g, S, T) {
  const b = S.bounds();
  const R = rng(52);
  const W = b.x1 - b.x0;
  const H = b.y1 - b.y0;
  g.fillStyle = '#a77a4b';
  g.fillRect(b.x0 - 2, b.y0 - 2, W + 4, H + 4);
  // Cork granules: thousands of little crumbs, light and dark.
  const n = Math.round((W * H) / 70);
  for (let i = 0; i < n; i++) {
    const r = R();
    g.fillStyle = r < 0.45 ? `rgba(70, 40, 18, ${0.18 + R() * 0.3})` : r < 0.85 ? `rgba(214, 170, 112, ${0.25 + R() * 0.35})` : `rgba(120, 76, 38, ${0.4 + R() * 0.3})`;
    const s = 1 + R() * 3.4;
    g.fillRect(b.x0 + R() * W, b.y0 + R() * H, s, s * (0.5 + R()));
  }
  // Old pin holes and the pale squares where earlier notes were.
  for (let i = 0; i < 70; i++) {
    g.fillStyle = 'rgba(40, 22, 10, 0.55)';
    g.beginPath();
    g.arc(b.x0 + R() * W, b.y0 + R() * H, 1.4, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(230, 200, 150, 0.08)';
    g.fillRect(b.x0 + R() * W, b.y0 + R() * H, 120 + R() * 80, 80 + R() * 40);
  }
  // A desk lamp from the top left: warm pool, falling off to the corners.
  const lamp = g.createRadialGradient(700, 200, 80, 760, 360, 1150);
  lamp.addColorStop(0, 'rgba(255, 214, 150, 0.16)');
  lamp.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  lamp.addColorStop(1, 'rgba(10, 5, 0, 0.55)');
  g.fillStyle = lamp;
  g.fillRect(b.x0 - 2, b.y0 - 2, W + 4, H + 4);
  // The pine frame at the window's edges (top and sides; the bottom sits under the shade).
  const fr = 22;
  const wood = (x, y, w, h, vertical) => {
    const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#caa06a');
    gr.addColorStop(0.5, '#b0824e');
    gr.addColorStop(1, '#7c5730');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(90, 56, 24, 0.35)';
    g.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      if (vertical) {
        const xx = x + 3 + R() * (w - 6);
        g.moveTo(xx, y);
        g.lineTo(xx + (R() - 0.5) * 4, y + h);
      } else {
        const yy = y + 3 + R() * (h - 6);
        g.moveTo(x, yy);
        g.lineTo(x + w, yy + (R() - 0.5) * 4);
      }
      g.stroke();
    }
  };
  wood(b.x0 - 2, b.y0 - 2, W + 4, fr + 2, false);
  wood(b.x0 - 2, b.y0 - 2, fr + 2, H + 4, true);
  wood(b.x1 - fr, b.y0 - 2, fr + 2, H + 4, true);
  g.fillStyle = 'rgba(30, 16, 6, 0.35)';
  g.fillRect(b.x0 + fr, b.y0 + fr, W - fr * 2, 5);
  g.fillRect(b.x0 + fr, b.y0 + fr, 5, H);
  // The title on a torn strip of paper, in red marker.
  g.save();
  g.translate(800, 62);
  g.rotate(-0.012);
  g.shadowColor = 'rgba(25, 14, 6, 0.45)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ebe5d4';
  g.beginPath();
  g.moveTo(-300, -30);
  for (let x = -300; x <= 300; x += 12) g.lineTo(x, -30 + (R() - 0.5) * 3);
  g.lineTo(300, 30);
  for (let x = 300; x >= -300; x -= 9) g.lineTo(x, 30 + (R() - 0.5) * 5);
  g.closePath();
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = INK.red;
  let ts = 44;
  g.font = `bold ${ts}px ${HAND}`;
  const title = plain(T.title);
  while (g.measureText(title).width > 560 && ts > 24) g.font = `bold ${(ts -= 1)}px ${HAND}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, 0, 3);
  g.restore();
  // Column labels on masking tape.
  const cols = String(T.columns || '').split(/\s*·\s*/);
  const tape = (x, y, text, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `bold 17px ${SANS}`;
    const tw = g.measureText(text).width + 34;
    g.fillStyle = 'rgba(232, 222, 190, 0.92)';
    g.fillRect(-tw / 2, -15, tw, 30);
    g.fillStyle = 'rgba(160, 140, 90, 0.25)';
    for (let i = 0; i < 6; i++) g.fillRect(-tw / 2 + R() * tw, -15, 1, 30);
    g.fillStyle = INK.pencil;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text.split('').join(' '), 0, 1);
    g.restore();
  };
  if (cols[0]) tape(Q.x + 60, 122, cols[0], -0.02);
  if (cols[1]) tape(CL.x0 + (CL.w * 3 + CL.gap * 2) / 2, 122, cols[1], 0.015);
  if (cols[2]) tape(SU.x0 + (SU.w * 2 + SU.gap) / 2, 122, cols[2], -0.01);
}

/** Red wool from (x0, y0) to (x1, y1), hanging with `sag`; k (0..1) draws part of it. */
function wool(g, x0, y0, x1, y1, sag, k = 1, a = 1) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  // Quadratic through the sag point: control = 2 * mid - (ends' average).
  const cx = 2 * mx - (x0 + x1) / 2;
  const cy = 2 * my - (y0 + y1) / 2;
  let ex = x1;
  let ey = y1;
  let qx = cx;
  let qy = cy;
  if (k < 1) {
    // de Casteljau: the first k of the curve.
    qx = lerp(x0, cx, k);
    qy = lerp(y0, cy, k);
    const rx = lerp(cx, x1, k);
    const ry = lerp(cy, y1, k);
    ex = lerp(qx, rx, k);
    ey = lerp(qy, ry, k);
  }
  g.save();
  g.globalAlpha = a;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(20, 6, 4, 0.28)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x0 + 3, y0 + 6);
  g.quadraticCurveTo(qx + 3, qy + 8, ex + 3, ey + 6);
  g.stroke();
  g.strokeStyle = '#8f1d18';
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(qx, qy, ex, ey);
  g.stroke();
  // The twist of the wool: a lighter dashed thread along it.
  g.strokeStyle = 'rgba(226, 92, 76, 0.85)';
  g.lineWidth = 1.3;
  g.setLineDash([3, 4]);
  g.stroke();
  g.restore();
}

export const id = 'deduction';

export async function play(ctx, d, opts = {}) {
  const T = mergeText(FR, opts.text || {});
  const CF = ctx.L?.caseFile || {};
  const ui = ctx.ui;
  const memo = {};
  const idleT = { buzz: 20, wiggle: 30, hand: 8, again: 6, ...(opts.idle || {}) };
  const hintAfter = opts.hintAfter ?? 2;
  const solveAfter = opts.solveAfter ?? 4;
  const hintWho = opts.hintWho || T.hintWho || ctx.L?.names?.odile || 'Odile';

  // ---------------------------------------------------------------- data
  const clueOf = (c) => {
    const cid = typeof c === 'string' ? c : c.id;
    const base = CF.clues?.[cid] || {};
    const o = typeof c === 'string' ? {} : c;
    return { id: cid, title: o.title ?? o.name ?? base.name ?? cid, note: o.note ?? base.note ?? '', image: o.image ?? null };
  };
  const suspectOf = (s) => {
    const sid = typeof s === 'string' ? s : s.id;
    const base = CF.suspects?.[sid] || {};
    const o = typeof s === 'string' ? {} : s;
    return { id: sid, name: o.name ?? base.name ?? sid, why: o.why ?? null, photo: o.photo ?? null, tint: o.tint ?? null };
  };
  const clues = (opts.clues || DEFAULT_CLUES).map(clueOf);
  const suspects = (opts.suspects || DEFAULT_SUSPECTS).map(suspectOf);
  const culprit = opts.culprit || opts.questions?.[0]?.suspect || 'durand';
  const questions = (opts.questions || DEFAULT_QUESTIONS).map((q) => ({
    id: q.id,
    text: q.text ?? T.questions?.[q.id] ?? q.id,
    clues: Array.isArray(q.clue) ? q.clue : [q.clue],
    suspect: q.suspect ?? culprit,
  }));
  // Never soft-lock: every answer is on the board, and every answer's suspect has a pin.
  for (const q of questions) {
    if (!clues.some((c) => q.clues.includes(c.id))) clues.push(clueOf(q.clues[0]));
    if (!suspects.some((s) => s.id === q.suspect)) suspects.push(suspectOf(q.suspect));
  }
  const loadImg = (src) => {
    if (!src) return null;
    const im = new Image();
    im.src = src;
    return im;
  };

  // ---------------------------------------------------------------- layout and sprites
  const S = openStage(ctx, d, { cls: 'gb-deduction', cursor: 'grab' });
  const { g } = S;
  const bg = cachedLayer(S, (cg) => drawBoard(cg, S, T));
  ctx.audio?.preload?.(['tool_take', 'table_tock', 'tape_pull', 'pencil_write', 'pencil_erase', 'phone_vibrate_table', 'body_thud', 'page_flip', 'stamp_thump', 'cork_pin']);

  const nq = questions.length;
  const qGap = nq > 1 ? Math.min(152, (BOTTOM - TOP - Q.h) / (nq - 1)) : 0;
  const qs = questions.map((q, i) => ({
    ...q,
    n: i + 1,
    x: Q.x,
    y: TOP + Q.h / 2 + i * qGap,
    rot: [-0.02, 0.015, -0.008, 0.02][i % 4],
    sp: questionSprite(q, i + 1, Q.w, Q.h),
    clue: null, // the placed clue card
    tied: false, // the string reaches the suspect
    tieK: 0, // the string's draw-in (0..1)
    lockT: 0,
  }));
  const slotOf = (q) => ({ x: SLOT.x, y: q.y + 4 });
  const clRows = Math.ceil(clues.length / CL.cols);
  const clStep = Math.min(CL.h + 14, (BOTTOM - TOP - CL.h) / Math.max(1, clRows - 1));
  const cards = clues.map((c, i) => {
    const img = loadImg(c.image);
    const home = { x: CL.x0 + CL.w / 2 + (i % CL.cols) * (CL.w + CL.gap), y: TOP + CL.h / 2 + Math.floor(i / CL.cols) * clStep, rot: (((hash(c.id) % 7) - 3) * 0.008) };
    const card = { ...c, img, home, x: home.x, y: home.y, rot: home.rot, s: 1, sp: null, big: null, placed: null, fly: null, wig: 0, glow: 0 };
    card.sp = clueSprite(c, CL.w, CL.h, false, img);
    if (img) img.onload = () => {
      card.sp = clueSprite(c, CL.w, CL.h, false, img);
      card.big = null;
    };
    return card;
  });
  const suRows = Math.ceil(suspects.length / SU.cols);
  const suStep = Math.min(SU.h + 10, (BOTTOM - TOP - SU.h) / Math.max(1, suRows - 1));
  const sus = suspects.map((s, i) => {
    const img = loadImg(s.photo);
    const su = { ...s, img, x: SU.x0 + SU.w / 2 + (i % SU.cols) * (SU.w + SU.gap), y: TOP + SU.h / 2 + Math.floor(i / SU.cols) * suStep, rot: (((hash(s.id) % 5) - 2) * 0.012), sp: null, big: null, crossed: false, ring: 0 };
    su.sp = suspectSprite(s, SU.w, SU.h, false, img);
    if (img) img.onload = () => {
      su.sp = suspectSprite(s, SU.w, SU.h, false, img);
      su.big = null;
    };
    return su;
  });
  const pins = { red: pinSprite('#c0392b'), ochre: pinSprite('#d9a441'), green: pinSprite('#3f7d4e'), blue: pinSprite('#3d6b9c') };
  const pinFor = (id) => [pins.red, pins.ochre, pins.green, pins.blue][hash(id) % 4];
  const suPin = (su) => ({ x: su.x, y: su.y - SU.h / 2 + 8 });
  const cardPin = (c) => ({ x: c.x - Math.sin(c.rot) * (CL.h / 2 - 9) * c.s, y: c.y - (CL.h / 2 - 9) * c.s });
  let stamp = null;

  // ---------------------------------------------------------------- state
  let wrong = 0;
  let hinted = 0;
  let assisted = false;
  const accused = [];
  const accusedN = {};
  let drag = null; // { card, dx, dy } a clue card in hand
  let pull = null; // { q, x, y } the wool in hand from question q
  let hover = null; // { kind, item, t }
  let zoomA = 0;
  let buzzed = false;
  let idleSaid = false;
  let auto = null; // the hand (assist) or the strings drawing themselves: { list: [q], step, t, hand, from }
  let solvedT = -1;
  let lastAuto = -1e9;
  const queue = []; // scenes to play between frame loops (accusations, Odile's calls)
  let lastCursor = '';
  const think = (line, secs = 3.2) => {
    if (!line) return;
    S.say(null, line, secs);
  };
  const open = () => qs.filter((q) => !q.tied);
  const firstOpen = () => qs.find((q) => !q.tied) || null;
  const rightCard = (q) => cards.find((c) => q.clues.includes(c.id) && (!c.placed || c.placed === q)) || null;
  const setPhase = (ph) => (S.layer.dataset.phase = ph); // tests read it
  const hit = (it, x, y, w, h) => Math.abs(x - it.x) < (w * (it.s || 1)) / 2 && Math.abs(y - it.y) < (h * (it.s || 1)) / 2;
  const itemAt = (x, y, list, w, h) => {
    for (let i = list.length - 1; i >= 0; i--) if (hit(list[i], x, y, w, h)) return list[i];
    return null;
  };
  const questionAt = (x, y) => qs.find((q) => !q.tied && Math.abs(x - (q.x + 70)) < Q.w / 2 + 110 && Math.abs(y - q.y) < Q.h / 2 + 4) || null;
  const looseCards = () => cards.filter((c) => !c.placed);
  /** The hand (or the self-drawing strings) takes the next question of a.list, from (x, y). */
  const startAuto = (a, x, y) => {
    const q = a.list[0];
    a.t = 0;
    a.pull = false;
    if (q.clue) a.step = 'tie';
    else if (a.hand) {
      a.step = 'go';
      a.from = { x, y };
    } else {
      const c = rightCard(q);
      c.fly = null;
      a.step = 'carry';
      a.from = { x: c.x, y: c.y };
    }
    a.x = x;
    a.y = y;
    return a;
  };

  const sendHome = (c) => {
    c.fly = { x0: c.x, y0: c.y, r0: c.rot, s0: c.s, x1: c.home.x, y1: c.home.y, r1: c.home.rot, s1: 1, t: 0, dur: 0.35 };
  };
  const place = (c, q) => {
    c.placed = q;
    q.clue = c;
    const sl = slotOf(q);
    c.fly = { x0: c.x, y0: c.y, r0: c.rot, s0: c.s, x1: sl.x, y1: sl.y, r1: 0.03 * (q.n % 2 ? 1 : -1), s1: SLOT.w / CL.w, t: 0, dur: 0.28 };
    c.glow = 0;
    S.sfx('cork_pin', { volume: 0.35 }, (a) => a.tick({ volume: 0.2 })); // R4 Ch6 sounds
  };
  const tie = (q) => {
    q.tied = true;
    q.tieK = Math.max(q.tieK, 0.001);
    S.sfx('tape_pull', { volume: 0.2, rate: 1.4 }, (a) => a.tick({ volume: 0.2 })); // R4 Ch6 sounds: the wool
    S.sfx('pencil_write', { volume: 0.25, rate: 1.2 }, null);
  };
  const countWrong = () => {
    wrong++;
    if (wrong === hintAfter) queue.push({ kind: 'hint', level: 1 });
    if (wrong === solveAfter) queue.push({ kind: 'hint', level: 2 });
  };
  const wrongClue = (c) => {
    think(pickLine(T.wrongClue, memo));
    S.sfx('pencil_erase', { volume: 0.25, rate: 1.1 }, (a) => a.scrape({ volume: 0.08 }));
    sendHome(c);
    countWrong();
  };
  /** The wool reached suspect su from question q. */
  const accuse = (q, su) => {
    if (su.id === q.suspect) {
      tie(q);
      think(T.toCulprit?.[q.id], 3.4);
      return;
    }
    accusedN[su.id] = (accusedN[su.id] || 0) + 1;
    accused.push(su.id);
    su.crossed = true;
    S.sfx('pencil_erase', { volume: 0.25 }, (a) => a.scrape({ volume: 0.08 }));
    const lines = opts.wrongLines?.[su.id];
    const dialogue = Array.isArray(lines) && lines.length && typeof lines[0] === 'object';
    if (opts.onAccuse || dialogue) queue.push({ kind: 'accuse', id: su.id, q, lines: dialogue ? lines : null });
    else think(pickLine(lines, memo) || pickLine(T.wrongSuspect, memo));
    countWrong();
  };
  /** A clue dropped at (x, y). */
  const drop = (c, x, y) => {
    const q = questionAt(x, y);
    if (q) {
      if (q.clue) return sendHome(c); // already answered: no penalty, it goes back
      if (q.clues.includes(c.id)) {
        place(c, q);
        think(T.rightClue?.[q.id], 3.4);
        if (opts.autoString) auto = { list: [q], step: 'tie', t: 0, hand: false, quick: true };
      } else wrongClue(c);
      return;
    }
    const su = itemAt(x, y, sus, SU.w, SU.h);
    if (su) {
      // The shortcut: a clue straight onto a suspect answers the question it belongs to.
      const q2 = qs.find((qq) => !qq.tied && !qq.clue && qq.clues.includes(c.id));
      if (!q2) return wrongClue(c);
      place(c, q2);
      accuse(q2, su);
      return;
    }
    sendHome(c);
  };

  // ---------------------------------------------------------------- the frame loop
  const frame = () => {
    const raw = ctx.engine.rawDt || 0.016;
    const P = S.frame(raw);
    if (queue.length) return queue.shift();

    // Input (the hand and the self-drawing strings take over while they run).
    if (!auto && solvedT < 0) {
      if (P.pressed && !drag && !pull) {
        // The wool first: a placed, untied clue's pin (or the card itself) starts a string.
        const q = qs.find((qq) => qq.clue && !qq.tied && Math.hypot(P.x - qq.clue.x, P.y - qq.clue.y) < SLOT.w / 2 + 10);
        if (q) {
          pull = { q, x: P.x, y: P.y };
          S.sfx('tape_pull', { volume: 0.12, rate: 1.6, lowpass: 3000 }, null);
        } else {
          const c = itemAt(P.x, P.y, looseCards(), CL.w, CL.h);
          if (c) {
            drag = { card: c, dx: c.x - P.x, dy: c.y - P.y };
            c.fly = null;
            cards.splice(cards.indexOf(c), 1);
            cards.push(c); // on top
            S.sfx('tool_take', { volume: 0.16, rate: 1.5, lowpass: 3000 }, (a) => a.tick({ volume: 0.1 }));
          }
        }
      }
      if (drag) {
        const c = drag.card;
        c.x = P.x + drag.dx;
        c.y = P.y + drag.dy;
        c.rot += (clamp(P.vx * 0.00012, -0.12, 0.12) - c.rot) * (1 - Math.exp(-10 * raw));
        c.s = 1.06;
        if (P.released || !P.down) {
          drag = null;
          c.s = 1;
          drop(c, P.x, P.y);
        }
      }
      if (pull) {
        pull.x = P.x;
        pull.y = P.y;
        if (P.released || !P.down) {
          const su = itemAt(P.x, P.y, sus, SU.w, SU.h);
          const q = pull.q;
          pull = null;
          if (su) accuse(q, su);
        }
      }
    }

    // Idle: STRIDE notices (once), the right clue wiggles, then the hand does the question.
    const open1 = firstOpen();
    if (!auto && solvedT < 0 && !drag && !pull && open1) {
      if (!buzzed && P.idle > idleT.buzz && T.buzz) {
        buzzed = true;
        ui?.watchBuzz?.(T.buzz, 3);
      }
      const rc = rightCard(open1);
      if (P.idle > idleT.wiggle && rc && !rc.placed) {
        rc.wig += raw;
        if (!idleSaid) {
          idleSaid = true;
          think(T.idle);
        }
      }
      const wait = assisted ? idleT.again : idleT.wiggle + idleT.hand;
      if (P.idle > wait && S.ptr.t - lastAuto > wait) {
        assisted = true;
        auto = startAuto({ list: [open1], hand: true }, P.x, P.y);
      }
    }

    // The hand / the strings drawing themselves.
    if (auto) {
      const q = auto.list[0];
      auto.t += raw;
      const c = q.clue || rightCard(q);
      if (auto.step === 'go') {
        const k = smooth(clamp(auto.t / 0.5, 0, 1));
        auto.x = lerp(auto.from.x, c.x, k);
        auto.y = lerp(auto.from.y, c.y, k);
        if (k >= 1) Object.assign(auto, { step: 'carry', t: 0, from: { x: c.x, y: c.y } });
      } else if (auto.step === 'carry') {
        const sl = slotOf(q);
        c.fly = null;
        const dur = auto.hand ? 0.9 : 0.45;
        const k = smooth(clamp(auto.t / dur, 0, 1));
        c.x = auto.x = lerp(auto.from.x, sl.x, k);
        c.y = auto.y = lerp(auto.from.y, sl.y, k);
        c.s = lerp(1.06, SLOT.w / CL.w, k);
        if (k >= 1) {
          place(c, q);
          if (auto.hand) think(T.rightClue?.[q.id], 3);
          Object.assign(auto, { step: 'tie', t: 0 });
        }
      } else if (auto.step === 'tie') {
        const dur = auto.quick ? 0.7 : auto.hand ? 1.2 : 0.6;
        const k = smooth(clamp(auto.t / dur, 0, 1));
        const sp = suPin(sus.find((s) => s.id === q.suspect));
        const from = q.clue ? cardPin(q.clue) : slotOf(q);
        auto.x = lerp(from.x, sp.x, k);
        auto.y = lerp(from.y, sp.y, k);
        auto.pull = true;
        if (k >= 1) {
          auto.pull = false;
          tie(q);
          q.tieK = 1;
          if (auto.hand || auto.quick) think(T.toCulprit?.[q.id], 3.2);
          auto.list.shift();
          lastAuto = S.ptr.t;
          if (!auto.list.length) auto = null;
          else startAuto(auto, sp.x, sp.y);
        }
      }
    }

    // Cards flying home or into a slot.
    for (const c of cards) {
      if (c.fly) {
        const f = c.fly;
        f.t += raw / f.dur;
        const k = smooth(clamp(f.t, 0, 1));
        c.x = lerp(f.x0, f.x1, k);
        c.y = lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 18;
        c.rot = lerp(f.r0, f.r1, k);
        c.s = lerp(f.s0, f.s1, k);
        if (f.t >= 1) c.fly = null;
      }
      if (c.wig > 0 && c.placed) c.wig = 0;
      if (hinted > 0 && !c.placed && qs.some((q) => !q.tied && q.clues.includes(c.id))) c.glow = Math.min(1, c.glow + raw * 2);
      else c.glow = Math.max(0, c.glow - raw * 3);
    }
    for (const q of qs) if (q.tied && q.tieK < 1) q.tieK = Math.min(1, q.tieK + raw / 0.35);

    // Solved: the strings meet, the culprit is ringed, the stamp comes down.
    if (solvedT < 0 && !open().length && !auto) {
      solvedT = 0;
      setPhase('solved');
      ui?.prompt(null);
      stamp = stampSprite(plain(T.stamp));
    }
    if (solvedT >= 0) {
      solvedT += raw;
      const cs = sus.find((s) => s.id === culprit);
      if (cs) cs.ring = Math.min(1, solvedT / 0.6);
      if (solvedT > 0.7 && solvedT - raw <= 0.7) {
        S.sfx('stamp_thump', { volume: 0.45 }, (a) => a.thud({ volume: 0.3 })); // R4 Ch6 sounds
        ctx.mood?.pulse?.(0.03);
      }
      if (solvedT > 3) return 'done';
    }

    // Hover: the card under the mouse grows into a readable zoom after a moment.
    const hv = !drag && !pull && !auto && solvedT < 0 ? itemAt(P.x, P.y, cards, CL.w, CL.h) || itemAt(P.x, P.y, sus, SU.w, SU.h) : null;
    if (hv && hover?.item === hv) hover.t += raw;
    else hover = hv ? { item: hv, kind: cards.includes(hv) ? 'clue' : 'suspect', t: 0 } : null;
    const showZoom = hover && hover.t > 0.35;
    zoomA = showZoom ? Math.min(1, zoomA + raw * 6) : Math.max(0, zoomA - raw * 8);
    const cur = drag || pull ? 'grabbing' : hv || qs.some((q) => q.clue && !q.tied && Math.hypot(P.x - q.clue.x, P.y - q.clue.y) < SLOT.w / 2) ? 'grab' : 'default';
    if (cur !== lastCursor) S.layer.style.cursor = lastCursor = cur;

    draw(P);
    return false;
  };

  // ---------------------------------------------------------------- drawing
  let zoomItem = null;
  const draw = (P) => {
    S.begin();
    bg.blit(g);
    const open1 = firstOpen();
    // Questions, and the dashed slot where each one's clue goes.
    for (const q of qs) {
      if (q === open1 && solvedT < 0) {
        g.save();
        g.globalAlpha = 0.35 + 0.15 * Math.sin(P.t * 3);
        g.fillStyle = 'rgba(255, 220, 140, 0.55)';
        g.beginPath();
        g.roundRect(q.x - Q.w / 2 - 10, q.y - Q.h / 2 - 10, Q.w + 20, Q.h + 20, 14);
        g.fill();
        g.restore();
      }
      blit(g, q.sp, q.x, q.y, q.rot);
      g.drawImage(pinFor(q.id).c, q.x - 8 - PAD, q.y - Q.h / 2 - 6 - PAD, 16 + PAD * 2, 16 + PAD * 2);
      if (!q.clue) {
        const sl = slotOf(q);
        g.save();
        g.strokeStyle = 'rgba(245, 230, 200, 0.55)';
        g.lineWidth = 2;
        g.setLineDash([8, 7]);
        g.beginPath();
        g.roundRect(sl.x - SLOT.w / 2, sl.y - SLOT.h / 2, SLOT.w, SLOT.h, 6);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(245, 230, 200, 0.5)';
        g.font = `bold 40px ${HAND}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('?', sl.x, sl.y + 2);
        g.restore();
      }
      if (q.tied) {
        // A pencil tick on the card.
        g.save();
        g.strokeStyle = INK.red;
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(q.x + Q.w / 2 - 50, q.y + Q.h / 2 - 34);
        g.lineTo(q.x + Q.w / 2 - 38, q.y + Q.h / 2 - 20);
        g.lineTo(q.x + Q.w / 2 - 14, q.y + Q.h / 2 - 54);
        g.stroke();
        g.restore();
      }
    }
    // Suspects.
    const hx = pull ? pull.x : auto?.pull ? auto.x : drag ? P.x : -1e4;
    const hy = pull ? pull.y : auto?.pull ? auto.y : drag ? P.y : -1e4;
    for (const su of sus) {
      const hot = hit(su, hx, hy, SU.w, SU.h);
      blit(g, su.sp, su.x, su.y, su.rot, hot ? 1.04 : 1);
      if (su.crossed && su.id !== culprit) {
        g.save();
        g.strokeStyle = 'rgba(59, 58, 54, 0.75)';
        g.lineWidth = 2.5;
        g.lineCap = 'round';
        const x0 = su.x - SU.w / 2 + 10;
        const y0 = su.y - SU.h / 2 + 10;
        g.beginPath();
        g.moveTo(x0 + 6, y0 + 8);
        g.lineTo(x0 + SU.h - 26, y0 + SU.h - 30);
        g.moveTo(x0 + SU.h - 26, y0 + 8);
        g.lineTo(x0 + 6, y0 + SU.h - 30);
        g.stroke();
        g.restore();
      }
      if (su.ring > 0) {
        // Ringed in red marker, the way you'd ring a race time.
        g.save();
        g.strokeStyle = INK.red;
        g.lineWidth = 4.5;
        g.lineCap = 'round';
        g.beginPath();
        const steps = Math.round(64 * su.ring);
        for (let i = 0; i <= steps; i++) {
          const a = -2.2 + (i / 64) * TAU * 1.08;
          const x = su.x + Math.cos(a) * (SU.w / 2 + 12 + Math.sin(a * 3) * 3);
          const y = su.y + Math.sin(a) * (SU.h / 2 + 14);
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
        g.restore();
      }
      g.drawImage(pinFor(su.id).c, su.x - 8 - PAD, su.y - SU.h / 2 - PAD, 16 + PAD * 2, 16 + PAD * 2);
    }
    // Clue cards (the one in hand last, with a lifted shadow).
    for (const c of cards) {
      if (drag?.card === c) continue;
      drawClue(c, P);
    }
    // Strings: tied ones, the one in hand, the hand's.
    for (const q of qs) {
      if (!q.tied || !q.clue) continue;
      const a = cardPin(q.clue);
      const b = suPin(sus.find((s) => s.id === q.suspect));
      wool(g, a.x, a.y, b.x, b.y, 26 + Math.hypot(b.x - a.x, b.y - a.y) * 0.07, q.tieK);
    }
    const pulling = pull ? { q: pull.q, x: pull.x, y: pull.y } : auto?.pull ? { q: auto.list[0], x: auto.x, y: auto.y } : null;
    if (pulling && pulling.q.clue) {
      const a = cardPin(pulling.q.clue);
      wool(g, a.x, a.y, pulling.x, pulling.y, 8 + Math.hypot(pulling.x - a.x, pulling.y - a.y) * 0.03);
      g.drawImage(pins.red.c, pulling.x - 8 - PAD, pulling.y - 8 - PAD, 16 + PAD * 2, 16 + PAD * 2);
    }
    // Pins over the strings.
    for (const q of qs) {
      if (!q.clue) continue;
      const a = cardPin(q.clue);
      g.drawImage(pins.red.c, a.x - 8 - PAD, a.y - 8 - PAD, 16 + PAD * 2, 16 + PAD * 2);
    }
    if (drag) {
      const c = drag.card;
      g.save();
      g.fillStyle = 'rgba(20, 10, 4, 0.22)';
      g.beginPath();
      g.ellipse(c.x + 10, c.y + 22, CL.w * 0.55, CL.h * 0.5, 0, 0, TAU);
      g.fill();
      g.restore();
      drawClue(c, P);
    }
    // The zoom (a readable copy of the hovered card).
    if (zoomA > 0.01 && hover) zoomItem = hover;
    if (zoomA > 0.01 && zoomItem) drawZoom(zoomItem, zoomA);
    if (stamp && solvedT > 0.5) {
      const k = clamp((solvedT - 0.5) / 0.2, 0, 1);
      blit(g, stamp, 800, 360, -0.14, lerp(1.7, 1, smooth(k)), k);
    }
    if (auto?.hand) drawGhost(g, auto.x ?? 800, auto.y ?? 400, auto.step !== 'go');
    bottomShade(S, SAFE_BOTTOM - 4, 0.8);
  };
  const drawClue = (c, P) => {
    if (c.glow > 0) {
      g.save();
      g.globalAlpha = c.glow * (0.55 + 0.25 * Math.sin(P.t * 4));
      g.fillStyle = 'rgba(255, 214, 120, 0.8)';
      g.shadowColor = 'rgba(255, 200, 90, 1)';
      g.shadowBlur = 24;
      g.beginPath();
      g.roundRect(c.x - (CL.w / 2) * c.s - 6, c.y - (CL.h / 2) * c.s - 6, CL.w * c.s + 12, CL.h * c.s + 12, 8);
      g.fill();
      g.restore();
    }
    const wig = c.wig > 0 ? Math.sin(c.wig * 18) * 0.06 * (0.6 + 0.4 * Math.sin(c.wig * 2)) : 0;
    blit(g, c.sp, c.x, c.y, c.rot + wig, c.s);
    if (!c.placed) {
      const p = cardPin(c);
      g.drawImage(pinFor(c.id).c, p.x - 8 - PAD, p.y - 8 - PAD, 16 + PAD * 2, 16 + PAD * 2);
    }
  };
  const drawZoom = (h, a) => {
    const it = h.item;
    if (!it.big) it.big = h.kind === 'clue' ? clueSprite(it, ZOOM.w, ZOOM.h, true, it.img) : suspectSprite(it, ZOOM.w, Math.round(ZOOM.h * 0.82), true, it.img);
    const zw = it.big.w;
    const zh = it.big.h;
    let x;
    let y;
    if (h.kind === 'suspect') {
      x = it.x - SU.w / 2 - zw / 2 - 18;
      y = it.y;
    } else {
      x = it.x;
      y = it.y < 380 ? it.y + CL.h / 2 + zh / 2 + 14 : it.y - CL.h / 2 - zh / 2 - 14;
    }
    x = clamp(x, zw / 2 + 30, 1600 - zw / 2 - 30);
    y = clamp(y, zh / 2 + 24, SAFE_BOTTOM + 10 - zh / 2);
    blit(g, it.big, x, y, 0, lerp(0.92, 1, a), a);
  };

  // ---------------------------------------------------------------- scenes between frames
  const blur = (on) => {
    S.canvas.style.transition = 'filter 0.4s ease';
    S.canvas.style.filter = on ? 'blur(3px) brightness(0.72) saturate(0.8)' : '';
  };
  const playLines = async (lines, who) => {
    if (!lines) return;
    if (Array.isArray(lines) && lines.length && typeof lines[0] === 'object') await d.say(lines);
    else if (Array.isArray(lines)) await d.say(lines.map((t) => ({ who, text: t })));
    else S.say(who, lines, 4.2); // a single line is a bark: the board stays live under it
  };
  const scene = async (p) => {
    ui?.prompt(null);
    if (p.kind === 'accuse') {
      blur(true);
      try {
        const n = accusedN[p.id] || 1;
        if (opts.onAccuse) await opts.onAccuse(p.id, { count: n, question: p.q.id });
        else await d.say(n > 1 ? p.lines.slice(-1) : p.lines);
      } finally {
        blur(false);
      }
    } else if (p.kind === 'hint') {
      hinted = Math.max(hinted, p.level);
      if (p.level === 1) S.sfx('phone_vibrate_table', { volume: 0.4 }, (a) => a.buzz({ volume: 0.15 }));
      if (opts.onHint) await opts.onHint(p.level);
      else await playLines(p.level === 1 ? (opts.hint ?? T.hint1) : (opts.hint2 ?? T.hint2), hintWho);
      if (p.level === 2) {
        // Odile came up: the strings draw themselves.
        assisted = true;
        drag = null;
        pull = null;
        for (const c of cards) if (!c.placed) sendHome(c);
        auto = open().length ? startAuto({ list: open(), hand: false }, 800, 400) : null;
      }
    }
    if (solvedT < 0) ui?.prompt(T.hint);
    S.flush();
  };

  // Tests read the layout (design px) to drive the board with the real mouse.
  S.layer.gbBoard = () => ({
    qs: qs.map((q) => ({ id: q.id, x: q.x, y: q.y, slot: slotOf(q), clue: q.clue?.id ?? null, tied: q.tied })),
    cards: cards.map((c) => ({ id: c.id, x: c.x, y: c.y, placed: c.placed?.id ?? null })),
    sus: sus.map((s) => ({ id: s.id, x: s.x, y: s.y })),
    wrong,
    hinted,
  });
  ui?.prompt(T.hint);
  setPhase('board');
  let r;
  for (;;) {
    r = await d.until(frame);
    if (r && typeof r === 'object') {
      await scene(r);
      continue;
    }
    break;
  }
  const skipped = r === 'skipped';
  if (skipped) for (const q of qs) q.tied = true;
  S.close();
  const solved = qs.every((q) => q.tied);
  const tier = skipped ? 'middle' : wrong === 0 && !assisted ? 'good' : wrong <= hintAfter && hinted < 2 ? 'middle' : 'poor';
  return { wrong, culprit, accused, hinted, assisted, solved, tier, skipped };
}
