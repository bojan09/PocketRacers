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
export function grassTuft(rand, kind = 'grass') {
  const m = new MeshBuilder().material(0, 0);
  const base = kind === 'dry' ? C('#9a7a3a') : C('#3f8f3a');
  const tip = kind === 'dry' ? C('#e0c27a') : C('#a6cf5c');
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

/** Collectible star: a chunky glowing 5-point star, upright, centred. */
export function starModel() {
  const m = new MeshBuilder().material(1, 0);
  const gold = C('#ffd23f');
  const edge = C('#f2a50c');
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.2 : 0.46;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const t = 0.09;
  for (let i = 0; i < 10; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % 10];
    m.tri([0, 0, t * 1.6], [x0, y0, t * 0.4], [x1, y1, t * 0.4], gold, 0.45);
    m.tri([0, 0, -t * 1.6], [x1, y1, -t * 0.4], [x0, y0, -t * 0.4], gold, 0.45);
    m.quad([x0, y0, t * 0.4], [x0, y0, -t * 0.4], [x1, y1, -t * 0.4], [x1, y1, t * 0.4], edge, 0.3);
  }
  return m;
}

// ------------------------------------------------------------ desert

function cactus(rand) {
  const m = new MeshBuilder().material(0.08, 0.5);
  const g = vary(C('#3f8f4a'), rand, 0.15);
  const h = 3.2 + rand() * 2.2;
  const r = 0.32;
  m.cylinder(0, h / 2, 0, r, h / 2, 10, 'y', g, g);
  m.sphere(0, h, 0, r, r * 0.9, r, g, { segs: 10, rings: 5 });
  // One or two arms: out, then up.
  const arms = rand() < 0.5 ? [-1, 1] : [rand() < 0.5 ? -1 : 1];
  for (const sx of arms) {
    const y = h * (0.4 + rand() * 0.2);
    const out = 0.65;
    const up = 0.8 + rand() * 0.9;
    const ar = r * 0.7;
    m.cylinder((sx * out) / 2, y, 0, ar, out / 2, 8, 'x', g, g);
    m.cylinder(sx * out, y + up / 2, 0, ar, up / 2, 8, 'y', g, g);
    m.sphere(sx * out, y + up, 0, ar, ar * 0.9, ar, g, { segs: 8, rings: 4 });
  }
  return m;
}

function desertRock(rand) {
  const m = new MeshBuilder().material(0.05, 0.9);
  const c = vary(C('#c27a4a'), rand, 0.2);
  const s = 1.2 + rand() * 1.4;
  m.blob(0, s * 0.45, 0, s * 1.3, s * 0.7, s, c, rand, 0.3);
  m.blob(s * 0.6, s * 0.3, s * 0.3, s * 0.7, s * 0.45, s * 0.6, shadeBy(c, 0.7), rand, 0.3);
  return m;
}

/** Big flat-topped sandstone mesa with layered bands (background). */
function mesa(rand) {
  const m = new MeshBuilder().material(0.03, 0.9);
  const bands = [C('#b5592e'), C('#d0834e'), C('#c06a3c'), C('#e0a06a')];
  const r = 16 + rand() * 14;
  const h = 18 + rand() * 20;
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const y0 = (h * i) / layers;
    const y1 = (h * (i + 1)) / layers;
    const rr = r * (1 - i * 0.07);
    m.cylinder(0, (y0 + y1) / 2, 0, rr, (y1 - y0) / 2, 9, 'y', vary(bands[i % bands.length], rand, 0.08), C('#e8b27c'), rr * 0.96, false);
  }
  return m;
}

// -------------------------------------------------------------- snow

function snowPine(rand) {
  const m = pine(rand);
  m.material(0.25, 0.3);
  const white = C('#f4f8ff');
  const h = 7 + rand() * 3;
  for (let i = 0; i < 4; i++) {
    const base = 1.1 + i * h * 0.19;
    const r = 2.3 - i * 0.48;
    const tierH = h * 0.34;
    // Snow caps on each tier.
    m.cylinder(0, base + tierH * 0.78, 0, r * 0.5, tierH * 0.24, 11, 'y', white, white, 0);
  }
  return m;
}

