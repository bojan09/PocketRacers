// Heightfield terrain generated around the track. Near the road the ground is
// pulled just below the road surface (so it never pokes through), lakes are
// carved under bridges, and the map edge rises into a ring of hills.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';
import { mulberry32 } from '../core/util.js';

const CELL = 8; // metres
const MARGIN = 280;

function valueNoise(seed) {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const vals = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
  const h = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < 4; o++) {
      sum += (noise(x * f, y * f) - 0.5) * amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildTerrain(track, seed = 77) {
  const pal = track.palette;
  const segs = track.segments;
  const RW = track.roadHalfWidthM;
  const water = track.def.waterLevel ?? -50;
  const noise = valueNoise(seed);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of segs) {
    minX = Math.min(minX, s.pos[0]);
    maxX = Math.max(maxX, s.pos[0]);
    minZ = Math.min(minZ, s.pos[2]);
    maxZ = Math.max(maxZ, s.pos[2]);
  }
  minX -= MARGIN;
  maxX += MARGIN;
  minZ -= MARGIN;
  maxZ += MARGIN;
  const nx = Math.ceil((maxX - minX) / CELL) + 1;
  const nz = Math.ceil((maxZ - minZ) / CELL) + 1;

  // Track samples for nearest-road queries (every 2nd segment ≈ 1.7 m),
  // bucketed in a coarse grid. Beyond ~120 m the exact road distance no
  // longer affects the height, so only nearby buckets are searched.
  const BUCKET = 40;
  const grid = new Map();
  const key = (bx, bz) => bx * 100003 + bz;
  for (let i = 0; i < segs.length; i += 2) {
    const s = segs[i];
    const k = key(Math.floor(s.pos[0] / BUCKET), Math.floor(s.pos[2] / BUCKET));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }

  // Lakes: one per contiguous bridge run, centred on its middle.
  const lakes = [];
  let run = [];
  for (let i = 0; i <= segs.length; i++) {
    const s = segs[i % segs.length];
    if (i < segs.length && s.bridge) run.push(s);
    else if (run.length) {
      const mid = run[Math.floor(run.length / 2)];
      const r = (run.length * track.segmentLength * track.metresPerUnit) / 2 + 18;
      lakes.push({ x: mid.pos[0], z: mid.pos[2], r });
      run = [];
    }
  }

  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = minX + i * CELL;
      const z = minZ + j * CELL;
      // Nearest road sample.
      let best = Infinity;
      let near = segs[0];
      const bx = Math.floor(x / BUCKET);
      const bz = Math.floor(z / BUCKET);
      for (let gx = bx - 3; gx <= bx + 3; gx++) {
        for (let gz = bz - 3; gz <= bz + 3; gz++) {
          const list = grid.get(key(gx, gz));
          if (!list) continue;
          for (const s of list) {
            const dx = s.pos[0] - x;
            const dz = s.pos[2] - z;
            const d = dx * dx + dz * dz;
            if (d < best) {
              best = d;
              near = s;
            }
          }
        }
      }
      const d = Math.min(Math.sqrt(best), 1e4);
      const roadLow = near.pos[1] - 0.3 - RW * Math.abs(Math.sin(near.bank));
      const hills = 3 + noise(x * 0.006, z * 0.006) * 46 + noise(x * 0.03 + 50, z * 0.03) * 4;
      const inner = RW + 5;
      let h = d < inner ? roadLow : roadLow + (hills - roadLow) * smoothstep(inner, inner + 70, d);
      // Keep the ground below the road surface anywhere near it.
      if (d < inner + 12) h = Math.min(h, roadLow);
      // Rim of hills at the map edge hides the world boundary.
      const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
      if (edge < 150) h += Math.pow(1 - edge / 150, 2) * 60;
      // Lakes under bridges; the banks next to the approach roads stay put.
      const protectedBank = !near.bridge && d < inner + 14;
      for (const L of lakes) {
        if (protectedBank) break;
        const ld = Math.hypot(x - L.x, z - L.z);
        const k = 1 - smoothstep(L.r * 0.7, L.r + 10, ld);
        if (k > 0) h = h + (water - 5 - h) * k;
      }
      heights[j * nx + i] = h;
    }
  }

  const sampler = {
    minX,
    minZ,
    nx,
    nz,
    heights,
    /** Height matching the rendered triangles. */
    height(x, z) {
      const fx = (x - minX) / CELL;
      const fz = (z - minZ) / CELL;
      const i = Math.max(0, Math.min(nx - 2, Math.floor(fx)));
      const j = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
      const u = Math.min(1, Math.max(0, fx - i));
      const v = Math.min(1, Math.max(0, fz - j));
      const h00 = heights[j * nx + i];
      const h10 = heights[j * nx + i + 1];
      const h01 = heights[(j + 1) * nx + i];
      const h11 = heights[(j + 1) * nx + i + 1];
      // Triangles split along the (0,0)-(1,1) diagonal.
      if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
      return h00 + (h11 - h01) * u + (h01 - h00) * v;
    },
  };

  // Mesh, split into tiles for culling.
  const grass = hexToRgb(pal.grass);
  const grassAlt = hexToRgb(pal.grassAlt);
  const rockC = hexToRgb(pal.rockFace);
  const sand = hexToRgb(pal.shoulder);
  const snow = hexToRgb(pal.snow);
  const TILE = 24;
  const tiles = [];
  const rand = mulberry32(seed + 1);
  for (let tj = 0; tj < nz - 1; tj += TILE) {
    for (let ti = 0; ti < nx - 1; ti += TILE) {
      const mb = new MeshBuilder();
      for (let j = tj; j < Math.min(tj + TILE, nz - 1); j++) {
        for (let i = ti; i < Math.min(ti + TILE, nx - 1); i++) {
          const p = (ii, jj) => [minX + ii * CELL, heights[jj * nx + ii], minZ + jj * CELL];
          const a = p(i, j);
          const b = p(i + 1, j);
          const c = p(i + 1, j + 1);
          const d = p(i, j + 1);
          for (const [t0, t1, t2] of [
            [a, b, c],
            [a, c, d],
          ]) {
            const avg = (t0[1] + t1[1] + t2[1]) / 3;
            const steep = Math.max(t0[1], t1[1], t2[1]) - Math.min(t0[1], t1[1], t2[1]);
            let col = rand() < 0.5 ? grass : grassAlt;
            if (avg < water + 1.2) col = sand;
            else if (steep > 6.5) col = rockC;
            if (avg > 78) col = snow;
            const k = 0.94 + rand() * 0.1;
            mb.tri(t0, t2, t1, [col[0] * k, col[1] * k, col[2] * k]);
          }
        }
      }
      tiles.push(mb);
    }
  }

  // Water plane covering the map (only visible where the ground dips below).
  const waterMesh = new MeshBuilder();
  if (track.def.waterLevel !== undefined) {
    const w = hexToRgb(pal.water);
    waterMesh.quad([minX, water, minZ], [maxX, water, minZ], [maxX, water, maxZ], [minX, water, maxZ], w, 0.25);
  }

  return { sampler, tiles, water: waterMesh, bounds: { minX, maxX, minZ, maxZ } };
}
