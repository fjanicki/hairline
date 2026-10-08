// Ch3 "The Long Run": flashback. Owned by the Ch3 agent. Source: docs/DESIGN.md.
// Week totals: 104.2 / 168.0 / 170.2 (Saturday). The race adds 42.2 -> 212.4.
import { think, odile, hugo, dr } from './common.js';

export default {
  title: 'The Long Run',
  signs: { bakery: 'BOULANGERIE' },
  objectives: { run: 'Keep it steady.', finish: 'Finish.' },
  keys: { both: '[{KeyA} / {KeyD}]', a: '[{KeyA}]', d: '[{KeyD}]' }, // layout-aware tokens
  gauge: { label: 'CADENCE', unit: 'spm', scale: 60 },

  // Non-blocking feedback from minigames.rhythm.
  cadence: {
    mash: "Easy. It's a long way.",
    low: "Don't let it drop.",
    steady: "There. That's the stuff.",
  },

  weekLabel: 'THIS WEEK',

  // Three training blocks. `thoughts` keys are metres into the segment.
  weeks: [
    {
      caption: 'TRAINING BLOCK — WEEK 9 — 5:12 AM — THE LOOP',
      length: 60,
      total: 104.2,
      thoughts: {
        15: "Cycling was other people's races. This one's mine. Every metre of it.",
        33: "At fifteen I built my own wheels. I could hear a slack spoke from the kitchen.",
        55: 'Only other light on at this hour is the bakery. I beat it every morning.',
      },
      stride: {
        prompt: 'STRIDE: Six days in a row! Recovery is part of training. Take a rest day?',
        options: [
          { text: 'Rest day', reply: 'Rest day. Good idea. Tomorrow.' },
          { text: 'Easy 10 km', reply: 'An easy ten. Easy is a state of mind.' },
          { text: 'Dismiss', reply: 'Dismissed.' },
        ],
      },
    },
    {
      caption: 'TRAINING BLOCK — WEEK 20 — 5:04 AM — THE LOOP, TWICE',
      length: 40,
      total: 168.0,
      thoughts: {
        10: "There's a spot on the shin the size of a coin. I don't press it. If I don't press it, it isn't there.",
        30: "Everybody's shin is a bit loud. Bastien says.",
      },
      stride: {
        prompt: 'STRIDE: Training load HIGH. Your body needs rest.',
        options: [
          { text: 'Rest (tomorrow)', reply: 'I said tomorrow. I meant it at the time.' },
          { text: 'Run', reply: null },
          { text: 'Run anyway', reply: 'Anyway. My favourite pace.' },
        ],
      },
    },
    {
      caption: 'TRAINING BLOCK — WEEK 31 — SATURDAY, 4:47 AM — THE LOOP, THREE TIMES',
      length: 40,
      total: 170.2,
      thoughts: {
        10: 'Two ibuprofen. The stairs. The long way round.',
        30: 'When it hurts, I count. Counting is a painkiller, if you do enough of it.',
      },
      stride: {
        prompt: 'STRIDE: Race day tomorrow! Taper complete?',
        options: [
          { text: 'Yes', reply: ['Yes.', "It's not lying if it's a watch."] },
          { text: 'Rest (after Sunday)', reply: 'Rest after Sunday. I was very firm about that.' },
          { text: 'Snooze', reply: 'Snooze. Story of the year.' },
        ],
      },
    },
  ],

  sunday: ['Sunday.'],

  race: {
    caption: 'STRIDE CITY MARATHON — KM 29',
    label: 'RACE',
    faceStart: 29.0,
    boards: ['KM 29', 'KM 30', 'KM 31'],
    banners: ['STRIDE', 'NEVER STOP', 'STRIDE CITY MARATHON'],
    thoughts: {
      km30: 'Thirty. This is where they say the wall is.',
      km30plus: "I've never hit the wall. Not once. I was very proud of that.", // 12 m past KM 30
    },
  },

  // Card, bg 'clear', italic.
  crack: [
    "It wasn't loud. It sounded like a pencil lead going, somewhere inside a drawer.",
    'I remember thinking: only eleven more.',
  ],

  // Guaranteed at 3 s into the limp.
  keepGoing: 'I could have stopped. I want that on the record. I could have stopped.',

  // Over black: ui.watch(..., { over: true }).
  finish: {
    face: '42.2 km',
    lap: '3:04:51',
    buzz: 'GREAT EFFORT!',
    weekLabel: 'THIS WEEK',
    weekFrom: 170.2,
    weekTo: 212.4,
  },

  doctor: [dr('See that? No. There.'), dr("It's thinner than a hair, Mr Revel. But it goes all the way through.")],

  present: [
    odile('Well? How far?'),
    hugo('Two hundred and twelve point four.'),
    odile('In a week?'),
    hugo('In a week.'),
    odile('Where were you going?'),
    hugo('...It was a loop.'),
  ],
};

// Convenience: think() lines for STRIDE replies that are arrays.
export const strideReply = (r) => (r == null ? null : (Array.isArray(r) ? r : [r]).map(think));
