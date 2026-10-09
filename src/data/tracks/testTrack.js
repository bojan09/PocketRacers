// Prototype test track: a single loop that exercises every handling case —
// gentle and hard curves, hills, crests, bumps, guard-rail sections and a
// long nitro straight with slow practice traffic.

const CURVE = { easy: 2, medium: 4, hard: 6 };
const HILL = { low: 20, medium: 40, high: 60 }; // in segment lengths

// enter/hold/leave are segment counts; curve > 0 bends right; hill is the
// height change across the section in segment lengths.
const section = (enter, hold, leave, curve = 0, hill = 0, opts = {}) => ({ enter, hold, leave, curve, hill, ...opts });

export default {
  id: 'test-loop',
  name: 'Sunny Test Loop',
  seed: 1234,
  segmentLength: 200,
  roadHalfWidth: 2000,
  lanes: 3,
  rumbleLength: 3,
  cameraHeight: 1000,
  trafficCount: 8,

  palette: {
    skyTop: '#3fa7f5',
    skyBottom: '#bfe9ff',
    fog: '#cdeeff',
    sun: '#fff4c2',
    hillsFar: '#8fc7d9',
    hillsNear: '#5fb36a',
    grassLight: '#7dd35b',
    grassDark: '#6cc24c',
    rumbleLight: '#ffffff',
    rumbleDark: '#ff4d5e',
    roadLight: '#6f7787',
    roadDark: '#68707f',
    lane: '#ffffff',
    rail: '#e9eef5',
    railPost: '#8a96a8',
  },

  layout: [
    section(0, 50, 0),
    section(25, 50, 25, CURVE.easy, 0),
    section(25, 25, 25, 0, HILL.medium),
    section(25, 25, 25, -CURVE.medium, -HILL.medium),
    section(20, 20, 20, CURVE.medium, 0),
    section(20, 20, 20, -CURVE.medium, 0),
    section(30, 40, 30, -CURVE.hard, 0, { rail: true }),
    section(0, 40, 0),
    section(50, 50, 50, 0, HILL.low, { traffic: true }),
    section(50, 50, 50, 0, -HILL.low, { traffic: true }),
    section(10, 10, 10, 0, 6),
    section(10, 10, 10, 0, -6),
    section(10, 10, 10, 0, 6),
    section(10, 10, 10, 0, -6),
    section(30, 60, 30, CURVE.hard, HILL.low, { rail: true }),
    section(25, 50, 25, -CURVE.easy, -HILL.low),
    section(20, 40, 20, CURVE.medium, HILL.low),
    // the builder appends a closing section that returns to height 0
  ],

  // Roadside scenery rules. Offsets are in road half-widths from the centre.
  scenery: [
    { kinds: ['pine', 'oak', 'oak', 'bush'], every: 4, offset: [1.45, 3.2], side: 'both', chance: 0.85 },
    { kinds: ['pine', 'oak'], every: 9, offset: [3.2, 6], side: 'both', chance: 0.9, solid: false },
    { kinds: ['rock', 'bush'], every: 23, offset: [1.35, 1.9], side: 'both', chance: 0.5 },
    { kinds: ['billboard'], at: [70, 420, 760, 1010], offset: [1.7, 1.9], side: 'alternate' },
  ],
};
