// CPU-side geometry builder for flat-shaded, vertex-coloured low-poly meshes.
// Vertex layout (10 floats): position xyz, normal xyz, colour rgb, emissive.
// Each triangle gets its own vertices so faces keep a crisp faceted look.

export const FLOATS_PER_VERTEX = 10;

export class MeshBuilder {
  constructor() {
    this.data = [];
    this.vertexCount = 0;
  }

  /** Triangle with a flat normal. a, b, c are [x, y, z]; color is [r, g, b]. */
  tri(a, b, c, color, emissive = 0) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l;
    ny /= l;
    nz /= l;
    const d = this.data;
    for (const p of [a, b, c]) d.push(p[0], p[1], p[2], nx, ny, nz, color[0], color[1], color[2], emissive);
    this.vertexCount += 3;
  }

  /** Triangle with per-vertex colours (smooth gradients, e.g. the sky). */
  triC(a, b, c, ca, cb, cc, emissive = 0) {
    const start = this.data.length;
    this.tri(a, b, c, ca, emissive);
    if (this.data.length === start) return;
    const d = this.data;
    for (let k = 0; k < 3; k++) {
      const col = [ca, cb, cc][k];
      const o = start + k * FLOATS_PER_VERTEX + 6;
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
    }
  }

  quad(a, b, c, d, color, emissive = 0) {
    this.tri(a, b, c, color, emissive);
    this.tri(a, c, d, color, emissive);
  }

  /** Convex polygon fan. */
  poly(points, color, emissive = 0) {
    for (let i = 1; i < points.length - 1; i++) this.tri(points[0], points[i], points[i + 1], color, emissive);
  }

  /** Axis-aligned box centred at (x, y, z) with half sizes, optional y-taper of the top face. */
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

  /** Cylinder along an axis ('x' | 'y' | 'z'), with optional cap colour. */
  cylinder(cx, cy, cz, radius, halfLength, sides, axis, color, capColor = color, topRadius = radius) {
    const pt = (r, a, h) => {
      const u = Math.cos(a) * r;
      const v = Math.sin(a) * r;
      if (axis === 'x') return [cx + h, cy + u, cz + v];
      if (axis === 'y') return [cx + u, cy + h, cz + v];
      return [cx + u, cy + v, cz + h];
    };
    const capA = [];
    const capB = [];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      this.quad(pt(radius, a0, -halfLength), pt(radius, a1, -halfLength), pt(topRadius, a1, halfLength), pt(topRadius, a0, halfLength), color);
      capA.push(pt(radius, a0, -halfLength));
      capB.push(pt(topRadius, a0, halfLength));
    }
    if (radius > 0) this.poly(capA, capColor);
    if (topRadius > 0) this.poly(capB, capColor);
  }

  /** Low-poly sphere-ish blob (icosahedron, optionally squashed / jittered). */
  blob(cx, cy, cz, rx, ry, rz, color, rand = null, jitter = 0, emissive = 0) {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map((p) => {
      const l = Math.hypot(p[0], p[1], p[2]);
      const j = rand ? 1 + (rand() - 0.5) * jitter : 1;
      return [cx + (p[0] / l) * rx * j, cy + (p[1] / l) * ry * j, cz + (p[2] / l) * rz * j];
    });
    const f = [
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
    for (const [a, b, c] of f) {
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
    const d = this.data;
    for (let i = 0; i < s.length; i += FLOATS_PER_VERTEX) {
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
      d.push(
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
        m[0] * nx + m[4] * ny + m[8] * nz,
        m[1] * nx + m[5] * ny + m[9] * nz,
        m[2] * nx + m[6] * ny + m[10] * nz,
        r,
        g,
        b,
        s[i + 9],
      );
    }
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
    for (let i = 0; i < d.length; i += FLOATS_PER_VERTEX) {
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
