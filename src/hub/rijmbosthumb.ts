/** A forest clearing with an animal holding up two picture cards, for the hub card (120x90). */

import { drawAnimal, drawCard, paintClearing } from '../games/rijmbos/paint';

/** `fit` in thumbs.ts is not exported, so its few lines are repeated here. */
function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawRhymeThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  paintClearing(ctx, w, h, 0);
  drawAnimal(ctx, 'bear', w * 0.5, h * 0.3, h * 0.17, 0, 0);
  drawCard(ctx, 'mouse', w * 0.3, h * 0.72, h * 0.4);
  drawCard(ctx, 'house', w * 0.7, h * 0.72, h * 0.4);
}
