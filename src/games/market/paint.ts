/**
 * How the market is painted: the square, the stall, the fruit, the baskets and the customers.
 *
 * Everything a child counts has to be countable at a glance, so each piece of fruit is drawn as
 * itself - an apple with a leaf, a strawberry with seeds - at a size that stays legible on a phone.
 * Around that, a stall with a striped awning and a wooden counter, and a village square behind it,
 * so the counting happens somewhere rather than on a background.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import { blobPath, CachedLayer, contactShadow, Ctx, grainOver, LIGHT, mix, shade } from '../../render/look';
import type { Customer, Fruit } from './model';

// ---------------------------------------------------------------- the square and the stall

const squareLayer = new CachedLayer();
const stallLayer = new CachedLayer();

/**
 * The village behind the stall: roofs, shutters, and a cobbled square, drawn once into a layer,
 * with the bunting strung over the top of it live because it moves in the breeze.
 */
export function paintSquare(ctx: Ctx, w: number, h: number, counterTop: number, t: number, u: number): void {
  const layer = squareLayer.get(w, counterTop, `sq${Math.round(u * 10)}`, (lc, lw, lh) => paintSquareStill(lc, lw, lh, lh, u));
  if (layer) ctx.drawImage(layer, 0, 0);
  paintBunting(ctx, w, t, u);
}

