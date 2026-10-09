// Procedural roadside sprites and parallax background layers. Everything is
// generated once at load into offscreen canvases (no image files needed).

import { mulberry32, shadeHex } from '../core/util.js';
import { roundRect } from './carArt.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function pine(scale) {
  const [c, x] = canvas(200 * scale, 320 * scale);
  x.scale(scale, scale);
  x.fillStyle = '#7a4b2a';
  x.fillRect(90, 250, 20, 70);
  const greens = ['#1f7a4d', '#24915a', '#2fa868'];
  for (let i = 0; i < 3; i++) {
    const top = 10 + i * 70;
    const half = 55 + i * 22;
    x.fillStyle = greens[i];
    x.beginPath();
    x.moveTo(100, top);
    x.lineTo(100 + half, top + 130);
    x.lineTo(100 - half, top + 130);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath();
    x.moveTo(100, top);
    x.lineTo(100 - half, top + 130);
    x.lineTo(100 - half * 0.4, top + 130);
    x.closePath();
    x.fill();
  }
  return c;
}

function oak(scale) {
  const [c, x] = canvas(260 * scale, 290 * scale);
  x.scale(scale, scale);
  x.fillStyle = '#7a4b2a';
  x.beginPath();
  x.moveTo(118, 290);
  x.lineTo(124, 170);
  x.lineTo(136, 170);
  x.lineTo(142, 290);
  x.fill();
  const blobs = [
    [130, 95, 80, '#2f9e55'],
    [70, 140, 58, '#2a8f4c'],
    [190, 140, 58, '#2a8f4c'],
    [130, 165, 62, '#278646'],
    [95, 80, 45, '#3db564'],
    [160, 70, 42, '#3db564'],
  ];
  for (const [bx, by, r, col] of blobs) {
    x.fillStyle = col;
    x.beginPath();
    x.arc(bx, by, r, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.14)';
  x.beginPath();
  x.arc(105, 70, 28, 0, Math.PI * 2);
  x.fill();
  return c;
}

function bush(scale) {
  const [c, x] = canvas(200 * scale, 110 * scale);
  x.scale(scale, scale);
  for (const [bx, by, r, col] of [
    [60, 70, 42, '#2a8f4c'],
    [140, 70, 42, '#2a8f4c'],
    [100, 55, 50, '#36a85b'],
  ]) {
    x.fillStyle = col;
    x.beginPath();
    x.arc(bx, by, r, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#ff7eb6';
  for (const [fx, fy] of [
    [80, 40],
    [120, 52],
    [150, 62],
    [55, 66],
  ]) {
    x.beginPath();
    x.arc(fx, fy, 5, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

function rock(scale) {
  const [c, x] = canvas(200 * scale, 130 * scale);
  x.scale(scale, scale);
  x.fillStyle = '#8d96a3';
  x.beginPath();
  x.moveTo(10, 130);
  x.lineTo(30, 50);
  x.lineTo(80, 15);
  x.lineTo(140, 25);
  x.lineTo(185, 70);
  x.lineTo(195, 130);
  x.closePath();
  x.fill();
  x.fillStyle = '#b4bcc7';
  x.beginPath();
  x.moveTo(30, 50);
  x.lineTo(80, 15);
  x.lineTo(110, 60);
  x.lineTo(60, 80);
  x.closePath();
  x.fill();
  return c;
}

function billboard(scale) {
  const [c, x] = canvas(400 * scale, 260 * scale);
  x.scale(scale, scale);
  x.fillStyle = '#5b6474';
  x.fillRect(80, 150, 16, 110);
  x.fillRect(304, 150, 16, 110);
  const g = x.createLinearGradient(0, 10, 400, 160);
  g.addColorStop(0, '#ff4d5e');
  g.addColorStop(1, '#ffbe0b');
  x.fillStyle = '#1b1f3b';
  roundRect(x, 4, 4, 392, 160, 18);
  x.fill();
  x.fillStyle = g;
  roundRect(x, 14, 14, 372, 140, 12);
  x.fill();
  x.fillStyle = '#ffffff';
  x.font = '900 52px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('POCKET', 200, 62);
  x.fillStyle = '#1b1f3b';
  x.fillText('RACERS', 200, 114);
  return c;
}

function chevron(scale, dir) {
  const [c, x] = canvas(130 * scale, 170 * scale);
  x.scale(scale, scale);
  x.fillStyle = '#5b6474';
  x.fillRect(58, 90, 14, 80);
  x.fillStyle = '#1b1f3b';
  roundRect(x, 2, 2, 126, 96, 10);
  x.fill();
  x.fillStyle = '#ffd23f';
  roundRect(x, 8, 8, 114, 84, 7);
  x.fill();
  x.fillStyle = '#1b1f3b';
  for (const ox of [-22, 18]) {
    x.save();
    x.translate(65 + ox, 50);
    x.scale(dir, 1);
    x.beginPath();
    x.moveTo(-14, -28);
    x.lineTo(10, 0);
    x.lineTo(-14, 28);
    x.lineTo(-2, 28);
    x.lineTo(22, 0);
    x.lineTo(-2, -28);
    x.closePath();
    x.fill();
    x.restore();
  }
  return c;
}

function archPost(scale) {
  const [c, x] = canvas(80 * scale, 460 * scale);
  x.scale(scale, scale);
  for (let i = 0; i < 23; i++) {
    x.fillStyle = i % 2 ? '#1b1f3b' : '#ffffff';
    x.fillRect(10, i * 20, 60, 20);
  }
  x.strokeStyle = '#1b1f3b';
  x.lineWidth = 4;
  x.strokeRect(10, 0, 60, 460);
  return c;
}

/** Build the sprite atlas. `scale` trades sharpness for memory. */
export function buildSceneryAtlas(scale = 1) {
  return {
    pine: pine(scale),
    oak: oak(scale),
    bush: bush(scale),
    rock: rock(scale),
    billboard: billboard(scale),
    chevronL: chevron(scale, -1),
    chevronR: chevron(scale, 1),
    archPost: archPost(scale),
  };
}

/** Horizontally tileable parallax layers. */
export function buildBackground(palette, seed = 99) {
  const rand = mulberry32(seed);
  const W = 2048;

  const ridge = (H, color, base, amp, freqs, highlight) => {
    const [c, x] = canvas(W, H);
    const phases = freqs.map(() => rand() * Math.PI * 2);
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(0, H);
    for (let px = 0; px <= W; px += 8) {
      let y = 0;
      freqs.forEach((f, i) => {
        y += Math.sin((px / W) * Math.PI * 2 * f + phases[i]) / (i + 1);
      });
      x.lineTo(px, base - y * amp);
    }
    x.lineTo(W, H);
    x.closePath();
    x.fill();
    if (highlight) {
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
    }
    return c;
  };

  const clouds = (() => {
    const H = 220;
    const [c, x] = canvas(W, H);
    x.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 9; i++) {
      const cx = rand() * W;
      const cy = 40 + rand() * 120;
      const s = 0.6 + rand() * 0.8;
      for (const dx of [-W, 0, W]) {
        for (const [ox, oy, r] of [
          [0, 0, 34],
          [36, -14, 40],
          [76, 0, 32],
          [38, 10, 34],
        ]) {
          x.beginPath();
          x.arc(cx + dx + ox * s, cy + oy * s, r * s, 0, Math.PI * 2);
          x.fill();
        }
      }
    }
    return c;
  })();

  return {
    clouds,
    far: ridge(300, palette.hillsFar, 170, 55, [2, 5, 9], true),
    near: ridge(260, palette.hillsNear, 160, 40, [3, 7, 13], true),
  };
}
