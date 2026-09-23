import type { Palette } from './palette';
import { hexA, shade } from './palette';
import { blobPath, contactShadow, LIGHT } from './look';

export interface LightSpot { x: number; y: number; r: number; color: string; kind: 'window' | 'runway' | 'buoy' | 'beacon' | 'lamp' }

type Ctx = CanvasRenderingContext2D;

/**
 * A shadow on the ground. The offset follows the house light in look.ts - a sun almost overhead
 * and a touch to the left - rather than the forty-five degrees this used to use, which is what
 * made Cloudhopper's islands read as a different picture book from the rest of Suri.
 */
function shadowEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, pal: Palette): void {
  const ox = x - LIGHT.x * rx * 0.36, oy = y - LIGHT.y * ry * 0.34;
  contactShadow(ctx, ox, oy, rx, ry, pal.shadowAlpha);
}

export function drawTree(ctx: Ctx, x: number, y: number, r: number, pal: Palette, variant: number): void {
  shadowEllipse(ctx, x, y + r * 0.2, r * 1.15, r * 0.5, pal);
  ctx.fillStyle = pal.trunk;
  ctx.fillRect(x - r * 0.14, y - r * 0.1, r * 0.28, r * 0.5);
  const cols = [pal.treeA, pal.treeB, pal.treeC];
  const baseCol = cols[variant % 3];
  // foliage is lumpy everywhere else in Suri, so it is lumpy here too
  const sd = variant * 7 + 1;
  ctx.fillStyle = shade(baseCol, -0.18);
  blobPath(ctx, x, y - r * 0.15, r * 1.02, sd, 0.16); ctx.fill();
  ctx.fillStyle = baseCol;
  blobPath(ctx, x, y - r * 0.3, r * 0.82, sd + 1, 0.18); ctx.fill();
  blobPath(ctx, x - r * 0.55, y + r * 0.02, r * 0.6, sd + 2, 0.2); ctx.fill();
  blobPath(ctx, x + r * 0.55, y + r * 0.02, r * 0.6, sd + 3, 0.2); ctx.fill();
  ctx.fillStyle = shade(baseCol, 0.28);
  blobPath(ctx, x - r * 0.25, y - r * 0.5, r * 0.36, sd + 4, 0.22); ctx.fill();
  ctx.fillStyle = shade(baseCol, 0.16);
  blobPath(ctx, x + r * 0.3, y - r * 0.15, r * 0.22, sd + 5, 0.22); ctx.fill();
}

export function drawPine(ctx: Ctx, x: number, y: number, r: number, pal: Palette, variant: number): void {
  shadowEllipse(ctx, x, y + r * 0.15, r * 0.9, r * 0.4, pal);
  ctx.fillStyle = pal.trunk; ctx.fillRect(x - r * 0.12, y, r * 0.24, r * 0.35);
  const col = variant % 2 === 0 ? pal.pineA : pal.pineB;
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const w = r * (1.1 - i * 0.28), h = r * 0.9, top = y - r * 0.2 - i * r * 0.55;
    // the sides sag between the needles instead of ruling straight to the tip
    ctx.fillStyle = shade(col, -0.15 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, top - h);
    ctx.quadraticCurveTo(x + w * 0.42, top - h * 0.34, x + w, top);
    ctx.quadraticCurveTo(x, top + h * 0.1, x - w, top);
    ctx.quadraticCurveTo(x - w * 0.42, top - h * 0.34, x, top - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, 0.18 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, top - h);
    ctx.quadraticCurveTo(x - w * 0.42, top - h * 0.34, x - w, top);
    ctx.quadraticCurveTo(x - w * 0.5, top + h * 0.04, x - w * 0.15, top);
    ctx.closePath(); ctx.fill();
  }
}

