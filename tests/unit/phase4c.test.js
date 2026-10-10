import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { TRACKS } from '../../src/data/tracks/index.js';
import { makeVehicle, VEHICLES } from '../../src/data/vehicles.js';
import { TOPPERS } from '../../src/data/kits.js';
import { DrivingSession } from '../../src/sim/session.js';
import { Race } from '../../src/sim/race.js';
import { EVENTS, pickOpponents } from '../../src/data/events.js';
import { ANIMALS, ANIMAL_POINTS } from '../../src/data/animals.js';
import { Achievements, sanitizeAchievements } from '../../src/core/achievements.js';
import { sanitizeGarage } from '../../src/core/garage.js';
import { buildCarBody } from '../../src/render3d/carModel.js';
import { ANIMAL_MODELS } from '../../src/render3d/animals.js';
import { MeshBuilder, FLOATS_PER_VERTEX } from '../../src/gl/meshBuilder.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });
function run(s, seconds, inp) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) s.step(FIXED_DT, typeof inp === 'function' ? inp(i * FIXED_DT) : inp);
}
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const partTop = (p) => (p.box ? p.box[1] + p.box[4] : p.sphere ? p.sphere[1] + p.sphere[4] : p.cyl ? p.cyl[1] + p.cyl[4] : p.limb ? Math.max(p.limb[1], p.limb[4]) + p.limb[6] : Math.max(...p.prism[2].map((q) => q[0])));
const partBottom = (p) => (p.box ? p.box[1] - p.box[4] : p.sphere ? p.sphere[1] - p.sphere[4] : p.cyl ? p.cyl[1] - p.cyl[4] : p.limb ? Math.min(p.limb[1], p.limb[4]) - p.limb[6] : Math.min(...p.prism[2].map((q) => q[0])));

test('roof toppers: on every vehicle they sit on top, touching the roof', () => {
  for (const v of VEHICLES) {
    const plain = makeVehicle(v.id).model;
    const roof = Math.max(...plain.body.map((s) => s[3]), ...(plain.cabin || []).map((c) => c[4]));
    for (const kind of Object.keys(TOPPERS)) {
      if (kind === 'none') continue;
      const m = makeVehicle(v.id, { topper: kind }).model;
      const added = m.parts.slice(plain.parts.length);
      assert.ok(added.length > 0, `${v.id} ${kind} adds parts`);
      const bottom = Math.min(...added.map(partBottom));
      const top = Math.max(...added.map(partTop));
      // Rests on something (the roof, a roll bar or a cab deflector), not floating.
      const highest = Math.max(roof, ...plain.parts.map(partTop));
      assert.ok(bottom >= roof - 0.6 && bottom <= highest + 0.15, `${v.id} ${kind}: bottom ${bottom.toFixed(2)} vs roof ${roof.toFixed(2)}`);
      assert.ok(top > roof, `${v.id} ${kind} sticks up above the roof`);
      assert.doesNotThrow(() => buildCarBody(m, makeVehicle(v.id).paint));
    }
  }
});

test('roof toppers: saved per vehicle; unknown values dropped', () => {
  const g = sanitizeGarage({ v: 1, owned: ['zippy'], selected: 'zippy', custom: { zippy: { topper: 'crown' }, pip: { topper: 'rocket' } } });
  assert.equal(g.custom.zippy.topper, 'crown');
  assert.equal(g.custom.pip.topper, undefined);
  assert.equal(sanitizeGarage({ v: 1, custom: { zippy: { topper: 'toString' } } }).custom.zippy.topper, undefined);
});

test('smooth triangles are wound to face the way their normals point', () => {
  // The shader decides the lit side from the winding, so a mismatch shades a
  // surface as if lit from inside (the old grey crown cones).
  const mb = new MeshBuilder();
  mb.cylinder(0, 0, 0, 0.3, 0.2, 12, 'y', [1, 1, 0], [1, 1, 0], 0);
  mb.cylinder(0, 0, 0, 0.3, 0.2, 12, 'x', [1, 1, 0]);
  mb.cylinder(0, 0, 0, 0.3, 0.2, 12, 'z', [1, 1, 0]);
  const d = mb.array();
  let bad = 0;
  for (let i = 0; i < d.length; i += FLOATS_PER_VERTEX * 3) {
    const p = (k) => [d[i + k * FLOATS_PER_VERTEX], d[i + k * FLOATS_PER_VERTEX + 1], d[i + k * FLOATS_PER_VERTEX + 2]];
    const n = [3, 4, 5].map((o) => d[i + o] + d[i + FLOATS_PER_VERTEX + o] + d[i + 2 * FLOATS_PER_VERTEX + o]);
    const [a, b, c] = [p(0), p(1), p(2)];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (f[0] * n[0] + f[1] * n[1] + f[2] * n[2] < 0) bad++;
  }
  assert.equal(bad, 0);
});

