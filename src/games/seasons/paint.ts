/**
 * The pictures for "Het jaar rond": the year wheel, the week train, the season scene and the sky a
 * child drags the sun across. Canvas paths only, in the house light from `render/look.ts`.
 */

import { TAU } from '../../util/math';
import { contactShadow, shade, starPath } from '../../render/look';
import type { DayInfo, SeasonId } from './model';

type Ctx = CanvasRenderingContext2D;

const SEASON_COLOUR: Record<SeasonId, string> = {
  lente: '#8fd66e', zomer: '#ffd23f', herfst: '#e8823a', winter: '#a9d4ec',
};

// ---------------------------------------------------------------- the year wheel

/**
 * Twelve wedges, coloured by the season KNMI puts them in, turning very slowly so the wheel never
 * looks like a diagram. `rot` is in turns (0..1); `highlight` lights the wedge under a finger.
 */
export function drawYearWheel(ctx: Ctx, cx: number, cy: number, r: number, rot: number, highlight: number, u: number): void {
  ctx.save();
  contactShadow(ctx, cx, cy + r * 0.94, r * 0.9, r * 0.22, 0.28);
  ctx.translate(cx, cy);
  ctx.rotate(rot * TAU);
  for (let i = 0; i < 12; i++) {
    const season = i <= 1 || i === 11 ? 'winter' : i <= 4 ? 'lente' : i <= 7 ? 'zomer' : 'herfst';
    const a0 = (i / 12) * TAU - Math.PI / 2;
    const a1 = ((i + 1) / 12) * TAU - Math.PI / 2;
    const lit = i === highlight;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = lit ? shade(SEASON_COLOUR[season], 0.2) : SEASON_COLOUR[season];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.stroke();
  }
  // the hub
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(18,48,71,0.15)';
  ctx.lineWidth = Math.max(1, r * 0.015);
  ctx.stroke();
  ctx.restore();

  // a fixed pointer at the top, outside the rotation, so it always says "this one"
  ctx.save();
  ctx.translate(cx, cy - r * 1.06);
  ctx.fillStyle = '#123047';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-r * 0.07, -r * 0.13); ctx.lineTo(r * 0.07, -r * 0.13);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  void u;
}

/** One month's label, laid along the wheel at its wedge - called once per month by the game. */
export function wheelMonthLabel(ctx: Ctx, cx: number, cy: number, r: number, rot: number, i: number, text: string, u: number): void {
  const a = ((i + 0.5) / 12) * TAU - Math.PI / 2 + rot * TAU;
  const rr = r * 0.63;
  ctx.save();
  ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  ctx.rotate(a + Math.PI / 2);
  ctx.fillStyle = 'rgba(18,48,71,0.85)';
  ctx.font = `800 ${Math.round(11 * u)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- the week train

/** One wagon of the week: a coloured car with the day's name, and a lit window when it is today. */
export function drawWagon(
  ctx: Ctx, x: number, y: number, w: number, h: number, day: DayInfo, label: string,
  opts: { today: boolean; pressed: boolean; mood: 'none' | 'right' | 'wrong'; u: number },
): void {
  const u = opts.u;
  const base = day.weekend ? '#f2a35c' : '#6fb7e0';
  let tone = base;
  if (opts.mood === 'right') tone = '#4fae6e';
  else if (opts.mood === 'wrong') tone = '#e0664a';
  const down = opts.pressed ? h * 0.06 : 0;
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h + h * 0.08, w * 0.46, h * 0.14, 0.24);
  // wheels
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath(); ctx.arc(x + w * 0.24, y + h + down, h * 0.14, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.76, y + h + down, h * 0.14, 0, TAU); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, y + down, 0, y + h + down);
  g.addColorStop(0, shade(tone, 0.22));
  g.addColorStop(1, shade(tone, -0.12));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y + down, w, h, h * 0.18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.beginPath(); ctx.roundRect(x + 1, y + down + 1, w - 2, h - 2, h * 0.18); ctx.stroke();
  // window: lit yellow with a star in it on today's wagon
  ctx.fillStyle = opts.today ? '#ffe27a' : 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.roundRect(x + w * 0.24, y + down + h * 0.14, w * 0.52, h * 0.34, h * 0.08); ctx.fill();
  if (opts.today) {
    ctx.fillStyle = '#f08a24';
    starPath(ctx, x + w / 2, y + down + h * 0.31, h * 0.13);
    ctx.fill();
  }
  // label
  ctx.fillStyle = '#ffffff';
  let size = Math.min(15, w * 0.17 / u);
  ctx.font = `900 ${Math.round(size * u)}px Nunito, system-ui, sans-serif`;
  while (size > 8 && ctx.measureText(label).width > w * 0.9) { size -= 0.5; ctx.font = `900 ${Math.round(size * u)}px Nunito, system-ui, sans-serif`; }
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + down + h * 0.78);
  ctx.restore();
}

/** Two rails and their sleepers, under a row of the train. */
export function drawRails(ctx: Ctx, x: number, y: number, w: number, u: number): void {
  ctx.fillStyle = 'rgba(90,64,40,0.85)';
  for (let sx = x + 4 * u; sx < x + w; sx += 14 * u) ctx.fillRect(sx, y - 2 * u, 6 * u, 7 * u);
  ctx.fillStyle = '#8b98a5';
  ctx.fillRect(x, y - 1 * u, w, 2.2 * u);
  ctx.fillRect(x, y + 3 * u, w, 2.2 * u);
}

/** The locomotive at the head of the week: a little steam engine, puffing. */
export function drawLoco(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, u: number): void {
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h * 1.08, w * 0.46, h * 0.14, 0.24);
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath(); ctx.arc(x + w * 0.28, y + h, h * 0.17, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.74, y + h, h * 0.13, 0, TAU); ctx.fill();
  // boiler and cab
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#e05a4a'); g.addColorStop(1, '#a8342a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y + h * 0.1, w * 0.45, h * 0.9, h * 0.12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + w * 0.3, y + h * 0.42, w * 0.7, h * 0.58, h * 0.2); ctx.fill();
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(x - w * 0.04, y + h * 0.04, w * 0.53, h * 0.1);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.roundRect(x + w * 0.08, y + h * 0.24, w * 0.28, h * 0.26, h * 0.06); ctx.fill();
  // chimney and its smoke
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(x + w * 0.74, y + h * 0.16, w * 0.13, h * 0.28);
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.7 + i / 4) % 1;
    ctx.globalAlpha = 0.6 * (1 - k);
    ctx.fillStyle = '#f2f4f6';
    ctx.beginPath(); ctx.arc(x + w * 0.8 - k * w * 0.5, y + h * 0.1 - k * h * 0.5, h * (0.08 + k * 0.12), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(x + w * 0.98, y + h * 0.7, h * 0.07, 0, TAU); ctx.fill();
  void u;
  ctx.restore();
}
