// HAIRLINE FR text: ch3.js. Mirrors ../ch3.js exactly (same keys, array lengths and line flags).
// Check with: node scripts/i18n-check.mjs fr
import { dr, hugo, odile } from '../common.js';

export default {
  title: 'À la longue',
  signs: {
    bakery: 'BOULANGERIE',
  },
  objectives: {
    run: 'Garder le rythme.',
    finish: 'Aller au bout.',
  },
  keys: {
    both: '[Q / D]',
    a: '[Q]',
    d: '[D]',
  },
  gauge: {
    label: 'CADENCE',
    unit: 'ppm',
    scale: 60,
  },
  cadence: {
    mash: 'Tranquille. C’est long.',
    low: 'Ne pas laisser tomber.',
    steady: 'Voilà. C’est ça.',
  },
  weekLabel: 'CETTE SEMAINE',
  weeks: [
    {
      caption: 'BLOC D’ENTRAÎNEMENT — SEMAINE 9 — 5 H 12 — LA BOUCLE',
      length: 60,
      total: 104.2,
      thoughts: {
        15: 'Le vélo, c’étaient les courses des autres. Celle-ci est à moi. Chaque mètre.',
        45: 'À cette heure-là, la seule autre lumière allumée, c’est la boulangerie. Je la bats tous les matins.',
      },
      stride: {
        prompt: 'STRIDE : Six jours d’affilée ! La récup fait partie de l’entraînement. Un jour de repos ?',
        options: [
          {
            text: 'Jour de repos',
            reply: 'Jour de repos. Bonne idée. Demain.',
          },
          {
            text: '10 km tranquille',
            reply: 'Un petit dix tranquille. Tranquille, c’est un état d’esprit.',
          },
          {
            text: 'Ignorer',
            reply: 'Ignoré.',
          },
        ],
      },
    },
    {
      caption: 'BLOC D’ENTRAÎNEMENT — SEMAINE 20 — 5 H 04 — LA BOUCLE, DEUX FOIS',
      length: 40,
      total: 168,
      thoughts: {
        10: 'Il y a un point sur le tibia, grand comme une pièce. Je n’appuie pas dessus. Si je n’appuie pas, il n’existe pas.',
        30: 'Tout le monde a le tibia un peu bavard. C’est Bastien qui le dit.',
      },
      stride: {
        prompt: 'STRIDE : Charge d’entraînement ÉLEVÉE. Ton corps a besoin de repos.',
        options: [
          {
            text: 'Repos (demain)',
            reply: 'J’ai dit demain. Sur le moment, je le pensais.',
          },
          {
            text: 'Courir',
            reply: null,
          },
          {
            text: 'Courir quand même',
            reply: 'Quand même. Mon allure préférée.',
          },
        ],
      },
    },
    {
      caption: 'BLOC D’ENTRAÎNEMENT — SEMAINE 31 — SAMEDI, 4 H 47 — LA BOUCLE, TROIS FOIS',
      length: 40,
      total: 170.2,
      thoughts: {
        10: 'Deux ibuprofènes. L’escalier. Le chemin le plus long.',
        30: 'Quand ça fait mal, je compte. Compter, c’est un antidouleur, à forte dose.',
      },
      stride: {
        prompt: 'STRIDE : Course demain ! Affûtage terminé ?',
        options: [
          {
            text: 'Oui',
            reply: [
              'Oui.',
              'Mentir à une montre, ce n’est pas mentir.',
            ],
          },
          {
            text: 'Repos (après dimanche)',
            reply: 'Repos après dimanche. J’étais très ferme là-dessus.',
          },
          {
            text: 'Reporter',
            reply: 'Reporter. Toute mon année en un mot.',
          },
        ],
      },
    },
  ],
  sunday: [
    'Dimanche.',
  ],
  race: {
    caption: 'MARATHON STRIDE — KM 29',
    label: 'MARATHON',
    faceStart: 29,
    boards: [
      'KM 29',
      'KM 30',
      'KM 31',
    ],
    banners: [
      'STRIDE',
      'NE T’ARRÊTE JAMAIS',
      'MARATHON STRIDE',
    ],
    thoughts: {
      km30: 'Trente. C’est ici, paraît-il, qu’on prend le mur.',
      km30plus: 'Je n’ai jamais pris le mur. Pas une fois. J’en étais très fier.',
    },
  },
  crack: [
    'Ce n’était pas fort. On aurait dit une mine de crayon qui casse, quelque part dans un tiroir.',
    'Je me souviens avoir pensé : plus que onze.',
  ],
  keepGoing: 'J’aurais pu m’arrêter. Je veux que ce soit noté. J’aurais pu m’arrêter.',
  finish: {
    face: '42,2 km',
    lap: '3:04:51',
    buzz: 'BEL EFFORT !',
    weekLabel: 'CETTE SEMAINE',
    weekFrom: 170.2,
    weekTo: 212.4,
  },
  doctor: [
    dr('Vous voyez, là ? Non. Là.'),
    dr('Le trait est plus fin qu’un cheveu, monsieur Revel. Mais il va jusqu’au bout.'),
  ],
  present: [
    odile('Alors ? Jusqu’où ?'),
    hugo('Deux cent douze virgule quatre.'),
    odile('En une semaine ?'),
    hugo('En une semaine.'),
    odile('Et vous alliez où, comme ça ?'),
    hugo('…C’était une boucle.'),
  ],
};
