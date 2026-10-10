// The cast: recipes for the Quaternius "Universal" character set (public/assets/characters,
// docs/assets/characters.md). A recipe picks a rig (body proportions), the skinned parts to keep
// and their colours. Colours are sRGB hex before the grade; keep clothes muted (hope does the rest).

/** Mixamo short bone names (the old Xbot API) -> Universal (Unreal-style) names. */
export const BONE_ALIASES = {
  Hips: 'pelvis',
  Spine: 'spine_01',
  Spine1: 'spine_02',
  Spine2: 'spine_03',
  Neck: 'neck_01',
  Head: 'Head',
  LeftShoulder: 'clavicle_l',
  LeftArm: 'upperarm_l',
  LeftForeArm: 'lowerarm_l',
  LeftHand: 'hand_l',
  LeftUpLeg: 'thigh_l',
  LeftLeg: 'calf_l',
  LeftFoot: 'foot_l',
  LeftToeBase: 'ball_l',
  LeftToe_End: 'ball_leaf_l',
  RightShoulder: 'clavicle_r',
  RightArm: 'upperarm_r',
  RightForeArm: 'lowerarm_r',
  RightHand: 'hand_r',
  RightUpLeg: 'thigh_r',
  RightLeg: 'calf_r',
  RightFoot: 'foot_r',
  RightToeBase: 'ball_r',
  RightToe_End: 'ball_leaf_r',
};
const FINGERS = { Thumb: 'thumb', Index: 'index', Middle: 'middle', Ring: 'ring', Pinky: 'pinky' };

/** Resolve a Mixamo or Universal bone name ('RightHand', 'mixamorigRightHand', 'hand_r'). */
export function boneName(name) {
  const n = name.replace(/^mixamorig:?/, '');
  if (BONE_ALIASES[n]) return BONE_ALIASES[n];
  const f = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)([1-4])$/.exec(n);
  if (f) return `${FINGERS[f[2]]}_0${f[3]}${f[3] === '4' ? '_leaf' : ''}_${f[1] === 'Left' ? 'l' : 'r'}`;
  return n;
}

/**
 * Old clip names -> library clips. `y` (metres) is added under the model while the clip plays, to
 * cancel a legacy model offset that callers still apply (the Xbot sat with 'sad' at model y -0.42;
 * the seated clip already lowers the pelvis).
 */
export const CLIP_ALIASES = {
  sad: { clip: 'sit_idle', y: 0.42 }, // legacy seat: callers put model.y at -0.42
  sad_pose: { clip: 'sit_idle', y: 0.42 },
  sneak: { clip: 'crouch_idle' }, // the Xbot's static crouch pose
  sneak_pose: { clip: 'crouch_idle' },
  crouch_walk: { clip: 'crouch_walk' },
  jog: { clip: 'run' },
  nod: { clip: 'agree' },
  sit: { clip: 'sit_idle' },
  sad_idle: { clip: 'slump', timeScale: 0.5 },
  // The plain library idle, for a character whose recipe remaps 'idle' (Jo's is arms_crossed).
  stand: { clip: 'idle' },
  // Sami on his bike (ch5 puts the model +0.43 m up): seated, lifted the rest of the way to the saddle.
  ride: { clip: 'sit_idle', y: 0.215 },
};

/**
 * Root offsets per clip (rig units, before the character's scale). The seated loops move the pelvis
 * 0.32 m behind the feet; shifting them forward puts the pelvis over the root, which is where every
 * caller places a sitter (the seat point).
 */
export const CLIP_ROOT = { sit_idle: { z: 0.316 }, sit_talk: { z: 0.316 } };

/**
 * Cycle lengths (s) the loops are retimed to at load. The walk matches 1.3 m/s at timeScale 1 for
 * a 1.8 m adult; the jog keeps a runner's cadence (150 spm at timeScale 1).
 */
