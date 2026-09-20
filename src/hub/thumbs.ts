/**
 * Small bespoke thumbnails for the two games that have no photograph to show.
 *
 * Deliberately self contained: the home page must not pull a whole game's bundle in just to draw a
 * picture the size of a stamp.
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

/** An aeroplane over sea and an island, in Cloudhopper's own palette. */
export function drawPlaneThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2f97dc'); sky.addColorStop(1, '#1d6fc2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  // an island in the lower corner
  ctx.fillStyle = '#6fd3ee';
  ctx.beginPath(); ctx.ellipse(w * 0.62, h * 1.02, w * 0.46, h * 0.34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8d6a8';
  ctx.beginPath(); ctx.ellipse(w * 0.62, h * 1.04, w * 0.40, h * 0.28, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#86c765';
  ctx.beginPath(); ctx.ellipse(w * 0.62, h * 1.06, w * 0.34, h * 0.24, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b4250';
  ctx.fillRect(w * 0.54, h * 0.80, w * 0.06, h * 0.26);

  // the route, drawn the way a player draws it
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.26);
  ctx.quadraticCurveTo(w * 0.42, h * 0.30, w * 0.57, h * 0.72);
  ctx.stroke();
  ctx.setLineDash([]);

  // the aircraft
  ctx.save();
  ctx.translate(w * 0.30, h * 0.30); ctx.rotate(0.5);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.10, h * 0.035, 0, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.01, 0); ctx.lineTo(-w * 0.03, -h * 0.14); ctx.lineTo(-w * 0.055, -h * 0.13);
  ctx.lineTo(-w * 0.035, 0); ctx.lineTo(-w * 0.055, h * 0.13); ctx.lineTo(-w * 0.03, h * 0.14);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff6a48';
  ctx.beginPath(); ctx.ellipse(w * 0.055, 0, w * 0.035, h * 0.028, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/** A constellation on a night sky, in Night Watch's palette. */
export function drawStarsThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#070f2b'); sky.addColorStop(1, '#152a5e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 26; i++) {
    const x = ((i * 73) % 100) / 100 * w, y = ((i * 37) % 100) / 100 * h;
    ctx.globalAlpha = 0.25 + ((i * 13) % 7) / 12;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const pts: Array<[number, number]> = [[0.50, 0.16], [0.76, 0.44], [0.50, 0.74], [0.24, 0.44]];
  ctx.strokeStyle = '#bcd8ff'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(150,200,255,0.8)'; ctx.shadowBlur = 8;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;
  for (const [x, y] of pts) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, 9);
    g.addColorStop(0, 'rgba(210,240,255,0.9)'); g.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * w, y * h, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x * w, y * h, 2.2, 0, TAU); ctx.fill();
  }
}

/** A green valley with a stream cut through it and a wheel, in Millstream's palette. */
export function drawValleyThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#bfe0a0'); g.addColorStop(1, '#6fae5c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the stream
  ctx.strokeStyle = '#3a8fd6'; ctx.lineWidth = w * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.quadraticCurveTo(w * 0.3, h * 0.35, w * 0.45, h * 0.55);
  ctx.quadraticCurveTo(w * 0.62, h * 0.78, w * 0.4, h);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = w * 0.018;
  ctx.stroke();
  // a field
  ctx.fillStyle = 'rgba(215,180,90,0.85)';
  ctx.beginPath(); ctx.ellipse(w * 0.78, h * 0.72, w * 0.16, h * 0.14, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(90,110,40,0.5)'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(w * 0.64, h * 0.72 + i * h * 0.05); ctx.lineTo(w * 0.92, h * 0.72 + i * h * 0.05); ctx.stroke(); }
  // the wheel
  ctx.save(); ctx.translate(w * 0.24, h * 0.36);
  ctx.strokeStyle = '#5a3d2a'; ctx.lineWidth = w * 0.02;
  ctx.beginPath(); ctx.arc(0, 0, w * 0.12, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * 0.12, Math.sin(a) * w * 0.12); ctx.stroke(); }
  ctx.restore();
}