/** The bunting, which moves, so it is drawn every frame over the cached square. */
function paintBunting(ctx: Ctx, w: number, t: number, u: number): void {
  for (let s = 0; s < 2; s++) {
    const y0 = (26 + s * 16) * u;
    const sag = (18 + s * 6) * u;
    ctx.strokeStyle = 'rgba(90,70,50,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10 * u, y0);
    ctx.quadraticCurveTo(w / 2, y0 + sag, w + 10 * u, y0);
    ctx.stroke();
    const flags = Math.max(6, Math.round(w / (34 * u)));
    for (let i = 0; i <= flags; i++) {
      const p = i / flags;
      const fx = -10 * u + p * (w + 20 * u);
      const fy = y0 + Math.sin(p * Math.PI) * sag + Math.sin(t * 1.3 + i) * 1.4 * u;
      ctx.fillStyle = ['#e8705f', '#f3c14a', '#6fb6d8', '#7fbd72'][i % 4];
      ctx.beginPath();
      ctx.moveTo(fx - 7 * u, fy);
      ctx.lineTo(fx + 7 * u, fy);
      ctx.lineTo(fx, fy + 15 * u);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function paintSquareStill(ctx: Ctx, w: number, h: number, counterTop: number, u: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, counterTop);
  sky.addColorStop(0, '#7cc6ef');
  sky.addColorStop(0.45, '#bde3f5');
  sky.addColorStop(1, '#f2e6c8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, counterTop);

  // the square, with houses standing along the far side of it
  const stoneTop = counterTop - 112 * u;
  const rng = makeRng(24);
  let x = -20 * u;
  while (x < w + 20 * u) {
    const bw = (52 + rng() * 54) * u;
    const bh = (78 + rng() * 54) * u;
    const top = stoneTop - bh;
    const wall = ['#efd9bd', '#e7c9a6', '#f3e2c9', '#dcc3a4'][Math.floor(rng() * 4)];
    const wg = ctx.createLinearGradient(x, top, x + bw, top);
    wg.addColorStop(0, shade(wall, 0.08));
    wg.addColorStop(1, shade(wall, -0.14));
    ctx.fillStyle = wg;
    ctx.fillRect(x, top, bw, stoneTop - top + 2);
    const roof = ['#b4614a', '#8c6a4a', '#9c5748', '#7f8f94'][Math.floor(rng() * 4)];
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, top + 2);
    ctx.lineTo(x + bw / 2, top - bh * 0.34);
    ctx.lineTo(x + bw + 6 * u, top + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, top + 2);
    ctx.lineTo(x + bw / 2, top - bh * 0.34);
    ctx.lineTo(x + bw * 0.42, top + 2);
    ctx.closePath();
    ctx.fill();
    // windows with shutters, and a door on the ground floor
    const cols = Math.max(1, Math.round(bw / (34 * u)));
    for (let c = 0; c < cols; c++) {
      const wx = x + (c + 0.5) * (bw / cols) - 7 * u;
      const wy = top + bh * 0.2;
      ctx.fillStyle = 'rgba(64,88,112,0.75)';
      ctx.fillRect(wx, wy, 14 * u, 16 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(wx, wy, 14 * u, 6 * u);
      ctx.fillStyle = ['#7fa8c4', '#a97f6a', '#8fa87f'][Math.floor(rng() * 3)];
      ctx.fillRect(wx - 4 * u, wy, 3.5 * u, 16 * u);
      ctx.fillRect(wx + 14.5 * u, wy, 3.5 * u, 16 * u);
    }
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(x + bw * 0.44, stoneTop - 26 * u, 15 * u, 26 * u);
    x += bw + 4 * u;
  }
  // air between the houses and the stall
  const haze = ctx.createLinearGradient(0, stoneTop - 90 * u, 0, stoneTop + 10 * u);
  haze.addColorStop(0, 'rgba(228, 240, 248, 0.3)');
  haze.addColorStop(1, 'rgba(236, 228, 206, 0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, stoneTop - 90 * u, w, 100 * u);

  // the cobbled square, the stones smaller towards the back
  const cob = ctx.createLinearGradient(0, stoneTop, 0, counterTop);
  cob.addColorStop(0, '#c5b393');
  cob.addColorStop(1, '#ddcdaa');
  ctx.fillStyle = cob;
  ctx.fillRect(0, stoneTop, w, counterTop - stoneTop);
  const crng = makeRng(91);
  const depth = counterTop - stoneTop;
  for (let row = 0; row < 9; row++) {
    const p = row / 8;
    const y = stoneTop + Math.pow(p, 1.4) * depth;
    const sw = (7 + p * 11) * u;
    const off = (row % 2) * sw;
    for (let sx = -sw + off; sx < w + sw * 2; sx += sw * 2.3) {
      const tone = 0.8 + crng() * 0.25;
      ctx.fillStyle = `rgba(${Math.round(176 * tone)}, ${Math.round(160 * tone)}, ${Math.round(132 * tone)}, 0.28)`;
      ctx.beginPath();
      ctx.ellipse(sx, y, sw * 0.85, sw * 0.36, 0, 0, TAU);
      ctx.fill();
    }
  }
  grainOver(ctx, 0, stoneTop, w, counterTop - stoneTop, 0.05);

}

/** The awning over the stall and the counter it stands on. */
export function paintStall(ctx: Ctx, w: number, h: number, counterTop: number, u: number): void {
  const layer = stallLayer.get(w, h, `st${Math.round(counterTop)}:${Math.round(u * 10)}`,
    (lc, lw, lh) => paintStallStill(lc, lw, lh, counterTop, u));
  if (layer) ctx.drawImage(layer, 0, 0);
}

function paintStallStill(ctx: Ctx, w: number, h: number, counterTop: number, u: number): void {
  const ah = 44 * u;
  // the cloth, in stripes, with a scalloped edge
  const stripe = 30 * u;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, ah);
  // scallops along the bottom
  const scallops = Math.max(4, Math.round(w / (stripe * 0.8)));
  for (let i = scallops; i > 0; i--) {
    const x0 = (i / scallops) * w, x1 = ((i - 1) / scallops) * w;
    ctx.quadraticCurveTo((x0 + x1) / 2, ah + 12 * u, x1, ah);
  }
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i * stripe < w; i++) {
    const g = ctx.createLinearGradient(0, 0, 0, ah + 14 * u);
    const base = i % 2 === 0 ? '#e0574a' : '#fff6ea';
    g.addColorStop(0, shade(base, 0.12));
    g.addColorStop(1, shade(base, -0.18));
    ctx.fillStyle = g;
    ctx.fillRect(i * stripe, 0, stripe, ah + 14 * u);
  }
  ctx.restore();
  // the shadow the awning throws on the square
  const sh = ctx.createLinearGradient(0, ah, 0, ah + 34 * u);
  sh.addColorStop(0, 'rgba(40, 30, 20, 0.28)');
  sh.addColorStop(1, 'rgba(40, 30, 20, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, ah, w, 34 * u);

  // the counter
  const front = ctx.createLinearGradient(0, counterTop, 0, h);
  front.addColorStop(0, '#c08f5c');
  front.addColorStop(0.1, '#a9783f');
  front.addColorStop(1, '#8a6033');
  ctx.fillStyle = front;
  ctx.fillRect(0, counterTop, w, h - counterTop);
  // the top edge, catching the light
  const lip = ctx.createLinearGradient(0, counterTop - 9 * u, 0, counterTop + 4 * u);
  lip.addColorStop(0, '#e7c08a');
  lip.addColorStop(1, '#b98b5a');
  ctx.fillStyle = lip;
  ctx.fillRect(0, counterTop - 9 * u, w, 13 * u);
  // planks and grain
  ctx.strokeStyle = 'rgba(70,44,22,0.22)';
  ctx.lineWidth = 1.4;
  const rng = makeRng(17);
  for (let y = counterTop + 18 * u; y < h; y += 26 * u) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    for (let gx = 0; gx < w; gx += 40 * u) {
      ctx.strokeStyle = 'rgba(70,44,22,0.1)';
      ctx.beginPath();
      ctx.moveTo(gx, y + 6 * u + rng() * 6 * u);
      ctx.bezierCurveTo(gx + 14 * u, y + 10 * u, gx + 26 * u, y + 4 * u, gx + 40 * u, y + 9 * u);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,44,22,0.22)';
    }
  }
  grainOver(ctx, 0, counterTop, w, h - counterTop, 0.06);

}

// ---------------------------------------------------------------- fruit

/** One piece of fruit, drawn as itself. The child is counting these, so they have to be clear. */
export function paintFruit(ctx: Ctx, f: Fruit, x: number, y: number, r: number, shadow = true): void {
  ctx.save();
  ctx.translate(x, y);
  if (shadow) contactShadow(ctx, r * 0.12, r * 0.95, r * 0.8, r * 0.28, 0.26);
  const lit = (base: string): CanvasGradient => {
    const g = ctx.createRadialGradient(LIGHT.x * r * 0.5, LIGHT.y * r * 0.5, r * 0.08, 0, 0, r * 1.15);
    g.addColorStop(0, shade(base, 0.42));
    g.addColorStop(0.45, base);
    g.addColorStop(1, shade(base, -0.3));
    return g;
  };
  const gleam = (gx: number, gy: number, gr: number): void => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr, gr * 0.62, -0.6, 0, TAU);
    ctx.fill();
  };

  if (f === 'apple') {
    ctx.fillStyle = lit('#e0503f');
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.bezierCurveTo(r * 1.15, -r * 1.05, r * 1.1, r * 0.75, 0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.1, r * 0.75, -r * 1.15, -r * 1.05, 0, -r * 0.72);
    ctx.fill();
    ctx.strokeStyle = '#6a3b1e';
    ctx.lineWidth = Math.max(1, r * 0.11);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.1, -r * 1.05, r * 0.05, -r * 1.25);
    ctx.stroke();
    ctx.fillStyle = '#5fae5a';
    ctx.beginPath();
    ctx.ellipse(r * 0.42, -r * 1.05, r * 0.36, r * 0.18, -0.5, 0, TAU);
    ctx.fill();
    gleam(-r * 0.36, -r * 0.34, r * 0.28);
  } else if (f === 'pear') {
    ctx.fillStyle = lit('#a8c455');
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.bezierCurveTo(r * 0.62, -r * 0.8, r * 0.5, -r * 0.1, r * 0.72, r * 0.3);
    ctx.bezierCurveTo(r * 0.92, r * 0.95, -r * 0.92, r * 0.95, -r * 0.72, r * 0.3);
    ctx.bezierCurveTo(-r * 0.5, -r * 0.1, -r * 0.62, -r * 0.8, 0, -r * 0.95);
    ctx.fill();
    ctx.strokeStyle = '#6a3b1e';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.lineTo(r * 0.06, -r * 1.25);
    ctx.stroke();
    ctx.fillStyle = '#5fae5a';
    ctx.beginPath();
    ctx.ellipse(r * 0.34, -r * 1.08, r * 0.3, r * 0.15, -0.5, 0, TAU);
    ctx.fill();
    gleam(-r * 0.3, r * 0.2, r * 0.22);
  } else if (f === 'strawberry') {
    ctx.fillStyle = lit('#e0405f');
    ctx.beginPath();
    ctx.moveTo(0, r * 1.05);
    ctx.bezierCurveTo(-r * 0.95, r * 0.4, -r * 0.9, -r * 0.7, 0, -r * 0.7);
    ctx.bezierCurveTo(r * 0.9, -r * 0.7, r * 0.95, r * 0.4, 0, r * 1.05);
    ctx.fill();
    // seeds, which also make it obvious which fruit it is at small sizes
    ctx.fillStyle = 'rgba(255, 234, 168, 0.95)';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const sx = Math.cos(a) * r * 0.42, sy = Math.sin(a) * r * 0.34 + r * 0.06;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 0.08, r * 0.12, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#4e9a4a';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + ((i - 2) / 5) * 2.2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.42, -r * 0.72 + Math.sin(a) * r * 0.16, r * 0.34, r * 0.15, a + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    gleam(-r * 0.3, -r * 0.2, r * 0.2);
  } else if (f === 'plum') {
    ctx.fillStyle = lit('#7a52a8');
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.88, r * 0.98, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,60,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.94);
    ctx.quadraticCurveTo(r * 0.22, 0, 0, r * 0.94);
    ctx.stroke();
    ctx.strokeStyle = '#4e7a3a';
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.95);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.2, r * 0.12, -r * 1.3);
    ctx.stroke();
    // the bloom a plum has on it
    ctx.fillStyle = 'rgba(210, 200, 235, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.3, -0.5, 0, TAU);
    ctx.fill();
    gleam(-r * 0.34, -r * 0.4, r * 0.18);
  } else {
    // a carrot, tapering, with a tuft of green
    ctx.fillStyle = lit('#ef8a34');
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.55);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 0.5, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.2, r * 0.6, 0, r * 1.2);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.6, -r * 0.5, -r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,80,20,0.4)';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.26 - r * 0.06, -r * 0.3 + Math.abs(i) * r * 0.12);
      ctx.lineTo(i * r * 0.2 + r * 0.06, -r * 0.1 + Math.abs(i) * r * 0.12);
      ctx.stroke();
    }
    ctx.fillStyle = '#4e9a4a';
    for (const a of [-0.7, -0.1, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(Math.sin(a) * r * 0.4, -r * 0.95, r * 0.17, r * 0.48, a * 0.6, 0, TAU);
      ctx.fill();
    }
    gleam(-r * 0.16, r * 0.1, r * 0.14);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- baskets and crates

/** A woven basket, open at the top, with a rim you can see the weave in. */
export function paintBasket(ctx: Ctx, r: { x: number; y: number; w: number; h: number }, u: number, active: boolean): void {
  const topY = r.y + 20 * u;
  const botW = r.w * 0.78;
  contactShadow(ctx, r.x + r.w / 2, r.y + r.h + 4 * u, r.w * 0.52, 12 * u, 0.3);
  // the body
  const body = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  body.addColorStop(0, '#c79457');
  body.addColorStop(0.35, '#e3b97c');
  body.addColorStop(1, '#a9773f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(r.x + 4 * u, topY);
  ctx.lineTo(r.x + r.w - 4 * u, topY);
  ctx.lineTo(r.x + r.w / 2 + botW / 2, r.y + r.h);
  ctx.quadraticCurveTo(r.x + r.w / 2, r.y + r.h + 10 * u, r.x + r.w / 2 - botW / 2, r.y + r.h);
  ctx.closePath();
  ctx.fill();
  // the weave
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r.x + 4 * u, topY);
  ctx.lineTo(r.x + r.w - 4 * u, topY);
  ctx.lineTo(r.x + r.w / 2 + botW / 2, r.y + r.h);
  ctx.quadraticCurveTo(r.x + r.w / 2, r.y + r.h + 10 * u, r.x + r.w / 2 - botW / 2, r.y + r.h);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(96,58,24,0.28)';
  ctx.lineWidth = Math.max(1, 1.6 * u);
  for (let y = topY + 9 * u; y < r.y + r.h + 8 * u; y += 11 * u) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.quadraticCurveTo(r.x + r.w / 2, y + 4 * u, r.x + r.w, y);
    ctx.stroke();
  }
  for (let x = r.x + 8 * u; x < r.x + r.w; x += 13 * u) {
    ctx.strokeStyle = 'rgba(96,58,24,0.14)';
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x - (x - (r.x + r.w / 2)) * 0.12, r.y + r.h + 8 * u);
    ctx.stroke();
  }
  // the inside is in shade near the rim
  const inner = ctx.createLinearGradient(0, topY, 0, topY + 40 * u);
  inner.addColorStop(0, 'rgba(60,34,12,0.4)');
  inner.addColorStop(1, 'rgba(60,34,12,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(r.x, topY, r.w, 40 * u);
  ctx.restore();
  // the rim
  const rim = ctx.createLinearGradient(0, r.y + 10 * u, 0, r.y + 26 * u);
  rim.addColorStop(0, '#e8c089');
  rim.addColorStop(1, '#a9773f');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 10 * u, r.w, 16 * u, 8 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(96,58,24,0.3)';
  ctx.lineWidth = Math.max(1, 1.2 * u);
  for (let x = r.x + 6 * u; x < r.x + r.w - 4 * u; x += 12 * u) {
    ctx.beginPath();
    ctx.moveTo(x, r.y + 11 * u);
    ctx.lineTo(x + 6 * u, r.y + 25 * u);
    ctx.stroke();
  }
  if (active) {
    // the basket you are filling glows, rather than being boxed in by a blue rectangle
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 214, 122, 0.95)';
    ctx.shadowColor = 'rgba(255, 190, 80, 0.8)';
    ctx.shadowBlur = 16 * u;
    ctx.lineWidth = 3.6 * u;
    ctx.beginPath();
    ctx.moveTo(r.x + 2 * u, r.y + 18 * u);
    ctx.lineTo(r.x + r.w - 2 * u, r.y + 18 * u);
    ctx.lineTo(r.x + r.w / 2 + r.w * 0.39, r.y + r.h + 2 * u);
    ctx.quadraticCurveTo(r.x + r.w / 2, r.y + r.h + 12 * u, r.x + r.w / 2 - r.w * 0.39, r.y + r.h + 2 * u);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/** A crate of one kind of fruit, with a heap you can see. */
export function paintCrate(ctx: Ctx, x: number, y: number, w: number, h: number, f: Fruit, u: number, pressed: boolean): void {
  const dy = pressed ? 2 * u : 0;
  contactShadow(ctx, x + w / 2, y + h + 2 * u, w * 0.5, 7 * u, 0.3);
  const body = ctx.createLinearGradient(0, y + dy, 0, y + h + dy);
  body.addColorStop(0, '#b2854f');
  body.addColorStop(1, '#8a6033');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y + dy, w, h, 7 * u);
  ctx.fill();
  // slats
  ctx.fillStyle = 'rgba(255,240,214,0.18)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 * u, y + dy + h * 0.42 + i * (h * 0.17), w - 8 * u, h * 0.08);
  ctx.strokeStyle = 'rgba(60,36,14,0.35)';
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.beginPath();
  ctx.roundRect(x, y + dy, w, h, 7 * u);
  ctx.stroke();
  // the heap: fruit sitting proud of the crate
  paintFruit(ctx, f, x + w * 0.33, y + dy + h * 0.3, w * 0.17, false);
  paintFruit(ctx, f, x + w * 0.68, y + dy + h * 0.27, w * 0.17, false);
  paintFruit(ctx, f, x + w * 0.5, y + dy + h * 0.44, w * 0.19, false);
}

