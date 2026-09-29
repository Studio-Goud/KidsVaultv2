/**
 * The machines and places of the space story, drawn in code.
 *
 * Same contract as `beasts.ts` and `seaart.ts`: `(x, y)` is the screen point a thing stands on (or
 * its middle, for things that float), `s` is pixels per metre at its distance, and the sizes are the
 * real ones. The rocket is about as tall as a fifteen-storey block, the space station is as wide as
 * a football pitch, the Apollo lander is a little taller than a grown-up standing on another's
 * shoulders, and the tube of Mars rock is as long as a pencil - which is why you have to look for it.
 *
 * The planets themselves are photographs (`src/platform/planetphoto.ts`). What is drawn here is
 * what no photograph could show a child from where they are sitting: the curve of the Earth under
 * you, the ice of the rings coming at you, the inside of the capsule.
 */

import { hexA, shade } from '../render/look';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

// ---------------------------------------------------------------- the rocket on its pad

/**
 * A two-stage rocket with its crew capsule on top, standing beside the steel tower that holds it
 * until launch. About 60 metres tall, white with a black band at each joint, the way most real
 * rockets are painted: white keeps the cold fuel cold. (x, y) is the foot of the pad.
 */
export function drawRocketOnPad(ctx: Ctx, x: number, y: number, s: number, t: number, steam: number): void {
  const H = 60, R = 2.2;
  ctx.save();
  ctx.translate(x, y);
  // the concrete pad and the flame trench
  ctx.fillStyle = '#9d9a92';
  ctx.fillRect(-18 * s, -2 * s, 36 * s, 2 * s);
  ctx.fillStyle = '#6f6c66';
  ctx.fillRect(-18 * s, -2.4 * s, 36 * s, 0.4 * s);
  // the tower: a lattice of red steel beside the rocket
  const tx = 6.5 * s, tw = 4.5 * s, th = (H + 6) * s;
  ctx.strokeStyle = '#a8412f';
  ctx.lineWidth = Math.max(1, 0.35 * s);
  ctx.strokeRect(tx, -th, tw, th - 2 * s);
  ctx.beginPath();
  for (let k = 0; k < 22; k++) {
    const y0 = -2 * s - (k * (th - 2 * s)) / 22, y1 = -2 * s - ((k + 1) * (th - 2 * s)) / 22;
    ctx.moveTo(tx, y0); ctx.lineTo(tx + tw, y1);
    ctx.moveTo(tx + tw, y0); ctx.lineTo(tx, y1);
  }
  ctx.stroke();
  // the arms that reach across to the rocket, and the walkway to the capsule
  ctx.fillStyle = '#7d2f22';
  for (const hy of [0.25, 0.55, 0.9]) ctx.fillRect(R * s, -H * hy * s - 0.5 * s, tx - R * s, 0.9 * s);
  // the rocket: first stage, second stage, capsule, escape tower
  const body = ctx.createLinearGradient(-R * s, 0, R * s, 0);
  body.addColorStop(0, '#b9bec4'); body.addColorStop(0.35, '#ffffff'); body.addColorStop(0.7, '#e6e9ec'); body.addColorStop(1, '#9fa6ad');
  ctx.fillStyle = body;
  ctx.fillRect(-R * s, -44 * s, 2 * R * s, 42 * s);
  ctx.fillRect(-R * 0.85 * s, -54 * s, 2 * R * 0.85 * s, 10.5 * s);
  // the black bands at the joints and the engines' skirt
  ctx.fillStyle = '#23262b';
  ctx.fillRect(-R * s, -44.6 * s, 2 * R * s, 1.1 * s);
  ctx.fillRect(-R * s, -24 * s, 2 * R * s, 0.8 * s);
  ctx.beginPath(); ctx.moveTo(-R * s, -2 * s); ctx.lineTo(-R * 1.25 * s, 0); ctx.lineTo(R * 1.25 * s, 0); ctx.lineTo(R * s, -2 * s); ctx.fill();
  // the capsule, a cone with a window, and the needle of the escape tower above it
  const cap = ctx.createLinearGradient(-R * s, 0, R * s, 0);
  cap.addColorStop(0, '#8e959c'); cap.addColorStop(0.4, '#f4f6f8'); cap.addColorStop(1, '#7c838a');
  ctx.fillStyle = cap;
  ctx.beginPath(); ctx.moveTo(-R * 0.85 * s, -54 * s); ctx.lineTo(-R * 0.35 * s, -58 * s); ctx.lineTo(R * 0.35 * s, -58 * s); ctx.lineTo(R * 0.85 * s, -54 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#20364b';
  ctx.beginPath(); ctx.arc(-0.3 * s, -56 * s, 0.35 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5c6268'; ctx.lineWidth = Math.max(1, 0.3 * s);
  ctx.beginPath(); ctx.moveTo(0, -58 * s); ctx.lineTo(0, -62 * s); ctx.stroke();
  // the name down the side, as a stripe of colour a child can recognise from far away
  ctx.fillStyle = '#e8743b';
  ctx.fillRect(-R * s, -36 * s, 2 * R * s, 1.4 * s);
  // steam from the cold fuel, drifting off the side
  if (steam > 0) {
    for (let i = 0; i < 10; i++) {
      const k = (t * 0.15 + hash(i, 3)) % 1;
      const px = (R + k * 9) * s * (i % 2 ? 1 : -1), py = -(8 + hash(i, 5) * 34) * s - k * 3 * s;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - k) * steam})`;
      ctx.beginPath(); ctx.arc(px, py, (1 + k * 3) * s, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the space station

/**
 * The International Space Station seen from the side, a little below: the long truss with the
 * four pairs of big solar wings, the white modules crossing it in the middle, and the radiators.
 * `r` is half its width in pixels (the real one is about 109 m across).
 */
export function drawISS(ctx: Ctx, x: number, y: number, r: number, t: number, sunSide: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.05) * 0.04);
  const k = r / 55;
  // solar wings: eight long gold-brown panels, in four pairs along the truss
  for (const px of [-44, -30, 30, 44]) {
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(0, side * 3 * k, 0, side * 36 * k);
      g.addColorStop(0, '#6b4c21'); g.addColorStop(0.5, sunSide > 0 ? '#c79a4a' : '#8a6a33'); g.addColorStop(1, '#5a3f1b');
      ctx.fillStyle = g;
      ctx.fillRect((px - 5) * k, side > 0 ? 3 * k : -36 * k, 10 * k, 33 * k);
      ctx.strokeStyle = 'rgba(30, 20, 10, 0.6)'; ctx.lineWidth = Math.max(0.5, 0.4 * k);
      for (let c = 1; c < 12; c++) { const yy = side > 0 ? (3 + c * 2.75) * k : (-36 + c * 2.75) * k; ctx.beginPath(); ctx.moveTo((px - 5) * k, yy); ctx.lineTo((px + 5) * k, yy); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(px * k, side * 3 * k); ctx.lineTo(px * k, side * 36 * k); ctx.stroke();
    }
  }
  // the truss: a long grey girder
  ctx.fillStyle = '#9aa1a8';
  ctx.fillRect(-52 * k, -2 * k, 104 * k, 4 * k);
  ctx.strokeStyle = '#6d747b'; ctx.lineWidth = Math.max(0.5, 0.5 * k);
  for (let i = -52; i < 52; i += 3) { ctx.beginPath(); ctx.moveTo(i * k, -2 * k); ctx.lineTo((i + 3) * k, 2 * k); ctx.stroke(); }
  // white radiators sticking down from the middle
  ctx.fillStyle = '#e8ecef';
  for (const px of [-16, -10, 10, 16]) ctx.fillRect((px - 2) * k, 2 * k, 4 * k, 14 * k);
  // the modules: white cylinders crossing the truss
  const mod = (x0: number, y0: number, w: number, h: number): void => {
    const g = ctx.createLinearGradient(0, y0 * k, 0, (y0 + h) * k);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#d9dee2'); g.addColorStop(1, '#9ba3aa');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x0 * k, y0 * k, w * k, h * k, Math.min(w, h) * 0.45 * k); ctx.fill();
  };
  mod(-4, -26, 8, 24);
  mod(-4, 2, 8, 22);
  mod(-14, -6, 28, 6);
  mod(4, -22, 12, 6);
  // the robot arm folded along a module, and a docked capsule at the front
  ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = Math.max(1, 1 * k);
  ctx.beginPath(); ctx.moveTo(-3 * k, -20 * k); ctx.lineTo(-12 * k, -14 * k); ctx.lineTo(-10 * k, -8 * k); ctx.stroke();
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.moveTo(-3 * k, -26 * k); ctx.lineTo(3 * k, -26 * k); ctx.lineTo(2 * k, -31 * k); ctx.lineTo(-2 * k, -31 * k); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the Moon

/**
 * The bottom half of the Apollo lunar module, the part that stayed behind when the astronauts took
 * off again: an eight-sided box wrapped in gold foil, four legs with round feet, and the ladder
 * they climbed down. About 4 m across the feet and 3 m tall. (x, y) is the ground under the middle.
 */
export function drawLander(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  // its shadow, long and sharp, because there is no air to soften it
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(1.6 * s, 0, 3.6 * s, 0.35 * s, 0, 0, TAU); ctx.fill();
  // legs, splayed out, with their round feet
  ctx.strokeStyle = '#c7c9c4'; ctx.lineWidth = Math.max(1, 0.12 * s); ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 1.1 * s, -1.9 * s); ctx.lineTo(side * 2.1 * s, -0.1 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(side * 0.9 * s, -1.4 * s); ctx.lineTo(side * 2.1 * s, -0.4 * s); ctx.stroke();
    ctx.fillStyle = '#b7b8b2';
    ctx.beginPath(); ctx.ellipse(side * 2.1 * s, 0, 0.45 * s, 0.12 * s, 0, 0, TAU); ctx.fill();
  }
  // the box, in crinkled gold foil
  const foil = ctx.createLinearGradient(-1.3 * s, 0, 1.3 * s, 0);
  foil.addColorStop(0, '#8a6313'); foil.addColorStop(0.3, '#f1c75a'); foil.addColorStop(0.55, '#c8931f'); foil.addColorStop(1, '#6c4c0e');
  ctx.fillStyle = foil;
  ctx.beginPath();
  ctx.moveTo(-1.4 * s, -1.2 * s); ctx.lineTo(-1.1 * s, -2.9 * s); ctx.lineTo(1.1 * s, -2.9 * s); ctx.lineTo(1.4 * s, -1.2 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.5)'; ctx.lineWidth = Math.max(0.5, 0.03 * s);
  for (let i = 0; i < 9; i++) {
    const px = (-1.2 + hash(i, 7) * 2.4) * s, py = (-2.8 + hash(i, 9) * 1.5) * s;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 0.3 * s, py + 0.2 * s); ctx.stroke();
  }
  // the flat top where the part that flew home sat
  ctx.fillStyle = '#5b5d5f';
  ctx.fillRect(-1.15 * s, -3.05 * s, 2.3 * s, 0.18 * s);
  // the ladder down the front leg
  ctx.strokeStyle = '#d8d9d4'; ctx.lineWidth = Math.max(0.5, 0.05 * s);
  ctx.beginPath(); ctx.moveTo(-0.25 * s, -1.2 * s); ctx.lineTo(-0.35 * s, -0.1 * s); ctx.moveTo(0.25 * s, -1.2 * s); ctx.lineTo(0.35 * s, -0.1 * s);
  for (let i = 1; i < 5; i++) { const yy = (-1.2 + i * 0.22) * s; ctx.moveTo(-0.28 * s, yy); ctx.lineTo(0.28 * s, yy); }
  ctx.stroke();
  // the glint of the sun on the foil
  ctx.fillStyle = `rgba(255, 250, 220, ${0.35 + 0.2 * Math.sin(t * 1.3)})`;
  ctx.beginPath(); ctx.ellipse(-0.6 * s, -2.3 * s, 0.25 * s, 0.1 * s, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

/** A bootprint in the grey dust: the ridged sole of an Apollo moon boot, about 33 cm long. */
export function drawBootprint(ctx: Ctx, x: number, y: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.32);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(40, 40, 42, 0.45)';
  ctx.beginPath(); ctx.ellipse(0, 0, 0.08 * s, 0.17 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.35)'; ctx.lineWidth = Math.max(0.5, 0.012 * s);
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-0.07 * s, i * 0.045 * s); ctx.lineTo(0.07 * s, i * 0.045 * s); ctx.stroke(); }
  ctx.restore();
}

/** A crater lying on the ground in perspective: a dark bowl with a bright rim towards the sun. */
export function drawCrater(ctx: Ctx, x: number, y: number, s: number, r: number, ground: string): void {
  const rx = r * s, ry = r * s * 0.22;
  ctx.save();
  ctx.fillStyle = shade(ground, -0.18);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(ground, -0.35);
  ctx.beginPath(); ctx.ellipse(x - rx * 0.12, y + ry * 0.05, rx * 0.8, ry * 0.7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(ground, 0.22);
  ctx.lineWidth = Math.max(1, r * s * 0.07);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.05, Math.PI * 1.05); ctx.stroke();
  ctx.strokeStyle = hexA('#000000', 0.25);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
}

/** A stone on the ground, lit from one side, in the colour of the place: grey Moon, rusty Mars. */
export function drawStone(ctx: Ctx, x: number, y: number, s: number, size: number, seed: number, colour: string): void {
  const r = size * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.5, y, r * 1.2, r * 0.22, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y);
  g.addColorStop(0, shade(colour, 0.25)); g.addColorStop(1, shade(colour, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const k = 0.75 + hash(i, seed) * 0.35;
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * 0.75 * k;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Mars

/**
 * One of the sample tubes Perseverance left at Three Forks: a sealed titanium tube about as long as
 * a pencil, lying on the red ground and catching the light.
 */
export function drawTube(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  const L = 0.2 * s, R = Math.max(1.5, 0.018 * s);
  ctx.fillStyle = 'rgba(40, 10, 0, 0.35)';
  ctx.beginPath(); ctx.ellipse(0.02 * s, R * 0.8, L * 0.6, R * 0.6, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c9ccd0'); g.addColorStop(1, '#7c8187');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-L / 2, -R, L, 2 * R, R); ctx.fill();
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(L / 2 - L * 0.18, -R, L * 0.06, 2 * R);
  // the glint that makes it findable from far off
  const k = 0.5 + 0.5 * Math.sin(t * 3);
  const gl = ctx.createRadialGradient(-L * 0.15, -R * 0.4, 0, -L * 0.15, -R * 0.4, Math.max(8, L * 0.5));
  gl.addColorStop(0, `rgba(255,255,240,${0.9 * k})`); gl.addColorStop(1, 'rgba(255,255,240,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(-L * 0.15, -R * 0.4, Math.max(8, L * 0.5), 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * The robot arm, from its shoulder at the bottom edge of the window to the claw at `tip`: two
 * segments that bend at the elbow, worked out so the claw is always where the finger is.
 */
export function drawArm(ctx: Ctx, bx: number, by: number, tx: number, ty: number, len: number, closed: number, holding: boolean, t: number): void {
  const dx = tx - bx, dy = ty - by;
  const d = Math.min(Math.hypot(dx, dy), len * 1.98);
  const a = Math.atan2(dy, dx);
  const bend = Math.acos(Math.min(1, d / (2 * len)));
  const ex = bx + Math.cos(a - bend) * len, ey = by + Math.sin(a - bend) * len;
  const hx = bx + Math.cos(a) * d, hy = by + Math.sin(a) * d;
  const w = len * 0.16;
  ctx.save();
  ctx.lineCap = 'round';
  const seg = (x0: number, y0: number, x1: number, y1: number, wd: number): void => {
    ctx.strokeStyle = '#3b4148'; ctx.lineWidth = wd + 4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = wd;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = wd * 0.25;
    ctx.beginPath(); ctx.moveTo(x0 - wd * 0.2, y0 - wd * 0.2); ctx.lineTo(x1 - wd * 0.2, y1 - wd * 0.2); ctx.stroke();
  };
  seg(bx, by, ex, ey, w);
  seg(ex, ey, hx, hy, w * 0.8);
  // joints
  for (const [jx, jy, jr] of [[bx, by, w * 0.8], [ex, ey, w * 0.62]] as Array<[number, number, number]>) {
    ctx.fillStyle = '#2d3238'; ctx.beginPath(); ctx.arc(jx, jy, jr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8743b'; ctx.beginPath(); ctx.arc(jx, jy, jr * 0.45, 0, TAU); ctx.fill();
  }
  // the claw: two fingers that close
  const fa = Math.atan2(hy - ey, hx - ex);
  const open = (1 - closed) * 0.55 + 0.12;
  ctx.strokeStyle = '#2d3238'; ctx.lineWidth = w * 0.35;
  for (const side of [-1, 1]) {
    const aa = fa + side * open;
    const mx = hx + Math.cos(aa) * w * 1.2, my = hy + Math.sin(aa) * w * 1.2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my);
    ctx.lineTo(mx + Math.cos(fa - side * 0.6) * w * 0.8, my + Math.sin(fa - side * 0.6) * w * 0.8); ctx.stroke();
  }
  if (holding) {
    ctx.save();
    ctx.translate(hx + Math.cos(fa) * w * 1.3, hy + Math.sin(fa) * w * 1.3);
    ctx.rotate(fa + Math.PI / 2);
    drawTube(ctx, 0, 0, w * 5.5, t);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Saturn's rings and Stip

/** A chunk of ring ice: a lumpy white-grey rock, lit from the sun on the left. `r` in pixels. */
export function drawIce(ctx: Ctx, x: number, y: number, r: number, seed: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const n = 9;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 0.72 + hash(i % n, seed) * 0.4;
    const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k * (0.75 + hash(3, seed) * 0.3);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, '#fbfdff'); g.addColorStop(0.55, '#c9d3dc'); g.addColorStop(1, '#6d7a86');
  ctx.fillStyle = g;
  ctx.fill();
  // frost and pits
  ctx.fillStyle = 'rgba(90, 105, 120, 0.35)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((hash(i, seed + 1) - 0.5) * r, (hash(i, seed + 2) - 0.5) * r, r * (0.08 + hash(i, seed + 3) * 0.1), 0, TAU); ctx.fill(); }
  ctx.restore();
}

/**
 * Stip, Suri's satellite: a small box in gold foil with two blue solar panels, a dish for talking to
 * home and a light that blinks. `r` is half its span in pixels. `dish` turns the dish, radians away
 * from facing you: when it was lost, it was pointing the wrong way.
 */
export function drawStip(ctx: Ctx, x: number, y: number, r: number, t: number, dish: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const k = r / 10;
  // solar panels
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(side * 3 * k, -2.5 * k, side * 10 * k, 2.5 * k);
    g.addColorStop(0, '#1f3f8a'); g.addColorStop(0.5, '#3f6fd0'); g.addColorStop(1, '#16306d');
    ctx.fillStyle = g;
    ctx.fillRect(side > 0 ? 3.2 * k : -10 * k, -2.4 * k, 6.8 * k, 4.8 * k);
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.45)'; ctx.lineWidth = Math.max(0.5, 0.15 * k);
    for (let c = 1; c < 4; c++) { const xx = side > 0 ? (3.2 + c * 1.7) * k : (-10 + c * 1.7) * k; ctx.beginPath(); ctx.moveTo(xx, -2.4 * k); ctx.lineTo(xx, 2.4 * k); ctx.stroke(); }
    ctx.strokeStyle = '#8b9096'; ctx.lineWidth = Math.max(1, 0.4 * k);
    ctx.beginPath(); ctx.moveTo(side * 2.2 * k, 0); ctx.lineTo(side * 3.2 * k, 0); ctx.stroke();
  }
  // the body
  const foil = ctx.createLinearGradient(-2.4 * k, -2.4 * k, 2.4 * k, 2.4 * k);
  foil.addColorStop(0, '#f6d27a'); foil.addColorStop(0.5, '#c98f22'); foil.addColorStop(1, '#7a520f');
  ctx.fillStyle = foil;
  ctx.fillRect(-2.4 * k, -2.4 * k, 4.8 * k, 4.8 * k);
  ctx.strokeStyle = 'rgba(255, 240, 190, 0.5)'; ctx.lineWidth = Math.max(0.5, 0.1 * k);
  ctx.strokeRect(-2.4 * k, -2.4 * k, 4.8 * k, 4.8 * k);
  // the dish on its stalk
  ctx.save();
  ctx.translate(0, -2.4 * k);
  ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = Math.max(1, 0.35 * k);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.6 * k); ctx.stroke();
  ctx.translate(0, -1.6 * k);
  const face = Math.cos(dish);
  ctx.fillStyle = face > 0 ? '#eef1f4' : '#8f969d';
  ctx.beginPath(); ctx.ellipse(0, -0.6 * k, 2.6 * k, Math.max(0.3, Math.abs(face)) * 1.3 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6b7178'; ctx.lineWidth = Math.max(0.5, 0.2 * k);
  ctx.stroke();
  ctx.restore();
  // the light
  const on = (t % 1.2) < 0.35;
  if (on) {
    const gl = ctx.createRadialGradient(1.3 * k, 1.2 * k, 0, 1.3 * k, 1.2 * k, 3 * k);
    gl.addColorStop(0, 'rgba(255, 90, 70, 0.95)'); gl.addColorStop(1, 'rgba(255, 90, 70, 0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(1.3 * k, 1.2 * k, 3 * k, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = on ? '#ffd0c8' : '#7a2a22';
  ctx.beginPath(); ctx.arc(1.3 * k, 1.2 * k, 0.45 * k, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- coming home

/** Three parachutes, orange and white in segments, on their lines down to the capsule below. */
export function drawParachutes(ctx: Ctx, cx: number, cy: number, r: number, t: number, open: number): void {
  ctx.save();
  const offs = [-1.05, 0, 1.05];
  // the capsule hangs below, just out of sight at the top of the window; every line runs to it
  const hx = cx, hy = cy + r * 0.6;
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(t * 0.8 + i * 1.7) * 0.05;
    const px = cx + offs[i] * r * 1.05 * open, py = cy - r * (1.6 + (i === 1 ? 0.25 : 0)) * open;
    const rr = r * (0.3 + 0.7 * open);
    const rot = offs[i] * 0.3 + sway;
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let l = -4; l <= 4; l++) {
      const lx = (l / 4) * rr, ex = px + Math.cos(rot) * lx, ey = py + Math.sin(rot) * lx;
      ctx.moveTo(ex, ey); ctx.lineTo(hx, hy);
    }
    ctx.stroke();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    // the canopy in segments
    for (let sgm = 0; sgm < 8; sgm++) {
      const a0 = Math.PI + (sgm / 8) * Math.PI, a1 = Math.PI + ((sgm + 1) / 8) * Math.PI;
      ctx.fillStyle = sgm % 2 ? '#ffffff' : '#ef7a2f';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.ellipse(0, 0, rr, rr * 0.62, 0, a0, a1);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.14, 0, 0, Math.PI); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