export const CLIP_RETIME = { walk: 1.06, run: 0.8 };
/**
 * Stride reduction applied at load. The library's Jog_Fwd_Loop is a bounding 7.3 m/s stride with long
 * flights: below about 6 m/s its planted foot slides backwards. `legs` pulls every leg-bone rotation
 * towards its cycle mean (shorter swing, same cadence and arms); `lift` (metres) raises the pelvis
 * track so the straighter stance leg still lands on the ground. Measured: 4.66 m/s, ball of the
 * foot at +12 mm in stance (.cache/tools/fix-eval.mjs with the stride probe).
 */
export const CLIP_STRIDE = { run: { legs: 0.6, lift: 0.069 } };
/**
 * An old man's walk (M. Durand), derived from `walk` at load: a slower cycle (`cycle`, s) and a
 * shorter stride (`legs`, as CLIP_STRIDE), the pelvis raised by `lift` (m) so the planted foot
 * stays on the ground (it sank 19 mm). Measured with .cache/tools/chars-r4/gait.js: 0.67 m/s at
 * timeScale 1, ball of the foot at +5 mm in stance (the walk: 1.30 m/s, +5 mm).
 */
export const WALK_OLD = { cycle: 1.3, legs: 0.62, lift: 0.019 };
const WALK_OLD_SPEED = 0.67;
/**
 * Ground speed (m/s) of a scale-1 character at timeScale 1, after the retime and the stride
 * reduction. A character covers CLIP_SPEED x model.scale.z (scale x slim): use Character.strideRate().
 */
export const CLIP_SPEED = { walk: 1.3, run: 4.66, sprint: 8.8, walk_formal: 1.04, crouch_walk: 0.8, shamble: 1.1, carry: 0.7, walk_old: WALK_OLD_SPEED };

/**
 * Foot contacts in the walk loop (phase 0..1 when each heel strikes), measured on the scale-1
 * athletic rig. Player uses them for the limp and the footstep sounds.
 */
export const WALK_CONTACT = { left: 0.0, right: 0.5 };

// ------------------------------------------------------------------------------- palettes
const SKINS = ['#f2dccf', '#ecd0bd', '#e0bc9f', '#d2a888', '#b88a6a', '#a07254', '#8a5e44'];
const COATS = ['#3c4248', '#45403a', '#4f4a3e', '#2e3440', '#5a4a3c', '#4a3f45', '#3e4a44'];
const TROUSERS = ['#2f3236', '#3a4250', '#45403a', '#2c2a2e', '#38352f'];
// Saturated or dark: under the grey Ch2 grade a pale, tan or orange top reads as bare skin.
const KIT = ['#22314f', '#2b4f9e', '#1d6a72', '#2c2f35', '#a3262f', '#2f5f46'];
const SHOES_KIT = ['#2a2d33', '#3a3a3e', '#5a5e66', '#22242a'];
const HAIR = ['#1b1715', '#2a1d17', '#3a2a20', '#4a3a2c', '#6a5038', '#8a8580', '#b8a888'];
const M_HAIR = ['hair_buzzed', 'hair_parted', 'hair_beard'];
const F_HAIR = ['hair_buns', 'hair_long', 'hair_buzzed_f'];

const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];

// ------------------------------------------------------------------------------- recipes
// Recipe fields:
//   rig      'm_regular' | 'f_regular' | 'm_athletic' | 'f_athletic' (bone rest translations)
//   parts    part node names in parts.glb
//   skin, hair, brows   colours for the skin_* / hair_* parts (brows default to hair)
//   colors   { part: colour } for cloth parts
//   primary  parts recoloured by Character.setTint(); with `kit`, setTint recolours kit.top
//   kit      painted running kit on an athletic body: { top, sleeves: 'none'|'short'|'long',
//            legs: 'short'|'long', bottom, shoes }
//   scale, head (Head bone scale), stoop (rad added to spine_03 and neck_01), slim (x/z squash)
//   age      0..1 aged skin on the face (female and male heads)
//   inner    { color, w: [half width at the waist, at the neck] (m), buttons? }: the top is an open
//            jacket / cardigan over an inner top of `color` (tintInner: setTint recolours that top)
//   trim     { part: [min |x|, max |x|, min y, max y] } bind-pose metres: fragments outside are discarded
//            (Jo: sleeves rolled to the elbow, only the athletic forearms under them)
//   tattoo   sleeve design on the forearms and hands (tattoo.js: 'jo')
//   rings    finger bones that get a ring; pencil (behind the right ear); cap (flat cap colour)
//   clips    { asked: played } per-character clip remap ('walk' -> 'walk_old', 'idle' -> ...)
//   pace     natural walking speed (m/s, Character.pace) for callers that drive the walk

