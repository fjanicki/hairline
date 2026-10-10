// Cross-chapter flags (DESIGN R3.1). Read `mem` directly; write through remember().
// Persists to localStorage so a reload, Continue on the title screen, Pause > Restart chapter and ?chapter=N
// keep earlier chapters' choices.

const KEY = 'hairline.mem';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/** Shape and defaults. Frozen. Revision 4 keys: docs/SCRIPT-R4.md §10.5. */
export const DEFAULTS = deepFreeze({
  seeds:      { table: false, ghost: false, window: false }, // window: Ch1, the clicking bike at 3 a.m.
  doorGrey:   '#8d877c',
  grey:       { tries: 0, assisted: false },
  measure:    { readings: [], agreed: 81.5, assisted: false },
  wheel:      { secs: 0, plucks: 0, assisted: false, overTight: false },
  teachFirst: true,
  panel:      null,
  jobs:       { shutter: false, radio: false, board: false, wheel: false },
  // L’AFFAIRE (story/items.js caseFile): clue ids in the order found, clues whose note was updated,
  // suspect pins { id: { status: 'checked'|'toCheck'|'none', as: id|null, later: bool } } in pin order,
  // and the deduction board's tally (SCRIPT-R4 §10.5).
  caseFile:   { open: false, clues: [], later: [], suspects: {}, wrong: 0, accused: [] },
  // Jo's warmth (SCRIPT-R4 §11.2): five flags, joWarmth() counts them; warm is >= 3.
  joSign:      false, // Ch2 ch2.jo.menu option 1 (« C’est de travers. »)
  joLearned:   false, // Ch5 ch5.week3.joMenu options 2-3 (a skill, not the 212 km)
  joCroissant: false, // Ch5 the croissant given to Jo
  joStay:      false, // Ch6 ch6.week7.stayMenu option 1 (« J’arrive. »)
  joProud:     false, // Ch6 ch6.week9.cuteMenu option 2 (the earnest answer)
  stencil:     null, // Ch6 STENCIL tier: 'good' | 'middle' | 'poor'
  durandKudos: null, // Ch6 ch6.week9.bravo: the option picked (index), whichever it was a bravo is sent
  ragsKept:    false, // Ch5 end: the rags are still in the pocket (Ch6 starts with them, §1.5)
});

/** Jo's flags, in story order (SCRIPT-R4 §11.2). */
export const WARMTH_KEYS = Object.freeze(['joSign', 'joLearned', 'joCroissant', 'joStay', 'joProud']);

// Owner chapter index per path: beginChapter(i) resets every path owned by a chapter >= i.
// Indices are Revision 4's (docs/SCRIPT-R4.md §0.3): 0 Ch1 ... 4 Ch5, 5 Ch6, 6 Ch7 « Le Mur ».
const OWNER = {
  'seeds.table': 0, 'seeds.ghost': 1, 'seeds.window': 0,
  doorGrey: 3, grey: 3, measure: 3,
  wheel: 4, // Ch5 Week 4 truing (was Ch4's)
  teachFirst: 6, panel: 6, jobs: 6, // Ch7 « Le Mur »
  caseFile: 4, // Ch5 opens the case; Ch6 adds to it, never clears it
  joSign: 1, joLearned: 4, joCroissant: 4, ragsKept: 4,
  joStay: 5, joProud: 5, stencil: 5, durandKudos: 5,
};
const ID_LISTS = new Set(['caseFile.clues', 'caseFile.later', 'caseFile.accused']);
const STATUSES = ['checked', 'toCheck', 'none'];
const isId = (x) => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(x);
const PANELS = ['wheel', 'door', 'hand'];
const TIERS = ['good', 'middle', 'poor'];

/** The live flags. */
export const mem = clone(DEFAULTS);

const getAt = (o, parts) => parts.reduce((a, k) => (a == null ? undefined : a[k]), o);
function setAt(o, parts, v) {
  let a = o;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!a[parts[i]] || typeof a[parts[i]] !== 'object') a[parts[i]] = {};
    a = a[parts[i]];
  }
  a[parts[parts.length - 1]] = v;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* private window / blocked: in-memory still works */ }
}

/** Set a top-level key or a dotted path ('jobs.radio'). Object values replace the old value. Never throws. */
export function remember(path, value) {
  try {
    setAt(mem, String(path).split('.'), clone(value));
    persist();
  } catch (e) { console.warn('[mem] remember failed', path, e); }
}

/** Reset every flag owned by chapter >= index to its default, then persist. */
export function beginChapter(index) {
  for (const [path, ch] of Object.entries(OWNER)) {
    if (ch < index) continue;
    const parts = path.split('.');
    setAt(mem, parts, clone(getAt(DEFAULTS, parts)));
  }
  persist();
}

// Merge `src` over `def` keeping only known keys with matching types.
function merge(def, src, path) {
  if (path === 'panel') return PANELS.includes(src) ? src : null;
  if (path === 'stencil') return TIERS.includes(src) ? src : null;
  if (path === 'durandKudos') return Number.isInteger(src) && src >= 0 && src < 8 ? src : null;
  if (ID_LISTS.has(path)) return Array.isArray(src) ? [...new Set(src.filter(isId))] : [];
  if (path === 'caseFile.suspects') {
    const out = {};
    for (const [id, v] of Object.entries(src && typeof src === 'object' && !Array.isArray(src) ? src : {})) {
      if (isId(id) && v && typeof v === 'object') out[id] = { status: STATUSES.includes(v.status) ? v.status : 'toCheck', as: isId(v.as) ? v.as : null, later: v.later === true };
    }
    return out;
  }
  if (Array.isArray(def)) return Array.isArray(src) ? src.filter((x) => typeof x === 'number' && isFinite(x)) : clone(def);
  if (def && typeof def === 'object') {
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], src && typeof src === 'object' && !Array.isArray(src) ? src[k] : undefined, path ? `${path}.${k}` : k);
    return out;
  }
  if (path === 'doorGrey') return typeof src === 'string' && /^#[0-9a-f]{6}$/i.test(src) ? src.toLowerCase() : def;
  return typeof src === typeof def && (typeof src !== 'number' || isFinite(src)) ? src : def;
}

/** At boot: merge the stored JSON over DEFAULTS. Unknown keys and bad types are ignored. Never throws. */
export function restoreMem() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  const m = merge(DEFAULTS, raw, '');
  for (const k of Object.keys(m)) mem[k] = m[k];
}

/** Jo's warmth, 0-5: the number of true WARMTH_KEYS (SCRIPT-R4 §11.2). Warm is >= 3. Pure. */
export function joWarmth(m = mem) {
  return WARMTH_KEYS.filter((k) => m?.[k] === true).length;
}

/** Deep copy, for debug and tests. */
export function memSnapshot() { return clone(mem); }
