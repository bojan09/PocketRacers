import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenWorld, CELL, WATER } from '../../src/world/openWorld.js';
import { FreeSession } from '../../src/sim/freeDrive.js';
import { makeVehicle, VEHICLES } from '../../src/data/vehicles.js';
import { FIXED_DT } from '../../src/core/loop.js';

const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });
function run(s, seconds, inp) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) s.step(FIXED_DT, typeof inp === 'function' ? inp(i * FIXED_DT) : inp);
}

test('island: same seed, same land; a flat dry start; sea all around', () => {
  const a = new OpenWorld({ seed: 5 });
  const b = new OpenWorld({ seed: 5 });
  for (const [x, z] of [
    [10, 20],
    [-300, 410],
    [900, -50],
  ])
    assert.equal(a.height(x, z), b.height(x, z));
  const W = new OpenWorld();
  for (const [x, z] of [
    [0, 0],
    [20, -15],
    [-25, 10],
  ])
    assert.ok(Math.abs(W.height(x, z) - 6) < 0.6, 'flat start');
  for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.4) assert.ok(W.height(Math.cos(a2) * 2400, Math.sin(a2) * 2400) < WATER - 1, 'sea beyond the coast');
  // Mostly dry inland.
  let wet = 0;
  let n = 0;
  for (let x = -1000; x <= 1000; x += 50)
    for (let z = -1000; z <= 1000; z += 50) {
      n++;
      if (W.surface(x, z) === 'water') wet++;
    }
  assert.ok(wet / n < 0.05, `inland water ${((100 * wet) / n).toFixed(1)}%`);
});

test('island: ground() matches the drawn triangles (exact at grid points)', () => {
  const W = new OpenWorld();
  for (const [i, j] of [
    [3, 7],
    [-20, 41],
    [100, -60],
  ])
    assert.ok(Math.abs(W.ground(i * CELL, j * CELL) - W.height(i * CELL, j * CELL)) < 1e-6);
  // Between samples it stays within the corner heights.
  const g = W.ground(13.3 * CELL, 7.6 * CELL);
  const hs = [
    [13, 7],
    [14, 7],
    [13, 8],
    [14, 8],
  ].map(([i, j]) => W.height(i * CELL, j * CELL));
  assert.ok(g >= Math.min(...hs) - 1e-6 && g <= Math.max(...hs) + 1e-6);
});

test('free drive: accelerates, turns, brakes and stays on the ground on flat land', () => {
  const W = new OpenWorld();
  const s = new FreeSession(W, makeVehicle('zippy'));
  run(s, 3, input());
  const p = s.player;
  assert.ok(p.speed > 5000, `speed ${p.speed}`);
  assert.ok(Math.abs(p.y - W.ground(p.x, p.z)) < 0.05, 'on the ground');
  const yaw0 = p.yaw;
  run(s, 1, input({ steer: 1 }));
  assert.ok(p.yaw > yaw0 + 0.4, 'steering right turns right');
  run(s, 1.2, input({ throttle: 0, brake: 1 }));
  assert.ok(p.speed < 300, `brakes to a stop (${p.speed})`);
});

test('free drive: every vehicle drives without NaN', () => {
  const W = new OpenWorld();
  for (const v of VEHICLES) {
    const s = new FreeSession(W, makeVehicle(v.id));
    run(s, 2, (t) => input({ steer: Math.sin(t * 3), nitro: t > 1 }));
    const p = s.player;
    for (const k of ['x', 'y', 'z', 'yaw', 'speed']) assert.ok(Number.isFinite(p[k]), `${v.id} ${k}`);
  }
});

test('free drive: falling in the sea brings the car back to dry land', () => {
  const W = new OpenWorld();
  const s = new FreeSession(W, makeVehicle('zippy'));
  run(s, 1.5, input());
  // Teleport over the sea.
  const p = s.player;
  p.x = 2600;
  p.z = 0;
  p.y = W.ground(p.x, p.z);
  run(s, 2, input({ throttle: 0 }));
  assert.ok(s.events.some((e) => e.type === 'splash'));
  assert.ok(s.events.some((e) => e.type === 'rescue'));
  assert.ok(W.ground(p.x, p.z) > WATER, 'back on land');
});