function snowman(rand) {
  const m = new MeshBuilder().material(0.3, 0.2);
  const white = C('#f7fbff');
  const s = 0.9 + rand() * 0.3;
  m.sphere(0, 0.75 * s, 0, 0.8 * s, 0.75 * s, 0.8 * s, white, { segs: 12, rings: 8 });
  m.sphere(0, 1.85 * s, 0, 0.58 * s, 0.55 * s, 0.58 * s, white, { segs: 12, rings: 8 });
  m.sphere(0, 2.7 * s, 0, 0.4 * s, 0.4 * s, 0.4 * s, white, { segs: 12, rings: 8 });
  m.material(0.1, 0);
  // Carrot nose, coal eyes and buttons, a scarf and a top hat.
  m.cylinder(0, 2.68 * s, 0.55 * s, 0.07 * s, 0.18 * s, 8, 'z', C('#ff8c1a'), C('#ff8c1a'), 0);
  for (const x of [-0.13, 0.13]) m.sphere(x * s, 2.82 * s, 0.35 * s, 0.05 * s, 0.05 * s, 0.05 * s, C('#1b1f3b'), { segs: 6, rings: 4 });
  for (const y of [1.65, 1.9, 2.15]) m.sphere(0, y * s, 0.55 * s, 0.06 * s, 0.06 * s, 0.05 * s, C('#1b1f3b'), { segs: 6, rings: 4 });
  const scarf = rand() < 0.5 ? C('#ff4d5e') : C('#2ec4b6');
  m.cylinder(0, 2.35 * s, 0, 0.44 * s, 0.08 * s, 12, 'y', scarf, scarf);
  m.box(0.25 * s, 2.05 * s, 0.38 * s, 0.09 * s, 0.25 * s, 0.03 * s, scarf);
  m.cylinder(0, 3.08 * s, 0, 0.38 * s, 0.03 * s, 12, 'y', C('#1b1f3b'), C('#1b1f3b'));
  m.cylinder(0, 3.3 * s, 0, 0.25 * s, 0.22 * s, 12, 'y', C('#1b1f3b'), C('#1b1f3b'));
  return m;
}

// -------------------------------------------------------------- autumn

/** Broad tree in autumn colours: orange, red or gold, a few leaves fallen. */
function autumnTree(rand) {
  const m = new MeshBuilder();
  trunk(m, 2.8, 0.3, rand);
  m.material(0.04, 0.55);
  const pick = ['#e8742a', '#d9452b', '#f2b134', '#c8562d', '#eb9a2c'];
  const g = vary(C(pick[Math.floor(rand() * pick.length)]), rand, 0.15);
  const blobs = [
    [0, 4.2, 0, 2.3, 1.9],
    [1.3, 3.5, 0.6, 1.5, 1.3],
    [-1.2, 3.7, -0.5, 1.6, 1.4],
    [0.1, 5.2, -0.2, 1.5, 1.3],
  ];
  for (const [x, y, z, r, ry] of blobs) m.sphere(x, y, z, r, ry, r, g, { segs: 9, rings: 6, rand, jitter: 0.24, shadeFn: (t) => shadeBy(g, 1 - t, 0.6, 1.15) });
  // A ring of fallen leaves round the trunk.
  m.material(0, 0.5);
  m.sphere(0, 0.02, 0, 2.4, 0.06, 2.4, shadeBy(g, 0.8), { segs: 10, rings: 3, rand, jitter: 0.2 });
  return m;
}

/** A few pumpkins on a straw patch. */
function pumpkins(rand) {
  const m = new MeshBuilder().material(0.25, 0.3);
  m.sphere(0, 0.03, 0, 1.3, 0.05, 1.0, C('#d9b45a'), { segs: 10, rings: 3 });
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.8 + (rand() - 0.5) * 0.2;
    const z = (rand() - 0.5) * 0.6;
    const r = 0.32 + rand() * 0.14;
    const o = vary(C('#f07a1a'), rand, 0.1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      m.sphere(x + Math.cos(a) * r * 0.35, r * 0.85, z + Math.sin(a) * r * 0.35, r * 0.6, r * 0.82, r * 0.6, shadeBy(o, k % 2 ? 0.9 : 1.05), { segs: 8, rings: 6 });
    }
    m.cylinder(x, r * 1.75, z, 0.05, 0.12, 6, 'y', C('#4f7a2a'), C('#4f7a2a'), 0.035);
  }
  return m;
}

// -------------------------------------------------------------- candy

const CANDY = ['#ff5fa2', '#ffd23f', '#5ad1ff', '#9b6bff', '#4fdc7b', '#ff8c42'];

