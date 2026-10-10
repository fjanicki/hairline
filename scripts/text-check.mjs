// HAIRLINE text checker: the French text tree in src/story/text/*.js (the game is French only).
// Usage: node scripts/text-check.mjs [--all]   (--all lists every finding, not the first 12 per kind)
// Errors (exit 1): a file that does not load, empty or untrimmed text, leftover English (cheap stop-word
// test), unknown {KeyA} key tokens or key names written literally where a token belongs, French
// typography (« » with a no-break space inside, a no-break space before ? ! : ;, ’ not ', … not ...,
// no straight double quotes, no double spaces, a decimal comma), text over its UI LIMIT (tokens resolved),
// and broken game data (ch2's fascia prefix). Warnings: a speaker label not in NAMES / SPEAKERS.
// Style and wording rules: docs/i18n-fr.md.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KEY_TOKEN, keyText } from '../src/core/KeyLabels.js';

const FILES = ['common', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'items', 'caseFile', 'games'];
const DIR = process.env.HAIRLINE_TEXT_DIR ? pathToFileURL(path.resolve(process.env.HAIRLINE_TEXT_DIR) + '/').href : new URL('../src/story/text/', import.meta.url).href; // override for tests
const ALL = process.argv.includes('--all');

/**
 * Tight UI spots: key path (with * for one segment) -> max characters, measured at 1280x800 from the
 * live CSS boxes with French text. The smallest match applies.
 */
export const LIMITS = {
  // GPS watch: label (96 px, 2 lines, 9 px caps), lap line (mono, inside the round screen), notification (240 px box, 3 lines)
  'watch.labels.*': 25,
  'watch.atChapter.*.label': 25,
  'ch1.watchHud.label': 25,
  'ch1.walkLabel': 25,
  'ch3.weekLabel': 25,
  'ch3.race.label': 25,
  'ch3.finish.weekLabel': 25,
  'ch7.walk.watchHud.label': 25,
  'ch1.watchHud.lap': 16,
  'ch2.howFarLap': 16,
  'ch1.buzz': 90,
  'ch1.startBuzz': 90,
  'ch2.pauseBuzz': 90,
  'ch2.hold.buzz': 90,
  'ch3.finish.buzz': 90,
  'ch4.sanding.buzz': 90,
  'ch6.week7.buzz': 90,
  'ch3.weeks.*.stride.prompt': 90, // also the watch notification (minus 'STRIDE :')
  // Notebook (246 px, one line, 19 px hand)
  'notebook.items.*': 37,
  'notebook.someSundays': 30, // after its entry, on the same line
  'notebook.heading': 27,
  // HUD lines
  '*.objectives.*': 83, // top-left, clear of the centred hint
  '*.prompts.*': 100, // '[E] ' + prompt, centred, clear of the watch
  'hints.*': 110,
  'ch5.week4.truing.hint': 110, // craft prompt (bottom-centre)
  'ch4.sanding.hint': 100,
  'items.*.name': 24, // pocket label and toast (paper tag, hand); items.ui / items.hints: SCRIPT-R4 §1.2
  'items.hints.*': 110,
  'caseFile.clues.*.name': 30, // the case tab row (one line, hand)
  'ui.space': 43,
  'ch2.hold.gauge': 41, // gauge caption (360 px, wide caps)
  'ch3.gauge.label': 41,
  'ch4.sanding.gauge': 41,
  'ch5.week4.truing.gauge': 41,
  'ch5.week4.truing.pitch.*': 41, // gauge readout
  'ch7.line.gauge': 41,
  'ch7.jobs.shutter.gauge': 41,
  'ui.pain': 21,
  // Buttons and options (pause / title / end)
  'pause.resume': 39,
  'pause.restart': 39,
  'pause.options': 39,
  'options.back': 39,
  'mobile.continue': 39,
  'ending.playAgain': 39,
  'ending.cards.*.*': 140, // end card lines (seven at once: must fit a landscape phone)
  'ending.cards.ask': 140,
  'ending.cards.runs': 140,
  'ending.cards.watch': 140,
  reload: 39,
  'options.voices': 17,
  'pause.quality': 17,
  'pause.tiers.*': 12,
  'title.controls.*.0': 19,
  'title.controls.*.1': 42,
  'title.begin': 99,
  'title.tagline': 163,
  // Choice menus (600 px buttons, two lines; the question above, two lines)
  '*.options.*.text': 134,
  '*.*.options.*.text': 134,
  '*.*.*.options.*.text': 134,
  '*.*.*.*.options.*.text': 134,
  'ch2.nameOne.prompt': 193,
  'ch4.day8.tape.hint': 100, // craft prompt (bottom-centre)
  'ch4.day8.mixer.hint': 100,
  'ch7.jobs.radio.hint': 100, // craft prompt (bottom-centre)
  'ch4.day8.mixer.tins.*': 12, // colour-toy chip: tin names under the dots
  'ch4.day8.mixer.tip': 16, // chip buttons (with their key chip)
  'ch4.day8.mixer.done': 16,
  'ch6.week7.signMenu.prompt': 193,
  'ch7.teach.menu.prompt': 193,
  'ch7.panel.menu.prompt': 193,
  'ch7.walk.restMenu.prompt': 193,
  // Revision 4 strings (docs/SCRIPT-R4.md §13.8): new chapters' objectives and prompts, captions, game hints.
  'ch5.objectives.*': 30,
  'ch6.objectives.*': 30,
  'ch5.prompts.*': 27, // §13.8 says 26, with one known 27 (« Utiliser le papier de verre » is items.ui)
  'ch6.prompts.*': 27,
  'ch5.captions.*': 30,
  'ch6.captions.*': 30,
  'games.*.hint': 110, // a two-line chip
  'games.*.*.hint': 110,
};

