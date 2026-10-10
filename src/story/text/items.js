// Items (Revision 4): the pocket's text. Owned by the ITEMS agent. Source: docs/SCRIPT-R4.md §1.
// The registry (kinds, icons) is src/story/items.js; the case tab's text is text/caseFile.js.
//
//   <id>: { name, def, desc }  name: the pocket label and the toast (« + Mètre ruban »), capitalised;
//                              def: with its article, for prompts (« Utiliser le mètre »);
//                              desc: one line shown when the item is hovered in the open pocket (not voiced).
//   refuse: the wrong item on a hotspot (d.say, voiced). A bag is a list of entries; an entry is a string
//           (Hugo's inner thought), a line object (odile(...)) or an array of them. One entry per try, drawn
//           with no repeat until the bag is empty. On objects: refuse[kind] + refuse.object; on people:
//           refuse[<person>]. The *On* entries are item-specific and are checked first.
//   give: give.<item>.<person> = what the person says when given that gift (the gift is consumed). A person
//         with no entry for a gift refuses it (refuse[<person>]).
//   needs.generic: a hotspot that needs an item the pocket doesn't hold and has no `needsLine` of its own
//                  (chapter needs lines live with their hotspots: chN.needs.<hotspot>).
//   atChapter[i]: the pocket at the start of chapter i (ids). null = put away (Ch3, the flashback). Indices
//                 follow the R4 chapter list; a chapter past the end keeps the pocket it was given.
import { think, odile, sami, bastien, lou, gerard, jo, durand, stage, NAMES } from './common.js';

const benali = (text) => ({ who: NAMES.benali, text });

