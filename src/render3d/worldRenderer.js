// Open-world rendering for Renderer3D: the landscape is built in chunks
// around the player as they drive (a few per frame, nearest first) and
// dropped when far behind. Reuses the renderer's sky, lighting, cars,
// trailers, particles and shadows; only the world and camera differ.

import { uploadMesh, deleteMesh } from '../gl/gl.js';
import { mat4, hexToRgb, transformPoint } from '../gl/math.js';
import { clamp } from '../core/util.js';
import { MeshBuilder } from '../gl/meshBuilder.js';
import { CHUNK, CELL, WATER, SNOW_LINE, ROAD_HALF } from '../world/openWorld.js';
import { MODEL_BUILDERS } from './models.js';
import { PROP_MODELS } from './props.js';
import { mulberry32 } from '../core/util.js';
import { buildCloudPuffs } from './environment.js';
import { makeFrame } from '../world/track3d.js';

const VIEW_CHUNKS = 3; // chunks in each direction around the player
const BUILDS_PER_FRAME = 1; // ~3 ms each on a desktop; one per frame keeps phones smooth
const DEG = Math.PI / 180;

/** Ground mesh for one chunk, coloured by height, slope and patches. */
export function buildChunkMesh(world, cx, cz, pal) {
  const { h, w, n } = world.chunkHeights(cx, cz);
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const H = (i, j) => h[(j + 1) * w + (i + 1)]; // i, j in -1..n+1
  const grass = hexToRgb(pal.grass);
  const grassAlt = hexToRgb(pal.grassAlt);
  const dry = hexToRgb(pal.dryGrass || '#a9b65a');
  const rock = hexToRgb(pal.rockFace || '#8b8f99');
  const sand = hexToRgb(pal.sand || '#e8d49a');
  const snow = [0.96, 0.97, 1];
  const forest = [0.24, 0.5, 0.22];
  const desert = [0.9, 0.7, 0.42];
  const desertDark = [0.8, 0.56, 0.32];
  const noise = world.noise2;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const P = [];
  const N = [];
  const Cl = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * CELL;
      const z = z0 + j * CELL;
      const y = H(i, j);
      const nx = H(i - 1, j) - H(i + 1, j);
      const nz = H(i, j - 1) - H(i, j + 1);
      const ny = 2 * CELL;
      const l = Math.hypot(nx, ny, nz);
      P.push([x, y, z]);
      N.push([nx / l, ny / l, nz / l]);
      const patch = noise(x * 0.012 + 11, z * 0.012 - 7) + 0.5;
      const fleck = noise(x * 0.08, z * 0.08) + 0.5;
      let c = mix(grass, grassAlt, clamp(patch * 1.3 - 0.15, 0, 1));
      c = mix(c, dry, Math.max(0, fleck - 0.62) * 1.4);
      // Areas blend into each other: forest darker, desert sandy.
      const region = world.region(x, z);
      c = mix(c, forest, clamp((-region - 0.13) / 0.08, 0, 1));
      c = mix(c, mix(desert, desertDark, fleck), clamp((region - 0.1) / 0.08, 0, 1));
      c = mix(c, rock, clamp((1 - ny / l - 0.2) * 4, 0, 1));
      c = mix(c, sand, clamp((WATER + 2.2 - y) / 2.5, 0, 1));
      c = mix(c, snow, clamp((y - SNOW_LINE + 4) / 8, 0, 1));
      Cl.push(c);
    }
  }
  const mb = new MeshBuilder().material(0, 1);
  const k = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Same diagonal split as OpenWorld.ground().
      const a = k(i, j);
      const b = k(i + 1, j + 1);
      const c = k(i + 1, j);
      const d = k(i, j + 1);
      mb.triS(P[a], P[b], P[c], N[a], N[b], N[c], Cl[a], Cl[b], Cl[c]);
      mb.triS(P[a], P[d], P[b], N[a], N[d], N[b], Cl[a], Cl[d], Cl[b]);
    }
  }
  return mb;
}

