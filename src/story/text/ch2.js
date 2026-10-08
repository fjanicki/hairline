// Ch2 "Never Stop": Rue des Tanneurs, late evening, rain. Owned by the Ch2 agent. Source: docs/DESIGN.md.
// scene2.js also builds the Ch5 'wall' variant, so `signs` here are shared with Ch5.
import { think, hugo, odile, bastien } from './common.js';

export default {
  title: 'Never Stop',
  objectives: { start: 'Walk.', hold: 'Hold the scaffold.' },
  prompts: {
    ghost: 'Look',
    billboard: 'Look up',
    shop: 'Look',
    bench: 'Sit',
    stand: 'Stand',
  },

  signs: {
    billboard: 'STRIDE — NEVER STOP',
    ghost: 'MARCHAL & FILLE — ENSEIGNES — DORURE',
    shop: 'CYCLES DURAND — CLOSED — THANK YOU FOR 52 YEARS',
    kebab: "MARCO'S",
    bakery: 'BOULANGERIE BENALI',
    number: 'No. 14',
    fasciaStart: 'RÉPARATI',
    fascia: 'RÉPARATIONS.',
  },

  // Watch: seeded from L.watch.atChapter[1]. The lap is derived from progress along z.
  lapStart: '38:40',
  lapEnd: '41:10',

  // Non-blocking, at chapter start.
  start: 'Thirty-eight minutes. Three hundred and twenty metres. Three flights of stairs, one at a time, in a boot.',

  // z < -6
  pauseBuzz: 'PACE TOO SLOW TO RECORD. PAUSE ACTIVITY?',
  pauseReply: 'No.',

  ghost: [
    think("Somebody painted that by hand, before I was born. The shop's long gone. The letters didn't get the message."),
  ],
  // Non-blocking, if he stays put by the ghost sign after `ghost`.
  ghostLinger: "The thin strokes have lasted best. You'd think it'd be the other way round.",
  billboard: [think('Never stop. I took it as advice. It was a slogan for a shoe.')],

  // z < -24
  club: [
    bastien("Hugo! Mate! How's the leg?"),
    hugo('Stress fracture.'),
    bastien('The classic! Too many kilometres, eh?'),
    hugo('Is there another kind?'),
    bastien("Ha! Rest up, legend. The leaderboard's boring without you."),
  ],
  // After Bastien fades out at z -46.
  clubAfter: [
    think("He jogged on the spot the whole time, so his watch wouldn't pause."),
    think("I'd have done the same. I'd have done exactly the same."),
  ],

  shop: [
    think("Fifty-two years and they got a thank-you sign. When I retired, the team sent a fruit basket. The card said 'Hugh'."),
  ],
  bench: [think("Wet bench, in the dark. If the club comes back, I'm stretching.")],

  // z < -42
  arrivalLoop: [think('Once round the block. Forty-one minutes. Back where I started.')],
  arrival: [
    odile('You. In the boot.'),
    hugo('Me?'),
    odile("No, the other man in a boot. The wheel lock's gone. Hold the scaffold before I come down faster than I'd like."),
    odile('Can you stand still?'),
    think('Honestly? Not since I was nineteen.'),
  ],

  // HOLD STILL minigame.
  hold: {
    gauge: 'STILL',
    barks: {
      who: 'Odile',
      bag: ['Still.', 'Stiller.', "You're a lamppost. Lampposts don't fidget.", "I'm doing an S up here. Esses are personal."],
    },
    buzz: 'TIME TO MOVE!',
    buzzReply: 'Not now.',
  },

  after: [
    odile("Réparations. Eleven letters and a full stop. You're a decent lamppost."),
    odile("You're third floor. Four every morning, down the stairs like a dropped wardrobe."),
    hugo('I was going running. Twice on Sundays.'),
    odile('Hm.'),
    { who: null, text: '*She looks at the boot for a long moment.*' },
    odile("I've got a door in there that needs stripping back. And you've got, by the look of you, nothing to do."),
    hugo("I've got plenty to do."),
    odile('Name one thing.'),
  ],

  nameOne: {
    who: 'Odile',
    prompt: 'Name one thing.',
    options: [
      { text: 'Physio. Ankle circles, three by twenty.', correct: false, reply: "That's not a thing to do. That's a thing to count." },
      { text: "Training. I've got a plan.", correct: false, reply: "In that boot? What's the plan, aggressive sitting?" },
      { text: '...Nothing.', correct: true, reply: "Ten o'clock tomorrow. Bring your own coffee. Mine's a crime." },
    ],
  },

  leaving: [
    odile('What did you do to it? The leg.'),
    hugo("Nothing. That's the stupid part. Nothing happened. I just ran."),
    odile('How far?'),
  ],
  howFarLap: 'LAST WEEK 212.4', // watch lap line during "How far?"
  flare: '#c6f432', // ui.watchFocus(true, { flare }) before the cut to white
};
