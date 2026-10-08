// Progress save (localStorage, this browser only): the chapter to resume at. Saved at the start of
// every chapter, cleared at the end card. A chapter always replays from its start: chapters are one
// script each, with no mid-chapter entry point. Everything else lives with its owner, also in
// localStorage: cross-chapter story flags (memory.js), the OPEN sign (minigames.js), language
// (i18n.js), voices (core/Voice.js), graphics (render/Quality.js) and mute (core/Audio.js).

const KEY = 'hairline.save';
const VERSION = 1;

/** The saved chapter index (1..count-1), or null: nothing saved, chapter 1, or a bad entry. Never throws. */
export function savedChapter(count) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s?.v !== VERSION || !Number.isInteger(s.chapter)) return null;
    return s.chapter >= 1 && s.chapter < count ? s.chapter : null;
  } catch {
    return null;
  }
}

/** Director: a chapter has started. */
export function saveChapter(index) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, chapter: index, at: new Date().toISOString() }));
  } catch {
    /* private window / storage blocked: no resume, the game still plays */
  }
}

/** End card or New game: forget the chapter. */
export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}
