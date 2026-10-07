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
| Character facing | Xbot faces **+Z** at `rotation.y = 0`. `rotation.y = Math.PI` faces **−Z**. To face a point: `rotation.y = Math.atan2(dx, dz)`. |
| Streets | Outdoor scenes run along **−Z** (Ch2/Ch5 street: spawn z +8…+3, workshop door at z −48; Ch3 road: the runner goes toward −Z). See DESIGN.md's STREET CONTRACT. |
| Camera | Fixed world offset behind the player (`(0, 2.6, 4.2)` outdoors, `(0, 3.4, 3.6)` in the dollhouse rooms). It looks toward −Z. There is no orbit. "Forward" for the player is W, which is −Z. |
| Positions in APIs | `[x, z]` means on the ground. `[x, y, z]` is a full 3D point. A `THREE.Vector3` is also accepted wherever noted. |
| Colours | Hex numbers (`0x9fb7d6`) or CSS strings (`'#9fb7d6'`). They are sRGB and are converted automatically. |
| Time | `dt` passed to update hooks is **scaled** by `engine.timeScale` (slow-mo). `rawDt` is real time. The camera, Mood and UI use real time. |
| Albedo | The MoodShader desaturates heavily at low hope, the vignette darkens edges, and the grime pass adds grain and dirt. Keep surface colours **mid-value** (sRGB roughly `#707070`–`#b0b0b0` for walls and floors). Very dark albedos read as pure black. Let lights, `grimeTexture` and the mood create the dirt and darkness. |
| Disposal | Everything you add to your scene `group` (or via `ctx.world.add`) is disposed when the chapter ends. Characters from `assets.makeCharacter` are released automatically too. |

Imports (paths are relative to your file):

```js
import * as THREE from 'three';
import { L } from './script.js';                              // from src/story/chN.js
import * as B from '../build.js';                             // from src/world/scenes/sceneN.js
// or named imports: import { sign, ground, box, bicycle, grimeTexture, rain } from '../build.js';
import { rhythm, timing, makeSteer, memory } from './minigames.js'; // from src/story/chN.js
```

Addons: `import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';` The `.js` extension is required.

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
| `ctx.assets` | `Assets` | Characters and Kenney props (§4.3) |
| `ctx.audio` | `AudioSys` | Music, ambience, one-shots (§4.4) |
| `ctx.mood` | `Mood` | Hope, colour grade, lights, sky, fog (§6) |
| `ctx.sky` | `Sky` | Gradient sky (Mood drives it) |
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

