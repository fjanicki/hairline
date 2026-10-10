# HAIRLINE — Revision 4: the script and beat sheet

Status: **binding script for the R4 chapter agents** (written 2026-10-08, after the user approved
docs/DESIGN-R4.md and decided that the game is **French only**; edited the same day, see §17, Editor's notes,
for every change to strings that builders may already have copied). Builders started from the first draft (§17.1). Nothing is
committed, pushed or released until the user has played it.

This document is the source of truth for every player-facing string added or changed by Revision 4. The
structure and notes are in English. **Every player-facing string is French**, final, and typeset per
docs/i18n-fr.md (U+202F before `? ! : ;` and inside « », `’`, `…`, decimal comma, U+00A0 between a number and
its unit). Copy strings exactly. Where this document and DESIGN-R4.md disagree, this document wins; the
changes are listed in §0.4 and in the "Script decisions" section at the end of DESIGN-R4.md.

Read with: docs/DESIGN.md (Revisions 1–3, the built game), docs/DESIGN-R4.md (the plan), docs/i18n-fr.md (the
binding French style guide), docs/API.md (Director, UI, notebook, memory), docs/voice.md (voice pipeline).

---

## 0. Conventions and global decisions

### 0.1 How lines are written here

Each block has a proposed text key and the Director call that plays it:

```
#### `ch5.week2.workshop` · d.say
- stage: *Texte d’une didascalie.*      → stage(...)   (not voiced)
- odile: Texte.                          → odile(...)   (voiced, spoken)
- think: Texte.                          → think(...)   (voiced, inner)
- hugo: Texte.                           → hugo(...)    (voiced, spoken)
```

- Everything after ` ‖ ` on a line is a **delivery note** for the voice pipeline (`delivery`/`context`), never
  part of the string.
- `*word*` inside a line is the existing emphasis markup (kept literally in the source string).
- Non-blocking lines are marked: `thought:` (Hugo, `ui.thought` without `who`), `bark(Who):` (`ui.thought` with
  `who`), `buzz:` (`ui.watchBuzz`, not voiced), `card:` (chapter or week card, not voiced), `caption:`
  (lower-third caption, not voiced), `sms(Who):` (phone text, not voiced).
- State changes: `item+ id` / `item− id` (pocket), `clue+ id` (case tab), `clueNote id` (a case note
  updates), `note+ key` (notebook `add`), `noteAnn key` (notebook `annotate`), `remember(path, v)`,
  `warmth+ key` (§11), `hope → x`.
