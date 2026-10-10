// Smashable roadside props: small things that go flying when a car hits
// them off the road. Local space in metres, origin on the ground, +z toward
// the oncoming driver, x across the road.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const C = hexToRgb;
const WOOD = C('#b07a45');
const WOOD_DARK = C('#7d5230');

function hay() {
  // A round bale lying across the road direction.
  const m = new MeshBuilder();
  m.material(0.05, 0.9);
  m.cylinder(0, 0.55, 0, 0.55, 0.55, 18, 'x', C('#e3b54a'), C('#f1cf73'));
  m.material(0.1, 0);
  m.cylinder(0, 0.55, 0, 0.565, 0.04, 18, 'x', C('#c99a35'), C('#c99a35'));
  return m;
}

function fence() {
  // One section of wooden fence running along the road.
  const m = new MeshBuilder();
  m.material(0.05, 0.7);
  for (const z of [-0.95, 0.95]) m.box(0, 0.5, z, 0.06, 0.5, 0.06, WOOD_DARK, 0, 0.8);
  for (const y of [0.35, 0.75]) m.box(0, y, 0, 0.035, 0.07, 1.0, WOOD);
  return m;
}

function crate() {
  const m = new MeshBuilder();
  m.material(0.05, 0.8);
  m.box(0, 0.45, 0, 0.45, 0.45, 0.45, WOOD);
  // Dark edge planks.
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    m.box(x * 0.43, 0.45, z * 0.43, 0.04, 0.46, 0.04, WOOD_DARK);
  for (const y of [0.02, 0.88]) {
    m.box(0, y, 0.43, 0.46, 0.04, 0.04, WOOD_DARK);
    m.box(0, y, -0.43, 0.46, 0.04, 0.04, WOOD_DARK);
    m.box(0.43, y, 0, 0.04, 0.04, 0.46, WOOD_DARK);
    m.box(-0.43, y, 0, 0.04, 0.04, 0.46, WOOD_DARK);
  }
  m.box(0, 0.45, 0.455, 0.42, 0.05, 0.01, WOOD_DARK);
  return m;
}

function barrel(colour = '#e63946') {
  const m = new MeshBuilder();
  m.material(0.5, 0);
  m.cylinder(0, 0.45, 0, 0.34, 0.45, 16, 'y', C(colour), C('#3a3f4b'));
  m.material(0.8, 0);
  for (const y of [0.15, 0.75]) m.cylinder(0, y, 0, 0.355, 0.03, 16, 'y', C('#c9ced8'), C('#c9ced8'));
  return m;
}

function mailbox() {
  const m = new MeshBuilder();
  m.material(0.05, 0.7);
  m.box(0, 0.5, 0, 0.05, 0.5, 0.05, WOOD_DARK);
  m.material(0.6, 0);
  m.box(0, 1.08, 0, 0.17, 0.12, 0.28, C('#2b6fd6'));
  m.cylinder(0, 1.2, 0, 0.17, 0.28, 12, 'z', C('#2b6fd6'), C('#2b6fd6'));
  m.box(0.19, 1.2, -0.05, 0.015, 0.14, 0.03, C('#ff3b47'));
  m.box(0.19, 1.3, 0.04, 0.015, 0.05, 0.09, C('#ff3b47'));
  return m;
}

function gift() {
  const m = new MeshBuilder();
  m.material(0.4, 0);
  m.box(0, 0.38, 0, 0.38, 0.38, 0.38, C('#e63946'));
  m.box(0, 0.38, 0, 0.39, 0.39, 0.07, C('#ffd23f'));
  m.box(0, 0.38, 0, 0.07, 0.39, 0.39, C('#ffd23f'));
  m.sphere(0.12, 0.8, 0, 0.13, 0.08, 0.06, C('#ffd23f'), { segs: 10, rings: 6 });
  m.sphere(-0.12, 0.8, 0, 0.13, 0.08, 0.06, C('#ffd23f'), { segs: 10, rings: 6 });
  return m;
}

