// HAIRLINE FR text: common.js. Mirrors ../common.js exactly (same keys, array lengths and line flags).
// Check with: node scripts/i18n-check.mjs fr
export default {
  names: {
    hugo: 'Hugo',
    odile: 'Odile',
    sami: 'Sami',
    bastien: 'Bastien',
    stride: 'STRIDE',
    dr: 'Dr Okafor',
    ines: 'Ines',
    marco: 'Marco',
    benali: 'Mme Benali',
  },
  title: {
    name: 'HAIRLINE',
    tagline: 'La fêlure était plus fine qu’un cheveu. Elle allait jusqu’au bout.',
    begin: 'Cliquer pour commencer',
    controls: [
      [
        '{KeyW}{KeyA}{KeyS}{KeyD} / {Arrows}',
        'Se déplacer / guider le pinceau',
      ],
      [
        'Souris',
        'Regarder autour · {KeyR} recentrer',
      ],
      [
        '{Shift}',
        'Essayer de trottiner',
      ],
      [
        '{KeyE}',
        'Interagir / continuer',
      ],
      [
        '{Space}',
        'Tenir le mètre · pincer un rayon',
      ],
      [
        '{KeyA} / {KeyD}',
        'Garder le rythme',
      ],
      [
        '1 – 5',
        'Choix · pots de peinture',
      ],
      [
        '{KeyM}',
        'Couper le son',
      ],
      [
        '{Escape}',
        'Pause',
      ],
    ],
  },
  keyNames: {
    Space: 'Espace',
    Shift: 'Maj',
    Escape: 'Échap',
    Enter: 'Entrée',
    Arrows: 'Flèches',
  },
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
    escKey: '{Escape}',
    muteHint: '{KeyM} pour couper le son',
    quality: 'Graphismes',
    tiers: {
      low: 'Bas',
      medium: 'Moyen',
      high: 'Élevé',
    },
  },
  options: {
    title: 'Options',
    language: 'Langue',
    voices: 'Voix',
    voicesOn: 'Activées',
    voicesOff: 'Désactivées',
    voicesNote: 'En français uniquement',
    back: 'Retour',
  },
  ui: {
    chapter: 'CHAPITRE {n}',
    pain: 'DOULEUR',
    voicemail: 'MESSAGE VOCAL',
    space: 'ESPACE',
    distance: '{n} m',
    interact: 'Interagir',
    next: '{KeyE} ▸',
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
  watch: {
    unit: 'km',
    zero: '0,0 km',
    labels: {
      week: 'CETTE SEMAINE',
      run: 'COURSE · SEMAINE',
      walk: 'MARCHE',
      race: 'MARATHON',
      last: 'SEM. PRÉC.',
    },
    atChapter: [
      null,
      {
        face: '0,32 km',
        label: 'MARCHE',
        lap: '38:40',
      },
      {
        face: '0,0 km',
        label: 'CETTE SEMAINE',
        lap: null,
      },
      {
        face: '0,0 km',
        label: 'COURSE · SEMAINE',
        lap: null,
      },
      {
        face: '0,0 km',
        label: 'COURSE · SEMAINE',
        lap: null,
      },
    ],
  },
  notebook: {
    heading: 'CE QUE JE SAIS FAIRE',
    items: {
      ride: 'Rouler.',
      run: 'Courir.',
      hold: 'Ne pas bouger.',
      sand: 'Poncer dans le sens du fil.',
      measure: 'Mesurer deux fois.',
      grey: 'Faire un gris pas triste.',
      wheel: 'Dévoiler une roue.',
      sign: 'Peindre une enseigne.',
      teach: 'Aprendre.',
      rest: 'Se reposer.',
    },
    someSundays: '(certains dimanches)',
    atChapter: [
      null,
      null,
      null,
      null,
      [
        {
          text: 'Rouler.',
          struck: true,
        },
        {
          text: 'Courir.',
          struck: true,
        },
        {
          text: 'Ne pas bouger.',
        },
        {
          text: 'Poncer dans le sens du fil.',
        },
        {
          text: 'Mesurer deux fois.',
        },
        {
          text: 'Faire un gris pas triste.',
        },
        {
          text: 'Dévoiler une roue.',
        },
        {
          text: 'Peindre une enseigne.',
        },
      ],
    ],
    final: [
      {
        text: 'Rouler.',
      },
      {
        text: 'Courir.',
        note: '(certains dimanches)',
      },
      {
        text: 'Ne pas bouger.',
      },
      {
        text: 'Poncer dans le sens du fil.',
      },
      {
        text: 'Mesurer deux fois.',
      },
      {
        text: 'Faire un gris pas triste.',
      },
      {
        text: 'Dévoiler une roue.',
      },
      {
        text: 'Peindre une enseigne.',
      },
      {
        text: 'Aprendre.',
        hand: 'sami',
      },
      {
        text: 'Se reposer.',
      },
    ],
  },
  ending: {
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
        board: 'Le chevalet de Marco affiche de nouveau KEBAB, à la main. Il a ajouté EXCELLENT lui-même. Les lettres sont un peu pompettes.',
        wheel: 'Ines roule sur une roue qui ne frotte plus. Elle signe son travail, maintenant. En petit, dans le coin.',
        shutter: 'Le rideau de fer de Mme Benali se lève à six heures sans un bruit. La dispute lui manque.',
      },
      grey: {
        own: 'La porte du N° 14 est d’un gris qui a vécu. Il n’a jamais noté la recette.',
        odile: 'La porte du N° 14 est d’un gris qu’Odile a rattrapé. Il dit que c’est lui qui l’a fait. Elle le laisse dire.',
      },
      radio: {
        fixed: 'La radio d’Odile capte quatre stations, maintenant. Elle écoute celle qui parle de pêche.',
        one: 'La radio d’Odile ne capte toujours qu’une station. Elle a beaucoup appris sur la pêche.',
      },
      ask: 'Cette année-là, la liste d’Odile Marchal s’est allongée d’une ligne. Il y est écrit : « Demander. »',
      runs: 'Hugo Revel court certains dimanches. Personne ne sait jusqu’où, pas même lui.',
      watch: 'Sa montre pend à un clou au-dessus de l’établi. Elle croit qu’il se repose depuis un an.',
    },
    lines: [
      'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire.',
      'Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre.',
      'La porte du N° 14 est d’un gris qui a vécu. Il n’a jamais noté la recette.',
      'La radio d’Odile ne capte toujours qu’une station. Elle a beaucoup appris sur la pêche.',
      'Cette année-là, la liste d’Odile Marchal s’est allongée d’une ligne. Il y est écrit : « Demander. »',
      'Hugo Revel court certains dimanches. Personne ne sait jusqu’où, pas même lui.',
      'Sa montre pend à un clou au-dessus de l’établi. Elle croit qu’il se repose depuis un an.',
    ],
    bigs: [
      '212,4 km',
    ],
    hairline: true,
    hairlineColor: '#d9a441',
    thanks: 'Merci d’avoir joué.',
    playAgain: 'Rejouer',
    credits: 'Personnages et animations : Quaternius. Accessoires, matériaux et HDRI : Poly Haven, ambientCG. Éléments de rue et bruits de pas : Kenney. Musique et ambiances : OpenGameArt. Tous en CC0. Voix françaises : Kyutai TTS (kyutai/tts-1.6b-en_fr, CC BY 4.0), avec des voix de CML-TTS (CC BY 4.0) et d’un don de voix (CC0).',
  },
};
