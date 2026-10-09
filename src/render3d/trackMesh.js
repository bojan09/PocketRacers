// Builds the static track geometry in chunks: road surface, kerbs, lane
// markings, verges, guard rails, bridge deck + pillars, rock tunnels, the
// start gantry, and all placed scenery (merged for few draw calls).

import { MeshBuilder, faceNormal } from '../gl/meshBuilder.js';
import { hexToRgb, mat4 } from '../gl/math.js';
import { mulberry32 } from '../core/util.js';
import { MODEL_BUILDERS, grassTuft } from './models.js';

export const CHUNK = 60; // segments per chunk
const STEP = 2; // segments per road strip
const FACES_ROAD = new Set(['lamp', 'house', 'barn']);

export function buildTrackChunks(track, terrain) {
  const pal = track.palette;
  const col = (k) => hexToRgb(pal[k]);
  const segs = track.segments;
  const count = track.count;
  const RW = track.roadHalfWidthM;
  const rand = mulberry32(track.def.seed + 9);
  const at = (i) => segs[((i % count) + count) % count];

  // Point on the road surface: lateral x (half-widths) and height h above it.
  const P = (s, x, h = 0) => [
    s.pos[0] + s.R[0] * x * RW + s.U[0] * h,
    s.pos[1] + s.R[1] * x * RW + s.U[1] * h,
    s.pos[2] + s.R[2] * x * RW + s.U[2] * h,
  ];
  // Point using the flat (unbanked) basis and absolute metres.
  const F = (s, xm, ym) => [s.pos[0] + s.flatR[0] * xm, s.pos[1] + ym, s.pos[2] + s.flatR[2] * xm];

  const road = col('road');
  const roadAlt = col('roadAlt');
  const lane = col('lane');
  const rumbleA = col('rumbleA');
  const rumbleB = col('rumbleB');
  const shoulder = col('shoulder');
  const grass = col('grass');
  const rail = col('rail');
  const railPost = col('railPost');
  const tunnel = col('tunnel');
  const rockC = col('rockFace');
  const lightC = col('tunnelLight');
  const deck = [0.62, 0.62, 0.66];

  const models = {};
  const modelFor = (kind) => {
    // A few variants per kind for variety.
    if (!models[kind]) models[kind] = [0, 1, 2].map(() => MODEL_BUILDERS[kind](rand));
    return models[kind][Math.floor(rand() * models[kind].length)];
  };
  const animated = [];
  const m = mat4.create();
  const tufts = [0, 1, 2, 3].map(() => grassTuft(rand));

  const chunks = [];
  for (let c0 = 0; c0 < count; c0 += CHUNK) {
    const mb = new MeshBuilder();
    const c1 = Math.min(count, c0 + CHUNK);

    for (let i = c0; i < c1; i += STEP) {
      const a = at(i);
      const b = at(i + STEP);
      const band = Math.floor(i / 6) % 2;

      // Road surface: asphalt with a faint sheen and the detail texture.
      mb.material(0.12, 1);
      mb.quad(P(a, -1), P(a, 1), P(b, 1), P(b, -1), band ? road : roadAlt);

      // Kerbs (rumble strips).
      const kc = Math.floor(i / 4) % 2 ? rumbleA : rumbleB;
      mb.material(0.2, 0.45);
      mb.quad(P(a, -1.12, 0.02), P(a, -1, 0.02), P(b, -1, 0.02), P(b, -1.12, 0.02), kc);
      mb.quad(P(a, 1, 0.02), P(a, 1.12, 0.02), P(b, 1.12, 0.02), P(b, 1, 0.02), kc);

      // Lane markings: solid edge lines, dashed lane dividers.
      mb.material(0.15, 0.6);
      for (const x of [-0.95, 0.93]) mb.quad(P(a, x, 0.03), P(a, x + 0.02, 0.03), P(b, x + 0.02, 0.03), P(b, x, 0.03), lane);
      if (Math.floor(i / 4) % 3 === 0) {
        for (let l = 1; l < track.lanes; l++) {
          const x = -1 + (2 * l) / track.lanes - 0.009;
          mb.quad(P(a, x, 0.03), P(a, x + 0.018, 0.03), P(b, x + 0.018, 0.03), P(b, x, 0.03), lane);
        }
      }

      // Start / finish chequer.
      if (i < 6) {
        for (let k = 0; k < 10; k++) {
          const x0 = -1 + k * 0.2;
          const dark = (k + Math.floor(i / 2)) % 2;
          mb.quad(P(a, x0, 0.035), P(a, x0 + 0.2, 0.035), P(b, x0 + 0.2, 0.035), P(b, x0, 0.035), dark ? [0.1, 0.11, 0.2] : [1, 1, 1]);
        }
      }

      if (a.bridge) {
        // Deck sides and underside.
        mb.material(0.05, 0.9);
        mb.quad(P(a, -1.12, 0.02), P(b, -1.12, 0.02), P(b, -1.12, -1.3), P(a, -1.12, -1.3), deck);
        mb.quad(P(a, 1.12, 0.02), P(a, 1.12, -1.3), P(b, 1.12, -1.3), P(b, 1.12, 0.02), deck);
        mb.quad(P(a, -1.12, -1.3), P(b, -1.12, -1.3), P(b, 1.12, -1.3), P(a, 1.12, -1.3), [0.45, 0.45, 0.5]);
        if (i % 36 === 0) {
          const bottom = (track.def.waterLevel ?? 0) - 6;
          for (const x of [-0.7, 0.7]) {
            const top = P(a, x, -1.3);
            const hgt = top[1] - bottom;
            mb.box(top[0], bottom + hgt / 2, top[2], 0.9, hgt / 2, 0.9, deck);
          }
        }
      } else if (a.tunnel) {
        // Tunnel walls, arched ceiling and lights.
        mb.material(0.08, 0.9);
        const H = 5.6;
        const Ht = 7.2;
        mb.quad(P(a, -1.22, -0.3), P(b, -1.22, -0.3), P(b, -1.22, H), P(a, -1.22, H), tunnel);
        mb.quad(P(a, 1.22, -0.3), P(a, 1.22, H), P(b, 1.22, H), P(b, 1.22, -0.3), tunnel);
        mb.quad(P(a, -1.22, H), P(b, -1.22, H), P(b, -0.55, Ht), P(a, -0.55, Ht), tunnel);
        mb.quad(P(a, -0.55, Ht), P(b, -0.55, Ht), P(b, 0.55, Ht), P(a, 0.55, Ht), [0.5, 0.52, 0.58]);
        mb.quad(P(a, 0.55, Ht), P(b, 0.55, Ht), P(b, 1.22, H), P(a, 1.22, H), tunnel);
        if (i % 12 === 0) mb.quad(P(a, -0.12, Ht - 0.05), P(a, 0.12, Ht - 0.05), P(b, 0.12, Ht - 0.05), P(b, -0.12, Ht - 0.05), lightC, 1);
        // Walkway kerb inside.
        const walk = [0.75, 0.75, 0.78];
        mb.quad(P(a, -1.22, 0.25), P(a, -1.12, 0.25), P(b, -1.12, 0.25), P(b, -1.22, 0.25), walk);
        mb.quad(P(a, 1.12, 0.25), P(a, 1.22, 0.25), P(b, 1.22, 0.25), P(b, 1.12, 0.25), walk);
        mb.quad(P(a, -1.12, -0.3), P(b, -1.12, -0.3), P(b, -1.12, 0.25), P(a, -1.12, 0.25), walk);
        mb.quad(P(a, 1.12, -0.3), P(a, 1.12, 0.25), P(b, 1.12, 0.25), P(b, 1.12, -0.3), walk);
      } else {
        // Verges sloping down to the terrain so no gaps show.
        mb.material(0, 1);
        mb.quad(P(a, -1.35, -0.12), P(a, -1.12, 0.02), P(b, -1.12, 0.02), P(b, -1.35, -0.12), shoulder);
        mb.quad(P(a, 1.12, 0.02), P(a, 1.35, -0.12), P(b, 1.35, -0.12), P(b, 1.12, 0.02), shoulder);
        mb.quad(P(a, -1.35, -2.5), P(a, -1.35, -0.12), P(b, -1.35, -0.12), P(b, -1.35, -2.5), grass);
        mb.quad(P(a, 1.35, -0.12), P(a, 1.35, -2.5), P(b, 1.35, -2.5), P(b, 1.35, -0.12), grass);
        // Grass tufts scattered along the verges.
        for (const side of [-1, 1]) {
          if (rand() < 0.35) continue;
          const off = side * (1.4 + rand() * 1.4);
          const xm = off * RW;
          const wx = a.pos[0] + a.flatR[0] * xm;
          const wz = a.pos[2] + a.flatR[2] * xm;
          mat4.identity(m);
          mat4.translate(m, m, wx, terrain.sampler.height(wx, wz) - 0.02, wz);
          mat4.rotateY(m, m, rand() * Math.PI * 2);
          mb.append(tufts[Math.floor(rand() * tufts.length)], m);
        }
      }

      // Guard rails (bridges get railings in the same place).
      if (a.rail && !a.tunnel) {
        mb.material(0.7, 0);
        for (const side of [-1, 1]) {
          const x = side * 1.14;
          const beam = a.bridge ? [0.3, 0.55, 0.95] : Math.floor(i / 6) % 2 ? rumbleB : rail;
          mb.quad(P(a, x, 0.45), P(b, x, 0.45), P(b, x, 0.8), P(a, x, 0.8), beam);
          mb.quad(P(a, x, 0.8), P(b, x, 0.8), P(b, x + side * 0.02, 0.8), P(a, x + side * 0.02, 0.8), beam);
          if (i % 6 === 0) {
            const p = P(a, x + side * 0.02, 0.4);
            mb.box(p[0], p[1], p[2], 0.07, 0.42, 0.07, railPost);
          }
        }
      }
    }

    // Tunnel rock hulls + portals for this chunk.
    for (let i = c0; i < c1; i += 6) {
      const a = at(i);
      const b = at(i + 6);
      if (!a.tunnel && !b.tunnel) continue;
      const A = tunnelHull(a, F, RW);
      const B = tunnelHull(b, F, RW);
      // Faceted hill: grassy where the surface faces up, rock on steep sides.
      mb.material(0.03, 1);
      for (let k = 0; k < A.length - 1; k++) {
        const n = faceNormal(A[k], B[k], B[k + 1]);
        const up = n ? Math.abs(n[1]) : 0;
        const vary = 0.9 + ((k * 13 + i) % 5) * 0.035;
        const c = up > 0.72 ? grass : up > 0.5 ? mixRgb(grass, rockC, 0.5) : rockC;
        mb.quad(A[k], B[k], B[k + 1], A[k + 1], [c[0] * vary, c[1] * vary, c[2] * vary]);
      }
      const prev = at(i - 6);
      if (a.tunnel && !prev.tunnel) addPortal(mb, a, F, RW, rockC, -1);
      if (a.tunnel && !b.tunnel) addPortal(mb, b, F, RW, rockC, 1);
    }

    // Jump ramps and boost pads in this chunk.
    for (const r of track.ramps || []) {
      if (r.seg < c0 || r.seg >= c1) continue;
      addRamp(mb, r, at, P);
    }
    for (const b of track.boosts || []) {
      if (b.seg < c0 || b.seg >= c1) continue;
      addBoostPad(mb, b, at, P);
    }

    // Start gantry.
    for (let i = c0; i < c1; i++) {
      const s = segs[i];
      if (!s.gantry) continue;
      const postH = 6.6;
      mb.material(0.35, 0);
      for (const side of [-1, 1]) {
        const p = F(s, side * 1.28 * RW, 0);
        for (let k = 0; k < 11; k++) {
          mb.box(p[0], p[1] + k * 0.6 + 0.3, p[2], 0.35, 0.3, 0.35, k % 2 ? [0.1, 0.11, 0.2] : [1, 1, 1]);
        }
      }
      const L = F(s, -1.28 * RW, postH - 0.9);
      const Rr = F(s, 1.28 * RW, postH - 0.9);
      const L2 = F(s, -1.28 * RW, postH + 0.3);
      const R2 = F(s, 1.28 * RW, postH + 0.3);
      mb.quad(L, Rr, R2, L2, col('rumbleB'));
      const back = s.T.map((v) => -v * 0.5);
      const off = (p) => [p[0] - back[0], p[1], p[2] - back[2]];
      mb.quad(off(L), off(L2), off(R2), off(Rr), col('rumbleB'));
      mb.quad(L2, R2, off(R2), off(L2), [0.95, 0.82, 0.25]);
      // Chequer strip on the face toward the start.
      for (let k = 0; k < 24; k++) {
        const t0 = k / 24;
        const t1 = (k + 1) / 24;
        const lerpP = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
        const yl = (p, dy) => [p[0] + back[0] * 0.04, p[1] + dy, p[2] + back[2] * 0.04];
        const ya = lerpP(L, Rr, t0);
        const yb = lerpP(L, Rr, t1);
        mb.quad(yl(ya, 0.08), yl(yb, 0.08), yl(yb, 0.5), yl(ya, 0.5), k % 2 ? [1, 1, 1] : [0.1, 0.11, 0.2]);
      }
    }

    // Scenery objects.
    for (let i = c0; i < c1; i++) {
      const s = segs[i];
      for (const o of s.sprites) {
        if (o.kind === 'gantryPost') continue;
        const xm = o.offset * RW;
        const wx = s.pos[0] + s.flatR[0] * xm;
        const wz = s.pos[2] + s.flatR[2] * xm;
        const onRoadSide = Math.abs(o.offset) < 1.6;
        const y = onRoadSide ? Math.min(s.pos[1] - 0.1, terrain.sampler.height(wx, wz)) : terrain.sampler.height(wx, wz);
        // Local +z faces the oncoming driver; +x = road right.
        const back = [-s.T[0], 0, -s.T[2]];
        const bl = Math.hypot(back[0], back[2]) || 1;
        back[0] /= bl;
        back[2] /= bl;
        mat4.fromBasis(m, s.flatR, [0, 1, 0], back, [wx, onRoadSide ? s.pos[1] - 0.05 : y, wz]);
        let yaw = o.yaw;
        if (FACES_ROAD.has(o.kind)) yaw += o.offset > 0 ? -Math.PI / 2 : Math.PI / 2;
        if (o.kind === 'chevronL' || o.kind === 'chevronR' || o.kind === 'billboard') yaw = o.yaw || 0;
        mat4.rotateY(m, m, yaw);
        if (o.scale !== 1) mat4.scale(m, m, o.scale);
        mb.append(modelFor(o.kind), m);
        if (o.kind === 'windmill') {
          const hub = mat4.create();
          mat4.translate(hub, m, 0, 10.5, 2.0);
          animated.push({ kind: 'windmill', matrix: hub, speed: 0.6 + rand() * 0.4 });
        }
      }
    }

    chunks.push({ builder: mb, from: c0, to: c1 });
  }
  return { chunks, animated };
}

