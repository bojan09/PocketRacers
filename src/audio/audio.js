// Synthesised audio (Web Audio API) — no sound files needed. The context is
// created/resumed only after a user gesture, as mobile browsers require.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.ready = false;
  }

  /** Call from a user gesture (tap). Safe to call repeatedly. */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.ready = true;
  }

  build() {
    const ac = this.ctx;
    this.master = ac.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ac.destination);

    // Engine: two detuned oscillators through a low-pass filter.
    this.engineGain = ac.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ac.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 4;
    this.osc1 = ac.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ac.createOscillator();
    this.osc2.type = 'square';
    const o2g = ac.createGain();
    o2g.gain.value = 0.35;
    this.osc1.connect(this.engineFilter);
    this.osc2.connect(o2g).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.osc1.start();
    this.osc2.start();

    // Shared noise source for nitro hiss, tyre scrub and impacts.
    const len = ac.sampleRate;
    this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.nitroGain = this.loopNoise('bandpass', 1800, 0.8);
    this.skidGain = this.loopNoise('bandpass', 900, 3);
    this.scrapeGain = this.loopNoise('highpass', 3000, 1);
  }

  loopNoise(type, freq, q) {
    const ac = this.ctx;
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Silence continuous sounds (pause menu). */
  quiet() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [this.engineGain, this.nitroGain, this.skidGain, this.scrapeGain]) g.gain.setTargetAtTime(0, t, 0.05);
  }

  /** Per-frame update from the player state. */
  update(player, maxSpeed, throttle) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const sp = Math.min(1.5, Math.abs(player.speed) / maxSpeed);
    // Fake gearbox: rpm climbs within each of five gears.
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(sp * gears));
    const inGear = sp * gears - g;
    const rpm = 0.25 + inGear * 0.6 + g * 0.05;
    const f = 55 + rpm * 120 + (player.nitro ? 25 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.03);
    this.engineFilter.frequency.setTargetAtTime(500 + rpm * 1400 + throttle * 400, t, 0.05);
    this.engineGain.gain.setTargetAtTime(0.09 + throttle * 0.06 + sp * 0.03, t, 0.05);
    this.nitroGain.gain.setTargetAtTime(player.nitro ? 0.22 : 0, t, 0.06);
    this.skidGain.gain.setTargetAtTime(player.sliding ? 0.18 : 0, t, 0.05);
    this.scrapeGain.gain.setTargetAtTime(player.scraping ? 0.12 : 0, t, 0.04);
  }

  onEvent(e) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (e.type === 'hit' || e.type === 'bump') this.thump(Math.max(0.25, Math.min(1, e.strength)));
    else if (e.type === 'lap') this.chime(e.best);
    else if (e.type === 'land') this.thump(0.25 + e.strength * 0.6);
    else if (e.type === 'takeoff') this.whoosh(300, 1400, 0.35, 0.18);
    else if (e.type === 'boost') this.boost();
    else if (e.type === 'score') {
      if (e.kind === 'star') this.blip(1320, e.combo);
      else if (e.kind === 'nearMiss') this.whoosh(500, 2600, 0.4, 0.3);
      else if (e.kind === 'smash') this.clack();
      if (e.kind === 'jump' || e.kind === 'drift' || e.combo >= 3) this.comboDing(e.combo);
    }
  }

  /** Bright two-note pickup, a little higher with each combo step. */
  blip(freq, combo = 1) {
    const ac = this.ctx;
    const k = Math.pow(2, Math.min(combo - 1, 6) / 12);
    [freq * k, freq * k * 1.335].forEach((f, i) => {
      const t = ac.currentTime + i * 0.06;
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.25);
    });
  }

  /** Filtered-noise sweep (near misses, take-offs). */
  whoosh(f0, f1, dur, vol) {
    const ac = this.ctx;
    const t = ac.currentTime;
    const n = ac.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.02);
  }

  boost() {
    const ac = this.ctx;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.5);
    this.whoosh(600, 3000, 0.45, 0.2);
  }

  /** Plastic cone knock: short bright click + low thud. */
  clack() {
    const ac = this.ctx;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
    this.thump(0.3);
  }

  /** Rising arpeggio that climbs with the combo level. */
  comboDing(combo) {
    const ac = this.ctx;
    const base = 523.25 * Math.pow(2, Math.min(combo - 1, 4) * (2 / 12));
    [1, 1.26, 1.5].forEach((m, i) => {
      const t = ac.currentTime + 0.05 + i * 0.07;
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base * m;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.32);
    });
  }

  thump(strength) {
    const ac = this.ctx;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.26);
    const n = ac.createBufferSource();
    n.buffer = this.noiseBuf;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.25 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    n.connect(ng).connect(this.master);
    n.start(t);
    n.stop(t + 0.16);
  }

  chime(best) {
    const ac = this.ctx;
    const notes = best ? [660, 880, 1320] : [660, 880];
    notes.forEach((freq, i) => {
      const t = ac.currentTime + i * 0.1;
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.4);
    });
  }

  click() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.06);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.09);
  }
}
