// WebGL 3D renderer: chase camera behind the car, low-poly world built from
// the track, flat-shaded vertex-coloured meshes with sun + sky lighting and
// distance fog. Static geometry is merged into chunks and distance/frustum
// culled; per-frame work is uniform updates, a handful of car draws and one
// dynamic particle buffer.

import { createContext, createProgram, uploadMesh, bindLitMesh, createSoftTexture, LIT_VS, LIT_FS, SKY_VS, SKY_FS, FX_VS, FX_FS } from '../gl/gl.js';
import { mat4, hexToRgb, transformPoint } from '../gl/math.js';
import { clamp, lerp, mulberry32, wrap } from '../core/util.js';
import { makeFrame } from '../world/track3d.js';
import { buildTerrain } from './terrain.js';
import { buildTrackChunks } from './trackMesh.js';
import { buildSky, buildMountains, buildClouds } from './environment.js';
import { buildCarBody, buildWheel } from './carModel.js';
import { windmillSails } from './models.js';
import { Particles, FX_FLOATS } from './particles.js';

const QUALITY = {
  high: { dprCap: 2, fogScale: 1, particles: 1, clouds: true },
  medium: { dprCap: 1.5, fogScale: 0.85, particles: 0.6, clouds: true },
  low: { dprCap: 1, fogScale: 0.65, particles: 0.3, clouds: false },
};
const DEG = Math.PI / 180;

export class Renderer3D {
  constructor(canvas, overlay, track, carDef, traffic) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.track = track;
    this.carDef = carDef;
    this.trafficDefs = traffic; // [{model, paint}]
    this.quality = QUALITY.high;
    this.reduceEffects = false;
    const gl = createContext(canvas, { antialias: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.rand = mulberry32(5);
    this.time = 0;

    this.lit = createProgram(gl, LIT_VS, LIT_FS, ['aPos', 'aNormal', 'aColor']);
    this.sky = createProgram(gl, SKY_VS, SKY_FS, ['aPos', 'aNormal', 'aColor']);
    this.fx = createProgram(gl, FX_VS, FX_FS, ['aPos', 'aColor', 'aUv']);
    this.softTex = createSoftTexture(gl);
    for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);

    const pal = track.palette;
    this.pal = {
      fog: hexToRgb(pal.fog),
      sun: hexToRgb(pal.sunColor).map((c) => c * 0.78),
      skyAmb: hexToRgb(pal.skyAmbient).map((c) => c * 0.52),
      groundAmb: hexToRgb(pal.groundAmbient).map((c) => c * 0.5),
      sunDir: normalize(pal.sunDir),
      fogNear: pal.fogNear,
      fogFar: pal.fogFar,
    };

    // --- World geometry ---------------------------------------------------
    const t0 = performance.now();
    this.terrain = buildTerrain(track);
    this.terrainTiles = this.terrain.tiles.map((b) => uploadMesh(gl, b));
    this.water = uploadMesh(gl, this.terrain.water);
    const { chunks, animated } = buildTrackChunks(track, this.terrain);
    this.chunks = chunks.map((c) => uploadMesh(gl, c.builder));
    this.animated = animated;
    this.sails = uploadMesh(gl, windmillSails());
    const b = this.terrain.bounds;
    const center = [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2];
    this.skyMesh = uploadMesh(gl, buildSky(pal));
    this.mountains = uploadMesh(gl, buildMountains(pal, center, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.5 + 520));
    this.clouds = uploadMesh(gl, buildClouds(center));
    this.buildMs = performance.now() - t0;

    // --- Cars ---------------------------------------------------------------
    this.player = null;
    this.setPaint(carDef.paint);
    this.trafficMeshes = traffic.map(({ model, paint }) => {
      const body = buildCarBody(model, paint);
      return { body: uploadMesh(gl, body.body), brake: null, wheel: uploadMesh(gl, buildWheel(model, paint)), anchors: body.anchors };
    });

    // --- FX -----------------------------------------------------------------
    this.particles = new Particles();
    this.fxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particles.alphaData.byteLength, gl.DYNAMIC_DRAW);
    this.shadows = [];