function bin() {
  const m = new MeshBuilder();
  m.material(0.5, 0);
  m.cylinder(0, 0.45, 0, 0.3, 0.45, 16, 'y', C('#3f8f4f'), C('#2c6b39'), 0.34);
  m.cylinder(0, 0.93, 0, 0.36, 0.04, 16, 'y', C('#2c6b39'), C('#2c6b39'));
  m.box(0, 1.0, 0, 0.12, 0.03, 0.03, C('#1f4d29'));
  return m;
}

function ball() {
  // Beach ball: coloured segments.
  const m = new MeshBuilder();
  m.material(0.7, 0);
  const cols = ['#ff3b47', '#ffffff', '#ffd23f', '#ffffff', '#2b6fd6', '#ffffff'].map(C);
  const P = [];
  const R = 0.45;
  for (let i = 0; i <= 10; i++) {
    const phi = (i / 10) * Math.PI;
    const row = [];
    for (let j = 0; j < 24; j++) {
      const th = (j / 24) * Math.PI * 2;
      row.push([Math.sin(phi) * Math.cos(th) * R, R + Math.cos(phi) * R, Math.sin(phi) * Math.sin(th) * R]);
    }
    P.push(row);
  }
  m.grid(P, (i, j) => cols[Math.floor(j / 4) % cols.length], { wrapJ: true });
  return m;
}

function cone() {
  const m = new MeshBuilder();
  m.material(0.3, 0);
  m.box(0, 0.03, 0, 0.32, 0.03, 0.32, C('#ff6b1a'));
  m.cylinder(0, 0.42, 0, 0.24, 0.36, 14, 'y', C('#ff6b1a'), C('#ff6b1a'), 0.04);
  m.cylinder(0, 0.46, 0, 0.165, 0.07, 14, 'y', C('#ffffff'), C('#ffffff'), 0.125);
  return m;
}

function pumpkin() {
  const m = new MeshBuilder();
  m.material(0.3, 0.2);
  const o = C('#f07a1a');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    m.sphere(Math.cos(a) * 0.14, 0.33, Math.sin(a) * 0.14, 0.26, 0.32, 0.26, k % 2 ? C('#e06a12') : o, { segs: 10, rings: 7 });
  }
  m.cylinder(0, 0.7, 0, 0.05, 0.08, 6, 'y', C('#4f7a2a'), C('#4f7a2a'), 0.035);
  return m;
}

function donut() {
  // Pink-iced ring doughnut standing on its edge, sprinkles on top.
  const m = new MeshBuilder();
  m.material(0.5, 0);
  const R = 0.32;
  const r = 0.15;
  const P = [];
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const row = [];
    for (let j = 0; j < 12; j++) {
      const b = (j / 12) * Math.PI * 2;
      row.push([(R + r * Math.cos(b)) * Math.cos(a), R + r + (R + r * Math.cos(b)) * Math.sin(a), r * Math.sin(b)]);
    }
    P.push(row);
  }
  m.grid(P, (i, j) => (j >= 2 && j <= 6 ? C('#ff7ab6') : C('#d89a55')), { wrapJ: true });
  const bits = ['#ffffff', '#ffd23f', '#5ad1ff', '#4fdc7b'].map(C);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    m.box(Math.cos(a) * R, R + r + Math.sin(a) * R, r * 0.95, 0.03, 0.012, 0.012, bits[k % 4]);
  }
  return m;
}

function cupcake() {
  const m = new MeshBuilder();
  m.material(0.3, 0.2);
  m.cylinder(0, 0.22, 0, 0.3, 0.22, 14, 'y', C('#5ad1ff'), C('#5ad1ff'), 0.22);
  m.material(0.6, 0);
  m.sphere(0, 0.52, 0, 0.34, 0.24, 0.34, C('#fff0f6'), { segs: 12, rings: 7 });
  m.sphere(0, 0.72, 0, 0.2, 0.16, 0.2, C('#ffc2dc'), { segs: 10, rings: 6 });
  m.sphere(0, 0.92, 0, 0.08, 0.08, 0.08, C('#e8343f'), { segs: 8, rings: 5 });
  return m;
}

export const PROP_MODELS = {
  hay,
  fence,
  crate,
  barrel: () => barrel('#e63946'),
  drum: () => barrel('#2b6fd6'),
  mailbox,
  gift,
  bin,
  ball,
  cone,
  pumpkin,
  donut,
  cupcake,
};
