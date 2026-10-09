import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack3D } from '../../src/world/track3d.js';
import testTrack from '../../src/data/tracks/testTrack.js';
import { TRACKS } from '../../src/data/tracks/index.js';
import { makeVehicle, VEHICLES, nitroColour } from '../../src/data/vehicles.js';
import { PROP_KINDS, PROP_POINTS } from '../../src/data/props.js';
import { PROP_MODELS } from '../../src/render3d/props.js';
import { DrivingSession } from '../../src/sim/session.js';
import { FIXED_DT } from '../../src/core/loop.js';

const track = buildTrack3D(testTrack);
const input = (o = {}) => ({ steer: 0, analog: false, throttle: 1, brake: 0, nitro: false, ...o });
function run(s, seconds, inp) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) s.step(FIXED_DT, typeof inp === 'function' ? inp(i * FIXED_DT) : inp);
}

test('nitro colour: the car body, or a bright accent when the body is dark or grey', () => {
  assert.deepEqual(nitroColour({ body: '#ff0000', accent: '#0000ff' }), [1, 0, 0]);
  assert.deepEqual(nitroColour({ body: '#1b1f3b', accent: '#ffd23f' }).map((v) => +v.toFixed(2)), [1, 0.82, 0.25]);
  assert.deepEqual(nitroColour({ body: '#000000', accent: '#000000' }), [1, 1, 1]);
  for (const v of VEHICLES) {
    const c = nitroColour(makeVehicle(v.id).paint);
    assert.equal(Math.max(...c), 1, `${v.id} glows at full brightness`);
  }
});

test('props: every map has them on the verges, clear of tunnels, bridges, rails and ramps', () => {
  for (const def of TRACKS) {
    const T = buildTrack3D(def);
    assert.ok(T.propDefs.length >= 40, `${def.id}: ${T.propDefs.length} props`);
    for (const p of T.propDefs) {
      assert.ok(PROP_KINDS[def.id].includes(p.kind), `${def.id} ${p.kind}`);
      assert.ok(Math.abs(p.x) > 1.05 && Math.abs(p.x) < 1.5, `off the road: ${p.x}`);
      const s = T.findSegment(p.z);
      assert.ok(!s.tunnel && !s.bridge && !s.rail && !s.ramp, `${def.id} prop at ${p.z} in a clear spot`);
    }
  }
  for (const k of Object.values(PROP_KINDS).flat()) assert.ok(PROP_MODELS[k]().vertexCount > 20, `${k} model`);
});

test('props: driving into one knocks it flying for points; they come back each lap', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const o = s.fun.props[0];
  const p = s.player;
  p.z = o.z - 4 / track.metresPerUnit;
  p.x = o.x;
  p.speed = 5000;
  run(s, 1.2, input({ throttle: 0.5 }));
  assert.ok(o.hitTime >= 0, 'knocked');
  const e = s.events.find((x) => x.type === 'score' && x.kind === 'prop');
  assert.equal(e.points, PROP_POINTS * e.combo);
  assert.ok(s.fun.stats.props >= 1);
  s.fun.respawn();
  assert.equal(o.hitTime, -1);

  // On the road nothing is hit.
  const t = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  const q = t.fun.props[0];
  t.player.z = q.z - 4 / track.metresPerUnit;
  t.player.x = 0;
  t.player.speed = 5000;
  run(t, 1.2, input({ throttle: 0.5 }));
  assert.equal(q.hitTime, -1);
});

test('little driver in free drive: no pull back to the road, no rescue just for being off it', () => {
  const s = new DrivingSession(track, makeVehicle('zippy'), { trafficCount: 0 });
  s.assist = true;
  s.roam = true;
  run(s, 2, input());
  let maxX = 0;
  let rescued = false;
  run(s, 6, () => {
    maxX = Math.max(maxX, Math.abs(s.player.x));
    if (s.events.some((e) => e.type === 'rescue')) rescued = true;
    return input({ steer: s.player.x < 1.3 ? 1 : 0 });
  });
  assert.ok(maxX > 1.2, `can leave the road (max |x| ${maxX.toFixed(2)})`);
  assert.equal(rescued, false, 'driving along off-road is not "stuck"');
});
