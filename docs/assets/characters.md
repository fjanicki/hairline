# Characters asset group (Quaternius "Universal" family, CC0)

- **Fetch:** `scripts/assets/characters.sh`, run by `scripts/fetch-assets.sh`. Standalone: `ROOT=$PWD bash scripts/assets/characters.sh`. It needs `npm install` first, for the devDependencies `@gltf-transform/{core,extensions,functions}` 4.5 and `sharp` 0.35.
- **Build:** `scripts/assets/characters-build.mjs <src> <out>`, called by the script. It is deterministic and takes about 3.5 s with a warm cache.
- **Output:** `public/assets/characters/` holds **5.3 MB** in 4 files:

| File | KB | What |
|---|---|---|
| `parts.glb` | 4,503 | One 65-bone skeleton plus 31 skinned part meshes (bodies, heads, hands, hair, outfit pieces). Each part has its own inverse bind matrices. 7 materials, 18 JPG textures (1024², eyes 256²). KHR_mesh_quantization only, so **no Draco or meshopt decoder is needed**. Rig rest poses are in `gltf.scene.userData.hairline`. Per-part metadata is in each node's `userData` (`part`, `tris`, `material`, `lum`). |
| `anims.glb` | 770 | The mannequin skeleton (no mesh) plus **34 clips** renamed to our names. Rotation tracks are normalised int16 (core glTF). Translation is kept on `pelvis` only, and there are no scale tracks. Clip durations are in `gltf.scene.userData.hairline.clips`. |
| `kit_m.png`, `kit_f.png` | 56 + 55 | 512² RGBA garment masks in the athletic bodies' UVs, used to paint running kit and tights onto the bodies (see Runtime). |

- **Licence:** everything is **CC0 1.0** by Quaternius (`License_Standard.txt` in each zip, and "Creative Commons Zero v1.0 Universal" on the itch pages). No attribution is required. A courtesy line "Characters and animations: Quaternius (CC0)" in the credits is good practice. Nothing here is Mixamo.

## Sources (free [Standard] downloads on itch.io, pay-what-you-want with 0)

| Pack | itch slug | Upload resolved by name | Zip | Licence |
|---|---|---|---|---|
| Universal Base Characters | `universal-base-characters` | `Universal Base Characters[Standard].zip` (id 15861669 today) | 122 MB | CC0 |
| Universal Animation Library | `universal-animation-library` | `Universal Animation Library[Standard].zip` (17958403) | 15 MB | CC0 |
| Universal Animation Library 2 | `universal-animation-library-2` | `Universal Animation Library 2[Standard].zip` (17958478) | 17 MB | CC0 |
| Modular Character Outfits - Fantasy | `modular-character-outfits-fantasy` | `Modular Character Outfits - Fantasy[Standard].zip` (16289385) | 280 MB | CC0 |

The script follows the itch flow (page → csrf → `/download_url` → upload id **by name** → signed R2 URL, valid for 60 s). It caches each zip in `.cache/dl/characters/`, checks that it is a real zip, and fails with `[hairline] characters.sh: ...` if itch changes. It then extracts only the glTF folders into `.cache/dl/characters/src/` (139 MB, once per zip) and builds. `.cache/dl/characters/src/manifest.json` lists the tris, luminance and clip durations of each part.

**Modular Character Outfits - Fantasy is the only outfit pack on the same skeleton.** quaternius.com and itch list no modern, sci-fi or casual "Universal" outfit pack today.

### What the free Standard files contain (and what they do not)

