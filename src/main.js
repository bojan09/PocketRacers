// Pocket Racers — driving prototype bootstrap. Wires simulation, renderer,
// input, audio and the DOM screens together.

import { GameLoop } from './core/loop.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { CARS, TRAFFIC_MODELS, TRAFFIC_PAINTS } from './data/cars.js';
import testTrack from './data/tracks/testTrack.js';
import { buildTrack3D } from './world/track3d.js';
import { DrivingSession } from './sim/session.js';
import { Renderer3D } from './render3d/renderer3d.js';
import { InputManager } from './input/inputManager.js';
import { tiltSupported } from './input/tilt.js';
import { GameAudio } from './audio/audio.js';
import { Hud } from './ui/hud.js';
import { mountTuningPanel } from './ui/tuning.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const track = buildTrack3D(testTrack);
const car = structuredClone(CARS.zippy);
const session = new DrivingSession(track, car);
let renderer;
try {
  renderer = new Renderer3D(
    $('game'),
    $('fx-overlay'),
    track,
    car,
    TRAFFIC_PAINTS.map((paint) => ({ model: TRAFFIC_MODELS[paint.model], paint })),
  );
} catch (err) {
  $('no-webgl').hidden = false;
  $('screen-title').hidden = true;
  throw err;
}
const controlsEl = $('controls');
const input = new InputManager(controlsEl);
const audio = new GameAudio();
const hud = new Hud();
const canVibrate = typeof navigator.vibrate === 'function';

let mode = 'title'; // 'title' | 'driving' | 'paused'

// ---------------------------------------------------------------- settings

let appliedQuality = null;
function applySettings() {
  input.configure(settings);
  session.steerSensitivity = settings.steerSensitivity;
  if (appliedQuality !== settings.quality) {
    appliedQuality = settings.quality;
    renderer.setQuality(settings.quality);
  }
  renderer.reduceEffects = settings.reduceEffects;
  audio.setVolume(settings.volume);
  controlsEl.dataset.scheme = settings.controlScheme;
  controlsEl.dataset.auto = String(settings.autoAccelerate);
  controlsEl.dataset.swap = String(settings.swapSides);
  document.documentElement.style.setProperty('--size', { s: 0.82, m: 1, l: 1.18 }[settings.buttonSize]);
  $('fps').hidden = !settings.showFps;
  $('screen-pause').querySelector('.panel').dataset.scheme = settings.controlScheme;
  if (!settings.triedSchemes.includes(settings.controlScheme)) settings.triedSchemes.push(settings.controlScheme);
  syncSettingsForm();
  syncTitle();
  saveSettings(settings);
  requestAnimationFrame(() => input.touch.measure());
}

function syncSettingsForm() {
  for (const el of document.querySelectorAll('[data-setting]')) {
    const key = el.dataset.setting;
    const v = settings[key];
    if (el.classList.contains('segmented')) {
      for (const b of el.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === v));
    } else if (el.type === 'checkbox') el.checked = v;
    else if (el.type === 'range') el.value = String(v);
  }
}

function syncTitle() {
  for (const b of document.querySelectorAll('.scheme')) {
    b.setAttribute('aria-checked', String(b.dataset.scheme === settings.controlScheme));
  }
  $('title-auto').checked = settings.autoAccelerate;
}

/** Turn on tilt steering. Must run inside a user gesture for iOS. */
async function enableTilt() {
  if (!tiltSupported()) return 'unsupported';
  const permission = await input.tilt.requestPermission();
  if (permission !== 'granted') return permission;
  const hasData = await input.tilt.start();
  return hasData ? 'granted' : 'unsupported';
}

async function chooseScheme(scheme, hintEl) {
  if (scheme === 'tilt') {
    const result = await enableTilt();
    if (result !== 'granted') {
      const msg =
        result === 'denied'
          ? 'Motion access was not allowed. Using buttons instead.'
          : 'Tilt is not available on this device. Using buttons instead.';
      if (hintEl) hintEl.textContent = msg;
      else hud.toast(msg, 2600);
      settings.controlScheme = 'buttons';
      applySettings();
      return false;
    }
    settings.tiltOffset = input.tilt.calibrate();
  } else {
    input.tilt.stop();
  }
  settings.controlScheme = scheme;
  applySettings();
  return true;
}

// ------------------------------------------------------------------ screens

