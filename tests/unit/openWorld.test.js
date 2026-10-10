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
