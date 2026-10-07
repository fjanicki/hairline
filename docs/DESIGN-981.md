> **SUPERSEDED. Historical spec, do not follow.** This is the plan for the earlier "9.81" prototype.
> HAIRLINE replaced it: the current spec is `docs/DESIGN.md`, the engine API is `docs/API.md` and every
> shipped asset is listed in `docs/CREDITS.md`. In particular, **nothing here about the Mixamo Xbot
> applies any more**: the game ships no Mixamo content (characters are Quaternius CC0), so do not fetch
> `Xbot.glb`, put it in `public/models`, or credit mixamo.com. The audio file names below are also stale.

> **OVERRIDES (these take precedence over anything below):**
> 1. **Kenney CC0 props are in scope.** The Kenney CC0 kits are already extracted in `public/assets/kenney/*`; approximate bounds are in `docs/asset-bounds.txt`. USE them:
>    - Ch1 apartment furniture: sofa, TV, TV cabinet, coffee table, bed, boxes, fridge, lamp, rug, plant.
>    - Ch2 street: city buildings, street lights, road, construction fence, dumpster, broken wall, bench.
>    - Ch4/5 track surroundings: autumn trees, grass, bushes, rocks, trophy, banner.
>
>    This makes "Kenney props" and "Poly Haven or Kenney props" in the CUT list below void. Kits use different unit scales, so always load props through `Assets.prop(path, { height })`, which normalises to a target real-world height in metres.
>    - Real heights: sofa 0.85, TV 0.5, fridge 1.8, building 8–14, street light 4.5, tree 5–8, bench 0.8.
>    - Keep procedural geometry for the track, walls/floor of the apartment, bleachers and signs.
>    - Every prop load must fail soft: a missing GLB yields a grey box of the same size.
> 2. **Music is in scope.** CC0 music files are in `public/assets/audio`: `contemplation.mp3` (Ch1–4 bed), `piano.wav` (Ch5 + ending), `rain.ogg` (Ch1/Ch2 ambience), `crowd.ogg` (Ch3 crowd; lowpass it), and `footstep_concrete_00[0-4].ogg` / `footstep_grass_00[0-4].ogg`. Procedural WebAudio stays for heartbeat, gun, snap and drone. All music fades in and out.
> 3. **Credits.** The end card credits: "Character model from mixamo.com (via three.js examples). Props, sounds: Kenney (CC0). Music: OpenGameArt (CC0)."

# 9.81: Final Implementation Plan (3D WebGL MVP)

## Context
- The target is an empty greenfield directory, `/Users/fjanicki/workspace/ai/demo`, with Node v24 and npm.
- The user asked for a quick, browser-based 3D demo built from existing assets. They want no technical decisions put to them, so everything below is decided.
- The two input documents described different games. We keep the 9.81 story (Theo the sprinter). From the "Second Half" tech doc we reuse only the engine skeleton: Engine, Input, a follow camera, the player controller, the mood shader pass, interactions, the UI and the director.
- The producer cuts are applied. That leaves 5 chapters in 3 builders, about 8–10 minutes of play, about 1,300–1,600 lines of code and one 2.9 MB external asset.
- Checked today (2026-10-06):
  - `npm view three version` gives 0.186.1.
  - `npm view vite version` gives 8.3.3, which needs node `^20.19.0 || >=22.12.0`.
  - Xbot.glb at tag r186 returns HTTP 200 on jsdelivr (`model/gltf-binary`, CORS `*`) and on raw.githubusercontent (2,930,032 B).

## Concept & Story

**Title:** 9.81
**Tagline:** *His whole life lasted 9.81 seconds. This is the rest of it.* 9.81 is his 100m record, and 9.81 m/s² is gravity, the force that finally caught him.

**Protagonist:** Theo Ward, 27, a 100m national record holder. His left Achilles tore at the 60m mark of the Olympic final eight months ago. The verdict: "You'll walk fine. Jog, eventually. Compete, no."
**Deuteragonist:** Mila Reyes, 13. She trains alone on the condemned Harlow Park track.
**Setting:** Harlow, a fading hometown in late autumn. The town is not post-apocalyptic. It feels desolate because he does.
**Thesis:** colour is hope.
- The world starts grey.
- The flashback is neon and oversaturated.
- The colour that returns at the end is warm gold, not the old neon. The new life is not the old life restored.
- 60m is the spine of the game: his body fails there in Ch3, and his voice carries Mila through there in Ch5.

**Controls:**
- WASD or arrows: move. Movement is world-relative and the camera always sits behind.
- Shift: try to jog.
- E: interact or advance dialogue.
- Space: timing prompts only. It never advances dialogue.
- A/D alternating: the flashback sprint.
- 1–3: dialogue choices.
- M: mute.
- Esc: pause.

### Opening card (white on black, one line at a time, E or click skips)
> Theo Ward ran 100 metres in 9.81 seconds.
> For eleven years, that was who he was.
> Eight months ago, at the sixty-metre mark of the Olympic final,
> his left Achilles tendon tore.
> The world kept moving at full speed.
> He didn't.

### Ch1 "Heel Raises, 3x15": apartment, night
- **Location:** a primitive box room, 6×5 m, built dollhouse-style with the +Z wall omitted so the camera can sit outside it. It holds a couch, a TV, a table, a door, a window and moving boxes.
- **Mood:**
  - hope 0.05 → 0.08, ambient `#2b3440`
  - a flickering TV PointLight `#9fb7d6` is the key light
  - no fog
  - painRate 1/0.6 s
