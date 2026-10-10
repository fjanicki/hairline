// Items (docs/DESIGN-R4.md "Items system", docs/SCRIPT-R4.md §1): the item registry with its icon painters,
// the pocket (tools and gifts, 12 slots), the case file (L’AFFAIRE: clues and suspect pins, in the notebook's
// back pages), and the lines for a wrong item, a gift and a missing item.
//
// Text: L.items.<id> { name, def, desc } and L.items.ui / hints / refuse / give / needs / atChapter
// (text/items.js); L.caseFile (text/caseFile.js). UI: src/ui/Inventory.js (pocket strip, toasts, the held
// item) and the notebook's case tab (UI.js). Hotspots take items through `needs` / `accepts` / `person`
// (world/Hotspots.js); chapters through d.give / d.take / d.has / d.clue ... (story/Director.js).
//
// Saving (memory.js conventions, never throws):
//   - the pocket: localStorage 'hairline.items'. Director.start(i) calls beginChapterItems(i): the pocket is
//     set to L.items.atChapter[i]; for a chapter with no seed it goes back to the snapshot taken when chapter i
//     first began (replaying a chapter replays it clean). Later chapters' snapshots are dropped.
//   - the case file: mem.caseFile (memory.js, owner chapter index 4 = Ch5), so beginChapter(i) clears it like
//     the flags. Indices are Revision 4's seven chapters (docs/SCRIPT-R4.md §0.3, §1.5).

import { L } from './script.js';
import { mem, remember } from './memory.js';

export const MAX_ITEMS = 12;
export const KINDS = ['tool', 'gift', 'clue'];

// ================================================================ icons
// Small pencil drawings on a 64 x 64 page, in the notebook's hand: wobbly double strokes in graphite and a
// thin watercolour wash under each closed shape (colour is hope: it is on the things). Seeded per item, so an
// icon looks the same every time.

