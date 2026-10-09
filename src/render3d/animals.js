// Hidden animal models: chunky cartoon critters built from smooth spheres and
// cones (big heads, big eyes), so they read clearly from a moving car. Local
// space in metres, origin on the ground, +z facing the oncoming driver.

import { MeshBuilder } from '../gl/meshBuilder.js';
import { hexToRgb } from '../gl/math.js';

const C = hexToRgb;
const WHITE = C('#ffffff');
const BLACK = C('#15161c');
const PINK = C('#ff9cb8');
const ORANGE = C('#ff8c1a');

const FUR = [0.2, 0];
const SHINY = [0.9, 0];

function ball(m, x, y, z, rx, ry = rx, rz = rx, colour, mirror = false) {
  for (const sx of mirror ? [1, -1] : [1]) m.sphere(x * sx, y, z, rx, ry, rz, colour, { segs: 16, rings: 10 });
}

function cone(m, x, y, z, r, h, colour, mirror = false, axis = 'y') {
  for (const sx of mirror ? [1, -1] : [1]) m.cylinder(x * sx, y, z, r, h / 2, 12, axis, colour, colour, 0);
}

/** A pair of big cartoon eyes looking at the driver. */
function eyes(m, x, y, z, r = 0.085, white = WHITE) {
  m.material(...SHINY);
  ball(m, x, y, z, r, r * 1.15, r * 0.7, white, true);
  ball(m, x, y + r * 0.1, z + r * 0.45, r * 0.58, r * 0.66, r * 0.42, BLACK, true);
  ball(m, x + r * 0.22, y + r * 0.42, z + r * 0.8, r * 0.18, r * 0.18, r * 0.1, WHITE, true);
  m.material(...FUR);
}

/** Sitting critter: egg body, belly, paws and feet, big round head. */
function sitter(m, { fur, belly = fur, head = 0.4, headY = 1.12, cheeks = true }) {
  m.material(...FUR);
  ball(m, 0, 0.45, 0, 0.42, 0.48, 0.38, fur);
  ball(m, 0, 0.42, 0.17, 0.28, 0.33, 0.24, belly);
  ball(m, 0.2, 0.08, 0.2, 0.13, 0.08, 0.18, fur, true);
  ball(m, 0.25, 0.5, 0.24, 0.09, 0.16, 0.09, fur, true);
  ball(m, 0, headY, 0.05, head, head * 0.95, head * 0.92, fur);
  if (cheeks) ball(m, 0.25 * (head / 0.4), headY - 0.1, 0.05 + head * 0.68, 0.065, 0.045, 0.03, PINK, true);
}

function bunny() {
  const m = new MeshBuilder();
  const fur = C('#f2efe9');
  sitter(m, { fur, belly: WHITE });
  ball(m, 0.13, 1.68, -0.02, 0.09, 0.33, 0.065, fur, true);
  ball(m, 0.13, 1.68, 0.03, 0.05, 0.25, 0.035, PINK, true);
  ball(m, 0, 0.3, -0.4, 0.14, 0.14, 0.14, WHITE);
  ball(m, 0, 1.08, 0.42, 0.055, 0.04, 0.035, PINK);
  eyes(m, 0.15, 1.2, 0.36);
  return m;
}

function pig() {
  const m = new MeshBuilder();
  const fur = C('#ff9ebd');
  sitter(m, { fur, belly: C('#ffc2d4'), cheeks: false });
  m.cylinder(0, 1.04, 0.42, 0.13, 0.05, 16, 'z', C('#ff7aa2'), C('#ff7aa2'));
  ball(m, 0.05, 1.04, 0.475, 0.025, 0.035, 0.01, C('#c75a7a'), true);
  ball(m, 0.24, 1.47, 0, 0.11, 0.14, 0.05, C('#ff8fab'), true);
  // Curly tail.
  ball(m, 0, 0.42, -0.42, 0.07, 0.07, 0.07, fur);
  ball(m, 0.05, 0.5, -0.45, 0.05, 0.05, 0.05, fur);
  eyes(m, 0.16, 1.2, 0.35, 0.075);
  return m;
}

