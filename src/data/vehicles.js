// The vehicle roster. Each entry is a variant of a family (see
// vehicleFamilies.js): body options, size, stat tweaks, default paint and an
// unlock price in earned points (0 = free from the start). All names are
// invented; no real makes, models or badges.

import { FAMILIES, familyHandling, scaleModel } from './vehicleFamilies.js';
import { LIVERIES, RIM_STYLES, wheelSize } from '../render3d/carModel.js';
import { applyKit, KIT_OPTIONS, NEON_COLOURS, TINTS } from './kits.js';

const UNITS_PER_METRE = 240;

// Paint shorthand: [body, accent, stripe, rim].
const P = (body, accent, stripe, rim) => ({ body, accent, stripe, rim });

export const VEHICLES = [
  // ------------------------------------------------------------- race
  { id: 'bolt', name: 'Bolt R', family: 'race', price: 9000, paint: P('#06d6a0', '#1b1f3b', '#ffffff', '#1b1f3b'), livery: 'racing' },
  { id: 'rocket', name: 'Rocket Junior', family: 'race', price: 6000, opts: { formula: true }, scale: [0.94, 0.95, 0.94], tweak: { maxSpeed: 13400, accel: 6000 }, paint: P('#4cc9f0', '#ffd23f', '#ffffff', '#1b1f3b'), livery: 'racing' },
  { id: 'riptide', name: 'Riptide LM', family: 'race', price: 10500, opts: { wing: false }, tweak: { maxSpeed: 14200, grip: 11.5 }, paint: P('#2b6fd6', '#ff8c42', '#ff8c42', '#f4f6fa'), livery: 'side' },
  { id: 'apex', name: 'Apex 9', family: 'race', price: 12000, scale: [1.02, 0.97, 1.04], tweak: { maxSpeed: 14600, accel: 6600, grip: 12.5 }, paint: P('#1b1f3b', '#ff4d5e', '#ff4d5e', '#ff4d5e'), livery: 'side', rimStyle: 'spokes' },
  { id: 'vortex', name: 'Vortex V1', family: 'race', price: 15000, opts: { formula: true }, tweak: { maxSpeed: 14800, accel: 6800, grip: 13, steerSpeed: 2.6 }, paint: P('#ff4d5e', '#f4f6fa', '#ffffff', '#1b1f3b'), livery: 'tri' },
  { id: 'blaze', name: 'Blaze F', family: 'race', price: 18000, opts: { formula: true }, scale: [1.03, 1, 1.03], tweak: { maxSpeed: 15000, accel: 7000, grip: 13.5, steerSpeed: 2.65 }, paint: P('#ff8c42', '#1b1f3b', '#ffd23f', '#ffd23f'), livery: 'racing' },
  { id: 'nova', name: 'Nova X', family: 'race', price: 22000, scale: [1.03, 0.96, 1.05], tweak: { maxSpeed: 15200, accel: 7000, grip: 13 }, paint: P('#7b5cff', '#4cc9f0', '#4cc9f0', '#f4f6fa'), livery: 'split' },
  // ----------------------------------------------------------- sports
  { id: 'zippy', name: 'Zippy GT', family: 'sports', price: 0, paint: P('#ff4d5e', '#ffd23f', '#ffffff', '#dfe7f0'), livery: 'racing' },
  { id: 'comet', name: 'Comet S', family: 'sports', price: 1200, opts: { lip: true }, scale: [0.97, 0.96, 0.95], tweak: { maxSpeed: 12800, grip: 11, steerSpeed: 2.45 }, paint: P('#7b5cff', '#1b1f3b', '#4cc9f0', '#1b1f3b'), livery: 'side', rimStyle: 'star' },
  { id: 'lynx', name: 'Lynx RS', family: 'sports', price: 2200, opts: { lip: true }, tweak: { maxSpeed: 13100, accel: 5800 }, paint: P('#8ac926', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'lower' },
  { id: 'flicker', name: 'Flicker GT', family: 'sports', price: 3000, scale: [1, 0.98, 1.03], tweak: { maxSpeed: 13300, accel: 5900 }, paint: P('#ffe14d', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'tri' },
  { id: 'vector', name: 'Vector W', family: 'sports', price: 5000, opts: { wedge: true }, tweak: { maxSpeed: 13600, accel: 6000, grip: 10.5 }, paint: P('#f4f6fa', '#ff4d5e', '#ff4d5e', '#1b1f3b'), livery: 'side' },
  { id: 'kestrel', name: 'Kestrel K', family: 'sports', price: 6500, tweak: { maxSpeed: 13800, accel: 6100, grip: 11 }, paint: P('#2ec4b6', '#1b1f3b', '#ffffff', '#f4f6fa'), livery: 'racing', rimStyle: 'star' },
  { id: 'saber', name: 'Saberline', family: 'sports', price: 8000, opts: { wedge: true }, scale: [1.02, 0.97, 1.04], tweak: { maxSpeed: 14000, accel: 6200, grip: 11 }, paint: P('#c77dff', '#1b1f3b', '#ffffff', '#1b1f3b'), livery: 'twotone' },
  { id: 'glimmer', name: 'Glimmer W8', family: 'sports', price: 14000, opts: { wedge: true }, scale: [1.03, 0.96, 1.05], tweak: { maxSpeed: 14400, accel: 6500, grip: 11.5, steerSpeed: 2.4 }, paint: P('#ffbe0b', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'split' },
  // ----------------------------------------------------------- muscle
  { id: 'twister', name: 'Twister', family: 'muscle', price: 2600, tweak: { maxSpeed: 12800, accel: 5900 }, paint: P('#ff8c42', '#1b1f3b', '#ffffff', '#c9d3de'), livery: 'side' },
  { id: 'thunder', name: 'Thunder V8', family: 'muscle', price: 3500, paint: P('#ffbe0b', '#1b1f3b', '#1b1f3b', '#c9d3de'), livery: 'racing' },
  { id: 'stampede', name: 'Stampede', family: 'muscle', price: 4200, scale: [1.02, 1, 1.05], tweak: { maxSpeed: 13400, accel: 6300 }, paint: P('#2b6fd6', '#f4f6fa', '#f4f6fa', '#c9d3de'), livery: 'racing' },
  { id: 'bruiser', name: 'Bruiser', family: 'muscle', price: 6000, opts: { blower: true }, tweak: { maxSpeed: 13600, accel: 6700, grip: 7.5 }, paint: P('#3a3f4b', '#ff4d5e', '#ff4d5e', '#c9d3de'), livery: 'side' },
  { id: 'hammer', name: 'Hammerhead', family: 'muscle', price: 11000, opts: { blower: true }, scale: [1.03, 1, 1.04], tweak: { maxSpeed: 14100, accel: 7000, grip: 8 }, paint: P('#06d6a0', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'twotone' },
  // ------------------------------------------------------------ hatch
  { id: 'pip', name: 'Pip', family: 'hatch', price: 0, paint: P('#4cc9f0', '#ffffff', '#ffd23f', '#f4f6fa'), livery: 'side' },
  { id: 'bean', name: 'Bean', family: 'hatch', price: 400, scale: [0.9, 0.95, 0.86], tweak: { maxSpeed: 10600, grip: 12, steerSpeed: 2.7 }, paint: P('#8ac926', '#ffffff', '#ffffff', '#f4f6fa'), livery: 'twotone' },
  { id: 'hopper', name: 'Hopper', family: 'hatch', price: 800, tweak: { maxSpeed: 11500, accel: 5400 }, paint: P('#ff006e', '#ffffff', '#ffffff', '#f4f6fa'), livery: 'lower' },
  { id: 'button', name: 'Button', family: 'hatch', price: 1500, scale: [0.92, 0.97, 0.88], tweak: { maxSpeed: 11000, grip: 12.5, steerSpeed: 2.75 }, paint: P('#ffe14d', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'split' },
  { id: 'scooter', name: 'Scooter Hot', family: 'hatch', price: 2800, scale: [1.04, 0.97, 1.02], tweak: { maxSpeed: 12000, accel: 5800, grip: 12 }, paint: P('#f4f6fa', '#ff4d5e', '#ff4d5e', '#ff4d5e'), livery: 'tri', rimStyle: 'spokes' },
  { id: 'turbotot', name: 'Turbo Tot', family: 'hatch', price: 5200, scale: [1.05, 0.96, 1.03], tweak: { maxSpeed: 12500, accel: 6200, grip: 12.5, steerSpeed: 2.7 }, paint: P('#7b5cff', '#ffd23f', '#ffd23f', '#ffd23f'), livery: 'racing' },
  // ------------------------------------------------------------- jeep
  { id: 'gecko', name: 'Gecko', family: 'jeep', price: 900, opts: { open: true }, scale: [0.92, 0.95, 0.9], tweak: { maxSpeed: 10600, steerSpeed: 2.35 }, paint: P('#8ac926', '#1b1f3b', '#ffffff', '#1b1f3b'), livery: 'clean' },
  { id: 'badger', name: 'Badger', family: 'jeep', price: 1600, opts: { open: true }, paint: P('#ff8c42', '#1b1f3b', '#ffffff', '#2b2f36'), livery: 'lower' },
  { id: 'trailhound', name: 'Trailhound', family: 'jeep', price: 2000, paint: P('#3f8f4f', '#1b1f3b', '#f4f1e8', '#2b2f36'), livery: 'clean' },
  { id: 'pathpup', name: 'Pathpup', family: 'jeep', price: 3200, opts: { open: true, lightBar: true }, tweak: { maxSpeed: 11000, offroadTop: 0.88 }, paint: P('#ffe14d', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'side' },
  { id: 'snowpaw', name: 'Snowpaw', family: 'jeep', price: 5500, opts: { lightBar: true }, scale: [1.05, 1.05, 1.06], tweak: { maxSpeed: 11300, accel: 5200, offroadTop: 0.9, offroadGrip: 1 }, paint: P('#f4f6fa', '#2b6fd6', '#2b6fd6', '#2b2f36'), livery: 'twotone' },
  // -------------------------------------------------------------- suv
  { id: 'pebble', name: 'Pebble', family: 'suv', price: 1400, scale: [0.93, 0.95, 0.9], tweak: { maxSpeed: 11000, grip: 9.5 }, paint: P('#ff8c42', '#f4f6fa', '#f4f6fa', '#c9d3de'), livery: 'twotone' },
  { id: 'glacier', name: 'Glacier', family: 'suv', price: 2500, paint: P('#f4f6fa', '#1b1f3b', '#2ec4b6', '#c9d3de'), livery: 'twotone' },
  { id: 'orca', name: 'Orca', family: 'suv', price: 3000, scale: [1.02, 1.03, 1.03], tweak: { maxSpeed: 11600, accel: 5000 }, paint: P('#1b1f3b', '#f4f6fa', '#f4f6fa', '#c9d3de'), livery: 'lower' },
  { id: 'aurora', name: 'Aurora', family: 'suv', price: 4800, opts: { lux: true }, scale: [1, 1.02, 1.08], tweak: { maxSpeed: 12000, accel: 5200 }, paint: P('#2ec4b6', '#1b1f3b', '#f4f6fa', '#dfe7f0'), livery: 'clean' },
  { id: 'meridian', name: 'Meridian', family: 'suv', price: 9000, opts: { lux: true }, scale: [1.03, 1.02, 1.1], tweak: { maxSpeed: 12600, accel: 5700, grip: 9.5 }, paint: P('#3a3f4b', '#ffd23f', '#ffd23f', '#ffd23f'), livery: 'clean', rimStyle: 'star' },
  // ----------------------------------------------------------- pickup
  { id: 'dusty', name: 'Dusty', family: 'pickup', price: 0, paint: P('#e9a23b', '#5b3a1e', '#ffffff', '#c9d3de'), livery: 'clean' },
  { id: 'haybale', name: 'Haybale', family: 'pickup', price: 1000, tweak: { maxSpeed: 11000 }, paint: P('#ff4d5e', '#f4f6fa', '#f4f6fa', '#f4f6fa'), livery: 'twotone' },
  { id: 'packmule', name: 'Packmule', family: 'pickup', price: 2000, scale: [1.02, 1.02, 1.04], tweak: { maxSpeed: 11400, accel: 5100 }, paint: P('#9aa5b1', '#1b1f3b', '#ff8c42', '#1b1f3b'), livery: 'side' },
  { id: 'mudslinger', name: 'Mudslinger', family: 'pickup', price: 4500, opts: { lifted: true, lightBar: true }, tweak: { offroadTop: 0.85, offroadGrip: 0.95, jumpBoost: 1.15, maxSpeed: 11000 }, paint: P('#2b6fd6', '#ffd23f', '#ffd23f', '#1b1f3b'), livery: 'side', ride: 0.08 },
  { id: 'sidewinder', name: 'Sidewinder', family: 'pickup', price: 7500, opts: { lifted: true }, tweak: { offroadTop: 0.88, offroadGrip: 1, jumpBoost: 1.2, maxSpeed: 11600, accel: 5400 }, paint: P('#8ac926', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'tri', ride: 0.08 },
  // ---------------------------------------------------------- monster
  { id: 'tinytitan', name: 'Tiny Titan', family: 'monster', price: 5000, opts: { body: 'hatch' }, tweak: { maxSpeed: 10600, steerSpeed: 2.2 }, paint: P('#4cc9f0', '#ffd23f', '#ffd23f', '#1b1f3b'), livery: 'side' },
  { id: 'basher', name: 'Boulder Basher', family: 'monster', price: 6000, paint: P('#ff006e', '#ffd23f', '#ffd23f', '#1b1f3b'), livery: 'racing' },
  { id: 'stomp', name: 'Stomp-a-Lot', family: 'monster', price: 7000, opts: { body: 'suv' }, paint: P('#8ac926', '#7b5cff', '#7b5cff', '#1b1f3b'), livery: 'twotone' },
  { id: 'chomper', name: 'Mega Chomper', family: 'monster', price: 8500, opts: { body: 'muscle' }, tweak: { maxSpeed: 11200, accel: 5800 }, paint: P('#ff4d5e', '#ffffff', '#ffffff', '#1b1f3b'), livery: 'racing' },
  { id: 'rumblecat', name: 'Rumble Cat', family: 'monster', price: 9500, opts: { body: 'jeep' }, tweak: { maxSpeed: 11000, jumpBoost: 1.35 }, paint: P('#ffbe0b', '#1b1f3b', '#1b1f3b', '#1b1f3b'), livery: 'tri' },
  { id: 'grizzly', name: 'Grizzly', family: 'monster', price: 12000, scale: [1.04, 1.04, 1.05], tweak: { maxSpeed: 11500, accel: 6000, jumpBoost: 1.4 }, paint: P('#5b3a1e', '#ff8c42', '#ff8c42', '#1b1f3b'), livery: 'side' },
  // ------------------------------------------------------------ truck
  { id: 'flatline', name: 'Flatline', family: 'truck', price: 6500, opts: { cargo: 'flatbed' }, tweak: { maxSpeed: 10200 }, paint: P('#2b6fd6', '#3a3f4b', '#ffd23f', '#c9d3de'), livery: 'clean' },
  { id: 'nordhaul', name: 'Nordhaul 500', family: 'truck', price: 7000, paint: P('#d7263d', '#f4f6fa', '#1b1f3b', '#c9d3de'), livery: 'clean' },
  { id: 'rockhauler', name: 'Rock Hauler', family: 'truck', price: 7500, opts: { cargo: 'tipper' }, tweak: { accel: 3600 }, paint: P('#ffbe0b', '#ff8c42', '#1b1f3b', '#1b1f3b'), livery: 'clean' },
  { id: 'tankmaster', name: 'Tankmaster', family: 'truck', price: 8000, opts: { cargo: 'tanker' }, paint: P('#f4f6fa', '#c9d3de', '#ff4d5e', '#c9d3de'), livery: 'clean' },
  { id: 'polarhaul', name: 'Polarhaul 700', family: 'truck', price: 10000, tweak: { maxSpeed: 10800, accel: 3900 }, paint: P('#2ec4b6', '#f4f6fa', '#2b6fd6', '#c9d3de'), livery: 'side' },
  { id: 'goliath', name: 'Goliath', family: 'truck', price: 13000, opts: { cargo: 'tanker' }, tweak: { maxSpeed: 11200, accel: 4200 }, paint: P('#1b1f3b', '#ffd23f', '#ffd23f', '#ffd23f'), livery: 'side' },
  // --------------------------------------------------------- big rigs
  { id: 'longhaul', name: 'Long Haul', family: 'rig', price: 5000, paint: P('#2b6fd6', '#f4f6fa', '#ff4d5e', '#c9d3de'), livery: 'clean' },
  { id: 'tankrig', name: 'Silver Streak', family: 'rig', price: 7000, opts: { load: 'tanker' }, paint: P('#ff8c42', '#dfe4ee', '#1b1f3b', '#c9d3de'), livery: 'clean' },
  { id: 'timber', name: 'Timber Titan', family: 'rig', price: 8500, opts: { load: 'logs' }, tweak: { maxSpeed: 10200 }, paint: P('#3f8f4f', '#1b1f3b', '#ffd23f', '#c9d3de'), livery: 'clean' },
  { id: 'carrier', name: 'Car Carrier', family: 'rig', price: 11000, opts: { load: 'cars' }, tweak: { maxSpeed: 10500, accel: 3600 }, paint: P('#ff4d5e', '#ffd23f', '#ffffff', '#c9d3de'), livery: 'clean' },

  // --------------------------------------------------------- tractors
  { id: 'clover', name: 'Clover', family: 'tractor', price: 1200, paint: P('#e63946', '#ffd23f', '#ffffff', '#ffd23f'), livery: 'clean' },
  { id: 'meadow', name: 'Meadow King', family: 'tractor', price: 3500, opts: { load: 'logs' }, tweak: { maxSpeed: 9800 }, paint: P('#3f8f4f', '#ffd23f', '#ffffff', '#ffd23f'), livery: 'clean' },
  { id: 'sunny', name: 'Sunny Days', family: 'tractor', price: 2400, opts: { guard: 'accent' }, paint: P('#ffd23f', '#3f8f4f', '#ffffff', '#3f8f4f'), livery: 'clean' },
  { id: 'harvest', name: 'Big Harvest', family: 'tractor', price: 6000, scale: [1.06, 1.06, 1.06], tweak: { maxSpeed: 10300, accel: 4700 }, paint: P('#2b6fd6', '#f4f6fa', '#ffffff', '#f4f6fa'), livery: 'clean' },
];

export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
export const DEFAULT_VEHICLE = 'zippy';

// Customisation choices offered in the garage.
export const PAINT_SWATCHES = ['#ff4d5e', '#ff8c42', '#ffbe0b', '#ffe14d', '#8ac926', '#06d6a0', '#2ec4b6', '#4cc9f0', '#2b6fd6', '#7b5cff', '#c77dff', '#ff006e', '#f4f6fa', '#9aa5b1', '#3a3f4b', '#1b1f3b'];
export const RIM_SWATCHES = ['#dfe7f0', '#c9d3de', '#ffd23f', '#ff4d5e', '#2ec4b6', '#4cc9f0', '#7b5cff', '#1b1f3b'];
export const RIDE_HEIGHTS = { low: -0.04, stock: 0, lifted: 0.08, max: 0.16 };
export { LIVERIES, RIM_STYLES, KIT_OPTIONS, NEON_COLOURS, TINTS };

// Performance upgrades: 5 levels each, bought with points per vehicle.
export const UPGRADES = ['engine', 'turbo', 'tyres', 'nitro'];
export const UPGRADE_MAX = 5;
const UPGRADE_BASE = [400, 800, 1500, 2500, 4000];

/** Points for the next level of an upgrade (pricier for pricier vehicles). */
export function upgradeCost(id, level) {
  const v = VEHICLE_BY_ID[id];
  const tier = Math.min(2.2, Math.max(0.6, 0.6 + v.price / 10000));
  return Math.round((UPGRADE_BASE[level] * tier) / 50) * 50;
}

/** Handling with upgrades applied. */
export function upgradedHandling(v, up = {}) {
  const h = familyHandling(v.family, v.tweak);
  const L = (k) => Math.max(0, Math.min(UPGRADE_MAX, up[k] | 0));
  return {
    ...h,
    maxSpeed: h.maxSpeed * (1 + 0.02 * L('engine')),
    accel: h.accel * (1 + 0.05 * L('turbo')),
    grip: h.grip * (1 + 0.04 * L('tyres')),
    steerSpeed: h.steerSpeed * (1 + 0.015 * L('tyres')),
    offroadGrip: Math.min(1.1, h.offroadGrip * (1 + 0.03 * L('tyres'))),
    nitroTop: h.nitroTop * (1 + 0.012 * L('nitro')),
    nitroAccel: h.nitroAccel * (1 + 0.04 * L('nitro')),
    nitroDrain: 1 - 0.06 * L('nitro'),
  };
}

const familyRims = {};
function defaultRim(v) {
  const key = `${v.family}:${JSON.stringify(v.opts || {})}`;
  if (!(key in familyRims)) familyRims[key] = FAMILIES[v.family].build(v.opts || {}).wheels.rimStyle || 'spokes';
  return v.rimStyle || familyRims[key];
}

/** The paint/livery/rims a vehicle shows: its defaults, overridden by the player's choices. */
export function resolveLook(v, custom = {}) {
  return {
    body: custom.body || v.paint.body,
    accent: custom.accent || v.paint.accent,
    stripe: custom.stripe || v.paint.stripe,
    rim: custom.rim || v.paint.rim,
    tire: '#23262d',
    glass: TINTS[custom.tint] || TINTS.clear,
    livery: custom.livery || v.livery || 'clean',
    rimStyle: custom.rimStyle || defaultRim(v),
    ride: (custom.ride !== undefined ? RIDE_HEIGHTS[custom.ride] : v.ride) || 0,
  };
}

/**
 * The car's nitro glow colour ([r, g, b] 0..1): its body colour, or the
 * accent when the body is too dark or grey to glow, brightened so the
 * brightest channel is full.
 */
export function nitroColour(look) {
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const score = (c) => {
    const hi = Math.max(...c);
    const lo = Math.min(...c);
    return hi * (hi > 0 ? (hi - lo) / hi + 0.25 : 0);
  };
  const body = rgb(look.body);
  const accent = rgb(look.accent);
  const c = score(accent) > score(body) * 1.4 ? accent : body;
  const hi = Math.max(...c);
  if (hi < 0.05) return [1, 1, 1];
  return c.map((v) => v / hi);
}

/**
 * A complete, drivable vehicle definition (model, handling, look, collision
 * size) for the session, renderer and audio.
 */
export function makeVehicle(id, custom = {}, upgrades = {}) {
  const v = VEHICLE_BY_ID[id] || VEHICLE_BY_ID[DEFAULT_VEHICLE];
  const fam = FAMILIES[v.family];
  const model = applyKit(scaleModel(fam.build(v.opts || {}), v.scale || [1, 1, 1]), v, custom);
  const halfWidth = Math.max(...model.body.map((s) => s[1]), ...model.wheels.positions.map((p, i) => Math.abs(p[0]) + wheelSize(model.wheels, i).width / 2));
  const length = model.body[model.body.length - 1][0] - model.body[0][0];
  return {
    id: v.id,
    name: v.name,
    family: v.family,
    engine: fam.engine,
    camera: fam.camera * (v.scale ? v.scale[2] : 1),
    widthWorld: Math.round(halfWidth * 2 * UNITS_PER_METRE * 1.05),
    lengthWorld: Math.round(length * UNITS_PER_METRE * 0.94),
    handling: upgradedHandling(v, upgrades),
    model,
    paint: resolveLook(v, custom),
  };
}

/** 1..10 bars for the garage stats panel. */
export function vehicleStats(id, upgrades = {}) {
  const h = upgradedHandling(VEHICLE_BY_ID[id], upgrades);
  const bar = (v, lo, hi) => Math.max(1, Math.min(10, Math.round(1 + ((v - lo) / (hi - lo)) * 9)));
  return {
    speed: bar(h.maxSpeed, 9500, 16500),
    accel: bar(h.accel, 3000, 8500),
    handling: bar(h.grip * h.steerSpeed, 11, 31),
    offroad: bar(h.offroadTop, 0.35, 0.92),
  };
}
