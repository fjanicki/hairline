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
- **Assets:**
  - Xbot (Mixamo, private demo only).
  - Kenney CC0 kits, including the new **survival** kit and the extra **retro** pieces.
  - Music and ambience: `contemplation.mp3`, `piano.wav`, `rain.ogg`, `crowd.ogg`.
  - Footstep samples.
  - Bicycles, the boot, the watch, the main workbench, the garage door, the blind wall and all signs are procedural.

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

| Ch | Scene file | Decision | Kenney props |
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
