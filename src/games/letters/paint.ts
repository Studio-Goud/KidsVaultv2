/**
 * The look of Letterbos: a clearing in a wood, and the wooden tiles the words are built out of.
 *
 * Two decisions here are doing teaching rather than decoration.
 *
 * A tile is coloured by what kind of sound is on it: the vowels warm, the consonants cool. Dutch
 * reading methods mark the klinkers apart from the medeklinkers for a reason - a word is a run of
 * consonants around a vowel, and seeing that shape before you can read it is most of the way to
 * reading it. The colour is never the answer to anything, so a child who ignores it loses nothing.
 *
 * And a tile with two letters on it - `aa`, `ui`, `ij` - carries a tie under the letters, the way
 * a teacher draws one on the board. It says: these two are holding hands, they are one sound. That
 * mark is the whole of levels two and three in a single stroke of ink.
 */

import { TAU } from '../../util/math';
import { contactShadow, grainOver, mix, roundRectPath, shade } from '../../render/look';
import { isVowelUnit } from './phonics';

type Ctx = CanvasRenderingContext2D;

export const WOOD_TONE = '#c79a5e';
export const VOWEL_TONE = '#f0b45e';
export const CONSONANT_TONE = '#9fc3d8';
export const INK = '#2d3e2a';

export interface TileLook {
  /** lifted under the finger */
  held?: boolean;
  /** just landed, or bouncing back */
  pop?: number;
  /** the one being pointed at after a mistake */
  glow?: number;
  /** greyed out: a tile already used */
  spent?: boolean;
  /** green when it went in right, red when it did not */
  mood?: 'none' | 'right' | 'wrong';
  /** a whole word rather than a sound, which needs room for the letters rather than a big face */
  wordTile?: boolean;
}

/** The colour of a tile, which is the kind of sound on it. */
export function toneFor(unit: string, wordTile = false): string {
  if (wordTile) return '#e8dcc0';
  return isVowelUnit(unit) ? VOWEL_TONE : CONSONANT_TONE;
}

/**
 * One tile, with its letters on it.
 *
 * The letters are fitted to the tile rather than set at a fixed size, so `sch` and `m` are the
 * same tile with the same weight of ink on it.
 */
export function drawTile(ctx: Ctx, x: number, y: number, w: number, h: number, unit: string, look: TileLook = {}): void {
  const pop = look.pop ?? 1;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.translate(-cx, -cy);

  let tone = toneFor(unit, look.wordTile);
  if (look.mood === 'right') tone = mix(tone, '#4fae6e', 0.55);
  if (look.mood === 'wrong') tone = mix(tone, '#e0664a', 0.55);
  if (look.spent) tone = mix(tone, '#cfd8dd', 0.7);

  const lift = look.held ? h * 0.1 : 0;
  const r = h * 0.22;
  contactShadow(ctx, cx, y + h + lift * 0.6, w * 0.5, h * 0.14, look.held ? 0.34 : 0.24);

  if (look.glow) {
    ctx.save();
    ctx.globalAlpha = look.glow;
    ctx.fillStyle = 'rgba(255, 216, 115, 0.85)';
    roundRectPath(ctx, x - 7, y - 7 - lift, w + 14, h + 14, r + 5);
    ctx.fill();
    ctx.restore();
  }

  // the edge of the wood under the face, so a tile has a thickness
  ctx.fillStyle = shade(tone, -0.34);
  roundRectPath(ctx, x, y - lift + h * 0.07, w, h, r);
  ctx.fill();

  const g = ctx.createLinearGradient(0, y - lift, 0, y - lift + h);
  g.addColorStop(0, shade(tone, 0.22));
  g.addColorStop(0.55, tone);
  g.addColorStop(1, shade(tone, -0.1));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y - lift, w, h, r);
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, x, y - lift, w, h, r);
  ctx.clip();
  grainOver(ctx, x, y - lift, w, h, 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRectPath(ctx, x + w * 0.08, y - lift + h * 0.08, w * 0.84, h * 0.26, h * 0.16);
  ctx.fill();
  ctx.restore();

  drawUnitText(ctx, unit, x, y - lift, w, h, look.spent ? 'rgba(45,62,42,0.45)' : INK, look.wordTile);
  ctx.restore();
}

/**
 * The letters themselves, and the tie under a two-letter sound.
 *
 * The tie is drawn as a shallow arc that starts under the first letter and ends under the last,
 * with a short stalk in the middle - the mark a teacher makes under *aa* to say "one sound".
 */
