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

/** Open-wheel formula racer: narrow body, sidepods, exposed wheels, two wings. */
function formulaCar() {
  const pod = (x) => ({
    x,
    stations: [
      [-0.45, 0.14, 0.16, 0.46, 3],
      [-0.1, 0.22, 0.14, 0.56, 5],
      [0.7, 0.21, 0.15, 0.54, 5],
      [1.05, 0.12, 0.18, 0.42, 3],
    ],
  });
  return {
    body: [
      [-2.55, 0.16, 0.13, 0.28, 3],
      [-2.25, 0.24, 0.12, 0.35, 3.5],
      [-1.4, 0.32, 0.12, 0.45, 4],
      [-0.6, 0.4, 0.12, 0.6, 4],
      [0.3, 0.44, 0.12, 0.66, 4],
      [1.2, 0.38, 0.14, 0.62, 4],
      [2.0, 0.28, 0.16, 0.5, 3.5],
      [2.35, 0.2, 0.2, 0.42, 3],
    ],
    lofts: [pod(0.52), pod(-0.52)],
    cabin: [
      [-0.55, 0.3, 0.26, 0.58, 0.6],
      [-0.25, 0.3, 0.24, 0.6, 0.82],
      [0.25, 0.3, 0.22, 0.62, 0.88],
      [0.4, 0.3, 0.22, 0.62, 0.88],
      [0.75, 0.3, 0.22, 0.62, 0.82],
      [1.15, 0.28, 0.2, 0.6, 0.66],
    ],
    cabinStrips: ['wind', 'side', 'solid', 'solid', 'solid'],
    mirrors: false,
    stripeHalf: 0.12,
    arches: false,
    grille: false,
    rearKit: false,
    lights: { fy: 0.24, fx: 0.12, fw: 0.05, ry: 0.4, rx: 0.12, rearBar: false },
    spoiler: { z: 2.2, y: 0.98, w: 0.72, d: 0.3, post: 0.2, plate: 0.16 },
    parts: [
      // Front wing with end plates, suspension arms.
      { box: [0, 0.13, -2.45, 0.96, 0.02, 0.18], paint: 'accent' },
      { box: [0.95, 0.19, -2.45, 0.015, 0.08, 0.2], paint: 'accent', mirror: true },
      { box: [0.43, 0.36, -1.75, 0.15, 0.015, 0.03], paint: 'dark', mirror: true },
      { box: [0.43, 0.36, 1.55, 0.15, 0.015, 0.03], paint: 'dark', mirror: true },
    ],
    exhausts: [[0, 0.36, 2.4]],
    trailY: 0.4,
    wheels: wheels4(0.84, -1.75, 1.55, 0.36, 0.36, { rimStyle: 'star' }),
  };
}

/** Low wedge supercar: sharp nose, cab-forward glasshouse, big wing. */
function wedgeCar() {
  return {
    body: [
      [-2.3, 0.74, 0.24, 0.42, 3],
      [-2.18, 0.9, 0.2, 0.5, 4],
      [-1.6, 0.96, 0.2, 0.62, 5],
      [-0.8, 0.98, 0.2, 0.72, 5],
      [0.3, 0.99, 0.2, 0.8, 5],
      [1.2, 1.0, 0.22, 0.84, 5],
      [1.9, 0.98, 0.24, 0.84, 5],
      [2.25, 0.88, 0.3, 0.8, 4],
    ],
    cabin: [
      [-1.0, 0.76, 0.7, 0.7, 0.72],
      [-0.2, 0.76, 0.56, 0.74, 1.12],
      [0.35, 0.77, 0.58, 0.78, 1.14],
      [0.47, 0.77, 0.58, 0.78, 1.14],
      [1.0, 0.77, 0.56, 0.8, 1.06],
      [1.8, 0.78, 0.66, 0.84, 0.86],
    ],
    bPillar: 2,
    stripeHalf: 0.18,
    spoiler: { z: 2.0, y: 1.0, w: 0.88, d: 0.2 },
    wheels: wheels4(0.86, -1.4, 1.36, 0.34, 0.29, { rimStyle: 'spokes' }),
  };
}

/**
 * A mudguard arched over a wheel: curved segments (each a convex piece of
 * the arc) extruded across the tyre. Angles run from front (0) to back (1).
 */
function arcGuard(x, y, z, r, halfW, paint, a0 = 0.08, a1 = 0.92, segs = 10, thick = 0.06) {
  const parts = [];
  for (let k = 0; k < segs; k++) {
    const t0 = Math.PI * (1 - (a0 + ((a1 - a0) * k) / segs));
    const t1 = Math.PI * (1 - (a0 + ((a1 - a0) * (k + 1)) / segs));
    const pt = (t, rr) => [y + Math.sin(t) * rr, z + Math.cos(t) * rr];
    parts.push({ prism: [x, halfW, [pt(t0, r), pt(t1, r), pt(t1, r + thick), pt(t0, r + thick)]], paint, mirror: true });
  }
  return parts;
}