- **Mechanic:**
  - Walking has a heavy limp.
  - The "Hold Shift to jog" hint appears after 10 s.
  - The first stumble always says: *"Right. We don't do that anymore."*
- **Hotspots:**
  - **TV:** "...Ward, who went down clutching his left heel at the sixty-metre mark..." Pressing E turns it off (the light stops). *"You've seen how it ends. Every night, you've seen how it ends."*
  - **Phone (47 unread):**
    - "Mum: Call when you can. No pressure x"
    - "VELOCE Legal: RE: Termination of agreement"
    - "Ray (Coach): The door's open, kid."
    - *"Forty-seven. I'll answer them when I'm someone worth answering."*
  - **Stopwatch (REQUIRED):** *"Ray gave me this when I was fourteen. 'The clock doesn't care who you are.' I used to find that comforting."* Then a HUD stopwatch shows `9.81`: *"Never reset it."*
  - SHOULD:
    - **Fridge rehab sheet:** *"Ankle circles, 3x20. Heel raises, 3x15. Untouched since March."*
    - **Shoebox:** *"Size eleven. Gold. Made for the final. Worn once. Forty-eight metres... no. Sixty."*
- **Advance:** after the stopwatch is taken, the door zone switches on. On E, the screen fades and a voicemail plays as subtitles. **Ray:** "Theo. It's Ray. I'm not going to tell you it gets better. I'm going to tell you the track's still there. Harlow Park. For now."

### Ch2 "Nothing Can Stop You": High Street at dusk, leading onto the track (one scene)
- **Location:** a straight corridor of box buildings with dark windows. It ends at a chain-link fence with a gap, and the condemned track lies beyond.
- **Mood:**
  - hope 0.08 → 0.15
  - FogExp2 `#6e7378` at density 0.04
  - sodium lamps `#d9a35a`
  - wet dark ground (roughness 0.9, metalness 0.1)
  - painRate 1/0.8 s
- **Hotspots:**
  - **Billboard** ("VELOCE — NOTHING CAN STOP YOU", a CanvasTexture): *"They paid more for that photo than my dad made in ten years. Nothing can stop you. Funny thing to be wrong about."*
  - **Stranger** (a grey Xbot clone): when Theo gets within 3 m, the stranger turns. "Hey, you're... no. Sorry. Thought you were someone." The stranger then walks off and fades out, and only after that comes *"So did I."*
  - **Fence sign** ("HARLOW PARK — SITE ACQUIRED — DEMOLITION NOV."), REQUIRED: *"Of course it is."*
  - SHOULD:
    - **Shop window:** "WARD SIGNATURE RANGE — 70% OFF". *"Seventy percent off. Sounds about right."*
    - **Bench:** E to sit, which drains pain quickly.
- **Advance:** through the gap to the glowing lane-4 start line, then E.
  - He crouches (the model lowers and leans, the camera drops).
  - *"Set position. Body remembers. Body remembers everything."*
  - Cut to white.

### Ch3 "The Final": flashback, same track, Olympic dressing
- **Dressing:**
  - InstancedMesh box bleachers on both sides
  - instanced flash quads blinking on the bleachers
  - 4 floodlight towers with emissive heads
  - 7 rivals (Xbot clones in black matte material) in lanes 1–3 and 5–8
  - red track `#c0392b`, white light `#ffffff`, no fog
  - hope forced to 1.3 with contrast 1.15
  - crowd hum
- **Beats:**
  1. Slow camera push-in with the caption: "OLYMPIC FINAL — 100M — LANE 4 — T. WARD (GBR) — 9.81 PB".
  2. "On your marks." ... "Set." ... a random delay of 1.2–2.5 s ... *BANG* (screen flash plus gun crack). The player presses Space and the reaction is shown, e.g. "0.142".
     - Pressing early is a false start and restarts the beat: *"Again. You've done this a thousand times."*
  3. Alternate A/D. The speed depends on cadence and has a floor of 6 m/s, so there is no fail state.
     - Splits show at every 10 m.
     - The camera is low, with FOV widening from 55 to 75.
     - Rivals are always behind Theo: `d_rival = d_theo * k_lane`, with k between 0.88 and 0.96.
     - Lines: at 10 m *"Drive. Drive."*, at 30 m *"Thirty. Upright now."*, at 45 m *"Nobody's there. Nobody's even close."*
  4. **At 60 m:**
     - input dies, audio cuts to silence, `timeScale` drops to 0.1
     - the camera rolls 25° and drops to 0.3 m, so the ground rises
     - Theo's model pitches forward
     - hope drains from 1.3 to 0 over 2 s
     - one dull snap plays
     - centred text: *"It sounded like someone stepping on a branch. I remember thinking: who brought a branch?"*
- **Advance:** fade to black, then the present day. Theo lies on the grey, condemned lane 4: *"Get up. Nobody's watching. That's the one good thing."* He stands after a short fade.

### Ch4 "Nobody's Lane": Harlow Park track, two days
- **Mood:**
  - hope 0.2 → 0.65
  - sky lerps from `#7d8a99` to `#c98a5e` with hope
  - fog density falls from 0.035 (Day 1) to 0.02 (Day 6)
  - painRate 1/1.5 s on Day 1, 1/3 s on Day 6
