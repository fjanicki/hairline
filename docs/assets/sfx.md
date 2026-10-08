# SFX asset group (recorded and generated sound effects)

- **Why:** almost every sound in the game is a procedural WebAudio cue (`src/core/Audio.js`). Some are fine, but several story-carrying sounds are too thin. The clearest case is `audio.hammer()` in Ch1: a 95 Hz sine plus a 30 ms brown-noise burst at 0.5 on the bus. On laptop speakers, which roll off below about 150 Hz, the player barely hears the hammering the opening thought talks about. This group adds recorded audio, plus locally generated audio where no recording fitted, for those cues and for the beds the story implies.
- **Fetch and build:** `scripts/assets/sfx.sh`, run by `scripts/fetch-assets.sh`. To run it on its own: `ROOT=$PWD bash scripts/assets/sfx.sh`.
  - It downloads the originals into `.cache/sfx/dl/{bbc,kenney,oga}/`. The BBC WAVs are about 820 MB and are downloaded once.
  - It makes a uv Python 3.12 venv in `.cache/sfx/venv` (numpy, scipy, soundfile, pyloudnorm).
  - It runs `scripts/sfx/build.py`, which reads `scripts/sfx/recipes.json`.
  - Env: `SFX_SKIP=1` skips the group and `SFX_FORCE=1` rebuilds everything.
  - Idempotent: downloads are cached, and a recipe is rebuilt only when its hash changes (`.cache/sfx/build-state.json`). The hash covers the recipe and its sources' metadata, size and mtime, so a re-picked generated take is rebuilt even though its file name stays the same. A second run downloads nothing, rebuilds nothing and takes about 1 s (checked).
- **Output:** `public/assets/sfx/<name>.ogg` (Ogg Opus, 48 kHz) and `public/assets/sfx/sfx.json`, a manifest of `{name: {files[], loop, channels, cat, target_lufs, detail[]}}`. A set of variants is `<name>_01..NN.ogg`. **198 files in 85 sets, 6.16 MB** (the budget is 25 MB): 109 recorded files in 51 sets (4.79 MB), plus 89 generated files in 34 sets (1.37 MB; see *Generated*).
- **Tools:**
  - `scripts/sfx/bbc_search.py "query"` searches the BBC archive API.
  - `scripts/sfx/analyze.py` prints envelopes and onsets for slicing.
  - `scripts/sfx/verify.py public/assets/sfx` decodes every output and checks LUFS, true peak and the loop wrap.
  - `scripts/sfx/qa.py --root . --clap --doc` is the stricter QA pass (see *QA*).
  - `scripts/sfx/catalogue.py .` regenerates the catalogue table below.
  - `scripts/sfx/generate.py` generates, scores and picks the text-to-audio set (see *Generated*).
- **Not wired in yet.** `src/` belongs to another workflow. The *Integration* section lists the small `Audio.js` additions this group needs and, for every cue, the call site, bus, volume and filter.

## Processing

- **Pipeline:**
  1. **Decode:** ffmpeg decodes the source region with the recipe's `af` filter chain and resamples to 48 kHz.
  2. **Slice:** one of `seg` (explicit times), `onsets` (transient detector, loudest spaced picks with outliers dropped), `strokes` (segments between envelope minima, for sanding and brushing), `loop`, `concat` or `files`.
  3. **Shape:** fold point sources to mono, add an optional synthetic room tail (`room`: decaying low-passed noise IR), then cosine fades.
  4. **Loop:** loops are made seamless with an equal-power crossfade of the tail into the head (out[0] = src[L], so the wrap is sample-continuous) and snapped to a rising zero crossing. `verify.py` measures every loop's wrap step at ≤ 0.6 × the 99th-percentile sample step, which means no click.
  5. **Normalise:** to the category target (table below), then cap the true peak at −1.5 dBTP before encoding (4× oversampled). The cap is applied as the set's median to every variant, so the variants stay loudness-matched. After the Opus encode, every file measures **≤ −1 dBTP** (checked).
  6. **Encode:** Opus VBR, 40–80 kbps by category.
  7. **Check the encode:** Opus lowers the K-weighted loudness of bright, noisy material by 1–2 dB. Each file is decoded, measured and re-encoded with a corrected gain, keeping the encode closest to the target whose decoded true peak is ≤ −1 dBTP.
- **Stereo:** two BBC beds were partly out of phase (`amb_marathon_crowd` L/R correlation −0.54, `amb_dawn_birds` −0.26), so a mono phone speaker would cancel them. Their recipes narrow the width with `extrastereo` (m = 0.45 / 0.6).
- **Through the floor:** the hammer is filtered in the file, not at runtime. The chain is highpass 45 Hz, two low-passes (1.1 / 1.6 kHz), +5 dB at 115 Hz, +3 dB at 380 Hz and a dark 0.3 s room tail. It keeps energy in 150–900 Hz so it reads on small speakers, while it still sounds like it comes through floorboards.

### Loudness targets per category

| Category | Measure | Target | Opus | Used for |
|---|---|---|---|---|
| `amb` | integrated | −28 LUFS | 64k stereo | exterior beds (street night/day/wet) |
| `amb_int` | integrated | −30 LUFS | 64k stereo | interior beds (rain on the window) |
| `amb_far` | integrated | −32 LUFS | 56k stereo | layers under another bed (birds, distant traffic, drips) |
| `crowd` | integrated | −24 LUFS | 80k stereo | crowd beds and crowd events |
| `hum` | integrated | −32 LUFS | 40k mono | hums and buzzes (fridge, tubes, neon) |
| `tv` / `radio` | integrated | −26 LUFS | 48k / 40k mono | diegetic speakers (run them through a speaker band at runtime) |
| `event` / `event_peaky` | integrated | −24 / −28 LUFS | 64k | multi-second events (bike pass, kettle / runners passing) |
| `heavy` | max momentary | −18 LUFS | 48k mono | doors, garage door |
| `foley` | max momentary | −20 LUFS | 48k mono | strokes, creaks, Velcro, tools |
| `floor` | max momentary | −21 LUFS | 40k mono | the through-the-floor hammer |
| `foley_soft` | max momentary | −24 LUFS | 48k mono | brush, pencil, paper |
| `tick` | max momentary | −26 LUFS | 48k mono | short transients (steps, knocks, clicks, shutter) |

All files are at most −1 dBTP. "Max momentary" is the loudest 400 ms window, so one-shots compare by what you hear. Set relative levels with the per-cue volume in the catalogue, not by editing the files.

## Audit: every sound the story implies

This audit covers `docs/DESIGN.md`, Revision 3 included, every chapter file, `crafts/*`, `src/world/scenes/**` and `Audio.js`.

**Verdict key:**
- **file**: a recorded file is in this group.
- **gen**: generated with text-to-audio (`scripts/sfx/gen-prompts.json`); the file is in the catalogue, and *Generated* at the end has the scores.
- **keep**: the procedural cue is right as it is (it carries tuned information, or it is a deliberate synth tone).