Rendering: the scene is drawn into a 4× multisampled half-float composer target with depth (`composer.renderTarget2`, the RenderPass's read buffer every frame); the Mood pass writes a single-sample, depthless half-float target (`renderTarget1`). Canvas MSAA is off. Keep the chain at Render → Mood → Output (an even number of swaps), or move the MSAA settings with it; with the pixel ratio capped at 1.5 (1.25 on touch devices). Camera near plane 0.1. **Shaders must not produce NaN** (e.g. `pow()` of a negative): with MSAA, varyings can be evaluated slightly outside a triangle, and a NaN survives the resolve and the grade as black.

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
| `renderer`, `scene`, `camera`, `composer` | three objects | `composer` passes: `[RenderPass, ShaderPass(MoodShader), OutputPass]`. |
| `moodPass` | `ShaderPass` | Mood owns its uniforms. |

Bloom is CUT by design (DESIGN.md). Don't add post passes.

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
| `press(code)` | | Synthetic one-frame press (tests). |
| `hold(code, ms=500)` | `→ Promise` | Synthetic hold (tests and debug). |
| `onKey(fn)` | `fn(code, event) → off()` | Raw keydown listener. It fires even while paused. Call the returned `off()` at chapter end. |

**Key ownership:**

- E is consumed by the UI while a dialogue or card is open, and by Hotspots when a spot is in range.
- Space is never used by dialogue. Use `input.pressed.has('Space')` for timing prompts.
- Esc and M are handled globally (pause, mute).

### 4.3 Assets (`ctx.assets`)

#### `makeCharacter(opts) → Character`

This never throws. If the Xbot failed to load, it returns a capsule stand-in with the same API (`isFallback: true`, `play()` is a no-op).
Skinned meshes are frustum-culled (main and shadow pass) against a fixed bind-pose bounding sphere padded ×1.5, so off-screen crowds cost little. Poses applied through `model.position/rotation` stay inside it.

| opt | default | |
|---|---|---|
| `tint` | `0x2a3550` | Body colour. Use mid values. |
| `joints` | 55% of tint | Joint colour |
| `scale` | `1` | Height = 1.8 m × scale (Odile 0.94, Sami 0.72) |
| `name` | `'character'` | |
| `roughness`, `metalness` | `0.75`, `0.05` | |
| `castShadow` | `true` | |

You must add `char.root` to your group (`group.add(char.root)` or `ctx.world.add(char.root)`).

The character's mixer is updated automatically, with scaled dt. It is released at chapter end.

#### Character

| Member | Signature | Notes |
|---|---|---|
| `root` | `THREE.Group` | Position and rotate this. |
| `model` | `THREE.Object3D` | Inner scaled model. Use it for local offsets and leans (`model.rotation.x` pitches about the feet). |
| `play(name, fade=0.25, {timeScale=1, once=false})` | `→ AnimationAction \| null` | Cross-fades. Clips: `'idle' 'walk' 'run' 'sad' 'sneak' 'agree' 'headShake'`. `'sad'` and `'sneak'` are static full-body poses (slumped and crouched). `agree` and `headShake` are full-body clips, CUT by design. Calling with the current clip is a no-op that returns the action. |
| `actions` | `{[name]: AnimationAction}` | For example `char.actions.run.timeScale = 1.3`. |
| `current` | `string` | Current clip name. |
| `fade(to, secs=1)` | `→ Promise` | Opacity fade. 0 also hides the root (Bastien running off). |
| `setOpacity(a)` | | Immediate. |
| `setTint(color)` | | Recolour the body. |
| `bone(name)` | `→ THREE.Bone \| null` | Mixamo short names: `'Hips'`, `'Spine'`, `'Head'`, `'LeftUpLeg'`, `'RightArm'`, … Bone names are sanitized (`mixamorigHips`). This finds them for you. |
| `isFallback` | `boolean` | |
| `dispose()` | | Usually not needed (automatic). |

#### `prop(path, opts) → Promise<THREE.Group>`

This loads a Kenney GLB, normalised to a real-world size. **It never rejects.** A missing or broken file gives a grey box of the right size (`group.userData.isFallback = true`).

- `path`: `'kenney/furniture/loungeSofa.glb'` (relative to `public/assets/`). A leading `/assets/` also works.
- `opts`:

| opt | default | |
|---|---|---|
| `height` | — | Target height in metres. Real heights: sofa 0.85, TV 0.5, fridge 1.8, building 8–14, street light 4.5, tree 5–8, bench 0.8. |
| `width` | — | Used only when `height` is omitted (scales by x size). |
| `tint` | — | Multiplies every material colour (clones the materials). |
| `color` | — | Replaces every material colour (clones the materials). |
| `center` | `true` | The footprint is centred on x/z and the bottom sits on y = 0, so `position` is the footprint centre on the floor. `false` keeps the native origin. |
| `castShadow`, `receiveShadow` | `true` | |

The returned group has `userData.size` (a `Vector3`, in metres).

- **Rotation:** set `rotation.y` on the returned group.
- **Kenney model fronts:** furniture and retro props (TV screen, fridge door, sofa seat, bench) face **+Z** natively, toward the default camera. Use `rotation.y = Math.PI` to make them face −Z (for example a sofa facing a TV on the back wall). Check other kits visually.
- Results are cached, so repeated calls clone a cached model and are cheap.

#### Other Assets methods

- **`preload(paths[])`:** warm the cache (fire and forget, during `build`).
- **`texture(path, {repeat:[u,v], srgb=true}) → THREE.Texture`:** cached loader, for example `'kenney/retro/Textures/asphalt.png'`.

**Available props** (see `docs/asset-bounds.txt` for native sizes):

| Folder | Props |
|---|---|
| `kenney/furniture/` | `bedSingle bench books cabinetTelevision cardboardBoxClosed cardboardBoxOpen chair doorway kitchenCabinet kitchenFridge lampRoundFloor loungeSofa pottedPlant rugRectangle sideTable table tableCoffee televisionVintage trashcan wallWindow` |
| `kenney/city/` | `building-a … building-h detail-awning low-detail-building-a … -d` |
| `kenney/roads/` | `construction-barrier construction-cone construction-fence dumpster light-curved light-square road-straight` |
| `kenney/retro/` | `detail-barrier-strong-damaged detail-bench detail-bricks-type-a detail-cables-type-a detail-dumpster-closed detail-dumpster-open detail-light-single pallet pallet-small planks scaffolding-floor scaffolding-poles scaffolding-structure tree-small wall-a-door wall-a-flat wall-a-garage wall-a-window wall-broken-type-a` (all native 1 m modules; `wall-a-flat` is a 1×1 m plane) |
| `kenney/survival/` | `barrel barrel-open bottle-large box box-large box-open bucket chest metal-panel metal-panel-screws resource-planks resource-wood signpost structure-metal-doorway structure-metal-roof structure-metal-wall tool-axe tool-hammer tool-shovel workbench workbench-anvil workbench-grind` (small native sizes: `workbench` is ~0.3 m, so scale it with `height`, or use it as dressing) |
| `kenney/nature/` | `fence_simple grass grass_large log plant_bush rock_largeA stump_old tree_cone_fall tree_default_fall tree_oak_fall tree_simple_fall tree_thin_fall` |
| `kenney/arena/` | `banner column-damaged trophy` |

### 4.4 Audio (`ctx.audio`)

Every method is safe before the user gesture: nothing plays until the title click or the first real click with `?autostart`.

| Method | Notes |
|---|---|
| `music(name \| null, {volume=0.45, fade=2.5, loop=true})` | Cross-fades beds. Names: `'contemplation'` and `'piano'` (Ch5 and the ending). `null` fades out. Calling with the current name only changes the volume. Usually set through the chapter's `music` field instead. |
| `ambience(name, on=true, {volume, fade=2, lowpass})` | `'rain'` or `'crowd'` (low-passed at 900 Hz by default; pass `lowpass` in Hz, e.g. Ch3 race `{lowpass: 1400}`). Usually set through the chapter's `ambience` field. Safe to call repeatedly while the file is still loading. |
| `footstep(surface='concrete'\|'grass', {volume=0.35, rate})` | One sample. Player footsteps are already automatic (including `'boot'`). |
| `heartbeat({volume})` | Two 55 Hz thumps (stumbles call it). |
| `snap({volume=0.9})` | Small dry bandpassed click (Ch3 KM 31: `snap({volume: 0.3})`, "a pencil lead"). Plays after `cut()`. |
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
| `drone(hope)` | Called every frame by Mood. Do not call it. |
| `cut()` | Silences music, ambience, drone and steps within 50 ms (Ch3 at KM 31). `fx` one-shots still play. |
| `restore(fade=0.8)` | Undoes `cut()`. The Director calls it at every chapter start. |
| `stopAll({fade=1.5, music=true})` | Fades all ambience (and music). |
| `toggleMute()`, `setMuted(b)`, `muted` | M is wired globally. |

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
| `thought(text, secs=3.5, {who}={})` | | **Non-blocking** line in the lower third. Without `who`: Hugo's italic inner line (stumbles, the hammer thought). With `who`: a spoken **bark** with a coloured speaker label (`ui.thought("Stiller.", 2.4, {who: 'Odile'})`). Bark data in the text files is `{who, bag:[...]}`. A new call replaces the current line. Never shown on top of a dialogue: opening a dialogue hides the current thought, and a thought called while a dialogue is open waits and shows when it closes (only the latest one is kept). |
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
| `notebook.add(text, {hand='hugo'})` | `Promise` (~0.9 s) | Writes a new line with a pencil write-on animation and a scratch sound; opens for 3.2 s. `hand: 'sami'` = bigger, slanted, blue biro ("Teech."). |
| `notebook.strike(text, on=true)` | `Promise` (~0.7 s) | Draws a light pencil line through an entry; `on=false` erases it (Ch5 finale). |
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

---

## 5. Player (`ctx.player`)

Hugo is a persistent character (slate Xbot, `HUGO_TINT = 0x4a5260`). The Director calls `configure()` with your chapter's `player` field.

### `configure(opts)`

**Not sticky:** every call applies the defaults for anything it omits (Ch3's green kit and bare leg never carry into Ch4). It also resets pain, flags and pose, so mid-scene changes (Ch5 bench) should write fields directly instead.

| opt | default | Notes |
|---|---|---|
| `spawn` | — | `[x, z]` or `[x, y, z]`. |
| `facing` | `Math.PI` | Facing −Z, away from the camera. |
| `boot` | `false` | The **walking boot** on the left shin (see `setBoot`). Ch1, Ch2, Ch4 and Ch5 pass `boot: true`. |
| `tint` | `HUGO_TINT` | Body colour. Ch3: `tint: '#c6f432'` (STRIDE green). |
| `limp` | `1` | 0..1. It slows the walk (1.3 m/s × lerp(1, .85, limp)), unevens step timing and adds one dip per cycle. Per DESIGN: Ch1 1.0, Ch2 0.95, Ch4 0.85→0.75, Ch5 0.7, then 0.3 out of the boot. Writable mid-chapter. |
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
| `setBoot(on)` | Show / hide the walking boot **without** a pose reset (Ch5 bench: `setBoot(false); player.limp = 0.3; player.footsteps = 'concrete';`). The boot (rounded shell `#3a3d42`, three straps, thick sole) is parented to the `LeftLeg` bone and built in metres (it divides by the bone's world scale), so it follows every animation and pose. The capsule fallback gets a box at its left base. |
| `teleport(x, z, facing?, y=0)` | |
| `face(x, z)` | Turn to face a point. |
| `setPose(name, dur=0.6) → Promise` | `'stand' \| 'crouch' \| 'sit' \| 'fall' \| 'lie'`. Non-`stand` poses block movement. `'sit'` is the `sad` slump at y −0.42 (benches). `'crouch'` uses `sneak` (measuring the frame). |
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
| `void` | Black. |

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
| `exposure` | Tone-mapping exposure (ACES). |
| `contrast` | Shader contrast around mid-grey 0.18: linear above it, a power curve below it, so shadows deepen but never clip to flat black. |
| `lightChroma` | Saturation kept in bright areas even at low hope (0 = none). |
| `vignette` | Shader vignette (0..1). |
| `vignetteColor` | Hue the vignette stains towards (default `#000` = plain black). It is normalised to unit luminance, so a near-black `#1c140c` still reads as brown; the edge keeps 25% of the pixel's luminance in that hue. |
| `grain` | Film grain amount (default 0). 0.03–0.12 is the useful range. |
| `dirt` | Lens dirt / smudges (default 0). |
| `neutralTint` | `true` turns off the cool/gold tint (Ch3). |
| `showSky` | Sky sphere visible (default true). |

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
| `prompt` | `'[A / D] ' + L.hints.rhythm` | Prompt text while it runs; `null` for none. Sanding: `` `[A / D] ${L.hints.sand}` ``. |
| `freeze` | `true` | Sets `player.frozen` while it runs, restored after. |
| `steadyAfter` | `4` | Seconds in band before `onSteady`. |
| `cooldown` | `6` | Minimum seconds between two `onMash` / `onLow` / `onSteady` calls. |
| `done(s) → bool` | — | **Required.** Checked every frame; return true to finish. |
| `onFrame(dt, s)` | | Every frame (move the runner, reveal the wood). `dt` is scaled. |
| `onStroke(s, inBand)` | | Every stroke; `s.auto` is true for assisted strokes. Play `audio.scrape()` / a footstep here. |
| `onMash(s)`, `onLow(s)`, `onSteady(s)` | | Feedback hooks (throttled). `onLow` fires when the rate drops below the band after having been in it. |

State `s`: `{rate, spread (coefficient of variation of the recent intervals; 0 = metronome), inBand, strokes, t, idle (s since the last real stroke), auto, steadyFor, lastKey, mashing}`.

#### `timing(ctx, d, opts) → Promise<{skipped, hits, misses, assisted, rings}>`

Repeated `ui.driveRing`s (Ch4 truing): Space when the ring meets its target, N hits to finish.

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
| `bicycle({frame='#8a2b22', rust=0, scale=1})` | `→ Group` | Procedural road bike (see below). |
| `grimeTexture({w=512, h=512, base='#8a8478', spread=0.1, stains=8, drips=6, tags=3, posters=2, seed=1, repeat, rust, damp, tagColors, posterColors})` | `→ CanvasTexture` | Dirty-wall texture: noise, damp blooms (heavier low down), rust drips from the top edge, graffiti scribbles, torn poster rectangles, splash-back grime. Deterministic per `seed`. Use as `map` on a white or mid-value material: `box(20, 8, 0.3, {color: '#fff', map: grimeTexture({w: 1024, h: 512, seed: 7})})`. `texture.userData.canvas` lets you draw more (set `needsUpdate`). |
| `rain({count=1600, size=[34,16,34], color='#b9bec6', opacity=0.32, speed=12, length=0.5})` | `→ {object, material, update(dt, camera), opacity}` | Rain streaks wrapping around the camera (one draw call). Add `object` to your group and call `update(dt, ctx.camera)` from your scene's `update`. Set `.opacity` (0 hides it; ease it yourself for "rain eases past z −36"). |
| `rng(seed)` | `→ () => [0,1)` | Small seeded PRNG for repeatable dressing. |
| `sign(text, w=2, h=1, opts)` | `→ Mesh` | See the details after this table. |
| `ground({size=200 \| [w,d], color, roughness=0.95, metalness=0, noise=true, spread=0.1, tile=4, pos:[x,z], y=0, map})` | `→ Mesh` | Flat shadow-receiving plane. Wet street: `roughness: 0.9, metalness: 0.1`. |
| `box(w, h, d, {color, material, pos:[x,y,z], rotY, castShadow, receiveShadow, ...matOpts})` | `→ Mesh` | Origin at the **bottom centre**. `matOpts` go to the material (`map`, `roughness`, `emissive`…). |
| `mat(color, opts)` | `→ MeshStandardMaterial` | `roughness` 0.85 default. |
| `pointLight(color, intensity, {pos, distance=12, decay=2, shadow=false})` | `→ PointLight` | Keep shadowed point lights to 1 or 2 at most; about 10 real lights in the street. |
| `instancedBoxes(items, material?, {castShadow, receiveShadow})` | `→ InstancedMesh` | `items: [{pos:[x,y,z] (bottom centre), size:[w,h,d], rotY, color}]`. Building silhouettes, barriers, litter. |
| `scatter(geometry, material, count, place(i, dummy, color), opts)` | `→ InstancedMesh` | `place` sets `dummy.position/rotation/scale` and may `color.set(...)`. Puddles, leaves, litter. |
| `canvasTexture(w, h, draw(ctx,w,h), {repeat})` | `→ CanvasTexture` | sRGB, anisotropic. |
| `paintNoise(ctx, w, h, base, spread, {blotches})` | | Fill with base colour and noise. |
| `noiseTexture({base, spread, size, repeat, blotches})` | `→ CanvasTexture` | |
| `disposeGroup(group)` | | The World calls it on unload. Objects with `userData.noDispose` are skipped. |

**`bicycle()` details:**

- About 1.0 m wheelbase, 0.68 m wheels, standing on y = 0, centred on x = 0, **front wheel toward +Z** (so `rotation.y` works like a character's facing; `Math.PI` points it down the street).
- `rust` 0..1: orange-brown frame, dull rims and a brown chain (Ch1 hook bike `rust: 0.8`); 0 = clean.
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
  prompt: `[A / D] ${L.hints.sand}`, gauge: { label: L.ch4.sanding.gauge },
  onStroke: (s, inBand) => { ctx.audio.scrape(); progress += inBand ? 0.035 : 0.012; door.setSand(Math.min(1, progress)); },
  onMash: () => ctx.ui.thought(L.ch4.sanding.barks.mash[0], 2.4, { who: 'Odile' }),
  done: () => progress >= 1,
});
// Day 8, after the auto-paint: the door holds colour in slot 0 for the rest of the chapter.
ctx.mood.focusOn(doorMesh, { slot: 0, strength: 1, decay: 0.15, floor: 0.5, offsetY: 1 });
d.hope(0.35);
```

### Truing (Ch4) with the timing helper

```js
const res = await timing(ctx, d, {
  hits: 4, rings: 8, duration: 2.4,
  cue: '[Space] when the rub meets the pad', shout: 'Quarter turn.',
  onRing: () => d.after(1.8, () => ctx.audio.tick()),     // the rub lands on the perfect moment
  onHit: () => { wobble *= 0.6; ctx.audio.ping(); },
  onMiss: () => ctx.ui.thought(missBag[(Math.random() * missBag.length) | 0], 2.2, { who: 'Sami' }),
});
ctx.mood.focusOn(bike, { slot: 1, floor: 0.55, offsetY: 0.5 });
```

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

### Placing Kenney props

```js
export async function buildScene4(ctx) {
  const group = new THREE.Group();
  const [barrel, planks] = await Promise.all([
    ctx.assets.prop('kenney/survival/barrel-open.glb', { height: 0.9 }),
    ctx.assets.prop('kenney/survival/resource-planks.glb', { width: 0.9 }),
  ]);
  barrel.position.set(3.6, 0, -2.4);
  planks.position.set(-3.4, 0, -2.2);
  group.add(barrel, planks, B.pointLight(0xffb36b, 9, { pos: [0, 2.4, 0], distance: 9, shadow: true }));
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
- **Logs:** `errors[]` and `warnings[]` (captured console output).
- **`debug` methods:**
  - `goto(i)` (reload at chapter i with the debug flags)
  - `skip()`
  - `hold(code, ms)`
  - `press(code)`
  - `setHope(h)`
  - `teleport(x, z)`
  - `trigger(id)`
  - `state()`, which returns `{state, chapter, hope, pos, pain, spots, calls}`
  - `advance(ms, {choose, step, spots, rhythm, key})`: autoplay for `ms`. Presses E whenever a dialogue is open, picks choice `choose` when a menu is open, triggers the first required hotspot in `'play'` (unless `spots: false`), and otherwise taps a steady A/D rhythm (`rhythm: true`) or `key`. Resolves to the dialogue lines seen. It waits with MessageChannel yields, so it keeps pace in a hidden tab, where `setTimeout` is throttled to about 1 s.
  - `shot(holdMs)`: renders one frame and shows it in an overlay `<img>` for `holdMs`, so a page screenshot of an occluded window still shows the 3D view

**Query flags:**

- `?chapter=N` (0–4)
- `?autostart=1` skips the title; audio stays silent until a real click.
- `?skipcards=1` makes cards auto-close and hides chapter titles.
- With `?debug=1` the game keeps running in a hidden or occluded browser window (automation): the loop is driven from a `MessageChannel` instead of `requestAnimationFrame`, and the tab never auto-pauses. Page screenshots of a hidden window come out black, so capture the canvas instead: `__game.engine.tick(performance.now()); __game.renderer.domElement.toDataURL()`.

**Also on `window.__game`:** `minigames` (the module: `rhythm`, `timing`, `makeSteer`, `memory`).

**Make sure your chapter:**

- reaches `'play'`
- can be completed by repeatedly calling `__game.debug.skip()`, which never soft-locks
- logs no console errors
- stays under 250 draw calls (`debug.state().calls`)