- **Dressing:**
  - a reddish-brown track with a noise CanvasTexture
  - a rusted SCHOOL RECORDS board
  - a broken bleacher
  - weeds (SHOULD)
- **Card "Day 1".** Mila is at the lane-4 start, and talking to her is required.
  - **Mila:** "You're in my lane." / **Theo:** "It's a condemned track. It's nobody's lane." / **Mila:** "Then you're in nobody's lane. Move."
  - She runs 100 m (14.1 s). Her phone dies.
  - **Mila:** "Ugh. Did you see what that was?" / **Theo:** "Fourteen point one." / **Mila:** "You *timed* me? Who carries a stopwatch?" / **Theo:** "Old habit." / **Mila:** "Fine. Then you can time me tomorrow."
  - **Correction** (she watches her feet):
    - **[Eyes up. Look at the line, not the ground.]** → "...Huh." (+0.15)
    - [Run faster.] → "Wow. Genius. Thanks, coach."
    - [Looked good!] → "Liar."
    - Wrong answers loop back to the menu. Hope ends at 0.35.
- **Card "Day 6".** Mila is at the record board, which reads "100M — T. WARD — 10.21 — **2015**" (continuity fix).
  - **Mila:** "T. Ward. That's you, isn't it? You're the guy who fell over on TV." / **Theo:** "I didn't fall over. My tendon..." (pause) "Yeah. I'm the guy who fell over." / **Mila:** "Ten point two one. That's not even that fast." / **Theo:** "I was sixteen." / **Mila:** "I'm thirteen. Give me three years."
  - **The laugh:**
    - +0.15 hope in one hit
    - a warm pulse
    - a radial colour focus on Mila only (shader `uFocus`), which decays over 4 s
    - *"When did I last do that?"*
  - She runs (13.6 s).
  - **Correction** (her arms cross her body):
    - **[Arms straight. Front to back. Cheek to pocket.]** (correct)
    - [Pump harder.] → "I'm pumping. Look at me pump."
    - [Don't use your arms.] → "...Are you sure you were a sprinter?"
  - Merged Day-11 lines:
    - Her phone dies again. **Mila:** "Nobody's ever timed me before. Like, on purpose."
    - **Mila:** "Does it hurt? The leg." / **Theo:** "Every step." / **Mila:** "So why do you come here every day?" / **Theo:** "...I don't know yet."
    - **Mila:** "They're knocking it down after Saturday. Regionals are the last thing here. I'm in the hundred." / **Theo:** "Who's your coach?" / **Mila:** "...You, kind of. Don't make it weird."
    - **Theo (inner):** *"Coach. I tried the word on. It was the wrong size. Not by much."* Hope ends at 0.65.
- **Advance:** text card "Saturday."

### Ch5 "Sixty Metres": Last Meet, then the final walk
- **Mood:**
  - hope 0.75 → 1.0
  - sun `#f2c879`, sky `#9ccbe8`
  - fog density 0.005, warm tint
  - painRate 1/6 s
- **Dressing:**
  - a "HARLOW PARK — LAST MEET" banner
  - 10 tinted spectator clones
  - 6 juniors at 0.8× scale
  - bunting (SHOULD)
- **Beats:**
  - **Ray (SHOULD):**
    - **Ray:** "Heard someone's been timing at Harlow."
    - **Theo:** "Someone has to. The clock doesn't care who you are."
    - **Ray:** "Turns out you can care for it."
  - **Objective "Find a place to watch."** The only glow is the 60 m mark beside lane 4: *"Sixty metres. Of course it's sixty metres."*
  - **Race:**
    - When Mila reaches 55 m, a shrinking CSS ring appears. Space inside the window shouts **DRIVE!**
    - A hit gives a final time of 12.87 and a miss gives 12.98. Either way she finishes third, behind juniors at 12.60 and 12.75.
    - Afterwards: *"Sixty metres. Someone else's legs. My race."*
  - **Finish:** she walks back to him.
    - **Mila:** "Third. Twelve point nine. Did you see? Did you *see*?" / **Theo:** "I saw."
    - **Mila:** "That's a PB. That's my PB." / **Theo:** "That's everyone's PB, the first time."
    - **Mila:** "That doesn't make sense." / **Theo:** "It will."
    - She leaves.
  - **Last walk:**
    - Fade to late-afternoon gold, with the crowd removed.
    - Theo stands at the lane-4 start. The pain bar is hidden and the objective reads "Walk."
    - Jogging is allowed and pain is capped at 0.9. The first jog says *"That's enough. That's plenty."*
    - At 60 m, hope goes to 1.0 with *"This is where the old life ended. I keep waiting for it to hurt more than it does."* If he was jogging, the line is instead *"Look at that. Still standing."*
  - **At the finish (z = −100):**
    - Input freezes and the camera cranes up over 8 s.
    - *"Nine point eight one seconds. I used to think that was all of me."* / *"Turns out it was just the fastest part."* / *"The rest takes longer."*
    - The HUD stopwatch shows `9.81` with the prompt "[E] Reset". Space does nothing. E sets it to `0.00`.
    - Fade to white.

### Ending cards
> Harlow Park was demolished that November.
> The following spring, Mila Reyes ran 12.4.
> Theo Ward held the watch.

After that come `0.00`, then **9.81**, then "Thank you for playing." with a **[Play again]** button.

### Pain stumble lines
Lines are drawn from a shuffled bag, with no repeats until all have played. The first stumble is fixed as above.
- "Not yet."
- "Maybe not ever."
- "Walk. Just walk."
- "Eight months, and it still remembers."

## Tech stack (decided)

| Item | Choice |
|---|---|
| Runtime | Node v24, which satisfies vite 8.3.3's `^20.19.0 \|\| >=22.12.0` |
| Bundler | **vite ^8.3.3**, with a hand-written package.json (no `npm create`) |
| 3D | **three ^0.186.1** (r186). Addons come from `three/addons/...js` (the `.js` extension is required) |
| Language | Plain JS ES modules, no TypeScript |
| Renderer | `WebGLRenderer` + `EffectComposer`: `RenderPass → ShaderPass(MoodShader) → OutputPass`. No bloom in MUST |
| Tone mapping | `ACESFilmicToneMapping`, default `SRGBColorSpace`, `PCFShadowMap` (the default) |
| Timing | `THREE.Timer`, not the deprecated Clock. Call `timer.connect(document)` and clamp dt to 1/20 s |
| Sky | A gradient sphere `ShaderMaterial` (top and bottom colour uniforms). No HDRI |
| Lights | `HemisphereLight` + one shadowed `DirectionalLight` + `FogExp2` + a few PointLights |
| Physics | None. Rectangle bounds per scene |
| UI | HTML/CSS overlay with system font stacks. No web fonts |
| Audio | Procedural WebAudio only |

```json
// package.json
{ "name": "nine-eighty-one", "private": true, "type": "module",
  "scripts": {
    "setup:assets": "curl -fL --create-dirs -o public/models/Xbot.glb https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/Xbot.glb",
    "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "three": "^0.186.1" },
  "devDependencies": { "vite": "^8.3.3" } }
```
```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({ server: { port: 5173, strictPort: true }, build: { target: 'es2022', chunkSizeWarningLimit: 1500 } });
```

## Assets

| Asset | URL | License | Use |
|---|---|---|---|
| Xbot.glb (2,930,032 B; clips `agree, headShake, idle, run, sad_pose, sneak_pose, walk`; faces +Z; metre scale) | `https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/Xbot.glb` (mirror: `https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/Xbot.glb`) | Mixamo/Adobe terms: free to use in games, but the raw files must not be redistributed. Fine for a private demo. Credit "model from mixamo.com" in the console and on the end card. **Before any public release** swap to Kenney Mini Characters (CC0, `https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip`, which needs its `Textures/colormap.png` next to the GLBs). | Every character, via `SkeletonUtils.clone` with cloned and tinted materials. Theo is a dark navy body. Mila is at 0.8× in warm orange. The stranger is grey. Rivals are black matte. Ray is olive. Spectators get random muted tints and juniors are 0.8×. Only the `idle`, `walk` and `run` clips are used. |

- The asset is downloaded once with `npm run setup:assets` into `public/models/Xbot.glb`. It is not a predev hook.
- Code loads it with the path `import.meta.env.BASE_URL + 'models/Xbot.glb'`.

**Procedural (everything else):**
- all geometry: rooms, buildings, track, lanes, bleachers, towers, fence, props
- CanvasTextures for the billboard, signs, record board, banner, lane numbers and track noise (each sets `tex.colorSpace = THREE.SRGBColorSpace`)
- the sky shader
- all audio: heartbeat, gun crack, snap, crowd hum, mood drone and rain noise

**Failsafe:** if the GLB fails to load, each character becomes a `CapsuleGeometry` placeholder with no mixer, and the story still plays.

## Project file tree

```
demo/
  index.html            # <canvas id="c">, <div id="ui">, <script type="module" src="/src/main.js">
  package.json  vite.config.js  .gitignore (node_modules, dist)
  public/models/Xbot.glb
  src/
    main.js             # WebGL check, boot, loading, title, query flags, window.__game
    core/Engine.js      # renderer, scene, camera, Timer, loop, resize, pause, timeScale, wait()
    core/Input.js       # code-based key state + per-frame edge set, hold() for debug
    core/Assets.js      # LoadingManager, GLTFLoader, makeCharacter(tint, scale) via SkeletonUtils, capsule fallback
    core/Audio.js       # WebAudio: master gain (M), drone(hope), heartbeat, gun, snap, crowd, rain
    render/MoodShader.js
    render/Mood.js      # hope target/current damping -> uniforms, sky, fog, tint; pulse(), flash(), focus()
    render/Sky.js       # gradient sphere
    player/Player.js    # limp locomotion, pain, stumble, bounds, crouch/fall poses
    player/FollowCam.js # fixed offset follow, shake/dip, tween(to, dur), roll, fov
    world/build.js      # apartment(), street(), track(dressing), sign(text,...), instanced helpers
    world/Hotspots.js   # proximity + E, ring markers, prompt, required highlight, zones
    world/Runner.js     # straight-lane NPC runner (time-target profile) + walker
    story/script.js     # ALL text
    story/Director.js   # linear chapter runner, gates, skip(), hope schedule helpers
    story/ch1.js ch2.js ch3.js ch4.js ch5.js
    ui/UI.js            # loading, title, fade, cards, dialogue, choices, objective, prompt, pain bar,
                        # reaction, drive ring, splits, stopwatch HUD, pause, end, warnings
    ui/style.css
```

## Build steps, module by module, in order

1. **Scaffold.** Write `package.json`, `vite.config.js`, `.gitignore` and `index.html`, then run `npm install` and `npm run setup:assets`.
2. **`Engine.js`:**
   - Detect WebGL with `!!window.WebGL2RenderingContext` and try/catch around `new WebGLRenderer`. On failure, show the opening text plus "This demo needs WebGL."
   - Listen for `webglcontextlost` and show a reload card.
   - Cap the pixel ratio at 2, or 1.5 on `(pointer:coarse)`.
   - Use a `PerspectiveCamera` with fov 55 and far 600.
   - Keep `paused` (Esc or `visibilitychange`) and `timeScale` flags.
   - `wait(sec, {scaled=false})` runs on loop-driven timers, not setTimeout, so pausing works.
   - Loop order: input → director → player → runners → camera → hotspots → mood → `composer.render` → input.endFrame.
3. **`Input.js`:**
   - Track `down` (a Set of codes) and `pressed` (codes pressed this frame, ignoring `e.repeat`).
   - `axes()` maps W/↑ to z = −1, S/↓ to z = +1, A/← to x = −1 and D/→ to x = +1.
   - Call `preventDefault` for Space and the arrow keys.
   - Store the keydown timestamp for each press, for reaction timing.
   - `hold(code, ms)` drives the debug hook.
4. **`Assets.js`:**
   - Load Xbot once and get `clips` by name.
   - `makeCharacter({tint, scale})` clones the model, clones each material and sets its colour, enables shadows and normalises height to 1.8 m × scale using a `Box3`. It returns `{root, mixer, actions:{idle,walk,run}, play(name, fade)}`.
   - On error it returns the capsule fallback.
5. **`MoodShader.js`, `Mood.js` and `Sky.js`** (code sketch below). The hope target is moved with `damp`. Presets per chapter cover sky top/bottom, fog colour/density, hemisphere and directional colours, tint override and contrast.
6. **`UI.js` and `style.css`:**
   - All DOM is created in JS.
   - Dialogue has a speaker name and types at 40 chars/s.
   - E skips the typing, then advances. Inputs are ignored for 150 ms after a box opens, and a single `busy` guard prevents re-entry.
   - `choices(opts)` returns a Promise resolving to an index, from keys 1–3 or clicks.
   - `card(lines, {skippable})`, `fade(to, dur, color)`, `objective(t)`, `prompt(t)`, `pain(v, visible)`, `caption(t)`, `splits(t)`, `reaction(ms)`, `driveRing()` (returns a Promise of `{hit, error}`), `stopwatch(text|null)`.
   - Title screen with the controls list, a pause overlay (Resume, Restart), the mobile warning with "continue anyway", and the end card with Play again (`location.reload()` without query flags).
7. **`Audio.js`:**
   - `AudioContext` is resumed by the title click.
   - The master gain is toggled with M.
   - `drone`: two detuned saws through a lowpass whose cutoff is `300 + 1500*hope`.
   - `heartbeat()`: two decaying sines at 55 Hz.
   - `gun()`: a highpassed white-noise burst, 80 ms.
   - `snap()`: a bandpass noise click at 1.8 kHz, 40 ms.
   - `crowd(on)`: looped brown noise through a lowpass at 600 Hz.
   - `rain(on)`: looped highpassed noise.
   - `cut()`: ramps everything to 0 in 50 ms.
8. **`Player.js` and `FollowCam.js`** (sketch below). The camera follows a fixed world offset, `(0, 2.6, 4.2)` outdoors and `(0, 3.4, 3.6)` in the apartment, lerped with `1-exp(-6dt)`. It supports `tween({pos, look, fov, roll}, dur)` for cinematics, and `dip()` for stumbles.
9. **`Hotspots.js`:**
   - `add({id, pos, radius=1.6, prompt, required, enabled:()=>bool, once=true, onInteract})`.
   - Each spot gets a ground `RingGeometry(0.45, 0.55)` in `MeshBasicMaterial({color:0xffe9b0, transparent, toneMapped:false})` that pulses. Required spots are brighter and taller.
   - The nearest enabled spot shows `[E] prompt`. E fires `onInteract` only when the director state is `play`.
   - `waitFor(id)` returns a Promise.
10. **`build.js`:**
    - `apartment()`, `street()` (buildings from 14 instanced boxes, 6 lamp posts with 3 PointLights, a fence of thin boxes plus a semi-transparent mesh plane with a gap) and `track({dressing})`.
    - The track has 8 lanes 1.22 m wide. Lane i has centre `x=(i-4.5)*1.22`, so lane 4 is at −0.61. The start line is at z = 0 and the finish at z = −100, with lane lines on a CanvasTexture repeated along Z.
    - Dressings:
      - `'condemned'`: brown noise surface, board, broken bleacher
      - `'olympic'`: red surface, instanced bleachers, towers, flash quads
      - `'meet'`: condemned surface plus banner and spectators
    - `sign(text, w, h, {bg, fg, font})` returns a plane with a CanvasTexture.
    - Each builder returns `{group, bounds:[rects], spots:{...positions}}`, and `disposeGroup` traverses the group and disposes geometries, materials and textures.
11. **`Runner.js`:**
    - `run(char, {laneX, T, startZ=0})` uses the profile `v(t)=vmax(1-e^{-t/τ})`, with τ = 1.2 and `vmax = 100/(T-τ(1-e^{-T/τ}))`. Position is `z = -[vmax(t-τ(1-e^{-t/τ}))]`.
    - The run clip's `timeScale` is `clamp(v/5, .6, 1.6)`, and the promise resolves at 100 m.
    - `retime(newT)` sets a constant v for the remaining distance, used for the DRIVE result.
    - `walkTo(char, pos, speed=1.4)` handles the stranger leaving and Mila returning.
12. **`script.js`:** every line from the Story section, as `{who, text}` arrays keyed per beat, plus correction menus `{prompt, options:[{text, correct, reply}]}`.
13. **`Director.js`** (sketch below), then **`ch1`–`ch5`**, in that order. Playtest each one through `?chapter=N` before starting the next.
14. **`main.js`:**
    - Parse `?debug`, `?chapter`, `?autostart` and `?skipcards`.
    - Run the loading bar, then the title ("9.81", tagline, controls, "Click to begin"; the click resumes audio).
    - Show the opening card, then `director.start(chapter)`.
    - Expose `window.__game`.

## Key code sketches

```js
// render/MoodShader.js — runs in linear HDR before OutputPass
export const MoodShader = {
  uniforms: { tDiffuse:{value:null}, uSat:{value:0.05}, uTint:{value:new THREE.Vector3(1,1,1)},
    uContrast:{value:1}, uVignette:{value:0.45}, uPain:{value:0}, uFlash:{value:0},
    uFocus:{value:0}, uFocusPos:{value:new THREE.Vector2(.5,.5)}, uAspect:{value:1} },
  vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float uSat,uContrast,uVignette,uPain,uFlash,uFocus,uAspect;
    uniform vec3 uTint; uniform vec2 uFocusPos; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
      vec2 f=(vUv-uFocusPos)*vec2(uAspect,1.); float m=uFocus*(1.-smoothstep(.08,.28,length(f)));
      float s=mix(uSat,1.1,m);                                   // colour returns around Mila first
      vec3 col=mix(vec3(l),c,s)*uTint; col=(col-.18)*uContrast+.18;
      vec2 d=vUv-.5; float v=smoothstep(.15,.6,dot(d,d)*2.);
      col*=1.-uVignette*v; col=mix(col,vec3(.6,0.,0.),uPain*v*.8);   // red pain vignette
      col=mix(col,vec3(1.),uFlash); gl_FragColor=vec4(max(col,0.),1.); }` };