const INK = '#2e2c28';
const HAND = "'Bradley Hand', 'Segoe Print', 'Noteworthy', 'Comic Neue', cursive"; // = var(--hand)

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The pencil: every shape method draws on g (64 x 64 units) and returns the pen, so calls chain. */
function pen(g, seed) {
  const rand = rng(seed);
  const j = (a) => (rand() - 0.5) * 2 * a;
  let wash = null;
  let ink = INK;

  // Each segment bows a little; the line is drawn twice, the second pass lighter and off by a hair.
  const stroke = (pts, closed = false) => {
    if (pts.length < 2) return;
    const P = closed ? [...pts, pts[0]] : pts;
    g.strokeStyle = ink;
    for (let pass = 0; pass < 2; pass++) {
      g.globalAlpha = pass ? 0.3 : 0.88;
      g.lineWidth = pass ? 1.1 : 1.9;
      const o = pass ? 0.8 : 0.3;
      let [px, py] = P[0];
      g.beginPath();
      g.moveTo(px + j(o), py + j(o));
      for (let i = 1; i < P.length; i++) {
        const [x, y] = P[i];
        const len = Math.hypot(x - px, y - py) || 1;
        const bow = j(Math.min(1.4, len * 0.04));
        g.quadraticCurveTo((px + x) / 2 - ((y - py) / len) * bow, (py + y) / 2 + ((x - px) / len) * bow, x + j(o), y + j(o));
        px = x;
        py = y;
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  // The wash: misregistered by a pixel or two, like a quick watercolour under the pencil.
  const fill = (pts) => {
    if (!wash) return;
    const dx = j(1.3);
    const dy = j(1.3);
    g.globalAlpha = 0.62;
    g.fillStyle = wash;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx + j(0.5), y + dy + j(0.5)) : g.moveTo(x + dx, y + dy)));
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  };
  const shape = (pts) => {
    fill(pts);
    stroke(pts, true);
  };
  const ellipsePts = (cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, closed = true) => {
    const n = Math.max(8, Math.round(Math.max(rx, ry) * 1.2 * ((a1 - a0) / (Math.PI * 2))) + 6);
    const pts = [];
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = 0; i < (closed ? n : n + 1); i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return pts;
  };

  const api = {
    rand,
    j,
    /** Wash colour for the following closed shapes (null: none). */
    wash(c) {
      wash = c || null;
      return api;
    },
    /** Stroke colour (null: graphite). */
    ink(c) {
      ink = c || INK;
      return api;
    },
    line(x0, y0, x1, y1) {
      stroke([
        [x0, y0],
        [x1, y1],
      ]);
      return api;
    },
    path(pts, closed = false) {
      if (closed) shape(pts);
      else stroke(pts);
      return api;
    },
    rect(x, y, w, h) {
      shape([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      return api;
    },
    ellipse(cx, cy, rx, ry, rot = 0) {
      shape(ellipsePts(cx, cy, rx, ry, rot));
      return api;
    },
    circle(cx, cy, r) {
      return api.ellipse(cx, cy, r, r);
    },
    arc(cx, cy, r, a0, a1) {
      stroke(ellipsePts(cx, cy, r, r, 0, a0, a1, false));
      return api;
    },
    /** Crescent: circle (cx, cy, r) less circle (ox, oy, or). */
    crescent(cx, cy, r, ox, oy, or) {
      const N = 72;
      const runOf = (x0, y0, rad, keep) => {
        const pts = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          pts.push([x0 + Math.cos(a) * rad, y0 + Math.sin(a) * rad]);
        }
        const k = pts.map(keep);
        const start = k.findIndex((v, i) => v && !k[(i + N - 1) % N]);
        const run = [];
        for (let i = 0; i < N && start >= 0; i++) {
          const p = pts[(start + i) % N];
          if (!keep(p)) break;
          run.push(p);
        }
        return run;
      };
      const outer = runOf(cx, cy, r, ([x, y]) => Math.hypot(x - ox, y - oy) > or);
      const inner = runOf(ox, oy, or, ([x, y]) => Math.hypot(x - cx, y - cy) < r);
      shape([...outer, ...inner.reverse()]);
      return api;
    },
    /** Grit, crumbs, sawdust. */
    dots(n, x, y, w, h, r = 0.75) {
      g.fillStyle = ink;
      g.globalAlpha = 0.55;
      for (let i = 0; i < n; i++) {
        g.beginPath();
        g.arc(x + rand() * w, y + rand() * h, r * (0.6 + rand() * 0.8), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      return api;
    },
    /** A stitched or dotted line along pts: `on` units drawn, `off` units skipped. */
    dash(pts, on = 3, off = 2.4) {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const len = Math.hypot(x1 - x0, y1 - y0);
        for (let t = 0; t < len; t += on + off) {
          const a = t / len;
          const b = Math.min(1, (t + on) / len);
          stroke([
            [x0 + (x1 - x0) * a, y0 + (y1 - y0) * a],
            [x0 + (x1 - x0) * b, y0 + (y1 - y0) * b],
          ]);
        }
      }
      return api;
    },
    /** Handwritten figures ('52', 'D.52', '1974'): data, not text (the icon is not translated). */
    text(s, x, y, size = 12, rot = 0) {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.font = `${size}px ${HAND}`;
      g.fillStyle = ink;
      g.globalAlpha = 0.9;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, 0, 0);
      g.restore();
      return api;
    },
    /** A little shine: a cross with a shorter diagonal cross. */
    star(x, y, r) {
      api.line(x - r, y, x + r, y).line(x, y - r, x, y + r);
      const q = r * 0.45;
      return api.line(x - q, y - q, x + q, y + q).line(x - q, y + q, x + q, y - q);
    },
    /** A key hanging from (x, y): bow, shaft along angle a, a two-tooth bit. */
    key(x, y, a, len = 22, bowWash = null) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const was = wash;
      wash = bowWash;
      api.circle(x, y, 5);
      wash = null;
      api.circle(x, y, 1.4);
      const x0 = x + c * 5;
      const y0 = y + s * 5;
      const x1 = x + c * (5 + len);
      const y1 = y + s * (5 + len);
      api.line(x0, y0, x1, y1);
      const nx = -s * 5;
      const ny = c * 5;
      stroke([
        [x1, y1],
        [x1 + nx, y1 + ny],
        [x1 - c * 3 + nx, y1 - s * 3 + ny],
        [x1 - c * 3 + nx * 0.5, y1 - s * 3 + ny * 0.5],
        [x1 - c * 6 + nx * 0.5, y1 - s * 6 + ny * 0.5],
        [x1 - c * 6, y1 - s * 6],
      ]);
      wash = was;
      return api;
    },
    /** A polaroid: white frame, the picture's wash inside. Returns the pen (picture box: x+4, y+4, w-8, w-8). */
    polaroid(x, y, w, h, picture) {
      api.wash('#f3efe6').rect(x, y, w, h);
      return api.wash(picture).rect(x + 4, y + 4, w - 8, w - 8).wash(null);
    },
  };
  return api;
}

