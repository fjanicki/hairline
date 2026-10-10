# HAIRLINE: Design Spec (rework of "9.81")

Revision 2. The editor and producer critiques are applied here. The points I rejected or changed are listed in "Editorial notes" at the end.

## Context
- **Project:** `/Users/fjanicki/workspace/ai/demo` already holds a working Three.js r186 + Vite 8 game, "9.81". This spec turns it into a new story, **HAIRLINE**. It keeps the engine and the five-chapter format.
  - The old story spec is archived at `docs/DESIGN-981.md`. Its writing is the quality bar.
  - A backup of the old code is in `.cache/v1-981`. Do not edit it.
- **What stays as it is:**
  - Engine, Input, Hotspots, Runner, FollowCam, debug hooks and the controls scheme.
  - Director (gates, `say`/`think`/`card`/`correct`/`interact`/`until`), apart from the two default speaker names.
  - Chapter count (5) and the module contract (`chN.js` + `sceneN.js`).
- **What changes:**
  - All story text, the five chapters and scenes, and the mood presets.
  - A **grime pass** in the post shader.
  - Two new HUD pieces: the **GPS watch** and the **"WHAT I CAN DO" notebook**.
  - A **walking boot** on the player.
  - A small minigame module.
  - **Text is split per chapter.** It lives in `src/story/text/{common,ch1..ch5}.js`, and `src/story/script.js` assembles and re-exports `L`. Each chapter agent owns its own text file.
  - Every engine change is listed exactly in "Core changes needed".
- **Brief (from the user):**
  - The protagonist's name is a variant of one the user gave. **The original surname is never used anywhere**, including code, comments and credits.
  - He is a former pro cyclist who turned to long-distance running. His injury is a microfracture from simply running too much.
  - The game leads him to things other than sport (art, DIY) and **expands what he is able to do**.
  - The multi-chapter format stays, with a grimy look.
- **Target:** about 11–12 minutes of play (see the pacing budget). No fail state blocks progress, every minigame finishes with no input, and every beat can be skipped with `__game.debug.skip()`.
- **Assets** (as built; all CC0, fetched by `npm run setup:assets`, listed in `docs/CREDITS.md`):
  - Characters and animations: the Quaternius "Universal" modular cast (the original Xbot plan is gone; nothing is Mixamo).
  - Hero props: Poly Haven photo-scans. Large surfaces: Poly Haven PBR sets and ambientCG grime. Lighting: Poly Haven HDRIs.
  - A few restyled Kenney pieces as distant street filler (skyline blocks, cones, bottles, pallets, a dumpster).
  - Music and ambience: `contemplation.mp3`, `piano.ogg` (transcoded from the OGA WAV), `rain.ogg`, `crowd.ogg` (OpenGameArt; authors and pages in CREDITS.md). Concrete footstep samples (Kenney).
  - Bicycles, the boot, the watch, the workbenches, the garage door, the facades, the blind wall, the mural and all signs are procedural.
  - See "Art direction (as built)" for the look.

## Concept & Story

**Title:** HAIRLINE
- It names the injury: a hairline stress fracture of the tibia.
- It also names the craft: a sign painter's *hairline* is the thinnest stroke a brush can pull, and the hardest.
- The doctor says *"thinner than a hair... all the way through"* about the crack (Ch3). Odile says *"Thinner than a hair. You pull it all the way through"* about the stroke (Ch4). Hugo hears the echo, and so does the player.

**Tagline:** *The crack was thinner than a hair. It went all the way through.*

**Protagonist:** Hugo Revel, 37.
- He was a professional road cyclist from 21 to 33: twelve years as a domestique. *"I spent twelve years pulling other men up mountains."*
  - He never won a race. That wasn't his job.
  - Before the team, he built his own wheels. Mechanics were for people who won.
- He retired at 33 and needed a number of his own, so he took up running: marathons, then ultras.
- The GPS watch became the job, and his weekly totals climbed past 200 km.
- **The number:**
  - On Saturday of his last week the watch read **170.2 km**.
  - On Sunday he ran the city marathon "as a training run". At kilometre 31 his left tibia cracked, and he ran the last 11.2 km on it anyway.
  - The week closed at 170.2 + 42.2 = **212.4 km**. The watch counted the broken kilometres the same as the rest. That is the injury in one number.
- It was not an accident. It was accumulation he ignored: a tender spot the size of a coin, ibuprofen, the stairs taken the long way round.
- **Verdict:** a stress fracture of the left tibia, mid-shaft, "the dreaded black line". Twelve weeks in a walking boot, no impact. Swimming and cycling are allowed. He refuses both.
- His whole identity was output and numbers. This week's output is 0.0.

**Cast:**
- **Odile Marchal, 74.** A retired sign painter who runs a cluttered repair workshop on the ground floor of Hugo's building, No. 14 Rue des Tanneurs. She is the hammering he hears through the floor at night.
  - She did the hairlines in her father's sign shop, "MARCHAL & FILLE". She was the *fille*.
  - Her hands shake now. Big letters she can still bully; the thin ones are gone.
  - Her manner is dry and practical, and she cannot stand sentiment.
  - **Her want:** she needs hands, and asking is the hardest thing on her list. She ropes Hugo in by giving orders, because that is easier than asking. In Week 7 she nearly asks and can't. The ending card gives her a list of her own, with one new line: "Ask."
  - Tint: ochre apron `#9a7a4e`. Scale 0.94.
- **Sami Haddad, 11.** A kid with a road bike far too big for him. Mr Durand gave it to him when the bike shop shut ("He said find a wheel man"). The rear wheel is out of true.
  - He is cheeky and literal, and he asks the questions adults don't.
  - He wants the bike fixed, then he wants to fix it himself, and he ends up fixing punctures for the street.
  - Tint: red hoodie `#c24a3a`. Scale 0.72.
- **Bastien, 40s.** Captain of the local run club. He is a nice man who lives entirely inside his watch, and he never lets it pause. He is Hugo's mirror: in Ch5, his shin is "a bit loud".
  - Tint: hi-vis yellow `#d6e04a`. Four club runners join him in muted hi-vis tints.
- **Dr Okafor:** voice only (voicemail, flashback).
- **STRIDE:** the watch and its app, the brand on the billboard. It talks only in notifications.
- **Neighbours (Ch5):** Mme Benali (bakery), Marco (kebab shop) and Ines, 16 (the kid who used to tag the wall).

**Setting:** Rue des Tanneurs, an old tannery street in a tired northern town, in winter.
- Wet cobbles and asphalt, shuttered shops, rusted downpipes, stains and torn posters, fluorescent tubes that buzz and fail.
- It is not post-apocalyptic. It is a street nobody has painted since the seventies.

**Thesis:** colour is hope, and **colour comes back first on the things he makes**.
- The world starts grey and grimy.
- The flashback is acid sports neon: STRIDE green, the hi-vis high of the old life. It drains as the kilometres climb.
- In the workshop, colour returns on a door he sanded and painted, then on a wheel he trued, then on a sign he lettered.
  - Each object keeps its own focus slot (`mood.focusOn(obj, {slot, floor})`), so the colour **accumulates** rather than jumping from one object to the next.
  - The sign's bloom then spreads to the room.
- By the end the whole street is warm: ochre, brick and cream, not neon. The new life is not the old life repainted.
- **The notebook is the thesis made visible.**
  - The list starts as "Ride. Run.", and both are lightly crossed out.
  - Its first new entry is the opposite of running: **"Hold still."**
  - It grows with every skill.
  - At the end, "Ride." and "Run." are un-struck, and "Run." gets "(some Sundays)". The last line is the one the flashback never let him choose: **"Rest."** In the ending he chooses it from a STRIDE menu, the only menu in the game where Rest means rest.
- **Nobody states the change.** The player does it: sanding, mixing, truing, lettering, the line. The ending lines are memories, not morals.

**Controls** (the scheme is unchanged; only the descriptions are new):
- WASD or arrows: move. WASD also steadies a brush (Ch4 lettering; W/S in the Ch5 line).
- Shift: try to jog.
- E: interact or advance dialogue.
- Space: timing prompts only (truing the wheel). It never advances dialogue.
- A/D alternating: the steady rhythm (running in Ch3, sanding in Ch4).
- 1–3: choices.
- M: mute.
- Esc: pause.

The title screen controls list is `L.title.controls`.

### Opening card (white on black, one line at a time; E or click skips) `[L.opening]`
> Hugo Revel was a professional cyclist for twelve years.
> He never won a race. That wasn't his job.
> When it ended, he took up running. Then he kept going.
> Last week, he ran 212.4 kilometres.
> At kilometre 31 on Sunday, his left shin cracked along a line thinner than a hair.
> He finished the race.
> This week: 0.0.

### Stumble lines (pain at 1 while in the boot) `[L.stumble]`
- The first stumble of the game is fixed: *"Twelve weeks. This is day four."*
  - This line is only true in Ch1 and Ch2, which happen on the same night. Ch4 and Ch5 set `player.firstStumbleDone = true` at the start of `run()`. Ch3 has no stumbles.
- Later stumbles draw from a shuffled bag, with no repeats until every line has played:
  - "Bone doesn't negotiate."
  - "This boot weighs more than my race wheels."
  - "Thinner than a hair. Still wins."
  - "Twelve weeks is eighty-four days. I've done the maths. Twice."
  - "I know. I *know*."

### The two clocks (continuity)
- **The boot clock** is the only calendar on screen. Boot day 1 is the Monday after the race.
  - Ch1 and Ch2 happen on boot day 4.
  - The Ch4 cards are "Day 5.", "Day 8.", "Week 4." and "Week 7.". The Ch5 card is "Week 12.".
  - Odile's "Twelve weeks from the Sunday" in Ch5 agrees with it.
- **The flashback** uses training-block weeks ("TRAINING BLOCK — WEEK 9"), not calendar weeks.
- **Recurring numbers.** Each number is deliberate and none repeats by accident:
  - 212.4 is last week. 170.2 is Saturday's total. 11.2 is the kilometres run on the crack. 42.2 is the race.
  - 38 is the number of race bibs. 52 is "YEARS" on the Durand sign. 40 is Odile's forty years of hairlines. 20 is the metres in the line.
- **The watch** is docked bottom-right (where the stopwatch was). Its label tells the truth:
  - Ch1 and Ch3 training: `THIS WEEK`.
  - Ch2: `WALK`.
  - Ch3 race: `RACE`.
  - Ch4 and Ch5: `RUN · THIS WEEK`, so the 0.0 stays true while he walks everywhere.

---

### Ch1 "No Impact": the flat, night `[L.ch1]`
- **Location:** Hugo's third-floor flat, using the existing 6×5 m dollhouse room (`scene1`, +Z wall omitted).
  - It is grimier than before: damp blooms in the corners, nicotine-brown walls, a stained ceiling edge and peeling paper by the window.
  - A dead plant, takeaway boxes and a bin bag sit by the door.
- **Mood:**
  - hope 0.04 → 0.06 (watch) → 0.07 (door)
  - preset `flat`: ambient green-grey `#5d665a`; no fog; grain 0.07; dirt 0.4
  - the TV PointLight `#9fb7d6` is the flickering key light
  - a failing fluorescent strip `#cfe6d0` over the kitchenette buzzes and blinks every ~7 s
- **Player:** `boot: true`, limp 1.0, painRate 1/0.7 s, footsteps `'boot'`.
- **Mechanic:**
  - Heavy limp in the boot.
  - The hint "Hold Shift to jog" (`L.hints.jog`) appears after 10 s.
  - The first stumble always says `L.stumble.first`.
- **Hammering through the floor:**
  - From t = 8 s, a burst of three steady blows (`audio.hammer()`, 0.9 s apart) plays every ~9 s until Hugo leaves.
  - The first burst fires the non-blocking thought `[hammer]`: *"Somebody downstairs is hammering. Nine at night. Same rhythm for an hour. No hurry at all. I sort of hate them."*
  - This plants the steady rhythm of the craft minigames.
- **Hotspots** (all optional unless marked REQUIRED):
  - **TV** (prompt "Watch") `[tv, tvOff, tvTicker]`:
    - A cycling broadcast on a CanvasTexture: a peloton on a switchback, with the ticker "STAGE 17 — COL DU GRAND FERRAND".
    - **TV:** "...and that's the work done for the domestiques. One by one they peel off the front, empty. Job finished."
    - E turns it off, and the key light dies.
    - *"Nobody films them after. They drift back through the team cars and ride down to the bus on their own."*
  - **Phone** (coffee table, "Check phone") `[phone]`:
    - **Phone:** "12 unread."
    - **Mum:** "Are you eating? Don't answer. Just eat."
    - **STRIDE:** "Weekly summary: 0.0 km. Let's get back on track!"
    - **Bastien (Run Club):** "Heard about the leg mate!! Rest up legend. Sunday long run NOT the same without you"
    - **Voicemail, Dr Okafor's office:** "Mr Revel, Dr Okafor's office. A reminder that the boot stays on, including in bed, and no impact of any kind for twelve weeks. Dr Okafor asked me to add, and I'm reading this out, 'That includes a little jog to see how it feels.'"
    - *"Twelve unread. I'll answer them when I've got something to report."*
  - **GPS watch** (on its charger on the window sill, "Take the watch"), REQUIRED `[watch, watchHud, watchAfter, buzz, buzzReply]`:
    - *"Still on the charger. Still counting. It doesn't know."*
    - The **watch HUD** appears: face `0.0 km`, label `THIS WEEK`, lap `LAST WEEK 212.4`.
    - *"Two hundred and twelve point four. Eleven point two of that on a broken leg."*
    - *"It counted them the same."*
    - The watch buzzes `TIME TO MOVE! You've been still for 1 hr.`, followed by *"Thanks."*
    - Hope → 0.06.
  - **X-ray** (taped to the fridge, "Look") `[xray]`:
    - *"Dr Okafor circled it in biro. I still had to ask where."*
    - *"He called it 'the dreaded black line'. Then he said sorry, that's just what it's called."*
    - *"He said I could swim, if I needed to move. I said I sink. He wrote that down."*
  - **Race bike** (on two hooks on the left wall, "Look") `[bike]`:
    - `build.bicycle({rust: 0.8})`, with faded team stickers.
    - *"Twelve years I kept that chain cleaner than my teeth. Four years on a hook and it's gone orange."*
    - *"The doctor says I'm allowed this one. No impact. I told him I've done my twelve years."*
    - *"I keep meaning to sell it. But someone would ask what it's won."*
  - **Race bibs** (pinned in rows above the bed, "Look") `[bibs]`:
    - *"Thirty-eight race bibs. I kept every one."*
    - *"I couldn't tell you what a single course looked like. I can tell you every split."*
- **Objectives:** "Look around." After the watch: "Go for a walk."
- **Advance:**
  - Once the watch is taken, the door zone switches on (prompt "Go out").
  - Hugo stops at the door `[door]`:
    - *"Walk, if you must, he said."*
    - *"I must."*
  - The watch buzzes `START WALK?`, and the prompt `[E] Start` appears.
  - On E, the face shows `WALK` and the screen fades to black. The hammering carries through the fade.

