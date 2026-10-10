// Progress save (localStorage, this browser only): the chapter to resume at. Saved at the start of
// every chapter, cleared at the end card. A chapter always replays from its start: chapters are one
// script each, with no mid-chapter entry point. Everything else lives with its owner, also in
// localStorage: cross-chapter story flags (memory.js), the pocket (items.js), the OPEN sign (minigames.js),
// voices (core/Voice.js), graphics (render/Quality.js) and mute (core/Audio.js).
//
// Versions: v1 = the five-chapter game (index 4 = « Le Mur »); v2 = Revision 4's seven chapters
// (docs/SCRIPT-R4.md §0.3: « Le Mur » is index 6). A v1 save is read through V1_TO_V2 and rewritten as v2.

const KEY = 'hairline.save';
const VERSION = 2;
/** v1 chapter index -> v2 index. Ch1-Ch4 keep their index; the old Ch5 « Le Mur » became Ch7. */
export const V1_TO_V2 = [0, 1, 2, 3, 6];

/** The saved chapter index (1..count-1), or null: nothing saved, chapter 1, or a bad entry. Never throws. */
export function savedChapter(count) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || !Number.isInteger(s.chapter)) return null;
    let chapter = null;
    if (s.v === VERSION) chapter = s.chapter;
    else if (s.v === 1) {
      chapter = V1_TO_V2[s.chapter] ?? null;
      if (chapter !== null) write(chapter, s.at); // migrate in place
    }
    return chapter !== null && chapter >= 1 && chapter < count ? chapter : null;
  } catch {
    return null;
  }
}

function write(index, at = new Date().toISOString()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, chapter: index, at }));
  } catch {
    /* private window / storage blocked: no resume, the game still plays */
  }
}

/** Director: a chapter has started. */
export function saveChapter(index) {
  write(index);
}

/** End card or New game: forget the chapter. */
export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}