/** Paint fn(pen) at `size` px (64-unit page) and return a PNG data URL. Seed: any string. Browser only. */
export function paintIcon(fn, size = 96, seed = 'icon') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  g.scale(size / 64, size / 64);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  try {
    fn(pen(g, hash(seed)));
  } catch (err) {
    console.error('[items] icon failed', seed, err);
  }
  return c.toDataURL('image/png');
}

// The spoke key: a disc with four notches round the rim (cleanKey is the same key, shining).
function spokeKey(p, cx, cy, r, colour) {
  p.wash(colour).circle(cx, cy, r).wash(null).circle(cx, cy, r * 0.28);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w = r * 0.14;
    const at = (rad, off) => [cx + c * rad - s * off, cy + s * rad + c * off];
    p.path([at(r, -w), at(r * 0.66, -w), at(r * 0.66, w), at(r, w)]);
  }
  return p;
}

function receipt(p, x, y, w, h) {
  const zig = [];
  for (let i = 0; i <= 6; i++) zig.push([x + w - (w * i) / 6, y + h + (i % 2 ? 2.5 : 0)]);
  p.wash('#f6f1e4').path(
    [
      [x, y],
      [x + w, y],
      ...zig,
    ],
    true,
  );
  p.wash(null);
  for (let i = 0; i < 4; i++) p.line(x + 3, y + 5 + i * 4.5, x + w - 3 - (i % 2) * 5, y + 5 + i * 4.5);
  return p;
}

// ================================================================ registry
// kind: 'tool' | 'gift' go in the pocket; 'clue' goes to the case file. worn: the item is on Hugo (the tag
// « au poignet » in the pocket). paint(p): the icon.

const def = (kind, paint, extra = {}) => ({ kind, paint, ...extra });

