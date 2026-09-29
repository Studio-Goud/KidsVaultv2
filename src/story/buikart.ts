/**
 * The inside of Suri, for the tummy-ache story, drawn in code.
 *
 * Drawn to be looked at by a four-year-old, which decided most things here. The body is warm pink
 * and wet-looking, not red; nothing bleeds. The germs are drawn as what they are under a microscope -
 * small green rods with a few thin tails - and not as monsters with faces, because a face would make
 * them characters, and characters make a child afraid of their own tummy. The good bacteria are a
 * different shape and colour, so a child can see there are two kinds. The white blood cells are big,
 * soft and lumpy, with the many-lobed middle they really have.
 *
 * Every function takes a centre in pixels and a size in pixels: the scenes decide the scale.
 */

import { blobPath, shade } from '../render/look';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

// ---------------------------------------------------------------- the mouth

/**
 * One row of teeth, as seen from inside the mouth: ten milk teeth in an arch, the front ones flat
 * and the back ones wide and knobbly. `up` is +1 for the top row (points down) and -1 for the bottom.
 */
export function drawTeethRow(ctx: Ctx, cx: number, y: number, w: number, h: number, up: 1 | -1): void {
  ctx.save();
  // the gum the teeth stand in
  ctx.fillStyle = '#d9707a';
  ctx.beginPath();
  ctx.ellipse(cx, y - up * h * 0.55, w * 0.55, h * 0.75, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const k = (i - 4.5) / 4.5;              // -1 .. 1 across the arch
    const x = cx + k * w * 0.46;
    const back = Math.abs(k);
    const tw = w * (0.075 + back * 0.03), th = h * (0.95 - back * 0.25);
    const ty = y - up * Math.pow(back, 2) * h * 0.35;
    const g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
    g.addColorStop(0, '#e9e2d0'); g.addColorStop(0.4, '#fffdf5'); g.addColorStop(1, '#d7cfbb');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, up > 0 ? ty - th * 0.2 : ty - th * 0.8, tw, th, tw * (0.25 + back * 0.2));
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 120, 100, 0.25)'; ctx.lineWidth = Math.max(0.5, tw * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

