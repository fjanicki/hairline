// Ch4 « Mesurer deux fois »: the workshop, Day 5 and Day 8 in the boot. Owned by the Ch4 agent.
// Revision 4 moved Week 4 to text/ch5.js (ch5.week4.*) and Week 7 to text/ch6.js (ch6.week7.*); oldSigns and
// radio stay here and the Ch5 / Ch6 workshop scenes read them from L.ch4 (docs/SCRIPT-R4.md §0.3).
// Source: docs/DESIGN.md. Notebook entries come from L.notebook.items (sand, measure, ...).
import { think, hugo, odile, stage } from './common.js';

export default {
  title: 'Mesurer deux fois',
  cards: {
    day5: ['Jour 5.'],
    day8: ['Jour 8.'],
  },
  objectives: {
    day5: 'Prendre le papier de verre.',
    sand: 'Poncer la porte.',
    day8: 'Mesurer l’encadrement.',
    // R4 (SCRIPT-R4 §5)
    day8Tape: 'Prendre le mètre.',
    hook: 'Ranger le mètre.',
  },
  prompts: {
    pegboard: 'Prendre le papier de verre',
    door: 'Poncer',
    frame: 'Mesurer',
    oldSigns: 'Regarder',
    radio: 'Écouter',
    // R4: the pegboard on Day 8 (take the tape; after the grey, hang it back)
    tapeTake: 'Prendre le mètre',
    hook: 'Ranger le mètre',
  },

  // R4: a hotspot that needs an item the pocket doesn't hold (SCRIPT-R4 §5).
  needs: {
    door: [think('Poncer à mains nues. J’ai connu des stages de préparation plus doux.')],
    frame: [think('Mesurer à l’œil. Odile me tuerait. Deux fois.')],
  },

  signs: {
    old: ['MARCHAL & FILLE', 'CAFÉ DU NORD', 'DÉFENSE D’AFFICHER'],
    open: 'OPEN',
    initials: 'H.R.',
  },

  // Optional, every day.
  oldSigns: [
    hugo('Marchal et Fille.'),
    odile('La fille, c’est moi. Mon père faisait les grandes lettres, moi les déliés. Puis il est mort et j’ai fait les deux.'),
  ],
  radio: [odile('Elle capte une station. Un monsieur qui parle de pêche. J’ai beaucoup appris sur la pêche.')],

  // ------------------------------------------------------------ Day 5
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
    // Notebook: add ride, run.
    strike: [
      odile('Tu peux faire l’un des deux, ce mois-ci ?'),
      hugo('…Non.'),
      odile('Alors tire un trait dessus. Légèrement. C’est un crayon, pas un tatouage.'),
    ],
    // Notebook: strike ride, run.
    strikeThink: [think('Trente-sept ans. Deux mots. Barrés tous les deux à dix heures dix. Efficace, au moins.')],
    holdStill: [odile('Tu sais ne pas bouger. Je t’ai vu faire. Écris-le.')],
    // Notebook: add hold.
    door: [odile('Maintenant, la porte. Neuf couches de peinture. Je veux voir le bois avant midi. Le papier de verre est au tableau.')],
    pegboard: [
      think('Chaque outil a sa silhouette peinte sur le tableau. Comme ça, on voit ce qui manque.'),
      think('Mon carnet d’entraînement, c’était pareil. Chaque jour de repos, un trou qu’il fallait regarder.'),
    ],
    grain: [odile('Dans le sens du fil, dans la longueur. Appuie pas. Laisse faire le papier.')],
    after: [
      odile('Tu as déjà fait ça, toi.'),
      hugo('Un truc du genre. Dans les cinquante millions de fois. J’ai fait le calcul, un jour. Un jour de repos.'),
      odile('Écris-le. Si tu sais le faire, ça va sur la liste. C’est la seule règle.'),
    ],
    // Notebook: add sand.
  },

  sanding: {
    gauge: 'PONÇAGE',
    hint: 'Régulier. Ou glisser d’un côté à l’autre, bouton de la souris enfoncé.',
    barks: {
      who: 'Odile',
      mash: ['Tu la ponces pas, tu te disputes avec.', 'Plus lent. Ce bois était là bien avant toi.'],
      cross: 'Dans le sens du fil. Un chat, ça se caresse dans le sens du poil.',
    },
    buzz: 'AVIRON DÉTECTÉ. LANCER LA SÉANCE ?',
    buzzReply: 'Non.',
  },

  // ------------------------------------------------------------ Day 8
  day8: {
    start: [odile('La porte retourne sur ses gonds. Elle fait quatre-vingt-deux de large. Mesure l’encadrement.')],
    // Measure twice, with the tape (crafts/tape.js). Readings 80.5 .. 82.5 cm, index (cm - 80.5) / 0.5.
    tape: {
      hint: 'Maintenir {Space} ou le bouton de la souris pour tirer. Lâcher à l’encadrement.',
      readings: [
        hugo('Quatre-vingts et demi.'),
        hugo('Quatre-vingt-un.'),
        hugo('Quatre-vingt-un et demi.'),
        hugo('Quatre-vingt-deux.'),
        hugo('Quatre-vingt-deux et demi.'),
      ],
      again: [
        hugo('…Quatre-vingts et demi.'),
        hugo('…Quatre-vingt-un.'),
        hugo('…Quatre-vingt-un et demi.'),
        hugo('…Quatre-vingt-deux.'),
        hugo('…Quatre-vingt-deux et demi.'),
      ],
      twice: [odile('Mesure deux fois.'), hugo('Encore ?'), odile('Oui.')],
      differ: [
        odile('Deux mesures. L’encadrement n’en a qu’une.'),
        odile('Il y en a une qui ment. Peut-être les deux.'),
        odile('Encore. L’encadrement va pas s’envoler.'),
      ],
      short: odile('Ça, c’est pas l’encadrement, c’est de l’air.'),
      help: [odile('Bouge pas. Je tiens le bout.')],
      cut: [
        odile('Les portes mentent. Les encadrements, c’est pire. Donc on enlève un centimètre et demi côté charnières. Le rabot est au mur.'),
        odile('Les portes mentent. Les encadrements, c’est pire. Donc on enlève un centimètre côté charnières. Le rabot est au mur.'),
        odile('Les portes mentent. Les encadrements, c’est pire. Donc on enlève un demi-centimètre côté charnières. Le rabot est au mur.'),
        odile('Les portes mentent. Les encadrements, c’est pire. Celui-là dit la vérité, apparemment. On la pose telle quelle.'),
        odile('Les portes mentent. Les encadrements, c’est pire. Un demi-centimètre de jour côté charnières. On appellera ça l’aération.'),
      ],
    },
    // Notebook: add measure.
    grey: [odile('Maintenant. La couleur. Je veux un gris.'), hugo('Facile.'), odile('Un gris pas triste.')],
    // The colour toy (crafts/mixer.js): tins in key order 1-5.
    mixer: {
      intro: [stage('Cinq pots : blanc, noir, ocre, bleu, rouge oxyde. Une seule gamelle.')],
      tins: ['Blanc', 'Noir', 'Ocre', 'Bleu', 'Rouge oxyde'],
      hint: '1 – 5 ou cliquer sur un pot : une goutte · {KeyT} vider · {KeyE} terminer',
      tip: 'Vider',
      done: 'Terminer',
      full: odile('Pleine. C’est pas une baignoire.'),
      verdicts: {
        waiting: [odile('Ça, c’est pas un gris. C’est une salle d’attente.')],
        light: [odile('Là, c’est un gris triste qui fait semblant d’aller bien. Je connais le genre.')],
        dark: [odile('Un enterrement. C’est une porte, pas un corbillard.')],
        ochre: [odile('Ça, c’est pas du gris. C’est du flan.')],
        blue: [odile('Trop froid. Ce gris-là attend le bus.')],
        red: [odile('Ça vire au rose. Une porte rose. Toute la rue en jaserait.')],
        mud: [odile('De la boue. Honnête, mais de la boue. Vide-moi ça.')],
        target: [odile('…Voilà. Ça, c’est un gris qui a vécu.')],
      },
      hints: [
        odile('Le blanc d’abord. Puis le noir, goutte à goutte. Comme les ragots.'),
        odile('Cinq de blanc, une de noir. Deux d’ocre. Une de bleu, pour le calmer.'),
      ],
      // Instead of hints[0] when he's already got a plain grey (waiting / light).
      warm: odile('Le gris y est. Maintenant, une goutte d’ocre. Chaud, pas jaune.'),
      give: [odile('Donne-moi ça.'), stage('Elle vide la gamelle et refait tout en quatre gestes, sans regarder.')],
    },
    // Stage beat after the first "I know the type" verdict (she looks at him).
    greyLook: stage('Elle le regarde en disant ça.'),
    paintColor: '#8d877c',
    painted: [think('C’est gris. Je le jurerais devant un tribunal. C’est gris.'), odile('Évidemment que c’est gris. Arrête de la fixer, elle va se faire des idées.')],
    // Notebook: add grey.

    // R4: the pegboard before the frame (item+ tape).
    tapeTake: [think('Le mètre a sa silhouette, lui aussi. Si je le prends, ça se verra. C’est le principe.')],
    // R4: after the grey (objective `hook`), Hugo at the pegboard. The chapter's last lines.
    hook: [
      odile('Garde-le. Quelqu’un qui mesure deux fois a droit à son mètre.'),
      stage('Sur le tableau, juste à côté de la place du mètre, une silhouette vide. Une clé à rayons.'),
      hugo('Il manque la clé à rayons.'),
      odile('Je sais.'),
      odile('Quelqu’un m’a emprunté ma clé à rayons. Personne n’emprunte chez moi. Les gens ont peur de moi. J’y ai beaucoup travaillé.'),
      hugo('Ça se voit.'),
      odile('Merci.'),
      think('Une silhouette vide. Ce soir-là, je n’ai pas dormi. Rien de nouveau. Mais pour une fois, je ne pensais pas à ma jambe.'),
    ],
  },
};
