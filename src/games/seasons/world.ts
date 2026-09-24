/**
 * The living landscape behind "Het jaar rond": one Dutch field with a tree, a house, a mill and a
 * sky, drawn so that both the season and the time of day can slide through it continuously.
 *
 * The owner asked for moving pictures rather than a diagram, and a season is not a switch: the
 * blossom thins into green, the green turns and falls, the snow comes. So `season` is a number,
 * 0 lente, 1 zomer, 2 herfst, 3 winter and back round to 4 = lente, and every colour and every
 * leaf is blended between the two seasons it sits between. A child dragging across the picture
 * sees the year pass, not four slides. The same goes for `sun` (0 sunrise, 1 sunset, outside that
 * below the horizon) and `night` (0..1), which the day-and-night level drives.
 *
 * The sun stands lower in winter than in summer. That is not decoration: it is the reason winter
 * is cold. At 52 degrees north the midday sun stands at 90 - 52 plus the sun's declination: about
 * 48 degrees in mid-April, 59 in mid-July, 29 in mid-October and 17 in mid-January. The arc heights
 * below are those four angles divided by the July one, so the picture is to scale, not guessed.
 */

import { TAU } from '../../util/math';
import { hexA, mix, shade } from '../../render/look';

type Ctx = CanvasRenderingContext2D;

export interface World {
  /** 0 lente, 1 zomer, 2 herfst, 3 winter; fractions blend, and it wraps at 4. */
  season: number;
  /** 0 sunrise at the left, 0.5 noon, 1 sunset at the right; outside 0..1 the sun is down. */
  sun: number;
  /** 0 day, 1 full night: stars, moon, lit windows. */
  night: number;
  t: number;
  u: number;
  /** Leave out the tree and the house, when something else has to stand in front. */
  bare?: boolean;
  /** Put the child in the field, dressed for the season. */
  child?: boolean;
}

// ---------------------------------------------------------------- blending

const wrap4 = (s: number): number => ((s % 4) + 4) % 4;

/** How much of season `i` is in `s`: 1 on the season itself, falling to 0 at its neighbours. */
export function weight(s: number, i: number): number {
  const d = Math.abs(wrap4(s) - i);
  return Math.max(0, 1 - Math.min(d, 4 - d));
}

/** A colour for each season, blended at `s`. */
function tone(s: number, c: readonly [string, string, string, string]): string {
  const a = wrap4(s), i0 = Math.floor(a) % 4, i1 = (i0 + 1) % 4;
  return mix(c[i0], c[i1], a - Math.floor(a));
}

function num(s: number, v: readonly [number, number, number, number]): number {
  const a = wrap4(s), i0 = Math.floor(a) % 4, i1 = (i0 + 1) % 4, f = a - Math.floor(a);
  return v[i0] * (1 - f) + v[i1] * f;
}

/** A small seeded generator, so the tree and the stars are the same every frame. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the tree, built once

interface Seg { x0: number; y0: number; x1: number; y1: number; w: number; depth: number }
interface Leaf { x: number; y: number; a: number; r: number; keep: number; hue: number; phase: number }

let TREE: { segs: Seg[]; leaves: Leaf[] } | null = null;

/** An oak-ish tree in unit space: base at 0,0, top near 0,-1. */
function tree(): { segs: Seg[]; leaves: Leaf[] } {
  if (TREE) return TREE;
  const r = rng(7);
  const segs: Seg[] = [];
  const tips: { x: number; y: number }[] = [];
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number): void => {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    segs.push({ x0: x, y0: y, x1, y1, w, depth });
    if (depth >= 4) { tips.push({ x: x1, y: y1 }); return; }
    const n = depth === 0 ? 3 : 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const spread = (k - (n - 1) / 2) * (0.55 + r() * 0.25);
      grow(x1, y1, ang + spread + (r() - 0.5) * 0.3, len * (0.68 + r() * 0.12), w * 0.66, depth + 1);
    }
    if (depth >= 2) tips.push({ x: x1, y: y1 });
  };
  grow(0, 0, -Math.PI / 2, 0.36, 0.075, 0);
  const leaves: Leaf[] = [];
  for (const tip of tips) {
    for (let k = 0; k < 16; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.12;
      leaves.push({
        x: tip.x + Math.cos(a) * d, y: tip.y + Math.sin(a) * d * 0.85,
        a: r() * TAU, r: 0.013 + r() * 0.008, keep: r(), hue: r(), phase: r() * TAU,
      });
    }
  }
  // back to front, so the lower leaves overlap the ones behind them
  leaves.sort((p, q) => p.y - q.y);
  TREE = { segs, leaves };
  return TREE;
}

