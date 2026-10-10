#!/usr/bin/env node
// HAIRLINE voice inventory: which French lines get a voice clip, who says them, how, and what to feed the TTS.
//
//   node scripts/voice/extract-lines.mjs            -> writes scripts/voice/lines.fr.json, prints a summary
//   node scripts/voice/extract-lines.mjs --check    -> no write; exit 1 on any unclassified leaf, table error or missing clip
//   node scripts/voice/extract-lines.mjs --list     -> also print every voiced line (key, speaker, delivery, tts)
//   node scripts/voice/extract-lines.mjs --out FILE -> write elsewhere
//   node scripts/voice/extract-lines.mjs --selftest -> check voiceKey vectors and the French TTS normalizer
//
// Reads the text modules exactly as the game assembles them (src/story/script.js): src/story/text/*.js,
// the French text as shown (the game is French only). Another agent may be mid-edit, so imports are
// retried on syntax errors. --check also checks that every voiced line has a clip in the manifest
// (public/assets/voice/fr/manifest.json, per-speaker variant included) and that its file exists.
//
// Classification is an explicit table (RULES below): key-path pattern -> how the game uses that node
// (d.say / d.think / ui.thought bark / d.correct / d.choose / card / UI) -> voiced or not, delivery, speaker.
// Every leaf must be claimed by exactly one rule; anything unclaimed is printed as an ERROR, so new text is
// never skipped silently. Rules that match nothing are reported as stale.
//
// Usage is documented per rule with the call site it was read from (src/story/ch*.js, crafts/*.js, Player.js).
// See docs/voice.md for the rules, the key function and the manifest format.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { normalize, voiceKey, VOICE_KEY_VERSION } from './voiceKey.mjs';
// The rule table and the voice-direction context, one file per chapter (scripts/voice/rules/*.mjs) so the
// chapter builders can add rules in parallel. Order matters (first match wins): common, then ch1..ch7.
import * as common from './rules/common.mjs';
import * as ch1 from './rules/ch1.mjs';
import * as ch2 from './rules/ch2.mjs';
import * as ch3 from './rules/ch3.mjs';
import * as ch4 from './rules/ch4.mjs';
import * as ch5 from './rules/ch5.mjs';
import * as ch6 from './rules/ch6.mjs';
import * as ch7 from './rules/ch7.mjs';
const R = { common, ch1, ch2, ch3, ch4, ch5, ch6, ch7 };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TEXT = process.env.HAIRLINE_TEXT_DIR ? path.resolve(process.env.HAIRLINE_TEXT_DIR) : path.join(ROOT, 'src/story/text'); // override for tests
// Text modules, in script.js order. caseFile.js is not read: it is written in the notebook, never voiced.
const FILES = ['common', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'items', 'games'];
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const LIST = argv.includes('--list');
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(HERE, 'lines.fr.json');

// ============================================================================================ speakers
// id -> displayed French "who" label (manifest variant key), and the casting brief (docs/DESIGN.md "Cast").
export const SPEAKERS = {
  hugo: {
    who: 'Hugo', name: 'Hugo Revel', age: 37, gender: 'male',
    voice: 'Low-mid baritone, tired, dry, laconic. Former pro cyclist (domestique), now in a walking boot with a stress fracture. Understated; humour so dry it barely registers. Never theatrical.',
    inner: 'Inner monologue: same voice, softer, closer, quieter, almost under the breath; a thought, not a performance.',
  },
  odile: {
    who: 'Odile', name: 'Odile Marchal', age: 74, gender: 'female',
    voice: 'Old woman, gravelly and a little thin, terse, brusque, practical; cannot stand sentiment. Warm underneath, never says so. Retired sign painter from the north of France; short sentences, orders rather than requests.',
  },
  sami: {
    who: 'Sami', name: 'Sami Haddad', age: 11, gender: 'male',
    voice: 'A real 11-year-old boy: cheeky, quick, literal, loud when excited. If the model has no child voice, use the youngest high voice with a formant-preserving pitch shift (no chipmunk).',
  },
  bastien: {
    who: 'Bastien', name: 'Bastien', age: '40s', gender: 'male',
    voice: 'Hearty, loud, run-club captain enthusiasm; slightly breathless (always jogging on the spot); friendly, oblivious.',
  },
  lou: {
    who: 'Lou', name: 'Lou', age: 16, gender: 'female',
    voice: 'Teenage girl, deadpan, flat, low energy, dry; used to tag the wall.',
  },
  gerard: {
    who: 'Gérard', name: 'Gérard', age: '40s-50s', gender: 'male',
    voice: 'Kebab-shop owner (CHEZ GÉRARD): warm, proud, a little theatrical; savours his own lines.',
  },
  benali: {
    who: 'Mme Benali', name: 'Mme Benali', age: '50s-60s', gender: 'female',
    voice: 'Baker: warm, chatty, amused at herself.',
  },
  okafor: {
    who: 'Dr Okafor', name: 'Dr Okafor', age: 'adult', gender: 'male',
    voice: 'The sports doctor (male: "He called it the dreaded black line", Ch1). Calm, clinical, precise, quietly kind. Heard only as a memory (Ch3 flashback over black).',
  },
  receptionist: {
    who: 'Dr Okafor (cabinet)', name: 'Dr Okafor\'s receptionist', age: 'adult', gender: 'female',
    voice: 'Medical office receptionist leaving a voicemail: polite, professional, reading a reminder aloud; a hint of awkwardness when quoting the doctor verbatim.',
  },
  tv: {
    who: 'TV', name: 'TV commentator', age: 'adult', gender: 'male',
    voice: 'Cycling broadcast commentator (Tour-style): male, broadcast voice, measured warmth, a little lyrical about the domestiques.',
  },
  radio_fishing: {
    who: 'Radio', name: 'Radio: the fishing man', age: '60s', gender: 'male',
    voice: 'Older man on a talk station about fishing: slow, rambling, earnest, slightly pompous. Odile has "had him since the franc".',
  },
  radio_football: {
    who: 'Radio', name: 'Radio: football commentator', age: '30s-40s', gender: 'male',
    voice: 'Football radio commentator: fast, excited, a little hoarse; clearly different from the TV cycling voice.',
  },
  radio_forecast: {
    who: 'Radio', name: 'Radio: marine forecast', age: 'adult', gender: 'female',
    voice: 'Marine/weather forecast reader: neutral, even, unhurried, slightly formal.',
  },
  jo: {
    who: 'Jo', name: 'Josianne « Jo » Lavoie', age: 34, gender: 'female',
    voice: 'Québécoise tattoo artist (ENCRE FINE), 34: confident, quick, warm, says exactly what she thinks; amused rather than flirty-breathy. Light Québec colour in the words, never a caricature (SCRIPT-R4 §11).',
  },
  durand: {
    who: 'M. Durand', name: 'Albert Durand', age: 81, gender: 'male',
    voice: 'Retired bike-shop owner, 81: slow, precise, courteous, old-fashioned French (keeps every « ne »); a low, worn voice, dry humour, never sentimental. Also « Le vieux monsieur » in Ch5 (same voice).',
  },
  maman: {
    who: 'Maman', name: 'Maman (Hugo\'s mother)', age: '60s', gender: 'female',
    voice: 'Warm, worried. Currently has NO spoken line (her only line is an SMS in Ch1), so nothing is generated for her.',
  },
};

