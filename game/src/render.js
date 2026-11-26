// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. The view is a chase view: the aeroplane
// sits in frame over a projected 3D valley — fields, river, ridges, runway
// and golden rings — with a lit instrument panel and HUD over it.

import { COURSE, FIELD, FONT, PALETTE, RUNWAY } from './config.js';
import { createRandom, makeNoise2D } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

const FOCAL = 520;
const CX = FIELD.width / 2;
const CY = FIELD.height * 0.46;

/** Decor the renderer builds once from a fixed seed: clouds and field patches. */
function buildDecor() {
  const rand = createRandom(20261126);
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: (rand() - 0.5) * 5200,
      z: rand() * 6000,
      alt: 950 + rand() * 320,
      size: 90 + rand() * 170,
    });
  }
  const fields = [];
  const fieldNoise = makeNoise2D(777);
  for (let z = 0; z < 6000; z += 420) {
    for (let x = -2200; x < 2200; x += 440) {
      const n = fieldNoise(x / 900, z / 900);
      let color = PALETTE.fieldGreen;
      if (n > 0.45) color = PALETTE.fieldLight;
      else if (n > 0.2) color = PALETTE.fieldGold;
      else if (n < -0.5) color = PALETTE.forest;
      const riverX = -190 + 70 * Math.sin(z / 900);
      if (Math.abs(x - riverX) < 120) color = PALETTE.river;
      fields.push({ x, z, w: 440, d: 420, color });
    }
  }
  return { clouds, fields };
}

