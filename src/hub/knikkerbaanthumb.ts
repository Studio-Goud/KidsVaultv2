/** The hub card for Knikkerbaan: a wooden board, a slanted plank, a marble above a red cup. */
const TAU = Math.PI * 2;

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawMarbleThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#e7c58c'); bg.addColorStop(1, '#cfa065');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,76,30,0.18)'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, h * (0.06 + i * 0.11)); ctx.bezierCurveTo(w * 0.3, h * (0.02 + i * 0.11), w * 0.7, h * (0.12 + i * 0.11), w, h * (0.06 + i * 0.11)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(90,56,22,0.35)';
  for (let x = 8; x < w; x += 14) for (let y = 8; y < h; y += 14) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); }
  // the plank
  ctx.save(); ctx.translate(w * 0.42, h * 0.5); ctx.rotate(0.38);
  ctx.fillStyle = '#6a4220'; ctx.beginPath(); ctx.roundRect(-w * 0.27, -h * 0.05 + 2, w * 0.54, h * 0.11, 4); ctx.fill();
  const pg = ctx.createLinearGradient(0, -h * 0.06, 0, h * 0.06);
  pg.addColorStop(0, '#f5dcaa'); pg.addColorStop(1, '#dcb270');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(-w * 0.27, -h * 0.06, w * 0.54, h * 0.11, 4); ctx.fill();
  ctx.restore();
  // the cup
  ctx.fillStyle = '#d6483a';
  ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.74); ctx.lineTo(w * 0.9, h * 0.74); ctx.lineTo(w * 0.87, h * 0.96); ctx.lineTo(w * 0.73, h * 0.96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a1f19'; ctx.beginPath(); ctx.ellipse(w * 0.8, h * 0.74, w * 0.1, h * 0.04, 0, 0, TAU); ctx.fill();
  // the marble
  const mx = w * 0.3, my = h * 0.28, r = h * 0.1;
  const g = ctx.createRadialGradient(mx - r * 0.35, my - r * 0.4, r * 0.1, mx, my, r);
  g.addColorStop(0, '#d9f3ff'); g.addColorStop(0.5, '#4aa6e0'); g.addColorStop(1, '#1b5f9e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(mx - r * 0.35, my - r * 0.4, r * 0.28, r * 0.17, -0.6, 0, TAU); ctx.fill();
}
