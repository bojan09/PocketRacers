// Vehicle families. Each family is a body template (a function returning a
// model in metres, see render3d/carModel.js), a handling profile and an
// engine sound profile. Vehicles in data/vehicles.js are variants of a
// family: options, size scaling and stat tweaks, so the roster can grow to
// dozens of vehicles as data.

// Base handling (sim units, 240 units = 1 m; lateral x normalised to the
// road half-width). Families override what makes them feel different.
const BASE_HANDLING = {
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
  jumpBoost: 1, // launch speed multiplier off ramps
};

const wheels4 = (x, zf, zr, radius, width, extra = {}) => ({
  radius,
  width,
  positions: [
    [-x, zf],
    [x, zf],
    [-x, zr],
    [x, zr],
  ],
  ...extra,
});

/** Open pickup bed: dark liner, side rails, front wall and tailgate. */
function pickupBed(z0, z1, top, hw) {
  const zc = (z0 + z1) / 2;
  const hz = (z1 - z0) / 2;
  return [
    { box: [0, top + 0.004, zc, hw - 0.06, 0.004, hz], paint: 'dark' },
    { box: [hw - 0.03, top + 0.07, zc, 0.05, 0.07, hz], paint: 'body', mirror: true },
    { box: [0, top + 0.07, z0 + 0.04, hw, 0.07, 0.04], paint: 'body' },
    { box: [0, top + 0.07, z1 - 0.04, hw, 0.07, 0.04], paint: 'body' },
  ];
}

/** Roof light bar: dark beam with four bright lamps. */
function lightBar(y, z, hw) {
  const parts = [{ box: [0, y, z, hw, 0.04, 0.05], paint: 'dark' }];
  for (let i = 0; i < 4; i++) parts.push({ box: [(-1.5 + i) * hw * 0.5, y + 0.005, z - 0.05, hw * 0.18, 0.03, 0.01], paint: 'light', emissive: 0.9 });
  return parts;
}

