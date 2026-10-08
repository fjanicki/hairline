// Ch4 "Measure Twice": the workshop, Day 5 to Week 7 in the boot. Owned by the Ch4 agent.
// Source: docs/DESIGN.md. Notebook entries come from L.notebook.items (sand, measure, ...).
import { think, hugo, odile, sami, stage } from './common.js';

export default {
  title: 'Measure Twice',
  cards: {
    day5: ['Day 5.'],
    day8: ['Day 8.'],
    week4: ['Week 4.'],
    week7: ['Week 7.'],
    week12: ['Week 12.'], // closes the chapter
  },
  objectives: {
    day5: 'Get the sandpaper.',
    sand: 'Sand the door.',
    day8: 'Measure the frame.',
    week4: 'Look at the bike.',
    week7: 'See what Odile is doing.',
  },
  prompts: {
    pegboard: 'Get the sandpaper',
    door: 'Sand',
    frame: 'Measure',
    bike: 'Look at it',
    bench: 'Watch',
    oldSigns: 'Look',
    radio: 'Listen',
  },

  signs: {
    old: ['MARCHAL & FILLE', 'CAFÉ DU NORD', "DÉFENSE D'AFFICHER"],
    open: 'OPEN',
    initials: 'H.R.',
  },

  // Optional, every day.
  oldSigns: [
    hugo('Marchal and daughter.'),
    odile("Daughter's me. My father did the big letters, I did the hairlines. Then he died and I did both."),
  ],
  radio: [odile("It gets one station. It's a man talking about fishing. I've learned a great deal about fishing.")],

  // ------------------------------------------------------------ Day 5
  day5: {
    arrive: [
      odile("You're early."),
      hugo('I was up at four. I had the shoes on before I remembered.'),
      odile('Shoe.'),
      hugo('...Shoe.'),
    ],
    book: [
      stage('She hands him a pencil and a school exercise book.'),
      odile('Everyone who works here writes down what they can do. First day. So that later, they can see it wasn\'t always there.'),
      hugo('How many people have worked here?'),
      odile("Before you? Two. Me and my father. He wrote 'everything' and underlined it. He was a liar."),
    ],
    // Notebook: add ride, run.
    strike: [
      odile('Can you do either of those this month?'),
      hugo('...No.'),
      odile("Then put a line through them. Lightly. It's a pencil, not a tattoo."),
    ],
    // Notebook: strike ride, run.
    strikeThink: [think('Thirty-seven years. Two words. Both crossed out by ten past ten. Efficient, at least.')],
    holdStill: [odile('You can stand still. I watched you do it. Write it down.')],
    // Notebook: add hold.
    door: [odile("Now the door. Nine coats of paint on it. I want to see wood by lunch. Sandpaper's on the board.")],
    pegboard: [
      think("Every tool's got its outline painted on the board, so you can see what's missing."),
      think('My training log was like that. Every rest day, a gap I had to look at.'),
    ],
    grain: [odile("With the grain, the long way. Don't press. Let the paper do it.")],
    after: [
      odile("You've done this before."),
      hugo('Something like it. About fifty million times. I worked it out once. On a rest day.'),
      odile("Write it down. If you can do it, it goes on the list. That's the only rule."),
    ],
    // Notebook: add sand.
  },

  sanding: {
    gauge: 'SANDING',
    hint: 'Steady. Or hold the mouse button and drag back and forth.',
    barks: {
      who: 'Odile',
      mash: ["You're not sanding it, you're arguing with it.", "Slower. That wood's been here longer than you."],
      cross: 'With the grain. Like stroking a cat, not starting a fight.',
    },
    buzz: 'ROWING DETECTED. START WORKOUT?',
    buzzReply: 'No.',
  },

  // ------------------------------------------------------------ Day 8
  day8: {
    start: [odile("Door goes back in the frame. It's eighty-two wide. Measure the frame.")],
    // Measure twice, with the tape (crafts/tape.js). Readings 80.5 .. 82.5 cm, index (cm - 80.5) / 0.5.
    tape: {
      hint: 'Hold {Space} or the mouse button to pull. Let go at the jamb.',
      readings: [
        hugo('Eighty and a half.'),
        hugo('Eighty-one.'),
        hugo('Eighty-one and a half.'),
        hugo('Eighty-two.'),
        hugo('Eighty-two and a half.'),
      ],
      again: [
        hugo('...Eighty and a half.'),
        hugo('...Eighty-one.'),
        hugo('...Eighty-one and a half.'),
        hugo('...Eighty-two.'),
        hugo('...Eighty-two and a half.'),
      ],
      twice: [odile('Measure twice.'), hugo('Again?'), odile('Yes.')],
      differ: [
        odile("Two numbers. The frame's only got one."),
        odile('One of those is lying. Possibly both.'),
        odile("Again. The frame's not going anywhere."),
      ],
      short: odile("That's not the frame, that's air."),
      help: [odile("Hold still. I'll hold the end.")],
      cut: [
        odile("Doors lie. Frames lie worse. So a centimetre and a half comes off the hinge side. Plane's on the wall."),
        odile("Doors lie. Frames lie worse. So a centimetre comes off the hinge side. Plane's on the wall."),
        odile("Doors lie. Frames lie worse. So half a centimetre comes off the hinge side. Plane's on the wall."),
        odile("Doors lie. Frames lie worse. This one's telling the truth, apparently. Hang it as it is."),
        odile("Doors lie. Frames lie worse. Half a centimetre of air on the hinge side. We'll call it ventilation."),
      ],
    },
    // Notebook: add measure.
    grey: [odile('Now. Colour. I want a grey.'), hugo('Easy.'), odile("A grey that isn't sad.")],
    // The colour toy (crafts/mixer.js): tins in key order 1-5.
    mixer: {
      intro: [stage('Five tins: white, black, ochre, blue, red oxide. One pot.')],
      tins: ['White', 'Black', 'Ochre', 'Blue', 'Red oxide'],
      hint: '1 – 5 or click a tin: one drop · {KeyT} tip it out · {KeyE} done',
      tip: 'Tip it out',
      done: 'Done',
      full: odile("Pot's full. It's not a bath."),
      verdicts: {
        waiting: [odile("That's not a grey. That's a waiting room.")],
        light: [odile("Now it's a sad grey pretending to be fine. I know the type.")],
        dark: [odile("That's a funeral. It's a door, not a hearse.")],
        ochre: [odile("That's not grey. That's custard.")],
        blue: [odile("Too cold. That grey's waiting for a bus.")],
        red: [odile("That's gone pink. A pink door. The street would talk.")],
        mud: [odile("That's mud. Honest mud, but mud. Tip it out.")],
        target: [odile("...There. Now it's a grey that's been somewhere.")],
      },
      hints: [
        odile('White first. Then black, a drop at a time. Like gossip.'),
        odile('Five white, one black. Two ochre. One blue, to calm it down.'),
      ],
      // Instead of hints[0] when he's already got a plain grey (waiting / light).
      warm: odile("The grey's there. Now a drop of ochre. Warm, not yellow."),
      give: [odile('Give it here.'), stage('She tips it out and does it in four moves, without looking.')],
    },
    // Stage beat after the first "I know the type" verdict (she looks at him).
    greyLook: stage('She looks at him while she says it.'),
    paintColor: '#8d877c',
    painted: [think("It's grey. I'd swear to it in court. It's grey."), odile("Of course it's grey. Stop staring at it, it'll get ideas.")],
    // Notebook: add grey.
  },

  // ------------------------------------------------------------ Week 4
  week4: {
    sami: [
      sami("Odile! It's doing the noise again. The *zhhh, zhhh*. Mr Durand gave it me when he shut. He said find a wheel man."),
      odile("Don't look at me. Ask him. He did bicycles for a living."),
      hugo('I spent twelve years pulling other men up mountains.'),
      sami('Why?'),
      hugo('So they could win.'),
      sami("That's stupid."),
      hugo('They paid me.'),
      sami("...That's less stupid."),
    ],
    bike: [think("Rear wheel's out of true. One spoke's gone slack, so the rim wanders and kisses the brake pad once a turn.")],
    hold: [hugo("Hold the bike. Both hands. Don't help."), sami("Holding's not helping?"), hugo("Holding's my whole career.")],
    // Truing by ear (crafts/truing.js). hint, gauge and pitch are shared with Ch5's wheel.
    truing: {
      hint: '{KeyA} / {KeyD} turn · {Space} pluck · {KeyW} / {KeyS} tighten / loosen · or drag, click, scroll',
      gauge: 'PITCH',
      pitch: { flat: 'FLAT', sharp: 'SHARP', true: 'TRUE' },
      flat: "There. That one's flat.", // Hugo's thought, with the chalk mark (assist)
      barks: {
        who: 'Sami',
        clunk: 'Was it meant to go clunk?',
        hitting: "Odile, he's hitting it.",
        notFixed: "Is it fixed? It's not fixed.",
        ping: 'It went ping. Is ping good?',
        higher: "It's getting higher.",
      },
      assisted: { who: 'Sami', text: "Is it fixed? ...It's fixed." },
    },
    after: [
      sami("It's straight! How did you know where?"),
      hugo('You listen. It tells you where it rubs.'),
      sami("Why've you got a ski boot on?"),
      hugo("It's a medical boot. I broke my leg running."),
      sami('Running from what?'),
    ],
    laughStage: [stage('Hugo laughs. It comes out rusty, like something left in a shed.')],
    laugh: [think("Huh. A laugh. I'd have logged it, if there was a field for it.")],
    wrap: [
      hugo('I could always do that one. Before the team I built my own wheels. Mechanics were for people who won.'),
      odile('Write it down, then.'),
    ],
    // Notebook: add wheel.
  },

  // ------------------------------------------------------------ Week 7
  week7: {
    // As Week 7 opens: the race bike from his flat is on the stand.
    raceBike: [think('Brought the old bike down off its hook. Chain first. Then everything else.')],
    stage: [stage('Odile lifts the brush. The tip shivers. She puts it down.')],
    intro: [
      odile("Forty years, I could pull a line thinner than that. Big letters I can still bully. It's the thin ones."),
      hugo('Thinner than a hair.'),
      odile('Thinner than a hair. You pull it all the way through. No stopping halfway to admire it.'),
      think('Last person who said that to me was holding an X-ray.'),
      odile('I need someone to—'),
      odile('...Hold this board.'),
      stage('He takes it. Neither of them mentions it.'),
      odile('You held a scaffold. You can hold a brush. Same job. Stand still, then move once.'),
      odile("The door sign. O, P, E, N. The O's impossible and the N's a trap."),
    ],
    lettering: {
      paint: '#a3392b',
      tiers: {
        good: [odile("Clean. Don't tell anyone I said so.")],
        middle: [odile("It's got character. Nobody wants a sign with no character.")],
        poor: [odile("It's a bit drunk. Drunk letters still say OPEN.")],
      },
    },
    signMenu: {
      who: 'Odile',
      prompt: "Odile taps the bottom corner. 'Sign it.'",
      options: [
        { text: 'Big. Across the bottom.', correct: false, reply: "It's a shop sign, not a birthday cake." },
        {
          text: "I'd rather not.",
          correct: false,
          reply: "Twelve years you did the work and somebody else's name went on top. Not in my workshop.",
        },
        { text: 'Small. In the corner.', correct: true, reply: 'Smaller. So only the trade will find it.' },
      ],
    },
    signThink: [think('Twelve years. The first thing with my name on it says OPEN.')],
    // Notebook: add sign.
    buzz: "TIME TO MOVE! You've been still for 3 hr 12 min.",
    buzzReply: '...Three hours?',
    wrap: [
      odile("STRIDE aren't renewing the billboard. In a month there's twenty metres of nothing in the middle of all that ugly."),
      hugo('...You want to paint it.'),
      odile("I can hold a chalk. The street can hold the brushes. You're doing the line."),
      hugo('What line?'),
    ],
  },
};
