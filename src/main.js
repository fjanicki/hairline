import { Engine, hasWebGL } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Assets } from './core/Assets.js';
import { AudioSys } from './core/Audio.js';
import { Voice } from './core/Voice.js';
import { Sky } from './render/Sky.js';
import { Mood } from './render/Mood.js';
import { Environment } from './render/Environment.js';
import { TIER_NAMES } from './render/Quality.js';
import { Materials } from './core/Materials.js';
import { look, resolveLook } from './world/look.js';
import { Player, HUGO_TINT } from './player/Player.js';
import { FollowCam } from './player/FollowCam.js';
import { CameraRig } from './player/CameraRig.js';
import { ObjectivePointer } from './ui/ObjectivePointer.js';
import { Inventory } from './ui/Inventory.js';
import { Hotspots } from './world/Hotspots.js';
import { Runner } from './world/Runner.js';
import { World } from './world/World.js';
import * as build from './world/build.js';
import { Director } from './story/Director.js';
import { UI } from './ui/UI.js';
import { L } from './story/script.js';
import * as minigames from './story/minigames.js';
import { restoreMem, memSnapshot, beginChapter } from './story/memory.js';
import { savedChapter, clearSave } from './story/save.js';
import { GAMES, playGame } from './story/games/index.js';
import { itemDebug } from './story/items.js';
import ch1 from './story/ch1.js';
import ch2 from './story/ch2.js';
import ch3 from './story/ch3.js';
import ch4 from './story/ch4.js';
import ch5 from './story/ch5.js';
import ch6 from './story/ch6.js';
import ch7 from './story/ch7.js';

// Revision 4 order (docs/SCRIPT-R4.md §0.3): Ch5 and Ch6 are new, Ch7 « Le Mur » was Ch5.
const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7];
/** The look of chapter i's own build: its `look` name, else CHAPTER_LOOKS[i] (world/look.js). */
const chapterLook = (i) => (CHAPTERS[i] ? resolveLook(CHAPTERS[i].look ?? i) : null);
/** Audio files a chapter plays: its music bed, its ambience and any extra `sounds`. */
const chapterSounds = (ch) => (ch ? [ch.music?.name ?? ch.music, ...(ch.ambience || []), ...(ch.sounds || [])].filter((n) => typeof n === 'string') : []);

