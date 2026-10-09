// Career save: best stars and time per event. Versioned and validated on
// load, like the garage.

import { EVENTS, EVENT_BY_ID } from '../data/events.js';

const KEY = 'pocketracers.career';
const VERSION = 1;

export function sanitizeCareer(raw) {
  const c = { v: VERSION, events: {} };
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION || !raw.events || typeof raw.events !== 'object') return c;
  for (const [id, r] of Object.entries(raw.events)) {
    if (!EVENT_BY_ID[id] || !r || typeof r !== 'object') continue;
    const stars = Number.isInteger(r.stars) ? Math.max(0, Math.min(3, r.stars)) : 0;
    const best = Number.isFinite(r.best) && r.best > 0 ? r.best : null;
    c.events[id] = { stars, best };
  }
  return c;
}

export class Career {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let raw = null;
    try {
      raw = JSON.parse(storage?.getItem(KEY) || 'null');
    } catch {
      /* unreadable: start fresh */
    }
    this.state = sanitizeCareer(raw);
  }

  stars(id) {
    return this.state.events[id]?.stars || 0;
  }

  best(id) {
    return this.state.events[id]?.best || null;
  }

  get totalStars() {
    return EVENTS.reduce((n, e) => n + this.stars(e.id), 0);
  }

  unlocked(event) {
    return this.totalStars >= event.need;
  }

  /**
   * Record a result. Returns {newStars, improved}: newStars are the extra
   * stars beyond the previous best (points are paid only for those).
   */
  record(id, stars, time) {
    const prev = this.state.events[id] || { stars: 0, best: null };
    const next = { stars: Math.max(prev.stars, stars), best: prev.best && time ? Math.min(prev.best, time) : time || prev.best };
    this.state.events[id] = next;
    this.save();
    return { newStars: next.stars - prev.stars, improved: !prev.best || (time && time < prev.best) };
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* full or blocked: keep in memory */
    }
  }
}
