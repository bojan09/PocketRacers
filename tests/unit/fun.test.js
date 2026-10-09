import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { makeVehicle } from '../../src/data/vehicles.js';
import { DrivingSession } from '../../src/sim/session.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
const car = () => makeVehicle('zippy');
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });
const session = () => new DrivingSession(track, car(), { trafficCount: 0 });

function run(s, seconds, inp = input()) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) s.step(FIXED_DT, inp);
}
const scores = (s, kind) => s.events.filter((e) => e.type === 'score' && (!kind || e.kind === kind));

test('ramps launch the car, it lands and scores a jump', () => {
  const s = session();
  const r = track.ramps[0];
  s.player.z = r.z0 - 4000;
  s.player.x = r.x;
  s.player.speed = 11000;
  let maxAir = 0;
  for (let i = 0; i < 4 * 120; i++) {
    s.step(FIXED_DT, input());
    maxAir = Math.max(maxAir, s.player.air);
  }
  assert.ok(maxAir > 3, `max air ${maxAir}`);
  assert.ok(s.events.some((e) => e.type === 'takeoff'));
  const land = s.events.find((e) => e.type === 'land');
  assert.ok(land && land.airTime > 0.8, `airtime ${land?.airTime}`);
  assert.equal(scores(s, 'jump').length, 1);
  assert.equal(s.player.airborne, false);
});

test('missing the ramp sideways means no jump', () => {
  const s = session();
  const r = track.ramps[0];
  s.player.z = r.z0 - 4000;
  s.player.x = r.x > 0 ? r.xa - 0.3 : r.xb + 0.3;
  s.player.speed = 11000;
  run(s, 1); // just past this ramp (the next one is a barrel ramp on this line)
  assert.ok(!s.events.some((e) => e.type === 'takeoff'));
});

test('boost pads give a free nitro burst', () => {
  const s = session();
  const b = track.boosts[0];
  s.player.z = b.z0 - 500;
  s.player.x = b.x;
  s.player.speed = 11500;
  run(s, 0.6);
  assert.ok(s.events.some((e) => e.type === 'boost'));
  assert.ok(s.player.nitro);
  assert.ok(s.player.speed > s.car.handling.maxSpeed, `speed ${s.player.speed}`);
});

test('stars are collected once, then respawn on the next lap', () => {
  const s = session();
  const star = s.fun.stars.find((st) => st.h < 1.5);
  s.player.z = star.z - 2000;
  s.player.x = star.x;
  s.player.speed = 8000;
  run(s, 0.6, input({ steer: 0 }));
  assert.ok(star.taken);
  assert.equal(scores(s, 'star').length >= 1, true);
  s.fun.respawn();
  assert.ok(!star.taken);
});

test('cones get knocked and score, costing only a little speed', () => {
  const s = session();
  const cone = s.fun.cones[0];
  s.player.z = cone.z - 2000;
  s.player.x = cone.x;
  s.player.speed = 9000;
  run(s, 0.5);
  assert.ok(cone.hitTime >= 0);
  assert.ok(scores(s, 'smash').length >= 1);
  assert.ok(s.player.speed > 8000, 'still moving fast');
});

test('passing close to traffic scores a near miss; a wide pass does not', () => {
  for (const [gap, expect] of [
    [0.08, true],
    [0.6, false],
  ]) {
    const s = new DrivingSession(track, car(), { trafficCount: 1 });
    const c = s.traffic[0];
    c.cruise = c.speed = 4000;
    c.laneTimer = 1e9;
    c.x = c.targetX = 0;
    const width = s.carHalf * 2 * 0.9;
    s.player.z = c.z - 3000;
    s.player.x = width + gap;
    s.player.speed = 11500;
    for (let i = 0; i < 120; i++) {
      s.step(FIXED_DT, input({ steer: 0 }));
      s.player.x = width + gap; // hold the line for the test
    }
    assert.equal(scores(s, 'nearMiss').length > 0, expect, `gap ${gap}`);
  }
});

test('chained tricks build a combo multiplier that expires', () => {
  const s = session();
  s.fun.award('star', 50, 'STAR');
  s.fun.award('star', 50, 'STAR');
  const third = s.fun.award('star', 50, 'STAR');
  assert.equal(s.fun.combo, 3);
  assert.equal(third, 150);
  run(s, 3.5, input({ throttle: 0 }));
  assert.equal(s.fun.combo, 1);
});

// ------------------------------------------------------------- 2E tricks

