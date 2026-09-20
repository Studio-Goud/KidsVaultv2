/**
 * How Moonshot is drawn.
 *
 * A rocket is a stack of cylinders, and a cylinder is the one shape where a flat fill always looks
 * wrong: the eye wants a bright band a third of the way across and a dark edge on both sides. So
 * every tank, every engine and every booster gets the same horizontal gradient, and the whole
 * thing reads as metal without a single texture.
 *
 * The sky is the other half of it. It runs from a bright blue at the pad through a deepening blue
 * to black, driven by the same air-density curve the physics uses, so the moment the colour gives
 * out is the moment the air does.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import {
  blobPath, breathe, CachedLayer, contactShadow, Ctx, grainOver, roundRectPath, shade, vGrad,
} from '../../render/look';
import { airAt, partById, type Part, type Stack } from './model';

// ---------------------------------------------------------------- the sky

const skyLayer = new CachedLayer();

/**
 * The colour of the sky at a height, and how much of the stars show through.
 *
 * Below about ten kilometres it is the blue everybody knows. By forty it is the deep navy a
 * high-altitude balloon sees. Past a hundred there is nothing left to scatter the light.
 */
export function skyTone(altM: number): { top: string; bottom: string; stars: number } {
  const a = airAt(altM);
  const k = clamp(Math.pow(a, 0.42), 0, 1);
  const mixc = (c0: number[], c1: number[], t: number): string =>
    `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * t)).join(',')})`;
  return {
    top: mixc([4, 6, 16], [92, 162, 226], k),
    bottom: mixc([8, 12, 28], [186, 224, 246], k),
    stars: 1 - k,
  };
}

/** The star field the rocket climbs into. Fixed, so it does not crawl as the sky changes. */
export function paintStars(ctx: Ctx, w: number, h: number, alpha: number, drift: number): void {
  if (alpha <= 0.01) return;
  const cv = skyLayer.get(w, h, 'stars', (lc, lw, lh) => {
    const rng = makeRng(90210);
    for (let i = 0; i < 260; i++) {
      const x = rng() * lw, y = rng() * lh;
      const r = 0.4 + rng() * rng() * 1.9;
      const b = 0.4 + rng() * 0.6;
      lc.fillStyle = `rgba(${220 + Math.round(rng() * 35)}, ${226 + Math.round(rng() * 29)}, 255, ${b})`;
      lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
    }
  });
  if (!cv) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const off = ((drift % h) + h) % h;
  ctx.drawImage(cv, 0, off - h);
  ctx.drawImage(cv, 0, off);
  ctx.restore();
}

// ---------------------------------------------------------------- the metal

/**
 * The shading every cylinder gets: dark at both edges, a bright band left of the middle where the
 * light lands, and a soft warm bounce on the right. This one gradient is what makes a rectangle
 * read as a tube.
 */
function tube(ctx: Ctx, x: number, w: number, base: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(base, -0.34));
  g.addColorStop(0.12, shade(base, -0.12));
  g.addColorStop(0.32, shade(base, 0.22));
  g.addColorStop(0.55, base);
  g.addColorStop(0.84, shade(base, -0.2));
  g.addColorStop(1, shade(base, -0.4));
  return g;
}

const WHITE = '#eceff3';
const DARK = '#3b4048';
const COPPER = '#c98a52';

/** A ring of rivets and a seam, which is what stops a long tank reading as a blank white bar. */
function seams(ctx: Ctx, x: number, y: number, w: number, h: number, rows: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 48, 60, 0.18)';
  ctx.lineWidth = Math.max(0.6, w * 0.012);
  for (let i = 1; i < rows; i++) {
    const yy = y + (h * i) / rows;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  ctx.restore();
}

/**
 * One part, drawn into a box. `u` is the size of one rocket unit in pixels.
 *
 * Every part is drawn from its own bottom edge upwards, because that is how they stack: the thing
 * below decides where the thing above starts.
 */
