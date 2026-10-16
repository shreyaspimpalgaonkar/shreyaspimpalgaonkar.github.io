/* Roadster Run: palettes, pixel art and the bitmap font.
   Every sprite is drawn in code. Small things are ASCII grids; vehicles come
   from a tiny polygon rasterizer so their shapes can follow reference photos. */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- palettes
  // A sprite pixel names a palette slot, so one set of art recolors per palette.
  const SLOT = {
    '#': 'ink', '=': 'dark', '+': 'mid', 'o': 'light', 'r': 'red', 'g': 'glow',
    '~': 'vapor', '-': 'vaporEdge', 'x': 'cone', 'f': 'far', 'F': 'far2',
    'c': 'cloud', 'C': 'cloudEdge', 'y': 'gold', 's': 'star', 'k': 'road', 'L': 'roadLine',
  };

  const KEYS = ['bg', 'horizon', 'far', 'far2', 'cloud', 'cloudEdge', 'ink', 'dark', 'mid', 'light', 'red', 'glow',
    'vapor', 'vaporEdge', 'cone', 'gold', 'road', 'roadLine', 'dirt', 'star', 'canyon', 'river', 'rock', 'hud', 'hudDim'];

  function invert(hex) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + (0xffffff ^ n).toString(16).padStart(6, '0');
  }
  function invertAll(p) { const o = {}; KEYS.forEach(k => { o[k] = invert(p[k]); }); return o; }

  const CLASSIC = {
    bg: '#f7f7f7', horizon: '#f7f7f7', far: '#e6e6e6', far2: '#d9d9d9', cloud: '#ffffff', cloudEdge: '#d2d2d2',
    ink: '#535353', dark: '#535353', mid: '#a6a6a6', light: '#ffffff', red: '#535353', glow: '#ffffff',
    vapor: '#ffffff', vaporEdge: '#c8c8c8', cone: '#8a8a8a', gold: '#c4c4c4', road: '#f7f7f7', roadLine: '#535353',
    dirt: '#f7f7f7', star: '#f7f7f7', canyon: '#8f8f8f', river: '#535353', rock: '#b8b8b8', hud: '#535353', hudDim: '#a6a6a6',
  };
  const POCKET = (() => {
    const c0 = '#0f380f', c1 = '#306230', c2 = '#8bac0f', c3 = '#9bbc0f';
    return {
      bg: c3, horizon: c3, far: c2, far2: c2, cloud: c3, cloudEdge: c2, ink: c0, dark: c1, mid: c2, light: c3,
      red: c1, glow: c3, vapor: c3, vaporEdge: c2, cone: c1, gold: c2, road: c3, roadLine: c0, dirt: c3, star: c3,
      canyon: c1, river: c0, rock: c2, hud: c0, hudDim: c1,
    };
  })();
  const POCKET_NIGHT = (() => {
    const c0 = '#0f380f', c1 = '#306230', c2 = '#8bac0f', c3 = '#9bbc0f';
    return {
      bg: c0, horizon: c0, far: c1, far2: c1, cloud: c0, cloudEdge: c1, ink: c3, dark: c2, mid: c1, light: c0,
      red: c2, glow: c3, vapor: c0, vaporEdge: c1, cone: c2, gold: c1, road: c0, roadLine: c3, dirt: c0, star: c3,
      canyon: c1, river: c3, rock: c2, hud: c3, hudDim: c2,
    };
  })();
  const TEXAS = {
    bg: '#8fd0ef', horizon: '#f9d9a4', far: '#d8895a', far2: '#b9694a', cloud: '#ffffff', cloudEdge: '#bfe1f1',
    ink: '#2a1c1c', dark: '#38323f', mid: '#8e8fa4', light: '#fbfbf6', red: '#e8373e', glow: '#ffe066',
    vapor: '#ffffff', vaporEdge: '#c6e2f0', cone: '#ff7a1c', gold: '#d8b25c', road: '#4b4652', roadLine: '#f4d548',
    dirt: '#e5b979', star: '#ffffff', canyon: '#8a4630', river: '#3b8bd0', rock: '#b9694a', hud: '#2a1c1c', hudDim: '#6f5d5a',
  };
  const TEXAS_NIGHT = {
    bg: '#0d1330', horizon: '#3a2a55', far: '#2a2348', far2: '#3a2c5a', cloud: '#1d2448', cloudEdge: '#2e3866',
    ink: '#07060c', dark: '#1b1a28', mid: '#55597a', light: '#e8ecf7', red: '#ff3b4f', glow: '#ffe98a',
    vapor: '#e4f3ff', vaporEdge: '#79b9ff', cone: '#e0661a', gold: '#a88a4a', road: '#1d1b26', roadLine: '#b7a44a',
    dirt: '#3a3046', star: '#ffffff', canyon: '#1e1324', river: '#2c5fae', rock: '#3a2c5a', hud: '#eef0fa', hudDim: '#9096b8',
  };
  const LAUNCH = {
    bg: '#06070d', horizon: '#1b1430', far: '#131a2e', far2: '#1d2541', cloud: '#10142a', cloudEdge: '#232b4c',
    ink: '#020205', dark: '#1a1c27', mid: '#5c6380', light: '#f3f5ff', red: '#ff2e45', glow: '#fff1bf',
    vapor: '#e2f4ff', vaporEdge: '#6fc0ff', cone: '#ff8a2a', gold: '#dcb866', road: '#14161f', roadLine: '#c7cce0',
    dirt: '#0b0c13', star: '#ffffff', canyon: '#0c0a14', river: '#2a6fd1', rock: '#1d2541', hud: '#f3f5ff', hudDim: '#7f87a8',
  };
  const LAUNCH_NIGHT = Object.assign({}, LAUNCH, { bg: '#020206', horizon: '#120c22', far: '#0c1120', far2: '#141a30' });
  // Holo: cyan outlines on deep blue by day, pink neon at night.
  const HOLO = {
    bg: '#050a14', horizon: '#0c2338', far: '#0c2034', far2: '#15405f', cloud: '#081422', cloudEdge: '#1c4c6e',
    ink: '#7af5ff', dark: '#0a1727', mid: '#2f80a4', light: '#eafcff', red: '#ff3b6b', glow: '#c8ffff',
    vapor: '#d8fbff', vaporEdge: '#5fe3ff', cone: '#ff8a3d', gold: '#ffd27a', road: '#07111d', roadLine: '#5fe3ff',
    dirt: '#050b15', star: '#bff8ff', canyon: '#03070e', river: '#1ec8ff', rock: '#0f3552', hud: '#c4f9ff', hudDim: '#4b93b3',
  };
  const HOLO_NIGHT = Object.assign({}, HOLO, {
    bg: '#07040f', horizon: '#26103d', far: '#180c2c', far2: '#2c1652', cloud: '#0d0718', cloudEdge: '#3b1d5e',
    ink: '#ff6ad5', mid: '#8a46b8', glow: '#ffd3f4', vaporEdge: '#ff8fe6', roadLine: '#ff6ad5', star: '#ffd6f5',
    rock: '#2a1450', hud: '#ffd6f5', hudDim: '#a35b9c', river: '#c23bff',
  });

  const PALETTES = [
    { id: 'classic', name: 'CLASSIC', day: CLASSIC, night: invertAll(CLASSIC), nightSky: 'ink' },
    { id: 'texas', name: 'TEXAS', day: TEXAS, night: TEXAS_NIGHT, nightSky: 'star' },
    { id: 'launch', name: 'LAUNCH NIGHT', day: LAUNCH, night: LAUNCH_NIGHT, nightSky: 'star', alwaysStars: true },
    { id: 'pocket', name: 'POCKET', day: POCKET, night: POCKET_NIGHT, nightSky: 'star' },
    { id: 'holo', name: 'HOLO', day: HOLO, night: HOLO_NIGHT, nightSky: 'star', alwaysStars: true },
  ];
  // Classic night mode inverts every color, like the original dino game.
  PALETTES[0].night.star = '#f7f7f7';

  // ---------------------------------------------------------------- grid art
  function pad(rows) {
    const w = Math.max(...rows.map(r => r.length));
    return rows.map(r => r.padEnd(w, '.'));
  }

  // Minimal raster canvas of slot characters.
  class Grid {
    constructor(w, h) { this.w = w; this.h = h; this.a = new Array(w * h).fill('.'); }
    get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? '.' : this.a[y * this.w + x]; }
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = c; }
    poly(pts, c, only) {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (inside(x + 0.5, y + 0.5, pts) && (!only || only.includes(this.get(x, y)))) this.set(x, y, c);
        }
      }
      return this;
    }
    disc(cx, cy, r, c, only) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r && (!only || only.includes(this.get(x, y)))) this.set(x, y, c);
        }
      }
      return this;
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
      return this;
    }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    // Inner outline: pixels of the given slots that touch empty space become `c`.
    outline(of, c) {
      const hit = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (!of.includes(this.get(x, y))) continue;
          if (this.get(x - 1, y) === '.' || this.get(x + 1, y) === '.' || this.get(x, y - 1) === '.' || this.get(x, y + 1) === '.') hit.push([x, y]);
        }
      }
      hit.forEach(([x, y]) => this.set(x, y, c));
      return this;
    }
    // Outer outline: empty pixels that touch the given slots become `c`.
    halo(of, c) {
      const hit = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (this.get(x, y) !== '.') continue;
          if (of.includes(this.get(x - 1, y)) || of.includes(this.get(x + 1, y)) || of.includes(this.get(x, y - 1)) || of.includes(this.get(x, y + 1))) hit.push([x, y]);
        }
      }
      hit.forEach(([x, y]) => this.set(x, y, c));
      return this;
    }
    stamp(rows, ox, oy) {
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') this.set(ox + i, oy + j, r[i]); });
      return this;
    }
    rows() {
      const out = [];
      for (let y = 0; y < this.h; y++) out.push(this.a.slice(y * this.w, (y + 1) * this.w).join(''));
      return out;
    }
  }

  function inside(x, y, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }

  // Points are written as [x, height above ground]; this flips them into grid rows.
  const up = (pts, gy, dx = 0, dh = 0) => pts.map(([x, h]) => [x + dx, gy - (h + dh)]);

  function wheel(g, cx, cy, r, ang, rimSlot) {
    g.disc(cx, cy, r, '#');
    g.disc(cx, cy, r - 1.25, rimSlot || '+');
    for (let k = 0; k < 3; k++) {
      const a = ang + k * Math.PI * 2 / 3;
      g.line(cx - 0.5, cy - 0.5, cx - 0.5 + Math.cos(a) * (r - 1.6), cy - 0.5 + Math.sin(a) * (r - 1.6), '#');
    }
    g.disc(cx, cy, 0.9, '#');
  }

  // ---------------------------------------------------------------- the Roadster
  // Side profile traced from the Oct 2026 press photo: pointed nose, raked
  // windshield, long deck, big wheels. Height is exaggerated a little to read.
  const CAR_W = 58, CAR_H = 19, CAR_GY = 19;
  const CAR_BODY = [[1, 3.4], [0.5, 8], [1.4, 10.4], [9, 11.2], [16, 13.7], [24, 14.7], [30, 14.3], [37.5, 11.7],
    [45, 10.3], [51, 8], [56.6, 5.3], [56.2, 3.6], [51, 2.2], [5, 2.2]];
  const CAR_GLASS = [[12.6, 10.4], [16.9, 12.9], [24, 13.6], [29.6, 13.2], [35.6, 11], [20, 10.1]];
  const CAR_WHEELS = [[11, 4.3], [45, 4.3]];
  const CAR_R = 4.3;
  const RAMP_RUN = 64, RAMP_RISE = 24;

  function carSprite(o) {
    o = o || {};
    const g = new Grid(CAR_W, CAR_H);
    const dh = o.duck ? -4 : 0;          // suction mode: the body seals to the road
    const wd = o.air ? 1 : 0;            // suspension drops while airborne
    // wheels sit behind the body; a wreck has lost its front wheel
    CAR_WHEELS.forEach(([x, h], i) => { if (!(o.wreck && i === 1)) wheel(g, x, CAR_GY - h + wd, CAR_R, o.wheel || 0); });
    const body = new Grid(CAR_W, CAR_H);
    body.poly(up(CAR_BODY, CAR_GY, 0, dh), 'o');
    // rocker panel
    body.poly(up([[7, 3.7], [49, 3.7], [49, 2.2], [7, 2.2]], CAR_GY, 0, dh), '=', 'o');
    // wheel arches hide the top of each tire; in suction mode only the bottom peeks out
    CAR_WHEELS.forEach(([x, h]) => {
      if (o.duck) body.disc(x, CAR_GY + 0.6, 3.9, '.', 'o=');
      else body.disc(x, CAR_GY - h + 1.2, CAR_R + 0.4, '.', 'o=');
    });
    body.outline('o=', '#');
    body.poly(up(CAR_GLASS, CAR_GY, 0, dh), '=', 'o#');
    // shoulder crease
    body.line(37, CAR_GY - 7.4 - dh, 17, CAR_GY - 8.6 - dh, '+');
    // lights: red tail bar, white headlight
    body.set(1, CAR_GY - 9 - dh, 'r'); body.set(1, CAR_GY - 8 - dh, 'r'); body.set(2, CAR_GY - 10 - dh, 'r');
    body.set(55, CAR_GY - 5 - dh, 'g'); body.set(54, CAR_GY - 5 - dh, 'g');
    // cold-gas nozzles under the floor and at the tail
    if (!o.duck) [22, 29, 36].forEach(x => body.set(x, CAR_GY - 2, '#'));
    body.set(0, CAR_GY - 5 - dh, '#');
    // deployable spoiler
    const sp = o.spoiler || 0;
    if (sp > 0) {
      const lift = Math.round(sp * 3);
      body.line(0, CAR_GY - 12 - dh - lift, 10, CAR_GY - 12.4 - dh - lift, '#');
      body.line(1, CAR_GY - 13 - dh - lift, 9, CAR_GY - 13.2 - dh - lift, '#');
      for (let k = 0; k <= lift; k++) { body.set(3, CAR_GY - 11 - dh - k, '#'); body.set(7, CAR_GY - 11.3 - dh - k, '#'); }
    }
    if (o.wreck) {
      body.poly(up([[50, 1.5], [58, 1.5], [58, 9], [46.5, 9.5]], CAR_GY), '.', 'o=#+gr');
      body.outline('o=', '#');
      [[24, 12], [27, 11], [29, 12], [31, 11], [21, 11]].forEach(([x, h]) => body.set(x, CAR_GY - h, 'o'));
      body.line(47, CAR_GY - 3, 50, CAR_GY - 8, '#');
    }
    g.stamp(body.rows(), 0, 0);
    return g.rows();
  }

  // ---------------------------------------------------------------- parked traffic
  function vehicleSprite(def, ang) {
    const g = new Grid(def.w, def.h);
    def.wheels.forEach(([x, h, r]) => wheel(g, x, def.h - h, r, ang || 0, def.rim));
    const b = new Grid(def.w, def.h);
    b.poly(up(def.body, def.h), def.paint);
    def.wheels.forEach(([x, h, r]) => {
      if (def.arch === 'trap') b.poly(up([[x - r - 1.4, 0], [x - r + 0.6, h + r - 0.6], [x + r - 0.6, h + r - 0.6], [x + r + 1.4, 0]], def.h), '.', def.paint);
      else b.disc(x, def.h - h + 1.1, r + 0.5, '.', def.paint);
    });
    if (def.skirt) b.poly(up(def.skirt, def.h), '=', def.paint);
    b.outline(def.paint + '=', '#');
    if (def.glass) b.poly(up(def.glass, def.h), def.glassSlot || '=', def.paint + '#');
    (def.lines || []).forEach(([x0, h0, x1, h1, c]) => b.line(x0, def.h - h0, x1, def.h - h1, c || '#'));
    (def.dots || []).forEach(([x, h, c]) => b.set(x, def.h - h, c));
    g.stamp(b.rows(), 0, 0);
    return g.rows();
  }

  const VEHICLES = {
    // four-door fastback sedan
    sedan: {
      w: 50, h: 16, paint: '=', rim: '+', glassSlot: '+',
      body: [[1, 3.6], [0.5, 8.2], [2, 9.8], [9, 10.6], [15, 13.1], [22, 14.1], [28, 13.9], [35, 10], [45, 8.3], [49.2, 6.8], [49.5, 3.8], [47, 2.4], [3, 2.4]],
      glass: [[13, 10.7], [16.2, 12.9], [22, 13.3], [27.6, 13.1], [33.1, 9.8], [14, 9.8]],
      wheels: [[10, 4.2, 4.2], [40, 4.2, 4.2]],
      lines: [[23, 13, 23, 9.8, '+']], dots: [[48, 6, 'g'], [1, 8, 'r']],
    },
    // taller crossover
    suv: {
      w: 50, h: 19, paint: '+', rim: 'o',
      body: [[1, 3.6], [0.5, 11.4], [3, 13.6], [10, 16], [16, 17.2], [28, 17.2], [35.5, 12.1], [45, 10.2], [49.2, 8.6], [49.5, 3.8], [47, 2.4], [3, 2.4]],
      glass: [[8.2, 13.7], [12.6, 15.8], [28, 16], [33.4, 12.2], [9, 12.2]],
      wheels: [[10.5, 4.5, 4.5], [40, 4.5, 4.5]],
      lines: [[19, 16, 19, 12.2, '+'], [27, 16, 27, 12.2, '+']], dots: [[48, 8, 'g'], [1, 11, 'r'], [1, 10, 'r']],
    },
    // angular stainless wedge truck
    wedge: {
      w: 60, h: 21, paint: '+', rim: '=', arch: 'trap',
      body: [[0.5, 3.6], [0.5, 11.6], [34, 19.6], [59.4, 11.2], [59.4, 6.4], [58, 3.4], [54, 2.6], [3, 2.6]],
      glass: [[23.5, 15.6], [34, 18.2], [44.5, 14.7], [24, 14.7]],
      wheels: [[11.5, 5.2, 5.2], [47.5, 5.2, 5.2]],
      lines: [[0.5, 11.6, 34, 19.6, '#'], [34, 19.6, 59.4, 11.2, '#'], [24, 14.7, 24, 3.4, '=']],
      dots: [[58, 10, 'g'], [57, 10, 'g'], [55, 11, 'g'], [1, 10, 'r'], [1, 9, 'r']],
    },
    // two-door robotaxi teardrop
    cab: {
      w: 40, h: 15, paint: 'y', rim: '+',
      body: [[1, 3.6], [0.5, 8.3], [3, 10.8], [10, 13.4], [18, 13.8], [25, 12.4], [32, 9.1], [37.8, 7.4], [39.3, 4.4], [37.5, 2.4], [3, 2.4]],
      glass: [[6.5, 10.9], [11, 12.6], [18, 12.9], [24, 11.5], [29.2, 8.9], [7, 8.9]],
      wheels: [[8.5, 4, 4], [31.5, 4, 4]],
      dots: [[38, 7, 'g'], [1, 8, 'r']],
    },
    // electric semi tractor
    semi: {
      w: 48, h: 34, paint: 'o', rim: '+',
      body: [[1, 4], [1, 28], [4, 32.5], [10, 33.6], [21, 33.6], [27, 32], [33, 25], [40, 17.5], [45.5, 14.2], [47.2, 11.5], [47.2, 5], [45.6, 2.8], [40, 2.6], [3, 2.6]],
      glass: [[25, 29.4], [27.4, 29], [31.6, 24.4], [35.2, 20.6], [25, 20.6]],
      wheels: [[8, 5, 5], [19, 5, 5], [39.5, 5, 5]],
      lines: [[23.5, 30, 23.5, 9, '+'], [2, 9, 46, 9, '+']],
      dots: [[46, 12, 'g'], [46, 11, 'g'], [45, 12, 'g'], [1, 9, 'r'], [1, 10, 'r']],
    },
  };

  // ---------------------------------------------------------------- small ASCII art
  const ART = {
    cone: [
      '.....#.....',
      '....#x#....',
      '....#x#....',
      '...#ooo#...',
      '...#ooo#...',
      '...#xxx#...',
      '..#xxxxx#..',
      '..#ooooo#..',
      '..#ooooo#..',
      '.#xxxxxxx#.',
      '###########',
      '###########',
    ],
    barrier0: [
      '...gg................gg...',
      '...##................##...',
      '##########################',
      '#ooxxooxxooxxooxxooxxooxx#',
      '#oxxooxxooxxooxxooxxooxxo#',
      '#xxooxxooxxooxxooxxooxxoo#',
      '##########################',
      '..#...#............#...#..',
      '..#...#............#...#..',
      '.#.....#..........#.....#.',
      '.#.....#..........#.....#.',
      '#.......#........#.......#',
      '#.......#........#.......#',
      '##.....###......###.....##',
    ],
    cactusS: [
      '....###....',
      '...#####...',
      '...##+##...',
      '...#####.#.',
      '.#.##+##.##',
      '##.#####.##',
      '##.##+##.##',
      '##.#####.##',
      '##.##+#####',
      '##.#######.',
      '#########..',
      '.########..',
      '...#####...',
      '...##+##...',
      '...#####...',
      '...##+##...',
      '...#####...',
      '...#####...',
      '...#####...',
      '...#####...',
    ],
    cactusL: [
      '.......###.......',
      '......#####......',
      '......##+##......',
      '......#####......',
      '......##+##..##..',
      '.##...#####.####.',
      '####..##+##.####.',
      '####..#####.####.',
      '####..##+##.####.',
      '####..#####.####.',
      '####..##+##.####.',
      '####..#####.####.',
      '####..##+##.####.',
      '#####.##########.',
      '.###########+###.',
      '..#########.###..',
      '......#####......',
      '......##+##......',
      '......#####......',
      '......##+##......',
      '......#####......',
      '......##+##......',
      '......#####......',
      '......#####......',
      '......#####......',
      '......#####......',
      '......#####......',
      '......#####......',
    ],
    tumble: [
      '....#####.....',
      '..##.#..###...',
      '.#..#.##..##..',
      '.#.#..#.#.#.#.',
      '#.#.##.#..#..#',
      '#..#..#.##.#.#',
      '#.#.#.#...#..#',
      '#..#.#.#.#.#.#',
      '#.#..##.#..#.#',
      '.#.#.#..#.#.#.',
      '.##.#.##.#.##.',
      '..##..#.#.##..',
      '....######....',
    ],
    bird0: [
      '......##.........',
      '......###........',
      '.......###.......',
      '.......####......',
      '...##..#####.....',
      '.#####.######....',
      '#=#############..',
      '...##########.##.',
      '.........####..##',
      '..........##.....',
      '.................',
      '.................',
    ],
    bird1: [
      '.................',
      '.................',
      '.................',
      '...##............',
      '.#####...........',
      '#=############...',
      '...############..',
      '.......#####.###.',
      '.......####...###',
      '......###........',
      '......##.........',
      '.....##..........',
    ],
    drone0: [
      '#########.....#########',
      '....#.............#....',
      '...###...........###...',
      '...#################...',
      '....#+++++g+++++++#....',
      '.....#############.....',
      '......#..#...#..#......',
      '.....##.........##.....',
    ],
    drone1: [
      '...###.............###.',
      '....#.............#....',
      '...###...........###...',
      '...#################...',
      '....#+++++r+++++++#....',
      '.....#############.....',
      '......#..#...#..#......',
      '.....##.........##.....',
    ],
    canister0: [
      '...###...',
      '...#o#...',
      '..#####..',
      '.#ooooo#.',
      '#oo#ooo+#',
      '#o#oooo+#',
      '#=======#',
      '#oo#ooo+#',
      '#o#oooo+#',
      '#=======#',
      '#oo#ooo+#',
      '#ooooooo#',
      '.#ooooo#.',
      '..#####..',
    ],
    canister1: [
      '...###...',
      '...#g#...',
      '..#####..',
      '.#ooooo#.',
      '#oooo#o+#',
      '#ooo#oo+#',
      '#=======#',
      '#oooo#o+#',
      '#ooo#oo+#',
      '#=======#',
      '#oooo#o+#',
      '#ooooooo#',
      '.#ooooo#.',
      '..#####..',
    ],
    starman: [
      '......oo......',
      '.....oooo.....',
      '......oo......',
      '..rrrroorrr...',
      '.rr==rrrrrrrr.',
      'rrrrrrrrrrrrrg',
      '.#.#.....#.#..',
    ],
    star0: ['.s.', 'sss', '.s.'],
    star1: ['s'],
    rocket: [
      '..o..',
      '.ooo.',
      '.ooo.',
      '.o+o.',
      '.ooo.',
      '.ooo.',
      '.ooo.',
      '.ooo.',
      '.o+o.',
      '.ooo.',
      '.ooo.',
      'oooooo',
      'o.o.o',
    ],
    restart: [
      '..........######..........',
      '........##########........',
      '.......###......###.###...',
      '......##..........#####...',
      '.....##............####...',
      '.....##...........#####...',
      '....##.............####...',
      '....##....................',
      '....##....................',
      '....##....................',
      '....##..............##....',
      '.....##............##.....',
      '.....##............##.....',
      '......##..........##......',
      '.......###......###.......',
      '........##########........',
      '..........######..........',
    ],
    sign: [
      '.......#.......',
      '......#=#......',
      '.....#=o=#.....',
      '....#=o#o=#....',
      '...#=oo#oo=#...',
      '..#=ooo#ooo=#..',
      '.#=oooo#oooo=#.',
      '#=ooooooooooo=#',
      '.#=oooo#oooo=#.',
      '..#=ooooooo=#..',
      '...#=ooooo=#...',
      '....#=ooo=#....',
      '.....#=o=#.....',
      '......#=#......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '.......#.......',
      '......###......',
    ],
  };

  // ---------------------------------------------------------------- procedural art
  function cloudSprite(seed) {
    const g = new Grid(48, 15);
    const blobs = seed % 2
      ? [[12, 10, 5], [21, 7, 6.5], [31, 8, 5.5], [38, 10.5, 4]]
      : [[10, 10.5, 4.5], [18, 8, 6], [27, 6.5, 6], [36, 9.5, 5]];
    blobs.forEach(([x, y, r]) => g.disc(x, y, r, 'c'));
    g.rect(6, 11, 37, 4, '.');
    g.outline('c', 'C');
    for (let x = 6; x < 43; x++) if (g.get(x, 10) === 'c' || g.get(x, 10) === 'C') g.set(x, 11, 'C');
    return g.rows();
  }

  // Lattice engine test stand, like the ones at the Texas rocket test site.
  function towerSprite(h) {
    const w = 15, g = new Grid(w, h);
    for (let y = 4; y < h; y++) { g.set(3, y, 'F'); g.set(11, y, 'F'); }
    for (let y = 6; y < h - 4; y += 6) {
      g.line(3, y, 11, y + 6, 'F'); g.line(11, y, 3, y + 6, 'F'); g.line(3, y, 11, y, 'F');
    }
    g.rect(1, 3, 13, 2, 'F'); g.rect(6, 0, 3, 3, 'F'); g.rect(0, h - 2, 15, 2, 'F');
    g.rect(12, 12, 3, 9, 'F');
    return g.rows();
  }

  function waterTowerSprite() {
    const g = new Grid(18, 30);
    g.poly([[2, 4], [16, 4], [16, 13], [9, 15], [2, 13]], 'F');
    g.poly([[1, 4], [9, 0], [17, 4]], 'F');
    g.line(4, 14, 2, 29, 'F'); g.line(14, 14, 16, 29, 'F'); g.line(9, 15, 9, 29, 'F');
    g.line(3, 20, 15, 20, 'F'); g.line(3, 20, 9, 27, 'F'); g.line(15, 20, 9, 27, 'F');
    return g.rows();
  }

  function poleSprite() {
    const g = new Grid(13, 44);
    g.rect(6, 2, 2, 42, '#');
    g.rect(0, 3, 14, 2, '#');
    [1, 4, 9, 12].forEach(x => g.set(x, 2, '+'));
    g.line(3, 5, 6, 9, '#'); g.line(10, 5, 7, 9, '#');
    return g.rows();
  }

  function moonSprite(phase) {
    // phase 0..7; 0 = new-ish crescent, 4 = full
    const g = new Grid(20, 20);
    g.disc(10, 10, 9, 's');
    const off = [7, 10, 13, 18, 99, -18, -13, -10][phase % 8];
    if (Math.abs(off) < 50) g.disc(10 + off, 10, 9, '.', 's');
    return g.rows();
  }

  // Wordmark sign for set pieces ("CANYON AHEAD" etc).
  function boardSprite(text, slot) {
    const tw = text.length * 6 - 1;
    const w = tw + 6, h = 11 + 14;
    const g = new Grid(w, h);
    g.rect(0, 0, w, 11, slot || 'o');
    g.outline(slot || 'o', '#');
    drawText(g, text, 3, 2, '#');
    g.rect(4, 11, 2, 14, '#'); g.rect(w - 6, 11, 2, 14, '#');
    return g.rows();
  }

  // Kicker ramp for the flip stunt. The surface rises `rise` px over `run` px.
  function rampSprite(run, rise) {
    const w = run + 3, h = rise + 2, g = new Grid(w, h);
    g.poly([[0, h], [run, 1], [w, 1], [w, h]], '+');
    g.outline('+', '#');
    for (let x = 6; x < run; x += 7) { const y = Math.round(h - (x / run) * (h - 1)); g.line(x, y + 2, x, h - 1, '='); }
    g.line(4, h - 2, run - 2, 4, '=');
    for (let x = 0; x <= run; x++) {                 // warning stripes along the deck
      const y = Math.floor(h - 0.5 - (x / run) * (h - 1.5));
      g.set(x, y, Math.floor(x / 4) % 2 ? 'x' : 'o');
    }
    g.set(w - 2, 0, 'g'); g.set(w - 1, 0, 'g');
    return g.rows();
  }

  // Puff disc used for the cold-gas plumes.
  function puffSprite(r) {
    const s = Math.ceil(r * 2) + 2, g = new Grid(s, s);
    g.disc(s / 2, s / 2, r, '~');
    if (r >= 2) g.outline('~', '-');
    return g.rows();
  }

  // ---------------------------------------------------------------- font
  // 5x7 bitmap font, uppercase only.
  const FONT = {};
  const F = (ch, rows) => { FONT[ch] = rows.split(' '); };
  F('A', '.###. #...# #...# ##### #...# #...# #...#');
  F('B', '####. #...# #...# ####. #...# #...# ####.');
  F('C', '.###. #...# #.... #.... #.... #...# .###.');
  F('D', '####. #...# #...# #...# #...# #...# ####.');
  F('E', '##### #.... #.... ####. #.... #.... #####');
  F('F', '##### #.... #.... ####. #.... #.... #....');
  F('G', '.###. #...# #.... #.### #...# #...# .####');
  F('H', '#...# #...# #...# ##### #...# #...# #...#');
  F('I', '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.');
  F('J', '..### ...#. ...#. ...#. #..#. #..#. .##..');
  F('K', '#...# #..#. #.#.. ##... #.#.. #..#. #...#');
  F('L', '#.... #.... #.... #.... #.... #.... #####');
  F('M', '#...# ##.## #.#.# #.#.# #...# #...# #...#');
  F('N', '#...# #...# ##..# #.#.# #..## #...# #...#');
  F('O', '.###. #...# #...# #...# #...# #...# .###.');
  F('P', '####. #...# #...# ####. #.... #.... #....');
  F('Q', '.###. #...# #...# #...# #.#.# #..#. .##.#');
  F('R', '####. #...# #...# ####. #.#.. #..#. #...#');
  F('S', '.#### #.... #.... .###. ....# ....# ####.');
  F('T', '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..');
  F('U', '#...# #...# #...# #...# #...# #...# .###.');
  F('V', '#...# #...# #...# #...# #...# .#.#. ..#..');
  F('W', '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.');
  F('X', '#...# #...# .#.#. ..#.. .#.#. #...# #...#');
  F('Y', '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..');
  F('Z', '##### ....# ...#. ..#.. .#... #.... #####');
  F('0', '.###. #...# #..## #.#.# ##..# #...# .###.');
  F('1', '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.');
  F('2', '.###. #...# ....# ...#. ..#.. .#... #####');
  F('3', '####. ....# ....# .###. ....# ....# ####.');
  F('4', '...#. ..##. .#.#. #..#. ##### ...#. ...#.');
  F('5', '##### #.... ####. ....# ....# #...# .###.');
  F('6', '.###. #.... #.... ####. #...# #...# .###.');
  F('7', '##### ....# ...#. ..#.. .#... .#... .#...');
  F('8', '.###. #...# #...# .###. #...# #...# .###.');
  F('9', '.###. #...# #...# .#### ....# ....# .###.');
  F(' ', '..... ..... ..... ..... ..... ..... .....');
  F('.', '..... ..... ..... ..... ..... .##.. .##..');
  F(',', '..... ..... ..... ..... .##.. ..#.. .#...');
  F('!', '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..');
  F('?', '.###. #...# ....# ...#. ..#.. ..... ..#..');
  F(':', '..... .##.. .##.. ..... .##.. .##.. .....');
  F('-', '..... ..... ..... .###. ..... ..... .....');
  F('+', '..... ..#.. ..#.. ##### ..#.. ..#.. .....');
  F('/', '....# ....# ...#. ..#.. .#... #.... #....');
  F("'", '..#.. ..#.. .#... ..... ..... ..... .....');
  F('%', '##..# ##..# ...#. ..#.. .#... #..## #..##');
  F('(', '...#. ..#.. .#... .#... .#... ..#.. ...#.');
  F(')', '.#... ..#.. ...#. ...#. ...#. ..#.. .#...');
  F('=', '..... ..... ##### ..... ##### ..... .....');
  F('>', '.#... ..#.. ...#. ....# ...#. ..#.. .#...');
  F('<', '...#. ..#.. .#... #.... .#... ..#.. ...#.');
  F('^', '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..');   // up arrow
  F('_', '..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..');   // down arrow
  F('*', '..#.. #.#.# .###. ##### .###. #.#.# ..#..');
  F('#', '.#.#. ##### .#.#. .#.#. .#.#. ##### .#.#.');
  F('"', '.#.#. .#.#. ..... ..... ..... ..... .....');

  function textWidth(s, scale) { return (s.length * 6 - 1) * (scale || 1); }

  function drawText(g, s, x, y, c) {
    s = String(s).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const gl = FONT[s[i]] || FONT['?'];
      gl.forEach((row, j) => { for (let k = 0; k < 5; k++) if (row[k] === '#') g.set(x + i * 6 + k, y + j, c); });
    }
  }

  // ---------------------------------------------------------------- catalogue
  function buildCatalogue() {
    const C = {};
    const add = (name, rows) => { C[name] = pad(rows); };
    // car: 4 wheel frames each for run / duck, plus air and wreck
    for (let f = 0; f < 4; f++) {
      const a = f * Math.PI / 6;
      add('car' + f, carSprite({ wheel: a }));
      add('carDuck' + f, carSprite({ wheel: a, duck: true }));
      add('carAir' + f, carSprite({ wheel: a, air: true, spoiler: 1 }));
    }
    add('carHalf', carSprite({ wheel: 0, spoiler: 0.5 }));
    add('carWreck', carSprite({ wheel: 0.4, wreck: true }));
    Object.keys(VEHICLES).forEach(k => { add(k, vehicleSprite(VEHICLES[k], 0.3)); });
    Object.keys(ART).forEach(k => add(k, ART[k]));
    add('barrier1', ART.barrier0.map(r => r.replace(/g/g, '#')));
    add('cloud0', cloudSprite(0)); add('cloud1', cloudSprite(1));
    add('tower', towerSprite(52)); add('towerS', towerSprite(38)); add('water', waterTowerSprite());
    add('pole', poleSprite());
    for (let p = 0; p < 8; p++) add('moon' + p, moonSprite(p));
    add('signCanyon', boardSprite('CANYON AHEAD'));
    add('signRamp', boardSprite('FLIP RAMP'));
    add('signRiver', boardSprite('SNAKE RIVER'));
    add('signFar', boardSprite('MADE IT!'));
    add('ramp', rampSprite(RAMP_RUN, RAMP_RISE));
    add('wheelBit', (() => { const g = new Grid(10, 10); wheel(g, 5, 5, CAR_R, 0.5); return g.rows(); })());
    for (let r = 1; r <= 7; r++) add('puff' + r, puffSprite(r));
    return C;
  }

  // ---------------------------------------------------------------- baking
  // Collision masks ignore glow and vapor pixels, then shave one pixel off
  // every edge so near misses feel fair.
  function maskOf(rows) {
    const h = rows.length, w = rows[0].length;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; m[y * w + x] = (c !== '.' && c !== 'g' && c !== '~' && c !== '-') ? 1 : 0; }
    const e = new Uint8Array(w * h);
    let top = h, bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        const n = (x > 0 && m[i - 1]) + (x < w - 1 && m[i + 1]) + (y > 0 && m[i - w]) + (y < h - 1 && m[i + w]);
        e[i] = n >= 3 ? 1 : 0;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    return { w, h, m: e, top, bottom };
  }

  function bake(catalogue, colors) {
    const out = {};
    Object.keys(catalogue).forEach(name => {
      const rows = catalogue[name], h = rows.length, w = rows[0].length;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      const img = cx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ch = rows[y][x];
          if (ch === '.') continue;
          const hex = colors[SLOT[ch]] || '#ff00ff';
          const n = parseInt(hex.slice(1), 16), i = (y * w + x) * 4;
          img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255;
        }
      }
      cx.putImageData(img, 0, 0);
      out[name] = cv;
    });
    return out;
  }

  // Draw text straight onto a 2D context with a palette color.
  function fontAtlas(color) {
    const chars = Object.keys(FONT);
    const cv = document.createElement('canvas'); cv.width = chars.length * 6; cv.height = 7;
    const cx = cv.getContext('2d'); cx.fillStyle = color;
    const index = {};
    chars.forEach((ch, i) => {
      index[ch] = i * 6;
      FONT[ch].forEach((row, j) => { for (let k = 0; k < 5; k++) if (row[k] === '#') cx.fillRect(i * 6 + k, j, 1, 1); });
    });
    return { cv, index };
  }

  function text(ctx, atlas, s, x, y, scale) {
    scale = scale || 1;
    s = String(s).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const sx = atlas.index[s[i]];
      if (sx === undefined) continue;
      ctx.drawImage(atlas.cv, sx, 0, 5, 7, Math.round(x + i * 6 * scale), Math.round(y), 5 * scale, 7 * scale);
    }
  }

  global.RRArt = { PALETTES, KEYS, SLOT, buildCatalogue, bake, maskOf, fontAtlas, text, textWidth, FONT, VEHICLES,
    CAR_W, CAR_H, RAMP_RUN, RAMP_RISE };
})(window);
