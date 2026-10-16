/* Roadster Run: sound. Sampled effects and music come from CC0 packs
   (Juhani Junkala, Kenney). The electric motor whine is synthesized live. */
(function (global) {
  'use strict';
  const SFX = ['jump', 'land', 'canister', 'milestone', 'trick', 'start', 'crash', 'clang', 'boom',
    'alarm', 'fall', 'thrust', 'pause_in', 'pause_out', 'tick'];

  class AudioMan {
    constructor(base) {
      this.base = base; this.ctx = null; this.buf = {};
      this.muted = false; this.musicOn = true; this.want = null; this.tracks = {}; this.current = null;
    }

    // Browsers only allow sound after a tap or key press, so this runs on the first one.
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
      this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.42 : 0; this.mus.connect(this.master);
      SFX.forEach(n => {
        fetch(this.base + 'sfx/' + n + '.wav').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
          .then(buf => { this.buf[n] = buf; if (n === 'thrust') this.startThrust(); }).catch(() => {});
      });
      // electric motor whine: two detuned oscillators through a low-pass filter
      this.whineGain = ctx.createGain(); this.whineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 6;
      this.osc = [ctx.createOscillator(), ctx.createOscillator()];
      this.osc[0].type = 'sawtooth'; this.osc[1].type = 'square';
      this.osc.forEach((o, i) => { o.frequency.value = 220 + i * 3; o.connect(lp); o.start(); });
      lp.connect(this.whineGain); this.whineGain.connect(this.sfx);
      this.setMuted(this.muted);
      if (this.want) { const w = this.want; this.want = null; this.music(w); }
    }

    play(name, o) {
      o = o || {};
      const b = this.buf[name];
      if (!this.ctx || !b) return;
      const s = this.ctx.createBufferSource(); s.buffer = b;
      s.playbackRate.value = o.rate || 1;
      const g = this.ctx.createGain(); g.gain.value = o.vol === undefined ? 1 : o.vol;
      s.connect(g); g.connect(this.sfx); s.start();
    }

    startThrust() {
      const ctx = this.ctx;
      const s = ctx.createBufferSource(); s.buffer = this.buf.thrust; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 500;
      this.thrustGain = ctx.createGain(); this.thrustGain.gain.value = 0;
      s.connect(bp); bp.connect(this.thrustGain); this.thrustGain.connect(this.sfx); s.start();
    }

    setThrust(level) {
      if (this.thrustGain) this.thrustGain.gain.setTargetAtTime(level * 0.55, this.ctx.currentTime, 0.05);
    }

    setWhine(norm, on) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, f = 160 + norm * 560;
      this.osc[0].frequency.setTargetAtTime(f, t, 0.1);
      this.osc[1].frequency.setTargetAtTime(f * 1.5 + 2, t, 0.1);
      this.whineGain.gain.setTargetAtTime(on ? 0.018 + norm * 0.012 : 0, t, 0.08);
    }

    music(name) {
      if (!this.ctx) { this.want = name; return; }
      if (this.currentName === name) return;
      if (this.current) { this.current.pause(); this.current = null; }
      this.currentName = name;
      if (!name) return;
      let el = this.tracks[name];
      if (!el) {
        el = new Audio(); el.crossOrigin = 'anonymous'; el.src = this.base + 'music/' + name + '.mp3'; el.loop = true; el.preload = 'auto';
        try { this.ctx.createMediaElementSource(el).connect(this.mus); } catch (e) { el.volume = 0.4; }
        this.tracks[name] = el;
      }
      el.currentTime = 0;
      this.current = el;
      const p = el.play(); if (p && p.catch) p.catch(() => {});
    }

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }

    setMusicOn(on) {
      this.musicOn = on;
      if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.05);
    }
  }

  global.RRAudio = AudioMan;
})(window);
