// Engine voice: a small physical-ish model rendered sample by sample.
//
// Each cylinder fires once every two crank turns. A firing sends a pulse
// down the exhaust: a short ringing thump plus a burst of combustion
// noise (and, on diesels, a sharp knock). The pulses go through the
// exhaust's resonances and the muffler (a low-pass that opens with revs
// and throttle). Intake roar, gear or supercharger whine and a soft
// clipper are mixed on top. Uneven firing (cross-plane V8, V-twin) and
// cylinder-to-cylinder differences give each engine its own beat.
//
// Pure JS with no Web Audio dependency: runs inside an AudioWorklet in
// the game and in Node for tests and for rendering WAV previews.

/**
 * Voice settings per engine type (see ENGINE_PROFILES in engine.js for the
 * matching rev ranges):
 *  cyl        cylinders; offsets = firing points in the 2-turn cycle (0..1)
 *  pattern    loudness of each cylinder's pulse (uneven = lope)
 *  ring, decay  pulse ringing (Hz) and decay (s)
 *  res        exhaust resonances [Hz, Q, level]
 *  muffler    low-pass [base Hz, Hz per rpm, extra Hz at full throttle]
 *  noise      combustion noise in each pulse; knock = diesel clatter
 *  intake     induction roar [level, Hz]; whine = [x crank speed, level]
 *  drive      soft-clip amount; level = output trim
 *  jake       engine brake: hard pulses when lifting off at revs (big trucks)
 */
export const VOICES = {
  i4: { cyl: 4, pattern: [1, 0.93, 1, 0.95], ring: 190, decay: 0.006, res: [[380, 2, 1], [1500, 3, 0.45]], muffler: [800, 0.24, 900], noise: 0.3, knock: 0, intake: [0.28, 2300], whine: null, drive: 1.8, level: 0.62 },
  flat6: { cyl: 6, pattern: [1, 0.96, 0.99, 0.94, 1, 0.97], ring: 270, decay: 0.0045, res: [[480, 2.5, 1], [1900, 3, 0.55]], muffler: [1100, 0.34, 1200], noise: 0.22, knock: 0, intake: [0.32, 2900], whine: null, drive: 2.1, level: 0.67 },
  v8: { cyl: 8, pattern: [1, 0.6, 0.92, 0.68, 1, 0.58, 0.86, 0.7], ring: 120, decay: 0.009, res: [[170, 1.4, 1], [680, 2, 0.4]], muffler: [460, 0.15, 700], noise: 0.36, knock: 0, intake: [0.24, 1600], whine: null, drive: 2.6, level: 0.85 },
  v10: { cyl: 10, pattern: [1, 0.97, 0.99, 0.96, 1, 0.98, 0.97, 1, 0.96, 0.99], ring: 390, decay: 0.0026, res: [[720, 3, 1], [2700, 3, 0.6]], muffler: [1900, 0.4, 1500], noise: 0.16, knock: 0, intake: [0.38, 3300], whine: [3.1, 0.05], drive: 2, level: 0.61 },
  v6: { cyl: 6, pattern: [1, 0.84, 0.95, 0.8, 1, 0.88], ring: 160, decay: 0.007, res: [[260, 2, 1], [1000, 2.5, 0.4]], muffler: [650, 0.2, 800], noise: 0.3, knock: 0, intake: [0.24, 1800], whine: null, drive: 2.2, level: 0.67 },
  v8truck: { cyl: 8, pattern: [1, 0.55, 0.9, 0.62, 1, 0.52, 0.84, 0.66], ring: 100, decay: 0.011, res: [[140, 1.4, 1], [560, 2, 0.4]], muffler: [400, 0.13, 600], noise: 0.4, knock: 0, intake: [0.2, 1400], whine: null, drive: 2.8, level: 0.92 },
  monster: { cyl: 8, pattern: [1, 0.5, 0.88, 0.6, 1, 0.5, 0.82, 0.62], ring: 85, decay: 0.012, res: [[120, 1.3, 1], [480, 2, 0.45]], muffler: [360, 0.12, 650], noise: 0.45, knock: 0, intake: [0.22, 1300], whine: [2.6, 0.09], drive: 3.2, level: 1.15 },
  bike: { cyl: 2, offsets: [0, 0.4375], pattern: [1, 0.9], ring: 150, decay: 0.01, res: [[230, 2, 1], [950, 2, 0.5]], muffler: [560, 0.2, 900], noise: 0.42, knock: 0, intake: [0.3, 1500], whine: null, drive: 2.4, level: 0.79 },
  diesel: { cyl: 6, pattern: [1, 0.92, 0.97, 0.9, 1, 0.94], ring: 90, decay: 0.013, res: [[130, 1.5, 1], [520, 2, 0.5]], muffler: [330, 0.3, 450], noise: 0.5, knock: 0.55, intake: [0.18, 900], whine: null, drive: 2.8, level: 0.95, jake: true },
  bus: { cyl: 6, pattern: [1, 0.95, 0.98, 0.94, 1, 0.96], ring: 105, decay: 0.012, res: [[150, 1.5, 1], [600, 2, 0.45]], muffler: [360, 0.28, 420], noise: 0.42, knock: 0.32, intake: [0.16, 1000], whine: null, drive: 2.4, level: 0.75 },
  tractor: { cyl: 3, pattern: [1, 0.78, 0.9], ring: 70, decay: 0.018, res: [[105, 1.5, 1], [420, 2, 0.6]], muffler: [300, 0.35, 380], noise: 0.55, knock: 0.7, intake: [0.12, 800], whine: null, drive: 3, level: 1.05 },
};

