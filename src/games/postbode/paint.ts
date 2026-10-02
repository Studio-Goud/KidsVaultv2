/**
 * Everything Postbode Suri draws: the sky, the houses with their doors and number plates, the people
 * who wave, the tree, the letter and the parcel, the bag on Suri's shoulder. All paths, no images.
 *
 * The house is built so the number is the biggest thing on its wall and sits above the door, where
 * Suri standing on the pavement in front does not hide it.
 */

import { roundRectPath, shade, hexA } from '../../render/look';
import type { Resident } from './model';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const FONT = 'Nunito, system-ui, sans-serif';

export const WALLS = ['#e9a38f', '#f3d98b', '#9fc7e8', '#b9d99a', '#d9b6e0', '#f0b57a'];
const ROOFS = ['#8b4a3a', '#5b6b8a', '#7a5a45'];
const DOORS = ['#c0392b', '#2f6fb0', '#2f8f5b', '#e0a21b', '#7a4aa3'];

export interface HouseArt {
  x: number; base: number; w: number; h: number; n: number;
  hidden: boolean;
  /** 0 closed, 1 wide open */
  open: number;
  resident: Resident;
  /** 0..1 soft glow round the door, for the simple shape */
  glow: number;
  /** show a doorbell, and pulse it when `bellPulse` is above 0 */
  bell: boolean;
  bellPulse: number;
  /** 0..1 a small wobble after a wrong tap */
  shake: number;
  t: number;
}

export interface Geom {
  bodyTop: number;
  door: { x: number; y: number; w: number; h: number };
  slot: { x: number; y: number };
  plate: { x: number; y: number; w: number; h: number };
  bell: { x: number; y: number; r: number };
}

/** Where everything sits on a house, so a flying letter can aim at the slot. */
export function geom(x: number, base: number, w: number, h: number): Geom {
  const bodyH = h * 0.74, bodyTop = base - bodyH;
  const dw = w * 0.3, dh = bodyH * 0.48;
  const door = { x: x + w / 2 - dw / 2, y: base - dh, w: dw, h: dh };
  const pw = w * 0.46, ph = bodyH * 0.25;
  return {
    bodyTop, door,
    slot: { x: x + w / 2, y: door.y + dh * 0.3 },
    plate: { x: x + w / 2 - pw / 2, y: bodyTop + bodyH * 0.24, w: pw, h: ph },
    bell: { x: door.x + dw + w * 0.09, y: base - dh * 0.5, r: w * 0.05 },
  };
}

