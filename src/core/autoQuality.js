// Automatic graphics level: watches real frame times while driving and steps
// down (High → Medium → Low) when the device can't keep up. It steps back up
// only to a level that has not already been too slow, so it never flip-flops.

export const TIERS = ['low', 'medium', 'high'];
const SLOW_MS = 1000 / 45; // below ~45 fps counts as struggling
const FAST_MS = 1000 / 58;
const SLOW_FOR = 2; // seconds of struggling before stepping down
const FAST_FOR = 12; // seconds of headroom before trying a level up
const SETTLE = 1.5; // ignore frames right after a change (resize hitch)
const SMOOTH = 0.1;

export class AutoQuality {
  constructor(start = 'high') {
    this.tier = TIERS.indexOf(start);
    this.ceiling = TIERS.length - 1; // highest level not yet proven too slow
    this.reset();
  }

  get level() {
    return TIERS[this.tier];
  }

  reset() {
    this.avg = 0;
    this.slow = 0;
    this.fast = 0;
    this.settle = SETTLE;
  }

  /**
   * Feed one frame's duration (ms) while gameplay is running. Returns the new
   * level name when it changes, otherwise null.
   */
  frame(ms) {
    if (!(ms > 0)) return null;
    const dt = Math.min(ms, 1000) / 1000;
    ms = Math.min(ms, 250); // one long stall weighs like a short one
    if (this.settle > 0) {
      this.settle -= dt;
      this.avg = ms;
      return null;
    }
    this.avg += (ms - this.avg) * SMOOTH;
    this.slow = this.avg > SLOW_MS ? this.slow + dt : 0;
    this.fast = this.avg < FAST_MS ? this.fast + dt : 0;
    if (this.slow > SLOW_FOR && this.tier > 0) {
      this.ceiling = this.tier - 1;
      return this.set(this.tier - 1);
    }
    if (this.fast > FAST_FOR && this.tier < this.ceiling) return this.set(this.tier + 1);
    return null;
  }

  set(tier) {
    this.tier = tier;
    this.reset();
    return this.level;
  }
}
