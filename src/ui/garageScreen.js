// Garage screen: browse the roster, unlock vehicles with earned points and
// customise paint, rims, livery and ride height. DOM only; the 3D preview is
// drawn by the renderer from `previewId` and `yaw`.

import { VEHICLES, VEHICLE_BY_ID, PAINT_SWATCHES, RIM_SWATCHES, RIDE_HEIGHTS, LIVERIES, RIM_STYLES, TINTS, NEON_COLOURS, UPGRADES, UPGRADE_MAX, upgradeCost, resolveLook, vehicleStats } from '../data/vehicles.js';
import { kitSlots, KIT_OPTIONS, KIT_LABELS, TOPPERS } from '../data/kits.js';
import { FAMILIES, FAMILY_ORDER } from '../data/vehicleFamilies.js';

const $ = (id) => document.getElementById(id);
const LABELS = {
  livery: { clean: 'Clean', racing: 'Racing stripes', tri: 'Triple stripes', side: 'Side stripe', twotone: 'Two-tone', lower: 'Dipped', split: 'Split' },
  tint: { clear: 'Clear', dark: 'Dark', blue: 'Blue', gold: 'Gold', purple: 'Purple' },
  rimStyle: { spokes: 'Sport', star: 'Star', disc: 'Smooth', steel: 'Off-road' },
  ride: { low: 'Low', stock: 'Stock', lifted: 'Lifted', max: 'Monster' },
};
const UPGRADE_LABELS = {
  engine: ['Engine', 'Higher top speed'],
  turbo: ['Turbo', 'Faster acceleration'],
  tyres: ['Tyres', 'More grip in corners'],
  nitro: ['Nitro', 'Stronger, longer boost'],
};
const STATS = [
  ['speed', 'Top speed'],
  ['accel', 'Acceleration'],
  ['handling', 'Handling'],
  ['offroad', 'Off-road'],
];
// Picture filter chips: kids pick by icon, the small label is for grown-ups.
const FAMILY_ICON = { all: '⭐', race: '🏎️', sports: '🚗', muscle: '🔥', hatch: '🚘', jeep: '⛰️', suv: '🚙', pickup: '🛻', monster: '🦖', truck: '🚛' };
const SPIN_SPEED = 0.35; // rad/s while idle
const START_YAW = Math.PI - 0.65; // front three-quarter view

export class GarageScreen {
  /**
   * @param {object} o
   * @param {import('../core/garage.js').Garage} o.garage
   * @param {{points:number}} o.progress
   * @param {(id:string)=>void} o.onPreview  vehicle or its look changed: rebuild the preview
   * @param {(id:string)=>void} o.onDrive  owned vehicle chosen
   * @param {()=>void} o.onBack
   * @param {()=>void} o.click  UI sound
   * @param {(kind:string)=>void} [o.sound]  meaningful UI sounds (back, nope, buy)
   */
  constructor(o) {
    Object.assign(this, o);
    this.sound ||= () => this.click();
    this.root = $('screen-garage');
    this.previewId = this.garage.selected;
    this.filter = 'all';
    this.yaw = START_YAW;
    this.idle = 0;
    this.drag = null;
    this.buildStatic();
  }

