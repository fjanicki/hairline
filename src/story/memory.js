// Cross-chapter flags (DESIGN R3.1). Read `mem` directly; write through remember().
// Persists to sessionStorage so Pause > Restart chapter (a reload) and ?chapter=N keep earlier chapters' choices.

const KEY = 'hairline.mem';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/** Shape and defaults. Frozen. */
export const DEFAULTS = deepFreeze({
  seeds:      { table: false, ghost: false },
  doorGrey:   '#8d877c',
  grey:       { tries: 0, assisted: false },
  measure:    { readings: [], agreed: 81.5, assisted: false },
  wheel:      { secs: 0, plucks: 0, assisted: false, overTight: false },
  teachFirst: true,
  panel:      null,
  jobs:       { shutter: false, radio: false, board: false, wheel: false },
});

// Owner chapter index per path: beginChapter(i) resets every path owned by a chapter >= i.
const OWNER = {
  'seeds.table': 0, 'seeds.ghost': 1,
  doorGrey: 3, grey: 3, measure: 3, wheel: 3,
  teachFirst: 4, panel: 4, jobs: 4,
};
const PANELS = ['wheel', 'door', 'hand'];

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
  try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* private window / blocked: in-memory still works */ }
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
  try { raw = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  const m = merge(DEFAULTS, raw, '');
  for (const k of Object.keys(m)) mem[k] = m[k];
}

/** Deep copy, for debug and tests. */
export function memSnapshot() { return clone(mem); }
