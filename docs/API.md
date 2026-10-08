# HAIRLINE — Core API for chapter authors

Read this file, `docs/DESIGN.md` (story, beats, mood values) and your own two files. Nothing else should be needed.

- **Your files:** `src/story/chN.js` (the chapter module) and `src/world/scenes/sceneN.js` (its scene builder).
- **Your text file:** `src/story/text/chN.js` (becomes `L.chN`). `src/story/text/common.js` is core-owned.
- **Do not edit** core files (`src/core`, `src/render`, `src/player`, `src/world/*.js`, `src/story/Director.js`, `src/story/minigames.js`, `src/story/script.js`, `src/ui`, `src/main.js`).
- **Starting point:** `chN.js` is currently a small STUB written by the core agent (it runs, and shows how the new APIs are called). Replace it entirely. `sceneN.js` still holds the previous game's scene: adapt or rebuild it as DESIGN.md's "Scene reuse" table says (the original code is also backed up in `.cache/v1-981`, read-only).
- If you need something the core lacks, build it locally in your two files. For example, a custom shader material or a helper function.
- **Text:** all story text lives in `src/story/text/*.js`, assembled by `src/story/script.js` as `L` (`import { L } from './script.js'`).
  - Use `L.chN.*` (and shared `L.notebook.items.*`, `L.watch.*`, `L.hints.*`, `L.names.*`) and do not retype lines.
  - If a beat really needs a string that is missing (for example a tiny prompt label), define it as a local const at the top of your chapter file. Mark it with `// TEXT:` so it can be moved later.
