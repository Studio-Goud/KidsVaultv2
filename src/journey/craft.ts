/**
 * What you ride.
 *
 * Four small drawings, each inside a hundred by hundred box with its nose at the top, so the
 * engine can put one anywhere and turn it. They are silhouettes with one window, because the one
 * thing a child looks for in a vehicle is where you sit.
 *
 * `glow` is the engine or the lamp: it runs while you are moving and dies away when you stop, and
 * it is the only part that tells you whether the journey is under way, which matters on a screen
 * where nothing else is moving.
 */

import type { Craft } from './types';

type Ctx = CanvasRenderingContext2D;

const WINDOW = '#bfe6ff';
const HULL = '#f3ece0';
const DARK = '#6d6154';

/** Draw one, centred on (x, y), `size` across, nose pointing `angle` (0 is up the screen). */
export function drawCraft(ctx: Ctx, kind: Craft, x: number, y: number, size: number, angle: number, glow: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  if (kind === 'rocket') rocket(ctx, glow);
  else if (kind === 'sub') sub(ctx, glow);
  else if (kind === 'drill') drill(ctx, glow);
  else pod(ctx, glow);
  ctx.restore();
}

function flame(ctx: Ctx, cx: number, top: number, w: number, len: number): void {
  if (len <= 0) return;
  const g = ctx.createLinearGradient(0, top, 0, top + len);
  g.addColorStop(0, 'rgba(255, 233, 168, 0.95)');
  g.addColorStop(0.5, 'rgba(255, 160, 80, 0.7)');
  g.addColorStop(1, 'rgba(255, 110, 60, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.quadraticCurveTo(cx, top + len * 1.05, cx + w / 2, top);
  ctx.closePath();
  ctx.fill();
}

function rocket(ctx: Ctx, glow: number): void {
  flame(ctx, 50, 76, 22, 34 * glow);
  ctx.fillStyle = '#d0573f';
  ctx.beginPath();
  ctx.moveTo(38, 58); ctx.quadraticCurveTo(24, 72, 26, 80); ctx.lineTo(38, 74); ctx.closePath();
  ctx.moveTo(62, 58); ctx.quadraticCurveTo(76, 72, 74, 80); ctx.lineTo(62, 74); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HULL;
  ctx.beginPath();
  ctx.moveTo(50, 12);
  ctx.quadraticCurveTo(64, 34, 63, 76);
  ctx.lineTo(37, 76);
  ctx.quadraticCurveTo(36, 34, 50, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d0573f';
  ctx.beginPath(); ctx.moveTo(50, 12); ctx.quadraticCurveTo(57, 24, 58, 32); ctx.lineTo(42, 32);
  ctx.quadraticCurveTo(43, 24, 50, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.beginPath(); ctx.arc(50, 45, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(50, 45, 9, 0, Math.PI * 2); ctx.stroke();
}

function sub(ctx: Ctx, glow: number): void {
  // the lamp, which is the sub's version of an engine: it says the dive is under way
  if (glow > 0) {
    const g = ctx.createLinearGradient(0, 30, 0, -12);
    g.addColorStop(0, `rgba(255, 246, 200, ${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255, 246, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(42, 26); ctx.lineTo(14, -18); ctx.lineTo(86, -18); ctx.lineTo(58, 26);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#e8b437';
  ctx.beginPath(); ctx.ellipse(50, 52, 26, 32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.roundRect(40, 18, 20, 12, 5); ctx.fill();
  ctx.beginPath(); ctx.roundRect(22, 68, 56, 9, 4.5); ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.beginPath(); ctx.arc(50, 48, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(50, 48, 13, 0, Math.PI * 2); ctx.stroke();
}

function pod(ctx: Ctx, glow: number): void {
  flame(ctx, 50, 72, 30, 24 * glow);
  ctx.fillStyle = HULL;
  ctx.beginPath(); ctx.ellipse(50, 50, 30, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b8f4e';
  ctx.beginPath(); ctx.ellipse(50, 62, 30, 12, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.beginPath(); ctx.ellipse(50, 44, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.ellipse(50, 44, 18, 12, 0, 0, Math.PI * 2); ctx.stroke();
}

/**
 * The drill that goes down through time: a cabin with a window and a cone of cutting teeth at the
 * nose. Its glow is the grit it throws back while it bores, which is how a drill says it is going.
 */
function drill(ctx: Ctx, glow: number): void {
  if (glow > 0) {
    ctx.fillStyle = `rgba(214, 180, 130, ${0.55 * glow})`;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI - Math.PI;
      ctx.beginPath();
      ctx.arc(50 + Math.cos(a) * 30, 22 + Math.sin(a) * 10 - 4, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the bit: a cone of teeth, with the spiral cut into it
  ctx.fillStyle = '#9aa3ae';
  ctx.beginPath();
  ctx.moveTo(50, 4); ctx.lineTo(70, 36); ctx.lineTo(30, 36); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5f6770'; ctx.lineWidth = 2.4;
  for (let k = 0; k < 3; k++) {
    const y = 14 + k * 8;
    ctx.beginPath(); ctx.moveTo(50 - (y - 4) * 0.62, y + 4); ctx.lineTo(50 + (y - 4) * 0.62, y - 2); ctx.stroke();
  }
  // the cabin
  ctx.fillStyle = '#e8a33c';
  ctx.beginPath(); ctx.roundRect(28, 34, 44, 50, 10); ctx.fill();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.roundRect(24, 78, 52, 10, 5); ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.beginPath(); ctx.arc(50, 56, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(50, 56, 11, 0, Math.PI * 2); ctx.stroke();
}
