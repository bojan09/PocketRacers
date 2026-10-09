// Gameplay HUD. Writes to the DOM only when a displayed value changes.

import { SPEED_TO_KMH } from '../sim/session.js';

export function formatTime(t) {
  if (!t) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.el = {
      lap: document.getElementById('hud-lap'),
      time: document.getElementById('hud-time'),
      best: document.getElementById('hud-best'),
      speed: document.getElementById('hud-speed'),
      toast: document.getElementById('toast'),
      fps: document.getElementById('fps'),
      score: document.getElementById('hud-score'),
      combo: document.getElementById('hud-combo'),
      popups: document.getElementById('popups'),
      nitro: document.querySelector('.ctl-nitro'),
    };
    this.last = {};
    this.toastTimer = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  set(key, value) {
    if (this.last[key] !== value) {
      this.last[key] = value;
      this.el[key].textContent = value;
    }
  }

  update(session) {
    const p = session.player;
    this.set('score', session.fun.score.toLocaleString());
    const combo = session.fun.combo;
    if (this.last.comboN !== combo) {
      this.last.comboN = combo;
      this.el.combo.hidden = combo < 2;
      this.el.combo.textContent = `×${combo}`;
      this.el.combo.classList.remove('bump');
      void this.el.combo.offsetWidth;
      this.el.combo.classList.add('bump');
    }
    const fuel = Math.round(p.nitroFuel * 50) / 50;
    if (this.last.fuel !== fuel) {
      this.last.fuel = fuel;
      this.el.nitro.style.setProperty('--fuel', String(fuel));
      this.el.nitro.classList.toggle('empty', fuel <= 0);
    }
    this.set('lap', String(p.lap));
    this.set('time', p.timing ? formatTime(p.lapTime) : '0:00.00');
    this.set('best', formatTime(p.bestLap));
    this.set('speed', String(Math.round(Math.abs(p.speed) * SPEED_TO_KMH)));
  }

  toast(text, ms = 1800) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  popup(text, extra = '', big = false) {
    const box = this.el.popups;
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = big ? 'popup big' : 'popup';
    el.textContent = text;
    if (extra) {
      const small = document.createElement('small');
      small.textContent = extra;
      el.append(small);
    }
    el.addEventListener('animationend', () => el.remove());
    box.append(el);
  }

  onEvent(e) {
    if (e.type === 'score') {
      const big = e.kind === 'jump' && e.label === 'BIG AIR';
      this.popup(`${e.label}! +${e.points}`, e.combo > 1 ? `×${e.combo}` : '', big || e.combo >= 4);
      return;
    }
    if (e.type === 'boost') {
      this.popup('BOOST!');
      return;
    }
    if (e.type === 'nitroRefill') {
      const n = this.el.nitro;
      n.classList.remove('refill');
      void n.offsetWidth;
      n.classList.add('refill');
      return;
    }
    if (e.type === 'lap') {
      this.toast(e.best && e.lap > 1 ? `New best! ${formatTime(e.time)}` : `Lap ${e.lap} · ${formatTime(e.time)}`);
    }
  }

  tickFps(dt, frameMs, show) {
    if (!show) return;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsTime);
      this.el.fps.textContent = `${fps} fps · ${frameMs.toFixed(1)} ms`;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }
}