const SPRING = ['#9ed56b', '#b6e07a', '#f6c3d8', '#fbe0ea'];
const SUMMER = ['#3f8f3a', '#4f9e44', '#5fae4c', '#357f35'];
const AUTUMN = ['#e0712b', '#f2b233', '#c2452b', '#b86b2a'];

function leafColour(s: number, hue: number): string {
  const k = Math.min(3, Math.floor(hue * 4));
  // winter keeps the autumn colour for the last leaves still hanging
  return tone(s, [SPRING[k], SUMMER[k], AUTUMN[k], AUTUMN[k]]);
}

// ---------------------------------------------------------------- the picture

export function drawWorld(ctx: Ctx, x: number, y: number, w: number, h: number, st: World): void {
  const { season: s, t, u } = st;
  const night = Math.max(0, Math.min(1, st.night));
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  const horizon = y + h * 0.6;
  sky(ctx, x, y, w, h, horizon, st, night);

  // far hills, hazy, with the mill on them
  const far = tone(s, ['#a6d38a', '#8cc070', '#c7b176', '#e6eef4']);
  const haze = night > 0 ? mix(far, '#1d3050', night * 0.75) : far;
  hills(ctx, x, w, horizon, h * 0.07, y + h, mix(haze, '#dcebf3', 0.25), 1.3, 0.4);
  mill(ctx, x + w * 0.86, horizon - h * 0.02, h * 0.2, t, s, night);
  const mid = tone(s, ['#8fcf6e', '#6fb04f', '#b8904a', '#f1f5f9']);
  hills(ctx, x, w, horizon + h * 0.06, h * 0.05, y + h, night > 0 ? mix(mid, '#16263f', night * 0.7) : mid, 2.1, 1.7);

  // the field in front
  const groundY = y + h * 0.78;
  const g0 = tone(s, ['#8fd06a', '#72b64e', '#c79a55', '#f7fafc']);
  const g1 = tone(s, ['#6fb04f', '#579a3c', '#a67a3c', '#dbe7f0']);
  const gg = ctx.createLinearGradient(0, groundY - h * 0.08, 0, y + h);
  gg.addColorStop(0, g0); gg.addColorStop(1, g1);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, groundY);
  ctx.bezierCurveTo(x + w * 0.3, groundY - h * 0.07, x + w * 0.62, groundY + h * 0.02, x + w, groundY - h * 0.04);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ditch(ctx, x, y, w, h, s, t, night);

  if (!st.bare) house(ctx, x + w * 0.7, groundY - h * 0.005, Math.min(h * 0.3, w * 0.42), s, t);
  flowers(ctx, x, y, w, h, s, t);
  if (!st.bare) {
    const tx = x + w * 0.28, th = Math.min(h * 0.6, w * 0.78);
    drawTree(ctx, tx, groundY + h * 0.03, th, s, t);
  }
  if (!st.bare) snowman(ctx, x + w * 0.5, y + h * 0.93, Math.min(h * 0.18, w * 0.26), weight(s, 3), t);
  if (st.child) child(ctx, x + w * 0.5, y + h * 0.95, Math.min(h * 0.21, w * 0.3), s, t);

  // the dark comes down over everything that is not a light
  if (night > 0) {
    // lighter at the top, where the sky has already gone dark, so there is no edge in the air
    const dark = ctx.createLinearGradient(0, y, 0, horizon);
    dark.addColorStop(0, `rgba(8,16,40,${0.25 * night})`);
    dark.addColorStop(1, `rgba(8,16,40,${0.55 * night})`);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    if (!st.bare) windows(ctx, x + w * 0.7, groundY - h * 0.005, Math.min(h * 0.3, w * 0.42), night);
  }
  // morning and evening colour the land warm
  const low = daylightLow(st.sun) * (1 - night);
  if (low > 0) {
    ctx.fillStyle = `rgba(255,140,70,${0.16 * low})`;
    ctx.fillRect(x, y, w, h);
  }

  falling(ctx, x, y, w, h, s, t, u);
  if (!st.bare) birds(ctx, x, y, w, h, s, t, night);
  ctx.restore();
}

/** 1 when the sun is on the horizon, 0 from mid-morning to mid-afternoon. */
function daylightLow(sun: number): number {
  const d = Math.min(Math.abs(sun), Math.abs(1 - sun));
  return Math.max(0, 1 - d / 0.22);
}