/** Drive straight at a ramp; `steerInAir` holds steering while airborne. */
function jump(ramp, { steerInAir = 0, speed = 11000, s = session() } = {}) {
  s.player.z = ramp.z0 - 4000;
  s.player.x = ramp.x;
  s.player.speed = speed;
  let maxRoll = 0;
  for (let i = 0; i < 5 * 120; i++) {
    s.step(FIXED_DT, input({ steer: s.player.airborne ? steerInAir : 0 }));
    maxRoll = Math.max(maxRoll, Math.abs(s.player.roll));
    if (s.events.some((e) => e.type === 'land')) break;
  }
  return { s, maxRoll, trick: scores(s, 'trick')[0], land: s.events.find((e) => e.type === 'land') };
}

test('steering in the air spins the car; a full turn scores a 360', () => {
  const { s, trick, land } = jump(track.ramps[0], { steerInAir: 1 });
  assert.ok(land, 'landed');
  assert.ok(trick && /^(360|720)$/.test(trick.label), `trick ${trick?.label}`);
  assert.ok(s.player.superCharge >= 0.3, `charge ${s.player.superCharge}`);
  // Lands wheels-down: the leftover angle settles back to zero.
  run(s, 1, input({ throttle: 0 }));
  assert.ok(Math.abs(s.player.spin) < 0.01, `spin ${s.player.spin}`);
});

test('a plain jump without spinning is not a trick', () => {
  const { trick } = jump(track.ramps[0]);
  assert.equal(trick, undefined);
});

test('barrel ramps roll the car over and score a barrel roll', () => {
  const ramp = track.ramps.find((r) => r.trick === 'barrel');
  const { s, trick, maxRoll } = jump(ramp);
  assert.ok(maxRoll > Math.PI, `roll ${maxRoll}`);
  assert.equal(trick?.label, 'BARREL ROLL');
  run(s, 1, input({ throttle: 0 }));
  assert.ok(Math.abs(s.player.roll) < 0.01);
});

test('barrel roll plus a spin is a corkscrew; the mega ramp gives time for 720s', () => {
  const barrel = track.ramps.find((r) => r.trick === 'barrel');
  assert.match(jump(barrel, { steerInAir: 1 }).trick?.label || '', /^CORKSCREW/);
  const mega = track.ramps.find((r) => r.trick === 'mega');
  const { trick, land } = jump(mega, { steerInAir: -1, speed: 12500 });
  assert.ok(land.airTime > 1.4, `air ${land.airTime}`);
  assert.ok(['720', '1080'].includes(trick?.label), `trick ${trick?.label}`);
});

test('super nitro: ready when charged, faster than nitro, barges through traffic', () => {
  const s = new DrivingSession(track, car(), { trafficCount: 1 });
  s.fun.charge(0.6);
  assert.ok(!s.events.some((e) => e.type === 'superReady'));
  s.fun.charge(0.5);
  assert.ok(s.events.some((e) => e.type === 'superReady'));
  assert.equal(s.player.superCharge, 1);
  // Normal nitro top speed for comparison.
  const n = new DrivingSession(track, car(), { trafficCount: 0 });
  run(n, 3, input({ nitro: true }));
  const fuelBefore = s.player.nitroFuel;
  const c = s.traffic[0];
  c.cruise = c.speed = 3000;
  c.laneTimer = 1e9;
  c.x = c.targetX = 0;
  s.player.z = c.z - 20000;
  s.player.x = 0;
  run(s, 0.05, input({ nitro: true }));
  assert.ok(s.events.some((e) => e.type === 'super'));
  assert.ok(s.player.super && s.player.superCharge === 0);
  // The shockwave already pushes the car out of the lane...
  assert.notEqual(c.targetX, 0);
  // ...and if we still reach it, it gets bumped aside without slowing us.
  c.x = c.targetX = 0;
  c.knockTime = -10;
  let minSpeed = Infinity;
  for (let i = 0; i < 2.5 * 120; i++) {
    s.step(FIXED_DT, input({ nitro: true }));
    s.player.x = 0;
    if (s.player.speed > 9000) minSpeed = Math.min(minSpeed, s.player.speed);
  }
  assert.ok(scores(s, 'knock').length >= 1, 'bumped a car');
  assert.ok(s.player.speed > n.player.speed, `${s.player.speed} > ${n.player.speed}`);
  assert.equal(s.player.nitroFuel, fuelBefore, 'super nitro is free');
  run(s, 2, input({ nitro: false }));
  assert.ok(!s.player.super);
});
