// Fun & scoring layer on top of the driving physics: collectible stars,
// knock-over cones, boost pads, near misses, drifts, jumps and a combo
// multiplier. Pure logic (no DOM) so it is unit-testable like the session.

import { loopDelta, wrap } from '../core/util.js';
import { ANIMALS, ANIMAL_POINTS } from '../data/animals.js';
import { PROP_SIZE, PROP_POINTS } from '../data/props.js';

export const POINTS = {
  star: 50,
  nearMiss: 150,
  smash: 40,
  jumpPerSecond: 300,
  jumpMin: 100,
  driftPerSecond: 150,
  spin: [0, 400, 1000, 1800], // 360, 720, 1080
  barrel: 500,
  corkscrew: 300, // bonus for a barrel roll with a spin
  knock: 100,
  prop: PROP_POINTS,
};
// Super Nitro charge (fraction of the gold meter) earned per trick.
export const SUPER_CHARGE = {
  spin: [0, 0.3, 0.6, 1],
  barrel: 0.35,
  corkscrew: 0.2,
  bigAir: 0.15,
  nearMiss: 0.06,
};
const SPIN_NAMES = ['', '360', '720', '1080'];
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
const ANIMAL_DZ_M = 3;
const PROP_DZ_M = 1.6;
const ANIMAL_DX = 0.34; // road half-widths

export class FunSystem {
  constructor(session) {
    this.session = session;
    /** Animal ids the current player has already found (set by the game). */
    this.known = new Set();
    this.reset();
  }

  reset() {
    const T = this.session.track;
    this.stars = (T.starDefs || []).map((s) => ({ ...s, taken: false }));
    this.cones = (T.coneDefs || []).map((c) => ({ ...c, hitTime: -1, kickX: 0, kickZ: 0 }));
    this.props = (T.propDefs || []).map((p) => ({ ...p, hitTime: -1, kickX: 0, kickZ: 0, spin: 0 }));
    const SL = T.segmentLength;
    this.animals = ANIMALS.filter((a) => a.map === T.def?.id).map((a) => ({ ...a, z: a.seg * SL, met: false, hopTime: -10 }));
    this.score = 0;
    this.combo = 1;
    this.comboLeft = 0;
    this.driftTime = 0;
    this.stats = { stars: 0, nearMiss: 0, smash: 0, props: 0, jumps: 0, bestAir: 0, tricks: 0, knocks: 0, supers: 0 };
  }

  /** Stars and cones come back every lap. */
  respawn() {
    for (const s of this.stars) s.taken = false;
    for (const c of this.cones) c.hitTime = -1;
    for (const a of this.animals) a.met = false;
    for (const p of this.props) p.hitTime = -1;
  }

  refill(amount) {
    const p = this.session.player;
    const before = p.nitroFuel;
    p.nitroFuel = Math.min(1, p.nitroFuel + amount);
    if (p.nitroFuel > before + 0.001) this.session.emit({ type: 'nitroRefill', amount: p.nitroFuel - before, fuel: p.nitroFuel });
  }

  /** Fill the Super Nitro meter; announces when it becomes ready. */
  charge(amount) {
    const p = this.session.player;
    if (p.superTime > 0 || p.superCharge >= 1) return;
    p.superCharge = Math.min(1, p.superCharge + amount);
    if (p.superCharge >= 1) {
      this.stats.supers++;
      this.session.emit({ type: 'superReady' });
    }
  }

