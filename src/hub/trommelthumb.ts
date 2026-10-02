/**
 * The hub card for Trommelkring: a drum by a fire under a dusk sky, the two halves of its skin in
 * the two colours the game uses for low and high. Self contained, like the rest of `thumbs.ts`,
 * so the home page does not pull the game's bundle in for a picture the size of a stamp.
 */

const TAU = Math.PI * 2;

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawDrumThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1d1f58'); sky.addColorStop(0.55, '#5a3f84'); sky.addColorStop(1, '#e8845c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,248,224,0.8)';
  [[0.12, 0.14], [0.3, 0.07], [0.5, 0.2], [0.72, 0.1], [0.9, 0.22], [0.2, 0.34]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(w * x, h * y, 1.2, 0, TAU); ctx.fill();
  });
  ctx.fillStyle = '#2a1d34'; ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // the fire
  const fx = w * 0.22, fy = h * 0.8;
  const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, w * 0.3);
  glow.addColorStop(0, 'rgba(255,170,70,0.55)'); glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#4a2c1c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fx - 11, fy + 1); ctx.lineTo(fx + 11, fy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx - 10, fy - 2); ctx.lineTo(fx + 11, fy + 1); ctx.stroke();
  ctx.fillStyle = '#f0701f';
  ctx.beginPath(); ctx.moveTo(fx - 8, fy - 1); ctx.bezierCurveTo(fx - 10, fy - 12, fx - 2, fy - 16, fx, fy - 26);
  ctx.bezierCurveTo(fx + 3, fy - 15, fx + 10, fy - 10, fx + 8, fy - 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd25a';
  ctx.beginPath(); ctx.moveTo(fx - 4, fy - 1); ctx.bezierCurveTo(fx - 5, fy - 7, fx - 1, fy - 9, fx, fy - 14);
  ctx.bezierCurveTo(fx + 2, fy - 8, fx + 5, fy - 6, fx + 4, fy - 1); ctx.closePath(); ctx.fill();

  // the drum
  const cx = w * 0.62, cy = h * 0.5, rx = w * 0.28, ry = h * 0.15, depth = h * 0.2;
  ctx.fillStyle = 'rgba(10,6,20,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + depth + ry * 0.8, rx * 1.02, ry * 0.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a9603a';
  ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx - rx, cy + depth);
  ctx.ellipse(cx, cy + depth, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, cy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f0dcae'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * i / 8;
    ctx.lineTo(cx - Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry + (i % 2 ? depth * 0.9 : depth * 0.1));
  }
  ctx.stroke();
  ctx.fillStyle = '#c98a48';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.93, ry * 0.88, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = '#d9904f'; ctx.fillRect(cx - rx, cy - ry, rx, ry * 2);
  ctx.fillStyle = '#f2d9a4'; ctx.fillRect(cx, cy - ry, rx, ry * 2);
  ctx.restore();
  // two hits lighting up above it
  ctx.fillStyle = '#c4642f'; ctx.beginPath(); ctx.arc(cx - rx * 0.4, cy - ry - 8, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e9b84a'; ctx.beginPath(); ctx.arc(cx + rx * 0.4, cy - ry - 8, 4, 0, TAU); ctx.fill();
}
