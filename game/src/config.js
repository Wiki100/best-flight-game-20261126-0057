// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Distances are metres, speeds metres per second; the HUD
// shows feet and knots, as a real cockpit would.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ridge-runner.best';

/** The aeroplane: how fast it turns, climbs and speeds up. */
export const PLANE = {
  minSpeed: 32,
  maxSpeed: 118,
  cruiseSpeed: 78,
  accel: 26,
  drag: 0.35,
  rollRate: 1.9,
  maxRoll: 1.15,
  pitchRate: 0.85,
  maxPitch: 0.42,
  turnRate: 0.55,
  stallSpeed: 38,
};

/** The course: eight golden rings down the valley, then the runway. */
export const COURSE = {
  ringCount: 8,
  ringRadius: 26,
  ringPoints: 100,
  landingPoints: 500,
  startAlt: 260,
  startSpeed: 62,
  startThrottle: 0.72,
  fuelSeconds: 240,
};

/** The runway at the end of the valley (world coordinates, metres). */
export const RUNWAY = {
  x: 0,
  zStart: 5050,
  zEnd: 5650,
  halfWidth: 22,
  heading: 0,
};

/** The valley's terrain: ridges either side of a flat river valley. */
export const TERRAIN = {
  valleyHalfWidth: 420,
  ridgeHeight: 520,
  hillHeight: 180,
  seaLevel: 0,
};

export const PALETTE = {
  backdrop: '#0a0e1a',
  skyTop: '#1d4e89',
  skyMid: '#6fa8d8',
  skyLow: '#cfe4f2',
  sun: '#ffd97a',
  sunGlow: 'rgba(255, 217, 122, 0.35)',
  cloud: 'rgba(255, 255, 255, 0.92)',
  cloudShade: 'rgba(210, 225, 240, 0.85)',
  mountainFar: '#7d8fb0',
  mountainMid: '#5d6f8e',
  mountainNear: '#43536e',
  snow: '#eef3f8',
  fieldGreen: '#5d8a4a',
  fieldLight: '#7fae5e',
  fieldGold: '#c2a55a',
  forest: '#2f5d33',
  river: '#3f7fb8',
  lake: '#4a90c4',
  runway: '#3a3f47',
  runwayLine: '#f2f2e8',
  ringNext: '#ffc233',
  ringNextGlow: 'rgba(255, 194, 51, 0.45)',
  ringDone: '#8a97a8',
  ringFar: '#b08d2e',
  planeBody: '#dfe6ee',
  planeBelly: '#8fa3b8',
  planeStripe: '#e5484d',
  planeGlass: '#1d3a5f',
  engineGlow: '#ff9a3c',
  panel: '#141a26',
  panelEdge: '#2c3648',
  hudText: '#eef4fa',
  hudDim: '#9fb2c8',
  hudAmber: '#ffb020',
  hudGreen: '#7ee787',
  hudRed: '#ff6b5e',
  title: '#ffffff',
  muted: '#aeb9cc',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
