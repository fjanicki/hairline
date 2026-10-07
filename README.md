# HAIRLINE

*The crack was thinner than a hair. It went all the way through.*

A short (about 11–12 minutes) narrative 3D game that runs in the browser. Hugo Revel spent twelve
years as a professional cyclist, pulling other men up mountains, then took up running and never
stopped. Last week his watch read 212.4 km. At kilometre 31 of a marathon his left tibia cracked
along a hairline; he finished the race. Now it is twelve weeks in a walking boot, no impact, and
the hammering through the floor at night belongs to Odile, a retired sign painter with a repair
workshop downstairs.

The game is about expanding what he is able to do: sanding a door, mixing a grey that isn't sad,
truing a kid's wheel, lettering a sign, painting one line under a street mural. A "WHAT I CAN DO"
notebook grows with every skill. Colour is hope, and the colour comes back first on the things he
makes. The look is grimy on purpose: film grain, lens dirt, rust, stains and wet streets.

Built with Three.js r186 and Vite 8, as plain JavaScript ES modules (no framework). The story
text, chapter beats and mood values come from `docs/DESIGN.md`. The internal APIs are documented
in `docs/API.md`.

## Running it

Requires Node 20.19+ or 22.12+, plus `curl` and `unzip` for the asset fetch.

```bash
npm install
npm run setup:assets   # fetches the CC0 characters, props, materials, HDRIs and audio into public/assets/
npm run dev            # http://localhost:5173
```

`public/assets/` is not in git. `npm run setup:assets` (`scripts/fetch-assets.sh`, which also runs
`scripts/assets/*.sh`) downloads every source once into `.cache/dl/`, then copies or rebuilds only
the files the game uses (about 92 MB). It is safe to re-run: cached downloads are skipped and
anything no longer used is removed. The game still plays if a file is missing (grey boxes, flat
colours, no IBL), just uglier.

`npm run build` writes a static production build to `dist/`. `npm run preview` serves that build.

## Visuals

Grounded, semi-realistic and grimy, slightly stylised so everything reads as one world:

- **Lighting:** ACES tone mapping, an HDRI per chapter for image-based light (Poly Haven), soft
  PCF shadows, ground-truth ambient occlusion (GTAO), bloom on practical lights (sodium lamps,
  the CRT, the workshop bulb), soft light cones and drifting dust where light passes.
- **Surfaces:** 23 PBR material sets (brick, render, concrete, wet asphalt, cobbles, worn wood,
  rust, plaster...) mapped in world space, with shared weathering (grime, leaks, splash-back dirt,
  puddles) driven by each chapter's weather. Recipes live in `src/world/look.js`, so the Ch2 and
  Ch5 street is built from the same materials, wet at dusk and drying at golden hour.
- **Characters:** the Quaternius modular cast with consistent outfits across chapters (Hugo's blue-grey
  shirt and an off-white walking boot with black Velcro, Odile's ochre canvas apron, Sami's red top,
  the STRIDE run club in hi-vis with reflective bands). The fantasy outfit atlas is toned down in the
  shader (trims, toggles and corsets fade, boot shafts read as trouser legs, fabric heather and hem
  grime), runners get garment panels, trims and trainers over the athletic body, and Odile's face is
  aged. The jog is the library clip with a shortened stride, so feet stay planted at 3-6 m/s.
- **Props:** photo-scanned Poly Haven hero props up close; procedural bicycles, signs, facades and
  the mural; a few restyled Kenney pieces as distant filler.
- **The grade (colour is hope):** a post shader keeps the world near-grey at low hope and lets
  colour back first on the things Hugo makes (four focus slots), with film grain, lens dirt and a
  tinted vignette. Ch1 is almost monochrome, the Ch3 flashback is cold and saturated, Ch4 warms up,
  and Ch5 ends in golden hour.

**Quality tiers** (`src/render/Quality.js`): picked from the GPU and screen size, switchable in the
pause menu (remembered per browser), or forced with `?quality=low|medium|high`.

