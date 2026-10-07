// ALL player-facing text for HAIRLINE (source: docs/DESIGN.md), assembled from src/story/text/.
// Each chapter's text lives in its own file (text/chN.js, owned by that chapter's agent);
// shared text (title, opening, stumble lines, watch, notebook, ending) is in text/common.js.
//
// Dialogue lines are { who, text, inner?, voicemail? }:
//   who   - speaker label ('Hugo', 'Odile', 'Sami', 'Bastien', 'STRIDE', 'Dr Okafor', ...) or null
//   inner - true for Hugo's inner monologue (rendered italic, no speaker label)
// Correction menus are { who, prompt, options: [{ text, correct, reply }] }.
// STRIDE menus are { prompt, options: [{ text, reply }] } (reply = inner-thought string | string[] | null).
// Plain strings are for non-blocking thoughts, watch buzzes, captions and signs.

//
// L keeps its identity (and its nested objects') across language changes: i18n.js swaps the text
// in place. Read strings at runtime; never cache a string from L at module scope.

import { initTexts } from './i18n.js';
import common from './text/common.js';
import ch1 from './text/ch1.js';
import ch2 from './text/ch2.js';
import ch3 from './text/ch3.js';
import ch4 from './text/ch4.js';
import ch5 from './text/ch5.js';
import frCommon from './text/fr/common.js';
import frCh1 from './text/fr/ch1.js';
import frCh2 from './text/fr/ch2.js';
import frCh3 from './text/fr/ch3.js';
import frCh4 from './text/fr/ch4.js';
import frCh5 from './text/fr/ch5.js';

export { hugo, think, odile, sami, bastien, ines, marco, dr, stage, NAMES } from './text/common.js';

export const TEXTS = {
  en: { ...common, ch1, ch2, ch3, ch4, ch5 },
  fr: { ...frCommon, ch1: frCh1, ch2: frCh2, ch3: frCh3, ch4: frCh4, ch5: frCh5 },
};

export const L = initTexts(TEXTS);


export default L;
