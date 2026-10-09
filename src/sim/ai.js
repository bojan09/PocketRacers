// AI racing driver. Produces the same input a player would (steer,
// throttle, brake, nitro) from what it can "see": the curvature ahead, the
// cars around it, ramps and boost pads. It drives the shared physics, so it
// obeys exactly the same rules as the player. Pure logic, unit-tested.

import { clamp, loopDelta, mulberry32 } from '../core/util.js';

export const DIFFICULTY = {
  easy: { skill: 0.86, corner: 0.8, nitro: 0.4 },
  normal: { skill: 0.93, corner: 0.9, nitro: 0.7 },
  hard: { skill: 0.985, corner: 0.97, nitro: 1 },
};
const NITRO_REGEN = 0.05; // AI tanks refill slowly (they don't score tricks)
const RUBBER_BAND = 9000; // sim units of gap before catch-up/slow-down kicks in

export class AIDriver {
  /**
   * @param session  DrivingSession
   * @param body     the racer body this AI drives
   * @param o.difficulty  'easy' | 'normal' | 'hard'
   * @param o.seed   personality (preferred lane, jump-happiness)
   */
  constructor(session, body, { difficulty = 'normal', seed = 1 } = {}) {
    this.session = session;
    this.body = body;
    this.level = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const rand = mulberry32(seed * 7919 + 13);
    this.rand = rand;
    this.lane = (rand() - 0.5) * 0.7; // personal preferred line
    this.jumpy = rand() < 0.6; // goes for ramps
    this.mood = 0.97 + rand() * 0.05; // small per-driver pace spread
    this.out = { steer: 0, analog: true, throttle: 1, brake: 0, nitro: false };
    this.enabled = true;
  }

  onLand() {
    this.body.p.nitroFuel = Math.min(1, this.body.p.nitroFuel + 0.25);
  }

  /** How far around the lap this car is (for rubber-banding). */
  static progress(p, L) {
    const behindLine = !p.halfway && p.z > L * 0.75;
    return (p.lap - 1) * L + (behindLine ? p.z - L : p.z);
  }

  input(dt) {
    const o = this.out;
    if (!this.enabled) {
      o.throttle = 0;
      o.brake = 0;
      o.steer = 0;
      o.nitro = false;
      return o;
    }
    const S = this.session;
    const T = S.track;
    const L = T.length;
    const p = this.body.p;
    const car = this.body.car;
    const h = car.handling;
    p.nitroFuel = Math.min(1, p.nitroFuel + NITRO_REGEN * dt);

    // --- Look ahead along the track -------------------------------------
    const look = Math.max(4000, p.speed * 1.3);
    let maxCurve = 0;
    let turn = 0; // signed curvature weighted towards nearby bends
    for (let d = 0; d <= look; d += T.segmentLength * 4) {
      const c = T.findSegment(p.z + d).curve;
      const assist = 1 - (T.findSegment(p.z + d).bankAssist || 0);
      maxCurve = Math.max(maxCurve, Math.abs(c) * assist);
      turn += c * (1 - d / (look * 1.5));
    }

    // --- Speed: fastest the bend allows, scaled by skill ----------------
    let skill = this.level.skill * this.mood;
    const player = S.player;
    const gap = AIDriver.progress(p, L) - AIDriver.progress(player, L);
    if (gap > RUBBER_BAND) skill *= 0.93; // well ahead: ease off a little
    else if (gap < -RUBBER_BAND) skill *= 1.05; // well behind: try harder
    let target = h.maxSpeed * skill;
    if (maxCurve > 0.05) {
      // Lateral demand curve * sp^2 * centrifugal must stay within grip.
      const spMax = Math.sqrt((h.steerSpeed * this.level.corner * 0.85) / (maxCurve * h.centrifugal));
      target = Math.min(target, spMax * h.maxSpeed);
    }
    o.throttle = p.speed < target ? 1 : 0;
    o.brake = p.speed > target * 1.12 && !p.airborne ? 0.7 : 0;

    // --- Line: preferred lane, inside of bends, ramps, and traffic ------
    let tx = clamp(this.lane - Math.sign(turn) * Math.min(0.45, Math.abs(turn) * 0.08), -0.75, 0.75);
    if (this.jumpy) {
      for (const r of T.ramps || []) {
        const ahead = loopDelta(p.z, r.z0, L);
        if (ahead > 0 && ahead < 9000) tx = r.x;
      }
    }
    for (const b of S.boosts || T.boosts || []) {
      const ahead = loopDelta(p.z, b.z0, L);
      if (ahead > 0 && ahead < 5000 && Math.abs(b.x - tx) < 0.5) tx = b.x;
    }
    // Avoid whatever is just ahead in our path: pick the roomier side.
    const others = [S.body, ...S.racers.filter((r) => r !== this.body)];
    for (const ob of others) {
      const ahead = loopDelta(p.z, ob.p.z, L);
      if (ahead <= 0 || ahead > 2600 + Math.max(0, p.speed - ob.p.speed) * 0.6) continue;
      if (Math.abs(ob.p.x - tx) > this.body.carHalf + ob.carHalf + 0.05) continue;
      const left = ob.p.x - (this.body.carHalf + ob.carHalf + 0.1);
      const right = ob.p.x + (this.body.carHalf + ob.carHalf + 0.1);
      tx = Math.abs(left - p.x) < Math.abs(right - p.x) && left > -0.85 ? left : right < 0.85 ? right : left;
    }
    for (const c of S.traffic) {
      const ahead = loopDelta(p.z, c.z, L);
      if (ahead > 0 && ahead < 3500 && Math.abs(c.x - tx) < this.body.carHalf + 0.18) tx = c.x > 0 ? c.x - 0.45 : c.x + 0.45;
    }
    tx = clamp(tx, -0.85, 0.85);

    // --- Steering: aim at the line, cancel the bend's outward push ------
    const seg = T.findSegment(p.z);
    const sp = p.speed / h.maxSpeed;
    const push = (seg.curve * sp * Math.abs(sp) * h.centrifugal * (1 - (seg.bankAssist || 0))) / h.steerSpeed;
    o.steer = p.airborne ? 0 : clamp((tx - p.x) * 2.6 - (p.latVel - push * h.steerSpeed) * 0.25 + push, -1, 1);

    // --- Nitro on straights ----------------------------------------------
    this.nitroTimer = (this.nitroTimer ?? 0) - dt;
    if (this.nitroTimer <= 0) {
      this.nitroTimer = 1;
      this.wantsNitro = this.rand() < this.level.nitro;
    }
    o.nitro = this.wantsNitro && maxCurve < 0.6 && sp > 0.6 && p.nitroFuel > 0.25 && !p.airborne;
    return o;
  }
}
