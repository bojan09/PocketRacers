// Merges keyboard (development), touch and tilt into one InputState that the
// simulation consumes. Also releases everything on focus/visibility loss so
// no control can stay stuck.

import { TouchControls } from './touchControls.js';
import { TiltInput } from './tilt.js';

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'nitro',
  KeyN: 'nitro',
};

export class InputManager {
  constructor(controlsLayer) {
    this.touch = new TouchControls(controlsLayer);
    this.tilt = new TiltInput();
    this.keys = { left: false, right: false, gas: false, brake: false, nitro: false };
    this.scheme = 'buttons';
    this.autoAccelerate = true;
    this.state = { steer: 0, analog: false, throttle: 0, brake: 0, nitro: false };
    this.onPauseKey = null;
    this.onHonkKey = null;

    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) {
        this.keys[k] = true;
        e.preventDefault();
      } else if ((e.code === 'Escape' || e.code === 'KeyP') && this.onPauseKey) {
        this.onPauseKey();
      } else if (e.code === 'KeyH' && !e.repeat && this.onHonkKey) {
        this.onHonkKey();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.keys[k] = false;
    });
    const release = () => this.releaseAll();
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', () => document.hidden && release());
  }

  configure(settings) {
    this.scheme = settings.controlScheme;
    this.autoAccelerate = settings.autoAccelerate;
    this.touch.setSensitivity(settings.steerSensitivity);
    this.tilt.setSensitivity(settings.steerSensitivity);
    this.tilt.offset = settings.tiltOffset;
  }

  releaseAll() {
    for (const k in this.keys) this.keys[k] = false;
    this.touch.releaseAll();
  }

  read() {
    const k = this.keys;
    const t = this.touch.state;
    const s = this.state;
    s.analog = false;
    if (k.left || k.right) {
      s.steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    } else if (this.scheme === 'wheel') {
      s.steer = t.wheel;
      s.analog = true;
    } else if (this.scheme === 'tilt') {
      s.steer = this.tilt.steer;
      s.analog = true;
    } else {
      s.steer = (t.right ? 1 : 0) - (t.left ? 1 : 0);
    }
    const brake = k.brake || t.brake;
    s.brake = brake ? 1 : 0;
    s.nitro = k.nitro || t.nitro;
    s.throttle = brake ? 0 : this.autoAccelerate || k.gas || t.gas ? 1 : 0;
    return s;
  }
}
