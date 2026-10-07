# HAIRLINE: French style guide and glossary (binding)

This guide is binding for everyone writing the French text of HAIRLINE. If a line is decided here, use that wording exactly. Everywhere else, follow the voice rules. The aim is French that reads as if a good French novelist and game writer had written it first. It must never read like a translation.

- **Source:** `src/story/text/{common,ch1..ch5}.js`, with context in `docs/DESIGN.md`.
- **Characters:** this file uses the real characters: `’` (U+2019), `…` (U+2026), `«`/`»`, and the narrow no-break space ` ` (U+202F) before `? ! : ;` and inside guillemets. Copy them as they are.
- **When in doubt:**
  1. Keep the subtext.
  2. Keep the length.
  3. Keep the joke, even if it becomes a different joke.
  4. Never keep the English word order.

---

## 1. Global voice rules

- **Adapt, don't calque.** Translate what a line *does* (the deflation, the tenderness, the joke), not the words. "That's the stuff." is « Voilà. C’est ça. », not « C’est la chose. ».
- **Tense:**
  - Contemporary spoken-literary French: present, passé composé and imparfait.
  - **No passé simple anywhere**, including the opening and ending cards.
- **Short sentences stay short.**
  - The English is built on fragments: "Wet bench, in the dark." French does this naturally with nominal sentences: « Banc mouillé, dans le noir. ».
  - Never merge two English sentences into one French sentence with a relative clause.
- **The "ne" of negation:**
  - **Inner monologue (Hugo, `think`/`inner`) and the cards:** keep it. It is the written voice (« Je ne sais pas »).
  - **Spoken lines:** drop it according to the character (see section 2). Sami and Bastien always drop it. Odile drops it about half the time, mostly in short orders (« Bouge pas. », « Va pas raconter… »). Hugo drops it only when he is tired or bantering.
  - **STRIDE, the doctor's office and the TV:** always keep it.
- **Numbers:**
  - Spell them out in dialogue and thoughts (« deux cent douze virgule quatre »).
  - Use figures on cards, captions, the HUD, STRIDE and signs, where the English uses figures.
  - Use traditional spelling, not the 1990 all-hyphens reform: « quarante et une », « deux cent douze », « quatre-vingt-deux ».
- **Anglicisms:** only where a French speaker of that profile would really use one. Bastien says « la team » and « les bornes ». Sami says « T’as vu ? ». A STRIDE screen says « récup ». Hugo and Odile never use anglicisms.
- **Stage lines** (`stage()`, `*...*`) are present tense and neutral-literary: « Elle regarde longuement la botte. ». Keep the `*…*` markup and any inline `*emphasis*`.
- **Swearing:** the English has none, so the French has none. « Débile », « nul », « fichu » are the ceiling.

---

## 2. Voices, with anchor lines

Treat the anchor lines as reference translations. They are also the fixed wording for those lines.

### Hugo, spoken and inner monologue (37, ex-domestique, counts everything)
- **Voice:** dry, laconic and self-mocking. He makes understatements and states numbers as facts. He has no self-pity, and the joke is always on himself.
- **Inner monologue:**
  - It reads like a good French noir narrator: nominal sentences, a final deflating clause, « Efficace, au moins. ».
  - Its numbers are spelled out.
  - It addresses no one. Where the English uses generic "you", rephrase with « on » or an impersonal form, never « vous ».
- **Spoken:** even shorter. He answers questions with the minimum.

| EN | FR |
|---|---|
| Thirty-seven years. Two words. Both crossed out by ten past ten. Efficient, at least. | Trente-sept ans. Deux mots. Barrés tous les deux à dix heures dix. Efficace, au moins. |
| Never stop. I took it as advice. It was a slogan for a shoe. | Ne t’arrête jamais. Je l’ai pris comme un conseil. C’était un slogan pour des baskets. |
| Honestly? Not since I was nineteen. | Franchement ? Plus depuis mes dix-neuf ans. |

### Odile (74, sign painter, hates sentiment)
- **Voice:** clipped orders, verbless sentences, dry wit and craft words. Her vocabulary is slightly old-fashioned: « bonhomme », « fichu », « pompette ».
- **She never** says « s’il vous plaît/te plaît », uses youth slang, or explains a joke.
- **Her tenderness** shows only in what she does, never in an adjective.
- **"Ask" is hard for her.** Never give her a soft request formula (« tu pourrais… ? »). She gives orders.

| EN | FR |
|---|---|
| No, the other man in a boot. The wheel lock's gone. Hold the scaffold before I come down faster than I'd like. | Non, l’autre bonhomme en botte. Le frein de roue a lâché. Tenez l’échafaudage avant que je descende plus vite que prévu. |
| Then put a line through them. Lightly. It's a pencil, not a tattoo. | Alors tire un trait dessus. Légèrement. C’est un crayon, pas un tatouage. |
| I need someone to— / ...Hold this board. | J’ai besoin de quelqu’un pour— / …Tiens-moi cette planche. |

### Sami (11, Parisian kid, cheeky and literal)
- **Voice:** he always drops the « ne » and uses « t’as », « y a », « c’est nul/débile », « trop » and « mais ».
- **He asks the literal question** adults don't.
- **No dated slang** (« wesh », « grave », « chelou » date fast). Keep him timeless-urban and age-true.
- He calls adults by their first names.

| EN | FR |
|---|---|
| Why've you got a ski boot on? | Pourquoi t’as une chaussure de ski ? |
| That's stupid. / ...That's less stupid. | C’est débile. / …C’est moins débile. |
| ...It went on. It went *on*. Did you see? | …Elle est remontée. Elle est *remontée*. T’as vu ? |

### Bastien (40s, run-club captain, lives in his watch)
- **Voice:** a hearty French running bro: « mon pote », « mec », « la légende », « les bornes », « la team ».
- **Exclamations everywhere:** « Ha ! »
- **Run-club franglais** is allowed (« la sortie longue du dimanche », « mon chrono »).
- **He is nice, never mean.** The comedy is that he can't hear himself.

| EN | FR |
|---|---|
| Hugo! Mate! How's the leg? | Hugo ! Mon pote ! Et cette jambe ? |
| The classic! Too many kilometres, eh? | La classique ! Trop de bornes, hein ? |
| ...Is that allowed? My shin's a bit loud, actually. Everyone's is, though! | …C’est permis, ça ? J’ai le tibia un peu bavard, d’ailleurs. Mais bon, comme tout le monde ! |

**Bastien's SMS** (Ch1 phone): a sloppy text message. Leave out commas and the hyphen in « repose toi », and use CAPS for emphasis. Still use U+202F before `!`, for the linter.
> Appris pour ta jambe mec !! Repose toi la légende. La sortie longue du dimanche c’est PAS pareil sans toi

### Dr Okafor and his office (voice only)
- **The secretary** is polite, formal and slightly embarrassed to be reading the doctor's joke aloud. She uses vous and « monsieur Revel ».
- **The doctor (Ch3)** is calm and precise and uses real radiology words (« trait de fracture »).

| EN | FR |
|---|---|
| Mr Revel, Dr Okafor's office. A reminder that the boot stays on, including in bed, and no impact of any kind for twelve weeks. Dr Okafor asked me to add, and I'm reading this out, 'That includes a little jog to see how it feels.' | Monsieur Revel, ici le cabinet du docteur Okafor. Je vous rappelle que la botte reste en place, y compris au lit, et aucun impact d’aucune sorte pendant douze semaines. Le docteur Okafor m’a demandé d’ajouter, et je cite : « Ça inclut le petit footing pour voir ce que ça donne. » |
| See that? No. There. | Vous voyez, là ? Non. Là. |
| It's thinner than a hair, Mr Revel. But it goes all the way through. | Le trait est plus fin qu’un cheveu, monsieur Revel. Mais il va jusqu’au bout. |

### STRIDE (the watch and app: chirpy corporate)
- **Voice:**
  - Tutoiement, as French sport brands do.
  - Exclamation marks and cheerful jargon (« récup », « séance », « charge d’entraînement »).
  - **Alerts in CAPS.** Accents stay on capitals (« DÉTECTÉ », « ÉLEVÉE »).
  - No emoji.
- **Its catchphrase "TIME TO MOVE"** is always « ON BOUGE » (« ON BOUGE ! » as an alert, « ON BOUGE ? » as the final question).
- **App buttons** are nouns or infinitives with no period (« Jour de repos », « Ignorer »).

