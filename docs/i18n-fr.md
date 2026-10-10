# HAIRLINE: French style guide and glossary (binding)

HAIRLINE is written in French, and only in French. This guide binds everyone who writes or edits its
text: new chapters, new characters, signs and UI. If a wording is fixed here, use it exactly. Everywhere
else, follow the voice rules. The aim is French that reads as if a good French novelist and game writer
wrote it.

- **Source:** `src/story/text/{common,ch1..ch5}.js` (the text as shown), with the story in
  `docs/DESIGN.md` and `docs/DESIGN-R4.md`.
- **Check:** `node scripts/text-check.mjs` (CI runs it; exit 1 on errors). It checks the typography of
  section 5, key tokens, UI length limits and leftover English. After changing a voiced line, run the
  voice pipeline (`docs/voice.md`).
- **Characters:** this file uses the real characters: `’` (U+2019), `…` (U+2026), `«`/`»`, and the narrow
  no-break space ` ` (U+202F) before `? ! : ;` and inside guillemets. Copy them as they are.
- **When in doubt:** keep the subtext, keep it short, keep the joke.

---

## 1. Global voice rules

- **Write French first.** Write what a line *does* (the deflation, the tenderness, the joke) the way a French writer would say it, never as a word-for-word calque: « Voilà. C’est ça. », not « C’est la chose. ».
- **Tense:**
  - Contemporary spoken-literary French: present, passé composé and imparfait.
  - **No passé simple anywhere**, including the opening and ending cards.
- **Short sentences stay short.**
  - The game is built on fragments, and French does them naturally with nominal sentences: « Banc mouillé, dans le noir. ».
  - Never merge two short sentences into one long one with a relative clause.
- **The "ne" of negation:**
  - **Inner monologue (Hugo, `think`/`inner`) and the cards:** keep it. It is the written voice (« Je ne sais pas »).
  - **Spoken lines:** drop it according to the character (see section 2). Sami and Bastien always drop it. Odile drops it about half the time, mostly in short orders (« Bouge pas. », « Va pas raconter… »). Hugo drops it only when he is tired or bantering.
  - **STRIDE, the doctor's office and the TV:** always keep it.
- **Numbers:**
  - Spell them out in dialogue and thoughts (« deux cent douze virgule quatre »).
  - Use figures on cards, captions, the HUD, STRIDE and signs.
  - Use traditional spelling, not the 1990 all-hyphens reform: « quarante et une », « deux cent douze », « quatre-vingt-deux ».
- **Anglicisms:** only where a French speaker of that profile would really use one. Bastien says « la team » and « les bornes ». Sami says « T’as vu ? ». A STRIDE screen says « récup ». Hugo and Odile never use anglicisms.
- **Stage lines** (`stage()`, `*...*`) are present tense and neutral-literary: « Elle regarde longuement la botte. ». Keep the `*…*` markup and any inline `*emphasis*`.
- **Swearing:** none. « Débile », « nul », « fichu » are the ceiling; Jo's church words (« câline », « tabarnouche ») are the only exception.

---

## 2. Voices, with anchor lines

Each voice comes with anchor lines from the game: match their register when you write new lines for that character.

### Hugo, spoken and inner monologue (37, ex-domestique, counts everything)
- **Voice:** dry, laconic and self-mocking. He makes understatements and states numbers as facts. He has no self-pity, and the joke is always on himself.
- **Inner monologue:**
  - It reads like a good French noir narrator: nominal sentences, a final deflating clause, « Efficace, au moins. ».
  - Its numbers are spelled out.
  - It addresses no one: a generic subject is « on » or an impersonal form, never « vous ».
- **Spoken:** even shorter. He answers questions with the minimum.

- Trente-sept ans. Deux mots. Barrés tous les deux à dix heures dix. Efficace, au moins.
- Ne t’arrête jamais. Je l’ai pris comme un conseil. C’était un slogan pour des baskets.
- Franchement ? Plus depuis mes dix-neuf ans.

### Odile (74, sign painter, hates sentiment)
- **Voice:** clipped orders, verbless sentences, dry wit and craft words. Her vocabulary is slightly old-fashioned: « bonhomme », « fichu », « pompette ».
- **She never** says « s’il vous plaît/te plaît », uses youth slang, or explains a joke.
- **Her tenderness** shows only in what she does, never in an adjective.
- **Asking is hard for her.** Never give her a soft request formula (« tu pourrais… ? »). She gives orders.

- Non, l’autre bonhomme en botte. Le frein de roue a lâché. Tenez l’échafaudage avant que je descende plus vite que prévu.
- Alors tire un trait dessus. Légèrement. C’est un crayon, pas un tatouage.
- J’ai besoin de quelqu’un pour— / …Tiens-moi cette planche.

### Sami (11, Parisian kid, cheeky and literal)
- **Voice:** he always drops the « ne » and uses « t’as », « y a », « c’est nul/débile », « trop » and « mais ».
- **He asks the literal question** adults don't.
- **No dated slang** (« wesh », « grave », « chelou » date fast). Keep him timeless-urban and age-true.
- He calls adults by their first names.

- Pourquoi t’as une chaussure de ski ?
- C’est débile. / …C’est moins débile.
- …Elle est remontée. Elle est *remontée*. T’as vu ?

### Bastien (40s, run-club captain, lives in his watch)
- **Voice:** a hearty French running bro: « mon pote », « mec », « la légende », « les bornes », « la team ».
- **Exclamations everywhere:** « Ha ! »
- **Run-club franglais** is allowed (« la sortie longue du dimanche », « mon chrono »).
- **He is nice, never mean.** The comedy is that he can't hear himself.

- Hugo ! Mon pote ! Et cette jambe ?
- La classique ! Trop de bornes, hein ?
- …C’est permis, ça ? J’ai le tibia un peu bavard, d’ailleurs. Mais bon, comme tout le monde !

