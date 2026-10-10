// Badges: goals that reward playing in different ways (racing, tricks,
// exploring, collecting). Each one watches a single stat; it is earned when
// the stat reaches `goal`, and pays `reward` points once.

import { TRACKS } from './tracks/index.js';
import { EVENTS } from './events.js';
import { ANIMALS } from './animals.js';

const MAX_RACE_STARS = EVENTS.length * 3;

export const ACHIEVEMENTS = [
  // Racing
  { id: 'first-race', icon: '🏁', name: 'Off the Line', desc: 'Finish a race', stat: 'races', goal: 1, reward: 250 },
  { id: 'first-win', icon: '🥇', name: 'Winner!', desc: 'Win a race', stat: 'wins', goal: 1, reward: 500 },
  { id: 'wins-10', icon: '🏆', name: 'Champion', desc: 'Win 10 races', stat: 'wins', goal: 10, reward: 2000 },
  { id: 'stars-12', icon: '⭐', name: 'Star Collector', desc: 'Earn 12 race stars', stat: 'raceStars', goal: 12, reward: 1000 },
  { id: 'stars-all', icon: '🌟', name: 'Superstar', desc: 'Earn every race star', stat: 'raceStars', goal: MAX_RACE_STARS, reward: 5000 },
  { id: 'monster', icon: '🦖', name: 'Big Wheels', desc: 'Finish a race in a monster truck', stat: 'monsterRaces', goal: 1, reward: 500 },
  { id: 'truck', icon: '🚚', name: 'Heavy Hauler', desc: 'Finish a race in a cargo truck', stat: 'truckRaces', goal: 1, reward: 500 },
  { id: 'rig', icon: '🚛', name: 'Long Load', desc: 'Finish a race in a big rig with a trailer', stat: 'rigRaces', goal: 1, reward: 500 },
  { id: 'tractor', icon: '🚜', name: 'Farm Hand', desc: 'Finish a race on a tractor', stat: 'tractorRaces', goal: 1, reward: 500 },
  { id: 'bus', icon: '🚌', name: 'Bus Driver', desc: 'Finish a race in a bus', stat: 'busRaces', goal: 1, reward: 500 },
  { id: 'bike', icon: '🏍️', name: 'Two Wheels', desc: 'Finish a race on a motorbike', stat: 'bikeRaces', goal: 1, reward: 500 },
  // Tricks
  { id: 'jump', icon: '🛫', name: 'Lift Off', desc: 'Jump off a ramp', stat: 'jumps', goal: 1, reward: 150 },
  { id: 'big-air', icon: '🪂', name: 'Sky High', desc: 'Stay in the air for 2 seconds', stat: 'bestAir', goal: 2, reward: 750 },
  { id: 'spin', icon: '🌀', name: 'Spinner', desc: 'Spin in the air (steer while jumping)', stat: 'spins', goal: 1, reward: 300 },
  { id: 'barrel', icon: '🛢️', name: 'Barrel Roll', desc: 'Do a barrel roll on a twisted ramp', stat: 'barrels', goal: 1, reward: 500 },
  { id: 'corkscrew', icon: '🌪️', name: 'Corkscrew', desc: 'Spin and barrel roll in one jump', stat: 'corkscrews', goal: 1, reward: 1000 },
  { id: 'tricks-50', icon: '🤸', name: 'Trick Master', desc: 'Land 50 tricks', stat: 'tricks', goal: 50, reward: 2000 },
  { id: 'drift', icon: '💨', name: 'Sideways', desc: 'Drift for 60 seconds in total', stat: 'driftTime', goal: 60, reward: 750 },
  { id: 'super', icon: '⚡', name: 'Super Charged', desc: 'Fire Super Nitro', stat: 'supers', goal: 1, reward: 500 },
  { id: 'knock', icon: '💥', name: 'Bumper Cars', desc: 'Bump 25 cars out of the way', stat: 'knocks', goal: 25, reward: 1000 },
  { id: 'near-miss', icon: '😮', name: 'Close Call', desc: 'Zoom past 25 cars really close', stat: 'nearMisses', goal: 25, reward: 750 },
  { id: 'smash', icon: '🚧', name: 'Cone Crusher', desc: 'Knock over 100 cones', stat: 'smashes', goal: 100, reward: 750 },
  { id: 'wreck', icon: '📦', name: 'Wrecking Ball', desc: 'Knock over 50 things off the road', stat: 'propsSmashed', goal: 50, reward: 1000 },
  { id: 'stars', icon: '✨', name: 'Shiny!', desc: 'Grab 100 stars on the road', stat: 'starsPicked', goal: 100, reward: 750 },
  // Exploring and collecting
  { id: 'road-trip', icon: '🛣️', name: 'Road Trip', desc: 'Drive 25 km', stat: 'km', goal: 25, reward: 1000 },
  { id: 'animal', icon: '🐾', name: 'Animal Friend', desc: 'Find a hidden animal', stat: 'animals', goal: 1, reward: 300 },
  { id: 'zoo', icon: '🦁', name: 'Zookeeper', desc: 'Find every hidden animal', stat: 'animals', goal: ANIMALS.length, reward: 3000 },
  { id: 'island-25', icon: '🧭', name: 'Island Explorer', desc: 'Uncover a quarter of the island map', stat: 'islandMap', goal: 25, reward: 1000 },
  { id: 'island-80', icon: '🏝️', name: 'Map Maker', desc: 'Uncover most of the island map', stat: 'islandMap', goal: 80, reward: 5000 },
  { id: 'island-flags', icon: '🏁', name: 'Flag Chaser', desc: 'Finish every flag race on the island', stat: 'islandFlags', goal: 4, reward: 3000 },
  { id: 'bigland-2', icon: '🚗', name: 'Road Trip', desc: 'Drive 2 km from home in Big Land', stat: 'bigLandKm', goal: 2, reward: 1000 },
  { id: 'bigland-10', icon: '🌍', name: 'Far Far Away', desc: 'Drive 10 km from home in Big Land', stat: 'bigLandKm', goal: 10, reward: 5000 },
  { id: 'explorer', icon: '🗺️', name: 'Explorer', desc: 'Drive on every map', stat: 'maps', goal: TRACKS.length, reward: 1000 },
  { id: 'cars-5', icon: '🚗', name: 'Collector', desc: 'Own 5 vehicles', stat: 'owned', goal: 5, reward: 750 },
  { id: 'cars-15', icon: '🏎️', name: 'Big Garage', desc: 'Own 15 vehicles', stat: 'owned', goal: 15, reward: 3000 },
  { id: 'mechanic', icon: '🔧', name: 'Mechanic', desc: 'Buy an upgrade', stat: 'upgrades', goal: 1, reward: 200 },
  { id: 'maxed', icon: '🔩', name: 'Maxed Out', desc: 'Upgrade one part to level 5', stat: 'maxUpgrade', goal: 5, reward: 1000 },
  { id: 'style', icon: '🎨', name: 'Show Off', desc: 'Fit neon lights or a body kit', stat: 'styled', goal: 1, reward: 200 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Every stat any badge reads (the only ones the save keeps). */
export const ACHIEVEMENT_STATS = [...new Set(ACHIEVEMENTS.map((a) => a.stat))];
