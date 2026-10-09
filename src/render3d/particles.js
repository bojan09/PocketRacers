// World-space particle system (smoke, dust, sparks, nitro flames, splashes)
// plus blob shadows. Billboards are expanded on the CPU into a reused
// Float32Array each frame; two draw calls (alpha, additive).

const FLOATS = 9; // pos3, rgba4, uv2
const MAX = 420;
const RIBBON_MAX = 48; // trail samples
// Rainbow bands, left to right across the trail.
const RAINBOW = [
  [1, 0.23, 0.28],
  [1, 0.6, 0.12],
  [1, 0.88, 0.3],
  [0.24, 0.86, 0.52],
  [0.24, 0.55, 1],
  [0.64, 0.38, 1],
];
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
  confetti: [1, 1, 1, 1, 0, 6, 1.6],
  boost: [0.45, 0.8, 1, 0.9, 1, 0, 3],
};

export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push({ life: 0 });
    this.alphaData = new Float32Array((MAX + 64 + 320) * 6 * FLOATS);
    this.addData = new Float32Array(MAX * 6 * FLOATS);
    this.alphaCount = 0;
    this.addCount = 0;
    this.ribbonData = new Float32Array(RIBBON_MAX * RAINBOW.length * 6 * FLOATS);
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
  build(camRight, camUp, shadows, billboards = null) {
    let ai = 0;
    let di = 0;
    const A = this.alphaData;
    const D = this.addData;
    const quad = (arr, i, cx, cy, cz, rx, ry, rz, ux, uy, uz, r, g, b, a) => {
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
    this.alphaCount = ai / FLOATS;
    this.addCount = di / FLOATS;
  }

  /**
   * Rainbow nitro trail: a flat ribbon through recent rear-of-car samples
   * ({x, y, z, rx, ry, rz, t}), fading with age.
   */
  buildRibbon(samples, now, life, halfWidth) {
    const D = this.ribbonData;
    let i = 0;
    const bands = RAINBOW.length;
    for (let k = 0; k < samples.length - 1; k++) {
      const a = samples[k];
      const b = samples[k + 1];
      const fa = Math.max(0, 1 - (now - a.t) / life);
      const fb = Math.max(0, 1 - (now - b.t) / life);
      if (fa <= 0 && fb <= 0) continue;
      for (let q = 0; q < bands; q++) {
        const u0 = -1 + (2 * q) / bands;
        const u1 = -1 + (2 * (q + 1)) / bands;
        const c = RAINBOW[q];
        const corner = (s, u, f) => {
          D[i++] = s.x + s.rx * u * halfWidth;
          D[i++] = s.y + s.ry * u * halfWidth;
          D[i++] = s.z + s.rz * u * halfWidth;
          D[i++] = c[0];
          D[i++] = c[1];
          D[i++] = c[2];
          D[i++] = 0.9 * f * f;
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
