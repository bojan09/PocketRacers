// Island flag races: a start arch over a road; driving through it starts a
// race through gates along that road to a finish arch. Always solo and
// never failed: finishing pays points, a quick time earns up to 3 stars.
// The target time follows the vehicle's top speed, so a tractor can get
// 3 stars too. Pure logic (no DOM), unit-testable.

import { UNITS_PER_METRE } from './track3d.js';

const GATE_EVERY = 30; // road samples (3 m each) between gates
const GATE_HALF = 14; // metres either side of the road centre that count
const LOST = 320; // metres from the next gate that end the race
export const FLAG_POINTS = 250;
export const STAR_POINTS = 150;

/**
 * The island's races, laid along its roads: { id, name, icon, gates: [{x, z,
 * tx, tz}], length }. gates[0] is the start arch, the last one the finish.
 */
export function buildFlagRaces(world) {
  const ring = world.roads[0].samples;
  const N = ring.length;
  const nearestOnRing = (p) => {
    let best = 0;
    for (let i = 0; i < N; i++) if ((ring[i].x - p.x) ** 2 + (ring[i].z - p.z) ** 2 < (ring[best].x - p.x) ** 2 + (ring[best].z - p.z) ** 2) best = i;
    return best;
  };
  const spokeEnd = (k) => {
    const s = world.roads[k].samples;
    return s[s.length - 1];
  };
  const along = (samples, from, count, dir, closed) => {
    const out = [];
    for (let k = 0; k <= count; k++) {
      let i = from + k * dir;
      if (closed) i = ((i % samples.length) + samples.length) % samples.length;
      else if (i < 0 || i >= samples.length) break;
      const s = samples[i];
      out.push({ x: s.x, z: s.z, tx: s.tx * dir, tz: s.tz * dir });
    }
    return out;
  };
  const spoke1 = world.roads[1].samples;
  const spoke4 = world.roads[4].samples;
  const defs = [
    // Out from the start, just ahead of where the drive begins.
    { id: 'sunny-sprint', name: 'Sunny Sprint', icon: '🌼', pts: along(spoke1, 18, spoke1.length - 30, 1, false) },
    // Round the ring road from where the second road joins it.
    { id: 'ring-dash', name: 'Ring Dash', icon: '💫', pts: along(ring, nearestOnRing(spokeEnd(3)) + 12, 520, 1, true) },
    // From the ring back in to the middle.
    { id: 'home-run', name: 'Home Run', icon: '🏠', pts: along(spoke4, spoke4.length - 30, spoke4.length - 40, -1, false) },
    // The other way round the ring.
    { id: 'big-loop', name: 'Big Loop', icon: '🌈', pts: along(ring, nearestOnRing(spokeEnd(5)) - 12, 640, -1, true) },
  ];
  return defs.map((d) => {
    const gates = [];
    for (let k = 0; k < d.pts.length; k += GATE_EVERY) gates.push(d.pts[k]);
    const last = d.pts[d.pts.length - 1];
    if (gates[gates.length - 1] !== last) gates.push(last);
    let length = 0;
    for (let k = 1; k < gates.length; k++) length += Math.hypot(gates[k].x - gates[k - 1].x, gates[k].z - gates[k - 1].z);
    return { id: d.id, name: d.name, icon: d.icon, gates, length };
  });
}

/** Seconds for 3 stars: the course at 85% of the vehicle's top speed, plus a start. */
export function parTime(race, car) {
  return race.length / ((car.handling.maxSpeed / UNITS_PER_METRE) * 0.85) + 3;
}

export function starsFor(time, par) {
  return time <= par ? 3 : time <= par * 1.35 ? 2 : 1;
}

/** Did the step from (ax, az) to (bx, bz) cross gate g in its direction? */
function crossed(g, ax, az, bx, bz) {
  const before = (ax - g.x) * g.tx + (az - g.z) * g.tz;
  const after = (bx - g.x) * g.tx + (bz - g.z) * g.tz;
  if (!(before < 0 && after >= 0)) return false;
  const lat = (bx - g.x) * -g.tz + (bz - g.z) * g.tx;
  return Math.abs(lat) < GATE_HALF;
}

/** The race in progress (if any) for one free-drive session. */
export class FlagRacer {
  constructor(session) {
    this.s = session;
    this.races = session.world.flagRaces || [];
    this.cancel();
  }

  cancel() {
    this.race = null;
    this.next = 0;
    this.start = 0;
  }

  get time() {
    return this.race ? this.s.time - this.start : 0;
  }

  step() {
    const S = this.s;
    const p = S.player;
    if (!this.race) {
      // Through a start arch the right way: go!
      for (const r of this.races) {
        if (!crossed(r.gates[0], p.prevX, p.prevZ, p.x, p.z)) continue;
        this.race = r;
        this.next = 1;
        this.start = S.time;
        this.par = parTime(r, S.car);
        S.emit({ type: 'countdown', n: 0 });
        S.emit({ type: 'flagStart', id: r.id, name: r.name, icon: r.icon, gates: r.gates.length - 1 });
        return;
      }
      return;
    }
    const r = this.race;
    // The next gate, or one of the two after it (a gate missed on the way).
    let hit = -1;
    for (let k = this.next; k < Math.min(r.gates.length, this.next + 3); k++)
      if (crossed(r.gates[k], p.prevX, p.prevZ, p.x, p.z)) {
        hit = k;
        break;
      }
    const g = r.gates[this.next];
    if (hit >= 0) {
      this.next = hit + 1;
      if (this.next < r.gates.length) {
        S.emit({ type: 'gate', n: this.next - 1, of: r.gates.length - 1 });
        return;
      }
      const time = this.time;
      const stars = starsFor(time, this.par);
      const points = FLAG_POINTS + STAR_POINTS * stars;
      S.fun.score += points;
      S.emit({ type: 'flagFinish', id: r.id, name: r.name, icon: r.icon, time, stars });
      S.emit({ type: 'score', kind: 'flag', points, combo: 1, total: S.fun.score, label: '⭐'.repeat(stars) });
      this.cancel();
      return;
    }
    if (Math.hypot(p.x - g.x, p.z - g.z) > LOST) {
      S.emit({ type: 'flagLost', id: r.id });
      this.cancel();
    }
  }
}