### Global / every chapter
| Sound | Where | Today | Verdict |
|---|---|---|---|
| Concrete footsteps | Player, Ch2/Ch5 street | Kenney `footstep_concrete` | keep |
| Wood-floor footsteps | Ch1 flat, Ch4 workshop | concrete steps indoors | **file** `step_wood_01..05` |
| Boot clump (bad leg) | Ch1/2/4/5, Ch5 line | concrete step at rate 0.72 + `thud()` | **file** `body_thud_01..02` as the layer now; **gen** `boot_step_wood` / `boot_step_wet` |
| Watch buzz | every `ui.watchBuzz` | `buzz()` 180 Hz square | keep (HUD shake is the twin); **gen** `watch_buzz_wrist` is one weak take, not used |
| Watch start chirp | Ch1 door | two square tones | keep (it's a device beep) |
| Mood drone, heartbeat | Mood, pain | procedural | keep |
| `settle()` on a reveal | every craft | sine 196→180 + noise | keep (a designed UI sting) |
| Notebook open / page / close | Ch4 Day 5 on, Ch5 final list | silent | **file** `notebook_open`, `page_flip_01..03`, `notebook_close` |
| Pencil writing / erasing | every entry; the strike; Ch5 eraser lifts the strikes | silent | **file** `pencil_write`, `pencil_erase` |
| Music | all | `contemplation`, `piano` | keep (not SFX) |

### Ch1 "No Impact": the flat, night
| Sound | Beat | Today | Verdict |
|---|---|---|---|
| **Hammering through the floor** (irregular-steady, muffled, "same rhythm for an hour") | t = 8 s, bursts of 3 every ~9 s; last burst through the fade | `audio.hammer()`: sine 95→48 Hz + 30 ms brown noise, inaudible on small speakers | **file** `hammer_floor_01..06` (pre-muffled). Volume 0.7–0.9, random variant, ±4 % rate |
| Rain on the window | whole chapter | `rain.ogg` (an exterior rain loop) | **file** `amb_rain_window` (interior, drips off the roof) |
| Fridge hum | kitchenette (the X-ray is on the fridge) | none | **file** `amb_fridge_hum` |
| Fluorescent tube: hum | kitchenette strip | none (only buzz bursts) | **file** `fluoro_hum`, gated by the tube's on/off |
| Fluorescent tube: stutter and strike | every 6–9 s | bandpass 120 Hz noise + tick | keep for now; **gen** `fluoro_flicker` |
| TV race broadcast bed (crowd, helicopter, passing cars) | until switched off | silent | **file** `tv_race_bed` (TdF roadside + helicopter), through a speaker band |
| TV commentary line ("...the work done for the domestiques") | `[tv]` | text | voice pipeline (not SFX) |
| TV off (CRT thunk and whine) | `[tvOff]` | none | **gen** `tv_crt_off` |
| Phone vibrating on the table | phone hotspot | none | **gen** `phone_vibrate_table` (one take) |
| Table rocking: tocks | R3.6 seed | `tick()` ×2 | **file** `table_tock_01..03` |
| Table settles, mug clink | R3.6 seed | `thud(0.08)` + 2.4 kHz tone | **file** `table_tock`, `mug_clink_01..02` |
| Door: latch and open | `[door]` / `openDoor` | silent | **file** `door_flat_open` |
| Door shut, stairwell | under the fade | silent | **file** `door_flat_close`; **gen** `amb_stairwell` (optional) |
| Stumble, pain | boot | thud + heartbeat | keep (`body_thud` can layer) |

### Ch2 "Never Stop": Rue des Tanneurs, evening, rain
| Sound | Beat | Today | Verdict |
|---|---|---|---|
| Rain on the street | whole chapter | `rain.ogg` | keep |
| Street at night: distant traffic, the odd car | whole chapter | none | **file** `amb_street_night` (a quiet French side street) + `amb_city_far` |
| Wet tyres, drips from downpipes and awnings | road end; No. 14 awning | none | **file** `amb_street_wet`, `amb_drips` |
| Sodium lamps, MARCO'S neon buzz | lamps, kebab sign | none | **file** `neon_buzz` (distance gain) |
| Doorway fluorescent tube | z ≈ −22 | 120 Hz sawtooth ticks | **file** `fluoro_hum` (distance gain); keep the strike ticks |
| Run club passing (5 runners) | z < −24 | per-runner `footstep()` | **file** `club_pass` (approach and depart); **gen** `club_pass_wet` |
| Bastien jogging on the spot | same | footsteps | keep (`run_step` variants fit) |
| Bench sit (wet wood) | bench | none | **file** `creak_wood_01..03` |
| Scaffold creak and wobble | HOLD STILL, on fidget | bandpass 240 Hz noise | **file** `scaffold_creak_01..05` |
| Odile's brush on the fascia | HOLD STILL progress | `scrape(0.07)` | **file** `brush_stroke_01..06` |
| Watch buzzes (PAUSE?, TIME TO MOVE) | z < −6, at 3.5 s | `buzz()` | keep |

### Ch3 "The Long Run": dawn loop, then the marathon
| Sound | Beat | Today | Verdict |
|---|---|---|---|
| Running footsteps, one per A/D | all blocks | Kenney concrete step | **file** `run_step_01..08` (pavement); **gen** `run_step_wet` for the rain weeks |
| Breathing to the cadence | all blocks | none | **gen** `breath_run_loop` (gain from the cadence) |
| Dawn birds (Week 9), pre-dawn (Week 31) | weeks | none | **file** `amb_dawn_birds` (Week 9, quieter in Week 20, off in Week 31) |
| Ring road far traffic | weeks | none | **file** `amb_city_far` |
| Rain, heavier in Week 20 | weeks | `rain.ogg` | keep |
| Marathon crowd | race | `crowd.ogg` (a shouting/speaking crowd) | **file** `amb_marathon_crowd` (replaces it in Ch3) |
| Spectators clapping at the KM boards | KM 29/30/31 | none | **file** `crowd_cheer_pass` |
| The crack: "a pencil lead going, somewhere inside a drawer" | KM 31 | `snap()` bandpass click | **gen** `crack_pencil_lead`; keep the `tone()` whine |
| Hitched stride, limp | after the crack | step + `thud` | keep (+ `body_thud`) |
| Breath after the finish | over black | none | **file** `breath_tired` |
| Starting gun | (unused) | `gun()` | keep |

### Ch4 "Measure Twice": the workshop
| Sound | Beat | Today | Verdict |
|---|---|---|---|
| Workshop room tone, street through the garage door | all days | music only | **gen** `amb_workshop` |
| Rain on the roof (Day 5) | Day 5 | `rain.ogg` low-passed 600 Hz | **file** `amb_rain_window` low-passed (or keep) |
| Fluorescent tube flicker (Day 5), steady by Week 7 | bench | square ticks | **file** `fluoro_hum` gated; **gen** `fluoro_flicker` |
| Pegboard: taking the sandpaper or a tool | Day 5, Day 8 | `scrape(0.12)` | **file** `tool_take_01..05`; **gen** `tool_hook` |
| Sanding strokes (rate-following), mashing | SANDING | `scrapeAt()` band noise | **file** `sand_stroke_01..08` (rate and volume follow `k`), `sand_loop` (idle assist) |
| Tape: pull, tock on the jamb, bow creak, zip back | R3.2 | tick, bandpass 240 noise, highpass noise | **gen** `tape_pull`, `tape_tock` (one take; alternate with `table_tock`), `tape_retract`; the creak can use `scaffold_creak` at rate 1.6 |
| Plane on the hinge side | after `tape.cut` | none | **file** `plane_stroke_01..04` |
| Tins: lid off, drop, stir, tip out | R3.3 mixer | tone plip, lowpass noise | **file** `tin_tap_01..04`; **gen** `paint_lid_open`, `paint_drop`, `paint_stir_loop`, `paint_slosh` |
| Brush bands on the door (6) | Day 8 auto-paint | `scrape(0.18)` | **file** `brush_stroke_01..06` |
| Door hung in the frame | Day 8 end | none | **file** `creak_wood` |
| Sami ducks under the garage door | Week 4 | none | **file** `garage_door_open` (a part of it) |
| Bike flips onto the stand | Week 4 | none | **file** `tool_take` (metal) or none |
| Spoke pluck pitch | truing | `pluck()` sine/triangle at 523·√T | **keep** (the pitch is the gameplay information) |
| Spoke key quarter turn | truing | `tick(0.12)` | **file** `spoke_key_01..02` |
| Rim rub on the pad ("zhhh, zhhh") | truing | `tick()` | **gen** `brake_rub` |
| Over-tight ping | truing | `ping(1900)` | keep |
| Freewheel ticking, coast-down when true | truing, done | none | **gen** `freewheel_tick`, `freewheel_coastdown` |
| Lettering brush (fine liner) | Week 7 | `brushHiss()` | **file** `brush_wall_loop` at low volume (rate from tip speed); keep `brushHiss` as an alternative |
| Kettle | Odile's corner | none | **file** `kettle_boil` (optional) |
| Radio: one station, a man talking about fishing | radio hotspot | 0.6 s bandpass noise | **file** `radio_static`; talk = `radioVoice` formants (keep) or **gen** `radio_talk_fishing` / TTS |
| Laugh, settle | Week 4 | `settle()` | keep |

### Ch5 "The Wall": day, then golden hour
| Sound | Beat | Today | Verdict |
|---|---|---|---|
| Street with neighbours, distant traffic | until the golden walk | piano only | **file** `amb_street_day` |
| Drying puddles, drips | opening | none | **file** `amb_drips` (low) |
| Sami's chain drops; chain back on | `[teach]` | highpass noise + tick; tick | **gen** `chain_drop`, `chain_on` |
| Pencil: Sami writes "Teech." | `[teach]` | none | **file** `pencil_write` at rate 0.85 |
| Hugo's panel: ladder, 6 brush bands | R3.7 | `scrape()` | **file** `creak_wood`, `brush_stroke_01..06` |
| THE LINE: the brush dragged 20 m along the wall | line | `scrape(0.06)` every 0.4–0.6 s | **file** `brush_wall_loop` (continuous, follows the tip) |
| Chalk guide | line | none | **gen** `chalk_line` (optional) |
| Initials "H.R." | line.sign | `scrape(0.12)` | **file** `brush_stroke` |
| Ines's phone photo | line.photo | `tick(0.45)` | **file** `camera_shutter` (or `camera_shutter_slr`) |
| Run club passes; Bastien jogs on the spot | club | footsteps | **file** `club_pass`, `run_step` |
| Velcro ×3, boot off | `[boot]` | `rip()` | **file** `velcro_rip_01..03` |
| Shutter job: stuck strokes, roll-up rattle | R3.8a | `scrapeAt`, 20 highpass bursts | **gen** `shutter_runner_scrape`, `shutter_roll_up` (stand-in: `sand_stroke` at rate 1.3) |
| Radio job: static, tuning, station chime, music | R3.8b | `radioVoice` (white noise + formants), chime tones, `contemplation` | **file** `radio_static`, `radio_tune_sweep`; keep the chime and the formant voices |
| Marco's board lettering | R3.8c | `brushHiss` | as Ch4 lettering |
| Ines's wheel truing | R3.8d | as Ch4 | as Ch4 (`spoke_key`, gen `brake_rub` / `freewheel_tick`) |
| No. 14 garage door fully open | scene | none | **file** `garage_door_open` (once at the reveal, optional) |
| Golden hour birds | walk, crane-up | piano | **file** `amb_golden_birds` |
| Sami rides past: bell, freewheel, tyres | walk.sami | none | **file** `bike_pass_bell` or `bike_pass` + `bike_bell_01..03`; **gen** `freewheel_tick` |
| Watch hung on the nail | walk.watch | `tick(0.3)` | keep `tick()`, or `spoke_key_02`; **gen** `watch_hang_nail` is weak, so listen before using it |
| Notebook: eraser lifts the strikes, "(some Sundays)", "Rest." | walk.notebook | none | **file** `pencil_erase`, `pencil_write`, `page_flip` |
| Breath after the first jog | walk.firstJog | none | **file** `breath_tired` (low) |

## Integration (for the code owner of `Audio.js`; not done here)

Nothing here is wired in yet: `src/` belongs to another workflow. This section is the hand-over. The first part is the small runtime the files need. The second part, the **Integration list**, gives every cue: where it plays (the `Audio.js` method or chapter beat it replaces), the files, the bus, the volume and the filter or playback rule. Call sites are named by file and function; line numbers move, so search for the quoted call.

### Runtime (the smallest change)

1. **Manifest:** fetch `sfx/sfx.json` once in `preload()`. A cue name is a manifest key; its `files` are the variants.
2. **One-shot helper:**
   ```js
   sfx(name, { volume = 0.5, rate = 1, jitter = 0.04, gainJitter = 0, bus = 'fx', lowpass, highpass, pan, delay = 0 })
   ```
   - It picks a random variant from `manifest[name].files`, never the one it played last.
   - It plays the buffer with `playbackRate = rate * (1 ± jitter)` and gain `volume * 10^(±gainJitter/20)`, through the optional filters and `StereoPannerNode`, into `fx` or `bus`.
   - When the buffer is missing, it calls the procedural cue it replaces (named in the list), so a checkout without the fetch still has sound.
3. **Beds:** add each bed to `FILES` as `sfx/<name>.ogg`. The existing `ambience(name, on, {volume, lowpass, fade})` then plays it. Chapters list beds in `chapter.ambience` and preload them with `chapter.sounds`.
   - `Director` only toggles `rain` and `crowd` from `chapter.ambience`; loop over the chapter's list instead of that fixed pair.
4. **Driven loops:** `loopSfx(name, {volume, rate, bus})` returns `{ set(volume, rate, secs), stop(fade) }`. It is `_loop()` plus `playbackRate`. Use it for loops whose gain or rate follows play: `tape_pull`, `freewheel_tick`, `brush_wall_loop`, `sand_loop`, `breath_run_loop`, `paint_stir_loop`, `radio_static`, `radio_tune_sweep`.
5. **Buses:** `bus` carries beds, steps and anything that should die with `cut()`. `fx` carries one-shots that must survive `cut()`, such as the Ch3 crack.
6. **Speaker band** (TV and radio): highpass 250 Hz (TV) or 300 Hz (radio) → lowpass 4500 Hz (TV) or 3400 Hz (radio) → a light `WaveShaper` (k = 2) → the voice gain. The radio band already exists in `crafts/radio.js` `radioVoice()`.
7. **Positional sources:** use distance gain as `scene2.js` already does for the doorway tube, or a `PannerNode` (`distanceModel: 'inverse'`, `refDistance: 1.5`).
8. **Levels:** every file is loudness-normalised to its category (see *Processing*). The volumes below are the in-game gain on top of that. Set levels there, not in the files.
9. **Lead-ins:** the recorded doors, the garage door and Velcro start 50–180 ms before their loudest moment (latch, rip build-up). Start them that much early (`delay` negative relative to the beat, or schedule them earlier) where they are tied to an animation frame.

### Integration list

**Global (several chapters)**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| Good-foot step, wood floor | `Player.js` step loop, indoors (Ch1 flat, Ch4 workshop): `footstep(this.footsteps, …)` | `step_wood` (A/B with `step_wood_alt`, generated and darker) | bus | 0.3 (0.42 jogging) | rate 0.9–1.1 |
| Bad-leg boot step, indoors | `Player.js` boot branch: `footstep('concrete', {rate: 0.72})` + `thud({volume: 0.15})` | `boot_step_wood` + `body_thud` | bus | 0.35 + 0.15 | jitter 0.04; `body_thud` lowpass 900 Hz |
| Bad-leg boot step, street | `Player.js` boot branch outdoors (Ch2, Ch5), the Ch5 line walk (`ch5.js`, `stepBad`) | `boot_step_wet` + `body_thud` | bus | 0.35 (0.45 on the line) + 0.12 | jitter 0.04; good foot keeps Kenney `footstep('concrete')` |
| Watch buzz | `UI.watchBuzz()` → `audio.buzz()` | none: **keep procedural** (`watch_buzz_wrist` is one weak take, CLAP 0.11; not used) | fx | as now (0.18) | lowpass 600 Hz as now; the HUD shake is the twin |
| Watch start chirp | `ch1.js` door beat: two square `tone()`s | none: **keep** | fx | 0.1 | |
| Notebook open / dock / close | notebook UI open (Ch4 Day 5 on, Ch5 `walk.notebook`) | `notebook_open`, `page_flip`, `notebook_close` | fx | 0.35 / 0.3 / 0.3 | rate 0.95–1.05 |
| Pencil writes an entry | each notebook entry; Sami's "Teech." | `pencil_write` | fx | 0.35 | rate 0.9–1.1; "Teech." at 0.85 |
| Eraser lifts a strike | Ch5 `walk.notebook` (Ride., Run.) | `pencil_erase` (A/B with `pencil_erase_alt`) | fx | 0.35 | |
| Reveal sting, drone, heartbeat, music | `crafts/finish.js` `settle()`, `drone()`, `heartbeat()`, `music()` | none: **keep** | as now | as now | |

**Ch1 "No Impact"**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| **Hammering through the floor** | `ch1.js` `blow()` in `burst()` (first at 8 s, then every ~9 s) and the last burst in the door beat: `audio.hammer()` | `hammer_floor` (6) | **bus** | 0.8, ±1.5 dB per blow; the third blow of a burst at 0.85× | **Irregular pattern:** gap `HAMMER.gap` × 0.85–1.2 per blow; one burst in five has 2 or 4 blows; bursts every 9 ± 1.5 s. Rate 1 ± 0.04, never the same variant twice; give `_06` half the weight (54 % of its energy is under 150 Hz, thin on laptops). **Filter:** lowpass 850 Hz (Q 0.7) at runtime. The files are already filtered (highpass 45 Hz, lowpasses at 1.1 and 1.6 kHz, +5 dB at 115 Hz, +3 dB at 380 Hz) and carry a dark 0.3 s small-room tail, so add no extra room. 46–73 % of each file's energy is in 150–900 Hz and under 3 % is above 900 Hz, so the 850 Hz lowpass costs about 0.2 dB: clearly audible on small speakers, still "through the floor". Keep `cam.shake(0.006, 0.12)` and `call('knock')`; fallback `audio.hammer()`. |
| Rain on the window | `chapter.ambience` `'rain'` (Director) | `amb_rain_window` | bus | 0.35 | none (`rain.ogg` stays for exteriors) |
| Fridge hum | new, chapter start | `amb_fridge_hum` | bus | 0.15 | positional at the fridge (inverse, ref 1.5 m) |
| Fluorescent hum | `scene1.js` tube flicker | `fluoro_hum` | bus | 0.1 | gain follows the tube: `setTargetAtTime(fl.on ? 0.1 : 0, t, 0.01)` |
| Tube stutter | `scene1.js`: `noise({type: 'bandpass', freq: 120})` every 6–9 s | `fluoro_flicker` (3) | bus | 0.2 | keep the restrike `tick({volume: 0.05})` |
| TV race broadcast | new, chapter start until `tvOff` | `tv_race_bed` | bus | 0.3 | TV speaker band (hp 250 / lp 4500 / light shaper), positional at the TV |
| TV off | `ch1.js` tvOff beat: `audio.tick({volume: 0.2})` | `tv_crt_off` (1) | fx | 0.45 | stop `tv_race_bed` in the same frame (fade 0.08 s) |
| Phone vibrating | phone hotspot and the notification before it | `phone_vibrate_table` (1) | fx | 0.45 | rate ± 0.03 on repeats (one usable take) |
| Table rocking | `ch1.js` `tableRocks()` `tock()`: `audio.tick({volume: 0.2})` | `table_tock` (3) | fx | 0.35 | jitter 0.05 |
| Table settles, mug clinks | `ch1.js` shim beat: `thud({volume: 0.08})` + `tone({freq: 2400, delay: 0.12})` | `table_tock` + `mug_clink` (A/B with `mug_clink_alt`) | fx | 0.25 + 0.3 | `table_tock` at rate 0.9; clink `delay: 0.12` |
| Watch picked up | `ch1.js` takeWatch: `tick({volume: 0.18})` | none: **keep** | fx | 0.18 | |
| Door: latch and open | `ch1.js` `call('openDoor')` | `door_flat_open` | fx | 0.5 | start 70 ms before the door moves |
| Door shut, stairwell | under the fade (`ui.fade(1, 1.8)`) | `door_flat_close`, `amb_stairwell` (optional) | fx / bus | 0.45 / 0.3 | close at +1.2 s into the fade; stairwell fade-in 1.5 s, lowpass 2 kHz |
| Stumble, pain | boot | `body_thud` | bus | 0.2 | lowpass 900 Hz; heartbeat stays procedural |

**Ch2 "Never Stop"**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| Rain on the street | `chapter.ambience` `'rain'` | `rain.ogg`: **keep** | bus | 0.35 | |
| Street at night | new, chapter bed | `amb_street_night` + `amb_city_far` | bus | 0.35 + 0.2 | |
| Wet road end | new, z > −12 | `amb_street_wet` | bus | 0.25 | crossfade with `amb_street_night` by z |
| Drips under the awning | new, near No. 14 | `amb_drips` | bus | 0.2 | distance gain |
| MARCO'S neon, sodium lamps | new | `neon_buzz` | bus | 0.1 | highpass 150 Hz; distance gain within 8 m |
| Doorway tube | `scene2.js`: sawtooth `tone({freq: 120})` when d < 9 | `fluoro_hum` | bus | 0.12 × (1 − d/9) | keep the strike ticks |
| Run club passing in the rain | `ch2.js` per-runner `footstep()` loop (z < −24) | `club_pass_wet` (2) | bus | 0.5 | `StereoPanner` swept from +Z to −Z over the 9 s; Bastien on the spot keeps `run_step` at 0.16 |
| Bench sit | bench hotspot | `creak_wood` (A/B with `creak_wood_alt`) | fx | 0.3 | |
| Scaffold creak (HOLD STILL) | `ch2.js`: `noise({type: 'bandpass', freq: 240, q: 6, volume: 0.24})` | `scaffold_creak` (5) | fx | 0.4 | lowpass 3 kHz |
| Odile's brush on the fascia | `ch2.js`: `scrape({volume: 0.07})` on `F.draw()` | `brush_stroke` (6) | fx | 0.3 | jitter 0.05 |
| Watch buzzes | `ui.watchBuzz` | **keep** `buzz()` | fx | | |

**Ch3 "The Long Run"**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| Running steps, dry (Week 9, race) | `ch3.js` step: `footstep('concrete', {volume: 0.3 / 0.32})` | `run_step` (8) | bus | 0.3 (0.24 when auto) | jitter 0.06 |
| Running steps, rain (Week 20) | same | `run_step_wet` (6) | bus | 0.32 | rate 0.92, jitter 0.06 |
| Hitched stride after the crack | `ch3.js` bad step: `footstep(…, {rate: 0.8})` | `run_step` + `body_thud` | bus | 0.4 + 0.15 | rate 0.8 |
| Breathing to the cadence | new, all blocks | `breath_run_loop` (2) | bus | 0.15–0.35 from cadence | `loopSfx`; rate 0.95–1.1; after the crack rate 1.1, +3 dB |
| Dawn birds | new, weeks | `amb_dawn_birds` | bus | Week 9 0.25, Week 20 0.12, Week 31 off | stereo narrowed in the build (see *QA*) |
| Ring road | new, weeks | `amb_city_far` | bus | 0.2 | |
| Rain | `ch3.js` `ambience('rain', …)` | **keep** | bus | as now | |
| Marathon crowd | `ch3.js` `ambience('crowd', {volume: 0.55, lowpass: 1400})`; Ch3 `sounds: ['crowd']` | `amb_marathon_crowd` | bus | 0.55; after the crack 0.14 | lowpass 1400 Hz; after the crack 900 Hz |
| Clapping at the KM boards | new, KM 29 / 30 / 31 | `crowd_cheer_pass` | bus | 0.35 | fade out over 2 s after 6 s |
| **The crack** | `ch3.js` crack: `audio.snap({volume: 0.3})` after `audio.cut()` | `crack_pencil_lead` (4) | **fx** (survives `cut()`) | 0.5 | lowpass 3 kHz ("inside a drawer"); keep the `tone()` whine |
| Breath after the finish | over black | `breath_tired` | bus | 0.35 | |
| Starting gun | `gun()` | **keep** | | | |

**Ch4 "Measure Twice"**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| Workshop room tone | new, all four days | `amb_workshop` | bus | 0.3 (0.2 on dry days) | |
| Rain on the roof (Day 5) | `ch4.js`: `ambience('rain', {volume: 0.1, lowpass: 600})` | **keep**, or `amb_rain_window` | bus | 0.2 | lowpass 900 Hz |
| Bench tube (Day 5 flicker, steady by Week 7) | `scene4/lights.js`: square `tone({freq: 120})` | `fluoro_hum` + `fluoro_flicker` | bus | 0.1 + 0.2 | hum gated by the tube; distance gain |
| Pegboard: tool off its hook | `ch4.js` pegboard: `scrape({volume: 0.12})` | `tool_hook` (3) | fx | 0.55 | its files sit 6–7.5 dB under target (peak-limited), hence the higher volume; alternative `tool_take` at 0.4 |
| Bike onto the stand | Week 4 | `tool_take` (5) | fx | 0.3 | |
| Sanding strokes | `ch4crafts.js` `scrapeAt(audio, s.rate)` (`crafts/juice.js`) | `sand_stroke` (8) | fx | 0.10 + 0.14 k | rate 0.85 + 0.3 k, k = rate / 2; mashing: rate 1.25, volume 0.3 |
| Sanding, idle assist | auto strokes | `sand_loop` | fx | 0.25 | `loopSfx` |
| Tape pulled out | `crafts/tape.js`, while Space / mouse is held | `tape_pull` (3, loop) | fx | 0.3 | `loopSfx`; rate 0.7–1.2 from blade speed |
| Tape case meets the jamb | `crafts/tape.js`: `tick({volume: 0.22})`; `ch4.js` "case hooks on the near jamb" `tick({volume: 0.2})` | `tape_tock` (1) | fx | 0.4 | jitter 0.05; for variety alternate with `table_tock` at rate 1.3, 0.3 (the tock is an information cue; the loupe is its twin) |
| Tape bow creak | `crafts/tape.js`: `noise({type: 'bandpass', freq: 240, q: 6})` | `scaffold_creak` | fx | 0.12 | rate 1.6 |
| Tape zips back | `crafts/tape.js`: `noise({type: 'highpass', freq: 2400})` | `tape_retract` (3) | fx | 0.45 | |
| Plane on the hinge side | after `tape.cut` | `plane_stroke` (4) | fx | 0.45 | 2–3 strokes, 0.9 s apart |
| Tin lid off | `crafts/mixer.js`, mixer start | `paint_lid_open` (2) | fx | 0.5 | peaky (up to 8.6 dB under target), hence 0.5 |
| Paint drop | `crafts/mixer.js` `plip()` | `paint_drop` (5) | fx | 0.4 | jitter 0.05; `plip()` is the fallback |
| Swirl after a drop | `crafts/mixer.js` | `paint_stir_loop` (2) | fx | 0.3 | a 0.4 s slice from a random offset, 60 ms fades |
| Tip it out | `crafts/mixer.js`: `noise({type: 'lowpass', freq: 500})` | `paint_slosh` (2) | fx | 0.45 | |
| Lid tapped back on | after Done | `tin_tap` (4) | fx | 0.25 | |
| Brush bands on the door | `ch4.js` band change: `scrape({volume: 0.18})` | `brush_stroke` | fx | 0.4 | |
| Door hung in the frame | Day 8 end | `creak_wood` | fx | 0.3 | |
| Sami ducks under the garage door | Week 4 | `garage_door_open` | fx | 0.4 | start 90 ms early |
| Spoke pluck, over-tight ping | `crafts/truing.js` `pluck()`, `ping(1900)` | **keep** (the pitch is the gameplay information) | fx | | |
| Spoke key quarter turn | `crafts/truing.js` `quarter()`: `tick({volume: 0.12})` | `spoke_key` (2) | fx | 0.25 | rate 1.3 |
| Rim rub on the pad | `ch4.js` `W.bike.onRub`: `tick({volume: 0.22})`; `crafts/truing.js` `rig.onRub`: `tick({volume: min(0.3, dev·10)})` | `brake_rub` (4) | fx | min(0.45, 0.15 + dev·10) | the pad flash is the twin |
| Freewheel ticking | new, while the wheel turns | `freewheel_tick` (2, loop) | fx | 0.25 | `loopSfx`; rate 0.5–1.5 from spin |
| Coast-down when true | truing done; Sami spins it | `freewheel_coastdown` (2) | fx | 0.3 | |
| Lettering brush (Week 7) | `crafts/letters.js` `brushHiss()` (`crafts/juice.js`) | `brush_wall_loop`, or **keep** `brushHiss` | fx | 0.08 × tip speed | `loopSfx`; rate 0.9–1.1 |
| Kettle (optional) | Odile's corner, once a day | `kettle_boil` | bus | 0.25 | distance gain |
| Radio hotspot | `ch4.js` radio: `noise({type: 'bandpass', freq: 1600, dur: 0.6})` | `radio_static` (0.6 s of it) | fx | 0.3 | radio band; the talk stays `radioVoice` formants (or TTS through the band; `radio_talk_fishing` is babble, optional) |
| Laugh, settle | Week 4 | **keep** `settle()` | | | |

**Ch5 "The Wall"**

| Cue | Plays at (replaces) | Files | Bus | Volume | Filter / playback |
|---|---|---|---|---|---|
| Street by day | new, until the golden walk | `amb_street_day` | bus | 0.3 | fade out 4 s into the walk |
| Drying puddles | opening | `amb_drips` | bus | 0.1 | |
| Sami's chain drops | `ch5.js` [teach]: `noise({type: 'highpass', freq: 2600})` + `tick({volume: 0.35})` | `chain_drop` (2) | fx | 0.45 | |
| Chain back on | `ch5.js` after the correct answer: `tick({volume: 0.3})` | `chain_on` (2) | fx | 0.45 | |
| Hugo's panel bands, ladder | `ch5panel.js`: `scrape({volume: 0.16})` | `brush_stroke`, `creak_wood` | fx | 0.4 / 0.3 | |
| **The line** | `ch5.js` line: `scrape({volume: 0.06})` every 0.4–0.6 s | `brush_wall_loop` | fx | 0.25 × tip speed | `loopSfx`; rate 0.9–1.1 with speed; steps as in *Global* (`boot_step_wet`) |
| Chalk guide (optional) | Odile marks the line | `chalk_line` (2) | fx | 0.3 | |
| Initials "H.R." | `ch5.js`: `scrape({volume: 0.12})` | `brush_stroke` | fx | 0.35 | |
| Ines's photo | `ch5.js` line.photo: `tick({volume: 0.45})` with `mood.flash` | `camera_shutter` (or `camera_shutter_slr`) | fx | 0.5 / 0.45 | start 50 ms before the flash |
| Run club; Bastien jogs on the spot | club beat | `club_pass`, `run_step` | bus | 0.5, 0.2 | `StereoPanner` sweep |
| Velcro ×3, boot off | `ch5.js` [boot]: `rip()` ×3, 0.3 s apart | `velcro_rip` (3) | fx | 0.5 | one variant per strap, each started 70 ms early |
| Shutter job: stuck strokes | `ch5jobs.js`: `scrapeAt(audio, s.rate)` | `shutter_runner_scrape` (3) | fx | 0.35–0.5 by stroke strength | jitter 0.05 |
| Shutter job: rolls up | `ch5jobs.js`: 20 highpass `noise()` bursts | `shutter_roll_up` (2) | fx | 0.5 | |
| Radio job | `crafts/radio.js` `radioVoice()` static; the dial | `radio_static` (loop), `radio_tune_sweep` (loop) | radio band | static as now; sweep 0.5 × \|du/dt\| | `loopSfx` into the band; keep the chimes and the formant voices |
| Marco's board lettering; Ines's wheel | `brushHiss`; truing | as Ch4 | | | |
| No. 14 garage door fully open (optional) | the reveal | `garage_door_open` | fx | 0.4 | once |
| Golden-hour birds | walk, crane-up | `amb_golden_birds` | bus | 0.3 | |
| Sami rides past | walk.sami | `bike_pass_bell` (or `bike_pass` + `bike_bell`), `freewheel_tick` | bus / fx | 0.4 / 0.35, 0.2 | pan with Sami |
| Watch hung on the nail | `ch5.js` walk.watch: `tick({volume: 0.3})` | **keep** `tick`, or `spoke_key` `_02`; `watch_hang_nail` (2) only after a listen (CLAP 0.15 / 0.11 to its prompt, no match to its description) | fx | 0.3 / 0.4 | |
| Breath after the first jog | walk.firstJog | `breath_tired` | bus | 0.2 | |

**Spares** (built but not on a cue): `hammer_near` (Odile hammering at the bench in Ch4 / Ch5, fx 0.5), `garage_door_shut` (Ch4 day end, fx 0.35), `camera_shutter_slr`, `kettle_boil`, the A/B alternatives `step_wood_alt`, `creak_wood_alt`, `mug_clink_alt`, `pencil_erase_alt`, and the unused `watch_buzz_wrist` and `radio_talk_fishing`.

**Preload per chapter** (6.16 MB in total, 1.37 MB of it generated): Ch1 needs about 0.8 MB (`amb_rain_window`, `amb_fridge_hum`, `fluoro_hum`, `fluoro_flicker`, `tv_race_bed`, `tv_crt_off`, `hammer_floor`, `door_flat_*`, `table_tock`, `mug_clink`, `phone_vibrate_table`, `step_wood`, `boot_step_wood`, `body_thud`).

**Credits line** (in-game and `docs/CREDITS.md`, still to add): "Sound effects: BBC Sound Effects archive (© BBC, RemArc licence), Kenney and OpenGameArt (CC0); some sounds generated with TangoFlux. This Stability AI Model is licensed under the Stability AI Community License, Copyright © Stability AI Ltd. All Rights Reserved. Powered by Stability AI."

## Catalogue

The *Bus / volume / filter* column comes from the recipes. Where the Integration list gives a different value, the Integration list wins: it accounts for the QA findings.

| File | What | Chapter / beat | Replaces | Loop | Bus / volume / filter | Source | Licence |
|---|---|---|---|---|---|---|---|
| `hammer_floor_01..06.ogg`<br>6 x 0.85 s, ch1, floor | Odile's hammer blow heard through the floor: muffled wood knock with a low body thump and a short dark room tail | Ch1 flat: hammering from downstairs (3-blow bursts, last burst through the fade) | audio.hammer() | no | bus, volume 0.8 (+-1.5 dB per blow); irregular 3-blow bursts (see Integration); lowpass 850 Hz at runtime (near-transparent, the files are pre-filtered), no extra room (the small-room tail is baked); random variant per blow, never the same twice, +-4% playbackRate; pair with the cam.shake | [BBC 07010167](https://sound-effects.bbcrewind.co.uk/search?q=07010167) Hammering a nail into wood. (Carpentry) | BBC RemArc (personal/educational) |
| `hammer_near_01..04.ogg`<br>4 x 0.36 s, ch1, tick | Dry close hammer on a nail into a floorboard, with hammer ring | Spare: Ch4/Ch5 workshop (Odile at the bench), Ch5 nail above the bench | new | no | fx, volume 0.5 | [BBC 07045107](https://sound-effects.bbcrewind.co.uk/search?q=07045107) Floor nail hammered, slow rhythm with hammer ring. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `amb_rain_window.ogg`<br>1 x 45.00 s, ch2, amb_int | Rain against a window from inside, water dripping off the roof | Ch1 flat (the whole chapter); Ch4 Day 5 low-passed under the workshop | audio/rain.ogg inside the flat (keep rain.ogg for exteriors) | yes | bus, volume 0.35; Ch4 lowpass 900 Hz | [BBC 07043377](https://sound-effects.bbcrewind.co.uk/search?q=07043377) Rain on window, with water dripping off roof. (Interior acoustic.) | BBC RemArc (personal/educational) |
| `amb_fridge_hum.ogg`<br>1 x 20.00 s, ch1, hum | Refrigerator compressor hum (mono point source) | Ch1 flat: kitchenette fridge (X-ray hotspot is taped to it) | new | yes | bus, volume 0.12-0.2, positional (PannerNode at the fridge) or distance gain | [BBC 07042249](https://sound-effects.bbcrewind.co.uk/search?q=07042249) Refrigerator hum. (Household) | BBC RemArc (personal/educational) |
| `fluoro_hum.ogg`<br>1 x 8.00 s, ch1, hum | Fluorescent strip-light hum with ballast buzz | Ch1 failing tube over the kitchenette; Ch2 doorway tube; Ch4 bench tube (Day 5 flicker, fixed by Week 7) | the 120 Hz noise/sawtooth/square buzz in scene1.js, scene2.js, scene4/lights.js (keep the tick on re-strike) | yes | bus, volume 0.08-0.15; gate the gain with the tube's on/off so the flicker cuts the hum; distance gain in Ch2 | [BBC 07059070](https://sound-effects.bbcrewind.co.uk/search?q=07059070) Strip lighting hum. (Household 2) | BBC RemArc (personal/educational) |
| `tv_race_bed.ogg`<br>1 x 36.00 s, ch1, tv | Roadside Tour de France crowd, passing cars and cycles, with a TV helicopter under it | Ch1 TV (cycling broadcast) until it is switched off | new (the TV was silent) | yes | bus, volume 0.3; bandpass 250-4500 Hz + slight saturation for a CRT speaker; cut on tvOff (pair with a CRT click, see generate list) | [BBC 07026083](https://sound-effects.bbcrewind.co.uk/search?q=07026083) France: Tour De France, race atmos. at roadside with spectators, passing cars and cycles.<br>[BBC 07055092](https://sound-effects.bbcrewind.co.uk/search?q=07055092) Helicopter, exterior, one hovering overhead (Bristol Sycamore). | BBC RemArc (personal/educational) |
| `door_flat_open.ogg`<br>1 x 2.50 s, ch1, heavy | Front door, interior, latch and open (close perspective) | Ch1 door beat (openDoor), Ch4/Ch5 workshop street door | new | no | fx, volume 0.5 | [BBC 07027080](https://sound-effects.bbcrewind.co.uk/search?q=07027080) House Door: Front Door, Interior, open and close. (Close perspective) | BBC RemArc (personal/educational) |
| `door_flat_close.ogg`<br>1 x 2.10 s, ch1, heavy | Front door, interior, shut | Ch1 end (under the fade), spare | new | no | fx, volume 0.45 | [BBC 07027080](https://sound-effects.bbcrewind.co.uk/search?q=07027080) House Door: Front Door, Interior, open and close. (Close perspective) | BBC RemArc (personal/educational) |
| `table_tock_01..03.ogg`<br>3 x 0.26 s, ch1, tick | Light wooden knock: the coffee table rocking on its short leg | Ch1 seed: wobbly table (two tocks, then the last settle) | audio.tick({volume:0.2}) and the settle thud(0.08) | no | fx, volume 0.35 | [impact-sounds](https://kenney.nl/assets/impact-sounds) `impactWood_light_000.ogg, impactWood_light_001.ogg, impactWood_light_002.ogg` | CC0 (Kenney) |
| `mug_clink_01..02.ogg`<br>2 x 0.54 s, ch1, foley_soft | Light ceramic clink | Ch1 seed: the mug on the table settles | audio.tone({freq:2400}) mug clink | no | fx, volume 0.3 | [impact-sounds](https://kenney.nl/assets/impact-sounds) `impactPlate_light_000.ogg, impactPlate_light_001.ogg` | CC0 (Kenney) |
| `step_wood_01..05.ogg`<br>5 x 0.27 s, ch1, tick | Footstep on wooden floorboards | Ch1 flat and Ch4 workshop floor (the good foot; the boot keeps a slowed step + body_thud) | footstep('concrete') indoors | no | bus, volume 0.3 | [impact-sounds](https://kenney.nl/assets/impact-sounds) `footstep_wood_000.ogg, footstep_wood_001.ogg, footstep_wood_002.ogg, footstep_wood_003.ogg, footstep_wood_004.ogg` | CC0 (Kenney) |
| `body_thud_01..02.ogg`<br>2 x 0.53 s, ch1, foley | Soft heavy body impact | The boot landing (layer under the bad-leg step), Ch3 stumble | audio.thud() (keep the sine as a fallback) | no | fx, volume 0.25 under a step, lowpass 900 Hz | [impact-sounds](https://kenney.nl/assets/impact-sounds) `impactSoft_heavy_000.ogg, impactSoft_heavy_001.ogg` | CC0 (Kenney) |
| `amb_street_night.ogg`<br>1 x 60.00 s, ch2, amb | Quiet French side street at night: distant traffic, the odd car and voice | Ch2 Rue des Tanneurs, late evening (under rain.ogg) | new (Ch2 had rain only) | yes | bus, volume 0.35 | [BBC 07031026](https://sound-effects.bbcrewind.co.uk/search?q=07031026) Traffic: Quiet night atmosphere in side street. (French Traffic) | BBC RemArc (personal/educational) |
| `amb_street_wet.ogg`<br>1 x 56.00 s, ch2, amb | Wet city street with tyres on wet tarmac and dripping water | Ch2 near the road end (z > -12) and Ch3 race road under the crowd | new | yes | bus, volume 0.25; crossfade with amb_street_night by z | [BBC 07031012](https://sound-effects.bbcrewind.co.uk/search?q=07031012) Traffic: Wet city street with dripping water, from steps of Westminster Abbey. | BBC RemArc (personal/educational) |
| `neon_buzz.ogg`<br>1 x 8.00 s, ch1, hum | Electrical hum with a varying buzz (neon transformer / sodium lamp) | Ch2 MARCO'S pink neon and the sodium lamps | new | yes | bus, volume 0.1, distance gain within 8 m, highpass 150 Hz | [BBC 07004188](https://sound-effects.bbcrewind.co.uk/search?q=07004188) A varying electrical hum. (Electrical Sounds) | BBC RemArc (personal/educational) |
| `amb_drips.ogg`<br>1 x 30.00 s, ch2, amb_far | Rain water dripping (downpipes, awnings) | Ch2 under the awning at No. 14 and the arrival; Ch5 start (puddles drying) | new | yes | bus, volume 0.2 | [BBC NHU05008020](https://sound-effects.bbcrewind.co.uk/search?q=NHU05008020) Sound of dripping rain water. (BBC Natural History Unit) | BBC RemArc (personal/educational) |
| `run_step_01..08.ogg`<br>8 x 0.24 s, ch1, tick | Running footstep (trainer) on pavement | Ch3 one step per A/D press; Ch2/Ch5 run club runners | footstep('concrete') in the Ch3 rhythm | no | bus, volume 0.3; +-6% rate; for the wet road add amb_street_wet or the generated wet variants | [BBC 07037037](https://sound-effects.bbcrewind.co.uk/search?q=07037037) Footsteps on Pavement, man running, with start & stop. | BBC RemArc (personal/educational) |
| `club_pass.ogg`<br>1 x 18.10 s, ch2, event_peaky | Group of runners approaching from behind and running away (feet only) | Ch2 z < -24 run club passes; Ch5 run club beat | the per-runner footstep() loop in ch2.js (keep it for Bastien jogging on the spot) | no | bus, volume 0.5; StereoPanner swept from the +Z side to -Z over the pass | [BBC 07037080](https://sound-effects.bbcrewind.co.uk/search?q=07037080) Footsteps on Country Road, three men running, with approach & stop.<br>[BBC 07037078](https://sound-effects.bbcrewind.co.uk/search?q=07037078) Footsteps on Country Road, two men running, departing. | BBC RemArc (personal/educational) |
| `scaffold_creak_01..05.ogg`<br>5 x 1.10 s, ch1, foley | Metal squeak/creak (swinging sign bracket): a loose scaffold tower | Ch2 HOLD STILL: the tower creaks when Hugo fidgets (and a hair on its own) | audio.noise({type:'bandpass', freq:240, q:6}) creak in ch2.js and tape.js bow creak | no | fx, volume 0.4; lowpass 3 kHz; for the tape bow use playbackRate 1.6, volume 0.12 | [BBC 07037360](https://sound-effects.bbcrewind.co.uk/search?q=07037360) Metal sign swinging, with some squeaks. (Squeaks, Creaks & Rattles) | BBC RemArc (personal/educational) |
| `brush_stroke_01..06.ogg`<br>6 x 0.44 s, ch1, foley_soft | Single paint-brush stroke on wood | Ch2 Odile's fascia letters; Ch4 Day 8 door bands; Ch5 Hugo's panel bands and the initials | audio.scrape() on paint (not on sanding) | no | fx, volume 0.4 | [BBC 07045141](https://sound-effects.bbcrewind.co.uk/search?q=07045141) Painting, brush. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `brush_wall_loop.ogg`<br>1 x 6.00 s, ch1, foley_soft | Continuous brushing on a flat surface | Ch5 THE LINE: the brush dragged along the wall for 16 s; Ch4 lettering (quiet) | the periodic audio.scrape({volume:0.06}) in ch5.js line, brushHiss() | yes | fx, volume 0.25 scaled by tip speed; playbackRate 0.9-1.1 with speed | [BBC 07045141](https://sound-effects.bbcrewind.co.uk/search?q=07045141) Painting, brush. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `amb_dawn_birds.ogg`<br>1 x 45.00 s, ch2, amb_far | Town-edge dawn chorus: song thrush, blackbird, wren, crow, distant rooster | Ch3 training weeks (Week 9 full, Week 20 under heavier rain, Week 31 none: pre-dawn) | new | yes | bus, volume 0.25 | [BBC NHU05104268](https://sound-effects.bbcrewind.co.uk/search?q=NHU05104268) Dawn chorus: song thrush, blackbird, wren, carrion crow, distant rooster, robin, rooks. (BBC NHU) | BBC RemArc (personal/educational) |
| `amb_city_far.ogg`<br>1 x 50.00 s, ch2, amb_far | Night traffic in town, distant | Ch3 ring road at 5 a.m.; Ch2 far layer | new | yes | bus, volume 0.2 | [BBC 07031004](https://sound-effects.bbcrewind.co.uk/search?q=07031004) Traffic: Sound of night traffic in town. (Night Traffic) | BBC RemArc (personal/educational) |
| `amb_marathon_crowd.ogg`<br>1 x 44.00 s, ch2, crowd | London Marathon crowd atmosphere: cheering, clapping, whistles | Ch3 race (KM 29-31), thin after the crack | audio/crowd.ogg in Ch3 (shouting/speaking crowd) | yes | bus, volume 0.5, lowpass 1400 Hz as now; 0.14 + lowpass 900 after the crack | [BBC 07043081](https://sound-effects.bbcrewind.co.uk/search?q=07043081) London Marathon, atmosphere near start. | BBC RemArc (personal/educational) |
| `crowd_cheer_pass.ogg`<br>1 x 20.00 s, ch2, crowd | Roadside spectators applauding as riders pass | Ch3 race: at each KM board as Hugo passes; Ch1 TV bed accents | new | no | bus, volume 0.35 | [BBC 07026084](https://sound-effects.bbcrewind.co.uk/search?q=07026084) France: Tour De France, race atmos. at roadside, applauding spectators and bicycles passing. | BBC RemArc (personal/educational) |
| `breath_tired.ogg`<br>1 x 3.17 s, ch1, foley_soft | A person getting their breath back after running | Ch3 end of the race (over black, before the watch); Ch5 after the first jog | new | no | bus, volume 0.35 | [breathing-tired](https://opengameart.org/content/breathing-tired) `breathing_tired.wav` | CC0 (mikeask, OpenGameArt) |
| `sand_stroke_01..08.ogg`<br>8 x 0.34 s, ch1, foley | One hand-sanding stroke (folded paper on plywood) | Ch4 Day 5 SANDING (one per A/D stroke); Ch5 shutter runners (rusty variant: playbackRate 1.3) | scrapeAt() / audio.scrape() on sanding | no | fx; volume 0.10 + 0.14k and playbackRate 0.85 + 0.3k with k = rate/2 (keep scrapeAt's mapping); mashing: rate 1.25, volume 0.3 | [BBC 07045125](https://sound-effects.bbcrewind.co.uk/search?q=07045125) Sanding, paper folded then sheet of plywood. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `sand_loop.ogg`<br>1 x 6.00 s, ch1, foley | Continuous hand sanding | Ch4 Day 5 idle-assist strokes, settle at 1.0 | new | yes | fx, volume 0.25 | [BBC 07045123](https://sound-effects.bbcrewind.co.uk/search?q=07045123) Sanding, small piece of wood. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `plane_stroke_01..04.ogg`<br>4 x 1.00 s, ch1, foley | Jack plane stroke on soft wood | Ch4 Day 8 after the cut line ('half a centimetre comes off the hinge side') | new | no | fx, volume 0.45 | [BBC 07010181](https://sound-effects.bbcrewind.co.uk/search?q=07010181) A jack plane operating on soft wood. (Carpenter's Workshop) | BBC RemArc (personal/educational) |
| `tool_take_01..05.ogg`<br>5 x 0.70 s, ch1, foley | Metal hand tool picked up / put down on a bench | Ch4 pegboard (sandpaper, plane, tape, spoke key), Ch5 workshop | audio.scrape({volume:0.12}) on taking the sandpaper | no | fx, volume 0.4 | [BBC 07045095](https://sound-effects.bbcrewind.co.uk/search?q=07045095) Tools removed from box and put on bench. (D.I.Y. and Building) | BBC RemArc (personal/educational) |
| `tin_tap_01..04.ogg`<br>4 x 0.16 s, ch1, tick | Tin can knock (paint tin, lid tapped shut) | Ch4 Day 8 mixer: a tin tilted for a drop; lid back on after Done | new (pairs with the plip) | no | fx, volume 0.25 | [impact-sounds](https://kenney.nl/assets/impact-sounds) `impactTin_medium_000.ogg, impactTin_medium_001.ogg, impactTin_medium_002.ogg, impactTin_medium_003.ogg` | CC0 (Kenney) |
| `spoke_key_01..02.ogg`<br>2 x 0.45 s, ch1, tick | Small metal click | Ch4 Week 4 / Ch5 Ines's wheel: quarter turn on a nipple | audio.tick({volume:0.12}) on a quarter turn | no | fx, volume 0.25, playbackRate 1.3 | [rpg-audio](https://kenney.nl/assets/rpg-audio) `metalClick.ogg, metalLatch.ogg` | CC0 (Kenney) |
| `page_flip_01..03.ogg`<br>3 x 0.77 s, ch1, tick | Page turn | Notebook opens/docks (Ch4 Day 5 on, Ch5 final list) | new | no | fx, volume 0.3 | [rpg-audio](https://kenney.nl/assets/rpg-audio) `bookFlip1.ogg, bookFlip2.ogg, bookFlip3.ogg` | CC0 (Kenney) |
| `notebook_open.ogg`<br>1 x 0.15 s, ch1, tick | Exercise book opened | Ch4 Day 5 [book]; Ch5 walk.notebook full size | new | no | fx, volume 0.35 | [rpg-audio](https://kenney.nl/assets/rpg-audio) `bookOpen.ogg` | CC0 (Kenney) |
| `notebook_close.ogg`<br>1 x 0.23 s, ch1, foley_soft | Exercise book closed | Notebook docks back | new | no | fx, volume 0.3 | [rpg-audio](https://kenney.nl/assets/rpg-audio) `bookClose.ogg` | CC0 (Kenney) |
| `pencil_write.ogg`<br>1 x 1.42 s, ch1, foley_soft | Pencil writing a short word | Every notebook entry (Ride. Run. Hold still. ... Rest.), Sami's 'Teech.' at rate 0.85 | new | no | fx, volume 0.35; play once per entry, playbackRate 0.9-1.1 | [pencil-sounds](https://opengameart.org/content/pencil-sounds) `pencil_write.flac` | CC0 (antumdeluge, OpenGameArt; from Freesound #443241, #571800) |
| `pencil_erase.ogg`<br>1 x 1.14 s, ch1, foley_soft | Eraser rubbing a pencil line | Ch5 walk.notebook: the strike lifted off 'Ride.' and 'Run.'; Ch4 strike (reverse is fine) | new | no | fx, volume 0.35 | [pencil-sounds](https://opengameart.org/content/pencil-sounds) `pencil_erase.flac` | CC0 (antumdeluge, OpenGameArt; from Freesound #443241, #571800) |
| `creak_wood_01..03.ogg`<br>3 x 0.66 s, ch1, foley | Wooden creak | Ch2/Ch5 bench sit; Ch5 Hugo's panel ladder; Ch4 door hung in the frame | new | no | fx, volume 0.3 | [rpg-audio](https://kenney.nl/assets/rpg-audio) `creak1.ogg, creak2.ogg, creak3.ogg` | CC0 (Kenney) |
| `kettle_boil.ogg`<br>1 x 40.00 s, ch1, event | Electric kettle coming to the boil | Ch4 Odile's corner (optional: once per day, at the start) | new | no | bus, volume 0.25, distance gain | [BBC 07027207](https://sound-effects.bbcrewind.co.uk/search?q=07027207) Household: Electric kettle boiling. | BBC RemArc (personal/educational) |
| `radio_static.ogg`<br>1 x 8.00 s, ch1, radio | Radio static, continuous | Ch4 radio hotspot; Ch5 radio job (static gain from the dial) | the white-noise static in crafts/radio.js and the noise burst on the Ch4 radio hotspot | yes | into radioVoice's radio band (hp 300 / lp 3400), gain as now | [BBC 07075036](https://sound-effects.bbcrewind.co.uk/search?q=07075036) Static. (Continuous background) | BBC RemArc (personal/educational) |
| `radio_tune_sweep.ogg`<br>1 x 14.00 s, ch1, radio | Tuning across a band: whistles, heterodynes and fragments | Ch5 radio job: while the dial moves (gain from dial speed) | new | yes | radio band, volume 0.5 x |du/dt| normalised | [BBC 07058163](https://sound-effects.bbcrewind.co.uk/search?q=07058163) Slow tuning across 9 MHz, with static and heavy interference. (Bits & Pieces) | BBC RemArc (personal/educational) |
| `garage_door_open.ogg`<br>1 x 3.60 s, ch1, heavy | Up-and-over garage door opening (interior) | Ch4 Week 4 Sami ducks in; Ch5 No. 14 fully open (play once at the reveal) | new | no | fx, volume 0.4 | [BBC 07027110](https://sound-effects.bbcrewind.co.uk/search?q=07027110) Garage Door: Interior, Up & Over type, opened and shut. | BBC RemArc (personal/educational) |
| `garage_door_shut.ogg`<br>1 x 2.60 s, ch1, heavy | Up-and-over garage door shut | Spare (Ch4 day end) | new | no | fx, volume 0.35 | [BBC 07027110](https://sound-effects.bbcrewind.co.uk/search?q=07027110) Garage Door: Interior, Up & Over type, opened and shut. | BBC RemArc (personal/educational) |
| `amb_street_day.ogg`<br>1 x 60.00 s, ch2, amb | Parisian square by day: footsteps, occasional speech, distant traffic | Ch5 street with the neighbours (fade out for the golden-hour walk) | new (Ch5 had music only) | yes | bus, volume 0.3 | [BBC 07031023](https://sound-effects.bbcrewind.co.uk/search?q=07031023) Traffic: Parisian square with footsteps, occasional speech, distant traffic police whistle. (French Traffic) | BBC RemArc (personal/educational) |
| `amb_golden_birds.ogg`<br>1 x 50.00 s, ch2, amb_far | Spring evening: blackbird, rooks, wren, chaffinch, a distant dog | Ch5 golden hour walk and crane-up | new | yes | bus, volume 0.3 | [BBC NHU05068153](https://sound-effects.bbcrewind.co.uk/search?q=NHU05068153) Late spring evening, creekside churchyard: blackbird, rooks, wren, chaffinch, distant dog. (BBC NHU) | BBC RemArc (personal/educational) |
| `velcro_rip_01..03.ogg`<br>3 x 1.04 s, ch1, foley | Velcro strap ripped open | Ch5 [boot]: three straps, 0.3 s apart | audio.rip() | no | fx, volume 0.5, one variant per strap | [202-more-sound-effects](https://opengameart.org/content/202-more-sound-effects) `Velcro_01.wav, Velcro_02.wav, Velcro_03.wav` | CC0 (owlishmedia, OpenGameArt) |
| `camera_shutter.ogg`<br>1 x 0.48 s, ch1, tick | Camera shutter click (phone-like) | Ch5 [line.photo]: Ines's photo, with mood.flash | audio.tick({volume:0.45}) shutter | no | fx, volume 0.5 | [202-more-sound-effects](https://opengameart.org/content/202-more-sound-effects) `Camera_01.wav` | CC0 (owlishmedia, OpenGameArt) |
| `camera_shutter_slr.ogg`<br>1 x 1.30 s, ch1, tick | Mechanical SLR shutter and wind-on | Alternative for the photo | audio.tick shutter (alt) | no | fx, volume 0.45 | [BBC 07076042](https://sound-effects.bbcrewind.co.uk/search?q=07076042) Single shutter click with wind-on of 6x6 SLR Hasselblad camera. (Cameras) | BBC RemArc (personal/educational) |
| `bike_bell_01..03.ogg`<br>3 x 1.20 s, ch1, foley | Bicycle bell ring | Ch5 Sami rides past ('It doesn't even rub!'), Ch4 Week 4 Sami arrives | new | no | fx, volume 0.35 | [BBC 07037426](https://sound-effects.bbcrewind.co.uk/search?q=07037426) Bicycle Bell ringing. | BBC RemArc (personal/educational) |
| `bike_pass.ogg`<br>1 x 6.00 s, ch2, event | Bicycle passing (tyres, a little freewheel) | Ch5 Sami on the trued bike in the golden walk; Ch5 chain-drop ride | new | no | bus, volume 0.4, pan with Sami | [BBC 07014195](https://sound-effects.bbcrewind.co.uk/search?q=07014195) Bicycle passing on gravel, with some birdsong. (Model c. 1936.) | BBC RemArc (personal/educational) |
| `bike_pass_bell.ogg`<br>1 x 6.40 s, ch2, event | Old roadster passing left to right with a bell | Ch5 walk.sami (bell + pass in one) | new | no | bus, volume 0.4 | [BBC 07043020](https://sound-effects.bbcrewind.co.uk/search?q=07043020) Bicycle, 1936 Raleigh sports model, passing with bell from left to right. | BBC RemArc (personal/educational) |
| `phone_vibrate_table.ogg`<br>1 x 2.00 s, ch1, foley | Phone vibrating on the wooden coffee table: two buzzes, rattling against the wood | Ch1 phone hotspot (12 unread) and the notification before it | new | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "close-up mobile phone vibrating on a wooden coffee table, two short buzzes, the phone rattles against the wood, quiet room, dry"; picked takes s79101 (CLAP 0.18) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `watch_buzz_wrist.ogg`<br>1 x 1.00 s, ch1, foley_soft | Smartwatch haptic buzz on the wrist, close and muffled | Every ui.watchBuzz (Ch1 TIME TO MOVE, Ch2 PAUSE?, Ch4 ROWING DETECTED / 3 hr 12 min, Ch5 last menu) | audio.buzz() (keep the HUD shake as the twin) | no | not used: one weak take; keep the procedural buzz() | generated: TangoFlux (`generate.py`), prompt "A cell phone vibrates twice with a short low buzzing hum, muffled"; picked takes s20777 (CLAP 0.11) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `tv_crt_off.ogg`<br>1 x 2.00 s, ch1, foley | CRT television switched off: button click, thump, fading whine | Ch1 TV hotspot: E turns it off and the key light dies | new (cut tv_race_bed at the same moment) | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "old CRT television switched off: a power button click, a short electrical thump and a fading high-pitched whine, small living room, close"; picked takes s76406 (CLAP 0.23) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `boot_step_wood_01..06.ogg`<br>6 x 0.75 s, ch1, tick | Walking-boot step on old floorboards: flat plastic clump, slight creak | Ch1 flat and Ch4 workshop: the bad-leg step | footstep('concrete', rate 0.72) + thud in Player._steps when footsteps==='boot' indoors | no | bus, volume 0.35, +-4% rate; alternate with step_wood for the good foot | generated: TangoFlux (`generate.py`), prompt "A single heavy clumping footstep of a plastic boot on a creaky wooden floor"; picked takes s12002 (CLAP 0.28), s11995 (CLAP 0.27), s11993 (CLAP 0.25), s11996 (CLAP 0.21), s11989 (CLAP 0.21), s11990 (CLAP 0.19) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `boot_step_wet_01..06.ogg`<br>6 x 0.63 s, ch1, tick | Walking-boot step on wet asphalt: flat clump with a small splash | Ch2 and Ch5 street: the bad-leg step outdoors | footstep('concrete', rate 0.72) + thud outdoors | no | bus, volume 0.35, +-4% rate | generated: TangoFlux (`generate.py`), prompt "A single heavy clumping footstep of a plastic boot splashing on wet pavement"; picked takes s47418 (CLAP 0.27), s47425 (CLAP 0.26), s47433 (CLAP 0.26), s47427 (CLAP 0.25), s47426 (CLAP 0.24), s47435 (CLAP 0.24) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `run_step_wet_01..06.ogg`<br>6 x 0.50 s, ch1, tick | Running-shoe step on a wet road, light splash | Ch3 rhythm, rain weeks (Week 20 heavier: volume up, rate 0.92) | footstep('concrete') in the Ch3 rhythm (run_step stays for Week 9) | no | bus, volume 0.3, +-6% rate | generated: TangoFlux (`generate.py`), prompt "single running shoe footstep on wet asphalt road, light splash, early morning, outdoors, close, dry, one step"; picked takes s63050 (CLAP 0.31), s63027 (CLAP 0.28), s63042 (CLAP 0.24), s63039 (CLAP 0.23), s63043 (CLAP 0.22), s63030 (CLAP 0.21) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `breath_run_loop_01..02.ogg`<br>2 x 12.00 s, ch1, foley_soft | Runner's steady mouth breathing at cadence (loop) | Ch3 run: under the steps, gain follows cadence; ragged after the crack (rate 1.1, more gain) | new | yes | bus, volume 0.15-0.35 from cadence; playbackRate 0.95-1.1 | generated: TangoFlux (`generate.py`), prompt "A man breathes heavily and rhythmically while jogging"; picked takes s47227 (CLAP 0.23), s47217 (CLAP 0.27) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `crack_pencil_lead_01..04.ogg`<br>4 x 0.37 s, ch1, tick | Tiny dry snap, like a pencil lead breaking inside a drawer | Ch3 KM 31 [crack] | audio.snap() (keep the tone() whine); plays on fx through cut() | no | fx, volume 0.5, lowpass 3 kHz for the 'inside a drawer' distance | generated: TangoFlux (`generate.py`), prompt "tiny dry snap of a pencil lead breaking inside a closed wooden drawer, very small, muffled, intimate, no reverb"; picked takes s33479 (CLAP 0.39), s33480 (CLAP 0.29), s33477 (CLAP 0.28), s33485 (CLAP 0.28) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `fluoro_flicker_01..03.ogg`<br>3 x 1.88 s, ch1, foley_soft | Failing fluorescent tube: ballast buzz stuttering, starter click, glassy tink as it strikes | Ch1 tube stutter every 6-9 s; Ch4 Day 5 flicker | the bandpass 120 Hz noise burst + tick in scene1.js / scene4/lights.js (fluoro_hum stays the steady part) | no | bus, volume 0.2, distance gain with the tube | generated: TangoFlux (`generate.py`), prompt "failing fluorescent tube light flickering: ballast buzz stuttering on and off, a starter click and a glassy tink as it strikes back, kitchen at night"; picked takes s52380 (CLAP 0.26), s52381 (CLAP 0.25), s52379 (CLAP 0.14) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `club_pass_wet_01..02.ogg`<br>2 x 9.00 s, ch2, event_peaky | Group of runners splashing past on a wet street at night, approach and fade | Ch2 run club in the rain (Ch5 keeps club_pass) | the per-runner footstep() loop in ch2.js | no | bus, volume 0.5; StereoPanner swept +Z to -Z over the pass | generated: TangoFlux (`generate.py`), prompt "group of five joggers running past on a wet street at night, splashing footsteps approaching from behind and fading away, one says nothing, light breathing, rain, outdoors"; picked takes s35314 (CLAP 0.30), s35311 (CLAP 0.27) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `paint_lid_open_01..02.ogg`<br>2 x 1.50 s, ch1, foley | Paint-tin lid prised off with a screwdriver: pop and light scrape | Ch4 Day 8 mixer start (five tins), Ch5 Hugo's panel | new | no | fx, volume 0.5 (peaky: up to 9 dB under target) | generated: TangoFlux (`generate.py`), prompt "prying the metal lid off a paint tin with a screwdriver, a pop and a light metallic scrape, workshop, close"; picked takes s25103 (CLAP 0.16), s25105 (CLAP 0.19) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `paint_stir_loop_01..02.ogg`<br>2 x 6.00 s, ch1, foley_soft | Stick stirring thick paint in an enamel pot (loop) | Ch4 Day 8 mixer: a 0.4 s swirl after each drop and while the swatch eases | new | yes | fx, volume 0.3; play slices for the swirl | generated: TangoFlux (`generate.py`), prompt "wooden stirring stick stirring thick emulsion paint in an enamel pot, slow circular viscous squelching, close, workshop, continuous"; picked takes s4604 (CLAP 0.30), s4606 (CLAP 0.27) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `paint_drop_01..05.ogg`<br>5 x 0.25 s, ch1, tick | One thick drop of paint into paint: soft viscous plop | Ch4 Day 8 mixer drop | the plip tone(900->400 Hz) in crafts/mixer.js (keep it as fallback) | no | fx, volume 0.4, +-5% rate | generated: TangoFlux (`generate.py`), prompt "a single thick drop of paint falling into a pot of paint, soft viscous plop, very close, dry"; picked takes s89731 (CLAP 0.20), s89740 (CLAP 0.16), s89727 (CLAP 0.14), s89732 (CLAP 0.13), s89739 (CLAP 0.11) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `paint_slosh_01..02.ogg`<br>2 x 1.75 s, ch1, foley | Thick paint tipped out of an enamel pot: slow slosh and glug | Ch4 Day 8 mixer: Tip it out | the lowpass 500 Hz noise in crafts/mixer.js | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "Thick liquid is poured out of a pot into a bucket with a gloopy glug"; picked takes s52544 (CLAP 0.27), s52540 (CLAP 0.20) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `tape_pull_01..03.ogg`<br>3 x 1.60 s, ch1, foley_soft | Steel tape-measure blade pulled out: metallic whirr and spring ratchet (loop) | Ch4 Day 8 Measure twice: while Space/mouse is held | new | yes | fx, volume 0.3; playbackRate 0.7-1.2 from blade speed (60 -> 4 cm/s) | generated: TangoFlux (`generate.py`), prompt "pulling the steel blade out of a retractable tape measure, smooth metallic whirr and ratchet of the spring, close, workshop"; picked takes s58324 (CLAP 0.31), s58321 (CLAP 0.18), s58332 (CLAP 0.17) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `tape_retract_01..03.ogg`<br>3 x 1.12 s, ch1, foley | Tape-measure blade zipping back and clacking shut | Ch4 tape: too short, the blade zips back | the highpass 2400 Hz noise in crafts/tape.js | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "steel tape measure blade zipping back into its case fast and snapping shut with a plastic clack, close"; picked takes s6759 (CLAP 0.25), s6757 (CLAP 0.21), s6755 (CLAP 0.16) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `tape_tock.ogg`<br>1 x 0.50 s, ch1, tick | Tape-measure case touching a wooden door frame: one small hollow tock | Ch4 tape: the case meets the jamb at 81.5 cm (info cue; the loupe is its twin) | audio.tick({volume:0.22}) in crafts/tape.js and ch4.js | no | fx, volume 0.4, +-5% rate; one take, so alternate with table_tock at rate 1.3, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "the plastic case of a tape measure touching a wooden door frame, one small hollow wooden tock, close, dry"; picked takes s68089 (CLAP 0.25) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `freewheel_tick_01..02.ogg`<br>2 x 4.00 s, ch1, foley_soft | Rear-hub freewheel ticking while the wheel coasts (loop) | Ch4 Week 4 and Ch5 Ines's wheel while it turns; Ch5 Sami coasting | new | yes | fx, volume 0.25; playbackRate follows spin (0.5-1.5) | generated: TangoFlux (`generate.py`), prompt "bicycle rear hub freewheel ticking while the wheel coasts on a work stand, steady fast metallic clicking, close, workshop, no pedalling"; picked takes s88959 (CLAP 0.44), s88961 (CLAP 0.43) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `freewheel_coastdown_01..02.ogg`<br>2 x 6.00 s, ch1, foley_soft | Wheel spun by hand, freewheel ticking slowing to a stop | Ch4 Week 4 done ('spins true and silent'); Sami spinning it in [after] | new | no | fx, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "bicycle wheel spun by hand on a stand, freewheel ticking slowing down to a stop over five seconds, close, quiet workshop"; picked takes s81458 (CLAP 0.38), s81453 (CLAP 0.26) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `brake_rub_01..04.ogg`<br>4 x 0.15 s, ch1, foley_soft | Rim brushing a brake pad once: short soft 'zhhh' | Ch4 Week 4 / Ch5 truing rub (Sami's 'zhhh, zhhh') | audio.tick() in W.bike.onRub / rig.onRub (volume from deviation; the pad flash is the twin) | no | fx, volume 0.15-0.45 from deviation | generated: TangoFlux (`generate.py`), prompt "A short soft rubbing swish of rubber against a spinning bicycle wheel"; picked takes s45720 (CLAP 0.30), s45735 (CLAP 0.23), s45729 (CLAP 0.21), s45732 (CLAP 0.20) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `chain_drop_01..02.ogg`<br>2 x 0.92 s, ch1, foley | Bicycle chain falling off the chainring: rattle and slap | Ch5 [teach]: Sami's chain drops | the highpass noise + tick in ch5.js | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "bicycle chain falling off the front chainring with a metallic rattle and slap against the frame, outdoors, close"; picked takes s52478 (CLAP 0.17), s52477 (CLAP 0.18) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `chain_on_01..02.ogg`<br>2 x 2.25 s, ch1, foley | Chain hooked back on while the pedal turns backwards: clicks and a seating clunk | Ch5 [teach]: correct answer, 'It went on' | audio.tick({volume:0.3}) | no | fx, volume 0.45 | generated: TangoFlux (`generate.py`), prompt "bicycle chain hooked back onto the chainring while the pedal is turned slowly backwards, a few metallic clicks and a final clunk as it seats, close"; picked takes s79448 (CLAP 0.40), s79451 (CLAP 0.40) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `shutter_runner_scrape_01..03.ogg`<br>3 x 0.70 s, ch1, foley | One push on a stuck rusty roller shutter: slats grinding in the runners | Ch5 job (a) shutter: one per stroke | scrapeAt() there (sand_stroke at rate 1.3 was the stand-in) | no | fx, volume 0.35-0.5 by stroke strength, +-5% rate | generated: TangoFlux (`generate.py`), prompt "Metal scraping and rattling as a rusty metal shutter is pushed"; picked takes s76733 (CLAP 0.22), s76723 (CLAP 0.20), s76743 (CLAP 0.15) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `shutter_roll_up_01..02.ogg`<br>2 x 2.75 s, ch1, heavy | Corrugated roller shutter rolling up freely, clunk at the top | Ch5 job (a) done: rolls up over 1.6 s | the 20 highpass noise bursts | no | fx, volume 0.5 | generated: TangoFlux (`generate.py`), prompt "corrugated steel shop roller shutter rolling up freely, loud rattling slats winding onto the drum, ending with a clunk at the top, street, daytime"; picked takes s43398 (CLAP 0.29), s43401 (CLAP 0.28) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `watch_hang_nail_01..02.ogg`<br>2 x 0.65 s, ch1, tick | Watch hung on a nail: small metallic clink, soft strap tap | Ch5 [walk.watch]: the watch on the nail | audio.tick({volume:0.3}) (spoke_key_02 was the stand-in) | no | fx, volume 0.4; weak match, listen first (keep tick() or spoke_key_02 otherwise) | generated: TangoFlux (`generate.py`), prompt "a wristwatch with a metal buckle hung on a nail on a wooden pegboard, a small metallic clink and a soft tap of the strap, close, quiet"; picked takes s64723 (CLAP 0.15), s64721 (CLAP 0.11) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `tool_hook_01..03.ogg`<br>3 x 0.41 s, ch1, foley | Hand tool lifted off a pegboard hook: short scrape and clink | Ch4 pegboard (sandpaper, plane, spoke key) | audio.scrape({volume:0.12}) on taking a tool (tool_take, a bench pick-up, was the stand-in) | no | fx, volume 0.55 (the files are peak-limited 6-7.5 dB under target) | generated: TangoFlux (`generate.py`), prompt "a hand tool lifted off a metal hook on a pegboard, a short scrape and metallic clink, workshop, close"; picked takes s81758 (CLAP 0.46), s81760 (CLAP 0.35), s81753 (CLAP 0.35) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `amb_workshop.ogg`<br>1 x 26.00 s, ch2, amb_int | Quiet workshop room tone: faint hum, street through a half-open garage door, light rain on the roof (loop) | Ch4 bed for all four days (Day 5 with rain; other days low-pass it or keep it very low) | new (Ch4 had music only) | yes | bus, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "quiet cluttered workshop room tone on a ground floor, faint electrical hum, distant street outside a half-open garage door, a little rain on the roof, no machines, no voices"; picked takes s20621 (CLAP 0.30) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `amb_stairwell.ogg`<br>1 x 20.00 s, ch2, amb_int | Old stairwell at night: concrete reverb, timer light, distant TV (loop) | Ch1 door beat: under the fade to black as he leaves (optional) | new | yes | bus, volume 0.3, fade in with the door | generated: TangoFlux (`generate.py`), prompt "old apartment building stairwell at night, reverberant concrete stairs, a timer light buzzing, a distant television behind a door, very quiet"; picked takes s18813 (CLAP 0.28) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `radio_talk_fishing.ogg`<br>1 x 20.00 s, ch1, radio | Small-speaker AM talk radio, a calm man talking, indistinct (loop) | Ch4 radio hotspot and Ch5 radio fishing station (optional) | optional upgrade of radioVoice's formant voice (crafts/radio.js); TTS through the radio band is preferred | yes | radio band (hp 300 / lp 3400), gain as radioVoice | generated: TangoFlux (`generate.py`), prompt "old AM radio talk show, a calm middle-aged man talking slowly about fishing, through a small transistor radio speaker, band-limited, slightly distorted, indistinct words"; picked takes s16063 (CLAP 0.29) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `chalk_line_01..02.ogg`<br>2 x 1.00 s, ch1, foley_soft | Chalk drawn along a rough painted brick wall: short dry scratch | Ch5 Odile's chalk guide (optional) | new | no | fx, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "a stick of chalk drawn along a rough painted brick wall, short dry scratchy stroke, outdoors, close"; picked takes s56570 (CLAP 0.35), s56559 (CLAP 0.21) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `step_wood_alt_01..05.ogg`<br>5 x 0.62 s, ch1, tick | Shoe step on old wooden floorboards | Ch1 flat and Ch4 workshop floor (the good foot) | footstep('concrete') indoors (alternative to step_wood) | no | bus, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "single footstep of a shoe on old creaky wooden floorboards in a quiet flat, one step, close, dry"; picked takes s13177 (CLAP 0.31), s13166 (CLAP 0.30), s13173 (CLAP 0.23), s13165 (CLAP 0.19), s13167 (CLAP 0.20) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `creak_wood_alt_01..03.ogg`<br>3 x 1.25 s, ch1, foley | Wooden bench creak under weight | Ch2/Ch5 bench sit; Ch5 panel ladder; Ch4 door hung in the frame | new (alternative to creak_wood) | no | fx, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "an old wooden bench creaking once as a person sits down on it, slow single creak, close, dry"; picked takes s71099 (CLAP 0.29), s71101 (CLAP 0.27), s71096 (CLAP 0.26) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `mug_clink_alt_01..02.ogg`<br>2 x 0.24 s, ch1, foley_soft | Ceramic mug set down on a wooden table: light clink | Ch1 seed: the mug on the table settles | audio.tone({freq:2400}) mug clink (alternative to mug_clink) | no | fx, volume 0.3 | generated: TangoFlux (`generate.py`), prompt "a ceramic coffee mug set down on a wooden table, small light clink, close, dry, quiet room"; picked takes s17689 (CLAP 0.18), s17687 (CLAP 0.14) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |
| `pencil_erase_alt_01..02.ogg`<br>2 x 1.50 s, ch1, foley_soft | Eraser rubbing out a pencil line | Ch5 walk.notebook: the strike lifted off 'Ride.' and 'Run.' | new (alternative to pencil_erase) | no | fx, volume 0.35 | generated: TangoFlux (`generate.py`), prompt "a rubber eraser rubbing out a pencil line on paper in a notebook, a few short strokes, close, quiet"; picked takes s29859 (CLAP 0.41), s29860 (CLAP 0.34) | TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic) |

## Generated (text-to-audio): `scripts/sfx/gen-prompts.json`

The sounds that no recorded source covered were generated locally with **TangoFlux** (`declare-lab/TangoFlux`, a 515M-parameter rectified-flow model with 44.1 kHz stereo output and clips of up to 30 s), driven by `scripts/sfx/generate.py`. The result is **89 files in 34 sets, 1.37 MB** after QA (see *QA*). They are built by `build.py` into `public/assets/sfx/` with the same trim, fade, loop, loudness and Opus rules as the recorded set, and listed in the catalogue above (Source column: `generated: TangoFlux, prompt "..."`).

- **Inference:** the script uses its own short pipeline built from `diffusers` / `transformers` classes (FluxTransformer2DModel, AutoencoderOobleck, T5EncoderModel) and the pinned safetensors weights. No code from the model repository is executed.
  - Settings: 50 steps, CFG 4.5, the item's negative prompt (default: music, speech, distortion, hiss and so on), on MPS.
  - Speed: about 8 s per take on the M5 Max (4 takes per batch).
  - One-shots are generated at 3 s or more, because TangoFlux was trained on clips of about 10 s and returns empty or garbled audio for sub-second requests. The event is then cut out of the take.
- **Steps** (all resumable, run with `nice -n 10`, venv `.cache/sfx/gen/venv`):
  ```sh
  V=.cache/sfx/gen/venv/bin/python
  nice -n 10 $V -I scripts/sfx/generate.py --root . gen score [--only a,b] [--batch 4] [--pause 3]
  $V -I scripts/sfx/generate.py --root . pick recipes
  .cache/sfx/venv/bin/python -I scripts/sfx/build.py --root .        # or scripts/assets/sfx.sh
  .cache/sfx/venv/bin/python -I scripts/sfx/verify.py public/assets/sfx
  ```
  1. **gen:** seeded takes go to `.cache/sfx/gen/takes/<name>/s<seed>.wav`.
     - Existing takes are skipped.
     - When an item's prompt, negative prompt, length, steps or CFG changes, that item's takes are redone.
     - `extra_takes` on an item adds seeds for items with a low yield.
  2. **score:** each take gets a LAION CLAP (`laion/larger_clap_general`) audio-to-prompt cosine and some artifact checks, written to `.cache/sfx/gen/scores.json`. The checks are:
     - hard rejects: silent, clipping, no event (a short one-shot whose peak is less than 12 dB over its median), too short, and quiet (18 dB under the loudest sibling; not applied to beds);
     - penalties (−0.04 each): glitch, level jump, unsteady loop, seam mismatch, dropout, noisy, weak event, and overrun (−0.02).
  3. **pick:** the best `variants` takes by CLAP minus penalties.
     - Takes listed in the item's `exclude` (`{take: reason}`, set by QA or by listening) are never picked.
     - Only takes within 0.15 of the item's best CLAP (and ≥ 0.10) qualify.
     - Near-duplicates (embedding cosine > 0.97) are skipped.
     - One-shots are spectrally gated (TangoFlux leaves a steady hiss) and trimmed to the event. The trim starts where the 20 ms level rises 10 dB over the take's hiss floor (QA fix).
     - Picked files go to `.cache/sfx/dl/gen/<name>_NN.wav`, and the list to `.cache/sfx/gen/picks.json`.
  4. **recipes:** writes `scripts/sfx/recipes-gen.json`, which `build.py` and `catalogue.py` merge into `recipes.json`.
- **Fresh checkout:** `build.py` skips a generated recipe whose `.cache/sfx/dl/gen` sources are missing and keeps whatever was built before. `scripts/assets/sfx.sh` never runs the generator, because that needs about 6 GB of weights and about an hour on the GPU.
- **Rephrased prompts:** five items gave few usable takes with their first, descriptive prompt. They were rephrased as short AudioCaps-style captions, the style the model was trained on, and given `extra_takes`: `watch_buzz_wrist`, `breath_run_loop`, `shutter_runner_scrape`, `brake_rub`, `paint_slosh`. Both boot steps were rephrased the same way.
  - The first wording is kept as `prompt_v1` in `gen-prompts.json`, and its takes are in `.cache/sfx/gen/takes-v1/`.
  - The rephrased prompts raised the best CLAP from 0.04 to 0.22 (shutter scrape), 0.15 to 0.30 (brake rub), 0.12 to 0.24 (paint slosh), and 0.15 / 0.19 to 0.28 / 0.27 (boot steps on wood / wet).
- **Loudness:** many generated transients are peaky, so the −1.5 dBTP cap pulled some variants 3–9 dB under their category target. The worst are `paint_lid_open_01` (−9.3 dB), `tool_hook_02` (−7.7 dB) and `boot_step_wood` (up to −7.5 dB). Set the level at runtime with the per-cue volume; the Integration list already does. `verify.py` and `qa.py` report 0 problems across all 198 files.

### Generated sets (CLAP per pick, CLAP to the catalogue description, size)

| Set | Files | CLAP to prompt (per pick) | CLAP to description (best; rank of 85) | Size | Note |
|---|---|---|---|---|---|
| `phone_vibrate_table` | 1 of 3 | 0.18 | 0.28 (4) | 11 KB | QA: 2 picks were hiss with a blip (one raised 26 dB); 8 more takes gave none usable |
| `watch_buzz_wrist` | 1 of 3 | 0.11 | 0.16 (3) | 8 KB | weak; not used (procedural `buzz()` stays) |
| `tv_crt_off` | 1 of 2 | 0.23 | 0.33 (3) | 11 KB | QA: the trim now skips 0.8 s of lead-in hiss; the second take fell below the floor |
| `boot_step_wood` | 6 | 0.28, 0.27, 0.25, 0.21, 0.21, 0.19 | 0.20 (11) | 17 KB | rephrased; QA swapped the 0.14 s click `_06` for s11990 |
| `boot_step_wet` | 6 | 0.27, 0.26, 0.26, 0.25, 0.24, 0.24 | 0.30 (1) | 23 KB | rephrased |
| `run_step_wet` | 6 of 8 | 0.31, 0.28, 0.24, 0.23, 0.22, 0.21 | 0.34 (1) | 19 KB | QA dropped the 0.14 s `_07` |
| `breath_run_loop` (loop) | 2 | 0.23, 0.27 | 0.39 (1) | 133 KB | rephrased |
| `crack_pencil_lead` | 4 | 0.39, 0.29, 0.28, 0.28 | 0.38 (1) | 11 KB |  |
| `fluoro_flicker` | 3 | 0.26, 0.25, 0.14 | 0.17 (5) | 33 KB |  |
| `club_pass_wet` | 2 | 0.30, 0.27 | 0.22 (4) | 136 KB |  |
| `paint_lid_open` | 2 | 0.16, 0.19 | 0.08 (12) | 19 KB |  |
| `paint_stir_loop` (loop) | 2 | 0.30, 0.27 | 0.44 (1) | 91 KB |  |
| `paint_drop` | 5 | 0.20, 0.16, 0.14, 0.13, 0.11 | 0.25 (3) | 13 KB |  |
| `paint_slosh` | 2 | 0.27, 0.20 | 0.24 (2) | 19 KB | rephrased; QA: `_02` no longer starts on 1.3 s of hiss |
| `tape_pull` (loop) | 3 | 0.31, 0.18, 0.17 | 0.28 (2) | 31 KB | QA swapped the hiss-and-clicks `_03` for s58332 |
| `tape_retract` | 3 | 0.25, 0.21, 0.16 | 0.29 (2) | 22 KB |  |
| `tape_tock` | 1 of 3 | 0.25 | 0.03 (36) | 4 KB | QA dropped two takes that matched neither prompt nor description |
| `freewheel_tick` (loop) | 2 | 0.44, 0.43 | 0.39 (2) | 55 KB |  |
| `freewheel_coastdown` | 2 | 0.38, 0.26 | 0.35 (1) | 71 KB |  |
| `brake_rub` | 4 | 0.30, 0.23, 0.21, 0.20 | 0.28 (2) | 13 KB |  |
| `chain_drop` | 2 | 0.17, 0.18 | 0.23 (2) | 16 KB |  |
| `chain_on` | 2 | 0.40, 0.40 | 0.24 (1) | 37 KB |  |
| `shutter_runner_scrape` | 3 of 6 | 0.22, 0.20, 0.15 | 0.10 (22) | 14 KB | rephrased; QA dropped the two weakest |
| `shutter_roll_up` | 2 | 0.29, 0.28 | 0.16 (9) | 35 KB |  |
| `watch_hang_nail` | 2 | 0.15, 0.11 | 0.09 (20) | 5 KB | weak; audition before use |
| `tool_hook` | 3 | 0.46, 0.35, 0.35 | 0.19 (3) | 11 KB |  |
| `amb_workshop` (loop) | 1 | 0.30 | 0.26 (1) | 174 KB | 26 s, not 40 s (the model's 30 s limit) |
| `amb_stairwell` (loop) | 1 | 0.28 | 0.25 (1) | 138 KB |  |
| `radio_talk_fishing` (loop) | 1 | 0.29 | 0.39 (1) | 96 KB | babble, not words; TTS through the radio band is preferred |
| `chalk_line` | 2 of 3 | 0.35, 0.21 | 0.21 (12) | 13 KB | QA: trim now on the stroke (was 1 s of hiss) |
| `step_wood_alt` | 5 | 0.31, 0.30, 0.23, 0.19, 0.20 | 0.30 (3) | 19 KB | alternative to `step_wood` |
| `creak_wood_alt` | 3 | 0.29, 0.27, 0.26 | 0.22 (6) | 22 KB | alternative to `creak_wood` |
| `mug_clink_alt` | 2 | 0.18, 0.14 | 0.15 (4) | 3 KB | alternative to `mug_clink` |
| `pencil_erase_alt` | 2 | 0.41, 0.34 | 0.54 (1) | 17 KB | alternative to `pencil_erase` |

**How to read CLAP:** this model's audio-to-text cosine is about 0.3–0.45 for a clear match and 0.1–0.2 for a plausible but weak one. The recorded Kenney and OGA files that the `_alt` items replace scored −0.10 to −0.02 against their own descriptions. Nobody has listened to these files yet: the picks rest on CLAP and the automatic checks only, so audition them before wiring them in.

**Short sets:** seven sets have fewer variants than planned: `phone_vibrate_table` 1/3, `watch_buzz_wrist` 1/3, `tv_crt_off` 1/2, `tape_tock` 1/3, `run_step_wet` 6/8, `shutter_runner_scrape` 3/6 and `chalk_line` 2/3. A runtime helper that picks a random variant handles this; use rate jitter on the one-variant sets. To fill a set, raise its `extra_takes` (or rephrase it), then run `gen score pick recipes` with `--only <name>` and rebuild.

## QA (`scripts/sfx/qa.py`)

`verify.py` checks only the true peak, the integrated loudness and the loop wrap step. `qa.py` re-measures every file against its category and the doc:

```sh
nice -n 10 .cache/sfx/gen/venv/bin/python -I scripts/sfx/qa.py --root . --clap --doc [--json .cache/sfx/qa/qa.json]
```

- **Format:** Ogg Opus, 48 kHz, the manifest's channel count. Manifest, recipes and directory must agree (no orphan or missing files).
- **Loudness:** measured with the category's own measure (integrated, or max momentary over 400 ms), within 1.5 dB of the target. A file may be under the target only by the true-peak cap `build.py` logged, or when its peak already sits at the ceiling.
- **Peak:** true peak ≤ −1 dBTP, no sample at full scale, DC under 0.01. A source raised more than 15 dB is flagged, because its noise floor came up with it.
- **Loop seams:** the wrap step must be ≤ 1.5 × the 99th-percentile sample step. The level and the spectral tilt 50 ms either side of the wrap are compared with the same measure at every 25 ms inside the file; a seam is flagged only when the wrap jumps more than 98 % of the file does.
- **Silence:** beds must have no dropout (≥ 0.4 s more than 35 dB under the median). One-shots must have a lead-in of ≤ 30 ms before the event, no internal gap of ≥ 0.4 s, and a tail of ≤ 0.35 s more than 45 dB under the peak.
- **Duration:** by category. One-shots must be at least 0.12 s. Beds must be at least 15–20 s.
- **Stereo:** beds must not be dual mono, and their L/R correlation must not be negative (the bed would cancel on a mono phone speaker).
- **CLAP** (`--clap`): the LAION CLAP cosine of each file against its catalogue description, plus the rank of that description among all 85. A file is flagged when the cosine is under 0.10 and the rank is worse than 10.
- **Doc** (`--doc`): every audit row has a verdict and names only built sets. Every set has a catalogue row with a licence and appears in the Integration list.
- **Size:** the total must be under 25 MB.

### Findings and fixes

| Found | Fix |
|---|---|
| Opus lowers the K-weighted loudness of bright, noisy material by 1–2 dB. 38 files in 20 sets (sanding, brushes, plane, shutters, tape, page flips, `radio_tune_sweep`, `freewheel_*` and others) came out 1.5–3.3 dB under target beyond any true-peak cap. | `build.py` now decodes each encode, measures it and corrects the gain. It tries up to 6 gains and keeps the encode closest to the target whose decoded true peak is ≤ −1 dBTP. 104 files were corrected, by −0.3 to +2.5 dB. |
| **Stale-build bug:** the build hash covered the recipe only. A re-picked generated take keeps its file name (`gen/<name>_01.wav`), so its new audio would never have been rebuilt. | The hash now includes each source's metadata, size and mtime (`BUILD_VERSION` 8). |
| `sfx.json` could be left half-written by a failed run, and the next run then lost track of stale variants. | The manifest is now written atomically (`.part`, then rename). |
| Generated one-shots started on up to 1.3 s of model hiss before the event. The trim threshold sat under the hiss, and the onset search took the earliest onset anywhere before the event. The worst were `tv_crt_off` (0.8 s), `paint_slosh_02` (1.3 s) and `chalk_line` (1 s), while `watch_buzz_wrist_01` was mostly hiss. | `generate.py` `trim_bounds()` now starts on a 20 ms-smoothed level 10 dB over the take's floor and takes the onset within 0.1 s of it. Ten sets were re-scored and re-picked. |
| Bad picks: `phone_vibrate_table_02` was steady hiss raised 26 dB with one blip, `_03` was a single blip, and `tape_pull_03` was hiss with two clicks (raised 21 dB). Others failed both CLAP checks or were 0.14 s fragments: `tape_tock_02/03`, `shutter_runner_scrape_04/05`, `run_step_wet_07` and `boot_step_wood_06`. | A new `exclude` field (`{take: reason}`) in `gen-prompts.json` vetoes takes, and `pick` honours it. 8 more phone takes were generated (`nice -n 10`, batches of 4); none was usable, so the phone set has one variant. |
| `amb_marathon_crowd` had an L/R correlation of −0.54 (−0.75 at 1–4 kHz) and lost 6.3 dB when summed to mono. `amb_dawn_birds` was at −0.26 and lost 4.3 dB. | The recipes narrow them with `extrastereo` (m = 0.45 and 0.6). The correlation is now +0.23 and +0.25, with about 2 dB lost in mono. |

**Result:** 198 files in 85 sets, 6.16 MB of the 25 MB budget. `qa.py` reports 0 errors and `verify.py` 0 problems. All 29 loops wrap at ≤ 1.0 × the sample step, with no level or tone seam. `scripts/assets/sfx.sh` run twice: the second run downloads nothing, rebuilds nothing, leaves the output byte-identical and takes about 1 s.

### Advisories left (no fix needed, or a listen decides)

- **Short-clip CLAP:** CLAP is unreliable under about 0.5 s. The genuine recorded Kenney steps, creaks, mug clinks and tin taps score −0.11 to 0.08 against their own descriptions and rank 11–47 of 85. Low scores on the short generated clips are therefore not evidence of a wrong sound; `boot_step_wood`, `tape_tock`, `shutter_runner_scrape`, `paint_lid_open` and `watch_hang_nail` sit in the same range. Of these, only `watch_hang_nail` and `watch_buzz_wrist` are weak against their own prompts too. The Integration list keeps the procedural cue for both.
- **Peak-limited one-shots:** `paint_lid_open_01` (−9.3 dB), `tool_hook_02` (−7.7 dB) and `boot_step_wood` (up to −7.5 dB) are as loud as their peaks allow. Their volumes in the Integration list compensate.
- **Raised sources:** `hammer_floor_06`, `step_wood_alt_01/05` and `boot_step_wet_06` were raised 15–18 dB. Their floors stay 35 dB or more under the event. `run_step_wet_02/03/06` and `boot_step_wet_06` keep a wet-street floor 17–20 dB under the step, which suits the rain.
- **Recorded lead-ins:** the doors, the garage door, Velcro, page flips and creaks have 40–180 ms of latch or build-up before their loudest moment. The Integration list starts them early.
- **Nobody has listened yet.** Before wiring, audition the generated sets, starting with the one-variant ones (`phone_vibrate_table`, `tv_crt_off`, `tape_tock`) and the A/B alternatives.

## Sources and licences

- **BBC Sound Effects archive** (`sound-effects.bbcrewind.co.uk`): 35 WAVs. They come from the public search API (`POST https://sound-effects-api.bbcrewind.co.uk/api/sfx/search`) and are downloaded directly from `https://sound-effects-media.bbcrewind.co.uk/wav/<id>.wav`. No login is needed.
  - **Licence: RemArc**, for personal, educational and research use only. It is fine for this personal, unpublished project.
  - Credit: "© BBC".
  - A public or commercial release needs a licence from BBC / Pro Sound Effects, or replacements. The CC0 packs are the replacement path. The generated set is non-commercial too (TangoFlux licence, below).
  - The BBC files cover the hammer, rain on the window, fridge, strip light, TV bed, doors, both night streets, the neon hum, running feet, the metal squeaks, drips, the paint brush, dawn and evening birds, night traffic, the marathon crowd, sanding, the plane, tools, the kettle, static and tuning, the garage door, the Paris square, the SLR shutter, the bicycle bell and the bicycle passes.
- **Kenney** (CC0):
  - [RPG Audio](https://kenney.nl/assets/rpg-audio): book flips, open and close, creaks, metal click and latch.
  - [Impact Sounds](https://kenney.nl/assets/impact-sounds): tin, light wood, light plate, soft heavy and wood footsteps. This is the same zip `fetch-assets.sh` uses, cached separately here.
- **OpenGameArt** (CC0):
  - ["202 More Sound Effects"](https://opengameart.org/content/202-more-sound-effects) by owlishmedia: Velcro ×3, Camera_01.
  - ["Pencil Sounds"](https://opengameart.org/content/pencil-sounds) by antumdeluge: write and erase, originally Freesound #571800 / #443241, CC0.
  - ["Breathing Tired"](https://opengameart.org/content/breathing-tired) by mikeask.
- **Generated (TangoFlux)**: [`declare-lab/TangoFlux`](https://huggingface.co/declare-lab/TangoFlux), pinned at revision `367005e9`, with `google/flan-t5-large` (Apache-2.0) as the text encoder.
  - **Licence:** non-commercial and research only. It combines the Stability AI Community License (it uses the Stable Audio Open VAE), the WavCaps academic-use condition, and the licences of the training sets. That is fine for this personal, unpublished project; a commercial release needs other sources.
  - **Notice:** the licence asks for this notice to be kept: "This Stability AI Model is licensed under the Stability AI Community License, Copyright © Stability AI Ltd. All Rights Reserved." It also asks for "Powered by Stability AI" (it is in the credits line above).
  - **Scoring only:** LAION CLAP `laion/larger_clap_general` (Apache-2.0) ranks the takes and is not used for any output.
  - **Weights:** cached in `~/.cache/huggingface` (about 6 GB). The takes and the picks are in `.cache/sfx/gen/` and `.cache/sfx/dl/gen/`.
- **Considered and skipped:**
  - **Freesound** needs an API key or a login for downloads.
  - **Sonniss GDC bundles** are royalty-free but come only as multi-GB yearly archives. The BBC set already covered what they would add here, so 10–30 GB was not downloaded for a handful of files.
  - **Poly Haven** has no audio.
- **Original downloads:** kept in `.cache/sfx/dl/<source>/`, with each archive extracted into its own directory (audio members only). No downloaded script is executed.
