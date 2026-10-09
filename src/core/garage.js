// Garage save: which vehicles are owned, which one is selected, and each
// vehicle's customisation. Versioned and validated on load so a corrupted or
// older save never breaks the game.

import { VEHICLE_BY_ID, VEHICLES, DEFAULT_VEHICLE, LIVERIES, RIM_STYLES, RIDE_HEIGHTS, KIT_OPTIONS, NEON_COLOURS, TINTS, UPGRADES, UPGRADE_MAX, upgradeCost } from '../data/vehicles.js';
import { kitSlots } from '../data/kits.js';

const KEY = 'pocketracers.garage';
const VERSION = 1;
const HEX = /^#[0-9a-f]{6}$/i;

export function freshGarage() {
  return { v: VERSION, selected: DEFAULT_VEHICLE, owned: VEHICLES.filter((v) => v.price === 0).map((v) => v.id), custom: {}, upgrades: {} };
}

/** Clean an untrusted save object into a valid garage state. */
export function sanitizeGarage(raw) {
  const g = freshGarage();
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return g;
  if (Array.isArray(raw.owned)) for (const id of raw.owned) if (VEHICLE_BY_ID[id] && !g.owned.includes(id)) g.owned.push(id);
  if (raw.custom && typeof raw.custom === 'object') {
    for (const [id, c] of Object.entries(raw.custom)) {
      if (!VEHICLE_BY_ID[id] || !c || typeof c !== 'object') continue;
      const clean = {};
      for (const k of ['body', 'accent', 'stripe', 'rim']) if (typeof c[k] === 'string' && HEX.test(c[k])) clean[k] = c[k];
      if (LIVERIES.includes(c.livery)) clean.livery = c.livery;
      if (RIM_STYLES.includes(c.rimStyle)) clean.rimStyle = c.rimStyle;
      if (c.ride in RIDE_HEIGHTS) clean.ride = c.ride;
      for (const slot of kitSlots(VEHICLE_BY_ID[id])) if (KIT_OPTIONS[slot].includes(c[slot])) clean[slot] = c[slot];
      if (NEON_COLOURS.includes(c.neon)) clean.neon = c.neon;
      if (c.tint in TINTS) clean.tint = c.tint;
      g.custom[id] = clean;
    }
  }
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const [id, u] of Object.entries(raw.upgrades)) {
      if (!VEHICLE_BY_ID[id] || !u || typeof u !== 'object') continue;
      const clean = {};
      for (const k of UPGRADES) if (Number.isInteger(u[k]) && u[k] > 0) clean[k] = Math.min(UPGRADE_MAX, u[k]);
      g.upgrades[id] = clean;
    }
  }
  if (g.owned.includes(raw.selected)) g.selected = raw.selected;
  return g;
}

export class Garage {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.load();
  }

  /** (Re)read the save from `this.storage`. */
  load() {
    let raw = null;
    try {
      raw = JSON.parse(this.storage?.getItem(KEY) || 'null');
    } catch {
      /* unreadable: start fresh */
    }
    this.state = sanitizeGarage(raw);
  }

  get selected() {
    return this.state.selected;
  }

  owns(id) {
    return this.state.owned.includes(id);
  }

  custom(id) {
    return this.state.custom[id] || {};
  }

  setCustom(id, key, value) {
    if (!VEHICLE_BY_ID[id]) return;
    this.state.custom[id] = { ...this.custom(id), [key]: value };
    this.state = sanitizeGarage(this.state);
    this.save();
  }

  resetCustom(id) {
    delete this.state.custom[id];
    this.save();
  }

  select(id) {
    if (!this.owns(id)) return false;
    this.state.selected = id;
    this.save();
    return true;
  }

  upgrades(id) {
    return this.state.upgrades[id] || {};
  }

  /** Buy the next level of an upgrade for an owned vehicle. */
  buyUpgrade(id, stat, progress) {
    if (!this.owns(id) || !UPGRADES.includes(stat)) return false;
    const level = this.upgrades(id)[stat] || 0;
    if (level >= UPGRADE_MAX) return false;
    if (!progress.spend(upgradeCost(id, level))) return false;
    this.state.upgrades[id] = { ...this.upgrades(id), [stat]: level + 1 };
    this.save();
    progress.save();
    return true;
  }

  /** Spend points from `progress` to unlock a vehicle. */
  unlock(id, progress) {
    const v = VEHICLE_BY_ID[id];
    if (!v || this.owns(id)) return false;
    if (!progress.spend(v.price)) return false;
    this.state.owned.push(id);
    this.save();
    progress.save();
    return true;
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* full or blocked: keep in memory */
    }
    this.onChange?.();
  }
}