function addRamp(mb, r, at, P) {
  const n = r.segEnd - r.seg;
  const yellow = [1, 0.8, 0.15];
  const orange = [1, 0.55, 0.1];
  const dark = [0.16, 0.17, 0.2];
  mb.material(0.3, 0.4);
  for (let k = 0; k < n; k++) {
    const a = at(r.seg + k);
    const b = at(r.seg + k + 1);
    const h0 = (k / n) * r.height;
    const h1 = ((k + 1) / n) * r.height;
    // Striped running surface.
    const stripes = 4;
    for (let q = 0; q < stripes; q++) {
      const x0 = r.xa + ((r.xb - r.xa) * q) / stripes;
      const x1 = r.xa + ((r.xb - r.xa) * (q + 1)) / stripes;
      const col = (q + k) % 2 ? yellow : orange;
      mb.quad(P(a, x0, h0 + 0.04), P(a, x1, h0 + 0.04), P(b, x1, h1 + 0.04), P(b, x0, h1 + 0.04), col);
    }
    // Sides.
    mb.quad(P(a, r.xa, 0), P(b, r.xa, 0), P(b, r.xa, h1 + 0.04), P(a, r.xa, h0 + 0.04), dark);
    mb.quad(P(a, r.xb, 0), P(a, r.xb, h0 + 0.04), P(b, r.xb, h1 + 0.04), P(b, r.xb, 0), dark);
  }
  // Back face with hazard chevrons.
  const e = at(r.segEnd);
  const cols = 6;
  for (let q = 0; q < cols; q++) {
    const x0 = r.xa + ((r.xb - r.xa) * q) / cols;
    const x1 = r.xa + ((r.xb - r.xa) * (q + 1)) / cols;
    mb.quad(P(e, x0, 0), P(e, x1, 0), P(e, x1, r.height + 0.04), P(e, x0, r.height + 0.04), q % 2 ? dark : yellow);
  }
}

