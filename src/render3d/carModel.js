// Procedural vehicle models. Bodies are smooth lofts: rounded (superellipse)
// cross-sections placed at stations along the vehicle, so each silhouette is
// pure data (see data/vehicleFamilies.js). Paint is baked into vertex colours
// with a glossy clear-coat material; glass, chrome, rubber and lights get
// their own materials.
//
// Model space: metres, x = right, y = up, -z = forward, origin on the ground
// at the centre of the vehicle.

import { MeshBuilder, FLOATS_PER_VERTEX } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
const lerp = (a, b, t) => a + (b - a) * t;
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

const MAT = {
  paint: [0.85, 0],
  glass: [1, 0],
  chrome: [1, 0],
  rubber: [0.05, 0.3],
  plastic: [0.25, 0.2],
  light: [0.9, 0],
};

const BODY_J = 36; // points around a body section
const MAX_STEER = 0.3; // visual front-wheel angle at full lock (radians)
const WELL_GAP = 0.04; // clearance between a tyre and its wheel well
const WELL_DEPTH = 0.06; // inner wall of the well, inside the tyre's inner face
const WELL_EDGE = 0.02; // extra opening around the tyre
const WELL_STEP = 0.05;
const ARCH_WIDTH = 0.13; // width of the trim band around each well // extra loft stations around each wheel (metres)
const CABIN_J = 10; // points over a cabin section

export const LIVERIES = ['clean', 'racing', 'side', 'twotone'];
export const RIM_STYLES = ['spokes', 'star', 'disc', 'steel'];

export function resolvePaint(paint) {
  return {
    body: hexToRgb(paint.body),
    accent: hexToRgb(paint.accent),
    stripe: hexToRgb(paint.stripe),
    rim: hexToRgb(paint.rim),
    tire: hexToRgb(paint.tire || '#23262d'),
    glass: hexToRgb(paint.glass || '#1b2636'),
    trim: [0.09, 0.09, 0.1],
    dark: [0.05, 0.05, 0.06],
    chrome: [0.78, 0.8, 0.84],
    light: [1, 0.98, 0.9],
    amber: [1, 0.62, 0.12],
  };
}

/** Body section: closed superellipse loop starting at the bottom centre. */
function bodySection([z, hw, yb, yt, n = 4], J = BODY_J) {
  const yc = (yb + yt) / 2;
  const hh = (yt - yb) / 2;
  const e = 2 / n;
  const pts = [];
  for (let j = 0; j < J; j++) {
    const t = -Math.PI / 2 + (j / J) * Math.PI * 2;
    pts.push([spow(Math.cos(t), e) * hw, yc + spow(Math.sin(t), e) * hh, z]);
  }
  return pts;
}

/** Cabin section: open arch from the left belt line over the roof to the right. */
function cabinSection([z, hwB, hwT, yb, yt], [ex, ey]) {
  const pts = [];
  for (let j = 0; j < CABIN_J; j++) {
    const t = Math.PI - (j / (CABIN_J - 1)) * Math.PI; // left -> right
    const up = Math.pow(Math.sin(t), ey);
    const hw = lerp(hwB, hwT, up);
    pts.push([spow(Math.cos(t), ex) * hw, yb + up * (yt - yb), z]);
  }
  return pts;
}

/** Body dimensions at position z (for placing arches, lights, mirrors). */
function bodyAt(stations, z) {
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (z >= a[0] && z <= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0] || 1);
      return { hw: lerp(a[1], b[1], t), yb: lerp(a[2], b[2], t), yt: lerp(a[3], b[3], t) };
    }
  }
  const s = z < stations[0][0] ? stations[0] : stations[stations.length - 1];
  return { hw: s[1], yb: s[2], yt: s[3] };
}

/** Glass layout of the cabin strips (front to back). */
function cabinStrips(spec, strips) {
  if (spec.cabinStrips) return spec.cabinStrips;
  const out = [];
  for (let i = 0; i < strips; i++) out.push(i === 0 ? 'wind' : i === strips - 1 ? 'rear' : i === spec.bPillar ? 'solid' : 'side');
  return out;
}

