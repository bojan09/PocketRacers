// Driving simulation. Pure logic with no DOM, canvas or timing access, so it
// runs identically in the browser and in Node unit tests. Advanced with a
// fixed timestep by core/loop.js.

import { approach, clamp, loopDelta, mulberry32, wrap } from '../core/util.js';

export const SPEED_TO_KMH = 0.015;
const LANES3 = [-2 / 3, 0, 2 / 3];
const MAX_EVENTS = 32;
const GRAVITY = 2600; // sim units / s^2 per unit of slope (arcade-scaled)

export class DrivingSession {
  constructor(track, car, { trafficCount = track.def.trafficCount ?? 0, seed = 7 } = {}) {
    this.track = track;
    this.car = car;
    this.carHalf = car.widthWorld / 2 / track.roadHalfWidth;
    this.trafficCount = trafficCount;
    this.seed = seed;
    this.steerSensitivity = 1;
    this.surfaceGrip = 1;
    this.events = [];
    this.reset();
  }

  reset() {
    const rand = mulberry32(this.seed);
    this.rand = rand;
    this.time = 0;
    this.player = {
      z: 0,
      x: 0,
      prevZ: 0,
      prevX: 0,
      speed: 0,
      steer: 0,
      latVel: 0,
      nitro: false,
      braking: false,
      offroad: false,
      scraping: false,
      sliding: false,
      reverseHold: 0,
      hitCooldown: 0,
      lap: 1,
      lapTime: 0,
      lastLap: 0,
      bestLap: 0,
      timing: false,
      halfway: false,
      odometer: 0,
    };
    this.traffic = [];
    const max = this.car.handling.maxSpeed;
    for (let i = 0; i < this.trafficCount; i++) {
      const lane = Math.floor(rand() * 3);
      const z = wrap(6000 + (i * this.track.length) / this.trafficCount, this.track.length);
      this.traffic.push({
        id: i,
        z,
        prevZ: z,
        x: LANES3[lane],
        targetX: LANES3[lane],
        speed: max * (0.38 + rand() * 0.18),
        cruise: max * (0.38 + rand() * 0.18),
        laneTimer: 2 + rand() * 6,
        paint: i,
      });
    }
    this.events.length = 0;
  }

  emit(e) {
    if (this.events.length < MAX_EVENTS) this.events.push(e);
  }

  /**
   * @param {number} dt fixed step in seconds
   * @param {{steer:number, analog:boolean, throttle:number, brake:number, nitro:boolean}} input
   */
  step(dt, input) {
    const p = this.player;
    const h = this.car.handling;
    const T = this.track;
    const L = T.length;
    p.prevZ = p.z;
    p.prevX = p.x;
    this.time += dt;
    if (p.hitCooldown > 0) p.hitCooldown -= dt;

    const seg = T.findSegment(p.z);

    // --- Steering -------------------------------------------------------
    const target = clamp(input.steer, -1, 1);
    if (input.analog) {
      p.steer += (target - p.steer) * (1 - Math.exp(-dt * 20));
    } else {
      const returning = target === 0 || Math.sign(target) !== Math.sign(p.steer);
      const rate = returning ? h.steerReturn : h.steerRamp * this.steerSensitivity;
      p.steer = approach(p.steer, target, rate * dt);
    }

    // --- Longitudinal ---------------------------------------------------
    p.offroad = Math.abs(p.x) > 1;
    const brake = clamp(input.brake, 0, 1);
    const nitro = input.nitro && brake === 0 && p.speed >= 0;
    p.nitro = nitro;
    const throttle = nitro ? 1 : clamp(input.throttle, 0, 1);
    let top = h.maxSpeed * (nitro ? h.nitroTop : 1);
    if (p.offroad) top = Math.min(top, h.maxSpeed * h.offroadTop * (nitro ? 1.25 : 1));

    p.braking = false;
    if (brake > 0) {
      if (p.speed > 1) {
        p.braking = true;
        p.speed = Math.max(0, p.speed - h.brake * brake * dt);
        p.reverseHold = 0;
      } else {
        // Hold brake briefly at a standstill before reversing, so stopping
        // doesn't immediately turn into backing up.
        p.reverseHold += dt;
        if (p.reverseHold > 0.25) p.speed = Math.max(-h.reverseMax, p.speed - h.reverseAccel * brake * dt);
      }
    } else {
      p.reverseHold = 0;
      if (throttle > 0) {
        if (p.speed < 0) {
          p.speed = Math.min(0, p.speed + h.brake * dt);
        } else {
          const acc = h.accel * (nitro ? h.nitroAccel : 1) * throttle * (1 - 0.55 * Math.min(1, p.speed / top));
          if (p.speed < top) p.speed = Math.min(top, p.speed + acc * dt);
        }
      } else {
        p.speed = approach(p.speed, 0, h.coastDecel * dt);
      }
    }
    if (p.speed > top) p.speed = Math.max(top, p.speed - (p.offroad ? h.offroadDecel : h.coastDecel * 1.5) * dt);
    // Gentle gravity on hills: uphill costs a little speed, downhill adds some.
    if (seg.slope && p.speed !== 0) p.speed = Math.max(-h.reverseMax, p.speed - seg.slope * GRAVITY * dt);

    // --- Lateral --------------------------------------------------------
    const sp = p.speed / h.maxSpeed;
    const authority = clamp(Math.abs(sp) * 3, 0, 1);
    const latTarget = p.steer * h.steerSpeed * authority * (nitro ? 0.9 : 1);
    const grip = h.grip * (p.offroad ? h.offroadGrip : 1) * this.surfaceGrip;
    p.latVel += (latTarget - p.latVel) * (1 - Math.exp(-grip * dt));
    // Banked corners cancel part of the outward push.
    const centrifugal = seg.curve * sp * Math.abs(sp) * h.centrifugal * (1 - (seg.bankAssist || 0));
    p.x += (p.latVel - centrifugal) * dt;
    p.sliding = sp > 0.5 && ((Math.abs(centrifugal) > 1.1 && Math.abs(p.steer) > 0.6) || (p.braking && sp > 0.7));

    // Guard rails and world bounds.
    p.scraping = false;
    if (seg.rail) {
      const limit = 1.12 - this.carHalf;
      if (Math.abs(p.x) > limit) {
        p.x = Math.sign(p.x) * limit;
        if (Math.sign(p.latVel) === Math.sign(p.x)) p.latVel *= -0.3;
        p.speed -= p.speed * 0.9 * dt;
        p.scraping = Math.abs(p.speed) > 300;
      }
    }
    p.x = clamp(p.x, -2.8, 2.8);

    // --- Advance along the track ----------------------------------------
    let z = p.z + p.speed * dt;
    if (p.speed > 0 && !p.timing) p.timing = true;
    if (p.timing) p.lapTime += dt;
    if (z >= L) {
      z -= L;
      if (p.halfway) this.completeLap();
      p.halfway = false;
    } else if (z < 0) {
      z += L;
      p.halfway = false;
    }
    if (!p.halfway && z > L * 0.5 && z < L * 0.75) p.halfway = true;
    p.z = z;
    p.odometer += Math.abs(p.speed) * dt;

    this.collideScenery();
    this.stepTraffic(dt);
  }