export function paintHouse(ctx: Ctx, o: HouseArt): void {
  const { x, base, w, h, n } = o;
  const g = geom(x, base, w, h);
  const wall = WALLS[(n * 7 + 3) % 6], roof = ROOFS[n % 3], doorCol = DOORS[(n * 5) % 5];
  const bodyH = h * 0.74, roofH = h - bodyH;
  const sh = o.shake > 0 ? Math.sin(o.shake * 30) * o.shake * w * 0.03 : 0;
  ctx.save();
  ctx.translate(sh, 0);

  // body, with a darker foot so it sits on the pavement
  ctx.fillStyle = wall;
  ctx.fillRect(x, g.bodyTop, w, bodyH);
  ctx.fillStyle = shade(wall, -0.12);
  ctx.fillRect(x, base - bodyH * 0.07, w, bodyH * 0.07);
  // brick hint
  ctx.strokeStyle = hexA('#7a3b2a', 0.1); ctx.lineWidth = 1;
  for (let r = 1; r < 6; r++) { const yy = g.bodyTop + r * bodyH / 6; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }

  // roof: pointed on some, stepped gable (a Dutch trapgevel) on others
  ctx.fillStyle = roof;
  ctx.beginPath();
  if (n % 2 === 0) {
    ctx.moveTo(x - w * 0.06, g.bodyTop + 1); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w * 1.06, g.bodyTop + 1);
  } else {
    const s = roofH / 3;
    ctx.moveTo(x, g.bodyTop + 1);
    ctx.lineTo(x, g.bodyTop - s); ctx.lineTo(x + w * 0.2, g.bodyTop - s);
    ctx.lineTo(x + w * 0.2, g.bodyTop - 2 * s); ctx.lineTo(x + w * 0.35, g.bodyTop - 2 * s);
    ctx.lineTo(x + w * 0.35, base - h); ctx.lineTo(x + w * 0.65, base - h);
    ctx.lineTo(x + w * 0.65, g.bodyTop - 2 * s); ctx.lineTo(x + w * 0.8, g.bodyTop - 2 * s);
    ctx.lineTo(x + w * 0.8, g.bodyTop - s); ctx.lineTo(x + w, g.bodyTop - s);
    ctx.lineTo(x + w, g.bodyTop + 1);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(roof, -0.2);
  ctx.fillRect(x - w * 0.02, g.bodyTop - 1, w * 1.04, 3);

  // windows either side of the plate
  const wy = g.bodyTop + bodyH * 0.1, wh = bodyH * 0.3, ww = w * 0.18;
  for (const wx of [x + w * 0.08, x + w * 0.74]) {
    ctx.fillStyle = '#fffaf0'; roundRectPath(ctx, wx - 2, wy - 2, ww + 4, wh + 4, 3); ctx.fill();
    const gl = ctx.createLinearGradient(0, wy, 0, wy + wh);
    gl.addColorStop(0, '#bfe3f5'); gl.addColorStop(1, '#7fb8dc');
    ctx.fillStyle = gl; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
  }

  // the door, and what is behind it
  const d = g.door;
  if (o.glow > 0) {
    const pulse = 0.65 + 0.35 * Math.sin(o.t * 4);
    const rg = ctx.createRadialGradient(d.x + d.w / 2, d.y + d.h * 0.5, d.w * 0.2, d.x + d.w / 2, d.y + d.h * 0.5, w * 0.8);
    rg.addColorStop(0, `rgba(255,236,150,${0.85 * o.glow * pulse})`);
    rg.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - w * 0.3, g.bodyTop - h * 0.1, w * 1.6, h * 1.2);
  }
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(d.x - 3, d.y - 3, d.w + 6, d.h + 3, [d.w * 0.5, d.w * 0.5, 0, 0]); ctx.fill();
  if (o.open > 0.02) {
    const inner = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
    inner.addColorStop(0, '#6b4a3a'); inner.addColorStop(1, '#2e2018');
    ctx.fillStyle = inner; ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, [d.w * 0.45, d.w * 0.45, 0, 0]); ctx.fill();
    paintResident(ctx, o.resident, d.x + d.w / 2, base - 1, d.h * 1.05 * Math.min(1, o.open * 1.6), o.t);
  }
  // the door leaf swings away to the left as it opens
  const lw = d.w * (1 - o.open * 0.86);
  ctx.fillStyle = doorCol;
  ctx.beginPath(); ctx.roundRect(d.x, d.y, lw, d.h, [d.w * 0.45, 0, 0, 0]); ctx.fill();
  ctx.fillStyle = shade(doorCol, -0.2);
  roundRectPath(ctx, d.x + lw * 0.15, d.y + d.h * 0.12, lw * 0.7, d.h * 0.3, 3); ctx.fill();
  if (o.open < 0.5) {
    // the letterbox slot and the handle
    ctx.fillStyle = '#e8c35a'; roundRectPath(ctx, g.slot.x - d.w * 0.3, g.slot.y - 3, d.w * 0.6, 6, 3); ctx.fill();
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(g.slot.x - d.w * 0.24, g.slot.y - 1, d.w * 0.48, 2);
    ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(d.x + d.w * 0.82, d.y + d.h * 0.62, 2.6, 0, TAU); ctx.fill();
  }
  // step
  ctx.fillStyle = '#d9d2c6'; ctx.fillRect(d.x - 6, base - 3, d.w + 12, 3);

  // number plate
  const p = g.plate;
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; roundRectPath(ctx, p.x, p.y + 2, p.w, p.h, p.h * 0.3); ctx.fill();
  ctx.fillStyle = '#ffffff'; roundRectPath(ctx, p.x, p.y, p.w, p.h, p.h * 0.3); ctx.fill();
  ctx.strokeStyle = '#2f6fb0'; ctx.lineWidth = 2; roundRectPath(ctx, p.x + 2, p.y + 2, p.w - 4, p.h - 4, p.h * 0.25); ctx.stroke();
  ctx.fillStyle = '#123047'; ctx.font = `900 ${Math.round(p.h * 0.78)}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(n), p.x + p.w / 2, p.y + p.h * 0.78, p.w - 8);

  if (o.bell) paintBell(ctx, g.bell.x, g.bell.y, g.bell.r, o.bellPulse, o.t);

  if (o.hidden) paintTree(ctx, x + w / 2, base, w, bodyH, o.t, o.shake);
  ctx.restore();
}

export function paintBell(ctx: Ctx, x: number, y: number, r: number, pulse: number, t: number): void {
  const k = 1 + pulse * (1.7 + 0.25 * Math.sin(t * 7));
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  if (pulse > 0) { ctx.fillStyle = 'rgba(255,236,150,0.6)'; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#c9a23a'; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7a5a1a';
  ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.5, Math.PI, 0); ctx.lineTo(r * 0.6, r * 0.3); ctx.lineTo(-r * 0.6, r * 0.3); ctx.fill();
  ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}

/** A round tree standing in front of a house: it covers the door and the number, not the windows. */
export function paintTree(ctx: Ctx, cx: number, base: number, w: number, bodyH: number, t: number, shake: number): void {
  const sway = Math.sin(t * 1.6 + cx * 0.05) * w * 0.012 + (shake > 0 ? Math.sin(shake * 30) * shake * w * 0.04 : 0);
  ctx.fillStyle = '#7a5236'; ctx.fillRect(cx - w * 0.05, base - bodyH * 0.45, w * 0.1, bodyH * 0.45);
  const blobs: Array<[number, number, number, string]> = [
    [-0.2, 0.52, 0.27, '#4f9a58'], [0.2, 0.52, 0.27, '#4f9a58'], [0, 0.72, 0.3, '#5fae6a'], [-0.12, 0.88, 0.22, '#6fbd77'], [0.14, 0.86, 0.22, '#5fae6a'],
  ];
  for (const [bx, by, br, col] of blobs) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + bx * w + sway * by, base - bodyH * by * 0.9, br * w, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(cx - w * 0.12 + sway, base - bodyH * 0.8, w * 0.1, 0, TAU); ctx.fill();
}

/** Someone at the door, waving. `s` is their height, the origin is their feet. */
export function paintResident(ctx: Ctx, kind: Resident, x: number, y: number, s: number, t: number): void {
  if (s < 2) return;
  const wave = Math.sin(t * 9) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  const skin = '#f2c9a6';
  const arm = (sx: number, col: string): void => {
    ctx.save(); ctx.translate(sx * s * 0.17, -s * 0.52); ctx.rotate(-2.5 * sx + wave * sx);
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.26); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, s * 0.28, s * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const face = (cy: number, r: number): void => {
    ctx.fillStyle = '#2a1d16';
    ctx.beginPath(); ctx.arc(-r * 0.36, cy - r * 0.05, r * 0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.36, cy - r * 0.05, r * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a0463a'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, cy + r * 0.12, r * 0.38, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(240,120,110,0.35)';
    ctx.beginPath(); ctx.arc(-r * 0.58, cy + r * 0.25, r * 0.15, 0, TAU); ctx.arc(r * 0.58, cy + r * 0.25, r * 0.15, 0, TAU); ctx.fill();
  };
  if (kind === 'dog') {
    const k = s * 0.85;
    ctx.fillStyle = '#b07a45';
    ctx.beginPath(); ctx.ellipse(0, -k * 0.28, k * 0.26, k * 0.3, 0, 0, TAU); ctx.fill();
    // tail, wagging
    ctx.strokeStyle = '#b07a45'; ctx.lineWidth = k * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(k * 0.2, -k * 0.1); ctx.quadraticCurveTo(k * 0.45, -k * 0.2 + wave * k * 0.4, k * 0.4, -k * 0.5 + wave * k * 0.3); ctx.stroke();
    ctx.fillStyle = '#b07a45'; ctx.beginPath(); ctx.arc(0, -k * 0.68, k * 0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a4d28';
    ctx.beginPath(); ctx.ellipse(-k * 0.21, -k * 0.66, k * 0.08, k * 0.17, 0.3, 0, TAU); ctx.ellipse(k * 0.21, -k * 0.66, k * 0.08, k * 0.17, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4e3c8'; ctx.beginPath(); ctx.ellipse(0, -k * 0.6, k * 0.12, k * 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1d16';
    ctx.beginPath(); ctx.arc(-k * 0.08, -k * 0.72, k * 0.03, 0, TAU); ctx.arc(k * 0.08, -k * 0.72, k * 0.03, 0, TAU); ctx.arc(0, -k * 0.63, k * 0.035, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8707a'; ctx.beginPath(); ctx.ellipse(0, -k * 0.52, k * 0.04, k * 0.06 + Math.abs(wave) * k * 0.04, 0, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  const dress = kind === 'grandma' ? '#9b7bc4' : kind === 'child' ? '#e9573f' : '#3f7fb0';
  // body
  ctx.fillStyle = dress;
  ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, -s * 0.12, -s * 0.58); ctx.lineTo(s * 0.12, -s * 0.58); ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.2, 0); ctx.closePath(); ctx.fill();
  if (kind === 'child') {
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.2, -s * 0.46 + i * s * 0.14, s * 0.4, s * 0.05);
  }
  arm(1, dress);
  const hr = s * (kind === 'child' ? 0.2 : 0.17), hy = -s * 0.74;
  // hair behind the head
  if (kind === 'grandma') {
    ctx.fillStyle = '#d9d9de'; ctx.beginPath(); ctx.arc(0, hy - hr * 0.1, hr * 1.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, hy - hr * 1.1, hr * 0.42, 0, TAU); ctx.fill();
  } else if (kind === 'child') {
    ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.arc(0, hy - hr * 0.1, hr * 1.1, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(hr * 0.2, hy - hr * 1.15, hr * 0.28, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, hr, 0, TAU); ctx.fill();
  if (kind === 'man') {
    ctx.fillStyle = '#2f5d8a'; ctx.beginPath(); ctx.arc(0, hy - hr * 0.25, hr * 1.05, Math.PI, 0); ctx.fill();
    ctx.fillRect(-hr * 1.05, hy - hr * 0.3, hr * 2.4, hr * 0.28);
    ctx.fillStyle = '#6b4a35'; ctx.beginPath(); ctx.ellipse(0, hy + hr * 0.5, hr * 0.5, hr * 0.14, 0, 0, TAU); ctx.fill();
  }
  face(hy, hr);
  if (kind === 'grandma') {
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = Math.max(1, hr * 0.08);
    ctx.beginPath(); ctx.arc(-hr * 0.36, hy - hr * 0.05, hr * 0.26, 0, TAU); ctx.arc(hr * 0.36, hy - hr * 0.05, hr * 0.26, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/** An envelope with the number on it, or a parcel with the number on its label. */
export function paintLetter(ctx: Ctx, x: number, y: number, w: number, h: number, n: number | null, parcel: boolean, rot = 0): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  if (parcel) {
    ctx.fillStyle = '#c99a62'; roundRectPath(ctx, 0, 0, w, h, h * 0.12); ctx.fill();
    ctx.fillStyle = '#a97a44'; ctx.fillRect(0, h * 0.42, w, h * 0.16); ctx.fillRect(w * 0.43, 0, w * 0.14, h);
    ctx.fillStyle = '#ffffff'; roundRectPath(ctx, w * 0.2, h * 0.14, w * 0.6, h * 0.34, h * 0.08); ctx.fill();
  } else {
    ctx.fillStyle = '#fffaf0'; roundRectPath(ctx, 0, 0, w, h, h * 0.12); ctx.fill();
    ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = Math.max(1.5, h * 0.04);
    roundRectPath(ctx, 0, 0, w, h, h * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, h * 0.5); ctx.lineTo(w, 0); ctx.stroke();
    // a stamp
    ctx.fillStyle = '#e9573f'; ctx.fillRect(w * 0.8, h * 0.58, w * 0.13, h * 0.26);
  }
  if (n !== null) {
    ctx.fillStyle = '#123047'; ctx.font = `900 ${Math.round(h * (parcel ? 0.3 : 0.4))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(n), w * (parcel ? 0.5 : 0.42), h * (parcel ? 0.4 : 0.82), w * 0.5);
  }
  ctx.restore();
}

