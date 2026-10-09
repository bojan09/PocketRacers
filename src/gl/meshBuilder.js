// CPU-side geometry builder for vertex-coloured meshes.
// Vertex layout (12 floats): position xyz, normal xyz, colour rgb, emissive,
// specular (0 = matte .. 1 = glossy clear-coat), detail (0..1 strength of the
// procedural surface-detail texture). Triangles own their vertices, so a
// mesh can mix flat faces (crisp edges) and smooth faces (shared normals).

export const FLOATS_PER_VERTEX = 12;

export class MeshBuilder {
  constructor() {
    // Growable Float32Array: half the memory of a JS number array and
    // uploads to the GPU without copying.
    this.data = new Float32Array(FLOATS_PER_VERTEX * 256);
    this.length = 0;
    this.vertexCount = 0;
    this.spec = 0;
    this.detail = 0;
  }

  reserve(extra) {
    if (this.length + extra <= this.data.length) return;
    let size = this.data.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Float32Array(size);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }

  /** Vertex data trimmed to the used length. */
  array() {
    return this.data.subarray(0, this.length);
  }

  /** Set the material used by subsequent primitives. Returns this. */
  material(spec = 0, detail = 0) {
    this.spec = spec;
    this.detail = detail;
    return this;
  }

  push(p, n, c, emissive) {
    this.reserve(FLOATS_PER_VERTEX);
    const d = this.data;
    let i = this.length;
    d[i++] = p[0];
    d[i++] = p[1];
    d[i++] = p[2];
    d[i++] = n[0];
    d[i++] = n[1];
    d[i++] = n[2];
    d[i++] = c[0];
    d[i++] = c[1];
    d[i++] = c[2];
    d[i++] = emissive;
    d[i++] = this.spec;
    d[i++] = this.detail;
    this.length = i;
  }

  /** Triangle with a flat normal. a, b, c are [x, y, z]; color is [r, g, b]. */
  tri(a, b, c, color, emissive = 0) {
    const n = faceNormal(a, b, c);
    if (!n) return;
    this.push(a, n, color, emissive);
    this.push(b, n, color, emissive);
    this.push(c, n, color, emissive);
    this.vertexCount += 3;
  }

  /** Triangle with explicit (smooth) normals and optional per-vertex colours. */
  triS(a, b, c, na, nb, nc, ca, cb = ca, cc = ca, emissive = 0) {
    if (!faceNormal(a, b, c)) return;
    this.push(a, na, ca, emissive);
    this.push(b, nb, cb, emissive);
    this.push(c, nc, cc, emissive);
    this.vertexCount += 3;
  }

  /** Flat triangle with per-vertex colours (smooth gradients, e.g. the sky). */
  triC(a, b, c, ca, cb, cc, emissive = 0) {
    const n = faceNormal(a, b, c);
    if (!n) return;
    this.triS(a, b, c, n, n, n, ca, cb, cc, emissive);
  }

  quad(a, b, c, d, color, emissive = 0) {
    this.tri(a, b, c, color, emissive);
    this.tri(a, c, d, color, emissive);
  }

  /** Convex polygon fan. */
  poly(points, color, emissive = 0) {
    for (let i = 1; i < points.length - 1; i++) this.tri(points[0], points[i], points[i + 1], color, emissive);
  }

