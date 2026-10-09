// Pocket Racers — driving prototype bootstrap. Wires simulation, renderer,
// input, audio and the DOM screens together.

import { GameLoop } from './core/loop.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { TRAFFIC_MODELS, TRAFFIC_PAINTS } from './data/cars.js';
import { makeVehicle, VEHICLE_BY_ID } from './data/vehicles.js';
import { Garage } from './core/garage.js';
import { GarageScreen } from './ui/garageScreen.js';
import { TRACKS, TRACK_BY_ID, TRACK_MOOD } from './data/tracks/index.js';
import { buildTrack3D } from './world/track3d.js';
import { DrivingSession } from './sim/session.js';
import { Renderer3D } from './render3d/renderer3d.js';
import { InputManager } from './input/inputManager.js';
import { tiltSupported } from './input/tilt.js';
import { GameAudio } from './audio/audio.js';
import { Hud } from './ui/hud.js';
import { mountTuningPanel } from './ui/tuning.js';
import { Progress } from './core/progress.js';
import { Race } from './sim/race.js';
import { EVENTS, pickOpponents, vehicleFor, starsFor, rewards, medalTimes } from './data/events.js';
import { Career } from './core/career.js';
import { EventsScreen, ResultsScreen } from './ui/raceScreens.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();
// Built maps are cached: switching back is instant.
const builtTracks = {};
const getTrack = (id) => (builtTracks[id] ||= buildTrack3D(TRACK_BY_ID[id]));
let trackId = settings.track;
const track = getTrack(trackId);
const garage = new Garage();
let car = makeVehicle(garage.selected, garage.custom(garage.selected), garage.upgrades(garage.selected));
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
const progress = new Progress();

let mode = 'title'; // 'title' | 'garage' | 'events' | 'driving' | 'paused' | 'results'
const career = new Career();
let FREE_TRAFFIC = session.trafficCount;
let race = null; // active Race (null in free drive)
let raceEvent = null;
let raceAttempt = 0;
let resultsTimer = 0;
audio.setEngine(car.engine);

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
  progress.save();
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

/** Switch the world to another map (no-op if already there). */
function loadTrack(id) {
  if (id === trackId) return;
  trackId = id;
  const T = getTrack(id);
  session.setTrack(T);
  renderer.setTrack(T);
  renderer.setRacers([]);
  FREE_TRAFFIC = session.trafficCount;
}

function syncMapPicker() {
  const def = TRACK_BY_ID[settings.track];
  $('map-name').textContent = def.name;
  $('map-mood').textContent = TRACK_MOOD[def.id] || '';
}

function stepMap(dir) {
  audio.click();
  const i = TRACKS.findIndex((t) => t.id === settings.track);
  settings.track = TRACKS[(i + dir + TRACKS.length) % TRACKS.length].id;
  saveSettings(settings);
  syncMapPicker();
  loadTrack(settings.track);
}

/** Leave race mode: back to free drive with the player's own vehicle. */
function endRace() {
  clearTimeout(resultsTimer);
  if (!race) return;
  race = null;
  raceEvent = null;
  hud.setRace(null);
  session.trafficCount = FREE_TRAFFIC;
  renderer.setRacers([]);
  if (car.id !== garage.selected) useVehicle(garage.selected);
  else session.reset();
  loadTrack(settings.track);
}

function toTitle() {
  endRace();
  $('screen-events').hidden = true;
  $('screen-results').hidden = true;
  mode = 'title';
  input.releaseAll();
  input.touch.enabled = false;
  audio.quiet();
  session.reset();
  $('screen-pause').hidden = true;
  $('hud').hidden = true;
  controlsEl.hidden = true;
  $('screen-title').hidden = false;
  progress.save();
  updateBank();
  enforceLandscape();
}

/** Make `id` the player's vehicle (session, renderer, engine sound). */
function useVehicle(id) {
  car = makeVehicle(id, garage.custom(id), garage.upgrades(id));
  session.setCar(car);
  renderer.setVehicle(car);
  audio.setEngine(car.engine);
  $('title-car').textContent = car.name;
}

const garageScreen = new GarageScreen({
  garage,
  progress,
  click: () => audio.click(),
  onPreview: (id) => renderer.setVehicle(makeVehicle(id, garage.custom(id), garage.upgrades(id))),
  onUnlock: () => hud.toast('Unlocked!'),
  onDrive: (id) => {
    garageScreen.close();
    useVehicle(id);
    toTitle();
    $('btn-drive').click(); // same path as the title's Drive button (tilt permission etc.)
  },
  onBack: () => {
    garageScreen.close();
    useVehicle(garage.selected);
    toTitle();
  },
});

// ------------------------------------------------------------------ races

async function startEvent(e) {
  audio.unlock();
  clearTimeout(resultsTimer);
  eventsScreen.close();
  resultsScreen.close();
  $('screen-title').hidden = true;
  $('screen-pause').hidden = true;
  loadTrack(e.track);
  const v = vehicleFor(e, garage);
  car = makeVehicle(v.id, garage.custom(v.id), garage.upgrades(v.id));
  session.setCar(car, false);
  renderer.setVehicle(car);
  audio.setEngine(car.engine);
  session.trafficCount = 0;
  raceEvent = e;
  raceAttempt++;
  race = new Race(session, {
    mode: e.mode,
    laps: e.laps,
    difficulty: e.difficulty,
    opponents: pickOpponents(e, car, 5, raceAttempt),
    gridSlot: 3,
  });
  renderer.setRacers(session.racers);
  hud.setRace(race);
  if (settings.controlScheme === 'tilt') await chooseScheme('tilt', null);
  showDriving();
  if (v.loaner) hud.toast(`Loaner car: ${car.name}`, 2200);
}

