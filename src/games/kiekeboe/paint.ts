/**
 * The two places of Kiekeboe, and the eight things an animal can hide in.
 *
 * A hiding place is drawn in layers so that opening it looks like opening it: what is behind (a
 * hollow, a doorway), the animal, then the cover in front, which moves out of the way. The cover
 * always moves with `e`, the eased open amount from 0 to 1, so the game only has to say how open a
 * place is. The animal is drawn through a callback, which keeps this file free of any animal.
 */

import { contactShadow, easeOutBack, hexA, mix, roundRectPath, shade, vGrad, type Ctx } from '../../render/look';
import type { HideId, SceneId } from './model';

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export type Critter = (x: number, y: number, size: number) => void;

/** How big an animal is, relative to the hiding place that holds it. */
const CRITTER = 0.78;

/** The scene's colours, and what turns a daytime colour into a night one. */
export function tinter(scene: SceneId): (c: string) => string {
  return scene === 'farm' ? c => mix(c, '#1c2a5a', 0.42) : c => c;
}

// ---------------------------------------------------------------- the scene

export function horizonOf(h: number, tall: boolean): number { return h * (tall ? 0.3 : 0.4); }

export function paintScene(ctx: Ctx, w: number, h: number, scene: SceneId, t: number, tall: boolean): void {
  const night = scene === 'farm';
  const hy = horizonOf(h, tall);
  const m = Math.min(w, h);
  // sky
  ctx.fillStyle = night ? vGrad(ctx, 0, hy, '#1b2656', '#4c5390') : vGrad(ctx, 0, hy, '#6ec3f2', '#d7f1fb');
  ctx.fillRect(0, 0, w, hy + 2);
  if (night) {
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 0.6180339) % 1) * w, sy = ((i * 0.37 + 0.05) % 0.9) * hy * 0.85;
      ctx.fillStyle = `rgba(255,248,214,${0.35 + 0.5 * Math.abs(Math.sin(t * 0.9 + i))})`;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, m * 0.004 * (1 + (i % 3) * 0.4)), 0, TAU); ctx.fill();
    }
  }
  // sun or moon, kept away from the corner where the buttons are
  const sx = tall ? w * 0.15 : w * 0.4, sy = tall ? h * 0.15 : h * 0.14, sr = m * 0.075;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3);
  glow.addColorStop(0, night ? 'rgba(255,244,200,0.35)' : 'rgba(255,244,190,0.7)');
  glow.addColorStop(1, 'rgba(255,244,190,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
  ctx.fillStyle = night ? '#f6f0d4' : '#fff1b0';
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  if (night) { ctx.fillStyle = '#e3dcb8'; ctx.beginPath(); ctx.arc(sx - sr * 0.3, sy + sr * 0.1, sr * 0.2, 0, TAU); ctx.arc(sx + sr * 0.35, sy - sr * 0.3, sr * 0.14, 0, TAU); ctx.fill(); }

  // far hills
  const hill = (col: string, amp: number, ph: number, base: number): void => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / w * 5 + ph)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  hill(night ? '#2d4f58' : '#a6dc92', h * 0.05, 1, hy + h * 0.015);
  hill(night ? '#264a4c' : '#8ed47a', h * 0.035, 3.2, hy + h * 0.04);
  // the meadow
  ctx.fillStyle = night ? vGrad(ctx, hy, h, '#2a5a4c', '#1b4338') : vGrad(ctx, hy, h, '#82d06b', '#5bb558');
  ctx.fillRect(0, hy + h * 0.045, w, h);
  ctx.fillStyle = night ? 'rgba(10,30,40,0.12)' : 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 6; i++) { const y = hy + h * (0.1 + i * 0.15); ctx.fillRect(0, y, w, h * 0.05); }
  // flowers and tufts
  for (let i = 0; i < 34; i++) {
    const fx = ((i * 0.7548) % 1) * w, fy = hy + h * 0.08 + ((i * 0.5698) % 1) * (h - hy - h * 0.1);
    ctx.fillStyle = night ? ['#6f7fb5', '#b79a6a', '#8f6f98'][i % 3] : ['#ffffff', '#ffd54f', '#ff8fa3'][i % 3];
    ctx.beginPath(); ctx.arc(fx, fy, m * 0.0075, 0, TAU); ctx.fill();
  }

  // the farm fence
  const fy = hy + h * 0.035, fh = h * (tall ? 0.04 : 0.07), post = fh * 0.34;
  ctx.fillStyle = night ? '#6a5240' : '#f1e2c2';
  for (let x = w * 0.01; x < w; x += w * (tall ? 0.09 : 0.06)) roundRectPath(ctx, x, fy - fh * 0.15, post, fh * 1.15, post * 0.3), ctx.fill();
  ctx.fillRect(0, fy + fh * 0.1, w, fh * 0.16);
  ctx.fillRect(0, fy + fh * 0.58, w, fh * 0.16);

  // a tree
  const tx = tall ? w * 0.5 : w * 0.62, tb = hy + h * (tall ? 0.085 : 0.11), th = h * (tall ? 0.2 : 0.34);
  ctx.fillStyle = night ? '#4a3a33' : '#8a5e3c';
  roundRectPath(ctx, tx - th * 0.05, tb - th * 0.5, th * 0.1, th * 0.5, th * 0.03); ctx.fill();
  contactShadow(ctx, tx, tb, th * 0.28, th * 0.05, 0.28);
  const leaf = night ? '#2c6a52' : '#58b85a';
  for (const [dx, dy, r] of [[0, -0.7, 0.26], [-0.2, -0.55, 0.2], [0.2, -0.55, 0.2], [0, -0.5, 0.22]] as const) {
    ctx.fillStyle = dx === 0 && dy === -0.7 ? shade(leaf, 0.1) : leaf;
    ctx.beginPath(); ctx.arc(tx + dx * th, tb + dy * th, r * th, 0, TAU); ctx.fill();
  }

  if (night) {
    // lanterns on the fence, and fireflies, which are the only moving light
    const lamps = tall ? [w * 0.07, w * 0.93] : [w * 0.05, w * 0.3, w * 0.55];
    for (const lx of lamps) lantern(ctx, lx, fy - fh * 0.1, m * 0.05, t);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const px = w * (0.1 + ((i * 0.37) % 0.85)) + Math.sin(t * 0.6 + i) * m * 0.03;
      const py = hy + h * (0.15 + ((i * 0.23) % 0.7)) + Math.cos(t * 0.5 + i * 2) * m * 0.03;
      const a = 0.25 + 0.45 * Math.max(0, Math.sin(t * 1.4 + i * 1.7));
      ctx.fillStyle = `rgba(255,236,140,${a})`;
      ctx.beginPath(); ctx.arc(px, py, m * 0.006, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function lantern(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  const flick = 0.85 + 0.15 * Math.sin(t * 7 + x);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - s, 0, x, y - s, s * 4.5 * flick);
  g.addColorStop(0, 'rgba(255,200,110,0.55)'); g.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = g; ctx.fillRect(x - s * 6, y - s * 7, s * 12, s * 12);
  ctx.restore();
  ctx.fillStyle = '#3a2f2a'; ctx.fillRect(x - s * 0.5, y - s * 0.3, s, s * 0.2);
  ctx.fillRect(x - s * 0.45, y - s * 1.9, s * 0.9, s * 0.2);
  roundRectPath(ctx, x - s * 0.42, y - s * 1.7, s * 0.84, s * 1.4, s * 0.15);
  ctx.fillStyle = '#ffd88a'; ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.08); ctx.strokeStyle = '#3a2f2a'; ctx.stroke();
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(x, y - s, s * 0.14, s * 0.3 * flick, 0, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- the hiding places

/** the animal comes up as the cover goes: `from` is where in the opening it starts, `to` where it is full size */
export const pop = (e: number, from = 0.15, to = 0.85): number => easeOutBack(clamp01((e - from) / (to - from)));

function circles(ctx: Ctx, list: ReadonlyArray<readonly [number, number, number]>, cx: number, cy: number, r: number, side: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, r * 0.06); ctx.strokeStyle = shade(fill, -0.22);
  for (const [dx, dy, rr] of list) { ctx.beginPath(); ctx.arc(cx + side * dx * r, cy + dy * r, rr * r, 0, TAU); ctx.stroke(); }
  for (const [dx, dy, rr] of list) { ctx.beginPath(); ctx.arc(cx + side * dx * r, cy + dy * r, rr * r, 0, TAU); ctx.fill(); }
}

const BUSH_HALF = [[0.38, 0.05, 0.62], [0.62, 0.42, 0.5], [0.2, -0.4, 0.5], [0.7, -0.15, 0.4]] as const;
const CLOUD_HALF = [[0.34, 0.1, 0.52], [0.7, 0.28, 0.36], [0.16, -0.3, 0.42], [0.58, -0.12, 0.34]] as const;

/**
 * Draw one hiding place whose middle is (cx, cy) and whose size is r. `e` is how open it is, `t` the
 * clock for small movements, `tint` turns a day colour into a night one.
 */
export function paintHide(ctx: Ctx, id: HideId, cx: number, cy: number, r: number, e: number, t: number, tint: (c: string) => string, critter: Critter): void {
  const k = tint;
  const lw = Math.max(1.5, r * 0.06);
  const show = e > 0.02;
  const R = r * CRITTER;
  ctx.save();
  ctx.lineJoin = 'round';
  switch (id) {
    case 'bush': {
      contactShadow(ctx, cx, cy + r * 0.72, r * 1.15, r * 0.2, 0.3);
      if (show) { ctx.fillStyle = k('#2d5530'); ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 0.8, r * 0.6, 0, 0, TAU); ctx.fill(); }
      if (show) critter(cx, cy + r * 0.1 - e * r * 0.15, R * pop(e));
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + side * e * r * 0.85, cy + r * 0.3);
        ctx.rotate(side * e * 0.3);
        ctx.translate(-cx, -(cy + r * 0.3));
        circles(ctx, BUSH_HALF, cx, cy, r, side, k('#4fa94f'));
        ctx.fillStyle = k('#7ccf68');
        ctx.beginPath(); ctx.arc(cx + side * r * 0.3, cy - r * 0.5, r * 0.12, 0, TAU); ctx.arc(cx + side * r * 0.75, cy + r * 0.05, r * 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = k('#e0524d');
        ctx.beginPath(); ctx.arc(cx + side * r * 0.5, cy + r * 0.2, r * 0.07, 0, TAU); ctx.arc(cx + side * r * 0.2, cy - r * 0.1, r * 0.06, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'barrel': {
      contactShadow(ctx, cx, cy + r * 0.8, r * 1.0, r * 0.18, 0.3);
      const bw = r * 1.35, top = cy - r * 0.5, bot = cy + r * 0.75;
      ctx.fillStyle = k('#2b1d14'); ctx.beginPath(); ctx.ellipse(cx, top, bw * 0.47, r * 0.17, 0, 0, TAU); ctx.fill();
      if (show) critter(cx, cy - r * 0.25 - e * r * 0.45, R * pop(e));
      // the staves bulge: a barrel is widest in the middle
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.42, top);
      ctx.quadraticCurveTo(cx - bw * 0.62, (top + bot) / 2, cx - bw * 0.42, bot);
      ctx.lineTo(cx + bw * 0.42, bot);
      ctx.quadraticCurveTo(cx + bw * 0.62, (top + bot) / 2, cx + bw * 0.42, top);
      ctx.closePath();
      ctx.fillStyle = k('#b57a45'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#6f4524'); ctx.stroke();
      ctx.strokeStyle = k('#6f4524'); ctx.lineWidth = lw * 0.6;
      for (const dx of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(cx + bw * dx, top + r * 0.05); ctx.quadraticCurveTo(cx + bw * dx * 1.4, (top + bot) / 2, cx + bw * dx, bot); ctx.stroke(); }
      for (const f of [0.2, 0.8]) {
        const y = top + (bot - top) * f, sw = bw * (0.46 + 0.1 * Math.sin(f * Math.PI));
        ctx.fillStyle = k('#59636e'); roundRectPath(ctx, cx - sw, y - r * 0.05, sw * 2, r * 0.1, r * 0.04); ctx.fill();
      }
      // the lid slides off to the side and lies against the barrel
      ctx.save();
      ctx.translate(cx + e * r * 0.95, top + e * (bot - top - r * 0.08));
      ctx.rotate(e * 0.7);
      ctx.fillStyle = k('#c98d55'); ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, r * 0.19, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = k('#6f4524'); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'blanket': {
      contactShadow(ctx, cx, cy + r * 0.62, r * 1.2, r * 0.2, 0.3);
      if (show) { ctx.fillStyle = k('#4a3b2c'); ctx.beginPath(); ctx.ellipse(cx + r * 0.2, cy + r * 0.5, r * 0.9, r * 0.2, 0, 0, TAU); ctx.fill(); }
      if (show) critter(cx + r * 0.3, cy + r * 0.05 - e * r * 0.1, R * pop(e) * 0.92);
      ctx.save();
      // hinged at the left foot, so the far side lifts like a hand lifting a corner
      const hx = cx - r * 0.95, hyy = cy + r * 0.6;
      ctx.translate(hx, hyy); ctx.rotate(-e * 1.15); ctx.translate(-hx, -hyy);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy + r * 0.6);
      ctx.bezierCurveTo(cx - r * 0.95, cy - r * 0.2, cx - r * 0.5, cy - r * 0.6, cx, cy - r * 0.6);
      ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.6, cx + r * 0.95, cy - r * 0.2, cx + r * 0.95, cy + r * 0.6);
      ctx.closePath();
      ctx.fillStyle = k('#e8665c'); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = k('#fff6ee');
      const cell = r * 0.3;
      for (let gx = -4; gx < 4; gx++) for (let gy = -3; gy < 3; gy++) if ((gx + gy) % 2 === 0) ctx.fillRect(cx + gx * cell, cy + gy * cell, cell, cell);
      ctx.restore();
      ctx.lineWidth = lw; ctx.strokeStyle = k('#b9473f'); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'door': {
      contactShadow(ctx, cx, cy + r * 0.98, r * 1.2, r * 0.18, 0.3);
      const ww = r * 1.0, wt = cy - r * 1.0, wb = cy + r * 0.95;
      // the shed: a wall, a roof and a doorway
      roundRectPath(ctx, cx - ww, wt, ww * 2, wb - wt, r * 0.06);
      ctx.fillStyle = k('#c4574a'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#8b3a31'); ctx.stroke();
      ctx.strokeStyle = k('#a8473d'); ctx.lineWidth = lw * 0.5;
      for (const dx of [-0.8, -0.6, 0.6, 0.8]) { ctx.beginPath(); ctx.moveTo(cx + ww * dx, wt + r * 0.15); ctx.lineTo(cx + ww * dx, wb); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - ww * 1.18, wt + r * 0.05); ctx.lineTo(cx, wt - r * 0.5); ctx.lineTo(cx + ww * 1.18, wt + r * 0.05); ctx.closePath();
      ctx.fillStyle = k('#6b4a3a'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#46301f'); ctx.stroke();
      const dl = cx - r * 0.52, dr = cx + r * 0.52, dt = cy - r * 0.55, db = wb;
      ctx.fillStyle = k('#2a1d1a'); ctx.fillRect(dl, dt, dr - dl, db - dt);
      if (show) {
        ctx.save(); ctx.beginPath(); ctx.rect(dl, dt, dr - dl, db - dt); ctx.clip();
        critter(cx, cy + r * 0.3 + (1 - clamp01(e * 1.6)) * r * 0.5, R * 0.8 * pop(e, 0.1, 0.7));
        ctx.restore();
      }
      // the door swings on its left hinge and narrows as it turns away
      const sw = Math.max(0.12, Math.cos(e * 1.35));
      ctx.save(); ctx.translate(dl, 0); ctx.scale(sw, 1); ctx.translate(-dl, 0);
      ctx.fillStyle = k('#d9a15a'); ctx.fillRect(dl, dt, dr - dl, db - dt);
      ctx.lineWidth = lw; ctx.strokeStyle = k('#7a4f25'); ctx.strokeRect(dl, dt, dr - dl, db - dt);
      ctx.beginPath(); ctx.moveTo(dl + (dr - dl) / 2, dt); ctx.lineTo(dl + (dr - dl) / 2, db); ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.fillStyle = k('#4a3320'); ctx.beginPath(); ctx.arc(dr - r * 0.12, cy + r * 0.2, r * 0.07, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'haystack': {
      contactShadow(ctx, cx, cy + r * 0.72, r * 1.3, r * 0.2, 0.3);
      if (show) critter(cx, cy - r * 0.2 - e * r * 0.5, R * pop(e));
      const squash = 1 - e * 0.06;
      ctx.save(); ctx.translate(cx, cy + r * 0.7); ctx.scale(1, squash); ctx.translate(-cx, -(cy + r * 0.7));
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.1, cy + r * 0.7);
      ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.1, cx - r * 0.5, cy - r * 0.75, cx, cy - r * 0.75);
      ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.75, cx + r * 1.1, cy - r * 0.1, cx + r * 1.1, cy + r * 0.7);
      ctx.closePath();
      ctx.fillStyle = k('#efc95a'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#b8902f'); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = k('#c9a13c'); ctx.lineWidth = lw * 0.6; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const sx = cx + ((i * 0.618) % 1 - 0.5) * r * 2, sy = cy - r * 0.6 + ((i * 0.37) % 1) * r * 1.2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + r * 0.25, sy + r * 0.12); ctx.stroke();
      }
      ctx.restore(); ctx.restore();
      break;
    }
    case 'rock': {
      contactShadow(ctx, cx, cy + r * 0.72, r * 1.3, r * 0.2, 0.3);
      if (show) { ctx.fillStyle = k('#5a3f2a'); ctx.beginPath(); ctx.ellipse(cx - r * 0.1, cy + r * 0.5, r * 0.9, r * 0.25, 0, 0, TAU); ctx.fill(); }
      if (show) critter(cx - r * 0.2, cy + r * 0.05 - e * r * 0.05, R * pop(e, 0.25, 0.9));
      const rx = cx + e * r * 1.35, ry = cy + r * 0.12;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(e * 1.1);
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, r * 0.55);
      ctx.bezierCurveTo(-r * 1.15, -r * 0.2, -r * 0.5, -r * 0.7, 0, -r * 0.62);
      ctx.bezierCurveTo(r * 0.6, -r * 0.7, r * 1.15, -r * 0.1, r * 1.0, r * 0.55);
      ctx.bezierCurveTo(r * 0.5, r * 0.7, -r * 0.5, r * 0.7, -r * 1.0, r * 0.55);
      ctx.closePath();
      ctx.fillStyle = k('#9aa1a8'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#646c74'); ctx.stroke();
      ctx.fillStyle = hexA('#ffffff', 0.25); ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.16, -0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = k('#747c84'); ctx.lineWidth = lw * 0.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.1); ctx.lineTo(r * 0.45, r * 0.15); ctx.lineTo(r * 0.3, r * 0.35); ctx.stroke();
      ctx.fillStyle = k('#6fae5c'); ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 0.45, r * 0.3, r * 0.1, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'wave': {
      // a patch of pond with a wave standing in it; the wave sinks and the animal comes up
      ctx.fillStyle = k('#4a9fd8'); ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 1.3, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = k('#2f7bb5'); ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = lw * 0.7; ctx.lineCap = 'round';
      for (const [dx, dy] of [[-0.8, 0.6], [0.7, 0.7], [0.9, 0.3]]) {
        ctx.beginPath(); ctx.moveTo(cx + dx * r - r * 0.18, cy + dy * r); ctx.quadraticCurveTo(cx + dx * r, cy + dy * r - r * 0.1, cx + dx * r + r * 0.18, cy + dy * r); ctx.stroke();
      }
      if (show) critter(cx, cy + r * 0.05 - e * r * 0.25, R * pop(e, 0.1, 0.8));
      const sink = e * r * 0.75, bob = Math.sin(t * 2.2) * r * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.1, cy + r * 0.75 + sink);
      ctx.bezierCurveTo(cx - r * 1.0, cy - r * 0.1 + sink, cx - r * 0.5, cy - r * 0.6 + sink + bob, cx + r * 0.05, cy - r * 0.55 + sink + bob);
      ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.5 + sink, cx + r * 0.2, cy - r * 0.15 + sink, cx + r * 0.55, cy - r * 0.05 + sink);
      ctx.bezierCurveTo(cx + r * 0.9, cy + r * 0.1 + sink, cx + r * 1.0, cy + r * 0.5 + sink, cx + r * 1.1, cy + r * 0.75 + sink);
      ctx.closePath();
      ctx.fillStyle = k('#5fb3ea'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = k('#2f7bb5'); ctx.stroke();
      ctx.fillStyle = hexA('#ffffff', 0.85);
      ctx.beginPath(); ctx.ellipse(cx - r * 0.1, cy - r * 0.5 + sink + bob, r * 0.38, r * 0.1, -0.15, 0, TAU); ctx.fill();
      break;
    }
    case 'cloud': {
      if (show) critter(cx, cy + r * 0.05, R * pop(e, 0.2, 0.9));
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(side * e * r * 0.95, -e * r * 0.1);
        circles(ctx, CLOUD_HALF, cx, cy, r, side, k('#ffffff'));
        circles(ctx, [[0.2, 0.45, 0.3]], cx, cy, r, side, k('#ffffff'));
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- a small stand-in for the end card

/** a tick mark for the found row: a round dot that fills when the animal has been found */
export function foundDot(ctx: Ctx, x: number, y: number, r: number, on: boolean): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = on ? '#ffd54f' : 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.25); ctx.strokeStyle = on ? '#c9962b' : 'rgba(18,48,71,0.3)'; ctx.stroke();
}
