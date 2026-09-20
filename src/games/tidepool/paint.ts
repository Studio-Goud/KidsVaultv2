/**
 * How the shore and its creatures are painted.
 *
 * The game is about what you notice, so everything a child has to notice has to be drawn properly:
 * a crab that is plainly a crab, a jellyfish you can see through, spots that count themselves. The
 * shore around them is built from the same light as the rest of Bramblewood - sun from the top
 * left, a shadow under everything, and no flat fill anywhere.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import { blobPath, CachedLayer, contactShadow, Ctx, grainOver, LIGHT, mix, shade } from '../../render/look';
import { COLOUR_HEX, type Colour, type Kind } from './model';

export interface Field { x: number; y: number; w: number; h: number }

interface Scatter { x: number; y: number; r: number; a: number; kind: 'pebble' | 'shell' | 'weed' | 'grain'; tone: number }

export class ShoreArt {
  private scatter: Scatter[] = [];
  private seed: number;
  /** the beach and what is lying on it never move, so they are drawn once */
  private sandLayer = new CachedLayer();

  constructor(seed = 3) {
    this.seed = seed;
    const rng = makeRng(seed * 613 + 11);
    for (let i = 0; i < 90; i++) {
      const r = rng();
      this.scatter.push({
        x: rng(), y: rng(), r: 0.2 + rng() * 0.8, a: rng() * TAU,
        kind: r > 0.94 ? 'weed' : r > 0.84 ? 'shell' : r > 0.6 ? 'pebble' : 'grain',
        tone: rng(),
      });
    }
  }

  /** Open water: a swell that moves, light dancing on the bottom, and glints on the surface. */
  paintSea(ctx: Ctx, f: Field, shoreY: number, t: number): void {
    const g = ctx.createLinearGradient(0, f.y, 0, shoreY);
    g.addColorStop(0, '#1064a6');
    g.addColorStop(0.45, '#2b90cf');
    g.addColorStop(1, '#69c9e6');
    ctx.fillStyle = g;
    ctx.fillRect(f.x, f.y, f.w, shoreY - f.y);

    // caustics: overlapping bright bands, the way light knots on a sandy bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, shoreY - f.y);
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    for (let k = 0; k < 5; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.3 - k * 0.04})`;
      ctx.lineWidth = (2 + k) * 1.1;
      ctx.beginPath();
      for (let x = 0; x <= f.w; x += 10) {
        const y = f.y + ((k + 0.5) / 5) * (shoreY - f.y)
          + Math.sin(x * 0.02 + t * (0.7 + k * 0.2)) * 14
          + Math.sin(x * 0.055 + t * 1.4 + k) * 7;
        if (x === 0) ctx.moveTo(f.x + x, y); else ctx.lineTo(f.x + x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // the swell, rolling towards the shore
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    for (let k = 0; k < 6; k++) {
      const p = ((t * 0.07 + k / 6) % 1);
      const y = f.y + p * (shoreY - f.y);
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.7;
      ctx.lineWidth = 1 + p * 2.4;
      ctx.beginPath();
      for (let x = 0; x <= f.w; x += 12) {
        ctx.lineTo(f.x + x, y + Math.sin(x * 0.03 + t * 1.6 + k) * (2 + p * 4));
      }
      ctx.stroke();
    }
    ctx.restore();

    // shafts of sunlight coming down through the water
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, shoreY - f.y);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const bx = f.x + f.w * (0.12 + i * 0.26) + Math.sin(t * 0.25 + i) * f.w * 0.04;
      const rg = ctx.createLinearGradient(bx, f.y, bx + f.w * 0.1, shoreY);
      rg.addColorStop(0, 'rgba(255,255,255,0.1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(bx - f.w * 0.025, f.y);
      ctx.lineTo(bx + f.w * 0.025, f.y);
      ctx.lineTo(bx + f.w * 0.115, shoreY);
      ctx.lineTo(bx + f.w * 0.055, shoreY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // weed rooted on the bottom, leaning with the swell, and a school of little fish going by
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, shoreY - f.y);
    ctx.clip();
    const wrng = makeRng(this.seed * 401 + 7);
    for (let i = 0; i < 7; i++) {
      const x = f.x + wrng() * f.w;
      const base = shoreY - wrng() * (shoreY - f.y) * 0.16;
      const hgt = (shoreY - f.y) * (0.1 + wrng() * 0.14);
      const blades = 3 + Math.floor(wrng() * 3);
      for (let b = 0; b < blades; b++) {
        const lean = (b - (blades - 1) / 2) * 0.5;
        const sway = Math.sin(t * 0.8 + i + b * 0.6) * hgt * 0.16;
        const w0 = hgt * 0.07;
        const tipX = x + lean * hgt * 0.32 + sway;
        const tipY = base - hgt * (0.7 + wrng() * 0.5);
        const gg = ctx.createLinearGradient(x, base, tipX, tipY);
        gg.addColorStop(0, 'rgba(22, 74, 62, 0.55)');
        gg.addColorStop(1, 'rgba(58, 126, 96, 0.35)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.moveTo(x - w0, base);
        ctx.quadraticCurveTo(x + lean * hgt * 0.12 - w0 * 0.6, base - hgt * 0.5, tipX, tipY);
        ctx.quadraticCurveTo(x + lean * hgt * 0.12 + w0 * 0.6, base - hgt * 0.5, x + w0, base);
        ctx.closePath();
        ctx.fill();
      }
    }
    const school = ((t * 0.045) % 1.4) - 0.2;
    ctx.fillStyle = 'rgba(12, 58, 96, 0.3)';
    for (let i = 0; i < 7; i++) {
      const fx = f.x + (school + (i % 4) * 0.035) * f.w;
      const fy = f.y + (shoreY - f.y) * (0.3 + Math.floor(i / 4) * 0.08) + Math.sin(t * 2 + i) * 5;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 7, 3, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx + 6, fy);
      ctx.lineTo(fx + 11, fy - 3.4);
      ctx.lineTo(fx + 11, fy + 3.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // glints
    const rng = makeRng(this.seed * 77);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 26; i++) {
      const gx = f.x + rng() * f.w, gy = f.y + rng() * (shoreY - f.y);
      const ph = (t * 0.8 + rng() * 6) % 3;
      if (ph > 0.7) continue;
      ctx.globalAlpha = Math.sin((ph / 0.7) * Math.PI) * 0.6;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 7 + rng() * 6, 1.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Where the water gives out: wet sand that still shines, then dry sand with things lying on it. */
  paintSand(ctx: Ctx, f: Field, shoreY: number, t: number): void {
    const bottom = f.y + f.h;
    const bandH = Math.max(1, bottom - shoreY + 2);
    // the beach itself, with its pebbles, shells and weed: drawn once and kept
    const layer = this.sandLayer.get(f.w, bandH, 'sand', (lc, lw, lh) => this.paintBeach(lc, lw, lh));
    if (layer) ctx.drawImage(layer, f.x, shoreY - 2);

    // the wave that has just run up the beach, and the foam it leaves, which do move
    const reach = 26 + Math.sin(t * 0.7) * 10;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(f.x, shoreY - 2);
    for (let x = 0; x <= f.w; x += 8) {
      ctx.lineTo(f.x + x, shoreY + reach * 0.5 + Math.sin(x * 0.022 + t * 0.9) * reach * 0.42);
    }
    ctx.lineTo(f.x + f.w, shoreY - 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 190, 215, 0.35)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x <= f.w; x += 8) {
      const y = shoreY + reach * 0.5 + Math.sin(x * 0.022 + t * 0.9) * reach * 0.42;
      if (x === 0) ctx.moveTo(f.x + x, y); else ctx.lineTo(f.x + x, y);
    }
    ctx.stroke();
    const rng = makeRng(this.seed * 31 + 5);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 24; i++) {
      const x = rng() * f.w;
      const y = shoreY + reach * 0.5 + Math.sin(x * 0.022 + t * 0.9) * reach * 0.42 + (rng() - 0.5) * 9;
      ctx.beginPath();
      ctx.arc(f.x + x, y, 1 + rng() * 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The beach as it lies: sand, pebbles, shells and weed. Drawn into the cached layer. */
  private paintBeach(ctx: Ctx, w: number, h: number): void {
    const sand = ctx.createLinearGradient(0, 0, 0, h);
    sand.addColorStop(0, '#c4a877');
    sand.addColorStop(0.18, '#e6cf9d');
    sand.addColorStop(1, '#f3e3bd');
    ctx.fillStyle = sand;
    ctx.fillRect(0, 0, w, h);
    for (const s of this.scatter) {
      const x = s.x * w;
      const y = 28 + s.y * (h - 34);
      if (y > h - 4) continue;
      if (s.kind === 'grain') {
        ctx.fillStyle = s.tone > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(140,110,70,0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + s.r, 0, TAU);
        ctx.fill();
      } else if (s.kind === 'pebble') {
        const r = 2.5 + s.r * 4;
        contactShadow(ctx, x + 1, y + r * 0.45, r * 1.2, r * 0.5, 0.2);
        const pg = ctx.createLinearGradient(x + LIGHT.x * r, y + LIGHT.y * r, x - LIGHT.x * r, y - LIGHT.y * r);
        pg.addColorStop(0, s.tone > 0.5 ? '#cfc6b6' : '#b9ad9a');
        pg.addColorStop(1, s.tone > 0.5 ? '#8e8577' : '#7d7264');
        ctx.fillStyle = pg;
        blobPath(ctx, x, y, r, s.a * 100, 0.2, 9);
        ctx.fill();
      } else if (s.kind === 'shell') {
        const r = 3 + s.r * 4;
        contactShadow(ctx, x + 1, y + r * 0.4, r * 1.1, r * 0.45, 0.18);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.a);
        ctx.fillStyle = s.tone > 0.5 ? '#f6e6d0' : '#efd2c6';
        ctx.beginPath();
        ctx.moveTo(0, r * 0.7);
        for (let i = 0; i <= 6; i++) {
          const a = Math.PI + (i / 6) * Math.PI;
          ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.9 : 1), Math.sin(a) * r * 0.85 + r * 0.1);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,120,100,0.5)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      } else {
        const r = 6 + s.r * 10;
        ctx.strokeStyle = 'rgba(78, 120, 74, 0.75)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + b * r * 0.5, y - r * 0.6, x + b * r * 0.8, y - r);
          ctx.stroke();
        }
      }
    }
    grainOver(ctx, 0, 0, w, h, 0.05);
  }

  /**
   * A pool: a basin in the rock with water standing in it. The rim is stone, lit from the top
   * left; the water inside is darker at the edge and catches the sky in the middle.
   */
  paintPool(ctx: Ctx, r: { x: number; y: number; w: number; h: number }, t: number, index: number, glow: number): void {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const rx = r.w / 2, ry = r.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);

    // the stone rim
    contactShadow(ctx, cx, cy + rx * 0.2, rx * 1.2, rx * 1.1, 0.3);
    const rim = ctx.createLinearGradient(cx + LIGHT.x * rx, cy + LIGHT.y * rx, cx - LIGHT.x * rx, cy - LIGHT.y * rx);
    rim.addColorStop(0, '#e2d2b2');
    rim.addColorStop(0.45, '#bda88a');
    rim.addColorStop(1, '#8d7a63');
    ctx.fillStyle = rim;
    blobPath(ctx, cx, cy, rx, index * 37 + 9, 0.14, 13);
    ctx.fill();
    // damp stone right at the waterline
    ctx.fillStyle = 'rgba(96, 78, 56, 0.35)';
    blobPath(ctx, cx, cy, rx * 0.92, index * 37 + 15, 0.13, 13);
    ctx.fill();

    // the water in it
    const wr = rx * 0.86;
    const wg = ctx.createRadialGradient(cx + LIGHT.x * wr * 0.4, cy + LIGHT.y * wr * 0.4, wr * 0.1, cx, cy, wr);
    wg.addColorStop(0, '#a8ecfa');
    wg.addColorStop(0.55, '#54bce4');
    wg.addColorStop(1, '#2585bb');
    ctx.fillStyle = wg;
    blobPath(ctx, cx, cy, wr, index * 37 + 21, 0.12, 13);
    ctx.fill();

    // ripples inside the pool
    ctx.save();
    blobPath(ctx, cx, cy, wr, index * 37 + 21, 0.12, 13);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 3; k++) {
      const p = ((t * 0.35 + k / 3 + index * 0.2) % 1);
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, wr * (0.15 + p * 0.85), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // a sliver of sky on the surface
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx - wr * 0.3, cy - wr * 0.42, wr * 0.42, wr * 0.16, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    if (glow > 0.01) {
      // the pool lights up when something lands in it correctly
      ctx.save();
      ctx.globalAlpha = glow * 0.8;
      ctx.strokeStyle = '#a8f5c8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * (1 + (1 - glow) * 0.2), ry * (1 + (1 - glow) * 0.2), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The board that says what the pools mean today, hanging on two ropes over the water. */
  paintSign(ctx: Ctx, x: number, y: number, w: number, h: number, flash: number, swing = 0): void {
    ctx.save();
    // the ropes it hangs from
    ctx.strokeStyle = '#b98a52';
    ctx.lineWidth = Math.max(2, h * 0.055);
    ctx.lineCap = 'round';
    for (const px of [x + w * 0.16, x + w * 0.84]) {
      ctx.beginPath();
      ctx.moveTo(px - swing * 12, -10);
      ctx.lineTo(px, y + h * 0.16);
      ctx.stroke();
    }
    // the board
    ctx.shadowColor = 'rgba(12,40,60,0.3)';
    ctx.shadowBlur = h * 0.35;
    ctx.shadowOffsetY = h * 0.1;
    const wood = ctx.createLinearGradient(0, y, 0, y + h);
    wood.addColorStop(0, flash > 0 ? mix('#f7e9c8', '#ffd27a', flash) : '#f7e9c8');
    wood.addColorStop(1, flash > 0 ? mix('#e2cda2', '#f3b45c', flash) : '#e2cda2');
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.22);
    ctx.fill();
    ctx.restore();
    // plank lines and a peg in each corner
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.22);
    ctx.clip();
    ctx.strokeStyle = 'rgba(150,110,60,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(120,84,44,0.5)';
    for (const px of [x + w * 0.05, x + w * 0.95]) {
      for (const py of [y + h * 0.22, y + h * 0.78]) {
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, h * 0.045), 0, TAU);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- the creatures

/**
 * One creature, drawn as an animal rather than a symbol: a body with light on it, an outline that
 * holds it together against the water, eyes that look somewhere, and limbs that move.
 */
export function paintCreature(
  ctx: Ctx, kind: Kind, x: number, y: number, r: number, colour: Colour, spots: number,
  t: number, held: boolean, alive = true,
): void {
  const fill = COLOUR_HEX[colour];
  const dark = shade(fill, -0.34);
  const light = shade(fill, 0.3);
  const wig = alive ? Math.sin(t * 3) : 0;
  const squash = held ? 1 + Math.sin(t * 9) * 0.04 : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, 1 / squash);
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.strokeStyle = dark;
  ctx.lineJoin = 'round';

  const body = (): CanvasGradient => {
    const g = ctx.createLinearGradient(LIGHT.x * r, LIGHT.y * r, -LIGHT.x * r, -LIGHT.y * r);
    g.addColorStop(0, light);
    g.addColorStop(0.55, fill);
    g.addColorStop(1, shade(fill, -0.16));
    return g;
  };
  const eye = (ex: number, ey: number, er: number): void => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,32,48,0.35)';
    ctx.lineWidth = Math.max(0.8, r * 0.04);
    ctx.stroke();
    ctx.fillStyle = '#1a2a3d';
    ctx.beginPath();
    ctx.arc(ex + er * 0.18, ey + er * 0.12, er * 0.52, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.2, ey - er * 0.3, er * 0.24, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1.2, r * 0.09);
  };

  if (kind === 'crab') {
    // legs first, so they sit behind the shell
    ctx.strokeStyle = shade(fill, -0.2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, r * 0.12);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = 0.3 + i * 0.42;
        const kick = Math.sin(t * 4 + i * 1.3 + (side > 0 ? 0 : 1.6)) * 0.16 * (alive ? 1 : 0);
        const jx = side * Math.cos(a) * r * 0.95, jy = Math.sin(a + kick) * r * 0.6;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.5, r * 0.1);
        ctx.quadraticCurveTo(jx, jy, side * Math.cos(a - 0.2) * r * 1.5, Math.sin(a + kick) * r * 1.05 + r * 0.15);
        ctx.stroke();
      }
    }
    // claws
    for (const side of [-1, 1]) {
      const open = 0.16 + (alive ? Math.abs(Math.sin(t * 2 + (side > 0 ? 0 : 1))) * 0.3 : 0.2);
      ctx.save();
      ctx.translate(side * r * 1.08, -r * 0.5 + wig * r * 0.06 * side);
      ctx.rotate(side * -0.5);
      ctx.fillStyle = body();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.4, r * 0.3, 0, open, TAU - open);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.4, r * 0.3, 0, -open, open);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // the shell
    ctx.fillStyle = body();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.76, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // a band of lighter shell across the top
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.76, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.4, r * 0.62, r * 0.26, -0.24, 0, TAU);
    ctx.fill();
    ctx.restore();
    // eyes on short stalks
    for (const side of [-1, 1]) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, -r * 0.5);
      ctx.lineTo(side * r * 0.34, -r * 0.82);
      ctx.stroke();
      eye(side * r * 0.34, -r * 0.9, r * 0.17);
    }
  } else if (kind === 'fish') {
    // tail
    ctx.fillStyle = shade(fill, -0.1);
    ctx.save();
    ctx.translate(r * 0.9, 0);
    ctx.rotate(wig * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.55, r * 0.72, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.5, 0, r * 0.72, r * 0.6);
    ctx.quadraticCurveTo(r * 0.4, r * 0.55, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // fins
    ctx.fillStyle = shade(fill, 0.12);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.1, -r * 1.05 - wig * r * 0.06, r * 0.45, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // body
    ctx.fillStyle = body();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.66, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // belly
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.66, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.85, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // gill and eye
    ctx.strokeStyle = shade(fill, -0.26);
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(-r * 0.32, 0, r * 0.4, -1, 1);
    ctx.stroke();
    eye(-r * 0.6, -r * 0.14, r * 0.17);
  } else if (kind === 'star') {
    ctx.fillStyle = body();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2 + wig * 0.05;
      const na = ((i + 0.5) / 5) * TAU - Math.PI / 2 + wig * 0.05;
      const tip = r * (1.16 + Math.sin(t * 2 + i) * (alive ? 0.03 : 0));
      const px = Math.cos(a) * tip, py = Math.sin(a) * tip;
      const mx = Math.cos(na) * r * 0.42, my = Math.sin(na) * r * 0.42;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(Math.cos(a - 0.35) * r * 0.85, Math.sin(a - 0.35) * r * 0.85, px, py);
      ctx.quadraticCurveTo(mx * 1.05, my * 1.05, Math.cos(na + 0.35) * r * 0.85, Math.sin(na + 0.35) * r * 0.85);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the bumpy skin a starfish has
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * (0.28 * k), Math.sin(a) * r * (0.28 * k), r * 0.07, 0, TAU);
        ctx.fill();
      }
    }
  } else if (kind === 'jelly') {
    // a bell you can see through, so it needs its own softer fill
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = body();
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.12);
    ctx.quadraticCurveTo(-r * 1.02, -r * 0.95, 0, -r * 0.95);
    ctx.quadraticCurveTo(r * 1.02, -r * 0.95, r, r * 0.12);
    // a frilled skirt
    for (let i = 0; i < 4; i++) {
      const x0 = r - (i + 0.5) * (r / 2);
      ctx.quadraticCurveTo(x0 + r * 0.12, r * 0.3, x0 - r * 0.12, r * 0.1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    // the light inside
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ig = ctx.createRadialGradient(-r * 0.2, -r * 0.4, 0, 0, -r * 0.2, r);
    ig.addColorStop(0, 'rgba(255,255,255,0.55)');
    ig.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.9, r * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // tentacles
    ctx.strokeStyle = shade(fill, -0.12);
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const sway = Math.sin(t * 2.2 + i * 0.8) * r * 0.24 * (alive ? 1 : 0.3);
      ctx.beginPath();
      ctx.moveTo(i * r * 0.34, r * 0.12);
      ctx.quadraticCurveTo(i * r * 0.34 + sway, r * 0.6, i * r * 0.34 + sway * 1.6, r * 1.15);
      ctx.stroke();
    }
    eye(-r * 0.26, -r * 0.42, r * 0.13);
    eye(r * 0.26, -r * 0.42, r * 0.13);
  } else {
    // a scallop shell, ribbed and hinged at the bottom
    ctx.fillStyle = body();
    ctx.beginPath();
    ctx.moveTo(0, r * 0.82);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const rr = r * (i % 2 === 0 ? 1.06 : 0.94);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.92 + r * 0.14);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shade(fill, -0.22);
    ctx.lineWidth = Math.max(0.9, r * 0.06);
    for (let i = 1; i < 10; i += 1) {
      const a = Math.PI + (i / 10) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.78);
      ctx.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.86 + r * 0.14);
      ctx.stroke();
    }
    // the hinge
    ctx.fillStyle = shade(fill, -0.3);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.8, r * 0.22, r * 0.12, 0, 0, TAU);
    ctx.fill();
  }

  // spots, laid out so they count themselves at a glance
  if (spots > 0) {
    const pos = spots === 1 ? [[0, 0.02]] : spots === 2 ? [[-0.34, 0.02], [0.34, 0.02]] : [[-0.36, 0.2], [0.36, 0.2], [0, -0.3]];
    // a fish wears its spots behind the eye, a jellyfish high on the bell: never over a face
    const shiftX = kind === 'fish' ? 0.34 : 0;
    const shiftY = kind === 'jelly' ? -0.34 : kind === 'crab' ? 0.08 : 0;
    for (const [dx, dy] of pos) {
      const sx = (dx * (kind === 'fish' ? 0.7 : 1) + shiftX) * r;
      const sy = (dy * (kind === 'jelly' ? 0.5 : 1) + shiftY) * r;
      ctx.fillStyle = 'rgba(16,30,46,0.18)';
      ctx.beginPath();
      ctx.arc(sx, sy + r * 0.03, r * 0.19, 0, TAU);
      ctx.fill();
      const sg = ctx.createRadialGradient(sx - r * 0.06, sy - r * 0.07, 0, sx, sy, r * 0.19);
      sg.addColorStop(0, '#ffffff');
      sg.addColorStop(1, '#e8eef2');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.18, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The shadow a creature casts on the water it is floating over. */
export function creatureShadow(ctx: Ctx, x: number, y: number, r: number, lift: number): void {
  contactShadow(ctx, x + r * 0.16 + lift * 0.4, y + r * 0.5 + lift, r * (1 + lift * 0.012), r * 0.42, clamp(0.3 - lift * 0.002, 0.12, 0.3));
}
