// Ch5 "The Wall": Rue des Tanneurs, day, then golden hour (Week 12). Owned by the Ch5 agent.
// Source: docs/DESIGN.md. Street signs shared with Ch2 live in L.ch2.signs.
import { think, hugo, odile, sami, bastien, ines, marco, stage } from './common.js';

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
    strap: '[{KeyE}] Strap',
    wave: '[{KeyE}] Wave',
    watch: 'Take the watch off',
    benali: 'Talk',
    ines: 'Talk',
    marco: 'Talk',
    shopCard: 'Look',
    boltHoles: 'Look',
    // Street jobs (optional).
    shutter: 'Fix the shutter',
    radio: 'Tune it',
    board: 'Re-letter it',
    inesBike: 'Look at the wheel',
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
    odile("Half this street's stuck, bent, faded or buzzing. Before your line, if your hands get bored."),
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

  // ------------------------------------------------------------ Street jobs (optional, before the line)
  jobs: {
    shutter: {
      near: { who: 'Mme Benali', text: 'It sticks halfway every morning. I open half a bakery.' },
      // Called from up the street after Teach, if he's far off and it's still stuck.
      call: { who: 'Mme Benali', text: "Hugo! When you've a minute. My shutter's stuck again." },
      gauge: 'RUNNERS',
      mash: { who: 'Mme Benali', text: "Gently. It's older than me." },
      done: [{ who: 'Mme Benali', text: "It went up. Now I'll have to be nice to people all morning." }],
    },
    radio: {
      near: odile('It still only gets the fishing.'),
      hint: '{KeyA} / {KeyD} or drag to turn the dial',
      stations: {
        who: 'Radio',
        fishing: "...and the pike, you see, the pike doesn't care about your feelings...",
        music: '*Music. Slow, a bit scratched.*',
        football: '...two-nil, and nobody here can quite believe it...',
        forecast: '...Pas-de-Calais, westerly four or five, rain later, good...',
      },
      done: [
        odile("Four stations. I've had the fishing man since the franc."),
        hugo('Fishing?'),
        odile('Leave it on the music. The fish can wait.'),
      ],
    },
    board: {
      near: marco("My board's so faded people think we're shut."),
      word: 'KEBAB', // as-is signage, same in every language
      tiers: {
        good: [marco("Now that's a great kebab sign.")],
        middle: [marco("It's got character. Like the kebab.")],
        poor: [marco("It's a bit drunk. So are half my customers, after midnight.")],
      },
    },
    wheel: {
      near: sami('Ines bent her wheel on a kerb. I do punctures. Bends are you.'),
      // trueWheel's text (hint, gauge and pitch words come from L.ch4.week4.truing).
      truing: {
        flat: "There. That one's off.",
        barks: {
          who: 'Sami',
          clunk: "Clunk's bad. I know clunk now.",
          hitting: "You're just hitting it now.",
          notFixed: 'Not fixed. I can hear it.',
          ping: 'That one went ping. Is ping good this time?',
          higher: "It's getting higher.",
        },
        assisted: sami("...Fixed. I'm saying I helped."),
      },
      done: sami('Ines! Your wheel sings now!'),
    },
  },

  // Odile, once, at the first "Ready" while a street job is still open (Ready closes them).
  readyCheck: {
    who: 'Odile',
    prompt: "Nobody's timing you.",
    options: [{ text: 'Ready.', correct: true }, { text: 'Not yet.' }],
  },

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

  // ------------------------------------------------------------ Hugo's panel (inside 'Ready', before the line)
  panel: {
    ask: [
      odile('One thing first. Up there, where the billboard was. Nobody wanted it.'),
      hugo("So it's mine."),
      odile('Paint something you can do. Small, if you like.'),
    ],
    // Options in motif order: wheel, door, hand (a skip picks the door).
    menu: {
      prompt: 'Something off the list.',
      options: [
        { text: 'A wheel. True.', reply: null },
        { text: 'The door. That grey.', reply: null },
        { text: 'A hand, holding a brush still.', reply: null },
      ],
    },
    stage: [stage("Odile holds the ladder. Both hands. She doesn't help.")],
    after: {
      wheel: [odile("A wheel. Sami's going to say it's his.")],
      door: [odile("My door. Higher up than I'd have hung it.")],
      hand: [odile('Steady hand. Show-off.')],
    },
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
