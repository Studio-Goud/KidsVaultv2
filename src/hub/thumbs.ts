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
/**
 * Millstream: the spring at the top, a channel cut down the slope, a field and the mill.
 * Drawn in the game's own light - sun from the top left, a shadow under everything.
 */
export function drawValleyThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;

  // the slope, lighter where it is high and dry, darker in the hollow the water runs down
  const land = ctx.createLinearGradient(0, 0, 0, h);
  land.addColorStop(0, '#9dbc63');
  land.addColorStop(0.45, '#6fae4c');
  land.addColorStop(1, '#4a8c3e');
  ctx.fillStyle = land;
  ctx.fillRect(0, 0, w, h);
  // a few darker patches, the way grass is never one green
  ctx.fillStyle = 'rgba(46, 96, 44, 0.16)';
  for (const [px, py, pr] of [[0.18, 0.3, 0.3], [0.78, 0.22, 0.26], [0.62, 0.78, 0.3]] as const) {
    ctx.beginPath();
    ctx.ellipse(w * px, h * py, w * pr, h * pr * 0.9, 0, 0, TAU);
    ctx.fill();
  }

  // the channel, dug from the spring down towards the field
  const path = (k: number): { x: number; y: number } => ({
    x: w * (0.22 + k * 0.22 + Math.sin(k * 3.6) * 0.035),
    y: h * (0.2 + k * 0.48),
  });
  const trace = (): void => {
    ctx.beginPath();
    const a = path(0);
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i <= 12; i++) { const q = path(i / 12); ctx.lineTo(q.x, q.y); }
  };
  ctx.strokeStyle = 'rgba(78, 54, 30, 0.45)';
  ctx.lineWidth = h * 0.1;
  ctx.lineCap = 'round';
  trace(); ctx.stroke();
  const water = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.7);
  water.addColorStop(0, '#8fdcf4');
  water.addColorStop(1, '#2e86c4');
  ctx.strokeStyle = water;
  ctx.lineWidth = h * 0.055;
  trace(); ctx.stroke();

  // the spring, welling up between stones
  const sx0 = w * 0.22, sy0 = h * 0.2;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.25)';
  ctx.beginPath(); ctx.ellipse(sx0, sy0 + h * 0.04, w * 0.09, h * 0.05, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    const sg = ctx.createLinearGradient(0, sy0 - h * 0.06, 0, sy0 + h * 0.06);
    sg.addColorStop(0, '#cbc4bb');
    sg.addColorStop(1, '#7d766f');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(sx0 + Math.cos(a) * w * 0.07, sy0 + Math.sin(a) * h * 0.05, w * 0.028, h * 0.026, 0, 0, TAU);
    ctx.fill();
  }
  const spring = ctx.createRadialGradient(sx0, sy0 - h * 0.01, 0, sx0, sy0, w * 0.055);
  spring.addColorStop(0, '#eafaff');
  spring.addColorStop(1, '#2b8fc9');
  ctx.fillStyle = spring;
  ctx.beginPath(); ctx.ellipse(sx0, sy0, w * 0.05, h * 0.04, 0, 0, TAU); ctx.fill();

  // the field the water runs into
  const fx = w * 0.46, fy = h * 0.74;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.28)';
  ctx.beginPath(); ctx.ellipse(fx, fy + h * 0.14, w * 0.2, h * 0.06, 0, 0, TAU); ctx.fill();
  const soil = ctx.createLinearGradient(0, fy - h * 0.12, 0, fy + h * 0.14);
  soil.addColorStop(0, '#7a5837');
  soil.addColorStop(1, '#4a2d16');
  ctx.fillStyle = soil;
  ctx.beginPath();
  ctx.roundRect(fx - w * 0.18, fy - h * 0.12, w * 0.36, h * 0.26, h * 0.04);
  ctx.fill();
  ctx.fillStyle = 'rgba(70, 150, 200, 0.4)';
  ctx.beginPath();
  ctx.ellipse(fx - w * 0.04, fy - h * 0.07, w * 0.14, h * 0.035, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7fae4a';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const px = fx - w * 0.15 + i * w * 0.043;
    const hh = h * (0.1 + (i % 3) * 0.014);
    ctx.beginPath();
    ctx.moveTo(px, fy + h * 0.11);
    ctx.quadraticCurveTo(px + w * 0.004, fy + h * 0.11 - hh * 0.6, px + w * 0.012, fy + h * 0.11 - hh);
    ctx.stroke();
  }

  // the mill: a house with a red roof and a wheel on its flank
  const mx = w * 0.72, my = h * 0.5;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.3)';
  ctx.beginPath(); ctx.ellipse(mx + w * 0.02, my + h * 0.19, w * 0.15, h * 0.06, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e6d8c0';
  ctx.fillRect(mx - w * 0.02, my - h * 0.1, w * 0.16, h * 0.28);
  ctx.fillStyle = '#c0674f';
  ctx.beginPath();
  ctx.moveTo(mx - w * 0.05, my - h * 0.09);
  ctx.lineTo(mx + w * 0.06, my - h * 0.28);
  ctx.lineTo(mx + w * 0.17, my - h * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd88a';
  ctx.fillRect(mx + w * 0.03, my + h * 0.01, w * 0.05, h * 0.08);
  ctx.strokeStyle = '#7a5130';
  ctx.lineWidth = Math.max(2, w * 0.018);
  const wr = h * 0.17;
  ctx.beginPath(); ctx.arc(mx - w * 0.05, my + h * 0.04, wr, 0, TAU); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(mx - w * 0.05, my + h * 0.04);
    ctx.lineTo(mx - w * 0.05 + Math.cos(a) * wr, my + h * 0.04 + Math.sin(a) * wr);
    ctx.stroke();
  }
}

