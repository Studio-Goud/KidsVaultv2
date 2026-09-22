/**
 * How the dig site is painted.
 *
 * The fossil itself is a photograph of a real specimen, so everything drawn around it has to hold
 * its own against a photograph: badlands under a high sun, a trench cut into the ground with the
 * spoil piled at its edge, and rock over the bone that looks like sediment rather than like a grid
 * of squares. The rock is painted into a small offscreen image and blown up soft, the same trick
 * the valley in Watermolen uses, so taking it off feels like brushing rather than deleting cells.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { blobPath, CachedLayer, contactShadow, Ctx, grainOver, LIGHT, mix, shade } from '../../render/look';

export interface Slab { x: number; y: number; w: number; h: number }

// ---------------------------------------------------------------- the landscape

const landLayer = new CachedLayer();

/**
 * Sky, buttes, and the sand the trench is cut into.
 *
 * None of it moves, and all of it is expensive - two silhouettes built point by point, fourteen
 * full-width wind ripples, and two dozen stones that each want their own gradient. At laptop width
 * that was most of the frame, so it is painted once and kept.
 */
export function paintBadlands(ctx: Ctx, w: number, h: number, horizon: number, t: number, u: number): void {
  const cv = landLayer.get(w, h, `bl${Math.round(horizon)}:${Math.round(u * 10)}`,
    (lc, lw, lh) => paintBadlandsStill(lc, lw, lh, horizon, u));
  if (cv) ctx.drawImage(cv, 0, 0);
}

function paintBadlandsStill(ctx: Ctx, w: number, h: number, horizon: number, u: number): void {
  // the buttes are far away, so they stand low on the skyline and leave the sky to the interface
  const ridge = Math.min(horizon * 0.42, 52 * u);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5aa8e0');
  sky.addColorStop(0.55, '#a8d4ec');
  sky.addColorStop(1, '#f0dfc0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // a high sun, hot enough to be the thing that runs out
  const sx = w * 0.78, sy = horizon * 0.26;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, horizon * 1.1);
  sg.addColorStop(0, 'rgba(255, 246, 206, 0.9)');
  sg.addColorStop(0.16, 'rgba(255, 238, 178, 0.35)');
  sg.addColorStop(1, 'rgba(255, 238, 178, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, horizon);

  // two ranges of buttes, flat topped, the far one washed out by the heat
  const noise = new ValueNoise(41);
  const ranges = [
    { base: horizon - ridge * 0.2, hgt: ridge * 0.78, colour: 'rgba(190, 158, 134, 0.5)', seed: 3 },
    { base: horizon + 2, hgt: ridge, colour: '#b58561', seed: 11 },
  ];
  ranges.forEach((r, ri) => {
    // mesas: a flat top with a scree slope either side, which is what a butte looks like
    const rng = makeRng(r.seed * 97);
    ctx.fillStyle = r.colour;
    ctx.beginPath();
    ctx.moveTo(-10, horizon + 2);
    let x = -20 * u;
    let y = r.base - r.hgt * 0.15;
    ctx.lineTo(x, y);
    while (x < w + 30 * u) {
      const top = r.base - r.hgt * (0.35 + rng() * 0.65);
      const slope = (10 + rng() * 16) * u;
      const flat = (26 + rng() * 70) * u;
      ctx.lineTo(x + slope, top);
      // a slightly uneven top, not a ruler line
      ctx.lineTo(x + slope + flat * 0.5, top + (rng() - 0.5) * r.hgt * 0.06);
      ctx.lineTo(x + slope + flat, top);
      const gap = (14 + rng() * 26) * u;
      const valley = r.base - r.hgt * (0.02 + rng() * 0.16);
      ctx.lineTo(x + slope + flat + slope * 0.8, valley);
      ctx.lineTo(x + slope + flat + slope * 0.8 + gap, valley);
      x += slope * 1.8 + flat + gap;
      y = valley;
    }
    ctx.lineTo(w + 30 * u, horizon + 2);
    ctx.closePath();
    ctx.fill();
    if (ri === 1) {
      // strata banding, and a darker foot where the scree gathers
      ctx.save();
      ctx.clip();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 === 0 ? 'rgba(140, 96, 66, 0.2)' : 'rgba(236, 202, 164, 0.18)';
        ctx.fillRect(0, r.base - r.hgt + k * (r.hgt / 5), w, r.hgt / 10);
      }
      const foot = ctx.createLinearGradient(0, r.base - r.hgt * 0.3, 0, r.base);
      foot.addColorStop(0, 'rgba(120, 84, 56, 0)');
      foot.addColorStop(1, 'rgba(120, 84, 56, 0.45)');
      ctx.fillStyle = foot;
      ctx.fillRect(0, r.base - r.hgt * 0.3, w, r.hgt * 0.3);
      ctx.restore();
    }
  });

  // the ground: sand, with wind ripples and stones lying about
  const sand = ctx.createLinearGradient(0, horizon, 0, h);
  sand.addColorStop(0, '#d9bb8c');
  sand.addColorStop(0.35, '#e7cd9f');
  sand.addColorStop(1, '#cfae7e');
  ctx.fillStyle = sand;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = 'rgba(160, 124, 82, 0.16)';
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 14; k++) {
    const y = horizon + ((k + 0.5) / 14) * (h - horizon);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + k * 1.7) * 3 * u + Math.sin(x * 0.006 + k) * 5 * u);
    }
    ctx.stroke();
  }
  const rng = makeRng(77);
  for (let i = 0; i < 26; i++) {
    const x = rng() * w, y = horizon + rng() * (h - horizon);
    const r = (1.6 + rng() * 5) * u;
    contactShadow(ctx, x + r * 0.2, y + r * 0.4, r * 1.2, r * 0.42, 0.22);
    const pg = ctx.createLinearGradient(x + LIGHT.x * r, y + LIGHT.y * r, x - LIGHT.x * r, y - LIGHT.y * r);
    pg.addColorStop(0, '#d3c3a6');
    pg.addColorStop(1, '#9c8768');
    ctx.fillStyle = pg;
    blobPath(ctx, x, y, r, i * 13 + 3, 0.22, 9);
    ctx.fill();
  }
  grainOver(ctx, 0, horizon, w, h - horizon, 0.05);
}

