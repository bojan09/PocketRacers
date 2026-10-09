// Procedural car models. Bodies are smooth lofts: rounded (superellipse)
// cross-sections placed at stations along the car, so each car's silhouette
// is pure data. Paint is baked into vertex colours with a glossy clear-coat
// material; glass, chrome, rubber and lights get their own materials.
//
// Model space: metres, x = right, y = up, -z = forward, origin on the ground
// at the centre of the car.

import { MeshBuilder } from '../gl/meshBuilder.js';
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

const BODY_J = 24; // points around a body section
const CABIN_J = 10; // points over a cabin section

export function resolvePaint(paint) {
  return {
    body: hexToRgb(paint.body),
    accent: hexToRgb(paint.accent),
    stripe: hexToRgb(paint.stripe),
    rim: hexToRgb(paint.rim),
    tire: hexToRgb(paint.tire),
    glass: hexToRgb(paint.glass || '#1b2636'),
  };
}

/** Body section: closed superellipse loop starting at the bottom centre. */
function bodySection([z, hw, yb, yt, n = 4]) {
  const yc = (yb + yt) / 2;
  const hh = (yt - yb) / 2;
  const e = 2 / n;
  const pts = [];
  for (let j = 0; j < BODY_J; j++) {
    const t = -Math.PI / 2 + (j / BODY_J) * Math.PI * 2;
    pts.push([spow(Math.cos(t), e) * hw, yc + spow(Math.sin(t), e) * hh, z]);
  }
  return pts;
}

