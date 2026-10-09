// 3D track builder. A track is a closed centripetal Catmull-Rom spline through
// authored control points (metres). It is resampled into short segments that
// carry both what the simulation needs (curvature, slope, rails, colliders)
// and what the renderer needs (centre position + banked basis vectors).
//
// World axes: x = east, y = up, z = south (so "north" on the map is -z).
// Simulation units: 240 units = 1 metre (handling values were tuned in units).

import { clamp, mulberry32, wrap } from '../core/util.js';

export const UNITS_PER_METRE = 240;
const CURVE_PER_CURVATURE = 360; // curvature 1/60 m  ->  sim curve value 6
const MAX_BANK = 0.085; // radians

// Placeable scenery. `w` is collision width in sim units, `solid` the
// fraction of it that blocks the car (0 = decorative only).
export const OBJECT_KINDS = {
  pine: { w: 820, solid: 0.35 },
  oak: { w: 1100, solid: 0.3 },
  bush: { w: 640, solid: 0 },
  flowers: { w: 500, solid: 0 },
  rock: { w: 700, solid: 0.7 },
  billboard: { w: 1500, solid: 0.9 },
  chevronL: { w: 420, solid: 0.6 },
  chevronR: { w: 420, solid: 0.6 },
  lamp: { w: 160, solid: 1 },
  gantryPost: { w: 300, solid: 1 },
  house: { w: 2600, solid: 0 },
  barn: { w: 3000, solid: 0 },
  windmill: { w: 1600, solid: 0 },
  cone: { w: 160, solid: 0 },
};

// --- spline ----------------------------------------------------------------

function catmullRom(p0, p1, p2, p3, t, out) {
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0.5) || 1e-4;
  const t1 = d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  for (let k = 0; k < 3; k++) {
    const a1 = ((t1 - tt) / t1) * p0[k] + (tt / t1) * p1[k];
    const a2 = ((t2 - tt) / (t2 - t1)) * p1[k] + ((tt - t1) / (t2 - t1)) * p2[k];
    const a3 = ((t3 - tt) / (t3 - t2)) * p2[k] + ((tt - t2) / (t3 - t2)) * p3[k];
    const b1 = ((t2 - tt) / t2) * a1 + (tt / t2) * a2;
    const b2 = ((t3 - tt) / (t3 - t1)) * a2 + ((tt - t1) / (t3 - t1)) * a3;
    out[k] = ((t2 - tt) / (t2 - t1)) * b1 + ((tt - t1) / (t2 - t1)) * b2;
  }
  return out;
}