/** A bite of apple: white flesh, a sliver of red peel. Smaller bits as it gets chewed. */
export function drawAppleBit(ctx: Ctx, x: number, y: number, r: number, seed: number, wet: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hash(1, seed) * TAU);
  ctx.fillStyle = '#f6efcf';
  blobPath(ctx, 0, 0, r, seed, 0.25, 9);
  ctx.fill();
  ctx.fillStyle = '#c9352c';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.8, r * 0.7, r * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + wet * 0.35})`;
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.2, r * 0.3, r * 0.12, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the gut

/**
 * One villus: a little finger standing up from the wall of the gut, a millimetre tall on a real one,
 * with a fine net of blood vessels showing through. `s` is pixels per unit of height.
 */
export function drawVillus(ctx: Ctx, x: number, y: number, s: number, tall: number, seed: number, t: number): void {
  const h = tall * s, wd = h * 0.26;
  const sway = Math.sin(t * 0.9 + seed) * wd * 0.25;
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-wd, 0, wd, 0);
  g.addColorStop(0, '#c4646a'); g.addColorStop(0.45, '#f2a9a4'); g.addColorStop(1, '#b85a60');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-wd * 0.55, 0);
  ctx.quadraticCurveTo(-wd * 0.6 + sway * 0.3, -h * 0.6, -wd * 0.45 + sway, -h * 0.9);
  ctx.quadraticCurveTo(sway, -h * 1.05, wd * 0.45 + sway, -h * 0.9);
  ctx.quadraticCurveTo(wd * 0.6 + sway * 0.3, -h * 0.6, wd * 0.55, 0);
  ctx.closePath(); ctx.fill();
  // the red thread of a blood vessel up the middle, and a shine of wet on one side
  ctx.strokeStyle = 'rgba(170, 30, 40, 0.45)'; ctx.lineWidth = Math.max(0.5, wd * 0.08);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * 0.5, -h * 0.5, sway * 0.9, -h * 0.9); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 240, 235, 0.35)';
  ctx.beginPath(); ctx.ellipse(-wd * 0.25 + sway * 0.6, -h * 0.6, wd * 0.1, h * 0.25, 0.05, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * A germ: a small rod, green, with a few thin tails it swims with. `r` is half its length.
 * No face, on purpose (see the top of this file).
 */
export function drawGerm(ctx: Ctx, x: number, y: number, r: number, rot: number, t: number, seed = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // the tails, waving
  ctx.strokeStyle = 'rgba(80, 120, 40, 0.7)'; ctx.lineWidth = Math.max(0.6, r * 0.06);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + seed;
    ctx.beginPath();
    const sx = Math.cos(a) * r * 0.8, sy = Math.sin(a) * r * 0.3;
    ctx.moveTo(sx, sy);
    for (let k = 1; k <= 6; k++) {
      const d = k / 6;
      ctx.lineTo(sx + Math.cos(a) * r * 0.9 * d, sy + Math.sin(a) * r * 0.9 * d + Math.sin(t * 8 + k + i) * r * 0.12);
    }
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, -r * 0.35, 0, r * 0.35);
  g.addColorStop(0, '#b6d65a'); g.addColorStop(0.5, '#7fa834'); g.addColorStop(1, '#4d7220');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-r, -r * 0.34, 2 * r, r * 0.68, r * 0.34); ctx.fill();
  ctx.fillStyle = 'rgba(40, 70, 20, 0.35)';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((hash(i, seed + 2) - 0.5) * r * 1.2, (hash(i, seed + 5) - 0.5) * r * 0.3, r * 0.1, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/** A good gut bacterium: a small round blue-violet ball, in little chains. */
export function drawGoodBug(ctx: Ctx, x: number, y: number, r: number, seed: number): void {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const px = x + i * r * 1.7 * Math.cos(seed), py = y + i * r * 1.7 * Math.sin(seed);
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    g.addColorStop(0, '#b9b3f0'); g.addColorStop(1, '#5c55a8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the blood

/**
 * A red blood cell: a round disc, thinner in the middle than at the rim, so it shows a pale dip.
 * `tilt` 0 is face-on, 1 is edge-on.
 */
export function drawRedCell(ctx: Ctx, x: number, y: number, r: number, tilt: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const ry = r * Math.max(0.32, 1 - tilt * 0.68);
  const g = ctx.createRadialGradient(-r * 0.3, -ry * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#f05a4e'); g.addColorStop(0.7, '#c8261f'); g.addColorStop(1, '#8e1712');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, TAU); ctx.fill();
  // the dip in the middle
  ctx.fillStyle = 'rgba(120, 10, 10, 0.35)';
  ctx.beginPath(); ctx.ellipse(r * 0.05, ry * 0.08, r * 0.45, ry * 0.42, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255, 190, 180, 0.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.45, -ry * 0.4, r * 0.25, ry * 0.12, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * A white blood cell: bigger than the red ones, soft and lumpy, pale, with the many-lobed purple
 * middle a neutrophil has. `full` swells it a little while it is swallowing something.
 */
export function drawWhiteCell(ctx: Ctx, x: number, y: number, r: number, t: number, seed: number, full = 0): void {
  ctx.save();
  const wob = 0.12 + 0.04 * Math.sin(t * 2 + seed);
  const rr = r * (1 + full * 0.12);
  const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr * 1.1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#eef0f6'); g.addColorStop(1, '#b9bfd0');
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + Math.sin(a * 3 + t * 1.5 + seed) * wob + (hash(i % n, seed) - 0.5) * 0.1;
    const px = x + Math.cos(a) * rr * k, py = y + Math.sin(a) * rr * k;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(150, 160, 190, 0.6)'; ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.stroke();
  // the lobed middle
  ctx.fillStyle = 'rgba(120, 80, 170, 0.7)';
  for (let i = 0; i < 3; i++) {
    const a = seed + i * 1.9;
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr * 0.25, y + Math.sin(a) * rr * 0.22, rr * 0.2, rr * 0.15, a, 0, TAU); ctx.fill();
  }
  // grains in it
  ctx.fillStyle = 'rgba(180, 170, 210, 0.6)';
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(x + (hash(i, seed) - 0.5) * rr * 1.2, y + (hash(i, seed + 3) - 0.5) * rr * 1.2, rr * 0.03, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- the bedroom

/**
 * Suri's bedroom: a wall, a window with the evening or the morning in it, a bed with a blanket.
 * Returns where Suri's head is on the pillow, so the scene can put him there and zoom into him.
 */
export function drawBedroom(ctx: Ctx, w: number, h: number, u: number, morning: boolean, t: number): { hx: number; hy: number; size: number } {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, morning ? '#f4e6cf' : '#39456b'); wall.addColorStop(1, morning ? '#e6d2b3' : '#2a3354');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
  // the floor
  ctx.fillStyle = morning ? '#b98a5c' : '#4a3a3a';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // the window
  const ww = Math.min(w * 0.3, h * 0.36), wx = w * 0.62, wy = h * 0.12;
  const sky = ctx.createLinearGradient(0, wy, 0, wy + ww);
  sky.addColorStop(0, morning ? '#8fc6ee' : '#0c1433'); sky.addColorStop(1, morning ? '#fbe2b8' : '#27315a');
  ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, ww);
  if (morning) {
    ctx.fillStyle = 'rgba(255, 244, 200, 0.95)';
    ctx.beginPath(); ctx.arc(wx + ww * 0.7, wy + ww * 0.7, ww * 0.12, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#f2efdc';
    ctx.beginPath(); ctx.arc(wx + ww * 0.3, wy + ww * 0.3, ww * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.fillRect(wx + hash(i, 4) * ww, wy + hash(i, 6) * ww * 0.8, 1.6 * u, 1.6 * u); }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = morning ? '#ffffff' : '#c9cde0'; ctx.lineWidth = 5 * u;
  ctx.strokeRect(wx, wy, ww, ww);
  ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + ww); ctx.moveTo(wx, wy + ww / 2); ctx.lineTo(wx + ww, wy + ww / 2); ctx.stroke();
  // morning light on the wall
  if (morning) {
    ctx.fillStyle = 'rgba(255, 240, 200, 0.25)';
    ctx.beginPath(); ctx.moveTo(wx, wy + ww); ctx.lineTo(wx + ww, wy + ww); ctx.lineTo(wx + ww * 0.4, h * 0.95); ctx.lineTo(wx - ww * 0.9, h * 0.95); ctx.closePath(); ctx.fill();
  }
  // the bed
  const bx = w * 0.12, by = h * 0.52, bw = Math.min(w * 0.62, h * 1.1), bh = h * 0.3;
  ctx.fillStyle = morning ? '#8a5a3a' : '#3e2c28';
  ctx.fillRect(bx - 10 * u, by - bh * 0.6, 14 * u, bh * 1.6);
  ctx.fillRect(bx, by + bh * 0.7, bw, 10 * u);
  ctx.fillStyle = morning ? '#ffffff' : '#c5c8d8';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh * 0.75, 12 * u); ctx.fill();
  // the pillow
  ctx.fillStyle = morning ? '#fff8ec' : '#d9dbe6';
  ctx.beginPath(); ctx.ellipse(bx + bw * 0.14, by - bh * 0.02, bw * 0.12, bh * 0.2, 0, 0, TAU); ctx.fill();
  const size = bh * 1.3;
  return { hx: bx + bw * 0.16, hy: by - bh * 0.05, size };
}

/** The blanket over Suri, drawn after him so he is tucked in. */
export function drawBlanket(ctx: Ctx, w: number, h: number, u: number, morning: boolean): void {
  const bx = w * 0.12, by = h * 0.52, bw = Math.min(w * 0.62, h * 1.1), bh = h * 0.3;
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, morning ? '#6aa0d8' : '#34507e'); g.addColorStop(1, morning ? '#4a7fb8' : '#243a60');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.22, by + bh * 0.72);
  ctx.quadraticCurveTo(bx + bw * 0.25, by - bh * 0.05, bx + bw * 0.45, by + bh * 0.02);
  ctx.quadraticCurveTo(bx + bw * 0.75, by + bh * 0.1, bx + bw, by + bh * 0.05);
  ctx.lineTo(bx + bw, by + bh * 0.78); ctx.lineTo(bx + bw * 0.22, by + bh * 0.78);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(morning ? '#6aa0d8' : '#34507e', 0.15);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(bx + bw * (0.35 + i * 0.14), by + bh * 0.4, 6 * u, 0, TAU); ctx.fill(); }
}
