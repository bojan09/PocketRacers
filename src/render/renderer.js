// Pseudo-3D road renderer (segment projection, the classic arcade technique).
// Draws in device pixels. Per-frame work is allocation-free: projection
// scratch lives on the segments, colours are pre-mixed with fog at load, and
// all art is pre-rendered to offscreen canvases.

import { clamp, lerp, mixHex, mulberry32, wrap } from '../core/util.js';
import { CAR_ANCHORS, CAR_ASPECT, drawCarSprite } from './carArt.js';
import { buildBackground, buildSceneryAtlas } from './scenery.js';

const FOG_LEVELS = 16;
const QUALITY = {
  high: { dprCap: 2, drawDistance: 220, particles: 1 },
  medium: { dprCap: 1.5, drawDistance: 160, particles: 0.6 },
  low: { dprCap: 1, drawDistance: 110, particles: 0.3 },
};
const RAIL_X = 1.12;
const RAIL_H = 260;
const MAX_PARTICLES = 200;
// smoke, dust, spark, nitro flame
const PARTICLE_COLOR = ['#ebeef5', '#78aa46', '#ffdc5a', '#ffa028'];
const PARTICLE_ALPHA = [0.5, 1, 1, 0.8];

export class Renderer {
  constructor(canvas, track, carDef, trafficPaints) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.track = track;
    this.carDef = carDef;
    this.trafficPaints = trafficPaints;
    this.quality = QUALITY.high;
    this.reduceEffects = false;
    this.atlas = buildSceneryAtlas(1);
    this.bg = buildBackground(track.palette);
    this.fog = this.buildFogTable(track.palette);
    this.skyOffset = 0;
    this.shake = 0;
    this.nitroFx = 0; // 0..1 eased nitro intensity
    this.camLagX = 0;
    this.flash = 0;
    this.rand = mulberry32(5);
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push({ life: 0 });
    this.trafficSprites = [];
    this.playerSprites = null;
    this.playerScreen = { cx: 0, cy: 0, w: 0, h: 0, valid: false };
    this.paint = carDef.paint;
    this.resize();
  }

  setQuality(name) {
    this.quality = QUALITY[name] || QUALITY.high;
    this.resize();
  }

  setPaint(paint) {
    this.paint = paint;
    this.buildCarSprites();
  }

  buildFogTable(pal) {
    const keys = ['grassLight', 'grassDark', 'rumbleLight', 'rumbleDark', 'roadLight', 'roadDark', 'lane'];
    const table = {};
    for (const k of keys) {
      table[k] = [];
      for (let i = 0; i < FOG_LEVELS; i++) table[k].push(mixHex(pal[k], pal.fog, i / (FOG_LEVELS - 1)));
    }
    return table;
  }

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    this.dpr = dpr;
    this.W = Math.round(cssW * dpr);
    this.H = Math.round(cssH * dpr);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const portrait = this.H > this.W;
    this.portrait = portrait;
    // Layout: horizon/car placement and camera height per orientation. In
    // portrait the camera rises so more of the road's width fits on screen.
    this.camH = this.track.cameraHeight * (portrait ? 1.8 : 1);
    this.baseHorizon = this.H * (portrait ? 0.4 : 0.4);
    this.carY = this.H * (portrait ? 0.74 : 0.93);
    this.baseFocal = portrait ? 0.34 * this.H : 0.42 * this.W;
    this.playerZ = (this.baseFocal * this.camH) / (this.carY - this.baseHorizon);
    this.focal = this.baseFocal;
    this.horizon = this.baseHorizon;
    this.carW = (this.carDef.widthWorld * this.baseFocal) / this.playerZ;
    this.skyGradient = null;
    this.buildCarSprites();
  }

  buildCarSprites() {
    const w = Math.ceil(this.carW * 1.05);
    this.playerSprites = [-1, 0, 1].map((t) => drawCarSprite(this.paint, t, w));
    this.trafficSprites = this.trafficPaints.map((p) => drawCarSprite(p, 0, Math.ceil(w * 0.8)));
  }

  /** React to simulation events (hits, bumps, laps). */
  onEvent(e) {
    if (e.type === 'hit' || e.type === 'bump') {
      const s = clamp(e.strength, 0.15, 1);
      if (!this.reduceEffects) this.shake = Math.max(this.shake, 14 * s * this.dpr);
      this.flash = 0.35 * s;
      const cx = this.W / 2;
      for (let i = 0; i < 14; i++) this.spawn(2, cx + (this.rand() - 0.5) * this.carW, this.carY - this.carW * 0.3, 1);
    }
  }

  spawn(type, x, y, scale) {
    for (const p of this.particles) {
      if (p.life > 0) continue;
      const r = this.rand;
      p.type = type;
      p.x = x;
      p.y = y;
      const d = this.dpr * scale;
      if (type === 0) {
        // smoke
        p.vx = (r() - 0.5) * 60 * d;
        p.vy = -(20 + r() * 40) * d;
        p.size = (10 + r() * 10) * d;
        p.grow = 50 * d;
        p.life = p.max = 0.6 + r() * 0.4;
      } else if (type === 1) {
        // dust / grass
        p.vx = (r() - 0.5) * 220 * d;
        p.vy = -(60 + r() * 160) * d;
        p.size = (4 + r() * 5) * d;
        p.grow = 0;
        p.life = p.max = 0.35 + r() * 0.3;
      } else if (type === 2) {
        // spark / impact star
        p.vx = (r() - 0.5) * 520 * d;
        p.vy = -(80 + r() * 300) * d;
        p.size = (2 + r() * 3) * d;
        p.grow = 0;
        p.life = p.max = 0.25 + r() * 0.3;
      } else {
        // nitro flame
        p.vx = (r() - 0.5) * 40 * d;
        p.vy = (90 + r() * 140) * d;
        p.size = (2 + r() * 3) * d;
        p.grow = -6 * d;
        p.life = p.max = 0.1 + r() * 0.1;
      }
      return;
    }
  }

  project(pt, camX, camY, camZ) {
    const c = pt.camera;
    c.x = pt.world.x - camX;
    c.y = pt.world.y - camY;
    c.z = pt.world.z - camZ;
    const s = this.focal / c.z;
    const sc = pt.screen;
    sc.scale = s;
    sc.x = Math.round(this.W / 2 + s * c.x);
    sc.y = Math.round(this.horizon - s * c.y);
    sc.w = Math.round(s * this.track.roadHalfWidth);
  }

  render(session, alpha, dt) {
    const ctx = this.ctx;
    const T = this.track;
    const segs = T.segments;
    const count = T.count;
    const L = T.length;
    const SL = T.segmentLength;
    const RW = T.roadHalfWidth;
    const W = this.W;
    const H = this.H;
    const p = session.player;
    const maxSpeed = session.car.handling.maxSpeed;
    const fx = !this.reduceEffects;

    // Interpolated player state.
    let dz = p.z - p.prevZ;
    if (dz > L / 2) dz -= L;
    else if (dz < -L / 2) dz += L;
    const pz = wrap(p.prevZ + dz * alpha, L);
    const px = lerp(p.prevX, p.x, alpha);
    const speedPct = p.speed / maxSpeed;

    // Nitro widens the field of view; keep the car planted at carY.
    this.nitroFx += ((p.nitro ? 1 : 0) - this.nitroFx) * Math.min(1, dt * 6);
    this.focal = this.baseFocal * (1 - (fx ? 0.1 : 0.04) * this.nitroFx);
    this.horizon = this.carY - (this.focal * this.camH) / this.playerZ;

    // Camera trails the car slightly sideways for a sense of motion.
    this.camLagX += (px - this.camLagX) * Math.min(1, dt * 7);
    const camX = lerp(px, this.camLagX, 0.35) * RW;
    const camZ = wrap(pz - this.playerZ, L);
    const playerSeg = T.findSegment(pz);
    const playerY = T.heightAt(pz);
    const camY = this.camH + playerY;
    const base = T.findSegment(camZ);
    const basePct = (camZ - base.p1.world.z) / SL;

    this.skyOffset += playerSeg.curve * speedPct * dt * 0.012 * W;

    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate((this.rand() - 0.5) * this.shake, (this.rand() - 0.5) * this.shake);
      this.shake *= Math.pow(0.02, dt);
    } else this.shake = 0;

    this.drawBackground(playerY);

    // --- Road, front to back -------------------------------------------
    const dd = this.quality.drawDistance;
    let maxy = H;
    let x = 0;
    let ddx = -(base.curve * basePct);
    const fog = this.fog;
    for (let n = 0; n < dd; n++) {
      const seg = segs[(base.index + n) % count];
      seg.looped = seg.index < base.index;
      const fogAmt = 1 - Math.exp(-((n / dd) ** 2) * 4);
      seg.fog = fogAmt;
      seg.clip = maxy;
      const loopZ = seg.looped ? camZ - L : camZ;
      this.project(seg.p1, camX - x, camY, loopZ);
      this.project(seg.p2, camX - x - ddx, camY, loopZ);
      x += ddx;
      ddx += seg.curve;
      seg.visible = false;
      if (seg.p1.camera.z <= 1 || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      seg.visible = true;
      const fi = Math.min(FOG_LEVELS - 1, Math.floor(fogAmt * FOG_LEVELS));
      this.drawSegment(seg, fi, fog);
      maxy = seg.p2.screen.y;
    }

    // --- Sprites, cars and player, back to front -----------------------
    for (const c of session.traffic) {
      const s = T.findSegment(c.z);
      s.cars.push(c);
    }
    for (let n = dd - 1; n > 0; n--) {
      const seg = segs[(base.index + n) % count];
      if (seg.p1.camera.z <= 1) continue;
      const s1 = seg.p1.screen;
      const alphaFog = 1 - seg.fog * 0.85;
      if (seg.rail && seg.visible) this.drawRails(seg, alphaFog);
      ctx.globalAlpha = alphaFog;
      for (const sp of seg.sprites) {
        const img = this.atlas[sp.kind];
        const destW = sp.w * s1.scale;
        const destH = (destW * img.height) / img.width;
        const sx = s1.x + s1.w * sp.offset;
        this.drawSprite(img, sx - destW / 2, s1.y - destH, destW, destH, seg.clip);
      }
      if (seg.arch) this.drawArchBanner(seg);
      for (const c of seg.cars) {
        let cdz = c.z - c.prevZ;
        if (cdz < -L / 2) cdz += L;
        const cz = c.prevZ + cdz * alpha;
        const t = clamp((wrap(cz, L) - seg.p1.world.z) / SL, 0, 1);
        const scale = lerp(seg.p1.screen.scale, seg.p2.screen.scale, t);
        const cx = lerp(seg.p1.screen.x, seg.p2.screen.x, t) + scale * RW * c.x;
        const cy = lerp(seg.p1.screen.y, seg.p2.screen.y, t);
        const img = this.trafficSprites[c.paint % this.trafficSprites.length];
        const destW = this.carDef.widthWorld * scale;
        const destH = destW * CAR_ASPECT;
        this.drawSprite(img, cx - destW / 2, cy - destH, destW, destH, seg.clip);
      }
      ctx.globalAlpha = 1;
      if (seg === playerSeg) this.drawPlayer(session, px, camX, speedPct);
    }
    // The player segment can be index 0 of the loop above in rare layouts.
    if (playerSeg === base) this.drawPlayer(session, px, camX, speedPct);

    for (const c of session.traffic) T.findSegment(c.z).cars.length = 0;

    this.updateParticles(session, dt);
    ctx.restore();

    if (fx && this.nitroFx > 0.05) this.drawSpeedLines();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 2);
    }
  }

  drawBackground(playerY) {
    const ctx = this.ctx;
    const { W, H } = this;
    const pal = this.track.palette;
    if (!this.skyGradient) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      g.addColorStop(0, pal.skyTop);
      g.addColorStop(1, pal.skyBottom);
      this.skyGradient = g;
    }
    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(0, 0, W, H);

    // Sun with soft glow.
    const sunX = wrap(W * 0.72 - this.skyOffset * 0.1, W * 1.6) - W * 0.3;
    const sunY = this.horizon * 0.35;
    const r = Math.min(W, H) * 0.07;
    const sg = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3);
    sg.addColorStop(0, 'rgba(255,248,200,0.9)');
    sg.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - r * 3, sunY - r * 3, r * 6, r * 6);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
    ctx.fill();

    const lift = clamp(playerY * 0.01, -40, 40) * this.dpr;
    const horizon = this.horizon;
    this.drawLayer(this.bg.clouds, 0.15, horizon * 0.95, horizon * 0.05 + lift * 0.2);
    this.drawLayer(this.bg.far, 0.4, H * 0.32, horizon - H * 0.2 + lift * 0.5);
    this.drawLayer(this.bg.near, 0.7, H * 0.26, horizon - H * 0.14 + lift);
    // Fill below the near hills down to the road so no sky shows through.
    ctx.fillStyle = pal.hillsNear;
    ctx.fillRect(0, horizon + H * 0.11 + lift, W, H);
  }

  drawLayer(img, speed, height, top) {
    const ctx = this.ctx;
    const drawW = Math.max(this.W * 2, (img.width * height) / img.height);
    const off = wrap(this.skyOffset * speed, drawW);
    ctx.drawImage(img, -off, top, drawW, height);
    ctx.drawImage(img, drawW - off, top, drawW, height);
  }

  drawSegment(seg, fi, fog) {
    const ctx = this.ctx;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    const light = seg.band === 0;
    const lanes = this.track.lanes;

    ctx.fillStyle = (light ? fog.grassLight : fog.grassDark)[fi];
    ctx.fillRect(0, y2, this.W, y1 - y2);

    const r1 = w1 / Math.max(6, 2 * lanes);
    const r2 = w2 / Math.max(6, 2 * lanes);
    ctx.fillStyle = (light ? fog.rumbleLight : fog.rumbleDark)[fi];
    this.quad(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    this.quad(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);

    if (seg.index < 2) {
      // Chequered start/finish line.
      const cols = 10;
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = (i + seg.index) % 2 ? '#1b1f3b' : '#ffffff';
        const a = -1 + (2 * i) / cols;
        const b = -1 + (2 * (i + 1)) / cols;
        this.quad(x1 + w1 * a, y1, x1 + w1 * b, y1, x2 + w2 * b, y2, x2 + w2 * a, y2);
      }
      return;
    }

    ctx.fillStyle = (light ? fog.roadLight : fog.roadDark)[fi];
    this.quad(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);

    if (light) {
      const l1 = w1 / Math.max(32, 8 * lanes);
      const l2 = w2 / Math.max(32, 8 * lanes);
      const lw1 = (w1 * 2) / lanes;
      const lw2 = (w2 * 2) / lanes;
      let lx1 = x1 - w1 + lw1;
      let lx2 = x2 - w2 + lw2;
      ctx.fillStyle = fog.lane[fi];
      for (let lane = 1; lane < lanes; lane++, lx1 += lw1, lx2 += lw2) {
        this.quad(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2);
      }
    }
  }

  quad(x1, y1, x2, y2, x3, y3, x4, y4) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  drawRails(seg, alphaFog) {
    const ctx = this.ctx;
    const a = seg.p1.screen;
    const b = seg.p2.screen;
    if (b.y >= seg.clip) return;
    const h1 = RAIL_H * a.scale;
    const h2 = RAIL_H * b.scale;
    const pal = this.track.palette;
    ctx.globalAlpha = alphaFog;
    for (const side of [-1, 1]) {
      const x1 = a.x + side * a.w * RAIL_X;
      const x2 = b.x + side * b.w * RAIL_X;
      ctx.fillStyle = pal.rail;
      this.quad(x1, y1Top(a.y, h1, 0.35), x2, y1Top(b.y, h2, 0.35), x2, b.y - h2, x1, a.y - h1);
      ctx.fillStyle = seg.band ? '#ff4d5e' : pal.rail;
      this.quad(x1, a.y - h1 * 0.55, x2, b.y - h2 * 0.55, x2, b.y - h2 * 0.8, x1, a.y - h1 * 0.8);
      if (seg.index % 2 === 0) {
        ctx.fillStyle = pal.railPost;
        const pw = Math.max(1, a.w * 0.025);
        ctx.fillRect(x1 - pw / 2, a.y - h1, pw, h1);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawArchBanner(seg) {
    const s = seg.p1.screen;
    const ctx = this.ctx;
    const postH = (this.atlas.archPost.height / this.atlas.archPost.width) * 380 * s.scale;
    const left = s.x - s.w * 1.22;
    const right = s.x + s.w * 1.22;
    const top = s.y - postH;
    const bh = postH * 0.18;
    if (top + bh >= seg.clip) return;
    ctx.fillStyle = '#ff4d5e';
    ctx.fillRect(left, top, right - left, bh);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(left, top + bh * 0.82, right - left, bh * 0.18);
    if (bh > 8) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(bh * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START  ·  FINISH', s.x, top + bh * 0.45);
    }
  }

  drawSprite(img, x, y, w, h, clipY) {
    if (w < 1 || x > this.W || x + w < 0) return;
    const clipH = Math.max(0, y + h - clipY);
    if (clipH >= h) return;
    this.ctx.drawImage(img, 0, 0, img.width, img.height - (img.height * clipH) / h, x, y, w, h - clipH);
  }

  drawPlayer(session, px, camX, speedPct) {
    const ctx = this.ctx;
    const p = session.player;
    const RW = this.track.roadHalfWidth;
    const w = this.carW;
    const h = w * CAR_ASPECT;
    const cx = this.W / 2 + ((px * RW - camX) * this.focal) / this.playerZ;
    let cy = this.carY;
    if (p.offroad && Math.abs(speedPct) > 0.05) cy += (this.rand() - 0.5) * 4 * this.dpr;
    else if (Math.abs(speedPct) > 0.2) cy += (this.rand() - 0.5) * 1.2 * this.dpr;
    const turn = p.steer > 0.3 ? 2 : p.steer < -0.3 ? 0 : 1;
    const lean = clamp(p.latVel * 0.035 + p.steer * 0.02, -0.08, 0.08);

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - h * 0.02, w * 0.56, h * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lean);
    ctx.drawImage(this.playerSprites[turn], -w / 2, -h, w, h);

    // Brake / reverse lights.
    if (p.braking || p.speed < -10) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.braking ? 'rgba(255,60,80,0.85)' : 'rgba(255,255,255,0.8)';
      for (const t of CAR_ANCHORS.taillights) {
        ctx.fillRect(-w / 2 + t.x * w - w * 0.02, -h + t.y * h - h * 0.03, t.w * w + w * 0.04, t.h * h + h * 0.06);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Nitro flames.
    if (this.nitroFx > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of CAR_ANCHORS.exhausts) {
        const ex = -w / 2 + e.x * w;
        const ey = -h + e.y * h;
        const len = w * (0.18 + this.rand() * 0.12) * this.nitroFx;
        const fw = w * 0.05;
        const g = ctx.createLinearGradient(0, ey, 0, ey + len);
        g.addColorStop(0, 'rgba(160,220,255,0.95)');
        g.addColorStop(0.4, 'rgba(255,170,40,0.85)');
        g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ex - fw, ey);
        ctx.quadraticCurveTo(ex, ey + len * 1.2, ex + fw, ey);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    const ps = this.playerScreen;
    ps.cx = cx;
    ps.cy = cy;
    ps.w = w;
    ps.h = h;
    ps.valid = true;
  }

  updateParticles(session, dt) {
    const p = session.player;
    const ps = this.playerScreen;
    const ctx = this.ctx;
    const q = this.quality.particles * (this.reduceEffects ? 0.4 : 1);
    const speedPct = p.speed / session.car.handling.maxSpeed;
    if (ps.valid) {
      const rate = (n) => (this.rand() < n * dt * q ? 1 : 0);
      const wx = (a) => ps.cx - ps.w / 2 + a.x * ps.w;
      const wy = (a) => ps.cy - ps.h + a.y * ps.h;
      if (p.sliding) for (const a of CAR_ANCHORS.wheels) if (rate(40)) this.spawn(0, wx(a), wy(a), 1);
      if (p.offroad && Math.abs(speedPct) > 0.1) for (const a of CAR_ANCHORS.wheels) if (rate(50)) this.spawn(1, wx(a), wy(a), 1);
      if (p.scraping) if (rate(80)) this.spawn(2, p.x > 0 ? ps.cx + ps.w / 2 : ps.cx - ps.w / 2, ps.cy - ps.h * 0.4, 1);
      if (this.nitroFx > 0.3) for (const a of CAR_ANCHORS.exhausts) if (rate(60)) this.spawn(3, wx(a), wy(a), ps.w / 200);
    }

    for (const pt of this.particles) {
      if (pt.life <= 0) continue;
      pt.life -= dt;
      if (pt.life <= 0) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.size = Math.max(0.5, pt.size + pt.grow * dt);
      const t = pt.life / pt.max;
      if (pt.type === 1 || pt.type === 2) pt.vy += 900 * this.dpr * dt;
      ctx.globalAlpha = PARTICLE_ALPHA[pt.type] * t;
      ctx.globalCompositeOperation = pt.type === 3 ? 'lighter' : 'source-over';
      ctx.fillStyle = PARTICLE_COLOR[pt.type];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawSpeedLines() {
    const ctx = this.ctx;
    const cx = this.W / 2;
    const cy = this.horizon;
    const maxR = Math.hypot(this.W, this.H);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * this.nitroFx})`;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = this.rand() * Math.PI * 2;
      const r0 = maxR * (0.25 + this.rand() * 0.25);
      const r1 = r0 + maxR * (0.1 + this.rand() * 0.2);
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    ctx.stroke();
  }
}

function y1Top(y, h, f) {
  return y - h * f;
}
