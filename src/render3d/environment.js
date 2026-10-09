// Sky dome, sun, distant mountain ring and clouds.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';
import { mulberry32 } from '../core/util.js';

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function buildSky(pal) {
  const top = hexToRgb(pal.skyTop);
  const hor = hexToRgb(pal.skyHorizon);
  const fog = hexToRgb(pal.fog);
  const mb = new MeshBuilder();
  const rings = [-0.3, 0, 0.08, 0.22, 0.45, 0.75, 1];
  const colourAt = (y) => (y <= 0 ? fog : mix(hor, top, Math.pow(y, 0.6)));
  const SEG = 24;
  for (let r = 0; r < rings.length - 1; r++) {
    const y0 = rings[r];
    const y1 = rings[r + 1];
    const r0 = Math.sqrt(1 - Math.min(1, y0 * y0));
    const r1 = Math.sqrt(1 - Math.min(1, y1 * y1));
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2;
      const a1 = ((s + 1) / SEG) * Math.PI * 2;
      const p = (rr, y, a) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
      const c0 = colourAt(y0);
      const c1 = colourAt(y1);
      mb.triC(p(r0, y0, a0), p(r1, y1, a0), p(r1, y1, a1), c0, c1, c1);
      mb.triC(p(r0, y0, a0), p(r1, y1, a1), p(r0, y0, a1), c0, c1, c0);
    }
  }
  // Sun disc + glow, placed on the dome toward the light.
  const sd = pal.sunDir;
  const l = Math.hypot(sd[0], sd[1], sd[2]);
  const dir = [sd[0] / l, Math.min(0.35, sd[1] / l), sd[2] / l];
  const dl = Math.hypot(...dir);
  const D = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  const ux = Math.abs(D[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const R = norm(cross(ux, D));
  const U = cross(D, R);
  const sun = hexToRgb(pal.sunColor);
  const disc = (radius, col, dist) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push([
        D[0] * dist + (R[0] * Math.cos(a) + U[0] * Math.sin(a)) * radius,
        D[1] * dist + (R[1] * Math.cos(a) + U[1] * Math.sin(a)) * radius,
        D[2] * dist + (R[2] * Math.cos(a) + U[2] * Math.sin(a)) * radius,
      ]);
    }
    mb.poly(pts, col);
  };
  disc(0.16, mix(hor, sun, 0.45), 0.97);
  disc(0.06, sun, 0.96);
  return mb;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function buildMountains(pal, center, radius, seed = 3) {
  const rand = mulberry32(seed);
  const mb = new MeshBuilder();
  const base = hexToRgb(pal.mountains);
  const snow = hexToRgb(pal.snow);
  // Two rings of broad, overlapping peaks; the far ring is lighter (haze).
  for (const [ring, rr, hMin, hMax, tint] of [
    [0, radius * 1.18, 90, 190, 1.12],
    [1, radius, 50, 120, 1],
  ]) {
    const N = 26;
    for (let i = 0; i < N; i++) {
      const a = ((i + ring * 0.5) / N) * Math.PI * 2;
      const spread = (Math.PI * 2 * 1.7) / N;
      const h = hMin + rand() * (hMax - hMin);
      const r = rr * (0.94 + rand() * 0.12);
      const L = [center[0] + Math.cos(a - spread) * r, -25, center[2] + Math.sin(a - spread) * r];
      const R = [center[0] + Math.cos(a + spread) * r, -25, center[2] + Math.sin(a + spread) * r];
      const sh = (rand() - 0.5) * spread * 0.6;
      const P = [center[0] + Math.cos(a + sh) * r * 1.02, h, center[2] + Math.sin(a + sh) * r * 1.02];
      const M = [center[0] + Math.cos(a) * r * 0.97, h * 0.45, center[2] + Math.sin(a) * r * 0.97];
      const k = (0.86 + rand() * 0.14) * tint;
      const c = [Math.min(1, base[0] * k), Math.min(1, base[1] * k), Math.min(1, base[2] * k)];
      mb.tri(L, M, P, c);
      mb.tri(M, R, P, [c[0] * 0.9, c[1] * 0.9, c[2] * 0.92]);
      if (h > 150) {
        const t = 0.8;
        const lerp3 = (A, B) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + 0.5, A[2] + (B[2] - A[2]) * t];
        mb.tri(lerp3(L, P), lerp3(M, P), [P[0], P[1] + 0.5, P[2]], snow);
        mb.tri(lerp3(M, P), lerp3(R, P), [P[0], P[1] + 0.5, P[2]], snow);
      }
    }
  }
  return mb;
}

export function buildClouds(center, seed = 11) {
  const rand = mulberry32(seed);
  const mb = new MeshBuilder();
  const white = [1, 1, 1];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 250 + rand() * 1100;
    const cx = center[0] + Math.cos(a) * r;
    const cz = center[2] + Math.sin(a) * r;
    const cy = 150 + rand() * 110;
    const s = 14 + rand() * 18;
    for (let k = 0; k < 4; k++) {
      mb.blob(cx + (k - 1.5) * s * 0.9, cy + (k % 2) * s * 0.2, cz + (rand() - 0.5) * s, s, s * 0.42, s * 0.75, white, rand, 0.15, 0.82);
    }
  }
  return mb;
}
