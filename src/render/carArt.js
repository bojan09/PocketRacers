// Procedural rear-view car art. Drawn once per paint job / turn pose into an
// offscreen canvas and then blitted, so customisation costs nothing per frame.
// Returns anchor points (taillights, exhausts, wheels) in 0..1 sprite space so
// effects line up with the art.

import { shadeHex } from '../core/util.js';

export const CAR_ASPECT = 0.62; // height / width of the sprite canvas

export const CAR_ANCHORS = {
  taillights: [
    { x: 0.2, y: 0.6, w: 0.17, h: 0.07 },
    { x: 0.63, y: 0.6, w: 0.17, h: 0.07 },
  ],
  exhausts: [
    { x: 0.36, y: 0.86 },
    { x: 0.64, y: 0.86 },
  ],
  wheels: [
    { x: 0.14, y: 0.93 },
    { x: 0.86, y: 0.93 },
  ],
};

// Manual path instead of ctx.roundRect, which older iOS Safari lacks.
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {object} paint  {body, accent, stripe, rim, tire, glass, plate}
 * @param {number} turn   -1 (turning left), 0, 1 (turning right)
 * @param {number} width  pixel width of the generated sprite
 */
export function drawCarSprite(paint, turn, width) {
  const W = Math.max(32, Math.round(width));
  const H = Math.round(W * CAR_ASPECT);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.scale(W / 200, H / (200 * CAR_ASPECT));
  // From here on we draw in a 200 x 124 design space.
  const shift = turn * 7; // cabin offset to fake yaw
  const body = paint.body;
  const dark = shadeHex(body, -0.35);
  const light = shadeHex(body, 0.35);

  // Tyres (visible below the body).
  ctx.fillStyle = paint.tire;
  roundRect(ctx, 14, 92, 34, 30, 7);
  ctx.fill();
  roundRect(ctx, 152, 92, 34, 30, 7);
  ctx.fill();
  ctx.fillStyle = shadeHex(paint.tire, 0.15);
  for (const x of [18, 156]) {
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 7, 96, 3, 24);
  }

  // Side panel peeking out when turning.
  if (turn !== 0) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    const sx = turn > 0 ? 6 : 194;
    ctx.moveTo(sx, 58);
    ctx.lineTo(sx + turn * 14, 52);
    ctx.lineTo(sx + turn * 14, 104);
    ctx.lineTo(sx, 100);
    ctx.closePath();
    ctx.fill();
  }

  // Lower body.
  const g = ctx.createLinearGradient(0, 46, 0, 108);
  g.addColorStop(0, light);
  g.addColorStop(0.35, body);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(22 + shift * 0.4, 50);
  ctx.lineTo(178 + shift * 0.4, 50);
  ctx.quadraticCurveTo(196, 54, 196, 72);
  ctx.lineTo(194, 98);
  ctx.quadraticCurveTo(193, 106, 184, 106);
  ctx.lineTo(16, 106);
  ctx.quadraticCurveTo(7, 106, 6, 98);
  ctx.lineTo(4, 72);
  ctx.quadraticCurveTo(4, 54, 22 + shift * 0.4, 50);
  ctx.fill();

  // Cabin.
  const cg = ctx.createLinearGradient(0, 12, 0, 52);
  cg.addColorStop(0, light);
  cg.addColorStop(1, body);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(48 + shift, 14);
  ctx.lineTo(152 + shift, 14);
  ctx.quadraticCurveTo(162 + shift, 15, 166 + shift, 24);
  ctx.lineTo(178 + shift * 0.4, 52);
  ctx.lineTo(22 + shift * 0.4, 52);
  ctx.lineTo(34 + shift, 24);
  ctx.quadraticCurveTo(38 + shift, 15, 48 + shift, 14);
  ctx.fill();

  // Rear window.
  const wg = ctx.createLinearGradient(0, 20, 0, 48);
  wg.addColorStop(0, shadeHex(paint.glass, 0.25));
  wg.addColorStop(1, paint.glass);
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(52 + shift, 21);
  ctx.lineTo(148 + shift, 21);
  ctx.lineTo(162 + shift * 0.6, 46);
  ctx.lineTo(38 + shift * 0.6, 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(60 + shift, 23);
  ctx.lineTo(84 + shift, 23);
  ctx.lineTo(62 + shift * 0.6, 44);
  ctx.lineTo(46 + shift * 0.6, 44);
  ctx.closePath();
  ctx.fill();

  // Racing stripes over roof and body.
  ctx.fillStyle = paint.stripe;
  ctx.globalAlpha = 0.95;
  for (const off of [-13, 5]) {
    ctx.beginPath();
    ctx.moveTo(100 + off + shift, 14);
    ctx.lineTo(108 + off + shift, 14);
    ctx.lineTo(108 + off + shift * 0.6, 21);
    ctx.lineTo(100 + off + shift * 0.6, 21);
    ctx.fill();
    ctx.fillRect(100 + off + shift * 0.4, 50, 8, 32);
  }
  ctx.globalAlpha = 1;

  // Taillights.
  for (const t of CAR_ANCHORS.taillights) {
    const x = t.x * 200;
    const y = t.y * 124;
    ctx.fillStyle = '#7a0f1c';
    roundRect(ctx, x - 1, y - 1, t.w * 200 + 2, t.h * 124 + 2, 4);
    ctx.fill();
    ctx.fillStyle = '#ff3045';
    roundRect(ctx, x, y, t.w * 200, t.h * 124, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,220,0.7)';
    ctx.fillRect(x + 3, y + 2, t.w * 200 - 6, 2);
  }

  // Bumper, plate, diffuser, exhausts.
  ctx.fillStyle = shadeHex(body, -0.55);
  roundRect(ctx, 12, 88, 176, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#f7f7f2';
  roundRect(ctx, 76, 74, 48, 13, 2);
  ctx.fill();
  if (paint.plate) {
    ctx.fillStyle = '#1b1f3b';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(paint.plate.slice(0, 8), 100, 81, 44);
  }
  ctx.fillStyle = '#9aa4b2';
  for (const e of CAR_ANCHORS.exhausts) {
    ctx.beginPath();
    ctx.arc(e.x * 200, e.y * 124, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1a1c22';
  for (const e of CAR_ANCHORS.exhausts) {
    ctx.beginPath();
    ctx.arc(e.x * 200, e.y * 124, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spoiler.
  ctx.fillStyle = shadeHex(paint.accent, -0.3);
  ctx.fillRect(36, 40, 6, 12);
  ctx.fillRect(158, 40, 6, 12);
  const sg = ctx.createLinearGradient(0, 34, 0, 44);
  sg.addColorStop(0, shadeHex(paint.accent, 0.3));
  sg.addColorStop(1, paint.accent);
  ctx.fillStyle = sg;
  roundRect(ctx, 16 + shift * 0.5, 33, 168, 10, 4);
  ctx.fill();

  // Body highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26 + shift * 0.4, 55);
  ctx.lineTo(174 + shift * 0.4, 55);
  ctx.stroke();

  return c;
}
