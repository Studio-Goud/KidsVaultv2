/**
 * Rekenrijk, drawn.
 *
 * Every sum in this game is a thing on a table: beads on a rack, apples in a crate, counters in a
 * ten-frame, rods and cubes on a tray, a peg on a number line, a crate of apples in rows. This
 * file knows how to draw each of those and, just as importantly, where every piece of them sits -
 * the geometry functions beside each drawing are what the pointer handlers in `game.ts` hit-test
 * against, so the thing on screen and the thing you can grab are never two different shapes.
 *
 * Nothing here decides anything about arithmetic. It is given a count and a position and it draws.
 */

import { TAU } from '../../util/math';
import { contactShadow, grainOver, hexA, LIGHT, mix, roundRectPath, shade } from '../../render/look';

type Ctx = CanvasRenderingContext2D;
export interface Rect { x: number; y: number; w: number; h: number }

export const APPLE = '#e0553f';
export const APPLE_2 = '#f0a24a';
export const BEAD_RED = '#e0553f';
export const BEAD_PALE = '#fff6e4';
export const ROD = '#5f86cc';
export const CUBE = '#f0a93c';
export const WOOD = '#c8955c';
export const WOOD_DARK = '#8d6134';
export const INK = '#123047';

// ---------------------------------------------------------------- the backdrop

/**
 * An orchard, and the trestle table the whole game happens on.
 *
 * Marktdag counts to ten on a stall; this is the next row of tables along, which is why the
 * wood, the light and the apples are the same ones. The sun sits up on the left like everywhere
 * else in Suri, so everything on the table casts to the lower right.
 */
