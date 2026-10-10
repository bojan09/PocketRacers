import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenWorld } from '../../src/world/openWorld.js';
import { FreeSession } from '../../src/sim/freeDrive.js';
import { makeVehicle } from '../../src/data/vehicles.js';
import { FIXED_DT } from '../../src/core/loop.js';
import { parTime, starsFor, FLAG_POINTS, STAR_POINTS } from '../../src/world/flagRaces.js';
import { ExploreMap } from '../../src/world/explore.js';
import { ACHIEVEMENTS } from '../../src/data/achievements.js';

const W = new OpenWorld();

/** A careful driver: follows the road the race runs along. */
function drive(s, race, seconds, opts = {}) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
    const p = s.player;
    let tgt = race.gates[s.flag.race ? s.flag.next : 0];
    const nr = W.nearestRoad(p.x, p.z);
    if (nr && nr.d < 12) {
      const rd = W.roads[nr.s.road];
      const dir = Math.sign(nr.s.tx * tgt.tx + nr.s.tz * tgt.tz) || 1;
      let j = nr.s.i + dir * 8;
      j = rd.closed ? (j + rd.samples.length) % rd.samples.length : Math.max(0, Math.min(rd.samples.length - 1, j));
      tgt = rd.samples[j];
    }
    const a = Math.atan2(tgt.x - p.x, -(tgt.z - p.z)) - p.yaw;
    const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a), Math.cos(a)) * 2.5));
    s.events.length = 0;
    s.step(FIXED_DT, { steer, analog: true, throttle: 1, brake: 0, nitro: false, ...opts });
    events.push(...s.events);
    if (s.events.some((e) => e.type === 'flagFinish' || e.type === 'flagLost')) break;
  }
  return events;
}

const startBefore = (s, race, back = 30) => {
  const g = race.gates[0];
  s.reset({ x: g.x - g.tx * back, z: g.z - g.tz * back, yaw: Math.atan2(g.tx, -g.tz) });
};

test('flag races: four races laid on the roads, starts apart, the first just ahead of the start', () => {
  assert.equal(W.flagRaces.length, 4);
  assert.equal(ACHIEVEMENTS.find((a) => a.id === 'island-flags').goal, W.flagRaces.length);
  assert.deepEqual(new OpenWorld().flagRaces, W.flagRaces, 'same every time');
  for (const r of W.flagRaces) {
    assert.ok(r.length > 500 && r.length < 2500, `${r.id} ${r.length} m`);
    assert.ok(r.gates.length >= 6);
    for (const g of r.gates) assert.ok(W.nearestRoad(g.x, g.z).d < 1, `${r.id} gate on the road`);
  }
  for (const a of W.flagRaces) for (const b of W.flagRaces) if (a !== b) assert.ok(Math.hypot(a.gates[0].x - b.gates[0].x, a.gates[0].z - b.gates[0].z) > 200);
  const sp = W.spawn;
  const first = W.flagRaces[0].gates[0];
  assert.ok(Math.hypot(first.x - sp.x, first.z - sp.z) < 80, 'a flag right ahead of the start');
});

test('flag races: driving through the start arch races through every gate to stars and points', () => {
  for (const id of ['zippy', 'citybus']) {
    for (const race of W.flagRaces) {
      const s = new FreeSession(W, makeVehicle(id));
      s.assist = true;
      startBefore(s, race);
      const ev = drive(s, race, 150);
      assert.ok(ev.some((e) => e.type === 'flagStart' && e.id === race.id), `${id} ${race.id} started`);
      const fin = ev.find((e) => e.type === 'flagFinish');
      assert.ok(fin, `${id} ${race.id} finished (${ev.filter((e) => e.type === 'gate').length} gates)`);
      assert.ok(fin.stars >= 2, `${id} ${race.id}: a clean drive earns stars (${fin.stars})`);
      const sc = ev.find((e) => e.type === 'score' && e.kind === 'flag');
      assert.equal(sc.points, FLAG_POINTS + STAR_POINTS * fin.stars);
      assert.equal(s.flag.race, null);
    }
  }
});

test('flag races: the wrong way through the arch does not start; straying far ends the race', () => {
  const race = W.flagRaces[1];
  const g = race.gates[0];
  const s = new FreeSession(W, makeVehicle('zippy'));
  s.reset({ x: g.x + g.tx * 30, z: g.z + g.tz * 30, yaw: Math.atan2(-g.tx, g.tz) });
  for (let i = 0; i < 240; i++) s.step(FIXED_DT, { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false });
  assert.equal(s.flag.race, null, 'wrong way');

  startBefore(s, race);
  for (let i = 0; i < 300; i++) s.step(FIXED_DT, { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false });
  assert.equal(s.flag.race, race, 'started');
  // Teleport far away: the race is over.
  s.events.length = 0;
  s.player.x = s.player.prevX = g.x + 2000;
  s.step(FIXED_DT, { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false });
  assert.ok(s.events.some((e) => e.type === 'flagLost'));
  assert.equal(s.flag.race, null);
  // Going home ends a race too.
  startBefore(s, race);
  for (let i = 0; i < 300; i++) s.step(FIXED_DT, { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false });
  s.goHome();
  assert.equal(s.flag.race, null);
});

test('flag races: stars follow the vehicle (a slow one can get 3); best kept per player', () => {
  const race = W.flagRaces[0];
  assert.ok(parTime(race, makeVehicle('citybus')) > parTime(race, makeVehicle('apex')));
  assert.equal(starsFor(10, 20), 3);
  assert.equal(starsFor(25, 20), 2);
  assert.equal(starsFor(60, 20), 1);
  const m = new Map();
  const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  const E = new ExploreMap(store);
  assert.equal(E.recordRace('ring-dash', 2), true);
  assert.equal(E.recordRace('ring-dash', 1), false, 'worse does not replace');
  assert.equal(E.recordRace('ring-dash', 3), true);
  assert.equal(new ExploreMap(store).races['ring-dash'], 3, 'saved');
  assert.equal(new ExploreMap(store).racesDone, 1);
  m.set('pocketracers.explore', JSON.stringify({ v: 1, races: { x: 9, y: 'a' } }));
  assert.deepEqual(new ExploreMap(store).races, {}, 'bad entries dropped');
});

test('roads hold the car over a crest that launches it on grass', () => {
  const crest = (onRoad) => {
    const w = new OpenWorld();
    // A gentle rise, then the ground drops away.
    w.height = (x, z) => (z > -20 ? 6 : z > -35 ? 6 + (-20 - z) * 0.12 : 7.8 - (-35 - z) * 0.12);
    w.surface = () => (onRoad ? 'road' : 'grass');
    w.objectsNear = (x, z, reach, out = []) => ((out.length = 0), out);
    const s = new FreeSession(w, makeVehicle('apex'));
    s.reset({ x: 0, z: 0, yaw: 0 });
    let air = false;
    for (let i = 0; i < 120 * 3; i++) {
      s.player.speed = Math.max(s.player.speed, 11000);
      s.step(FIXED_DT, { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false });
      air ||= s.player.airborne;
    }
    return air;
  };
  assert.equal(crest(false), true, 'flies off the crest on grass');
  assert.equal(crest(true), false, 'stays on the road');
});