const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function buildTrack3D(def) {
  const SL = def.segmentLength;
  const segM = SL / UNITS_PER_METRE;
  const ctrl = def.points.map((p) => [p.p[0], p.y ?? 0, -p.p[1]]);
  const n = ctrl.length;

  // Dense polyline with span index per sample.
  const dense = [];
  const spanOf = [];
  const SAMPLES = 48;
  const tmp = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < SAMPLES; s++) {
      catmullRom(p0, p1, p2, p3, s / SAMPLES, tmp);
      dense.push([tmp[0], tmp[1], tmp[2]]);
      spanOf.push(i);
    }
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const totalM = cum[dense.length];
  const count = Math.round(totalM / segM);
  const step = totalM / count;

  // Resample at equal arc length.
  const pos = [];
  const span = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (cum[j + 1] < s) j++;
    const a = dense[j];
    const b = dense[(j + 1) % dense.length];
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pos.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    span.push(spanOf[j]);
  }

  const at = (i) => pos[((i % count) + count) % count];
  const flagsOf = (i) => def.points[span[i]];

  // Tangents, heading curvature, slope.
  const tangent = [];
  const heading = [];
  for (let i = 0; i < count; i++) {
    const a = at(i - 1);
    const b = at(i + 1);
    const t = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    tangent.push(t);
    heading.push(Math.atan2(t[0], -t[2]));
  }
  const rawK = [];
  for (let i = 0; i < count; i++) {
    let d = heading[(i + 1) % count] - heading[(i - 1 + count) % count];
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d < -Math.PI) d += Math.PI * 2;
    rawK.push(d / (2 * step));
  }
  const K = smooth(rawK, 10);

  const segments = [];
  const up = [0, 1, 0];
  for (let i = 0; i < count; i++) {
    const f = flagsOf(i);
    const T = tangent[i];
    const flat = norm3(cross(T, up));
    const plain = f.bridge || f.noBank;
    const bank = plain ? 0 : clamp(K[i] * 4.6, -MAX_BANK, MAX_BANK);
    const { R, U } = bankedBasis(T, flat, bank);
    segments.push({
      index: i,
      z: i * SL,
      curve: clamp(K[i] * CURVE_PER_CURVATURE, -9, 9),
      slope: T[1] / (Math.hypot(T[0], T[2]) || 1),
      bank,
      bankAssist: Math.min(1, Math.abs(bank) / MAX_BANK) * 0.35,
      rail: !!(f.rail || f.bridge || f.tunnel),
      bridge: !!f.bridge,
      tunnel: !!f.tunnel,
      span: span[i],
      pos: pos[i],
      T,
      R,
      U,
      flatR: flat,
      sprites: [],
    });
  }
  // Smooth bank transitions into/out of bridges.
  const banks = smooth(
    segments.map((s) => s.bank),
    20,
  );
  segments.forEach((s, i) => {
    s.bank = banks[i];
    const b = bankedBasis(s.T, s.flatR, s.bank);
    s.R = b.R;
    s.U = b.U;
  });

  placeScenery(def, segments);

  const roadHalfWidthM = def.roadHalfWidth / UNITS_PER_METRE;
  const length = count * SL;
  const features = buildFeatures(def, segments, step / SL, count);

  const track = {
    def,
    segments,
    count,
    segmentLength: SL,
    length,
    roadHalfWidth: def.roadHalfWidth,
    roadHalfWidthM,
    lanes: def.lanes,
    palette: def.palette,
    metresPerUnit: step / SL,
    ...features,
    findSegment(z) {
      return segments[Math.floor(wrap(z, length) / SL) % count];
    },
    /**
     * World-space frame at track position z (units) and lateral offset x
     * (road half-widths). Writes position and basis into `out`.
     */
    frame(z, x, out) {
      const zz = wrap(z, length) / SL;
      const i = Math.floor(zz) % count;
      const t = zz - Math.floor(zz);
      const a = segments[i];
      const b = segments[(i + 1) % count];
      for (let k = 0; k < 3; k++) {
        out.T[k] = a.T[k] + (b.T[k] - a.T[k]) * t;
        out.R[k] = a.R[k] + (b.R[k] - a.R[k]) * t;
        out.U[k] = a.U[k] + (b.U[k] - a.U[k]) * t;
        out.pos[k] = a.pos[k] + (b.pos[k] - a.pos[k]) * t + out.R[k] * x * roadHalfWidthM;
      }
      return out;
    },
  };
  return track;
}

/** Rotate the flat right vector about the tangent by the bank angle. */
function bankedBasis(T, flat, bank) {
  const up0 = cross(flat, T); // perpendicular to both, pointing up
  const c = Math.cos(bank);
  const sn = Math.sin(bank);
  const R = norm3([flat[0] * c - up0[0] * sn, flat[1] * c - up0[1] * sn, flat[2] * c - up0[2] * sn]);
  const U = norm3(cross(R, T));
  return { R, U };
}

export function makeFrame() {
  return { pos: [0, 0, 0], T: [0, 0, -1], R: [1, 0, 0], U: [0, 1, 0] };
}

// Gameplay features --------------------------------------------------------
// Ramps, boost pads, collectible stars and knock-over cones, authored in
// track data by segment index (`seg`) and lateral position (`x`, road
// half-widths). Converted here to sim units (z) for the session.

export const AIR_GRAVITY = 18; // m/s^2 — floatier than real for fun airtime
export const NOMINAL_JUMP_SPEED = 47; // m/s (about top speed) used to lay stars along jump arcs

