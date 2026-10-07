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
        'ZQSD / Flèches',
        'Se déplacer / guider le pinceau',
      ],
      [
        'Souris',
        'Regarder autour · R recentrer',
      ],
      [
        'Maj',
        'Essayer de trottiner',
      ],
      [
        'E',
        'Interagir / continuer',
      ],
      [
        'Espace',
        'Appuyer au bon moment',
      ],
      [
        'Q / D',
        'Garder le rythme',
      ],
      [
        '1 – 3',
        'Choix',
      ],
      [
        'M',
        'Couper le son',
      ],
      [
        'Échap',
        'Pause',
      ],
    ],
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
    escKey: 'Échap',
    muteHint: 'M pour couper le son',
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
    back: 'Retour',
  },
  ui: {
    chapter: 'CHAPITRE {n}',
    pain: 'DOULEUR',
    voicemail: 'MESSAGE VOCAL',
    space: 'ESPACE',
    distance: '{n} m',
    interact: 'Interagir',
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
    jog: 'Maintenir Maj pour trottiner',
    rhythm: 'Alterner Q et D. Régulier, pas rapide.',
    sand: 'Alterner Q et D. Régulier.',
    steer: 'Le pinceau suit la craie. ZQSD : petites corrections seulement',
    steerLine: 'Z / S pour stabiliser le pinceau',
    still: 'Ne toucher à rien',
    space: 'Espace',
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
    lines: [
      'La rue des Tanneurs n’a plus jamais eu de panneau publicitaire.',
      'Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre.',
      'La radio d’Odile capte quatre stations, maintenant. Elle écoute celle qui parle de pêche.',
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
    credits: 'Personnages et animations : Quaternius. Accessoires, matériaux et HDRI : Poly Haven, ambientCG. Éléments de rue et bruits de pas : Kenney. Musique et ambiances : OpenGameArt. Tout en CC0.',
  },
};
