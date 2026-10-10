// Ch6 « Service de nuit » (Revision 4, new): Weeks 5 to 9. The street by day and at night, CHEZ GÉRARD at
// 1 a.m., CYCLES DURAND, the workshop, ENCRE FINE, the flat. Owned by the Ch6 agent. Source: docs/SCRIPT-R4.md
// §7 and §9.3–9.4 (§17 overrides). Week 7 (the OPEN sign) moved here from ch4.week7 with its lines unchanged
// (voice keys are text hashes, so the clips follow). The workshop scenes also read L.ch4.oldSigns.
// The minigames' text is in text/games/ch6.js (L.games.kebab, keyRing, stencil, deduction, stakeout).
import { think, hugo, odile, sami, lou, gerard, bastien, jo, durand, stage, NAMES } from './common.js';

const benali = (text) => ({ who: NAMES.benali, text });
// Odile on the phone (§9.4, §12.2): the voice rule gives these the phone band (delivery voicemail).
const phone = (text) => ({ who: NAMES.odile, text });

export default {
  title: 'Service de nuit',
  cards: {
    week5: ['Semaine 5.'],
    week6: ['Semaine 6.'],
    week7: ['Semaine 7.'], // moved from ch4.cards.week7
    week8: ['Semaine 8.'],
    week9: ['Semaine 9.'],
  },
  captions: {
    night1: '1 H',
    night2: '2 H 10',
    afternoon: '15 H',
    evening: '18 H',
    board: '23 H',
    stakeout: '2 H 50',
  },
  objectives: {
    kebab: 'Vérifier l’alibi de Gérard.',
    home: 'Rentrer.',
    jo: 'Passer chez Jo.',
    shop: 'Ouvrir la boutique Durand.',
    search: 'Fouiller la boutique.',
    week7: 'Voir ce que fait Odile.', // moved from ch4.objectives.week7
    stencil: 'Suivre Jo.',
    board: 'Résoudre l’affaire.',
    bench: 'Aller au banc.',
    watch: 'Surveiller la rue.',
  },
  prompts: {
    bench: 'Observer', // moved from ch4.prompts.bench (Week 7, the workshop)
    gerard: 'Parler',
    jo: 'Parler',
    shopDoor: 'Ouvrir',
    outlines: 'Regarder', // the shop hotspots: SCRIPT-R4 §7.2 table
    shopBench: 'Regarder l’établi',
    tin: 'Regarder',
    photo: 'Regarder la photo',
    calendar: 'Regarder',
    leave: 'Sortir',
    encre: 'Entrer',
    board: 'Regarder le tableau',
    sit: 'S’asseoir',
  },

  // Need lines (SCRIPT-R4 §1.4.4).
  needs: {
    shopDoor: [think('Fermé à clé. Le genre de serrure qui attend quelqu’un avec un trousseau.')],
  },

  // ------------------------------------------------------------ Week 5 (§7.1)
  week5: [think('Semaine cinq. Rien de réparé. J’ai vérifié tous les matins, avant le café. C’est grave, je crois.')],

  // ------------------------------------------------------------ Week 6 (§7.2)
  week6: {
    // 1 h, behind the counter at CHEZ GÉRARD; the neon is steady and pink.
    kebabIntro: [
      gerard('Regarde mon néon.'),
      gerard('Il clignote plus. Quelqu’un me l’a recâblé la nuit dernière. Sans demander.'),
      hugo('Il marche, maintenant.'),
      gerard('Il clignotait *exprès*. C’était de l’ambiance.'),
      hugo('Une ambiance de quoi ?'),
      gerard('De kebab.'),
      gerard('Bon. Tu voulais savoir si j’ai le temps de huiler des rideaux la nuit ? Regarde.'),
      stage('La porte s’ouvre. Trois clients. Puis cinq.'),
      gerard('Galette, viande. Après, tu fais ce que je dis, quand je le dis.'),
    ],
    // After KEBAB WRAP (its tier line is the game's own bark). 2 a.m., closing. The chapter plays it in four
    // parts: [0] (the STRIDE buzz), [1..9] (clue+ receipts, Gérard checked), [10] (item+ kebab), [11..12].
    receipts: [
      gerard('Deux heures. On ferme. Maintenant, mes tickets. Ceux de la nuit du rideau.'),
      gerard('Un : salade-tomate-oignons. Deux : sans oignons, il ment, il en reprend toujours. Trois : une assiette. Quatre…'),
      hugo('J’ai compris.'),
      gerard('Vingt-sept : des frites. Juste des frites. Un drame.'),
      gerard('Quarante-trois : un thé. Une heure cinquante-huit. Le monsieur au vélo qui fait clic.'),
      hugo('Qui ?'),
      gerard('Je sais pas son nom. Il vient tous les soirs avant la fermeture. Un thé sans sucre, en pièces de dix centimes. Il dit que c’est pour tenir jusqu’au matin.'),
      gerard('Tu l’as servi toi-même, tout à l’heure.'),
      hugo('…Je cherchais la tomate.'),
      gerard('Voilà. Alibi. J’ai pas le temps de huiler quoi que ce soit. J’ai à peine le temps de dormir.'),
      gerard('Tiens. Pour la route. C’est un très bon kebab.'),
      stage('Hugo sort son carnet.'),
      gerard('Écris pas ça sur ta liste. C’est mon métier, pas ton loisir.'),
    ],
    buzz: '2 H DU MATIN. TON CORPS A BESOIN DE SOMMEIL.',
    buzzReply: 'Enfin un bon conseil. Je ne vais pas le suivre.',
    // Non-blocking, as Hugo leaves CHEZ GÉRARD: from Lou's lit window above it.
    lou: { who: NAMES.lou, text: 'Le néon clignote plus. Mes photos sont moins bien.' },
    // 2 h 10, walking home up the dark street (thoughts; the click plays first, behind him).
    click: [
      'Clic. Clic. Clic.',
      'Je me retourne. Personne. La rue, et un clic qui s’éloigne, à l’allure d’un frigo fatigué.',
      'Un clic par tour de roue. Le même que le vélo du vieux monsieur du banc.',
    ],
    // 15 h, ENCRE FINE's door. [0..7], keys jingle on [7], [8] item+ keyRing, [9] item+ soup.
    jo: [
      jo('Hugo ! T’as une face de gars qui a roulé des kebabs jusqu’à deux heures.'),
      hugo('Quarante-trois.'),
      jo('Quarante-trois ? Ok. Pis, y étaient bons ?'),
      hugo('Le quarante-troisième était un thé.'),
      jo('Faque ton enquête avance.'),
      hugo('Les lattes, la peinture, le clic. Tout tourne autour de la boutique de vélos. Elle est fermée.'),
      jo('Fermée, oui. Barrée, non.'),
      stage('Elle fait tinter un trousseau énorme.'),
      jo('Le proprio, c’est le même que le mien. Il m’a laissé ses clés pour faire visiter. Personne visite. Quatorze clés, aucune étiquette. Bonne chance.'),
      jo('Ah, pis apporte ça à Odile. Dis-y que c’est pas de la pitié. C’est de la soupe.'),
    ],
    keyRing: {
      // The bike-shop door, first {KeyE}, before KEY RING.
      mystery: [
        stage('Hugo sort d’abord sa propre clé. La troisième. Celle dont personne ne se souvient.'),
        think('La clé mystère. Il fallait essayer.'),
        stage('La porte ne se sent pas bête du tout.'),
        jo('C’était quoi, ça ?'),
        hugo('Une hypothèse.'),
      ],
    },
    // Inside CYCLES DURAND (objective search): bench and photo required, the rest optional.
    shop: {
      outlines: [
        think('Des silhouettes de vélos peintes au mur. Toutes vides.'),
        think('Comme chez Odile. Comme ça, on voit ce qui manque. Ici, il manque tout.'),
      ],
      bench: [
        think('L’établi est propre. Le seul endroit propre de la boutique.'),
        think('Un gabarit de coupe, réglé à cinquante-deux. De la sciure fraîche dessous.'),
      ],
      tin: [
        think('Un pot de peinture, ouvert. Le bleu des lattes du banc.'),
        jo('Y a une étiquette. « Bleu Durand, 1979, O. M. »'),
        think('O. M. Odile Marchal.'),
      ],
      photo: [
        stage('Une photo encadrée, légendée au crayon : « Albert Durand, 1974 ». Un jeune homme devant la boutique neuve. Une casquette plate. Un vélo noir.'),
        jo('Ah ben ! C’est le monsieur du banc !'),
        jo('Il passe me dire bonsoir tous les soirs à neuf heures. Il m’appelle « mademoiselle ». Personne m’a appelée mademoiselle depuis le cégep.'),
        jo('Il a quatre-vingt-un ans. Il me l’a dit trois fois.'),
        think('Albert Durand. Cinquante-deux ans de boutique.'),
      ],
      calendar: [
        think('Un calendrier. Chaque nuit est cochée au crayon, avec une heure. Trois heures douze. Trois heures neuf. Trois heures quinze.'),
        jo('Tabarnouche. Y dort jamais, lui ?'),
        think('Il chronomètre.'),
        think('Évidemment qu’il chronomètre.'),
      ],
    },
    // Leaving the shop: [0] item− keyRing, [1] hope 0.54.
    shopOut: [jo('Je rapporte les clés au proprio. Il saura jamais.'), jo('Pis la soupe, là, elle refroidit.')],
    // The workshop (optional): the soup given to Odile.
    soup: [
      odile('De la soupe.'),
      hugo('C’est pas de la pitié. C’est de la soupe.'),
      odile('…Dis-lui merci.'),
      odile('Non. Dis-lui rien. Je lui dirai moi-même.'),
    ],
  },

  // ------------------------------------------------------------ Week 7 (§7.3)
  week7: {
    // As Week 7 opens: the race bike from his flat is on the stand.
    raceBike: [think('J’ai décroché le vieux vélo. La chaîne d’abord. Puis tout le reste.')],
    stage: [stage('Odile lève le pinceau. La pointe frémit. Elle le repose.')],
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
        good: [odile('Propre. Va pas raconter que je l’ai dit.')],
        middle: [odile('Ça a du caractère. Personne ne veut d’une enseigne sans caractère.')],
        poor: [odile('C’est un peu pompette. Des lettres pompettes, ça dit quand même OPEN.')],
      },
    },
    signMenu: {
      who: 'Odile',
      prompt: 'Odile tapote le coin du bas. « Signe-le. »',
      options: [
        { text: 'En grand. Tout en bas.', correct: false, reply: 'C’est une pancarte, pas un gâteau d’anniversaire.' },
        {
          text: 'Je préfère pas.',
          correct: false,
          reply: 'Douze ans, tu as fait le boulot et c’est le nom d’un autre qu’on a mis en haut. Pas dans mon atelier.',
        },
        { text: 'En petit. Dans le coin.', correct: true, reply: 'Plus petit. Que seuls les gens du métier le trouvent.' },
      ],
    },
    signThink: [think('Douze ans. La première chose qui porte mon nom dit OPEN.')],
    // Notebook: add sign.
    buzz: 'ON BOUGE ! Immobile depuis 3 h 12 min.',
    buzzReply: '…Trois heures ?',
    wrap: [
      odile('STRIDE ne renouvelle pas le panneau. Dans un mois, il y aura vingt mètres de rien au milieu de toute cette laideur.'),
      hugo('…Tu veux le peindre.'),
      odile('Moi, je peux tenir une craie. La rue tiendra les pinceaux. Toi, tu fais le trait.'),
      hugo('Quel trait ?'),
    ],
    // R4 (§7.3): Jo brings Odile's brush back, after raceBike.
    joEnter: [
      jo('Odile ! Ton pinceau. Lavé deux fois. C’est la règle, ici, hein ? Deux fois ?'),
      odile('Posez-le là, Josianne. Pas là. Là.'),
      jo('Je reviens tantôt. Je veux voir ce qu’il fait.'),
      stage('Elle sort. La porte claque. Odile ne lève pas les yeux.'),
      odile('Elle claque les portes. Ça me plaît.'),
    ],
    // Optional radio, Week 7: the station (a bark from the radio), then Odile.
    radioStation: { who: 'Radio', fishing: '…la vieille carpe, elle, ne dort plus. Elle fait le tour de l’étang toute la nuit, et elle range les cailloux…' },
    radio: [odile('Éteins-le. Non. Laisse.')],
    // 18 h: Jo comes back for the sign.
    joBack: [
      jo('Montre-moi ça.'),
      stage('Elle regarde la pancarte longtemps. Puis le petit H.R. dans le coin.'),
      jo('T’as signé en petit.'),
      hugo('Pour que seuls les gens du métier le trouvent.'),
      jo('Ben moi, je l’ai trouvé.'),
      jo('Viens. Je vais te montrer à tracer un pochoir.'),
    ],
    stayMenu: {
      who: 'Jo',
      prompt: 'Odile fait semblant de ne pas écouter.',
      options: [
        { text: 'J’arrive.', reply: 'Tiguidou.' },
        { text: 'Odile a besoin de moi.', who: 'Odile', reply: 'Odile n’a besoin de rien. Va.' },
      ],
    },
    // ENCRE FINE, the light table.
    stencilIntro: [
      jo('Un pochoir, c’est le dessin qu’on décalque sur la peau. Si le pochoir tremble, le tattoo tremble pour la vie. Pas de pression.'),
      jo('Ta ligne, faut qu’elle avance toute seule. Trop lent, ça tremble. Trop vite, ça saute.'),
      hugo('Comme une allure.'),
      jo('Si tu veux. Mais ici, personne te chronomètre.'),
    ],
    // After STENCIL (her tier line is the game's own bark): [0..1], note+ fineLine, [2], noteAnn « (mal) »
    // in Jo's hand, [3]; hope 0.64.
    stencilAfter: [
      jo('Un gars qui apprend de quoi à trente-sept ans ? C’est rare. C’est hot.'),
      jo('Écris-le dans ton carnet.'),
      stage('Elle lui prend le crayon et ajoute un mot, minuscule.'),
      jo('Comme ça, l’an prochain, tu pourras le rayer.'),
    ],
  },

  // ------------------------------------------------------------ Week 8 (§7.4)
  week8: [think('Semaine huit. Le banc tient. Le néon ne clignote plus. Gérard le débranche deux fois par soir, pour l’ambiance.')],

  // ------------------------------------------------------------ Week 9 (§7.5, §9.3, §9.4)
  week9: {
    // 23 h, the flat, the cork board.
    boardIntro: [
      think('Trente-huit dossards au mur. Et maintenant, à côté, un tableau en liège.'),
      think('Huit suspects, dont moi. Je n’ai jamais eu autant de punaises.'),
      think('Trois questions. Si je réponds aux trois, je sais qui.'),
    ],
    // The three strings meet on M. Durand; the board stamps « RÉSOLU ». Then Jo's text (phone, not voiced).
    boardDone: [
      think('Albert Durand. Quatre-vingt-un ans. Cinquante-deux ans de boutique.'),
      think('Il fait le tour de la rue toutes les nuits, et il répare ce qu’il trouve.'),
      think('Je n’ai pas de preuve. J’ai un plan d’entraînement. Il passe à trois heures douze.'),
    ],
    smsFrom: 'Jo',
    sms: 'T’as trouvé ? Je viens. J’apporte de la soupe. Dis non pour voir.',
    smsAfter: [think('Je n’ai pas dit non.')],

    // Wrong accusations at the board (§9.3): `stage` first (the board blurs, the suspect in a vignette).
    // The second time the same suspect is accused, only the last line plays.
    accuse: {
      stage: [stage('Hugo imagine la scène.')],
      sami: [
        hugo('Sami. C’est toi qui répares la rue la nuit.'),
        sami('Moi ? Je casse. Je te l’ai dit. Et ma mère dort en travers.'),
        think('Il a raison. Il casse.'),
      ],
      lou: [
        hugo('Lou. Le flou, c’est toi.'),
        lou('Je suis derrière l’appareil. Je peux pas être dans la photo. C’est le principe d’une photo.'),
        think('Elle me l’expliquera encore. Souvent, je pense.'),
      ],
      gerard: [
        hugo('Gérard. Ton néon, c’est une couverture.'),
        gerard('Mon néon, c’est de l’ambiance. Et j’ai quarante-trois tickets. Je te les relis ?'),
        think('Surtout pas.'),
      ],
      benali: [
        hugo('Madame Benali. Des charentaises, à trois heures du matin.'),
        benali('En quarante-quatre ? Monsieur Revel. Regardez mes pieds.'),
        think('Trente-six. Son seul défaut.'),
      ],
      bastien: [
        hugo('Bastien. Tu cours à cinq heures. Tu pourrais réparer à trois.'),
        bastien('Mec. Si je m’étais arrêté pour huiler un rideau, ma montre aurait fait une pause. Et ma montre fait JAMAIS de pause.'),
        think('Ça, je le crois.'),
      ],
      jo: [
        hugo('Jo. Tu as les clés de la boutique.'),
        jo('Ben oui. Pis un cerf-volant encore rouge à trois heures sept. Tu m’accuses pour me revoir, ou quoi ?'),
        think('…Pas complètement faux.'),
      ],
      hugo: [
        stage('Hugo s’imagine en train de s’arrêter lui-même.'),
        think('Hugo Revel, je vous arrête.'),
        think('Non. Ça ne tient pas. Je n’ai jamais su m’arrêter.'),
      ],
    },
    // Odile's hints (§9.4): after 2 wrong tries (on the phone), after 4 (on the phone, then in the room).
    hint: [
      stage('Le téléphone sonne. C’est l’atelier.'),
      phone('Ta botte fait les cent pas depuis une heure. Je l’entends d’en bas. Tu accuses toute la rue, je parie.'),
      phone('Cinquante-deux ans. Cinquante-deux centimètres. Ça fait beaucoup de cinquante-deux pour un hasard.'),
    ],
    hint2: {
      phone: [phone('Je monte.'), stage('Elle monte. Ça prend un moment.')],
      room: [odile('Albert Durand. Tu tires tes fils, ou je le fais ?')],
    },

    // 2 h 50, the repaired bench. [0] stage, [1] item+ thermos, then the rest.
    stakeoutIntro: [
      stage('Le banc réparé. Jo est déjà assise, un thermos sur les genoux.'),
      jo('Soupe aux pois. Celle de ma grand-mère. Chu pas venue pour l’enquête, chu venue pour la soupe.'),
      jo('On fait quoi, exactement ?'),
      hugo('On ne bouge pas.'),
      jo('Ça, tu sais faire. C’est écrit dans ton carnet.'),
      stage('Elle lui prend le carnet des mains et le lit à la lumière du réverbère.'),
      jo('« Faire un gris pas triste. » Câline. T’es cute.'),
    ],
    cuteMenu: {
      who: 'Jo',
      prompt: 'Elle attend une réponse. Le réverbère grésille.',
      options: [
        { text: 'C’est une liste.', reply: 'C’est une belle liste. Fais pas ton modeste, ça te va pas.' },
        { text: 'C’est la première liste dont je suis fier.', reply: '…Ok. Ça, c’était pas cute. C’était beau.' },
      ],
    },
    stakeoutTalk: [
      hugo('Les kilomètres, ça ne t’a jamais impressionnée.'),
      jo('Pantoute. N’importe qui peut faire plus de la même affaire. Toi, tu fais des affaires *nouvelles*. Avec une botte.'),
      jo('C’est ce qu’il y a de plus sexy dans la rue. Pis la rue a Gérard.'),
    ],
    stakeoutBuzz: 'SÉANCE NOCTURNE DÉTECTÉE ! BELLE SORTIE À 3 H !',
    stakeoutWhisper: [jo('Ta montre te félicite d’être assis.'), hugo('Elle me félicite pour tout.')],
    stakeoutClick: [think('Trois heures dix. Clic.')],

    // Inside STAKEOUT, when the shadow reaches CYCLES DURAND (the phone buzzes loudly). Either way a bravo goes.
    bravo: {
      who: 'Jo',
      prompt: 'STRIDE : D.52 est en train de battre son record sur « Rue des Tanneurs » ! Envoyer un bravo ?',
      options: [
        { text: 'Bravo', reply: null },
        { text: 'Ignorer', reply: [jo('Ben voyons. Faut l’encourager.'), stage('Elle tend le bras et appuie sur Bravo.')] },
      ],
    },
    bravoAfter: [
      stage('Au bout de la rue, une montre vibre au poignet du vieux monsieur.'),
      durand('…Qui m’envoie des bravos à trois heures du matin ?'),
    ],
    // CYCLES DURAND's card, which he has just pinned back up, straight. [0..2] (Hugo crosses), [3..12],
    // [13..14] (the stopwatch), [15..].
    reveal: [
      stage('Hugo se lève. La botte claque sur le pavé.'),
      durand('Vous faites un bruit d’armoire, jeune homme.'),
      hugo('On me l’a déjà dit.'),
      durand('Je vous connais. Le grand qui partait courir à quatre heures. On s’est croisés cent vingt-trois fois. J’ai compté.'),
      durand('Vous ne m’avez jamais vu. Vous regardiez votre montre.'),
      think('Il a raison. Des mois que j’entends son clic. Je lui ai même servi un thé. Je n’ai jamais levé les yeux.'),
      jo('Bonsoir, monsieur Durand.'),
      durand('Mademoiselle. Vous êtes en retard pour dormir.'),
      hugo('Le rideau de madame Benali. Le banc. Le néon de Gérard. La clé d’Odile.'),
      durand('Le néon, je regrette. Il clignotait exprès, paraît-il.'),
      durand('Cinquante-deux ans, j’ai ouvert à huit heures. Maintenant, j’ouvre à trois heures, pour personne. Ce sont les mêmes heures. Seulement, il fait nuit.'),
      stage('Il sort de sa poche un chronomètre. Le vieux modèle, à remontoir.'),
      durand('Le rideau de madame Benali : neuf minutes quarante. Le banc : une heure douze. Le néon : trois nuits. J’ai tout noté.'),
      durand('Ma fille m’a offert une montre pour savoir si je dors. Maintenant, elle sait.'),
      think('Il chronomètre. Quarante-quatre ans de plus que moi, et pas un jour de repos.'),
      hugo('Vous devriez dormir.'),
      durand('Le médecin m’a dit de marcher. Il n’a pas dit quand.'),
      jo('Pis la clé à rayons ?'),
      durand('Ah. Celle-là, je l’ai gardée trois jours. Je l’ai faite en 1971, pour le père Marchal. J’étais apprenti chez Lemaire, je n’avais pas encore ma boutique.'),
      durand('Je voulais voir si elle tenait encore. Elle tient.'),
    ],
    // [0..7], then Jo hands him the thermos cap ([8], item− thermos) and [9].
    offer: [
      hugo('Sami a besoin d’un monsieur des roues.'),
      durand('Je lui ai donné un vélo pour ça. Je lui ai dit d’en trouver un.'),
      hugo('Il en a trouvé un. Moi. Mais je ne sais pas tout. Venez le jour. Apprenez-lui le reste.'),
      durand('Je ne sais pas apprendre aux enfants.'),
      hugo('Moi non plus. Ça s’apprend.'),
      durand('…À quelle heure ?'),
      hugo('Dix heures. Apportez votre café. Celui d’Odile est un crime.'),
      durand('Je sais. Ça fait cinquante ans.'),
      stage('Jo dévisse le thermos et lui tend le bouchon fumant.'),
      durand('Volontiers, mademoiselle.'),
    ],
    // [0..1], note+ case, hope 0.68, then [2]. Fade to white.
    end: [
      stage('Ils restent tous les trois sur le banc réparé jusqu’à ce que la boulangerie s’allume.'),
      jo('Écris-le. C’est la règle, hein ? Odile me l’a dit.'),
      think('Quatre heures. La boulangerie s’allume. Pour une fois, je ne l’ai pas battue.'),
    ],
  },
};