export function drawPalm(ctx: Ctx, x: number, y: number, r: number, pal: Palette, variant: number): void {
  shadowEllipse(ctx, x, y + r * 0.1, r * 1.2, r * 0.45, pal);
  const lean = (variant % 2 === 0 ? 1 : -1) * r * 0.5;
  ctx.strokeStyle = pal.trunk; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.2); ctx.quadraticCurveTo(x + lean * 0.4, y - r * 0.6, x + lean, y - r * 1.3); ctx.stroke();
  const tx = x + lean, ty = y - r * 1.3;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + variant;
    ctx.fillStyle = i % 2 === 0 ? pal.palmA : pal.palmB;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.62, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#c98a3b'; ctx.beginPath(); ctx.arc(tx, ty, r * 0.14, 0, Math.PI * 2); ctx.fill();
}

export function drawBush(ctx: Ctx, x: number, y: number, r: number, pal: Palette): void {
  ctx.fillStyle = shade(pal.treeB, -0.05);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.arc(x - r * 0.7, y + r * 0.25, r * 0.65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(pal.treeC, 0.1);
  ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
}

export function drawFlowers(ctx: Ctx, x: number, y: number, rng: () => number, pal: Palette): void {
  const cols = ['#ff8fb1', '#ffd66b', '#ffffff', '#c58dff'];
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, d = rng() * 14;
    ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  void pal;
}

export function drawHouse(ctx: Ctx, x: number, y: number, w: number, h: number, roofCol: string, pal: Palette, lights: LightSpot[], rng: () => number): void {
  shadowEllipse(ctx, x, y + 2, w * 0.7, h * 0.45, pal);
  // wall
  ctx.fillStyle = pal.wall; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2, y - h, w, h);
  // roof (oblique)
  const rh = h * 1.05, ov = 3;
  ctx.fillStyle = roofCol;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - ov, y - h); ctx.lineTo(x + w / 2 + ov, y - h); ctx.lineTo(x + w / 2 - 3, y - h - rh); ctx.lineTo(x - w / 2 + 3, y - h - rh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(roofCol, 0.25);
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - h - rh); ctx.lineTo(x + w / 2 - 3, y - h - rh); ctx.lineTo(x + w / 2 - 5, y - h - rh + 3); ctx.lineTo(x - w / 2 + 5, y - h - rh + 3); ctx.closePath(); ctx.fill();
  // chimney
  if (rng() < 0.6) { ctx.fillStyle = shade(roofCol, -0.35); ctx.fillRect(x + w * 0.22, y - h - rh - 3, 4, 6); }
  // door + windows
  ctx.fillStyle = shade(pal.trunk, 0.1); ctx.fillRect(x - 2.5, y - h * 0.55, 5, h * 0.55);
  const wy = y - h * 0.68;
  for (const wx of [x - w * 0.3, x + w * 0.3]) {
    ctx.fillStyle = pal.lightsOn ? pal.window : '#8fc3e8';
    ctx.fillRect(wx - 2.5, wy - 2.5, 5, 5);
    ctx.strokeStyle = 'rgba(90,70,50,0.5)'; ctx.strokeRect(wx - 2.5, wy - 2.5, 5, 5);
    if (pal.lightsOn) lights.push({ x: wx, y: wy, r: 9, color: 'rgba(255,214,120,0.55)', kind: 'window' });
  }
}

