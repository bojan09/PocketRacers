// Track registry: every map in the game, in menu order.

import sunnyValley from './testTrack.js';
import desertCanyon from './desertCanyon.js';
import snowyPeaks from './snowyPeaks.js';
import nightCity from './nightCity.js';
import tropicalCoast from './tropicalCoast.js';
import autumnWoods from './autumnWoods.js';
import candyLand from './candyLand.js';

export const TRACKS = [sunnyValley, desertCanyon, snowyPeaks, nightCity, tropicalCoast, autumnWoods, candyLand];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const DEFAULT_TRACK = sunnyValley.id;

/** Picture cards for the map picker (no reading needed). */
export const TRACK_ART = {
  island: { sky: ['#4cc9f0', '#c8f1ff'], ground: '#6cc24a', icons: ['🏝️', '⛰️', '🌲'], sun: '☀️' },
  'sunny-valley': { sky: ['#6ec3ff', '#c8ecff'], ground: '#6cc24a', icons: ['🌳', '🏡', '🌲'], sun: '☀️' },
  'desert-canyon': { sky: ['#ff7b54', '#ffd28a'], ground: '#e0a35c', icons: ['🌵', '🪨', '🌵'], sun: '🌅' },
  'snowy-peaks': { sky: ['#9fc4e8', '#e9f3ff'], ground: '#f4f8ff', icons: ['🌲', '⛄', '🌲'], sun: '❄️' },
  'night-city': { sky: ['#141a3d', '#3b2d6b'], ground: '#2b2f45', icons: ['🏢', '🏙️', '🏢'], sun: '🌙' },
  'tropical-coast': { sky: ['#4cc9f0', '#bff3ff'], ground: '#ffe29a', icons: ['🌴', '⛱️', '🌴'], sun: '🐬' },
  'autumn-woods': { sky: ['#ffb36b', '#ffe8cc'], ground: '#c79a46', icons: ['🍂', '🎃', '🍁'], sun: '☀️' },
  'candy-land': { sky: ['#ff9ad5', '#ffe1f1'], ground: '#ffb8d9', icons: ['🍭', '🍬', '🧁'], sun: '🌈' },
};
