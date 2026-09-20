/**
 * The village that grows out of the valleys.
 *
 * Eight valleys on their own are eight puzzles that forget you the moment they are over. So the
 * work now leaves something behind: every valley pays out sheaves of grain, and the sheaves buy
 * buildings that stand in a village of your own and make the next valley a little kinder. The
 * water cellar keeps the spring running longer, the shed gives you more earth to move, the bridge
 * takes a rock out of the way.
 *
 * What it deliberately is not: there is no clock, no crop that rots while you are at school, and
 * nothing to buy. A valley pays exactly once, and pays a little more only if you come back and do
 * it better. So the village is a record of how well you played, not a reason to keep opening the
 * app. Bramblewood promises parents a session with an end in it, and that promise costs nothing
 * here - the six buildings all together are within reach of a child who does eight valleys well.
 */

import { TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import {
  blobPath, breathe, contactShadow, Ctx, drawStar, grainOver, heading, roundRectPath, shade, vGrad,
} from '../../render/look';
import { persist, save } from '../../util/storage';
import type { Level } from './world';

export interface Build {
  id: string;
  name: string;
  nameNl: string;
  /** what it does for you, in the one line a child gets */
  what: string;
  whatNl: string;
  cost: number;
  /** where it stands on the village green, as fractions of the scene */
  x: number;
  y: number;
}

/**
 * Six buildings, in the order they become affordable. Together they cost thirty-nine sheaves,
 * and eight valleys played perfectly pay forty-three, so the village can be finished - but only
 * by someone who went back and did the early valleys properly.
 */
export const BUILDS: Build[] = [
  {
    id: 'cellar', name: 'The water cellar', nameNl: 'De waterkelder',
    what: 'The spring runs six seconds longer in every valley.',
    whatNl: 'De bron loopt in elke vallei zes seconden langer.',
    cost: 4, x: 0.18, y: 0.20,
  },
  {
    id: 'shed', name: 'The tool shed', nameNl: 'Het schuurtje',
    what: 'A bigger spade: more earth to move in every valley.',
    whatNl: 'Een grotere schop: in elke vallei meer aarde om te verzetten.',
    cost: 5, x: 0.76, y: 0.16,
  },
  {
    id: 'bridge', name: 'The stone bridge', nameNl: 'De stenen brug',
    what: 'One rock fewer in the way, in every valley.',
    whatNl: 'In elke vallei ligt er een rots minder in de weg.',
    cost: 6, x: 0.46, y: 0.46,
  },
  {
    id: 'sawmill', name: 'The sawmill', nameNl: 'De zaagmolen',
    what: 'A wheel is satisfied sooner.',
    whatNl: 'Een rad is eerder tevreden.',
    cost: 7, x: 0.82, y: 0.64,
  },
  {
    id: 'dyke', name: 'The dyke', nameNl: 'De dijk',
    what: 'Houses can take more water before they flood.',
    whatNl: 'Huizen kunnen meer water hebben voor ze onderlopen.',
    cost: 8, x: 0.24, y: 0.60,
  },
  {
    id: 'orchard', name: 'The orchard', nameNl: 'De boomgaard',
    what: 'A field needs less water than it used to.',
    whatNl: 'Een akker heeft minder water nodig dan eerst.',
    cost: 9, x: 0.50, y: 0.88,
  },
];

export const buildById = (id: string): Build => BUILDS.find(b => b.id === id)!;

// ---------------------------------------------------------------- what you own

export const grain = (): number => save.mill.grain;
export const hasBuilt = (id: string): boolean => save.mill.built.includes(id);
export const builtCount = (): number => save.mill.built.length;

/** Buy one, if there is enough in the barn. Returns false when there is not. */
export function build(id: string): boolean {
  const b = buildById(id);
  if (hasBuilt(id) || save.mill.grain < b.cost) return false;
  save.mill.grain -= b.cost;
  save.mill.built = [...save.mill.built, id];
  persist();
  return true;
}

/**
 * What a valley is worth: a sheaf for every field watered and every wheel turned, and one for
 * each star. A valley pays that amount once. Come back and do it better and it pays the
 * difference, so the only way to earn more is to play better, never to play again.
 */
export const dueFor = (level: Level, stars: number): number =>
  level.fields.length + level.wheels.length + stars;

/** Bank what this run of the valley has earned. Returns the sheaves actually added. */
export function payFor(level: Level, stars: number): number {
  const due = dueFor(level, stars);
  const paid = save.mill.paid[level.id] ?? 0;
  if (due <= paid) return 0;
  const add = due - paid;
  save.mill.paid[level.id] = due;
  save.mill.grain += add;
  persist();
  return add;
}

// ---------------------------------------------------------------- what they do

/** Is there anything in the barn worth walking over for? */
export const canAffordSomething = (): boolean =>
  BUILDS.some(b => !hasBuilt(b.id) && grain() >= b.cost);

/** How many rocks to leave out of a valley. */
export const fewerRocks = (): number => (hasBuilt('bridge') ? 1 : 0);

/** How wet a house may get before it counts as flooded. */
export const floodLimit = (): number => (hasBuilt('dyke') ? 1.45 : 1);

/** The level as the village leaves it: the same puzzle, with the help you have built into it. */
export function withVillage(level: Level): Level {
  return {
    ...level,
    spade: level.spade + (hasBuilt('shed') ? 45 : 0),
    springFor: level.springFor + (hasBuilt('cellar') ? 6 : 0),
    fields: level.fields.map(f => ({ ...f, need: hasBuilt('orchard') ? Math.round(f.need * 0.84) : f.need })),
    wheels: level.wheels.map(w => ({ ...w, need: hasBuilt('sawmill') ? Math.max(4, w.need - 1.6) : w.need })),
  };
}

// ---------------------------------------------------------------- the picture

const HORIZON = 0.2;

/** Where the stream is, as a fraction k of the way down the green. The bridge stands on it. */
const streamAt = (w: number, k: number): number =>
  w * 0.5 + Math.sin(k * 4.2) * w * 0.17 + Math.sin(k * 9) * w * 0.04;

/** The top of the green, in pixels. */
const greenTop = (h: number): number => h * HORIZON + 26;

function sky(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = vGrad(ctx, 0, h * (HORIZON + 0.08), '#a8dcf6', '#e6f3e0');
  ctx.fillRect(0, 0, w, h * (HORIZON + 0.08));
  // two ridges behind the village, so the green has a country to be in
  const top = h * HORIZON;
  for (const [k, col, amp] of [[0, '#8fb98c', 1], [1, '#74a473', 0.7]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, top + 26 * (1 - k * 0.5));
    for (let x = 0; x <= w; x += w / 24) {
      const y = top - (Math.sin(x * 0.0042 + k * 2.1) * 26 + Math.cos(x * 0.0088 + k) * 14) * amp + k * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, top + 44); ctx.lineTo(0, top + 44); ctx.closePath();
    ctx.fill();
  }
}

/** The green the village stands on, with the stream running down through it. */
function green(ctx: Ctx, w: number, h: number, t: number): void {
  const top = greenTop(h);
  ctx.fillStyle = vGrad(ctx, top, h, '#8cc06a', '#4a8442');
  ctx.fillRect(top === 0 ? 0 : 0, top, w, h - top);

  // the stream, coming down out of the hills and away past the bottom corner
  const path = (k: number): number => streamAt(w, k);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(40, 90, 70, 0.22)';
  ctx.lineWidth = Math.max(10, w * 0.055);
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const u = k / 40; const y = top + (h - top) * u; const x = path(u); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  const wg = vGrad(ctx, top, h, '#7fd0ee', '#3f9fd2');
  ctx.strokeStyle = wg;
  ctx.lineWidth = Math.max(7, w * 0.04);
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const u = k / 40; const y = top + (h - top) * u; const x = path(u); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  // light running down the surface
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + breathe(t, 1.4) * 0.15})`;
  ctx.lineWidth = Math.max(1.5, w * 0.007);
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const u = k / 40; const y = top + (h - top) * u; const x = path(u) - w * 0.012; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.restore();

  // tufts, so the green is not a flat colour
  const rng = makeRng(4711);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (let i = 0; i < 90; i++) {
    const x = rng() * w, y = top + rng() * (h - top);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 6, y - 4 - rng() * 5); ctx.stroke();
  }
}

/** One building, drawn at the size of its plot. Every one is a shape a child can name. */
function paintBuild(ctx: Ctx, id: string, cx: number, cy: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  contactShadow(ctx, 0, s * 0.62, s * 0.78, s * 0.24, 0.34);
  const wall = '#f3e6cd', roof = '#c4713f', stone = '#a49c90', wood = '#8a5f3a';
  const lit = (c: string): string => shade(c, 0.14);

  if (id === 'cellar') {
    // a well head: round stones, a little roof on two posts, a bucket on a rope
    ctx.fillStyle = stone;
    ctx.beginPath(); ctx.ellipse(0, s * 0.34, s * 0.44, s * 0.18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(stone, -0.18);
    roundRectPath(ctx, -s * 0.44, s * 0.02, s * 0.88, s * 0.34, s * 0.1); ctx.fill();
    ctx.fillStyle = lit(stone);
    ctx.beginPath(); ctx.ellipse(0, s * 0.02, s * 0.44, s * 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f6d86';
    ctx.beginPath(); ctx.ellipse(0, s * 0.03, s * 0.31, s * 0.11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = wood;
    ctx.fillRect(-s * 0.4, -s * 0.52, s * 0.08, s * 0.58);
    ctx.fillRect(s * 0.32, -s * 0.52, s * 0.08, s * 0.58);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.86); ctx.lineTo(s * 0.56, -s * 0.46); ctx.lineTo(-s * 0.56, -s * 0.46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = wood;
    ctx.fillRect(-s * 0.05, -s * 0.5, s * 0.1, s * 0.26);
    ctx.fillStyle = shade(wood, 0.25);
    roundRectPath(ctx, -s * 0.12, -s * 0.26, s * 0.24, s * 0.18, s * 0.04); ctx.fill();
  } else if (id === 'shed') {
    // a plank shed with a spade leaning on the wall
    ctx.fillStyle = shade(wood, -0.1);
    roundRectPath(ctx, -s * 0.5, -s * 0.24, s, s * 0.86, s * 0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(60, 38, 20, 0.35)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(-s * 0.5 + (s / 5) * i, -s * 0.2); ctx.lineTo(-s * 0.5 + (s / 5) * i, s * 0.58); ctx.stroke();
    }
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.2); ctx.lineTo(0, -s * 0.72); ctx.lineTo(s * 0.62, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(roof, 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.2); ctx.lineTo(0, -s * 0.72); ctx.lineTo(0, -s * 0.6); ctx.lineTo(-s * 0.44, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.56); ctx.lineTo(s * 0.62, -s * 0.06); ctx.stroke();
    ctx.fillStyle = '#c7ccd2';
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.06); ctx.lineTo(s * 0.72, -s * 0.02); ctx.lineTo(s * 0.68, -s * 0.28); ctx.lineTo(s * 0.52, -s * 0.3); ctx.closePath(); ctx.fill();
  } else if (id === 'bridge') {
    // Two piers and a deck over them. The span is simply left open rather than cut out of what
    // is behind it, so the stream runs on through the arch instead of through a hole.
    ctx.fillStyle = shade(stone, -0.24);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * s * 0.72, -s * 0.06);
      ctx.lineTo(sx * s * 0.72, s * 0.5);
      ctx.lineTo(sx * s * 0.3, s * 0.5);
      ctx.quadraticCurveTo(sx * s * 0.34, s * 0.04, sx * s * 0.44, -s * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = stone;
    roundRectPath(ctx, -s * 0.78, -s * 0.22, s * 1.56, s * 0.2, s * 0.05); ctx.fill();
    ctx.fillStyle = lit(stone);
    roundRectPath(ctx, -s * 0.84, -s * 0.36, s * 1.68, s * 0.16, s * 0.06); ctx.fill();
    // a low parapet, one stone at a time
    ctx.fillStyle = shade(stone, 0.04);
    for (let i = -3; i <= 3; i++) {
      roundRectPath(ctx, i * s * 0.22 - s * 0.09, -s * 0.56, s * 0.18, s * 0.22, s * 0.03); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRectPath(ctx, -s * 0.84, -s * 0.36, s * 1.68, s * 0.06, s * 0.03); ctx.fill();
  } else if (id === 'sawmill') {
    // a little mill with a wheel that actually turns
    ctx.fillStyle = wall;
    roundRectPath(ctx, -s * 0.52, -s * 0.3, s * 0.86, s * 0.92, s * 0.06); ctx.fill();
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(-s * 0.64, -s * 0.26); ctx.lineTo(-s * 0.09, -s * 0.82); ctx.lineTo(s * 0.46, -s * 0.26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a2c';
    roundRectPath(ctx, -s * 0.24, s * 0.16, s * 0.28, s * 0.46, s * 0.03); ctx.fill();
    const a = t * 1.1;
    ctx.save();
    ctx.translate(s * 0.48, s * 0.2);
    ctx.rotate(a);
    ctx.strokeStyle = '#7a5231'; ctx.lineWidth = Math.max(2, s * 0.07);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * TAU;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(th) * s * 0.34, Math.sin(th) * s * 0.34); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.stroke();
    ctx.restore();
  } else if (id === 'dyke') {
    // A grassy bank with water pressed against the near side and dry ground on the far side,
    // which is the whole idea of a dyke in one picture.
    const crown = (x: number): number => -s * 0.44 + Math.abs(x) * s * 0.5;
    ctx.fillStyle = 'rgba(66, 150, 200, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-s * 1.24, s * 0.5);
    ctx.quadraticCurveTo(-s * 1.36, s * 0.2, -s * 1.2, s * 0.08);
    ctx.lineTo(-s * 0.74, s * 0.08);
    ctx.quadraticCurveTo(-s * 0.84, s * 0.3, -s * 0.96, s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath(); ctx.ellipse(-s * 1.0, s * 0.16, s * 0.2, s * 0.035, 0, 0, TAU); ctx.fill();
    // the bank itself
    ctx.fillStyle = '#5f9a4e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, s * 0.52);
    ctx.quadraticCurveTo(-s * 0.44, crown(-0.44), 0, -s * 0.44);
    ctx.quadraticCurveTo(s * 0.44, crown(0.44), s * 0.95, s * 0.52);
    ctx.closePath(); ctx.fill();
    // a lighter strip along the crown where the light lands
    ctx.fillStyle = '#7dbb63';
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.06);
    ctx.quadraticCurveTo(-s * 0.34, -s * 0.46, 0, -s * 0.44);
    ctx.quadraticCurveTo(s * 0.34, -s * 0.46, s * 0.7, s * 0.06);
    ctx.quadraticCurveTo(0, -s * 0.2, -s * 0.7, s * 0.06);
    ctx.closePath(); ctx.fill();
    // bare earth showing at the foot, so it is a built thing and not a hill
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, s * 0.52);
    ctx.quadraticCurveTo(0, s * 0.3, s * 0.95, s * 0.52);
    ctx.quadraticCurveTo(0, s * 0.62, -s * 0.95, s * 0.52);
    ctx.closePath(); ctx.fill();
  } else {
    // the orchard: three trees, each a different lump
    for (const [ox, oy, rr, sd] of [[-0.46, 0.1, 0.36, 3], [0.06, -0.06, 0.44, 9], [0.52, 0.14, 0.34, 17]] as const) {
      ctx.fillStyle = '#7a5231';
      ctx.fillRect(ox * s - s * 0.05, oy * s, s * 0.1, s * 0.48);
      ctx.fillStyle = '#3f7a3c';
      blobPath(ctx, ox * s, oy * s - rr * s * 0.35, rr * s, sd, 0.2); ctx.fill();
      ctx.fillStyle = '#5aa04d';
      blobPath(ctx, ox * s - rr * s * 0.12, oy * s - rr * s * 0.5, rr * s * 0.7, sd + 1, 0.22); ctx.fill();
      ctx.fillStyle = '#e8735a';
      for (let i = 0; i < 3; i++) {
        const th = sd + i * 2.1;
        ctx.beginPath();
        ctx.arc(ox * s + Math.cos(th) * rr * s * 0.5, oy * s - rr * s * 0.35 + Math.sin(th) * rr * s * 0.5, s * 0.045, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** A sheaf of grain: the thing you earn, drawn the same wherever it is shown. */
export function paintSheaf(ctx: Ctx, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#e0b44e';
  ctx.lineWidth = Math.max(1.4, s * 0.16);
  ctx.lineCap = 'round';
  for (const a of [-0.34, -0.12, 0.12, 0.34]) {
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * s * 0.9, s * 0.9);
    ctx.lineTo(Math.sin(a) * s * 1.5, -s * 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = '#f4d488';
  for (const a of [-0.34, -0.12, 0.12, 0.34]) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(a) * s * 1.5, -s * 0.95, s * 0.26, s * 0.42, a, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#a8713a';
  ctx.lineWidth = Math.max(1.4, s * 0.2);
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, s * 0.12); ctx.lineTo(s * 0.7, s * 0.12);
  ctx.stroke();
  ctx.restore();
}

export interface PlotHit { id: string; x: number; y: number; w: number; h: number }

/**
 * Draw the whole village. Returns the plots you can press, so the game does not have to know
 * where anything ended up.
 */
export function paintVillage(
  ctx: Ctx, w: number, h: number, u: number, t: number,
  nl: boolean, font: (weight: string, size: number) => string,
  justBuilt: { id: string; age: number } | null,
): PlotHit[] {
  sky(ctx, w, h);
  green(ctx, w, h, t);

  const hits: PlotHit[] = [];
  const top = h * HORIZON + 46 * u;
  const bottom = h - 150 * u;
  const band = Math.max(150 * u, bottom - top);
  const s = Math.min(w * 0.125, band * 0.105);

  // back to front, so a building lower down the green stands in front of one behind it
  for (const b of [...BUILDS].sort((a, c) => a.y - c.y)) {
    const cy = top + band * b.y;
    // a bridge belongs over the water, so its place is read off the stream rather than the grid
    const cx = b.id === 'bridge'
      ? streamAt(w, (cy - greenTop(h)) / Math.max(1, h - greenTop(h)))
      : w * (0.08 + b.x * 0.84);
    const mine = hasBuilt(b.id);
    const canPay = grain() >= b.cost;
    const pop = justBuilt && justBuilt.id === b.id ? Math.max(0, 1 - justBuilt.age / 0.7) : 0;
    ctx.save();
    if (pop > 0) {
      const k = 1 + Math.sin(pop * Math.PI) * 0.22;
      ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    }
    if (mine) {
      paintBuild(ctx, b.id, cx, cy, s * 1.7, t);
    } else {
      // an empty plot: the ground marked out, and what it would cost
      ctx.fillStyle = 'rgba(48, 74, 44, 0.24)';
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.5, s * 1.25, s * 0.42, 0, 0, TAU); ctx.fill();
      ctx.setLineDash([5 * u, 6 * u]);
      ctx.strokeStyle = canPay ? `rgba(255, 246, 214, ${0.55 + breathe(t, 2.6) * 0.4})` : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.5, s * 1.25, s * 0.42, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // the price, on a little post
      ctx.fillStyle = canPay ? '#fffdf3' : 'rgba(255,253,243,0.7)';
      roundRectPath(ctx, cx - 25 * u, cy - 20 * u, 50 * u, 30 * u, 9 * u);
      ctx.fill();
      paintSheaf(ctx, cx - 11 * u, cy - 5 * u, 6.5 * u);
      ctx.fillStyle = canPay ? '#2f5d33' : 'rgba(47, 93, 51, 0.6)';
      ctx.font = font('900', 14);
      ctx.textAlign = 'left';
      ctx.fillText(String(b.cost), cx + 2 * u, cy, 22 * u);
    }
    ctx.restore();
    hits.push({ id: `plot:${b.id}`, x: cx - s * 1.5, y: cy - s * 1.3, w: s * 3, h: s * 2.6 });
  }

  grainOver(ctx, 0, 0, w, h, 0.05);

  // the barn count, top middle
  ctx.textAlign = 'center';
  heading(ctx, nl ? 'Het dorp' : 'The village', w / 2, 62 * u, font('900', 26), '#ffffff');
  const cw = 104 * u, ch = 34 * u, cx0 = w / 2 - cw / 2, cy0 = 74 * u;
  ctx.fillStyle = 'rgba(255, 253, 243, 0.94)';
  roundRectPath(ctx, cx0, cy0, cw, ch, ch / 2);
  ctx.fill();
  paintSheaf(ctx, cx0 + 22 * u, cy0 + ch / 2, 8 * u);
  ctx.fillStyle = '#2f5d33';
  ctx.font = font('900', 16);
  ctx.textAlign = 'left';
  ctx.fillText(String(grain()), cx0 + 38 * u, cy0 + ch * 0.66, cw - 46 * u);
  ctx.textAlign = 'center';

  // how far the village has got
  const done = builtCount();
  for (let i = 0; i < BUILDS.length; i++) {
    const sx = w / 2 + (i - (BUILDS.length - 1) / 2) * 17 * u;
    drawStar(ctx, sx, cy0 + ch + 16 * u, 6 * u, i < done);
  }
  return hits;
}

/** The line under the picture: what the plot you last touched would do for you. */
export function blurbFor(id: string | null, nl: boolean): string {
  if (!id) {
    return nl
      ? 'Elke vallei levert schoven op. Bouw er iets van dat je verder helpt.'
      : 'Every valley pays in sheaves. Build something with them that helps you on.';
  }
  const b = buildById(id);
  return `${nl ? b.nameNl : b.name} - ${nl ? b.whatNl : b.what}`;
}

/** Colours for the note under the village, so a refusal reads differently from a purchase. */
export const noteInk = (ok: boolean): string => (ok ? '#123047' : '#8a3a2a');