/** Giant swirl lollipop on a white stick. */
function lollipop(rand) {
  const m = new MeshBuilder();
  const h = 4.2 + rand() * 1.8;
  m.material(0.4, 0);
  m.cylinder(0, h / 2, 0, 0.14, h / 2, 8, 'y', C('#fbf7f2'), C('#fbf7f2'));
  const a = C(CANDY[Math.floor(rand() * CANDY.length)]);
  const b = C('#ffffff');
  const R = 1.3 + rand() * 0.4;
  m.material(0.85, 0);
  // Swirl: rings of alternating colour on a flat disc facing the road.
  const rings = 6;
  for (let i = rings; i >= 1; i--) m.cylinder(0, h + R * 0.9, 0, (R * i) / rings, 0.18 + (rings - i) * 0.002, 22, 'z', i % 2 ? a : b, i % 2 ? a : b);
  return m;
}

/** Red and white striped candy cane. */
function candyCane(rand) {
  const m = new MeshBuilder().material(0.8, 0);
  const red = C(rand() < 0.75 ? '#e8343f' : '#2fbf71');
  const white = C('#fdfbf7');
  const h = 3.2 + rand() * 1.2;
  const n = 10;
  for (let i = 0; i < n; i++) m.cylinder(0, (h * (i + 0.5)) / n, 0, 0.22, h / n / 2 + 0.01, 10, 'y', i % 2 ? red : white, i % 2 ? red : white);
  // The hook.
  const hr = 0.7;
  for (let k = 0; k <= 8; k++) {
    const t = (k / 8) * Math.PI;
    m.sphere(hr - Math.cos(t) * hr, h + Math.sin(t) * hr, 0, 0.24, 0.24, 0.24, k % 2 ? red : white, { segs: 8, rings: 6 });
  }
  return m;
}

/** Sugary gumdrops in a cluster (soft: drive through). */
function gumdrop(rand) {
  const m = new MeshBuilder().material(0.9, 0);
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const c = C(CANDY[Math.floor(rand() * CANDY.length)]);
    const r = 0.45 + rand() * 0.35;
    const x = (rand() - 0.5) * 1.8;
    const z = (rand() - 0.5) * 1.2;
    m.sphere(x, 0, z, r, r * 1.3, r, c, { segs: 10, rings: 7 });
  }
  return m;
}

/** Gingerbread house with icing on the roof and sweets on the walls. */
function gingerHouse(rand) {
  const m = new MeshBuilder();
  const ginger = C('#b8763d');
  gablePrism(m, 6.5, 5.5, 3, 2.4, ginger, C('#fdf6ee'));
  m.material(0.6, 0);
  m.box(0, 1.0, 2.77, 0.55, 1.0, 0.05, C('#ff5fa2'));
  for (const x of [-2, 2]) {
    m.box(x, 1.9, 2.76, 0.55, 0.5, 0.04, C('#fff3c4'));
    m.box(x, 1.9, 2.79, 0.06, 0.5, 0.03, C('#ff5fa2'));
  }
  // Sweets along the walls.
  for (let i = 0; i < 7; i++) m.sphere(-3 + i, 0.25, 2.85, 0.22, 0.22, 0.12, C(CANDY[i % CANDY.length]), { segs: 8, rings: 5 });
  m.material(0.9, 0);
  m.cylinder(1.8, 5.6, -0.8, 0.3, 0.9, 8, 'y', C('#e8343f'), C('#ffffff'));
  return m;
}

// --------------------------------------------------------------- dinos

/** Giant prehistoric fern: arching fronds from a low clump (soft). */
function fern(rand) {
  const m = new MeshBuilder().material(0.05, 0.4);
  const leaf = vary(C('#3f9a3a'), rand, 0.2);
  const n = 7 + Math.floor(rand() * 3);
  const s = 1 + rand() * 0.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const len = (1.8 + rand() * 0.6) * s;
    const base = [0, 0.1, 0];
    const mid = [dx * len * 0.5, 1.5 * s, dz * len * 0.5];
    const tip = [dx * len, 0.5 * s, dz * len];
    const side = [-dz * 0.38 * s, 0, dx * 0.38 * s];
    m.tri(base, [mid[0] + side[0], mid[1], mid[2] + side[2]], mid, leaf);
    m.tri(base, mid, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.8));
    m.tri([mid[0] + side[0], mid[1], mid[2] + side[2]], tip, mid, shadeBy(leaf, 1.05));
    m.tri(mid, tip, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.85));
  }
  return m;
}