/**
 * Farm trailer towed by a tractor. Model space like a vehicle but the hitch
 * is at the origin and the bed runs backwards (+z) from it.
 */
function haywagon(load) {
  const parts = [
    // Drawbar to the hitch.
    { box: [0, 0.55, 0.4, 0.05, 0.05, 0.42], paint: 'dark' },
    { box: [0.3, 0.55, 0.62, 0.04, 0.04, 0.25], paint: 'dark', mirror: true },
    // Side boards.
    { box: [0.98, 1.0, 2.35, 0.03, 0.2, 1.62], paint: 'accent', mirror: true },
    { box: [0, 1.0, 3.96, 0.98, 0.2, 0.03], paint: 'accent' },
    { box: [0, 1.0, 0.74, 0.98, 0.2, 0.03], paint: 'accent' },
  ];
  if (load === 'hay') {
    const hay = [0.89, 0.71, 0.29];
    for (const zz of [1.2, 2.0, 2.8, 3.55])
      for (const x of [-0.45, 0.45]) parts.push({ cyl: [x, 1.18, zz, 0.36, 0.38, 'x'], paint: hay, cap: [0.95, 0.8, 0.42], sides: 14 });
    for (const zz of [1.6, 2.4, 3.2]) parts.push({ cyl: [0, 1.85, zz, 0.36, 0.38, 'x'], paint: hay, cap: [0.95, 0.8, 0.42], sides: 14 });
  } else {
    // Logs.
    const wood = [0.55, 0.36, 0.2];
    for (const [x, y] of [
      [-0.55, 1.08],
      [0, 1.08],
      [0.55, 1.08],
      [-0.27, 1.5],
      [0.27, 1.5],
      [0, 1.9],
    ])
      parts.push({ cyl: [x, y, 2.35, 0.24, 1.75, 'z'], paint: wood, cap: [0.86, 0.7, 0.45], sides: 10 });
  }
  return {
    body: [
      [0.72, 0.95, 0.62, 0.78, 6],
      [0.78, 1.0, 0.58, 0.82, 8],
      [3.92, 1.0, 0.58, 0.82, 8],
      [3.98, 0.95, 0.62, 0.78, 6],
    ],
    parts,
    arches: false,
    grille: false,
    rearKit: false,
    mirrors: false,
    stripes: false,
    exhausts: [],
    lights: { front: false, ry: 0.72, rz: 3.98, rx: 0.75, rearBar: false },
    wheels: {
      radius: 0.42,
      width: 0.26,
      positions: [
        [-0.82, 2.55],
        [0.82, 2.55],
      ],
      rimStyle: 'steel',
      tread: 'offroad',
      maxSteer: 0,
    },
    height: 2.3,
  };
}

/**
 * Articulated lorry: the truck's cab on a short chassis with a fifth wheel,
 * towing a semi-trailer (box, tanker, logs or a car carrier).
 */
function rigUnit(o) {
  const base = FAMILIES.truck.build({ ...o, cargo: 'none' });
  const parts = base.parts.filter((p) => {
    const z = p.box ? p.box[2] : p.cyl ? p.cyl[2] : 0;
    // Drop the rigid truck's rear bumper and long side skirts.
    return z < 1.0 && !(p.box && p.box[5] > 1.5);
  });
  parts.push(
    // Fifth-wheel coupling, rear bumper with lights, mudflaps.
    { box: [0, 1.3, 0.65, 0.55, 0.06, 0.55], paint: 'dark' },
    { cyl: [0, 1.38, 0.65, 0.22, 0.03, 'y'], paint: 'chrome' },
    { box: [0, 0.75, 1.92, 1.15, 0.12, 0.08], paint: 'trim' },
    { box: [1.12, 0.7, 1.8, 0.04, 0.32, 0.02], paint: 'dark', mirror: true },
    { box: [1.19, 0.7, -1.45, 0.04, 0.22, 0.7], paint: 'trim', mirror: true },
  );
  return {
    ...base,
    body: [
      [-4.3, 1.2, 0.95, 1.2, 6],
      [-4.22, 1.25, 0.93, 1.22, 8],
      [1.9, 1.25, 0.93, 1.22, 8],
      [1.98, 1.2, 0.95, 1.2, 6],
    ],
    parts,
    lights: { ...base.lights, rz: 2.0, ry: 0.78 },
    height: 3.7,
    wheels: {
      ...base.wheels,
      positions: [
        [-1.0, -3.3],
        [1.0, -3.3],
        [-1.0, 0.1],
        [1.0, 0.1],
        [-1.0, 1.15],
        [1.0, 1.15],
      ],
    },
    tow: { hitch: [1.36, 0.65], trailer: semiTrailer(o.load || 'box') },
  };
}