| EN | FR |
|---|---|
| Weekly summary: 0.0 km. Let's get back on track! | Bilan de la semaine : 0,0 km. Allez, on s’y remet ! |
| STRIDE: Six days in a row! Recovery is part of training. Take a rest day? | STRIDE : Six jours d’affilée ! La récup fait partie de l’entraînement. Un jour de repos ? |
| TIME TO MOVE! You've been still for 1 hr. | ON BOUGE ! Immobile depuis 1 h. |

### Mum (SMS)
Bossy, loving and brief. She uses tu and drops « ne ».
> **Maman :** Tu manges, au moins ? Réponds pas. Mange.

### Ines (16, ex-tagger)
- **Voice:** deadpan teen.
- **She vouvoies Hugo** with a hint of eye-roll, which is very natural from a French teen to an adult she barely knows.

| EN | FR |
|---|---|
| I tagged this wall eight times. First time anyone's *handed* me the paint. | J’ai tagué ce mur huit fois. C’est la première fois qu’on me *tend* la peinture. |
| Weird. Legal. | Bizarre. Légal. |
| Of you. In front of the wall. That's how photos work. | De vous. Devant le mur. C’est le principe d’une photo. |

### Marco and Mme Benali
- **Marco:** proud and laconic.
- **Mme Benali:** warm and serene. She speaks proper French and keeps « ne ».

| EN | FR |
|---|---|
| Marco: Odile said paint what you can do. I do a very good kebab. So. | Odile a dit de peindre ce qu’on sait faire. Moi, je fais un très bon kebab. Donc. |
| Marco: It's a *great* kebab. | C’est un *excellent* kebab. |
| Benali: I wanted to paint a croissant. It's come out a moon. I've decided it's a moon. | Je voulais peindre un croissant. Ça a donné un croissant de lune. J’ai décidé que c’était la lune. |

### TV commentator (Ch1)
French cycling-broadcast register: « les équipiers », « se relever », « mission accomplie ».
> …et voilà, le travail des équipiers est fait. Un à un, ils se relèvent, vidés. Mission accomplie.

---

## 3. Tu / vous matrix

Rows are the speaker and columns the addressee.

| speaker ↓ / to → | Hugo | Odile | Sami | Bastien | Ines | Marco | Mme Benali |
|---|---|---|---|---|---|---|---|
| **Hugo** | — | **vous → tu at Ch4 Week 7** | tu | tu | tu | tu | vous |
| **Odile** | **vous → tu at Ch4 Day 5** | — | tu | n/a | vous (pl. to the street) | vous (pl.) | vous |
| **Sami** | tu | tu | — | n/a | n/a | n/a | n/a |
| **Bastien** | tu | n/a | n/a | — | n/a | n/a | n/a |
| **Ines** | vous | n/a | n/a | n/a | — | n/a | n/a |
| **Marco** | tu | n/a | n/a | n/a | n/a | — | n/a |
| **Mme Benali** | vous | n/a | n/a | n/a | n/a | n/a | — |

Other speakers:

| Speaker | Address | Notes |
|---|---|---|
| Dr Okafor | vous | « monsieur Revel » |
| Doctor's office | vous | « monsieur Revel » |
| Mum | tu | |
| STRIDE | tu | |
| Odile's father (quoted) | n/a | |
| Reported doctor ("Walk, if you must") | vous | « Marchez, si vous y tenez. » |

**System text speaks to the player with no pronoun at all.** Objectives, prompts, hints and buttons use the infinitive (section 5), so the UI never has to choose between tu and vous.

### Odile → Hugo: vous, then tu from `ch4.day5.book[3]`
- **Ch2, the Ch3 present scene and Ch4 Day 5 arrival: vous.**
  - « Vous. Avec la botte. », « Vous savez ne pas bouger ? », « Citez-en une. », « Jusqu’où ? », « Et vous alliez où, comme ça ? »
  - Day 5: « Vous êtes en avance. », « Votre chaussure. »
- **The switch:** `ch4.day5.book[3]`, "Before you? Two. Me and my father." becomes « **Avant toi ?** Deux. Moi et mon père. ».
  - At the moment she counts the people who have worked in her workshop, she counts him in. The tu is the counting.
  - It also follows the French workshop tradition, where the patronne tutoie whoever works at her bench.
- **From that line on, always tu:** « Tu peux faire l’un des deux, ce mois-ci ? », « Écris-le. », and so on through Ch5.
- **Nobody remarks on the switch.** Do not add a line about it.
- The optional hotspots that are open on Day 5 (`oldSigns`, `radio`) have no pronoun to Hugo, so they are safe on either side of the switch.

### Hugo → Odile: vous, then tu at `ch4.week7.wrap[1]`
- Hugo addresses Odile with a pronoun only once in the whole game: "...You want to paint it." It becomes « **…Tu veux le peindre.** ».
  - Until then he says vous to her: it is a 37-year age gap, she is the boss, and he has a domestique's habits.
  - The switch comes minutes after the near-ask, "I need someone to— ...Hold this board.", which is followed by *He takes it. Neither of them mentions it.*
  - In that wrap he reads her unspoken ask and names it for her. The reciprocal tu is his half of the "neither of them mentions it" contract.
- **Every other Hugo → Odile line has no pronoun.** Keep it that way: « Un trait. », « Et s’il tremble ? », « En petit ? ». Never write a vous or tu that the English doesn't force.
- **If Hugo needs to address Odile anywhere before Week 7** (for example a new line added later), use vous.

---

## 4. Glossary: fixed translations

### 4.1 Notebook: `CE QUE JE SAIS FAIRE`

- **Form:** infinitive, capitalised, with a final period, in pencil voice.
- **Heading:** "WHAT I CAN DO" becomes **CE QUE JE SAIS FAIRE**.
  - Use *savoir*, not *pouvoir*: it is the workshop's list of savoir-faire.
  - Odile's strike question uses *pouvoir* on purpose: « Tu peux faire l’un des deux, ce mois-ci ? ». He still knows how to run but cannot, so the lines are struck lightly.

| key | EN | FR | Note |
|---|---|---|---|
| ride | Ride. | **Rouler.** | The cyclist's verb. |
| run | Run. | **Courir.** | |
| hold | Hold still. | **Ne pas bouger.** | Echoes Ch2 « Vous savez ne pas bouger ? » and Ch4 « Tu sais ne pas bouger. ». The skill that is a not-doing is the opposite of « Ne t’arrête jamais ». |
| sand | Sand with the grain. | **Poncer dans le sens du fil.** | 27 characters, the cap. « fil » is the woodworker's grain. |
| measure | Measure twice. | **Mesurer deux fois.** | |
| grey | Mix a grey that isn't sad. | **Faire un gris pas triste.** | « pas triste » is also the idiom "quite something". Painters "font" a grey; they don't « mélangent » it. |
| wheel | True a wheel. | **Dévoiler une roue.** | The real mechanic's term (une roue voilée). The secondary sense, "unveil", is a happy accident. |
| sign | Letter a sign. | **Peindre une enseigne.** | Matches the ghost sign "ENSEIGNES — DORURE" and the trade, « peintre en lettres ». |
| teach | Teech. | **Aprendre.** | Sami's hand. One missing *p* is the most natural spelling mistake a French 10–11-year-old makes. *Apprendre* means both "teach" and "learn", which the English cannot do. It pays off in Odile's « Tu apprends. » and the ending card « gratuit pour ceux qui veulent apprendre ». Hugo doesn't correct it. Never "fix" it. |
| rest | Rest. | **Se reposer.** | Infinitive, to keep the list's grammar. The STRIDE menu button stays the noun « Repos ». |
| someSundays | (some Sundays) | **(certains dimanches)** | |
| *Odile's list* (ending) | "Ask." | **« Demander. »** | |

### 4.2 Chapter titles (French title case: only the first word, plus the noun after an initial article)

| # | EN | FR | Why |
|---|---|---|---|
| 1 | No Impact | **Sans impact** | The medical order, and also "with no effect". |
| 2 | Never Stop | **Ne t’arrête jamais** | Same wording as the STRIDE slogan (see 4.6). |
| 3 | The Long Run | **À la longue** | Means "in the long run" and contains *longue*, a nod to the *sortie longue*. |
| 4 | Measure Twice | **Mesurer deux fois** | |
| 5 | The Wall | **Le Mur** | The marathon's « mur » and the mural wall, the same double meaning as in English. |

### 4.3 System text style

