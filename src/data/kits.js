// Body kits: bolt-on parts placed relative to each vehicle's body, so one
// set of options works on every model. Which slots a vehicle offers depends
// on its family (no wings on cargo trucks, no bull bars on race cars).

export const KIT_SLOTS = {
  race: ['spoiler', 'splitter', 'skirts'],
  sports: ['spoiler', 'splitter', 'skirts', 'scoop'],
  muscle: ['spoiler', 'splitter', 'skirts', 'scoop'],
  hatch: ['spoiler', 'splitter', 'skirts', 'scoop'],
  jeep: ['lightbar', 'bullbar'],
  suv: ['spoiler', 'skirts', 'lightbar', 'bullbar'],
  pickup: ['scoop', 'skirts', 'lightbar', 'bullbar'],
  monster: ['bullbar'],
  truck: ['lightbar', 'bullbar'],
  rig: ['lightbar', 'bullbar'],
  tractor: ['lightbar'],
  bike: [],
};

export const KIT_OPTIONS = {
  spoiler: ['stock', 'none', 'lip', 'wing', 'gt'],
  splitter: ['none', 'splitter'],
  skirts: ['none', 'skirts'],
  scoop: ['none', 'scoop', 'blower'],
  lightbar: ['none', 'lightbar'],
  bullbar: ['none', 'bullbar'],
};

export const KIT_LABELS = {
  slot: { spoiler: 'Spoiler', splitter: 'Front splitter', skirts: 'Side skirts', scoop: 'Hood', lightbar: 'Light bar', bullbar: 'Bull bar' },
  stock: 'Stock',
  none: 'None',
  lip: 'Lip',
  wing: 'Wing',
  gt: 'GT wing',
  splitter: 'Splitter',
  skirts: 'Skirts',
  scoop: 'Scoop',
  blower: 'Blower',
  lightbar: 'Light bar',
  bullbar: 'Bull bar',
};

/** Silly roof toppers (free, any vehicle), shown as pictures in the garage. */
export const TOPPERS = { none: '🚫', crown: '👑', duck: '🦆', horn: '🦄', fin: '🦈' };

export const NEON_COLOURS = ['none', '#ff2e88', '#4cc9f0', '#8ac926', '#ffd23f', '#7b5cff', '#ff8c42', '#ffffff'];
export const TINTS = { clear: '#1f2b45', dark: '#0d1220', blue: '#1d4f8a', gold: '#7a5a14', purple: '#4b2a7a' };

/** Slots offered for a vehicle (light bars only where none is built in). */
export function kitSlots(v) {
  return KIT_SLOTS[v.family].filter((s) => !(s === 'lightbar' && v.opts?.lightBar));
}

const lerp = (a, b, t) => a + (b - a) * t;
function bodyAt(st, z) {
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i];
    const b = st[i + 1];
    if (z >= a[0] && z <= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0] || 1);
      return { hw: lerp(a[1], b[1], t), yb: lerp(a[2], b[2], t), yt: lerp(a[3], b[3], t) };
    }
  }
  const s = z < st[0][0] ? st[0] : st[st.length - 1];
  return { hw: s[1], yb: s[2], yt: s[3] };
}

function lightBar(y, z, hw) {
  const parts = [{ box: [0, y, z, hw, 0.04, 0.05], paint: 'dark' }];
  for (let i = 0; i < 4; i++) parts.push({ box: [(-1.5 + i) * hw * 0.5, y + 0.005, z - 0.05, hw * 0.18, 0.03, 0.01], paint: 'light', emissive: 0.9 });
  return parts;
}

/**
 * Return a copy of `model` with the chosen kit parts, neon and window tint.
 * @param kit {spoiler, splitter, skirts, scoop, lightbar, bullbar, neon}
 */