function addBoostPad(mb, b, at, P) {
  const n = b.segEnd - b.seg;
  mb.material(0.6, 0);
  // Glowing base.
  for (let k = 0; k < n; k++) {
    const a = at(b.seg + k);
    const c = at(b.seg + k + 1);
    mb.quad(P(a, b.xa, 0.045), P(a, b.xb, 0.045), P(c, b.xb, 0.045), P(c, b.xa, 0.045), [0.1, 0.55, 1], 0.55);
  }
  // Three forward-pointing chevrons.
  const hw = (b.xb - b.xa) / 2;
  const arrowLen = Math.max(2, Math.floor(n / 3));
  for (let i = 0; i < 3; i++) {
    const s0 = b.seg + i * arrowLen;
    const tail = at(s0);
    const tip = at(s0 + arrowLen - 1);
    const notch = at(s0 + Math.floor(arrowLen / 2));
    const y = 0.06;
    const L = P(tail, b.x - hw * 0.8, y);
    const R = P(tail, b.x + hw * 0.8, y);
    const T = P(tip, b.x, y);
    const N = P(notch, b.x, y);
    mb.tri(L, N, T, [0.85, 0.97, 1], 1);
    mb.tri(N, R, T, [0.85, 0.97, 1], 1);
  }
}

const HULL_N = 13;

