# HAIRLINE: French voice-over

Status: **all 301 French clips generated and audited** (2026-10-07, Kyutai TTS 1.6B en_fr; see
[10. Model](#10-model), [11. Cast](#11-cast) and [12. QA audit](#12-qa-audit-2026-10-07)), and **wired into
the game** (`src/core/Voice.js`, see [8. Runtime](#8-runtime-as-built) and `docs/API.md` §4.4 ("French voices")). This page
holds the rules, the key function, the file and manifest formats, the classification table, the runtime,
and the model and cast.

| File | What it is |
|---|---|
| `scripts/voice/voiceKey.mjs` | `normalize(text)` and `voiceKey(text)`. Pure ES module; the runtime (`src/core/Voice.js`) imports this file directly (one implementation). |
| `scripts/voice/extract-lines.mjs` | Walks the text tree, classifies every leaf, writes the inventory. |
| `scripts/voice/lines.fr.json` | The inventory: one entry per clip to generate (text, TTS text, speaker, delivery, context). |
| `public/assets/voice/fr/<key>[-<speaker>].ogg` | The clips (generator output, gitignored). |
| `public/assets/voice/fr/manifest.json` | What the runtime loads (format below). |
| `scripts/voice/cast.json` | Model settings, QA thresholds, one Kyutai voice per speaker, delivery chains. |
| `scripts/voice/generate.py` | The incremental generator (generation, ASR QA, retakes, post, Opus, manifest). |
| `scripts/voice/kyutai_worker.py` | Persistent batched Kyutai worker on MLX (the Mac). |
| `scripts/voice/qa.py` | Whisper CER, pacing, cut-off, F0 and ECAPA helpers. |
| `scripts/voice/pronunciation.json` | Pronunciation override map: word rewrites for every TTS text, full TTS text per key. |
| `scripts/voice/audit.py` | Independent QA of the final `.ogg` files (ASR, loudness, edges, speaker, machine consistency). |
| `scripts/voice/remote/` | The auriga (ROCm) remote worker, set up separately; see its README. |

```sh
node scripts/voice/extract-lines.mjs             # rewrite lines.fr.json, print counts
node scripts/voice/extract-lines.mjs --check     # CI-style: exit 1 on any unclassified leaf
node scripts/voice/extract-lines.mjs --list      # print every voiced line with its TTS text
node scripts/voice/extract-lines.mjs --selftest  # FNV vectors, normalize(), French number reading
```

Re-run it after any text change. A new key that no rule covers is printed as `ERROR UNCLASSIFIED <path>`,
so text can never be skipped silently. Imports are retried in a fresh Node process (up to 5 retries, about
20 s) when a text file is mid-edit.

## 1. What is voiced

French only. Clips play only when the language is `fr` and the **Voices** option is on (default ON).

**Voiced**
- Every spoken dialogue line with a speaker: Hugo, Odile, Sami, Bastien, Ines, Marco, Mme Benali, Dr Okafor
  (Ch3 flashback), the doctor's receptionist (Ch1 voicemail) and the TV commentator (Ch1).
- Correction-menu **replies** (`d.correct`): the character says them.
- Non-blocking barks (`ui.thought(text, secs, {who})`): Odile on the scaffold and at the sander, Sami while
  truing, Mme Benali, Marco and Sami's approach barks, the mixer's "full" bark, and so on.
- Hugo's inner monologue: `think()` lines, `d.think`, `d.thought` / `ui.thought` without `who`, the stumble
  lines, the STRIDE-menu replies and the Ch5 walk thoughts.
- The Ch5 radio voices (fishing, football, forecast), with a `radio` delivery. The `music` station is a
  stage direction and is not voiced.

**Not voiced:** stage directions (`*...*` with no speaker), cards (opening, chapter cards "Jour 5." and so
on, "Dimanche."), chapter titles, objectives, prompts, hints, signs, captions, UI, watch faces and buzzes,
STRIDE notifications (`ui.watchBuzz` and the STRIDE menu prompts), notebook entries, ending cards, phone
**text messages** (Maman, Bastien) and the phone screen ("12 messages non lus."), menu prompts and the option
labels the player picks.

**Judgement calls (each is one rule in the table, easy to flip)**
- `ch3.crack` is shown as a clear italic **card**, but it is Hugo's first-person memory of the moment the
  bone goes ("Ce n'était pas fort..."). It is voiced as `inner` (flag `card-rendered`). To drop it, set the
  rule to `{kind: 'none', why: 'card'}`.
- **Maman** has no spoken line: her only line is an SMS. The speaker is defined, but nothing is generated.
- **Radio** gets its own delivery (`radio`), because the six requested deliveries had no "old valve radio
  in a workshop". It is a narrower `tv`. `stations.fishing` is never captioned today (it is found quietly
  at the start). Its clip can still be the radio's voice bed instead of the procedural `radioVoice` babble.
- `ch4.day8.mixer.hints` is used as a bark (`ui.thought`) **and** inside a `d.say` after a verdict. It gets
  one clip, `spoken`, flagged `also-bark`.
- Lines with `*emphasis*` (for example "Je *sais*.", "qu'on me *tend* la peinture") are voiced. The emphasis
  goes into `context` as "Stress: ...".

## 2. The key function (`scripts/voice/voiceKey.mjs`)

```
normalize(text):
  NFC; strip HTML tags; drop every '*' (emphasis/stage markers; the words stay);
  ’ ‘ ʼ ´ ` ′ -> '   « » “ ” „ ‟ ″ -> "   (no space kept inside « »)   ... -> …
  all whitespace incl. U+00A0 / U+202F -> one space; no space before ? ! : ;   trim
voiceKey(text) = first 12 hex chars of FNV-1a 64 (BigInt; offset 0xcbf29ce484222325, prime 0x100000001b3)
                 over the UTF-8 bytes (TextEncoder) of normalize(text)
```

- Keys depend on the **text only**. When the same text is spoken by more than one speaker, the manifest
  entry holds `variants` keyed by the displayed French `who` label. Today this happens once: "Oui." is said
  by Hugo (inner, Ch3) and by Odile (Ch4).
- For inner lines, the variant label is `L.names.hugo` ("Hugo"). `d.think` sets it; for a `ui.thought`
  without `who`, the runtime passes it.
- The key changes when the typography of a line changes (wording, punctuation, accents), but not when only
  apostrophe style, guillemet spacing or no-break spaces change. A changed line simply has no clip until the
  generator runs again. The game stays silent for that line and never plays the wrong one.
- 48 bits over about 300 lines: the chance of a collision is negligible, and the extractor fails loudly if
  one ever happens.
- Test vectors (`--selftest`): `fnv1a64('') = cbf29ce484222325`, `fnv1a64('a') = af63dc4c8601ec8c`,
  `voiceKey('Non.') = 669b51c6d2da`.

## 3. Clip files and manifest

**Clips:** `public/assets/voice/fr/<key>.ogg`, or `<key>-<speaker>.ogg` for a variant. Each clip is Ogg Opus,
mono, 48 kHz, 40-56 kbps. Loudness is integrated: -19 LUFS for spoken, bark, tv and flashback; -23 for
inner; -21 for voicemail and radio. True peak is at most -1.5 dBTP. Head and tail silence is at most 120 ms.
The delivery processing is baked into the file.

**`public/assets/voice/fr/manifest.json`** (written by the generator, read by the runtime):

```jsonc
{
  "version": 1,
  "model": "<tts model id + voice ids>",
  "generatedAt": "2026-10-07T...Z",
  "lines": {
    "d84525bbed03": { "file": "d84525bbed03.ogg", "dur": 14.82, "speaker": "receptionist",
                      "delivery": "voicemail", "text": "Monsieur Revel, ici le cabinet..." },
    "065abbc053c9": { "variants": {
      "Hugo":  { "file": "065abbc053c9-hugo.ogg",  "dur": 0.61, "speaker": "hugo",  "delivery": "inner",  "text": "Oui." },
      "Odile": { "file": "065abbc053c9-odile.ogg", "dur": 0.55, "speaker": "odile", "delivery": "spoken", "text": "Oui." } } }
  }
}
```

`dur` is in seconds and includes the edge silence. `file` is relative to the manifest. The generator should
add only lines whose clip passed QC; a missing key just means "no voice".

**`scripts/voice/lines.fr.json`** (the generator's input) has these fields:
- top level: `version`, `keyVersion`, `generatedAt`, `audio` (the targets above), `speakers` (casting brief
  per speaker), `deliveries`, `summary` (counts), `lines[]`, `dynamic[]`, `runtimeComposed[]` and
  `unvoiced[]` (`{path, why, text}`, for review);
- each `lines[]` entry: `key`, `file`, `variant` (null, or the who label), `speaker`, `who`, `delivery`, `lufs`,
  `text` (as displayed), `normalized`, `tts`, `en`, `context`, `scene`, `to`, `mood`, `path`, `uses[]`
  (`{path, use}`, one per occurrence, deduplicated) and `flags[]`.

## 4. TTS text (`tts`)

`frTTS()` in `extract-lines.mjs` does the following:
- Removes `*` markup, `« »` and curly quotes, and collapses `!!` to `!`. It keeps `…` and `—` as pause cues.
- Abbreviations: `M.` becomes Monsieur, `Mme` Madame, `Mlle` Mademoiselle, `Dr` Docteur, `N° 14` numéro
  quatorze, and `H.R.` "H. R.".
- Numbers in words, traditional spelling: soixante et onze, quatre-vingts, deux cents, quatre-vingt mille.
- Decimals with "virgule": `212,4 km` becomes deux cent douze virgule quatre kilomètres, and `0,05` becomes
  zéro virgule zéro cinq.
- Units: km, m, cm, kg, %, €, min, h and s. The unit is singular below 2, and the number is feminine where
  needed: une heure, cinquante et une secondes.
- Times: `5 H 12` becomes cinq heures douze; `3 h 12 min` trois heures douze minutes; `3:04:51` heures,
  minutes, secondes; `38:40` minutes and seconds.
- Ordinals: 1er, 1re, 2e, 21e.
- Words, from `scripts/voice/pronunciation.json` → `words`: STRIDE becomes "Straïde", OPEN "opène",
  "O, P, E, N" "O, pé, eu, enne", Ines "Inès" (the pronunciation; the display keeps Ines) and zhhh "zzzh".
- Other ALL-CAPS words are read as words, not spelled (HUGO becomes Hugo).

The current French text already writes almost every number out in words. These rules are a safety net
for new text. Read `--list` after text changes. When the model mispronounces a word, add an entry to
`pronunciation.json` → `words` (regex source, flags, replacement, why); for one clip, put its full TTS text
under `lines` → `<key>` (wins over `cast.json` → `ttsOverride`). Either changes the line's generation hash,
so the next incremental run regenerates exactly the affected clips. `checkedOk` records the names and
numbers checked in the audit and what Whisper heard.

`context` is short English direction made from the `CONTEXT` table (longest key-path prefix):
`<speaker> -> <listener>. <scene>. Emotion: <mood>. [Inner monologue.] [Stress: "..."]`. Use it as an
instruct or style prompt, or to choose between takes.

## 5. Dynamic lines

**None among the voiced lines.** No voiced text contains a `{Key}` token or is assembled at runtime. The
runtime-composed strings in the code are all UI: the chapter number, the objective distance, the cadence
gauge text and the watch faces and laps (`runtimeComposed[]` in the JSON).

Some lines are **chosen** at runtime but are fixed text, so they are pre-generated. They are flagged
`selected-at-runtime`:
- the tape readings and the cut lines (`ch4.day8.tape.*`);
- the mixer verdicts;
- the lettering, board and line tiers;
- the panel replies (`ch5.panel.after.*`).

## 6. Speakers, deliveries and counts

Counts from the run of 2026-10-07 (after the QA pass): **301 clips**, made of 300 keys plus one variant
("Oui."), covering 304 line occurrences (identical lines are deduplicated); 17 minutes of audio.

| Speaker id | who label (FR) | Casting brief | Clips | Deliveries | Sample line |
|---|---|---|---|---|---|
| `hugo` | Hugo | 37, male. Low-mid baritone, tired, dry, laconic. Inner monologue: softer and closer. | 140 | inner 86, spoken 53, bark 1 | "Trente-huit dossards. Je les ai tous gardés." · "Fracture de fatigue." |
| `odile` | Odile | 74, female. Gravelly and thin, terse, brusque, warm underneath. | 103 | spoken 93, bark 10 | "Vous. Avec la botte." · "Ça, c'est pas un gris. C'est une salle d'attente." |
| `sami` | Sami | 11, a real boy's voice. Cheeky, literal. If the model has no child voice: the youngest high voice with a formant-preserving pitch shift, never chipmunk. | 29 | spoken 13, bark 16 | "Pourquoi t'as une chaussure de ski ?" · "Odile, il le tape !" |
| `bastien` | Bastien | 40s, male. Hearty, loud, run-club captain, a little out of breath. | 7 | spoken 7 | "Hugo ! Mon pote ! Et cette jambe ?" |
| `marco` | Marco | 40s-50s, male. Warm, proud, a little theatrical. | 6 | spoken 5, bark 1 | "C'est un *excellent* kebab." |
| `benali` | Mme Benali | 50s-60s, female. Warm, chatty. | 5 | spoken 2, bark 3 | "Je voulais peindre un croissant. Ça a donné un croissant de lune..." |
| `ines` | Ines | 16, female. Deadpan teen. | 4 | spoken 4 | "Bizarre. Légal." |
| `okafor` | Dr Okafor | Adult, **male** ("Il l'a appelée...", Ch1). Calm, clinical, kind. | 2 | flashback 2 | "Le trait est plus fin qu'un cheveu, monsieur Revel. Mais il va jusqu'au bout." |
| `receptionist` | Dr Okafor (cabinet) | Adult, female (chosen for contrast with the doctor). Polite, reads a reminder aloud. | 1 | voicemail 1 | "Monsieur Revel, ici le cabinet du docteur Okafor..." |
| `tv` | TV | Male cycling-broadcast commentator. | 1 | tv 1 | "...et voilà, le travail des équipiers est fait..." |
| `radio_fishing` | Radio | Older man, slow and rambling (the fishing show). | 1 | radio 1 | "...et le brochet, voyez-vous, le brochet se moque bien de vos états d'âme..." |
| `radio_football` | Radio | Fast, excited football commentator, distinct from the TV voice. | 1 | radio 1 | "...deux à zéro, et personne ici n'arrive vraiment à y croire..." |
| `radio_forecast` | Radio | Female forecast reader, even and formal. | 1 | radio 1 | "...Pas-de-Calais, ouest quatre à cinq, pluie ensuite, visibilité bonne..." |
| `maman` | Maman | 60s, warm, worried. **No spoken line** (SMS only). | 0 | none | none |

| Delivery | Clips | LUFS | Processing (baked into the file) |
|---|---|---|---|
| spoken | 177 | -19 | Dry and close, natural; very light room tone. |
| inner | 86 | -23 | Hugo's voice, softer and more intimate, slightly closer and quieter; a touch of low-pass and a short room so it reads as thought. |
| bark | 31 | -19 | Spoken, can be a bit more projected (called across a room or street). |
| radio | 3 | -21 | Old valve radio: band-pass ~300-3400 Hz (matching the game's `radioVoice`), mild compression and hiss. |
| flashback | 2 | -19 | Slightly distant and roomy (a memory over black). |
| voicemail | 1 | -21 | Telephone band-pass 300-3400 Hz, light compression, a little codec grit. |
| tv | 1 | -19 | Broadcast EQ, slight compression. |

**Not voiced:** 708 leaves. 285 of them are line metadata (`who`, `inner`, `voicemail`). The rest:
- by kind: UI 75, sign 46, watch 45, notebook 38, prompt 37, end card 29, data 30, stage 21, menu label 25,
  objective 17, card 13, hint 12, speaker label 9, title 5;
- messages and prompts: SMS 4, notification 8, menu prompt 5, caption 4.

These counts are regenerated in `lines.fr.json` → `summary` on every run.

**Distinct voices (acceptance check for the generation step).** For every pair of speakers, measure the
cosine similarity of speaker embeddings (for example ECAPA-TDNN / SpeechBrain, or Resemblyzer) over 3-5
clips each. Require each speaker's mean similarity to every other speaker to be clearly below the
same-speaker similarity, aiming for < 0.75 between speakers. Also log median F0 per speaker. Pairs to watch:
- Hugo / Marco / Bastien / Okafor (four adult men): separate them by F0, energy and tempo;
- Odile / Mme Benali / the forecast voice;
- TV / football radio;
- Sami / Ines.

## 7. Classification table

The authoritative table is `RULES` in `scripts/voice/extract-lines.mjs`. Patterns are dot paths on the
English-shaped tree (`*` = one segment, `**` = any depth), and the first match claims the whole subtree.
The call sites are the ones read from `src/story/ch1..ch5.js`, `ch4crafts.js`, `ch5jobs.js`,
`ch5panel.js`, `crafts/{tape,mixer,truing,radio}.js`, `Director.js`, `UI.js` and `Player.js`
(2026-10-07). The kinds:

- `say`: `d.say` line arrays. Speaker = `who`. `inner` means Hugo/inner, `voicemail` means voicemail, and
  stage lines are skipped.
- `think`: Hugo's plain-string thoughts, read as inner.
- `bark`: `ui.thought(..., {who})`.
- `menu`: `d.correct`. Only the replies are voiced.
- `choose`: `d.choose`. Only the replies are voiced, as Hugo's inner thoughts.
- `none`: not voiced.

<details><summary>Full table (203 rules)</summary>

| Key path | Kind | Voiced | Delivery | Speaker / reason | Call site (as read) |
|---|---|---|---|---|---|
| `names.**` | none | no |  | speaker labels |  |
| `title.**` | none | no |  | ui |  |
| `keyNames.**` | none | no |  | ui |  |
| `loading` | none | no |  | ui |  |
| `noWebGL` | none | no |  | ui |  |
| `contextLost` | none | no |  | ui |  |
| `reload` | none | no |  | ui |  |
| `mobile.**` | none | no |  | ui |  |
| `pause.**` | none | no |  | ui |  |
| `options.**` | none | no |  | ui |  |
| `ui.**` | none | no |  | ui |  |
| `opening.**` | none | no |  | card | main.js director.card(L.opening) |
| `stumble.first` | think | yes | inner | Hugo | Player.stumble -> ui.thought(line) |
| `stumble.bag` | think | yes | inner | Hugo | Player.stumble -> ui.thought(line), shuffled bag |
| `hints.**` | none | no |  | hint |  |
| `watch.**` | none | no |  | watch |  |
| `notebook.**` | none | no |  | notebook |  |
| `ending.**` | none | no |  | endcard |  |
| `ch1.title` | none | no |  | title |  |
| `ch1.objectives.**` | none | no |  | objective |  |
| `ch1.prompts.**` | none | no |  | prompt |  |
| `ch1.signs.**` | none | no |  | sign |  |
| `ch1.tvTicker` | none | no |  | sign |  |
| `ch1.hammer` | think | yes | inner | Hugo | d.thought(L.ch1.hammer, 6.5) |
| `ch1.tv` | say | yes | tv | speaker = who | look('tv', L.ch1.tv) -> d.say |
| `ch1.tvOff` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.tvOff) |
| `ch1.phone` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who; SMS + notifications not voiced | d.say(L.ch1.phone) (read on the phone; the voicemail goes to his ear) |
| `ch1.watch` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.watch) |
| `ch1.watchHud.**` | none | no |  | watch |  |
| `ch1.watchAfter` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.watchAfter) |
| `ch1.buzz` | none | no |  | watch | ui.watchBuzz |
| `ch1.buzzReply` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.buzzReply) |
| `ch1.xray` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | look('xray') -> d.say |
| `ch1.bike` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | look('bike') -> d.say |
| `ch1.bibs` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | look('bibs') -> d.say |
| `ch1.bibCount` | none | no |  | data |  |
| `ch1.door` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.door) |
| `ch1.table` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch1.table) |
| `ch1.startBuzz` | none | no |  | watch |  |
| `ch1.walkFace` | none | no |  | watch |  |
| `ch1.walkLabel` | none | no |  | watch |  |
| `ch2.title` | none | no |  | title |  |
| `ch2.objectives.**` | none | no |  | objective |  |
| `ch2.prompts.**` | none | no |  | prompt |  |
| `ch2.signs.**` | none | no |  | sign |  |
| `ch2.lapStart` | none | no |  | watch |  |
| `ch2.lapEnd` | none | no |  | watch |  |
| `ch2.start` | think | yes | inner | Hugo | d.thought(T.start, 5.5) |
| `ch2.pauseBuzz` | none | no |  | watch |  |
| `ch2.pauseReply` | think | yes | inner | Hugo | d.thought(T.pauseReply, 1.6) |
| `ch2.ghost` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.ghost) |
| `ch2.ghostLinger` | think | yes | inner | Hugo | d.thought(T.ghostLinger, 5.5) |
| `ch2.billboard` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | look(..., T.billboard) -> d.say |
| `ch2.club` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch2.club) |
| `ch2.clubAfter` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(L.ch2.clubAfter) |
| `ch2.shop` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | look(..., T.shop) -> d.say |
| `ch2.bench` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.bench) |
| `ch2.arrivalLoop` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.arrivalLoop) |
| `ch2.arrival` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.arrival) |
| `ch2.hold.gauge` | none | no |  | ui |  |
| `ch2.hold.barks` | bark | yes | bark | speaker = who | holdStill: ui.thought(nextBark(), 2.4, {who}) |
| `ch2.hold.buzz` | none | no |  | watch |  |
| `ch2.hold.buzzReply` | think | yes | inner | Hugo | d.thought(H.buzzReply, 1.8) |
| `ch2.after` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.after) |
| `ch2.nameOne` | menu | replies | spoken | menu.who (prompt + labels not voiced) | d.correct(T.nameOne) |
| `ch2.leaving` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.leaving) |
| `ch2.howFarLap` | none | no |  | watch |  |
| `ch2.flare` | none | no |  | data |  |
| `ch3.title` | none | no |  | title |  |
| `ch3.signs.**` | none | no |  | sign |  |
| `ch3.objectives.**` | none | no |  | objective |  |
| `ch3.keys.**` | none | no |  | ui |  |
| `ch3.gauge.**` | none | no |  | ui |  |
| `ch3.cadence.*` | think | yes | inner | Hugo | cadence feedback(): ui.thought, non-blocking |
| `ch3.weekLabel` | none | no |  | watch |  |
| `ch3.weeks.*.caption` | none | no |  | caption |  |
| `ch3.weeks.*.length` | none | no |  | data |  |
| `ch3.weeks.*.total` | none | no |  | data |  |
| `ch3.weeks.*.thoughts.*` | think | yes | inner | Hugo | story(wk.thoughts[m]) at metre marks |
| `ch3.weeks.*.stride` | choose | replies | inner | Hugo (prompt + labels not voiced) | d.choose(wk.stride) then d.think(opt.reply) |
| `ch3.sunday` | none | no |  | card |  |
| `ch3.race.caption` | none | no |  | caption |  |
| `ch3.race.label` | none | no |  | watch |  |
| `ch3.race.faceStart` | none | no |  | data |  |
| `ch3.race.boards.**` | none | no |  | sign |  |
| `ch3.race.banners.**` | none | no |  | sign |  |
| `ch3.race.thoughts.*` | think | yes | inner | Hugo | story(T.race.thoughts.km30*) |
| `ch3.crack` | think | yes | inner | Hugo | d.card(T.crack, {bg:'clear', italic:true}) (card-rendered inner monologue) [card-rendered] |
| `ch3.keepGoing` | think | yes | inner | Hugo | story(T.keepGoing, 6.5) |
| `ch3.finish.**` | none | no |  | watch |  |
| `ch3.doctor` | say | yes | flashback | speaker = who | d.say(T.doctor) over black |
| `ch3.present` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.present) |
| `ch4.title` | none | no |  | title |  |
| `ch4.cards.**` | none | no |  | card |  |
| `ch4.objectives.**` | none | no |  | objective |  |
| `ch4.prompts.**` | none | no |  | prompt |  |
| `ch4.signs.**` | none | no |  | sign |  |
| `ch4.oldSigns` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.oldSigns) |
| `ch4.radio` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.radio) |
| `ch4.day5.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.day5.<beat>) |
| `ch4.sanding.gauge` | none | no |  | ui |  |
| `ch4.sanding.hint` | none | no |  | hint |  |
| `ch4.sanding.barks` | bark | yes | bark | speaker = who | ch4crafts: ui.thought(SD.barks.mash[i] \| SD.barks.cross, 2.4, {who}) |
| `ch4.sanding.buzz` | none | no |  | watch |  |
| `ch4.sanding.buzzReply` | think | yes | inner | Hugo | d.thought(SD.buzzReply, 2) |
| `ch4.day8.start` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.day8.start) |
| `ch4.day8.tape.hint` | none | no |  | hint |  |
| `ch4.day8.tape.readings` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | tape.js: d.say([text.readings[i]]) (i = measured value) [selected-at-runtime] |
| `ch4.day8.tape.again` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | tape.js: d.say([text.again[i]]) [selected-at-runtime] |
| `ch4.day8.tape.twice` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | tape.js: d.say(text.twice) |
| `ch4.day8.tape.differ` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | tape.js: d.say([line, ...text.help]) [selected-at-runtime] |
| `ch4.day8.tape.short` | bark | yes | bark | speaker = who | tape.js: ui.thought(text.short.text, 2.4, {who}) |
| `ch4.day8.tape.help` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | tape.js: d.say([line, ...text.help]) |
| `ch4.day8.tape.cut` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch4.js: d.say([T4.day8.tape.cut[readingIndex(m.agreed)]]) [selected-at-runtime] |
| `ch4.day8.grey` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.day8.grey) |
| `ch4.day8.mixer.intro` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: d.say(text.intro) |
| `ch4.day8.mixer.tins.**` | none | no |  | ui |  |
| `ch4.day8.mixer.hint` | none | no |  | hint |  |
| `ch4.day8.mixer.tip` | none | no |  | ui |  |
| `ch4.day8.mixer.done` | none | no |  | ui |  |
| `ch4.day8.mixer.full` | bark | yes | bark | speaker = who | mixer.js: ui.thought(text.full.text, 2.4, {who}) |
| `ch4.day8.mixer.verdicts.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: d.say([...text.verdicts[v], text.hints[n]?]) [selected-at-runtime] |
| `ch4.day8.mixer.hints` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: ui.thought(h.text, 5, {who}) AND appended to d.say(verdict lines) [also-bark] |
| `ch4.day8.mixer.warm` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: ui.thought(text.warm.text, 5, {who}) AND appended to d.say(verdict lines) [also-bark] (added 2026-10-07) |
| `ch4.day8.mixer.give` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: d.say(text.give) |
| `ch4.day8.greyLook` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | mixer.js: stage line after the "light" verdict |
| `ch4.day8.paintColor` | none | no |  | data |  |
| `ch4.day8.painted` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.day8.painted) |
| `ch4.week4.sami` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.sami) |
| `ch4.week4.bike` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.bike) |
| `ch4.week4.hold` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.hold) |
| `ch4.week4.truing.hint` | none | no |  | hint |  |
| `ch4.week4.truing.gauge` | none | no |  | ui |  |
| `ch4.week4.truing.pitch.**` | none | no |  | ui |  |
| `ch4.week4.truing.flat` | think | yes | inner | Hugo | truing.js: d.thought(text.flat, 3) |
| `ch4.week4.truing.barks` | bark | yes | bark | speaker = who | truing.js: ui.thought(barks[key], 2.4, {who}) |
| `ch4.week4.truing.assisted` | bark | yes | bark | speaker = who | truing.js: ui.thought(a.text, 2.6, {who}) |
| `ch4.week4.after` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.after) |
| `ch4.week4.laughStage` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say (stage only) |
| `ch4.week4.laugh` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.laugh) |
| `ch4.week4.wrap` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week4.wrap) |
| `ch4.week7.raceBike` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T4.week7.raceBike) |
| `ch4.week7.stage` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say (stage only) |
| `ch4.week7.intro` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(B7.intro.slice(0,5)), pause 0.9 s, d.say(B7.intro.slice(5)) |
| `ch4.week7.lettering.paint` | none | no |  | data |  |
| `ch4.week7.lettering.tiers.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(tiers[good\|middle\|poor]) [selected-at-runtime] |
| `ch4.week7.signMenu` | menu | replies | spoken | menu.who (prompt + labels not voiced) | d.correct(B7.signMenu) |
| `ch4.week7.signThink` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(B7.signThink) |
| `ch4.week7.buzz` | none | no |  | watch |  |
| `ch4.week7.buzzReply` | think | yes | inner | Hugo | d.thought(B7.buzzReply, 2.4) |
| `ch4.week7.wrap` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(B7.wrap) |
| `ch5.title` | none | no |  | title |  |
| `ch5.objectives.**` | none | no |  | objective |  |
| `ch5.prompts.**` | none | no |  | prompt |  |
| `ch5.signs.**` | none | no |  | sign |  |
| `ch5.opening` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.opening) |
| `ch5.benali` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | talk(n, T.benali) -> d.say |
| `ch5.ines` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | talk(n, T.ines) -> d.say |
| `ch5.marco` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | talk(n, T.marco) -> d.say |
| `ch5.shopCard` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.shopCard) |
| `ch5.boltHoles` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.boltHoles) |
| `ch5.jobs.shutter.near` | bark | yes | bark | speaker = who | ch5jobs: api.bark(line.text, line.who, 3) on approach |
| `ch5.jobs.shutter.gauge` | none | no |  | ui |  |
| `ch5.jobs.shutter.mash` | bark | yes | bark | speaker = who | ch5jobs: ui.thought(m.text, 2.4, {who}) |
| `ch5.jobs.shutter.done` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5jobs: d.say(T().shutter.done) |
| `ch5.jobs.shutter.call` | bark | yes | bark | speaker = who | ch5jobs.callShutter: api.bark(c.text, c.who, 3.2) from up the street (added 2026-10-07) |
| `ch5.jobs.radio.near` | bark | yes | bark | speaker = who | ch5jobs: api.bark on approach |
| `ch5.jobs.radio.hint` | none | no |  | hint |  |
| `ch5.jobs.radio.stations` | bark | yes | radio | fishing=radio_fishing, football=radio_football, forecast=radio_forecast | crafts/radio.js: ui.thought(text.stations[id], 2.6, {who: "Radio"}) when a station is found |
| `ch5.jobs.radio.done` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5jobs: d.say(T().radio.done) |
| `ch5.jobs.board.near` | bark | yes | bark | speaker = who | ch5jobs: api.bark on approach |
| `ch5.jobs.board.word` | none | no |  | sign |  |
| `ch5.jobs.board.tiers.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5jobs: d.say(tiers[...]) [selected-at-runtime] |
| `ch5.jobs.wheel.near` | bark | yes | bark | speaker = who | ch5jobs: api.bark on approach |
| `ch5.jobs.wheel.truing.flat` | think | yes | inner | Hugo | truing.js: d.thought(text.flat, 3) |
| `ch5.jobs.wheel.truing.barks` | bark | yes | bark | speaker = who | truing.js: ui.thought(barks[key], 2.4, {who}) |
| `ch5.jobs.wheel.truing.assisted` | bark | yes | bark | speaker = who | truing.js: ui.thought(a.text, 2.6, {who}) |
| `ch5.jobs.wheel.done` | bark | yes | bark | speaker = who | ch5jobs: api.bark(done.text, done.who, 2.6) |
| `ch5.teach.call` | bark | yes | bark | speaker = who | bark(T.teach.call[0].text, who, 2.6) |
| `ch5.teach.menu` | menu | replies | spoken | menu.who (prompt + labels not voiced) | d.correct(T.teach.menu) |
| `ch5.teach.after` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(after.slice(0,2)); d.say(after.slice(2)) |
| `ch5.panel.ask` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5panel: d.say(T.ask) |
| `ch5.panel.menu` | choose | replies | inner | Hugo (prompt + labels not voiced) | ch5panel: d.choose(T.menu) (replies null) |
| `ch5.panel.stage` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5panel: d.say(T.stage) (stage only) |
| `ch5.panel.after.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | ch5panel: d.say(T.after[motif]) [selected-at-runtime] |
| `ch5.line.setup` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.line.setup) |
| `ch5.line.gauge` | none | no |  | ui |  |
| `ch5.line.color` | none | no |  | data |  |
| `ch5.line.end` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.line.end) |
| `ch5.line.tiers.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.line.tiers[tier]) [selected-at-runtime] |
| `ch5.line.sign` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.line.sign.slice(0,2)); d.say(slice(2)) |
| `ch5.line.photo` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.line.photo) |
| `ch5.club.greet` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.club.greet) |
| `ch5.club.after` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.club.after) |
| `ch5.club.afterThoughts` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.club.afterThoughts) |
| `ch5.boot.*` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.boot.<beat>) |
| `ch5.walk.sami` | bark | yes | bark | speaker = who | bark(B0[i].text, B0[i].who) at 0 / 2.5 / 4.7 s |
| `ch5.walk.firstJog` | think | yes | inner | Hugo | thoughtSoon(T.walk.firstJog) -> bark(text, null) |
| `ch5.walk.stopped` | think | yes | inner | Hugo | thoughtSoon(T.walk.stopped) |
| `ch5.walk.mural` | think | yes | inner | Hugo | thoughtSoon(T.walk.mural) |
| `ch5.walk.bike` | think | yes | inner | Hugo | thoughtSoon(T.walk.bike) |
| `ch5.walk.watchHud.**` | none | no |  | watch |  |
| `ch5.walk.outline` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.walk.outline) |
| `ch5.walk.restMenu` | choose | replies | inner | Hugo (prompt + labels not voiced) | d.choose(menu) then d.think(opt.reply) |
| `ch5.readyCheck` | menu | replies | spoken | menu.who (prompt + labels not voiced) | ch5.js: d.choose(T.readyCheck): who + prompt "Personne te chronomètre." + Ready / Not yet, no replies; nothing voiced (added 2026-10-07) |
| `ch5.walk.crane` | say | yes | spoken / inner / voicemail (per line flags) | speaker = who | d.say(T.walk.crane) |

</details>

## 8. Runtime (as built)

`src/core/Voice.js` (created in `main.js`, `ctx.voice`); the UI hooks are in `src/ui/UI.js`. The API is
in `docs/API.md` §4.4 ("French voices"). This replaces the integration plan that stood here; where the build differs from
the plan, the build is described.

1. **Module and key.** `Voice.js` imports `scripts/voice/voiceKey.mjs` directly (no copy). It is active
   only when the language is `fr`, the option is on and WebAudio works. In English or with the option off
   it fetches, decodes and plays nothing. Clips play on their own `voice` gain into `audio.master`: mute
   and pause (the suspended `AudioContext`) silence them, `audio.cut()` does not.
2. **Lookup.** `voiceKey(displayed text)`, then the per-speaker variant by the displayed `who`. Inner lines
   and thoughts without a speaker use `L.names.hugo`. Lines without a clip (stage directions, cards, phone
   texts) are recorded as `miss` in `__game.debug.voiceLog`, with no console warning. A missing file or a
   decode failure gives a `[voice]` warning under `?debug=1` only.
3. **Loading.** The manifest is fetched as soon as voices become active (also at the title, when the
   language or the option changes). At chapter start the chapter's compressed clips (keys found by walking
   `L.chN` and `L.stumble`) are fetched 3 at a time, and the previous chapter's are released. Decoding
   happens on play, with the next 2 dialogue lines decoded ahead and at most 90 s of decoded audio kept.
4. **Priority: one clip at a time.** A dialogue line (dialogue, menu replies, voiced card lines) stops
   whatever is playing. A thought or bark never interrupts a dialogue clip: under an open dialogue it waits
   for the dialogue to close, and a direct `voice.play` of a thought over a dialogue clip is skipped.
5. **Timing.**
   - A dialogue line never advances by itself. The first E while typing finishes the text and keeps the
     voice; the E that moves on stops the clip (40 ms fade).
   - A thought stays on screen for at least the clip length + 0.4 s.
   - A thought that arrives while another voiced thought is being said waits until it has been said
     (+0.4 s). The newest 2 wait; a waiting line older than 6 s is dropped, but time under an open dialogue
     or card does not count.
   - `ui.thought(text, secs, {who, replace: true})`: a newer line from the same speaker cuts the one being
     said instead of waiting (the Ch5 radio stations as the dial moves).
   - The Ch3 crack card holds each line until its clip ends + 0.25 s. The Ch3 STRIDE menus wait (at most
     5 s) for the week's last thought to be said; the KM 31 crack waits (at most 4 s past the board) for
     "Je n'ai jamais pris le mur…".
6. **Ducking.** `audio.duck(on)` dips the beds gain by 7 dB (120 ms attack, 450 ms release): music,
   ambience beds, the mood drone and bed-like loops on bus `'beds'` (room tones, hums, the TV, the radio
   talk). One-shot SFX are not ducked, except where a chapter dips its own (the Ch1 hammer blows by 12 dB
   under a line being said, the Ch4 kettle, the Ch5 club pass). The beds stay ducked while a dialogue box
   is open and come back 700 ms after the last clip once it closes (no swell between lines).
7. **Interruptions.** Pause suspends the shared `AudioContext`, so a clip holds its place. Switching the
   language to English or turning the option off stops the clip. Chapter changes, restart and
   `Director.skip()` stop speech.
8. **Option.** The Options panel (title and pause) has a "Voices" / "Voix" row, default ON, saved in
   `localStorage['hairline.voice']` (`'1'` / `'0'`). In English the row is greyed and disabled with the
   note "French only" / "En français uniquement"; the saved choice still shows. No reload is needed.
9. **Checks.** `node scripts/voice/extract-lines.mjs --check` (every leaf classified; exit 0). Debug:
   `__game.debug.voiceLog`, `voiceMeter()`, `autoAdvance(on)`; clip starts also go into the shared
   `audioLog` as `kind: 'voice'`.

## 9. Licences

Research and non-commercial licences are acceptable for this personal, unpublished project, but each one
is recorded. What the shipped clips depend on:

| Item | Licence |
|---|---|
| Kyutai TTS 1.6B en_fr weights (`kyutai/tts-1.6b-en_fr`) | CC-BY-4.0 (credit: Kyutai) |
| moshi-mlx 0.3.0 / moshi (inference code) | MIT / Apache-2.0 |
| Voice embeddings `cml-tts/fr/*` in `kyutai/tts-voices` (12 of the 13 voices) | CC BY 4.0 (CML-TTS, derived from LibriVox public-domain readings; credit the CML-TTS authors) |
| Voice embedding `voice-donations/Erick_enhanced` (Dr Okafor) | CC0 |

QA-only tools (not in the clips): Whisper large-v3 via mlx-whisper (MIT), SpeechBrain ECAPA (Apache-2.0),
Praat/parselmouth (GPL-3.0, also used for Sami's pitch/formant shift, which leaves no code in the output),
pyloudnorm (MIT), ffmpeg/libopus (LGPL/BSD). `docs/CREDITS.md` is outside this step's write scope; copy the
first table there when the voices are integrated.

## 10. Model

**Kyutai TTS 1.6B en_fr** (`kyutai/tts-1.6b-en_fr`, CC-BY-4.0), picked over Chatterbox Multilingual and Fish
S2 Pro (both dropped). Bake-off: mean CER 0.010 on the 12-line test set, native French accent for French
voices, clearly separable voices. It cannot clone a voice (no speaker encoder in the public checkpoint), so
every voice is one of the 898 precomputed embeddings in `kyutai/tts-voices`; only the 41 French ones are
used, because English-conditioned voices speak French with an English accent.

| Setting | Value |
|---|---|
| Runtime (Mac) | moshi-mlx 0.3.0, bf16, `.cache/tts/A/venv`; persistent worker `scripts/voice/kyutai_worker.py`, batches of 12 lines (any mix of voices). MLX cache limit 4 GB + `clear_cache()` per batch, memory limit 40 GB. |
| Runtime (remote, optional) | auriga, RX 9070 XT, PyTorch-ROCm (`scripts/voice/remote/`), batch 32. Verified against the Mac on 26 lines: same-line ECAPA 0.83 (min 0.60), same F0, single-take CER 0.032 vs the Mac's kept 0.011 (retakes close the gap). |
| Sampling | cfg 2.0 (CFG-distilled conditioning), temp 0.6, `initial_padding` 6 (`cast.json` → `model.defaults.initialPadding`; 2 before the QA pass, when ~10% of takes started mid-phoneme), `max_padding` 8, `final_padding` 2, 32 codebooks, 40 s cap. Seeds per attempt: 1, 101, 202, 303 (`--seed-offset N` shifts them for a `--regen`). The padding is not part of the generation hash: passing takes made with 2 stay. |
| Text prep | `tts` field; `'`→`'`, `…`→`... ` (glued "…et" is misread), ALL-CAPS words → Capitalised (HUGO, STRIDE were mangled). Per-key overrides in `cast.json` → `ttsOverride` (only Odile's "Hum." → "Hmm."). |
| Speed | Mac, batched: real-time factor 0.2-1.0 per batch (17-55 s of audio in 10-25 s), against 2.3-9.5 unbatched in the bake-off. auriga: RTF 0.04-0.1. |

**QA per take** (`scripts/voice/qa.py`, `cast.json` → `qa`):
- Whisper large-v3 (mlx-whisper, French, greedy) on the dry take, padded with 0.4 s / 0.3 s of silence
  (Whisper drops a word starting at t=0); words that fall entirely inside the padding are discarded (Whisper
  invents "C'est", "Trop", "Sous-titrage" in silence).
- CER against the TTS text after the shared normalisation (numbers to words, punctuation removed); the
  minimum with a homophone-tolerant variant that drops silent endings (`ignoré`/`ignorée`,
  `qu'ils gagnent`/`qu'il gagne`) and maps the cast names Whisper spells differently (Marshall → Marchal,
  révèle → Revel).
- Fail when CER > 0.12, pacing outside 5-24 letters/s (lines with 12+ letters) or a voiced span longer than
  1.5 s + 0.15 s per letter, an ending louder than -12 dB re the loud part (cut off), or no end step.
- On failure: regenerate with the next seed, up to 3 times; keep the best take (CER, then penalties), log
  the failure. A last-resort repair cuts a stray word the model prepends to very short lines.
- Odile's "Hum." is judged on its voiced span only (0.15-1.2 s); ASR cannot score a hum.
- Since the QA pass (§12), a take also fails on: a stray word before the line or a dropped first word
  (`edge_words()`: "et j'allais", "'aurais pu"), the last word missing (compared by sound over the last ~10
  letters, so "des cols" / "d'école" passes), a hot onset (the first 10 ms within 12 dB of the loudest
  frame together with any ASR difference, or within 20 dB in any case: the model started mid-phoneme), the
  ECAPA nearest-centroid check naming another character (voiced span >= 0.8 s), or a median pitch more than
  7 semitones off the character's median (4 for takes from a remote worker).

**Post-processing** (`generate.py` `post_line`, chains in `cast.json` → `deliveries`): speaker post (Sami's
childify) → trim the model's edge silence → normalise to -20 dBFS RMS → room-tone / hiss bed at a fixed SNR
→ ffmpeg delivery chain at 48 kHz → edge trim on the processed signal (80 ms before the first and 80 ms after
the last run of three 10 ms frames within 45 dB of the loudest; run-based so a click in the first decoded
frame is not taken as the start) with 5 ms / 30 ms fades → integrated loudness (pyloudnorm, short clips tiled for the
measurement) → 4x-oversampled true-peak limiter at -2.0 dBTP → libopus 48 kbps VBR mono 48 kHz → decode and
verify (loudness within 0.5 LU, true peak <= -1.5 dBTP, else adjust and re-encode).

| Delivery | LUFS | Chain |
|---|---|---|
| spoken | -19 | HPF 70 Hz, compressor 1.8:1, two early reflections (7/13 ms, -29/-34 dB), room tone at -46 dB SNR |
| bark | -19 | HPF 90 Hz, +2.5 dB at 2.6 kHz, compressor 2.5:1, slightly bigger room (11/23/37 ms), room tone |
| inner | -23 | HPF 90 Hz, +2 dB low shelf at 180 Hz (proximity), LPF 6.2 kHz, compressor 2:1, very short tight room (5/9/15 ms) |
| voicemail | -21 | 300-3400 Hz band-pass (4th order), compressor 4:1, 8 kHz resample + light log bit-crush (codec grit), line hiss |
| tv | -19 | HPF 110 Hz, -2 dB at 250 Hz, +3 dB at 3.2 kHz, LPF 9.5 kHz, compressor 3:1 |
| radio | -21 | 320-3300 Hz band-pass (4th order), +3 dB at 1.5 kHz, compressor 3.5:1, hiss at -34 dB SNR |
| flashback | -19 | HPF 100 Hz, LPF 8.5 kHz, distant room (29/53/83/131 ms reflections), compressor 2:1 |

**Results (2026-10-07, after the QA pass):** 301/301 clips in the manifest, 0 failed QA, mean CER 0.009
(kept takes), 66 lines needed retakes (385 takes in all), all kept takes from the Mac, 16.9 min of audio,
6.3 MB. Max true peak -1.7 dBTP; head silence <= 80 ms, tail <= 120 ms. Per-line metrics: `.cache/tts/gen/state.json`; summary:
`.cache/tts/gen/report.json`.

**Re-run (incremental):**

```sh
node scripts/voice/extract-lines.mjs        # after any text change
nice -n 10 .cache/tts/A/evalvenv/bin/python scripts/voice/generate.py [--remote auriga]
```

A line is skipped when its key + text + TTS text + cast entry + delivery chain hash is unchanged and its
`.ogg` exists. A changed delivery chain only re-processes the kept take; a changed voice, cfg, seed list or
TTS text regenerates. Clips no longer in `lines.fr.json` are deleted and the manifest is rewritten
(`generatedAt` only changes when the lines do). Other flags: `--only hugo,odile`, `--keys <key,...>`,
`--regen` (discard the takes of the selected lines), `--seed-offset N`, `--repost`, `--requa` / `--reasr`
(re-score stored takes; also gives failing lines their remaining retakes), `--dry-run` (with `--requa` it
still saves the re-scored state). `--remote auriga` splits batches between the Mac and auriga by work stealing; writing
a host name to `.cache/tts/gen/ENABLE_REMOTE` attaches it to a run in progress. Listening pages:
`.cache/tts/audition/index.html` (3 real lines and every line per character, the audit table, before / after
for the QA pass) and `.cache/tts/listen.html` (`node .cache/tts/make-listen.mjs`: the listening checklist).

## 11. Cast

One Kyutai voice per speaker (`scripts/voice/cast.json`); all at cfg 2.0, temp 0.6, seed 1 (retakes 101,
202, 303). Median F0 and CER are over the kept takes.

| Speaker | Voice (`kyutai/tts-voices`) | Licence | Post | F0 | Lines | CER | Why |
|---|---|---|---|---|---|---|---|
| Hugo | `cml-tts/fr/1406_1028_000009-0003_enhanced` | CC BY 4.0 | inner chain for thoughts | 92 Hz | 140 | 0.004 | Low-mid baritone, tired and flat; best of 6 in the bake-off. |
| Odile | `cml-tts/fr/7762_8734_000048-0002` | CC BY 4.0 | none | 187 Hz | 103 | 0.016 | Oldest French woman in the repo (estimated ~66), terse. Reads about 55, not 74: a model limit. |
| Sami | `cml-tts/fr/577_394_000070-0001_enhanced` | CC BY 4.0 | childify: Praat Change gender, F0 → 320 Hz, formants x1.2, range 1.15 | 318 Hz | 29 | 0.007 | No child voice in the repo; youngest high French voice plus a formant-aware shift (child probability 0.68-0.97 in the bake-off). Formants kept at x1.2 to avoid chipmunk; needs an ear check. |
| Bastien | `cml-tts/fr/7142_2432_000124-0003_enhanced` | CC BY 4.0 | none | 139 Hz | 7 | 0.027 | Bright, upbeat male. Loudness comes from the read, not from processing. |
| Ines | `cml-tts/fr/5476_3103_000072-0001_enhanced` | CC BY 4.0 | none | 179 Hz | 4 | 0.000 | Young, flat female (estimated ~17), deadpan. |
| Marco | `cml-tts/fr/4724_3731_000031-0001_enhanced` | CC BY 4.0 | none | 123 Hz | 6 | 0.014 | Warm, rounded older male (estimated ~64). Replaces the bake-off pick 4482_3103, which was too close to Hugo (centroid ECAPA 0.50, same F0 range). |
| Mme Benali | `cml-tts/fr/5207_3078_000031-0002_enhanced` | CC BY 4.0 | none | 188 Hz | 5 | 0.000 | Warm, lively 50s female. Tested against 7400_2928 and 2154_2576: lowest CER, least like the other women. |
| Dr Okafor | `voice-donations/Erick_enhanced` | CC0 | flashback chain | 103 Hz | 2 | 0.000 | Calm, measured adult male (male per the Ch1 text). |
| Receptionist (Dr Okafor (cabinet)) | `cml-tts/fr/12205_11650_000004-0002_enhanced` | CC BY 4.0 | voicemail chain | 192 Hz | 1 | 0.016 | Polite, even adult female. 3267_1902 was too close to Mme Benali (0.44). |
| TV | `cml-tts/fr/5790_4893_000052-0001_enhanced` | CC BY 4.0 | tv chain | 104 Hz | 1 | 0.000 | Clear male broadcast-style read. |
| Radio: fishing man | `cml-tts/fr/7601_7727_000062-0001_enhanced` | CC BY 4.0 | radio chain | 89 Hz | 1 | 0.000 | Old, slow, earnest male (estimated ~75). |
| Radio: football | `cml-tts/fr/8128_7016_000047-0002_enhanced` | CC BY 4.0 | radio chain | 141 Hz | 1 | 0.000 | Mid male, distinct from the TV voice; 2114_1656 misread "deux à zéro". |
| Radio: forecast | `cml-tts/fr/10087_11650_000028-0002_enhanced` | CC BY 4.0 | radio chain | 211 Hz | 1 | 0.000 | Even female announcer; 579_2548 was too close to the receptionist (0.44). |
| Maman | not cast | | | | 0 | | No spoken line (SMS only). If she ever speaks: `cml-tts/fr/7400_2928_000100-0001_enhanced` (CC BY 4.0, warm 50s). |

**Distinctness** (SpeechBrain ECAPA on the dry kept takes, before delivery processing):
- Between speaker centroids, threshold < 0.40: **passed**, with a maximum of 0.37 after the QA pass
  (Mme Benali / Ines; 0.32 before her fifth line was added). The
  next pairs are Ines / Odile 0.32, Mme Benali / Odile 0.31, Okafor / fishing radio 0.23, Hugo / Ines 0.23.
  The four adult men in dialogue (Hugo, Marco, Bastien, Okafor) are all <= 0.23 from each other.
- Line-pair means: at most 0.23 between speakers, against 0.50-0.71 within a speaker (Hugo 0.55,
  Odile 0.59, Sami 0.50).
- F0 sanity: Sami 318 Hz is highest; the women sit at 179-211 Hz; the men at 89-141 Hz, with Hugo low
  (92 Hz). Odile, Mme Benali and the receptionist share an F0 range (188-192 Hz) but are separated by timbre
  (ECAPA <= 0.31) and never share a scene with the receptionist (voicemail only).

Known limits, for the ear check: Odile sounds about 55, not 74; Sami's child voice is a processed young
woman's voice; there is no emotion or projection control (Bastien's volume, Sami's excitement and barks
come from the voices and the delivery chain only).

## 12. QA audit (2026-10-07)

An adversarial pass over the **final** `.ogg` files, independent of the generator's per-take QA:

```sh
nice -n 10 .cache/tts/A/evalvenv/bin/python -I scripts/voice/audit.py --all   # or the default sample (below)
```

`audit.py` decodes each clip and checks it. It runs Whisper twice (0.4 s and 0.55 s of leading zeros) and
keeps the better reading: Whisper drops or invents a clip-initial word depending on the lead. It then checks:
- CER > 0.12;
- added words (>= 2 inserted words, or a transcript 25 % longer than the text);
- truncation (last word missing, speech running into the clip end, a hot onset);
- integrated loudness within ±1 LU of the delivery target, true peak <= -1.5 dBTP, clipping;
- head / tail silence > 150 ms;
- the speaker, by nearest ECAPA centroid with leave-one-out, on the final clip and on the dry take;
- for remote-generated clips, pitch, spectral centroid and ECAPA against the same character's Mac clips.

The default sample is a speaker-stratified random 25 % (seed 20261007), plus every clip under 1 s or over
12 s, every remote clip and every clip on the pronunciation spot list. Output: `.cache/tts/gen/audit.json`.

**Found and fixed**

| Issue | Clips | Cause | Fix |
|---|---|---|---|
| First consonant clipped ("'aurais pu", "'est un excellent kebab"), or a stray syllable before the line ("Et j'allais", "cent trente-sept", "Eu-straïde", "Ne me regarde pas") | ~12 | With `initial_padding` 2, ~10% of takes start at full level in the first decoded frame (mid-phoneme). The CER gate (0.12) let them through. | `initial_padding` 6 for new takes, in the Mac and auriga workers. New take checks: `edge_words()`, hot onset. 49 clips now keep another take. |
| Up to 0.85 s of quiet noise before a line (leading "…" lines: "…Tiens-moi cette planche.") and tails up to 330 ms | 14 over 150 ms | A click in the first decoded frame counted as the start of speech for the -48 dB edge trim. | Run-based edge detection (3 × 10 ms) at -45 dB, 80 ms pre-roll / 80 ms post-roll. Head <= 80 ms, tail <= 120 ms on all clips. |
| Pitch far off the character: Odile at 270 Hz ("Jusqu'où ?", ECAPA nearest Benali), Odile's "Signe-le." retake at 312 Hz, Bastien +8.8 st | 3 | No per-take speaker check on short clips | Pitch check (±7 st; ±4 st for remote takes) and ECAPA nearest-centroid check on takes. All three were regenerated. |
| "Vingt guemètres", "Trop de bornes, hein ?" losing "hein", "Marcha les filles" for "Marchal et Fille" | 3 | Model slips that the CER gate let through, or kept as the best of 4 failing takes | `--regen` with padding 6 |
| auriga vs Mac: auriga's Marco +5.9 st above his Mac median (a new auriga test take: +2.9 st); auriga's Benali much brighter (spectral centroid 1920 vs 1171 Hz); ECAPA still matched (0.75-0.85) | 3 kept clips | Different backend (PyTorch-ROCm vs MLX). The same voice embedding drifts in pitch and brightness. | The 3 auriga clips were regenerated on the Mac, so all 301 are Mac takes. Remote takes get the tighter ±4 st pitch limit. |
| 8 lines changed and 3 new nodes from the other workflow (`ch4.day8.mixer.warm`, `ch5.jobs.shutter.call`, `ch5.readyCheck`) | 10 new clips | Text edits | Classification rules added. 8 stale clips were removed. |

**Remaining flags after the pass (each checked, believed fine)**
- "Vous voyez, là ?" (Okafor, flashback) and "Te voilà." are heard without the first word. The audio is
  identical to the earlier clips, which Whisper read fully with more leading silence; it is a Whisper edge effect.
- "en haut des cols" heard as "d'école", "c'est pire / telle quelle" as "s'épirent / qu'elle": homophones.
- "…pour—": the dash is read as an ellipsis.
- ECAPA is unreliable on clips under 1 s: "Hmm." (a hum) and Hugo's "…Non." are nearest other centroids
  at cosine < 0.2. "Jusqu'où ?" (Odile, 0.7 s) is still nearest Ines (0.37 vs 0.30) after the retake;
  its pitch is now +4 st, within range.

**Key function check.** `voiceKey.mjs` has no imports, uses no Node API, and uses no BigInt literals
(it calls `BigInt('0x...')`). It works with `TextEncoder`, with a manual UTF-8 fallback. All 301 inventory
keys match. Each line also gives the same key in these runtime forms:
- straight vs typographic apostrophes, `...` vs `…`;
- U+202F / U+00A0 / a plain space or no space before `? ! : ;`, and inside « »;
- surrounding whitespace, and NFD input.

The game resolves key tokens (`{KeyW}`) for the whole tree at load (`i18n.js` `resolveKeys`). No voiced line
contains a token, so `keyText()` leaves every voiced line unchanged. The UI's `*emphasis*` parsing only
affects rendering. The runtime must hash the line's text string, not the rendered HTML. Not unified: em/en
dashes, and `…` with or without a following space (one voiced line has a dash).

**Pronunciation spot list** (Whisper on the final clips; map in `pronunciation.json` → `checkedOk`):

| Name / item | Voiced lines | Heard as | Result |
|---|---|---|---|
| Revel | 2 | "révèle" | OK (the /ʁəvɛl/ reading); ear check |
| Odile | 4 | Odile | OK |
| Marchal | 1 | "Marshall" | OK (/maʁʃal/). The old takes that said "Marcha les" were rejected. |
| Okafor | 3 | Okafor | OK |
| Sami | 2 | "Samy" | OK |
| Bastien | 1 | Bastien | OK |
| Benali, Tanneurs, H. R. | 0 | | not in any voiced line (who label, end cards, signs) |
| STRIDE → "Straïde" | 1 | "Straïde" / "Strayed" | OK after the regeneration ("Eu-straïde" before) |
| numbers | 68 lines | right values | OK (all spelled out by `frTTS()`) |

No new `words` entry was needed: every mispronunciation found was a take-level slip, and a retake fixed it.

**Final numbers:**
- 301 clips (300 keys + 1 variant) and 0 lines missing audio against a fresh extraction;
- audit over all 301: mean CER 0.006 and 8 flags (above);
- loudness within 0.5 LU of target, max true peak -1.7 dBTP, no clipping;
- head <= 80 ms, tail <= 120 ms;
- 16.9 min, 6.3 MB of Opus.

Listening: `.cache/tts/listen.html` (checklist), `.cache/tts/audition/index.html` (before / after).