export function drawVillage(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[], rng: () => number): void {
  const n = 6 + Math.floor(rng() * 3);
  const spots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6, d = 22 + rng() * 30;
    spots.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 });
  }
  spots.sort((a, b) => a.y - b.y);
  // little square
  ctx.fillStyle = hexA(pal.sandDark, 0.6);
  ctx.beginPath(); ctx.ellipse(x, y + 4, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
  // well
  ctx.fillStyle = '#8d97a5'; ctx.beginPath(); ctx.arc(x, y + 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b6672'; ctx.beginPath(); ctx.arc(x, y + 2, 2.2, 0, Math.PI * 2); ctx.fill();
  for (const s of spots) {
    const w = 16 + rng() * 10, h = 9 + rng() * 5;
    drawHouse(ctx, s.x, s.y, w, h, pal.roof[Math.floor(rng() * pal.roof.length)], pal, lights, rng);
  }
  // a lamp post
  if (pal.lightsOn) lights.push({ x: x + 14, y: y - 6, r: 16, color: 'rgba(255,225,150,0.4)', kind: 'lamp' });
}

export function drawLighthouse(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[]): void {
  // rocks
  ctx.fillStyle = '#7f8794'; ctx.beginPath(); ctx.ellipse(x, y + 4, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#98a1ad'; ctx.beginPath(); ctx.ellipse(x - 6, y + 1, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
  shadowEllipse(ctx, x + 6, y + 4, 14, 6, pal);
  const h = 44, wb = 14, wt = 9;
  // tower with stripes
  const grd = ctx.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#cfd6e0');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.moveTo(x - wb / 2, y); ctx.lineTo(x + wb / 2, y); ctx.lineTo(x + wt / 2, y - h); ctx.lineTo(x - wt / 2, y - h); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#e8484a';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 10, y - 8 - i * 14, 20, 6);
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  // gallery + lantern
  ctx.fillStyle = '#3d4452'; ctx.fillRect(x - 8, y - h - 2, 16, 3);
  ctx.fillStyle = pal.lightsOn ? '#fff1b8' : '#bfe9ff'; ctx.fillRect(x - 5, y - h - 10, 10, 8);
  ctx.fillStyle = '#e8484a'; ctx.beginPath(); ctx.moveTo(x - 7, y - h - 10); ctx.lineTo(x + 7, y - h - 10); ctx.lineTo(x, y - h - 17); ctx.closePath(); ctx.fill();
  lights.push({ x, y: y - h - 6, r: 30, color: 'rgba(255,240,180,0.55)', kind: 'beacon' });
}

export function drawTowerBase(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[]): { x: number; y: number } {
  shadowEllipse(ctx, x + 2, y + 2, 18, 8, pal);
  // base building
  ctx.fillStyle = shade(pal.wall, -0.05); ctx.fillRect(x - 15, y - 12, 30, 12);
  ctx.fillStyle = shade(pal.taxiway, 0.3); ctx.fillRect(x - 16, y - 15, 32, 4);
  // shaft
  const h = 36;
  const grd = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#c6ccd6');
  ctx.fillStyle = grd; ctx.fillRect(x - 5, y - 12 - h, 10, h);
  // cab
  ctx.fillStyle = '#2f4f77'; ctx.beginPath(); ctx.roundRect(x - 11, y - 12 - h - 9, 22, 11, 3); ctx.fill();
  ctx.fillStyle = 'rgba(160,215,255,0.8)'; ctx.fillRect(x - 9, y - 12 - h - 7, 18, 5);
  ctx.fillStyle = '#e8e9ee'; ctx.beginPath(); ctx.roundRect(x - 12, y - 12 - h - 12, 24, 4, 2); ctx.fill();
  const beacon = { x, y: y - 12 - h - 13 };
  lights.push({ x: beacon.x, y: beacon.y, r: 10, color: 'rgba(255,90,90,0.6)', kind: 'beacon' });
  if (pal.lightsOn) lights.push({ x, y: y - 12 - h - 5, r: 14, color: 'rgba(170,220,255,0.45)', kind: 'window' });
  return beacon;
}

export function drawTerminal(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[]): void {
  shadowEllipse(ctx, x + 4, y + 3, 40, 12, pal);
  const w = 74, h = 14;
  ctx.fillStyle = shade(pal.wall, -0.03); ctx.fillRect(x - w / 2, y - h, w, h);
  // glass roof: curved
  const grd = ctx.createLinearGradient(0, y - h - 18, 0, y - h);
  grd.addColorStop(0, '#9fdcff'); grd.addColorStop(1, '#4f9fd8');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 2, y - h); ctx.quadraticCurveTo(x, y - h - 30, x + w / 2 + 2, y - h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, y - h); ctx.lineTo(x + i * 10 * 0.85, y - h - 12 - (3 - Math.abs(i)) * 3); ctx.stroke(); }
  // windows row
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = pal.lightsOn ? pal.window : '#8fc3e8';
    ctx.fillRect(x + i * 10 - 3, y - h + 4, 6, 5);
    if (pal.lightsOn && i % 2 === 0) lights.push({ x: x + i * 10, y: y - h + 6, r: 9, color: 'rgba(255,214,120,0.5)', kind: 'window' });
  }
  // canopy walkway
  ctx.fillStyle = shade(pal.taxiway, 0.25); ctx.fillRect(x - w / 2 + 6, y, w - 12, 5);
}

