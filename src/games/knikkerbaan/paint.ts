/**
 * Knikkerbaan - everything drawn in code: the pegboard wall, the planks, pegs, cup and marble.
 *
 * The wall is painted once into an offscreen canvas (grain and holes are hundreds of strokes) and
 * blitted each frame. The rest is cheap enough to draw live. No images, as everywhere in Suri.
 */

import { makeRng } from '../../util/rng';
import { TAU } from '../../util/math';
import { roundRectPath, shade } from '../../render/look';
import { CUP_INNER, CUP_RIM_Y, GRID, H, MARBLE_R, PLANK_T, W, plankEnds, type Level, type Peg, type Plank } from './model';

type Ctx = CanvasRenderingContext2D;

/** The wooden wall with its grain and a hole at every grid point, cached per size. */
export class WallArt {
  private cache: HTMLCanvasElement | null = null;
  private key = '';

  paint(ctx: Ctx, x: number, y: number, s: number, dpr: number): void {
    const k = `${Math.round(s * dpr)}:${dpr}`;
    if (k !== this.key || !this.cache) {
      this.key = k;
      const c = document.createElement('canvas');
      const pw = Math.round(W * s * dpr), ph = Math.round(H * s * dpr);
      c.width = pw; c.height = ph;
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      this.draw(g, W * s, H * s, s);
      this.cache = c;
    }
    ctx.drawImage(this.cache, x, y, W * s, H * s);
  }