/** Cycad: a stubby scaly trunk with a crown of stiff fronds. */
function cycad(rand) {
  const m = new MeshBuilder();
  const h = 1.6 + rand() * 1.4;
  const bark = C('#7a5a3a');
  m.material(0.05, 0.9);
  for (let i = 0; i < 5; i++) {
    const y0 = (h * i) / 5;
    m.cylinder(0, y0 + h / 10, 0, 0.5 - i * 0.03, h / 10 + 0.02, 8, 'y', shadeBy(bark, i % 2 ? 0.85 : 1.05), bark, 0.42 - i * 0.03);
  }
  m.material(0.1, 0.4);
  const leaf = vary(C('#2f8a3a'), rand, 0.15);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.3;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const len = 2.4 + rand() * 0.6;
    const top = [0, h, 0];
    const mid = [dx * len * 0.5, h + 0.9, dz * len * 0.5];
    const tip = [dx * len, h + 0.2, dz * len];
    const side = [-dz * 0.3, 0, dx * 0.3];
    m.tri(top, [mid[0] + side[0], mid[1], mid[2] + side[2]], mid, leaf);
    m.tri(top, mid, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.82));
    m.tri([mid[0] + side[0], mid[1], mid[2] + side[2]], tip, mid, shadeBy(leaf, 1.05));
    m.tri(mid, tip, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.85));
  }
  return m;
}

/** Dark lava rock with glowing cracks. */
function lavaRock(rand) {
  const m = new MeshBuilder().material(0.1, 1);
  m.blob(0, 0.6, 0, 1.3, 1.0, 1.1, C('#3a3234'), rand, 0.5);
  m.blob(0.8, 0.35, 0.5, 0.6, 0.45, 0.55, C('#45393a'), rand, 0.4);
  m.material(0, 0);
  for (let i = 0; i < 3; i++) m.box(-0.4 + i * 0.4, 0.4 + rand() * 0.5, 0.95, 0.12, 0.04, 0.05, C('#ff7a1a'), 0.9);
  return m;
}

/** A big dinosaur skeleton lying by the road: ribs arching out of the ground. */
function bones(rand) {
  const m = new MeshBuilder().material(0.2, 0.5);
  const bone = C('#efe6cf');
  // Spine.
  for (let i = 0; i < 10; i++) m.sphere(-4.5 + i, 0.4 + Math.sin((i / 9) * Math.PI) * 0.6, 0, 0.32, 0.32, 0.32, bone, { segs: 8, rings: 5 });
  // Ribs: arches either side of the spine.
  for (let i = 0; i < 6; i++) {
    const x = -2.5 + i;
    const r = 1.8 - Math.abs(i - 2.5) * 0.25;
    for (const side of [-1, 1])
      for (let k = 0; k < 6; k++) {
        const t = (k / 5) * Math.PI * 0.55;
        m.sphere(x, 0.9 + Math.cos(t) * r * 0.9 - 0.4 * (k / 5), side * Math.sin(t) * r, 0.14, 0.14, 0.14, bone, { segs: 6, rings: 4 });
      }
  }
  // Skull with a big grin.
  m.sphere(5.6, 0.7, 0, 1.0, 0.65, 0.6, bone, { segs: 10, rings: 7 });
  m.sphere(6.4, 0.5, 0, 0.7, 0.42, 0.5, bone, { segs: 10, rings: 6 });
  m.material(0, 0);
  for (const z of [-0.45, 0.45]) m.sphere(5.6, 0.9, z, 0.22, 0.22, 0.12, C('#3a3030'), { segs: 8, rings: 5 });
  return m;
}

/** A twiggy nest holding three spotted eggs. */
function nest(rand) {
  const m = new MeshBuilder().material(0.05, 0.9);
  m.cylinder(0, 0.35, 0, 1.6, 0.35, 14, 'y', C('#8a6a3a'), C('#6a4f2a'), 1.9);
  m.material(0.5, 0);
  const egg = [C('#f4f0e2'), C('#d9f2c4'), C('#ffe2b8')];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rand();
    m.sphere(Math.cos(a) * 0.6, 1.1, Math.sin(a) * 0.6, 0.45, 0.62, 0.45, egg[i], { segs: 10, rings: 8 });
    m.sphere(Math.cos(a) * 0.6 + 0.3, 1.3, Math.sin(a) * 0.6 + 0.2, 0.12, 0.12, 0.1, C('#7aa04a'), { segs: 6, rings: 4 });
  }
  return m;
}