const params = new URLSearchParams(location.search);
const flags = {
  debug: params.get('debug') === '1',
  chapter: Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(params.get('chapter') || '0', 10) || 0)),
  autostart: params.get('autostart') === '1',
  skipcards: params.get('skipcards') === '1',
};
// Saved progress (story/save.js): offered as Continue on the title screen. ?chapter= and autostart
// (tests, debug) ignore it. The loading bar preloads the saved chapter, the likely choice.
const resumeAt = params.has('chapter') || flags.autostart ? null : savedChapter(CHAPTERS.length);
if (resumeAt !== null) flags.chapter = resumeAt;

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
  if (flags.debug) ui.textLog = []; // __game.debug.textLog

  if (!hasWebGL()) return ui.noWebGL();
  let engine;
  try {
    engine = new Engine(document.getElementById('c'));
  } catch (err) {
    console.error('[hairline] WebGL renderer failed', err);
    return ui.noWebGL();
  }
  // Reload at the current chapter (like Pause > Restart), not the title: set once the director exists.
  let reloadHere = () => location.reload();
  engine.onContextLost = () => ui.contextLost(() => reloadHere());
  engine.beforeFrame = () => input.beginFrame();

  const audio = new AudioSys();
  ui.audio = audio;
  const voice = new Voice({ audio, L, debug: flags.debug }); // French voice-over (docs/voice.md)
  ui.voice = voice;
  const assets = new Assets();
  assets.halfRes = engine.tier.name === 'low'; // prop textures at half size, like the material sets
  const sky = new Sky();
  engine.scene.add(sky.mesh);
  // Look: PBR material library + HDRI environment, both lazy and failure-tolerant (flat colours / no
  // IBL when the files are missing).
  const materials = new Materials(engine.renderer, { anisotropy: engine.tier.anisotropy, halfRes: engine.tier.name === 'low' });
  look.bind(materials);
  const env = new Environment(engine.renderer);
  const mood = new Mood({ engine, sky, audio, env });
  mood.setQuality(engine.tier);
  engine.on('quality', (t) => {
    mood.setQuality(t);
    materials.setAnisotropy(t.anisotropy);
  });
  const cam = new FollowCam(engine.camera);
  const runner = new Runner();
  const world = new World({ scene: engine.scene, assets });
  engine.start({ tickWhenHidden: flags.debug });

  // Loading bar: everything the first chapter waits on (the characters, its PBR sets, HDRIs and
  // props), each part weighted by its rough download size in MB, so the bar follows the bytes rather
  // than the stages. Every part is registered up front, so the bar only moves forward. It hides when
  // all of it is in, or after 30 s on a very slow line (the rest then streams in behind the fade).
  // Music and ambience never hold it: they fade in when they arrive.
  ui.loading(0.02);
  audio.preload(chapterSounds(CHAPTERS[flags.chapter])); // the rest load with their chapters
  const first = chapterLook(flags.chapter) || {};
  const parts = new Map(); // key -> [weight MB, progress 0..1]
  const report = () => {
    let w = 0;
    let d = 0;
    for (const [pw, pp] of parts.values()) {
      w += pw;
      d += pw * pp;
    }
    ui.loading(0.02 + 0.98 * (d / (w || 1)));
  };
  const part = (key, mb, start) => {
    parts.set(key, [mb, 0]);
    return () => Promise.resolve(start()).finally(() => {
      parts.set(key, [mb, 1]);
      report();
    });
  };
  const firstIds = look.materialIds(first);
  const jobs = [
    ...firstIds.map((id) => part('mat:' + id, 2, () => materials.preload([id], { timeout: 30000 }))),
    ...(first.hdris || []).map((id) => part('hdri:' + id, 1.6, () => env.preload([id]))),
    ...(first.props || []).map((p) => part('prop:' + p, 0.5, () => assets.preload([p]))),
  ];
  parts.set('characters', [5.4, 0]);
  const chars = assets.loadCore((p) => {
    parts.set('characters', [5.4, p]);
    report();
  });
  await materials.init(); // the manifest and grime masks (small)
  await Promise.race([Promise.all([chars, ...jobs.map((j) => j())]), engine.wait(30)]);
  await chars; // never rejects; the capsule fallback needs it settled
  if (flags.debug) window.__game.loadTime = performance.now();

  const hugo = assets.makeCharacter({ preset: 'hugo', tint: HUGO_TINT, name: 'Hugo' });
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
    materials,
    look,
    env,
  };
  ctx.voice = voice;
  // Render first pass around every scene build: activate the scene's look, free the GPU sets it does not
  // list, preload its materials, props and HDRIs in parallel (and the next look's HDRIs in the background),
  // then after the build restyle Kenney props, add light cones, fit the sun's shadow box to the playable
  // area and weather the boot. Chapter builds go through it (wrapped below); so do mid-chapter scene swaps
  // (Director.scene -> ctx.loadSet). lk: a chapter index, a LOOKS name or a look object.
  const loadSet = async (lkRef, buildFn, { nextLook = null, bounds = null, beforeBuild = null } = {}) => {
    const lk = look.begin(lkRef);
    env.retain([...(lk?.hdris || []), ...(nextLook?.hdris || [])]);
    // GPU memory: the previous scene is unloaded by now. Free the material sets and prop scenes this one
    // does not list (a later scene uploads them again behind its own fade).
    const ids = look.materialIds(lk);
    const evicted = materials.retain(ids);
    const released = assets.releaseProps(lk?.props || []);
    if (flags.debug && (evicted || released)) console.info(`[hairline] ${lk?.key ?? 'scene'}: freed ${evicted} material sets, ${released} props from the GPU`);
    await Promise.all([
      materials.preload(ids),
      Promise.race([Promise.all([env.preload(lk?.hdris || []), assets.preload(lk?.props || [])]), engine.wait(6)]),
    ]);
    env.preload(nextLook?.hdris || []); // background
    beforeBuild?.();
    const r = await buildFn(ctx);
    if (r?.group && lk) {
      r.group.traverse((o) => {
        if (o.name?.startsWith('prop:kenney/') && !o.userData.noRestyle) materials.restyleKenney(o, lk.kenney);
      });
      if (lk.cones) r.lightCones = build.addLightCones(r.group);
    }
    mood.fitShadows(r?.bounds ?? bounds);
    if (lk) player.weatherBoot(materials, { grime: lk.grime ?? 0.6, wet: lk.wet ?? 0 }); // the boot weathers with the street
    return r;
  };
  ctx.loadSet = loadSet;
  CHAPTERS.forEach((ch, i) => {
    const orig = ch.build;
    if (!orig || orig._lookWrapped) return;
    const wrapped = async (c) => {
      const nextLook = chapterLook(i + 1) || {};
      // Decode this chapter's sounds (every scene's: list them all in `sounds`); only fetch the next
      // chapter's (decoded at its own build: the long stereo beds are ~20 MB each decoded).
      const sounds = [...chapterSounds(ch), ...(i === CHAPTERS.length - 1 ? ['piano'] : [])];
      const nextSounds = chapterSounds(CHAPTERS[i + 1]).filter((n) => !sounds.includes(n));
      const beforeBuild = () => {
        audio.releaseChapter(sounds, { prefetch: nextSounds }); // the previous chapter's sfx loops, beds and decoded buffers
        audio.preload(sounds);
        audio.prefetch(nextSounds);
      };
      const r = await loadSet(ch.look ?? i, (cx) => orig.call(ch, cx ?? c), { nextLook, bounds: ch.player?.bounds, beforeBuild });
      // Download (not upload) the next chapter's material sets and props in the background once this
      // one is playing, so its build only waits on GPU uploads (Ch1 -> Ch2 is about 38 MB).
      if (CHAPTERS[i + 1]) {
        engine.wait(3).then(() => {
          materials.preload(look.materialIds(nextLook), { upload: false, timeout: 120000 });
          assets.preload(nextLook.props || []);
        });
      }
      return r;
    };
    wrapped._lookWrapped = true;
    ch.build = wrapped;
  });
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
  // Restart chapter: reload to the title, whose Continue resumes at this chapter (saved when it began).
  // The title click also unlocks audio again. Debug runs keep the ?chapter= reload.
  const restart = () => {
    const q = new URLSearchParams();
    if (flags.debug) q.set('debug', '1');
    if (flags.debug) q.set('chapter', String(Math.max(0, director.index)));
    location.href = location.pathname + (q.toString() ? `?${q}` : '');
  };
  reloadHere = restart;
  // Graphics quality (pause menu, __game.quality): src/render/Quality.js tiers.
  const quality = {
    get: () => engine.quality,
    set: (name) => engine.setQuality(name, { remember: true }),
    tiers: TIER_NAMES,
    get gpu() {
      return engine.gpu;
    },
    get source() {
      return engine.qualitySource;
    },
  };
  const setPaused = (p) => {
    if (director.state === 'boot' || director.state === 'end') return;
    engine.setPaused(p);
    audio.setPaused(p);
    ui.paused = p;
    if (p) ui.showPause({ onResume: () => setPaused(false), onRestart: restart, quality });
    else {
      ui.hidePause();
      // Enter/Space on the focused Resume button (or keys pressed while paused) must not reach the
      // first unpaused frame, or they would also advance a dialogue line, close a card or press START.
      input._next.clear();
      input.pressed.clear();
    }
  };
  // Mouse look (pointer lock / drag, wheel zoom, R re-centre, occlusion) and the objective pointer.
  // Losing the pointer lock to Esc pauses at once, so one Esc both frees the mouse and pauses.
  const rig = new CameraRig({ cam, canvas: engine.renderer.domElement, input, ui, engine, world, player, getDirector: () => director, onLockLost: () => setPaused(true) });
  const pointer = new ObjectivePointer({ root: document.getElementById('ui'), camera: engine.camera, hotspots, player, rig, getDirector: () => director, ctx });
  engine.add(rig);
  engine.add({ update: () => audio.updateListener(engine.camera, player.root) }); // positional sfx
  engine.add(pointer);
  engine.add(new Inventory({ ui, input, rig, getDirector: () => director })); // the pocket (story/items.js)
  input.onKey((code, e) => {
    if (code === 'Escape' && !rig.swallowEscape()) setPaused(!engine.paused);
    // e.key too: the M on AZERTY is code Semicolon (KeyM is its comma). Labelled by KeyLabels ('{KeyM}').
    else if (code === 'KeyM' || e?.key?.toLowerCase() === 'm') ui.hint(audio.toggleMute() ? L.ui.muted : L.ui.soundOn, 1.6);
  });
  document.addEventListener('visibilitychange', () => {
    if (flags.debug) return;
    // The opening and end cards have no pause menu: a hidden tab still silences them (the piano).
    if (director.state === 'boot' || director.state === 'end') audio.setPaused(document.hidden);
    else if (document.hidden) setPaused(true);
    else if (audio._paused && !engine.paused) audio.setPaused(false); // hidden on a card, back in play
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
      rig,
      pointer,
      hotspots,
      runner,
      world,
      assets,
      minigames,
      materials,
      look,
      env,
      post: engine.post,
      quality,
      debug: {
        goto: (i) => director.goto(i),
        // Revision 4 minigames (story/games/): games() lists them, game(id, opts) runs one on the current scene.
        games: () => Object.keys(GAMES),
        game: (id, opts) => playGame(id, ctx, director, opts),
        items: itemDebug(), // the pocket and the case file: list(), give(id), take(id), select(id), state()
        skip: () => director.skip(),
        hold: (code, ms) => input.hold(code, ms),
        press: (code) => input.press(code),
        setHope: (h) => mood.set(h, { snap: true }),
        teleport: (x, z) => player.teleport(x, z),
        // Set the camera view without a mouse: yaw relative to the chapter default, pitch absolute
        // elevation (degrees), optional zoom factor; clamped like mouse look. Returns rig.view().
        look: (yawDeg, pitchDeg, zoom) => rig.look(yawDeg, pitchDeg, zoom),
        view: () => rig.view(),
        pointer: () => ({ ...pointer.state }),
        trigger: (id) => hotspots.trigger(id),
        mem: () => memSnapshot(), // cross-chapter flags (story/memory.js)
        // textLog: every string the UI has shown (dialogue, thoughts, objectives, prompts, cards, menus,
        // HUD), last 2000.
        textLog: ui.textLog,
        // Audio (core/AudioDebug.js): audioLog = every sound started {t, at, kind, name, file, bus, gain, ...};
        // meter() = RMS/peak dBFS per tap (bus, fx, master, + voice), meter(secs) = RMS history (50 ms).
        audioLog: audio.audioLog,
        meter: (secs) => audio.meter(secs),
        // Voices (core/Voice.js): voiceLog = request/start/end/stop/miss/skip per line; voiceMeter() = meter()
        // + duck gain; autoAdvance(true) lets dialogue lines advance alone (after their clip + 250 ms).
        voice,
        voiceLog: voice.log,
        voiceMeter: (secs) => voice.meter(secs),
        autoAdvance: (on = true) => (ui.autoAdvance = !!on),
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
              const t = dl.innerText.replace(/\s+/g, ' ').replace(/\S+ ▸$/, '').trim();
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
          // calls = the scene pass incl. shadow maps (the chapter budget); callsPost = full-screen passes
          calls: engine.post.stats.scene,
          callsPost: engine.post.stats.post,
          quality: engine.quality,
        }),
      },
    });
  }
  director.ready.then(resolveReady);

  ui.hideLoading();
  const coarse = window.matchMedia?.('(pointer:coarse)').matches && !window.matchMedia?.('(any-pointer:fine)').matches;
  if (!flags.autostart && (coarse || window.innerWidth < 640)) await ui.mobileWarning();

  if (!flags.autostart) {
    const choice = await ui.title({
      onBegin: () => audio.resume(),
      quality,
      resume: resumeAt === null ? null : { num: resumeAt + 1, name: () => CHAPTERS[resumeAt].title },
    });
    if (choice === 'new') {
      // New game: forget the saved chapter, the story flags and the OPEN sign. Options stay.
      flags.chapter = 0;
      clearSave();
      beginChapter(0);
      minigames.forgetOpenSign();
    }
    if (audio.muted) ui.hint(L.ui.muted, 2.5); // M from an earlier visit is remembered
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
  restoreMem(); // cross-chapter flags (door grey, panel, jobs...)
  if (flags.chapter === 0) await director.card(L.opening, { lineDelay: 1.9, hold: 2.6 });
  director.start(flags.chapter);
}

boot().catch((err) => console.error('[hairline] boot failed', err));