export const FAMILIES = {
  // ------------------------------------------------------------------ race
  race: {
    label: 'Race',
    engine: 'v10',
    camera: 1,
    handling: { maxSpeed: 14000, accel: 6200, grip: 12, steerSpeed: 2.5, centrifugal: 0.3, nitroTop: 1.4, offroadTop: 0.35, offroadGrip: 0.45 },
    build: (o = {}) => ({
      body: [
        [-2.4, 0.74, 0.12, 0.3, 2.5],
        [-2.25, 0.93, 0.1, 0.4, 3],
        [-1.8, 0.98, 0.1, 0.52, 4],
        [-1.2, 0.98, 0.1, 0.62, 4.5],
        [-0.6, 0.93, 0.1, 0.62, 5],
        [0.2, 0.95, 0.1, 0.66, 5],
        [1.0, 1.0, 0.12, 0.74, 5],
        [1.8, 1.0, 0.14, 0.78, 5],
        [2.3, 0.95, 0.18, 0.76, 4],
        [2.42, 0.84, 0.24, 0.7, 3],
      ],
      cabin: [
        [-0.95, 0.52, 0.46, 0.6, 0.63],
        [-0.45, 0.56, 0.38, 0.62, 1.0],
        [0.15, 0.57, 0.4, 0.64, 1.06],
        [0.27, 0.57, 0.4, 0.64, 1.06],
        [0.9, 0.56, 0.38, 0.68, 0.98],
        [1.65, 0.52, 0.34, 0.72, 0.78],
      ],
      bPillar: 2,
      stripeHalf: 0.22,
      spoiler: o.wing === false ? { type: 'lip', z: 2.32, y: 0.8, w: 0.9, d: 0.14 } : { z: 2.2, y: 1.12, w: 0.98, d: 0.34, post: 0.17, plate: 0.14 },
      parts: [
        // Shark fin, front splitter and side intakes.
        { box: [0, 0.92, 1.55, 0.012, 0.16, 0.6], paint: 'body', top: 0.6 },
        { box: [0, 0.11, -2.3, 0.96, 0.015, 0.14], paint: 'dark' },
        { box: [0.97, 0.42, 0.55, 0.035, 0.12, 0.3], paint: 'dark', mirror: true },
      ],
      wheels: wheels4(0.86, -1.55, 1.45, 0.36, 0.32, { rimStyle: 'star' }),
    }),
  },

  // ---------------------------------------------------------------- sports
  sports: {
    label: 'Sports',
    engine: 'flat6',
    camera: 1,
    handling: { maxSpeed: 13000, accel: 5600 },
    build: (o = {}) => ({
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
      spoiler: o.lip ? { type: 'lip', z: 2.08, y: 0.92, w: 0.82, d: 0.14 } : { z: 1.98, y: 1.03, w: 0.84, d: 0.18 },
      wheels: wheels4(0.84, -1.36, 1.32, 0.34, 0.27, { rimStyle: 'spokes' }),
    }),
  },

  // ---------------------------------------------------------------- muscle
  muscle: {
    label: 'Muscle',
    engine: 'v8',
    camera: 1.05,
    handling: { maxSpeed: 13200, accel: 6200, grip: 8, steerSpeed: 2.15, centrifugal: 0.33, nitroAccel: 2 },
    build: (o = {}) => ({
      body: [
        [-2.45, 0.82, 0.3, 0.62, 3.5],
        [-2.36, 0.94, 0.26, 0.74, 5],
        [-1.6, 0.98, 0.24, 0.8, 6],
        [-0.6, 0.99, 0.24, 0.82, 6],
        [0.4, 1.0, 0.24, 0.84, 6],
        [1.4, 1.0, 0.25, 0.86, 6],
        [2.2, 0.97, 0.27, 0.86, 5],
        [2.45, 0.9, 0.3, 0.84, 4],
      ],
      cabin: [
        [-0.4, 0.78, 0.72, 0.84, 0.86],
        [0.25, 0.78, 0.6, 0.86, 1.3],
        [0.7, 0.79, 0.62, 0.87, 1.32],
        [0.82, 0.79, 0.62, 0.87, 1.32],
        [1.3, 0.8, 0.62, 0.87, 1.24],
        [2.1, 0.8, 0.7, 0.87, 0.9],
      ],
      bPillar: 2,
      stripeHalf: 0.24,
      spoiler: { type: 'lip', z: 2.32, y: 0.9, w: 0.9, d: 0.12 },
      parts: [
        // Hood scoop (or a blower for the wild version).
        o.blower
          ? { box: [0, 0.98, -1.15, 0.24, 0.16, 0.3], paint: 'chrome', top: 0.85 }
          : { box: [0, 0.855, -1.2, 0.26, 0.05, 0.38], paint: 'body', top: 0.8 },
        { box: [0, o.blower ? 1.12 : 0.875, o.blower ? -1.3 : -1.57, 0.2, 0.03, 0.012], paint: 'dark' },
      ],
      wheels: wheels4(0.86, -1.5, 1.45, 0.36, 0.3, { rimStyle: 'disc' }),
    }),
  },

  // ----------------------------------------------------------------- hatch
  hatch: {
    label: 'Hatch',
    engine: 'i4',
    camera: 0.95,
    handling: { maxSpeed: 11200, accel: 5300, grip: 11.5, steerSpeed: 2.55, centrifugal: 0.26 },
    build: () => ({
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
      stripeHalf: 0.18,
      spoiler: { type: 'lip', z: 1.48, y: 1.43, w: 0.62, d: 0.14 },
      wheels: wheels4(0.8, -1.2, 1.2, 0.32, 0.24, { rimStyle: 'star' }),
    }),
  },

  // ------------------------------------------------------------------ jeep
  jeep: {
    label: 'Jeep',
    engine: 'v6',
    camera: 1.08,
    handling: { maxSpeed: 10800, accel: 4900, grip: 8.5, steerSpeed: 2.2, centrifugal: 0.3, offroadTop: 0.82, offroadGrip: 0.9, offroadDecel: 5000, jumpBoost: 1.1 },
    build: (o = {}) => ({
      body: [
        [-2.1, 0.8, 0.62, 1.04, 6],
        [-2.02, 0.9, 0.56, 1.18, 8],
        [-1.2, 0.92, 0.55, 1.22, 8],
        [0.0, 0.93, 0.55, 1.24, 8],
        [1.92, 0.93, 0.55, 1.24, 8],
        [2.05, 0.88, 0.58, 1.2, 7],
      ],
      cabin: [
        [-0.75, 0.86, 0.84, 1.22, 1.24],
        [-0.48, 0.86, 0.8, 1.24, 1.95],
        [0.35, 0.87, 0.8, 1.24, 1.97],
        [0.47, 0.87, 0.8, 1.24, 1.97],
        [1.86, 0.88, 0.8, 1.24, 1.97],
        [2.0, 0.88, 0.82, 1.24, 1.93],
      ],
      cabinShape: [0.35, 0.3],
      bPillar: 2,
      stripeHalf: 0.2,
      parts: [
        // Spare wheel, bull bar, fender flares, side steps.
        { cyl: [0, 1.0, 2.2, 0.38, 0.12, 'z'], paint: 'tire', cap: 'rim', sides: 16 },
        { box: [0, 0.72, -2.16, 0.72, 0.05, 0.04], paint: 'dark' },
        { box: [0.42, 0.86, -2.15, 0.04, 0.2, 0.04], paint: 'dark', mirror: true },
        { box: [0.95, 0.5, 0, 0.07, 0.025, 0.8], paint: 'dark', mirror: true },
        ...(o.lightBar
          ? lightBar(2.04, -0.35, 0.62)
          : [
              { box: [0, 2.04, 0.7, 0.66, 0.02, 0.85], paint: 'dark' },
              { box: [0.62, 2.0, 0.7, 0.03, 0.04, 0.8], paint: 'dark', mirror: true },
            ]),
      ],
      exhausts: [[0.5, 0.55, 2.1]],
      trailY: 0.9,
      wheels: wheels4(0.86, -1.35, 1.3, 0.42, 0.32, { rimStyle: 'steel', tread: 'offroad' }),
    }),
  },

  // ------------------------------------------------------------------- suv
  suv: {
    label: 'SUV',
    engine: 'v6',
    camera: 1.1,
    handling: { maxSpeed: 11400, accel: 4800, grip: 9, steerSpeed: 2.15, centrifugal: 0.3, offroadTop: 0.7, offroadGrip: 0.8, offroadDecel: 6000 },
    build: () => ({
      body: [
        [-2.35, 0.82, 0.45, 0.8, 3.5],
        [-2.25, 0.95, 0.42, 0.95, 5],
        [-1.5, 0.98, 0.4, 1.05, 6],
        [0, 0.99, 0.4, 1.1, 6],
        [1.8, 0.98, 0.42, 1.12, 6],
        [2.3, 0.93, 0.45, 1.1, 5],
        [2.38, 0.85, 0.5, 1.05, 4],
      ],
      cabin: [
        [-1.2, 0.88, 0.82, 1.05, 1.08],
        [-0.55, 0.88, 0.72, 1.08, 1.66],
        [0.25, 0.89, 0.74, 1.1, 1.7],
        [0.37, 0.89, 0.74, 1.1, 1.7],
        [1.9, 0.9, 0.74, 1.12, 1.68],
        [2.28, 0.9, 0.78, 1.12, 1.3],
      ],
      bPillar: 2,
      stripeHalf: 0.2,
      spoiler: { type: 'lip', z: 2.12, y: 1.69, w: 0.7, d: 0.14 },
      parts: [
        { box: [0.6, 1.72, 0.55, 0.03, 0.025, 1.05], paint: 'dark', mirror: true },
        { box: [0.6, 1.7, -0.4, 0.035, 0.03, 0.06], paint: 'dark', mirror: true },
        { box: [0.6, 1.7, 1.5, 0.035, 0.03, 0.06], paint: 'dark', mirror: true },
        { box: [0, 0.5, -2.32, 0.6, 0.06, 0.05], paint: 'chrome' },
      ],
      trailY: 0.7,
      wheels: wheels4(0.86, -1.45, 1.45, 0.4, 0.3, { rimStyle: 'spokes' }),
    }),
  },

  // ---------------------------------------------------------------- pickup
  pickup: {
    label: 'Pickup',
    engine: 'v8truck',
    camera: 1.12,
    handling: { maxSpeed: 11200, accel: 4900, grip: 8.5, steerSpeed: 2.1, centrifugal: 0.3, offroadTop: 0.72, offroadGrip: 0.8, offroadDecel: 6000 },
    build: (o = {}) => ({
      body: [
        [-2.6, 0.85, 0.5, 0.95, 4],
        [-2.5, 0.96, 0.45, 1.08, 6],
        [-1.6, 0.99, 0.45, 1.12, 7],
        [0, 1.0, 0.45, 1.14, 7],
        [2.45, 1.0, 0.45, 1.14, 7],
        [2.6, 0.96, 0.48, 1.1, 6],
      ],
      cabin: [
        [-0.95, 0.9, 0.85, 1.12, 1.14],
        [-0.55, 0.9, 0.78, 1.14, 1.75],
        [0.1, 0.9, 0.78, 1.14, 1.77],
        [0.22, 0.9, 0.78, 1.14, 1.77],
        [0.55, 0.9, 0.78, 1.14, 1.77],
        [0.66, 0.9, 0.8, 1.14, 1.72],
      ],
      cabinShape: [0.45, 0.35],
      cabinStrips: ['wind', 'side', 'solid', 'side', 'rear'],
      stripeHalf: 0.22,
      parts: [
        ...pickupBed(0.72, 2.52, 1.14, 0.97),
        { box: [0, 0.52, -2.58, 0.9, 0.08, 0.06], paint: 'chrome' },
        ...(o.lightBar ? lightBar(1.83, -0.35, 0.7) : []),
      ],
      trailY: 0.85,
      wheels: o.lifted
        ? wheels4(0.92, -1.65, 1.55, 0.5, 0.38, { rimStyle: 'steel', tread: 'offroad' })
        : wheels4(0.88, -1.65, 1.55, 0.4, 0.3, { rimStyle: 'disc' }),
    }),
  },

  // --------------------------------------------------------------- monster
  monster: {
    label: 'Monster',
    engine: 'monster',
    camera: 1.3,
    handling: { maxSpeed: 10800, accel: 5400, grip: 7.5, steerSpeed: 2.05, centrifugal: 0.3, offroadTop: 0.92, offroadGrip: 1, offroadDecel: 3500, jumpBoost: 1.3 },
    build: () => {
      const lift = 0.95;
      const up = (s) => s.map(([z, hw, yb, yt, n]) => [z * 0.86, hw * 0.96, yb + lift, yt + lift, n]);
      const upC = (s) => s.map(([z, a, b, yb, yt]) => [z * 0.86, a * 0.96, b * 0.96, yb + lift, yt + lift]);
      const parts = [
        // Chassis rails, axles, springs and shocks.
        { box: [0.5, 1.05, 0, 0.07, 0.09, 2.0], paint: 'dark', mirror: true },
        { cyl: [0, 0.85, -1.45, 0.1, 1.05, 'x'], paint: 'dark' },
        { cyl: [0, 0.85, 1.5, 0.1, 1.05, 'x'], paint: 'dark' },
        ...pickupBed(0.62, 2.17, 1.14 + lift, 0.93),
        ...lightBar(1.8 + lift, -0.3, 0.65),
        { box: [0, 1.5, -2.25, 0.85, 0.08, 0.06], paint: 'chrome' },
      ];
      for (const z of [-1.45, 1.5]) {
        for (const dz of [-0.32, 0.32]) {
          parts.push({ cyl: [0.62, 1.2, z + dz, 0.09, 0.32, 'y'], paint: 'accent', mirror: true, sides: 10 });
          parts.push({ cyl: [0.62, 1.2, z + dz, 0.04, 0.4, 'y'], paint: 'chrome', mirror: true, sides: 8 });
        }
      }
      const pickup = FAMILIES.pickup.build();
      return {
        body: up(pickup.body),
        cabin: upC(pickup.cabin),
        cabinShape: pickup.cabinShape,
        cabinStrips: pickup.cabinStrips,
        stripeHalf: 0.22,
        arches: false,
        parts,
        exhausts: [
          [-0.45, 1.5, 2.3],
          [0.45, 1.5, 2.3],
        ],
        trailY: 1.6,
        wheels: wheels4(1.45, -1.45, 1.5, 0.85, 0.7, { rimStyle: 'steel', tread: 'offroad', maxSteer: 0.25 }),
      };
    },
  },

  // ----------------------------------------------------------------- truck
  truck: {
    label: 'Truck',
    engine: 'diesel',
    camera: 1.55,
    handling: { maxSpeed: 10000, accel: 3400, brake: 11000, grip: 7, steerSpeed: 1.75, steerRamp: 3.8, centrifugal: 0.24, nitroAccel: 2.3, nitroTop: 1.35, offroadTop: 0.5 },
    build: () => {
      const parts = [
        // Bumper, grille bars, sun visor, roof deflector.
        { box: [0, 0.68, -4.18, 1.22, 0.27, 0.12], paint: 'trim' },
        { box: [0, 1.5, -4.27, 0.82, 0.36, 0.02], paint: 'dark' },
        { box: [0, 2.99, -4.1, 1.15, 0.04, 0.14], paint: 'body' },
        { box: [0, 3.32, -2.85, 1.15, 0.32, 0.62], paint: 'body', top: 0.85 },
        // Cargo box with a stripe band, rear doors and bumper.
        { box: [0, 2.43, 1.15, 1.27, 1.27, 3.1], paint: 'accent', mat: 'paint' },
        { box: [0, 1.72, 1.15, 1.278, 0.13, 3.06], paint: 'stripe' },
        { box: [0, 2.43, 4.256, 0.012, 1.2, 0.004], paint: 'dark' },
        { box: [0.3, 2.2, 4.26, 0.02, 0.5, 0.01], paint: 'chrome', mirror: true },
        { box: [0, 0.75, 4.2, 1.15, 0.12, 0.08], paint: 'trim' },
        { box: [0, 0.75, 4.285, 0.25, 0.08, 0.005], paint: [0.96, 0.96, 0.92] },
        // Side skirts between the axles.
        { box: [1.19, 0.7, -0.65, 0.04, 0.22, 1.95], paint: 'trim', mirror: true },
        // Exhaust stack behind the cab.
        { cyl: [1.02, 2.45, -2.02, 0.08, 1.0, 'y'], paint: 'chrome', cap: 'dark' },
        // Amber roof marker lights.
        ...[-0.6, -0.2, 0.2, 0.6].map((x) => ({ box: [x, 3.01, -4.2, 0.07, 0.03, 0.02], paint: 'amber', emissive: 0.9 })),
      ];
      for (let k = 0; k < 5; k++) parts.push({ box: [0, 1.22 + k * 0.14, -4.295, 0.78, 0.016, 0.008], paint: 'chrome' });
      return {
        body: [
          [-4.3, 1.2, 0.95, 1.2, 6],
          [-4.22, 1.25, 0.93, 1.22, 8],
          [4.22, 1.25, 0.93, 1.22, 8],
          [4.3, 1.2, 0.95, 1.2, 6],
        ],
        lofts: [
          {
            stations: [
              [-4.27, 1.2, 1.0, 1.95, 5],
              [-4.18, 1.25, 0.97, 1.98, 8],
              [-2.2, 1.25, 0.97, 1.98, 8],
              [-2.14, 1.2, 1.0, 1.95, 5],
            ],
          },
        ],
        cabin: [
          [-4.18, 1.22, 1.18, 1.96, 1.98],
          [-4.07, 1.22, 1.17, 1.97, 2.95],
          [-3.35, 1.23, 1.18, 1.97, 3.0],
          [-3.22, 1.23, 1.18, 1.97, 3.0],
          [-2.22, 1.23, 1.18, 1.97, 3.0],
          [-2.16, 1.22, 1.18, 1.96, 2.96],
        ],
        cabinShape: [0.25, 0.2],
        cabinStrips: ['wind', 'side', 'solid', 'solid', 'solid'],
        mirrors: 'truck',
        parts,
        stripeHalf: 0.3,
        arches: false,
        grille: false,
        rearKit: false,
        lights: { fy: 0.78, fz: -4.31, fx: 0.85, fw: 0.2, ry: 0.78, rz: 4.29, rx: 0.9, rearBar: false },
        exhausts: [[1.02, 3.5, -2.02]],
        trailY: 1.6,
        height: 3.7,
        wheels: {
          radius: 0.5,
          width: 0.42,
          rimStyle: 'steel',
          positions: [
            [-1.0, -3.3],
            [1.0, -3.3],
            [-1.0, 2.0],
            [1.0, 2.0],
            [-1.0, 3.05],
            [1.0, 3.05],
          ],
        },
      };
    },
  },
};

