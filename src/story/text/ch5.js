// Ch5 « Qui a huilé le rideau ? » (Revision 4, new): Weeks 2, 3 and 4. The street by day, the workshop, the
// bakery at 4 a.m. Owned by the Ch5 agent. Source: docs/SCRIPT-R4.md §6 (§17 overrides).
// Week 4 (Sami's wheel) moved here from ch4.week4 with its lines unchanged (voice keys are text hashes, so
// the clips follow). The workshop scenes also read L.ch4.oldSigns / L.ch4.prompts.oldSigns / .radio.
// The minigame text (PHOTO, PUNCTURE, CROISSANT) is in text/games/ch5.js (L.games.*).
// oldman: Albert Durand before Hugo learns his name (SCRIPT-R4 §0.2): the `durand` voice and colour.
import { think, hugo, odile, sami, bastien, lou, gerard, jo, oldman, stage, NAMES } from './common.js';

const benali = (text) => ({ who: NAMES.benali, text });

export default {
  title: 'Qui a huilé le rideau ?',
  cards: {
    week2: ['Semaine 2.'],
    week3: ['Semaine 3.'],
    week4: ['Semaine 4.'], // moved from ch4.cards.week4
  },
  captions: {
    dawn: 'SAMEDI, 4 H 10',
    morning: '10 H',
    afternoon: '16 H',
  },
  objectives: {
    benali: 'Voir Mme Benali.',
    photo: 'Photographier la glissière.',
    bakery: 'Aller à la boulangerie.',
    bench: 'Mesurer le banc.',
    street: 'Interroger la rue.',
    sami: 'Aider Sami.',
    week4: 'Regarder le vélo.', // moved from ch4.objectives.week4
    spokeKey: 'Prendre la clé à rayons.',
    hangKey: 'Ranger la clé à rayons.',
  },
  prompts: {
    bike: 'Regarder le vélo', // moved from ch4.prompts.bike
    rags: 'Prendre les chiffons',
    talk: 'Parler', // Mme Benali (Week 2, 4 h 10), Bastien, Lou, Gérard
    shutterRunner: 'Photographier',
    bench: 'Mesurer',
    jo: 'Entrer',
    print: 'Regarder l’empreinte',
    printChalk: 'Cerner à la craie',
    oldman: 'Regarder',
    spokeKey: 'Prendre la clé à rayons',
    hangKey: 'Ranger la clé à rayons',
  },
  // Need lines (a hotspot that needs an item the pocket doesn't hold; SCRIPT-R4 §1.4.4).
  needs: {
    printChalk: [think('La craie d’abord. Odile y tient. La télé aussi.')],
  },

  // ------------------------------------------------------------ Week 2: the case opens (§6.1)
  week2: {
    // At spawn, in the workshop. [11] is the stage line before the case opens; [12] after it.
    workshop: [
      stage('Sur le tableau, la clé à rayons est revenue dans sa silhouette. Propre. Huilée. À côté, un sac de chiffons pliés en quatre.'),
      odile('Ma clé est revenue cette nuit. Avec des chiffons pliés. Comme une excuse.'),
      hugo('C’est plutôt une bonne nouvelle.'),
      odile('C’est une effraction avec de bonnes manières.'),
      odile('Et madame Benali a appelé trois fois. Son rideau ne crie plus. Elle dit que la rue ne sait plus l’heure.'),
      stage('Elle le regarde longuement. Puis la botte. Puis lui.'),
      odile('Tu te lèves à quatre heures. Tu descends l’escalier comme une armoire, et maintenant l’armoire a une botte. Et tu as la tête d’un homme qui répare des choses pour éviter les sentiments.'),
      hugo('…Deux sur trois.'),
      odile('Lesquels ?'),
      hugo('Je préfère ne pas le dire.'),
      odile('Bon. Si c’est pas toi, trouve qui c’est. Tu comptes tout. Compte ça.'),
      stage('Il retourne le cahier et commence par la fin, comme à l’école.'),
      odile('Commence par madame Benali. Avant qu’elle rappelle.'),
    ],
    // Bark, once, on the way up the street, within 4.5 m of CHEZ GÉRARD.
    neon: gerard('Le rideau de madame Benali, quelqu’un l’a huilé. Mon néon, personne y touche. Il clignote, c’est voulu.'),
    // Optional: the rags on the bench under the pegboard (item+ rags).
    rags: [think('Pliés en quatre. Quelqu’un a plié des chiffons pour s’excuser. Je ne sais pas si c’est inquiétant ou très bien élevé.')],
    // Optional: the radio (prompt L.ch4.prompts.radio). `radio` is the station (said by « Radio »), then Odile.
    radio: {
      radio: '…le brochet, voyez-vous, ne vole jamais rien. Il emprunte. Et il rapporte, quand il a fini…',
      after: [odile('Même le monsieur de la pêche a une théorie.')],
    },
    benali: [
      benali('Monsieur Revel ! Vous avez entendu ?'),
      hugo('Entendu quoi ?'),
      benali('Rien. Justement. Treize ans qu’il crie, ce rideau. Ce matin, il est monté comme… comme un rideau.'),
      benali('Quelqu’un l’a huilé pendant la nuit. Je ne sais pas si je dois dire merci ou appeler la police.'),
      think('Ça sent la graisse de chaîne. Je connais cette odeur mieux que celle du café.'),
      benali('Prenez-le en photo. Personne ne va me croire.'),
    ],
    // After PHOTO (games.photo.good.hinge first).
    photoDone: [
      benali('Voilà. Maintenant, j’ai une preuve. De quoi, je ne sais pas.'),
      think('Une photo nette. Ça ne va pas sur la liste. C’est le téléphone qui sait faire, pas moi.'),
    ],
    // Thought, walking away; then the Week 3 card.
    end: 'Un rideau huilé. Une clé rendue propre. Quelqu’un répare la rue la nuit. Et le pire, c’est que je suis jaloux.',
  },

  // ------------------------------------------------------------ Week 3 (§6.2 - §6.4)
  week3: {
    // 4 h 10: two thoughts at spawn, the second 2 s after the first.
    dawn: [
      'Quatre heures dix. La jambe est cassée. Le réveil, lui, va très bien.',
      'La seule autre lumière allumée, c’est la boulangerie. Avant, je la battais tous les matins.',
    ],
    benali: [
      benali('Monsieur Revel. À quatre heures. Vous ne courez plus, pourtant.'),
      hugo('Mes jambes n’ont pas lu l’ordonnance.'),
      benali('Si vous venez me demander où j’étais la nuit du rideau, j’étais ici. Comme toutes les nuits depuis vingt ans.'),
      benali('Et puisque vous êtes là, vous allez m’aider. Lavez-vous les mains.'),
      stage('Elle porte des charentaises. Minuscules.'),
      benali('Trente-six. J’ai de tout petits pieds. C’est mon seul défaut.'),
    ],
    // After CROISSANT (her tier line is the game's own, games.croissant.tiers). [1] gives the croissant,
    // [2] then the notebook (croissant), [3] then the note « (lune) ».
    benaliAfter: [
      benali('Voilà mon alibi. Six fournées par nuit. Vous voudriez, en plus, que j’huile des rideaux ?'),
      benali('Prenez celui-là. Le plus lunaire. Il est à vous.'),
      benali('Et écrivez-le. Odile m’a parlé de votre cahier.'),
      stage('Il réfléchit, puis ajoute un mot.'),
    ],
    // 10 h, the workshop. [1] gives the chalk.
    brief: [
      odile('Le banc mouillé, au bout de la rue. Trois lattes neuves, cette nuit. Va mesurer. Deux fois.'),
      odile('Et prends ma craie. Il y a une empreinte sur mon seuil. Une empreinte, ça se cerne à la craie. Je l’ai vu à la télé.'),
      hugo('Une empreinte de quoi ?'),
      odile('De pantoufle. Le crime porte des pantoufles.'),
    ],
    oldmanLook: [think('Un vieux monsieur dort au bout du banc, la casquette sur les yeux. De la sciure sur les manches de son gilet.')],
    // [0..4] measuring (the clues after [4]), [5..9] he wakes, [10] he leaves (the clicks), [11] Hugo.
    bench: [
      stage('Trois lattes neuves, peintes en bleu. Au bout du banc, un vieux monsieur dort, la casquette sur les yeux. Un vélo noir est appuyé contre l’accoudoir.'),
      hugo('Cinquante-deux.'),
      hugo('…Cinquante-deux.'),
      think('Les anciennes font cinquante. Quelqu’un a coupé les neuves à cinquante-deux, pour qu’elles dépassent d’un centimètre de chaque côté. Exprès. Proprement.'),
      think('Et sur la tranche, un bleu. Pas un bleu de magasin.'),
      oldman('Elles sont droites, hein.'),
      hugo('Très droites.'),
      oldman('À mon âge, on remarque ce qui est droit. Le reste, on a renoncé.'),
      hugo('Vous les avez vues arriver ?'),
      oldman('Moi ? Je dors. Je dors très bien, le matin. C’est la nuit que ça se gâte.'),
      stage('Il se lève, prend son vélo par le guidon et s’en va à pied. La roue arrière fait clic. Clic. Clic.'),
      think('Un cliquet de roue libre usé. Je pourrais le réparer les yeux fermés.'),
    ],
    // Bastien jogs on the spot throughout. [4] he turns his wrist; [8] Hugo opens STRIDE (the segment screen).
    bastien: [
      bastien('HUGO ! La légende ! Alors, ce tibia ?'),
      hugo('Il se repose. Tu cours à quelle heure, le matin ?'),
      bastien('Cinq heures pile. Pourquoi ? Tu reviens ?!'),
      hugo('Quelqu’un répare la rue la nuit.'),
      bastien('Et tu me soupçonnes ? Ha ! Mec. Regarde.'),
      bastien('La nuit du rideau ? Jeudi, départ cinq heures zéro deux. Fréquence cardiaque, cent quarante-deux. Cadence, cent quatre-vingt-quatre. Dénivelé, huit mètres. Pas une seule pause. Les données, ça ment pas, mon pote.'),
      bastien('Par contre.'),
      bastien('Tu connais le segment de la rue des Tanneurs ? Je suis deuxième. DEUXIÈME. Derrière un type qui le fait à un virgule huit kilomètre-heure.'),
      stage('Hugo ouvre STRIDE sur son téléphone. Pour la première fois depuis le dimanche.'),
    ],
    // The STRIDE segment screen (UI on the phone, not voiced; 4 s or until {KeyE}).
    segment: {
      title: 'SEGMENT',
      name: 'Rue des Tanneurs · 380 m',
      legendLabel: 'LÉGENDE LOCALE',
      legend: 'D.52',
      legendStat: '63 passages en 90 jours',
      lastLabel: 'Dernier passage',
      last: '03:12',
      paceLabel: 'Allure moy.',
      pace: '1,8 km/h',
      second: '2. Bastien_RUN · 58 passages',
      you: 'Toi : aucun passage récent. On s’y remet ?',
    },
    // After the screen: [1] then clue+ segmentD52; [2] he jogs off.
    bastienAfter: [
      think('Quelqu’un remonte cette rue à pied à trois heures du matin, à l’allure d’un frigo fatigué. Toutes les nuits.'),
      think('Ça, c’est un plan d’entraînement.'),
      bastien('Ha ! Si tu le trouves, dis-lui que c’est pas une allure, ça. C’est une sieste.'),
    ],
    // Inside ENCRE FINE, the tattoo machine low under it. [8] her screen, [10] the alibi, [11] her sleeve.
    jo: [
      jo('Le grand avec la botte ! Entre. Touche à rien, sauf au café.'),
      hugo('Je fais une sorte d’enquête.'),
      jo('Laisse-moi deviner. Le rideau de madame Benali ? Toute la rue en jase.'),
      jo('Vas-y, interroge-moi. On m’a jamais interrogée. C’est le fun.'),
      hugo('La nuit du rideau, vers trois heures, t’étais où ?'),
      jo('Ici. Avec Karim. Un chum.'),
      hugo('Un… chum.'),
      jo('Un ami. Pas mon chum chum. Relaxe, le grand.'),
      stage('Elle tourne son écran vers lui. Un avant-bras d’homme, un petit cerf-volant au trait fin, encore rouge. Photo prise à 3 h 07.'),
      jo('Trois heures sept. Quatre heures de travail. Il a pleuré deux fois. Moi, zéro.'),
      think('Alibi : un cerf-volant encore rouge. On ne fait pas plus frais.'),
      stage('Elle remonte sa manche. L’avant-bras est couvert de traits fins : une fougère, un fouet, un engrenage, une petite règle. Un mètre ruban fait le tour du poignet.'),
      jo('Chaque tattoo, c’est quelque chose que j’ai appris. Le fouet, c’est l’année où j’ai réussi la tourtière de ma grand-mère. L’engrenage, c’est le char manuel. La règle, c’est le premier pochoir que j’ai pas recommencé.'),
      jo('Pis toi ? T’as appris quoi, dernièrement ?'),
    ],
    // d.choose (who: 'Jo'): the Director plays the reply. Options 2 and 3: remember('joLearned', true).
    joMenu: {
      who: 'Jo',
      prompt: 'Elle attend. Elle a vraiment l’air de vouloir savoir.',
      options: [
        { text: 'Deux cent douze kilomètres en une semaine.', reply: 'Deux cent douze ? Ok. Pis ? Tu sais faire quoi d’autre ?' },
        { text: 'À faire un gris pas triste.', reply: 'Un gris pas triste. Câline. Ça, c’est une affaire.' },
        { text: 'À rouler un croissant. Il est sorti en lune.', reply: 'T’as fait des croissants avec madame Benali à quatre heures du matin ? Ben là. T’es pas mal plus intéressant que t’en as l’air.' },
      ],
    },
    joAfter: [jo('Reviens quand tu veux. Pas pour l’enquête.')],
    // Optional. [3] her phone; [7] the blur (clue+ louPhoto).
    lou: [
      lou('Si c’est pour le rideau, c’est pas moi. Je suis pas du genre à réparer.'),
      hugo('Tu sors la nuit.'),
      lou('Je sors pas. Je photographie la rue depuis ma fenêtre. Pour mon compte.'),
      stage('Elle tourne son téléphone vers lui. La rue mouillée, la nuit. Publiée à 3 h 04, la nuit du rideau.'),
      lou('Trois heures quatre. Publiée de chez moi. Quatre cent douze vues. Dont ma mère, onze fois.'),
      hugo('Il y a quelqu’un, au bord. Flou.'),
      lou('C’est le flou. Le flou, c’est artistique.'),
      think('Une silhouette sous le réverbère. Une casquette plate. Un vélo tenu à la main.'),
      lou('Vous pouvez vous abonner. C’est gratuit.'),
    ],
    // Optional; the neon flickers through it.
    gerard: [
      gerard('Si c’est pour le néon, il marche très bien.'),
      hugo('Il clignote.'),
      gerard('Exprès. C’est l’ambiance.'),
      hugo('La nuit du rideau, vers trois heures, t’étais où ?'),
      gerard('Ici. Je ferme à deux heures, je nettoie, je dors. Quatre heures. De cinq à neuf.'),
      gerard('J’ai des tickets. Quarante-trois. Je peux te les lire. Dans l’ordre.'),
      hugo('Pas maintenant.'),
      gerard('Reviens un soir, alors. Tu verras si j’ai le temps de huiler des rideaux.'),
    ],
    // Optional, No. 14's doorstep; then the hotspot becomes printChalk (needs the chalk), then PHOTO.
    print: [
      think('De la sciure, sur le seuil du 14. Une empreinte. Semelle lisse, à petits carreaux.'),
      think('Une charentaise. Pointure quarante-quatre, au moins. Quelqu’un a traversé la rue en pantoufles, cette nuit.'),
    ],
    printChalk: [stage('Il trace un trait de craie autour de l’empreinte. Odile serait fière. Elle ne le dira pas.')],
    // Thought, when the bench, Bastien and Jo are done.
    hubDone: 'Un banc à cinquante-deux. Un inconnu qui marche à un virgule huit. Et un monsieur qui dort sur les bancs. J’ai connu des samedis moins remplis.',

    // 16 h, the workshop: then PUNCTURE.
    sami: [
      sami('Odile ! J’ai crevé. Encore. C’est la troisième fois.'),
      odile('Le bonhomme, là. Il s’ennuie.'),
      sami('Il sait faire, lui ?'),
      hugo('Trouver un trou, je sais faire.'),
      hugo('La nuit où le rideau de madame Benali a été huilé, t’étais où ?'),
      sami('Au lit. Ma mère dort en travers de ma porte. Genre, en travers.'),
      odile('C’est vrai. Sa mère fait plus peur que moi.'),
      sami('Pourquoi ?'),
      hugo('Quelqu’un répare des choses la nuit.'),
      sami('C’est pas moi. Moi, je casse.'),
    ],
    // After PUNCTURE, Sami's tier line (games.puncture.tiers) first; then note+ puncture.
    samiAfter: [
      sami('La prochaine fois, je peux le faire tout seul ?'),
      hugo('La prochaine fois, c’est toi qui le fais.'),
      sami('Alors les crevaisons, c’est moi.'),
      odile('Écris-le.'),
    ],
    // Straight after samiAfter, same shot. Then the station (`wrapRadio`, said by « Radio ») and `wrapEnd`.
    wrap: [
      odile('Alors, l’inspecteur ?'),
      hugo('Des alibis. Un banc à cinquante-deux. Un inconnu qui marche à un virgule huit. Et une écaille de bleu.'),
      stage('Odile prend l’écaille, la tourne longtemps entre ses doigts. Puis elle la rend sans un mot.'),
      odile('J’ai connu des enquêtes plus brillantes. Celle du monsieur de la pêche, par exemple.'),
    ],
    wrapRadio: '…car le poisson, mes amis, fait des boucles. Le pêcheur patient n’a qu’à attendre qu’il repasse…',
    wrapEnd: [odile('Tu vois. Lui, il avance.')],
  },

  // ------------------------------------------------------------ Week 4 (§6.6; moved from ch4.week4)
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
    bike: [think('La roue arrière est voilée. Un rayon s’est détendu, alors la jante se balade et vient embrasser le patin une fois par tour.')],
    hold: [hugo('Tiens le vélo. Les deux mains. N’aide pas.'), sami('Tenir, c’est pas aider ?'), hugo('Tenir, c’est toute ma carrière.')],
    // TRUING needs the spoke key (after `hold`): then objective spokeKey, the pegboard.
    needs: [think('Il faut une clé à rayons. Je sais exactement à quoi ça ressemble. Pour une fois, elle est au tableau.')],
    keyTake: 'Revenue. Propre. Elle sent toujours la graisse de chaîne.',
    // Truing by ear (crafts/truing.js). hint, gauge and pitch are shared with Ch7's wheel job.
    truing: {
      hint: '{KeyA} / {KeyD} tourner · {Space} pincer · {KeyW} / {KeyS} serrer / desserrer · ou à la souris',
      gauge: 'NOTE',
      pitch: { flat: 'TROP BAS', sharp: 'TROP HAUT', true: 'JUSTE' },
      flat: 'Là. Celui-là sonne trop bas.', // Hugo's thought, with the chalk mark (assist)
      barks: {
        who: 'Sami',
        clunk: 'C’était censé faire clonk ?',
        hitting: 'Odile, il le tape !',
        notFixed: 'C’est réparé ? C’est pas réparé.',
        ping: 'Ça a fait ping. C’est bien, ping ?',
        higher: 'Ça monte.',
      },
      assisted: { who: 'Sami', text: 'C’est réparé ? …C’est réparé.' },
    },
    // Bark, 6 s into TRUING; Jo stays by the door, watching.
    joEnter: jo('Odile ! Je viens t’emprunter ton pinceau à filet. Le mien a perdu un poil. Le poil important.'),
    // Played as after[0..1], then `jo`, then after[2..4].
    after: [
      sami('Ça tourne droit ! Comment t’as su où ?'),
      hugo('Tu écoutes. La roue te dit où ça frotte.'),
      sami('Pourquoi t’as une chaussure de ski ?'),
      hugo('C’est une botte médicale. Je me suis cassé la jambe en courant.'),
      sami('En courant après quoi ?'),
    ],
    jo: [
      jo('Attends. Tu répares sa roue en l’*écoutant* ? Ok. C’est hot.'),
      hugo('…C’est une clé à rayons.'),
      jo('Je sais c’est quoi. Je dis que c’est hot.'),
      sami('C’est quoi, hot ?'),
      hugo('Tiens le vélo.'),
      odile('Le pinceau est à gauche. La porte, à droite.'),
      jo('Tiguidou.'),
      stage('Elle prend le pinceau et sort. La porte claque.'),
    ],
    laughStage: [stage('Hugo rit. Ça sort rouillé, comme un truc oublié au fond d’une remise.')],
    laugh: [think('Tiens. Un rire. Je l’aurais enregistré, s’il y avait eu une case pour ça.')],
    wrap: [
      hugo('Ça, j’ai toujours su faire. Avant l’équipe, je montais mes roues moi-même. Les mécanos, c’était pour ceux qui gagnaient.'),
      odile('Alors écris-le.'),
    ],
    // Notebook: add wheel. Then the objective hangKey and the pegboard; then `end` (item− spokeKey).
    end: [odile('Sur sa silhouette. Qu’elle y reste, cette fois.')],
  },
};