test('honk: traffic ahead in the way moves over; there is a short gap between honks', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 3 });
  const p = s.player;
  const mpu = track.metresPerUnit;
  const [ahead, behind, far] = s.traffic;
  for (const c of s.traffic) (c.x = c.targetX = p.x), (c.laneTimer = 99);
  ahead.z = p.z + 30 / mpu;
  behind.z = track.length - 30 / mpu;
  far.z = p.z + 200 / mpu;
  assert.equal(s.honk(), true);
  assert.equal(s.events.at(-1).type, 'honk');
  assert.notEqual(ahead.targetX, p.x, 'the car ahead changes lane');
  assert.equal(behind.targetX, p.x, 'cars behind ignore it');
  assert.equal(far.targetX, p.x, 'cars far away ignore it');
  assert.equal(s.honk(), false, 'too soon');
  run(s, 0.5, input({ throttle: 0 }));
  assert.equal(s.honk(), true);
});

test('hidden animals: three per map, on the road edge, clear of ramps', () => {
  const ids = new Set();
  for (const def of TRACKS) {
    const T = buildTrack3D(def);
    const here = ANIMALS.filter((a) => a.map === def.id);
    assert.equal(here.length, 3, def.id);
    for (const a of here) {
      assert.ok(!ids.has(a.id), `${a.id} unique`);
      ids.add(a.id);
      assert.ok(a.seg > 0 && a.seg < T.segments.length, `${a.id} on the track`);
      assert.ok(Math.abs(a.x) <= 0.85, `${a.id} reachable on the road`);
      assert.ok(typeof ANIMAL_MODELS[a.id] === 'function', `${a.id} has a model`);
      assert.ok(ANIMAL_MODELS[a.id]().vertexCount > 100);
      for (const r of def.features.ramps) assert.ok(Math.abs(a.seg - r.seg) > 40, `${a.id} away from ramp at ${r.seg}`);
    }
  }
  assert.equal(ids.size, ANIMALS.filter((a) => a.map !== 'island').length);
  // Island animals reuse a 3D model and have a kind of place to live.
  for (const a of ANIMALS.filter((x) => x.map === 'island')) {
    assert.ok(!ids.has(a.id), `${a.id} unique`);
    assert.ok(typeof ANIMAL_MODELS[a.model] === 'function', `${a.id} has a model`);
    assert.ok(a.area, `${a.id} has an area`);
  }
});

/** Drive the player straight past an animal at its side of the road. */
function passAnimal(s, a) {
  const p = s.player;
  p.z = a.z - 30 / s.track.metresPerUnit;
  p.x = a.x * 0.8;
  p.speed = 6000;
  run(s, 1.5, input({ throttle: 0.6 }));
}

test('hidden animals: first visit is a new sticker with points, later ones a hello', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const a = s.fun.animals[0];
  passAnimal(s, a);
  const met = s.events.filter((e) => e.type === 'animal');
  assert.deepEqual(
    met.map((e) => [e.id, e.first]),
    [[a.id, true]],
  );
  const score = s.events.find((e) => e.type === 'score' && e.kind === 'animal');
  assert.equal(score.points, ANIMAL_POINTS);
  assert.ok(s.fun.known.has(a.id));

  // Next lap: a hello, no points.
  s.events.length = 0;
  s.fun.respawn();
  passAnimal(s, a);
  assert.deepEqual(
    s.events.filter((e) => e.type === 'animal').map((e) => e.first),
    [false],
  );
  assert.ok(!s.events.some((e) => e.kind === 'animal'));

  // Passing on the far side of the road does not count.
  const t = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const b = t.fun.animals[0];
  passAnimal(t, { ...b, x: -b.x });
  assert.ok(!t.events.some((e) => e.type === 'animal'));
});

test('hidden animals: already-found animals give no points; sticker book saves per player', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const a = s.fun.animals[0];
  s.fun.known = new Set([a.id]);
  passAnimal(s, a);
  assert.equal(s.events.find((e) => e.type === 'animal').first, false);

  const store = memory();
  const A = new Achievements(store);
  const earned = [];
  A.onEarn = (b) => earned.push(b.id);
  assert.equal(A.findAnimal('bunny'), true);
  assert.equal(A.findAnimal('bunny'), false);
  assert.equal(A.findAnimal('dragon'), false);
  assert.deepEqual(earned, ['animal']);
  assert.deepEqual(new Achievements(store).state.animals, ['bunny']);
  for (const x of ANIMALS) A.findAnimal(x.id);
  assert.ok(earned.includes('zoo'));
  assert.deepEqual(sanitizeAchievements({ v: 1, animals: ['bunny', 'bunny', 'dragon', 3] }).animals, ['bunny']);
});

test('race results carry each car colour for the podium', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const race = new Race(s, { opponents: pickOpponents(EVENTS[0], s.car, 5, 1) });
  race.finish(s.body, false);
  race.end();
  for (const st of race.results.standings) assert.match(st.colour, /^#[0-9a-f]{6}$/i);
});
