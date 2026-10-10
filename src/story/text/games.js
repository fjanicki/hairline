// Revision 4 minigame text, L.games.<id> (story/games/*.js take it through opts.text). One file per chapter
// so the Ch5 and Ch6 builders edit their own: text/games/ch5.js, text/games/ch6.js. Keys must not collide.
import ch5 from './games/ch5.js';
import ch6 from './games/ch6.js';

export default { ...ch5, ...ch6 };