```

```js
// render/Mood.js (core)
const COOL=new THREE.Vector3(.86,.93,1.08), GOLD=new THREE.Vector3(1.08,1.0,.86), NEUTRAL=new THREE.Vector3(1,1,1);
update(dt){ this.hope=damp(this.hope,this.target,this.lambda,dt);
  const u=this.pass.uniforms; u.uSat.value=this.hope;
  u.uTint.value.copy(this.preset.neutralTint?NEUTRAL:COOL).lerp(GOLD, this.preset.neutralTint?0:clamp(this.hope,0,1));
  u.uContrast.value=damp(u.uContrast.value,this.preset.contrast??1,3,dt);
  u.uFlash.value=Math.max(0,u.uFlash.value-dt*2); u.uFocus.value=Math.max(0,u.uFocus.value-dt*.25);
  u.uPain.value=this.player.pain**2;
  this.sky.lerpColors(this.preset.skyLow,this.preset.skyHigh,clamp(this.hope,0,1)); this.audio.drone(this.hope); }
set(h,{snap=false,lambda=1.5}={}){ this.target=h; this.lambda=lambda; if(snap) this.hope=h; }
add(d){ this.set(this.target+d); }  pulse(d){ this.add(d); this.pass.uniforms.uFlash.value=.25; }
drain(to,secs){ this.lambda=4.6/secs; this.target=to; }   // ~99% in secs (Ch3 1.3 -> 0 over 2 s)
focusOn(obj){ /* project obj world pos -> NDC -> uFocusPos each frame while uFocus>0 */ this.pass.uniforms.uFocus.value=1; }
```

```js
// player/Player.js (core)
update(dt){
  const inp=this.locked>0?{x:0,z:0}:this.input.axes(); this.locked-=dt;
  const moving=inp.x||inp.z, jog=moving&&this.input.down.has('ShiftLeft')||this.input.down.has('ShiftRight');
  if(this.frozen||!moving){ this.anim('idle'); this.pain=Math.max(0,this.pain-dt*.5); return this.mix(dt); }
  const jogging=jog&&this.canJog;
  this.pain = jogging ? this.pain+this.painRate*dt : Math.max(0,this.pain-dt*.35);
  if(this.painCap) this.pain=Math.min(this.pain,this.painCap);
  if(this.pain>=1) return this.stumble();          // locked=1, cam.dip(), audio.heartbeat(), ui line from bag, pain=.6
  const speed=jogging?2.6:1.3*THREE.MathUtils.lerp(1,.85,this.limp);
  _d.set(inp.x,0,inp.z).normalize(); this.tryMove(_d.x*speed*dt,_d.z*speed*dt);   // per-axis vs bounds rects
  this.root.rotation.y=dampAngle(this.root.rotation.y,Math.atan2(_d.x,_d.z),10,dt); // Xbot faces +Z
  this.anim(jogging?'run':'walk');
  const a=this.actions.walk, ph=(a.time/a.getClip().duration)%1;
  a.timeScale=THREE.MathUtils.lerp(1,ph<.5?.85:1.1,this.limp);                      // uneven step timing
  this.model.position.y=-this.limp*.05*(.5+.5*Math.sin(ph*Math.PI*2));              // one dip per cycle = bad leg
  if(jogging) this.actions.run.timeScale=.75; this.mix(dt); }
