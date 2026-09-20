/**
 * Procedural planets.
 *
 * Every body is drawn from scratch with canvas paths: no photographs, no sprite sheets. The aim is
 * that a planet reads as itself at a glance, so the colours, the banding and the ring geometry all
 * follow the real thing rather than a cartoon of it.
 *
 * Each planet is drawn into its own small canvas once and then stamped, because the surface detail
 * is expensive and never changes.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { SUN, type Body } from './bodies';

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, HTMLCanvasElement>();

/** Mix two hex colours. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Mottled surface: soft blobs of the light and dark tone, clipped to the disc. */
function mottle(ctx: Ctx, r: number, body: Body, n: number, scale: number, alpha: number): void {
  const rng = makeRng(body.id.length * 977 + body.diameter);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.95;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const rr = r * scale * (0.5 + rng());
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.fillStyle = rng() > 0.5 ? body.light : body.dark;
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * (0.6 + rng() * 0.6), rng() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Horizontal cloud bands with wavy edges, the way a gas giant actually looks. */
function bands(ctx: Ctx, r: number, body: Body): void {
  const noise = new ValueNoise(body.diameter % 1000);
  const n = body.surface === 'icy' ? 7 : 13;
  for (let i = 0; i < n; i++) {
    const y0 = -r + (i / n) * 2 * r, y1 = -r + ((i + 1) / n) * 2 * r;
    const t = Math.abs((i / (n - 1)) * 2 - 1);            // darker towards the poles
    const k = (i % 2 === 0 ? 0.32 : 0) + t * 0.3;
    ctx.fillStyle = mix(body.base, i % 2 === 0 ? body.dark : body.light, k);
    ctx.beginPath();
    ctx.moveTo(-r, y0);
    for (let x = -r; x <= r; x += r / 14) {
      ctx.lineTo(x, y0 + noise.noise2(x * 0.02, i * 1.7) * r * 0.035);
    }
    for (let x = r; x >= -r; x -= r / 14) {
      ctx.lineTo(x, y1 + noise.noise2(x * 0.02, i * 1.7 + 9) * r * 0.035);
    }
    ctx.closePath(); ctx.fill();
  }
}

/** Continents: a handful of smoothed blobs, enough to read as land without pretending to be a map. */
function land(ctx: Ctx, r: number, body: Body): void {
  const rng = makeRng(4242);
  for (let i = 0; i < 7; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.8;
    const cx = Math.cos(a) * d, cy = Math.sin(a) * d * 0.9;
    const pts = 9, rad = r * (0.16 + rng() * 0.2);
    ctx.fillStyle = mix(body.light, '#2f6b33', rng() * 0.5);
    ctx.beginPath();
    for (let k = 0; k <= pts; k++) {
      const th = (k / pts) * TAU;
      const rr = rad * (0.6 + rng() * 0.8);
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr * 0.8;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  // a few cloud swirls on top
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.9;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * (0.1 + rng() * 0.18), r * 0.055, rng() * 0.6 - 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** White polar caps. */
function caps(ctx: Ctx, r: number, frac: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0, s * r * (1 - frac * 0.55), r * frac * 1.5, r * frac * 0.8, 0, 0, TAU);
    ctx.fill();
  }
}

/** The disc itself, without rings. Returns a canvas of size 2r by 2r plus a margin. */
function discCanvas(body: Body, r: number, dpr: number): HTMLCanvasElement {
  const pad = Math.ceil(r * 0.25);
  const size = Math.ceil((r + pad) * 2);
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2);

  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.fillStyle = body.base;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  if (body.surface === 'banded' || body.surface === 'icy') bands(ctx, r, body);
  if (body.surface === 'rock') mottle(ctx, r, body, 42, 0.13, 0.55);
  if (body.surface === 'cloudy') mottle(ctx, r, body, 20, 0.3, 0.3);
  if (body.surface === 'rusty') mottle(ctx, r, body, 26, 0.2, 0.42);
  if (body.surface === 'ocean') land(ctx, r, body);
  if (body.caps) caps(ctx, r, body.caps);

  if (body.storm) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = body.storm.color;
    ctx.beginPath();
    ctx.ellipse(body.storm.x * r, body.storm.y * r, body.storm.r * r, body.storm.r * r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.02;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // sunlight from the upper left, and the night side falling away to the lower right
  const lg = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
  lg.addColorStop(0, 'rgba(255,255,255,0.32)');
  lg.addColorStop(0.42, 'rgba(255,255,255,0)');
  lg.addColorStop(0.72, 'rgba(0,0,10,0.16)');
  lg.addColorStop(1, 'rgba(0,0,10,0.62)');
  ctx.fillStyle = lg; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  // thin rim of atmosphere on the lit side
  ctx.strokeStyle = `rgba(255,255,255,0.35)`;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, Math.PI * 0.85, Math.PI * 1.85); ctx.stroke();
  return c;
}

/** Draw a planet centred on (x, y) with disc radius r, rings and all. */
export function drawBody(ctx: Ctx, body: Body, x: number, y: number, r: number, dpr = 1): void {
  const key = `${body.id}|${Math.round(r)}|${dpr}`;
  let c = cache.get(key);
  if (!c) { c = discCanvas(body, r, dpr); cache.set(key, c); }
  const size = c.width / dpr;

  if (body.ring) {
    // the far half of the ring passes behind the planet, the near half in front
    drawRing(ctx, body, x, y, r, 'back');
    ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
    drawRing(ctx, body, x, y, r, 'front');
  } else {
    ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
  }
}

function drawRing(ctx: Ctx, body: Body, x: number, y: number, r: number, half: 'back' | 'front'): void {
  const ring = body.ring!;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.32);
  const squash = Math.sin(ring.tilt);
  ctx.scale(1, Math.max(0.08, squash));
  ctx.beginPath();
  const a0 = half === 'back' ? Math.PI : 0;
  ctx.arc(0, 0, (ring.outer + ring.inner) / 2 * r, a0, a0 + Math.PI);
  ctx.strokeStyle = ring.color;
  ctx.globalAlpha = half === 'back' ? 0.55 : 0.85;
  ctx.lineWidth = (ring.outer - ring.inner) * r;
  ctx.stroke();
  // the Cassini gap, as a darker hairline through the band
  ctx.globalAlpha = half === 'back' ? 0.25 : 0.4;
  ctx.strokeStyle = 'rgba(20,16,10,0.9)';
  ctx.lineWidth = Math.max(1, (ring.outer - ring.inner) * r * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, (ring.inner + (ring.outer - ring.inner) * 0.66) * r, a0, a0 + Math.PI);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** The sun, for the left edge of the track. */
export function drawSun(ctx: Ctx, x: number, y: number, r: number, time: number): void {
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.4);
  glow.addColorStop(0, 'rgba(255,196,80,0.55)');
  glow.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, SUN.light); g.addColorStop(0.6, SUN.base); g.addColorStop(1, SUN.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // slow flicker along the limb
  ctx.strokeStyle = 'rgba(255,230,150,0.5)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const rr = r * (1.02 + 0.03 * Math.sin(a * 6 + time * 1.5));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** Star field for the backdrop. */
export function starField(w: number, h: number): Array<{ x: number; y: number; r: number; a: number; p: number }> {
  const rng = makeRng(90210);
  const out = [];
  const n = Math.round((w * h) / 4200);
  for (let i = 0; i < n; i++) {
    out.push({ x: rng() * w, y: rng() * h, r: 0.4 + rng() * 1.2, a: 0.25 + rng() * 0.6, p: rng() * TAU });
  }
  return out;
}

export const sizeOrder = (bodies: Body[]): Body[] => [...bodies].sort((a, b) => b.diameter - a.diameter);
export const sunOrder = (bodies: Body[]): Body[] => [...bodies].sort((a, b) => a.distance - b.distance);
export const radiusFor = (body: Body, max: number): number =>
  clamp(Math.pow(body.diameter / 142984, 0.36) * max, max * 0.34, max);