export const ITEMS = {
  // ------------------------------------------------------------ tools
  keys: def('tool', (p) => {
    p.circle(30, 14, 7);
    p.key(22, 26, 1.9, 20, '#c9a24a').key(30, 28, 1.55, 24, '#c9a24a').key(39, 26, 1.2, 18, '#b9b2a2');
  }),
  phone: def('tool', (p) => {
    p.wash('#59636d').rect(20, 7, 24, 50).wash('#cfd8dc').rect(23, 13, 18, 36).wash(null);
    p.circle(32, 10, 0.9).line(29, 53, 35, 53);
  }),
  watch: def(
    'tool',
    (p) => {
      p.wash('#3a3f44').rect(25, 5, 14, 13).rect(25, 46, 14, 13);
      p.wash('#4a5056').circle(32, 32, 14).wash('#c6f432').circle(32, 32, 9.5).wash(null);
      p.text('0,0', 32, 32.5, 8.5);
    },
    { worn: true },
  ),
  pencil: def('tool', (p) => {
    p.wash('#d9a441').path([[9, 47], [41, 15], [48, 22], [16, 54]], true);
    p.wash('#e7d3b0').path([[41, 15], [53, 9], [48, 22]], true).wash(null);
    p.line(12, 51, 44, 19).line(51, 10, 53, 9);
  }),
  sandpaper: def('tool', (p) => {
    p.wash('#b98c55').path([[13, 12], [48, 10], [51, 43], [41, 54], [15, 52]], true);
    p.wash('#ebdfc4').path([[51, 43], [42, 44], [41, 54]], true).wash(null);
    p.dots(46, 17, 15, 28, 33, 0.8);
  }),
  tape: def('tool', (p) => {
    p.wash('#e0b83a').rect(8, 17, 33, 31).wash(null).circle(24.5, 32.5, 9).circle(24.5, 32.5, 2.5);
    p.wash('#f0dc7a').rect(41, 39, 16, 6).wash(null);
    for (let x = 44; x < 57; x += 3) p.line(x, 39, x, x % 2 ? 41 : 42.5);
    p.line(57.5, 37, 57.5, 47);
  }),
  spokeKey: def('tool', (p) => spokeKey(p, 32, 32, 16, '#9aa6b2')),
  chalk: def('tool', (p) => {
    p.wash('#a9c6dc').path([[12, 18], [50, 14], [33, 48]], true).wash(null);
    p.line(16, 21, 46, 17);
    p.path([[10, 56], [17, 53], [24, 56], [31, 53], [38, 56], [45, 53]]);
  }),
  keyRing: def('tool', (p) => {
    p.circle(32, 15, 10);
    p.key(25, 28, 1.95, 18, '#c9a24a').key(32, 30, 1.6, 22, '#b9b2a2').key(39, 28, 1.25, 17, '#c9a24a');
    p.wash('#b8322a').path([[41, 11], [52, 6], [49, 14]], true).path([[41, 11], [51, 18], [46, 20]], true).wash(null);
  }),
  thermos: def('tool', (p) => {
    p.wash('#6b2430').rect(22, 18, 20, 39).wash('#4a4440').rect(20, 8, 24, 10).wash(null);
    p.line(22, 30, 42, 30).line(26, 22, 26, 52);
    p.path([[27, 6], [25, 3], [27, 0]]).path([[37, 6], [35, 3], [37, 0]]);
  }),

  // ------------------------------------------------------------ gifts
  croissant: def('gift', (p) => {
    p.wash('#d9a441').crescent(30, 34, 21, 40, 25, 15).wash(null);
    for (const a of [2.35, 2.75, 3.15, 3.55]) p.line(30 + Math.cos(a) * 21, 34 + Math.sin(a) * 21, 30 + Math.cos(a) * 11, 34 + Math.sin(a) * 9);
  }),
  rags: def('gift', (p) => {
    p.wash('#d8cfbd').rect(14, 22, 36, 10).wash('#cdbf9f').rect(11, 32, 42, 11).wash('#d8cfbd').rect(14, 43, 36, 10);
    p.wash('#3b3a36').ellipse(41, 27, 4, 2.2).wash(null);
    p.line(32, 22, 32, 32).line(32, 43, 32, 53);
  }),
  kebab: def('gift', (p) => {
    p.wash('#c98a4a').ellipse(32, 20, 15, 6);
    p.wash('#86a85a').path([[18, 18], [22, 12], [26, 17], [30, 11], [34, 17], [38, 12], [42, 17], [46, 13], [47, 20], [17, 20]], true);
    p.wash('#efe3c6').path([[16, 22], [48, 22], [33, 59]], true).wash(null);
    p.line(22, 30, 40, 30).line(26, 40, 38, 40);
  }),
  soup: def('gift', (p) => {
    p.wash('#c8b04a').rect(18, 22, 28, 34).wash('#9a8a6a').rect(17, 15, 30, 7).wash(null);
    p.line(22, 28, 22, 50).line(18, 30, 46, 30);
    p.path([[25, 12], [23, 9], [25, 5], [23, 2]]).path([[38, 12], [36, 9], [38, 5], [36, 2]]);
  }),

  // ------------------------------------------------------------ clues (the case file)
  cleanKey: def('clue', (p) => {
    spokeKey(p, 28, 34, 14, '#a9c4d6');
    p.star(50, 14, 5).star(52, 40, 3.5).star(12, 12, 3);
  }),
  photoHinge: def('clue', (p) => {
    p.polaroid(11, 6, 42, 52, '#7d8a96');
    p.line(25, 10, 25, 44).line(30, 10, 30, 44);
    for (let y = 14; y < 44; y += 6) p.line(15, y, 25, y);
    p.wash('#c79a2e').ellipse(37, 28, 2.2, 3.2).wash(null);
  }),
  slat52: def('clue', (p) => {
    p.wash('#6f8fb8').path([[6, 34], [58, 28], [58, 38], [6, 44]], true).wash(null);
    p.line(10, 38, 54, 33);
    p.line(6, 22, 58, 16).line(6, 22, 10, 19).line(6, 22, 10, 25).line(58, 16, 54, 13).line(58, 16, 54, 19);
    p.text('52', 32, 12, 14, -0.1);
  }),
  blueChip: def('clue', (p) => {
    p.wash('#4f78b0').path([[14, 22], [30, 12], [46, 16], [52, 32], [40, 50], [22, 46], [12, 36]], true).wash(null);
    p.path([[24, 22], [30, 30], [28, 40]]).path([[30, 30], [40, 28]]);
  }),
  slipperPrint: def('clue', (p) => {
    p.polaroid(11, 6, 42, 52, '#c9ae7f');
    p.ellipse(32, 26, 7, 14, 0.15).dots(30, 18, 12, 28, 30, 0.6);
  }),
  louPhoto: def('clue', (p) => {
    p.polaroid(11, 6, 42, 52, '#2c3340');
    p.line(42, 14, 42, 42).wash('#f2c879').ellipse(40, 13, 4, 2).wash(null);
    p.circle(24, 30, 2.4).line(20, 28, 28, 28).line(24, 33, 24, 40);
    p.circle(20, 41, 3.5).circle(29, 41, 3.5);
    p.text('3:04', 32, 51, 7);
  }),
  segmentD52: def('clue', (p) => {
    p.wash('#d5d9dd').rect(19, 6, 26, 52).wash(null);
    p.ink('#6f9418').path([[24, 40], [28, 30], [26, 24], [33, 18], [38, 22], [40, 12]]).ink(null);
    p.circle(24, 40, 1.4).text('D.52', 32, 49, 9);
  }),
  receipts: def('clue', (p) => {
    receipt(p, 10, 8, 22, 26);
    receipt(p, 20, 18, 22, 26);
    receipt(p, 30, 28, 22, 26);
    p.text('43', 41, 37, 9);
  }),
  freewheelClick: def('clue', (p) => {
    p.wash('#efe6cf').path([[8, 12], [54, 8], [56, 52], [30, 56], [10, 50]], true).wash(null);
    p.circle(26, 34, 9).circle(26, 34, 2.5);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      p.line(26 + Math.cos(a) * 9, 34 + Math.sin(a) * 9, 26 + Math.cos(a) * 12, 34 + Math.sin(a) * 12);
    }
    p.text('clic', 44, 20, 10, -0.25);
  }),
  shopPhoto: def('clue', (p) => {
    p.wash('#d9c39a').rect(9, 8, 46, 48).wash('#a08660').rect(13, 12, 38, 30).wash(null);
    p.path([[13, 20], [19, 16], [25, 20], [31, 16], [37, 20], [43, 16], [51, 20]]);
    p.circle(22, 28, 2).line(22, 30, 22, 38).circle(34, 39, 3).circle(43, 39, 3).line(34, 39, 43, 39);
    p.text('1974', 32, 50, 8);
  }),
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export const kindOf = (id) => ITEMS[id]?.kind ?? null;
const isPocketItem = (id) => typeof id === 'string' && !!ITEMS[id] && ITEMS[id].kind !== 'clue';
const isClue = (id) => kindOf(id) === 'clue';

