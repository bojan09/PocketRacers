// Multi-touch on-screen controls: steering buttons, pedals, nitro and a
// virtual steering wheel. One pointer-captured layer hit-tests every active
// pointer, so a thumb can slide between buttons without lifting and nothing
// stays pressed after an interrupted touch.

const BUTTONS = ['left', 'right', 'gas', 'brake', 'nitro'];
const HIT_PAD = 14; // px of forgiveness around each button
const WHEEL_DEADZONE = 0.18; // fraction of wheel radius where angle is unstable

export class TouchControls {
  constructor(layer) {
    this.layer = layer;
    // A control may appear more than once (e.g. brake on either side,
    // depending on the scheme); only visible elements receive touches.
    this.targets = [];
    for (const el of layer.querySelectorAll('[data-control]')) {
      if (el.dataset.control !== 'wheel') this.targets.push({ name: el.dataset.control, el, rect: null });
    }
    this.wheelEl = layer.querySelector('[data-control="wheel"]');
    this.wheelSpin = this.wheelEl?.querySelector('.wheel-spin');
    this.wheelRect = null;
    this.pointers = new Map();
    this.state = { left: false, right: false, gas: false, brake: false, nitro: false, wheel: 0, wheelActive: false };
    this.wheelAngle = 0; // degrees
    this.fullLock = 120; // degrees of wheel rotation for full steering
    this.enabled = false;

    const opts = { passive: false };
    layer.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    layer.addEventListener('pointermove', (e) => this.onMove(e), opts);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      layer.addEventListener(type, (e) => this.onUp(e), opts);
    }
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setSensitivity(sensitivity) {
    this.fullLock = 120 / sensitivity;
  }

  /** Cache control rectangles; call after layout or scheme changes. */
  measure() {
    for (const t of this.targets) {
      const r = t.el.getBoundingClientRect();
      t.rect = r.width > 0 ? r : null;
    }
    const w = this.wheelEl?.getBoundingClientRect();
    this.wheelRect = w && w.width > 0 ? w : null;
  }

  hit(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const { name, rect: r } of this.targets) {
      if (!r) continue;
      if (x < r.left - HIT_PAD || x > r.right + HIT_PAD || y < r.top - HIT_PAD || y > r.bottom + HIT_PAD) continue;
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
  }

  onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    try {
      this.layer.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    const p = { x: e.clientX, y: e.clientY, control: null, lastAngle: 0 };
    const w = this.wheelRect;
    if (w && !this.state.wheelActive) {
      const cx = w.left + w.width / 2;
      const cy = w.top + w.height / 2;
      const r = w.width / 2;
      if (Math.hypot(p.x - cx, p.y - cy) <= r + HIT_PAD) {
        p.control = 'wheel';
        p.lastAngle = Math.atan2(p.y - cy, p.x - cx);
        this.state.wheelActive = true;
        this.wheelEl.classList.add('pressed');
      }
    }
    if (!p.control) p.control = this.hit(p.x, p.y);
    this.pointers.set(e.pointerId, p);
    this.sync();
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.control === 'wheel') this.turnWheel(p);
    else p.control = this.hit(p.x, p.y);
    this.sync();
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.control === 'wheel') this.releaseWheel();
    this.sync();
  }

  turnWheel(p) {
    const w = this.wheelRect;
    const cx = w.left + w.width / 2;
    const cy = w.top + w.height / 2;
    const angle = Math.atan2(p.y - cy, p.x - cx);
    if (Math.hypot(p.x - cx, p.y - cy) > (w.width / 2) * WHEEL_DEADZONE) {
      let delta = angle - p.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      this.wheelAngle = Math.max(-this.fullLock, Math.min(this.fullLock, this.wheelAngle + (delta * 180) / Math.PI));
    }
    p.lastAngle = angle;
    this.state.wheel = this.wheelAngle / this.fullLock;
    if (this.wheelSpin) this.wheelSpin.style.transform = `rotate(${this.wheelAngle}deg)`;
  }

  releaseWheel() {
    this.state.wheelActive = false;
    this.state.wheel = 0;
    this.wheelAngle = 0;
    this.wheelEl?.classList.remove('pressed');
    if (this.wheelSpin) this.wheelSpin.style.transform = 'rotate(0deg)';
  }

  sync() {
    for (const name of BUTTONS) {
      let down = false;
      for (const p of this.pointers.values()) {
        if (p.control === name) {
          down = true;
          break;
        }
      }
      if (this.state[name] !== down) {
        this.state[name] = down;
        for (const t of this.targets) if (t.name === name) t.el.classList.toggle('pressed', down);
      }
    }
  }

  releaseAll() {
    for (const id of this.pointers.keys()) {
      try {
        this.layer.releasePointerCapture(id);
      } catch {
        /* already released */
      }
    }
    this.pointers.clear();
    this.releaseWheel();
    this.sync();
  }
}
