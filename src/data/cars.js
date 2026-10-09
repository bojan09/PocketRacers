// Vehicle definitions. Handling values are in world units (see track.js):
// the road is 2 * roadHalfWidth wide, lateral position `x` is normalised so
// |x| = 1 is the road edge.

export const CARS = {
  zippy: {
    id: 'zippy',
    name: 'Zippy GT',
    widthWorld: 640, // visual + collision width
    lengthWorld: 900, // collision length along the track
    handling: {
      maxSpeed: 12000, // world units / s  (~180 km/h on the HUD)
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
      nitroAccel: 1.8, // acceleration multiplier while boosting
      nitroTop: 1.38, // top speed multiplier while boosting
      offroadTop: 0.45, // top speed fraction on grass
      offroadDecel: 9000,
      offroadGrip: 0.55,
    },
    paint: {
      body: '#ff4d5e',
      accent: '#ffd23f',
      stripe: '#ffffff',
      rim: '#dfe7f0',
      tire: '#23262d',
      glass: '#24324f',
      plate: 'POCKET',
    },
  },
};

/** Paint jobs for practice traffic. */
export const TRAFFIC_PAINTS = [
  { body: '#3a86ff', accent: '#ffffff', stripe: '#ffd23f' },
  { body: '#2ec4b6', accent: '#ffffff', stripe: '#1b1f3b' },
  { body: '#ffbe0b', accent: '#1b1f3b', stripe: '#ff006e' },
  { body: '#8338ec', accent: '#ffd23f', stripe: '#ffffff' },
  { body: '#fb5607', accent: '#ffffff', stripe: '#1b1f3b' },
  { body: '#06d6a0', accent: '#1b1f3b', stripe: '#ffffff' },
].map((p) => ({ rim: '#c9d3de', tire: '#23262d', glass: '#24324f', plate: '', ...p }));
