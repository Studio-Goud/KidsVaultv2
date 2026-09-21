/**
 * The clock face.
 *
 * One drawing, used at every size in the game: the big face you read and drag, the small faces you
 * pick between, and the stamp on a level card. Everything about it is canvas paths in the house
 * light - sun from the top left, a shadow under the hands, a rim that catches it along the top.
 *
 * Three things here are not decoration:
 *  - the hour hand sits at `(h + m/60)` of a turn, so at half past three it is genuinely halfway
 *    between the three and the four. That is the single most common mistake in reading a clock and
 *    a face that hides it cannot teach it;
 *  - the hands are drawn at the proportions a real clock uses - the minute hand reaches the minute
 *    ring, the hour hand stops well short of the numerals - so which is which is a matter of
 *    looking rather than remembering;
 *  - the minute numbers can be switched on. A beginner counting round in fives needs them; a child
 *    who can already count in fives should not have them.
 */

import { TAU } from '../../util/math';
import { contactShadow, grainOver, LIGHT, mix, shade } from '../../render/look';
import { handAngles } from './dutchtime';

type Ctx = CanvasRenderingContext2D;

export interface FaceOptions {
  /** the hands */
  h: number;
  m: number;
  /** the 5, 10, 15 ring outside the numerals, for beginners */
  minuteNumbers?: boolean;
  /** a second pair of hands behind the first, to show what the answer should have been */
  ghost?: { h: number; m: number } | null;
  /** 'hour' or 'minute' lit up, for the moment the clock explains itself */
  highlight?: 'hour' | 'minute' | null;
  /** which hand the finger is on */
  dragging?: 'hour' | 'minute' | null;
  /** green when right, red when wrong */
  mood?: 'none' | 'right' | 'wrong';
  /** small faces skip the numerals below this radius */
  compact?: boolean;
  /** 0..1, the card sliding in */
  pop?: number;
}

const CASE_A = '#f6c96a';
const CASE_B = '#c98a2c';
const DIAL = '#fffaf0';
const INK = '#20415c';

/** How long each hand is, as a fraction of the dial radius. A real clock, near enough. */
export const HOUR_LEN = 0.55;
export const MINUTE_LEN = 0.82;

/** The dial inside the case. Everything else is measured from this. */
export const dialRadius = (r: number): number => r * 0.86;