| Kind | Rule | Examples |
|---|---|---|
| Objectives (`objectives`) | **Infinitive, final period**, as in the English. | Regarder autour de soi. · Aller marcher. · Marcher. · Tenir l’échafaudage. · Garder le rythme. · **Aller au bout.** (Ch3 "Finish.") · Prendre le papier de verre. · Poncer la porte. · Mesurer l’encadrement. · Regarder le vélo. · Voir ce que fait Odile. · Trouver Odile. · Aider Sami. · Peindre le trait. · S’asseoir sur le banc. · Rentrer à pied. · **Raccrocher la montre.** |
| Hotspot prompts (`prompts`, shown as `[E] …`) | **Infinitive, no period, capital first letter.** Keep the `[E] ` prefix exactly where the English has it. | Regarder · Éteindre · Lire les messages · Prendre la montre · Sortir · `[E] Démarrer` · Lever les yeux · S’asseoir · Se lever · Prendre le papier de verre · Poncer · Mesurer · Écouter · Prêt · Aider · `[E] Défaire les sangles` · `[E] Saluer` · Enlever la montre · Parler |
| Hints (`hints`) | Infinitive or nominal. No tu or vous. | Maintenir Maj pour trottiner · Alterner Q et D. Régulier, pas rapide. · Alterner Q et D. Régulier. · Le pinceau suit la craie. ZQSD : petites corrections seulement · Z / S pour stabiliser le pinceau · Ne toucher à rien · Espace |
| Buttons and menus | Infinitive or noun, no period. | Cliquer pour commencer · Continuer quand même · Recharger · Reprendre · Recommencer le chapitre · Rejouer · Langue · Graphismes · Bas / Moyen / Élevé |
| Correction-menu options (Hugo's speech) | **Spoken lines**, with periods as in the English. They are not infinitives. | …Rien. · En petit. Dans le coin. · Noir et blanc. Ça fait du gris. |
| STRIDE menu options (app buttons) | Noun or infinitive, no period. | Jour de repos · 10 km tranquille · Ignorer · Repos (demain) · Courir · Courir quand même · Oui · Repos (après dimanche) · Reporter · Bouger · Repos |
| Day cards | « Jour 5. », « Jour 8. », « Semaine 4. », « Semaine 7. », « Semaine 12. », « Dimanche. » | |
| Captions (Ch3) | CAPS, French time « 5 H 12 ». | BLOC D’ENTRAÎNEMENT — SEMAINE 9 — 5 H 12 — LA BOUCLE · … — SEMAINE 20 — 5 H 04 — LA BOUCLE, DEUX FOIS · … — SEMAINE 31 — SAMEDI, 4 H 47 — LA BOUCLE, TROIS FOIS · MARATHON STRIDE — KM 29 |
| Language selector | Language names are always written in their own language. | English · Français · label « Langue » |

**Key names.** French players are on AZERTY, and the game reads physical key codes (`KeyW`, `KeyA`…). So French strings name the keys as they appear on an AZERTY keyboard:
- WASD becomes **ZQSD**, A / D becomes **Q / D**, and W / S becomes **Z / S**.
- E, R, D, S and 1–3 stay the same.
- Shift becomes **Maj**, Space **Espace**, Esc **Échap**, Arrows **Flèches** and Mouse **Souris**.
- `L.ch3.keys` becomes `{ both: '[Q / D]', a: '[Q]', d: '[D]' }`.

Title controls (`title.controls`):

| EN | FR |
|---|---|
| WASD / Arrows · Move / steady a brush | ZQSD / Flèches · Se déplacer / guider le pinceau |
| Mouse · Look around · R re-centre | Souris · Regarder autour · R recentrer |
| Shift · Try to jog | Maj · Essayer de trottiner |
| E · Interact / advance | E · Interagir / continuer |
| Space · Timing prompts | Espace · Appuyer au bon moment |
| A / D · Keep a rhythm | Q / D · Garder le rythme |
| 1 – 3 · Choices | 1 – 3 · Choix |
| M · Mute | M · Couper le son (see the engineering note in section 9) |
| Esc · Pause | Échap · Pause |

### 4.4 Watch HUD, gauges and STRIDE alerts

| Where | EN | FR | Limit |
|---|---|---|---|
| `watch.unit` | km | km | |
| `watch.zero` and faces | 0.0 km, 0.32 km, 0.00 km | **0,0 km**, **0,32 km**, **0,00 km** | Decimal comma everywhere (section 6). |
| `labels.week` | THIS WEEK | **CETTE SEMAINE** | ≤ 2 lines, each word ≤ 12 characters |
| `labels.run` | RUN · THIS WEEK | **COURSE · SEMAINE** | |
| `labels.walk` | WALK | **MARCHE** | |
| `labels.race` | RACE | **MARATHON** | Avoids a clash with « COURSE ». |
| `labels.last` | LAST WEEK | **SEM. PRÉC.** | |
| lap lines | LAST WEEK 212.4 | **SEM. PRÉC. 212,4** | ≤ 16 characters (monospace) |
| times | 38:40, 41:10, 3:04:51 | unchanged | Device readout. |
| `ending.bigs` | 212.4 km | **212,4 km** | |
| gauge `STILL` | STILL | **IMMOBILE** | |
| gauge `SANDING` | SANDING | **PONÇAGE** | |
| gauge `CADENCE` | CADENCE / spm | **CADENCE / ppm** | French watches: *pas par minute* |
| gauge `LINE` | LINE | **TRAIT** | |
| buzz | TIME TO MOVE! You've been still for 1 hr. | ON BOUGE ! Immobile depuis 1 h. | |
| buzz | START WALK? | DÉMARRER UNE MARCHE ? | |
| buzz | PACE TOO SLOW TO RECORD. PAUSE ACTIVITY? | ALLURE TROP LENTE. METTRE EN PAUSE ? | |
| buzz | TIME TO MOVE! | ON BOUGE ! | |
| buzz | ROWING DETECTED. START WORKOUT? | AVIRON DÉTECTÉ. LANCER LA SÉANCE ? | |
| buzz | GREAT EFFORT! | BEL EFFORT ! | |
| buzz | TIME TO MOVE! You've been still for 3 hr 12 min. | ON BOUGE ! Immobile depuis 3 h 12 min. | |
| STRIDE prompt 2 | Training load HIGH. Your body needs rest. | STRIDE : Charge d’entraînement ÉLEVÉE. Ton corps a besoin de repos. | |
| STRIDE prompt 3 | Race day tomorrow! Taper complete? | STRIDE : Course demain ! Affûtage terminé ? | |
| final menu | No movement detected. TIME TO MOVE? | STRIDE : Aucun mouvement détecté. ON BOUGE ? | |

### 4.5 Cycling, running, DIY/art and medical terms

**Cycling**

| EN | FR (fixed) | Notes |
|---|---|---|
| domestique | **équipier** (TV, neutral) | Hugo never names it; he describes it: « tirer d’autres types en haut des cols ». « Domestique » is historic French and allowed only in this guide's notes. |
| pull (on the front) | **tirer** | |
| peel off / sit up | **se relever** | |
| peloton / col / échappée / étape | peloton / col / échappée / étape | Ticker: « ÉTAPE 17 — COL DU GRAND FERRAND » |
| team cars | **voitures suiveuses** | |
| race wheels | **roues carbone** | |
| chain / front ring | chaîne / **plateau** | Dropped chain: « la chaîne a sauté » |
| rear wheel / spoke / rim / brake pad | roue arrière / rayon / jante / **patin** | |
| out of true / to true | **voilée** / **dévoiler** | |
| spoke key | clé à rayons | |
| quarter turn | quart de tour | |
| bars | **guidon** | |
| puncture | **crevaison** | |
| work stand / hook | pied d’atelier / crochet | |
| mechanic | **mécano** (Hugo), mécanicien | |
| bike frame | **cadre** | Reserved for the bike. The door frame is « encadrement ». |

**Running**

| EN | FR (fixed) | Notes |
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

| EN | FR (fixed) | Notes |
|---|---|---|
| sand / sanding | **poncer** / **ponçage** | |
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

| EN | FR (fixed) | Notes |
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
| HAIRLINE | Stays (title, logo, loading mark). |
| STRIDE | Stays. Grammatically masculine singular: « STRIDE ne renouvelle pas le panneau ». |
| STRIDE slogan "NEVER STOP" | **NE T’ARRÊTE JAMAIS** on the billboard, race banners and chapter title. The brand uses tu. Billboard: « STRIDE — NE T’ARRÊTE JAMAIS ». |
| STRIDE CITY MARATHON | **MARATHON STRIDE** |
| Hugo, Hugo Revel, Odile, Odile Marchal, Sami, Sami Haddad, Bastien, Ines, Marco, Okafor, Durand | Stay. Keep "Ines" without the accent: the name policy keeps names. |
| Speaker labels | Hugo · Odile · Sami · Bastien · STRIDE · **Dr Okafor** · Ines · Marco · **Mme Benali** · TV. Phone becomes **Téléphone**, Mum **Maman**, "Bastien (Run Club)" **Bastien (club)**, and "Dr Okafor's office" **Dr Okafor (cabinet)**. The first word must stay the CSS speaker key; see section 9. |
| Mr / Dr / Mme in **spoken or thought lines** | Write them out in lowercase: « monsieur Revel », « monsieur Durand », « le docteur Okafor ». This is the French editorial rule for dialogue and direct address. *This deliberately overrides the brief's "M. Revel" suggestion.* |
| Mr / Dr / Mme in **labels and written signs** | « M. », « Dr » (no period), « Mme » (no period) |
| Hugh (misspelt name on the fruit-basket card) | **Hugues** |
| Rue des Tanneurs | Stays. In running text: « la rue des Tanneurs » (lowercase *rue*). |
| No. 14 | **N° 14** (sign), « au 14 » or « au numéro 14 » in speech |
| MARCO'S (neon) | **CHEZ MARCO** |
| BOULANGERIE BENALI, MARCHAL & FILLE, ENSEIGNES — DORURE, CAFÉ DU NORD, DÉFENSE D’AFFICHER, RÉPARATI / RÉPARATIONS. | Already French; unchanged. |
| CYCLES DURAND — CLOSED — THANK YOU FOR 52 YEARS | **CYCLES DURAND — FERMÉ — MERCI POUR CES 52 ANS** |
| OPEN (Ch4 lettered sign, Ch5 fallback) | **OUVERT**. This needs new stroke geometry; see section 9. Fallback lines are in section 5 (#64–67). |
| PUNCTURES FIXED — ASK AT No. 14 | **CREVAISONS RÉPARÉES — DEMANDER AU N° 14** |
| LIVE (TV bug) | **DIRECT** |
| X-ray side mark "L" | **G** (*gauche*) |
| H.R. (initials) | Unchanged. |
| KM 29 / 30 / 31 boards | Unchanged. |

### 4.7 Echo chains: lines that MUST share wording across files

Each row is a recurring phrase. Keep it identical across translators, because the player is meant to hear each echo.

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

---

## 5. Wordplay, idioms and English-only jokes: the French solution for each

Lines not listed here have no wordplay. Translate them by the voice rules. The `#` numbers are for reference.

### Title and shared text

| # | Key | EN | FR solution |
|---|---|---|---|
| 1 | `title.name` | HAIRLINE (injury and craft) | Stays English. Its double meaning is carried in French by « plus fin qu’un cheveu » + « trait » + « délié » (echo chains 1 and 3). |
| 2 | `title.tagline` | The crack was thinner than a hair. It went all the way through. | **« La fêlure était plus fine qu’un cheveu. Elle allait jusqu’au bout. »** *Fêlure* is both the bone's hairline crack and the psychological crack: Fitzgerald's *The Crack-Up* is *La Fêlure* in French. « Aller jusqu’au bout » is literal (through the bone) and also "to see it through", which is exactly Hugo's flaw. |
| 3 | `opening[1]` | He never won a race. That wasn't his job. | « Il n’a jamais gagné une course. Ce n’était pas son travail. » |
| 4 | `opening[2]` | When it ended, he took up running. Then he kept going. | « Quand ça s’est arrêté, il s’est mis à courir. Et il ne s’est plus arrêté. » The repetition *arrêté/arrêté* is intended. |
| 5 | `opening[3..6]` | Last week…212.4 kilometres. / At kilometre 31 on Sunday, his left shin cracked along a line thinner than a hair. / He finished the race. / This week: 0.0. | « La semaine dernière, il a couru 212,4 kilomètres. » / « Dimanche, au kilomètre 31, son tibia gauche s’est fêlé le long d’un trait plus fin qu’un cheveu. » / « Il est allé au bout de la course. » / « Cette semaine : 0,0. » Card 5 is where *fêlure* meets *trait*. |
| 6 | `stumble.first` / `stumble.bag` | Twelve weeks. This is day four. / Bone doesn't negotiate. / This boot weighs more than my race wheels. / Thinner than a hair. Still wins. / Twelve weeks is eighty-four days. I've done the maths. Twice. / I know. I *know*. | « Douze semaines. On en est au jour quatre. » / « L’os ne négocie pas. » / « Cette botte pèse plus lourd que mes roues carbone. » / « Plus fin qu’un cheveu. Et c’est lui qui gagne. » / « Douze semaines, ça fait quatre-vingt-quatre jours. J’ai fait le calcul. Deux fois. » / « Je sais. Je *sais*. » |

### Ch1 "Sans impact"

| # | Key | EN | FR solution |
|---|---|---|---|
| 7 | `hammer` | …No hurry at all. I sort of hate them. | « Quelqu’un tape au marteau, en bas. Neuf heures du soir. Le même rythme depuis une heure. Pas pressé du tout. Je le déteste un peu. » The masculine generic keeps Odile hidden; that surprise is wanted. |
| 8 | `tv` | …the work done for the domestiques. One by one they peel off the front, empty. Job finished. | See the TV anchor in section 2. « se relever » is the broadcast idiom. |
| 9 | `tvOff` | Nobody films them after… | « Personne ne les filme, après. Ils redescendent entre les voitures suiveuses et rentrent au bus tout seuls. » Paid off by Ines's photo. |
| 10 | `phone` (last) | Twelve unread. I'll answer them when I've got something to report. | « Douze non lus. J’y répondrai quand j’aurai quelque chose à signaler. » This sets up Ch5's « Rien à signaler. » (echo chain 11). |
| 11 | `watch` / `watchAfter` | Still on the charger. Still counting. It doesn't know. / …It counted them the same. | « Toujours sur le chargeur. Toujours en train de compter. Elle ne sait pas. » / « Elle les a comptés pareil. » The watch is always **elle**. |
| 12 | `buzzReply` | Thanks. | « Merci. » Dry; add nothing. |
| 13 | `xray` | …'the dreaded black line'. Then he said sorry, that's just what it's called. / …I said I sink. He wrote that down. | « Le docteur Okafor l’a entourée au Bic. J’ai quand même dû demander où. » / « Il l’a appelée « la redoutable ligne noire ». Puis il s’est excusé : c’est son nom, c’est tout. » / « Il a dit que je pouvais nager, si j’avais besoin de bouger. J’ai dit que je coule. Il l’a noté. » |
| 14 | `bike` | …cleaner than my teeth… gone orange. / I've done my twelve years. / …what it's won. | « Douze ans, j’ai gardé cette chaîne plus propre que mes dents. Quatre ans au crochet, et elle a viré à l’orange. » / « Le médecin dit que j’ai droit à celui-là. Sans impact. Je lui ai dit que j’avais déjà purgé mes douze ans. » The prison idiom becomes « purger sa peine ». / « Je me dis toujours que je vais le vendre. Mais on me demanderait ce qu’il a gagné. » |
| 15 | `bibs` | I couldn't tell you what a single course looked like. I can tell you every split. | « Je serais incapable de décrire un seul parcours. Mais je connais chaque temps de passage. » |
| 16 | `door` | Walk, if you must, he said. / I must. | « Marchez, si vous y tenez, il a dit. » / « J’y tiens. » This is the *tenir* chain. |

### Ch2 "Ne t’arrête jamais"

| # | Key | EN | FR solution |
|---|---|---|---|
| 17 | `start` | …Three flights of stairs, one at a time, in a boot. | « Trente-huit minutes. Trois cent vingt mètres. Trois étages, une marche à la fois, avec une botte. » *Marche* means both a stair and a walk. |
| 18 | `ghost` | The letters didn't get the message. | « Quelqu’un a peint ça à la main, avant ma naissance. La boutique a disparu depuis longtemps. Les lettres, personne ne les a prévenues. » |
| 19 | `billboard` | Never stop… a slogan for a shoe. | See the Hugo anchor (« …un slogan pour des baskets. »). |
| 20 | `club` | The classic! / Is there another kind? / The leaderboard's boring without you. | « La classique ! » In French a *classique* is also a one-day cycling race, which is a bonus. / « Il y en a d’autres ? » / « Ha ! Repose-toi, la légende. Le classement s’ennuie sans toi. » |
| 21 | `shop` | …The card said 'Hugh'. | « Cinquante-deux ans, et ils ont eu droit à une pancarte de remerciement. Quand j’ai arrêté, l’équipe m’a envoyé une corbeille de fruits. Sur la carte, c’était écrit « Hugues ». » The French near-miss name. |
| 22 | `bench` | If the club comes back, I'm stretching. | « Banc mouillé, dans le noir. Si le club repasse, je m’étire. » |
| 23 | `arrival` | No, the other man in a boot. / Can you stand still? | See the Odile anchor. « Vous savez ne pas bouger ? » uses *savoir*, which sets up the notebook. |
| 24 | `hold.barks` | Still. / Stiller. / You're a lamppost. Lampposts don't fidget. / I'm doing an S up here. Esses are personal. | « Bougez pas. » / « Bougez plus. » / « Vous êtes un réverbère. Un réverbère, ça gigote pas. » / « Je fais un S, là-haut. Les S, c’est personnel. » |
| 25 | `after` | Eleven letters and a full stop. You're a decent lamppost. / …like a dropped wardrobe. / Twice on Sundays. | « Réparations. Onze lettres et un point. Vous faites un réverbère tout à fait correct. » (RÉPARATIONS has 11 letters in French too.) / « Vous êtes au troisième. Tous les matins à quatre heures, dans l’escalier comme une armoire qu’on aurait lâchée. » / « J’allais courir. Et deux fois le dimanche. » « Et » keeps the English idiom's emphasis. |
| 26 | `after` | …a door in there that needs stripping back… | « J’ai une porte, là-dedans, à décaper. Et vous, à vous voir, vous n’avez rien à faire. » *Décaper* also suggests stripping a person back, as in English. |
| 27 | `nameOne` | That's not a thing to do. That's a thing to count. / What's the plan, aggressive sitting? / Mine's a crime. | « Ça, c’est pas une chose à faire. C’est une chose à compter. » / « Avec cette botte ? C’est quoi, le plan ? Du fractionné assis ? » (adapted to running jargon) / « Demain, dix heures. Apportez votre café. Le mien est un crime. » |
| 28 | `leaving` | How far? | **« Jusqu’où ? »** It asks for the distance and for the limit, and it is echo chain 19. |

### Ch3 "À la longue"

| # | Key | EN | FR solution |
|---|---|---|---|
| 29 | `weeks[0].thoughts` | Cycling was other people's races… / …I beat it every morning. | « Le vélo, c’étaient les courses des autres. Celle-ci est à moi. Chaque mètre. » / « À cette heure-là, la seule autre lumière allumée, c’est la boulangerie. Je la bats tous les matins. » |
| 30 | `weeks[1].thoughts` | …If I don't press it, it isn't there. / Everybody's shin is a bit loud. Bastien says. | « Il y a un point sur le tibia, grand comme une pièce. Je n’appuie pas dessus. Si je n’appuie pas, il n’existe pas. » / « Tout le monde a le tibia un peu bavard. C’est Bastien qui le dit. » (echo chain 14) |
| 31 | `weeks[2].thoughts` | Two ibuprofen. The stairs. The long way round. / Counting is a painkiller, if you do enough of it. | « Deux ibuprofènes. L’escalier. Le chemin le plus long. » / « Quand ça fait mal, je compte. Compter, c’est un antidouleur, à forte dose. » |
| 32 | STRIDE replies | Rest day. Good idea. Tomorrow. / An easy ten. Easy is a state of mind. / Dismissed. | « Jour de repos. Bonne idée. Demain. » / « Un petit dix tranquille. Tranquille, c’est un état d’esprit. » / « Ignoré. » |
| 33 | STRIDE replies | I said tomorrow. I meant it at the time. / Anyway. My favourite pace. | « J’ai dit demain. Sur le moment, je le pensais. » / « Quand même. Mon allure préférée. » *Quand même* works as a pace exactly as "anyway" does. |
| 34 | STRIDE replies | Yes. / It's not lying if it's a watch. / Rest after Sunday. I was very firm about that. / Snooze. Story of the year. | « Oui. » / « Mentir à une montre, ce n’est pas mentir. » / « Repos après dimanche. J’étais très ferme là-dessus. » / Button « Reporter » → « Reporter. Toute mon année en un mot. » ("Snooze" has no natural French verb, so *reporter* = postpone.) |
| 35 | `race.thoughts` | Thirty. This is where they say the wall is. / I've never hit the wall… | « Trente. C’est ici, paraît-il, qu’on prend le mur. » / « Je n’ai jamais pris le mur. Pas une fois. J’en étais très fier. » French runners say *le mur* too. |
| 36 | `crack` | …like a pencil lead going, somewhere inside a drawer. / I remember thinking: only eleven more. | « Ce n’était pas fort. On aurait dit une mine de crayon qui casse, quelque part dans un tiroir. » / « Je me souviens avoir pensé : plus que onze. » There is no elision before *onze*. |
| 37 | `keepGoing` | I could have stopped. I want that on the record. I could have stopped. | « J’aurais pu m’arrêter. Je veux que ce soit noté. J’aurais pu m’arrêter. » |
| 38 | `doctor` | thinner than a hair… all the way through | See the doctor anchor. *Trait (de fracture)* is real radiology French and also Odile's *trait*. |
| 39 | `present` | Well? How far? / …Where were you going? / …It was a loop. | « Alors ? Jusqu’où ? » / « Deux cent douze virgule quatre. » / « En une semaine ? » / « En une semaine. » / « Et vous alliez où, comme ça ? » / « …C’était une boucle. » |

### Ch4 "Mesurer deux fois"

| # | Key | EN | FR solution |
|---|---|---|---|
| 40 | `oldSigns` | Marchal and daughter. / Daughter's me. My father did the big letters, I did the hairlines… | « Marchal et Fille. » / « La fille, c’est moi. Mon père faisait les grandes lettres, moi les déliés. Puis il est mort et j’ai fait les deux. » *Les déliés* is the French hairline: every French child learned « les pleins et les déliés ». |
| 41 | `radio` | I've learned a great deal about fishing. | « Elle capte une station. Un monsieur qui parle de pêche. J’ai beaucoup appris sur la pêche. » (echo chain 8) |
| 42 | `day5.arrive` | I had the shoes on before I remembered. / Shoe. / ...Shoe. | « Debout à quatre heures. J’avais mis mes chaussures avant de m’en souvenir. » / « Votre chaussure. » / « …Ma chaussure. » The plural-to-singular correction survives. |
| 43 | `day5.book` | He wrote 'everything' and underlined it. He was a liar. | « Avant toi ? Deux. Moi et mon père. Il avait écrit « tout » et il l’avait souligné. C’était un menteur. » This is the tu switch (section 3). |
| 44 | `day5.strike` | Then put a line through them. Lightly. It's a pencil, not a tattoo. | « Alors tire un trait dessus. » *Tirer un trait sur* also means "to give something up for good". The double meaning is a gift; keep it. |
| 45 | `day5.pegboard` | …so you can see what's missing. / …Every rest day, a gap I had to look at. | « Chaque outil a sa silhouette peinte sur le tableau. Comme ça, on voit ce qui manque. » / « Mon carnet d’entraînement, c’était pareil. Chaque jour de repos, un trou qu’il fallait regarder. » |
| 46 | `day5.after` | Something like it. About fifty million times. I worked it out once. On a rest day. | « Un truc du genre. Dans les cinquante millions de fois. J’ai fait le calcul, un jour. Un jour de repos. » |
| 47 | `sanding.barks` | You're not sanding it, you're arguing with it. / Slower. That wood's been here longer than you. / With the grain. Like stroking a cat, not starting a fight. | « Tu la ponces pas, tu te disputes avec. » / « Plus lent. Ce bois était là bien avant toi. » / **« Dans le sens du fil. Un chat, ça se caresse dans le sens du poil. »** This uses the French idiom *dans le sens du poil* (also "to flatter"). |
| 48 | `sanding.buzz` | ROWING DETECTED. START WORKOUT? | « AVIRON DÉTECTÉ. LANCER LA SÉANCE ? » (the watch misreading the motion) |
| 49 | `day8.measure` | Measure twice. / Doors lie. Frames lie worse. | « Mesure deux fois. » / « Encore ? » / « Oui. » / « Les portes mentent. Les encadrements, c’est pire. Donc on enlève un demi-centimètre côté charnières. Le rabot est au mur. » |
| 50 | `day8.grey` / `greyMenu` | A grey that isn't sad. / That's a waiting room. / …a sad grey pretending to be fine. I know the type. / …a grey that's been somewhere. | « Un gris pas triste. » / « Ça, c’est pas un gris. C’est une salle d’attente. » / « Là, c’est un gris triste qui fait semblant d’aller bien. Je connais le genre. » / **« …Voilà. Ça, c’est un gris qui a vécu. »** Options: « Noir et blanc. Ça fait du gris. » / « Plus de blanc. Pour l’égayer. » / « Du blanc, un peu de noir. Puis de l’ocre. Une goutte de bleu. » Prompt: « Cinq pots : blanc, noir, ocre, bleu, rouge oxyde. » |
| 51 | `day8.painted` | I'd swear to it in court. / Stop staring at it, it'll get ideas. | « C’est gris. Je le jurerais devant un tribunal. C’est gris. » / « Évidemment que c’est gris. Arrête de la fixer, elle va se faire des idées. » (*la porte*) |
| 52 | `week4.sami` | It's doing the noise again… He said find a wheel man. | « Odile ! Il refait le bruit. Le *zhhh, zhhh*. C’est monsieur Durand qui me l’a donné quand il a fermé. Il a dit de trouver un monsieur des roues. » This is a kid's paraphrase. Odile: « Me regarde pas. Demande-lui. Les vélos, c’était son métier. » |
| 53 | `week4.sami` | I spent twelve years pulling other men up mountains. | « J’ai passé douze ans à tirer d’autres types en haut des cols. » / « Pourquoi ? » / « Pour qu’ils gagnent. » / « C’est débile. » / « On me payait. » / « …C’est moins débile. » |
| 54 | `week4.bike` | …kisses the brake pad once a turn. | « La roue arrière est voilée. Un rayon s’est détendu, alors la jante se balade et vient embrasser le patin une fois par tour. » |
| 55 | `week4.hold` | Holding's not helping? / Holding's my whole career. | « Tiens le vélo. Les deux mains. N’aide pas. » / « Tenir, c’est pas aider ? » / « Tenir, c’est toute ma carrière. » |
| 56 | `truing` | Was it meant to go clunk? / Odile, he's hitting it. / Is it fixed? It's not fixed. | « C’était censé faire clonk ? » / « Odile, il le tape ! » / « C’est réparé ? C’est pas réparé. » / assisted: « C’est réparé ? …C’est réparé. » / cue « [Espace] quand ça frotte au patin » / « Quart de tour. » |
| 57 | `week4.after` | Why've you got a ski boot on? / …I broke my leg running. / Running from what? | « Pourquoi t’as une chaussure de ski ? » / « C’est une botte médicale. Je me suis cassé la jambe en courant. » / **« En courant après quoi ? »** A kid's literal reading of *en courant*; *courir après* (chasing numbers) is the French subtext in place of "running from". |
| 58 | `laughStage` / `laugh` | …rusty, like something left in a shed. / …if there was a field for it. | « Hugo rit. Ça sort rouillé, comme un truc oublié au fond d’une remise. » / « Tiens. Un rire. Je l’aurais enregistré, s’il y avait eu une case pour ça. » |
| 59 | `week4.wrap` | Mechanics were for people who won. | « Ça, j’ai toujours su faire. Avant l’équipe, je montais mes roues moi-même. Les mécanos, c’était pour ceux qui gagnaient. » / « Alors écris-le. » |
| 60 | `week7.intro` | Forty years, I could pull a line thinner than that. Big letters I can still bully. It's the thin ones. | « Quarante ans, j’ai tiré des traits plus fins que ça. Les grandes lettres, je les mate encore. C’est les déliés. » |
| 61 | `week7.intro` | Thinner than a hair. You pull it all the way through. No stopping halfway to admire it. / Last person who said that to me was holding an X-ray. | Hugo: « Plus fin qu’un cheveu. » / Odile: « Plus fin qu’un cheveu. Et tu le tires jusqu’au bout. Sans t’arrêter au milieu pour l’admirer. » / Hugo: « La dernière personne qui m’a dit ça tenait une radio de ma jambe. » |
| 62 | `week7.intro` | I need someone to— / ...Hold this board. / *He takes it. Neither of them mentions it.* | See the Odile anchor; *Il la prend. Ni l’un ni l’autre n’en parle.* Odile must not complete the ask. |
| 63 | `week7.intro` | You held a scaffold. You can hold a brush. Same job. Stand still, then move once. | « Tu as tenu un échafaudage. Tu peux tenir un pinceau. Même boulot. Tu ne bouges pas, puis tu bouges une fois. » |
| 64 | `week7.intro` (last) | The door sign. O, P, E, N. The O's impossible and the N's a trap. | **OUVERT:** « La pancarte de la porte. O, U, V, E, R, T. Le O est impossible et le R est un piège. » *(Fallback only if the board must stay OPEN: « La pancarte de la porte. O, P, E, N. Le O est impossible et le N est un piège. »)* |
| 65 | `lettering.tiers` | Clean. Don't tell anyone I said so. / It's got character… / It's a bit drunk. Drunk letters still say OPEN. | « Propre. Va pas raconter que je l’ai dit. » / « Ça a du caractère. Personne ne veut d’une enseigne sans caractère. » (*caractère* is also a typeface character, a bonus) / « C’est un peu pompette. Des lettres pompettes, ça dit quand même OUVERT. » |
| 66 | `signMenu` | Sign it. / …not a birthday cake. / …somebody else's name went on top. Not in my workshop. / Smaller. So only the trade will find it. | Prompt: « Odile tapote le coin du bas. « Signe-le. » » / options « En grand. Tout en bas. » → « C’est une pancarte, pas un gâteau d’anniversaire. » · « Je préfère pas. » → « Douze ans, tu as fait le boulot et c’est le nom d’un autre qu’on a mis en haut. Pas dans mon atelier. » · « En petit. Dans le coin. » → « Plus petit. Que seuls les gens du métier le trouvent. » |
| 67 | `signThink` | The first thing with my name on it says OPEN. | « Douze ans. La première chose qui porte mon nom dit OUVERT. » |
| 68 | `week7.wrap` | …twenty metres of nothing in the middle of all that ugly. / …You want to paint it. / …The street can hold the brushes. You're doing the line. / What line? | « STRIDE ne renouvelle pas le panneau. Dans un mois, il y aura vingt mètres de rien au milieu de toute cette laideur. » / **« …Tu veux le peindre. »** (Hugo's tu switch) / « Moi, je peux tenir une craie. La rue tiendra les pinceaux. Toi, tu fais le trait. » / « Quel trait ? » |

### Ch5 "Le Mur"

| # | Key | EN | FR solution |
|---|---|---|---|
| 69 | `opening` | I walked the long way. It was nice. / Nice. I said 'nice' about a walk. Out loud. | « Te voilà. T’es en retard. » / « J’ai pris le chemin le plus long. C’était sympa. » / « Sympa. J’ai dit « sympa » à propos d’une balade. À voix haute. » A *balade* is the leisure word; a *marche* is the STRIDE activity. |
| 70 | `benali` / panel label | a croissant that came out a moon | The French gift: a croissant **is** a crescent. « Ça a donné un croissant de lune. » Panel label: « un croissant devenu lune ». Other panel labels: « le lettrage d’Ines », « le vélo de Sami », « la main à la craie d’Odile », « un excellent kebab ». |
| 71 | `ines` | First time anyone's *handed* me the paint. / Weird. Legal. | See the Ines anchor. |
| 72 | `marco` | …very good kebab… *great* kebab. | « très bon » → « bon » → « *excellent* » |
| 73 | `shopCard` | Sami's handwriting. My spelling. | « L’écriture de Sami. Mon orthographe. » This contrasts with the uncorrected « Aprendre. ». |
| 74 | `boltHoles` | …I listened to the bigger one. | « La montre me disait de me reposer. Le panneau me disait de ne jamais m’arrêter. J’ai écouté le plus gros. » |
| 75 | `teach` | It's off again! / Give it here… / Kick it. Firmly. / That's how Odile fixes the radio. The radio's still broken. / It went *on*. | « Hugo ! Elle a encore sauté ! » / prompt « La chaîne a sauté du plateau. Il a déjà les mains noires. » / « Donne, je vais le faire. » → « C’est toujours toi qui le fais. Après, elle saute quand t’es pas là. » / « Un bon coup de pied. Ferme. » → « C’est comme ça qu’Odile répare la radio. La radio est toujours en panne. » / « Accroche-la en bas du plateau. Pédale en arrière. Doucement. » → see the Sami anchor. |
| 76 | `teach.after` | You forgot one. | « J’ai vu. » / « C’est quoi, ça ? » / « Une liste. » / *Sami la lit, lèche le crayon et écrit quelque chose.* / « T’en as oublié un. » → **Aprendre.** |
| 77 | `line.setup` | …Don't stop halfway to admire it. / What if it wobbles? / Go on, then. | « Tout le monde a peint ce qu’il sait faire. Ton trait passe sous tout ça. De la boulangerie au kebab. » / « Un trait. » / « Vingt mètres. J’ai mesuré deux fois. Ne t’arrête pas au milieu pour l’admirer. » / « Et s’il tremble ? » (*trembler*, as with Odile's hand) / « Vas-y, alors. » |
| 78 | `line.end` / `line.tiers` | Twenty metres. I didn't time it. / That's a hairline. Near enough. / It's a line a person made. / …in a boot. Same thing, louder. | « Vingt mètres. Je n’ai pas chronométré. » / **« Plus fin qu’un cheveu. À un cheveu près. »** / « C’est un trait fait main. » (*fait main* = handmade, human) / « C’est un trait fait main, en botte. Pareil, en plus bruyant. » |
| 79 | `line.sign` | Sign it. / Small? / You're learning. | « Signe-le. » / « En petit ? » / **« Tu apprends. »** |
| 80 | `line.photo` | Stand in front of it. / Of the wall? / Of you… | « Mettez-vous devant. » / « Une photo du mur ? » / « De vous. Devant le mur. C’est le principe d’une photo. » The misunderstanding moves onto « photo de/du ». |
| 81 | `club` | HUGO! Arts and crafts! … two hundred a week! / Maybe twenty. / A day? / A week. / Get it looked at. / Ha! After Sunday! | « HUGO ! Alors, les loisirs créatifs ? La botte, c’est bientôt fini, hein ? On va te remettre à deux cents par semaine ! » (*Loisirs créatifs* is the retail-aisle label, affectionately condescending.) / « Peut-être vingt. » / « Par jour ? » / « Par semaine. » / « Va le faire voir. » / « Ha ! Après dimanche ! » |
| 82 | `club.afterThoughts` | …Good for him. | The Ch2 line is identical (echo chain 20), then « Tant mieux pour lui. » |
| 83 | `boot.ask` | Scan this morning. Dr Okafor said 'boring'. Best thing a doctor's ever said to me. / …not the only one on this street who can count. / …if the Velcro argues. | « C’est aujourd’hui, hein. La botte. » / « Radio ce matin. Le docteur Okafor a dit : « Rien à signaler. » La plus belle chose qu’un médecin m’ait jamais dite. » (*Boring* doesn't work as a French medical verdict; *RAS* does, and it closes echo chain 11.) / « Douze semaines depuis le dimanche. J’ai compté. T’es pas le seul dans cette rue à savoir compter. » / « Assieds-toi. J’ai une scie à métaux si le scratch fait des histoires. » |
| 84 | `boot.light` / `boot.walk` | …Like it didn't know what it was for yet. / Once round the block, then home. It'll work it out. | « La jambe était légère. Comme si elle ne savait pas encore à quoi elle servait. » / « Un tour de pâté de maisons, puis tu rentres. Ta jambe se débrouillera. » |
| 85 | `walk` | Hands on the bars! / ...*Fine!* / Easy. Easy's a speed. / I stopped. Nobody made me. Put that on the record too. | « Hugo ! Ça frotte même plus ! » / « Les mains sur le guidon ! » / « …*Ça va !* » / « Tranquille. Tranquille, c’est une allure. » / « Je me suis arrêté. Personne ne m’y a obligé. Que ce soit noté aussi. » |
| 86 | `walk.mural` | My line runs under everyone's panels, holding them up a bit. | **« Mon trait court sous les peintures de tout le monde. Il les soutient un peu. »** In French a line *court* (runs) as well. |
| 87 | `walk.bike` / `walk.outline` | …an afternoon and a toothbrush. / She'd already painted the outline. | « Quatre ans au crochet. Il a suffi d’un après-midi et d’une brosse à dents. » / « Elle avait déjà peint la silhouette. » |
| 88 | `objectives.watch` | Hang up the watch. | **« Raccrocher la montre. »** *Raccrocher* is also how French sport says "to retire" (*raccrocher les crampons*). |
| 89 | `walk.restMenu` | No movement detected. TIME TO MOVE? / Move · Rest / ...No. Rest. | « STRIDE : Aucun mouvement détecté. ON BOUGE ? » / « Bouger » · « Repos » / « …Non. Repos. » |
| 90 | `walk.crane` | …I can't remember a metre of it. / …It wobbles at the kebab shop. I remember all of it. | « Deux cent douze virgule quatre kilomètres. Je ne me souviens pas d’un seul mètre. » / « Vingt mètres de trait. Il tremble à hauteur du kebab. Je me souviens de tout. » |

