// Career events. Each is a race on a track with rules: mode, laps, AI
// difficulty, allowed vehicle families and how many stars unlock it. If the
// player's selected vehicle isn't allowed, they drive an owned one that is,
// or the event's loaner, so no event is ever blocked by the garage.

import { VEHICLES, VEHICLE_BY_ID, PAINT_SWATCHES, makeVehicle } from './vehicles.js';
import { mulberry32 } from '../core/util.js';

export const EVENTS = [
  { id: 'rookie', name: 'Rookie Race', mode: 'race', laps: 3, difficulty: 'easy', families: null, need: 0, loaner: 'zippy', blurb: 'Your first race. Finish in the top 3!' },
  { id: 'trial', name: 'Valley Time Trial', mode: 'timetrial', laps: 2, difficulty: 'normal', families: null, need: 0, loaner: 'zippy', blurb: 'Just you and the clock. Beat the medal times.', medals: [60, 66, 74] },
  { id: 'mud', name: 'Mud & Dust Cup', mode: 'race', laps: 3, difficulty: 'normal', families: ['jeep', 'suv', 'pickup', 'monster'], need: 2, loaner: 'trailhound', blurb: 'Off-roaders only. Shortcuts through the grass are fair game!' },
  { id: 'knockout', name: 'Knockout', mode: 'elimination', laps: 5, difficulty: 'normal', families: null, need: 4, loaner: 'zippy', blurb: 'Every lap, the last car is out. Stay ahead!' },
  { id: 'speed', name: 'Speed Kings', mode: 'race', laps: 3, difficulty: 'hard', families: ['race', 'sports', 'muscle'], need: 6, loaner: 'thunder', blurb: 'The fastest cars in the valley.' },
  { id: 'monster', name: 'Monster Mash', mode: 'race', laps: 2, difficulty: 'normal', families: ['monster', 'pickup'], need: 8, loaner: 'basher', blurb: 'Big wheels, big jumps.' },
  { id: 'bigrig', name: 'Big Rig Rumble', mode: 'race', laps: 2, difficulty: 'normal', families: ['truck'], need: 10, loaner: 'nordhaul', blurb: 'Trucks only. Heavy, slow to turn, and very loud.' },
  { id: 'champ', name: 'Valley Championship', mode: 'race', laps: 4, difficulty: 'hard', families: null, need: 14, loaner: 'bolt', blurb: 'The big one. Beat everyone!' },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const MAX_STARS = EVENTS.length * 3;

// Points paid for 3, 2 and 1 stars (scaled up for later events).
export function rewards(event) {
  const k = 1 + event.need / 10;
  return [1500, 900, 500].map((v) => Math.round((v * k) / 50) * 50);
}

const NAMES = ['Rocket Rosa', 'Turbo Tom', 'Zoom Zara', 'Dash Dani', 'Blaze Billie', 'Max Motor', 'Sunny Sam', 'Lightning Lu', 'Captain Kit', 'Nova Noor', 'Speedy Sid', 'Whizz Wren'];
const LIVERY_POOL = ['clean', 'racing', 'side', 'twotone'];

export function allowed(event, vehicleId) {
  return !event.families || event.families.includes(VEHICLE_BY_ID[vehicleId]?.family);
}

/** Which vehicle the player drives in this event. */
export function vehicleFor(event, garage) {
  if (allowed(event, garage.selected)) return { id: garage.selected, loaner: false };
  const owned = VEHICLES.find((v) => garage.owns(v.id) && allowed(event, v.id));
  if (owned) return { id: owned.id, loaner: false };
  return { id: event.loaner, loaner: true };
}

/**
 * AI opponents: allowed vehicles close in pace to the player's, in random
 * paint, with friendly names. Deterministic per event + attempt seed.
 */
export function pickOpponents(event, playerCar, count = 5, seed = 1) {
  const rand = mulberry32(seed * 104729 + event.id.length * 31);
  const pool = VEHICLES.filter((v) => allowed(event, v.id)).map((v) => ({ v, top: makeVehicle(v.id).handling.maxSpeed }));
  pool.sort((a, b) => Math.abs(a.top - playerCar.handling.maxSpeed) - Math.abs(b.top - playerCar.handling.maxSpeed));
  const near = pool.slice(0, Math.max(3, Math.ceil(pool.length * 0.6)));
  const names = NAMES.slice().sort(() => rand() - 0.5);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  return Array.from({ length: count }, (_, i) => {
    const { v } = pick(near);
    const custom = { body: pick(PAINT_SWATCHES), accent: pick(PAINT_SWATCHES), stripe: pick(['#ffffff', '#ffd23f', '#1b1f3b']), livery: pick(LIVERY_POOL) };
    return { car: makeVehicle(v.id, custom), name: names[i % names.length] };
  });
}

/** Stars earned: by place in races, by medal in time trials. */
export function starsFor(event, results) {
  if (event.mode === 'timetrial') {
    const m = medalTimes(event, results.car);
    return results.time <= m[0] ? 3 : results.time <= m[1] ? 2 : results.time <= m[2] ? 1 : 0;
  }
  return results.eliminated ? 0 : Math.max(0, 4 - results.place);
}

/** Medal times scaled to the vehicle's pace (a truck isn't expected to beat a race car). */
export function medalTimes(event, car) {
  const k = Math.pow(13000 / car.handling.maxSpeed, 0.85);
  return event.medals.map((t) => Math.round(t * k));
}
