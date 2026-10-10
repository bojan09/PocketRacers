// Roads for the endless world: a never-ending grid of winding roads, built
// a piece at a time as the car gets near. Every road is a pure function of
// its number, so pieces always join up, and road height is the land
// smoothed in 2D, so crossing roads meet at the same height.
//
// Road (axis 0, k) runs east-west: z = k * SPACING + wobble(x).
// Road (axis 1, k) runs north-south: x = k * SPACING + wobble(z).

import { mulberry32 } from '../core/util.js';
import { WATER } from './openWorld.js';

export const ROAD_SPACING = 620; // metres between parallel roads
const WOBBLE = 130; // metres a road wanders either side of its line
const PIECE = 513; // metres of road built at a time (171 samples of 3 m)
const STEP = 3;
const SIGMA = 110; // metres: road height is the land smoothed over about this

/** Where road (axis, k) is at distance t along its axis: [x, z]. */
export function roadPoint(world, axis, k, t) {
  const n = world.noise2;
  const w = n(t * 0.0042 + k * 17.31, axis * 91.7 + k * 3.13) * 2 * WOBBLE;
  const off = k * ROAD_SPACING + w;
  return axis === 0 ? [t, off] : [off, t];
}

/** Road bed height at (x, z): the land smoothed in 2D (Gaussian, 5x5). */
export function smoothLand(world, x, z) {
  let sum = 0;
  let wsum = 0;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const w = Math.exp(-(i * i + j * j) / 2);
      sum += world.baseHeight(x + i * SIGMA * 0.75, z + j * SIGMA * 0.75) * w;
      wsum += w;
    }
  return Math.max(WATER + 1.4, sum / wsum);
}

const hash = (a, b, c) => (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0;

/** Make sure every road piece near (x, z) exists (cheap when it does). */
export function ensureRoads(world, x, z) {
  const cx = Math.floor(x / 64);
  const cz = Math.floor(z / 64);
  if (cx === world.lastRoadCellX && cz === world.lastRoadCellZ) return;
  world.lastRoadCellX = cx;
  world.lastRoadCellZ = cz;
  const reach = WOBBLE + 100;
  for (const axis of [0, 1]) {
    const across = axis === 0 ? z : x;
    const along = axis === 0 ? x : z;
    for (let k = Math.ceil((across - reach) / ROAD_SPACING); k <= Math.floor((across + reach) / ROAD_SPACING); k++)
      for (let p = Math.floor((along - 64) / PIECE); p <= Math.floor((along + 64) / PIECE); p++) buildPiece(world, axis, k, p);
  }
}

function buildPiece(world, axis, k, p) {
  const key = `${axis},${k},${p}`;
  if (world.roadPieces.has(key)) return;
  world.roadPieces.add(key);
  const id = world.roads.length;
  const samples = [];
  // One extra sample at each end overlaps the neighbouring pieces, so the
  // surface is smooth across the joint.
  for (let t = p * PIECE - STEP, i = 0; t <= (p + 1) * PIECE + STEP; t += STEP, i++) {
    const [x, z] = roadPoint(world, axis, k, t);
    const [ax, az] = roadPoint(world, axis, k, t + 1);
    const [bx, bz] = roadPoint(world, axis, k, t - 1);
    const tl = Math.hypot(ax - bx, az - bz) || 1;
    samples.push({ x, z, h: 0, tx: (ax - bx) / tl, tz: (az - bz) / tl, road: id, i, layer: axis });
  }
  // Height every 4th sample (on the global 12 m grid, so pieces agree),
  // straight lines between: the smoothed land changes slowly.
  const t0 = p * PIECE - STEP;
  const hAt = (t) => {
    const [x, z] = roadPoint(world, axis, k, t);
    return smoothLand(world, x, z);
  };
  let lo = Math.floor(t0 / 12) * 12;
  let hLo = hAt(lo);
  let hHi = hAt(lo + 12);
  samples.forEach((smp, i) => {
    const t = t0 + i * STEP;
    while (t > lo + 12) {
      lo += 12;
      hLo = hHi;
      hHi = hAt(lo + 12);
    }
    smp.h = hLo + ((hHi - hLo) * (t - lo)) / 12;
  });
  world.roads.push({ samples, closed: false, axis, k });
  world.addRoadSamples(samples);
  // Now and then a kicker ramp on one lane, away from crossings.
  const rand = mulberry32(hash(axis + 1, k, p) ^ world.seed);
  if (rand() < 0.55) {
    const smp = samples[20 + Math.floor(rand() * (samples.length - 40))];
    const crossing = roadPoint(world, 1 - axis, Math.round((axis === 0 ? smp.x : smp.z) / ROAD_SPACING), axis === 0 ? smp.z : smp.x);
    if (Math.hypot(crossing[0] - smp.x, crossing[1] - smp.z) > 80) {
      const side = rand() < 0.5 ? -1 : 1;
      world.addRamp({ x: smp.x - smp.tz * 2.1 * side, z: smp.z + smp.tx * 2.1 * side, yaw: Math.atan2(smp.tx, -smp.tz), len: 7, w: 3.4, h: 1.6, road: true });
    }
  }
}

/** Nearest point on any road near (x, z) (within ~400 m): { x, z, d }. */
export function nearestRoadPoint(world, x, z) {
  let best = null;
  for (const axis of [0, 1]) {
    const across = axis === 0 ? z : x;
    const along = axis === 0 ? x : z;
    const k0 = Math.round(across / ROAD_SPACING);
    for (let k = k0 - 1; k <= k0 + 1; k++)
      for (let t = along - 400; t <= along + 400; t += 6) {
        const [px, pz] = roadPoint(world, axis, k, t);
        const d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) best = { x: px, z: pz, d };
      }
  }
  return best;
}
