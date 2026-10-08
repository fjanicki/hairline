// HAIRLINE i18n: the current language, the in-place swap of L and language-change events.
//
// L (script.js) is built once from the English text and never replaced: setLang() rewrites its
// contents in place (objects keep their identity and get their keys replaced, arrays are refilled),
// so chapter code can cache `const T = L.ch2` at module scope. Cache objects, never strings.
// A key missing from a translation falls back to English (debug: warning '[i18n] missing fr key: path').
// Adding a language: text/<code>/*.js mirroring text/*.js, an entry in LANGS, the import in script.js;
// check it with `node scripts/i18n-check.mjs <code>`.
// Key names in text are tokens ('{KeyA}', '{Space}'): L holds them resolved for the player's keyboard
// layout and language (core/KeyLabels.js); when the layout is learned, L is re-resolved and listeners fire.

import { keyText, onKeyLabels, setKeyNames } from '../core/KeyLabels.js';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const KEY = 'hairline.lang';
const CODES = LANGS.map((l) => l.code);
const DEBUG = (() => {
  try {
    return new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    return false;
  }
})();

/** ?lang=, else the remembered choice, else French (the default until the player picks a language). */
function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (CODES.includes(q)) return q;
  } catch {
    /* no location */
  }
  try {
    const s = localStorage.getItem(KEY);
    if (CODES.includes(s)) return s;
  } catch {
    /* storage blocked */
  }
  return 'fr';
}

let lang = 'en';
let L = null; // the live tree (script.js exports it)
let tables = {}; // code -> raw text tree as authored
const merged = {}; // code -> English-shaped tree, gaps filled from English (key tokens unresolved)
let live = {}; // code -> merged tree with key tokens resolved (cleared when key labels change)
const index = new Map(); // any language's string -> its key path (English first)
const listeners = new Set();
const chapterListeners = new Set();

const isObj = (v) => v !== null && typeof v === 'object';

function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
}

/** English shape, translated leaves where present (same type), English elsewhere. */
function fill(en, tr, path, missing) {
  if (Array.isArray(en)) return en.map((v, i) => fill(v, Array.isArray(tr) ? tr[i] : undefined, `${path}.${i}`, missing));
  if (isObj(en)) {
    const t = isObj(tr) && !Array.isArray(tr) ? tr : undefined;
    return Object.fromEntries(Object.keys(en).map((k) => [k, fill(en[k], t?.[k], path ? `${path}.${k}` : k, missing)]));
  }
  if (tr === undefined || (en !== null && tr !== null && typeof tr !== typeof en)) {
    missing.push(path);
    return en;
  }
  return tr;
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

function mergedFor(code) {
  if (!merged[code]) {
    const missing = [];
    merged[code] = code === 'en' ? tables.en : fill(tables.en, tables[code], '', missing);
    if (DEBUG && missing.length) setTimeout(() => missing.forEach((p) => console.warn(`[i18n] missing ${code} key: ${p}`)));
  }
  return merged[code];
}

const resolveKeys = (v, names) =>
  typeof v === 'string' ? keyText(v, names) : isObj(v) ? (Array.isArray(v) ? v.map((x) => resolveKeys(x, names)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveKeys(x, names)]))) : v;

/** merged tree with '{KeyA}' / '{Space}' resolved for this language and the current layout. */
function liveFor(code) {
  if (!live[code]) {
    const m = mergedFor(code);
    live[code] = resolveKeys(m, m.keyNames);
    addToIndex(live[code]); // old resolutions stay indexed, so retext() maps them to the new ones
  }
  return live[code];
}

function notify() {
  for (const set of [listeners, chapterListeners]) {
    for (const fn of [...set]) {
      try {
        fn(lang);
      } catch (err) {
        console.error('[i18n] listener failed', err);
      }
    }
  }
}

// The layout became known (getLayoutMap, a keydown): re-resolve L like a language change.
onKeyLabels(() => {
  if (!L) return;
  const before = JSON.stringify(liveFor(lang));
  live = {};
  if (JSON.stringify(liveFor(lang)) === before) return;
  replaceInPlace(L, liveFor(lang));
  notify();
});
setKeyNames(() => L?.keyNames);

/** script.js: build L from { en, fr, ... } text trees and apply the initial language. */
export function initTexts(trees) {
  tables = trees;
  L = clone(liveFor('en'));
  const first = initialLang();
  if (first !== 'en' && trees[first]) {
    replaceInPlace(L, liveFor(first));
    lang = first;
  }
  try {
    document.documentElement.lang = lang;
  } catch {
    /* no document */
  }
  return L;
}

export const getLang = () => lang;

/** Switch language: swap L in place, remember the choice, then tell every listener. */
export function setLang(code) {
  if (!CODES.includes(code) || !tables[code] || !L) return false;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: this session only */
  }
  if (code === lang) return true;
  replaceInPlace(L, liveFor(code));
  lang = code;
  try {
    document.documentElement.lang = code;
  } catch {
    /* no document */
  }
  notify();
  return true;
}

/**
 * fn(code) after every language change, and when the key labels change (layout learned). Returns unsubscribe. { chapter: true } listeners (scene
 * canvas text) are dropped by the Director between chapters (releaseChapterListeners).
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
 * A string taken from L in any language -> the same key's text now ('[E] Look' keeps its key chip).
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
  // '[A / D] Alternate…' / '[Space]': the key chip follows too ('[Q / D]', '[Espace]').
  const m = s.match(/^(\[[^\]]+\])(\s*)([\s\S]*)$/);
  if (!m) return s;
  const chip = index.has(m[1]) ? retext(m[1]) : `[${retext(m[1].slice(1, -1))}]`;
  return chip + m[2] + (m[3] ? retext(m[3]) : '');
}

/** Decimal marks for display: '212.4 km' -> '212,4 km' in French. Times ('38:40') are untouched. */
export const num = (s) => (lang === 'fr' && typeof s === 'string' ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s);

/** parseFloat that reads either decimal mark ('0,32 km'). */
export const parseNum = (s) => parseFloat(String(s).replace(/(\d),(\d)/, '$1.$2'));

/** The English text for a string from L in any language (e.g. a speaker label -> its CSS class). */
export function english(s) {
  const p = typeof s === 'string' ? index.get(s) : null;
  const v = p ? at(tables.en, p) : null;
  return typeof v === 'string' ? v : s;
}
