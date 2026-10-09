import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { makeVehicle, VEHICLE_BY_ID } from '../../src/data/vehicles.js';
import { DrivingSession } from '../../src/sim/session.js';
import { Race, COUNTDOWN } from '../../src/sim/race.js';
import { AIDriver } from '../../src/sim/ai.js';
import { EVENTS, EVENT_BY_ID, pickOpponents, vehicleFor, starsFor, allowed, medalTimes, MAX_STARS } from '../../src/data/events.js';
import { Career, sanitizeCareer } from '../../src/core/career.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);

/** A race where the "player" is driven by an AI too, so it can finish. */
function setup(opts = {}, playerId = 'zippy', playerLevel = 'hard') {
  const s = new DrivingSession(track, makeVehicle(playerId), { trafficCount: 0 });
  const event = { id: 'test', families: null };
  const race = new Race(s, { opponents: pickOpponents(event, s.car, 5, 3), ...opts });
  const pilot = new AIDriver(s, s.body, { difficulty: playerLevel, seed: 42 });
  return { s, race, pilot };
}

function runRace(race, pilot, maxSeconds = 400) {
  for (let i = 0; i < maxSeconds * 120 && race.phase !== 'finished'; i++) race.step(FIXED_DT, pilot.input(FIXED_DT));
}

test('countdown holds everyone on the grid, then GO', () => {
  const { s, race, pilot } = setup();
  const counts = [];
  for (let i = 0; i < (COUNTDOWN + 0.5) * 120; i++) {
    race.step(FIXED_DT, { ...pilot.input(FIXED_DT), throttle: 1, nitro: true });
    for (const e of s.events) if (e.type === 'countdown') counts.push(e.n);
    s.events.length = 0;
    if (race.phase === 'countdown') {
      assert.equal(s.player.speed, 0);
      for (const r of s.racers) assert.equal(r.p.speed, 0);
    }
  }
  assert.deepEqual(counts, [3, 2, 1, 0]);
  assert.equal(race.phase, 'racing');
  // Grid is behind the line, staggered, and nobody overlaps.
  const zs = [s.body, ...s.racers].map((b) => `${Math.round(b.p.z)}:${b.p.x}`);
  assert.equal(new Set(zs).size, 6);
});

test('a full race finishes with a complete, consistent result', () => {
  const { race, pilot } = setup({ laps: 2, difficulty: 'easy' });
  runRace(race, pilot);
  assert.equal(race.phase, 'finished');
  const r = race.results;
  assert.equal(r.total, 6);
  assert.deepEqual(r.standings.map((x) => x.place), [1, 2, 3, 4, 5, 6]);
  assert.equal(r.standings.filter((x) => x.player).length, 1);
  // A strong driver against easy AI should be on the podium.
  assert.ok(r.place <= 3, `place ${r.place}`);
  assert.ok(r.time > 40 && r.time < 120, `time ${r.time}`);
});

test('AI racers stay on the road and keep a realistic pace', () => {
  const { s, race, pilot } = setup({ laps: 2, difficulty: 'normal' });
  let offroad = 0;
  let frames = 0;
  for (let i = 0; i < 70 * 120; i++) {
    race.step(FIXED_DT, pilot.input(FIXED_DT));
    for (const r of s.racers) {
      frames++;
      if (Math.abs(r.p.x) > 1.05) offroad++;
    }
  }
  assert.ok(offroad / frames < 0.02, `offroad ${(offroad / frames).toFixed(3)}`);
  for (const r of s.racers) assert.ok(r.p.lap >= 2, `${r.name} lap ${r.p.lap}`);
});

test('elimination: the last car is knocked out every lap', () => {
  const { s, race, pilot } = setup({ mode: 'elimination', laps: 5, difficulty: 'easy' });
  const outs = [];
  for (let i = 0; i < 400 * 120 && race.phase !== 'finished'; i++) {
    race.step(FIXED_DT, pilot.input(FIXED_DT));
    for (const e of s.events) if (e.type === 'racerOut' || e.type === 'eliminated') outs.push(e);
    s.events.length = 0;
  }
  assert.equal(race.phase, 'finished');
  assert.ok(outs.length >= 1);
  const out = race.results.standings.filter((x) => x.eliminated);
  // Eliminated cars fill the last places, latest knock-out ranking higher.
  for (const x of out) assert.ok(x.place > 6 - out.length);
});

test('time trial: no opponents; medals scale with the vehicle', () => {
  const { s, race, pilot } = setup({ mode: 'timetrial', laps: 1 });
  assert.equal(s.racers.length, 0);
  runRace(race, pilot);
  assert.equal(race.results.total, 1);
  const trial = EVENT_BY_ID.trial;
  const fast = medalTimes(trial, makeVehicle('bolt'));
  const slow = medalTimes(trial, makeVehicle('nordhaul'));
  assert.ok(slow[0] > fast[0]);
  assert.equal(starsFor(trial, { time: fast[0] - 1, car: makeVehicle('bolt') }), 3);
  assert.equal(starsFor(trial, { time: 999, car: makeVehicle('bolt') }), 0);
});

test('events: opponents obey the rules; you always have something to drive', () => {
  const big = EVENT_BY_ID.bigrig;
  const ops = pickOpponents(big, makeVehicle('zippy'), 5, 1);
  assert.equal(ops.length, 5);
  for (const o of ops) assert.equal(VEHICLE_BY_ID[o.car.id].family, 'truck');
  assert.equal(new Set(ops.map((o) => o.name)).size, 5);
  const garage = { selected: 'zippy', owns: (id) => ['zippy', 'pip', 'dusty'].includes(id) };
  assert.deepEqual(vehicleFor(EVENT_BY_ID.rookie, garage), { id: 'zippy', loaner: false });
  assert.deepEqual(vehicleFor(EVENT_BY_ID.mud, garage), { id: 'dusty', loaner: false });
  assert.deepEqual(vehicleFor(big, garage), { id: 'nordhaul', loaner: true });
  assert.ok(allowed(EVENT_BY_ID.speed, 'bolt') && !allowed(EVENT_BY_ID.speed, 'pip'));
  assert.equal(starsFor(EVENT_BY_ID.rookie, { place: 1 }), 3);
  assert.equal(starsFor(EVENT_BY_ID.rookie, { place: 4 }), 0);
  assert.equal(starsFor(EVENT_BY_ID.knockout, { place: 2, eliminated: true }), 0);
  // Unlock thresholds are reachable and increasing.
  const needs = EVENTS.map((e) => e.need);
  assert.deepEqual(needs, needs.slice().sort((a, b) => a - b));
  assert.ok(needs.at(-1) < MAX_STARS);
});

test('career: records best stars and time, cleans bad saves, unlocks by stars', () => {
  const data = {};
  const storage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) };
  const c = new Career(storage);
  assert.equal(c.totalStars, 0);
  assert.ok(c.unlocked(EVENT_BY_ID.rookie) && !c.unlocked(EVENT_BY_ID.mud));
  assert.deepEqual(c.record('rookie', 2, 90), { newStars: 2, improved: true });
  assert.deepEqual(c.record('rookie', 1, 95), { newStars: 0, improved: false });
  assert.equal(c.stars('rookie'), 2);
  assert.equal(c.best('rookie'), 90);
  assert.ok(c.unlocked(EVENT_BY_ID.mud));
  assert.equal(new Career(storage).stars('rookie'), 2);
  const clean = sanitizeCareer({ v: 1, events: { rookie: { stars: 9, best: -3 }, fake: { stars: 3 } } });
  assert.deepEqual(clean.events, { rookie: { stars: 3, best: null } });
});
