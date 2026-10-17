/* Roadster Run: boot, input, the game loop and the page controls. */
(function () {
  'use strict';
  const A = window.RRArt, Core = window.RRCore;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('rr.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rr.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };

  // A page can set window.RR_CONFIG = { palette: 'holo', music: false, fit: 'css' } before this script.
  const CONF = window.RR_CONFIG || {};

  function start(prev) {
    prev = prev || {};
    const cat = A.buildCatalogue();
    const game = new Core.Game(cat);
    const canvas = document.getElementById('game');
    const screen = document.getElementById('screen');
    const r2d = new window.RRRender2D(canvas, cat, { h: CONF.screenH });
    const audio = new window.RRAudio('assets/');
    const $ = id => document.getElementById(id);

    game.best = Math.max(prev.best || 0, store.get('best', 0));
    const confPal = Math.max(0, A.PALETTES.findIndex(p => p.id === CONF.palette));
    let palette = prev.palette !== undefined ? prev.palette : store.get('palette', confPal);
    if (!(palette >= 0 && palette < A.PALETTES.length)) palette = confPal;
    r2d.setPalette(palette);
    audio.muted = prev.muted !== undefined ? prev.muted : store.get('muted', false);
    audio.musicOn = prev.musicOn !== undefined ? prev.musicOn : store.get('music', CONF.music !== undefined ? CONF.music : true);
    let crt = store.get('crt', false);
    let runs = 0;
    // views: the pixel 2D screen, or three 3D cameras over the same game
    const VIEWS = ['2d', 'chase', 'side', 'tv'];
    const VIEW_NAMES = { '2d': '2D', chase: '3D CHASE', side: '3D SIDE', tv: '3D TV' };
    let view = (location.hash || '').toLowerCase() === '#3d' ? 'chase' : '2d';
    let r3d = null, loading3d = null;

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    r2d.touch = coarse;
    document.body.classList.toggle('is-touch', coarse);

    // ------------------------------------------------------------ controls panel
    // pages may leave out any of these buttons, so every update checks first
    const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    const setPressed = (id, v) => { const el = $(id); if (el) el.setAttribute('aria-pressed', String(v)); };
    function label() {
      const L = CONF.labels || {};
      setText('optColors', (L.colors !== undefined ? L.colors : 'COLORS: ') + A.PALETTES[palette].name);
      setText('optSound', (L.sound !== undefined ? L.sound : 'SOUND: ') + (audio.muted ? 'OFF' : 'ON'));
      setText('optMusic', (L.music !== undefined ? L.music : 'MUSIC: ') + (audio.musicOn ? 'ON' : 'OFF'));
      setText('optCrt', 'CRT: ' + (crt ? 'ON' : 'OFF'));
      setText('optView', (L.view !== undefined ? L.view : 'VIEW: ') + VIEW_NAMES[view]);
      setPressed('optSound', !audio.muted);
      setPressed('optMusic', audio.musicOn);
      setPressed('optCrt', crt);
      document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      screen.classList.toggle('crt', crt);
    }
    const actions = {
      colors() { palette = (palette + 1) % A.PALETTES.length; r2d.setPalette(palette); if (r3d) r3d.setPalette(r2d.pal); store.set('palette', palette); },
      view() { setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]); },
      sound() { audio.unlock(); audio.setMuted(!audio.muted); store.set('muted', audio.muted); },
      music() { audio.unlock(); audio.setMusicOn(!audio.musicOn); store.set('music', audio.musicOn); },
      crt() { crt = !crt; store.set('crt', crt); },
      pause() { togglePause(); },
    };
    // three.js loads the first time a 3D view is picked
    const loadScript = src => new Promise((res, rej) => {
      const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el);
    });
    function ensure3D() {
      if (r3d) return Promise.resolve(r3d);
      if (!loading3d) {
        r2d.notice = 'LOADING 3D...';
        loading3d = (window.THREE ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
          .then(() => (window.THREE.GLTFLoader ? null : loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js').catch(() => null)))
          .then(() => { r3d = new window.RRRender3D(screen, cat, r2d, CONF.view3d); r2d.notice = ''; return r3d; })
          .catch(err => { r2d.notice = '3D IS NOT AVAILABLE HERE'; setTimeout(() => { r2d.notice = ''; }, 2500); loading3d = null; throw err; });
      }
      return loading3d;
    }
    function setView(v) {
      view = v; label();
      if (v === '2d') { screen.classList.remove('is3d'); store.set('view', v); return; }
      ensure3D().then(r => {
        if (view !== v) return;
        r.setView(v); screen.classList.add('is3d'); store.set('view', v);
      }).catch(() => { view = '2d'; screen.classList.remove('is3d'); label(); });
    }

    document.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => { actions[b.dataset.act](); label(); b.blur(); });
    });
    document.querySelectorAll('[data-view]').forEach(b => {
      b.addEventListener('click', () => { audio.unlock(); setView(b.dataset.view); b.blur(); });
    });
    label();

    // ------------------------------------------------------------ input
    const src = { key: { jump: false, duck: false }, ptr: { jump: false, duck: false }, btn: { jump: false, duck: false }, pad: { jump: false, duck: false } };
    let edge = false, flipEdge = 0;
    const jumpHeld = () => src.key.jump || src.ptr.jump || src.btn.jump || src.pad.jump;
    const duckHeld = () => src.key.duck || src.ptr.duck || src.btn.duck || src.pad.duck;
    function press(which, kind, down) {
      if (down) audio.unlock();
      if (kind === 'jump' && down && !src[which].jump) {
        if (game.paused) { togglePause(); src[which].jump = true; return; }
        edge = true;
      }
      src[which][kind] = down;
    }
    // kind is 'back', 'front' or 'side'
    function flip(kind) {
      audio.unlock();
      if (game.paused) { togglePause(); return; }
      flipEdge = kind;
    }

    const JUMP = ['Space', 'ArrowUp', 'KeyW'], DUCK = ['ArrowDown', 'KeyS'];
    const BACK = ['KeyZ', 'KeyA', 'ArrowLeft'], FRONT = ['KeyX', 'KeyD', 'ArrowRight'], SIDE = ['KeyF'];
    window.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (JUMP.includes(e.code) || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) press('key', 'jump', true); }
      else if (DUCK.includes(e.code)) { e.preventDefault(); press('key', 'duck', true); }
      else if (BACK.includes(e.code)) { e.preventDefault(); if (!e.repeat) flip('back'); }
      else if (FRONT.includes(e.code)) { e.preventDefault(); if (!e.repeat) flip('front'); }
      else if (SIDE.includes(e.code)) { e.preventDefault(); if (!e.repeat) flip('side'); }
      else if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); }
      else if (e.code === 'KeyM') { actions.sound(); label(); }
      else if (e.code === 'KeyC') { actions.colors(); label(); }
      else if (e.code === 'KeyV') { actions.view(); }
    });
    window.addEventListener('keyup', e => {
      if (JUMP.includes(e.code) || e.code === 'Enter') press('key', 'jump', false);
      else if (DUCK.includes(e.code)) press('key', 'duck', false);
    });

    // Tapping the screen jumps. On touch screens the left third is the suction button,
    // unless the page puts its own buttons on the screen (RR_CONFIG.zones = false).
    const ptrs = new Map();
    screen.addEventListener('pointerdown', e => {
      e.preventDefault();
      screen.setPointerCapture && screen.setPointerCapture(e.pointerId);
      const r = screen.getBoundingClientRect();
      const kind = coarse && CONF.zones !== false && (e.clientX - r.left) < r.width * 0.33 && game.state === 'play' ? 'duck' : 'jump';
      ptrs.set(e.pointerId, kind);
      press('ptr', kind, true);
    });
    const ptrUp = e => {
      const kind = ptrs.get(e.pointerId); if (!kind) return;
      ptrs.delete(e.pointerId);
      if (![...ptrs.values()].includes(kind)) press('ptr', kind, false);
    };
    screen.addEventListener('pointerup', ptrUp);
    screen.addEventListener('pointercancel', ptrUp);
    screen.addEventListener('contextmenu', e => e.preventDefault());

    [['btnJump', 'jump'], ['btnDuck', 'duck']].forEach(([id, kind]) => {
      const b = $(id);
      if (!b) return;
      // stopPropagation: a button that sits on the screen must not also count as a tap on the screen
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('down'); press('btn', kind, true); });
      const up = () => { b.classList.remove('down'); press('btn', kind, false); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    [['btnBack', 'back'], ['btnFront', 'front'], ['btnSide', 'side']].forEach(([id, kind]) => {
      const b = $(id);
      if (!b) return;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); flip(kind); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });

    let padPause = false, padBack = false, padFront = false, padSide = false;
    function pollPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const p = [...pads].find(x => x && x.connected);
      if (!p) return;
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      const j = b(0) || b(12) || (p.axes[1] || 0) < -0.6, d = b(1) || b(13) || (p.axes[1] || 0) > 0.6;
      if (j !== src.pad.jump) press('pad', 'jump', j);
      if (d !== src.pad.duck) press('pad', 'duck', d);
      const fb = b(2) || b(4) || b(14), ff = b(3) || b(5) || b(15), fs = b(6) || b(7);
      if (fb && !padBack) flip('back');
      if (ff && !padFront) flip('front');
      if (fs && !padSide) flip('side');
      padBack = fb; padFront = ff; padSide = fs;
      if (b(9) && !padPause) togglePause();
      padPause = b(9);
    }

    function togglePause() {
      if (game.state !== 'play' && game.state !== 'intro' && !game.paused) return;
      game.paused = !game.paused;
      audio.play(game.paused ? 'pause_in' : 'pause_out', { vol: 0.6 });
      if (game.paused) { audio.setThrust(0); audio.setWhine(0, false); if (audio.current) audio.current.pause(); }
      else if (audio.current && audio.musicOn) { const p = audio.current.play(); if (p && p.catch) p.catch(() => {}); }
      setText('optPause', game.paused ? 'RESUME' : 'PAUSE');
    }
    const autoPause = () => { if (!game.paused && (game.state === 'play' || game.state === 'intro')) togglePause(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    window.addEventListener('blur', autoPause);

    // ------------------------------------------------------------ events -> sound
    function handle(e) {
      (view !== '2d' && r3d ? r3d : r2d).onEvent(e, game);
      const hook = window.RR && window.RR.onEvent;
      if (typeof hook === 'function') { try { hook(e); } catch (err) { /* a page hook must not stop the game */ } }
      switch (e.type) {
        case 'start': audio.play('start', { vol: 0.7 }); runs++; break;
        case 'go': audio.music(['level1', 'level2', 'level3'][(runs - 1) % 3]); break;
        case 'jump': audio.play('jump', { vol: 0.55 }); break;
        case 'land': audio.play('land', { vol: Math.min(0.9, e.v / 900) }); break;
        case 'flip': audio.play('jump', { vol: 0.7, rate: 0.75 }); break;
        case 'flipLand': audio.play('trick', { rate: 1 + 0.12 * Math.min(4, (e.n || 1) - 1) }); break;
        case 'stunt': audio.play('jump', { vol: 0.6, rate: { back: 1.25, front: 1.4, side: 1.33 }[e.kind] || 1.3 }); break;
        case 'airEmpty': audio.play('tick', { vol: 0.6, rate: 0.6 }); break;
        case 'canyonClear': audio.play('trick', { rate: 1.12 }); audio.play('milestone', { vol: 0.6 }); break;
        case 'canister': audio.play('canister', { vol: 0.8 }); break;
        case 'milestone': audio.play('milestone', { vol: 0.5 }); break;
        case 'close': audio.play('tick', { vol: 0.9, rate: 1.4 }); break;
        case 'rampAhead': audio.play('tick', { vol: 0.7 }); break;
        case 'canyonAhead': audio.play('alarm', { vol: 0.45 }); setTimeout(() => audio.play('alarm', { vol: 0.45 }), 650); break;
        case 'crash': audio.play('crash', { vol: 0.9 }); audio.play('clang', { vol: 0.7 }); audio.music(null); break;
        case 'fall': audio.play('fall', { vol: 0.9 }); audio.music(null); break;
        case 'boom': audio.play('boom', { vol: 0.8 }); break;
        case 'over': if (e.newBest) store.set('best', e.best); break;
      }
    }

    // ------------------------------------------------------------ sizing
    // Scale the 600x200 screen by whole device pixels when that costs little room.
    function fit() {
      if (CONF.fit === 'css') return;          // the page sizes the canvas itself
      const dpr = window.devicePixelRatio || 1;
      const cs = getComputedStyle(screen);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = screen.parentElement.clientWidth - padX;
      const top = Math.min(130, screen.getBoundingClientRect().top + window.scrollY);
      // leave room for the controls under the screen, except on a sideways phone
      const sideways = coarse && window.innerWidth > window.innerHeight;
      const reserve = sideways ? 12 : coarse ? window.innerHeight * 0.42 : 110;
      const availH = Math.max(110, window.innerHeight - top - padY - reserve);
      let s = Math.min(availW / Core.CFG.W, availH / Core.CFG.H);
      const sd = s * dpr;
      if (sd >= 1 && Math.floor(sd) / sd > 0.84) s = Math.floor(sd) / dpr;
      canvas.style.width = (Core.CFG.W * s) + 'px';   // height follows the 3:1 canvas
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(screen.parentElement);
    window.addEventListener('resize', fit);

    // ------------------------------------------------------------ loop
    const STEP = 1 / 120;
    let last = performance.now(), acc = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (window.RRManual) { requestAnimationFrame(frame); return; }   // a recorder steps the game itself
      pollPad();
      if (!game.paused && !window.RRHold) {
        acc += dt;
        const inp = { jump: jumpHeld(), duck: duckHeld(), jumpPressed: false, flipPressed: 0 };
        let ran = false;
        while (acc >= STEP) {
          inp.jumpPressed = edge && !ran;
          inp.flipPressed = ran ? 0 : flipEdge;
          game.update(STEP, inp);
          ran = true; acc -= STEP;
        }
        if (ran) { edge = false; flipEdge = 0; }
      }
      for (const e of game.events) handle(e);
      game.events.length = 0;
      const c = game.car, live = !game.paused && (game.state === 'play' || game.state === 'intro' || game.state === 'title');
      audio.setThrust(live ? (c.hover ? 0.85 : Math.min(1, c.burst)) : 0);
      audio.setWhine(game.speed / Core.CFG.SPEED_MAX, live && game.state !== 'title' && c.onGround && game.speed > 1);
      if (view !== '2d' && r3d && screen.classList.contains('is3d')) r3d.draw(game, game.paused ? 0 : dt);
      else r2d.draw(game, game.paused ? 0 : dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ best: game.best, palette, muted: audio.muted, musicOn: audio.musicOn, view }));
    if (CONF.view && VIEWS.includes(CONF.view)) view = CONF.view;
    if (prev.view && VIEWS.includes(prev.view)) view = prev.view;
    if (view !== '2d') setView(view);
    window.RR = Object.assign(window.RR || {}, { game, r2d, audio, store, setView, actions });
    Object.defineProperty(window.RR, 'r3d', { get: () => r3d, configurable: true });
    Object.defineProperty(window.RR, 'view', { get: () => view, configurable: true });
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