export function applyKit(model, v, kit = {}) {
  const slots = kitSlots(v);
  const m = { ...model, parts: [...(model.parts || [])] };
  const st = m.body;
  const front = st[0][0];
  const rear = st[st.length - 1][0];
  const hwMax = Math.max(...st.map((s) => s[1]));
  const roofOf = () => (m.cabin ? Math.max(...m.cabin.map((c) => c[4])) : Math.max(...st.map((s) => s[3])));
  const truck = v.family === 'truck' || v.family === 'rig';
  const wz = m.wheels.positions.map((p) => p[1]);
  const r = m.wheels.radius;
  const has = (slot, value) => slots.includes(slot) && kit[slot] === value;

  // Spoiler: on the boot lid, or at the back of the roof for hatches/SUVs.
  if (slots.includes('spoiler') && kit.spoiler && kit.spoiler !== 'stock') {
    if (kit.spoiler === 'none') m.spoiler = undefined;
    else {
      const roofSpoiler = v.family === 'hatch' || v.family === 'suv';
      const c = m.cabin;
      const z = roofSpoiler ? c[c.length - 2][0] + 0.1 : rear - 0.3;
      const top = roofSpoiler ? c[c.length - 2][4] : bodyAt(st, z).yt;
      const w = (roofSpoiler ? c[c.length - 2][2] : hwMax) * 0.9;
      m.spoiler =
        kit.spoiler === 'lip'
          ? { type: 'lip', z: z + 0.06, y: top + 0.03, w, d: 0.14 }
          : kit.spoiler === 'wing'
            ? { z, y: top + 0.2, w, d: 0.2, post: 0.1 }
            : { z: z - 0.04, y: top + 0.38, w: w * 1.04, d: 0.32, post: 0.19, plate: 0.15 };
    }
  }
  if (has('splitter', 'splitter')) {
    const f = bodyAt(st, front + 0.1);
    m.parts.push({ box: [0, f.yb + 0.02, front + 0.08, f.hw * 0.95, 0.02, 0.18], paint: 'accent' });
  }
  if (has('skirts', 'skirts')) {
    // Between the wheel wells only.
    const z0 = Math.min(...wz) + r + 0.32;
    const z1 = Math.max(...wz) - r - 0.32;
    if (z1 > z0) {
      const mid = bodyAt(st, (z0 + z1) / 2);
      m.parts.push({ box: [mid.hw + 0.01, mid.yb + 0.07, (z0 + z1) / 2, 0.035, 0.06, (z1 - z0) / 2], paint: 'accent', mirror: true });
    }
  }
  if (slots.includes('scoop') && (kit.scoop === 'scoop' || kit.scoop === 'blower')) {
    const cabinZ = m.cabin ? m.cabin[0][0] : front + 1.5;
    const z = front + (cabinZ - front) * 0.5;
    const top = bodyAt(st, z).yt;
    m.parts.push(
      kit.scoop === 'blower'
        ? { box: [0, top + 0.15, z, 0.24, 0.16, 0.3], paint: 'chrome', top: 0.85 }
        : { box: [0, top + 0.04, z, 0.25, 0.05, 0.36], paint: 'body', top: 0.8 },
      { box: [0, top + (kit.scoop === 'blower' ? 0.3 : 0.07), z - (kit.scoop === 'blower' ? 0.15 : 0.36), 0.19, 0.03, 0.012], paint: 'dark' },
    );
  }
  if (has('lightbar', 'lightbar')) {
    if (truck) m.parts.push(...lightBar(3.08, -3.95, 0.95));
    else {
      const c = m.cabin;
      m.parts.push(...lightBar(roofOf() + 0.05, c ? c[1][0] + 0.2 : 0, Math.min(0.66, hwMax * 0.7)));
    }
  }
  if (has('bullbar', 'bullbar')) {
    const f = bodyAt(st, front + 0.1);
    const zf = truck ? front - 0.2 : front - 0.1;
    const y0 = truck ? 0.5 : f.yb;
    const y1 = truck ? 1.2 : f.yb + (f.yt - f.yb) * 0.8;
    const hw = (truck ? 1.1 : f.hw) * 0.8;
    m.parts.push(
      { box: [0, (y0 + y1) / 2, zf, hw, 0.04, 0.04], paint: 'dark' },
      { box: [0, y1, zf, hw * 0.75, 0.04, 0.04], paint: 'dark' },
      { box: [hw * 0.55, (y0 + y1) / 2 + 0.05, zf, 0.04, (y1 - y0) / 2 + 0.05, 0.04], paint: 'dark', mirror: true },
    );
  }
  if (kit.topper && kit.topper !== 'none' && TOPPERS[kit.topper]) {
    const spot = roofSpot(m, v);
    m.parts.push(...topperParts(kit.topper, spot));
    m.height = Math.max(m.height || 0, spot.y + spot.k * 0.62);
  }
  // Neon underglow: glowing strips under the sills (the light pool on the
  // ground is drawn by the renderer).
  if (kit.neon && kit.neon !== 'none' && v.family === 'bike') {
    // Motorbikes: just the glow on the ground, no sill strips.
    m.neon = [1, 3, 5].map((i) => parseInt(kit.neon.slice(i, i + 2), 16) / 255);
  } else if (kit.neon && kit.neon !== 'none') {
    const z0 = Math.min(...wz) + r * 0.5;
    const z1 = Math.max(...wz) - r * 0.5;
    const mid = bodyAt(st, (z0 + z1) / 2);
    const c = [1, 3, 5].map((i) => parseInt(kit.neon.slice(i, i + 2), 16) / 255);
    m.parts.push({ box: [Math.min(mid.hw, Math.abs(m.wheels.positions[0][0]) - m.wheels.width / 2 - 0.08) * 0.85, mid.yb - 0.015, (z0 + z1) / 2, 0.03, 0.012, (z1 - z0) / 2], paint: c, emissive: 1, mat: 'light', mirror: true });
    m.neon = c;
  }
  return m;
}