### Ch2 "Never Stop": Rue des Tanneurs, late evening, rain `[L.ch2]`
- **STREET CONTRACT** (frozen, so the Ch2 and Ch5 agents can work in parallel):
  - `buildScene2(ctx, {variant: 'evening' | 'wall'})`, owned by the Ch2 agent. Both variants are built here, including the mural panel geometry.
  - **Layout:**
    - Road along −Z. Spawn z range +8…+3, so `maxZ` is 9.
    - **Blind wall:** x −5.95, z −12…−32, height 8, face +X. One procedural box with `grimeTexture` (not retro modules).
    - **STRIDE billboard** at z −18, bolted to the wall.
    - **Ghost sign:** right side, z ≈ −10, high on the brick.
    - **Bench:** [−5.32, −36.5].
    - **Closed bike shop:** x +5.95, z −34.
    - **No. 14 workshop door:** [0, −48]. Odile's scaffold tower: [−1, −46], under a deep awning.
  - The `'wall'` variant also returns:
    - `panels: [{id, mesh, z0, z1, color, setColor(k)}]` (Ch5 drives `setColor` as the line passes)
    - `spots.{odileChair, saunter, nail, bench, seat}`: `bench` is where Hugo stands to use the bench, `seat` is on the planks
    - `interior` (the workshop room box; Ch5 keeps its pegboard in front of `interior.minZ`), `nailPos`
    - `setGolden()`
  - Ch5 falls back to a local stand-in street only if the wall variant fails to build.
  - **R4 variants (owner SETS, 2026-10-08; appended, the two variants above are unchanged).** `buildScene2(ctx, {variant: 'evening' | 'wall' | 'day' | 'night', text})`. `text` overrides the R4 dressing (`encre`, `encreTrade`, `durandPhoto` « Albert Durand, 1974 », `durandTin` « Bleu Durand, 1979, O. M. »); `L.ch2.signs.<key>` wins over the defaults too. The neon reads `L.ch2.signs.kebab` (« CHEZ GÉRARD »).
    - **Layout changes:** ENCRE FINE replaces row house B1 (left, z −36.5…−42.2, behind the bench, diagonally across from CYCLES DURAND): a real room behind the glass (flash wall, tattoo bed under an articulated lamp, the light table for STENCIL, ink trolley), an oxblood front and a blade sign. Gérard's building has five levels; Lou's window is the 4th-floor one. The bench has 22 narrow slats; three (`BENCH_FIXED`) are rotten until the Night Fixer replaces them in Bleu Durand. The scene2/ modules: `encre.js`, `durand.js`, `fixes.js`, `rooms.js` (walk-in ground floors), `r4art.js` (canvas art).
    - **Every variant** also returns `encre` (`door`, `setOpen(k, secs)`, `setTilt(r)`, `straighten(secs)`, `setLight(k)`, `light`, `focus {table, sign, flash}`; the room is walkable while the door is open), `bench` (`set(fixed)`, `focus`), `lights.bench` (the lamp over the bench) and `lights.encre`, spots `encre`, `joDoor`, `encreInside`, `encreTable`, `encreSign`, `stakeoutBench`, `benchLamp`, and shots `encre`, `encreTable`, `encreInside`, `stakeout`, `stakeoutWide`, `benchSlats`.
    - **'evening' (Ch2):** as before, plus ENCRE FINE with no gilt name yet, its blade sign hanging crooked (−0.21 rad; `encre.straighten()` when Jo fixes it), Jo's stepladder (`encre.ladder`), `encre.joLadder {pos [x, y, z], facing}`, `spots.joLadder`, shot `jo`. From 'wall' on the sign is straight and the fascia is lettered.
    - **'day' (R4 Ch5, Weeks 2–6):** overcast morning, wet 0.4, puddles, billboard and fly-posters still up, no mural, No. 14's door half down (the workshop is its own scene: the street bounds stop at the awning). Spots `benaliDoor`, `shutter`, `gerardCounter`, `neon`, `louWall`, `samiKerb`, `bastien`, `bastienStart`, `bastienEnd`, `bastienRoute`, `oldManSeat`, `oldManBike`, `print`, `durandDoor`, `durandInside`, `durandBench`, `durandPhoto`, `durandCalendar`, `durandTin`, `durandOutlines`, `durandPhotos`, `durandCard`, `nightLoop`. Shots `hub`, `bakery`, `shutterRail`, `croissant`, `gerard`, `neon`, `louWindow`, `print`, `durandDoor` (KEY RING), `durandInside`, `durandBench`, `durandPhoto`, `durandCalendar`, `durandOutlines`, `durandCard`.
    - **'night' (R4 Ch6 Week 9, 3 a.m.):** sodium lamps, wet 1, no rain until `setRain(v)`, Lou's window the one lit window, CHEZ GÉRARD closed (neon off, shutter half down), No. 14 shut, ENCRE FINE dim (`encre.setLight(0.3)`), the bench lamp's cone on `stakeoutBench` (sit facing `seat.facing`: CYCLES DURAND is across the street). Same spots and shots as 'day'.
    - **'day' and 'night' also return:**
      - `fixes {shutter, bench, card, neon}(fixed)` and `fixes.state`: before/after setters for what the Night Fixer mends (shutter oiled, three new 52 cm slats, the card pinned back up, the neon rewired and steady). Defaults: by day nothing is fixed; at night everything is except the card, which Durand pins during the stakeout.
      - `bakery` (`setOpen(k, secs)`, `setOiled(v)`, `setLit(v)` for 4 a.m. with the floured trestle, `focus` (the rail), `trestle`), `durand` (`setOpen(k, secs)` for the shop door, the room walkable past 0.6, `setLight(v)`, `setPinned(v)`, `focus`, `spots`, `shots`), `neon {setOn(on), setFlicker(v)}`, `marks.print(on)` (the slipper print on No. 14's doorstep), `louWindow`.
      - `paths {nightLoop, nightStops {door, shutter, neon, bench}, bastienRoute}`: Durand's closed night loop, world [x, z], from his door to the shutter, under the neon, past the bench and back.
      - `anchors` (world [x, y, z] for PHOTO frames and close-ups) and `mood {preset, overrides}` (apply with `ctx.mood.applyPreset`). Chapter looks: `STREET_LOOKS.day / .night` in look.js, to slot into `CHAPTER_LOOKS` at the R4 chapter indices.
    - **The flat (scene1.js):** `buildScene1(ctx, {corkboard})` for Ch6 Week 9. `corkboard: true` or `evidenceBoard` opts (`cards`, `strings`; text from `L.*`) hangs the cork board over the team photo's ghost above the TV, beside the bibs. It adds spot, stand, focus and shot `corkboard` (plus shot `corkboardWide`), and `corkboard` on the result: the props/r4.js handles plus `setVisible(v)`. Ch1 is unchanged.
    - **Budget** (scene-pass draw calls at the follow camera, 1280 × 800, high): 'day' 170–205 and 'night' 140–220 with no figures; Ch2 171–224 (was 156–205 before R4); the Ch5 'wall' chapter 204–308 at spawn with its 13 figures (was 193–289, already over 250 at the spawn end).
- **Dressing:**
  1. The blind wall: stained, streaked with rust from the downpipes, tagged and covered in torn posters. The STRIDE billboard, a runner mid-stride in acid green on black, reads "STRIDE — NEVER STOP". This wall becomes the mural in Ch5.
  2. The ground floor of No. 14 closes the street: the workshop's half-open garage door (a procedural box), lit warm from inside, under a deep awning. Above it stands the dark stack of Hugo's building. His third-floor window is lit by the lamp he left on.
  3. Grime:
     - puddles
     - litter (bottles, boxes, pallets, a bin bag)
     - a flickering pink neon `#ff3d6e` "MARCO'S" kebab sign
     - sodium lamps `#d9a35a`
     - a fluorescent tube in a doorway, buzzing
- **Mood:**
  - hope 0.07 → 0.09 (hold still) → 0.12 ("Nothing.")
  - preset `street` (patched): fog `#5f6560` 0.045; grain 0.065; dirt 0.45; lightChroma 0.85
  - Rain is on, and it eases past z −36.
- **Player:** `boot: true`, limp 0.95, painRate 1/0.9 s. The first stumble line still applies (same night).
- **Watch HUD** (live):
  - Seeded from `L.watch.atChapter[1]`: face `0.32 km`, label `WALK`, lap `38:40`.
  - The face adds the real distance walked.
  - **The lap is derived from progress along z, not from time.** It runs from 38:40 at spawn to 41:10 at the arrival, so it always reads right.
- **Start** (non-blocking thought) `[start]`: *"Thirty-eight minutes. Three hundred and twenty metres. Three flights of stairs, one at a time, in a boot."*
- **Beats.** All auto beats are z-thresholds in one `d.until` chain gated in order with `d.flags`, not round zones:
  - **z < −6** `[pauseBuzz, pauseReply]`: the watch buzzes `PACE TOO SLOW TO RECORD. PAUSE ACTIVITY?`, followed by the non-blocking *"No."*
  - **Ghost sign** ("Look"), SHOULD `[ghost]`: "MARCHAL & FILLE — ENSEIGNES — DORURE".
    - *"Somebody painted that by hand, before I was born. The shop's long gone. The letters didn't get the message."*
  - **STRIDE billboard** ("Look up") `[billboard]`:
    - *"Never stop. I took it as advice. It was a slogan for a shoe."*
  - **z < −24: run club** `[club, clubAfter]`. Five runners in hi-vis come up from behind (+Z) and run past toward −Z, moved by hand in `world.onUpdate`. Bastien drops back and jogs on the spot beside Hugo.
    - **Bastien:** "Hugo! Mate! How's the leg?"
    - **Hugo:** "Stress fracture."
    - **Bastien:** "The classic! Too many kilometres, eh?"
    - **Hugo:** "Is there another kind?"
    - **Bastien:** "Ha! Rest up, legend. The leaderboard's boring without you."
    - He runs off and fades out at z −46. Only after that:
      - *"He jogged on the spot the whole time, so his watch wouldn't pause."*
      - *"I'd have done the same. I'd have done exactly the same."*
  - **Closed bike shop** ("Look"), SHOULD `[shop]`: the shutter is down, with a hand-written sign "CYCLES DURAND — CLOSED — THANK YOU FOR 52 YEARS".
    - *"Fifty-two years and they got a thank-you sign. When I retired, the team sent a fruit basket. The card said 'Hugh'."*
  - **Bench** ("Sit"), SHOULD `[bench]`: E sits Hugo down (`sad` pose), which drains pain fast. E again stands him up.
    - *"Wet bench, in the dark. If the club comes back, I'm stretching."*
  - **z < −42: arrival** `[arrivalLoop, arrival]`:
    - *"Once round the block. Forty-one minutes. Back where I started."*
    - Odile is on the scaffold tower (retro `scaffolding-structure`, 2 m) under the awning, lettering the fascia. So far it reads "RÉPARATI". One wheel lock is broken, and the tower creaks.
    - **Odile:** "You. In the boot."
    - **Hugo:** "Me?"
    - **Odile:** "No, the other man in a boot. The wheel lock's gone. Hold the scaffold before I come down faster than I'd like."
    - **Odile:** "Can you stand still?"
    - *"Honestly? Not since I was nineteen."*
- **Minigame: HOLD STILL** (REQUIRED, local to `ch2.js`) `[hold]`
  - Objective "Hold the scaffold." Hugo is teleported to the tower leg and `frozen`. The camera frames Hugo below and Odile above.
  - Raw `input.down` is read for WASD and Shift. Bounds are not shrunk.
  - `ui.gauge('STILL', {value})` fills over 7 s while nothing is held.
  - **Movement input:**
    - It drains the gauge by 40%.
    - The tower creaks (`audio.noise({type:'bandpass', freq:240, q:6, dur:0.4})`) and wobbles.
    - Odile barks one line from a bag, non-blocking (`ui.thought(text, 2.4, {who:'Odile'})`): "Still." / "Stiller." / "You're a lamppost. Lampposts don't fidget." / "I'm doing an S up here. Esses are personal."
  - **The temptation:** at 3.5 s of stillness, the watch buzzes `TIME TO MOVE!` with a HUD shake, followed by the non-blocking *"Not now."*
  - **Assist:** after 25 s the gauge fills regardless.
  - **On success:**
    - The fascia completes to "RÉPARATIONS."
    - Hope → 0.09.
    - Odile climbs down behind a short fade (there is no climb animation).
- **After** `[after]`:
  - **Odile:** "Réparations. Eleven letters and a full stop. You're a decent lamppost."
  - **Odile:** "You're third floor. Four every morning, down the stairs like a dropped wardrobe."
  - **Hugo:** "I was going running. Twice on Sundays."
  - **Odile:** "Hm." (*She looks at the boot for a long moment.*)
  - **Odile:** "I've got a door in there that needs stripping back. And you've got, by the look of you, nothing to do."
  - **Hugo:** "I've got plenty to do."
  - **Odile:** "Name one thing."
- **Correction menu** `[nameOne]` (`who: 'Odile'`). Wrong answers loop back to the menu.
  - [Physio. Ankle circles, three by twenty.] → "That's not a thing to do. That's a thing to count."
  - [Training. I've got a plan.] → "In that boot? What's the plan, aggressive sitting?"
  - **[...Nothing.]** (correct) → "Ten o'clock tomorrow. Bring your own coffee. Mine's a crime." Hope → 0.12.
- **Advance** `[leaving]`:
  - Hugo turns to go.
  - **Odile:** "What did you do to it? The leg."
  - **Hugo:** "Nothing. That's the stupid part. Nothing happened. I just ran."
  - **Odile:** "How far?"
  - Hugo looks down at his wrist. `ui.watchFocus(true, {flare: '#c6f432'})` swells the watch to centre, and the lap line `LAST WEEK 212.4` glows.
  - The screen cuts to white.

### Ch3 "The Long Run": flashback, a dawn road loop, then the marathon `[L.ch3]`
- **Location** (rebuilt `scene3`): a 130 m straight of urban ring road at dawn.
  - Kenney road tiles; low-detail buildings as silhouettes; curved lamps; bare trees.
  - Railings, a footbridge (scaffolding pieces), and km signposts (survival `signpost` + `sign()` boards).
  - The same straight, re-dressed, serves as all three training weeks and the race.
  - **Race dressing:**
    - construction barriers along both kerbs, with 10 spectators behind them (Xbot clones in bright tints)
    - STRIDE banners
    - km boards "KM 29", "KM 30" and "KM 31", 25 m apart
    - 6 other runners in race kit
  - `build.rain()` for the rain.
- **Mood:**
  - preset `dawnrun`: neutralTint; sky `#1b2a44` → `#4f6f8f`; fog `#4f6f8f` 0.02; a cold low sun `#cfe3ff` ahead; contrast 1.12; grain 0.04
  - **Hope is forced high and steps down each block:** Week 9 1.15, Week 20 1.0, Week 31 0.85, race 0.75.
  - `mood.painOverride`: 0, 0.2, 0.4, then 0.5 in the race.
  - The old life is bright, and it is quietly going out.
- **Player:** `boot: false`, `tint: '#c6f432'` (STRIDE green). The barriers are `#ff6a2a`.
- **Audio:**
  - No music: `chapter.music = null`, rain ambience only, plus a footstep on every A/D press.
  - Crowd is not in `chapter.ambience`. It is switched on at the race with `{lowpass: 1400}`.
- **Mechanic: the steady rhythm** (`minigames.rhythm`; Hugo is `scripted`)
  - Alternating A/D. **The target is steady, not fast.**
  - **Band:** 2.3–3.3 alternations/s, shown on `ui.gauge('CADENCE')` as spm (×60, so the band is 138–198 spm) with a needle and a green band. Steadiness is the spread of the last 6 intervals.
  - **Speed:** floor 3.2 m/s; 4.2 m/s in band. The `run` clip timeScale is rate / 2.8.
  - **Feedback lines** (non-blocking):
    - **Mashing** above 3.6/s keeps 4.2 m/s but adds +0.15/s to `painOverride` (cosmetic). It fires *"Easy. It's a long way."*, at most once per 6 s.
    - **Dropping below the band:** *"Don't let it drop."*
    - **Holding the band for 4 s:** *"There. That's the stuff."*
  - **Idle assist:** after 5 s with no input, auto-cadence takes over at 2.8/s. **The body does it anyway.**
  - **NPC runners** (the race) move in the same `d.until` loop as Hugo: at Hugo's z plus a slowly drifting offset, not through `runner.run`.
  - **Watch HUD:** label `THIS WEEK`, seeded from `L.watch.atChapter[2]`. The face climbs with distance, eased so each segment ends exactly on its total.
  - **Segment lengths:** Week 9 is 60 m (thoughts at 15 m and 45 m). Weeks 20 and 31 are 40 m each (thoughts at 10 m and 30 m).
- **Beats** `[weeks[i].caption / total / thoughts / stride]`:
  1. Fade from white. Caption (lower third, broadcast style): `TRAINING BLOCK — WEEK 9 — 5:12 AM — THE LOOP`. The face climbs 0.0 → **104.2**.
     - *"Cycling was other people's races. This one's mine. Every metre of it."*
     - *"Only other light on at this hour is the bakery. I beat it every morning."*
  2. **STRIDE prompt 1** (`d.choose`; every option leads to more running):
     - Prompt: `STRIDE: Six days in a row! Recovery is part of training. Take a rest day?`
     - [Rest day] → *"Rest day. Good idea. Tomorrow."*
     - [Easy 10 km] → *"An easy ten. Easy is a state of mind."*
     - [Dismiss] → *"Dismissed."*
  3. Fade. `TRAINING BLOCK — WEEK 20 — 5:04 AM — THE LOOP, TWICE`. Heavier rain, and `mood.tweak` goes darker. The face climbs 0.0 → **168.0**.
     - *"There's a spot on the shin the size of a coin. I don't press it. If I don't press it, it isn't there."*
     - *"Everybody's shin is a bit loud. Bastien says."*
  4. **STRIDE prompt 2:**
     - Prompt: `STRIDE: Training load HIGH. Your body needs rest.`
     - [Rest (tomorrow)] → *"I said tomorrow. I meant it at the time."*
     - [Run] → no line
     - [Run anyway] → *"Anyway. My favourite pace."*
  5. Fade. `TRAINING BLOCK — WEEK 31 — SATURDAY, 4:47 AM — THE LOOP, THREE TIMES`. Pre-dawn dark, lamps on. The face climbs 0.0 → **170.2**.
     - *"Two ibuprofen. The stairs. The long way round."*
     - *"When it hurts, I count. Counting is a painkiller, if you do enough of it."*
  6. **STRIDE prompt 3:**
     - Prompt: `STRIDE: Race day tomorrow! Taper complete?`
     - [Yes] → *"Yes."* ... *"It's not lying if it's a watch."*
     - [Rest (after Sunday)] → *"Rest after Sunday. I was very firm about that."*
     - [Snooze] → *"Snooze. Story of the year."*
     - Design note: Rest is always offered and never real. Its label moves from "Rest day" to "(tomorrow)" to "(after Sunday)", and choosing it always means running. It pays off in the Ch5 ending.
  7. Card (big): "Sunday."
  8. **The race** `[race]`:
     - Caption `STRIDE CITY MARATHON — KM 29`. The crowd comes on, runners surround him, and hope is 0.75.
     - The watch label is `RACE`. The face shows `29.0 km` and climbs live.
     - At the KM 30 board: *"Thirty. This is where they say the wall is."*
     - 12 m past it: *"I've never hit the wall. Not once. I was very proud of that."*
  9. **KM 31: the crack** `[crack]`. It is quiet, not dramatic.
     - At the KM 31 board, `audio.cut()`. A faint high whine is made locally with `audio.tone`, then `audio.snap({volume: 0.3})`: small and dry, like a pencil lead.
     - One stride hitches: a camera dip and a `poseOffset` pitch.
     - `engine.timeScale` 0.6 for 1.2 s, then back to 1.
     - `mood.drain(0, 3)`, and grain rises to 0.12.
     - Card (`bg: 'clear'`, italic):
       - *"It wasn't loud. It sounded like a pencil lead going, somewhere inside a drawer."*
       - *"I remember thinking: only eleven more."*
  10. **He keeps going** `[keepGoing]`:
      - Call `audio.restore()`, then the crowd comes back thin.
      - Objective "Finish." The run continues for 25 m at 2.4 m/s, with a limp pitch on every left stride and the gauge red and ragged.
      - Input still counts, but it changes nothing.
      - At 3 s, guaranteed: *"I could have stopped. I want that on the record. I could have stopped."*
      - At 25 m, fade to black.
      - **Over black** (`ui.watch(..., {over: true})` puts the watch above the fade):
        - face `42.2 km`, lap `3:04:51`, buzz `GREAT EFFORT!`
        - then the label switches to `THIS WEEK`, and the face ticks 170.2 → **212.4** over 1.5 s
        - hold 1.5 s
  11. **Still over black** `[doctor, present]` (dialogue draws above the fade):
      - **Dr Okafor:** "See that? No. There."
      - **Dr Okafor:** "It's thinner than a hair, Mr Revel. But it goes all the way through."
      - Then the present. Rain fades in under it.
      - **Odile:** "Well? How far?"
      - **Hugo:** "Two hundred and twelve point four."
      - **Odile:** "In a week?"
      - **Hugo:** "In a week."
      - **Odile:** "Where were you going?"
      - **Hugo:** "...It was a loop."
- **Advance:** the chapter ends on black.

### Ch4 "Measure Twice": the workshop, several weeks `[L.ch4]`
- **Location** (rebuilt `scene4`): Odile's workshop, a 9×6 m dollhouse room (+Z wall omitted; camera offset `(0, 3.4, 3.6)` as in Ch1).
  - **Back wall (z −3), facing the camera:**
    - a pegboard (CanvasTexture) with painted tool outlines, some of them empty; one small outline is a wristwatch, painted in a corner (it pays off in Ch5)
    - the main bench and vice, built from `box()` (the survival `workbench` is only a 0.3 m block, so use it as dressing with `workbench-grind` and `workbench-anvil`)
    - hammer, axe and shovel hung on the board
    - the **internal doorway** at the right end, so the door Hugo paints faces +Z
  - **Left wall:** the street side, with a procedural garage door half-open and grey daylight under it.
  - **Right wall:**
    - Odile's corner: a chair, a floor lamp, a radio, a kettle on a `box`
    - a leaning stack of old signs (`sign()`, weathered 0.7): "MARCHAL & FILLE", "CAFÉ DU NORD", "DÉFENSE D'AFFICHER"
  - **Centre:** the old door on two box trestles (the sanding station).
  - **Front-left:** the bike work stand.
  - **Clutter:** barrels (one open), crates, `resource-planks`, `metal-panel-screws`, a `chest`, bottles, `pallet-small`, `detail-cables` on the floor, paint tins (cylinders, drips down the sides), rags.
  - **Lighting:**
    - one hanging bare bulb `#ffb36b` over the trestles (warm key, shadowed)
    - one fluorescent tube `#cfe6d0` over the bench, flickering on Day 5 and fixed by Week 7
    - a high, grimy window with weak daylight
- **Mood:**
  - preset `workshop`: hemi `#7a7468` / `#2e2620`; lightChroma 0.5 (so the tungsten keeps some warmth); grain 0.06; dirt 0.35; vignetteColor `#1c140c`
  - hope 0.12 → 0.62 (see the schedule)
- **Player:** `boot: true`, limp 0.85 (Day 5) → 0.75 (Week 7); painRate 1/1.0 s; `firstStumbleDone = true`. In-room bounds are carved around the furniture.
- **HUD:**
  - Watch from `L.watch.atChapter[3]` (`0.0 km`, `RUN · THIS WEEK`).
  - The notebook is created on Day 5 and stays docked top-right.
- **Each day starts with a required hotspot** (pegboard, frame, bike, bench), so the player walks somewhere and passes the optional ones.
- **Optional hotspots** (available every day; SHOULD):
  - **Old signs** ("Look") `[oldSigns]`:
    - **Hugo:** "Marchal and daughter."
    - **Odile:** "Daughter's me. My father did the big letters, I did the hairlines. Then he died and I did both."
  - **Radio** ("Listen") `[radio]`:
    - **Odile:** "It gets one station. It's a man talking about fishing. I've learned a great deal about fishing."

#### Day 5 `[day5]`
- Card (big): "Day 5."
- `[arrive]`:
  - **Odile:** "You're early."
  - **Hugo:** "I was up at four. I had the shoes on before I remembered."
  - **Odile:** "Shoe."
  - **Hugo:** "...Shoe."
- `[book]`:
  - Stage line: *She hands him a pencil and a school exercise book.*
  - **Odile:** "Everyone who works here writes down what they can do. First day. So that later, they can see it wasn't always there."
  - **Hugo:** "How many people have worked here?"
  - **Odile:** "Before you? Two. Me and my father. He wrote 'everything' and underlined it. He was a liar."
- The **notebook** opens, headed `WHAT I CAN DO`. Hugo writes **"Ride."** and **"Run."**
- `[strike]`:
  - **Odile:** "Can you do either of those this month?"
  - **Hugo:** "...No."
  - **Odile:** "Then put a line through them. Lightly. It's a pencil, not a tattoo."
- Both entries are struck through, lightly.
- *"Thirty-seven years. Two words. Both crossed out by ten past ten. Efficient, at least."* `[strikeThink]`
- `[holdStill]`: **Odile:** "You can stand still. I watched you do it. Write it down."
  - Notebook +**"Hold still."**
- `[door]`: **Odile:** "Now the door. Nine coats of paint on it. I want to see wood by lunch. Sandpaper's on the board."
- **Pegboard** (REQUIRED, "Get the sandpaper") `[pegboard]`:
  - *"Every tool's got its outline painted on the board, so you can see what's missing."*
  - *"My training log was like that. Every rest day, a gap I had to look at."*
- **Door** (REQUIRED, "Sand"). Before the minigame `[grain]`: **Odile:** "With the grain, the long way. Don't press. Let the paper do it."

**Minigame: SANDING** (`minigames.rhythm`, the same code as Ch3) `[sanding]`
- **Inputs and camera:**
  - Hint "Alternate A and D. Steady."
  - The camera is a 45° close on the door.
  - Each press slides a sanding block along the grain (±0.35 m) and plays `audio.scrape()`.
- **Progress:**
  - Progress (0..1) reveals bare wood through the grimy paint: a CanvasTexture mask painted in streaks along the grain.
  - The band is 1.5–2.5/s, shown on `ui.gauge('SANDING')`. Presses in the band add 0.035; presses outside it add 0.012.
  - A full door takes about 15 s of good rhythm.
- **Odile's barks** (non-blocking, `who: 'Odile'`):
  - Mashing above 3.4/s, at most once per 6 s: "You're not sanding it, you're arguing with it." / "Slower. That wood's been here longer than you."
  - W/S pressed (across the grain): "With the grain. Like stroking a cat, not starting a fight."
- **Idle assist:** after 6 s idle, it strokes itself at 2/s in band.
- Mid-way, the watch buzzes `ROWING DETECTED. START WORKOUT?`, followed by the non-blocking *"No."*
- At 1.0 the door reads as raw pale wood, and the sanding sound settles.

**After** `[after]`:
- **Odile:** "You've done this before."
- **Hugo:** "Something like it. About fifty million times. I worked it out once. On a rest day."
- **Odile:** "Write it down. If you can do it, it goes on the list. That's the only rule."
- Notebook +**"Sand with the grain."** Hope → 0.2.

#### Day 8 `[day8]`
- Card (big): "Day 8."
- `[start]`: **Odile:** "Door goes back in the frame. It's eighty-two wide. Measure the frame."
- **Frame** (REQUIRED, "Measure"). Hugo crouches at the doorway with a box prop (there is no tape measure) `[measure]`:
  - **Hugo:** "Eighty-one and a half."
  - **Odile:** "Measure twice."
  - **Hugo:** "Again?"
  - **Odile:** "Yes."
  - **Hugo:** "...Eighty-one and a half."
  - **Odile:** "Doors lie. Frames lie worse. So half a centimetre comes off the hinge side. Plane's on the wall."
- Notebook +**"Measure twice."**
- `[grey]`:
  - **Odile:** "Now. Colour. I want a grey."
  - **Hugo:** "Easy."
  - **Odile:** "A grey that isn't sad."
- **Correction menu** `[greyMenu]` (`who: 'Odile'`, prompt *"Five tins: white, black, ochre, blue, red oxide."*):
  - [Black and white. It's grey.] → "That's not a grey. That's a waiting room."
  - [More white. Cheer it up.] → "Now it's a sad grey pretending to be fine. I know the type." (*She looks at him while she says it.*)
  - **[White, a little black. Then ochre. One drop of blue.]** (correct) → "...There. Now it's a grey that's been somewhere."
- **Auto-paint (4 s, no minigame):**
  - The camera is close on the door.
  - The warm grey `#8d877c` is laid over the sanded wood in 6 bands, revealed by script, with one `audio.scrape()` per band.
  - **Colour bloom** on the last band:
    - `mood.focusOn(door, {slot: 0, strength: 1, decay: 0.15, floor: 0.5, offsetY: 1})`
    - Hope → 0.35.
    - The painted door is the first thing in the game that holds colour. Its grey reads warm against the grey room.
- `[painted]`:
  - *"It's grey. I'd swear to it in court. It's grey."*
  - **Odile:** "Of course it's grey. Stop staring at it, it'll get ideas."
- Notebook +**"Mix a grey that isn't sad."** The door is hung in the back-wall doorway behind a short fade, still in focus slot 0.

#### Week 4 `[week4]`
- Card (big): "Week 4."
- Sami ducks in under the garage door, pushing a red road bike far too big for him (`build.bicycle({frame: '#8a2b22'})`).
- `[sami]`:
  - **Sami:** "Odile! It's doing the noise again. The *zhhh, zhhh*. Mr Durand gave it me when he shut. He said find a wheel man."
  - **Odile:** "Don't look at me. Ask him. He did bicycles for a living."
  - **Hugo:** "I spent twelve years pulling other men up mountains."
  - **Sami:** "Why?"
  - **Hugo:** "So they could win."
  - **Sami:** "That's stupid."
  - **Hugo:** "They paid me."
  - **Sami:** "...That's less stupid."
- **Bike** (REQUIRED, "Look at it"). The bike flips onto the stand.
  - `[bike]`: *"Rear wheel's out of true. One spoke's gone slack, so the rim wanders and kisses the brake pad once a turn."*
  - `[hold]`:
    - **Hugo:** "Hold the bike. Both hands. Don't help."
    - **Sami:** "Holding's not helping?"
    - **Hugo:** "Holding's my whole career."

**Minigame: TRUING** (local to `ch4.js`, on `ui.driveRing`) `[truing]`
- **Setup:**
  - The wheel spins in a close shot, framed off-centre so it doesn't sit under the ring (the ring is at 50%/46% of the screen).
  - **Sync:** one wheel turn per ring (2.4 s). The rim's rub against the pad lands at the ring's perfect moment (0.75 × 2.4 = 1.8 s), with `audio.tick()` there too, so the two cues agree.
  - `driveRing({duration: 2.4, cue: '[Space] when the rub meets the pad', shout: 'Quarter turn.', missText: null})`.
- **Hit:** wobble amplitude ×0.6, and a spoke-key `audio.ping()`.
- **Miss:** a Sami bark, non-blocking: "Was it meant to go clunk?" / "Odile, he's hitting it." / "Is it fixed? It's not fixed."
- **Assist:** after 3 misses the ring window widens ×1.6. From the 5th miss on, a miss counts as a hit.
- **Finish:** the game ends at 4 hits or 8 rings, whichever comes first. If it ended on assisted hits, Sami barks "Is it fixed? ...It's fixed."
- After 4 hits the wheel spins true and silent.
- **Bloom:** `mood.focusOn(bike, {slot: 1, floor: 0.55, offsetY: 0.5})`. Hope → 0.42.

**After** `[after]`:
- **Sami** (spinning it): "It's straight! How did you know where?"
- **Hugo:** "You listen. It tells you where it rubs."
- **Sami:** "Why've you got a ski boot on?"
- **Hugo:** "It's a medical boot. I broke my leg running."
- **Sami:** "Running from what?"
- **The laugh** `[laughStage, laugh]`:
  - Stage line: *Hugo laughs. It comes out rusty, like something left in a shed.*
  - Odile looks up from the bench.
  - `mood.pulse(0.08)` with a warm flash. Hope → 0.5.
  - *"Huh. A laugh. I'd have logged it, if there was a field for it."*
- `[wrap]`:
  - **Hugo:** "I could always do that one. Before the team I built my own wheels. Mechanics were for people who won."
  - **Odile** (nodding at the door, where Sami is riding off): "Write it down, then."
- Notebook +**"True a wheel."**
- Sami leaves with the bike. Focus slot 1 rides with it and is released once he is out of the door.

#### Week 7 `[week7]`
- Card (big): "Week 7."
- **Bench** (REQUIRED, "Watch"). Odile is at the bench with a cream-primed board and a fine liner brush. The fluorescent tube is fixed now.
- Stage line `[stage]`: *Odile lifts the brush. The tip shivers. She puts it down.*
- `[intro]`:
  - **Odile:** "Forty years, I could pull a line thinner than that. Big letters I can still bully. It's the thin ones."
  - **Hugo:** "Thinner than a hair."
  - **Odile:** "Thinner than a hair. You pull it all the way through. No stopping halfway to admire it."
  - *"Last person who said that to me was holding an X-ray."*
  - **Odile:** "I need someone to—" (beat) "...Hold this board."
  - Stage line: *He takes it. Neither of them mentions it.*
  - **Odile:** "You held a scaffold. You can hold a brush. Same job. Stand still, then move once."
  - **Odile:** "The door sign. O, P, E, N. The O's impossible and the N's a trap."

**Minigame: LETTERING** (local to `ch4.js`; drawn in 3D on the board's CanvasTexture) `[lettering]`
- **Camera:** `cam.set` square to the board, fov ~30, plus `mood.focusOn(board, {slot: 2})`. There is no 2D overlay, so the grime and grain stay consistent.
- **Strokes:** 6 in all, with faint chalk guides for O-P-E-N: O (one loop), P (stem, bowl), E (stem, then the three arms as one comb path) and N (one zigzag).
- **Movement model:**
  - The tip is the path point plus an offset.
  - The path point advances on its own at 0.45 board-widths per second.
  - The offset changes with smooth-noise drift (growing slowly over a stroke), plus WASD in screen space.
  - There is no momentum. Small, calm corrections are the skill, the same lesson as holding still.
  - Paint is laid at the tip: 9 px, signwriter red `#a3392b`, with slight bristle texture.
- **Score:** the mean |offset| over the word.
- **Odile's line by tier:**
  - good: "Clean. Don't tell anyone I said so."
  - middle: "It's got character. Nobody wants a sign with no character."
  - poor: "It's a bit drunk. Drunk letters still say OPEN."
- **Idle and skip:** idle is fine, because the drift is bounded and still produces an OPEN. On skip, the guides are drawn perfectly, so the sign is never blank.
- The board canvas is stored as `minigames.memory.openSign`, so Ch5 can show it.

**Signing** `[signMenu, signThink]`:
- **Correction menu** (`who: 'Odile'`, prompt *"Odile taps the bottom corner. 'Sign it.'"*):
  - [Big. Across the bottom.] → "It's a shop sign, not a birthday cake."
  - [I'd rather not.] → "Twelve years you did the work and somebody else's name went on top. Not in my workshop."
  - **[Small. In the corner.]** (correct) → "Smaller. So only the trade will find it."
- Hugo letters a tiny "H.R." (one auto stroke).
- *"Twelve years. The first thing with my name on it says OPEN."*
- **Bloom:**
  - The sign is hung on the door he painted, facing +Z.
  - `mood.focusOn(sign, {slot: 2, floor: 0.6})`, then `d.hope(0.62, 4)`: the colour spreads out from the door and the sign into the room.
- Notebook +**"Letter a sign."**
- The watch buzzes `TIME TO MOVE! You've been still for 3 hr 12 min.` `[buzz]`, followed by the non-blocking *"...Three hours?"* `[buzzReply]`. This is the only proof of absorption before Ch5's "I didn't time it", and it mirrors Ch1's "Thanks."

**Wrap** `[wrap]`:
- **Odile:** "STRIDE aren't renewing the billboard. In a month there's twenty metres of nothing in the middle of all that ugly."
- **Hugo:** "...You want to paint it."
- **Odile:** "I can hold a chalk. The street can hold the brushes. You're doing the line."
- **Hugo:** "What line?"
- **Advance:** card (big) "Week 12."

### Ch5 "The Wall": Rue des Tanneurs, day, then golden hour `[L.ch5]`
- **Location:** the Ch2 street, `buildScene2(ctx, {variant: 'wall'})`, plus `scene5.js` extras (owned by the Ch5 agent):
  - Rain off, puddles drying.
  - The billboard is gone, leaving bolt holes and a paler rectangle at z −18.
  - The 20 m blind wall is primed and divided into neighbours' panels: Mme Benali's croissant (which came out a moon), Marco's kebab, Ines's lettering, Sami's bike, and others.
  - Along the wall: scaffold planks, paint buckets, drop cloths and stepladders.
  - Odile sits in a folding chair by the bench (`spots.odileChair`) with a stick of chalk.
  - **No. 14's garage door is fully open.** Just inside:
    - the bench, the pegboard with its watch outline, and a nail (`spots.nail`)
    - the OPEN sign from `minigames.memory.openSign` (a generic OPEN if it's missing)
    - Hugo's **old race bike** on the work stand with a bright, clean chain
  - Neighbours: 6 idle figures facing the wall (there are no painting animations).
- **Mood:**
  - preset `wall`: overcast `#8a949c` / `#b9bfc2`, warming with hope to `#7fa6c9` / `#e8cf9e`; fog 0.02 → 0.008; grain 0.045; dirt 0.25; lightChroma 0.3
  - hope 0.62 → 0.75 (Teach) → 0.9 (the line) → 0.95 (boot off) → 1.0 (golden walk)
- **Player:**
  - `boot: true`, limp 0.7, painRate 1/1.5 s, `firstStumbleDone = true`.
  - At the bench: `player.setBoot(false)`, `player.limp = 0.3`, `player.footsteps = 'concrete'`. (Not `configure()`, which would snap the pose.)
  - In the final walk: `painCap 0.9`, `showPain false`.
- **HUD:** watch from `L.watch.atChapter[4]`, notebook from `L.notebook.atChapter[4]`.
- **Opening** `[opening]`. Objective "Find Odile." On reaching her:
  - **Odile:** "There you are. You're late."
  - **Hugo:** "I walked the long way. It was nice."
  - *"Nice. I said 'nice' about a walk. Out loud."*
- **Optional hotspots** (SHOULD):
  - **Mme Benali** `[benali]`: "I wanted to paint a croissant. It's come out a moon. I've decided it's a moon."
  - **Ines** `[ines]`:
    - **Ines:** "I tagged this wall eight times. First time anyone's *handed* me the paint."
    - **Hugo:** "How does it feel?"
    - **Ines:** "Weird. Legal."
  - **Marco** `[marco]`:
    - **Marco:** "Odile said paint what you can do. I do a very good kebab. So."
    - **Hugo:** "That's a good kebab."
    - **Marco:** "It's a *great* kebab."
  - **Bike shop window** `[shopCard]`: a new hand-lettered card reads "PUNCTURES FIXED — ASK AT No. 14".
    - *"Sami's handwriting. My spelling."*
  - **Bolt holes** `[boltHoles]`:
    - *"The watch told me to rest. The billboard told me never stop. I listened to the bigger one."*
- **Beat: Teach** `[teach]`
  - Sami's chain drops as he rides along the wall (`spots.saunter`). Hotspot **Sami** (REQUIRED, "Help").
  - **Sami:** "Hugo! It's off again!"
  - **Correction menu** (`who: 'Sami'`, prompt *"The chain's off the front ring. His hands are already black."*):
    - [Give it here, I'll do it.] → "You always do it. Then it comes off when you're not here."
    - [Kick it. Firmly.] → "That's how Odile fixes the radio. The radio's still broken."
    - **[Hook it on the bottom of the ring. Turn the pedal backwards. Slowly.]** (correct) → "...It went on. It went *on*. Did you see?"
  - **Hugo:** "I saw."
  - **Sami** takes the notebook out of Hugo's pocket: "What's this?"
  - **Hugo:** "A list."
  - Sami reads it, licks the pencil, and writes something.
  - **Sami:** "You forgot one."
  - Notebook +**"Teech."**, drawn in Sami's hand: bigger, slanted, a different colour (`hand: 'sami'`). Hugo doesn't correct it.
  - Hope → 0.75.
- **Beat: the line.** Hotspot **Odile** (REQUIRED, "Ready") `[line.setup]`:
  - **Odile:** "Everybody's painted what they can do. Your line goes under all of it. Bakery to kebab shop."
  - **Hugo:** "One line."
  - **Odile:** "Twenty metres. I measured twice. Don't stop halfway to admire it."
  - **Hugo:** "What if it wobbles?"
  - **Odile:** "Go on, then."

**Minigame: THE LINE** (local to `ch5.js`, 3D) `[line]`
- **Camera:** a side tracking shot from the street: Hugo at x ≈ −5.3, camera offset +5.5 x, looking at the wall.
- **Movement:** Hugo is scripted along the wall at 1.25 m/s (walk clip with limp), from z −12 to −32. 20 m takes 16 s.
- **The ribbon:**
  - The brush tip draws a growing ribbon at shoulder height (1.55 m) on the wall: ochre `#d9a441`, unlit, `toneMapped: false`, with a thin darker edge.
  - Steering uses `minigames.makeSteer({dims: 1, momentum: 0.4})`. Smooth-noise drift moves the tip up and down, and **W/S nudge it**.
  - `ui.gauge('LINE')` shows the offset.
- **Chalk:** the chalk guide shows only ahead of the brush, so the player never sees the whole line at once.
- **Colour:**
  - `mood.focusOn(tip, {slot: 0, offsetY: 0})` tracks the brush tip, with `floor` rising 0.4 → 0.7.
  - Each panel lerps from grey to its own colour as the line passes under it.
- **Score:** the mean |offset|. No fail state, no stopping, and idle still finishes. Tuning (`drift 0.7, driftGrow 0.03, recenter 0.06`, tiers good < 0.25 < middle < 0.45 < poor, checked with a 399-seed simulation): no input lands in *middle*, calm corrections inside the gauge band reach *good*, erratic input lands in *poor*.
- **At the end:**
  - *"Twenty metres. I didn't time it."* `[line.end]`
  - **Odile, by tier** `[line.tiers]`:
    - good: "That's a hairline. Near enough."
    - middle: "It's a line a person made."
    - poor: "It's a line a person made in a boot. Same thing, louder."
  - `[line.sign]`:
    - **Odile:** "Sign it."
    - **Hugo:** "Small?"
    - **Odile:** "You're learning."
  - A tiny "H.R." is painted, and hope → 0.9.
  - `[line.photo]`: Ines lifts her phone. This pays off Ch1's "Nobody films them after".
    - **Ines:** "Stand in front of it."
    - **Hugo:** "Of the wall?"
    - **Ines:** "Of you. In front of the wall. That's how photos work."
    - `mood.flash(0.5)` and a shutter `audio.tick()`.
- **Beat: the run club passes** `[club]`
  - The five runners come down the street. Bastien jogs on the spot beside Hugo.
  - **Bastien:** "HUGO! Arts and crafts! Boot's off soon, yeah? We'll have you back on two hundred a week!"
  - Prompt `[E] Wave`: Hugo raises a hand (a `RightArm` bone rotation set in `world.onUpdate`, after the mixers).
  - **Hugo:** "Maybe twenty."
  - **Bastien:** "A day?"
  - **Hugo:** "A week."
  - **Bastien:** "...Is that allowed? My shin's a bit loud, actually. Everyone's is, though!"
  - **Hugo:** "Get it looked at."
  - **Bastien:** "Ha! After Sunday!"
  - He runs off and fades. Only after that `[clubAfter]`:
    - *"He jogged on the spot the whole time, so his watch wouldn't pause."*
    - *"Good for him."*
  - Design note: these mirror Ch2 ("I'd have done exactly the same" becomes "Good for him"). Bastien's "After Sunday" echoes Ch3's "Rest (after Sunday)". Nobody comments on either.
- **Beat: the boot** `[boot]`
  - **Odile:** "It's today, isn't it. The boot."
  - **Hugo:** "Scan this morning. Dr Okafor said 'boring'. Best thing a doctor's ever said to me."
  - **Odile:** "Twelve weeks from the Sunday. I counted. You're not the only one on this street who can count."
  - **Odile:** "Sit. I've got a hacksaw if the Velcro argues."
  - Hotspot **Bench** (REQUIRED, "Sit"). Hugo sits (`sad` pose).
  - One prompt `[E] Strap`: three `audio.rip()`s 0.3 s apart. Then `player.setBoot(false)` and hope → 0.95.
  - *"The leg felt light. Like it didn't know what it was for yet."* `[boot.light]`
  - **Odile:** "Once round the block, then home. It'll work it out." `[boot.walk]`
- **Beat: the final walk** `[walk]`
  - **Setup:**
    - Fade, then `setGolden()` and preset `golden`: late sun breaks under the cloud from the far end of the street. Hope → 1.0.
    - The neighbours are gone, and the mural is in full warm colour.
    - Hugo starts at the top of the street (z +8). Objective "Walk home."
    - The pain bar is hidden, jogging is allowed, and `painCap` is 0.9.
  - **Sami** rides past on the trued bike, non-blocking barks `[walk.sami]`:
    - He is moved manually in `world.onUpdate`, in a crouched `sneak` pose, with the bike parented to `sami.root` and the wheels spinning.
    - **Sami:** "Hugo! It doesn't even rub!"
    - **Hugo:** "Hands on the bars!"
    - **Sami:** "...*Fine!*"
  - **First jog** (tracked per chapter) `[walk.firstJog]`: *"Easy. Easy's a speed."*
  - **If he jogs ≥ 1.5 s and then stops on his own** (once, MUST) `[walk.stopped]`: *"I stopped. Nobody made me. Put that on the record too."*
  - **z < −22, at the mural** (non-blocking) `[walk.mural]`: *"My line runs under everyone's panels, holding them up a bit."*
  - **The workshop door** (z < −44, non-blocking) `[walk.bike]`: *"Four years on a hook. It took an afternoon and a toothbrush."*
  - **Hotspot: nail above the bench** (REQUIRED, "Take the watch off") `[walk.watch]`:
    - The watch HUD shows `0.0 km`, `RUN · THIS WEEK`.
    - On E, Hugo reaches for the nail. The pegboard already has a watch outline painted around it.
    - *"She'd already painted the outline."*
    - The 3D watch hangs inside the outline, and the HUD slides away.
    - **The last STRIDE menu** `[walk.restMenu]` (`d.choose`):
      - Prompt: `STRIDE: No movement detected. TIME TO MOVE?`
      - Options: [Move] and [Rest]. It is a plain "Rest", with no qualifier, for the first time.
      - Rest → no line.
      - Move → *"...No. Rest."*
      - Either way he rests. This is the only menu in the game where Rest means rest.
  - **The notebook opens full size** `[walk.notebook]`:
    - The eraser lifts the strike off "Ride." and "Run.".
    - Hugo writes "(some Sundays)" after "Run.", then adds the last line: **"Rest."**
    - The final list:
      - Ride.
      - Run. (some Sundays)
      - Hold still.
      - Sand with the grain.
      - Measure twice.
      - Mix a grey that isn't sad.
      - True a wheel.
      - Letter a sign.
      - Teech. *(Sami's hand)*
      - Rest.
  - **Crane-up** `[walk.crane]`:
    - Input freezes. The camera cranes up and back over 8 s, from the workshop door to the whole street, with the mural in the low sun.
    - *"Two hundred and twelve point four kilometres. I can't remember a metre of it."*
    - *"Twenty metres of line. It wobbles at the kebab shop. I remember all of it."*
    - Fade to white.

### Ending cards `[L.ending.lines]`
> Rue des Tanneurs never got another billboard.
> Sami Haddad fixes punctures. Two euros, or free if you'll learn.
> Odile's radio gets four stations now. She listens to the fishing one.
> Odile Marchal's list got one line longer that year. It says "Ask."
> Hugo Revel runs some Sundays. Nobody knows how far, including him.
> His watch hangs on a nail above the workbench. It thinks he's been resting for a year.

**End screen** (`ui.endCard()` reads `L.ending`):
1. The big text `212.4 km` (`bigs`) shows for 1.6 s, then fades.
2. A single 1 px warm hairline (`#d9a441`, `hairline: true`) draws across the centre, from 0 to 60% width, over 2.2 s.
3. "Thank you for playing." appears, with **[Play again]** and the credits.

**Credits:** "Character model from mixamo.com (via three.js examples). Props and sounds: Kenney (CC0). Music: OpenGameArt (CC0)."

---

## Text layout (`src/story/text/`)
- **`common.js`:**
  - the helpers `hugo`, `think`, `odile`, `sami`, `bastien`, `stage`
  - `title`, `loading`, `noWebGL`, `contextLost`, `reload`, `mobile`, `pause`
  - `opening`, `stumble`, `hints`, `names`, `watch`, `notebook`, `ending`
- **`ch1.js` … `ch5.js`:** the default export becomes `L.chN`. The keys are the bracketed names in the chapter sections above.
- **`script.js`:** assembles `L` and exports `{ L }` and the default.
- **Conventions:**
  - **Arrays of line objects** (`{who, text, inner?, voicemail?}`) are for `d.say`.
  - **Plain strings** are for non-blocking `d.thought` / `ui.thought`, watch buzzes, captions and sign text.
  - **Barks** are `{who, bag: [...]}` for `ui.thought(text, secs, {who})`.
  - **Correction menus** are `{who, prompt, options: [{text, correct, reply}]}` for `d.correct`.
  - **STRIDE menus** are `{prompt, options: [{text, reply}]}` for `d.choose`, where `reply` is an inner-thought string or null.
- **`L.watch.atChapter[N]`:** `{face, label, lap}` or null, for N = 0…4.
- **`L.notebook`:**
  - `items` holds the canonical entry texts. Chapters reference `L.notebook.items.sand` and so on, never literal strings.
  - `atChapter[N]` is the seeded entry list (`[{text, struck?, note?, hand?}]`) or null.

## Art direction (as built)

**Target:** a polished, premium-indie look. Grounded, semi-realistic, grimy and atmospheric, not photoreal. Consistency beats fidelity: characters, props and surfaces are all weathered and slightly stylised so they read as one world.

**Colour is hope.** The MoodShader keeps the world near-grey at low hope and lets colour back first on the things Hugo makes (four focus slots: the door, the wheel, the sign, the mural line). Grain, lens dirt and a tinted vignette stay to the end ("still dirty, lit differently"). Hope values are in the schedule below.

**What sells it, in order:**

1. **Light.** An HDRI per chapter for image-based light (normalised, key aligned with the sun), ACES tone mapping, soft PCF shadows, GTAO, bloom only on practicals, soft light cones and dust only where light passes. Practical lights carry the interiors: the CRT and the sodium streetlight in Ch1, lanterns on wall consoles in Ch2, the bare bulb and the window shaft in Ch4.
2. **Real materials on large surfaces.** 23 PBR sets, mapped in world space and normalised to one value band (`level`), with shared weathering driven by each chapter's weather: macro breakup, leaks under storey lines, splash-back dirt at the foot of walls, wet floors and puddles. Recipes are named in `src/world/look.js` (`street.asphalt`, `facade.brick`, `workshop.timber`...), so the same surface looks the same wherever it is used.
3. **Believable humans.** The Quaternius modular cast, posed per beat with the clip library (slumped at the TV, arms crossed, seated, crouched at the wheel, riding).
4. **Hero props up close.** Poly Haven scans where the camera gets close (the CRT, the sofa, the bed, the vice, the tools on the pegboard, the bins and crates in the street). Distant filler can stay low-poly, restyled to match.

**Per chapter:**

| Chapter | Light | Palette and surfaces |
|---|---|---|
| Ch1 flat, night | Sun off. The CRT (tinted per broadcast shot), an amber streetlight through the rain-streaked window, a floor lamp pool, a flickering strip light; the `interior_dim` HDRI only fills. | Near-monochrome. Damp wallpaper over plaster, stained floorboards, worn painted joinery, scans of the TV, sofa and iron bed. |
| Ch2 street, dusk, rain | Sodium lanterns with halos and cones, a pink neon blade, the `night_street` HDRI. | Wet asphalt, cobbled gutters, brick and render facades with shutters and balconies, fly-posters and tags, puddles from the wet layer. Grey-blue. |
| Ch3 flashback, dawn | A low sun, thin fog, four real street lamps (the rest are glowing heads), the `dawn_fog` HDRI. Darker each training block. | Cold and saturated (hope above 1, neutral tint) with STRIDE green `#c6f432` on Hugo. A sprite crowd baked from the real cast. |
| Ch4 workshop | One bare bulb as key (with its own shadow), a window daylight shaft, the tube until Week 7, Odile's floor lamp; the `workshop` HDRI. | Whitewashed brick, concrete with oil and sawdust, timber and plywood, scanned tools over painted outlines. Warms with hope. |
| Ch5 street, day → golden hour | A low warm sun over the right-hand roofs, then golden hour down the street; the `golden_street` HDRI throughout; a soft bounce keeps the mural lit. | The Ch2 street from the same recipes, drying (wet 0.25). The mural panels stay grey until the line passes under them. |

**Continuity (the same in every chapter):**

- **Hugo:** blue-grey shirt `#4a5260`, dark trousers, the walking boot on the left leg until Ch5. In Ch3 he wears the STRIDE kit (`runner_dawn`, then `runner`).
- **Odile:** ochre apron `#9a7a4e`, grey sleeves, white hair in buns, a slight stoop.
- **Sami:** red hoodie `#c24a3a`, small (scale 0.74, a bigger head).
- **Runners:** every runner (Hugo's kits, Bastien's club, the race field) shares the slimmed athletic build (0.86 in x/z).
- **Bikes:** Hugo's race bike is team blue `#34506e`: rusted on the Ch1 hooks, chalky on the Ch4 stand, clean in the Ch5 workshop. Sami's bike is red `#8a2b22` in Ch4 and Ch5.
- **The street:** Ch2 and Ch5 are one builder (`buildScene2`, variants `'evening'` and `'wall'`) with one set of recipes. The fly-posters on the right-hand row stay; the blind wall's posters are gone under the primer in Ch5.

**Budgets:** at most 250 draw calls in the scene pass (shadows included) and 1.5 M triangles per chapter at 1280 × 800 on `high`; 60 fps on the target GPU tier. Assets: `public/assets` ≤ 150 MB (about 92 MB), 1k textures by default and 2k only on the three hero surfaces, nothing shipped that no scene uses. Quality tiers (`low` / `medium` / `high`) trade MSAA, AO, bloom and shadow size; `low` must still look acceptable.

## Mood / hope schedule

| Beat | hope | Preset / notes |
|---|---|---|
| Ch1 start → watch → door | 0.04 → 0.06 → 0.07 | `flat`; TV key `#9fb7d6`; fluorescent `#cfe6d0` |
| Ch2 start → hold still → "Nothing." | 0.07 → 0.09 → 0.12 | `street` + rain; sodium `#d9a35a`; neon `#ff3d6e` |
| Ch3 Week 9 / 20 / 31 / race | 1.15 / 1.0 / 0.85 / 0.75 | `dawnrun`; neutralTint; STRIDE green `#c6f432`; painOverride 0 / 0.2 / 0.4 / 0.5 |
| Ch3 KM 31 | drain → 0.0 over 3 s | grain → 0.12 |
| Ch4 Day 5 → sanding | 0.12 → 0.2 | `workshop`; bulb `#ffb36b` |
| Ch4 Day 8 grey door | 0.2 → 0.35 | focus slot 0 on the door, floor 0.5 |
| Ch4 Week 4 truing → laugh | 0.35 → 0.42 → 0.5 | focus slot 1 on the bike, floor 0.55; `pulse(0.08)` |
| Ch4 Week 7 sign | 0.5 → 0.62 over 4 s | focus slot 2 on the sign, floor 0.6 |
| Ch5 start → Teach → line → boot | 0.62 → 0.75 → 0.9 → 0.95 | `wall`, warming with hope |
| Ch5 final walk → crane | 1.0 | `golden`; grain 0.03; dirt 0.12 (still dirty, lit differently) |

- **Grain:** Mood multiplies preset grain by `(1.2 − 0.5·clamp(hope, 0, 1))`, so grain eases as hope rises but never disappears.
- **Tint:** the warm GOLD at the end is the existing COOL → GOLD lerp. Ch3 uses neutralTint, so its neon reads cold.

## Pacing budget (about 2.5 s per blocking line)

| Part | Target | How |
|---|---|---|
| Opening card | 0:15 | |
| Ch1 | 2:00 | Hotspots are optional. The watch and the door are the only required beats. |
| Ch2 | 2:30 | The thumping exchange is 3 lines and the arrival is 5. The ghost sign, bike shop and bench are SHOULD. |
| Ch3 | 2:15 | 60 + 40 + 40 m blocks, the race 75 m plus 25 m. |
| Ch4 | 3:45 | About 60 blocking lines. Painting is auto (4 s). Sanding takes ~15 s, truing ≤ 8 rings, lettering ~35 s. If it runs long, cut the Day 8 "Again?" / "Yes." pair first, then the "How did you know where?" pair. |
| Ch5 | 3:30 | The opening is 3 lines and the run club 7. There is one Strap prompt, and the line takes 16 s. |
| Ending | 0:30 | |
| **Total** | **~14:45 worst case, ~11:30 for a player who skips optional hotspots** | |

## Scene reuse

The "Kenney props" column is the original plan. Every scene was later re-dressed to the art direction above; the as-built sources are in `docs/CREDITS.md` and `CHAPTER_LOOKS` (`src/world/look.js`).

| Ch | Scene file | Decision | Kenney props (original plan) |
|---|---|---|---|
| 1 | `scene1.js` | **Adapt.** Keep the room, bounds, TV flicker, window moonlight and door spill. Changes:<br>- TV CanvasTexture → cycling broadcast (`L.ch1.tvTicker`)<br>- stopwatch → watch on a charger (small box + emissive face)<br>- shoebox → hanging bike (`build.bicycle({rust: 0.8})`) on the left-wall hooks<br>- rehab sheet → X-ray (canvas: blue-black film, white tibia, biro circle)<br>- add the bibs grid (one CanvasTexture atlas on 3 planes, 38 bibs)<br>- add a grime texture on the walls (`build.grimeTexture`)<br>- add the fluorescent strip, takeaway boxes, bin bag and dead plant<br>Spots: watch `[-0.95,-1.9]`, tv `[0.55,1.3]`, phone `[1.75,-0.95]`, xray = old fridge `[1.95,0.85]`, bike `[-2.4,0.4]`, bibs `[-1.4,-1.3]`, door unchanged. | furniture: bedSingle, loungeSofa, tableCoffee, cabinetTelevision, televisionVintage, kitchenFridge, kitchenCabinet, cardboardBoxOpen/Closed, trashcan, pottedPlant (tinted dead `#6b6450`), lampRoundFloor, rugRectangle (tinted stained) |
| 2 | `scene2.js` | **Adapt** to the STREET CONTRACT, with both variants. Keep the road, sidewalks, lamps and building fronts. The blind wall and garage door are procedural boxes with `grimeTexture`, and `wall-a-flat` is used only for small facades. `rain` comes from `build.rain()`; `puddle` stays local. | retro: wall-a-flat, scaffolding-structure/floor/poles, detail-dumpster-closed, pallet-small, detail-bricks-type-a, detail-cables-type-a; roads: light-square, construction-cone, dumpster; survival: bottle-large, box-open, barrel; furniture: cardboardBoxOpen |
| 3 | `scene3.js` | **Rebuild.** Drop the stadium, rivals and track. New: a 130 m ring-road straight with silhouettes, lamps, a footbridge, km boards, and a race-dressing group (barriers, crowd, banners, NPC runners) toggled on for the race. Keep the per-frame loop pattern of the old `ch3.js`, with `minigames.rhythm` for input. | roads: road-straight, light-curved, construction-barrier, construction-cone; city: low-detail-building-a…d; nature: tree_simple_fall/tree_thin_fall (tinted bare), rock_largeA; retro: scaffolding-poles/floor (footbridge); arena: banner; survival: signpost |
| 4 | `scene4.js` | **Rebuild** as the workshop dollhouse room (follow the scene1 patterns: omitted +Z wall, invisible ceiling for shadow, carved bounds). Exports:<br>- `door` (sand/paint mask canvas, `setSand(p)`, `setPaint(p)`)<br>- `bike` (wheel wobble, `spin`)<br>- `board` (lettering CanvasTexture)<br>- `fluoro(on)`, `hangDoor()`, `hangSign()`<br>- a shot per minigame | survival: workbench, workbench-grind, workbench-anvil (dressing), tool-hammer/axe/shovel, bucket, barrel, barrel-open, box, box-open, box-large, resource-planks, resource-wood, metal-panel, metal-panel-screws, structure-metal-wall, chest, bottle-large; retro: pallet-small, detail-cables-type-a; furniture: chair, lampRoundFloor, doorway, sideTable |
| 5 | `scene5.js` | **Thin wrapper:** `buildScene2(ctx, {variant: 'wall'})` plus:<br>- the chalk strip, the ribbon mesh and drop cloths<br>- the neighbours and Odile's chair<br>- the open workshop interior (bench, pegboard with the watch outline, nail, the 3D watch, the OPEN sign, the clean race bike on its stand)<br>Delete the old meet scene. | Same as Ch2, plus survival: bucket (paint buckets); retro: scaffolding-floor (planks along the wall); furniture: chair (folding chair) |

- **Characters:**
  - Hugo: slate `#4a5260`; STRIDE green in Ch3.
  - Odile: `#9a7a4e`, scale 0.94.
  - Sami: `#c24a3a`, scale 0.72.
  - Bastien and the club: hi-vis `#d6e04a`, `#e0a040`, `#8fb0c8` (muted).
  - Neighbours: muted random tints.
- **Clips:** only `idle`, `walk`, `run`, `sad` and `sneak` (`agree` and `headShake` are optional).
  - Hugo uses `sad` on the benches.
  - NPCs sit with `sad` and model y −0.42.
- **Staging around missing animations:**
  - There is no hammering, painting or climbing animation. Odile "climbs down" behind a cut.
  - Neighbours stand idle facing the wall.
  - Hugo "measures" crouched with a box prop.
- **Budget:** each Xbot costs about 4 draws including shadow. The Ch3 race has 16 figures, and Ch5 has 13 figures plus the street. Cap real PointLights at about 10 in the street; neon and tubes are emissive, with at most one light each. Verify against the 250-draw-call check.

## Core changes needed (core agent; exact list)

**Phase 0:** the core agent first lands **stubs with the final signatures** for C3–C6 and C9 (no-op UI methods, presets present, `bicycle` returning a grey group), so the chapter agents can start. C8 (the text split) is already done.

**C1. `src/render/MoodShader.js`: the grime pass**
- New uniforms:
  - `uGrain: float`
  - `uDirt: float`
  - `uTime: float`
  - `uVigColor: vec3`
  - `uFocus[4]: vec4`, one per focus slot: screen xy, radius, strength (this replaces the old single focus uniforms)
- **Grain:**
  - The hash is on `gl_FragCoord.xy + uTime*61.0`, so no resolution uniform is needed.
  - It is multiplicative in linear space: `col *= 1.0 + uGrain*(h-0.5)*2.0*(1.0-0.5*smoothstep(0.,.5,l))`.
  - Additive grain before OutputPass would blow up the shadows after sRGB encoding.
- **Dirt:**
  - Static 2-octave value noise (fixed seed) plus 3 soft corner blotches.
  - `col *= 1.0 - uDirt*0.35*smudge`, with a slight brown cast.
- **Vignette:** `col = mix(col, uVigColor*l, uVignette*v)`.
- **Focus:** the saturation focus is the max over the 4 slots.
- **Safety:** `max(col, 0.)` at the end; no `pow` on negatives; no textures.

**C2. `src/render/Mood.js`**
- **Preset keys:** add `grain` and `dirt` to `NUM_KEYS` and `vignetteColor` to `COLOR_KEYS` (defaults 0, 0, `#000`), so `tweak({grain: 0.12})` blends.
- **Grain uniform:** `uGrain = preset.grain * (1.2 - 0.5*clamp(hope,0,1))`.
- **`painOverride: number | null`.** When set, it drives `uPain` instead of `player.pain²`.
- **`focusOn(obj, {strength=1, decay=0.25, offsetY=1.3, floor=0, slot=0})`** with 4 slots. Existing calls are unchanged (slot 0). `obj = null` releases the slot.
- **`clearFocus()`**.
- **`uTime = engine.now`**.
- **Presets:**
  - New: `flat`, `dawnrun`, `workshop`, `wall`, with the values in the chapter sections.
  - Patch `street` (grain 0.065, dirt 0.45, fog `#5f6560` 0.045) and `golden` (grain 0.03, dirt 0.12).
  - Remove `olympic`, `condemned`, `meet`, and `apartment` (replaced by `flat`).

**C3. `src/player/Player.js` and `src/main.js`**
- **`configure({..., boot = false, tint = HUGO_TINT})`.** Not sticky: every call applies its defaults, so Ch3's green kit never carries into Ch4. Ch1, Ch2, Ch4 and Ch5 pass `boot: true` in `chapter.player`.
- **`setBoot(on: boolean)`:** attaches or removes the boot with no pose reset.
  - The boot is a rounded box shell `#3a3d42`, 3 strap bands `#6a6d72` and a thick sole, parented to the `LeftLeg` bone.
  - The shin length is measured from the world positions of `LeftLeg` and `LeftFoot`. Divide by `bone.getWorldScale()`, because Xbot's armature is cm-scaled.
  - On the capsule fallback, it is a box at the left base.
- **`footsteps: 'boot'`:** bad-leg steps play the concrete sample at rate 0.72 and volume 0.5, plus `audio.thud({volume: 0.15})`. `limp` and `footsteps` are writable mid-chapter.
- **`firstStumbleDone: boolean`** is public. When true, the next stumble uses the bag.
- **`main.js`:**
  - `HUGO_TINT = 0x4a5260`
  - `makeCharacter({tint: HUGO_TINT, name: 'Hugo'})`
  - `new Player({..., lines: L.stumble})` (unchanged)
  - the console tags change from `[9.81]` to `[hairline]`

**C4. `src/ui/UI.js` + `style.css`**
- **`watch(face: string | null, {label, lap, tick = true, over = false})`** replaces `stopwatch`.
  - It is a rounded GPS face, docked bottom-right.
  - `over: true` puts it at z-index 26, above the fade.
  - `null` hides it.
- **`watchBuzz(text, secs = 2.4)`:** a notification slides across the face with a small shake, plus `audio.buzz()`. It is non-blocking.
- **`watchFocus(on: boolean, {flare})`:** swells the watch to centre. `flare` is a CSS colour glow.
- **`notebook`** (bound methods), with `entries: [{text, struck?, note?, hand?: 'hugo' | 'sami'}]`:
  - `set(entries | null)`
  - `add(text, {hand = 'hugo'})`
  - `strike(text, on = true)`
  - `annotate(text, note)`
  - `open(secs = 3)`
  - `dock()`
  - `hide()`
  - **Visuals:** lined paper, pencil grey `#3b3a36`, heading `L.notebook.heading`, the font stack `"Bradley Hand", "Segoe Print", "Noteworthy", cursive`, and a ~0.8 s write-on animation. It is docked top-right, opens full for `secs` on every change, and is cleared by `clearTransient()`.
- **`gauge(label | null, {value, band: [lo, hi], max = 1, color})`:** a horizontal meter with a needle and a band, above the prompt at bottom-centre.
- **`thought(text, secs = 3.5, {who} = {})`:** with `who`, it shows a speaker label in that speaker's colour (a non-blocking bark).
- **`endCard(E = L.ending)`:** runs `card(E.lines)`, then each of `E.bigs`, then the `E.hairline` 1 px line, then `E.thanks`, `E.playAgain` and `E.credits`.
- **`clearTransient()`:** adds `watch(null)`, `notebook.hide()`, `gauge(null)` and `watchFocus(false)`.
- **Text:** replace the hardcoded "9.81" in the loading mark and the mobile warning with `L.title.name`.
- **CSS speaker colours** (the class is the first word of `who`, lowercased): `.who.hugo`, `.odile`, `.sami`, `.bastien`, `.stride`, `.dr`, `.ines`, `.marco`, `.mme`, `.tv`, `.phone`, `.mum`.
- Remove `stopwatch`, `reaction` and `splits` once no chapter uses them.

**C5. `src/core/Audio.js`**
- **`tone({freq, to, dur, type = 'sine', volume = 0.3, bus = 'fx'})`:** a pitch-ramped oscillator.
- **`noise({type = 'bandpass', freq, q = 1, dur, volume = 0.3, tail = 0.05, bus = 'fx'})`.**
- **Named one-liners on top:**
  - `hammer()`: low-passed through-the-floor thud
  - `scrape()`: short band-passed noise
  - `tick()`: rim rub / shutter
  - `ping()`: spoke key
  - `rip()`: Velcro
  - `buzz()`: two 180 Hz square pulses, low-passed
- Chapters make the creak and the whine locally with `tone` and `noise`.

**C6. `src/world/build.js`**
- **`bicycle({frame = '#8a2b22', rust = 0, scale = 1}) → Group`:**
  - `userData.wheels: [front, rear]` and `userData.rims`.
  - Built from tori, cylinders and a saddle box, with 16 spokes per wheel as one LineSegments.
- **`grimeTexture({w = 512, h = 512, base, stains, drips, tags, posters, seed}) → CanvasTexture`:** noise, damp blooms, rust drips, graffiti scribbles and torn poster rectangles.
- **`rain({count = 1600, size = [34, 16, 34]}) → {object, update(dt, camera)}`:** moved out of `scene2` because Ch3 needs it too.

**C7. `src/story/Director.js`**
- `think()` uses `who: 'Hugo'`.
- `correct()` defaults `who` to `'Odile'`.
- `_resetBetweenChapters` sets `mood.painOverride = null` and calls `mood.clearFocus()`.
- When a chapter starts, it seeds `ui.watch(...)` from `L.watch.atChapter[index]` and `ui.notebook.set(...)` from `L.notebook.atChapter[index]` (null hides them).

**C8. Text split (done in this revision)**
- `src/story/text/{common, ch1, ch2, ch3, ch4, ch5}.js`.
- `src/story/script.js` re-exports `L`.
- The temporary legacy shim (`L.ch5.results` / `L.ch5.times`) has been removed now that Ch5 is rewritten. Small on-screen dressing strings also live in the text files (`L.ch1.signs`, `L.ch2.howFarLap`, `L.ch3.signs`).

**C9. `src/story/minigames.js` (core-owned)**
- **`rhythm(ctx, d, opts) → Promise<{skipped, state}>`.** `opts`:
  - `keys = ['KeyA', 'KeyD']`, `band: [lo, hi]`, `mashAt`, `window = 6`
  - `idleAuto: {after = 5, rate}`
  - `gauge: {label, scale = 1, unit}`
  - `done: (s) => bool`
  - callbacks: `onStroke(s, inBand)`, `onMash()`, `onLow()`, `onSteady()`
  - `state` is `{rate, spread, inBand, strokes, t}`.
- **`makeSteer({dims = 1, drift, driftGrow, gain, momentum = 0, damping = 6}) → {offset: Vector2, step(dt, input)}`.**
- **`memory: {}`** for cross-chapter hand-offs, for example `memory.openSign` (a canvas).
- HOLD STILL (`ch2.js`), TRUING and LETTERING (`ch4.js`) and THE LINE (`ch5.js`) live in their chapter files, since each is used once.

**C10. `src/core/Assets.js`**
- Add `NATIVE_SIZE` entries for the survival kit and the new retro pieces, from `docs/asset-bounds.txt`, so a failed load gives a box of the right size.
- Retag console messages to `hairline`.

**C11. Docs and metadata**
- `index.html`: the title "HAIRLINE", a favicon showing a single ochre hairline on black, and the meta description set to the tagline.
- `README.md`: the title, chapters and credits.
- `docs/API.md`: sections for C1–C9.
- Delete the 9.81 references in `API.md`.

**Ownership:**
- **Core agent:** C1–C7, C9–C11.
- **Ch1 agent:** `ch1.js`, `scene1.js`, `text/ch1.js`.
- **Ch2 agent:** `ch2.js`, `scene2.js` (both variants), `text/ch2.js`.
- **Ch3 agent:** `ch3.js`, `scene3.js`, `text/ch3.js`.
- **Ch4 agent:** `ch4.js`, `scene4.js`, `text/ch4.js`.
- **Ch5 agent:** `ch5.js`, `scene5.js`, `text/ch5.js`.
- `common.js` is core-owned.

## Scope

**MUST:**
- the grime pass (grain, dirt, vignette colour), multi-slot focus, and the four new presets plus the two patched ones
- the boot visual (`setBoot`) and boot footsteps
- the watch HUD with buzz, `over` and focus; the notebook HUD; the gauge; barks with `who`
- **Ch1:** TV, phone (with voicemail), the required watch beat with "TIME TO MOVE", X-ray, bike, bibs, the hammering, and the door with START WALK
- **Ch2:** the live watch, the PAUSE gag, billboard, the run club + Bastien with the after-lines, the loop line and the Odile arrival, HOLD STILL with the watch temptation, the "Name one thing" menu, "How far?" and the watch cut to white
- **Ch3:**
  - three blocks with the cadence mechanic and the climbing face (104.2 / 168.0 / 170.2)
  - all three STRIDE prompts, with the never-real Rest
  - the race, the quiet KM 31 crack card and "I could have stopped"
  - GREAT EFFORT and 212.4 over black, then the doctor and Odile over black
- **Ch4:**
  - Day 5: notebook, strikes, Hold still, pegboard, sanding
  - Day 8: measure twice, the grey menu, auto-paint, the first bloom
  - Week 4: Sami, truing, the laugh
  - Week 7: the tremor and the near-ask, lettering OPEN, the sign-it menu, the sign bloom, the 3-hours buzz, the wrap
- **Ch5:**
  - the opening, Teach + "Teech.", THE LINE + the photo
  - the run club wave + Bastien's shin
  - the boot off
  - the final walk: the jog/stop line, the mural thought, the race bike, the watch in its outline, the last STRIDE menu
  - the notebook finale (un-strike, "(some Sundays)", "Rest."), the crane-up lines, the fade to white
- the ending cards, and the `212.4 km` → hairline → thanks end screen
- no blocking fail state anywhere; every minigame finishes with no input
- every beat skippable via `debug.skip()`
- all text in `src/story/text/`
- the existing debug hooks, pause, mute, mobile warning and fallbacks

**SHOULD, in this order:**
1. The Ch2 ghost sign, bike shop and bench hotspots.
2. The Ch5 neighbour hotspots (Benali, Ines, Marco), the PUNCTURES card and the bolt holes.
3. The Ch4 optional hotspots (signs, radio).
4. Sami riding (the crouched pose on the saddle) rather than walking the bike.
5. Puddle shine, rain streaks on the workshop's high window, and fluorescent buzz audio.
6. Per-panel colour lerp on the mural; a uniform focus floor is acceptable as the fallback.

**CUT:**
- planar or screen-space reflections
- new character models or bike GLBs (bikes stay procedural)
- free-form painting tools or colour pickers
- the Day 8 painting minigame (now auto-paint)
- `ui.bench` (lettering draws in 3D)
- bike physics
- voice, branching, save, chapter select, touch controls
- bloom
- emotes beyond the single arm-raise
- any 9.81 content (Theo, Mila, Ray, track, stadium, 60 m, DRIVE text, the `olympic`/`condemned`/`meet` presets)
- the original surname from the brief, everywhere
- a "Rest" option that actually rests before the final STRIDE menu

## Verification
- **Each chapter:** for N in 0..4, `?debug=1&autostart=1&skipcards=1&chapter=N` must reach `play` with draw calls between 0 and 250, and repeated `skip()` must reach the next chapter.
- **Screenshot checks:**
  - Ch1: grey-green, grainy room with a blue TV.
  - Ch2: wet street with amber lamps and pink neon.
  - Ch3: cold neon dawn road with a green runner.
  - Ch4: warm-bulb workshop with clutter; door, bike and sign keep colour together after Week 7.
  - Ch5: mural street, warming.
- **Grime:** grain is visible in the shadows at hope 0.05, and there are no black or NaN pixels (check a canvas readback).
- **Boot:**
  - It is visible on the left shin in Ch1, Ch2, Ch4 and Ch5 before the bench.
  - It is absent in Ch3 and in the final walk.
  - Holding `ShiftLeft`+`KeyW` for 1500 ms in Ch1 stumbles with *"Twelve weeks. This is day four."*
  - In Ch4 the first stumble draws from the bag.
- **HUD state:**
  - Jumping straight to each chapter seeds the watch and notebook from `atChapter[N]`.
  - The watch is readable over black in Ch3.
  - Its face texts follow the spec (`0.0 km`, `212.4`, `170.2`, `GREAT EFFORT!`, `TIME TO MOVE!`).
- **Minigames:** each one completes with no input (the assists) and through `skip()`.
- **Clean run:** no console errors, no 404s.
- **Manual playthrough:** about 11–12 minutes, following the hope schedule above.

---

## Editorial notes (revision 2)

**Applied in full:**
- **Editor:**
  - C1 (170.2 + 42.2 = 212.4) and C2–C5, C9–C11.
  - I1–I3; P1, P3–P6; B1, B2, B4.
  - M1–M6; the Week 7 three-hours buzz; the near-ask.
  - "Big letters I can still bully"; the radio and "Ask." ending cards; Durand's bike for Sami; "Teech."; Bastien's shin; "No, the other man in a boot".
  - The line-by-line table.
- **Producer:** everything except the points below. That includes the soft-lock assists, watch `over`, barks, `setBoot`, the `firstStumbleDone` guard, non-sticky `configure`, z-thresholds, Ch3 audio, hand-moved NPCs, bone handling, the OPEN sign on the door (+Z), the watch bottom-right, `atChapter` seeding, the band widening, cutting the painting minigame and `ui.bench`, the asset substitutions, the street contract, ownership, and the C1–C11 list.

**Changed or partly applied:**
- **C6 (plane line):** kept, inside the Day 8 measure exchange.
- **Measure menu:** the menu is dropped, as the producer asked. The 3-line exchange becomes 6 short lines, with one plain "Yes." This is the editor's "one plain reply" for the scene.
- **C7 (sign painting in the rain):** solved by staging (a deep awning, and rain easing past z −36), not with a new line. Ch2's arrival is already at its line budget.
- **I4 (the medical sign-off):** the scan line moves to the boot beat, where it replaces "How do you know?". Putting it in the opening would have given away "It's today, isn't it." The opening stays at 3 lines ("I walked the long way. It was nice.").
- **P2:** "Same job I always had" is cut, and Ines's photo is added, after the line rather than in the final walk (the neighbours are gone by then).
- **B3:** the race bike on the stand and the toothbrush line are in. The extra "Clean a chain." entry is not, because the list is long enough and the bike is shown, not listed.
- **Odile's notebook:** done as the ending card, not as a hotspot. Day 5 already implies she keeps a list.
- **Zinger rate:** there is one plain reply in Day 8 ("Yes.") and one in the Ch5 line setup ("Go on, then."). "Then it's a line a person made" moves into the scoring tier, where it lands better.
- **The Line:** the producer asked for 16 m in 16 s. It is kept at 20 m but at 1.25 m/s, so it still takes 16 s. "Twenty metres. I didn't time it." is too good to renumber.
- **Ch4 line budget:** about 60 blocking lines, not 55. The editor's additions (B1, M2 pegboard, M4, the near-ask) cost about 8 lines. They are each short, and the named fallback cuts cover the difference.
- **Ending cards:** "She points at other people's and says 'too thick'" is dropped to make room for the radio and "Ask." cards.

**Rejected:**
- **Editor C10's "forty" for the ghost sign:** the line is now "before I was born", so Odile keeps the only forty.
- **The producer's `uFocusPos[4]` as a separate uniform:** it is merged into `uFocus[4]` as a vec4 (xy, radius, strength). Same capability, one array.

---

## Revision 3: crafts you can feel

This section is **binding**. Where it disagrees with anything above, this section wins. Five agents implement it in parallel (see R3.12 for who owns what). Every line of player-facing text below is the exact English; each agent adds its French in the same change, following `docs/i18n-fr.md`, and `node scripts/i18n-check.mjs fr` must report 0 errors.

### R3.0 What changes, and the rules every agent follows

**The eight changes:**
1. Ch4 Day 8: a **colour-mixing toy** replaces the grey correction menu (R3.3).
2. Ch4 Day 8: **Measure twice** becomes a tape-measure interaction (R3.2).
3. Ch4 Week 4: **truing by ear** replaces the Space timing ring (R3.4).
4. **Juice** on every craft: dust, speed-following scrapes, wet-to-matte paint, spoke pings and a short reveal beat (R3.5).
5. Ch5: four optional **street jobs**, each reusing a craft and each bringing colour back to its own spot (R3.8).
6. Ch5: **Hugo's own panel** on the wall, before the line (R3.7).
7. **Conditional ending cards**, chosen from memory flags (R3.9).
8. **Seeds** in Ch1 to Ch3: a wobbly table, a lingering look, a thought about wheels (R3.6).

**Rules (all agents):**
- **Voice.** Dry, warm, understated. Odile is terse. Sami is literal. Nobody states the theme. No new line explains what a craft "means".
- **No fail states.** Every interaction ends with no input (idle assist), and every one ends through `__game.debug.skip()`. A skip gives the canonical result named in each section.
- **Keys** are written in text as key tokens (`{KeyA}`, `{KeyW}`, `{KeyE}`, `{KeyT}`, `{Space}`, `{Shift}`, `{Escape}`, `{Arrows}`), resolved for the player's layout by `src/core/KeyLabels.js`. Code reads physical codes (`KeyA`…). Never write a literal layout letter in text. Digits stay literal ("1–5"): the code reads `Digit1`…`Digit5` and `Numpad1`…`Numpad5`, which are physical too. In this section, keys are written as their tokens.
- **Mouse and keyboard.** Every new interaction works with either, as listed in each section. Mouse input in crafts comes from `crafts/pointer.js` (R3.1). It is active only inside a cinematic (the camera rig ignores the mouse outside free roam, so there is no conflict with mouse look).
- **Audio has a visual twin.** The game can be muted with `{KeyM}`. Every cue that carries information is also shown (table in R3.10).
- **Text lives in the text files.** Barks are `{who, text}` or `{who, bag}`; blocking lines are arrays of line objects; menus follow the conventions in "Text layout". Canvas text follows the `relabel()` / `onLangChange` pattern in `src/world/build.js`. New tight UI strings get a `LIMITS` entry in `scripts/i18n-check.mjs` (gauge labels ≤ 41, chip buttons ≤ 39).
- **Code style.** New mechanics go in new modules. Edits to shared files (`chN.js`, `sceneN.js`, `UI.js`, `Audio.js`, `minigames.js`, `Director.js`, text files) are narrow and local: re-read the file right before each edit. No commits.
- **Pacing.** Each new interaction lasts 20–60 s. Required play grows by about 1:50, and all the optional content adds about 2:00 more (R3.11).

### R3.1 Shared modules

**`src/story/memory.js`: cross-chapter flags** (owner PANEL, **Phase 0**: land it first with these exact exports; the other agents code against them)
- `minigames.memory` keeps the OPEN sign canvas only. Every flag lives here.
- **Exports:**
  - `DEFAULTS`: the shape and the defaults below. It is frozen.
  - `mem`: the live object. Read it directly (`mem.doorGrey`, `mem.jobs.radio`).
  - `remember(path, value)`: `path` is a top-level key or a dotted path (`'jobs.radio'`, `'seeds.table'`). Object values replace the old value. It persists to `localStorage['hairline.mem']` in a try/catch, and it never throws.
  - `beginChapter(index)`: resets to `DEFAULTS` every key whose owner chapter is ≥ `index`, then persists.
  - `restoreMem()`: at boot, merges the stored JSON over `DEFAULTS`. Unknown keys and bad types are ignored.
  - `memSnapshot()`: a deep copy, for debug and tests.
- **Shape and defaults** (owner chapter index in brackets):
  ```js
  {
    seeds:      { table: false /*[0]*/, ghost: false /*[1]*/ },
    doorGrey:   '#8d877c',                                          // [3] hex the door was painted
    grey:       { tries: 0, assisted: false },                      // [3] Done presses; Odile finished it
    measure:    { readings: [], agreed: 81.5, assisted: false },    // [3] cm
    wheel:      { secs: 0, plucks: 0, assisted: false, overTight: false }, // [3]
    teachFirst: true,                                               // [4] Sami's menu right first time
    panel:      null,                                               // [4] 'wheel' | 'door' | 'hand'
    jobs:       { shutter: false, radio: false, board: false, wheel: false }, // [4]
  }
  ```
- **Wiring** (PANEL, narrow edits):
  - `Director.start()`: call `beginChapter(this.index)` right after `_resetBetweenChapters()`. So `?chapter=N` and Pause > Restart chapter keep the earlier chapters' flags (a door painted in this tab's Ch4 stays painted in Ch5) and clear the replayed ones.
  - `main.js`: `restoreMem()` beside `minigames.restoreMemory()`, and `debug.mem = () => memSnapshot()` on `__game.debug`.
- **Writers:** SEEDS writes `seeds.*`; D8 writes `doorGrey`, `grey`, `measure`; W4 writes `wheel`; PANEL writes `teachFirst`, `panel`; JOBS writes `jobs.*`. A skipped interaction writes its canonical result.

**`src/story/crafts/`: craft modules** (exact exports; the owner lands stubs with these signatures in **Phase 0**)

| Module | Owner | Exports |
|---|---|---|
| `crafts/pointer.js` | D8 | `craftPointer(ctx) → P`. `P.update()` once per frame, at the top of your `d.until` callback. State for this frame: `P.ndc` (Vector2), `P.down`, `P.pressed`, `P.released`, `P.click` (press and release within 6 px and 0.35 s), `P.dragX` / `P.dragY` (px moved this frame while down), `P.wheel` (notches this frame, + = toward the user, at most ±3), `P.pick(objects) → {object, point} \| null` (raycast from `ndc`, recursive), `P.cursor(css)`, `P.dispose()`. It listens on the renderer canvas, calls `preventDefault` on `wheel` while alive, and never takes pointer lock. |
| `crafts/finish.js` | D8 | `dry(ctx, material, {secs = 20, wetRough = 0.18, dryRough = material.roughness, darken = 0.1}) → {done: Promise, stop()}`: the material starts wet (glossy and slightly dark), then eases to matte. For an unlit material only the colour changes. `reveal(ctx, d, {hold = 1.2, pulse = 0.04, volume = 0.14}) → Promise`: the completion beat. It calls `settle()` and `mood.pulse(pulse)`, then a gated `d.wait(hold)`; the caller has already framed the shot, and input does nothing during the hold. `settle(audio, {volume = 0.14})`: a soft low sine 196→180 Hz over 0.6 s plus a 0.25 s low-passed breath of noise at 400 Hz. |
| `crafts/juice.js` | W4 | `makeDust(ctx, {max = 96, size = 0.012}) → {emit(pos, {n = 8, color, dir, speed = 0.6, spread = 0.5, life = 0.9}), dispose()}`: one `Points` draw, gravity 3 m/s², fades out, updated in `world.onUpdate`. `scrapeAt(audio, rate, {ref = 2.0})`: one stroke sound whose pitch and volume follow the stroke rate, with `k = clamp(rate / ref, 0, 1.3)`, `audio.scrape({volume: 0.1 + 0.14k, freq: 700 + 700k})`. `brushHiss(audio, speed)`: throttled to one burst per 0.12 s, `audio.noise({type: 'bandpass', freq: 3200, q: 0.8, dur: 0.12, volume: 0.035·clamp(speed, 0, 1)})`. `scrubber(pointer, {minTravel = 40}) → () => 'KeyA' \| 'KeyD' \| null`: a mouse stroke is a horizontal drag that reverses after at least 40 px of travel. |
| `crafts/truing.js` | W4 | `trueWheel(ctx, d, opts) → Promise<{skipped, assisted, plucks, secs, overTight}>` (R3.4). `pluck(audio, freq, {volume = 0.16, decay = 0.7})`: a sine at f plus a triangle at 2.003f with an exponential decay and a 15 ms noise tick on the attack, built on `audio.ctx` into `audio.fx`. `spokeFreq(tension, f0 = 523) = f0·√tension`. |
| `crafts/letters.js` | W4 | `GLYPHS`: single-path polylines in a unit em box, y down, for `O P E N K B A`. `layoutWord(word, {x, y, w, h, gap = 0.12}) → [{pts, length}]`. `makeLetterBoard({w, h, px = [1024, 512], base, paint = '#a3392b', word, ghost = null}) → board` with the same API as `scene4`'s board (`face`, `group`, `size`, `paths`, `pointAt`, `paintTo`, `lift`, `setBrush`, `perfect`, `guides`, `update`, `snapshot`). `letter(ctx, d, board, {speed = 0.45, kpx = 34, lead = 1.1, gap = 0.7, steer = {dims: 2, drift: 0.7, driftGrow: 0.2, gain: 0.9, recenter: 0.35}, hint = L.hints.steer, onStroke}) → Promise<score>`: this is Ch4's `lettering()` moved here unchanged. Score = mean \|offset\|; a skip paints the guides perfectly and returns 0. |
| `src/world/bikeRig.js` | W4 | `rigBike(bike) → rig`: `rigBike()` moved out of `scene4.js` unchanged (scene4 imports it), plus a manual mode. `rig.setAngle(rad)` puts the wheel under direct control (spin 0). `rig.setLateral(fn(angle) → rad)` replaces the single cosine wobble. `rig.flashPad()`. `rig.onRub` fires on a crossing in either direction. `rig.spokes` is the rear wheel's `LineSegments` (`bike.userData.spokes[1]`). |
| `crafts/radio.js` | JOBS | `tuneRadio(ctx, d, opts) → Promise<{skipped, found}>` and `radioVoice(audio) → {set(u), music(on), dispose()}` (R3.8b). |

- **`minigames.rhythm()`** (W4, narrow edit): a new option `poll: () => code | null`, read every frame. A returned code that differs from `s.lastKey` counts as a stroke. This is how `scrubber()` makes sanding and the shutter work with the mouse.
- **`src/ui/swatch.js` + `src/ui/craft.css`** (D8, new): `mixChip(ui, {tins: [{name, color}], labels: {tip, done, hint}, onTin(i), onTip(), onDone()}) → {set(hex, counts), shake(), dispose()}`. It is a small DOM chip at bottom-centre, above the prompt line: a 28 px swatch in the true mix colour, five tin dots in their tin colours, each with its digit and name, and two buttons. Everything in it is clickable. `swatch.js` imports `craft.css`; it does not edit `UI.js` or `style.css`.
- **`audio.buffer(name)`** (JOBS, one-line edit to `Audio.js`): a public alias of `_buffer(name)`, so the radio can play a track through its own filters.

### R3.2 Ch4 Day 8: Measure twice, with the tape (owner D8)

- **Prop.** `scene4`'s existing `tape` group (the `tape_measure` scan on its side, plus the blade). D8 exposes `W.tape.setLength(cm)` (the blade's scale along the frame, 0–90 cm), `W.tape.setBow(k)` (0–1, bends the blade's middle up by up to 1.5 cm) and `W.tape.loupe` (below).
- **Beat order.** It replaces the old `[measure]` dialogue:
  1. `start`: unchanged ("Door goes back in the frame. It's eighty-two wide. Measure the frame.").
  2. **Frame** hotspot (REQUIRED, "Measure"). Cinematic: Hugo crouches at the frame and `shots.frame` frames the doorway. The case hooks on the near jamb.
  3. **Reading 1** (the minigame below). Hugo says the reading: `tape.readings[i]`.
  4. `tape.twice`: Odile "Measure twice." / Hugo "Again?" / Odile "Yes." These play after the first reading only.
  5. **Reading 2.** Hugo says `tape.again[i]` (the same numbers with a leading "...").
  6. If the two latest readings differ: Odile says the next line from `tape.differ` (in order, wrapping), and Hugo measures again. Each new reading is compared with the one before it. It ends when two consecutive readings are equal.
  7. **Assist:** after 3 disagreements, Odile says `tape.help` and holds the end. The next reading soft-stops at the jamb (81.5) and counts as agreed on its own.
  8. `tape.cut[i]` for the agreed reading (Odile). Notebook +"Measure twice." (unchanged).
- **The mechanic.**
  - **Input:** hold `{Space}`, or hold the left mouse button anywhere on the canvas, to pull the blade. Release to read. The prompt is `tape.hint`.
  - **The blade** `x` (cm) grows while held: 60 cm/s up to 70 cm, then easing linearly down to 4 cm/s at the jamb (81.5).
  - **The jamb is 81.5 cm.** When `x` reaches it, the case touches the jamb with a small wooden "tock" (`audio.tick({volume: 0.22})`). From then on, holding presses the case into the jamb: the blade bows (`setBow`) and `x` keeps rising at 0.8 cm/s up to 83 cm, where it stops with a faint creak (`audio.noise({type: 'bandpass', freq: 240, q: 6, dur: 0.3, volume: 0.06})`).
  - **Release:** if `x < 79.5`, the blade zips back (`audio.noise({type: 'highpass', freq: 2400, dur: 0.25, volume: 0.07})`). Odile barks `tape.short` (non-blocking), and the attempt doesn't count. Otherwise the reading is `snap(x, 0.5)` clamped to [80.5, 82.5], and `i = (reading − 80.5) / 0.5` (0–4).
  - **Feel:** release within about 0.3 s after the tock and you read 81.5. Release early and you read short; press longer and you read long.
  - **The loupe** (visual twin of the tock and the creak): a camera-parented plane 0.32 × 0.09 at 0.6 m, in the lower third, drawn on a CanvasTexture, so the grime and grain still apply. It shows the blade magnified about 6×, with mm ticks and cm numbers (digits only, no language), scrolling under a fixed red hairline (the case edge) and the wood edge of the jamb coming in from the right. When the case touches, the jamb edge meets the hairline and the hairline thickens. While the blade bows, the ticks bunch and the hairline turns warm red.
- **Idle:** after 6 s with no input, the tape pulls itself and releases on the tock (81.5).
- **Skip:** readings `[81.5, 81.5]`, agreed 81.5.
- **Memory:** `remember('measure', {readings, agreed, assisted})`.
- **Camera:** `shots.frame`, unchanged. The loupe is hidden whenever dialogue is open.
- **Length:** 20–35 s.

### R3.3 Ch4 Day 8: the grey, a colour-mixing toy (owner D8)

- **Replaces** `greyMenu` (removed from EN and FR). The lines before it are unchanged: "Now. Colour. I want a grey." / "Easy." / "A grey that isn't sad."
- **Staging.**
  - A cut to `shots.mix`: a 3/4 top view, fov about 38.
  - **The props** are in `scene4/mixer.js` (new, D8), on an upturned crate beside the trestles, inside the bulb's pool, about 0.75 m high:
    - an enamel pot (open cylinder, about 0.16 m across), whose paint surface is a disc carrying the live mix colour (roughness 0.2, wet);
    - five small tins in a row, each with a paint disc in its own colour.
  - **Colour during mixing:** `mood.focusOn(pot, {slot: 0, strength: 1, floor: 1, decay: 0, radius: 0.12, offsetY: 0})`, so the swatch reads in true colour at hope 0.2. The door's bloom takes slot 0 back later.
  - Odile stands at the player's shoulder (`arms_crossed`).
- **Opening line:** `mixer.intro`, a stage line: *"Five tins: white, black, ochre, blue, red oxide. One pot."*
- **Inputs:**
  - **A drop:** `1`–`5`, or click a tin (`P.pick`), or click a tin dot on the chip. Each drop tilts its tin for 0.35 s, plays a "plip" (`audio.tone({freq: 900, to: 400, dur: 0.08, volume: 0.08})`), sends a ripple ring across the pot surface, and eases the swatch to the new mix over 0.4 s with a small stir swirl. The chip's swatch updates too.
  - **Tip it out:** `{KeyT}`, or the chip's "Tip it out" button. The pot empties with a slosh (`audio.noise({type: 'lowpass', freq: 500, dur: 0.4, volume: 0.1})`) and the paint level drops.
  - **Done:** `{KeyE}`, or the chip's "Done" button. It needs at least 2 drops, and a pot that changed since her last verdict; otherwise the chip shakes. An E pressed within 0.4 s of her lines closing is dialogue, not Done.
  - **Capacity:** 18 drops. Past that, a drop is refused and Odile barks `mixer.full`. The paint level rises with each drop.
  - Prompt: `mixer.hint`.
- **The pigment model** (`crafts/mix.js`, D8, pure functions: `mixLab(counts) → [L, a, b]`, `labToHex(lab)`, `lch(lab) → {L, C, h}`, `classify(counts) → verdict`):

  | Tin | Key | Colour | Strength |
  |---|---|---|---|
  | White | 1 | `#f2efe8` | 1.0 |
  | Black | 2 | `#1b1a19` | 3.0 |
  | Ochre | 3 | `#b8862c` | 1.2 |
  | Blue | 4 | `#27467f` | 2.0 |
  | Red oxide | 5 | `#8b3a22` | 1.5 |

  - **Mix:** OKLab average weighted by `drops × strength`. Black and blue are strong, white is weak. Blue cancels ochre's warmth (their a/b roughly oppose), which is why Odile's recipe has "one drop of blue". The swatch is the OKLab result converted to sRGB and clamped.
  - **Verdict** (on Done), first match wins, with C = chroma and h in degrees:
    1. **target:** 0.57 ≤ L ≤ 0.68 and 0.008 ≤ C ≤ 0.026 and 65 ≤ h ≤ 105.
    2. **Strong colour (C > 0.06), by hue whatever the lightness** (playtest fix: a pot of blue is blue, not a funeral): h in (105, 300) **blue**; h in [65, 105] **ochre** if L > 0.6, else **mud**; h in [50, 65) **mud** (orange-brown); otherwise **red**.
    3. **mud:** ochre, blue and red oxide are all ≥ 1 drop, unless the result is a near-neutral grey (0.55 ≤ L ≤ 0.75 and C < 0.02).
    4. **dark:** L < 0.53.
    5. **If C ≥ 0.008:**
       - h in [65, 105]: if C > 0.026, **ochre** when L > 0.6, else **mud**; else if L > 0.68, **light**; else **dark**.
       - h in (105, 300): **blue**.
       - otherwise: C < 0.015 is a grey with a blush (**light** if L > 0.68, else **waiting**); h in [50, 65) with C > 0.026 is **mud**; else **red**.
    6. **If C < 0.008:** **light** if L > 0.68, else **waiting**.
  - **Reference results** (from the tuning run):

    | Drops | Swatch | Verdict |
    |---|---|---|
    | W1 K1 | `#494846` | dark |
    | W3 K1 | `#7e7c78` | waiting |
    | W4 K1 | `#8d8b87` | waiting |
    | W6 K1 | `#a3a09c` | light |
    | W4 K1 O1 | `#948b7d` | target |
    | W5 K1 O2 B1 (Odile's recipe) | `#8d8881` | target |
    | W5 K1 O1 B1 | `#888888` | waiting |
    | W5 K1 B1 | `#828790` | blue |
    | W5 K1 O1 R1 | `#9d897a` | mud |
    | W5 K1 O3 | `#a39379` | ochre |
- **Odile's verdicts** (blocking, `mixer.verdicts.<v>`):
  - **waiting:** "That's not a grey. That's a waiting room."
  - **light:** "Now it's a sad grey pretending to be fine. I know the type." The first time on a pot with black in it, follow it with the existing stage line `greyLook` (*She looks at him while she says it.*).
  - **dark:** "That's a funeral. It's a door, not a hearse."
  - **ochre:** "That's not grey. That's custard."
  - **blue:** "Too cold. That grey's waiting for a bus."
  - **red:** "That's gone pink. A pink door. The street would talk."
  - **mud:** "That's mud. Honest mud, but mud. Tip it out."
  - **target:** "...There. Now it's a grey that's been somewhere." The toy ends.
  - After any verdict except target, the pot keeps its paint: the player adds drops or tips it out.
- **Assist** (counted on rejected Dones `r`, or on idle with no drop, tip or Done):
  - r = 2, or 12 s idle: `mixer.hints[0]`, Odile: "White first. Then black, a drop at a time. Like gossip." If the last verdict was waiting or light (he already has a plain grey), `mixer.warm` instead: "The grey's there. Now a drop of ochre. Warm, not yellow."
  - r = 3, or 24 s idle: `mixer.hints[1]`, Odile: "Five white, one black. Two ochre. One blue, to calm it down."
  - r = 4, or 40 s idle: `mixer.give`, Odile: "Give it here." Then the stage line *She tips it out and does it in four moves, without looking.* The pot animates the canonical recipe in four pours (white ×5 as one pour, black, ochre ×2, blue), the swatch is set to exactly `#8d877c`, then the target verdict plays.
- **Skip:** canonical `#8d877c`, `assisted: false`.
- **After:** release slot 0. `remember('doorGrey', hex)` with the accepted swatch (`#8d877c` if Odile finished it), and `remember('grey', {tries: r + 1, assisted})`.
- **The paint goes on:**
  - D8 adds `W.door.setPaintColor(hex)` (`scene4.js`, narrow edit); `L.ch4.day8.paintColor` stays as the default. The auto-paint then runs exactly as before: 6 bands, one scrape each, and the slot 0 bloom on the last band with hope 0.35.
  - New: the door starts wet (`finish.dry(ctx, doorMaterial, {secs: 20})`), and `finish.reveal()` holds 1.2 s on the finished door before `painted`.
  - `painted` and the notebook entry "Mix a grey that isn't sad." are unchanged.
- **Length:** 30–60 s.

### R3.4 Ch4 Week 4: truing by ear (owner W4)

- **Replaces** the driving ring. `T4.week4.truing.cue` and `.shout` are removed (EN and FR). `minigames.timing()` stays exported but unused. The lines before and after are unchanged, including "You listen. It tells you where it rubs." (now literally true).
- **The wheel.**
  - Rear wheel, 16 spokes (`bike.userData.spokes[1]`), spoke `i` at angle `i·22.5°`. Each has a tension `T`, where 1.0 is right.
  - **Ch4 faults:** `[[4, 0.6]]`, one slack spoke, so `week4.bike` stays true. `trueWheel` takes `faults` as an option.
  - **Pitch:** `spokeFreq(T) = 523·√T`. In tune is |T − 1| ≤ 0.05.
  - **Rim deviation:** `lateral(θ) = 0.07 · Σ (Tᵢ − 1) · sideᵢ · bump(θ − θᵢ)`, where `sideᵢ = ±1` alternates and `bump` is cos² over ±40°. W4 feeds it through `rig.setLateral`.
  - **Rub:** when |lateral| at the pad exceeds 0.012 rad, `onRub` gives a tick (volume ∝ deviation, up to 0.3) and the pad flashes (existing). So turning the wheel past the slack spoke rubs exactly there.
- **Inputs:**
  - **Turn:** `{KeyA}` / `{KeyD}` (or the arrows) step one spoke (a 0.12 s ease), auto-repeating at 6/s while held. Or drag horizontally with the mouse (0.01 rad per px); on release it snaps to the nearest spoke. The spoke at 12 o'clock is under the pluck point and is shown by a chalk tick on the tyre above it.
  - **Pluck:** `{Space}` or a click: `pluck(spokeFreq(T))`.
  - **Quarter turn:** `{KeyW}` tightens and `{KeyS}` loosens (T ± 0.1). Or scroll: toward you tightens, away loosens, one notch per quarter turn, throttled to 0.12 s. Each quarter turn plays a tiny nipple click (`audio.tick({volume: 0.12})`) and then auto-plucks that spoke.
  - T is clamped to [0.4, 1.4]. Over 1.15, the pluck is a sharp `audio.ping({freq: 1900})` and Sami barks `ping`.
  - Prompt: `truing.hint`.
- **Visual twins:**
  - A plucked spoke vibrates: its rim end oscillates at a visible 22 Hz, 4 mm, decaying over 0.6 s, and it brightens briefly (vertex colours on that `LineSegments`).
  - `ui.gauge(truing.gauge, {value: f / 523, min: 0.75, max: 1.25, band: [0.975, 1.025], text: truing.pitch.flat | .sharp | .true})` shows the last pluck against the reference band.
  - The rub is the pad flash.
- **Sami's barks** (non-blocking, `who: 'Sami'`, 2.4 s, at most one per 5 s; `truing.barks.*`):
  - loosening a spoke that was in tune: `clunk`, "Was it meant to go clunk?"
  - 3 plucks within 1.5 s: `hitting`, "Odile, he's hitting it."
  - 5 s with no input while the wheel is still out: `notFixed`, "Is it fixed? It's not fixed."
  - T over 1.15: `ping`, "It went ping. Is ping good?" (new)
  - the first quarter turn that raises a flat spoke while it is still flat: `higher`, "It's getting higher." (new)
- **Assist:**
  - After 15 s without a spoke coming into tune, or 8 s idle: Hugo's thought `truing.flat` ("There. That one's flat."). The flattest out-of-tune spoke gets a chalk mark on the rim, and the wheel turns itself to bring it under the pluck point.
  - After 20 s more, or 20 s idle: it finishes itself. The wheel turns to each bad spoke and corrects it a quarter turn at a time, auto-plucking every 0.45 s. Then Sami barks `truing.assisted` ("Is it fixed? ...It's fixed.").
- **Done** when every spoke is in tune: the rim stops rubbing.
  - One clear pluck of the true note, `bike.setSpin(0.6)`, silent.
  - `finish.reveal(ctx, d, {hold: 1.5})`.
  - Then, as before, `mood.focusOn(bike.group, {slot: 1, floor: 0.55, offsetY: 0.5})` and hope 0.42.
- **Skip:** every T = 1, wobble 0.
- **Memory:** `remember('wheel', {secs, plucks, assisted, overTight})`.
- **Camera:** `shots.truing`. W4 may raise it slightly, so that the top of the rim (the pluck point) and the pads are both in frame.
- **Length:** 30–45 s.
- **`trueWheel` opts:** `{rig, faults, text = T4.week4.truing, f0 = 523, onSpokeTrue}`. Ch5 passes its own `text` (R3.8d).

### R3.5 Juice, craft by craft (subtle and cheap)

| Craft | Owner | What's added |
|---|---|---|
| Sanding (Ch4 Day 5) | W4 | `makeDust` emits 8 particles per stroke at the block, colour lerping from grey paint `#8f8a80` (progress 0) to pale wood `#cdb89a` (progress 1), thrown along the stroke direction. `scrapeAt(audio, s.rate)` replaces the flat `audio.scrape()`. Mashing (> 3.4/s) is harsher: `scrape({freq: 1800, volume: 0.26})`. Mouse scrubbing via `scrubber` + `rhythm({poll})`. At 1.0: `reveal({hold: 1.2})` on the bare wood before "You've done this before." |
| Grey door (Ch4 Day 8) | D8 | Wet → matte over 20 s (`finish.dry`), and `reveal({hold: 1.2})` after the last band (R3.3). |
| Truing (Ch4 Week 4) | W4 | Plucks, spoke vibration, pad flash and the reveal (R3.4). |
| Lettering (Ch4 Week 7) | W4 | `brushHiss(audio, tipSpeed)` while painting. The board starts wet and dries over 15 s (`finish.dry` on the board material). `reveal({hold: 1.2})` on the finished OPEN before the tier line. |
| The line (Ch5) | PANEL | The ribbon material starts at the wet colour (`#d9a441` × 0.82) and eases to `#d9a441` over 10 s after the line ends. Each mural panel goes wet (roughness 0.35) as the line passes under it and dries back to its own roughness over 10 s. |
| Hugo's panel (Ch5) | PANEL | Wet → matte over 12 s, then `reveal({hold: 1.2})`. |
| Street jobs (Ch5) | JOBS | Rust dust (`#8a4a2a`) and `scrapeAt` on the shutter; radio static and a found-station lamp; `brushHiss` and a drying board; plucks on Ines's wheel. Each ends with `reveal({hold: 1.0})`. |

The reveal is the only new camera beat: the shot holds still, with no new framing. Particles: one pool per scene, ≤ 96 points.

### R3.6 Seeds in Ch1 to Ch3 (owner SEEDS)

**Ch1: the wobbly table** (optional)
- After the **phone** beat ends, the coffee table rocks: two low "tocks" (`audio.tick({volume: 0.2})` 0.25 s apart), and the phone and the mug jiggle (a 0.6 s damped rotation).
  - The table is merged into a static batch, so the loose objects on it jiggle. Do not unmerge the room.
- Then an optional hotspot `table` appears (prompt "Steady it", ringed, radius 1.0, in front of the table, clear of the phone spot). One E:
  - Hugo crouches (`player.crouch(0.5)`), a folded paper square (6 × 4 × 0.3 cm, off-white) appears under the near leg, and the table settles: one last tock (`audio.thud({volume: 0.08})`) and a mug clink (`audio.tone({freq: 2400, dur: 0.05, volume: 0.05})`). Then:
  - `table`: *"Sunday's race number. Folded in four, it's exactly the right thickness."*
  - `remember('seeds.table', true)`.
- The 38 bibs on the wall stay 38: Sunday's is the one that never got pinned.

**Ch2: the ghost sign, lingering** (optional)
- Ch2 already has the "MARCHAL & FILLE — ENSEIGNES — DORURE" ghost sign and its hotspot. A second sign on No. 14 would duplicate it, and No. 14 is reached only after the arrival trigger, so the seed extends the existing hotspot.
- **Trigger:** after the `ghost` thought, if Hugo stays inside the hotspot radius (2.3 m) with no movement key held for 2.5 s:
  - The ghost sign's existing focus (slot 3) raises its floor from 0 to 0.25 over 1.5 s, so colour seeps into the old letters while he holds still. It decays back over 3 s once he moves.
  - Non-blocking `ghostLinger`: *"The thin strokes have lasted best. You'd think it'd be the other way round."*
  - Once per chapter. `remember('seeds.ghost', true)`.
- It is visual and textual, so it needs no audio twin.

**Ch3: wheels** (automatic, text only)
- `weeks[0].thoughts[30]`: *"At fifteen I built my own wheels. I could hear a slack spoke from the kitchen."*
- If the thoughts at 15 m and 45 m then overlap on screen, move the 45 m one to 52 m (the segment stays 60 m).

### R3.7 Ch5: Hugo's own panel (owner PANEL)

- **Where:** the pale rectangle where the billboard was (`BILLBOARD` z −18, y 4.7–7.7). The panel is small, 2.4 × 1.6 m, centred at z −18, y 5.0–6.6, on the primed wall.
- **Build:** `scene5/hugoPanel.js` (new): `makeHugoPanel(ctx, {wallX, doorGrey}) → {mesh, paint(motif, k), setColor(k), material}`. `paint` reveals the motif in 6 horizontal bands like the door. The motif is a CanvasTexture with no text:
  - `wheel`: a true wheel, 16 spokes, rim in ochre `#d9a441`, a blue-grey tyre.
  - `door`: a panelled door in `mem.doorGrey`, with a small brass knob.
  - `hand`: a hand holding a liner brush, perfectly still, with one fine red `#a3392b` hairline under it.
- **When:** inside the `odile` "Ready" hotspot, before `line.setup`:
  1. `panel.ask`:
     - **Odile:** "One thing first. Up there, where the billboard was. Nobody wanted it."
     - **Hugo:** "So it's mine."
     - **Odile:** "Paint something you can do. Small, if you like."
  2. `d.choose(panel.menu)`: prompt *"Something off the list."*, options [A wheel. True.] / [The door. That grey.] / [A hand, holding a brush still.], with `reply: null`. A skip picks `door`.
  3. Fade, then `panel.stage`: *Odile holds the ladder. Both hands. She doesn't help.* (It mirrors Week 4. Nobody comments.)
  4. A shot from the street (camera about `[0.5, 1.7, −12.5]`, look `[wallX, 5.6, −18]`, fov 40). The bands paint over 4 s with one `scrape` each, `finish.dry` runs, the material colour lerps from grey to full, then `mood.pulse(0.05)` and `d.hope(0.78, 2)`, then `reveal({hold: 1.2})`. Hugo is off-frame (up the ladder). There is no focus slot (Ch5's four slots are taken).
  5. Fade back. Odile's line by motif, `panel.after.<motif>`:
     - wheel: "A wheel. Sami's going to say it's his."
     - door: "My door. Higher up than I'd have hung it."
     - hand: "Steady hand. Show-off."
  6. `line.setup` as before ("Everybody's painted what they can do..." now includes him).
- **Visible in the line:** the line's opening shot starts on the panel and eases down to `LINE_CAM` over 1.6 s (`cam.tween`) while the brush waits at the chalk. Then steering starts. It is also in frame in the crane-up.
- **Memory:** `remember('panel', motif)`.
- **Length:** 20–25 s.
- **Also PANEL in Ch5:**
  - `teachFirst`: `const {tries} = await d.correct(T.teach.menu); remember('teachFirst', tries === 1)`.
  - **No. 14 in the accepted grey:** `scene5/no14paint.js` (new): `paintNo14(group, hex)`. It lays a painted leaf over No. 14's street door (x 3.75, z −48, about 1.0 × 2.1 m, 2 cm proud) and painted strips over the garage door's iron jambs and lintel (the same boxes +2 mm), in `mem.doorGrey`, roughness 0.6, no shadows. It is called from `buildScene5` (one line).

### R3.8 Ch5: street jobs (owner JOBS; runs after D8, W4 and PANEL)

- **Where it plugs in:** `src/story/ch5jobs.js` (new): `setupJobs(ctx, d, W, api) → {close(), dispose()}`.
  - `api = {bark, followDefault, isRoaming: () => roam}`, from `ch5.js`.
  - It is called right after `await d.interact('meet')`, and `close()` is called in `dropOptional()`.
  - Props come from `scene5/jobs.js` (new): `buildJobs(ctx, group, {wallX, spots, groundAt}) → {shutter, radio, board, inesBike, dispose()}`, hooked into `buildScene5` with one line. Its `dispose` also stops the radio audio.
- **The opener:** `opening` gains a fourth line, after Hugo's "Nice..." thought:
  - **Odile:** "Half this street's stuck, bent, faded or buzzing. Before your line, if your hands get bored."
- **Discoverability:**
  - Each job is an optional hotspot (`required: false`, so the objective pointer stays on the main path), ringed, `enabled: () => roam && !mem.jobs[id]`.
  - **When they open (playtest fix):** the shutter and the board right after the opener; the radio and Ines's wheel only once Teach is done (`api.taught()`), so Sami never parks on the radio, never says "the radio's still broken" after it was fixed, and stands at the bike-shop window during the wheel. Sami's arrival call waits for a running job to end (`jobs.busy()`), and Sami stops in the road (x ≥ −1.5), clear of the radio crate.
  - Each has one approach bark (once, within 4.5 m, through `api.bark`; Sami's wheel bark carries 9 m from the bike-shop window).
  - 2.5 s after Teach, if Hugo is more than 8 m from the shutter and it's still stuck, Mme Benali calls from up the street (`jobs.shutter.call`).
  - The first "Ready" at Odile while any job is still open asks once (`ch5.readyCheck`, Odile: "Nobody's timing you." [Ready.] / [Not yet.]); Not yet leaves everything open.
  - A finished job's hotspot is removed, and Hugo is put back where he started it (work spots can be off the walkable street).
- **Colour:** each job lerps its own materials from a luma-matched grey to their colour, `k` 0.15 → 1 over 1.5 s at completion. No focus slots, no hope change.
- **Staging:** each job is a `d.cinematic`, with a cut to its shot, the minigame, `reveal({hold: 1.0})`, the done line, and a cut back (`followDefault`). Props never stand within 1.2 m of the line staging (Odile at `[wallX + 1.9, LINE_Z1 − 1.6]`, Ines at `[−2.2, LINE_Z1 − 3.4]`), the bench or the chair. New meshes don't cast shadows, except the bike frame. Total ≤ 16 draws.

**(a) Mme Benali's shutter** (`shutter`, about 20 s)
- **Prop:** a slatted roller shutter stuck at 45% over the bakery front (left side, z −6 … −12), with rusty runners. The shop glow behind it is dimmed until the job is done.
- **Prompt:** "Fix the shutter".
- **Approach bark** (Mme Benali): "It sticks halfway every morning. I open half a bakery."
- **The craft:** `rhythm()` with:
  - band [1.6, 2.6], mashAt 3.4, `idleAuto {after: 5, rate: 2.1}`, `gauge {label: jobs.shutter.gauge}` ("RUNNERS"), `poll: scrubber(P)`;
  - progress +0.07 in band, +0.03 out (about 7 s of good rhythm);
  - each stroke: `scrapeAt`, 6 rust particles at the runner, and the shutter twitches up 2 cm and settles.
  - Mashing: Mme Benali barks `jobs.shutter.mash`, "Gently. It's older than me."
- **Done:**
  - The shutter rolls up over 1.6 s with a rattle (20 bursts of `audio.noise({type: 'highpass', freq: 1800, dur: 0.05, volume: 0.06})` 0.08 s apart).
  - The bakery's window glow lerps up (emissive `#ffc98a`, 0 → 1.4) and the BOULANGERIE BENALI sign's colour returns.
  - **Mme Benali:** "It went up. Now I'll have to be nice to people all morning."
- **Skip:** progress 1. `remember('jobs.shutter', true)`.

**(b) Odile's radio** (`radio`, 20–30 s)
- **Prop:** `radio.glb` (`height: 0.25`) on an upturned crate by Odile's chair (about `[−3.7, −38.9]`), clear of the bench path.
  - Its dial is a CanvasTexture: a scale 88…108 (digits only) and a needle.
  - A round signal lamp ("magic eye") glows with the signal strength.
  - It hisses quietly from the start (static at 0.04).
- **Prompt:** "Tune it".
- **Approach bark** (Odile): "It still only gets the fishing."
- **The craft:** `tuneRadio()`.
  - **Dial** u ∈ [0, 1]. Turn it with `{KeyA}` / `{KeyD}` (0.22/s held), or drag (0.0012 per px), or scroll (0.012 per notch). Prompt: `jobs.radio.hint`.
  - **Stations:** fishing u 0.16, music 0.41, football 0.64, forecast 0.87.
    - The dial starts on fishing, and fishing counts as found ("only gets the fishing").
    - Signal per station `s = 1 − |u − uᵢ| / 0.06` (clamped). Static gain = 0.25·(1 − max s) + 0.03.
  - **A station is found** when the needle rests within ±0.02 of it for 0.8 s. Then:
    - a soft two-note chime (`audio.tone` 660 then 990 Hz, 0.12 s each, volume 0.06);
    - the lamp flares;
    - a chalk tick is drawn on the dial at that station (Odile's chalk);
    - the caption `jobs.radio.stations.<id>` shows as a non-blocking thought with `who: 'Radio'` (2.6 s). It is also the visual twin of the audio.
  - **Sound** (`radioVoice`, on `audio.ctx` into `audio.bus`):
    - **Static:** white noise, bandpass 2500 Hz, q 0.6.
    - **Talk** (fishing, football, forecast): a sawtooth "voice" (110 Hz for fishing, 140 Hz for football, 190 Hz for the forecast) through two formant bandpasses (F1 500–800 Hz, F2 1200–1800 Hz, q 6, wandering slowly). It is gated by a syllable envelope: syllables 0.12–0.28 s with gaps 0.05–0.4 s; fishing is slow, football fast. Football adds `crowd` through the radio band at 0.3.
    - **Music:** the `contemplation` track (`audio.buffer`) through a highpass at 380 Hz and a lowpass at 3200 Hz.
    - Everything passes a final radio band (highpass 300 Hz, lowpass 3400 Hz).
- **Captions** (`jobs.radio.stations`):
  - fishing: "...and the pike, you see, the pike doesn't care about your feelings..."
  - music: "*Music. Slow, a bit scratched.*"
  - football: "...two-nil, and nobody here can quite believe it..."
  - forecast: "...Pas-de-Calais, westerly four or five, rain later, good..."
- **Assist:** after 6 s idle, the needle creeps toward the nearest unfound station at 0.06/s. At 30 s, the rest are found automatically, 2 s apart.
- **Done** (all four found), `jobs.radio.done`:
  - **Odile:** "Four stations. I've had the fishing man since the franc."
  - **Hugo:** "Fishing?"
  - **Odile:** "Leave it on the music. The fish can wait."
  - Then the needle glides to music (1.2 s) and the radio keeps playing music **for the rest of the chapter**, including the golden-hour walk:
    - Its gain is `0.32 · clamp(1 − (dist − 2) / 22, 0.15, 1)` from Hugo's distance to the radio.
    - The chapter's piano ducks to 0.12 while it plays (`audio.music('piano', {volume: 0.12, fade: 2})`).
    - The lamp stays lit, so the music is visible too.
- **Skip:** all found, music on. `remember('jobs.radio', true)`.

**(c) Marco's menu board** (`board`, 25–30 s)
- **Prop:** a sandwich A-board between the kebab door and the bench (≥ 1.2 m from Odile's line spot and from `S.bench`).
  - Its face is a `makeLetterBoard({w: 0.56, h: 0.36, base: '#e6dcc4', paint: '#a3392b', word: 'KEBAB', ghost: 'rgba(160,120,120,0.35)'})`.
  - The faded old KEBAB shows as the ghost. The word is the same in French (`jobs.board.word`, marked as-is signage).
- **Prompt:** "Re-letter it".
- **Approach bark** (Marco): "My board's so faded people think we're shut."
- **The craft:** `letter(ctx, d, board, {speed: 0.6, lead: 0.5, gap: 0.4})`.
  - 5 single-path strokes K E B A B from `GLYPHS`, a camera square to the board (fov 30), and `brushHiss`.
  - The base colour lerps to cream as the strokes land, then the board dries (`finish.dry`, 12 s).
- **Marco's tier lines** (`jobs.board.tiers`, thresholds as OPEN: good < 0.16 < middle < 0.42 < poor):
  - good: "Now that's a great kebab sign."
  - middle: "It's got character. Like the kebab."
  - poor: "It's a bit drunk. So are half my customers, after midnight."
- **Skip:** perfect letters. `remember('jobs.board', true)`.

**(d) Ines's wheel** (`wheel`, 25–35 s)
- **Prop:** `build.bicycle({frame: '#c24a6a'})` leaning on its kickstand at the bike shop window (about `[4.2, −31.9]`). The frame starts greyed (k 0.15).
- **Prompt:** "Look at the wheel".
- **Approach bark** (Sami): "Ines bent her wheel on a kerb. I do punctures. Bends are you."
- **The craft:**
  - A short fade. The bike is upside down on its saddle and bars (`rigBike`), and Hugo crouches.
  - A low close shot on the rear wheel.
  - `trueWheel(ctx, d, {rig, faults: [[3, 0.7], [10, 1.3]], text: L.ch5.jobs.wheel.truing})`: one flat and one sharp spoke, so this time he loosens one. The hint, gauge and pitch words are read from `L.ch4.week4.truing`.
- **Ch5 truing text** (`jobs.wheel.truing`; `who: 'Sami'`):
  - `flat` (Hugo's thought): "There. That one's off."
  - `barks.clunk`: "Clunk's bad. I know clunk now."
  - `barks.hitting`: "You're just hitting it now."
  - `barks.notFixed`: "Not fixed. I can hear it."
  - `barks.ping`: "That one went ping. Is ping good this time?"
  - `barks.higher`: "It's getting higher."
  - `assisted`: "...Fixed. I'm saying I helped."
- **Done:** the wheel spins free and silent, and the frame colour returns. Sami's non-blocking bark `jobs.wheel.done`: "Ines! Your wheel sings now!" The bike goes back on its kickstand behind a fade.
- **Skip:** true. `remember('jobs.wheel', true)`.

### R3.9 Conditional ending cards (owner PANEL)

- **Code:** `src/story/ending.js` (new): `endingLines(m = mem, E = L.ending) → string[7]`, a pure function of memory.
- **Wiring:** `Director.start()` calls `ui.endCard({...L.ending, lines: endingLines()})`.
- **Fallback:** `L.ending.lines` stays, as the default selection (for checks, and for a fallback when `cards` is missing).
- **Text** (`common.js`, `ending.cards`):
  - `street`, chosen by `mem.panel`:
    - `plain` (panel null): "Rue des Tanneurs never got another billboard."
    - `wheel`: "Rue des Tanneurs never got another billboard. Where it was, there's a small wheel. Sami says it's his."
    - `door`: "Rue des Tanneurs never got another billboard. Where it was, there's a small grey door. People knock on the real one."
    - `hand`: "Rue des Tanneurs never got another billboard. Where it was, a small hand holds a brush very still."
  - `sami`, chosen by `mem.teachFirst`:
    - `first`: "Sami Haddad fixes punctures. Two euros, or free if you'll learn."
    - `second`: "Sami Haddad fixes punctures. Two euros, or free if you'll learn. He lets you get it wrong first."
  - `job`, the first done in the order board, wheel, shutter:
    - `board`: "Marco's board says KEBAB again, by hand. He added GREAT himself. It's a bit drunk."
    - `wheel`: "Ines rides a wheel that doesn't rub. She signs her work now. Small, in the corner."
    - `shutter`: "Mme Benali's shutter goes up at six without a sound. She misses the argument."
  - `grey`, used in the `job` slot when none of those three jobs is done:
    - `own`: "No. 14's door is a grey that's been somewhere. He never wrote the recipe down."
    - `odile` (`mem.grey.assisted`): "No. 14's door is a grey Odile finished. He says he mixed it. She lets him."
  - `radio`, chosen by `mem.jobs.radio`:
    - `fixed`: "Odile's radio gets four stations now. She listens to the fishing one."
    - `one`: "Odile's radio still gets one station. She's learned a great deal about fishing."
  - `ask`: "Odile Marchal's list got one line longer that year. It says "Ask."" (unchanged)
  - `runs`: "Hugo Revel runs some Sundays. Nobody knows how far, including him." (unchanged; second to last)
  - `watch`: "His watch hangs on a nail above the workbench. It thinks he's been resting for a year." (unchanged; last)
- **Selection** (always 7 cards, in this order):
  ```js
  const c = E.cards, j = m.jobs || {};
  return [
    c.street[m.panel] ?? c.street.plain,
    m.teachFirst === false ? c.sami.second : c.sami.first,
    j.board ? c.job.board : j.wheel ? c.job.wheel : j.shutter ? c.job.shutter : m.grey?.assisted ? c.grey.odile : c.grey.own,
    j.radio ? c.radio.fixed : c.radio.one,
    c.ask, c.runs, c.watch,
  ];
  ```
- **Defaults:** a straight jump to Ch5 with no jobs gives the plain-or-panel street card, `first`, `grey.own` and `radio.one`.
- **Also PANEL in `common.js`:**
  - `title.controls`: the `{Space}` row becomes "Hold the tape · pluck a spoke", and "1 – 3 / Choices" becomes "1 – 5 / Choices · paint tins".
  - Add a `Mouse` hint to the existing Mouse row: "Look around · {KeyR} re-centre · click, drag, scroll in crafts". If it breaks the 42-character limit, keep the row as it is and put the craft mouse hint in each craft's `hint` instead.

### R3.10 Audio cues and their visual twins

| Cue | Visual twin |
|---|---|
| Tape touches the jamb (tock); bow creak | The loupe: the jamb edge meets the hairline, then the ticks bunch and the hairline turns red; the blade bows in 3D |
| Tape zips back (too short) | The blade retracts; Odile's bark |
| Paint drop "plip"; slosh | The tin tilts, a ripple on the pot, the swatch changes; the paint level drops |
| Spoke pluck pitch | The spoke vibrates; the PITCH gauge with FLAT / SHARP / TRUE |
| Rim rub | The pad flash and the rim's visible swing at the pad |
| Over-tight ping | Sami's bark; the gauge's warn colour |
| Scrape speed and pitch | Dust volume and the gauge |
| Radio static, voices and music | The needle, the signal lamp, the chalk ticks, the `Radio` captions; the lamp stays lit while music plays |
| Shutter rattle | The shutter rolling up |
| `settle()` on a reveal | The camera hold and `mood.pulse` |
| Table tocks (Ch1) | The phone and mug jiggle |

### R3.11 Hope, colour and pacing

- **Hope schedule:**
  - unchanged except Ch5: 0.75 (Teach) → **0.78 (Hugo's panel)** → 0.84 over the line → 0.9 (signed) → 0.95 → 1.0;
  - the jobs and seeds change no hope;
  - the Ch4 mixer borrows focus slot 0 (floor 1.0) until the door takes it back.
- **Colour on the things he makes:** the door now carries the player's own grey, and that grey returns on No. 14 in Ch5. The jobs' colour stays local to each spot (material lerps); it is not a mood change.
- **Pacing deltas:**

  | Part | Before | After | Where it goes |
  |---|---|---|---|
  | Ch1 | 2:00 | 2:00 (+0:10 optional) | table |
  | Ch2 | 2:30 | 2:30 (+0:05 optional) | ghost linger |
  | Ch3 | 2:15 | 2:15 | one thought |
  | Ch4 | 3:45 | about 4:55 | mixer +0:35, tape +0:15, truing +0:20, reveals +0:05 |
  | Ch5 | 3:30 | about 4:05 (+1:45 optional) | panel +0:25, opener and pre-roll +0:05; four jobs optional |
  | Ending | 0:30 | 0:34 | 7 cards |
  | **Growth** | | **+1:50 required, +2:00 optional (about +3:50 worst case)** | |

- **If Ch4 runs long,** cut in this order: the "Again?" / "Yes." pair (R3.2 step 4 becomes "Measure twice." alone), then the `higher` bark, then the mixer's 12 s idle hint (keep the rejection count).

### R3.12 File ownership and phases

**Phase 0** (the first commit-sized step of each agent; signatures exactly as in R3.1, bodies may be stubs):
- PANEL: `src/story/memory.js`.
- D8: `crafts/pointer.js`, `crafts/finish.js`.
- W4: `crafts/juice.js`, `crafts/truing.js`, `crafts/letters.js`, `src/world/bikeRig.js` (moved, with `scene4.js` importing it).

**Phase 1, in parallel: D8, W4, SEEDS, PANEL. Phase 2: JOBS** (after D8, W4 and PANEL report done).

| Agent | New files (owned) | Shared files (narrow edits, only these sections) |
|---|---|---|
| **D8** (R3.2, R3.3, door drying) | `crafts/pointer.js`, `crafts/finish.js`, `crafts/mix.js`, `crafts/tape.js` (`measureTape(ctx, d, {tape, text}) → Promise<{readings, agreed, assisted, skipped}>`), `crafts/mixer.js` (`mixGrey(ctx, d, {mixer, text}) → Promise<{hex, tries, assisted, skipped}>`), `scene4/mixer.js` (`buildMixer(ctx, group, {pos}) → {pot, tins[5], setSwatch(hex), pour(i), tipOut(), setLevel(n), focus}`), `src/ui/swatch.js`, `src/ui/craft.css` | `ch4.js` Day 8 block only; `scene4.js` (door `setPaintColor`, tape `setLength` / `setBow` / `loupe`, mixer hookup, `shots.mix`); `text/ch4.js` + `fr/ch4.js` `day8` only (remove `measure` and `greyMenu`; add `tape`, `mixer`) |
| **W4** (R3.4, R3.5 sanding and lettering, the reusable modules) | `crafts/juice.js`, `crafts/truing.js`, `crafts/letters.js`, `src/world/bikeRig.js` | `ch4.js` Day 5 `sanding()`, the Week 4 truing call and `truing()`, the Week 7 `lettering()` (now calling `letter()`); `scene4.js` (`rigBike` removed and imported, board drying, the `shots.truing` tweak); `minigames.js` (`rhythm({poll})` only); `text/ch4.js` + `fr/ch4.js` `week4.truing` only |
| **SEEDS** (R3.6) | none | `ch1.js` + `scene1.js` (the table jiggle handle and the paper shim); `ch2.js` (the ghost linger); `text/ch1.js`, `text/ch2.js`, `text/ch3.js` + their `fr/` (`prompts.table`, `table`, `ghostLinger`, `weeks.0.thoughts.30`) |
| **PANEL** (R3.7, R3.9, memory) | `src/story/memory.js`, `src/story/ending.js`, `scene5/hugoPanel.js`, `scene5/no14paint.js` | `Director.js` (`beginChapter`, `endCard` call); `main.js` (`restoreMem`, `debug.mem`); `ch5.js` (`teachFirst`, the panel beat inside the `odile` hotspot, the line pre-roll, the ribbon and panel drying); `scene5.js` (one line each for the panel and No. 14); `text/ch5.js` + `fr` (`panel`); `text/common.js` + `fr` (`ending.cards`, `ending.lines`, `title.controls`) |
| **JOBS** (R3.8) | `src/story/ch5jobs.js`, `crafts/radio.js`, `scene5/jobs.js` | `ch5.js` (call `setupJobs` after `meet`; `close()` in `dropOptional`); `scene5.js` (one line for `buildJobs`); `Audio.js` (`buffer()` alias); `text/ch5.js` + `fr` (`opening[3]`, `prompts.{shutter, radio, board, inesBike}`, `jobs`) |

- `ch4.js`, `scene4.js` and `text/ch4.js` are shared by D8 and W4, by section. `ch5.js`, `scene5.js` and `text/ch5.js` are shared by PANEL (first) and JOBS (later). Re-read before every edit, and never reformat outside your section.
- `L.ch4.week4.truing.hint`, `.gauge` and `.pitch` are W4's. JOBS reads them; it does not copy them.

**New text keys (EN), for the FR pass:**
- `ch1.prompts.table`: "Steady it"; `ch1.table` (1 thought).
- `ch2.ghostLinger` (string).
- `ch3.weeks[0].thoughts[30]` (string).
- `ch4.day8.tape`:
  - `hint`: "Hold {Space} or the mouse button to pull. Let go at the jamb."
  - `readings[5]` (Hugo): "Eighty and a half." / "Eighty-one." / "Eighty-one and a half." / "Eighty-two." / "Eighty-two and a half."
  - `again[5]`: the same with a leading "...".
  - `twice[3]`: "Measure twice." / "Again?" / "Yes."
  - `differ[3]` (Odile): "Two numbers. The frame's only got one." / "One of those is lying. Possibly both." / "Again. The frame's not going anywhere."
  - `short` (`{who: 'Odile', text: "That's not the frame, that's air."}`).
  - `help[1]` (Odile): "Hold still. I'll hold the end."
  - `cut[5]` (Odile):
    - "Doors lie. Frames lie worse. So a centimetre and a half comes off the hinge side. Plane's on the wall."
    - "Doors lie. Frames lie worse. So a centimetre comes off the hinge side. Plane's on the wall."
    - "Doors lie. Frames lie worse. So half a centimetre comes off the hinge side. Plane's on the wall."
    - "Doors lie. Frames lie worse. This one's telling the truth, apparently. Hang it as it is."
    - "Doors lie. Frames lie worse. Half a centimetre of air on the hinge side. We'll call it ventilation."
- `ch4.day8.mixer`:
  - `intro`, `tins[5]` ("White", "Black", "Ochre", "Blue", "Red oxide");
  - `hint`: "1–5 or click a tin: one drop · {KeyT} tip it out · {KeyE} done";
  - `tip`: "Tip it out"; `done`: "Done"; `full`;
  - `verdicts.{waiting, light, dark, ochre, blue, red, mud, target}`, `hints[2]`, `give[2]`. Keep `greyLook` and `paintColor`.
- `ch4.week4.truing`:
  - `hint`: "{KeyA} / {KeyD} turn · {Space} pluck · {KeyW} / {KeyS} quarter turn · or drag, click, scroll";
  - `gauge`: "PITCH"; `pitch.{flat: 'FLAT', sharp: 'SHARP', true: 'TRUE'}`; `flat`;
  - `barks.{who, clunk, hitting, notFixed, ping, higher}`; `assisted`. Remove `cue`, `shout` and `misses`.
- `ch5.opening[3]`; `ch5.prompts.{shutter: 'Fix the shutter', radio: 'Tune it', board: 'Re-letter it', inesBike: 'Look at the wheel'}`.
- `ch5.jobs`:
  - `shutter.{near, gauge, mash, done}`;
  - `radio.{near, hint: '{KeyA} / {KeyD} or drag to turn the dial', stations.{fishing, music, football, forecast}, done[3]}`;
  - `board.{near, word: 'KEBAB', tiers.{good, middle, poor}}`;
  - `wheel.{near, truing.{flat, barks, assisted}, done}`.
- `ch5.panel.{ask[3], menu, stage[1], after.{wheel, door, hand}}`.
- `common.ending.cards.*`.

**FR notes** (the guide governs; these are the traps):
- Odile and Hugo are on tu in Ch5 and from Ch4 `day5.book[3]`; Hugo still says vous to Odile on Day 8 and in Week 4.
- Mme Benali says vous to Hugo; Marco says tu.
- The readings use the decimal comma only in digits (the loupe draws digits). The spoken readings are words, « Quatre-vingt-un et demi. » and so on.
- KEBAB is as-is signage.
- "Teech." is still « Aprendre. »
- `Radio` is the same word in both languages.
- "Doors lie. Frames lie worse." keeps its existing French wording in all five `cut` variants.

### R3.13 Verification (each agent, on its own build and port)

- **For each new interaction:**
  - (a) it completes with no input (the idle assist) in ≤ 60 s;
  - (b) `__game.debug.skip()` completes it with the canonical result and the right `mem` value (`__game.debug.mem()`);
  - (c) keyboard only works;
  - (d) mouse only works (where specified);
  - (e) muted, the visual twin shows;
  - (f) with `&lang=fr`, there is no English and the keys show as resolved tokens.
- **D8:**
  - the five verdict lines play from the reference recipes in R3.3;
  - the door shows the accepted hex;
  - all five readings produce the matching `cut` line;
  - Ch4 to Ch5 in one tab: No. 14's door is in that grey.
- **W4:**
  - Ch4 OPEN looks identical after `letter()` moves to the module;
  - sanding still takes about 15 s;
  - with 16 spokes in tune, nothing rubs.
- **PANEL:**
  - every `endingLines` combination returns 7 non-empty strings in EN and FR (a node test over the flag space);
  - `?chapter=4` gives the default cards plus the chosen panel.
- **JOBS:**
  - none of the jobs is required (the objective pointer never targets them);
  - the radio music persists into the golden-hour walk and stops at the end card;
  - draw calls stay within budget with every prop built.
- **All:** `node scripts/i18n-check.mjs fr` gives 0 errors, there are no console errors, and the chapter-by-chapter skip run reaches the end card.