export function drawYard(ctx: Ctx, w: number, h: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8fd0ef');
  sky.addColorStop(0.35, '#c4e7f5');
  sky.addColorStop(0.58, '#e6f2dc');
  sky.addColorStop(1, '#cfe0b4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // sunlight from the upper left, drifting a hair
  const sx = w * (0.16 + Math.sin(t * 0.07) * 0.02);
  const sun = ctx.createRadialGradient(sx, h * 0.08, 0, sx, h * 0.08, Math.max(w, h) * 0.75);
  sun.addColorStop(0, 'rgba(255, 248, 210, 0.55)');
  sun.addColorStop(1, 'rgba(255, 248, 210, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // a hedge of apple trees along the horizon, drawn as overlapping crowns rather than trees
  const hy = h * 0.5;
  ctx.save();
  ctx.fillStyle = 'rgba(104, 150, 88, 0.55)';
  const step = Math.max(52, w / 9);
  for (let x = -step; x < w + step; x += step) {
    const r = step * (0.42 + ((Math.sin(x * 0.07) + 1) / 2) * 0.2);
    ctx.beginPath();
    ctx.arc(x + step * 0.3, hy - r * 0.45, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(84, 128, 70, 0.5)';
  ctx.fillRect(0, hy - 2, w, h * 0.06);
  ctx.restore();

  // the table: a plank top with a dark front edge, running off both sides
  const ty = h * 0.56;
  const top = ctx.createLinearGradient(0, ty, 0, h);
  top.addColorStop(0, '#e0b57e');
  top.addColorStop(0.1, WOOD);
  top.addColorStop(1, '#a9793f');
  ctx.fillStyle = top;
  ctx.fillRect(0, ty, w, h - ty);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, ty, w, Math.max(1.5, h * 0.003));
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = Math.max(1, h * 0.0016);
  for (let i = 1; i < 6; i++) {
    const y = ty + (h - ty) * (i / 6);
    ctx.beginPath();
    ctx.moveTo(0, y);
    // the grain wanders a little, so the plank is a plank and not a ruled line
    for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.6);
    ctx.stroke();
  }
  ctx.restore();
  grainOver(ctx, 0, 0, w, h, 0.05);
}

// ---------------------------------------------------------------- the objects themselves

/** One apple, lit from the upper left, with a stalk and a leaf. */
export function apple(ctx: Ctx, x: number, y: number, r: number, tone = APPLE, ghost = false): void {
  ctx.save();
  if (ghost) ctx.globalAlpha *= 0.32;
  if (r < 6) {
    // below this size the stalk, the leaf and the two lobes are one smudge; a clean dot reads better
    const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    sg.addColorStop(0, shade(tone, 0.4));
    sg.addColorStop(1, shade(tone, -0.24));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  contactShadow(ctx, x, y + r * 1.02, r * 0.85, r * 0.26, 0.24);
  const g = ctx.createRadialGradient(x + LIGHT.x * r * 0.5, y + LIGHT.y * r * 0.5, r * 0.12, x, y, r * 1.1);
  g.addColorStop(0, shade(tone, 0.42));
  g.addColorStop(0.55, tone);
  g.addColorStop(1, shade(tone, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  // two lobes, so it is an apple and not a ball
  ctx.moveTo(x, y - r * 0.72);
  ctx.bezierCurveTo(x - r * 1.18, y - r * 1.05, x - r * 1.12, y + r * 0.95, x, y + r);
  ctx.bezierCurveTo(x + r * 1.12, y + r * 0.95, x + r * 1.18, y - r * 1.05, x, y - r * 0.72);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 40, 26, 0.28)';
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.stroke();
  // stalk and leaf
  ctx.strokeStyle = '#7a4a24';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.6);
  ctx.quadraticCurveTo(x + r * 0.1, y - r * 1.0, x + r * 0.02, y - r * 1.18);
  ctx.stroke();
  ctx.fillStyle = '#6fae54';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.42, y - r * 1.02, r * 0.38, r * 0.19, -0.5, 0, TAU);
  ctx.fill();
  // the shine
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.36, y - r * 0.3, r * 0.22, r * 0.34, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** One bead on a rack wire. Glossy, because the real ones are. */
export function bead(ctx: Ctx, x: number, y: number, r: number, red: boolean, lit = false): void {
  const tone = red ? BEAD_RED : BEAD_PALE;
  ctx.save();
  const g = ctx.createRadialGradient(x + LIGHT.x * r * 0.55, y + LIGHT.y * r * 0.55, r * 0.1, x, y, r);
  g.addColorStop(0, shade(tone, 0.45));
  g.addColorStop(0.6, tone);
  g.addColorStop(1, shade(tone, -0.34));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = red ? 'rgba(110, 32, 20, 0.35)' : 'rgba(150, 120, 70, 0.4)';
  ctx.lineWidth = Math.max(0.7, r * 0.1);
  ctx.stroke();
  if (lit) {
    ctx.strokeStyle = '#3f9d61';
    ctx.lineWidth = Math.max(1.6, r * 0.22);
    ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.34, y - r * 0.36, r * 0.24, r * 0.16, -0.7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A rod of ten, with the ten cut into it so nobody has to take its word for it. */
export function rod(ctx: Ctx, x: number, y: number, w: number, h: number, ghost = false, tone = ROD): void {
  ctx.save();
  if (ghost) ctx.globalAlpha *= 0.3;
  contactShadow(ctx, x + w / 2, y + h * 1.04, w * 0.5, h * 0.2, 0.2);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(tone, 0.34));
  g.addColorStop(1, shade(tone, -0.2));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.18);
  ctx.fill();
  ctx.strokeStyle = shade(tone, -0.42);
  ctx.lineWidth = Math.max(0.8, h * 0.05);
  ctx.stroke();
  // the ten divisions, along whichever way round the rod is lying
  const along = w >= h;
  ctx.strokeStyle = hexA('#123047', 0.3);
  ctx.lineWidth = Math.max(0.6, Math.min(w, h) * 0.05);
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    if (along) { ctx.moveTo(x + (w * i) / 10, y + h * 0.16); ctx.lineTo(x + (w * i) / 10, y + h * 0.84); }
    else { ctx.moveTo(x + w * 0.16, y + (h * i) / 10); ctx.lineTo(x + w * 0.84, y + (h * i) / 10); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRectPath(ctx, x + w * 0.05, y + h * 0.1, w * 0.9, h * 0.2, h * 0.1);
  ctx.fill();
  ctx.restore();
}

/** A single cube: one. */
export function cube(ctx: Ctx, x: number, y: number, s: number, ghost = false, tone = CUBE): void {
  ctx.save();
  if (ghost) ctx.globalAlpha *= 0.3;
  contactShadow(ctx, x + s / 2, y + s * 1.04, s * 0.5, s * 0.2, 0.2);
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, shade(tone, 0.32));
  g.addColorStop(1, shade(tone, -0.22));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, s, s, s * 0.22);
  ctx.fill();
  ctx.strokeStyle = shade(tone, -0.45);
  ctx.lineWidth = Math.max(0.8, s * 0.07);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  roundRectPath(ctx, x + s * 0.14, y + s * 0.14, s * 0.5, s * 0.26, s * 0.12);
  ctx.fill();
  ctx.restore();
}

/** A wooden crate: four slats and two end posts, open at the top. */
export function crate(ctx: Ctx, r: Rect, tone = WOOD): void {
  ctx.save();
  contactShadow(ctx, r.x + r.w / 2, r.y + r.h * 1.03, r.w * 0.52, r.h * 0.16, 0.26);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, shade(tone, 0.24));
  g.addColorStop(1, shade(tone, -0.24));
  ctx.fillStyle = g;
  roundRectPath(ctx, r.x, r.y, r.w, r.h, Math.min(12, r.h * 0.12));
  ctx.fill();
  // the inside, so apples sit in it rather than on it
  ctx.fillStyle = shade(tone, -0.38);
  roundRectPath(ctx, r.x + r.w * 0.045, r.y + r.h * 0.07, r.w * 0.91, r.h * 0.74, Math.min(9, r.h * 0.09));
  ctx.fill();
  ctx.restore();
}

/** The front slats of a crate, drawn after whatever is in it so the apples sit behind them. */
export function crateFront(ctx: Ctx, r: Rect, tone = WOOD): void {
  ctx.save();
  const g = ctx.createLinearGradient(0, r.y + r.h * 0.72, 0, r.y + r.h);
  g.addColorStop(0, shade(tone, 0.18));
  g.addColorStop(1, shade(tone, -0.3));
  ctx.fillStyle = g;
  roundRectPath(ctx, r.x, r.y + r.h * 0.7, r.w, r.h * 0.3, Math.min(10, r.h * 0.1));
  ctx.fill();
  ctx.strokeStyle = hexA(WOOD_DARK, 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w * 0.04, r.y + r.h * 0.78);
  ctx.lineTo(r.x + r.w * 0.96, r.y + r.h * 0.78);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the bead rack

export interface RackGeo { x0: number; x1: number; y: number; d: number; r: number; total: number; frame: Rect }

/** The frame, the wire and how big a bead can be for this many beads in this much room. */
export function rackGeo(area: Rect, total: number): RackGeo {
  const pad = Math.min(area.w * 0.06, 22);
  const inner = area.w - pad * 2;
  // room for every bead plus a gap the divider lives in
  const d = Math.min(inner / (total + 1.2), area.h * 0.44);
  const span = d * total;
  const x0 = area.x + (area.w - (span + d * 1.2)) / 2;
  return {
    x0, x1: x0 + span + d * 1.2, y: area.y + area.h * 0.5, d, r: d * 0.46, total,
    frame: { x: area.x + (area.w - (span + d * 1.2)) / 2 - d * 0.5, y: area.y + area.h * 0.5 - d * 1.15, w: span + d * 2.2, h: d * 2.3 },
  };
}

/** Where bead `i` sits, given how many are pushed to the left. */
export function rackBeadX(g: RackGeo, i: number, split: number): number {
  if (i < split) return g.x0 + g.d * (i + 0.5);
  return g.x1 - g.d * (g.total - i - 0.5);
}

export const rackDividerX = (g: RackGeo, split: number): number => g.x0 + g.d * split + g.d * 0.6;

/** Which split a finger at this x is asking for. */
export function rackSplitAt(g: RackGeo, px: number): number {
  const k = Math.round((px - g.x0 - g.d * 0.6) / g.d);
  return Math.max(0, Math.min(g.total, k));
}

/**
 * The rack. Beads one to five are red and six to ten are white, exactly as on a real rekenrek, so
 * that "seven" can be seen as five and two without counting anything.
 */
export function drawRack(ctx: Ctx, g: RackGeo, split: number, lit: number, dragging: boolean): void {
  const f = g.frame;
  ctx.save();
  contactShadow(ctx, f.x + f.w / 2, f.y + f.h * 1.05, f.w * 0.5, f.h * 0.18, 0.26);
  const wood = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  wood.addColorStop(0, shade(WOOD, 0.26));
  wood.addColorStop(1, shade(WOOD, -0.26));
  ctx.fillStyle = wood;
  roundRectPath(ctx, f.x, f.y, f.w, f.h, f.h * 0.22);
  ctx.fill();
  ctx.fillStyle = 'rgba(64, 40, 18, 0.35)';
  roundRectPath(ctx, f.x + f.w * 0.02, f.y + f.h * 0.14, f.w * 0.96, f.h * 0.72, f.h * 0.16);
  ctx.fill();
  // the wire
  ctx.strokeStyle = 'rgba(232, 232, 236, 0.85)';
  ctx.lineWidth = Math.max(1.5, g.d * 0.08);
  ctx.beginPath();
  ctx.moveTo(f.x + f.w * 0.04, g.y);
  ctx.lineTo(f.x + f.w * 0.96, g.y);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < g.total; i++) {
    bead(ctx, rackBeadX(g, i, split), g.y, g.r, i < 5, i >= split && i < split + lit);
  }

  // the divider: a wooden peg with a grip, in the gap the beads left for it
  const dx = rackDividerX(g, split);
  ctx.save();
  if (dragging) { ctx.shadowColor = 'rgba(20, 60, 40, 0.5)'; ctx.shadowBlur = g.d * 0.6; }
  const pg = ctx.createLinearGradient(dx - g.d * 0.2, 0, dx + g.d * 0.2, 0);
  pg.addColorStop(0, '#5a8f6a');
  pg.addColorStop(0.5, '#79b98b');
  pg.addColorStop(1, '#3f7050');
  ctx.fillStyle = pg;
  roundRectPath(ctx, dx - g.d * 0.16, f.y - g.d * 0.22, g.d * 0.32, f.h + g.d * 0.44, g.d * 0.16);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2f6046';
  ctx.beginPath(); ctx.arc(dx, f.y - g.d * 0.4, g.d * 0.26, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.arc(dx - g.d * 0.07, f.y - g.d * 0.48, g.d * 0.1, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- crates of apples

/** Where apple number `i` sits inside a crate, five to a row from the bottom up. */
export function appleSlot(r: Rect, i: number, perRow: number, rows: number): { x: number; y: number; s: number } {
  const s = Math.min((r.w * 0.9) / perRow, (r.h * 0.72) / rows);
  const col = i % perRow, row = Math.floor(i / perRow);
  const usedW = s * perRow;
  return {
    x: r.x + (r.w - usedW) / 2 + s * (col + 0.5),
    y: r.y + r.h * 0.72 - s * (row + 0.5),
    s,
  };
}

/** A crate with `n` apples in it, and optionally a number on the front. */
export function drawCrateOfApples(
  ctx: Ctx, r: Rect, n: number, perRow: number, opts: { label?: string; lit?: number; tone?: string } = {},
): void {
  crate(ctx, r, opts.tone ?? WOOD);
  const rows = Math.max(1, Math.ceil(Math.max(n, 1) / perRow));
  for (let i = 0; i < n; i++) {
    const s = appleSlot(r, i, perRow, rows);
    const on = opts.lit != null && i < opts.lit;
    apple(ctx, s.x, s.y, s.s * 0.44, on ? APPLE_2 : APPLE);
    if (on) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(60,30,10,0.4)';
      ctx.lineWidth = Math.max(1, s.s * 0.05);
      ctx.font = `900 ${Math.round(s.s * 0.4)}px Nunito, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeText(String(i + 1), s.x, s.y + s.s * 0.15);
      ctx.fillText(String(i + 1), s.x, s.y + s.s * 0.15);
    }
  }
  crateFront(ctx, r, opts.tone ?? WOOD);
  if (opts.label) {
    ctx.fillStyle = '#5a3a18';
    ctx.font = `900 ${Math.round(r.h * 0.17)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(opts.label, r.x + r.w / 2, r.y + r.h * 0.93);
  }
}

// ---------------------------------------------------------------- the ten-frame

export interface FrameGeo { x: number; y: number; cell: number; cols: number; rows: number }

export function frameGeo(area: Rect): FrameGeo {
  const cell = Math.min(area.w / 5.4, area.h / 2.6);
  return { x: area.x + (area.w - cell * 5) / 2, y: area.y + (area.h - cell * 2) / 2, cell, cols: 5, rows: 2 };
}

export function frameSlot(g: FrameGeo, i: number): { x: number; y: number } {
  return { x: g.x + g.cell * ((i % 5) + 0.5), y: g.y + g.cell * (Math.floor(i / 5) + 0.5) };
}

/** The empty frame: ten boxes, five and five, with the middle line heavier. */
export function drawTenFrame(ctx: Ctx, g: FrameGeo, full: boolean): void {
  const w = g.cell * 5, h = g.cell * 2;
  ctx.save();
  contactShadow(ctx, g.x + w / 2, g.y + h * 1.03, w * 0.5, h * 0.12, 0.22);
  ctx.fillStyle = full ? '#e7f6e6' : '#fffaf0';
  roundRectPath(ctx, g.x, g.y, w, h, g.cell * 0.16);
  ctx.fill();
  ctx.strokeStyle = full ? '#3f9d61' : 'rgba(18,48,71,0.5)';
  ctx.lineWidth = Math.max(2, g.cell * 0.06);
  roundRectPath(ctx, g.x, g.y, w, h, g.cell * 0.16);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, g.cell * 0.03);
  ctx.strokeStyle = 'rgba(18,48,71,0.28)';
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(g.x + g.cell * i, g.y);
    ctx.lineTo(g.x + g.cell * i, g.y + h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + g.cell);
  ctx.lineTo(g.x + w, g.y + g.cell);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- rods and cubes

/** The pieces a number breaks into: as many rods of ten as fit, then the cubes. */
export const piecesOf = (n: number): { rods: number; cubes: number } => ({ rods: Math.floor(n / 10), cubes: n % 10 });

/** A flat tray to put them on. */
export function drawTray(ctx: Ctx, r: Rect, hot: boolean): void {
  ctx.save();
  contactShadow(ctx, r.x + r.w / 2, r.y + r.h * 1.02, r.w * 0.5, r.h * 0.1, 0.2);
  ctx.fillStyle = hot ? 'rgba(255, 246, 214, 0.95)' : 'rgba(255, 250, 240, 0.8)';
  roundRectPath(ctx, r.x, r.y, r.w, r.h, Math.min(16, r.h * 0.16));
  ctx.fill();
  ctx.strokeStyle = hot ? '#e0a63c' : hexA(WOOD_DARK, 0.45);
  ctx.lineWidth = hot ? 3 : 1.6;
  ctx.setLineDash(hot ? [] : [7, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------- the number line

export interface LineGeo { x: number; y: number; w: number; lo: number; hi: number }

export const lineX = (g: LineGeo, n: number): number => g.x + ((n - g.lo) / (g.hi - g.lo)) * g.w;
export function lineAt(g: LineGeo, px: number): number {
  const n = g.lo + ((px - g.x) / g.w) * (g.hi - g.lo);
  return Math.max(g.lo, Math.min(g.hi, Math.round(n)));
}

/**
 * The line itself: a tick for every one, a taller one every five, and a number at every ten. A
 * number line with only the tens on it is a ruler; a child crossing a ten needs to see the ones.
 */
export function drawNumberLine(ctx: Ctx, g: LineGeo, u: number): void {
  const span = g.hi - g.lo;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 6 * u;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.w, g.y); ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6 * u;
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.w, g.y); ctx.stroke();

  const perTick = g.w / span;
  const everyOne = perTick > 5 * u;
  for (let n = g.lo; n <= g.hi; n++) {
    const big = n % 10 === 0, mid = n % 5 === 0;
    if (!big && !mid && !everyOne) continue;
    const len = (big ? 11 : mid ? 7 : 4) * u;
    ctx.strokeStyle = big ? INK : 'rgba(18,48,71,0.55)';
    ctx.lineWidth = (big ? 2.6 : 1.4) * u;
    ctx.beginPath(); ctx.moveTo(lineX(g, n), g.y - len); ctx.lineTo(lineX(g, n), g.y + len); ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = `900 ${Math.round(12 * u)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const labelEvery = span <= 20 ? 5 : 10;
  for (let n = Math.ceil(g.lo / labelEvery) * labelEvery; n <= g.hi; n += labelEvery) {
    ctx.fillText(String(n), lineX(g, n), g.y + 26 * u);
  }
  ctx.restore();
}

/** One jump, drawn over the line as an arc with the size of the jump written in it. */
export function drawHop(
  ctx: Ctx, g: LineGeo, from: number, to: number, u: number, colour: string, label?: string, lift = 0,
): void {
  if (to === from) return;
  const x0 = lineX(g, from), x1 = lineX(g, to);
  const rise = Math.min(52 * u, Math.max(20 * u, Math.abs(x1 - x0) * 0.6)) + lift * 0.5;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3.4 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, g.y - 4 * u);
  ctx.quadraticCurveTo((x0 + x1) / 2, g.y - rise * 2, x1, g.y - 4 * u);
  ctx.stroke();
  // the arrowhead, pointing whichever way the jump went
  const dir = Math.sign(x1 - x0) || 1;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x1, g.y - 2 * u);
  ctx.lineTo(x1 - dir * 8 * u, g.y - 12 * u);
  ctx.lineTo(x1 - dir * 1 * u, g.y - 12 * u);
  ctx.closePath();
  ctx.fill();
  if (label) {
    const mx = (x0 + x1) / 2, my = g.y - rise - 2 * u - lift;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.2 * u;
    roundRectPath(ctx, mx - 19 * u, my - 12 * u, 38 * u, 24 * u, 10 * u);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = `900 ${Math.round(13 * u)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my + 5 * u);
  }
  ctx.restore();
}

/** The peg you drag along the line, with the number it is standing on written above it. */
export function drawPeg(ctx: Ctx, g: LineGeo, n: number, u: number, held: boolean, tone = '#3f9d61'): void {
  const x = lineX(g, n);
  ctx.save();
  if (held) { ctx.shadowColor = hexA(tone, 0.6); ctx.shadowBlur = 14 * u; }
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x, g.y + 2 * u);
  ctx.lineTo(x - 9 * u, g.y - 11 * u);
  ctx.lineTo(x + 9 * u, g.y - 11 * u);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(x, g.y - 20 * u, 13 * u, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(12 * u)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(n), x, g.y - 15 * u);
}

// ---------------------------------------------------------------- the array

export interface ArrayGeo { x: number; y: number; cell: number; maxCols: number; maxRows: number }

export function arrayGeo(area: Rect, maxCols: number, maxRows: number): ArrayGeo {
  const cell = Math.min(area.w / (maxCols + 0.6), area.h / (maxRows + 0.9));
  return {
    x: area.x + (area.w - cell * maxCols) / 2,
    y: area.y + (area.h - cell * maxRows) / 2,
    cell, maxCols, maxRows,
  };
}

export const arrayHandle = (g: ArrayGeo, cols: number, rows: number): { x: number; y: number } =>
  ({ x: g.x + g.cell * cols, y: g.y + g.cell * rows });

/**
 * Rows of apples in a crate, and a handle on the corner to make more of them.
 *
 * `fade` is what makes the last level work: a child who is getting fast stops needing to count the
 * apples, so they go to outlines. The array is still there and still built by hand - it is simply
 * no longer doing the arithmetic for them.
 */
export function drawArray(
  ctx: Ctx, g: ArrayGeo, cols: number, rows: number, fade: number, held: boolean, lit: number,
): void {
  const w = g.cell * g.maxCols, h = g.cell * g.maxRows;
  // the crate floor: the whole board, faintly, so the size of what is possible is visible
  ctx.save();
  ctx.fillStyle = 'rgba(255, 250, 240, 0.45)';
  roundRectPath(ctx, g.x - g.cell * 0.14, g.y - g.cell * 0.14, w + g.cell * 0.28, h + g.cell * 0.28, g.cell * 0.2);
  ctx.fill();
  ctx.strokeStyle = hexA(WOOD_DARK, 0.26);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.setLineDash([]);
  // a dot in every space still to fill, so the empty part of the board reads as room for more
  // apples rather than as a large empty box
  ctx.fillStyle = hexA(WOOD_DARK, 0.22);
  for (let row = 0; row < g.maxRows; row++) {
    for (let col = 0; col < g.maxCols; col++) {
      if (row < rows && col < cols) continue;
      ctx.beginPath();
      ctx.arc(g.x + g.cell * (col + 0.5), g.y + g.cell * (row + 0.5), Math.max(1, g.cell * 0.06), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // the part that has been built
  const bw = g.cell * cols, bh = g.cell * rows;
  crate(ctx, { x: g.x - g.cell * 0.1, y: g.y - g.cell * 0.1, w: bw + g.cell * 0.2, h: bh + g.cell * 0.2 });

  const r = g.cell * 0.34;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const cx = g.x + g.cell * (col + 0.5), cy = g.y + g.cell * (row + 0.5);
      if (fade > 0.02) {
        ctx.save();
        ctx.globalAlpha = 1 - fade * 0.82;
        apple(ctx, cx, cy, r, i < lit ? APPLE_2 : APPLE);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = shade(APPLE, -0.2);
        ctx.lineWidth = Math.max(1, r * 0.2);
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, TAU); ctx.stroke();
        ctx.restore();
      } else {
        apple(ctx, cx, cy, r, i < lit ? APPLE_2 : APPLE);
      }
    }
  }

  // the row totals down the side, which is how a table is actually learnt
  if (cols > 0 && rows > 0) {
    ctx.save();
    ctx.fillStyle = hexA('#123047', 0.75);
    ctx.font = `900 ${Math.round(g.cell * 0.34)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    for (let row = 0; row < rows; row++) {
      ctx.fillText(String((row + 1) * cols), g.x + bw + g.cell * 0.3, g.y + g.cell * (row + 0.62));
    }
    ctx.restore();
  }

  // the handle on the corner
  const hd = arrayHandle(g, cols, rows);
  ctx.save();
  if (held) { ctx.shadowColor = 'rgba(30, 90, 60, 0.6)'; ctx.shadowBlur = g.cell * 0.5; }
  ctx.fillStyle = '#4fae6e';
  ctx.beginPath(); ctx.arc(hd.x, hd.y, g.cell * 0.28, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.6, g.cell * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hd.x - g.cell * 0.12, hd.y - g.cell * 0.02);
  ctx.lineTo(hd.x + g.cell * 0.1, hd.y - g.cell * 0.02);
  ctx.moveTo(hd.x + g.cell * 0.04, hd.y - g.cell * 0.11);
  ctx.lineTo(hd.x + g.cell * 0.1, hd.y - g.cell * 0.02);
  ctx.lineTo(hd.x + g.cell * 0.04, hd.y + g.cell * 0.07);
  ctx.stroke();
}

// ---------------------------------------------------------------- the written sum

/**
 * The sum, written out underneath, filling itself in as the objects move.
 *
 * `known` is how many of the parts have been settled by what is on the table. An unknown reads as
 * an empty box rather than a question mark, because a box is what the worksheet uses and because
 * a box is something a number goes into.
 */
export function drawSum(
  ctx: Ctx, cx: number, cy: number, parts: Array<{ text: string; known: boolean; strong?: boolean }>,
  size: number, tone = INK,
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gap = size * 0.28;
  const widths = parts.map(p => {
    ctx.font = `900 ${Math.round(size)}px Nunito, system-ui, sans-serif`;
    return p.known ? ctx.measureText(p.text).width : size * 1.1;
  });
  const total = widths.reduce((s, x) => s + x, 0) + gap * (parts.length - 1);
  let x = cx - total / 2;
  parts.forEach((p, i) => {
    const w = widths[i];
    if (p.known) {
      ctx.font = `900 ${Math.round(size)}px Nunito, system-ui, sans-serif`;
      ctx.fillStyle = p.strong ? '#2f7a4c' : tone;
      ctx.fillText(p.text, x + w / 2, cy);
    } else {
      ctx.strokeStyle = hexA(INK, 0.45);
      ctx.lineWidth = Math.max(1.6, size * 0.08);
      ctx.setLineDash([size * 0.18, size * 0.14]);
      roundRectPath(ctx, x, cy - size * 0.58, w, size * 1.16, size * 0.2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    x += w + gap;
  });
  ctx.restore();
}

/** A soft banner behind the objects, so the stage reads as a place and not as a gap. */
export function stageMat(ctx: Ctx, r: Rect, u: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 252, 243, 0.4)';
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 20 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Mixing helper kept here so the game module does not have to reach for two look imports. */
export const tint = (a: string, b: string, t: number): string => mix(a, b, t);
