// The vehicle roster. Each entry is a variant of a family (see
// vehicleFamilies.js): body options, size, stat tweaks, default paint and an
// unlock price in earned points (0 = free from the start). All names are
// invented; no real makes, models or badges.

import { FAMILIES, familyHandling, scaleModel } from './vehicleFamilies.js';
import { LIVERIES, RIM_STYLES } from '../render3d/carModel.js';

const UNITS_PER_METRE = 240;

export const VEHICLES = [
  { id: 'zippy', name: 'Zippy GT', family: 'sports', price: 0, paint: { body: '#ff4d5e', accent: '#ffd23f', stripe: '#ffffff', rim: '#dfe7f0' }, livery: 'racing' },
  { id: 'pip', name: 'Pip', family: 'hatch', price: 0, paint: { body: '#4cc9f0', accent: '#ffffff', stripe: '#ffd23f', rim: '#f4f6fa' }, livery: 'side' },
  { id: 'dusty', name: 'Dusty', family: 'pickup', price: 0, paint: { body: '#e9a23b', accent: '#5b3a1e', stripe: '#ffffff', rim: '#c9d3de' }, livery: 'clean' },
  { id: 'comet', name: 'Comet S', family: 'sports', price: 1200, opts: { lip: true }, scale: [0.97, 0.96, 0.95], tweak: { maxSpeed: 12800, grip: 11, steerSpeed: 2.45 }, paint: { body: '#7b5cff', accent: '#1b1f3b', stripe: '#4cc9f0', rim: '#1b1f3b' }, livery: 'side', rimStyle: 'star' },
  { id: 'trailhound', name: 'Trailhound', family: 'jeep', price: 2000, paint: { body: '#3f8f4f', accent: '#1b1f3b', stripe: '#f4f1e8', rim: '#2b2f36' }, livery: 'clean' },
  { id: 'glacier', name: 'Glacier', family: 'suv', price: 2500, paint: { body: '#f4f6fa', accent: '#1b1f3b', stripe: '#2ec4b6', rim: '#c9d3de' }, livery: 'twotone' },
  { id: 'thunder', name: 'Thunder V8', family: 'muscle', price: 3500, paint: { body: '#ffbe0b', accent: '#1b1f3b', stripe: '#1b1f3b', rim: '#c9d3de' }, livery: 'racing' },
  { id: 'mudslinger', name: 'Mudslinger', family: 'pickup', price: 4500, opts: { lifted: true, lightBar: true }, tweak: { offroadTop: 0.85, offroadGrip: 0.95, jumpBoost: 1.15, maxSpeed: 11000 }, paint: { body: '#2b6fd6', accent: '#ffd23f', stripe: '#ffd23f', rim: '#1b1f3b' }, livery: 'side', ride: 0.08 },
  { id: 'basher', name: 'Boulder Basher', family: 'monster', price: 6000, paint: { body: '#ff006e', accent: '#ffd23f', stripe: '#ffd23f', rim: '#1b1f3b' }, livery: 'racing' },
  { id: 'nordhaul', name: 'Nordhaul 500', family: 'truck', price: 7000, paint: { body: '#d7263d', accent: '#f4f6fa', stripe: '#1b1f3b', rim: '#c9d3de' }, livery: 'clean' },
  { id: 'bolt', name: 'Bolt R', family: 'race', price: 9000, paint: { body: '#06d6a0', accent: '#1b1f3b', stripe: '#ffffff', rim: '#1b1f3b' }, livery: 'racing' },
  { id: 'apex', name: 'Apex 9', family: 'race', price: 12000, scale: [1.02, 0.97, 1.04], tweak: { maxSpeed: 14600, accel: 6600, grip: 12.5 }, paint: { body: '#1b1f3b', accent: '#ff4d5e', stripe: '#ff4d5e', rim: '#ff4d5e' }, livery: 'side', rimStyle: 'spokes' },
];

export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
export const DEFAULT_VEHICLE = 'zippy';

// Customisation choices offered in the garage.
export const PAINT_SWATCHES = ['#ff4d5e', '#ff8c42', '#ffbe0b', '#ffe14d', '#8ac926', '#06d6a0', '#2ec4b6', '#4cc9f0', '#2b6fd6', '#7b5cff', '#c77dff', '#ff006e', '#f4f6fa', '#9aa5b1', '#3a3f4b', '#1b1f3b'];
export const RIM_SWATCHES = ['#dfe7f0', '#c9d3de', '#ffd23f', '#ff4d5e', '#2ec4b6', '#4cc9f0', '#7b5cff', '#1b1f3b'];
export const RIDE_HEIGHTS = { low: -0.04, stock: 0, lifted: 0.08, max: 0.16 };
export { LIVERIES, RIM_STYLES };

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
    glass: '#1f2b45',
    livery: custom.livery || v.livery || 'clean',
    rimStyle: custom.rimStyle || defaultRim(v),
    ride: (custom.ride !== undefined ? RIDE_HEIGHTS[custom.ride] : v.ride) || 0,
  };
}

/**
 * A complete, drivable vehicle definition (model, handling, look, collision
 * size) for the session, renderer and audio.
 */
export function makeVehicle(id, custom) {
  const v = VEHICLE_BY_ID[id] || VEHICLE_BY_ID[DEFAULT_VEHICLE];
  const fam = FAMILIES[v.family];
  const model = scaleModel(fam.build(v.opts || {}), v.scale || [1, 1, 1]);
  const halfWidth = Math.max(...model.body.map((s) => s[1]), ...model.wheels.positions.map((p) => Math.abs(p[0]) + model.wheels.width / 2));
  const length = model.body[model.body.length - 1][0] - model.body[0][0];
  return {
    id: v.id,
    name: v.name,
    family: v.family,
    engine: fam.engine,
    camera: fam.camera * (v.scale ? v.scale[2] : 1),
    widthWorld: Math.round(halfWidth * 2 * UNITS_PER_METRE * 1.05),
    lengthWorld: Math.round(length * UNITS_PER_METRE * 0.94),
    handling: familyHandling(v.family, v.tweak),
    model,
    paint: resolveLook(v, custom),
  };
}

/** 1..10 bars for the garage stats panel. */
export function vehicleStats(id) {
  const h = familyHandling(VEHICLE_BY_ID[id].family, VEHICLE_BY_ID[id].tweak);
  const bar = (v, lo, hi) => Math.max(1, Math.min(10, Math.round(1 + ((v - lo) / (hi - lo)) * 9)));
  return {
    speed: bar(h.maxSpeed, 9500, 14600),
    accel: bar(h.accel, 3000, 6600),
    handling: bar(h.grip * h.steerSpeed, 11, 31),
    offroad: bar(h.offroadTop, 0.35, 0.92),
  };
}
