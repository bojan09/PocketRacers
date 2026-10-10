// Engine sound: a gearbox/RPM model shared by two voices —
//  • EngineSampler: recorded engine loops (idle/low/mid/high) pitched to RPM
//    and crossfaded (the authentic sound, used when the files are present),
//  • the synthesised engine in audio.js (always-available fallback).
// The gearbox is pure logic so it is unit-tested.

export class Gearbox {
  constructor({ idle = 900, redline = 7200, shiftUp = 6500, shiftDown = 3300, tops = [0.2, 0.36, 0.52, 0.68, 0.84, 1.0] } = {}) {
    this.idle = idle;
    this.redline = redline;
    this.shiftUp = shiftUp;
    this.shiftDown = shiftDown;
    this.tops = tops; // speed fraction (of max) reached at redline in each gear
    this.gear = 0;
    this.rpm = idle;
    this.shiftTimer = 0;
    this.time = 0;
  }

  rpmFor(speedFrac, gear) {
    return this.idle + (Math.abs(speedFrac) / this.tops[gear]) * (this.redline - this.idle) * 0.92;
  }

  /**
   * @param {number} speedFrac  |speed| / maxSpeed (can exceed 1 with nitro)
   * @param {number} throttle   0..1
   * @param {boolean} freeRev   wheels not driving (airborne)
   * @returns {{rpm:number, gear:number, shifted:number}} shifted: +1 up, -1 down, 0 none
   */
  update(dt, speedFrac, throttle, freeRev = false) {
    let shifted = 0;
    this.time += dt;
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const last = this.tops.length - 1;
    if (this.shiftTimer <= 0) {
      if (this.gear < last && this.rpmFor(speedFrac, this.gear) > this.shiftUp) {
        this.gear++;
        shifted = 1;
        this.shiftTimer = 0.35;
      } else if (this.gear > 0 && this.rpmFor(speedFrac, this.gear) < this.shiftDown && this.rpmFor(speedFrac, this.gear - 1) < this.shiftUp - 400) {
        this.gear--;
        shifted = -1;
        this.shiftTimer = 0.35;
      }
    }
    let target = freeRev ? this.idle + throttle * (this.redline - this.idle) * 0.85 : Math.max(this.idle + throttle * 350, this.rpmFor(speedFrac, this.gear));
    // Rev limiter bounce at the top of the last gear (nitro).
    if (target > this.redline) target = this.redline - (Math.sin(this.time * 40) > 0 ? 250 : 0);
    // Engines rev up faster than they fall; a shift drops the revs quickly.
    const rate = target > this.rpm ? 9 : shifted ? 30 : 6;
    this.rpm += (target - this.rpm) * Math.min(1, dt * rate);
    return { rpm: this.rpm, gear: this.gear, shifted };
  }
}

// Engine sound profiles, one per vehicle family's engine type. `cyl` sets
// the firing frequency, `lope` the sub-harmonic (V8 burble), `filter` the
// tone [base Hz, Hz per rpm, extra Hz at full throttle], `drive` the grit.
export const ENGINE_PROFILES = {
  i4: { cyl: 4, idle: 950, redline: 7600, shiftUp: 6900, shiftDown: 3600, lope: 0.5, filter: [320, 0.36, 1000], drive: 2.4, gain: 0.9 },
  flat6: { cyl: 6, idle: 900, redline: 8200, shiftUp: 7600, shiftDown: 4200, lope: 0.5, filter: [300, 0.33, 1100], drive: 2.6, gain: 1, crackle: true },
  v8: { cyl: 8, idle: 750, redline: 6800, shiftUp: 6200, shiftDown: 3200, tops: [0.24, 0.42, 0.6, 0.8, 1], lope: 0.25, filter: [200, 0.22, 700], drive: 3.2, gain: 1.15, crackle: true },
  v10: { cyl: 10, idle: 1300, redline: 9500, shiftUp: 9000, shiftDown: 5500, tops: [0.18, 0.3, 0.42, 0.55, 0.68, 0.83, 1], lope: 0.5, filter: [400, 0.4, 1400], drive: 2.4, gain: 0.95, crackle: true },
  v6: { cyl: 6, idle: 800, redline: 6200, shiftUp: 5600, shiftDown: 2800, tops: [0.24, 0.42, 0.6, 0.8, 1], lope: 0.5, filter: [240, 0.26, 800], drive: 2.6, gain: 1 },
  v8truck: { cyl: 8, idle: 700, redline: 6000, shiftUp: 5400, shiftDown: 2600, tops: [0.24, 0.42, 0.6, 0.8, 1], lope: 0.25, filter: [190, 0.22, 650], drive: 3, gain: 1.1 },
  monster: { cyl: 8, idle: 650, redline: 6200, shiftUp: 5600, shiftDown: 2800, tops: [0.3, 0.55, 0.8, 1], lope: 0.25, filter: [160, 0.2, 600], drive: 3.8, gain: 1.25, crackle: true },
  bike: { cyl: 2, idle: 1200, redline: 11000, shiftUp: 10200, shiftDown: 6000, tops: [0.2, 0.36, 0.52, 0.68, 0.84, 1], lope: 0.7, filter: [420, 0.45, 1600], drive: 2.2, gain: 0.85 },
  diesel: { cyl: 6, idle: 600, redline: 2500, shiftUp: 2250, shiftDown: 1300, tops: [0.08, 0.14, 0.21, 0.29, 0.38, 0.48, 0.59, 0.72, 0.86, 1], lope: 0.5, filter: [150, 0.35, 500], drive: 3.5, gain: 1.25, whistle: true, airBrake: true },
};