tryMove(dx,dz){ const p=this.root.position;
  if(this.inBounds(p.x+dx,p.z)) p.x+=dx; if(this.inBounds(p.x,p.z+dz)) p.z+=dz; }
inBounds(x,z){ return this.bounds.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ); }
```
Per-chapter limp: Ch1 1.0, Ch2 0.9, Ch4 0.7 then 0.6, Ch5 0.5 then 0.4 on the final walk. It never reaches 0. `painRate` is `1/secondsToMax`.

```js
// story/Director.js — linear async chapters, a skippable gate for every await
export class Director {
  constructor(ctx, chapters){ Object.assign(this,{ctx,chapters,index:-1,state:'boot',_skip:null,flags:new Set()}); }
  gate(promise){ return new Promise(res=>{ this._skip=res; promise.then(res); }).finally(()=>this._skip=null); }
  skip(){ this._skip?.('skipped'); }                                  // debug: resolves current wait/card/dialogue/hotspot
  wait(s){ return this.gate(this.ctx.engine.wait(s)); }
  card(lines,o){ return this.gate(this.ctx.ui.card(lines,o)); }
  async say(lines){ this.state='dialogue'; this.ctx.player.frozen=true;
    try{ return await this.gate(this.ctx.ui.dialogue(lines)); } finally{ this.ctx.player.frozen=false; this.state='play'; } }
  async correct(menu){ for(;;){ const i=await this.gate(this.ctx.ui.choices(menu)); const o=menu.options[i]??menu.options.find(o=>o.correct);
    if(o.reply) await this.say([{who:'Mila',text:o.reply}]); if(o.correct) return; } }
  interact(id){ this.state='play'; return this.gate(this.ctx.hotspots.waitFor(id)); }
  async start(i){
    for(this.index=i; this.index<this.chapters.length; this.index++){
      const ch=this.chapters[this.index]; this.state='transition'; await this.ctx.ui.fade(1,.8);
      this.ctx.world.load(ch.build(this.ctx));            // disposes previous group, sets bounds, preset, spots
      this.ctx.player.configure(ch.player); this.ctx.mood.applyPreset(ch.preset); this.ctx.mood.set(ch.hope,{snap:true});
      this.ctx.ui.objective(ch.objective); await this.ctx.ui.fade(0,1.2); this.state='play';
      await ch.run(this.ctx,this);                        // the chapter's beats, top to bottom
    }
    this.state='end'; await this.ctx.ui.endCard(); }
}
// story/ch1.js (shape)
export default { id:'apartment', hope:.05, preset:P.apartment, objective:'Look around.',
  player:{spawn:[0,0,1.5], limp:1, painRate:1/.6, canJog:true, bounds:'room'},
  build:ctx=>build.apartment(ctx),
  async run(ctx,d){ const {hotspots:h,mood:m,ui}=ctx;
    h.add({id:'tv',pos:S.tv,prompt:'Watch',onInteract:async()=>{ await d.say(L.ch1.tv); ctx.world.tvOff(); m.add(.01); }});
    h.add({id:'phone',pos:S.phone,prompt:'Check phone',onInteract:async()=>{ await d.say(L.ch1.phone); m.add(.01); }});
    h.add({id:'watch',pos:S.watch,prompt:'Take the stopwatch',required:true,onInteract:async()=>{
      await d.say(L.ch1.watch); ui.stopwatch('9.81'); await d.say(L.ch1.neverReset); ui.stopwatch(null); }});
    ctx.engine.after(10,()=>!ctx.player.hasJogged&&ui.hint('Hold Shift to jog'));
    await d.interact('watch'); ui.objective('Leave.');
    h.add({id:'door',pos:S.door,prompt:'Leave',required:true}); await d.interact('door');
    m.set(.08); await ctx.ui.fade(1,1.5); await d.say(L.ch1.voicemail); } };
