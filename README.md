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

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run setup:assets   # downloads the third-party models, props and audio into public/assets/
npm run dev            # http://localhost:5173
```

`npm run build` writes a static production build to `dist/`. `npm run preview` serves that build.

The game needs WebGL 2, a keyboard and a desktop-sized window. It shows a warning on small or
touch-only screens.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move; also steady a brush (lettering, the line) |
| Shift | Try to jog (in the boot the pain meter fills; at full you stumble) |
| E (or Enter, or click) | Interact, advance dialogue and cards |
| Space | Timing prompts (truing a wheel) |
| A / D alternating | A steady rhythm (running in the flashback, sanding) |
| 1 – 3 | Choices |
| M | Mute |
| Esc | Pause (resume or restart the chapter) |

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

With `debug=1`, `__game.debug` provides:
- `skip()`: resolves whatever the story is waiting on.
- `goto(i)`: reloads at chapter `i`.
- `hold(code, ms)` and `press(code)`: simulate keys.
- `setHope(h)`, `teleport(x, z)` and `trigger(id)`.
- `state()`: returns state, chapter, hope, position, pain, hotspots and draw calls.
- `advance(ms, {choose, step, spots, rhythm, key})`: autoplays for `ms` (advances dialogue, picks
  choice `choose`, triggers the next required hotspot, or taps a steady A/D rhythm or `key`).
  Resolves to the dialogue lines seen.
- `shot(holdMs)`: renders a fresh frame into an overlay image for `holdMs`, so a screenshot of a
  hidden or occluded window shows the current view instead of a stale frame.

`__game.ready` resolves when the first chapter is playable.

## Project layout

```
src/
  main.js            boot, wiring, debug hooks
  core/              Engine (renderer, post chain, loop), Input, Assets, Audio (+ procedural sfx)
  render/            Mood (lights, fog, sky, grade, focus slots), MoodShader (grade + grain/dirt), Sky
  player/            Player (limp, walking boot, pain, stumbles), FollowCam
  world/             build helpers (bicycle, grimeTexture, rain...), Hotspots, Runner, scenes/scene1-5.js
  story/             Director (chapter flow), ch1-ch5.js, minigames.js (rhythm, timing, steer),
                     script.js + text/ (all player-facing text, one file per chapter)
  ui/                UI.js (all DOM overlays: watch, notebook, gauge, dialogue...), style.css
docs/                DESIGN.md (spec), API.md (internal API), asset-bounds.txt
scripts/             fetch-assets.sh
```

## Credits and licences

- **Character model:** `Xbot.glb` from mixamo.com, via the three.js examples.
  **This model is Mixamo-licensed, not CC0.** It is fine for this internal demo. Before any
  public release, replace it with a model you have the rights to redistribute, for example a
  CC0 rigged humanoid (needs idle, walk and run clips), or confirm the Adobe Mixamo terms for
  your use.
- **Props:** Kenney (kenney.nl) Furniture Kit, City Kit Commercial, City Kit Roads, Retro Urban
  Kit, Nature Kit, Mini Arena and Survival Kit. CC0. Bicycles, the walking boot, the watch and
  the signs are procedural.
- **Sounds:** footsteps from Kenney Impact Sounds (CC0). Heartbeat, hammering, sanding, the watch
  buzz, spoke pings, Velcro, snap and drone are generated with WebAudio at runtime.
- **Music and ambience:** OpenGameArt.org, CC0 ("Contemplation", "Piano Loop", "Rain",
  "crowd shouting"). `scripts/fetch-assets.sh` lists the exact source URLs.
- **Code:** written for this project. Three.js is MIT-licensed.

The end card shows the same credits.
