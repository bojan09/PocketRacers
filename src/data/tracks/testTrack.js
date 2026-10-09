// Prototype test track ("Sunny Valley"): one loop exercising every handling
// case plus the 3D showcase pieces — a crest, banked sweepers, an S-section,
// a rock tunnel, a guard-railed hairpin and a bridge over a lake.
//
// Control points are map coordinates in metres: p = [east, north], y = height.
// Flags on a point apply to the span from that point to the next one.

export default {
  id: 'sunny-valley',
  name: 'Sunny Valley',
  seed: 1234,
  segmentLength: 200, // sim units (240 units = 1 m)
  roadHalfWidth: 2000,
  lanes: 3,
  trafficCount: 7,
  gantryAt: 4,
  waterLevel: -7,

  points: [
    { p: [0, 0], y: 0, noBank: true },
    { p: [0, 150], y: 0 },
    { p: [25, 262], y: 6 },
    { p: [112, 334], y: 14 },
    { p: [232, 344], y: 12 },
    { p: [332, 300], y: 8, tunnel: true },
    { p: [370, 226], y: 4 },
    { p: [378, 150], y: 3 },
    { p: [398, 82], y: 3 },
    { p: [392, -22], y: 5, rail: true },
    { p: [338, -92], y: 8, rail: true },
    { p: [232, -122], y: 10, bridge: true },
    { p: [104, -122], y: 10 },
    { p: [23, -99], y: 5 },
    { p: [0, -44], y: 1, noBank: true },
  ],

  palette: {
    skyTop: '#2f8fe8',
    skyHorizon: '#bfe6ff',
    fog: '#cfe9fb',
    fogNear: 120,
    fogFar: 520,
    sunColor: '#fff3d6',
    skyAmbient: '#b9dcff',
    groundAmbient: '#8a9a6a',
    sunDir: [0.45, 0.8, 0.35],
    grass: '#74c95a',
    grassAlt: '#68bb4f',
    hills: '#5aab52',
    rockFace: '#b3a698',
    mountains: '#7fa6c9',
    snow: '#f4f8ff',
    water: '#3f9fd8',
    road: '#5f6675',
    roadAlt: '#646b7b',
    shoulder: '#b5b08a',
    lane: '#ffffff',
    rumbleA: '#ffffff',
    rumbleB: '#ff4d5e',
    rail: '#e9eef5',
    railPost: '#8a96a8',
    tunnel: '#8c8f99',
    tunnelLight: '#ffe9a8',
  },

  // Fun stuff. seg = segment index (~0.83 m each), x = lateral position in
  // road half-widths (-1 left edge .. 1 right edge).
  features: {
    ramps: [
      { seg: 80, x: -0.36, width: 0.62, length: 7, height: 1.5 },
      { seg: 540, x: 0.36, width: 0.62, length: 7, height: 1.5 },
      // Barrel-roll ramps: one side raised, the car rolls over in the air.
      { seg: 150, x: 0.36, width: 0.62, length: 7, height: 1.6, trick: 'barrel', roll: 1 },
      { seg: 950, x: -0.36, width: 0.62, length: 7, height: 1.6, trick: 'barrel', roll: -1 },
      // Mega ramp: big air for 720s.
      { seg: 1190, x: 0, width: 0.72, length: 10, height: 2.6, trick: 'mega' },
    ],
    boosts: [
      { seg: 30, x: 0.4, width: 0.5 },
      { seg: 300, x: 0, width: 0.6 },
      { seg: 760, x: -0.36, width: 0.5 },
      { seg: 1600, x: 0.36, width: 0.5 },
    ],
    stars: [
      { seg: 190, count: 8, every: 7, x: 0.62 },
      { seg: 620, count: 6, every: 8, x: -0.62 },
      { seg: 1030, count: 8, every: 6, x: 0 },
      { seg: 1420, count: 10, every: 7, x: 0.3 },
      { seg: 1640, count: 6, every: 7, x: -0.5 },
    ],
    cones: [
      { seg: 400, count: 8, every: 9, x: [-0.4, 0.4] },
      { seg: 680, count: 5, every: 0, x: [-0.8, -0.4, 0, 0.4, 0.8] },
      { seg: 1300, count: 6, every: 10, x: [0.5, -0.5] },
    ],
  },

  scenery: [
    { kinds: ['pine', 'oak', 'oak', 'bush', 'flowers'], every: 10, offset: [1.45, 2.9], side: 'both', chance: 0.9, skipRail: true },
    { kinds: ['pine', 'oak', 'pine'], every: 6, offset: [3.2, 9], side: 'both', chance: 0.95, solid: false },
    { kinds: ['rock', 'bush'], every: 40, offset: [1.4, 2.2], side: 'both', chance: 0.6, skipRail: true },
    {
      at: [
        { seg: 60, kind: 'lamp', offset: -1.38 },
        { seg: 60, kind: 'lamp', offset: 1.38 },
        { seg: 120, kind: 'lamp', offset: -1.38 },
        { seg: 120, kind: 'lamp', offset: 1.38 },
        { seg: 180, kind: 'lamp', offset: -1.38 },
        { seg: 180, kind: 'lamp', offset: 1.38 },
        { seg: 90, kind: 'billboard', offset: 1.9, yaw: -0.3 },
        { seg: 700, kind: 'billboard', offset: -1.9, yaw: 0.3 },
        { seg: 250, kind: 'house', offset: -5.2, yaw: 0.4 },
        { seg: 290, kind: 'barn', offset: -6.5, yaw: -0.2 },
        { seg: 330, kind: 'windmill', offset: -8.5 },
        { seg: 900, kind: 'house', offset: 5.5, yaw: 2.6 },
        { seg: 960, kind: 'house', offset: 6, yaw: 2.9 },
        { seg: 1500, kind: 'windmill', offset: 7.5 },
        { seg: 1560, kind: 'barn', offset: 6.2, yaw: 1.4 },
      ],
    },
  ],
};