- **Base Characters:** only the 2 **Superhero** bodies (male 1.81 m, female 1.77 m; heavily muscled, stylised faces). Regular and Teen bodies, the other 14 hairstyles and the skin/eye shaders are **Source-only (paid)**. Hair: 6 styles plus 2 eyebrow meshes. Formats: glTF (Godot/UE folder) and FBX (Unity).
- **Animation Library 1 and 2:** 43 clips each in the Standard GLBs (the itch pages say 120+ and 130+ for Source). Each comes in an in-place version and a root-motion (`_RM`) version. We use in-place. Both are GLB; there is also a female mannequin GLB without clips.
- **Outfits - Fantasy:** only **Peasant** and **Ranger**, male and female (the other 10 outfits are Source-only). The parts are separate glTFs, with 4k PNG textures and 2 colour variants each. They are modelled on the "Regular" proportions.

## Inspection (tools: `.cache/tools/chars-inspect.mjs`, `chars-joints.mjs`, `chars-probe2.mjs`)

**Units and orientation:** metres, Y-up. The armature's `root` bone carries the Z-up → Y-up rotation (quaternion −90° about X). **The model faces +Z at `rotation.y = 0`** (eye centre at z = +0.066), the same as the Xbot, so `Math.atan2(dx, dz)` still works. The **bind pose is a T-pose** (arm span ±0.93 m male). The feet sit on y = 0.

**Skeleton:** 65 joints with Unreal-style names, identical in every file. `root > pelvis > spine_01 > spine_02 > spine_03 > neck_01 > Head`; `clavicle_l > upperarm_l > lowerarm_l > hand_l > {thumb,index,middle,ring,pinky}_0{1,2,3}_l + *_04_leaf_l`; `thigh_l > calf_l > foot_l > ball_l > ball_leaf_l`; the same with `_r`. **Left shin/calf = `calf_l`, left foot = `foot_l`** (Mixamo `LeftLeg` / `LeftFoot`).

| Mixamo (Xbot) | Universal |
|---|---|
| Hips | pelvis |
| Spine / Spine1 / Spine2 | spine_01 / spine_02 / spine_03 |
| Neck / Head | neck_01 / Head |
| LeftShoulder / LeftArm / LeftForeArm / LeftHand | clavicle_l / upperarm_l / lowerarm_l / hand_l |
| LeftUpLeg / LeftLeg / LeftFoot / LeftToeBase | thigh_l / calf_l / foot_l / ball_l |

The rest poses differ slightly per body, so the build stores each in `userData.hairline.rigs[rig][bone] = [x, y, z]`, with the pelvis height in `pelvisRest` (m):

| Rig | From | Pelvis | Notes |
|---|---|---|---|
| `m_athletic` | Superhero_Male | 0.949 | Thighs 0.114 m off centre, upper arm 0.206 |
| `f_athletic` | Superhero_Female | 0.932 | |
| `m_regular` | Male_Peasant (outfit rig) | 0.949 | Same as athletic except hips 0.091 and upper arm 0.188 |
| `f_regular` | Female_Peasant | 0.932 | Identical to `f_athletic` |
| `mannequin` | UAL1 (the clips) | 0.917 | Legs 0.829 m (athletic 0.888) |

**How hair and outfits attach:** every hairstyle, eyebrow set and outfit piece is a **separate SkinnedMesh on the same 65-bone skeleton**, with its own inverse bind matrices (hair is weighted to `Head` only). There are no sockets, morph targets or shader masks (all vertex colours are constant 1.0). The outfit readme says to use only the base character's head under clothes. A full body clips through.

**Source meshes, materials and textures** (tris):

