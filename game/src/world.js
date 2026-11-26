// The game's rules and state, with no drawing and no browser in it: the
// aeroplane, the valley, the eight rings and the runway, the physics, the
// collisions, the score. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.

import { COURSE, PLANE, RUNWAY, TERRAIN } from './config.js';
import { makeNoise, makeNoise2D } from './random.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_WIN = 4;
export const EVENT_LAND = 8;
export const EVENT_FUEL_LOW = 16;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createWorld(random) {
  const seed = Math.floor(random() * 4294967296);
  const ridgeNoise = makeNoise2D(seed ^ 0x51ab);
  const hillNoise = makeNoise2D(seed ^ 0x9e37);
  const fieldNoise = makeNoise(seed ^ 0x1234);

  /** The valley floor and its ridges, in metres above sea level. */
  function terrainAt(x, z) {
    const away = Math.abs(x);
    const ridge = smoothstep(TERRAIN.valleyHalfWidth, 1500, away);
    let h = 18 + 10 * fieldNoise(z / 700);
    h += ridge * TERRAIN.ridgeHeight * (0.55 + 0.45 * ridgeNoise(x / 900, z / 900));
    h += (1 - ridge) * TERRAIN.hillHeight * Math.max(0, hillNoise(x / 260, z / 260));
    // The river carves a low channel down the west side of the valley.
    const riverX = -190 + 70 * Math.sin(z / 900);
    const riverD = Math.abs(x - riverX);
    if (riverD < 60) h -= (1 - riverD / 60) * 14;
    // The runway sits on a flattened apron.
    const apron = smoothstep(240, 60, Math.abs(x - RUNWAY.x)) * smoothstep(4700, 4950, z) * (1 - smoothstep(5750, 6000, z));
    return h * (1 - apron) + 22 * apron;
  }

  /** The eight rings, winding down the valley toward the runway. */
  function buildRings() {
    const rings = [];
    for (let i = 0; i < COURSE.ringCount; i += 1) {
      const z = 650 + i * 560;
      const x = 300 * Math.sin(i * 0.9 + 0.4) + 60 * Math.sin(i * 2.3);
      const ground = terrainAt(x, z);
      const alt = Math.max(ground + 130, 250 + 120 * Math.sin(i * 1.1 + 0.5));
      rings.push({ x, z, alt, radius: COURSE.ringRadius, passed: false });
    }
    return rings;
  }

  const plane = {
    x: 0,
    z: -120,
    alt: COURSE.startAlt,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: COURSE.startSpeed,
    throttle: COURSE.startThrottle,
    fuel: COURSE.fuelSeconds,
  };
  const rings = buildRings();
  const state = {
    plane,
    rings,
    score: 0,
    ringsPassed: 0,
    time: 0,
    fuel: COURSE.fuelSeconds,
    status: 'flying',
    message: '',
    messageTimer: 0,
    landed: false,
    won: false,
    crashed: false,
    crashReason: '',
    bestRing: 0,
  };

  function reset() {
    plane.x = 0;
    plane.z = -120;
    plane.alt = COURSE.startAlt;
    plane.heading = 0;
    plane.pitch = 0;
    plane.roll = 0;
    plane.speed = COURSE.startSpeed;
    plane.throttle = COURSE.startThrottle;
    plane.fuel = COURSE.fuelSeconds;
    for (const ring of rings) ring.passed = false;
    state.score = 0;
    state.ringsPassed = 0;
    state.time = 0;
    state.fuel = COURSE.fuelSeconds;
    state.status = 'flying';
    state.message = '';
    state.messageTimer = 0;
    state.landed = false;
    state.won = false;
    state.crashed = false;
    state.crashReason = '';
    state.bestRing = 0;
  }

  function nextRing() {
    for (const ring of rings) if (!ring.passed) return ring;
    return null;
  }

  /**
   * One fixed step. controls: { roll -1..1, pitch -1..1, throttle -1..1 }.
   * With `harmless` set (the title screen's backdrop) the plane flies on but
   * nothing scores and nothing crashes.
   */
  function step(dt, controls, harmless) {
    if (state.status !== 'flying' && !harmless) return 0;
    let events = 0;
    const prevZ = plane.z;
    const prevAlt = plane.alt;
    state.time += dt;

    // Throttle, speed and the climb.
    plane.throttle = clamp(plane.throttle + controls.throttle * dt * 0.55, 0, 1);
    if (plane.fuel <= 0) plane.throttle = 0;
    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += clamp(targetSpeed - plane.speed, -PLANE.accel * dt, PLANE.accel * dt);
    plane.speed -= Math.sin(plane.pitch) * 16 * dt;
    plane.speed -= plane.speed * PLANE.drag * 0.02 * dt;
    plane.speed = clamp(plane.speed, 18, PLANE.maxSpeed + 10);

    // Roll and pitch, with a gentle auto-level when the stick is centred.
    plane.roll = clamp(plane.roll + controls.roll * PLANE.rollRate * dt, -PLANE.maxRoll, PLANE.maxRoll);
    if (controls.roll === 0) plane.roll *= Math.max(0, 1 - 1.1 * dt);
    plane.pitch = clamp(plane.pitch + controls.pitch * PLANE.pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
    if (controls.pitch === 0) plane.pitch *= Math.max(0, 1 - 0.6 * dt);

    // A banked turn: roll right, heading turns right.
    plane.heading += plane.roll * PLANE.turnRate * (plane.speed / PLANE.cruiseSpeed) * dt;
    plane.heading = ((plane.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    const verticalSpeed = plane.speed * Math.sin(plane.pitch);
    plane.alt += verticalSpeed * dt;
    if (plane.speed < PLANE.stallSpeed) plane.alt -= (PLANE.stallSpeed - plane.speed) * 0.45 * dt;
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.z += Math.cos(plane.heading) * plane.speed * dt;
    plane.fuel = Math.max(0, plane.fuel - dt);
    state.fuel = plane.fuel;

    if (plane.fuel <= 30 && plane.fuel > 0 && !harmless) {
      if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) events |= EVENT_FUEL_LOW;
    }

    // Rings: the plane crosses a ring's plane while inside its circle.
    const ring = nextRing();
    if (ring !== null && prevZ < ring.z && plane.z >= ring.z) {
      const t = (ring.z - prevZ) / Math.max(0.001, plane.z - prevZ);
      const xAt = plane.x - Math.sin(plane.heading) * plane.speed * dt * (1 - t);
      const altAt = prevAlt + (plane.alt - prevAlt) * t;
      const dx = xAt - ring.x;
      const dy = altAt - ring.alt;
      if (dx * dx + dy * dy <= ring.radius * ring.radius) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.bestRing = state.ringsPassed;
        state.score += COURSE.ringPoints;
        state.message = `Ring ${state.ringsPassed} of ${COURSE.ringCount} — +${COURSE.ringPoints}`;
        state.messageTimer = 2.2;
        events |= EVENT_RING;
        if (state.ringsPassed === COURSE.ringCount && !harmless) {
          state.won = true;
          state.status = 'won';
          const bonus = Math.max(0, Math.round((180 - state.time) * 5));
          state.score += bonus;
          state.message = `Course complete! Time bonus +${bonus}`;
          state.messageTimer = 4;
          events |= EVENT_WIN;
          return events;
        }
      }
    }

    if (state.messageTimer > 0) state.messageTimer -= dt;

    // The ground, the runway and the edge of the world.
    const ground = terrainAt(plane.x, plane.z);
    const onRunway =
      Math.abs(plane.x - RUNWAY.x) < RUNWAY.halfWidth &&
      plane.z >= RUNWAY.zStart &&
      plane.z <= RUNWAY.zEnd;
    if (!harmless && plane.alt <= ground + 4) {
      if (onRunway && state.ringsPassed === COURSE.ringCount && verticalSpeed > -4 && plane.speed < 68) {
        state.landed = true;
        state.status = 'won';
        state.score += COURSE.landingPoints;
        state.message = `Landed on runway 27 — +${COURSE.landingPoints}`;
        state.messageTimer = 4;
        events |= EVENT_LAND | EVENT_WIN;
        return events;
      }
      state.crashed = true;
      state.status = 'crashed';
      state.crashReason = onRunway ? 'Hard landing on the runway' : 'Crashed into the terrain';
      events |= EVENT_CRASH;
      return events;
    }
    if (!harmless && (Math.abs(plane.x) > 2600 || plane.z > 6300 || plane.z < -400)) {
      state.crashed = true;
      state.status = 'crashed';
      state.crashReason = 'Flew out of the valley';
      events |= EVENT_CRASH;
      return events;
    }
    if (plane.alt > 1400) plane.alt = 1400;
    return events;
  }

  reset();
  return { state, plane, rings, reset, step, terrainAt, nextRing };
}