  award(kind, base, label, extra) {
    this.combo = this.comboLeft > 0 ? Math.min(MAX_COMBO, this.combo + 1) : 1;
    this.comboLeft = COMBO_WINDOW;
    const points = Math.round(base * this.combo);
    this.score += points;
    this.session.emit({ type: 'score', kind, points, combo: this.combo, total: this.score, label, ...extra });
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

    // Hidden animals: say hello when driving past (once a lap). The first
    // time for this player it is a new sticker.
    for (const a of this.animals) {
      if (a.met || p.air > 2.5) continue;
      if (Math.abs(loopDelta(p.z, a.z, L)) * mpu > ANIMAL_DZ_M || Math.abs(p.x - a.x) > ANIMAL_DX) continue;
      a.met = true;
      a.hopTime = S.time;
      const first = !this.known.has(a.id);
      this.known.add(a.id);
      S.emit({ type: 'animal', id: a.id, icon: a.icon, first });
      if (first) {
        this.score += ANIMAL_POINTS;
        S.emit({ type: 'score', kind: 'animal', points: ANIMAL_POINTS, combo: 1, total: this.score, label: a.icon, id: a.id });
      }
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

    // Smashable props on the verges: knocked flying, a small speed loss.
    if (p.air < 0.8 && Math.abs(p.x) > 0.85) {
      const rw = T.roadHalfWidthM;
      for (const o of this.props) {
        if (o.hitTime >= 0) continue;
        const d = loopDelta(p.z, o.z, L) * mpu;
        if (Math.abs(d) > PROP_DZ_M + (o.kind === 'fence' ? 0.8 : 0)) continue;
        if (Math.abs(p.x - o.x) > S.carHalf + (PROP_SIZE[o.kind] || 0.4) / rw) continue;
        o.hitTime = S.time;
        // Away from the road and ahead of the car, so it never flies into the camera.
        o.kickX = Math.sign(o.x) * (3 + S.rand() * 3);
        o.kickZ = Math.min(48, Math.max(6, p.speed * mpu * 1.15));
        o.spin = (S.rand() - 0.5) * 12;
        p.speed *= 0.95;
        this.stats.props++;
        this.award('prop', POINTS.prop, 'SMASH', { prop: o.kind });
        this.refill(NITRO_REFILL.smash);
      }
    }

    // Drifting.
    if (p.sliding && !p.airborne) {
      this.driftTime += dt;
      if (this.driftTime > 3) {
        this.award('drift', POINTS.driftPerSecond * this.driftTime, 'DRIFT', { seconds: this.driftTime });
        this.refill(NITRO_REFILL.driftPerSecond * this.driftTime);
        this.driftTime = 0;
      }
    } else if (this.driftTime > 0) {
      if (this.driftTime > 0.6) {
        this.award('drift', POINTS.driftPerSecond * this.driftTime, 'DRIFT', { seconds: this.driftTime });
        this.refill(NITRO_REFILL.driftPerSecond * this.driftTime);
      }
      this.driftTime = 0;
    }
  }

  /**
   * @param airTime seconds in the air
   * @param spin  total yaw rotation (radians) — 360s and 720s
   * @param roll  total barrel-roll rotation (radians)
   */
  onLand(airTime, spin = 0, roll = 0) {
    if (airTime < 0.35) return;
    this.stats.jumps++;
    this.stats.bestAir = Math.max(this.stats.bestAir, airTime);
    const turn = Math.PI * 2;
    const spins = Math.min(3, Math.floor((spin + 0.5) / turn)); // within ~30° counts
    const barrel = roll > turn * 0.9;
    if (!spins && !barrel) {
      const big = airTime > 1.1;
      this.award('jump', Math.max(POINTS.jumpMin, POINTS.jumpPerSecond * airTime), big ? 'BIG AIR' : 'JUMP', { airTime });
      if (big) this.charge(SUPER_CHARGE.bigAir);
    } else {
      this.stats.tricks++;
      let points = POINTS.jumpPerSecond * airTime + POINTS.spin[spins] + (barrel ? POINTS.barrel : 0);
      let charge = SUPER_CHARGE.spin[spins] + (barrel ? SUPER_CHARGE.barrel : 0);
      let label = barrel ? 'BARREL ROLL' : SPIN_NAMES[spins];
      if (barrel && spins) {
        points += POINTS.corkscrew;
        charge += SUPER_CHARGE.corkscrew;
        label = `CORKSCREW ${SPIN_NAMES[spins]}`;
      }
      this.award('trick', points, label, { airTime, spins, barrel });
      this.charge(charge);
    }
    this.refill(Math.max(NITRO_REFILL.jumpMin, NITRO_REFILL.jumpPerSecond * airTime) + (spins || barrel ? 0.15 : 0));
  }

  onKnock() {
    this.stats.knocks++;
    this.award('knock', POINTS.knock, 'BUMPED');
  }

  onNearMiss() {
    this.stats.nearMiss++;
    this.award('nearMiss', POINTS.nearMiss, 'CLOSE CALL');
    this.refill(NITRO_REFILL.nearMiss);
    this.charge(SUPER_CHARGE.nearMiss);
  }
}