### Ending cards

| # | Key | EN | FR solution |
|---|---|---|---|
| 91 | `ending.lines` | (all six) | « La rue des Tanneurs n’a plus jamais eu de panneau publicitaire. » / « Sami Haddad répare les crevaisons. Deux euros, ou gratuit pour ceux qui veulent apprendre. » / « La radio d’Odile capte quatre stations, maintenant. Elle écoute celle qui parle de pêche. » / « Cette année-là, la liste d’Odile Marchal s’est allongée d’une ligne. Il y est écrit : « Demander. » » / « Hugo Revel court certains dimanches. Personne ne sait jusqu’où, pas même lui. » / « Sa montre pend à un clou au-dessus de l’établi. Elle croit qu’il se repose depuis un an. » |
| 92 | `ending` | Thank you for playing. / Play again / credits | « Merci d’avoir joué. » / « Rejouer » / « Personnages et animations : Quaternius. Accessoires, matériaux et HDRI : Poly Haven, ambientCG. Éléments de rue et bruits de pas : Kenney. Musique et ambiances : OpenGameArt. Tout en CC0. » |

---

## 6. French typography (apply everywhere, UI included)

- **Narrow no-break space U+202F (` `):**
  - before `?`, `!`, `:` and `;`: « Moi ? », « STRIDE : », « ON BOUGE ! »
  - after `«` and before `»`: « « Demander. » »
  - **This applies to the UI too** (prompts, buttons, watch buzzes, menus).
    - It is *no-break*, so it can never orphan a `?` at the start of a line, which helps tight layouts.
    - It is narrow, so it costs about one character of width.
    - If a font lacks the glyph, the browser falls back to another font for that character only.
  - **Exceptions:**
    - times and ratios (`38:40`, `3:04:51`)
    - key chips (`[E]`, `[Q / D]`)
    - the doubled `!!` in Bastien's SMS: one U+202F before the pair, none between
    - `?!` is written with one U+202F before it
  - You may write the literal character or the `\u202F` escape in JS; the linter in section 8 accepts both. Prefer the literal character copied from this file.
