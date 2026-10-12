// Moon Base: a loop across grey moon dust under a black, starry sky — big
// craters, glass domes, rockets on their pads and radar dishes. Gravity is
// low, so every jump floats.

export default {
  id: 'moon-base',
  name: 'Moon Base',
  seed: 1969,
  segmentLength: 200,
  roadHalfWidth: 2000,
  lanes: 3,
  trafficCount: 5,
  gantryAt: 4,
  env: { tufts: false, hills: 26, bumps: 3, rim: 60, snowLine: 999, stars: 1, clouds: false, gravity: 0.6, grip: 0.95 },

  points: [
    { p: [0, 0], y: 1, noBank: true },
    { p: [0, 200], y: 2 },
    { p: [60, 340], y: 4 },
    { p: [200, 400], y: 5 },
    { p: [340, 350], y: 4, bridge: true, rail: true },
    { p: [420, 230], y: 3 },
    { p: [430, 80], y: 2 },
    { p: [380, -60], y: 4 },
    { p: [420, -200], y: 6, tunnel: true },
    { p: [340, -330], y: 5 },
    { p: [200, -360], y: 3 },
    { p: [80, -300], y: 2 },
    { p: [10, -160], y: 1, noBank: true },
  ],

  palette: {
    skyTop: '#02030a',
    skyHorizon: '#141826',
    fog: '#1c2030',
    fogNear: 220,
    fogFar: 760,
    sunColor: '#ffffff',
    skyAmbient: '#b8c0d8',
    groundAmbient: '#5a5a66',
    sunDir: [0.5, 0.6, -0.4],
    grass: '#8e8e94',
    grassAlt: '#9c9ca2',
    dryGrass: '#7a7a80',
    hills: '#8a8a90',
    rockFace: '#6e6e76',
    mountains: '#7a7a82',
    snow: '#ffffff',
    water: '#000000',
    road: '#3e4250',
    roadAlt: '#444858',
    shoulder: '#c8c8cc',
    lane: '#7fe8ff',
    rumbleA: '#ffffff',
    rumbleB: '#2f8cff',
    rail: '#d8dce8',
    railPost: '#2f8cff',
    tunnel: '#5a5c66',
    tunnelLight: '#bfefff',
  },

  features: {
    ramps: [
      { seg: 100, x: -0.36, width: 0.62, length: 7, height: 1.4 },
      { seg: 1000, x: 0.36, width: 0.62, length: 7, height: 1.5, trick: 'barrel', roll: 1 },
      { seg: 1800, x: 0, width: 0.72, length: 10, height: 2.2, trick: 'mega' },
    ],
    boosts: [
      { seg: 350, x: 0, width: 0.6 },
      { seg: 750, x: 0.36, width: 0.5 },
      { seg: 1300, x: -0.36, width: 0.5 },
      { seg: 2000, x: 0, width: 0.6 },
    ],
    stars: [
      { seg: 400, count: 7, every: 7, x: 0.5 },
      { seg: 1050, count: 6, every: 6, x: -0.4 },
      { seg: 1450, count: 6, every: 7, x: 0.3 },
      { seg: 2050, count: 5, every: 7, x: -0.5 },
    ],
    cones: [
      { seg: 600, count: 6, every: 9, x: [0.5, -0.5] },
      { seg: 1200, count: 5, every: 0, x: [-0.8, -0.4, 0, 0.4, 0.8] },
      { seg: 1650, count: 5, every: 9, x: [0.45, -0.45] },
    ],
  },

  scenery: [
    { kinds: ['moonRock', 'moonLamp', 'moonRock', 'crater'], every: 11, offset: [1.5, 3], side: 'both', chance: 0.8, skipRail: true },
    { kinds: ['crater', 'moonRock', 'crater', 'crater', 'moonRock'], every: 6, offset: [3.4, 11], side: 'both', chance: 0.85, solid: false },
    {
      at: [
        { seg: 220, kind: 'dome', offset: -5.6, yaw: 0.3 },
        { seg: 260, kind: 'rocket', offset: -9 },
        { seg: 700, kind: 'dish', offset: 5.2, yaw: 2.4 },
        { seg: 1150, kind: 'dome', offset: 5.6, yaw: 2.7 },
        { seg: 1250, kind: 'rocket', offset: 7.4 },
        { seg: 1700, kind: 'dome', offset: -5.8, yaw: 0.2 },
        { seg: 2150, kind: 'rocket', offset: -8 },
      ],
    },
  ],
};
