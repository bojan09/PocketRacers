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
const ARCH_WIDTH = 0.07; // width of the trim lip around each well
const CABIN_J = 10; // points over a cabin section

export const LIVERIES = ['clean', 'racing', 'tri', 'side', 'twotone', 'lower', 'split'];
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
/** Radius and width of wheel i (rear wheels may be bigger, e.g. tractors). */
export function wheelSize(wheels, i) {
  const big = wheels.rear && wheels.positions[i][1] > 0;
  return big ? wheels.rear : wheels;
}

function wheelWells(spec, ride) {
  const { positions } = spec.wheels;
  const minZ = Math.min(...positions.map((p) => p[1]));
  const steer = spec.wheels.maxSteer ?? MAX_STEER;
  // Wheels on the centre line (motorbikes) have no wells.
  return positions.flatMap(([x, z], i) => {
    if (Math.abs(x) < 0.01) return [];
    const { radius: r, width: w } = wheelSize(spec.wheels, i);
    const a = z < minZ + 0.3 ? steer : 0;
    const rr = r + WELL_GAP;
    return [{
      side: Math.sign(x),
      x,
      z,
      y: r - ride, // body is lifted by `ride` afterwards
      R: rr + (w / 2) * Math.sin(a),
      // Inner wall at height dy above the axle: a steered tyre's corner
      // swings inwards by up to (half-chord at that height) * sin(angle).
      xin: (dy) => Math.abs(x) - (w / 2) * Math.cos(a) - Math.sqrt(Math.max(0, rr * rr - dy * dy)) * Math.sin(a) - WELL_DEPTH,
    }];
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

/** Inside a well's opening: a round arch above the axle, straight sides below. */
function inOpening(w, dy, dz, Rc = w.R + WELL_EDGE) {
  return dy > 0 ? dy * dy + dz * dz < Rc * Rc : Math.abs(dz) < Rc;
}

/**
 * Cut the wheel openings: body vertices that fall inside an opening (on the
 * outer side of the well) move onto its edge, so the edge is an exact arc
 * rather than following the mesh. Returns per vertex 0 (outside), 1 (moved
 * onto an edge) or 2 (inside an opening but deeper than the well, e.g. the
 * underside); faces made only of edge points, or joining an edge to a point
 * inside, lie in the opening and are dropped.
 */
function carve(grid, wells) {
  return grid.map((row) =>
    row.map((p) => {
      let state = 0;
      for (const w of wells) {
        if (Math.sign(p[0]) !== w.side) continue;
        const Rc = w.R + WELL_EDGE;
        const dy = p[1] - w.y;
        const dz = p[2] - w.z;
        if (!inOpening(w, dy, dz, Rc)) continue;
        if (Math.abs(p[0]) <= w.xin(dy)) {
          state = 2;
          continue;
        }
        if (dy > 0) {
          const k = Rc / (Math.hypot(dy, dz) || 1);
          p[1] = w.y + dy * k;
          p[2] = w.z + dz * k;
        } else {
          p[2] = w.z + (dz < 0 ? -Rc : Rc);
        }
        return 1;
      }
      return state;
    }),
  );
}

/** The outline of a well opening from the bottom of one side, over the arch, to the other. */
function openingOutline(w, yBottom, segs = 24) {
  const Rc = w.R + WELL_EDGE;
  const yb = Math.min(yBottom, w.y);
  const pts = [];
  if (yb < w.y - 0.02) pts.push([yb, w.z - Rc]);
  for (let k = 0; k <= segs; k++) {
    const a = Math.PI - (k / segs) * Math.PI;
    pts.push([w.y + Math.sin(a) * Rc, w.z + Math.cos(a) * Rc]);
  }
  if (yb < w.y - 0.02) pts.push([yb, w.z + Rc]);
  return pts;
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
  const front = st[0][0] + 0.12;
  const rear = st[st.length - 1][0] - 0.12;
  for (const well of wells) {
    const b = bodyAt(st, well.z);
    const opening = well.y + well.R + WELL_EDGE;
    if (b.yt >= opening + 0.07) continue; // enough body above the well already
    const top = opening + 0.09;
    const hw = w / 2 + 0.07;
    const L = well.R + 0.38;
    const yb = Math.max(0.12, b.yb);
    // Ends dip into the body (inside its top and nose), so the pod grows out
    // of the bodywork instead of sitting on it.
    const z0 = Math.max(front, well.z - L);
    const z1 = Math.min(rear, well.z + L);
    const end = (z) => Math.max(yb + 0.1, bodyAt(st, z).yt - 0.04);
    const mid = (z, t) => lerp(end(z), top - 0.01, t);
    pods.push({
      x: well.side * (Math.abs(well.x) - 0.01),
      wells: [well],
      J: 22,
      stations: [
        [z0, hw * 0.5, yb + 0.08, end(z0), 3],
        [lerp(z0, well.z, 0.45), hw * 0.92, yb, mid(lerp(z0, well.z, 0.45), 0.8), 3.6],
        [well.z, hw, yb, top, 4.5],
        [lerp(well.z, z1, 0.55), hw * 0.92, yb, mid(lerp(well.z, z1, 0.55), 0.8), 3.6],
        [z1, hw * 0.5, yb + 0.08, end(z1), 3],
      ],
    });
  }
  return pods;
}

/** A closed loft (body or extra panel) coloured by `colourFn(ny, x, i, j)`. */
function loft(mb, stations, colourFn, materialFn, wells = [], xOffset = 0, J = BODY_J) {
  // Only wells this panel can reach get the extra resolution and carving.
  const z0 = stations[0][0];
  const z1 = stations[stations.length - 1][0];
  const reach = Math.max(...stations.map((st) => st[1]));
  wells = wells.filter((w) => w.z + w.R + 0.2 > z0 && w.z - w.R - 0.2 < z1 && reach + w.side * xOffset > w.xin(0));
  if (wells.length) stations = densify(stations, wells);
  const grid = stations.map((st) => bodySection(st, J).map((p) => [p[0] + xOffset, p[1], p[2]]));
  const edge = carve(grid, wells);
  const I = grid.length;
  const opening = (i, j) => {
    const j1 = (j + 1) % J;
    const i1 = Math.min(i + 1, I - 1);
    const c = [edge[i][j], edge[i][j1], edge[i1][j], edge[i1][j1]];
    return c.every((v) => v === 1) || (c.includes(1) && c.includes(2));
  };
  const info = (i, j) => {
    const a = grid[i][j];
    const b = grid[i][(j + 1) % J];
    const c = grid[Math.min(i + 1, I - 1)][j];
    return [Math.sin(-Math.PI / 2 + ((j + 0.5) / J) * Math.PI * 2), (a[0] + b[0]) / 2 - xOffset, (a[2] + c[2]) / 2];
  };
  mb.grid(
    grid,
    (i, j) => {
      const [ny, x, z] = info(i, j);
      return colourFn(ny, x, z);
    },
    { wrapJ: true, materialFn: (i, j) => materialFn(info(i, j)[0]), skipFn: opening },
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

  const midZ = (st[0][0] + st[st.length - 1][0]) / 2;
  const paintFace = (ny, x, z = 0) => {
    if (ny < -0.45) return P.dark;
    if (ny < -0.2) return P.trim; // rocker / sill
    if (livery === 'lower' && ny < 0.05) return P.accent;
    if (livery === 'split' && z < midZ) return P.accent;
    if (livery === 'side' && ny > 0 && ny < 0.3) return P.stripe;
    if (livery === 'twotone' && ny > 0.5) return P.accent;
    return P.body;
  };
  const paintMat = (ny) => (ny < -0.2 ? MAT.plastic : MAT.paint);
  // Lower panels catch less sky light: a soft gradient grounds the car.
  const grounded = (c, ny) => {
    const t = Math.min(1, Math.max(0, (ny + 0.5) / 0.85));
    return shade(c, 0.8 + 0.2 * t * t * (3 - 2 * t));
  };
  const bodyPaint = (ny, x, z) => grounded(paintFace(ny, x, z), ny);

  // --- Body shell -------------------------------------------------------
  const ride = paintHex.ride || 0;
  const wells = wheelWells(spec, ride);
  const grid = loft(mb, st, bodyPaint, paintMat, wells);
  mb.material(...MAT.paint);
  mb.poly(grid[0].slice().reverse(), shade(P.body, 0.9));
  mb.poly(grid[grid.length - 1], shade(P.body, 0.9));

  // Racing stripes: twin bands laid over the top of the body.
  if (livery === 'racing') {
    mb.material(...MAT.paint);
    for (const sx of [-1, 1]) topStrip(mb, st, sx * stripeHalf * 0.22, sx * stripeHalf, P.stripe);
  } else if (livery === 'tri') {
    // Three thin stripes: white-ish centre, accent either side.
    mb.material(...MAT.paint);
    topStrip(mb, st, -stripeHalf * 0.18, stripeHalf * 0.18, P.stripe);
    for (const sx of [-1, 1]) topStrip(mb, st, sx * stripeHalf * 0.38, sx * stripeHalf * 0.62, P.accent);
  }

  // Extra closed panels (truck cab, monster-truck body, ...) and fender pods.
  const pods = spec.arches === false ? [] : fenderPods(st, wells, spec);
  const surfaces = [{ stations: st, x: 0 }];
  for (const l of [...(spec.lofts || []), ...pods]) {
    const base = colourOf(l.paint || 'body');
    const g = loft(mb, l.stations, (ny, x, z) => (l.paint && l.paint !== 'body' ? (ny < -0.45 ? P.dark : grounded(base, ny)) : bodyPaint(ny, x, z)), paintMat, l.wells || wells, l.x || 0, l.J);
    mb.material(...MAT.paint);
    mb.poly(g[0].slice().reverse(), shade(base, 0.9));
    mb.poly(g[g.length - 1], shade(base, 0.9));
    surfaces.push({ stations: l.stations, x: l.x || 0 });
  }
  // Outer skin position at (y, z) on one side, over all body surfaces.
  const skinX = (side, y, z, minSide = 0.86) => {
    let best = null;
    for (const sf of surfaces) {
      const h = sectionHalfWidth(sf.stations, y, z, minSide);
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
    const roofPaint = livery === 'twotone' || livery === 'tri' ? P.accent : P.body;
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

  // --- Door seams: thin shut lines on the body side ------------------------
  if (spec.cabin && !spec.cabinStrips && spec.doors !== false) {
    const c = spec.cabin;
    const zA = c[1][0] - 0.02;
    const zB = spec.bPillar ? c[spec.bPillar][0] + 0.06 : lerp(c[1][0], c[c.length - 2][0], 0.8);
    const seams = [zA, zB];
    if (spec.bPillar && c.length > spec.bPillar + 2) seams.push(lerp(zB, c[c.length - 2][0], 0.85));
    mb.material(...MAT.plastic);
    for (const z of seams) {
      const b = bodyAt(st, z);
      const y0 = b.yb + (b.yt - b.yb) * 0.22;
      const y1 = b.yt - 0.03;
      for (const side of [-1, 1]) {
        const N = 8;
        for (let k = 0; k < N; k++) {
          const ya = lerp(y0, y1, k / N);
          const yb2 = lerp(y0, y1, (k + 1) / N);
          if (wells.some((w) => w.side === side && (inOpening(w, ya - w.y, z - w.z, w.R + WELL_EDGE + ARCH_WIDTH) || inOpening(w, yb2 - w.y, z - w.z, w.R + WELL_EDGE + ARCH_WIDTH)))) continue;
          const xa = skinX(side, ya, z, 0.3);
          const xb = skinX(side, yb2, z, 0.3);
          if (xa === null || xb === null) continue;
          const o = 0.004;
          mb.quad([side * (xa + o), ya, z - 0.007], [side * (xb + o), yb2, z - 0.007], [side * (xb + o), yb2, z + 0.007], [side * (xa + o), ya, z + 0.007], shade(P.body, 0.35));
        }
      }
    }
  }

  // --- Wheel wells: dark liner and inner wall, plus an arch trim lip ---------
  const r = spec.wheels.radius;
  for (const w of wells) {
    const xin = (y) => w.side * w.xin(y - w.y);
    const yBottom = Math.min(...surfaces.map((sf) => (stationAt(sf.stations, w.z) || [0, 0, 9])[2]));
    const outline = openingOutline(w, yBottom);
    // Liner: from the body skin at the opening's edge in to the inner wall.
    mb.material(...MAT.rubber);
    for (let k = 0; k < outline.length - 1; k++) {
      const [ya, za] = outline[k];
      const [yb, zb] = outline[k + 1];
      const xa = skinX(w.side, ya, za, 0);
      const xb = skinX(w.side, yb, zb, 0);
      if (xa === null || xb === null || xa < w.xin(ya - w.y) || xb < w.xin(yb - w.y)) continue;
      mb.quad([w.side * xa, ya, za], [w.side * xb, yb, zb], [xin(yb), yb, zb], [xin(ya), ya, za], P.dark);
    }
    // Inner wall closing the well.
    const c = [xin(w.y), w.y, w.z];
    for (let k = 0; k < outline.length - 1; k++) {
      const [ya, za] = outline[k];
      const [yb, zb] = outline[k + 1];
      mb.tri(c, [xin(ya), ya, za], [xin(yb), yb, zb], P.dark);
    }
    if (outline[0][0] < w.y - 0.02) mb.tri(c, [xin(outline.at(-1)[0]), outline.at(-1)[0], outline.at(-1)[1]], [xin(outline[0][0]), outline[0][0], outline[0][1]], P.dark);

    // Trim lip: a thin band standing just proud of the body around the arch.
    if (spec.arches === false) continue;
    mb.material(...MAT.plastic);
    const trim = spec.archPaint ? colourOf(spec.archPaint) : P.trim;
    const Rc = w.R + WELL_EDGE;
    const band = (rr, out) => (k) => {
      const [y, z] = outline[k];
      const dy = y - w.y;
      const dz = z - w.z;
      // Grow outward from the axle above it, sideways below it.
      const g = dy > 0 ? rr / Rc : 1;
      const yy = dy > 0 ? w.y + dy * g : y;
      const zz = dy > 0 ? w.z + dz * g : w.z + Math.sign(dz) * rr;
      const sx = skinX(w.side, yy, zz);
      return sx === null ? null : [w.side * (sx + out), yy, zz];
    };
    // Starts just inside the opening so it doesn't fight with the liner.
    const inner = band(Rc - 0.015, 0.022);
    const outer = band(Rc + ARCH_WIDTH, 0.004);
    for (let k = 0; k < outline.length - 1; k++) {
      const i0 = inner(k);
      const i1 = inner(k + 1);
      const o0 = outer(k);
      const o1 = outer(k + 1);
      if (!i0 || !i1 || !o0 || !o1 || i0[1] < 0.05 || i1[1] < 0.05) continue;
      if (Math.abs(i0[0]) < w.xin(i0[1] - w.y) || Math.abs(i1[0]) < w.xin(i1[1] - w.y)) continue;
      // Only where the side is close to upright (not over a curved shoulder).
      if (Math.abs(o0[0] - i0[0]) > 0.04 || Math.abs(o1[0] - i1[0]) > 0.04) continue;
      mb.quad(i0, i1, o1, o0, trim);
      // The lip's edge turning into the well.
      mb.quad(i0, i1, [i1[0] - w.side * 0.04, i1[1], i1[2]], [i0[0] - w.side * 0.04, i0[1], i0[2]], trim);
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
  for (const sx of L.front === false ? [] : [-1, 1]) {
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

  // --- Spoiler (resting on the surface below it) ---------------------------
  if (spec.spoiler) {
    const s = spec.spoiler;
    const d = s.d ?? 0.17;
    if (s.type === 'lip') {
      // Front edge on the roof or boot lid, overhanging behind.
      const y = surfaceTop(spec, 0, s.z - d * 0.6) + 0.03;
      mb.material(...MAT.paint);
      mb.box(0, y, s.z, s.w, 0.03, d, P.accent, 0, 0.9);
    } else {
      const post = s.post ?? 0.09;
      const base = Math.max(surfaceTop(spec, s.w * 0.6, s.z), surfaceTop(spec, -s.w * 0.6, s.z));
      const y = Number.isFinite(base) ? base - 0.01 + post * 2 : s.y;
      mb.material(...MAT.plastic);
      for (const sx of [-1, 1]) mb.box(sx * s.w * 0.6, y - post, s.z, 0.03, post + 0.01, 0.06, [0.1, 0.1, 0.11]);
      mb.material(...MAT.paint);
      mb.box(0, y + 0.02, s.z, s.w, 0.025, d, P.accent, 0, 0.96);
      for (const sx of [-1, 1]) mb.box(sx * s.w, y + 0.05, s.z, 0.015, s.plate ?? 0.075, d + 0.03, shade(P.accent, 0.8));
    }
  }

  // --- Roof rails: bars on feet standing on the roof ------------------------
  if (spec.roofRails) {
    const { x, z0, z1 } = spec.roofRails;
    let top = -Infinity;
    for (let z = z0; z <= z1; z += 0.05) top = Math.max(top, surfaceTop(spec, x, z));
    const bar = top + 0.06;
    mb.material(...MAT.plastic);
    for (const sx of [-1, 1]) {
      mb.box(sx * x, bar, (z0 + z1) / 2, 0.028, 0.022, (z1 - z0) / 2 + 0.04, P.trim);
      for (const z of [z0, (z0 + z1) / 2, z1]) {
        const foot = surfaceTop(spec, x, z);
        mb.box(sx * x, (foot + bar) / 2 - 0.01, z, 0.032, (bar - foot) / 2 + 0.01, 0.05, P.trim);
      }
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
  const wheels = spec.wheels.positions.map(([x, z], i) => [x, wheelSize(spec.wheels, i).radius, z]);
  // The wheel mesh is built at the base size; bigger wheels are scaled.
  const wheelScale = spec.wheels.positions.map((_, i) => {
    const ws = wheelSize(spec.wheels, i);
    return [ws.width / spec.wheels.width, ws.radius / r, ws.radius / r];
  });
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
      wheelScale,
      bike: !!spec.bike,
      halfWidth: Math.max(...st.map((s) => s[1]), ...spec.wheels.positions.map((p, i) => Math.abs(p[0]) + wheelSize(spec.wheels, i).width / 2)),
      length: rz - front[0],
      height: bodyTop + ride,
      neon: spec.neon || null,
    },
  };
}

/** Height of the cabin roof at (x, z); -Infinity off the cabin. */
function cabinTopAt(spec, x, z) {
  const c = spec.cabin;
  if (!c || z < c[0][0] || z > c[c.length - 1][0]) return -Infinity;
  let i = 0;
  while (i < c.length - 2 && z > c[i + 1][0]) i++;
  const t = (z - c[i][0]) / (c[i + 1][0] - c[i][0] || 1);
  const [hwB, hwT, yb, yt] = [1, 2, 3, 4].map((k) => lerp(c[i][k], c[i + 1][k], t));
  const [ex, ey] = spec.cabinShape || [0.75, 0.6];
  // Same curve as cabinSection: walk the arch angle until it reaches |x|.
  const xAt = (a) => spow(Math.cos(a), ex) * lerp(hwB, hwT, Math.pow(Math.sin(a), ey));
  const ax = Math.abs(x);
  if (ax > xAt(0)) return -Infinity;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (xAt(mid) > ax) lo = mid;
    else hi = mid;
  }
  return yb + Math.pow(Math.sin(lo), ey) * (yt - yb);
}

/** Top of the vehicle's shell (body, cabin, extra lofts) at (x, z). */
function surfaceTop(spec, x, z) {
  let y = cabinTopAt(spec, x, z);
  for (const sts of [spec.body, ...(spec.lofts || []).map((l) => l.stations)]) {
    const s = stationAt(sts, z);
    if (s && Math.abs(x) < s[1]) y = Math.max(y, topAt(s, x));
  }
  return y;
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
    } else if (part.sphere) {
      const [x, y, z, rx, ry, rz] = part.sphere;
      mb.sphere(x * sx, y, z, rx, ry, rz, colour, { segs: 12, rings: 7 });
    } else if (part.cyl) {
      const [x, y, z, rad, half, axis] = part.cyl;
      const cap = part.cap ? (Array.isArray(part.cap) ? part.cap : P[part.cap]) : colour;
      mb.cylinder(x * sx, y, z, rad, half, part.sides || 12, axis, colour, cap, part.topR ?? rad);
    } else if (part.limb) {
      // A rounded tube between two points (a rider's arm or leg).
      const [x0, y0, z0, x1, y1, z1, rad] = part.limb;
      limb(mb, [x0 * sx, y0, z0], [x1 * sx, y1, z1], rad, colour);
    } else if (part.prism) {
      // A side profile [[y, z], ...] (convex from its first point) extruded
      // across x, e.g. a fin.
      const [x, hx, profile] = part.prism;
      const L = profile.map(([y, z]) => [x * sx - hx, y, z]);
      const R = profile.map(([y, z]) => [x * sx + hx, y, z]);
      mb.poly([...L].reverse(), colour);
      mb.poly(R, colour);
      for (let i = 0; i < profile.length; i++) {
        const j = (i + 1) % profile.length;
        mb.quad(L[i], L[j], R[j], R[i], colour);
      }
    }
  }
}

/** Tube with rounded ends from a to b. */
function limb(mb, a, b, rad, colour, sides = 8) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const t = d.map((v) => v / len);
  // Any vector not parallel to the tube, then two perpendiculars.
  const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]];
  const ul = Math.hypot(...u);
  for (let k = 0; k < 3; k++) u[k] /= ul;
  const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
  const ring = (c) =>
    Array.from({ length: sides }, (_, i) => {
      const ang = (i / sides) * Math.PI * 2;
      const n = [0, 1, 2].map((k) => u[k] * Math.cos(ang) + v[k] * Math.sin(ang));
      return { p: [0, 1, 2].map((k) => c[k] + n[k] * rad), n };
    });
  const A = ring(a);
  const B = ring(b);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    mb.triS(A[i].p, B[i].p, B[j].p, A[i].n, B[i].n, B[j].n, colour);
    mb.triS(A[i].p, B[j].p, A[j].p, A[i].n, B[j].n, A[j].n, colour);
  }
  for (const c of [a, b]) mb.sphere(c[0], c[1], c[2], rad, rad, rad, colour, { segs: 8, rings: 5 });
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
