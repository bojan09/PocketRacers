// Race director: grid, countdown, laps, positions, elimination and results
// on top of a DrivingSession. Pure logic (unit-tested); the UI reads its
// state and events.

import { AIDriver } from './ai.js';

export const COUNTDOWN = 3; // seconds before GO
const GRID_ROW = 1500; // sim units between grid rows
const GRID_X = [-0.42, 0.42];
const FREEZE = { steer: 0, analog: false, throttle: 0, brake: 0, nitro: false };

/**
 * @param session DrivingSession (already holding the player's car)
 * @param opts.mode 'race' | 'elimination' | 'timetrial'
 * @param opts.laps number of laps
 * @param opts.opponents [{car, name}] AI cars (ignored for time trials)
 * @param opts.difficulty 'easy' | 'normal' | 'hard'
 * @param opts.gridSlot where the player starts (0 = pole)
 */
export class Race {
  constructor(session, { mode = 'race', laps = 3, opponents = [], difficulty = 'normal', gridSlot = 2 } = {}) {
    this.session = session;
    this.mode = mode;
    this.laps = laps;
    this.difficulty = difficulty;
    const S = session;
    const L = S.track.length;
    const field = mode === 'timetrial' ? [] : opponents;
    const slot = Math.min(gridSlot, field.length);
    // Grid behind the start line: two staggered columns.
    const place = (i) => ({ z: L - 600 - Math.floor(i / 2) * GRID_ROW - (i % 2) * (GRID_ROW / 2), x: GRID_X[i % 2] });
    const others = field.map((o, k) => ({ ...o, ...place(k < slot ? k : k + 1) }));
    S.reset();
    const me = place(slot);
    Object.assign(S.player, { z: me.z, prevZ: me.z, x: me.x, prevX: me.x });
    S.setRacers(others).forEach((r, i) => {
      r.ai = new AIDriver(S, r, { difficulty, seed: i + 1 });
    });
    this.entrants = [S.body, ...S.racers];
    for (const b of this.entrants) b.result = null;
    this.phase = 'countdown'; // countdown | racing | finished
    this.clock = -COUNTDOWN;
    this.lastCount = COUNTDOWN + 1;
    this.eliminatedAt = 1; // elimination happens when the leader starts lap n+1
    this.order = this.entrants.slice();
    this.results = null;
  }

  /** Input actually applied to the player this step (frozen on the grid). */
  playerInput(input) {
    return this.phase === 'countdown' ? FREEZE : input;
  }

  step(dt, input) {
    const S = this.session;
    this.clock += dt;
    if (this.phase === 'countdown') {
      const n = Math.ceil(-this.clock);
      if (n < this.lastCount && n > 0) S.emit({ type: 'countdown', n });
      this.lastCount = n;
      for (const r of S.racers) r.ai.enabled = false;
      if (this.clock >= 0) {
        this.phase = 'racing';
        this.clock = 0;
        for (const r of S.racers) r.ai.enabled = true;
        S.emit({ type: 'countdown', n: 0 });
      }
    }
    S.step(dt, this.playerInput(input));
    if (this.phase === 'countdown') {
      // Held on the grid (even on a slope) until GO.
      for (const b of this.entrants) {
        b.p.speed = 0;
        b.p.z = b.p.prevZ;
        b.p.x = b.p.prevX;
        b.p.lapTime = 0;
        b.p.timing = false;
      }
    }
    if (this.phase === 'racing') this.update();
    else if (this.phase === 'countdown') this.sortOrder();
  }

  sortOrder() {
    this.order = this.entrants.slice().sort((a, b) => {
      if (a.result && b.result) return a.result.place - b.result.place;
      if (a.result) return -1;
      if (b.result) return 1;
      return this.progress(b) - this.progress(a);
    });
  }

  /** Total distance covered (laps from the start line). */
  progress(b) {
    return AIDriver.progress(b.p, this.session.track.length);
  }

  update() {
    const S = this.session;
    const active = this.entrants.filter((b) => !b.result);
    // Finishers.
    for (const b of active) {
      if (b.p.lap > this.laps) this.finish(b, false);
    }
    // Live order: finished first (by place), then by distance.
    this.sortOrder();
    // Elimination: each time the leader starts a new lap, last place is out.
    if (this.mode === 'elimination') {
      const leaderLap = Math.max(...this.entrants.map((b) => (b.result ? 0 : b.p.lap)));
      const racing = this.order.filter((b) => !b.result);
      if (leaderLap > this.eliminatedAt && racing.length > 1) {
        this.eliminatedAt = leaderLap;
        this.finish(racing[racing.length - 1], true);
        if (this.order.filter((b) => !b.result).length === 1) this.finish(this.order.find((b) => !b.result), false);
      }
    }
    const me = S.body;
    if (!this.results && me.result) this.end();
    if (S.player.lap === this.laps && !this.finalLapShown && this.mode !== 'timetrial') {
      this.finalLapShown = true;
      S.emit({ type: 'finalLap' });
    }
  }

  finish(b, eliminated, estimate = false) {
    const S = this.session;
    const placed = this.entrants.filter((e) => e.result && !e.result.eliminated).length;
    const outs = this.entrants.filter((e) => e.result && e.result.eliminated).length;
    // Eliminated cars take the last free place.
    const place = eliminated ? this.entrants.length - outs : placed + 1;
    let time = this.clock;
    if (estimate) {
      // Still racing when the player finished: project their finish time.
      const L = S.track.length;
      const done = Math.max(1, this.progress(b));
      time = this.clock * ((this.laps * L) / done);
    }
    b.result = { place, time, eliminated, bestLap: b.p.bestLap };
    if (b.isPlayer) S.emit({ type: eliminated ? 'eliminated' : 'finish', place });
    else if (eliminated) S.emit({ type: 'racerOut', name: b.name });
  }

  /** Player is done: rank everyone still racing by distance and stop. */
  end() {
    const rest = this.order.filter((b) => !b.result);
    for (const b of rest) this.finish(b, false, true);
    this.order = this.entrants.slice().sort((a, b) => a.result.place - b.result.place);
    this.phase = 'finished';
    const me = this.session.body;
    this.results = {
      place: me.result.place,
      eliminated: me.result.eliminated,
      time: me.result.time,
      bestLap: me.p.bestLap,
      total: this.entrants.length,
      standings: this.order.map((b) => ({ name: b.isPlayer ? 'You' : b.name, car: b.car.name, place: b.result.place, time: b.result.time, eliminated: b.result.eliminated, player: b.isPlayer })),
    };
    // The AI keep cruising behind the results screen.
    return this.results;
  }

  /** Player's position (1-based) while racing. */
  position() {
    return this.order.indexOf(this.session.body) + 1;
  }
}