export function drawClockFace(ctx: Ctx, cx: number, cy: number, r: number, o: FaceOptions): void {
  const dr = dialRadius(r);
  const compact = o.compact ?? r < 64;

  ctx.save();
  contactShadow(ctx, cx, cy + r * 0.98, r * 0.92, r * 0.2, 0.3);

  // the case: a brass ring lit from the top left
  const rim = ctx.createLinearGradient(cx + LIGHT.x * r, cy + LIGHT.y * r, cx - LIGHT.x * r, cy - LIGHT.y * r);
  rim.addColorStop(0, shade(CASE_A, 0.3));
  rim.addColorStop(0.45, CASE_A);
  rim.addColorStop(1, CASE_B);
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(96, 58, 10, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.018);
  ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();

  // the dial, very slightly domed
  const dial = ctx.createRadialGradient(cx + LIGHT.x * dr * 0.5, cy + LIGHT.y * dr * 0.5, dr * 0.1, cx, cy, dr);
  dial.addColorStop(0, '#ffffff');
  dial.addColorStop(0.7, DIAL);
  dial.addColorStop(1, '#eadfcb');
  ctx.fillStyle = dial;
  ctx.beginPath(); ctx.arc(cx, cy, dr, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, dr, 0, TAU); ctx.clip();
  grainOver(ctx, cx - dr, cy - dr, dr * 2, dr * 2, 0.05);
  ctx.restore();

  // a soft wash over half the dial, so the glass has a direction
  if (!compact) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, dr, 0, TAU); ctx.clip();
    const glass = ctx.createLinearGradient(cx - dr, cy - dr, cx + dr * 0.4, cy + dr);
    glass.addColorStop(0, 'rgba(255,255,255,0.55)');
    glass.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    glass.addColorStop(1, 'rgba(180, 200, 220, 0.12)');
    ctx.fillStyle = glass;
    ctx.fillRect(cx - dr, cy - dr, dr * 2, dr * 2);
    ctx.restore();
  }

  drawTicks(ctx, cx, cy, dr, compact);
  if (!compact) drawNumerals(ctx, cx, cy, dr, r);
  if (o.minuteNumbers && !compact) drawMinuteNumbers(ctx, cx, cy, dr, r);

  // the answer, faint, behind the hands you got wrong
  if (o.ghost) {
    const g = handAngles(o.ghost.h, o.ghost.m);
    ctx.save();
    ctx.globalAlpha = 0.38;
    hand(ctx, cx, cy, dr * HOUR_LEN, g.hour, dr * 0.085, '#4f9b62', false);
    hand(ctx, cx, cy, dr * MINUTE_LEN, g.minute, dr * 0.055, '#4f9b62', false);
    ctx.restore();
  }

  const a = handAngles(o.h, o.m);
  // the wedge that says which hour the short hand is inside
  if (o.highlight === 'hour') hourWedge(ctx, cx, cy, dr, o.h, o.m);
  if (o.highlight === 'minute') minuteMark(ctx, cx, cy, dr, o.m);

  const hourTone = o.highlight === 'hour' ? '#e0642f' : INK;
  const minTone = o.highlight === 'minute' ? '#e0642f' : mix(INK, '#2f6d94', 0.5);
  hand(ctx, cx, cy, dr * HOUR_LEN, a.hour, dr * 0.085, hourTone, o.dragging === 'hour');
  hand(ctx, cx, cy, dr * MINUTE_LEN, a.minute, dr * 0.055, minTone, o.dragging === 'minute');

  // the boss in the middle, over both hands
  const cap = dr * 0.07;
  ctx.fillStyle = shade(CASE_B, 0.2);
  ctx.beginPath(); ctx.arc(cx, cy, cap, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.arc(cx - cap * 0.3, cy - cap * 0.35, cap * 0.38, 0, TAU); ctx.fill();

  // right or wrong, as a ring round the whole clock
  if (o.mood === 'right' || o.mood === 'wrong') {
    ctx.strokeStyle = o.mood === 'right' ? 'rgba(88, 190, 118, 0.95)' : 'rgba(224, 108, 88, 0.95)';
    ctx.lineWidth = Math.max(3, r * 0.05);
    ctx.beginPath(); ctx.arc(cx, cy, r + ctx.lineWidth * 0.7, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/** Sixty ticks, with every fifth one long and heavy, which is what makes counting in fives work. */
function drawTicks(ctx: Ctx, cx: number, cy: number, dr: number, compact: boolean): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    if (compact && !big) continue;
    const a = (i / 60) * TAU - Math.PI / 2;
    const r0 = dr * (big ? 0.845 : 0.885);
    const r1 = dr * 0.945;
    ctx.strokeStyle = big ? 'rgba(32, 65, 92, 0.9)' : 'rgba(32, 65, 92, 0.38)';
    ctx.lineWidth = Math.max(1, dr * (big ? 0.035 : 0.014));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNumerals(ctx: Ctx, cx: number, cy: number, dr: number, r: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.font = `900 ${Math.round(r * 0.17)}px Nunito, system-ui, sans-serif`;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const rr = dr * 0.71;
    ctx.fillText(String(i), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + r * 0.006);
  }
  ctx.restore();
}

/** The 5, 10, 15 ring: the minute the long hand is pointing at, spelled out for a beginner. */
function drawMinuteNumbers(ctx: Ctx, cx: number, cy: number, dr: number, r: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c1622c';
  ctx.font = `800 ${Math.round(r * 0.085)}px Nunito, system-ui, sans-serif`;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const rr = dr * 0.5;
    ctx.fillText(String((i * 5) % 60), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.restore();
}

/**
 * The slice of dial the short hand is inside, from the hour it has left to the one it is heading
 * for. Shown after a wrong answer: it turns "somewhere between the three and the four" into a
 * shape, and the number it started from is the hour.
 */
function hourWedge(ctx: Ctx, cx: number, cy: number, dr: number, h: number, m: number): void {
  const hour = ((Math.floor(h) % 12) + 12) % 12;
  const a0 = (hour / 12) * TAU - Math.PI / 2;
  const a1 = ((hour + 1) / 12) * TAU - Math.PI / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(224, 100, 47, 0.16)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, dr * 0.82, a0, a1);
  ctx.closePath();
  ctx.fill();
  // the number it has left is the hour, so that one is circled
  ctx.strokeStyle = 'rgba(224, 100, 47, 0.9)';
  ctx.lineWidth = Math.max(2, dr * 0.024);
  const rr = dr * 0.71;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, dr * 0.15, 0, TAU);
  ctx.stroke();
  void m;
  ctx.restore();
}

/** The tick the long hand is on, ringed, for the half of the lesson that is about minutes. */
function minuteMark(ctx: Ctx, cx: number, cy: number, dr: number, m: number): void {
  const a = (m / 60) * TAU - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(224, 100, 47, 0.9)';
  ctx.lineWidth = Math.max(2, dr * 0.024);
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * dr * 0.9, cy + Math.sin(a) * dr * 0.9, dr * 0.1, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * One hand: a tapered blade with a counterweight behind the pivot, a shadow under it, and a
 * brighter core along the lit side. Drawn from twelve, rotated to where it belongs.
 */
function hand(ctx: Ctx, cx: number, cy: number, len: number, angle: number, width: number, tone: string, lifted: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const w = width * (lifted ? 1.22 : 1);
  const l = len * (lifted ? 1.02 : 1);
  ctx.shadowColor = 'rgba(20, 40, 60, 0.35)';
  ctx.shadowBlur = w * 1.6;
  ctx.shadowOffsetX = w * 0.35;
  ctx.shadowOffsetY = w * 0.5;
  const blade = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, -l);                       // the tip
    ctx.lineTo(w * 0.5, -l + w * 1.6);
    ctx.lineTo(w * 0.52, w * 1.2);
    ctx.lineTo(-w * 0.52, w * 1.2);
    ctx.lineTo(-w * 0.5, -l + w * 1.6);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, shade(tone, 0.28));
  g.addColorStop(0.5, tone);
  g.addColorStop(1, shade(tone, -0.22));
  ctx.fillStyle = g;
  blade();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // the counterweight, which is what stops a hand looking like a needle stuck on a dot
  ctx.beginPath();
  ctx.arc(0, w * 1.5, w * 0.95, 0, TAU);
  ctx.fill();
  if (lifted) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, w * 0.25);
    blade();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The digital clock: a card with figures on it, the shape of a bedside clock rather than a label.
 * Returns nothing; it is drawn centred on (cx, cy).
 */
