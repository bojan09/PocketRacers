// Free driving in the open world: the car has a real position and heading
// on the landscape instead of "distance along a track". Same handling
// numbers, nitro, Super Nitro, jumps and tricks as on the tracks, so every
// vehicle feels familiar. Pure logic (no DOM), unit-testable.
//
// Units: position in metres; speed in sim units (240 per metre) like the
// track session, so the HUD, audio and handling values are shared.

import { approach, clamp } from '../core/util.js';
import { AIR_GRAVITY, UNITS_PER_METRE } from '../world/track3d.js';
import { WATER } from '../world/openWorld.js';
import { FunSystem } from './fun.js';
import { NITRO_DRAIN, SPIN_RATE, SUPER_TIME } from './session.js';

const MPU = 1 / UNITS_PER_METRE;
const MAX_EVENTS = 32;
const SUPER_TOP = 1.12;
const TAKEOFF = 5; // m/s the ground must fall away faster than the car to leave it
const SLOPE_PULL = 9; // m/s^2 per unit of slope (arcade-scaled gravity)
// Surface grip and top-speed share (the open world has no roads yet).
const SURFACE = {
  grass: { grip: 0.9, top: 0.88, drag: 0 },
  sand: { grip: 0.7, top: 0.7, drag: 0.4 },
  rock: { grip: 0.8, top: 0.8, drag: 0 },
  water: { grip: 0.3, top: 0.25, drag: 3 },
};

export function newFreeState(x = 0, z = 0, yaw = 0, y = 0) {
  return {
    x,
    y,
    z,
    yaw,
    prevX: x,
    prevY: y,
    prevZ: z,
    prevYaw: yaw,
    speed: 0, // sim units / s along the heading
    latV: 0, // m/s sideways (positive = to the right)
    vy: 0,
    air: 0, // height above the ground (m)
    airborne: false,
    airTime: 0,
    steer: 0,
    reverseHold: 0,
    nitroFuel: 1,
    superCharge: 0,
    superTime: 0,
    nitro: false,
    super: false,
    nitroEmpty: false,
    boostTime: 0,
    braking: false,
    sliding: false,
    offroad: false,
    scraping: false,
    surface: 'grass',
    spin: 0,
    spinVel: 0,
    roll: 0,
    rampRoll: 0,
    pitch: 0,
    bank: 0,
    // Track-session fields the HUD reads.
    lap: 1,
    lapTime: 0,
    bestLap: null,
    timing: false,
    // Where to come back to after falling in the sea.
    safeX: x,
    safeZ: z,
    safeYaw: yaw,
    wet: 0,
  };
}

export class FreeSession {
  constructor(world, car) {
    this.world = world;
    this.events = [];
    this.racers = [];
    this.traffic = [];
    this.assist = false;
    this.roam = true;
    this.steerSensitivity = 1;
    this.surfaceGrip = 1;
    // Scoring reuses the track fun system with an empty, endless "track".
    this.track = { length: 1e12, metresPerUnit: MPU, segmentLength: 1, def: { id: 'open-world' }, starDefs: [], coneDefs: [], propDefs: [], boosts: [] };
    this.fun = new FunSystem(this);
    this.setCar(car);
    this.reset();
  }

  setCar(car, reset = false) {
    this.car = car;
    this.carHalf = car.widthWorld / 2 / UNITS_PER_METRE; // metres
    if (this.body) this.body.car = car;
    if (reset) this.reset();
  }

  reset(spawn = this.world.spawn) {
    this.time = 0;
    const y = this.world.ground(spawn.x, spawn.z);
    this.player = newFreeState(spawn.x, spawn.z, spawn.yaw, y);
    this.body = { p: this.player, car: this.car, isPlayer: true };
    this.events.length = 0;
    this.fun.reset();
  }

  emit(e) {
    if (this.events.length < MAX_EVENTS) this.events.push(e);
  }

  honk() {
    this.emit({ type: 'honk' });
    return true;
  }

  startSuper() {
    const p = this.player;
    p.superCharge = 0;
    p.superTime = SUPER_TIME;
    this.emit({ type: 'super' });
  }