// Displayed who labels -> speaker id.
const WHO = {
  Hugo: 'hugo', Odile: 'odile', Sami: 'sami', Bastien: 'bastien', Lou: 'lou', 'Gérard': 'gerard',
  'Mme Benali': 'benali', 'Dr Okafor': 'okafor', 'Dr Okafor (cabinet)': 'receptionist', TV: 'tv', Maman: 'maman',
  Jo: 'jo', 'Le vieux monsieur': 'durand', 'M. Durand': 'durand',
};

// ============================================================================================ deliveries
// Processing is baked into the clips by the generator (see docs/voice.md).
export const DELIVERIES = {
  spoken: { lufs: -19, desc: 'Dry, close, natural; very light room tone.' },
  inner: { lufs: -23, desc: "Hugo's thoughts: softer and more intimate, slightly closer and quieter, a touch of low-pass / short room so it reads as thought." },
  bark: { lufs: -19, desc: 'Spoken, non-blocking line while the player plays; can be a bit more projected (calls across a room/street).' },
  voicemail: { lufs: -21, desc: 'Telephone band-pass 300-3400 Hz, light compression, a little codec grit.' },
  tv: { lufs: -19, desc: 'Broadcast EQ, slight compression (heard from the TV across the flat).' },
  flashback: { lufs: -19, desc: 'Memory: slightly distant and roomy (Ch3 doctor over black).' },
  radio: { lufs: -21, desc: 'Added for the Ch5 radio job: old valve radio speaker, band-pass ~300-3400 Hz like the game\'s radioVoice, mild compression and hiss. Treat as a narrower "tv".' },
};
const TRUE_PEAK = -1.5;

// ============================================================================================ the table
// Pattern syntax: dot path on the text tree; '*' = one segment, '**' = any depth (incl. none).
// The first rule matching a node (top-down) claims the whole subtree.
//
// kinds:
//   none   {why}                 not voiced (why: ui, hint, objective, prompt, sign, caption, card, watch,
//                                 notebook, endcard, data, title)
//   say    {delivery?, unvoicedWho?}  d.say(lines): [{who, text, inner?, voicemail?}] (or one line object).
//                                 inner -> Hugo/inner; voicemail -> voicemail; stage (*...*, who null) -> not voiced;
//                                 unvoicedWho: who label -> reason (phone texts and notifications).
//   think  {}                    Hugo's thought: plain string(s) to d.thought / d.think / ui.thought without who
//                                 (or d.card for the crack) -> Hugo/inner.
//   bark   {speakers?, delivery?} ui.thought(text, secs, {who}) barks: {who, <key>: string|string[]},
//                                 {who, text}, or arrays of them. speakers: key -> speaker id override.
//   menu   {}                    d.correct(menu): prompt/option labels not voiced; replies spoken by option.who ??
//                                 menu.who (Director default: Odile).
//   choose {}                    d.choose(menu): STRIDE notification / choice prompt and option labels not voiced;
//                                 replies are Hugo's thoughts (d.think) -> inner. With menu.who (Revision 4,
//                                 Director.choose plays the replies): spoken by option.who ?? menu.who; a reply
//                                 is a string, a string[] or line objects.
//   descend {}                   claims nothing: the walk goes on into the children (to carve an exception out of a
//                                 later wildcard rule, e.g. items.refuse.watch before items.refuse.*).
//   bag    {}                    a list of entries for d.say, each a string (Hugo's inner thought), a line object
//                                 or an array of them (story/items.js refusal / gift / needs lines).
const RULES = [...R.common.RULES, ...R.ch1.RULES, ...R.ch2.RULES, ...R.ch3.RULES, ...R.ch4.RULES, ...R.ch5.RULES, ...R.ch6.RULES, ...R.ch7.RULES];

