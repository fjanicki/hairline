// Shared by scripts/i18n-check.mjs and scripts/i18n-skeleton.mjs: load the text trees, walk leaves,
// and tell game data (colours, ids, watch numbers) from translatable text.
import { NAMES } from '../src/story/text/common.js';

export const FILES = ['common', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5'];
export const MARK = '⟦EN⟧ '; // skeleton prefix: text nobody has translated yet

/** { common, ch1, ... } default exports for a language ('en' = src/story/text/*.js). */
export async function loadLang(code) {
  const out = {};
  for (const f of FILES) {
    const url = new URL(`../src/story/text/${code === 'en' ? '' : code + '/'}${f}.js`, import.meta.url);
    try {
      out[f] = (await import(url.href)).default;
    } catch (err) {
      out[f] = undefined;
      out[`${f}:error`] = String(err.message || err);
    }
  }
  return out;
}

export const isObj = (v) => v !== null && typeof v === 'object';

/** Every leaf as [path, value] (path like 'ch2.nameOne.options.1.text'). */
export function leaves(tree, path = '', out = []) {
  if (isObj(tree)) for (const [k, v] of Object.entries(tree)) leaves(v, path ? `${path}.${k}` : k, out);
  else out.push([path, tree]);
  return out;
}

const DATA_KEYS = new Set(['id', 'hand', 'color', 'paint', 'paintColor', 'flare', 'hairlineColor']);
const NAME_SET = new Set(Object.values(NAMES));

/** True for game data that must stay identical in every language (parsed or used as colours/ids). */
export function isData(path, v) {
  if (typeof v !== 'string') return true; // numbers, booleans, null
  const key = path.split('.').pop();
  if (DATA_KEYS.has(key)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return true;
  if (/^[\d\s.,:]*\s*(km|m)?$/.test(v)) return true; // '0.32 km', '38:40', '3:04:51', '' (a decimal comma is allowed)
  return false;
}

/**
 * Text that is already French (or a brand / initials) in the English game: in-world signage on a
 * French street stays as it is in every language. Skeletons copy it unmarked; the checker expects it
 * identical. Prefix match on the key path.
 */
export const AS_IS = [
  'title.name', // HAIRLINE
  'ch2.signs.ghost',
  'ch2.signs.bakery',
  'ch2.signs.fasciaStart',
  'ch2.signs.fascia',
  'ch3.signs.bakery',
  'ch3.race.banners.0', // STRIDE (brand)
  'ch4.signs.old',
  'ch4.signs.open', // the lettering minigame paints O-P-E-N (fixed stroke paths)
  'ch4.signs.initials',
  'ch5.signs.open',
  'ch5.signs.initials',
];
export const isAsIs = (path) => AS_IS.some((p) => path === p || path.startsWith(p + '.'));

/** Same game data, either decimal mark ('0,32 km' for '0.32 km', docs/i18n-fr.md section 6). */
export const sameData = (en, tr) => tr === en || tr.replace(/(\d),(\d)/g, '$1.$2') === en;

/**
 * Key names a translation writes instead of the English ones: the game reads physical key codes,
 * so French names the AZERTY keys (WASD -> ZQSD, A -> Q, Space -> Espace; docs/i18n-fr.md 4.3).
 */
export const KEY_NAMES = {
  fr: { WASD: 'ZQSD', Arrows: 'Flèches', Shift: 'Maj', Space: 'Espace', SPACE: 'ESPACE', Esc: 'Échap', ESC: 'Échap', A: 'Q', W: 'Z' },
};

/** Character names: shared labels, identical in every language. */
export function isName(path, v) {
  return (path.startsWith('names.') || path.endsWith('.who')) && NAME_SET.has(v);
}
