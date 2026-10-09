// Player progress: total points earned across sessions (spent on unlocks in
// the garage phase). Prototype persistence uses localStorage; the versioned
// IndexedDB save system replaces this later.

const KEY = 'pocketracers.progress';

export class Progress {
  constructor() {
    this.points = 0;
    this.dirty = false;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.v === 1 && Number.isFinite(raw.points) && raw.points >= 0) this.points = Math.floor(raw.points);
    } catch {
      /* storage unavailable: start from zero */
    }
  }

  add(points) {
    if (!Number.isFinite(points) || points <= 0) return;
    this.points += Math.round(points);
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, points: this.points }));
      this.dirty = false;
    } catch {
      /* full or blocked: keep in memory */
    }
  }
}
