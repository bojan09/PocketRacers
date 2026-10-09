// Fixed-timestep game loop. Physics always advances in FIXED_DT steps so
// handling feels the same at 30, 60 or 120 Hz; rendering receives the
// leftover fraction (alpha) for interpolation.

export const FIXED_DT = 1 / 120;
const MAX_FRAME = 0.25; // avoid the spiral of death after a long stall

/** Advance `accumulator + frameDt` worth of fixed steps. Exposed for tests. */
export function advance(state, frameDt, stepFn) {
  state.accumulator += Math.min(frameDt, MAX_FRAME);
  let steps = 0;
  while (state.accumulator >= FIXED_DT) {
    stepFn(FIXED_DT);
    state.accumulator -= FIXED_DT;
    steps++;
  }
  return steps;
}

export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.state = { accumulator: 0 };
    this.running = false;
    this.last = 0;
    this.raf = 0;
    this.frameMs = 16.7; // smoothed, for the FPS meter / quality heuristics
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.state.accumulator = 0;
    this.raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  _tick(now) {
    if (!this.running) return;
    const dt = (now - this.last) / 1000;
    this.last = now;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    advance(this.state, dt, this.update);
    this.render(this.state.accumulator / FIXED_DT, dt);
    this.raf = requestAnimationFrame(this._tick);
  }
}