  private draw(g: Ctx, w: number, h: number, s: number): void {
    const rng = makeRng(31);
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#e6c48c'); base.addColorStop(0.5, '#dcb678'); base.addColorStop(1, '#cfa468');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // long boards side by side, each with its own tone
    const boards = 3, bw = w / boards;
    for (let b = 0; b < boards; b++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '255,236,196' : '120,76,30'},${0.05 + rng() * 0.06})`;
      g.fillRect(b * bw, 0, bw, h);
      g.fillStyle = 'rgba(80,48,18,0.35)'; g.fillRect(b * bw - 1, 0, 2, h);
    }
    // grain: long wavy strokes down the boards
    g.lineWidth = Math.max(0.8, s * 0.03);
    for (let i = 0; i < 90; i++) {
      const x0 = rng() * w, amp = (rng() - 0.5) * s * 0.5, ph = rng() * 6;
      g.strokeStyle = `rgba(110,68,26,${0.06 + rng() * 0.12})`;
      g.beginPath();
      for (let yy = 0; yy <= h; yy += s * 0.5) g.lineTo(x0 + Math.sin(yy / s * 0.9 + ph) * amp, yy);
      g.stroke();
    }
    // a few knots
    for (let i = 0; i < 4; i++) {
      const kx = rng() * w, ky = rng() * h;
      for (let r = 3; r > 0; r--) { g.strokeStyle = `rgba(100,60,22,${0.12 + r * 0.05})`; g.beginPath(); g.ellipse(kx, ky, s * 0.1 * r, s * 0.17 * r, 0, 0, TAU); g.stroke(); }
    }
    // the pegboard holes
    for (let gx = GRID; gx < W; gx += GRID) {
      for (let gy = GRID; gy < H; gy += GRID) {
        const px = gx * s, py = gy * s, r = s * 0.045;
        g.fillStyle = 'rgba(70,40,14,0.55)'; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,240,205,0.35)'; g.beginPath(); g.arc(px, py + r * 0.5, r * 0.8, 0, Math.PI); g.fill();
      }
    }
    // the frame
    g.strokeStyle = '#7a4c22'; g.lineWidth = s * 0.18; g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,230,180,0.5)'; g.lineWidth = 1.2; g.strokeRect(s * 0.1, s * 0.1, w - s * 0.2, h - s * 0.2);
  }
}

/** Wall to screen. */
export interface View { ox: number; oy: number; s: number }
const sx = (v: View, x: number): number => v.ox + x * v.s;
const sy = (v: View, y: number): number => v.oy + y * v.s;

export function paintPlank(ctx: Ctx, v: View, p: Plank, o: { fixed?: boolean; ghost?: boolean; bad?: boolean; lift?: number } = {}): void {
  const [a, b] = plankEnds(p);
  const cx = sx(v, p.x), cy = sy(v, p.y);
  const len = p.len * v.s, th = PLANK_T * 2 * v.s * 1.15;
  const lift = o.lift ?? 0;
  ctx.save();
  ctx.translate(cx, cy - lift);
  ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  ctx.globalAlpha = o.ghost ? 0.85 : 1;
  // shadow on the wall
  ctx.fillStyle = 'rgba(60,34,10,0.28)';
  roundRectPath(ctx, -len / 2 + 2, -th / 2 + 3 + lift, len, th, th * 0.4); ctx.fill();
  const light = o.fixed ? '#c99a5c' : '#f3d9a4', dark = o.fixed ? '#a8773c' : '#dcb26f';
  const gr = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
  gr.addColorStop(0, light); gr.addColorStop(1, dark);
  ctx.fillStyle = o.bad ? '#e9a392' : gr;
  roundRectPath(ctx, -len / 2, -th / 2, len, th, th * 0.4); ctx.fill();
  ctx.strokeStyle = o.bad ? '#b5402e' : shade(dark, -0.35); ctx.lineWidth = 1.4;
  roundRectPath(ctx, -len / 2, -th / 2, len, th, th * 0.4); ctx.stroke();
  // grain along the plank, from the plank's own length so each one looks a little different
  const rng = makeRng(Math.round(p.len * 100) + (o.fixed ? 7 : 0));
  ctx.save();
  roundRectPath(ctx, -len / 2, -th / 2, len, th, th * 0.4); ctx.clip();
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 5; i++) {
    const yy = (-0.38 + i * 0.19) * th;
    ctx.strokeStyle = `rgba(120,76,30,${0.18 + rng() * 0.18})`;
    ctx.beginPath(); ctx.moveTo(-len / 2, yy);
    ctx.bezierCurveTo(-len * 0.2, yy + (rng() - 0.5) * th * 0.3, len * 0.2, yy + (rng() - 0.5) * th * 0.3, len / 2, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-len / 2, -th / 2, len, th * 0.22);
  ctx.restore();
  if (o.fixed) {
    // brass screws: this one is part of the board
    for (const k of [-0.5, 0.5]) {
      const scx = k * (len - th), r = th * 0.2;
      ctx.fillStyle = '#d9b24a'; ctx.beginPath(); ctx.arc(scx, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(scx - r * 0.6, 0); ctx.lineTo(scx + r * 0.6, 0); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The round handle a plank is turned by, in 15 degree steps. */
export function paintHandle(ctx: Ctx, x: number, y: number, r: number, active: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(60,34,10,0.3)'; ctx.beginPath(); ctx.arc(1, 2.5, r, 0, TAU); ctx.fill();
  ctx.fillStyle = active ? '#ffe9a8' : '#fffaf0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a4c22'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineWidth = Math.max(2, r * 0.18); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.52, -2.4, 0.9); ctx.stroke();
  const ax = Math.cos(0.9) * r * 0.52, ay = Math.sin(0.9) * r * 0.52;
  ctx.fillStyle = '#7a4c22'; ctx.beginPath(); ctx.moveTo(ax + r * 0.28, ay - r * 0.12); ctx.lineTo(ax - r * 0.3, ay - r * 0.2); ctx.lineTo(ax - r * 0.02, ay + r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function paintPeg(ctx: Ctx, v: View, p: Peg): void {
  const x = sx(v, p.x), y = sy(v, p.y), r = p.r * v.s;
  ctx.fillStyle = 'rgba(60,34,10,0.3)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2.5, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#d9774f'); g.addColorStop(1, '#8e3a1e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6b2a14'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.38, r * 0.3, r * 0.17, -0.6, 0, TAU); ctx.fill();
}

/** A hole in the wall the marble drops from. */
export function paintDropHole(ctx: Ctx, v: View, x: number, y: number): void {
  const px = sx(v, x), py = sy(v, y), r = MARBLE_R * v.s * 1.35;
  ctx.fillStyle = '#4a2a10'; ctx.beginPath(); ctx.ellipse(px, py - r * 0.25, r, r * 0.95, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = r * 0.28; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, py - r * 0.1, r * 0.8, r * 0.7, 0, 0, TAU); ctx.fill();
}

/** The cup, in two halves: the back with the dark inside, and the front the marble drops behind. */
export function paintCupBack(ctx: Ctx, v: View, cupX: number): void {
  const x = sx(v, cupX), top = sy(v, CUP_RIM_Y), rw = (CUP_INNER / 2 + 0.2) * v.s;
  ctx.fillStyle = '#5a1d16';
  ctx.beginPath(); ctx.ellipse(x, top, rw, v.s * 0.2, 0, 0, TAU); ctx.fill();
}

export function paintCupFront(ctx: Ctx, v: View, cupX: number, glow = 0): void {
  const x = sx(v, cupX), top = sy(v, CUP_RIM_Y), bot = sy(v, H - 0.1), rw = (CUP_INNER / 2 + 0.2) * v.s, bw = rw * 0.82;
  ctx.save();
  if (glow > 0) { ctx.shadowColor = `rgba(255,236,150,${glow})`; ctx.shadowBlur = v.s * 1.2; }
  const g = ctx.createLinearGradient(x - rw, 0, x + rw, 0);
  g.addColorStop(0, '#e8604f'); g.addColorStop(0.35, '#f08a76'); g.addColorStop(1, '#b8342a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - rw, top + v.s * 0.1); ctx.lineTo(x + rw, top + v.s * 0.1); ctx.lineTo(x + bw, bot); ctx.lineTo(x - bw, bot); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath(); ctx.moveTo(x - rw * 0.96, top + v.s * 0.42); ctx.lineTo(x + rw * 0.96, top + v.s * 0.42); ctx.lineTo(x + rw * 0.92, top + v.s * 0.62); ctx.lineTo(x - rw * 0.92, top + v.s * 0.62); ctx.closePath(); ctx.fill();
  // the rim, in front
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = v.s * 0.12;
  ctx.beginPath(); ctx.ellipse(x, top + v.s * 0.1, rw, v.s * 0.2, 0, 0, Math.PI); ctx.stroke();
}

/** A glass marble: a blue body, a swirl that turns as it rolls, and a window of light. */
export function paintMarble(ctx: Ctx, cx: number, cy: number, r: number, rot: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40,24,8,0.28)'; ctx.beginPath(); ctx.ellipse(cx + r * 0.2, cy + r * 0.35, r, r * 0.95, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#d6f2ff'); g.addColorStop(0.45, '#4fa9e4'); g.addColorStop(1, '#1b5c9c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, TAU); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.strokeStyle = 'rgba(255,214,120,0.85)'; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.1); ctx.bezierCurveTo(-r * 0.2, -r * 0.7, r * 0.2, r * 0.5, r * 0.7, r * 0.1); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(12,50,90,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.3, r * 0.18, -0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx + r * 0.35, cy + r * 0.4, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}

/** The whole static board of a level at some scale, for the level cards. */
export function paintMiniBoard(ctx: Ctx, level: Level, x: number, y: number, s: number): void {
  const v: View = { ox: x, oy: y, s };
  ctx.fillStyle = '#dcb678'; ctx.fillRect(x, y, W * s, H * s);
  ctx.strokeStyle = '#7a4c22'; ctx.lineWidth = Math.max(1.5, s * 0.2); ctx.strokeRect(x, y, W * s, H * s);
  for (const p of level.fixed) paintPlank(ctx, v, p, { fixed: true });
  for (const g of level.pegs) paintPeg(ctx, v, g);
  paintDropHole(ctx, v, level.drop.x, level.drop.y);
  paintCupBack(ctx, v, level.cupX); paintCupFront(ctx, v, level.cupX);
  paintMarble(ctx, sx(v, level.drop.x), sy(v, level.drop.y + 0.5), MARBLE_R * s * 1.2, 0.4);
}
