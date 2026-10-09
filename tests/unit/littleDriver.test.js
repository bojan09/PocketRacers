import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { TRACKS } from '../../src/data/tracks/index.js';
import { makeVehicle } from '../../src/data/vehicles.js';
import { DrivingSession } from '../../src/sim/session.js';
import { Race } from '../../src/sim/race.js';
import { EVENTS, pickOpponents } from '../../src/data/events.js';
import { EASIER, DIFFICULTY } from '../../src/sim/ai.js';
import { Profiles, sanitizeProfiles } from '../../src/core/profiles.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });
function run(s, seconds, inp) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) s.step(FIXED_DT, typeof inp === 'function' ? inp(i * FIXED_DT) : inp);
}
const session = (assist) => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  s.assist = assist;
  return s;
};

test('little driver: holding a steer button does not leave the road', () => {
  for (const assist of [false, true]) {
    const s = session(assist);
    run(s, 2, input());
    let maxX = 0;
    run(s, 3, () => {
      maxX = Math.max(maxX, Math.abs(s.player.x));
      return input({ steer: 1 });
    });
    if (assist) assert.ok(maxX < 1, `stays on the road (max |x| ${maxX.toFixed(2)})`);
    else assert.ok(maxX > 1, 'without help the car runs off');
  }
});

test('little driver: hands-off laps stay on the road on every map', () => {
  for (const def of TRACKS) {
    const t = buildTrack3D(def);
    const s = new DrivingSession(t, makeVehicle('zippy'), { trafficCount: 0 });
    s.assist = true;
    let off = 0;
    let rescues = 0;
    run(s, 40, () => {
      if (Math.abs(s.player.x) > 1) off += FIXED_DT;
      for (const e of s.events) if (e.type === 'rescue') rescues++;
      s.events.length = 0;
      return input();
    });
    assert.ok(off < 4, `${def.id}: off-road ${off.toFixed(1)} s of 40`);
    assert.ok(s.player.odometer > 0, def.id);
    assert.ok(rescues <= 3, `${def.id}: ${rescues} rescues`);
  }
});

test('little driver: off the road, the edge pull steers back on', () => {
  const s = session(true);
  run(s, 1, input());
  Object.assign(s.player, { x: 2.2, prevX: 2.2 });
  run(s, 4, input({ steer: 1 })); // even while steering away
  assert.ok(Math.abs(s.player.x) <= 1, `back on the road (x ${s.player.x.toFixed(2)})`);
});

test('little driver: a wedged car is rescued back onto the road', () => {
  const s = session(true);
  run(s, 1, input());
  let rescued = 0;
  run(s, 4, () => {
    if (s.events.some((e) => e.type === 'rescue')) rescued++;
    s.events.length = 0;
    // Stuck against something off the road: no progress until rescued.
    if (!rescued) Object.assign(s.player, { x: 1.6, prevX: 1.6, speed: 0 });
    return input();
  });
  assert.equal(rescued, 1);
  assert.ok(Math.abs(s.player.x) <= 1, `back on the road (x ${s.player.x.toFixed(2)})`);
  assert.ok(s.player.speed > 0.3 * s.car.handling.maxSpeed);
});

test('little driver: no rescue while waiting on the grid, or without the help', () => {
  const s = session(true);
  const race = new Race(s, { opponents: pickOpponents(EVENTS[0], s.car, 5, 1) });
  for (let i = 0; i < 2.9 / FIXED_DT; i++) race.step(FIXED_DT, input());
  assert.ok(!s.events.some((e) => e.type === 'rescue'));
  const plain = session(false);
  Object.assign(plain.player, { x: 2.2, prevX: 2.2 });
  run(plain, 4, () => input({ steer: 1 }));
  assert.ok(Math.abs(plain.player.x) > 1, 'no help: stays where it drove');
});

test('little driver: rivals are one level easier', () => {
  assert.equal(EASIER.hard, 'normal');
  assert.equal(EASIER.normal, 'easy');
  assert.equal(EASIER.easy, 'kid');
  assert.ok(DIFFICULTY.kid.skill < DIFFICULTY.easy.skill);
});

test('little driver: on by default per player; grown-ups can turn it off', () => {
  const m = {};
  const store = { getItem: (k) => m[k] ?? null, setItem: (k, v) => (m[k] = String(v)), removeItem: (k) => delete m[k] };
  const P = new Profiles(store);
  P.add('fox');
  P.add('panda');
  assert.ok(P.littleDriver('fox') && P.littleDriver('panda'));
  P.setLittleDriver('fox', false);
  const back = new Profiles(store);
  assert.ok(!back.littleDriver('fox'));
  assert.ok(back.littleDriver('panda'));
  assert.deepEqual(sanitizeProfiles({ v: 1, list: ['fox'], pro: ['fox', 'dragon', 'panda'] }).pro, ['fox']);
});
