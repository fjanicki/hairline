import { Engine, hasWebGL } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Assets } from './core/Assets.js';
import { AudioSys } from './core/Audio.js';
import { Sky } from './render/Sky.js';
import { Mood } from './render/Mood.js';
import { Player, HUGO_TINT } from './player/Player.js';
import { FollowCam } from './player/FollowCam.js';
import { Hotspots } from './world/Hotspots.js';
import { Runner } from './world/Runner.js';
import { World } from './world/World.js';
import * as build from './world/build.js';
import { Director } from './story/Director.js';
import { UI } from './ui/UI.js';
import { L } from './story/script.js';
import * as minigames from './story/minigames.js';
import ch1 from './story/ch1.js';
import ch2 from './story/ch2.js';
import ch3 from './story/ch3.js';
import ch4 from './story/ch4.js';
import ch5 from './story/ch5.js';

const CHAPTERS = [ch1, ch2, ch3, ch4, ch5];

const params = new URLSearchParams(location.search);
const flags = {
  debug: params.get('debug') === '1',
  chapter: Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(params.get('chapter') || '0', 10) || 0)),
  autostart: params.get('autostart') === '1',
  skipcards: params.get('skipcards') === '1',
};

// window.__game.ready exists from the very first tick so tests can await it.
let resolveReady;
const ready = new Promise((r) => (resolveReady = r));
if (flags.debug) {
  // Collect errors/warnings for automated checks: __game.errors / __game.warnings.
  const errors = [];
  const warnings = [];
  const wrap = (name, list) => {
    const orig = console[name].bind(console);
    console[name] = (...a) => {
      list.push(a.map((x) => (x instanceof Error ? x.stack || x.message : String(x))).join(' '));
      orig(...a);
    };
  };
  wrap('error', errors);
  wrap('warn', warnings);
  window.addEventListener('error', (e) => { errors.push(String(e.message || e.error)); if (e.error?.stack) console.warn('[hairline] stack', e.error.stack); });
  window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e.reason?.stack || e.reason)));
  window.__game = { ready, flags, errors, warnings };
}