function sky(ctx: Ctx, x: number, y: number, w: number, h: number, horizon: number, st: World, night: number): void {
  const s = st.season, sun = st.sun, t = st.t;
  const low = daylightLow(sun);
  // clear blue in summer, paler and greyer in autumn and winter
  const dayTop = tone(s, ['#5aaee8', '#3f9be3', '#7fa6c6', '#9fbcd4']);
  const dayLow = tone(s, ['#d9f1fb', '#dff3ff', '#e6e2d6', '#eef3f7']);
  let top = mix(dayTop, '#6d7fb8', low * 0.55);
  let bottom = mix(dayLow, '#ffc38a', low * 0.85);
  top = mix(top, '#0a1733', night);
  bottom = mix(bottom, '#22385e', night);
  const g = ctx.createLinearGradient(0, y, 0, horizon + h * 0.1);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // stars and the moon, fading in with the night
  if (night > 0.02) {
    const r = rng(31);
    for (let i = 0; i < 70; i++) {
      const fx = r(), fy = r(), sz = 0.6 + r() * 1.4, ph = r() * TAU;
      ctx.globalAlpha = night * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + ph)));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + fx * w, y + fy * (horizon - y) * 0.9, sz * st.u, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = night;
    const mx = x + w * 0.62, my = y + h * 0.3, mr = Math.min(h, w) * 0.05;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
    mg.addColorStop(0, 'rgba(230,236,255,0.35)'); mg.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#f4f1e0';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,196,170,0.5)';
    ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.14, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // the sun: its noon height set by the season (see the file comment), its path a flattened arc
  const noon = num(s, [0.81, 1, 0.5, 0.29]);
  const sx = x + w * (0.06 + sun * 0.88);
  const sy = horizon - h * 0.05 - Math.sin(Math.max(-0.4, Math.min(Math.PI + 0.4, sun * Math.PI))) * (horizon - y - h * 0.1) * noon;
  const sr = Math.min(h, w) * 0.055;
  if (sy < horizon + sr && night < 0.98) {
    ctx.globalAlpha = 1 - night;
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
    const warm = mix('#fff4c2', '#ffb070', low);
    gr.addColorStop(0, hexA(warm, 0.7)); gr.addColorStop(0.3, hexA(warm, 0.25)); gr.addColorStop(1, hexA(warm, 0));
    ctx.fillStyle = gr; ctx.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
    ctx.fillStyle = mix('#ffe35a', '#ff9a4a', low);
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // clouds drift; more of them, and greyer, in autumn and winter
  const count = Math.round(num(s, [3, 2, 5, 4]));
  const cloud = mix(mix(tone(s, ['#ffffff', '#ffffff', '#e4e6ea', '#eef1f4']), '#ffd2b0', low * 0.6), '#34466a', night);
  for (let i = 0; i < count; i++) {
    const speed = 6 + i * 3;
    const span = w + h * 0.8;
    const cx = x - h * 0.4 + (((i * 0.37 * span + t * speed * st.u) % span) + span) % span;
    const cy = y + h * (0.1 + (i % 3) * 0.09);
    puff(ctx, cx, cy, h * (0.06 + (i % 2) * 0.02), cloud, 0.92 - night * 0.3);
  }
}

function puff(ctx: Ctx, cx: number, cy: number, r: number, colour: string, a: number): void {
  ctx.globalAlpha = a;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.6, r * 0.7, 0, 0, TAU);
  ctx.ellipse(cx - r * 0.7, cy - r * 0.2, r * 0.8, r * 0.7, 0, 0, TAU);
  ctx.ellipse(cx + r * 0.5, cy - r * 0.45, r * 0.9, r * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function hills(ctx: Ctx, x: number, w: number, base: number, amp: number, bottom: number, colour: string, f: number, ph: number): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  for (let i = 0; i <= 40; i++) {
    const k = i / 40;
    const yy = base - amp * (0.6 + 0.4 * Math.sin(k * TAU * f + ph) + 0.25 * Math.sin(k * TAU * f * 2.7 + ph * 2));
    ctx.lineTo(x + k * w, yy);
  }
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
  ctx.fill();
}

