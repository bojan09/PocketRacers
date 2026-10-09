// Vehicle definitions. Handling values are in sim units (240 units = 1 m):
// lateral position `x` is normalised so |x| = 1 is the road edge.
// `model` describes the low-poly body (see render3d/carModel.js): body and
// cabin stations are [z, halfWidth, (bottomHalfWidth,) yBottom, yTop] in metres.

export const CARS = {
  zippy: {
    id: 'zippy',
    name: 'Zippy GT',
    widthWorld: 520, // collision width
    lengthWorld: 1000, // collision length along the track
    handling: {
      maxSpeed: 12000, // ~180 km/h on the HUD
      accel: 5200,
      brake: 15000,
      coastDecel: 2400,
      reverseMax: 2800,
      reverseAccel: 4000,
      steerSpeed: 2.3, // lateral x / s at full lock
      steerRamp: 4.5, // how fast digital steering reaches full lock (1/s)
      steerReturn: 9, // how fast steering recentres (1/s)
      grip: 10, // lateral velocity convergence rate (1/s)
      centrifugal: 0.28, // outward push in curves
      nitroAccel: 1.8,
      nitroTop: 1.38,
      offroadTop: 0.45,
      offroadDecel: 9000,
      offroadGrip: 0.55,
    },
    model: {
      body: [
        [-2.15, 0.78, 0.72, 0.26, 0.56],
        [-1.95, 0.9, 0.84, 0.22, 0.7],
        [-1.3, 0.94, 0.88, 0.2, 0.78],
        [-0.6, 0.96, 0.9, 0.2, 0.84],
        [0.6, 0.97, 0.9, 0.2, 0.86],
        [1.5, 0.95, 0.9, 0.22, 0.88],
        [2.0, 0.9, 0.84, 0.26, 0.86],
        [2.15, 0.84, 0.78, 0.3, 0.8],
      ],
      cabin: [
        [-0.78, 0.8, 0.83, 0.85],
        [-0.12, 0.72, 0.85, 1.24],
        [0.72, 0.7, 0.86, 1.24],
        [1.58, 0.8, 0.87, 0.89],
      ],
      stripeHalf: 0.17,
      spoiler: { z: 1.95, y: 1.02, w: 0.82, d: 0.18 },
      wheels: {
        radius: 0.34,
        width: 0.27,
        rimStyle: 'spokes',
        positions: [
          [-0.84, -1.36],
          [0.84, -1.36],
          [-0.84, 1.32],
          [0.84, 1.32],
        ],
      },
    },
    paint: {
      body: '#ff4d5e',
      accent: '#ffd23f',
      stripe: '#ffffff',
      rim: '#dfe7f0',
      tire: '#23262d',
      glass: '#1f2b45',
    },
  },
};

/** Practice-traffic body styles. */
export const TRAFFIC_MODELS = {
  hatch: {
    body: [
      [-1.9, 0.78, 0.74, 0.28, 0.62],
      [-1.7, 0.86, 0.82, 0.24, 0.76],
      [-1.0, 0.88, 0.84, 0.22, 0.84],
      [0.5, 0.9, 0.86, 0.22, 0.88],
      [1.7, 0.88, 0.84, 0.24, 0.9],
      [1.9, 0.84, 0.8, 0.28, 0.88],
    ],
    cabin: [
      [-0.85, 0.78, 0.85, 0.87],
      [-0.3, 0.72, 0.87, 1.45],
      [1.45, 0.72, 0.88, 1.45],
      [1.85, 0.76, 0.88, 0.95],
    ],
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
      [-2.3, 0.9, 0.86, 0.3, 0.7],
      [-2.1, 0.98, 0.95, 0.26, 0.95],
      [-1.4, 1.0, 0.96, 0.26, 1.05],
      [2.2, 1.0, 0.96, 0.26, 1.08],
      [2.35, 0.96, 0.92, 0.3, 1.05],
    ],
    cabin: [
      [-1.4, 0.95, 1.05, 1.07],
      [-0.85, 0.9, 1.07, 1.92],
      [2.2, 0.92, 1.08, 1.92],
      [2.33, 0.92, 1.05, 1.86],
    ],
    stripes: false,
    wheels: {
      radius: 0.36,
      width: 0.26,
      rimStyle: 'disc',
      positions: [
        [-0.86, -1.55],
        [0.86, -1.55],
        [-0.86, 1.6],
        [0.86, 1.6],
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
