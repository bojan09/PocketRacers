// World-space particle system (smoke, dust, sparks, nitro flames, splashes)
// plus blob shadows. Billboards are expanded on the CPU into a reused
// Float32Array each frame; two draw calls (alpha, additive).

const FLOATS = 9; // pos3, rgba4, uv2
const MAX = 420;
const RIBBON_MAX = 48; // trail samples
const WEATHER_MAX = 600; // snowflakes / raindrops around the camera
const GLOW_MAX = 96; // headlight and street-lamp light pools
const BANDS = 6; // across the nitro trail
export const RIBBON_SAMPLES = RIBBON_MAX;
// Two triangles per billboard: corner sign x, sign y, u, v.
const CORNERS = [-1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, 1, -1, 1, 0, 1];

// type: [r, g, b, a, additive, gravity, drag]
const TYPES = {
  smoke: [0.93, 0.94, 0.97, 0.55, 0, -1.2, 1.2],
  dust: [0.55, 0.62, 0.36, 0.85, 0, 9, 2.2],
  spark: [1, 0.86, 0.35, 1, 1, 12, 0.6],
  flame: [1, 0.55, 0.15, 0.85, 1, -1, 0.6],
  flameCore: [0.6, 0.85, 1, 0.95, 1, 0, 0],
  splash: [0.85, 0.93, 1, 0.8, 0, 9, 1],
  star: [1, 0.95, 0.5, 1, 1, 4, 1.5],
  sparkle: [1, 0.86, 0.3, 1, 1, -1, 2.5],
  firework: [1, 1, 1, 1, 0, 3, 1.3],
  confetti: [1, 1, 1, 1, 0, 6, 1.6],
  boost: [0.45, 0.8, 1, 0.9, 1, 0, 3],
};

export class Particles {
  constructor() {
    // Positions are written relative to this (the renderer's origin), so
    // far-away worlds stay precise in 32-bit vertex data.
    this.origin = [0, 0, 0];
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push({ life: 0 });
    this.alphaData = new Float32Array((MAX + 64 + 320 + WEATHER_MAX) * 6 * FLOATS);
    this.addData = new Float32Array((MAX + GLOW_MAX + WEATHER_MAX) * 6 * FLOATS);
    this.alphaCount = 0;
    this.addCount = 0;
    this.ribbonData = new Float32Array(RIBBON_MAX * BANDS * 6 * FLOATS);
    this.ribbonCount = 0;
    this.quality = 1;
    this.next = 0;
  }

