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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.data), gl.STATIC_DRAW);
  const b = builder.vertexCount ? builder.bounds() : { center: [0, 0, 0], radius: 0 };
  return { buffer, count: builder.vertexCount, center: b.center, radius: b.radius };
}

export function deleteMesh(gl, mesh) {
  if (mesh?.buffer) gl.deleteBuffer(mesh.buffer);
}

const STRIDE = FLOATS_PER_VERTEX * 4;

/** Bind the standard lit-mesh vertex layout. */
export function bindLitMesh(gl, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 24);
}

export const LIT_VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec4 aColor;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
varying vec3 vNormal;
varying vec4 vColor;
varying vec3 vRel;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vNormal = (uModel * vec4(aNormal, 0.0)).xyz;
  vColor = aColor;
  // Camera-relative position interpolates exactly; distance is taken per
  // pixel so fog stays correct across large triangles (water, terrain).
  vRel = w.xyz - uCamPos;
  gl_Position = uViewProj * w;
}`;

export const LIT_FS = `
precision mediump float;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uFogColor;
uniform vec2 uFog;
uniform vec3 uTint;
varying vec3 vNormal;
varying vec4 vColor;
varying vec3 vRel;
void main() {
  float vDist = length(vRel);
  vec3 n = normalize(gl_FrontFacing ? vNormal : -vNormal);
  float diff = max(dot(n, uSunDir), 0.0);
  vec3 amb = mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5);
  vec3 base = vColor.rgb * uTint;
  vec3 lit = base * (amb + uSunColor * diff);
  lit = mix(lit, base * 1.15, vColor.a);
  float f = clamp((vDist - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, uFogColor, f * f * (3.0 - 2.0 * f)), 1.0);
}`;

// Sky dome: colour comes from the vertex, no lighting or fog.
export const SKY_VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec4 aColor;
uniform mat4 uModel;
uniform mat4 uViewProj;
varying vec3 vColor;
void main() {
  vColor = aColor.rgb;
  vec4 p = uViewProj * uModel * vec4(aPos, 1.0);
  gl_Position = p.xyww;
}`;

export const SKY_FS = `
precision mediump float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }`;

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