/** Suri's post bag: a satchel on the hip with a strap across the chest. `face` is the way he looks. */
export function paintBag(ctx: Ctx, x: number, y: number, size: number, face: number): void {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y); ctx.scale(face * s, s);
  ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -50); ctx.lineTo(10, -24); ctx.stroke();
  ctx.fillStyle = '#d9822b'; roundRectPath(ctx, 5, -34, 22, 18, 4); ctx.fill();
  ctx.fillStyle = '#b8681c'; roundRectPath(ctx, 5, -34, 22, 7, 3); ctx.fill();
  ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(16, -26, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

export function paintSky(ctx: Ctx, w: number, h: number, cam: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fd0f2'); g.addColorStop(0.6, '#cfeefa'); g.addColorStop(1, '#f6f1dc');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) {
    const span = w + 240;
    const cx = (((i * 217 + t * 5 - cam * 0.15) % span) + span) % span - 120;
    const cy = h * (0.12 + ((i * 37) % 30) / 100);
    ctx.beginPath(); ctx.ellipse(cx, cy, 46, 14, 0, 0, TAU); ctx.ellipse(cx + 24, cy - 9, 28, 14, 0, 0, TAU); ctx.ellipse(cx - 26, cy - 5, 24, 11, 0, 0, TAU); ctx.fill();
  }
}

