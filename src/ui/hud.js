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
      pos: document.getElementById('hud-pos'),
      posPill: document.getElementById('hud-pos-pill'),
      countdown: document.getElementById('countdown'),
    };
    this.el.nitroLabel = this.el.nitro.querySelector('span');
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

  /** Race mode on/off (shows position, lap x/y). */
  setRace(race) {
    this.race = race;
    this.el.posPill.hidden = !race || race.mode === 'timetrial';
    this.el.countdown.hidden = true;
    this.last = {};
  }

  update(session) {
    const p = session.player;
    const race = this.race;
    if (race && race.mode !== 'timetrial') this.set('pos', `${race.position()}/${race.entrants.filter((b) => !b.result || !b.result.eliminated).length}`);
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
    }
    const charge = Math.round(p.superCharge * 40) / 40;
    const ready = p.superCharge >= 1 && !p.super;
    const state = `${charge}|${ready}|${!!p.super}|${fuel <= 0}`;
    if (this.last.superState !== state) {
      this.last.superState = state;
      const n = this.el.nitro;
      n.style.setProperty('--super', String(p.super ? p.superTime / 3.5 : charge));
      n.classList.toggle('super-ready', ready);
      n.classList.toggle('super-on', !!p.super);
      n.classList.toggle('empty', fuel <= 0 && !ready && !p.super);
      this.el.nitroLabel.textContent = ready || p.super ? 'SUPER' : 'NITRO';
    } else if (p.super) {
      this.el.nitro.style.setProperty('--super', String(p.superTime / 3.5));
    }
    this.set('lap', race ? `${Math.min(p.lap, race.laps)}/${race.laps}` : String(p.lap));
    this.set('time', race ? (race.clock > 0 ? formatTime(race.clock) : '0:00.00') : p.timing ? formatTime(p.lapTime) : '0:00.00');
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
    if (e.type === 'countdown') {
      const c = this.el.countdown;
      c.hidden = false;
      c.textContent = e.n > 0 ? String(e.n) : 'GO!';
      c.classList.toggle('go', e.n === 0);
      c.classList.remove('pop');
      void c.offsetWidth;
      c.classList.add('pop');
      clearTimeout(this.countTimer);
      if (e.n === 0) this.countTimer = setTimeout(() => (c.hidden = true), 900);
      return;
    }
    if (e.type === 'finalLap') {
      this.toast('Final lap!', 1600);
      return;
    }
    if (e.type === 'racerOut') {
      this.toast(`${e.name} is out!`, 1600);
      return;
    }
    if (e.type === 'finish' || e.type === 'eliminated') {
      this.popup(e.type === 'finish' ? 'FINISH!' : 'KNOCKED OUT!', '', true);
      return;
    }
    if (e.type === 'superReady') {
      this.toast('SUPER NITRO ready! Tap the gold button', 2200);
      return;
    }
    if (e.type === 'super') {
      this.popup('SUPER NITRO!', '', true);
      return;
    }
    if (e.type === 'animal' && !e.first) {
      this.popup(`${e.icon} 💗`, '', true);
      return;
    }
    if (e.type === 'score' && e.kind === 'animal') {
      this.popup(`${e.label} +${e.points}`, '', true);
      return;
    }
    if (e.type === 'score') {
      const big = (e.kind === 'jump' && e.label === 'BIG AIR') || e.kind === 'trick';
      this.popup(`${e.label}! +${e.points}`, e.combo > 1 ? `×${e.combo}` : '', big || e.combo >= 4);
      return;
    }
    if (e.type === 'flagStart') {
      this.toast(`${e.icon} ${e.name}: drive through the gates!`, 2400);
      return;
    }
    if (e.type === 'flagFinish') {
      this.popup('⭐'.repeat(e.stars), formatTime(e.time), true);
      this.toast(e.best ? `${e.icon} ${e.name}: new best!` : `${e.icon} ${e.name} · ${formatTime(e.time)}`, 2600);
      return;
    }
    if (e.type === 'flagLost') {
      this.toast('🏁 Race over: drive through a flag to try again', 2600);
      return;
    }
    if (e.type === 'score' && e.kind === 'flag') return; // the stars popup says it
    if (e.type === 'rescue') {
      this.popup('🛟', '', true);
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
