// Practice-traffic body styles and paints. Player vehicles live in
// data/vehicles.js.

/** Practice-traffic body styles. */
export const TRAFFIC_MODELS = {
  hatch: {
    body: [
      [-1.92, 0.72, 0.3, 0.6, 3],
      [-1.8, 0.85, 0.25, 0.7, 4],
      [-1.2, 0.9, 0.23, 0.82, 5],
      [0.4, 0.92, 0.23, 0.88, 5],
      [1.6, 0.9, 0.25, 0.9, 5],
      [1.9, 0.82, 0.3, 0.88, 3.5],
    ],
    cabin: [
      [-0.95, 0.74, 0.7, 0.84, 0.86],
      [-0.35, 0.74, 0.62, 0.86, 1.42],
      [0.25, 0.75, 0.63, 0.87, 1.44],
      [0.36, 0.75, 0.63, 0.87, 1.44],
      [1.5, 0.76, 0.64, 0.88, 1.42],
      [1.86, 0.76, 0.68, 0.88, 0.95],
    ],
    bPillar: 2,
    stripes: false,
    wheels: {
      radius: 0.31,
      width: 0.23,
      rimStyle: 'disc',
      positions: [
        [-0.8, -1.2],
        [0.8, -1.2],
        [-0.8, 1.2],
        [0.8, 1.2],
      ],
    },
  },
  van: {
    body: [
      [-2.35, 0.86, 0.32, 0.72, 3],
      [-2.18, 0.97, 0.27, 0.96, 4],
      [-1.5, 1.0, 0.26, 1.06, 6],
      [2.2, 1.0, 0.26, 1.08, 6],
      [2.36, 0.94, 0.3, 1.05, 4],
    ],
    cabin: [
      [-1.5, 0.92, 0.88, 1.02, 1.05],
      [-0.95, 0.92, 0.84, 1.04, 1.92],
      [-0.2, 0.93, 0.85, 1.05, 1.94],
      [-0.08, 0.93, 0.85, 1.05, 1.94],
      [2.15, 0.94, 0.86, 1.06, 1.94],
      [2.3, 0.94, 0.86, 1.04, 1.88],
    ],
    bPillar: 2,
    stripes: false,
    wheels: {
      radius: 0.36,
      width: 0.26,
      rimStyle: 'disc',
      positions: [
        [-0.88, -1.55],
        [0.88, -1.55],
        [-0.88, 1.6],
        [0.88, 1.6],
      ],
    },
  },
};

/** Paint jobs for practice traffic, paired with a body style. */
export const TRAFFIC_PAINTS = [
  { model: 'hatch', body: '#3a86ff', accent: '#ffffff', stripe: '#ffd23f' },
  { model: 'van', body: '#f4f1e8', accent: '#2ec4b6', stripe: '#2ec4b6' },
  { model: 'hatch', body: '#ffbe0b', accent: '#1b1f3b', stripe: '#ff006e' },
  { model: 'hatch', body: '#8338ec', accent: '#ffd23f', stripe: '#ffffff' },
  { model: 'van', body: '#fb5607', accent: '#ffffff', stripe: '#1b1f3b' },
  { model: 'hatch', body: '#06d6a0', accent: '#1b1f3b', stripe: '#ffffff' },
].map((p) => ({ rim: '#c9d3de', tire: '#23262d', glass: '#24324f', ...p }));
