// Revision 4 minigames, one module per game in this folder (docs/DESIGN-R4.md).
// Every module except this one is registered automatically, so parallel authors never edit a shared list.
// A game module exports:
//   export const id = 'photo';                       // the registry key (defaults to the file name)
//   export async function play(ctx, d, opts) { ... }  // resolves with a result object; never rejects
// Rules every game follows (as the older minigames do):
//   - it finishes on its own with no input (an idle assist), so nothing soft-locks;
//   - it runs its blocking loop inside d.until / d.gate, so __game.debug.skip() ends it;
//   - it cleans up everything it created (DOM, meshes, listeners, camera) when it ends;
//   - it takes its text from opts (the chapter passes L.* strings), never hard-coded.
// Test any game on any chapter's scene: ?debug=1&autostart=1&skipcards=1&chapter=N, then
//   await __game.debug.game('photo', { ...opts })
// Chapters call playGame(id, ctx, d, opts) or d.game(id, opts). The held pocket item is put away first (the
// pocket stays shut during a game). Text: opts.text from L.games.<id> (text/games/ch5.js, ch6.js); the key
// ring's text is L.games.keyRing (game id 'keyring').

import { pocket } from '../items.js';

const modules = import.meta.glob(['./*.js', '!./index.js'], { eager: true });

export const GAMES = {};
for (const [path, mod] of Object.entries(modules)) {
  if (typeof mod.play !== 'function') continue;
  const id = mod.id || path.replace(/^\.\//, '').replace(/\.js$/, '');
  GAMES[id] = mod;
}

/** Run a registered game. Resolves with its result, or { error } when the id is unknown or it throws. */
export async function playGame(id, ctx, d, opts = {}) {
  const g = GAMES[id];
  if (!g) {
    console.warn('[games] unknown game', id, Object.keys(GAMES));
    return { error: 'unknown' };
  }
  try {
    if (pocket.selected?.()) pocket.select(null); // an item held over a game would follow the cursor through it
    return await g.play(ctx, d, opts);
  } catch (err) {
    console.error('[games] game failed', id, err);
    return { error: String(err) };
  }
}
