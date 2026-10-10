// Test helper: finds body geometry that intersects a tyre, including the
// space a front tyre sweeps while steering.

import { FLOATS_PER_VERTEX } from '../../src/gl/meshBuilder.js';
import { wheelSize } from '../../src/render3d/carModel.js';

const STEER_SAMPLES = [-1, -0.5, 0, 0.5, 1];

/**
 * @returns {Array<{wheel:number, point:number[]}>} body points inside a tyre
 */
export function tyreIntersections(spec, bodyMesh, anchors, margin = 0.004) {
  const d = bodyMesh.array();
  const hits = [];
  const wheels = anchors.wheels.map((w, i) => ({
    w,
    r: wheelSize(spec.wheels, i).radius - margin,
    hw: wheelSize(spec.wheels, i).width / 2 - margin,
    angles: anchors.steer[i] ? STEER_SAMPLES.map((k) => k * anchors.maxSteer) : [0],
  }));
  const inside = (p) => {
    for (let i = 0; i < wheels.length; i++) {
      const { w, r, hw, angles } = wheels[i];
      const px = p[0] - w[0];
      const py = p[1] - w[1];
      const pz = p[2] - w[2];
      if (Math.abs(py) > r || Math.abs(pz) > r + hw || Math.abs(px) > r + hw) continue;
      for (const a of angles) {
        // Into the tyre's frame (renderer turns it by -a about y).
        const c = Math.cos(a);
        const s = Math.sin(a);
        const lx = c * px - s * pz;
        const lz = s * px + c * pz;
        if (Math.abs(lx) < hw && py * py + lz * lz < r * r) return i;
      }
    }
    return -1;
  };
  const n = d.length / FLOATS_PER_VERTEX;
  const v = (k) => [d[k * FLOATS_PER_VERTEX], d[k * FLOATS_PER_VERTEX + 1], d[k * FLOATS_PER_VERTEX + 2]];
  for (let t = 0; t < n; t += 3) {
    const a = v(t);
    const b = v(t + 1);
    const c = v(t + 2);
    // Sample each triangle on a barycentric grid.
    const N = 6;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const u = i / N;
        const w = j / N;
        const p = [0, 1, 2].map((k) => a[k] * (1 - u - w) + b[k] * u + c[k] * w);
        const hit = inside(p);
        if (hit >= 0) {
          hits.push({ wheel: hit, point: p.map((x) => +x.toFixed(3)) });
          i = N + 1;
          break;
        }
      }
    }
  }
  return hits;
}