export default {
  // ------------------------------------------------------------ tools
  keys: {
    name: 'Clés',
    def: 'les clés',
    desc: 'Clé de l’appart, clé de la boîte aux lettres, et une troisième dont personne ne se souvient.',
  },
  phone: {
    name: 'Téléphone',
    def: 'le téléphone',
    desc: 'Douze messages, zéro réponse. L’appareil photo, lui, ne demande rien.',
  },
  watch: {
    name: 'Montre',
    def: 'la montre',
    desc: 'Elle compte. Elle ne sait pas quoi.',
  },
  pencil: {
    name: 'Crayon',
    def: 'le crayon',
    desc: 'Un crayon de menuisier, taillé au couteau. Il écrit gros et il ne ment pas.',
  },
  sandpaper: {
    name: 'Papier de verre',
    def: 'le papier de verre',
    desc: 'Grain 80. Neuf couches de peinture l’attendent. Il ne le sait pas encore.',
  },
  tape: {
    name: 'Mètre ruban',
    def: 'le mètre',
    desc: 'Cinq mètres. Il ment moins que les encadrements.',
  },
  spokeKey: {
    name: 'Clé à rayons',
    def: 'la clé à rayons',
    desc: 'Revenue propre. Elle sent la graisse de chaîne. Quelqu’un l’aime beaucoup.',
  },
  chalk: {
    name: 'Craie',
    def: 'la craie',
    desc: 'Une craie de tailleur. Odile dit qu’une empreinte, ça se cerne. Elle l’a vu à la télé.',
  },
  keyRing: {
    name: 'Trousseau du proprio',
    def: 'le trousseau',
    desc: 'Quatorze clés, aucune étiquette. Une seule a un ruban rouge. Bizarre.',
  },
  thermos: {
    name: 'Thermos',
    def: 'le thermos',
    desc: 'Soupe aux pois de la grand-mère de Jo. Trois heures du matin, encore brûlante.',
  },

  // ------------------------------------------------------------ gifts
  croissant: {
    name: 'Croissant (lune)',
    def: 'le croissant',
    desc: 'Il voulait être un croissant. Il est devenu la lune. Il est encore chaud.',
  },
  rags: {
    name: 'Chiffons propres',
    def: 'les chiffons',
    desc: 'Pliés en quatre. Ils sentent la graisse de chaîne. Une excuse, en coton.',
  },
  kebab: {
    name: 'Kebab',
    def: 'le kebab',
    desc: 'Salade, tomate, oignons, sauce blanche. Gérard dit « très bon ». Il est modeste.',
  },
  soup: {
    name: 'Soupe pour Odile',
    def: 'la soupe',
    desc: 'De la part de Jo. Ce n’est pas de la pitié. C’est de la soupe.',
  },

  // ------------------------------------------------------------ pocket UI (SCRIPT-R4 §1.2)
  ui: {
    pocket: 'POCHE',
    case: 'L’AFFAIRE',
    notebook: 'CE QUE JE SAIS FAIRE',
    gained: '+ {item}',
    lost: '− {item}',
    given: '{item} → {who}',
    worn: 'au poignet',
    held: 'En main : {item}',
    use: 'Utiliser {item}',
    give: 'Donner {item}',
    putAway: 'Ranger',
    full: 'Poche pleine.',
    empty: 'Rien dans la poche. Pour une fois.',
  },
  // Shown once each (SCRIPT-R4 §1.2 `hints.pocket` / `hints.useItem`; kept with the pocket's text).
  hints: {
    pocket: '{Tab} : la poche',
    useItem: 'Objet en main : {KeyE} pour l’utiliser · {Escape} pour le ranger',
  },
  // Labels for the « {item} → {who} » toast, for people not in NAMES (text/common.js).
  people: {
    jo: 'Jo',
    durand: 'M. Durand',
    oldman: 'Le vieux monsieur',
  },

  // ------------------------------------------------------------ wrong item (SCRIPT-R4 §1.4)
  refuse: {
    // On objects, by item kind (Hugo, inner).
    object: [
      'Ça ne marche pas comme ça.',
      'J’ai essayé dans ma tête. Ça ne marchait pas non plus.',
      'Non. Mesurer deux fois, essayer une seule.',
      'Ce n’est pas le bon outil. Mes mains le savent avant moi.',
    ],
    tool: ['Mauvais outil. Je le sais depuis mes quinze ans.', 'On peut tout réparer avec n’importe quoi. Une fois.'],
    gift: ['Un cadeau, ça se donne à quelqu’un. Pas à un meuble.', 'Je ne vais pas offrir ça à une porte. Même grise.'],
    clue: ['C’est une pièce à conviction. On ne bricole pas avec.', 'Les indices, ça va dans le cahier. Pas dans les serrures.'],

    // On people (any tool or gift they don't want). Odile's bag is pronoun-free: it can fire on Day 5
    // before ch4.day5.book[3], while she still says vous.
    odile: [
      odile('Qu’est-ce que j’en ferais ?'),
      odile('Ça, sur sa silhouette. Pas sous mon nez.'),
      odile('Si c’est un cadeau, c’est raté. Si c’est un outil, c’est pire.'),
    ],
    sami: [
      sami('C’est quoi ? Ça sert à quoi ? Ça se mange ?'),
      sami('Je peux le garder ? Non ? Alors pourquoi tu me le montres ?'),
      sami('Ma mère dit de rien prendre aux inconnus. T’es plus un inconnu, mais quand même.'),
    ],
    jo: [
      jo('Câline, c’est quoi, ça ? Une demande en mariage ?'),
      jo('Garde ça. Si tu veux me faire un cadeau, apprends de quoi.'),
      jo('Ben là. C’est gentil, mais non.'),
    ],
    gerard: [gerard('Ça va pas dans un kebab. Alors je veux pas.'), gerard('Je prends les espèces, la carte, et les compliments. Pas ça.')],
    benali: [benali('C’est gentil, mais j’ai les mains dans la farine.'), benali('Gardez-le, monsieur Revel. Vous en aurez plus besoin que moi.')],
    lou: [lou('Je peux le prendre en photo. C’est tout ce que je peux faire pour vous.'), lou('Non merci. Je collectionne que les murs.')],
    bastien: [bastien('Ça se connecte à STRIDE ? Non ? Alors je vois pas, mec.'), bastien('Je cours, la légende. J’ai pas de poches.')],
    durand: [durand('Gardez-le, jeune homme. À mon âge, on ne prend plus. On rend.'), durand('C’est bien entretenu. Rangez-le quand même.')],
    oldman: [stage('Le vieux monsieur dort. Il ne veut rien. Il a l’air de quelqu’un qui a tout.')],

    // Item-specific (checked before the bags above).
    watch: { buzz: 'AUCUNE ACTIVITÉ RECONNUE.', think: 'Elle ne reconnaît rien de ce que je fais, maintenant.' },
    phoneOnPerson: 'Je pourrais l’appeler. Il est juste là.',
    keysOnDoor: 'La clé mystère. Non. Pas celle-là non plus.',
    tapeOnPerson: 'Odile m’a appris à mesurer deux fois. Pas les gens.',
    soupOnPerson: 'C’est la soupe d’Odile. Jo me tuerait. Gentiment, mais elle me tuerait.',
  },

  // ------------------------------------------------------------ gifts given (SCRIPT-R4 §1.4.3)
  give: {
    croissant: {
      jo: [jo('Une lune ? Pour moi ? Câline. Personne m’avait jamais donné la lune.')],
      odile: [odile('Un croissant de lune. Elle progresse.')],
      sami: [sami('On dirait une banane. Merci.')],
      gerard: [gerard('Je mange pas la concurrence.'), stage('Il le mange quand même.')],
      lou: [lou('Je le prends en photo d’abord. Ensuite, je le mange. C’est l’ordre.')],
      bastien: [bastien('Des glucides ? Mec, c’est pas un jour de sortie longue ! …Bon. Je le mange en courant.')],
      oldman: [
        stage('Hugo le pose à côté de lui, sur le banc.'),
        think('Il le trouvera en se réveillant. Il ne saura jamais d’où il vient. Moi non plus, pour ses lattes.'),
      ],
    },
    rags: {
      sami: [sami('Ça sent le vélo. Trop bien. Je vais les sentir tout le temps.')],
      odile: [odile('Mes chiffons. Pliés par quelqu’un d’autre. C’est presque vexant.')],
      durand: [durand('Ils sont à moi. Je les avais pliés en quatre. Odile les plie en trois.')],
    },
    kebab: {
      odile: [odile('Un kebab froid. Personne ne m’en avait jamais apporté. Pose-le là.'), stage('Elle le mange en entier.')],
      jo: [jo('T’es fin. Je l’ai pas mérité, mais je le mange pareil.')],
      sami: [sami('Un kebab d’hier ? …Donne.')],
    },
    // soup.odile is scripted in Ch6 (the hotspot's onGift).
  },

  needs: {
    generic: [think('Il manque quelque chose. Je sais exactement quoi. Je ne l’ai pas sur moi.')],
  },

  // ------------------------------------------------------------ pocket seeds (SCRIPT-R4 §1.5)
  atChapter: [
    [],
    ['keys', 'phone', 'watch'],
    null,
    ['keys', 'phone', 'watch'],
    ['keys', 'phone', 'watch', 'pencil', 'tape'],
    ['keys', 'phone', 'watch', 'pencil', 'tape'],
    ['keys', 'phone', 'watch', 'pencil', 'tape'], // the spoke key was hung back in Ch5
  ],
};