export function drawHangar(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[]): void {
  shadowEllipse(ctx, x + 4, y + 2, 26, 10, pal);
  const w = 46, h = 16;
  ctx.fillStyle = '#d8dde6'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#7fa6c9';
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.quadraticCurveTo(x, y - h - 22, x + w / 2, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a7c8e4';
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, y - h); ctx.quadraticCurveTo(x, y - h - 16, x + w / 2 - 6, y - h); ctx.closePath(); ctx.fill();
  // big doors
  ctx.fillStyle = '#5c7590'; ctx.fillRect(x - w / 2 + 4, y - h + 3, w - 8, h - 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 4 + i * (w - 8) / 5, y - h + 3); ctx.lineTo(x - w / 2 + 4 + i * (w - 8) / 5, y); ctx.stroke(); }
  if (pal.lightsOn) lights.push({ x, y: y - 4, r: 22, color: 'rgba(255,230,170,0.35)', kind: 'lamp' });
}

export function drawWindmillBase(ctx: Ctx, x: number, y: number, pal: Palette): { x: number; y: number } {
  shadowEllipse(ctx, x + 3, y + 2, 14, 6, pal);
  // stone base
  ctx.fillStyle = '#8b6b4a';
  ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + 7, y - 30); ctx.lineTo(x - 7, y - 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a58460';
  ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x - 2, y); ctx.lineTo(x - 1, y - 30); ctx.lineTo(x - 7, y - 30); ctx.closePath(); ctx.fill();
  // door
  ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 3, y - 9, 6, 9);
  // cap
  ctx.fillStyle = '#4b4f5c';
  ctx.beginPath(); ctx.ellipse(x, y - 31, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3e49';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 31); ctx.lineTo(x + 9, y - 31); ctx.lineTo(x, y - 40); ctx.closePath(); ctx.fill();
  return { x, y: y - 33 };
}

export function drawWindmillBlades(ctx: Ctx, hub: { x: number; y: number }, angle: number): void {
  ctx.save(); ctx.translate(hub.x, hub.y); ctx.rotate(angle);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,240,0.9)';
    ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(7, -8); ctx.lineTo(7, -28); ctx.lineTo(1, -29); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 0.8;
    for (let k = -9; k > -28; k -= 5) { ctx.beginPath(); ctx.moveTo(1, k); ctx.lineTo(7, k - 1); ctx.stroke(); }
    ctx.rotate(Math.PI / 2);
  }
  ctx.fillStyle = '#2f3038'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawCastle(ctx: Ctx, x: number, y: number, pal: Palette, lights: LightSpot[]): void {
  shadowEllipse(ctx, x + 5, y + 4, 42, 14, pal);
  const towerAt = (tx: number, ty: number, w: number, h: number, roof: string): void => {
    const grd = ctx.createLinearGradient(tx - w / 2, 0, tx + w / 2, 0);
    grd.addColorStop(0, '#f6f1ff'); grd.addColorStop(1, '#c9bfe6');
    ctx.fillStyle = grd; ctx.fillRect(tx - w / 2, ty - h, w, h);
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(tx - w / 2 - 3, ty - h); ctx.lineTo(tx + w / 2 + 3, ty - h); ctx.lineTo(tx, ty - h - w * 1.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(roof, 0.3);
    ctx.beginPath(); ctx.moveTo(tx - w / 2 - 3, ty - h); ctx.lineTo(tx, ty - h - w * 1.4); ctx.lineTo(tx - w * 0.1, ty - h - w * 1.4 + 2); ctx.lineTo(tx - w * 0.35, ty - h); ctx.closePath(); ctx.fill();
    // flag
    ctx.strokeStyle = '#5b5470'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, ty - h - w * 1.4); ctx.lineTo(tx, ty - h - w * 1.4 - 9); ctx.stroke();
    ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.moveTo(tx, ty - h - w * 1.4 - 9); ctx.lineTo(tx + 7, ty - h - w * 1.4 - 6.5); ctx.lineTo(tx, ty - h - w * 1.4 - 4); ctx.closePath(); ctx.fill();
    // window
    ctx.fillStyle = pal.lightsOn ? pal.window : '#8fc3e8';
    ctx.beginPath(); ctx.roundRect(tx - 2, ty - h * 0.6 - 3, 4, 6, 2); ctx.fill();
    if (pal.lightsOn) lights.push({ x: tx, y: ty - h * 0.6, r: 10, color: 'rgba(255,214,120,0.55)', kind: 'window' });
  };
  // wall
  ctx.fillStyle = '#e4dcf5'; ctx.fillRect(x - 30, y - 14, 60, 14);
  ctx.fillStyle = '#cfc4ea';
  for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 9 - 3, y - 18, 6, 4);
  ctx.fillStyle = '#5b4a7a'; ctx.beginPath(); ctx.roundRect(x - 5, y - 10, 10, 10, [5, 5, 0, 0]); ctx.fill();
  towerAt(x - 30, y, 14, 28, '#ff8fb1');
  towerAt(x + 30, y, 14, 28, '#ff8fb1');
  towerAt(x, y - 10, 18, 40, '#c58dff');
}

