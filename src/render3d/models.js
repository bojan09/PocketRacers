// Procedural scenery models. Each builder returns a MeshBuilder in local
// space: metres, origin on the ground, +z facing the oncoming driver.
// Organic shapes (trees, bushes) are smooth-shaded; man-made ones keep crisp
// edges. Materials: mb.material(specular, detail).

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const C = (hex) => hexToRgb(hex);
const vary = (c, rand, k = 0.12) => {
  const f = 1 + (rand() - 0.5) * k;
  return [c[0] * f, c[1] * f * (1 + (rand() - 0.5) * 0.06), c[2] * f];
};
const shadeBy = (c, t, lo = 0.62, hi = 1.12) => {
  const k = lo + (hi - lo) * t;
  return [c[0] * k, c[1] * k, c[2] * k];
};
const TRUNK = C('#6f4527');

function trunk(m, h, r, rand) {
  m.material(0, 0.8);
  m.cylinder(0, h / 2, 0, r, h / 2, 7, 'y', vary(TRUNK, rand), TRUNK, r * 0.7);
}

function pine(rand) {
  const m = new MeshBuilder();
  const h = 7 + rand() * 4;
  trunk(m, 1.6, 0.22, rand);
  m.material(0.05, 0.6);
  const g = vary(C('#1f6e43'), rand);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const base = 1.1 + i * h * 0.19;
    const r = 2.3 - i * 0.48;
    const tierH = h * 0.34;
    m.cylinder(0, base + tierH / 2, 0, r, tierH / 2, 11, 'y', shadeBy(g, 0.25 + t * 0.75), shadeBy(g, 0.2), 0);
  }
  return m;
}

function oak(rand) {
  const m = new MeshBuilder();
  trunk(m, 2.6, 0.3, rand);
  m.material(0.04, 0.55);
  const g = vary(C(rand() < 0.5 ? '#2f8f4a' : '#3d9d4f'), rand, 0.18);
  const blobs = [
    [0, 4.0, 0, 2.4, 2.0],
    [1.3, 3.4, 0.7, 1.6, 1.4],
    [-1.2, 3.6, -0.5, 1.7, 1.5],
    [0.2, 5.0, -0.3, 1.6, 1.4],
  ];
  for (const [x, y, z, r, ry] of blobs) {
    m.sphere(x, y, z, r, ry, r, g, { segs: 9, rings: 6, rand, jitter: 0.22, shadeFn: (t) => shadeBy(g, 1 - t, 0.6, 1.12) });
  }
  return m;
}

function bush(rand) {
  const m = new MeshBuilder().material(0.03, 0.6);
  const g = vary(C('#2f8a4c'), rand, 0.2);
  m.sphere(0, 0.5, 0, 1.0, 0.7, 1.0, g, { segs: 8, rings: 5, rand, jitter: 0.25, shadeFn: (t) => shadeBy(g, 1 - t) });
  m.sphere(0.75, 0.42, 0.25, 0.7, 0.5, 0.7, g, { segs: 7, rings: 4, rand, jitter: 0.25, shadeFn: (t) => shadeBy(g, 1 - t) });
  return m;
}

function flowers(rand) {
  const m = new MeshBuilder().material(0, 0.5);
  const g = C('#3a9a52');
  m.sphere(0, 0.25, 0, 0.95, 0.35, 0.95, g, { segs: 8, rings: 4, rand, jitter: 0.2, shadeFn: (t) => shadeBy(g, 1 - t) });
  const cols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b388ff', '#ff6b4a'].map(C);
  m.material(0.1, 0);
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.8;
    const c = cols[Math.floor(rand() * cols.length)];
    m.sphere(Math.cos(a) * r, 0.55 + rand() * 0.08, Math.sin(a) * r, 0.11, 0.07, 0.11, c, { segs: 6, rings: 3 });
  }
  return m;
}