| Source | Meshes | Materials / textures |
|---|---|---|
| Superhero_Male | body 12,566; eyes 768; eyebrows 984 | `MI_Superhero_Male`: BaseColor (Dark = black underwear, Light = white), Normal, Roughness, 2048² PNG. `MI_Eyes` 256². `MI_Hair_1`: grey BaseColor + Normal 2048² (hair is meant to be tinted) |
| Superhero_Female | body 12,812; eyes 768; eyebrows 1,480 | The same set with `MI_Hair_2` |
| Hair (rigged to Head) | Buzzed 830, BuzzedFemale 830, SimpleParted 1,301, Beard 1,034, Long 2,906, Buns 3,284 | `MI_Hair_1` / `MI_Hair_2` |
| Male_Peasant | Arms 5,338 (sleeves + bare hands in `MI_Regular_Male`), Body 3,856, Legs 1,112, Feet 2,588 | `MI_Peasant` BaseColor / Normal / ORM, 4096² |
| Female_Peasant | Arms 6,848 (sleeves + leather gloves/bracers), Body 2,188 (blouse + corset), Legs 1,944, Feet 2,588 | `MI_Peasant` |
| Male/Female_Ranger | Legs 1,128 / 1,204, Feet_Boots 9,172, Head_Hood 2,136 (plus pauldrons, bracers and belts, which are not used) | `MI_Ranger` 4096² |
| UAL1/UAL2 Standard GLB | Mannequin 13,744 (dropped) | Flat orange/purple |

The glTFs reference a few images by wrong names (`T_Eye_Normal_png.png`). The build resolves them leniently. The "Godot - UE" glTF normals are the OpenGL (+Y) set, which is correct for glTF.

## What the build does

1. **One skeleton** (the athletic male joints). Every wanted mesh is re-skinned onto it by joint name and keeps its own IBMs. So a part fits its own rig exactly once the matching rest translations are applied (Runtime, step 2).
2. **Cuts** (bind-pose triangles kept by centroid):
   - `m_head`, `f_head`: the athletic body above y = 1.39 inside the neck width. The chest band from 1.39 to 1.53 is **tucked** (x × 0.75, z halfway to the spine) so it fills the shirt collars without poking through. The superhero chest otherwise breaks through the regular-fit shirts.
   - `f_sleeves`: the female blouse sleeves without the fantasy gloves and bracers (|x| < 0.50). `f_hands`: the bare forearms and hands from the female athletic body (|x| > 0.47).
   - The male sleeves' bare hands are re-pointed from `MI_Regular_Male` to the athletic skin, which has the same UV layout. Skin then tints identically on head and hands, and 3 regular-body textures are dropped.
