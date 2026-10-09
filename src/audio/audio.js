// Game audio (Web Audio API). Engine: recorded loops when present
// (assets/audio/engine/), otherwise a synthesised engine; effects are
// synthesised. The context is created/resumed only after a user gesture, as
// mobile browsers require.

import { Gearbox, EngineSampler, ENGINE_PROFILES } from './engine.js';

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.ready = false;
    this.engineId = 'flat6';
  }

  /** Switch the engine sound (vehicle change). */
  setEngine(id) {
    this.engineId = ENGINE_PROFILES[id] ? id : 'flat6';
    this.profile = ENGINE_PROFILES[this.engineId];
    if (!this.ctx) return;
    const P = this.profile;
    this.gearbox = new Gearbox(P);
    this.drive.curve = driveCurve(P.drive);
    this.sampler?.dispose();
    this.useSamples = false;
    this.sampler = new EngineSampler(this.ctx, this.master, 'assets/audio/engine/');
    const sampler = this.sampler;
    sampler.load(this.engineId).then((ok) => {
      if (sampler === this.sampler) this.useSamples = ok;
    });
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

    // Synthesised engine (fallback): firing-rate sawtooth, half-rate square
    // and sub sine, soft-clipped for grit, through an RPM-tracking low-pass.
    this.engineGain = ac.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ac.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 2.2;
    const drive = ac.createWaveShaper();
    this.drive = drive;
    const mixIn = ac.createGain();
    mixIn.gain.value = 0.6;
    this.osc1 = ac.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ac.createOscillator();
    this.osc2.type = 'square';
    this.osc3 = ac.createOscillator();
    this.osc3.type = 'sine';
    const g2 = ac.createGain();
    g2.gain.value = 0.4;
    const g3 = ac.createGain();
    g3.gain.value = 0.8;
    this.osc1.connect(mixIn);
    this.osc2.connect(g2).connect(mixIn);
    this.osc3.connect(g3).connect(mixIn);
    mixIn.connect(drive).connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    for (const o of [this.osc1, this.osc2, this.osc3]) o.start();

    // Turbo whistle (diesel trucks).
    this.whistle = ac.createOscillator();
    this.whistle.type = 'sine';
    this.whistleGain = ac.createGain();
    this.whistleGain.gain.value = 0;
    this.whistle.connect(this.whistleGain).connect(this.master);
    this.whistle.start();
    this.lastThrottle = 0;

    // Shared noise source for nitro hiss, tyre scrub and impacts.
    const len = ac.sampleRate;
    this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.nitroGain = this.loopNoise('bandpass', 1800, 0.8);
    this.skidGain = this.loopNoise('bandpass', 900, 3);
    this.scrapeGain = this.loopNoise('highpass', 3000, 1);
    this.setEngine(this.engineId);
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

  /** Turbo blow-off hiss plus a few exhaust crackles. */
  liftOff() {
    const now = this.ctx.currentTime;
    if (this.lastLift && now - this.lastLift < 0.8) return;
    this.lastLift = now;
    this.whoosh(2400, 900, 0.35, 0.09);
    if (!this.profile.crackle) return;
    for (let i = 0; i < 4; i++) {
      const t = now + 0.08 + i * 0.07 + Math.random() * 0.05;
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f).connect(g).connect(this.master);
      n.start(t, Math.random() * 0.5);
      n.stop(t + 0.06);
    }
  }

  /** Silence continuous sounds (pause menu). */
  quiet() {
    if (!this.ctx) return;
    this.sampler?.silence();
    const t = this.ctx.currentTime;
    for (const g of [this.engineGain, this.nitroGain, this.skidGain, this.scrapeGain, this.whistleGain]) g.gain.setTargetAtTime(0, t, 0.05);
  }

  /** Per-frame update from the player state. */
  update(player, maxSpeed, throttle, dt = 1 / 60) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const sp = Math.abs(player.speed) / maxSpeed;
    const thr = player.nitro ? 1 : throttle;
    const gb = this.gearbox.update(Math.min(dt, 0.1), sp, thr, player.airborne);
    const rpm = gb.rpm;
    const rpmFrac = (rpm - this.gearbox.idle) / (this.gearbox.redline - this.gearbox.idle);
    // Upshift: a brief torque cut you can hear.
    const dip = gb.shifted === 1 && thr > 0.5 ? 0.45 : 1;
    const P = this.profile;
    // Lifting off at high revs: turbo blow-off and a few exhaust pops.
    if (this.lastThrottle > 0.6 && thr < 0.2 && rpmFrac > 0.55) this.liftOff();
    this.lastThrottle = thr;
    // Trucks hiss their air brakes when coming to a stop.
    if (P.airBrake && this.wasBraking && !player.braking && sp < 0.15) this.whoosh(5000, 3000, 0.5, 0.12);
    this.wasBraking = player.braking;
    this.whistleGain.gain.setTargetAtTime(P.whistle ? 0.012 + 0.03 * rpmFrac * thr : 0, t, 0.1);
    if (P.whistle) this.whistle.frequency.setTargetAtTime(1800 + rpmFrac * 2600, t, 0.15);

    if (this.useSamples) {
      this.sampler.update(rpm, thr, 0.55 * dip);
      this.engineGain.gain.setTargetAtTime(0, t, 0.05);
    } else {
      const f = (rpm / 60) * (P.cyl / 2); // firings per second
      this.osc1.frequency.setTargetAtTime(f, t, 0.025);
      this.osc2.frequency.setTargetAtTime(f * P.lope + 0.7, t, 0.025);
      this.osc3.frequency.setTargetAtTime(f * 0.5, t, 0.025);
      this.engineFilter.frequency.setTargetAtTime(P.filter[0] + rpm * P.filter[1] + thr * P.filter[2], t, 0.04);
      const gain = (0.07 + thr * 0.07 + rpmFrac * 0.04) * dip * P.gain;
      if (dip < 1) {
        this.engineGain.gain.setValueAtTime(gain, t);
        this.engineGain.gain.setTargetAtTime(gain / dip, t + 0.08, 0.05);
      } else {
        this.engineGain.gain.setTargetAtTime(gain, t, 0.04);
      }
    }
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
    else if (e.type === 'super') this.superBoost();
    else if (e.type === 'superReady') this.chime(true);
    else if (e.type === 'animal') this.ui(e.first ? 'buy' : 'open');
    else if (e.type === 'finish' && e.place <= 3) this.fanfare(e.place);
    else if (e.type === 'score') {
      if (e.kind === 'star') this.blip(1320, e.combo);
      else if (e.kind === 'nearMiss') this.whoosh(500, 2600, 0.4, 0.3);
      else if (e.kind === 'smash') this.clack();
      else if (e.kind === 'knock') this.thump(0.6);
      else if (e.kind === 'prop') {
        this.thump(0.5);
        this.clack();
      }
      else if (e.kind === 'trick') this.comboDing(Math.max(3, e.combo + 2));
      if (e.kind === 'jump' || e.kind === 'drift' || (e.combo >= 3 && e.kind !== 'trick')) this.comboDing(e.combo);
    }
  }

  /** Victory fanfare: ta-ta-ta-taaa (shorter for 2nd and 3rd). */
  fanfare(place = 1) {
    const ac = this.ctx;
    const notes =
      place === 1
        ? [
            [523, 0, 0.12],
            [523, 0.14, 0.12],
            [523, 0.28, 0.12],
            [659, 0.42, 0.22],
            [784, 0.66, 0.6],
          ]
        : [
            [523, 0, 0.14],
            [659, 0.16, 0.14],
            [784, 0.32, 0.45],
          ];
    for (const [freq, at, len] of notes) {
      for (const [type, mult, vol] of [
        ['square', 1, 0.05],
        ['triangle', 2, 0.07],
      ]) {
        const t = ac.currentTime + at;
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.value = freq * mult;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.setValueAtTime(vol, t + len * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + len + 0.02);
      }
    }
  }

  /** A firework bursting: crackly pop. */
  pop() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const n = ac.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.52);
  }

  /** Car horn: two detuned reeds, deeper on big vehicles. */
  honk(family) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const pitch = family === 'truck' ? [196, 247] : family === 'monster' || family === 'pickup' ? [262, 330] : [392, 494];
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
    g.gain.setValueAtTime(0.11, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    f.connect(g).connect(this.master);
    for (const freq of pitch) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.45);
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

  /** Super Nitro: deep boom, a rising sweep and a bright major chord. */
  superBoost() {
    const ac = this.ctx;
    const t = ac.currentTime;
    this.thump(1);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.9);
    this.whoosh(500, 4000, 0.8, 0.25);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const tt = t + 0.15 + i * 0.06;
      const n = ac.createOscillator();
      n.type = 'triangle';
      n.frequency.value = freq;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.0001, tt);
      ng.gain.exponentialRampToValueAtTime(0.12, tt + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.001, tt + 0.6);
      n.connect(ng).connect(this.master);
      n.start(tt);
      n.stop(tt + 0.65);
    });
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

  /**
   * Menu sounds that carry meaning without reading: 'back', 'nope' (locked
   * or not enough stars), 'buy' (unlock/upgrade) and 'open'.
   */
  ui(kind) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const SOUNDS = {
      back: { type: 'triangle', notes: [700, 470], step: 0.07, len: 0.1, vol: 0.12 },
      nope: { type: 'square', notes: [220, 165], step: 0.14, len: 0.13, vol: 0.06 },
      buy: { type: 'triangle', notes: [523, 659, 784, 1047, 1319], step: 0.065, len: 0.25, vol: 0.14 },
      open: { type: 'triangle', notes: [520, 780], step: 0.06, len: 0.1, vol: 0.12 },
    };
    const sd = SOUNDS[kind];
    if (!sd) return this.click();
    const ac = this.ctx;
    sd.notes.forEach((freq, i) => {
      const t = ac.currentTime + i * sd.step;
      const o = ac.createOscillator();
      o.type = sd.type;
      o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(sd.vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + sd.len);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + sd.len + 0.02);
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

function driveCurve(amount) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}