- **Guillemets:** « » for every quotation and quoted word, including single-quoted English words: 'everything' becomes « tout » and 'Hugh' becomes « Hugues ». For a quote inside a quote, use “ ”. Never use `"` or `'` as quotation marks.
- **Apostrophe:** always the typographic `’` (U+2019), never `'` or `\'`. Because of this, every JS string can stay in single quotes.
- **Ellipsis:** `…` (U+2026), never `...`.
  - At the start of a reply it is glued to the word: « …Rien. »
  - Mid-sentence, it is followed by a space.
- **Interrupted speech:** an em dash glued to the last word, then the next line opens with `…`. "I need someone to—" / "...Hold this board." becomes « J’ai besoin de quelqu’un pour— » / « …Tiens-moi cette planche. ».
  - Signs and captions keep the spaced ` — ` separator as in the English: « CYCLES DURAND — FERMÉ ».
  - Never use a dialogue tiret (`—` at the start of a line): speaker labels already do that job.
- **Numbers and units:**
  - Decimal comma: **212,4**, **0,32 km**, **42,2**. This applies on the watch HUD too; the code-generated values are listed in section 9.
  - No-break space U+00A0 (or U+202F) between a number and its unit or symbol: `31 km`, `10 km`, `1 h`, `3 h 12 min`, `N° 14`.
  - Times on the watch keep the colons (`38:40`, `3:04:51`). Times of day in captions are « 5 H 12 » (caps) or « 5 h 12 » (lowercase text).
  - Ordinals: « 17ᵉ » if ever needed (avoid; the ticker uses « ÉTAPE 17 »). « 1ᵉʳ ». Never "17ème".
