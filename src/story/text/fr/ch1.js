// HAIRLINE FR text: ch1.js. Mirrors ../ch1.js exactly (same keys, array lengths and line flags).
// Check with: node scripts/i18n-check.mjs fr
import { think } from '../common.js';

export default {
  title: 'Sans impact',
  objectives: {
    start: 'Regarder autour de soi.',
    leave: 'Aller marcher.',
  },
  prompts: {
    tv: 'Regarder',
    tvOff: 'Éteindre',
    phone: 'Lire les messages',
    watch: 'Prendre la montre',
    xray: 'Regarder',
    bike: 'Regarder',
    bibs: 'Regarder',
    door: 'Sortir',
    start: '[E] Démarrer',
  },
  hammer: 'Quelqu’un tape au marteau, en bas. Neuf heures du soir. Le même rythme depuis une heure. Pas pressé du tout. Je le déteste un peu.',
  tvTicker: 'ÉTAPE 17 — COL DU GRAND FERRAND',
  tv: [
    {
      who: 'TV',
      text: '…et voilà, le travail des équipiers est fait. Un à un, ils se relèvent, vidés. Mission accomplie.',
    },
  ],
  tvOff: [
    think('Personne ne les filme, après. Ils redescendent entre les voitures suiveuses et rentrent au bus tout seuls.'),
  ],
  phone: [
    {
      who: 'Téléphone',
      text: '12 messages non lus.',
    },
    {
      who: 'Maman',
      text: 'Tu manges, au moins ? Réponds pas. Mange.',
    },
    {
      who: 'STRIDE',
      text: 'Bilan de la semaine : 0,0 km. Allez, on s’y remet !',
    },
    {
      who: 'Bastien (club)',
      text: 'Appris pour ta jambe mec !! Repose toi la légende. La sortie longue du dimanche c’est PAS pareil sans toi',
    },
    {
      who: 'Dr Okafor (cabinet)',
      text: 'Monsieur Revel, ici le cabinet du docteur Okafor. Je vous rappelle que la botte reste en place, y compris au lit, et aucun impact d’aucune sorte pendant douze semaines. Le docteur Okafor m’a demandé d’ajouter, et je cite : « Ça inclut le petit footing pour voir ce que ça donne. »',
      voicemail: true,
    },
    think('Douze non lus. J’y répondrai quand j’aurai quelque chose à signaler.'),
  ],
  watch: [
    think('Toujours sur le chargeur. Toujours en train de compter. Elle ne sait pas.'),
  ],
  signs: {
    tvLive: 'DIRECT',
    xrayMark: 'G',
  },
  watchHud: {
    face: '0,0 km',
    label: 'CETTE SEMAINE',
    lap: 'SEM. PRÉC. 212,4',
  },
  watchAfter: [
    think('Deux cent douze virgule quatre. Dont onze virgule deux sur une jambe cassée.'),
    think('Elle les a comptés pareil.'),
  ],
  buzz: 'ON BOUGE ! Immobile depuis 1 h.',
  buzzReply: [
    think('Merci.'),
  ],
  xray: [
    think('Le docteur Okafor l’a entourée au Bic. J’ai quand même dû demander où.'),
    think('Il l’a appelée « la redoutable ligne noire ». Puis il s’est excusé : c’est son nom, c’est tout.'),
    think('Il a dit que je pouvais nager, si j’avais besoin de bouger. J’ai dit que je coule. Il l’a noté.'),
  ],
  bike: [
    think('Douze ans, j’ai gardé cette chaîne plus propre que mes dents. Quatre ans au crochet, et elle a viré à l’orange.'),
    think('Le médecin dit que j’ai droit à celui-là. Sans impact. Je lui ai dit que j’avais déjà purgé mes douze ans.'),
    think('Je me dis toujours que je vais le vendre. Mais on me demanderait ce qu’il a gagné.'),
  ],
  bibs: [
    think('Trente-huit dossards. Je les ai tous gardés.'),
    think('Je serais incapable de décrire un seul parcours. Mais je connais chaque temps de passage.'),
  ],
  bibCount: 38,
  door: [
    think('Marchez, si vous y tenez, il a dit.'),
    think('J’y tiens.'),
  ],
  startBuzz: 'DÉMARRER UNE MARCHE ?',
  walkFace: '0,00 km',
  walkLabel: 'MARCHE',
};
