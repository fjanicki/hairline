// Translation parity checker: compares src/story/text/<code>/*.js with the English src/story/text/*.js.
// Usage: node scripts/i18n-check.mjs [fr] [--all]   (--all lists every finding, not the first 12 per kind)
// Errors (exit 1): missing / extra keys, array lengths, types, line flags (who / inner / voicemail /
// correct), menu option counts, game data or as-is signage changed, *stage* markers, {placeholders},
// [key chips] lost, {KeyA} key tokens differing from English or unknown, key names written literally
// instead of as tokens, numbers lost, text still marked '⟦EN⟧', text over its UI LIMIT (tokens resolved).
// Warnings: text identical to English (names and brands may legitimately be).
import { FILES, MARK, KEY_TOKEN, keyText, loadLang, leaves, isObj, isData, isName, isAsIs, sameData } from './i18n-lib.mjs';

const argv = process.argv.slice(2);
const code = argv.find((a) => !a.startsWith('--')) || 'fr';
const ALL = argv.includes('--all');

/**
 * Tight UI spots: key path (with * for one segment) -> max characters, measured at 1280x800 from the
 * live CSS boxes with French sample text (.cache/tools/i18n-limits.mjs). The smallest match applies.
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
  'ch5.walk.watchHud.label': 25,
  'ch1.watchHud.lap': 16,
  'ch2.howFarLap': 16,
  'ch1.buzz': 90,
  'ch1.startBuzz': 90,
  'ch2.pauseBuzz': 90,
  'ch2.hold.buzz': 90,
  'ch3.finish.buzz': 90,
  'ch4.sanding.buzz': 90,
  'ch4.week7.buzz': 90,
  'ch3.weeks.*.stride.prompt': 90, // also the watch notification (minus 'STRIDE:')
  // Notebook (246 px, one line, 19 px hand)
  'notebook.items.*': 37,
  'notebook.someSundays': 30, // after its entry, on the same line
  'notebook.heading': 27,
  // HUD lines
  '*.objectives.*': 83, // top-left, clear of the centred hint
  '*.prompts.*': 100, // '[E] ' + prompt, centred, clear of the watch
  'hints.*': 110,
  'ch4.week4.truing.hint': 110, // craft prompt (bottom-centre)
  'ch4.sanding.hint': 100,
  'ui.space': 43,
  'ch2.hold.gauge': 41, // gauge caption (360 px, wide caps)
  'ch3.gauge.label': 41,
  'ch4.sanding.gauge': 41,
  'ch4.week4.truing.gauge': 41,
  'ch4.week4.truing.pitch.*': 41, // gauge readout
  'ch5.line.gauge': 41,
  'ch5.jobs.shutter.gauge': 41,
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
  'options.language': 17,
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
  'ch5.jobs.radio.hint': 100, // craft prompt (bottom-centre)
  'ch4.day8.mixer.tins.*': 12, // colour-toy chip: tin names under the dots
  'ch4.day8.mixer.tip': 16, // chip buttons (with their key chip)
  'ch4.day8.mixer.done': 16,
  'ch4.week7.signMenu.prompt': 193,
  'ch5.teach.menu.prompt': 193,
  'ch5.panel.menu.prompt': 193,
  'ch5.walk.restMenu.prompt': 193,
};

const match = (pat, path) => {
  const a = pat.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((s, i) => s === '*' || s === b[i]);
};
const limitFor = (path) => {
  const hits = Object.entries(LIMITS).filter(([p]) => match(p, path)).map(([, n]) => n);
  return hits.length ? Math.min(...hits) : null;
};

// ------------------------------------------------------------------ load

const [enFiles, trFiles] = await Promise.all([loadLang('en'), loadLang(code)]);
const errors = {};
const warnings = {};
const err = (kind, msg) => (errors[kind] ||= []).push(msg);
const warn = (kind, msg) => (warnings[kind] ||= []).push(msg);
for (const f of FILES) if (trFiles[`${f}:error`]) err('load', `text/${code}/${f}.js: ${trFiles[`${f}:error`]}`);
const tree = (files) => ({ ...(files.common || {}), ...Object.fromEntries(FILES.slice(1).map((f) => [f, files[f]])) });
const EN = tree(enFiles);
const TR = tree(trFiles);

// ------------------------------------------------------------------ structure

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isLine = (o) => isObj(o) && !Array.isArray(o) && 'text' in o && ('who' in o || 'inner' in o);

function compare(en, tr, path) {
  if (tr === undefined) return err('missing-key', path);
  const te = typeOf(en);
  const tt = typeOf(tr);
  if (te !== tt && !(te === 'null' && tt === 'string') && !(te === 'string' && tt === 'null')) return err('type', `${path}: ${te} -> ${tt}`);
  if (te === 'array') {
    if (en.length !== tr.length) err(path.endsWith('options') ? 'options' : 'length', `${path}: ${en.length} -> ${tr.length}`);
    en.forEach((v, i) => compare(v, tr[i], `${path}.${i}`));
    return;
  }
  if (te === 'object') {
    const FLAGS = ['inner', 'voicemail', 'correct']; // optional booleans: compared as flags below
    for (const k of Object.keys(en)) if (!(FLAGS.includes(k) && typeof en[k] === 'boolean')) compare(en[k], tr[k], path ? `${path}.${k}` : k);
    for (const k of Object.keys(tr)) if (!(k in en) && !(FLAGS.includes(k) && typeof tr[k] === 'boolean')) err('extra-key', path ? `${path}.${k}` : k);
    if (isLine(en)) {
      for (const f of ['inner', 'voicemail', 'correct']) if (!!en[f] !== !!tr[f]) err('flag', `${path}.${f}: ${!!en[f]} -> ${!!tr[f]}`);
      if ((en.who == null) !== (tr.who == null)) err('flag', `${path}.who: ${en.who} -> ${tr.who}`);
    }
    if ('correct' in en && !isLine(en) && !!en.correct !== !!tr.correct) err('flag', `${path}.correct: ${!!en.correct} -> ${!!tr.correct}`);
  }
}
compare(EN, TR, '');

// ------------------------------------------------------------------ leaves

const at = (t, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), t);
const STAGE = /\*[^*]+\*/g;
const BRACES = /\{[^}]*\}/g;
const CHIPS = /\[[^\]]+\]/g;
const TOKEN_LIKE = /\{[A-Z][A-Za-z0-9]*\}/g; // '{KeyA}', '{Space}'; '{n}' placeholders are lower-case
const KEY_PATHS = /^(title\.controls|hints|pause\.(escKey|muteHint)|ui\.next|ch\d\.keys|ch\d\.prompts|ch4\.(week4\.truing|sanding)\.hint|ch5\.jobs\.radio\.hint|ch4\.day8\.(tape|mixer)\.hint)/;
// Literal key names where a token belongs: a lone capital letter (not a word), WASD-style runs, key words.
const LITERAL_KEYS = /(?<![\p{L}'’])([A-Z]|[WASDZQ]{4}|Shift|Maj|Space|Espace|Esc|ESC|Échap|Arrows|Flèches|Enter|Entrée)(?![\p{L}'’])/gu;
const NUM = /\d+(?:[.,:]\d+)*/g;
const normNum = (s) => s.replace(/,/g, '.');
// Caption times: '5:12 AM' -> '5 H 12' (docs/i18n-fr.md 4.3).
const normTimes = (s) => s.replace(/(\d+)[\s\u00a0\u202f]H[\s\u00a0\u202f](\d{2})\b/g, '$1:$2');
const tokens = (s) => (s.match(TOKEN_LIKE) || []).sort().join(' ');
const literalKeys = (s) => s.replace(TOKEN_LIKE, '').match(LITERAL_KEYS) || [];
const lost = (re, a, b, norm = (x) => x) => {
  const want = (a.match(re) || []).map(norm);
  const have = (b.match(re) || []).map(norm);
  return want.filter((t) => {
    const i = have.indexOf(t);
    if (i < 0) return true;
    have.splice(i, 1);
    return false;
  });
};
const ratios = [];
let translated = 0;
let untranslated = 0;
for (const [path, en] of leaves(EN)) {
  const tr = at(TR, path);
  if (typeof en !== 'string' || typeof tr !== 'string') continue;
  if (isData(path, en) || isAsIs(path)) {
    if (isAsIs(path) ? tr !== en : !sameData(en, tr)) err(isAsIs(path) ? 'as-is' : 'data', `${path}: ${JSON.stringify(en)} -> ${JSON.stringify(tr)}`);
    continue;
  }
  if (isName(path, en)) {
    if (tr !== en) err('name', `${path}: ${en} -> ${tr} (speaker names are shared: ../common.js NAMES)`);
    continue;
  }
  if (tr.includes(MARK.trim())) {
    untranslated++;
    err('untranslated', `${path}: ${tr.slice(0, 70)}`);
    continue;
  }
  translated++;
  if (tr === en && /\p{L}/u.test(tr.replace(TOKEN_LIKE, ''))) warn('identical', `${path}: ${en.slice(0, 70)}`);
  const stages = [en, tr].map((x) => (x.match(STAGE) || []).length);
  if (stages[0] !== stages[1]) err('stage', `${path}: *...* markers ${stages[0]} -> ${stages[1]}`);
  for (const t of lost(BRACES, en, tr)) err('placeholder', `${path}: lost ${t}`);
  for (const t of lost(CHIPS, en, tr)) err('placeholder', `${path}: lost ${t}`);
  if (tokens(en) !== tokens(tr)) err('key-token', `${path}: ${tokens(en) || '-'} -> ${tokens(tr) || '-'}`);
  for (const t of (tr.match(TOKEN_LIKE) || []).filter((t) => !t.match(KEY_TOKEN))) err('key-token', `${path}: unknown ${t}`);
  if (KEY_PATHS.test(path)) for (const [lng, s] of [['en', en], [code, tr]]) for (const t of literalKeys(s)) err('key-literal', `${path} (${lng}): '${t}' -> use a token ({KeyA}, {Space}...)`);
  for (const t of lost(NUM, en, normTimes(tr), normNum)) err('number', `${path}: lost ${t}`);
  const lim = limitFor(path);
  if (lim) {
    const trLen = keyText(tr, TR.keyNames).length; // as shown (US labels; every layout's letters are one character)
    const r = trLen / Math.max(1, keyText(en, EN.keyNames).length);
    ratios.push({ path, en: keyText(en, EN.keyNames).length, tr: trLen, limit: lim, ratio: +r.toFixed(2), over: trLen > lim });
    if (trLen > lim) err('limit', `${path}: ${trLen} chars > ${lim} (${JSON.stringify(tr)})`);
  }
}
// Ch2's fascia is revealed letter by letter from fasciaStart to fascia.
const fs = at(TR, 'ch2.signs.fasciaStart');
const ff = at(TR, 'ch2.signs.fascia');
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
console.log(`i18n-check ${code}: ${translated} translated, ${untranslated} untranslated (${MARK.trim()}) text leaves`);
show('ERRORS', errors);
show('WARNINGS', warnings);
if (ratios.length) {
  console.log('\nLENGTH vs LIMIT (translated tight-UI text)');
  console.log('  ' + 'path'.padEnd(36) + 'en'.padStart(5) + code.padStart(5) + 'limit'.padStart(7) + 'ratio'.padStart(7));
  for (const r of ratios.sort((a, b) => b.tr / b.limit - a.tr / a.limit)) {
    console.log(`  ${r.path.padEnd(36)}${String(r.en).padStart(5)}${String(r.tr).padStart(5)}${String(r.limit).padStart(7)}${r.ratio.toFixed(2).padStart(7)}${r.over ? '  OVER' : ''}`);
  }
  const avg = ratios.reduce((a, r) => a + r.ratio, 0) / ratios.length;
  console.log(`  mean ${code}/en length ratio ${avg.toFixed(2)} over ${ratios.length} strings`);
}
console.log(`\n${total(errors)} errors, ${total(warnings)} warnings`);
process.exit(total(errors) ? 1 : 0);
