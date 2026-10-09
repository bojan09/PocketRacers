// Fun & scoring layer on top of the driving physics: collectible stars,
// knock-over cones, boost pads, near misses, drifts, jumps and a combo
// multiplier. Pure logic (no DOM) so it is unit-testable like the session.

import { loopDelta, wrap } from '../core/util.js';

export const POINTS = {
  star: 50,
  nearMiss: 150,
  smash: 40,
  jumpPerSecond: 300,
  jumpMin: 100,
  driftPerSecond: 150,
};
// Nitro refills (fraction of a full tank) earned per trick.
export const NITRO_REFILL = {
  jumpPerSecond: 0.45,
  jumpMin: 0.25,
  star: 0.06,
  nearMiss: 0.15,
  smash: 0.05,
  driftPerSecond: 0.08,
  boost: 0.2,
};
const COMBO_WINDOW = 3; // seconds to chain the next trick
const MAX_COMBO = 5;
const PICKUP_DZ_M = 1.8;
const STAR_DX = 0.24; // road half-widths
const CONE_DZ_M = 1.3;

export class FunSystem {
  constructor(session) {
    this.session = session;
    this.reset();
  }

  reset() {
    const T = this.session.track;
    this.stars = (T.starDefs || []).map((s) => ({ ...s, taken: false }));
    this.cones = (T.coneDefs || []).map((c) => ({ ...c, hitTime: -1, kickX: 0, kickZ: 0 }));
    this.score = 0;
    this.combo = 1;
    this.comboLeft = 0;
    this.driftTime = 0;
    this.stats = { stars: 0, nearMiss: 0, smash: 0, jumps: 0, bestAir: 0 };
  }

  /** Stars and cones come back every lap. */
  respawn() {
    for (const s of this.stars) s.taken = false;
    for (const c of this.cones) c.hitTime = -1;
  }

  refill(amount) {
    const p = this.session.player;
    const before = p.nitroFuel;
    p.nitroFuel = Math.min(1, p.nitroFuel + amount);
    if (p.nitroFuel > before + 0.001) this.session.emit({ type: 'nitroRefill', amount: p.nitroFuel - before, fuel: p.nitroFuel });
  }

  award(kind, base, label) {
    this.combo = this.comboLeft > 0 ? Math.min(MAX_COMBO, this.combo + 1) : 1;
    this.comboLeft = COMBO_WINDOW;
    const points = Math.round(base * this.combo);
    this.score += points;
    this.session.emit({ type: 'score', kind, points, combo: this.combo, total: this.score, label });
    return points;
  }

  step(dt) {
    const S = this.session;
    const p = S.player;
    const T = S.track;
    const L = T.length;
    const mpu = T.metresPerUnit;

    if (this.comboLeft > 0) {
      this.comboLeft -= dt;
      if (this.comboLeft <= 0) this.combo = 1;
    }

    // Boost pads (only when the tyres touch the road).
    if (!p.airborne && p.speed > 0) {
      for (const b of T.boosts || []) {
        if (wrap(p.z - b.z0, L) < b.z1 - b.z0 && p.x >= b.xa && p.x <= b.xb) {
          if (p.boostTime < 0.2) {
            S.emit({ type: 'boost' });
            this.refill(NITRO_REFILL.boost);
          }
          p.boostTime = 1.6;
        }
      }
    }

    // Stars.
    for (const s of this.stars) {
      if (s.taken) continue;
      const dz = Math.abs(loopDelta(p.z, s.z, L)) * mpu;
      if (dz > PICKUP_DZ_M || Math.abs(p.x - s.x) > STAR_DX + S.carHalf * 0.5) continue;
      if (Math.abs(p.air + 0.6 - s.h) > 2.4) continue;
      s.taken = true;
      this.stats.stars++;
      this.award('star', POINTS.star, 'STAR');
      this.refill(NITRO_REFILL.star);
    }

    // Cones: knocked flying, a tiny speed loss, points.
    if (p.air < 0.8) {
      for (const c of this.cones) {
        if (c.hitTime >= 0) continue;
        const d = loopDelta(p.z, c.z, L) * mpu;
        if (Math.abs(d) > CONE_DZ_M || Math.abs(p.x - c.x) > S.carHalf + 0.04) continue;
        c.hitTime = S.time;
        c.kickX = (c.x - p.x) * 6 + (S.rand() - 0.5) * 2;
        c.kickZ = Math.max(4, p.speed * mpu * 0.7);
        p.speed *= 0.97;
        this.stats.smash++;
        this.award('smash', POINTS.smash, 'SMASH');
        this.refill(NITRO_REFILL.smash);
      }
    }

    // Drifting.
    if (p.sliding && !p.airborne) {
      this.driftTime += dt;
      if (this.driftTime > 3) {
        this.award('drift', POINTS.driftPerSecond * this.driftTime, 'DRIFT');
        this.refill(NITRO_REFILL.driftPerSecond * this.driftTime);
        this.driftTime = 0;
      }
    } else if (this.driftTime > 0) {
      if (this.driftTime > 0.6) {
        this.award('drift', POINTS.driftPerSecond * this.driftTime, 'DRIFT');
        this.refill(NITRO_REFILL.driftPerSecond * this.driftTime);
      }
      this.driftTime = 0;
    }
  }

  onLand(airTime) {
    if (airTime < 0.35) return;
    this.stats.jumps++;
    this.stats.bestAir = Math.max(this.stats.bestAir, airTime);
    this.award('jump', Math.max(POINTS.jumpMin, POINTS.jumpPerSecond * airTime), airTime > 1.1 ? 'BIG AIR' : 'JUMP');
    this.refill(Math.max(NITRO_REFILL.jumpMin, NITRO_REFILL.jumpPerSecond * airTime));
  }

  onNearMiss() {
    this.stats.nearMiss++;
    this.award('nearMiss', POINTS.nearMiss, 'CLOSE CALL');
    this.refill(NITRO_REFILL.nearMiss);
  }
}