export function drawDigital(ctx: Ctx, cx: number, cy: number, w: number, h: number, text: string, tone = '#123047'): void {
  ctx.save();
  contactShadow(ctx, cx, cy + h * 0.6, w * 0.45, h * 0.16, 0.26);
  const body = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  body.addColorStop(0, shade(tone, 0.22));
  body.addColorStop(1, shade(tone, -0.25));
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.24); ctx.fill();
  // the screen
  const sw = w * 0.86, sh = h * 0.62;
  ctx.fillStyle = '#12303f';
  ctx.beginPath(); ctx.roundRect(cx - sw / 2, cy - sh / 2, sw, sh, sh * 0.2); ctx.fill();
  ctx.fillStyle = '#7ef0c8';
  ctx.shadowColor = 'rgba(126, 240, 200, 0.7)';
  ctx.shadowBlur = h * 0.2;
  ctx.font = `900 ${Math.round(sh * 0.66)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + sh * 0.03, sw * 0.88);
  ctx.restore();
}

/** The backdrop: a schoolroom wall, warm and plain, so the clock is the only thing to look at. */
export function drawRoom(ctx: Ctx, w: number, h: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b6dcef');
  g.addColorStop(0.42, '#dcecf3');
  g.addColorStop(0.62, '#f2e3c6');
  g.addColorStop(1, '#e0c79b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // the wainscot line, which gives the room a floor without drawing furniture
  const railY = h * 0.62;
  ctx.strokeStyle = 'rgba(146, 106, 58, 0.35)';
  ctx.lineWidth = Math.max(2, h * 0.004);
  ctx.beginPath(); ctx.moveTo(0, railY); ctx.lineTo(w, railY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.beginPath(); ctx.moveTo(0, railY + h * 0.006); ctx.lineTo(w, railY + h * 0.006); ctx.stroke();

  // the panelling below it, very faint
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#8a6434';
  ctx.lineWidth = Math.max(1, h * 0.002);
  const step = Math.max(40, w / 7);
  for (let x = step * 0.5; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, railY + h * 0.02); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.restore();

  // sunlight coming in from the left, drifting a hair over the minute
  const sx = w * (0.18 + Math.sin(t * 0.08) * 0.02);
  const sun = ctx.createRadialGradient(sx, h * 0.12, 0, sx, h * 0.12, Math.max(w, h) * 0.7);
  sun.addColorStop(0, 'rgba(255, 246, 214, 0.5)');
  sun.addColorStop(1, 'rgba(255, 246, 214, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  grainOver(ctx, 0, 0, w, h, 0.045);
}
