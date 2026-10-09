import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gearbox } from '../../src/audio/engine.js';

test('gearbox idles when stopped', () => {
  const g = new Gearbox();
  for (let i = 0; i < 60; i++) g.update(1 / 60, 0, 0);
  assert.ok(Math.abs(g.rpm - g.idle) < 50, `rpm ${g.rpm}`);
  assert.equal(g.gear, 0);
});

test('accelerating climbs through the gears with rpm drops on upshifts', () => {
  const g = new Gearbox();
  let shifts = 0;
  let maxRpm = 0;
  for (let i = 0; i <= 600; i++) {
    const r = g.update(1 / 60, i / 600, 1);
    if (r.shifted === 1) shifts++;
    maxRpm = Math.max(maxRpm, r.rpm);
  }
  assert.equal(g.gear, 5, 'top gear at top speed');
  assert.equal(shifts, 5);
  assert.ok(maxRpm <= g.redline + 1);
});

test('slowing down shifts back down', () => {
  const g = new Gearbox();
  for (let i = 0; i <= 600; i++) g.update(1 / 60, i / 600, 1);
  for (let i = 600; i >= 0; i--) g.update(1 / 60, i / 600, 0);
  assert.ok(g.gear <= 1, `gear ${g.gear}`);
});

test('airborne free-revs with the throttle', () => {
  const g = new Gearbox();
  for (let i = 0; i < 120; i++) g.update(1 / 60, 0.5, 1, true);
  assert.ok(g.rpm > 6000, `rpm ${g.rpm}`);
});
