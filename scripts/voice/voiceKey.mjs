// HAIRLINE voice key: the one function that ties a displayed line to its voice clip.
//
// Shared by the generator (scripts/voice/*) and the game runtime, which copies this file verbatim.
// Keep it a pure, dependency-free, browser-safe ES module (no Node APIs, no imports).
//
//   normalize(text) -> canonical form of a line (markup and typography removed)
//   voiceKey(text)  -> 12 hex chars: the top 48 bits of FNV-1a 64 over the UTF-8 bytes of normalize(text)
//
// Clips are keyed by TEXT ONLY. When the same text is spoken by several speakers, the manifest entry
// holds per-speaker variants keyed by the displayed French "who" label (see docs/voice.md).
//
// Changing anything here changes keys: regenerate scripts/voice/lines.fr.json and the manifest.

export const VOICE_KEY_VERSION = 1;

/**
 * Canonical text for keying:
 *  - Unicode NFC; HTML tags removed; *emphasis* / *stage* markers removed (their words kept);
 *  - apostrophes (’ ‘ ʼ ´ ` ′) -> ', quotes (« » “ ” „ ‟ ″ ") -> ", '...' -> …;
 *  - every kind of whitespace (incl. the French no-break spaces) collapsed to one space;
 *  - no space just inside « » / after an opening or before a closing quote, none before ? ! : ; ;
 *  - trimmed.
 */
export function normalize(text) {
  let s = String(text == null ? '' : text);
  if (s.normalize) s = s.normalize('NFC');
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/\*/g, '');
  s = s.replace(/[\u2019\u2018\u02BC\u00B4`\u2032]/g, "'");
  s = s.replace(/\u00AB[\s\u00A0\u202F]*/g, '"').replace(/[\s\u00A0\u202F]*\u00BB/g, '"');
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
  s = s.replace(/\.\.\./g, '\u2026');
  s = s.replace(/[\s\u00A0\u202F\u2007\u2009\u200A\u2028\u2029\uFEFF]+/g, ' ');
  s = s.replace(/ ([?!:;])/g, '$1');
  return s.trim();
}

const FNV_OFFSET = BigInt('0xcbf29ce484222325');
const FNV_PRIME = BigInt('0x100000001b3');
const MASK64 = BigInt('0xffffffffffffffff');

function utf8(s) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  const out = [];
  for (const ch of s) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** FNV-1a 64-bit of a string's UTF-8 bytes, as 16 hex chars. */
export function fnv1a64(s) {
  let h = FNV_OFFSET;
  for (const b of utf8(s)) {
    h ^= BigInt(b);
    h = (h * FNV_PRIME) & MASK64;
  }
  return h.toString(16).padStart(16, '0');
}

/** The clip key of a displayed line: 12 hex chars. */
export function voiceKey(text) {
  return fnv1a64(normalize(text)).slice(0, 12);
}

export default voiceKey;
