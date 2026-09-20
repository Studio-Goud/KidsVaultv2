/**
 * To scale: the part of the solar system that no diagram in a schoolbook ever shows honestly.
 *
 * Two strips, each true to one thing at a time, because no single picture can be true to both.
 * The upper strip puts the planets at their real distances, and everything inside Mars bunches up
 * against the sun while Neptune sits far away on its own. The lower strip puts them at their real
 * sizes, and Jupiter dwarfs everything the upper strip made look important.
 *
 * Saying out loud that the two cannot be combined is the lesson, so the screen says it.
 */

import { TAU } from '../../util/math';
import { BODIES, type Body } from './bodies';
import { drawBody, reachOf } from './draw';
import { drawSun } from './draw';

type Ctx = CanvasRenderingContext2D;

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (b: Body): string => (NL() ? b.nameNl : b.name);

export function drawScale(
  ctx: Ctx, time: number, w: number, h: number, u: number, dpr: number,
  font: (weight: string, size: number) => string,
): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf2ff'; ctx.font = font('900', 21);
  ctx.fillText(T('The real thing', 'Hoe het echt is'), w / 2, 62 * u);
  ctx.fillStyle = 'rgba(214,228,255,0.68)'; ctx.font = font('700', 12);
  ctx.fillText(T('No picture can be honest about size and distance at once.',
    'Geen plaatje kan tegelijk eerlijk zijn over grootte en afstand.'), w / 2, 84 * u, w - 30 * u);

  const left = 56 * u, right = w - 20 * u, span = right - left;
  const far = BODIES[BODIES.length - 1].distance;

  // --- distances ---
  const dy = h * 0.33;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(200,216,244,0.55)'; ctx.font = font('800', 9.5);
  ctx.fillText(T('AT THEIR REAL DISTANCE', 'OP HUN ECHTE AFSTAND'), 18 * u, dy - 68 * u);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
  ctx.setLineDash([3, 8]);
  ctx.beginPath(); ctx.moveTo(left, dy); ctx.lineTo(right, dy); ctx.stroke();
  ctx.setLineDash([]);
  drawSun(ctx, 22 * u, dy, 13 * u, time);

  // every planet gets the same small dot here, because this strip is about where, not how big
  const dot = 4.6 * u;
  let lastLabelX = -1e9;
  for (const b of BODIES) {
    const x = left + (b.distance / far) * span;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath(); ctx.arc(x, dy, dot, 0, TAU); ctx.fill();
    // labels crowd together near the sun, so only draw one where there is room
    if (x - lastLabelX > 46 * u) {
      ctx.save();
      ctx.translate(x, dy - 12 * u); ctx.rotate(-Math.PI / 2.6);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(226,236,255,0.8)'; ctx.font = font('800', 9);
      ctx.fillText(nameOf(b), 0, 0);
      ctx.restore();
      lastLabelX = x;
    }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,216,244,0.55)'; ctx.font = font('700', 9.5);
  ctx.fillText(T('The four rocky planets are all squeezed into that first stretch.',
    'De vier rotsplaneten zitten allemaal geperst in dat eerste stukje.'), w / 2, dy + 34 * u, w - 30 * u);

  // --- sizes ---
  const sy = h * 0.68;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(200,216,244,0.55)'; ctx.font = font('800', 9.5);
  ctx.fillText(T('AT THEIR REAL SIZE', 'OP HUN ECHTE GROOTTE'), 18 * u, sy - 74 * u);

  // scale so the widest body, Saturn with its rings, just fits the row
  const biggest = Math.max(...BODIES.map(b => b.diameter));
  let k = (w - 40 * u) / BODIES.reduce((s, b) => s + (b.diameter / biggest) * reachOf(b) * 2 + 6 * u, 0);
  const rFor = (b: Body): number => Math.max(1.6 * u, (b.diameter / biggest) * 52 * u * k * 1.0);
  // a second pass keeps the row inside the screen whatever the photographs report
  const total = BODIES.reduce((s, b) => s + rFor(b) * reachOf(b) * 2 + 6 * u, 0);
  if (total > w - 30 * u) k *= (w - 30 * u) / total;

  let x = (w - BODIES.reduce((s, b) => s + rFor(b) * reachOf(b) * 2 + 6 * u, 0)) / 2;
  for (const b of BODIES) {
    const r = rFor(b), half = r * reachOf(b);
    drawBody(ctx, b, x + half, sy, r, dpr);
    x += half * 2 + 6 * u;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,216,244,0.55)'; ctx.font = font('700', 9.5);
  ctx.fillText(T('Jupiter and Saturn hold almost all of it.',
    'Jupiter en Saturnus bevatten er bijna alles van.'), w / 2, sy + 62 * u, w - 30 * u);

  ctx.textAlign = 'left';
}
