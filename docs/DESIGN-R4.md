# HAIRLINE: Revision 4 (proposal): a longer story, a mystery, items, new games, Jo

Status: **approved by the user on 2026-10-08**; the game is now **French only** (no English text). The
full script is docs/SCRIPT-R4.md, which wins where the two differ (see "Script decisions" at the end). All seven
chapters are built and voiced (2026-10-09) and wait for the user's playtest. Everything stays local until the
user has played it (no commit, push or release).

## What the user asked for (2026-10-08)
- An items system.
- More minigame mechanics than WASD and A/D. They're fine for 2 or 3 games, then they get boring.
- Keep the humour.
- More weeks, a longer story.
- A mystery or detective thread to pull the player through.
- A readable notebook (done: docked at 80% scale instead of 56%).
- Voice audio for every new line, generated as before, with a distinct voice per character.
- Rename Marco and Ines.
- A romance: a woman from Quebec with tattoos, confident, a "bad bitch" on the outside and very kind.
  She finds it attractive that Hugo is learning new skills. Her name starts with J (not Justine).

## Summary of the proposal
- **Length:** 7 chapters instead of 5, about 35–45 minutes instead of 13–16.
- **Calendar:** the boot runs from Day 4 to Week 12, and every week from 2 to 12 gets a beat.
- **New thread: the Night Fixer.** Things on Rue des Tanneurs are being repaired overnight, and
  Odile's tools go missing and come back clean. Hugo, who can't stop counting, turns detective. His
  methods are the ones he already has: splits, step counts, GPS traces, measuring twice and listening
  for the rub. The culprit is a mirror of Hugo.
- **New character: Josianne "Jo" Lavoie, 34, from Montréal.** A fine-line tattoo artist who has just
  opened a shop on the street. Fine-line work is the tattoo world's version of a hairline, so she
  belongs to the theme rather than being bolted on.
- **Renames:** Marco becomes **Gérard** (the kebab shop is now "CHEZ GÉRARD"), and Ines becomes **Lou**
  (16, the former tagger). Both keep their voices; only the lines and signs that say their names change.
- **Items:** a pocket inventory with tools, clues and gifts. Items are used on hotspots, given to
  people, and pinned on an evidence board.
- **Eight new minigames, mostly mouse-driven:** photo evidence, the puncture hunt, the key ring, the
  deduction board, the stakeout, the stencil trace, croissant folding and the kebab wrap. The WASD and
  A/D games stay, so the new ones add variety rather than replacing them.

## New and renamed cast
- **Josianne "Jo" Lavoie, 34.** From Hochelaga, Montréal. Her shop is **ENCRE FINE**, in the empty unit
  across from the closed bike shop.
  - **Look:** both forearms sleeved in fine-line black work (a swallow, a fern, a measuring tape around
    one wrist, small dates). Black jacket, rings, a pencil behind her ear. Tint: oxblood `#6b2430`.
  - **Manner:** loud, blunt, flirts openly, swears in Québécois church words ("câline", "tabarnouche"),
    and is the kindest person on the street. She brings soup to Odile, stands up for Sami, and lends
    her good brushes.
  - **Her view of Hugo:**
    - His 212.4 km doesn't impress her at all: *"Deux cent douze? Ok. Pis? Tu sais faire quoi d'autre?"*
    - What gets her is a 37-year-old learning something new: *"Un gars qui apprend de quoi à 37 ans?
      C'est rare. C'est hot."*
  - **Every tattoo is something she learned:** a whisk is the year she learned to make her grandmother's
    tourtière, a gear is a manual car, a tiny ruler is the first stencil she didn't redo. She is
    Odile's notebook, written on skin.
  - **Her want:** to stop being the new person on the street. She treats everyone like family to get
    there faster.
  - **Speech:** in French, light Québécois markers with no caricature: « pantoute », « c'est le fun »,
    « t'sais », « bin là », « tiguidou », « mon chum », « chu ». In English she speaks English with the
    odd French word left in ("It's the fun." "Câline.").
- **Mr Albert Durand, 81.** Owner of CYCLES DURAND for 52 years. He gave Sami the bike: "find a wheel
  man". He is the Night Fixer (see the mystery). Tint: brown cardigan `#6e5a44`.
