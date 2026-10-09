// Tilt steering from the Device Orientation API.
//
// Instead of reading a single Euler angle (which only works for one way of
// holding the phone), we rebuild the device's "up" vector from beta/gamma,
// project it onto the screen's horizontal axis for the current screen
// rotation, and use the resulting roll angle. That works in portrait and
// landscape, whether the device is held upright like a wheel or tilted back.

const DEG = Math.PI / 180;
const DEADZONE = 1.5; // degrees
const SMOOTHING_TAU = 0.06; // seconds
const NO_DATA_TIMEOUT = 1500; // ms to wait for the first real reading

export function tiltSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

function screenAngle() {
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  return Number(a) || 0;
}

/** Roll angle in degrees, positive = tilted to steer right. Exported for tests. */
export function rollFromOrientation(beta, gamma, screenAngleDeg) {
  const b = beta * DEG;
  const g = gamma * DEG;
  // World "up" in device coordinates for the Z-X'-Y'' Euler convention.
  const ux = -Math.cos(b) * Math.sin(g);
  const uy = Math.sin(b);
  const th = screenAngleDeg * DEG;
  const sx = ux * Math.cos(th) - uy * Math.sin(th);
  return Math.asin(Math.max(-1, Math.min(1, -sx))) / DEG;
}

export class TiltInput {
  constructor() {
    this.raw = 0; // smoothed roll in degrees
    this.offset = 0;
    this.range = 28; // degrees for full lock
    this.active = false;
    this.hasData = false;
    this.lastTime = 0;
    this._onEvent = this._onEvent.bind(this);
  }

  /** Must be called from a user gesture (iOS permission prompt). */
  async requestPermission() {
    if (!tiltSupported()) return 'unsupported';
    const DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      try {
        return (await DOE.requestPermission()) === 'granted' ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    return 'granted';
  }

  /** Start listening; resolves true once real sensor data arrives. */
  start() {
    if (!this.active) {
      window.addEventListener('deviceorientation', this._onEvent);
      this.active = true;
    }
    if (this.hasData) return Promise.resolve(true);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const check = () => {
        if (this.hasData) resolve(true);
        else if (performance.now() - t0 > NO_DATA_TIMEOUT) resolve(false);
        else setTimeout(check, 50);
      };
      check();
    });
  }

  stop() {
    window.removeEventListener('deviceorientation', this._onEvent);
    this.active = false;
  }

  setSensitivity(sensitivity) {
    this.range = 28 / sensitivity;
  }

  calibrate() {
    this.offset = this.raw;
    return this.offset;
  }

  _onEvent(e) {
    if (e.beta == null || e.gamma == null) return;
    const roll = rollFromOrientation(e.beta, e.gamma, screenAngle());
    const now = e.timeStamp || performance.now();
    if (!this.hasData) {
      this.raw = roll;
      this.hasData = true;
    } else {
      const dt = Math.min(0.1, Math.max(0.001, (now - this.lastTime) / 1000));
      this.raw += (roll - this.raw) * (1 - Math.exp(-dt / SMOOTHING_TAU));
    }
    this.lastTime = now;
  }

  /** Steering value in [-1, 1]. */
  get steer() {
    let a = this.raw - this.offset;
    if (Math.abs(a) < DEADZONE) return 0;
    a -= Math.sign(a) * DEADZONE;
    return Math.max(-1, Math.min(1, a / (this.range - DEADZONE)));
  }
}
