// Hidden animals: three on every race map and five on the island, waiting at the side of the road (some
// in tunnels or on bridges). Driving past one says hello; the first time a
// player finds it, it goes into their sticker book. `seg` is the track
// segment, `x` the lateral position in road half-widths.

export const ANIMALS = [
  { id: 'bunny', icon: '🐰', map: 'sunny-valley', seg: 250, x: -0.8 },
  { id: 'pig', icon: '🐷', map: 'sunny-valley', seg: 1110, x: -0.8 },
  { id: 'duck', icon: '🦆', map: 'sunny-valley', seg: 1480, x: 0.8 },
  { id: 'fox', icon: '🦊', map: 'desert-canyon', seg: 1080, x: -0.8 },
  { id: 'camel', icon: '🐫', map: 'desert-canyon', seg: 1380, x: 0.8 },
  { id: 'lizard', icon: '🦎', map: 'desert-canyon', seg: 2520, x: 0.8 },
  { id: 'polarbear', icon: '🐻‍❄️', map: 'snowy-peaks', seg: 300, x: -0.8 },
  { id: 'owl', icon: '🦉', map: 'snowy-peaks', seg: 1230, x: 0.8 },
  { id: 'penguin', icon: '🐧', map: 'snowy-peaks', seg: 1650, x: 0.8 },
  { id: 'cat', icon: '🐱', map: 'night-city', seg: 1000, x: 0.8 },
  { id: 'dog', icon: '🐶', map: 'night-city', seg: 1250, x: -0.8 },
  { id: 'raccoon', icon: '🦝', map: 'night-city', seg: 2170, x: 0.8 },
  { id: 'crab', icon: '🦀', map: 'tropical-coast', seg: 220, x: 0.8 },
  { id: 'parrot', icon: '🦜', map: 'tropical-coast', seg: 680, x: 0.8 },
  { id: 'turtle', icon: '🐢', map: 'tropical-coast', seg: 1600, x: -0.8 },
  { id: 'hedgehog', icon: '🦔', map: 'autumn-woods', seg: 400, x: -0.8 },
  { id: 'squirrel', icon: '🐿️', map: 'autumn-woods', seg: 1450, x: 0.8 },
  { id: 'deer', icon: '🦌', map: 'autumn-woods', seg: 2350, x: -0.8 },
  { id: 'unicorn', icon: '🦄', map: 'candy-land', seg: 450, x: 0.8 },
  { id: 'teddy', icon: '🧸', map: 'candy-land', seg: 1200, x: -0.8 },
  { id: 'bee', icon: '🐝', map: 'candy-land', seg: 2100, x: 0.8 },
  // On the island the world decides where each one lives (near its area's
  // landmark); `area` is the kind of place, `model` the 3D animal.
  { id: 'island-bunny', icon: '🐇', map: 'island', area: 'meadow', model: 'bunny' },
  { id: 'island-owl', icon: '🦉', map: 'island', area: 'forest', model: 'owl' },
  { id: 'island-camel', icon: '🐪', map: 'island', area: 'desert', model: 'camel' },
  { id: 'island-penguin', icon: '🐧', map: 'island', area: 'snow', model: 'penguin' },
  { id: 'island-crab', icon: '🦀', map: 'island', area: 'beach', model: 'crab' },
];

export const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

/** Points for finding an animal for the first time. */
export const ANIMAL_POINTS = 500;
