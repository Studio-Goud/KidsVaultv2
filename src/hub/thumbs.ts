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