  /**
   * Smooth surface through a grid of points P[i][j]. Normals are averaged
   * from neighbouring faces; colourFn(i, j) colours the face (i..i+1, j..j+1).
   * wrapJ closes the surface around j (tubes, lofts).
   */
  grid(P, colourFn, { wrapJ = false, emissiveFn = null, flatJ = null, materialFn = null } = {}) {
    const I = P.length;
    const J = P[0].length;
    const N = P.map((row) => row.map(() => [0, 0, 0]));
    const jEnd = wrapJ ? J : J - 1;
    for (let i = 0; i < I - 1; i++) {
      for (let j = 0; j < jEnd; j++) {
        const j2 = (j + 1) % J;
        const n = faceNormal(P[i][j], P[i + 1][j], P[i + 1][j2]) || faceNormal(P[i][j], P[i + 1][j2], P[i][j2]);
        if (!n) continue;
        for (const [a, b] of [
          [i, j],
          [i + 1, j],
          [i + 1, j2],
          [i, j2],
        ]) {
          N[a][b][0] += n[0];
          N[a][b][1] += n[1];
          N[a][b][2] += n[2];
        }
      }
    }
    for (const row of N) for (const n of row) normalizeInPlace(n);
    for (let i = 0; i < I - 1; i++) {
      for (let j = 0; j < jEnd; j++) {
        const j2 = (j + 1) % J;
        const col = colourFn(i, j);
        const em = emissiveFn ? emissiveFn(i, j) : 0;
        if (materialFn) {
          const mat = materialFn(i, j);
          this.spec = mat[0];
          this.detail = mat[1];
        }
        if (flatJ && flatJ(j)) {
          this.quad(P[i][j], P[i + 1][j], P[i + 1][j2], P[i][j2], col, em);
          continue;
        }
        this.triS(P[i][j], P[i + 1][j], P[i + 1][j2], N[i][j], N[i + 1][j], N[i + 1][j2], col, col, col, em);
        this.triS(P[i][j], P[i + 1][j2], P[i][j2], N[i][j], N[i + 1][j2], N[i][j2], col, col, col, em);
      }
    }
  }