function duck() {
  // A mallard, like the sticker: green head, white collar, brown chest.
  const m = new MeshBuilder();
  m.material(...FUR);
  const body = C('#b9b4a8');
  const green = C('#1f8a4c');
  ball(m, 0, 0.42, -0.05, 0.38, 0.32, 0.5, body);
  ball(m, 0, 0.45, 0.24, 0.3, 0.26, 0.24, C('#8a4b2a'));
  ball(m, 0, 0.6, -0.5, 0.14, 0.12, 0.16, C('#3a3a40'));
  ball(m, 0.33, 0.48, -0.08, 0.08, 0.17, 0.3, C('#8f8a80'), true);
  ball(m, 0.34, 0.47, -0.2, 0.03, 0.06, 0.1, C('#3d5bd9'), true);
  ball(m, 0, 0.74, 0.22, 0.16, 0.06, 0.16, WHITE);
  ball(m, 0, 0.85, 0.22, 0.15, 0.16, 0.15, green);
  ball(m, 0, 1.1, 0.22, 0.27, 0.26, 0.26, green);
  m.material(...SHINY);
  ball(m, 0, 1.04, 0.5, 0.13, 0.05, 0.15, C('#ffc21a'));
  m.material(...FUR);
  ball(m, 0.15, 0.03, 0.18, 0.1, 0.03, 0.14, ORANGE, true);
  eyes(m, 0.12, 1.16, 0.42, 0.07);
  return m;
}

function fox() {
  const m = new MeshBuilder();
  const fur = C('#f08a32');
  sitter(m, { fur, belly: C('#fff3e3') });
  cone(m, 0.22, 1.5, 0, 0.13, 0.32, fur, true);
  cone(m, 0.22, 1.47, 0.05, 0.07, 0.2, C('#3a2418'), true);
  ball(m, 0, 1.0, 0.36, 0.17, 0.12, 0.14, C('#fff3e3'));
  ball(m, 0, 1.03, 0.5, 0.045, 0.04, 0.03, BLACK);
  // Big bushy tail with a white tip.
  ball(m, 0.32, 0.3, -0.38, 0.22, 0.18, 0.34, fur);
  ball(m, 0.42, 0.38, -0.66, 0.13, 0.12, 0.14, WHITE);
  eyes(m, 0.15, 1.2, 0.35);
  return m;
}

function camel() {
  const m = new MeshBuilder();
  m.material(...FUR);
  const fur = C('#d8a865');
  for (const [x, z] of [
    [0.24, 0.42],
    [0.24, -0.42],
  ]) {
    m.cylinder(x, 0.5, z, 0.09, 0.5, 10, 'y', fur, fur, 0.08);
    m.cylinder(-x, 0.5, z, 0.09, 0.5, 10, 'y', fur, fur, 0.08);
  }
  ball(m, 0, 1.15, 0, 0.42, 0.36, 0.72, fur);
  ball(m, 0, 1.52, -0.25, 0.24, 0.26, 0.24, fur);
  ball(m, 0, 1.5, 0.25, 0.22, 0.22, 0.22, fur);
  for (let i = 0; i < 5; i++) ball(m, 0, 1.35 + i * 0.13, 0.6 + i * 0.07, 0.15, 0.15, 0.15, fur);
  ball(m, 0, 2.02, 0.97, 0.22, 0.2, 0.3, fur);
  ball(m, 0, 1.96, 1.22, 0.12, 0.1, 0.08, C('#c08d4f'));
  ball(m, 0.15, 2.18, 0.86, 0.05, 0.08, 0.04, fur, true);
  eyes(m, 0.12, 2.1, 1.12, 0.07);
  return m;
}