- Menus are written as:
  ```
  #### `ch2.jo.menu` · d.choose (who: 'Jo')
  prompt: Texte du menu.
  1. [Texte de l’option] → reply(jo): Réponse. · warmth+ joSign
  2. [Texte de l’option] → reply(jo): Réponse.
  ```
  `d.correct` menus mark the right option `✔` (wrong options loop back, as today). `d.choose` menus never
  loop. A `reply(who)` whose speaker is not the menu's `who` needs the per-option `who` override proposed in
  §13 (one case: Odile answers in Jo's menu in Ch6).
- Text keys follow the existing files: `L.chN.<block>`; arrays are indexed in the order given. Moved blocks
  keep their sub-keys (see §0.3).

### 0.2 Cast, labels and helpers

| id (helper) | `who` label | Who | Address to Hugo | Voice (`speaker`) |
|---|---|---|---|---|
| `hugo`, `think` | Hugo | Hugo Revel, 37 | — | `hugo` |
| `odile` | Odile | Odile Marchal, 74 | tu (since `ch4.day5.book[3]`) | `odile` |
| `sami` | Sami | Sami Haddad, 11 | tu | `sami` |
| `bastien` | Bastien | run-club captain, 40s | tu | `bastien` |
| `gerard` | Gérard | CHEZ GÉRARD, 50s (was Marco) | tu | `gerard` (Marco's voice) |
| `lou` | Lou | Lou, 16, ex-tagger (was Ines) | **vous** | `lou` (Ines's voice) |
| `benali` | Mme Benali | the baker | **vous** | `benali` |
| **`jo`** (new) | Jo | Josianne « Jo » Lavoie, 34, ENCRE FINE | **tu, from her first line** | **`jo`** (new) |
| **`oldman`** (new) | Le vieux monsieur | Albert Durand before Hugo learns his name (Ch5) | **vous** | **`durand`** (new) |
| **`durand`** (new) | M. Durand | Albert Durand, 81 (Ch6 Week 6 on) | **vous**, « jeune homme » | **`durand`** |
| `radio` | Radio | Odile's radio (fishing man) | — | `radio_fishing` |
| — | STRIDE | watch and app (buzzes, menus, screens) | tu | not voiced |

- **Speaker CSS classes** (first word of `who`, see API.md §4.5): new classes `jo` (text tint `#c25a6c`, a
  readable oxblood) and `durand` (`#b39a7a`, cardigan brown, lightened). The first-word rule would give
  `le` (Le vieux monsieur) and `m` (M. Durand): add an explicit label → class map for these two labels (both
  `durand`) instead of shipping classes called `le` and `m`. `Gérard` relies on the accent stripping in
  i18n-fr.md §4.6 (`gerard`).
- **Tu/vous additions** (extends i18n-fr.md §3; nobody ever remarks on a switch, except Jo once in Ch2):
  - **Jo tutoie everyone**, from her first line (Québécoise), including Odile, Mme Benali and Durand.
    Hugo answers her in tu after her correction in Ch2 (« Tu. On est pas à la banque. »).
  - **Odile → Jo: vous** throughout (Jo doesn't work at her bench). Odile calls her « Josianne ».
  - **Mme Benali → Jo: vous.** **Gérard ↔ Jo: tu.** **Sami ↔ Jo: tu.** **Lou → Jo: tu** (they're the
    street's two young-ish newcomers); Jo → Lou: tu.
  - **Durand → Hugo: vous** (« jeune homme »); **Hugo → Durand: vous** (« monsieur Durand »).
  - **Durand ↔ Odile: tu** (fifty years: « Odile », « Albert »).
  - **Durand → Jo: vous** (« mademoiselle », which she enjoys). **Durand → Sami: tu.**
  - **Sami → Durand: vous** and « monsieur Durand ». It is the only adult Sami vouvoie. Nobody comments.
  - **Hugo → Odile** stays **vous until `ch6.week7.wrap[1]`** (« …Tu veux le peindre. », unchanged, now in
    Ch6). Every Hugo → Odile line before it in this script avoids the pronoun or uses vous. From Ch7 on he uses
    tu (one new case: `ch7.durand.meet`, « Tu savais ? »).
- **Swearing.** i18n-fr.md §1 bans swearing. **Jo's minced church oaths are the one exception** (« câline »,
  « tabarnouche », « mautadine »): they are the Québécois equivalent of « mince » or « purée ». Nothing
  stronger, ever.

### 0.3 Chapter structure and key migration

| # | Title (`L.chN.title`) | Calendar | Where | Built from |
|---|---|---|---|---|
| 1 | **Sans impact** | Jour 4, 21 h | the flat | `ch1` + items intro + window seed |
| 2 | **Ne t’arrête jamais** | Jour 4, soir | street, rain | `ch2` + Benali's shutter + Jo cameo |
| 3 | **À la longue** | flashback | road | `ch3` **unchanged** |
| 4 | **Mesurer deux fois** | Jour 5, Jour 8 | workshop | `ch4` Day 5 and Day 8 + items + the hook |
| 5 | **Qui a huilé le rideau ?** | Semaines 2, 3, 4 | street by day, workshop, bakery at 4 a.m. | new + `ch4.week4` moved |
| 6 | **Service de nuit** | Semaines 5–9 | street, kebab counter, bike shop, workshop, ENCRE FINE, the flat, street at 3 a.m. | new + `ch4.week7` moved |
| 7 | **Le Mur** | Semaine 12 | street, day to golden hour | `ch5` renamed `ch7` + new beats |

The task brief proposed « Pas d’impact » and « Ne jamais s’arrêter ». **Keep the existing titles**: they are
fixed by i18n-fr.md §4.2 and carry echo chains (« Sans impact » is the doctor's order; « Ne t’arrête
jamais » is the STRIDE slogan, echo chain 4).

**Key migration** (voice keys are hashes of the text, so moved lines keep their clips; only changed text
regenerates):

| Old key | New key | Change |
|---|---|---|
| `ch4.cards.week4`, `ch4.objectives.week4`, `ch4.prompts.bike`, `ch4.week4.*` | `ch5.cards.week4`, `ch5.objectives.week4`, `ch5.prompts.bike`, `ch5.week4.*` | moved; one new block (`ch5.week4.jo`) inserted, lines unchanged |
| `ch4.cards.week7`, `ch4.objectives.week7`, `ch4.prompts.bench`, `ch4.week7.*` | `ch6.cards.week7`, `ch6.objectives.week7`, `ch6.prompts.bench`, `ch6.week7.*` | moved; new blocks around it, lines unchanged |
| `ch4.cards.week12` | `ch7.cards.week12` | moved |
| `ch5.*` | `ch7.*` | renamed; additions in §8 |
| `ch4.prompts.oldSigns`, `ch4.prompts.radio`, `ch4.oldSigns`, `ch4.radio` | stay in `ch4`; Ch5 and Ch6 workshop scenes read them from `L.ch4` | unchanged |
| `memory.js` owners | `wheel` 3 → **4**; `teachFirst`, `panel`, `jobs` 4 → **6** | chapter indices shift |
| `L.watch.atChapter`, `L.notebook.atChapter` | 7 entries (indices 0–6), §10 | |

### 0.4 Decisions this script makes (refinements of DESIGN-R4.md)

1. **Ch1 seed is a click, not a creak.** A window hotspot: last night at 3 a.m. Hugo heard someone push a bike
   down the street, *clic, clic, clic*, a worn freewheel pawl. It plants the clue sound, which the "creak on
   the stairs" didn't.
2. **Ch3 gets a wordless seed**: in Week 31 (4 h 47), an old man pushes a clicking black bike along the far
   kerb. Hugo doesn't look. No text. It pays off in Ch6: « Vous ne m’avez jamais vu. Vous regardiez votre
   montre. »
3. **Required items auto-select.** Pressing {KeyE} on a hotspot that needs an item uses it if it is in the
   pocket, so the main path never needs the pocket UI. The pocket is for *trying* things and for gifts.
4. **Clues live in the case tab, not the pocket.** The 12-slot pocket holds tools and gifts only.
5. **The case tab is the back of the notebook.** Odile tells him to « compter ça »; he turns the exercise book
   over and starts from the last page, as at school. Tabs: « CE QUE JE SAIS FAIRE » / « L’AFFAIRE ».
6. **Durand is on screen before the board (fair play).** Ch5 Week 3: asleep on the repaired bench at 11 a.m.
   (« Le vieux monsieur »), then he leaves pushing his clicking bike. Ch6 Week 6: his 1974 photo in the shop
   names him.
7. **Odile knew.** She recognised her own paint (« Bleu Durand », which she mixed for his shopfront in 1979)
   in Week 3 and let Hugo carry on. She tells him in Ch7: « Tu avais besoin d’une enquête. Lui avait besoin
   qu’on le trouve. Moi, j’avais besoin de rien. » It is her near-ask by proxy, and the ending card « Demander. »
   still closes it.
8. **STRIDE gives the stakeout away.** Mid-stakeout the phone offers « Envoyer un bravo à D.52 ? »; whichever
   option the player picks, a bravo is sent, Durand's watch buzzes, and he turns round. That is the reveal.
9. **Numbers that would repeat by accident are changed:** Gérard has **43** receipts (41 is Ch2's « Quarante
   et une minutes »); Mme Benali's shutter has screamed for **13** years (11 is the kilometres on the crack and
   « plus que onze »); Bastien has **58** passages on the segment, D.52 has **63**.
10. **Week 3 is a Saturday** (Sami and Lou are free; the run club runs).
11. **Every week from 2 to 12 has a beat**: Weeks 5, 8 and 10–11 get a week card and one voiced thought.
12. **New notebook entries carry notes** in the « Courir. (certains dimanches) » style: « Rouler un croissant. »
    + « (lune) » (it rhymes with line 1, « Rouler. », on purpose), « Tracer un trait fin. » + « (mal) » (Jo's
    hand), « Cuisiner. » + « (en cours) » (Jo writes the whole line). A third hand, `hand: 'jo'` (small, upright,
    black felt-tip), is new. **The photo is not a notebook entry** (« C’est le téléphone qui sait faire »): the
    list stays crafts, and the final list is 15 lines.
13. **Items dropped from the R4 list:** the oil can and the liner brush had no use that wasn't a fetch quest.
    The rags are a gift. The thermos holds Jo's soup.
14. **Ending: 9 cards** (two new: Durand, Jo). See §8.9 for the layout question.
15. **Hugo served Durand his tea and didn't look up** (Ch6 Week 6, « …Je cherchais la tomate. »). It is the
    mid-chapter rehearsal of the reveal's « Vous regardiez votre montre. »

---

## 1. Items

### 1.1 Rules (as written for players)

- **Pocket** (`POCHE`): up to 12 tools and gifts, a strip at the bottom left. {Tab} or a click on the pocket icon
  opens it. Clicking an item **holds** it (a small icon by the cursor and the prompt line « En main : … »);
  {KeyE} on a hotspot then uses it, or gives it if the hotspot is a person. {Escape} or a second click puts it
  away.
- **Required items auto-select** (§0.4.3): {KeyE} on a hotspot that needs an item uses it if it's in the
  pocket. If it isn't, Hugo says the hotspot's `needs` line.
- **Clues** go to the case tab (`L’AFFAIRE`), not the pocket. A clue arrives with a pencil write-on and the
  `pencil_write` sound, like the notebook.
- The pocket is saved with the chapter (localStorage) and **reset per chapter** to `items.atChapter[i]`
  (§1.5). Clues are kept across chapters 5–6 (they are the case).
- Every item has `name` (label, capitalised), `def` (with its article, for prompts), `kind`, `desc` (one line,
  shown when hovered in the pocket; not voiced).

### 1.2 Pocket and case UI strings (`L.items.ui`, `L.caseFile.ui`, `L.hints`)

| Key | French | Notes |
|---|---|---|
| `items.ui.pocket` | POCHE | tab label |
| `items.ui.case` | L’AFFAIRE | tab label (back of the notebook) |
| `items.ui.notebook` | CE QUE JE SAIS FAIRE | tab label = existing heading |
| `items.ui.gained` | + {item} | toast, 1.6 s (`{item}` = `name`) |
| `items.ui.lost` | − {item} | toast |
| `items.ui.given` | {item} → {who} | toast |
| `items.ui.worn` | au poignet | small tag on the watch |
| `items.ui.held` | En main : {item} | prompt line while holding |
| `items.ui.use` | Utiliser {item} | prompt with `def`: « Utiliser la craie » (≤ 26 characters with every `def` below except « Utiliser le papier de verre », 27) |
| `items.ui.give` | Donner {item} | prompt with `def` on a person: « Donner la soupe » |
| `items.ui.putAway` | Ranger | button |
| `items.ui.full` | Poche pleine. | toast |
| `items.ui.empty` | Rien dans la poche. Pour une fois. | empty pocket text |
| `items.hints.pocket` | {Tab} : la poche | first item gained (Ch1), once |
| `items.hints.useItem` | Objet en main : {KeyE} pour l’utiliser · {Escape} pour le ranger | first time an item is held, once |
| `caseFile.ui.clues` | Indices | section |
| `caseFile.ui.suspects` | Suspects | section |
| `caseFile.ui.questions` | Questions | section (filled in Week 9) |
| `caseFile.ui.alibi` | Alibi : {text} | suspect line |
| `caseFile.ui.checked` | vérifié | stamp after an alibi |
| `caseFile.ui.toCheck` | à vérifier | stamp |
| `caseFile.ui.none` | aucun | stamp |
| `caseFile.ui.new` | Nouvel indice : {clue} | toast |
| `caseFile.ui.updated` | Indice mis à jour : {clue} | toast |

**Engineering:** `{Tab}` is a new key token (`src/core/KeyLabels.js`; `keyNames.Tab: 'Tab'`). Mobile: the
pocket icon is the only way in.

### 1.3 The items table (`L.items.<id>`)

**Tools**

| id | French name | `def` | Description (`desc`) | Gained | Used / given |
|---|---|---|---|---|---|
| `keys` | Clés | les clés | Clé de l’appart, clé de la boîte aux lettres, et une troisième dont personne ne se souvient. | Ch1, the bowl by the door (`ch1.keys`) | Ch1 door (required). Ch6 bike-shop door: the mystery-key gag (`ch6.week6.keyRing.mystery`). |
| `phone` | Téléphone | le téléphone | Douze messages, zéro réponse. L’appareil photo, lui, ne demande rien. | Ch1, after reading the messages | PHOTO (Ch5 Weeks 2 and 3), the STRIDE segment (Ch5 Week 3), the bravo (Ch6 Week 9). Seeded in every chapter after Ch1. |
| `watch` | Montre | la montre | Elle compte. Elle ne sait pas quoi. | Ch1, the charger (worn: `au poignet`) | Worn. Ch7: hung on the nail (`item− watch`). |
| `pencil` | Crayon | le crayon | Un crayon de menuisier, taillé au couteau. Il écrit gros et il ne ment pas. | Ch4 Day 5, with the exercise book | The notebook (automatic). Ch7: Sami licks it. |
| `sandpaper` | Papier de verre | le papier de verre | Grain 80. Neuf couches de peinture l’attendent. Il ne le sait pas encore. | Ch4 Day 5, pegboard | Ch4 door (required; used up: `item− sandpaper`). |
| `tape` | Mètre ruban | le mètre | Cinq mètres. Il ment moins que les encadrements. | Ch4 Day 8, pegboard | Ch4 frame (required). Ch5 Week 3 bench (required). Odile lets him keep it. |
| `spokeKey` | Clé à rayons | la clé à rayons | Revenue propre. Elle sent la graisse de chaîne. Quelqu’un l’aime beaucoup. | Ch5 Week 4, pegboard | Ch5 Week 4 truing (required); hung back after (`ch5.week4.end`). Not in the pocket after Ch5: the Ch7 jobs predate items and need none. |
| `chalk` | Craie | la craie | Une craie de tailleur. Odile dit qu’une empreinte, ça se cerne. Elle l’a vu à la télé. | Ch5 Week 3, Odile | Ch5 Week 3 footprint (optional). |
| `keyRing` | Trousseau du proprio | le trousseau | Quatorze clés, aucune étiquette. Une seule a un ruban rouge. Bizarre. | Ch6 Week 6, Jo | Ch6 bike-shop door → KEY RING. Given back to Jo after the shop. |
| `thermos` | Thermos | le thermos | Soupe aux pois de la grand-mère de Jo. Trois heures du matin, encore brûlante. | Ch6 Week 9, Jo on the bench | STAKEOUT (held); given to Durand at the reveal (scripted). |

**Gifts**

| id | French name | `def` | Description | Gained | Given to (best → others) |
|---|---|---|---|---|---|
| `croissant` | Croissant (lune) | le croissant | Il voulait être un croissant. Il est devenu la lune. Il est encore chaud. | Ch5 Week 3, Mme Benali | **Jo** (`warmth+ joCroissant`), Odile, Sami, Gérard, Lou, Bastien, the sleeping old man. Lines in §1.4.3. |
| `rags` | Chiffons propres | les chiffons | Pliés en quatre. Ils sentent la graisse de chaîne. Une excuse, en coton. | Ch5 Week 2, Odile's bench (optional pick-up) | **Sami**, Odile; Durand at the Ch6 offer, if still held at the end of Ch5 (`ragsKept`, §1.5). |
| `kebab` | Kebab | le kebab | Salade, tomate, oignons, sauce blanche. Gérard dit « très bon ». Il est modeste. | Ch6 Week 6, Gérard | **Odile**, Jo, Sami (in the workshop after school, Week 6). Lou and Bastien aren't reachable once he has it. |
| `soup` | Soupe pour Odile | la soupe | De la part de Jo. Ce n’est pas de la pitié. C’est de la soupe. | Ch6 Week 6, Jo | **Odile** (scripted lines). Anyone else: the soup refusal. |

**Clues** (case tab; `L.caseFile.clues.<id>` = `{ name, note }`; `noteLater` replaces `note` when updated)

| id | Name | Case note | Shown | Board role |
|---|---|---|---|---|
| `cleanKey` | Clé à rayons rendue | Disparue trois jours. Revenue nettoyée, huilée, avec des chiffons pliés. Une effraction polie. | Ch5 Week 2, workshop | decoy |
| `photoHinge` | Photo : glissière huilée | Rideau de Mme Benali, huilé dans la nuit. Huile de chaîne, pas de cuisine. Treize ans de cris, terminés. | Ch5 Week 2, PHOTO | decoy |
| `slat52` | Lattes du banc : 52 cm | Trois lattes neuves. 52 cm ; les anciennes font 50. Coupées net : elles dépassent d’un centimètre de chaque côté. · `noteLater` (Ch6 Week 6): … Le gabarit de l’établi Durand est réglé à 52. | Ch5 Week 3, the bench | **Q2** |
| `blueChip` | Écaille de bleu | Sur la tranche des lattes. Un bleu passé, poudreux. Pas un bleu de magasin. · `noteLater`: … Dans la boutique, un pot ouvert : « Bleu Durand, 1979, O. M. » | Ch5 Week 3, the bench | support (Q2) |
| `slipperPrint` | Photo : empreinte | Sciure sur le seuil du 14. Une charentaise, pointure 44 au moins. Quelqu’un traverse la rue en pantoufles. | Ch5 Week 3, No. 14's doorstep (optional) | decoy (clears Mme Benali) |
| `louPhoto` | Photo de Lou, 3 h 04 | Publiée de sa fenêtre. Au bord, un flou sous le réverbère : casquette plate, vélo tenu à la main. | Ch5 Week 3, Lou (optional) | support (Q1) |
| `segmentD52` | Segment STRIDE : D.52 | Rue des Tanneurs, 380 m. Légende locale : D.52, 63 passages en 90 jours. Allure 1,8 km/h. Dernier passage à 03:12. | Ch5 Week 3, Bastien | **Q1** |
| `receipts` | Tickets de Gérard | La nuit du rideau : 43 tickets, lus dans l’ordre. N° 43, 1 h 58 : un thé sans sucre. « Le monsieur au vélo qui fait clic. » Il vient tous les soirs. Je lui ai servi le sien. Sans le regarder. | Ch6 Week 6, kebab counter | support (Q3) |
| `freewheelClick` | Note : un clic par tour | Cliquet de roue libre usé. Entendu dans la rue à 2 h 10. Le même que le vélo noir du vieux monsieur du banc. · Extra sentence if `mem.seeds.window`: Et sous ma fenêtre, la nuit du jour 3. | Ch6 Week 6, the walk home | **Q3** |
| `shopPhoto` | Photo, 1974 | CYCLES DURAND, l’année de l’ouverture. Un jeune homme, une casquette plate, un vélo noir. C’est le monsieur du banc. | Ch6 Week 6, bike shop | names Durand (adds his suspect pin) |

**Suspects** (case tab; `L.caseFile.suspects.<id>` = `{ name, why, alibi, status }`; statuses change as
noted)

| id | Name | Why (« Mobile ») | Alibi | Status |
|---|---|---|---|---|
| `sami` | Sami | Veut des outils. | Sa mère dort en travers de sa porte. | vérifié (Ch5 Week 3; Odile confirms) |
| `lou` | Lou | Dehors la nuit. De la peinture sur les mains. | Une photo publiée à 3 h 04, de sa fenêtre. | vérifié (if interviewed; else à vérifier) |
| `gerard` | Gérard | Ouvert jusqu’à 2 h. Dort quatre heures. | 43 tickets. | à vérifier → vérifié (Ch6 Week 6) |
| `benali` | Mme Benali | Debout à 4 h. Le rideau, c’est le sien. | Les croissants. J’ai aidé. | vérifié (Ch5 Week 3) |
| `bastien` | Bastien | Court à 5 h. Ne s’arrête jamais. | Ses données. Longuement. | vérifié (Ch5 Week 3) |
| `jo` | Jo | Travaille tard. Pinceaux fins. · Week 6 adds: A les clés de la boutique. | Un cerf-volant encore rouge, 3 h 07. | vérifié (Ch5 Week 3) |
| `hugo` | Moi (selon Odile) | Debout à 4 h. Une botte. Répare pour éviter les sentiments. | Aucun. Je dormais. Mal. | aucun |
| `oldman` → `durand` | Le vieux monsieur du banc → M. Durand | Dort sur les bancs le matin. Vélo noir. Casquette plate. · Week 6: 81 ans. Cinquante-deux ans de boutique. A gardé sa clé. | — | aucun |

The `hugo` pin uses **Sunday's race bib** (the one folded under the table leg in Ch1) as his photo. The
`oldman` pin appears after `ch5.week3.bench`; it is relabelled `durand` after `shopPhoto`.

**When pins appear:** `hugo` at `ch5.week2.workshop`; `benali` at dawn; `bastien`, `jo`, `lou`, `gerard` at their
Week 3 interviews; `sami` at 16 h. If the player skips Lou or Gérard, `ch5.week3.hubDone` pins them as « à
vérifier ». Gérard's is checked in Ch6 Week 6; Lou's can stay « à vérifier » (her wrong-accusation scene clears
her). The board therefore always has 8 pins.

### 1.4 Refusal lines (wrong item) and need lines

Spoken by Hugo (inner) on objects, or by the person on people. One line per try, drawn from the bag with no
repeat until the bag is empty. All voiced (about 40 lines). Keys: `L.items.refuse.*`.

#### 1.4.1 On objects, by item kind
- `refuse.object` (generic, any item, Hugo `think`):
  1. Ça ne marche pas comme ça.
  2. J’ai essayé dans ma tête. Ça ne marchait pas non plus.
  3. Non. Mesurer deux fois, essayer une seule.
  4. Ce n’est pas le bon outil. Mes mains le savent avant moi.
- `refuse.tool` (a tool on the wrong hotspot):
  1. Mauvais outil. Je le sais depuis mes quinze ans.
  2. On peut tout réparer avec n’importe quoi. Une fois.
- `refuse.gift` (a gift on an object):
  1. Un cadeau, ça se donne à quelqu’un. Pas à un meuble.
  2. Je ne vais pas offrir ça à une porte. Même grise.
- `refuse.clue` (dragging a clue onto a hotspot, Ch5–Ch6):
  1. C’est une pièce à conviction. On ne bricole pas avec.
  2. Les indices, ça va dans le cahier. Pas dans les serrures.

#### 1.4.2 On people, by character (any tool or gift they don't want)
- `refuse.odile` (pronoun-free on purpose: the bag can fire in Ch4 Day 5 before `book[3]`, when she still says
  vous):
  1. Qu’est-ce que j’en ferais ?
  2. Ça, sur sa silhouette. Pas sous mon nez.
  3. Si c’est un cadeau, c’est raté. Si c’est un outil, c’est pire.
- `refuse.sami`:
  1. C’est quoi ? Ça sert à quoi ? Ça se mange ?
  2. Je peux le garder ? Non ? Alors pourquoi tu me le montres ?
  3. Ma mère dit de rien prendre aux inconnus. T’es plus un inconnu, mais quand même.
- `refuse.jo`:
  1. Câline, c’est quoi, ça ? Une demande en mariage ?
  2. Garde ça. Si tu veux me faire un cadeau, apprends de quoi.
  3. Ben là. C’est gentil, mais non.
- `refuse.gerard`:
  1. Ça va pas dans un kebab. Alors je veux pas.
  2. Je prends les espèces, la carte, et les compliments. Pas ça.
- `refuse.benali`:
  1. C’est gentil, mais j’ai les mains dans la farine.
  2. Gardez-le, monsieur Revel. Vous en aurez plus besoin que moi.
- `refuse.lou`:
  1. Je peux le prendre en photo. C’est tout ce que je peux faire pour vous.
  2. Non merci. Je collectionne que les murs.
- `refuse.bastien`:
  1. Ça se connecte à STRIDE ? Non ? Alors je vois pas, mec.
  2. Je cours, la légende. J’ai pas de poches.
- `refuse.durand` (also used for `oldman`, who is asleep: then the line is the `asleep` variant):
  1. Gardez-le, jeune homme. À mon âge, on ne prend plus. On rend.
  2. C’est bien entretenu. Rangez-le quand même.
  - `asleep` (stage, not voiced): *Le vieux monsieur dort. Il ne veut rien. Il a l’air de quelqu’un qui a tout.*

#### 1.4.3 Item-specific lines (checked before the generic bags)
- `watch` on anything (STRIDE): buzz « AUCUNE ACTIVITÉ RECONNUE. » + thought: Elle ne reconnaît rien de ce
  que je fais, maintenant.
- `phone` on a person: think: Je pourrais l’appeler. Il est juste là.
- `keys` on any door but his: think: La clé mystère. Non. Pas celle-là non plus.
- `tape` on a person: think: Odile m’a appris à mesurer deux fois. Pas les gens.
- `soup` on anyone but Odile: think: C’est la soupe d’Odile. Jo me tuerait. Gentiment, mais
  elle me tuerait.
- **Croissant gifts** (`items.give.croissant.<who>`; the item is consumed):
  - `jo` (`warmth+ joCroissant`): jo: Une lune ? Pour moi ? Câline. Personne m’avait jamais donné la lune. ‖ delighted, then soft
  - `odile`: odile: Un croissant de lune. Elle progresse. ‖ dry
  - `sami`: sami: On dirait une banane. Merci.
  - `gerard`: gerard: Je mange pas la concurrence. ‖ then, after a beat (stage): *Il le mange quand même.*
  - `lou`: lou: Je le prends en photo d’abord. Ensuite, je le mange. C’est l’ordre.
  - `bastien`: bastien: Des glucides ? Mec, c’est pas un jour de sortie longue ! …Bon. Je le mange en courant. ‖ torn, then jogs off chewing
  - `oldman` (asleep): stage: *Hugo le pose à côté de lui, sur le banc.* + think: Il le trouvera en se réveillant. Il ne saura jamais d’où il vient. Moi non plus, pour ses lattes.
- **Rags gifts** (`items.give.rags.<who>`):
  - `sami`: sami: Ça sent le vélo. Trop bien. Je vais les sentir tout le temps. ‖ sincere
  - `odile`: odile: Mes chiffons. Pliés par quelqu’un d’autre. C’est presque vexant.
  - `durand` (Ch6 offer, only if `ragsKept`): durand: Ils sont à moi. Je les avais pliés en quatre. Odile les plie en trois. ‖ amused
- **Kebab gifts** (`items.give.kebab.<who>`):
  - `odile`: odile: Un kebab froid. Personne ne m’en avait jamais apporté. Pose-le là. ‖ then (stage): *Elle le mange en entier.*
  - `jo`: jo: T’es fin. Je l’ai pas mérité, mais je le mange pareil.
  - `sami`: sami: Un kebab d’hier ? …Donne.

#### 1.4.4 Need lines (a hotspot that needs an item the player doesn't have)
Keys live with each hotspot (`chN.needs.<hotspot>`) and are listed in the chapters. The pattern, from
DESIGN-R4: « Il faut une clé à rayons. Je sais exactement à quoi ça ressemble. Je n’en trouve pas. »

### 1.5 Pocket seeds per chapter (`L.items.atChapter[i]`)

| i | Chapter | Pocket at start | Gained in chapter | Lost in chapter |
|---|---|---|---|---|
| 0 | Ch1 | — | `keys`, `phone`, `watch` | — |
| 1 | Ch2 | `keys`, `phone`, `watch` | — | — |
| 2 | Ch3 | (hidden: flashback) | — | — |
| 3 | Ch4 | `keys`, `phone`, `watch` | `pencil`, `sandpaper`, `tape` | `sandpaper` (used up) |
| 4 | Ch5 | `keys`, `phone`, `watch`, `pencil`, `tape` | `rags`, `chalk`, `croissant`, `spokeKey` | `spokeKey` (hung back), gifts given. At the chapter end, `remember('ragsKept', true)` if `rags` is still held. |
| 5 | Ch6 | `keys`, `phone`, `watch`, `pencil`, `tape` (+ `rags` if `ragsKept`) | `kebab`, `soup`, `keyRing`, `thermos` | `keyRing` (back to Jo), `thermos` (to Durand), gifts given |
| 6 | Ch7 | `keys`, `phone`, `watch`, `pencil`, `tape` | — | `watch` (the nail) |

`rags` is the one gift that crosses a chapter: its only best-recipient line is Durand's, three chapters later.

---

## 2. Ch1 « Sans impact » (Jour 4, 21 h, the flat)

**Unchanged:** every existing `ch1` line, prompt, sign and buzz (DESIGN.md Ch1, R3.6 table seed).
**New:** the pocket (keys, phone, watch), a keys hotspot by the door, and the optional window seed.

- **Scene needs:** a small bowl (or a hook) on the shelf by the door with three keys; the window gets a
  hotspot (rain-streaked glass, the sodium lamp below). No new set.
- **Mood:** unchanged (hope 0.04 → 0.06 watch → 0.07 door).
- **Objectives:** `start` « Regarder autour de soi. » · `leave` « Aller marcher. » (unchanged).
- **Hotspots and prompts** (new ones in bold):

| Hotspot | Prompt | Required | Lines |
|---|---|---|---|
| tv / tvOff | Regarder / Éteindre | no | unchanged |
| phone | Lire les messages | no | unchanged, then `item+ phone` |
| watch | Prendre la montre | **yes** | unchanged, then `item+ watch` (worn) |
| xray, bike, bibs, table | Regarder / Caler la table | no | unchanged |
| **keys** | **Prendre les clés** | **yes** (the door needs them) | `ch1.keys` |
| **window** | **Regarder dehors** | no | `ch1.window` |
| door | Sortir | yes | unchanged, gated on `keys` (`ch1.needs.door`) |

#### `ch1.keys` · d.say (then `item+ keys`)
- think: Clé de l’appart. Clé de la boîte aux lettres. Et une troisième, dont personne ne se souvient. ‖ dry, mildly puzzled
- think: Je la garde. Un jour, une porte quelque part va se sentir bête.

#### `ch1.needs.door` · d.say (door before the keys)
- think: Les clés. Douze ans de vestiaires, et j’oublie encore les clés. ‖ self-mocking

#### `ch1.window` · d.say (optional; `remember('seeds.window', true)`)
- think: Hier, trois heures du matin. Je ne dormais pas, évidemment. ‖ flat, tired
- think: Quelqu’un poussait un vélo dans la rue. Clic. Clic. Clic. Pas pressé du tout. ‖ « Pas pressé du tout » echoes the hammer line; let the clics land
- think: Un clic par tour de roue. Un cliquet de roue libre fatigué. Je ne sais pas pourquoi je sais ça.
- think: Si. Je sais pourquoi. ‖ quiet

- **Pocket intro:** on the first `item+` (whichever of phone, watch, keys comes first): toast « + Téléphone »
  (etc.) and, once, the hint `hints.pocket` « {Tab} : la poche ». The watch shows the `au poignet` tag.
- **Audio:** the window seed has no sound (it's a memory). The clue sound is first *heard* in Ch3 (wordless)
  and Ch5.
- **Laugh lines (≥ 4):** the doctor's « petit footing », « J’ai dit que je coule. Il l’a noté. »,
  « purgé mes douze ans », the third key, « Douze ans de vestiaires ».

---

## 3. Ch2 « Ne t’arrête jamais » (Jour 4, evening, rain)

**Unchanged:** every existing `ch2` line. `signs.kebab` is already « CHEZ GÉRARD » (conversion agent).
**New:** Mme Benali's screaming shutter (seed for Ch5), and Jo's cameo at ENCRE FINE.

- **Scene needs:**
  - **Bakery shutter** (left side, z −6…−12): Mme Benali pulling the shutter down as Hugo passes, with a loud
    metal shriek (new SFX: a 1.6 s rolling scream; visual twin: the shutter judders down in three jerks).
  - **ENCRE FINE** in the empty unit on the left, across from CYCLES DURAND, beside the bench (about x −5.95,
    z −34…−38). Signs: `signs.jo` « ENCRE FINE », `signs.joSub` « TATOUAGE — TRAIT FIN ». Lit interior
    behind the glass (flash sheets, one chair). Jo on a stepladder with the fascia board, crooked by about 8°.
- **Mood:** unchanged (0.07 → 0.09 → 0.12). ENCRE FINE's window is the warmest light in the street before
  No. 14; it stays desaturated (no focus slot).
- **Beats** (into the existing `d.until` chain):
  - z < −6 `pauseBuzz` (unchanged).
  - **z < −9: the shutter** (non-blocking; once).
  - ghost sign, billboard, club (z < −24), shop (unchanged).
  - **z < −33, after the club beat: Jo** (blocking, short). Hugo is stopped by her call.
  - bench, arrival (z < −42), hold, after, nameOne, leaving (unchanged).

#### `ch2.shutter` · bark + thought (non-blocking, after the shriek)
- bark(Mme Benali): Pardon ! Il crie. Treize ans qu’il crie. ‖ apologetic, warm, raising her voice over the noise
- thought: Je rentrais de mes sorties sur ce cri. Six heures pile. Il me servait de ligne d’arrivée.

#### `ch2.jo.call` · d.say
- jo: Hey, le grand avec la botte ! C’est-tu droit ? ‖ loud, from up a ladder, cheerful; first line of a new voice

#### `ch2.jo.menu` · d.choose (who: 'Jo')
prompt: L’enseigne penche nettement à gauche.
1. [C’est de travers.] → reply(jo): Ben non. C’est parfait. · `warmth+ joSign`
2. [C’est parfait.] → reply(jo): Voyons donc. C’est tout croche.

#### `ch2.jo.after` · d.say
- stage: *Elle redresse l’enseigne d’un coup de paume, sans niveau, du premier coup.*
- jo: Tiguidou. ‖ satisfied, to herself
- jo: Belle botte. Très mode.
- hugo: C’est une botte médicale.
- jo: Ça empêche pas.
- hugo: Vous ouvrez quand ?
- jo: Tu. On est pas à la banque. Lundi. ‖ a grin, not a correction
- stage: *Elle descend de l’échelle et rentre. La porte claque.*
- think: Encre fine. Je ne savais même pas qu’il y avait une boutique, là. Je passais devant à quinze kilomètres-heure.

- **Memory:** `remember('joSign', true)` on option 1 (it is the Ch2-owned warmth flag, §11.2).
- **Pacing:** +0:25 (the cameo is 9 lines and one menu). Cut first if Ch2 runs long: `jo.after[3..4]` (« C’est
  une botte médicale. » / « Ça empêche pas. »).
- **Laugh lines:** « aggressive sitting », « Les S, c’est personnel », « Le mien est un crime », « Hugues »,
  « Ça empêche pas. », « Tu. On est pas à la banque. »

---

## 4. Ch3 « À la longue » (flashback)

**Unchanged.** No text changes, no new keys.

- **One wordless seed (optional, art and audio):** Week 31 (« SAMEDI, 4 H 47 »), between the 10 m and 30 m
  thoughts: on the far kerb, an old man in a flat cap and a brown cardigan pushes a black bike the other way.
  Its freewheel clicks once per wheel turn (the clue sound, 0.4 s apart at walking pace, panned far). Hugo
  doesn't turn his head; the camera doesn't either. No line, no hotspot. It pays off in `ch6.week9.reveal`:
  « Vous ne m’avez jamais vu. Vous regardiez votre montre. »
- The freewheel click SFX (new, shared): a dry ratchet tick, 2.4 kHz centred, 25 ms, with a softer second tick
  12 ms later. Visual twin wherever it carries information: the case note and a small « clic » caption in the
  STAKEOUT.

---

## 5. Ch4 « Mesurer deux fois » (Jour 5, Jour 8, the workshop)

**Unchanged:** every Day 5 and Day 8 line, minigame and memory write (DESIGN.md Ch4, R3.2, R3.3).
**Moved out:** Week 4 → Ch5 (§6.4), Week 7 → Ch6 (§7.3). `ch4.cards` keeps only `day5` and `day8`.
**New:** the pencil, sandpaper and tape as items; the hook at the end of Day 8.

- **Mood:** 0.12 → 0.2 (sanding) → 0.35 (grey door). Unchanged. The chapter now ends on the door's grey.
- **Objectives:** `day5` « Prendre le papier de verre. » · `sand` « Poncer la porte. » · `day8` « Mesurer
  l’encadrement. » · **new** `day8Tape` « Prendre le mètre. » · **new** `hook` « Ranger le mètre. »
- **Hotspots:**

| Day | Hotspot | Prompt | Item | Lines |
|---|---|---|---|---|
| 5 | pegboard | Prendre le papier de verre | `item+ sandpaper` | `day5.pegboard` (unchanged) |
| 5 | door | Poncer | needs `sandpaper` (auto) | `day5.grain` → SANDING; then `item− sandpaper` |
| 5/8 | oldSigns, radio | Regarder / Écouter | — | unchanged |
| 8 | **pegboard** | **Prendre le mètre** | `item+ tape` | `day8.tapeTake` |
| 8 | frame | Mesurer | needs `tape` (auto) | `day8.tape` (unchanged) |
| 8 | **pegboard** (after the grey) | **Ranger le mètre** | — | `day8.hook` |

- **Day 5, the book:** `day5.book[0]` (« Elle lui tend un crayon et un cahier d’écolier. ») now also gives
  `item+ pencil`. On the first held item (the sandpaper, if the player opens the pocket) show `hints.useItem`
  once.

#### `ch4.needs.door` · d.say (door before the sandpaper)
- think: Poncer à mains nues. J’ai connu des stages de préparation plus doux. ‖ dry

#### `ch4.day8.tapeTake` · d.say (pegboard, Day 8)
- think: Le mètre a sa silhouette, lui aussi. Si je le prends, ça se verra. C’est le principe. ‖ plants the hook's empty outline

#### `ch4.needs.frame` · d.say (frame before the tape)
- think: Mesurer à l’œil. Odile me tuerait. Deux fois. ‖ the « Deux fois » is the joke; small beat before it

#### `ch4.day8.hook` · d.say (after `painted`; objective `hook`; Hugo at the pegboard)
- odile: Garde-le. Quelqu’un qui mesure deux fois a droit à son mètre. ‖ off-hand, from the bench; it is a gift and she would deny it
- stage: *Sur le tableau, juste à côté de la place du mètre, une silhouette vide. Une clé à rayons.*
- hugo: Il manque la clé à rayons.
- odile: Je sais.
- odile: Quelqu’un m’a emprunté ma clé à rayons. Personne n’emprunte chez moi. Les gens ont peur de moi. J’y ai beaucoup travaillé. ‖ R4 line; deadpan pride on the last sentence
- hugo: Ça se voit.
- odile: Merci. ‖ genuinely pleased
- think: Une silhouette vide. Ce soir-là, je n’ai pas dormi. Rien de nouveau. Mais pour une fois, je ne pensais pas à ma jambe. ‖ the chapter's last line; let it sit

- `item+ tape` stays in the pocket (`ch4.day8.hook[0]`); the pocket for Ch5 is seeded with it.
- **End:** fade to black on the empty outline, then the Ch5 title card.
- **Pacing:** Day 5 ~1:35, Day 8 ~1:55, hook 0:25 → **~3:55** main (was 4:55 with Weeks 4 and 7).
- **Laugh lines:** « Votre chaussure. », « tatouage », « cinquante millions de
  fois », « aviron », « salle d’attente », « flan », « Ça se voit. / Merci. »

---

## 6. Ch5 « Qui a huilé le rideau ? » (Semaines 2, 3, 4) — NEW

`L.ch5.title`: « Qui a huilé le rideau ? »

- **Scenes:**
  - **Street by day** (`buildScene2(ctx, {variant: 'day'})`, new variant): the Ch2 street, rain off, wet 0.4,
    flat overcast. The STRIDE billboard is still up. Bakery shutter (now silent), CHEZ GÉRARD with its pink
    neon **flickering** (Weeks 2–5), ENCRE FINE open (lit, flash sheets, faint tattoo-machine buzz when near),
    CYCLES DURAND shuttered with its card, the bench (Week 3: three new blue slats), No. 14's garage door
    half-open. Lou's window: 4th floor above CHEZ GÉRARD.
  - **Workshop** (`scene4`), as in Ch4. Ch5 opens here.
  - **The bakery at 4 a.m.** (Week 3 opener): the street at night (as built: the `'night'` variant, no rain; the
    bakery lit with `bakery.setLit(true)`, shot `croissant`), the bakery shutter half up (`bakery.setOpen(0.5)`), its window glow `#ffc98a`, and a floured board on a trestle just inside, lit by the
    bakery (the CROISSANT close shot). Mme Benali in an apron and **tiny charentaises**.
- **Characters on set:** Odile, Sami (Week 3 at 16 h, Week 4), Mme Benali, Gérard, Lou, Bastien (Week 3,
  jogging on the spot by the billboard), Jo, **the old man** (Week 3 only: asleep on the bench with a flat cap,
  brown cardigan, a black bike leaning on the armrest).
- **Mood / hope:** 0.35 (the grey door) → 0.36 (first photo) → 0.38 (croissant) → 0.4 (puncture) → 0.42
  (truing) → 0.5 (the laugh). The things he makes take local colour (material lerps, as the Ch7 jobs): the
  croissant (golden), Sami's patched tube (the patch orange), the trued wheel (focus slot 1, as before).
- **Watch:** `0,0 km` · `COURSE · SEMAINE` (`L.watch.atChapter[4]`).
- **Notebook seed** (`L.notebook.atChapter[4]`): Rouler. (barré) · Courir. (barré) · Ne pas bouger. · Poncer dans
  le sens du fil. · Mesurer deux fois. · Faire un gris pas triste.
- **Case tab:** opens in Week 2 (`ch5.week2.workshop`), empty until then.

**Cards and objectives**

| Key | French |
|---|---|
| `cards.week2` | Semaine 2. |
| `cards.week3` | Semaine 3. |
| `captions.dawn` | SAMEDI, 4 H 10 |
| `captions.morning` | 10 H |
| `captions.afternoon` | 16 H |
| `cards.week4` | Semaine 4. (moved from `ch4.cards.week4`) |
| `objectives.benali` | Voir Mme Benali. |
| `objectives.photo` | Photographier la glissière. |
| `objectives.bakery` | Aller à la boulangerie. |
| `objectives.bench` | Mesurer le banc. |
| `objectives.street` | Interroger la rue. |
| `objectives.sami` | Aider Sami. |
| `objectives.week4` | Regarder le vélo. (moved) |
| `objectives.spokeKey` | Prendre la clé à rayons. |
| `objectives.hangKey` | Ranger la clé à rayons. |

### 6.1 Week 2: the case opens (workshop → street)

Hugo starts **in the workshop** (editor's reorder: the writer's version walked him down the street to the
workshop and back up to the bakery, about 40 m twice in a boot). Ch4 ends on the empty outline; Ch5 opens on the
same pegboard with the key back in it.

#### `ch5.week2.workshop` · d.say (at spawn; required)
- stage: *Sur le tableau, la clé à rayons est revenue dans sa silhouette. Propre. Huilée. À côté, un sac de chiffons pliés en quatre.*
- odile: Ma clé est revenue cette nuit. Avec des chiffons pliés. Comme une excuse.
- hugo: C’est plutôt une bonne nouvelle.
- odile: C’est une effraction avec de bonnes manières. ‖ dry; a laugh line
- odile: Et madame Benali a appelé trois fois. Son rideau ne crie plus. Elle dit que la rue ne sait plus l’heure.
- stage: *Elle le regarde longuement. Puis la botte. Puis lui.*
- odile: Tu te lèves à quatre heures. Tu descends l’escalier comme une armoire, et maintenant l’armoire a une botte. Et tu as la tête d’un homme qui répare des choses pour éviter les sentiments. ‖ R4 line; three counts, measured. The armoire is her own Ch2 image (« comme une armoire qu’on aurait lâchée »); Durand reuses it at the reveal
- hugo: …Deux sur trois.
- odile: Lesquels ?
- hugo: Je préfère ne pas le dire. ‖ a dodge, almost a smile
- odile: Bon. Si c’est pas toi, trouve qui c’est. Tu comptes tout. Compte ça.
- stage: *Il retourne le cahier et commence par la fin, comme à l’école.*
- `caseFile.open()`: the back page gets the heading « L’AFFAIRE » (pencil write-on); `clue+ cleanKey`; suspect pin `hugo` (« Moi (selon Odile) »).
- odile: Commence par madame Benali. Avant qu’elle rappelle.
- objective → `benali`.

#### `ch5.week2.neon` · bark (non-blocking, once, on the way up the street, within 4.5 m of CHEZ GÉRARD)
- bark(Gérard): Le rideau de madame Benali, quelqu’un l’a huilé. Mon néon, personne y touche. Il clignote, c’est voulu. ‖ pre-emptive, proud; the setup for Ch6 Week 6

(The writer's `ch5.week2.pass` bark for Mme Benali is cut: it told her block's joke before her block did.)

- **Optional hotspots in the workshop (Week 2):**
  - **rags** (« Prendre les chiffons »): `item+ rags` + think: Pliés en quatre. Quelqu’un a plié des chiffons pour s’excuser. Je ne sais pas si c’est inquiétant ou très bien élevé.
  - **radio** (`ch4.prompts.radio`, « Écouter »), Week 2 line `ch5.week2.radio` · d.say:
    - radio: …le brochet, voyez-vous, ne vole jamais rien. Il emprunte. Et il rapporte, quand il a fini… ‖ radio delivery, the fishing man, slow and certain
    - odile: Même le monsieur de la pêche a une théorie.

#### `ch5.week2.benali` · d.say (bakery front; required)
- benali: Monsieur Revel ! Vous avez entendu ?
- hugo: Entendu quoi ?
- benali: Rien. Justement. Treize ans qu’il crie, ce rideau. Ce matin, il est monté comme… comme un rideau. ‖ bewildered, searching for the word
- benali: Quelqu’un l’a huilé pendant la nuit. Je ne sais pas si je dois dire merci ou appeler la police.
- think: Ça sent la graisse de chaîne. Je connais cette odeur mieux que celle du café.
- benali: Prenez-le en photo. Personne ne va me croire.
- objective → `photo`. Hotspot **shutterRunner** (« Photographier »; needs `phone`, auto) → **PHOTO** (§6.5.1, target `hinge`).

#### `ch5.week2.photoDone` · d.say (after PHOTO)
- benali: Voilà. Maintenant, j’ai une preuve. De quoi, je ne sais pas. ‖ satisfied, then puzzled
- think: Une photo nette. Ça ne va pas sur la liste. C’est le téléphone qui sait faire, pas moi.
- `clue+ photoHinge` · `hope → 0.36` (no notebook entry, §0.4.12)

#### `ch5.week2.end` · thought (walking away; then fade to the Week 3 card)
- thought: Un rideau huilé. Une clé rendue propre. Quelqu’un répare la rue la nuit. Et le pire, c’est que je suis jaloux.

### 6.2 Week 3, 4 h 10: the bakery (CROISSANT)

Card « Semaine 3. », caption « SAMEDI, 4 H 10 ». Hugo on the pavement at z −18, night (not at No. 14's door:
the walk is one thought long, not two). Objective `bakery`.

#### `ch5.week3.dawn` · thought (non-blocking, at spawn) and d.say (at the bakery)
- thought: Quatre heures dix. La jambe est cassée. Le réveil, lui, va très bien. ‖ the writer's « le corps n’est pas au courant » was told twice in thirty seconds; Hugo's spoken answer to Mme Benali now carries the joke
- thought (2 s after the first): La seule autre lumière allumée, c’est la boulangerie. Avant, je la battais tous les matins. ‖ echo of Ch3; wistful

#### `ch5.week3.benali` · d.say (bakery; required)
- benali: Monsieur Revel. À quatre heures. Vous ne courez plus, pourtant. ‖ surprised, kind
- hugo: Mes jambes n’ont pas lu l’ordonnance.
- benali: Si vous venez me demander où j’étais la nuit du rideau, j’étais ici. Comme toutes les nuits depuis vingt ans.
- benali: Et puisque vous êtes là, vous allez m’aider. Lavez-vous les mains. ‖ serene, not a request
- stage: *Elle porte des charentaises. Minuscules.*
- benali: Trente-six. J’ai de tout petits pieds. C’est mon seul défaut. ‖ she noticed him looking; amused
- → **CROISSANT** (§6.5.3).

#### `ch5.week3.benaliAfter` · d.say
- (Benali's end tier line from `games.croissant.tiers`)
- benali: Voilà mon alibi. Six fournées par nuit. Vous voudriez, en plus, que j’huile des rideaux ?
- benali: Prenez celui-là. Le plus lunaire. Il est à vous. ‖ `item+ croissant`; she always hands him his worst one, so it is a moon whatever the tier
- benali: Et écrivez-le. Odile m’a parlé de votre cahier.
- `note+ croissant` (« Rouler un croissant. »)
- stage: *Il réfléchit, puis ajoute un mot.*
- `noteAnn croissant` (« (lune) ») · suspect `benali` → vérifié · `hope → 0.38`

### 6.3 Week 3, 10 h: the street hub (interviews, the bench, the footprint)

Caption « 10 H ». Hugo in the workshop.

#### `ch5.week3.brief` · d.say (workshop; required)
- odile: Le banc mouillé, au bout de la rue. Trois lattes neuves, cette nuit. Va mesurer. Deux fois.
- odile: Et prends ma craie. Il y a une empreinte sur mon seuil. Une empreinte, ça se cerne à la craie. Je l’ai vu à la télé. ‖ `item+ chalk`
- hugo: Une empreinte de quoi ?
- odile: De pantoufle. Le crime porte des pantoufles. ‖ deadpan
- objective → `street` and `bench` (both shown; the pointer targets the required hotspots).

**Hub rules.** Required: **bench**, **Bastien**, **Jo**. Optional (ringed, pointer ignores them): **Lou**,
**Gérard**, **the footprint**, the workshop radio. Each interview adds or updates its suspect pin. When the
three required ones are done, Hugo's thought `ch5.week3.hubDone` plays, then the caption « 16 H » and Sami.

| Hotspot | Where | Prompt | Required | Block |
|---|---|---|---|---|
| bench | the bench, z −36.5 | Mesurer | yes (needs `tape`, auto) | `ch5.week3.bench` |
| bastien | by the billboard, jogging on the spot | Parler | yes | `ch5.week3.bastien` |
| jo | ENCRE FINE door | Entrer | yes | `ch5.week3.jo` |
| lou | the kerb outside CHEZ GÉRARD | Parler | no | `ch5.week3.lou` |
| gerard | CHEZ GÉRARD counter window | Parler | no | `ch5.week3.gerard` |
| print | No. 14 doorstep | Regarder l’empreinte | no | `ch5.week3.print` |
| printChalk | (after `print`) | Cerner à la craie | no (needs `chalk`) | then PHOTO |
| oldman | the end of the bench, asleep (until `bench` plays) | Regarder | no | `ch5.week3.oldmanLook`; also the croissant's sleeping recipient |

#### `ch5.week3.oldmanLook` · d.say (optional, before `bench`)
- think: Un vieux monsieur dort au bout du banc, la casquette sur les yeux. De la sciure sur les manches de son gilet. ‖ a fair-play tell, played flat

#### `ch5.week3.bench` · d.say (required)
- stage: *Trois lattes neuves, peintes en bleu. Au bout du banc, un vieux monsieur dort, la casquette sur les yeux. Un vélo noir est appuyé contre l’accoudoir.*
- hugo: Cinquante-deux. ‖ muttered, reading the tape
- hugo: …Cinquante-deux. ‖ the second reading; echo of « Mesure deux fois »
- think: Les anciennes font cinquante. Quelqu’un a coupé les neuves à cinquante-deux, pour qu’elles dépassent d’un centimètre de chaque côté. Exprès. Proprement.
- think: Et sur la tranche, un bleu. Pas un bleu de magasin. ‖ `clue+ slat52` · `clue+ blueChip`
- oldman: Elles sont droites, hein. ‖ waking slowly; an old, unhurried voice; first line of the new voice
- hugo: Très droites.
- oldman: À mon âge, on remarque ce qui est droit. Le reste, on a renoncé.
- hugo: Vous les avez vues arriver ?
- oldman: Moi ? Je dors. Je dors très bien, le matin. C’est la nuit que ça se gâte. ‖ a fair-play tell; light, not sad
- stage: *Il se lève, prend son vélo par le guidon et s’en va à pied. La roue arrière fait clic. Clic. Clic.*
- think: Un cliquet de roue libre usé. Je pourrais le réparer les yeux fermés. ‖ he doesn't connect it yet
- suspect pin `oldman` (« Le vieux monsieur du banc ») is added.

#### `ch5.week3.bastien` · d.say (required)
- bastien: HUGO ! La légende ! Alors, ce tibia ? ‖ jogging on the spot throughout; slightly out of breath
- hugo: Il se repose. Tu cours à quelle heure, le matin ?
- bastien: Cinq heures pile. Pourquoi ? Tu reviens ?! ‖ hopeful
- hugo: Quelqu’un répare la rue la nuit.
- bastien: Et tu me soupçonnes ? Ha ! Mec. Regarde. ‖ he turns his wrist to Hugo's face
- bastien: La nuit du rideau ? Jeudi, départ cinq heures zéro deux. Fréquence cardiaque, cent quarante-deux. Cadence, cent quatre-vingt-quatre. Dénivelé, huit mètres. Pas une seule pause. Les données, ça ment pas, mon pote. ‖ at length, proud, a recital
- bastien: Par contre. ‖ suddenly sour
- bastien: Tu connais le segment de la rue des Tanneurs ? Je suis deuxième. DEUXIÈME. Derrière un type qui le fait à un virgule huit kilomètre-heure. ‖ outraged
- stage: *Hugo ouvre STRIDE sur son téléphone. Pour la première fois depuis le dimanche.*
- **STRIDE segment screen** (`ch5.week3.segment`, UI, not voiced; shown on the phone close-up for 4 s or until {KeyE}):

  | Key | French |
  |---|---|
  | `title` | SEGMENT |
  | `name` | Rue des Tanneurs · 380 m |
  | `legendLabel` | LÉGENDE LOCALE |
  | `legend` | D.52 |
  | `legendStat` | 63 passages en 90 jours |
  | `lastLabel` | Dernier passage |
  | `last` | 03:12 |
  | `paceLabel` | Allure moy. |
  | `pace` | 1,8 km/h |
  | `second` | 2. Bastien_RUN · 58 passages |
  | `you` | Toi : aucun passage récent. On s’y remet ? |

- think: Quelqu’un remonte cette rue à pied à trois heures du matin, à l’allure d’un frigo fatigué. Toutes les nuits. ‖ R4 line
- think: Ça, c’est un plan d’entraînement. ‖ `clue+ segmentD52`
- bastien: Ha ! Si tu le trouves, dis-lui que c’est pas une allure, ça. C’est une sieste. ‖ jogs off
- suspect `bastien` → vérifié

#### `ch5.week3.jo` · d.say (required; inside ENCRE FINE, tattoo-machine buzz low under it)
- jo: Le grand avec la botte ! Entre. Touche à rien, sauf au café. ‖ warm, loud, already pouring
- hugo: Je fais une sorte d’enquête.
- jo: Laisse-moi deviner. Le rideau de madame Benali ? Toute la rue en jase. ‖ amused
- jo: Vas-y, interroge-moi. On m’a jamais interrogée. C’est le fun.
- hugo: La nuit du rideau, vers trois heures, t’étais où ?
- jo: Ici. Avec Karim. Un chum.
- hugo: Un… chum.
- jo: Un ami. Pas mon chum chum. Relaxe, le grand. ‖ flirty; she noticed the pause. In Québec « mon chum » is a boyfriend and « un chum » a friend: the doubled word is how a Montrealer clears that up, and a player from France gets it from « Un ami »
- stage: *Elle tourne son écran vers lui. Un avant-bras d’homme, un petit cerf-volant au trait fin, encore rouge. Photo prise à 3 h 07.*
- jo: Trois heures sept. Quatre heures de travail. Il a pleuré deux fois. Moi, zéro.
- think: Alibi : un cerf-volant encore rouge. On ne fait pas plus frais. ‖ suspect `jo` → vérifié
- stage: *Elle remonte sa manche. L’avant-bras est couvert de traits fins : une fougère, un fouet, un engrenage, une petite règle. Un mètre ruban fait le tour du poignet.*
- jo: Chaque tattoo, c’est quelque chose que j’ai appris. Le fouet, c’est l’année où j’ai réussi la tourtière de ma grand-mère. L’engrenage, c’est le char manuel. La règle, c’est le premier pochoir que j’ai pas recommencé. ‖ fond, proud, unhurried; the heart of her character
- jo: Pis toi ? T’as appris quoi, dernièrement ?

#### `ch5.week3.joMenu` · d.choose (who: 'Jo')
prompt: Elle attend. Elle a vraiment l’air de vouloir savoir.
1. [Deux cent douze kilomètres en une semaine.] → reply(jo): Deux cent douze ? Ok. Pis ? Tu sais faire quoi d’autre ? ‖ unimpressed, not unkind
2. [À faire un gris pas triste.] → reply(jo): Un gris pas triste. Câline. Ça, c’est une affaire. · `warmth+ joLearned`
3. [À rouler un croissant. Il est sorti en lune.] → reply(jo): T’as fait des croissants avec madame Benali à quatre heures du matin ? Ben là. T’es pas mal plus intéressant que t’en as l’air. · `warmth+ joLearned`

#### `ch5.week3.joAfter` · d.say
- jo: Reviens quand tu veux. Pas pour l’enquête. ‖ light, a wink in the voice

#### `ch5.week3.lou` · d.say (optional)
- lou: Si c’est pour le rideau, c’est pas moi. Je suis pas du genre à réparer. ‖ deadpan, eyes on her phone
- hugo: Tu sors la nuit.
- lou: Je sors pas. Je photographie la rue depuis ma fenêtre. Pour mon compte.
- stage: *Elle tourne son téléphone vers lui. La rue mouillée, la nuit. Publiée à 3 h 04, la nuit du rideau.*
- lou: Trois heures quatre. Publiée de chez moi. Quatre cent douze vues. Dont ma mère, onze fois.
- hugo: Il y a quelqu’un, au bord. Flou.
- lou: C’est le flou. Le flou, c’est artistique.
- think: Une silhouette sous le réverbère. Une casquette plate. Un vélo tenu à la main. ‖ `clue+ louPhoto` · suspect `lou` → vérifié
- lou: Vous pouvez vous abonner. C’est gratuit.

#### `ch5.week3.gerard` · d.say (optional; the neon flickers through it)
- gerard: Si c’est pour le néon, il marche très bien. ‖ defensive before Hugo speaks
- hugo: Il clignote.
- gerard: Exprès. C’est l’ambiance. ‖ proud
- hugo: La nuit du rideau, vers trois heures, t’étais où ?
- gerard: Ici. Je ferme à deux heures, je nettoie, je dors. Quatre heures. De cinq à neuf.
- gerard: J’ai des tickets. Quarante-trois. Je peux te les lire. Dans l’ordre.
- hugo: Pas maintenant.
- gerard: Reviens un soir, alors. Tu verras si j’ai le temps de huiler des rideaux. ‖ suspect `gerard` → à vérifier (sets up Ch6)

#### `ch5.week3.print` · d.say (optional; No. 14 doorstep)
- think: De la sciure, sur le seuil du 14. Une empreinte. Semelle lisse, à petits carreaux.
- think: Une charentaise. Pointure quarante-quatre, au moins. Quelqu’un a traversé la rue en pantoufles, cette nuit.
- Then the hotspot becomes **printChalk** (« Cerner à la craie », needs `chalk`): stage: *Il trace un trait de craie autour de l’empreinte. Odile serait fière. Elle ne le dira pas.* → **PHOTO** (§6.5.1, target `print`) → `clue+ slipperPrint`.
- Without the chalk: `ch5.needs.printChalk`: think: La craie d’abord. Odile y tient. La télé aussi.

#### `ch5.week3.hubDone` · thought (when bench, Bastien and Jo are done)
- thought: Un banc à cinquante-deux. Un inconnu qui marche à un virgule huit. Et un monsieur qui dort sur les bancs. J’ai connu des samedis moins remplis.
- Pins Lou and Gérard as « à vérifier » if their interviews were skipped (§1.3).

### 6.4 Week 3, 16 h: Sami's puncture, and the wrap

Caption « 16 H ». Workshop. Objective `sami`.

#### `ch5.week3.sami` · d.say (required)
- sami: Odile ! J’ai crevé. Encore. C’est la troisième fois. ‖ upset, out of breath, holding a wheel
- odile: Le bonhomme, là. Il s’ennuie. ‖ without looking up
- sami: Il sait faire, lui ?
- hugo: Trouver un trou, je sais faire.
- hugo: La nuit où le rideau de madame Benali a été huilé, t’étais où ?
- sami: Au lit. Ma mère dort en travers de ma porte. Genre, en travers. ‖ literal
- odile: C’est vrai. Sa mère fait plus peur que moi. ‖ a rare compliment, to somebody else
- sami: Pourquoi ?
- hugo: Quelqu’un répare des choses la nuit.
- sami: C’est pas moi. Moi, je casse. ‖ honest; suspect `sami` → vérifié
- → **PUNCTURE** (§6.5.2).

#### `ch5.week3.samiAfter` · d.say
- (Sami's tier line from `games.puncture.tiers`)
- sami: La prochaine fois, je peux le faire tout seul ?
- hugo: La prochaine fois, c’est toi qui le fais.
- sami: Alors les crevaisons, c’est moi. ‖ proud; echoes Ch7 « Les crevaisons, c’est moi. »
- odile: Écris-le. ‖ to Hugo
- `note+ puncture` (« Trouver une crevaison. ») · `hope → 0.4`

#### `ch5.week3.wrap` · d.say (straight after `samiAfter`, same shot; no fade)
- odile: Alors, l’inspecteur ?
- hugo: Des alibis. Un banc à cinquante-deux. Un inconnu qui marche à un virgule huit. Et une écaille de bleu.
- stage: *Odile prend l’écaille, la tourne longtemps entre ses doigts. Puis elle la rend sans un mot.* ‖ fair play: she recognises her own paint (§0.4.7); play it neutral
- odile: J’ai connu des enquêtes plus brillantes. Celle du monsieur de la pêche, par exemple.
- radio: …car le poisson, mes amis, fait des boucles. Le pêcheur patient n’a qu’à attendre qu’il repasse… ‖ radio delivery
- odile: Tu vois. Lui, il avance.

### 6.5 Ch5 minigames (UI text)

Shared game text lives in `L.games.<id>` (common); scene-specific lines are in `L.ch5`.

#### 6.5.1 PHOTO (`games.photo`; Week 2 hinge, Week 3 footprint)
- **Mechanic:** mouse aims the phone, the wheel zooms, hold the button to focus (0.5 s), release to shoot.
  Scored on framing (the target in the inner box) and focus. Three tries, then auto-frame.
- **UI:**

  | Key | French |
  |---|---|
  | `hint` | Viser à la souris · molette : zoom · maintenir le clic pour la mise au point, relâcher pour prendre la photo |
  | `gauge` | NETTETÉ |
  | `focus.sharp` / `focus.soft` | NET / FLOU |
  | `counter` | Photo {n}/3 |

- **Feedback after each shot** (Hugo, non-blocking thought, bag per fault):
  - `blurry`: Floue. J’ai bougé. Je ne bouge jamais, d’habitude. · Floue. Le téléphone a fait la mise au point sur mon pouce.
  - `offFrame`: Superbe photo du trottoir. · J’ai photographié le ciel. Il n’a rien huilé, lui.
  - `tooFar`: On voit la rue. On ne voit pas l’indice. On voit surtout la rue.
- **Success** (blocking think, by target):
  - `good.hinge`: Nette. La glissière brille comme une chaîne neuve.
  - `good.print`: Nette. Une pantoufle en gros plan. Ma carrière d’enquêteur démarre fort.
- **Assist** (after 3 tries, or 15 s idle): stage `assist`: *Le téléphone fait la mise au point tout seul. Il a l’air soulagé.* → auto-shot, counts as good.
- **Skip:** a good shot. **Memory:** none (the clue is the record).

#### 6.5.2 PUNCTURE (`games.puncture`; Week 3, Sami's tube)
- **Mechanic:** drag the inflated tube slowly through a water bucket; a thin chain of bubbles shows the hole;
  click on it (a chalk cross appears); hold the button to press the patch for a count (the bar fills in 3 s).
- **UI:**

  | Key | French |
  |---|---|
  | `hint.dunk` | Glisser la chambre à air dans l’eau, lentement |
  | `hint.mark` | Cliquer là où ça fait des bulles |
  | `hint.patch` | Maintenir le clic pour appuyer la rustine |
  | `steps.sand` | Poncer autour du trou |
  | `steps.glue` | Maintenir pour encoller, relâcher à temps |
  | `steps.press` | Appuyer la rustine |
  | `gauge` | APPUI |

  (`steps.*` are the built module's three patch steps, `src/story/games/puncture.js`.)

- **Sami's barks** (`barks.*`, `bark(Sami)`, at most one per 4 s):
  - `fast`: Doucement, tu vas la noyer. · Ça fait des bulles ! Non. C’est toi qui fais des bulles.
  - `wrong`: C’est pas là. Là, c’est de l’eau.
  - `found`: Là ! Le petit chapelet !
  - `glue`: Attends que ça sèche. Monsieur Durand dit que c’est là que tout le monde rate.
  - `patch`: Appuie ! Monsieur Durand compte jusqu’à trente. Moi, je compte vite. ‖ the press bar fills in 3 s; Sami's speed is the joke
  - `oldPatch` (once, on the first dunk; flavour, fair play for Durand the craftsman): Ça, c’est une vieille rustine. C’est monsieur Durand qui l’a mise. Il les coupe en ovale, à la main.
- **Hugo** (`afterPatch`, thought, once, after `patch`): Trente secondes. Mon premier mécano disait pareil. Les vieux mécanos comptent tous.
- **Assist:** the bubbles grow every 5 s idle; at 15 s, Sami: `barks.assist` « Ça fait des grosses bulles, là. Même moi je vois. » and the hole pulses.
- **Tiers** (`games.puncture.tiers`, Sami, by time to find the hole: < 8 s / < 20 s / else):
  - `good`: T’as trouvé en deux secondes. Comment t’as fait ?
  - `middle`: Trouvé. Moi aussi j’aurais trouvé. Après.
  - `poor`: Trouvé. Le seau a eu peur.
- **Skip:** patched, tier middle.

#### 6.5.3 CROISSANT (`games.croissant`; Week 3, 4 h 10)
- **Mechanic:** **three** triangles of dough (the built module's default `count = 3`; was six, cut for pacing).
  For each: **roll** (one straight drag from the wide end to the tip, in one stroke, as built) then **fold** (drag the two ends
  down into a crescent). Timing: each gesture 0.6–1.4 s is good. Mme Benali calls each step and grades each
  croissant.
- **UI:**

  | Key | French |
  |---|---|
  | `hint` | Rouler : glisser du côté large vers la pointe, d’un seul geste · Plier : glisser les deux bouts vers le bas |
  | `cue.roll` | Rouler ! |
  | `cue.fold` | Plier ! |
  | `counter` | Croissant {n}/3 |

- **Per-croissant grade** (`grades.*`, `bark(Mme Benali)`):
  - `perfect`: Ça, c’est un croissant.
  - `ok`: Un croissant de lune. Il fera l’affaire.
  - `moon`: C’est une lune. Encore une. · Pleine lune, celle-là. Elle n’est même plus croissante.
  - `fast`: Doucement. La pâte n’est pas en retard.
  - `slow`: Vous la réchauffez avec les mains. Elle n’aime pas ça.
- **STRIDE** (mid-way, once): buzz (`buzz`) « PÉTRISSAGE DÉTECTÉ. LANCER LA SÉANCE ? » → thought `buzzReply`: …Non. Mais j’y ai pensé.
- **Assist** (8 s idle on a croissant): Mme Benali: `assist` « Laissez. Regardez mes mains. » and that croissant forms itself (graded ok).
- **End tier** (`games.croissant.tiers`, Mme Benali; by perfect count 3 / ≥ 1 / 0; the lines don't count, so
  they survive a change of `count`):
  - `good`: Pas une lune. Vous êtes sûr de n’avoir jamais fait ça ?
  - `middle`: Moitié croissants, moitié lunes. Ça fait un beau ciel.
  - `poor`: Que des lunes. C’est un calendrier.
- **Skip:** tier middle.

### 6.6 Week 4: Sami's wheel and Jo (workshop; existing Week 4, moved)

Card « Semaine 4. ». All of `ch4.week4.*` moves to `ch5.week4.*` **unchanged**: `sami[8]`, `bike[1]`,
`hold[3]`, `truing.*`, `after[5]`, `laughStage[1]`, `laugh[1]`, `wrap[2]`. Two additions: the spoke key, and
Jo's beat inside `after` (between `after[1]` and `after[2]`).

Order: `sami` → bike hotspot (« Regarder le vélo ») → `bike` → `hold` → spoke key → TRUING (Jo enters during
it) → reveal → `after[0..1]` (« Ça tourne droit ! Comment t’as su où ? » / « Tu écoutes. La roue te dit où ça
frotte. ») → **`jo`** → `after[2..4]` → `laughStage` → `laugh` → `wrap` (`note+ wheel`) → **`end`**. Jo reacts
to « Tu écoutes », so she comes in after it; she is gone before Sami's « Pourquoi t’as une chaussure de ski ? »,
which keeps the existing laugh beat clean.

#### `ch5.week4.needs` · d.say (TRUING needs the spoke key; after `hold`)
- think: Il faut une clé à rayons. Je sais exactement à quoi ça ressemble. Pour une fois, elle est au tableau.
- objective → `spokeKey`; pegboard prompt « Prendre la clé à rayons » → `item+ spokeKey`.

#### `ch5.week4.keyTake` · thought (non-blocking)
- thought: Revenue. Propre. Elle sent toujours la graisse de chaîne.

#### `ch5.week4.joEnter` · bark (non-blocking, 6 s into TRUING; Jo stays by the door, watching)
- bark(Jo): Odile ! Je viens t’emprunter ton pinceau à filet. Le mien a perdu un poil. Le poil important.

#### `ch5.week4.jo` · d.say (between `after[1]` and `after[2]`)
- jo: Attends. Tu répares sa roue en l’*écoutant* ? Ok. C’est hot. ‖ genuinely impressed; the first romance beat; no irony
- hugo: …C’est une clé à rayons. ‖ flustered
- jo: Je sais c’est quoi. Je dis que c’est hot.
- sami: C’est quoi, hot ? ‖ genuinely asking
- hugo: Tiens le vélo.
- odile: Le pinceau est à gauche. La porte, à droite. ‖ without looking up; the driest line in the chapter
- jo: Tiguidou. ‖ leaving, unbothered, delighted
- stage: *Elle prend le pinceau et sort. La porte claque.*

#### `ch5.week4.end` · d.say (after `wrap`; objective `hangKey`; pegboard prompt « Ranger la clé à rayons »)
- odile: Sur sa silhouette. Qu’elle y reste, cette fois. ‖ `item− spokeKey`
- Fade. End of Ch5.

- **Pacing (main), after the editor's pass:** Week 2 ~1:35 · Week 3 dawn ~1:15 · Week 3 hub (bench, Bastien,
  Jo) ~2:55 · Sami ~1:30 · wrap 0:20 · Week 4 ~2:50 → **~8:25 main; ~10:50 with the optional Lou, Gérard,
  footprint, old man, radio and gifts.** (Writer's figures: 9:25 / 11:45.)
- **Already cut by the editor:** Bastien's spoken passage counts (the screen shows them), Jo's bare-wrist lines,
  one footprint line, two Odile clauses in Week 2, three croissants. **Cut next if long:** the « a appelé trois fois » line in
  `week2.workshop` (« Avant qu’elle rappelle » goes with it), `oldmanLook`, and the « enquêtes plus brillantes »
  line in `week3.wrap`.
- **Laugh lines (≥ 4):** « une effraction avec de bonnes manières », « Je préfère ne pas le dire. », « Le crime
  porte des pantoufles. », « l’allure d’un frigo fatigué », « C’est une sieste. », « Que des lunes. C’est un
  calendrier. », « Le seau a eu peur. », « Mes jambes n’ont pas lu l’ordonnance. », « Pas mon chum chum. », « Moi, je casse. », « C’est quoi, hot ? », « La porte, à droite. »

---

## 7. Ch6 « Service de nuit » (Semaines 5 à 9) — NEW

`L.ch6.title`: « Service de nuit »

- **Scenes:**
  - **Street by day** (Week 6, 15 h): CHEZ GÉRARD's neon now **steady** (rewired).
  - **CHEZ GÉRARD counter at 1 a.m.** (new small set): counter, vertical spit, a row of sauce bottles, a ticket
    spike, the steady neon through the window. Close shot for KEBAB WRAP.
  - **Street at night** (Week 6 walk home at 2 h 10; Week 9 stakeout at 3 a.m.): the `'night'` variant (as built;
    rain only through `setRain(v)`): sodium lamps, wet ground, one lit window (Lou's), the bakery dark until 4 h.
  - **ENCRE FINE** (Week 6 afternoon at the door; Week 7 inside): a light table close shot for STENCIL, Jo's
    tattooed forearm in frame, flash sheets behind.
  - **CYCLES DURAND inside** (Week 6, new set): dusty, painted outlines of missing bikes on the walls (like
    Odile's pegboard), **one clean corner**: the workbench with a cutting jig set at 52, fresh sawdust, an open
    tin of blue paint, a framed 1974 photo, a wall calendar with every night ticked and timed in pencil.
  - **Workshop** (Week 7): `scene4`, the existing Week 7 dressing (tube fixed).
  - **Hugo's flat at night** (Week 9): `scene1` with a cork board on the wall next to the 38 bibs.
- **Characters:** Gérard, Jo, Odile, Durand (Week 9 only; seen and named on the Week 6 photo; his blurred cap at
  the counter during KEBAB WRAP), Lou (a bark from her lit window on the 2 h 10 walk, `ch6.week6.lou`), Mme Benali (none), Sami (Week 6, in
  the workshop after school, doing homework at the bench: wordless, but a kebab recipient).
- **Mood / hope:** 0.5 → 0.52 (kebab) → 0.54 (the shop) → 0.62 (the OPEN sign, existing bloom over 4 s) → 0.64
  (stencil) → 0.68 (the reveal, `mood.pulse(0.06)`). Night scenes use a `night` preset (sodium, fog 0.03, grain
  0.07) but keep the hope value: the colour that came back stays.
- **Watch:** `0,0 km` · `COURSE · SEMAINE` (`L.watch.atChapter[5]`).
- **Notebook seed** (`L.notebook.atChapter[5]`): the Ch5 seed + Rouler un croissant.
  (lune) · Trouver une crevaison. · Dévoiler une roue.

**Cards, captions and objectives**

| Key | French |
|---|---|
| `cards.week5` | Semaine 5. |
| `cards.week6` | Semaine 6. |
| `captions.night1` | 1 H |
| `captions.night2` | 2 H 10 |
| `captions.afternoon` | 15 H |
| `captions.evening` | 18 H |
| `cards.week7` | Semaine 7. (moved from `ch4.cards.week7`) |
| `cards.week8` | Semaine 8. |
| `cards.week9` | Semaine 9. |
| `captions.board` | 23 H |
| `captions.stakeout` | 2 H 50 |
| `objectives.kebab` | Vérifier l’alibi de Gérard. |
| `objectives.home` | Rentrer. |
| `objectives.jo` | Passer chez Jo. |
| `objectives.shop` | Ouvrir la boutique Durand. |
| `objectives.search` | Fouiller la boutique. |
| `objectives.week7` | Voir ce que fait Odile. (moved) |
| `objectives.stencil` | Suivre Jo. |
| `objectives.board` | Résoudre l’affaire. |
| `objectives.bench` | Aller au banc. |
| `objectives.watch` | Surveiller la rue. |

### 7.1 Week 5 (card only)

#### `ch6.week5` · card « Semaine 5. », then d.say
- think: Semaine cinq. Rien de réparé. J’ai vérifié tous les matins, avant le café. C’est grave, je crois. ‖ self-mocking

### 7.2 Week 6: Gérard's alibi, the click, the bike shop

Card « Semaine 6. », caption « 1 H ». CHEZ GÉRARD, behind the counter (Gérard's Ch5 « Reviens un soir, alors »).
Objective `kebab`. (Editor's merge: the writer had a separate morning scene at the shop door for the neon; it
cost a walk and a set-up line, and the neon reads better through the window at night.)

#### `ch6.week6.kebabIntro` · d.say (behind the counter; required; the neon is steady and pink)
- gerard: Regarde mon néon. ‖ outraged, pointing at the window
- gerard: Il clignote plus. Quelqu’un me l’a recâblé la nuit dernière. Sans demander.
- hugo: Il marche, maintenant.
- gerard: Il clignotait *exprès*. C’était de l’ambiance. ‖ wounded dignity; R4 line
- hugo: Une ambiance de quoi ?
- gerard: De kebab.
- gerard: Bon. Tu voulais savoir si j’ai le temps de huiler des rideaux la nuit ? Regarde.
- stage: *La porte s’ouvre. Trois clients. Puis cinq.*
- gerard: Galette, viande. Après, tu fais ce que je dis, quand je le dis. ‖ fast, all business
- → **KEBAB WRAP** (§7.6.1).

#### `ch6.week6.receipts` · d.say (after the game; 2 a.m., the shop closing)
- (Gérard's tier line from `games.kebab.tiers`)
- gerard: Deux heures. On ferme. Maintenant, mes tickets. Ceux de la nuit du rideau. ‖ triumphant
- gerard: Un : salade-tomate-oignons. Deux : sans oignons, il ment, il en reprend toujours. Trois : une assiette. Quatre…
- hugo: J’ai compris.
- gerard: Vingt-sept : des frites. Juste des frites. Un drame. ‖ genuine grief
- gerard: Quarante-trois : un thé. Une heure cinquante-huit. Le monsieur au vélo qui fait clic. ‖ casual, he doesn't know it matters
- hugo: Qui ?
- gerard: Je sais pas son nom. Il vient tous les soirs avant la fermeture. Un thé sans sucre, en pièces de dix centimes. Il dit que c’est pour tenir jusqu’au matin.
- gerard: Tu l’as servi toi-même, tout à l’heure.
- hugo: …Je cherchais la tomate. ‖ flat; the scene's laugh, and a rehearsal of the reveal's « Vous regardiez votre montre »
- gerard: Voilà. Alibi. J’ai pas le temps de huiler quoi que ce soit. J’ai à peine le temps de dormir. ‖ `clue+ receipts` · suspect `gerard` → vérifié
- gerard: Tiens. Pour la route. C’est un très bon kebab. ‖ `item+ kebab` (« très bon »: Ch7 escalates to « *excellent* »)
- stage: *Hugo sort son carnet.*
- gerard: Écris pas ça sur ta liste. C’est mon métier, pas ton loisir. ‖ protective, a little proud; Hugo puts it away
- `hope → 0.52`

- **STRIDE** (on the receipts): buzz « 2 H DU MATIN. TON CORPS A BESOIN DE SOMMEIL. » → thought `buzzReply`: Enfin un bon conseil. Je ne vais pas le suivre.

#### `ch6.week6.lou` · bark (non-blocking, as Hugo leaves CHEZ GÉRARD; from Lou's lit window above it)
- bark(Lou): Le néon clignote plus. Mes photos sont moins bien. ‖ deadpan, aggrieved, a little loud for 2 a.m.

#### `ch6.week6.click` · thoughts (caption « 2 H 10 »; walking home up the dark street; objective `home`)
- thought (at z −30): Clic. Clic. Clic. ‖ hushed; the click SFX plays first, behind Hugo
- thought (Hugo stops and turns; the camera turns with him; the street is empty): Je me retourne. Personne. La rue, et un clic qui s’éloigne, à l’allure d’un frigo fatigué.
- thought: Un clic par tour de roue. Le même que le vélo du vieux monsieur du banc. ‖ `clue+ freewheelClick`
- Fade to the afternoon.

#### `ch6.week6.jo` · d.say (caption « 15 H »; ENCRE FINE door; required; objective `jo`)
- jo: Hugo ! T’as une face de gars qui a roulé des kebabs jusqu’à deux heures. ‖ teasing
- hugo: Quarante-trois.
- jo: Quarante-trois ? Ok. Pis, y étaient bons ? ‖ she asks about quality, never quantity
- hugo: Le quarante-troisième était un thé.
- jo: Faque ton enquête avance.
- hugo: Les lattes, la peinture, le clic. Tout tourne autour de la boutique de vélos. Elle est fermée.
- jo: Fermée, oui. Barrée, non.
- stage: *Elle fait tinter un trousseau énorme.*
- jo: Le proprio, c’est le même que le mien. Il m’a laissé ses clés pour faire visiter. Personne visite. Quatorze clés, aucune étiquette. Bonne chance. ‖ `item+ keyRing` · suspect `jo` gains « A les clés de la boutique. »
- jo: Ah, pis apporte ça à Odile. Dis-y que c’est pas de la pitié. C’est de la soupe. ‖ `item+ soup`; sincere, brisk
- objective → `shop`.

#### `ch6.needs.shopDoor` · d.say (bike-shop door before Jo's key ring)
- think: Fermé à clé. Le genre de serrure qui attend quelqu’un avec un trousseau.

#### `ch6.week6.keyRing.mystery` · d.say (bike-shop door, first {KeyE}, before KEY RING)
- stage: *Hugo sort d’abord sa propre clé. La troisième. Celle dont personne ne se souvient.*
- think: La clé mystère. Il fallait essayer.
- stage: *La porte ne se sent pas bête du tout.*
- jo: C’était quoi, ça ? ‖ amused
- hugo: Une hypothèse.
- → **KEY RING** (§7.6.2).

#### `ch6.week6.shop` · hotspots inside CYCLES DURAND (objective `search`; **bench** and **photo** required, the rest optional)

| Hotspot | Prompt | Required | Block |
|---|---|---|---|
| outlines | Regarder | no | `shop.outlines` |
| bench | Regarder l’établi | yes | `shop.bench` |
| tin | Regarder | no | `shop.tin` |
| photo | Regarder la photo | yes | `shop.photo` |
| calendar | Regarder | no | `shop.calendar` |

- `shop.outlines` · d.say:
  - think: Des silhouettes de vélos peintes au mur. Toutes vides.
  - think: Comme chez Odile. Comme ça, on voit ce qui manque. Ici, il manque tout. ‖ quiet
- `shop.bench` · d.say:
  - think: L’établi est propre. Le seul endroit propre de la boutique.
  - think: Un gabarit de coupe, réglé à cinquante-deux. De la sciure fraîche dessous. ‖ `clueNote slat52` (`noteLater`)
- `shop.tin` · d.say:
  - think: Un pot de peinture, ouvert. Le bleu des lattes du banc.
  - jo: Y a une étiquette. « Bleu Durand, 1979, O. M. »
  - think: O. M. Odile Marchal. ‖ `clueNote blueChip` (`noteLater`)
- `shop.photo` · d.say:
  - stage: *Une photo encadrée, légendée au crayon : « Albert Durand, 1974 ». Un jeune homme devant la boutique neuve. Une casquette plate. Un vélo noir.*
  - jo: Ah ben ! C’est le monsieur du banc ! ‖ delighted recognition
  - jo: Il passe me dire bonsoir tous les soirs à neuf heures. Il m’appelle « mademoiselle ». Personne m’a appelée mademoiselle depuis le cégep.
  - jo: Il a quatre-vingt-un ans. Il me l’a dit trois fois. ‖ fond
  - think: Albert Durand. Cinquante-deux ans de boutique. ‖ `clue+ shopPhoto` · the `oldman` pin becomes `durand` (« M. Durand »)
- `shop.calendar` · d.say:
  - think: Un calendrier. Chaque nuit est cochée au crayon, avec une heure. Trois heures douze. Trois heures neuf. Trois heures quinze.
  - jo: Tabarnouche. Y dort jamais, lui ? ‖ the script's one « tabarnouche »
  - think: Il chronomètre.
  - think: Évidemment qu’il chronomètre. ‖ recognition of himself; flat

#### `ch6.week6.shopOut` · d.say (leaving the shop)
- jo: Je rapporte les clés au proprio. Il saura jamais. ‖ `item− keyRing`
- jo: Pis la soupe, là, elle refroidit. ‖ a push towards No. 14; `hope → 0.54`

#### `ch6.week6.soup` · d.say (give `soup` to Odile; optional but pointed at by Jo; workshop)
- odile: De la soupe.
- hugo: C’est pas de la pitié. C’est de la soupe. ‖ quoting Jo, deadpan
- odile: …Dis-lui merci. ‖ it costs her
- odile: Non. Dis-lui rien. Je lui dirai moi-même. ‖ `item− soup`; the near-ask in miniature

### 7.3 Week 7: the OPEN sign (existing, moved), then the stencil

Card « Semaine 7. ». Workshop. All of `ch4.week7.*` moves to `ch6.week7.*` **unchanged**: `raceBike[1]`,
`stage[1]`, `intro[9]`, `lettering.*`, `signMenu`, `signThink[1]`, `buzz`, `buzzReply`, `wrap[4]`. Two new
blocks frame it (`joEnter` before `stage`, `joBack` after `wrap`), then the stencil.

Order: `raceBike` → **`joEnter`** → `stage` → `intro` → LETTERING → `signMenu` → `signThink` → `note+ sign` →
`buzz` → `wrap` (Hugo's tu, « …Tu veux le peindre. ») → hold on « Quel trait ? » (2 s, no answer: Ch7 answers
it) → cut, caption « 18 H » → **`joBack`** → **`stayMenu`** → ENCRE FINE → **`stencilIntro`** → **STENCIL** →
**`stencilAfter`**. The cut matters: « Quel trait ? » was a chapter ending and must not be stepped on by « Montre-moi
ça. »

#### `ch6.week7.joEnter` · d.say (after `raceBike`)
- jo: Odile ! Ton pinceau. Lavé deux fois. C’est la règle, ici, hein ? Deux fois ?
- odile: Posez-le là, Josianne. Pas là. Là. ‖ vous to Jo, and her full name: Odile is the only one who uses it
- jo: Je reviens tantôt. Je veux voir ce qu’il fait. ‖ to Hugo, with a look
- stage: *Elle sort. La porte claque. Odile ne lève pas les yeux.*
- odile: Elle claque les portes. Ça me plaît. ‖ approval, deadpan

- **Optional radio, Week 7** (`ch6.week7.radio` · d.say):
  - radio: …la vieille carpe, elle, ne dort plus. Elle fait le tour de l’étang toute la nuit, et elle range les cailloux… ‖ radio delivery; unknowingly about Durand
  - odile: Éteins-le. Non. Laisse.

#### `ch6.week7.joBack` · d.say (after `wrap`; Jo returns)
- jo: Montre-moi ça.
- stage: *Elle regarde la pancarte longtemps. Puis le petit H.R. dans le coin.*
- jo: T’as signé en petit. ‖ soft
- hugo: Pour que seuls les gens du métier le trouvent.
- jo: Ben moi, je l’ai trouvé.
- jo: Viens. Je vais te montrer à tracer un pochoir. ‖ « montrer à » + infinitive is Québécois; readable everywhere

#### `ch6.week7.stayMenu` · d.choose (who: 'Jo')
prompt: Odile fait semblant de ne pas écouter.
1. [J’arrive.] → reply(jo): Tiguidou. · `warmth+ joStay`
2. [Odile a besoin de moi.] → reply(**odile**): Odile n’a besoin de rien. Va. ‖ per-option `who` override (§13); then he goes anyway

#### `ch6.week7.stencilIntro` · d.say (ENCRE FINE, the light table)
- jo: Un pochoir, c’est le dessin qu’on décalque sur la peau. Si le pochoir tremble, le tattoo tremble pour la vie. Pas de pression. ‖ grinning
- jo: Ta ligne, faut qu’elle avance toute seule. Trop lent, ça tremble. Trop vite, ça saute.
- hugo: Comme une allure.
- jo: Si tu veux. Mais ici, personne te chronomètre. ‖ pre-echoes Odile's Ch7 « Personne te chronomètre. »
- → **STENCIL** (§7.6.3), a swallow.

#### `ch6.week7.stencilAfter` · d.say
- (Jo's tier line from `games.stencil.tiers`; she is delighted at every tier)
- jo: Un gars qui apprend de quoi à trente-sept ans ? C’est rare. C’est hot. ‖ DESIGN-R4's line, at the beat where it means most: after he has been bad at something in front of her
- jo: Écris-le dans ton carnet.
- `note+ fineLine` (« Tracer un trait fin. »)
- stage: *Elle lui prend le crayon et ajoute un mot, minuscule.*
- `noteAnn fineLine` (« (mal) », `hand: 'jo'`)
- jo: Comme ça, l’an prochain, tu pourras le rayer. ‖ the « mal » is temporary; warm
- `hope → 0.64`

### 7.4 Week 8 (card only)

#### `ch6.week8` · card « Semaine 8. », then d.say
- think: Semaine huit. Le banc tient. Le néon ne clignote plus. Gérard le débranche deux fois par soir, pour l’ambiance.

### 7.5 Week 9: the board, the stakeout, the reveal

Card « Semaine 9. », caption « 23 H ». Hugo's flat. Objective `board`.

#### `ch6.week9.boardIntro` · d.say
- think: Trente-huit dossards au mur. Et maintenant, à côté, un tableau en liège.
- think: Huit suspects, dont moi. Je n’ai jamais eu autant de punaises. ‖ no clue count: two clues are optional, so the number would lie
- think: Trois questions. Si je réponds aux trois, je sais qui.
- → **DEDUCTION** (§7.6.4), with the wrong-accusation scenes and Odile's hint (§9.3–9.4).

#### `ch6.week9.boardDone` · d.say (the three strings meet on M. Durand; the board stamps « RÉSOLU »)
- think: Albert Durand. Quatre-vingt-un ans. Cinquante-deux ans de boutique.
- think: Il fait le tour de la rue toutes les nuits, et il répare ce qu’il trouve.
- think: Je n’ai pas de preuve. J’ai un plan d’entraînement. Il passe à trois heures douze.
- sms(Jo) (phone, not voiced): T’as trouvé ? Je viens. J’apporte de la soupe. Dis non pour voir.
- think: Je n’ai pas dit non. ‖ small smile

Caption « 2 H 50 ». Street at night; objective `bench`.

#### `ch6.week9.stakeoutIntro` · d.say (the repaired bench; required)
- stage: *Le banc réparé. Jo est déjà assise, un thermos sur les genoux.*
- jo: Soupe aux pois. Celle de ma grand-mère. Chu pas venue pour l’enquête, chu venue pour la soupe. ‖ hushed (delivery `hushed`, §12); `item+ thermos`
- jo: On fait quoi, exactement ?
- hugo: On ne bouge pas.
- jo: Ça, tu sais faire. C’est écrit dans ton carnet.
- stage: *Elle lui prend le carnet des mains et le lit à la lumière du réverbère.*
- jo: « Faire un gris pas triste. » Câline. T’es cute. ‖ reading, then fond; R4 line

#### `ch6.week9.cuteMenu` · d.choose (who: 'Jo')
prompt: Elle attend une réponse. Le réverbère grésille.
1. [C’est une liste.] → reply(jo): C’est une belle liste. Fais pas ton modeste, ça te va pas.
2. [C’est la première liste dont je suis fier.] → reply(jo): …Ok. Ça, c’était pas cute. C’était beau. · `warmth+ joProud`

#### `ch6.week9.stakeoutTalk` · d.say
- hugo: Les kilomètres, ça ne t’a jamais impressionnée.
- jo: Pantoute. N’importe qui peut faire plus de la même affaire. Toi, tu fais des affaires *nouvelles*. Avec une botte. ‖ hushed, sincere, no flirting in the first half
- jo: C’est ce qu’il y a de plus sexy dans la rue. Pis la rue a Gérard. ‖ hushed; the laugh on « Gérard ». « Sexy », not a third « hot »: the words climb (hot, Week 4 → hot and rare, Week 7 → sexy, Week 9)
- buzz: SÉANCE NOCTURNE DÉTECTÉE ! BELLE SORTIE À 3 H !
- jo: Ta montre te félicite d’être assis. ‖ whisper
- hugo: Elle me félicite pour tout. ‖ whisper
- think: Trois heures dix. Clic. ‖ the click SFX first, far up the street; objective → `watch`
- → **STAKEOUT** (§7.6.5), with the bravo menu inside it.

#### `ch6.week9.bravo` · d.choose (inside STAKEOUT, when the shadow reaches CYCLES DURAND; the phone buzzes loudly)
prompt: STRIDE : D.52 est en train de battre son record sur « Rue des Tanneurs » ! Envoyer un bravo ?
1. [Bravo] → reply: null
2. [Ignorer] → reply(jo): Ben voyons. Faut l’encourager. ‖ then stage: *Elle tend le bras et appuie sur Bravo.*
- Either way, `remember('durandKudos', 'hugo' | 'jo')`, then:
- stage: *Au bout de la rue, une montre vibre au poignet du vieux monsieur.*
- durand: …Qui m’envoie des bravos à trois heures du matin ? ‖ to himself, baffled, not alarmed

#### `ch6.week9.reveal` · d.say (CYCLES DURAND's card, which he has just pinned back up, straight)
- stage: *Hugo se lève. La botte claque sur le pavé.*
- durand: Vous faites un bruit d’armoire, jeune homme. ‖ without turning round; kind. Odile's image (Ch2, Ch5 Week 2)
- hugo: On me l’a déjà dit.
- durand: Je vous connais. Le grand qui partait courir à quatre heures. On s’est croisés cent vingt-trois fois. J’ai compté. ‖ said simply; the first mirror
- durand: Vous ne m’avez jamais vu. Vous regardiez votre montre. ‖ no reproach; a fact
- think: Il a raison. Des mois que j’entends son clic. Je lui ai même servi un thé. Je n’ai jamais levé les yeux. ‖ the chapter's hardest line; quiet
- jo: Bonsoir, monsieur Durand.
- durand: Mademoiselle. Vous êtes en retard pour dormir. ‖ fond
- hugo: Le rideau de madame Benali. Le banc. Le néon de Gérard. La clé d’Odile.
- durand: Le néon, je regrette. Il clignotait exprès, paraît-il. ‖ dry; callback laugh
- durand: Cinquante-deux ans, j’ai ouvert à huit heures. Maintenant, j’ouvre à trois heures, pour personne. Ce sont les mêmes heures. Seulement, il fait nuit. ‖ R4 line; slow, plain, no self-pity. Durand keeps proper grammar (« Ce sont », not « C’est les ») and doesn't say « juste » for « seulement »
- stage: *Il sort de sa poche un chronomètre. Le vieux modèle, à remontoir.*
- durand: Le rideau de madame Benali : neuf minutes quarante. Le banc : une heure douze. Le néon : trois nuits. J’ai tout noté. ‖ proud, then a little ashamed of being proud
- durand: Ma fille m’a offert une montre pour savoir si je dors. Maintenant, elle sait. ‖ plain; it explains D.52 without saying so
- think: Il chronomètre. Quarante-quatre ans de plus que moi, et pas un jour de repos. ‖ Hugo counts the gap exactly; that is the point
- hugo: Vous devriez dormir. ‖ the man who never rests says it; nobody remarks on it
- durand: Le médecin m’a dit de marcher. Il n’a pas dit quand. ‖ echo of Ch1 « Marchez, si vous y tenez, il a dit. »
- jo: Pis la clé à rayons ?
- durand: Ah. Celle-là, je l’ai gardée trois jours. Je l’ai faite en 1971, pour le père Marchal. J’étais apprenti chez Lemaire, je n’avais pas encore ma boutique.
- durand: Je voulais voir si elle tenait encore. Elle tient. ‖ tender

#### `ch6.week9.offer` · d.say
- hugo: Sami a besoin d’un monsieur des roues. ‖ echo of « trouver un monsieur des roues »
- durand: Je lui ai donné un vélo pour ça. Je lui ai dit d’en trouver un.
- hugo: Il en a trouvé un. Moi. Mais je ne sais pas tout. Venez le jour. Apprenez-lui le reste.
- durand: Je ne sais pas apprendre aux enfants.
- hugo: Moi non plus. Ça s’apprend.
- durand: …À quelle heure ?
- hugo: Dix heures. Apportez votre café. Celui d’Odile est un crime. ‖ callback to Ch2; Hugo almost smiles
- durand: Je sais. Ça fait cinquante ans. ‖ the laugh
- stage: *Jo dévisse le thermos et lui tend le bouchon fumant.* ‖ `item− thermos` (scripted give)
- durand: Volontiers, mademoiselle.
- If `ragsKept` (§1.5): the rags line (§1.4.3) plays here as an optional `give` prompt (« Donner les chiffons »).

#### `ch6.week9.end` · d.say
- stage: *Ils restent tous les trois sur le banc réparé jusqu’à ce que la boulangerie s’allume.*
- jo: Écris-le. C’est la règle, hein ? Odile me l’a dit.
- `note+ case` (« Mener une enquête. ») · `hope → 0.68` · `mood.pulse(0.06)`
- think: Quatre heures. La boulangerie s’allume. Pour une fois, je ne l’ai pas battue. ‖ echo of Ch3 « Je la bats tous les matins »; contented
- Fade to white. End of Ch6.

### 7.6 Ch6 minigames (UI text)

#### 7.6.1 KEBAB WRAP (`games.kebab`; Week 6, 1 h)
- **Mechanic** (as built in `src/story/games/kebab.js`): **two orders** (was three; cut list A adopted). Gérard
  barks each order once, fast, changing his mind mid-call; the player drags the bowls onto the galette in the
  called order (an item he takes back is written, then struck, on the ticket), then drags the galette up to fold
  it. **Between the two orders: the tea** (scripted, no input, about 4 s; below).
- **UI:**

  | Key | French |
  |---|---|
  | `prompts.fill` | Glisser les garnitures sur la galette, dans l’ordre |
  | `prompts.fold` | Glisser la galette vers le haut pour la plier |
  | `tubs` | Salade · Tomate · Oignons · Viande · Frites · Sauce blanche · Samouraï |
  | `ticket` / `stamp` | COMMANDE / CHEZ GÉRARD |
  | `counter` | Kebab {n}/2 |

  The built module's red bowl is `harissa`: label it « Samouraï » (the sauce a French kebab shop has).
- **Orders** (`orders[i].call`, bark(Gérard), one breath each; struck items in brackets):
  1. Une complète ! Salade, tomate, oignons… non, pas d’oignons ! Viande, sauce blanche. → salade, tomate, [oignons], viande, sauce blanche
  2. Viande, frites dedans, samouraï. Pas de salade, il est allergique. À la salade. → viande, frites, samouraï, [salade]
- **The tea** (`tea`, between the orders): bark(Gérard): Un thé ! Sans sucre ! Au bout du comptoir ! → stage:
  *Gérard lui met un verre de thé dans la main. Hugo le pose au bout du comptoir sans lever les yeux. Une
  casquette plate, floue, au bord du cadre. Des pièces de dix centimes sur le zinc.* → as the door shuts, the
  freewheel click, four times, fading. The customer is never in focus. Pays off in `receipts` (« Tu l’as servi
  toi-même ») and in the reveal (« Je lui ai même servi un thé »).
- **Wrong bowl** (`lines.wrong`, bark): Pas ça ! · J’ai dit tomate. Ça, c’est un oignon. Je connais mes légumes.
- **A struck item added** (`lines.excluded`): Il a dit sans oignons. Il ment, mais il l’a dit.
- **Fold** (`lines.fold`): Plie ! Serré !
- **Hurry** (`lines.hurry`, idle): Allez, allez ! · Le client, il vieillit. (the built module's lines, kept)
- **STRIDE** (once): buzz « ACTIVITÉ NON RECONNUE. ESSAYER LE YOGA ? » (no reply)
- **Assist** (7 s idle, the module's default): Gérard: `assist` « Pousse-toi. » + stage *Il en roule trois pendant qu’Hugo cherche la tomate.* (tier poor).
- **Tiers** (`lines.end`, Gérard; by mistakes over both orders: 0–1 / 2–4 / 5 or more):
  - `good`: Pas mal. T’as des mains de kebab.
  - `middle`: Il tient. C’est un kebab honnête.
  - `poor`: On dirait un sac de couchage. Il paiera quand même.
- **Skip:** tier middle.

#### 7.6.2 KEY RING (`games.keyRing`; Week 6, the bike-shop door)
- **Mechanic:** 14 keys on a ring, in close-up beside the lock's keyhole silhouette. Wheel or horizontal drag
  turns the ring; the key at the front is highlighted; click to try it. A wrong key goes in and won't turn (a dry
  clack). The right one has a red ribbon (visible, small).
- **UI:**

  | Key | French |
  |---|---|
  | `hint` | Molette ou glisser : tourner le trousseau · clic : essayer la clé |
  | `counter` | Essai {n} |

- **Jo's barks on a wrong key** (bag): Non. · Pas celle-là. Celle-là, c’est mon char. · Celle-là ouvre rien. Le proprio la garde pour l’ambiance.
- **Found in ≤ 3 tries** (`foundFast`, d.say):
  - jo: T’as trouvé tout seul. J’avais mis un ruban dessus, pis t’as même pas regardé le ruban. Ok. Respect.
- **Assist after 3 wrong keys** (`assist`, d.say), then the ring turns to the red ribbon and it opens:
  - jo: Celle avec le ruban rouge. Ben là. Je l’ai mis moi-même.
  - hugo: Tu savais.
  - jo: Je voulais te voir chercher. Ça te fait une belle face. ‖ « T’es cute » is kept for the stakeout, where it lands harder
- **Skip:** opens; plays nothing.

#### 7.6.3 STENCIL (`games.stencil`; Week 7, ENCRE FINE)
- **Mechanic:** trace a fine-line swallow (one continuous path, about 6 s at a good pace; cut list A adopted) on transfer paper on
  the light table, with the mouse held down. The line advances only while the cursor moves along the path;
  speed is scored against a band. Slow lines wobble (a visible tremor in the ink); fast lines skip (gaps).
- **UI:**

  | Key | French |
  |---|---|
  | `hint` | Maintenir le clic et suivre le dessin, à vitesse égale |
  | `gauge` | TRAIT (reuses the Ch7 gauge word) |
  | `band.slow` / `band.fast` / `band.good` | TREMBLE / SAUTE / BIEN |

- **Jo's barks** (`lines.*`, at most one per 4 s):
  - `slow`: Ça tremble. T’as peur du papier ? · Avance. Le papier mord pas.
  - `fast`: Tu sautes. C’est pas une course, champion. · Wo. C’est une hirondelle, pas un sprint.
  - `steady`: Là. Là, c’est beau.
- **STRIDE** (once, mid-trace, when Jo leans in to look): buzz (`buzz`) « FRÉQUENCE CARDIAQUE ÉLEVÉE. SÉANCE INTENSE ? » → bark(Jo) (`buzzJo`): Ta montre trouve que t’as le cœur qui bat vite. → thought (`buzzReply`): Elle exagère. Un peu.
- **Assist** (5 s idle): the cursor is pulled along the path at a good pace (tier middle).
- **Tiers** (`games.stencil.tiers`, Jo, always delighted):
  - `good`: Ben là. C’est propre. J’aime pas ça, je voulais rire.
  - `middle`: Ta ligne avance comme un gars qui pense à sa ligne. ‖ R4 line, adapted
  - `poor`: C’est tout croche. C’est parfait. J’adore.
- **Skip:** tier middle. **Memory:** `remember('stencil', tier)` (owner 5); not used by the ending.

#### 7.6.4 DEDUCTION (`games.deduction`; Week 9, the flat)
- **Board UI:**

  | Key | French |
  |---|---|
  | `title` | QUI RÉPARE LA RUE ? |
  | `questions.q1` | Qui passe dans la rue à 3 h ? |
  | `questions.q2` | Qui coupe à 52 ? |
  | `questions.q3` | Qui fait clic ? |
  | `columns` | QUESTIONS · INDICES · SUSPECTS |
  | `hint` | Glisser un indice sur une question · puis tirer le fil vers un suspect |
  | `stamp` | RÉSOLU |

- Clue cards are the case-tab clues the player holds (the three answers are always held, because their scenes
  are required). Suspect pins are the case-tab suspects (8). Strings are red wool.
- **A clue on the wrong question** (`wrongClue`, thought, bag; counts as a wrong try): Ça ne répond pas à la question. ·
  C’est un indice. Pas pour cette question-là. · Non. Mesurer deux fois. Punaiser une fois.
- **The right clue on its question** (`rightClue.<q>`, thought):
  - `q1`: D.52. Quelqu’un qui marche à trois heures, et qui compte en cinquante-deux.
  - `q2`: Cinquante-deux centimètres. Le gabarit de l’établi de la boutique.
  - `q3`: Un clic par tour. Un vélo noir, depuis 1974.
- **The string to M. Durand** (`toCulprit.<q>`, thought):
  - `q1`: D comme Durand. Cinquante-deux ans de boutique.
  - `q2`: Il coupe comme il a toujours coupé.
  - `q3`: Le même vélo. Le même clic. Toutes les nuits.
- **A string to anyone else:** the suspect's wrong-accusation scene (§9.3); counts as a wrong try.
- **After 2 wrong tries:** Odile's hint (§9.4). **After 4:** Odile comes up and finishes it.
- **STRIDE** (20 s with no input, once): buzz (`buzz`) « ACTIVITÉ CÉRÉBRALE NON RECONNUE. »
- **Idle assist** (30 s idle): the right clue for the first open question wiggles; thought (`idle`): Une question à la fois. Comme les kilomètres.
- **Skip:** solved. **Memory:** `remember('caseFile.wrong', n)`, `remember('caseFile.accused', [ids])` (owner 5).

#### 7.6.5 STAKEOUT (`games.stakeout`; Week 9, 3 a.m.)
- **Mechanic:** first person from the bench. The mouse looks around (yaw ±50°, pitch ±15°). Keep the shadow
  (Durand pushing his bike, about 1.8 km/h) inside the frame. The nearest streetlight's cone must not fall on
  Hugo: leaning (looking) too far right puts his face in it. When the shadow stops and looks round, hold the
  right button to hold breath (the SOUFFLE gauge drains; let go when he turns away). He works his loop: the
  bakery shutter, the bench end, CYCLES DURAND.
- **UI:**

  | Key | French |
  |---|---|
  | `hint` | Souris : garder l’ombre dans le cadre · rester hors de la lumière · clic droit maintenu : retenir son souffle |
  | `gauge` | SOUFFLE |
  | `click` | clic |
  | `seen` | EN VUE (the built module's in-view meter; not in the draft, the writer may replace it) |

  `click` is a small caption drawn at the shadow's position on every freewheel click (the sound's visual twin).
- **Jo's barks** (`barks.*`, `bark(Jo)`, delivery `hushed`):
  - `approach`: Y s’en vient.
  - `still`: Bouge pas.
  - `light`: La lumière ! Recule.
  - `looks`: Respire pas.
  - `breathe`: Ok. Respire un peu.
  - `close`: Il nous a vus ? Non. Ok.
- **Lost him** (he leaves the frame for 4 s): bark(Jo) `barks.lost` « Il a tourné au coin. » → thought (`lost`): Il fait une boucle. Il va repasser. Je connais les boucles. → he walks the loop again.
- **Assist:** after two losses, or 30 s, the camera eases toward him on its own; the bravo menu comes on time.
- **End:** the `bravo` menu fires when he reaches CYCLES DURAND, whatever the score.
- **Skip:** straight to `bravo`.

- **Pacing (main), after the editor's pass:** Week 5 0:10 · Week 6: neon + kebab + tea + receipts 1:45, click
  0:20, Jo 0:45, key ring 0:40, shop 0:50 · Week 7: existing ~2:30, Jo bookends 0:40, stencil 1:00 · Week 8 0:10 ·
  Week 9: board 1:45, stakeout intro and talk 1:10, STAKEOUT 1:00, reveal and offer 2:25 → **~10:10 main; ~11:45
  with the optional shop hotspots, radio, soup and gifts.** (Writer's figures: 11:00 / 12:30.) Ch6 is the longest
  chapter by design (the mystery pays off here).
- **Cut next if long** (by content, since indices moved): in `receipts`, « Trois : une assiette. Quatre… » and
  « J’ai compris. »; the shop calendar (optional anyway); in `stencilIntro`, « Comme une allure. » and its reply;
  in `stakeoutTalk`, the STRIDE buzz and its two whispers; in `reveal`, « Mademoiselle. Vous êtes en retard pour
  dormir. » and the stopwatch times. **Never cut:** « Tu l’as servi toi-même » / « …Je cherchais la tomate. », the
  daughter's watch, « Vous devriez dormir. » and its answer: they are the mirror.
- **Laugh lines (≥ 4):** « C’était de l’ambiance. / Une ambiance de quoi ? / De kebab. », « Vingt-sept : des
  frites. Juste des frites. Un drame. », « Y étaient bons ? », « La porte ne se sent pas bête du tout. », « Celle-là,
  c’est mon char. », « Elle claque les portes. Ça me plaît. », « Pis la rue a Gérard. », « Ta montre te félicite
  d’être assis. », « Le néon, je regrette. », « Je sais. Ça fait cinquante ans. », « …Je cherchais la tomate. »,
  « Le médecin m’a dit de marcher. Il n’a pas dit quand. », « Mes photos sont moins bien. »

---

## 8. Ch7 « Le Mur » (Semaine 12) — the existing Ch5, renamed `ch7`

**Unchanged:** every existing `ch5` line, menu, job and minigame (DESIGN.md Ch5, R3.7, R3.8), now under `ch7`.
Lou and Gérard are already renamed in the text (conversion agent; old key ids `ines`, `marco`, `inesBike`,
`marcoPanel` kept). **New:** the Weeks 10–11 card, Durand and Odile, two new panels, Jo's last beats, two walk
barks, a three-line shop card, a changed shutter bark, the notebook additions and the ending cards.

- **Scene needs:** the existing `'wall'` variant plus **two new mural panels** (`durand`: a life-size spoke
  key, brass and steel on cream; `jo`: a small fine-line swallow in black on oxblood, **the smallest panel on the
  wall**), Durand in the street (chair next to Odile's, then at CYCLES DURAND's door with Sami for the walk),
  Jo at ENCRE FINE's door (golden walk). CYCLES DURAND's card gets a third line. The bike shop's shutter is
  **up**: Durand works there by day now.
- **Mood / hope:** 0.68 (Ch6 end) → 0.75 (Teach) → 0.78 (Hugo's panel) → 0.84 over the line → 0.9 (signed) →
  0.95 (boot) → 1.0 (golden walk). Unchanged after Teach.
- **Watch:** `L.watch.atChapter[6]` = `0,0 km` · `COURSE · SEMAINE`.
- **Notebook seed** (`L.notebook.atChapter[6]`): the Ch6 seed + Peindre une enseigne. · Tracer un trait fin.
  (mal) · Mener une enquête.

#### `ch7.weeks10` · card « Semaines 10 et 11. », then d.say (before `cards.week12`)
- think: Monsieur Durand apprend à Sami à monter une roue. Sami lui apprend à éteindre sa montre. Chacun trouve l’autre très lent. ‖ amused, fond. (The writer's « dix heures / dix heures cinq » joke is kept for the ending card only, so it isn't told twice.)

#### `ch7.cards.week12` · card « Semaine 12. » (moved from `ch4.cards.week12`)

#### `ch7.opening` — unchanged (4 lines). Then:

#### `ch7.durand.meet` · d.say (at Odile's chair; required, part of `meet`)
- durand: Bonjour, jeune homme. J’ai dormi jusqu’à huit heures et demie. ‖ amazed, a little scandalised
- durand: Huit heures et demie. J’ai cru que j’étais mort.
- stage: *Odile montre du menton la peinture de Durand : une clé à rayons, grandeur nature.*
- odile: Albert. Ma clé.
- durand: Ta clé, Odile. Je l’ai faite pour ton père.
- odile: Je sais. Il me l’a dit en 1971.
- hugo: Tu savais ? ‖ Hugo → Odile tu (after Ch6 Week 7)
- odile: Depuis le bleu. C’est moi qui l’ai fait, ce bleu. Pour sa devanture. En 1979.
- hugo: Et tu m’as laissé chercher six semaines.
- odile: Tu avais besoin d’une enquête. Lui avait besoin qu’on le trouve. ‖ flat, practical
- odile: Moi, j’avais besoin de rien. ‖ she believes it; the ending card « Demander. » disagrees
- stage: *Durand la regarde. Il ne dit rien. Ça fait cinquante ans qu’il ne dit rien.*

#### Optional hotspots (new; existing `benali`, `ines` (Lou), `marco` (Gérard), `shopCard`, `boltHoles` unchanged)

| Hotspot | Prompt | Block |
|---|---|---|
| `durandPanel` | Parler | `ch7.durand.panel` |
| `joPanel` | Parler | `ch7.jo.panel` |

- `ch7.durand.panel` · d.say:
  - durand: Odile a dit de peindre ce qu’on sait faire. Je sais faire une clé. Une seule. Il y a cinquante-cinq ans.
  - hugo: Elle tient.
  - durand: Elle tient. ‖ pleased; echo of `ch6.week9.reveal`
- `ch7.jo.panel` · d.say:
  - jo: La plus petite peinture du mur. Pis la plus propre. Je dis ça de même.
  - jo: Une hirondelle. Ma toute première. Je me l’étais faite sur la cheville, à seize ans. Elle est toute croche. C’est celle que j’aime le plus.
  - jo: Une hirondelle, ça revient toujours. Ça a pas besoin de beaucoup de place. Juste d’une place. ‖ her want, said lightly
  - hugo: Elle a une place.
  - jo: …Ben là. Fais pas ça en public. ‖ caught off guard, pleased

#### Changed text in existing blocks

| Key | Old | New |
|---|---|---|
| `ch7.jobs.shutter.near` | Il se bloque à mi-hauteur tous les matins. J’ouvre une demi-boulangerie. | Il ne crie plus, grâce à monsieur Durand. Mais il se bloque toujours à mi-hauteur. Il n’a pas pensé à tout. |
| `ch7.signs.shopCard` | CREVAISONS RÉPARÉES\nDEMANDER AU N° 14 | CREVAISONS RÉPARÉES\nDEMANDER AU N° 14\n(ou M. Durand, avant 21 h) |
| `ch7.shopCard` | [L’écriture de Sami. Mon orthographe.] | + think: La dernière ligne est d’une autre écriture. Penchée, à l’ancienne. |
| `ending.cards.job.shutter` | Le rideau de fer de Mme Benali se lève à six heures sans un bruit. La dispute lui manque. | Le rideau de fer de Mme Benali monte d’une traite, à six heures. Il ne crie plus, il ne coince plus. La dispute lui manque. (Durand took the scream; Hugo's job takes the jam.) |
| `ch7.signs.panels` | 5 panels | + `{ id: 'durand', label: 'la clé de M. Durand', color: '#b08d57' }`, `{ id: 'jo', label: 'l’hirondelle de Jo', color: '#6b2430' }` (order along the wall is the scene owner's: the line passes under all seven) |

#### `ch7.teach.durand` · bark (optional, after Teach, if Durand is within 6 m)
- bark(M. Durand): Bien. Je lui aurais dit la même chose. Plus lentement. ‖ approving, slow

#### `ch7.jo.supper` · d.say (after `line.photo`, before the run club; required)
- jo: Tu me dois un souper. ‖ arriving at his elbow
- hugo: Pourquoi ?
- jo: La soupe. La planque. Pis parce que.
- jo: Tu sais cuisiner ?
- hugo: Non.
- jo: Ben, tu vas apprendre. ‖ R4 line; certain
- stage: *Elle lui prend le carnet et écrit une ligne, en tout petit.*
- `note+ cook` (« Cuisiner. », `hand: 'jo'`) · `noteAnn cook` (« (en cours) », `hand: 'jo'`)
- **warm** (`warmth() ≥ 3`): stage: *Elle l’embrasse sur la joue. Vite. Comme on signe dans un coin.* → think: En petit. Dans le coin. ‖ the only kiss in the game; nothing more
- **cool** (`warmth() < 3`): stage: *Elle lui donne une tape sur l’épaule. Une bonne.*
- jo: Samedi, sept heures. Apporte rien. Surtout pas ta montre. ‖ both variants

#### Final walk additions (non-blocking barks, once each)
- `ch7.walk.durand` (passing CYCLES DURAND, z ≈ −34; Durand and Sami at the open shop): bark(M. Durand): Bonsoir, jeune homme. Je ferme à neuf heures, maintenant. Comme tout le monde.
- `ch7.walk.jo.warm` (passing ENCRE FINE, warm): bark(Jo): Samedi, le grand ! C’est moi qui fais le dessert !
- `ch7.walk.jo.cool` (cool): bark(Jo): Samedi ! Pis pas de sauce en pot !

#### `ch7.walk.notebook` — the final list (`L.notebook.final`)
The eraser lifts the strikes off « Rouler. » and « Courir. », Hugo annotates « (certains dimanches) », then adds
« Se reposer. » last (unchanged choreography). The full list, top to bottom:

| # | Text | Note | Hand | Added |
|---|---|---|---|---|
| 1 | Rouler. | | hugo | Ch4 Day 5 (struck, unstruck at the end) |
| 2 | Courir. | (certains dimanches) | hugo | Ch4 Day 5 (struck, unstruck, annotated) |
| 3 | Ne pas bouger. | | hugo | Ch4 Day 5 |
| 4 | Poncer dans le sens du fil. | | hugo | Ch4 Day 5 |
| 5 | Mesurer deux fois. | | hugo | Ch4 Day 8 |
| 6 | Faire un gris pas triste. | | hugo | Ch4 Day 8 |
| 7 | **Rouler un croissant.** | **(lune)** | hugo | Ch5 Week 3 |
| 8 | **Trouver une crevaison.** | | hugo | Ch5 Week 3 |
| 9 | Dévoiler une roue. | | hugo | Ch5 Week 4 |
| 10 | Peindre une enseigne. | | hugo | Ch6 Week 7 |
| 11 | **Tracer un trait fin.** | **(mal)** | hugo, note in **jo** | Ch6 Week 7 |
| 12 | **Mener une enquête.** | | hugo | Ch6 Week 9 |
| 13 | Aprendre. | | sami | Ch7 Teach |
| 14 | **Cuisiner.** | **(en cours)** | **jo** | Ch7 supper |
| 15 | Se reposer. | | hugo | Ch7 the nail (always last) |

New `L.notebook.items` keys: `croissant`, `puncture`, `fineLine`, `case`, `cook`; new notes:
`L.notebook.notes.moon` « (lune) », `.badly` « (mal) », `.learning` « (en cours) ». All entries ≤ 27 characters.

### 8.9 Ending cards (`L.ending.cards`, `story/ending.js`)

**Changed** (renames, already done by the conversion agent): `job.board` (Gérard), `job.wheel` (Lou).
**New:**

| Key | French | Characters |
|---|---|---|
| `durand` | Albert Durand a appris à faire la grasse matinée. Il ouvre à dix heures, maintenant. Sami arrive à dix heures cinq. | ≤ 140 |
| `jo.warm` | Jo a tatoué un trait sur le tibia gauche d’Hugo, juste par-dessus la fêlure. Plus fin qu’un cheveu. Il va jusqu’au bout. | ≤ 140 |
| `jo.cool` | Hugo doit toujours un souper à Jo. Il en est à sa quatrième sauce. Elle dit que la cinquième sera la bonne. | ≤ 140 |

`jo.warm` closes echo chains 1 and 2 (« plus fin qu’un cheveu », « jusqu’au bout ») on the first thing in the
story that is drawn *over* the crack rather than caused by it. Nobody explains it.

**Selection (9 cards, in this order):**

```js
const warmth = (m) => ['joSign', 'joLearned', 'joCroissant', 'joStay', 'joProud'].filter((k) => m[k]).length;
return [
  c.street[m.panel] ?? c.street.plain,
  m.teachFirst === false ? c.sami.second : c.sami.first,
  c.durand,
  j.board ? c.job.board : j.wheel ? c.job.wheel : j.shutter ? c.job.shutter : m.grey?.assisted ? c.grey.odile : c.grey.own,
  j.radio ? c.radio.fixed : c.radio.one,
  c.ask,
  warmth(m) >= 3 ? c.jo.warm : c.jo.cool,
  c.runs, c.watch,
];
```

- `L.ending.lines` (the default selection) becomes the 9-card default: plain street, `sami.first`, `durand`,
  `grey.own`, `radio.one`, `ask`, `jo.cool`, `runs`, `watch`.
- **Layout:** R3 sized the end card for 7 cards on a landscape phone. With 9, the end-card owner checks the fit
  at 1280 × 800 and on a landscape phone. **Fallback if 9 don't fit:** drop the `radio` card (its information is
  also in the jobs), keeping 8.
- A straight jump to Ch7 (`?chapter=6`) with no flags gives warmth 0 → `jo.cool`. Debug: `?warmth=5` forces warm.

---

## 9. The mystery: « Qui répare la rue ? »

### 9.1 What really happened (for art and continuity)

Albert Durand, 81, closed CYCLES DURAND this year after 52 years (opened 1974). He can't sleep and can't stop.
His doctor told him to walk; his daughter gave him a STRIDE watch so she could check (username **D.52**). Every
night he leaves at about half past one in **charentaises** and his brown cardigan, buys a tea at CHEZ GÉRARD at 1 h 58,
and pushes his old **black bike** (worn freewheel pawl: **one click per wheel turn**) round a loop of the street,
fixing what he finds, timing every job on a wind-up stopwatch and ticking it on the shop calendar. He works at
his old bench in the shuttered shop (he never gave his key back; the landlord's spare is with Jo). He borrows
tools from Odile's workshop (she never locks it: « Les gens ont peur de moi ») and returns them cleaned. He
passes ENCRE FINE at 9 p.m. to say good evening to « mademoiselle ». By day he sleeps on benches.

| Night | What he did | Who notices | Where the player sees it |
|---|---|---|---|
| Day 3 | walks the loop | Hugo, awake at 3 a.m. | Ch1 window (optional) |
| Ch3 Week 31 (flashback) | walks the loop | nobody (Hugo watches his watch) | Ch3 wordless seed |
| Day 7 → Day 8 | borrows the spoke key (he made it in 1971 for Odile's father) | Odile, end of Day 8 | Ch4 hook |
| Day 10 → Day 11 (Week 2, Wednesday night) | oils Mme Benali's shutter; returns the key, cleaned, with folded rags | the street | Ch5 Week 2 |
| Week 3, Friday night | three new slats on the bench, cut at **52 cm** on his shop jig, painted **Bleu Durand**; sawdust slipper print on No. 14's doorstep (returning Odile's saw) | Odile | Ch5 Week 3 |
| Week 6 (three nights) | rewires Gérard's neon | Gérard (outraged) | Ch6 Week 6 |
| Week 6, the kebab night | buys his tea at 1 h 58 (Hugo serves it without looking up), walks home clicking at 2 h 10 | Hugo, without knowing it | KEBAB WRAP, `click` |
| Week 9 | pins the fallen CYCLES DURAND card back up, straight | Hugo and Jo | Ch6 stakeout |

All the suspects' alibis concern **the night of the shutter** (Wednesday of Week 2). In dialogue it is « la
nuit du rideau », never a weekday, so the Week 3 interviews ten days later stay clear.

### 9.2 The clue chain and fair play

Every clue the board needs is gained in a **required** scene before the board. Optional clues only support.

| Board | Clue | First shown | Required? | Points at Durand because… |
|---|---|---|---|---|
| **Q1 « Qui passe dans la rue à 3 h ? »** | `segmentD52` | Ch5 Week 3, Bastien | yes | D. + 52 (the shop's « 52 ANS » sign, seen since Ch2); 1.8 km/h is an old man pushing a bike; 03:12 |
| support | `louPhoto` | Ch5 Week 3, Lou | no | the flat cap and the bike under the lamp at 3 h 04 |
| **Q2 « Qui coupe à 52 ? »** | `slat52` (+ `noteLater`) | Ch5 Week 3, the bench; confirmed Ch6 Week 6, the shop jig | yes | the jig on Durand's bench is set at 52 |
| support | `blueChip` (+ `noteLater`) | Ch5 Week 3, the bench; the tin in the shop (optional) | bench yes, tin no | « Bleu Durand, 1979, O. M. » |
| **Q3 « Qui fait clic ? »** | `freewheelClick` | Ch6 Week 6, the walk home | yes | the same click as the old man's bike on the bench (Ch5 Week 3, required) |
| support | `receipts` | Ch6 Week 6, Gérard | yes | « Le monsieur au vélo qui fait clic », a tea every night at 1 h 58 |
| names him | `shopPhoto` | Ch6 Week 6, the shop | yes | the 1974 photo: the old man of the bench is Albert Durand |
| decoys | `cleanKey`, `photoHinge`, `slipperPrint` | Ch5 Week 2, Week 3 | partly | they describe the Fixer (bike oil, polite, slippers) without naming anyone |

**Fair-play tells, in order** (none says it outright): Ch2 the « 52 ANS » card (and the faded blue fascia: the
scene owner paints CYCLES DURAND's fascia in a faded blue, about `#4a6a8e`) · Ch4 Week 4 (now Ch5) « C’est monsieur
Durand qui me l’a donné quand il a fermé » · Ch5 Week 3 « Je dors très bien, le matin. C’est la nuit que ça se
gâte. » and the click · Sami's « Monsieur Durand dit ça » (thirty seconds) and the hand-cut patch · Odile's long
look at the blue chip · the sawdust on the old man's sleeves (`oldmanLook`, optional) · Ch6 the blurred cap and
the dime coins at the counter, the receipts, the click, the photo, the calendar.

**Red herrings and how each is cleared** (each clears in play, and again as a wrong-accusation scene):

| Suspect | Why they look guilty | Cleared by |
|---|---|---|
| Sami | wants tools | his mother sleeps across his door; « Moi, je casse. » |
| Lou | out at night, paint on her hands | the 3 h 04 photo from her window |
| Gérard | open till 2, sleeps four hours | the 43 receipts (KEBAB WRAP) |
| Mme Benali | up at 4; it's her shutter; slippers | the croissants; her slippers are a 36, the print a 44 |
| Bastien | runs at 5 | his data; he is *second* on the segment, behind D.52 |
| Jo | works late, fine brushes, the shop keys | the client's kite, still red, 3 h 07 |
| Hugo | Odile's suspect: up at 4, a boot, fixes things to avoid feelings | himself (§9.3) |

### 9.3 Wrong accusations at the board (`ch6.week9.accuse.<id>` · d.say)

Each starts with the stage line `ch6.week9.accuse.stage`: *Hugo imagine la scène.* (the board blurs; the suspect
appears in a soft vignette). One per suspect; the second time the same suspect is accused, only Hugo's last
thought plays.

- `sami`:
  - hugo: Sami. C’est toi qui répares la rue la nuit.
  - sami: Moi ? Je casse. Je te l’ai dit. Et ma mère dort en travers. ‖ offended
  - think: Il a raison. Il casse.
- `lou`:
  - hugo: Lou. Le flou, c’est toi.
  - lou: Je suis derrière l’appareil. Je peux pas être dans la photo. C’est le principe d’une photo. ‖ pre-echo of Ch7
  - think: Elle me l’expliquera encore. Souvent, je pense.
- `gerard`:
  - hugo: Gérard. Ton néon, c’est une couverture.
  - gerard: Mon néon, c’est de l’ambiance. Et j’ai quarante-trois tickets. Je te les relis ?
  - think: Surtout pas.
- `benali`:
  - hugo: Madame Benali. Des charentaises, à trois heures du matin.
  - benali: En quarante-quatre ? Monsieur Revel. Regardez mes pieds. ‖ amused, patient
  - think: Trente-six. Son seul défaut.
- `bastien`:
  - hugo: Bastien. Tu cours à cinq heures. Tu pourrais réparer à trois.
  - bastien: Mec. Si je m’étais arrêté pour huiler un rideau, ma montre aurait fait une pause. Et ma montre fait JAMAIS de pause. ‖ wounded, absolutely sincere
  - think: Ça, je le crois.
- `jo`:
  - hugo: Jo. Tu as les clés de la boutique.
  - jo: Ben oui. Pis un cerf-volant encore rouge à trois heures sept. Tu m’accuses pour me revoir, ou quoi ? ‖ flirty
  - think: …Pas complètement faux.
- `hugo` (the bib pin):
  - stage: *Hugo s’imagine en train de s’arrêter lui-même.*
  - think: Hugo Revel, je vous arrête.
  - think: Non. Ça ne tient pas. Je n’ai jamais su m’arrêter. ‖ the « s’arrêter » echo chain, as a joke

### 9.4 Odile's hints (DEDUCTION can't soft-lock)

#### `ch6.week9.hint` · d.say (after 2 wrong tries)
- stage: *Le téléphone sonne. C’est l’atelier.*
- odile: Ta botte fait les cent pas depuis une heure. Je l’entends d’en bas. Tu accuses toute la rue, je parie. ‖ phone delivery. Hugo is on the third floor: she hears the boot, not the pins
- odile: Cinquante-deux ans. Cinquante-deux centimètres. Ça fait beaucoup de cinquante-deux pour un hasard.
- Then the three right clues glow softly on the board.

#### `ch6.week9.hint2` · d.say (after 4 wrong tries)
- odile: Je monte. ‖ phone
- stage: *Elle monte. Ça prend un moment.*
- odile: Albert Durand. Tu tires tes fils, ou je le fais ? ‖ in the room, a little out of breath
- The strings draw themselves; `boardDone` plays.

---

## 10. Continuity

### 10.1 The boot calendar (boot day 1 = the Monday after the race)

| Card | Boot day | Weekday | Chapter | Note |
|---|---|---|---|---|
| (Ch1) | Day 4 | Thursday, 21 h | 1 | « On en est au jour quatre. » |
| (Ch2) | Day 4 | Thursday, evening | 2 | same night |
| Jour 5. | Day 5 | Friday | 4 | |
| Jour 8. | Day 8 | Monday | 4 | the hook |
| Semaine 2. | Day 11 | Thursday | 5 | « Ma clé est revenue cette nuit. » (three days after the hook) |
| Semaine 3. · SAMEDI, 4 H 10 / 10 H / 16 H | Day 20 | Saturday | 5 | the bench was done Friday night |
| Semaine 4. | about Day 25 | | 5 | Sami's wheel |
| Semaine 5. | | | 6 | card only |
| Semaine 6. · 1 H / 2 H 10 / 15 H | | | 6 | |
| Semaine 7. | | | 6 | the OPEN sign; Hugo's tu |
| Semaine 8. | | | 6 | card only |
| Semaine 9. · 23 H / 2 H 50 | | | 6 | the stakeout |
| Semaines 10 et 11. | | | 7 | card only |
| Semaine 12. | Day 84 | (the boot comes off) | 7 | « Douze semaines depuis le dimanche. » |

### 10.2 The numbers (each deliberate)

| Number | Meaning | Where |
|---|---|---|
| 212,4 | last week's km | Ch1, Ch3, Ch7 crane, ending big text; Jo's « Deux cent douze ? Ok. Pis ? » |
| 170,2 | Saturday's total | Ch3 |
| 11,2 | km on the crack | Ch1 |
| 42,2 | the marathon | Ch3 |
| 38 | race bibs | Ch1; Ch6 board (« Trente-huit dossards au mur ») |
| 52 | Durand's years; the slat length (cm); D.52 | Ch2 sign, Ch5 bench, Ch6 board |
| 40 | Odile's years of hairlines | Ch6 Week 7 (unchanged) |
| 20 | metres of the line | Ch7 |
| 13 | years Mme Benali's shutter screamed | Ch2, Ch5 |
| 43 | Gérard's receipts (the 43rd is Durand's tea) | Ch5, Ch6 |
| 44 | the slipper print (« au moins ») | Ch5, Ch6 board |
| 36 | Mme Benali's slippers | Ch5 |
| 1,8 km/h · 03:12 · 63 / 58 · 380 m | the segment | Ch5 |
| 1971 · 1974 · 1979 | the key; the shop opens; the blue | Ch6, Ch7 |
| 9 min 40 · 1 h 12 · 3 nuits | Durand's stopwatch | Ch6 |
| 123 | times Durand and Hugo crossed in the street before the boot (Durand counted) | Ch6 reveal |
| 44 | the years between them (« Quarante-quatre ans de plus que moi »; 81 − 37) | Ch6 reveal |
| des mois | how long Hugo has heard the click without looking: since the shop closed this year, not « quatre ans » | Ch6 reveal |

### 10.3 The watch (`L.watch.atChapter`, 7 entries)

| i | Chapter | face | label | lap |
|---|---|---|---|---|
| 0 | Ch1 | null (appears at the charger) | | |
| 1 | Ch2 | 0,32 km | MARCHE | 38:40 |
| 2 | Ch3 | 0,0 km | CETTE SEMAINE | null |
| 3 | Ch4 | 0,0 km | COURSE · SEMAINE | null |
| 4 | Ch5 | 0,0 km | COURSE · SEMAINE | null |
| 5 | Ch6 | 0,0 km | COURSE · SEMAINE | null |
| 6 | Ch7 | 0,0 km | COURSE · SEMAINE | null |

`COURSE · SEMAINE` stays 0,0 from Ch4 to the nail. The STRIDE **segment screen** (Ch5) shows other people's data,
and « Toi : aucun passage récent. » is the only line about Hugo's. The stakeout's STRIDE buzz congratulates him
for sitting; it doesn't change the face.

### 10.4 The notebook (`L.notebook.atChapter`, 7 entries)

| i | Seed |
|---|---|
| 0–3 | null (Ch4 creates it on Day 5) |
| 4 (Ch5) | Rouler. (struck) · Courir. (struck) · Ne pas bouger. · Poncer dans le sens du fil. · Mesurer deux fois. · Faire un gris pas triste. |
| 5 (Ch6) | + Rouler un croissant. (lune) · Trouver une crevaison. · Dévoiler une roue. |
| 6 (Ch7) | + Peindre une enseigne. · Tracer un trait fin. (mal) · Mener une enquête. |

`L.notebook.final` is the 15-line table in §8. **Layout:** 15 lines plus the heading must fit the opened page
at 80% docking scale; if not, the notebook owner tightens the line height or lets the opened view scroll
(the docked view already shows the last lines).

### 10.5 Memory keys (`src/story/memory.js`)

| Key | Default | Owner (chapter index) | Written by |
|---|---|---|---|
| `seeds.window` | false | 0 | `ch1.window` |
| `joSign` | false | 1 | `ch2.jo.menu` option 1 |
| `joLearned` | false | 4 | `ch5.week3.joMenu` options 2–3 |
| `joCroissant` | false | 4 | croissant given to Jo |
| `joStay` | false | 5 | `ch6.week7.stayMenu` option 1 |
| `joProud` | false | 5 | `ch6.week9.cuteMenu` option 2 |
| `caseFile` | `{ clues: [], suspects: {}, wrong: 0, accused: [] }` | 4 | Ch5–Ch6 (Ch6 adds, never clears Ch5's clues: owner 4) |
| `stencil` | null | 5 | STENCIL tier |
| `durandKudos` | null | 5 | `ch6.week9.bravo` |
| `ragsKept` | false | 4 | Ch5 end, if `rags` is still in the pocket (§1.5) |
| `wheel` | (unchanged shape) | 3 → **4** | Ch5 Week 4 truing |
| `teachFirst`, `panel`, `jobs` | (unchanged) | 4 → **6** | Ch7 |

---

## 11. Romance: Jo

### 11.1 Tone guard (binding)
- Flirtation and warmth. **At most one kiss on the cheek** (Ch7, warm only). Nothing explicit, no innuendo
  beyond « c’est hot », « t’es cute » and one « sexy ».
- Jo is **never** the joke because she's Québécoise. Her words are hers, used naturally, at most one or two
  markers per line, and every line is readable by a player from France. The comedy is her confidence (she says
  exactly what she thinks), her timing, and Hugo's flusters.
- She is **not impressed by kilometres** (« Deux cent douze ? Ok. Pis ? », « Quarante-trois ? Ok. Pis, y étaient
  bons ? »). She is impressed by **learning** (« Un gris pas triste. Câline. Ça, c’est une affaire. », « C’est
  hot. »).
- She is kind in deeds: the soup for Odile, the red ribbon on the right key, the soup at the stakeout, the bravo
  she presses for an old man.
- Never gated: every choice leads on; warmth only changes tone.

### 11.2 Beats and warmth (0–5)

| # | Where | Beat | Warmth |
|---|---|---|---|
| 1 | Ch2, the crooked sign | « C’est-tu droit ? » She contradicts whatever he says, fixes it herself; « Belle botte. Très mode. »; « Tu. On est pas à la banque. » | `joSign` +1 if he says « C’est de travers. » (honest) |
| 2 | Ch5 Week 3, her interview | the cerf-volant alibi; her sleeve (every tattoo is something she learned); « T’as appris quoi, dernièrement ? » | `joLearned` +1 for a skill, 0 for the 212 km |
| 3 | Ch5 Week 3, gift (optional) | the croissant: « Personne m’avait jamais donné la lune. » | `joCroissant` +1 |
| 4 | Ch5 Week 4, the truing | « Tu répares sa roue en l’*écoutant* ? Ok. C’est hot. » / « C’est quoi, hot ? » | — (always) |
| 5 | Ch6 Week 6, the key ring | the red ribbon: « Ça te fait une belle face. » or « Ok. Respect. » | — |
| 6 | Ch6 Week 7, the stencil | « Ben moi, je l’ai trouvé. »; stay or not; « Un gars qui apprend de quoi à trente-sept ans ? C’est rare. C’est hot. »; « (mal) » in her hand | `joStay` +1 for « J’arrive. » |
| 7 | Ch6 Week 9, the stakeout | the notebook (« T’es cute. »), « ce qu’il y a de plus sexy dans la rue. Pis la rue a Gérard. », then she presses Bravo for an old man | `joProud` +1 for the earnest answer |
| 8 | Ch7, her panel (optional) | the swallow: « Juste d’une place. » / « Elle a une place. » / « Fais pas ça en public. » | — |
| 9 | Ch7, after the line | « Tu me dois un souper. » … « Ben, tu vas apprendre. »; she writes « Cuisiner. (en cours) » | warm: the kiss on the cheek; cool: a tap on the shoulder |

`warmth()` = the number of true flags (0–5). **Warm is ≥ 3.** What changes with warmth (only these):
`ch7.jo.supper` (kiss or tap, and Hugo's « En petit. Dans le coin. »), `ch7.walk.jo.warm` / `.cool`, and the
ending card `jo.warm` / `jo.cool`. A player who answers honestly and stays for the stencil gets warm without
the optional croissant.

### 11.3 Jo's French (for writers adding lines later)
- **Use:** « Ben là. », « Ben voyons. », « Pantoute. », « C’est le fun. », « Tiguidou. », « Câline. »,
  « Tabarnouche. », « Pis » (= et, puis), « Faque » (= alors), « tantôt », « un chum » (a friend: « mon chum » is a boyfriend, hence « Pas mon chum chum »),
  « le char », « souper » (dinner), « Chu » (= je suis), « C’est-tu… ? », « Dis-y », « Y » (= il) in hushed
  speech, « une affaire » (= a thing), « croche » (crooked), « cégep », « Ah ben ! » (surprise), « de même »
  (like that), « montrer à » + infinitive, « tattoo » (her word; narration and stage lines say « tatouage »),
  « hein ? » as her tag question (not « non ? »). She drops « ne » always.
- **Particles, placed right** (the usual tells of a France-French writer imitating Québec):
  - « -tu » only on a yes/no question, straight after the verb (« C’est-tu droit ? »), never with a question word
    and never more than once a scene.
  - « là » points back at the word before it, mid-clause or at the end (« Pis la soupe, là, elle refroidit. »),
    never as a sentence opener, at most one per line.
  - « Ben là » is "come on / well now": exasperated or flattered, never plain surprise (that is « Ah ben ! »).
  - No « tabarnak », no « osti », no « crisse », not even as a joke. « Tabarnouche » appears once in the script
    (the calendar), « mautadine » never; leave it that way.
- **Sparingly:** « toé / moé » (not used in this script; keep it that way unless a line really wants it).
- **Avoid:** strong sacres (none, ever), stacked markers, phonetic spelling beyond « chu », « pis », « y ».

---

## 12. Voice notes

### 12.1 Speakers

| Speaker | Who | Voice | Delivery notes |
|---|---|---|---|
| `jo` (new) | Jo | screen the CML-TTS French voices with a French-accent classifier for Canadian French; keep three for the user's audition; fall back to a standard-accent mid-30s female voice | loud, warm, quick, a laugh behind most lines; hushed at the stakeout. Pronunciation map: « Pis » → « Pi », « Faque » → « Fak », « Chu » → « Chu », « C’est-tu » → « Cé-tu », « Tiguidou » → « Tiguidou », « cégep » → « cé-jèp », « tabarnouche » → « tabarnouche » |
| `durand` (new) | Le vieux monsieur, M. Durand | the oldest male voice in the repo; slower (post tempo 0.92, pitch −1 st if needed) | unhurried, precise, courteous; never sad on purpose |
| `gerard` | Gérard (was `marco`) | Marco's voice | proud, laconic; fast when calling fillings |
| `lou` | Lou (was `ines`) | Ines's voice | deadpan |
| `radio_fishing` | Radio | existing | three new lines, `radio` delivery |
| others | Hugo, Odile, Sami, Bastien, Mme Benali | existing | |

The `who` label « Le vieux monsieur » and « M. Durand » map to the same `durand` speaker (one voice, so the
player can hear it's him).

### 12.2 Deliveries
- Existing: `spoken`, `inner`, `bark`, `radio`, `voicemail`, `tv`, `flashback`.
- **New `hushed`**: the stakeout (`ch6.week9.stakeoutIntro`, `cuteMenu` replies, `stakeoutTalk`, the STAKEOUT
  barks). A spoken chain at −23 LUFS with a gentle high-shelf cut (−3 dB above 6 kHz) and a touch of the street's
  night room. The TTS text can stay as written; the context says « chuchoté ».
- **Phone**: Odile's two board hints (`ch6.week9.hint[1..2]`, `hint2[0]`) reuse the `voicemail` chain (the
  phone band). `hint2[2]` is in the room: `spoken`.
- Wrong-accusation lines (§9.3) are imagined: `spoken`, with « Scène imaginée par Hugo » in the context.

### 12.3 Estimated new voiced lines
Counted from this script (blocking lines, barks, menu replies, refusal bags and game barks; not stage
lines, cards, captions, UI, buzzes, SMS or notebook entries):

| Speaker | New lines |
|---|---|
| Hugo (spoken + inner) | ~146 |
| Jo | ~95 |
| Odile | ~45 |
| Gérard | ~40 (18 of them KEBAB WRAP calls) |
| M. Durand / le vieux monsieur | ~28 |
| Mme Benali | ~27 |
| Sami | ~22 |
| Bastien | ~11 |
| Lou | ~8 |
| Radio | 3 |
| **Total** | **~420** (writer's count 413; the editor's pass cuts about 10 voiced lines and adds about 12, so the estimate stands; within DESIGN-R4's 350–450) |

Plus the regenerated renames already in the text (Sami's two lines naming Lou, the Gérard and Lou panel lines
are labels, not voiced) and the changed `ch7.jobs.shutter.near`. Moved lines (Weeks 4 and 7) keep their clips.

---

## 13. Engineering notes the text depends on

1. **Items module** (`L.items`, `L.caseFile`): names, `def`, `desc`, kinds and seeds in §1; `items.ui.*` strings;
   the `{Tab}` key token. Required items auto-select (§0.4.3). The case tab is the notebook's back pages.
2. **Per-option speaker in `d.choose` replies**: `{ text, reply, who? }`. Needed by `ch6.week7.stayMenu` option 2
   (Odile answers in Jo's menu). Fallback: `reply: null` and a one-line `d.say([odile(...)])` after the menu.
3. **Notebook `hand: 'jo'`**: small, upright, black felt-tip, slightly bolder than pencil. `annotate(text, note,
   {hand})` must accept a hand for the note (« (mal) » in Jo's hand under Hugo's line).
4. **Speaker CSS** for `jo`, `le`, `m` (§0.2) and the accent fix for `Gérard`.
5. **Street `day` variant** (Ch5 and Ch6 by day) and **`night` variant** (Ch5 dawn, Ch6 nights): both from
   `buildScene2`; ENCRE FINE and the bench slats exist in every variant from Ch5 on; CHEZ GÉRARD's neon has
   `flicker: true` (Ch2, Ch5, Ch6 Week 5) and `false` (Ch6 Week 6 on, Ch7).
6. **Memory keys** in §10.5; `beginChapter` owners shift with the new chapter indices.
7. **Ending**: `endingLines` returns 9 strings (§8.9); the node test over the flag space adds the warmth flags.
8. **Text check** (`scripts/text-check.mjs`) limits for new UI strings: notebook entries ≤ 27, objectives ≤ 30,
   prompts ≤ 26 (one known 27: « Utiliser le papier de verre »; it only shows if the sandpaper is held over another
   hotspot), watch buzzes ≤ 60, ending cards ≤ 140, game hints ≤ 110 (a two-line chip).
9. **Watch buzz `AUCUNE ACTIVITÉ RECONNUE.`** is triggered by using the watch item on anything (§1.4.3).
10. **Wrong-accusation vignette**: the board blurs, the suspect is shown in a soft spotlight beside the board
    (reuse their model, idle pose); no new set.

---

## 14. Pacing

Estimates use 2.5 s per blocking line plus the minigame lengths and walking. "Main" skips every optional
hotspot, gift and job; "all" does everything.

| Part | Main | All | Where the time goes |
|---|---|---|---|
| Opening card | 0:15 | 0:15 | |
| Ch1 Sans impact | 2:10 | 2:35 | +keys 0:05; window 0:15 optional |
| Ch2 Ne t’arrête jamais | 2:55 | 3:05 | +shutter 0:05, Jo 0:25 |
| Ch3 À la longue | 2:15 | 2:15 | unchanged |
| Ch4 Mesurer deux fois | 3:55 | 4:15 | Day 5, Day 8, the hook |
| Ch5 Qui a huilé le rideau ? | 8:25 | 10:50 | PHOTO, CROISSANT (3), interviews, PUNCTURE, truing + Jo |
| Ch6 Service de nuit | 10:10 | 11:45 | KEBAB (2 + the tea), KEY RING, shop, OPEN sign, STENCIL (6 s), DEDUCTION, STAKEOUT, reveal |
| Ch7 Le Mur | 4:50 | 7:00 | existing 4:05 + Durand 0:30 + supper 0:20; jobs and panels optional |
| Ending | 0:40 | 0:40 | 9 cards |
| **Total** | **~35:35** | **~42:40** | writer's draft: 37:25 / 44:20 |

**Against the target (main ~32, all 35–45):** "all" is inside the band. Main is about 3½ minutes over **by this
method**, but the method runs high: the same 2.5 s rule gives 16:20 for the five existing chapters, which play in
13–16 minutes. Calibrated on that, main lands at roughly **31–35 minutes**. Time a real playthrough before
cutting anything else.

**Cut list A is applied** (editor): Bastien's spoken counts, Jo's bare-wrist lines, one footprint line, STENCIL
at 6 s, KEBAB at two orders, croissants at three. Two of its staging cuts are replaced by better ones: Ch5 Week 2
now **starts in the workshop** (no walk down and back), and Ch6 Week 6's neon scene is **merged into the 1 h
counter scene** (no morning scene at all). The Week 3 dawn spawn moves to z −18. The writer's line-index cuts
that would have lost a laugh (« Y étaient bons ? », « Elle claque les portes. Ça me plaît. », « Comme une
allure. ») are not applied.

**Cut list B** (not applied; in this order, if the timed run is still over 34 minutes):

| Cut | Saves |
|---|---|
| Ch5: the « enquêtes plus brillantes » line and the radio in `week3.wrap` (keep the stage line with the blue chip: it is fair play) | ~0:12 |
| Ch6: in `receipts`, « Trois : une assiette. Quatre… » / « J’ai compris. » | ~0:06 |
| Ch6: the STRIDE gag in `stakeoutTalk` (buzz + two whispers) | ~0:08 |
| Ch6: in `reveal`, « Mademoiselle. Vous êtes en retard pour dormir. » and the stopwatch times | ~0:10 |
| Ch6: DEDUCTION: a right clue strings itself to M. Durand once placed (one drag per question, not two) | ~0:20 |
| Ch6: STAKEOUT runs 45 s (one look-round, not two) | ~0:15 |
| Ch7: `durand.meet` « Albert. Ma clé. » / « Ta clé, Odile… » / « Je sais. Il me l’a dit en 1971. » | ~0:08 |
| Ch2: `jo.after` « C’est une botte médicale. » / « Ça empêche pas. » | ~0:05 |

Never cut: a clue scene the board needs (§9.2), the tea and « …Je cherchais la tomate. », the reveal's mirror lines,
any romance beat's last line, or a chapter's last four laugh lines.

---

## 15. Humour

### 15.1 Running jokes (where each lands)

| Joke | Beats |
|---|---|
| **Gérard's neon « ambiance »** | Ch5 Week 2 bark (« Mon néon, personne y touche. ») → Week 3 interview (« Exprès. C’est l’ambiance. ») → Ch6 Week 6 at the counter (« C’était de l’ambiance. / De kebab. ») → Lou at 2 h 10 (« Mes photos sont moins bien. ») → Week 8 (he unplugs it twice a night) → Ch6 key ring (« le proprio la garde pour l’ambiance ») → board (« Mon néon, c’est de l’ambiance. ») → reveal (« Le néon, je regrette. ») |
| **Mme Benali's moons** | Ch5 CROISSANT grades (« C’est une lune. Encore une. », « Pleine lune… plus croissante. », « Que des lunes. C’est un calendrier. ») → « Le plus lunaire. » → the croissant gift (« Personne m’avait jamais donné la lune. ») → notebook « (lune) » → Ch7 panel (existing « J’ai décidé que c’était la lune. ») |
| **The radio's fishing man has a theory** | Ch5 Week 2 (the pike borrows and brings back) → Week 3 (fish make loops; « Lui, il avance. ») → Ch6 Week 7 (the old carp that doesn't sleep) → Ch7 (the four stations, existing) |
| **STRIDE congratulating the wrong things** | croissant (« PÉTRISSAGE DÉTECTÉ »), kebab (« ESSAYER LE YOGA ? », « 2 H DU MATIN… »), stencil (« FRÉQUENCE CARDIAQUE ÉLEVÉE »), board (« ACTIVITÉ CÉRÉBRALE NON RECONNUE »), stakeout (« SÉANCE NOCTURNE DÉTECTÉE ! »), and the bravo that blows the stakeout; the segment screen's « On s’y remet ? » |
| **Bastien's data** | Ch5 Week 3 (the recital, then « DEUXIÈME. ») → the board (« ma montre fait JAMAIS de pause ») → Ch7 club (existing) |
| **Odile is frightening, and proud of it** | Ch4 hook (« J’y ai beaucoup travaillé. / Ça se voit. / Merci. ») → Week 3 (« Sa mère fait plus peur que moi. ») |
| **Odile's coffee is a crime** | Ch2 (existing) → Ch6 offer (« Celui d’Odile est un crime. / Je sais. Ça fait cinquante ans. ») |
| **« Très bon » → « excellent » kebab** | Ch6 (« C’est un très bon kebab. ») → Ch7 (existing « C’est un *excellent* kebab. ») |
| **The mystery key** | Ch1 (« une porte quelque part va se sentir bête ») → Ch6 (« La porte ne se sent pas bête du tout. ») |
| **« le grand avec la botte »** | Ch2, Ch5 Week 3 (Jo) |
| **The armoire** | Ch2 Odile (« comme une armoire qu’on aurait lâchée ») → Ch5 Week 2 Odile (« et maintenant l’armoire a une botte ») → Ch6 Durand (« Vous faites un bruit d’armoire, jeune homme. ») |
| **Hugo never looks up** | Ch3 wordless seed → Ch6 the tea (« …Je cherchais la tomate. ») → the reveal (« Vous regardiez votre montre. » / « Je lui ai même servi un thé. ») |

### 15.2 Laugh lines per chapter (at least four new or kept in each)
Listed at the end of each chapter section. House rules: dry and specific; the joke is on Hugo, on numbers or
on pride; never on the injury, Jo's accent, Durand's age, or anyone's job (Gérard defends his own: « C’est mon
métier, pas ton loisir. »).

---

## 16. Open issues for the user and the next agents

1. **Main path length:** ~35½ min by the 2.5 s rule after the editor's pass (31–35 calibrated against the
   existing chapters), ~42½ with everything (§14). Time a playthrough, then apply cut list B if needed.
2. **Jo's voice:** the Canadian-French screen may find nothing usable; the fallback is a standard-accent voice
   with her vocabulary (DESIGN-R4 risk, unchanged). The user auditions three.
3. **Nine ending cards** may not fit a landscape phone; fallback drops the radio card (§8.9).
4. **Fifteen notebook lines** need the opened page to fit or scroll (§10.4).
5. **Odile knew** (§0.4.7) is a script addition; if the user prefers Odile honestly fooled, cut `ch7.durand.meet`
   from « Tu savais ? » to the closing stage line, the stage line in `ch5.week3.wrap` and the name in `hint2`
   (« Albert Durand. »), and Odile's hint keeps only the « cinquante-deux » line.
6. **`i18n-fr.md`** should absorb §0.2 (Jo, Durand, Gérard, Lou in the tu/vous matrix; the minced-oath
   exception) and the new echo uses: « Personne te chronomètre » (Ch6 Jo / Ch7 Odile), « Elle tient » (Durand),
   « Comme ça, on voit ce qui manque » (Ch4 / Ch6 shop), « un monsieur des roues » (Ch5 / Ch6), « Je la bats tous les
   matins » (Ch3 / Ch5 dawn / Ch6 end), « armoire » (Ch2 / Ch5 / Ch6), « Marchez, si vous y tenez » / « Le médecin
   m’a dit de marcher » (Ch1 / Ch6), « Apportez votre café » (Ch2 Odile / Ch6 Hugo), « Que seuls les gens du métier
   le trouvent » / « Ben moi, je l’ai trouvé » (Ch6). Also the Québécois particle rules of §11.3 and a text-check
   exception for four-digit years in dialogue (1971, 1974, 1979).
7. **Week 12 calendar:** Odile's « Douze semaines depuis le dimanche » still holds; the Weeks 10–11 card must come
   before the « Semaine 12. » card.
8. **Built game modules** (`src/story/games/*.js`) were written from DESIGN-R4 before this script and carry their
   own French fallbacks. Their text shapes differ from §6.5 and §7.6 in places (§17.3). The chapter builders pass
   this script's strings through `opts`; where a module needs a line the script lacks, they may keep the module's
   fallback after checking it against i18n-fr.md.
9. **DESIGN-R4 « Script decisions »** still describes the first draft's cut list and a 16-line notebook. The script
   wins; its owner may want to update those two bullets.

---

## 17. Editor's notes (2026-10-08)

An editor's pass over the writer's draft, done the same day. The draft was strong: the mystery's spine, Jo's arc
and most of the jokes are the writer's and are unchanged. Builders were already copying from the draft
(`src/story/text/items.js` and `caseFile.js`, and six game modules, exist), so §17.1 lists every string that
changed. **Re-sync those keys.**

### 17.1 Strings and structure changed (re-sync these)

| Where | Change |
|---|---|
| `items.phone.desc` | « Douze messages, zéro réponse… » (he has read them by Ch2) |
| `items.refuse.odile` | all three lines now pronoun-free (the bag can fire in Ch4 Day 5, while she still says vous) |
| `items.refuse.jo[1]` | « Si tu veux me faire un cadeau, apprends de quoi. » (was about soup and compliments, and repeated Gérard's) |
| `items.give.croissant.odile` / `.bastien` | « Elle progresse. » / « …c’est pas un jour de sortie longue ! …Bon. Je le mange en courant. » |
| `items.give.kebab` | `odile` rewritten (« Un kebab froid… »; the old « dix heures du matin » was wrong: he gets it at 2 a.m. and sees her at 4 p.m.); `bastien` and `lou` removed (not on set once he has it) |
| `items.give.rags.durand` | needs `ragsKept` (new memory flag, §1.5, §10.5): pockets reset per chapter, so the line was unreachable |
| `items.atChapter[6]` | no `spokeKey` (it is hung back in Ch5; nothing in Ch7 needs it) |
| `caseFile.clues.slat52.note`, `.receipts.note` | wording; receipts now records the tea he served |
| `caseFile.questions.q1` | « Qui passe dans la rue à 3 h ? » (« marcher la rue » is a calque of "walk the street") |
| suspect pins | timing defined (§1.3): the board always has 8 |
| `ch4.day8.tapeTake` | « Si je le prends, ça se verra. C’est le principe. » (plants the hook's empty outline) |
| `ch5.week2` | **starts in the workshop**; `pass` bark cut; `neon` bark rewritten to set up the rewire; `workshop` lines 2, 4, 5, 7 tightened; Odile's « classeur » becomes her own Ch2 « armoire » |
| `ch5.week2.photoDone` | no notebook entry; « C’est le téléphone qui sait faire, pas moi. » |
| `ch5.week3` | dawn spawn at z −18 and a new first thought; Hugo's reply to Mme Benali; `benaliAfter` « Le plus lunaire. »; `brief` one line shorter; new optional `oldmanLook`; Bastien's spoken counts cut; segment thought reworded; Jo's « chum » exchange, « Chaque tattoo », wrist lines cut; menu option 3 « rouler »; `print` « cette nuit »; `needs.printChalk`; `hubDone` pins skipped suspects; `wrap` plays straight after `samiAfter` |
| `games.puncture` | `steps.*` (the built module's sand/glue/press), Sami's `glue` and `patch` barks, Hugo's thought |
| `games.croissant` | **3** croissants; counter; end tiers no longer count |
| `ch5.week4` | Jo's block sits between `after[1]` and `after[2]` |
| `ch6.week6` | neon scene **merged into `kebabIntro`** at 1 h (no morning scene; `objectives.gerard` dropped); new `lou` bark at 2 h 10; `receipts` + « Ceux de la nuit du rideau » + « Tu l’as servi toi-même » / « …Je cherchais la tomate. »; new `ch6.needs.shopDoor`; Jo « Bonne chance. », « Ah ben ! », the calendar « Tabarnouche », `shopOut[1]` |
| `games.kebab` | **2 orders** in the built module's `orders` shape, the **tea** beat, mistake-based tiers, the « Samouraï » bowl |
| `games.keyRing` | assist line 3: « Ça te fait une belle face. » |
| `ch6.week7` | `joEnter` lines 1–2 (« Josianne »); a cut and the caption « 18 H » after « Quel trait ? »; `joBack[5]` « montrer à tracer »; `stencilAfter` + DESIGN-R4's « Un gars qui apprend de quoi à trente-sept ans ? »; STENCIL 6 s |
| `ch6.week9` | `boardIntro` (no clue count); `boardDone[1]`; `stakeoutTalk[2]` « sexy »; `reveal` (stage line, « cent vingt-trois fois. J’ai compté. », « Des mois… Je lui ai même servi un thé. », Durand's grammar, the daughter's watch, « Quarante-quatre ans », « Vous devriez dormir. » / « Le médecin m’a dit de marcher. Il n’a pas dit quand. »); `hint` rewritten (two lines); `end[0]` « hein ? » |
| `ch7` | `weeks10` thought; `durand.meet` + a stage line; `jo.panel[0]` « Je dis ça de même. »; new changed card `ending.cards.job.shutter` |
| notebook | « Rouler un croissant. » (was « Plier… »), « Mener une enquête. » (was « Mener l’enquête. »), no photo entry: **15 lines** |
| spoken « Mme Benali » | « madame Benali » in seven spoken lines (i18n-fr.md §4.6; labels and signs keep « Mme ») |

### 17.2 Why

- **Mystery.** The draft played fair, but two links were soft and one was wrong:
  - **Soft: how Hugo could miss Durand.** The tea is now where the reveal starts. Hugo serves Durand at the
    counter without looking up (« …Je cherchais la tomate. »). Three scenes later Durand says « Vous regardiez votre
    montre. », and the player has seen it happen once.
  - **Soft: the D.52 name.** It is now explained in one line with no explaining (« Ma fille m’a offert une montre
    pour savoir si je dors. Maintenant, elle sait. »).
  - **Wrong: « Quatre ans que j’entends son clic ».** Durand only walks since he closed this year. It is now « Des
    mois ». His « cent fois. Plus. » becomes a count, « cent vingt-trois fois. J’ai compté. », which is the mirror
    stated by him rather than by Hugo.
  - **Wrong: the doctor callback.** Hugo couldn't know what Durand's doctor said. Durand says it now, after
    Hugo's « Vous devriez dormir. » (the one man who never rests saying it).
  - **Wrong: the staircase.** Durand never had a reason to know about « descendait l’escalier » (he doesn't
    live at No. 14); it is now « partait courir ».
  - **Wrong: the hint.** Odile can't hear pins three floors up; she hears the boot.
  - **Clues and pins.** « Dix indices » was false whenever the optional clues were skipped. The board's pins are
    now defined so it always has 8. The optional sawdust on the old man's sleeves adds a fair-play tell for the
    attentive.
- **Jo.**
  - « Ici. Avec mon chum Karim. » / « Mon ami. » had it backwards: in Québec « mon chum » is a boyfriend. The
    exchange now uses that (« Pas mon chum chum. »), which is both correct and a better joke.
  - « Chaque affaire » collided with « L’AFFAIRE »; it is now « Chaque tattoo ».
  - « non ? » tags became « hein ? ».
  - « Ben là » is kept for exasperation or flattery only; surprise is « Ah ben ! ».
  - « C’est le fun » appears once, « Tabarnouche » once.
  - Her flirting now climbs: hot (Week 4) → « C’est rare. C’est hot. » (Week 7) → « sexy » (Week 9) → a kiss
    on the cheek (Ch7, warm). « T’es cute » was used twice; it is now saved for the stakeout.
  - The particle rules in §11.3 are for anyone adding her lines.
- **French.**
  - Calques and grammar: « marcher la rue » (×3), « des bonnes manières », « débordantes d’un centimètre », and
    Durand's « C’est les mêmes heures. Il fait juste noir. »
  - The pronoun-free Odile refusals.
  - « madame Benali » in speech.
  - Typography lint after the pass: 0 issues (no ASCII space before `? ! : ;`, every « » with U+202F, no straight
    apostrophes or `...` in French strings).
- **Humour.**
  - Cut jokes that were told twice: « le corps n’est pas au courant » (thought, then spoken), « dix heures cinq »
    (Weeks 10–11 card, then the ending card), Mme Benali's pass bark before her own scene, and the neon bark
    duplicating the Week 3 interview.
  - Cut lines that only restated the stage line, such as Odile's description of the key and rags.
  - New laugh lines: « Mes jambes n’ont pas lu l’ordonnance. », « Pas mon chum chum. », « Le plus lunaire. »,
    « …Je cherchais la tomate. », « Mes photos sont moins bien. », « C’est le téléphone qui sait faire, pas moi. »,
    « Si tu veux me faire un cadeau, apprends de quoi. »
- **Continuity.**
  - The croissant, puncture and kebab tier lines contradicted their own counts (« Six croissants… » on a 4/6
    run; the 30-count against a 3 s press).
  - Rags, kebab and Ch7 pocket entries were unreachable.
  - Lou's and Mme Benali's Ch6 barks were promised but unwritten.
  - « Quel trait ? » was stepped on by « Montre-moi ça. »
  - Jo arrived at the truing before Hugo said « Tu écoutes », the line she reacts to.
- **Pacing.**
  - Cut list A is applied, except the parts that would have cut laugh lines.
  - Two walks are removed: Ch5 Week 2 now starts in the workshop, and the Ch6 Week 6 morning scene is merged
    into the 1 h counter scene.
  - New estimate: ~35½ min main / ~42½ all by the writer's 2.5 s rule. Calibrated against the existing
    chapters, that is about 31–35 for main.
  - Cut list B (§14) is ready if a timed run says otherwise.

### 17.3 Watch for (chapter builders)

1. **Built game modules vs this script.** They take text through `opts`:
   - **KEBAB:** `orders: [{ call, items }]`; §7.6.1 is now written in that shape. Add the tea between the orders
     as a scripted beat; it doesn't need to be a game step.
   - **PUNCTURE:** `text.steps.{sand, glue, press}`; the strings are in §6.5.2.
   - **CROISSANT:** `count: 3`. The module's `grades` keys are the script's (`perfect`, `ok`, `moon`, `fast`, `slow`).
   - **KEY RING:** `text.assist` takes all three assist lines as `{ who, text }` (the module plays them as a
     `d.say` while Jo's pencil ring points, then the ring turns to the ribbon). `text.wrong` is her bag. The game
     id is `keyring`; its text is `L.games.keyRing`.
   - **STENCIL:** `band.{slow, good, fast}` is TREMBLE / BIEN / SAUTE.
   - Where a module wants a line the script lacks, keep its French fallback only after checking it against
     i18n-fr.md.
2. **Tu/vous, checked line by line.**
   - Hugo → Odile has no pronoun from Ch5 until `ch6.week7.wrap[1]`, then tu (`ch7.durand.meet`).
   - Odile → Jo is vous, plus « Josianne ».
   - Jo → everyone is tu.
   - Durand → Hugo, Jo and Lou is vous; Durand → Odile and Sami is tu. Sami → Durand is vous. Durand always keeps
     « ne ».
3. **Speaker labels.** « Le vieux monsieur » and « M. Durand » share the `durand` voice. They need an explicit
   CSS class map (`durand`), not the first-word rule (`le`, `m`). « Gérard » → `gerard` per i18n-fr.md §4.6.
4. **3 h 12 recurs** (D.52's last passage, Durand's calendar, and the existing Week 7 buzz « Immobile depuis
   3 h 12 min »). Leave it: it reads as fate, not as an accident.
5. **Years in figures** in dialogue (1971, 1974, 1979) are deliberate: French writes years in figures even in
   prose. `scripts/text-check.mjs` may need an exception for four-digit years.
6. **Variety rule.**
   - PHOTO → CROISSANT and KEBAB → KEY RING are both mouse games back to back. They use different gestures
     (aim and click vs a drawn arc; drag to a target vs turn and click), which passes.
   - Don't insert another mouse game between them.
7. **Index references in this document are by content wherever lines moved.** If a block's index and its quoted
   text disagree, the quoted text wins.
8. **Not mine to edit, flagged:**
   - `docs/i18n-fr.md` should absorb §0.2, §11.3 and the echo chains in §16.6.
   - DESIGN-R4's « Script decisions » still cites the draft's cut list and a 16-line notebook.