/** Little boat bobbing on the sea (static part). */
export function drawBoat(ctx: Ctx, x: number, y: number, rot: number, pal: Palette): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = `rgba(0,30,60,${pal.shadowAlpha * 0.6})`;
  ctx.beginPath(); ctx.ellipse(3, 3, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath(); ctx.moveTo(13, 0); ctx.quadraticCurveTo(6, -5, -10, -4); ctx.lineTo(-11, 4); ctx.quadraticCurveTo(6, 5, 13, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c85a4a'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(5, -3, -8, -2.5); ctx.lineTo(-9, 2.5); ctx.quadraticCurveTo(5, 3, 10, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -1.5, 5, 3);
  ctx.restore();
}

/** Dense city block grid: roads, blocks and a few towers. */
export function drawCity(ctx: Ctx, x: number, y: number, w: number, h: number, rot: number, pal: Palette, lights: LightSpot[], rng: () => number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = shade(pal.taxiway, 0.18);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill();
  const cols = Math.max(3, Math.round(w / 46)), rows = Math.max(2, Math.round(h / 46));
  const cw = w / cols, ch = h / rows;
  // roads
  ctx.strokeStyle = shade(pal.taxiway, -0.12); ctx.lineWidth = 5;
  for (let i = 1; i < cols; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + i * cw, -h / 2); ctx.lineTo(-w / 2 + i * cw, h / 2); ctx.stroke(); }
  for (let j = 1; j < rows; j++) { ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + j * ch); ctx.lineTo(w / 2, -h / 2 + j * ch); ctx.stroke(); }
  const roofs = ['#d9d3c6', '#c9c2b4', '#bfc6cf', '#d6c4b0', '#c3cbbd'];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const bx = -w / 2 + i * cw + cw / 2, by = -h / 2 + j * ch + ch / 2;
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const bw = cw * (0.22 + rng() * 0.3), bh = ch * (0.22 + rng() * 0.3);
      const ox = (rng() - 0.5) * (cw - bw - 6), oy = (rng() - 0.5) * (ch - bh - 6);
      const tall = rng() < 0.16;
      ctx.fillStyle = `rgba(20,40,60,${pal.shadowAlpha * (tall ? 0.6 : 0.35)})`;
      ctx.fillRect(bx + ox - bw / 2 + (tall ? 5 : 2), by + oy - bh / 2 + (tall ? 6 : 2), bw, bh);
      ctx.fillStyle = tall ? '#e6e9ef' : roofs[Math.floor(rng() * roofs.length)];
      ctx.fillRect(bx + ox - bw / 2, by + oy - bh / 2, bw, bh);
      if (tall) {
        ctx.fillStyle = 'rgba(150,200,240,0.55)';
        ctx.fillRect(bx + ox - bw / 2 + 1.5, by + oy - bh / 2 + 1.5, bw - 3, bh - 3);
        if (pal.lightsOn) lights.push({ x: x + Math.cos(rot) * (bx + ox) - Math.sin(rot) * (by + oy), y: y + Math.sin(rot) * (bx + ox) + Math.cos(rot) * (by + oy), r: 14, color: 'rgba(255,220,150,0.45)', kind: 'window' });
      }
    }
  }
  if (pal.lightsOn) {
    for (let i = 0; i < 8; i++) {
      const lx = (rng() - 0.5) * w, ly = (rng() - 0.5) * h;
      lights.push({ x: x + Math.cos(rot) * lx - Math.sin(rot) * ly, y: y + Math.sin(rot) * lx + Math.cos(rot) * ly, r: 34, color: 'rgba(255,220,150,0.16)', kind: 'lamp' });
    }
  }
  ctx.restore();
}

