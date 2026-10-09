// Player settings. Prototype persistence uses localStorage; the versioned
// IndexedDB save system replaces this in the persistence phase.

import { TRACKS, DEFAULT_TRACK } from '../data/tracks/index.js';

const KEY = 'pocketracers.settings';
const VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  controlScheme: 'buttons', // 'buttons' | 'wheel' | 'tilt'
  steerSensitivity: 1, // 0.5 – 1.5
  tiltOffset: 0, // degrees, set by calibration
  autoAccelerate: true,
  buttonSize: 'm', // 's' | 'm' | 'l'
  swapSides: false,
  vibration: true,
  volume: 0.7, // 0 – 1, 0 = muted
  graphics: 'auto', // 'auto' | 'low' | 'medium' | 'high'
  autoTier: 'high', // where Auto settled last time
  reduceEffects: false,
  showFps: false,
  triedSchemes: [],
  track: DEFAULT_TRACK, // free-drive map
});

const VALID = {
  controlScheme: ['buttons', 'wheel', 'tilt'],
  buttonSize: ['s', 'm', 'l'],
  graphics: ['auto', 'low', 'medium', 'high'],
  autoTier: ['low', 'medium', 'high'],
  track: TRACKS.map((t) => t.id),
};

function sanitize(raw) {
  const s = { ...DEFAULT_SETTINGS, triedSchemes: [] };
  if (!raw || typeof raw !== 'object') return s;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const def = DEFAULT_SETTINGS[key];
    const v = raw[key];
    if (v === undefined || typeof v !== typeof def) continue;
    if (VALID[key] && !VALID[key].includes(v)) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    s[key] = Array.isArray(def) ? (Array.isArray(v) ? v.filter((x) => VALID.controlScheme.includes(x)) : []) : v;
  }
  s.steerSensitivity = Math.min(1.5, Math.max(0.5, s.steerSensitivity));
  s.volume = Math.min(1, Math.max(0, s.volume));
  s.tiltOffset = Math.min(60, Math.max(-60, s.tiltOffset));
  return s;
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return sanitize(raw && raw.v === VERSION ? raw.data : null);
  } catch {
    return sanitize(null);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: settings }));
    return true;
  } catch {
    return false; // storage full / disabled: keep playing with in-memory settings
  }
}
