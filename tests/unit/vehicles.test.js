import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES, makeVehicle, vehicleStats, resolveLook, VEHICLE_BY_ID } from '../../src/data/vehicles.js';
import { FAMILIES } from '../../src/data/vehicleFamilies.js';
import { ENGINE_PROFILES, Gearbox } from '../../src/audio/engine.js';
import { buildCarBody, buildWheel } from '../../src/render3d/carModel.js';
import { Garage, sanitizeGarage, freshGarage } from '../../src/core/garage.js';
import { Progress } from '../../src/core/progress.js';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { DrivingSession } from '../../src/sim/session.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
const circlePoints = Array.from({ length: 24 }, (_, i) => {
  const a = (-i / 24) * Math.PI * 2;
  return { p: [Math.cos(a) * 2500, Math.sin(a) * 2500], y: 0 };
});
const straight = buildTrack3D({ ...testTrack, points: circlePoints, scenery: [], features: {} });
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });

test('roster: unique ids and names, every family covered, free starters exist', () => {
  assert.equal(new Set(VEHICLES.map((v) => v.id)).size, VEHICLES.length);
  assert.equal(new Set(VEHICLES.map((v) => v.name)).size, VEHICLES.length);
  for (const f of Object.keys(FAMILIES)) assert.ok(VEHICLES.some((v) => v.family === f), `no vehicle in ${f}`);
  assert.ok(VEHICLES.filter((v) => v.price === 0).length >= 2);
  for (const v of VEHICLES) assert.ok(ENGINE_PROFILES[FAMILIES[v.family].engine], `${v.id} engine`);
});

test('every vehicle builds a sane model with every livery and rim', () => {
  for (const v of VEHICLES) {
    for (const livery of ['clean', 'racing', 'side', 'twotone']) {
      const def = makeVehicle(v.id, { livery, rimStyle: 'steel', ride: 'max' });
      const { body, anchors } = buildCarBody(def.model, def.paint);
      const wheel = buildWheel(def.model, def.paint);
      assert.ok(body.vertexCount > 300 && body.vertexCount < 9000, `${v.id} tris ${body.vertexCount / 3}`);
      assert.ok(wheel.vertexCount > 100);
      assert.ok(!body.array().some(Number.isNaN), `${v.id} NaN`);
      const b = body.bounds();
      assert.ok(b.radius < 6, `${v.id} radius ${b.radius}`);
      // Wheels touch the ground; steering is on the front axle only.
      for (const w of anchors.wheels) assert.equal(w[1], def.model.wheels.radius);
      assert.ok(anchors.steer.filter(Boolean).length === 2, `${v.id} steer`);
      assert.ok(anchors.rearWheels.length >= 2);
    }
    // Fits on the road with room to overtake.
    const def = makeVehicle(v.id);
    assert.ok(def.widthWorld / 2 / track.roadHalfWidth < 0.22, `${v.id} too wide`);
  }
});

test('customisation only changes the look, never the handling', () => {
  const a = makeVehicle('thunder');
  const b = makeVehicle('thunder', { body: '#00ff00', livery: 'side', ride: 'lifted', rimStyle: 'disc' });
  assert.deepEqual(a.handling, b.handling);
  assert.equal(b.paint.body, '#00ff00');
  assert.equal(b.paint.ride, 0.08);
  assert.equal(resolveLook(VEHICLE_BY_ID.thunder).body, VEHICLE_BY_ID.thunder.paint.body);
});