// ============================================================================================ context
// Longest-prefix match on the key path. to / mood can be per speaker ({hugo: ..., odile: ...}).
// English on purpose: it is direction for the voice model / the person choosing takes, not game text.
const CONTEXT = [...R.common.CONTEXT, ...R.ch1.CONTEXT, ...R.ch2.CONTEXT, ...R.ch3.CONTEXT, ...R.ch4.CONTEXT, ...R.ch5.CONTEXT, ...R.ch6.CONTEXT, ...R.ch7.CONTEXT];

// ============================================================================================ French TTS text
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const T10 = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
function fr99(n) {
  if (n < 20) return U[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7) return 'soixante' + (u === 1 ? ' et onze' : '-' + U[10 + u]);
  if (t === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + U[u];
  if (t === 9) return 'quatre-vingt-' + U[10 + u];
  return T10[t] + (u === 0 ? '' : u === 1 ? ' et un' : '-' + U[u]);
}
function fr999(n) {
  const h = Math.floor(n / 100), r = n % 100;
  let s = h === 0 ? '' : h === 1 ? 'cent' : U[h] + (r === 0 ? ' cents' : ' cent');
  if (r) s += (s ? ' ' : '') + fr99(r);
  return s || 'zéro';
}
/** French cardinal words (traditional spelling). fem: 'une' for a final 'un' (une heure, vingt et une secondes). */
export function frInt(n, { fem = false } = {}) {
  n = Math.floor(Math.abs(n));
  let s;
  if (n < 1000) s = fr999(n);
  else if (n < 1e6) {
    const th = Math.floor(n / 1000), r = n % 1000;
    s = (th === 1 ? 'mille' : fr999(th).replace(/(cent|vingt)s$/, '$1') + ' mille') + (r ? ' ' + fr999(r) : '');
  } else {
    const m = Math.floor(n / 1e6), r = n % 1e6;
    s = frInt(m) + (m > 1 ? ' millions' : ' million') + (r ? ' ' + frInt(r) : '');
  }
  return fem ? s.replace(/\bun$/, 'une') : s;
}
/** '212,4' / '212.4' -> 'deux cent douze virgule quatre'; '0,05' -> 'zéro virgule zéro cinq'. */
export function frNum(str, opts) {
  const [i, d] = String(str).replace('.', ',').split(',');
  let s = frInt(parseInt(i, 10), d ? {} : opts);
  if (d) {
    const lead = d.match(/^0*/)[0].length;
    const rest = d.slice(lead);
    s += ' virgule ' + [...Array(lead)].map(() => 'zéro').concat(rest ? [frInt(parseInt(rest, 10), opts)] : []).join(' ');
  }
  return s;
}
function frOrdinal(n, suf) {
  if (n === 1) return /r?e$/.test(suf) && suf !== 'er' ? 'première' : 'premier';
  let w = frInt(n);
  w = w.replace(/cinq$/, 'cinqu').replace(/neuf$/, 'neuv').replace(/e$/, '').replace(/s$/, '');
  return w + 'ième';
}
const plural = (v, one, many) => (parseFloat(String(v).replace(',', '.')) >= 2 ? many : one);
const UNITS = {
  km: ['kilomètre', 'kilomètres'], m: ['mètre', 'mètres'], cm: ['centimètre', 'centimètres'], mm: ['millimètre', 'millimètres'],
  kg: ['kilo', 'kilos'], g: ['gramme', 'grammes'], '%': ['pour cent', 'pour cent'], '€': ['euro', 'euros'],
  min: ['minute', 'minutes'], s: ['seconde', 'secondes'], h: ['heure', 'heures'], spm: ['pas par minute', 'pas par minute'], ppm: ['pas par minute', 'pas par minute'],
};
const FEM_UNITS = new Set(['min', 's', 'h']);
// Whole-word replacements (case-sensitive): brands, English words, names the model may misread.
// The table lives in scripts/voice/pronunciation.json ("words"), next to the per-line TTS overrides.
export const PRONUNCIATION = JSON.parse(fs.readFileSync(path.join(HERE, 'pronunciation.json'), 'utf8'));
const WORDS = PRONUNCIATION.words.map((w) => [new RegExp(w.re, w.flags ?? 'g'), w.tts]);
const KEEP_CAPS = new Set(['H', 'R', 'O', 'P', 'E', 'N', 'TV']);

/** French text for speech: numbers, units, times and abbreviations in words; markup and guillemets out; … and — kept. */
export function frTTS(text) {
  let s = String(text);
  s = s.replace(/<[^>]*>/g, ' ').replace(/\*/g, '');
  s = s.replace(/[’‘ʼ]/g, '’');
  s = s.replace(/\.\.\./g, '…');
  s = s.replace(/«[\s\u00A0\u202F]*/g, '').replace(/[\s\u00A0\u202F]*»/g, '');
  s = s.replace(/[“”„]/g, '');
  s = s.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  // Abbreviations.
  s = s.replace(/\bMmes\b\.?/g, 'Mesdames').replace(/\bMme\b\.?/g, 'Madame').replace(/\bMlle\b\.?/g, 'Mademoiselle');
  s = s.replace(/\bMM\.\s/g, 'Messieurs ').replace(/\bM\.\s(?=[A-ZÀ-Ý])/g, 'Monsieur ');
  s = s.replace(/\bDr\b\.?/g, 'Docteur').replace(/\bPr\b\.?(?=\s[A-Z])/g, 'Professeur');
  s = s.replace(/\betc\./g, 'et cetera');
  s = s.replace(/\b[Nn]°\s*(\d+)/g, (_, n) => 'numéro ' + frInt(+n));
  for (const [re, to] of WORDS) s = s.replace(re, to);
  // Clock and durations: 3:04:51, 38:40, 5 h 12, 3 h 12 min, 1 h.
  s = s.replace(/\b(\d{1,2}):(\d{2}):(\d{2})\b/g, (_, h, m, x) => `${frInt(+h, { fem: true })} ${plural(h, 'heure', 'heures')} ${frInt(+m, { fem: true })} ${plural(m, 'minute', 'minutes')} ${frInt(+x, { fem: true })} ${plural(x, 'seconde', 'secondes')}`);
  s = s.replace(/\b(\d{1,3}):(\d{2})\b/g, (_, m, x) => `${frInt(+m, { fem: true })} ${plural(m, 'minute', 'minutes')} ${+x ? frInt(+x, { fem: true }) : ''}`.trim());
  s = s.replace(/\b(\d{1,2})\s?[hH]\s?(\d{2})(?:\s?min\b)?/g, (all, h, m) => `${frInt(+h, { fem: true })} ${plural(h, 'heure', 'heures')} ${frInt(+m, { fem: true })}${/min$/.test(all) ? ' ' + plural(m, 'minute', 'minutes') : ''}`);
  // Number + unit.
  s = s.replace(/(\d+(?:[.,]\d+)?)\s?(km|cm|mm|kg|min|spm|ppm|%|€|m|g|s|h)(?![\wÀ-ÿ])/g, (_, v, u) => `${frNum(v, { fem: FEM_UNITS.has(u) })} ${plural(v, ...UNITS[u])}`);
  // Ordinals, then plain numbers (thin/no-break thousands separators first).
  s = s.replace(/(\d)[\u00A0\u202F ](?=\d{3}\b)/g, '$1');
  s = s.replace(/\b(\d+)(er|re|ère|e|ème)\b/g, (_, n, suf) => frOrdinal(+n, suf));
  s = s.replace(/\d+(?:,\d+)?/g, (v) => frNum(v));
  // ALL-CAPS words read as words, not spelled (HUGO -> Hugo), except deliberate initials.
  s = s.replace(/\b[A-ZÀ-Ý]{2,}\b/g, (w) => (KEEP_CAPS.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
  s = s.replace(/[\s\u00A0\u202F]+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  return s;
}

// ============================================================================================ loading
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * The text tree, as JSON from a fresh Node process: a module that failed to parse stays failed in this
 * process's ESM cache (including './common.js' imported by the chapter files), so every retry gets a
 * clean process. The tree is plain data (strings, numbers, booleans, null).
 */
async function loadTree(tries = 6) {
  const files = FILES.map((f) => pathToFileURL(path.join(TEXT, f + '.js')).href);
  const js = `const out = {}; const files = ${JSON.stringify(files)}; const names = ${JSON.stringify(FILES)};
for (let i = 0; i < files.length; i++) { const m = await import(files[i]); const t = m.default ?? m.common;
  if (names[i] === 'common') Object.assign(out, t); else out[names[i]] = t; }
process.stdout.write(JSON.stringify(out));`;
  let last = '';
  for (let a = 0; a < tries; a++) {
    try {
      return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', js], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }));
    } catch (err) {
      last = String(err.stderr || err.message || err).split('\n').filter((l) => /Error|error/.test(l))[0] || String(err.message).split('\n')[0];
      if (a < tries - 1) {
        console.warn(`[voice] loading the text failed (${last.trim()}); retry ${a + 1}/${tries - 1} (another workflow may be mid-edit)`);
        await sleep(1500 * (a + 1));
      }
    }
  }
  throw new Error(`[voice] could not load the text after ${tries} tries: ${last}`);
}

// ============================================================================================ walk
const isObj = (v) => v !== null && typeof v === 'object';
const isStage = (s) => typeof s === 'string' && /^\s*\*[^*]+\*\s*$/.test(s);
const leafPaths = (v, p, out = []) => {
  if (isObj(v)) for (const [k, x] of Object.entries(v)) leafPaths(x, `${p}.${k}`, out);
  else out.push(p);
  return out;
};
function globToRe(g) {
  const parts = g.split('.');
  let re = '';
  parts.forEach((seg, i) => {
    const dot = i === 0 ? '' : '\\.';
    if (seg === '**') re += i === 0 ? '.*' : '(?:\\..+)?';
    else re += dot + (seg === '*' ? '[^.]+' : seg.replace(/[$()+?[\]\\^{|}]/g, '\\$&'));
  });
  return new RegExp('^' + re + '$');
}
const RULES_RE = RULES.map(([g, spec], i) => ({ g, spec, re: globToRe(g), i, hits: 0 }));
const ruleFor = (p) => RULES_RE.find((r) => r.re.test(p));

function contextFor(p, speaker, delivery) {
  let best = null;
  for (const [pre, c] of CONTEXT) if ((p === pre || p.startsWith(pre + '.')) && (!best || pre.length > best[0].length)) best = [pre, c];
  const c = best?.[1] || {};
  const pick = (v) => (isObj(v) ? v[speaker] ?? Object.values(v)[0] : v);
  const name = SPEAKERS[speaker]?.name || speaker;
  const to = pick(c.to) || 'unknown';
  const bits = [`${name} -> ${to}.`, c.scene ? `${c.scene}.` : '', pick(c.mood) ? `Emotion: ${pick(c.mood)}.` : ''];
  if (delivery === 'inner') bits.push('Inner monologue (not said aloud).');
  return { text: bits.filter(Boolean).join(' '), scene: c.scene || null, to, mood: pick(c.mood) || null, from: best?.[0] || null };
}

function main(tree) {
  const errors = [];
  const warnings = [];
  const raw = []; // voiced line occurrences
  const unvoiced = []; // [path, reason, text]
  const hugoWho = tree.names?.hugo || 'Hugo';

  const voiced = (o) => {
    if (o.text == null) return;
    if (typeof o.text !== 'string' || !o.text.trim()) return errors.push(`${o.path}: empty voiced text`);
    raw.push(o);
  };
  const skipLeaves = (p, node, why) => {
    if (!isObj(node)) return unvoiced.push([p, why, typeof node === 'string' ? node : null]);
    for (const [k, v] of Object.entries(node)) skipLeaves(`${p}.${k}`, v, why);
  };

  // A dialogue line object {who, text, inner?, voicemail?} (d.say) or a bark object {who, text}.
  const lineObj = (p, l, spec, mode) => {
    const known = new Set(['who', 'text', 'inner', 'voicemail']);
    for (const k of Object.keys(l)) if (!known.has(k)) errors.push(`${p}.${k}: unexpected key in a line object (rule '${spec._g}')`);
    if (l.who == null) {
      if (isStage(l.text)) return skipLeaves(p, l, 'stage');
      return errors.push(`${p}: line with no speaker that is not a *stage* direction`);
    }
    if (spec.unvoicedWho?.[l.who]) return skipLeaves(p, l, spec.unvoicedWho[l.who]);
    if (isStage(l.text)) return skipLeaves(p, l, 'stage');
    let speaker, delivery;
    if (l.inner) {
      speaker = 'hugo';
      delivery = 'inner';
    } else {
      speaker = WHO[l.who];
      if (!speaker) return errors.push(`${p}: unknown speaker '${l.who}' (add it to WHO/SPEAKERS)`);
      delivery = l.voicemail ? 'voicemail' : spec.delivery || (mode === 'bark' ? 'bark' : 'spoken');
    }
    voiced({ path: p, text: l.text, speaker, who: l.inner ? hugoWho : l.who, delivery, use: spec.use, flags: spec.flags });
    for (const k of ['who', 'inner', 'voicemail']) if (k in l) unvoiced.push([`${p}.${k}`, 'line meta', null]);
  };

  const handlers = {
    none(p, n, spec) {
      skipLeaves(p, n, spec.why);
    },
    say(p, n, spec) {
      const arr = Array.isArray(n) ? n : [n];
      arr.forEach((l, i) => {
        const lp = Array.isArray(n) ? `${p}.${i}` : p;
        if (isObj(l)) lineObj(lp, l, spec, 'say');
        else if (l == null) unvoiced.push([lp, 'data', null]);
        else errors.push(`${lp}: plain string in a d.say array (who would say it?)`);
      });
    },
    think(p, n, spec) {
      const one = (lp, t) => {
        if (t == null) return unvoiced.push([lp, 'data', null]);
        if (typeof t !== 'string') return errors.push(`${lp}: expected a thought string`);
        if (isStage(t)) return unvoiced.push([lp, 'stage', t]);
        voiced({ path: lp, text: t, speaker: 'hugo', who: hugoWho, delivery: 'inner', use: spec.use, flags: spec.flags });
      };
      if (Array.isArray(n)) n.forEach((t, i) => one(`${p}.${i}`, t));
      else if (isObj(n)) {
        if ('text' in n) return lineObj(p, { ...n, inner: true }, spec, 'say');
        for (const [k, t] of Object.entries(n)) one(`${p}.${k}`, t);
      } else one(p, n);
    },
    bark(p, n, spec) {
      const walkBark = (lp, t, who, key) => {
        if (t == null) return unvoiced.push([lp, 'data', null]);
        if (Array.isArray(t)) return t.forEach((x, i) => walkBark(`${lp}.${i}`, x, who, key));
        if (isObj(t) && 'text' in t) return lineObj(lp, t, spec, 'bark');
        if (isObj(t)) {
          const w = t.who ?? who;
          if ('who' in t) unvoiced.push([`${lp}.who`, 'line meta', null]);
          for (const [k, x] of Object.entries(t)) if (k !== 'who') walkBark(`${lp}.${k}`, x, w, k);
          return;
        }
        if (typeof t !== 'string') return errors.push(`${lp}: unexpected bark value`);
        if (isStage(t)) return unvoiced.push([lp, 'stage', t]);
        const speaker = spec.speakers?.[key] || spec.speaker || WHO[who];
        if (!speaker) return errors.push(`${lp}: bark with no resolvable speaker (who='${who}')`);
        const flags = [...(spec.flags || [])];
        if (spec.notes?.[key]) flags.push('note: ' + spec.notes[key]);
        voiced({ path: lp, text: t, speaker, who: SPEAKERS[speaker].who === 'Radio' ? (who ?? 'Radio') : who ?? SPEAKERS[speaker].who, delivery: spec.delivery || 'bark', use: spec.use, flags });
      };
      walkBark(p, n, null, p.split('.').pop());
    },
    menu(p, n, spec) {
      const who = n.who ?? tree.names?.odile ?? 'Odile';
      const speaker = WHO[who] || 'odile';
      for (const k of Object.keys(n)) if (!['who', 'prompt', 'options'].includes(k)) errors.push(`${p}.${k}: unexpected key in a correction menu`);
      if ('who' in n) unvoiced.push([`${p}.who`, 'line meta', null]);
      unvoiced.push([`${p}.prompt`, 'menu prompt', n.prompt ?? null]);
      n.options.forEach((o, i) => {
        const op = `${p}.options.${i}`;
        for (const k of Object.keys(o)) if (!['text', 'correct', 'reply', 'who'].includes(k)) errors.push(`${op}.${k}: unexpected key in a menu option`);
        unvoiced.push([`${op}.text`, 'menu label', o.text ?? null]);
        unvoiced.push([`${op}.correct`, 'data', null]);
        if ('who' in o) unvoiced.push([`${op}.who`, 'line meta', null]);
        if (o.reply == null) return unvoiced.push([`${op}.reply`, 'data', null]);
        const ow = o.who ?? who; // Director.correct: option.who ?? menu.who
        const os = o.who ? WHO[o.who] : speaker;
        if (!os) return errors.push(`${op}.who: unknown speaker '${o.who}' (add it to WHO/SPEAKERS)`);
        voiced({ path: `${op}.reply`, text: o.reply, speaker: os, who: ow, delivery: 'spoken', use: spec.use + ' -> reply', flags: [...(spec.flags || []), o.correct ? 'menu-correct' : 'menu-wrong'] });
      });
    },
    choose(p, n, spec) {
      for (const k of Object.keys(n)) if (!['who', 'prompt', 'options'].includes(k)) errors.push(`${p}.${k}: unexpected key in a choice menu`);
      if ('who' in n) unvoiced.push([`${p}.who`, 'line meta', null]);
      unvoiced.push([`${p}.prompt`, /^STRIDE/.test(n.prompt) ? 'notification (watch)' : 'menu prompt', n.prompt ?? null]);
      n.options.forEach((o, i) => {
        const op = `${p}.options.${i}`;
        for (const k of Object.keys(o)) if (!['text', 'reply', 'correct', 'who'].includes(k)) errors.push(`${op}.${k}: unexpected key in a choice option`);
        unvoiced.push([`${op}.text`, 'menu label', o.text ?? null]);
        if ('correct' in o) unvoiced.push([`${op}.correct`, 'data', null]);
        const who = o.who ?? n.who;
        if ('who' in o) unvoiced.push([`${op}.who`, 'line meta', null]);
        if (!who) return handlers.think(`${op}.reply`, o.reply, { ...spec, use: spec.use + ' -> d.think(reply)' });
        // Director.choose: the reply is said by option.who ?? menu.who.
        const one = (lp, r) => {
          if (r == null) return unvoiced.push([lp, 'data', null]);
          if (isObj(r)) return lineObj(lp, r, spec, 'say');
          if (typeof r !== 'string') return errors.push(`${lp}: unexpected reply value`);
          lineObj(lp, { who, text: r }, spec, 'say');
        };
        if (Array.isArray(o.reply)) o.reply.forEach((r, j) => one(`${op}.reply.${j}`, r));
        else one(`${op}.reply`, o.reply);
      });
    },
    bag(p, n, spec) {
      const one = (lp, e) => {
        if (e == null) return unvoiced.push([lp, 'data', null]);
        if (Array.isArray(e)) return e.forEach((x, i) => one(`${lp}.${i}`, x));
        if (isObj(e)) return lineObj(lp, e, spec, 'say');
        if (typeof e !== 'string') return errors.push(`${lp}: unexpected bag entry`);
        handlers.think(lp, e, spec);
      };
      one(p, n);
    },
  };

  const walk = (p, n) => {
    const r = p ? ruleFor(p) : null;
    if (r && r.spec.kind === 'descend' && isObj(n)) {
      r.hits++;
      for (const [k, v] of Object.entries(n)) walk(`${p}.${k}`, v);
      return;
    }
    if (r) {
      r.hits++;
      const h = handlers[r.spec.kind];
      if (!h) return errors.push(`${p}: rule '${r.g}' has unknown kind '${r.spec.kind}'`);
      return h(p, n, { ...r.spec, _g: r.g });
    }
    if (isObj(n)) {
      for (const [k, v] of Object.entries(n)) walk(p ? `${p}.${k}` : k, v);
      return;
    }
    errors.push(`UNCLASSIFIED ${p} = ${JSON.stringify(n)?.slice(0, 90)}`);
  };
  walk('', tree);
  for (const r of RULES_RE) if (!r.hits) warnings.push(`stale rule '${r.g}' matches nothing`);
  return { raw, unvoiced, errors, warnings };
}

// ============================================================================================ build
const DELIVERY_RANK = { spoken: 0, bark: 1, inner: 2, flashback: 3, tv: 4, radio: 5, voicemail: 6 };
const KEYED_WHO = (o) => o.who; // manifest variant key: the displayed French who label (inner: names.hugo)

function build({ raw, unvoiced, errors, warnings }) {
  const byKey = new Map();
  for (const o of raw) {
    const norm = normalize(o.text);
    const key = voiceKey(o.text);
    let e = byKey.get(key);
    if (!e) byKey.set(key, (e = { key, norm, byWho: new Map() }));
    else if (e.norm !== norm) errors.push(`HASH COLLISION ${key}: "${e.norm}" vs "${norm}"`);
    const w = KEYED_WHO(o);
    const prev = e.byWho.get(w);
    if (!prev) e.byWho.set(w, { ...o, uses: [{ path: o.path, use: o.use }] });
    else {
      prev.uses.push({ path: o.path, use: o.use });
      if (prev.speaker !== o.speaker) errors.push(`${o.path}: same text and who '${w}' but speaker ${o.speaker} vs ${prev.speaker} (${prev.path})`);
      if (prev.delivery !== o.delivery) {
        warnings.push(`${o.path}: same line as ${prev.path} with delivery ${o.delivery} vs ${prev.delivery}; one clip, keeping ${DELIVERY_RANK[o.delivery] < DELIVERY_RANK[prev.delivery] ? o.delivery : prev.delivery}`);
        if (DELIVERY_RANK[o.delivery] < DELIVERY_RANK[prev.delivery]) prev.delivery = o.delivery;
      }
      for (const f of o.flags || []) if (!(prev.flags || []).includes(f)) prev.flags = [...(prev.flags || []), f];
    }
  }
  const lines = [];
  for (const e of [...byKey.values()].sort((a, b) => a.byWho.values().next().value.path.localeCompare(b.byWho.values().next().value.path, 'en', { numeric: true }))) {
    const multi = e.byWho.size > 1;
    for (const [who, o] of e.byWho) {
      const ctx = contextFor(o.path, o.speaker, o.delivery);
      const emphasis = [...String(o.text).matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
      const dynamic = /\{[A-Za-z]\w*\}/.test(o.text);
      lines.push({
        key: e.key,
        file: multi ? `${e.key}-${o.speaker}.ogg` : `${e.key}.ogg`,
        variant: multi ? who : null,
        speaker: o.speaker,
        who,
        delivery: o.delivery,
        lufs: DELIVERIES[o.delivery].lufs,
        text: o.text,
        normalized: e.norm,
        tts: frTTS(o.text),
        context: ctx.text + (emphasis.length ? ` Stress: ${emphasis.map((x) => `"${x}"`).join(', ')}.` : ''),
        scene: ctx.scene,
        to: ctx.to,
        mood: ctx.mood,
        path: o.path,
        uses: o.uses,
        flags: [...new Set([...(o.flags || []), ...(dynamic ? ['dynamic'] : [])])],
        dynamic,
      });
    }
  }
  return { lines, unvoiced, errors, warnings };
}

// ============================================================================================ dynamic + selftest
// Runtime-composed strings found in the game code (grep of src/ for template text). None is a voiced line;
// listed so the "dynamic" question has an explicit answer. Re-check when chapter code changes.
const RUNTIME_COMPOSED = [
  { where: 'src/ui/UI.js chapter banner', text: "L.ui.chapter.replace('{n}', n)", voiced: false, why: 'ui' },
  { where: 'src/ui/ObjectivePointer.js', text: "L.ui.distance.replace('{n}', metres)", voiced: false, why: 'ui' },
  { where: 'src/story/ch3.js cadence gauge', text: '`${val} ${G.unit}`', voiced: false, why: 'ui (gauge)' },
  { where: 'src/story/ch2.js / ch3.js / ch5.js watch face and lap', text: 'fmtKm(...), lap clock', voiced: false, why: 'watch' },
  { where: 'src/core/KeyLabels.js key tokens', text: "'{KeyA}', '{Space}' resolved per keyboard layout", voiced: false, why: 'no voiced line contains a token (checked per line: flag "dynamic")' },
];

if (argv.includes('--selftest')) {
  const eq = (a, b, what) => {
    if (a !== b) {
      console.error(`selftest FAIL ${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
      process.exitCode = 1;
    }
  };
  const { fnv1a64 } = await import('./voiceKey.mjs');
  eq(fnv1a64(''), 'cbf29ce484222325', 'fnv1a64("")');
  eq(fnv1a64('a'), 'af63dc4c8601ec8c', 'fnv1a64("a")');
  eq(fnv1a64('foobar'), '85944171f73967e8', 'fnv1a64("foobar")');
  eq(normalize(' « Demander. » Je *sais*... Moi\u00a0? l\u2019autre '), '"Demander." Je sais\u2026 Moi? l\'autre', 'normalize');
  eq(voiceKey('J\u2019y tiens.'), voiceKey("J'y   tiens."), 'key ignores apostrophe/space style');
  eq(frTTS('La semaine derni\u00e8re : 212,4 km.'), 'La semaine derni\u00e8re : deux cent douze virgule quatre kilom\u00e8tres.', 'tts km');
  eq(frTTS('5 H 12'), 'cinq heures douze', 'tts time');
  eq(frTTS('Immobile depuis 3 h 12 min.'), 'Immobile depuis trois heures douze minutes.', 'tts duration');
  eq(frTTS('Le N\u00b0 14, M. Durand, Mme Benali, Dr Okafor, H.R.'), 'Le num\u00e9ro quatorze, Monsieur Durand, Madame Benali, Docteur Okafor, H. R.', 'tts abbreviations');
  eq(frTTS('71, 80, 91, 200, 201, 80000'), 'soixante et onze, quatre-vingts, quatre-vingt-onze, deux cents, deux cent un, quatre-vingt mille', 'tts numbers');
  eq(frTTS('STRIDE \u2014 *OPEN* \u2026'), 'Stra\u00efde \u2014 op\u00e8ne \u2026', 'tts words');
  console.log(process.exitCode ? 'selftest FAILED' : 'selftest ok');
  process.exit();
}

// ============================================================================================ run
const res = build(main(await loadTree()));
const { lines, unvoiced, errors, warnings } = res;

const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const voicedLines = lines.filter((l) => !l.dynamic);
const dynamicLines = lines.filter((l) => l.dynamic);
const summary = {
  clips: lines.length,
  uniqueKeys: new Set(lines.map((l) => l.key)).size,
  occurrences: lines.reduce((n, l) => n + l.uses.length, 0),
  dynamic: dynamicLines.length,
  perSpeaker: count(voicedLines, (l) => l.speaker),
  perDelivery: count(voicedLines, (l) => l.delivery),
  unvoicedLeaves: unvoiced.length,
  unvoicedByReason: count(unvoiced, (u) => u[1]),
  speechSecondsEstimate: Math.round(voicedLines.reduce((s, l) => s + 0.6 + l.tts.length / 14, 0)),
};

const out = {
  version: 1,
  keyVersion: VOICE_KEY_VERSION,
  lang: 'fr',
  generatedAt: new Date().toISOString(),
  generator: 'scripts/voice/extract-lines.mjs',
  key: 'voiceKey(text) = first 12 hex chars of FNV-1a 64 over UTF-8 of normalize(text) (scripts/voice/voiceKey.mjs)',
  outputDir: 'public/assets/voice/fr/',
  audio: { codec: 'opus', container: 'ogg', channels: 1, sampleRate: 48000, kbps: [40, 56], truePeak: TRUE_PEAK, maxEdgeSilenceMs: 120 },
  speakers: SPEAKERS,
  deliveries: DELIVERIES,
  summary,
  lines: voicedLines,
  dynamic: dynamicLines,
  runtimeComposed: RUNTIME_COMPOSED,
  unvoiced: unvoiced.filter(([, why]) => !['data', 'line meta'].includes(why)).map(([p, why, t]) => ({ path: p, why, text: t })),
};

// --check: every voiced line has a clip the runtime finds (core/Voice.js lookup: the key, then the variant
// by the displayed who when the entry has variants), made with this speaker's voice, and its file exists.
if (CHECK) {
  const dir = path.join(ROOT, out.outputDir);
  let man = null;
  try {
    man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (err) {
    errors.push(`no voice manifest (${path.relative(ROOT, dir)}manifest.json): ${err.message}`);
  }
  let ok = 0;
  for (const l of man ? voicedLines : []) {
    const e = man.lines?.[l.key];
    const c = e?.variants ? e.variants[l.who] : e;
    if (!c) errors.push(`NO CLIP ${l.key} ${l.speaker} ${l.path}: ${JSON.stringify(l.text).slice(0, 80)}`);
    else if (c.speaker !== l.speaker) errors.push(`WRONG VOICE ${l.key} ${l.path}: the clip is ${c.speaker}'s, the line is ${l.speaker}'s`);
    else if (!fs.existsSync(path.join(dir, c.file))) errors.push(`MISSING FILE ${c.file} (${l.path})`);
    else ok++;
  }
  if (man) console.log(`clips: ${ok}/${voicedLines.length} voiced lines have a clip`);
}

for (const w of warnings) console.warn('WARN ' + w);
for (const e of errors) console.error('ERROR ' + e);
if (LIST) for (const l of lines) console.log(`${l.key} ${l.speaker.padEnd(14)} ${l.delivery.padEnd(9)} ${l.path}\n    ${l.tts}`);
console.log(JSON.stringify(summary, null, 2));
if (!CHECK) {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, OUT)} (${lines.length} clips)`);
}
if (errors.length) {
  console.error(`${errors.length} error(s)`);
  process.exit(1);
}
