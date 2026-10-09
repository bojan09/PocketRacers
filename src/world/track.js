// Builds a pseudo-3D track: a loop of short, straight road segments. Each
// segment carries a curvature value (screen-space bend accumulated while
// rendering), start/end heights, scenery sprites and render scratch data.

import { easeIn, easeInOut, mulberry32, wrap } from '../core/util.js';

// Sprite kinds the scenery rules can place. `w` is world width; `solid` is
// the fraction of that width that blocks the car (0 = drive-through).
export const SPRITE_KINDS = {
  pine: { w: 900, solid: 0.35 },
  oak: { w: 1200, solid: 0.3 },
  bush: { w: 700, solid: 0 },
  rock: { w: 650, solid: 0.7 },
  billboard: { w: 1900, solid: 0.9 },
  chevronL: { w: 520, solid: 0.5 },
  chevronR: { w: 520, solid: 0.5 },
  archPost: { w: 380, solid: 1 },
};

function makePoint(y, z) {
  return {
    world: { x: 0, y, z },
    camera: { x: 0, y: 0, z: 0 },
    screen: { x: 0, y: 0, w: 0, scale: 0 },
  };
}

export function buildTrack(def) {
  const SL = def.segmentLength;
  const segments = [];
  const rand = mulberry32(def.seed);

  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  function add(curve, y, flags) {
    const n = segments.length;
    segments.push({
      index: n,
      p1: makePoint(lastY(), n * SL),
      p2: makePoint(y, (n + 1) * SL),
      curve,
      band: Math.floor(n / def.rumbleLength) % 2,
      rail: !!flags.rail,
      traffic: !!flags.traffic,
      sprites: [],
      // render scratch
      cars: [],
      clip: 0,
      fog: 0,
      looped: false,
      visible: false,
    });
  }

  function road(s) {
    const startY = lastY();
    const endY = startY + s.hill * SL;
    const total = s.enter + s.hold + s.leave;
    let i = 0;
    for (let n = 0; n < s.enter; n++, i++) add(easeIn(0, s.curve, n / s.enter), easeInOut(startY, endY, (i + 1) / total), s);
    for (let n = 0; n < s.hold; n++, i++) add(s.curve, easeInOut(startY, endY, (i + 1) / total), s);
    for (let n = 0; n < s.leave; n++, i++) add(easeInOut(s.curve, 0, n / s.leave), easeInOut(startY, endY, (i + 1) / total), s);
  }

  for (const s of def.layout) road(s);
  // Close the loop back to height 0 so the start/finish line meets itself.
  road({ enter: 20, hold: 20, leave: 20, curve: 0, hill: -lastY() / SL });

  const count = segments.length;

  // Chevron warning signs on the outside of every significant curve.
  for (let n = 0; n < count; n += 8) {
    const c = segments[n].curve;
    if (Math.abs(c) >= 3) {
      segments[n].sprites.push(makeSprite(c > 0 ? 'chevronR' : 'chevronL', c > 0 ? -1.3 : 1.3));
    }
  }

  // Guard rails (and no trees hugging the barrier).
  for (const seg of segments) if (seg.rail) seg.sprites.length = 0;

  // Scenery.
  for (const rule of def.scenery) {
    const solidOverride = rule.solid === false;
    const place = (n, sideSign) => {
      const seg = segments[n % count];
      if (seg.rail && !rule.at) return;
      const offset = sideSign * (rule.offset[0] + rand() * (rule.offset[1] - rule.offset[0]));
      const kind = rule.kinds[Math.floor(rand() * rule.kinds.length)];
      const sprite = makeSprite(kind, offset);
      if (solidOverride) sprite.solid = 0;
      seg.sprites.push(sprite);
    };
    if (rule.at) {
      rule.at.forEach((n, i) => place(n, rule.side === 'alternate' ? (i % 2 ? 1 : -1) : 1));
      continue;
    }
    for (let n = 10; n < count; n += rule.every) {
      if (rand() > rule.chance) continue;
      if (rule.side === 'both' || rule.side === 'left') place(n, -1);
      if ((rule.side === 'both' && rand() < 0.8) || rule.side === 'right') place(n + 1, 1);
    }
  }

  // Start / finish arch.
  segments[2].sprites.push(makeSprite('archPost', -1.22), makeSprite('archPost', 1.22));
  segments[2].arch = true;

  return {
    def,
    segments,
    count,
    segmentLength: SL,
    length: count * SL,
    roadHalfWidth: def.roadHalfWidth,
    lanes: def.lanes,
    cameraHeight: def.cameraHeight,
    palette: def.palette,
    findSegment(z) {
      return segments[Math.floor(wrap(z, count * SL) / SL) % count];
    },
    /** Road height at track position z (linear within the segment). */
    heightAt(z) {
      const zz = wrap(z, count * SL);
      const seg = segments[Math.floor(zz / SL) % count];
      const t = (zz - seg.p1.world.z) / SL;
      return seg.p1.world.y + (seg.p2.world.y - seg.p1.world.y) * t;
    },
  };
}

function makeSprite(kind, offset) {
  const k = SPRITE_KINDS[kind];
  return { kind, offset, w: k.w, solid: k.solid };
}
