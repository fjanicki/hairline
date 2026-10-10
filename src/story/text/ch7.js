// Ch7 « Le Mur » (Ch5 before Revision 4; keys ch5.* became ch7.*): Rue des Tanneurs, day, then golden hour
// (Week 12). Owned by the Ch7 agent. Source: docs/DESIGN.md, docs/SCRIPT-R4.md §8.
// Source: docs/DESIGN.md. Street signs shared with Ch2 live in L.ch2.signs.
// Lou and Gérard keep their old key ids (ines, marco, inesBike, marcoPanel, panel ids): the chapter
// and scene code read them.
import { think, hugo, odile, sami, bastien, lou, gerard, jo, durand, stage, NAMES } from './common.js';

export default {
  title: 'Le Mur',
  cards: {
    weeks10: ['Semaines 10 et 11.'], // SCRIPT-R4 §8 (card, then ch7.weeks10), before « Semaine 12. »
    week12: ['Semaine 12.'], // moved from ch4.cards.week12 (SCRIPT-R4 §0.3)
  },
  // After the « Semaines 10 et 11. » card, over black (SCRIPT-R4 §8).
  weeks10: [think('Monsieur Durand apprend à Sami à monter une roue. Sami lui apprend à éteindre sa montre. Chacun trouve l’autre très lent.')],
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
    durandPanel: 'Parler', // R4: M. Durand in his chair next to Odile's
    joPanel: 'Parler', // R4: Jo at her swallow, the smallest panel on the wall
    // Street jobs (optional).
    shutter: 'Réparer le rideau',
    radio: 'Régler la radio',
    board: 'Repeindre les lettres',
    inesBike: 'Regarder la roue',
  },

  signs: {
    shopCard: 'CREVAISONS RÉPARÉES\nDEMANDER AU N° 14\n(ou M. Durand, avant 21 h)', // one line each (on one line it auto-fits under 8 px); the last in Durand's hand
    open: 'OPEN', // fallback if minigames.memory.openSign is missing
    initials: 'H.R.',
    marcoPanel: ['SUPER', 'KEBAB'], // painted either side of Gérard's kebab (EXCELLENT overruns the panel)
    sketch: '20 m — mesurer deux fois', // Odile's chalk-blue plan on the workbench
    rest: 'repos', // painted under the watch outline by the nail
    // Mural panels, along the wall from z -12 to -32 (bakery end to kebab end).
    panels: [
      { id: 'benali', label: 'un croissant devenu lune', color: '#e8c27a' },
      { id: 'ines', label: 'le lettrage de Lou', color: '#c24a6a' },
      { id: 'sami', label: 'le vélo de Sami', color: '#c24a3a' },
      { id: 'odile', label: 'la main à la craie d’Odile', color: '#9a7a4e' },
      { id: 'marco', label: 'un excellent kebab', color: '#d98a3a' },
      // R4 (SCRIPT-R4 §8). Appended so the five indices above don't move; scene5/r4wall.js lays all seven out
      // along the wall (Durand's key beside Odile's hand, Jo's swallow, the smallest, at the kebab end).
      { id: 'durand', label: 'la clé de M. Durand', color: '#b08d57' },
      { id: 'jo', label: 'l’hirondelle de Jo', color: '#6b2430' },
    ],
  },

  opening: [
    odile('Te voilà. T’es en retard.'),
    hugo('J’ai pris le chemin le plus long. C’était sympa.'),
    think('Sympa. J’ai dit « sympa » à propos d’une balade. À voix haute.'),
    odile('La moitié de la rue est coincée, voilée, passée ou grésillante. Avant ton trait, si tes mains s’ennuient.'),
  ],

  // ------------------------------------------------------------ M. Durand (R4, SCRIPT-R4 §8)
  durand: {
    // At Odile's chair, straight after `opening` (part of 'meet').
    meet: [
      durand('Bonjour, jeune homme. J’ai dormi jusqu’à huit heures et demie.'),
      durand('Huit heures et demie. J’ai cru que j’étais mort.'),
      stage('Odile montre du menton la peinture de Durand : une clé à rayons, grandeur nature.'),
      odile('Albert. Ma clé.'),
      durand('Ta clé, Odile. Je l’ai faite pour ton père.'),
      odile('Je sais. Il me l’a dit en 1971.'),
      hugo('Tu savais ?'),
      odile('Depuis le bleu. C’est moi qui l’ai fait, ce bleu. Pour sa devanture. En 1979.'),
      hugo('Et tu m’as laissé chercher six semaines.'),
      odile('Tu avais besoin d’une enquête. Lui avait besoin qu’on le trouve.'),
      odile('Moi, j’avais besoin de rien.'),
      stage('Durand la regarde. Il ne dit rien. Ça fait cinquante ans qu’il ne dit rien.'),
    ],
    // Optional hotspot `durandPanel` (« Parler »).
    panel: [
      durand('Odile a dit de peindre ce qu’on sait faire. Je sais faire une clé. Une seule. Il y a cinquante-cinq ans.'),
      hugo('Elle tient.'),
      durand('Elle tient.'),
    ],
  },

  // ------------------------------------------------------------ Jo (R4, SCRIPT-R4 §8, §11)
  jo: {
    // Optional hotspot `joPanel` (« Parler »).
    panel: [
      jo('La plus petite peinture du mur. Pis la plus propre. Je dis ça de même.'),
      jo('Une hirondelle. Ma toute première. Je me l’étais faite sur la cheville, à seize ans. Elle est toute croche. C’est celle que j’aime le plus.'),
      jo('Une hirondelle, ça revient toujours. Ça a pas besoin de beaucoup de place. Juste d’une place.'),
      hugo('Elle a une place.'),
      jo('…Ben là. Fais pas ça en public.'),
    ],
    // After `line.photo`, before the run club (required). Then notebook: add(cook, {hand: 'jo', note: learning}),
    // then `warm` (joWarmth() >= 3) or `cool`, then `bye` (both).
    supper: {
      ask: [
        jo('Tu me dois un souper.'),
        hugo('Pourquoi ?'),
        jo('La soupe. La planque. Pis parce que.'),
        jo('Tu sais cuisiner ?'),
        hugo('Non.'),
        jo('Ben, tu vas apprendre.'),
        stage('Elle lui prend le carnet et écrit une ligne, en tout petit.'),
      ],
      warm: [stage('Elle l’embrasse sur la joue. Vite. Comme on signe dans un coin.'), think('En petit. Dans le coin.')],
      cool: [stage('Elle lui donne une tape sur l’épaule. Une bonne.')],
      bye: [jo('Samedi, sept heures. Apporte rien. Surtout pas ta montre.')],
    },
  },

  // Optional (SHOULD).
  benali: [{ who: 'Mme Benali', text: 'Je voulais peindre un croissant. Ça a donné un croissant de lune. J’ai décidé que c’était la lune.' }],
  ines: [
    lou('J’ai tagué ce mur huit fois. C’est la première fois qu’on me *tend* la peinture.'),
    hugo('Ça fait quoi ?'),
    lou('Bizarre. Légal.'),
  ],
  marco: [
    gerard('Odile a dit de peindre ce qu’on sait faire. Moi, je fais un très bon kebab. Donc.'),
    hugo('C’est un bon kebab.'),
    gerard('C’est un *excellent* kebab.'),
  ],
  shopCard: [think('L’écriture de Sami. Mon orthographe.'), think('La dernière ligne est d’une autre écriture. Penchée, à l’ancienne.')],
  boltHoles: [think('La montre me disait de me reposer. Le panneau me disait de ne jamais m’arrêter. J’ai écouté le plus gros.')],

  // ------------------------------------------------------------ Street jobs (optional, before the line)
  jobs: {
    shutter: {
      near: { who: 'Mme Benali', text: 'Il ne crie plus, grâce à monsieur Durand. Mais il se bloque toujours à mi-hauteur. Il n’a pas pensé à tout.' },
      // Called from up the street after Teach, if he's far off and it's still stuck.
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
      near: gerard('Mon chevalet est si passé qu’on nous croit fermés.'),
      word: 'KEBAB', // as-is signage, same in every language
      tiers: {
        good: [gerard('Ça, c’est un excellent chevalet.')],
        middle: [gerard('Il a du caractère. Comme le kebab.')],
        poor: [gerard('Il est un peu pompette. Comme la moitié de mes clients, après minuit.')],
      },
    },
    wheel: {
      near: sami('Lou s’est pris un trottoir. Les crevaisons, c’est moi. Les roues tordues, c’est toi.'),
      // trueWheel's text (hint, gauge and pitch words come from L.ch5.week4.truing).
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
      done: sami('Lou ! Ta roue chante, maintenant !'),
    },
  },

  // Odile, once, at the first "Ready" while a street job is still open (Ready closes them).
  readyCheck: {
    who: 'Odile',
    prompt: 'Personne te chronomètre.',
    options: [{ text: 'Prêt.', correct: true }, { text: 'Pas encore.' }],
  },

  // ------------------------------------------------------------ Teach
  teach: {
    call: [sami('Hugo ! Elle a encore sauté !')],
    menu: {
      who: 'Sami',
      prompt: 'La chaîne a sauté du plateau. Il a déjà les mains noires.',
      options: [
        { text: 'Donne, je vais le faire.', correct: false, reply: 'C’est toujours toi qui le fais. Après, elle saute quand t’es pas là.' },
        { text: 'Un bon coup de pied. Ferme.', correct: false, reply: 'C’est comme ça qu’Odile répare la radio. La radio est toujours en panne.' },
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
      { who: null, text: '*Sami la lit, lèche le crayon et écrit quelque chose.*' },
      sami('T’en as oublié un.'),
    ],
    // Notebook: add L.notebook.items.teach with { hand: 'sami' }.
    // R4: a bark after Teach, if M. Durand is within 6 m.
    durand: { who: NAMES.durand, text: 'Bien. Je lui aurais dit la même chose. Plus lentement.' },
  },

  // ------------------------------------------------------------ Hugo's panel (inside 'Ready', before the line)
  panel: {
    ask: [
      odile('D’abord, une chose. Là-haut, où il y avait le panneau. Personne n’en a voulu.'),
      hugo('Alors c’est à moi.'),
      odile('Peins ce que tu sais faire. En petit, si tu veux.'),
    ],
    // Options in motif order: wheel, door, hand (a skip picks the door).
    menu: {
      prompt: 'Quelque chose de la liste.',
      options: [
        { text: 'Une roue. Dévoilée.', reply: null },
        { text: 'La porte. Ce gris-là.', reply: null },
        { text: 'Une main qui tient un pinceau, sans bouger.', reply: null },
      ],
    },
    stage: [stage('Odile tient l’échelle. À deux mains. Elle n’aide pas.')],
    after: {
      wheel: [odile('Une roue. Sami va dire que c’est la sienne.')],
      door: [odile('Ma porte. Plus haut que je l’aurais accrochée.')],
      hand: [odile('La main sûre. Crâneur.')],
    },
  },

  // ------------------------------------------------------------ The line
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
    end: [think('Vingt mètres. Je n’ai pas chronométré.')],
    tiers: {
      good: [odile('Plus fin qu’un cheveu. À un cheveu près.')],
      middle: [odile('C’est un trait fait main.')],
      poor: [odile('C’est un trait fait main, en botte. Pareil, en plus bruyant.')],
    },
    sign: [odile('Signe-le.'), hugo('En petit ?'), odile('Tu apprends.')],
    photo: [lou('Mettez-vous devant.'), hugo('Une photo du mur ?'), lou('De vous. Devant le mur. C’est le principe d’une photo.')],
  },

  // ------------------------------------------------------------ Run club
  club: {
    greet: [bastien('HUGO ! Alors, les loisirs créatifs ? La botte, c’est bientôt fini, hein ? On va te remettre à deux cents par semaine !')],
    // [E] Wave, then:
    after: [
      hugo('Peut-être vingt.'),
      bastien('Par jour ?'),
      hugo('Par semaine.'),
      bastien('…C’est permis, ça ? J’ai le tibia un peu bavard, d’ailleurs. Mais bon, comme tout le monde !'),
      hugo('Va le faire voir.'),
      bastien('Ha ! Après dimanche !'),
    ],
    // After he fades out.
    afterThoughts: [think('Il a trottiné sur place tout du long, pour que sa montre ne se mette pas en pause.'), think('Tant mieux pour lui.')],
  },

  // ------------------------------------------------------------ The boot
  boot: {
    ask: [
      odile('C’est aujourd’hui, hein. La botte.'),
      hugo('Radio ce matin. Le docteur Okafor a dit : « Rien à signaler. » La plus belle chose qu’un médecin m’ait jamais dite.'),
      odile('Douze semaines depuis le dimanche. J’ai compté. T’es pas le seul dans cette rue à savoir compter.'),
      odile('Assieds-toi. J’ai une scie à métaux si le scratch fait des histoires.'),
    ],
    light: [think('La jambe était légère. Comme si elle ne savait pas encore à quoi elle servait.')],
    walk: [odile('Un tour de pâté de maisons, puis tu rentres. Ta jambe se débrouillera.')],
  },

  // ------------------------------------------------------------ Final walk
  walk: {
    // Non-blocking barks in order, as Sami rides past.
    sami: [
      { who: 'Sami', text: 'Hugo ! Ça frotte même plus !' },
      { who: 'Hugo', text: 'Les mains sur le guidon !' },
      { who: 'Sami', text: '…*Ça va !*' },
    ],
    firstJog: 'Tranquille. Tranquille, c’est une allure.',
    stopped: 'Je me suis arrêté. Personne ne m’y a obligé. Que ce soit noté aussi.',
    mural: 'Mon trait court sous les peintures de tout le monde. Il les soutient un peu.',
    bike: 'Quatre ans au crochet. Il a suffi d’un après-midi et d’une brosse à dents.',
    // R4 barks, once each: passing CYCLES DURAND (Durand and Sami at the open shop), then ENCRE FINE (warmth).
    durand: { who: NAMES.durand, text: 'Bonsoir, jeune homme. Je ferme à neuf heures, maintenant. Comme tout le monde.' },
    jo: {
      warm: { who: NAMES.jo, text: 'Samedi, le grand ! C’est moi qui fais le dessert !' },
      cool: { who: NAMES.jo, text: 'Samedi ! Pis pas de sauce en pot !' },
    },
    watchHud: { face: '0,0 km', label: 'COURSE · SEMAINE', lap: null },
    outline: [think('Elle avait déjà peint la silhouette.')],
    restMenu: {
      prompt: 'STRIDE : Aucun mouvement détecté. ON BOUGE ?',
      options: [
        { text: 'Bouger', reply: '…Non. Repos.' },
        { text: 'Repos', reply: null },
      ],
    },
    // Notebook finale: strike(ride,false), strike(run,false), annotate(run, someSundays), add(rest).
    crane: [
      think('Deux cent douze virgule quatre kilomètres. Je ne me souviens pas d’un seul mètre.'),
      think('Vingt mètres de trait. Il tremble à hauteur du kebab. Je me souviens de tout.'),
    ],
  },
};
