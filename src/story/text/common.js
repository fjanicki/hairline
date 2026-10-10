// HAIRLINE: shared player-facing text (source: docs/DESIGN.md). Core-owned.
// The game is French only: every string here is the text as shown. Style, typography and tu/vous
// rules: docs/i18n-fr.md. Check with `node scripts/text-check.mjs`.
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
  lou: 'Lou',
  gerard: 'Gérard',
  benali: 'Mme Benali',
  jo: 'Jo',
  durand: 'M. Durand',
  oldman: 'Le vieux monsieur', // R4 Ch5: Durand before Hugo learns his name (voice and colour: durand)
};

export const hugo = (text) => ({ who: NAMES.hugo, text });
export const think = (text) => ({ who: NAMES.hugo, text, inner: true });
export const odile = (text) => ({ who: NAMES.odile, text });
export const sami = (text) => ({ who: NAMES.sami, text });
export const bastien = (text) => ({ who: NAMES.bastien, text });
export const lou = (text) => ({ who: NAMES.lou, text });
export const gerard = (text) => ({ who: NAMES.gerard, text });
export const dr = (text) => ({ who: NAMES.dr, text });
export const jo = (text) => ({ who: NAMES.jo, text });
export const durand = (text) => ({ who: NAMES.durand, text });
export const oldman = (text) => ({ who: NAMES.oldman, text });
/** Stage direction: no speaker, rendered italic via *...*. */
export const stage = (text) => ({ who: null, text: `*${text}*` });

// Canonical notebook entries. Chapters reference these keys, never literal strings.
const ITEMS = {
  ride: 'Rouler.',
  run: 'Courir.',
  hold: 'Ne pas bouger.',
  sand: 'Poncer dans le sens du fil.',
  measure: 'Mesurer deux fois.',
  grey: 'Faire un gris pas triste.',
  wheel: 'Dévoiler une roue.',
  sign: 'Peindre une enseigne.',
  teach: 'Aprendre.', // Sami's hand, Sami's spelling. Hugo doesn't correct it.
  rest: 'Se reposer.',
  // Revision 4 (docs/SCRIPT-R4.md §8, the 15-line final list).
  croissant: 'Rouler un croissant.', // + NOTES.moon
  puncture: 'Trouver une crevaison.',
  fineLine: 'Tracer un trait fin.', // + NOTES.badly, in Jo's hand
  case: 'Mener une enquête.',
  cook: 'Cuisiner.', // Jo writes the whole line, + NOTES.learning
};
// Small notes written after an entry (ui.notebook.annotate(text, note, { hand })).
const NOTES = {
  moon: '(lune)',
  badly: '(mal)',
  learning: '(en cours)',
};

// Notebook seeds per chapter (SCRIPT-R4 §10.4): what Ch4 to Ch6 wrote, for a chapter started directly.
const SEED5 = [
  { text: ITEMS.ride, struck: true },
  { text: ITEMS.run, struck: true },
  { text: ITEMS.hold },
  { text: ITEMS.sand },
  { text: ITEMS.measure },
  { text: ITEMS.grey },
];
const SEED6 = [...SEED5, { text: ITEMS.croissant, note: NOTES.moon }, { text: ITEMS.puncture }, { text: ITEMS.wheel }];
const SEED7 = [...SEED6, { text: ITEMS.sign }, { text: ITEMS.fineLine, note: NOTES.badly, noteHand: 'jo' }, { text: ITEMS.case }];

