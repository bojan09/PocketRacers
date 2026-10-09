// Track registry: every map in the game, in menu order.

import sunnyValley from './testTrack.js';
import desertCanyon from './desertCanyon.js';
import snowyPeaks from './snowyPeaks.js';
import nightCity from './nightCity.js';
import tropicalCoast from './tropicalCoast.js';

export const TRACKS = [sunnyValley, desertCanyon, snowyPeaks, nightCity, tropicalCoast];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const DEFAULT_TRACK = sunnyValley.id;

/** Picture cards for the map picker (no reading needed). */
export const TRACK_ART = {
  'sunny-valley': { sky: ['#6ec3ff', '#c8ecff'], ground: '#6cc24a', icons: ['🌳', '🏡', '🌲'], sun: '☀️' },
  'desert-canyon': { sky: ['#ff7b54', '#ffd28a'], ground: '#e0a35c', icons: ['🌵', '🪨', '🌵'], sun: '🌅' },
  'snowy-peaks': { sky: ['#9fc4e8', '#e9f3ff'], ground: '#f4f8ff', icons: ['🌲', '⛄', '🌲'], sun: '❄️' },
  'night-city': { sky: ['#141a3d', '#3b2d6b'], ground: '#2b2f45', icons: ['🏢', '🏙️', '🏢'], sun: '🌙' },
  'tropical-coast': { sky: ['#4cc9f0', '#bff3ff'], ground: '#ffe29a', icons: ['🌴', '⛱️', '🌴'], sun: '🐬' },
};
