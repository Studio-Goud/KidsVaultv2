/**
 * Everything Trommelkring draws that is not interface: the dusk, the fire, the drums and Suri's paws.
 *
 * The drum is drawn once and used twice, small in front of Suri and large under the child's hands,
 * so that the two read as the same instrument. Its skin is split down the middle because the two
 * halves are the two sounds: darker and warmer on the left for the low "boem", paler on the right
 * for the high "tik".
 */

import { drawGuide } from '../../platform/guide';
import { hexA, mix, shade, type Ctx } from '../../render/look';
import { makeRng } from '../../util/rng';

const TAU = Math.PI * 2;

export const SKIN_L = '#d9904f';
export const SKIN_R = '#f2d9a4';
export const SIDE_L = '#c4642f';
export const SIDE_R = '#e9b84a';

/** The sky at dusk, the hills, the ground; returns where the ground starts. */
export function paintDusk(ctx: Ctx, w: number, h: number, horizon: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#171a49');
  sky.addColorStop(0.55, '#4f3a7c');
  sky.addColorStop(1, '#e8845c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 2);
  // stars: the same ones every time, a few of them breathing
  const rng = makeRng(31);
  for (let i = 0; i < 34; i++) {
    const x = rng() * w, y = rng() * horizon * 0.62, r = 0.8 + rng() * 1.4, ph = rng() * TAU;
    ctx.fillStyle = `rgba(255, 248, 224, ${0.45 + 0.4 * Math.sin(t * 1.3 + ph)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // hills
  ctx.fillStyle = '#2d2352';
  ctx.beginPath(); ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, horizon - 14 - 26 * Math.sin(x / w * 5.1 + 0.8) - 12 * Math.sin(x / w * 11));
  ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#251b43';
  ctx.beginPath(); ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, horizon - 4 - 14 * Math.sin(x / w * 7.3 + 2.2));
  ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();
  // ground
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, '#46304a');
  g.addColorStop(1, '#2a1d34');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon - 1, w, h - horizon + 2);
}

export function paintMoon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
  g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff1cf';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4f3a7c';
  ctx.beginPath(); ctx.arc(x + r * 0.42, y - r * 0.12, r * 0.86, 0, TAU); ctx.fill();
  ctx.restore();
}

/** A ring of stones and a small fire, `s` tall. (x, y) is the ground under the logs. */
export function paintFire(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.save();
  // the light it throws on the ground
  const glow = ctx.createRadialGradient(x, y, s * 0.1, x, y - s * 0.2, s * 2.4);
  glow.addColorStop(0, 'rgba(255,170,70,0.5)'); glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.15, s * 2.4, s * 1.3, 0, 0, TAU); ctx.fill();
  // stones, the back half first
  const stone = (a: number, front: boolean): void => {
    const sx = x + Math.cos(a) * s * 0.62, sy = y + Math.sin(a) * s * 0.2;
    if ((Math.sin(a) > 0) !== front) return;
    ctx.fillStyle = '#6b5a72';
    ctx.beginPath(); ctx.ellipse(sx, sy, s * 0.13, s * 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,190,110,0.5)';
    ctx.beginPath(); ctx.ellipse(sx - s * 0.02, sy - s * 0.02, s * 0.08, s * 0.045, 0, 0, TAU); ctx.fill();
  };
  for (let i = 0; i < 9; i++) stone(i / 9 * TAU + 0.2, false);
  // two logs crossed
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a2c1c'; ctx.lineWidth = s * 0.15;
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, y + s * 0.02); ctx.lineTo(x + s * 0.4, y - s * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.38, y - s * 0.08); ctx.lineTo(x + s * 0.42, y + s * 0.02); ctx.stroke();
  // flames: three teardrops, each leaning its own way
  const flame = (fx: number, fh: number, fw: number, c0: string, c1: string, ph: number): void => {
    const sway = Math.sin(t * 5 + ph) * fw * 0.25, tall = fh * (1 + 0.08 * Math.sin(t * 7.3 + ph));
    const g = ctx.createLinearGradient(0, y, 0, y - tall);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(fx - fw, y - s * 0.05);
    ctx.bezierCurveTo(fx - fw * 1.2, y - tall * 0.5, fx + sway * 0.4 - fw * 0.2, y - tall * 0.7, fx + sway, y - tall);
    ctx.bezierCurveTo(fx + fw * 0.3 + sway * 0.4, y - tall * 0.65, fx + fw * 1.2, y - tall * 0.45, fx + fw, y - s * 0.05);
    ctx.closePath(); ctx.fill();
  };
  flame(x - s * 0.18, s * 0.78, s * 0.2, '#e8501c', '#ff9a3a', 0);
  flame(x + s * 0.2, s * 0.68, s * 0.19, '#e8501c', '#ffa63f', 2);
  flame(x, s * 0.98, s * 0.26, '#f0701f', '#ffd25a', 4);
  flame(x, s * 0.52, s * 0.14, '#ffc23a', '#fff1a8', 1);
  for (let i = 0; i < 9; i++) stone(i / 9 * TAU + 0.2, true);
  ctx.restore();
}

export interface DrumLook {
  /** 0..1, how bright each half of the skin is just after a hit */
  flashL: number;
  flashR: number;
  /** a single skin, one sound (the simple shape) */
  single?: boolean;
  /** dim the whole drum: it is not your turn */
  dim?: number;
  /** show the names of the halves */
  labels?: [string, string];
  labelFont?: string;
}

/**
 * A drum seen from a little above: an ellipse of skin on a body with rope laced down its side.
 * (cx, cy) is the middle of the skin, `rx` and `ry` its half-width and half-height, `depth` how far
 * the body hangs below it.
 */
export function paintDrum(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, depth: number, look: DrumLook): void {
  ctx.save();
  // shadow on the ground
  ctx.fillStyle = 'rgba(10,6,20,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + depth + ry * 0.92, rx * 1.02, ry * 0.32, 0, 0, TAU); ctx.fill();
  // body
  const body = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  body.addColorStop(0, shade('#8a4a2a', -0.12)); body.addColorStop(0.35, '#a9603a'); body.addColorStop(1, shade('#8a4a2a', -0.25));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx, cy + depth);
  ctx.ellipse(cx, cy + depth, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, cy);
  ctx.closePath(); ctx.fill();
  // the lacing: zigzag rope
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx, cy + depth);
  ctx.ellipse(cx, cy + depth, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, cy);
  ctx.closePath(); ctx.clip();
  ctx.strokeStyle = '#f0dcae'; ctx.lineWidth = Math.max(1.5, rx * 0.012); ctx.lineJoin = 'round';
  const n = Math.max(8, Math.round(rx / 14));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);
    const x = cx - Math.cos(a) * rx * 0.96;
    const yEdge = cy + Math.sin(a) * ry * 0.98;
    ctx.lineTo(x, i % 2 === 0 ? yEdge + depth * 0.1 : yEdge + depth * 0.9);
  }
  ctx.stroke();
  ctx.restore();
  // rim
  ctx.fillStyle = '#c98a48';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  // skin
  const ix = rx * 0.94, iy = ry * 0.9;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, ix, iy, 0, 0, TAU); ctx.clip();
  const dim = look.dim ?? 0;
  const half = (x0: number, x1: number, base: string, flash: number): void => {
    ctx.fillStyle = mix(mix(base, '#6a4a5a', dim), '#fffbe8', Math.min(1, flash) * 0.7);
    ctx.fillRect(x0, cy - iy, x1 - x0, iy * 2);
  };
  if (look.single) half(cx - ix, cx + ix, '#e8b878', Math.max(look.flashL, look.flashR));
  else { half(cx - ix, cx, SKIN_L, look.flashL); half(cx, cx + ix, SKIN_R, look.flashR); }
  // a soft highlight across the top, so it reads as taut
  const hl = ctx.createLinearGradient(0, cy - iy, 0, cy + iy);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(60,20,10,0.18)');
  ctx.fillStyle = hl; ctx.fillRect(cx - ix, cy - iy, ix * 2, iy * 2);
  ctx.restore();
  if (!look.single) {
    ctx.strokeStyle = 'rgba(110,60,30,0.55)'; ctx.lineWidth = Math.max(1.5, rx * 0.01);
    ctx.beginPath(); ctx.moveTo(cx, cy - iy); ctx.lineTo(cx, cy + iy); ctx.stroke();
  }
  ctx.strokeStyle = hexA('#7a4420', 0.7); ctx.lineWidth = Math.max(1.5, rx * 0.012);
  ctx.beginPath(); ctx.ellipse(cx, cy, ix, iy, 0, 0, TAU); ctx.stroke();
  if (look.labels && look.labelFont) {
    ctx.font = look.labelFont; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(90,40,20,0.7)';
    ctx.fillText(look.labels[0], cx - ix * 0.5, cy + iy * 0.12);
    ctx.fillText(look.labels[1], cx + ix * 0.5, cy + iy * 0.12);
  }
  ctx.restore();
}

export interface SuriDrumLook {
  t: number;
  /** 0..1 how far each paw is down on the skin: 1 is the moment of the hit, then it lifts */
  pawL: number;
  pawR: number;
  flashL: number;
  flashR: number;
  single: boolean;
  saying: number;
}

/**
 * Suri sitting behind his small drum, paws on it. (x, ground) is the ground under him, `size` is
 * how tall he is. The drum is drawn over his legs so he reads as sitting; the arms and paws are
 * drawn here, over the guide's own, because they are what has to move.
 */
export function paintSuriDrum(ctx: Ctx, x: number, ground: number, size: number, look: SuriDrumLook): void {
  // a log he sits on
  ctx.fillStyle = '#4a2c1c';
  ctx.beginPath(); ctx.ellipse(x, ground - size * 0.02, size * 0.5, size * 0.1, 0, 0, TAU); ctx.fill();
  drawGuide(ctx, x, ground - size * 0.04, size, { pose: look.saying > 0 ? 'talk' : 'watch', t: look.t, facing: 1, saying: look.saying });
  const rx = size * 0.34, ry = size * 0.11, depth = size * 0.14;
  const cy = ground - size * 0.27;
  paintDrum(ctx, x, cy, rx, ry, depth, { flashL: look.flashL, flashR: look.flashR, single: look.single });
  // arms and paws
  const shoulderY = ground - size * 0.46;
  const rest = size * 0.2;
  const paw = (side: -1 | 1, down: number): void => {
    const px = x + side * rx * (look.single ? 0.35 : 0.5);
    const py = cy - rest * (1 - down) - ry * 0.05 * down;
    ctx.strokeStyle = '#b9884a'; ctx.lineWidth = size * 0.085; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + side * size * 0.1, shoulderY); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#d9a96a';
    ctx.beginPath(); ctx.ellipse(px, py, size * 0.075, size * 0.06, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3524';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(px + k * size * 0.035, py + size * 0.03, size * 0.014, 0, TAU); ctx.fill(); }
  };
  paw(-1, look.pawL);
  paw(1, look.pawR);
}
