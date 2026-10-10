// Smashable props just off the road: small things worth points when a car
// knocks them flying. Big scenery (trees, rocks, houses) stays solid.

/** Which props each map scatters along its verges. */
export const PROP_KINDS = {
  'sunny-valley': ['hay', 'fence', 'crate', 'mailbox'],
  'desert-canyon': ['barrel', 'crate', 'fence', 'drum'],
  'snowy-peaks': ['gift', 'crate', 'barrel'],
  'night-city': ['bin', 'cone', 'crate', 'drum'],
  'tropical-coast': ['ball', 'crate', 'barrel'],
  'autumn-woods': ['pumpkin', 'hay', 'crate', 'fence'],
  'candy-land': ['donut', 'cupcake', 'gift', 'ball'],
};

/** Half-size across the road (metres), for hits. */
export const PROP_SIZE = { hay: 0.6, fence: 0.15, crate: 0.45, barrel: 0.35, drum: 0.35, mailbox: 0.2, gift: 0.4, bin: 0.35, ball: 0.45, cone: 0.3, pumpkin: 0.4, donut: 0.45, cupcake: 0.35 };

export const PROP_POINTS = 60;