  buildStatic() {
    // Tabs.
    for (const tab of this.root.querySelectorAll('[role=tab]')) {
      tab.addEventListener('click', () => {
        this.click();
        for (const t of this.root.querySelectorAll('[role=tab]')) t.setAttribute('aria-selected', String(t === tab));
        for (const b of this.root.querySelectorAll('.tab-body')) b.hidden = b.dataset.body !== tab.dataset.tab;
      });
    }
    // Family filter chips (only families that have vehicles).
    const fams = FAMILY_ORDER.filter((f) => VEHICLES.some((v) => v.family === f));
    const chips = $('garage-filters');
    for (const f of ['all', ...fams]) {
      const b = document.createElement('button');
      b.innerHTML = '<span aria-hidden="true"></span><small></small>';
      b.firstChild.textContent = FAMILY_ICON[f] || '🚗';
      b.lastChild.textContent = f === 'all' ? 'All' : FAMILIES[f].label;
      b.dataset.filter = f;
      b.addEventListener('click', () => {
        this.click();
        this.filter = f;
        this.renderCars();
      });
      chips.append(b);
    }
    // Colour swatches and choice rows.
    for (const box of this.root.querySelectorAll('.swatches')) {
      const key = box.dataset.key;
      for (const c of key === 'rim' ? RIM_SWATCHES : key === 'neon' ? NEON_COLOURS : PAINT_SWATCHES) {
        const b = document.createElement('button');
        if (c === 'none') b.className = 'none';
        else b.style.setProperty('--c', c);
        b.dataset.value = c;
        b.setAttribute('aria-label', c);
        b.addEventListener('click', () => this.customise(key, c));
        box.append(b);
      }
    }
    for (const box of this.root.querySelectorAll('.choices')) {
      const key = box.dataset.key;
      const values = key === 'livery' ? LIVERIES : key === 'rimStyle' ? RIM_STYLES : key === 'tint' ? Object.keys(TINTS) : key === 'topper' ? Object.keys(TOPPERS) : Object.keys(RIDE_HEIGHTS);
      for (const v of values) {
        const b = document.createElement('button');
        b.textContent = key === 'topper' ? TOPPERS[v] : LABELS[key][v];
        if (key === 'topper') b.setAttribute('aria-label', v);
        b.dataset.value = v;
        b.addEventListener('click', () => this.customise(key, v));
        box.append(b);
      }
    }
    $('garage-stats').innerHTML = STATS.map(([k, label]) => `<div class="stat"><span>${label}</span><div class="stat-bar"><i data-stat="${k}"></i></div></div>`).join('');

    $('garage-prev').addEventListener('click', () => this.step(-1));
    $('garage-next').addEventListener('click', () => this.step(1));
    $('garage-back').addEventListener('click', () => {
      this.sound('back');
      this.onBack();
    });
    $('garage-reset').addEventListener('click', () => {
      this.click();
      this.garage.resetCustom(this.previewId);
      this.onPreview(this.previewId);
      this.render();
    });
    $('garage-action').addEventListener('click', () => this.action());

    // Drag anywhere on the stage to turn the vehicle.
    const stage = $('garage-stage');
    stage.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, yaw: this.yaw, id: e.pointerId };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.yaw = this.drag.yaw + ((e.clientX - this.drag.x) / Math.max(320, window.innerWidth)) * Math.PI * 2;
    });
    const end = () => {
      this.drag = null;
      this.idle = 0;
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  open() {
    this.previewId = this.garage.selected;
    this.root.hidden = false;
    this.onPreview(this.previewId);
    this.render();
  }

  close() {
    this.root.hidden = true;
  }

  /** Advance the idle turntable. */
  tick(dt) {
    if (this.drag) return;
    this.idle += dt;
    if (this.idle > 1.5) this.yaw += SPIN_SPEED * dt;
  }

  /** Where the vehicle sits on screen, clear of the panel (NDC offsets). */
  view() {
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait) return { shiftX: 0, shiftY: 0.42 };
    const panel = this.root.querySelector('.garage-panel').getBoundingClientRect();
    const free = (window.innerWidth - panel.width - 20) / window.innerWidth;
    return { shiftX: -(1 - free), shiftY: -0.06 };
  }

  visible() {
    return this.filter === 'all' ? VEHICLES : VEHICLES.filter((v) => v.family === this.filter);
  }

  step(dir) {
    this.click();
    const list = this.visible();
    const i = list.findIndex((v) => v.id === this.previewId);
    const next = list[(i + dir + list.length) % list.length];
    this.preview(next.id);
  }

  preview(id) {
    if (id === this.previewId) return;
    this.previewId = id;
    this.yaw = START_YAW;
    this.idle = 0;
    this.onPreview(id);
    this.render();
  }

  customise(key, value) {
    this.click();
    this.garage.setCustom(this.previewId, key, value);
    this.onPreview(this.previewId);
    this.renderOptions();
  }

  action() {
    const id = this.previewId;
    if (this.garage.owns(id)) {
      this.click();
      this.garage.select(id);
      this.onDrive(id);
      return;
    }
    if (this.garage.unlock(id, this.progress)) {
      this.sound('buy');
      this.onUnlock?.(id);
      this.render();
    } else this.nope($('garage-action'));
  }

  /** "Not yet": a sound and a little shake on the button. */
  nope(el) {
    this.sound('nope');
    el.classList.remove('shake');
    void el.offsetWidth; // restart the animation
    el.classList.add('shake');
  }

  render() {
    const v = VEHICLE_BY_ID[this.previewId];
    $('garage-name').textContent = v.name;
    $('garage-family').textContent = FAMILIES[v.family].label;
    $('garage-bank').textContent = `★ ${this.progress.points.toLocaleString()}`;
    const stats = vehicleStats(v.id, this.garage.upgrades(v.id));
    for (const el of this.root.querySelectorAll('[data-stat]')) el.style.width = `${stats[el.dataset.stat] * 10}%`;
    const btn = $('garage-action');
    const owned = this.garage.owns(v.id);
    btn.classList.toggle('unlock', !owned);
    if (owned) {
      btn.disabled = false;
      btn.textContent = '✓';
      btn.setAttribute('aria-label', 'Use this car');
    } else if (this.progress.points >= v.price) {
      btn.disabled = false;
      btn.textContent = `🔓 ★ ${v.price.toLocaleString()}`;
    } else {
      // Never disabled: tapping says "not yet" with a sound.
      btn.disabled = false;
      btn.classList.add('cant');
      btn.textContent = `🔒 ★ ${(v.price - this.progress.points).toLocaleString()} more`;
    }
    if (owned || this.progress.points >= v.price) btn.classList.remove('cant');
    if (!owned) btn.removeAttribute('aria-label');
    this.renderCars();
    this.renderOptions();
    this.renderKit();
    this.renderTune();
  }

  /** Kit tab: one row of choices per slot this vehicle offers. */
  renderKit() {
    const v = VEHICLE_BY_ID[this.previewId];
    const custom = this.garage.custom(v.id);
    const box = $('garage-kit');
    box.textContent = '';
    for (const slot of kitSlots(v)) {
      const h = document.createElement('h3');
      h.textContent = KIT_LABELS.slot[slot];
      const row = document.createElement('div');
      row.className = 'choices';
      const current = custom[slot] || KIT_OPTIONS[slot][0];
      for (const opt of KIT_OPTIONS[slot]) {
        const b = document.createElement('button');
        b.textContent = KIT_LABELS[opt];
        b.setAttribute('aria-pressed', String(opt === current));
        b.addEventListener('click', () => {
          this.customise(slot, opt);
          this.renderKit();
        });
        row.append(b);
      }
      box.append(h, row);
    }
  }

  /** Tune tab: performance upgrades with level pips and a buy button. */
  renderTune() {
    const v = VEHICLE_BY_ID[this.previewId];
    const owned = this.garage.owns(v.id);
    const up = this.garage.upgrades(v.id);
    const box = $('garage-tune');
    box.textContent = '';
    for (const k of UPGRADES) {
      const level = up[k] || 0;
      const row = document.createElement('div');
      row.className = 'tune-row';
      const info = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = UPGRADE_LABELS[k][0];
      const hint = document.createElement('small');
      hint.textContent = UPGRADE_LABELS[k][1];
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < UPGRADE_MAX; i++) {
        const p = document.createElement('i');
        if (i < level) p.className = 'on';
        pips.append(p);
      }
      info.append(name, hint, pips);
      const buy = document.createElement('button');
      buy.className = 'tune-buy';
      buy.dataset.upgrade = k;
      if (level >= UPGRADE_MAX) {
        buy.textContent = 'MAX';
        buy.disabled = true;
      } else if (!owned) {
        buy.textContent = '🔒 Unlock first';
        buy.disabled = true;
      } else {
        const cost = upgradeCost(v.id, level);
        buy.textContent = `★ ${cost.toLocaleString()}`;
        buy.classList.toggle('cant', this.progress.points < cost);
        buy.addEventListener('click', () => {
          if (this.garage.buyUpgrade(v.id, k, this.progress)) {
            this.sound('buy');
            this.onPreview(v.id);
            this.render();
          } else this.nope(buy);
        });
      }
      row.append(info, buy);
      box.append(row);
    }
  }

  renderCars() {
    for (const b of $('garage-filters').children) b.setAttribute('aria-pressed', String(b.dataset.filter === this.filter));
    const grid = $('garage-cars');
    grid.textContent = '';
    for (const v of this.visible()) {
      const owned = this.garage.owns(v.id);
      const b = document.createElement('button');
      b.className = owned ? 'car-card' : 'car-card locked';
      b.setAttribute('aria-current', String(v.id === this.previewId));
      b.style.setProperty('--swatch', resolveLook(v, this.garage.custom(v.id)).body);
      const name = document.createElement('b');
      name.textContent = v.name;
      const fam = document.createElement('small');
      fam.textContent = FAMILIES[v.family].label;
      b.append(name, fam);
      if (!owned) {
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = `🔒 ★ ${v.price.toLocaleString()}`;
        b.append(price);
      } else if (v.id === this.garage.selected) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'IN USE';
        b.append(tag);
      }
      b.addEventListener('click', () => {
        this.click();
        this.preview(v.id);
      });
      grid.append(b);
    }
  }

  renderOptions() {
    const v = VEHICLE_BY_ID[this.previewId];
    const custom = this.garage.custom(v.id);
    const look = resolveLook(v, custom);
    const current = {
      ...look,
      ride: Object.keys(RIDE_HEIGHTS).find((k) => RIDE_HEIGHTS[k] === look.ride) || 'stock',
      tint: custom.tint || 'clear',
      neon: custom.neon || 'none',
      topper: custom.topper || 'none',
    };
    for (const box of this.root.querySelectorAll('.swatches[data-key], .choices[data-key]')) {
      const value = current[box.dataset.key];
      for (const b of box.children) b.setAttribute('aria-pressed', String(String(b.dataset.value).toLowerCase() === String(value).toLowerCase()));
    }
    const card = $('garage-cars').querySelector('[aria-current=true]');
    if (card) card.style.setProperty('--swatch', look.body);
  }
}