- **Gérard (renamed from Marco), 50s.** Runs CHEZ GÉRARD. He is very proud of his kebab and lives on
  four hours of sleep.
- **Lou (renamed from Ines), 16.** The former tagger, deadpan, phone always out. She's the one who takes
  the photo at the wall.
- Odile, Sami, Bastien, Mme Benali, Dr Okafor, STRIDE and the TV and radio voices are unchanged.

## The mystery: "the Night Fixer"
- **Hook (end of Day 8):** the pegboard has a new empty outline. Odile's spoke key is gone.
  - **Odile:** "Somebody's borrowed my spoke key. Nobody borrows from me. People are frightened of me.
    I've worked hard at it."
- **Escalation (Weeks 2–6):** every morning something on the street has been fixed overnight:
  - Mme Benali's shutter, which screamed for eleven years, is oiled.
  - The wet bench from Ch2 has three new slats.
  - The fallen "CYCLES DURAND — CLOSED" card is pinned back up, straight.
  - Gérard's flickering neon is rewired. **Gérard** is outraged: "It flickered *on purpose*. It was
    ambience."
  - The borrowed tool always comes back cleaned and oiled, smelling of chain lube.
- **Odile's first suspect is Hugo:** "You're up at four. You've got a boot that makes you sound like a
  filing cabinet falling downstairs. And you've got the look of a man who fixes things to avoid
  feelings." Hugo: "...Two out of three."
- **The case file:** the notebook gets a second tab, « L'AFFAIRE » / "THE CASE". Clues go there as items.
- **Suspects (each with a funny alibi to check):**
  - **Sami** wants tools. Alibi: his mother.
  - **Lou** has paint on her hands and is out at night. Alibi: a 3 a.m. photo she posted, timestamped.
  - **Gérard** is open until 2 a.m. Alibi: forty-one kebab receipts, which he reads out in order.
  - **Mme Benali** is up at 4. Alibi: she was making croissants, and she will make you help.
  - **Bastien** runs at 5. Alibi: his STRIDE data proves he was running, as it always does.
  - **Jo** works late and has fine brushes. Alibi: a client's fresh tattoo, timestamped and still red.
- **Hugo's detective tools are his old life, repurposed:**
  - The STRIDE app's public "segment" for Rue des Tanneurs. The record is held by user **D.52**, at
    **1.8 km/h, 03:12**. "Somebody's been walking this street at 3 a.m. at the pace of a tired fridge.
    Every night. That's a training plan."
  - Splits: the fixes happen in a fixed order, so it's a loop.
  - Measuring twice: the new slats are cut to 52 cm, the bike shop's standard.
  - Listening for the rub: the culprit's bicycle clicks once per turn, a worn freewheel pawl. Hugo
    knows the sound.
- **Reveal (Week 9, a night stakeout):** it's Mr Durand. He closed after 52 years, can't sleep and
  can't stop. He walks a loop fixing things at night because there is no shop any more to be good
  at, and he keeps a stopwatch on every repair. **He is Hugo with forty more years of never resting.**
  - **Durand:** "Fifty-two years I opened at eight. Now I open at three, for nobody. It's the same
    hours. It's just dark."
  - The spoke key was his to start with: he made it for Odile's father in 1971.
- **Resolution:** Hugo doesn't turn him in. He offers him a daytime job: teaching Sami. The shop card
  becomes "PUNCTURES FIXED — ASK AT No. 14 (or Mr Durand, before 9 p.m.)". Durand's arc pays off on
  the ending card: he learned to sleep in.
- **Fair play:** every clue is shown before the deduction board. Wrong accusations get funny scenes,
  not a game over. The board can't soft-lock: after two wrong tries Odile points.

