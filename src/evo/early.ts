/**
 * The first three stops, before there is a body to bend: a single cell, a cell with a nucleus, and
 * cells that stay together.
 *
 * A child cannot see a cell, so these are drawn as if through a microscope: big, soft, slightly
 * see-through, with the few things inside that matter drawn plainly - the membrane round the
 * outside, the nucleus in the second one, the little mitochondria. The first cell divides when it
 * is tapped, and each copy is very slightly different in colour from its mother: that small
 * difference, repeated for three and a half billion years, is the whole story.
 *
 * `drawEarly(ctx, x, y, r, stage, k, t, ...)`: (x, y) is the centre, r the radius of one cell on
 * screen, and k how far the picture has gone towards the next stage (0..1).
 */

import type { Early } from './data';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface Cell { x: number; y: number; hue: number; born: number; vx: number; vy: number }

function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

/** One cell: a wobbling membrane, cytoplasm, and what is inside it. */
export function drawCell(ctx: Ctx, x: number, y: number, r: number, t: number, opts: {
  hue: number; nucleus: number; seed: number; tail: number; pinch?: number; alpha?: number; glow?: number;
}): void {
  const { hue, nucleus, seed } = opts;
  const pinch = opts.pinch ?? 0;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x, y);
  // the membrane wobbles a little: a cell is soft, not a ball
  const n = 40;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const wob = 1 + 0.035 * Math.sin(a * 3 + t * 1.3 + seed) + 0.025 * Math.sin(a * 5 - t * 0.9 + seed * 2);
    // dividing: the middle pinches in, the two ends round out
    const stretch = 1 + pinch * 0.5;
    const waist = 1 - pinch * 0.75 * Math.pow(Math.abs(Math.sin(a)), 3);
    const cx = Math.cos(a) * r * wob * stretch;
    const cy = Math.sin(a) * r * wob * (1 - pinch * 0.15) * (Math.abs(Math.cos(a)) < 0.4 ? waist : 1);
    pts.push([cx, cy]);
  }
  const path = new Path2D();
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) path.moveTo(mx, my); else path.quadraticCurveTo(p[0], p[1], mx, my);
  });
  path.closePath();
  // a tail: the whip some cells swim with
  if (opts.tail > 0.01) {
    ctx.strokeStyle = `hsla(${hue}, 45%, 70%, ${0.6 * opts.tail})`;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const k = i / 20;
      const px = -r - k * r * 1.6, py = Math.sin(k * 8 - t * 8 + seed) * r * 0.18 * k;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  if (opts.glow) {
    const g0 = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.8);
    g0.addColorStop(0, `hsla(${hue}, 70%, 70%, ${0.25 * opts.glow})`);
    g0.addColorStop(1, `hsla(${hue}, 70%, 70%, 0)`);
    ctx.fillStyle = g0;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, `hsla(${hue}, 55%, 82%, 0.9)`);
  g.addColorStop(0.7, `hsla(${hue}, 50%, 60%, 0.75)`);
  g.addColorStop(1, `hsla(${hue}, 55%, 40%, 0.8)`);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // granules drifting in the cytoplasm
  for (let i = 0; i < 26; i++) {
    const a = hash(i, seed) * TAU + t * 0.1 * (hash(i, seed + 1) - 0.5);
    const d = Math.sqrt(hash(i, seed + 2)) * r * 0.85;
    ctx.fillStyle = `hsla(${hue + 20}, 40%, ${35 + hash(i, seed + 3) * 30}%, 0.45)`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.025 + hash(i, seed + 4) * 0.03), 0, TAU); ctx.fill();
  }
  if (nucleus > 0.01) {
    // the nucleus with its nucleolus, and a few mitochondria and the folded membranes round it
    ctx.globalAlpha *= Math.min(1, nucleus * 1.5);
    ctx.strokeStyle = `hsla(${hue - 30}, 40%, 45%, 0.5)`;
    ctx.lineWidth = Math.max(1, r * 0.02);
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * Math.PI * 1.2 + j * 1.3 + 0.4;
        const rr = r * (0.42 + j * 0.06) + Math.sin(i * 1.7 + t) * r * 0.015;
        const px = Math.cos(a) * rr + r * 0.08, py = Math.sin(a) * rr - r * 0.05;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    const ng = ctx.createRadialGradient(r * 0.05, -r * 0.1, 0, r * 0.08, -r * 0.05, r * 0.34);
    ng.addColorStop(0, `hsla(${hue + 200}, 35%, 62%, 0.95)`);
    ng.addColorStop(1, `hsla(${hue + 210}, 40%, 38%, 0.95)`);
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.05, r * 0.32 * Math.min(1, nucleus * 1.2), 0, TAU); ctx.fill();
    ctx.fillStyle = `hsla(${hue + 220}, 45%, 28%, 0.9)`;
    ctx.beginPath(); ctx.arc(r * 0.14, -r * 0.1, r * 0.1, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = hash(i, seed + 9) * TAU, d = r * (0.55 + hash(i, seed + 8) * 0.25);
      ctx.save();
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
      ctx.rotate(a + 1);
      ctx.fillStyle = 'rgba(210, 120, 90, 0.8)';
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.06, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 50, 40, 0.7)'; ctx.lineWidth = Math.max(0.8, r * 0.012);
      ctx.beginPath(); for (let q = 0; q < 6; q++) { const px = -r * 0.1 + q * r * 0.04; ctx.moveTo(px, -r * 0.04); ctx.lineTo(px + r * 0.02, r * 0.04); } ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  // the membrane itself: a double line, catching the light on top
  ctx.strokeStyle = `hsla(${hue}, 50%, 88%, 0.85)`;
  ctx.lineWidth = Math.max(1.2, r * 0.045);
  ctx.stroke(path);
  ctx.strokeStyle = `hsla(${hue}, 45%, 35%, 0.5)`;
  ctx.lineWidth = Math.max(0.8, r * 0.015);
  ctx.save(); ctx.scale(0.94, 0.94); ctx.stroke(path); ctx.restore();
  ctx.restore();
}