/** The volcano: a huge rocky cone, glowing crater and lava running down. */
function volcano(rand) {
  const m = new MeshBuilder().material(0.03, 1);
  const rock = C('#5a4a44');
  const H = 70;
  m.cylinder(0, H / 2 - 10, 0, 95, H / 2 + 10, 20, 'y', rock, rock, 22);
  m.cylinder(0, H - 3, 0, 22, 4, 20, 'y', shadeBy(rock, 0.8), C('#ff6a1a'), 15);
  m.material(0, 0);
  // Glowing lava pool in the crater and rivers down the side.
  m.cylinder(0, H + 1.1, 0, 15, 0.1, 18, 'y', C('#ffb03a'), C('#ffb03a'));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.5;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const r = 22 + t * 66;
      const w = 2.2 + t * 3;
      const ang = a + Math.sin(t * 5 + i) * 0.08;
      const y = H - t * (H + 4) + 0.6;
      pts.push([Math.cos(ang) * (r + 0.8), y, Math.sin(ang) * (r + 0.8), -Math.sin(ang) * w, Math.cos(ang) * w]);
    }
    for (let k = 0; k < 8; k++) {
      const [x0, y0, z0, sx0, sz0] = pts[k];
      const [x1, y1, z1, sx1, sz1] = pts[k + 1];
      m.quad([x0 - sx0, y0, z0 - sz0], [x1 - sx1, y1, z1 - sz1], [x1 + sx1, y1, z1 + sz1], [x0 + sx0, y0, z0 + sz0], C('#ff7a1a'), 0.95);
    }
  }
  // Smoke puffs above the crater.
  m.material(0, 0);
  for (let i = 0; i < 4; i++) m.sphere(rand() * 6 - 3, H + 10 + i * 9, rand() * 6 - 3, 9 + i * 3, 7 + i * 2, 9 + i * 3, C('#8a8080'), { segs: 9, rings: 6 });
  return m;
}

// ---------------------------------------------------------------- moon

const MOON_GREY = C('#9a9aa0');

/** Moon boulder. */
function moonRock(rand) {
  const m = new MeshBuilder().material(0.03, 1);
  m.blob(0, 0.5, 0, 1.2, 0.9, 1.1, vary(MOON_GREY, rand, 0.2), rand, 0.5);
  if (rand() < 0.6) m.blob(1.0, 0.3, 0.4, 0.5, 0.4, 0.5, vary(C('#85858c'), rand, 0.2), rand, 0.4);
  return m;
}

/** A crater: a raised ring of dust round a darker hollow (drive through). */
function crater(rand) {
  const m = new MeshBuilder().material(0, 1);
  const R = 3 + rand() * 4;
  const rim = shadeBy(MOON_GREY, 1.05);
  const floor = C('#5a5a62');
  const segs = 22;
  const P = [];
  const prof = [
    [R * 0.0, 0.04],
    [R * 0.6, 0.05],
    [R * 0.88, 0.35],
    [R, 0.7],
    [R * 1.15, 0.35],
    [R * 1.45, -0.1],
  ];
  for (const [r, y] of prof) {
    const row = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const k = 1 + (rand() - 0.5) * 0.12;
      row.push([Math.cos(a) * r * k, y * R * 0.26, Math.sin(a) * r * k]);
    }
    P.push(row);
  }
  m.grid(P, (i) => (i < 2 ? floor : i === 3 ? rim : shadeBy(MOON_GREY, 0.95)), { wrapJ: true });
  return m;
}

/** Moon base dome: a glass bubble on a ring, with a door and a flag. */
function dome(rand) {
  const m = new MeshBuilder().material(0.4, 0.2);
  const white = C('#e8ecf4');
  m.cylinder(0, 0.5, 0, 5.4, 0.5, 20, 'y', white, white);
  m.material(1, 0);
  m.sphere(0, 1, 0, 5, 4.2, 5, C('#7fb8e8'), { segs: 20, rings: 12 });
  m.material(0.4, 0.2);
  // Ribs over the glass.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    for (let k = 1; k < 10; k++) {
      const t = (k / 10) * Math.PI;
      m.sphere(Math.cos(t) * 5.05 * Math.cos(a), 1 + Math.sin(t) * 4.25, Math.cos(t) * 5.05 * Math.sin(a), 0.14, 0.14, 0.14, white, { segs: 6, rings: 4 });
    }
  }
  m.box(0, 1.3, 5.2, 1.0, 1.3, 0.8, white);
  m.box(0, 1.2, 6.02, 0.7, 1.1, 0.03, C('#2f8cff'));
  m.material(0, 0);
  m.box(0, 2.85, 6.02, 0.5, 0.12, 0.03, C('#7fe8ff'), 0.9);
  m.material(0.2, 0);
  m.box(-6.5, 3, 2, 0.06, 3, 0.06, C('#c8ccd8'));
  m.box(-5.8, 5.4, 2, 0.7, 0.45, 0.03, C(['#ff4d5e', '#2f8cff', '#ffd23f'][Math.floor(rand() * 3)]));
  return m;
}

