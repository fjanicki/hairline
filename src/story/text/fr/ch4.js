// HAIRLINE FR text: ch4.js. Mirrors ../ch4.js exactly (same keys, array lengths and line flags).
// Check with: node scripts/i18n-check.mjs fr
import { hugo, odile, sami, stage, think } from '../common.js';

export default {
  title: 'Mesurer deux fois',
  cards: {
    day5: [
      'Jour 5.',
    ],
    day8: [
      'Jour 8.',
    ],
    week4: [
      'Semaine 4.',
    ],
    week7: [
      'Semaine 7.',
    ],
    week12: [
      'Semaine 12.',
    ],
  },
  objectives: {
    day5: 'Prendre le papier de verre.',
    sand: 'Poncer la porte.',
    day8: 'Mesurer l’encadrement.',
    week4: 'Regarder le vélo.',
    week7: 'Voir ce que fait Odile.',
  },
  prompts: {
    pegboard: 'Prendre le papier de verre',
    door: 'Poncer',
    frame: 'Mesurer',
    bike: 'Regarder le vélo',
    bench: 'Observer',
    oldSigns: 'Regarder',
    radio: 'Écouter',
  },
  signs: {
    old: [
      'MARCHAL & FILLE',
      'CAFÉ DU NORD',
      "DÉFENSE D'AFFICHER",
    ],
    open: 'OPEN',
    initials: 'H.R.',
  },
  oldSigns: [
    hugo('Marchal et Fille.'),
    odile('La fille, c’est moi. Mon père faisait les grandes lettres, moi les déliés. Puis il est mort et j’ai fait les deux.'),
  ],
  radio: [
    odile('Elle capte une station. Un monsieur qui parle de pêche. J’ai beaucoup appris sur la pêche.'),
  ],
  day5: {
    arrive: [
      odile('Vous êtes en avance.'),
      hugo('Debout à quatre heures. J’avais mis mes chaussures avant de m’en souvenir.'),
      odile('Votre chaussure.'),
      hugo('…Ma chaussure.'),
    ],
    book: [
      stage('Elle lui tend un crayon et un cahier d’écolier.'),
      odile('Tous ceux qui travaillent ici écrivent ce qu’ils savent faire. Le premier jour. Pour qu’on voie, plus tard, que ça n’a pas toujours été là.'),
      hugo('Combien de personnes ont travaillé ici ?'),
      odile('Avant toi ? Deux. Moi et mon père. Il avait écrit « tout » et il l’avait souligné. C’était un menteur.'),
    ],
    strike: [
      odile('Tu peux faire l’un des deux, ce mois-ci ?'),
      hugo('…Non.'),
      odile('Alors tire un trait dessus. Légèrement. C’est un crayon, pas un tatouage.'),
    ],
    strikeThink: [
      think('Trente-sept ans. Deux mots. Barrés tous les deux à dix heures dix. Efficace, au moins.'),
    ],
    holdStill: [
      odile('Tu sais ne pas bouger. Je t’ai vu faire. Écris-le.'),
    ],
    door: [
      odile('Maintenant, la porte. Neuf couches de peinture. Je veux voir le bois avant midi. Le papier de verre est au tableau.'),
    ],
    pegboard: [
      think('Chaque outil a sa silhouette peinte sur le tableau. Comme ça, on voit ce qui manque.'),
      think('Mon carnet d’entraînement, c’était pareil. Chaque jour de repos, un trou qu’il fallait regarder.'),
    ],
    grain: [
      odile('Dans le sens du fil, dans la longueur. Appuie pas. Laisse faire le papier.'),
    ],
    after: [
      odile('Tu as déjà fait ça, toi.'),
      hugo('Un truc du genre. Dans les cinquante millions de fois. J’ai fait le calcul, un jour. Un jour de repos.'),
      odile('Écris-le. Si tu sais le faire, ça va sur la liste. C’est la seule règle.'),
    ],
  },
  sanding: {
    gauge: 'PONÇAGE',
    barks: {
      who: 'Odile',
      mash: [
        'Tu la ponces pas, tu te disputes avec.',
        'Plus lent. Ce bois était là bien avant toi.',
      ],
      cross: 'Dans le sens du fil. Un chat, ça se caresse dans le sens du poil.',
    },
    buzz: 'AVIRON DÉTECTÉ. LANCER LA SÉANCE ?',
    buzzReply: 'Non.',
  },
  day8: {
    start: [
      odile('La porte retourne sur ses gonds. Elle fait quatre-vingt-deux de large. Mesure l’encadrement.'),
    ],
    measure: [
      hugo('Quatre-vingt-un et demi.'),
      odile('Mesure deux fois.'),
      hugo('Encore ?'),
      odile('Oui.'),
      hugo('…Quatre-vingt-un et demi.'),
      odile('Les portes mentent. Les encadrements, c’est pire. Donc on enlève un demi-centimètre côté charnières. Le rabot est au mur.'),
    ],
    grey: [
      odile('Maintenant. La couleur. Je veux un gris.'),
      hugo('Facile.'),
      odile('Un gris pas triste.'),
    ],
    greyMenu: {
      who: 'Odile',
      prompt: 'Cinq pots : blanc, noir, ocre, bleu, rouge oxyde.',
      options: [
        {
          text: 'Noir et blanc. Ça fait du gris.',
          correct: false,
          reply: 'Ça, c’est pas un gris. C’est une salle d’attente.',
        },
        {
          text: 'Plus de blanc. Pour l’égayer.',
          correct: false,
          reply: 'Là, c’est un gris triste qui fait semblant d’aller bien. Je connais le genre.',
        },
        {
          text: 'Du blanc, un peu de noir. Puis de l’ocre. Une goutte de bleu.',
          correct: true,
          reply: '…Voilà. Ça, c’est un gris qui a vécu.',
        },
      ],
    },
    greyLook: stage('Elle le regarde en disant ça.'),
    paintColor: '#8d877c',
    painted: [
      think('C’est gris. Je le jurerais devant un tribunal. C’est gris.'),
      odile('Évidemment que c’est gris. Arrête de la fixer, elle va se faire des idées.'),
    ],
  },
  week4: {
    sami: [
      sami('Odile ! Il refait le bruit. Le *zhhh, zhhh*. C’est monsieur Durand qui me l’a donné quand il a fermé. Il a dit de trouver un monsieur des roues.'),
      odile('Me regarde pas. Demande-lui. Les vélos, c’était son métier.'),
      hugo('J’ai passé douze ans à tirer d’autres types en haut des cols.'),
      sami('Pourquoi ?'),
      hugo('Pour qu’ils gagnent.'),
      sami('C’est débile.'),
      hugo('On me payait.'),
      sami('…C’est moins débile.'),
    ],
    bike: [
      think('La roue arrière est voilée. Un rayon s’est détendu, alors la jante se balade et vient embrasser le patin une fois par tour.'),
    ],
    hold: [
      hugo('Tiens le vélo. Les deux mains. N’aide pas.'),
      sami('Tenir, c’est pas aider ?'),
      hugo('Tenir, c’est toute ma carrière.'),
    ],
    truing: {
      cue: '[Espace] quand ça frotte au patin',
      shout: 'Quart de tour.',
      misses: {
        who: 'Sami',
        bag: [
          'C’était censé faire clonk ?',
          'Odile, il le tape !',
          'C’est réparé ? C’est pas réparé.',
        ],
      },
      assisted: sami('C’est réparé ? …C’est réparé.'),
    },
    after: [
      sami('Ça tourne droit ! Comment t’as su où ?'),
      hugo('Tu écoutes. La roue te dit où ça frotte.'),
      sami('Pourquoi t’as une chaussure de ski ?'),
      hugo('C’est une botte médicale. Je me suis cassé la jambe en courant.'),
      sami('En courant après quoi ?'),
    ],
    laughStage: [
      stage('Hugo rit. Ça sort rouillé, comme un truc oublié au fond d’une remise.'),
    ],
    laugh: [
      think('Tiens. Un rire. Je l’aurais enregistré, s’il y avait eu une case pour ça.'),
    ],
    wrap: [
      hugo('Ça, j’ai toujours su faire. Avant l’équipe, je montais mes roues moi-même. Les mécanos, c’était pour ceux qui gagnaient.'),
      odile('Alors écris-le.'),
    ],
  },
  week7: {
    raceBike: [
      think('J’ai décroché le vieux vélo. La chaîne d’abord. Puis tout le reste.'),
    ],
    stage: [
      stage('Odile lève le pinceau. La pointe frémit. Elle le repose.'),
    ],
    intro: [
      odile('Quarante ans, j’ai tiré des traits plus fins que ça. Les grandes lettres, je les mate encore. C’est les déliés.'),
      hugo('Plus fin qu’un cheveu.'),
      odile('Plus fin qu’un cheveu. Et tu le tires jusqu’au bout. Sans t’arrêter au milieu pour l’admirer.'),
      think('La dernière personne qui m’a dit ça tenait une radio de ma jambe.'),
      odile('J’ai besoin de quelqu’un pour—'),
      odile('…Tiens-moi cette planche.'),
      stage('Il la prend. Ni l’un ni l’autre n’en parle.'),
      odile('Tu as tenu un échafaudage. Tu peux tenir un pinceau. Même boulot. Tu ne bouges pas, puis tu bouges une fois.'),
      odile('La pancarte de la porte. O, P, E, N. Le O est impossible et le N est un piège.'),
    ],
    lettering: {
      paint: '#a3392b',
      tiers: {
        good: [
          odile('Propre. Va pas raconter que je l’ai dit.'),
        ],
        middle: [
          odile('Ça a du caractère. Personne ne veut d’une enseigne sans caractère.'),
        ],
        poor: [
          odile('C’est un peu pompette. Des lettres pompettes, ça dit quand même OPEN.'),
        ],
      },
    },
    signMenu: {
      who: 'Odile',
      prompt: 'Odile tapote le coin du bas. « Signe-le. »',
      options: [
        {
          text: 'En grand. Tout en bas.',
          correct: false,
          reply: 'C’est une pancarte, pas un gâteau d’anniversaire.',
        },
        {
          text: 'Je préfère pas.',
          correct: false,
          reply: 'Douze ans, tu as fait le boulot et c’est le nom d’un autre qu’on a mis en haut. Pas dans mon atelier.',
        },
        {
          text: 'En petit. Dans le coin.',
          correct: true,
          reply: 'Plus petit. Que seuls les gens du métier le trouvent.',
        },
      ],
    },
    signThink: [
      think('Douze ans. La première chose qui porte mon nom dit OPEN.'),
    ],
    buzz: 'ON BOUGE ! Immobile depuis 3 h 12 min.',
    buzzReply: '…Trois heures ?',
    wrap: [
      odile('STRIDE ne renouvelle pas le panneau. Dans un mois, il y aura vingt mètres de rien au milieu de toute cette laideur.'),
      hugo('…Tu veux le peindre.'),
      odile('Moi, je peux tenir une craie. La rue tiendra les pinceaux. Toi, tu fais le trait.'),
      hugo('Quel trait ?'),
    ],
  },
};