| Tier | Pixel ratio | MSAA | AO | Bloom | Shadows |
|---|---|---|---|---|---|
| `low` | 1 | off | off | off | 1024 (and every material and prop texture at half size) |
| `medium` | ≤ 1.25 | 4× | half-res GTAO | on | 2048 |
| `high` | ≤ 1.5 | 4× | full-res GTAO + denoise | on, plus edge chromatic aberration | 2048, softer |

**Loading:** the loading bar covers the characters and everything the first chapter needs (its
material sets, HDRIs and props), weighted by download size: about 34 MB for Ch1. Later chapters
load behind the fade between chapters, and audio streams in on its own.

The game needs WebGL 2, a keyboard and a desktop-sized window. It shows a warning on small or
touch-only screens.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move, relative to the camera (W walks away from it); also steady a brush (lettering, the line) |
| Mouse | Click the 3D view to capture the mouse, then move it to look around Hugo. Without capture, hold the left or right button and drag |
| Mouse wheel | Zoom the camera in or out |
| R (or middle click) | Re-centre the camera behind Hugo |
| Shift | Try to jog (in the boot the pain meter fills; at full you stumble) |
| E (or Enter, or click) | Interact, advance dialogue and cards |
| Space | Timing prompts (truing a wheel) |
| A / D alternating | A steady rhythm (running in the flashback, sanding) |
| 1 – 3 | Choices |
| M | Mute |
| Esc | Pause (resume, restart the chapter, or Options). It also releases the captured mouse, in the same press |

**Options and language.** The game is in English or French (Français). Pick the language on the title
screen (the two buttons at the bottom), or later in **Options** (title screen, or Esc > Options), which
also holds the graphics quality. A switch applies at once, mid-chapter too (a line already on screen
finishes in the old language). The choice is remembered per browser; the first visit follows the
browser language. `?lang=en|fr` forces one.

The camera only answers the mouse while you are walking freely. In dialogue, menus, minigames
and cut-scenes the mouse is released and look input is ignored. When the next required spot is
off-screen or more than about 8 m away, a small chevron at the screen edge points to it and
shows the distance.

## Chapters

1. **No Impact.** Hugo's flat at night, boot day four. The watch on its charger, the X-ray, the rusting race bike, 38 race bibs, and the hammering through the floor.
2. **Never Stop.** Once round the block in the rain on Rue des Tanneurs. The run club jogs past. Odile on her scaffold: "Can you stand still?"
3. **The Long Run.** Flashback: training blocks at dawn, a steady cadence, STRIDE's "Rest" that is never real, and the marathon where the shin goes at KM 31.
4. **Measure Twice.** Odile's workshop, Day 5 to Week 7. Sanding, measuring, a grey that isn't sad, Sami's wheel, the OPEN sign. The notebook grows.
5. **The Wall.** Week 12. The neighbourhood paints a mural over the billboard; Hugo paints the line. The boot comes off; the watch goes on a nail.

## Debug flags

Add these as URL query parameters, for example
`http://localhost:5173/?debug=1&autostart=1&skipcards=1&chapter=3`.

| Flag | Effect |
|---|---|
| `debug=1` | Exposes `window.__game` (director, player, mood, engine, ui, ...). Collects console errors and warnings in `__game.errors` / `__game.warnings`. Keeps the loop running in a hidden tab. |
| `chapter=N` | Start at chapter N (0–4). |
| `autostart=1` | Skip the title screen. Audio stays silent until a real click or key press. |
| `skipcards=1` | Text cards close on their own, and chapter titles are not shown. |
| `quality=low\|medium\|high` | Force a quality tier (otherwise auto, or the pause-menu choice). |
| `lang=en\|fr` | Force the language (otherwise the Options choice, else the browser language). |

