// Ch2 « Ne t’arrête jamais »: Rue des Tanneurs, late evening, rain. Owned by the Ch2 agent. Source: docs/DESIGN.md.
// scene2.js also builds the Ch5 'wall' variant, so `signs` here are shared with Ch5.
import { think, hugo, odile, bastien, jo, stage, NAMES } from './common.js';

export default {
  title: 'Ne t’arrête jamais',
  objectives: { start: 'Marcher.', hold: 'Tenir l’échafaudage.' },
  prompts: {
    ghost: 'Regarder',
    billboard: 'Lever les yeux',
    shop: 'Regarder',
    bench: 'S’asseoir',
    stand: 'Se lever',
  },

  signs: {
    billboard: 'STRIDE — NE T’ARRÊTE JAMAIS',
    ghost: 'MARCHAL & FILLE — ENSEIGNES — DORURE',
    shop: 'CYCLES DURAND — FERMÉ — MERCI POUR CES 52 ANS',
    kebab: 'CHEZ GÉRARD',
    bakery: 'BOULANGERIE BENALI',
    number: 'N° 14',
    fasciaStart: 'RÉPARATI',
    fascia: 'RÉPARATIONS.',
  },

  // Watch: seeded from L.watch.atChapter[1]. The lap is derived from progress along z.
  lapStart: '38:40',
  lapEnd: '41:10',

  // Non-blocking, at chapter start.
  start: 'Trente-huit minutes. Trois cent vingt mètres. Trois étages, une marche à la fois, avec une botte.',

  // z < -6
  pauseBuzz: 'ALLURE TROP LENTE. METTRE EN PAUSE ?',
  pauseReply: 'Non.',

  ghost: [
    think('Quelqu’un a peint ça à la main, avant ma naissance. La boutique a disparu depuis longtemps. Les lettres, personne ne les a prévenues.'),
  ],
  // Non-blocking, if he stays put by the ghost sign after `ghost`.
  ghostLinger: 'Ce sont les déliés qui ont le mieux tenu. On aurait cru l’inverse.',
  billboard: [think('Ne t’arrête jamais. Je l’ai pris comme un conseil. C’était un slogan pour des baskets.')],

  // z < -24
  club: [
    bastien('Hugo ! Mon pote ! Et cette jambe ?'),
    hugo('Fracture de fatigue.'),
    bastien('La classique ! Trop de bornes, hein ?'),
    hugo('Il y en a d’autres ?'),
    bastien('Ha ! Repose-toi, la légende. Le classement s’ennuie sans toi.'),
  ],
  // After Bastien fades out at z -46.
  clubAfter: [
    think('Il a trottiné sur place tout du long, pour que sa montre ne se mette pas en pause.'),
    think('J’aurais fait pareil. J’aurais fait exactement pareil.'),
  ],

  shop: [
    think('Cinquante-deux ans, et ils ont eu droit à une pancarte de remerciement. Quand j’ai arrêté, l’équipe m’a envoyé une corbeille de fruits. Sur la carte, c’était écrit « Hugues ».'),
  ],
  bench: [think('Banc mouillé, dans le noir. Si le club repasse, je m’étire.')],

  // z < -42
  arrivalLoop: [think('Un tour de pâté de maisons. Quarante et une minutes. Retour à la case départ.')],
  arrival: [
    odile('Vous. Avec la botte.'),
    hugo('Moi ?'),
    odile('Non, l’autre bonhomme en botte. Le frein de roue a lâché. Tenez l’échafaudage avant que je descende plus vite que prévu.'),
    odile('Vous savez ne pas bouger ?'),
    think('Franchement ? Plus depuis mes dix-neuf ans.'),
  ],

  // HOLD STILL minigame.
  hold: {
    gauge: 'IMMOBILE',
    barks: {
      who: 'Odile',
      bag: ['Bougez pas.', 'Bougez plus.', 'Vous êtes un réverbère. Un réverbère, ça gigote pas.', 'Je fais un S, là-haut. Les S, c’est personnel.'],
    },
    buzz: 'ON BOUGE !',
    buzzReply: 'Pas maintenant.',
  },

  after: [
    odile('Réparations. Onze lettres et un point. Vous faites un réverbère tout à fait correct.'),
    odile('Vous êtes au troisième. Tous les matins à quatre heures, dans l’escalier comme une armoire qu’on aurait lâchée.'),
    hugo('J’allais courir. Et deux fois le dimanche.'),
    odile('Hum.'),
    { who: null, text: '*Elle regarde longuement la botte.*' },
    odile('J’ai une porte, là-dedans, à décaper. Et vous, à vous voir, vous n’avez rien à faire.'),
    hugo('J’ai plein de choses à faire.'),
    odile('Citez-en une.'),
  ],

  nameOne: {
    who: 'Odile',
    prompt: 'Citez-en une.',
    options: [
      { text: 'Kiné. Rotations de cheville, trois séries de vingt.', correct: false, reply: 'Ça, c’est pas une chose à faire. C’est une chose à compter.' },
      { text: 'L’entraînement. J’ai un plan.', correct: false, reply: 'Avec cette botte ? C’est quoi, le plan ? Du fractionné assis ?' },
      { text: '…Rien.', correct: true, reply: 'Demain, dix heures. Apportez votre café. Le mien est un crime.' },
    ],
  },

  leaving: [
    odile('Vous lui avez fait quoi ? À la jambe.'),
    hugo('Rien. C’est ça, le plus bête. Il ne s’est rien passé. J’ai juste couru.'),
    odile('Jusqu’où ?'),
  ],
  howFarLap: 'SEM. PRÉC. 212,4', // watch lap line during "How far?"
  flare: '#c6f432', // ui.watchFocus(true, { flare }) before the cut to white

  // ------------------------------------------------------------ Revision 4 (docs/SCRIPT-R4.md §3)
  // z < -9, non-blocking: Mme Benali pulls her shutter down (it screams, in three jerks); her bark, then his thought.
  shutter: {
    bark: { who: NAMES.benali, text: 'Pardon ! Il crie. Treize ans qu’il crie.' },
    thought: 'Je rentrais de mes sorties sur ce cri. Six heures pile. Il me servait de ligne d’arrivée.',
  },
  // After the club, at ENCRE FINE (spots.joLadder): Jo on her stepladder with a crooked sign. Blocking, short.
  jo: {
    call: [jo('Hey, le grand avec la botte ! C’est-tu droit ?')],
    // d.choose (who: Jo): the reply is played by the Director. Option 1 = remember('joSign', true).
    menu: {
      who: NAMES.jo,
      prompt: 'L’enseigne penche nettement à gauche.',
      options: [
        { text: 'C’est de travers.', reply: 'Ben non. C’est parfait.' },
        { text: 'C’est parfait.', reply: 'Voyons donc. C’est tout croche.' },
      ],
    },
    // [0] she straightens the sign; [1..6] the exchange; [7] she climbs down and goes in; [8] his thought.
    after: [
      stage('Elle redresse l’enseigne d’un coup de paume, sans niveau, du premier coup.'),
      jo('Tiguidou.'),
      jo('Belle botte. Très mode.'),
      hugo('C’est une botte médicale.'),
      jo('Ça empêche pas.'),
      hugo('Vous ouvrez quand ?'),
      jo('Tu. On est pas à la banque. Lundi.'),
      stage('Elle descend de l’échelle et rentre. La porte claque.'),
      think('Encre fine. Je ne savais même pas qu’il y avait une boutique, là. Je passais devant à quinze kilomètres-heure.'),
    ],
  },
};
