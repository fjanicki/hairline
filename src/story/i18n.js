// HAIRLINE text runtime: the live text tree, key-token resolution and text-change events.
//
// The game is French only (style guide: docs/i18n-fr.md; check: `node scripts/text-check.mjs`).
// L (script.js) is built once from src/story/text/*.js and never replaced: when it is re-resolved, its
// contents are rewritten in place (objects keep their identity and get their keys replaced, arrays are
// refilled), so chapter code can cache `const T = L.ch2` at module scope. Cache objects, never strings.
// Key names in text are tokens ('{KeyA}', '{Space}'): L holds them resolved for the player's keyboard
// layout (core/KeyLabels.js); when the layout is learned, L is re-resolved and listeners fire.

import { keyText, onKeyLabels, setKeyNames } from '../core/KeyLabels.js';

let L = null; // the live tree (script.js exports it)
let authored = null; // the text tree as written (key tokens unresolved)
let live = null; // authored with key tokens resolved (cleared when key labels change)
const index = new Map(); // any resolution of a string -> its key path
const listeners = new Set();
const chapterListeners = new Set();

const isObj = (v) => v !== null && typeof v === 'object';

function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
}

/** Rewrite dst to match src, keeping every nested object/array. Runtime '_flags' (o._used) survive. */
function replaceInPlace(dst, src) {
  if (Array.isArray(dst)) {
    dst.length = src.length;
    src.forEach((v, i) => {
      if (isObj(v) && isObj(dst[i]) && Array.isArray(v) === Array.isArray(dst[i])) replaceInPlace(dst[i], v);
      else dst[i] = clone(v);
    });
    return;
  }
  for (const k of Object.keys(dst)) if (!(k in src) && !k.startsWith('_')) delete dst[k];
  for (const [k, v] of Object.entries(src)) {
    if (isObj(v) && isObj(dst[k]) && Array.isArray(v) === Array.isArray(dst[k])) replaceInPlace(dst[k], v);
    else dst[k] = clone(v);
  }
}

function addToIndex(tree, path = []) {
  if (typeof tree === 'string') {
    if (!index.has(tree)) index.set(tree, path);
  } else if (isObj(tree)) for (const [k, v] of Object.entries(tree)) addToIndex(v, [...path, k]);
}

const at = (tree, path) => path.reduce((o, k) => (o == null ? o : o[k]), tree);

const resolveKeys = (v, names) =>
  typeof v === 'string' ? keyText(v, names) : isObj(v) ? (Array.isArray(v) ? v.map((x) => resolveKeys(x, names)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveKeys(x, names)]))) : v;

/** The authored tree with '{KeyA}' / '{Space}' resolved for the current layout. */
function resolved() {
  if (!live) {
    live = resolveKeys(authored, authored.keyNames);
    addToIndex(live); // old resolutions stay indexed, so retext() maps them to the new ones
  }
  return live;
}

function notify() {
  for (const set of [listeners, chapterListeners]) {
    for (const fn of [...set]) {
      try {
        fn();
      } catch (err) {
        console.error('[i18n] listener failed', err);
      }
    }
  }
}

// The layout became known (getLayoutMap, a keydown): re-resolve L in place and tell the listeners.
onKeyLabels(() => {
  if (!L) return;
  const before = JSON.stringify(resolved());
  live = null;
  if (JSON.stringify(resolved()) === before) return;
  replaceInPlace(L, resolved());
  notify();
});
setKeyNames(() => L?.keyNames);

/** script.js: build L from the text tree. */
export function initTexts(tree) {
  authored = tree;
  L = clone(resolved());
  return L;
}

/** The one language. core/Voice.js asks (voices exist in French). */
export const getLang = () => 'fr';

/**
 * fn() whenever L is re-resolved (the keyboard layout was learned). Returns unsubscribe. { chapter: true }
 * listeners (scene canvas text) are dropped by the Director between chapters (releaseChapterListeners).
 */
export function onLangChange(fn, { chapter = false } = {}) {
  const set = chapter ? chapterListeners : listeners;
  set.add(fn);
  return () => set.delete(fn);
}

export function releaseChapterListeners() {
  chapterListeners.clear();
}

/**
 * A string taken from L before a re-resolve -> the same key's text now ('[W] Regarder' -> '[Z] Regarder').
 * For UI that holds on to strings (objective, prompts, notebook, watch labels). Unknown text is kept.
 */
export function retext(s) {
  if (typeof s !== 'string' || !L) return s;
  const p = index.get(s);
  if (p) {
    const v = at(L, p);
    return typeof v === 'string' ? v : s;
  }
  if (/\{[A-Z]\w*\}/.test(s)) return keyText(s); // a stray token string
  // '[A / D] Alterner…' / '[Espace]': the key chip follows too ('[Q / D]').
  const m = s.match(/^(\[[^\]]+\])(\s*)([\s\S]*)$/);
  if (!m) return s;
  const chip = index.has(m[1]) ? retext(m[1]) : `[${retext(m[1].slice(1, -1))}]`;
  return chip + m[2] + (m[3] ? retext(m[3]) : '');
}

/** Decimal comma for numbers the code formats: '212.4 km' -> '212,4 km'. Times ('38:40') are untouched. */
export const num = (s) => (typeof s === 'string' ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s);

/** parseFloat that reads either decimal mark ('0,32 km'). */
export const parseNum = (s) => parseFloat(String(s).replace(/(\d),(\d)/, '$1.$2'));