export function paintPart(ctx: Ctx, part: Part, cx: number, bottomY: number, u: number, t: number): void {
  const w = part.w * u, h = part.h * u;
  const x = cx - w / 2, y = bottomY - h;

  if (part.kind === 'capsule') {
    // a cone with a window and a dark heat shield at its foot
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.02, y + h * 0.74, x, bottomY);
    ctx.lineTo(x + w, bottomY);
    ctx.quadraticCurveTo(x + w * 0.98, y + h * 0.74, cx, y);
    ctx.closePath();
    ctx.fill();
    // only the very tip is dark: a cone that is half black reads as a pencil, not a spacecraft
    ctx.fillStyle = '#39404a';
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.43, y + h * 0.12, x + w * 0.39, y + h * 0.22);
    ctx.lineTo(x + w * 0.61, y + h * 0.22);
    ctx.quadraticCurveTo(x + w * 0.57, y + h * 0.12, cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7fd2f2';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.02, y + h * 0.62, w * 0.14, h * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.06, y + h * 0.59, w * 0.05, h * 0.035, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade(DARK, 0.1);
    roundRectPath(ctx, x, bottomY - h * 0.09, w, h * 0.09, w * 0.02);
    ctx.fill();
    return;
  }

  if (part.kind === 'tank') {
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    ctx.fillRect(x, y, w, h);
    seams(ctx, x, y, w, h, Math.max(2, Math.round(part.h * 1.6)));
    // a painted band, so two tanks on top of each other still read as two
    ctx.fillStyle = 'rgba(190, 62, 48, 0.85)';
    ctx.fillRect(x, y + h * 0.06, w, h * 0.055);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + w * 0.3, y, w * 0.07, h);
    return;
  }

  if (part.kind === 'booster') {
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    roundRectPath(ctx, x, y + h * 0.1, w, h * 0.9, w * 0.14);
    ctx.fill();
    // a pointed cap
    ctx.fillStyle = tube(ctx, x, w, '#d9dee6');
    ctx.beginPath();
    ctx.moveTo(cx, y - h * 0.06);
    ctx.quadraticCurveTo(x + w * 0.04, y + h * 0.1, x, y + h * 0.16);
    ctx.lineTo(x + w, y + h * 0.16);
    ctx.quadraticCurveTo(x + w * 0.96, y + h * 0.1, cx, y - h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tube(ctx, x, w, DARK);
    roundRectPath(ctx, x + w * 0.1, bottomY - h * 0.1, w * 0.8, h * 0.11, w * 0.1);
    ctx.fill();
    return;
  }

  if (part.kind === 'fin') {
    // three fins: two swept out to the sides and one edge-on in the middle
    ctx.fillStyle = tube(ctx, x, w, COPPER);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * u * 0.44, y);
      ctx.lineTo(cx + s * w * 0.5, bottomY);
      ctx.lineTo(cx + s * u * 0.44, bottomY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = shade(COPPER, -0.24);
    ctx.fillRect(cx - u * 0.1, y, u * 0.2, h);
    return;
  }

  // an engine: a short body and a bell, or three of them
  const bells = part.id === 'engine-x' ? 3 : 1;
  ctx.fillStyle = tube(ctx, x, w, part.id === 'engine-n' ? '#bfc6cf' : WHITE);
  roundRectPath(ctx, x, y, w, h * 0.5, w * 0.04);
  ctx.fill();
  if (part.id === 'engine-n') {
    // the one engine that looks different, because it is
    ctx.fillStyle = '#e2b03a';
    ctx.fillRect(x, y + h * 0.16, w, h * 0.09);
    ctx.fillStyle = 'rgba(40,44,52,0.7)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.2 + i * 0.25), y + h * 0.17, w * 0.06, h * 0.07);
  }
  const bw = (w * 0.9) / bells;
  for (let i = 0; i < bells; i++) {
    const bx = x + w * 0.05 + i * bw + bw / 2;
    const top = y + h * 0.46;
    ctx.fillStyle = tube(ctx, bx - bw * 0.46, bw * 0.92, DARK);
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.2, top);
    ctx.quadraticCurveTo(bx - bw * 0.3, bottomY - h * 0.1, bx - bw * 0.46, bottomY);
    ctx.lineTo(bx + bw * 0.46, bottomY);
    ctx.quadraticCurveTo(bx + bw * 0.3, bottomY - h * 0.1, bx + bw * 0.2, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.1, top);
    ctx.quadraticCurveTo(bx - bw * 0.16, bottomY - h * 0.1, bx - bw * 0.26, bottomY);
    ctx.lineTo(bx - bw * 0.14, bottomY);
    ctx.quadraticCurveTo(bx - bw * 0.06, bottomY - h * 0.1, bx - bw * 0.02, top);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(30, 34, 42, 0.5)';
  ctx.fillRect(x, y + h * 0.44, w, h * 0.035);
}

/** How tall a stack is, in rocket units, capsule included. */
export function stackHeight(stack: Stack): number {
  let h = partById('capsule').h;
  for (const id of stack) {
    const p = partById(id);
    if (p.kind === 'booster' || p.kind === 'fin') continue;
    h += p.h;
  }
  return h;
}

/**
 * Draw a whole rocket standing on `baseY`, centred on `cx`.
 *
 * Boosters and fins are not part of the stack's height: they hang on the sides of whatever is at
 * the bottom, which is what makes a rocket with boosters look like a rocket with boosters rather
 * than a taller rocket.
 */