/** Small, stable differences between vehicles sharing an engine type. */
export function voiceVariant(vehicleId = '', override = {}) {
  let h = 2166136261;
  for (let i = 0; i < vehicleId.length; i++) h = Math.imul(h ^ vehicleId.charCodeAt(i), 16777619);
  const r = ((h >>> 0) % 1000) / 1000;
  return { pitch: 0.93 + r * 0.14, rough: 0.9 + ((r * 7.3) % 1) * 0.2, ...override };
}

// RBJ biquad (direct form I).
class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = this.b2 = this.a1 = this.a2 = 0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }

  set(type, f, q, sr) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    if (type === 'lp') {
      this.b0 = (1 - cos) / 2 / a0;
      this.b1 = (1 - cos) / a0;
      this.b2 = this.b0;
    } else if (type === 'hp') {
      this.b0 = (1 + cos) / 2 / a0;
      this.b1 = -(1 + cos) / a0;
      this.b2 = this.b0;
    } else {
      // band-pass, 0 dB peak
      this.b0 = alpha / a0;
      this.b1 = 0;
      this.b2 = -alpha / a0;
    }
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const MAX_PULSES = 24;

export class EngineVoice {
  constructor(sampleRate = 48000, seed = 1) {
    this.sr = sampleRate;
    this.seed = seed >>> 0 || 1;
    this.phase = 0; // position in the 2-turn cycle, 0..1
    this.whinePhase = 0;
    this.pulses = [];
    this.res = [new Biquad(), new Biquad()];
    this.muffler = new Biquad();
    this.muffler2 = new Biquad();
    this.knockHp = new Biquad().set('hp', 2500, 0.7, sampleRate);
    this.intakeBp = new Biquad();
    this.dc = new Biquad().set('hp', 25, 0.7, sampleRate);
    this.gain = 0;
    this.rpm = 900;
    this.throttle = 0;
    this.overrun = 0;
    this.setProfile('flat6');
  }

