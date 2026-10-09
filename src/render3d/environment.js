// Distant mountain ring and cloud puffs (the sky itself is a shader).

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';
import { mulberry32 } from '../core/util.js';

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

/** Soft cloud puffs (rendered as camera-facing billboards). */
export function buildCloudPuffs(center, seed = 11) {
  const rand = mulberry32(seed);
  const puffs = [];
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const r = 300 + rand() * 1100;
    const cx = center[0] + Math.cos(a) * r;
    const cz = center[2] + Math.sin(a) * r;
    const cy = 170 + rand() * 120;
    const s = 22 + rand() * 26;
    const n = 6 + Math.floor(rand() * 5);
    for (let k = 0; k < n; k++) {
      const ox = (rand() - 0.5) * s * 3.2;
      const oy = (rand() - 0.3) * s * 0.6;
      const oz = (rand() - 0.5) * s * 1.6;
      // Lighter tops, slightly blue-grey undersides.
      const lift = Math.max(0, Math.min(1, 0.5 + oy / (s * 0.8)));
      const shade = 0.86 + lift * 0.14;
      puffs.push({ baseX: cx + ox, x: cx + ox, y: cy + oy, z: cz + oz, size: s * (0.7 + rand() * 0.6), r: shade, g: shade, b: Math.min(1, shade + 0.05), a: 0.85 });
    }
  }
  return puffs.slice(0, 300);
}
