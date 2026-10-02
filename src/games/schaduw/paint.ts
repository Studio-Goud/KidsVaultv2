/**
 * Everything Schaduwspel draws, in code.
 *
 * The object is a soft flat-shaded solid lit by the lamp, so the child sees what it is; the
 * shadow on the wall is a soft dark shape; the target is only an outline, so the two can be told
 * apart when they lie on top of each other. The game and the hub card both draw through here.
 */

import { LAMP, rotate, WALL_R, type ObjectModel, type Shadow } from './model';
import { mix, roundRectPath } from '../../render/look';

type Ctx = CanvasRenderingContext2D;

/** How far the camera looks down on the turntable, in radians. */
export const CAM = 0.28;
const CC = Math.cos(CAM), SC = Math.sin(CAM);

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** The dim room behind everything. */
export function drawRoom(ctx: Ctx, w: number, h: number, lampX: number, lampY: number, glow: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#231f3a');
  g.addColorStop(1, '#342c52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the lamp's pool of light on the room, warmest at the lamp
  const r = Math.max(w, h) * 0.75;
  const rg = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, r);
  rg.addColorStop(0, `rgba(255, 214, 140, ${0.34 * glow})`);
  rg.addColorStop(0.35, `rgba(255, 190, 120, ${0.1 * glow})`);
  rg.addColorStop(1, 'rgba(255, 190, 120, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

/** A standing lamp, its shade open towards the object. */
export function drawLamp(ctx: Ctx, x: number, y: number, s: number, floorY: number, t: number): void {
  ctx.save();
  // base and pole
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, floorY, s * 0.6, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a5a7e';
  ctx.beginPath(); ctx.ellipse(x, floorY - s * 0.03, s * 0.5, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7d6c92';
  ctx.fillRect(x - s * 0.06, y + s * 0.3, s * 0.12, Math.max(0, floorY - y - s * 0.3));
  // the bulb's glow, which breathes very slightly
  const flick = 1 + Math.sin(t * 2.3) * 0.015;
  const bx = x + s * 0.34, by = y;
  const bg = ctx.createRadialGradient(bx, by, 0, bx, by, s * 1.5 * flick);
  bg.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
  bg.addColorStop(0.25, 'rgba(255, 214, 140, 0.5)');
  bg.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(bx, by, s * 1.5 * flick, 0, Math.PI * 2); ctx.fill();
  // shade: a cone open to the right
  ctx.fillStyle = '#c9a0d8';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.18, y - s * 0.12);
  ctx.lineTo(x + s * 0.4, y - s * 0.46);
  ctx.lineTo(x + s * 0.4, y + s * 0.46);
  ctx.lineTo(x - s * 0.18, y + s * 0.12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff2c6';
  ctx.beginPath(); ctx.ellipse(x + s * 0.4, y, s * 0.1, s * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** The cone of light from the lamp to the corners of the wall panel. */
export function drawBeam(ctx: Ctx, lx: number, ly: number, px: number, py: number, size: number, alpha: number): void {
  const g = ctx.createLinearGradient(lx, 0, px, 0);
  g.addColorStop(0, `rgba(255, 226, 160, ${0.2 * alpha})`);
  g.addColorStop(1, `rgba(255, 226, 160, ${0.06 * alpha})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(px, py);
  ctx.lineTo(px, py + size);
  ctx.closePath();
  ctx.fill();
}

/** The turntable; its notches turn with the object, which is what shows a child it is being turned. */
export function drawTurntable(ctx: Ctx, cx: number, cy: number, rx: number, yaw: number): void {
  const ry = rx * SC, th = rx * 0.16;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(cx, cy + th + ry * 0.2, rx * 1.12, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4a72';
  ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - rx, cy, rx * 2, th);
  ctx.fillStyle = '#6e5c8a';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#80709c';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2); ctx.fill();
  // notches on the rim
  ctx.fillStyle = '#f2d890';
  for (let i = 0; i < 12; i++) {
    const a = yaw + (i / 12) * Math.PI * 2;
    const z = Math.cos(a);
    if (z < -0.1) continue;
    ctx.beginPath();
    ctx.ellipse(cx + Math.sin(a) * rx * 0.93, cy + z * ry * 0.93, rx * 0.035, rx * 0.035 * SC + 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The object as a soft flat-shaded solid. Faces are sorted far to near, lit by the lamp (so the
 * side towards the lamp is bright), and each is stroked in its own colour to close the seams.
 */
export function drawObject(ctx: Ctx, m: ObjectModel, yaw: number, pitch: number, cx: number, cy: number, k: number, alpha = 1): void {
  const rp = m.pts.map(p => rotate(p, yaw, pitch));
  const sx = rp.map(p => cx + p[0] * k);
  const sy = rp.map(p => cy - (p[1] * CC - p[2] * SC) * k);
  interface Item { i: number; depth: number; b: number }
  const items: Item[] = [];
  for (let i = 0; i < m.faces.length; i++) {
    const f = m.faces[i];
    if (f.length < 3) continue;
    let nx = 0, ny = 0, nz = 0, mx = 0, my = 0, mz = 0;
    for (let a = 0; a < f.length; a++) {
      const p = rp[f[a]], q = rp[f[(a + 1) % f.length]];
      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
      mx += p[0]; my += p[1]; mz += p[2];
    }
    mx /= f.length; my /= f.length; mz /= f.length;
    let nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-6) continue;
    nx /= nl; ny /= nl; nz /= nl;
    // no winding to trust: the normal is turned to face the camera
    const facing = ny * SC + nz * CC;
    if (facing < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lx = LAMP.x - mx, ly = LAMP.y - my, lz = LAMP.z - mz;
    nl = Math.hypot(lx, ly, lz) || 1;
    const lam = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
    const b = clamp(0.3 + 0.62 * lam + 0.1 * Math.abs(facing), 0, 1);
    items.push({ i, depth: mz * CC + my * SC, b });
  }
  items.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.9;
  for (const it of items) {
    const f = m.faces[it.i];
    const col = mix('#15112a', m.faceColour[it.i], clamp(0.18 + 0.95 * it.b, 0, 1.1) > 1 ? 1 : clamp(0.18 + 0.95 * it.b, 0, 1));
    ctx.fillStyle = col; ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(sx[f[0]], sy[f[0]]);
    for (let a = 1; a < f.length; a++) ctx.lineTo(sx[f[a]], sy[f[a]]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export interface Panel { x: number; y: number; size: number }

const wx = (p: Panel, x: number): number => p.x + (x / WALL_R * 0.5 + 0.5) * p.size;
const wy = (p: Panel, y: number): number => p.y + (0.5 - y / WALL_R * 0.5) * p.size;

function shadowPath(ctx: Ctx, s: Shadow, p: Panel): void {
  ctx.beginPath();
  for (const poly of s) {
    if (poly.length < 3) continue;
    ctx.moveTo(wx(p, poly[0].x), wy(p, poly[0].y));
    for (let i = 1; i < poly.length; i++) ctx.lineTo(wx(p, poly[i].x), wy(p, poly[i].y));
    ctx.closePath();
  }
}

/** The wall: a pale lit patch in the dark room, with a frame. `glow` is 0..1 and warms it when a shadow fits. */
export function drawWall(ctx: Ctx, p: Panel, glow: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = p.size * 0.08;
  ctx.fillStyle = '#d9cfc2';
  roundRectPath(ctx, p.x, p.y, p.size, p.size, p.size * 0.05);
  ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(p.x, p.y + p.size / 2, p.size * 0.1, p.x + p.size * 0.4, p.y + p.size / 2, p.size * 1.1);
  g.addColorStop(0, '#f6e6c4');
  g.addColorStop(1, '#bfae9a');
  ctx.fillStyle = g;
  roundRectPath(ctx, p.x, p.y, p.size, p.size, p.size * 0.05);
  ctx.fill();
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.strokeStyle = '#ffe28a';
    ctx.lineWidth = Math.max(3, p.size * 0.025);
    roundRectPath(ctx, p.x, p.y, p.size, p.size, p.size * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * The dark shape on the wall: solid in the middle, soft at the edge. It is drawn opaque, in one
 * colour, because a see-through fill lets every face's own blur show through as a hairy texture;
 * `soft` only decides how wide the soft edge is.
 */
export function drawShadow(ctx: Ctx, s: Shadow, p: Panel, dpr: number, soft = 1): void {
  ctx.save();
  roundRectPath(ctx, p.x, p.y, p.size, p.size, p.size * 0.05);
  ctx.clip();
  ctx.shadowColor = 'rgba(54, 42, 78, 0.85)';
  ctx.shadowBlur = Math.max(4, p.size * 0.04) * dpr * soft;
  ctx.fillStyle = '#3b3055';
  shadowPath(ctx, s, p);
  ctx.fill('nonzero');
  // the seams between faces, closed without a blur of their own
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#3b3055';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
}

/** The shape to fit: a dashed gold outline on a faint warm fill, brighter the closer the match. */
export function drawTarget(ctx: Ctx, s: Shadow, p: Panel, closeness: number, solved: boolean, t: number): void {
  ctx.save();
  roundRectPath(ctx, p.x, p.y, p.size, p.size, p.size * 0.05);
  ctx.clip();
  shadowPath(ctx, s, p);
  ctx.fillStyle = solved ? 'rgba(255, 214, 110, 0.55)' : 'rgba(120, 90, 40, 0.16)';
  ctx.fill('nonzero');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(214, 150, 20, ${solved ? 1 : 0.55 + 0.4 * closeness})`;
  ctx.lineWidth = Math.max(2.5, p.size * 0.014) * (1 + closeness * 0.5);
  if (!solved) { ctx.setLineDash([p.size * 0.04, p.size * 0.03]); ctx.lineDashOffset = -t * p.size * 0.03; }
  ctx.stroke();
  ctx.restore();
}

/** A soft chevron arrow showing which way to drag. */
export function drawArrow(ctx: Ctx, x: number, y: number, s: number, dir: 'left' | 'right' | 'up' | 'down', alpha: number, nudge: number): void {
  const a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.translate(nudge * s * 0.3, 0);
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40, 24, 60, 0.55)';
  ctx.lineWidth = s * 0.34;
  for (const off of [-0.5, 0.35]) {
    ctx.beginPath(); ctx.moveTo(off * s - s * 0.3, -s * 0.5); ctx.lineTo(off * s + s * 0.2, 0); ctx.lineTo(off * s - s * 0.3, s * 0.5); ctx.stroke();
  }
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = s * 0.2;
  for (const off of [-0.5, 0.35]) {
    ctx.beginPath(); ctx.moveTo(off * s - s * 0.3, -s * 0.5); ctx.lineTo(off * s + s * 0.2, 0); ctx.lineTo(off * s - s * 0.3, s * 0.5); ctx.stroke();
  }
  ctx.restore();
}