/** Tidepool: the tide above, the sand below, and a crab on its way to a pool. */
export function drawTideThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const shore = h * 0.6;
  const sea = ctx.createLinearGradient(0, 0, 0, shore);
  sea.addColorStop(0, '#1064a6');
  sea.addColorStop(0.5, '#2b90cf');
  sea.addColorStop(1, '#69c9e6');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, shore);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.4;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, shore * (k / 4) + Math.sin(x * 0.06 + k) * 2.4);
    ctx.stroke();
  }
  const sand = ctx.createLinearGradient(0, shore, 0, h);
  sand.addColorStop(0, '#dcc18d');
  sand.addColorStop(1, '#f3e3bd');
  ctx.fillStyle = sand;
  ctx.fillRect(0, shore - 1, w, h - shore + 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 5) ctx.lineTo(x, shore + Math.sin(x * 0.07) * 2.6);
  ctx.stroke();

  // two pools in the rock, one green and one red
  const pool = (px: number, colour: string): void => {
    ctx.fillStyle = 'rgba(24, 38, 30, 0.25)';
    ctx.beginPath(); ctx.ellipse(px, h * 0.87, w * 0.14, h * 0.07, 0, 0, TAU); ctx.fill();
    const rim = ctx.createLinearGradient(px - w * 0.13, 0, px + w * 0.13, 0);
    rim.addColorStop(0, '#e2d2b2');
    rim.addColorStop(1, '#8d7a63');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.ellipse(px, h * 0.83, w * 0.14, h * 0.1, 0, 0, TAU); ctx.fill();
    const wg = ctx.createRadialGradient(px - w * 0.03, h * 0.8, 0, px, h * 0.83, w * 0.11);
    wg.addColorStop(0, '#a8ecfa');
    wg.addColorStop(1, '#2585bb');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.ellipse(px, h * 0.83, w * 0.11, h * 0.075, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(px, h * 0.82, w * 0.045, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };
  pool(w * 0.28, '#5fae6a');
  pool(w * 0.72, '#e0574a');

  // a crab drifting in on the tide
  const cx = w * 0.52, cy = h * 0.3, r = h * 0.15;
  ctx.fillStyle = 'rgba(10, 40, 70, 0.28)';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.2, cy + r * 0.8, r * 1.1, r * 0.4, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#b8402f';
  ctx.lineWidth = Math.max(1.4, r * 0.18);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = 0.3 + i * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx + side * r * 0.5, cy + r * 0.1);
      ctx.lineTo(cx + side * Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.1);
      ctx.stroke();
    }
    ctx.fillStyle = '#e0574a';
    ctx.beginPath(); ctx.arc(cx + side * r * 1.1, cy - r * 0.5, r * 0.34, 0, TAU); ctx.fill();
  }
  const body = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  body.addColorStop(0, '#f08a7a');
  body.addColorStop(1, '#c14634');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.76, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - r * 0.34, cy - r * 0.78, r * 0.2, 0, TAU); ctx.arc(cx + r * 0.34, cy - r * 0.78, r * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a2a3d';
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.76, r * 0.1, 0, TAU); ctx.arc(cx + r * 0.38, cy - r * 0.76, r * 0.1, 0, TAU); ctx.fill();
}

