// HAIRLINE: shared player-facing text (source: docs/DESIGN.md). Core-owned.
//
// Conventions (see DESIGN.md "Text layout"):
//   - Arrays of line objects { who, text, inner?, voicemail? } go to d.say(lines).
//     inner: true = Hugo's inner monologue (italic, no speaker label).
//   - Plain strings go to non-blocking d.thought / ui.thought, watch buzzes, captions, signs.
//   - Barks are { who, bag: [...] } for ui.thought(text, secs, { who }).
//   - Correction menus are { who, prompt, options: [{ text, correct, reply }] } for d.correct.
//   - STRIDE menus are { prompt, options: [{ text, reply }] } for d.choose (reply = inner string | null).

export const NAMES = {
  hugo: 'Hugo',
  odile: 'Odile',
  sami: 'Sami',
  bastien: 'Bastien',
  stride: 'STRIDE',
  dr: 'Dr Okafor',
  ines: 'Ines',
  marco: 'Marco',
  benali: 'Mme Benali',
};

export const hugo = (text) => ({ who: NAMES.hugo, text });
export const think = (text) => ({ who: NAMES.hugo, text, inner: true });
export const odile = (text) => ({ who: NAMES.odile, text });
export const sami = (text) => ({ who: NAMES.sami, text });
export const bastien = (text) => ({ who: NAMES.bastien, text });
export const ines = (text) => ({ who: NAMES.ines, text });
export const marco = (text) => ({ who: NAMES.marco, text });
export const dr = (text) => ({ who: NAMES.dr, text });
/** Stage direction: no speaker, rendered italic via *...*. */
export const stage = (text) => ({ who: null, text: `*${text}*` });

// Canonical notebook entries. Chapters reference these keys, never literal strings.
const ITEMS = {
  ride: 'Ride.',
  run: 'Run.',
  hold: 'Hold still.',
  sand: 'Sand with the grain.',
  measure: 'Measure twice.',
  grey: "Mix a grey that isn't sad.",
  wheel: 'True a wheel.',
  sign: 'Letter a sign.',
  teach: 'Teech.', // Sami's hand, Sami's spelling. Hugo doesn't correct it.
  rest: 'Rest.',
};