```

```js
// ch3 sprint core (in run()): rhythm -> speed, rivals always behind, 60 m snap
let d=0,v=0,last=null,hits=[]; ctx.cam.mode='sprint';
while(d<60){ const dt=await ctx.engine.frame();               // resolves each frame with dt
  for(const k of ['KeyA','KeyD']) if(ctx.input.pressed.has(k)&&k!==last){ last=k; hits.push(ctx.engine.now); }
  hits=hits.filter(t=>ctx.engine.now-t<1); const target=6+Math.min(hits.length,9)/9*5.8;
  v=damp(v,target,3,dt); d+=v*dt; theo.root.position.z=-d; rivals.forEach(r=>r.root.position.z=-d*r.k);
  ctx.cam.fov(55+20*(v/11.8)); splitsAt10m(d); linesAt(d); }
ctx.input.enabled=false; ctx.audio.cut(); ctx.engine.timeScale=.1; ctx.audio.snap();
ctx.mood.drain(0,2); ctx.cam.tween({roll:.44, pos:[-0.61,.3,-56], look:[-0.61,.2,-62]},2); theo.fallForward(2);
await d.wait(2.2); await d.card([L.ch3.branch],{centered:true}); ctx.engine.timeScale=1; ctx.input.enabled=true;
```

## Scope

**MUST:**
- the stack above, with Xbot as the only external asset and the capsule fallback
- the MoodShader saturation pass, with tint (cool to gold), contrast, vignette, pain vignette, flash and Mila focus; no bloom
- the gradient sky, hemisphere light, shadowed directional light and FogExp2 presets
- the limp, pain meter, stumble bag and fixed follow camera
- Ch1: TV, phone and the required stopwatch, the "Never reset it" beat, the pain tutorial, the door and the voicemail
- Ch2: billboard, stranger (turns, speaks, leaves), fence sign and lane-4 crouch
- Ch3: complete
- Ch4: Day 1 and the merged Day 6, with the laugh and focus pulse
- Ch5: the 60 m spot, DRIVE ring, PB dialogue, final walk, crane-up and stopwatch reset
- the end cards, including `0.00`, and Play again
- one Runner system serving Mila, the rivals, the juniors and the stranger
- the full UI list from step 6; Space is never used for dialogue
- procedural audio and the M mute
- the no-WebGL card, context-lost card and mobile warning
- Esc pause and visibility pause
- skippable cards
- debug hooks
- all text in `script.js`

**SHOULD, in this order:**
1. A third Ch4 day (Day 11 split back out, 13.2 s) and an optional rehab lap with a lower painRate.
2. Ray in Ch5.
3. `UnrealBloomPass` only in Ch3 (strength 0.6, threshold 0.9), inserted before the MoodShader.
4. Apartment window rain streaks and a scrolling TV news ticker CanvasTexture.
5. The extra hotspots: rehab sheet, shoebox, shop window and bench.
6. Instanced weed cones, bunting and a crack texture.
7. The `sad_pose` additive despair posture in Ch1–2, only if it works on the first try.

**CUT:**
- the Poly Haven fetch script, md5 checks, CREDITS generator and predev hook
- HDRIs and environment swaps
- Soldier, Michelle and all Poly Haven or Kenney props
- the orbit, drag and pointer-lock camera, and camera-relative movement
- the oval path follower
- additive emotes (`agree`, `headShake`)
- film grain
- CSS `filter: saturate`
- circle colliders
- touch controls
- save, settings and chapter select in release builds
- lip-sync, branching and voice

## Debug hooks (required for verification)
- `?debug=1` exposes `window.__game = { ready, director, player, mood, renderer, input, engine, debug:{ goto(i), skip(), hold(code,ms), setHope(h), teleport(x,z) } }`.
  - `ready` is a Promise that resolves once the first chapter reaches `play`.
  - `goto(i)` reloads to `?debug=1&autostart=1&skipcards=1&chapter=i`, so beats never need cancelling.
- `?chapter=N` (0–4) starts at that chapter.
- `?autostart=1` bypasses the title, keeping audio muted until a real click.
- `?skipcards=1` skips text cards automatically.

## Verification
1. **Setup:** in `/Users/fjanicki/workspace/ai/demo`, run `npm install` and then `npm run setup:assets`. `ls -l public/models/Xbot.glb` should show 2,930,032 bytes.
2. **Build:** `npm run build` must finish with no errors. A chunk-size warning is fine. Then `npm run preview` should load.
3. **Dev server:** run `npm run dev` in the background and wait for `Local: http://localhost:5173/`.
4. **Browser checks** (chrome-devtools MCP; fall back to firefox-devtools; with headless WebGL use `--use-angle=swiftshader --enable-unsafe-swiftshader`). For each N in 0..4:
   - Navigate to `http://localhost:5173/?debug=1&autostart=1&skipcards=1&chapter=N`.
   - Evaluate `await __game.ready; return {state:__game.director.state, ch:__game.director.index, hope:__game.mood.hope, calls:__game.renderer.info.render.calls}`. Expect `state:'play'`, `ch===N`, calls > 0 and < 200.
   - Take a screenshot and check:
     - Ch1 is a nearly grey room with blue TV light.
     - Ch2 is a foggy street with amber lamps.
     - Ch3 is a red, oversaturated stadium with rivals.
     - Ch4 is a dusk track with an orange Mila.
     - Ch5 is golden, with a crowd.