function rock(rand) {
  const m = new MeshBuilder().material(0.05, 1);
  m.blob(0, 0.55, 0, 1.4, 1.0, 1.2, C('#8f949c'), rand, 0.45);
  m.blob(0.9, 0.3, 0.5, 0.6, 0.45, 0.6, C('#a3a8b0'), rand, 0.4);
  return m;
}

function billboard() {
  const m = new MeshBuilder().material(0.5, 0);
  const post = C('#6b7484');
  m.cylinder(-2.2, 2.2, 0, 0.14, 2.2, 8, 'y', post);
  m.cylinder(2.2, 2.2, 0, 0.14, 2.2, 8, 'y', post);
  m.material(0.2, 0);
  m.box(0, 4.6, -0.05, 3.4, 1.55, 0.12, C('#1b1f3b'));
  m.material(0.3, 0);
  m.box(0, 4.6, 0.09, 3.2, 1.35, 0.03, C('#ff4d5e'));
  m.box(-0.6, 4.95, 0.13, 2.3, 0.32, 0.02, C('#ffffff'));
  m.box(-0.9, 4.3, 0.13, 2.0, 0.32, 0.02, C('#ffd23f'));
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) m.box(2.05 + i * 0.28, 4.25 + j * 0.28, 0.13, 0.13, 0.13, 0.02, (i + j) % 2 ? C('#1b1f3b') : C('#ffffff'));
  return m;
}

function chevron(dir) {
  const m = new MeshBuilder().material(0.4, 0);
  m.cylinder(0, 0.7, 0, 0.06, 0.7, 8, 'y', C('#7d8796'));
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
  const m = new MeshBuilder().material(0.6, 0);
  const grey = C('#8a94a3');
  m.cylinder(0, 3, 0, 0.1, 3, 8, 'y', grey, grey, 0.07);
  m.box(0, 6, 0.6, 0.05, 0.05, 0.65, grey);
  m.box(0, 5.92, 1.15, 0.22, 0.07, 0.3, grey);
  m.material(0, 0);
  m.box(0, 5.84, 1.15, 0.18, 0.02, 0.24, C('#fff3c4'), 0.9);
  return m;
}

function gablePrism(m, w, d, wallH, roofH, wall, roof) {
  m.material(0.04, 0.6);
  m.box(0, wallH / 2, 0, w / 2, wallH / 2, d / 2, wall);
  const y0 = wallH;
  const y1 = wallH + roofH;
  const o = 0.4;
  m.material(0.15, 0.7);
  m.quad([-w / 2 - o, y0 - 0.1, -d / 2 - o], [0, y1, -d / 2 - o], [0, y1, d / 2 + o], [-w / 2 - o, y0 - 0.1, d / 2 + o], roof);
  m.quad([w / 2 + o, y0 - 0.1, -d / 2 - o], [w / 2 + o, y0 - 0.1, d / 2 + o], [0, y1, d / 2 + o], [0, y1, -d / 2 - o], roof);
  m.material(0.04, 0.6);
  m.tri([-w / 2, y0, d / 2], [w / 2, y0, d / 2], [0, y1, d / 2], wall);
  m.tri([-w / 2, y0, -d / 2], [0, y1, -d / 2], [w / 2, y0, -d / 2], wall);
}

function windowPane(m, x, y, z, w, h) {
  m.material(0.1, 0);
  m.box(x, y, z, w + 0.08, h + 0.08, 0.03, C('#ffffff'));
  m.material(0.9, 0);
  m.box(x, y, z + 0.02, w, h, 0.03, C('#5b84a8'));
  m.material(0.1, 0);
  m.box(x, y, z + 0.05, 0.03, h, 0.01, C('#ffffff'));
}