    // --- Scratch ------------------------------------------------------------
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.model = mat4.create();
    this.tmp = mat4.create();
    this.wheelM = mat4.create();
    this.frame = makeFrame();
    this.frame2 = makeFrame();
    this.eye = [0, 5, 10];
    this.target = [0, 0, 0];
    this.camDir = null;
    this.camRight = [1, 0, 0];
    this.camUp = [0, 1, 0];
    this.camFwd = [0, 0, -1];
    this.wheelSpin = 0;
    this.shake = 0;
    this.flash = 0;
    this.nitroFx = 0;
    this.overlayDirty = false;
    this.p3 = [0, 0, 0];

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());

    this.resize();
  }

  setQuality(name) {
    this.quality = QUALITY[name] || QUALITY.high;
    this.particles.quality = this.quality.particles;
    this.resize();
  }

  setPaint(paint) {
    const gl = this.gl;
    const spec = this.carDef.model;
    const body = buildCarBody(spec, paint);
    this.player = {
      body: uploadMesh(gl, body.body),
      brake: uploadMesh(gl, body.brake),
      wheel: uploadMesh(gl, buildWheel(spec, paint)),
      anchors: body.anchors,
    };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = dpr;
    this.W = Math.round(w * dpr);
    this.H = Math.round(h * dpr);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.overlay.width = Math.round(w * Math.min(dpr, 1.5));
    this.overlay.height = Math.round(h * Math.min(dpr, 1.5));
    this.portrait = h > w;
  }

  onEvent(e, session) {
    if (e.type === 'hit' || e.type === 'bump') {
      const s = clamp(e.strength, 0.15, 1);
      if (!this.reduceEffects) this.shake = Math.max(this.shake, 0.35 * s);
      this.flash = 0.3 * s;
      // Burst of sparks/stars at the front of the car.
      const f = this.frame;
      this.track.frame(session.player.z, session.player.x, f);
      for (let i = 0; i < 18; i++) {
        const r = this.rand;
        this.particles.spawn(
          i % 2 ? 'star' : 'spark',
          f.pos[0] + f.T[0] * 2,
          f.pos[1] + 0.8,
          f.pos[2] + f.T[2] * 2,
          (r() - 0.5) * 8,
          2 + r() * 5,
          (r() - 0.5) * 8,
          0.08 + r() * 0.1,
          0.4 + r() * 0.3,
        );
      }
    }
  }

  /** Interpolated (z, x) for a sim body with prevZ/prevX. */
  lerpZ(prev, cur, alpha) {
    const L = this.track.length;
    let d = cur - prev;
    if (d > L / 2) d -= L;
    else if (d < -L / 2) d += L;
    return wrap(prev + d * alpha, L);
  }

  render(session, alpha, dt) {
    if (this.lost) return;
    const gl = this.gl;
    const T = this.track;
    const p = session.player;
    const h = session.car.handling;
    const mpu = T.metresPerUnit;
    this.time += dt;
    const fx = !this.reduceEffects;

    // --- Player transform ----------------------------------------------
    const pz = this.lerpZ(p.prevZ, p.z, alpha);
    const px = lerp(p.prevX, p.x, alpha);
    const f = T.frame(pz, px, this.frame);
    this.groundCar(f, px);
    const speedM = p.speed * mpu;
    const sp = p.speed / h.maxSpeed;
    const seg = T.findSegment(pz);
    const latM = (p.latVel - seg.curve * sp * Math.abs(sp) * h.centrifugal * (1 - (seg.bankAssist || 0))) * T.roadHalfWidthM;
    const slip = clamp(Math.atan2(latM, Math.max(4, Math.abs(speedM))), -0.45, 0.45) * Math.sign(p.speed || 1) + p.steer * 0.05;
    const lean = clamp(p.steer * 0.05 * Math.min(1, Math.abs(sp)), -0.06, 0.06);
    const pitch = p.braking ? -0.025 : p.nitro ? 0.02 : 0;
    const carM = this.model;
    mat4.fromBasis(carM, f.R, f.U, [-f.T[0], -f.T[1], -f.T[2]], f.pos);
    if (p.offroad && Math.abs(sp) > 0.05) mat4.translate(carM, carM, 0, (this.rand() - 0.5) * 0.06, 0);
    mat4.rotateY(carM, carM, -slip);
    mat4.rotateZ(carM, carM, lean);
    mat4.rotateX(carM, carM, pitch);
    this.wheelSpin -= (speedM / (this.carDef.model.wheels.radius || 0.34)) * dt;

    // --- Camera --------------------------------------------------------
    const flatT = normalize([f.T[0], 0, f.T[2]]);
    if (!this.camDir) this.camDir = flatT.slice();
    const k = 1 - Math.exp(-dt * 4.5);
    this.camDir[0] += (flatT[0] - this.camDir[0]) * k;
    this.camDir[2] += (flatT[2] - this.camDir[2]) * k;
    const cd = normalize(this.camDir);
    this.camDir = cd;
    this.nitroFx += ((p.nitro ? 1 : 0) - this.nitroFx) * Math.min(1, dt * 5);
    const portrait = this.portrait;
    const dist = (portrait ? 7.8 : 6.4) + this.nitroFx * 0.8;
    const height = portrait ? 3.9 : 2.45;
    const eye = this.eye;
    eye[0] = f.pos[0] - cd[0] * dist;
    eye[1] = f.pos[1] + height + Math.max(0, -f.T[1]) * dist * 0.5;
    eye[2] = f.pos[2] - cd[2] * dist;
    const ground = this.terrain.sampler.height(eye[0], eye[2]);
    if (!seg.tunnel && eye[1] < ground + 1.2) eye[1] = ground + 1.2;
    const tgt = this.target;
    // Portrait looks further down so the horizon sits high and the car
    // clears the touch controls.
    const ahead = portrait ? 2 : 4;
    tgt[0] = f.pos[0] + cd[0] * ahead;
    tgt[1] = f.pos[1] + (portrait ? 0.35 : 1.15) + f.T[1] * ahead;
    tgt[2] = f.pos[2] + cd[2] * ahead;
    if (this.shake > 0.01) {
      const s = this.shake;
      eye[0] += (this.rand() - 0.5) * s;
      eye[1] += (this.rand() - 0.5) * s;
      this.shake *= Math.pow(0.015, dt);
    }
    if (fx && Math.abs(sp) > 0.7) eye[1] += (this.rand() - 0.5) * 0.02 * Math.abs(sp);

    // Development hook: a fixed camera for inspection screenshots.
    if (this.debugCamera) {
      eye.splice(0, 3, ...this.debugCamera.eye);
      tgt.splice(0, 3, ...this.debugCamera.target);
    }
    const aspect = this.W / this.H;
    let vfov = portrait ? 2 * Math.atan(Math.tan(33 * DEG) / aspect) : 58 * DEG;
    vfov = Math.min(vfov, 96 * DEG) + this.nitroFx * (fx ? 9 : 4) * DEG;
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

    // --- Draw ------------------------------------------------------------
    gl.viewport(0, 0, this.W, this.H);
    const fog = this.pal.fog;
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);

    // Sky.
    gl.useProgram(this.sky.program);
    gl.depthMask(false);
    mat4.identity(this.tmp);
    mat4.translate(this.tmp, this.tmp, eye[0], eye[1], eye[2]);
    gl.uniformMatrix4fv(this.sky.uniforms.uModel, false, this.tmp);
    gl.uniformMatrix4fv(this.sky.uniforms.uViewProj, false, this.viewProj);
    bindLitMesh(gl, this.skyMesh);
    gl.drawArrays(gl.TRIANGLES, 0, this.skyMesh.count);
    gl.depthMask(true);

    // Lit world.
    const U = this.lit.uniforms;
    gl.useProgram(this.lit.program);
    gl.uniformMatrix4fv(U.uViewProj, false, this.viewProj);
    gl.uniform3fv(U.uCamPos, eye);
    gl.uniform3fv(U.uSunDir, this.pal.sunDir);
    gl.uniform3fv(U.uSunColor, this.pal.sun);
    gl.uniform3fv(U.uSkyAmb, this.pal.skyAmb);
    gl.uniform3fv(U.uGroundAmb, this.pal.groundAmb);
    gl.uniform3fv(U.uFogColor, fog);
    gl.uniform3f(U.uTint, 1, 1, 1);
    const fogFar = this.pal.fogFar * this.quality.fogScale;
    const inTunnel = seg.tunnel;

    // Distant mountains and clouds use a long fog so they read as haze.
    gl.uniform2f(U.uFog, 700, 3800);
    mat4.identity(this.tmp);
    this.drawLit(this.mountains, this.tmp);
    if (this.quality.clouds) {
      mat4.translate(this.tmp, this.tmp, (this.time * 2) % 400, 0, 0);
      this.drawLit(this.clouds, this.tmp);
    }

    gl.uniform2f(U.uFog, this.pal.fogNear * this.quality.fogScale, fogFar);
    mat4.identity(this.tmp);
    for (const m of this.terrainTiles) if (this.visible(m, fogFar)) this.drawLit(m, this.tmp);
    gl.uniform3f(U.uTint, 1, 1, 1 + Math.sin(this.time * 1.5) * 0.03);
    this.drawLit(this.water, this.tmp);
    gl.uniform3f(U.uTint, 1, 1, 1);
    for (const m of this.chunks) if (this.visible(m, fogFar)) this.drawLit(m, this.tmp);

    for (const a of this.animated) {
      mat4.rotateZ(this.tmp, a.matrix, this.time * a.speed);
      this.drawLit(this.sails, this.tmp);
    }

    // Traffic.
    this.shadows.length = 0;
    for (const c of session.traffic) {
      const cz = this.lerpZ(c.prevZ, c.z, alpha);
      const tf = T.frame(cz, c.x, this.frame2);
      if (!this.near(tf.pos, fogFar)) continue;
      const meshes = this.trafficMeshes[c.paint % this.trafficMeshes.length];
      mat4.fromBasis(this.tmp, tf.R, tf.U, [-tf.T[0], -tf.T[1], -tf.T[2]], tf.pos);
      this.drawCar(meshes, this.tmp, (this.time * c.speed * mpu) / -0.32, 0, false);
      this.addShadow(tf, 1.3, 2.8);
    }

    // Player.
    this.drawCar(this.player, carM, this.wheelSpin, p.steer * 0.42, p.braking || p.speed < -10);
    this.addShadow(f, 1.35, 2.9);

    // --- Particles & shadows ---------------------------------------------
    this.emitPlayerFx(session, f, carM, speedM, sp, dt, inTunnel);
    this.particles.update(dt);
    this.particles.build(this.camRight, this.camUp, this.shadows);
    this.drawFx();

    this.drawOverlay(dt);
  }

  /** Lift the car onto the terrain when it leaves the road. */
  groundCar(f, x) {
    const ax = Math.abs(x);
    if (ax <= 1.12) return;
    const t = clamp((ax - 1.12) / 0.3, 0, 1);
    const g = this.terrain.sampler.height(f.pos[0], f.pos[2]);
    f.pos[1] += (Math.min(g, f.pos[1]) - f.pos[1]) * t;
  }

  visible(mesh, fogFar) {
    const c = mesh.center;
    const dx = c[0] - this.eye[0];
    const dy = c[1] - this.eye[1];
    const dz = c[2] - this.eye[2];
    const d = Math.hypot(dx, dy, dz);
    if (d - mesh.radius > fogFar) return false;
    // Behind the camera?
    return dx * this.camFwd[0] + dy * this.camFwd[1] + dz * this.camFwd[2] > -mesh.radius;
  }

  near(pos, fogFar) {
    const dx = pos[0] - this.eye[0];
    const dz = pos[2] - this.eye[2];
    return dx * dx + dz * dz < fogFar * fogFar;
  }

  drawLit(mesh, model) {
    if (!mesh.count) return;
    const gl = this.gl;
    gl.uniformMatrix4fv(this.lit.uniforms.uModel, false, model);
    bindLitMesh(gl, mesh);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  drawCar(meshes, carM, spin, steerAngle, braking) {
    this.drawLit(meshes.body, carM);
    if (braking && meshes.brake) this.drawLit(meshes.brake, carM);
    const w = this.wheelM;
    meshes.anchors.wheels.forEach((a, i) => {
      mat4.translate(w, carM, a[0], a[1], a[2]);
      if (i < 2 && steerAngle) mat4.rotateY(w, w, -steerAngle);
      mat4.rotateX(w, w, spin);
      this.drawLit(meshes.wheel, w);
    });
  }

  addShadow(f, halfW, halfL) {
    const R = f.R;
    const Tt = f.T;
    this.shadows.push({
      x: f.pos[0] + f.U[0] * 0.05,
      y: f.pos[1] + f.U[1] * 0.05,
      z: f.pos[2] + f.U[2] * 0.05,
      rx: [R[0] * halfW, R[1] * halfW, R[2] * halfW],
      rz: [Tt[0] * halfL, Tt[1] * halfL, Tt[2] * halfL],
      alpha: 0.55,
    });
  }

  emitPlayerFx(session, f, carM, speedM, sp, dt, inTunnel) {
    const p = session.player;
    const q = this.particles.quality * (this.reduceEffects ? 0.5 : 1);
    const r = this.rand;
    const chance = (rate) => r() < rate * dt * q;
    const P = this.p3;
    const anchors = this.player.anchors;
    const vx = f.T[0] * speedM;
    const vy = f.T[1] * speedM;
    const vz = f.T[2] * speedM;
    if (p.nitro) {
      for (const e of anchors.exhausts) {
        transformPoint(P, carM, e);
        // Steady blue-white core glued to the exhaust, every frame.
        this.particles.spawn('flameCore', P[0], P[1], P[2], vx, vy, vz, 0.26, Math.max(0.07, dt * 1.5), 0);
        for (let n = 0; n < 2; n++) {
          if (chance(90)) this.particles.spawn('flame', P[0], P[1], P[2], vx * 0.78 + (r() - 0.5), vy * 0.78 + r() * 0.5, vz * 0.78 + (r() - 0.5), 0.2 + r() * 0.12, 0.2 + r() * 0.1, 1.6);
        }
      }
    }
    const rear = anchors.wheels.slice(2);
    if (p.sliding) {
      for (const w of rear) {
        transformPoint(P, carM, [w[0], 0.1, w[2]]);
        if (chance(30)) this.particles.spawn('smoke', P[0], P[1], P[2], vx * 0.25 + (r() - 0.5), 0.6 + r(), vz * 0.25 + (r() - 0.5), 0.35, 1.0, 1.6);
      }
    }
    if (p.offroad && Math.abs(sp) > 0.08) {
      for (const w of rear) {
        transformPoint(P, carM, [w[0], 0.1, w[2]]);
        if (chance(40)) this.particles.spawn('dust', P[0], P[1], P[2], vx * 0.3 + (r() - 0.5) * 2, 1.5 + r() * 2.5, vz * 0.3 + (r() - 0.5) * 2, 0.16 + r() * 0.12, 0.6, 0.4);
      }
    }
    if (p.scraping) {
      transformPoint(P, carM, [p.x > 0 ? 1 : -1, 0.45, -0.6]);
      if (chance(90)) this.particles.spawn('spark', P[0], P[1], P[2], vx * 0.5 + (r() - 0.5) * 3, 1 + r() * 2, vz * 0.5 + (r() - 0.5) * 3, 0.05, 0.3);
    }
    // Tunnel lights / bridge splashes etc. come with interactions (Phase 2C).
    void inTunnel;
  }

  drawFx() {
    const gl = this.gl;
    const P = this.particles;
    if (!P.alphaCount && !P.addCount) return;
    gl.useProgram(this.fx.program);
    gl.uniformMatrix4fv(this.fx.uniforms.uViewProj, false, this.viewProj);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.softTex);
    gl.uniform1i(this.fx.uniforms.uTex, 0);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuffer);
    const stride = FX_FLOATS * 4;
    const bindFx = () => {
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 28);
    };
    if (P.alphaCount) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.alphaData.subarray(0, P.alphaCount * FX_FLOATS));
      bindFx();
      gl.drawArrays(gl.TRIANGLES, 0, P.alphaCount);
    }
    if (P.addCount) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.addData.subarray(0, P.addCount * FX_FLOATS));
      bindFx();
      gl.drawArrays(gl.TRIANGLES, 0, P.addCount);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawOverlay(dt) {
    const ctx = this.octx;
    const W = this.overlay.width;
    const H = this.overlay.height;
    const lines = !this.reduceEffects && this.nitroFx > 0.05;
    if (!lines && this.flash <= 0) {
      if (this.overlayDirty) {
        ctx.clearRect(0, 0, W, H);
        this.overlayDirty = false;
      }
      return;
    }
    ctx.clearRect(0, 0, W, H);
    this.overlayDirty = true;
    if (lines) {
      const cx = W / 2;
      const cy = H * 0.45;
      const maxR = Math.hypot(W, H);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 * this.nitroFx})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 28; i++) {
        const a = this.rand() * Math.PI * 2;
        const r0 = maxR * (0.28 + this.rand() * 0.22);
        const r1 = r0 + maxR * (0.08 + this.rand() * 0.18);
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 2);
    }
  }
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