export function drawUnitText(ctx: Ctx, unit: string, x: number, y: number, w: number, h: number, ink: string, wordTile = false): void {
  const tie = !wordTile && unit.length > 1;
  const size = wordTile
    ? Math.min(h * 0.46, (w * 0.86) / Math.max(2.2, unit.length * 0.62))
    : Math.min(h * (tie ? 0.52 : 0.62), (w * 0.82) / Math.max(1, unit.length * 0.62));
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `900 ${Math.round(size)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const baseline = y + h / 2 + size * (tie ? 0.24 : 0.36);
  ctx.fillText(unit, x + w / 2, baseline, w * 0.88);
  if (tie) {
    const tw = Math.min(ctx.measureText(unit).width, w * 0.88);
    const ty = baseline + size * 0.22;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, size * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - tw / 2, ty);
    ctx.quadraticCurveTo(x + w / 2, ty + size * 0.2, x + w / 2 + tw / 2, ty);
    ctx.stroke();
  }
  ctx.restore();
}

export interface SlotLook {
  filled?: string | null;
  glow?: number;
  mood?: 'none' | 'right' | 'wrong';
  /** the slot the question is about, on an ei/ij question */
  focus?: boolean;
  wordTile?: boolean;
}

/** An empty place in the word: a dished hollow in the plank, with a dashed edge. */
export function drawSlot(ctx: Ctx, x: number, y: number, w: number, h: number, look: SlotLook = {}): void {
  if (look.filled) {
    drawTile(ctx, x, y, w, h, look.filled, { mood: look.mood, glow: look.glow, wordTile: look.wordTile });
    return;
  }
  const r = h * 0.22;
  ctx.save();
  if (look.glow) {
    ctx.save();
    ctx.globalAlpha = look.glow;
    ctx.fillStyle = 'rgba(255, 216, 115, 0.9)';
    roundRectPath(ctx, x - 7, y - 7, w + 14, h + 14, r + 5);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(58, 44, 28, 0.2)';
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = look.focus ? 'rgba(224, 102, 74, 0.9)' : 'rgba(255, 253, 245, 0.85)';
  ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.setLineDash([h * 0.16, h * 0.12]);
  roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, r);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * The card the picture sits on.
 *
 * It is a photograph in a frame hung in a wood, because the picture is the question: everything
 * else on screen is an answer to it, and it has to be the loudest thing on the screen.
 */
export function drawFrame(ctx: Ctx, x: number, y: number, w: number, h: number, pop = 1): { x: number; y: number; w: number; h: number } {
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.translate(-cx, -cy);
  ctx.save();
  ctx.shadowColor = 'rgba(30, 40, 20, 0.34)';
  ctx.shadowBlur = h * 0.18;
  ctx.shadowOffsetY = h * 0.05;
  ctx.fillStyle = '#fffdf4';
  roundRectPath(ctx, x, y, w, h, h * 0.12);
  ctx.fill();
  ctx.restore();
  const pad = Math.min(w, h) * 0.06;
  ctx.fillStyle = '#e3edd6';
  roundRectPath(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, h * 0.09);
  ctx.fill();
  ctx.restore();
  return { x: x + pad * 1.2, y: y + pad * 1.2, w: w - pad * 2.4, h: h - pad * 2.4 };
}

/**
 * The wood itself: a clearing with trees standing back from it and a path of light down the
 * middle. It never changes, so it is drawn straight rather than cached - it is a dozen paths.
 */
export function drawWood(ctx: Ctx, w: number, h: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bfe4d2');
  sky.addColorStop(0.45, '#dff0e0');
  sky.addColorStop(0.72, '#cfe6b8');
  sky.addColorStop(1, '#a8cb84');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // light coming down through the leaves, from the top left like everywhere else
  const beam = ctx.createLinearGradient(w * 0.1, 0, w * 0.55, h * 0.8);
  beam.addColorStop(0, 'rgba(255, 246, 200, 0.5)');
  beam.addColorStop(1, 'rgba(255, 246, 200, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, w, h);

  // the trees, behind everything, at the two edges so the middle stays clear to play in
  const trunks: Array<[number, number]> = [
    [0.03, 1], [0.15, 0.62], [0.95, 0.95], [0.82, 0.58], [0.44, 0.3], [0.68, 0.34],
  ];
  for (const [fx, s] of trunks) {
    const x = fx * w, tw = 16 * s * (w / 390 + 0.6);
    const top = h * (0.06 - 0.04 * s);
    // the further back a tree is the more of the air is in front of it, so it fades out - and the
    // ones behind the cards fade almost away rather than striping the screen
    ctx.fillStyle = `rgba(122, 92, 58, ${0.1 + 0.46 * s * s})`;
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, h * 0.72);
    ctx.lineTo(x - tw * 0.32, top);
    ctx.lineTo(x + tw * 0.32, top);
    ctx.lineTo(x + tw / 2, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(74, 124, 66, ${0.12 + 0.38 * s * s})`;
    const cr = tw * (2.4 + s);
    ctx.beginPath();
    ctx.arc(x, top + cr * 0.2, cr, 0, TAU);
    ctx.fill();
  }

  // the floor of the clearing
  ctx.fillStyle = '#8fb96a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.72, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 160, 86, 0.6)';
  for (let i = 0; i < 26; i++) {
    const x = ((i * 137) % 100) / 100 * w;
    const y = h * (0.8 + ((i * 37) % 18) / 100);
    ctx.fillRect(x, y, 2, 5);
  }
  // two leaves drifting, so the wood is not a photograph
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.06 + i * 0.37) % 1);
    const x = w * (0.12 + i * 0.36) + Math.sin(t * 0.9 + i) * w * 0.06;
    const y = h * (0.1 + p * 0.78);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = i % 2 ? '#e8a13c' : '#8fbe5e';
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 3.4, t * 1.2 + i, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  grainOver(ctx, 0, 0, w, h, 0.045);
}
