#!/usr/bin/env node
// HAIRLINE voice inventory: which French lines get a voice clip, who says them, how, and what to feed the TTS.
//
//   node scripts/voice/extract-lines.mjs            -> writes scripts/voice/lines.fr.json, prints a summary
//   node scripts/voice/extract-lines.mjs --check    -> no write; exit 1 on any unclassified leaf or table error
//   node scripts/voice/extract-lines.mjs --list     -> also print every voiced line (key, speaker, delivery, tts)
//   node scripts/voice/extract-lines.mjs --out FILE -> write elsewhere
//   node scripts/voice/extract-lines.mjs --selftest -> check voiceKey vectors and the French TTS normalizer
//
// Reads the text modules exactly as the game assembles them (src/story/script.js + i18n.js): the English
// tree gives the key paths and shape, the French tree the text (a missing French leaf falls back to English
// in the game; here it is reported and NOT voiced). The other workflow may be mid-edit, so imports are
// retried on syntax errors.
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TEXT = process.env.HAIRLINE_TEXT_DIR ? path.resolve(process.env.HAIRLINE_TEXT_DIR) : path.join(ROOT, 'src/story/text'); // override for tests
const FILES = ['common', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5'];
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
  ines: {
    who: 'Ines', name: 'Ines', age: 16, gender: 'female',
    voice: 'Teenage girl, deadpan, flat, low energy, dry; used to tag the wall.',
  },
  marco: {
    who: 'Marco', name: 'Marco', age: '40s-50s', gender: 'male',
    voice: 'Kebab-shop owner: warm, proud, a little theatrical; savours his own lines.',
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
  maman: {
    who: 'Maman', name: 'Maman (Hugo\'s mother)', age: '60s', gender: 'female',
    voice: 'Warm, worried. Currently has NO spoken line (her only line is an SMS in Ch1), so nothing is generated for her.',
  },
};

// Displayed who labels (French AND English, so a missing translation still resolves) -> speaker id.
const WHO = {
  Hugo: 'hugo', Odile: 'odile', Sami: 'sami', Bastien: 'bastien', Ines: 'ines', Marco: 'marco',
  'Mme Benali': 'benali', 'Dr Okafor': 'okafor',
  'Dr Okafor (cabinet)': 'receptionist', "Dr Okafor's office": 'receptionist',
  TV: 'tv', Maman: 'maman', Mum: 'maman',
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
// Pattern syntax: dot path on the English-shaped tree; '*' = one segment, '**' = any depth (incl. none).
// The first rule matching a node (top-down) claims the whole subtree.
//
// kinds:
//   none   {why}                 not voiced (why: ui, hint, objective, prompt, sign, caption, card, watch,
//                                 notebook, endcard, data, title)
//   say    {delivery?, unvoicedWho?}  d.say(lines): [{who, text, inner?, voicemail?}] (or one line object).
//                                 inner -> Hugo/inner; voicemail -> voicemail; stage (*...*, who null) -> not voiced;
//                                 unvoicedWho: EN who label -> reason (phone texts and notifications).
//   think  {}                    Hugo's thought: plain string(s) to d.thought / d.think / ui.thought without who
//                                 (or d.card for the crack) -> Hugo/inner.
//   bark   {speakers?, delivery?} ui.thought(text, secs, {who}) barks: {who, <key>: string|string[]},
//                                 {who, text}, or arrays of them. speakers: key -> speaker id override.
//   menu   {}                    d.correct(menu): prompt/option labels not voiced; replies spoken by menu.who
//                                 (Director default: Odile).
//   choose {}                    d.choose(menu): STRIDE notification / choice prompt and option labels not voiced;
//                                 replies are Hugo's thoughts (d.think) -> inner.
const UI_ = { kind: 'none', why: 'ui' };
const RULES = [
  // ---------------------------------------------------------------- common (core text)
  ['names.**', { ...UI_, why: 'speaker labels' }],
  ['title.**', UI_], ['keyNames.**', UI_], ['loading', UI_], ['noWebGL', UI_], ['contextLost', UI_], ['reload', UI_],
  ['mobile.**', UI_], ['pause.**', UI_], ['options.**', UI_], ['ui.**', UI_],
  ['opening.**', { kind: 'none', why: 'card', use: 'main.js director.card(L.opening)' }],
  ['stumble.first', { kind: 'think', use: 'Player.stumble -> ui.thought(line)' }],
  ['stumble.bag', { kind: 'think', use: 'Player.stumble -> ui.thought(line), shuffled bag' }],
  ['hints.**', { kind: 'none', why: 'hint' }],
  ['watch.**', { kind: 'none', why: 'watch' }],
  ['notebook.**', { kind: 'none', why: 'notebook' }],
  ['ending.**', { kind: 'none', why: 'endcard' }],

  // ---------------------------------------------------------------- ch1 (src/story/ch1.js)
  ['ch1.title', { kind: 'none', why: 'title' }],
  ['ch1.objectives.**', { kind: 'none', why: 'objective' }],
  ['ch1.prompts.**', { kind: 'none', why: 'prompt' }],
  ['ch1.signs.**', { kind: 'none', why: 'sign' }],
  ['ch1.tvTicker', { kind: 'none', why: 'sign' }],
  ['ch1.hammer', { kind: 'think', use: 'd.thought(L.ch1.hammer, 6.5)' }],
  ['ch1.tv', { kind: 'say', delivery: 'tv', use: "look('tv', L.ch1.tv) -> d.say" }],
  ['ch1.tvOff', { kind: 'say', use: 'd.say(L.ch1.tvOff)' }],
  ['ch1.phone', {
    kind: 'say', use: 'd.say(L.ch1.phone) (read on the phone; the voicemail goes to his ear)',
    unvoicedWho: { Phone: 'notification (phone screen)', Mum: 'sms', STRIDE: 'notification (app)', 'Bastien (Run Club)': 'sms' },
  }],
  ['ch1.watch', { kind: 'say', use: 'd.say(L.ch1.watch)' }],
  ['ch1.watchHud.**', { kind: 'none', why: 'watch' }],
  ['ch1.watchAfter', { kind: 'say', use: 'd.say(L.ch1.watchAfter)' }],
  ['ch1.buzz', { kind: 'none', why: 'watch', use: 'ui.watchBuzz' }],
  ['ch1.buzzReply', { kind: 'say', use: 'd.say(L.ch1.buzzReply)' }],
  ['ch1.xray', { kind: 'say', use: "look('xray') -> d.say" }],
  ['ch1.bike', { kind: 'say', use: "look('bike') -> d.say" }],
  ['ch1.bibs', { kind: 'say', use: "look('bibs') -> d.say" }],
  ['ch1.bibCount', { kind: 'none', why: 'data' }],
  ['ch1.door', { kind: 'say', use: 'd.say(L.ch1.door)' }],
  ['ch1.table', { kind: 'say', use: 'd.say(L.ch1.table)' }],
  ['ch1.startBuzz', { kind: 'none', why: 'watch' }],
  ['ch1.walkFace', { kind: 'none', why: 'watch' }],
  ['ch1.walkLabel', { kind: 'none', why: 'watch' }],

  // ---------------------------------------------------------------- ch2 (src/story/ch2.js)
  ['ch2.title', { kind: 'none', why: 'title' }],
  ['ch2.objectives.**', { kind: 'none', why: 'objective' }],
  ['ch2.prompts.**', { kind: 'none', why: 'prompt' }],
  ['ch2.signs.**', { kind: 'none', why: 'sign' }],
  ['ch2.lapStart', { kind: 'none', why: 'watch' }], ['ch2.lapEnd', { kind: 'none', why: 'watch' }],
  ['ch2.start', { kind: 'think', use: 'd.thought(T.start, 5.5)' }],
  ['ch2.pauseBuzz', { kind: 'none', why: 'watch' }],
  ['ch2.pauseReply', { kind: 'think', use: 'd.thought(T.pauseReply, 1.6)' }],
  ['ch2.ghost', { kind: 'say', use: 'd.say(T.ghost)' }],
  ['ch2.ghostLinger', { kind: 'think', use: 'd.thought(T.ghostLinger, 5.5)' }],
  ['ch2.billboard', { kind: 'say', use: 'look(..., T.billboard) -> d.say' }],
  ['ch2.club', { kind: 'say', use: 'd.say(L.ch2.club)' }],
  ['ch2.clubAfter', { kind: 'say', use: 'd.say(L.ch2.clubAfter)' }],
  ['ch2.shop', { kind: 'say', use: 'look(..., T.shop) -> d.say' }],
  ['ch2.bench', { kind: 'say', use: 'd.say(T.bench)' }],
  ['ch2.arrivalLoop', { kind: 'say', use: 'd.say(T.arrivalLoop)' }],
  ['ch2.arrival', { kind: 'say', use: 'd.say(T.arrival)' }],
  ['ch2.hold.gauge', { kind: 'none', why: 'ui' }],
  ['ch2.hold.barks', { kind: 'bark', use: 'holdStill: ui.thought(nextBark(), 2.4, {who})' }],
  ['ch2.hold.buzz', { kind: 'none', why: 'watch' }],
  ['ch2.hold.buzzReply', { kind: 'think', use: 'd.thought(H.buzzReply, 1.8)' }],
  ['ch2.after', { kind: 'say', use: 'd.say(T.after)' }],
  ['ch2.nameOne', { kind: 'menu', use: 'd.correct(T.nameOne)' }],
  ['ch2.leaving', { kind: 'say', use: 'd.say(T.leaving)' }],
  ['ch2.howFarLap', { kind: 'none', why: 'watch' }],
  ['ch2.flare', { kind: 'none', why: 'data' }],

  // ---------------------------------------------------------------- ch3 (src/story/ch3.js)
  ['ch3.title', { kind: 'none', why: 'title' }],
  ['ch3.signs.**', { kind: 'none', why: 'sign' }],
  ['ch3.objectives.**', { kind: 'none', why: 'objective' }],
  ['ch3.keys.**', { kind: 'none', why: 'ui' }],
  ['ch3.gauge.**', { kind: 'none', why: 'ui' }],
  ['ch3.cadence.*', { kind: 'think', use: 'cadence feedback(): ui.thought, non-blocking' }],
  ['ch3.weekLabel', { kind: 'none', why: 'watch' }],
  ['ch3.weeks.*.caption', { kind: 'none', why: 'caption' }],
  ['ch3.weeks.*.length', { kind: 'none', why: 'data' }],
  ['ch3.weeks.*.total', { kind: 'none', why: 'data' }],
  ['ch3.weeks.*.thoughts.*', { kind: 'think', use: 'story(wk.thoughts[m]) at metre marks' }],
  ['ch3.weeks.*.stride', { kind: 'choose', use: 'd.choose(wk.stride) then d.think(opt.reply)' }],
  ['ch3.sunday', { kind: 'none', why: 'card' }],
  ['ch3.race.caption', { kind: 'none', why: 'caption' }],
  ['ch3.race.label', { kind: 'none', why: 'watch' }],
  ['ch3.race.faceStart', { kind: 'none', why: 'data' }],
  ['ch3.race.boards.**', { kind: 'none', why: 'sign' }],
  ['ch3.race.banners.**', { kind: 'none', why: 'sign' }],
  ['ch3.race.thoughts.*', { kind: 'think', use: 'story(T.race.thoughts.km30*)' }],
  // DECISION: the crack is shown as a clear italic card, but it is Hugo's first-person memory, the
  // quietest moment of the game: voiced as inner monologue. Flip to {kind:'none', why:'card'} to drop it.
  ['ch3.crack', { kind: 'think', use: "d.card(T.crack, {bg:'clear', italic:true}) (card-rendered inner monologue)", flags: ['card-rendered'] }],
  ['ch3.keepGoing', { kind: 'think', use: 'story(T.keepGoing, 6.5)' }],
  ['ch3.finish.**', { kind: 'none', why: 'watch' }],
  ['ch3.doctor', { kind: 'say', delivery: 'flashback', use: 'd.say(T.doctor) over black' }],
  ['ch3.present', { kind: 'say', use: 'd.say(T.present)' }],

  // ---------------------------------------------------------------- ch4 (src/story/ch4.js, ch4crafts.js, crafts/*)
  ['ch4.title', { kind: 'none', why: 'title' }],
  ['ch4.cards.**', { kind: 'none', why: 'card' }],
  ['ch4.objectives.**', { kind: 'none', why: 'objective' }],
  ['ch4.prompts.**', { kind: 'none', why: 'prompt' }],
  ['ch4.signs.**', { kind: 'none', why: 'sign' }],
  ['ch4.oldSigns', { kind: 'say', use: 'd.say(T4.oldSigns)' }],
  ['ch4.radio', { kind: 'say', use: 'd.say(T4.radio)' }],
  ['ch4.day5.*', { kind: 'say', use: 'd.say(T4.day5.<beat>)' }],
  ['ch4.sanding.gauge', { kind: 'none', why: 'ui' }],
  ['ch4.sanding.hint', { kind: 'none', why: 'hint' }],
  ['ch4.sanding.barks', { kind: 'bark', use: 'ch4crafts: ui.thought(SD.barks.mash[i] | SD.barks.cross, 2.4, {who})' }],
  ['ch4.sanding.buzz', { kind: 'none', why: 'watch' }],
  ['ch4.sanding.buzzReply', { kind: 'think', use: 'd.thought(SD.buzzReply, 2)' }],
  ['ch4.day8.start', { kind: 'say', use: 'd.say(T4.day8.start)' }],
  ['ch4.day8.tape.hint', { kind: 'none', why: 'hint' }],
  ['ch4.day8.tape.readings', { kind: 'say', use: 'tape.js: d.say([text.readings[i]]) (i = measured value)', flags: ['selected-at-runtime'] }],
  ['ch4.day8.tape.again', { kind: 'say', use: 'tape.js: d.say([text.again[i]])', flags: ['selected-at-runtime'] }],
  ['ch4.day8.tape.twice', { kind: 'say', use: 'tape.js: d.say(text.twice)' }],
  ['ch4.day8.tape.differ', { kind: 'say', use: 'tape.js: d.say([line, ...text.help])', flags: ['selected-at-runtime'] }],
  ['ch4.day8.tape.short', { kind: 'bark', use: 'tape.js: ui.thought(text.short.text, 2.4, {who})' }],
  ['ch4.day8.tape.help', { kind: 'say', use: 'tape.js: d.say([line, ...text.help])' }],
  ['ch4.day8.tape.cut', { kind: 'say', use: 'ch4.js: d.say([T4.day8.tape.cut[readingIndex(m.agreed)]])', flags: ['selected-at-runtime'] }],
  ['ch4.day8.grey', { kind: 'say', use: 'd.say(T4.day8.grey)' }],
  ['ch4.day8.mixer.intro', { kind: 'say', use: 'mixer.js: d.say(text.intro)' }],
  ['ch4.day8.mixer.tins.**', { kind: 'none', why: 'ui' }],
  ['ch4.day8.mixer.hint', { kind: 'none', why: 'hint' }],
  ['ch4.day8.mixer.tip', { kind: 'none', why: 'ui' }],
  ['ch4.day8.mixer.done', { kind: 'none', why: 'ui' }],
  ['ch4.day8.mixer.full', { kind: 'bark', use: 'mixer.js: ui.thought(text.full.text, 2.4, {who})' }],
  ['ch4.day8.mixer.verdicts.*', { kind: 'say', use: 'mixer.js: d.say([...text.verdicts[v], text.hints[n]?])', flags: ['selected-at-runtime'] }],
  ['ch4.day8.mixer.hints', { kind: 'say', use: 'mixer.js: ui.thought(h.text, 5, {who}) AND appended to d.say(verdict lines)', flags: ['also-bark'] }],
  ['ch4.day8.mixer.warm', { kind: 'say', use: 'mixer.js: ui.thought(text.warm.text, 5, {who}) AND appended to d.say(verdict lines)', flags: ['also-bark'] }],
  ['ch4.day8.mixer.give', { kind: 'say', use: 'mixer.js: d.say(text.give)' }],
  ['ch4.day8.greyLook', { kind: 'say', use: 'mixer.js: stage line after the "light" verdict' }],
  ['ch4.day8.paintColor', { kind: 'none', why: 'data' }],
  ['ch4.day8.painted', { kind: 'say', use: 'd.say(T4.day8.painted)' }],
  ['ch4.week4.sami', { kind: 'say', use: 'd.say(T4.week4.sami)' }],
  ['ch4.week4.bike', { kind: 'say', use: 'd.say(T4.week4.bike)' }],
  ['ch4.week4.hold', { kind: 'say', use: 'd.say(T4.week4.hold)' }],
  ['ch4.week4.truing.hint', { kind: 'none', why: 'hint' }],
  ['ch4.week4.truing.gauge', { kind: 'none', why: 'ui' }],
  ['ch4.week4.truing.pitch.**', { kind: 'none', why: 'ui' }],
  ['ch4.week4.truing.flat', { kind: 'think', use: 'truing.js: d.thought(text.flat, 3)' }],
  ['ch4.week4.truing.barks', { kind: 'bark', use: 'truing.js: ui.thought(barks[key], 2.4, {who})' }],
  ['ch4.week4.truing.assisted', { kind: 'bark', use: 'truing.js: ui.thought(a.text, 2.6, {who})' }],
  ['ch4.week4.after', { kind: 'say', use: 'd.say(T4.week4.after)' }],
  ['ch4.week4.laughStage', { kind: 'say', use: 'd.say (stage only)' }],
  ['ch4.week4.laugh', { kind: 'say', use: 'd.say(T4.week4.laugh)' }],
  ['ch4.week4.wrap', { kind: 'say', use: 'd.say(T4.week4.wrap)' }],
  ['ch4.week7.raceBike', { kind: 'say', use: 'd.say(T4.week7.raceBike)' }],
  ['ch4.week7.stage', { kind: 'say', use: 'd.say (stage only)' }],
  ['ch4.week7.intro', { kind: 'say', use: 'd.say(B7.intro.slice(0,5)), pause 0.9 s, d.say(B7.intro.slice(5))' }],
  ['ch4.week7.lettering.paint', { kind: 'none', why: 'data' }],
  ['ch4.week7.lettering.tiers.*', { kind: 'say', use: 'd.say(tiers[good|middle|poor])', flags: ['selected-at-runtime'] }],
  ['ch4.week7.signMenu', { kind: 'menu', use: 'd.correct(B7.signMenu)' }],
  ['ch4.week7.signThink', { kind: 'say', use: 'd.say(B7.signThink)' }],
  ['ch4.week7.buzz', { kind: 'none', why: 'watch' }],
  ['ch4.week7.buzzReply', { kind: 'think', use: 'd.thought(B7.buzzReply, 2.4)' }],
  ['ch4.week7.wrap', { kind: 'say', use: 'd.say(B7.wrap)' }],

  // ---------------------------------------------------------------- ch5 (src/story/ch5.js, ch5jobs.js, ch5panel.js)
  ['ch5.title', { kind: 'none', why: 'title' }],
  ['ch5.objectives.**', { kind: 'none', why: 'objective' }],
  ['ch5.prompts.**', { kind: 'none', why: 'prompt' }],
  ['ch5.signs.**', { kind: 'none', why: 'sign' }],
  ['ch5.opening', { kind: 'say', use: 'd.say(T.opening)' }],
  ['ch5.benali', { kind: 'say', use: 'talk(n, T.benali) -> d.say' }],
  ['ch5.ines', { kind: 'say', use: 'talk(n, T.ines) -> d.say' }],
  ['ch5.marco', { kind: 'say', use: 'talk(n, T.marco) -> d.say' }],
  ['ch5.shopCard', { kind: 'say', use: 'd.say(T.shopCard)' }],
  ['ch5.boltHoles', { kind: 'say', use: 'd.say(T.boltHoles)' }],
  ['ch5.jobs.shutter.near', { kind: 'bark', use: 'ch5jobs: api.bark(line.text, line.who, 3) on approach' }],
  ['ch5.jobs.shutter.gauge', { kind: 'none', why: 'ui' }],
  ['ch5.jobs.shutter.mash', { kind: 'bark', use: 'ch5jobs: ui.thought(m.text, 2.4, {who})' }],
  ['ch5.jobs.shutter.done', { kind: 'say', use: 'ch5jobs: d.say(T().shutter.done)' }],
  ['ch5.jobs.shutter.call', { kind: 'bark', use: 'ch5jobs.callShutter: api.bark(c.text, c.who, 3.2) from up the street' }],
  ['ch5.jobs.radio.near', { kind: 'bark', use: 'ch5jobs: api.bark on approach' }],
  ['ch5.jobs.radio.hint', { kind: 'none', why: 'hint' }],
  ['ch5.jobs.radio.stations', {
    kind: 'bark', delivery: 'radio', use: 'crafts/radio.js: ui.thought(text.stations[id], 2.6, {who: "Radio"}) when a station is found',
    speakers: { fishing: 'radio_fishing', football: 'radio_football', forecast: 'radio_forecast' },
    notes: { fishing: 'never captioned today (found quietly at start); the clip can serve as the radio voice bed' },
  }],
  ['ch5.jobs.radio.done', { kind: 'say', use: 'ch5jobs: d.say(T().radio.done)' }],
  ['ch5.jobs.board.near', { kind: 'bark', use: 'ch5jobs: api.bark on approach' }],
  ['ch5.jobs.board.word', { kind: 'none', why: 'sign' }],
  ['ch5.jobs.board.tiers.*', { kind: 'say', use: 'ch5jobs: d.say(tiers[...])', flags: ['selected-at-runtime'] }],
  ['ch5.jobs.wheel.near', { kind: 'bark', use: 'ch5jobs: api.bark on approach' }],
  ['ch5.jobs.wheel.truing.flat', { kind: 'think', use: 'truing.js: d.thought(text.flat, 3)' }],
  ['ch5.jobs.wheel.truing.barks', { kind: 'bark', use: 'truing.js: ui.thought(barks[key], 2.4, {who})' }],
  ['ch5.jobs.wheel.truing.assisted', { kind: 'bark', use: 'truing.js: ui.thought(a.text, 2.6, {who})' }],
  ['ch5.jobs.wheel.done', { kind: 'bark', use: 'ch5jobs: api.bark(done.text, done.who, 2.6)' }],
  ['ch5.teach.call', { kind: 'bark', use: 'bark(T.teach.call[0].text, who, 2.6)' }],
  ['ch5.teach.menu', { kind: 'menu', use: 'd.correct(T.teach.menu)' }],
  ['ch5.teach.after', { kind: 'say', use: 'd.say(after.slice(0,2)); d.say(after.slice(2))' }],
  ['ch5.panel.ask', { kind: 'say', use: 'ch5panel: d.say(T.ask)' }],
  ['ch5.panel.menu', { kind: 'choose', use: 'ch5panel: d.choose(T.menu) (replies null)' }],
  ['ch5.panel.stage', { kind: 'say', use: 'ch5panel: d.say(T.stage) (stage only)' }],
  ['ch5.panel.after.*', { kind: 'say', use: 'ch5panel: d.say(T.after[motif])', flags: ['selected-at-runtime'] }],
  ['ch5.line.setup', { kind: 'say', use: 'd.say(T.line.setup)' }],
  ['ch5.line.gauge', { kind: 'none', why: 'ui' }],
  ['ch5.line.color', { kind: 'none', why: 'data' }],
  ['ch5.line.end', { kind: 'say', use: 'd.say(T.line.end)' }],
  ['ch5.line.tiers.*', { kind: 'say', use: 'd.say(T.line.tiers[tier])', flags: ['selected-at-runtime'] }],
  ['ch5.line.sign', { kind: 'say', use: 'd.say(T.line.sign.slice(0,2)); d.say(slice(2))' }],
  ['ch5.line.photo', { kind: 'say', use: 'd.say(T.line.photo)' }],
  ['ch5.club.greet', { kind: 'say', use: 'd.say(T.club.greet)' }],
  ['ch5.club.after', { kind: 'say', use: 'd.say(T.club.after)' }],
  ['ch5.club.afterThoughts', { kind: 'say', use: 'd.say(T.club.afterThoughts)' }],
  ['ch5.boot.*', { kind: 'say', use: 'd.say(T.boot.<beat>)' }],
  ['ch5.walk.sami', { kind: 'bark', use: 'bark(B0[i].text, B0[i].who) at 0 / 2.5 / 4.7 s' }],
  ['ch5.walk.firstJog', { kind: 'think', use: 'thoughtSoon(T.walk.firstJog) -> bark(text, null)' }],
  ['ch5.walk.stopped', { kind: 'think', use: 'thoughtSoon(T.walk.stopped)' }],
  ['ch5.walk.mural', { kind: 'think', use: 'thoughtSoon(T.walk.mural)' }],
  ['ch5.walk.bike', { kind: 'think', use: 'thoughtSoon(T.walk.bike)' }],
  ['ch5.walk.watchHud.**', { kind: 'none', why: 'watch' }],
  ['ch5.walk.outline', { kind: 'say', use: 'd.say(T.walk.outline)' }],
  ['ch5.walk.restMenu', { kind: 'choose', use: 'd.choose(menu) then d.think(opt.reply)' }],
  ['ch5.readyCheck', { kind: 'menu', use: 'ch5.js: d.choose(T.readyCheck) (who + prompt + Ready/Not yet; prompt not voiced like every menu prompt)' }],
  ['ch5.walk.crane', { kind: 'say', use: 'd.say(T.walk.crane)' }],
];

// ============================================================================================ context
// Longest-prefix match on the key path. to / mood can be per speaker ({hugo: ..., odile: ...}).
// English on purpose: it is direction for the voice model / the person choosing takes, not game text.
const CONTEXT = [
  ['stumble', { scene: 'Hugo stumbles in his walking boot; a spike of pain', to: 'himself', mood: 'wry, through gritted teeth, tired' }],
  ['ch1', { scene: "Ch1, night, Hugo's grimy third-floor flat, day 4 in the boot", to: 'himself', mood: 'flat, tired, dry' }],
  ['ch1.hammer', { scene: 'Ch1, night: someone hammers downstairs, steady blows through the floor', to: 'himself', mood: 'irritated, flat, a little amused at his own irritation' }],
  ['ch1.tv', { scene: 'Ch1: TV cycling broadcast, stage 17, the domestiques peel off the front', to: 'the TV audience', mood: 'measured broadcast commentary, gently lyrical' }],
  ['ch1.tvOff', { scene: 'Ch1: Hugo switches off the cycling broadcast; he was one of those domestiques', to: 'himself', mood: 'quiet, bitter memory' }],
  ['ch1.phone', { scene: 'Ch1: Hugo checks his phone; a voicemail from the doctor\'s office', to: { receptionist: 'Hugo (voicemail)', hugo: 'himself' }, mood: { receptionist: 'polite, professional, slightly awkward reading the doctor\'s exact words', hugo: 'avoidant, dry' } }],
  ['ch1.watch', { scene: 'Ch1: the GPS watch still on its charger', to: 'himself', mood: 'flat, a little sad' }],
  ['ch1.watchAfter', { scene: 'Ch1: the watch shows last week, 212.4 km, broken kilometres included', to: 'himself', mood: 'quiet, hollow' }],
  ['ch1.buzzReply', { scene: 'Ch1: the watch buzzes "time to move" at a man in a boot', to: 'the watch', mood: 'dry sarcasm, one word' }],
  ['ch1.xray', { scene: 'Ch1: the X-ray taped to the fridge', to: 'himself', mood: 'dry, self-deprecating' }],
  ['ch1.bike', { scene: 'Ch1: his old race bike rusting on two hooks', to: 'himself', mood: 'rueful' }],
  ['ch1.bibs', { scene: 'Ch1: 38 race bibs pinned above the bed', to: 'himself', mood: 'numb pride' }],
  ['ch1.door', { scene: "Ch1: at the flat's door, deciding to go for a walk", to: 'himself', mood: 'quiet resolve; "J\'y tiens" is a tiny wry beat' }],
  ['ch1.table', { scene: "Ch1: he wedges the wobbly table with Sunday's race number", to: 'himself', mood: 'dark, wry' }],
  ['ch2', { scene: 'Ch2, Rue des Tanneurs, late evening, rain; Hugo limps round the block in the boot', to: 'himself', mood: 'tired, dry' }],
  ['ch2.start', { scene: 'Ch2: out of the building at last, three flights in a boot', to: 'himself', mood: 'exhausted wry tally' }],
  ['ch2.pauseReply', { scene: 'Ch2: the watch offers to pause the walk', to: 'the watch', mood: 'curt refusal' }],
  ['ch2.ghost', { scene: 'Ch2: a hand-painted ghost sign high on the brick', to: 'himself', mood: 'quiet admiration' }],
  ['ch2.ghostLinger', { scene: 'Ch2: still standing under the ghost sign', to: 'himself', mood: 'soft, noticing' }],
  ['ch2.billboard', { scene: 'Ch2: the STRIDE "NEVER STOP" billboard', to: 'himself', mood: 'bitter irony' }],
  ['ch2.club', { scene: 'Ch2: the run club passes; Bastien jogs on the spot beside Hugo in the rain', to: { bastien: 'Hugo', hugo: 'Bastien' }, mood: { bastien: 'loud, cheerful, breathless, oblivious', hugo: 'flat, terse' } }],
  ['ch2.clubAfter', { scene: 'Ch2: Bastien has run off', to: 'himself', mood: 'self-recognition, quiet' }],
  ['ch2.shop', { scene: 'Ch2: the closed bike shop and its thank-you sign', to: 'himself', mood: 'bitter-funny' }],
  ['ch2.bench', { scene: 'Ch2: sitting on a wet bench in the dark', to: 'himself', mood: 'self-mocking' }],
  ['ch2.arrivalLoop', { scene: 'Ch2: back where he started after one block', to: 'himself', mood: 'deflated' }],
  ['ch2.arrival', { scene: 'Ch2: Odile, on a creaking scaffold tower, calls down to the stranger in the boot', to: { odile: 'Hugo, from above', hugo: 'Odile, looking up' }, mood: { odile: 'brusque commands, no time for niceties', hugo: 'surprised' } }],
  ['ch2.hold', { scene: 'Ch2: Hugo holds the scaffold still while Odile letters the fascia above', to: { odile: 'Hugo below, without looking down', hugo: 'the watch' }, mood: { odile: 'terse, irritable, absorbed in the brush', hugo: 'gritted, "not now"' } }],
  ['ch2.after', { scene: 'Ch2: Odile has climbed down and sizes him up', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'dry, sardonic, testing', hugo: 'defensive' } }],
  ['ch2.nameOne', { scene: 'Ch2: Odile shoots down his excuses', to: 'Hugo', mood: 'deadpan; the last reply is an offhand invitation' }],
  ['ch2.leaving', { scene: 'Ch2: as he turns to go, Odile asks about the leg', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'blunt, curious', hugo: 'honest, quiet, a little ashamed' } }],
  ['ch3', { scene: 'Ch3 flashback: dawn training runs months before the injury, rhythm and breath', to: 'himself', mood: 'breathing while running, focused' }],
  ['ch3.cadence', { scene: 'Ch3: coaching his own cadence mid-run', to: 'himself', mood: 'breathy, short, in rhythm' }],
  ['ch3.weeks.0', { scene: 'Ch3 flashback, training week 9 at 5 a.m.: the old life at its brightest', to: 'himself', mood: 'proud, euphoric, running' }],
  ['ch3.weeks.1', { scene: 'Ch3 flashback, week 20: a sore spot on the shin he ignores', to: 'himself', mood: 'denial, still running' }],
  ['ch3.weeks.2', { scene: 'Ch3 flashback, week 31, the day before the race: ibuprofen and counting', to: 'himself', mood: 'grim, numb, running through pain' }],
  ['ch3.weeks.0.stride', { scene: 'Ch3: answering the watch\'s rest suggestion while running', to: 'himself', mood: 'breezy self-deception' }],
  ['ch3.weeks.1.stride', { scene: 'Ch3: answering the watch\'s "load HIGH" warning', to: 'himself', mood: 'self-deceiving humour' }],
  ['ch3.weeks.2.stride', { scene: 'Ch3: answering "race day tomorrow"', to: 'himself', mood: 'self-deceiving, a lie told lightly' }],
  ['ch3.race', { scene: 'Ch3: the city marathon, km 30, crowd noise', to: 'himself', mood: 'proud, breathing hard' }],
  ['ch3.crack', { scene: 'Ch3: at km 31 the shin cracks; sound drops out', to: 'himself (remembering)', mood: 'very quiet, numb, matter-of-fact' }],
  ['ch3.keepGoing', { scene: 'Ch3: limping on for the last 11 km', to: 'himself (remembering)', mood: 'insistent, rueful' }],
  ['ch3.doctor', { scene: 'Ch3 memory over black: Dr Okafor shows Hugo the X-ray', to: 'Hugo', mood: 'calm, clinical, pointing at the line' }],
  ['ch3.present', { scene: 'Back in the rainy street, present day: Odile asks how far', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'incredulous, then quietly probing', hugo: 'quiet confession' } }],
  ['ch4', { scene: "Ch4: Odile's cluttered repair workshop, weeks of work", to: { odile: 'Hugo', hugo: 'Odile', sami: 'Hugo' }, mood: { odile: 'dry, practical, bossy', hugo: 'dry, slowly thawing', sami: 'cheeky' } }],
  ['ch4.oldSigns', { scene: 'Ch4: a stack of old shop signs, "MARCHAL & FILLE"', to: { hugo: 'Odile (reading the sign)', odile: 'Hugo' }, mood: { hugo: 'reading aloud', odile: 'matter-of-fact, grief buried deep' } }],
  ['ch4.radio', { scene: 'Ch4: her one-station radio', to: 'Hugo', mood: 'deadpan' }],
  ['ch4.day5', { scene: 'Ch4, day 5: Hugo\'s first morning at the workshop; the notebook "what I can do"', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'brisk, dry, teaching by orders', hugo: 'wry, a bit lost' } }],
  ['ch4.day5.strikeThink', { scene: 'Ch4, day 5: both his skills crossed out by ten past ten', to: 'himself', mood: 'dry, self-mocking' }],
  ['ch4.day5.pegboard', { scene: 'Ch4: tool outlines painted on the pegboard', to: 'himself', mood: 'reflective' }],
  ['ch4.sanding', { scene: 'Ch4: Hugo sands the old door; Odile watches from the bench', to: { odile: 'Hugo, across the room', hugo: 'the watch' }, mood: { odile: 'dry correction', hugo: 'curt refusal' } }],
  ['ch4.day8', { scene: 'Ch4, day 8: measuring the frame and mixing a grey', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'dry, exacting', hugo: 'concentrating' } }],
  ['ch4.day8.tape.readings', { scene: 'Ch4: reading the tape measure at the door frame', to: 'Odile', mood: 'concentrating, reading a number' }],
  ['ch4.day8.tape.again', { scene: 'Ch4: re-reading the tape after "measure twice"', to: 'Odile', mood: 'slight doubt, checking' }],
  ['ch4.day8.mixer', { scene: 'Ch4: Odile judges each grey he mixes', to: 'Hugo', mood: 'withering wit; the target line is quiet approval' }],
  ['ch4.day8.painted', { scene: 'Ch4: the painted door, the first thing holding colour', to: { hugo: 'himself', odile: 'Hugo' }, mood: { hugo: 'quietly amazed, deadpan', odile: 'teasing' } }],
  ['ch4.week4', { scene: 'Ch4, week 4: Sami ducks in with a bike far too big for him', to: { sami: 'Odile then Hugo', odile: 'Sami', hugo: 'Sami' }, mood: { sami: 'cheeky, out of breath, literal', odile: 'dry deflection', hugo: 'dry, patient' } }],
  ['ch4.week4.bike', { scene: 'Ch4: Hugo diagnoses the wheel', to: 'himself', mood: 'expert, focused, calm' }],
  ['ch4.week4.truing', { scene: 'Ch4: Sami holds the bike while Hugo trues the wheel', to: { sami: 'Hugo / Odile', hugo: 'himself' }, mood: { sami: 'impatient kid commentary', hugo: 'focused' } }],
  ['ch4.week4.after', { scene: 'Ch4: the wheel spins true', to: { sami: 'Hugo', hugo: 'Sami' }, mood: { sami: 'delighted, nosy', hugo: 'patient, amused' } }],
  ['ch4.week4.laugh', { scene: 'Ch4: Hugo just laughed, rusty, for the first time in ages', to: 'himself', mood: 'surprised at himself' }],
  ['ch4.week4.wrap', { scene: 'Ch4: wheels were always his thing', to: { hugo: 'Odile', odile: 'Hugo' }, mood: { hugo: 'quiet admission', odile: 'nodding, offhand' } }],
  ['ch4.week7', { scene: 'Ch4, week 7: Odile\'s hand shakes at the fine brush; she nearly asks for help', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'gruff, vulnerable underneath; "J\'ai besoin de quelqu\'un pour—" breaks off', hugo: 'gentle' } }],
  ['ch4.week7.raceBike', { scene: 'Ch4, week 7: he has taken the old race bike down', to: 'himself', mood: 'quiet satisfaction' }],
  ['ch4.week7.lettering', { scene: 'Ch4: Odile looks at his OPEN sign', to: 'Hugo', mood: 'grudging praise' }],
  ['ch4.week7.signMenu', { scene: 'Ch4: Odile tells him how to sign his work', to: 'Hugo', mood: 'dry; the second reply is firm and pointed' }],
  ['ch4.week7.signThink', { scene: 'Ch4: his initials on the sign', to: 'himself', mood: 'moved, understated' }],
  ['ch4.week7.buzzReply', { scene: 'Ch4: the watch says he has been still for three hours', to: 'himself', mood: 'genuinely surprised' }],
  ['ch4.week7.wrap', { scene: 'Ch4: Odile plans the mural', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'matter-of-fact plotting', hugo: 'catching on, wary' } }],
  ['ch5', { scene: 'Ch5, week 12: Rue des Tanneurs by day, neighbours painting the blind wall', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'dry, fond underneath', hugo: 'light, at ease' } }],
  ['ch5.opening', { scene: 'Ch5: Hugo finds Odile in her folding chair with a stick of chalk', to: { odile: 'Hugo', hugo: 'Odile / himself' }, mood: { odile: 'dry', hugo: 'light, a little surprised at himself' } }],
  ['ch5.benali', { scene: 'Ch5: Mme Benali at her mural panel', to: 'Hugo', mood: 'chatty, amused at herself' }],
  ['ch5.ines', { scene: 'Ch5: Ines at her lettering panel', to: { ines: 'Hugo', hugo: 'Ines' }, mood: { ines: 'deadpan', hugo: 'curious' } }],
  ['ch5.marco', { scene: 'Ch5: Marco proud of his painted kebab', to: { marco: 'Hugo', hugo: 'Marco' }, mood: { marco: 'proud, a little theatrical', hugo: 'polite' } }],
  ['ch5.shopCard', { scene: 'Ch5: a hand-lettered card in the bike shop window', to: 'himself', mood: 'amused, fond' }],
  ['ch5.boltHoles', { scene: 'Ch5: the bolt holes where the billboard was', to: 'himself', mood: 'wry, reflective' }],
  ['ch5.jobs.shutter', { scene: "Ch5: Mme Benali's stuck bakery shutter", to: 'Hugo', mood: 'chatty, amused' }],
  ['ch5.jobs.radio', { scene: "Ch5: Odile's radio by her chair", to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'deadpan', hugo: 'surprised' } }],
  ['ch5.jobs.radio.stations', { scene: 'Ch5: a voice coming out of an old radio as Hugo tunes it', to: 'listeners', mood: 'broadcast' }],
  ['ch5.jobs.board', { scene: "Ch5: Marco's faded A-board, re-lettered by Hugo", to: 'Hugo', mood: 'proud, theatrical' }],
  ['ch5.jobs.wheel', { scene: "Ch5: Sami brings Ines's bent wheel", to: { sami: 'Hugo / Ines', hugo: 'himself' }, mood: { sami: 'cocky little mechanic', hugo: 'focused' } }],
  ['ch5.teach', { scene: "Ch5: Sami's chain is off; Hugo talks him through it", to: { sami: 'Hugo', hugo: 'Sami' }, mood: { sami: 'eager, then thrilled ("It went ON")', hugo: 'patient, proud' } }],
  ['ch5.panel', { scene: 'Ch5: Odile offers Hugo the billboard spot for his own panel', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'offhand, generous without saying so', hugo: 'quietly pleased' } }],
  ['ch5.line', { scene: 'Ch5: the 20-metre line under everyone\'s panels', to: { odile: 'Hugo', hugo: 'Odile', ines: 'Hugo' }, mood: { odile: 'dry, proud underneath', hugo: 'nervous, then calm', ines: 'deadpan' } }],
  ['ch5.line.end', { scene: 'Ch5: the line is done', to: 'himself', mood: 'calm wonder' }],
  ['ch5.club', { scene: 'Ch5: the run club passes again; Bastien jogs on the spot', to: { bastien: 'Hugo', hugo: 'Bastien' }, mood: { bastien: 'loud, cheerful, breathless; "my shin\'s a bit loud" slips out', hugo: 'calm, kind, gently serious' } }],
  ['ch5.club.afterThoughts', { scene: 'Ch5: Bastien has gone', to: 'himself', mood: 'warm, no judgement' }],
  ['ch5.boot', { scene: 'Ch5: the boot comes off on the bench', to: { odile: 'Hugo', hugo: 'Odile' }, mood: { odile: 'gruff tenderness', hugo: 'light, relieved' } }],
  ['ch5.boot.light', { scene: 'Ch5: the leg out of the boot', to: 'himself', mood: 'wondering, light' }],
  ['ch5.walk', { scene: 'Ch5 finale: golden-hour walk home down the painted street', to: 'himself', mood: 'peaceful, light' }],
  ['ch5.walk.sami', { scene: 'Ch5: Sami rides past on the trued bike', to: { sami: 'Hugo, shouting while riding', hugo: 'Sami, calling after him' }, mood: { sami: 'gleeful, then grudging "fine!"', hugo: 'warning, half laughing' } }],
  ['ch5.walk.outline', { scene: 'Ch5: hanging the watch inside the outline Odile already painted', to: 'himself', mood: 'moved, quiet' }],
  ['ch5.walk.restMenu', { scene: 'Ch5: the watch asks him to move; he chooses rest', to: 'himself', mood: 'calm, settled' }],
  ['ch5.walk.crane', { scene: 'Ch5: final crane shot over the street', to: 'himself', mood: 'serene, the last words of the game' }],
];

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
 * The text tree of one language, as JSON from a fresh Node process: a module that failed to parse stays
 * failed in this process's ESM cache (including '../common.js' imported by the French files), so every
 * retry gets a clean process. The trees are plain data (strings, numbers, booleans, null).
 */