- **Testing:** use `http://localhost:5173/?debug=1&autostart=1&skipcards=1&chapter=N`, where N is 0-based: Ch1 = 0 … Ch5 = 4.
  - The dev server hot-reloads.
  - `window.__game` exposes everything (see [Debug](#debug)).

---

## 1. Conventions

| Thing | Convention |
|---|---|
| Units | metres, seconds, radians. y is up. |
| Character facing | Characters face **+Z** at `rotation.y = 0`. `rotation.y = Math.PI` faces **−Z**. To face a point: `rotation.y = Math.atan2(dx, dz)`. |
| Streets | Outdoor scenes run along **−Z** (Ch2/Ch5 street: spawn z +8…+3, workshop door at z −48; Ch3 road: the runner goes toward −Z). See DESIGN.md's STREET CONTRACT. |
| Camera | Fixed world offset behind the player (`(0, 2.6, 4.2)` outdoors, `(0, 3.4, 3.6)` in the dollhouse rooms). It looks toward −Z. There is no orbit. "Forward" for the player is W, which is −Z. |
| Positions in APIs | `[x, z]` means on the ground. `[x, y, z]` is a full 3D point. A `THREE.Vector3` is also accepted wherever noted. |
| Colours | Hex numbers (`0x9fb7d6`) or CSS strings (`'#9fb7d6'`). They are sRGB and are converted automatically. |
| Time | `dt` passed to update hooks is **scaled** by `engine.timeScale` (slow-mo). `rawDt` is real time. The camera, Mood and UI use real time. |
| Albedo | The MoodShader desaturates heavily at low hope, the vignette darkens edges, and the grime pass adds grain and dirt. Keep surface colours **mid-value** (sRGB roughly `#707070`–`#b0b0b0` for walls and floors). Very dark albedos read as pure black. Let lights, `grimeTexture` and the mood create the dirt and darkness. For big surfaces prefer a look recipe (`surface: 'facade.brick'`, §4.10): its albedo is already normalised into this band, and brighter canvases enhanced with a recipe are pulled down to it. |
| Disposal | Everything you add to your scene `group` (or via `ctx.world.add`) is disposed when the chapter ends. Characters from `assets.makeCharacter` are released automatically too. Shared look / Materials materials (`userData.shared`) are kept. |

Imports (paths are relative to your file):

```js
import * as THREE from 'three';
import { L } from './script.js';                              // from src/story/chN.js
import * as B from '../build.js';                             // from src/world/scenes/sceneN.js
// or named imports: import { sign, ground, box, bicycle, grimeTexture, rain } from '../build.js';
import { rhythm, timing, makeSteer, memory } from './minigames.js'; // from src/story/chN.js
```

Addons: `import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';` The `.js` extension is required.

### Text and languages (i18n)

All player-facing text lives in `src/story/text/{common,ch1..ch5}.js` (English) and
`src/story/text/fr/*.js` (French, same shape), assembled into `L` (`script.js`). `src/story/i18n.js`
owns `getLang()`, `setLang(code)`, `onLangChange(fn, { chapter })` (returns unsubscribe), `LANGS` and
`retext(s)` (a string from L in any language -> the same key now).

- `setLang` rewrites `L` **in place**: `L` and every nested object/array keep their identity, so
  `const T = L.ch2` at module scope is fine. **Never cache a string** (or anything built from one) at
  module scope or in a constructor; read `L.ch2.howFarLap` when you use it. Chapter `title` /
  `objective` are getters for that reason.
- The UI re-renders what is on screen (objective, prompts, hotspot prompts, watch labels, notebook,
  menus, pause/Options); a dialogue line or card already up finishes in the old language.
- Canvas text in the world: `B.relabel(signMesh, () => text)` or
  `B.relangTexture(material, () => makeTexture(), ['map', 'emissiveMap'])` redraw it on a switch (chapter
  scoped; the Director drops them between chapters). Anything else is right after the chapter reloads.
- A key missing from a translation falls back to English (debug: warning `[i18n] missing fr key: path`).
- In-world signage that is already French (RÉPARATIONS, BOULANGERIE, street names) stays as it is in
  every language (`AS_IS` in `scripts/i18n-lib.mjs`).
- Numbers: `ui.watch()` and the end card show decimals through `num(s)` (`'212.4 km'` -> `'212,4 km'` in
  French), so code keeps `toFixed()`; parse a face from text with `parseNum(s)` (either mark).
- Key names: text writes keys as tokens, in every language: `{KeyA}`…`{KeyZ}` (a physical
  `KeyboardEvent.code`, labelled with the player's layout: `{KeyW}{KeyA}{KeyS}{KeyD}` shows WASD on QWERTY,
  ZQSD on AZERTY) and `{Space}` `{Shift}` `{Escape}` `{Enter}` `{Arrows}` (named from `L.keyNames`).
  `L` holds them resolved (`src/core/KeyLabels.js`: real keydowns > `navigator.keyboard.getLayoutMap()` >
  US QWERTY); when the layout is learned, `L` is re-resolved and `onLangChange` listeners fire. Code never
  writes a key letter: use `L.ch3.keys.both`, `L.hints.*`, or `label('KeyE')` / `keyText(s)` from KeyLabels.
  The checker requires the same tokens in English and translations and flags literal key names.

**Adding a language:** `node scripts/i18n-skeleton.mjs <code>` writes `src/story/text/<code>/*.js` with
every text leaf marked `⟦EN⟧ `; translate those (keep keys, array lengths, `who`/`inner`/`voicemail`/
`correct`, `*stage*` markers, `{n}`, `[{KeyE}]` chips and `{KeyA}` key tokens), add `{ code, label }` to `LANGS` in
`i18n.js` and the imports to `TEXTS` in `script.js`. Then `node scripts/i18n-check.mjs <code>` reports
missing/extra keys, shape and flag mismatches, lost markers/placeholders/numbers, untranslated text,
and text over the UI `LIMITS` (max characters per tight spot, measured at 1280x800); exit 1 on errors.

---

## 2. The chapter module contract

`src/story/chN.js` default-exports a plain object:

```js
export default {
  id: 'flat',                   // string, for logs
  title: L.ch1.title,           // shown as "CHAPTER N / title" over the opening fade (hidden with ?skipcards=1)
  hope: 0.04,                   // initial hope, snapped at chapter start
  preset: 'flat',               // Mood preset name (see §6) or a preset object
  objective: L.ch1.objectives.start, // initial objective text (or null)
  music: { name: 'contemplation', volume: 0.35, fade: 3 }, // optional; undefined = keep current, null = fade out
  ambience: ['rain'],           // optional: which of 'rain' | 'crowd' should be on (others fade off)
  sounds: ['crowd'],            // optional: other audio files run() turns on itself (preloaded with the chapter)
  camera: { offset: [0, 3.4, 3.6], look: [0, 1.1, 0], fov: 55, lerp: 6 }, // optional follow-cam settings
  player: {                     // passed to player.configure() (see §5). bounds default to build().bounds
    spawn: [0, 1.5], facing: Math.PI, boot: true, limp: 1, painRate: 1 / 0.7, canJog: true, footsteps: 'boot',
  },
  build: (ctx) => buildScene1(ctx), // may be async; returns { group, bounds, spots, update?, dispose?, ...extras }
  async run(ctx, d) { /* the chapter's beats, top to bottom; return when the chapter is over */ },
};
```

### What the Director does for each chapter, in order

1. `state = 'transition'`, then it fades to black. If the screen is already covered (for example a "cut to white"), the current fade colour is kept.
2. It resets the previous chapter:
   - chapter timers, hotspots, runners, the world group and characters
   - transient UI, player listeners
   - `engine.timeScale = 1`, `input.enabled = true`, `audio.restore()`
   - flash back to 0, every focus slot released (`mood.clearFocus()`), `mood.painOverride = null`, camera roll 0, fov 55
3. It shows the chapter title (unless `?skipcards=1`).
4. It runs `await build(ctx)`. If build throws, a fallback ground is used, so the game never soft-locks.
5. It loads the world (`world.load(result)`: the group goes into the scene).
6. It runs `player.configure({...chapter.player, bounds: chapter.player.bounds ?? result.bounds})`.
7. It points the camera at the player (`cam.follow`), applies the fov and snaps the camera.
8. It runs `mood.applyPreset(preset)` and `mood.set(hope, {snap:true})`, then applies music and ambience.
9. It sets the objective text and **seeds the HUD**: `ui.watch(...)` from `L.watch.atChapter[i]` and `ui.notebook.set(...)` from `L.notebook.atChapter[i]` (null hides them). The notebook persists within a run: if it already holds at least as many entries as the seed (the player played through), it is kept.
10. It fades in, sets `state = 'play'` and runs `await run(ctx, d)`.
    - If `run` throws, the error is logged and the game continues with the next chapter.
11. After the last chapter, it fades and shows the ending cards and end card (`ui.endCard()`), with piano music.

So `run()` starts with the player standing at `spawn` in a lit, faded-in scene.

**Return from `run()` to end the chapter.** Leave the screen however you like (for example faded to white). The next chapter's fade keeps that colour.

### What build(ctx) returns

`src/world/scenes/sceneN.js` exports one builder: `export async function buildSceneN(ctx) { ... }`.

```js
return {
  group,                 // THREE.Group with everything in the scene (required)
  bounds: [{ minX, maxX, minZ, maxZ }, ...], // walkable rectangles (union). [] = unbounded
  spots: { tv: [x, z], door: [x, z], ... },  // named positions your chapter uses
  update(dt, rawDt) {},  // optional per-frame hook while this chapter is loaded (e.g. TV flicker)
  dispose() {},          // optional; called on unload before the group is disposed (e.g. remove a bloom pass)
  // ...any extras: tvOff(), lights, rivals, etc. Reachable from run() as ctx.world.current.<name>
};
```

- The player moves only inside the **union** of `bounds` rects. Movement is per-axis, so the player slides along edges.
- Carve furniture out by composing several rects around it.
- Props are not colliders.

---

## 3. The `ctx` object

`run(ctx, d)` and `build(ctx)` receive the same object:

| Field | Type | What it is for |
|---|---|---|
| `ctx.engine` | `Engine` | Loop, timeScale, timers, renderer, composer (§4.1) |
| `ctx.scene` | `THREE.Scene` | The scene. Prefer adding to your `group`. |
| `ctx.camera` | `THREE.PerspectiveCamera` | Driven by `ctx.cam`. Do not move it directly. |
| `ctx.renderer` | `THREE.WebGLRenderer` | |
| `ctx.input` | `Input` | Keyboard (§4.2) |
| `ctx.assets` | `Assets` | Characters and GLB props (§4.3) |
| `ctx.audio` | `AudioSys` | Music, ambience, one-shots (§4.4) |
| `ctx.mood` | `Mood` | Hope, colour grade, lights, sky, fog (§6) |
| `ctx.sky` | `Sky` | Gradient sky (Mood drives it) |
| `ctx.materials` | `Materials` | PBR material library (§4.10) |
| `ctx.look` | `look` | Art bible: named surface recipes (§4.10) |
| `ctx.env` | `Environment` | HDRI loader / cache (Mood uses it; §4.10) |
| `ctx.ui` | `UI` | All HTML overlay UI (§4.5) |
| `ctx.player` | `Player` | Hugo (§5) |
| `ctx.cam` | `FollowCam` | Camera follow and cinematics (§4.6) |
| `ctx.hotspots` | `Hotspots` | Proximity + E interactions and trigger zones (§4.7) |
| `ctx.runner` | `Runner` | NPC sprints and walks (§4.8) |
| `ctx.world` | `World` | Current chapter's build result (§4.9) |
| `ctx.director` | `Director` | Same as `d` in `run(ctx, d)` (§7) |
| `ctx.build` | module | `src/world/build.js` helpers (§8) |
| `ctx.minigames` | module | `src/story/minigames.js` (§7.1) |
| `ctx.L` | object | All story text (`src/story/script.js`) |
| `ctx.flags` | `{debug, chapter, autostart, skipcards}` | Query flags |

---

## 4. Systems

### 4.1 Engine (`ctx.engine`)

Rendering (`src/render/Post.js`, owned by `engine.post`). One frame:

1. **Scene** → a half-float target with a `DepthTexture`, 4× MSAA on medium/high (none on low). Canvas MSAA is off. The pixel ratio is capped per tier (1 / 1.25 / 1.5; 1.25 on touch devices).
2. **GTAO** (medium/high): reads only that depth (normals are rebuilt from depth, so the scene is **not** drawn twice), half res on medium and full res on high, Poisson-denoised.
3. **Bloom** (medium/high): a soft-thresholded 5-level down/up chain at half res. Only pixels brighter than the preset's `bloomThreshold` (linear HDR, about 1.3–3.5) feed it, so **practicals bloom and walls and skin don't**. To make a practical glow, push it above the threshold: `MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3) })` or `emissiveIntensity` 3–5.
4. **Grade** (`MoodShader`): AO multiply (faded in fog and on bright pixels), height fog, bloom add, then the whole Mood grade (hope saturation, focus slots, lift/gamma/gain, split tone, contrast, shoulder, vignette, dirt, pain, flash, grain), edge chromatic aberration on high.
5. **OutputPass**: ACES tone mapping and sRGB, to the canvas.

**Shaders must not produce NaN** (e.g. `pow()` of a negative): with MSAA, varyings can be evaluated slightly outside a triangle, and a NaN survives the resolve. The grade and the bloom sanitise their input (NaN → 0, clamped to 64), so a bad pixel shows as black, not as a black smear, but fix it at the source.

| Member | Signature / type | Notes |
|---|---|---|
| `timeScale` | `number` (default 1) | Scales `dt` for player, runners and animation mixers. Ch3 uses `0.6` for 1.2 s at KM 31. Reset to 1 between chapters. |
| `paused` | `boolean` | Esc / tab hidden. While paused nothing updates and no timers run. |
| `now` | `number` | Real seconds since boot, frozen while paused. |
| `time` | `number` | Scaled seconds. |
| `dt`, `rawDt` | `number` | Last frame's scaled and real dt (clamped to 1/20 s). |
| `wait(sec, {scaled=false})` | `→ Promise<void>` | Loop-driven timer that pauses with the game. **In chapters use `d.wait()`** (skippable). |
| `after(sec, fn, {scaled=false})` | `→ cancel()` | **In chapters use `d.after()`**, which is auto-cancelled at chapter end. |
| `frame()` | `→ Promise<dt>` | Resolves on the next unpaused frame with the scaled dt. |
| `renderer`, `scene`, `camera` | three objects | |
| `post` | `Post` | `post.params` (written by Mood every frame), `post.stats = {scene, post}` (draw calls: the scene pass including shadow maps / the full-screen passes), `post.view = 'ao' \| 'bloom' \| null` and `post.override = {ao: 0, bloom: 0, ...}` for debugging. |
| `moodPass` | `{ uniforms }` | The grade's uniforms. Mood owns them. |
| `quality`, `setQuality(name, {remember})` | `'low' \| 'medium' \| 'high'` | The quality tier (see below). `engine.on('quality', fn(tier))` notifies a change. |
| `precompile(timeout=3)` | `→ Promise` | Compiles every material in the scene (hidden beats included) for the post chain's scene target, in parallel where `KHR_parallel_shader_compile` exists. The Director awaits it before each fade-in. |

**Quality tiers** (`src/render/Quality.js`): `?quality=low|medium|high` forces one; otherwise the pause-menu choice (remembered in `localStorage`), otherwise a guess from the GPU string and the screen size (Apple M-series, RTX, Radeon RX → high; Intel, Mali, Adreno, software → low; very large screens step down once). The pause menu switches it live. `__game.quality` = `{ get(), set(name), tiers, gpu, source }`.

| Tier | Pixel ratio | MSAA | GTAO | Bloom | Sun shadow map (PCF radius) | CA | Anisotropy |
|---|---|---|---|---|---|---|---|
| `low` | 1 | off | off | off | 1024 (2) | off | 4 |
| `medium` | ≤ 1.25 | 4× | half res, 8 samples | on | 2048 (3) | off | 8 |
| `high` | ≤ 1.5 | 4× | full res, 16 samples | on | 2048 (4) | on | 16 |

Measured at 1280 × 800 on an M5 Max (headless, uncapped, Ch5 street with 13 figures): high 5.4 ms (≈ 184 fps), low 4.5 ms (≈ 222 fps); the post chain draws 13 full-screen passes on medium/high (2 on low, as before).

The sun's shadow box follows the player and is **fitted to the chapter's bounds** after each build (`mood.fitShadows(bounds)`: half the largest extent + 4 m, clamped to 6–22 m), so the rooms get about three times the street's shadow resolution. Shadows are PCF with a Vogel-disk kernel; `sun.shadow.radius` comes from the tier.

### 4.2 Input (`ctx.input`)

Keys are `KeyboardEvent.code` strings: `'KeyW'`, `'KeyE'`, `'Space'`, `'ShiftLeft'`, `'Digit1'`, `'ArrowUp'`, and so on.

| Member | Signature | Notes |
|---|---|---|
| `down` | `Set<code>` | Keys currently held (raw). |
| `pressed` | `Set<code>` | Keys pressed since the previous frame. A press is visible for exactly one frame, including in code that runs right after `await d.frame()`. Key repeat is ignored. |
| `enabled` | `boolean` | `false` silences `axes()`, `isDown()`, `wasPressed()` and `shift` (gameplay). Raw `down`/`pressed` and the UI still work. Reset to `true` between chapters. |
| `axes()` | `→ {x, z}` | W/↑ z=−1, S/↓ z=+1, A/← x=−1, D/→ x=+1. |
| `isDown(code)` / `wasPressed(code)` | `→ boolean` | Respect `enabled`. |
| `shift` | getter `boolean` | Either Shift held (respects `enabled`). |
| `consume(code)` | | Remove a press so later systems this frame ignore it. |
| `lastPress(code)` | `→ number \| undefined` | `performance.now()` timestamp of the latest keydown. |
| `pressCount(code)` | `→ number` | Keydowns of `code` since the previous frame (raw). A hitch can merge several presses into one frame; `pressed` only says "at least one" (the colour toy counts every drop). |
| `press(code)` | | Synthetic one-frame press (tests). |
| `hold(code, ms=500)` | `→ Promise` | Synthetic hold (tests and debug). |
| `onKey(fn)` | `fn(code, event) → off()` | Raw keydown listener. It fires even while paused. Call the returned `off()` at chapter end. |

**Key ownership:**

- E is consumed by the UI while a dialogue or card is open, and by Hotspots when a spot is in range.
- Space is never used by dialogue. Use `input.pressed.has('Space')` for timing prompts.
- Esc and M are handled globally (pause, mute).

### 4.3 Assets (`ctx.assets`)

#### `makeCharacter(opts) → Character`

Characters are the Quaternius "Universal" set (CC0; `public/assets/characters/`, built by `scripts/assets/characters.sh`, documented in `docs/assets/characters.md`). The code is in `src/characters/`: `cast.js` (presets, clip and bone aliases), `CharacterKit.js` (loading, part merging, the tint and kit shader) and `Character.js`.

This never throws. If the character files fail to load, it returns a capsule stand-in with the same API (`isFallback: true`, `play()` is a no-op, `bone()` returns null).

| opt | default | |
|---|---|---|
| `preset` | `'passerby'` | Cast recipe: `'hugo' 'odile' 'sami' 'bastien' 'ines' 'marco' 'mme' 'runner' 'spectator' 'passerby'`. |
| `variant` | — | Preset tokens: `'m'` / `'f'` (body), `'long'` (long sleeves and tights on runners), `'rain'` (a hood instead of hair). Hugo: `'civilian'` (default), `'runner'`, `'runner_dawn'`. Every runner recipe (Hugo's kits, `'runner'`, `'bastien'`) narrows the athletic body to 0.86 in x/z (`slim`), so the run club and the race field share one build. |
| `tint` | preset | Main garment colour (shirt/blouse and sleeves; the kit top on runners). The DESIGN tints still apply: Odile `#9a7a4e`, Sami `#c24a3a`, the club's hi-vis. |
| `scale` | preset | Overrides the preset's size (adult rigs are 1.81 m male, 1.77 m female at 1; Odile 0.95, Sami 0.74, Mme 0.92). |
| `name` | `'character'` | |
| `seed` | `name` | Picks the look of random extras (runner, spectator, passerby), so a named extra looks the same every run. |
| `castShadow` | `true` | Only skin and clothes cast; hair and eyes never do. |

- **Cost:** parts that share a material are merged, so a clothed adult is 4–5 draw calls (plus 3 shadow draws), a runner 3 (+1). The eyes are skipped beyond 7 m.
- **Culling:** every part is frustum-culled against one whole-body sphere (centre 0.9 m, radius 1.5 m, in the character's space). Poses applied through `model.position/rotation` move it with the mesh.
- **Old options:** `joints`, `roughness` and `metalness` are gone. A call without `preset` gets a random passer-by.

You must add `char.root` to your group (`group.add(char.root)` or `ctx.world.add(char.root)`).

The character's mixer is updated automatically, with scaled dt. It is released at chapter end.

#### Character

| Member | Signature | Notes |
|---|---|---|
| `root` | `THREE.Group` | Position and rotate this. The feet are at its origin. |
| `model` | `THREE.Group` | Inner group at the feet, scaled to the character's size. Use it for local offsets and leans (`model.rotation.x` pitches about the feet). |
| `rig` | `THREE.Object3D` | The skinned model inside `model`. The kit keeps its pelvis-height offset and per-clip compensation here; don't move it. |
| `play(name, fade=0.25, {timeScale, once=false})` | `→ AnimationAction \| null` | Cross-fades. Clips: see below. Calling with the current clip is a no-op that returns the action. |
| `actions` | `{[name]: AnimationAction}` | For example `char.actions.run.timeScale = 1.3`. Keyed by library name (`actions.sit_idle`, not `actions.sad`). |
| `current` | `string` | Current clip name, as passed to `play()`. |
| `fade(to, secs=1)` | `→ Promise` | Opacity fade. 0 also hides the root (Bastien running off). |
| `setOpacity(a)` | | Immediate. |
| `setTint(color)` | | Recolour the main garment (the kit top on a runner). |
| `setPartColor(part, color)` | | Recolour one part: `'m_trousers2'`, `'f_blouse'`, `'hair_buns'`, … (names in `docs/assets/characters.md`). |
| `setOutfit(name)` | | Characters with several outfits (Hugo: `'civilian' \| 'runner' \| 'runner_dawn'`). Player calls it from `configure({outfit})`. |
| `hideLeftFoot(on)` | | Discards the left shoe below the knee (the walking boot goes over it). Player does this in `setBoot`. |
| `stoop` | `number` (rad) | Added to the upper spine and neck after the clips each frame, with the head tipped back up so the gaze stays level (Odile 0.2, Mme 0.18). Writable. |
| `strideRate(clip, v)` | `→ number` | The `timeScale` at which a locomotion clip (`'walk'`, `'run'`, ...) covers `v` m/s of ground for this character (its scale and slim included), so the planted foot stays put. Use it for every walk or run you drive yourself. |
| `bone(name)` | `→ THREE.Bone \| null` | Universal names (`'pelvis'`, `'spine_03'`, `'Head'`, `'upperarm_r'`, `'calf_l'`, …) or the old Mixamo short names, which map to them: `Hips → pelvis`, `Spine/Spine1/Spine2 → spine_01/02/03`, `Neck → neck_01`, `LeftArm → upperarm_l`, `LeftForeArm → lowerarm_l`, `LeftHand → hand_l`, `LeftUpLeg → thigh_l`, `LeftLeg → calf_l`, `LeftFoot → foot_l`, `LeftToeBase → ball_l` (and `Right…`). Bones have +Y along the bone. |
| `isFallback` | `boolean` | |
| `dispose()` | | Usually not needed (automatic). |

**Clips** (34, from Universal Animation Library 1 and 2; full list with uses in `docs/assets/characters.md`):

- **Loops:** `idle`, `walk`, `walk_formal`, `run` (= `jog`), `sprint`, `crouch_walk`, `crouch_idle`, `talk`, `phone`, `call_out` (cheering, shouting), `agree`, `headShake`, `arms_crossed`, `lean` (on a rail or counter), `slump`, `shamble`, `paint` (an arm out at shoulder height), `hold_can`, `push`, `carry`, `hammer`, `kneel_work`, `sit_idle`, `sit_talk`.
- **One-shots** (pass `{once: true}`): `sit_down`, `stand_up`, `reach`, `pick_up`, `open_box`, `pour`, `drink`, `kneel_reach`, `fall` (knocked backwards), `get_up`.
- **Speeds:** use `char.strideRate(clip, v)` (= `v / (CLIP_SPEED[clip] × model.scale.z)`). `walk` covers 1.3 m/s at timeScale 1 for a scale-1 adult. `run` is the library jog with its stride shortened at load (`CLIP_STRIDE` in `cast.js`): 4.66 m/s at timeScale 1 and a 150 spm cadence, so 3–6 m/s jogs keep both the feet planted and a runner's cadence. Runner, Ch2/Ch3/Ch5 and the Player all use it (measured planted-foot slip under 0.05 m/s).
- **Old Xbot names still work:** `'sad'` is `sit_idle` with +0.42 m added under the model, so the old "`sad` + `model.position.y = −0.42`" seat still lands on a 0.45 m seat. `'sneak'` is `crouch_idle` (a static crouch). `'ride'` sits on a bicycle saddle, for a model raised +0.43 m (Sami, Ch5). `'nod'` is `agree`.
- **Seated clips** (`sit_idle`, `sit_talk`) are shifted forward so the pelvis is over `root`: put the root on the seat point. The seat should be about 0.45 m high.
- **Missing from the free libraries:** wave, clap, look-around, sitting on the ground, a real limp, riding. Use procedural bone aims (Ch5's `aimBone`) or the Player's procedural limp.

#### `prop(path, opts) → Promise<THREE.Group>`

This loads a GLB prop, normalised to a real-world size. **It never rejects.** A missing or broken file gives a grey box of the prop's native proportions (`NATIVE_SIZE` in Assets.js; `group.userData.isFallback = true`).

- `path`: relative to `public/assets/`, for example `'props/crt_tv.glb'` or `'kenney/retro/pallet-small.glb'`. A leading `/assets/` also works.
- `opts`:

| opt | default | |
|---|---|---|
| `height` | — | Target height in metres. Real heights: sofa 0.85, TV 0.5, building 8–14, street light 4.5, bench 0.8. |
| `width` | — | Used only when `height` is omitted (scales by x size). |
| `tint` | — | Multiplies every material colour (clones the materials). |
| `color` | — | Replaces every material colour (clones the materials). |
| `center` | `true` | The footprint is centred on x/z and the bottom sits on y = 0, so `position` is the footprint centre on the floor. `false` keeps the native origin. |
| `castShadow`, `receiveShadow` | `true` | |

The returned group has `userData.size` (a `Vector3`, in metres).

- **Rotation:** set `rotation.y` on the returned group. Kenney furniture and retro pieces face **+Z** natively; check scans visually.
- Results are cached, so repeated calls clone a cached model and are cheap.

#### Other Assets methods

- **`preload(paths[])`:** warm the cache (fire and forget). main.js already preloads each chapter's measured list (`CHAPTER_LOOKS[i].props`) with the build, and downloads the next chapter's list in the background once a chapter plays.
- **`releaseProps(keep[])`:** free the GPU copies (geometry, textures) of cached prop scenes whose path is not in `keep`. main.js calls it with the chapter's list before each build, and with `[]` at the end card; a prop needed again simply re-uploads on first draw.
- **`halfRes`:** set by main.js on the low tier: prop textures are halved before their first upload.
- **`texture(path, {repeat:[u,v], srgb=true}) → THREE.Texture`:** cached loader.

**Available props.** Only what some scene uses is shipped (`npm run setup:assets`; see `docs/CREDITS.md`). To add one, add it to the fetch script first.

| Path | Props |
|---|---|
| `props/<id>.glb` (Poly Haven scans, CC0; `docs/assets/props.md`, sizes in `.cache/dl/props/props.json` after a fetch) | `crt_tv sofa_worn iron_bed cardboard_box trash_bag wrist_watch steel_shelves fluoro_light bench_vice spanner drill hammer handsaw pliers screwdriver tape_measure paint_can oil_can toolbox stool stepladder bulb track_pump radio bin_metal barrel crate_wood milk_crate cafe_set chair_painted road_barrier` |
| `kenney/city/` | `low-detail-building-a … -d` (the fogged skyline) |
| `kenney/roads/` | `construction-cone light-square` |
| `kenney/retro/` | `detail-bench detail-bricks-type-a detail-dumpster-closed pallet-small` |
| `kenney/survival/` | `bottle-large` |

### 4.4 Audio (`ctx.audio`)

Every method is safe before the user gesture: nothing plays until the title click or the first real click with `?autostart`.

| Method | Notes |
|---|---|
| `music(name \| null, {volume=0.45, fade=2.5, loop=true})` | Cross-fades beds. Names: `'contemplation'` and `'piano'` (Ch5 and the ending). `null` fades out. Calling with the current name only changes the volume. Usually set through the chapter's `music` field instead. |
| `ambience(name, on=true, {volume, fade=2, lowpass})` | `'rain'` or `'crowd'` (low-passed at 900 Hz by default; pass `lowpass` in Hz, e.g. Ch3 race `{lowpass: 1400}`). Usually set through the chapter's `ambience` field. Safe to call repeatedly while the file is still loading. |
| `buffer(name) → Promise<AudioBuffer \| null>` | The decoded music / ambience file, for a graph of your own on `audio.ctx` into `audio.bus` (Ch5's radio plays `'contemplation'` through its own filters: `crafts/radio.js`). |
| `footstep(surface='concrete', {volume=0.35, rate})` | One sample. Player footsteps are already automatic (including `'boot'`). |
| `preload(names)` | Fetch music/ambience files early (default: all). main.js preloads the start chapter's sounds at boot and each chapter's with its build (the next chapter's sfx are only fetched then, see `prefetch`), from the chapter's `music`, `ambience` and `sounds` fields; anything else loads on first use. |
| `heartbeat({volume})` | Two 55 Hz thumps (stumbles call it). |
| `snap({volume=0.9})` | Small dry bandpassed click. Ch3 KM 31 now plays the recorded `crack_pencil_lead` (fx 0.5, lowpass 3 kHz, `src/story/ch3sound.js`); `snap({volume: 0.3})` is its fallback. Plays after `cut()`. |
| `thud({volume=0.45})` | Low body thud. Plays after `cut()`. |
| `tone({freq=440, to, dur=0.3, type='sine', volume=0.3, bus='fx', attack=0.01, delay=0})` | Pitch-ramped oscillator (exponential ramp `freq → to` over `dur`). Use it for the Ch3 whine. `bus:'fx'` plays through `cut()`; `bus:'bus'` is silenced by it. |
| `noise({type='bandpass', freq=1000, q=1, dur=0.2, volume=0.3, tail=0.05, bus='fx', delay=0, attack=0, brown=false})` | Filtered noise burst (`type` is any BiquadFilter type). The Ch2 scaffold creak: `noise({type:'bandpass', freq:240, q:6, dur:0.4})`. |
| `hammer({volume=0.5})` | One blow through the floor (low thump + knock, on the bus). Ch1: three, 0.9 s apart, every ~9 s. |
| `scrape({volume=0.22, freq})` | One sanding / brush stroke (short band-passed hiss, randomised pitch). |
| `tick({volume=0.25})` | Tiny dry click: the rim rubbing the pad, a camera shutter. |
| `ping({volume=0.18, freq=1320})` | Spoke key on a tight spoke. |
| `rip({volume=0.3})` | Velcro strap (~0.35 s). |
| `buzz({volume=0.18})` | Two 180 Hz square pulses, low-passed (`ui.watchBuzz` calls it). |
| `gun({volume})` | Legacy starting-gun crack (unused). |
| `drone(hope)` | Called every frame by Mood. Do not call it. It goes through the beds gain (ducked under voices) at 0.02. |
| `cut()` | Silences music, ambience, drone and steps within 50 ms (Ch3 at KM 31). `fx` one-shots still play. |
| `restore(fade=0.8)` | Undoes `cut()`. The Director calls it at every chapter start. |
| `stopAll({fade=1.5, music=true})` | Fades all ambience (and music). |
| `toggleMute()`, `setMuted(b)`, `muted` | M is wired globally. |
| `prefetch(names)` | Fetch, without decoding, the compressed files of sets / beds (main.js: the next chapter's `sounds`, decoded by its own build). |

The master feeds a safety limiter (`audio.limiter`: −3 dBFS, ratio 20, 3 ms attack) before the speakers; it is transparent below −3 dBFS. Pause suspends the context, also on the debug autostart path before the first click.

#### Runtime API: recorded SFX (`src/core/Sfx.js`)

The files are in `public/assets/sfx/` and the manifest is `sfx.json`. `docs/assets/sfx.md` (Integration list) gives every cue's set name, bus, volume and filter. A **set name** is a manifest key such as `'hammer_floor'`, and its files are the variants.

| Method | Notes |
|---|---|
| `sfx(name, opts) → {dur, ended, stop(fade)} \| null` | One-shot. Picks a random variant, never the last one played (`hammer_floor_06` has half weight). opts: `volume=0.5`, `rate=1`, `jitter=0.04` (± rate), `gainJitter=0` (± dB), `bus='fx'\|'bus'\|'beds'` (`'beds'`: the bus through the beds gain, ducked under voices), `lowpass`, `highpass`, `q=0.7`, `band='tv'\|'radio'` (speaker band: hp 250/300 → lp 4500/3400 → light shaper), `pan` (−1..1), `pos` (point source, see below), `ref=1.5`, `rolloff=1`, `delay=0`, `offset=0`, `alt` (a second set, 50/50, e.g. `alt: 'mug_clink_alt'`), `fallback` (fn(audio, opts), or `false`). If the file is missing or not decoded yet, it plays the procedural cue the file replaces (a table in `Sfx.js`; for a cue not in the table, pass `fallback`) and returns `null`. While the game is paused or before the first click, nothing plays and nothing is queued. |
| `loopSfx(name, opts) → handle` | A loop that gameplay drives. opts are the same as `sfx()`, plus `fade=0.5` (fade-in), `offset` (default: a random point in the file) and `bus` (default `'bus'`). `handle.set(volume, rate, secs=0.1)` is cheap and can be called every frame; it only acts on a change. Also `handle.setPos(pos)`, `handle.lowpass(hz, secs)`, `handle.stop(fade=0.3)` (idempotent) and `handle.playing`. You can call it before the buffer has loaded: it starts when the buffer is ready, and if `stop()` came first it never starts. `cut()` stops loops on `'bus'` and `'beds'`. Put room tones, hums, a TV or a radio bed on `'beds'` so they duck under voices. Loops on `'fx'` keep playing through `cut()`. |
| `ambience(name, on, opts)` | Also plays the recorded single-file beds, which are registered in `FILES`: `amb_*`, `fluoro_hum`, `neon_buzz`, `tv_race_bed`, `radio_static`, `radio_tune_sweep`, `radio_talk_fishing`, `brush_wall_loop`, `sand_loop`. Beds go through the voice runtime's `duck()`. **The Director only starts `'rain'` and `'crowd'` from `chapter.ambience`**, so start any other bed in `run()`. Listing it in `ambience` or `sounds` only preloads it. |
| **Positional** `pos` | `[x,y,z]`, a `Vector3`, an `Object3D` (it follows the object), or `() => pos`. Gain uses the inverse model `ref / (ref + rolloff·(d − ref))`, measured from Hugo's head (`player.root` + 1.5 m). Pan is taken from the camera's right vector (width 0.7). main.js updates it every frame through `audio.updateListener(camera, player.root)`. |
| `surface` | Set `audio.surface = 'wood'` for an indoor chapter (Ch1 flat, Ch4 workshop). The Player's steps then become `step_wood`, and the boot step becomes `boot_step_wood` + `body_thud` (lowpass 900 Hz). The thud the Player plays next to the boot step is absorbed. `audio.surface = 'street'` (Ch2 wet street, Ch5) changes only the boot step outdoors, to `boot_step_wet` (0.35) + `body_thud` (0.12, lowpass 900 Hz); the good foot keeps the Kenney concrete step. `releaseChapter()` resets it. |
| `releaseChapter(keep, {prefetch})` | main.js calls this in each chapter's build wrapper, before `preload()`, and the Director before the end card (`['piano']`). It stops every `loopSfx` handle and every recorded bed that is not in `keep`, resets `surface`, drops the decoded sfx buffers that are not in `keep` (this chapter's `music`, `ambience` and `sounds`) and the prefetched bytes not in `prefetch` (the next chapter's, fetched but decoded only at its build). Do not call it from a chapter. |
| `preload(names)` | Also takes set names: list a chapter's sets in its `sounds` field (Ch1: `SOUNDS` in `ch1.js`), and every variant loads with the chapter. |

**Pattern** (a gated hum at a point, then a one-shot through a band):

```js
const hum = audio.loopSfx('fluoro_hum', { volume: 0.1, bus: 'beds', pos: [2.79, 1.9, 1.75] });
world.onUpdate(() => hum.set(tube.on ? 0.1 : 0, null, 0.03));
audio.sfx('tv_crt_off', { volume: 0.45, pos: tvScreen });
const radio = audio.loopSfx('radio_static', { volume: 0.3, band: 'radio', bus: 'fx' });
radio.set(0.5 * dialSpeed, 1, 0.08); // ... radio.stop(0.2)
```

**Ch4 / Ch5 helpers (`src/story/crafts/sound.js`).**

- `speaking(ctx)`: true while a voice clip plays (never in English, or with voices off).
- `duckUnderVoice(ctx, handle, {db=6})`: dips a long one-shot (a kettle, the run club passing) while a clip plays. Driven loops do the same in their own `set()` (×0.6 while `speaking`).
- `wheelSound(ctx, rig)`: `freewheel_tick`, whose gain and rate follow a `bikeRig`'s measured rear-wheel speed (hand turns, a spin on the stand, a walk beside the rider), plus `freewheel_coastdown` when a free spin is let go. Returns `{dispose()}`.
- `stirSlice(audio)`: a 0.4 s slice of `paint_stir_loop` with 60 ms fades.
- `scrapeAt(audio, rate, {name, volume:[base, perK], pitch:[base, perK]})` (`crafts/juice.js`) plays a recorded stroke whose gain and rate follow the stroke rate: `sand_stroke` by default, `shutter_runner_scrape` in Ch5.
- The Ch5 radio set (`radioVoice`) goes out through the beds bus, so the voice duck covers it. Its static is the recorded `radio_static`, and `radio_tune_sweep` follows the dial speed. `hush(secs)` quiets its formant talk while a station's voice clip plays.
- Ch4 leaves `audio.surface` unset, because the workshop floor is garage concrete (`scene4/shell.js`), not boards.

**Debug (`?debug=1`, `src/core/AudioDebug.js`).** Every audio feature shares one implementation.

- `__game.debug.audioLog`: every sound that starts, as `{t (AudioContext s), at (performance.now ms), kind, name, file, bus, gain, rate, pos, ...}`.
  - `kind` is one of: `sfx`, `loop`, `loopStop`, `amb`, `music`, `proc` (a procedural cue), `fallback`, `skipped` (paused / locked), `release`, `duck`, `voice`.
  - The list keeps the last 5000 or so entries.
- `__game.debug.meter()`: `{state, muted, paused, t, bus, fx, master, ...}`, where each tap is `{rms, peak}` in dBFS over the last 85 ms (taps: `bus`, `fx`, `master`, `out` after the limiter, and `voice`, `beds` from the voice runtime). The level is −120 when suspended.
- `__game.debug.meter(secs)`: the RMS rows sampled every 50 ms over the last `secs`, as `{t, at, bus, fx, master}`.
- `master` is measured after the mute gain, so muting reads −120 there. `bus` and `fx` are measured before it.
- Other runtimes add their own entries:
  - `audio.logEvent(kind, name, info)` adds an entry to the log.
  - `audio.addMeter(name, node)` adds a meter tap (the voice runtime: `addMeter('voice', voiceGain)`).

#### Runtime API: French voices (`ctx.voice`, `src/core/Voice.js`)

French voice-over for the displayed lines (docs/voice.md §8). Chapters rarely call it: the UI plays dialogue lines, menu replies, voiced card lines, thoughts and barks itself. It is active only in French with the Voices option on (`localStorage['hairline.voice']`, default on); otherwise every call is a no-op and nothing is fetched.

| Member | Notes |
|---|---|
| `active` / `enabled` / `supported` | Clips play / the saved option / the language is French. |
| `setEnabled(on)` | The Options row calls it. Turning it off stops the clip. |
| `play(text, who, {kind='dialogue'\|'thought'}) → clip \| null` | `clip`: `{dur, busy, state, remaining(), ended, stop(fade)}`. A dialogue stops whatever is playing; a thought is skipped over a dialogue clip. Never two clips at once. |
| `cur` | The clip loading or playing (`cur?.state === 'playing'`: something is being said; see `speaking(ctx)` in `crafts/sound.js`). |
| `stop(kind?, fade=0.04)`, `stopAll()` | Ch3 cuts a thought at the crack with `stop('thought', 0.08)`. |
| `hold(on)` | UI: the beds stay ducked while a dialogue box is open. |
| `chapter(i)` | Director: stops speech, releases the last chapter's clips and prefetches chapter `i`'s (`-1` at the end card). |

UI side (§4.5): `ui.thought(text, secs, {who, replace})` returns the clip; `replace: true` cuts the same speaker's line being said instead of waiting behind it (the Ch5 radio). `ui.thoughtSpeaking()` is true while a voiced thought is being said or waits to be: wait on it (capped) before a beat that would cut it (Ch3 STRIDE menus, the KM 31 crack).

To keep a one-shot or loop clear of the voice, dip it while `ctx.voice?.cur?.busy` (Ch1 hammer: −12 dB) or put a bed-like loop on bus `'beds'`, which `duck()` covers.

Debug: `__game.debug.voice`, `voiceLog` (`request`/`start`/`end`/`stop`/`miss`/`skip`/`prefetch`), `voiceMeter()` (the shared meters plus `duck`, `speaking`, `clip`) and `autoAdvance(on)` (tests only: a dialogue line moves on once its clip has been said + 250 ms).

### 4.5 UI (`ctx.ui`)

Blocking methods return Promises. In chapters, call the **Director wrappers** (`d.say`, `d.card`, `d.choose`, `d.correct`) so `skip()` works. Text supports `*emphasis*` (rendered italic).

**Speaker colours.** A speaker's CSS class is the first word of `who`, lowercased (`'Dr Okafor'` → `dr`, `"Dr Okafor's office"` → `dr`, `'Bastien (Run Club)'` → `bastien`, `'Mme Benali'` → `mme`). Coloured: `hugo odile sami bastien stride dr ines marco mme tv phone mum`; anything else is grey.

| Method | Returns | Notes |
|---|---|---|
| `dialogue(lines)` | `Promise` | Use **`d.say(lines)`**. `lines`: `[{who, text, inner?, voicemail?}]`. `inner: true` renders italic with no speaker (Hugo's thoughts). `voicemail: true` adds a VOICEMAIL tag. `{who: null, text: '*stage direction*'}` for stage lines. Types at 40 chars/s. E or click completes the line, then advances. Draws **above** the fade. |
| `card(lines, opts)` | `Promise` | Use **`d.card()`**. Full-screen lines, one at a time. opts: `{skippable=true, lineDelay=1.6, hold=2.4, bg='#000' \| 'clear', color, big=false, mono=false, italic=false}`. `bg:'clear'` overlays the scene (Ch3 crack card). `big` suits "Day 5." / "Sunday.". It auto-closes immediately with `?skipcards=1`. |
| `choices(menu)` | `Promise<index>` | Use **`d.choose` / `d.correct`**. `{prompt, options:[{text}]}`. Keys 1–3 or click. |
| `fade(to, dur=1, color?)` | `Promise` | `to` runs from 0 (clear) to 1 (covered). `color` is any CSS colour. If omitted, the current colour is kept while the screen is covered (otherwise black). `await ui.fade(1, 0.25, '#fff')` cuts to white. Dialogue, `thought` and a watch with `over:true` draw **above** the fade. |
| `objective(text \| null)` | | Top-left objective line. |
| `prompt(text \| null)` | | Bottom-centre prompt, e.g. `'[E] Strap'` or `'[A / D] Alternate. Steady.'`. A leading `[X]` renders as a key chip. It takes priority over hotspot prompts. Clear it yourself. |
| `hint(text, secs=5)` | | Top-centre transient tip, for example `L.hints.jog`. |
| `thought(text, secs=3.5, {who}={})` | | **Non-blocking** line in the lower third. Without `who`: Hugo's italic inner line (stumbles, the hammer thought). With `who`: a spoken **bark** with a coloured speaker label (`ui.thought("Stiller.", 2.4, {who: 'Odile'})`). Bark data in the text files is `{who, bag:[...]}`. A new call replaces the current line. Never shown on top of a dialogue: opening a dialogue hides the current thought, and a thought called while a dialogue is open waits and shows when it closes (only the latest one is kept). French voices: it stays up for at least the clip + 0.4 s, and a thought arriving while a voiced one is said waits for it (newest 2; `{replace: true}` cuts the same speaker instead). Returns the voice clip or `null`. |
| `caption(text \| null, {secs=0})` | | Broadcast lower-third caption (Ch3 `TRAINING BLOCK — WEEK 9 …`). `secs=0` keeps it until `caption(null)`. |
| `banner(text \| null, {secs=1.6, label, xl=false, mono=false})` | | Big centred text for a moment. `label` is the small caps line above. |
| `pain(v, visible)` | | The player drives this. Do not call it. |
| `watch(face \| null, {label, lap, tick=true, over})` | | The **GPS watch**, docked bottom-right (see below). |
| `watchCount(from, to, secs=1.5, {label, lap, over, unit='km', decimals=1, ease=true})` | `Promise` (+ `.finish()`) | Counts the face up (Ch3: 170.2 → 212.4 over 1.5 s), with tiny ticks. Gate it: `const c = ui.watchCount(...); await d.gate(c, () => { c.finish(); return true; });` |
| `watchBuzz(text, secs=2.4, {title='STRIDE'})` | | Non-blocking notification beside the watch, with a shake and `audio.buzz()`. Pops the watch up for the duration if it is hidden. |
| `watchFocus(on, {flare})` | | Swells the watch to the centre of the screen (×2.3); `flare` is a CSS colour glow on the screen and the lap line (Ch2 "How far?": `{flare: L.ch2.flare}`). `watchFocus(false)` docks it. |
| `notebook.*` | | The **"WHAT I CAN DO" notebook** (see below). |
| `gauge(label \| null, {value, band:[lo,hi], max=1, min=0, color, text, warn})` | | Horizontal meter with a needle and a target band, just above the prompt (bottom-centre). Call it every frame with new values. `color` = band colour (CSS), `text` = readout under it (`'168 spm'`), `warn: true` turns the needle red (Ch3 ragged finish). The needle glows green while inside the band. `null` hides it. |
| `driveRing({duration=2.4, window=0.18, guard=0.4, cue='[Space]', shout=null, missText=null})` | `Promise<{hit, error, cancelled?}>` | Shrinking timing ring at screen 50%/46% on real time. Press Space when it meets the target; **the perfect moment is `0.75 × duration`**. Presses in the first `guard` share are ignored. `shout` (if set) shows as a banner on a hit; `missText` (if set) as a thought on a miss. Gate it: `d.gate(ui.driveRing(o), () => { ui.cancelDrive(); return true; })`, or use `minigames.timing()` (§7.1). |
| `cancelDrive()` | | Resolves an active ring as a miss (`cancelled: true`). |
| `letterbox(on)` | | Cinematic bars. |
| `chapterTitle(num, name, secs)` | | The Director uses it. |
| `modal` | getter `boolean` | True while a dialogue, choices or card is open. |
| `endCard(E = L.ending)` | `Promise` | The Director calls it after Ch5. Do not call it. Runs `card(E.lines)`, each of `E.bigs` (`212.4 km`), the `E.hairline` 1 px ochre line drawing to 60% width, then `E.thanks`, Play again and `E.credits`. |
| `clearTransient()` | | The Director calls it between chapters: objective, prompt, caption, banner, **watchFocus(false), watch(null), notebook.hide(), gauge(null)**, pain, letterbox, drive, hint, thought. |

The previous game's `stopwatch`, `reaction` and `splits` are **removed**.

#### The GPS watch

```js
ui.watch('0.0 km', { label: 'THIS WEEK', lap: 'LAST WEEK 212.4' });   // shows it (slides up)
ui.watch(`${km.toFixed(2)} km`, { tick: false });                     // per-frame live update (label/lap unchanged)
ui.watch('42.2 km', { label: 'RACE', lap: '3:04:51', over: true });   // readable over a black fade
ui.watchBuzz(L.ch1.buzz);                                             // "TIME TO MOVE! ..." + shake + buzz
ui.watch(null);                                                       // taken off: slides away
```

- `face`: any text; a trailing ` km` / ` m` / ` spm` is drawn small. `tick` pulses the face when the text changes (use `tick:false` for live counters).
- `label`, `lap`, `over`: **omitted = unchanged**; `label: null` / `lap: null` remove the line. `over` stays set until `over:false` or `watch(null)`.
- The Director seeds it at every chapter start from `L.watch.atChapter[i]` (Ch1: hidden; Ch2: `0.32 km` / `WALK` / `38:40`; Ch3: `THIS WEEK`; Ch4–5: `RUN · THIS WEEK`).
- A running `watchCount` stops if you call `watch()` yourself.

#### The notebook ("WHAT I CAN DO")

Lined school paper in pencil grey, handwritten font, docked small at the top-right. It **opens full size** (moves toward the centre) for a few seconds on every change, then docks again. Entries: `[{text, struck?, note?, hand?: 'hugo' | 'sami'}]`. Always use `L.notebook.items.*` for texts.

| Method | Returns | Notes |
|---|---|---|
| `notebook.set(entries \| null)` | | Replace the list (no animation) and show it docked. `set([])` shows an empty page with the heading (Ch4 Day 5). `null` clears and hides. |
| `notebook.add(text, {hand='hugo'})` | `Promise` (~0.9 s) | Writes a new line with a pencil write-on animation and the recorded `pencil_write` (Sami at rate 0.85; the procedural scratch is the fallback); opens for 3.2 s. `hand: 'sami'` = bigger, slanted, blue biro ("Teech."). |
| `notebook.strike(text, on=true)` | `Promise` (~0.7 s) | Draws a light pencil line through an entry; `on=false` erases it (Ch5 finale): a short `pencil_write` stroke / `pencil_erase`. Opening full size plays `notebook_open` + `page_flip`, docking `notebook_close` (fx; the sets are in Ch4 / Ch5 `sounds`). |
| `notebook.annotate(text, note)` | `Promise` | Writes a small note after an entry (`annotate(items.run, L.notebook.someSundays)`). |
| `notebook.open(secs=3)` | | Open full size for `secs`, then dock. `open(0)` stays open until `dock()`. |
| `notebook.dock()` / `notebook.hide()` | | Dock top-right / hide (entries kept). |
| `notebook.entries` / `.visible` / `.isOpen` | getters | A copy of the entries; state flags. |

The promises resolve on their own (UI time); wrap them in `d.gate(...)` when you await them so `skip()` stays snappy. The notebook **persists within a run** (see §2 step 9).

### 4.6 FollowCam (`ctx.cam`)

Uses real time, so it is unaffected by `timeScale`.

| Method | Notes |
|---|---|
| `follow(target, {offset:[x,y,z], look:[x,y,z], lerp=6, snap=false})` | Follow an `Object3D`. `offset` is a world offset from the target. `look` is the look-at point relative to the target. Passing `target = null` keeps the current target (useful to return after a tween: `cam.follow(null)`). Smoothing is `1-exp(-lerp*dt)`. |
| `tween({pos, look, fov, roll}, dur=1.5, {ease}) → Promise` | Cinematic move in **world** coordinates. Any subset of fields; `roll` in radians. The default easing is easeInOutCubic; pass `ease: k => k` for linear. The camera then stays **fixed** until `follow()` is called. |
| `set({pos, look, fov, roll})` | Hard cut to a fixed shot. |
| `snap()` | Jump to the follow position now. |
| `fov(deg)` | Set the field of view (per frame is fine, for example the sprint FOV 55→75). |
| `setRoll(rad)` | |
| `dip(amount=0.35)` | Quick drop (the player's stumble uses it). |
| `shake(amp=0.15, dur=0.4)` | |
| `mode` | `'follow' \| 'fixed'` |
| `pos`, `lookAt` | `Vector3`: current camera position and look target (read them to start tweens from the current shot). |

#### Camera rig: mouse look, occlusion, wayfinding

`src/player/CameraRig.js` (created in `main.js`, `__game.rig`) adds a user orbit on top of the follow mode:

- **Orbit.** The `offset` / `look` passed to `follow()` set the default yaw, pitch (the camera's elevation above the look point) and distance. The user adds `cam.orbit.yaw` (relative to the default), sets `cam.orbit.pitch` and `cam.orbit.zoom`. With no mouse input the camera is exactly where it was before. `cam.offset` / `cam.look` are the live, orbit-rotated vectors, so `tween({pos: p + cam.offset})` returns to the player's current view.
- **Input.** Clicking the canvas takes pointer lock. Without it, hold the left or right button and drag. The wheel zooms (0.7–1.4× the default distance). R or a middle click re-centres. The pitch is clamped to 10–55°, widened to include the chapter's own default.
- **Free roam only.** Look input is ignored, and the pointer lock released, unless `director.state === 'play'`, the player is neither `frozen` nor `scripted`, no dialogue, card, choice menu, gauge or drive ring is open, the game is not paused or faded out, and the camera is in follow mode (`rig.freeRoam()`). If the browser drops the lock while walking (Esc), the game pauses at once, so a single Esc frees the mouse and pauses.
- **Scripted cameras.** `tween()` / `set()` override the user look. When `follow()` is called again with the same offsets (or none) and no `snap`, the user's yaw is kept (an eased return after a cinematic). Different offsets, a new chapter, `follow({ snap: true })` or `cam.snap()` (a hard cut) re-centre behind the target.
- **Movement.** `cam.moveYaw` is the camera's ground yaw (0 = looking down -Z). `Player` rotates its WASD vector by it, so W walks away from the camera. A diagonal step that wedges Hugo where two walkable rects meet a few cm apart backs the blocked axis off by 6 cm and takes the other axis's step. Minigames that read `input.down` / `input.pressed` directly are unaffected.
- **Occlusion.** Each frame the rig casts from the target's look height to the camera against the current world's static occluders and pulls the camera in front of the first hit, with a 0.22 m margin (fast in, eased out). The camera has a body: besides the centre line, a fan of 12 rays to rings of 0.25 m and 0.125 m around the camera catches edges and posts that only graze the line (fan hits within 0.9 m of the target are left to the next step), and short probes left, right, forward-left, forward-right and up push the camera 0.35 m clear of walls beside and above it (they also count drawn see-through meshes such as alpha-cut bracing). Big static meshes are raycast through cached, chunked world-space triangles. The camera never goes below the target + 0.3 m. Excluded: characters (`userData.character`), skinned meshes, transparent, additive, `colorWrite: false` or `depthWrite: false` materials (the invisible fourth walls), decals (`polygonOffset`), points, lines, meshes under 0.3 m and meshes that stay below 0.3 m high, hidden objects, and anything with `userData.noOcclude = true`. The list is rebuilt when the world changes and every 2.5 s.
- **Per-chapter limits.** `CHAPTER_LOOK` in `CameraRig.js`, keyed by chapter id: `{ yaw: [min, max] (deg, relative), pitch: [min, max] (deg), zoom: [min, max], box: { minX, maxX, minZ, maxZ } (world m, any subset) }`. The cut-away rooms (`flat`, `workshop`) clamp the yaw to ±18–20° and the pitch to 18–40°, and `box` keeps the camera inside their side walls even where it hangs out past the cut (`cam.limits.box`).
- **Objective pointer.** `src/ui/ObjectivePointer.js` (`__game.pointer`) shows a small chevron and the distance to the nearest active, enabled `required` hotspot when it is off-screen or more than 8 m away. In free roam only. Both sit on small dark chips and scale with the viewport height. The pointer draws above the HUD (z-index 13) and keeps clear of the docked watch and notebook: it slides beside a panel it would land on (pointing at the target when the target itself is behind the panel), and moves the label off it. Chapters whose goal is a place rather than a spot can add a fallback to `WAYPOINTS` (keyed by chapter id; Ch2 points at Odile's scaffold).
- **Debug.** `__game.debug.look(yawDeg, pitchDeg, zoom)` sets the view without a mouse (clamped). `__game.debug.view()` returns the look, the limits and the occlusion state. `__game.debug.pointer()` returns the pointer's state.

### 4.7 Hotspots (`ctx.hotspots`)

- **`add(opts) → spot`** takes:
  - `id`
  - `pos:[x,z] | [x,y,z] | Vector3`
  - `radius=1.6`
  - `prompt='Interact'`
  - `required=false` (brighter ring plus a light beam)
  - `enabled: () => bool` (default always)
  - `once=true`
  - `auto=false`
  - `marker` (default `!auto`)
  - `ringColor=0xc9b48a` (the floor ring's tint) and `ringOpacity=1` (multiplies its pulse and proximity opacity). Ch1 passes a darker `ringColor` so the chalk ring doesn't glare on the dark boards.
  - `onInteract: async (spot) => {}`
- **Prompts:** the nearest enabled spot in range shows `[E] prompt`. E fires `onInteract` only when `director.state === 'play'` and no dialogue or card is open. The spot is busy until `onInteract` resolves.
- **`once`:** the spot is removed after firing. `once:false` spots can fire again.
- **`auto: true`:** a **zone**. It fires `onInteract` as soon as the player enters `radius` (in `play`), with no prompt or marker by default. Use it for proximity beats (Ch5 reaching Odile). For the Ch2 street beats, prefer z-thresholds in one `d.until` chain.
- **Other methods:**
  - `waitFor(id) → Promise`: resolves after the spot has fired and its `onInteract` finished. **In chapters use `d.interact(id)`**, which is skippable.
  - `trigger(id) → Promise`: fire it programmatically.
  - `setActive(id, bool)`
  - `get(id)`
  - `remove(id)`
  - `clear()`, which the Director calls between chapters. It also releases pending `waitFor`s.
- **Inside `onInteract`, use `d.say()`** so the player freezes and state goes to `'dialogue'`.

### 4.8 Runner (`ctx.runner`)

NPC movement on scaled time. Handles are **thenables** (`await` them).

| Method | Returns | Notes |
|---|---|---|
| `run(char, {laneX, T, startZ=0, distance=100, tau=1.2, runOut=12, splitEvery=0, onSplit})` | `RunHandle` | Sprints down a lane toward −Z on `v(t)=vmax(1-e^{-t/τ})`, solved so `distance` takes exactly `T` s. The run clip timeScale is `clamp(v/5, .6, 1.6)`. It resolves **at the line** with the finish time, then decelerates through `runOut` m and idles. `onSplit(metres, t)` fires every `splitEvery` m. |
| `RunHandle` | | Fields: `d` (metres), `v`, `t`, `finished`, `finishTime`. Methods: `retime(newT)` and `stop()`. (A sprint model from the previous game; the run club and race runners are moved by hand per DESIGN.md.) |
| `walkTo(char, [x,z] \| Vector3, {speed=1.4, face, run=false})` | `WalkHandle` | Walks (or runs) to a point, turning smoothly, then idles. `face` sets the final `rotation.y`. `.stop()`. |
| `clear()` | | Called between chapters. |

The player can be driven by the Runner too: set `ctx.player.scripted = true` first.

### 4.9 World (`ctx.world`)

| Member | Notes |
|---|---|
| `current` | Your build result object. Use it for extras: `ctx.world.current.tvOff()`. |
| `group`, `bounds`, `spots` | Shortcuts into `current`. |
| `add(...objs)` | Add to the chapter group (disposed at chapter end). |
| `onUpdate(fn) → off()` | Per-frame hook `fn(dt, rawDt)` for this chapter only. |

### 4.10 Materials, look and environment (`ctx.materials`, `ctx.look`, `ctx.env`)

The large surfaces use real PBR materials (23 CC0 Poly Haven sets, `docs/assets/materials.md`), lit by an HDRI per chapter. Three layers, from most to least opinionated:

1. **`ctx.look`** (`src/world/look.js`): the art bible. **Use this first**, so Ch2 and Ch5 (the same street) are built from the same recipes.
2. **`ctx.materials`** (`src/core/Materials.js`): the material library under it, for anything the recipes don't cover.
3. **`build.ground/box/mat({surface})`** (§8): the shared builders take a recipe name directly.

Everything is failure-tolerant: with the files missing, every material keeps a flat fallback colour, and the game still plays.

#### Surface recipes: `look.surface(name, opts) → MeshStandardMaterial`

```js
const road = B.ground({ size: [12, 64], pos: [0, -16], surface: 'street.asphalt' });     // via build
const wall = new THREE.Mesh(geo, ctx.look.surface('facade.brick'));                    // direct
const dry = ctx.look.surface('street.pavement', { wet: 0, grime: 0.4 });                // overrides
```

| Name | Material | Use |
|---|---|---|
| `street.asphalt`, `street.cobbles`, `street.pavement`, `street.kerb` | asphalt_02, cobbles in tar, concrete slabs, grimy concrete (×0.6) | Ch2/Ch3/Ch5 road, gutters, sidewalks, kerb faces |
| `facade.brick`, `facade.brickPainted`, `facade.brickPlaster`, `facade.render` | dark red brick, flaking painted brick, brick with fallen render, stained render | Street facades |
| `shutter.rust`, `metal.green`, `metal.rust`, `metal.corrugated` | roller shutter, green painted steel, white paint eaten by rust, corrugated sheet | Shutters, downpipes, lamp posts, awnings |
| `concrete.grimy`, `mural.wall` | cast concrete; light primed render | Ch3 retaining wall; the 20 × 8 m blind wall |
| `interior.floorboards`, `interior.plaster`, `interior.tile`, `interior.fabric` | | Ch1 flat |
| `workshop.concrete`, `workshop.brick`, `workshop.timber`, `workshop.paintedWood`, `workshop.plywood`, `workshop.steel` | | Ch4 workshop, Ch5 garage |

- Recipes default to **world mapping** (`mapping: 'world'`): a box projection from the world normal, so the texture scale is right on any box, wall or merged mesh without UV work. Pass `{ mapping: 'uv', worldSize: [w, h] }` for meshes whose UVs span the surface once.
- Every recipe is normalised to a target mean albedo (`level`), so a black asphalt and a pale render sit in the value band the grade was tuned for. Pull the hue with `tint`.
- **Weather comes from the chapter** (`CHAPTER_LOOKS` in look.js): Ch2 wet 1 and grime 1; Ch3 wet 0.7; Ch5 wet 0.25 ("puddles drying"); interiors dry. Override per call with `{ wet, grime }`.
- `look.surface()` materials are **cached and shared** (`userData.shared`, never disposed by the chapter). **Don't mutate them**; ask for another variant with different opts instead, or use `look.enhance(myMaterial, name)` on a material you own.
- `look.enhance(material, name, opts)` layers a recipe's normal, AO, roughness variation and (normalised) colour over a material you own, keeping its `map` (e.g. a `grimeTexture` canvas with posters and tags) and its mean value. opts: `{ albedo=1 (0..1 how much of the detail colour), normalScale, ao, scale, roughnessVar, grime, wet, groundY, level }`.
  - **Watch the value:** `enhance` normalises the detail to the recipe's `level` (target mean albedo), which can pull a pale material you own down to the recipe's brightness. For example, `interior.fabric` is a dark wool (level 0.1), so cream canvas drop cloths go near-black unless you pass your own `level` (Ch5 does). The same holds for `materials.enhance(material, id, opts)`.
- `look.recipe(name)`, `look.chapter` (the active chapter look), `SURFACES`, `CHAPTER_LOOKS` and `LIGHTING` are exported for reference.

#### `ctx.materials` (Materials)

| Method | Notes |
|---|---|
| `get(id, opts) → MeshStandardMaterial` | Cached by `id` + opts (shared; don't mutate). `id` is a `materials.json` id (`'facade_brick_dark'`...). opts: `mapping='uv' \| 'world'`, `worldSize` ([w, h] or m; 'uv': repeat = size / real tile size), `repeat` ([u, v]), `scale` ('world' tile multiplier), `tint`, `level` (target mean albedo, linear), `roughness`, `metalness` (multipliers on the ARM channels), `normalScale`, `aoIntensity`, `grime` (0..1), `wet` (0..1), `groundY` (world y of the ground under a wall), `puddleTile` (6 m), `color` (fallback while loading), plus any MeshStandardMaterial parameter (`side`, `transparent`...). |
| `enhance(material, id, opts)` | See `look.enhance` (patches in place, returns it). |
| `weather(material, {grime, wet, desat, groundY})` | World-space weathering only, on any MeshStandardMaterial you own. |
| `setWeather(material, {grime, wet})` | Change it live (uniforms; e.g. Ch5's puddles drying over the walk). |
| `restyleKenney(object, {roughness=0.82, metalness=0.05, grime=0.55, desat=0.18, darken=0.9, wet=0})` | Makes Kenney GLBs stop looking like plastic next to PBR: rougher, darker, a little desaturated, with world-space grime. Shared Kenney materials get one cached restyled clone each. Skips skinned meshes and `userData.noRestyle`. **Already applied after every build** to `assets.prop('kenney/...')` props in the chapter group (set `userData.noRestyle = true` on a prop to keep it glossy); props you add later in `run()` need a call. |
| `has(id)`, `tile(id)` | Manifest lookups (tile = real size in metres). |
| `preload(ids, {timeout=8000, upload=true})` | Loads and uploads the textures. main.js preloads each chapter's sets (`look.materialIds(i)`: the first-pass recipes plus the measured `CHAPTER_LOOKS[i].materials`) behind the fade, and the first chapter's on the loading screen. With `upload: false` it only downloads: main.js prefetches the next chapter's sets that way once a chapter plays. |
| `retain(ids)` | Frees the GPU copies of every loaded set not in `ids` (images and cached materials stay; a set needed again re-uploads). main.js calls it with the chapter's own ids before each build, and with `[]` at the end card. A chapter that uses a set it doesn't list still works, it just uploads on first draw. |
| `image(id, map='color') → Promise<image \| null>` | A set's decoded image, for canvas work (Ch4's door takes the plywood grain). |
| `halfRes` (constructor option) | main.js sets it on the low tier: every set map is halved on load (a quarter of the memory). |

**Weathering layers** (`grime`, `wet`), all driven by world position, so they line up across meshes:

- `grime`: macro albedo breakup against tiling (13 m), a splash-back dirt band at the foot of walls (`groundY` + 0–1.1 m), rain and rust leaks under every storey line (every 3.2 m), vertical smudges, and blotches on floors. It also adds a little roughness.
- `wet`: darker albedo and much lower roughness on floors, a wet splash band at the foot of walls, and puddles (`grime/puddles.png` at 6 m per tile: near-mirror, flattened normal). The puddles reflect the chapter HDRI and every light, so wet chapters need a high `bloomThreshold` (see §6).

#### Environment light (`ctx.env`)

HDRIs (`public/assets/hdri/<id>.hdr`: `night_street`, `dawn_fog`, `golden_street`, `interior_dim`, `workshop`) are chosen by the Mood preset (`env`, §6). Mood sets `scene.environment`, `environmentIntensity` and `environmentRotation`. They load lazily: main.js preloads the chapter's HDRIs (`CHAPTER_LOOKS[i].hdris`) with the build and the next chapter's in the background, and frees the rest. Each HDRI's peak is capped at 24 when it loads, so a sodium lamp or the sun can't put white-hot dots into every puddle. `env.load(id)` → `Promise<texture | null>`, `env.get(id)`.

**What the first pass did** (main.js, around every chapter build; the chapter files are untouched): the active chapter look is set, so untagged big surfaces from `ground()`, `box()` and `mat({map: grimeTexture})` get its ground / facade / slab / wall recipe (see §8); Kenney props are restyled; soft light cones are added under street lamps and spot lights (Ch2, Ch3, Ch4; `r.lightCones` lists them); and the sun's shadow box is fitted to the bounds. Tag a surface with `surface: '<name>'` to choose, or `surface: false` to opt out.

---

## 5. Player (`ctx.player`)

Hugo is a persistent character (`preset: 'hugo'`: slate shirt `HUGO_TINT = 0x4a5260`, dark work trousers, beard). The Director calls `configure()` with your chapter's `player` field.

### `configure(opts)`

**Not sticky:** every call applies the defaults for anything it omits (Ch3's green kit and bare leg never carry into Ch4). It also resets pain, flags and pose, so mid-scene changes (Ch5 bench) should write fields directly instead.

| opt | default | Notes |
|---|---|---|
| `spawn` | — | `[x, z]` or `[x, y, z]`. |
| `facing` | `Math.PI` | Facing −Z, away from the camera. |
| `boot` | `false` | The **walking boot** on the left shin (see `setBoot`). Ch1, Ch2, Ch4 and Ch5 pass `boot: true`. |
| `tint` | `HUGO_TINT` | Main garment colour (the kit top in the runner outfit). Ch3: `tint: '#c6f432'` (STRIDE green). |
| `outfit` | `'civilian'` | `'runner'` (Ch3: the athletic body in painted race kit, short sleeves and shorts) or `'runner_dawn'` (long sleeves and tights). |
| `limp` | `1` | 0..1. It slows the walk (1.3 m/s × lerp(1, .85, limp)), unevens step timing (the stance on the bad left leg is cut short) and adds one dip per cycle, deepest in mid-stance on that leg. Per DESIGN: Ch1 1.0, Ch2 0.95, Ch4 0.85→0.75, Ch5 0.7, then 0.3 out of the boot. Writable mid-chapter. |
| `painRate` | `1/0.6` | Pain per second while jogging (`1/secondsToMax`). |
| `painCap` | `0` | 0 = none. `0.9` means pain never reaches 1, so no stumbles (Ch5 final walk). |
| `canJog` | `true` | Shift jogs at 2.6 m/s while allowed. |
| `showPain` | `true` | Shows the pain bar (Ch5 final walk: `false`). |
| `bounds` | build bounds | `[{minX,maxX,minZ,maxZ}]` |
| `footsteps` | `'concrete'` | `'concrete' \| 'grass' \| 'boot' \| null`. `'boot'`: the bad (left) leg plays the concrete sample at rate 0.72, volume 0.5, plus `audio.thud({volume: 0.15})`. Writable mid-chapter. |
| `walkSpeed`, `jogSpeed` | `1.3`, `2.6` | |

### Flags

Set these directly:

- **`frozen`:** no movement, idles. `d.say` sets it automatically. `configure()` clears it. `minigames.rhythm` sets it while it runs (A/D won't walk him).
- **`inputAllowed()`:** global gate set by `main.js`; WASD/Shift are ignored while `director.state` is `'boot'`, `'transition'` or `'end'`.
- **`scripted`:** Player does nothing (no input, no animation changes, pain bar hidden). Your code or the Runner drives `player.root` and `player.char.play()`. Poses still blend. Use it for the Ch3 run, the Ch5 line and the crane-up.
- **`locked`:** seconds of locked input after a stumble.
- **`poseOffset`:** `{y, pitch}` added to the model on top of the current pose every frame (the Ch3 hitch at KM 31, limp pitches). Reset to zero by `configure()`.
- **`firstStumbleDone`:** public. While false, the next stumble says `L.stumble.first` ("Twelve weeks. This is day four."). **Ch4 and Ch5 set `player.firstStumbleDone = true` at the start of `run()`** so they draw from the bag.
- **`limp`, `footsteps`, `painRate`, `painCap`, `canJog`, `showPain`:** plain fields, writable any time.

### State (read-only)

`pain` (0..1), `moving`, `jogging`, `hasJogged`, `stumbles`, `speed`, `position` (= `root.position`), `boot` (boolean).

### Methods

| Method | Notes |
|---|---|
| `setBoot(on)` | Show / hide the walking boot **without** a pose reset (Ch5 bench: `setBoot(false); player.limp = 0.3; player.footsteps = 'concrete';`). The boot (one mesh: rounded shell `#3a3d42`, three Velcro straps, a rocker sole) is parented to the left shin bone `calf_l`, built in metres (it divides by the bone's world scale), and follows every animation and pose. The work boot under it is hidden below the knee (`char.hideLeftFoot`). The capsule fallback gets a box at its left base. |
| `teleport(x, z, facing?, y=0)` | |
| `face(x, z)` | Turn to face a point. |
| `setPose(name, dur=0.6) → Promise` | `'stand' \| 'crouch' \| 'sit' \| 'fall' \| 'lie'`. Non-`stand` poses block movement. `'sit'` plays `sit_idle` with the pelvis over the root (benches: teleport to the seat point; seat about 0.45 m). `'crouch'` plays `crouch_idle` (measuring the frame). `'fall'`/`'lie'` pitch the idle pose forward 90°. The capsule fallback keeps the old y offsets. |
| `crouch(dur)`, `stand(dur)`, `fallForward(dur=1.2)` | Shortcuts. |
| `stumble()` | Forces a stumble: locked 1.1 s, camera dip, heartbeat, next line, pain → 0.6. |
| `on(event, fn) → off()` | Events: `'stumble'(line)`, `'firstJog'` (first jog in the whole game), `'jog'` (each time jogging starts), `'step'(badLeg)`. All listeners are cleared between chapters. |

- **Ch1 hint:** `d.after(10, () => !ctx.player.hasJogged && ctx.ui.hint(L.hints.jog))`.
- **Per-chapter "first jog"** (Ch5): `hasJogged` is game-global, so track it yourself: `let jogged = false; ctx.player.on('jog', () => { if (!jogged) { jogged = true; ctx.ui.thought(L.ch5.walk.firstJog); } })`.

---

## 6. Mood (`ctx.mood`): colour is hope

hope runs from 0 (grey) through 1 (full colour); values above 1 are oversaturated (Ch3 = 1.15). The shader `uSat = hope`. The tint lerps COOL → GOLD with hope, unless the preset has `neutralTint`. On top of the grade, the **grime pass** adds animated film grain (multiplicative, stronger in shadows), static lens dirt / smudges with a slight brown cast, and a coloured vignette. Grain is `preset.grain × (1.2 − 0.5·clamp(hope, 0, 1))`, so it eases as hope rises but never disappears.

| Member | Notes |
|---|---|
| `hope`, `target` | Current (damped) value and target. |
| `set(h, {snap=false, lambda=1.5})` | Set the target. A higher `lambda` moves faster. Prefer `d.hope(h, secs)`. |
| `add(d)` | `target += d`. |
| `pulse(d=0.1, flash=0.25)` | Hope bump plus a warm flash (the Ch4 laugh: `mood.pulse(0.08)`). |
| `drain(to, secs)` | Reaches ~99% in `secs` (Ch3 KM 31: `mood.drain(0, 3)`). |
| `flash(amount=1, decay=2)` | White screen flash, decaying at `decay` per second (Ch5 photo: `mood.flash(0.5)`). |
| `focusOn(obj, {strength=1, decay=0.25, offsetY=1.3, floor=0, slot=0, radius=0.28})` | Radial colour focus that tracks `obj` on screen. **Four independent slots (0–3)**; the shader takes the max, so colour **accumulates** on the things he made (door slot 0, bike slot 1, sign slot 2). Strength decays at `decay`/s down to `floor` and stays there. `radius` is in screen heights. `focusOn(null, {slot})` releases a slot. All slots are released between chapters. |
| `clearFocus()` | Release every slot. |
| `painOverride` | `number \| null`. When a number (0..1), it drives the red pain vignette instead of `player.pain²` (Ch3: 0 / 0.2 / 0.4 / 0.5). Reset to `null` between chapters. |
| `applyPreset(nameOrObj, {blend=0, ...overrides})` | Switch lights, sky, fog and grime, optionally cross-fading over `blend` s. Overrides patch fields: `applyPreset('street', {fogDensity: 0.03})`. Spread a preset to customise it: `{...PRESETS.flat, sunIntensity: 1.9}` (`import { PRESETS } from '../render/Mood.js'`). |
| `tweak(fields, secs=2)` | Blend some fields of the current preset: `mood.tweak({grain: 0.12}, 1)` (Ch3 crack), `mood.tweak({fogDensity: 0.03}, 0)`. Every numeric and colour field blends, including `grain`, `dirt` and `vignetteColor`. |
| `preset` / `presetName` | Resolved current preset / its name. |
| `hemi`, `sun`, `fill`, `fog` | The global lights and fog. Their values are rewritten every frame from the preset, so change them through presets / `tweak`. |
| `followTarget` | `Object3D` the sun's shadow box centres on (default: the player). Reset each chapter. |

**Built-in presets** (`PRESETS` in `src/render/Mood.js`):

| Preset | Use |
|---|---|
| `flat` | Ch1: green-grey nicotine ambient `#5d665a`, no fog, grain 0.07, dirt 0.4, vignette sinks to `#0d0f0a`, lightChroma 0.55. Add the TV `PointLight #9fb7d6` (key) and the flickering fluorescent `#cfe6d0` yourself. |
| `street` | Ch2: wet street, fog `#5f6560` 0.045, grain 0.065, dirt 0.45, lightChroma 0.85 (sodium amber `#d9a35a` and the pink neon `#ff3d6e` survive the grey). Add the lamps yourself. |
| `dawnrun` | Ch3: cold dawn, sky `#1b2a44` → `#4f6f8f`, fog 0.02, low cold sun `#cfe3ff` ahead (−Z), contrast 1.12, grain 0.04, `neutralTint`. Darken per block with `tweak`. |
| `workshop` | Ch4: hemi `#7a7468` / `#2e2620`, grey daylight from the left, lightChroma 0.5 (the tungsten bulb `#ffb36b` keeps warmth), grain 0.06, dirt 0.35, vignette `#1c140c`. Add the bulb and tube yourself. |
| `wall` | Ch5 day: overcast `#8a949c` / `#b9bfc2` warming with hope to `#7fa6c9` / `#e8cf9e`, fog 0.02 → 0.008, grain 0.045, dirt 0.25, lightChroma 0.3. |
| `golden` | Ch5 final walk: late gold breaking under the cloud from the far end (−Z, backlit), grain 0.03, dirt 0.12 ("still dirty, lit differently"). |
| `bright` | The colour-returns end: the `golden_street` HDRI as a blurred background. Not used by a chapter yet (title backdrop / final card). |
| `void` | Black. |

Each chapter preset spreads its **lighting recipe** `LIGHTING.<name>` from `src/world/look.js` (the art bible):

| Preset | HDRI (`env`) | `envIntensity` (→ hope 1) | Bloom (threshold) | Height fog | Grade |
|---|---|---|---|---|---|
| `flat` | `interior_dim`, window turned to the back wall | 0.16 | 0.55 (1.25): the TV | — | green-grey shadows, warm paper highlights |
| `street` | `night_street`, aligned to the sun | 0.22 → 0.3 | 0.7 (3): lamps, not the wet road | 0.025 | teal shadows, sodium highlights, CA 0.6 |
| `dawnrun` | `dawn_fog`, aligned to the low sun | 0.35 | 0.55 (3.5) | 0.035 | cold blue split |
| `workshop` | `workshop`, aligned | 0.22 → 0.3 | 0.6 (1.3): the bulb | — | warm brown shadows, tungsten highlights |
| `wall` | `golden_street` | 0.2 → 0.3 | 0.45 (2.5) | 0.012 | cool shadows, warm highlights |
| `golden` | `golden_street`, key on the sun | 0.3 | 0.5 (2.5) | 0.025 | violet shadows, gold highlights |

**Preset fields** (all optional, merged over defaults):

| Field | Meaning |
|---|---|
| `skyTop`, `skyBottom` | Sky gradient at hope 0. `skyBottom` is also the scene background. |
| `skyTopHope`, `skyBottomHope` | Sky at hope 1 (default: same as hope 0). |
| `fogColor`, `fogColorHope` | Fog colour at hope 0 / 1. |
| `fogDensity`, `fogDensityHope` | FogExp2 density at hope 0 / 1 (0 = no fog). |
| `hemiSky`, `hemiGround`, `hemiIntensity` | Hemisphere light. |
| `sunColor`, `sunIntensity`, `sunDir:[x,y,z]` | Directional light. `sunDir` points **toward** the sun. |
| `shadows` | Sun casts shadows (default true). |
| `fillColor`, `fillIntensity` | Point light riding 0.6 m above the camera so figures read (0 = off). |
| `fillNear` | Metres (default 0 = off). When the camera is closer than this to Hugo, the fill dims with the light's own falloff, so a close-up gets no more fill on him than the normal follow view. Ch1 uses 3.5. |
| `exposure` | Tone-mapping exposure (ACES). |
| `contrast` | Shader contrast around mid-grey 0.18: linear above it, a power curve below it, so shadows deepen but never clip to flat black. |
| `lightChroma` | Saturation kept in bright areas even at low hope (0 = none). |
| `vignette` | Shader vignette (0..1). |
| `vignetteColor` | Hue the vignette stains towards (default `#000` = plain black). It is normalised to unit luminance, so a near-black `#1c140c` still reads as brown; the edge keeps 25% of the pixel's luminance in that hue. |
| `grain` | Film grain amount (default 0). 0.03–0.12 is the useful range. |
| `dirt` | Lens dirt / smudges (default 0). |
| `neutralTint` | `true` turns off the cool/gold tint (Ch3). |
| `showSky` | Sky sphere visible (default true). |
| `env` | HDRI id for image-based light (`null` = none). It loads lazily and cross-fades through 0 when the preset blend changes it. |
| `envIntensity`, `envIntensityHope` | `scene.environmentIntensity` at hope 0 / 1. It adds to the hemisphere light, so keep it modest: interiors at night 0.1–0.2, daylight 0.2–0.35 (more washes the sun's shadows out). |
| `envRotation` / `envAlign` | Y rotation of the HDRI (rad), or `envAlign: true` to turn the HDRI's measured key light onto `sunDir`. |
| `envBackground` | `null` (the gradient sky, default) or a blurriness 0..1: the HDRI as a blurred background. |
| `ao` | GTAO strength (0..1.5; medium/high tiers only). |
| `bloom`, `bloomThreshold` | Bloom strength and its threshold in linear HDR. Wet chapters need 3+, or every lamp's reflection in a puddle blooms. |
| `heightFog`, `heightFogFalloff`, `heightFogY`, `heightFogColor` | Ground-hugging fog in the grade, integrated along each view ray (the sky included): density at `heightFogY`, falling off by e^−falloff per metre above it. The colour defaults to the hope-blended `fogColor`. It adds to the FogExp2. |
| `lift`, `gamma`, `gain` | `[r, g, b]`. Lift is added in the shadows (`[0.004, 0.007, 0.01]` = cool blacks), gamma bends around mid-grey, gain multiplies. |
| `splitShadow`, `splitHigh`, `split` | Split tone: hues (normalised to unit luminance) for the shadows and the highlights, and the amount (0.15–0.3). |
| `shoulder` | Soft highlight roll-off before ACES (0 = off; 0.5–0.7): a hot bulb keeps a gradient instead of a flat white disc. |
| `ca` | Chromatic aberration at the frame edges (0..1; high tier only). |

All the new numeric fields, `lift`/`gamma`/`gain` and the colours blend with `applyPreset(..., {blend})` and `tweak()`, like the rest. Two more Mood methods: `fitShadows(bounds)` (main.js calls it after each build; call it again if you change the play area) and `setQuality(tier)`.

The pain vignette (`player.pain²`, or `painOverride`) is automatic. It is off while `player.showPain` is false (Ch5 final walk), unless `painOverride` is set.

---

## 7. Director (`d` in `run(ctx, d)`)

Every blocking beat is **gated**: the debug `skip()` resolves the innermost one. Always await these wrappers rather than raw UI or engine promises, so a test run can skip through your chapter.

| Method | Returns | Notes |
|---|---|---|
| `state` | `'boot'\|'transition'\|'play'\|'dialogue'\|'cutscene'\|'end'` | Hotspots only fire in `'play'`. |
| `index` | `number` | Current chapter index (0-based). |
| `say(lines)` | `Promise` | Blocking dialogue (see `ui.dialogue`). Freezes the player. Sets `state='dialogue'`, then restores `'play'` (or `'cutscene'` if it was in one). |
| `think(textOrArray)` | `Promise` | Blocking inner-monologue line(s) given as plain strings (`who: 'Hugo'`, `inner: true`). Use it for STRIDE replies (`L.ch3.weeks[i].stride.options[k].reply` may be a string or an array). |
| `thought(text, secs, {who}?)` | `void` | Non-blocking line (= `ui.thought`): inner without `who`, a bark with it. |
| `card(lines, opts)` | `Promise` | Gated `ui.card`. |
| `choose(menu)` | `Promise<index \| 'skipped'>` | Gated `ui.choices`. On skip it resolves with the first `correct` option's index (or 0). STRIDE menus have no `correct`, so a skip picks option 0. |
| `correct(menu)` | `Promise<{tries}>` | Loops until the correct option is chosen. `menu = {who='Odile', prompt, options:[{text, correct, reply}]}`. Each reply is spoken by `menu.who` (`who` defaults to Odile; Ch5's Teach menu passes `who: 'Sami'`). Wrong options loop back to the menu, and the correct one's reply plays before it resolves. |
| `interact(id)` | `Promise` | Sets `state='play'` and waits for hotspot `id`. On skip it **triggers** the hotspot (its `onInteract` runs, so story state stays consistent). |
| `wait(s, {scaled=false})` | `Promise` | Gated timer (pauses with the game). |
| `until(fn)` | `Promise<value \| 'skipped'>` | Calls `fn(dt)` every frame until it returns truthy. **Use this for per-frame beats** (the Ch2 z-threshold chain, the line). Skip ends the loop with `'skipped'`, so handle that (jump state to the end). |
| `waitUntil(pred)` | `Promise` | `until(() => pred())`. |
| `frame()` | `Promise<dt>` | Not gated. Prefer `until`. |
| `gate(promise, onSkip?)` | `Promise` | Make any promise skippable. `onSkip()` may clean up. Returning `true` from it means "wait for the promise to settle naturally"; a second skip forces it. |
| `cinematic(async fn, {letterbox=true})` | `Promise` | `state='cutscene'`, player frozen, hotspots off, letterbox bars, then everything is restored. |
| `hope(h, secs=2)` | `void` | Hope to `h` over ~`secs` (0 = snap). |
| `after(sec, fn)` | `cancel()` | Chapter-scoped timer, auto-cancelled at chapter end. |
| `flags` | `Set` | Free-form story flags (for example `d.flags.add('jogged')`). |
| `skip()` | | Debug only. |

### 7.1 Minigames (`src/story/minigames.js`, also `ctx.minigames`)

```js
import { rhythm, timing, makeSteer, memory } from './minigames.js';
```

All of them finish on their own with no input (idle assists), end immediately on `debug.skip()`, and clean up the gauge / prompt they used. HOLD STILL (Ch2), TRUING and LETTERING (Ch4) and THE LINE (Ch5) are written in their chapter files on top of these.

#### `rhythm(ctx, d, opts) → Promise<{skipped, state}>`

The steady alternating rhythm: Ch3 running (band 2.3–3.3/s) and Ch4 sanding (band 1.5–2.5/s). A **stroke** is a press of a key different from the previous stroke's key (A, D, A, D…); repeating a key does nothing. Steady beats fast.

| opt | default | |
|---|---|---|
| `keys` | `['KeyA','KeyD']` | Read from raw input, so it works while the player is `scripted`. |
| `band` | `[2.3, 3.3]` | Target rate, strokes/s. |
| `mashAt` | `band[1] × 1.1` | Above this, `state.mashing` and `onMash`. |
| `window` | `6` | Recent intervals used for `rate` and `spread`. |
| `idleAuto` | `{after: 5, rate: mid-band}` | After `after` s with no stroke, it auto-strokes at `rate`/s until the player presses again ("the body does it anyway"). `null` disables. |
| `gauge` | none | `{label, scale=1, unit, max, color, warn(s)}`: draws `ui.gauge` every frame with `value = rate × scale`, `band × scale`, readout `` `${round(rate*scale)} ${unit}` ``. Ch3: `{label: 'CADENCE', scale: 60, unit: 'spm'}`. `warn(s) → bool` turns the needle red (default: while mashing). |
| `prompt` | `` `${L.ch3.keys.both} ${L.hints.rhythm}` `` | Prompt text while it runs; `null` for none. Sanding: `` `${L.ch3.keys.both} ${L.hints.sand}` ``. |
| `freeze` | `true` | Sets `player.frozen` while it runs, restored after. |
| `steadyAfter` | `4` | Seconds in band before `onSteady`. |
| `cooldown` | `6` | Minimum seconds between two `onMash` / `onLow` / `onSteady` calls. |
| `done(s) → bool` | — | **Required.** Checked every frame; return true to finish. |
| `onFrame(dt, s)` | | Every frame (move the runner, reveal the wood). `dt` is scaled. |
| `onStroke(s, inBand)` | | Every stroke; `s.auto` is true for assisted strokes. Play `audio.scrape()` / a footstep here. |
| `onMash(s)`, `onLow(s)`, `onSteady(s)` | | Feedback hooks (throttled). `onLow` fires when the rate drops below the band after having been in it. |
| `poll() → code \| null` | | Read first every frame; a code that differs from `s.lastKey` is a stroke. Mouse scrubbing: `poll: scrubber(craftPointer(ctx))` (`crafts/juice.js`; the scrubber calls `P.update()` itself). |

State `s`: `{rate, spread (coefficient of variation of the recent intervals; 0 = metronome), inBand, strokes, t, idle (s since the last real stroke), auto, steadyFor, lastKey, mashing}`.

#### `timing(ctx, d, opts) → Promise<{skipped, hits, misses, assisted, rings}>`

Repeated `ui.driveRing`s: Space when the ring meets its target, N hits to finish. Kept exported but unused since Ch4's truing went by ear (`crafts/truing.js`, below).

| opt | default | |
|---|---|---|
| `hits`, `rings` | `4`, `8` | Ends at `hits` hits or `rings` rings, whichever first. |
| `duration`, `window` | `2.4`, `0.18` | Ring travel and hit window (± s). **Perfect moment = `0.75 × duration`** (1.8 s): sync the rim rub / `audio.tick()` there with `onRing`. |
| `cue`, `shout`, `missText` | `'[Space]'`, `null`, `null` | Passed to `driveRing`. Truing: `cue: '[Space] when the rub meets the pad', shout: 'Quarter turn.'`. |
| `widenAfter`, `widen` | `3`, `1.6` | After 3 misses the window is ×1.6. |
| `autoHitFrom` | `5` | From the 5th miss on, a miss counts as an assisted hit (`res.assisted`). `0` disables. |
| `gap` | `0.35` | Pause between rings. |
| `onRing(i)`, `onHit(res, n)`, `onMiss(res, n)` | | Hooks. Sami's barks go in `onMiss`; `audio.ping()` in `onHit`. |

On skip it resolves with `skipped: true` and `hits` raised to the target.

#### `makeSteer(opts) → { offset: Vector2, velocity, t, stats, step(dt, input), reset() }`

A steerable tip with smooth-noise drift (Ch4 lettering, Ch5 the line). Call `step(dt, ctx.input)` every frame and add `offset` to your path point. Bounded, so idle play still produces a (wobbly) result.

| opt | default | |
|---|---|---|
| `dims` | `1` | 1: only `offset.y` (W/S); 2: x (A/D) and y (W/S). W = up = +y. |
| `drift`, `driftGrow` | `0.35`, `0` | Noise drift speed (units/s), plus growth per second elapsed. |
| `gain` | `0.9` | Correction speed per unit of input. |
| `momentum`, `damping` | `0`, `6` | 0 = direct (lettering: "no momentum"); Ch5 line: `momentum: 0.4`. |
| `bound`, `recenter` | `1`, `0.25` | `|offset|` cap and a soft spring toward 0. |
| `seed` | random | |

`input` may also be `{x, y}` in −1..1. `stats.mean` is the running mean `|offset|` (the score); `stats.max` the worst.

#### `memory`

A plain object for cross-chapter hand-offs. Ch4 stores the lettered board as `memory.openSign` (a canvas); Ch5 shows it (or a generic OPEN if it is missing, e.g. when jumping straight to Ch5).

---

## 8. Shared builders (`src/world/build.js`)

| Export | Signature | Notes |
|---|---|---|
| `bicycle({frame='#8a2b22', rust=0, scale=1, saddle=true})` | `→ Group` | Procedural road bike (see below). |
| `grimeTexture({w=512, h=512, base='#8a8478', spread=0.1, stains=8, drips=6, tags=3, posters=2, seed=1, repeat, rust, damp, tagColors, posterColors})` | `→ CanvasTexture` | Dirty-wall texture: noise, damp blooms (heavier low down), rust drips from the top edge, graffiti scribbles, torn poster rectangles, splash-back grime. Deterministic per `seed`. Use as `map` on a white or mid-value material: `box(20, 8, 0.3, {color: '#fff', map: grimeTexture({w: 1024, h: 512, seed: 7})})`. `texture.userData.canvas` lets you draw more (set `needsUpdate`). |
| `rain({count=1600, size=[34,16,34], color='#b9bec6', opacity=0.32, speed=12, length=0.5})` | `→ {object, material, update(dt, camera), opacity}` | Rain streaks wrapping around the camera (one draw call). Add `object` to your group and call `update(dt, ctx.camera)` from your scene's `update`. Set `.opacity` (0 hides it; ease it yourself for "rain eases past z −36"). |
| `rng(seed)` | `→ () => [0,1)` | Small seeded PRNG for repeatable dressing. |
| `sign(text, w=2, h=1, opts)` | `→ Mesh` | See the details after this table. |
| `ground({size=200 \| [w,d], color, roughness=0.95, metalness=0, noise=true, spread=0.1, tile=4, pos:[x,z], y=0, map, surface})` | `→ Mesh` | Flat shadow-receiving plane. `surface: 'street.asphalt'` layers a look recipe (§4.10) over the colour / map; `false` keeps it flat. **Untagged planes of 16 m² or more get the chapter's ground recipe** (the noise canvas is then dropped). The chapter weather (wet, grime) applies. |
| `box(w, h, d, {color, material, pos:[x,y,z], rotY, castShadow, receiveShadow, surface, ...matOpts})` | `→ Mesh` | Origin at the **bottom centre**. `matOpts` go to the material (`map`, `roughness`, `emissive`…). `surface` as for `ground`. **Untagged boxes at least 2.4 m tall and 2.5 m wide get the chapter's facade recipe; thin boxes (≤ 0.35 m) of 4 m² or more get its slab recipe.** An explicit `material` is never touched. |
| `mat(color, {surface, ...opts})` | `→ MeshStandardMaterial` | `roughness` 0.85 default. `surface` as above; **untagged, a material whose `map` is a `grimeTexture` gets the chapter's wall recipe** under it. |
| `lightCone({length=4, radius=1.4, apex=0.06, color, opacity=0.25, softness=1.2, pos, dir})` | `→ Mesh` | A soft additive light shaft (one draw, no depth write; fades at its rim, its foot, near the camera and in fog). Apex at the origin, pointing −Y, or along `dir`. Flicker it with `mesh.material.uniforms.uOpacity.value`. |
| `addLightCones(group, {opacity=0.28, spotOpacity=0.16})` | `→ Mesh[]` | Cones under every SpotLight (along its aim) and every PointLight hung at 3 m+ with a 14 m+ reach (street lamps). Skips `userData.noCone`. main.js runs it after builds whose chapter look has `cones` (Ch2, Ch3, Ch4). |
| `pointLight(color, intensity, {pos, distance=12, decay=2, shadow=false})` | `→ PointLight` | Keep shadowed point lights to 1 or 2 at most; about 10 real lights in the street. |
| `instancedBoxes(items, material?, {castShadow, receiveShadow})` | `→ InstancedMesh` | `items: [{pos:[x,y,z] (bottom centre), size:[w,h,d], rotY, color}]`. Building silhouettes, barriers, litter. |
| `scatter(geometry, material, count, place(i, dummy, color), opts)` | `→ InstancedMesh` | `place` sets `dummy.position/rotation/scale` and may `color.set(...)`. Puddles, leaves, litter. |
| `canvasTexture(w, h, draw(ctx,w,h), {repeat})` | `→ CanvasTexture` | sRGB, anisotropic. |
| `paintNoise(ctx, w, h, base, spread, {blotches})` | | Fill with base colour and noise. |
| `noiseTexture({base, spread, size, repeat, blotches})` | `→ CanvasTexture` | |
| `disposeGroup(group)` | | The World calls it on unload. Objects with `userData.noDispose`, and materials / textures with `userData.shared` (the look / Materials caches), are skipped. |

**`bicycle()` details:**

- About 1.0 m wheelbase, 0.68 m wheels, standing on y = 0, centred on x = 0, **front wheel toward +Z** (so `rotation.y` works like a character's facing; `Math.PI` points it down the street).
- `rust` 0..1: orange-brown frame, dull rims and a brown chain (Ch1 hook bike `rust: 0.8`); 0 = clean.
- `saddle: false` leaves the box saddle off, for a caller that fits its own at `userData.seat` (Ch1).
- **Continuity:** Hugo's race bike is team blue `#34506e` everywhere (rusted on the Ch1 hooks, chalky on the Ch4 stand, clean in the Ch5 workshop); Sami's is red `#8a2b22` (Ch4, Ch5).
- `userData`:
  - `wheels: [front, rear]`: Groups at the axles. Spin with `wheel.rotation.x -= speed * dt / 0.34`.
  - `rims: [front, rear]`: rim + hub meshes. Wobble a rim (out of true) with `rim.rotation.y = amp * Math.sin(angle)` or `rim.position.x`.
  - `tires`, `spokes` (LineSegments, 16 per wheel), `frameMaterial`, `wheelRadius` (0.34).
  - `seat`, `bars`: local `Vector3`s for posing a rider (Sami on the saddle in a crouched `sneak` pose).
- About 10 draw calls (+ shadows). On its side on a work stand: rotate it and lift it; hanging on hooks: `rotation.set(0, Math.PI / 2, 0)` against the wall.

**`sign()` details:**

- A text plane facing +Z, origin at its centre. `text` may contain `\n`.
- opts: `{bg='#14161a' \| null, fg, font, weight=700, size (auto-fit), align, pad=0.08, border, glow=false (unlit; `toneMapped:false` is a no-op with the composer, so OutputPass's ACES still applies: tune glow colours for the tone-mapped result), weathered=0..1, pxPerM=256, doubleSide, italic, letterSpacing}`.
- `mesh.userData.redraw(newText)` updates the text (the fascia "RÉPARATI" → "RÉPARATIONS."); `mesh.userData.canvas` is its canvas.
- Use it for the ghost sign, the STRIDE billboard, the shop signs, the km boards and the old signs in the workshop.

---

## 9. Examples

### Hotspot, inner lines and the watch (Ch1)

```js
ctx.hotspots.add({
  id: 'watch', pos: ctx.world.spots.watch, prompt: L.ch1.prompts.watch, required: true,
  onInteract: async () => {
    await d.say(L.ch1.watch);
    const W = L.ch1.watchHud;
    ctx.ui.watch(W.face, { label: W.label, lap: W.lap });   // 0.0 km / THIS WEEK / LAST WEEK 212.4
    await d.say(L.ch1.watchAfter);
    ctx.ui.watchBuzz(L.ch1.buzz);
    d.hope(0.06);
    d.after(2.6, () => d.thought(L.ch1.buzzReply[0].text, 2));
  },
});
await d.interact('watch');
ctx.ui.objective(L.ch1.objectives.leave);
```

### Hammering through the floor (chapter timers)

```js
let first = true;
const burst = () => {
  for (let i = 0; i < 3; i++) d.after(i * 0.9, () => ctx.audio.hammer());
  if (first) { first = false; d.thought(L.ch1.hammer, 6); }
  d.after(9, burst);
};
d.after(8, burst);
```

### A correction menu and a bark

```js
await d.correct(L.ch2.nameOne);                 // wrong answers loop back with Odile's reply
d.hope(0.12);
const B = L.ch2.hold.barks;                      // { who: 'Odile', bag: [...] }
ctx.ui.thought(B.bag[(Math.random() * B.bag.length) | 0], 2.4, { who: B.who });
```

### Ch3 cadence run with the rhythm helper

```js
ctx.player.scripted = true;
ctx.mood.painOverride = 0;
let dist = 0, v = 3.2;
const wk = L.ch3.weeks[0];
const G = L.ch3.gauge;
const r = await rhythm(ctx, d, {
  band: [2.3, 3.3], mashAt: 3.6,
  gauge: { label: G.label, scale: G.scale, unit: G.unit },
  onStroke: () => ctx.audio.footstep('concrete', { volume: 0.3 }),
  onMash: () => d.thought(L.ch3.cadence.mash, 2.2),
  onLow: () => d.thought(L.ch3.cadence.low, 2.2),
  onSteady: () => d.thought(L.ch3.cadence.steady, 2.2),
  onFrame: (dt, s) => {
    v += ((s.inBand || s.mashing ? 4.2 : 3.2) - v) * (1 - Math.exp(-2 * dt));
    dist += v * dt;
    ctx.player.root.position.z = -dist;
    const a = ctx.player.char.play('run', 0.2);
    if (a) a.timeScale = Math.max(0.6, s.rate / 2.8);
    ctx.ui.watch(`${(dist / wk.length * wk.total).toFixed(1)} km`, { tick: false });
  },
  done: () => dist >= wk.length,
});
if (r.skipped) ctx.player.root.position.z = -wk.length;
```

### Over black: the watch counts to 212.4 (Ch3)

```js
await d.gate(ctx.ui.fade(1, 0.8));
const F = L.ch3.finish;
ctx.ui.watch(F.face, { label: L.ch3.race.label, lap: F.lap, over: true });
ctx.ui.watchBuzz(F.buzz);
await d.wait(1.5);
const c = ctx.ui.watchCount(F.weekFrom, F.weekTo, 1.5, { label: F.weekLabel, lap: null });
await d.gate(c, () => { c.finish(); return true; });
await d.wait(1.5);
await d.say(L.ch3.doctor);                       // dialogue draws above the fade too
```

### The notebook (Ch4 Day 5, Ch5 finale)

```js
const N = L.notebook.items;
ctx.ui.notebook.set([]);                         // the empty exercise book
await d.gate(ctx.ui.notebook.add(N.ride));
await d.gate(ctx.ui.notebook.add(N.run));
await d.gate(ctx.ui.notebook.strike(N.ride));
await d.gate(ctx.ui.notebook.strike(N.run));
// ... Ch5:
ctx.ui.notebook.open(0);                         // stays open
await d.gate(ctx.ui.notebook.strike(N.ride, false));
await d.gate(ctx.ui.notebook.strike(N.run, false));
await d.gate(ctx.ui.notebook.annotate(N.run, L.notebook.someSundays));
await d.gate(ctx.ui.notebook.add(N.rest));
// Sami's hand: ctx.ui.notebook.add(N.teach, { hand: 'sami' });
```

### Sanding with colour on the made thing (Ch4)

```js
let progress = 0;
await rhythm(ctx, d, {
  band: [1.5, 2.5], mashAt: 3.4, idleAuto: { after: 6, rate: 2 },
  prompt: `${L.ch3.keys.both} ${L.hints.sand}`, gauge: { label: L.ch4.sanding.gauge },
  onStroke: (s, inBand) => { ctx.audio.scrape(); progress += inBand ? 0.035 : 0.012; door.setSand(Math.min(1, progress)); },
  onMash: () => ctx.ui.thought(L.ch4.sanding.barks.mash[0], 2.4, { who: 'Odile' }),
  done: () => progress >= 1,
});
// Day 8, after the auto-paint: the door holds colour in slot 0 for the rest of the chapter.
ctx.mood.focusOn(doorMesh, { slot: 0, strength: 1, decay: 0.15, floor: 0.5, offsetY: 1 });
d.hope(0.35);
```

### Truing by ear (Ch4 Week 4, Ch5 Ines's wheel)

```js
import { rigBike } from '../world/bikeRig.js';            // scene side: rig = rigBike(B.bicycle(...)); call rig.update(dt) each frame
import { trueWheel } from './crafts/truing.js';
import { reveal } from './crafts/finish.js';
// A / D (or a drag) turn spoke by spoke, Space / click plucks the one at 12 o'clock, W / S (or the
// scroll wheel) give it a quarter turn. Idle assist: a chalk mark at 8 s, then it trues itself.
const res = await trueWheel(ctx, d, { rig, faults: [[3, 0.7], [10, 1.3]], text: L.ch5.jobs.wheel.truing });
await reveal(ctx, d, { hold: 1.0 });                       // the wheel is already spinning free
```

Other craft modules (`src/story/crafts/`, docs/DESIGN.md R3.1):

| Module | Exports | What |
|---|---|---|
| `pointer.js` | `craftPointer(ctx) → P` | The mouse inside a craft: call `P.update()` once a frame, then read `ndc`, `down`, `pressed`, `released`, `click`, `dragX/Y`, `wheel` (whole notches), `scrolling` (any wheel event this frame), `pick(objects)`, `cursor(css)`; `dispose()` at the end. |
| `finish.js` | `dry(ctx, mat, {secs})`, `reveal(ctx, d, {hold, pulse})`, `settle(audio)` | Wet to matte; the held "look at what you made" beat. |
| `juice.js` | `makeDust`, `scrapeAt`, `brushHiss`, `scrubber(P)` | Particles and sounds; `scrubber` turns a mouse drag into A/D strokes for `rhythm({poll})` (a drag's opening run doesn't count). |
| `mix.js` | `TINS`, `CANON`, `RECIPE`, `mixLab`, `mixHex`, `classify(counts)` | The colour toy's pigment model and Odile's verdicts (pure functions). |
| `mixer.js` | `mixGrey(ctx, d, {mixer, text}) → {hex, tries, assisted, skipped}` | Ch4 Day 8's colour toy. Done on an unchanged pot, or an E within 0.4 s of her lines, only shakes the chip. |
| `tape.js` | `measureTape(ctx, d, {tape, text}) → {readings, agreed, assisted, skipped}` | Ch4 Day 8's measuring (hold Space or the mouse button, let go at the jamb). |
| `letters.js` | `GLYPHS`, `layoutWord`, `makeLetterBoard`, `letter` | The steered-brush lettering, WASD or a mouse drag. |
| `truing.js` | `trueWheel`, `pluck`, `spokeFreq` | Truing by ear. One quarter turn per scroll gesture; the rub (pad flash and puff) comes when the guilty spoke is under the chalk tick. |
| `radio.js` | `tuneRadio`, `radioVoice`, `STATIONS`, `signalAt` | Odile's radio (R3.8b). |

Ch5's street jobs (R3.8) are `src/story/ch5jobs.js`: `setupJobs(ctx, d, W, {bark, followDefault, isRoaming,
taught}) → {close(), dispose(), busy(), pending(), callShutter()}`, called after `meet`, over the props in
`scene5/jobs.js` (`W.jobs`). The shutter and the board open at once; the radio and Ines's wheel once
`taught()` (Sami's Teach is done). Hugo is put back where he started a job. Each writes `mem.jobs.<id>`.
Hotspot ids `shutter`, `radio`, `board`, `wheel` (`debug.trigger(id)` runs one whether open or not).
Hugo's panel and the wet line are `src/story/ch5panel.js` (`hugoPanelBeat`, `linePreroll`, `wetRibbon`,
`wetPanels`).

### Story memory (`src/story/memory.js`) and the ending

What the player did, carried across chapters (docs/DESIGN.md R3.0), saved in
`sessionStorage['hairline.mem']` so a reload keeps it. `Director.start(i)` calls `beginChapter(i)`, which
resets chapter i's flags and every later one (jumping to or restarting a chapter replays it clean).

```js
import { mem, remember } from './memory.js';
remember('jobs.radio', true);     // dotted path; saved at once, never throws
if (mem.teachFirst) { /* ... */ }
```

| Flag | Default | Set in | Meaning |
|---|---|---|---|
| `seeds.table` / `seeds.ghost` | false | Ch1 / Ch2 | Shimmed the table; lingered on the ghost sign. |
| `doorGrey` | `'#8d877c'` | Ch4 | The grey he mixed (No. 14's door in Ch5). |
| `grey` | `{tries: 0, assisted: false}` | Ch4 | Dones at the colour toy; whether Odile finished it. |
| `measure` | `{readings: [], agreed: 81.5, assisted: false}` | Ch4 | The tape. |
| `wheel` | `{secs, plucks, assisted, overTight}` | Ch4 | Truing Sami's wheel. |
| `teachFirst` | true | Ch5 | Sami's chain right first time. |
| `panel` | null | Ch5 | `'wheel'`, `'door'` or `'hand'`. |
| `jobs` | all false | Ch5 | `shutter`, `radio`, `board`, `wheel`. |

Also `DEFAULTS`, `restoreMem()` (main.js, at boot) and `memSnapshot()`. `src/story/ending.js`:
`endingLines(mem) → string[7]` picks the end card from `L.ending.cards` (street by panel, Sami by
`teachFirst`, one job card, the radio, then three fixed lines).

### The boot comes off (Ch5), mid-scene

```js
for (let i = 0; i < 3; i++) d.after(i * 0.3, () => ctx.audio.rip());
await d.wait(1);
ctx.player.setBoot(false);                       // no pose reset (he is sitting)
ctx.player.limp = 0.3;
ctx.player.footsteps = 'concrete';
d.hope(0.95);
```

### Camera tweens

```js
await d.cinematic(async () => {
  await ctx.cam.tween({ pos: [-0.2, 1.4, -45], look: [-1, 2.2, -47], fov: 45 }, 1.6);
  await d.say(L.ch2.arrival);
});
ctx.ui.watchFocus(true, { flare: L.ch2.flare });
await d.wait(1.6);
await ctx.ui.fade(1, 0.25, '#fff');              // cut to white; Ch3 fades in from white
ctx.cam.follow(ctx.player.root, { offset: [0, 2.6, 4.2] });   // back to normal follow later
```

### Placing props

```js
export async function buildScene4(ctx) {
  const group = new THREE.Group();
  const [vice, crate] = await Promise.all([
    ctx.assets.prop('props/bench_vice.glb', { height: 0.28 }),
    ctx.assets.prop('props/crate_wood.glb', { width: 0.8 }),
  ]);
  vice.position.set(-2.1, 0.92, -2.3); // on the bench top
  crate.position.set(3.4, 0, -2.2);
  group.add(vice, crate, B.pointLight(0xffb36b, 9, { pos: [0, 2.4, 0], distance: 9, shadow: true }));
  // clones: call prop() again (cached) for each instance
  return { group, bounds: [{ minX: -4.2, maxX: 4.2, minZ: -2.6, maxZ: 2.6 }], spots: { door: [0.9, 0.4] } };
}
```

### Switching dressing mid-chapter (Ch5 golden hour)

```js
await d.gate(ctx.ui.fade(1, 1.2));
ctx.world.current.setGolden();
ctx.mood.applyPreset('golden');
d.hope(1.0, 0);
ctx.player.teleport(0, 8, Math.PI);
ctx.player.painCap = 0.9;
ctx.player.showPain = false;
ctx.cam.follow(ctx.player.root, { snap: true });
await d.gate(ctx.ui.fade(0, 1.5));
```

---

## 10. Debug

With `?debug=1`, `window.__game` exposes:

- **Promises and objects:**
  - `ready`: a Promise that resolves once the first chapter reaches `'play'`
  - `ctx`, `director`, `player`, `mood`, `renderer`, `input`, `engine`, `ui`, `audio`, `cam`, `hotspots`, `runner`, `world`, `assets`
  - `materials`, `look`, `env`, `post` (try `__game.post.view = 'ao'` / `'bloom'`, or `__game.post.override = { bloom: 0 }`), `quality` (`get()`, `set('low')`, `tiers`, `gpu`, `source`)
- **Logs:** `errors[]` and `warnings[]` (captured console output).
- **`loadTime`:** `performance.now()` when the loading screen finished (the characters plus the first chapter's PBR sets, HDRIs and props).
- **`debug` methods:**
  - `goto(i)` (reload at chapter i with the debug flags)
  - `skip()`
  - `hold(code, ms)`
  - `press(code)`
  - `setHope(h)`
  - `teleport(x, z)`
  - `trigger(id)`
  - `state()`, which returns `{state, chapter, hope, pos, pain, spots, calls, callsPost, quality}`. `calls` counts the scene pass including shadow maps (the chapter budget); `callsPost` is the post chain's full-screen draws (13 on medium/high, 2 on low). `renderer.info.render.calls` is the sum.
  - `advance(ms, {choose, step, spots, rhythm, key})`: autoplay for `ms`. Presses E whenever a dialogue is open, picks choice `choose` when a menu is open, triggers the first required hotspot in `'play'` (unless `spots: false`), and otherwise taps a steady A/D rhythm (`rhythm: true`) or `key`. Resolves to the dialogue lines seen. It waits with MessageChannel yields, so it keeps pace in a hidden tab, where `setTimeout` is throttled to about 1 s.
  - `shot(holdMs)`: renders one frame and shows it in an overlay `<img>` for `holdMs`, so a page screenshot of an occluded window still shows the 3D view
  - `look(yawDeg, pitchDeg, zoom)`, `view()`, `pointer()`: camera look without a mouse (see 4.6, Camera rig)
  - `lang(code?)`: returns the language; with a code, switches to it (as Options does)
  - `mem()`: a copy of the story memory (above: `seeds`, `doorGrey`, `grey`, `measure`, `wheel`, `teachFirst`, `panel`, `jobs`)
  - `textLog`: every string the UI has shown (dialogue, speaker labels, thoughts, objectives, prompts, cards, menus, HUD labels, hints), capped at 2000, for diffing against the text files

**Query flags:**

- `?chapter=N` (0–4)
- `?autostart=1` skips the title; audio stays silent until a real click.
- `?skipcards=1` makes cards auto-close and hides chapter titles.
- `?quality=low|medium|high` forces a quality tier (§4.1).
- `?lang=en|fr` forces the language (not remembered).
- With `?debug=1` the game keeps running in a hidden or occluded browser window (automation): the loop is driven from a `MessageChannel` instead of `requestAnimationFrame`, and the tab never auto-pauses. Page screenshots of a hidden window come out black, so capture the canvas instead: `__game.engine.tick(performance.now()); __game.renderer.domElement.toDataURL()`.

**Also on `window.__game`:** `minigames` (the module: `rhythm`, `timing`, `makeSteer`, `memory`).

**Make sure your chapter:**

- reaches `'play'`
- can be completed by repeatedly calling `__game.debug.skip()`, which never soft-locks
- logs no console errors
- stays under 250 draw calls (`debug.state().calls`, the scene pass; the post chain is extra)