/** Highest point of the model at (x = 0, z): body, cabin roof or a box part. */
function topAt(m, z) {
  let y = bodyAt(m.body, z).yt;
  for (const c of m.cabin || []) if (Math.abs(c[0] - z) < 0.6) y = Math.max(y, c[4]);
  if (m.cabin) {
    // Roof height between cabin stations.
    for (let i = 0; i < m.cabin.length - 1; i++) {
      const a = m.cabin[i];
      const b = m.cabin[i + 1];
      if (z >= a[0] && z <= b[0]) y = Math.max(y, lerp(a[4], b[4], (z - a[0]) / (b[0] - a[0] || 1)));
    }
  }
  for (const p of m.parts) {
    if (!p.box || p.emissive) continue;
    const [x, py, pz, hx, hy, hz] = p.box;
    if (Math.abs(x) <= hx && Math.abs(z - pz) <= Math.max(hz * 0.6, 0.05) && hy > 0.03) y = Math.max(y, py + hy);
  }
  return y;
}

/**
 * Where a roof topper sits: the middle of the flat part of the roof (the cab
 * deflector on trucks; the rear deck when there is no roof). `k` scales the
 * topper with the vehicle's width.
 */
function roofSpot(m, v) {
  if (v.family === 'bike') {
    // On the rider's helmet.
    const h = m.parts.find((p) => p.sphere && p.paint === 'stripe');
    if (h) return { y: h.sphere[1] + h.sphere[4] - 0.03, z: h.sphere[2], k: 0.9 };
  }
  const hw = Math.max(...m.body.map((s) => s[1]));
  const k = 1.8 * Math.min(1.25, Math.max(0.8, hw / 0.95));
  const c = m.cabin;
  let z;
  if (c && c.length >= 3) {
    const roof = Math.max(...c.map((s) => s[4]));
    const flat = c.filter((s) => s[4] > roof - 0.04);
    z = (flat[0][0] + flat[flat.length - 1][0]) / 2;
    if (flat.length === 1) z = flat[0][0];
  } else {
    // Open top: on the roll bar's cross bar, else the rear deck.
    const bar = m.parts.filter((p) => p.box && Math.abs(p.box[0]) < 0.01 && p.box[3] > 0.3 && !p.emissive).sort((a, b) => b.box[1] - a.box[1])[0];
    z = bar ? bar.box[2] : m.body[m.body.length - 1][0] * 0.45;
  }
  if (v.family === 'truck' || v.family === 'rig') {
    const deflector = m.parts.find((p) => p.box && p.box[1] > 3.1 && p.box[4] > 0.2);
    if (deflector) z = deflector.box[2];
  }
  return { y: topAt(m, z), z, k };
}

