/**
 * Vingerverf - everything that is drawn, and the sheet of paper itself.
 *
 * The sheet is a pixel buffer, not a list of strokes. Replaying a stroke history every frame would
 * get slower with every line a child draws; a buffer costs the same on the first stroke and the
 * hundredth. Each dab touches only the pixels under the brush and the canvas is updated with just
 * that rectangle (`flush`).
 *
 * Mixing needs the pixel underneath, so the buffer keeps, per pixel, when it was last painted
 * (to know if it is still wet) and how much paint is there (so the thin soft edge of an old stroke
 * does not turn a new one pale). While one stroke is being laid, each pixel remembers what was under
 * it before the stroke arrived, so the stroke's own overlapping dabs build up a round, soft shape
 * instead of mixing with themselves and washing out.
 */

import { TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import { type Ctx, roundRectPath, shade } from '../../render/look';
import { crossing, PAPER, type Pot, type Rgb, wetness } from './model';

/** A fixed tile of noise for the grain of the paint and the tooth of the paper. */
const NOISE = (() => {
  const t = new Uint8Array(128 * 128);
  const rng = makeRng(8128);
  for (let i = 0; i < t.length; i++) t[i] = Math.floor(rng() * 256);
  return t;
})();

/** How dark the edge of a stroke goes, as a fraction. Product decision: a little, as paint dries darker at its rim. */
const RIM = 0.15;

export interface DabResult {
  /** pixels whose colour was a wet crossing in this dab, and the sum of their colours */
  mixed: number;
  r: number; g: number; b: number;
}

export class Sheet {
  readonly canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private img: ImageData;
  private under: Uint8ClampedArray;
  private target: Uint8ClampedArray;
  private stroke: Uint16Array;
  private covA: Uint8Array;
  private covG: Uint8Array;
  private body: Uint8Array;
  private wetAt: Float32Array;
  private dx0 = 1e9; private dy0 = 1e9; private dx1 = -1; private dy1 = -1;

  constructor(readonly w: number, readonly h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.img = this.ctx.createImageData(w, h);
    const n = w * h;
    this.under = new Uint8ClampedArray(n * 3);
    this.target = new Uint8ClampedArray(n * 3);
    this.stroke = new Uint16Array(n);
    this.covA = new Uint8Array(n);
    this.covG = new Uint8Array(n);
    this.body = new Uint8Array(n);
    this.wetAt = new Float32Array(n);
    this.clear();
  }

  /** Fresh paper, with a little tooth so it is not a flat fill. */
  clear(): void {
    const d = this.img.data;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x, k = (NOISE[(x & 127) | ((y & 127) << 7)] - 128) / 128 * 2.5;
        d[i * 4] = PAPER[0] + k; d[i * 4 + 1] = PAPER[1] + k; d[i * 4 + 2] = PAPER[2] + k; d[i * 4 + 3] = 255;
      }
    }
    this.stroke.fill(0); this.covA.fill(0); this.covG.fill(0); this.body.fill(0); this.wetAt.fill(-1e6);
    this.dx0 = 0; this.dy0 = 0; this.dx1 = this.w - 1; this.dy1 = this.h - 1;
    this.flush();
  }

  /** The stroke numbers have run round; forget them so an old stroke is not mistaken for the new one. */
  forgetStrokes(): void { this.stroke.fill(0); }

  /** Start from another picture, scaled to fit, for when the screen is turned. */
  adopt(from: HTMLCanvasElement): void {
    const c = this.ctx;
    c.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
    c.fillRect(0, 0, this.w, this.h);
    const k = Math.min(this.w / from.width, this.h / from.height);
    const dw = from.width * k, dh = from.height * k;
    c.drawImage(from, (this.w - dw) / 2, (this.h - dh) / 2, dw, dh);
    this.img = c.getImageData(0, 0, this.w, this.h);
    this.stroke.fill(0); this.covA.fill(0); this.covG.fill(0); this.wetAt.fill(-1e6);
    // whatever is not paper now counts as dry paint, so a new stroke covers it rather than skipping it
    this.body.fill(255);
  }

  colourAt(x: number, y: number): Rgb {
    const i = (Math.max(0, Math.min(this.h - 1, Math.round(y))) * this.w + Math.max(0, Math.min(this.w - 1, Math.round(x)))) * 4;
    return [this.img.data[i], this.img.data[i + 1], this.img.data[i + 2]];
  }

  /**
   * One round soft dab of paint.
   *
   * `op` is how solid it is, `dry` how much the bristles show (0 wet to 1 nearly dry), `id` the
   * stroke it belongs to (never 0), `now` the clock in seconds.
   */
  dab(cx: number, cy: number, r: number, paint: Rgb, op: number, dry: number, id: number, now: number): DabResult {
    const res: DabResult = { mixed: 0, r: 0, g: 0, b: 0 };
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const d = this.img.data, r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ddx = x - cx, ddy = y - cy, q = ddx * ddx + ddy * ddy;
        if (q >= r2) continue;
        const dist = Math.sqrt(q) / r;
        let c = 1;
        if (dist > 0.72) { const s = (dist - 0.72) / 0.28; c = 1 - s * s * (3 - 2 * s); }
        const n = NOISE[(x & 127) | ((y & 127) << 7)] / 255;
        // dry brush: where the noise is low the bristles skip
        const gm = dry > 0.02 ? (n > dry * 0.85 ? 1 : 0.18) : 1;
        const a = c * op * gm;
        if (a < 0.004) continue;
        const i = y * this.w + x, i3 = i * 3, i4 = i * 4;
        if (this.stroke[i] !== id) {
          this.stroke[i] = id; this.covA[i] = 0; this.covG[i] = 0;
          this.under[i3] = d[i4]; this.under[i3 + 1] = d[i4 + 1]; this.under[i3 + 2] = d[i4 + 2];
          const wet = wetness(this.wetAt[i], now) * (this.body[i] / 255);
          if (wet > 0.01) {
            const t = crossing([d[i4], d[i4 + 1], d[i4 + 2]], paint, wet);
            this.target[i3] = t[0]; this.target[i3 + 1] = t[1]; this.target[i3 + 2] = t[2];
            if (wet > 0.35 && c > 0.5) { res.mixed++; res.r += t[0]; res.g += t[1]; res.b += t[2]; }
          } else {
            this.target[i3] = paint[0]; this.target[i3 + 1] = paint[1]; this.target[i3 + 2] = paint[2];
          }
        }
        const aA = Math.round(a * 255), gG = Math.round(c * 255);
        if (aA <= this.covA[i] && gG <= this.covG[i]) continue;
        if (aA > this.covA[i]) this.covA[i] = aA;
        if (gG > this.covG[i]) this.covG[i] = gG;
        const al = this.covA[i] / 255, g = this.covG[i] / 255;
        const e = (g - 0.5) / 0.28;
        const k = (1 - RIM * Math.exp(-e * e)) * (1 + (n - 0.5) * 0.06);
        d[i4] = (this.under[i3] + (this.target[i3] - this.under[i3]) * al) * k;
        d[i4 + 1] = (this.under[i3 + 1] + (this.target[i3 + 1] - this.under[i3 + 1]) * al) * k;
        d[i4 + 2] = (this.under[i3 + 2] + (this.target[i3 + 2] - this.under[i3 + 2]) * al) * k;
        if (this.covA[i] > this.body[i]) this.body[i] = this.covA[i];
        this.wetAt[i] = now;
      }
    }
    if (x1 >= x0 && y1 >= y0) {
      this.dx0 = Math.min(this.dx0, x0); this.dy0 = Math.min(this.dy0, y0);
      this.dx1 = Math.max(this.dx1, x1); this.dy1 = Math.max(this.dy1, y1);
    }
    return res;
  }

  /** Push what changed since the last call to the canvas. */
  flush(): void {
    if (this.dx1 < this.dx0) return;
    this.ctx.putImageData(this.img, 0, 0, this.dx0, this.dy0, this.dx1 - this.dx0 + 1, this.dy1 - this.dy0 + 1);
    this.dx0 = 1e9; this.dy0 = 1e9; this.dx1 = -1; this.dy1 = -1;
  }
}