/** L.items.<id> ({ name, def, desc }) or L.caseFile.clues.<id> for a clue; null if unknown. */
export const itemText = (id) => (isClue(id) ? L.caseFile?.clues?.[id] : L.items?.[id]) ?? null;
export const itemName = (id) => itemText(id)?.name ?? id;

/** '{item}' -> the item's def (or name), '{who}' -> who. For L.items.ui strings. */
export function fillItem(template, id, { name = false, who = '' } = {}) {
  const t = itemText(id);
  return String(template ?? '')
    .replace('{item}', (name ? t?.name : t?.def ?? t?.name) ?? id)
    .replace('{who}', who);
}

const iconCache = new Map();
/** The item's icon as a data URL (cached). '' when unknown or outside a browser. */
export function itemIcon(id, size = 96) {
  const it = ITEMS[id];
  if (!it || typeof document === 'undefined') return '';
  const k = `${id}@${size}`;
  if (!iconCache.has(k)) iconCache.set(k, paintIcon(it.paint, size, id));
  return iconCache.get(k);
}

// ================================================================ events
// One stream for the pocket and the case file. fn({ type, id?, ... }):
//   pocket: 'add' {id, toast} · 'remove' {id, toast} · 'give' {id, to} · 'select' {id} · 'full' {id} ·
//           'clear' · 'restore' {index} (a chapter began: pocket and case re-read)
//   case:   'case:open' · 'case:clue' {id, toast} · 'case:note' {id, toast} · 'case:suspect' {id}