/** Rocket on its launch pad: white body, red nose and fins, round windows. */
function rocket(rand) {
  const m = new MeshBuilder().material(0.4, 0.1);
  const white = C('#f4f4f8');
  const red = C(rand() < 0.5 ? '#e8343f' : '#2f8cff');
  m.cylinder(0, 0.3, 0, 3.2, 0.3, 16, 'y', C('#5a5c66'), C('#6a6c76'));
  m.cylinder(0, 7.6, 0, 1.4, 6.6, 16, 'y', white, white);
  m.cylinder(0, 16.2, 0, 1.4, 2, 16, 'y', red, red, 0);
  m.cylinder(0, 1.6, 0, 1.0, 1.0, 12, 'y', C('#4a4c56'), C('#2a2c36'), 1.3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    m.tri([dx * 1.3, 6, dz * 1.3], [dx * 3, 1.0, dz * 3], [dx * 1.3, 1.2, dz * 1.3], red);
    m.tri([dx * 1.3, 6, dz * 1.3], [dx * 1.3, 1.2, dz * 1.3], [dx * 3, 1.0, dz * 3], red);
  }
  m.material(0.9, 0);
  for (const y of [9, 12]) m.cylinder(0, y, 1.38, 0.5, 0.06, 14, 'z', C('#5ad1ff'), C('#5ad1ff'));
  return m;
}

/** Radar dish on a stand. */
function dish(rand) {
  const m = new MeshBuilder().material(0.5, 0.1);
  const grey = C('#c8ccd8');
  m.box(0, 1.6, 0, 0.3, 1.6, 0.3, C('#8a8e9a'));
  const P = [];
  for (let i = 0; i <= 5; i++) {
    const r = (i / 5) * 3;
    const row = [];
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * Math.PI * 2;
      // Bowl tipped back, facing up toward the sky.
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const z = r * r * 0.12;
      row.push([x, 4.2 + y * 0.7 + z * 0.7, z * 0.7 - y * 0.7]);
    }
    P.push(row);
  }
  m.grid(P, () => grey, { wrapJ: true });
  m.cylinder(0, 5.2, 0.8, 0.08, 1.0, 6, 'y', grey, grey);
  m.material(0, 0);
  m.sphere(0, 6.3, 0.8, 0.2, 0.2, 0.2, C('#ff4d5e'), { segs: 8, rings: 5, emissive: 0.9 });
  return m;
}

/** Short blue-lit marker post along the moon road. */
function moonLamp() {
  const m = new MeshBuilder().material(0.6, 0);
  const grey = C('#c8ccd8');
  m.cylinder(0, 0.7, 0, 0.12, 0.7, 8, 'y', grey, grey, 0.1);
  m.material(0, 0);
  m.sphere(0, 1.55, 0, 0.2, 0.2, 0.2, C('#7fe8ff'), { segs: 8, rings: 5, emissive: 0.9 });
  return m;
}

// -------------------------------------------------------------- city

const BUILDING_COLOURS = ['#3a4466', '#4a3f63', '#2f4f5f', '#5b4a3a', '#3d3d4f', '#2a5a4a'];

/** Tall city block with lit windows (glows at night). */
function tower(rand) {
  const m = new MeshBuilder();
  const w = 12 + rand() * 10;
  const d = 12 + rand() * 8;
  const h = 22 + rand() * 48;
  const body = C(BUILDING_COLOURS[Math.floor(rand() * BUILDING_COLOURS.length)]);
  m.material(0.25, 0.4);
  m.box(0, h / 2, 0, w / 2, h / 2, d / 2, body);
  m.box(0, h + 0.6, 0, w / 2 - 1.5, 0.6, d / 2 - 1.5, shadeBy(body, 0.4));
  // Windows on all four faces: some lit (warm), some dark.
  const lit = [C('#ffd98a'), C('#ffe7b0'), C('#bfe3ff')];
  const dark = shadeBy(body, 0.45);
  m.material(0.9, 0);
  const rows = Math.floor((h - 3) / 3.2);
  for (const face of [0, 1, 2, 3]) {
    const span = face % 2 ? d : w;
    const cols = Math.max(2, Math.floor(span / 3));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = rand() < 0.55;
        const col = on ? lit[Math.floor(rand() * lit.length)] : dark;
        const u = -span / 2 + (c + 0.5) * (span / cols);
        const y = 3 + r * 3.2 + 1.2;
        const hw = (span / cols) * 0.32;
        const off = (face % 2 ? w : d) / 2 + 0.03;
        const P = (a, b) => (face === 0 ? [a, b, off] : face === 2 ? [-a, b, -off] : face === 1 ? [off, b, -a] : [-off, b, a]);
        m.quad(P(u - hw, y - 0.8), P(u + hw, y - 0.8), P(u + hw, y + 0.8), P(u - hw, y + 0.8), col, on ? 0.85 : 0);
      }
    }
  }
  // Blinking-red-style roof light.
  m.box(0, h + 1.6, 0, 0.25, 0.4, 0.25, C('#ff4d5e'), 0.9);
  return m;
}