/**
 * Recorded-engine player. manifest.json lists loops recorded at known RPMs,
 * per engine profile:
 *   { "profiles": { "v8": { "layers": [ { "file": "v8/idle.wav", "rpm": 750 }, ... ], "gain": 1 } } }
 * Loops play continuously; each frame the two layers nearest the current
 * RPM are crossfaded (equal power) and every layer is pitched by
 * rpm / recordedRpm so the engine sweeps smoothly through the rev range.
 */
export class EngineSampler {
  constructor(ac, destination, baseUrl) {
    this.ac = ac;
    this.destination = destination;
    this.baseUrl = baseUrl;
    this.layers = [];
    this.ready = false;
    this.out = ac.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
  }

  async load(profile) {
    try {
      const res = await fetch(`${this.baseUrl}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return false;
      const manifest = (await res.json()).profiles?.[profile];
      if (!manifest || this.disposed) return false;
      const defs = (manifest.layers || []).filter((l) => l.file && l.rpm > 0).sort((a, b) => a.rpm - b.rpm);
      if (!defs.length) return false;
      const buffers = await Promise.all(
        defs.map(async (l) => {
          const data = await (await fetch(this.baseUrl + l.file)).arrayBuffer();
          return this.ac.decodeAudioData(data);
        }),
      );
      if (this.disposed) return false;
      this.gainScale = manifest.gain ?? 1;
      this.layers = defs.map((l, i) => {
        const src = this.ac.createBufferSource();
        src.buffer = buffers[i];
        src.loop = true;
        if (l.loopStart !== undefined) src.loopStart = l.loopStart;
        if (l.loopEnd !== undefined) src.loopEnd = l.loopEnd;
        const g = this.ac.createGain();
        g.gain.value = 0;
        src.connect(g).connect(this.out);
        src.start(0, Math.random() * buffers[i].duration * 0.5);
        return { rpm: l.rpm, src, gain: g };
      });
      this.ready = true;
      return true;
    } catch {
      return false; // missing / undecodable files: the synth stays in use
    }
  }

  update(rpm, throttle, volume) {
    if (!this.ready) return;
    const t = this.ac.currentTime;
    const L = this.layers;
    // Find the pair of layers around the current RPM.
    let hi = L.findIndex((l) => l.rpm >= rpm);
    if (hi === -1) hi = L.length - 1;
    const lo = Math.max(0, hi - 1);
    const span = L[hi].rpm - L[lo].rpm;
    const mix = span > 0 ? Math.min(1, Math.max(0, (rpm - L[lo].rpm) / span)) : 1;
    L.forEach((l, i) => {
      let w = 0;
      if (i === lo && i === hi) w = 1;
      else if (i === lo) w = Math.cos((mix * Math.PI) / 2);
      else if (i === hi) w = Math.sin((mix * Math.PI) / 2);
      l.gain.gain.setTargetAtTime(w, t, 0.04);
      l.src.playbackRate.setTargetAtTime(Math.min(2.2, Math.max(0.5, rpm / l.rpm)), t, 0.03);
    });
    this.out.gain.setTargetAtTime(volume * this.gainScale * (0.65 + 0.35 * throttle), t, 0.05);
  }

  dispose() {
    this.disposed = true;
    for (const l of this.layers) l.src.stop();
    this.out.disconnect();
    this.ready = false;
  }

  silence() {
    if (this.ready) this.out.gain.setTargetAtTime(0, this.ac.currentTime, 0.05);
  }
}