function showResults() {
  const r = race.results;
  const e = raceEvent;
  const stars = starsFor(e, { ...r, car });
  const rec = career.record(e.id, stars, r.eliminated ? null : r.time);
  const pay = rewards(e);
  const points = stars ? (rec.newStars ? pay[3 - stars] : Math.round((pay[3 - stars] * 0.25) / 50) * 50) : 100;
  progress.add(points);
  progress.save();
  const i = EVENTS.indexOf(e);
  const next = EVENTS.slice(i + 1).find((x) => career.unlocked(x)) || null;
  mode = 'results';
  input.releaseAll();
  input.touch.enabled = false;
  audio.quiet();
  $('hud').hidden = true;
  controlsEl.hidden = true;
  resultsScreen.show(r, { event: e, stars, points, next, medals: e.mode === 'timetrial' ? medalTimes(e, car) : null });
}

function openEvents() {
  audio.unlock();
  endRace();
  mode = 'events';
  resultsScreen.close();
  $('screen-title').hidden = true;
  $('hud').hidden = true;
  controlsEl.hidden = true;
  eventsScreen.open();
}

const eventsScreen = new EventsScreen({
  career,
  garage,
  click: () => audio.click(),
  onPick: (e) => startEvent(e),
  onBack: () => {
    eventsScreen.close();
    toTitle();
  },
});

const resultsScreen = new ResultsScreen({
  click: () => audio.click(),
  onRetry: () => startEvent(raceEvent),
  onNext: () => {
    const i = EVENTS.indexOf(raceEvent);
    const next = EVENTS.slice(i + 1).find((x) => career.unlocked(x));
    if (next) startEvent(next);
  },
  onEvents: openEvents,
});

function openGarage() {
  audio.unlock();
  mode = 'garage';
  $('screen-title').hidden = true;
  garageScreen.open();
}

function updateBank() {
  const pts = progress.points;
  $('title-bank').textContent = pts ? `★ ${pts.toLocaleString()} points earned` : '';
}

// Phones/tablets play landscape only: portrait shows a full-screen prompt
// (CSS) and pauses the race.
const portraitBlocked = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
function enforceLandscape() {
  if (portraitBlocked.matches && mode === 'driving') pause();
}

/**
 * On Android the orientation can only be locked in fullscreen, which needs a
 * user gesture: done on the first Drive/Race tap. iOS ignores this and relies
 * on the rotate prompt; the installed app is landscape via the manifest.
 */
function lockLandscape() {
  if (!window.matchMedia('(pointer: coarse)').matches || !screen.orientation?.lock) return;
  if (window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) return;
  const el = document.documentElement;
  const enter = document.fullscreenElement || !el.requestFullscreen ? Promise.resolve() : el.requestFullscreen({ navigationUI: 'hide' });
  enter.then(() => screen.orientation.lock('landscape')).catch(() => {});
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
$('btn-garage').addEventListener('click', () => {
  audio.click();
  openGarage();
});
$('map-prev').addEventListener('click', () => stepMap(-1));
$('map-next').addEventListener('click', () => stepMap(1));
$('btn-races').addEventListener('click', () => {
  audio.click();
  lockLandscape();
  openEvents();
});
$('btn-drive').addEventListener('click', async () => {
  audio.unlock();
  audio.click();
  lockLandscape();
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
  if (race) {
    startEvent(raceEvent);
    return;
  }
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
  enforceLandscape();
  requestAnimationFrame(() => input.touch.measure());
}
window.addEventListener('resize', onResize);
portraitBlocked.addEventListener?.('change', enforceLandscape);
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
    if (mode !== 'driving') return;
    if (race) race.step(dt, input.read());
    else session.step(dt, input.read());
  },
  render(alpha, frameDt) {
    if (mode === 'garage') {
      garageScreen.tick(frameDt);
      renderer.renderGarage(frameDt, garageScreen.yaw, garageScreen.view());
      session.events.length = 0;
      hud.tickFps(frameDt, loop.frameMs, settings.showFps);
      return;
    }
    renderer.render(session, mode === 'driving' ? alpha : 1, frameDt);
    for (const e of session.events) {
      renderer.onEvent(e, session);
      audio.onEvent(e);
      hud.onEvent(e);
      if (settings.vibration && canVibrate) {
        if (e.type === 'hit' || e.type === 'bump' || e.type === 'land') navigator.vibrate(Math.round(20 + Math.min(1, e.strength) * 40));
        else if (e.type === 'score' && e.kind === 'smash') navigator.vibrate(15);
      }
      if (e.type === 'score') progress.add(e.points);
      if (e.type === 'finish' || e.type === 'eliminated') resultsTimer = setTimeout(showResults, 1800);
    }
    session.events.length = 0;
    if (mode === 'driving') {
      audio.update(session.player, car.handling.maxSpeed, input.state.throttle, frameDt);
      hud.update(session);
    }
    hud.tickFps(frameDt, loop.frameMs, settings.showFps);
  },
});

applySettings();
$('title-car').textContent = car.name;
syncMapPicker();
updateBank();
enforceLandscape();
loop.start();
window.addEventListener('pagehide', () => progress.save());

if (new URLSearchParams(location.search).has('tune')) mountTuningPanel(car.handling);

// Test/debug hook (read-only use by automated tests).
window.__pocketRacers = { session, input, renderer, settings, loop, garage, garageScreen, progress, career, startEvent, loadTrack, get trackId() { return trackId; }, get race() { return race; }, get car() { return car; }, get mode() { return mode; } };