const hugoBase = { skin: '#f0d8c8', hair: '#2e2420' };
// The athletic rig is a superhero build; distance runners are whippets: every runner (Hugo's kits,
// the run club, the race field) is narrowed in x/z.
const RUNNER_SLIM = 0.86;

function athlete(rng, female, long) {
  const hair = female ? pick(rng, F_HAIR) : pick(rng, M_HAIR);
  const s = female ? 'f' : 'm';
  return {
    rig: `${s}_athletic`,
    parts: [`${s}_body`, `${s}_eyes`, `${s}_brows`, hair],
    skin: pick(rng, SKINS),
    hair: pick(rng, HAIR.slice(0, 6)),
    kit: { top: pick(rng, KIT), sleeves: long ? 'long' : 'short', legs: long ? 'long' : 'short', bottom: '#1c1d20', shoes: pick(rng, SHOES_KIT) },
    scale: 0.95 + rng() * 0.1,
    slim: RUNNER_SLIM,
  };
}

function civilian(rng, female, rain) {
  const s = female ? 'f' : 'm';
  const top = pick(rng, COATS);
  const trousers = rng() < 0.5 ? `${s}_trousers` : `${s}_trousers2`;
  const shoes = rng() < 0.6 ? `${s}_shoes` : `${s}_boots`;
  const head = rain ? `${s}_hood` : female ? pick(rng, F_HAIR) : pick(rng, M_HAIR);
  const parts = [`${s}_head`, `${s}_eyes`, `${s}_brows`, head, female ? 'f_blouse' : 'm_shirt', `${s}_sleeves`, trousers, shoes];
  if (female) parts.push('f_hands');
  if (!female && !rain && head !== 'hair_beard' && rng() < 0.25) parts.push('hair_beard');
  const colors = { [female ? 'f_blouse' : 'm_shirt']: top, [`${s}_sleeves`]: top, [trousers]: pick(rng, TROUSERS), [shoes]: pick(rng, ['#2b2622', '#3a3430', '#2a2624']) };
  if (rain) colors[head] = top;
  return {
    rig: `${s}_regular`,
    parts,
    skin: pick(rng, SKINS),
    hair: pick(rng, HAIR),
    colors,
    primary: [female ? 'f_blouse' : 'm_shirt', `${s}_sleeves`],
    scale: 0.94 + rng() * 0.1,
  };
}

/** variant tokens: 'm' | 'f' (body), 'long' (long sleeves and tights), 'rain' (hood instead of hair). */
const tokens = (variant) => new Set(String(variant || '').split(/[\s,_-]+/).filter(Boolean));

