// Voice rules and voice-direction context for Ch3 « À la longue » (src/story/ch3.js).
// Read by scripts/voice/extract-lines.mjs (rule syntax and kinds: see the table comment there). The chapter's
// builder owns this file: add a rule for every new text key, or extract-lines reports it as UNCLASSIFIED.

export const RULES = [
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
];

// Longest-prefix match on the key path; to / mood can be per speaker. English: direction for the voice model.
export const CONTEXT = [
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
];
