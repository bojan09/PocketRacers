// Procedural low-poly scenery models. Each builder returns a MeshBuilder in
// local space: metres, origin on the ground, +z facing the oncoming driver.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const C = (hex) => hexToRgb(hex);
const TRUNK = C('#7a4b2a');

function pine(rand) {
  const m = new MeshBuilder();
  const h = 5.5 + rand() * 2.5;
  m.cylinder(0, 0.6, 0, 0.22, 0.6, 6, 'y', TRUNK);
  const greens = ['#1f7a4d', '#24915a', '#2fa868'].map(C);
  for (let i = 0; i < 3; i++) {
    const base = 1 + i * h * 0.24;
    const r = 1.9 - i * 0.45;
    const tierH = h * 0.36;
    m.cylinder(0, base + tierH / 2, 0, r, tierH / 2, 7, 'y', greens[i], greens[i], 0);
  }
  return m;
}

function oak(rand) {
  const m = new MeshBuilder();
  m.cylinder(0, 1.3, 0, 0.28, 1.3, 6, 'y', TRUNK, TRUNK, 0.2);
  const g = C(rand() < 0.5 ? '#2f9e55' : '#3aae5a');
  m.blob(0, 3.6, 0, 2.2, 1.8, 2.2, g, rand, 0.25);
  m.blob(1.1, 3.0, 0.6, 1.4, 1.2, 1.4, g, rand, 0.25);
  m.blob(-1.0, 3.2, -0.5, 1.5, 1.3, 1.5, g, rand, 0.25);
  return m;
}

function bush(rand) {
  const m = new MeshBuilder();
  const g = C('#2f9a52');
  m.blob(0, 0.55, 0, 1.0, 0.65, 1.0, g, rand, 0.3);
  m.blob(0.7, 0.45, 0.2, 0.7, 0.5, 0.7, g, rand, 0.3);
  return m;
}

function flowers(rand) {
  const m = new MeshBuilder();
  m.blob(0, 0.3, 0, 0.9, 0.35, 0.9, C('#3aa85a'), rand, 0.2);
  const cols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b388ff'].map(C);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.75;
    m.blob(Math.cos(a) * r, 0.62, Math.sin(a) * r, 0.14, 0.1, 0.14, cols[i % cols.length]);
  }
  return m;
}

function rock(rand) {
  const m = new MeshBuilder();
  m.blob(0, 0.6, 0, 1.4, 1.0, 1.2, C('#8d96a3'), rand, 0.45);
  m.blob(0.9, 0.35, 0.5, 0.6, 0.45, 0.6, C('#a2aab6'), rand, 0.4);
  return m;
}

function billboard() {
  const m = new MeshBuilder();
  const post = C('#5b6474');
  m.box(-2.2, 2.2, 0, 0.15, 2.2, 0.15, post);
  m.box(2.2, 2.2, 0, 0.15, 2.2, 0.15, post);
  m.box(0, 4.6, -0.05, 3.4, 1.55, 0.12, C('#1b1f3b'));
  // Colourful panel with a stylised logo (stripes + chequer).
  m.box(0, 4.6, 0.09, 3.2, 1.35, 0.03, C('#ff4d5e'));
  m.box(-0.6, 4.95, 0.13, 2.3, 0.32, 0.02, C('#ffffff'));
  m.box(-0.9, 4.3, 0.13, 2.0, 0.32, 0.02, C('#ffd23f'));
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) m.box(2.05 + i * 0.28, 4.25 + j * 0.28, 0.13, 0.13, 0.13, 0.02, (i + j) % 2 ? C('#1b1f3b') : C('#ffffff'));
  return m;
}

function chevron(dir) {
  const m = new MeshBuilder();
  m.box(0, 0.7, 0, 0.07, 0.7, 0.07, C('#5b6474'));
  m.box(0, 1.75, 0, 0.75, 0.42, 0.05, C('#1b1f3b'));
  m.box(0, 1.75, 0.03, 0.68, 0.36, 0.03, C('#ffd23f'));
  const black = C('#1b1f3b');
  for (const ox of [-0.28, 0.22]) {
    const x = ox * dir;
    const z = 0.07;
    m.poly(
      [
        [x - 0.1 * dir, 1.47, z],
        [x + 0.08 * dir, 1.75, z],
        [x - 0.1 * dir, 2.03, z],
        [x + 0.02 * dir, 2.03, z],
        [x + 0.2 * dir, 1.75, z],
        [x + 0.02 * dir, 1.47, z],
      ].reverse(),
      black,
    );
  }
  return m;
}