const trenchLayer = new CachedLayer();

/**
 * The trench the slab sits in: a rim of spoil around a cut into the ground, with the string grid
 * an excavation actually uses pegged across the corners.
 *
 * It carries a wide shadow blur, which the canvas charges for by the pixel every time it is asked,
 * so this too is painted once for a given slab and blitted after that.
 */
export function paintTrench(ctx: Ctx, slab: Slab, u: number): void {
  const pad = 16 * u;
  const bleed = pad * 3;
  const cv = trenchLayer.get(slab.w + bleed * 2, slab.h + bleed * 2,
    `tr${Math.round(slab.w)}x${Math.round(slab.h)}:${Math.round(u * 10)}`,
    (lc, lw, lh) => paintTrenchStill(lc, { x: bleed, y: bleed, w: slab.w, h: slab.h }, u));
  if (cv) ctx.drawImage(cv, slab.x - bleed, slab.y - bleed);
}

function paintTrenchStill(ctx: Ctx, slab: Slab, u: number): void {
  const pad = 16 * u;
  const o = { x: slab.x - pad, y: slab.y - pad, w: slab.w + pad * 2, h: slab.h + pad * 2 };
  // spoil heaped around the cut
  ctx.save();
  ctx.shadowColor = 'rgba(70, 48, 26, 0.35)';
  ctx.shadowBlur = 18 * u;
  ctx.shadowOffsetY = 5 * u;
  const heap = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
  heap.addColorStop(0, '#d9bd91');
  heap.addColorStop(1, '#b2926a');
  ctx.fillStyle = heap;
  ctx.beginPath();
  ctx.roundRect(o.x, o.y, o.w, o.h, 22 * u);
  ctx.fill();
  ctx.restore();
  // the inside wall of the cut, in shade
  const wall = ctx.createLinearGradient(0, slab.y - pad, 0, slab.y + 10 * u);
  wall.addColorStop(0, 'rgba(90, 62, 36, 0.5)');
  wall.addColorStop(1, 'rgba(90, 62, 36, 0)');
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.roundRect(slab.x - 4 * u, slab.y - 4 * u, slab.w + 8 * u, slab.h + 8 * u, 18 * u);
  ctx.fill();

  // pegs at the corners with string between them
  const pegs = [
    { x: slab.x - pad * 0.5, y: slab.y - pad * 0.5 },
    { x: slab.x + slab.w + pad * 0.5, y: slab.y - pad * 0.5 },
    { x: slab.x + slab.w + pad * 0.5, y: slab.y + slab.h + pad * 0.5 },
    { x: slab.x - pad * 0.5, y: slab.y + slab.h + pad * 0.5 },
  ];
  ctx.strokeStyle = 'rgba(255, 252, 240, 0.75)';
  ctx.lineWidth = Math.max(1, 1.6 * u);
  ctx.beginPath();
  pegs.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
  for (const p of pegs) {
    contactShadow(ctx, p.x + 2 * u, p.y + 3 * u, 5 * u, 2.5 * u, 0.3);
    ctx.fillStyle = '#c9762f';
    ctx.beginPath();
    ctx.roundRect(p.x - 2.2 * u, p.y - 7 * u, 4.4 * u, 14 * u, 2 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(p.x - 2.2 * u, p.y - 7 * u, 2 * u, 14 * u);
  }
}

// ---------------------------------------------------------------- the rock over the bone

/**
 * The rock still lying on the specimen.
 *
 * Painted small and scaled up soft, so its edge is a ragged line of sediment instead of a staircase
 * of cells, with grit and hairline cracks over the top and a shadow where it overhangs bare bone.
 */
export class RockPainter {
  private cv = document.createElement('canvas');
  private img: ImageData | null = null;
  /** the finished rock layer at screen size, redrawn only when the rock actually changes */
  private layer = document.createElement('canvas');
  private cols = 0;
  private rows = 0;
  private lw = 0;
  private lh = 0;
  private noise = new ValueNoise(9);
  private dirty = true;

  /** Call when the rock has changed, or when a new site is laid out. */
  touch(): void { this.dirty = true; }

  private fit(cols: number, rows: number): void {
    if (this.cols === cols && this.rows === rows && this.img) return;
    this.cols = cols; this.rows = rows;
    this.cv.width = cols; this.cv.height = rows;
    const c = this.cv.getContext('2d');
    if (c) this.img = c.createImageData(cols, rows);
    this.dirty = true;
  }

  paint(ctx: Ctx, slab: Slab, cols: number, rows: number, depth: Uint8Array, hard: Float32Array, maxDepth: number, cell: number): void {
    this.fit(cols, rows);
    const w = Math.max(1, Math.round(cols * cell));
    const h = Math.max(1, Math.round(rows * cell));
    if (this.lw !== w || this.lh !== h) {
      this.layer.width = w; this.layer.height = h;
      this.lw = w; this.lh = h;
      this.dirty = true;
    }
    if (this.dirty) this.render(cols, rows, depth, hard, maxDepth, cell);
    ctx.drawImage(this.layer, slab.x, slab.y);
  }

  /**
   * Redraw the rock layer. This is the expensive part - an image the size of the slab, a blur and
   * a few hundred grains of grit - so it happens when a stroke changes something, not every frame.
   */
  private render(cols: number, rows: number, depth: Uint8Array, hard: Float32Array, maxDepth: number, cell: number): void {
    const img = this.img;
    const src = this.cv.getContext('2d');
    const out = this.layer.getContext('2d');
    if (!img || !src || !out) return;
    const d = img.data;
    for (let i = 0; i < depth.length; i++) {
      const o = i * 4;
      const dep = depth[i];
      if (dep === 0) { d[o + 3] = 0; continue; }
      const gx = i % cols, gy = (i / cols) | 0;
      const hrd = hard[i];
      const warm = 1 - hrd;
      const n = this.noise.fbm2(gx * 0.5, gy * 0.5, 3);
      const base = 118 + warm * 66 + n * 26;
      d[o] = clamp(base * (0.9 + warm * 0.2), 0, 255);
      d[o + 1] = clamp(base * (0.82 + warm * 0.18), 0, 255);
      d[o + 2] = clamp(base * (0.68 + warm * 0.16), 0, 255);
      d[o + 3] = dep >= maxDepth ? 255 : 208;
    }
    src.putImageData(img, 0, 0);

    out.clearRect(0, 0, this.lw, this.lh);
    out.save();
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = 'high';
    out.filter = `blur(${(cell * 0.16).toFixed(2)}px)`;
    out.drawImage(this.cv, 0, 0, this.lw, this.lh);
    out.restore();

    // grit, scattered rather than laid out: a regular dot per cell reads as a polka dot pattern
    const rng = makeRng(31);
    out.save();
    const grains = Math.round(cols * rows * 0.5);
    for (let k = 0; k < grains; k++) {
      const gx = Math.floor(rng() * cols), gy = Math.floor(rng() * rows);
      const i = gy * cols + gx;
      if (!depth[i]) continue;
      const x = (gx + rng()) * cell, y = (gy + rng()) * cell;
      const hrd = hard[i];
      out.fillStyle = rng() > 0.55
        ? `rgba(74, 58, 40, ${0.06 + hrd * 0.14})`
        : `rgba(255, 244, 222, ${0.05 + (1 - hrd) * 0.1})`;
      out.beginPath();
      out.ellipse(x, y, cell * (0.06 + rng() * 0.18), cell * (0.05 + rng() * 0.14), rng() * 3, 0, TAU);
      out.fill();
    }
    // a few hairline cracks where the rock is hardest
    out.strokeStyle = 'rgba(60, 44, 28, 0.2)';
    out.lineWidth = Math.max(0.6, cell * 0.07);
    for (let k = 0; k < 14; k++) {
      const gx = Math.floor(rng() * cols), gy = Math.floor(rng() * rows);
      const i = gy * cols + gx;
      if (!depth[i] || hard[i] < 0.55) continue;
      out.beginPath();
      out.moveTo(gx * cell, gy * cell);
      out.lineTo(gx * cell + (rng() - 0.5) * cell * 6, gy * cell + (rng() - 0.5) * cell * 6);
      out.stroke();
    }
    out.restore();
    this.dirty = false;
  }
}

// ---------------------------------------------------------------- tools

/** A tool drawn as the object it is: a wooden handle, a metal end, and a shadow under it. */
export function paintTool(ctx: Ctx, id: string, x: number, y: number, r: number, bright: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  const wood = bright ? '#e8c894' : '#b08a58';
  const steel = bright ? '#eef2f6' : '#9aa3ad';
  const handle = (len: number, wdt: number): void => {
    const g = ctx.createLinearGradient(-wdt, 0, wdt, 0);
    g.addColorStop(0, shade(wood, 0.18));
    g.addColorStop(1, shade(wood, -0.24));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-wdt, 0, wdt * 2, len, wdt);
    ctx.fill();
  };
  if (id === 'brush') {
    handle(r * 1.5, r * 0.2);
    // the ferrule
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.roundRect(-r * 0.26, -r * 0.45, r * 0.52, r * 0.5, r * 0.1);
    ctx.fill();
    // bristles
    ctx.strokeStyle = bright ? '#f0dcb4' : '#c9a86e';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.07, -r * 0.44);
      ctx.lineTo(i * r * 0.16, -r * 1.05);
      ctx.stroke();
    }
  } else if (id === 'chisel') {
    handle(r * 1.2, r * 0.22);
    const g = ctx.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
    g.addColorStop(0, shade(steel, 0.25));
    g.addColorStop(1, shade(steel, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, 0);
    ctx.lineTo(r * 0.2, 0);
    ctx.lineTo(r * 0.14, -r * 0.85);
    ctx.lineTo(0, -r * 1.1);
    ctx.lineTo(-r * 0.14, -r * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'hammer') {
    handle(r * 1.4, r * 0.2);
    const g = ctx.createLinearGradient(0, -r * 1.1, 0, -r * 0.5);
    g.addColorStop(0, shade(steel, 0.2));
    g.addColorStop(1, shade(steel, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-r * 0.82, -r * 1.12, r * 1.64, r * 0.62, r * 0.14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(-r * 0.78, -r * 1.08, r * 1.56, r * 0.18, r * 0.08);
    ctx.fill();
  } else {
    // an air scribe: a pen with a hose and a puff of air at the tip
    handle(r * 1.2, r * 0.24);
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.lineTo(r * 0.22, 0);
    ctx.lineTo(r * 0.06, -r * 1.15);
    ctx.lineTo(-r * 0.06, -r * 1.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = bright ? 'rgba(255,255,255,0.7)' : 'rgba(90,110,130,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(0, -r * 1.2, r * (0.18 + i * 0.16), -2.4, -0.75);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The daylight dial: a sun that sinks and reddens as the light goes. */
export function paintSunDial(ctx: Ctx, x: number, y: number, r: number, left: number, u: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(70,48,26,0.3)';
  ctx.shadowBlur = 10 * u;
  ctx.shadowOffsetY = 2 * u;
  ctx.fillStyle = 'rgba(255, 252, 244, 0.92)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the sky inside the dial goes from noon blue to a low red
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 2.5 * u, 0, TAU);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y - r, 0, y + r);
  sky.addColorStop(0, mix('#7cc6ef', '#e98a4e', 1 - left));
  sky.addColorStop(1, mix('#dff0fa', '#3c2a4a', 1 - left));
  ctx.fillStyle = sky;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // the sun itself, crossing from top to horizon
  const a = Math.PI + clamp(1 - left, 0, 1) * Math.PI;
  const sx = x + Math.cos(a) * r * 0.62, sy = y + Math.sin(a) * r * 0.62;
  ctx.fillStyle = mix('#fff0b8', '#ef7f4a', 1 - left);
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.26, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(80, 56, 32, 0.55)';
  ctx.fillRect(x - r, y + r * 0.62, r * 2, r);
  ctx.restore();
  ctx.strokeStyle = left < 0.25 ? '#d1603f' : 'rgba(74,56,35,0.35)';
  ctx.lineWidth = 2.5 * u;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.2 * u, 0, TAU);
  ctx.stroke();
}

/** How much of the specimen is out of the rock, as a little fossil filling up. */
export function paintExposedDial(ctx: Ctx, x: number, y: number, r: number, exposed: number, u: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(70,48,26,0.3)';
  ctx.shadowBlur = 10 * u;
  ctx.shadowOffsetY = 2 * u;
  ctx.fillStyle = 'rgba(255, 252, 244, 0.92)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  // a bone, filled from the bottom up as it comes clear
  const bone = (fill: string, clipTo: number): void => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - r, y + r - clipTo * r * 2, r * 2, clipTo * r * 2);
    ctx.clip();
    ctx.fillStyle = fill;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.roundRect(-r * 0.45, -r * 0.16, r * 0.9, r * 0.32, r * 0.16);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.5, -r * 0.16, r * 0.19, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * r * 0.5, r * 0.16, r * 0.19, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  };
  bone('rgba(74,56,35,0.2)', 1);
  bone('#e8ddc4', clamp(exposed, 0, 1));
  ctx.strokeStyle = 'rgba(74,56,35,0.35)';
  ctx.lineWidth = 2.5 * u;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.2 * u, 0, TAU);
  ctx.stroke();
}
