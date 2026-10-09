// Thin WebGL helpers: context creation, shader programs and GPU meshes.
// Shaders are GLSL ES 1.00 so they run on WebGL 1 and WebGL 2.

import { FLOATS_PER_VERTEX } from './meshBuilder.js';

export function createContext(canvas, { antialias = true } = {}) {
  const attrs = { antialias, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  return gl || null;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return s;
}

export function createProgram(gl, vsSrc, fsSrc, attribNames) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  attribNames.forEach((name, i) => gl.bindAttribLocation(p, i, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(p, info.name);
  }
  return { program: p, uniforms, attribCount: attribNames.length };
}

/** Upload a MeshBuilder to a static GPU buffer. */
export function uploadMesh(gl, builder) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, builder.array(), gl.STATIC_DRAW);
  const b = builder.vertexCount ? builder.bounds() : { center: [0, 0, 0], radius: 0 };
  return { buffer, count: builder.vertexCount, center: b.center, radius: b.radius };
}

export function deleteMesh(gl, mesh) {
  if (mesh?.buffer) gl.deleteBuffer(mesh.buffer);
}

const STRIDE = FLOATS_PER_VERTEX * 4;

/** Bind the standard lit-mesh vertex layout (attributes 0..3). */
export function bindLitMesh(gl, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 24);
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE, 40);
}

/** Bind only positions of a lit mesh (shadow pass). */
export function bindPositions(gl, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
}

const HIGHP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

export const LIT_VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec4 aColor;
attribute vec2 aMat;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uLightVP;
uniform vec3 uCamPos;
uniform vec3 uSunDirV;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vMat;
varying vec3 vRel;
varying vec3 vWorld;
varying vec4 vShadow;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vNormal = (uModel * vec4(aNormal, 0.0)).xyz;
  vColor = aColor;
  vMat = aMat;
  vWorld = w.xyz;
  // Camera-relative position interpolates exactly; distance is taken per
  // pixel so fog stays correct across large triangles (water, terrain).
  vRel = w.xyz - uCamPos;
  // Normal-offset shadow lookup avoids self-shadowing acne. The offset is
  // flipped toward the sun so it works whichever way a face is wound.
  vec3 nn = normalize(vNormal);
  nn *= sign(dot(nn, uSunDirV) + 1e-4);
  vShadow = uLightVP * vec4(w.xyz + nn * 0.13, 1.0);
  gl_Position = uViewProj * w;
}`;

export const LIT_FS = `${HIGHP}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uFogColor;
uniform vec2 uFog;
uniform vec3 uTint;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uGroundRefl;
uniform sampler2D uDetail;
uniform sampler2D uShadowMap;
uniform float uShadowOn;
uniform float uShadowTexel;
uniform float uShadowSoft;
uniform float uWater;
uniform float uTime;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vMat;
varying vec3 vRel;
varying vec3 vWorld;
varying vec4 vShadow;

vec3 skyColour(vec3 d) {
  if (d.y < 0.0) return mix(uSkyHorizon, uGroundRefl, clamp(-d.y * 3.0, 0.0, 1.0));
  return mix(uSkyHorizon, uSkyTop, pow(d.y, 0.5));
}

float pcf(vec2 uv, float z) {
  // Bilinear-weighted 2x2 comparison: smooth one-texel penumbra.
  float size = 1.0 / uShadowTexel;
  vec2 st = uv * size - 0.5;
  vec2 f = fract(st);
  vec2 base = (floor(st) + 0.5) * uShadowTexel;
  float s00 = step(z, texture2D(uShadowMap, base).r);
  float s10 = step(z, texture2D(uShadowMap, base + vec2(uShadowTexel, 0.0)).r);
  float s01 = step(z, texture2D(uShadowMap, base + vec2(0.0, uShadowTexel)).r);
  float s11 = step(z, texture2D(uShadowMap, base + vec2(uShadowTexel, uShadowTexel)).r);
  return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
}

float shadowAt(vec4 sp, float ndl) {
  vec3 p = sp.xyz / sp.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float z = p.z - (0.0003 + 0.0012 * (1.0 - ndl));
  float s;
  if (uShadowSoft > 0.5) {
    // Wider tent filter: four bilinear lookups offset by half a texel.
    float o = uShadowTexel * 0.75;
    s = 0.25 * (pcf(p.xy + vec2(-o, -o), z) + pcf(p.xy + vec2(o, -o), z) + pcf(p.xy + vec2(-o, o), z) + pcf(p.xy + vec2(o, o), z));
  } else {
    s = pcf(p.xy, z);
  }
  // Fade out toward the edge of the shadow map.
  float edge = smoothstep(0.0, 0.12, min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y)));
  return mix(1.0, s, edge);
}

