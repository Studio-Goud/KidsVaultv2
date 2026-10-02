/**
 * The hub card for Schaduwspel: a lamp, a teapot, and its shadow on a wall.
 *
 * Self contained like the rest of src/hub/thumbs.ts (its `fit` is not exported, so the few lines are
 * copied); it borrows the model and the painting from the game because a card that shows a different
 * teapot than the game does is worse than no card.
 */

import { objectById, project } from '../games/schaduw/model';
import { drawBeam, drawLamp, drawObject, drawRoom, drawShadow, drawTarget, drawTurntable, drawWall } from '../games/schaduw/paint';

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawShadowThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const size = h * 0.74;
  const panel = { x: w - size - h * 0.1, y: (h - size) / 2, size };
  const lampX = w * 0.1, lampY = h * 0.5;
  drawRoom(ctx, w, h, lampX, lampY, 1);
  drawBeam(ctx, lampX + 4, lampY, panel.x, panel.y, size, 1);
  drawLamp(ctx, lampX, lampY, h * 0.13, h * 0.9, 0);
  const k = h * 0.2, ox = (lampX + panel.x) / 2 + 2, oy = h * 0.46;
  drawTurntable(ctx, ox, oy + k * 0.96, k * 1.2, 0.6);
  const teapot = objectById('teapot');
  drawObject(ctx, teapot, 0.6, 0, ox, oy, k);
  drawWall(ctx, panel, 0);
  const s = project(teapot, 0.6, 0);
  drawTarget(ctx, s, panel, 1, false, 0);
  drawShadow(ctx, s, panel, dpr);
}
