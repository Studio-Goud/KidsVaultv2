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

/** A rock pool with a crab and a starfish and two pools waiting, in Tidepool's palette. */
export function drawTideThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2f8fd6'); g.addColorStop(0.62, '#6fc9ea'); g.addColorStop(0.63, '#f1dfb4'); g.addColorStop(1, '#dcc490');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.12 + k * 0.13) + Math.sin(x * 0.08 + k) * 1.5); ctx.stroke(); }
  // two pools
  for (const [px, col] of [[0.28, '#e0574a'], [0.72, '#3f86d6']] as Array<[number, string]>) {
    ctx.fillStyle = 'rgba(80,160,200,0.6)';
    ctx.beginPath(); ctx.roundRect(w * px - w * 0.17, h * 0.7, w * 0.34, h * 0.24, 8); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(w * px, h * 0.82, h * 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  }
  // a red crab
  ctx.save(); ctx.translate(w * 0.36, h * 0.36);
  ctx.fillStyle = '#e0574a'; ctx.strokeStyle = 'rgba(30,40,60,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.09, w * 0.065, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * w * 0.1, -w * 0.05, w * 0.028, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#20304a'; ctx.beginPath(); ctx.arc(-w * 0.027, -w * 0.02, 1.6, 0, TAU); ctx.arc(w * 0.027, -w * 0.02, 1.6, 0, TAU); ctx.fill();
  ctx.restore();
  // a blue starfish
  ctx.save(); ctx.translate(w * 0.68, h * 0.42);
  ctx.fillStyle = '#3f86d6'; ctx.strokeStyle = 'rgba(30,40,60,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2; const rr = i % 2 === 0 ? w * 0.1 : w * 0.045; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
