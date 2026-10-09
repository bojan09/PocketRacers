// Track registry: every map in the game, in menu order.

import sunnyValley from './testTrack.js';
import desertCanyon from './desertCanyon.js';
import snowyPeaks from './snowyPeaks.js';
import nightCity from './nightCity.js';
import tropicalCoast from './tropicalCoast.js';

export const TRACKS = [sunnyValley, desertCanyon, snowyPeaks, nightCity, tropicalCoast];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const DEFAULT_TRACK = sunnyValley.id;

/** Short mood line for menus. */
export const TRACK_MOOD = {
  'sunny-valley': 'Sunny day · hills & lake',
  'desert-canyon': 'Sunset · dust & mesas',
  'snowy-peaks': 'Snowfall · slippery pass',
  'night-city': 'Night · rain & neon',
  'tropical-coast': 'Morning · islands & sea',
};
