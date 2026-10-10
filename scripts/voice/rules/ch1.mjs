// Voice rules and voice-direction context for Ch1 « Sans impact » (src/story/ch1.js).
// Read by scripts/voice/extract-lines.mjs (rule syntax and kinds: see the table comment there). The chapter's
// builder owns this file: add a rule for every new text key, or extract-lines reports it as UNCLASSIFIED.

export const RULES = [
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
    unvoicedWho: { 'Téléphone': 'notification (phone screen)', Maman: 'sms', STRIDE: 'notification (app)', 'Bastien (club)': 'sms' },
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
  ['ch1.keys', { kind: 'say', use: "look('keys', L.ch1.keys) -> d.say (then item+ keys)" }],
  ['ch1.needs.door', { kind: 'say', use: 'door hotspot needsLine (Hotspots -> d.say) when the keys are not in the pocket' }],
  ['ch1.window', { kind: 'say', use: "look('window', L.ch1.window) -> d.say (optional; seeds.window)" }],
  ['ch1.startBuzz', { kind: 'none', why: 'watch' }],
  ['ch1.walkFace', { kind: 'none', why: 'watch' }],
  ['ch1.walkLabel', { kind: 'none', why: 'watch' }],
];

// Longest-prefix match on the key path; to / mood can be per speaker. English: direction for the voice model.
export const CONTEXT = [
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
  ['ch1.keys', { scene: 'Ch1: three keys in a bowl by the door; nobody remembers what the third one opens', to: 'himself', mood: 'dry, mildly puzzled; the second line a small private joke' }],
  ['ch1.needs.door', { scene: 'Ch1: at the door without his keys', to: 'himself', mood: 'self-mocking' }],
  ['ch1.window', { scene: 'Ch1: at the rainy window, remembering last night at 3 a.m.: someone pushing a bike, a worn freewheel clicking', to: 'himself', mood: 'flat, tired; let the three clics land slowly; the last line quiet' }],
  ['ch1.table', { scene: "Ch1: he wedges the wobbly table with Sunday's race number", to: 'himself', mood: 'dark, wry' }],
];