export function paintRocket(
  ctx: Ctx, stack: Stack, cx: number, baseY: number, u: number, t: number,
  opts: { dropped?: Set<number>; ghost?: number } = {},
): Array<{ i: number; x: number; y: number; w: number; h: number }> {
  const boxes: Array<{ i: number; x: number; y: number; w: number; h: number }> = [];
  const dropped = opts.dropped ?? new Set<number>();
  // the side parts first, so the body covers where they meet it
  let y = baseY;
  const spine: Array<{ i: number; bottom: number }> = [];
  stack.forEach((id, i) => {
    const p = partById(id);
    if (p.kind === 'booster' || p.kind === 'fin') return;
    spine.push({ i, bottom: y });
    y -= p.h * u;
  });
  const lowest = spine.length ? spine[0].bottom : baseY;

  stack.forEach((id, i) => {
    const p = partById(id);
    if (p.kind !== 'booster' && p.kind !== 'fin') return;
    if (dropped.has(i)) return;
    const body = partById(spine.length ? stack[spine[0].i] : 'tank-s');
    const off = (body.w / 2 + p.w / 2) * u * 0.92;
    const n = stack.filter((q, k) => partById(q).kind === p.kind && !dropped.has(k)).length;
    const mine = stack.slice(0, i).filter(q => partById(q).kind === p.kind).length;
    const side = n > 1 ? (mine % 2 === 0 ? -1 : 1) : -1;
    if (p.kind === 'fin') {
      paintPart(ctx, p, cx, lowest, u, t);
      boxes.push({ i, x: cx - (p.w * u) / 2, y: lowest - p.h * u, w: p.w * u, h: p.h * u });
    } else {
      const bx = cx + side * off;
      paintPart(ctx, p, bx, lowest - u * 0.1, u, t);
      boxes.push({ i, x: bx - (p.w * u) / 2, y: lowest - u * 0.1 - p.h * u, w: p.w * u, h: p.h * u });
    }
  });

  for (const s of spine) {
    if (dropped.has(s.i)) continue;
    const p = partById(stack[s.i]);
    paintPart(ctx, p, cx, s.bottom, u, t);
    boxes.push({ i: s.i, x: cx - (p.w * u) / 2, y: s.bottom - p.h * u, w: p.w * u, h: p.h * u });
  }
  const cap = partById('capsule');
  paintPart(ctx, cap, cx, y, u, t);
  boxes.push({ i: -1, x: cx - (cap.w * u) / 2, y: y - cap.h * u, w: cap.w * u, h: cap.h * u });
  return boxes;
}

// ---------------------------------------------------------------- fire

/**
 * The flame. Two cones and a glow: a bright white core, a wider orange body that flickers, and a
 * pool of light on whatever is underneath. In thin air the flame spreads out, which is a real
 * thing and looks like the real pictures.
 */
