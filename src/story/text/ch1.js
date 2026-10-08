// Ch1 "No Impact": the flat, night (boot day 4). Owned by the Ch1 agent. Source: docs/DESIGN.md.
import { think } from './common.js';

export default {
  title: 'No Impact',
  objectives: { start: 'Look around.', leave: 'Go for a walk.' },
  prompts: {
    tv: 'Watch',
    tvOff: 'Turn it off',
    phone: 'Check phone',
    watch: 'Take the watch',
    xray: 'Look',
    bike: 'Look',
    bibs: 'Look',
    door: 'Go out',
    table: 'Steady it',
    start: '[{KeyE}] Start',
  },

  // Non-blocking, on the first hammer burst (t = 8 s).
  hammer: 'Somebody downstairs is hammering. Nine at night. Same rhythm for an hour. No hurry at all. I sort of hate them.',

  tvTicker: 'STAGE 17 — COL DU GRAND FERRAND',
  tv: [
    {
      who: 'TV',
      text: "...and that's the work done for the domestiques. One by one they peel off the front, empty. Job finished.",
    },
  ],
  tvOff: [
    think('Nobody films them after. They drift back through the team cars and ride down to the bus on their own.'),
  ],

  phone: [
    { who: 'Phone', text: '12 unread.' },
    { who: 'Mum', text: "Are you eating? Don't answer. Just eat." },
    { who: 'STRIDE', text: "Weekly summary: 0.0 km. Let's get back on track!" },
    { who: 'Bastien (Run Club)', text: 'Heard about the leg mate!! Rest up legend. Sunday long run NOT the same without you' },
    {
      who: "Dr Okafor's office",
      text: "Mr Revel, Dr Okafor's office. A reminder that the boot stays on, including in bed, and no impact of any kind for twelve weeks. Dr Okafor asked me to add, and I'm reading this out, 'That includes a little jog to see how it feels.'",
      voicemail: true,
    },
    think("Twelve unread. I'll answer them when I've got something to report."),
  ],

  // REQUIRED. The watch HUD appears after `watch`.
  watch: [think("Still on the charger. Still counting. It doesn't know.")],
  signs: { tvLive: 'LIVE', xrayMark: 'L' },
  watchHud: { face: '0.0 km', label: 'THIS WEEK', lap: 'LAST WEEK 212.4' },
  watchAfter: [
    think('Two hundred and twelve point four. Eleven point two of that on a broken leg.'),
    think('It counted them the same.'),
  ],
  buzz: "TIME TO MOVE! You've been still for 1 hr.",
  buzzReply: [think('Thanks.')],

  xray: [
    think('Dr Okafor circled it in biro. I still had to ask where.'),
    think("He called it 'the dreaded black line'. Then he said sorry, that's just what it's called."),
    think('He said I could swim, if I needed to move. I said I sink. He wrote that down.'),
  ],

  bike: [
    think("Twelve years I kept that chain cleaner than my teeth. Four years on a hook and it's gone orange."),
    think("The doctor says I'm allowed this one. No impact. I told him I've done my twelve years."),
    think("I keep meaning to sell it. But someone would ask what it's won."),
  ],

  bibs: [
    think('Thirty-eight race bibs. I kept every one.'),
    think("I couldn't tell you what a single course looked like. I can tell you every split."),
  ],
  bibCount: 38,

  door: [think('Walk, if you must, he said.'), think('I must.')],

  // Optional, after the phone (the table rocks): the paper shim under its leg.
  table: [think("Sunday's race number. Folded in four, it's exactly the right thickness.")],
  startBuzz: 'START WALK?',
  walkFace: '0.00 km',
  walkLabel: 'WALK',
};
