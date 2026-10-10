// Island map: a small round map in the corner that turns with the car, and a
// big map of the whole island (tap the small one). Land you have not driven
// near yet is hidden under clouds. Home (where the drive starts) always shows:
// on the rim of the small map when it is out of sight, pointing the way back.

import { WATER, SNOW_LINE } from '../world/openWorld.js';
import { EXPLORE_GRID, EXPLORE_SPAN } from '../world/explore.js';

const BASE = 256; // pixels across the pre-drawn island picture
const SMALL_VIEW = 260; // metres from the centre to the rim of the small map
const ICONS = { castle: '🏰', lighthouse: '🗼' };
const FOG = '#c3cde0';
// Big Land: the picture of the land around the car.
const LOCAL_SPAN = 1200; // metres across
const LOCAL_PX = 128;
const LOCAL_ROWS = 8; // rows drawn per map update (15 a second)

function groundColour(world, x, z) {
  const h = world.baseHeight(x, z);
  if (h < WATER - 3) return '#2f7fd0';
  if (h < WATER) return '#4ea6e6';
  const b = world.biome(x, z, h);
  if (b === 'beach') return '#ecd9a0';
  if (b === 'snow' || h > SNOW_LINE) return '#f4f7ff';
  if (b === 'desert') return '#e3b56f';
  if (b === 'forest') return '#3f8a3a';
  return '#7cc75a';
}

export class Minimap {
  constructor({ small, big }) {
    this.small = small;
    this.big = big;
    this.world = null;
    this.timer = 0;
    this.target = null; // next flag-race gate, ringed on the maps
  }

  /** Draw the island once, and the clouds from what this player has seen. */
  setWorld(world, explore) {
    this.world = world;
    this.explore = world.endless ? null : explore;
    this.local = null;
    this.pending = null;
    if (world.endless) {
      // Big Land: no fixed picture, no clouds; the land around the car is
      // drawn as it goes (see updateLocal).
      this.base = this.fog = null;
      return;
    }
    if (this.islandWorld === world && this.islandBase) {
      this.base = this.islandBase;
      this.refog();
      return;
    }
    const c = document.createElement('canvas');
    c.width = c.height = BASE;
    const g = c.getContext('2d');
    const m = EXPLORE_SPAN / BASE;
    for (let j = 0; j < BASE; j++)
      for (let i = 0; i < BASE; i++) {
        g.fillStyle = groundColour(world, (i + 0.5) * m - EXPLORE_SPAN / 2, (j + 0.5) * m - EXPLORE_SPAN / 2);
        g.fillRect(i, j, 1, 1);
      }
    // Roads on top.
    g.strokeStyle = '#5b5f6e';
    g.lineWidth = 1.4;
    g.lineJoin = g.lineCap = 'round';
    for (const road of world.roads) {
      g.beginPath();
      road.samples.forEach((s, k) => {
        const px = (s.x + EXPLORE_SPAN / 2) / m;
        const pz = (s.z + EXPLORE_SPAN / 2) / m;
        if (k) g.lineTo(px, pz);
        else g.moveTo(px, pz);
      });
      g.stroke();
    }
    this.base = this.islandBase = c;
    this.islandWorld = world;
    this.refog();
  }

  /**
   * Big Land: keep a picture of the land around the car (LOCAL_SPAN metres
   * across), redrawn a few rows at a time when the car has moved on.
   */
  updateLocal(p) {
    const W = this.world;
    const far = !this.local || Math.hypot(p.x - this.local.x, p.z - this.local.z) > LOCAL_SPAN * 0.18;
    if (far && !this.pending) {
      const c = document.createElement('canvas');
      c.width = c.height = LOCAL_PX;
      this.pending = { x: Math.round(p.x / 64) * 64, z: Math.round(p.z / 64) * 64, canvas: c, g: c.getContext('2d'), row: 0 };
    }
    const P = this.pending;
    if (!P) return;
    const m = LOCAL_SPAN / LOCAL_PX;
    const x0 = P.x - LOCAL_SPAN / 2;
    const z0 = P.z - LOCAL_SPAN / 2;
    for (let n = 0; n < LOCAL_ROWS && P.row < LOCAL_PX; n++, P.row++)
      for (let i = 0; i < LOCAL_PX; i++) {
        P.g.fillStyle = groundColour(W, x0 + (i + 0.5) * m, z0 + (P.row + 0.5) * m);
        P.g.fillRect(i, P.row, 1, 1);
      }
    if (P.row < LOCAL_PX) return;
    // Roads on top, then swap the new picture in.
    const g = P.g;
    g.strokeStyle = '#5b5f6e';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    g.beginPath();
    for (let bz = Math.floor(z0 / 32); bz <= Math.floor((z0 + LOCAL_SPAN) / 32); bz++)
      for (let bx = Math.floor(x0 / 32); bx <= Math.floor((x0 + LOCAL_SPAN) / 32); bx++)
        for (const a of W.roadSamplesInBucket(bx, bz)) {
          const b = W.roads[a.road].samples[a.i + 1];
          if (!b) continue;
          g.moveTo((a.x - x0) / m, (a.z - z0) / m);
          g.lineTo((b.x - x0) / m, (b.z - z0) / m);
        }
    g.stroke();
    this.local = P;
    this.pending = null;
  }

