import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineVoice, VOICES, voiceVariant } from '../../src/audio/engineSynth.js';
import { ENGINE_PROFILES } from '../../src/audio/engine.js';
import { FAMILIES } from '../../src/data/vehicleFamilies.js';

const SR = 22050;

/** Render `seconds` at a steady rpm/throttle; returns the samples. */
function steady(id, rpm, throttle, seconds = 1, variant) {
  const v = new EngineVoice(SR, 3);
  v.setProfile(id, variant);
  const P = ENGINE_PROFILES[id];
  const frac = (rpm - P.idle) / (P.redline - P.idle);
  const out = new Float32Array(Math.round(seconds * SR));
  const blk = new Float32Array(128);
  for (let i = 0; i < out.length; i += 128) {
    v.render(blk, rpm, throttle, 0.7, Math.max(0, Math.min(1, frac)));
    out.set(blk.subarray(0, Math.min(128, out.length - i)), i);
  }
  return out.subarray(Math.round(SR * 0.25)); // skip the fade-in
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

/** Magnitude of frequency f (Hz) in a (single DFT bin, Hann window). */
function mag(a, f) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (a.length - 1));
    re += a[i] * w * Math.cos((2 * Math.PI * f * i) / SR);
    im += a[i] * w * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return Math.hypot(re, im);
}

test('engine voices: every vehicle family has one, with a gearbox profile', () => {
  for (const [name, fam] of Object.entries(FAMILIES)) {
    assert.ok(VOICES[fam.engine], `${name} voice`);
    assert.ok(ENGINE_PROFILES[fam.engine], `${name} gearbox`);
  }
  for (const [id, V] of Object.entries(VOICES)) {
    assert.equal(V.pattern.length, (V.offsets || V.pattern).length, `${id} pattern per cylinder`);
    assert.equal(V.pattern.length, V.cyl, `${id} cylinders`);
  }
});

test('engine voices: clean output, louder under throttle than at idle', () => {
  for (const id of Object.keys(VOICES)) {
    const P = ENGINE_PROFILES[id];
    const idle = steady(id, P.idle, 0);
    const pull = steady(id, P.idle + (P.redline - P.idle) * 0.7, 1);
    for (const a of [idle, pull]) for (const x of a) assert.ok(Number.isFinite(x) && Math.abs(x) < 1, `${id} in range`);
    assert.ok(rms(pull) > rms(idle) * 1.3, `${id}: pull ${rms(pull).toFixed(3)} vs idle ${rms(idle).toFixed(3)}`);
    assert.ok(rms(pull) > 0.08 && rms(pull) < 0.45, `${id} level ${rms(pull).toFixed(3)}`);
  }
});

test('engine voices: the note is the firing rate (rpm x cylinders / 120)', () => {
  for (const [id, rpm] of [
    ['i4', 3000],
    ['flat6', 4000],
    ['v10', 7000],
    ['diesel', 1500],
  ]) {
    const a = steady(id, rpm, 1, 1.2);
    const f = (rpm / 120) * VOICES[id].cyl;
    const on = mag(a, f);
    const off = (mag(a, f * 1.27) + mag(a, f * 0.73)) / 2;
    assert.ok(on > off * 4, `${id}: ${f} Hz stands out (${(on / off).toFixed(1)}x)`);
  }
  // A cross-plane V8's uneven pulses add a half-order beat (the burble).
  const v8 = steady('v8', 2000, 1, 1.2);
  const f8 = (2000 / 120) * 8;
  assert.ok(mag(v8, f8 / 2) > mag(steady('flat6', 2000, 1, 1.2), ((2000 / 120) * 6) / 2) * 1.5, 'V8 lope');
});

test('engine voices: big engines sound deeper; vehicles differ a little, consistently', () => {
  const centroid = (a) => {
    let num = 0;
    let den = 0;
    for (let f = 60; f < 4000; f += 60) {
      const m = mag(a, f);
      num += m * f;
      den += m;
    }
    return num / den;
  };
  const at = (id) => {
    const P = ENGINE_PROFILES[id];
    return centroid(steady(id, P.idle + (P.redline - P.idle) * 0.6, 1, 0.8));
  };
  const monster = at('monster');
  const sports = at('flat6');
  const race = at('v10');
  assert.ok(monster < sports && sports < race, `monster ${monster.toFixed(0)} < sports ${sports.toFixed(0)} < race ${race.toFixed(0)} Hz`);
  const a = voiceVariant('zippy');
  assert.deepEqual(voiceVariant('zippy'), a, 'stable');
  assert.notDeepEqual(voiceVariant('comet'), a);
  for (const id of ['zippy', 'comet', 'goliath', 'pip', 'x']) {
    const v = voiceVariant(id);
    assert.ok(v.pitch >= 0.93 && v.pitch <= 1.07 && v.rough >= 0.9 && v.rough <= 1.1);
  }
  // Same seed, same sound.
  assert.deepEqual(steady('bike', 5000, 1, 0.4), steady('bike', 5000, 1, 0.4));
});
