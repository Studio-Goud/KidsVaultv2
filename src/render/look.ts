/**
 * The house style of Braambos: the drawing primitives every game shares.
 *
 * A game made of flat shapes reads as a diagram. What makes a scene read as a place is light
 * coming from one direction, something under every object that touches the ground, edges that are
 * not perfectly straight, and a surface with a grain to it. All of that lives here, so the games
 * themselves can stay about their own subject and still end up looking like one world.
 *
 * Everything is canvas paths and gradients. No images, no libraries, no network.
 */

import { clamp, TAU } from '../util/math';
import { makeRng } from '../util/rng';

export type Ctx = CanvasRenderingContext2D;

/** Light comes from up and to the left in every game. Shadows fall down and to the right. */
export const LIGHT = { x: -0.42, y: -0.9 };

// ---------------------------------------------------------------- easing

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number): number => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
export const easeOutElastic = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
/** A heartbeat between 0 and 1, for anything that should never sit perfectly still. */
export const breathe = (t: number, speed = 1, phase = 0): number => 0.5 + 0.5 * Math.sin(t * speed + phase);

// ---------------------------------------------------------------- colour

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const f = (c: number): number => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
  const r = Math.round((((pa >> 16) & 255) * (1 - t)) + (((pb >> 16) & 255) * t));
  const g = Math.round((((pa >> 8) & 255) * (1 - t)) + (((pb >> 8) & 255) * t));
  const c = Math.round(((pa & 255) * (1 - t)) + ((pb & 255) * t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | c).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------- paths

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

/**
 * A closed shape that is round but not a circle. Real things in the world are lumpy, and a lumpy
 * outline is most of what separates a drawing from a diagram.
 */
export function blobPath(ctx: Ctx, cx: number, cy: number, r: number, seed: number, wobble = 0.14, pts = 11): void {
  const rng = makeRng(Math.round(seed * 9973) + 7);
  const rs: number[] = [];
  for (let i = 0; i < pts; i++) rs.push(r * (1 - wobble / 2 + rng() * wobble));
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    // the angles run on past a full turn rather than wrapping, so the control point of the last
    // segment stays next to it instead of jumping to the far side and cutting the shape open
    const a0 = (i / pts) * TAU, a1 = ((i + 1) / pts) * TAU;
    const r0 = rs[i], r1 = rs[(i + 1) % pts];
    const x0 = cx + Math.cos(a0) * r0, y0 = cy + Math.sin(a0) * r0;
    const x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
    const am = (a0 + a1) / 2, rm = ((r0 + r1) / 2) / Math.cos(Math.PI / pts);
    const mx = cx + Math.cos(am) * rm, my = cy + Math.sin(am) * rm;
    if (i === 0) ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx, my, x1, y1);
  }
  ctx.closePath();
}

/** An outline that wanders a little, the way a drawn line does. */
export function sketchLine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, jitter: number, seed = 1): void {
  const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
  const rng = makeRng(seed * 131 + 17);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const j = i === steps ? 0 : (rng() - 0.5) * jitter;
    ctx.lineTo(x0 + (x1 - x0) * t - (y1 - y0) * 0.02 + j, y0 + (y1 - y0) * t + j);
  }
}

// ---------------------------------------------------------------- light and shadow

/**
 * The soft dark patch under anything standing on the ground. Without it, objects float; with it,
 * they have weight and a place. Drawn as a radial gradient so the edge is never a hard ring.
 */
