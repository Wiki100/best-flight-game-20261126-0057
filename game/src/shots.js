// The screenshot scenes behind ?shot=start|play|ring|end. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot that
// banks toward the next ring and climbs or dives to its altitude, so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.

import { STEP } from './config.js';
import { EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 400;
const SAMPLE = STEP;

/** Steering toward the next ring: bank to turn, pitch to meet its altitude. */
function autopilot(state) {
  const plane = state.plane;
  const ring = state.rings.find((r) => !r.passed);
  if (!ring) return { roll: 0, pitch: 0, throttle: -0.2 };
  const dx = ring.x - plane.x;
  const dz = Math.max(1, ring.z - plane.z);
  const wantHeading = Math.atan2(dx, dz);
  let headingError = wantHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 2.2 - plane.roll * 0.8));
  const altError = ring.alt - plane.alt;
  const pitch = Math.max(-1, Math.min(1, altError / 140 - plane.pitch * 1.2));
  const throttle = plane.speed < 68 ? 0.6 : plane.speed > 92 ? -0.6 : 0;
  return { roll, pitch, throttle };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'ring' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'ring' ? 60 : PLAY_SECONDS;
  let events = 0;
  let ringHold = 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    events = world.step(STEP, autopilot(world.state), false);
    if (name === 'ring' && world.state.ringsPassed >= 2) {
      // Hold three more seconds after the second ring, so the next ring is
      // close and large in frame instead of a speck on the horizon.
      ringHold += 1;
      if (ringHold >= 3 / STEP) break;
    }
    if (events & EVENT_WIN) break;
    if (world.state.status !== 'flying') break;
  }
  if (world.state.status === 'won') return { screen: SCREEN_WON, best: world.state.score };
  if (world.state.status === 'crashed') return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
