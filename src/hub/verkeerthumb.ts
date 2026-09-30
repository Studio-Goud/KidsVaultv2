/**
 * The card for Suri en de fietstocht: Suri on his bicycle seen from behind, riding up the red cycle
 * path towards a blue round sign. Kept in a file of its own so the card is one small import, and
 * drawn with the story's own art so the card shows the same Suri, the same bike and the same sign
 * as the story does.
 */

import { drawBikeSignFace, drawRiderBack } from '../story/verkeerart';

const TAU = Math.PI * 2;

// Not exported from thumbs.ts, and three lines are cheaper than widening its surface.
function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Suri riding away up a red cycle path, a blue bicycle sign beside it. */
export function drawTrafficThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const hz = h * 0.42;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#66b2e8'); sky.addColorStop(1, '#e3f2fa');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 1);
  // a cloud, and far hills
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(w * 0.22, h * 0.17, w * 0.13, h * 0.055, 0, 0, TAU); ctx.ellipse(w * 0.3, h * 0.14, w * 0.08, h * 0.06, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a4c59a';
  ctx.beginPath(); ctx.moveTo(0, hz); ctx.quadraticCurveTo(w * 0.25, hz - h * 0.09, w * 0.5, hz - h * 0.02); ctx.quadraticCurveTo(w * 0.78, hz - h * 0.1, w, hz - h * 0.03); ctx.lineTo(w, hz); ctx.closePath(); ctx.fill();
  // the lawn
  const grass = ctx.createLinearGradient(0, hz, 0, h);
  grass.addColorStop(0, '#8cc068'); grass.addColorStop(1, '#6fa64f');
  ctx.fillStyle = grass; ctx.fillRect(0, hz, w, h - hz);
  // the red path, narrowing to the horizon, with its white dashes
  const vx = w * 0.5;
  ctx.fillStyle = '#c9553f';
  ctx.beginPath(); ctx.moveTo(vx - w * 0.03, hz); ctx.lineTo(vx + w * 0.03, hz); ctx.lineTo(w * 0.92, h); ctx.lineTo(w * 0.08, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4ddd6';
  for (let i = 0; i < 4; i++) {
    const k0 = 0.12 + i * i * 0.05 + i * 0.1, k1 = k0 + 0.05 + i * 0.02;
    const y0 = hz + (h - hz) * k0, y1 = hz + (h - hz) * k1, hw0 = 0.004 + k0 * 0.012, hw1 = 0.004 + k1 * 0.012;
    ctx.beginPath(); ctx.moveTo(vx - w * hw0, y0); ctx.lineTo(vx + w * hw0, y0); ctx.lineTo(vx + w * hw1, y1); ctx.lineTo(vx - w * hw1, y1); ctx.closePath(); ctx.fill();
  }
  // the sign on its post, to the right of the path
  const sx = w * 0.84, sy = h * 0.74;
  ctx.fillStyle = '#8a97a3'; ctx.fillRect(sx - 1.5, sy - h * 0.42, 3, h * 0.42);
  drawBikeSignFace(ctx, sx, sy - h * 0.44, h * 0.14);
  // Suri, from behind, with his helmet on
  const s = h * 0.36;
  drawRiderBack(ctx, w * 0.46, h * 0.98, s, { mode: 'ride', phase: 0.6, helmet: true, t: 0 });
}
