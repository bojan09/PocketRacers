// Open world: a seeded landscape the car can drive anywhere on. The ground
// is a pure function of (x, z), so any part of it can be built on demand in
// square chunks around the player and dropped again when far away.
//
// Island mode: the land falls into the sea past a wobbly coastline.
// (Endless mode later skips the coast.)
//
// World axes as on tracks: x = east, y = up, z = south; metres.

import { valueNoise } from '../render3d/terrain.js';

export const CHUNK = 128; // metres per chunk side
export const CELL = 4; // metres between height samples
export const WATER = 0; // sea level

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class OpenWorld {
  /**
   * @param {{seed?: number, radius?: number, endless?: boolean}} o
   */
  constructor({ seed = 2024, radius = 1500, endless = false } = {}) {
    this.seed = seed;
    this.radius = radius;
    this.endless = endless;
    this.noise = valueNoise(seed);
    this.noise2 = valueNoise(seed * 7 + 13);
    this.spawn = { x: 0, z: 0, yaw: 0 };
  }

  /** How much of the ground is land (1) rather than sea (0) at (x, z). */
  land(x, z) {
    if (this.endless) return 1;
    const n = this.noise2;
    // A wobbly coast: the radius varies with direction and a little noise.
    const a = Math.atan2(z, x);
    const wobble = 1 + 0.12 * Math.sin(a * 3 + 1.3) + 0.06 * Math.sin(a * 7 + 0.4) + n(x * 0.003, z * 0.003) * 0.1;
    const d = Math.hypot(x, z) / (this.radius * wobble);
    return 1 - smoothstep(0.82, 1, d);
  }

  /** Ground height in metres (continuous, deterministic). */
  height(x, z) {
    const n = this.noise;
    // Rolling lowlands with hills rising out of them (only upward, so the
    // inland stays dry apart from a few ponds).
    const big = n(x * 0.0035, z * 0.0035);
    const hills = Math.max(0, big + 0.08) * 110 + n(x * 0.012 + 40, z * 0.012 - 9) * 12 + n(x * 0.05, z * 0.05) * 1.2;
    // Lowlands near the middle (and the start) are gentle; hills grow outward.
    const r = Math.hypot(x, z);
    const gentle = 0.35 + 0.65 * smoothstep(80, 600, r);
    let h = 7 + hills * gentle;
    // A flat, safe start area.
    h += (6 - h) * (1 - smoothstep(30, 90, r));
    const land = this.land(x, z);
    return WATER - 10 + (h + 10) * land;
  }

  /**
   * Ground height matching the drawn mesh exactly (triangles of the CELL
   * grid, split along the same diagonal), so wheels sit on what you see.
   */
  ground(x, z) {
    const fx = x / CELL;
    const fz = z / CELL;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const x0 = i * CELL;
    const z0 = j * CELL;
    const h00 = this.height(x0, z0);
    const h11 = this.height(x0 + CELL, z0 + CELL);
    if (u >= v) {
      const h10 = this.height(x0 + CELL, z0);
      return h00 + (h10 - h00) * u + (h11 - h10) * v;
    }
    const h01 = this.height(x0, z0 + CELL);
    return h00 + (h11 - h01) * u + (h01 - h00) * v;
  }

  /** Surface type under (x, z): 'water', 'sand', 'grass' or 'rock'. */
  surface(x, z) {
    const h = this.height(x, z);
    if (h < WATER - 0.4) return 'water';
    if (h < WATER + 1.6) return 'sand';
    const s = this.slope(x, z);
    return s > 0.75 ? 'rock' : 'grass';
  }

  /** Steepness (rise per metre) at (x, z). */
  slope(x, z) {
    const e = 1.5;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  /** Unit surface normal at (x, z). */
  normal(x, z, out = [0, 1, 0]) {
    const e = 1;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out[0] = -dx / l;
    out[1] = (2 * e) / l;
    out[2] = -dz / l;
    return out;
  }

  /**
   * Height samples for chunk (cx, cz): (n+1)^2 values, row-major in z, plus
   * one extra ring for normals.
   */
  chunkHeights(cx, cz) {
    const n = CHUNK / CELL;
    const w = n + 3;
    const h = new Float32Array(w * w);
    const x0 = cx * CHUNK - CELL;
    const z0 = cz * CHUNK - CELL;
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) h[j * w + i] = this.height(x0 + i * CELL, z0 + j * CELL);
    return { h, w, n };
  }
}
