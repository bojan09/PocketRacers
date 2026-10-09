import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import { TRACKS } from '../../src/data/tracks/index.js';

// Every map must be a valid, drivable loop with sensible features.
for (const def of TRACKS) {
  const T = buildTrack3D(def);
  const S = T.segments;
  const N = S.length;
  const RW = T.roadHalfWidthM;

  test(`${def.name}: drivable corners, gentle slopes, no overlapping road`, () => {
    assert.ok(Math.max(...S.map((s) => Math.abs(s.curve))) <= 9);
    assert.ok(Math.max(...S.map((s) => Math.abs(s.slope || 0))) < 0.09);
    for (let i = 0; i < N; i += 6) {
      for (let k = 0; k < N; k += 6) {
        if (Math.min(Math.abs(i - k), N - Math.abs(i - k)) < 120) continue;
        const d = Math.hypot(S[i].pos[0] - S[k].pos[0], S[i].pos[2] - S[k].pos[2]);
        assert.ok(d > RW * 4, `road ${i} too close to ${k} (${d.toFixed(1)} m)`);
      }
    }
  });

  test(`${def.name}: features sit on the road, ramps on straights`, () => {
    assert.ok(T.ramps.length >= 3 && T.boosts.length >= 3 && T.starDefs.length > 15 && T.coneDefs.length > 5);
    for (const r of T.ramps) {
      for (let k = -5; k < 60; k++) {
        const s = S[(r.seg + k + N) % N];
        assert.ok(!s.tunnel && !s.bridge, `ramp at ${r.seg} hits a tunnel/bridge`);
        assert.ok(Math.abs(s.curve) < 3.5, `ramp at ${r.seg} on a bend (${s.curve.toFixed(2)})`);
      }
    }
    for (const x of [...T.ramps, ...T.boosts].map((f) => [f.xa, f.xb]).flat()) assert.ok(Math.abs(x) <= 1);
  });

  test(`${def.name}: scenery never stands on the road`, () => {
    for (const s of S) {
      for (const o of s.sprites) {
        const x = s.pos[0] + s.flatR[0] * o.offset * RW;
        const z = s.pos[2] + s.flatR[2] * o.offset * RW;
        for (let k = 0; k < N; k += 3) {
          if (Math.min(Math.abs(k - s.index), N - Math.abs(k - s.index)) < 30) continue;
          const d = Math.hypot(S[k].pos[0] - x, S[k].pos[2] - z);
          assert.ok(d > RW + 2, `${o.kind} at segment ${s.index} sits on road near ${k}`);
        }
      }
    }
  });
}