## Chapter plan (boot calendar)
| # | Title | When | Where | New in R4 | Approx. time |
|---|---|---|---|---|---|
| 1 | No Impact | Day 4, night | flat | Items intro (keys, phone, watch go in the pocket). Seed: a 3 a.m. creak on the stairs. | 3 min |
| 2 | Never Stop | Day 4, evening | street | Jo cameo (ENCRE FINE). Seed: Benali's shutter screams. | 4 min |
| 3 | The Long Run | flashback | road | unchanged | 3 min |
| 4 | Measure Twice | Day 5, Day 8 | workshop | Sandpaper and tape are items. **Hook:** the spoke key is missing. | 5 min |
| 5 | **Who Oiled the Shutter?** | Weeks 2, 3, 4 | street by day + workshop | Investigation hub, interviews, photo evidence, the puncture hunt, croissant folding; Week 4 truing (existing); Jo beat 1 | 9–11 min |
| 6 | **Night Shift** | Weeks 6, 7, 9 | flat + workshop + street at night | Kebab wrap (Gérard's alibi), key ring, lettering (Week 7, existing), Jo beat 2 (stencil date), deduction board, **stakeout and reveal** | 9–11 min |
| 7 | The Wall | Week 12 | street, day to golden hour | Existing Ch5, plus Durand and Jo's panels, the jobs, Jo beat 3, new ending cards | 6–8 min |

- **Chapter 5 detail:**
  - **Week 2:** the shutter is oiled and the case opens.
  - **Week 3:** interviews, then the STRIDE segment clue.
  - **Week 4:** Sami's wheel. Jo walks in on the truing and gets her first look at Hugo learning,
    which is the first romance beat.
- **Chapter 6 detail:**
  - **Week 6:** Gérard's alibi (the kebab wrap) and the bike shop key ring (Jo has the spare key: the
    landlord owns both units).
  - **Week 7:** the OPEN sign (the existing lettering). Jo watches, then asks him to trace her stencil:
    the date.
  - **Week 9:** the deduction board at Hugo's flat, then the stakeout from the bench with Jo and a
    thermos.
- **Calendar check:** the watch's `RUN · THIS WEEK 0.0` stays true. A new STRIDE "segment" screen
  shows other people's data, never Hugo's.

## Romance arc (Jo)
It's a side thread, but the story carries it. It is never gated behind getting things right, and
choices only change the tone.
1. **Ch2 cameo.** Jo is on a ladder, hanging her sign crooked. "Hey, le grand avec la botte! Is it
   straight?" Two choices: [It's crooked.] / [It's perfect.] She says the opposite of whatever he
   picks, then fixes it herself. One line: "Belle botte. Très mode."
2. **Ch5 Week 4, during the truing.** She comes in to borrow Odile's liner brush and stays to watch.
   - **Jo:** "Wait, you're fixing his wheel by *listening* to it? Okay. That's hot."
   - Hugo, flustered: "...It's a spoke key."
   - **Jo:** "I know what it is. I'm saying it's hot."
   - Odile, without looking up: "Brush is on the left. Door's on the right."
3. **Ch5 interview.** She's a suspect. She pulls up a sleeve to show a client photo as her alibi, and
   the player learns about her tattoos. Every one is something she learned.
4. **Ch6 Week 7, the stencil date.** After the OPEN sign she shows him how she traces a stencil
   (minigame: STENCIL). He's bad at it. She's delighted.
   - **Jo:** "Ben là. Your line goes like a guy who's thinking about his line."
   - Notebook +**"Trace a fine line (badly)."**
5. **Ch6 Week 9, the stakeout.** Two people on a bench at 3 a.m. with soup.
   - She reads his notebook: "*Mix a grey that isn't sad.* Câline, t'es cute."
   - He asks why she doesn't care about the kilometres.
   - **Jo:** "Anyone can do more of the same thing. You're doing *new* things. With a boot on.
     That's the sexiest thing on this street, and the street has Gérard."
6. **Ch7 the wall.** Her panel is a fine-line swallow, the smallest panel on the wall and the
   cleanest. After his line:
   - **Jo:** "You owe me a supper. Can you cook?"
   - **Hugo:** "No."
   - **Jo:** "Ben, you'll learn."
   - Notebook +**"Cook (learning)."**
- **Hidden warmth score (0–5)** from small choices (earnest or joking, giving her the croissant, staying
  for the stencil). It only changes lines: her last line and one ending card.
- **Ending card (warm):** "Jo tattooed one line on Hugo's left shin, right over the crack. Thinner
  than a hair. All the way across."
- **Ending card (cooler):** "Hugo still owes Jo a supper. He's on his fourth attempt at the sauce."
- **Tone guard:** flirtation, warmth and a kiss on the cheek at most. Nothing explicit. She's never
  mocked for her accent; the comedy comes from her confidence, not from her being Québécoise.