function showDriving() {
  $('screen-title').hidden = true;
  $('screen-pause').hidden = true;
  $('rotate-note').hidden = true;
  $('hud').hidden = false;
  controlsEl.hidden = false;
  input.touch.enabled = true;
  mode = 'driving';
  audio.resume();
  requestAnimationFrame(() => input.touch.measure());
}

function pause() {
  if (mode !== 'driving') return;
  mode = 'paused';
  input.releaseAll();
  input.touch.enabled = false;
  audio.quiet();
  syncSettingsForm();
  $('screen-pause').hidden = false;
}

function resume() {
  audio.unlock();
  showDriving();
}

function toTitle() {
  mode = 'title';
  input.releaseAll();
  input.touch.enabled = false;
  audio.quiet();
  session.reset();
  $('screen-pause').hidden = true;
  $('hud').hidden = true;
  controlsEl.hidden = true;
  $('screen-title').hidden = false;
  updateRotateNote();
}

function updateRotateNote() {
  $('rotate-note').hidden = !(mode === 'title' && window.innerHeight > window.innerWidth);
}

// Title screen
for (const b of document.querySelectorAll('.scheme')) {
  if (b.dataset.scheme === 'tilt' && !tiltSupported()) b.disabled = true;
  b.addEventListener('click', () => {
    audio.click();
    $('title-hint').textContent = '';
    settings.controlScheme = b.dataset.scheme;
    syncTitle();
  });
}
$('title-auto').addEventListener('change', (e) => {
  settings.autoAccelerate = e.target.checked;
  applySettings();
});
$('btn-drive').addEventListener('click', async () => {
  audio.unlock();
  audio.click();
  const scheme = settings.controlScheme;
  await chooseScheme(scheme, $('title-hint'));
  if (scheme === 'tilt' && settings.controlScheme !== 'tilt') return; // stay to show the hint
  showDriving();
});

// Pause screen
$('btn-pause').addEventListener('click', pause);
input.onPauseKey = () => (mode === 'driving' ? pause() : mode === 'paused' ? resume() : null);
$('btn-resume').addEventListener('click', resume);
$('btn-restart').addEventListener('click', () => {
  session.reset();
  resume();
});
$('btn-menu').addEventListener('click', toTitle);
$('btn-calibrate').addEventListener('click', () => {
  settings.tiltOffset = input.tilt.calibrate();
  applySettings();
  hud.toast('Tilt calibrated');
});
if (!canVibrate) $('row-vibration').hidden = true;

for (const el of document.querySelectorAll('[data-setting]')) {
  const key = el.dataset.setting;
  if (el.classList.contains('segmented')) {
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      audio.click();
      if (key === 'controlScheme') await chooseScheme(b.dataset.value, null);
      else {
        settings[key] = b.dataset.value;
        applySettings();
      }
    });
  } else {
    el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
      settings[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
      applySettings();
    });
  }
}

// --------------------------------------------------------- lifecycle events

function onResize() {
  renderer.resize();
  updateRotateNote();
  requestAnimationFrame(() => input.touch.measure());
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 150));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else if (mode !== 'title') {
    audio.resume();
  }
});
window.addEventListener('blur', pause);
// Block pinch-zoom gestures on iOS Safari, which ignores user-scalable=no.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// --------------------------------------------------------------- game loop

const loop = new GameLoop({
  update(dt) {
    if (mode === 'driving') session.step(dt, input.read());
  },
  render(alpha, frameDt) {
    renderer.render(session, mode === 'driving' ? alpha : 1, frameDt);
    for (const e of session.events) {
      renderer.onEvent(e, session);
      audio.onEvent(e);
      hud.onEvent(e);
      if ((e.type === 'hit' || e.type === 'bump') && settings.vibration && canVibrate) {
        navigator.vibrate(Math.round(20 + Math.min(1, e.strength) * 40));
      }
    }
    session.events.length = 0;
    if (mode === 'driving') {
      audio.update(session.player, car.handling.maxSpeed, input.state.throttle);
      hud.update(session);
    }
    hud.tickFps(frameDt, loop.frameMs, settings.showFps);
  },
});

applySettings();
updateRotateNote();
loop.start();

if (new URLSearchParams(location.search).has('tune')) mountTuningPanel(car.handling);

// Test/debug hook (read-only use by automated tests).
window.__pocketRacers = { session, input, renderer, settings, loop, get mode() { return mode; } };