// ---------------------------------------------------------------- scenery

const css = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** The table the paper lies on. */
export function paintTable(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#e2c697'); g.addColorStop(1, '#c9a272');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The wall of the "klaar" screen: warm paper and a skirting board. */
export function paintWall(ctx: Ctx, w: number, h: number, floorY: number): void {
  ctx.fillStyle = '#f0e1c6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(190,150,100,0.12)';
  const step = Math.max(26, w / 16);
  for (let x = 0; x < w; x += step * 2) ctx.fillRect(x, 0, step, floorY);
  ctx.fillStyle = '#a97c50';
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = '#f7efe0';
  ctx.fillRect(0, floorY - 8, w, 8);
}

/** The sheet as it lies on the table: a soft shadow, rounded corners, the paint clipped inside. */
export function drawSheet(ctx: Ctx, canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(60, 36, 12, 0.35)';
  ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = css(PAPER);
  roundRectPath(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 6);
  ctx.clip();
  ctx.drawImage(canvas, x, y, w, h);
  ctx.restore();
}

/** A wooden frame with a mat, a nail and a cord, around whatever `inner` draws. */
export function drawFramed(ctx: Ctx, canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, u: number): void {
  const fr = 12 * u, mat = 8 * u;
  // the cord to a nail
  ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + w * 0.25, y); ctx.lineTo(x + w / 2, y - 22 * u); ctx.lineTo(x + w * 0.75, y); ctx.stroke();
  ctx.fillStyle = '#4a3320';
  ctx.beginPath(); ctx.arc(x + w / 2, y - 22 * u, 3.5 * u, 0, TAU); ctx.fill();
  ctx.save();
  ctx.shadowColor = 'rgba(60, 36, 12, 0.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#9a6a3c';
  roundRectPath(ctx, x - fr - mat, y - fr - mat, w + 2 * (fr + mat), h + 2 * (fr + mat), 5 * u);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = shade('#9a6a3c', 0.25); ctx.lineWidth = 2;
  roundRectPath(ctx, x - fr - mat + 3, y - fr - mat + 3, w + 2 * (fr + mat) - 6, h + 2 * (fr + mat) - 6, 4 * u);
  ctx.stroke();
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(x - mat, y - mat, w + 2 * mat, h + 2 * mat);
  ctx.drawImage(canvas, x, y, w, h);
  ctx.strokeStyle = 'rgba(60,36,12,0.35)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

export interface PotLook { selected: boolean; wobble: number; t: number }

/** A jar of paint in a square `size`, its top edge at `y`. The selected one is lifted and ringed. */
export function drawPot(ctx: Ctx, pot: Pot, x: number, y: number, size: number, look: PotLook): void {
  const lift = look.selected ? size * 0.1 : 0;
  const sway = Math.sin(look.t * 26) * look.wobble * size * 0.04;
  const cx = x + size / 2 + sway, base = y + size - size * 0.04 - lift;
  const bw = size * 0.86, bh = size * 0.62;
  ctx.save();
  if (look.selected) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(x + size / 2, y + size - size * 0.02, size * 0.55, size * 0.12, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(60,36,12,0.25)';
    ctx.beginPath(); ctx.ellipse(x + size / 2, y + size - size * 0.02, size * 0.46, size * 0.09, 0, 0, TAU); ctx.fill();
  }
  // the jar
  const jar = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  jar.addColorStop(0, '#d9d2c4'); jar.addColorStop(0.35, '#faf6ee'); jar.addColorStop(1, '#cfc7b8');
  ctx.fillStyle = jar;
  roundRectPath(ctx, cx - bw / 2, base - bh, bw, bh, size * 0.2);
  ctx.fill();
  // a band of the colour on the jar, so it reads at a glance
  ctx.fillStyle = css(pot.rgb);
  roundRectPath(ctx, cx - bw / 2 + size * 0.04, base - bh * 0.5, bw - size * 0.08, bh * 0.36, size * 0.1);
  ctx.fill();
  if (pot.id === 'white') { ctx.strokeStyle = 'rgba(80,70,60,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  // the paint in the top, a dome with a shine
  const top = base - bh;
  ctx.fillStyle = css(pot.rgb);
  ctx.beginPath(); ctx.ellipse(cx, top, bw * 0.46, size * 0.14, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = pot.id === 'white' ? 'rgba(80,70,60,0.4)' : shade(css2hex(pot.rgb), -0.25); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - bw * 0.14, top - size * 0.02, bw * 0.13, size * 0.04, -0.2, 0, TAU); ctx.fill();
  if (look.selected) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, size * 0.06);
    roundRectPath(ctx, cx - bw / 2 - 3, top - size * 0.17, bw + 6, bh + size * 0.2, size * 0.24);
    ctx.stroke();
  }
  ctx.restore();
}

function css2hex(c: Rgb): string {
  const h = (v: number): string => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}