export function contactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.3): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(24, 38, 30, ${alpha})`);
  g.addColorStop(0.55, `rgba(24, 38, 30, ${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(24, 38, 30, 0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / Math.max(rx, ry));
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(rx, ry), 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Run a drawing with a real cast shadow behind it. */
export function withShadow(ctx: Ctx, blur: number, dy: number, color: string, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  draw();
  ctx.restore();
}

/** Vertical gradient, top colour to bottom colour. */
export function vGrad(ctx: Ctx, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** A gradient along the light direction, for a face that catches the sun on one side. */
export function litGrad(ctx: Ctx, cx: number, cy: number, r: number, light: string, dark: string): CanvasGradient {
  const g = ctx.createLinearGradient(cx + LIGHT.x * r, cy + LIGHT.y * r, cx - LIGHT.x * r, cy - LIGHT.y * r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

/** The bright edge where the sun grazes the top of a round thing. */
export function rimLight(ctx: Ctx, cx: number, cy: number, r: number, alpha = 0.5, width = 0.16): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(cx + LIGHT.x * r * 0.5, cy + LIGHT.y * r * 0.5, r * 0.2, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1 - width, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Darkening towards the corners. Holds the eye in the middle of the screen. */
export function vignette(ctx: Ctx, w: number, h: number, alpha = 0.22, color = '10, 26, 44'): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.32, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, `rgba(${color}, 0)`);
  g.addColorStop(1, `rgba(${color}, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- texture

let grainCanvas: HTMLCanvasElement | null = null;

/** A tile of fine noise. Laid over flat fills it stops them looking like printer output. */
export function grain(ctx: Ctx): CanvasPattern | null {
  if (!grainCanvas) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (!g) return null;
    const img = g.createImageData(128, 128);
    const rng = makeRng(20260920);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 128 + Math.round((rng() - 0.5) * 190);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainCanvas = c;
  }
  return ctx.createPattern(grainCanvas, 'repeat');
}

/** Lay the grain over an area at a whisper of opacity. */
export function grainOver(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.05): void {
  const p = grain(ctx);
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = p;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------- sky

export interface SkyColours { top: string; mid: string; low: string; sun: string; cloud: string }

export const DAY_SKY: SkyColours = { top: '#5fb4ef', mid: '#9ad8f6', low: '#d9f1fb', sun: '#fff4c8', cloud: '#ffffff' };
export const WARM_SKY: SkyColours = { top: '#6ab6e8', mid: '#a9dcf2', low: '#ffe9c4', sun: '#fff0bc', cloud: '#fffaf0' };
export const SEA_SKY: SkyColours = { top: '#4fa8e0', mid: '#8fd2ef', low: '#e5f6ff', sun: '#fff6d2', cloud: '#ffffff' };

interface Cloud { x: number; y: number; s: number; v: number; seed: number; puffs: number }

/** The backdrop: graded sky, a sun that glows, and clouds that drift across on their own. */
export class Sky {
  private clouds: Cloud[] = [];
  constructor(seed = 7, count = 6) {
    const rng = makeRng(seed);
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: rng(), y: 0.04 + rng() * 0.3, s: 0.5 + rng() * 0.85,
        v: 0.004 + rng() * 0.008, seed: rng() * 1000, puffs: 3 + Math.floor(rng() * 3),
      });
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > 1.25) { c.x = -0.25; c.y = 0.04 + Math.random() * 0.3; }
    }
  }

  draw(ctx: Ctx, w: number, h: number, col: SkyColours, sunAt = 0.22): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, col.top);
    g.addColorStop(0.52, col.mid);
    g.addColorStop(1, col.low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // the sun, as a glow rather than a disc: a disc reads as a sticker
    const sx = w * sunAt, sy = h * 0.1;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.min(w, h) * 0.55);
    sg.addColorStop(0, hexA(col.sun, 0.75));
    sg.addColorStop(0.28, hexA(col.sun, 0.2));
    sg.addColorStop(1, hexA(col.sun, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);

    for (const c of this.clouds) this.cloud(ctx, c, w, h, col.cloud);
  }

  private cloud(ctx: Ctx, c: Cloud, w: number, h: number, colour: string): void {
    const x = c.x * w * 1.3 - w * 0.15, y = c.y * h;
    const r = Math.min(w, h) * 0.055 * c.s;
    ctx.save();
    ctx.globalAlpha = 0.5 + c.s * 0.25;
    // the underside is never pure white
    ctx.fillStyle = hexA('#bcd9ea', 0.5);
    for (let i = 0; i < c.puffs; i++) {
      const px = x + (i - (c.puffs - 1) / 2) * r * 1.15;
      blobPath(ctx, px, y + r * 0.34, r * (0.72 + ((i * 7 + c.seed) % 5) / 12), c.seed + i, 0.2, 9);
      ctx.fill();
    }
    ctx.fillStyle = colour;
    for (let i = 0; i < c.puffs; i++) {
      const px = x + (i - (c.puffs - 1) / 2) * r * 1.15;
      blobPath(ctx, px, y, r * (0.72 + ((i * 7 + c.seed) % 5) / 12), c.seed + i, 0.2, 9);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- particles

export type PKind = 'splash' | 'dust' | 'spark' | 'leaf' | 'bubble' | 'crumb' | 'ring' | 'heart';

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; colour: string; kind: PKind; spin: number; a: number; grav: number;
}

/** Small things that fly off when something happens. Cheap, and they carry most of the feel. */
export class Particles {
  private ps: Particle[] = [];

  get count(): number { return this.ps.length; }
  clear(): void { this.ps.length = 0; }

  spawn(kind: PKind, x: number, y: number, n: number, o: Partial<Particle> & { spread?: number; speed?: number } = {}): void {
    const speed = o.speed ?? 90;
    const spread = o.spread ?? TAU;
    // particles go up and outwards: straight down looks like a leak, not a spray
    const base = -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const s = speed * (0.45 + Math.random() * 0.9);
      const max = (o.max ?? 0.7) * (0.6 + Math.random() * 0.8);
      this.ps.push({
        x: x + (Math.random() - 0.5) * (o.size ?? 6),
        y: y + (Math.random() - 0.5) * (o.size ?? 6),
        vx: (o.vx ?? Math.cos(a) * s), vy: (o.vy ?? Math.sin(a) * s),
        life: max, max,
        size: (o.size ?? 6) * (0.6 + Math.random() * 0.9),
        colour: o.colour ?? '#ffffff',
        kind, spin: (Math.random() - 0.5) * 8, a: Math.random() * TAU,
        grav: o.grav ?? (kind === 'bubble' ? -60 : kind === 'ring' ? 0 : 320),
      });
    }
  }

  update(dt: number): void {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.4 * dt;
      p.a += p.spin * dt;
      if (p.kind === 'leaf') p.x += Math.sin(p.a * 2) * 26 * dt;
    }
  }

  draw(ctx: Ctx): void {
    for (const p of this.ps) {
      const t = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = p.kind === 'ring' ? t * 0.7 : Math.min(1, t * 1.6);
      ctx.translate(p.x, p.y);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.colour;
        ctx.lineWidth = Math.max(1, p.size * 0.22 * t);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.6 - t * 1.1) * 2.2, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.rotate(p.a);
        ctx.fillStyle = p.colour;
        const s = p.size * t;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const r = i % 2 === 0 ? s : s * 0.36;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'leaf') {
        ctx.rotate(p.a);
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.85, p.size * 0.4, 0, 0, TAU);
        ctx.fill();
      } else if (p.kind === 'bubble') {
        ctx.strokeStyle = p.colour;
        ctx.lineWidth = Math.max(0.8, p.size * 0.16);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.5 + t * 0.6), 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'heart') {
        ctx.rotate(Math.sin(p.a) * 0.3);
        ctx.fillStyle = p.colour;
        const s = p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.6, -s * 0.3, -s * 0.5, -s * 1.4, 0, -s * 0.5);
        ctx.bezierCurveTo(s * 0.5, -s * 1.4, s * 1.6, -s * 0.3, 0, s * 0.9);
        ctx.fill();
      } else {
        // splash, dust, crumb: a soft round grain, squashed along its flight
        const sq = p.kind === 'splash' ? clamp(1 + Math.abs(p.vy) / 900, 1, 1.7) : 1;
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.55 * sq * (0.4 + t * 0.6), p.size * 0.55 * (0.4 + t * 0.6), 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- camera shake

/** A short knock to the view. Used sparingly: on a hit, a splash, a collapse. */
export class Shake {
  private amt = 0;
  private t = 0;
  add(a: number): void { this.amt = Math.min(1, this.amt + a); }
  update(dt: number): void { this.t += dt; this.amt = Math.max(0, this.amt - dt * 2.6); }
  apply(ctx: Ctx, scale = 9): void {
    if (this.amt <= 0) return;
    const a = this.amt * this.amt;
    ctx.translate(Math.sin(this.t * 58) * scale * a, Math.cos(this.t * 47) * scale * a);
  }
}

// ---------------------------------------------------------------- interface

export interface ButtonStyle {
  /** face colour; the rim and the lip below are derived from it */
  tone?: string;
  /** dark text on a light face, or the other way round */
  ink?: string;
  pressed?: boolean;
  disabled?: boolean;
  radius?: number;
}

/**
 * A button with a body and a lip under it, which the press squashes. Flat rectangles do not read
 * as pressable to a four year old; something that visibly goes down does.
 */
export function chunkyButton(
  ctx: Ctx, x: number, y: number, w: number, h: number, style: ButtonStyle = {},
): { x: number; y: number; w: number; h: number } {
  const tone = style.tone ?? '#ffffff';
  const r = style.radius ?? h * 0.34;
  const lip = Math.max(3, h * 0.13);
  const down = style.pressed ? lip * 0.75 : 0;
  ctx.save();
  if (style.disabled) ctx.globalAlpha = 0.45;
  // the lip
  ctx.fillStyle = shade(tone, -0.3);
  roundRectPath(ctx, x, y + lip * 0.5, w, h, r);
  ctx.fill();
  // the face
  const fy = y + down;
  const g = ctx.createLinearGradient(0, fy, 0, fy + h);
  g.addColorStop(0, shade(tone, 0.16));
  g.addColorStop(0.55, tone);
  g.addColorStop(1, shade(tone, -0.08));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, fy, w, h, r);
  ctx.fill();
  // a sliver of light across the top
  ctx.save();
  roundRectPath(ctx, x, fy, w, h, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRectPath(ctx, x + w * 0.06, fy + h * 0.1, w * 0.88, h * 0.3, h * 0.2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  return { x, y: fy, w, h };
}

/** A frosted card to put words or icons on, over a busy scene. */
export function glassPanel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, alpha = 0.9): void {
  ctx.save();
  ctx.shadowColor = 'rgba(12, 32, 52, 0.28)';
  ctx.shadowBlur = h * 0.5;
  ctx.shadowOffsetY = h * 0.12;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r);
  ctx.stroke();
}

/** Heading type with a soft shadow, so it stays readable over any scene. */
export function heading(ctx: Ctx, text: string, x: number, y: number, font: string, colour = '#123047'): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(10, 30, 50, 0.3)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Text with a light halo behind it, for labels that sit straight on the artwork. */
export function outlinedText(ctx: Ctx, text: string, x: number, y: number, font: string, fill: string, halo = 'rgba(255,255,255,0.92)', width = 4): void {
  ctx.save();
  ctx.font = font;
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function starPath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.44;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** A star that is gold and domed when earned, and a quiet hollow when not. */
export function drawStar(ctx: Ctx, x: number, y: number, r: number, earned: boolean, pop = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  if (earned) {
    ctx.shadowColor = 'rgba(232, 164, 32, 0.55)';
    ctx.shadowBlur = r * 0.9;
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ffe9a3');
    g.addColorStop(0.5, '#f5bd3a');
    g.addColorStop(1, '#e09a1c');
    ctx.fillStyle = g;
    starPath(ctx, 0, 0, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    starPath(ctx, 0, -r * 0.06, r * 0.72);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(18, 48, 71, 0.14)';
    starPath(ctx, 0, 0, r);
    ctx.fill();
  }
  ctx.restore();
}

/** A ring that fills up clockwise. Reads as progress without a single number. */
export function progressRing(ctx: Ctx, x: number, y: number, r: number, t: number, colour: string, width: number, track = 'rgba(255,255,255,0.35)'): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  if (t > 0.001) {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(t, 0, 1));
    ctx.stroke();
  }
  ctx.restore();
}

/** A pointing hand that taps or drags, for showing a child what to do without a sentence. */
export function handCursor(ctx: Ctx, x: number, y: number, s: number, press = 0): void {
  ctx.save();
  ctx.translate(x, y + press * s * 0.18);
  ctx.rotate(-0.25);
  contactShadow(ctx, 0, s * 1.5, s * 0.6, s * 0.2, 0.25);
  ctx.fillStyle = '#ffd9b0';
  ctx.strokeStyle = 'rgba(90, 50, 25, 0.5)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  // fist
  ctx.beginPath();
  ctx.ellipse(0, s * 0.72, s * 0.52, s * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // index finger
  ctx.beginPath();
  ctx.roundRect(-s * 0.17, -s * 0.62, s * 0.34, s * 0.95, s * 0.17);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- cached layers

/**
 * A piece of a scene that does not change from frame to frame, drawn once into its own canvas.
 *
 * Backdrops are where the time goes: a street of houses, a beach of pebbles, a wooden counter with
 * its grain. Each is a few hundred paths and a gradient apiece, and none of it moves. Drawing them
 * once and blitting the result keeps the frame for the things that actually animate.
 */
export class CachedLayer {
  private cv: HTMLCanvasElement | null = null;
  private key = '';

  /** The cached canvas for this size and key, redrawing it only when either has changed. */
  get(w: number, h: number, key: string, draw: (ctx: Ctx, w: number, h: number) => void): HTMLCanvasElement | null {
    const want = `${Math.round(w)}x${Math.round(h)}:${key}`;
    if (this.cv && this.key === want) return this.cv;
    const cv = this.cv ?? document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, cv.width, cv.height);
    draw(ctx, cv.width, cv.height);
    this.cv = cv;
    this.key = want;
    return cv;
  }

  /** Throw the cached drawing away, so the next get redraws it. */
  clear(): void { this.key = ''; }
}

/**
 * Carry the picture on under the notch and the home bar.
 *
 * Every game draws inside the safe box and shifts down by the top inset, so nothing a child has
 * to read or press hides behind the phone's own furniture. That leaves a strip at the top and one
 * at the bottom. Rather than a black band, the first and last row that were drawn are stretched
 * into them: whatever the sky or the ground happens to be at that edge, the strip matches it.
 */
export function bleedEdges(
  ctx: Ctx, canvas: HTMLCanvasElement, w: number, dpr: number, top: number, bottom: number, h: number,
): void {
  if (top <= 0 && bottom <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width;
  if (top > 0) {
    const row = Math.round(top * dpr);
    ctx.drawImage(canvas, 0, row, cw, 1, 0, 0, cw, row);
  }
  if (bottom > 0) {
    const y = Math.round((top + h) * dpr);
    const band = Math.round(bottom * dpr);
    if (y - 1 >= 0) ctx.drawImage(canvas, 0, y - 1, cw, 1, 0, y, cw, band);
  }
  ctx.restore();
}