export const common = {
  names: NAMES,

  title: {
    name: 'HAIRLINE',
    tagline: 'La fêlure était plus fine qu’un cheveu. Elle allait jusqu’au bout.',
    begin: 'Cliquer pour commencer',
    // Shown instead of `begin` when there is saved progress ({n} chapter number, {name} its title).
    continue: 'Cliquer pour reprendre · Chapitre {n} : {name}',
    newGame: 'Nouvelle partie',
    // Keys are tokens ({KeyW}, {Space}...), resolved for the player's layout (docs/API.md, i18n).
    controls: [
      ['{KeyW}{KeyA}{KeyS}{KeyD} / {Arrows}', 'Se déplacer / guider le pinceau'],
      ['Souris', 'Regarder autour · {KeyR} recentrer'],
      ['{Shift}', 'Essayer de trottiner'],
      ['{KeyE}', 'Interagir / continuer'],
      ['{Tab}', 'La poche · {Escape} ranger l’objet'],
      ['{Space}', 'Tenir le mètre · pincer un rayon'],
      ['{KeyA} / {KeyD}', 'Garder le rythme'],
      ['1 – 5', 'Choix · pots de peinture'],
      ['{KeyM}', 'Couper le son'],
      ['{Escape}', 'Pause'],
    ],
  },

  // Names of the non-letter key tokens ({Space}...). Letter tokens ({KeyA}) follow the keyboard layout.
  keyNames: { Space: 'Espace', Shift: 'Maj', Escape: 'Échap', Enter: 'Entrée', Arrows: 'Flèches' },

  loading: 'Chargement',
  noWebGL: 'Cette démo nécessite WebGL.',
  contextLost: 'Le contexte graphique a été perdu.',
  reload: 'Recharger',
  mobile: {
    text: 'HAIRLINE se joue au clavier, sur un écran plus grand.',
    continue: 'Continuer quand même',
  },
  pause: {
    title: 'Pause',
    resume: 'Reprendre',
    restart: 'Recommencer le chapitre',
    options: 'Options',
    escKey: '{Escape}', // footer: '{escKey} · {muteHint}'
    muteHint: '{KeyM} pour couper le son',
    quality: 'Graphismes',
    tiers: { low: 'Bas', medium: 'Moyen', high: 'Élevé' },
  },
  // Options panel (title screen and pause menu): voices, then graphics (pause.quality / pause.tiers).
  options: {
    title: 'Options',
    voices: 'Voix',
    voicesOn: 'Activées',
    voicesOff: 'Désactivées',
    back: 'Retour',
  },

  // Small HUD bits ({n} is filled in by the code).
  ui: {
    chapter: 'CHAPITRE {n}',
    pain: 'DOULEUR',
    voicemail: 'MESSAGE VOCAL',
    space: 'ESPACE',
    distance: '{n} m',
    interact: 'Interagir',
    next: '{KeyE} ▸', // dialogue / card advance cue
    muted: 'Son coupé',
    soundOn: 'Son activé',
  },

  opening: [
    'Hugo Revel a été cycliste professionnel pendant douze ans.',
    'Il n’a jamais gagné une course. Ce n’était pas son travail.',
    'Quand ça s’est arrêté, il s’est mis à courir. Et il ne s’est plus arrêté.',
    'La semaine dernière, il a couru 212,4 kilomètres.',
    'Dimanche, au kilomètre 31, son tibia gauche s’est fêlé le long d’un trait plus fin qu’un cheveu.',
    'Il est allé au bout de la course.',
    'Cette semaine : 0,0.',
  ],

  // Player stumble lines (ui.thought). `first` is only true on boot day 4 (Ch1/Ch2);
  // Ch4 to Ch7 set player.firstStumbleDone = true so they draw from the bag.
  stumble: {
    first: 'Douze semaines. On en est au jour quatre.',
    bag: [
      'L’os ne négocie pas.',
      'Cette botte pèse plus lourd que mes roues carbone.',
      'Plus fin qu’un cheveu. Et c’est lui qui gagne.',
      'Douze semaines, ça fait quatre-vingt-quatre jours. J’ai fait le calcul. Deux fois.',
      'Je sais. Je *sais*.',
    ],
  },

  hints: {
    jog: 'Maintenir {Shift} pour trottiner',
    rhythm: 'Alterner {KeyA} et {KeyD}. Régulier, pas rapide.',
    sand: 'Alterner {KeyA} et {KeyD}. Régulier.',
    steer: 'Le pinceau suit la craie. {KeyW}{KeyA}{KeyS}{KeyD} : petites corrections seulement',
    steerLine: '{KeyW} / {KeyS} pour stabiliser le pinceau',
    still: 'Ne toucher à rien',
    space: '{Space}',
  },

  // GPS watch HUD (ui.watch / ui.watchBuzz). Docked bottom-right.
  watch: {
    unit: 'km',
    zero: '0,0 km',
    labels: {
      week: 'CETTE SEMAINE',
      run: 'COURSE · SEMAINE', // Ch4 to Ch7: true while he walks everywhere
      walk: 'MARCHE',
      race: 'MARATHON',
      last: 'SEM. PRÉC.',
    },
    // Seeded by the Director at each chapter start (index = chapter 0..6, SCRIPT-R4 §10.3). null = hidden.
    atChapter: [
      null, // Ch1: appears when he takes it off the charger
      { face: '0,32 km', label: 'MARCHE', lap: '38:40' },
      { face: '0,0 km', label: 'CETTE SEMAINE', lap: null },
      { face: '0,0 km', label: 'COURSE · SEMAINE', lap: null }, // Ch4
      { face: '0,0 km', label: 'COURSE · SEMAINE', lap: null }, // Ch5
      { face: '0,0 km', label: 'COURSE · SEMAINE', lap: null }, // Ch6
      { face: '0,0 km', label: 'COURSE · SEMAINE', lap: null }, // Ch7: stays 0,0 until the nail
    ],
  },

  // « CE QUE JE SAIS FAIRE » notebook HUD (ui.notebook). Docked top-right.
  notebook: {
    heading: 'CE QUE JE SAIS FAIRE',
    items: ITEMS,
    notes: NOTES,
    someSundays: '(certains dimanches)',
    // Seeded by the Director at each chapter start (SCRIPT-R4 §10.4). null = hidden (created in Ch4 Day 5).
    // Entries: { text, struck?, note?, hand?: 'hugo' | 'sami' | 'jo', noteHand? }.
    atChapter: [null, null, null, null, SEED5, SEED6, SEED7],
    // For reference / verification: the list as it stands at the very end (SCRIPT-R4 §8, 15 lines).
    final: [
      { text: ITEMS.ride },
      { text: ITEMS.run, note: '(certains dimanches)' },
      { text: ITEMS.hold },
      { text: ITEMS.sand },
      { text: ITEMS.measure },
      { text: ITEMS.grey },
      { text: ITEMS.croissant, note: NOTES.moon },
      { text: ITEMS.puncture },
      { text: ITEMS.wheel },
      { text: ITEMS.sign },
      { text: ITEMS.fineLine, note: NOTES.badly, noteHand: 'jo' },
      { text: ITEMS.case },
      { text: ITEMS.teach, hand: 'sami' },
      { text: ITEMS.cook, note: NOTES.learning, hand: 'jo' },
      { text: ITEMS.rest },
    ],
  },

  ending: {
    // The closing card: 9 lines chosen from memory by story/ending.js (endingLines, SCRIPT-R4 §8.9). `lines` is
    // the default selection (no panel, Sami right first time, no jobs, the grey his own, Jo cool).
    cards: {
      street: {
        plain: 'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire.',
        wheel: 'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire. Là où il était, il y a une petite roue. Sami dit que c’est la sienne.',
        door: 'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire. Là où il était, il y a une petite porte grise. Les gens frappent à la vraie.',
        hand: 'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire. Là où il était, une petite main tient un pinceau, parfaitement immobile.',
      },
      sami: {
        first: 'Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre.',
        second: 'Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre. Il laisse d’abord les gens se tromper.',
      },
      job: {
        board: 'Le chevalet de Gérard affiche de nouveau KEBAB, à la main. Il a ajouté EXCELLENT lui-même. Les lettres sont un peu pompettes.',
        wheel: 'Lou roule sur une roue qui ne frotte plus. Elle signe son travail, maintenant. En petit, dans le coin.',
        // R4: Durand took the scream; Hugo's job takes the jam.
        shutter: 'Le rideau de fer de Mme Benali monte d’une traite, à six heures. Il ne crie plus, il ne coince plus. La dispute lui manque.',
      },
      grey: {
        own: 'La porte du N° 14 est d’un gris qui a vécu. Il n’a jamais noté la recette.',
        odile: 'La porte du N° 14 est d’un gris qu’Odile a rattrapé. Il dit que c’est lui qui l’a fait. Elle le laisse dire.',
      },
      radio: {
        fixed: 'La radio d’Odile capte quatre stations, maintenant. Elle écoute celle qui parle de pêche.',
        one: 'La radio d’Odile ne capte toujours qu’une station. Elle a beaucoup appris sur la pêche.',
      },
      durand: 'Albert Durand a appris à faire la grasse matinée. Il ouvre à dix heures, maintenant. Sami arrive à dix heures cinq.',
      // Jo's warmth (memory.js joWarmth(), warm >= 3). Warm closes echo chains 1 and 2; nobody explains it.
      jo: {
        warm: 'Jo a tatoué un trait sur le tibia gauche d’Hugo, juste par-dessus la fêlure. Plus fin qu’un cheveu. Il va jusqu’au bout.',
        cool: 'Hugo doit toujours un souper à Jo. Il en est à sa quatrième sauce. Elle dit que la cinquième sera la bonne.',
      },
      ask: 'Cette année-là, la liste d’Odile Marchal s’est allongée d’une ligne. Il y est écrit : « Demander. »',
      runs: 'Hugo Revel court certains dimanches. Personne ne sait jusqu’où, pas même lui.',
      watch: 'Sa montre pend à un clou au-dessus de l’établi. Elle croit qu’il se repose depuis un an.',
    },
    lines: [
      'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire.',
      'Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre.',
      'Albert Durand a appris à faire la grasse matinée. Il ouvre à dix heures, maintenant. Sami arrive à dix heures cinq.',
      'La porte du N° 14 est d’un gris qui a vécu. Il n’a jamais noté la recette.',
      'La radio d’Odile ne capte toujours qu’une station. Elle a beaucoup appris sur la pêche.',
      'Cette année-là, la liste d’Odile Marchal s’est allongée d’une ligne. Il y est écrit : « Demander. »',
      'Hugo doit toujours un souper à Jo. Il en est à sa quatrième sauce. Elle dit que la cinquième sera la bonne.',
      'Hugo Revel court certains dimanches. Personne ne sait jusqu’où, pas même lui.',
      'Sa montre pend à un clou au-dessus de l’établi. Elle croit qu’il se repose depuis un an.',
    ],
    bigs: ['212,4 km'],
    hairline: true,
    hairlineColor: '#d9a441',
    thanks: 'Merci d’avoir joué.',
    playAgain: 'Rejouer',
    credits:
      'Personnages et animations : Quaternius. Accessoires, matériaux et HDRI : Poly Haven, ambientCG. Éléments de rue et bruits de pas : Kenney. Musique et ambiances : OpenGameArt. Tous en CC0. Voix françaises : Kyutai TTS (kyutai/tts-1.6b-en_fr, CC BY 4.0), avec des voix de CML-TTS (CC BY 4.0) et d’un don de voix (CC0). Voix de Jo : Chatterbox (Resemble AI, MIT), d’après une voix de Mozilla Common Voice (CC0).',
  },
};

export default common;
