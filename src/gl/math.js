// Minimal 3D math for the renderer. Matrices are column-major Float32Array(16)
// to match WebGL. Functions write into an `out` argument to avoid per-frame
// allocations.

export const mat4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },

  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  },

  lookAt(out, eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let l = Math.hypot(zx, zy, zz) || 1;
    zx /= l;
    zy /= l;
    zz /= l;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1;
    xx /= l;
    xy /= l;
    xz /= l;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  },

  multiply(out, a, b) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4];
      const b1 = b[c * 4 + 1];
      const b2 = b[c * 4 + 2];
      const b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  },

  /** Matrix from basis vectors (columns) and translation. */
  fromBasis(out, right, up, back, pos) {
    out[0] = right[0];
    out[1] = right[1];
    out[2] = right[2];
    out[3] = 0;
    out[4] = up[0];
    out[5] = up[1];
    out[6] = up[2];
    out[7] = 0;
    out[8] = back[0];
    out[9] = back[1];
    out[10] = back[2];
    out[11] = 0;
    out[12] = pos[0];
    out[13] = pos[1];
    out[14] = pos[2];
    out[15] = 1;
    return out;
  },

  /** out = m * rotationY(a) */
  rotateY(out, m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let i = 0; i < 4; i++) {
      const x = m[i];
      const z = m[8 + i];
      out[i] = x * c - z * s;
      out[8 + i] = x * s + z * c;
      if (out !== m) {
        out[4 + i] = m[4 + i];
        out[12 + i] = m[12 + i];
      }
    }
    return out;
  },

  /** out = m * rotationX(a) */
  rotateX(out, m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let i = 0; i < 4; i++) {
      const y = m[4 + i];
      const z = m[8 + i];
      out[4 + i] = y * c + z * s;
      out[8 + i] = z * c - y * s;
      if (out !== m) {
        out[i] = m[i];
        out[12 + i] = m[12 + i];
      }
    }
    return out;
  },

  /** out = m * rotationZ(a) */
  rotateZ(out, m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let i = 0; i < 4; i++) {
      const x = m[i];
      const y = m[4 + i];
      out[i] = x * c + y * s;
      out[4 + i] = y * c - x * s;
      if (out !== m) {
        out[8 + i] = m[8 + i];
        out[12 + i] = m[12 + i];
      }
    }
    return out;
  },

  /** out = m * translation(x, y, z) */
  translate(out, m, x, y, z) {
    if (out !== m) out.set(m);
    for (let i = 0; i < 4; i++) out[12 + i] = m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i];
    return out;
  },

  scale(out, m, s) {
    if (out !== m) out.set(m);
    for (let i = 0; i < 12; i++) out[i] = m[i] * s;
    return out;
  },
};

export const vec3 = {
  set(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  },
  normalize(out, a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[0] = a[0] / l;
    out[1] = a[1] / l;
    out[2] = a[2] / l;
    return out;
  },
  cross(out, a, b) {
    const x = a[1] * b[2] - a[2] * b[1];
    const y = a[2] * b[0] - a[0] * b[2];
    const z = a[0] * b[1] - a[1] * b[0];
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  },
};

/** Transform point p (array-like xyz) by matrix m into out. */
export function transformPoint(out, m, p) {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