/** Cabin section: open arch from the left belt line over the roof to the right. */
function cabinSection([z, hwB, hwT, yb, yt]) {
  const pts = [];
  for (let j = 0; j < CABIN_J; j++) {
    const t = Math.PI - (j / (CABIN_J - 1)) * Math.PI; // left -> right
    const up = Math.pow(Math.sin(t), 0.6);
    const hw = lerp(hwB, hwT, up);
    pts.push([spow(Math.cos(t), 0.75) * hw, yb + up * (yt - yb), z]);
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

/**
 * Build the body mesh (everything except wheels).
 * @returns {{body: MeshBuilder, brake: MeshBuilder, anchors: object}}
 */
export function buildCarBody(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const mb = new MeshBuilder();
  const stripes = spec.stripes !== false && paintHex.stripes !== false;
  const stripeHalf = spec.stripeHalf ?? 0.2;
  const under = [0.07, 0.07, 0.08];
  const trim = [0.09, 0.09, 0.1];
  const st = spec.body;

  // --- Body shell -------------------------------------------------------
  const grid = st.map(bodySection);
  const faceInfo = (i, j) => {
    const a = grid[i][j];
    const b = grid[i][(j + 1) % BODY_J];
    return { x: (a[0] + b[0]) / 2, ny: Math.sin(-Math.PI / 2 + ((j + 0.5) / BODY_J) * Math.PI * 2) };
  };
  mb.grid(
    grid,
    (i, j) => {
      const { x, ny } = faceInfo(i, j);
      if (ny < -0.45) return under;
      if (ny < -0.2) return trim; // rocker / sill
      if (stripes && ny > 0.8 && Math.abs(x) < stripeHalf) return P.stripe;
      return P.body;
    },
    {
      wrapJ: true,
      materialFn: (i, j) => (faceInfo(i, j).ny < -0.2 ? MAT.plastic : MAT.paint),
    },
  );
  // Nose and tail caps.
  mb.material(...MAT.paint);
  mb.poly(grid[0].slice().reverse(), shade(P.body, 0.9));
  mb.poly(grid[grid.length - 1], shade(P.body, 0.9));

  // --- Cabin / glasshouse -----------------------------------------------
  if (spec.cabin) {
    const cs = spec.cabin.map(cabinSection);
    const strips = cs.length - 1;
    const bPillar = spec.bPillar ?? -1;
    const isGlass = (i, j) => {
      const outer = j === 0 || j === CABIN_J - 2;
      const roof = j >= 3 && j <= CABIN_J - 5;
      if (i === 0 || i === strips - 1) return !outer; // windscreen / rear window, pillars at the edges
      if (i === bPillar) return false;
      return !roof;
    };
    mb.grid(cs, (i, j) => (isGlass(i, j) ? P.glass : P.body), {
      materialFn: (i, j) => (isGlass(i, j) ? MAT.glass : MAT.paint),
    });
    // Roof stripe.
    if (stripes) {
      const mid = Math.floor(CABIN_J / 2);
      mb.material(...MAT.paint);
      for (let i = 1; i < cs.length - 2; i++) {
        const a = cs[i][mid];
        const b = cs[i + 1][mid];
        const w = stripeHalf * 0.8;
        mb.quad([-w, a[1] + 0.004, a[2]], [w, a[1] + 0.004, a[2]], [w, b[1] + 0.004, b[2]], [-w, b[1] + 0.004, b[2]], P.stripe);
      }
    }
    // Side mirrors at the A-pillar base.
    const c1 = spec.cabin[0];
    for (const sx of [-1, 1]) {
      mb.material(...MAT.paint);
      const mz = c1[0] + 0.35;
      const my = c1[3] + 0.06;
      mb.box(sx * (c1[1] + 0.06), my - 0.03, mz, 0.05, 0.015, 0.03, trim);
      mb.box(sx * (c1[1] + 0.13), my, mz, 0.07, 0.04, 0.05, P.body, 0, 0.85);
      mb.material(...MAT.chrome);
      mb.box(sx * (c1[1] + 0.13), my, mz + 0.052, 0.06, 0.033, 0.004, [0.75, 0.8, 0.85]);
    }
  }

  // --- Wheel arches: dark arcs on the body sides around each wheel -------
  const r = spec.wheels.radius;
  mb.material(...MAT.plastic);
  for (const [wx, wz] of spec.wheels.positions) {
    const side = Math.sign(wx);
    const { hw } = bodyAt(st, wz);
    const x = side * (hw + 0.006);
    const segs = 10;
    const ringPt = (a, rr) => [x, r + Math.sin(a) * rr, wz + Math.cos(a) * rr];
    for (let k = 0; k < segs; k++) {
      const a0 = Math.PI * (0.05 + (0.9 * k) / segs);
      const a1 = Math.PI * (0.05 + (0.9 * (k + 1)) / segs);
      mb.quad(ringPt(a0, r + 0.04), ringPt(a1, r + 0.04), ringPt(a1, r + 0.085), ringPt(a0, r + 0.085), trim);
      // Dark wheel-well void behind the tyre.
      mb.tri([x * 0.97, r, wz], ringPt(a0, r + 0.04), ringPt(a1, r + 0.04), under);
    }
  }

  // --- Lights, grille, plate, diffuser, exhausts ------------------------
  const front = st[0];
  const rear = st[st.length - 1];
  const fz = front[0];
  const rz = rear[0];
  const f1 = bodyAt(st, fz + 0.12);
  const r1 = bodyAt(st, rz - 0.12);
  const fy = f1.yb + (f1.yt - f1.yb) * 0.66;
  const ry = r1.yb + (r1.yt - r1.yb) * 0.7;
  mb.material(...MAT.plastic);
  mb.box(0, front[2] + (front[3] - front[2]) * 0.3, fz - 0.005, front[1] * 0.5, 0.06, 0.02, [0.05, 0.05, 0.06]);
  for (const sx of [-1, 1]) {
    mb.material(...MAT.chrome);
    mb.box(sx * f1.hw * 0.66, fy, fz + 0.06, f1.hw * 0.2, 0.055, 0.06, [0.7, 0.72, 0.76]);
    mb.material(...MAT.light);
    mb.box(sx * f1.hw * 0.66, fy, fz, f1.hw * 0.17, 0.042, 0.02, [1, 0.98, 0.9], 0.95);
  }
  mb.material(...MAT.light);
  mb.box(0, ry, rz + 0.01, r1.hw * 0.86, 0.045, 0.02, [0.55, 0.05, 0.08], 0.35);
  for (const sx of [-1, 1]) mb.box(sx * r1.hw * 0.66, ry, rz + 0.02, r1.hw * 0.2, 0.06, 0.02, [0.9, 0.08, 0.12], 0.55);
  mb.material(0.3, 0);
  mb.box(0, rear[2] + 0.2, rz + 0.012, 0.24, 0.065, 0.01, [0.96, 0.96, 0.92]);
  mb.material(...MAT.plastic);
  mb.box(0, rear[2] + 0.05, rz - 0.04, r1.hw * 0.78, 0.05, 0.06, under);
  mb.material(...MAT.chrome);
  for (const sx of [-1, 1]) mb.cylinder(sx * 0.34, rear[2] + 0.07, rz + 0.01, 0.055, 0.07, 10, 'z', [0.82, 0.84, 0.88], [0.05, 0.05, 0.05]);

  // --- Spoiler -------------------------------------------------------------
  if (spec.spoiler) {
    const s = spec.spoiler;
    mb.material(...MAT.plastic);
    for (const sx of [-1, 1]) mb.box(sx * s.w * 0.6, s.y - 0.09, s.z, 0.03, 0.09, 0.06, [0.1, 0.1, 0.11]);
    mb.material(...MAT.paint);
    mb.box(0, s.y + 0.02, s.z, s.w, 0.025, s.d ?? 0.17, P.accent, 0, 0.96);
    for (const sx of [-1, 1]) mb.box(sx * s.w, s.y + 0.05, s.z, 0.015, 0.075, (s.d ?? 0.17) + 0.03, shade(P.accent, 0.8));
  }

  // --- Extras ----------------------------------------------------------------
  if (spec.roofRack && spec.cabin) {
    const top = Math.max(...spec.cabin.map((q) => q[4]));
    mb.material(...MAT.plastic);
    mb.box(0, top + 0.08, 0.1, 0.62, 0.025, 0.7, [0.12, 0.12, 0.13]);
    mb.material(...MAT.light);
    for (let i = -2; i <= 2; i++) mb.box(i * 0.14, top + 0.12, -0.55, 0.05, 0.03, 0.03, [1, 0.97, 0.8], 0.9);
  }

  // Brake-light overlay drawn only while braking.
  const brake = new MeshBuilder().material(...MAT.light);
  for (const sx of [-1, 1]) brake.box(sx * r1.hw * 0.66, ry, rz + 0.03, r1.hw * 0.22, 0.065, 0.02, [1, 0.25, 0.3], 1);
  brake.box(0, ry, rz + 0.02, r1.hw * 0.86, 0.05, 0.02, [1, 0.2, 0.25], 1);

  const wheels = spec.wheels.positions.map(([x, z]) => [x, r, z]);
  return {
    body: mb,
    brake,
    anchors: {
      wheels,
      exhausts: [
        [-0.34, rear[2] + 0.07, rz + 0.1],
        [0.34, rear[2] + 0.07, rz + 0.1],
      ],
      rearZ: rz,
      halfWidth: Math.max(...st.map((s) => s[1])),
      length: rz - fz,
    },
  };
}

/** One wheel (axis along x), centred at the origin. */
export function buildWheel(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const { radius: r, width: w } = spec.wheels;
  const mb = new MeshBuilder();
  const sides = 18;
  // Tyre: rounded profile swept around the axle.
  const profile = [
    [-w / 2, r * 0.7],
    [-w / 2, r * 0.86],
    [-w / 2 + 0.025, r * 0.97],
    [-w / 2 + 0.07, r],
    [w / 2 - 0.07, r],
    [w / 2 - 0.025, r * 0.97],
    [w / 2, r * 0.86],
    [w / 2, r * 0.7],
  ];
  const T = [];
  for (let k = 0; k <= sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    T.push(profile.map(([x, rr]) => [x, Math.cos(a) * rr, Math.sin(a) * rr]));
  }
  mb.material(...MAT.rubber);
  mb.grid(T, (i, j) => (j === 0 || j === profile.length - 2 ? shade(P.tire, 1.25) : P.tire));

  const style = paintHex.rimStyle || spec.wheels.rimStyle || 'spokes';
  const rr = r * 0.7;
  for (const sx of [-1, 1]) {
    const face = sx * (w / 2 - 0.02);
    // Brake disc and caliper (seen through the spokes).
    mb.material(0.6, 0.2);
    disc(mb, face - sx * 0.05, rr * 0.82, [0.45, 0.46, 0.5]);
    mb.material(...MAT.paint);
    mb.box(face - sx * 0.04, rr * 0.55, 0, 0.025, 0.07, 0.1, P.accent);
    // Rim lip.
    mb.material(...MAT.chrome);
    ring(mb, face, rr * 0.92, rr, shade(P.rim, 1.05));
    if (style === 'disc') {
      disc(mb, face + sx * 0.002, rr * 0.92, P.rim);
    } else {
      const n = style === 'star' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const half = 0.11;
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

function disc(mb, x, radius, colour) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([x, Math.cos(a) * radius, Math.sin(a) * radius]);
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