  /** Axis-aligned box centred at (x, y, z) with half sizes, optional taper of the top face. */
  box(x, y, z, hx, hy, hz, color, emissive = 0, topScale = 1) {
    const tx = hx * topScale;
    const tz = hz * topScale;
    const b = [
      [x - hx, y - hy, z - hz],
      [x + hx, y - hy, z - hz],
      [x + hx, y - hy, z + hz],
      [x - hx, y - hy, z + hz],
    ];
    const t = [
      [x - tx, y + hy, z - tz],
      [x + tx, y + hy, z - tz],
      [x + tx, y + hy, z + tz],
      [x - tx, y + hy, z + tz],
    ];
    this.quad(t[0], t[3], t[2], t[1], color, emissive);
    this.quad(b[0], b[1], b[2], b[3], color, emissive);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(b[i], b[j], t[j], t[i], color, emissive);
    }
  }

  /** Cylinder / cone along an axis ('x' | 'y' | 'z'); smooth sides by default. */
  cylinder(cx, cy, cz, radius, halfLength, sides, axis, color, capColor = color, topRadius = radius, smooth = true) {
    const pt = (r, a, h) => {
      const u = Math.cos(a) * r;
      const v = Math.sin(a) * r;
      if (axis === 'x') return [cx + h, cy + u, cz + v];
      if (axis === 'y') return [cx + u, cy + h, cz + v];
      return [cx + u, cy + v, cz + h];
    };
    const slope = (radius - topRadius) / (2 * halfLength || 1);
    const nrm = (a) => {
      const u = Math.cos(a);
      const v = Math.sin(a);
      const l = Math.hypot(1, slope);
      if (axis === 'x') return [slope / l, u / l, v / l];
      if (axis === 'y') return [u / l, slope / l, v / l];
      return [u / l, v / l, slope / l];
    };
    const capA = [];
    const capB = [];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p00 = pt(radius, a0, -halfLength);
      const p01 = pt(radius, a1, -halfLength);
      const p11 = pt(topRadius, a1, halfLength);
      const p10 = pt(topRadius, a0, halfLength);
      if (smooth) {
        const n0 = nrm(a0);
        const n1 = nrm(a1);
        if (topRadius > 0) {
          this.triS(p00, p01, p11, n0, n1, n1, color);
          this.triS(p00, p11, p10, n0, n1, n0, color);
        } else {
          this.triS(p00, p01, p10, n0, n1, nrm((a0 + a1) / 2), color);
        }
      } else {
        this.quad(p00, p01, p11, p10, color);
      }
      capA.push(p00);
      capB.push(p10);
    }
    if (radius > 0) this.poly(capA, capColor);
    if (topRadius > 0) this.poly(capB, capColor);
  }

  /** Smooth ellipsoid (UV sphere), optionally jittered for organic shapes. */
  sphere(cx, cy, cz, rx, ry, rz, color, { segs = 10, rings = 7, rand = null, jitter = 0, emissive = 0, shadeFn = null } = {}) {
    const P = [];
    for (let i = 0; i <= rings; i++) {
      const phi = (i / rings) * Math.PI;
      const row = [];
      for (let j = 0; j < segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        const k = rand && i > 0 && i < rings ? 1 + (rand() - 0.5) * jitter : 1;
        row.push([cx + Math.sin(phi) * Math.cos(th) * rx * k, cy + Math.cos(phi) * ry * k, cz + Math.sin(phi) * Math.sin(th) * rz * k]);
      }
      P.push(row);
    }
    this.grid(P, (i) => (shadeFn ? shadeFn(i / rings) : color), { wrapJ: true, emissiveFn: emissive ? () => emissive : null });
  }

  /** Low-poly faceted blob (icosahedron), for rocks. */
  blob(cx, cy, cz, rx, ry, rz, color, rand = null, jitter = 0, emissive = 0) {
    const v = ICO_V.map((p) => {
      const j = rand ? 1 + (rand() - 0.5) * jitter : 1;
      return [cx + p[0] * rx * j, cy + p[1] * ry * j, cz + p[2] * rz * j];
    });
    for (const [a, b, c] of ICO_F) {
      const shade = rand ? 0.92 + rand() * 0.16 : 1;
      this.tri(v[a], v[b], v[c], [color[0] * shade, color[1] * shade, color[2] * shade], emissive);
    }
  }

  /**
   * Append another builder transformed by a 4x4 column-major matrix.
   * Optional `recolor(r, g, b) => [r, g, b]` maps colours.
   */
  append(other, m, recolor = null) {
    const s = other.data;
    this.reserve(other.length);
    const d = this.data;
    let o = this.length;
    for (let i = 0; i < other.length; i += FLOATS_PER_VERTEX) {
      const x = s[i];
      const y = s[i + 1];
      const z = s[i + 2];
      const nx = s[i + 3];
      const ny = s[i + 4];
      const nz = s[i + 5];
      let r = s[i + 6];
      let g = s[i + 7];
      let b = s[i + 8];
      if (recolor) [r, g, b] = recolor(r, g, b);
      // Normals: rotate and renormalise (handles uniform scale).
      let tx = m[0] * nx + m[4] * ny + m[8] * nz;
      let ty = m[1] * nx + m[5] * ny + m[9] * nz;
      let tz = m[2] * nx + m[6] * ny + m[10] * nz;
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l;
      ty /= l;
      tz /= l;
      d[o++] = m[0] * x + m[4] * y + m[8] * z + m[12];
      d[o++] = m[1] * x + m[5] * y + m[9] * z + m[13];
      d[o++] = m[2] * x + m[6] * y + m[10] * z + m[14];
      d[o++] = tx;
      d[o++] = ty;
      d[o++] = tz;
      d[o++] = r;
      d[o++] = g;
      d[o++] = b;
      d[o++] = s[i + 9];
      d[o++] = s[i + 10];
      d[o++] = s[i + 11];
    }
    this.length = o;
    this.vertexCount += other.vertexCount;
  }

  /** Bounding sphere (centre, radius) of the geometry. */
  bounds() {
    const d = this.data;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < this.length; i += FLOATS_PER_VERTEX) {
      if (d[i] < minX) minX = d[i];
      if (d[i] > maxX) maxX = d[i];
      if (d[i + 1] < minY) minY = d[i + 1];
      if (d[i + 1] > maxY) maxY = d[i + 1];
      if (d[i + 2] < minZ) minZ = d[i + 2];
      if (d[i + 2] > maxZ) maxZ = d[i + 2];
    }
    const c = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
    return { center: c, radius: Math.hypot(maxX - c[0], maxY - c[1], maxZ - c[2]) };
  }
}

export function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-12) return null;
  return [nx / l, ny / l, nz / l];
}

function normalizeInPlace(n) {
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n[0] /= l;
  n[1] /= l;
  n[2] /= l;
}

// Unit icosahedron.
const GOLD = (1 + Math.sqrt(5)) / 2;
const ICO_V = [
  [-1, GOLD, 0],
  [1, GOLD, 0],
  [-1, -GOLD, 0],
  [1, -GOLD, 0],
  [0, -1, GOLD],
  [0, 1, GOLD],
  [0, -1, -GOLD],
  [0, 1, -GOLD],
  [GOLD, 0, -1],
  [GOLD, 0, 1],
  [-GOLD, 0, -1],
  [-GOLD, 0, 1],
].map((p) => {
  const l = Math.hypot(p[0], p[1], p[2]);
  return [p[0] / l, p[1] / l, p[2] / l];
});
const ICO_F = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];
