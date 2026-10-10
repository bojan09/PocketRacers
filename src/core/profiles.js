// Player profiles: siblings share one device, so each child picks an animal
// and gets their own cars, points, race stars and badges. Device settings
// (graphics, volume, controls) stay shared. A profile's id is its animal, so
// avatars are unique and no names or typing are needed.

export const AVATARS = {
  fox: { icon: '🦊', color: '#ff8c42' },
  panda: { icon: '🐼', color: '#7b5cff' },
  tiger: { icon: '🐯', color: '#ffb703' },
  unicorn: { icon: '🦄', color: '#ff2e88' },
  frog: { icon: '🐸', color: '#5cb82e' },
  dog: { icon: '🐶', color: '#4cc9f0' },
  penguin: { icon: '🐧', color: '#3a86ff' },
  lion: { icon: '🦁', color: '#e76f51' },
};
export const MAX_PROFILES = 4;

const KEY = 'pocketracers.profiles';
const VERSION = 1;
/** Save keys that belong to a player (everything except device settings). */
export const PLAYER_KEYS = ['pocketracers.garage', 'pocketracers.career', 'pocketracers.progress', 'pocketracers.achievements', 'pocketracers.explore'];

/** A storage view where every key is suffixed with the profile id. */
export function scopedStorage(base, id) {
  const k = (key) => `${key}@${id}`;
  return {
    getItem: (key) => base?.getItem(k(key)) ?? null,
    setItem: (key, v) => base?.setItem(k(key), v),
    removeItem: (key) => base?.removeItem?.(k(key)),
  };
}

export function sanitizeProfiles(raw) {
  const p = { v: VERSION, list: [], current: null, pro: [] };
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION || !Array.isArray(raw.list)) return p;
  for (const id of raw.list) if (AVATARS[id] && !p.list.includes(id) && p.list.length < MAX_PROFILES) p.list.push(id);
  p.current = p.list.includes(raw.current) ? raw.current : p.list[0] || null;
  // Players with Little Driver switched off (it is on by default).
  if (Array.isArray(raw.pro)) p.pro = p.list.filter((id) => raw.pro.includes(id));
  return p;
}

export class Profiles {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let raw;
    try {
      raw = JSON.parse(storage?.getItem(KEY) || 'null');
    } catch {
      raw = null;
    }
    this.state = sanitizeProfiles(raw);
    if (!raw) this.migrate();
  }

  /**
   * First run after profiles were added: progress made before then becomes
   * the first player's (🦊). Other children are added with "+" and start
   * fresh.
   */
  migrate() {
    let legacy = [];
    try {
      legacy = PLAYER_KEYS.map((k) => [k, this.storage?.getItem(k)]).filter(([, v]) => v != null);
    } catch {
      /* storage blocked */
    }
    if (!legacy.length) return;
    const s = scopedStorage(this.storage, 'fox');
    try {
      for (const [k, v] of legacy) s.setItem(k, v);
    } catch {
      /* full: the player starts fresh */
    }
    this.state.list.push('fox');
    this.state.current = 'fox';
    this.save();
  }

  get list() {
    return this.state.list;
  }

  get current() {
    return this.state.current;
  }

  /** Storage for the current player (in-memory nothing if there is none). */
  storageFor(id = this.current) {
    return id ? scopedStorage(this.storage, id) : null;
  }

  /** Little Driver: driving help for young children, on unless turned off. */
  littleDriver(id = this.current) {
    return !this.state.pro.includes(id);
  }

  setLittleDriver(id, on) {
    if (!this.list.includes(id)) return;
    this.state.pro = this.state.pro.filter((x) => x !== id);
    if (!on) this.state.pro.push(id);
    this.save();
  }

  available() {
    return Object.keys(AVATARS).filter((id) => !this.list.includes(id));
  }

  add(id) {
    if (!AVATARS[id] || this.list.includes(id) || this.list.length >= MAX_PROFILES) return false;
    // A re-used animal always starts fresh.
    const s = scopedStorage(this.storage, id);
    for (const k of PLAYER_KEYS) s.removeItem(k);
    this.state.list.push(id);
    this.state.current = id;
    this.save();
    return true;
  }

  select(id) {
    if (!this.list.includes(id)) return false;
    this.state.current = id;
    this.save();
    return true;
  }

  /** Delete a player and all their progress. */
  remove(id) {
    if (!this.list.includes(id)) return false;
    const s = scopedStorage(this.storage, id);
    for (const k of PLAYER_KEYS) s.removeItem(k);
    this.state.list = this.list.filter((x) => x !== id);
    this.state.pro = this.state.pro.filter((x) => x !== id);
    if (this.state.current === id) this.state.current = this.list[0] || null;
    this.save();
    return true;
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* full or blocked: keep in memory */
    }
  }
}