- **Capitals keep their accents:** À, É, È, Ê, Ç (« À la longue », « ÉTAPE », « RÉPARATIONS », « DÉTECTÉ », « ÉLEVÉE », « PRÉC. »). Ligatures are always written: « œ », « Œ » (« œil »).
- **Abbreviations:** « M. », « Mme », « Dr », « N° ». « Mme » and « Dr » take no period.
- **Emphasis:** keep the `*word*` markup where the English has it (« Je *sais*. », « *tend* », « *remontée* », « *excellent* »).
- **Lowercase street words** in running text: « la rue des Tanneurs ». Signs stay in caps.

---

## 7. Length guidance

French runs about 15–25% longer than English. The pacing budget assumes about 2.5 s per line, and several HUD slots are fixed-width, so:

| Category | Target | Hard limit / shortening tips |
|---|---|---|
| Dialogue and thoughts | ≤ **+15%** characters per line | Cut articles and padding; use nominal sentences; « c’est » + fronting (« Le vélo, c’était… »). Never add an explanation the English doesn't have. |
| Watch label (`labels.*`) | one or two words | ≤ 2 lines of ≤ 12 characters (96 px, 9 px caps). Use the forms in 4.4. |
| Watch lap line | ≤ 16 characters | « SEM. PRÉC. 212,4 » |
| Watch buzz / STRIDE notification | ≤ 60 characters | Drop the subject (« Immobile depuis 1 h. »). |
| Gauge labels | one word, ≤ 10 characters | IMMOBILE, PONÇAGE, CADENCE, TRAIT |
| Notebook entries | ≤ **27 characters** (the row does not wrap) | Use the forms in 4.1; they are pre-measured. The heading has room for 20 characters. |
| Hotspot prompts | ≤ +15% or ≤ 26 characters | Infinitive without an article where possible (« Lire les messages », « Enlever la montre »). |
| Objectives | ≤ 30 characters | |
| Choice / menu options | ≤ **+15%** | Hugo's options stay spoken; STRIDE options are nouns (« Repos (demain) »). |
| Buttons (title, pause, end, mobile) | ≤ 24 characters | « Recommencer le chapitre » is the longest allowed. |
| Captions and cards | ≤ 60 characters per line | |
| 3D signs, banners, ticker | ≤ +15% where possible | **Have the scene owner check the fit** for the long ones: « STRIDE — NE T’ARRÊTE JAMAIS », « CYCLES DURAND — FERMÉ — MERCI POUR CES 52 ANS », « CREVAISONS RÉPARÉES — DEMANDER AU N° 14 ». |