/** A polder mill on the far dyke; the sails turn faster in the autumn wind. */
function mill(ctx: Ctx, mx: number, base: number, size: number, t: number, s: number, night: number): void {
  const body = mix('#7b5a45', '#1a2438', night * 0.7);
  ctx.save();
  ctx.translate(mx, base);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-size * 0.14, 0); ctx.lineTo(-size * 0.08, -size * 0.55);
  ctx.lineTo(size * 0.08, -size * 0.55); ctx.lineTo(size * 0.14, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = mix('#4a3a33', '#141c2c', night * 0.7);
  ctx.beginPath(); ctx.ellipse(0, -size * 0.56, size * 0.1, size * 0.07, 0, Math.PI, 0); ctx.fill();
  ctx.translate(0, -size * 0.55);
  ctx.rotate(t * num(s, [0.5, 0.35, 0.9, 0.6]));
  ctx.strokeStyle = mix('#efe6d2', '#3a4660', night * 0.7);
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size * 0.48); ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fillRect(size * 0.015, -size * 0.46, size * 0.08, size * 0.34);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** The ditch along the front of the field: water that ripples, frozen over in winter. */
function ditch(ctx: Ctx, x: number, y: number, w: number, h: number, s: number, t: number, night: number): void {
  const yy = y + h * 0.84, hh = h * 0.035;
  const ice = weight(s, 3);
  const water = mix(mix('#5d9cc4', '#cfe6f2', ice), '#1a2c48', night * 0.6);
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(x, yy + hh * 0.3);
  ctx.bezierCurveTo(x + w * 0.4, yy - hh * 0.4, x + w * 0.6, yy + hh * 0.6, x + w, yy);
  ctx.lineTo(x + w, yy + hh);
  ctx.bezierCurveTo(x + w * 0.6, yy + hh * 1.6, x + w * 0.4, yy + hh * 0.6, x, yy + hh * 1.3);
  ctx.closePath();
  ctx.fill();
  // glints: moving ripples on water, still streaks on ice
  ctx.strokeStyle = `rgba(255,255,255,${0.55 - night * 0.3})`;
  ctx.lineWidth = Math.max(1, h * 0.004);
  for (let i = 0; i < 9; i++) {
    const k = ((i * 0.13 + (1 - ice) * t * 0.03) % 1 + 1) % 1;
    const gx = x + k * w;
    const gy = yy + hh * (0.5 + 0.25 * Math.sin(i * 2.1));
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + w * (0.02 + ice * 0.03), gy); ctx.stroke();
  }
}

