// Open world: a seeded landscape the car can drive anywhere on. The ground
// is a pure function of (x, z), so any part of it can be built on demand in
// square chunks around the player and dropped again when far away.
//
// Island mode: the land falls into the sea past a wobbly coastline.
// (Endless mode later skips the coast.)
//
// World axes as on tracks: x = east, y = up, z = south; metres.

import { valueNoise } from '../render3d/terrain.js';
import { mulberry32 } from '../core/util.js';
import { OBJECT_KINDS, UNITS_PER_METRE } from './track3d.js';
import { PROP_SIZE } from '../data/props.js';
import { ANIMALS } from '../data/animals.js';

export const CHUNK = 128; // metres per chunk side
export const CELL = 4; // metres between height samples
export const WATER = 0; // sea level

const OBJ_CELL = 12; // metres between scenery candidates (jittered)
export const SNOW_LINE = 52;

/**
 * What grows in each area: [kind, weight] lists for big scenery, how dense
 * it is, and which smashable props turn up there.
 */
export const BIOMES = {
  meadow: { density: 0.1, kinds: [['oak', 3], ['bush', 4], ['flowers', 3], ['rock', 1], ['house', 0.25], ['barn', 0.15]], props: ['hay', 'fence', 'crate', 'mailbox'] },
  forest: { density: 0.4, kinds: [['pine', 5], ['oak', 2], ['bush', 2], ['rock', 0.6]], props: ['crate', 'fence'] },
  desert: { density: 0.07, kinds: [['cactus', 4], ['desertRock', 2], ['bush', 0.5]], props: ['barrel', 'drum', 'crate'] },
  snow: { density: 0.22, kinds: [['snowPine', 6], ['rock', 1], ['snowman', 0.4]], props: ['gift', 'crate'] },
  beach: { density: 0.06, kinds: [['palm', 4], ['umbrella', 1.5], ['hut', 0.2]], props: ['ball', 'barrel'] },
};

export const ROAD_HALF = 4.2; // metres from the centre line to the edge
const ROAD_BLEND = 14; // metres over which the land meets the road bed
const ROAD_STEP = 3; // metres between road samples
const ROAD_BUCKET = 32;
const bucketKey = (bx, bz) => bx * 100003 + bz;

/** Points every `step` metres along a centripetal Catmull-Rom curve. */
function sampleSpline(pts, closed, step) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  const dense = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) dense.push(pts[n - 1].slice());
  // Resample at equal spacing.
  const out = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let from = a;
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      const p = [from[0] + (b[0] - from[0]) * t, from[1] + (b[1] - from[1]) * t];
      out.push(p);
      seg -= step - acc;
      from = p;
      acc = 0;
    }
    acc += seg;
  }
  return out;
}

