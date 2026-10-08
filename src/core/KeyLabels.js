// Printed key labels for physical KeyboardEvent.code values, following the player's keyboard layout.
// Input reads codes (KeyW...), which work on every layout; only the labels need the layout.
// Source, in order: real keydowns (e.code -> e.key, letter keys, no modifiers or dead keys),
// navigator.keyboard.getLayoutMap() (Chromium), US QWERTY. Named keys (Space, Shift, Escape, Enter,
// Arrows) come from the text (L.keyNames, registered by i18n.js). Text writes keys as tokens,
// '{KeyA}' / '{Space}', resolved by keyText() (docs/API.md, i18n). Node-safe (scripts/i18n-lib.mjs).

/** A key token in text: a physical letter code or a named key. */
export const KEY_TOKEN = /\{(Key[A-Z]|Space|Shift|Escape|Enter|Arrows)\}/g;
const NAMED = { Space: 'Space', Shift: 'Shift', Escape: 'Esc', Enter: 'Enter', Arrows: 'Arrows' }; // fallback
// Keys whose action also accepts the character they type (main.js: mute is KeyM or a typed 'm').
const TYPED = { KeyM: 'm' };

const layout = new Map(); // code -> lower-case key, from getLayoutMap()
const seen = new Map(); // code -> lower-case key, from real keydowns (wins over the map)
const chars = new Set(); // every character the layout map types, on any key
const listeners = new Set();
let names = () => null;

const up = (k) => k.toLocaleUpperCase();
const LETTER = /^Key[A-Z]$/;

/** The printed label for a physical code ('KeyA' -> 'Q' on AZERTY), or a localized key name. */
export function label(code) {
  if (!LETTER.test(code)) return names()?.[code] ?? NAMED[code] ?? code;
  const k = seen.get(code) ?? layout.get(code);
  const t = TYPED[code];
  // Typed fallback: label it by its letter unless the layout has no such letter (non-Latin).
  if (t && (!k || chars.has(t) || !/\p{L}/u.test(k) || /^[a-z]$/.test(k))) return up(t);
  return k ? up(k) : code.slice(3);
}

/** Resolve '{KeyA}' / '{Space}' tokens. names: a keyNames table (default: the live L.keyNames). */
export function keyText(s, tbl) {
  if (typeof s !== 'string' || !s.includes('{')) return s;
  return s.replace(KEY_TOKEN, (_, c) => (LETTER.test(c) ? label(c) : tbl?.[c] ?? label(c)));
}

/** i18n.js: where named keys get their localized names. */
export function setKeyNames(fn) {
  names = fn;
}

/** fn() whenever a learned label changes. Returns unsubscribe. */
export function onKeyLabels(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (err) {
      console.error('[keys] listener failed', err);
    }
  }
}

/** Record code -> key; true if a letter label changed. */
function learn(map, code, key) {
  if (!LETTER.test(code) || typeof key !== 'string' || [...key].length !== 1 || !key.trim()) return false;
  const before = label(code);
  map.set(code, key.toLocaleLowerCase());
  return label(code) !== before;
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.getModifierState?.('AltGraph') || e.isComposing) return;
      if (learn(seen, e.code, e.key)) changed();
    },
    true,
  );
  try {
    navigator.keyboard
      ?.getLayoutMap?.()
      .then((map) => {
        let diff = false;
        for (const [code, key] of map) {
          if (typeof key === 'string') chars.add(key.toLocaleLowerCase());
          diff = learn(layout, code, key) || diff;
        }
        if (diff) changed();
      })
      .catch(() => {});
  } catch {
    /* no Keyboard API */
  }
}
