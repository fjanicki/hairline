import { buildScene1 } from '../world/scenes/scene1.js';
import { buildScene2, STREET_MOODS } from '../world/scenes/scene2.js';
import { buildScene4 } from '../world/scenes/scene4.js';
import { LOOK as WORKSHOP_PRESET, CHAPTER_CAMERA as WORKSHOP_CAMERA, CHAPTER_PLAYER as WORKSHOP_PLAYER } from './workshop.js';

// Ready-made scene sets for Director.scene(set) (Revision 4: Ch5 and Ch6 move between the workshop, the
// street by day and at night, and the flat). A set is
//   { name, build(ctx), look: LOOKS name | look object, preset: Mood preset name | object, overrides,
//     player: Player.configure opts (spawn, facing, ...; merged over the chapter's), camera: {offset, look,
//     fov, lerp} (null: the chapter's), hope: number | undefined (kept when undefined), surface: the step surface
//     for ctx.audio.surface ('wood' | 'street' | null = concrete) }
// Every field can be overridden per call: d.scene(SETS.street('night', { player: { spawn: [-4.8, -36.5] } })).

const STREET_CAMERA = { offset: [0, 2.6, 4.2], look: [0, 1.1, 0], fov: 55, lerp: 6 };
const STREET_PLAYER = { spawn: [0.8, 6], facing: Math.PI }; // Ch2's spawn: the top of the street, facing -Z

const merge = (base, opts = {}) => ({
  ...base,
  ...opts,
  player: { ...base.player, ...(opts.player || {}) },
  camera: opts.camera === null ? null : { ...base.camera, ...(opts.camera || {}) },
});

export const SETS = {
  /** Odile's workshop (scene4). Dress it with workshop.js dressWorkshop(ctx, W, stage) after the swap. */
  workshop: (opts) => merge({ name: 'workshop', look: 'workshop', build: (ctx) => buildScene4(ctx), surface: null, preset: WORKSHOP_PRESET, player: { ...WORKSHOP_PLAYER }, camera: { ...WORKSHOP_CAMERA } }, opts),

  /**
   * Rue des Tanneurs (scene2). variant: 'day' (overcast, Weeks 2-6) | 'night' (sodium, 3 a.m. / 4 a.m.) |
   * 'evening' (Ch2's rain) | 'wall' (Ch7). The R4 variants take their mood from scene2.js STREET_MOODS.
   */
  street: (variant = 'day', opts) => {
    const m = STREET_MOODS[variant];
    const preset = m?.preset ?? (variant === 'wall' ? 'wall' : 'street');
    return merge({ name: `street:${variant}`, look: variant, build: (ctx) => buildScene2(ctx, { variant }), surface: 'street', preset, overrides: m?.overrides, player: { ...STREET_PLAYER }, camera: { ...STREET_CAMERA } }, opts);
  },

  /** Hugo's flat (scene1); corkboard: true hangs the Ch6 evidence board (spot `corkboard`, shot `corkboard`). */
  flat: ({ corkboard = true, ...opts } = {}) =>
    merge({ name: 'flat', look: 'flat', build: (ctx) => buildScene1(ctx, { corkboard }), surface: 'wood', preset: 'flat', player: { spawn: [-0.4, 1.5], facing: Math.PI }, camera: { offset: [0, 3.4, 3.6], look: [0, 1.0, -1.2], fov: 55, lerp: 6 } }, opts),
};

/** The mood a street variant suggests, for d.preset() without a rebuild: { preset, overrides } or null. */
export const streetMood = (variant) => (STREET_MOODS[variant] ? { ...STREET_MOODS[variant] } : null);
