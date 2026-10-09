// Pocket Racers — driving prototype bootstrap. Wires simulation, renderer,
// input, audio and the DOM screens together.

import { GameLoop } from './core/loop.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { TRAFFIC_MODELS, TRAFFIC_PAINTS } from './data/cars.js';
import { makeVehicle, nitroColour, VEHICLE_BY_ID } from './data/vehicles.js';
import { Garage } from './core/garage.js';
import { GarageScreen } from './ui/garageScreen.js';
import { TRACK_BY_ID } from './data/tracks/index.js';
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
import { Achievements } from './core/achievements.js';
import { BadgesScreen } from './ui/badgesScreen.js';
import { AutoQuality } from './core/autoQuality.js';
import { SPEED_TO_KMH } from './sim/session.js';
import { kitSlots } from './data/kits.js';
import { EASIER } from './sim/ai.js';
import { Profiles, AVATARS } from './core/profiles.js';
import { ProfilesScreen, MapsScreen, Gate, GrownupScreen } from './ui/homeScreens.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();
// Built maps are cached: switching back is instant.
const builtTracks = {};
const getTrack = (id) => (builtTracks[id] ||= buildTrack3D(TRACK_BY_ID[id]));
let trackId = settings.track;
const track = getTrack(trackId);
// Each child has their own saves; the stores below are re-pointed when the
// player changes.
const profiles = new Profiles();
const garage = new Garage(profiles.storageFor());
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
const progress = new Progress(profiles.storageFor());
const achievements = new Achievements(profiles.storageFor());

let mode = 'title'; // 'title' | 'profiles' | 'maps' | 'garage' | 'events' | 'badges' | 'grownup' | 'driving' | 'paused' | 'results'
const career = new Career(profiles.storageFor());
let FREE_TRAFFIC = session.trafficCount;
let race = null; // active Race (null in free drive)
let raceEvent = null;
let raceAttempt = 0;
let resultsTimer = 0;
audio.setEngine(car.engine);

// ---------------------------------------------------------------- settings

// Graphics: a fixed level, or Auto, which adapts to the device while driving
// and remembers where it settled.
let appliedQuality = null;
let autoQuality = null;
function applyQuality(level) {
  if (appliedQuality === level) return;
  appliedQuality = level;
  renderer.setQuality(level);
}
function syncAutoLabel() {
  const l = autoQuality?.level;
  $('graphics-auto').textContent = l ? `Auto (${l[0].toUpperCase()}${l.slice(1)})` : 'Auto';
}
function applySettings() {
  input.configure(settings);
  session.steerSensitivity = settings.steerSensitivity;
  if (settings.graphics === 'auto') {
    autoQuality ||= new AutoQuality(settings.autoTier);
    applyQuality(autoQuality.level);
  } else {
    autoQuality = null;
    applyQuality(settings.graphics);
  }
  syncAutoLabel();
  renderer.reduceEffects = settings.reduceEffects;
  audio.setVolume(settings.volume);
  controlsEl.dataset.scheme = settings.controlScheme;
  controlsEl.dataset.auto = String(settings.autoAccelerate);
  controlsEl.dataset.swap = String(settings.swapSides);
  document.documentElement.style.setProperty('--size', { s: 0.82, m: 1, l: 1.18 }[settings.buttonSize]);
  $('fps').hidden = !settings.showFps;
  $('screen-grownup').querySelector('.panel').dataset.scheme = settings.controlScheme;
  if (!settings.triedSchemes.includes(settings.controlScheme)) settings.triedSchemes.push(settings.controlScheme);
  syncSettingsForm();
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
  achievements.visitMap(trackId);
  autoQuality?.reset();
  audio.resume();
  requestAnimationFrame(() => input.touch.measure());
}

function pause() {
  if (mode !== 'driving') return;
  mode = 'paused';
  progress.save();
  achievements.save();
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
  resultsScreen.close();
  $('screen-badges').hidden = true;
  $('screen-maps').hidden = true;
  $('screen-grownup').hidden = true;
  $('screen-profiles').hidden = true;
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
  achievements.save();
  if (updateReady) location.reload();
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
  const nc = nitroColour(car.paint).map((v) => Math.round(v * 255));
  controlsEl.style.setProperty('--nitro', `rgb(${nc.join(',')})`);
}