/** A strip of pavement tiles, scrolling with the street. */
export function paintPavement(ctx: Ctx, x: number, y: number, w: number, h: number, cam: number, tile: number): void {
  ctx.fillStyle = '#d6cfc3'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c4bcae'; ctx.fillRect(x, y, w, Math.max(2, h * 0.07));
  ctx.strokeStyle = 'rgba(120,108,92,0.35)'; ctx.lineWidth = 1.5;
  const off = -(cam % tile);
  for (let px = off; px < w; px += tile) { ctx.beginPath(); ctx.moveTo(px, y + h * 0.07); ctx.lineTo(px - tile * 0.2, y + h); ctx.stroke(); }
}

/** The road between the two sides, with its dashes. */
export function paintRoad(ctx: Ctx, x: number, y: number, w: number, h: number, cam: number): void {
  ctx.fillStyle = '#6f7480'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f6f1dc';
  const dash = h * 1.6, off = -(cam % (dash * 2));
  for (let px = off; px < w; px += dash * 2) ctx.fillRect(px, y + h * 0.46, dash, Math.max(2, h * 0.08));
}

/** A chevron at the edge of the street that says there is more of it that way. */
export function paintChevron(ctx: Ctx, x: number, y: number, size: number, dir: -1 | 1, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#25506e'; ctx.lineWidth = size * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-dir * size * 0.2, -size * 0.45); ctx.lineTo(dir * size * 0.25, 0); ctx.lineTo(-dir * size * 0.2, size * 0.45); ctx.stroke();
  ctx.restore();
}