---

## 8. Data-shape rules and the self-check

- **Keep every key, array length, object shape and option order.** Keep `correct` flags, `reply: null`, `hand: 'sami'`, `voicemail: true` and `inner: true` exactly as they are.
- **Do not translate** hex colours, ids, numbers (`bibCount`, `faceStart`, `total`, `length`, `scale`), stroke or panel ids, `'H.R.'` or the `KM nn` boards.
- **`who` values:**
  - Keep the helpers (`odile(...)`, `think(...)`).
  - Bark objects keep the names (`who: 'Odile'`, `who: 'Sami'`, `who: 'Mme Benali'`).
  - Only the phone/TV pseudo-speakers change (4.6).
- **Keep `[E] `, `[Space]`/`[Espace]` and `[A / D]`/`[Q / D]`** as a bracketed prefix. UI.js turns `[...]` into a key chip.
- **Watch faces** in `atChapter` and `watchHud` use the decimal comma and keep the `' km'` suffix.
- **Lint before handing over:**
  - Save the script below anywhere outside `src/` (for example in your own `.cache/` scratch folder).
  - Run `node fr-lint.mjs <your fr text files>`.
  - Fix every hit, except an intended exception from section 6, which you list in your handover.

```js
// fr-lint.mjs: French typography lint for HAIRLINE text files.
import { readFileSync } from 'node:fs';
const N = '\u202F';
for (const f of process.argv.slice(2)) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)) {
      const raw = m[1] ?? m[2];
      const s = raw.replace(/\\u202F/gi, N).replace(/\\u00A0/gi, '\u00A0');
      const t = s.replace(/\[[^\]]*\]/g, ''); // key chips are exempt
      const bad = [];
      if (/\\'/.test(raw)) bad.push('straight apostrophe (use ’)');
      if (/\.\.\./.test(s)) bad.push('"..." (use …)');
      if (/[ \u00A0][!?;:»]|[^ \u00A0\u202F\d!?][!?;»]|[A-Za-zÀ-ÿ)%]:(?!\d)/u.test(t)) bad.push('need U+202F before ; : ! ? »');
      if (/«(?!\u202F)/.test(s)) bad.push('need U+202F after «');
      if (/"/.test(s)) bad.push('straight double quote (use « »)');
      if (/\d\.\d/.test(s) && !/\d:\d/.test(s)) bad.push('decimal point (use comma)');
      if (bad.length) console.log(`${f}:${i + 1}: ${bad.join('; ')}\n    ${raw}`);
    }
  });
}
```