const garageScreen = new GarageScreen({
  garage,
  progress,
  click: () => audio.click(),
  sound: (k) => audio.ui(k),
  onPreview: (id) => renderer.setVehicle(makeVehicle(id, garage.custom(id), garage.upgrades(id))),
  onUnlock: () => hud.toast('Unlocked!'),
  onDrive: (id) => {
    garageScreen.close();
    useVehicle(id);
    toTitle();
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
    difficulty: profiles.littleDriver() ? EASIER[e.difficulty] : e.difficulty,
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
  // Badges earned now show as chips in the results panel.
  badgesScreen.inline = $('results-badges');
  badgesScreen.inline.textContent = '';
  const r = race.results;
  const e = raceEvent;
  const stars = starsFor(e, { ...r, car });
  const rec = career.record(e.id, stars, r.eliminated ? null : r.time);
  const pay = rewards(e);
  const points = stars ? (rec.newStars ? pay[3 - stars] : Math.round((pay[3 - stars] * 0.25) / 50) * 50) : 100;
  progress.add(points);
  progress.save();
  if (!r.eliminated) {
    achievements.add('races');
    if (r.place === 1 && r.total > 1) achievements.add('wins');
    if (car.family === 'monster') achievements.add('monsterRaces');
    if (car.family === 'truck') achievements.add('truckRaces');
  }
  achievements.max('raceStars', career.totalStars);
  const upNext = nextEvent();
  const next = upNext === e ? null : upNext;
  mode = 'results';
  input.releaseAll();
  input.touch.enabled = false;
  audio.quiet();
  $('hud').hidden = true;
  controlsEl.hidden = true;
  resultsScreen.show(r, { event: e, stars, points, next, avatar: AVATARS[profiles.current]?.icon, medals: e.mode === 'timetrial' ? medalTimes(e, car) : null });
}

/**
 * The race ▶ Play starts: the first unlocked race without stars, otherwise
 * the unlocked race with the fewest stars.
 */
function nextEvent() {
  // Little Drivers skip knockout races (still in the grown-ups' race list).
  const kind = (e) => !profiles.littleDriver() || e.mode !== 'elimination';
  const open = EVENTS.filter((e) => career.unlocked(e) && kind(e));
  return open.find((e) => !career.stars(e.id)) || open.reduce((a, b) => (career.stars(b.id) < career.stars(a.id) ? b : a));
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
  sound: (k) => audio.ui(k),
  onPick: (e) => startEvent(e),
  onBack: () => {
    audio.ui('back');
    eventsScreen.close();
    toTitle();
  },
});

const resultsScreen = new ResultsScreen({
  click: () => audio.click(),
  onRetry: () => startEvent(raceEvent),
  onNext: () => startEvent(nextEvent()),
  onEvents: toTitle,
});
resultsScreen.onClose = () => (badgesScreen.inline = null);

function openGarage() {
  audio.unlock();
  mode = 'garage';
  $('screen-title').hidden = true;
  garageScreen.open();
}

function updateBank() {
  $('title-bank').textContent = `★ ${progress.points.toLocaleString()}`;
  $('title-badges').textContent = String(achievements.count);
  const a = AVATARS[profiles.current];
  $('home-avatar').textContent = a ? a.icon : '🙂';
  $('home-avatar').style.setProperty('--c', a ? a.color : '#9aa3c7');
}

// ------------------------------------------------------------------ badges

const badgesScreen = new BadgesScreen({
  achievements,
  click: () => audio.click(),
  onBack: () => {
    audio.ui('back');
    badgesScreen.close();
    toTitle();
  },
});
achievements.onEarn = (a) => {
  progress.add(a.reward);
  progress.save();
  badgesScreen.pop(a);
  audio.onEvent({ type: 'superReady' });
  if (mode === 'garage') garageScreen.render?.();
};

/** Garage-derived badge stats (cars owned, upgrades, style). */
function syncGarageStats() {
  const g = garage.state;
  achievements.max('owned', g.owned.length);
  let bought = 0;
  let top = 0;
  for (const u of Object.values(g.upgrades)) for (const lv of Object.values(u)) (bought += lv), (top = Math.max(top, lv));
  achievements.max('upgrades', bought);
  achievements.max('maxUpgrade', top);
  const styled = Object.entries(g.custom).some(([id, c]) => (c.neon && c.neon !== 'none') || (c.topper && c.topper !== 'none') || kitSlots(VEHICLE_BY_ID[id]).some((s) => c[s] && c[s] !== 'stock' && c[s] !== 'none'));
  if (styled) achievements.max('styled', 1);
}
garage.onChange = syncGarageStats;

/** Badge stats from gameplay events. */
function trackEvent(e) {
  if (e.type === 'super') achievements.add('supers');
  if (e.type === 'animal' && e.first) achievements.findAnimal(e.id);
  if (e.type !== 'score') return;
  const A = achievements;
  switch (e.kind) {
    case 'trick':
      A.add('tricks');
      if (e.spins) A.add('spins');
      if (e.barrel) A.add('barrels');
      if (e.spins && e.barrel) A.add('corkscrews');
    // falls through: a trick is a jump too
    case 'jump':
      A.add('jumps');
      A.max('bestAir', e.airTime);
      break;
    case 'drift':
      A.add('driftTime', e.seconds);
      break;
    case 'knock':
      A.add('knocks');
      break;
    case 'nearMiss':
      A.add('nearMisses');
      break;
    case 'smash':
      A.add('smashes');
      break;
    case 'star':
      A.add('starsPicked');
      break;
  }
}

// ------------------------------------------------- players, maps, grown-ups

const gate = new Gate({ sound: (k) => audio.ui(k) });

/** Point every per-player save at the current profile and reload it. */
function rebindPlayer() {
  for (const store of [garage, career, progress, achievements]) {
    store.storage = profiles.storageFor();
    store.load();
  }
  useVehicle(garage.selected);
  syncGarageStats();
  updateBank();
  session.assist = profiles.littleDriver();
  session.fun.known = new Set(achievements.state.animals);
}

function usePlayer(id) {
  progress.save();
  achievements.save();
  profiles.select(id);
  rebindPlayer();
  toTitle();
}

const profilesScreen = new ProfilesScreen({
  profiles,
  sound: (k) => audio.ui(k),
  onPick: usePlayer,
  onAdd: (id) => {
    if (id) {
      progress.save();
      achievements.save();
      profiles.add(id);
      usePlayer(id);
    } else gate.ask((ok) => ok && profilesScreen.open('new'));
  },
});

function openProfiles(m = 'pick') {
  mode = 'profiles';
  $('screen-title').hidden = true;
  profilesScreen.open(m);
}

const mapsScreen = new MapsScreen({
  sound: (k) => audio.ui(k),
  current: () => settings.track,
  onBack: toTitle,
  onPick: async (id) => {
    // Ask for tilt permission first, while still inside the tap.
    const scheme = settings.controlScheme;
    const tilt = chooseScheme(scheme, null);
    settings.track = id;
    saveSettings(settings);
    mapsScreen.close();
    loadTrack(id);
    await tilt;
    showDriving();
  },
});

function openMaps() {
  mode = 'maps';
  $('screen-title').hidden = true;
  mapsScreen.open();
}

const grownupScreen = new GrownupScreen({
  profiles,
  sound: (k) => audio.ui(k),
  onLittleDriver: (id, on) => {
    profiles.setLittleDriver(id, on);
    session.assist = profiles.littleDriver();
  },
  onRemove: (id) => {
    const wasCurrent = id === profiles.current;
    profiles.remove(id);
    if (wasCurrent) rebindPlayer();
  },
  onAdd: () => {
    grownupScreen.close();
    openProfiles('new');
  },
  onRaces: () => {
    grownupScreen.close();
    openEvents();
  },
  onDone: () => {
    grownupScreen.close();
    if (!profiles.list.length) openProfiles('new');
    else toTitle();
  },
});

function openGrownup() {
  mode = 'grownup';
  $('screen-title').hidden = true;
  syncSettingsForm();
  grownupScreen.open();
}

function openBadges() {
  audio.unlock();
  mode = 'badges';
  $('screen-title').hidden = true;
  badgesScreen.open();
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

// Home screen
$('btn-garage').addEventListener('click', () => {
  audio.ui('open');
  openGarage();
});
$('btn-badges').addEventListener('click', () => {
  audio.ui('open');
  openBadges();
});
// ▶ Play goes straight into the next race: no list to read.
$('btn-races').addEventListener('click', () => {
  audio.click();
  lockLandscape();
  startEvent(nextEvent());
});
$('btn-drive').addEventListener('click', () => {
  audio.unlock();
  audio.ui('open');
  lockLandscape();
  openMaps();
});
$('btn-profile').addEventListener('click', () => {
  audio.ui('open');
  openProfiles();
});
$('btn-grownup').addEventListener('click', () => {
  audio.unlock();
  audio.click();
  gate.ask((ok) => ok && openGrownup());
});

// Pause screen
$('btn-pause').addEventListener('click', pause);

function honk() {
  if (mode !== 'driving' || !session.honk()) return;
  audio.honk(car.family);
  const b = $('btn-honk');
  b.classList.remove('honking');
  void b.offsetWidth; // restart the wiggle
  b.classList.add('honking');
}
$('btn-honk').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  honk();
});
input.onHonkKey = honk;
renderer.onFirework = () => audio.pop();
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