function lizard() {
  const m = new MeshBuilder();
  m.material(...FUR);
  const skin = C('#7ed957');
  const spots = C('#ffd23f');
  ball(m, 0, 0.3, 0, 0.3, 0.22, 0.55, skin);
  ball(m, 0, 0.42, 0.58, 0.28, 0.24, 0.3, skin);
  for (let i = 0; i < 6; i++) {
    const r = 0.18 - i * 0.025;
    ball(m, Math.sin(i * 0.8) * 0.12, 0.22 - i * 0.02, -0.6 - i * 0.2, r, r * 0.8, r * 1.3, skin);
  }
  for (const [x, z] of [
    [0.3, 0.32],
    [0.3, -0.3],
  ])
    ball(m, x, 0.1, z, 0.12, 0.08, 0.12, skin, true);
  ball(m, 0.12, 0.48, 0.1, 0.06, 0.03, 0.06, spots, true);
  ball(m, 0, 0.5, -0.2, 0.07, 0.03, 0.07, spots);
  ball(m, 0.08, 0.36, 0.86, 0.05, 0.03, 0.02, PINK, true);
  eyes(m, 0.15, 0.6, 0.72, 0.1);
  return m;
}

function polarbear() {
  const m = new MeshBuilder();
  const fur = C('#f6f8fb');
  sitter(m, { fur, belly: C('#ffffff') });
  ball(m, 0.27, 1.45, -0.02, 0.11, 0.11, 0.06, fur, true);
  ball(m, 0.27, 1.45, 0.02, 0.06, 0.06, 0.04, C('#d9dfe8'), true);
  ball(m, 0, 1.0, 0.36, 0.18, 0.13, 0.13, C('#eef1f6'));
  ball(m, 0, 1.06, 0.49, 0.06, 0.045, 0.035, BLACK);
  eyes(m, 0.15, 1.22, 0.35, 0.07);
  return m;
}

function owl() {
  const m = new MeshBuilder();
  m.material(...FUR);
  const fur = C('#9a6a43');
  ball(m, 0, 0.62, 0, 0.44, 0.62, 0.4, fur);
  ball(m, 0, 0.5, 0.18, 0.32, 0.42, 0.26, C('#f1dcc0'));
  ball(m, 0, 0.98, 0.2, 0.36, 0.28, 0.2, C('#e6c9a2'));
  cone(m, 0.26, 1.27, 0, 0.09, 0.26, fur, true);
  ball(m, 0.42, 0.6, -0.02, 0.1, 0.36, 0.26, C('#7c5233'), true);
  ball(m, 0.14, 0.04, 0.2, 0.09, 0.04, 0.12, ORANGE, true);
  m.material(...SHINY);
  ball(m, 0.15, 1.0, 0.36, 0.13, 0.13, 0.06, C('#ffc93c'), true);
  m.cylinder(0, 0.88, 0.42, 0.05, 0.06, 10, 'y', ORANGE, ORANGE, 0);
  m.material(...FUR);
  eyes(m, 0.15, 1.0, 0.39, 0.085, C('#ffc93c'));
  return m;
}

function penguin() {
  const m = new MeshBuilder();
  m.material(...SHINY.map((v, i) => (i === 0 ? 0.5 : v)));
  const black = C('#232838');
  ball(m, 0, 0.62, 0, 0.4, 0.62, 0.36, black);
  ball(m, 0, 0.58, 0.12, 0.31, 0.52, 0.28, WHITE);
  ball(m, 0, 1.18, 0.02, 0.32, 0.3, 0.3, black);
  ball(m, 0, 1.12, 0.14, 0.24, 0.2, 0.2, WHITE);
  ball(m, 0.42, 0.62, 0, 0.07, 0.3, 0.16, black, true);
  ball(m, 0.15, 0.04, 0.16, 0.11, 0.04, 0.14, ORANGE, true);
  m.cylinder(0, 1.08, 0.4, 0.07, 0.08, 10, 'z', ORANGE, ORANGE, 0);
  ball(m, 0.22, 1.02, 0.25, 0.06, 0.04, 0.03, PINK, true);
  eyes(m, 0.11, 1.2, 0.3, 0.07);
  return m;
}