---

## 9. Engineering notes (for whoever wires the language switch, not for translators)

These are things the French text **depends on** that live in code. Each one is a small change. Translators assume they will be done.

1. **Decimal comma on the watch.** Faces and laps are generated with `toFixed()` in the code. Format them through one locale helper (`fr`: replace `.` with `,`).
   - `ch2.js`: the `watchFace` live face. It also does `parseFloat(seed.face)`, which must read « 0,32 km », so replace the comma before parsing.
   - `ch3.js`: `fmtKm` (and `fmtLap` if it ever emits decimals).
   - `ch5.js`: the live run face (`(runM / 1000).toFixed(2)`).
   - `UI.js`: `watchCount()`, the inner `fmt` (`v.toFixed(decimals)`).

   Do it all or not at all; a mix of `0,0` and `0.32` on one face is worse than either.
2. **OUVERT on the lettering board** (`scene4.js`, `strokes` under "the OPEN sign board").
   - French needs its own stroke set, kept at **6 strokes** so the minigame length is unchanged:
     - O (loop)
     - U (one path)
     - V (one path)
     - E (stem plus comb as one path, like the current comb)
     - R (stem up, bowl, leg as one path)
     - T (bar, back to the centre, stem down)
   - Narrow the letters to fit the board.
   - The Ch5 fallback sign reads `T5.signs.open`, which is « OUVERT » in French.
   - If this cannot be done, keep OPEN and use the fallback line in section 5 (#64).
3. **Hardcoded key prefixes:**
   - `ch4.js` builds `` `[A / D] ${L.hints.sand}` ``.
   - `minigames.js` defaults to `` `[A / D] ${L.hints.rhythm}` `` and `cue = '[Space]'`.

   Read them from text (`L.ch3.keys.both`, `L.hints.space`) so the French shows `[Q / D]` and `[Espace]`. Ideally, label keys from `navigator.keyboard.getLayoutMap()` where available, with AZERTY as the French fallback.
4. **Mute on AZERTY.** `main.js` checks `code === 'KeyM'`, which is the `,` key on AZERTY. Also accept `e.key.toLowerCase() === 'm'`, so the « M » the French text promises works.
5. **Hardcoded English in code:**
   - `main.js`: `'Muted'` / `'Sound on'` become « Son coupé » / « Son activé ».
   - `UI.js` pause: `'Graphics'` and `Low/Medium/High` become « Graphismes » and « Bas / Moyen / Élevé ».
   - The `VOICEMAIL` tag becomes « MESSAGE VOCAL ».
   - The `minigames.js` fallback hint `'Alternate. Steady, not fast.'`.
   - The language selector: « Langue », « English », « Français ».
6. **Speaker colours.** `speakerClass()` takes the first word of `who`, lowercased, and strips non-ASCII. « Maman » gives `maman`, and « Téléphone » gives `tlphone`.
   - Add `.who.maman` (= `--c-mum`) and normalise accents (NFD + strip combining marks) so « Téléphone » gives `telephone` (= `--c-phone`).
   - « Dr Okafor (cabinet) » and « Bastien (club) » already map to `dr` and `bastien`.
7. **Fonts.** Check that the hand font (notebook), mono font (watch) and UI font render `’ « » … œ É À Ç` and U+202F. All the listed system fonts do, but take one screenshot each with `?lang=fr`.
8. **3D sign fit** for the long French signs listed in section 7.

---

## 10. Key decisions at a glance

- **Tu/vous:**
  - Odile vouvoie Hugo until `ch4.day5.book[3]`, « Avant toi ? Deux. », where she counts him among her workshop's people. From then on it is tu.
  - Hugo vouvoie her until `ch4.week7.wrap[1]`, « …Tu veux le peindre. », his only pronoun to her, right after her near-ask.
  - Sami, Bastien, Mum and STRIDE use tu. The doctor, his office, Ines (to Hugo) and Mme Benali use vous.
  - System text uses the infinitive, with no pronoun.
- **Notebook (« CE QUE JE SAIS FAIRE »):** Rouler. · Courir. · Ne pas bouger. · Poncer dans le sens du fil. · Mesurer deux fois. · Faire un gris pas triste. · Dévoiler une roue. · Peindre une enseigne. · **Aprendre.** · Se reposer. · *(certains dimanches)*
- **Tagline:** « La fêlure était plus fine qu’un cheveu. Elle allait jusqu’au bout. »
- **Teech:** **« Aprendre. »** One missing *p*, the most natural kid misspelling. *Apprendre* means both teach and learn, and it pays off in « Tu apprends. » and the ending card.
