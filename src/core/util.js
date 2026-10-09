// Small math helpers shared by simulation and rendering. Pure, allocation-free.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Move `value` toward `target` by at most `step`. */
export function approach(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return value;
}

export const easeIn = (a, b, t) => a + (b - a) * t * t;
export const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);

/** Wrap a position into [0, length). */
export function wrap(v, length) {
  v %= length;
  return v < 0 ? v + length : v;
}

/** Shortest signed distance from a to b on a loop of `length`. */
export function loopDelta(a, b, length) {
  let d = b - a;
  const half = length / 2;
  if (d > half) d -= length;
  else if (d < -half) d += length;
  return d;
}

/** Deterministic PRNG so track decoration and traffic are identical every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Blend two #rrggbb colours; returns #rrggbb. Used only at load time. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

export function shadeHex(hex, amount) {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
}