export const common = {
  names: NAMES,

  title: {
    name: 'HAIRLINE',
    tagline: 'The crack was thinner than a hair. It went all the way through.',
    begin: 'Click to begin',
    controls: [
      ['WASD / Arrows', 'Move / steady a brush'],
      ['Mouse', 'Look around · R re-centre'],
      ['Shift', 'Try to jog'],
      ['E', 'Interact / advance'],
      ['Space', 'Timing prompts'],
      ['A / D', 'Keep a rhythm'],
      ['1 – 3', 'Choices'],
      ['M', 'Mute'],
      ['Esc', 'Pause'],
    ],
  },

  loading: 'Loading',
  noWebGL: 'This demo needs WebGL.',
  contextLost: 'The graphics context was lost.',
  reload: 'Reload',
  mobile: {
    text: 'HAIRLINE is designed for a keyboard and a larger screen.',
    continue: 'Continue anyway',
  },
  pause: {
    title: 'Paused',
    resume: 'Resume',
    restart: 'Restart chapter',
    options: 'Options',
    escKey: 'ESC', // footer: '{escKey} · {muteHint}'
    muteHint: 'M to mute',
    quality: 'Graphics',
    tiers: { low: 'Low', medium: 'Medium', high: 'High' },
  },
  // Options panel (title screen and pause menu). Language names are native (i18n.js LANGS).
  options: {
    title: 'Options',
    language: 'Language',
    back: 'Back',
  },

  // Small HUD bits ({n} is filled in by the code).
  ui: {
    chapter: 'CHAPTER {n}',
    pain: 'PAIN',
    voicemail: 'VOICEMAIL',
    space: 'SPACE',
    distance: '{n} m',
    interact: 'Interact',
    muted: 'Muted',
    soundOn: 'Sound on',
  },

  opening: [
    'Hugo Revel was a professional cyclist for twelve years.',
    "He never won a race. That wasn't his job.",
    'When it ended, he took up running. Then he kept going.',
    'Last week, he ran 212.4 kilometres.',
    'At kilometre 31 on Sunday, his left shin cracked along a line thinner than a hair.',
    'He finished the race.',
    'This week: 0.0.',
  ],

  // Player stumble lines (ui.thought). `first` is only true on boot day 4 (Ch1/Ch2);
  // Ch4/Ch5 set player.firstStumbleDone = true so they draw from the bag.
  stumble: {
    first: 'Twelve weeks. This is day four.',
    bag: [
      "Bone doesn't negotiate.",
      'This boot weighs more than my race wheels.',
      'Thinner than a hair. Still wins.',
      "Twelve weeks is eighty-four days. I've done the maths. Twice.",
      'I know. I *know*.',
    ],
  },

  hints: {
    jog: 'Hold Shift to jog',
    rhythm: 'Alternate A and D. Steady, not fast.',
    sand: 'Alternate A and D. Steady.',
    steer: 'The brush follows the chalk. WASD: small corrections only',
    steerLine: 'W / S to steady the brush',
    still: "Don't touch anything",
    space: 'Space',
  },

  // GPS watch HUD (ui.watch / ui.watchBuzz). Docked bottom-right.
  watch: {
    unit: 'km',
    zero: '0.0 km',
    labels: {
      week: 'THIS WEEK',
      run: 'RUN · THIS WEEK', // Ch4/Ch5: true while he walks everywhere
      walk: 'WALK',
      race: 'RACE',
      last: 'LAST WEEK',
    },
    // Seeded by the Director at each chapter start (index = chapter 0..4). null = hidden.
    atChapter: [
      null, // Ch1: appears when he takes it off the charger
      { face: '0.32 km', label: 'WALK', lap: '38:40' },
      { face: '0.0 km', label: 'THIS WEEK', lap: null },
      { face: '0.0 km', label: 'RUN · THIS WEEK', lap: null },
      { face: '0.0 km', label: 'RUN · THIS WEEK', lap: null },
    ],
  },

  // "WHAT I CAN DO" notebook HUD (ui.notebook). Docked top-right.
  notebook: {
    heading: 'WHAT I CAN DO',
    items: ITEMS,
    someSundays: '(some Sundays)',
    // Seeded by the Director at each chapter start. null = hidden (created in Ch4 Day 5).
    atChapter: [
      null,
      null,
      null,
      null,
      [
        { text: ITEMS.ride, struck: true },
        { text: ITEMS.run, struck: true },
        { text: ITEMS.hold },
        { text: ITEMS.sand },
        { text: ITEMS.measure },
        { text: ITEMS.grey },
        { text: ITEMS.wheel },
        { text: ITEMS.sign },
      ],
    ],
    // For reference / verification: the list as it stands at the very end.
    final: [
      { text: ITEMS.ride },
      { text: ITEMS.run, note: '(some Sundays)' },
      { text: ITEMS.hold },
      { text: ITEMS.sand },
      { text: ITEMS.measure },
      { text: ITEMS.grey },
      { text: ITEMS.wheel },
      { text: ITEMS.sign },
      { text: ITEMS.teach, hand: 'sami' },
      { text: ITEMS.rest },
    ],
  },

  ending: {
    lines: [
      'Rue des Tanneurs never got another billboard.',
      "Sami Haddad fixes punctures. Two euros, or free if you'll learn.",
      "Odile's radio gets four stations now. She listens to the fishing one.",
      'Odile Marchal\'s list got one line longer that year. It says "Ask."',
      'Hugo Revel runs some Sundays. Nobody knows how far, including him.',
      "His watch hangs on a nail above the workbench. It thinks he's been resting for a year.",
    ],
    bigs: ['212.4 km'],
    hairline: true,
    hairlineColor: '#d9a441',
    thanks: 'Thank you for playing.',
    playAgain: 'Play again',
    credits:
      'Characters and animations: Quaternius. Props, materials and HDRIs: Poly Haven, ambientCG. Street pieces and footsteps: Kenney. Music and ambience: OpenGameArt. All CC0.',
  },
};

export default common;