/**
 * The early stops as one picture that changes: one cell (or however many the child has made by
 * tapping), a bigger cell with a nucleus, a ball of cells stuck together, and that ball stretching
 * out into the shape of the first swimmer.
 */
export function drawEarly(ctx: Ctx, x: number, y: number, r: number, stage: Early, k: number, t: number, cells: Cell[], stuck: number, stretch = 0): void {
  if (stage === 'cell') {
    // the cells the child has made, drifting apart; towards the next stop they draw back into one
    const one = k;
    cells.forEach((c, i) => {
      const age = t - c.born;
      const pinch = age < 0.9 ? Math.sin(Math.min(1, age / 0.9) * Math.PI) * 0.8 : 0;
      const px = x + c.x * r * (1 - one), py = y + c.y * r * (1 - one);
      drawCell(ctx, px, py, r * (0.55 + one * 0.45 * (i === 0 ? 1 : 0)), t, {
        hue: c.hue, nucleus: i === 0 ? one : 0, seed: i * 7 + 1, tail: 0.8 * (1 - one), pinch,
        alpha: i === 0 ? 1 : 1 - one, glow: age < 1 ? 1 - age : 0,
      });
    });
    return;
  }
  if (stage === 'nucleus') {
    // one big cell; on the way to the next stop it multiplies into a loose group
    const n = 1 + Math.floor(k * 12);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, d = i === 0 ? 0 : Math.sqrt(i) * r * 0.62 * k;
      const rr = r * (1.1 - k * 0.72);
      drawCell(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, rr, t, {
        hue: 150 + i * 4, nucleus: 1, seed: i * 5 + 3, tail: 0, alpha: i === 0 ? 1 : Math.min(1, k * 3),
      });
    }
    return;
  }
  // many: a loose group that the child's taps pull together into one round body, which then
  // stretches out towards the first swimmer
  const n = 13;
  const rr = r * 0.38;
  for (let i = n - 1; i >= 0; i--) {
    const a = i * 2.39996;
    const loose = Math.sqrt(i) * r * 0.62;
    const tight = Math.sqrt(i) * rr * 1.25;
    const d = loose + (tight - loose) * stuck;
    let px = Math.cos(a) * d, py = Math.sin(a) * d;
    // stretching: the ball becomes long and flat, the shape of an animal that swims
    px *= 1 + stretch * 2.2;
    py *= 1 - stretch * 0.45;
    drawCell(ctx, x + px, y + py, rr * (1 + stuck * 0.1), t, {
      hue: 150 + i * 5 + stuck * 10, nucleus: 1, seed: i * 5 + 3, tail: 0, alpha: 1 - Math.max(0, stretch - 0.6) * 2.5,
    });
  }
  if (stuck > 0.5) {
    // a thin skin round the whole group once it holds together
    ctx.strokeStyle = `rgba(220, 255, 235, ${0.3 * (stuck - 0.5) * 2 * (1 - stretch)})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath(); ctx.ellipse(x, y, rr * 5.2 * (1 + stretch * 2.2), rr * 5.2 * (1 - stretch * 0.45), 0, 0, TAU); ctx.stroke();
  }
}
