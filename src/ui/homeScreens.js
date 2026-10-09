// Screens around the home menu: "Who's playing?", the picture map picker,
// the grown-up lock and the grown-up settings panel.

import { AVATARS, MAX_PROFILES } from '../core/profiles.js';
import { TRACKS, TRACK_ART } from '../data/tracks/index.js';

const $ = (id) => document.getElementById(id);

function avatarEl(id, tag = 'span') {
  const el = document.createElement(tag);
  el.className = 'avatar';
  el.textContent = AVATARS[id].icon;
  el.style.setProperty('--c', AVATARS[id].color);
  return el;
}

/** Big animal buttons. In "new" mode it shows the animals still free. */
export class ProfilesScreen {
  constructor({ profiles, onPick, onAdd, sound }) {
    Object.assign(this, { profiles, onPick, onAdd, sound });
    this.root = $('screen-profiles');
  }

  open(mode = 'pick') {
    this.mode = this.profiles.list.length ? mode : 'new';
    this.render();
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }

  render() {
    const P = this.profiles;
    const row = $('profile-row');
    row.textContent = '';
    $('profiles-title').textContent = this.mode === 'new' ? 'Pick your animal!' : "Who's playing?";
    const ids = this.mode === 'new' ? P.available() : P.list;
    for (const id of ids) {
      const b = avatarEl(id, 'button');
      b.classList.add('big');
      b.dataset.profile = id;
      b.setAttribute('aria-label', id);
      b.addEventListener('click', () => {
        this.sound('open');
        if (this.mode === 'new') this.onAdd(id);
        else this.onPick(id);
      });
      row.append(b);
    }
    if (this.mode === 'pick' && P.list.length < MAX_PROFILES) {
      // Adding a player is for grown-ups (behind the lock).
      const add = document.createElement('button');
      add.className = 'avatar big add';
      add.textContent = '+';
      add.setAttribute('aria-label', 'Add a player');
      add.addEventListener('click', () => {
        this.sound('tap');
        this.onAdd(null);
      });
      row.append(add);
    } else if (this.mode === 'new' && P.list.length) {
      const back = document.createElement('button');
      back.className = 'avatar big add';
      back.textContent = '✕';
      back.setAttribute('aria-label', 'Cancel');
      back.addEventListener('click', () => {
        this.sound('back');
        this.mode = 'pick';
        this.render();
      });
      row.append(back);
    }
  }
}

/** Free drive: one picture card per map. */
export class MapsScreen {
  constructor({ onPick, onBack, sound, current }) {
    Object.assign(this, { onPick, sound, current });
    this.root = $('screen-maps');
    $('maps-back').addEventListener('click', () => {
      sound('back');
      onBack();
    });
    const grid = $('map-grid');
    for (const t of TRACKS) {
      const art = TRACK_ART[t.id];
      const b = document.createElement('button');
      b.className = 'map-card';
      b.dataset.map = t.id;
      b.setAttribute('aria-label', t.name);
      b.style.setProperty('--sky1', art.sky[0]);
      b.style.setProperty('--sky2', art.sky[1]);
      b.style.setProperty('--ground', art.ground);
      b.innerHTML = '<span class="sun" aria-hidden="true"></span><span class="props" aria-hidden="true"></span><b></b>';
      b.querySelector('.sun').textContent = art.sun;
      b.querySelector('.props').textContent = art.icons.join('');
      b.querySelector('b').textContent = t.name;
      b.addEventListener('click', () => {
        sound('open');
        onPick(t.id);
      });
      grid.append(b);
    }
  }

  open() {
    for (const b of $('map-grid').children) b.setAttribute('aria-current', String(b.dataset.map === this.current()));
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }
}

/**
 * Grown-up lock: a two-digit sum on a number pad. A wrong answer closes it,
 * so guessing by tapping around doesn't work.
 */
export class Gate {
  constructor({ sound }) {
    this.sound = sound;
    this.root = $('screen-gate');
    const keys = $('gate-keys');
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0']) {
      const b = document.createElement('button');
      b.textContent = k;
      b.dataset.key = k;
      b.addEventListener('click', () => this.key(k));
      keys.append(b);
    }
    $('gate-cancel').addEventListener('click', () => {
      sound('back');
      this.finish(false);
    });
  }

  /** Ask; calls `done(true)` only for the right answer. */
  ask(done, rand = Math.random) {
    const a = 6 + Math.floor(rand() * 4); // 6..9
    const b = 5 + Math.floor(rand() * 5); // 5..9, so the sum is 11..18
    this.answer = String(a + b);
    this.typed = '';
    this.done = done;
    $('gate-q').textContent = `${a} + ${b}`;
    $('gate-answer').textContent = '?';
    this.root.hidden = false;
  }

  key(k) {
    if (k === '⌫') this.typed = this.typed.slice(0, -1);
    else this.typed += k;
    this.sound('tap');
    $('gate-answer').textContent = this.typed || '?';
    if (this.typed.length >= this.answer.length) {
      const ok = this.typed === this.answer;
      if (!ok) this.sound('nope');
      setTimeout(() => this.finish(ok), ok ? 0 : 250);
    }
  }

  finish(ok) {
    this.root.hidden = true;
    const done = this.done;
    this.done = null;
    done?.(ok);
  }
}

/** Grown-up settings: players, the full race list and every setting. */
export class GrownupScreen {
  constructor({ profiles, onRemove, onAdd, onRaces, onDone, onLittleDriver, sound }) {
    Object.assign(this, { profiles, onRemove, onAdd, onRaces, onLittleDriver, sound });
    this.root = $('screen-grownup');
    $('grownup-done').addEventListener('click', () => {
      sound('back');
      onDone();
    });
    $('gu-races').addEventListener('click', () => {
      sound('open');
      onRaces();
    });
  }

  open() {
    this.render();
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }

  render() {
    const box = $('gu-profiles');
    box.textContent = '';
    for (const id of this.profiles.list) {
      const row = document.createElement('div');
      row.className = 'gu-player';
      row.append(avatarEl(id));
      const ld = document.createElement('button');
      ld.className = 'btn ld';
      ld.dataset.littleDriver = id;
      const on = this.profiles.littleDriver(id);
      ld.setAttribute('aria-pressed', String(on));
      ld.textContent = on ? '🛟 Little Driver: on' : '🛟 Little Driver: off';
      ld.addEventListener('click', () => {
        this.sound('tap');
        this.onLittleDriver(id, !on);
        this.render();
      });
      row.append(ld);
      const del = document.createElement('button');
      del.className = 'btn';
      del.textContent = 'Remove';
      del.dataset.remove = id;
      del.addEventListener('click', () => {
        if (del.dataset.armed !== '1') {
          // Two taps: the first one asks to confirm.
          del.dataset.armed = '1';
          del.textContent = 'Tap again to delete';
          this.sound('nope');
          return;
        }
        this.onRemove(id);
        this.render();
      });
      row.append(del);
      box.append(row);
    }
    if (this.profiles.list.length < MAX_PROFILES) {
      const add = document.createElement('button');
      add.className = 'btn';
      add.id = 'gu-add';
      add.textContent = '+ Add a player';
      add.addEventListener('click', () => {
        this.sound('open');
        this.onAdd();
      });
      box.append(add);
    }
  }
}
