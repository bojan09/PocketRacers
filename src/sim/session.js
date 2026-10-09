// Driving simulation. Pure logic with no DOM, canvas or timing access, so it
// runs identically in the browser and in Node unit tests. Advanced with a
// fixed timestep by core/loop.js.

import { approach, clamp, loopDelta, mulberry32, wrap } from '../core/util.js';
import { AIR_GRAVITY, rampLift } from '../world/track3d.js';
import { FunSystem } from './fun.js';

export const SPEED_TO_KMH = 0.015;
const LANES3 = [-2 / 3, 0, 2 / 3];
const MAX_EVENTS = 32;
const GRAVITY = 2600; // sim units / s^2 per unit of slope (arcade-scaled)
export const NITRO_DRAIN = 0.22; // a full tank lasts ~4.5 s of boosting
const TRAFFIC_SPEED = 12000; // traffic pace is the same whatever the player drives
export const SPIN_RATE = 8.5; // rad/s of air spin at full steering lock (~0.75 s per 360)
export const SUPER_TIME = 3.5; // seconds of Super Nitro
const SUPER_TOP = 1.12; // Super Nitro top speed on top of normal nitro
const SHOCKWAVE_RANGE = 24000; // sim units ahead that the activation shockwave clears

export class DrivingSession {
  constructor(track, car, { trafficCount = track.def.trafficCount ?? 0, seed = 7 } = {}) {
    this.track = track;
    this.setCar(car, false);
    this.trafficCount = trafficCount;
    this.seed = seed;
    this.steerSensitivity = 1;
    this.surfaceGrip = 1;
    this.events = [];
    this.fun = new FunSystem(this);
    this.reset();
  }

