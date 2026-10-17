/* Roadster Run: the simulation. No drawing here, so the 2D and 3D views
   can both read the same world. Units are logical pixels and seconds;
   y is height above the road. */
(function (global) {
  'use strict';
  const A = global.RRArt;

  const CFG = {
    W: 600, H: 200, GROUND: 170, CAR_X: 40,
    SPEED0: 360, SPEED_MAX: 800, ACCEL: 3.4,       // px/s, px/s^2 (the dino game's 6 -> 13 px/frame)
    G: 3000, JUMP_V: 700, CUT_V: 300, MIN_JUMP_H: 18, FASTFALL: 3,
    HOVER_FALL: 40, AIR_DRAIN: 0.55, AIR_REGEN: 0.1,
    STUNT_T: 0.42, STUNT_MIN: 0.3, STUNT_AIR: 0.1, STUNT_SLOP: 0.5,   // a flip takes 0.3 to 0.42 s and 10% air; land within 0.5 rad of level
    SCORE_K: 0.025, GAP_COEF: 0.6,
    NIGHT_EVERY: 700, NIGHT_LEN: 12, NIGHT_FADE: 1.2,
    RAMP_FIRST: 550, RAMP_GAP: [650, 1000],
    CANYON_FIRST: 1200, CANYON_EVERY: 1600, CANYON_T: 1.25,
    FLY_H: [2, 12, 28],
    MPH0: 60, MPH_MAX: 233,
  };

  // Obstacle catalogue. minGap and the gap formula follow the original dino game.
  const TYPES = {
    cone:    { sprite: 'cone', minScore: 0, group: 3, multiSpeed: 0, spacing: 3, minGap: 110, weight: 3 },
    cactusS: { sprite: 'cactusS', minScore: 0, group: 3, multiSpeed: 0, spacing: 1, minGap: 120, weight: 2.5 },
    barrier: { sprite: 'barrier0', anim: ['barrier0', 'barrier1'], fps: 2.5, minScore: 60, group: 2, multiSpeed: 7, spacing: 2, minGap: 130, weight: 2 },
    cactusL: { sprite: 'cactusL', minScore: 140, group: 2, multiSpeed: 7, spacing: 2, minGap: 130, weight: 2 },
    sedan:   { sprite: 'sedan', minScore: 260, minGap: 150, weight: 1.5, parked: true },
    cab:     { sprite: 'cab', minScore: 260, minGap: 150, weight: 1.5, parked: true },
    tumble:  { sprite: 'tumble', minScore: 220, minGap: 170, weight: 1.1, roll: true },
    bird:    { sprite: 'bird0', anim: ['bird0', 'bird1'], fps: 6, minScore: 300, minSpeed: 460, flyer: true, minGap: 160, weight: 1.4 },
    drone:   { sprite: 'drone0', anim: ['drone0', 'drone1'], fps: 16, minScore: 420, minSpeed: 460, flyer: true, minGap: 160, weight: 1.2, bob: true },
    suv:     { sprite: 'suv', minScore: 480, minGap: 160, weight: 1.2, parked: true },
    wedge:   { sprite: 'wedge', minScore: 620, minGap: 170, weight: 1.2, parked: true },
    semi:    { sprite: 'semi', minScore: 850, minGap: 180, weight: 0.8, parked: true },
    row:     { minScore: 1000, minGap: 220, weight: 0.9, row: true },
  };

  function rng32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  function maskHit(ax, ay, am, bx, by, bm) {
    const x0 = Math.max(ax, bx), x1 = Math.min(ax + am.w, bx + bm.w);
    const y0 = Math.max(ay, by), y1 = Math.min(ay + am.h, by + bm.h);
    if (x0 >= x1 || y0 >= y1) return false;
    for (let y = y0; y < y1; y++) {
      const ra = (y - ay) * am.w - ax, rb = (y - by) * bm.w - bx;
      for (let x = x0; x < x1; x++) if (am.m[ra + x] && bm.m[rb + x]) return true;
    }
    return false;
  }
  const stuntKind = f => (f === 'side' || f === 'front' || f === 'back' ? f : f > 0 ? 'back' : 'front');
  const boxHit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  class Game {
    constructor(catalogue, seed) {
      this.cat = catalogue;
      this.masks = {};
      Object.keys(catalogue).forEach(k => { this.masks[k] = A.maskOf(catalogue[k]); });
      this.seed = (seed >>> 0) || ((Math.random() * 4294967296) >>> 0);
      this.best = 0;
      this.reset();
      this.state = 'title';
    }

    reset() {
      this.rand = rng32(this.seed++);
      this.t = 0; this.stateT = 0; this.playT = 0;
      this.distance = 0; this.speed = 0; this.bonus = 0; this.score = 0;
      this.car = {
        y: 0, vy: 0, jumpY0: 0, onGround: true, duck: false, hover: false, held: false, buffer: 0,
        air: 1, rot: 0, roll: 0, flip: null, onRamp: null, spoiler: 0, wheel: 0, frame: 0, sprite: 'car0',
        burst: 0, wreck: false, zeroTo60: 0, stunt: null, airFlips: 0, flipBuf: null, airT: Infinity,
      };
      this.obstacles = []; this.items = []; this.decor = []; this.features = [];
      this.tail = CFG.W + CFG.SPEED0 * 1.0;
      this.lastType = ''; this.dup = 0;
      this.nextRamp = CFG.RAMP_FIRST; this.nextCanyon = CFG.CANYON_FIRST; this.pending = null;
      this.nextNight = CFG.NIGHT_EVERY; this.night = false; this.nightT = 0; this.nightMix = 0; this.nights = 0;
      this.flashT = 0; this.newBest = false;
      this.events = []; this.messages = [];
      this.stats = { flips: 0, canyons: 0, close: 0, canisters: 0 };
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data)); }
    setState(s) { this.state = s; this.stateT = 0; }
    get mph() { return Math.round(CFG.MPH0 + (this.speed - CFG.SPEED0) / (CFG.SPEED_MAX - CFG.SPEED0) * (CFG.MPH_MAX - CFG.MPH0)); }

    start() {
      const best = this.best, nights = this.nights;
      this.reset();
      this.best = best; this.nights = nights;
      this.setState('intro');
      this.emit('start');
    }

    // inp: { jump: held, jumpPressed: edge, duck: held, flipPressed: 'back', 'front', 'side' or 0 }
    // (the numbers 1 and -1 also work for a backflip and a frontflip)
    update(dt, inp) {
      this.t += dt; this.stateT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.messages.forEach(m => { m.t += dt; });
      this.messages = this.messages.filter(m => m.t < 1.6);
      switch (this.state) {
        case 'title': this.idle(dt); if (inp.jumpPressed || inp.flipPressed) this.start(); break;
        case 'intro': this.intro(dt); break;
        case 'play': this.play(dt, inp); break;
        case 'crashed': if (this.stateT > 0.75) this.setState('over'); break;
        case 'falling': this.falling(dt); break;
        case 'over': if ((inp.jumpPressed || inp.flipPressed) && this.stateT > 0.1) this.start(); break;
      }
      const target = this.night ? 1 : 0;
      this.nightMix += clamp(target - this.nightMix, -dt / CFG.NIGHT_FADE, dt / CFG.NIGHT_FADE);
    }

    idle(dt) {
      const c = this.car;
      c.burst = Math.max(0, c.burst - dt * 2);
      if (this.rand() < dt * 0.6) c.burst = 0.35;     // the parked car vents a little cold gas
    }

    // Standing lift-off, then 0-60 in 0.81 s, like the demo.
    intro(dt) {
      const c = this.car, s = this.stateT;
      if (s < 0.55) { c.y = 18 * (1 - Math.pow(1 - s / 0.55, 3)); c.burst = 1; c.onGround = false; }
      else if (s < 0.85) { c.y = 18 * (1 - Math.pow((s - 0.55) / 0.3, 2)); c.burst = 0.5; }
      else {
        if (!c.onGround) { c.y = 0; c.onGround = true; this.emit('land', { v: 300 }); }
        const k = Math.min(1, (s - 0.85) / 0.81);
        this.speed = CFG.SPEED0 * k; c.zeroTo60 = k;
      }
      c.spoiler = clamp(c.spoiler + (c.onGround ? -dt * 4 : dt * 5), 0, 1);
      c.burst = Math.max(0, c.burst - dt);
      this.advance(dt);
      this.pickSprite();
      if (s >= 0.85 + 0.81) { this.speed = CFG.SPEED0; this.setState('play'); this.emit('go'); }
    }

    play(dt, inp) {
      this.playT += dt;
      this.speed = Math.min(CFG.SPEED_MAX, this.speed + CFG.ACCEL * dt);
      this.advance(dt);
      this.spawn();
      this.updateCar(dt, inp);
      if (this.state !== 'play') return;
      this.collide();
      if (this.state !== 'play') return;
      this.updateScore(dt);
    }

    falling(dt) {
      const c = this.car;
      this.speed *= Math.max(0, 1 - dt * 1.8);
      this.advance(dt);
      c.vy -= CFG.G * 0.6 * dt; c.y += c.vy * dt; c.rot += dt * 2.4;
      if (this.stateT > 1.15 && !this.boomed) { this.boomed = true; this.emit('boom'); this.finish(); this.setState('over'); }
    }

    advance(dt) {
      const dx = this.speed * dt;
      this.distance += dx;
      this.tail -= dx;
      for (const o of this.obstacles) {
        const ox = dx + o.vx * dt;
        o.x -= ox; o.t += dt;
        if (o.type.anim) o.frame = Math.floor(o.t * o.type.fps + o.phase) % o.type.anim.length;
        if (o.type.roll) {
          o.vy -= 900 * dt; o.y += o.vy * dt;
          if (o.y <= 0) { o.y = 0; o.vy = 120 + this.rand() * 90; }
          o.rot -= ox / 7;
        }
        if (o.type.bob) o.y = o.baseY + Math.sin(o.t * 5 + o.phase) * 2;
      }
      for (const f of this.features) f.x -= dx;
      for (const d of this.decor) d.x -= dx;
      for (const it of this.items) { it.x -= dx; it.t += dt; }
      this.obstacles = this.obstacles.filter(o => o.x + o.w > -80);
      this.features = this.features.filter(f => f.x + f.w > -80);
      this.decor = this.decor.filter(d => d.x + 100 > 0);
      this.items = this.items.filter(it => it.x + it.w > -20 && !(it.taken && it.t > 2));
      const c = this.car;
      c.wheel += dt * (8 + this.speed / 30) * (c.onGround ? 1 : 0.5);
      c.frame = Math.floor(c.wheel) % 4;
    }

    groundAt(x) {
      for (const f of this.features) {
        if (f.kind === 'canyon' && x > f.x + 8 && x < f.x + f.w - 8) return -Infinity;
        if (f.kind === 'ramp' && x >= f.x && x <= f.x + f.run) return f.rise * (x - f.x) / f.run;
      }
      return 0;
    }

    updateCar(dt, inp) {
      const c = this.car, G = CFG.G;
      const xc = CFG.CAR_X + A.CAR_W / 2;
      c.burst = Math.max(0, c.burst - dt * 3);
      c.buffer = Math.max(0, c.buffer - dt);
      if (inp.jumpPressed) c.buffer = 0.13;

      if (c.flip) {
        c.vy -= G * dt; c.y += c.vy * dt;
        const k = Math.min(1, (this.t - c.flip.t0) / c.flip.T);
        c.rot = -Math.PI * 2 * ease(k);
        c.burst = Math.max(c.burst, 0.45);
        c.spoiler = 1; c.hover = false; c.duck = false;
        if (c.y <= 0 && c.vy < 0) {
          c.y = 0; c.vy = 0; c.rot = 0; c.flip = null; c.onGround = true;
          this.stats.flips++;
          this.addBonus(100, 'BACKFLIP!');
          this.emit('flipLand'); this.emit('land', { v: 700 });
        }
        this.pickSprite();
        return;
      }

      // a flip press waits a moment, so a press during a flip chains the next one
      if (inp.flipPressed) c.flipBuf = { kind: stuntKind(inp.flipPressed), t: 0.2 };
      if (c.flipBuf && (c.flipBuf.t -= dt) <= 0) c.flipBuf = null;
      const hasAir = c.air >= CFG.STUNT_AIR - 1e-6;
      if (inp.flipPressed && !hasAir) {
        this.emit('airEmpty');
        if (!this.messages.some(m => m.text === 'NO AIR')) this.messages.push({ text: 'NO AIR', sub: '', t: 0, small: true });
      }
      const wantFlip = !!c.flipBuf && !c.stunt && hasAir;

      // jump (from the road or from the ramp deck). A flip from the road jumps first.
      if ((c.buffer > 0 || wantFlip) && c.onGround) {
        c.vy = CFG.JUMP_V; c.onGround = false; c.held = true; c.buffer = 0; c.burst = 1;
        c.jumpY0 = c.y; c.onRamp = null; c.rot = 0; c.airFlips = 0; c.airT = 0;
        this.emit('jump');
      }

      // stunt flips: the thrusters spin the car a full turn while it is in the air
      if (wantFlip && !c.onGround) {
        // a flip after a short hop gets the lift of a full jump: it lands when a full jump would,
        // so a quick JUMP then FLIP works
        const h = c.y - this.groundAt(xc);
        const full = 2 * CFG.JUMP_V / G - c.airT;
        if (full > CFG.STUNT_MIN * 0.8 && isFinite(h)) c.vy = Math.max(c.vy, (G * full * full / 2 - h) / full);
        // the car spins faster when it has less time before it lands, but never faster than STUNT_MIN
        const hovering = inp.jump && !inp.duck && c.air - CFG.STUNT_AIR > 0.05;
        const rem = hovering || !isFinite(h) ? Infinity : (c.vy + Math.sqrt(Math.max(0, c.vy * c.vy + 2 * G * h))) / G;
        c.stunt = { kind: c.flipBuf.kind, t: 0, T: clamp(rem * 0.95, CFG.STUNT_MIN, CFG.STUNT_T) }; c.flipBuf = null;
        c.air = Math.max(0, c.air - CFG.STUNT_AIR);
        this.emit('stunt', { kind: c.stunt.kind, dir: c.stunt.kind === 'front' ? -1 : 1 });
      }
      if (c.stunt) {
        c.stunt.t += dt;
        const k = Math.min(1, c.stunt.t / c.stunt.T), turn = Math.PI * 2 * ease(k);
        // backflips and frontflips pitch the car; a sideflip rolls it over its long axis
        if (c.stunt.kind === 'side') c.roll = turn;
        else c.rot = c.stunt.kind === 'front' ? turn : -turn;
        c.burst = Math.max(c.burst, 0.5);
        if (k >= 1) this.finishStunt();
      }
      if (!inp.jump) c.held = false;
      if (!c.held && !c.stunt && !c.onGround && c.vy > CFG.CUT_V && c.y - c.jumpY0 >= CFG.MIN_JUMP_H) c.vy = CFG.CUT_V;

      // hold past the top of a jump to hover on the cold-gas thrusters
      const wasHover = c.hover;
      c.hover = !c.onGround && inp.jump && !inp.duck && c.vy <= 60 && c.air > 0;
      if (c.hover) {
        c.vy += (-CFG.HOVER_FALL - c.vy) * Math.min(1, dt * 10);
        c.air = Math.max(0, c.air - CFG.AIR_DRAIN * dt);
        if (c.air === 0) this.emit('airEmpty');
      } else if (!c.onGround) {
        c.vy -= G * (inp.duck ? CFG.FASTFALL : 1) * dt;
      }
      if (c.hover !== wasHover) this.emit('hover', { on: c.hover });
      if (!c.onGround) { c.y += c.vy * dt; c.airT += dt; }

      const gnd = this.groundAt(xc);
      if (gnd === -Infinity) {
        c.onGround = false;
        if (c.y < -6) {
          if (this.god) { c.y = 30; c.vy = 300; } else { this.startFall(); return; }
        }
        if (c.vy === 0) c.vy = -1;
      } else if (c.y <= gnd + 0.01) {
        const wasAir = !c.onGround;
        if (wasAir && c.stunt) {
          // a flip that is nearly done still counts, a flip that has barely started gives nothing,
          // and anything in between lands on the roof
          const a = c.stunt.kind === 'side' ? Math.abs(c.roll) : Math.abs(c.rot);
          if (a > Math.PI * 2 - CFG.STUNT_SLOP) this.finishStunt();
          else if (a < CFG.STUNT_SLOP || this.god) { c.stunt = null; c.rot = 0; c.roll = 0; }
          else {
            const side = c.stunt.kind === 'side';
            c.y = gnd; c.vy = 0; c.stunt = null; c.rot = side ? 0 : Math.PI; c.roll = side ? Math.PI : 0;
            this.crash({ kind: 'roof', hit: false }); return;
          }
        }
        if (wasAir) c.airFlips = 0;
        if (wasAir && c.vy < -200) this.emit('land', { v: -c.vy });
        c.y = gnd; c.vy = 0; c.onGround = true;
        const ramp = this.features.find(f => f.kind === 'ramp' && xc >= f.x && xc <= f.x + f.run);
        c.onRamp = ramp || null;
        c.rot = ramp ? -Math.atan2(ramp.rise, ramp.run) : 0;
      } else if (c.onGround) {
        if (c.onRamp && xc > c.onRamp.x + c.onRamp.run) {
          // off the end of the kicker: thrusters spin the car into a backflip
          const f = c.onRamp;
          c.onRamp = null; c.onGround = false; c.vy = f.launchV;
          const T = (c.vy + Math.sqrt(c.vy * c.vy + 2 * G * c.y)) / G;
          c.flip = { t0: this.t, T };
          this.emit('flip');
        } else {
          c.onGround = false; c.vy = Math.min(c.vy, 0); c.onRamp = null; c.rot = 0; c.airT = Infinity;
        }
      }

      this.checkCanyonClear(xc);
      c.duck = inp.duck && c.onGround && !c.onRamp;
      if (c.onGround) c.air = Math.min(1, c.air + CFG.AIR_REGEN * dt);
      c.spoiler = clamp(c.spoiler + (c.onGround ? -dt * 5 : dt * 6), 0, 1);
      this.pickSprite();
    }

    pickSprite() {
      const c = this.car;
      if (c.wreck) c.sprite = 'carWreck';
      else if (c.duck) c.sprite = 'carDuck' + c.frame;
      else if (!c.onGround || c.flip) c.sprite = c.spoiler > 0.5 ? 'carAir' + c.frame : 'carHalf';
      else c.sprite = c.spoiler > 0.4 ? 'carHalf' : 'car' + c.frame;
    }

    // Each flip in one jump is worth more: 50, then 100, then 150.
    finishStunt() {
      const c = this.car, n = ++c.airFlips;
      const name = { back: 'BACKFLIP', front: 'FRONTFLIP', side: 'SIDEFLIP' }[c.stunt.kind];
      c.stunt = null; c.rot = 0; c.roll = 0;
      this.stats.flips++;
      const combo = n === 2 ? 'DOUBLE ' : n === 3 ? 'TRIPLE ' : n > 3 ? n + 'X ' : '';
      this.addBonus(50 * n, combo + name + '!');
      this.emit('flipLand', { n, kind: name });
    }

    checkCanyonClear(xc) {
      for (const f of this.features) {
        if (f.kind === 'canyon' && !f.cleared && xc > f.x + f.w - 8) {
          f.cleared = true; this.stats.canyons++;
          this.addBonus(250, 'CANYON CLEARED!');
          this.emit('canyonClear');
        }
      }
    }

    startFall() {
      const c = this.car;
      c.onGround = false; c.hover = false; c.duck = false;
      this.setState('falling'); this.boomed = false;
      this.emit('hover', { on: false });
      this.emit('fall');
    }

    collide() {
      const c = this.car;
      const cm = this.masks[c.sprite];
      const cx = CFG.CAR_X, cy = CFG.GROUND - Math.round(c.y) - cm.h;
      const tilted = !!c.flip || !!c.stunt || Math.abs(c.rot) > 0.05 || Math.abs(c.roll) > 0.05;
      const carTop = c.y + (cm.h - cm.top), carBottom = c.y + (cm.h - 1 - cm.bottom);
      for (const o of this.obstacles) {
        if (o.hit) continue;
        const name = o.type.anim ? o.type.anim[o.frame] : o.type.sprite;
        const om = this.masks[name];
        const ox = Math.round(o.x), oy = CFG.GROUND - Math.round(o.y) - om.h;
        if (ox < cx + cm.w && ox + om.w > cx) {
          const oTop = o.y + (om.h - om.top), oBottom = o.y + (om.h - 1 - om.bottom);
          const gap = oBottom >= carTop ? oBottom - carTop : carBottom - oTop;
          o.near = Math.min(o.near === undefined ? 99 : o.near, gap);
        }
        const hit = tilted
          ? boxHit(cx + 12, cy + 5, cm.w - 24, cm.h - 9, ox + 2, oy + 2, om.w - 4, om.h - 4)
          : maskHit(cx, cy, cm, ox, oy, om);
        if (hit) { this.crash(o); return; }
        if (!o.passed && ox + om.w < cx) {
          o.passed = true;
          if (o.near !== undefined && o.near >= 0 && o.near < 6 && !o.noBonus) {
            this.stats.close++;
            this.addBonus(10, 'CLOSE CALL', true);
            this.emit('close');
          }
        }
      }
      for (const it of this.items) {
        if (it.taken) continue;
        if (boxHit(cx + 4, cy + 2, cm.w - 8, cm.h - 2, it.x, CFG.GROUND - it.y - it.h, it.w, it.h)) {
          it.taken = true; it.t = 0;
          c.air = Math.min(1, c.air + 0.5);
          this.stats.canisters++;
          this.addBonus(25, 'AIR +50%', true);
          this.emit('canister', { x: it.x, y: it.y });
        }
      }
    }

    crash(o) {
      if (this.god) { o.hit = true; return; }     // test hook: drive through everything
      const c = this.car;
      o.hit = true; c.wreck = true; c.hover = false;
      this.pickSprite();
      this.setState('crashed');
      this.emit('hover', { on: false });
      this.emit('crash', { kind: o.kind });
      this.finish();
    }

    finish() {
      this.newBest = this.score > this.best;
      if (this.newBest) this.best = this.score;
      this.emit('over', { score: this.score, best: this.best, newBest: this.newBest });
    }

    addBonus(n, text, small) {
      this.bonus += n;
      this.messages.push({ text, sub: '+' + n, t: 0, small: !!small });
    }

    updateScore(dt) {
      const s = Math.floor(this.distance * CFG.SCORE_K) + this.bonus;
      if (Math.floor(s / 100) > Math.floor(this.score / 100)) { this.emit('milestone'); this.flashT = 0.75; }
      this.score = s;
      if (s >= this.nextNight) {
        this.night = true; this.nightT = 0; this.nights++;
        this.nextNight += CFG.NIGHT_EVERY;
        this.emit('night', { on: true });
      }
      if (this.night) {
        this.nightT += dt;
        if (this.nightT > CFG.NIGHT_LEN) { this.night = false; this.emit('night', { on: false }); }
      }
      if (!this.pending) {
        if (s >= this.nextCanyon) { this.pending = 'canyon'; this.nextCanyon += CFG.CANYON_EVERY; }
        else if (s >= this.nextRamp) {
          this.pending = 'ramp';
          this.nextRamp = s + CFG.RAMP_GAP[0] + this.rand() * (CFG.RAMP_GAP[1] - CFG.RAMP_GAP[0]);
        }
      }
    }

    // ------------------------------------------------------------ spawning
    spawn() {
      if (this.tail > CFG.W) return;
      if (this.pending === 'canyon') { this.pending = null; this.spawnCanyon(); return; }
      if (this.pending === 'ramp') { this.pending = null; this.spawnRamp(); return; }
      this.spawnObstacle();
    }

    addObstacle(kind, x, y) {
      const T = TYPES[kind];
      const name = T.anim ? T.anim[0] : T.sprite;
      const m = this.masks[name];
      const o = { kind, type: T, x, y, baseY: y, w: m.w, h: m.h, t: 0, frame: 0, vx: 0, vy: 0, rot: 0, phase: this.rand() * 6 };
      if (T.roll) { o.vx = 70 + this.rand() * 60; o.vy = 120; }
      if (kind === 'bird') o.vx = this.rand() < 0.5 ? -48 : 48;
      this.obstacles.push(o);
      return o;
    }

    addItem(x, y) {
      const m = this.masks.canister0;
      this.items.push({ x, y, w: m.w, h: m.h, t: 0, taken: false });
    }

    spawnObstacle() {
      const s = this.score, v = this.speed, ppf = v / 60;
      const keys = Object.keys(TYPES).filter(k => {
        const T = TYPES[k];
        return s >= T.minScore && v >= (T.minSpeed || 0) && !(k === this.lastType && this.dup >= 2);
      });
      let total = 0; keys.forEach(k => { total += TYPES[k].weight; });
      let r = this.rand() * total, kind = keys[0];
      for (const k of keys) { r -= TYPES[k].weight; if (r <= 0) { kind = k; break; } }
      const T = TYPES[kind];
      if (kind === this.lastType) this.dup++; else { this.lastType = kind; this.dup = 1; }

      const x = CFG.W + 4;
      let width = 0, top = 0;
      if (T.row) {
        const n = 2 + (s > 1800 && this.rand() < 0.3 ? 1 : 0);
        const pool = ['sedan', 'cab', 'suv', 'wedge'];
        for (let i = 0; i < n; i++) {
          const o = this.addObstacle(pool[Math.floor(this.rand() * pool.length)], x + width, 0);
          width += o.w + 3; top = Math.max(top, o.h);
        }
        width -= 3;
      } else {
        const n = T.group && ppf > T.multiSpeed ? 1 + Math.floor(this.rand() * T.group) : 1;
        const y = T.flyer ? CFG.FLY_H[Math.floor(this.rand() * CFG.FLY_H.length)] : 0;
        for (let i = 0; i < n; i++) {
          const o = this.addObstacle(kind, x + width, y);
          width += o.w + (T.spacing || 0); top = Math.max(top, o.h + y);
        }
        width -= (T.spacing || 0);
      }
      // the dino formula, plus room to land a full jump with this longer car
      const minGap = Math.round(width * ppf + T.minGap * CFG.GAP_COEF + v * 0.2);
      this.tail = x + width + minGap + this.rand() * minGap * 0.5;
      // a floating air canister now and then rewards a high jump
      if (s > 120 && !T.flyer && this.rand() < 0.14) this.addItem(x + width / 2 - 4, top + 34);
    }

    spawnRamp() {
      const v = this.speed, x0 = CFG.W + 6, G = CFG.G;
      this.decor.push({ sprite: 'signRamp', x: x0, y: 0, w: this.masks.signRamp.w });
      const run = A.RAMP_RUN, rise = A.RAMP_RISE;
      const rx = x0 + 120;
      const launchV = 300 + 0.72 * v;
      this.features.push({ kind: 'ramp', x: rx, run, rise, w: run + 3, launchV });
      // Fill the flight path with parked cars, like the row the real car cleared.
      const clear = 42;
      const disc = launchV * launchV - 2 * G * (clear - rise);
      const t1 = (launchV - Math.sqrt(disc)) / G, t2 = (launchV + Math.sqrt(disc)) / G;
      const from = rx + run + v * Math.max(0, t1) + A.CAR_W / 2 + 8;
      const to = rx + run + v * t2 - A.CAR_W / 2 - 8;
      const lineup = ['cab', 'wedge', 'semi', 'suv', 'sedan'];
      let i = Math.floor(this.rand() * lineup.length), x = from;
      const placed = [];
      for (let n = 0; n < 5; n++, i++) {
        const k = lineup[i % lineup.length], w = this.masks[k].w;
        if (x + w > to) break;
        placed.push(this.addObstacle(k, x, 0));
        x += w + 3;
      }
      const shift = Math.max(0, ((to - from) - (x - 3 - from)) / 2);
      placed.forEach(o => { o.x += shift; o.noBonus = true; });
      this.tail = Math.max(rx + run, x + shift) + v * 0.9;
      this.emit('rampAhead');
    }

    spawnCanyon() {
      const v = this.speed, x0 = CFG.W + 6;
      this.decor.push({ sprite: 'signCanyon', x: x0, y: 0, w: this.masks.signCanyon.w });
      this.addItem(x0 + 140, 3); this.addItem(x0 + 250, 3);
      const edge = x0 + 400;
      const w = Math.round(v * CFG.CANYON_T);
      this.features.push({ kind: 'canyon', x: edge, w, cleared: false });
      this.decor.push({ sprite: 'signFar', x: edge + w + 40, y: 0, w: this.masks.signFar.w });
      this.tail = edge + w + v * 1.0;
      this.emit('canyonAhead');
    }
  }

  global.RRCore = { CFG, TYPES, Game, maskHit, boxHit };
})(window);
