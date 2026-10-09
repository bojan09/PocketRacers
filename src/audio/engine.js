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

/**
 * Recorded-engine player. manifest.json lists loops recorded at known RPMs:
 *   { "layers": [ { "file": "idle.wav", "rpm": 900 }, ... ], "gain": 1 }
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

  async load() {
    try {
      const res = await fetch(`${this.baseUrl}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return false;
      const manifest = await res.json();
      const defs = (manifest.layers || []).filter((l) => l.file && l.rpm > 0).sort((a, b) => a.rpm - b.rpm);
      if (!defs.length) return false;
      const buffers = await Promise.all(
        defs.map(async (l) => {
          const data = await (await fetch(this.baseUrl + l.file)).arrayBuffer();
          return this.ac.decodeAudioData(data);
        }),
      );
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

  silence() {
    if (this.ready) this.out.gain.setTargetAtTime(0, this.ac.currentTime, 0.05);
  }
}
