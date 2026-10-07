// Ch5 "The Wall": Rue des Tanneurs, day, then golden hour (Week 12). Owned by the Ch5 agent.
// Source: docs/DESIGN.md. Street signs shared with Ch2 live in L.ch2.signs.
import { think, hugo, odile, sami, bastien, ines, marco } from './common.js';

export default {
  title: 'The Wall',
  objectives: {
    start: 'Find Odile.',
    sami: 'Help Sami.',
    line: 'Paint the line.',
    boot: 'Sit on the bench.',
    walk: 'Walk home.',
    watch: 'Hang up the watch.',
  },
  prompts: {
    odile: 'Ready',
    sami: 'Help',
    bench: 'Sit',
    strap: '[E] Strap',
    wave: '[E] Wave',
    watch: 'Take the watch off',
    benali: 'Talk',
    ines: 'Talk',
    marco: 'Talk',
    shopCard: 'Look',
    boltHoles: 'Look',
  },

  signs: {
    shopCard: 'PUNCTURES FIXED — ASK AT No. 14',
    open: 'OPEN', // fallback if minigames.memory.openSign is missing
    initials: 'H.R.',
    marcoPanel: ['GREAT', 'KEBAB'], // painted either side of Marco's kebab
    sketch: '20 m — measure twice', // Odile's chalk-blue plan on the workbench
    rest: 'rest', // painted under the watch outline by the nail
    // Mural panels, along the wall from z -12 to -32 (bakery end to kebab end).
    panels: [
      { id: 'benali', label: 'a croissant that came out a moon', color: '#e8c27a' },
      { id: 'ines', label: "Ines's lettering", color: '#c24a6a' },
      { id: 'sami', label: "Sami's bike", color: '#c24a3a' },
      { id: 'odile', label: "Odile's chalk hand", color: '#9a7a4e' },
      { id: 'marco', label: 'a great kebab', color: '#d98a3a' },
    ],
  },

  opening: [
    odile("There you are. You're late."),
    hugo('I walked the long way. It was nice.'),
    think("Nice. I said 'nice' about a walk. Out loud."),
  ],

  // Optional (SHOULD).
  benali: [{ who: 'Mme Benali', text: "I wanted to paint a croissant. It's come out a moon. I've decided it's a moon." }],
  ines: [
    ines("I tagged this wall eight times. First time anyone's *handed* me the paint."),
    hugo('How does it feel?'),
    ines('Weird. Legal.'),
  ],
  marco: [
    marco('Odile said paint what you can do. I do a very good kebab. So.'),
    hugo("That's a good kebab."),
    marco("It's a *great* kebab."),
  ],
  shopCard: [think("Sami's handwriting. My spelling.")],
  boltHoles: [think('The watch told me to rest. The billboard told me never stop. I listened to the bigger one.')],

  // ------------------------------------------------------------ Teach
  teach: {
    call: [sami("Hugo! It's off again!")],
    menu: {
      who: 'Sami',
      prompt: "The chain's off the front ring. His hands are already black.",
      options: [
        { text: "Give it here, I'll do it.", correct: false, reply: "You always do it. Then it comes off when you're not here." },
        { text: 'Kick it. Firmly.', correct: false, reply: "That's how Odile fixes the radio. The radio's still broken." },
        {
          text: 'Hook it on the bottom of the ring. Turn the pedal backwards. Slowly.',
          correct: true,
          reply: '...It went on. It went *on*. Did you see?',
        },
      ],
    },
    after: [
      hugo('I saw.'),
      sami("What's this?"),
      hugo('A list.'),
      { who: null, text: '*Sami reads it, licks the pencil, and writes something.*' },
      sami('You forgot one.'),
    ],
    // Notebook: add L.notebook.items.teach with { hand: 'sami' }.
  },

  // ------------------------------------------------------------ The line
  line: {
    setup: [
      odile("Everybody's painted what they can do. Your line goes under all of it. Bakery to kebab shop."),
      hugo('One line.'),
      odile("Twenty metres. I measured twice. Don't stop halfway to admire it."),
      hugo('What if it wobbles?'),
      odile('Go on, then.'),
    ],
    gauge: 'LINE',
    color: '#d9a441',
    end: [think("Twenty metres. I didn't time it.")],
    tiers: {
      good: [odile("That's a hairline. Near enough.")],
      middle: [odile("It's a line a person made.")],
      poor: [odile("It's a line a person made in a boot. Same thing, louder.")],
    },
    sign: [odile('Sign it.'), hugo('Small?'), odile("You're learning.")],
    photo: [ines('Stand in front of it.'), hugo('Of the wall?'), ines("Of you. In front of the wall. That's how photos work.")],
  },

  // ------------------------------------------------------------ Run club
  club: {
    greet: [bastien("HUGO! Arts and crafts! Boot's off soon, yeah? We'll have you back on two hundred a week!")],
    // [E] Wave, then:
    after: [
      hugo('Maybe twenty.'),
      bastien('A day?'),
      hugo('A week.'),
      bastien("...Is that allowed? My shin's a bit loud, actually. Everyone's is, though!"),
      hugo('Get it looked at.'),
      bastien('Ha! After Sunday!'),
    ],
    // After he fades out.
    afterThoughts: [think("He jogged on the spot the whole time, so his watch wouldn't pause."), think('Good for him.')],
  },

  // ------------------------------------------------------------ The boot
  boot: {
    ask: [
      odile("It's today, isn't it. The boot."),
      hugo("Scan this morning. Dr Okafor said 'boring'. Best thing a doctor's ever said to me."),
      odile("Twelve weeks from the Sunday. I counted. You're not the only one on this street who can count."),
      odile("Sit. I've got a hacksaw if the Velcro argues."),
    ],
    light: [think("The leg felt light. Like it didn't know what it was for yet.")],
    walk: [odile("Once round the block, then home. It'll work it out.")],
  },

  // ------------------------------------------------------------ Final walk
  walk: {
    // Non-blocking barks in order, as Sami rides past.
    sami: [
      { who: 'Sami', text: "Hugo! It doesn't even rub!" },
      { who: 'Hugo', text: 'Hands on the bars!' },
      { who: 'Sami', text: '...*Fine!*' },
    ],
    firstJog: "Easy. Easy's a speed.",
    stopped: 'I stopped. Nobody made me. Put that on the record too.',
    mural: "My line runs under everyone's panels, holding them up a bit.",
    bike: 'Four years on a hook. It took an afternoon and a toothbrush.',
    watchHud: { face: '0.0 km', label: 'RUN · THIS WEEK', lap: null },
    outline: [think("She'd already painted the outline.")],
    restMenu: {
      prompt: 'STRIDE: No movement detected. TIME TO MOVE?',
      options: [
        { text: 'Move', reply: '...No. Rest.' },
        { text: 'Rest', reply: null },
      ],
    },
    // Notebook finale: strike(ride,false), strike(run,false), annotate(run, someSundays), add(rest).
    crane: [
      think("Two hundred and twelve point four kilometres. I can't remember a metre of it."),
      think('Twenty metres of line. It wobbles at the kebab shop. I remember all of it.'),
    ],
  },
};