/** Outline of the hill a tunnel runs through, in the segment's flat frame. */
function tunnelHull(s, F, RW) {
  const r = mulberry32(s.index * 7 + 3);
  const pts = [F(s, -(RW + 1.5), -3)];
  const half = RW + 18;
  for (let k = 1; k < HULL_N - 1; k++) {
    const t = (k - 1) / (HULL_N - 3); // 0..1 across the hill
    const x = -half + 2 * half * t;
    const dome = Math.sin(t * Math.PI);
    const y = -1 + Math.pow(dome, 0.7) * 17 + r() * 3.5 * dome;
    pts.push(F(s, x + (r() - 0.5) * 2, y));
  }
  pts.push(F(s, RW + 1.5, -3));
  return pts;
}

function addPortal(mb, s, F, RW, rockC, dir) {
  // Stone face joining the hill outline to the tunnel opening.
  const stone = [rockC[0] * 1.02, rockC[1] * 1.0, rockC[2] * 0.98];
  const o = (p) => [p[0] + s.T[0] * dir * 0.05, p[1], p[2] + s.T[2] * dir * 0.05];
  const outer = tunnelHull(s, F, RW).map(o);
  // Matching opening outline: up the left wall, over the arch, down the right.
  const w = 1.22 * RW;
  const path = [
    [-w, -0.3],
    [-w, 5.6],
    [-0.55 * RW, 7.2],
    [0.55 * RW, 7.2],
    [w, 5.6],
    [w, -0.3],
  ];
  const lens = [];
  let total = 0;
  for (let k = 0; k < path.length - 1; k++) {
    const d = Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]);
    lens.push(d);
    total += d;
  }
  const along = (t) => {
    let d = t * total;
    for (let k = 0; k < lens.length; k++) {
      if (d <= lens[k] || k === lens.length - 1) {
        const u = Math.min(1, d / lens[k]);
        return [path[k][0] + (path[k + 1][0] - path[k][0]) * u, path[k][1] + (path[k + 1][1] - path[k][1]) * u];
      }
      d -= lens[k];
    }
    return path[path.length - 1];
  };
  const inner = outer.map((_, k) => {
    const [x, y] = along(k / (outer.length - 1));
    return o(F(s, x, y));
  });
  mb.material(0.05, 1);
  for (let k = 0; k < outer.length - 1; k++) mb.quad(outer[k], outer[k + 1], inner[k + 1], inner[k], stone);
  // Yellow/black hazard band over the arch.
  const a0 = o(F(s, -0.55 * RW, 7.25));
  const a1 = o(F(s, 0.55 * RW, 7.25));
  mb.material(0.2, 0);
  for (let k = 0; k < 8; k++) {
    const p0 = [a0[0] + (a1[0] - a0[0]) * (k / 8), a0[1], a0[2] + (a1[2] - a0[2]) * (k / 8)];
    const p1 = [a0[0] + (a1[0] - a0[0]) * ((k + 1) / 8), a0[1], a0[2] + (a1[2] - a0[2]) * ((k + 1) / 8)];
    const lift = (p, h) => [p[0] + s.T[0] * dir * 0.03, p[1] + h, p[2] + s.T[2] * dir * 0.03];
    mb.quad(lift(p0, 0), lift(p1, 0), lift(p1, 0.7), lift(p0, 0.7), k % 2 ? [0.1, 0.1, 0.12] : [1, 0.82, 0.2]);
  }
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
