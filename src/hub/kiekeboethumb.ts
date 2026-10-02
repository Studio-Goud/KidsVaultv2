/**
 * The hub card for Kiekeboe: a meadow with a bush that has just parted and a pig looking out.
 * Self contained, like the other thumbnails, so the home page pulls in no game code for a stamp.
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

export function drawPeekThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, '#6ec3f2'); sky.addColorStop(1, '#d7f1fb');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const grass = ctx.createLinearGradient(0, h * 0.45, 0, h);
  grass.addColorStop(0, '#82d06b'); grass.addColorStop(1, '#5bb558');
  ctx.fillStyle = grass; ctx.fillRect(0, h * 0.45, w, h * 0.55);
  ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.arc(w * 0.84, h * 0.17, h * 0.09, 0, TAU); ctx.fill();
  // a fence
  ctx.fillStyle = '#f1e2c2';
  for (let x = 4; x < w; x += w * 0.1) ctx.fillRect(x, h * 0.38, 4, h * 0.14);
  ctx.fillRect(0, h * 0.42, w, 3); ctx.fillRect(0, h * 0.48, w, 3);

  // the pig, between the two halves of the bush
  const cx = w * 0.42, cy = h * 0.66, r = h * 0.26;
  ctx.fillStyle = '#2d5530'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 0.8, r * 0.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f5a6b8'; ctx.strokeStyle = '#b86b80'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.1, r * 0.55, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ee8aa2';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * r * 0.5, cy - r * 0.15); ctx.lineTo(cx + s * r * 0.55, cy - r * 0.62); ctx.lineTo(cx + s * r * 0.15, cy - r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.05, r * 0.27, r * 0.19, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1f2430';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.24, cy - r * 0.22, r * 0.07, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#8c3d55';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.08, cy + r * 0.05, r * 0.04, r * 0.07, 0, 0, TAU); ctx.fill(); }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#4fa94f'; ctx.strokeStyle = '#388438'; ctx.lineWidth = 1.5;
    for (const [dx, dy, rr] of [[0.75, 0.05, 0.5], [1.0, 0.4, 0.4], [0.7, -0.35, 0.4]]) {
      ctx.beginPath(); ctx.arc(cx + s * (dx + 0.35) * r, cy + dy * r + r * 0.3, rr * r, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  // a barrel on the right
  const bx = w * 0.8, by = h * 0.78;
  ctx.fillStyle = '#b57a45'; ctx.strokeStyle = '#6f4524'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx - h * 0.1, by - h * 0.14, h * 0.2, h * 0.26, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#59636e'; ctx.fillRect(bx - h * 0.1, by - h * 0.08, h * 0.2, 3); ctx.fillRect(bx - h * 0.1, by + h * 0.04, h * 0.2, 3);
}