test('free drive: cresting a hill at speed jumps, and the landing scores', () => {
  // A world with one sharp ridge in front of the start.
  const W = new OpenWorld();
  // Flat, then a ramp up to 5 m, then the ground drops away.
  W.height = (x, z) => (z > -20 ? 6 : z > -35 ? 6 + (-20 - z) * 0.35 : 0);
  const s = new FreeSession(W, makeVehicle('zippy'));
  s.reset({ x: 0, z: 0, yaw: 0 });
  run(s, 4, input({ nitro: true }));
  assert.ok(s.events.some((e) => e.type === 'land'), 'landed after a jump');
  assert.ok(s.events.some((e) => e.type === 'score' && (e.kind === 'jump' || e.kind === 'trick')));
});

test('island scenery: the same every time, all areas present, start kept clear', () => {
  const a = new OpenWorld();
  const b = new OpenWorld();
  assert.deepEqual(a.chunkObjects(2, -3), b.chunkObjects(2, -3));
  const seen = new Set();
  for (let z = -1400; z <= 1400; z += 70) for (let x = -1400; x <= 1400; x += 70) if (a.height(x, z) > 0) seen.add(a.biome(x, z));
  for (const k of ['meadow', 'forest', 'desert', 'snow', 'beach']) assert.ok(seen.has(k), `has ${k}`);
  for (const o of a.objectsNear(a.spawn.x, a.spawn.z, 40)) assert.ok(Math.hypot(o.x - a.spawn.x, o.z - a.spawn.z) >= 45, 'clear start');
  for (const o of a.chunkObjects(1, 1)) assert.ok(a.height(o.x, o.z) > 0, 'nothing in the sea');
});

test('free drive: a tree stops the car; props fly off for points', () => {
  const W = new OpenWorld();
  W.objectsNear = (x, z, reach, out = []) => {
    out.length = 0;
    out.push({ id: 'tree', kind: 'oak', x: 0, z: -30, y: 6, yaw: 0, scale: 1, r: 1.2, prop: false });
    out.push({ id: 'hay', kind: 'hay', x: 6, z: -20, y: 6, yaw: 0, scale: 1, r: 0.6, prop: true });
    return out;
  };
  const s = new FreeSession(W, makeVehicle('zippy'));
  s.reset({ x: 0, z: 0, yaw: 0 });
  run(s, 3, input());
  const p = s.player;
  assert.ok(p.z > -30 + 1.2, 'did not drive through the tree');
  assert.ok(s.events.some((e) => e.type === 'hit'));

  const t = new FreeSession(W, makeVehicle('zippy'));
  t.reset({ x: 6, z: 0, yaw: 0 });
  run(t, 2, input());
  assert.ok(t.knocked.has('hay'));
  assert.ok(t.events.some((e) => e.type === 'score' && e.kind === 'prop'));
});

test('roads: the start is on a road; roads are flat across, clear of scenery and fastest', () => {
  const W = new OpenWorld();
  assert.equal(W.surface(W.spawn.x, W.spawn.z), 'road');
  for (const smp of W.roadSamples.filter((_, i) => i % 50 === 0)) {
    // Flat across the road.
    const l = W.height(smp.x - smp.tz * 3, smp.z + smp.tx * 3);
    const r = W.height(smp.x + smp.tz * 3, smp.z - smp.tx * 3);
    assert.ok(Math.abs(l - r) < 0.3, `flat across (${l.toFixed(2)} vs ${r.toFixed(2)})`);
    for (const o of W.objectsNear(smp.x, smp.z, 6)) assert.ok(Math.hypot(o.x - smp.x, o.z - smp.z) > 4.2, `${o.kind} not on the road`);
  }
  const car = makeVehicle('zippy');
  const onRoad = new FreeSession(W, car);
  run(onRoad, 4, input({ steer: 0 }));
  const flat = new OpenWorld();
  flat.roadGrid = new Map(); // no roads at all: grass everywhere
  const onGrass = new FreeSession(flat, car);
  run(onGrass, 4, input());
  assert.ok(onRoad.player.speed > onGrass.player.speed, 'roads are faster than grass');
});