/** A mountain ridge seen from above: a rocky band with contour lines and snow on the spine. */
export function drawRidge(ctx: Ctx, x: number, y: number, w: number, h: number, rot: number, pal: Palette, rng: () => number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const layers: Array<[number, string]> = [[1, '#6d675f'], [0.74, '#837c72'], [0.5, '#9b9488'], [0.28, '#cfcac1']];
  const n = 16;
  const edge: number[] = [];
  for (let i = 0; i <= n; i++) edge.push(0.72 + rng() * 0.5);
  for (const [k, col] of layers) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const px = -w / 2 + (w * i) / n;
      const py = -h / 2 * k * edge[i];
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    for (let i = n; i >= 0; i--) {
      const px = -w / 2 + (w * i) / n;
      ctx.lineTo(px, (h / 2) * k * edge[(i + 5) % (n + 1)]);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  // snow along the spine
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const px = -w / 2 + (w * i) / n;
    ctx.lineTo(px, -h * 0.06 * edge[i]);
  }
  for (let i = n; i >= 0; i--) {
    const px = -w / 2 + (w * i) / n;
    ctx.lineTo(px, h * 0.07 * edge[(i + 3) % (n + 1)]);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  // ravines running down both flanks
  ctx.strokeStyle = 'rgba(60,55,50,0.28)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 1; i < n; i += 2) {
    const px = -w / 2 + (w * i) / n;
    ctx.beginPath(); ctx.moveTo(px, -h * 0.04); ctx.lineTo(px + (rng() - 0.5) * 18, -h / 2 * 0.92 * edge[i]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, h * 0.04); ctx.lineTo(px + (rng() - 0.5) * 18, h / 2 * 0.92 * edge[(i + 5) % (n + 1)]); ctx.stroke();
  }
  ctx.restore();
  void pal;
}

/** A single peak from above: concentric contours with a snow cap. */
export function drawMountain(ctx: Ctx, x: number, y: number, r: number, pal: Palette): void {
  ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.7})`;
  ctx.beginPath(); ctx.ellipse(x + r * 0.22, y + r * 0.2, r * 1.02, r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  const rings: Array<[number, string]> = [[1, '#6d675f'], [0.78, '#7f786e'], [0.58, '#948d82'], [0.4, '#b6b0a6'], [0.24, '#ffffff']];
  for (const [k, col] of rings) {
    ctx.beginPath();
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wob = 1 + 0.16 * Math.sin(a * 3 + k * 7);
      const px = x + Math.cos(a) * r * k * wob - r * 0.08 * (1 - k);
      const py = y + Math.sin(a) * r * k * 0.9 * wob - r * 0.1 * (1 - k);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  // ridge lines radiating from the summit
  ctx.strokeStyle = 'rgba(60,55,50,0.3)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(x - r * 0.06, y - r * 0.08); ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.86); ctx.stroke();
  }
}

/** Sandy beach strip. */
export function drawBeach(ctx: Ctx, x: number, y: number, w: number, h: number, rot: number, pal: Palette): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = pal.sand; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = hexA(pal.sandDark, 0.5); ctx.beginPath(); ctx.roundRect(-w / 2, h * 0.1, w, h * 0.4, h * 0.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + (w / 6) * i + 6, -h / 2 - 2, 10, 2);
  ctx.restore();
}