/** Market Day: the awning, the counter, a basket and three apples on an order card. */
export function drawMarketThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bfe4f6');
  sky.addColorStop(1, '#f0e3c4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // the awning, with a scalloped edge
  const ah = h * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, ah);
  for (let i = 8; i > 0; i--) {
    const x0 = (i / 8) * w, x1 = ((i - 1) / 8) * w;
    ctx.quadraticCurveTo((x0 + x1) / 2, ah + h * 0.05, x1, ah);
  }
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i * (w / 8) < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#e0574a' : '#fff6ea';
    ctx.fillRect(i * (w / 8), 0, w / 8, ah + h * 0.06);
  }
  ctx.restore();

  // the counter
  const cy = h * 0.72;
  const front = ctx.createLinearGradient(0, cy, 0, h);
  front.addColorStop(0, '#a9783f');
  front.addColorStop(1, '#8a6033');
  ctx.fillStyle = front;
  ctx.fillRect(0, cy, w, h - cy);
  ctx.fillStyle = '#e7c08a';
  ctx.fillRect(0, cy - h * 0.03, w, h * 0.05);

  // an apple, drawn the way the game draws it
  const apple = (ax: number, ay: number, ar: number): void => {
    ctx.fillStyle = 'rgba(24, 38, 30, 0.22)';
    ctx.beginPath(); ctx.ellipse(ax, ay + ar, ar * 0.8, ar * 0.28, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(ax - ar * 0.3, ay - ar * 0.35, ar * 0.1, ax, ay, ar * 1.15);
    g.addColorStop(0, '#f08a7a');
    g.addColorStop(0.45, '#e0503f');
    g.addColorStop(1, '#a5301f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ax, ay - ar * 0.7);
    ctx.bezierCurveTo(ax + ar * 1.15, ay - ar, ax + ar * 1.1, ay + ar * 0.75, ax, ay + ar * 0.95);
    ctx.bezierCurveTo(ax - ar * 1.1, ay + ar * 0.75, ax - ar * 1.15, ay - ar, ax, ay - ar * 0.7);
    ctx.fill();
    ctx.fillStyle = '#5fae5a';
    ctx.beginPath(); ctx.ellipse(ax + ar * 0.4, ay - ar * 1.05, ar * 0.36, ar * 0.18, -0.5, 0, TAU); ctx.fill();
  };

  // the basket on the counter
  const bx = w * 0.32, bw = w * 0.3, bt = h * 0.42;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.25)';
  ctx.beginPath(); ctx.ellipse(bx + bw / 2, cy + h * 0.02, bw * 0.5, h * 0.04, 0, 0, TAU); ctx.fill();
  const body = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  body.addColorStop(0, '#c79457');
  body.addColorStop(0.35, '#e3b97c');
  body.addColorStop(1, '#a9773f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(bx, bt);
  ctx.lineTo(bx + bw, bt);
  ctx.lineTo(bx + bw * 0.86, cy + h * 0.01);
  ctx.lineTo(bx + bw * 0.14, cy + h * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(96,58,24,0.28)';
  ctx.lineWidth = 1;
  for (let y = bt + h * 0.05; y < cy; y += h * 0.05) {
    ctx.beginPath(); ctx.moveTo(bx + bw * 0.06, y); ctx.lineTo(bx + bw * 0.94, y); ctx.stroke();
  }
  ctx.fillStyle = '#e8c089';
  ctx.beginPath(); ctx.roundRect(bx - bw * 0.03, bt - h * 0.05, bw * 1.06, h * 0.07, h * 0.035); ctx.fill();
  apple(bx + bw * 0.34, cy - h * 0.06, w * 0.05);
  apple(bx + bw * 0.68, cy - h * 0.06, w * 0.05);

  // the order card: a numeral and that many apples
  const cardX = w * 0.66, cardY = h * 0.3, cardW = w * 0.3, cardH = h * 0.22;
  ctx.fillStyle = 'rgba(30, 20, 10, 0.2)';
  ctx.beginPath(); ctx.roundRect(cardX + 2, cardY + 3, cardW, cardH, h * 0.04); ctx.fill();
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, h * 0.04); ctx.fill();
  ctx.fillStyle = '#2d1f10';
  ctx.font = `900 ${Math.round(h * 0.16)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('2', cardX + cardW * 0.12, cardY + cardH * 0.7);
  apple(cardX + cardW * 0.52, cardY + cardH * 0.48, w * 0.032);
  apple(cardX + cardW * 0.78, cardY + cardH * 0.48, w * 0.032);
}

/** Dino Dig: the trench, half the rock brushed off, and a bone coming clear. */
export function drawDigThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sand = ctx.createLinearGradient(0, 0, 0, h);
  sand.addColorStop(0, '#e7cd9f');
  sand.addColorStop(1, '#cfae7e');
  ctx.fillStyle = sand;
  ctx.fillRect(0, 0, w, h);

  // the trench, cut into the ground
  const t = { x: w * 0.1, y: h * 0.16, w: w * 0.8, h: h * 0.68 };
  ctx.fillStyle = '#c3a274';
  ctx.beginPath(); ctx.roundRect(t.x - w * 0.03, t.y - h * 0.04, t.w + w * 0.06, t.h + h * 0.08, h * 0.08); ctx.fill();
  const floor = ctx.createLinearGradient(0, t.y, 0, t.y + t.h);
  floor.addColorStop(0, '#6d5c48');
  floor.addColorStop(1, '#4f4234');
  ctx.fillStyle = floor;
  ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, t.h, h * 0.06); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, t.h, h * 0.06); ctx.clip();
  // a bone, part of it still under the rock
  ctx.fillStyle = '#e8ddc4';
  ctx.save();
  ctx.translate(t.x + t.w * 0.5, t.y + t.h * 0.5);
  ctx.rotate(-0.35);
  ctx.beginPath(); ctx.roundRect(-t.w * 0.3, -t.h * 0.07, t.w * 0.6, t.h * 0.14, t.h * 0.07); ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.arc(sx * t.w * 0.32, -t.h * 0.08, t.h * 0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx * t.w * 0.32, t.h * 0.08, t.h * 0.09, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // the rock still covering the right half
  const rock = ctx.createLinearGradient(t.x + t.w * 0.35, 0, t.x + t.w, 0);
  rock.addColorStop(0, 'rgba(164, 142, 112, 0)');
  rock.addColorStop(0.18, 'rgba(164, 142, 112, 0.97)');
  rock.addColorStop(1, 'rgba(142, 122, 96, 1)');
  ctx.fillStyle = rock;
  ctx.fillRect(t.x + t.w * 0.35, t.y, t.w * 0.65, t.h);
  ctx.fillStyle = 'rgba(74, 58, 40, 0.18)';
  for (let i = 0; i < 26; i++) {
    const rx = t.x + t.w * (0.4 + Math.random() * 0.58);
    const ry = t.y + t.h * (0.06 + Math.random() * 0.88);
    ctx.beginPath(); ctx.arc(rx, ry, h * 0.012, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // the brush that took the rest off
  ctx.save();
  ctx.translate(t.x + t.w * 0.3, t.y + t.h * 0.8);
  ctx.rotate(-0.7);
  ctx.fillStyle = '#b08a58';
  ctx.beginPath(); ctx.roundRect(-w * 0.012, 0, w * 0.024, h * 0.26, w * 0.012); ctx.fill();
  ctx.fillStyle = '#9aa3ad';
  ctx.beginPath(); ctx.roundRect(-w * 0.016, -h * 0.07, w * 0.032, h * 0.08, w * 0.008); ctx.fill();
  ctx.strokeStyle = '#f0dcb4';
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w * 0.005, -h * 0.07);
    ctx.lineTo(i * w * 0.011, -h * 0.17);
    ctx.stroke();
  }
  ctx.restore();
}

/** Puffball: a puffball about to go off, the squares it will reach marked, and a pot in the way. */
export function drawPuffThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const cell = h / 3.4;
  // moss, with stone pillars on the even squares
  const moss = ctx.createLinearGradient(0, 0, 0, h);
  moss.addColorStop(0, '#5f9147');
  moss.addColorStop(1, '#3d6632');
  ctx.fillStyle = moss;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y * cell < h + cell; y++) {
    for (let x = 0; x * cell < w + cell; x++) {
      if (x % 2 === 1 || y % 2 === 1) continue;
      const px = x * cell, py = y * cell;
      ctx.fillStyle = 'rgba(24, 38, 30, 0.3)';
      ctx.beginPath();
      ctx.ellipse(px + cell * 0.55, py + cell * 0.9, cell * 0.42, cell * 0.14, 0, 0, TAU);
      ctx.fill();
      const face = ctx.createLinearGradient(px, py + cell * 0.3, px, py + cell);
      face.addColorStop(0, '#6a6156');
      face.addColorStop(1, '#443e36');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.roundRect(px + cell * 0.06, py + cell * 0.3, cell * 0.88, cell * 0.64, cell * 0.1);
      ctx.fill();
      const top = ctx.createLinearGradient(px, py, px + cell, py + cell);
      top.addColorStop(0, '#a79d8c');
      top.addColorStop(1, '#7b7265');
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.roundRect(px + cell * 0.06, py + cell * 0.08, cell * 0.88, cell * 0.48, cell * 0.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(96, 142, 74, 0.5)';
      ctx.beginPath();
      ctx.ellipse(px + cell * 0.4, py + cell * 0.5, cell * 0.16, cell * 0.08, 0, 0, TAU);
      ctx.fill();
    }
  }

  // the squares the puffball will reach, counted out in dots
  const bx = cell * 1.0, by = cell * 1.0;
  for (const [dx, dy, n] of [[0, 0, 0], [1, 0, 1], [2, 0, 2], [0, 1, 1]] as const) {
    const px = bx + dx * cell, py = by + dy * cell;
    ctx.fillStyle = 'rgba(255, 206, 96, 0.5)';
    ctx.fillRect(px, py, cell, cell);
    ctx.strokeStyle = 'rgba(255, 234, 170, 0.85)';
    ctx.lineWidth = Math.max(1.2, cell * 0.05);
    ctx.strokeRect(px + cell * 0.06, py + cell * 0.06, cell * 0.88, cell * 0.88);
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * cell * 0.2;
      ctx.fillStyle = 'rgba(92, 56, 20, 0.45)';
      ctx.beginPath(); ctx.arc(px + cell / 2 + ox, py + cell / 2 + cell * 0.02, cell * 0.085, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffaea';
      ctx.beginPath(); ctx.arc(px + cell / 2 + ox, py + cell / 2, cell * 0.08, 0, TAU); ctx.fill();
    }
  }

  // a pot standing in the way
  const potX = bx + cell * 2.5, potY = by + cell * 0.56;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.3)';
  ctx.beginPath(); ctx.ellipse(potX, potY + cell * 0.3, cell * 0.3, cell * 0.1, 0, 0, TAU); ctx.fill();
  const pot = ctx.createLinearGradient(potX - cell * 0.3, potY - cell * 0.3, potX + cell * 0.3, potY + cell * 0.3);
  pot.addColorStop(0, '#d79a6a');
  pot.addColorStop(1, '#8d5836');
  ctx.fillStyle = pot;
  ctx.beginPath();
  ctx.moveTo(potX - cell * 0.28, potY - cell * 0.18);
  ctx.quadraticCurveTo(potX - cell * 0.34, potY + cell * 0.16, potX - cell * 0.16, potY + cell * 0.3);
  ctx.lineTo(potX + cell * 0.16, potY + cell * 0.3);
  ctx.quadraticCurveTo(potX + cell * 0.34, potY + cell * 0.16, potX + cell * 0.28, potY - cell * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e0a878';
  ctx.beginPath(); ctx.ellipse(potX, potY - cell * 0.18, cell * 0.3, cell * 0.09, 0, 0, TAU); ctx.fill();

  // the puffball, with how far it reaches on its cap
  const px2 = bx + cell * 0.5, py2 = by + cell * 0.58;
  const r = cell * 0.34;
  ctx.fillStyle = 'rgba(24, 38, 30, 0.3)';
  ctx.beginPath(); ctx.ellipse(px2, py2 + r * 0.85, r * 1.1, r * 0.3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#efe2c6';
  ctx.beginPath(); ctx.roundRect(px2 - r * 0.26, py2 - r * 0.1, r * 0.52, r * 0.95, r * 0.2); ctx.fill();
  const cap = ctx.createRadialGradient(px2 - r * 0.3, py2 - r * 0.4, r * 0.1, px2, py2, r * 1.2);
  cap.addColorStop(0, '#fff6ee');
  cap.addColorStop(0.55, '#f2b7a6');
  cap.addColorStop(1, '#d97a66');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(px2, py2 - r * 0.1, r, r * 0.86, 0, Math.PI, 0);
  ctx.ellipse(px2, py2 - r * 0.1, r, r * 0.5, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#5a3326';
  ctx.font = `900 ${Math.round(cell * 0.3)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('2', px2, py2 - r * 0.18);
  ctx.textAlign = 'left';
}

/** A rocket leaving the pad, with the Moon waiting at the top of the card. */
export function drawMoonThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;

  // the sky the rocket is climbing out of: blue at the bottom, space at the top
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a1330');
  sky.addColorStop(0.45, '#2a4f8d');
  sky.addColorStop(1, '#79b4e6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 18; i++) {
    const x = ((i * 61) % 100) / 100 * w, y = ((i * 29) % 100) / 100 * h * 0.5;
    ctx.globalAlpha = 0.5 - y / h;
    ctx.fillStyle = '#dce8ff';
    ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // the Moon, which is what the whole game is aiming at
  const mx = w * 0.78, my = h * 0.2, mr = Math.min(w, h) * 0.13;
  const moon = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.15, mx, my, mr);
  moon.addColorStop(0, '#fdfbf3');
  moon.addColorStop(1, '#c8c2b2');
  ctx.fillStyle = moon;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(150, 144, 130, 0.5)';
  for (const [dx, dy, r] of [[-0.3, 0.1, 0.22], [0.25, -0.2, 0.16], [0.1, 0.4, 0.13]] as const) {
    ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill();
  }

  // the ground it has just left, far enough below to leave room for the flame
  ctx.fillStyle = '#6b6a5c';
  ctx.beginPath(); ctx.ellipse(w * 0.5, h * 1.18, w * 0.8, h * 0.22, 0, 0, TAU); ctx.fill();

  // the rocket, the same stack the game starts you with: engine, tank, capsule
  const rx = w * 0.36, ry = h * 0.54;
  const u = Math.min(w, h) * 0.10;
  const tube = (y: number, tall: number, a: string, b: string): void => {
    const g = ctx.createLinearGradient(rx - u, 0, rx + u, 0);
    g.addColorStop(0, b); g.addColorStop(0.35, a); g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(rx - u, y, u * 2, tall, u * 0.18); ctx.fill();
  };
  ctx.save();
  ctx.translate(0, 0);
  ctx.rotate(0);
  // exhaust
  const fl = ctx.createLinearGradient(0, ry + u * 2.6, 0, ry + u * 6);
  fl.addColorStop(0, 'rgba(255,244,214,0.95)');
  fl.addColorStop(0.5, 'rgba(255,170,60,0.8)');
  fl.addColorStop(1, 'rgba(255,110,40,0)');
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.moveTo(rx - u * 0.6, ry + u * 2.6);
  ctx.quadraticCurveTo(rx, ry + u * 6.4, rx + u * 0.6, ry + u * 2.6);
  ctx.closePath(); ctx.fill();

  tube(ry - u * 2.6, u * 4.6, '#f4f6f8', '#b9c2cc');      // tank
  ctx.fillStyle = '#e0483a';
  ctx.fillRect(rx - u, ry - u * 1.1, u * 2, u * 0.3);      // the stripe
  ctx.fillStyle = '#2f3a47';                               // engine bell
  ctx.beginPath();
  ctx.moveTo(rx - u * 0.42, ry + u * 2);
  ctx.lineTo(rx + u * 0.42, ry + u * 2);
  ctx.lineTo(rx + u * 0.78, ry + u * 2.7);
  ctx.lineTo(rx - u * 0.78, ry + u * 2.7);
  ctx.closePath(); ctx.fill();
  const nose = ctx.createLinearGradient(rx - u, 0, rx + u, 0);
  nose.addColorStop(0, '#e8ecf1'); nose.addColorStop(0.35, '#ffffff'); nose.addColorStop(1, '#aeb8c4');
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(rx, ry - u * 4.6);
  ctx.quadraticCurveTo(rx + u * 0.95, ry - u * 3.1, rx + u * 0.95, ry - u * 2.5);
  ctx.lineTo(rx - u * 0.95, ry - u * 2.5);
  ctx.quadraticCurveTo(rx - u * 0.95, ry - u * 3.1, rx, ry - u * 4.6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6ec6ef';
  ctx.beginPath(); ctx.arc(rx, ry - u * 3.1, u * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * A schoolroom clock at twenty past three, with the digital time beside it.
 *
 * Twenty past is deliberate: the short hand is a third of the way from the three to the four, so
 * the card shows at a glance the thing the game is about - the hour hand does not sit on a number.
 */
export function drawClockThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;

  // the wall: warm above, panelling below, the same room the game is played in
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#b6dcef');
  wall.addColorStop(0.5, '#e3eff4');
  wall.addColorStop(0.68, '#f2e3c6');
  wall.addColorStop(1, '#ddc296');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(146, 106, 58, 0.35)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, h * 0.68); ctx.lineTo(w, h * 0.68); ctx.stroke();

  const cx = w * 0.38, cy = h * 0.46, r = Math.min(w * 0.3, h * 0.38);
  const dr = r * 0.86;

  ctx.save();
  ctx.shadowColor = 'rgba(20, 45, 70, 0.3)'; ctx.shadowBlur = r * 0.3; ctx.shadowOffsetY = r * 0.12;
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, '#fbdc9a'); rim.addColorStop(0.45, '#f6c96a'); rim.addColorStop(1, '#c98a2c');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.restore();

  const dial = ctx.createRadialGradient(cx - dr * 0.4, cy - dr * 0.4, dr * 0.1, cx, cy, dr);
  dial.addColorStop(0, '#ffffff'); dial.addColorStop(1, '#eee3ce');
  ctx.fillStyle = dial;
  ctx.beginPath(); ctx.arc(cx, cy, dr, 0, TAU); ctx.fill();

  // the twelve heavy ticks, which is what makes it read as a clock at stamp size
  ctx.strokeStyle = 'rgba(32, 65, 92, 0.85)'; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    ctx.lineWidth = Math.max(1, dr * 0.075);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * dr * 0.78, cy + Math.sin(a) * dr * 0.78);
    ctx.lineTo(cx + Math.cos(a) * dr * 0.93, cy + Math.sin(a) * dr * 0.93);
    ctx.stroke();
  }

  // twenty past three: the hour hand a third of the way on, not parked on the numeral
  const hand = (len: number, turns: number, width: number, tone: string): void => {
    const a = turns * TAU - Math.PI / 2;
    ctx.strokeStyle = tone; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * dr * 0.1, cy - Math.sin(a) * dr * 0.1);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  };
  hand(dr * 0.5, (3 + 20 / 60) / 12, Math.max(2, dr * 0.14), '#20415c');
  hand(dr * 0.78, 20 / 60, Math.max(1.5, dr * 0.09), '#2f6d94');
  ctx.fillStyle = '#c98a2c';
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, dr * 0.09), 0, TAU); ctx.fill();

  // the digital clock it has to be turned into
  const bw = w * 0.34, bh = bw * 0.42, bx = w * 0.76, by = h * 0.52;
  ctx.fillStyle = '#1b3b52';
  ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, bh * 0.24); ctx.fill();
  ctx.fillStyle = '#123040';
  ctx.beginPath(); ctx.roundRect(bx - bw * 0.43, by - bh * 0.31, bw * 0.86, bh * 0.62, bh * 0.14); ctx.fill();
  ctx.fillStyle = '#7ef0c8';
  ctx.font = `900 ${Math.round(bh * 0.42)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('3:20', bx, by + bh * 0.02);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
