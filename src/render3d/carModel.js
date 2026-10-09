// Procedural low-poly car models. A car body is "lofted" through a list of
// cross-section stations (front to back), so different silhouettes — coupe,
// hatchback, van, buggy — come from data rather than hand-made meshes.
// Paint (body, accent, stripe, rims, tyres, glass) is baked into vertex
// colours; repainting just rebuilds the mesh (a few ms).
//
// Model space: metres, x = right, y = up, -z = forward, origin on the ground
// at the centre of the car.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/** Body cross-section: 8 points from left-bottom round to right-bottom. */
function bodySection(st, stripeHalf) {
  const [z, w, wb, yb, yt] = st;
  const ym = yb + (yt - yb) * 0.5;
  const sw = Math.min(stripeHalf, w * 0.8);
  return [
    [-wb, yb, z],
    [-w, ym, z],
    [-w * 0.86, yt, z],
    [-sw, yt, z],
    [sw, yt, z],
    [w * 0.86, yt, z],
    [w, ym, z],
    [wb, yb, z],
  ];
}

function cabinSection(st) {
  const [z, w, yb, yt] = st;
  return [
    [-w, yb, z],
    [-w * 0.74, yt, z],
    [w * 0.74, yt, z],
    [w, yb, z],
  ];
}

function faceNormalY(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
}

/** Connect consecutive sections with quads; colourFn(k, a, b, c) picks colour. */
function loft(mb, sections, closeBottom, colourFn, capColour) {
  for (let s = 0; s < sections.length - 1; s++) {
    const A = sections[s];
    const B = sections[s + 1];
    const n = A.length;
    const last = closeBottom ? n : n - 1;
    for (let k = 0; k < last; k++) {
      const k2 = (k + 1) % n;
      const col = colourFn(k, A[k], B[k], B[k2]);
      mb.quad(A[k], B[k], B[k2], A[k2], col);
    }
  }
  mb.poly(sections[0], capColour);
  mb.poly(sections[sections.length - 1], capColour);
}

export function resolvePaint(paint) {
  return {
    body: hexToRgb(paint.body),
    accent: hexToRgb(paint.accent),
    stripe: hexToRgb(paint.stripe),
    rim: hexToRgb(paint.rim),
    tire: hexToRgb(paint.tire),
    glass: hexToRgb(paint.glass),
  };
}

/**
 * Build the body mesh (everything except wheels).
 * @returns {{body: MeshBuilder, brake: MeshBuilder, anchors: object}}
 */
