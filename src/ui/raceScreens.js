// Race menus: the events list (career ladder) and the results screen.

import { EVENTS, vehicleFor, rewards } from '../data/events.js';
import { FAMILIES } from '../data/vehicleFamilies.js';
import { VEHICLE_BY_ID } from '../data/vehicles.js';
import { formatTime } from './hud.js';
import { TRACK_BY_ID } from '../data/tracks/index.js';

const $ = (id) => document.getElementById(id);
const MODE_LABEL = { race: 'Race', elimination: 'Knockout', timetrial: 'Time trial' };
const ORDINAL = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const starRow = (n) => '<b>★</b>'.repeat(n) + '★'.repeat(3 - n);

export class EventsScreen {
  constructor({ career, garage, onPick, onBack, click }) {
    Object.assign(this, { career, garage, onPick, onBack, click });
    this.root = $('screen-events');
    $('events-back').addEventListener('click', () => {
      click();
      onBack();
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
    const c = this.career;
    $('events-stars').textContent = `★ ${c.totalStars} / ${EVENTS.length * 3}`;
    const grid = $('event-grid');
    grid.textContent = '';
    for (const e of EVENTS) {
      const open = c.unlocked(e);
      const b = document.createElement('button');
      b.className = open ? 'event-card' : 'event-card locked';
      const rule = e.families ? e.families.map((f) => FAMILIES[f].label).join(' · ') : 'Any vehicle';
      const v = vehicleFor(e, this.garage);
      const best = c.best(e.id);
      b.innerHTML = `
        <span class="meta"></span>
        <h3></h3>
        <span class="map"></span>
        <p></p>
        <span class="stars">${starRow(c.stars(e.id))}</span>
        <span class="car"></span>`;
      b.querySelector('.meta').textContent = `${MODE_LABEL[e.mode]} · ${e.laps} lap${e.laps > 1 ? 's' : ''} · ${rule}`;
      b.querySelector('h3').textContent = e.name;
      b.querySelector('.map').textContent = `📍 ${TRACK_BY_ID[e.track].name}`;
      b.querySelector('p').textContent = e.blurb;
      b.querySelector('.car').textContent = `${v.loaner ? 'Loaner' : 'You drive'}: ${VEHICLE_BY_ID[v.id].name}${best ? ` · Best ${formatTime(best)}` : ''} · up to ★${rewards(e)[0].toLocaleString()}`;
      if (!open) {
        const lock = document.createElement('span');
        lock.className = 'lock';
        lock.textContent = `🔒 ${e.need} ★`;
        b.append(lock);
      }
      b.addEventListener('click', () => {
        this.click();
        if (open) this.onPick(e);
      });
      grid.append(b);
    }
  }
}

export class ResultsScreen {
  constructor({ onRetry, onNext, onEvents, click }) {
    this.root = $('screen-results');
    $('results-retry').addEventListener('click', () => {
      click();
      onRetry();
    });
    $('results-next').addEventListener('click', () => {
      click();
      onNext();
    });
    $('results-events').addEventListener('click', () => {
      click();
      onEvents();
    });
  }

  /**
   * @param r race results  @param info {event, stars, points, medals?, next?}
   */
  show(r, info) {
    const e = info.event;
    let title;
    if (e.mode === 'timetrial') title = ['No medal', 'Bronze!', 'Silver!', 'Gold!'][info.stars];
    else if (r.eliminated) title = 'Knocked out!';
    else title = r.place === 1 ? '1st place! 🏆' : `${ORDINAL(r.place)} place`;
    $('results-title').textContent = title;
    $('results-stars').innerHTML = starRow(info.stars);
    const sub = [`Time ${formatTime(r.time)}`];
    if (r.bestLap) sub.push(`Best lap ${formatTime(r.bestLap)}`);
    if (info.medals) sub.push(`Gold ${formatTime(info.medals[0])}`);
    $('results-sub').textContent = sub.join(' · ');
    const list = $('results-standings');
    list.textContent = '';
    if (e.mode !== 'timetrial') {
      for (const s of r.standings) {
        const li = document.createElement('li');
        if (s.player) li.className = 'me';
        const pos = document.createElement('span');
        pos.textContent = s.eliminated ? 'OUT' : String(s.place);
        const who = document.createElement('span');
        who.textContent = s.name;
        const car = document.createElement('small');
        car.textContent = ` ${s.car}`;
        who.append(car);
        const t = document.createElement('small');
        t.textContent = s.eliminated ? '' : formatTime(s.time);
        li.append(pos, who, t);
        list.append(li);
      }
    }
    $('results-points').textContent = `+${info.points.toLocaleString()} ★ points`;
    const next = $('results-next');
    next.hidden = !info.next;
    next.textContent = info.next ? `Next: ${info.next.name}` : '';
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }
}