With `debug=1`, `__game.debug` provides:
- `skip()`: resolves whatever the story is waiting on.
- `goto(i)`: reloads at chapter `i`.
- `hold(code, ms)` and `press(code)`: simulate keys.
- `setHope(h)`, `teleport(x, z)` and `trigger(id)`.
- `lang(code?)`: reads or switches the language; `textLog`: every string the UI has shown (last 2000).
- `state()`: returns state, chapter, hope, position, pain, hotspots and draw calls.
- `advance(ms, {choose, step, spots, rhythm, key})`: autoplays for `ms` (advances dialogue, picks
  choice `choose`, triggers the next required hotspot, or taps a steady A/D rhythm or `key`).
  Resolves to the dialogue lines seen.
- `shot(holdMs)`: renders a fresh frame into an overlay image for `holdMs`, so a screenshot of a
  hidden or occluded window shows the current view instead of a stale frame.
- `look(yawDeg, pitchDeg, zoom)`: sets the camera view without a mouse. `yawDeg` is relative to
  the chapter's default view, `pitchDeg` is the camera's elevation; both are clamped like mouse
  look. `view()` returns the current look, the limits and the occlusion state. `pointer()` returns
  the objective pointer's state.

`__game.ready` resolves when the first chapter is playable.

## Project layout

```
src/
  main.js            boot, wiring, debug hooks
  core/              Engine (renderer, loop), Input, Assets, Audio (+ procedural sfx), Materials (PBR
                     library + world-space weathering)
  characters/        Quaternius cast: presets and clip/bone aliases (cast.js), loading and part
                     merging (CharacterKit.js), Character (play, bone, outfits, tint)
  render/            Mood (lights, fog, sky, grade, focus slots), MoodShader (grade + grain/dirt), Sky,
                     Post (composer: GTAO, bloom, grade), Environment (HDRIs), Quality (tiers)
  player/            Player (limp, walking boot, pain, stumbles), FollowCam (orbit + occlusion),
                     CameraRig (mouse look, per-chapter look limits)
  world/             look.js (art bible: surface recipes, per-chapter lighting, weather, asset lists),
                     build helpers (bicycle, grimeTexture, rain...), Hotspots, Runner,
                     scenes/scene1-5.js (+ a folder per scene for its kit, textures, fx)
  story/             Director (chapter flow), ch1-ch5.js, minigames.js (rhythm, timing, steer),
                     script.js + text/ (all player-facing text, one file per chapter)
  ui/                UI.js (all DOM overlays: watch, notebook, gauge, dialogue...), style.css,
                     ObjectivePointer.js (+ objective-pointer.css)
docs/                DESIGN.md (spec), API.md (internal API), CREDITS.md (every asset source),
                     assets/ (catalogues: characters, materials, props), asset-bounds.txt
scripts/             fetch-assets.sh, assets/<group>.sh (characters, materials, props)
```

## Credits and licences

Every third-party asset is **CC0**. `docs/CREDITS.md` lists each file and its source URL.

- **Characters and animations:** Quaternius (quaternius.com): Universal Base Characters,
  Universal Animation Library 1 and 2, and Modular Character Outfits - Fantasy.
- **Props, PBR materials and HDRIs:** Poly Haven (polyhaven.com).
- **Grime decals:** ambientCG (ambientcg.com).
- **Street pieces and footsteps:** Kenney (kenney.nl): City Kit Commercial, City Kit Roads, Retro
  Urban Kit, Survival Kit, Impact Sounds.
- **Music and ambience:** OpenGameArt.org: "Contemplation" by Joth, "Emotional piano loop" by
  extenz, "Rain (loopable)" by Ylmir and "Crowd Shouting/Speaking Ambience" by StarNinjas (pages and
  licences in `docs/CREDITS.md`).
- **Procedural:** bicycles, the walking boot, the watch, signs, facades, the mural and posters;
  the heartbeat, hammering, sanding, watch buzz, spoke pings, Velcro, snap and drone (WebAudio).
- **Code:** written for this project. Three.js is MIT-licensed.

The end card shows a short version of these credits.
