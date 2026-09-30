/**
 * The hub card for Suri en het donker: a dim room with a moon in the window and a small night light.
 * Self contained, like the other thumbnails, so the home page pulls in no story code for a stamp.
 */

const TAU = Math.PI * 2;

// the same few lines as `fit` in thumbs.ts, which does not export it
function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawDarkThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3f4b78'); g.addColorStop(1, '#2a3354');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3c3650'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // the window with a moon
  const ww = h * 0.42, wx = w * 0.14, wy = h * 0.12;
  ctx.fillStyle = '#16204a'; ctx.fillRect(wx, wy, ww, ww);
  ctx.fillStyle = '#f4efd2'; ctx.beginPath(); ctx.arc(wx + ww * 0.62, wy + ww * 0.36, ww * 0.16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16204a'; ctx.beginPath(); ctx.arc(wx + ww * 0.7, wy + ww * 0.3, ww * 0.14, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c9cde0'; ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.strokeRect(wx, wy, ww, ww);
  ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + ww); ctx.stroke();
  // the bed, with Suri peeking over the blanket
  const bx = w * 0.4, by = h * 0.56;
  ctx.fillStyle = '#c7cbe3'; ctx.beginPath(); ctx.ellipse(bx + w * 0.08, by, w * 0.07, h * 0.09, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9a96a'; ctx.beginPath(); ctx.arc(bx + w * 0.08, by - h * 0.03, h * 0.11, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a3524';
  ctx.beginPath(); ctx.ellipse(bx + w * 0.055, by - h * 0.05, h * 0.045, h * 0.035, -0.2, 0, TAU); ctx.ellipse(bx + w * 0.105, by - h * 0.05, h * 0.045, h * 0.035, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx + w * 0.055, by - h * 0.05, h * 0.02, 0, TAU); ctx.arc(bx + w * 0.105, by - h * 0.05, h * 0.02, 0, TAU); ctx.fill();
  ctx.fillStyle = '#45669f';
  ctx.beginPath(); ctx.roundRect(bx, by, w * 0.5, h * 0.3, h * 0.05); ctx.fill();
  // a small night light, glowing
  const lx = w * 0.88, ly = h * 0.8;
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, h * 0.5);
  glow.addColorStop(0, 'rgba(255, 207, 90, 0.6)'); glow.addColorStop(1, 'rgba(255, 207, 90, 0)');
  ctx.fillStyle = glow; ctx.fillRect(lx - h * 0.5, ly - h * 0.5, h, h);
  ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(lx, ly, h * 0.09, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9d2c4'; ctx.fillRect(lx - h * 0.11, ly, h * 0.22, h * 0.03);
}
