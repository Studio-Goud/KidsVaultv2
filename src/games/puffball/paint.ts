/**
 * How Puffball is drawn.
 *
 * The board is a grid, and a grid drawn honestly is a chessboard. So the floor is moss with a
 * grain to it, the pillars are stones with a lit top and a shaded side, and the pots are clay with
 * a rim you can see. The one thing drawn with no subtlety at all is the reach of a puffball while
 * it swells: those squares are marked with big counted dots, because counting them is the game.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import {
  blobPath, breathe, CachedLayer, contactShadow, Ctx, grainOver, LIGHT, mix, shade,
} from '../../render/look';
import { at, FUSE as FUSE_SHOWN, type Board, type PickupKind } from './model';

/**
 * One cached canvas per board, not one in total: the level list paints eight different boards in
 * the same frame, and a single cache would have each card evicting the one before it, repainting
 * every blade of moss on every card sixty times a second.
 */
const boardLayers = new Map<string, CachedLayer>();

/** The floor and the pillars: fixed for a level, so painted once. */
export function paintBoard(ctx: Ctx, b: Board, x0: number, y0: number, cell: number, seed: number): void {
  const key = `b${seed}:${Math.round(cell)}`;
  const id = `${b.cols}x${b.rows}:${key}`;
  let layer = boardLayers.get(id);
  if (!layer) {
    // a resize makes a fresh set of keys, so drop the old ones rather than grow without bound
    if (boardLayers.size > 16) boardLayers.clear();
    layer = new CachedLayer();
    boardLayers.set(id, layer);
  }
  const cv = layer.get(b.cols * cell, b.rows * cell, key, (lc) => paintBoardStill(lc, b, cell, seed));
  if (cv) ctx.drawImage(cv, x0, y0);
}

