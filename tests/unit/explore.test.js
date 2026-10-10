import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenWorld } from '../../src/world/openWorld.js';
import { ExploreMap, EXPLORE_REACH, EXPLORE_GRID } from '../../src/world/explore.js';
import { scopedStorage } from '../../src/core/profiles.js';
import { Achievements } from '../../src/core/achievements.js';

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

const W = new OpenWorld();

test('island map: starts covered; driving uncovers the cells nearby, once', () => {
  const E = new ExploreMap(memory());
  E.setWorld(W);
  assert.ok(E.landCount > 500, `land cells ${E.landCount}`);
  assert.equal(E.percent, 0);
  const got = E.reveal(W.spawn.x, W.spawn.z);
  assert.ok(got.length > 4);
  assert.ok(E.seen(E.cell(W.spawn.x), E.cell(W.spawn.z)));
  assert.ok(!E.seen(E.cell(W.spawn.x + EXPLORE_REACH * 3), E.cell(W.spawn.z)), 'far away stays covered');
  assert.deepEqual(E.reveal(W.spawn.x, W.spawn.z), [], 'nothing new the second time');
  assert.ok(E.percent >= 1);
  // Off the map edge: no crash, nothing uncovered.
  assert.deepEqual(E.reveal(1e6, -1e6), []);
});

test('island map: saved per player and survives a reload; bad saves start fresh', () => {
  const base = memory();
  const a = new ExploreMap(scopedStorage(base, 'fox'));
  a.setWorld(W);
  a.reveal(W.spawn.x, W.spawn.z);
  a.reveal(W.spawn.x + 300, W.spawn.z);
  const pct = a.percent;
  a.save();
  const again = new ExploreMap(scopedStorage(base, 'fox'));
  again.setWorld(W);
  assert.equal(again.percent, pct);
  const other = new ExploreMap(scopedStorage(base, 'panda'));
  other.setWorld(W);
  assert.equal(other.percent, 0, "a sibling's map is their own");
  // Switching player on the same object reloads.
  other.storage = scopedStorage(base, 'fox');
  other.load();
  assert.equal(other.percent, pct);
  for (const bad of ['{', JSON.stringify({ v: 1, island: 'abc' }), JSON.stringify({ v: 9, island: '' })]) {
    const s = memory();
    s.setItem('pocketracers.explore', bad);
    const e = new ExploreMap(s);
    e.setWorld(W);
    assert.equal(e.percent, 0);
    assert.equal(e.bits.length, (EXPLORE_GRID * EXPLORE_GRID) / 8);
  }
});

test('island map: badges for uncovering a quarter and most of the island', () => {
  const E = new ExploreMap(memory());
  E.setWorld(W);
  const A = new Achievements(memory());
  const earned = [];
  A.onEarn = (b) => earned.push(b.id);
  for (let z = -2000; z <= 2000; z += 100) for (let x = -2000; x <= 2000; x += 100) E.reveal(x, z);
  A.max('islandMap', E.percent);
  assert.equal(E.percent, 100);
  assert.deepEqual(earned, ['island-25', 'island-80']);
});