  step(dt, input) {
    this.time += dt;
    const p = this.player;
    const h = this.car.handling;
    const W = this.world;
    p.prevX = p.x;
    p.prevY = p.y;
    p.prevZ = p.z;
    p.prevYaw = p.yaw;

    // --- Steering (same feel as on the tracks) ----------------------------
    const target = clamp(input.steer, -1, 1);
    if (input.analog) p.steer += (target - p.steer) * (1 - Math.exp(-dt * 20));
    else {
      const returning = target === 0 || Math.sign(target) !== Math.sign(p.steer);
      p.steer = approach(p.steer, target, (returning ? h.steerReturn : h.steerRamp * this.steerSensitivity) * dt);
    }

    // --- Surface ------------------------------------------------------------
    p.surface = W.surface(p.x, p.z);
    const S = SURFACE[p.surface];
    p.offroad = p.surface === 'sand' || p.surface === 'water';

    // --- Speed: throttle, brakes, nitro (as on the tracks) ----------------
    const brake = clamp(input.brake, 0, 1);
    if (p.superTime > 0) p.superTime = Math.max(0, p.superTime - dt);
    else if (input.nitro && p.superCharge >= 1 && brake === 0) this.startSuper();
    const superOn = p.superTime > 0;
    const nitro = ((input.nitro && p.nitroFuel > 0) || superOn) && brake === 0 && p.speed >= 0;
    p.nitro = nitro;
    p.super = superOn;
    p.nitroEmpty = input.nitro && p.nitroFuel <= 0 && !superOn;
    if (nitro && !superOn) p.nitroFuel = Math.max(0, p.nitroFuel - NITRO_DRAIN * (h.nitroDrain ?? 1) * dt);
    // The open world is for exploring: nitro slowly refills on its own.
    if (!nitro) p.nitroFuel = Math.min(1, p.nitroFuel + 0.04 * dt);
    const throttle = nitro ? 1 : clamp(input.throttle, 0, 1);
    const top = h.maxSpeed * (nitro ? h.nitroTop * (superOn ? SUPER_TOP : 1) : 1) * S.top;
    p.braking = false;
    if (!p.airborne) {
      if (brake > 0) {
        if (p.speed > 1) {
          p.braking = true;
          p.speed = Math.max(0, p.speed - h.brake * brake * dt);
          p.reverseHold = 0;
        } else {
          p.reverseHold += dt;
          if (p.reverseHold > 0.25) p.speed = Math.max(-h.reverseMax, p.speed - h.reverseAccel * brake * dt);
        }
      } else {
        p.reverseHold = 0;
        if (throttle > 0) {
          if (p.speed < 0) p.speed = Math.min(0, p.speed + h.brake * dt);
          else {
            const acc = h.accel * (nitro ? h.nitroAccel * (superOn ? 1.35 : 1) : 1) * throttle * (1 - 0.55 * Math.min(1, p.speed / top));
            if (p.speed < top) p.speed = Math.min(top, p.speed + acc * dt);
          }
        } else p.speed = approach(p.speed, 0, h.coastDecel * dt);
      }
      if (p.speed > top) p.speed = Math.max(top, p.speed - h.offroadDecel * 0.5 * dt);
      if (S.drag) p.speed -= p.speed * S.drag * dt;
    }

    // --- Turning and grip -------------------------------------------------
    let v = p.speed * MPU; // m/s
    const fx = Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    if (!p.airborne) {
      // Turn rate: needs some speed, eases off a little when going fast.
      const auth = clamp(Math.abs(v) / 6, 0, 1);
      const yawRate = p.steer * h.steerSpeed * 0.82 * auth * (1 / (1 + Math.abs(v) / 55)) * Math.sign(v || 1) * (nitro ? 0.9 : 1);
      p.yaw += yawRate * dt;
      // Sliding: hard turns at speed push the tail out; grip pulls it back.
      const grip = h.grip * S.grip * this.surfaceGrip * 0.55;
      p.latV += -yawRate * v * 0.12 * dt;
      p.latV *= Math.exp(-grip * dt);
      p.sliding = Math.abs(p.latV) > 2.2 && Math.abs(v) > 8;
      // Slopes: uphill costs speed, downhill adds some.
      const e = 1.5;
      const slope = (W.ground(p.x + fx * e, p.z + fz * e) - W.ground(p.x - fx * e, p.z - fz * e)) / (2 * e);
      p.speed -= slope * SLOPE_PULL * UNITS_PER_METRE * dt;
      v = p.speed * MPU;
    } else {
      // In the air: steering spins the car (a trick), momentum carries on.
      p.spinVel = approach(p.spinVel, p.steer * SPIN_RATE, SPIN_RATE * 4 * dt);
      p.spin += p.spinVel * dt;
    }

    // --- Move ---------------------------------------------------------------
    const rx = Math.cos(p.yaw);
    const rz = Math.sin(p.yaw);
    const nfx = Math.sin(p.yaw);
    const nfz = -Math.cos(p.yaw);
    p.x += (nfx * v + rx * p.latV) * dt;
    p.z += (nfz * v + rz * p.latV) * dt;

    // --- Ground, jumps and landings -------------------------------------
    const g = W.ground(p.x, p.z);
    if (p.airborne) {
      p.vy -= AIR_GRAVITY * dt;
      p.y += p.vy * dt;
      p.airTime += dt;
      if (p.y <= g) this.land(g);
    } else {
      // Follow the ground; leave it when it drops away faster than gravity
      // can pull the car down (cresting a hill at speed).
      const climb = (g - p.y) / dt;
      if (p.vy - climb > TAKEOFF && Math.abs(v) > 10) {
        p.airborne = true;
        p.airTime = 0;
        p.y += p.vy * dt;
      } else {
        p.vy = clamp(climb, -30, 30);
        p.y = g;
      }
    }
    p.air = Math.max(0, p.y - g);
    if (!p.airborne && (p.spin || p.roll)) {
      const k = Math.exp(-12 * dt);
      p.spin = Math.abs(p.spin) < 0.002 ? 0 : p.spin * k;
      p.roll = Math.abs(p.roll) < 0.002 ? 0 : p.roll * k;
    }

    // --- Sea: splash, then back to the last dry spot ---------------------
    if (!p.airborne && g < WATER - 0.6) {
      if (p.wet === 0) this.emit({ type: 'splash' });
      p.wet += dt;
      if (p.wet > 1.4) this.rescue();
    } else if (!p.airborne) {
      p.wet = 0;
      if (this.time - (p.safeAt ?? -10) > 1 && p.surface !== 'water' && W.ground(p.x + nfx * 12, p.z + nfz * 12) > WATER) {
        p.safeX = p.x;
        p.safeZ = p.z;
        p.safeYaw = p.yaw;
        p.safeAt = this.time;
      }
    }

    // --- Lean of the body on the ground (for the renderer) ---------------
    const L = 1.6;
    const pitch = Math.atan2(W.ground(p.x - nfx * L, p.z - nfz * L) - W.ground(p.x + nfx * L, p.z + nfz * L), 2 * L);
    const bank = Math.atan2(W.ground(p.x + rx, p.z + rz) - W.ground(p.x - rx, p.z - rz), 2);
    if (!p.airborne) {
      p.pitch += (pitch - p.pitch) * Math.min(1, dt * 12);
      p.bank += (bank - p.bank) * Math.min(1, dt * 12);
    }
    p.lapTime += dt;
    this.fun.step(dt);
  }