function paintBoardStill(ctx: Ctx, b: Board, cell: number, seed: number): void {
  const rng = makeRng(seed * 131 + 7);
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const px = x * cell, py = y * cell;
      // moss, a shade different on every square so the grid does not read as tiling
      const tone = rng();
      const g = ctx.createLinearGradient(px, py, px, py + cell);
      g.addColorStop(0, mix('#4e7c3e', '#5f9147', tone));
      g.addColorStop(1, mix('#3d6632', '#4a7a3b', tone));
      ctx.fillStyle = g;
      ctx.fillRect(px, py, cell + 1, cell + 1);
      // tufts and pebbles, so no two squares are the same
      for (let i = 0; i < 3; i++) {
        const tx = px + rng() * cell, ty = py + rng() * cell;
        if (rng() > 0.55) {
          ctx.strokeStyle = `rgba(122, 168, 88, ${0.25 + rng() * 0.3})`;
          ctx.lineWidth = Math.max(0.7, cell * 0.035);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + (rng() - 0.5) * cell * 0.12, ty - cell * (0.08 + rng() * 0.1));
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(40, 64, 32, ${0.06 + rng() * 0.1})`;
          ctx.beginPath();
          ctx.arc(tx, ty, cell * (0.02 + rng() * 0.04), 0, TAU);
          ctx.fill();
        }
      }
    }
  }
  // the pillars, on top of the moss
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      if (at(b, x, y) !== 'wall') continue;
      paintPillar(ctx, x * cell, y * cell, cell, x * 31 + y * 17);
    }
  }
  grainOver(ctx, 0, 0, b.cols * cell, b.rows * cell, 0.05);
}

/** A block of mossy stone, seen slightly from above so it has a top and a face. */
function paintPillar(ctx: Ctx, px: number, py: number, cell: number, seed: number): void {
  const lift = cell * 0.2;
  contactShadow(ctx, px + cell * 0.55, py + cell * 0.92, cell * 0.6, cell * 0.2, 0.4);
  // the face
  const face = ctx.createLinearGradient(px, py + cell - lift, px, py + cell);
  face.addColorStop(0, '#6a6156');
  face.addColorStop(1, '#443e36');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(px + cell * 0.04, py + cell * 0.3, cell * 0.92, cell * 0.66, cell * 0.1);
  ctx.fill();
  // the top, catching the light
  const top = ctx.createLinearGradient(px + LIGHT.x * cell, py, px - LIGHT.x * cell, py + cell);
  top.addColorStop(0, '#a79d8c');
  top.addColorStop(1, '#7b7265');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.roundRect(px + cell * 0.04, py + cell * 0.06, cell * 0.92, cell * 0.5, cell * 0.1);
  ctx.fill();
  // moss creeping over the top edge
  const rng = makeRng(seed * 97 + 3);
  ctx.fillStyle = 'rgba(96, 142, 74, 0.55)';
  for (let i = 0; i < 3; i++) {
    blobPath(ctx, px + cell * (0.2 + rng() * 0.6), py + cell * (0.5 + rng() * 0.12), cell * (0.08 + rng() * 0.08), seed + i, 0.4, 8);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40, 36, 30, 0.25)';
  ctx.lineWidth = Math.max(0.8, cell * 0.02);
  ctx.beginPath();
  ctx.roundRect(px + cell * 0.04, py + cell * 0.06, cell * 0.92, cell * 0.9, cell * 0.1);
  ctx.stroke();
}

/** A clay pot. Cracks show as it is about to go, so a near miss reads as a near miss. */
export function paintPot(ctx: Ctx, px: number, py: number, cell: number, seed: number): void {
  const cx = px + cell / 2, cy = py + cell * 0.56;
  const r = cell * 0.36;
  contactShadow(ctx, cx + cell * 0.04, cy + r * 0.9, r * 1.2, r * 0.36, 0.35);
  const body = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  body.addColorStop(0, '#d79a6a');
  body.addColorStop(0.5, '#b97a4c');
  body.addColorStop(1, '#8d5836');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.86, cy - r * 0.5);
  ctx.quadraticCurveTo(cx - r * 1.05, cy + r * 0.5, cx - r * 0.5, cy + r * 0.92);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.92);
  ctx.quadraticCurveTo(cx + r * 1.05, cy + r * 0.5, cx + r * 0.86, cy - r * 0.5);
  ctx.closePath();
  ctx.fill();
  // the rim
  ctx.fillStyle = '#e0a878';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.5, r * 0.92, r * 0.26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6d4227';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.46, r * 0.66, r * 0.17, 0, 0, TAU);
  ctx.fill();
  // a glaze band and a highlight
  ctx.fillStyle = 'rgba(255, 236, 206, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.34, cy + r * 0.05, r * 0.2, r * 0.42, -0.2, 0, TAU);
  ctx.fill();
  const rng = makeRng(seed * 71 + 5);
  ctx.strokeStyle = 'rgba(90, 52, 28, 0.35)';
  ctx.lineWidth = Math.max(0.7, cell * 0.018);
  for (let i = 0; i < 2; i++) {
    const sx = cx + (rng() - 0.5) * r, sy = cy - r * 0.2 + rng() * r;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rng() - 0.5) * r * 0.6, sy + r * 0.4);
    ctx.stroke();
  }
}

/**
 * A puffball, swelling. The number on the cap is how many squares it reaches, and it is the only
 * numeral in the game: everything else a child has to count for themselves.
 */
export function paintPuff(ctx: Ctx, px: number, py: number, cell: number, fuse: number, reach: number, font: (w: string, s: number) => string): void {
  const t = 1 - clamp(fuse / 2.4, 0, 1);
  const swell = 1 + t * 0.3 + Math.sin(t * t * 44) * t * 0.07;
  const cx = px + cell / 2, cy = py + cell * 0.58;
  const r = cell * 0.34 * swell;
  contactShadow(ctx, cx + cell * 0.03, cy + r * 0.85, r * 1.1, r * 0.3, 0.35);
  // the stalk
  ctx.fillStyle = '#efe2c6';
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.26, cy - r * 0.1, r * 0.52, r * 0.95, r * 0.2);
  ctx.fill();
  // the cap, going from cream to an angry pink as it fills
  const cap = ctx.createRadialGradient(cx + LIGHT.x * r * 0.5, cy + LIGHT.y * r * 0.6, r * 0.1, cx, cy, r * 1.2);
  cap.addColorStop(0, mix('#fffaf0', '#ffd9d2', t));
  cap.addColorStop(0.55, mix('#f3e4cd', '#f2a898', t));
  cap.addColorStop(1, mix('#cdb693', '#d97a66', t));
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.1, r, r * 0.86, 0, Math.PI, 0);
  ctx.ellipse(cx, cy - r * 0.1, r, r * 0.5, 0, 0, Math.PI);
  ctx.fill();
  // the warts a puffball has
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.55, cy - r * 0.2 + Math.sin(a) * r * 0.4, r * 0.09, 0, TAU);
    ctx.fill();
  }
  // how far it reaches, on the cap
  ctx.fillStyle = '#5a3326';
  ctx.font = font('900', cell * 0.3);
  ctx.textAlign = 'center';
  ctx.fillText(String(reach), cx, cy - r * 0.18);
  ctx.textAlign = 'left';
}

/**
 * The squares a puffball is about to cover, marked while it swells.
 *
 * This is the teaching, so it is drawn as the gesture a child would make themselves: the light
 * runs outward from the middle a square at a time, one square per beat, so you see one, then two,
 * then three, rather than a shape that is simply yellow. One dot per square, not a heap of them -
 * three dots inside a thirty pixel square on a phone is a smudge, and a smudge cannot be counted.
 *
 * Then it dims. On the first two nights it stays lit the whole way, because the only thing being
 * taught there is what reach means. After that the fill drops back to a hint once the sweep is
 * over, so the child has to hold the number rather than read it off the floor all the way to the
 * pop. The rim never goes: nobody should be caught by a square they could not see.
 */
export function paintReach(ctx: Ctx, cells: Array<{ x: number; y: number; step: number }>, x0: number, y0: number, cell: number, fuse: number, t: number, hold = true): void {
  const age = FUSE_SHOWN - fuse;
  const urgency = 1 - clamp(fuse / FUSE_SHOWN, 0, 1);
  const beat = 0.35 + breathe(t, 3 + urgency * 9) * 0.35 + urgency * 0.2;
  // the sweep: a square lights up one eighth of a second after the one before it
  const SWEEP = 0.13;
  const swept = age / SWEEP;
  // once the sweep is over the mark settles; on later nights it settles far lower
  const settle = clamp((age - (SWEEP * 4 + 0.5)) / 0.5, 0, 1);
  const level = hold ? 1 : 1 - settle * 0.72;
  ctx.save();
  for (const c of cells) {
    const lit = clamp(swept - c.step, 0, 1);
    if (lit <= 0) continue;
    // each square gets a small kick as the light arrives on it, so the count has a pulse to it
    const arrive = 1 + (1 - Math.abs(clamp(swept - c.step, 0, 2) - 1)) * 0.5;
    const px = x0 + c.x * cell, py = y0 + c.y * cell;
    const fill = (0.22 + beat * (c.step === 0 ? 0.3 : 0.38)) * lit * level * arrive;
    ctx.fillStyle = `rgba(255, 206, 96, ${clamp(fill, 0, 0.85)})`;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    // a rim, so the edge of the reach is a line you can point at. This one never fades away.
    ctx.strokeStyle = `rgba(255, 234, 170, ${(0.4 + beat * 0.5) * lit})`;
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.strokeRect(px + cell * 0.06, py + cell * 0.06, cell * 0.88, cell * 0.88);
    if (c.step === 0) continue;
    // one dot, big enough to be a dot: the square's place in the count, not a tally inside it
    const rad = cell * 0.14 * (0.7 + 0.3 * arrive);
    ctx.fillStyle = `rgba(92, 56, 20, ${0.4 * lit})`;
    ctx.beginPath();
    ctx.arc(px + cell / 2, py + cell / 2 + cell * 0.025, rad, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 250, 232, ${(0.75 + beat * 0.25) * lit})`;
    ctx.beginPath();
    ctx.arc(px + cell / 2, py + cell / 2, rad, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The spores themselves: a soft cloud that blooms and thins. */
export function paintPop(ctx: Ctx, px: number, py: number, cell: number, age: number, seed: number): void {
  const k = clamp(age / 0.55, 0, 1);
  const r = cell * (0.25 + k * 0.42);
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.95;
  const g = ctx.createRadialGradient(px + cell / 2, py + cell / 2, 0, px + cell / 2, py + cell / 2, r);
  g.addColorStop(0, 'rgba(255, 252, 244, 0.95)');
  g.addColorStop(0.55, 'rgba(240, 226, 196, 0.8)');
  g.addColorStop(1, 'rgba(214, 196, 160, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px + cell / 2, py + cell / 2, r, 0, TAU);
  ctx.fill();
  // a few lumps in the cloud so it is not a plain circle
  ctx.fillStyle = `rgba(255, 250, 238, ${(1 - k) * 0.5})`;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + seed;
    blobPath(ctx, px + cell / 2 + Math.cos(a) * r * 0.5, py + cell / 2 + Math.sin(a) * r * 0.5, r * 0.4 * (1 - k * 0.4), seed + i, 0.35, 8);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the characters

/** The player: a hedgehog with a lantern, the same one who shops in Market Day. */
export function paintHedgehog(ctx: Ctx, cx: number, cy: number, r: number, facing: number, walk: number, dazed: number, t: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  const bob = dazed > 0 ? 0 : Math.sin(walk * 10) * r * 0.06;
  contactShadow(ctx, 0, r * 0.95, r * 0.8, r * 0.26, 0.38);
  ctx.translate(0, bob);
  if (dazed > 0) ctx.rotate(Math.sin(t * 9) * 0.12);
  // feet
  ctx.fillStyle = '#6f5335';
  for (const s of [-1, 1]) {
    const step = dazed > 0 ? 0 : Math.sin(walk * 10 + (s > 0 ? 0 : Math.PI)) * r * 0.16;
    ctx.beginPath();
    ctx.ellipse(s * r * 0.3, r * 0.82 + step * 0.3, r * 0.2, r * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  // spines
  ctx.fillStyle = '#6f5335';
  for (let i = 0; i <= 11; i++) {
    const a = -Math.PI - 0.15 + (i / 11) * (Math.PI + 0.3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
    ctx.lineTo(Math.cos(a - 0.05) * r * 1.02, Math.sin(a - 0.05) * r * 1.02);
    ctx.lineTo(Math.cos(a + 0.09) * r * 0.64, Math.sin(a + 0.09) * r * 0.64);
    ctx.closePath();
    ctx.fill();
  }
  // face, turned the way it is walking
  const look = facing * r * 0.12;
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#c49a6c');
  g.addColorStop(1, '#a5825c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(look, r * 0.08, r * 0.66, r * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d9b48a';
  ctx.beginPath();
  ctx.ellipse(look * 1.6, r * 0.34, r * 0.28, r * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#20304a';
  ctx.beginPath();
  ctx.ellipse(look * 1.8, r * 0.28, r * 0.09, r * 0.075, 0, 0, TAU);
  ctx.fill();
  // eyes, shut and spinning when knocked over
  if (dazed > 0) {
    ctx.strokeStyle = '#20304a';
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(look + s * r * 0.26 - r * 0.08, -r * 0.08);
      ctx.lineTo(look + s * r * 0.26 + r * 0.08, r * 0.04);
      ctx.moveTo(look + s * r * 0.26 - r * 0.08, r * 0.04);
      ctx.lineTo(look + s * r * 0.26 + r * 0.08, -r * 0.08);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(look + s * r * 0.24, -r * 0.04, r * 0.13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1e2c40';
      ctx.beginPath();
      ctx.arc(look + s * r * 0.24 + facing * r * 0.04, -r * 0.02, r * 0.07, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A mole: goggles, a pink snout, and paws made for digging. */
export function paintMole(ctx: Ctx, cx: number, cy: number, r: number, facing: number, walk: number, dazed: number, t: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  contactShadow(ctx, 0, r * 0.95, r * 0.75, r * 0.24, 0.38);
  if (dazed > 0) ctx.rotate(Math.sin(t * 9) * 0.14);
  const bob = dazed > 0 ? 0 : Math.abs(Math.sin(walk * 9)) * r * 0.08;
  ctx.translate(0, -bob);
  // digging paws
  ctx.fillStyle = '#e8b9a0';
  for (const s of [-1, 1]) {
    const swing = dazed > 0 ? 0 : Math.sin(walk * 9 + (s > 0 ? 0 : Math.PI)) * r * 0.2;
    ctx.beginPath();
    ctx.ellipse(s * r * 0.66, r * 0.4 + swing, r * 0.22, r * 0.16, s * 0.3, 0, TAU);
    ctx.fill();
  }
  // body
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#6f6675');
  g.addColorStop(1, '#443e4c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.74, r * 0.82, 0, 0, TAU);
  ctx.fill();
  // snout
  ctx.fillStyle = '#f0b6c0';
  ctx.beginPath();
  ctx.ellipse(facing * r * 0.3, r * 0.34, r * 0.26, r * 0.18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c97f8e';
  ctx.beginPath();
  ctx.ellipse(facing * r * 0.34, r * 0.3, r * 0.08, r * 0.06, 0, 0, TAU);
  ctx.fill();
  // goggles
  ctx.strokeStyle = '#3a3340';
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(-r * 0.74, -r * 0.14);
  ctx.lineTo(r * 0.74, -r * 0.14);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = dazed > 0 ? '#8d95a8' : '#cfe4f2';
    ctx.beginPath();
    ctx.arc(s * r * 0.28, -r * 0.14, r * 0.21, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a3340';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.stroke();
    if (dazed > 0) {
      ctx.strokeStyle = '#3a3340';
      ctx.beginPath();
      ctx.moveTo(s * r * 0.28 - r * 0.09, -r * 0.2);
      ctx.lineTo(s * r * 0.28 + r * 0.09, -r * 0.08);
      ctx.moveTo(s * r * 0.28 - r * 0.09, -r * 0.08);
      ctx.lineTo(s * r * 0.28 + r * 0.09, -r * 0.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1e2c40';
      ctx.beginPath();
      ctx.arc(s * r * 0.28 + facing * r * 0.06, -r * 0.13, r * 0.08, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** What was hiding under a pot. */
export function paintPickup(ctx: Ctx, cx: number, cy: number, r: number, kind: PickupKind, t: number): void {
  const bob = Math.sin(t * 2.6) * r * 0.1;
  ctx.save();
  ctx.translate(cx, cy + bob);
  contactShadow(ctx, 0, r * 0.9 - bob, r * 0.7, r * 0.22, 0.3);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
  glow.addColorStop(0, 'rgba(255, 240, 180, 0.5)');
  glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0, TAU);
  ctx.fill();
  if (kind === 'reach') {
    // a bigger, spotted puffball: the thing that makes yours reach further
    ctx.fillStyle = '#efe2c6';
    ctx.beginPath();
    ctx.roundRect(-r * 0.2, 0, r * 0.4, r * 0.6, r * 0.16);
    ctx.fill();
    const cap = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r);
    cap.addColorStop(0, '#ff9f8c');
    cap.addColorStop(1, '#d4553f');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.8, r * 0.62, 0, Math.PI, 0);
    ctx.ellipse(0, 0, r * 0.8, r * 0.3, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [dx, dy] of [[-0.34, -0.2], [0.3, -0.26], [0, -0.42]]) {
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, r * 0.12, 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'extra') {
    // a second puffball, so two can be out at once
    for (const s of [-1, 1]) {
      ctx.fillStyle = s < 0 ? '#f3e4cd' : '#fffaf0';
      ctx.beginPath();
      ctx.ellipse(s * r * 0.3, s * r * 0.1, r * 0.46, r * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 90, 60, 0.4)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.stroke();
    }
  } else {
    // boots
    ctx.fillStyle = '#3f7d9c';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.12, -r * 0.5);
      ctx.lineTo(s * r * 0.42, -r * 0.5);
      ctx.lineTo(s * r * 0.42, r * 0.2);
      ctx.lineTo(s * r * 0.72, r * 0.2);
      ctx.lineTo(s * r * 0.72, r * 0.5);
      ctx.lineTo(s * r * 0.12, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b5a73';
      ctx.fillRect(s * r * 0.12 - (s < 0 ? r * 0.6 : 0), r * 0.36, r * 0.6, r * 0.14);
      ctx.fillStyle = '#3f7d9c';
    }
  }
  ctx.restore();
}

/** A pot coming apart: shards thrown outwards, which is cheaper than a particle system. */
export function paintShards(ctx: Ctx, px: number, py: number, cell: number, age: number, seed: number): void {
  const k = clamp(age / 0.45, 0, 1);
  const rng = makeRng(seed * 37 + 1);
  ctx.save();
  ctx.globalAlpha = 1 - k;
  for (let i = 0; i < 7; i++) {
    const a = rng() * TAU;
    const d = cell * (0.1 + k * (0.3 + rng() * 0.4));
    const x = px + cell / 2 + Math.cos(a) * d;
    const y = py + cell / 2 + Math.sin(a) * d + k * k * cell * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + k * 6);
    ctx.fillStyle = rng() > 0.5 ? '#b97a4c' : '#8d5836';
    ctx.beginPath();
    ctx.moveTo(0, -cell * 0.07);
    ctx.lineTo(cell * 0.06, cell * 0.04);
    ctx.lineTo(-cell * 0.05, cell * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