/** Trees, rocks and buildings of a chunk merged into one mesh. */
export function buildChunkScenery(world, cx, cz, variants) {
  const mb = new MeshBuilder();
  const m = mat4.create();
  const rand = mulberry32((cx * 7919 + cz * 104729) >>> 0);
  for (const o of world.chunkObjects(cx, cz)) {
    if (o.prop) continue;
    const list = variants(o.kind);
    if (!list) continue;
    mat4.identity(m);
    mat4.translate(m, m, o.x, o.y - 0.05, o.z);
    mat4.rotateY(m, m, o.yaw);
    if (o.scale !== 1) mat4.scale(m, m, o.scale);
    mb.append(list[Math.floor(rand() * list.length)], m);
  }
  addRoads(mb, world, cx, cz);
  return mb;
}

const ASPHALT = [0.34, 0.36, 0.41];
const LINE = [0.95, 0.95, 0.92];
const CENTRE = [1, 0.85, 0.3];

/** Road surface (asphalt, edge lines, dashed centre line) for one chunk. */
function addRoads(mb, world, cx, cz) {
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  mb.material(0.15, 0.4);
  for (const road of world.roads) {
    const S = road.samples;
    const lift = 0.06 + (road.samples[0].road % 4) * 0.006; // no flicker where roads meet
    for (let i = 0; i < S.length; i++) {
      const a = S[i];
      if (a.x < x0 || a.x >= x0 + CHUNK || a.z < z0 || a.z >= z0 + CHUNK) continue;
      const b = S[i + 1] || (road.closed ? S[0] : null);
      if (!b) continue;
      const at = (s, off, dy = 0) => [s.x - s.tz * off, s.h + lift + dy, s.z + s.tx * off];
      const band = (o0, o1, c, dy = 0) => mb.quad(at(a, o0, dy), at(a, o1, dy), at(b, o1, dy), at(b, o0, dy), c);
      band(-ROAD_HALF, ROAD_HALF, ASPHALT);
      band(-ROAD_HALF + 0.2, -ROAD_HALF + 0.42, LINE, 0.01);
      band(ROAD_HALF - 0.42, ROAD_HALF - 0.2, LINE, 0.01);
      if (a.i % 4 < 2) band(-0.1, 0.1, CENTRE, 0.01);
      // Kerb skirt down into the ground so the edge never floats.
      mb.quad(at(a, -ROAD_HALF), at(b, -ROAD_HALF), at(b, -ROAD_HALF - 0.2, -0.5), at(a, -ROAD_HALF - 0.2, -0.5), [0.42, 0.42, 0.44]);
      mb.quad(at(a, ROAD_HALF), at(a, ROAD_HALF + 0.2, -0.5), at(b, ROAD_HALF + 0.2, -0.5), at(b, ROAD_HALF), [0.42, 0.42, 0.44]);
    }
  }
}

