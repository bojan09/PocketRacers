import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profiles, sanitizeProfiles, scopedStorage, MAX_PROFILES } from '../../src/core/profiles.js';
import { Garage } from '../../src/core/garage.js';
import { Progress } from '../../src/core/progress.js';
import { Career } from '../../src/core/career.js';

function memStore(init = {}) {
  const m = { ...init };
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => (m[k] = String(v)), removeItem: (k) => delete m[k], m };
}

test('profiles: fresh install has no players', () => {
  const P = new Profiles(memStore());
  assert.deepEqual(P.list, []);
  assert.equal(P.current, null);
  assert.equal(P.storageFor(), null);
});

test('profiles: an old save becomes the first player; others start fresh', () => {
  const store = memStore({ 'pocketracers.progress': JSON.stringify({ v: 1, points: 4200 }) });
  const P = new Profiles(store);
  assert.deepEqual(P.list, ['fox']);
  assert.equal(P.current, 'fox');
  assert.equal(new Progress(P.storageFor('fox')).points, 4200);
  P.add('panda');
  assert.equal(new Progress(P.storageFor('panda')).points, 0);
  // Migration runs once: a reload keeps the same players.
  assert.deepEqual(new Profiles(store).list, ['fox', 'panda']);
});

test('profiles: players do not share cars, points or stars', () => {
  const store = memStore();
  const P = new Profiles(store);
  P.add('tiger');
  P.add('frog');
  const t = { progress: new Progress(P.storageFor('tiger')), garage: new Garage(P.storageFor('tiger')), career: new Career(P.storageFor('tiger')) };
  t.progress.add(10000);
  t.progress.save();
  assert.ok(t.garage.unlock('trailhound', t.progress));
  t.career.record('rookie', 3, 60);
  // Re-point stores at the other player, as the game does when switching.
  for (const s of Object.values(t)) {
    s.storage = P.storageFor('frog');
    s.load();
  }
  assert.equal(t.progress.points, 0);
  assert.ok(!t.garage.owns('trailhound'));
  assert.equal(t.career.stars('rookie'), 0);
});

test('profiles: unique animals, at most four, removal deletes progress', () => {
  const store = memStore();
  const P = new Profiles(store);
  assert.ok(P.add('fox'));
  assert.ok(!P.add('fox'), 'animals are unique');
  assert.ok(!P.add('dragon'), 'unknown animal');
  for (const id of ['panda', 'tiger', 'frog']) P.add(id);
  assert.equal(P.list.length, MAX_PROFILES);
  assert.ok(!P.add('dog'), 'full');
  scopedStorage(store, 'tiger').setItem('pocketracers.progress', '{"v":1,"points":5}');
  P.select('tiger');
  assert.ok(P.remove('tiger'));
  assert.equal(store.getItem('pocketracers.progress@tiger'), null);
  assert.equal(P.current, 'fox');
  // Re-adding an animal starts fresh.
  P.add('tiger');
  assert.equal(new Progress(P.storageFor('tiger')).points, 0);
});

test('profiles: tampered save is cleaned', () => {
  const p = sanitizeProfiles({ v: 1, list: ['fox', 'fox', 'dragon', 'panda', 'tiger', 'frog', 'dog'], current: 'dragon' });
  assert.deepEqual(p.list, ['fox', 'panda', 'tiger', 'frog']);
  assert.equal(p.current, 'fox');
  assert.deepEqual(sanitizeProfiles('x').list, []);
});