const DECOR = buildDecor();

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Project a world point into playfield pixels; null when behind the camera. */
  function project(state, wx, wy, wz) {
    const p = state.plane;
    const dx = wx - p.x;
    const dy = wy - p.alt;
    const dz = wz - p.z;
    const sinH = Math.sin(p.heading);
    const cosH = Math.cos(p.heading);
    const sinP = Math.sin(p.pitch);
    const cosP = Math.cos(p.pitch);
    // Camera basis: forward, right, up (up = forward x right).
    const fwd = dx * sinH * cosP + dy * sinP + dz * cosH * cosP;
    if (fwd < 8) return null;
    const right = dx * cosH - dz * sinH;
    const up = -dx * sinH * sinP + dy * cosP - dz * cosH * sinP;
    const sx = CX + (right / fwd) * FOCAL;
    const sy = CY - (up / fwd) * FOCAL;
    // Roll the picture around the centre, as the horizon does in a bank.
    const cosR = Math.cos(-p.roll);
    const sinR = Math.sin(-p.roll);
    const rx = CX + (sx - CX) * cosR - (sy - CY) * sinR;
    const ry = CY + (sx - CX) * sinR + (sy - CY) * cosR;
    return { x: rx, y: ry, depth: fwd, scale: FOCAL / fwd };
  }

  function drawSky(state) {
    const p = state.plane;
    const horizonY = CY - Math.tan(p.pitch) * FOCAL;
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.42, PALETTE.skyMid);
    grad.addColorStop(0.55, PALETTE.skyLow);
    grad.addColorStop(0.56, '#8a9a6a');
    grad.addColorStop(1, '#5d6a4a');
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The sun, fixed in the west, so it swings across the sky as you turn.
    const sunAngle = Math.PI * 0.72;
    const sunX = CX + Math.sin(sunAngle - p.heading) * 620;
    const sunY = horizonY - 150 - Math.cos(sunAngle - p.heading) * 40;
    if (sunX > -80 && sunX < FIELD.width + 80 && sunY > -80) {
      const glow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
      glow.addColorStop(0, PALETTE.sunGlow);
      glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(sunX, sunY, 90, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.sun;
      context.beginPath();
      context.arc(sunX, sunY, 26, 0, Math.PI * 2);
      context.fill();
    }
    // Clouds, projected as soft billboards far ahead.
    for (const cloud of DECOR.clouds) {
      const rel = ((cloud.z - p.z) % 6000 + 6000) % 6000;
      const pt = project(state, cloud.x, cloud.alt, p.z + rel);
      if (!pt || pt.depth < 200) continue;
      const s = cloud.size * pt.scale * 0.55;
      if (s < 4) continue;
      const glow = context.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, s);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      glow.addColorStop(0.7, 'rgba(255, 255, 255, 0.35)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.ellipse(pt.x, pt.y, s, s * 0.34, 0, 0, Math.PI * 2);
      context.fill();
    }
    return horizonY;
  }

  function drawRidge(state, zOffset, color, snowLine) {
    const p = state.plane;
    const z = p.z + zOffset;
    const points = [];
    for (let x = -3200; x <= 3200; x += 160) {
      const h = 120 + 260 * Math.abs(Math.sin(x * 0.0011 + zOffset * 0.004)) + 180 * Math.abs(Math.sin(x * 0.0027 - zOffset * 0.002));
      const pt = project(state, x, h, z);
      if (pt) points.push({ x: pt.x, y: pt.y, h });
    }
    if (points.length < 2) return;
    context.beginPath();
    context.moveTo(points[0].x, FIELD.height);
    context.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.lineTo(points[points.length - 1].x, FIELD.height);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    // Snow along the crest, only where the ridge is tall.
    context.strokeStyle = snowLine;
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.beginPath();
    let pen = false;
    for (let i = 0; i < points.length; i += 1) {
      if (points[i].h > 340) {
        if (!pen) {
          context.moveTo(points[i].x, points[i].y);
          pen = true;
        } else context.lineTo(points[i].x, points[i].y);
      } else pen = false;
    }
    context.stroke();
  }

  function drawGround(state, world, minDepth, maxDepth) {
    const p = state.plane;
    if (minDepth === 0) {
      // The ground base: everything below the horizon is land, not sky.
      const horizonY = CY - Math.tan(p.pitch) * FOCAL;
      context.fillStyle = '#6d7f56';
      context.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);
    }
    // Field patches in the depth band, far first so near ones overlap them.
    const quads = [];
    for (const f of DECOR.fields) {
      const dz = f.z - p.z;
      if (dz < Math.max(40, minDepth) || dz > maxDepth) continue;
      const corners = [
        project(state, f.x - f.w / 2, world.terrainAt(f.x - f.w / 2, f.z - f.d / 2) + 2, f.z - f.d / 2),
        project(state, f.x + f.w / 2, world.terrainAt(f.x + f.w / 2, f.z - f.d / 2) + 2, f.z - f.d / 2),
        project(state, f.x + f.w / 2, world.terrainAt(f.x + f.w / 2, f.z + f.d / 2) + 2, f.z + f.d / 2),
        project(state, f.x - f.w / 2, world.terrainAt(f.x - f.w / 2, f.z + f.d / 2) + 2, f.z + f.d / 2),
      ];
      if (corners.some((c) => c === null)) continue;
      quads.push({ depth: dz, corners, color: f.color });
    }
    quads.sort((a, b) => b.depth - a.depth);
    for (const q of quads) {
      context.fillStyle = q.color;
      context.beginPath();
      context.moveTo(q.corners[0].x, q.corners[0].y);
      for (let i = 1; i < 4; i += 1) context.lineTo(q.corners[i].x, q.corners[i].y);
      context.closePath();
      context.fill();
    }
  }

  function drawRunway(state) {
    const p = state.plane;
    const corners = [
      project(state, RUNWAY.x - RUNWAY.halfWidth, 24, RUNWAY.zStart),
      project(state, RUNWAY.x + RUNWAY.halfWidth, 24, RUNWAY.zStart),
      project(state, RUNWAY.x + RUNWAY.halfWidth, 24, RUNWAY.zEnd),
      project(state, RUNWAY.x - RUNWAY.halfWidth, 24, RUNWAY.zEnd),
    ];
    if (corners.some((c) => c === null)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) context.lineTo(corners[i].x, corners[i].y);
    context.closePath();
    context.fill();
    // Centreline dashes and the threshold bars.
    context.strokeStyle = PALETTE.runwayLine;
    context.lineWidth = 2;
    for (let z = RUNWAY.zStart + 40; z < RUNWAY.zEnd - 40; z += 80) {
      const a = project(state, RUNWAY.x, 25, z);
      const b = project(state, RUNWAY.x, 25, z + 40);
      if (!a || !b) continue;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    const near = project(state, RUNWAY.x, 25, RUNWAY.zStart + 30);
    if (near && near.depth < 1800) {
      text('27', near.x, near.y - 6, 18, PALETTE.runwayLine, 'center', true);
      text('RUNWAY 27', near.x, near.y + 22, 13, PALETTE.hudText, 'center');
    }
  }

  function drawRings(state) {
    const p = state.plane;
    const next = state.rings.find((r) => !r.passed) ?? null;
    for (const ring of state.rings) {
      const centre = project(state, ring.x, ring.alt, ring.z);
      if (!centre) continue;
      const radius = ring.radius * centre.scale;
      if (radius < 2 || radius > 900) continue;
      const isNext = ring === next;
      context.save();
      context.translate(centre.x, centre.y);
      context.rotate(-p.roll);
      context.beginPath();
      context.ellipse(0, 0, radius, radius * 0.92, 0, 0, Math.PI * 2);
      if (isNext) {
        context.shadowColor = PALETTE.ringNextGlow;
        context.shadowBlur = 18;
        context.strokeStyle = PALETTE.ringNext;
        context.lineWidth = Math.max(3, radius * 0.09);
      } else if (ring.passed) {
        context.strokeStyle = PALETTE.ringDone;
        context.lineWidth = 2;
      } else {
        context.strokeStyle = PALETTE.ringFar;
        context.lineWidth = Math.max(2, radius * 0.06);
      }
      context.stroke();
      context.restore();
      if (isNext) {
        text('NEXT RING', centre.x, centre.y - radius - 10, 15, PALETTE.ringNext, 'center', true);
      }
    }
    // An arrow at the screen edge when the next ring is out of frame.
    if (next) {
      const centre = project(state, next.x, next.alt, next.z);
      if (centre && (centre.x < 40 || centre.x > FIELD.width - 40 || centre.y < 80 || centre.y > FIELD.height - 160)) {
        const ax = Math.max(60, Math.min(FIELD.width - 60, centre.x));
        const ay = Math.max(110, Math.min(FIELD.height - 180, centre.y));
        context.fillStyle = PALETTE.ringNext;
        context.beginPath();
        context.moveTo(ax, ay - 14);
        context.lineTo(ax + 12, ay + 8);
        context.lineTo(ax - 12, ay + 8);
        context.closePath();
        context.fill();
        text('RING', ax, ay + 26, 13, PALETTE.ringNext, 'center', true);
      }
    }
  }

  function drawPlane(state) {
    const p = state.plane;
    const px = CX;
    const py = FIELD.height * 0.62 + p.pitch * 120;
    context.save();
    context.translate(px, py);
    context.rotate(p.roll * 0.9);
    // Wings, seen from behind, with small tailplanes below them.
    context.fillStyle = '#b9c6d6';
    context.beginPath();
    context.moveTo(-58, 22);
    context.lineTo(-24, 16);
    context.lineTo(-22, 24);
    context.lineTo(-52, 30);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(58, 22);
    context.lineTo(24, 16);
    context.lineTo(22, 24);
    context.lineTo(52, 30);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-150, 6);
    context.lineTo(-34, -6);
    context.lineTo(-30, 10);
    context.lineTo(-140, 26);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(150, 6);
    context.lineTo(34, -6);
    context.lineTo(30, 10);
    context.lineTo(140, 26);
    context.closePath();
    context.fill();
    // Wingtip nav lights.
    context.fillStyle = '#ff5a4e';
    context.beginPath();
    context.arc(-148, 12, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#4ade80';
    context.beginPath();
    context.arc(148, 12, 5, 0, Math.PI * 2);
    context.fill();
    // Tail fin and fuselage, rear view.
    context.fillStyle = PALETTE.planeStripe;
    context.beginPath();
    context.moveTo(0, -52);
    context.lineTo(-10, -8);
    context.lineTo(10, -8);
    context.closePath();
    context.fill();
    const body = context.createLinearGradient(0, -30, 0, 30);
    body.addColorStop(0, PALETTE.planeBody);
    body.addColorStop(1, PALETTE.planeBelly);
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2);
    context.fill();
    // Canopy, seen over the nose.
    context.fillStyle = PALETTE.planeGlass;
    context.beginPath();
    context.ellipse(0, -14, 16, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Engine glow.
    const glow = context.createRadialGradient(0, 14, 2, 0, 14, 26);
    glow.addColorStop(0, PALETTE.engineGlow);
    glow.addColorStop(1, 'rgba(255, 154, 60, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 14, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2a2f38';
    context.beginPath();
    context.arc(-12, 16, 7, 0, Math.PI * 2);
    context.arc(12, 16, 7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawCockpitFrame(state) {
    const p = state.plane;
    // Canopy struts and a dark vignette, so the view reads as a cockpit.
    context.strokeStyle = 'rgba(10, 14, 26, 0.5)';
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(FIELD.width * 0.28, FIELD.height * 0.42);
    context.moveTo(FIELD.width, 0);
    context.lineTo(FIELD.width * 0.72, FIELD.height * 0.42);
    context.stroke();
    const vignette = context.createRadialGradient(CX, FIELD.height / 2, FIELD.height * 0.42, CX, FIELD.height / 2, FIELD.height * 0.85);
    vignette.addColorStop(0, 'rgba(10, 14, 26, 0)');
    vignette.addColorStop(1, 'rgba(10, 14, 26, 0.55)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawCompass(state) {
    const p = state.plane;
    const headingDeg = Math.round(((p.heading * 180) / Math.PI + 360) % 360);
    context.fillStyle = 'rgba(10, 14, 26, 0.72)';
    context.fillRect(CX - 190, 56, 380, 34);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(CX - 190, 56, 380, 34);
    for (let d = -60; d <= 60; d += 15) {
      const deg = (headingDeg + d + 360) % 360;
      const x = CX + d * 3;
      const label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][deg / 90] : String(deg).padStart(3, '0');
      text(label, x, 82, deg % 90 === 0 ? 15 : 12, deg === headingDeg ? PALETTE.hudAmber : PALETTE.hudText, 'center', deg % 90 === 0);
    }
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(CX, 56);
    context.lineTo(CX - 6, 46);
    context.lineTo(CX + 6, 46);
    context.closePath();
    context.fill();
  }

  function drawHud(state, screen) {
    const p = state.plane;
    const altFt = Math.round(p.alt * 3.28084);
    const speedKt = Math.round(p.speed * 1.94384);
    const headingDeg = Math.round(((p.heading * 180) / Math.PI + 360) % 360);
    const vsFpm = Math.round(p.speed * Math.sin(p.pitch) * 196.85);
    // Top bar.
    context.fillStyle = 'rgba(10, 14, 26, 0.72)';
    context.fillRect(0, 0, FIELD.width, 48);
    text('ALT', 24, 20, 13, PALETTE.hudDim, 'left');
    text(`${altFt.toLocaleString()} ft`, 24, 42, 22, PALETTE.hudText, 'left', true);
    text('SPD', 190, 20, 13, PALETTE.hudDim, 'left');
    text(`${speedKt} kt`, 190, 42, 22, PALETTE.hudText, 'left', true);
    text('HDG', 340, 20, 13, PALETTE.hudDim, 'left');
    text(`${String(headingDeg).padStart(3, '0')}°`, 340, 42, 22, PALETTE.hudText, 'left', true);
    text('V/S', 470, 20, 13, PALETTE.hudDim, 'left');
    text(`${vsFpm >= 0 ? '+' : ''}${vsFpm} fpm`, 470, 42, 20, vsFpm < -500 ? PALETTE.hudRed : PALETTE.hudText, 'left', true);
    drawCompass(state);
    text('SCORE', FIELD.width - 320, 20, 13, PALETTE.hudDim, 'left');
    text(String(state.score), FIELD.width - 320, 42, 22, PALETTE.hudText, 'left', true);
    text(`RING ${state.ringsPassed}/${COURSE.ringCount}`, FIELD.width - 190, 20, 13, PALETTE.hudDim, 'left');
    text(`TIME ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, FIELD.width - 190, 42, 18, PALETTE.hudText, 'left', true);
    // Throttle and fuel, bottom right.
    const thrW = 150;
    context.fillStyle = 'rgba(10, 14, 26, 0.72)';
    context.fillRect(FIELD.width - thrW - 24, FIELD.height - 92, thrW + 16, 68);
    text('THR', FIELD.width - thrW - 12, FIELD.height - 68, 13, PALETTE.hudDim, 'left');
    context.fillStyle = '#22303f';
    context.fillRect(FIELD.width - thrW - 12, FIELD.height - 58, thrW, 12);
    context.fillStyle = p.throttle > 0.85 ? PALETTE.hudAmber : PALETTE.hudGreen;
    context.fillRect(FIELD.width - thrW - 12, FIELD.height - 58, thrW * p.throttle, 12);
    text(`${Math.round(p.throttle * 100)}%`, FIELD.width - 24, FIELD.height - 46, 14, PALETTE.hudText, 'right');
    text(`FUEL ${Math.floor(p.fuel)}s`, FIELD.width - thrW - 12, FIELD.height - 28, 13, p.fuel < 30 ? PALETTE.hudRed : PALETTE.hudText, 'left');
    // Artificial horizon, bottom left — the instrument is lit.
    const hx = 92;
    const hy = FIELD.height - 62;
    const hr = 44;
    context.save();
    context.beginPath();
    context.arc(hx, hy, hr, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#2f6fb2';
    context.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    context.save();
    context.translate(hx, hy);
    context.rotate(-p.roll);
    context.translate(0, p.pitch * 90);
    context.fillStyle = '#7a5a34';
    context.fillRect(-hr, 0, hr * 2, hr);
    context.fillStyle = '#eef4fa';
    context.fillRect(-hr, -2, hr * 2, 4);
    context.restore();
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(hx, hy, hr, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.hudAmber;
    context.fillRect(hx - 16, hy - 2, 32, 4);
    text('ATT', hx, hy + hr + 16, 11, PALETTE.hudDim, 'center');
    if (state.messageTimer > 0) {
      context.fillStyle = 'rgba(10, 14, 26, 0.78)';
      const w = 460;
      context.fillRect(CX - w / 2, 108, w, 40);
      text(state.message, CX, 135, 20, PALETTE.hudAmber, 'center', true);
    }
    if (screen === SCREEN_PLAY && p.fuel < 30) {
      text('LOW FUEL', CX, 170, 18, PALETTE.hudRed, 'center', true);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * 34 + 64;
    const width = 640;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 14, 26, 0.82)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 66, 44, PALETTE.title, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 122 + index * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, accent ?? PALETTE.hudAmber, 'center', true);
  }

  /** Paint one frame: the valley, the plane, the HUD, then a panel for the screen. */
  function draw(state, world, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state);
    drawRidge(state, 4200, PALETTE.mountainFar, PALETTE.snow);
    drawRidge(state, 2600, PALETTE.mountainMid, PALETTE.snow);
    drawGround(state, world, 1500, 5600);
    drawRidge(state, 1500, PALETTE.mountainNear, PALETTE.snow);
    drawGround(state, world, 0, 1500);
    drawRunway(state);
    drawRings(state);
    drawPlane(state);
    drawCockpitFrame(state);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'RIDGE RUNNER',
        ['Fly the alpine valley. Thread all 8 golden rings,', 'then land on runway 27. Watch the terrain —', 'the ridges are higher than they look.', `Best score: ${best}`, ''],
        'Press Space or click to fly',
      );
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The valley will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'Crashed',
        [state.crashReason || 'The flight is over.', `Score ${state.score} — rings ${state.ringsPassed} of ${COURSE.ringCount}`, `Best ${best}`],
        'Press Space or click to fly again',
        PALETTE.hudRed,
      );
    } else if (screen === SCREEN_WON) {
      drawPanel(
        state.landed ? 'Landed on runway 27!' : 'Course complete!',
        [`Score ${state.score} — rings ${state.ringsPassed} of ${COURSE.ringCount}`, `Time ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')} — best ${best}`, state.landed ? 'A textbook touchdown.' : 'All eight rings, clean through.'],
        'Press Space or click to fly again',
        PALETTE.hudGreen,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