  land(g) {
    const p = this.player;
    const impact = -p.vy;
    p.y = g;
    p.vy = 0;
    p.airborne = false;
    // Little hops over bumps are not jumps.
    if (p.airTime > 0.25) {
      p.speed *= 0.985;
      this.emit({ type: 'land', airTime: p.airTime, strength: Math.min(1, impact / 14) });
      this.fun.onLand(p.airTime, Math.abs(p.spin), Math.abs(p.roll));
    }
    const turn = Math.PI * 2;
    p.spin -= Math.round(p.spin / turn) * turn;
    if (Math.abs(p.spin) > 0.6) p.speed *= 0.93;
    // Landing facing a new way: keep driving that way.
    p.yaw += p.spin;
    p.spin = 0;
    p.spinVel = 0;
  }

  /** Back on dry land, facing inland, after a dip in the sea. */
  rescue() {
    const p = this.player;
    p.x = p.prevX = p.safeX;
    p.z = p.prevZ = p.safeZ;
    p.yaw = p.prevYaw = p.safeYaw;
    p.y = p.prevY = this.world.ground(p.x, p.z);
    p.speed = this.car.handling.maxSpeed * 0.15;
    p.latV = 0;
    p.vy = 0;
    p.wet = 0;
    p.airborne = false;
    this.emit({ type: 'rescue' });
  }
}