## Items system
- **Pocket:** up to 12 items, shown as a strip along the bottom-left that opens with **Tab** (or
  clicking the pocket icon). Items have small painted icons in the notebook's hand-drawn style.
- **Three kinds:**
  - **Tools** (used on hotspots): sandpaper, tape measure, spoke key, chalk, liner brush, oil can,
    bike-shop key ring, phone camera, thermos, pencil.
  - **Clues** (go into THE CASE tab): the oiled-hinge photo, the 52 cm slat, a sawdust footprint photo,
    the D.52 segment screenshot, a cleaned spoke key, Gérard's receipts, a Bleu Durand paint chip,
    the clicking-freewheel note.
  - **Gifts** (given to people for extra lines and warmth): croissant, kebab, a bag of chain-lube
    rags, Jo's soup.
- **Using an item:** select it, then E on a hotspot ("Use oil can on the shutter"). Hotspots that
  need an item say so: *"It needs a spoke key. I know exactly what one looks like. I can't find one."*
- **Wrong item:** a funny refusal line per character or object. Lines are written per item class, plus
  a generic fallback, so the count stays bounded (about 40 lines).
- **Saving:** the inventory is saved in localStorage with the chapter save, and resets per chapter
  like the story flags.

## New minigames (mouse first)
| Name | Where | Input | Fail state |
|---|---|---|---|
| **PHOTO** | Ch5, clue photos | Mouse to aim the phone, wheel to zoom, click to shoot. Scored on framing (the clue in the inner box, in focus after a short half-press). | none: three tries, then auto-frame |
| **PUNCTURE** | Ch5, Sami's tube | Drag the inner tube through a water bucket; bubbles show where the hole is; click the hole and patch it. | none: bubbles get bigger over time |
| **CROISSANT** | Ch5, Benali's alibi | Mouse gestures: roll (drag a curve), fold (drag down), with timing. Benali grades each one ("That's a moon again.") | none |
| **KEBAB WRAP** | Ch6, Gérard's alibi | Drag the fillings in the order Gérard calls them (fast, comedic), then fold. | none: Gérard does it, annoyed |
| **KEY RING** | Ch6, the bike shop | Rotate a ring of 14 keys with the mouse, match the bit's shape to the lock's silhouette, then turn it. | none: after 3 wrong keys, Jo points |
| **STENCIL** | Ch6, Jo's date | Trace a fine-line stencil (a swallow) with the mouse at a steady speed. Slow is wobbly, fast skips. | none |
| **DEDUCTION** | Ch6, Hugo's flat | Corkboard: drag clue cards onto suspects; red string draws between them; a "case" closes when each question has its clue (Who walks at 3? Who cuts at 52? Who clicks?). | none: after 2 wrong tries Odile phones in a hint |
| **STAKEOUT** | Ch6, the street at 3 a.m. | Mouse look from the bench: keep the shadow in view without the streetlight catching you. Hold right-click to hold your breath when he looks round (pain-meter style), and release when he turns away. | none: if he's lost, he walks the loop again |

- The existing games stay: hold still, A/D rhythm, sanding, tape, mixing (1–5), truing (Space),
  lettering (WASD), the line (W/S), radio and the street jobs.
- **Variety rule:** no two consecutive minigames use the same input.
- **Accessibility:** each new game has an idle assist and a skip under `?debug=1`, like the existing ones.

## Humour: keep the house style
- Dry and specific. Comedy comes from character, never from mockery of the injury, the accent or
  anyone's job. Every chapter needs at least four laugh lines.
- **Running jokes to add:**
  - Gérard's neon "ambience".
  - Benali's croissants that come out as moons.
  - Odile's radio fishing man (he now has opinions on the case).
  - STRIDE congratulating the wrong things ("STAKEOUT DETECTED? Great 3 a.m. session!").
  - Bastien explaining that his data clears him, at length.

## Voices (French, Kyutai TTS, generated on auriga)
- **New voices:**
  - **Jo:** a Quebec accent if the model can do one. The 140 CML-TTS French voices aren't labelled
    by accent, so the plan is to screen them with a French-accent classifier (Canadian French is one
    of its classes), keep the best three for the user to audition, and fall back to a standard-accent
    voice with her Québécois vocabulary if none works.
  - **Durand:** an old man's voice, slower.