**Bastien's SMS** (Ch1 phone): a sloppy text message. Leave out commas and the hyphen in « repose toi », and use CAPS for emphasis. Still use U+202F before `!`, for the checker.
> Appris pour ta jambe mec !! Repose toi la légende. La sortie longue du dimanche c’est PAS pareil sans toi

### Dr Okafor and his office (voice only)
- **The secretary** is polite, formal and slightly embarrassed to be reading the doctor's joke aloud. She uses vous and « monsieur Revel ».
- **The doctor (Ch3)** is calm and precise and uses real radiology words (« trait de fracture »).

- Monsieur Revel, ici le cabinet du docteur Okafor. Je vous rappelle que la botte reste en place, y compris au lit, et aucun impact d’aucune sorte pendant douze semaines. Le docteur Okafor m’a demandé d’ajouter, et je cite : « Ça inclut le petit footing pour voir ce que ça donne. »
- Vous voyez, là ? Non. Là.
- Le trait est plus fin qu’un cheveu, monsieur Revel. Mais il va jusqu’au bout.

### STRIDE (the watch and app: chirpy corporate)
- **Voice:**
  - Tutoiement, as French sport brands do.
  - Exclamation marks and cheerful jargon (« récup », « séance », « charge d’entraînement »).
  - **Alerts in CAPS.** Accents stay on capitals (« DÉTECTÉ », « ÉLEVÉE »).
  - No emoji.
- **Its catchphrase** is always « ON BOUGE » (« ON BOUGE ! » as an alert, « ON BOUGE ? » as the final question).
- **App buttons** are nouns or infinitives with no period (« Jour de repos », « Ignorer »).

- Bilan de la semaine : 0,0 km. Allez, on s’y remet !
- STRIDE : Six jours d’affilée ! La récup fait partie de l’entraînement. Un jour de repos ?
- ON BOUGE ! Immobile depuis 1 h.

### Mum (SMS)
Bossy, loving and brief. She uses tu and drops « ne ».
> **Maman :** Tu manges, au moins ? Réponds pas. Mange.

### Lou (16, former tagger)
- **Voice:** deadpan teen, phone always out.
- **She vouvoies Hugo** with a hint of eye-roll, which is very natural from a French teen to an adult she barely knows.

- J’ai tagué ce mur huit fois. C’est la première fois qu’on me *tend* la peinture.
- Bizarre. Légal.
- De vous. Devant le mur. C’est le principe d’une photo.

### Gérard (50s, CHEZ GÉRARD) and Mme Benali
- **Gérard:** proud and laconic; lives on four hours of sleep and is very proud of his kebab.
- **Mme Benali:** warm and serene. She speaks proper French and keeps « ne ».

- Odile a dit de peindre ce qu’on sait faire. Moi, je fais un très bon kebab. Donc.
- C’est un *excellent* kebab.
- Je voulais peindre un croissant. Ça a donné un croissant de lune. J’ai décidé que c’était la lune.

### Jo (Josianne Lavoie, 34, fine-line tattoo artist from Hochelaga, Montréal)
- **Voice:** loud, blunt, flirts openly, and the kindest person on the street. The comedy comes from her confidence, never from her accent.
- **She tutoie everyone from her first line** (Québécoise), Odile and Mme Benali included.
- **Light Québécois markers, no caricature:** « pantoute », « c’est le fun », « t’sais », « ben là », « tiguidou », « chu », « pis », « faque », « tantôt », « souper », « le char », « croche », « de même », « montrer à » + infinitive, « tattoo » (her word; stage lines say « tatouage »). She drops « ne » always. « Un chum » is a friend but « mon chum » is a boyfriend, hence « Pas mon chum chum. ».
- **Swearing:** church words only (« câline », « tabarnouche », « mautadine »), the Québécois « mince » or « purée »; this stays under the game's ceiling (section 1). « Tabarnouche » appears once (the calendar), « mautadine » never. No « tabarnak », « osti », « crisse », not even as a joke.
- **Particles, placed right** (SCRIPT-R4 §11.3; the usual tells of a France-French writer imitating Québec):
  - « -tu » only on a yes/no question, straight after the verb (« C’est-tu droit ? »), never with a question word, at most once a scene.
  - « là » points back at the word before it, mid-clause or at the end (« Pis la soupe, là, elle refroidit. »), never as a sentence opener, at most one per line.
  - « Ben là » is "come on / well now", exasperated or flattered, never plain surprise (that is « Ah ben ! »). Her tag question is « hein ? », not « non ? ».
  - « C’est le fun » appears once. Avoid stacked markers, « toé / moé », and phonetic spelling beyond « chu », « pis », « y » (= il, in hushed speech).
- **What gets her** is Hugo learning something new, not his kilometres.

- Deux cent douze ? Ok. Pis ? Tu sais faire quoi d’autre ?
- Un gars qui apprend de quoi à trente-sept ans ? C’est rare. C’est hot.

### M. Durand (Albert Durand, 81, CYCLES DURAND for 52 years)
- **Voice:** slow, courteous, old-school shopkeeper; precise about tools and opening hours. He keeps « ne ».
- He vouvoie Hugo and Jo; he tutoie Sami (he gave him the bike) and Odile (fifty years on the same street).
- In speech he is « monsieur Durand »; on labels and signs « M. Durand ».

### TV commentator (Ch1)
French cycling-broadcast register: « les équipiers », « se relever », « mission accomplie ».
> …et voilà, le travail des équipiers est fait. Un à un, ils se relèvent, vidés. Mission accomplie.

---

## 3. Tu / vous matrix

Rows are the speaker and columns the addressee.