test('families feel different: race is fastest, trucks are slowest, monsters jump highest', () => {
  const top = (id) => {
    const s = new DrivingSession(straight, makeVehicle(id), { trafficCount: 0 });
    for (let i = 0; i < 14 * 120; i++) s.step(FIXED_DT, input());
    return s.player.speed;
  };
  const race = top('bolt');
  const sports = top('zippy');
  const truck = top('nordhaul');
  assert.ok(race > sports && sports > truck, `${race} ${sports} ${truck}`);
  // Everyone reaches their own top speed on the straight.
  assert.ok(truck > makeVehicle('nordhaul').handling.maxSpeed * 0.97);

  const air = (id) => {
    const s = new DrivingSession(track, makeVehicle(id), { trafficCount: 0 });
    const r = track.ramps[0];
    s.player.z = r.z0 - 4000;
    s.player.x = r.x;
    s.player.speed = 10500;
    let best = 0;
    for (let i = 0; i < 4 * 120; i++) {
      s.step(FIXED_DT, input());
      best = Math.max(best, s.player.air);
    }
    return best;
  };
  assert.ok(air('basher') > air('zippy') * 1.2);
  const stats = vehicleStats('basher');
  assert.ok(stats.offroad > vehicleStats('bolt').offroad);
});

test('traffic pace does not depend on the player vehicle', () => {
  const a = new DrivingSession(track, makeVehicle('nordhaul'), { trafficCount: 3 });
  const b = new DrivingSession(track, makeVehicle('apex'), { trafficCount: 3 });
  assert.deepEqual(
    a.traffic.map((c) => c.cruise),
    b.traffic.map((c) => c.cruise),
  );
});

test('engine profiles produce sensible gearboxes', () => {
  for (const [id, P] of Object.entries(ENGINE_PROFILES)) {
    const g = new Gearbox(P);
    let rpm = 0;
    for (let i = 0; i <= 100; i++) rpm = Math.max(rpm, g.update(0.05, i / 100, 1).rpm);
    assert.ok(rpm <= P.redline + 1 && rpm > P.idle, `${id} rpm ${rpm}`);
    assert.equal(g.gear, (P.tops || [0, 0, 0, 0, 0, 0]).length - 1, `${id} reaches top gear`);
  }
});

// ------------------------------------------------------------------ garage

function memoryStorage(init = {}) {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), data };
}

test('garage: fresh save owns the free vehicles and selects the default', () => {
  const g = new Garage(memoryStorage());
  assert.deepEqual(g.state, freshGarage());
  assert.ok(g.owns('zippy') && !g.owns('bolt'));
});

test('garage: corrupt or hostile saves are cleaned', () => {
  const g = sanitizeGarage({
    v: 1,
    selected: 'bolt', // not owned -> ignored
    owned: ['nope', 'thunder', 42],
    custom: { thunder: { body: 'red; background:url(x)', accent: '#123456', livery: 'evil', ride: 'max', extra: 1 }, ghost: { body: '#000000' } },
  });
  assert.equal(g.selected, 'zippy');
  assert.ok(g.owned.includes('thunder') && !g.owned.includes('nope'));
  assert.deepEqual(g.custom.thunder, { accent: '#123456', ride: 'max' });
  assert.ok(!g.custom.ghost);
  assert.deepEqual(sanitizeGarage('garbage'), freshGarage());
  const broken = new Garage(memoryStorage({ 'pocketracers.garage': '{not json' }));
  assert.equal(broken.selected, 'zippy');
});

test('garage: unlocking spends points, only when affordable; selection persists', () => {
  const store = memoryStorage({ 'pocketracers.progress': JSON.stringify({ v: 1, points: 2500 }) });
  globalThis.localStorage = store;
  const progress = new Progress();
  const g = new Garage(store);
  assert.equal(g.unlock('bolt', progress), false); // 9000 > 2500
  assert.equal(progress.points, 2500);
  assert.equal(g.select('bolt'), false);
  assert.equal(g.unlock('trailhound', progress), true);
  assert.equal(progress.points, 500);
  assert.equal(g.unlock('trailhound', progress), false); // already owned
  assert.ok(g.select('trailhound'));
  g.setCustom('trailhound', 'body', '#ff006e');
  const again = new Garage(store);
  assert.equal(again.selected, 'trailhound');
  assert.equal(again.custom('trailhound').body, '#ff006e');
  assert.equal(JSON.parse(store.data['pocketracers.progress']).points, 500);
  delete globalThis.localStorage;
});
