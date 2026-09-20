import type { Puff } from '../game/world';
import { clamp01, TAU, type Vec } from '../util/math';
import { makeRng, ValueNoise } from '../util/rng';
import type { IslandShape } from './terrain';
import type { Palette } from './palette';

type Ctx = CanvasRenderingContext2D;

// ---------------- clouds ----------------

interface Cloud { x: number; y: number; s: number; sprite: HTMLCanvasElement; vx: number; vy: number }

function makeCloudSprite(rng: () => number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 260; c.height = 140;
  const ctx = c.getContext('2d')!;
  const n = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x = 60 + rng() * 140, y = 60 + rng() * 40, r = 28 + rng() * 34;
    const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  return c;
}

export class CloudField {
  clouds: Cloud[] = [];
  constructor(count: number, W: number, H: number, seed: number, private pal: Palette) {
    const rng = makeRng(seed + 99);
    for (let i = 0; i < count; i++) {
      this.clouds.push({ x: rng() * W, y: rng() * H, s: 0.7 + rng() * 0.9, sprite: makeCloudSprite(rng), vx: 4 + rng() * 5, vy: 1 + rng() * 2 });
    }
  }
  update(dt: number, wind: Vec, W: number, H: number): void {
    for (const c of this.clouds) {
      c.x += (c.vx + wind.x * 0.5) * dt; c.y += (c.vy + wind.y * 0.5) * dt;
      const w = 260 * c.s, h = 140 * c.s;
      if (c.x > W + w) c.x = -w; if (c.x < -w) c.x = W + w;
      if (c.y > H + h) c.y = -h; if (c.y < -h) c.y = H + h;
    }
  }
  drawShadows(ctx: Ctx): void {
    ctx.save(); ctx.globalAlpha = this.pal.shadowAlpha * 0.6; ctx.globalCompositeOperation = 'multiply';
    for (const c of this.clouds) {
      ctx.save(); ctx.translate(c.x + 40 * c.s, c.y + 60 * c.s); ctx.scale(c.s, c.s);
      ctx.filter = 'brightness(0.35)';
      ctx.drawImage(c.sprite, -130, -70);
      ctx.restore();
    }
    ctx.restore();
  }
  drawClouds(ctx: Ctx): void {
    ctx.save(); ctx.globalAlpha = this.pal.cloudAlpha;
    for (const c of this.clouds) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.s, c.s);
      ctx.drawImage(c.sprite, -130, -70);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------------- sea animation ----------------

/** Clip to the sea: everything except the island polygons. */
export function clipSea(ctx: Ctx, W: number, H: number, islands: IslandShape[]): void {
  ctx.beginPath();
  ctx.rect(-300, -300, W + 600, H + 600);
  for (const isl of islands) {
    const p = isl.poly;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
}

export function drawSeaLife(ctx: Ctx, W: number, H: number, time: number, pal: Palette, islands: IslandShape[], noise: ValueNoise): void {
  ctx.save();
  clipSea(ctx, W, H, islands);
  // caustic shimmer strokes
  ctx.lineCap = 'round';
  const cols = 9, rows = 16;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const n = noise.noise2(i * 0.9 + time * 0.05, j * 0.9 + 3.1);
      const x = ((i + 0.5) / cols) * W + Math.sin(time * 0.6 + j * 1.7 + i) * 26;
      const y = ((j + 0.5) / rows) * H + Math.cos(time * 0.45 + i * 1.3 + j) * 16;
      const a = 0.05 + 0.13 * (0.5 + 0.5 * Math.sin(time * 1.1 + n * 12 + i * 0.7 + j * 1.9));
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2.2;
      const len = 18 + n * 26;
      ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.quadraticCurveTo(x, y - 4, x + len / 2, y); ctx.stroke();
    }
  }
  // sparkles
  const rng = makeRng(Math.floor(time * 2));
  ctx.fillStyle = pal.seaSparkle;
  for (let i = 0; i < 14; i++) {
    const x = rng() * W, y = rng() * H;
    const tw = (time * 2 + i) % 1;
    ctx.globalAlpha = 0.5 * Math.sin(tw * Math.PI);
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------- wind particles ----------------

interface Particle { x: number; y: number; life: number; max: number; len: number }

export class WindField {
  parts: Particle[] = [];
  private rng = makeRng(4242);
  constructor(private W: number, private H: number) {
    for (let i = 0; i < 70; i++) this.parts.push(this.fresh(true));
  }
  private fresh(anywhere: boolean): Particle {
    const max = 2 + this.rng() * 3;
    return { x: this.rng() * this.W, y: this.rng() * this.H, life: anywhere ? this.rng() * max : 0, max, len: 16 + this.rng() * 26 };
  }
  update(dt: number, wind: Vec): void {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.life += dt;
      p.x += wind.x * 2.4 * dt; p.y += wind.y * 2.4 * dt;
      if (p.life > p.max || p.x < -40 || p.x > this.W + 40 || p.y < -40 || p.y > this.H + 40) this.parts[i] = this.fresh(false);
    }
  }
  draw(ctx: Ctx, wind: Vec, kmh: number): void {
    if (kmh < 3) return;
    const l = Math.hypot(wind.x, wind.y) || 1;
    const ux = wind.x / l, uy = wind.y / l;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
    const strength = clamp01(kmh / 30);
    for (const p of this.parts) {
      const a = Math.sin((p.life / p.max) * Math.PI) * (0.18 + 0.32 * strength);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - ux * p.len, p.y - uy * p.len); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------- puffs / one-shot effects ----------------

export function drawPuff(ctx: Ctx, puff: Puff, time: number, W: number, H: number): void {
  const age = time - puff.t0;
  if (puff.kind === 'crash') {
    const rng = makeRng(Math.floor(puff.pos.x * 3 + puff.pos.y));
    if (age < 0.35) {
      const r = 20 + age * 160;
      const g = ctx.createRadialGradient(puff.pos.x, puff.pos.y, 0, puff.pos.x, puff.pos.y, r);
      g.addColorStop(0, `rgba(255,240,200,${1 - age / 0.35})`); g.addColorStop(0.4, `rgba(255,140,60,${0.8 * (1 - age / 0.35)})`); g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(puff.pos.x, puff.pos.y, r, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, sp = 14 + rng() * 30, r0 = 8 + rng() * 10;
      const d = Math.min(age, 2.5) * sp;
      const x = puff.pos.x + Math.cos(a) * d, y = puff.pos.y + Math.sin(a) * d - age * 6;
      const r = r0 + age * 10;
      const al = Math.max(0, 0.55 - age * 0.12);
      ctx.fillStyle = `rgba(${70 + i * 8},${70 + i * 8},${80 + i * 8},${al})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const a = rng() * TAU, sp = 60 + rng() * 120;
      const d = Math.min(age, 1.2) * sp;
      const al = Math.max(0, 1 - age / 1.2);
      ctx.fillStyle = `rgba(255,${150 + rng() * 80},60,${al})`;
      ctx.beginPath(); ctx.arc(puff.pos.x + Math.cos(a) * d, puff.pos.y + Math.sin(a) * d, 2.2, 0, TAU); ctx.fill();
    }
    return;
  }
  if (puff.kind === 'tire') {
    const dur = 1.6; if (age > dur) return;
    const k = age / dur;
    const d = puff.dir ?? 0;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const back = 6 + i * 5 + k * 30;
      const x = puff.pos.x - Math.cos(d) * back + Math.cos(d + Math.PI / 2) * side * (6 + k * 8), y = puff.pos.y - Math.sin(d) * back + Math.sin(d + Math.PI / 2) * side * (6 + k * 8);
      ctx.fillStyle = `rgba(200,205,215,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x, y, 3 + k * 9 + i, 0, TAU); ctx.fill();
    }
    return;
  }
  if (puff.kind === 'land') {
    const dur = 1.3; if (age > dur) return;
    const k = age / dur;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3, d = 10 + k * 46;
      const x = puff.pos.x + Math.cos(a) * d, y = puff.pos.y + Math.sin(a) * d * 0.7 - k * 20;
      const s = 4 * (1 - k);
      ctx.fillStyle = `rgba(255,${220 + i * 3},140,${1 - k})`;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.4, y); ctx.closePath(); ctx.fill();
    }
    return;
  }
  if (puff.kind === 'lock') {
    const dur = 0.7; if (age > dur) return;
    const k = age / dur;
    ctx.strokeStyle = `rgba(120,255,170,${1 - k})`; ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(puff.pos.x, puff.pos.y, 20 + k * 60, 0, TAU); ctx.stroke();
    return;
  }
  if (puff.kind === 'spawn') {
    const dur = 2.2; if (age > dur) return;
    const k = age / dur;
    // marker clamped to the map edge
    const m = 26;
    const x = Math.min(W - m, Math.max(m, puff.pos.x)), y = Math.min(H - m, Math.max(m, puff.pos.y));
    const pulse = 0.5 + 0.5 * Math.sin(age * 9);
    ctx.save(); ctx.translate(x, y); ctx.rotate(puff.dir ?? 0);
    ctx.fillStyle = `rgba(255,255,255,${(1 - k) * (0.5 + 0.5 * pulse)})`;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 18 + pulse * 6, 0, TAU); ctx.stroke();
  }
}

export function drawStars(ctx: Ctx, W: number, H: number, time: number, seed: number): void {
  const rng = makeRng(seed);
  for (let i = 0; i < 90; i++) {
    const x = rng() * W, y = rng() * H, tw = rng() * 5;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + tw));
    ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + rng() * 1, 0, TAU); ctx.fill();
  }
}