/** Semi-trailer: hitch (kingpin) at the origin, body running back to z = 10. */
function semiTrailer(load) {
  const front = -0.9;
  const rear = 10;
  const mid = (front + rear) / 2;
  const half = (rear - front) / 2;
  const parts = [
    // Landing legs and rear bumper.
    { box: [0.85, 0.75, 1.4, 0.06, 0.4, 0.06], paint: 'dark', mirror: true },
    { box: [0, 0.7, rear - 0.05, 1.15, 0.1, 0.06], paint: 'trim' },
    { box: [1.12, 0.65, rear - 0.12, 0.04, 0.3, 0.02], paint: 'dark', mirror: true },
  ];
  if (load === 'tanker') {
    parts.push(
      { cyl: [0, 2.35, mid + 0.2, 1.15, half - 0.25, 'z'], paint: 'accent', mat: 'chrome', sides: 18 },
      ...[1.0, mid + 0.2, rear - 0.6].map((z) => ({ cyl: [0, 2.35, z, 1.17, 0.07, 'z'], paint: 'stripe', sides: 18 })),
      ...[0.4, 3.5, 6.5, 9.3].map((z) => ({ box: [0, 1.35, z, 0.95, 0.12, 0.22], paint: 'dark' })),
      { box: [0, 3.55, mid, 0.18, 0.04, 3.5], paint: 'chrome' },
    );
  } else if (load === 'logs') {
    const wood = [0.55, 0.36, 0.2];
    for (const z of [0.4, 3.6, 6.8, 9.6]) parts.push({ box: [1.18, 2.1, z, 0.05, 0.7, 0.05], paint: 'dark', mirror: true });
    for (const [x, y] of [
      [-0.8, 1.68],
      [0, 1.68],
      [0.8, 1.68],
      [-0.4, 2.36],
      [0.4, 2.36],
      [0, 3.0],
    ])
      parts.push({ cyl: [x, y, mid, 0.36, half - 0.3, 'z'], paint: wood, cap: [0.86, 0.7, 0.45], sides: 12 });
  } else if (load === 'cars') {
    // Car carrier: two decks of little cars in bright colours.
    const deck = (y) => ({ box: [0, y, mid, 1.2, 0.04, half - 0.1], paint: 'trim' });
    parts.push(deck(1.45), deck(2.85));
    for (const z of [0.2, 3.5, 6.8, 9.8]) parts.push({ box: [1.18, 2.3, z, 0.05, 0.9, 0.05], paint: 'accent', mirror: true });
    const colours = ['#ff4d5e', '#ffd23f', '#4cc9f0', '#8ac926', '#c77dff', '#ff8c42'];
    let k = 0;
    for (const y of [1.49, 2.89])
      for (const z of [0.9, 4.4, 7.9]) {
        const c = hexRgb(colours[k++ % colours.length]);
        parts.push(
          { box: [0, y + 0.3, z, 0.82, 0.24, 1.6], paint: c, mat: 'paint' },
          { box: [0, y + 0.7, z + 0.15, 0.7, 0.18, 0.85], paint: [0.11, 0.15, 0.22], mat: 'glass', top: 0.85 },
          ...[-1.05, 1.05].map((dz) => ({ cyl: [0, y + 0.18, z + dz, 0.2, 0.86, 'x'], paint: 'dark', sides: 10 })),
        );
      }
  } else {
    parts.push(
      { box: [0, 2.6, mid, 1.27, 1.3, half - 0.02], paint: 'accent', mat: 'paint' },
      { box: [0, 1.85, mid, 1.278, 0.13, half - 0.05], paint: 'stripe' },
      { box: [0, 2.6, rear + 0.005, 0.012, 1.22, 0.004], paint: 'dark' },
      { box: [0.3, 2.4, rear + 0.01, 0.02, 0.5, 0.01], paint: 'chrome', mirror: true },
    );
  }
  return {
    body: [
      [front, 1.2, 1.1, 1.32, 6],
      [front + 0.08, 1.25, 1.08, 1.34, 8],
      [rear - 0.08, 1.25, 1.08, 1.34, 8],
      [rear, 1.2, 1.1, 1.32, 6],
    ],
    parts,
    arches: false,
    grille: false,
    rearKit: false,
    mirrors: false,
    stripes: false,
    exhausts: [],
    lights: { front: false, ry: 0.72, rz: rear + 0.02, rx: 0.9, rearBar: false },
    wheels: {
      radius: 0.5,
      width: 0.42,
      rimStyle: 'steel',
      maxSteer: 0,
      positions: [
        [-1.0, 7.4],
        [1.0, 7.4],
        [-1.0, 8.5],
        [1.0, 8.5],
      ],
    },
    height: 4,
  };
}

