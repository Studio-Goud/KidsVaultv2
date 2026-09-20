/**
 * The rock above a fossil, and what it takes to get through it.
 *
 * A site is a grid of cells. Each holds how much rock is still on top of it and how hard that rock
 * is. Underneath, some cells have bone. Where the bone lies is read straight out of the photograph
 * of the real specimen, so what you chip is exactly what you can see: a cell counts as bone when
 * its patch of the picture stands well clear of the background, which works both for a pale
 * skeleton against a dark museum wall and for a dark ink plate on white paper.
 *
 * That is the whole tension of the game. Hard rock needs a heavy tool, a heavy tool over bone
 * breaks it, and you cannot see the bone until you are nearly through.
 */

import { makeRng, ValueNoise } from '../../util/rng';

export interface Tool {
  id: 'brush' | 'chisel' | 'hammer' | 'scribe';
  name: string;
  nameNl: string;
  /** hardest rock it can move, 0..1 */
  maxHard: number;
  /** how many cells across it works, in cell widths */
  radius: number;
  /** rock removed per stroke */
  bite: number;
  /** stamina per stroke */
  cost: number;
  /** chance of chipping bone when the last layer over bone is taken off */
  risk: number;
  /** how many finds you need before it is yours */
  unlockAt: number;
}

/**
 * The budget is set so that a player who picks the right tool for the rock finishes a site with
 * roughly a third of the daylight still in hand, and a player who chisels everything runs out.
 */
export const TOOLS: Tool[] = [
  { id: 'brush', name: 'Brush', nameNl: 'Kwast', maxHard: 0.34, radius: 2.2, bite: 1, cost: 0.0015, risk: 0, unlockAt: 0 },
  { id: 'chisel', name: 'Chisel', nameNl: 'Beitel', maxHard: 0.68, radius: 1.7, bite: 1, cost: 0.0025, risk: 0.05, unlockAt: 0 },
  { id: 'hammer', name: 'Hammer', nameNl: 'Hamer', maxHard: 1.01, radius: 2.4, bite: 2, cost: 0.0055, risk: 0.4, unlockAt: 1 },
  { id: 'scribe', name: 'Air scribe', nameNl: 'Pen', maxHard: 1.01, radius: 1.1, bite: 2, cost: 0.0075, risk: 0, unlockAt: 4 },
];

export const toolById = (id: string): Tool => TOOLS.find(t => t.id === id) ?? TOOLS[0];

/** How deep the rock goes. Two layers: one to break the surface, one to reach the bone. */
export const MAX_DEPTH = 2;

export interface Site {
  cols: number;
  rows: number;
  /** rock still on top, 0 means clear */
  depth: Uint8Array;
  /** 0 soft to 1 hard */
  hard: Float32Array;
  /** 1 where bone lies underneath */
  bone: Uint8Array;
  /** 1 where bone has been chipped */
  chip: Uint8Array;
  /** how many bone cells there are */
  boneCount: number;
}

/**
 * Read the bone mask out of the prepared fossil image.
 *
 * The background of a museum photograph and the paper of an ink plate are both the most common
 * tone in the picture, so anything far from that tone is the specimen.
 */
export function boneMaskFrom(photo: HTMLCanvasElement, cols: number, rows: number): { mask: Uint8Array; count: number } {
  const ctx = photo.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, photo.width, photo.height);
  const px = img.data;

  // the most common brightness, in 16 buckets, stands in for the background
  const hist = new Array(16).fill(0);
  for (let i = 0; i < px.length; i += 16) {
    const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    hist[Math.min(15, Math.floor(l / 16))]++;
  }
  let bg = 0;
  for (let i = 1; i < 16; i++) if (hist[i] > hist[bg]) bg = i;
  const bgLuma = bg * 16 + 8;

  const mask = new Uint8Array(cols * rows);
  let count = 0;
  const cw = photo.width / cols, ch = photo.height / rows;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      // sample a handful of points in the cell rather than every pixel
      let hits = 0, taken = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const x = Math.floor((gx + (sx + 0.5) / 3) * cw);
          const y = Math.floor((gy + (sy + 0.5) / 3) * ch);
          if (x < 0 || y < 0 || x >= photo.width || y >= photo.height) continue;
          const i = (y * photo.width + x) * 4;
          const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          taken++;
          if (Math.abs(l - bgLuma) > 46) hits++;
        }
      }
      if (taken && hits / taken >= 0.45) { mask[gy * cols + gx] = 1; count++; }
    }
  }
  return { mask, count };
}