  rand() {
    // xorshift32: cheap, deterministic noise
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 4294967296) * 2 - 1;
  }

  setProfile(id, variant = {}) {
    const V = VOICES[id] || VOICES.flat6;
    this.V = V;
    this.pitch = variant.pitch ?? 1;
    this.rough = variant.rough ?? 1;
    this.offsets = V.offsets || Array.from({ length: V.cyl }, (_, k) => k / V.cyl);
    V.res.forEach(([f, q], i) => this.res[i].set('bp', f * this.pitch, q, this.sr));
    if (V.intake) this.intakeBp.set('bp', V.intake[1] * this.pitch, 1.2, this.sr);
    this.tuned = -1;
  }

  /**
   * Fill `out` with samples.
   * @param rpm       engine speed
   * @param throttle  0..1 (load)
   * @param gain      output volume (smoothed here)
   * @param rpmFrac   0..1 position in the rev range (for tone and whine)
   */
  render(out, rpm, throttle, gain, rpmFrac = 0.5) {
    const V = this.V;
    const sr = this.sr;
    const n = out.length;
    // Muffler opens with revs and throttle; retune only when it moved.
    const cut = V.muffler[0] + rpm * V.muffler[1] + throttle * V.muffler[2];
    if (Math.abs(cut - this.tuned) > 15) {
      this.muffler.set('lp', cut * this.pitch, 0.9, sr);
      this.muffler2.set('lp', cut * 1.6 * this.pitch, 0.7, sr);
      this.tuned = cut;
    }
    const cycle = rpm / 120; // 2-turn cycles per second
    const dPhase = cycle / sr;
    // The pulse rings at the engine's own pitch, but never far below the
    // firing rate (slow-ringing pulses that overlap would cancel out).
    const ring = Math.max(V.ring * this.pitch * (0.85 + 0.35 * rpmFrac), cycle * V.cyl * 0.9);
    const w = (2 * Math.PI * ring) / sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    // Pulses may overlap the next couple (a continuous roar at high revs).
    const decay = Math.min(V.decay, 2 / (cycle * V.cyl));
    const kDecay = Math.exp(-1 / (decay * sr));
    const kNoise = Math.exp(-1 / (decay * 0.6 * sr));
    const kKnock = Math.exp(-1 / (0.0012 * sr));
    // Lifting off at revs: overrun (quiet, popping) or a big truck's engine brake.
    const lifting = throttle < 0.15 && rpmFrac > 0.3;
    this.overrun += ((lifting ? 1 : 0) - this.overrun) * Math.min(1, n / (0.15 * sr));
    const load = 0.5 + 0.5 * throttle;
    const jake = V.jake ? this.overrun : 0;
    const whineStep = V.whine ? (2 * Math.PI * (rpm / 60) * V.whine[0]) / sr : 0;
    const whineAmp = V.whine ? V.whine[1] * rpmFrac * rpmFrac * (0.4 + 0.6 * throttle) : 0;
    const intakeAmp = V.intake ? V.intake[0] * throttle * Math.pow(rpmFrac, 1.4) : 0;
    const gStep = (gain - this.gain) / n;
    const P = this.pulses;
    for (let i = 0; i < n; i++) {
      const prev = this.phase;
      this.phase += dPhase;
      if (this.phase >= 1) this.phase -= 1;
      // Fire the cylinders whose point in the cycle was just passed.
      for (let c = 0; c < this.offsets.length; c++) {
        const o = this.offsets[c];
        const passed = prev <= this.phase ? prev < o && o <= this.phase : prev < o || o <= this.phase;
        if (!passed || P.length >= MAX_PULSES) continue;
        const jitter = 1 + this.rand() * 0.08 * this.rough;
        const amp = V.pattern[c] * jitter * (jake ? 1 + jake * 0.6 : load * (1 - 0.55 * this.overrun));
        P.push({ env: amp, noise: amp * V.noise * this.rough, knock: amp * (V.knock + jake * 0.9), s: 0, c: 1 });
      }
      // Sum the ringing pulses (a decaying sine via a rotating phasor).
      let e = 0;
      let kn = 0;
      for (let k = P.length - 1; k >= 0; k--) {
        const p = P[k];
        // rotate (c, s) by w
        const cs = p.c * cw - p.s * sw;
        p.s = p.c * sw + p.s * cw;
        p.c = cs;
        e += p.env * p.s + p.noise * this.rand();
        kn += p.knock * this.rand();
        p.env *= kDecay;
        p.noise *= kNoise;
        p.knock *= kKnock;
        if (p.env < 0.002 && p.knock < 0.002) P.splice(k, 1);
      }
      // Exhaust resonances on top of the direct pulse, then the muffler.
      let x = e * 0.6;
      for (let r = 0; r < V.res.length; r++) x += this.res[r].run(e) * V.res[r][2] * 2.2;
      x = this.muffler2.run(this.muffler.run(x));
      x += this.knockHp.run(kn) * 0.35;
      if (intakeAmp) x += this.intakeBp.run(this.rand()) * intakeAmp * (0.6 + 0.4 * Math.abs(e));
      if (whineAmp) {
        this.whinePhase += whineStep;
        if (this.whinePhase > 6.283185307) this.whinePhase -= 6.283185307;
        x += Math.sin(this.whinePhase) * whineAmp;
      }
      // Soft clip for grit, block DC, volume.
      x = Math.tanh(x * V.drive) / V.drive;
      this.gain += gStep;
      out[i] = this.dc.run(x) * this.gain * V.level;
    }
  }
}
