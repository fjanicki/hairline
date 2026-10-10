// Revision 4 minigame text for Ch6 (L.games.<id>): KEBAB, KEY RING, STENCIL, DEDUCTION, STAKEOUT. Owned by the
// Ch6 agent. Source: docs/SCRIPT-R4.md §7.6 (§17.3 for the built modules' opts shapes). The chapter passes it
// to the game: d.game('keyring', { text: L.games.keyRing, ... }) (the key ring's game id is 'keyring').
// Lines the script lacks keep the module's French fallback (checked against docs/i18n-fr.md); once `text` is
// passed, a module's own extra lines stay silent.
import { hugo, jo, stage } from '../common.js';

export default {
  // §7.6.1 KEBAB WRAP (Week 6, 1 h): two orders, the tea between them, tiers by mistakes (0–1 / 2–4 / 5+).
  kebab: {
    prompts: {
      fill: 'Glisser les garnitures sur la galette, dans l’ordre',
      fold: 'Glisser la galette vers le haut pour la plier',
    },
    tubs: 'Salade · Tomate · Oignons · Viande · Frites · Sauce blanche · Samouraï',
    ticket: 'COMMANDE',
    stamp: 'CHEZ GÉRARD',
    counter: 'Kebab {n}/2',
    orders: [
      { call: 'Une complète ! Salade, tomate, oignons… non, pas d’oignons ! Viande, sauce blanche.' },
      { call: 'Viande, frites dedans, samouraï. Pas de salade, il est allergique. À la salade.' },
    ],
    tea: 'Un thé ! Sans sucre ! Au bout du comptoir !',
    // The chapter's onTea() stage line (d.say) while the glass slides and the cap blurs past.
    teaStage: [stage('Gérard lui met un verre de thé dans la main. Hugo le pose au bout du comptoir sans lever les yeux. Une casquette plate, floue, au bord du cadre. Des pièces de dix centimes sur le zinc.')],
    lines: {
      wrong: ['Pas ça !', 'J’ai dit tomate. Ça, c’est un oignon. Je connais mes légumes.'],
      excluded: 'Il a dit sans oignons. Il ment, mais il l’a dit.',
      fold: 'Plie ! Serré !',
      hurry: ['Allez, allez !', 'Le client, il vieillit.'],
    },
    assist: 'Pousse-toi.',
    // After an assisted game (the chapter, d.say).
    assistStage: [stage('Il en roule trois pendant qu’Hugo cherche la tomate.')],
    tiers: {
      good: 'Pas mal. T’as des mains de kebab.',
      middle: 'Il tient. C’est un kebab honnête.',
      poor: 'On dirait un sac de couchage. Il paiera quand même.',
    },
    buzz: 'ACTIVITÉ NON RECONNUE. ESSAYER LE YOGA ?',
  },

  // §7.6.2 KEY RING (Week 6, the bike-shop door).
  keyRing: {
    hint: 'Molette ou glisser : tourner le trousseau · clic : essayer la clé',
    counter: 'Essai {n}',
    wrong: ['Non.', 'Pas celle-là. Celle-là, c’est mon char.', 'Celle-là ouvre rien. Le proprio la garde pour l’ambiance.'],
    // After 3 wrong keys (the module plays them as a d.say while Jo's pencil ring points at the ribbon).
    assist: [
      jo('Celle avec le ruban rouge. Ben là. Je l’ai mis moi-même.'),
      hugo('Tu savais.'),
      jo('Je voulais te voir chercher. Ça te fait une belle face.'),
    ],
    // Found in 3 tries or fewer, unassisted (the chapter, d.say after the game).
    foundFast: [jo('T’as trouvé tout seul. J’avais mis un ruban dessus, pis t’as même pas regardé le ruban. Ok. Respect.')],
  },

  // §7.6.3 STENCIL (Week 7, ENCRE FINE): the swallow, one continuous line.
  stencil: {
    hint: 'Maintenir le clic et suivre le dessin, à vitesse égale',
    gauge: 'TRAIT',
    band: { slow: 'TREMBLE', fast: 'SAUTE', good: 'BIEN' },
    lines: {
      slow: ['Ça tremble. T’as peur du papier ?', 'Avance. Le papier mord pas.'],
      fast: ['Tu sautes. C’est pas une course, champion.', 'Wo. C’est une hirondelle, pas un sprint.'],
      steady: 'Là. Là, c’est beau.',
    },
    tiers: {
      good: 'Ben là. C’est propre. J’aime pas ça, je voulais rire.',
      middle: 'Ta ligne avance comme un gars qui pense à sa ligne.',
      poor: 'C’est tout croche. C’est parfait. J’adore.',
    },
    buzz: 'FRÉQUENCE CARDIAQUE ÉLEVÉE. SÉANCE INTENSE ?',
    buzzJo: 'Ta montre trouve que t’as le cœur qui bat vite.',
    buzzReply: 'Elle exagère. Un peu.',
  },

  // §7.6.4 DEDUCTION (Week 9, the flat). The wrong-accusation scenes and Odile's hints are the chapter's
  // (L.ch6.week9.accuse, hint, hint2).
  deduction: {
    title: 'QUI RÉPARE LA RUE ?',
    columns: 'QUESTIONS · INDICES · SUSPECTS',
    hint: 'Glisser un indice sur une question · puis tirer le fil vers un suspect',
    stamp: 'RÉSOLU',
    questions: {
      q1: 'Qui passe dans la rue à 3 h ?',
      q2: 'Qui coupe à 52 ?',
      q3: 'Qui fait clic ?',
    },
    wrongClue: ['Ça ne répond pas à la question.', 'C’est un indice. Pas pour cette question-là.', 'Non. Mesurer deux fois. Punaiser une fois.'],
    rightClue: {
      q1: 'D.52. Quelqu’un qui marche à trois heures, et qui compte en cinquante-deux.',
      q2: 'Cinquante-deux centimètres. Le gabarit de l’établi de la boutique.',
      q3: 'Un clic par tour. Un vélo noir, depuis 1974.',
    },
    toCulprit: {
      q1: 'D comme Durand. Cinquante-deux ans de boutique.',
      q2: 'Il coupe comme il a toujours coupé.',
      q3: 'Le même vélo. Le même clic. Toutes les nuits.',
    },
    buzz: 'ACTIVITÉ CÉRÉBRALE NON RECONNUE.',
    idle: 'Une question à la fois. Comme les kilomètres.',
  },

  // §7.6.5 STAKEOUT (Week 9, 3 a.m.): Jo's barks are hushed.
  stakeout: {
    hint: 'Souris : garder l’ombre dans le cadre · rester hors de la lumière · clic droit maintenu : retenir son souffle',
    gauge: 'SOUFFLE',
    seen: 'EN VUE',
    click: 'clic',
    barks: {
      approach: 'Y s’en vient.',
      still: 'Bouge pas.',
      light: 'La lumière ! Recule.',
      looks: 'Respire pas.',
      breathe: 'Ok. Respire un peu.',
      close: 'Il nous a vus ? Non. Ok.',
      lost: 'Il a tourné au coin.',
    },
    lost: 'Il fait une boucle. Il va repasser. Je connais les boucles.',
  },
};
