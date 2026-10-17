/* Roadster Run: the 2D pixel renderer. Draws the shared simulation into a
   600x200 canvas that CSS scales up with nearest-neighbour filtering.
   opts.h makes the canvas taller; the extra rows are ground below the road.
   opts.w makes it narrower, which is a closer view: the car and the traffic look bigger. */
(function (global) {
  'use strict';
  const A = global.RRArt, C = global.RRCore.CFG;
  const W = C.W, H = C.H, GY = C.GROUND;

  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  class Render2D {
    constructor(canvas, catalogue, opts) {
      this.H = Math.max(H, (opts && opts.h) || H);
      this.W = Math.min(W, (opts && opts.w) || W);
      this.cv = canvas; canvas.width = this.W; canvas.height = this.H;
      this.ctx = canvas.getContext('2d');
      this.cat = catalogue;
      this.bufA = mk(this.W, this.H); this.bufB = mk(this.W, this.H);
      this.particles = [];
      this.shake = 0; this.camY = 0; this.time = 0; this.flash = 0;
      this.touch = false;
      this.dither = [];
      for (let l = 0; l <= 16; l++) {
        const p = mk(4, 4), x = p.getContext('2d'); x.fillStyle = '#000';
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (BAYER[j][i] < l) x.fillRect(i, j, 1, 1);
        this.dither.push(p);
      }
      this.setPalette(0);
    }

    setPalette(i) {
      this.pal = A.PALETTES[i];
      this.sets = [this.makeSet(this.pal.day, false), this.makeSet(this.pal.night, true)];
    }

    makeSet(colors, night) {
      const set = { colors, night, spr: A.bake(this.cat, colors), font: {} };
      ['ink', 'mid', 'light', 'red', 'glow', 'cone', 'bg', 'star', 'hud', 'hudDim'].forEach(k => { set.font[k] = A.fontAtlas(colors[k]); });
      set.sky = this.makeSky(colors);
      set.far = this.makeFar(colors);
      return set;
    }

    // Sky with a dithered band toward the horizon colour.
    makeSky(c) {
      const cv = mk(W, GY + 40), x = cv.getContext('2d');
      x.fillStyle = c.bg; x.fillRect(0, 0, W, cv.height);
      if (c.horizon !== c.bg) {
        x.fillStyle = c.horizon;
        const top = 40, bot = GY - 10;
        for (let y = top; y < cv.height; y++) {
          const f = Math.min(1, (y - top) / (bot - top)) * 16;
          for (let i = 0; i < W; i++) if (BAYER[y & 3][i & 3] < f) x.fillRect(i, y, 1, 1);
        }
      }
      return cv;
    }

    // Distant mesas, rocket test stands and a water tower, tiled every 1200 px.
    makeFar(c) {
      const TW = 1200, TH = 90, cv = mk(TW, TH), x = cv.getContext('2d');
      const hs = new Array(TW).fill(0);
      let i = 0, k = 7;
      while (i < TW) {
        const wid = 60 + Math.floor(hash(k++) * 160), top = 10 + Math.floor(hash(k++) * 34);
        const flat = hash(k++) < 0.7;
        for (let j = 0; j < wid && i + j < TW; j++) {
          const e = Math.min(j, wid - j);
          const h = flat ? Math.min(top, e * 1.6) : Math.min(top * 0.6, e * 0.5);
          hs[i + j] = Math.max(hs[i + j], Math.round(h));
        }
        i += Math.floor(wid * (0.55 + hash(k++) * 0.6));
      }
      for (let j = 0; j < 40; j++) { hs[j] = Math.round(hs[j] * j / 40 + hs[TW - 40 + j] * (1 - j / 40)); }
      x.fillStyle = c.far;
      for (let j = 0; j < TW; j++) if (hs[j] > 0) x.fillRect(j, TH - hs[j], 1, hs[j]);
      const spr = A.bake({ t: this.cat.tower, s: this.cat.towerS, w: this.cat.water }, c);
      x.drawImage(spr.t, 230, TH - spr.t.height); x.drawImage(spr.s, 262, TH - spr.s.height);
      x.drawImage(spr.w, 760, TH - spr.w.height); x.drawImage(spr.t, 1010, TH - spr.t.height);
      return cv;
    }

    // ------------------------------------------------------------ effects
    onEvent(e, game) {
      const car = this.carPos(game);
      switch (e.type) {
        case 'jump': for (let i = 0; i < 10; i++) this.puff(car, true, 1.4); break;
        case 'land': for (let i = 0; i < Math.min(12, e.v / 60); i++) this.dust(car.x + 8 + Math.random() * 44, GY - 1); break;
        case 'flip': for (let i = 0; i < 14; i++) this.puff(car, true, 1.6); break;
        case 'stunt': for (let i = 0; i < 10; i++) this.puff(car, true, 1.5); break;
        case 'crash': this.explode(car, game); break;
        case 'canister': for (let i = 0; i < 12; i++) this.spark(e.x + 4, GY - e.y - 7, 'glow', 90); break;
        case 'boom': this.shake = 0.6; for (let i = 0; i < 30; i++) this.dust(80 + Math.random() * 220, this.H - 4, true); break;
        case 'start': this.flash = 0; break;
      }
    }

    carPos(game) {
      const c = game.car;
      return { x: C.CAR_X, y: GY - c.y - A.CAR_H, cx: C.CAR_X + A.CAR_W / 2, cy: GY - c.y - A.CAR_H / 2, rot: c.rot, speed: game.speed };
    }

    puff(car, burst, scale) {
      const n = [[22, 18], [29, 18], [36, 18], [1, 13]][Math.floor(Math.random() * 4)];
      const ca = Math.cos(car.rot), sa = Math.sin(car.rot);
      const lx = n[0] - A.CAR_W / 2, ly = n[1] - A.CAR_H / 2;
      const px = car.cx + lx * ca - ly * sa, py = car.cy + lx * sa + ly * ca;
      const rear = n[0] < 5;
      const down = rear ? 0 : 1;
      this.particles.push({
        k: 'puff', x: px, y: py,
        vx: -car.speed * (0.25 + Math.random() * 0.35) + (rear ? -60 : (Math.random() - 0.5) * 40) + (-sa * 80 * down),
        vy: (burst ? 70 : 40) * (0.5 + Math.random()) * down * ca + (Math.random() - 0.5) * 20,
        age: 0, life: 0.35 + Math.random() * 0.35, r: (2 + Math.random() * 3) * (scale || 1),
      });
    }

    dust(x, y, big) {
      this.particles.push({ k: 'dust', x, y, vx: -40 - Math.random() * 80, vy: -(30 + Math.random() * (big ? 160 : 60)), age: 0, life: 0.4 + Math.random() * (big ? 0.9 : 0.3), slot: 'mid' });
    }

    spark(x, y, slot, sp) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (sp || 120);
      this.particles.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, age: 0, life: 0.3 + Math.random() * 0.4, slot });
    }

    explode(car, game) {
      this.shake = 0.45; this.flash = 0.12;
      for (let i = 0; i < 26; i++) this.spark(car.x + 50, car.y + 10, Math.random() < 0.5 ? 'glow' : 'cone', 220);
      for (let i = 0; i < 12; i++) this.puff(car, true, 1.8);
      this.particles.push({ k: 'wheel', x: car.x + 41, y: GY - 10, vx: 120, vy: -260, age: 0, life: 3, rot: 0 });
      for (let i = 0; i < 8; i++) this.particles.push({ k: 'bit', x: car.x + 30 + Math.random() * 20, y: car.y + 6, vx: -40 + Math.random() * 200, vy: -120 - Math.random() * 160, age: 0, life: 1.6, slot: Math.random() < 0.5 ? 'light' : 'ink' });
    }

    updateFx(game, dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt);
      this.flash = Math.max(0, this.flash - dt);
      const c = game.car, car = this.carPos(game);
      const live = game.state === 'play' || game.state === 'intro' || game.state === 'title';
      if (live) {
        const rate = c.hover ? 46 : c.burst > 0 ? 70 * c.burst : 0;
        let n = rate * dt; while (n > 0) { if (Math.random() < n) this.puff(car, c.burst > 0.6, c.hover ? 0.9 : 1.1); n -= 1; }
        if (c.duck && game.speed > 380 && Math.random() < dt * 30) this.spark(car.x + 6 + Math.random() * 46, GY - 1, Math.random() < 0.5 ? 'glow' : 'cone', 60);
      }
      const frozen = game.state === 'crashed' || game.state === 'over';
      for (const p of this.particles) {
        p.age += dt;
        if (p.k === 'puff') {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 3; p.vx *= 1 - dt * (frozen ? 4 : 0.6);
          if (p.y > GY - 2 && p.vy > 0) { p.y = GY - 2; p.vx -= p.vy * 0.8; p.vy = 0; }
        } else {
          p.vy += (p.k === 'wheel' ? 700 : 500) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.k === 'wheel') {
            p.rot += p.vx * dt / 4;
            if (p.y > GY - 9) { p.y = GY - 9; p.vy = -Math.abs(p.vy) * 0.45; p.vx *= 0.8; }
          } else if (p.y > GY - 1 && p.k !== 'dust') { p.y = GY - 1; p.vy = -p.vy * 0.3; p.vx *= 0.6; }
        }
      }
      this.particles = this.particles.filter(p => p.age < p.life);
      // camera follows the car up during big air
      const target = Math.max(0, game.car.y + A.CAR_H - 118);
      this.camY += (target - this.camY) * Math.min(1, dt * 8);
    }

    // ------------------------------------------------------------ drawing
    draw(game, dt) {
      this.updateFx(game, dt);
      const m = game.nightMix;
      if (m <= 0.001) this.scene(this.ctx, this.sets[0], game);
      else if (m >= 0.999) this.scene(this.ctx, this.sets[1], game);
      else {
        // dusk: blend the day and night renders, like the original's slow invert
        const a = this.bufA.getContext('2d'), b = this.bufB.getContext('2d');
        this.scene(a, this.sets[0], game);
        this.scene(b, this.sets[1], game);
        this.ctx.drawImage(this.bufA, 0, 0);
        this.ctx.globalAlpha = m * m * (3 - 2 * m);
        this.ctx.drawImage(this.bufB, 0, 0);
        this.ctx.globalAlpha = 1;
      }
    }

    scene(x, S, game) {
      const col = S.colors, spr = S.spr;
      x.imageSmoothingEnabled = false;
      const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 8 * this.shake / 0.45) : 0;
      const sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * this.shake / 0.45) : 0;
      const cam = Math.round(this.camY);
      const d = game.distance;

      // sky, stars, moon
      x.drawImage(S.sky, 0, Math.round(cam * 0.2) - 20, W, S.sky.height);
      x.fillStyle = col.bg; x.fillRect(0, 0, W, Math.max(0, Math.round(cam * 0.2) - 20));
      const starry = S.night || this.pal.alwaysStars;
      if (starry) {
        const nightSlot = S.night ? this.pal.nightSky : 'star';
        for (let i = 0; i < 46; i++) {
          const px = Math.floor(((hash(i * 3 + 1) * (W + 40)) - d * 0.02) % (W + 40) + W + 40) % (W + 40) - 20;
          const py = 6 + Math.floor(hash(i * 3 + 2) * 96) + Math.round(cam * 0.1);
          const big = hash(i * 3 + 3) < 0.25;
          if (big && Math.sin(this.time * 2 + i) > -0.6) x.drawImage(spr.star0, px, py);
          else { x.fillStyle = col[nightSlot] || col.star; x.fillRect(px, py, 1, 1); }
        }
        if (S.night) {
          const mx = W - 120 - ((d * 0.012) % (W + 60)) + 60;
          x.drawImage(spr['moon' + ((game.nights + 3) % 8)], Math.round(mx > -30 ? mx : mx + W + 60), 18 + Math.round(cam * 0.1));
          if (game.night && game.nightT > 1.5 && game.nightT < 11) this.starman(x, spr, game.nightT);
        }
      }

      // a launch now and then behind the mesas
      this.rocket(x, spr, col, d, cam);

      // far layer
      const farY = GY - 86 + Math.round(cam * 0.35) + sy;
      const fo = Math.floor(d * 0.06) % 1200;
      x.drawImage(S.far, -fo + sx, farY); x.drawImage(S.far, 1200 - fo + sx, farY);

      // clouds
      for (let i = 0; i < 7; i++) {
        const span = W + 120;
        const cx = Math.floor((hash(i * 7 + 11) * span - d * 0.2) % span + span) % span - 60;
        const cy = 22 + Math.floor(hash(i * 7 + 12) * 60) + Math.round(cam * 0.5);
        x.drawImage(spr['cloud' + (i % 2)], cx + sx, cy + sy);
      }

      // power poles and sagging wires
      const pd = 260, po = (d * 0.55) % pd, py = GY - 44 + Math.round(cam * 0.7) + sy;
      x.fillStyle = col.ink;
      const poles = [];
      for (let k = -1; k < W / pd + 2; k++) poles.push(Math.round(k * pd - po));
      for (let k = 0; k < poles.length - 1; k++) {
        for (const off of [2, 12]) {
          for (let i = 0; i <= pd; i += 2) {
            const t = i / pd, sag = Math.round(Math.sin(t * Math.PI) * 9);
            const wx = poles[k] + off + i;
            if (wx >= 0 && wx < W) x.fillRect(wx + sx, py + 3 + sag, 2, 1);
          }
        }
      }
      poles.forEach(p => x.drawImage(spr.pole, p + sx, py));

      // the road
      const gy = GY + cam + sy;
      this.road(x, S, game, gy, sx, cam);

      // set pieces, signs, items
      for (const f of game.features) if (f.kind === 'ramp') x.drawImage(spr.ramp, Math.round(f.x) + sx, gy - spr.ramp.height);
      for (const dc of game.decor) x.drawImage(spr[dc.sprite], Math.round(dc.x) + sx, gy - spr[dc.sprite].height);
      for (const it of game.items) {
        if (it.taken) continue;
        const bob = Math.round(Math.sin(it.t * 4) * 2);
        x.drawImage(spr[Math.floor(it.t * 4) % 2 ? 'canister1' : 'canister0'], Math.round(it.x) + sx, gy - it.y - it.h + bob);
      }

      // traffic and hazards
      for (const o of game.obstacles) {
        const name = o.type.anim ? o.type.anim[o.frame] : o.type.sprite;
        const im = spr[name];
        const ox = Math.round(o.x) + sx, oy = gy - Math.round(o.y) - im.height;
        if (o.type.roll) this.rot(x, im, ox + im.width / 2, oy + im.height / 2, Math.round(o.rot * 4) / 4);
        else x.drawImage(im, ox, oy);
      }

      // particles behind the car
      this.drawParticles(x, S, sx, cam + sy, 'puff');

      // car + shadow
      const c = game.car;
      if (!c.onGround && game.state !== 'falling' && this.groundUnder(game)) {
        const w = Math.max(10, Math.round(44 / (1 + c.y / 50)));
        x.fillStyle = col.mid; x.fillRect(C.CAR_X + 29 - w / 2 + sx, gy, w, 1);
      }
      const cim = spr[c.sprite];
      const cyTop = gy - Math.round(c.y) - A.CAR_H;
      if (c.rot || c.roll) {
        // a sideflip rolls the car over its long axis: seen from the side it squashes, turns over and comes back
        const cr = Math.cos(c.roll || 0), sy = c.roll ? (cr < 0 ? -1 : 1) * Math.max(0.2, Math.abs(cr)) : 1;
        this.rot(x, cim, C.CAR_X + A.CAR_W / 2 + sx, cyTop + A.CAR_H / 2, c.rot || 0, sy);
      } else x.drawImage(cim, C.CAR_X + sx, cyTop);

      this.drawParticles(x, S, sx, cam + sy, 'front');
      this.speedLines(x, col, game);

      if (this.flash > 0) { x.fillStyle = col.light; x.fillRect(0, 0, W, this.H); }
      this.hud(x, S, game);
    }

    groundUnder(game) {
      const xc = C.CAR_X + A.CAR_W / 2;
      return !game.features.some(f => f.kind === 'canyon' && xc > f.x && xc < f.x + f.w);
    }

    road(x, S, game, gy, sx, cam) {
      const col = S.colors, d = game.distance;
      // asphalt band, lane dashes, shoulder and dirt
      x.fillStyle = col.road; x.fillRect(0, gy + 1, W, 16);
      x.fillStyle = col.ink; x.fillRect(0, gy, W, 1);
      const dash = 40, off = d % dash;
      x.fillStyle = col.roadLine;
      for (let k = -1; k < W / dash + 1; k++) x.fillRect(Math.round(k * dash - off) + sx, gy + 8, 16, 2);
      x.fillStyle = col.mid; x.fillRect(0, gy + 17, W, 1);
      x.fillStyle = col.dirt; x.fillRect(0, gy + 18, W, this.H - gy + cam);
      for (let k = 0; k < 60; k++) {
        const span = W + 20;
        const px = Math.floor((hash(k * 5 + 1) * span - d) % span + span) % span - 10;
        const py = gy + 20 + Math.floor(hash(k * 5 + 2) * 12);
        x.fillStyle = hash(k * 5 + 3) < 0.5 ? col.ink : col.mid;
        x.fillRect(px + sx, py, hash(k * 5 + 4) < 0.3 ? 2 : 1, 1);
      }
      // a taller screen shows more ground under the road: sparse pebbles that thin out toward the bottom
      const deep = this.H - (gy + 34);
      for (let k = 0; deep > 0 && k < Math.round(deep * 0.9); k++) {
        const span = W + 20, f = hash(k * 7 + 5);
        const px = Math.floor((hash(k * 7 + 1) * span - d) % span + span) % span - 10;
        const py = gy + 34 + Math.floor(f * f * deep);
        x.fillStyle = hash(k * 7 + 3) < 0.35 ? col.ink : col.mid;
        x.fillRect(px + sx, py, hash(k * 7 + 4) < 0.25 ? 2 : 1, 1);
      }
      // canyons cut through everything
      for (const f of game.features) {
        if (f.kind !== 'canyon') continue;
        const x0 = Math.round(f.x) + sx, x1 = Math.round(f.x + f.w) + sx;
        if (x1 < 0 || x0 > W) continue;
        const bottom = this.H + cam + 10;
        // the gorge below the road, with layered rock on the far wall
        x.fillStyle = col.canyon; x.fillRect(x0, gy, x1 - x0, bottom - gy);
        x.fillStyle = col.rock;
        for (let j = 0; j < 7; j++) {
          const yy = gy + 6 + j * 4;
          const off = Math.floor(d * 0.6);
          for (let i = Math.max(x0, 0); i < Math.min(x1, W); i += 2) if (hash(Math.floor((i + off) / 5) * 13 + j) < 0.5) x.fillRect(i, yy, 2, 2);
        }
        // the river far below
        x.fillStyle = col.river; x.fillRect(x0, this.H - 6 + cam, x1 - x0, 7);
        x.fillStyle = col.light;
        for (let i = x0 + ((this.time * 40) % 14); i < x1; i += 14) x.fillRect(Math.round(i), this.H - 4 + cam, 5, 1);
        // jagged cliff faces in solid rock
        for (const [edge, dir] of [[x0, -1], [x1, 1]]) {
          for (let yy = gy; yy < bottom; yy++) {
            const j = yy - gy, bite = Math.round(hash(j * 7 + (dir > 0 ? 3 : 1)) * 3 + j * 0.25);
            const w = 6 + bite;
            x.fillStyle = col.rock; x.fillRect(dir < 0 ? edge - 1 : edge - w + 1, yy, w, 1);
            x.fillStyle = col.ink; x.fillRect(dir < 0 ? edge + w - 2 : edge - w + 1, yy, 1, 1);
          }
          x.fillStyle = col.ink; x.fillRect(dir < 0 ? edge - 1 : edge - 7, gy, 8, 1);
        }
      }
    }

    rocket(x, spr, col, d, cam) {
      const period = 26000, k = Math.floor(d / period), ph = (d % period) / period;
      if (k < 1 || ph > 0.35) return;
      const t = ph / 0.35;
      const baseX = 120 + Math.floor(hash(k * 17) * 360) - Math.floor((d % period) * 0.06);
      const alt = Math.round(Math.pow(t, 1.7) * 160);
      const rx = baseX, ry = GY - 70 - alt + Math.round(cam * 0.35);
      if (rx < -10 || rx > W || ry < -20) return;
      x.fillStyle = col.far2;
      for (let i = 0; i < Math.min(alt, 140); i += 2) {
        const w = 1 + Math.floor(i / 18) + (hash(i + k) < 0.3 ? 1 : 0);
        x.fillRect(Math.round(rx + 2 - w / 2), ry + 14 + i, w, 2);
      }
      x.drawImage(spr.rocket, rx, ry);
      x.fillStyle = Math.floor(this.time * 20) % 2 ? col.glow : col.cone;
      x.fillRect(rx + 1, ry + 13, 3, 2 + Math.floor(Math.random() * 3));
    }

    starman(x, spr, t) {
      const k = (t - 1.5) / 9.5;
      const px = Math.round(W + 20 - k * (W + 60)), py = 30 + Math.round(Math.sin(t * 1.3) * 6);
      this.rot(x, spr.starman, px, py, Math.sin(t * 0.8) * 0.5);
    }

    speedLines(x, col, game) {
      if (game.state !== 'play' || game.speed < 620) return;
      const n = Math.floor((game.speed - 600) / 40);
      x.fillStyle = col.mid;
      for (let i = 0; i < n; i++) {
        const y = 30 + Math.floor(hash(i * 31 + Math.floor(this.time * 9)) * 110);
        const len = 10 + Math.floor(hash(i * 7 + 3) * 30);
        const xx = Math.floor((hash(i * 5 + 1) * W * 2 - this.time * 1500) % (W * 2) + W * 2) % (W * 2) - len;
        x.fillRect(xx, y, len, 1);
      }
    }

    drawParticles(x, S, sx, dy, layer) {
      const col = S.colors, spr = S.spr;
      for (const p of this.particles) {
        const isPuff = p.k === 'puff';
        if ((layer === 'puff') !== isPuff) continue;
        const px = Math.round(p.x) + sx, py = Math.round(p.y) + dy;
        if (isPuff) {
          const k = p.age / p.life;
          const r = Math.max(1, Math.min(7, Math.round(p.r * (k < 0.3 ? 0.5 + k * 1.7 : 1.01 - (k - 0.3) * 0.9))));
          const im = spr['puff' + r];
          x.drawImage(im, px - (im.width >> 1), py - (im.height >> 1));
        } else if (p.k === 'wheel') {
          this.rot(x, spr.wheelBit, px, py, p.rot);
        } else {
          x.fillStyle = col[p.slot] || col.ink;
          x.fillRect(px, py, p.k === 'bit' ? 2 : 1, p.k === 'bit' ? 2 : 1);
        }
      }
    }

    // Inside a post on x.com the game sits in a frame that does not get key presses until it is clicked,
    // so it asks for a click until it has focus.
    prompt(tap, click, key) {
      if (this.touch) return tap;
      return this.embedded && !document.hasFocus() ? click : key;
    }

    rot(x, im, cx, cy, a, sy) {
      x.save(); x.translate(Math.round(cx), Math.round(cy)); x.rotate(a);
      if (sy && sy !== 1) x.scale(1, sy);
      x.drawImage(im, -Math.round(im.width / 2), -Math.round(im.height / 2));
      x.restore();
    }

    // ------------------------------------------------------------ HUD
    text(x, S, slot, s, px, py, scale, align) {
      scale = scale || 1;
      const w = A.textWidth(s, scale);
      const ox = align === 'center' ? Math.round(px - w / 2) : align === 'right' ? px - w : px;
      A.text(x, S.font[slot], s, ox, py, scale);
      return w;
    }

    outlined(x, S, slot, s, px, py, scale, align) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.text(x, S, 'bg', s, px + dx, py + dy, scale, align);
      this.text(x, S, slot, s, px, py, scale, align);
    }

    // HW is the width of the canvas the HUD is drawn on (the 3D view can be square).
    hud(x, S, game, HW) {
      const W = HW || this.cv.width;
      const c = game.car;
      const pad5 = n => String(Math.min(99999, n)).padStart(5, '0');
      // score, dino style
      if (game.state !== 'title') {
        const showScore = game.flashT <= 0 || Math.floor(game.flashT * 8) % 2 === 0;
        if (showScore) this.text(x, S, 'hud', pad5(game.score), W - 10, 8, 2, 'right');
        this.text(x, S, 'hudDim', 'HI ' + pad5(game.best), W - 10 - 62 - 8, 8, 2, 'right');
      }
      // air gauge: ten cells, one per thruster
      if (game.state !== 'title') {
        const low = c.air < 0.25 && Math.floor(this.time * 6) % 2 === 0;
        this.text(x, S, low ? 'red' : 'hud', 'AIR', 10, 9);
        for (let i = 0; i < 10; i++) {
          const f = Math.max(0, Math.min(1, c.air * 10 - i));
          const cx0 = 31 + i * 5;
          x.fillStyle = S.colors.hudDim; x.fillRect(cx0, 9, 4, 7);
          if (f > 0) { x.fillStyle = S.colors.hud; const hh = Math.max(1, Math.round(f * 7)); x.fillRect(cx0, 16 - hh, 4, hh); }
        }
        if (c.hover && Math.floor(this.time * 10) % 2) this.text(x, S, 'hudDim', 'HOVER', 84, 9);
        const mph = game.state === 'intro' ? Math.round(60 * c.zeroTo60) : game.mph;
        this.text(x, S, 'hudDim', String(Math.max(0, mph)).padStart(3, ' ') + ' MPH', 10, 20);
      }

      // pop-up messages
      // newest big message on top, small ones stacked underneath
      const bigs = game.messages.filter(m => !m.small), smalls = game.messages.filter(m => m.small).slice(-3);
      const rise = m => Math.round(Math.min(1, m.t * 3) * 8);
      const gone = m => m.t > 1.4 && Math.floor(m.t * 12) % 2;
      const big = bigs[bigs.length - 1];
      if (big && !gone(big)) {
        const y = 44 - rise(big);
        this.outlined(x, S, 'hud', big.text, W / 2, y, 2, 'center');
        this.outlined(x, S, 'hudDim', big.sub, W / 2, y + 18, 1, 'center');
      }
      smalls.forEach((m, i) => {
        if (gone(m)) return;
        this.outlined(x, S, 'hud', m.text + ' ' + m.sub, W / 2, (big ? 76 : 50) + i * 10 - rise(m), 1, 'center');
      });

      const blink = Math.floor(this.time * 2.2) % 2 === 0;
      if (game.state === 'title') {
        this.logo(x, S, W);
        this.outlined(x, S, 'hudDim', 'A FLYING CAR RUNNER', W / 2, 74, 1, 'center');
        if (blink) this.outlined(x, S, 'hud', this.prompt('TAP TO LAUNCH', 'CLICK TO LAUNCH', 'PRESS SPACE TO LAUNCH'), W / 2, 100, 1, 'center');
        if (game.best > 0) this.outlined(x, S, 'hudDim', 'HI ' + pad5(game.best), W / 2, 116, 1, 'center');
      }
      if (game.state === 'intro') {
        const k = c.zeroTo60;
        if (game.stateT < 0.85) this.outlined(x, S, 'hud', 'STANDING LIFT-OFF', W / 2, 60, 1, 'center');
        else {
          this.outlined(x, S, 'hud', '0 TO 60 MPH', W / 2, 52, 2, 'center');
          this.outlined(x, S, 'hudDim', (k >= 1 ? '0.81' : (0.81 * k).toFixed(2)) + ' S', W / 2, 72, 1, 'center');
        }
      }
      if (game.state === 'crashed' || game.state === 'over' || (game.state === 'falling' && game.stateT > 0.5)) {
        this.outlined(x, S, 'hud', 'G A M E   O V E R', W / 2, 52, 2, 'center');
        if (game.state === 'over') {
          x.drawImage(S.spr.restart, Math.round(W / 2 - S.spr.restart.width / 2), 78);
          if (game.newBest && blink) this.outlined(x, S, 'hud', 'NEW HIGH SCORE!', W / 2, 104, 1, 'center');
          else this.outlined(x, S, 'hudDim', this.prompt('TAP TO RETRY', 'CLICK TO RETRY', 'SPACE TO RETRY'), W / 2, 104, 1, 'center');
          const st = game.stats;
          const line = 'FLIPS ' + st.flips + '  CANYONS ' + st.canyons + '  CLOSE CALLS ' + st.close;
          this.outlined(x, S, 'hudDim', line, W / 2, 118, 1, 'center');
        }
      }
      if (this.notice) this.outlined(x, S, 'hud', this.notice, W / 2, 140, 1, 'center');
      if (game.paused) {
        this.outlined(x, S, 'hud', 'PAUSED', W / 2, 60, 2, 'center');
        this.outlined(x, S, 'hudDim', this.prompt('TAP TO RESUME', 'CLICK TO RESUME', 'P TO RESUME'), W / 2, 84, 1, 'center');
      }
    }

    logo(x, S, HW) {
      const t = 'ROADSTER RUN', sc = 3, w = A.textWidth(t, sc), x0 = Math.round((HW || W) / 2 - w / 2), y0 = 26;
      // drop shadow, outline, then face
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2], [3, 3], [1, 3], [3, 1]]) A.text(x, S.font.bg, t, x0 + dx, y0 + dy, sc);
      A.text(x, S.font.hudDim, t, x0 + 2, y0 + 2, sc);
      A.text(x, S.font.hud, t, x0, y0, sc);
      // speed streaks to the left of the wordmark
      x.fillStyle = S.colors.hudDim;
      [[6, 26], [12, 18], [18, 30]].forEach(([dy, len]) => x.fillRect(x0 - len - 6, y0 + dy, len, 2));
    }
  }

  global.RRRender2D = Render2D;
})(window);
