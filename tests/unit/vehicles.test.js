import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES, makeVehicle, vehicleStats, resolveLook, VEHICLE_BY_ID, LIVERIES, upgradeCost, UPGRADES } from '../../src/data/vehicles.js';
import { kitSlots, KIT_OPTIONS } from '../../src/data/kits.js';
import { FAMILIES } from '../../src/data/vehicleFamilies.js';
import { ENGINE_PROFILES, Gearbox } from '../../src/audio/engine.js';
import { buildCarBody, buildWheel } from '../../src/render3d/carModel.js';
import { Garage, sanitizeGarage, freshGarage } from '../../src/core/garage.js';
import { Progress } from '../../src/core/progress.js';
import { TRAFFIC_MODELS, TRAFFIC_PAINTS } from '../../src/data/cars.js';
import { tyreIntersections } from './wheelClearance.js';
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
    for (const livery of LIVERIES) {
      const def = makeVehicle(v.id, { livery, rimStyle: 'steel', ride: 'max' });
      const { body, anchors } = buildCarBody(def.model, def.paint);
      const wheel = buildWheel(def.model, def.paint);
      assert.ok(body.vertexCount > 300 && body.vertexCount < 30000, `${v.id} tris ${body.vertexCount / 3}`);
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
    assert.ok(def.widthWorld / 2 / track.roadHalfWidth < 0.24, `${v.id} too wide`);
  }
});

test('tyres never intersect the body, parts or wheel arches (any ride height, full steering)', () => {
  for (const v of VEHICLES) {
    for (const ride of ['low', 'stock', 'lifted', 'max']) {
      const def = makeVehicle(v.id, { ride, livery: 'racing' });
      const { body, anchors } = buildCarBody(def.model, def.paint);
      const hits = tyreIntersections(def.model, body, anchors);
      assert.equal(hits.length, 0, `${v.id} (${ride}): ${JSON.stringify(hits.slice(0, 2))}`);
    }
  }
  for (const [id, model] of Object.entries(TRAFFIC_MODELS)) {
    const { body, anchors } = buildCarBody(model, TRAFFIC_PAINTS[0]);
    assert.equal(tyreIntersections(model, body, anchors).length, 0, `traffic ${id}`);
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

// --------------------------------------------------------------- 2H roster

test('roster: about 50 vehicles, every family has at least 4', () => {
  assert.ok(VEHICLES.length >= 50, `${VEHICLES.length}`);
  for (const f of Object.keys(FAMILIES)) assert.ok(VEHICLES.filter((v) => v.family === f).length >= 4, f);
  // Prices spread from free starters to late-game unlocks.
  assert.ok(VEHICLES.filter((v) => v.price === 0).length >= 3);
  assert.ok(Math.max(...VEHICLES.map((v) => v.price)) >= 20000);
});

test('body kits never touch the tyres (every option, every vehicle)', () => {
  for (const v of VEHICLES) {
    const slots = kitSlots(v);
    const kits = [Object.fromEntries(slots.map((s) => [s, KIT_OPTIONS[s].at(-1)]))];
    for (const s of slots) for (const o of KIT_OPTIONS[s]) kits.push({ [s]: o });
    for (const kit of kits) {
      const d = makeVehicle(v.id, { ...kit, ride: 'low', neon: '#ff2e88' });
      const { body, anchors } = buildCarBody(d.model, d.paint);
      assert.equal(tyreIntersections(d.model, body, anchors).length, 0, `${v.id} ${JSON.stringify(kit)}`);
      assert.ok(anchors.neon, `${v.id} neon anchor`);
    }
  }
});

test('upgrades: each level helps, costs rise, nitro lasts longer', () => {
  const base = makeVehicle('zippy').handling;
  const full = makeVehicle('zippy', {}, { engine: 5, turbo: 5, tyres: 5, nitro: 5 }).handling;
  assert.ok(full.maxSpeed > base.maxSpeed * 1.08 && full.accel > base.accel * 1.2 && full.grip > base.grip);
  assert.ok(full.nitroDrain < 1 && base.nitroDrain === 1);
  assert.ok(vehicleStats('zippy', { engine: 5 }).speed > vehicleStats('zippy').speed);
  for (let l = 1; l < 5; l++) assert.ok(upgradeCost('zippy', l) > upgradeCost('zippy', l - 1));
  assert.ok(upgradeCost('nova', 0) > upgradeCost('zippy', 0), 'pricier cars cost more to tune');
  // Out-of-range levels are clamped.
  assert.deepEqual(makeVehicle('zippy', {}, { engine: 99 }).handling.maxSpeed, makeVehicle('zippy', {}, { engine: 5 }).handling.maxSpeed);
});

test('garage: buying upgrades spends points, caps at 5, survives reload; bad saves cleaned', () => {
  const data = { 'pocketracers.progress': JSON.stringify({ v: 1, points: 100000 }) };
  const store = { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)) };
  globalThis.localStorage = store;
  const progress = new Progress();
  const g = new Garage(store);
  assert.equal(g.buyUpgrade('bolt', 'engine', progress), false, 'not owned');
  for (let i = 0; i < 5; i++) assert.ok(g.buyUpgrade('zippy', 'engine', progress));
  assert.equal(g.buyUpgrade('zippy', 'engine', progress), false, 'maxed');
  const spent = [0, 1, 2, 3, 4].reduce((n, l) => n + upgradeCost('zippy', l), 0);
  assert.equal(progress.points, 100000 - spent);
  g.setCustom('zippy', 'spoiler', 'gt');
  g.resetCustom('zippy');
  const again = new Garage(store);
  assert.equal(again.upgrades('zippy').engine, 5, 'upgrades survive a look reset and reload');
  const clean = sanitizeGarage({
    v: 1,
    owned: ['zippy'],
    custom: { zippy: { spoiler: 'rocket', splitter: 'splitter', bullbar: 'bullbar', neon: 'red', tint: 'gold' } },
    upgrades: { zippy: { engine: 9, turbo: -1, wings: 3, nitro: 2.5 }, fake: { engine: 1 } },
  });
  assert.deepEqual(clean.custom.zippy, { splitter: 'splitter', tint: 'gold' });
  assert.deepEqual(clean.upgrades, { zippy: { engine: 5 } });
  assert.ok(UPGRADES.length === 4);
  delete globalThis.localStorage;
});