3. **Attributes:** POSITION, NORMAL, TEXCOORD_0, JOINTS_0 and WEIGHTS_0 only (JOINTS_1 dropped, weights renormalised). Quantised to 14-bit positions, 10-bit normals, 12-bit UVs and 8-bit weights.
4. **Textures:** everything is 1024² JPG (normals q92, others q86), and eyes stay 256². Skin albedo is desaturated to 0.78 and lightened 6% (less orange, so the recipe sets the tone). **Cloth albedo is made grey and levelled per part** (mean linear luminance ≈ 0.42 inside each part's UV islands), so one tint per part lands on its colour.
5. **Kit masks:** the athletic bodies' triangles are rasterised into UV space from bind-pose height and skin weights: R = top (waistband to neck, armholes left open), G = sleeves (1 = short, 0.5 = to the wrist), B = legs (1 = shorts above the knee, 0.5 = full-length tights), A = shoes (below the ankle). The masks are dilated 4 px against seams.
6. **Anims:** only the mapped clips, with rotations for all 65 joints, pelvis translation only, no scale, `resample` (tolerance 1e-4) and int16 rotations. Dropping the per-bone translation keeps each rig's own bone lengths. 1.18 MB → 770 KB.

## Clip mapping (our name → library clip → seconds)

Speed is the root-motion speed measured from the `_RM` files for the mannequin. Use `action.timeScale = v / speed`. The athletic rig strides about 7% longer.

| Ours | Library clip | s | Use / note |
|---|---|---|---|
| `idle` | UAL1 Idle_Loop | 2.50 | Relaxed but slightly wide stance |
| `walk` | UAL1 Walk_Loop | 1.33 | 0.97 m/s |
| `walk_formal` | UAL1 Walk_Formal_Loop | 1.33 | Stiffer, upright walk (0.97 m/s). A careful-walk alternative |
| `run` (= jog) | UAL1 Jog_Fwd_Loop | 0.93 | 5.36 m/s. Marathon and run-club pace. Runner's `clamp(v/5)` maps about 1:1 |
| `sprint` | UAL1 Sprint_Loop | 0.67 | 8.25 m/s. Ch3 finishing kick |
| `sneak` | UAL1 Crouch_Fwd_Loop | 2.00 | Crouched walk, 0.75 m/s. For the old static `sneak` pose, use frame 0 or `crouch_idle` |
| `crouch_idle` | UAL1 Crouch_Idle_Loop | 2.93 | Crouch / squat |
| `kneel_work` | UAL1 Fixing_Kneeling | 5.20 | **Kneels and works with both hands low.** Ch4 truing Sami's wheel, bike repair |
| `kneel_reach` | UAL2 Farm_PlantSeed | 2.77 | Kneels on one knee and reaches to the ground. **Ch5 painting the line**, sign work on the floor |
| `sit_idle` / `sit_talk` | UAL1 Sitting_Idle_Loop / Sitting_Talking_Loop | 1.67 / 2.93 | On a chair. The mannequin pelvis sits 0.54 m above the floor, so use a seat about 0.45 m high |
| `sit_down` / `stand_up` | UAL1 Sitting_Enter / Sitting_Exit | 1.30 / 1.03 | One-shot (`once: true`) |
| `talk` | UAL1 Idle_Talking_Loop | 2.93 | Talk gesture 1 |
| `phone` | UAL2 Idle_TalkingPhone_Loop | 2.93 | Hand to ear. Talk gesture 2, phone_idle |
| `call_out` | UAL2 Idle_Rail_Call | 2.50 | Hand cupped to the mouth, shouting. Spectators cheering, "Sami!" |
| `agree` | UAL2 Yes | 2.50 | A thumbs-up "yes" gesture. The probe stills show the thumb; a head nod was not checked. It stands in for the Xbot nod |
| `headShake` | UAL2 Idle_No_Loop | 2.50 | "No" |
| `arms_crossed` | UAL2 Idle_FoldArms_Loop | 2.50 | |
| `lean` | UAL2 Idle_Rail_Loop | 2.50 | Leans forward on a rail or counter at hip height. Marco at the counter, Hugo at the bench |
| `slump` | UAL2 Zombie_Idle_Loop | 1.33 | Shoulders down, arms hanging. **The `sad` / `sad_pose` slumped idle.** Play at `timeScale` 0.4–0.6 so it does not read as a zombie |
| `shamble` | UAL2 Zombie_Walk_Fwd_Loop | 1.33 | Dragging, uneven walk (1.05 m/s). **The nearest thing to an injured or limping walk.** It reads as a zombie at full speed. The Player's procedural limp on `walk` is probably better |
| `reach` | UAL1 Interact | 2.00 | Reaches forward and presses or takes something at chest height |
| `pick_up` | UAL1 PickUp_Table | 0.83 | Picks something up from a table |
| `open_box` | UAL2 Chest_Open | 1.37 | Bends and lifts a lid low. Toolbox, paint tin |
| `paint` | UAL1 Idle_Torch_Loop | 1.27 | One arm held out at shoulder height. **Holding a brush to a wall or sign** |
| `hold_can` | UAL2 Idle_Lantern_Loop | 2.50 | One arm forward and low, holding something. Paint tin, bag |
| `pour` | UAL2 Farm_Watering | 3.80 | Tilting a can |
| `drink` | UAL2 Consume | 1.33 | Cup to the mouth. Ch4 coffee |
| `hammer` | UAL2 TreeChopping_Loop | 0.97 | Two-handed side swing. It reads as chopping more than hammering; play it slower |
| `push` | UAL1 Push_Loop | 2.67 | Pushing at shoulder height (0.30 m/s). Door, cart, stalled bike |
| `carry` | UAL2 Walk_Carry_Loop | 2.00 | Walking with a box held in both arms (0.65 m/s) |
| `fall` | UAL2 Hit_Knockback | 0.83 | Knocked back onto the ground. **Ch3 KM 31 collapse / Ch2 stumble.** One-shot, clamp when finished |
| `get_up` | UAL2 LayToIdle | 1.53 | From lying to standing (after `fall`) |

**Not in the free Standard libraries:** `sit_ground`, `wave`, `clap`, `cheer` (use `call_out`), `look_around`, a real `limp` (use `shamble` or the procedural limp), cycling or riding. `Driving_Loop` exists but has no pedalling. The Source versions or Universal Animation Library 2 may have more. Left out on purpose: combat, guns, swords, swimming, jumps, dance, death and zombie scratch.

## Runtime contract (to put in `Assets.js`; the probe implemented and tested exactly this)

```js
const [parts, anims] = await Promise.all([loader.loadAsync(assetUrl('characters/parts.glb')), loader.loadAsync(assetUrl('characters/anims.glb'))]);
const meta = parts.scene.userData.hairline;            // { rigs, pelvisRest }
const clips = Object.fromEntries(anims.animations.map((c) => [c.name, c]));

function build(recipe) {
  const model = SkeletonUtils.clone(parts.scene);
  const arm = model.getObjectByName('Armature');
  for (const c of [...arm.children]) if (!c.isBone && !recipe.parts.includes(c.name)) arm.remove(c);   // 1. keep the recipe's parts
  const rest = meta.rigs[recipe.rig];                                                                   // 2. rig proportions
  model.traverse((o) => o.isBone && rest[o.name] && o.position.fromArray(rest[o.name]));
  const s = recipe.scale ?? 1;
  model.scale.setScalar(s);
  model.position.y = (meta.pelvisRest[recipe.rig] - meta.pelvisRest.mannequin) * s;                   // 3. clips carry the mannequin pelvis height
  // 4. materials: clone per character. Node userData = { part, lum }. A multi-primitive part (m_sleeves) is a Group whose child meshes read it from the parent.
  //    skin_*  : color = recipe.skin (multiply, ~0xf0d8c8 light … 0x9a6c50 dark)
  //    hair_*  : color = recipe.hair / lum            (brows can take recipe.brows)
  //    cloth_* : color = recipe.tint[part] / lum      (clamp the factor to <= 4)
  //    *_body with recipe.kit: onBeforeCompile after <map_fragment>, sample kit_<m|f>.png (flipY=false, NoColorSpace) with vMapUv:
  //      top = max(step(R), step(G vs sleeves cut)); legs = step(B vs legs cut); shoes = step(A); cut: short 0.75, long 0.35, none 2
  //      diffuse = mix(diffuse, kitColour * (0.8 + 0.55 * luminance(diffuse)), mask); roughness -> 0.85 on cloth
  if (recipe.head) model.getObjectByName('Head').scale.setScalar(recipe.head);                         // 5. kid proportions (hair follows)
  const mixer = new THREE.AnimationMixer(model);                                                       // 6. clips bind by bone name
  // optional stoop after mixer.update: spine_03.quaternion and neck_01.quaternion *= rotX(recipe.stoop)
}
```

- The skinned meshes keep their bind-pose bounding spheres. The existing padded-sphere culling (`radius × 1.5`) works unchanged.
- The walking boot: parent it to `calf_l` (was `LeftLeg`). The peasant and ranger boots are calf-high (top at 0.45 / 0.56 m). The boot shell has to be slightly larger than them, or Hugo's chapters can use `m_shoes`, which is the lower boot.
- Fallback: if either GLB fails, keep the current capsule (or the Xbot while it remains).

## Cast recipes

Colours are linear-ish sRGB hex values before the game grade. Hope desaturates them anyway, and the colour should come back on the things Hugo makes, so keep clothes muted. Tris are per character (one pass). Draw calls = number of parts (`m_sleeves` counts 2), ×2 with shadows.

| Who | Rig, scale | Parts | Colours | Tris / draws |
|---|---|---|---|---|
| **Hugo**, 37 (ch1, 2, 4, 5) | `m_regular`, 1.0 | m_head, m_eyes, m_brows, hair_parted, hair_beard, m_shirt, m_sleeves, m_trousers2, m_shoes | skin `f0d8c8`, hair `2e2420`, shirt + sleeves `4a5260` (the old HUGO_TINT slate), trousers `2f3236`, boots `3a3430` | 20.2k / 10 |
| **Hugo, flashback runner** (ch3) | `m_athletic`, 1.0 | m_body, m_eyes, m_brows, hair_parted, hair_beard | kit: top `b8402e`, shorts `1c1d20`, shoes `e9e4da` (no sleeves). Dawn blocks: `sleeves: 'long', legs: 'long'` | 16.7k / 5 |
| **Odile**, 74 | `f_regular`, 0.94, stoop 0.2 (head kept level), `age: 1` (skin shader: lines, under-eye, spots) | f_head, f_eyes, f_brows, hair_buzzed_f, f_blouse, f_sleeves, f_hands, f_trousers2, f_shoes, plus a skinned bib **apron** built at runtime (CharacterKit._apron) | skin `ecd6c8`, hair `dcd8d0` (short, white), top `4a4c52`, cardigan sleeves `7d7f84`, trousers `3f3d38`, apron `b08850` (ochre canvas with paint; callers' tint recolours it) | ~21k / 10 |
| **Sami**, about 11 | `m_regular`, **0.76**, `head: 1.2` | m_head, m_eyes, m_brows, hair_buzzed, m_shirt, m_sleeves, m_trousers, m_shoes | skin `b88a6a`, hair `1b1715`, shirt `c49a34` (mustard), trousers `34405a`, shoes `d8d2c6` | 18.7k / 9 |
| **Bastien**, club runner | `m_athletic`, 1.0 | m_body, m_eyes, m_brows, hair_buzzed | skin `c49a7c`, kit top `2f7f86` (club teal) with `sleeves: 'short'`, shorts `1c1d20`, shoes `2a2d33` | 15.1k / 4 |
| **Ines**, neighbour with a camera | `f_regular`, 1.0 | f_head, f_eyes, f_brows, hair_long, f_blouse, f_sleeves, f_hands, f_trousers2, f_boots | skin `d9b49a`, hair `2a1d17`, blouse `6b6a3f` (olive), trousers `2e3138`, boots `3a2c22` | 26.2k / 9 |
| **Marco**, shop owner | `m_regular`, 0.98 | m_head, m_eyes, m_brows, hair_buzzed, hair_beard, m_shirt, m_sleeves, m_trousers, m_shoes | skin `d8b498`, hair and beard `3a3634` (greying), shirt `cfc9bd` (off-white), trousers `3a3a3a`, shoes `2a2624` | 19.7k / 10 |
| **Mme**, older neighbour | `f_regular`, 0.92, stoop 0.18 | f_head, f_eyes, f_brows, hair_buns, f_blouse, f_sleeves, f_hands, f_trousers, f_shoes | skin `f6e4d8`, hair `9a9590`, brows `5a5550`, blouse `5d4450` (plum), sleeves `6b5a60`, trousers `2c2a2e` | 20.7k / 9 |
| **Ch3 runners** | `m_athletic` / `f_athletic`, 0.95–1.05 | body, eyes, brows plus one of hair_buzzed / hair_parted / hair_beard (m) or hair_buns / hair_long / hair_buzzed_f (f) | Random kit from a muted palette (`d8d4c8 55606e 8a3a5a 3d6fb0 b88a3a 2f5f46`), shorts `1c1d20`. Mix in `sleeves/legs: 'long'` for cold dawn races. Shoes: dark or neutral (light shoes show the modelled toes) | 15.6–18k / 4–5 |
| **Spectators, passers-by** | `m_regular` / `f_regular`, 0.94–1.04 | Head, eyes, brows, a hairstyle, shirt/blouse + sleeves (+ f_hands), trousers or trousers2, shoes or boots. **Rain (ch2): m_hood / f_hood instead of hair** | Muted tints: coats `3c4248 45403a 4f4a3e 2e3440 5a4a3c`, trousers `2f3236 3a4250 45403a`. Skin from `f2dccf` to `8a5e44` | 20–27k / 9 |

Sami reads as a child mainly through scale (1.37 m) and the 1.2× head. The face is still the adult athletic face. At gameplay distance he reads as a kid next to Hugo, but up close he looks like a young teen. There is no teen body in the free tier. The Source pack's Teen body would be the real fix.

## Probe result (public/__probe, now deleted)

The probe used three r186, GLTFLoader and SkeletonUtils, RoomEnvironment plus a sun with shadows, ACES, and headless Chromium on the M-series GPU (`.cache/tools/chars-shot.mjs`). Screenshots are in `.cache/shots/chars/`: `final_lineup_idle.png`, `final_lineup_walk.png`, `final_heads.png`, `final_cast_walk.png`, `final_single.png`, `final_runners.png`, and `clips_1..5.png` (every clip).

- There were no load errors and no console errors (only favicon 404 and the r186 PCFSoft→PCF notice). Every recipe plays idle, walk and all 34 clips correctly. Feet stay on the ground with the pelvis offset, and skinning holds on every part (no exploded vertices from the re-skin or quantisation).
- Numbers: a single Hugo is 10 draws + 10 shadow draws and ≈20k tris per pass. The 12-recipe line-up is 183 draws and 477k tris including the shadow pass.
- **Honest look:** clean, well-built stylised characters (Fortnite / Overwatch-adjacent), with good normal-mapped cloth folds and soft hair. The animation quality is clearly better than the Xbot. **But:**
  1. The civilian clothes are **fantasy peasant/ranger** cut. You can see Chinese-style toggle fastenings and a diamond belt buckle on the male shirt, a corset on the female blouse, and calf-high laced boots. Grey-levelled and tinted in muted modern colours, they read as "workwear" at gameplay distance, not as a contemporary French street. Up close (dialogue cameras) the medieval detail shows.
  2. The bodies are **superhero-proportioned**. The runners look like sprinters or bodybuilders rather than lean marathoners and an ultra runner. Painted kit reads as tight lycra (fine for runners, not for civilians).
  3. The faces are young and stylised for everyone. Odile and Mme read as "white-haired woman" more than 70s. The stoop helps a little.
  4. The style is cleaner and more "game-y" than the grimy, semi-real world target. The game's grain, lens dirt and desaturated grade will pull it closer, but the faces will stay cartoon-adjacent next to Poly Haven props.

## Risks and next steps

- **Modern clothes:** the best upgrade is the paid Source tier of Universal Base Characters (Regular and Teen bodies, 20 hairstyles), or a CC0 modern outfit kit on this rig if Quaternius releases one. A cheaper path is to repaint the cloth atlas regions to hide the toggles, buckle and corset (texture work in the build).
- The `fall`, `slump` and `shamble` clips are approximations. Real nod, wave, clap and look-around clips are missing from the free tier.
- Crowds: about 20k tris and 9–10 draws per clothed character (×2 with shadows). Thirty spectators is about 600 draws. Merge parts per crowd archetype (one SkinnedMesh per recipe via BufferGeometryUtils + a texture atlas), or drop shadows on distant extras.
- Name clash: if the game ever loads `parts.glb` and the Xbot in one GLTF parse, GLTFLoader renames duplicate node names (`Head_1`). They are separate files today, so this does not happen.
- `npm install` is now required before `fetch-assets.sh` (for sharp and gltf-transform). The script fails with a clear message otherwise.