function house(rand) {
  const m = new MeshBuilder();
  const walls = ['#f6efe2', '#f3dcd4', '#dfe9f2', '#f4ecc8'].map(C);
  const wall = walls[Math.floor(rand() * walls.length)];
  const roof = C(rand() < 0.5 ? '#b8473f' : '#4f5f8f');
  gablePrism(m, 7, 6, 3.2, 2.6, wall, roof);
  m.material(0.2, 0.3);
  m.box(0, 1.05, 3.02, 0.55, 1.05, 0.05, C('#7a4b30'));
  for (const x of [-2.2, 2.2]) windowPane(m, x, 1.9, 3.0, 0.6, 0.5);
  m.material(0.9, 0);
  for (const z of [-1.5, 1.5]) m.box(3.52, 1.9, z, 0.03, 0.5, 0.55, C('#5b84a8'));
  m.material(0.05, 0.8);
  m.box(2, 6.1, -1, 0.35, 1.0, 0.35, C('#9a5d52'));
  // Garden hedge.
  m.material(0.03, 0.5);
  const hedge = C('#2f7d45');
  m.box(0, 0.45, 4.6, 4.2, 0.45, 0.35, hedge);
  return m;
}

function barn() {
  const m = new MeshBuilder();
  gablePrism(m, 9, 12, 4.5, 3.4, C('#b5382f'), C('#59606d'));
  m.material(0.1, 0.4);
  m.box(0, 1.8, 6.02, 1.8, 1.8, 0.05, C('#f1ebe0'));
  m.box(0, 1.8, 6.07, 1.6, 0.1, 0.03, C('#b5382f'));
  m.box(0, 1.8, 6.07, 0.1, 1.6, 0.03, C('#b5382f'));
  return m;
}

function windmillTower() {
  const m = new MeshBuilder().material(0.05, 0.7);
  m.cylinder(0, 5, 0, 2.0, 5, 12, 'y', C('#f1ebe0'), C('#f1ebe0'), 1.25);
  m.material(0.15, 0.4);
  m.cylinder(0, 11, 0, 1.45, 1, 12, 'y', C('#59606d'), C('#59606d'), 0.25);
  m.box(0, 1.1, 1.95, 0.5, 1.1, 0.1, C('#7a4b30'));
  return m;
}

/** Windmill sails, spun around local z at the hub. */
export function windmillSails() {
  const m = new MeshBuilder().material(0.05, 0.3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = (x, y, z) => [x * c - y * s, x * s + y * c, z];
    const pts = [rot(-0.12, 0.6, 0), rot(0.12, 0.6, 0), rot(0.12, 7, 0), rot(-0.12, 7, 0)];
    m.quad(pts[0], pts[1], pts[2], pts[3], C('#6b4a2e'));
    const sail = [rot(0.15, 1.6, 0.02), rot(1.3, 1.6, 0.02), rot(1.3, 6.8, 0.02), rot(0.15, 6.8, 0.02)];
    m.quad(sail[0], sail[1], sail[2], sail[3], C('#fbf6ec'));
  }
  m.cylinder(0, 0, 0, 0.35, 0.3, 10, 'z', C('#59606d'));
  return m;
}

function cone() {
  const m = new MeshBuilder().material(0.3, 0);
  m.box(0, 0.03, 0, 0.3, 0.03, 0.3, C('#1b1f3b'));
  m.cylinder(0, 0.4, 0, 0.22, 0.37, 10, 'y', C('#ff7a1a'), C('#ff7a1a'), 0.03);
  m.cylinder(0, 0.45, 0, 0.17, 0.07, 10, 'y', C('#ffffff'), C('#ffffff'), 0.14);
  return m;
}

/** A clump of grass blades (flat-coloured gradient triangles). */
export function grassTuft(rand) {
  const m = new MeshBuilder().material(0, 0);
  const base = C('#3f8f3a');
  const tip = C('#a6cf5c');
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI;
    const r = rand() * 0.25;
    const x = Math.cos(a * 2) * r;
    const z = Math.sin(a * 2) * r;
    const w = 0.05 + rand() * 0.04;
    const h = 0.35 + rand() * 0.35;
    const lean = (rand() - 0.5) * 0.25;
    const dx = Math.cos(a) * w;
    const dz = Math.sin(a) * w;
    m.triC([x - dx, 0, z - dz], [x + dx, 0, z + dz], [x + lean, h, z + lean * 0.5], base, base, tip);
  }
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