export const FAMILY_ORDER = ['race', 'sports', 'muscle', 'hatch', 'jeep', 'suv', 'pickup', 'monster', 'truck'];

export function familyHandling(family, tweak = {}) {
  return { ...BASE_HANDLING, ...FAMILIES[family].handling, ...tweak };
}

/** Uniformly scale a model (sx width, sy height, sz length); wheels keep their size unless given. */
export function scaleModel(m, [sx, sy, sz]) {
  if (sx === 1 && sy === 1 && sz === 1) return m;
  const st = (s) => s.map(([z, hw, yb, yt, n]) => [z * sz, hw * sx, yb * sy, yt * sy, n]);
  const sc = (s) => s.map(([z, a, b, yb, yt]) => [z * sz, a * sx, b * sx, yb * sy, yt * sy]);
  const part = (p) => {
    if (p.box) {
      const [x, y, z, hx, hy, hz] = p.box;
      return { ...p, box: [x * sx, y * sy, z * sz, hx * sx, hy * sy, hz * sz] };
    }
    const [x, y, z, r, h, axis] = p.cyl;
    return { ...p, cyl: [x * sx, y * sy, z * sz, r, axis === 'x' ? h * sx : axis === 'y' ? h * sy : h * sz, axis] };
  };
  return {
    ...m,
    body: st(m.body),
    cabin: m.cabin && sc(m.cabin),
    lofts: m.lofts && m.lofts.map((l) => ({ ...l, stations: st(l.stations) })),
    parts: m.parts && m.parts.map(part),
    spoiler: m.spoiler && { ...m.spoiler, z: m.spoiler.z * sz, y: m.spoiler.y * sy, w: m.spoiler.w * sx },
    exhausts: m.exhausts && m.exhausts.map(([x, y, z]) => [x * sx, y * sy, z * sz]),
    wheels: { ...m.wheels, positions: m.wheels.positions.map(([x, z]) => [x * sx, z * sz]) },
  };
}