const hashChunk = (cx, cz, seed) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;

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
    this.noise3 = valueNoise(seed * 3 + 101);
    this.spawn = { x: 0, z: 0, yaw: 0 };
    this.objectCache = new Map();
    this.ramps = [];
    this.landmarks = [];
    this.animals = [];
    this.buildRoads();
    this.buildFeatures();
  }

  /**
   * Things to find: a stunt park of ramps beside the start, kicker ramps
   * along the ring road, a castle on a meadow hilltop, a lighthouse on the
   * coast, windmills near the start, and the island's hidden animals.
   */
  buildFeatures() {
    const sp = this.spawn;
    const fx = Math.sin(sp.yaw);
    const fz = -Math.cos(sp.yaw);
    const rx = Math.cos(sp.yaw);
    const rz = Math.sin(sp.yaw);
    const clearOfRoads = (x, z, d) => {
      const r = this.nearestRoad(x, z);
      return !r || r.d > d;
    };
    // Stunt park: a field of ramps to the side of the first road.
    let side = 1;
    if (!clearOfRoads(sp.x + rx * 110, sp.z + rz * 110, 45)) side = -1;
    const px = sp.x + rx * 110 * side + fx * 40;
    const pz = sp.z + rz * 110 * side + fz * 40;
    for (const [a, b, len, w, h] of [
      [0, 0, 12, 6, 3.2],
      [-22, 14, 9, 5, 2.2],
      [22, 14, 9, 5, 2.2],
      [-14, -26, 7, 4, 1.5],
      [14, -26, 7, 4, 1.5],
      [0, 38, 14, 7, 4],
    ])
      this.ramps.push({ x: px + rx * a + fx * b, z: pz + rz * a + fz * b, yaw: sp.yaw, len, w, h });
    this.stuntPark = { x: px, z: pz };
    // Kickers on the ring road (on one lane, so the other stays smooth).
    const ring = this.roads[0].samples;
    for (let k = 0; k < 7; k++) {
      const smp = ring[Math.floor(((k + 0.5) / 7) * ring.length)];
      const yaw = Math.atan2(smp.tx, -smp.tz);
      this.ramps.push({ x: smp.x - smp.tz * 2.1, z: smp.z + smp.tx * 2.1, yaw, len: 7, w: 3.4, h: 1.6, road: true });
    }
    // Castle: the highest gentle meadow spot a fair way from the start.
    let best = null;
    for (let z = -900; z <= 900; z += 40) {
      for (let x = -900; x <= 900; x += 40) {
        const d = Math.hypot(x - sp.x, z - sp.z);
        if (d < 300 || d > 850 || this.biome(x, z) !== 'meadow' || !clearOfRoads(x, z, 40) || this.slope(x, z) > 0.2) continue;
        const h = this.baseHeight(x, z);
        if (!best || h > best.h) best = { x, z, h };
      }
    }
    if (best) this.landmarks.push({ kind: 'castle', x: best.x, z: best.z, yaw: Math.atan2(sp.x - best.x, -(sp.z - best.z)), r: 13 });
    // Lighthouse: on the coast, just inland, clear of roads.
    for (let a = 2.3; a < 2.3 + Math.PI * 2; a += 0.07) {
      let r = this.radius * 1.3;
      while (r > 200 && this.baseHeight(Math.cos(a) * r, Math.sin(a) * r) < WATER + 2) r -= 6;
      const x = Math.cos(a) * (r - 8);
      const z = Math.sin(a) * (r - 8);
      if (clearOfRoads(x, z, 40) && this.slope(x, z) < 0.3) {
        this.landmarks.push({ kind: 'lighthouse', x, z, yaw: a + Math.PI / 2, r: 3.6 });
        break;
      }
    }
    // Windmills on the other side of the first road.
    for (let k = 0; k < 3; k++) {
      const x = sp.x - rx * 75 * side + fx * (60 + k * 45);
      const z = sp.z - rz * 75 * side + fz * (60 + k * 45);
      if (clearOfRoads(x, z, 15)) this.landmarks.push({ kind: 'windmill', x, z, yaw: sp.yaw + Math.PI, r: 2.2 });
    }
    // Hidden animals: one in each kind of place, the nearest good spot to
    // the start (the meadow one by the windmills, the crab by the lighthouse).
    const lh = this.landmarks.find((l) => l.kind === 'lighthouse');
    const anchor = { meadow: { x: sp.x - rx * 60 * side + fx * 160, z: sp.z - rz * 60 * side + fz * 160 }, beach: lh || sp };
    for (const a of ANIMALS.filter((x) => x.map === 'island')) {
      const from = anchor[a.area] || sp;
      let spot = null;
      for (let ring2 = 0; ring2 < 60 && !spot; ring2++) {
        const r = ring2 * 25 + (a.area === 'meadow' || a.area === 'beach' ? 0 : 200);
        for (let t = 0; t < 24 && !spot; t++) {
          const ang = (t / 24) * Math.PI * 2 + ring2;
          const x = from.x + Math.cos(ang) * r;
          const z = from.z + Math.sin(ang) * r;
          const h = this.baseHeight(x, z);
          if (h < WATER + 0.5 || this.biome(x, z) !== a.area || this.slope(x, z) > 0.45 || !clearOfRoads(x, z, 10)) continue;
          spot = { x, z };
        }
      }
      if (spot) this.animals.push({ ...a, x: spot.x, z: spot.z, yaw: Math.atan2(sp.x - spot.x, -(sp.z - spot.z)) });
    }
  }

  /** Extra ground height from ramps at (x, z). */
  rampAt(x, z) {
    for (const r of this.ramps) {
      const dx = x - r.x;
      const dz = z - r.z;
      if (Math.abs(dx) > r.len && Math.abs(dz) > r.len) continue;
      const u = dx * Math.sin(r.yaw) - dz * Math.cos(r.yaw) + r.len / 2;
      const v = dx * Math.cos(r.yaw) + dz * Math.sin(r.yaw);
      if (u >= 0 && u <= r.len && Math.abs(v) <= r.w / 2) return r.h * Math.pow(u / r.len, 1.3);
    }
    return 0;
  }

  /** Whether (x, z) is within `pad` metres of a ramp, landmark or animal. */
  nearFeature(x, z, pad) {
    for (const r of this.ramps) if (Math.hypot(x - r.x, z - r.z) < r.len / 2 + pad) return true;
    for (const l of this.landmarks) if (Math.hypot(x - l.x, z - l.z) < l.r + pad) return true;
    for (const a of this.animals) if (Math.hypot(x - a.x, z - a.z) < pad + 2) return true;
    if (this.stuntPark && Math.hypot(x - this.stuntPark.x, z - this.stuntPark.z) < 55) return true;
    return false;
  }

  /**
   * The road network: a winding ring road round the island and roads from
   * the middle out to it. Each road is a smooth curve sampled every few
   * metres; samples carry the road height (the land along it, smoothed).
   */
  buildRoads() {
    const R = this.radius;
    const n = this.noise2;
    const lines = [];
    // Ring: 14 points at about half the island radius, wobbling in and out.
    const ring = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = R * (0.64 + n(Math.cos(a) * 3 + 7, Math.sin(a) * 3) * 0.2);
      ring.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    lines.push({ pts: ring, closed: true });
    // Spokes from the middle to the ring, bending on the way.
    for (const k of [0, 3, 6, 9, 11]) {
      const [ex, ez] = ring[k];
      const mx = ex * 0.5 - ez * 0.18;
      const mz = ez * 0.5 + ex * 0.18;
      lines.push({ pts: [[0, 0], [ex * 0.12, ez * 0.12], [mx, mz], [ex * 0.85, ez * 0.85], [ex, ez]], closed: false });
    }
    this.roads = [];
    this.roadSamples = null; // heights below must use the natural land
    const samples = [];
    lines.forEach((line, ri) => {
      const pts = sampleSpline(line.pts, line.closed, ROAD_STEP);
      const hs = pts.map(([x, z]) => this.baseHeight(x, z));
      // Smooth the road's height along its length (gentle grades).
      let sm = hs;
      for (let pass = 0; pass < 3; pass++) {
        const out = sm.slice();
        for (let i = 0; i < sm.length; i++) {
          let sum = 0;
          let c = 0;
          for (let k = -8; k <= 8; k++) {
            const j = line.closed ? (i + k + sm.length) % sm.length : Math.min(sm.length - 1, Math.max(0, i + k));
            sum += sm[j];
            c++;
          }
          out[i] = sum / c;
        }
        sm = out;
      }
      const road = pts.map(([x, z], i) => {
        const a = pts[line.closed ? (i + 1) % pts.length : Math.min(pts.length - 1, i + 1)];
        const b = pts[line.closed ? (i - 1 + pts.length) % pts.length : Math.max(0, i - 1)];
        const tl = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return { x, z, h: Math.max(WATER + 1.4, sm[i]), tx: (a[0] - b[0]) / tl, tz: (a[1] - b[1]) / tl, road: ri, i };
      });
      this.roads.push({ samples: road, closed: line.closed });
      samples.push(...road);
    });
    // Spokes ease to the ring road's height where they join it (no step).
    const ringS = this.roads[0].samples;
    for (const road of this.roads.slice(1)) {
      const S = road.samples;
      const end = S[S.length - 1];
      let target = ringS[0];
      for (const r of ringS) if ((r.x - end.x) ** 2 + (r.z - end.z) ** 2 < (target.x - end.x) ** 2 + (target.z - end.z) ** 2) target = r;
      const N = Math.min(25, S.length);
      for (let k = 0; k < N; k++) {
        const smp = S[S.length - 1 - k];
        const w = 1 - smoothstep(0, N, k);
        smp.h += (target.h - smp.h) * w;
      }
    }
    // Bucket the samples for fast nearest-road lookups.
    this.roadGrid = new Map();
    for (const smp of samples) {
      const k = bucketKey(Math.floor(smp.x / ROAD_BUCKET), Math.floor(smp.z / ROAD_BUCKET));
      if (!this.roadGrid.has(k)) this.roadGrid.set(k, []);
      this.roadGrid.get(k).push(smp);
    }
    this.roadSamples = samples;
    // Start on the first spoke, facing out along it.
    const sp = this.roads[1].samples;
    this.spawn = { x: sp[3].x, z: sp[3].z, yaw: Math.atan2(sp[3].tx, -sp[3].tz) };
  }

  /** Nearest road sample to (x, z) within ~2 buckets: { d, h, s } or null. */
  nearestRoad(x, z) {
    if (!this.roadGrid) return null;
    const bx = Math.floor(x / ROAD_BUCKET);
    const bz = Math.floor(z / ROAD_BUCKET);
    let best = null;
    let bd = Infinity;
    for (let gz = bz - 1; gz <= bz + 1; gz++) {
      for (let gx = bx - 1; gx <= bx + 1; gx++) {
        const list = this.roadGrid.get(bucketKey(gx, gz));
        if (!list) continue;
        for (const smp of list) {
          const d = (smp.x - x) ** 2 + (smp.z - z) ** 2;
          if (d < bd) {
            bd = d;
            best = smp;
          }
        }
      }
    }
    if (!best) return null;
    // Distance across the road (perpendicular to it), not to the sample.
    const dx = x - best.x;
    const dz = z - best.z;
    const across = Math.abs(dx * -best.tz + dz * best.tx);
    const along = Math.abs(dx * best.tx + dz * best.tz);
    return { d: along > ROAD_STEP ? Math.sqrt(bd) : across, h: best.h, s: best };
  }

  /** Which area (biome) a point is in. */
  biome(x, z, h = this.height(x, z)) {
    if (h > SNOW_LINE) return 'snow';
    if (h < WATER + 2.2) return 'beach';
    const n = this.region(x, z);
    if (n > 0.16) return 'desert';
    if (n < -0.2) return 'forest';
    return 'meadow';
  }

  /**
   * Large regions: forest and desert patches among the meadows; the desert
   * leans to the east, forest to the west. > 0.16 desert, < -0.2 forest.
   * Meadows around the start.
   */
  region(x, z) {
    const near = smoothstep(150, 450, Math.hypot(x - this.spawn.x, z - this.spawn.z));
    return (this.noise3(x * 0.0016, z * 0.0016) + x / (this.radius * 6)) * near;
  }

  /**
   * Scenery and smashable props in chunk (cx, cz), the same every time:
   * [{ id, kind, x, z, y, yaw, scale, r, prop }]. r is the solid radius in
   * metres (0 = drive through); prop = knocked flying when hit.
   */
  chunkObjects(cx, cz) {
    const key = `${cx},${cz}`;
    const cached = this.objectCache.get(key);
    if (cached) return cached;
    const rand = mulberry32(hashChunk(cx, cz, this.seed));
    const out = [];
    const n = CHUNK / OBJ_CELL;
    let id = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx * CHUNK + (i + 0.15 + rand() * 0.7) * OBJ_CELL;
        const z = cz * CHUNK + (j + 0.15 + rand() * 0.7) * OBJ_CELL;
        const pick = rand();
        const kindRoll = rand();
        const yaw = rand() * Math.PI * 2;
        const sc = 0.8 + rand() * 0.45;
        if (Math.hypot(x - this.spawn.x, z - this.spawn.z) < 45) continue; // clear start
        const road = this.nearestRoad(x, z);
        if (road && road.d < ROAD_HALF + (pick < 0.012 ? 3 : 4.5)) continue; // roads stay clear
        if (this.nearFeature(x, z, 8)) continue;
        const h = this.height(x, z);
        if (h < WATER + 0.3) continue;
        const b = BIOMES[this.biome(x, z)];
        // Smashable props in little groups.
        if (pick < 0.012) {
          const kind = b.props[Math.floor(kindRoll * b.props.length)];
          const count = kind === 'fence' ? 5 : 3;
          for (let k = 0; k < count; k++) {
            const px = x + (kind === 'fence' ? Math.cos(yaw) * k * 2.05 : (rand() - 0.5) * 4);
            const pz = z + (kind === 'fence' ? Math.sin(yaw) * k * 2.05 : (rand() - 0.5) * 4);
            out.push({ id: `${key}:${id++}`, kind, x: px, z: pz, y: this.ground(px, pz), yaw: kind === 'fence' ? -yaw : rand() * 6.28, scale: 1, r: PROP_SIZE[kind] || 0.4, prop: true });
          }
          continue;
        }
        if (pick > b.density) continue;
        if (this.slope(x, z) > 0.7) continue;
        let total = 0;
        for (const [, w] of b.kinds) total += w;
        let roll = kindRoll * total;
        let kind = b.kinds[0][0];
        for (const [k, w] of b.kinds) {
          if ((roll -= w) <= 0) {
            kind = k;
            break;
          }
        }
        const def = OBJECT_KINDS[kind];
        const scale = kind === 'house' || kind === 'barn' || kind === 'hut' ? 1 : sc;
        const r = def && def.solid ? (def.w * def.solid * scale) / 2 / UNITS_PER_METRE : 0;
        out.push({ id: `${key}:${id++}`, kind, x, z, y: this.ground(x, z), yaw, scale, r: kind === 'house' || kind === 'barn' ? 4 : kind === 'hut' ? 2.5 : r, prop: false });
      }
    }
    for (const l of this.landmarks) {
      if (Math.floor(l.x / CHUNK) === cx && Math.floor(l.z / CHUNK) === cz) out.push({ id: `${key}:${l.kind}`, kind: l.kind, x: l.x, z: l.z, y: this.height(l.x, l.z), yaw: l.yaw, scale: 1, r: l.r, prop: false, landmark: true });
    }
    if (this.objectCache.size > 400) this.objectCache.delete(this.objectCache.keys().next().value);
    this.objectCache.set(key, out);
    return out;
  }

  /** Objects whose chunks touch the square of half-size `reach` around (x, z). */
  objectsNear(x, z, reach, out = []) {
    out.length = 0;
    const c0x = Math.floor((x - reach) / CHUNK);
    const c1x = Math.floor((x + reach) / CHUNK);
    const c0z = Math.floor((z - reach) / CHUNK);
    const c1z = Math.floor((z + reach) / CHUNK);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) for (const o of this.chunkObjects(cx, cz)) if (Math.abs(o.x - x) < reach && Math.abs(o.z - z) < reach) out.push(o);
    return out;
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
    const base = this.baseHeight(x, z);
    if (!this.roadSamples) return base;
    // Roads are cut into the land: flat across, with the ground blending
    // into the road bed over a few metres either side.
    const r = this.nearestRoad(x, z);
    if (!r || r.d > ROAD_HALF + ROAD_BLEND) return base;
    const t = 1 - smoothstep(ROAD_HALF + 0.5, ROAD_HALF + ROAD_BLEND, r.d);
    return base + (r.h - base) * t;
  }

  /** Natural landscape height, before roads. */
  baseHeight(x, z) {
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
    const ramp = this.ramps.length ? this.rampAt(x, z) : 0;
    if (u >= v) {
      const h10 = this.height(x0 + CELL, z0);
      return h00 + (h10 - h00) * u + (h11 - h10) * v + ramp;
    }
    const h01 = this.height(x0, z0 + CELL);
    return h00 + (h11 - h01) * u + (h01 - h00) * v + ramp;
  }

  /** Surface type under (x, z): 'water', 'sand', 'grass' or 'rock'. */
  surface(x, z) {
    const r = this.nearestRoad(x, z);
    if (r && r.d < ROAD_HALF + 0.3) return 'road';
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
