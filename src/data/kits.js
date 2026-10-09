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
  const truck = v.family === 'truck';
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
  // Neon underglow: glowing strips under the sills (the light pool on the
  // ground is drawn by the renderer).
  if (kit.neon && kit.neon !== 'none') {
    const z0 = Math.min(...wz) + r * 0.5;
    const z1 = Math.max(...wz) - r * 0.5;
    const mid = bodyAt(st, (z0 + z1) / 2);
    const c = [1, 3, 5].map((i) => parseInt(kit.neon.slice(i, i + 2), 16) / 255);
    m.parts.push({ box: [Math.min(mid.hw, Math.abs(m.wheels.positions[0][0]) - m.wheels.width / 2 - 0.08) * 0.85, mid.yb - 0.015, (z0 + z1) / 2, 0.03, 0.012, (z1 - z0) / 2], paint: c, emissive: 1, mat: 'light', mirror: true });
    m.neon = c;
  }
  return m;
}