export function installWorldRendering(Renderer3D) {
  const R = Renderer3D.prototype;

  /** Switch to the open world (track meshes stay loaded for later). */
  R.setWorld = function (world, palette, env = {}) {
    this.world = world;
    this.worldPalette = palette;
    this.worldEnv = env;
    this.freeWorldChunks();
    this.worldChunks = new Map();
    this.worldPal = {
      fog: hexToRgb(palette.fog),
      sun: hexToRgb(palette.sunColor).map((c) => c * 0.98),
      skyAmb: hexToRgb(palette.skyAmbient).map((c) => c * 0.6),
      groundAmb: hexToRgb(palette.groundAmbient).map((c) => c * 0.5),
      skyTop: hexToRgb(palette.skyTop),
      skyHorizon: hexToRgb(palette.skyHorizon),
      groundRefl: hexToRgb(palette.grass).map((c) => c * 0.45),
      sunDir: norm(palette.sunDir),
      fogNear: palette.fogNear,
      fogFar: palette.fogFar,
      stars: 0,
    };
    this.worldClouds = buildCloudPuffs([0, 0, 0]);
    // A few variants of every scenery model, shared by all chunks.
    const vr = mulberry32(99);
    this.sceneryVariants = {};
    this.worldVariants = (kind) => {
      if (!MODEL_BUILDERS[kind]) return null;
      return (this.sceneryVariants[kind] ||= [0, 1, 2].map(() => MODEL_BUILDERS[kind](vr)));
    };
    if (!this.worldPropMeshes) this.worldPropMeshes = Object.fromEntries(Object.entries(PROP_MODELS).map(([k, b]) => [k, uploadMesh(this.gl, b())]));
    const wmb = new MeshBuilder().material(1, 0);
    const wc = hexToRgb(palette.water || '#3fa9e0');
    const E = 6000;
    wmb.quad([-E, WATER, -E], [E, WATER, -E], [E, WATER, E], [-E, WATER, E], wc, 0);
    if (this.worldWater) deleteMesh(this.gl, this.worldWater);
    this.worldWater = uploadMesh(this.gl, wmb);
    this.trailCount = 0;
    this.particles?.clear();
    this.camDir = null;
    // Build what is around the start straight away.
    this.streamWorld(world.spawn.x, world.spawn.z, Infinity);
  };

  R.freeWorldChunks = function () {
    for (const c of this.worldChunks?.values() || []) {
      deleteMesh(this.gl, c.mesh);
      deleteMesh(this.gl, c.scenery);
    }
    this.worldChunks?.clear();
  };

  /** Load chunks around (x, z), nearest first; drop far ones. */
  R.streamWorld = function (x, z, budget = BUILDS_PER_FRAME) {
    const ccx = Math.floor(x / CHUNK);
    const ccz = Math.floor(z / CHUNK);
    const want = [];
    for (let dz = -VIEW_CHUNKS; dz <= VIEW_CHUNKS; dz++) {
      for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
        if (dx * dx + dz * dz > VIEW_CHUNKS * VIEW_CHUNKS + 2) continue;
        const key = `${ccx + dx},${ccz + dz}`;
        if (!this.worldChunks.has(key)) want.push({ key, cx: ccx + dx, cz: ccz + dz, d: dx * dx + dz * dz });
      }
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want.slice(0, budget)) {
      const mb = buildChunkMesh(this.world, w.cx, w.cz, this.worldPalette);
      const sc = buildChunkScenery(this.world, w.cx, w.cz, this.worldVariants);
      this.worldChunks.set(w.key, { mesh: uploadMesh(this.gl, mb), scenery: uploadMesh(this.gl, sc), cx: w.cx, cz: w.cz });
    }
    const far = (VIEW_CHUNKS + 2) ** 2;
    for (const [key, c] of this.worldChunks) {
      if ((c.cx - ccx) ** 2 + (c.cz - ccz) ** 2 > far) {
        deleteMesh(this.gl, c.mesh);
        deleteMesh(this.gl, c.scenery);
        this.worldChunks.delete(key);
      }
    }
  };

  /** World matrix of the free-driving car (interpolated). */
  R.freeCarMatrix = function (p, alpha, out) {
    const x = p.prevX + (p.x - p.prevX) * alpha;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    const z = p.prevZ + (p.z - p.prevZ) * alpha;
    let dy = p.yaw - p.prevYaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    else if (dy < -Math.PI) dy += Math.PI * 2;
    const yaw = p.prevYaw + dy * alpha;
    mat4.identity(out);
    mat4.translate(out, out, x, y, z);
    mat4.rotateY(out, out, -yaw);
    mat4.rotateX(out, out, -p.pitch);
    mat4.rotateZ(out, out, p.bank);
    return { x, y, z, yaw };
  };

  R.renderWorld = function (session, alpha, dt) {
    if (this.lost) return;
    const gl = this.gl;
    const W = this.world;
    const p = session.player;
    const h = session.car.handling;
    this.time += dt;
    const fx = !this.reduceEffects;
    const savedPal = this.pal;
    const savedClouds = this.cloudPuffs;
    const savedEnv = this.env;
    this.pal = this.worldPal;
    this.cloudPuffs = this.worldClouds;
    this.env = this.worldEnv;

    // --- Player transform ----------------------------------------------
    const carM = this.model;
    const pos = this.freeCarMatrix(p, alpha, carM);
    const speedM = p.speed / 240;
    const sp = p.speed / h.maxSpeed;
    // Visual slide angle while drifting.
    const slip = clamp(Math.atan2(p.latV, Math.max(4, Math.abs(speedM))), -0.45, 0.45) * Math.sign(p.speed || 1);
    mat4.rotateY(carM, carM, -slip);
    const pan = this.player.anchors;
    if (pan.bike) {
      const target = p.airborne ? 0 : -clamp(p.steer * 0.62 * Math.min(1, Math.abs(sp) * 1.6) + slip * 0.6, -0.6, 0.6);
      this.bikeLean = (this.bikeLean || 0) + (target - (this.bikeLean || 0)) * Math.min(1, dt * 7);
      mat4.rotateZ(carM, carM, this.bikeLean);
      const wheelie = p.airborne ? 0 : this.nitroFx * 0.3;
      if (wheelie > 0.001) {
        const rz = pan.rearWheels[0][2];
        mat4.translate(carM, carM, 0, 0, rz);
        mat4.rotateX(carM, carM, wheelie);
        mat4.translate(carM, carM, 0, 0, -rz);
      }
    } else {
      mat4.rotateZ(carM, carM, clamp(p.steer * 0.05 * Math.min(1, Math.abs(sp)), -0.06, 0.06));
    }
    if (p.airborne) mat4.rotateX(carM, carM, clamp(Math.atan2(p.vy, Math.max(5, Math.abs(speedM))) * 0.6, -0.3, 0.35));
    if (p.spin) {
      const cy = pan.height * 0.45;
      mat4.translate(carM, carM, 0, cy, 0);
      mat4.rotateY(carM, carM, -p.spin);
      mat4.translate(carM, carM, 0, -cy, 0);
    }
    this.wheelSpin -= (speedM / (this.carDef.model.wheels.radius || 0.34)) * dt;
    this.streamWorld(pos.x, pos.z);

    // A frame (position + basis) for effects and shadows.
    const f = this.worldFrame || (this.worldFrame = makeFrame());
    const g = W.ground(pos.x, pos.z);
    f.pos[0] = pos.x;
    f.pos[1] = pos.y;
    f.pos[2] = pos.z;
    f.R = [carM[0], carM[1], carM[2]];
    f.U = [carM[4], carM[5], carM[6]];
    f.T = [-carM[8], -carM[9], -carM[10]];
    const air = Math.max(0, pos.y - g);

    // --- Camera: chase behind, never inside the ground --------------------
    const flatT = norm([Math.sin(pos.yaw), 0, -Math.cos(pos.yaw)]);
    if (!this.camDir) this.camDir = flatT.slice();
    const k = 1 - Math.exp(-dt * 4.5);
    this.camDir[0] += (flatT[0] - this.camDir[0]) * k;
    this.camDir[2] += (flatT[2] - this.camDir[2]) * k;
    const cd = norm(this.camDir);
    this.camDir = cd;
    this.nitroFx += ((p.nitro ? 1 : 0) - this.nitroFx) * Math.min(1, dt * 5);
    const portrait = this.portrait;
    const cs = this.carDef.camera || 1;
    const dist = (portrait ? 7.8 : 6.4) * cs + this.nitroFx * 0.8;
    const tall = Math.max(0, pan.height - 1.3);
    const height = Math.max((portrait ? 3.9 : 2.45) * (0.4 + 0.6 * cs), pan.height + (portrait ? 2.2 : 1.3));
    const eye = this.eye;
    eye[0] = pos.x - cd[0] * dist;
    eye[2] = pos.z - cd[2] * dist;
    eye[1] = pos.y - air * 0.35 + height;
    // Never inside a tree or building: slide in toward the car until clear.
    const near = W.objectsNear(eye[0], eye[2], 8, (this.camScratch ||= []));
    for (let step = 0; step < 6; step++) {
      const blocked = near.some((o) => !o.prop && o.r > 0 && Math.hypot(eye[0] - o.x, eye[2] - o.z) < Math.max(3.2, o.r * 1.6) * o.scale && eye[1] < o.y + 12 * o.scale);
      if (!blocked) break;
      eye[0] += (pos.x - eye[0]) * 0.25;
      eye[2] += (pos.z - eye[2]) * 0.25;
    }
    const eg = W.ground(eye[0], eye[2]);
    if (eye[1] < eg + 1.5) eye[1] = eg + 1.5;
    const tgt = this.target;
    const ahead = portrait ? 2 : 4;
    tgt[0] = pos.x + cd[0] * ahead;
    tgt[1] = pos.y + (portrait ? 0.35 : 1.15) + tall * 0.75;
    tgt[2] = pos.z + cd[2] * ahead;
    if (this.shake > 0.01) {
      const s = this.shake;
      eye[0] += (this.rand() - 0.5) * s;
      eye[1] += (this.rand() - 0.5) * s;
      this.shake *= Math.pow(0.015, dt);
    }
    const aspect = this.W / this.H;
    let vfov = portrait ? 2 * Math.atan(Math.tan(33 * DEG) / aspect) : 58 * DEG;
    this.superFx += ((p.super ? 1 : 0) - this.superFx) * Math.min(1, dt * 4);
    vfov = Math.min(vfov, 96 * DEG) + (this.nitroFx + this.superFx * 0.6) * (fx ? 9 : 4) * DEG;
    mat4.perspective(this.proj, vfov, aspect, 0.3, 4500);
    mat4.lookAt(this.view, eye, tgt, [0, 1, 0]);
    mat4.multiply(this.viewProj, this.proj, this.view);
    const v = this.view;
    this.camRight[0] = v[0];
    this.camRight[1] = v[4];
    this.camRight[2] = v[8];
    this.camUp[0] = v[1];
    this.camUp[1] = v[5];
    this.camUp[2] = v[9];
    this.camFwd[0] = -v[2];
    this.camFwd[1] = -v[6];
    this.camFwd[2] = -v[10];

    // --- Cars ----------------------------------------------------------------
    const fogFar = this.pal.fogFar * this.quality.fogScale;
    this.shadows.length = 0;
    this.carDrawCount = 0;
    const pd = this.carDraws[this.carDrawCount++];
    pd.meshes = this.player;
    pd.m.set(carM);
    pd.spin = this.wheelSpin;
    pd.steer = p.steer * pan.maxSteer;
    pd.brake = p.braking || p.speed < -10;
    this.queueTrailer(this.player, pd);
    const sf = this.shadowFrame || (this.shadowFrame = makeFrame());
    sf.R = f.R;
    sf.T = f.T;
    sf.U = [0, 1, 0];
    sf.pos = [pos.x, g, pos.z];
    this.addShadow(sf, pan.halfWidth * 1.25, pan.length * 0.58, (this.shadowsOn ? 0.3 : 0.55) / (1 + air * 0.6));

    // --- Shadow pass (vehicles only; the ground receives) -------------
    this.shadowsOn = false;
    const sm = this.quality.shadow && !this.reduceShadows ? this.getShadowMap(this.quality.shadow) : null;
    if (sm) {
      this.renderShadowMap(sm, f.pos, cd, false);
      this.shadowsOn = true;
    }

    // --- Main pass ---------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    const fog = this.pal.fog;
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    this.drawSky(this.pal);
    this.beginLit(eye, sm, this.pal);
    const U = this.lit.uniforms;
    gl.uniform2f(U.uFog, this.pal.fogNear * this.quality.fogScale, fogFar);
    mat4.identity(this.tmp);
    for (const c of this.worldChunks.values()) {
      if (this.visible(c.mesh, fogFar)) this.drawLit(c.mesh, this.tmp);
      if (c.scenery.count && this.visible(c.scenery, fogFar)) this.drawLit(c.scenery, this.tmp);
    }
    gl.uniform1f(U.uWater, 1);
    mat4.translate(this.tmp, this.tmp, Math.round(eye[0] / 100) * 100, 0, Math.round(eye[2] / 100) * 100);
    this.drawLit(this.worldWater, this.tmp);
    gl.uniform1f(U.uWater, 0);
    for (let i = 0; i < this.carDrawCount; i++) {
      const d = this.carDraws[i];
      this.drawCar(d.meshes, d.m, d.spin, d.steer, d.brake);
    }
    this.drawWorldProps(session, Math.min(fogFar, 160));

    // --- Particles, clouds, shadows ---------------------------------------
    this.emitPlayerFx(session, f, carM, speedM, sp, dt, false);
    // Grass and sand fly up behind the wheels when sliding off-road.
    if ((p.sliding || p.offroad) && Math.abs(speedM) > 4 && this.rand() < dt * 30) {
      const c = p.surface === 'sand' ? [0.86, 0.78, 0.55] : [0.45, 0.62, 0.3];
      for (const w of pan.rearWheels) {
        transformPoint(this.p3, carM, [w[0], 0.1, w[2]]);
        this.particles.spawn('dust', this.p3[0], this.p3[1], this.p3[2], (this.rand() - 0.5) * 2, 1.5 + this.rand() * 2, (this.rand() - 0.5) * 2, 0.18, 0.6, 0.5, c);
      }
    }
    this.stepFireworks();
    this.particles.update(dt);
    this.particles.build(this.camRight, this.camUp, this.shadows, this.quality.clouds ? this.cloudBillboards() : null, null, null);
    this.drawFx();
    this.drawOverlay(dt);
    this.pal = savedPal;
    this.cloudPuffs = savedClouds;
    this.env = savedEnv;
  };

  /** Smashable props near the player, flying off when knocked. */
  R.drawWorldProps = function (session, reach) {
    const p = session.player;
    const m = this.tmp;
    const now = session.time;
    const list = this.world.objectsNear(p.x, p.z, reach, (this.propScratch ||= []));
    for (const o of list) {
      if (!o.prop) continue;
      const mesh = this.worldPropMeshes[o.kind];
      if (!mesh) continue;
      mat4.identity(m);
      const k = session.knocked.get(o.id);
      if (k) {
        // Flung ahead of the car and to the side, tumbling, then lying still.
        const t = Math.min(now - k.t, 0.9);
        const y = Math.max(0, 6.5 * t - 8 * t * t);
        const sx = -k.fz;
        const sz = k.fx;
        mat4.translate(m, m, o.x + (k.fx * k.kick + sx * k.side) * t, o.y + y + (t >= 0.8 ? 0.15 : 0), o.z + (k.fz * k.kick + sz * k.side) * t);
        mat4.rotateY(m, m, o.yaw);
        mat4.rotateX(m, m, -Math.min(Math.PI / 2, t * 7));
        mat4.rotateZ(m, m, k.spin * t * 0.3);
      } else {
        mat4.translate(m, m, o.x, o.y, o.z);
        mat4.rotateY(m, m, o.yaw);
      }
      this.drawLit(mesh, m);
    }
  };

  /** Where effects for a free-drive event happen (the player's car). */
  R.worldEvent = function (e, session) {
    const p = session.player;
    const f = this.worldFrame || (this.worldFrame = makeFrame());
    f.pos[0] = p.x;
    f.pos[1] = p.y;
    f.pos[2] = p.z;
    const r = this.rand;
    if (e.type === 'land') {
      for (let i = 0; i < Math.round(10 + 20 * e.strength); i++) {
        const a = r() * Math.PI * 2;
        this.particles.spawn('dust', p.x + Math.cos(a) * 1.2, p.y + 0.1, p.z + Math.sin(a) * 1.6, Math.cos(a) * 4, 1 + r() * 2, Math.sin(a) * 4, 0.3 + r() * 0.2, 0.7, 0.8, [0.6, 0.66, 0.42]);
      }
      if (!this.reduceEffects) this.shake = Math.max(this.shake, 0.18 * e.strength);
    } else if (e.type === 'splash') {
      for (let i = 0; i < 40; i++) this.particles.spawn('splash', p.x + (r() - 0.5) * 2, WATER + 0.2, p.z + (r() - 0.5) * 2, (r() - 0.5) * 6, 3 + r() * 5, (r() - 0.5) * 6, 0.2, 0.9);
    } else if (e.type === 'super') {
      this.flash = Math.max(this.flash, 0.4);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        this.particles.spawn('sparkle', p.x, p.y + 0.6, p.z, Math.cos(a) * 26, 1 + r() * 2, Math.sin(a) * 26, 0.22, 0.55, 0, this.nitroCol);
      }
    } else if (e.type === 'score' && e.kind === 'prop') {
      for (let i = 0; i < 12; i++) this.particles.spawn('dust', p.x, p.y + 0.4, p.z, (r() - 0.5) * 6, 1 + r() * 3, (r() - 0.5) * 6, 0.25 + r() * 0.2, 0.6, 0.8, [0.72, 0.6, 0.45]);
      if (!this.reduceEffects) this.shake = Math.max(this.shake, 0.12);
    } else if (e.type === 'hit') {
      if (!this.reduceEffects) this.shake = Math.max(this.shake, 0.35 * e.strength);
      this.flash = 0.3 * e.strength;
      for (let i = 0; i < 14; i++) this.particles.spawn(i % 2 ? 'star' : 'spark', p.x, p.y + 0.8, p.z, (r() - 0.5) * 8, 2 + r() * 5, (r() - 0.5) * 8, 0.08 + r() * 0.1, 0.4 + r() * 0.3);
    } else if (e.type === 'score' && (e.combo >= 4 || e.kind === 'jump' || e.kind === 'trick')) {
      this.confetti(f.pos, p.y + 1.5, 24);
    } else if (e.type === 'boost') this.flash = Math.max(this.flash, 0.12);
  };
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