let km = 0; // distance not yet added to the badge stat
const loop = new GameLoop({
  update(dt) {
    if (mode !== 'driving') return;
    if (race) race.step(dt, input.read());
    else session.step(dt, input.read());
    km += (Math.abs(session.player.speed) * SPEED_TO_KMH * dt) / 3600;
    if (km >= 0.1) {
      achievements.add('km', km);
      km = 0;
    }
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
      if (e.type === 'rescue') audio.ui('open');
      trackEvent(e);
      if (e.type === 'finish' || e.type === 'eliminated') resultsTimer = setTimeout(showResults, 1800);
    }
    session.events.length = 0;
    if (mode === 'driving') {
      audio.update(session.player, car.handling.maxSpeed, input.state.throttle, frameDt);
      hud.update(session);
      const level = autoQuality?.frame(frameDt * 1000);
      if (level) {
        applyQuality(level);
        settings.autoTier = level;
        saveSettings(settings);
        syncAutoLabel();
      }
    }
    hud.tickFps(frameDt, loop.frameMs, settings.showFps);
  },
});

applySettings();
syncGarageStats();
controlsEl.style.setProperty('--nitro', `rgb(${nitroColour(car.paint).map((v) => Math.round(v * 255)).join(',')})`);
session.assist = profiles.littleDriver();
session.fun.known = new Set(achievements.state.animals);
$('title-car').textContent = car.name;
updateBank();
enforceLandscape();
// Shared device: ask who is playing (or let the first player pick an animal).
if (profiles.list.length !== 1) openProfiles(profiles.list.length ? 'pick' : 'new');
loop.start();
window.addEventListener('pagehide', () => {
  progress.save();
  achievements.save();
});

// Offline play: the service worker caches the whole game. Skipped on the
// local dev server (add ?sw to test it there). When an update has been
// installed, it is picked up on the next visit to the title screen.
let updateReady = false;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing changed
    updateReady = true;
    if (mode === 'title') location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

if (new URLSearchParams(location.search).has('tune')) mountTuningPanel(car.handling);

// Test/debug hook (read-only use by automated tests).
window.__pocketRacers = { session, input, renderer, settings, loop, garage, garageScreen, progress, career, achievements, profiles, gate, startEvent, nextEvent, loadTrack, get trackId() { return trackId; }, get race() { return race; }, get car() { return car; }, get mode() { return mode; } };