  /** Swap the player's vehicle (garage). */
  setCar(car, reset = true) {
    this.car = car;
    this.carHalf = car.widthWorld / 2 / this.track.roadHalfWidth;
    if (reset) this.reset();
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
      // Vertical motion (metres above the road) for ramps and jumps.
      air: 0,
      prevAir: 0,
      vy: 0,
      airborne: false,
      airTime: 0,
      onRamp: null,
      rampPitch: 0,
      boostTime: 0,
      // Nitro tank (0..1): starts full, drains while boosting, refilled by tricks.
      nitroFuel: 1,
      // Tricks: yaw spin and barrel roll (radians), visual and scored on landing.
      spin: 0,
      spinVel: 0,
      roll: 0,
      rollVel: 0,
      rampRoll: 0,
      // Super Nitro: charge (0..1) filled by tricks; superTime > 0 while active.
      superCharge: 0,
      superTime: 0,
    };
    this.traffic = [];
    const max = TRAFFIC_SPEED;
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
        ahead: 0,
        bumpTime: -10,
      });
    }
    this.events.length = 0;
    this.fun.reset();
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
    p.prevAir = p.air;
    this.time += dt;
    if (p.hitCooldown > 0) p.hitCooldown -= dt;
    if (p.boostTime > 0) p.boostTime -= dt;

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
    const padBoost = p.boostTime > 0;
    if (p.superTime > 0) p.superTime = Math.max(0, p.superTime - dt);
    else if (input.nitro && p.superCharge >= 1 && brake === 0) this.startSuper();
    const superOn = p.superTime > 0;
    const nitro = ((input.nitro && p.nitroFuel > 0) || padBoost || superOn) && brake === 0 && p.speed >= 0;
    p.nitro = nitro;
    p.super = superOn;
    p.nitroEmpty = input.nitro && p.nitroFuel <= 0 && !padBoost && !superOn;
    if (nitro && !padBoost && !superOn) p.nitroFuel = Math.max(0, p.nitroFuel - NITRO_DRAIN * dt);
    const throttle = nitro ? 1 : clamp(input.throttle, 0, 1);
    let top = h.maxSpeed * (nitro ? h.nitroTop * (superOn ? SUPER_TOP : 1) : 1);
    if (p.offroad) top = Math.min(top, h.maxSpeed * h.offroadTop * (nitro ? 1.25 : 1));

    p.braking = false;
    if (p.airborne) {
      // In the air: momentum only, no traction.
    } else if (brake > 0) {
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
          const acc = h.accel * (nitro ? h.nitroAccel * (superOn ? 1.35 : 1) : 1) * throttle * (1 - 0.55 * Math.min(1, p.speed / top));
          if (p.speed < top) p.speed = Math.min(top, p.speed + acc * dt);
        }
      } else {
        p.speed = approach(p.speed, 0, h.coastDecel * dt);
      }
    }
    if (p.speed > top && !p.airborne) p.speed = Math.max(top, p.speed - (p.offroad ? h.offroadDecel : h.coastDecel * 1.5) * dt);
    // Gentle gravity on hills: uphill costs a little speed, downhill adds some.
    if (seg.slope && p.speed !== 0 && !p.airborne) p.speed = Math.max(-h.reverseMax, p.speed - seg.slope * GRAVITY * dt);

    // --- Lateral --------------------------------------------------------
    const sp = p.speed / h.maxSpeed;
    const authority = clamp(Math.abs(sp) * 3, 0, 1) * (p.airborne ? 0.35 : 1);
    const latTarget = p.steer * h.steerSpeed * authority * (nitro ? 0.9 : 1);
    const grip = p.airborne ? 2 : h.grip * (p.offroad ? h.offroadGrip : 1) * this.surfaceGrip;
    p.latVel += (latTarget - p.latVel) * (1 - Math.exp(-grip * dt));
    // Banked corners cancel part of the outward push.
    const centrifugal = p.airborne ? 0 : seg.curve * sp * Math.abs(sp) * h.centrifugal * (1 - (seg.bankAssist || 0));
    p.x += (p.latVel - centrifugal) * dt;
    p.sliding = !p.airborne && sp > 0.5 && ((Math.abs(centrifugal) > 1.1 && Math.abs(p.steer) > 0.6) || (p.braking && sp > 0.7));

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

    this.updateAir(dt);
    this.collideScenery();
    this.stepTraffic(dt);
    this.fun.step(dt);
  }

  /** Ramps launch the car; gravity brings it back down. */
  updateAir(dt) {
    const p = this.player;
    const T = this.track;
    const L = T.length;
    const mpu = T.metresPerUnit;
    if (p.airborne) {
      p.vy -= AIR_GRAVITY * dt;
      p.air += p.vy * dt;
      p.airTime += dt;
      // Steering in the air spins the car; a barrel roll turns on its own.
      p.spinVel = approach(p.spinVel, p.steer * SPIN_RATE, SPIN_RATE * 4 * dt);
      p.spin += p.spinVel * dt;
      p.roll += p.rollVel * dt;
      if (p.air <= 0) {
        const impact = -p.vy;
        p.air = 0;
        p.vy = 0;
        p.airborne = false;
        p.rampPitch = 0;
        p.speed *= 0.985;
        this.emit({ type: 'land', airTime: p.airTime, strength: Math.min(1, impact / 14) });
        this.fun.onLand(p.airTime, Math.abs(p.spin), Math.abs(p.roll));
        // Always land wheels-down: keep only the leftover angle and settle it.
        const turn = Math.PI * 2;
        p.spin -= Math.round(p.spin / turn) * turn;
        p.roll -= Math.round(p.roll / turn) * turn;
        if (Math.abs(p.spin) > 0.6) p.speed *= 0.93; // landed sideways: a little scrub
        p.spinVel = 0;
        p.rollVel = 0;
      }
      return;
    }
    // On the ground: unwind what is left of a spin or roll.
    if (p.spin || p.roll) {
      const k = Math.exp(-12 * dt);
      p.spin = Math.abs(p.spin) < 0.002 ? 0 : p.spin * k;
      p.roll = Math.abs(p.roll) < 0.002 ? 0 : p.roll * k;
    }
    let ramp = null;
    for (const r of T.ramps || []) {
      if (wrap(p.z - r.z0, L) < r.z1 - r.z0 && p.x >= r.xa && p.x <= r.xb) {
        ramp = r;
        break;
      }
    }
    if (ramp && p.speed > 0) {
      const t = wrap(p.z - ramp.z0, L) / (ramp.z1 - ramp.z0);
      p.air = t * ramp.height * rampLift(ramp, p.x);
      p.rampPitch = Math.atan2(ramp.height * rampLift(ramp, p.x), ramp.length);
      // Barrel ramps tip the car sideways as it climbs.
      p.rampRoll = ramp.trick === 'barrel' ? ramp.roll * Math.atan2(ramp.height * 0.55 * t, ramp.width * T.roadHalfWidthM) : 0;
      p.onRamp = ramp;
      return;
    }
    const left = p.onRamp;
    p.onRamp = null;
    p.rampPitch = 0;
    const tipped = p.rampRoll;
    p.rampRoll = 0;
    if (left && p.air > 0) {
      // Off the ramp: launch if we went over the lip, otherwise drop off the side.
      const overLip = wrap(p.z - left.z0, L) >= left.z1 - left.z0;
      const speedM = p.speed * mpu;
      p.airborne = true;
      p.airTime = 0;
      p.vy = overLip && speedM > 6 ? ((speedM * left.height * rampLift(left, p.x)) / left.length) * (this.car.handling.jumpBoost ?? 1) : 0;
      if (p.vy > 0) {
        this.emit({ type: 'takeoff', trick: left.trick });
        if (left.trick === 'barrel') {
          // Time the roll to finish exactly as the car lands.
          const flight = (p.vy + Math.sqrt(p.vy * p.vy + 2 * AIR_GRAVITY * p.air)) / AIR_GRAVITY;
          p.roll = tipped;
          p.rollVel = (left.roll * Math.PI * 2 - tipped) / flight;
        }
      }
      return;
    }
    p.air = 0;
  }

  /** Super Nitro: big boost plus a shockwave that clears traffic ahead. */
  startSuper() {
    const p = this.player;
    p.superCharge = 0;
    p.superTime = SUPER_TIME;
    this.emit({ type: 'super' });
    for (const c of this.traffic) {
      const ahead = loopDelta(p.z, c.z, this.track.length);
      if (ahead > -2000 && ahead < SHOCKWAVE_RANGE) this.knock(c, Math.sign(c.x - p.x) || 1, false);
    }
  }

  /** Bump a traffic car out of the way (Super Nitro); it spins and recovers. */
  knock(c, dir, hit) {
    c.knockTime = this.time;
    c.knockDir = dir;
    c.targetX = clamp(c.x + dir * 0.75, -0.95, 0.95);
    c.laneTimer = 4;
    if (hit) {
      c.x = clamp(c.x + dir * 0.12, -0.95, 0.95);
      c.speed *= 0.6;
      this.fun.onKnock();
    }
  }

  completeLap() {
    const p = this.player;
    this.fun.respawn();
    const isBest = !p.bestLap || p.lapTime < p.bestLap;
    p.lastLap = p.lapTime;
    if (isBest) p.bestLap = p.lapTime;
    this.emit({ type: 'lap', lap: p.lap, time: p.lapTime, best: isBest });
    p.lap++;
    p.lapTime = 0;
  }

  collideScenery() {
    const p = this.player;
    if (p.hitCooldown > 0 || p.speed === 0 || p.air > 0.9) return;
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
      c.x = approach(c.x, c.targetX, (this.time - (c.knockTime ?? -10) < 1 ? 1.6 : 0.45) * dt);
      c.z = wrap(c.z + c.speed * dt, L);

      // Player <-> traffic collision (bump-car style, never punishing).
      const d = loopDelta(p.z, c.z, L);
      // Near miss: the player just overtook this car with a small gap.
      const nowAhead = d > 0 ? 1 : -1;
      if (c.ahead === 1 && nowAhead === -1 && Math.abs(d) < len * 2 && p.speed > c.speed) {
        const gap = Math.abs(p.x - c.x) - width;
        if (gap >= 0 && gap < 0.16 && this.time - c.bumpTime > 1 && p.speed > this.car.handling.maxSpeed * 0.45) this.fun.onNearMiss();
      }
      c.ahead = nowAhead;
      if (p.air > 1.1) continue;
      if (Math.abs(d) < len && Math.abs(p.x - c.x) < width) {
        c.bumpTime = this.time;
        if (p.superTime > 0) {
          // Super Nitro barges through: the other car is knocked aside.
          if (this.time - (c.knockTime ?? -10) > 0.5) this.knock(c, Math.sign(c.x - p.x) || 1, true);
          continue;
        }
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