/** Low shop with a glowing sign and awning. */
function shop(rand) {
  const m = new MeshBuilder();
  const w = 10 + rand() * 6;
  const body = C(['#e9e2d0', '#d6e4f0', '#f0d9d9', '#dfe8d3'][Math.floor(rand() * 4)]);
  m.material(0.1, 0.5);
  m.box(0, 3, 0, w / 2, 3, 4, body);
  m.material(0.9, 0);
  m.box(0, 1.6, 4.02, w / 2 - 1, 1.2, 0.02, C('#ffe7b0'), 0.8);
  const sign = C(['#ff4d5e', '#4cc9f0', '#ffd23f', '#7b5cff'][Math.floor(rand() * 4)]);
  m.box(0, 4.6, 4.1, w / 2 - 1.5, 0.6, 0.1, sign, 0.9);
  m.material(0.2, 0.3);
  m.box(0, 3.3, 4.6, w / 2, 0.08, 0.7, shadeBy(sign, 0.8));
  return m;
}

// ------------------------------------------------------------ tropics

function palm(rand) {
  const m = new MeshBuilder();
  const h = 6 + rand() * 3;
  const lean = (rand() - 0.5) * 1.6;
  const trunkC = C('#9b7653');
  m.material(0.05, 0.8);
  const n = 7;
  let top = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const x0 = lean * t0 * t0;
    const x1 = lean * t1 * t1;
    const r = 0.26 - t0 * 0.08;
    m.cylinder((x0 + x1) / 2, (h * (t0 + t1)) / 2, 0, r, h / n / 2 + 0.03, 7, 'y', shadeBy(trunkC, i % 2 ? 0.85 : 1), trunkC, r * 0.92);
    top = [x1, h * t1, 0];
  }
  m.material(0.1, 0.4);
  const leaf = vary(C('#2f9a4a'), rand, 0.15);
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.3;
    const len = 3.2 + rand() * 0.8;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const mid = [top[0] + dx * len * 0.5, top[1] + 0.5, top[2] + dz * len * 0.5];
    const tip = [top[0] + dx * len, top[1] - 1.1, top[2] + dz * len];
    const side = [-dz * 0.55, 0, dx * 0.55];
    m.tri(top, [mid[0] + side[0], mid[1], mid[2] + side[2]], mid, leaf);
    m.tri(top, mid, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.85));
    m.tri([mid[0] + side[0], mid[1], mid[2] + side[2]], tip, mid, shadeBy(leaf, 0.95));
    m.tri(mid, tip, [mid[0] - side[0], mid[1], mid[2] - side[2]], shadeBy(leaf, 0.8));
  }
  for (let i = 0; i < 3; i++) m.sphere(top[0] + (i - 1) * 0.25, top[1] - 0.3, 0.2, 0.18, 0.18, 0.18, C('#6b4a2a'), { segs: 6, rings: 4 });
  return m;
}

function hut(rand) {
  const m = new MeshBuilder();
  const wood = C('#b07a4a');
  const straw = C('#d9b56a');
  m.material(0.05, 0.8);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) m.cylinder(x, 1, z, 0.15, 1, 6, 'y', wood, wood);
  m.box(0, 2.1, 0, 2.4, 0.12, 2.4, wood);
  m.box(0, 3.2, 0, 2.1, 1.0, 2.1, C(['#f2e6c9', '#bfe3f2', '#f7d1c4'][Math.floor(rand() * 3)]));
  m.material(0.05, 0.9);
  m.cylinder(0, 5.1, 0, 3.4, 0.95, 8, 'y', straw, straw, 0, false);
  return m;
}