  completeLap() {
    const p = this.player;
    const isBest = !p.bestLap || p.lapTime < p.bestLap;
    p.lastLap = p.lapTime;
    if (isBest) p.bestLap = p.lapTime;
    this.emit({ type: 'lap', lap: p.lap, time: p.lapTime, best: isBest });
    p.lap++;
    p.lapTime = 0;
  }

  collideScenery() {
    const p = this.player;
    if (p.hitCooldown > 0 || p.speed === 0) return;
    const T = this.track;
    const dir = p.speed > 0 ? 1 : -1;
    const half = this.car.lengthWorld / 2;
    const seg = T.findSegment(p.z + dir * half);
    for (const s of seg.sprites) {
      if (!s.solid) continue;
      const sHalf = (s.w * s.solid) / 2 / T.roadHalfWidth;
      const dx = p.x - s.offset;
      if (Math.abs(dx) >= this.carHalf + sHalf) continue;
      const impact = Math.abs(p.speed) / this.car.handling.maxSpeed;
      // Back the car out of the obstacle's segment and give a small rebound.
      const edge = dir > 0 ? seg.z - half - 1 : seg.z + T.segmentLength + half + 1;
      p.z = wrap(edge, T.length);
      p.speed = -dir * Math.min(Math.abs(p.speed) * 0.15, 900);
      p.latVel = Math.sign(dx || 1) * 0.8;
      p.hitCooldown = 0.15;
      this.emit({ type: 'hit', what: s.kind, strength: impact });
      return;
    }
  }

  stepTraffic(dt) {
    const p = this.player;
    const T = this.track;
    const L = T.length;
    const len = this.car.lengthWorld;
    const width = this.carHalf * 2 * 0.9;
    for (const c of this.traffic) {
      c.prevZ = c.z;
      c.laneTimer -= dt;
      if (c.laneTimer <= 0) {
        c.targetX = LANES3[Math.floor(this.rand() * 3)];
        c.laneTimer = 3 + this.rand() * 6;
      }
      // Ease off when the player is just ahead in the same lane.
      const ahead = loopDelta(c.z, p.z, L);
      const blocked = ahead > 0 && ahead < 2500 && Math.abs(p.x - c.x) < width && p.speed < c.speed;
      c.speed = approach(c.speed, blocked ? Math.max(0, p.speed * 0.9) : c.cruise, 3000 * dt);
      c.x = approach(c.x, c.targetX, 0.45 * dt);
      c.z = wrap(c.z + c.speed * dt, L);

      // Player <-> traffic collision (bump-car style, never punishing).
      const d = loopDelta(p.z, c.z, L);
      if (Math.abs(d) < len && Math.abs(p.x - c.x) < width) {
        const side = Math.sign(p.x - c.x) || 1;
        if (d > 0 && p.speed > c.speed) {
          const impact = (p.speed - c.speed) / this.car.handling.maxSpeed;
          c.speed += (p.speed - c.speed) * 0.4;
          p.speed = c.speed * 0.85;
          p.z = wrap(c.z - len, L);
          p.latVel += side * 0.9;
          c.x -= side * 0.08;
          this.emit({ type: 'bump', strength: impact });
        } else if (d < 0 && c.speed > p.speed) {
          const impact = (c.speed - p.speed) / this.car.handling.maxSpeed;
          p.speed += (c.speed - p.speed) * 0.4;
          c.speed = p.speed * 0.85;
          c.z = wrap(p.z - len, L);
          this.emit({ type: 'bump', strength: impact });
        }
      }
    }
  }
}
