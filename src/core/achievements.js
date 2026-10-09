// Badge progress: lifetime stats plus the badges already earned. Versioned
// and validated on load like the other saves. Stats only ever go up.

import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, ACHIEVEMENT_STATS } from '../data/achievements.js';

const KEY = 'pocketracers.achievements';
const VERSION = 1;

export function sanitizeAchievements(raw) {
  const a = { v: VERSION, stats: {}, maps: [], earned: [] };
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return a;
  if (raw.stats && typeof raw.stats === 'object') {
    for (const k of ACHIEVEMENT_STATS) if (Number.isFinite(raw.stats[k]) && raw.stats[k] > 0) a.stats[k] = raw.stats[k];
  }
  if (Array.isArray(raw.maps)) a.maps = raw.maps.filter((m) => typeof m === 'string' && m.length < 40).slice(0, 20);
  if (Array.isArray(raw.earned)) a.earned = raw.earned.filter((id, i, l) => ACHIEVEMENT_BY_ID[id] && l.indexOf(id) === i);
  return a;
}

export class Achievements {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let raw = null;
    try {
      raw = JSON.parse(storage?.getItem(KEY) || 'null');
    } catch {
      /* unreadable: start fresh */
    }
    this.state = sanitizeAchievements(raw);
    this.dirty = false;
    /** Called with each newly earned badge. */
    this.onEarn = null;
  }

  stat(k) {
    return this.state.stats[k] || 0;
  }

  earned(id) {
    return this.state.earned.includes(id);
  }

  get count() {
    return this.state.earned.length;
  }

  /** Progress toward a badge, 0..1. */
  progress(a) {
    return Math.min(1, this.stat(a.stat) / a.goal);
  }

  add(k, n = 1) {
    if (!(n > 0)) return;
    this.state.stats[k] = this.stat(k) + n;
    this.dirty = true;
    this.check(k);
  }

  /** Raise a stat to `v` if that is higher (best air, stars, cars owned). */
  max(k, v) {
    if (!(v > this.stat(k))) return;
    this.state.stats[k] = v;
    this.dirty = true;
    this.check(k);
  }

  visitMap(id) {
    if (this.state.maps.includes(id)) return;
    this.state.maps.push(id);
    this.max('maps', this.state.maps.length);
  }

  /** Earn every badge on stat `k` whose goal is now met. Returns them. */
  check(k) {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (a.stat !== k || this.earned(a.id) || this.stat(k) < a.goal) continue;
      this.state.earned.push(a.id);
      got.push(a);
      this.dirty = true;
      this.onEarn?.(a);
    }
    if (got.length) this.save();
    return got;
  }

  save() {
    if (!this.dirty) return;
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
      this.dirty = false;
    } catch {
      /* full or blocked: keep in memory */
    }
  }
}