/** A Dutch brick house with a stepped gable, snow on the roof in winter, smoke when it is cold. */
function house(ctx: Ctx, hx: number, base: number, size: number, s: number, t: number): void {
  const bw = size * 0.62, bh = size * 0.5;
  ctx.save();
  ctx.translate(hx, base);
  ctx.fillStyle = 'rgba(20,30,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.7, size * 0.04, 0, 0, TAU); ctx.fill();
  // stepped gable: the body and three steps up to the top
  ctx.fillStyle = '#b5563c';
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0); ctx.lineTo(-bw / 2, -bh);
  const step = bw / 8, rise = size * 0.1;
  let cx = -bw / 2, cy = -bh;
  for (let k = 0; k < 3; k++) { ctx.lineTo(cx, cy - rise); cx += step; ctx.lineTo(cx, cy - rise); cy -= rise; }
  ctx.lineTo(cx, cy - rise * 0.6); ctx.lineTo(-cx, cy - rise * 0.6);
  for (let k = 0; k < 3; k++) { ctx.lineTo(-cx, cy); cx -= step; ctx.lineTo(-cx, cy); cy += rise; }
  ctx.lineTo(bw / 2, -bh); ctx.lineTo(bw / 2, 0);
  ctx.closePath(); ctx.fill();
  // brick courses
  ctx.strokeStyle = 'rgba(90,30,20,0.25)';
  ctx.lineWidth = Math.max(0.6, size * 0.006);
  for (let yy = -size * 0.04; yy > -bh; yy -= size * 0.04) {
    ctx.beginPath(); ctx.moveTo(-bw / 2, yy); ctx.lineTo(bw / 2, yy); ctx.stroke();
  }
  // the white trim along the steps
  ctx.fillStyle = '#f3ede2';
  ctx.fillRect(-bw / 2, -bh - size * 0.012, bw, size * 0.024);
  // snow on the steps
  const snow = weight(s, 3);
  if (snow > 0) {
    ctx.globalAlpha = snow;
    ctx.fillStyle = '#ffffff';
    let sx = -bw / 2, sy = -bh;
    for (let k = 0; k < 3; k++) { sy -= rise; ctx.beginPath(); ctx.roundRect(sx - size * 0.01, sy - size * 0.02, step + size * 0.02, size * 0.03, size * 0.015); ctx.fill(); sx += step; }
    sx = bw / 2 - step; sy = -bh;
    for (let k = 0; k < 3; k++) { sy -= rise; ctx.beginPath(); ctx.roundRect(sx - size * 0.01, sy - size * 0.02, step + size * 0.02, size * 0.03, size * 0.015); ctx.fill(); sx -= step; }
    ctx.globalAlpha = 1;
  }
  // door and windows, drawn dark here and lit later by `windows` when it is night
  ctx.fillStyle = '#2f5a3c';
  ctx.beginPath(); ctx.roundRect(-bw * 0.09, -bh * 0.46, bw * 0.18, bh * 0.46, [bw * 0.09, bw * 0.09, 0, 0]); ctx.fill();
  for (const [wx, wy] of WINDOWS) {
    ctx.fillStyle = '#f3ede2';
    ctx.fillRect(wx * bw - bw * 0.1, wy * bh - bh * 0.12, bw * 0.2, bh * 0.24);
    ctx.fillStyle = '#6f8fa6';
    ctx.fillRect(wx * bw - bw * 0.08, wy * bh - bh * 0.1, bw * 0.16, bh * 0.2);
  }
  // chimney, and smoke when it is cold enough to have the stove on
  const cold = weight(s, 2) * 0.6 + weight(s, 3);
  ctx.fillStyle = '#8f4330';
  ctx.fillRect(bw * 0.16, -bh - size * 0.26, size * 0.06, size * 0.12);
  if (cold > 0.05) {
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.25 + i / 6) % 1);
      ctx.globalAlpha = cold * 0.5 * (1 - k);
      ctx.fillStyle = '#e8ecef';
      ctx.beginPath();
      ctx.arc(bw * 0.19 + k * size * 0.25 + Math.sin(t + i) * size * 0.02, -bh - size * 0.28 - k * size * 0.45, size * (0.03 + k * 0.06), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

const WINDOWS: [number, number][] = [[-0.3, -0.62], [0.3, -0.62], [-0.3, -0.25], [0.3, -0.25], [0, -1.1]];

function windows(ctx: Ctx, hx: number, base: number, size: number, night: number): void {
  const bw = size * 0.62, bh = size * 0.5;
  ctx.save();
  ctx.translate(hx, base);
  for (const [wx, wy] of WINDOWS) {
    const cx = wx * bw, cy = wy * bh;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw * 0.35);
    g.addColorStop(0, `rgba(255,210,120,${0.35 * night})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - bw * 0.35, cy - bw * 0.35, bw * 0.7, bw * 0.7);
    ctx.fillStyle = `rgba(255,214,120,${night})`;
    ctx.fillRect(cx - bw * 0.08, cy - bh * 0.1, bw * 0.16, bh * 0.2);
    ctx.fillStyle = `rgba(120,70,30,${night * 0.6})`;
    ctx.fillRect(cx - bw * 0.005, cy - bh * 0.1, bw * 0.01, bh * 0.2);
  }
  ctx.restore();
}

export function drawTree(ctx: Ctx, tx: number, base: number, size: number, s: number, t: number): void {
  const { segs, leaves } = tree();
  const wind = num(s, [0.6, 0.4, 1.2, 0.8]);
  const sway = (yy: number, ph = 0): number => Math.sin(t * 1.1 + ph) * wind * 0.02 * -yy;
  ctx.save();
  ctx.translate(tx, base);
  ctx.fillStyle = 'rgba(20,30,20,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.28, size * 0.035, 0, 0, TAU); ctx.fill();

  ctx.lineCap = 'round';
  const bark = '#6b4a30';
  for (const g of segs) {
    ctx.strokeStyle = g.depth === 0 ? shade(bark, -0.05) : bark;
    ctx.lineWidth = Math.max(1, g.w * size);
    ctx.beginPath();
    ctx.moveTo((g.x0 + sway(g.y0)) * size, g.y0 * size);
    ctx.lineTo((g.x1 + sway(g.y1)) * size, g.y1 * size);
    ctx.stroke();
  }
  // snow along the tops of the branches
  const snow = weight(s, 3);
  if (snow > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${snow * 0.95})`;
    for (const g of segs) {
      if (g.depth === 0) continue;
      ctx.lineWidth = Math.max(1, g.w * size * 0.5);
      ctx.beginPath();
      ctx.moveTo((g.x0 + sway(g.y0)) * size, g.y0 * size - g.w * size * 0.4);
      ctx.lineTo((g.x1 + sway(g.y1)) * size, g.y1 * size - g.w * size * 0.4);
      ctx.stroke();
    }
  }

  // leaves: how many hang depends on the season, and each has its own point where it lets go
  const full = num(s, [0.8, 1, 0.62, 0]);
  for (const lf of leaves) {
    if (lf.keep > full) continue;
    const lx = (lf.x + sway(lf.y, lf.phase * 0.2)) * size + Math.sin(t * 2.3 + lf.phase) * size * 0.004 * wind;
    const ly = lf.y * size;
    ctx.fillStyle = leafColour(s, lf.hue);
    ctx.beginPath();
    ctx.ellipse(lx, ly, lf.r * size, lf.r * size * 0.62, lf.a + Math.sin(t + lf.phase) * 0.2, 0, TAU);
    ctx.fill();
  }
  // apples in late summer
  const fruit = Math.max(0, weight(s, 1.6) - 0.1);
  if (fruit > 0) {
    ctx.globalAlpha = Math.min(1, fruit * 1.4);
    ctx.fillStyle = '#d63a2c';
    for (let i = 0; i < leaves.length; i += 23) {
      const lf = leaves[i];
      ctx.beginPath(); ctx.arc((lf.x + sway(lf.y)) * size, lf.y * size + size * 0.02, size * 0.018, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Tulips in spring, daisies in summer, mushrooms in autumn. */
function flowers(ctx: Ctx, x: number, y: number, w: number, h: number, s: number, t: number): void {
  const r = rng(99);
  const spring = weight(s, 0), summer = weight(s, 1), autumn = weight(s, 2);
  for (let i = 0; i < 26; i++) {
    const fx = x + r() * w, fy = y + h * (0.88 + r() * 0.1), k = r(), sz = h * (0.03 + r() * 0.015);
    const bend = Math.sin(t * 1.5 + i) * sz * 0.08;
    if (spring > 0.02 && k < 0.7) {
      ctx.globalAlpha = spring;
      ctx.strokeStyle = '#4f9a3c'; ctx.lineWidth = Math.max(1, sz * 0.12);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + bend, fy - sz); ctx.stroke();
      ctx.fillStyle = ['#e0453a', '#f7c531', '#f07ab0', '#f28b2f'][i % 4];
      ctx.beginPath();
      ctx.moveTo(fx + bend - sz * 0.22, fy - sz);
      ctx.lineTo(fx + bend - sz * 0.22, fy - sz * 1.35);
      ctx.lineTo(fx + bend - sz * 0.08, fy - sz * 1.22);
      ctx.lineTo(fx + bend, fy - sz * 1.4);
      ctx.lineTo(fx + bend + sz * 0.08, fy - sz * 1.22);
      ctx.lineTo(fx + bend + sz * 0.22, fy - sz * 1.35);
      ctx.lineTo(fx + bend + sz * 0.22, fy - sz);
      ctx.closePath(); ctx.fill();
    }
    if (summer > 0.02 && k > 0.35) {
      ctx.globalAlpha = summer;
      ctx.fillStyle = '#ffffff';
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * TAU;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * sz * 0.14, fy - sz * 0.5 + Math.sin(a) * sz * 0.14, sz * 0.09, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#f7c531';
      ctx.beginPath(); ctx.arc(fx, fy - sz * 0.5, sz * 0.08, 0, TAU); ctx.fill();
    }
    if (autumn > 0.02 && k > 0.8) {
      ctx.globalAlpha = autumn;
      ctx.fillStyle = '#f3ead8';
      ctx.fillRect(fx - sz * 0.06, fy - sz * 0.4, sz * 0.12, sz * 0.4);
      ctx.fillStyle = '#c8352b';
      ctx.beginPath(); ctx.ellipse(fx, fy - sz * 0.4, sz * 0.3, sz * 0.2, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx - sz * 0.1, fy - sz * 0.5, sz * 0.04, 0, TAU); ctx.arc(fx + sz * 0.12, fy - sz * 0.46, sz * 0.035, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function snowman(ctx: Ctx, sx: number, base: number, size: number, a: number, t: number): void {
  if (a < 0.02) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(sx + size * 0.9, base);
  ctx.fillStyle = 'rgba(80,110,140,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.3, size * 0.05, 0, 0, TAU); ctx.fill();
  const ball = (cy: number, r: number): void => {
    const g = ctx.createRadialGradient(-r * 0.3, cy - r * 0.3, r * 0.1, 0, cy, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d7e4ee');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.fill();
  };
  ball(-size * 0.2, size * 0.22);
  ball(-size * 0.52, size * 0.15);
  ball(-size * 0.76, size * 0.11);
  ctx.fillStyle = '#23262b';
  ctx.beginPath(); ctx.arc(-size * 0.04, -size * 0.79, size * 0.015, 0, TAU); ctx.arc(size * 0.04, -size * 0.79, size * 0.015, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f28b2f';
  ctx.beginPath(); ctx.moveTo(0, -size * 0.75); ctx.lineTo(size * 0.12, -size * 0.73); ctx.lineTo(0, -size * 0.71); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8352b';
  ctx.fillRect(-size * 0.12, -size * 0.67, size * 0.24, size * 0.04);
  ctx.fillRect(size * 0.04, -size * 0.67, size * 0.05, size * 0.14 + Math.sin(t * 2) * size * 0.01);
  ctx.restore();
}

/** A child in the field, dressed for whichever season is nearest. */
function child(ctx: Ctx, cx: number, base: number, size: number, s: number, t: number): void {
  const near = Math.round(wrap4(s)) % 4;
  const coat = ['#6fb7e0', '#f2a35c', '#d9822b', '#c94f4f'][near];
  const bob = Math.abs(Math.sin(t * 2.2)) * size * 0.03;
  ctx.save();
  ctx.translate(cx, base - bob);
  ctx.fillStyle = 'rgba(20,30,20,0.2)';
  ctx.beginPath(); ctx.ellipse(0, bob, size * 0.2, size * 0.03, 0, 0, TAU); ctx.fill();
  // legs: shorts in summer, boots when it is wet or cold
  const skin = '#f2c397';
  ctx.fillStyle = near === 1 ? skin : '#3f5266';
  ctx.fillRect(-size * 0.11, -size * 0.34, size * 0.09, size * 0.32);
  ctx.fillRect(size * 0.02, -size * 0.34, size * 0.09, size * 0.32);
  ctx.fillStyle = near === 1 ? '#3f5266' : '#3f5266';
  if (near === 1) ctx.fillRect(-size * 0.13, -size * 0.36, size * 0.26, size * 0.12);
  ctx.fillStyle = near === 2 || near === 3 ? '#e2b43a' : '#ffffff';
  ctx.fillRect(-size * 0.13, -size * 0.06, size * 0.12, size * 0.06);
  ctx.fillRect(size * 0.01, -size * 0.06, size * 0.12, size * 0.06);
  // body, with arms that wave
  ctx.fillStyle = coat;
  ctx.beginPath(); ctx.roundRect(-size * 0.17, -size * 0.7, size * 0.34, size * 0.4, size * 0.12); ctx.fill();
  ctx.strokeStyle = near === 1 ? skin : coat;
  ctx.lineWidth = size * 0.08; ctx.lineCap = 'round';
  const wave = Math.sin(t * 3) * 0.35;
  ctx.beginPath(); ctx.moveTo(-size * 0.15, -size * 0.62); ctx.lineTo(-size * 0.3, -size * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size * 0.15, -size * 0.62);
  ctx.lineTo(size * 0.15 + Math.cos(-1.1 + wave) * size * 0.22, -size * 0.62 + Math.sin(-1.1 + wave) * size * 0.22); ctx.stroke();
  if (near === 3) {
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(-size * 0.16, -size * 0.72, size * 0.32, size * 0.07);
  }
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -size * 0.84, size * 0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.arc(-size * 0.05, -size * 0.85, size * 0.017, 0, TAU); ctx.arc(size * 0.05, -size * 0.85, size * 0.017, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a4a36'; ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.beginPath(); ctx.arc(0, -size * 0.81, size * 0.05, 0.2, Math.PI - 0.2); ctx.stroke();
  if (near === 3) {
    ctx.fillStyle = '#8a5aa8';
    ctx.beginPath(); ctx.arc(0, -size * 0.88, size * 0.16, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -size * 1.05, size * 0.045, 0, TAU); ctx.fill();
  } else if (near === 1) {
    ctx.fillStyle = '#f7d35a';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.95, size * 0.26, size * 0.05, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -size * 0.96, size * 0.14, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillStyle = '#6b4326';
    ctx.beginPath(); ctx.arc(0, -size * 0.88, size * 0.16, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  }
  if (near === 2) {
    // an umbrella in the autumn rain
    ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath(); ctx.moveTo(-size * 0.3, -size * 0.42); ctx.lineTo(-size * 0.3, -size * 1.15); ctx.stroke();
    ctx.fillStyle = '#2f7fb8';
    ctx.beginPath(); ctx.arc(-size * 0.3, -size * 1.12, size * 0.34, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
}

/** Blossom in spring, leaves in autumn, snow in winter, rain on the autumn wind. */
function falling(ctx: Ctx, x: number, y: number, w: number, h: number, s: number, t: number, u: number): void {
  const spring = weight(s, 0), autumn = weight(s, 2), winter = weight(s, 3);
  if (winter > 0.02) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) {
      const seed = Math.sin(i * 91.7) * 1000;
      const fx = ((seed % 1) + 1) % 1, speed = 0.05 + ((i * 37) % 10) / 100;
      const k = ((t * speed + i / 80) % 1);
      const sx = x + fx * w + Math.sin(t * 0.8 + i) * h * 0.03;
      ctx.globalAlpha = winter * 0.9;
      ctx.beginPath(); ctx.arc(sx, y + k * h, (1 + (i % 3)) * u, 0, TAU); ctx.fill();
    }
  }
  if (autumn > 0.02) {
    for (let i = 0; i < 16; i++) {
      const speed = 0.06 + (i % 5) * 0.012;
      const k = ((t * speed + i / 16) % 1);
      const lx = x + w * (0.12 + ((i * 0.37) % 0.5)) + Math.sin(t * 1.3 + i) * h * 0.06 + k * w * 0.2;
      const ly = y + h * (0.15 + k * 0.85);
      ctx.globalAlpha = autumn * Math.min(1, (1 - k) * 4);
      ctx.fillStyle = AUTUMN[i % 4];
      ctx.beginPath(); ctx.ellipse(lx, ly, h * 0.014, h * 0.008, t * 2 + i, 0, TAU); ctx.fill();
    }
    // a light rain, slanted by the wind
    ctx.strokeStyle = `rgba(200,215,230,${autumn * 0.45})`;
    ctx.lineWidth = Math.max(1, u);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      const k = ((t * 0.9 + i / 40 * 7.3) % 1);
      const rx = x + ((i * 0.618) % 1) * w - k * h * 0.12;
      const ry = y + k * h;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - h * 0.012, ry + h * 0.04); ctx.stroke();
    }
  }
  if (spring > 0.02) {
    for (let i = 0; i < 12; i++) {
      const k = ((t * 0.05 + i / 12) % 1);
      const px = x + w * (0.15 + ((i * 0.41) % 0.4)) + Math.sin(t * 1.7 + i) * h * 0.05 + k * w * 0.25;
      const py = y + h * (0.2 + k * 0.75);
      ctx.globalAlpha = spring * 0.9 * Math.min(1, (1 - k) * 4);
      ctx.fillStyle = i % 2 ? '#f6c3d8' : '#fbe0ea';
      ctx.beginPath(); ctx.ellipse(px, py, h * 0.009, h * 0.006, t * 1.5 + i, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Swallows in spring and summer; they go south for the rest of the year. */
function birds(ctx: Ctx, x: number, y: number, w: number, h: number, s: number, t: number, night: number): void {
  const a = (weight(s, 0) + weight(s, 1)) * (1 - night);
  if (a < 0.02) return;
  ctx.strokeStyle = `rgba(40,50,60,${a * 0.85})`;
  ctx.lineWidth = Math.max(1, h * 0.006);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const span = w * 1.3;
    const bx = x - w * 0.15 + ((t * (22 + i * 5) * h / 300 + i * span / 3) % span);
    const by = y + h * (0.22 + i * 0.05) + Math.sin(t * 1.5 + i) * h * 0.02;
    const flap = Math.sin(t * 9 + i * 2) * h * 0.012;
    const r = h * 0.022;
    ctx.beginPath();
    ctx.moveTo(bx - r, by - flap); ctx.quadraticCurveTo(bx - r * 0.4, by - r * 0.3, bx, by);
    ctx.quadraticCurveTo(bx + r * 0.4, by - r * 0.3, bx + r, by - flap);
    ctx.stroke();
  }
}

/** Where a month (0 = januari, fractions allowed) sits on the continuous season scale. */
export const seasonOfMonthValue = (m: number): number => wrap4((m - 3) / 3);