- **Renamed characters:** Gérard and Lou keep Marco's and Ines's voices. Only the lines that say their
  names, plus anything that changes, are regenerated.
- **Size:** an estimated 350–450 new lines (the game has 301 today).
- **Pipeline:** the existing incremental pipeline (`scripts/voice/`) with `--remote auriga`, the
  4-semitone pitch check on auriga takes, Whisper CER QA, and the listening page rebuilt for the user.

## Art and sound
- **Jo's tattoos:** canvas-texture decals on the forearm and hand meshes of a Quaternius body (fine
  black linework, generated procedurally). Rings are small torus meshes.
- **Durand:** an older body, cardigan tint, flat cap.
- **New sets:**
  - the ENCRE FINE shopfront (lit interior seen through the glass, flash sheets on the wall)
  - Hugo's flat corkboard
  - the street at 3 a.m. (lamps, wet ground, one lit window)
  - a water bucket
  - the kebab counter
  - the bike shop interior, dusty, with outlines of missing bikes on the wall
- **SFX** from the existing library plus new sets: phone shutter, inner-tube bubbles, keys on a ring,
  tattoo-machine buzz in the background, kebab spit sizzle, croissant dough slaps, a clicking freewheel
  (the clue sound).

## Risks and open points
- **Length:** about 40 minutes of content is roughly 2.5 times the current game. The time estimates are
  for a player who does the optional bits.
- **Jo's accent:** the model may not have a usable Quebec voice. The user decides after the audition.
- **Characters:** the Quaternius bodies still look a bit fantasy; tattoos will help Jo read.
- **Performance:** two new night scenes reuse the street, so there is no new big asset load.

## Script decisions (docs/SCRIPT-R4.md, 2026-10-08)
The script refines this plan. Where they differ, the script wins:
- **Ch1 seed:** a window hotspot recalls a bike clicking past at 3 a.m. (the clue sound), instead of a creak on
  the stairs. Ch3 gets a wordless seed: Durand pushes his clicking bike past in Week 31, and Hugo doesn't look.
- **Numbers:** Gérard has 43 receipts (41 is already Ch2's "forty-one minutes"), Mme Benali's shutter has
  screamed for 13 years (11 is the crack), and the slipper print is a size 44.
- **Items:** clues live in the case tab, not the pocket. Required items auto-select on E. The oil can and
  liner brush are dropped; the rags are a gift and the thermos holds Jo's soup. The case tab is the back of
  the exercise book.
- **Fair play:** Durand appears in Ch5 Week 3 (asleep on the repaired bench, "the old man") and is named by a
  1974 photo in the bike shop in Ch6 Week 6.
- **Odile knew**, from the Bleu Durand paint she mixed in 1979, and let Hugo investigate (revealed in Ch7).
- **The reveal:** STRIDE offers to send D.52 a kudos mid-stakeout; either choice sends it, and Durand's watch
  buzzes.
- **Week 3 is a Saturday.** Weeks 5, 8 and 10–11 get a card and one line, so every week has a beat.
- **Ending:** 9 cards (Durand, plus Jo warm or cool). Warmth is five flags; warm is 3 or more.
- **Notebook:** the final list « CE QUE JE SAIS FAIRE » has **15 lines** (« Rouler un croissant. »,
  « Mener une enquête. », no photo line), not the draft's 16.
- **Length as scripted:** the editor applied cut list A (Bastien's counts, Jo's wrist lines, STENCIL at 6 s,
  KEBAB at two orders, three croissants; Ch5 Week 2 starts in the workshop and Ch6's morning neon scene is
  merged into the 1 h counter). The script estimates ~35½ min main / ~42½ all by its 2.5 s rule, about 31–35
  calibrated. Cut list B (SCRIPT-R4 §14) is ready but not applied.
- **Length as built (playtests, 2026-10-09):** Ch1–4 main ~12 min; Ch5 ~16, Ch6 ~16½, Ch7 ~8 with lines read to
  the end of their clips: about **52 min** main for a player who reads every line to the end (less for one who
  clicks through). Ch5 and Ch6 run about twice the script's estimate; cut list B is the first lever if the user finds
  them long.