  /** Rebuild the clouds (after loading a save or switching player). */
  refog() {
    if (!this.explore) return;
    const f = document.createElement('canvas');
    f.width = f.height = EXPLORE_GRID;
    const g = f.getContext('2d');
    g.fillStyle = FOG;
    g.fillRect(0, 0, EXPLORE_GRID, EXPLORE_GRID);
    // Only land hides under clouds; the sea (and the island's shape) shows.
    const land = this.explore.land;
    for (let j = 0; j < EXPLORE_GRID; j++)
      for (let i = 0; i < EXPLORE_GRID; i++) if (this.explore.seen(i, j) || !land[j * EXPLORE_GRID + i]) g.clearRect(i, j, 1, 1);
    this.fog = f;
    this.fogCtx = g;
  }

  /** Clear the clouds from newly seen cells. */
  uncover(cells) {
    if (!this.fogCtx) return;
    for (const [i, j] of cells) this.fogCtx.clearRect(i, j, 1, 1);
  }

  /** Things to show: landmarks once seen, animals (found, or a "?" once seen). */
  markers(found) {
    const W = this.world;
    const E = this.explore;
    const out = [];
    if (!E) return out;
    const seen = (x, z) => E.seen(E.cell(x), E.cell(z));
    for (const l of W.landmarks) if (ICONS[l.kind] && seen(l.x, l.z)) out.push({ x: l.x, z: l.z, icon: ICONS[l.kind] });
    if (W.stuntPark && seen(W.stuntPark.x, W.stuntPark.z)) out.push({ x: W.stuntPark.x, z: W.stuntPark.z, icon: '🤸' });
    for (const r of W.flagRaces || []) if (seen(r.gates[0].x, r.gates[0].z)) out.push({ x: r.gates[0].x, z: r.gates[0].z, icon: '🏁' });
    for (const a of W.animals) {
      if (found(a.id)) out.push({ x: a.x, z: a.z, icon: a.icon });
      else if (seen(a.x, a.z)) out.push({ x: a.x, z: a.z, icon: '❔' });
    }
    return out;
  }

  static fit(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return dpr;
  }

