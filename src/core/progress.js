// Player progress: the points wallet, earned by tricks and spent on garage
// unlocks. Saved per player profile (see profiles.js).

const KEY = 'pocketracers.progress';

export class Progress {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.load();
  }

  /** (Re)read the wallet from `this.storage`. */
  load() {
    this.points = 0;
    this.dirty = false;
    try {
      const raw = JSON.parse(this.storage?.getItem(KEY) || 'null');
      if (raw && raw.v === 1 && Number.isFinite(raw.points) && raw.points >= 0) this.points = Math.floor(raw.points);
    } catch {
      /* storage unavailable: start from zero */
    }
  }

  /** Spend points (vehicle unlocks). Returns false if there are not enough. */
  spend(points) {
    if (!Number.isFinite(points) || points < 0 || points > this.points) return false;
    this.points -= points;
    this.dirty = true;
    return true;
  }

  add(points) {
    if (!Number.isFinite(points) || points <= 0) return;
    this.points += Math.round(points);
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    try {
      this.storage?.setItem(KEY, JSON.stringify({ v: 1, points: this.points }));
      this.dirty = false;
    } catch {
      /* full or blocked: keep in memory */
    }
  }
}