async function loadTree(code, tries = 6) {
  const files = FILES.map((f) => pathToFileURL(path.join(TEXT, code === 'en' ? '' : code, f + '.js')).href);
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
        console.warn(`[voice] loading ${code} text failed (${last.trim()}); retry ${a + 1}/${tries - 1} (another workflow may be mid-edit)`);
        await sleep(1500 * (a + 1));
      }
    }
  }
  throw new Error(`[voice] could not load the ${code} text after ${tries} tries: ${last}`);
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

function main(en, fr) {
  const errors = [];
  const warnings = [];
  const raw = []; // voiced line occurrences
  const unvoiced = []; // [path, reason, text]
  const hugoWho = fr.names?.hugo || 'Hugo';

  const frText = (p, frv, env) => {
    if (typeof frv === 'string') return frv;
    if (frv === undefined && typeof env === 'string') {
      warnings.push(`${p}: no French text (the game shows English here); not voiced`);
      return null;
    }
    return frv;
  };
  const voiced = (o) => {
    if (o.text == null) return;
    if (!o.text.trim()) return errors.push(`${o.path}: empty voiced text`);
    raw.push(o);
  };
  const skip = (p, why, v) => {
    for (const lp of leafPaths(v, p)) unvoiced.push([lp, why, typeof v === 'string' ? v : null]);
  };
  const skipLeaves = (p, enNode, frNode, why) => {
    if (!isObj(enNode)) return unvoiced.push([p, why, typeof frNode === 'string' ? frNode : typeof enNode === 'string' ? enNode : null]);
    for (const [k, v] of Object.entries(enNode)) skipLeaves(`${p}.${k}`, v, frNode?.[k], why);
  };

  // A dialogue line object {who, text, inner?, voicemail?} (d.say) or a bark object {who, text}.
  const lineObj = (p, enL, frL, spec, mode) => {
    const known = new Set(['who', 'text', 'inner', 'voicemail']);
    for (const k of Object.keys(enL)) if (!known.has(k)) errors.push(`${p}.${k}: unexpected key in a line object (rule '${spec._g}')`);
    const text = frText(`${p}.text`, frL?.text, enL.text);
    if (enL.who == null) {
      if (isStage(enL.text)) return skipLeaves(p, enL, frL, 'stage');
      return errors.push(`${p}: line with no speaker that is not a *stage* direction`);
    }
    if (spec.unvoicedWho?.[enL.who]) return skipLeaves(p, enL, frL, spec.unvoicedWho[enL.who]);
    if (isStage(enL.text)) return skipLeaves(p, enL, frL, 'stage');
    let speaker, delivery;
    if (enL.inner) {
      speaker = 'hugo';
      delivery = 'inner';
    } else {
      speaker = WHO[frL?.who] || WHO[enL.who];
      if (!speaker) return errors.push(`${p}: unknown speaker '${frL?.who ?? enL.who}' (add it to WHO/SPEAKERS)`);
      delivery = enL.voicemail ? 'voicemail' : spec.delivery || (mode === 'bark' ? 'bark' : 'spoken');
    }
    voiced({ path: p, text, en: enL.text, speaker, who: enL.inner ? hugoWho : frL?.who ?? enL.who, delivery, use: spec.use, flags: spec.flags });
    for (const k of ['who', 'inner', 'voicemail']) if (k in enL) unvoiced.push([`${p}.${k}`, 'line meta', null]);
  };

  const handlers = {
    none(p, enN, frN, spec) {
      skipLeaves(p, enN, frN, spec.why);
    },
    say(p, enN, frN, spec) {
      const arr = Array.isArray(enN) ? enN : [enN];
      const frArr = Array.isArray(enN) ? frN : [frN];
      arr.forEach((l, i) => {
        const lp = Array.isArray(enN) ? `${p}.${i}` : p;
        if (isObj(l)) lineObj(lp, l, frArr?.[i], spec, 'say');
        else if (l == null) unvoiced.push([lp, 'data', null]);
        else errors.push(`${lp}: plain string in a d.say array (who would say it?)`);
      });
    },
    think(p, enN, frN, spec) {
      const one = (lp, e, f) => {
        if (e == null) return unvoiced.push([lp, 'data', null]);
        if (typeof e !== 'string') return errors.push(`${lp}: expected a thought string`);
        if (isStage(e)) return unvoiced.push([lp, 'stage', f]);
        voiced({ path: lp, text: frText(lp, f, e), en: e, speaker: 'hugo', who: hugoWho, delivery: 'inner', use: spec.use, flags: spec.flags });
      };
      if (Array.isArray(enN)) enN.forEach((e, i) => one(`${p}.${i}`, e, frN?.[i]));
      else if (isObj(enN)) {
        if ('text' in enN) return lineObj(p, { ...enN, inner: true }, frN, spec, 'say');
        for (const [k, e] of Object.entries(enN)) one(`${p}.${k}`, e, frN?.[k]);
      } else one(p, enN, frN);
    },
    bark(p, enN, frN, spec) {
      const walkBark = (lp, e, f, whoEn, whoFr, key) => {
        if (e == null) return unvoiced.push([lp, 'data', null]);
        if (Array.isArray(e)) return e.forEach((x, i) => walkBark(`${lp}.${i}`, x, f?.[i], whoEn, whoFr, key));
        if (isObj(e) && 'text' in e) return lineObj(lp, e, f, spec, 'bark');
        if (isObj(e)) {
          const we = e.who ?? whoEn, wf = f?.who ?? whoFr;
          if ('who' in e) unvoiced.push([`${lp}.who`, 'line meta', null]);
          for (const [k, x] of Object.entries(e)) if (k !== 'who') walkBark(`${lp}.${k}`, x, f?.[k], we, wf, k);
          return;
        }
        if (typeof e !== 'string') return errors.push(`${lp}: unexpected bark value`);
        if (isStage(e)) return unvoiced.push([lp, 'stage', f ?? e]);
        const speaker = spec.speakers?.[key] || spec.speaker || WHO[whoFr] || WHO[whoEn];
        if (!speaker) return errors.push(`${lp}: bark with no resolvable speaker (who='${whoFr ?? whoEn}')`);
        const flags = [...(spec.flags || [])];
        if (spec.notes?.[key]) flags.push('note: ' + spec.notes[key]);
        voiced({ path: lp, text: frText(lp, f, e), en: e, speaker, who: SPEAKERS[speaker].who === 'Radio' ? (whoFr ?? 'Radio') : whoFr ?? whoEn ?? SPEAKERS[speaker].who, delivery: spec.delivery || 'bark', use: spec.use, flags });
      };
      walkBark(p, enN, frN, null, null, p.split('.').pop());
    },
    menu(p, enN, frN, spec) {
      const whoFr = frN?.who ?? enN.who ?? fr.names?.odile ?? 'Odile';
      const speaker = WHO[whoFr] || WHO[enN.who] || 'odile';
      for (const k of Object.keys(enN)) if (!['who', 'prompt', 'options'].includes(k)) errors.push(`${p}.${k}: unexpected key in a correction menu`);
      if ('who' in enN) unvoiced.push([`${p}.who`, 'line meta', null]);
      unvoiced.push([`${p}.prompt`, 'menu prompt', frN?.prompt ?? null]);
      enN.options.forEach((o, i) => {
        const op = `${p}.options.${i}`;
        for (const k of Object.keys(o)) if (!['text', 'correct', 'reply'].includes(k)) errors.push(`${op}.${k}: unexpected key in a menu option`);
        unvoiced.push([`${op}.text`, 'menu label', frN?.options?.[i]?.text ?? null]);
        unvoiced.push([`${op}.correct`, 'data', null]);
        if (o.reply == null) return unvoiced.push([`${op}.reply`, 'data', null]);
        voiced({ path: `${op}.reply`, text: frText(`${op}.reply`, frN?.options?.[i]?.reply, o.reply), en: o.reply, speaker, who: whoFr, delivery: 'spoken', use: spec.use + ' -> reply', flags: [...(spec.flags || []), o.correct ? 'menu-correct' : 'menu-wrong'] });
      });
    },
    choose(p, enN, frN, spec) {
      for (const k of Object.keys(enN)) if (!['prompt', 'options'].includes(k)) errors.push(`${p}.${k}: unexpected key in a choice menu`);
      unvoiced.push([`${p}.prompt`, /^STRIDE/.test(enN.prompt) ? 'notification (watch)' : 'menu prompt', frN?.prompt ?? null]);
      enN.options.forEach((o, i) => {
        const op = `${p}.options.${i}`;
        for (const k of Object.keys(o)) if (!['text', 'reply', 'correct'].includes(k)) errors.push(`${op}.${k}: unexpected key in a choice option`);
        unvoiced.push([`${op}.text`, 'menu label', frN?.options?.[i]?.text ?? null]);
        if ('correct' in o) unvoiced.push([`${op}.correct`, 'data', null]);
        handlers.think(`${op}.reply`, o.reply, frN?.options?.[i]?.reply, { ...spec, use: spec.use + ' -> d.think(reply)' });
      });
    },
  };

  const walk = (p, enN, frN) => {
    const r = p ? ruleFor(p) : null;
    if (r) {
      r.hits++;
      const h = handlers[r.spec.kind];
      if (!h) return errors.push(`${p}: rule '${r.g}' has unknown kind '${r.spec.kind}'`);
      return h(p, enN, frN, { ...r.spec, _g: r.g });
    }
    if (isObj(enN)) {
      for (const [k, v] of Object.entries(enN)) walk(p ? `${p}.${k}` : k, v, frN?.[k]);
      return;
    }
    errors.push(`UNCLASSIFIED ${p} = ${JSON.stringify(frN ?? enN)?.slice(0, 90)}`);
  };
  walk('', en, fr);
  // French keys the English tree does not have: the game drops them (i18n fill() follows the English shape).
  const extra = (p, e, f) => {
    if (!isObj(f)) return;
    for (const [k, v] of Object.entries(f)) {
      const q = p ? `${p}.${k}` : k;
      if (!isObj(e) || !(k in e)) warnings.push(`${q}: French-only key (not in the English tree, unused by the game)`);
      else extra(q, e[k], v);
    }
  };
  extra('', en, fr);
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
        en: o.en,
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
const en = await loadTree('en');
const fr = await loadTree('fr');
const res = build(main(en, fr));
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