| speaker ↓ / to → | Hugo | Odile | Sami | Bastien | Lou | Gérard | Mme Benali | Jo | Durand |
|---|---|---|---|---|---|---|---|---|---|
| **Hugo** | — | **vous → tu at Ch6 Week 7** | tu | tu | tu | tu | vous | tu | vous |
| **Odile** | **vous → tu at Ch4 Day 5** | — | tu | n/a | vous (pl. to the street) | vous (pl.) | vous | vous | tu |
| **Sami** | tu | tu | — | n/a | n/a | n/a | n/a | tu | vous |
| **Bastien** | tu | n/a | n/a | — | n/a | n/a | n/a | n/a | n/a |
| **Lou** | vous | n/a | n/a | n/a | — | n/a | n/a | tu | vous |
| **Gérard** | tu | n/a | n/a | n/a | n/a | — | n/a | tu | vous |
| **Mme Benali** | vous | n/a | n/a | n/a | n/a | n/a | — | vous | vous |
| **Jo** | **tu** | **tu** | tu | tu | tu | tu | **tu** | — | **tu** |
| **Durand** | vous | tu | tu | n/a | vous | vous | vous | vous | — |

The Jo and Durand rows and columns are the defaults for Revision 4; a chapter author who changes a pair updates this table.

Revision 4 notes on the matrix (SCRIPT-R4 §0.2):
- **Jo tutoie everyone from her first line,** Odile, Mme Benali and M. Durand included. Hugo starts in vous and switches after her correction in Ch2 (« Tu. On est pas à la banque. »). That is the only switch anyone remarks on.
- **Odile → Jo: vous,** and she calls her « Josianne ».
- **M. Durand:** vous to Hugo (« jeune homme »), Jo (« mademoiselle », which she enjoys) and Lou; tu to Odile (« Odile » / « Albert », fifty years on the same street) and to Sami. Hugo → Durand: vous, « monsieur Durand ».
- **Sami → Durand: vous** and « monsieur Durand », the only adult Sami vouvoie. Nobody comments.
- « Le vieux monsieur » (Ch5) is Durand before Hugo learns his name: same voice, same vous.

Other speakers:

| Speaker | Address | Notes |
|---|---|---|
| Dr Okafor | vous | « monsieur Revel » |
| Doctor's office | vous | « monsieur Revel » |
| Mum | tu | |
| STRIDE | tu | |
| Odile's father (quoted) | n/a | |
| Reported doctor | vous | « Marchez, si vous y tenez. » |

**System text speaks to the player with no pronoun at all.** Objectives, prompts, hints and buttons use the infinitive (section 4.3), so the UI never has to choose between tu and vous.

### Odile → Hugo: vous, then tu from `ch4.day5.book[3]`
- **Ch2, the Ch3 present scene and Ch4 Day 5 arrival: vous.**
  - « Vous. Avec la botte. », « Vous savez ne pas bouger ? », « Citez-en une. », « Jusqu’où ? », « Et vous alliez où, comme ça ? »
  - Day 5: « Vous êtes en avance. », « Votre chaussure. »
- **The switch:** `ch4.day5.book[3]`: « **Avant toi ?** Deux. Moi et mon père. ».
  - At the moment she counts the people who have worked in her workshop, she counts him in. The tu is the counting.
  - It also follows the French workshop tradition, where the patronne tutoie whoever works at her bench.
- **From that line on, always tu:** « Tu peux faire l’un des deux, ce mois-ci ? », « Écris-le. », and so on through Ch5.
- **Nobody remarks on the switch.** Do not add a line about it.
- The optional hotspots that are open on Day 5 (`oldSigns`, `radio`) have no pronoun to Hugo, so they are safe on either side of the switch.

### Hugo → Odile: vous, then tu at `ch6.week7.wrap[1]` (Revision 4: Week 7 moved to Ch6)
- Hugo addresses Odile with a pronoun only once in the whole game: « **…Tu veux le peindre.** ».
  - Until then he says vous to her: it is a 37-year age gap, she is the boss, and he has a domestique's habits.
  - The switch comes minutes after the near-ask (« J’ai besoin de quelqu’un pour— » / « …Tiens-moi cette planche. »), which is followed by *He takes it. Neither of them mentions it.*
  - In that wrap he reads her unspoken ask and names it for her. The reciprocal tu is his half of the "neither of them mentions it" contract.
- **Every other Hugo → Odile line has no pronoun.** Keep it that way: « Un trait. », « Et s’il tremble ? », « En petit ? ». Never add a vous or tu a line does not need.
- **If Hugo needs to address Odile anywhere before Week 7** (for example a new line added later), use vous. Revision 4's Ch5 and early Ch6 lines to her avoid the pronoun; from Ch7 he uses tu (one new case: `ch7.durand.meet`, « Tu savais ? »).

---

## 4. Glossary: fixed wording

### 4.1 Notebook: `CE QUE JE SAIS FAIRE`

- **Form:** infinitive, capitalised, with a final period, in pencil voice.
- **Heading:** **CE QUE JE SAIS FAIRE**.
  - Use *savoir*, not *pouvoir*: it is the workshop's list of savoir-faire.
  - Odile's strike question uses *pouvoir* on purpose: « Tu peux faire l’un des deux, ce mois-ci ? ». He still knows how to run but cannot, so the lines are struck lightly.

| key | Entry | Note |
|---|---|---|
| ride | **Rouler.** | The cyclist's verb. |
| run | **Courir.** | |
| hold | **Ne pas bouger.** | Echoes Ch2 « Vous savez ne pas bouger ? » and Ch4 « Tu sais ne pas bouger. ». The skill that is a not-doing is the opposite of « Ne t’arrête jamais ». |
| sand | **Poncer dans le sens du fil.** | 27 characters, the cap. « fil » is the woodworker's grain. |
| measure | **Mesurer deux fois.** | |
| grey | **Faire un gris pas triste.** | « pas triste » is also the idiom "quite something". Painters "font" a grey; they don't « mélangent » it. |
| wheel | **Dévoiler une roue.** | The real mechanic's term (une roue voilée). The secondary sense, "unveil", is a happy accident. |
| sign | **Peindre une enseigne.** | Matches the ghost sign "ENSEIGNES — DORURE" and the trade, « peintre en lettres ». |
| teach | **Aprendre.** | Sami's hand. One missing *p* is the most natural spelling mistake a French 10–11-year-old makes. *Apprendre* means both teach and learn. It pays off in Odile's « Tu apprends. » and the ending card « gratuit pour ceux qui veulent apprendre ». Hugo doesn't correct it. Never "fix" it. |
| rest | **Se reposer.** | Infinitive, to keep the list's grammar. The STRIDE menu button stays the noun « Repos ». |
| someSundays | **(certains dimanches)** | |
| *Odile's list* (ending) | **« Demander. »** | |

