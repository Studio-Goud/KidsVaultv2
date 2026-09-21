/**
 * How the valley is painted.
 *
 * The simulation thinks in cells: a height and a depth of water per square. Drawn literally, that
 * is a grid of coloured squares, which is what a spreadsheet looks like. So the cells are painted
 * into a small offscreen image and blown up with smoothing, turning the grid into soft ground, and
 * everything a child actually looks at - grass, rocks, the mill, the cottages, the spring - is
 * drawn on top as real objects with light on one side and a shadow on the other.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import {
  blobPath, contactShadow, Ctx, grainOver, hexA, LIGHT, mix, Particles, shade,
} from '../../render/look';
import { kindOf, type Level, type Valley } from './world';

export interface Grid { x: number; y: number; cell: number; w: number; h: number }

interface Tuft { x: number; y: number; k: number; s: number; kind: 'grass' | 'flower' | 'reed' }
interface RockCluster { x: number; y: number; r: number; seed: number }

const HOLLOW = '#35702f';
const MEADOW = '#6fae4c';
const DRY = '#bcc274';
const FLOWERS = ['#ffd6e8', '#fff3b0', '#e8d5ff', '#ffffff'];

/** Everything about a valley's looks that only has to be worked out once. */
/**
 * How many pixels the ground is drawn at per valley cell.
 *
 * One was the old answer, and a 62-row height field blown up to eight hundred pixels of screen is
 * why the valley used to look like a soft green blur: the relief, the banks and the bare soil were
 * all smeared across thirteen pixels of bilinear upscale. Three is nine times the detail for the
 * same money, because the ground only changes when somebody digs - it is built once and kept.
 */
const GROUND_SS = 3;
/** The same for water, which does change every frame, so it gets less. */
const WATER_SS = 2;

export class ValleyArt {
  private groundCv: HTMLCanvasElement;
  /** the ground already blown up to the size it is shown at, so each frame is a plain copy */
  private groundScaled = document.createElement('canvas');
  private scaledFor = '';
  private waterCv: HTMLCanvasElement;
  private groundImg: ImageData;
  private waterImg: ImageData;
  /** rebuilt only when the land itself has been changed */
  private groundDirty = true;
  /** per-cell surface normal and hollowness, interpolated across the fine grid */
  private slopeX = new Float32Array(1);
  private slopeY = new Float32Array(1);
  private dip = new Float32Array(1);
  /** fine-grained speckle, so soil reads as soil and grass as grass */
  private speck = new Float32Array(1);
  private tufts: Tuft[] = [];
  private rocks: RockCluster[] = [];
  /** slow colour variation across the valley, so the grass is never one flat green */
  private patch = new Float32Array(1);
  private cols = 0;
  private rows = 0;

  constructor(v: Valley, seed: number) {
    this.groundCv = document.createElement('canvas');
    this.waterCv = document.createElement('canvas');
    this.groundImg = new ImageData(1, 1);
    this.waterImg = new ImageData(1, 1);
    this.rebuild(v, seed);
  }