function cat() {
  const m = new MeshBuilder();
  const fur = C('#8e95a8');
  sitter(m, { fur, belly: C('#eef0f5') });
  cone(m, 0.22, 1.49, 0, 0.13, 0.28, fur, true);
  cone(m, 0.22, 1.46, 0.05, 0.07, 0.18, PINK, true);
  ball(m, 0, 1.05, 0.42, 0.045, 0.035, 0.03, PINK);
  // Stripes on the head and a tail curling up the side.
  ball(m, 0, 1.42, 0.12, 0.05, 0.02, 0.14, C('#5d6375'));
  for (let i = 0; i < 6; i++) ball(m, 0.35 + Math.sin(i * 0.45) * 0.08, 0.15 + i * 0.13, -0.32 + i * 0.03, 0.075, 0.075, 0.075, i % 2 ? C('#5d6375') : fur);
  // Whiskers.
  m.material(...SHINY);
  for (const dy of [-0.02, 0.03]) {
    m.box(0.3, 1.02 + dy, 0.36, 0.12, 0.006, 0.006, WHITE);
    m.box(-0.3, 1.02 + dy, 0.36, 0.12, 0.006, 0.006, WHITE);
  }
  m.material(...FUR);
  eyes(m, 0.15, 1.2, 0.36, 0.085, C('#b6f36b'));
  return m;
}

function dog() {
  const m = new MeshBuilder();
  const fur = C('#c98b4e');
  sitter(m, { fur, belly: C('#f7e3c9') });
  ball(m, 0.38, 1.1, 0, 0.1, 0.25, 0.15, C('#7a4b25'), true);
  ball(m, 0, 1.0, 0.34, 0.18, 0.13, 0.14, C('#f7e3c9'));
  ball(m, 0, 1.06, 0.48, 0.065, 0.05, 0.04, BLACK);
  ball(m, 0, 0.92, 0.45, 0.06, 0.03, 0.03, C('#ff6b81'));
  ball(m, 0, 0.75, 0.3, 0.3, 0.05, 0.12, C('#e63946'));
  ball(m, 0, 0.42, -0.42, 0.08, 0.08, 0.16, fur);
  eyes(m, 0.15, 1.22, 0.35, 0.08);
  return m;
}

function raccoon() {
  const m = new MeshBuilder();
  const fur = C('#8d8f99');
  const dark = C('#3a3c46');
  sitter(m, { fur, belly: C('#d9dbe2') });
  cone(m, 0.24, 1.46, 0, 0.12, 0.24, fur, true);
  ball(m, 0, 1.16, 0.2, 0.37, 0.11, 0.24, dark);
  ball(m, 0, 1.0, 0.36, 0.16, 0.11, 0.13, C('#f1f2f5'));
  ball(m, 0, 1.03, 0.49, 0.045, 0.035, 0.03, BLACK);
  // Ringed tail.
  for (let i = 0; i < 7; i++) ball(m, 0.3, 0.18 + i * 0.12, -0.4 - Math.sin(i * 0.4) * 0.1, 0.12, 0.08, 0.12, i % 2 ? dark : fur);
  eyes(m, 0.15, 1.18, 0.4, 0.08);
  return m;
}