/**
 * Wheel wells: for each tyre, the region (a cylinder around the axle, wide
 * enough for the steering sweep) that the body must stay out of.
 */
function wheelWells(spec, ride) {
  const { radius: r, width: w, positions } = spec.wheels;
  const minZ = Math.min(...positions.map((p) => p[1]));
  const steer = spec.wheels.maxSteer ?? MAX_STEER;
  return positions.map(([x, z]) => {
    const a = z < minZ + 0.3 ? steer : 0;
    const rr = r + WELL_GAP;
    return {
      side: Math.sign(x),
      x,
      z,
      y: r - ride, // body is lifted by `ride` afterwards
      R: rr + (w / 2) * Math.sin(a),
      // Inner wall at height dy above the axle: a steered tyre's corner
      // swings inwards by up to (half-chord at that height) * sin(angle).
      xin: (dy) => Math.abs(x) - (w / 2) * Math.cos(a) - Math.sqrt(Math.max(0, rr * rr - dy * dy)) * Math.sin(a) - WELL_DEPTH,
    };
  });
}

function stationAt(st, z) {
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i];
    const b = st[i + 1];
    if (z >= a[0] && z <= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0] || 1);
      return [z, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4] ?? 4, b[4] ?? 4, t)];
    }
  }
  return null;
}

