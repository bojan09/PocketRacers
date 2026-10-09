import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollFromOrientation } from '../../src/input/tilt.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../../src/core/settings.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

test('tilt: portrait, phone flat, rolled right steers right', () => {
  assert.ok(near(rollFromOrientation(0, 20, 0), 20));
  assert.ok(near(rollFromOrientation(0, -20, 0), -20));
});

test('tilt: portrait held upright (beta 60) still reads gamma roll', () => {
  const r = rollFromOrientation(60, 20, 0);
  assert.ok(r > 5, `roll ${r}`);
});

test('tilt: neutral landscape reads ~0 regardless of how far it is tilted back', () => {
  // Landscape (screen angle 90), device lying on its side: gamma ~ -90 + tilt.
  for (const back of [10, 40, 70]) {
    const r = rollFromOrientation(0, -back, 90);
    assert.ok(Math.abs(r) < 1, `back=${back} roll=${r}`);
  }
});

test('tilt: landscape steering is opposite for the two landscape orientations', () => {
  // Rotating the device about the screen normal changes beta in landscape.
  const a = rollFromOrientation(15, -45, 90);
  const b = rollFromOrientation(15, -45, -90);
  assert.ok(Math.sign(a) === -Math.sign(b) && Math.abs(a) > 5);
});

test('settings: defaults when storage is empty or corrupt', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = v;
    },
  };
  assert.deepEqual(loadSettings(), { ...DEFAULT_SETTINGS, triedSchemes: [] });
  store['pocketracers.settings'] = '{not json';
  assert.equal(loadSettings().controlScheme, 'buttons');
});

test('settings: round trip and invalid values are rejected', () => {
  const s = loadSettings();
  s.controlScheme = 'wheel';
  s.steerSensitivity = 9;
  assert.ok(saveSettings(s));
  const back = loadSettings();
  assert.equal(back.controlScheme, 'wheel');
  assert.equal(back.steerSensitivity, 1.5, 'clamped');
  localStorage.setItem('pocketracers.settings', JSON.stringify({ v: 1, data: { controlScheme: 'jetpack', quality: 7 } }));
  const bad = loadSettings();
  assert.equal(bad.controlScheme, 'buttons');
  assert.equal(bad.quality, 'high');
});

test('settings: save failure does not throw', () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(saveSettings(loadSettings()), false);
});
