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

import common from './text/common.js';
import ch1 from './text/ch1.js';
import ch2 from './text/ch2.js';
import ch3 from './text/ch3.js';
import ch4 from './text/ch4.js';
import ch5 from './text/ch5.js';

export { hugo, think, odile, sami, bastien, ines, marco, dr, stage, NAMES } from './text/common.js';

export const L = {
  ...common,
  ch1,
  ch2,
  ch3,
  ch4,
  ch5,
};


export default L;