/** The motorbike rider, built from rounded limbs. */
function rider(style, { seatZ, hipY, shY, shZ, barY, barZ }) {
  const jeans = [0.17, 0.2, 0.3];
  const scooter = style === 'scooter';
  const chopper = style === 'chopper';
  const hip = [0.12, hipY, seatZ - 0.02];
  const knee = chopper ? [0.2, hipY - 0.02, seatZ - 0.5] : scooter ? [0.17, hipY + 0.02, seatZ - 0.42] : [0.2, hipY + 0.06, seatZ - 0.36];
  const foot = chopper ? [0.22, 0.48, seatZ - 0.75] : scooter ? [0.15, 0.54, seatZ - 0.42] : [0.2, 0.44, seatZ - 0.18];
  const shoulder = [0.17, shY - 0.04, shZ];
  const hand = [0.3, barY + 0.02, barZ];
  const elbow = [0.25, (shoulder[1] + hand[1]) / 2 - 0.06, (shoulder[2] + hand[2]) / 2 + 0.04];
  return [
    { limb: [...hip, ...knee, 0.075], paint: jeans, mirror: true },
    { limb: [...knee, ...foot, 0.06], paint: jeans, mirror: true },
    { box: [foot[0], foot[1] - 0.02, foot[2] - 0.05, 0.05, 0.05, 0.11], paint: 'dark', mirror: true },
    { sphere: [0, (hipY + shY) / 2, (seatZ + shZ) / 2, 0.19, (shY - hipY) / 2 + 0.08, 0.14], paint: 'accent' },
    { limb: [...shoulder, ...elbow, 0.055], paint: 'accent', mirror: true },
    { limb: [...elbow, ...hand, 0.048], paint: 'accent', mirror: true },
    { sphere: [hand[0], hand[1], hand[2], 0.05, 0.05, 0.05], paint: 'dark', mirror: true },
    { sphere: [0, shY + 0.2, shZ - 0.04, 0.16, 0.17, 0.18], paint: 'stripe' },
    { sphere: [0, shY + 0.19, shZ - 0.16, 0.12, 0.075, 0.07], paint: [0.1, 0.12, 0.18], mat: 'glass' },
  ];
}

/**
 * Motorbike with a helmeted rider. Wheels sit on the centre line; the body
 * stays clear above and between them (no wheel wells needed).
 * Styles: sport, dirt, scooter, chopper.
 */
function motorbike(style = 'sport') {
  const S = {
    sport: { r: 0.33, w: 0.17, zf: -0.72, zr: 0.7, tread: 'road', rim: 'spokes' },
    dirt: { r: 0.38, w: 0.15, zf: -0.78, zr: 0.72, tread: 'offroad', rim: 'steel' },
    scooter: { r: 0.25, w: 0.15, zf: -0.62, zr: 0.6, tread: 'road', rim: 'disc' },
    chopper: { r: 0.34, w: 0.2, zf: -1.05, zr: 0.75, tread: 'road', rim: 'spokes' },
  }[style];
  const { r, zf, zr } = S;
  const top = (z, wz) => r + Math.sqrt(Math.max(0, r * r - (z - wz) ** 2)) + 0.09; // clear above a wheel (any ride height)
  let body;
  if (style === 'scooter') {
    body = [
      [zf + 0.1, 0.14, top(zf + 0.1, zf), 1.05, 3],
      [zf + 0.3, 0.17, top(zf + 0.3, zf), 1.0, 4],
      [-0.2, 0.17, 0.2, 0.42, 4],
      [0.15, 0.2, 0.22, 0.5, 4],
      [0.3, 0.22, top(0.3, zr) + 0.04, 0.85, 5],
      [0.42, 0.22, top(0.42, zr), 0.85, 5],
      [0.85, 0.12, 0.6, 0.8, 3],
    ];
  } else if (style === 'chopper') {
    body = [
      [-0.62, 0.09, 0.62, 0.9, 3],
      [-0.4, 0.15, 0.4, 0.92, 4],
      [0.05, 0.13, 0.32, 0.7, 5],
      [0.38, 0.13, top(0.38, zr), 0.74, 4],
      [0.55, 0.14, top(0.55, zr), 0.8, 4],
      [0.75, 0.15, top(0.75, zr), 0.88, 4],
      [1.1, 0.08, 0.7, 0.8, 3],
    ];
  } else {
    const lift = style === 'dirt' ? 0.12 : 0;
    body = [
      [zf + 0.1, 0.08, top(zf + 0.1, zf) + 0.04 + lift, 0.92 + lift, 3],
      [zf + 0.22, 0.15, top(zf + 0.22, zf) + 0.01 + lift, 1.02 + lift, 4],
      [-0.25, 0.2, 0.38 + lift, 1.0 + lift, 5],
      [0.1, 0.17, 0.36 + lift, 0.92 + lift, 5],
      [zr - 0.36, 0.14, 0.42 + lift, 0.88 + lift, 4],
      [zr - 0.2, 0.11, top(zr - 0.2, zr) + lift, 0.88 + lift, 3],
      [zr, 0.09, top(zr, zr) + lift, 0.9 + lift, 3],
      [zr + 0.18, 0.05, top(zr + 0.18, zr) + lift, 0.88 + lift, 3],
    ];
  }
  const seatY = style === 'chopper' ? 0.76 : style === 'scooter' ? 0.88 : style === 'dirt' ? 1.04 : 0.94;
  const seatZ = style === 'chopper' ? 0.35 : 0.25;
  const barZ = style === 'chopper' ? -0.42 : zf + 0.25;
  const barY = style === 'chopper' ? 1.28 : style === 'scooter' ? 1.12 : style === 'dirt' ? 1.25 : 1.08;
  // Rider posture: leaning forward on sport bikes, upright otherwise.
  const hunch = style === 'sport' ? 0.22 : style === 'chopper' ? -0.08 : 0.08;
  const hipY = seatY + 0.08;
  const shY = hipY + (style === 'sport' ? 0.36 : 0.48);
  const shZ = seatZ - 0.05 - hunch;
  const forkX = S.w / 2 + 0.06;
  const parts = [
    // Seat, handlebars, front fork, swingarm, exhaust.
    { box: [0, seatY - 0.02, seatZ, 0.14, 0.035, 0.26], paint: 'dark' },
    { box: [0, barY, barZ, 0.34, 0.018, 0.018], paint: 'dark' },
    { limb: [forkX, r, zf, forkX, barY - 0.02, barZ + 0.02, 0.026], paint: 'chrome', mirror: true },
    { box: [forkX - 0.01, r + 0.02, (zr + 0.1) / 2 + 0.05, 0.02, 0.03, Math.abs(zr - 0.1) / 2], paint: 'dark', mirror: true },
    { cyl: [0.2, 0.42, zr - 0.1, 0.055, 0.38, 'z'], paint: 'chrome', cap: 'dark', sides: 10 },
    // Rider: boots, legs bent to the pegs, body, arms to the bars, helmet.
    ...rider(style, { seatZ, hipY, shY, shZ, barY, barZ }),
  ];
  if (style === 'dirt') {
    // Tall mudguards and number board.
    parts.push(
      { box: [0, top(zf, zf) + 0.02, zf - 0.05, 0.08, 0.015, 0.28], paint: 'body', top: 0.9 },
      { box: [0, 1.0, zf + 0.12, 0.16, 0.12, 0.015], paint: [0.96, 0.96, 0.92] },
    );
  }
  if (style === 'scooter') {
    // Leg shield and floorboard.
    parts.push({ box: [0, 0.5, -0.12, 0.18, 0.02, 0.28], paint: 'dark' });
  }
  return {
    body,
    parts,
    bike: true,
    arches: false,
    grille: false,
    rearKit: false,
    mirrors: false,
    stripeHalf: 0.08,
    exhausts: [[0.2, 0.42, zr + 0.28]],
    lights: { fx: 0, fw: 0.06, fy: body[0][2] + (body[0][3] - body[0][2]) * 0.55, fz: body[0][0], rx: 0, ry: body.at(-1)[2] + 0.04, rz: body.at(-1)[0], rearBar: false },
    trailY: 0.55,
    height: shY + 0.37,
    wheels: {
      radius: r,
      width: S.w,
      rimStyle: S.rim,
      tread: S.tread === 'offroad' ? 'offroad' : undefined,
      maxSteer: 0.25,
      positions: [
        [0, zf],
        [0, zr],
      ],
    },
  };
}