const listeners = new Set();
function emit(type, extra = {}) {
  const e = { type, ...extra };
  for (const fn of [...listeners]) {
    try {
      fn(e);
    } catch (err) {
      console.error('[items] listener failed', type, err);
    }
  }
}

/** fn(event) on every pocket or case change. Returns unsubscribe. */
export function onItems(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ================================================================ the pocket

const KEY = 'hairline.items';
const VERSION = 1;
// list: ids in the order picked up. held: the item in Hugo's hand (or null). hidden: put away for this chapter.
// snaps: chapter index -> { id: chapter id, list } at that chapter's first start. hints: once-only hints shown.
const state = { list: [], held: null, hidden: false, snaps: {}, hints: {}, loaded: false };

const clean = (a) => (Array.isArray(a) ? [...new Set(a.filter(isPocketItem))].slice(0, MAX_ITEMS) : []);

function load() {
  if (state.loaded) return;
  state.loaded = true;
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    raw = null;
  }
  if (raw?.v !== VERSION) return;
  state.list = clean(raw.list);
  for (const [k, s] of Object.entries(raw.snaps && typeof raw.snaps === 'object' ? raw.snaps : {})) {
    if (/^\d+$/.test(k) && s && typeof s.id === 'string') state.snaps[k] = { id: s.id, list: clean(s.list) };
  }
  for (const [k, v] of Object.entries(raw.hints && typeof raw.hints === 'object' ? raw.hints : {})) if (v === true) state.hints[k] = true;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, list: state.list, snaps: state.snaps, hints: state.hints }));
  } catch {
    /* private window / blocked: the pocket still works for this visit */
  }
}

export const pocket = {
  /** Put `id` in the pocket. opts: { toast=true }. False if it is not a pocket item or the pocket is full. */
  add(id, { toast = true } = {}) {
    load();
    if (!isPocketItem(id)) {
      console.warn('[items] not a pocket item', id, isClue(id) ? '(a clue: use caseFile.add / d.clue)' : '');
      return false;
    }
    if (state.list.includes(id)) return true;
    if (state.list.length >= MAX_ITEMS) {
      emit('full', { id });
      return false;
    }
    state.list.push(id);
    persist();
    emit('add', { id, toast });
    return true;
  },
  /** Take `id` out of the pocket (it is put away first if held). opts: { toast=false } shows « − name ». */
  remove(id, { toast = false } = {}) {
    load();
    const i = state.list.indexOf(id);
    if (i < 0) return false;
    if (state.held === id) pocket.select(null);
    state.list.splice(i, 1);
    persist();
    emit('remove', { id, toast });
    return true;
  },
  /** A gift handed to `person` (an id: 'jo'): out of the pocket, the « {item} → {who} » toast, a 'give' event. */
  give(id, person) {
    load();
    const i = state.list.indexOf(id);
    if (i < 0) return false;
    if (state.held === id) pocket.select(null);
    state.list.splice(i, 1);
    persist();
    emit('give', { id, to: person });
    return true;
  },
  /** True if the pocket holds `id` (or any of an array of ids). */
  has(id) {
    load();
    return (Array.isArray(id) ? id : [id]).some((x) => state.list.includes(x));
  },
  list() {
    load();
    return state.list.slice();
  },
  /** The held item's id, or null. */
  selected() {
    return state.held;
  },
  /** Hold `id` (it must be in the pocket); null puts the held item away. Returns true when it is held. */
  select(id) {
    load();
    const next = id && state.list.includes(id) ? id : null;
    if (id && !next) return false;
    if (next === state.held) return !!next;
    state.held = next;
    emit('select', { id: next });
    return !!next;
  },
  clear() {
    load();
    state.list = [];
    state.held = null;
    persist();
    emit('clear');
  },
  /** True while the chapter has put the pocket away (L.items.atChapter[i] === null). */
  get hidden() {
    return state.hidden;
  },
  /** Once-only hints (persisted): true the first time `key` is asked for, false after. */
  firstTime(key) {
    load();
    if (state.hints[key]) return false;
    state.hints[key] = true;
    persist();
    return true;
  },
  onChange: onItems,
};