export const CAST = {
  hugo: {
    outfits: {
      civilian: {
        ...hugoBase,
        rig: 'm_regular',
        parts: ['m_head', 'm_eyes', 'm_brows', 'hair_parted', 'hair_beard', 'm_shirt', 'm_sleeves', 'm_trousers2', 'm_shoes'],
        colors: { m_shirt: '#4a5260', m_sleeves: '#4a5260', m_trousers2: '#2f3236', m_shoes: '#3a3430' },
        primary: ['m_shirt', 'm_sleeves'],
      },
      // The flashback: the athletic body in painted race kit (setTint recolours the top: STRIDE green).
      runner: {
        ...hugoBase,
        rig: 'm_athletic',
        slim: RUNNER_SLIM,
        parts: ['m_body', 'm_eyes', 'm_brows', 'hair_parted', 'hair_beard'],
        kit: { top: '#1f4f8a', sleeves: 'short', legs: 'short', bottom: '#1c1d20', shoes: '#3a3d44' },
      },
      runner_dawn: {
        ...hugoBase,
        rig: 'm_athletic',
        slim: RUNNER_SLIM,
        parts: ['m_body', 'm_eyes', 'm_brows', 'hair_parted', 'hair_beard'],
        kit: { top: '#1f4f8a', sleeves: 'long', legs: 'long', bottom: '#1c1d20', shoes: '#3a3d44' },
      },
    },
  },
  // 74, a retired sign painter: short cropped white hair, an aged face (`age`: skin shader), a real
  // bib apron in ochre canvas with paint on it (DESIGN), a grey cardigan's sleeves over a dark top,
  // loose work trousers over flat shoes, and a stoop.
  odile: () => ({
    rig: 'f_regular',
    scale: 0.94,
    stoop: 0.2,
    age: 1,
    parts: ['f_head', 'f_eyes', 'f_brows', 'hair_buzzed_f', 'f_blouse', 'f_sleeves', 'f_hands', 'f_trousers2', 'f_shoes'],
    skin: '#ecd6c8',
    hair: '#dcd8d0',
    brows: '#9a948c',
    colors: { f_blouse: '#4a4c52', f_sleeves: '#7d7f84', f_trousers2: '#3f3d38', f_shoes: '#2b2622' },
    apron: '#b08850', // ochre canvas (multiplies the apron texture)
    primary: ['f_sleeves'],
  }),
  // An 11-year-old: small, a bigger head, slighter build. The face is still the adult one.
  sami: () => ({
    rig: 'm_regular',
    scale: 0.74,
    head: 1.22,
    slim: 0.9,
    parts: ['m_head', 'm_eyes', 'm_brows', 'hair_buzzed', 'm_shirt', 'm_sleeves', 'm_trousers', 'm_shoes'],
    skin: '#b88a6a',
    hair: '#1b1715',
    colors: { m_shirt: '#c24a3a', m_sleeves: '#c24a3a', m_trousers: '#34405a', m_shoes: '#4a4e56' }, // red hoodie (DESIGN)
    primary: ['m_shirt', 'm_sleeves'],
  }),
  bastien: (rng, v) => ({
    rig: 'm_athletic',
    parts: ['m_body', 'm_eyes', 'm_brows', 'hair_buzzed'],
    skin: '#c49a7c',
    hair: '#2a2420',
    kit: { top: '#d6e04a', sleeves: v.has('long') ? 'long' : 'short', legs: v.has('long') ? 'long' : 'short', bottom: '#1c1d20', shoes: '#2a2d33' },
  }),
  ines: () => ({
    rig: 'f_regular',
    scale: 0.96,
    parts: ['f_head', 'f_eyes', 'f_brows', 'hair_long', 'f_blouse', 'f_sleeves', 'f_hands', 'f_trousers2', 'f_boots'],
    skin: '#d9b49a',
    hair: '#2a1d17',
    colors: { f_blouse: '#6b6a3f', f_sleeves: '#6b6a3f', f_trousers2: '#2e3138', f_boots: '#3a2c22' },
    primary: ['f_blouse', 'f_sleeves'],
  }),
  marco: () => ({
    rig: 'm_regular',
    scale: 0.98,
    parts: ['m_head', 'm_eyes', 'm_brows', 'hair_buzzed', 'hair_beard', 'm_shirt', 'm_sleeves', 'm_trousers', 'm_shoes'],
    skin: '#d8b498',
    hair: '#3a3634',
    colors: { m_shirt: '#cfc9bd', m_sleeves: '#cfc9bd', m_trousers: '#3a3a3a', m_shoes: '#2a2624' },
    primary: ['m_shirt', 'm_sleeves'],
  }),
  mme: () => ({
    rig: 'f_regular',
    scale: 0.92,
    stoop: 0.18,
    age: 0.8,
    parts: ['f_head', 'f_eyes', 'f_brows', 'hair_buns', 'f_blouse', 'f_sleeves', 'f_hands', 'f_trousers', 'f_shoes'],
    skin: '#f6e4d8',
    hair: '#9a9590',
    brows: '#5a5550',
    colors: { f_blouse: '#5d4450', f_sleeves: '#6b5a60', f_trousers: '#2c2a2e', f_shoes: '#2b2622' },
    primary: ['f_blouse'],
  }),
  // Revision 4 (docs/DESIGN-R4.md). Josianne "Jo" Lavoie, 34, a fine-line tattoo artist from
  // Hochelaga: a black jacket open over an oxblood top (`inner`; her tint recolours the top, not the
  // jacket), the sleeves shoved up to the elbow (`trim` keeps only the athletic body's forearms and
  // hands under them), both forearms and the backs of her hands sleeved in fine black linework
  // (`tattoo`: tattoo.js), silver rings, a pencil behind her ear, and a confident idle.
  jo: () => ({
    rig: 'f_regular',
    scale: 0.97,
    stoop: -0.05, // chest up, chin up
    parts: ['f_head', 'f_eyes', 'f_brows', 'hair_buns', 'f_blouse', 'f_sleeves', 'f_body', 'f_trousers2', 'f_boots'],
    skin: '#e6c6ae',
    hair: '#161214',
    colors: { f_blouse: '#1d1d20', f_sleeves: '#1d1d20', f_trousers2: '#26272b', f_boots: '#1e1a18' },
    inner: { color: '#6b2430', w: [0.045, 0.085] },
    tintInner: true,
    trim: { f_sleeves: [0, 0.432], f_body: [0.424, 9] },
    tattoo: 'jo',
    rings: ['index_01_l', 'ring_01_l', 'middle_01_r', 'index_01_r', 'pinky_01_l'],
    pencil: true,
    clips: { idle: 'arms_crossed' },
    primary: [],
  }),
  // M. Albert Durand, 81: CYCLES DURAND for 52 years. Stooped, aged, cropped grey hair under a tweed
  // flat cap, a brown cardigan over a pale shirt (a V opening with buttons), and a slow, short walk
  // (`clips.walk`; `pace` is the speed to drive him at, m/s).
  durand: () => ({
    rig: 'm_regular',
    scale: 0.95,
    slim: 0.95,
    stoop: 0.22,
    age: 1,
    parts: ['m_head', 'm_eyes', 'm_brows', 'hair_buzzed', 'hair_beard', 'm_shirt', 'm_sleeves', 'm_trousers', 'm_shoes'],
    trim: { hair_beard: [0, 0.042, 1.615, 1.66] }, // the beard cut down to a moustache
    skin: '#ead2c4',
    hair: '#5f5a54',
    brows: '#5a554f',
    colors: { m_shirt: '#6e5a44', m_sleeves: '#6e5a44', m_trousers: '#4a463e', m_shoes: '#2b2622' },
    inner: { color: '#cfcabd', w: [0.03, 0.08], buttons: '#3a2e22' },
    cap: '#9a8f7c',
    clips: { walk: 'walk_old' },
    pace: 0.6,
    primary: ['m_shirt', 'm_sleeves'],
  }),
  runner: (rng, v) => athlete(rng, v.has('f') || (!v.has('m') && rng() < 0.4), v.has('long')),
  spectator: (rng, v) => civilian(rng, v.has('f') || (!v.has('m') && rng() < 0.45), v.has('rain')),
  passerby: (rng, v) => civilian(rng, v.has('f') || (!v.has('m') && rng() < 0.5), v.has('rain')),
};

// The Revision 4 renames: Lou was Ines, Gérard was Marco. The old ids stay (the chapters use them).
CAST.lou = CAST.ines;
CAST.gerard = CAST.marco;

/** Small deterministic RNG (mulberry32) seeded from a string, so a named extra looks the same every run. */
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The outfits (recipes) for a preset: { [outfitName]: recipe }, plus the default outfit name.
 * Unknown presets fall back to 'passerby'.
 */
export function castRecipes(preset, variant, seed) {
  const entry = CAST[preset] || CAST.passerby;
  if (entry.outfits) {
    const def = entry.outfits[variant] ? variant : Object.keys(entry.outfits)[0];
    return { outfits: entry.outfits, current: def };
  }
  const rng = seededRandom(seed ?? preset);
  return { outfits: { default: entry(rng, tokens(variant)) }, current: 'default' };
}
