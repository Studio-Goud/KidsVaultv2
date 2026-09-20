/**
 * Explore: one planet at a time, as large as the screen allows, with the numbers that actually
 * mean something to a child. How long a day lasts. How long a year lasts. How cold it is. Which
 * moons go round it, and what is strange about each one.
 *
 * The day length is not only written down, it turns: a small marker crawls round the planet at a
 * speed proportional to its real rotation, so Jupiter visibly spins while Venus barely moves.
 */

import { TAU, type Vec } from '../../util/math';
import { moonsOf, type Body, type Moon } from './bodies';
import { drawBody } from './draw';
import { drawPhoto, moonPhoto } from './photo';
import { drawGlobe, HAS_MAP, type View } from './globe';

type Ctx = CanvasRenderingContext2D;

export interface ExploreHit { id: string; x: number; y: number; w: number; h: number }

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);

/** Day and year lengths read better in the unit a child already has a feel for. */
export function dayLabel(hours: number): string {
  if (hours < 48) return `${hours.toFixed(1)} ${T('hours', 'uur')}`;
  return `${(hours / 24).toFixed(0)} ${T('Earth days', 'aardse dagen')}`;
}

export function yearLabel(days: number): string {
  if (days < 800) return `${Math.round(days)} ${T('Earth days', 'aardse dagen')}`;
  return `${(days / 365.25).toFixed(days < 4000 ? 1 : 0)} ${T('Earth years', 'aardse jaren')}`;
}

export function tempLabel(c: number): string {
  return `${c > 0 ? '+' : ''}${c} °C`;
}

export interface ExploreView {
  hits: ExploreHit[];
}

/**
 * Draw the explore screen. `selected` is the planet, `openMoon` the moon whose card is showing.
 */