5. **Movement:** read `player.root.position`, run `__game.debug.hold('KeyW',1000)`, and check that z went down by about 1.1–1.3. Holding `ShiftLeft`+`KeyW` for 1500 ms in Ch1 must trigger a stumble: the line is visible and `player.locked > 0`.
6. **Interaction:** in Ch1, teleport to the stopwatch and press E. `#dialogue` should be visible. Then call `debug.skip()` repeatedly and confirm the flow reaches Ch2 (`director.index===1`).
7. **Flashback:**
   - In Ch3, call `skip()` through the marks. Send a Space press and confirm the reaction text shows.
   - Alternate `hold('KeyA',60)` and `hold('KeyD',60)` in a loop. The splits should appear, and at 60 m `engine.timeScale===0.1` and hope falls toward 0.
   - In Ch5, take a screenshot of the DRIVE ring, then skip to the end card and check the "Play again" button.
8. **Errors:** `list_console_messages` must show no errors and no deprecation warnings (no Clock or PCFSoftShadowMap warnings). `list_network_requests` must show no 404s, and `/models/Xbot.glb` must return 200.
9. **Fallback:** temporarily block `Xbot.glb` (request blocking in devtools) and confirm capsules appear and Ch1 still plays.
10. **Manual playthrough:** play from the title to the end, about 8–10 minutes. Check that hope follows the schedule (0.05 → 0.08 → 0.15 → 1.3/0 → 0.2 → 0.35 → 0.65 → 0.8 → 1.0) and that M, Esc and the card skip all work.