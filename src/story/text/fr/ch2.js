// HAIRLINE FR text: ch2.js. Mirrors ../ch2.js exactly (same keys, array lengths and line flags).
// Check with: node scripts/i18n-check.mjs fr
import { bastien, hugo, odile, stage, think } from '../common.js';

export default {
  title: 'Ne t’arrête jamais',
  objectives: {
    start: 'Marcher.',
    hold: 'Tenir l’échafaudage.',
  },
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
    kebab: 'CHEZ MARCO',
    bakery: 'BOULANGERIE BENALI',
    number: 'N° 14',
    fasciaStart: 'RÉPARATI',
    fascia: 'RÉPARATIONS.',
  },
  lapStart: '38:40',
  lapEnd: '41:10',
  start: 'Trente-huit minutes. Trois cent vingt mètres. Trois étages, une marche à la fois, avec une botte.',
  pauseBuzz: 'ALLURE TROP LENTE. METTRE EN PAUSE ?',
  pauseReply: 'Non.',
  ghost: [
    think('Quelqu’un a peint ça à la main, avant ma naissance. La boutique a disparu depuis longtemps. Les lettres, personne ne les a prévenues.'),
  ],
  billboard: [
    think('Ne t’arrête jamais. Je l’ai pris comme un conseil. C’était un slogan pour des baskets.'),
  ],
  club: [
    bastien('Hugo ! Mon pote ! Et cette jambe ?'),
    hugo('Fracture de fatigue.'),
    bastien('La classique ! Trop de bornes, hein ?'),
    hugo('Il y en a d’autres ?'),
    bastien('Ha ! Repose-toi, la légende. Le classement s’ennuie sans toi.'),
  ],
  clubAfter: [
    think('Il a trottiné sur place tout du long, pour que sa montre ne se mette pas en pause.'),
    think('J’aurais fait pareil. J’aurais fait exactement pareil.'),
  ],
  shop: [
    think('Cinquante-deux ans, et ils ont eu droit à une pancarte de remerciement. Quand j’ai arrêté, l’équipe m’a envoyé une corbeille de fruits. Sur la carte, c’était écrit « Hugues ».'),
  ],
  bench: [
    think('Banc mouillé, dans le noir. Si le club repasse, je m’étire.'),
  ],
  arrivalLoop: [
    think('Un tour de pâté de maisons. Quarante et une minutes. Retour à la case départ.'),
  ],
  arrival: [
    odile('Vous. Avec la botte.'),
    hugo('Moi ?'),
    odile('Non, l’autre bonhomme en botte. Le frein de roue a lâché. Tenez l’échafaudage avant que je descende plus vite que prévu.'),
    odile('Vous savez ne pas bouger ?'),
    think('Franchement ? Plus depuis mes dix-neuf ans.'),
  ],
  hold: {
    gauge: 'IMMOBILE',
    barks: {
      who: 'Odile',
      bag: [
        'Bougez pas.',
        'Bougez plus.',
        'Vous êtes un réverbère. Un réverbère, ça gigote pas.',
        'Je fais un S, là-haut. Les S, c’est personnel.',
      ],
    },
    buzz: 'ON BOUGE !',
    buzzReply: 'Pas maintenant.',
  },
  after: [
    odile('Réparations. Onze lettres et un point. Vous faites un réverbère tout à fait correct.'),
    odile('Vous êtes au troisième. Tous les matins à quatre heures, dans l’escalier comme une armoire qu’on aurait lâchée.'),
    hugo('J’allais courir. Et deux fois le dimanche.'),
    odile('Hum.'),
    stage('Elle regarde longuement la botte.'),
    odile('J’ai une porte, là-dedans, à décaper. Et vous, à vous voir, vous n’avez rien à faire.'),
    hugo('J’ai plein de choses à faire.'),
    odile('Citez-en une.'),
  ],
  nameOne: {
    who: 'Odile',
    prompt: 'Citez-en une.',
    options: [
      {
        text: 'Kiné. Rotations de cheville, trois séries de vingt.',
        correct: false,
        reply: 'Ça, c’est pas une chose à faire. C’est une chose à compter.',
      },
      {
        text: 'L’entraînement. J’ai un plan.',
        correct: false,
        reply: 'Avec cette botte ? C’est quoi, le plan ? Du fractionné assis ?',
      },
      {
        text: '…Rien.',
        correct: true,
        reply: 'Demain, dix heures. Apportez votre café. Le mien est un crime.',
      },
    ],
  },
  leaving: [
    odile('Vous lui avez fait quoi ? À la jambe.'),
    hugo('Rien. C’est ça, le plus bête. Il ne s’est rien passé. J’ai juste couru.'),
    odile('Jusqu’où ?'),
  ],
  howFarLap: 'SEM. PRÉC. 212,4',
  flare: '#c6f432',
};
