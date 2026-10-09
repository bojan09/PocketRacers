import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ACHIEVEMENTS, ACHIEVEMENT_STATS } from '../../src/data/achievements.js';
import { Achievements, sanitizeAchievements } from '../../src/core/achievements.js';
import { AutoQuality } from '../../src/core/autoQuality.js';
import { buildServiceWorker } from '../../tools/precache.mjs';

function memStore() {
  const m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => (m[k] = String(v)), m };
}

test('badges: ids unique, every goal and reward sensible', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.goal > 0 && a.reward > 0 && a.name && a.desc && a.icon, a.id);
  }
});

test('badges: earned once when the goal is reached, reward callback fires', () => {
  const store = memStore();
  const A = new Achievements(store);
  const got = [];
  A.onEarn = (a) => got.push(a.id);
  A.add('jumps');
  assert.deepEqual(got, ['jump']);
  A.add('jumps');
  assert.deepEqual(got, ['jump'], 'not twice');
  for (let i = 0; i < 9; i++) A.add('wins');
  assert.ok(!A.earned('wins-10'));
  A.add('wins');
  assert.ok(A.earned('first-win') && A.earned('wins-10'));
  A.max('bestAir', 1.2);
  A.max('bestAir', 0.5);
  assert.equal(A.stat('bestAir'), 1.2, 'max never lowers');
  A.add('km', 3.4);
  A.save();
  const back = new Achievements(store);
  assert.equal(back.stat('km'), 3.4);
  assert.ok(back.earned('wins-10'));
  assert.equal(back.progress(ACHIEVEMENTS.find((a) => a.id === 'road-trip')), 3.4 / 25);
});

test('badges: maps count once each', () => {
  const A = new Achievements(memStore());
  for (const m of ['sunny-valley', 'sunny-valley', 'desert-canyon']) A.visitMap(m);
  assert.equal(A.stat('maps'), 2);
});

test('badges: tampered save is cleaned', () => {
  const s = sanitizeAchievements({ v: 1, stats: { wins: -3, km: 'x', jumps: 4, hack: 99 }, earned: ['jump', 'jump', 'nope'], maps: [1, 'a'] });
  assert.deepEqual(s.stats, { jumps: 4 });
  assert.deepEqual(s.earned, ['jump']);
  assert.deepEqual(s.maps, ['a']);
  assert.deepEqual(sanitizeAchievements('junk').earned, []);
  assert.ok(ACHIEVEMENT_STATS.includes('km'));
});

test('auto graphics: steps down when slow, never back up to a slow level', () => {
  const q = new AutoQuality('high');
  const run = (ms, secs) => {
    const changes = [];
    for (let t = 0; t < secs * 1000; t += ms) {
      const c = q.frame(ms);
      if (c) changes.push(c);
    }
    return changes;
  };
  assert.deepEqual(run(16.7, 20), [], 'smooth at 60 fps');
  assert.deepEqual(run(33, 5), ['medium'], '30 fps drops a level');
  assert.deepEqual(run(16.7, 30), [], 'high was too slow: stays on medium');
  assert.deepEqual(run(40, 10), ['low']);
  assert.deepEqual(run(40, 10), [], 'cannot go below low');
  assert.equal(new AutoQuality('high').frame(5000), null, 'one stall is not a trend');
  const slow = new AutoQuality('high');
  let c = null;
  for (let i = 0; i < 40 && !c; i++) c = slow.frame(1000);
  assert.equal(c, 'medium', 'a very slow device still steps down');
});

test('auto graphics: climbs back to an untried level when there is headroom', () => {
  const q = new AutoQuality('low');
  let c = null;
  for (let i = 0; i < 2000 && !c; i++) c = q.frame(8.3);
  assert.equal(c, 'medium');
});

test('offline: sw.js lists every shipped file and is up to date', async () => {
  const sw = await buildServiceWorker();
  assert.equal(sw.current, sw.source, 'sw.js is stale: run `npm run sw`');
  for (const f of sw.files) if (f !== './') assert.ok(existsSync(new URL(`../../${f}`, import.meta.url)), f);
  for (const f of ['src/main.js', 'styles/main.css', 'manifest.webmanifest', 'icons/icon-192.png']) assert.ok(sw.files.includes(f), f);
});