/** Lay rock over a fossil: harder in bands, and hardest where the species says so. */
export function buildSite(cols: number, rows: number, seed: number, hardness: number, photo: HTMLCanvasElement | null): Site {
  const n = cols * rows;
  const depth = new Uint8Array(n).fill(MAX_DEPTH);
  const hard = new Float32Array(n);
  const noise = new ValueNoise(seed);
  const rng = makeRng(seed * 31 + 7);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      // bands of stone running through the site, plus a little grain.
      // fbm2 already returns 0..1, so it is used as it comes: doubling it once put every cell
      // above what a brush can move, and the game could not be started at all.
      const band = noise.fbm2(gx * 0.11, gy * 0.26, 3);
      const grain = rng() * 0.14 - 0.07;
      hard[gy * cols + gx] = Math.max(0, Math.min(1, (band - 0.12) * (0.75 + hardness * 0.75) + grain + hardness * 0.12));
    }
  }
  const bone = new Uint8Array(n);
  let boneCount = 0;
  if (photo) { const m = boneMaskFrom(photo, cols, rows); bone.set(m.mask); boneCount = m.count; }
  // the rock directly over bone never gets harder than a chisel can manage, so a careful player can
  // always free the whole specimen. The hammer is then a temptation, not a requirement: faster and
  // wider through the bulk, and the thing that breaks what you came for.
  for (let i = 0; i < n; i++) if (bone[i] && hard[i] > 0.64) hard[i] = 0.64;
  return { cols, rows, depth, hard, bone, chip: new Uint8Array(n), boneCount };
}

export interface StrokeResult {
  removed: number;
  chipped: number;
  uncovered: number;
  blocked: boolean;
  /** true when a heavy tool landed on bone that was already bare, which is never an accident */
  onBare: boolean;
}

/** One touch of a tool at a cell position. */
export function strike(site: Site, tool: Tool, cx: number, cy: number, rng: () => number): StrokeResult {
  const out: StrokeResult = { removed: 0, chipped: 0, uncovered: 0, blocked: false, onBare: false };
  const r = tool.radius;
  for (let gy = Math.floor(cy - r); gy <= Math.ceil(cy + r); gy++) {
    for (let gx = Math.floor(cx - r); gx <= Math.ceil(cx + r); gx++) {
      if (gx < 0 || gy < 0 || gx >= site.cols || gy >= site.rows) continue;
      if (Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) > r) continue;
      const i = gy * site.cols + gx;
      if (site.depth[i] === 0) {
        // The rock here is already off. Swinging a heavy tool at bare bone used to cost nothing
        // at all, so hammering the same spot over and over was free. It is not: the bone is what
        // breaks. The brush and the air scribe carry no risk, so careful work stays safe.
        // squared, so the hammer is plainly dangerous here and the chisel is all but safe: a
        // child dragging the careful tool across finished bone should not be punished for it
        if (site.bone[i] && !site.chip[i] && tool.risk > 0 && rng() < tool.risk * tool.risk * 1.8) {
          site.chip[i] = 1;
          out.chipped++;
          out.onBare = true;
        }
        continue;
      }
      if (site.hard[i] > tool.maxHard) { out.blocked = true; continue; }
      const before = site.depth[i];
      site.depth[i] = Math.max(0, before - tool.bite);
      out.removed += before - site.depth[i];
      if (site.depth[i] === 0 && site.bone[i]) {
        out.uncovered++;
        // the last layer is the dangerous one: a heavy tool can take the bone with it
        if (tool.risk > 0 && !site.chip[i] && rng() < tool.risk) { site.chip[i] = 1; out.chipped++; }
      }
    }
  }
  return out;
}

/** How much of the specimen is out of the rock, and how much of it survived. */
export function progress(site: Site): { exposed: number; chipped: number } {
  let clear = 0, chipped = 0;
  for (let i = 0; i < site.bone.length; i++) {
    if (!site.bone[i]) continue;
    if (site.depth[i] === 0) clear++;
    if (site.chip[i]) chipped++;
  }
  return { exposed: site.boneCount ? clear / site.boneCount : 0, chipped };
}

/** Stars for a finished dig: how much you exposed, and how little you broke. */
export function starsFor(exposed: number, chipped: number, boneCount: number): number {
  if (exposed < 0.55) return 0;
  const damage = boneCount ? chipped / boneCount : 0;
  if (exposed >= 0.9 && damage <= 0.01) return 3;
  if (exposed >= 0.75 && damage <= 0.05) return 2;
  return 1;
}
