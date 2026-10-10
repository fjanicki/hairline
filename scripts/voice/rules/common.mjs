// Voice rules and voice-direction context for common text (text/common.js) and the pocket (text/items.js).
// Read by scripts/voice/extract-lines.mjs (rule syntax and kinds: see the table comment there). The chapter's
// builder owns this file: add a rule for every new text key, or extract-lines reports it as UNCLASSIFIED.

const UI_ = { kind: 'none', why: 'ui' };

export const RULES = [
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

  // ---------------------------------------------------------------- items (text/items.js; story/items.js, world/Hotspots.js)
  ['items.ui.**', { kind: 'none', why: 'ui' }],
  ['items.hints.**', { kind: 'none', why: 'hint' }],
  ['items.people.**', { kind: 'none', why: 'ui', use: 'toast labels' }],
  ['items.atChapter', { kind: 'none', why: 'data' }],
  ['items.*.name', { kind: 'none', why: 'ui' }], ['items.*.def', { kind: 'none', why: 'ui' }], ['items.*.desc', { kind: 'none', why: 'ui' }],
  ['items.refuse.watch', { kind: 'descend' }],
  ['items.refuse.watch.buzz', { kind: 'none', why: 'watch' }],
  ['items.refuse.watch.think', { kind: 'think', use: 'items.js: the watch used on anything -> d.say(think(...))' }],
  ['items.refuse.*', { kind: 'bag', use: 'items.js refusal: d.say(entry) (a string is Hugo inner)', flags: ['selected-at-runtime'] }],
  ['items.give.*.*', { kind: 'bag', use: 'items.js gift reply: d.say(L.items.give.<item>.<person>)', flags: ['selected-at-runtime'] }],
  ['items.needs.*', { kind: 'bag', use: 'items.js needs line: d.say(entry)' }],
];

// Longest-prefix match on the key path; to / mood can be per speaker. English: direction for the voice model.
export const CONTEXT = [
  ['stumble', { scene: 'Hugo stumbles in his walking boot; a spike of pain', to: 'himself', mood: 'wry, through gritted teeth, tired' }],
];