export function drawExplore(
  ctx: Ctx, body: Body, openMoon: Moon | null, time: number,
  w: number, h: number, u: number, dpr: number,
  font: (weight: string, size: number) => string,
  view: View,
): ExploreHit[] {
  const hits: ExploreHit[] = [];
  const moons = moonsOf(body.id);
  const name = NL() ? body.nameNl : body.name;

  // headline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf2ff'; ctx.font = font('900', 24);
  ctx.fillText(name, w / 2, 64 * u);

  // the planet, as large as the upper half allows
  const top = 86 * u, factsTop = h - (moons.length ? 232 : 186) * u;
  const band = Math.max(80 * u, factsTop - top);
  const r = Math.min(band * 0.44, w * 0.30);
  const cx = w / 2, cy = top + band / 2;

  // a world with a surface map becomes a ball you can turn; the rest keep their photograph
  const turnable = HAS_MAP.has(body.id);
  let drewGlobe = false;
  if (turnable) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(r * 1.02, band * 0.5), 0, TAU); ctx.clip();
    drewGlobe = drawGlobe(ctx, body.id, cx, cy, r * view.zoom, view);
    ctx.restore();
  }
  if (!drewGlobe) drawBody(ctx, body, cx, cy, r, dpr);
  if (drewGlobe) {
    // Saturn keeps its rings, drawn from the photograph, around the turning ball
    hits.push({ id: 'globe', x: cx - r * 1.25, y: cy - r * 1.25, w: r * 2.5, h: r * 2.5 });
    ctx.fillStyle = 'rgba(200,216,244,0.5)'; ctx.font = font('700', 9);
    ctx.textAlign = 'center';
    ctx.fillText(view.zoom > 1.05
      ? T('Drag to turn · double tap to pull back', 'Sleep om te draaien · dubbeltik om terug te gaan')
      : T('Drag to turn it · double tap to zoom', 'Sleep om hem te draaien · dubbeltik om in te zoomen'),
      cx, cy + Math.min(r * 1.02, band * 0.5) + 14 * u, w - 40 * u);
  }

  // a marker that goes round once per planet day, sped up so a turn takes a few seconds
  const turns = time / Math.max(2.5, Math.min(26, body.dayHours / 3));
  const a = turns * TAU;
  const mr = Math.min(r * (body.ring ? 1.34 : 1.16), band * 0.5 + 8 * u);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(180,210,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, mr, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(cx + Math.cos(a) * mr, cy + Math.sin(a) * mr, 3.2 * u, 0, TAU); ctx.fill();

  // the numbers
  const rows: Array<[string, string]> = [
    [T('One day', 'Een dag'), dayLabel(body.dayHours)],
    [T('One year', 'Een jaar'), yearLabel(body.yearDays)],
    [T('Temperature', 'Temperatuur'), tempLabel(body.tempC)],
    [T('Across', 'Doorsnede'), `${body.diameter.toLocaleString(NL() ? 'nl-NL' : 'en-GB')} km`],
    [T('Moons', 'Manen'), body.moonCount === 0 ? T('none', 'geen') : `${T('at least', 'minstens')} ${body.moonCount}`],
  ];
  let ry = factsTop;
  ctx.font = font('700', 12.5);
  for (const [k, v] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,216,244,0.7)';
    ctx.fillText(k, 22 * u, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eaf2ff';
    ctx.fillText(v, w - 22 * u, ry);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(22 * u, ry + 6 * u); ctx.lineTo(w - 22 * u, ry + 6 * u); ctx.stroke();
    ry += 21 * u;
  }

  // the moons we have a picture of
  if (moons.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,216,244,0.55)'; ctx.font = font('800', 9.5);
    ctx.fillText(T('MOONS YOU CAN MEET', 'MANEN OM TE ONTMOETEN'), 22 * u, ry + 6 * u);
    const my = ry + 34 * u, step = Math.min(88 * u, (w - 44 * u) / moons.length);
    moons.forEach((m, i) => {
      const mx = 22 * u + step * (i + 0.5);
      const rr = 15 * u;
      const ph = moonPhoto(m.id);
      if (ph) drawPhoto(ctx, ph, mx, my, rr);
      else { ctx.fillStyle = '#9aa6bd'; ctx.beginPath(); ctx.arc(mx, my, rr, 0, TAU); ctx.fill(); }
      if (openMoon && openMoon.id === m.id) {
        ctx.strokeStyle = '#9df7c4'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.arc(mx, my, rr + 4 * u, 0, TAU); ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(226,236,255,0.85)'; ctx.font = font('800', 9);
      ctx.fillText(NL() ? m.nameNl : m.name, mx, my + rr + 13 * u, step - 4 * u);
      hits.push({ id: `moon:${m.id}`, x: mx - rr - 6 * u, y: my - rr - 6 * u, w: (rr + 6 * u) * 2, h: (rr + 6 * u) * 2 + 14 * u });
    });
  }

  // whichever card is open: the planet's own line, or the moon you tapped
  const card = openMoon
    ? `${NL() ? openMoon.nameNl : openMoon.name} · ${Math.round(openMoon.diameter).toLocaleString(NL() ? 'nl-NL' : 'en-GB')} km · ${NL() ? openMoon.factNl : openMoon.fact}`
    : (NL() ? body.factNl : body.fact);
  ctx.textAlign = 'center';
  const cardY = h - 34 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath(); ctx.roundRect(16 * u, cardY - 20 * u, w - 32 * u, 34 * u, 11 * u); ctx.fill();
  ctx.fillStyle = '#eaf2ff'; ctx.font = font('800', 11.5);
  ctx.fillText(card, w / 2, cardY + 1 * u, w - 44 * u);

  // step to the planet before and after
  const bw = 44 * u, bh = 44 * u, by = cy - bh / 2;
  for (const [id, x, dir] of [['prev', 10 * u, -1], ['next', w - 10 * u - bw, 1]] as Array<[string, number, number]>) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.roundRect(x, by, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 2.4 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const mx2 = x + bw / 2, my2 = by + bh / 2, s = 6 * u;
    ctx.beginPath();
    // the chevron points the way you travel: left for the planet before, right for the one after
    ctx.moveTo(mx2 - s * dir * 0.5, my2 - s); ctx.lineTo(mx2 + s * dir * 0.5, my2); ctx.lineTo(mx2 - s * dir * 0.5, my2 + s);
    ctx.stroke();
    hits.push({ id, x, y: by, w: bw, h: bh });
  }
  ctx.textAlign = 'left';
  return hits;
}

/** Hit testing shared by the explore and scale screens. */
export function hitAt(hits: ExploreHit[], p: Vec): string | null {
  for (const h of hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
  return null;
}
