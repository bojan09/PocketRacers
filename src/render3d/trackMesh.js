// Builds the static track geometry in chunks: road surface, kerbs, lane
// markings, verges, guard rails, bridge deck + pillars, rock tunnels, the
// start gantry, and all placed scenery (merged for few draw calls).

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb, mat4 } from '../gl/math.js';
import { mulberry32 } from '../core/util.js';
import { MODEL_BUILDERS } from './models.js';

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

  const chunks = [];
  for (let c0 = 0; c0 < count; c0 += CHUNK) {
    const mb = new MeshBuilder();
    const c1 = Math.min(count, c0 + CHUNK);

    for (let i = c0; i < c1; i += STEP) {
      const a = at(i);
      const b = at(i + STEP);
      const band = Math.floor(i / 6) % 2;

      // Road surface.
      mb.quad(P(a, -1), P(a, 1), P(b, 1), P(b, -1), band ? road : roadAlt);

      // Kerbs (rumble strips).
      const kc = Math.floor(i / 4) % 2 ? rumbleA : rumbleB;
      mb.quad(P(a, -1.12, 0.02), P(a, -1, 0.02), P(b, -1, 0.02), P(b, -1.12, 0.02), kc);
      mb.quad(P(a, 1, 0.02), P(a, 1.12, 0.02), P(b, 1.12, 0.02), P(b, 1, 0.02), kc);

      // Lane markings: solid edge lines, dashed lane dividers.
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
        mb.quad(P(a, -1.35, -0.12), P(a, -1.12, 0.02), P(b, -1.12, 0.02), P(b, -1.35, -0.12), shoulder);
        mb.quad(P(a, 1.12, 0.02), P(a, 1.35, -0.12), P(b, 1.35, -0.12), P(b, 1.12, 0.02), shoulder);
        mb.quad(P(a, -1.35, -2.5), P(a, -1.35, -0.12), P(b, -1.35, -0.12), P(b, -1.35, -2.5), grass);
        mb.quad(P(a, 1.35, -0.12), P(a, 1.35, -2.5), P(b, 1.35, -2.5), P(b, 1.35, -0.12), grass);
      }

      // Guard rails (bridges get railings in the same place).
      if (a.rail && !a.tunnel) {
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
      const hull = (s) => {
        const r = mulberry32(s.index * 7 + 3);
        const j = () => r() * 3;
        return [
          F(s, -(RW + 1.5), -3),
          F(s, -(RW + 13), 2 + j()),
          F(s, -(RW + 9), 11 + j()),
          F(s, -5, 15 + j()),
          F(s, 5, 14 + j()),
          F(s, RW + 9, 11 + j()),
          F(s, RW + 13, 2 + j()),
          F(s, RW + 1.5, -3),
        ];
      };
      const A = hull(a);
      const B = hull(b);
      for (let k = 0; k < A.length - 1; k++) {
        const shadeK = 0.9 + ((k * 13 + i) % 5) * 0.04;
        mb.quad(A[k], B[k], B[k + 1], A[k + 1], [rockC[0] * shadeK, rockC[1] * shadeK, rockC[2] * shadeK]);
      }
      // Grass caps on top.
      mb.quad(A[3], B[3], B[4], A[4], grass);
      const prev = at(i - 6);
      if (a.tunnel && !prev.tunnel) addPortal(mb, a, F, RW, rockC, -1);
      if (a.tunnel && !b.tunnel) addPortal(mb, b, F, RW, rockC, 1);
    }

    // Start gantry.
    for (let i = c0; i < c1; i++) {
      const s = segs[i];
      if (!s.gantry) continue;
      const postH = 6.6;
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

function addPortal(mb, s, F, RW, rockC, dir) {
  // Stone face joining the rock hull outline to the tunnel opening.
  const stone = [rockC[0] * 0.8, rockC[1] * 0.8, rockC[2] * 0.85];
  const r = mulberry32(s.index * 7 + 3);
  const j = () => r() * 3;
  const o = (p) => [p[0] + s.T[0] * dir * 0.05, p[1], p[2] + s.T[2] * dir * 0.05];
  const outer = [
    F(s, -(RW + 1.5), -3),
    F(s, -(RW + 13), 2 + j()),
    F(s, -(RW + 9), 11 + j()),
    F(s, -5, 15 + j()),
    F(s, 5, 14 + j()),
    F(s, RW + 9, 11 + j()),
    F(s, RW + 13, 2 + j()),
    F(s, RW + 1.5, -3),
  ].map(o);
  const w = 1.22 * RW;
  const inner = [
    F(s, -w, -0.3),
    F(s, -w, 2),
    F(s, -w, 5.6),
    F(s, -0.55 * RW, 7.2),
    F(s, 0.55 * RW, 7.2),
    F(s, w, 5.6),
    F(s, w, 2),
    F(s, w, -0.3),
  ].map(o);
  for (let k = 0; k < outer.length - 1; k++) mb.quad(outer[k], outer[k + 1], inner[k + 1], inner[k], stone);
  // Yellow/black hazard band over the arch.
  const band = (t) => [inner[3][0] + (inner[4][0] - inner[3][0]) * t, inner[3][1] + 0.1, inner[3][2] + (inner[4][2] - inner[3][2]) * t];
  for (let k = 0; k < 8; k++) {
    const a = band(k / 8);
    const b = band((k + 1) / 8);
    const lift = (p, h) => [p[0] + s.T[0] * dir * 0.03, p[1] + h, p[2] + s.T[2] * dir * 0.03];
    mb.quad(lift(a, 0), lift(b, 0), lift(b, 0.7), lift(a, 0.7), k % 2 ? [0.1, 0.1, 0.12] : [1, 0.82, 0.2]);
  }
}