/** The brass bell you ring when the basket is right. */
export function paintBell(ctx: Ctx, x: number, y: number, w: number, h: number, u: number, ready: boolean, ring: number): void {
  const dy = ring > 0 ? Math.sin(ring * 40) * 1.6 * u : 0;
  contactShadow(ctx, x + w / 2, y + h + 2 * u, w * 0.46, 6 * u, 0.28);
  const plate = ctx.createLinearGradient(0, y, 0, y + h);
  plate.addColorStop(0, ready ? '#8a6033' : '#8d857a');
  plate.addColorStop(1, ready ? '#6a4520' : '#6f6a63');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12 * u);
  ctx.fill();
  ctx.save();
  ctx.translate(x + w / 2 + dy, y + h * 0.52);
  const dome = ctx.createLinearGradient(-w * 0.3, -h * 0.3, w * 0.3, h * 0.3);
  dome.addColorStop(0, ready ? '#ffe9a0' : '#cfcac2');
  dome.addColorStop(0.5, ready ? '#f0c33b' : '#b3ada4');
  dome.addColorStop(1, ready ? '#b98a1e' : '#8e887f');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.3, Math.PI, 0);
  ctx.lineTo(w * 0.34, h * 0.1);
  ctx.quadraticCurveTo(0, h * 0.2, -w * 0.34, h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ready ? '#8a6218' : '#6f6a63';
  ctx.beginPath();
  ctx.arc(0, h * 0.2, w * 0.07, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, -h * 0.12, w * 0.06, h * 0.1, -0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (ring > 0) {
    ctx.strokeStyle = `rgba(255, 236, 170, ${ring})`;
    ctx.lineWidth = 2.4 * u;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.5, w * (0.35 + i * 0.16 + (1 - ring) * 0.2), -2.4, -0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.5, w * (0.35 + i * 0.16 + (1 - ring) * 0.2), Math.PI + 0.7, Math.PI + 2.4);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- customers

export type Mood = 'waiting' | 'happy' | 'puzzled';

/**
 * A customer: a woodland animal leaning on the counter. They blink, they breathe, and their face
 * says how it is going, which is the only feedback a child who cannot read will get.
 */
export function paintCustomer(ctx: Ctx, who: Customer, x: number, y: number, r: number, t: number, mood: Mood): void {
  const bob = Math.sin(t * 1.4) * r * 0.03;
  const blink = (t * 0.7 + r) % 4.2 < 0.12;
  ctx.save();
  ctx.translate(x, y + bob);
  if (mood === 'happy') ctx.rotate(Math.sin(t * 8) * 0.03);
  contactShadow(ctx, 0, r * 1.75, r * 1.1, r * 0.28, 0.3);

  const fur: Record<Customer, [string, string]> = {
    hedgehog: ['#a5825c', '#6f5335'],
    rabbit: ['#dcd6cf', '#b3aaa0'],
    fox: ['#ef9a4e', '#c96c2a'],
    owl: ['#b98f62', '#8a6640'],
    badger: ['#7e7d85', '#55545c'],
  };
  const [light, dark] = fur[who];
  const coat = (cx: number, cy: number, rr: number): CanvasGradient => {
    const g = ctx.createRadialGradient(cx + LIGHT.x * rr * 0.6, cy + LIGHT.y * rr * 0.6, rr * 0.1, cx, cy, rr * 1.15);
    g.addColorStop(0, shade(light, 0.2));
    g.addColorStop(0.55, light);
    g.addColorStop(1, dark);
    return g;
  };

  // shoulders, so they are a person at a counter and not a head floating in the air
  ctx.fillStyle = coat(0, r * 1.5, r * 1.1);
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, r * 2.1);
  ctx.quadraticCurveTo(-r * 0.95, r * 0.78, 0, r * 0.74);
  ctx.quadraticCurveTo(r * 0.95, r * 0.78, r * 1.05, r * 2.1);
  ctx.closePath();
  ctx.fill();
  // a paw resting on the counter edge
  ctx.fillStyle = shade(light, -0.05);
  ctx.beginPath();
  ctx.ellipse(-r * 0.86, r * 1.95, r * 0.3, r * 0.2, -0.2, 0, TAU);
  ctx.fill();

  const eye = (ex: number, ey: number, er: number): void => {
    if (blink) {
      ctx.strokeStyle = '#20304a';
      ctx.lineWidth = Math.max(1.4, er * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - er, ey);
      ctx.quadraticCurveTo(ex, ey + er * 0.5, ex + er, ey);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, TAU);
    ctx.fill();
    const look = mood === 'puzzled' ? Math.sin(t * 2) * er * 0.3 : 0;
    ctx.fillStyle = '#1e2c40';
    ctx.beginPath();
    ctx.arc(ex + look, ey + er * 0.1, er * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.22, ey - er * 0.3, er * 0.22, 0, TAU);
    ctx.fill();
  };

  if (who === 'hedgehog') {
    // spines first, fanning out behind the face
    ctx.fillStyle = dark;
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI - 0.2 + (i / 12) * (Math.PI + 0.4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a - 0.06) * r * 1.3, Math.sin(a - 0.06) * r * 1.3);
      ctx.lineTo(Math.cos(a + 0.1) * r * 0.72, Math.sin(a + 0.1) * r * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = coat(0, r * 0.1, r * 0.85);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.08, r * 0.82, r * 0.78, 0, 0, TAU);
    ctx.fill();
    // snout
    ctx.fillStyle = shade(light, 0.16);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.34, r * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#20304a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.34, r * 0.11, r * 0.09, 0, 0, TAU);
    ctx.fill();
    eye(-r * 0.3, -r * 0.05, r * 0.14);
    eye(r * 0.3, -r * 0.05, r * 0.14);
  } else if (who === 'rabbit') {
    for (const s of [-1, 1]) {
      const wob = Math.sin(t * 1.6 + (s > 0 ? 0 : 1)) * 0.06;
      ctx.fillStyle = coat(s * r * 0.35, -r * 1.05, r * 0.5);
      ctx.beginPath();
      ctx.ellipse(s * r * 0.36, -r * 1.02, r * 0.23, r * 0.62, s * 0.16 + wob, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f0b8c0';
      ctx.beginPath();
      ctx.ellipse(s * r * 0.36, -r * 0.98, r * 0.1, r * 0.42, s * 0.16 + wob, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = coat(0, 0, r * 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.84, r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f0b8c0';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.11, r * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,50,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.16, r * 0.32);
        ctx.lineTo(s * r * 0.8, r * 0.32 + i * r * 0.16);
        ctx.stroke();
      }
    }
    eye(-r * 0.32, -r * 0.1, r * 0.15);
    eye(r * 0.32, -r * 0.1, r * 0.15);
  } else if (who === 'fox') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(s * r * 0.24, -r * 0.5);
      ctx.lineTo(s * r * 0.8, -r * 1.22);
      ctx.lineTo(s * r * 0.88, -r * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f5c9b0';
      ctx.beginPath();
      ctx.moveTo(s * r * 0.34, -r * 0.5);
      ctx.lineTo(s * r * 0.68, -r * 1.02);
      ctx.lineTo(s * r * 0.74, -r * 0.34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = coat(0, 0, r * 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.84, r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.1);
    ctx.quadraticCurveTo(0, r * 0.95, r * 0.42, r * 0.1);
    ctx.quadraticCurveTo(0, r * 0.3, -r * 0.42, r * 0.1);
    ctx.fill();
    ctx.fillStyle = '#20304a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.11, r * 0.09, 0, 0, TAU);
    ctx.fill();
    eye(-r * 0.34, -r * 0.14, r * 0.14);
    eye(r * 0.34, -r * 0.14, r * 0.14);
  } else if (who === 'owl') {
    ctx.fillStyle = coat(0, 0, r * 0.95);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.86, r * 0.92, 0, 0, TAU);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(s * r * 0.48, -r * 0.66);
      ctx.lineTo(s * r * 0.78, -r * 1.16);
      ctx.lineTo(s * r * 0.2, -r * 0.88);
      ctx.closePath();
      ctx.fill();
    }
    // the feather pattern on the chest
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let row = 0; row < 3; row++) {
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * r * 0.3, r * 0.34 + row * r * 0.2, r * 0.12, Math.PI, 0);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#f7ecd0';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.33, -r * 0.14, r * 0.33, 0, TAU);
      ctx.fill();
    }
    eye(-r * 0.33, -r * 0.14, r * 0.17);
    eye(r * 0.33, -r * 0.14, r * 0.17);
    ctx.fillStyle = '#f0a83b';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.06);
    ctx.lineTo(-r * 0.13, r * 0.36);
    ctx.lineTo(r * 0.13, r * 0.36);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = coat(0, 0, r * 0.95);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.86, r * 0.82, 0, 0, TAU);
    ctx.fill();
    // the badger's stripes
    ctx.fillStyle = '#f7f6f4';
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 0.82);
    ctx.quadraticCurveTo(0, r * 0.2, -r * 0.12, r * 0.8);
    ctx.lineTo(r * 0.12, r * 0.8);
    ctx.quadraticCurveTo(0, r * 0.2, r * 0.18, -r * 0.82);
    ctx.closePath();
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f7f6f4';
      ctx.beginPath();
      ctx.ellipse(s * r * 0.56, -r * 0.24, r * 0.2, r * 0.34, s * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(s * r * 0.62, -r * 0.72, r * 0.17, r * 0.15, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#20304a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.46, r * 0.12, r * 0.1, 0, 0, TAU);
    ctx.fill();
    eye(-r * 0.36, -r * 0.16, r * 0.13);
    eye(r * 0.36, -r * 0.16, r * 0.13);
  }

  // the mouth says how it is going
  ctx.strokeStyle = 'rgba(40,40,56,0.6)';
  ctx.lineWidth = Math.max(1.4, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy') {
    ctx.arc(0, r * 0.52, r * 0.22, 0.25, Math.PI - 0.25);
  } else if (mood === 'puzzled') {
    ctx.moveTo(-r * 0.16, r * 0.66);
    ctx.quadraticCurveTo(0, r * 0.56, r * 0.16, r * 0.66);
  } else {
    ctx.moveTo(-r * 0.14, r * 0.62);
    ctx.lineTo(r * 0.14, r * 0.62);
  }
  ctx.stroke();
  ctx.restore();
}