/**
 * Exemptions: key path prefix -> the checks it skips. Brands, painted signage and the credits keep their
 * own spelling ('OPEN' is painted from fixed stroke paths; 'kyutai/tts-1.6b-en_fr' is a model id).
 */
const EXEMPT = {
  'title.name': ['english'], // HAIRLINE
  'ch4.signs.open': ['english'],
  'ch7.signs.open': ['english'],
  'ending.credits': ['english', 'decimal'],
};
const exempt = (path, check) => Object.entries(EXEMPT).some(([p, list]) => (path === p || path.startsWith(p + '.')) && list.includes(check));

// Speaker labels that are not characters in NAMES (phone and TV pseudo-speakers, the radio).
const PSEUDO_SPEAKERS = new Set(['TV', 'Téléphone', 'Maman', 'Bastien (club)', 'Dr Okafor (cabinet)', 'Radio']);

// ------------------------------------------------------------------ load

const errors = {};
const warnings = {};
const err = (kind, msg) => (errors[kind] ||= []).push(msg);
const warn = (kind, msg) => (warnings[kind] ||= []).push(msg);

const mods = {};
for (const f of FILES) {
  try {
    mods[f] = await import(new URL(`${f}.js`, DIR).href);
  } catch (e) {
    err('load', `src/story/text/${f}.js: ${String(e.message || e).split('\n')[0]}`);
  }
}
const TREE = { ...(mods.common?.default || {}), ...Object.fromEntries(FILES.slice(1).map((f) => [f, mods[f]?.default])) };
const NAME_SET = new Set(Object.values(mods.common?.NAMES || {}));

const isObj = (v) => v !== null && typeof v === 'object';
const leaves = (tree, path = '', out = []) => {
  if (isObj(tree)) for (const [k, v] of Object.entries(tree)) leaves(v, path ? `${path}.${k}` : k, out);
  else out.push([path, tree]);
  return out;
};
const at = (t, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), t);
const match = (pat, path) => {
  const a = pat.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((s, i) => s === '*' || s === b[i]);
};
const limitFor = (path) => {
  const hits = Object.entries(LIMITS)
    .filter(([p]) => match(p, path))
    .map(([, n]) => n);
  return hits.length ? Math.min(...hits) : null;
};

