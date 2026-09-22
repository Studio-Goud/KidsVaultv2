import { hexA } from '../render/look';

type Ctx = CanvasRenderingContext2D;

/**
 * What progress looks like, everywhere in Braambos.
 *
 * Six games with six ideas of what "doing well" looks like is how a collection stays a collection.
 * These two marks are the whole vocabulary, and they are deliberately not points, coins, badges or
 * a rank against anybody:
 *
 *  - a ring that fills as one subject gets firm, drawn on that subject's own card, which answers
 *    "how am I doing at the tables" where the question is asked;
 *  - a slow gold breath around the one thing worth doing next, which is an invitation. Never a
 *    lock, never a nag, and never the thing a child is worst at.
 *
 * Neither of them can go down, neither of them says anything about the child, and there is nothing
 * to collect. A child who wants to play the tables for the ninth time may.
 */

/** How firm the ground is under one subject: a ring that fills clockwise from the top. */
export function masteryRing(
  ctx: Ctx, cx: number, cy: number, r: number, level: number, u: number,
): void {
  const v = level < 0 ? 0 : level > 1 ? 1 : level;
  ctx.save();
  ctx.lineWidth = 3.4 * u;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(12,32,52,0.28)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  if (v > 0.001) {
    ctx.strokeStyle = '#4fbf7a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
    ctx.stroke();
  }
  ctx.restore();
}

/** The one worth doing next, breathing gold around its card. */
export function nextRing(
  ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, t: number, u: number,
): void {
  ctx.save();
  ctx.strokeStyle = hexA('#f0a92c', 0.7 + Math.sin(t * 2.1) * 0.3);
  ctx.lineWidth = 4.5 * u;
  ctx.shadowColor = 'rgba(240,169,44,0.5)';
  ctx.shadowBlur = 10 * u;
  ctx.beginPath(); ctx.roundRect(x - 3 * u, y - 3 * u, w + 6 * u, h + 6 * u, radius);
  ctx.stroke();
  ctx.restore();
}