/**
 * Monster truck: any family's body (pickup, muscle car, SUV, hatch, jeep)
 * lifted onto a monster chassis with giant wheels.
 */
function monsterTruck(bodyFamily) {
  const src = FAMILIES[bodyFamily].build();
  const zMax = Math.max(...src.body.map((st) => Math.abs(st[0])));
  const sz = 2.25 / zMax;
  const hwMax = Math.max(...src.body.map((st) => st[1]));
  const sx = Math.min(0.96, 0.95 / hwMax);
  const yb = Math.min(...src.body.map((st) => st[2]));
  const lift = 1.38 - yb;
  const up = (st) => st.map(([z, hw, b, t, n]) => [z * sz, hw * sx, b + lift, t + lift, n]);
  const upC = (st) => st.map(([z, a, b, y0, y1]) => [z * sz, a * sx, b * sx, y0 + lift, y1 + lift]);
  const cabin = src.cabin && upC(src.cabin);
  const roof = cabin ? Math.max(...cabin.map((c) => c[4])) : Math.max(...src.body.map((st) => st[3])) + lift;
  const roofZ = cabin ? cabin[1][0] + 0.15 : 0;
  const parts = [
    // Chassis rails, axles, springs and shocks.
    { box: [0.5, 1.05, 0, 0.07, 0.09, 2.0], paint: 'dark', mirror: true },
    { cyl: [0, 0.85, -1.45, 0.1, 1.05, 'x'], paint: 'dark' },
    { cyl: [0, 0.85, 1.5, 0.1, 1.05, 'x'], paint: 'dark' },
    ...lightBar(roof + 0.05, roofZ, 0.6),
    { box: [0, 1.5, -2.3, 0.85, 0.08, 0.06], paint: 'chrome' },
  ];
  if (bodyFamily === 'pickup') parts.push(...pickupBed(0.62, 2.17, 1.14 + lift - 0.45 + 0.45, 0.93));
  for (const z of [-1.45, 1.5]) {
    for (const dz of [-0.32, 0.32]) {
      parts.push({ cyl: [0.62, 1.2, z + dz, 0.09, 0.32, 'y'], paint: 'accent', mirror: true, sides: 10 });
      parts.push({ cyl: [0.62, 1.2, z + dz, 0.04, 0.4, 'y'], paint: 'chrome', mirror: true, sides: 8 });
    }
  }
  return {
    body: up(src.body),
    cabin,
    cabinShape: src.cabinShape,
    cabinStrips: src.cabinStrips,
    bPillar: src.bPillar,
    stripeHalf: 0.22,
    arches: false,
    parts,
    spoiler: src.spoiler && src.spoiler.type === 'lip' ? { ...src.spoiler, z: src.spoiler.z * sz, y: src.spoiler.y + lift, w: src.spoiler.w * sx } : undefined,
    exhausts: [
      [-0.45, 1.5, 2.3],
      [0.45, 1.5, 2.3],
    ],
    trailY: 1.6,
    height: roof + 0.1,
    wheels: wheels4(1.45, -1.45, 1.5, 0.85, 0.7, { rimStyle: 'steel', tread: 'offroad', maxSteer: 0.25 }),
  };
}