/** Add loft stations around the wheels so the wells get a smooth outline. */
function densify(st, wells) {
  const out = st.slice();
  const z0 = st[0][0];
  const z1 = st[st.length - 1][0];
  for (const w of wells) {
    for (let z = w.z - w.R - WELL_EDGE - 0.12; z <= w.z + w.R + WELL_EDGE + 0.12; z += WELL_STEP) {
      if (z <= z0 || z >= z1 || out.some((s) => Math.abs(s[0] - z) < 0.02)) continue;
      out.push(stationAt(st, z));
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/**
 * Push body vertices out of the wheel wells (inwards, towards the centre).
 * The carved region is grown by one ring of grid neighbours so the sloped
 * faces at the well's edge always start outside the tyre.
 */
function carve(grid, wells) {
  const I = grid.length;
  const J = grid[0].length;
  const target = (p, grow) => {
    let x = Infinity;
    for (const w of wells) {
      if (Math.sign(p[0]) !== w.side) continue;
      const dy = p[1] - w.y;
      const dz = p[2] - w.z;
      const xin = w.xin(dy);
      const Rc = w.R + WELL_EDGE + (grow ? 0.12 : 0);
      if (Math.abs(p[0]) > xin && dy * dy + dz * dz < Rc * Rc) x = Math.min(x, xin);
    }
    return x;
  };
  const core = grid.map((row) => row.map((p) => target(p, false)));
  const out = [];
  for (let i = 0; i < I; i++) {
    out.push([]);
    for (let j = 0; j < J; j++) {
      let x = core[i][j];
      if (x === Infinity) {
        const near = [
          [i - 1, j],
          [i + 1, j],
          [i, (j + 1) % J],
          [i, (j - 1 + J) % J],
        ].some(([a, b]) => a >= 0 && a < I && core[a][b] !== Infinity);
        if (near) x = target(grid[i][j], true);
      }
      out[i].push(x);
    }
  }
  return grid.map((row, i) =>
    row.map((p, j) => {
      if (out[i][j] === Infinity) return false;
      p[0] = Math.sign(p[0]) * out[i][j];
      return true;
    }),
  );
}

/**
 * Half-width of a loft's side at height y and position z: null outside it or
 * where the surface has curved over into the roof/underside (minSide).
 */
function sectionHalfWidth(st, y, z, minSide = 0) {
  const s = stationAt(st, z);
  if (!s) return null;
  const [, hw, yb, yt, n] = s;
  const hh = (yt - yb) / 2;
  const v = Math.abs((y - (yb + yt) / 2) / hh);
  if (v >= 1) return null;
  const k = Math.pow(1 - Math.pow(v, n), 1 / n);
  return k < minSide ? null : hw * k;
}

/**
 * Fender pods: rounded bulges over wheels that sit taller than the body
 * (low noses), so the wheel well always has bodywork above it.
 */
function fenderPods(st, wells, spec) {
  const pods = [];
  const { width: w } = spec.wheels;
  for (const well of wells) {
    const b = bodyAt(st, well.z);
    const opening = well.y + well.R + WELL_EDGE;
    if (b.yt >= opening + 0.07) continue; // enough body above the well already
    const top = opening + 0.09;
    const hw = w / 2 + 0.07;
    const L = well.R + 0.3;
    const yb = Math.max(0.12, b.yb);
    pods.push({
      x: well.side * (Math.abs(well.x) - 0.01),
      wells: [well],
      J: 22,
      stations: [
        [well.z - L, hw * 0.55, yb + 0.06, top - 0.12, 3],
        [well.z - L * 0.62, hw, yb, top - 0.01, 4],
        [well.z, hw, yb, top, 4.5],
        [well.z + L * 0.62, hw, yb, top - 0.01, 4],
        [well.z + L, hw * 0.55, yb + 0.06, top - 0.12, 3],
      ],
    });
  }
  return pods;
}

/** A closed loft (body or extra panel) coloured by `colourFn(ny, x, i, j)`. */
function loft(mb, stations, colourFn, materialFn, wells = [], wellColour = null, xOffset = 0, J = BODY_J) {
  // Only wells this panel can reach get the extra resolution and carving.
  const z0 = stations[0][0];
  const z1 = stations[stations.length - 1][0];
  const reach = Math.max(...stations.map((st) => st[1]));
  wells = wells.filter((w) => w.z + w.R + 0.2 > z0 && w.z - w.R - 0.2 < z1 && reach + w.side * xOffset > w.xin(0));
  if (wells.length) stations = densify(stations, wells);
  const grid = stations.map((st) => bodySection(st, J).map((p) => [p[0] + xOffset, p[1], p[2]]));
  const carved = carve(grid, wells);
  const inWell = (i, j) => {
    const j1 = (j + 1) % J;
    const i1 = Math.min(i + 1, grid.length - 1);
    return carved[i][j] || carved[i][j1] || carved[i1][j] || carved[i1][j1];
  };
  // Dark only right around the tyre; the rest of a recess keeps the paint.
  const nearTyre = (i, j) => {
    const a = grid[i][j];
    const b = grid[Math.min(i + 1, grid.length - 1)][(j + 1) % J];
    const y = (a[1] + b[1]) / 2;
    const z = (a[2] + b[2]) / 2;
    return wells.some((w) => Math.sign(a[0] + b[0]) === w.side && Math.hypot(y - w.y, z - w.z) < w.R + WELL_EDGE + ARCH_WIDTH);
  };
  const info = (i, j) => {
    const a = grid[i][j];
    const b = grid[i][(j + 1) % J];
    return [Math.sin(-Math.PI / 2 + ((j + 0.5) / J) * Math.PI * 2), (a[0] + b[0]) / 2 - xOffset];
  };
  mb.grid(
    grid,
    (i, j) => {
      if (inWell(i, j) && nearTyre(i, j)) return wellColour;
      const [ny, x] = info(i, j);
      return colourFn(ny, x, i, j);
    },
    { wrapJ: true, materialFn: (i, j) => (inWell(i, j) && nearTyre(i, j) ? MAT.plastic : materialFn(info(i, j)[0])) },
  );
  return grid;
}

/**
 * Build the body mesh (everything except wheels).
 * @param spec  model description (metres)
 * @param paintHex  colours plus `livery` and `ride` (body lift in metres)
 * @returns {{body: MeshBuilder, brake: MeshBuilder, anchors: object}}
 */
export function buildCarBody(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const mb = new MeshBuilder();
  const livery = paintHex.livery ?? (spec.stripes === false ? 'clean' : 'racing');
  const stripeHalf = spec.stripeHalf ?? 0.2;
  const st = spec.body;
  const colourOf = (key) => P[key] || P.body;

  const paintFace = (ny, x) => {
    if (ny < -0.45) return P.dark;
    if (ny < -0.2) return P.trim; // rocker / sill
    if (livery === 'side' && ny > 0 && ny < 0.3) return P.stripe;
    if (livery === 'twotone' && ny > 0.5) return P.accent;
    return P.body;
  };
  const paintMat = (ny) => (ny < -0.2 ? MAT.plastic : MAT.paint);

  // --- Body shell -------------------------------------------------------
  const ride = paintHex.ride || 0;
  const wells = wheelWells(spec, ride);
  const grid = loft(mb, st, paintFace, paintMat, wells, P.dark);
  mb.material(...MAT.paint);
  mb.poly(grid[0].slice().reverse(), shade(P.body, 0.9));
  mb.poly(grid[grid.length - 1], shade(P.body, 0.9));

  // Racing stripes: twin bands laid over the top of the body.
  if (livery === 'racing') {
    mb.material(...MAT.paint);
    for (const sx of [-1, 1]) topStrip(mb, st, sx * stripeHalf * 0.22, sx * stripeHalf, P.stripe);
  }

  // Extra closed panels (truck cab, monster-truck body, ...) and fender pods.
  const pods = spec.arches === false ? [] : fenderPods(st, wells, spec);
  const surfaces = [{ stations: st, x: 0 }];
  for (const l of [...(spec.lofts || []), ...pods]) {
    const base = colourOf(l.paint || 'body');
    const g = loft(mb, l.stations, (ny, x) => (l.paint && l.paint !== 'body' ? (ny < -0.45 ? P.dark : base) : paintFace(ny, x)), paintMat, l.wells || wells, P.dark, l.x || 0, l.J);
    mb.material(...MAT.paint);
    mb.poly(g[0].slice().reverse(), shade(base, 0.9));
    mb.poly(g[g.length - 1], shade(base, 0.9));
    surfaces.push({ stations: l.stations, x: l.x || 0 });
  }
  // Outer skin position at (y, z) on one side, over all body surfaces.
  const skinX = (side, y, z) => {
    let best = null;
    for (const sf of surfaces) {
      const h = sectionHalfWidth(sf.stations, y, z, 0.86);
      if (h === null) continue;
      const x = side * sf.x + h;
      if (best === null || x > best) best = x;
    }
    return best;
  };

  // --- Cabin / glasshouse -----------------------------------------------
  if (spec.cabin) {
    const shape = spec.cabinShape || [0.75, 0.6];
    const cs = spec.cabin.map((c) => cabinSection(c, shape));
    const strips = cabinStrips(spec, cs.length - 1);
    const roofPaint = livery === 'twotone' ? P.accent : P.body;
    const isGlass = (i, j) => {
      const kind = strips[i];
      const outer = j === 0 || j === CABIN_J - 2;
      const roof = j >= 3 && j <= CABIN_J - 5;
      if (kind === 'wind' || kind === 'rear') return !outer;
      if (kind === 'side') return !roof;
      return false;
    };
    mb.grid(cs, (i, j) => (isGlass(i, j) ? P.glass : roofPaint), {
      materialFn: (i, j) => (isGlass(i, j) ? MAT.glass : MAT.paint),
    });
    // Close the cabin ends that are not windows (e.g. a pickup's rear wall
    // is glass, a truck's sleeper back is solid).
    for (const [idx, kind] of [
      [0, strips[0]],
      [cs.length - 1, strips[strips.length - 1]],
    ]) {
      if (kind === 'solid') {
        mb.material(...MAT.paint);
        mb.poly(idx === 0 ? cs[idx].slice().reverse() : cs[idx], shade(roofPaint, 0.9));
      }
    }
    // Roof stripes.
    if (livery === 'racing') {
      const mid = Math.floor(CABIN_J / 2);
      mb.material(...MAT.paint);
      for (let i = 1; i < cs.length - 2; i++) {
        const a = cs[i][mid];
        const b = cs[i + 1][mid];
        for (const sx of [-1, 1]) {
          const w0 = sx * stripeHalf * 0.2;
          const w1 = sx * stripeHalf * 0.8;
          mb.quad([w0, a[1] + 0.004, a[2]], [w1, a[1] + 0.004, a[2]], [w1, b[1] + 0.004, b[2]], [w0, b[1] + 0.004, b[2]], P.stripe);
        }
      }
    }
    // Side mirrors at the A-pillar base.
    if (spec.mirrors !== false) {
      const c1 = spec.cabin[0];
      const big = spec.mirrors === 'truck';
      for (const sx of [-1, 1]) {
        const mz = c1[0] + (big ? 0.15 : 0.35);
        const my = c1[3] + (big ? 0.35 : 0.06);
        mb.material(...MAT.paint);
        mb.box(sx * (c1[1] + 0.06), my - 0.03, mz, big ? 0.1 : 0.05, 0.015, 0.03, P.trim);
        mb.box(sx * (c1[1] + (big ? 0.2 : 0.13)), my, mz, big ? 0.06 : 0.07, big ? 0.2 : 0.04, 0.05, big ? P.trim : P.body, 0, 0.85);
        mb.material(...MAT.chrome);
        mb.box(sx * (c1[1] + (big ? 0.2 : 0.13)), my, mz + 0.052, big ? 0.05 : 0.06, big ? 0.18 : 0.033, 0.004, [0.75, 0.8, 0.85]);
      }
    }
  }

  // --- Wheel arches: a trim band hugging the body around each well ------
  const r = spec.wheels.radius;
  if (spec.arches !== false) {
    mb.material(...MAT.plastic);
    const trim = spec.archPaint ? colourOf(spec.archPaint) : P.trim;
    const segs = 28;
    for (const w of wells) {
      const rin = w.R + WELL_EDGE;
      const rout = rin + ARCH_WIDTH;
      const at = (a, rr, dx) => {
        const y = w.y + Math.sin(a) * rr;
        const z = w.z + Math.cos(a) * rr;
        const sx = skinX(w.side, y, z);
        return sx === null || y < 0.03 ? null : [w.side * (sx + dx), y, z];
      };
      // Outer edge: narrow the band where the body curves away above it,
      // smoothed so the edge stays a clean curve.
      const ang = (k) => Math.PI * (-0.2 + (1.4 * k) / segs);
      const widest = [];
      for (let k = 0; k <= segs; k++) {
        let rr = rout;
        while (rr > rin + 0.03 && !at(ang(k), rr, 0.018)) rr -= 0.01;
        widest.push(rr);
      }
      const edge = widest.map((_, k) => Math.min(...widest.slice(Math.max(0, k - 2), k + 3)));
      for (let k = 0; k < segs; k++) {
        const a0 = ang(k);
        const a1 = ang(k + 1);
        const i0 = at(a0, rin, 0.018);
        const i1 = at(a1, rin, 0.018);
        const o0 = edge[k] > rin + 0.03 ? at(a0, edge[k], 0.018) : null;
        const o1 = edge[k + 1] > rin + 0.03 ? at(a1, edge[k + 1], 0.018) : null;
        if (!i0 || !i1 || !o0 || !o1) continue;
        mb.quad(i0, i1, o1, o0, trim);
        // Lip turning into the well and an outer edge back to the body, only
        // where the body side was actually cut (not over a curved shoulder).
        const cut = (p) => Math.abs(p[0]) - 0.018 > w.xin(p[1] - w.y) + 0.02;
        if (!cut(i0) || !cut(i1)) continue;
        mb.quad(i0, i1, [i1[0] - w.side * 0.1, i1[1], i1[2]], [i0[0] - w.side * 0.1, i0[1], i0[2]], P.dark);
        mb.quad(o0, o1, [o1[0] - w.side * 0.03, o1[1], o1[2]], [o0[0] - w.side * 0.03, o0[1], o0[2]], trim);
      }
    }
  }

  // --- Lights, grille, plate, diffuser, exhausts ------------------------
  const front = st[0];
  const rear = st[st.length - 1];
  const L = spec.lights || {};
  const fz = L.fz ?? front[0];
  const rz = L.rz ?? rear[0];
  const f1 = bodyAt(st, fz + 0.12);
  const r1 = bodyAt(st, rz - 0.12);
  const fy = L.fy ?? f1.yb + (f1.yt - f1.yb) * 0.66;
  const ry = L.ry ?? r1.yb + (r1.yt - r1.yb) * 0.7;
  const fx = L.fx ?? f1.hw * 0.66;
  const rx = L.rx ?? r1.hw * 0.66;
  const lampW = L.fw ?? f1.hw * 0.17;
  mb.material(...MAT.plastic);
  if (spec.grille !== false) mb.box(0, L.gy ?? front[2] + (front[3] - front[2]) * 0.3, fz - 0.005, L.gw ?? front[1] * 0.5, L.gh ?? 0.06, 0.02, P.dark);
  for (const sx of [-1, 1]) {
    mb.material(...MAT.chrome);
    mb.box(sx * fx, fy, fz + 0.06, lampW * 1.18, 0.055, 0.06, [0.7, 0.72, 0.76]);
    mb.material(...MAT.light);
    mb.box(sx * fx, fy, fz, lampW, 0.042, 0.02, P.light, 0.95);
  }
  mb.material(...MAT.light);
  if (L.rearBar !== false) mb.box(0, ry, rz + 0.01, r1.hw * 0.86, 0.045, 0.02, [0.55, 0.05, 0.08], 0.35);
  for (const sx of [-1, 1]) mb.box(sx * rx, ry, rz + 0.02, r1.hw * 0.2, 0.06, 0.02, [0.9, 0.08, 0.12], 0.55);
  if (spec.rearKit !== false) {
    mb.material(0.3, 0);
    mb.box(0, rear[2] + 0.2, rz + 0.012, 0.24, 0.065, 0.01, [0.96, 0.96, 0.92]);
    mb.material(...MAT.plastic);
    mb.box(0, rear[2] + 0.05, rz - 0.04, r1.hw * 0.78, 0.05, 0.06, P.dark);
  }
  const exhausts = spec.exhausts || [
    [-0.34, rear[2] + 0.07, rz + 0.1],
    [0.34, rear[2] + 0.07, rz + 0.1],
  ];
  if (!spec.exhausts) {
    mb.material(...MAT.chrome);
    for (const sx of [-1, 1]) mb.cylinder(sx * 0.34, rear[2] + 0.07, rz + 0.01, 0.055, 0.07, 10, 'z', [0.82, 0.84, 0.88], [0.05, 0.05, 0.05]);
  }

  // --- Spoiler -------------------------------------------------------------
  if (spec.spoiler) {
    const s = spec.spoiler;
    const d = s.d ?? 0.17;
    if (s.type === 'lip') {
      mb.material(...MAT.paint);
      mb.box(0, s.y, s.z, s.w, 0.03, d, P.accent, 0, 0.9);
    } else {
      mb.material(...MAT.plastic);
      for (const sx of [-1, 1]) mb.box(sx * s.w * 0.6, s.y - (s.post ?? 0.09), s.z, 0.03, s.post ?? 0.09, 0.06, [0.1, 0.1, 0.11]);
      mb.material(...MAT.paint);
      mb.box(0, s.y + 0.02, s.z, s.w, 0.025, d, P.accent, 0, 0.96);
      for (const sx of [-1, 1]) mb.box(sx * s.w, s.y + 0.05, s.z, 0.015, s.plate ?? 0.075, d + 0.03, shade(P.accent, 0.8));
    }
  }

  // --- Family-specific parts (boxes and cylinders) -------------------------
  for (const part of spec.parts || []) addPart(mb, part, P);

  // Brake-light overlay drawn only while braking.
  const brake = new MeshBuilder().material(...MAT.light);
  for (const sx of [-1, 1]) brake.box(sx * rx, ry, rz + 0.03, r1.hw * 0.22, 0.065, 0.02, [1, 0.25, 0.3], 1);
  if (L.rearBar !== false) brake.box(0, ry, rz + 0.02, r1.hw * 0.86, 0.05, 0.02, [1, 0.2, 0.25], 1);

  // Ride height: lift the whole body (not the wheels).
  if (ride) {
    liftY(mb, ride);
    liftY(brake, ride);
  }

  const minZ = Math.min(...spec.wheels.positions.map((p) => p[1]));
  const wheels = spec.wheels.positions.map(([x, z]) => [x, r, z]);
  const bodyTop = Math.max(...st.map((s) => s[3]), ...(spec.cabin || []).map((c) => c[4]), ...(spec.lofts || []).flatMap((l) => l.stations.map((s) => s[3])), spec.height || 0);
  return {
    body: mb,
    brake,
    anchors: {
      wheels,
      steer: wheels.map((w) => w[2] < minZ + 0.3),
      maxSteer: spec.wheels.maxSteer ?? MAX_STEER,
      rearWheels: wheels.filter((w) => w[2] > 0),
      exhausts: exhausts.map((e) => [e[0], e[1] + ride, e[2]]),
      trailY: (spec.trailY ?? 0.42) + ride,
      rearZ: rz,
      frontZ: front[0],
      halfWidth: Math.max(...st.map((s) => s[1]), ...spec.wheels.positions.map((p) => Math.abs(p[0]) + spec.wheels.width / 2)),
      length: rz - front[0],
      height: bodyTop + ride,
    },
  };
}

/** Height of a body section's top surface at lateral position x. */
function topAt([, hw, yb, yt, n = 4], x) {
  const u = Math.min(1, Math.abs(x) / hw);
  return (yb + yt) / 2 + ((yt - yb) / 2) * Math.pow(1 - Math.pow(u, n), 1 / n);
}

/** A thin painted band on top of the body between lateral positions x0..x1. */
function topStrip(mb, st, x0, x1, colour) {
  const lift = 0.006;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i];
    const b = st[i + 1];
    // Skip where the band would run off a narrow nose or tail.
    if (Math.max(Math.abs(x0), Math.abs(x1)) > Math.min(a[1], b[1]) * 0.8) continue;
    const p = (s, x) => [x, topAt(s, x) + lift, s[0]];
    mb.quad(p(a, x0), p(a, x1), p(b, x1), p(b, x0), colour);
  }
}

function liftY(mb, dy) {
  const d = mb.data;
  for (let i = 1; i < mb.length; i += FLOATS_PER_VERTEX) d[i] += dy;
}

/**
 * Part: { box: [x, y, z, hx, hy, hz], top?, paint, mat?, emissive?, mirror? }
 *    or { cyl: [x, y, z, r, halfLen, axis], sides?, topR?, paint, cap?, mat?, mirror? }
 * `paint` is a paint key (body, accent, stripe, trim, dark, chrome, light, amber, rim, glass)
 * or an [r, g, b] colour. `mirror` repeats the part at -x.
 */
function addPart(mb, part, P) {
  const colour = Array.isArray(part.paint) ? part.paint : P[part.paint || 'body'];
  const mat = MAT[part.mat || (part.paint === 'chrome' ? 'chrome' : part.paint === 'light' || part.paint === 'amber' ? 'light' : ['trim', 'dark'].includes(part.paint) ? 'plastic' : 'paint')];
  mb.material(...mat);
  const xs = part.mirror ? [1, -1] : [1];
  for (const sx of xs) {
    if (part.box) {
      const [x, y, z, hx, hy, hz] = part.box;
      mb.box(x * sx, y, z, hx, hy, hz, colour, part.emissive || 0, part.top ?? 1);
    } else if (part.cyl) {
      const [x, y, z, rad, half, axis] = part.cyl;
      const cap = part.cap ? (Array.isArray(part.cap) ? part.cap : P[part.cap]) : colour;
      mb.cylinder(x * sx, y, z, rad, half, part.sides || 12, axis, colour, cap, part.topR ?? rad);
    }
  }
}

/** One wheel (axis along x), centred at the origin. */
export function buildWheel(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const { radius: r, width: w } = spec.wheels;
  const offroad = spec.wheels.tread === 'offroad';
  const mb = new MeshBuilder();
  const sides = offroad ? 24 : 18;
  // Tyre: rounded profile swept around the axle. Off-road tyres get chunky
  // tread blocks by alternating the tread radius.
  const bead = r * (offroad ? 0.62 : 0.7);
  const shoulder = Math.min(0.07, w * 0.25);
  const profile = [
    [-w / 2, bead],
    [-w / 2, r * 0.86],
    [-w / 2 + shoulder * 0.35, r * 0.97],
    [-w / 2 + shoulder, r],
    [w / 2 - shoulder, r],
    [w / 2 - shoulder * 0.35, r * 0.97],
    [w / 2, r * 0.86],
    [w / 2, bead],
  ];
  const T = [];
  for (let k = 0; k <= sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    const lug = offroad && k % 2 === 1 ? 0.95 : 1;
    T.push(profile.map(([x, rr], j) => {
      const s = j >= 2 && j <= 5 ? lug : 1;
      return [x, Math.cos(a) * rr * s, Math.sin(a) * rr * s];
    }));
  }
  mb.material(...MAT.rubber);
  mb.grid(T, (i, j) => (j === 0 || j === profile.length - 2 ? shade(P.tire, 1.25) : P.tire));

  const style = paintHex.rimStyle || spec.wheels.rimStyle || 'spokes';
  const rr = bead;
  for (const sx of [-1, 1]) {
    const face = sx * (w / 2 - 0.02);
    // Inner face of the tyre so the rim never looks hollow.
    mb.material(...MAT.rubber);
    disc(mb, face - sx * 0.08, rr, shade(P.tire, 0.6));
    // Brake disc and caliper (seen through the spokes).
    mb.material(0.6, 0.2);
    disc(mb, face - sx * 0.05, rr * 0.82, [0.45, 0.46, 0.5]);
    mb.material(...MAT.paint);
    mb.box(face - sx * 0.04, rr * 0.55, 0, 0.025, rr * 0.2, rr * 0.28, P.accent);
    // Rim lip.
    mb.material(...MAT.chrome);
    ring(mb, face, rr * 0.92, rr, shade(P.rim, 1.05));
    if (style === 'disc' || style === 'steel') {
      disc(mb, face + sx * 0.002, rr * 0.92, P.rim);
      if (style === 'steel') {
        // Six round holes and a bolt ring.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          disc(mb, face + sx * 0.004, rr * 0.13, shade(P.rim, 0.35), Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.6);
        }
        ring(mb, face + sx * 0.005, rr * 0.3, rr * 0.36, shade(P.rim, 0.8));
      }
    } else {
      const n = style === 'star' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const half = style === 'star' ? 0.08 : 0.11;
        const pt = (ang, k) => [face, Math.cos(ang) * rr * k, Math.sin(ang) * rr * k];
        const pts = [pt(a - half * 1.6, 0.2), pt(a - half, 0.93), pt(a + half, 0.93), pt(a + half * 1.6, 0.2)];
        mb.quad(pts[0], pts[1], pts[2], pts[3], P.rim);
        // Give the spokes some depth.
        const back = pts.map((p) => [p[0] - sx * 0.03, p[1], p[2]]);
        mb.quad(pts[1], back[1], back[2], pts[2], shade(P.rim, 0.75));
      }
      disc(mb, face + sx * 0.004, rr * 0.24, shade(P.rim, 1.1));
    }
    disc(mb, face + sx * 0.008, rr * 0.09, [0.2, 0.2, 0.22]);
  }
  return mb;
}

function disc(mb, x, radius, colour, cy = 0, cz = 0) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([x, cy + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
  }
  mb.poly(pts, colour);
}

function ring(mb, x, r0, r1, colour) {
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2;
    const a1 = ((i + 1) / 18) * Math.PI * 2;
    mb.quad([x, Math.cos(a0) * r0, Math.sin(a0) * r0], [x, Math.cos(a1) * r0, Math.sin(a1) * r0], [x, Math.cos(a1) * r1, Math.sin(a1) * r1], [x, Math.cos(a0) * r1, Math.sin(a0) * r1], colour);
  }
}