  /** Fit the buffers to a valley and scatter the things that grow on it. */
  rebuild(v: Valley, seed: number): void {
    this.cols = v.cols; this.rows = v.rows;
    this.groundCv.width = v.cols * GROUND_SS;
    this.groundCv.height = v.rows * GROUND_SS;
    this.waterCv.width = v.cols * WATER_SS;
    this.waterCv.height = v.rows * WATER_SS;
    const gc = this.groundCv.getContext('2d');
    const wc = this.waterCv.getContext('2d');
    if (gc) this.groundImg = gc.createImageData(this.groundCv.width, this.groundCv.height);
    if (wc) this.waterImg = wc.createImageData(this.waterCv.width, this.waterCv.height);
    this.slopeX = new Float32Array(v.cols * v.rows);
    this.slopeY = new Float32Array(v.cols * v.rows);
    this.dip = new Float32Array(v.cols * v.rows);
    this.groundDirty = true;

    const noise = new ValueNoise(seed * 13 + 3);
    this.patch = new Float32Array(v.cols * v.rows);
    for (let y = 0; y < v.rows; y++) {
      for (let x = 0; x < v.cols; x++) {
        this.patch[y * v.cols + x] = noise.fbm2(x * 0.055, y * 0.045, 3) - 0.5;
      }
    }

    // the fine speckle, at the resolution the ground is actually drawn at
    const fine = new ValueNoise(seed * 31 + 7);
    const fw = v.cols * GROUND_SS, fh = v.rows * GROUND_SS;
    this.speck = new Float32Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        // two scales: a clump the size of a footprint, and a grain the size of a blade
        this.speck[y * fw + x] = (fine.fbm2(x * 0.34, y * 0.34, 2) - 0.5) * 0.7
          + (fine.fbm2(x * 1.15 + 40, y * 1.15 + 40, 1) - 0.5) * 0.5;
      }
    }

    const rng = makeRng(seed * 7919 + 13);
    this.tufts = [];
    const n = Math.round(v.cols * v.rows * 0.3);
    for (let i = 0; i < n; i++) {
      // tufts come in clumps, the way grass actually grows
      const clump = i % 3 === 0 || this.tufts.length === 0;
      const last = this.tufts[this.tufts.length - 1];
      const x = clump || !last ? rng() * v.cols : clamp(last.x + (rng() - 0.5) * 2.2, 0, v.cols - 0.01);
      const y = clump || !last ? rng() * v.rows : clamp(last.y + (rng() - 0.5) * 2.2, 0, v.rows - 0.01);
      const r = rng();
      this.tufts.push({
        x, y, k: rng(), s: 0.6 + rng() * 0.8,
        kind: r > 0.965 ? 'flower' : r > 0.9 ? 'reed' : 'grass',
      });
    }

    // rock outcrops: group the rock cells so each cluster can be drawn as one boulder
    this.rocks = [];
    const seen = new Uint8Array(v.cols * v.rows);
    for (let y = 0; y < v.rows; y++) {
      for (let x = 0; x < v.cols; x++) {
        const i = y * v.cols + x;
        if (seen[i] || kindOf(v, i) !== 'rock') continue;
        const stack = [i];
        const cells: number[] = [];
        seen[i] = 1;
        while (stack.length) {
          const j = stack.pop() as number;
          cells.push(j);
          const jx = j % v.cols, jy = (j / v.cols) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = jx + dx, ny = jy + dy;
            if (nx < 0 || ny < 0 || nx >= v.cols || ny >= v.rows) continue;
            const k = ny * v.cols + nx;
            if (seen[k] || kindOf(v, k) !== 'rock') continue;
            seen[k] = 1; stack.push(k);
          }
        }
        let sx = 0, sy = 0;
        for (const c of cells) { sx += c % v.cols; sy += (c / v.cols) | 0; }
        this.rocks.push({
          x: sx / cells.length + 0.5, y: sy / cells.length + 0.5,
          r: Math.sqrt(cells.length / Math.PI) * 1.12, seed: cells[0],
        });
      }
    }
  }

  // ------------------------------------------------------------ ground

  /** The land has been changed, so the ground has to be drawn again. */
  touch(): void { this.groundDirty = true; }

  /**
   * The land itself.
   *
   * Colour comes from height - lush and dark in the hollows, dry and pale on the ridges - and
   * brightness from which way the slope faces the sun, which is what makes a height field read as
   * a landscape instead of a heat map. Earth that has been moved shows as bare soil: dark and damp
   * where it was cut out, pale and loose where it was piled up.
   *
   * The slope and the hollowness are worked out once per valley cell and then carried smoothly
   * across the fine grid, because a normal computed per fine pixel from a bilinear height field is
   * constant within each cell and the whole thing comes out quilted.
   */
  private buildGround(v: Valley): void {
    const cols = v.cols, rows = v.rows;
    const fw = cols * GROUND_SS, fh = rows * GROUND_SS;
    const d = this.groundImg.data;

    // per cell: which way the ground leans, and how much of a dip it sits in
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const h = v.ground[i];
        const l = x > 0 ? v.ground[i - 1] : h;
        const r = x < cols - 1 ? v.ground[i + 1] : h;
        const u = y > 0 ? v.ground[i - cols] : h;
        const dn = y < rows - 1 ? v.ground[i + cols] : h;
        this.slopeX[i] = (l - r) * 5.2;
        this.slopeY[i] = (u - dn) * 4.4;
        const around = (v.ground[Math.max(0, i - cols * 3)] + v.ground[Math.min(v.ground.length - 1, i + cols * 3)]
          + v.ground[Math.max(0, i - 3)] + v.ground[Math.min(v.ground.length - 1, i + 3)]) / 4;
        this.dip[i] = clamp((around - h) * 5.5, -0.25, 0.55);
      }
    }

    const bilinear = (arr: Float32Array, fx: number, fy: number): number => {
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const xa = clamp(x0, 0, cols - 1), xb = clamp(x0 + 1, 0, cols - 1);
      const ya = clamp(y0, 0, rows - 1), yb = clamp(y0 + 1, 0, rows - 1);
      const a = arr[ya * cols + xa], b = arr[ya * cols + xb];
      const c = arr[yb * cols + xa], e = arr[yb * cols + xb];
      return (a + (b - a) * tx) + ((c + (e - c) * tx) - (a + (b - a) * tx)) * ty;
    };

    for (let fy = 0; fy < fh; fy++) {
      const cy = (fy + 0.5) / GROUND_SS - 0.5;
      const yc = clamp(Math.round(cy), 0, rows - 1);
      for (let fx = 0; fx < fw; fx++) {
        const cx = (fx + 0.5) / GROUND_SS - 0.5;
        const xc = clamp(Math.round(cx), 0, cols - 1);
        const ci = yc * cols + xc;
        const k = kindOf(v, ci);
        const o = (fy * fw + fx) * 4;
        const grit = this.speck[fy * fw + fx];

        if (k === 'sea') {
          d[o] = 38; d[o + 1] = 116; d[o + 2] = 178; d[o + 3] = 255;
          continue;
        }

        const hgt = bilinear(v.ground, cx, cy);
        const orig = bilinear(v.original, cx, cy);
        const nx = bilinear(this.slopeX, cx, cy);
        const ny = bilinear(this.slopeY, cx, cy);
        const hollow = bilinear(this.dip, cx, cy);
        const light = clamp(0.82 + nx * -LIGHT.x + ny * -LIGHT.y, 0.46, 1.28) * (1 - hollow * 0.42);

        const t = clamp((hgt - 0.06) / 0.8, 0, 1) + this.patch[ci] * 0.14;
        const col = t < 0.45 ? mix(HOLLOW, MEADOW, clamp(t / 0.45, 0, 1))
          : mix(MEADOW, DRY, clamp((t - 0.45) / 0.6, 0, 1));
        const n2 = parseInt(col.slice(1), 16);
        let r = (n2 >> 16) & 255, gg = (n2 >> 8) & 255, b = n2 & 255;
        // grass is never one flat green: a fine mottle over the top of the slow patches
        const mot = 1 + grit * 0.26;
        r *= mot; gg *= mot * 1.03; b *= mot * 0.96;

        // earth that has been cut out is dark and damp; earth piled up is pale and loose
        const dug = clamp((orig - hgt) / 0.085, 0, 1);
        if (dug > 0) {
          const speckle = 1 + grit * 0.5;
          r = r * (1 - dug) + 104 * speckle * dug;
          gg = gg * (1 - dug) + 74 * speckle * dug;
          b = b * (1 - dug) + 50 * speckle * dug;
        }
        const banked = clamp((hgt - orig) / 0.1, 0, 1);
        if (banked > 0) {
          const speckle = 1 + grit * 0.42;
          r = r * (1 - banked) + 162 * speckle * banked;
          gg = gg * (1 - banked) + 138 * speckle * banked;
          b = b * (1 - banked) + 98 * speckle * banked;
        }
        if (k === 'field') { r = r * 0.72 + 128 * 0.28; gg = gg * 0.72 + 92 * 0.28; b = b * 0.72 + 56 * 0.28; }

        // Sunlit ground is warmer and shaded ground is cooler, because the shade is lit by the
        // sky rather than by the sun. It is a small shift and it is most of what makes a rendered
        // landscape stop looking like a tinted heightmap.
        const warm = light - 1;
        d[o] = clamp(r * light * (1 + warm * 0.22), 0, 255);
        d[o + 1] = clamp(gg * light, 0, 255);
        d[o + 2] = clamp(b * light * (1 - warm * 0.26), 0, 255);
        d[o + 3] = 255;
      }
    }
    const gc = this.groundCv.getContext('2d');
    if (gc) gc.putImageData(this.groundImg, 0, 0);
    this.groundDirty = false;
  }

  paintGround(ctx: Ctx, g: Grid, v: Valley): void {
    if (this.groundDirty) { this.buildGround(v); this.scaledFor = ''; }
    // A high-quality upscale of the height field is expensive and the answer never changes between
    // digs, so it is done once into a canvas the size it is shown at and copied from then on.
    const key = `${Math.round(g.w)}x${Math.round(g.h)}`;
    if (this.scaledFor !== key) {
      this.groundScaled.width = Math.max(1, Math.round(g.w));
      this.groundScaled.height = Math.max(1, Math.round(g.h));
      const sc = this.groundScaled.getContext('2d');
      if (sc) {
        sc.imageSmoothingEnabled = true;
        sc.imageSmoothingQuality = 'high';
        sc.drawImage(this.groundCv, 0, 0, this.groundScaled.width, this.groundScaled.height);
        // The film of grain that stops the land looking like flat paint is baked in here rather
        // than laid over the whole valley every frame: it is an 'overlay' blend across most of the
        // screen, which is a per-pixel read and write and was costing a quarter of the frame.
        grainOver(sc, 0, 0, this.groundScaled.width, this.groundScaled.height, 0.06);
        // and the grass, which does not move
        this.paintGrowth(sc, { x: 0, y: 0, cell: g.cell, w: g.w, h: g.h }, v, 0, false);
      }
      this.scaledFor = key;
    }
    ctx.drawImage(this.groundScaled, g.x, g.y, g.w, g.h);
  }

  /**
   * Grass, reeds and flowers, thicker in the damp hollows and thin on the dry tops.
   *
   * Six hundred hand-drawn tufts a frame is most of a phone's frame for something that does not
   * move, so the grass and the flowers are painted once into the ground's cache and only the
   * reeds - the tall ones by the water, where a sway actually reads - are drawn live.
   */
  paintGrowth(ctx: Ctx, g: Grid, v: Valley, t: number, moving = true): void {
    const c = g.cell;
    const step = Math.max(0.6, c);
    ctx.save();
    ctx.lineCap = 'round';
    for (const tuft of this.tufts) {
      if ((tuft.kind === 'reed') !== moving) continue;
      const cx = Math.min(v.cols - 1, Math.floor(tuft.x)), cy = Math.min(v.rows - 1, Math.floor(tuft.y));
      const i = cy * v.cols + cx;
      const k = kindOf(v, i);
      if (k === 'sea' || k === 'rock' || k === 'house' || k === 'wheel') continue;
      if (moving && v.water[i] > 0.02) continue;
      const dug = v.original[i] - v.ground[i];
      if (dug > 0.02) continue;
      const x = g.x + tuft.x * c, y = g.y + tuft.y * c;
      const hgt = v.ground[i];
      const lush = clamp(1 - (hgt - 0.1) / 0.7, 0.15, 1);
      const sway = moving ? Math.sin(t * 1.6 + tuft.x * 0.7 + tuft.y * 0.3) * step * 0.22 * lush : 0;
      if (tuft.kind === 'flower') {
        const s = step * 0.2 * tuft.s;
        ctx.strokeStyle = 'rgba(70,120,50,0.75)';
        ctx.lineWidth = Math.max(0.6, step * 0.09);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway, y - s * 2.1); ctx.stroke();
        ctx.fillStyle = FLOWERS[Math.floor(tuft.k * FLOWERS.length) % FLOWERS.length];
        ctx.beginPath(); ctx.arc(x + sway, y - s * 2.4, s * 0.72, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(240,190,60,0.75)';
        ctx.beginPath(); ctx.arc(x + sway, y - s * 2.4, s * 0.22, 0, TAU); ctx.fill();
      } else {
        const blades = tuft.kind === 'reed' ? 2 : 3;
        const h = step * (tuft.kind === 'reed' ? 1.25 : 0.72) * tuft.s * (0.55 + lush * 0.75);
        ctx.strokeStyle = hexA(tuft.kind === 'reed' ? '#4d8a4f' : mix('#6fa550', '#95b45c', tuft.k), 0.3 + lush * 0.26);
        ctx.lineWidth = Math.max(0.5, step * 0.085);
        for (let bI = 0; bI < blades; bI++) {
          const off = (bI - (blades - 1) / 2) * step * 0.3;
          ctx.beginPath();
          ctx.moveTo(x + off, y);
          ctx.quadraticCurveTo(x + off + sway * 0.5, y - h * 0.6, x + off + sway * 1.5 + off * 0.8, y - h);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** Boulders you cannot dig through: drawn as stone, lit from the same side as everything else. */
  paintRocks(ctx: Ctx, g: Grid): void {
    const c = g.cell;
    for (const r of this.rocks) {
      const x = g.x + r.x * c, y = g.y + r.y * c, R = r.r * c;
      contactShadow(ctx, x + R * 0.22, y + R * 0.52, R * 1.2, R * 0.46, 0.36);
      ctx.save();
      blobPath(ctx, x, y, R, r.seed, 0.16, 13);
      ctx.clip();
      // the body, lit from the top left
      const gr = ctx.createLinearGradient(x + LIGHT.x * R, y + LIGHT.y * R, x - LIGHT.x * R * 1.1, y - LIGHT.y * R * 1.1);
      gr.addColorStop(0, '#cfc9c1');
      gr.addColorStop(0.42, '#a39c94');
      gr.addColorStop(1, '#6d6762');
      ctx.fillStyle = gr;
      ctx.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4);
      // the ground bounces a little light back up into the underside
      const bounce = ctx.createRadialGradient(x - LIGHT.x * R * 0.7, y - LIGHT.y * R * 0.8, 0, x, y, R * 1.2);
      bounce.addColorStop(0, 'rgba(150, 178, 120, 0.3)');
      bounce.addColorStop(1, 'rgba(150, 178, 120, 0)');
      ctx.fillStyle = bounce;
      ctx.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4);
      // a couple of flat faces, so it reads as broken stone rather than a pebble
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x - R * 0.7, y - R * 0.2);
      ctx.lineTo(x - R * 0.1, y - R * 0.86);
      ctx.lineTo(x + R * 0.42, y - R * 0.3);
      ctx.lineTo(x - R * 0.2, y + R * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(44, 40, 38, 0.16)';
      ctx.beginPath();
      ctx.moveTo(x + R * 0.1, y + R * 0.15);
      ctx.lineTo(x + R * 0.9, y - R * 0.1);
      ctx.lineTo(x + R * 0.7, y + R * 0.8);
      ctx.lineTo(x - R * 0.1, y + R * 0.75);
      ctx.closePath();
      ctx.fill();
      // moss where the damp sits, low down and out of the sun
      ctx.fillStyle = 'rgba(96, 142, 74, 0.5)';
      blobPath(ctx, x - R * 0.3, y + R * 0.62, R * 0.46, r.seed + 21, 0.4, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(112, 158, 88, 0.36)';
      blobPath(ctx, x + R * 0.5, y + R * 0.5, R * 0.3, r.seed + 44, 0.4, 9);
      ctx.fill();
      ctx.restore();
      // a soft edge so it sits in the grass instead of being cut out of it
      ctx.strokeStyle = 'rgba(58, 54, 50, 0.4)';
      ctx.lineWidth = Math.max(0.8, c * 0.1);
      blobPath(ctx, x, y, R, r.seed, 0.16, 13);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ water

  /**
   * The water. Depth drives both colour and opacity, so a puddle is a pale film and a channel is a
   * deep blue vein; the same smoothing that softens the ground turns the cells into a stream with
   * banks instead of a staircase.
   */
  /**
   * The water.
   *
   * Depth does the work: a shallow film is almost clear and picks up the colour of the ground it
   * is lying on, a channel running full is a solid blue-green, and the very edge is lighter still
   * because that is where the bed shows through. Drawn at twice the grid so the banks of a channel
   * are a line rather than a staircase.
   */
  paintWater(ctx: Ctx, g: Grid, v: Valley, t: number): void {
    const d = this.waterImg.data;
    const cols = v.cols, rows = v.rows;
    const fw = cols * WATER_SS, fh = rows * WATER_SS;
    const depth = (fx: number, fy: number): number => {
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const xa = clamp(x0, 0, cols - 1), xb = clamp(x0 + 1, 0, cols - 1);
      const ya = clamp(y0, 0, rows - 1), yb = clamp(y0 + 1, 0, rows - 1);
      const a = v.water[ya * cols + xa], b = v.water[ya * cols + xb];
      const c = v.water[yb * cols + xa], e = v.water[yb * cols + xb];
      const top = a + (b - a) * tx, bot = c + (e - c) * tx;
      return top + (bot - top) * ty;
    };
    // Only the wet part is worth compositing. A channel is a thin ribbon across a big valley, and
    // laying the whole rectangle over the land every frame - almost all of it transparent - was
    // the single most expensive thing on the screen.
    let x0 = fw, x1 = -1, y0 = fh, y1 = -1;
    for (let fy = 0; fy < fh; fy++) {
      const cy = (fy + 0.5) / WATER_SS - 0.5;
      const yc = clamp(Math.round(cy), 0, rows - 1);
      for (let fx = 0; fx < fw; fx++) {
        const cx = (fx + 0.5) / WATER_SS - 0.5;
        const xc = clamp(Math.round(cx), 0, cols - 1);
        const o = (fy * fw + fx) * 4;
        if (kindOf(v, yc * cols + xc) === 'sea') { d[o + 3] = 0; continue; }
        const w = depth(cx, cy);
        if (w < 0.004) { d[o + 3] = 0; continue; }
        if (fx < x0) x0 = fx;
        if (fx > x1) x1 = fx;
        if (fy < y0) y0 = fy;
        if (fy > y1) y1 = fy;
        const deep = clamp((w - 0.004) / 0.07, 0, 1);
        // the shallowest film is nearly clear and takes a little green from the bed below it
        const rim = 1 - clamp(deep * 3.2, 0, 1);
        d[o] = 122 - deep * 88 + rim * 26;
        d[o + 1] = 214 - deep * 96 + rim * 18;
        d[o + 2] = 244 - deep * 44;
        d[o + 3] = clamp(96 + deep * 156, 0, 252);
      }
    }
    const wc = this.waterCv.getContext('2d');
    if (!wc) return;
    if (x1 >= x0) {
      // a cell of margin, so the smooth upscale has something to fade into
      x0 = Math.max(0, x0 - WATER_SS); x1 = Math.min(fw - 1, x1 + WATER_SS);
      y0 = Math.max(0, y0 - WATER_SS); y1 = Math.min(fh - 1, y1 + WATER_SS);
      const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
      wc.putImageData(this.waterImg, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = 0.94;
      // No canvas filter: a gaussian blur is applied at screen resolution and costs a sixth of the
      // frame on a phone. Twice the grid plus a smooth upscale already takes the staircase out.
      ctx.drawImage(this.waterCv, x0, y0, sw, sh,
        g.x + (x0 / fw) * g.w, g.y + (y0 / fh) * g.h, (sw / fw) * g.w, (sh / fh) * g.h);
      ctx.restore();
    }

    // Light running over the surface, travelling the way the water is travelling.
    //
    // Every streak used to be its own save, translate, rotate, fill and restore - five hundred of
    // them a frame, which on a phone is most of the frame. `ellipse` takes a rotation of its own,
    // so they all go into one path instead, bucketed into a few brightnesses.
    const c = g.cell;
    const bands: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
    let any = false;
    for (let y = 1; y < v.rows - 1; y += 2) {
      for (let x = 1; x < v.cols - 1; x += 2) {
        const i = y * v.cols + x;
        const w = v.water[i];
        if (w < 0.02 || kindOf(v, i) === 'sea') continue;
        const hx = (v.ground[i - 1] + v.water[i - 1]) - (v.ground[i + 1] + v.water[i + 1]);
        const hy = (v.ground[i - v.cols] + v.water[i - v.cols]) - (v.ground[i + v.cols] + v.water[i + v.cols]);
        const speed = Math.hypot(hx, hy);
        if (speed < 0.004) continue;
        const ang = Math.atan2(-hy, -hx);
        const phase = (t * 1.7 + x * 0.21 + y * 0.17) % 1;
        const a = Math.sin(phase * Math.PI) * clamp(speed * 26, 0, 1) * 0.28;
        if (a <= 0.03) continue;
        const band = a > 0.2 ? 2 : a > 0.11 ? 1 : 0;
        const ex = g.x + (x + 0.5) * c + Math.cos(ang) * c * (phase - 0.5) * 2.4;
        const ey = g.y + (y + 0.5) * c + Math.sin(ang) * c * (phase - 0.5) * 2.4;
        const rx = c * 0.6;
        // each streak needs its own sub-path, or the path joins one to the next with a straight
        // line and fills the polygon between them
        bands[band].moveTo(ex + Math.cos(ang) * rx, ey + Math.sin(ang) * rx);
        bands[band].ellipse(ex, ey, rx, c * 0.11, ang, 0, TAU);
        any = true;
      }
    }
    if (any) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      [0.07, 0.15, 0.26].forEach((a, k) => {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill(bands[k]);
      });
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ the things in the valley

  /** The spring: a mouth in the rock with water welling out of it while it still runs. */
  paintSpring(ctx: Ctx, g: Grid, v: Valley, sx: number, sy: number, live: boolean, t: number, ps: Particles): void {
    const c = g.cell;
    const x = g.x + (Math.round(sx * (v.cols - 1)) + 0.5) * c;
    const y = g.y + (Math.round(sy * (v.rows - 1)) + 0.5) * c;
    const R = c * 2.2;
    contactShadow(ctx, x, y + R * 0.4, R * 1.2, R * 0.42, 0.3);
    // the stone rim
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      const rx = x + Math.cos(a) * R * 0.86, ry = y + Math.sin(a) * R * 0.76;
      const rr = R * (0.3 + ((i * 7) % 3) * 0.06);
      const gr = ctx.createLinearGradient(rx, ry - rr, rx, ry + rr);
      gr.addColorStop(0, '#cbc4bb');
      gr.addColorStop(1, '#7d766f');
      ctx.fillStyle = gr;
      blobPath(ctx, rx, ry, rr, i * 31 + 5, 0.3, 8);
      ctx.fill();
    }
    // the pool in the mouth
    const pg = ctx.createRadialGradient(x, y, 0, x, y, R * 0.74);
    pg.addColorStop(0, live ? '#eafaff' : '#9fb4bd');
    pg.addColorStop(0.5, live ? '#6cc8ee' : '#8aa3ae');
    pg.addColorStop(1, live ? '#2b8fc9' : '#6d8590');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(x, y, R * 0.74, R * 0.6, 0, 0, TAU);
    ctx.fill();
    if (live) {
      // rings running out from the source
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.9 + k / 3) % 1;
        ctx.globalAlpha = (1 - ph) * 0.75;
        ctx.lineWidth = Math.max(1, c * 0.22 * (1 - ph));
        ctx.beginPath();
        ctx.ellipse(x, y, R * (0.3 + ph * 0.9), R * (0.24 + ph * 0.72), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      // the swell in the middle, and the odd drop thrown clear
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y - c * 0.1, R * 0.26 * (0.85 + Math.sin(t * 7) * 0.14), R * 0.2, 0, 0, TAU);
      ctx.fill();
      if (Math.random() < 0.25) ps.spawn('splash', x, y, 1, { colour: 'rgba(214,240,255,0.95)', speed: 42, size: c * 0.7, max: 0.5 });
    }
  }

  /**
   * A field, from dry tilth to a standing crop.
   *
   * It is a worked plot, not a coloured disc: turned soil in furrows, a crop standing in the rows,
   * and a fence of stakes around it. What the crop is doing says how far along the field is -
   * drooping and pale when it is thirsty, upright and gold when it has drunk its fill - so a child
   * can read the state of every field in the valley at a glance, with no numbers anywhere.
   */
  paintField(ctx: Ctx, g: Grid, v: Valley, f: { x: number; y: number; need: number }, fill: number, done: boolean, t: number): void {
    const c = g.cell;
    const x = g.x + (Math.round(f.x * (v.cols - 1)) + 0.5) * c;
    const y = g.y + (Math.round(f.y * (v.rows - 1)) + 0.5) * c;
    const R = 4.1 * c;
    const tilt = ((f.x * 31 + f.y * 17) % 1 - 0.5) * 0.16;
    const half = R * 0.94;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // the plot, dug over
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-half, -half * 0.94, half * 2, half * 1.88, c * 0.6);
    ctx.clip();
    const soil = ctx.createLinearGradient(0, -half, 0, half);
    soil.addColorStop(0, mix('#8a6b48', '#5b3f26', fill));
    soil.addColorStop(1, mix('#6f5436', '#432d18', fill));
    ctx.fillStyle = soil;
    ctx.fillRect(-half, -half, half * 2, half * 2);
    // clods of turned earth
    const crng = makeRng(Math.round(f.x * 977 + f.y * 613));
    for (let i = 0; i < 26; i++) {
      const px = -half + crng() * half * 2, py = -half * 0.9 + crng() * half * 1.8;
      ctx.fillStyle = crng() > 0.5 ? 'rgba(255,240,210,0.09)' : 'rgba(60,40,22,0.12)';
      ctx.beginPath();
      ctx.ellipse(px, py, c * (0.3 + crng() * 0.4), c * (0.18 + crng() * 0.2), crng() * 3, 0, TAU);
      ctx.fill();
    }
    // soil speckle, so the ground has a grain instead of a flat wash
    for (let i = 0; i < 90; i++) {
      const px = -half + crng() * half * 2, py = -half * 0.94 + crng() * half * 1.88;
      ctx.fillStyle = crng() > 0.5 ? 'rgba(255,236,200,0.07)' : 'rgba(40,26,14,0.1)';
      ctx.beginPath();
      ctx.arc(px, py, c * (0.08 + crng() * 0.14), 0, TAU);
      ctx.fill();
    }
    // raised beds: a soft dark trough between each row, no hard lines
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const ry = -half * 0.76 + (i / (rows - 1)) * half * 1.52;
      const tr = ctx.createLinearGradient(0, ry - c * 0.6, 0, ry + c * 0.6);
      tr.addColorStop(0, 'rgba(40,26,14,0)');
      tr.addColorStop(0.5, 'rgba(40,26,14,0.22)');
      tr.addColorStop(1, 'rgba(40,26,14,0)');
      ctx.fillStyle = tr;
      ctx.fillRect(-half, ry - c * 0.6, half * 2, c * 1.2);
    }
    // the crop. On a phone the whole plot is barely a thumb wide, so it is a dozen plants drawn
    // properly rather than fifty drawn as ticks: leaves with a shape to them, a stem, and an ear
    // on top once the field has drunk enough to make one.
    const prng = makeRng(Math.round(f.x * 4231 + f.y * 911));
    const plants = 15;
    for (let i = 0; i < plants; i++) {
      const row = i % rows;
      const ry = -half * 0.72 + (row / (rows - 1)) * half * 1.44;
      const px = -half * 0.74 + prng() * half * 1.48;
      const py = ry + (prng() - 0.5) * c * 0.55;
      const scale = (0.85 + prng() * 0.5) * clamp(half / (c * 3.4), 0.7, 1.5);
      const grow = clamp(fill * 1.3 - prng() * 0.18, 0.06, 1);
      const lean = (prng() - 0.5) * 0.4 + (1 - grow) * 0.5;
      const hgt = c * (0.7 + grow * 2.2) * scale;
      const sway = Math.sin(t * 1.6 + px * 0.3 + i) * c * 0.18 * grow;
      const green = mix('#9aac52', '#4f9a37', clamp(grow * 1.3 - prng() * 0.15, 0, 1));
      ctx.save();
      ctx.translate(px, py);
      // leaves, as filled blades that fan out from the base
      const leaves = 3 + Math.round(grow * 2);
      for (let l = 0; l < leaves; l++) {
        const a = -Math.PI / 2 + ((l - (leaves - 1) / 2) / leaves) * 2.4 + lean * 0.5;
        const ll = c * (0.75 + grow * 0.9) * scale * (0.7 + prng() * 0.6);
        ctx.fillStyle = l % 2 === 0 ? green : shade(green, -0.12);
        ctx.beginPath();
        ctx.moveTo(0, c * 0.1);
        ctx.quadraticCurveTo(Math.cos(a) * ll * 0.5 - Math.sin(a) * c * 0.2, Math.sin(a) * ll * 0.5 + Math.cos(a) * c * 0.2,
          Math.cos(a) * ll, Math.sin(a) * ll);
        ctx.quadraticCurveTo(Math.cos(a) * ll * 0.5 + Math.sin(a) * c * 0.2, Math.sin(a) * ll * 0.5 - Math.cos(a) * c * 0.2,
          0, c * 0.1);
        ctx.fill();
      }
      // the stem and its ear
      if (grow > 0.3) {
        ctx.strokeStyle = grow > 0.7 ? mix(green, '#d8bd52', (grow - 0.7) / 0.3) : green;
        ctx.lineWidth = Math.max(0.9, c * 0.16 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, c * 0.1);
        ctx.quadraticCurveTo(sway * 0.4 + lean * c * 0.4, -hgt * 0.55, sway + lean * c * 0.8, -hgt);
        ctx.stroke();
        if (grow > 0.58) {
          const eg = ctx.createLinearGradient(0, -hgt - c * 0.4, 0, -hgt + c * 0.3);
          eg.addColorStop(0, '#f6e389');
          eg.addColorStop(1, mix('#c9ad46', '#e6cd63', grow));
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.ellipse(sway + lean * c * 0.8, -hgt - c * 0.16, c * 0.2 * scale, c * 0.44 * scale, sway * 0.3 + lean * 0.6, 0, TAU);
          ctx.fill();
          // the whiskers on an ear of wheat
          ctx.strokeStyle = 'rgba(246,227,137,0.8)';
          ctx.lineWidth = Math.max(0.5, c * 0.06);
          for (let wI = -1; wI <= 1; wI++) {
            ctx.beginPath();
            ctx.moveTo(sway + lean * c * 0.8, -hgt - c * 0.5);
            ctx.lineTo(sway + lean * c * 0.8 + wI * c * 0.26, -hgt - c * 0.95);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    // water lying in the furrows darkens the soil at the low end
    if (fill > 0.05) {
      ctx.fillStyle = `rgba(40, 84, 44, ${0.1 + fill * 0.14})`;
      ctx.fillRect(-half, -half, half * 2, half * 2);
    }
    ctx.restore();

    // a fence of stakes with a rail, which is what tells you it is somebody's field
    ctx.strokeStyle = 'rgba(104,72,42,0.9)';
    ctx.lineCap = 'round';
    const posts = 9;
    ctx.lineWidth = Math.max(1, c * 0.13);
    ctx.beginPath();
    ctx.moveTo(-half, -half * 0.94 - c * 0.35);
    ctx.lineTo(half, -half * 0.94 - c * 0.35);
    ctx.moveTo(-half, half * 0.94 - c * 0.1);
    ctx.lineTo(half, half * 0.94 - c * 0.1);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, c * 0.17);
    for (let i = 0; i < posts; i++) {
      const px = -half + (i / (posts - 1)) * half * 2;
      ctx.beginPath();
      ctx.moveTo(px, -half * 0.94 + c * 0.35);
      ctx.lineTo(px, -half * 0.94 - c * 0.75);
      ctx.moveTo(px, half * 0.94 + c * 0.5);
      ctx.lineTo(px, half * 0.94 - c * 0.6);
      ctx.stroke();
    }
    ctx.restore();

    if (done) {
      // a ring of warm light, once the field has had all it needs
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 2.6) * 0.12;
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = Math.max(2, c * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y, R * 1.12, R * 1.06, tilt, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The mill: a stone house with a wheel on its flank, and spray where the water strikes it. */
  paintWheel(ctx: Ctx, g: Grid, v: Valley, wh: { x: number; y: number; need: number }, angle: number, speed: number, prog: number, t: number, ps: Particles): void {
    const c = g.cell;
    const x = g.x + (Math.round(wh.x * (v.cols - 1)) + 0.5) * c;
    const y = g.y + (Math.round(wh.y * (v.rows - 1)) + 0.5) * c;
    const R = 2.4 * c;
    contactShadow(ctx, x + R * 0.5, y + R * 0.8, R * 1.7, R * 0.5, 0.35);

    // the mill house, set to the right of the wheel
    const hx = x + R * 0.95, hy = y;
    const hw = R * 1.5, hh = R * 1.9;
    const wallG = ctx.createLinearGradient(hx - hw / 2, 0, hx + hw / 2, 0);
    wallG.addColorStop(0, '#e6d8c0');
    wallG.addColorStop(1, '#bda787');
    ctx.fillStyle = wallG;
    ctx.beginPath();
    ctx.roundRect(hx - hw / 2, hy - hh * 0.42, hw, hh * 0.85, c * 0.25);
    ctx.fill();
    // stonework
    ctx.strokeStyle = 'rgba(120,96,66,0.35)';
    ctx.lineWidth = Math.max(0.6, c * 0.08);
    for (let i = 1; i < 4; i++) {
      const yy = hy - hh * 0.42 + (hh * 0.85 * i) / 4;
      ctx.beginPath(); ctx.moveTo(hx - hw / 2, yy); ctx.lineTo(hx + hw / 2, yy); ctx.stroke();
    }
    // roof
    const roofG = ctx.createLinearGradient(hx, hy - hh * 0.95, hx, hy - hh * 0.35);
    roofG.addColorStop(0, '#d0674f');
    roofG.addColorStop(1, '#9c422f');
    ctx.fillStyle = roofG;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.66, hy - hh * 0.38);
    ctx.lineTo(hx, hy - hh * 0.98);
    ctx.lineTo(hx + hw * 0.66, hy - hh * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.66, hy - hh * 0.38);
    ctx.lineTo(hx, hy - hh * 0.98);
    ctx.lineTo(hx - hw * 0.08, hy - hh * 0.38);
    ctx.closePath();
    ctx.fill();
    // a lit window
    ctx.fillStyle = prog > 0.02 ? '#ffd88a' : '#8fa0ae';
    ctx.beginPath();
    ctx.roundRect(hx - c * 0.34, hy - hh * 0.16, c * 0.7, c * 0.7, c * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,40,0.7)';
    ctx.lineWidth = Math.max(0.7, c * 0.09);
    ctx.stroke();

    // the wheel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const spokes = 8;
    // buckets
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#6b4526';
      ctx.beginPath();
      ctx.roundRect(R * 0.72, -R * 0.2, R * 0.34, R * 0.4, R * 0.06);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.roundRect(R * 0.72, -R * 0.2, R * 0.34, R * 0.14, R * 0.05);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#7a5130';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.8, c * 0.3);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1.4, c * 0.22);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, TAU); ctx.stroke();
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14);
      ctx.lineTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
      ctx.stroke();
    }
    ctx.restore();
    // hub
    ctx.fillStyle = '#5b3a21';
    ctx.beginPath(); ctx.arc(x, y, R * 0.16, 0, TAU); ctx.fill();

    if (speed > 0.25 && Math.random() < speed * 0.7) {
      ps.spawn('splash', x - R * 0.7, y + R * 0.6, 1, { colour: 'rgba(226,246,255,0.9)', speed: 70 * speed, size: c * 0.8, max: 0.45 });
    }
    // how much of its work the wheel has done, as a ring of light around it
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, c * 0.26);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(x, y, R * 1.24, 0, TAU); ctx.stroke();
    ctx.strokeStyle = prog >= 1 ? '#8ef0ba' : '#ffd98a';
    ctx.beginPath(); ctx.arc(x, y, R * 1.24, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1)); ctx.stroke();
    ctx.restore();
  }

  /** A cottage that has to stay dry. Smoke while all is well; water at the door when it is not. */
  paintHouse(ctx: Ctx, g: Grid, v: Valley, hx: number, hy: number, wet: number, t: number, seed: number): void {
    const c = g.cell;
    const x = g.x + (Math.round(hx * (v.cols - 1)) + 0.5) * c;
    const y = g.y + (Math.round(hy * (v.rows - 1)) + 0.5) * c;
    const s = 2.3 * c;
    contactShadow(ctx, x + s * 0.2, y + s * 0.62, s * 0.95, s * 0.3, 0.34);
    // walls
    const wallG = ctx.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0);
    wallG.addColorStop(0, mix('#fff6e4', '#b9b0a4', wet));
    wallG.addColorStop(1, mix('#d9c9ad', '#8d8579', wet));
    ctx.fillStyle = wallG;
    ctx.beginPath();
    ctx.roundRect(x - s * 0.5, y - s * 0.18, s, s * 0.76, c * 0.18);
    ctx.fill();
    // timber framing
    ctx.strokeStyle = 'rgba(110,74,44,0.55)';
    ctx.lineWidth = Math.max(0.8, c * 0.11);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.2); ctx.lineTo(x + s * 0.5, y + s * 0.2);
    ctx.moveTo(x - s * 0.2, y - s * 0.18); ctx.lineTo(x - s * 0.2, y + s * 0.58);
    ctx.stroke();
    // thatched roof
    const roofG = ctx.createLinearGradient(x, y - s * 0.95, x, y - s * 0.1);
    roofG.addColorStop(0, mix('#e0b463', '#8d7a55', wet * 0.8));
    roofG.addColorStop(1, mix('#b98c3f', '#6f6045', wet * 0.8));
    ctx.fillStyle = roofG;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.66, y - s * 0.14);
    ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.92, x, y - s * 0.88);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.92, x + s * 0.66, y - s * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,64,30,0.3)';
    ctx.lineWidth = Math.max(0.6, c * 0.07);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.16, y - s * 0.82 + Math.abs(i) * s * 0.06);
      ctx.lineTo(x + i * s * 0.24, y - s * 0.16);
      ctx.stroke();
    }
    // door and window
    ctx.fillStyle = mix('#6b4426', '#4a3423', wet);
    ctx.beginPath();
    ctx.roundRect(x - s * 0.12, y + s * 0.16, s * 0.24, s * 0.42, c * 0.08);
    ctx.fill();
    ctx.fillStyle = wet > 0.5 ? '#8fa2b0' : '#ffd88a';
    ctx.beginPath();
    ctx.roundRect(x + s * 0.2, y + s * 0.02, s * 0.2, s * 0.2, c * 0.05);
    ctx.fill();
    // chimney and smoke
    ctx.fillStyle = mix('#c08a63', '#7d6a5a', wet);
    ctx.fillRect(x + s * 0.3, y - s * 0.78, s * 0.14, s * 0.3);
    if (wet < 0.5) {
      for (let i = 0; i < 4; i++) {
        const ph = ((t * 0.32 + i * 0.25 + seed * 0.1) % 1);
        ctx.globalAlpha = (1 - ph) * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + s * 0.37 + Math.sin(ph * 5 + i) * s * 0.12, y - s * 0.84 - ph * s * 0.9, s * (0.06 + ph * 0.13), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (wet > 0.04) {
      // water creeping up the walls
      ctx.fillStyle = `rgba(52,140,215,${0.25 + wet * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.55, s * 0.72, s * 0.2 + wet * s * 0.14, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** The sea at the foot of the valley: everything that reaches it is lost. */
  paintSea(ctx: Ctx, g: Grid, v: Valley, t: number): void {
    const c = g.cell;
    const top = g.y + (v.rows - 2) * c;
    const bottom = g.y + g.h;
    if (bottom <= top) return;
    const sg = ctx.createLinearGradient(0, top, 0, bottom);
    sg.addColorStop(0, '#3f9fd4');
    sg.addColorStop(1, '#14639e');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(g.x, top + Math.sin(t * 1.4) * c * 0.2);
    for (let x = 0; x <= g.w; x += c) {
      ctx.lineTo(g.x + x, top + Math.sin(t * 1.4 + x * 0.035) * c * 0.35);
    }
    ctx.lineTo(g.x + g.w, bottom);
    ctx.lineTo(g.x, bottom);
    ctx.closePath();
    ctx.fill();
    // foam along the shore
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.4, c * 0.22);
    ctx.beginPath();
    for (let x = 0; x <= g.w; x += c * 0.5) {
      const yy = top + Math.sin(t * 1.4 + x * 0.035) * c * 0.35 + Math.sin(t * 3.1 + x * 0.09) * c * 0.12;
      if (x === 0) ctx.moveTo(g.x + x, yy); else ctx.lineTo(g.x + x, yy);
    }
    ctx.stroke();
    // glints further out
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let x = 0; x < g.w; x += c * 3) {
      const ph = (t * 0.6 + x * 0.01) % 1;
      const yy = top + c * (0.9 + ph * 1.4);
      if (yy > bottom) continue;
      ctx.beginPath();
      ctx.ellipse(g.x + x + Math.sin(t + x) * c, yy, c * 0.7, c * 0.12, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** A whisper of grain over the whole valley, so no fill is perfectly flat. */
}

// ---------------------------------------------------------------- level thumbnails

const thumbs = new Map<string, HTMLCanvasElement>();

/**
 * A little painting of a valley for the level list.
 *
 * A row of grey cards with names on them tells a child nothing. The same valley they are about to
 * play, in miniature, tells them where the spring is, how many fields there are and whether a mill
 * is waiting - before they can read a word of it.
 */
export function levelThumb(level: Level, buildFn: (l: Level, size: { cols: number; rows: number }) => Valley, w: number, h: number): HTMLCanvasElement {
  const key = `${level.id}:${w}x${h}`;
  const had = thumbs.get(key);
  if (had) return had;
  const cv = document.createElement('canvas');
  cv.width = Math.max(8, Math.round(w));
  cv.height = Math.max(8, Math.round(h));
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const cols = 30, rows = Math.max(14, Math.round((30 * cv.height) / cv.width));
  const v = buildFn(level, { cols, rows });
  const art = new ValleyArt(v, level.seed);
  const g: Grid = { x: 0, y: 0, cell: cv.width / cols, w: cv.width, h: cv.height };
  art.paintGround(ctx, g, v);
  art.paintRocks(ctx, g);
  art.paintSea(ctx, g, v, 0);
  const c = g.cell;
  // where the water starts
  for (const [sx, sy] of level.springs) {
    const x = g.x + sx * cv.width, y = g.y + sy * cv.height;
    ctx.fillStyle = '#eafaff';
    ctx.beginPath(); ctx.arc(x, y, c * 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, c * 0.3);
    ctx.beginPath(); ctx.arc(x, y, c * 2.1, 0, TAU); ctx.stroke();
  }
  for (const f of level.fields) {
    const x = g.x + f.x * cv.width, y = g.y + f.y * cv.height;
    ctx.fillStyle = '#d9bd63';
    ctx.beginPath(); ctx.ellipse(x, y, c * 2.6, c * 2.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(92,64,38,0.8)';
    ctx.lineWidth = Math.max(0.8, c * 0.22);
    ctx.stroke();
  }
  for (const wh of level.wheels) {
    const x = g.x + wh.x * cv.width, y = g.y + wh.y * cv.height;
    ctx.strokeStyle = '#7a5130';
    ctx.lineWidth = Math.max(1, c * 0.34);
    ctx.beginPath(); ctx.arc(x, y, c * 1.9, 0, TAU); ctx.stroke();
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * c * 1.9, y + Math.sin(a) * c * 1.9);
      ctx.stroke();
    }
  }
  for (const [hx, hy] of level.houses) {
    const x = g.x + hx * cv.width, y = g.y + hy * cv.height;
    ctx.fillStyle = '#fff2dd';
    ctx.fillRect(x - c * 1.1, y - c * 0.4, c * 2.2, c * 1.6);
    ctx.fillStyle = '#c9563f';
    ctx.beginPath();
    ctx.moveTo(x - c * 1.4, y - c * 0.4);
    ctx.lineTo(x, y - c * 1.7);
    ctx.lineTo(x + c * 1.4, y - c * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  // a soft edge so the painting sits in the card rather than filling it like wallpaper
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.height * 0.95);
  vg.addColorStop(0, 'rgba(12,32,52,0)');
  vg.addColorStop(1, 'rgba(12,32,52,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  grainOver(ctx, 0, 0, cv.width, cv.height, 0.05);
  thumbs.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- the horizon

/**
 * A strip of sky and far hills above the valley.
 *
 * The valley is seen from above, so strictly there is no horizon at all. But a scene with nothing
 * beyond its own edge feels like a board, and the band of sky at the top is where the interface
 * lives anyway. Two ranges of hills, the far one hazier than the near one, give the valley
 * somewhere to be.
 */
export function paintHorizon(ctx: Ctx, w: number, inset: number, t: number, seed = 5): void {
  const sky = ctx.createLinearGradient(0, 0, 0, inset);
  sky.addColorStop(0, '#5fb7ec');
  sky.addColorStop(0.5, '#9fd9f3');
  sky.addColorStop(1, '#dff1df');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, inset);

  const noise = new ValueNoise(seed);
  const ranges = [
    { y: inset * 0.46, amp: inset * 0.3, colour: 'rgba(150, 186, 196, 0.7)', f: 0.0035, drift: 0 },
    { y: inset * 0.66, amp: inset * 0.34, colour: 'rgba(112, 158, 128, 0.85)', f: 0.006, drift: 40 },
    { y: inset * 0.88, amp: inset * 0.3, colour: '#5f9152', f: 0.009, drift: 90 },
  ];
  ranges.forEach((r, ri) => {
    ctx.fillStyle = r.colour;
    ctx.beginPath();
    ctx.moveTo(0, inset + 2);
    for (let x = 0; x <= w; x += 6) {
      const n = noise.fbm2((x + r.drift) * r.f, ri * 3.7, 3);
      ctx.lineTo(x, r.y - (n - 0.5) * r.amp * 2);
    }
    ctx.lineTo(w, inset + 2);
    ctx.closePath();
    ctx.fill();

    // a line of little trees along the nearest ridge, which is what makes it read as land
    if (ri === 2) {
      for (let x = 6; x < w; x += 17) {
        const n = noise.fbm2((x + r.drift) * r.f, ri * 3.7, 3);
        const ty = r.y - (n - 0.5) * r.amp * 2;
        const hh = inset * (0.09 + ((x * 7) % 5) / 42);
        ctx.fillStyle = '#4d7f48';
        ctx.beginPath();
        ctx.moveTo(x - hh * 0.4, ty + 1);
        ctx.quadraticCurveTo(x - hh * 0.32, ty - hh * 0.75, x, ty - hh);
        ctx.quadraticCurveTo(x + hh * 0.32, ty - hh * 0.75, x + hh * 0.4, ty + 1);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  // the hills throw a little shade onto the head of the valley
  const shade2 = ctx.createLinearGradient(0, inset, 0, inset + inset * 0.3);
  shade2.addColorStop(0, 'rgba(20, 44, 30, 0.26)');
  shade2.addColorStop(1, 'rgba(20, 44, 30, 0)');
  ctx.fillStyle = shade2;
  ctx.fillRect(0, inset, w, inset * 0.32);
}
