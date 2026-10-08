// HAIRLINE FR text: ch5.js. Mirrors ../ch5.js exactly (same keys, array lengths and line flags).
// Translated per docs/i18n-fr.md. Check with: node scripts/i18n-check.mjs fr
import { bastien, hugo, ines, marco, odile, sami, stage, think } from '../common.js';

export default {
  title: 'Le Mur',
  objectives: {
    start: 'Trouver Odile.',
    sami: 'Aider Sami.',
    line: 'Peindre le trait.',
    boot: 'S’asseoir sur le banc.',
    walk: 'Rentrer à pied.',
    watch: 'Raccrocher la montre.',
  },
  prompts: {
    odile: 'Prêt',
    sami: 'Aider',
    bench: 'S’asseoir',
    strap: '[{KeyE}] Défaire les sangles',
    wave: '[{KeyE}] Saluer',
    watch: 'Enlever la montre',
    benali: 'Parler',
    ines: 'Parler',
    marco: 'Parler',
    shopCard: 'Regarder',
    boltHoles: 'Regarder',
    shutter: 'Réparer le rideau',
    radio: 'Régler la radio',
    board: 'Repeindre les lettres',
    inesBike: 'Regarder la roue',
  },
  signs: {
    shopCard: 'CREVAISONS RÉPARÉES\nDEMANDER AU N° 14', // two lines: on one line it auto-fits under 8 px
    open: 'OPEN',
    initials: 'H.R.',
    marcoPanel: [
      'SUPER', // EXCELLENT (271 px) overruns the panel edge and the kebab
      'KEBAB',
    ],
    sketch: '20 m — mesurer deux fois',
    rest: 'repos',
    panels: [
      {
        id: 'benali',
        label: 'un croissant devenu lune',
        color: '#e8c27a',
      },
      {
        id: 'ines',
        label: 'le lettrage d’Ines',
        color: '#c24a6a',
      },
      {
        id: 'sami',
        label: 'le vélo de Sami',
        color: '#c24a3a',
      },
      {
        id: 'odile',
        label: 'la main à la craie d’Odile',
        color: '#9a7a4e',
      },
      {
        id: 'marco',
        label: 'un excellent kebab',
        color: '#d98a3a',
      },
    ],
  },
  opening: [
    odile('Te voilà. T’es en retard.'),
    hugo('J’ai pris le chemin le plus long. C’était sympa.'),
    think('Sympa. J’ai dit « sympa » à propos d’une balade. À voix haute.'),
    odile('La moitié de la rue est coincée, voilée, passée ou grésillante. Avant ton trait, si tes mains s’ennuient.'),
  ],
  benali: [
    {
      who: 'Mme Benali',
      text: 'Je voulais peindre un croissant. Ça a donné un croissant de lune. J’ai décidé que c’était la lune.',
    },
  ],
  ines: [
    ines('J’ai tagué ce mur huit fois. C’est la première fois qu’on me *tend* la peinture.'),
    hugo('Ça fait quoi ?'),
    ines('Bizarre. Légal.'),
  ],
  marco: [
    marco('Odile a dit de peindre ce qu’on sait faire. Moi, je fais un très bon kebab. Donc.'),
    hugo('C’est un bon kebab.'),
    marco('C’est un *excellent* kebab.'),
  ],
  shopCard: [
    think('L’écriture de Sami. Mon orthographe.'),
  ],
  boltHoles: [
    think('La montre me disait de me reposer. Le panneau me disait de ne jamais m’arrêter. J’ai écouté le plus gros.'),
  ],
  jobs: {
    shutter: {
      near: { who: 'Mme Benali', text: 'Il se bloque à mi-hauteur tous les matins. J’ouvre une demi-boulangerie.' },
      call: { who: 'Mme Benali', text: 'Hugo ! Quand vous aurez une minute… Mon rideau est encore bloqué.' },
      gauge: 'GLISSIÈRES',
      mash: { who: 'Mme Benali', text: 'Doucement. Il est plus vieux que moi.' },
      done: [{ who: 'Mme Benali', text: 'Il est monté. Me voilà obligée d’être aimable toute la matinée.' }],
    },
    radio: {
      near: odile('Elle capte toujours que la pêche.'),
      hint: '{KeyA} / {KeyD} ou glisser pour tourner le bouton',
      stations: {
        who: 'Radio',
        fishing: '…et le brochet, voyez-vous, le brochet se moque bien de vos états d’âme…',
        music: '*De la musique. Lente, un peu rayée.*',
        football: '…deux à zéro, et personne ici n’arrive vraiment à y croire…',
        forecast: '…Pas-de-Calais, ouest quatre à cinq, pluie ensuite, visibilité bonne…',
      },
      done: [
        odile('Quatre stations. J’ai le monsieur de la pêche depuis le franc.'),
        hugo('La pêche ?'),
        odile('Laisse-la sur la musique. Les poissons attendront.'),
      ],
    },
    board: {
      near: marco('Mon chevalet est si passé qu’on nous croit fermés.'),
      word: 'KEBAB',
      tiers: {
        good: [marco('Ça, c’est un excellent chevalet.')],
        middle: [marco('Il a du caractère. Comme le kebab.')],
        poor: [marco('Il est un peu pompette. Comme la moitié de mes clients, après minuit.')],
      },
    },
    wheel: {
      near: sami('Ines s’est pris un trottoir. Les crevaisons, c’est moi. Les roues tordues, c’est toi.'),
      truing: {
        flat: 'Là. Celui-là sonne faux.',
        barks: {
          who: 'Sami',
          clunk: 'Clonk, c’est pas bon. Je connais clonk.',
          hitting: 'Là, tu le tapes, c’est tout.',
          notFixed: 'C’est pas réparé. Je l’entends.',
          ping: 'Celui-là a fait ping. C’est bien, ping, cette fois ?',
          higher: 'Ça monte.',
        },
        assisted: sami('…Réparé. Je dirai que j’ai aidé.'),
      },
      done: sami('Ines ! Ta roue chante, maintenant !'),
    },
  },
  readyCheck: {
    who: 'Odile',
    prompt: 'Personne te chronomètre.',
    options: [
      { text: 'Prêt.', correct: true },
      { text: 'Pas encore.' },
    ],
  },
  teach: {
    call: [
      sami('Hugo ! Elle a encore sauté !'),
    ],
    menu: {
      who: 'Sami',
      prompt: 'La chaîne a sauté du plateau. Il a déjà les mains noires.',
      options: [
        {
          text: 'Donne, je vais le faire.',
          correct: false,
          reply: 'C’est toujours toi qui le fais. Après, elle saute quand t’es pas là.',
        },
        {
          text: 'Un bon coup de pied. Ferme.',
          correct: false,
          reply: 'C’est comme ça qu’Odile répare la radio. La radio est toujours en panne.',
        },
        {
          text: 'Accroche-la en bas du plateau. Pédale en arrière. Doucement.',
          correct: true,
          reply: '…Elle est remontée. Elle est *remontée*. T’as vu ?',
        },
      ],
    },
    after: [
      hugo('J’ai vu.'),
      sami('C’est quoi, ça ?'),
      hugo('Une liste.'),
      stage('Sami la lit, lèche le crayon et écrit quelque chose.'),
      sami('T’en as oublié un.'),
    ],
  },
  panel: {
    ask: [
      odile('D’abord, une chose. Là-haut, où il y avait le panneau. Personne n’en a voulu.'),
      hugo('Alors c’est à moi.'),
      odile('Peins ce que tu sais faire. En petit, si tu veux.'),
    ],
    menu: {
      prompt: 'Quelque chose de la liste.',
      options: [
        {
          text: 'Une roue. Dévoilée.',
          reply: null,
        },
        {
          text: 'La porte. Ce gris-là.',
          reply: null,
        },
        {
          text: 'Une main qui tient un pinceau, sans bouger.',
          reply: null,
        },
      ],
    },
    stage: [
      stage('Odile tient l’échelle. À deux mains. Elle n’aide pas.'),
    ],
    after: {
      wheel: [
        odile('Une roue. Sami va dire que c’est la sienne.'),
      ],
      door: [
        odile('Ma porte. Plus haut que je l’aurais accrochée.'),
      ],
      hand: [
        odile('La main sûre. Crâneur.'),
      ],
    },
  },
  line: {
    setup: [
      odile('Tout le monde a peint ce qu’il sait faire. Ton trait passe sous tout ça. De la boulangerie au kebab.'),
      hugo('Un trait.'),
      odile('Vingt mètres. J’ai mesuré deux fois. Ne t’arrête pas au milieu pour l’admirer.'),
      hugo('Et s’il tremble ?'),
      odile('Vas-y, alors.'),
    ],
    gauge: 'TRAIT',
    color: '#d9a441',
    end: [
      think('Vingt mètres. Je n’ai pas chronométré.'),
    ],
    tiers: {
      good: [
        odile('Plus fin qu’un cheveu. À un cheveu près.'),
      ],
      middle: [
        odile('C’est un trait fait main.'),
      ],
      poor: [
        odile('C’est un trait fait main, en botte. Pareil, en plus bruyant.'),
      ],
    },
    sign: [
      odile('Signe-le.'),
      hugo('En petit ?'),
      odile('Tu apprends.'),
    ],
    photo: [
      ines('Mettez-vous devant.'),
      hugo('Une photo du mur ?'),
      ines('De vous. Devant le mur. C’est le principe d’une photo.'),
    ],
  },
  club: {
    greet: [
      bastien('HUGO ! Alors, les loisirs créatifs ? La botte, c’est bientôt fini, hein ? On va te remettre à deux cents par semaine !'),
    ],
    after: [
      hugo('Peut-être vingt.'),
      bastien('Par jour ?'),
      hugo('Par semaine.'),
      bastien('…C’est permis, ça ? J’ai le tibia un peu bavard, d’ailleurs. Mais bon, comme tout le monde !'),
      hugo('Va le faire voir.'),
      bastien('Ha ! Après dimanche !'),
    ],
    afterThoughts: [
      think('Il a trottiné sur place tout du long, pour que sa montre ne se mette pas en pause.'),
      think('Tant mieux pour lui.'),
    ],
  },
  boot: {
    ask: [
      odile('C’est aujourd’hui, hein. La botte.'),
      hugo('Radio ce matin. Le docteur Okafor a dit : « Rien à signaler. » La plus belle chose qu’un médecin m’ait jamais dite.'),
      odile('Douze semaines depuis le dimanche. J’ai compté. T’es pas le seul dans cette rue à savoir compter.'),
      odile('Assieds-toi. J’ai une scie à métaux si le scratch fait des histoires.'),
    ],
    light: [
      think('La jambe était légère. Comme si elle ne savait pas encore à quoi elle servait.'),
    ],
    walk: [
      odile('Un tour de pâté de maisons, puis tu rentres. Ta jambe se débrouillera.'),
    ],
  },
  walk: {
    sami: [
      sami('Hugo ! Ça frotte même plus !'),
      hugo('Les mains sur le guidon !'),
      sami('…*Ça va !*'),
    ],
    firstJog: 'Tranquille. Tranquille, c’est une allure.',
    stopped: 'Je me suis arrêté. Personne ne m’y a obligé. Que ce soit noté aussi.',
    mural: 'Mon trait court sous les peintures de tout le monde. Il les soutient un peu.',
    bike: 'Quatre ans au crochet. Il a suffi d’un après-midi et d’une brosse à dents.',
    watchHud: {
      face: '0,0 km',
      label: 'COURSE · SEMAINE',
      lap: null,
    },
    outline: [
      think('Elle avait déjà peint la silhouette.'),
    ],
    restMenu: {
      prompt: 'STRIDE : Aucun mouvement détecté. ON BOUGE ?',
      options: [
        {
          text: 'Bouger',
          reply: '…Non. Repos.',
        },
        {
          text: 'Repos',
          reply: null,
        },
      ],
    },
    crane: [
      think('Deux cent douze virgule quatre kilomètres. Je ne me souviens pas d’un seul mètre.'),
      think('Vingt mètres de trait. Il tremble à hauteur du kebab. Je me souviens de tout.'),
    ],
  },
};
