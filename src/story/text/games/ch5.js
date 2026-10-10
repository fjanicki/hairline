// Revision 4 minigame text for Ch5 (L.games.<id>): PHOTO, PUNCTURE, CROISSANT. Owned by the Ch5 agent.
// Source: docs/SCRIPT-R4.md §6.5 (§17.3 for the built modules' opts shapes). The chapter passes it to the
// game: d.game('photo', { text: L.games.photo, ... }). Keys the script doesn't give (photo label, caption,
// tooClose; puncture title, glueGauge, hint.sand, valve, thin, spill) keep the module's French fallback.
// PHOTO is also used in Ch6 (no new text there).
import { sami } from '../common.js';

export default {
  // §6.5.1 (Week 2 hinge, Week 3 footprint). Feedback lines are Hugo's thoughts; `good.*` is the chapter's
  // blocking think after the game, by target.
  photo: {
    hint: 'Viser à la souris · molette : zoom · maintenir le clic pour la mise au point, relâcher pour prendre la photo',
    gauge: 'NETTETÉ',
    focus: { sharp: 'NET', soft: 'FLOU' },
    counter: 'Photo {n}/3',
    blurry: ['Floue. J’ai bougé. Je ne bouge jamais, d’habitude.', 'Floue. Le téléphone a fait la mise au point sur mon pouce.'],
    offFrame: ['Superbe photo du trottoir.', 'J’ai photographié le ciel. Il n’a rien huilé, lui.'],
    tooFar: ['On voit la rue. On ne voit pas l’indice. On voit surtout la rue.'],
    good: {
      hinge: 'Nette. La glissière brille comme une chaîne neuve.',
      print: 'Nette. Une pantoufle en gros plan. Ma carrière d’enquêteur démarre fort.',
    },
    // A stage line, shown as a thought by the module (not voiced).
    assist: 'Le téléphone fait la mise au point tout seul. Il a l’air soulagé.',
  },

  // §6.5.2 (Week 3, Sami's tube). Barks are Sami's (the module's `who`); afterPatch is Hugo's thought.
  puncture: {
    hint: {
      dunk: 'Glisser la chambre à air dans l’eau, lentement',
      mark: 'Cliquer là où ça fait des bulles',
      patch: 'Maintenir le clic pour appuyer la rustine',
    },
    steps: {
      sand: 'Poncer autour du trou',
      glue: 'Maintenir pour encoller, relâcher à temps',
      press: 'Appuyer la rustine',
    },
    gauge: 'APPUI',
    barks: {
      fast: ['Doucement, tu vas la noyer.', 'Ça fait des bulles ! Non. C’est toi qui fais des bulles.'],
      wrong: 'C’est pas là. Là, c’est de l’eau.',
      found: 'Là ! Le petit chapelet !',
      glue: 'Attends que ça sèche. Monsieur Durand dit que c’est là que tout le monde rate.',
      patch: 'Appuie ! Monsieur Durand compte jusqu’à trente. Moi, je compte vite.',
      oldPatch: 'Ça, c’est une vieille rustine. C’est monsieur Durand qui l’a mise. Il les coupe en ovale, à la main.',
      assist: 'Ça fait des grosses bulles, là. Même moi je vois.',
    },
    afterPatch: 'Trente secondes. Mon premier mécano disait pareil. Les vieux mécanos comptent tous.',
    // Sami's tier line, by the time to find the hole (< 8 s / < 20 s / else): the chapter's, before samiAfter.
    tiers: {
      good: sami('T’as trouvé en deux secondes. Comment t’as fait ?'),
      middle: sami('Trouvé. Moi aussi j’aurais trouvé. Après.'),
      poor: sami('Trouvé. Le seau a eu peur.'),
    },
  },

  // §6.5.3 (Week 3, 4 h 10). Mme Benali grades each croissant and says the end tier (the module's barks).
  croissant: {
    hint: 'Rouler : glisser du côté large vers la pointe, d’un seul geste · Plier : glisser les deux bouts vers le bas',
    cue: { roll: 'Rouler !', fold: 'Plier !' },
    counter: 'Croissant {n}/3',
    grades: {
      perfect: 'Ça, c’est un croissant.',
      ok: 'Un croissant de lune. Il fera l’affaire.',
      moon: ['C’est une lune. Encore une.', 'Pleine lune, celle-là. Elle n’est même plus croissante.'],
      fast: 'Doucement. La pâte n’est pas en retard.',
      slow: 'Vous la réchauffez avec les mains. Elle n’aime pas ça.',
    },
    buzz: 'PÉTRISSAGE DÉTECTÉ. LANCER LA SÉANCE ?',
    buzzReply: '…Non. Mais j’y ai pensé.',
    assist: 'Laissez. Regardez mes mains.',
    tiers: {
      good: 'Pas une lune. Vous êtes sûr de n’avoir jamais fait ça ?',
      middle: 'Moitié croissants, moitié lunes. Ça fait un beau ciel.',
      poor: 'Que des lunes. C’est un calendrier.',
    },
  },
};