/**
 * Director.start(i): the pocket for chapter i. L.items.atChapter[i] (an id list) sets it; null puts it away
 * for the chapter (kept for the next); no seed restores the snapshot of chapter i's first start, or keeps the
 * pocket as it is and snapshots it. Snapshots of later chapters are dropped. Nothing is held.
 */
// Seeded items that depend on an earlier choice (SCRIPT-R4 §1.5): chapter index -> [[item, mem flag]].
// Ch6 (index 5) starts with the rags if Ch5 ended with them still in the pocket.
const SEED_IF = { 5: [['rags', 'ragsKept']] };

export function beginChapterItems(index, chapterId = String(index)) {
  load();
  let seed = L.items?.atChapter?.[index];
  if (Array.isArray(seed)) for (const [id, flag] of SEED_IF[index] || []) if (mem[flag] === true && !seed.includes(id)) seed = [...seed, id];
  const snap = state.snaps[index];
  state.held = null;
  state.hidden = seed === null;
  if (Array.isArray(seed)) state.list = clean(seed);
  else if (seed === undefined && snap && snap.id === chapterId) state.list = snap.list.slice();
  state.snaps[index] = { id: chapterId, list: state.list.slice() };
  for (const k of Object.keys(state.snaps)) if (+k > index) delete state.snaps[k];
  persist();
  emit('restore', { index });
}

// ================================================================ the case file (L’AFFAIRE)
// Lives in mem.caseFile (memory.js): { open, clues: [ids], later: [ids], suspects: { id: { status, as, later } } }.

const cf = () => mem.caseFile || { open: false, clues: [], later: [], suspects: {} };

export const caseFile = {
  /** The back pages exist (the tab shows). */
  isOpen: () => !!cf().open,
  /** Turn the exercise book over: the case tab appears, its heading written on. */
  open() {
    if (cf().open) return;
    remember('caseFile.open', true);
    emit('case:open');
  },
  /** `clue+ id`: add a clue (opens the case if needed). opts: { toast=true }. False if not a clue. */
  add(id, { toast = true } = {}) {
    if (!isClue(id)) {
      console.warn('[items] not a clue', id);
      return false;
    }
    if (!cf().open) caseFile.open();
    if (cf().clues.includes(id)) return true;
    remember('caseFile.clues', [...cf().clues, id]);
    emit('case:clue', { id, toast });
    return true;
  },
  /** `clueNote id`: the clue's note becomes its noteLater. */
  update(id, { toast = true } = {}) {
    if (!cf().clues.includes(id) || cf().later.includes(id)) return false;
    remember('caseFile.later', [...cf().later, id]);
    emit('case:note', { id, toast });
    return true;
  },
  has: (id) => cf().clues.includes(id),
  clues: () => cf().clues.slice(),
  /**
   * Pin or update a suspect. opts: { status: 'checked'|'toCheck'|'none', as: another suspect id (the
   * oldman pin becomes durand), later: true (adds whyLater) }. The first pin defaults to 'toCheck', or 'none'
   * for a suspect with no alibi text.
   */
  suspect(id, { status, as, later } = {}) {
    if (!cf().open) caseFile.open();
    const all = { ...cf().suspects };
    const was = all[id];
    const T = L.caseFile?.suspects?.[as ?? was?.as ?? id];
    all[id] = {
      status: status ?? was?.status ?? (T?.alibi ? 'toCheck' : 'none'),
      as: as ?? was?.as ?? null,
      later: later ?? was?.later ?? false,
    };
    remember('caseFile.suspects', all);
    emit('case:suspect', { id });
  },
  /** [{ id, status, as, later }] in pin order. */
  suspects: () => Object.entries(cf().suspects).map(([id, s]) => ({ id, ...s })),
  /** The clue as shown: { name, note } (noteLater once updated; the window seed's sentence when remembered). */
  clueText(id) {
    const T = L.caseFile?.clues?.[id];
    if (!T) return { name: id, note: '' };
    let note = cf().later.includes(id) && T.noteLater ? T.noteLater : T.note;
    if (T.noteWindow && mem.seeds?.window) note = `${note} ${T.noteWindow}`;
    return { name: T.name, note };
  },
};

