import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D, makeFrame } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';

const track = buildTrack3D(testTrack);
const S = track.segments;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('track is a closed loop with evenly spaced segments', () => {
  assert.ok(track.count > 1000);
  const step = track.segmentLength * track.metresPerUnit;
  for (let i = 0; i < track.count; i++) {
    const d = dist(S[i].pos, S[(i + 1) % track.count].pos);
    assert.ok(Math.abs(d - step) < 0.05, `segment ${i} spacing ${d}`);
  }
});

test('segment bases are orthonormal and upright', () => {
  for (const s of S) {
    for (const v of [s.T, s.R, s.U]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-3);
    assert.ok(Math.abs(dot(s.T, s.R)) < 1e-3);
    assert.ok(Math.abs(dot(s.T, s.U)) < 1e-3);
    assert.ok(Math.abs(dot(s.R, s.U)) < 1e-3);
    assert.ok(s.U[1] > 0.95, 'road is never steeply tilted');
  }
});

test('curvature sign: a clockwise circle bends right (positive)', () => {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (-i / 16) * Math.PI * 2; // clockwise seen from above
    return { p: [Math.cos(a) * 120, Math.sin(a) * 120], y: 0 };
  });
  const c = buildTrack3D({ ...testTrack, points: pts, scenery: [] });
  const avg = c.segments.reduce((s, g) => s + g.curve, 0) / c.count;
  assert.ok(avg > 2.5, `avg curve ${avg}`);
  // Right curves bank with the right side lower.
  assert.ok(c.segments[100].R[1] < 0);
});

test('feature flags: bridge, tunnel and rails exist; corners are drivable', () => {
  assert.ok(S.some((s) => s.bridge));
  assert.ok(S.some((s) => s.tunnel));
  assert.ok(S.every((s) => !s.bridge || s.rail), 'bridges have rails');
  assert.ok(Math.max(...S.map((s) => Math.abs(s.curve))) <= 9);
});

test('frame() interpolates position on the road', () => {
  const f = makeFrame();
  track.frame(S[10].z, 0, f);
  assert.ok(dist(f.pos, S[10].pos) < 1e-6);
  track.frame(S[10].z, 1, f);
  assert.ok(Math.abs(dist(f.pos, S[10].pos) - track.roadHalfWidthM) < 1e-3);
});

test('scenery never stands on another part of the road', () => {
  const RW = track.roadHalfWidthM;
  for (const s of S) {
    for (const o of s.sprites) {
      const x = s.pos[0] + s.flatR[0] * o.offset * RW;
      const z = s.pos[2] + s.flatR[2] * o.offset * RW;
      for (let k = 0; k < S.length; k += 3) {
        const near = Math.min(Math.abs(k - s.index), S.length - Math.abs(k - s.index)) < 30;
        if (near) continue;
        const d = Math.hypot(S[k].pos[0] - x, S[k].pos[2] - z);
        assert.ok(d > RW + 2, `${o.kind} at segment ${s.index} sits on road near ${k}`);
      }
    }
  }
});