  /** The small round map, turned so the car always points up. */
  drawSmall(p, found, colour, dt) {
    this.timer -= dt;
    if (!this.world || this.timer > 0) return;
    this.timer = 1 / 15;
    if (this.world.endless) this.updateLocal(p);
    const cv = this.small;
    const dpr = Minimap.fit(cv);
    const R = cv.width / 2;
    const g = cv.getContext('2d');
    const s = R / SMALL_VIEW; // pixels per metre
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.beginPath();
    g.arc(R, R, R - 2 * dpr, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = this.world.endless ? FOG : '#2f7fd0';
    g.fillRect(0, 0, cv.width, cv.height);
    g.translate(R, R);
    g.rotate(-p.yaw);
    g.scale(s, s);
    g.translate(-p.x, -p.z);
    this.drawLand(g);
    g.restore();
    // Upright icons at turned positions.
    const cos = Math.cos(-p.yaw);
    const sin = Math.sin(-p.yaw);
    const at = (x, z) => {
      const dx = (x - p.x) * s;
      const dz = (z - p.z) * s;
      return [R + dx * cos - dz * sin, R + dx * sin + dz * cos];
    };
    g.font = `${Math.round(16 * dpr)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const m of this.markers(found)) {
      const [u, v] = at(m.x, m.z);
      if (Math.hypot(u - R, v - R) < R - 10 * dpr) g.fillText(m.icon, u, v);
    }
    // The next gate of a flag race.
    if (this.target) {
      const [tu, tv] = at(this.target.x, this.target.z);
      if (Math.hypot(tu - R, tv - R) < R - 8 * dpr) this.drawTarget(g, tu, tv, dpr);
    }
    // Home: inside the map, or on the rim pointing the way.
    const home = this.world.spawn;
    let [u, v] = at(home.x, home.z);
    const d = Math.hypot(u - R, v - R);
    const rim = R - 13 * dpr;
    if (d > rim) {
      const a = Math.atan2(v - R, u - R);
      u = R + Math.cos(a) * rim;
      v = R + Math.sin(a) * rim;
      g.save();
      g.translate(R + Math.cos(a) * (R - 3 * dpr), R + Math.sin(a) * (R - 3 * dpr));
      g.rotate(a);
      g.fillStyle = '#ffbe0b';
      g.beginPath();
      g.moveTo(2 * dpr, 0);
      g.lineTo(-7 * dpr, -6 * dpr);
      g.lineTo(-7 * dpr, 6 * dpr);
      g.fill();
      g.restore();
    }
    g.font = `${Math.round(18 * dpr)}px sans-serif`;
    g.fillText('🏠', u, v);
    this.drawCar(g, R, R, 0, colour, dpr);
    // Rim.
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3 * dpr;
    g.beginPath();
    g.arc(R, R, R - 2 * dpr, 0, Math.PI * 2);
    g.stroke();
  }

  /** The whole island, north up. */
  drawBig(p, found, colour) {
    if (!this.world) return;
    const cv = this.big;
    const dpr = Minimap.fit(cv);
    const g = cv.getContext('2d');
    // Fit the island (not the whole sea) into the canvas; in Big Land, the
    // land around the car.
    const endless = this.world.endless;
    const span = endless ? LOCAL_SPAN * 0.9 : this.world.radius * 2.15;
    const s = Math.min(cv.width, cv.height) / span;
    const cx = endless ? p.x : 0;
    const cz = endless ? p.z : 0;
    g.fillStyle = endless ? FOG : '#2f7fd0';
    g.fillRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2, cv.height / 2);
    g.scale(s, s);
    g.translate(-cx, -cz);
    this.drawLand(g);
    g.restore();
    const at = (x, z) => [cv.width / 2 + (x - cx) * s, cv.height / 2 + (z - cz) * s];
    g.font = `${Math.round(22 * dpr)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const m of this.markers(found)) g.fillText(m.icon, ...at(m.x, m.z));
    g.font = `${Math.round(26 * dpr)}px sans-serif`;
    g.fillText('🏠', ...at(this.world.spawn.x, this.world.spawn.z));
    if (this.target) this.drawTarget(g, ...at(this.target.x, this.target.z), dpr * 1.3);
    const [u, v] = at(p.x, p.z);
    this.drawCar(g, u, v, p.yaw, colour, dpr * 1.3);
  }

  /** Island picture and clouds in world metres (the caller sets the transform). */
  drawLand(g) {
    g.imageSmoothingEnabled = true;
    if (this.world.endless) {
      const L = this.local;
      if (L) g.drawImage(L.canvas, L.x - LOCAL_SPAN / 2, L.z - LOCAL_SPAN / 2, LOCAL_SPAN, LOCAL_SPAN);
      return;
    }
    const H = EXPLORE_SPAN / 2;
    g.drawImage(this.base, -H, -H, EXPLORE_SPAN, EXPLORE_SPAN);
    g.drawImage(this.fog, -H, -H, EXPLORE_SPAN, EXPLORE_SPAN);
  }

  drawTarget(g, u, v, k) {
    g.strokeStyle = '#ffbe0b';
    g.lineWidth = 3 * k;
    g.beginPath();
    g.arc(u, v, 6 * k, 0, Math.PI * 2);
    g.stroke();
  }

  drawCar(g, u, v, yaw, colour, k) {
    g.save();
    g.translate(u, v);
    g.rotate(yaw);
    g.fillStyle = colour;
    g.strokeStyle = '#fff';
    g.lineWidth = 2 * k;
    g.beginPath();
    g.moveTo(0, -10 * k);
    g.lineTo(7 * k, 8 * k);
    g.lineTo(0, 4 * k);
    g.lineTo(-7 * k, 8 * k);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