export function paintFlame(
  ctx: Ctx, cx: number, y: number, width: number, power: number, spread: number, t: number,
): void {
  if (power <= 0.01) return;
  const flick = 0.82 + Math.sin(t * 38) * 0.08 + Math.sin(t * 23.7) * 0.06;
  const len = width * (2.6 + spread * 2.2) * power * flick;
  const wide = width * (0.52 + spread * 0.75);
  ctx.save();
  const glow = ctx.createRadialGradient(cx, y + len * 0.25, 0, cx, y + len * 0.25, len * 0.9);
  glow.addColorStop(0, `rgba(255, 226, 150, ${0.5 * power})`);
  glow.addColorStop(0.5, `rgba(255, 150, 60, ${0.18 * power})`);
  glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, y + len * 0.25, len * 0.9, 0, TAU); ctx.fill();

  const body = ctx.createLinearGradient(0, y, 0, y + len);
  body.addColorStop(0, 'rgba(255, 248, 226, 0.95)');
  body.addColorStop(0.35, 'rgba(255, 190, 96, 0.9)');
  body.addColorStop(1, 'rgba(226, 96, 40, 0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - wide, y);
  ctx.quadraticCurveTo(cx - wide * 0.7, y + len * 0.6, cx, y + len);
  ctx.quadraticCurveTo(cx + wide * 0.7, y + len * 0.6, cx + wide, y);
  ctx.closePath();
  ctx.fill();

  const core = ctx.createLinearGradient(0, y, 0, y + len * 0.7);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx - wide * 0.4, y);
  ctx.quadraticCurveTo(cx - wide * 0.24, y + len * 0.4, cx, y + len * 0.7);
  ctx.quadraticCurveTo(cx + wide * 0.24, y + len * 0.4, cx + wide * 0.4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the ground

const padLayer = new CachedLayer();

/** The pad, the tower and the flat country around it: painted once and blitted after that. */
export function paintPad(ctx: Ctx, w: number, groundY: number, u: number): void {
  const h = Math.max(1, Math.round(u * 6));
  const cv = padLayer.get(w, h, `pad${Math.round(u)}`, (lc, lw, lh) => {
    lc.fillStyle = vGrad(lc, 0, lh, '#8a8578', '#57534a');
    lc.fillRect(0, 0, lw, lh);
    // scrub on the plain
    const rng = makeRng(7);
    for (let i = 0; i < 70; i++) {
      const x = rng() * lw, y = lh * (0.05 + rng() * 0.9);
      lc.fillStyle = `rgba(${90 + rng() * 40 | 0}, ${96 + rng() * 40 | 0}, 70, 0.4)`;
      blobPath(lc, x, y, u * (0.1 + rng() * 0.22), i, 0.4, 7);
      lc.fill();
    }
    // the apron
    lc.fillStyle = '#9a968c';
    roundRectPath(lc, lw / 2 - u * 4.2, 0, u * 8.4, lh * 0.5, u * 0.3);
    lc.fill();
    lc.fillStyle = 'rgba(255,255,255,0.14)';
    roundRectPath(lc, lw / 2 - u * 4.2, 0, u * 8.4, u * 0.18, u * 0.08);
    lc.fill();
    // the flame trench: a slot, not a slab
    lc.fillStyle = '#3d3a34';
    roundRectPath(lc, lw / 2 - u * 0.55, 0, u * 1.1, lh * 0.2, u * 0.1);
    lc.fill();
    lc.fillStyle = 'rgba(20, 18, 16, 0.5)';
    roundRectPath(lc, lw / 2 - u * 0.4, 0, u * 0.8, lh * 0.14, u * 0.08);
    lc.fill();
  });
  if (cv) ctx.drawImage(cv, 0, groundY);
}

/** The service tower beside the pad, so the rocket has something to be tall against. */
export function paintTower(ctx: Ctx, x: number, baseY: number, u: number, tall: number): void {
  const w = u * 1.1;
  ctx.save();
  contactShadow(ctx, x, baseY, w * 1.4, u * 0.3, 0.35);
  ctx.strokeStyle = '#6f6a60';
  ctx.lineWidth = Math.max(1.2, u * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY); ctx.lineTo(x - w / 2, baseY - tall);
  ctx.moveTo(x + w / 2, baseY); ctx.lineTo(x + w / 2, baseY - tall);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, u * 0.05);
  const step = u * 0.75;
  for (let y = baseY; y > baseY - tall; y -= step) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y - step * 0.5);
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x - w / 2, y - step * 0.5);
    ctx.moveTo(x - w / 2, y - step * 0.5); ctx.lineTo(x + w / 2, y - step * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Clouds the rocket goes through, drawn as flat lumps because that is how they look from below. */
export function paintCloud(ctx: Ctx, x: number, y: number, r: number, alpha: number, seed: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  for (const [dx, dy, k, a] of [[-0.55, 0.1, 0.62, 0.9], [0.5, 0.14, 0.55, 0.85], [0, -0.1, 0.8, 1]] as const) {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    blobPath(ctx, x + dx * r, y + dy * r, r * k, seed + dx * 10, 0.16);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(206, 220, 236, 0.75)';
  blobPath(ctx, x, y + r * 0.34, r * 0.9, seed + 3, 0.12);
  ctx.fill();
  ctx.restore();
}

/** The Earth falling away below, once there is enough height to see it curve. */
export function paintEarthBelow(ctx: Ctx, w: number, h: number, altM: number, u: number): void {
  const k = clamp((altM - 60000) / 400000, 0, 1);
  if (k <= 0) return;
  const r = w * (2.6 - k * 1.5);
  const cy = h + r - h * 0.1 * k;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.6, 0, 1);
  const g = ctx.createRadialGradient(w * 0.34, cy - r * 0.6, r * 0.05, w / 2, cy, r);
  g.addColorStop(0, '#6fb7e8');
  g.addColorStop(0.55, '#2f79b8');
  g.addColorStop(1, '#12406e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, TAU); ctx.fill();
  // a rim of air on the limb, which is the thing everyone recognises from the photographs
  ctx.strokeStyle = 'rgba(150, 214, 255, 0.75)';
  ctx.lineWidth = Math.max(2, u * 0.16);
  ctx.beginPath(); ctx.arc(w / 2, cy, r + ctx.lineWidth * 0.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}

/** A soft grain over the whole frame, the same one the rest of Bramblewood uses. */
export const paintGrain = (ctx: Ctx, w: number, h: number): void => grainOver(ctx, 0, 0, w, h, 0.045);

export { breathe };