/** What a cab-over truck carries: box, tanker, tipper or flatbed. */
function truckCargo(kind) {
  if (kind === 'none') return [];
  if (kind === 'tanker') {
    return [
      { cyl: [0, 2.35, 1.15, 1.15, 2.95, 'z'], paint: 'accent', mat: 'chrome', sides: 18 },
      { cyl: [0, 2.35, 1.15, 1.17, 0.18, 'z'], paint: 'stripe', sides: 18 },
      { cyl: [0, 2.35, -0.9, 1.17, 0.06, 'z'], paint: 'stripe', sides: 18 },
      { cyl: [0, 2.35, 3.2, 1.17, 0.06, 'z'], paint: 'stripe', sides: 18 },
      ...[-0.8, 1.15, 3.1].map((z) => ({ box: [0, 1.3, z, 0.95, 0.12, 0.22], paint: 'dark' })),
      { box: [0.45, 2.2, 4.12, 0.03, 0.9, 0.03], paint: 'chrome' },
    ];
  }
  if (kind === 'tipper') {
    return [
      { box: [0, 1.32, 1.15, 1.25, 0.08, 3.0], paint: 'trim' },
      { box: [1.2, 2.0, 1.15, 0.06, 0.62, 3.0], paint: 'accent', mirror: true },
      { box: [0, 2.15, -1.85, 1.26, 0.78, 0.07], paint: 'accent' },
      { box: [0, 2.0, 4.12, 1.26, 0.62, 0.06], paint: 'accent' },
      { box: [0, 1.42, 1.15, 1.13, 0.02, 2.93], paint: 'dark' },
      { sphere: [0, 2.0, 1.25, 1.02, 0.55, 2.5], paint: [0.62, 0.5, 0.38] },
      { box: [0, 2.0, 1.15, 1.262, 0.06, 2.9], paint: 'stripe' },
    ];
  }
  if (kind === 'flatbed') {
    const crates = [
      [-0.55, -1.0, '#ff8c42'],
      [0.55, -0.9, '#4cc9f0'],
      [0, 0.6, '#ffd23f'],
      [-0.5, 2.0, '#8ac926'],
      [0.55, 2.2, '#c77dff'],
      [0, 3.3, '#ff4d5e'],
    ];
    return [
      { box: [0, 1.35, 1.15, 1.25, 0.1, 3.0], paint: 'trim' },
      { box: [1.2, 1.38, 1.15, 0.05, 0.12, 3.0], paint: 'accent', mirror: true },
      ...[-1.6, 0, 1.6, 3.2].map((z) => ({ box: [1.2, 1.75, z + 0.3, 0.04, 0.32, 0.04], paint: 'dark', mirror: true })),
      ...crates.map(([x, z, c]) => ({ box: [x, 1.9, z, 0.5, 0.45, 0.55], paint: hexRgb(c), mat: 'paint' })),
    ];
  }
  return [
    { box: [0, 2.43, 1.15, 1.27, 1.27, 3.1], paint: 'accent', mat: 'paint' },
    { box: [0, 1.72, 1.15, 1.278, 0.13, 3.06], paint: 'stripe' },
    { box: [0, 2.43, 4.256, 0.012, 1.2, 0.004], paint: 'dark' },
    { box: [0.3, 2.2, 4.26, 0.02, 0.5, 0.01], paint: 'chrome', mirror: true },
  ];
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export const FAMILIES = {
  // ------------------------------------------------------------------ race
  race: {
    label: 'Race',
    engine: 'v10',
    camera: 1,
    handling: { maxSpeed: 14000, accel: 6200, grip: 12, steerSpeed: 2.5, centrifugal: 0.3, nitroTop: 1.4, offroadTop: 0.35, offroadGrip: 0.45 },
    build: (o = {}) => (o.formula ? formulaCar(o) : {
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
    build: (o = {}) => (o.wedge ? wedgeCar(o) : {
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
      cabin: o.open
        ? [
            [-0.75, 0.86, 0.84, 1.22, 1.24],
            [-0.55, 0.86, 0.82, 1.24, 1.72],
          ]
        : [
            [-0.75, 0.86, 0.84, 1.22, 1.24],
            [-0.48, 0.86, 0.8, 1.24, 1.95],
            [0.35, 0.87, 0.8, 1.24, 1.97],
            [0.47, 0.87, 0.8, 1.24, 1.97],
            [1.86, 0.88, 0.8, 1.24, 1.97],
            [2.0, 0.88, 0.82, 1.24, 1.93],
          ],
      cabinShape: [0.35, 0.3],
      cabinStrips: o.open ? ['wind'] : undefined,
      bPillar: 2,
      stripeHalf: 0.2,
      parts: [
        // Spare wheel, bull bar, fender flares, side steps.
        { cyl: [0, 1.0, 2.2, 0.38, 0.12, 'z'], paint: 'tire', cap: 'rim', sides: 16 },
        { box: [0, 0.72, -2.16, 0.72, 0.05, 0.04], paint: 'dark' },
        { box: [0.42, 0.86, -2.15, 0.04, 0.2, 0.04], paint: 'dark', mirror: true },
        { box: [0.95, 0.5, 0, 0.07, 0.025, 0.8], paint: 'dark', mirror: true },
        ...(o.open
          ? [
              // Roll bar and two seats in the open tub.
              { box: [0.76, 1.62, 0.55, 0.045, 0.38, 0.045], paint: 'dark', mirror: true },
              { box: [0, 1.98, 0.55, 0.8, 0.045, 0.045], paint: 'dark' },
              { box: [0.76, 1.62, 1.5, 0.045, 0.38, 0.045], paint: 'dark', mirror: true },
              { box: [0.76, 1.98, 1.02, 0.045, 0.045, 0.5], paint: 'dark', mirror: true },
              { box: [0.38, 1.42, 0.1, 0.26, 0.18, 0.24], paint: 'trim', mirror: true },
              { box: [0.38, 1.7, 0.3, 0.26, 0.28, 0.06], paint: 'trim', mirror: true },
              ...(o.lightBar ? lightBar(2.06, 0.55, 0.62) : []),
            ]
          : o.lightBar
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
    build: (o = {}) => ({
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
      roofRails: { x: 0.6, z0: -0.4, z1: 1.5 },
      parts: [
        { box: [0, 0.5, -2.32, 0.6, 0.06, 0.05], paint: 'chrome' },
        ...(o.lux
          ? [
              // Big chrome grille and chrome side strips.
              { box: [0, 0.74, -2.36, 0.5, 0.13, 0.02], paint: 'chrome' },
              { box: [0.985, 0.72, 0, 0.012, 0.03, 0.45], paint: 'chrome', mirror: true },
            ]
          : []),
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
    build: (o = {}) => monsterTruck(o.body || 'pickup'),
  },

  // ------------------------------------------------------------------ bike
  bike: {
    label: 'Motorbike',
    engine: 'bike',
    camera: 0.9,
    handling: { maxSpeed: 12600, accel: 6400, brake: 15000, grip: 9.5, steerSpeed: 2.3, steerRamp: 4.2, centrifugal: 0.3, nitroAccel: 2, nitroTop: 1.4, offroadTop: 0.5 },
    build: (o = {}) => motorbike(o.style),
  },

  // ------------------------------------------------------------------- rig
  rig: {
    label: 'Big Rig',
    engine: 'diesel',
    camera: 3.3, // far enough back to see the whole rig
    handling: { maxSpeed: 9800, accel: 3300, brake: 11000, grip: 7, steerSpeed: 1.75, steerRamp: 3.8, centrifugal: 0.22, nitroAccel: 2.4, nitroTop: 1.35, offroadTop: 0.5 },
    build: (o = {}) => rigUnit(o),
  },

  // --------------------------------------------------------------- tractor
  tractor: {
    label: 'Tractor',
    engine: 'diesel',
    camera: 2.0, // far enough back to see the trailer and the tractor
    handling: { maxSpeed: 9400, accel: 4200, brake: 12000, grip: 8.5, steerSpeed: 2.0, centrifugal: 0.24, nitroAccel: 2.2, nitroTop: 1.4, offroadTop: 0.85, offroadGrip: 1, offroadDecel: 4000, jumpBoost: 1.05 },
    build: (o = {}) => {
      const rearR = 0.78;
      const rearZ = 0.75;
      const parts = [
        // Front ballast weights, chassis rails and the drawbar.
        { box: [0, 0.62, -1.86, 0.36, 0.16, 0.1], paint: 'dark' },
        { box: [0.3, 0.55, -0.6, 0.06, 0.1, 1.2], paint: 'dark', mirror: true },
        { box: [0, 0.55, 1.5, 0.08, 0.06, 0.25], paint: 'dark' },
        // Exhaust stack and air intake beside the hood.
        { cyl: [0.26, 1.85, -0.85, 0.06, 0.6, 'y'], paint: 'dark', cap: 'dark' },
        { cyl: [-0.26, 1.55, -0.6, 0.07, 0.3, 'y'], paint: 'chrome' },
        // Step and seat back visible through the glass.
        { box: [0.56, 0.95, 0.15, 0.08, 0.03, 0.18], paint: 'dark', mirror: true },
        { box: [0, 1.55, 0.95, 0.3, 0.25, 0.06], paint: 'dark' },
        // Big rear mudguards.
        ...arcGuard(0.92, 0.78, rearZ, rearR + 0.06, 0.24, o.guard || 'body'),
        // Small front mudguards.
        ...arcGuard(0.68, 0.42, -1.25, 0.5, 0.14, 'dark', 0.15, 0.85),
      ];
      return {
        body: [
          [-1.8, 0.34, 0.58, 1.12, 3],
          [-1.72, 0.42, 0.55, 1.24, 5],
          [-0.1, 0.44, 0.55, 1.28, 5],
          [0.05, 0.56, 0.5, 1.28, 6],
          [1.35, 0.56, 0.5, 1.28, 6],
          [1.42, 0.5, 0.55, 1.2, 4],
        ],
        cabin: [
          [0.05, 0.56, 0.56, 1.26, 1.3],
          [0.1, 0.6, 0.58, 1.28, 2.45],
          [1.3, 0.6, 0.58, 1.28, 2.45],
          [1.36, 0.56, 0.56, 1.26, 2.4],
        ],
        cabinShape: [0.18, 0.14],
        cabinStrips: ['wind', 'side', 'rear'],
        mirrors: false,
        stripeHalf: 0.14,
        arches: false,
        rearKit: false,
        grille: false,
        lights: { fy: 0.98, fz: -1.8, fx: 0.2, fw: 0.07, ry: 1.05, rz: 1.42, rx: 0.4, rearBar: false },
        exhausts: [[0.26, 2.47, -0.85]],
        parts,
        trailY: 1.2,
        height: 2.5,
        wheels: {
          radius: 0.42,
          width: 0.26,
          rear: { radius: rearR, width: 0.44 },
          positions: [
            [-0.68, -1.25],
            [0.68, -1.25],
            [-0.92, rearZ],
            [0.92, rearZ],
          ],
          rimStyle: 'steel',
          tread: 'offroad',
          maxSteer: 0.32,
        },
        tow: { hitch: [0.55, 1.72], trailer: haywagon(o.load || 'hay') },
      };
    },
  },

  // ----------------------------------------------------------------- truck
  truck: {
    label: 'Truck',
    engine: 'diesel',
    camera: 1.55,
    handling: { maxSpeed: 10000, accel: 3400, brake: 11000, grip: 7, steerSpeed: 1.75, steerRamp: 3.8, centrifugal: 0.24, nitroAccel: 2.3, nitroTop: 1.35, offroadTop: 0.5 },
    build: (o = {}) => {
      const parts = [
        // Bumper, grille bars, sun visor, roof deflector.
        { box: [0, 0.68, -4.18, 1.22, 0.27, 0.12], paint: 'trim' },
        { box: [0, 1.5, -4.27, 0.82, 0.36, 0.02], paint: 'dark' },
        { box: [0, 2.99, -4.1, 1.15, 0.04, 0.14], paint: 'body' },
        { box: [0, 3.32, -2.85, 1.15, 0.32, 0.62], paint: 'body', top: 0.85 },
        ...truckCargo(o.cargo || 'box'),
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
        height: o.cargo === 'flatbed' || o.cargo === 'tipper' ? 3.2 : 3.7,
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

export const FAMILY_ORDER = ['race', 'sports', 'muscle', 'hatch', 'jeep', 'suv', 'pickup', 'monster', 'truck', 'rig', 'tractor', 'bike'];

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
    if (p.sphere) {
      const [x, y, z, rx, ry, rz] = p.sphere;
      return { ...p, sphere: [x * sx, y * sy, z * sz, rx * sx, ry * sy, rz * sz] };
    }
    if (p.limb) {
      const [x0, y0, z0, x1, y1, z1, r] = p.limb;
      return { ...p, limb: [x0 * sx, y0 * sy, z0 * sz, x1 * sx, y1 * sy, z1 * sz, r * sx] };
    }
    if (p.prism) {
      const [x, hx, profile] = p.prism;
      return { ...p, prism: [x * sx, hx * sx, profile.map(([y, z]) => [y * sy, z * sz])] };
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
    roofRails: m.roofRails && { x: m.roofRails.x * sx, z0: m.roofRails.z0 * sz, z1: m.roofRails.z1 * sz },
    tow: m.tow && { ...m.tow, hitch: [m.tow.hitch[0] * sy, m.tow.hitch[1] * sz] },
    exhausts: m.exhausts && m.exhausts.map(([x, y, z]) => [x * sx, y * sy, z * sz]),
    wheels: { ...m.wheels, positions: m.wheels.positions.map(([x, z]) => [x * sx, z * sz]) },
  };
}