export function buildCarBody(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const mb = new MeshBuilder();
  const stripes = spec.stripes !== false && paintHex.stripes !== false;
  const stripeHalf = stripes ? (spec.stripeHalf ?? 0.2) : 0;
  const under = [0.12, 0.12, 0.14];

  // Body.
  const secs = spec.body.map((st) => bodySection(st, stripeHalf || 0.001));
  loft(
    mb,
    secs,
    true,
    (k) => {
      if (k === 7) return under;
      if (k === 0 || k === 6) return shade(P.body, 0.74);
      if (k === 1 || k === 5) return shade(P.body, 1.05);
      if (k === 3) return stripes ? P.stripe : P.body;
      return P.body;
    },
    shade(P.body, 0.95),
  );

  // Cabin / greenhouse: roof faces painted, steep faces are glass.
  if (spec.cabin) {
    const cs = spec.cabin.map(cabinSection);
    loft(
      mb,
      cs,
      false,
      (k, a, b, c) => {
        const ny = faceNormalY(a, b, c);
        if (ny > 0.95) return P.body;
        return P.glass;
      },
      P.glass,
    );
    // Thin roof stripe on top.
    if (stripes && spec.roofStripe !== false) {
      const mid = spec.cabin.filter((s) => s[3] >= Math.max(...spec.cabin.map((q) => q[3])) - 0.02);
      if (mid.length >= 2) {
        const z0 = mid[0][0];
        const z1 = mid[mid.length - 1][0];
        const y = mid[0][3] + 0.006;
        mb.quad([-stripeHalf, y, z0], [stripeHalf, y, z0], [stripeHalf, y, z1], [-stripeHalf, y, z1], P.stripe);
      }
    }
  }

  const front = spec.body[0];
  const rear = spec.body[spec.body.length - 1];
  const fz = front[0] - 0.012;
  const rz = rear[0] + 0.012;
  const fy = front[3] + (front[4] - front[3]) * 0.62;
  const ry = rear[3] + (rear[4] - rear[3]) * 0.66;

  // Front: grille + headlights.
  mb.box(0, front[3] + 0.12, fz, front[1] * 0.42, 0.07, 0.02, [0.1, 0.1, 0.12]);
  for (const sx of [-1, 1]) mb.box(sx * front[1] * 0.66, fy, fz, front[1] * 0.18, 0.05, 0.02, [1, 0.97, 0.85], 0.9);

  // Rear: taillights, plate, diffuser, exhausts.
  for (const sx of [-1, 1]) mb.box(sx * rear[1] * 0.62, ry, rz, rear[1] * 0.22, 0.05, 0.02, [0.85, 0.08, 0.12], 0.5);
  mb.box(0, rear[3] + 0.18, rz, 0.24, 0.07, 0.015, [0.96, 0.96, 0.92]);
  mb.box(0, rear[3] + 0.04, rz - 0.05, rear[1] * 0.8, 0.05, 0.06, under);
  for (const sx of [-1, 1]) mb.cylinder(sx * 0.32, rear[3] + 0.06, rz, 0.05, 0.06, 8, 'z', [0.62, 0.65, 0.7], [0.08, 0.08, 0.08]);

  // Spoiler.
  if (spec.spoiler) {
    const s = spec.spoiler;
    for (const sx of [-1, 1]) mb.box(sx * s.w * 0.62, s.y - 0.08, s.z, 0.04, 0.08, 0.05, shade(P.accent, 0.7));
    mb.box(0, s.y + 0.02, s.z, s.w, 0.03, s.d ?? 0.16, P.accent);
    for (const sx of [-1, 1]) mb.box(sx * s.w, s.y + 0.05, s.z, 0.02, 0.07, (s.d ?? 0.16) + 0.02, shade(P.accent, 0.8));
  }

  // Side mirrors.
  if (spec.cabin) {
    const c0 = spec.cabin[1] || spec.cabin[0];
    for (const sx of [-1, 1]) mb.box(sx * (c0[1] + 0.1), c0[2] + 0.06, c0[0] + 0.05, 0.07, 0.04, 0.05, P.body);
  }

  // Extras: roof rack / light bar for off-roaders, bull bar, etc.
  if (spec.roofRack && spec.cabin) {
    const top = Math.max(...spec.cabin.map((q) => q[3]));
    mb.box(0, top + 0.08, 0.1, 0.62, 0.025, 0.7, [0.15, 0.15, 0.17]);
    for (let i = -2; i <= 2; i++) mb.box(i * 0.14, top + 0.12, -0.55, 0.05, 0.03, 0.03, [1, 0.97, 0.8], 0.9);
  }

  // Brake-light overlay drawn only while braking.
  const brake = new MeshBuilder();
  for (const sx of [-1, 1]) brake.box(sx * rear[1] * 0.62, ry, rz + 0.006, rear[1] * 0.24, 0.06, 0.02, [1, 0.25, 0.3], 1);

  const wheels = spec.wheels.positions.map(([x, z]) => [x, spec.wheels.radius, z]);
  return {
    body: mb,
    brake,
    anchors: {
      wheels,
      exhausts: [
        [-0.32, rear[3] + 0.06, rz + 0.08],
        [0.32, rear[3] + 0.06, rz + 0.08],
      ],
      rearZ: rz,
      halfWidth: Math.max(...spec.body.map((s) => s[1])),
      length: rear[0] - front[0],
    },
  };
}

/** One wheel (axis along x), centred at the origin. */
export function buildWheel(spec, paintHex) {
  const P = resolvePaint(paintHex);
  const { radius: r, width: w } = spec.wheels;
  const mb = new MeshBuilder();
  const sides = 12;
  mb.cylinder(0, 0, 0, r, w / 2, sides, 'x', P.tire, shade(P.tire, 1.3));
  const style = paintHex.rimStyle || spec.wheels.rimStyle || 'spokes';
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.004);
    const rr = r * 0.66;
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      ring.push([x, Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    mb.poly(ring, shade(P.rim, 0.55));
    const x2 = x + sx * 0.006;
    if (style === 'disc') {
      const disc = ring.map((p) => [x2, p[1] * 0.92, p[2] * 0.92]);
      mb.poly(disc, P.rim);
    } else {
      const n = style === 'star' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const a1 = a - 0.18;
        const a2 = a + 0.18;
        mb.tri([x2, 0, 0], [x2, Math.cos(a1) * rr, Math.sin(a1) * rr], [x2, Math.cos(a2) * rr, Math.sin(a2) * rr], P.rim);
      }
    }
    const hub = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hub.push([x2 + sx * 0.004, Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16]);
    }
    mb.poly(hub, shade(P.rim, 1.15));
  }
  return mb;
}
