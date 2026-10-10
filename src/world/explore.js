// The island map fills in as you drive: the land is split into a grid of
// cells, and every cell near the car is uncovered. Saved per player; the
// share of land uncovered earns badges.

import { WATER } from './openWorld.js';

const KEY = 'pocketracers.explore';
const VERSION = 1;
/** Grid cells across the map, and the map's size in metres (centred on 0). */
export const EXPLORE_GRID = 64;
export const EXPLORE_SPAN = 4096;
export const EXPLORE_CELL = EXPLORE_SPAN / EXPLORE_GRID;
/** Everything within this many metres of the car is uncovered. */
export const EXPLORE_REACH = 110;

const BYTES = (EXPLORE_GRID * EXPLORE_GRID) / 8;

function toBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(str) {
  try {
    const s = atob(str);
    if (s.length !== BYTES) return null;
    const out = new Uint8Array(BYTES);
    for (let i = 0; i < BYTES; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export class ExploreMap {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.land = null; // Uint8Array: 1 where a cell is mostly land
    this.landCount = 0;
    this.load();
  }

  /** (Re)read the save (after switching player). */
  load() {
    let raw = null;
    try {
      raw = JSON.parse(this.storage?.getItem(KEY) || 'null');
    } catch {
      /* unreadable: start fresh */
    }
    const ok = raw && raw.v === VERSION;
    this.bits = (ok && typeof raw.island === 'string' && fromBase64(raw.island)) || new Uint8Array(BYTES);
    // Best stars (1-3) per flag race.
    this.races = {};
    if (ok && raw.races && typeof raw.races === 'object')
      for (const [id, st] of Object.entries(raw.races)) if (Number.isInteger(st) && st >= 1 && st <= 3) this.races[id] = st;
    this.dirty = false;
    this.count = this.land ? this.countLand() : 0;
  }

  save() {
    if (!this.dirty) return;
    try {
      this.storage?.setItem(KEY, JSON.stringify({ v: VERSION, island: toBase64(this.bits), races: this.races }));
      this.dirty = false;
    } catch {
      /* full or blocked: keep in memory */
    }
  }

  /** Learn which cells are land (once per world). */
  setWorld(world) {
    this.land = new Uint8Array(EXPLORE_GRID * EXPLORE_GRID);
    this.landCount = 0;
    for (let j = 0; j < EXPLORE_GRID; j++)
      for (let i = 0; i < EXPLORE_GRID; i++) {
        // A cell counts as land if most of a 3x3 sample of it is dry.
        let dry = 0;
        for (const a of [0.2, 0.5, 0.8])
          for (const b of [0.2, 0.5, 0.8]) if (world.baseHeight(this.x(i + a), this.x(j + b)) > WATER) dry++;
        if (dry >= 5) {
          this.land[j * EXPLORE_GRID + i] = 1;
          this.landCount++;
        }
      }
    this.count = this.countLand();
  }

  /** World coordinate of grid position `i` (may be fractional). */
  x(i) {
    return i * EXPLORE_CELL - EXPLORE_SPAN / 2;
  }

  /** Grid index of world coordinate `x`. */
  cell(x) {
    return Math.floor((x + EXPLORE_SPAN / 2) / EXPLORE_CELL);
  }

  seen(i, j) {
    if (i < 0 || j < 0 || i >= EXPLORE_GRID || j >= EXPLORE_GRID) return false;
    const k = j * EXPLORE_GRID + i;
    return (this.bits[k >> 3] & (1 << (k & 7))) !== 0;
  }

  countLand() {
    let n = 0;
    for (let k = 0; k < EXPLORE_GRID * EXPLORE_GRID; k++) if (this.land[k] && this.bits[k >> 3] & (1 << (k & 7))) n++;
    return n;
  }

  /**
   * Uncover the cells around (x, z). Returns the newly uncovered cells as
   * [i, j] pairs (empty most frames).
   */
  reveal(x, z) {
    const out = [];
    const r = Math.ceil(EXPLORE_REACH / EXPLORE_CELL);
    const ci = this.cell(x);
    const cj = this.cell(z);
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= EXPLORE_GRID || j >= EXPLORE_GRID || this.seen(i, j)) continue;
        // Nearest point of the cell to the car.
        const dx = Math.max(this.x(i) - x, 0, x - this.x(i + 1));
        const dz = Math.max(this.x(j) - z, 0, z - this.x(j + 1));
        if (dx * dx + dz * dz > EXPLORE_REACH * EXPLORE_REACH) continue;
        const k = j * EXPLORE_GRID + i;
        this.bits[k >> 3] |= 1 << (k & 7);
        if (this.land?.[k]) this.count++;
        out.push([i, j]);
      }
    if (out.length) this.dirty = true;
    return out;
  }

  /** A flag race finished with `stars`: true when it beats this player's best. */
  recordRace(id, stars) {
    if ((this.races[id] || 0) >= stars) return false;
    this.races[id] = stars;
    this.dirty = true;
    this.save();
    return true;
  }

  /** Flag races finished (any stars). */
  get racesDone() {
    return Object.keys(this.races).length;
  }

  /** Share of the island's land uncovered, in whole percent (0..100). */
  get percent() {
    return this.landCount ? Math.floor((100 * this.count) / this.landCount) : 0;
  }
}