const GOLD = [1, 0.78, 0.18];

function topperParts(kind, { y, z, k }) {
  const s = (v) => v * k;
  if (kind === 'crown') {
    const parts = [{ cyl: [0, y + s(0.09), z, s(0.22), s(0.09), 'y'], topR: s(0.24), paint: GOLD, sides: 18 }];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * s(0.2);
      const pz = z + Math.sin(a) * s(0.2);
      parts.push({ cyl: [px, y + s(0.25), pz, s(0.065), s(0.08), 'y'], topR: 0, paint: GOLD, sides: 8 });
      parts.push({ sphere: [px, y + s(0.34), pz, s(0.035), s(0.035), s(0.035)], paint: GOLD });
    }
    parts.push(
      { sphere: [0, y + s(0.1), z - s(0.235), s(0.045), s(0.045), s(0.02)], paint: [0.9, 0.08, 0.2], mat: 'glass' },
      { sphere: [s(0.235), y + s(0.1), z, s(0.02), s(0.04), s(0.04)], paint: [0.15, 0.4, 1], mat: 'glass', mirror: true },
    );
    return parts;
  }
  if (kind === 'duck') {
    const yellow = [1, 0.85, 0.12];
    return [
      { sphere: [0, y + s(0.15), z + s(0.04), s(0.22), s(0.16), s(0.29)], paint: yellow },
      { sphere: [0, y + s(0.24), z + s(0.29), s(0.09), s(0.08), s(0.08)], paint: yellow },
      { sphere: [s(0.17), y + s(0.18), z + s(0.07), s(0.06), s(0.08), s(0.16)], paint: [1, 0.78, 0.08], mirror: true },
      { sphere: [0, y + s(0.42), z - s(0.13), s(0.14), s(0.14), s(0.14)], paint: yellow },
      { sphere: [0, y + s(0.39), z - s(0.29), s(0.075), s(0.03), s(0.07)], paint: [1, 0.45, 0.08] },
      { sphere: [s(0.065), y + s(0.47), z - s(0.24), s(0.032), s(0.032), s(0.02)], paint: [0.04, 0.04, 0.05], mat: 'glass', mirror: true },
    ];
  }
  if (kind === 'horn') {
    // A striped unicorn horn with a pastel mane running back over the roof.
    const bands = [
      [0.1, 0.075, [1, 0.72, 0.86]],
      [0.075, 0.052, [1, 0.97, 0.9]],
      [0.052, 0.03, [0.78, 0.66, 1]],
      [0.03, 0.0, [1, 0.88, 0.45]],
    ];
    const parts = [];
    bands.forEach(([r0, r1, c], i) => parts.push({ cyl: [0, y + s(0.06 + i * 0.12), z - s(0.15), s(r0), s(0.06), 'y'], topR: s(r1), paint: c, sides: 12 }));
    const mane = [
      [1, 0.45, 0.7],
      [0.75, 0.5, 1],
      [0.45, 0.75, 1],
      [0.5, 0.9, 0.65],
      [1, 0.85, 0.4],
    ];
    mane.forEach((c, i) => parts.push({ sphere: [0, y + s(0.06), z + s(0.02 + i * 0.13), s(0.08), s(0.08 - i * 0.006), s(0.09)], paint: c }));
    return parts;
  }
  if (kind === 'fin') {
    // Shark fin: swept leading edge, hooked trailing edge.
    const grey = [0.42, 0.5, 0.6];
    const pts = [
      [0, -0.32],
      [0.2, -0.16],
      [0.4, 0.04],
      [0.56, 0.24],
      [0.44, 0.17],
      [0.24, 0.18],
      [0, 0.3],
    ].map(([py, pz]) => [y - s(0.02) + s(py), z + s(pz)]);
    return [
      { prism: [0, s(0.04), pts], paint: grey },
      { box: [0, y + s(0.012), z, s(0.06), s(0.012), s(0.3)], paint: [0.9, 0.92, 0.95] },
    ];
  }
  return [];
}