function crab() {
  const m = new MeshBuilder();
  m.material(...SHINY.map((v, i) => (i === 0 ? 0.5 : v)));
  const red = C('#ff4d3d');
  ball(m, 0, 0.42, 0, 0.55, 0.28, 0.4, red);
  for (let i = 0; i < 3; i++) m.cylinder(0.62, 0.2, -0.2 + i * 0.2, 0.04, 0.2, 8, 'x', red, red, 0.03);
  for (let i = 0; i < 3; i++) m.cylinder(-0.62, 0.2, -0.2 + i * 0.2, 0.04, 0.2, 8, 'x', red, red, 0.03);
  // Claws held up.
  ball(m, 0.62, 0.6, 0.38, 0.1, 0.1, 0.1, red, true);
  ball(m, 0.7, 0.85, 0.45, 0.2, 0.22, 0.14, red, true);
  ball(m, 0.82, 1.04, 0.45, 0.07, 0.12, 0.07, red, true);
  // Eyes on stalks.
  m.cylinder(0.16, 0.8, 0.22, 0.04, 0.18, 8, 'y', red, red);
  m.cylinder(-0.16, 0.8, 0.22, 0.04, 0.18, 8, 'y', red, red);
  eyes(m, 0.16, 1.02, 0.24, 0.1);
  ball(m, 0, 0.42, 0.39, 0.12, 0.03, 0.02, BLACK);
  return m;
}

function parrot() {
  const m = new MeshBuilder();
  m.material(...SHINY.map((v, i) => (i === 0 ? 0.4 : v)));
  const green = C('#2ec46b');
  ball(m, 0, 0.7, 0, 0.36, 0.52, 0.34, green);
  ball(m, 0, 0.6, 0.14, 0.24, 0.36, 0.22, C('#ffd23f'));
  ball(m, 0, 1.22, 0.04, 0.3, 0.3, 0.3, C('#ff3b47'));
  ball(m, 0.38, 0.7, -0.04, 0.08, 0.38, 0.22, C('#2b6fd6'), true);
  m.box(0, 0.32, -0.42, 0.12, 0.3, 0.05, C('#2b6fd6'));
  m.box(0, 0.12, -0.5, 0.1, 0.18, 0.04, C('#ff3b47'));
  ball(m, 0, 1.12, 0.36, 0.1, 0.13, 0.12, C('#f4f1e8'));
  ball(m, 0, 1.02, 0.42, 0.05, 0.06, 0.05, C('#2b2f36'));
  ball(m, 0.13, 0.05, 0.12, 0.08, 0.05, 0.12, C('#7a7f8c'), true);
  eyes(m, 0.15, 1.3, 0.24, 0.075);
  return m;
}

function turtle() {
  const m = new MeshBuilder();
  m.material(...SHINY.map((v, i) => (i === 0 ? 0.4 : v)));
  const skin = C('#9be36a');
  const shell = C('#2a9d5c');
  for (const [x, z] of [
    [0.45, 0.35],
    [0.45, -0.35],
  ])
    ball(m, x, 0.14, z, 0.16, 0.12, 0.18, skin, true);
  ball(m, 0, 0.36, 0, 0.62, 0.42, 0.66, shell);
  ball(m, 0, 0.2, 0, 0.66, 0.1, 0.7, C('#f2d27a'));
  for (const [x, z] of [
    [0, 0],
    [0.3, 0.25],
    [-0.3, 0.25],
    [0.3, -0.25],
    [-0.3, -0.25],
  ])
    ball(m, x, 0.66 - Math.hypot(x, z) * 0.35, z, 0.15, 0.06, 0.15, C('#4cc285'));
  ball(m, 0, 0.42, 0.7, 0.13, 0.12, 0.2, skin);
  ball(m, 0, 0.6, 0.92, 0.25, 0.23, 0.24, skin);
  ball(m, 0.17, 0.5, 1.08, 0.05, 0.035, 0.02, PINK, true);
  ball(m, 0, 0.3, -0.72, 0.08, 0.06, 0.12, skin);
  eyes(m, 0.11, 0.68, 1.08, 0.075);
  return m;
}

export const ANIMAL_MODELS = { bunny, pig, duck, fox, camel, lizard, polarbear, owl, penguin, cat, dog, raccoon, crab, parrot, turtle };
