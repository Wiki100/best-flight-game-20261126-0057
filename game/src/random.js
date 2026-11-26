// A small deterministic random source: mulberry32, so one seed always builds
// the same valley, the same rings and the same clouds.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 1D value-noise function from a seed: smooth, repeatable, -1..1. */
export function makeNoise(seed) {
  const rand = createRandom(seed);
  const table = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) table[i] = rand() * 2 - 1;
  const at = (i) => table[((i % 256) + 256) % 256];
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    return at(i) * (1 - smooth(f)) + at(i + 1) * smooth(f);
  };
}

/** A 2D value-noise function from a seed: smooth, repeatable, -1..1. */
export function makeNoise2D(seed) {
  const rand = createRandom(seed);
  const table = new Float64Array(256 * 256);
  for (let i = 0; i < table.length; i += 1) table[i] = rand() * 2 - 1;
  const at = (x, y) => table[(((x % 256) + 256) % 256) * 256 + (((y % 256) + 256) % 256)];
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = smooth(fx);
    const sy = smooth(fy);
    const a = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const b = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
}
