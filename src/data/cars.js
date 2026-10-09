// Vehicle definitions. Handling values are in sim units (240 units = 1 m):
// lateral position `x` is normalised so |x| = 1 is the road edge.
// `model` describes the body (see render3d/carModel.js) in metres.

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
      // [z, halfWidth, yBottom, yTop, roundness] front to back.
      body: [
        [-2.22, 0.7, 0.3, 0.56, 3],
        [-2.12, 0.86, 0.24, 0.64, 4],
        [-1.82, 0.93, 0.21, 0.71, 4.5],
        [-1.2, 0.96, 0.2, 0.78, 5],
        [-0.6, 0.97, 0.2, 0.84, 5],
        [0.2, 0.97, 0.2, 0.86, 5],
        [1.0, 0.99, 0.21, 0.88, 5],
        [1.6, 0.97, 0.22, 0.9, 5],
        [2.02, 0.92, 0.25, 0.88, 4.5],
        [2.22, 0.8, 0.32, 0.83, 3],
      ],
      // [z, halfWidthBottom, halfWidthTop, yBottom, yTop]; strips between
      // stations: windscreen, front window, B-pillar, rear window, back glass.
      cabin: [
        [-0.8, 0.74, 0.7, 0.8, 0.82],
        [-0.1, 0.74, 0.58, 0.82, 1.22],
        [0.32, 0.75, 0.6, 0.83, 1.25],
        [0.44, 0.75, 0.6, 0.83, 1.25],
        [0.95, 0.75, 0.58, 0.84, 1.22],
        [1.66, 0.76, 0.66, 0.86, 0.89],
      ],
      bPillar: 2,
      stripeHalf: 0.17,
      spoiler: { z: 1.98, y: 1.03, w: 0.84, d: 0.18 },
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