function lamp() {
  const m = new MeshBuilder();
  const grey = C('#7d8796');
  m.cylinder(0, 3, 0, 0.09, 3, 6, 'y', grey);
  m.box(0, 6, 0.6, 0.06, 0.06, 0.65, grey);
  m.box(0, 5.9, 1.15, 0.22, 0.08, 0.28, C('#fff3c4'), 0.9);
  return m;
}

function gablePrism(m, w, d, wallH, roofH, wall, roof) {
  m.box(0, wallH / 2, 0, w / 2, wallH / 2, d / 2, wall);
  const y0 = wallH;
  const y1 = wallH + roofH;
  const o = 0.35; // overhang
  m.quad([-w / 2 - o, y0, -d / 2 - o], [0, y1, -d / 2 - o], [0, y1, d / 2 + o], [-w / 2 - o, y0, d / 2 + o], roof);
  m.quad([w / 2 + o, y0, -d / 2 - o], [w / 2 + o, y0, d / 2 + o], [0, y1, d / 2 + o], [0, y1, -d / 2 - o], roof);
  m.tri([-w / 2, y0, d / 2], [w / 2, y0, d / 2], [0, y1, d / 2], wall);
  m.tri([-w / 2, y0, -d / 2], [0, y1, -d / 2], [w / 2, y0, -d / 2], wall);
}

function house(rand) {
  const m = new MeshBuilder();
  const walls = ['#fff4e0', '#ffe3e3', '#e3f2ff', '#fff7c2'].map(C);
  const wall = walls[Math.floor(rand() * walls.length)];
  const roof = C(rand() < 0.5 ? '#d9534f' : '#4f6dd9');
  gablePrism(m, 7, 6, 3.2, 2.6, wall, roof);
  m.box(0, 1.05, 3.02, 0.55, 1.05, 0.04, C('#8b5a3c'));
  for (const x of [-2.2, 2.2]) {
    m.box(x, 1.9, 3.02, 0.6, 0.5, 0.04, C('#9fd7ff'), 0.3);
    m.box(x, 1.9, 3.05, 0.66, 0.05, 0.02, C('#ffffff'));
  }
  m.box(2, 6.2, -1, 0.35, 1.0, 0.35, C('#a0645a'));
  return m;
}

function barn() {
  const m = new MeshBuilder();
  gablePrism(m, 9, 12, 4.5, 3.4, C('#c8433f'), C('#5b5f6b'));
  m.box(0, 1.8, 6.02, 1.8, 1.8, 0.05, C('#f4efe6'));
  m.box(0, 1.8, 6.06, 1.6, 0.12, 0.03, C('#c8433f'));
  return m;
}

function windmillTower() {
  const m = new MeshBuilder();
  m.cylinder(0, 5, 0, 2.0, 5, 8, 'y', C('#f4efe6'), C('#f4efe6'), 1.2);
  m.cylinder(0, 11, 0, 1.4, 1, 8, 'y', C('#5b6474'), C('#5b6474'), 0.2);
  m.box(0, 1.1, 1.95, 0.5, 1.1, 0.1, C('#8b5a3c'));
  return m;
}

/** Windmill sails, spun around local z at the hub. */
export function windmillSails() {
  const m = new MeshBuilder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = (x, y, z) => [x * c - y * s, x * s + y * c, z];
    const pts = [rot(-0.12, 0.6, 0), rot(0.12, 0.6, 0), rot(0.12, 7, 0), rot(-0.12, 7, 0)];
    m.quad(pts[0], pts[1], pts[2], pts[3], C('#6b4a2e'));
    const sail = [rot(0.15, 1.6, 0.02), rot(1.3, 1.6, 0.02), rot(1.3, 6.8, 0.02), rot(0.15, 6.8, 0.02)];
    m.quad(sail[0], sail[1], sail[2], sail[3], C('#fffaf0'));
  }
  m.cylinder(0, 0, 0, 0.35, 0.3, 8, 'z', C('#5b6474'));
  return m;
}

function cone() {
  const m = new MeshBuilder();
  m.box(0, 0.03, 0, 0.3, 0.03, 0.3, C('#1b1f3b'));
  m.cylinder(0, 0.4, 0, 0.22, 0.37, 8, 'y', C('#ff7a1a'), C('#ff7a1a'), 0.03);
  m.cylinder(0, 0.45, 0, 0.17, 0.07, 8, 'y', C('#ffffff'), C('#ffffff'), 0.14);
  return m;
}

export const MODEL_BUILDERS = {
  pine,
  oak,
  bush,
  flowers,
  rock,
  billboard,
  chevronL: () => chevron(-1),
  chevronR: () => chevron(1),
  lamp,
  house,
  barn,
  windmill: windmillTower,
  cone,
};
