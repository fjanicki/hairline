// ALL player-facing text for HAIRLINE (source: docs/DESIGN.md), assembled from src/story/text/.
// The game is French only: the text files hold the text as shown (style guide: docs/i18n-fr.md,
// check: `node scripts/text-check.mjs`). Each chapter's text lives in its own file (text/chN.js, N = 1..7 in
// the Revision 4 order, docs/SCRIPT-R4.md §0.3);
// shared text (title, opening, stumble lines, watch, notebook, ending) is in text/common.js.
//
// Dialogue lines are { who, text, inner?, voicemail? }:
//   who   - speaker label ('Hugo', 'Odile', 'Sami', 'Bastien', 'STRIDE', 'Dr Okafor', ...) or null
//   inner - true for Hugo's inner monologue (rendered italic, no speaker label)
// Correction menus are { who, prompt, options: [{ text, correct, reply }] }.
// STRIDE menus are { prompt, options: [{ text, reply }] } (reply = inner-thought string | string[] | null).
// Plain strings are for non-blocking thoughts, watch buzzes, captions and signs.
//
// L keeps its identity (and its nested objects') when key labels are re-resolved: i18n.js rewrites the
// text in place. Read strings at runtime; never cache a string from L at module scope.

import { initTexts } from './i18n.js';
import common from './text/common.js';
import ch1 from './text/ch1.js';
import ch2 from './text/ch2.js';
import ch3 from './text/ch3.js';
import ch4 from './text/ch4.js';
import ch5 from './text/ch5.js';
import ch6 from './text/ch6.js';
import ch7 from './text/ch7.js';
import items from './text/items.js'; // the pocket (story/items.js)
import caseFile from './text/caseFile.js'; // L’AFFAIRE, the notebook's case tab
import games from './text/games.js'; // the R4 minigames (story/games/), L.games.<id>

export { hugo, think, odile, sami, bastien, lou, gerard, jo, durand, dr, stage, NAMES } from './text/common.js';

export const TEXT = { ...common, ch1, ch2, ch3, ch4, ch5, ch6, ch7, items, caseFile, games };

export const L = initTexts(TEXT);

export default L;