async function boot() {
  const input = new Input();
  const ui = new UI(document.getElementById('ui'), { input, L, skipCards: flags.skipcards });

  if (!hasWebGL()) return ui.noWebGL();
  let engine;
  try {
    engine = new Engine(document.getElementById('c'));
  } catch (err) {
    console.error('[hairline] WebGL renderer failed', err);
    return ui.noWebGL();
  }
  engine.onContextLost = () => ui.contextLost();
  engine.beforeFrame = () => input.beginFrame();

  const audio = new AudioSys();
  ui.audio = audio;
  const assets = new Assets();
  const sky = new Sky();
  engine.scene.add(sky.mesh);
  const mood = new Mood({ engine, sky, audio });
  const cam = new FollowCam(engine.camera);
  const runner = new Runner();
  const world = new World({ scene: engine.scene, assets });
  engine.start({ tickWhenHidden: flags.debug });

  ui.loading(0.02);
  audio.preload();
  await assets.loadCore((p) => ui.loading(0.05 + p * 0.95));

  const hugo = assets.makeCharacter({ tint: HUGO_TINT, name: 'Hugo' });
  hugo.persistent = true;
  engine.scene.add(hugo.root);
  const player = new Player({ input, audio, ui, cam, char: hugo, lines: L.stumble });
  mood.player = player;

  const ctx = {
    engine,
    scene: engine.scene,
    camera: engine.camera,
    renderer: engine.renderer,
    input,
    assets,
    audio,
    mood,
    sky,
    ui,
    player,
    cam,
    runner,
    world,
    build,
    minigames,
    L,
    flags,
    hotspots: null,
    director: null,
  };
  const director = new Director(ctx, CHAPTERS, { skipCards: flags.skipcards });
  const hotspots = new Hotspots({ scene: engine.scene, input, ui, getPlayer: () => player, getState: () => director.state });
  ctx.hotspots = hotspots;
  ctx.director = director;
  // Hugo only answers WASD while a chapter is running (not on the title, opening card, fades or end card).
  const LOCKED_STATES = new Set(['boot', 'transition', 'end']);
  player.inputAllowed = () => !LOCKED_STATES.has(director.state);

  // Loop order: input (beforeFrame) -> director (engine timers/frame waiters) -> player -> runners
  //             -> mixers -> world hooks -> camera -> hotspots -> mood -> UI -> render.
  engine.add(player);
  engine.add(runner);
  engine.add(assets);
  engine.add(world);
  engine.add(cam);
  engine.add(hotspots);
  engine.add(mood);
  engine.add(ui);

  // Pause (Esc / tab hidden) and mute (M).
  const restart = () => {
    const q = new URLSearchParams();
    if (flags.debug) q.set('debug', '1');
    q.set('chapter', String(Math.max(0, director.index)));
    location.href = `${location.pathname}?${q}`;
  };
  const setPaused = (p) => {
    if (director.state === 'boot' || director.state === 'end') return;
    engine.setPaused(p);
    audio.setPaused(p);
    ui.paused = p;
    if (p) ui.showPause({ onResume: () => setPaused(false), onRestart: restart });
    else {
      ui.hidePause();
      // Enter/Space on the focused Resume button (or keys pressed while paused) must not reach the
      // first unpaused frame, or they would also advance a dialogue line, close a card or press START.
      input._next.clear();
      input.pressed.clear();
    }
  };
  input.onKey((code) => {
    if (code === 'Escape') setPaused(!engine.paused);
    else if (code === 'KeyM') ui.hint(audio.toggleMute() ? 'Muted' : 'Sound on', 1.6);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !flags.debug) setPaused(true);
  });

  if (flags.debug) {
    // setTimeout is throttled to ~1 s in a hidden tab; a MessageChannel yield is not.
    // One shared channel: a new MessageChannel per yield (thousands per second while spinning)
    // leaked entangled ports at ~100 MB/s in Firefox during long debug.advance() runs.
    const yieldCh = new MessageChannel();
    const yieldQ = [];
    yieldCh.port1.onmessage = () => yieldQ.shift()?.();
    const yieldOnce = () =>
      new Promise((r) => {
        yieldQ.push(r);
        yieldCh.port2.postMessage(0);
      });
    const debugSleep = async (ms) => {
      const end = performance.now() + ms;
      while (performance.now() < end) await yieldOnce();
    };
    Object.assign(window.__game, {
      ctx,
      director,
      player,
      mood,
      renderer: engine.renderer,
      input,
      engine,
      ui,
      audio,
      cam,
      hotspots,
      runner,
      world,
      assets,
      minigames,
      debug: {
        goto: (i) => director.goto(i),
        skip: () => director.skip(),
        hold: (code, ms) => input.hold(code, ms),
        press: (code) => input.press(code),
        setHope: (h) => mood.set(h, { snap: true }),
        teleport: (x, z) => player.teleport(x, z),
        trigger: (id) => hotspots.trigger(id),
        // Autoplay for `ms`: presses E whenever a dialogue is open, picks choice `choose` in menus,
        // and (in 'play') triggers the first required hotspot unless `spots: false`. Otherwise it
        // can tap a steady A/D rhythm (`rhythm: true`) or a `key`. Resolves to the lines seen.
        advance: async (ms = 5000, { choose = null, step = 400, spots = true, rhythm = false, key = null } = {}) => {
          const seen = [];
          const end = performance.now() + ms;
          let k = 0;
          while (performance.now() < end) {
            const dl = document.getElementById('dialogue');
            const ch = document.getElementById('choices');
            if (dl?.classList.contains('show')) {
              const t = dl.innerText.replace(/\s+/g, ' ').replace(/E ▸$/, '').trim();
              if (t && seen[seen.length - 1] !== t) seen.push(t);
              input.press('KeyE');
            } else if (choose != null && ch?.classList.contains('show')) {
              seen.push('CHOICES: ' + ch.innerText.replace(/\s+/g, ' '));
              input.press('Digit' + choose);
            } else {
              const req = spots && director.state === 'play' ? [...hotspots.spots.values()].find((sp) => sp.required && sp.enabled !== false) : null;
              if (req) {
                seen.push('TRIGGER ' + req.id);
                hotspots.trigger(req.id);
              } else if (rhythm) input.press(k++ % 2 ? 'KeyD' : 'KeyA');
              else if (key) input.press(key);
            }
            await debugSleep(rhythm ? 360 : step);
          }
          // Keep only the last (complete) version of each typed-out line.
          return seen.filter((t, i) => !(seen[i + 1] && seen[i + 1].startsWith(t) && !t.startsWith('TRIGGER')));
        },
        // Paint the current frame into an overlay <img> (page screenshots of an occluded window are stale).
        shot: (holdMs = 1500) => {
          // A hidden tab doesn't advance CSS transitions either: settle them so the HUD is current.
          for (const an of document.getAnimations()) {
            try {
              if (an.effect?.getTiming?.().iterations !== Infinity) an.finish();
            } catch {
              /* ignore */
            }
          }
          engine.tick(performance.now());
          const cv = engine.renderer.domElement;
          let im = document.getElementById('debug-shot');
          if (!im) {
            im = document.createElement('img');
            im.id = 'debug-shot';
            im.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
            cv.after(im);
          }
          im.src = cv.toDataURL('image/jpeg', 0.85);
          im.style.display = 'block';
          clearTimeout(im._t);
          im._t = setTimeout(() => (im.style.display = 'none'), holdMs);
        },
        state: () => ({
          state: director.state,
          chapter: director.index,
          hope: +mood.hope.toFixed(3),
          pos: player.root.position.toArray().map((v) => +v.toFixed(2)),
          pain: +player.pain.toFixed(2),
          spots: [...hotspots.spots.keys()],
          calls: engine.renderer.info.render.calls,
        }),
      },
    });
  }
  director.ready.then(resolveReady);

  ui.hideLoading();
  const coarse = window.matchMedia?.('(pointer:coarse)').matches && !window.matchMedia?.('(any-pointer:fine)').matches;
  if (!flags.autostart && (coarse || window.innerWidth < 640)) await ui.mobileWarning();

  if (!flags.autostart) {
    await ui.title({ onBegin: () => audio.resume() });
  } else {
    // Audio stays silent until a real gesture.
    const unlock = (e) => {
      if (!e.isTrusted) return;
      audio.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  await minigames.restoreMemory(); // Ch4's OPEN sign, after a Restart chapter reload
  if (flags.chapter === 0) await director.card(L.opening, { lineDelay: 1.9, hold: 2.6 });
  director.start(flags.chapter);
}

boot().catch((err) => console.error('[hairline] boot failed', err));