void main() {
  vec3 n = normalize(gl_FrontFacing ? vNormal : -vNormal);
  if (uWater > 0.5) {
    n = normalize(vec3(
      sin(vWorld.x * 0.37 + uTime * 1.3) * 0.05 + sin(vWorld.z * 0.9 - uTime * 1.7) * 0.03,
      1.0,
      cos(vWorld.z * 0.31 + uTime * 1.1) * 0.05 + cos(vWorld.x * 0.8 + uTime * 1.9) * 0.03));
  }
  vec3 V = normalize(-vRel);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sh = uShadowOn > 0.5 && ndl > 0.0 ? shadowAt(vShadow, ndl) : 1.0;
  float diff = ndl * sh;
  vec3 amb = mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5);
  float d1 = texture2D(uDetail, vWorld.xz * 0.29).r;
  float d2 = texture2D(uDetail, vWorld.xz * 0.023).g;
  float detail = mix(1.0, (0.74 + 0.52 * d1) * (0.84 + 0.32 * d2), vMat.y);
  vec3 base = vColor.rgb * uTint * detail;
  vec3 col = base * (amb + uSunColor * diff);
  if (vMat.x > 0.0) {
    float ndv = max(dot(n, V), 0.0);
    float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
    vec3 env = skyColour(reflect(-V, n));
    col = mix(col, env * (0.55 + 0.45 * sh), fres * vMat.x);
    vec3 H = normalize(uSunDir + V);
    col += uSunColor * pow(max(dot(n, H), 0.0), 90.0) * vMat.x * 1.6 * sh;
  }
  col = mix(col, vColor.rgb * 1.25, vColor.a);
  float dist = length(vRel);
  float f = clamp((dist - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 fogC = uFogColor + uSunColor * 0.22 * pow(max(dot(vRel / max(dist, 0.001), uSunDir), 0.0), 6.0);
  col = mix(col, fogC, f);
  // Gentle filmic shoulder keeps highlights from clipping.
  col = col * (1.0 + col * 0.08) / (1.0 + col * 0.35);
  gl_FragColor = vec4(col * 1.12, 1.0);
}`;

export const DEPTH_VS = `
attribute vec3 aPos;
uniform mat4 uModel;
uniform mat4 uLightVP;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;

export const DEPTH_FS = `
precision mediump float;
void main() { gl_FragColor = vec4(1.0); }`;

// Full-screen sky: gradient, sun disc and glow from the view ray.
export const SKY_VS = `
attribute vec3 aPos;
varying vec2 vNdc;
void main() {
  vNdc = aPos.xy;
  gl_Position = vec4(aPos.xy, 1.0, 1.0);
}`;

export const SKY_FS = `${HIGHP}
uniform mat4 uInvViewProj;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
varying vec2 vNdc;
void main() {
  vec4 a = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec4 b = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  float h = d.y;
  vec3 col = h < 0.0 ? uFogColor : mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(uFogColor, col, smoothstep(-0.02, 0.12, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 900.0) * 3.0 + pow(s, 48.0) * 0.35 + pow(s, 6.0) * 0.12);
  if (uStars > 0.0) {
    // Night: a sparse field of twinkle-free stars fixed to the sky.
    vec3 cell = floor(d * 260.0);
    float r = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float star = step(0.9965, r) * smoothstep(0.04, 0.3, h);
    col += vec3(star * uStars * (0.6 + 0.4 * fract(r * 97.0)));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/** Tileable procedural detail texture: R = fine grain, G = large patches. */
export function createDetailTexture(gl, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const lattice = (period, seed) => {
    const v = new Float32Array(period * period);
    let x = seed;
    for (let i = 0; i < v.length; i++) {
      x = (x * 1664525 + 1013904223) >>> 0;
      v[i] = x / 4294967296;
    }
    return (u, w) => {
      const fx = (u * period) / size;
      const fy = (w * period) / size;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => v[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
      const a = at(x0, y0);
      const b = at(x0 + 1, y0);
      const cc = at(x0, y0 + 1);
      const d = at(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
    };
  };
  const fine = [lattice(16, 1), lattice(32, 2), lattice(64, 3), lattice(128, 4)];
  const macro = [lattice(4, 7), lattice(8, 8)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = fine[0](x, y) * 0.4 + fine[1](x, y) * 0.3 + fine[2](x, y) * 0.2 + fine[3](x, y) * 0.1;
      const m = macro[0](x, y) * 0.65 + macro[1](x, y) * 0.35;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(f * 255);
      img.data[i + 1] = Math.round(m * 255);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

/**
 * Directional-light shadow map. Uses a depth texture (WebGL 2, or WebGL 1
 * with WEBGL_depth_texture). Returns null when unsupported.
 */
export function createShadowMap(gl, size) {
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (!isGL2 && !gl.getExtension('WEBGL_depth_texture')) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (isGL2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  // WebGL 1 framebuffers need a colour attachment on some drivers.
  let colour = null;
  if (!isGL2) {
    colour = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, colour);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size, size);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colour);
  } else {
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
  }
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) return null;
  return { tex, fb, size };
}

// Billboarded particles / blob shadows: position, rgba colour, uv.
export const FX_VS = `
attribute vec3 aPos;
attribute vec4 aColor;
attribute vec2 aUv;
uniform mat4 uViewProj;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vColor = aColor;
  vUv = aUv;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const FX_FS = `
precision mediump float;
uniform sampler2D uTex;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float a = texture2D(uTex, vUv).a;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

/** Soft round sprite texture generated in code. */
export function createSoftTexture(gl, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