### 4.2 Chapter titles (French title case: only the first word, plus the noun after an initial article)

| # | Title | Why |
|---|---|---|
| 1 | **Sans impact** | The medical order, and also "with no effect". |
| 2 | **Ne t’arrête jamais** | Same wording as the STRIDE slogan (see 4.6). |
| 3 | **À la longue** | Means "in the long run" and contains *longue*, a nod to the *sortie longue*. |
| 4 | **Mesurer deux fois** | |
| 5 | **Le Mur** | The marathon's « mur » and the mural wall. |

Revision 4's new chapters add their titles to this table when they are written.

### 4.3 System text style

| Kind | Rule | Examples |
|---|---|---|
| Objectives (`objectives`) | **Infinitive, final period.** | Regarder autour de soi. · Aller marcher. · Marcher. · Tenir l’échafaudage. · Garder le rythme. · **Aller au bout.** (Ch3 "Finish.") · Prendre le papier de verre. · Poncer la porte. · Mesurer l’encadrement. · Regarder le vélo. · Voir ce que fait Odile. · Trouver Odile. · Aider Sami. · Peindre le trait. · S’asseoir sur le banc. · Rentrer à pied. · **Raccrocher la montre.** |
| Hotspot prompts (`prompts`, shown as `[E] …`) | **Infinitive, no period, capital first letter.** A `[{KeyE}] ` prefix shows a key chip. | Regarder · Éteindre · Lire les messages · Prendre la montre · Sortir · `[{KeyE}] Démarrer` · Lever les yeux · S’asseoir · Se lever · Prendre le papier de verre · Poncer · Mesurer · Écouter · Prêt · Aider · `[{KeyE}] Défaire les sangles` · `[{KeyE}] Saluer` · Enlever la montre · Parler |
| Hints (`hints`) | Infinitive or nominal. No tu or vous. | Maintenir {Shift} pour trottiner · Alterner {KeyA} et {KeyD}. Régulier, pas rapide. · Alterner {KeyA} et {KeyD}. Régulier. · Le pinceau suit la craie. {KeyW}{KeyA}{KeyS}{KeyD} : petites corrections seulement · {KeyW} / {KeyS} pour stabiliser le pinceau · Ne toucher à rien · {Space} |
| Buttons and menus | Infinitive or noun, no period. | Cliquer pour commencer · Continuer quand même · Recharger · Reprendre · Recommencer le chapitre · Rejouer · Voix · Graphismes · Bas / Moyen / Élevé |
| Correction-menu options (Hugo's speech) | **Spoken lines**, with periods. They are not infinitives. | …Rien. · En petit. Dans le coin. · Noir et blanc. Ça fait du gris. |
| STRIDE menu options (app buttons) | Noun or infinitive, no period. | Jour de repos · 10 km tranquille · Ignorer · Repos (demain) · Courir · Courir quand même · Oui · Repos (après dimanche) · Reporter · Bouger · Repos |
| Day cards | « Jour 5. », « Jour 8. », « Semaine 4. », « Semaine 7. », « Semaine 12. », « Dimanche. » | |
| Captions (Ch3) | CAPS, French time « 5 H 12 ». | BLOC D’ENTRAÎNEMENT — SEMAINE 9 — 5 H 12 — LA BOUCLE · … — SEMAINE 20 — 5 H 04 — LA BOUCLE, DEUX FOIS · … — SEMAINE 31 — SAMEDI, 4 H 47 — LA BOUCLE, TROIS FOIS · MARATHON STRIDE — KM 29 |

**Key names.** Never write a key letter or key name: write a token. The game reads physical key codes and labels them with the player's own keyboard layout at runtime (docs/API.md), so a player on QWERTY sees WASD and one on AZERTY sees ZQSD.
- Letter keys: `{KeyW}{KeyA}{KeyS}{KeyD}`, `{KeyA} / {KeyD}`, `{KeyW} / {KeyS}`, `{KeyE}`, `{KeyR}`, `{KeyM}`.
- Named keys: `{Space}`, `{Shift}`, `{Escape}`, `{Enter}`, `{Arrows}`. Their names live once in `keyNames`: Espace, Maj, Échap, Entrée, Flèches.
- Not keys: the mouse is **Souris**, and `1 – 5` stays as it is.
- `L.ch3.keys` is `{ both: '[{KeyA} / {KeyD}]', a: '[{KeyA}]', d: '[{KeyD}]' }`.
- `node scripts/text-check.mjs` fails on an unknown token or a literal key name in key text.

Title controls (`title.controls`):

| Key | Action |
|---|---|
| {KeyW}{KeyA}{KeyS}{KeyD} / {Arrows} | Se déplacer / guider le pinceau |
| Souris | Regarder autour · {KeyR} recentrer |
| {Shift} | Essayer de trottiner |
| {KeyE} | Interagir / continuer |
| {Space} | Tenir le mètre · pincer un rayon |
| {KeyA} / {KeyD} | Garder le rythme |
| 1 – 5 | Choix · pots de peinture |
| {KeyM} | Couper le son |
| {Escape} | Pause |

### 4.4 Watch HUD, gauges and STRIDE alerts

| Where | Text | Limit |
|---|---|---|
| `watch.unit` | km | |
| `watch.zero` and faces | **0,0 km**, **0,32 km**, **0,00 km** | Decimal comma everywhere (section 5). |
| `labels.week` | **CETTE SEMAINE** | ≤ 2 lines, each word ≤ 12 characters |
| `labels.run` | **COURSE · SEMAINE** | |
| `labels.walk` | **MARCHE** | |
| `labels.race` | **MARATHON** | Avoids a clash with « COURSE ». |
| `labels.last` | **SEM. PRÉC.** | |
| lap lines | **SEM. PRÉC. 212,4** | ≤ 16 characters (monospace) |
| times | unchanged | Device readout. |
| `ending.bigs` | **212,4 km** | |
| gauge `STILL` | **IMMOBILE** | |
| gauge `SANDING` | **PONÇAGE** | |
| gauge `CADENCE` | **CADENCE / ppm** | French watches: *pas par minute* |
| gauge `LINE` | **TRAIT** | |
| buzz | ON BOUGE ! Immobile depuis 1 h. | |
| buzz | DÉMARRER UNE MARCHE ? | |
| buzz | ALLURE TROP LENTE. METTRE EN PAUSE ? | |
| buzz | ON BOUGE ! | |
| buzz | AVIRON DÉTECTÉ. LANCER LA SÉANCE ? | |
| buzz | BEL EFFORT ! | |
| buzz | ON BOUGE ! Immobile depuis 3 h 12 min. | |
| STRIDE prompt 2 | STRIDE : Charge d’entraînement ÉLEVÉE. Ton corps a besoin de repos. | |
| STRIDE prompt 3 | STRIDE : Course demain ! Affûtage terminé ? | |
| final menu | STRIDE : Aucun mouvement détecté. ON BOUGE ? | |

### 4.5 Cycling, running, DIY/art and medical terms

The first column names the thing; the second is the word the game uses for it, everywhere.

**Cycling**

| Concept | French (fixed) | Notes |
|---|---|---|
| domestique | **équipier** (TV, neutral) | Hugo never names it; he describes it: « tirer d’autres types en haut des cols ». « Domestique » is historic French and allowed only in this guide's notes. |
| pull (on the front) | **tirer** | |
| peel off / sit up | **se relever** | |
| peloton / col / échappée / étape | peloton / col / échappée / étape | Ticker: « ÉTAPE 17 — COL DU GRAND FERRAND » |
| team cars | **voitures suiveuses** | |
| race wheels | **roues carbone** | |
| chain / front ring | chaîne / **plateau** | Dropped chain: « la chaîne a sauté » |
| rear wheel / spoke / rim / brake pad | roue arrière / rayon / jante / **patin** | |
| out of true / to true | **voilée** / **dévoiler** | « Les voiles » (the buckles) reads as sails: Sami says « les roues tordues ». |
| to pluck (a spoke) | **pincer** | Truing by ear (Ch4, Ch5). |
| truing gauge: PITCH / FLAT / SHARP / TRUE | **NOTE** / **TROP BAS** / **TROP HAUT** / **JUSTE** | Gauge words, ≤ 10 characters. « Juste » only on the gauge: in a sentence it reads as "only". |
| spoke key | clé à rayons | |
| quarter turn | quart de tour | |
| bars | **guidon** | |
| puncture | **crevaison** | |
| work stand / hook | pied d’atelier / crochet | |
| mechanic | **mécano** (Hugo), mécanicien | |
| bike frame | **cadre** | Reserved for the bike. The door frame is « encadrement ». |

**Running**

| Concept | French (fixed) | Notes |
|---|---|---|
| run club | **le club** | Phone label « Bastien (club) » |
| long run / Sunday long run | **sortie longue** (du dimanche) | |
| intervals | **fractionné** | |
| pace | **allure** | |
| cadence | **cadence** | |
| split | **temps de passage** | |
| PB | **record perso** (Bastien may say « RP ») | |
| taper | **affûtage** | |
| rest day | **jour de repos** | |
| recovery | **récup** (STRIDE), récupération | |
| training load | **charge d’entraînement** | |
| training block / training log | **bloc d’entraînement** / **carnet d’entraînement** | |
| the wall | **le mur** | |
| bib | **dossard** | |
| jog (verb) / little jog | **trottiner** / **petit footing** | |
| jog on the spot | **trottiner sur place** | |
| leaderboard | **le classement** | |
| km | km (« bornes » in Bastien's mouth) | |
| easy (pace) | **tranquille** | Echo chain, see 4.7. |
| the loop | **la boucle** | |
| marathon / race | **marathon** / **course** | |

**DIY and art**

| Concept | French (fixed) | Notes |
|---|---|---|
| sand / sanding | **poncer** / **ponçage** | |
| mixing pot (Day 8 colour toy) | **gamelle** | « pot » is reserved for the paint tins. |
| (Gérard's) A-board | **chevalet** | « panneau » is reserved for the billboard. |
| shutter runners (gauge) | **GLISSIÈRES** | Gauge word, 10 characters (the cap). |
| KEBAB (the board's word) | KEBAB | The lettering game paints it from fixed strokes. |
| sandpaper / sanding block | **papier de verre** / cale à poncer | |
| with the grain | **dans le sens du fil** | |
| strip back (a door) | **décaper** | |
| coat (of paint) | couche | |
| primer / filler | **apprêt** / **enduit** | |
| plane | **rabot** | |
| hinge | **charnière** | |
| vice | **étau** | |
| door frame | **encadrement** | |
| pegboard | **le tableau** (à outils) | |
| painted tool outline | **silhouette** | Echo chain, see 4.7. |
| brush / liner brush | **pinceau** / pinceau à filet | |
| hairline (thinnest stroke) | **délié** (and « trait fin ») | Pairs with « les grandes lettres ». |
| line (Hugo's mural line, any painted stroke) | **trait** | The key motif word, see 4.7. |
| lettering / sign painter | **lettrage** / **peintre en lettres** | |
| shop sign (fascia) | **enseigne** | |
| door sign (OPEN) | **pancarte** | |
| lettering board | **planche** | |
| billboard | **le panneau** (publicitaire) | « panneau » is reserved for it. |
| mural / mural panels | **la fresque** / **les peintures** (de chacun) | |
| chalk | **craie** | |
| paint tin | **pot** | |
| ochre / red oxide | **ocre** / **rouge oxyde** | |
| gilding | **dorure** | |
| workbench | **établi** | |
| shed | **remise** | |
| hacksaw | **scie à métaux** | |
| Velcro | **scratch** | |

**Medical**

| Concept | French (fixed) | Notes |
|---|---|---|
| stress fracture | **fracture de fatigue** | What Hugo says to Bastien. |
| hairline crack | **fêlure** (narration), **trait de fracture** (doctor) | |
| microfracture | microfracture | Only if needed. |
| tibia / shin | **tibia** | |
| walking boot | **botte** (de marche) | Sami: « chaussure de ski » |
| no impact | **sans impact** / « aucun impact » | |
| weight-bearing | **appui** | |
| X-ray | **radio** | |
| scan (Ch5) | **radio** | |
| physio / ankle circles | **kiné** / **rotations de cheville** | |
| ibuprofen | **ibuprofène** | |
| biro | **Bic** (« au Bic ») | |
| voicemail tag | **MESSAGE VOCAL** | |

### 4.6 Names, brands, places and signs

| Item | Rule |
|---|---|
| HAIRLINE | The title stays in English (title, logo, loading mark). Its double meaning is carried in the text by « plus fin qu’un cheveu », « trait » and « délié » (echo chains 1 and 3). |
| STRIDE | Stays. Grammatically masculine singular: « STRIDE ne renouvelle pas le panneau ». |
| STRIDE slogan | **NE T’ARRÊTE JAMAIS** on the billboard, race banners and chapter title. The brand uses tu. Billboard: « STRIDE — NE T’ARRÊTE JAMAIS ». Race: **MARATHON STRIDE**. |
| Names | Hugo, Hugo Revel, Odile, Odile Marchal, Sami, Sami Haddad, Bastien, Lou, Gérard, Jo (Josianne Lavoie), Okafor, Albert Durand, Mme Benali. |
| Speaker labels (`who`) | Hugo · Odile · Sami · Bastien · STRIDE · **Dr Okafor** · Lou · Gérard · **Mme Benali** · TV · **Téléphone** · **Maman** · **Bastien (club)** · **Dr Okafor (cabinet)** · Radio. Characters come from `NAMES` in `text/common.js` (helpers `hugo()`, `lou()`, `gerard()`…). The label's first word, lowercased without accents, is the CSS speaker colour (`gerard`, `lou`; `Téléphone` → `phone`, `Maman` → `mum`), and the voice-over looks clips up by the label, so a new speaker also needs a voice cast (docs/voice.md). |
| Mr / Dr / Mme in **spoken or thought lines** | Written out in lowercase: « monsieur Revel », « monsieur Durand », « le docteur Okafor » (the French editorial rule for dialogue and direct address). |
| Mr / Dr / Mme in **labels and written signs** | « M. », « Dr » (no period), « Mme » (no period) |
| The misspelt name on the fruit-basket card | **Hugues** |
| Rue des Tanneurs | Stays. In running text: « la rue des Tanneurs » (lowercase *rue*). |
| No. 14 | **N° 14** (sign), « au 14 » or « au numéro 14 » in speech |
| The kebab shop's neon | **CHEZ GÉRARD**. His A-board says **KEBAB**. |
| Shop signs | BOULANGERIE BENALI, MARCHAL & FILLE, ENSEIGNES — DORURE, CAFÉ DU NORD, DÉFENSE D’AFFICHER, RÉPARATIONS, **ENCRE FINE** (Jo's shop), **CYCLES DURAND — FERMÉ — MERCI POUR CES 52 ANS**. |
| OPEN (the Ch4 lettered sign, Ch5 fallback) | Stays **OPEN**: the lettering game paints fixed O-P-E-N strokes, and an OPEN sign on a French shop door is ordinary. |
| PUNCTURES FIXED (Sami's card) | **CREVAISONS RÉPARÉES — DEMANDER AU N° 14** |
| TV bug | **DIRECT** |
| X-ray side mark | **G** (*gauche*) |
| H.R. (initials), KM 29 / 30 / 31 boards | Unchanged. |

### 4.7 Echo chains: lines that MUST share wording across files

Each row is a recurring phrase. Keep it identical wherever it appears (new lines included), because the player is meant to hear each echo.

1. **« plus fin qu’un cheveu »** (the French carrier of HAIRLINE): the tagline, opening card 5, the stumble bag, the doctor, Hugo and Odile in Week 7, and Odile's *good* tier in Ch5.
2. **« (aller) jusqu’au bout / au bout »:**
   - the tagline: « Elle allait jusqu’au bout. »
   - opening card 6: « Il est allé au bout de la course. »
   - the doctor: « Mais il va jusqu’au bout. »
   - Odile in Week 7: « Et tu le tires jusqu’au bout. »
   - the Ch3 objective: « Aller au bout. »
3. **« trait »** (fracture line, brush line and "strike out" at once):
   - opening card 5 and the doctor
   - « tire un trait dessus » (Day 5)
   - « j’ai tiré des traits plus fins que ça » (Week 7)
   - « Toi, tu fais le trait. » / « Quel trait ? »
   - the Ch5 setup, objective « Peindre le trait. », gauge TRAIT and tiers
   - « Mon trait court sous… » and « Vingt mètres de trait. »
4. **« (s’)arrêter »:**
   - « Ne t’arrête jamais » (slogan and title)
   - opening card 3: « Et il ne s’est plus arrêté. »
   - « J’aurais pu m’arrêter. » (Ch3)
   - « Le panneau me disait de ne jamais m’arrêter. »
   - « Ne t’arrête pas au milieu pour l’admirer. » (Week 7 has « Sans t’arrêter au milieu pour l’admirer. »)
   - « Je me suis arrêté. »
5. **« tenir »:**
   - « Tenez l’échafaudage »; objective « Tenir l’échafaudage. »
   - « Tiens le vélo. » / « Tenir, c’est pas aider ? » / « Tenir, c’est toute ma carrière. »
   - « Tiens-moi cette planche. » / « Tu as tenu un échafaudage. Tu peux tenir un pinceau. »
   - « Moi, je peux tenir une craie. La rue tiendra les pinceaux. »
   - Ch1 door: « J’y tiens. »
6. **« (ne pas) bouger »:** « Vous savez ne pas bouger ? », « Tu sais ne pas bouger. », notebook « Ne pas bouger. », STRIDE « ON BOUGE », the bark « Bougez plus. », the menu button « Bouger », and in the X-ray thought « si j’avais besoin de bouger ».
7. **« deux fois »:** « Mesure deux fois. », « J’ai mesuré deux fois. », the stumble « J’ai fait le calcul. Deux fois. », and Hugo's « Et deux fois le dimanche. ».
8. **« apprendre »:** radio « J’ai beaucoup appris sur la pêche. », notebook « Aprendre. », « Tu apprends. », and the ending « gratuit pour ceux qui veulent apprendre ».
9. **« demander »:** Odile to Sami « Demande-lui. », the card « DEMANDER AU N° 14 », and the ending « Demander. ».
10. **« Que ce soit noté »:** Ch3 « Je veux que ce soit noté. » and Ch5 « Que ce soit noté aussi. ».
11. **« quelque chose à signaler » / « Rien à signaler. »:**
    - Ch1: « J’y répondrai quand j’aurai quelque chose à signaler. »
    - Ch5, the doctor's verdict: « Rien à signaler. », replacing "boring". Now "nothing to report" is the best news.
12. **« un tour de pâté de maisons »:** Ch2 arrival loop and Ch5 `boot.walk`.
13. **« tranquille »:** « 10 km tranquille », « Tranquille, c’est un état d’esprit. », « Tranquille. C’est long. » (cadence), and « Tranquille, c’est une allure. ».
14. **« le tibia un peu bavard »:** Ch3 (Bastien quoted) and Ch5 Bastien.
15. **« le chemin le plus long »:** Ch3 « L’escalier. Le chemin le plus long. » and Ch5 « J’ai pris le chemin le plus long. ».
16. **« après dimanche »:** « Repos (après dimanche) », « Repos après dimanche. J’étais très ferme là-dessus. », and Bastien's « Ha ! Après dimanche ! ».
17. **« Repos »:** every STRIDE rest option and « …Non. Repos. ».
18. **« silhouette »:** the pegboard thought and Ch5 « Elle avait déjà peint la silhouette. ».
19. **« Jusqu’où ? »:** Ch2 `leaving`, Ch3 `present`, and the ending « Personne ne sait jusqu’où, pas même lui. ».
20. **The Bastien after-line, identical in Ch2 and Ch5:** « Il a trottiné sur place tout du long, pour que sa montre ne se mette pas en pause. »
21. **« Signe-le. » / « En petit. »:** the Ch4 sign menu and Ch5 `line.sign` (« En petit ? »).
22. **« deux cent douze virgule quatre »:** wherever it is spoken. On cards and the HUD it is « 212,4 ».

Revision 4 echoes (SCRIPT-R4 §16.6):

23. **« Personne te chronomètre »:** Jo in Ch6, then Odile in Ch7.
24. **« Elle tient. »:** M. Durand's, said of what he mends (Hugo's echo in Ch7 has its own take).
25. **« Comme ça, on voit ce qui manque »:** the Ch4 pegboard outlines, then the Ch6 bike shop's empty outlines.
26. **« un monsieur des roues »:** Ch5, then Ch6.
27. **« Je la bats tous les matins »:** Ch3, Ch5 at dawn, the Ch6 end.
28. **« armoire »:** Odile's own word for where she keeps things, Ch2, then Ch5 and Ch6 (the draft's « classeur » is gone).
29. **« Marchez, si vous y tenez » / « Le médecin m’a dit de marcher »:** the doctor in Ch1, M. Durand in the Ch6 reveal (« Il n’a pas dit quand. »).
30. **« Apportez votre café »:** Odile in Ch2, Hugo in Ch6.
31. **« Que seuls les gens du métier le trouvent » / « Ben moi, je l’ai trouvé »:** Ch6.

---

## 5. French typography (everywhere, UI included)

- **Narrow no-break space U+202F (` `):**
  - before `?`, `!`, `:` and `;`: « Moi ? », « STRIDE : », « ON BOUGE ! »
  - after `«` and before `»`: « « Demander. » »
  - **This applies to the UI too** (prompts, buttons, watch buzzes, menus).
    - It is *no-break*, so it never orphans a `?` at the start of a line.
    - It is narrow, so it costs about one character of width.
    - If a font lacks the glyph, the browser falls back to another font for that character only.
  - **Exceptions:**
    - times and ratios (`38:40`, `3:04:51`)
    - key chips (`[{KeyE}]`, `[{KeyA} / {KeyD}]`)
    - the doubled `!!` in Bastien's SMS: one U+202F before the pair, none between
    - `?!` is written with one U+202F before it
  - U+00A0 is accepted too; `node scripts/text-check.mjs` checks both. Prefer the literal U+202F copied from this file.
- **Guillemets:** « » for every quotation and quoted word (« tout », « Hugues »). For a quote inside a quote, use “ ”. Never use `"` or `'` as quotation marks.
- **Apostrophe:** always the typographic `’` (U+2019), never `'` or `\'`. Because of this, every JS string can stay in single quotes.
- **Ellipsis:** `…` (U+2026), never `...`.
  - At the start of a reply it is glued to the word: « …Rien. »
  - Mid-sentence, it is followed by a space.
- **Interrupted speech:** an em dash glued to the last word, then the next line opens with `…`: « J’ai besoin de quelqu’un pour— » / « …Tiens-moi cette planche. ».
  - Signs and captions use the spaced ` — ` separator: « CYCLES DURAND — FERMÉ ».
  - Never use a dialogue tiret (`—` at the start of a line): speaker labels already do that job.
- **Numbers and units:**
  - Decimal comma: **212,4**, **0,32 km**, **42,2**. This applies on the watch HUD too (code-formatted numbers go through `num()`, docs/API.md).
  - No-break space U+00A0 (or U+202F) between a number and its unit or symbol: `31 km`, `10 km`, `1 h`, `3 h 12 min`, `N° 14`.
  - Times on the watch keep the colons (`38:40`, `3:04:51`). Times of day in captions are « 5 H 12 » (caps) or « 5 h 12 » (lowercase text).
  - Years stay in figures, even in dialogue (« en 1974 », 1971, 1979), with no thousands separator; `scripts/text-check.mjs` lets 1900–2099 through. Other numbers of four digits or more take a U+202F separator (« 1 500 »).
  - Ordinals: « 17ᵉ » if ever needed (avoid; the ticker uses « ÉTAPE 17 »). « 1ᵉʳ ». Never "17ème".
- **Capitals keep their accents:** À, É, È, Ê, Ç (« À la longue », « ÉTAPE », « RÉPARATIONS », « DÉTECTÉ », « ÉLEVÉE », « PRÉC. »). Ligatures are always written: « œ », « Œ » (« œil »).
- **Abbreviations:** « M. », « Mme », « Dr », « N° ». « Mme » and « Dr » take no period.
- **Emphasis:** `*word*` renders italic and the voice stresses it (« Je *sais*. », « *tend* », « *remontée* », « *excellent* »).
- **Lowercase street words** in running text: « la rue des Tanneurs ». Signs stay in caps.

---

## 6. Length

Several HUD slots are fixed-width, and the pacing budget is about 2.5 s per line. `text-check` enforces
the hard limits (`LIMITS` in `scripts/text-check.mjs`, measured at 1280x800 with French text).

| Category | Limit / tips |
|---|---|
| Dialogue and thoughts | Two lines on screen at most; cut articles and padding, use nominal sentences and fronting (« Le vélo, c’était… »). |
| Watch label (`labels.*`) | One or two words: ≤ 2 lines of ≤ 12 characters. |
| Watch lap line | ≤ 16 characters (« SEM. PRÉC. 212,4 »). |
| Watch buzz / STRIDE notification | ≤ 60 characters; drop the subject (« Immobile depuis 1 h. »). |
| Gauge labels | One word, ≤ 10 characters (IMMOBILE, PONÇAGE, CADENCE, TRAIT). |
| Notebook entries | ≤ 27 characters (the row does not wrap). |
| Hotspot prompts | ≤ 26 characters; an infinitive without an article where possible. |
| Objectives | ≤ 30 characters. |
| Buttons (title, pause, end, mobile) | ≤ 24 characters (« Recommencer le chapitre » is the longest). |
| Captions and cards | ≤ 60 characters per line. |
| 3D signs, banners, ticker | Have the scene owner check the fit of long ones (« CYCLES DURAND — FERMÉ — MERCI POUR CES 52 ANS »). |

---

## 7. Text file rules

- **Shape:** keep every key, array length and option order the code reads; chapter code and the voice
  extractor (`scripts/voice/extract-lines.mjs`, which must classify every new key) depend on them. Keep
  `correct` flags, `reply: null`, `hand: 'sami'`, `voicemail: true` and `inner: true`.
- **Line objects:** use the helpers (`odile(...)`, `think(...)`, `lou(...)`, `stage(...)`); bark objects
  carry the label (`who: 'Mme Benali'`). Some keys keep old ids (`ch5.ines`, `prompts.marco`, panel ids):
  only the text shows names.
- **Not text:** hex colours, ids, numbers (`bibCount`, `total`, `scale`), stroke or panel ids.
- **Key chips:** `[{KeyE}] `, `[{Space}]` and `[{KeyA} / {KeyD}]` as a bracketed prefix; the UI turns
  `[...]` into a key chip.
- **Watch faces** in `atChapter` and `watchHud` use the decimal comma and keep the `' km'` suffix.
- **Strings:** single quotes; the typographic apostrophe means no escaping.

---

## 8. Key decisions at a glance

- **Tu/vous:**
  - Odile vouvoie Hugo until `ch4.day5.book[3]`, « Avant toi ? Deux. », where she counts him among her workshop's people. From then on it is tu.
  - Hugo vouvoie her until `ch4.week7.wrap[1]`, « …Tu veux le peindre. », his only pronoun to her, right after her near-ask.
  - Sami, Bastien, Gérard, Mum and STRIDE use tu. The doctor, his office, Lou (to Hugo), Mme Benali and M. Durand use vous.
  - Jo tutoie everyone from her first line.
  - System text uses the infinitive, with no pronoun.
- **Notebook (« CE QUE JE SAIS FAIRE »):** Rouler. · Courir. · Ne pas bouger. · Poncer dans le sens du fil. · Mesurer deux fois. · Faire un gris pas triste. · Dévoiler une roue. · Peindre une enseigne. · **Aprendre.** · Se reposer. · *(certains dimanches)*
- **Tagline:** « La fêlure était plus fine qu’un cheveu. Elle allait jusqu’au bout. »
- **Teech:** **« Aprendre. »** One missing *p*, the most natural kid misspelling. *Apprendre* means both teach and learn, and it pays off in « Tu apprends. » and the ending card.