function umbrella(rand) {
  const m = new MeshBuilder();
  const a = C(['#ff4d5e', '#4cc9f0', '#ffd23f', '#7b5cff'][Math.floor(rand() * 4)]);
  const b = C('#ffffff');
  m.material(0.3, 0);
  m.cylinder(0, 1.2, 0, 0.05, 1.2, 6, 'y', b, b);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    m.tri([0, 2.7, 0], [Math.cos(a1) * 1.6, 2.2, Math.sin(a1) * 1.6], [Math.cos(a0) * 1.6, 2.2, Math.sin(a0) * 1.6], i % 2 ? a : b);
  }
  return m;
}

/** A storybook castle: walls, four round towers with pointed roofs, a gate and flags. */
export function castle() {
  const m = new MeshBuilder().material(0.05, 0.8);
  const stone = C('#c9c2b4');
  const dark = C('#9a9283');
  const roof = C('#3d6bd6');
  const S = 10; // half size
  // Walls with battlements.
  for (const [x, z, hx, hz] of [
    [0, -S, S, 0.8],
    [0, S, S, 0.8],
    [-S, 0, 0.8, S],
    [S, 0, 0.8, S],
  ]) {
    m.box(x, 3.5, z, hx, 3.5, hz, stone);
    const n = Math.round(Math.max(hx, hz) / 1.2);
    for (let i = 0; i < n; i++) {
      const t = -1 + (2 * (i + 0.5)) / n;
      m.box(x + (hx > hz ? t * hx : 0), 7.4, z + (hz > hx ? t * hz : 0), hx > hz ? 0.45 : 0.85, 0.4, hz > hx ? 0.45 : 0.85, dark);
    }
  }
  // Keep in the middle.
  m.box(0, 7, 0, 4.5, 7, 4.5, stone);
  m.material(0.2, 0.3);
  m.cylinder(0, 16.5, 0, 5, 2.5, 4, 'y', roof, roof, 0);
  m.material(0.05, 0.8);
  for (const [x, z] of [
    [-S, -S],
    [S, -S],
    [-S, S],
    [S, S],
  ]) {
    m.cylinder(x, 5.5, z, 2.4, 5.5, 14, 'y', stone, stone);
    m.material(0.2, 0.3);
    m.cylinder(x, 13.5, z, 2.9, 2.5, 14, 'y', roof, roof, 0);
    m.material(0.1, 0);
    m.box(x, 17, z, 0.06, 1, 0.06, C('#6b4a2e'));
    m.box(x + 0.5, 17.6, z, 0.5, 0.3, 0.03, C('#ff4d5e'));
    m.material(0.05, 0.8);
  }
  // Gate and windows.
  m.box(0, 2.4, S + 0.82, 2.2, 2.4, 0.05, C('#4a3426'));
  for (const x of [-5, 5]) m.box(x, 5, S + 0.82, 0.6, 0.9, 0.05, C('#2a2f3c'));
  return m;
}

/** Lighthouse: striped tower, balcony and a glowing lamp. */
export function lighthouse() {
  const m = new MeshBuilder().material(0.2, 0.3);
  const red = C('#e63946');
  const white = C('#f6f2ea');
  for (let i = 0; i < 6; i++) {
    const y0 = i * 3;
    const r0 = 3.2 - i * 0.28;
    m.cylinder(0, y0 + 1.5, 0, r0, 1.5, 16, 'y', i % 2 ? red : white, i % 2 ? red : white, r0 - 0.28);
  }
  m.cylinder(0, 18.2, 0, 2.4, 0.2, 16, 'y', C('#2a2f3c'), C('#2a2f3c'));
  m.material(0, 0);
  m.cylinder(0, 19.4, 0, 1.3, 1, 12, 'y', C('#fff2a8'), C('#fff2a8'), 1.3);
  m.material(0.2, 0.3);
  m.cylinder(0, 21.2, 0, 1.6, 0.8, 12, 'y', red, red, 0);
  m.box(0, 1.2, 3.1, 0.6, 1.2, 0.1, C('#4a3426'));
  // Keeper's cottage beside the tower.
  const cottage = new MeshBuilder();
  gablePrism(cottage, 5, 6, 2.6, 1.8, white, C('#59606d'));
  m.append(cottage, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 6, 0, 0, 1]);
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
  cactus,
  desertRock,
  mesa,
  snowPine,
  snowman,
  tower,
  shop,
  palm,
  hut,
  umbrella,
  castle,
  lighthouse,
  autumnTree,
  pumpkins,
  lollipop,
  candyCane,
  gumdrop,
  gingerHouse,
  fern,
  cycad,
  lavaRock,
  bones,
  nest,
  volcano,
  moonRock,
  crater,
  dome,
  rocket,
  dish,
  moonLamp,
};