  spawn(type, x, y, z, vx, vy, vz, size, life, grow = 0, colour = null) {
    // Ring-buffer reuse: oldest particle is replaced when full.
    for (let n = 0; n < MAX; n++) {
      const p = this.pool[(this.next + n) % MAX];
      if (p.life > 0 && n < MAX - 1) continue;
      this.next = (this.next + n + 1) % MAX;
      p.type = TYPES[type];
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = vx;
      p.vy = vy;
      p.vz = vz;
      p.size = size;
      p.grow = grow;
      p.life = p.max = life;
      p.col = colour;
      return;
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = p.type;
      p.vy -= t[5] * dt;
      const drag = Math.exp(-t[6] * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size = Math.max(0.02, p.size + p.grow * dt);
    }
  }

  /** Build vertex data. camRight / camUp are unit vectors. */
  /**
   * @param weather  optional Weather (snow drawn soft, rain as additive streaks)
   * @param glows    optional light pools [{x, y, z, rx:[3], rz:[3], r, g, b, a}] (additive, flat)
   */
  build(camRight, camUp, shadows, billboards = null, weather = null, glows = null) {
    let ai = 0;
    let di = 0;
    const A = this.alphaData;
    const D = this.addData;
    const [ox, oy, oz] = this.origin;
    const quad = (arr, i, cx, cy, cz, rx, ry, rz, ux, uy, uz, r, g, b, a) => {
      cx -= ox;
      cy -= oy;
      cz -= oz;
      for (let c = 0; c < 24; c += 4) {
        const sx = CORNERS[c];
        const sy = CORNERS[c + 1];
        arr[i++] = cx + rx * sx + ux * sy;
        arr[i++] = cy + ry * sx + uy * sy;
        arr[i++] = cz + rz * sx + uz * sy;
        arr[i++] = r;
        arr[i++] = g;
        arr[i++] = b;
        arr[i++] = a;
        arr[i++] = CORNERS[c + 2];
        arr[i++] = CORNERS[c + 3];
      }
      return i;
    };
    // Blob shadows lie flat on the road (given as centre + half axes).
    for (const s of shadows) {
      ai = quad(A, ai, s.x, s.y, s.z, s.rx[0], s.rx[1], s.rx[2], s.rz[0], s.rz[1], s.rz[2], 0, 0, 0, s.alpha);
    }
    // Static soft billboards (clouds), drawn behind the particles.
    if (billboards) {
      for (const b of billboards) {
        const s = b.size;
        ai = quad(A, ai, b.x, b.y, b.z, camRight[0] * s, camRight[1] * s, camRight[2] * s, camUp[0] * s * 0.62, camUp[1] * s * 0.62, camUp[2] * s * 0.62, b.r, b.g, b.b, b.a);
      }
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      const t = p.type;
      const k = p.life / p.max;
      const s = p.size;
      const rx = camRight[0] * s;
      const ry = camRight[1] * s;
      const rz = camRight[2] * s;
      const ux = camUp[0] * s;
      const uy = camUp[1] * s;
      const uz = camUp[2] * s;
      const c = p.col || t;
      if (t[4]) di = quad(D, di, p.x, p.y, p.z, rx, ry, rz, ux, uy, uz, c[0], c[1], c[2], t[3] * k);
      else ai = quad(A, ai, p.x, p.y, p.z, rx, ry, rz, ux, uy, uz, c[0], c[1], c[2], t[3] * k);
    }
    if (glows) {
      for (let g = 0; g < Math.min(glows.length, GLOW_MAX); g++) {
        const o = glows[g];
        di = quad(D, di, o.x, o.y, o.z, o.rx[0], o.rx[1], o.rx[2], o.rz[0], o.rz[1], o.rz[2], o.r, o.g, o.b, o.a);
      }
    }
    if (weather && weather.count) {
      const W = weather;
      const s = W.size;
      for (let n = 0; n < W.count; n++) {
        const x = W.pos[n * 3];
        const y = W.pos[n * 3 + 1];
        const z = W.pos[n * 3 + 2];
        if (W.kind === 'rain') {
          // Thin vertical streak facing the camera.
          di = quad(D, di, x, y, z, camRight[0] * s * 0.12, camRight[1] * s * 0.12, camRight[2] * s * 0.12, 0, s * 2.2, 0, W.colour[0], W.colour[1], W.colour[2], W.alpha);
        } else {
          ai = quad(A, ai, x, y, z, camRight[0] * s, camRight[1] * s, camRight[2] * s, camUp[0] * s, camUp[1] * s, camUp[2] * s, W.colour[0], W.colour[1], W.colour[2], W.alpha);
        }
      }
    }
    this.alphaCount = ai / FLOATS;
    this.addCount = di / FLOATS;
  }

  /**
   * Rainbow nitro trail: a flat ribbon through recent rear-of-car samples
   * ({x, y, z, rx, ry, rz, t}), fading with age.
   */
  buildRibbon(samples, now, life, halfWidth, colour = [1, 1, 1], hot = 0) {
    const D = this.ribbonData;
    let i = 0;
    const bands = BANDS;
    for (let k = 0; k < samples.length - 1; k++) {
      const a = samples[k];
      const b = samples[k + 1];
      const fa = Math.max(0, 1 - (now - a.t) / life);
      const fb = Math.max(0, 1 - (now - b.t) / life);
      if (fa <= 0 && fb <= 0) continue;
      for (let q = 0; q < bands; q++) {
        const u0 = -1 + (2 * q) / bands;
        const u1 = -1 + (2 * (q + 1)) / bands;
        const corner = (s, u, f) => {
          // White-hot core fading to the car's colour at the edges.
          const e = Math.abs(u);
          const w = Math.min(1, (1 - e) * (1 - e) * (0.3 + hot * 0.45) + f * 0.05);
          D[i++] = s.x - this.origin[0] + s.rx * u * halfWidth;
          D[i++] = s.y - this.origin[1] + s.ry * u * halfWidth;
          D[i++] = s.z - this.origin[2] + s.rz * u * halfWidth;
          D[i++] = colour[0] + (1 - colour[0]) * w;
          D[i++] = colour[1] + (1 - colour[1]) * w;
          D[i++] = colour[2] + (1 - colour[2]) * w;
          D[i++] = (0.92 - 0.55 * e * e) * f * f;
          D[i++] = 0.5;
          D[i++] = 0.5;
        };
        corner(a, u0, fa);
        corner(b, u0, fb);
        corner(b, u1, fb);
        corner(a, u0, fa);
        corner(b, u1, fb);
        corner(a, u1, fa);
      }
    }
    this.ribbonCount = i / FLOATS;
  }

  clear() {
    for (const p of this.pool) p.life = 0;
  }
}

export const FX_FLOATS = FLOATS;

/**
 * Falling snow / rain / drifting dust in a box that travels with the camera.
 * A fixed set of drops wraps around the box, so there is no spawning cost.
 */
export class Weather {
  constructor(kind, density = 1) {
    this.kind = kind;
    const n = { snow: 420, rain: 520, dust: 140, leaves: 170 }[kind] || 0;
    this.count = Math.min(WEATHER_MAX, Math.round(n * density));
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.box = kind === 'rain' ? [36, 22, 36] : [44, 24, 44];
    const seedRand = (() => {
      let x = 2463534242;
      return () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296);
    })();
    for (let i = 0; i < this.count; i++) {
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] = (seedRand() - 0.5) * this.box[k] * 2;
      if (kind === 'rain') this.vel.set([-1, -26 - seedRand() * 6, 0], i * 3);
      else if (kind === 'leaves') this.vel.set([1.2 + seedRand() * 1.5, -1.0 - seedRand() * 0.9, (seedRand() - 0.5) * 1.2], i * 3);
      else if (kind === 'snow') this.vel.set([(seedRand() - 0.5) * 1.5, -1.6 - seedRand() * 1.4, (seedRand() - 0.5) * 1.5], i * 3);
      else this.vel.set([4 + seedRand() * 3, (seedRand() - 0.5) * 0.4, 1 + seedRand()], i * 3);
    }
    this.size = { snow: 0.17, rain: 0.4, dust: 0.5, leaves: 0.2 }[kind] || 0.1;
    this.colour = { snow: [1, 1, 1], rain: [0.6, 0.7, 0.9], dust: [0.86, 0.7, 0.5], leaves: [0.93, 0.48, 0.14] }[kind] || [1, 1, 1];
    this.alpha = { snow: 0.95, rain: 0.55, dust: 0.12, leaves: 0.9 }[kind] || 0.5;
    this.centre = null;
    this.time = 0;
  }

  /** Move the drops; wrap them into the box around `eye`. */
  update(dt, eye) {
    this.time += dt;
    const sway = Math.sin(this.time * 0.9) * 0.6;
    for (let i = 0; i < this.count; i++) {
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        const v = this.pos[j] + (this.vel[j] + (k === 0 && (this.kind === 'snow' || this.kind === 'leaves') ? sway * (this.kind === 'leaves' ? 2.5 : 1) : 0)) * dt;
        const b = this.box[k];
        const c = eye[k] + (k === 1 ? 4 : 0);
        // Wrap relative to the camera so the box follows it.
        let rel = v - c;
        if (rel > b) rel -= 2 * b;
        else if (rel < -b) rel += 2 * b;
        this.pos[j] = c + rel;
      }
    }
  }
}
