/* Roadster Run: the 3D view (three.js r128). It draws the same simulation as
   the 2D view, so the view can switch mid-run. The Roadster and the parked
   traffic are extruded from the same side profiles as the pixel art. Cones,
   crash debris and the roadside cars are Kenney's CC0 Car Kit models. A post
   pass dithers every frame down to the active palette. */
(function (global) {
  'use strict';
  const A = global.RRArt, C = global.RRCore.CFG;
  const U = 0.1;                       // world units per logical pixel
  const W = C.W, H = C.H;
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Camera presets: where the camera sits relative to the car, and what it looks at.
  const VIEWS = {
    chase: { pos: [-12, 5.0, 0], look: [16, 1.6, 0], fov: 50, follow: 0.85 },
    side: { pos: [24.5, 6.2, 36], look: [24.5, 4.1, 0], fov: 31, follow: 0.3 },
    tv: { pos: [-7.5, 5.2, 12], look: [14, 1.2, -1.5], fov: 48, follow: 0.7 },
  };
  // The same shots framed for a square or tall frame.
  const VIEWS_SQ = {
    chase: { pos: [-10.5, 6.4, 0], look: [20, 1.0, 0], fov: 64, follow: 0.85 },
    side: { pos: [20, 8.5, 34], look: [20, 3.4, 0], fov: 56, follow: 0.35 },
    tv: { pos: [-7.5, 6.2, 12], look: [16, 1.0, -1.5], fov: 62, follow: 0.7 },
  };
  const MODELS = ['cone', 'debris-tire', 'debris-door', 'debris-bumper', 'debris-spoiler-a', 'debris-plate-a', 'debris-bolt',
    'sedan', 'suv-luxury', 'van', 'police', 'taxi', 'ambulance', 'firetruck', 'delivery'];
  const SPECTATORS = ['sedan', 'suv-luxury', 'van', 'police', 'taxi', 'ambulance', 'firetruck', 'delivery'];

  const POST_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const POST_FS = [
    'uniform sampler2D tDiffuse; uniform vec2 res; uniform float mode;',
    'uniform vec3 s0; uniform vec3 s1; uniform vec3 s2; uniform vec3 s3; uniform vec4 L;',
    'varying vec2 vUv;',
    'float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }',
    'float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    'void main() {',
    '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
    '  float d = bayer4(gl_FragCoord.xy) - 0.5;',
    '  if (mode < 0.5) {',
    '    float l = dot(c, vec3(0.299, 0.587, 0.114)); float b = d + 0.5; vec3 o;',
    '    if (l <= L.x) o = s0;',
    '    else if (l < L.y) o = (l - L.x) / (L.y - L.x) > b ? s1 : s0;',
    '    else if (l < L.z) o = (l - L.y) / (L.z - L.y) > b ? s2 : s1;',
    '    else if (l < L.w) o = (l - L.z) / (L.w - L.z) > b ? s3 : s2;',
    '    else o = s3;',
    '    gl_FragColor = vec4(o, 1.0);',
    '  } else {',
    '    float lv = 7.0;',
    '    gl_FragColor = vec4(floor(c * lv + d * 0.85 + 0.5) / lv, 1.0);',
    '  }',
    '}'].join('\n');

  class Render3D {
    // opts.w / opts.h set the internal render size; a square frame suits phones.
    // opts.band adds that many rows of ground below the usual picture, for on-screen buttons.
    constructor(screen, catalogue, r2d, opts) {
      const T = this.T = global.THREE;
      T.Cache.enabled = true;
      opts = opts || {};
      this.w = opts.w || W; this.h = opts.h || H;
      this.band = Math.max(0, Math.min(this.h - 40, opts.band || 0)); this.baseH = this.h - this.band;
      this.r2d = r2d; this.cat = catalogue; this.time = 0;
      this.view = 'chase'; this.camState = null;
      this.renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.w, this.h, false);
      this.canvas = this.renderer.domElement; this.canvas.className = 'view3d';
      this.canvas.style.removeProperty('display');      // three.js sets display:block inline, which would beat the page's hide rule
      this.hudCv = document.createElement('canvas'); this.hudCv.width = this.w; this.hudCv.height = this.h; this.hudCv.className = 'hud3d';
      this.hud = this.hudCv.getContext('2d');
      screen.appendChild(this.canvas); screen.appendChild(this.hudCv);

      this.rt = new T.WebGLRenderTarget(this.w, this.h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
      this.post = new T.ShaderMaterial({
        uniforms: { tDiffuse: { value: this.rt.texture }, res: { value: new T.Vector2(this.w, this.h) }, mode: { value: 0 },
          s0: { value: new T.Vector3() }, s1: { value: new T.Vector3() }, s2: { value: new T.Vector3() }, s3: { value: new T.Vector3() },
          L: { value: new T.Vector4(0.25, 0.5, 0.75, 1) } },
        vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
      });
      this.postScene = new T.Scene();
      this.postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.post));
      this.postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(56, this.w / this.h, 0.1, 700);
      this.square = this.w / this.baseH < 1.6;
      // with a band, the camera renders a taller frame and shows its lower part, so the usual
      // picture keeps its place at the top and the extra rows below show more of the road
      if (this.band) this.camera.setViewOffset(this.w, this.baseH + 2 * this.band, 0, this.band, this.w, this.h);
      this.scene.fog = new T.Fog(0xffffff, 60, 230);
      this.hemi = new T.HemisphereLight(0xffffff, 0x888888, 0.75); this.scene.add(this.hemi);
      this.sun = new T.DirectionalLight(0xffffff, 0.65); this.sun.position.set(-30, 60, 40); this.scene.add(this.sun);

      this.makeMaterials();
      this.models = {};
      this.buildWorld();
      this.car = this.buildCar();
      this.scene.add(this.car.pivot);
      this.headlight = new T.SpotLight(0xfff4d6, 0, 60, 0.5, 0.6, 1.2);
      this.headlight.position.set(5.6, 0.6, 0); this.headlight.target.position.set(20, 0, 0);
      this.car.body.add(this.headlight); this.car.body.add(this.headlight.target);
      this.obj = new Map();               // simulation object -> mesh
      this.particles = []; this.pool = [];
      this.setPalette(r2d.pal);
      this.loadModels();
    }

    // ------------------------------------------------------------ materials and palette
    makeMaterials() {
      const T = this.T;
      this.slots = ['ink', 'dark', 'mid', 'light', 'red', 'glow', 'cone', 'gold', 'road', 'roadLine', 'dirt', 'canyon', 'rock', 'river', 'far', 'far2', 'vapor', 'star', 'cloud'];
      this.mats = {};
      this.slots.forEach(s => { this.mats[s] = new T.MeshLambertMaterial({ color: 0xffffff }); });
      this.mats.glass = new T.MeshPhongMaterial({ color: 0x15161d, specular: 0x9aa4c0, shininess: 70 });
      this.mats.lamp = new T.MeshBasicMaterial({ color: 0xffffff });
      this.mats.tail = new T.MeshBasicMaterial({ color: 0xff2e45 });
      this.mats.gold = new T.MeshPhongMaterial({ color: 0xc9a25a, specular: 0xffe2a0, shininess: 50 });
      this.mats.wire = new T.LineBasicMaterial({ color: 0x000000 });
      this.mats.tumble = new T.MeshBasicMaterial({ color: 0x000000, wireframe: true });
      this.mats.puff = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
      this.mats.starPts = new T.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false, transparent: true, fog: false });
    }

    setPalette(pal) {
      this.pal = pal;
      const T = this.T;
      this.cols = [{}, {}];
      [pal.day, pal.night].forEach((P, i) => { Object.keys(P).forEach(k => { this.cols[i][k] = hex(P[k]); }); });
      // four shades for the dithered palettes, sorted dark to light
      const pick = P => {
        const uniq = [];
        [P.ink, P.dark, P.mid, P.far2, P.far, P.bg, P.light].map(hex).forEach(c => { if (!uniq.some(u => Math.abs(lum(u) - lum(c)) < 0.04)) uniq.push(c); });
        uniq.sort((a, b) => lum(a) - lum(b));
        while (uniq.length < 4) uniq.push(uniq[uniq.length - 1]);
        const n = uniq.length;
        return [uniq[0], uniq[Math.round((n - 1) / 3)], uniq[Math.round(2 * (n - 1) / 3)], uniq[n - 1]];
      };
      this.shades = [pick(pal.day), pick(pal.night)];
      this.dithered = pal.id === 'classic' || pal.id === 'pocket';
      this.post.uniforms.mode.value = this.dithered ? 0 : 1;
      // textures baked from the 2D renderer's current sets
      this.texSets = this.r2d.sets.map(S => this.makeTextures(S));
      this.nightIdx = -1;
      this.lastMix = -1;
    }

    makeTextures(S) {
      const T = this.T;
      const tex = cv => { const t = new T.CanvasTexture(cv); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t; };
      const out = {}, K = S.colors;
      ['cloud0', 'cloud1', 'bird0', 'bird1', 'signCanyon', 'signRamp', 'signFar', 'moon4', 'moon2', 'starman'].forEach(k => { out[k] = tex(S.spr[k]); });
      const SW = this.w, SH = this.h;
      const sky = document.createElement('canvas'); sky.width = SW; sky.height = SH;
      const yx = sky.getContext('2d');
      yx.fillStyle = K.bg; yx.fillRect(0, 0, SW, SH);
      if (K.horizon !== K.bg) {
        yx.fillStyle = K.horizon;
        const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
        const BH = SH - this.band, y0 = Math.round(BH * 0.1), span = BH * (this.square ? 0.32 : 0.35);
        for (let y = y0; y < SH; y++) { const f = Math.min(1, (y - y0) / span) * 16; for (let x = 0; x < SW; x++) if (B[y & 3][x & 3] < f) yx.fillRect(x, y, 1, 1); }
      }
      out.sky = tex(sky);
      // backdrop strip of mesas and test stands, made transparent above the skyline
      const far = document.createElement('canvas'); far.width = S.far.width; far.height = S.far.height;
      far.getContext('2d').drawImage(S.far, 0, 0);
      out.far = tex(far); out.far.wrapS = T.RepeatWrapping; out.far.repeat.set(3, 1);
      // road surface: asphalt, three lane dividers and edge lines
      const road3 = K.road === K.bg ? (K.mid !== K.far2 ? K.mid : K.dark) : K.road;
      const sand3 = K.dirt === K.bg ? K.far2 : K.dirt;
      const road = document.createElement('canvas'); road.width = 40; road.height = 90;
      const rx = road.getContext('2d');
      rx.fillStyle = road3; rx.fillRect(0, 0, 40, 90);
      rx.fillStyle = S.colors.mid;
      for (let i = 0; i < 70; i++) rx.fillRect(Math.floor(hash(i * 3) * 40), Math.floor(hash(i * 3 + 1) * 90), 1, 1);
      rx.fillStyle = S.colors.roadLine;
      rx.fillRect(0, 3, 40, 2); rx.fillRect(0, 85, 40, 2);
      rx.fillRect(0, 29, 16, 2); rx.fillRect(0, 59, 16, 2);
      out.road = tex(road); out.road.wrapS = T.RepeatWrapping;
      out.road2 = out.road.clone(); out.road2.needsUpdate = true;
      // sand with pebbles
      const sand = document.createElement('canvas'); sand.width = 64; sand.height = 64;
      const sx = sand.getContext('2d');
      sx.fillStyle = sand3; sx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 90; i++) { sx.fillStyle = hash(i * 7 + 2) < 0.5 ? S.colors.mid : S.colors.far2; sx.fillRect(Math.floor(hash(i * 7) * 64), Math.floor(hash(i * 7 + 1) * 64), 1, 1); }
      out.sand = tex(sand); out.sand.wrapS = out.sand.wrapT = T.RepeatWrapping;
      out.sand2 = out.sand.clone(); out.sand2.needsUpdate = true;
      // canyon wall strata
      const rock = document.createElement('canvas'); rock.width = 32; rock.height = 64;
      const kx = rock.getContext('2d');
      kx.fillStyle = S.colors.canyon; kx.fillRect(0, 0, 32, 64);
      kx.fillStyle = S.colors.rock;
      for (let y = 2; y < 64; y += 5) for (let x = 0; x < 32; x += 2) if (hash(x * 31 + y) < 0.6) kx.fillRect(x, y, 2, 2);
      out.rock = tex(rock); out.rock.wrapS = out.rock.wrapT = T.RepeatWrapping; out.rock.repeat.set(30, 3);
      // warning stripes for ramps and barriers
      const stripe = document.createElement('canvas'); stripe.width = 16; stripe.height = 16;
      const tx = stripe.getContext('2d');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { tx.fillStyle = Math.floor((x + y) / 4) % 2 ? S.colors.cone : S.colors.light; tx.fillRect(x, y, 1, 1); }
      out.stripe = tex(stripe); out.stripe.wrapS = out.stripe.wrapT = T.RepeatWrapping;
      return out;
    }

    applyNight(mix) {
      const T = this.T, k = mix * mix * (3 - 2 * mix);
      if (Math.abs(k - this.lastMix) < 0.002) return;
      this.lastMix = k;
      const c = s => mix3(this.cols[0][s], this.cols[1][s], k);
      this.slots.forEach(s => { if (this.cols[0][s]) { const v = c(s); this.mats[s].color.setRGB(v[0], v[1], v[2]); } });
      const glow = c('glow'); this.mats.lamp.color.setRGB(glow[0], glow[1], glow[2]);
      const red = c('red'); this.mats.tail.color.setRGB(red[0], red[1], red[2]);
      const ink = c('ink'); this.mats.wire.color.setRGB(ink[0], ink[1], ink[2]); this.mats.tumble.color.setRGB(ink[0], ink[1], ink[2]);
      const vap = c('vapor'), ve = c('vaporEdge'); this.mats.puff.color.setRGB(vap[0], vap[1], vap[2]);
      this.mats.puff.emissive.setRGB(ve[0] * 0.25, ve[1] * 0.25, ve[2] * 0.25);
      const st = c('star'); this.mats.starPts.color.setRGB(st[0], st[1], st[2]);
      const hz = c('horizon'); this.scene.fog.color.setRGB(hz[0], hz[1], hz[2]);
      const Ls = [];
      for (let i = 0; i < 4; i++) { const v = mix3(this.shades[0][i], this.shades[1][i], k); this.post.uniforms['s' + i].value.set(v[0], v[1], v[2]); Ls.push(lum(v)); }
      this.post.uniforms.L.value.set(Ls[0], Math.max(Ls[1], Ls[0] + 0.01), Math.max(Ls[2], Ls[1] + 0.02), Math.max(Ls[3], Ls[2] + 0.03));
      const dim = this.pal.id === 'classic' ? 0 : k;
      this.hemi.intensity = 0.78 - 0.45 * dim; this.sun.intensity = 0.62 - 0.45 * dim;
      this.headlight.intensity = 2.2 * dim;
      this.stars.material.opacity = (this.pal.alwaysStars ? 1 : k);
      this.stars.visible = this.stars.material.opacity > 0.02;
      // swap baked textures halfway through dusk
      const idx = k > 0.5 ? 1 : 0;
      if (idx !== this.nightIdx) {
        this.nightIdx = idx;
        const X = this.texSets[idx];
        this.scene.background = X.sky;
        this.backdrop.material.map = X.far; this.backdrop.material.needsUpdate = true;
        this.roadMats.forEach((m, i) => { m.map = i ? X.road2 : X.road; m.needsUpdate = true; });
        this.sandMats.forEach((m, i) => { m.map = i ? X.sand2 : X.sand; m.needsUpdate = true; });
        this.clouds.forEach((s, i) => { s.material.map = X['cloud' + (i % 2)]; s.material.needsUpdate = true; });
        this.moon.material.map = X.moon4; this.moon.material.needsUpdate = true;
        this.obj.forEach(m => { if (m.userData.retex) m.userData.retex(X); });
        (this.signMats || []).forEach(([m, key]) => { m.map = X[key]; m.needsUpdate = true; });
        this.stripeMats.forEach(m => { m.map = X.stripe; m.needsUpdate = true; });
        this.rockMats.forEach(m => { m.map = X.rock; m.needsUpdate = true; });
      }
    }

    // ------------------------------------------------------------ geometry helpers
    extrude(points, depth, bevel) {
      const T = this.T;
      const shape = new T.Shape(points.map(([x, h]) => new T.Vector2(x * U, h * U)));
      const b = bevel === undefined ? 0.07 : bevel;
      const g = new T.ExtrudeGeometry(shape, { depth: depth - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.7, bevelSegments: 1, steps: 1 });
      g.translate(0, 0, -(depth - b * 2) / 2);
      return g;
    }

    wheel(r, width, rimMat) {
      const T = this.T, g = new T.Group();
      const tire = new T.Mesh(new T.CylinderGeometry(r, r, width, 14), this.mats.ink);
      tire.rotation.x = Math.PI / 2; g.add(tire);
      const rim = new T.Mesh(new T.CylinderGeometry(r * 0.66, r * 0.66, width + 0.04, 10), rimMat || this.mats.mid);
      rim.rotation.x = Math.PI / 2; g.add(rim);
      for (let k = 0; k < 3; k++) {
        const s = new T.Mesh(new T.BoxGeometry(r * 1.25, r * 0.16, width + 0.08), this.mats.ink);
        s.rotation.z = k * Math.PI / 3; g.add(s);
      }
      return g;
    }

    // The Roadster: a white lower body and a narrower dark glass canopy, both
    // extruded from the side profile used for the sprite.
    buildCar() {
      const T = this.T;
      const pivot = new T.Group(), body = new T.Group();
      const cx = A.CAR_W / 2 * U, cy = 0.95;
      body.position.set(-cx, -cy, 0); pivot.add(body);
      const WID = 2.5;
      const lower = [[1, 3.4], [0.5, 8], [1.4, 10.4], [9, 11.2], [12.6, 10.7], [20, 10.2], [35.6, 11.1], [37.5, 11.7], [45, 10.3], [51, 8], [56.6, 5.3], [56.2, 3.6], [51, 2.2], [5, 2.2]];
      const cabin = [[12.4, 10.5], [16, 13.7], [24, 14.7], [30, 14.3], [37.7, 11.5], [35.6, 10.8], [20, 9.9]];
      const lowerMesh = new T.Mesh(this.extrude(lower, WID, 0.1), this.mats.light); body.add(lowerMesh);
      const cab = new T.Mesh(this.extrude(cabin, WID * 0.8, 0.12), this.mats.glass); body.add(cab);
      const sill = new T.Mesh(new T.BoxGeometry(4.2, 0.16, WID + 0.04), this.mats.ink); sill.position.set(2.8, 0.28, 0); body.add(sill);
      const tail = new T.Mesh(new T.BoxGeometry(0.1, 0.1, WID * 0.92), this.mats.tail); tail.position.set(0.12, 0.95, 0); body.add(tail);
      [-0.78, 0.78].forEach(z => { const l = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.5), this.mats.lamp); l.position.set(5.55, 0.52, z); body.add(l); });
      // brass thruster nozzles at the tail, as in the photo of the rear
      [-0.75, -0.25, 0.25, 0.75].forEach(z => {
        const n = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.18, 8), this.mats.gold);
        n.rotation.z = Math.PI / 2; n.position.set(0.02, 0.42, z); body.add(n);
      });
      const wheels = [];
      [[1.1, 0.43], [4.5, 0.43]].forEach(([x, y]) => [-1, 1].forEach(s => {
        const w = this.wheel(0.43, 0.34); w.position.set(x, y, s * (WID / 2 - 0.12)); body.add(w); wheels.push(w);
        if (x > 3 && s > 0) w.userData.wreckHide = true;
      }));
      const spoiler = new T.Group();
      const wing = new T.Mesh(new T.BoxGeometry(1.0, 0.07, WID * 0.96), this.mats.ink); wing.position.set(0.55, 0.3, 0); spoiler.add(wing);
      [-0.7, 0.7].forEach(z => { const p = new T.Mesh(new T.BoxGeometry(0.08, 0.3, 0.08), this.mats.ink); p.position.set(0.6, 0.15, z); spoiler.add(p); });
      spoiler.position.set(0.2, 1.02, 0); body.add(spoiler);
      const shadow = new T.Mesh(new T.CircleGeometry(1, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.scale.set(3.1, 1.25, 1); this.scene.add(shadow);
      return { pivot, body, wheels, spoiler, shadow, center: [cx, cy] };
    }

    buildVehicle(kind) {
      const T = this.T, def = A.VEHICLES[kind], g = new T.Group();
      const wid = { sedan: 2.4, suv: 2.6, wedge: 2.75, cab: 2.25, semi: 2.75 }[kind] || 2.4;
      const paint = { '=': 'dark', '+': 'mid', 'o': 'light', 'y': 'gold' }[def.paint];
      const body = new T.Mesh(this.extrude(def.body, wid, 0.08), paint === 'gold' ? this.mats.gold : this.mats[paint]);
      g.add(body);
      if (def.glass) g.add(new T.Mesh(this.extrude(def.glass, wid + 0.06, 0), this.mats.glass));
      def.wheels.forEach(([x, h, r]) => [-1, 1].forEach(s => {
        const w = this.wheel(r * U, 0.36, def.rim === 'o' ? this.mats.light : this.mats.mid);
        w.position.set(x * U, h * U, s * (wid / 2 - 0.1)); g.add(w);
      }));
      (def.dots || []).forEach(([x, h, c]) => {
        if (c !== 'g' && c !== 'r') return;
        const l = new T.Mesh(new T.BoxGeometry(0.12, 0.12, wid * 0.7), c === 'g' ? this.mats.lamp : this.mats.tail);
        l.position.set(x * U, h * U, 0); g.add(l);
      });
      return g;
    }

    cactus(tall) {
      const T = this.T, g = new T.Group(), m = this.mats.ink;
      const h = tall ? 2.8 : 2.0, r = tall ? 0.28 : 0.22;
      const trunk = new T.Mesh(new T.CylinderGeometry(r, r * 1.1, h, 7), m); trunk.position.y = h / 2; g.add(trunk);
      const top = new T.Mesh(new T.SphereGeometry(r, 7, 4), m); top.position.y = h; g.add(top);
      [[-1, 0.45], [1, 0.62]].forEach(([s, f]) => {
        const len = tall ? 0.55 : 0.4, up = tall ? 0.8 : 0.5;
        const arm = new T.Mesh(new T.CylinderGeometry(r * 0.7, r * 0.7, len, 6), m);
        arm.rotation.z = Math.PI / 2; arm.position.set(s * len / 2, h * f, 0); g.add(arm);
        const rise = new T.Mesh(new T.CylinderGeometry(r * 0.7, r * 0.7, up, 6), m);
        rise.position.set(s * len, h * f + up / 2, 0); g.add(rise);
      });
      g.position.x = 0;
      const w = new T.Group(); g.position.set(tall ? 0.85 : 0.55, 0, 0); w.add(g);
      return w;
    }

    barrier() {
      const T = this.T, g = new T.Group();
      const boardMat = new T.MeshLambertMaterial({ map: this.texSets[this.nightIdx > 0 ? 1 : 0].stripe });
      this.stripeMats.push(boardMat);
      [-0.9, 0.9].forEach(z => {
        const board = new T.Mesh(new T.BoxGeometry(2.6, 0.45, 0.12), boardMat); board.position.set(1.3, 1.05, z); g.add(board);
        [0.25, 2.35].forEach(x => { const leg = new T.Mesh(new T.BoxGeometry(0.1, 1.2, 0.1), this.mats.ink); leg.position.set(x, 0.6, z); g.add(leg); });
      });
      [0.35, 2.25].forEach(x => { const l = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2), this.mats.lamp); l.position.set(x, 1.4, 0.9); l.name = 'blink'; g.add(l); });
      return g;
    }

    drone() {
      const T = this.T, g = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(1.1, 0.28, 0.9), this.mats.mid); body.position.set(1.15, 0.45, 0); g.add(body);
      const led = new T.Mesh(new T.BoxGeometry(0.14, 0.1, 0.14), this.mats.tail); led.position.set(1.7, 0.45, 0); g.add(led);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => {
        const arm = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.08), this.mats.ink); arm.position.set(1.15 + a * 0.45, 0.55, b * 0.4); g.add(arm);
        const rotor = new T.Mesh(new T.BoxGeometry(0.95, 0.03, 0.12), this.mats.ink); rotor.position.set(1.15 + a * 0.85, 0.68, b * 0.7); rotor.name = 'rotor'; g.add(rotor);
      });
      return g;
    }

    canister() {
      const T = this.T, g = new T.Group(), inner = new T.Group();
      const c = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.8, 10), this.mats.light); inner.add(c);
      [-0.4, 0.4].forEach(y => { const cap = new T.Mesh(new T.SphereGeometry(0.34, 10, 5), this.mats.light); cap.position.y = y; inner.add(cap); });
      [-0.18, 0.18].forEach(y => { const band = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.08, 10), this.mats.dark); band.position.y = y; inner.add(band); });
      const valve = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.2, 6), this.mats.gold); valve.position.y = 0.82; inner.add(valve);
      inner.position.set(0.45, 0.7, 0); inner.name = 'spin'; g.add(inner);
      return g;
    }

    sign(key) {
      const T = this.T, g = new T.Group();
      const X = this.texSets[this.nightIdx > 0 ? 1 : 0];
      const tex = X[key], img = tex.image;
      const w = img.width * U, h = 11 * U;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: T.DoubleSide });
      const geo = new T.PlaneGeometry(w, img.height * U);
      const board = new T.Mesh(geo, mat); board.position.set(w / 2, img.height * U / 2, -2.6); g.add(board);
      this.signMats = this.signMats || [];
      this.signMats.push([mat, key]);
      return g;
    }

    ramp() {
      const T = this.T, g = new T.Group();
      const run = A.RAMP_RUN, rise = A.RAMP_RISE;
      const wedge = new T.Mesh(this.extrude([[0, 0], [run, rise], [run + 3, rise], [run + 3, 0]], 3.4, 0.03), this.mats.mid);
      g.add(wedge);
      const deckMat = new T.MeshLambertMaterial({ map: this.texSets[this.nightIdx > 0 ? 1 : 0].stripe });
      this.stripeMats.push(deckMat);
      const len = Math.hypot(run, rise) * U;
      const deck = new T.Mesh(new T.PlaneGeometry(len, 3.2), deckMat);
      deck.rotation.order = 'ZXY'; deck.rotation.x = -Math.PI / 2; deck.rotation.z = Math.atan2(rise, run);
      deck.position.set(run * U / 2, rise * U / 2 + 0.03, 0); g.add(deck);
      return g;
    }

    canyon(f) {
      const T = this.T, g = new T.Group();
      const depth = 36, span = 520;
      if (!this.wallMat) { this.wallMat = new T.MeshLambertMaterial({ map: this.texSets[this.nightIdx > 0 ? 1 : 0].rock }); this.rockMats.push(this.wallMat); }
      const wallMat = this.wallMat;
      const mk = (x, dir) => {
        const m = new T.Mesh(new T.BoxGeometry(1.2, depth, span), wallMat);
        m.position.set(x + dir * 0.6, -depth / 2, 0); return m;
      };
      g.userData.near = mk(0, -1); g.userData.far = mk(1, 1);
      g.add(g.userData.near, g.userData.far);
      const river = new T.Mesh(new T.PlaneGeometry(1, span), this.mats.river);
      river.rotation.x = -Math.PI / 2; river.position.y = -depth + 2; g.add(river); g.userData.river = river;
      const floor = new T.Mesh(new T.PlaneGeometry(1, span), this.mats.canyon);
      floor.rotation.x = -Math.PI / 2; floor.position.y = -depth + 1.9; g.add(floor); g.userData.floor = floor;
      return g;
    }

    // ------------------------------------------------------------ static world
    buildWorld() {
      const T = this.T;
      this.roadMats = []; this.sandMats = []; this.stripeMats = []; this.rockMats = [];
      // distant mesas and test stands on a ring around the camera
      this.backdrop = new T.Mesh(new T.CylinderGeometry(300, 300, 34, 64, 1, true),
        new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: T.BackSide, fog: false, depthWrite: false }));
      this.backdrop.renderOrder = -5; this.scene.add(this.backdrop);
      // ground and road, split around canyons
      this.ground = []; this.road = [];
      for (let i = 0; i < 2; i++) {
        const gm = new T.MeshLambertMaterial({ color: 0xffffff }); this.sandMats.push(gm);
        const g = new T.Mesh(new T.PlaneGeometry(1, 1), gm); g.rotation.x = -Math.PI / 2; this.scene.add(g); this.ground.push(g);
        const rm = new T.MeshLambertMaterial({ color: 0xffffff }); this.roadMats.push(rm);
        const r = new T.Mesh(new T.PlaneGeometry(1, 1), rm); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; this.scene.add(r); this.road.push(r);
      }
      // power poles with sagging wires, recycled as the world scrolls
      this.poles = [];
      for (let i = 0; i < 12; i++) {
        const g = new T.Group();
        const post = new T.Mesh(new T.BoxGeometry(0.22, 4.4, 0.22), this.mats.ink); post.position.y = 2.2; g.add(post);
        const bar = new T.Mesh(new T.BoxGeometry(0.12, 0.14, 1.6), this.mats.ink); bar.position.y = 4.2; g.add(bar);
        const pts = [];
        for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new T.Vector3(t * 26, 4.25 - Math.sin(t * Math.PI) * 0.9, 0)); }
        [-0.7, 0.7].forEach(z => { const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), this.mats.wire); l.position.z = z; g.add(l); });
        g.position.z = -9; this.scene.add(g); this.poles.push(g);
      }
      // roadside scenery: cacti and rocks on both sides
      this.props = [];
      for (let i = 0; i < 26; i++) {
        const side = hash(i * 5 + 1) < 0.5 ? -1 : 1;
        const z = side * (8 + hash(i * 5 + 2) * 40);
        let m;
        if (hash(i * 5 + 3) < 0.55) m = this.cactus(hash(i * 5 + 4) < 0.5);
        else { m = new T.Mesh(new T.DodecahedronGeometry(0.6 + hash(i) * 1.2, 0), this.mats.far2); m.position.y = 0.2; }
        m.userData.z = z; m.userData.base = hash(i * 5 + 5) * 360;
        this.scene.add(m); this.props.push(m);
      }
      // clouds as pixel-art billboards
      this.clouds = [];
      for (let i = 0; i < 9; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ transparent: true, alphaTest: 0.5, fog: false }));
        s.scale.set(4.8 * 3, 1.5 * 3, 1);
        s.userData = { x: hash(i * 9 + 1) * 400 - 60, y: 24 + hash(i * 9 + 2) * 16, z: i % 3 === 0 ? 45 + hash(i * 9 + 3) * 50 : -40 - hash(i * 9 + 3) * 110 };
        this.scene.add(s); this.clouds.push(s);
      }
      // stars on a dome
      const sp = [];
      for (let i = 0; i < 260; i++) {
        const a = hash(i * 3 + 7) * Math.PI * 2, e = 0.12 + hash(i * 3 + 8) * 1.2;
        sp.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280);
      }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      this.stars = new T.Points(sg, this.mats.starPts); this.scene.add(this.stars);
      this.moon = new T.Sprite(new T.SpriteMaterial({ transparent: true, alphaTest: 0.5, fog: false })); this.moon.scale.set(14, 14, 1);
      this.scene.add(this.moon);
      // spectator cars: Kenney models fill these slots once they load
      this.spectators = [];
    }

    loadModels() {
      const T = this.T;
      if (!T.GLTFLoader) return;
      const loader = new T.GLTFLoader();
      const warn = console.warn;
      let pending = MODELS.length;
      console.warn = (...a) => { if (!String(a[0]).includes('KHR_texture_transform')) warn.apply(console, a); };
      const done = () => { if (--pending === 0) console.warn = warn; };
      MODELS.forEach(name => {
        loader.load('assets/models/' + name + '.json', gltf => {
          const root = gltf.scene;
          root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); if (o.material.map) { o.material.map.magFilter = T.NearestFilter; } } });
          this.models[name] = root;
          if (SPECTATORS.includes(name)) this.addSpectators(name);
          done();
        }, undefined, done);
      });
    }

    addSpectators(name) {
      for (let i = 0; i < 2; i++) {
        const m = this.models[name].clone();
        m.scale.setScalar(1.9);
        m.rotation.y = hash(this.spectators.length * 13 + 5) < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        m.userData = { base: hash(this.spectators.length * 17 + 3) * 420, z: -12 - hash(this.spectators.length * 19 + 1) * 10 };
        this.scene.add(m); this.spectators.push(m);
      }
    }

    // ------------------------------------------------------------ per-object meshes
    // Each kind is built once, then cloned so spawns share geometry.
    template(key, make) {
      this.templates = this.templates || {};
      if (!this.templates[key]) this.templates[key] = make();
      const m = this.templates[key].clone();
      m.userData = {};
      m.traverse(o => { if (o.name) (m.userData[o.name] = m.userData[o.name] || []).push(o); });
      return m;
    }

    meshFor(o) {
      const T = this.T;
      if (o.kind === 'bird') return this.makeBird();
      const key = o.kind === 'cone' && this.models.cone ? 'coneK' : o.kind;
      const m = this.template(key, () => this.buildKind(o.kind));
      this.scene.add(m);
      return m;
    }

    makeBird() {
      const T = this.T, X = this.texSets[this.nightIdx > 0 ? 1 : 0];
      const m = new T.Sprite(new T.SpriteMaterial({ map: X.bird0, transparent: true, alphaTest: 0.5 }));
      m.scale.set(1.7 * 1.4, 1.2 * 1.4, 1);
      m.userData.tex = X;
      m.userData.retex = Xs => { m.userData.tex = Xs; };
      this.scene.add(m);
      return m;
    }

    buildKind(kind) {
      const T = this.T;
      let m;
      switch (kind) {
        case 'cone': {
          m = new T.Group();
          if (this.models.cone) { const c = this.models.cone.clone(); c.scale.setScalar(2.1); c.position.set(0.55, 0, 0); m.add(c); }
          else { const c = new T.Mesh(new T.ConeGeometry(0.45, 1.2, 8), this.mats.cone); c.position.set(0.55, 0.6, 0); m.add(c); }
          break;
        }
        case 'cactusS': m = this.cactus(false); break;
        case 'cactusL': m = this.cactus(true); break;
        case 'barrier': m = this.barrier(); break;
        case 'tumble': {
          m = new T.Group(); const ball = new T.Mesh(new T.IcosahedronGeometry(0.66, 1), this.mats.tumble);
          const core = new T.Mesh(new T.DodecahedronGeometry(0.42, 0), this.mats.tumble);
          ball.add(core); ball.position.set(0.7, 0.66, 0); ball.name = 'ball'; m.add(ball); break;
        }
        case 'drone': m = this.drone(); break;
        default: m = this.buildVehicle(kind);
      }
      return m;
    }

    sync(game) {
      const T = this.T, seen = new Set();
      const place = (key, make, update) => {
        let m = this.obj.get(key);
        if (!m) { m = make(); this.obj.set(key, m); }
        seen.add(key); update(m);
      };
      for (const o of game.obstacles) {
        place(o, () => this.meshFor(o), m => {
          const x = (o.x - C.CAR_X) * U, y = o.y * U;
          if (o.kind === 'bird') {
            m.position.set(x + o.w * U / 2, y + o.h * U / 2, 0);
            const X = m.userData.tex; const t = o.frame ? X.bird1 : X.bird0;
            if (m.material.map !== t) { m.material.map = t; m.material.needsUpdate = true; }
            return;
          }
          m.position.set(x, y, 0);
          const u = m.userData;
          if (u.ball) { u.ball[0].rotation.z = o.rot; u.ball[0].rotation.x = o.rot * 0.4; }
          if (u.rotor) u.rotor.forEach((r, i) => { r.rotation.y = this.time * 40 + i; });
          if (u.blink) u.blink.forEach(b => { b.visible = o.frame === 0; });
        });
      }
      for (const it of game.items) {
        if (it.taken) continue;
        place(it, () => { const m = this.template('canister', () => this.canister()); this.scene.add(m); return m; }, m => {
          m.position.set((it.x - C.CAR_X) * U, (it.y + Math.sin(it.t * 4) * 2) * U, 0);
          m.userData.spin[0].rotation.y = this.time * 3;
        });
      }
      for (const d of game.decor) {
        place(d, () => { const m = this.template('sign_' + d.sprite, () => this.sign(d.sprite)); this.scene.add(m); return m; }, m => { m.position.set((d.x - C.CAR_X) * U, 0, 0); });
      }
      for (const f of game.features) {
        if (f.kind === 'ramp') place(f, () => { const m = this.template('ramp', () => this.ramp()); this.scene.add(m); return m; }, m => { m.position.set((f.x - C.CAR_X) * U, 0, 0); });
        if (f.kind === 'canyon') place(f, () => { const m = this.canyon(f); this.scene.add(m); return m; }, m => {
          const x0 = (f.x - C.CAR_X) * U, x1 = (f.x + f.w - C.CAR_X) * U;
          m.userData.near.position.x = x0 - 0.6; m.userData.far.position.x = x1 + 0.6;
          [m.userData.river, m.userData.floor].forEach(p => { p.scale.x = x1 - x0; p.position.x = (x0 + x1) / 2; });
        });
      }
      // drop meshes whose objects left the simulation
      for (const [k, m] of this.obj) {
        if (!seen.has(k) || (k.taken !== undefined && k.taken)) { this.scene.remove(m); this.obj.delete(k); }
      }
    }

    // ------------------------------------------------------------ effects
    onEvent(e, game) {
      switch (e.type) {
        case 'jump': for (let i = 0; i < 10; i++) this.puff(game, 1.4); break;
        case 'flip': for (let i = 0; i < 12; i++) this.puff(game, 1.5); break;
        case 'stunt': for (let i = 0; i < 9; i++) this.puff(game, 1.4); break;
        case 'land': for (let i = 0; i < Math.min(12, e.v / 60); i++) this.dust(); break;
        case 'crash': this.crash(game); break;
        case 'canister': for (let i = 0; i < 14; i++) this.spark([(e.x - C.CAR_X) * U + 0.4, e.y * U + 0.7, 0], this.mats.lamp, 6); break;
        case 'boom': this.shake = 0.6; break;
      }
    }

    get(mat, geo) {
      const T = this.T;
      let p = this.pool.find(q => !q.mesh.visible && q.geo === geo);
      if (!p) {
        const g = geo === 'box' ? (this.boxGeo || (this.boxGeo = new T.BoxGeometry(1, 1, 1))) : (this.puffGeo || (this.puffGeo = new T.IcosahedronGeometry(1, 0)));
        p = { mesh: new T.Mesh(g, mat), geo }; this.scene.add(p.mesh); this.pool.push(p);
      }
      p.mesh.material = mat; p.mesh.visible = true;
      return p;
    }

    nozzleWorld(game, i) {
      const T = this.T;
      const n = [[2.2, 0.15, -0.6], [2.9, 0.15, 0.6], [3.6, 0.15, -0.6], [2.2, 0.15, 0.6], [2.9, 0.15, -0.6], [3.6, 0.15, 0.6], [0.0, 0.42, -0.5], [0.0, 0.42, 0.5]][i % 8];
      const v = new T.Vector3(n[0], n[1], n[2]);
      this.car.body.localToWorld(v);
      return { v, rear: i % 8 >= 6 };
    }

    puff(game, scale) {
      const { v, rear } = this.nozzleWorld(game, Math.floor(Math.random() * 8));
      const p = this.get(this.mats.puff, 'ico');
      const sp = game.speed * U;
      p.vel = [-sp * (0.3 + Math.random() * 0.3) - (rear ? 4 : 0), rear ? 0.3 : -(3 + Math.random() * 4), (Math.random() - 0.5) * 3];
      p.pos = [v.x, v.y, v.z]; p.age = 0; p.life = 0.35 + Math.random() * 0.35; p.r = (0.13 + Math.random() * 0.17) * (scale || 1); p.kind = 'puff';
      this.particles.push(p);
    }

    dust() {
      const p = this.get(this.mats.mid, 'box');
      p.pos = [Math.random() * 5.8, 0.1, (Math.random() - 0.5) * 2.6]; p.vel = [-4 - Math.random() * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 4];
      p.age = 0; p.life = 0.5 + Math.random() * 0.4; p.r = 0.08 + Math.random() * 0.08; p.kind = 'bit';
      this.particles.push(p);
    }

    spark(pos, mat, sp) {
      const p = this.get(mat, 'box');
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, v = (0.3 + Math.random()) * (sp || 10);
      p.pos = pos.slice(); p.vel = [Math.cos(a) * Math.cos(b) * v, Math.abs(Math.sin(b)) * v + 2, Math.sin(a) * Math.cos(b) * v];
      p.age = 0; p.life = 0.35 + Math.random() * 0.4; p.r = 0.07; p.kind = 'bit';
      this.particles.push(p);
    }

    crash(game) {
      const T = this.T;
      this.shake = 0.5; this.flash = 0.1;
      const front = [5.4, game.car.y * U + 0.7, 0];
      for (let i = 0; i < 30; i++) this.spark(front, Math.random() < 0.5 ? this.mats.lamp : this.mats.cone, 14);
      for (let i = 0; i < 10; i++) this.puff(game, 1.8);
      // Kenney debris flies off the front of the car
      ['debris-tire', 'debris-door', 'debris-bumper', 'debris-spoiler-a', 'debris-plate-a', 'debris-bolt', 'debris-bolt'].forEach((n, i) => {
        const src = this.models[n]; if (!src) return;
        const m = src.clone(); m.scale.setScalar(1.6); m.position.set(front[0], front[1], (Math.random() - 0.5) * 2);
        this.scene.add(m);
        this.particles.push({ mesh: m, kind: 'debris', pos: [m.position.x, m.position.y, m.position.z],
          vel: [2 + Math.random() * 9, 6 + Math.random() * 7, (Math.random() - 0.5) * 9], spin: [Math.random() * 9, Math.random() * 9, Math.random() * 9], age: 0, life: 3.2 });
      });
    }

    stepParticles(game, dt) {
      const c = game.car;
      const live = game.state === 'play' || game.state === 'intro' || game.state === 'title';
      if (live) {
        const rate = c.hover ? 36 : c.burst > 0 ? 50 * c.burst : 0;
        let n = rate * dt; while (n > 0) { if (Math.random() < n) this.puff(game, c.hover ? 0.9 : 1.1); n -= 1; }
        if (c.duck && game.speed > 380 && Math.random() < dt * 30) this.spark([1 + Math.random() * 4, 0.05, (Math.random() - 0.5) * 2.4], Math.random() < 0.5 ? this.mats.lamp : this.mats.cone, 4);
      }
      const frozen = game.state === 'crashed' || game.state === 'over';
      const scroll = frozen ? 0 : game.speed * U * dt;
      for (const p of this.particles) {
        p.age += dt;
        if (p.kind === 'puff') {
          p.vel[1] *= 1 - dt * 3; p.vel[0] *= 1 - dt * (frozen ? 4 : 0.6);
          p.pos[0] += p.vel[0] * dt; p.pos[1] = Math.max(0.15, p.pos[1] + p.vel[1] * dt); p.pos[2] += p.vel[2] * dt;
          const k = p.age / p.life, s = p.r * (k < 0.3 ? 0.5 + k * 1.7 : 1.01 - (k - 0.3) * 1.2);
          p.mesh.scale.setScalar(Math.max(0.01, s));
        } else if (p.kind === 'bit') {
          p.vel[1] -= 30 * dt; p.pos[0] += p.vel[0] * dt - scroll; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt;
          if (p.pos[1] < 0.05) { p.pos[1] = 0.05; p.vel[1] *= -0.3; p.vel[0] *= 0.6; }
          p.mesh.scale.setScalar(p.r);
        } else if (p.kind === 'debris') {
          p.vel[1] -= 26 * dt; p.pos[0] += p.vel[0] * dt - scroll; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt;
          if (p.pos[1] < 0.1) { p.pos[1] = 0.1; p.vel[1] = Math.abs(p.vel[1]) * 0.35; p.vel[0] *= 0.7; p.vel[2] *= 0.7; p.spin = p.spin.map(v => v * 0.6); }
          p.mesh.rotation.x += p.spin[0] * dt; p.mesh.rotation.y += p.spin[1] * dt; p.mesh.rotation.z += p.spin[2] * dt;
        }
        p.mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.age >= p.life) { if (p.kind === 'debris') this.scene.remove(p.mesh); else p.mesh.visible = false; }
      }
      this.particles = this.particles.filter(p => p.age < p.life);
    }

    clearDebris() {
      this.particles.forEach(p => { if (p.kind === 'debris') this.scene.remove(p.mesh); else p.mesh.visible = false; });
      this.particles = [];
    }

    // ------------------------------------------------------------ frame
    setView(v) { this.view = v; }

    draw(game, dt) {
      const T = this.T;
      this.time += dt;
      this.r2d.time += dt;
      this.shake = Math.max(0, (this.shake || 0) - dt);
      this.flash = Math.max(0, (this.flash || 0) - dt);
      if (game.state === 'intro' && game.stateT < dt * 2) this.clearDebris();
      this.applyNight(game.nightMix);
      const dU = game.distance * U;
      const c = game.car;

      // car
      const cy = c.y * U;
      this.car.pivot.position.set(this.car.center[0], cy + this.car.center[1], 0);
      this.car.pivot.rotation.z = -c.rot;
      // a sideflip rolls the car over its long axis
      this.car.pivot.rotation.x = (game.state === 'falling' ? Math.sin(this.time * 7) * 0.2 : 0) + (c.roll || 0);
      const spin = c.wheel * 1.6;
      this.car.wheels.forEach(w => { w.rotation.z = -spin; });
      this.car.spoiler.position.y = 1.02 + c.spoiler * 0.28;
      this.car.body.children.forEach(ch => { if (ch.userData.wreckHide) ch.visible = !c.wreck; });
      const sq = c.duck ? -0.32 : 0;
      this.car.body.position.y = -this.car.center[1] + sq;
      this.car.wheels.forEach((w, i) => { w.position.y = 0.43 - sq; });
      if (c.wreck) { this.car.pivot.rotation.z = -c.rot - 0.08; this.car.pivot.rotation.y = 0.18; } else this.car.pivot.rotation.y = 0;
      const overGround = !game.features.some(f => f.kind === 'canyon' && 69 > f.x && 69 < f.x + f.w);
      this.car.shadow.visible = overGround && game.state !== 'falling';
      this.car.shadow.position.set(2.9, 0.04, 0);
      this.car.pivot.updateMatrixWorld(true);
      const ss = 1 / (1 + cy / 6); this.car.shadow.scale.set(3.1 * ss, 1.25 * ss, 1);

      this.sync(game);
      this.stepParticles(game, dt);

      // ground and road, cut around a canyon if one is in view
      const near = -120, far = 420;
      const can = game.features.find(f => f.kind === 'canyon' && (f.x + f.w - C.CAR_X) * U > near && (f.x - C.CAR_X) * U < far);
      const spans = can ? [[near, (can.x - C.CAR_X) * U], [(can.x + can.w - C.CAR_X) * U, far]] : [[near, far], null];
      spans.forEach((sp, i) => {
        const g = this.ground[i], r = this.road[i];
        if (!sp || sp[1] - sp[0] < 0.01) { g.visible = r.visible = false; return; }
        g.visible = r.visible = true;
        const len = sp[1] - sp[0], mid = (sp[0] + sp[1]) / 2;
        g.scale.set(len, 600, 1); g.position.set(mid, 0, 0);
        r.scale.set(len, 9, 1); r.position.set(mid, 0.02, 0);
        const gm = g.material.map, rm = r.material.map;
        if (gm) { gm.repeat.set(len / 8, 600 / 8); gm.offset.set((sp[0] + dU) / 8, 0); }
        if (rm) { rm.repeat.set(len / 4, 1); rm.offset.set((sp[0] + dU) / 4, 0); }
      });

      // poles, props, spectators and clouds scroll with the world
      const wrap = (base, period, lo) => ((base - dU) % period + period) % period + lo;
      this.poles.forEach((p, i) => { p.position.x = wrap(i * 26, 26 * this.poles.length, -60); p.visible = !this.inCanyon(game, p.position.x); });
      this.props.forEach(p => { p.position.x = wrap(p.userData.base, 360, -60); p.position.z = p.userData.z; p.visible = !this.inCanyon(game, p.position.x); });
      this.spectators.forEach(s => { s.position.x = wrap(s.userData.base, 420, -60); s.position.z = s.userData.z; s.visible = !this.inCanyon(game, s.position.x); });
      this.clouds.forEach(s => { s.position.set(((s.userData.x - dU * 0.25) % 460 + 460) % 460 - 80, s.userData.y, s.userData.z); });

      // camera
      this.updateCamera(game, dt);
      const cam = this.camera.position;
      this.backdrop.position.set(cam.x, 14, cam.z);
      this.backdrop.material.map && this.backdrop.material.map.offset.set((dU * 0.002) % 1, 0);
      this.stars.position.set(cam.x, 0, cam.z);
      const night = game.nightMix > 0.02 || this.pal.alwaysStars;
      this.moon.visible = game.nightMix > 0.3;
      this.moon.position.set(cam.x + 160, 80, cam.z - 170);

      // render to the low-res target, then dither to the palette
      this.renderer.setRenderTarget(this.rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCam);

      // HUD from the 2D renderer, drawn on its own canvas on top
      const h = this.hud; h.imageSmoothingEnabled = false;
      h.clearRect(0, 0, this.w, this.h);
      if (this.flash > 0) { h.fillStyle = 'rgba(255,255,255,0.8)'; h.fillRect(0, 0, this.w, this.h); }
      this.r2d.hud(h, this.r2d.sets[game.nightMix > 0.5 ? 1 : 0], game, this.w);
      if (!night) this.stars.visible = false;
    }

    inCanyon(game, x) {
      return game.features.some(f => f.kind === 'canyon' && x > (f.x - C.CAR_X) * U - 2 && x < (f.x + f.w - C.CAR_X) * U + 2);
    }

    updateCamera(game, dt) {
      const T = this.T;
      // title and game over: slow orbit around the car, like a showroom
      const presets = this.square ? VIEWS_SQ : VIEWS;
      let preset = presets[this.view] || presets.chase;
      let pos, look, fov = preset.fov;
      const cy = game.car.y * U;
      if (game.state === 'title' || game.state === 'over' || game.state === 'crashed') {
        const a = Math.PI / 2 + Math.sin(this.time * 0.22) * 1.05;
        const r = game.state === 'title' ? 11 : 12.5;
        pos = [2.9 - Math.cos(a) * r, 4.6 + Math.sin(this.time * 0.3) * 0.5, Math.sin(a) * r];
        look = [2.9, this.square ? 3.4 : 2.5, 0]; fov = this.square ? 54 : 40;
      } else {
        const f = preset.follow;
        pos = [preset.pos[0], preset.pos[1] + cy * f, preset.pos[2]];
        look = [preset.look[0], preset.look[1] + cy * f * 0.9, preset.look[2]];
        if (this.view === 'chase') fov = preset.fov + Math.max(0, (game.speed - 360) / 440) * 10;
      }
      if (!this.camState) this.camState = { pos: pos.slice(), look: look.slice(), fov };
      const k = Math.min(1, dt * 4);
      for (let i = 0; i < 3; i++) { this.camState.pos[i] += (pos[i] - this.camState.pos[i]) * k; this.camState.look[i] += (look[i] - this.camState.look[i]) * k; }
      this.camState.fov += (fov - this.camState.fov) * k;
      const sh = this.shake > 0 ? this.shake * 0.5 : 0;
      this.camera.position.set(this.camState.pos[0] + (Math.random() - 0.5) * sh, this.camState.pos[1] + (Math.random() - 0.5) * sh, this.camState.pos[2]);
      this.camera.lookAt(this.camState.look[0], this.camState.look[1], this.camState.look[2]);
      // with a band the camera's frame is taller, so it needs a wider angle for the same picture
      const fovFull = this.band ? 2 * Math.atan(Math.tan(this.camState.fov * Math.PI / 360) * (this.baseH + 2 * this.band) / this.baseH) * 180 / Math.PI : this.camState.fov;
      if (Math.abs(this.camera.fov - fovFull) > 0.01) { this.camera.fov = fovFull; this.camera.updateProjectionMatrix(); }
    }

    dispose() {
      this.renderer.dispose();
      this.canvas.remove(); this.hudCv.remove();
    }
  }

  Render3D.VIEWS = Object.keys(VIEWS);
  global.RRRender3D = Render3D;
})(window);
