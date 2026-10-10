// L’AFFAIRE (Revision 4): the case tab on the back pages of the notebook. Owned by the ITEMS agent.
// Source: docs/SCRIPT-R4.md §1.2 and §1.3. Not voiced (it is written in the notebook).
//
//   clues.<id>:    { name, note, noteLater?, noteWindow? }  noteLater replaces note once the clue is updated
//                  (`clueNote id`); noteWindow is added at the end of the note when mem.seeds.window is set.
//   suspects.<id>: { name, why, whyLater?, alibi? }        whyLater is added after why once the suspect is
//                  updated; no alibi = none. The status stamp is runtime state (story/items.js caseFile).
// Ids are the registry's (story/items.js, kind 'clue').

export default {
  ui: {
    clues: 'Indices',
    suspects: 'Suspects',
    questions: 'Questions',
    alibi: 'Alibi : {text}',
    checked: 'vérifié',
    toCheck: 'à vérifier',
    none: 'aucun',
    new: 'Nouvel indice : {clue}',
    updated: 'Indice mis à jour : {clue}',
  },

  clues: {
    cleanKey: {
      name: 'Clé à rayons rendue',
      note: 'Disparue trois jours. Revenue nettoyée, huilée, avec des chiffons pliés. Une effraction polie.',
    },
    photoHinge: {
      name: 'Photo : glissière huilée',
      note: 'Rideau de Mme Benali, huilé dans la nuit. Huile de chaîne, pas de cuisine. Treize ans de cris, terminés.',
    },
    slat52: {
      name: 'Lattes du banc : 52 cm',
      note: 'Trois lattes neuves. 52 cm ; les anciennes font 50. Coupées net : elles dépassent d’un centimètre de chaque côté.',
      noteLater:
        'Trois lattes neuves. 52 cm ; les anciennes font 50. Coupées net : elles dépassent d’un centimètre de chaque côté. Le gabarit de l’établi Durand est réglé à 52.',
    },
    blueChip: {
      name: 'Écaille de bleu',
      note: 'Sur la tranche des lattes. Un bleu passé, poudreux. Pas un bleu de magasin.',
      noteLater: 'Sur la tranche des lattes. Un bleu passé, poudreux. Pas un bleu de magasin. Dans la boutique, un pot ouvert : « Bleu Durand, 1979, O. M. »',
    },
    slipperPrint: {
      name: 'Photo : empreinte',
      note: 'Sciure sur le seuil du 14. Une charentaise, pointure 44 au moins. Quelqu’un traverse la rue en pantoufles.',
    },
    louPhoto: {
      name: 'Photo de Lou, 3 h 04',
      note: 'Publiée de sa fenêtre. Au bord, un flou sous le réverbère : casquette plate, vélo tenu à la main.',
    },
    segmentD52: {
      name: 'Segment STRIDE : D.52',
      note: 'Rue des Tanneurs, 380 m. Légende locale : D.52, 63 passages en 90 jours. Allure 1,8 km/h. Dernier passage à 03:12.',
    },
    receipts: {
      name: 'Tickets de Gérard',
      note: 'La nuit du rideau : 43 tickets, lus dans l’ordre. N° 43, 1 h 58 : un thé sans sucre. « Le monsieur au vélo qui fait clic. » Il vient tous les soirs. Je lui ai servi le sien. Sans le regarder.',
    },
    freewheelClick: {
      name: 'Note : un clic par tour',
      note: 'Cliquet de roue libre usé. Entendu dans la rue à 2 h 10. Le même que le vélo noir du vieux monsieur du banc.',
      noteWindow: 'Et sous ma fenêtre, la nuit du jour 3.',
    },
    shopPhoto: {
      name: 'Photo, 1974',
      note: 'CYCLES DURAND, l’année de l’ouverture. Un jeune homme, une casquette plate, un vélo noir. C’est le monsieur du banc.',
    },
  },

  suspects: {
    sami: { name: 'Sami', why: 'Veut des outils.', alibi: 'Sa mère dort en travers de sa porte.' },
    lou: { name: 'Lou', why: 'Dehors la nuit. De la peinture sur les mains.', alibi: 'Une photo publiée à 3 h 04, de sa fenêtre.' },
    gerard: { name: 'Gérard', why: 'Ouvert jusqu’à 2 h. Dort quatre heures.', alibi: '43 tickets.' },
    benali: { name: 'Mme Benali', why: 'Debout à 4 h. Le rideau, c’est le sien.', alibi: 'Les croissants. J’ai aidé.' },
    bastien: { name: 'Bastien', why: 'Court à 5 h. Ne s’arrête jamais.', alibi: 'Ses données. Longuement.' },
    jo: { name: 'Jo', why: 'Travaille tard. Pinceaux fins.', whyLater: 'A les clés de la boutique.', alibi: 'Un cerf-volant encore rouge, 3 h 07.' },
    hugo: { name: 'Moi (selon Odile)', why: 'Debout à 4 h. Une botte. Répare pour éviter les sentiments.', alibi: 'Aucun. Je dormais. Mal.' },
    oldman: { name: 'Le vieux monsieur du banc', why: 'Dort sur les bancs le matin. Vélo noir. Casquette plate.' },
    durand: {
      name: 'M. Durand',
      why: 'Dort sur les bancs le matin. Vélo noir. Casquette plate.',
      whyLater: '81 ans. Cinquante-deux ans de boutique. A gardé sa clé.',
    },
  },
};