function buildFeatures(def, segments, mpu, count) {
  const SL = def.segmentLength;
  const f = def.features || {};
  const ramps = (f.ramps || []).map((r) => {
    const lenSegs = Math.round(r.length / (SL * mpu));
    return {
      z0: r.seg * SL,
      z1: (r.seg + lenSegs) * SL,
      xa: r.x - r.width / 2,
      xb: r.x + r.width / 2,
      x: r.x,
      width: r.width,
      length: r.length,
      height: r.height,
      seg: r.seg,
      segEnd: r.seg + lenSegs,
    };
  });
  for (const r of ramps) for (let i = r.seg; i <= r.segEnd; i++) segments[i % count].ramp = true;
  const boosts = (f.boosts || []).map((b) => {
    const lenSegs = Math.round((b.length || 6) / (SL * mpu));
    return { z0: b.seg * SL, z1: (b.seg + lenSegs) * SL, xa: b.x - b.width / 2, xb: b.x + b.width / 2, x: b.x, width: b.width, seg: b.seg, segEnd: b.seg + lenSegs };
  });
  const stars = [];
  for (const row of f.stars || []) {
    for (let k = 0; k < row.count; k++) stars.push({ z: (row.seg + k * row.every) * SL, x: row.x, h: row.h ?? 0.9 });
  }
  // Arcs of stars along each ramp's jump at a typical speed.
  for (const r of ramps) {
    const vy = (NOMINAL_JUMP_SPEED * r.height) / r.length;
    for (let k = 1; k <= 6; k++) {
      const t = k * 0.2;
      const h = r.height + vy * t - 0.5 * AIR_GRAVITY * t * t;
      if (h < 0.6) break;
      stars.push({ z: r.z1 + (NOMINAL_JUMP_SPEED * t) / mpu, x: r.x, h: h + 0.6 });
    }
  }
  const cones = [];
  for (const row of f.cones || []) {
    for (let k = 0; k < row.count; k++) {
      const x = Array.isArray(row.x) ? row.x[k % row.x.length] : row.x;
      cones.push({ z: (row.seg + k * (row.every || 0)) * SL, x });
    }
  }
  return { ramps, boosts, starDefs: stars, coneDefs: cones };
}

function smooth(arr, radius) {
  const n = arr.length;
  const out = new Array(n);
  let sum = 0;
  for (let k = -radius; k <= radius; k++) sum += arr[(k + n) % n];
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * radius + 1);
    sum += arr[(i + radius + 1) % n] - arr[(i - radius + n) % n];
  }
  return out;
}

function makeObject(kind, offset, extra = {}) {
  const k = OBJECT_KINDS[kind];
  return { kind, offset, w: k.w, solid: k.solid, yaw: 0, scale: 1, ...extra };
}

function placeScenery(def, segments) {
  const rand = mulberry32(def.seed);
  const count = segments.length;
  const blocked = (i) => {
    const s = segments[((i % count) + count) % count];
    return s.bridge || s.tunnel;
  };

  // Start gantry.
  const g = segments[def.gantryAt ?? 4];
  g.gantry = true;
  g.sprites.push(makeObject('gantryPost', -1.28), makeObject('gantryPost', 1.28));

  // Chevrons on the outside of tight corners.
  for (let i = 0; i < count; i += 14) {
    const c = segments[i].curve;
    if (Math.abs(c) >= 3.2 && !blocked(i)) {
      const side = c > 0 ? -1 : 1;
      segments[i].sprites.push(makeObject(c > 0 ? 'chevronR' : 'chevronL', side * 1.32, { yaw: 0 }));
    }
  }

  for (const rule of def.scenery) {
    if (rule.at) {
      for (const a of rule.at) {
        const seg = segments[a.seg % count];
        seg.sprites.push(makeObject(a.kind || rule.kind, a.offset, { yaw: a.yaw ?? 0, scale: a.scale ?? 1 }));
      }
      continue;
    }
    for (let i = rule.from ?? 12; i < (rule.to ?? count); i += rule.every) {
      if (rand() > rule.chance) continue;
      for (const side of rule.side === 'both' ? [-1, 1] : rule.side === 'left' ? [-1] : [1]) {
        const idx = i + Math.floor(rand() * rule.every);
        if (blocked(idx) || blocked(idx + 6) || blocked(idx - 6)) continue;
        const seg = segments[idx % count];
        if (rule.skipRail && seg.rail) continue;
        const offset = side * (rule.offset[0] + rand() * (rule.offset[1] - rule.offset[0]));
        const kind = rule.kinds[Math.floor(rand() * rule.kinds.length)];
        const o = makeObject(kind, offset, { yaw: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.45 });
        if (rule.solid === false) o.solid = 0;
        seg.sprites.push(o);
      }
    }
  }
}
