import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenWorld, WATER, ROAD_HALF } from '../../src/world/openWorld.js';
import { roadPoint, smoothLand, ROAD_SPACING } from '../../src/world/endlessRoads.js';
import { FreeSession } from '../../src/sim/freeDrive.js';
import { makeVehicle } from '../../src/data/vehicles.js';
import { FIXED_DT } from '../../src/core/loop.js';
import { ExploreMap } from '../../src/world/explore.js';
import { ACHIEVEMENTS } from '../../src/data/achievements.js';

test('Big Land: no coast, the same every time, a road at the start', () => {
  const W = new OpenWorld({ endless: true });
  // Far out in every direction there is land, not sea.
  let dry = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.3) if (W.baseHeight(Math.cos(a) * 40000, Math.sin(a) * 40000) > WATER) dry++;
  assert.ok(dry >= 19, `dry far away (${dry}/21)`);
  assert.equal(W.surface(W.spawn.x, W.spawn.z), 'road');
  const V = new OpenWorld({ endless: true });
  assert.equal(V.height(12345, -6789), W.height(12345, -6789), 'deterministic');
  assert.deepEqual(roadPoint(V, 1, 7, 900), roadPoint(W, 1, 7, 900));
  assert.deepEqual(W.flagRaces, []);
  assert.deepEqual(W.animals, []);
});

test('Big Land: road pieces join exactly and crossing roads meet level', () => {
  const W = new OpenWorld({ endless: true });
  for (let z = -2000; z < 2000; z += 60) for (let x = -2000; x < 2000; x += 60) W.nearestRoad(x, z);
  assert.ok(W.roads.length > 20, `pieces built (${W.roads.length})`);
  // Samples shared by neighbouring pieces have the same height.
  const seen = new Map();
  let joints = 0;
  for (const r of W.roads)
    for (const s of r.samples) {
      const k = `${r.axis}:${r.k}:${s.x.toFixed(2)},${s.z.toFixed(2)}`;
      if (seen.has(k)) {
        joints++;
        assert.ok(Math.abs(seen.get(k) - s.h) < 1e-9, 'joint matches');
      } else seen.set(k, s.h);
    }
  assert.ok(joints > 10);
  // Where an east-west road crosses a north-south one, both are at about the
  // same height (both follow the same smoothed land).
  const [x0, z0] = roadPoint(W, 0, 1, 0);
  let best = null;
  for (let t = -400; t < 400; t += 1) {
    const [x, z] = roadPoint(W, 0, 1, t);
    const [nx] = roadPoint(W, 1, 0, z);
    if (!best || Math.abs(nx - x) < best.d) best = { d: Math.abs(nx - x), x, z };
  }
  assert.ok(best.d < 2, 'found the crossing');
  W.nearestRoad(best.x, best.z);
  const surfaceOf = (axis) => {
    let b = null;
    for (const r of W.roads.filter((q) => q.axis === axis))
      for (const smp of r.samples) {
        const d = Math.hypot(smp.x - best.x, smp.z - best.z);
        if (!b || d < b.d) b = { d, h: smp.h };
      }
    return b;
  };
  const ew = surfaceOf(0);
  const ns = surfaceOf(1);
  assert.ok(ew.d < 3 && ns.d < 3);
  assert.ok(Math.abs(ew.h - ns.h) < 0.6, `level crossing (${ew.h.toFixed(2)} vs ${ns.h.toFixed(2)})`);
  assert.ok(Number.isFinite(x0 + z0));
});

test('Big Land: a road is never far, roads are drivable, ramps along them', () => {
  const W = new OpenWorld({ endless: true });
  for (const [x, z] of [
    [0, 0],
    [5000, -3000],
    [-71234, 40567],
    [250000, 250000],
  ]) {
    const r = W.roadPointer(x, z);
    assert.ok(r && r.d < ROAD_SPACING, `road near (${x}, ${z}): ${r?.d.toFixed(0)} m`);
  }
  for (const axis of [0, 1])
    for (let k = -6; k <= 6; k += 3) {
      let prev = null;
      for (let t = -5000; t < 5000; t += 3) {
        const [x, z] = roadPoint(W, axis, k, t);
        const h = smoothLand(W, x, z);
        if (prev) assert.ok(Math.abs(h - prev.h) / Math.hypot(x - prev.x, z - prev.z) < 0.4, 'grade');
        prev = { x, z, h };
      }
    }
  for (let z = -3000; z < 3000; z += 100) for (let x = -3000; x < 3000; x += 100) W.nearestRoad(x, z);
  assert.ok(W.ramps.length > 5, `ramps (${W.ramps.length})`);
  for (const r of W.ramps) assert.ok(W.nearestRoad(r.x, r.z).d < ROAD_HALF, 'ramps sit on a road');
});

test('Big Land: driving far from home works; the farthest is kept per player with badges', () => {
  const W = new OpenWorld({ endless: true });
  const s = new FreeSession(W, makeVehicle('zippy'));
  s.assist = true;
  const q = W.roadPointer(120000, -90000);
  const smp = W.nearestRoad(q.x, q.z).s;
  s.reset({ x: smp.x, z: smp.z, yaw: Math.atan2(smp.tx, -smp.tz) });
  for (let i = 0; i < 120 * 10; i++) s.step(FIXED_DT, { steer: 0, analog: false, throttle: 1, brake: 0, nitro: false });
  const p = s.player;
  for (const v of [p.x, p.y, p.z, p.speed]) assert.ok(Number.isFinite(v));
  assert.ok(Math.hypot(p.x - smp.x, p.z - smp.z) > 100, 'drove');
  assert.ok(p.y >= W.ground(p.x, p.z) - 0.01, 'on or above the ground');

  const m = new Map();
  const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  const E = new ExploreMap(store);
  E.recordFar(0.5);
  E.recordFar(2.4); // crossing a whole km saves
  assert.equal(new ExploreMap(store).far, 2.4);
  E.recordFar(1);
  assert.equal(E.far, 2.4, 'never goes down');
  const goals = ACHIEVEMENTS.filter((a) => a.stat === 'bigLandKm').map((a) => a.goal);
  assert.deepEqual(goals, [2, 10]);
});