// ================================================================ lines
// For Hotspots: what Hugo or the person says. Every result is an array of line objects for d.say.

const NAMES_OF = () => ({ ...(L.items?.people || {}), ...(L.names || {}) });
/** The speaker label for a person id ('jo' -> 'Jo'), for toasts. */
export const personName = (person) => NAMES_OF()[person] ?? person;

const toLines = (entry) => {
  if (entry == null) return [];
  if (Array.isArray(entry)) return entry.flatMap(toLines);
  if (typeof entry === 'string') return [{ who: L.names?.hugo || 'Hugo', text: entry, inner: true }];
  return [entry];
};

// Shuffle bags: each key draws its list in a random order, no repeat until the bag is empty.
const bags = new Map();
function draw(key, list) {
  if (!Array.isArray(list) || !list.length) return null;
  let b = bags.get(key);
  if (!b || !b.left.length || b.n !== list.length) {
    const left = list.map((_, i) => i);
    for (let i = left.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [left[i], left[k]] = [left[k], left[i]];
    }
    b = { n: list.length, left };
    bags.set(key, b);
  }
  return list[b.left.pop()] ?? list[0];
}

/**
 * The wrong item on a hotspot: { lines, buzz? }. spot: { person?, object? } (Hotspots' spot). Item-specific
 * lines first (the watch, the phone / tape / soup on a person, the keys on a door), then the person's bag, or
 * on an object the kind's bag with the generic one.
 */
export function refusal(id, { person = null, object = null } = {}) {
  const R = L.items?.refuse || {};
  const kind = kindOf(id);
  if (id === 'watch' && R.watch) return { lines: toLines(R.watch.think), buzz: R.watch.buzz };
  if (person) {
    const special = { phone: R.phoneOnPerson, tape: R.tapeOnPerson, soup: person === 'odile' ? null : R.soupOnPerson }[id];
    if (special) return { lines: toLines(special) };
    const bag = R[person];
    if (Array.isArray(bag)) return { lines: toLines(draw(`p:${person}`, bag)) };
  }
  if (id === 'keys' && object === 'door' && R.keysOnDoor) return { lines: toLines(R.keysOnDoor) };
  const bag = [...(Array.isArray(R[kind]) ? R[kind] : []), ...(Array.isArray(R.object) ? R.object : [])];
  return { lines: toLines(draw(`k:${kind}`, bag)) };
}

/** A person's reply to a gift (L.items.give.<id>.<person>) as lines, or null if they won't take it. */
export function giftLines(id, person) {
  const entry = L.items?.give?.[id]?.[person];
  return entry ? toLines(entry) : null;
}

/** A needs line: the hotspot's own (lines, a line or a string), else L.items.needs.generic. */
export function needsLines(own) {
  const l = toLines(own);
  return l.length ? l : toLines(L.items?.needs?.generic);
}

// ================================================================ debug

/** __game.debug.items */
export function itemDebug() {
  return {
    ids: () => Object.keys(ITEMS),
    list: () => pocket.list(),
    give: (id, opts) => (isClue(id) ? caseFile.add(id, opts) : pocket.add(id, opts)),
    take: (id) => pocket.remove(id, { toast: true }),
    select: (id) => pocket.select(id ?? null),
    held: () => pocket.selected(),
    clear: () => pocket.clear(),
    suspect: (id, opts) => caseFile.suspect(id, opts),
    state: () => ({ list: state.list.slice(), held: state.held, hidden: state.hidden, snaps: JSON.parse(JSON.stringify(state.snaps)), case: JSON.parse(JSON.stringify(cf())) }),
  };
}