// ------------------------------------------------------------------ rules

const DATA_KEYS = new Set(['id', 'hand', 'color', 'paint', 'paintColor', 'flare', 'hairlineColor']);
/** Game data, not text: ids, colours, watch numbers and times. */
const isData = (path, v) => {
  const key = path.split('.').pop();
  if (DATA_KEYS.has(key) && !/\s/.test(v)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return true;
  return /^[\d\s.,:  ]+\s*(km|m)?$/.test(v) && v !== ''; // '0,32 km', '38:40', '3:04:51'
};

const NB = '[\\u00a0\\u202f]'; // the no-break spaces French typography uses
const TOKEN_LIKE = /\{[A-Z][A-Za-z0-9]*\}/g; // '{KeyA}', '{Space}'; '{n}' placeholders are lower-case
const KEY_PATHS = /^(title\.controls|hints|pause\.(escKey|muteHint)|ui\.next|ch\d\.keys|ch\d\.prompts|ch4\.sanding\.hint|ch5\.week4\.truing\.hint|ch7\.jobs\.radio\.hint|games\.(.*\.)?hint|ch4\.day8\.(tape|mixer)\.hint)/;
// Literal key names where a token belongs: a lone capital letter (not a word), WASD-style runs, key words.
const LITERAL_KEYS = /(?<![\p{L}'’])([A-Z]|[WASDZQ]{4}|Shift|Maj|Space|Espace|Esc|ESC|Échap|Arrows|Flèches|Enter|Entrée)(?![\p{L}'’])/gu;
// Cheap leftover-English test: words that are never French. Two distinct hits (one in a string of up to
// four words) fail. It catches most English sentences, not single UI words (the typography rules help there).
const ENGLISH = /(?<![\p{L}’'-])(the|and|you|your|you're|you've|with|what|this|that|that's|it's|it|its|don't|doesn't|didn't|can't|isn't|won't|i'm|i've|i'll|i'd|have|has|had|was|were|would|should|could|there|their|they|from|just|about|been|than|then|when|where|which|will|my|of|to|is|are|he|she|we|our|not|no|yes|but|if|how|why|who|his|him|her|in|at|for|last|got|some|nobody|knows|far|still|hold|keep|walk|turn|wins|back|get|let's|every|all|out|up|down|over|into|after|before|never|always|again|here|now|only|also|very|too|much|more|any|two|three|week|day|ran|around|choices|mute|click|years|thinner|hair|along|true|letter|sign|alternate|steady|brush|follows|small|corrections|summary|track|interact|advance|spoke|rhythm|tins|move|said|says|one|needs)(?![\p{L}’'-])/giu;
const englishHits = (s) => new Set((s.replace(/\{[^}]*\}/g, '').match(ENGLISH) || []).map((w) => w.toLowerCase()));

function typography(path, s) {
  const t = s.replace(/\[[^\]]*\]/g, '').replace(/\{[^}]*\}/g, 'X'); // key chips and tokens are exempt
  const bad = [];
  if (/'/.test(s)) bad.push("straight apostrophe (use ’)");
  if (/\.\.\./.test(s)) bad.push('"..." (use …)');
  if (/"/.test(s)) bad.push('straight double quote (use « »)');
  if (/«(?! | )/.test(s)) bad.push('« needs a no-break space after it');
  if (new RegExp(`(?<!${NB})»`).test(s)) bad.push('» needs a no-break space before it');
  // ? ! ; : need a no-break space before them; not inside '?!' / '!!', times (38:40) or after a line start.
  for (const m of t.matchAll(/[?!;:]/g)) {
    const i = m.index;
    const prev = t[i - 1];
    if (i === 0 || prev === '\n') continue;
    if (/[?!]/.test(m[0]) && /[?!]/.test(prev)) continue;
    if (m[0] === ':' && /\d/.test(prev) && /\d/.test(t[i + 1] || '')) continue;
    if (!/[  ]/.test(prev)) {
      bad.push(`no-break space before '${m[0]}'`);
      break;
    }
  }
  if (/ {2}/.test(s)) bad.push('double space');
  // Numbers of four digits or more take a thousands separator (U+202F: « 1 500 », « 12 000 »), except years:
  // French writes years in figures even in dialogue (« en 1974 », 1971, 1979; SCRIPT-R4 §17.3.5), so a
  // four-digit 1900-2099 passes. Times (03:12), decimals (212,4) and ids (D.52) are not numbers here.
  for (const m of t.matchAll(/(?<![\d,.:\u202f\u00a0])\d{4,}(?![\d,:])/g)) {
    const n = m[0];
    if (n.length === 4 && +n >= 1900 && +n <= 2099) continue;
    bad.push(`'${n}' needs a narrow no-break thousands separator (U+202F)`);
    break;
  }
  if (!exempt(path, 'decimal') && /\d\.\d/.test(s)) bad.push('decimal point (use a comma)');
  if (s !== s.trim()) bad.push('leading/trailing space');
  return bad;
}

// ------------------------------------------------------------------ leaves

let checked = 0;
for (const [path, v] of leaves(TREE)) {
  if (typeof v !== 'string') continue;
  if (path.startsWith('names.')) continue;
  if (path.endsWith('.who')) {
    if (!NAME_SET.has(v) && !PSEUDO_SPEAKERS.has(v)) warn('speaker', `${path}: '${v}' is not in NAMES (text/common.js) or the pseudo-speakers`);
    continue;
  }
  if (!v.trim()) {
    err('empty', path);
    continue;
  }
  if (isData(path, v)) continue;
  checked++;
  for (const b of typography(path, v)) err('typography', `${path}: ${b}\n      ${JSON.stringify(v).slice(0, 110)}`);
  const hits = englishHits(v);
  const words = v.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  if (!exempt(path, 'english') && (hits.size >= 2 || (hits.size === 1 && words <= 4))) err('english', `${path}: [${[...hits].join(', ')}] ${JSON.stringify(v).slice(0, 90)}`);
  for (const t of (v.match(TOKEN_LIKE) || []).filter((x) => !x.match(KEY_TOKEN))) err('key-token', `${path}: unknown ${t}`);
  if (KEY_PATHS.test(path)) for (const t of v.replace(TOKEN_LIKE, '').match(LITERAL_KEYS) || []) err('key-literal', `${path}: '${t}' -> use a token ({KeyA}, {Space}...)`);
  const lim = limitFor(path);
  if (lim) {
    const n = keyText(v, TREE.keyNames).length; // as shown (US labels; every layout's letters are one character)
    if (n > lim) err('limit', `${path}: ${n} chars > ${lim} (${JSON.stringify(v)})`);
  }
}
// Ch2's fascia is revealed letter by letter from fasciaStart to fascia.
const fs = at(TREE, 'ch2.signs.fasciaStart');
const ff = at(TREE, 'ch2.signs.fascia');
if (typeof fs === 'string' && typeof ff === 'string' && !ff.startsWith(fs)) err('data', 'ch2.signs.fasciaStart must be a prefix of ch2.signs.fascia');

// ------------------------------------------------------------------ report

const show = (title, groups) => {
  const kinds = Object.keys(groups);
  if (!kinds.length) return;
  console.log(`\n${title}`);
  for (const k of kinds) {
    const list = groups[k];
    console.log(`  ${k} (${list.length})`);
    for (const m of ALL ? list : list.slice(0, 12)) console.log(`    ${m}`);
    if (!ALL && list.length > 12) console.log(`    ... ${list.length - 12} more (--all)`);
  }
};
const total = (g) => Object.values(g).reduce((a, l) => a + l.length, 0);
console.log(`text-check: ${checked} text leaves in src/story/text/{${FILES.join(',')}}.js`);
show('ERRORS', errors);
show('WARNINGS', warnings);
console.log(`\n${total(errors)} errors, ${total(warnings)} warnings`);
process.exit(total(errors) ? 1 : 0);
