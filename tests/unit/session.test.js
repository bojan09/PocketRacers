import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { CARS } from '../../src/data/cars.js';
import { DrivingSession } from '../../src/sim/session.js';
import { advance, FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
// A huge flat circle: effectively straight for longitudinal physics tests.
const circlePoints = Array.from({ length: 24 }, (_, i) => {
  const a = (-i / 24) * Math.PI * 2;
  return { p: [Math.cos(a) * 2500, Math.sin(a) * 2500], y: 0 };
});
const straight = buildTrack3D({ ...testTrack, points: circlePoints, scenery: [], features: {} });
const car = () => structuredClone(CARS.zippy);
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 0, brake: 0, nitro: false, ...o });
const newSession = (opts = { trafficCount: 0 }) => new DrivingSession(track, car(), opts);

function run(session, seconds, inp) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) session.step(FIXED_DT, typeof inp === 'function' ? inp(i * FIXED_DT) : inp);
}

test('throttle accelerates to (but not beyond) top speed', () => {
  const s = new DrivingSession(straight, car(), { trafficCount: 0 });
  run(s, 2, input({ throttle: 1 }));
  assert.ok(s.player.speed > 0.6 * s.car.handling.maxSpeed, `speed ${s.player.speed}`);
  run(s, 6, input({ throttle: 1 }));
  assert.ok(s.player.speed <= s.car.handling.maxSpeed + 1e-6);
});

test('nitro raises top speed and returns smoothly when released', () => {
  const s = new DrivingSession(straight, car(), { trafficCount: 0 });
  run(s, 6, input({ throttle: 1 }));
  const normalTop = s.player.speed;
  run(s, 4, input({ throttle: 1, nitro: true }));
  assert.ok(s.player.speed > normalTop * 1.2, `nitro speed ${s.player.speed}`);
  const boosted = s.player.speed;
  s.step(FIXED_DT, input({ throttle: 1 }));
  assert.ok(boosted - s.player.speed < 100, 'no abrupt drop after nitro ends');
});

test('nitro drains while used, stops when empty and refills from tricks', () => {
  const s = new DrivingSession(straight, car(), { trafficCount: 0 });
  assert.equal(s.player.nitroFuel, 1, 'starts full');
  run(s, 2, input({ throttle: 1, nitro: true }));
  assert.ok(s.player.nitroFuel < 0.7 && s.player.nitroFuel > 0.4, `fuel ${s.player.nitroFuel}`);
  run(s, 4, input({ throttle: 1, nitro: true }));
  assert.equal(s.player.nitroFuel, 0);
  assert.equal(s.player.nitro, false, 'no boost when empty');
  assert.equal(s.player.nitroEmpty, true);
  s.fun.onLand(1.2);
  assert.ok(s.player.nitroFuel > 0.5, `refilled to ${s.player.nitroFuel}`);
  s.fun.onNearMiss();
  assert.ok(s.events.some((e) => e.type === 'nitroRefill'));
});

test('brake stops the car, then holding brake reverses', () => {
  const s = newSession();
  run(s, 4, input({ throttle: 1 }));
  run(s, 1.5, input({ brake: 1 }));
  assert.ok(s.player.speed <= 0);
  run(s, 1.5, input({ brake: 1 }));
  assert.ok(s.player.speed < 0, 'reversing');
  assert.ok(s.player.speed >= -s.car.handling.reverseMax);
  run(s, 2, input({ throttle: 1 }));
  assert.ok(s.player.speed > 0, 'throttle recovers from reverse');
});

test('steering moves the car laterally only when moving', () => {
  const s = newSession();
  run(s, 1, input({ steer: 1 }));
  assert.equal(s.player.x, 0);
  run(s, 2, input({ throttle: 1 }));
  const x0 = s.player.x;
  run(s, 0.5, input({ throttle: 1, steer: 1 }));
  assert.ok(s.player.x > x0 + 0.3, 'moved right');
});

test('digital steering ramps instead of snapping', () => {
  const s = newSession();
  s.step(FIXED_DT, input({ steer: 1 }));
  assert.ok(s.player.steer > 0 && s.player.steer < 0.1);
});

test('driving off-road limits speed', () => {
  const s = new DrivingSession(straight, car(), { trafficCount: 0 });
  run(s, 3, input({ throttle: 1 }));
  s.player.x = 1.9;
  run(s, 3, input({ throttle: 1 }));
  assert.ok(s.player.speed <= s.car.handling.maxSpeed * s.car.handling.offroadTop * 1.01);
});

test('physics is frame-rate independent (30/60/120/144 Hz within 2%)', () => {
  const script = (t) => input({ throttle: 1, steer: Math.sin(t * 1.3) * 0.6, nitro: t > 8 && t < 12 });
  const results = [];
  for (const hz of [30, 60, 120, 144]) {
    const s = newSession();
    const loopState = { accumulator: 0 };
    let t = 0;
    const frames = Math.round(20 * hz);
    for (let f = 0; f < frames; f++) {
      advance(loopState, 1 / hz, (dt) => {
        s.step(dt, script(t));
        t += dt;
      });
    }
    results.push(s.player.odometer);
  }
  const ref = results[2];
  for (const r of results) assert.ok(Math.abs(r - ref) / ref < 0.02, `odometer ${r} vs ${ref}`);
});

test('a full lap is counted and timed; reversing over the line is not', () => {
  const s = newSession();
  s.player.z = track.length * 0.6;
  s.player.halfway = true;
  s.player.timing = true;
  run(s, 60, input({ throttle: 1, steer: 0 }));
  // Keep the car centred so scenery never interferes with this test.
  const laps = s.events.filter((e) => e.type === 'lap');
  assert.ok(laps.length >= 1, 'lap event emitted');
  assert.ok(s.player.bestLap > 0);

  const r = newSession();
  r.player.z = 300;
  r.player.speed = -2000;
  run(r, 1, input({ brake: 1 }));
  run(r, 2, input({ throttle: 1 }));
  assert.equal(r.events.filter((e) => e.type === 'lap').length, 0);
});

test('hitting roadside scenery slows the car and emits a hit event', () => {
  const s = newSession();
  const seg = track.segments.find((sg, i) => i > 50 && sg.sprites.some((sp) => sp.solid > 0 && Math.abs(sp.offset) < 2.5));
  const sprite = seg.sprites.find((sp) => sp.solid > 0 && Math.abs(sp.offset) < 2.5);
  s.player.x = sprite.offset;
  s.player.z = seg.z - 3000;
  s.player.speed = 8000;
  run(s, 1, input({ throttle: 1, steer: 0 }));
  assert.ok(s.events.some((e) => e.type === 'hit'));
  assert.ok(s.player.speed < 8000);
});

test('bumping practice traffic never passes through it', () => {
  const s = new DrivingSession(track, car(), { trafficCount: 1 });
  const c = s.traffic[0];
  c.cruise = c.speed = 3000;
  c.x = c.targetX = 0;
  c.laneTimer = 1e9;
  s.player.z = c.z - 4000;
  s.player.speed = 11000;
  run(s, 1.5, input({ throttle: 1 }));
  assert.ok(s.events.some((e) => e.type === 'bump'));
  assert.ok(s.player.z < s.traffic[0].z + 1, 'player stays behind');
});

test('reset restores a deterministic start state', () => {
  const s = new DrivingSession(track, car(), { trafficCount: 4 });
  const before = JSON.stringify(s.traffic);
  run(s, 3, input({ throttle: 1 }));
  s.reset();
  assert.equal(JSON.stringify(s.traffic), before);
  assert.equal(s.player.z, 0);
});
