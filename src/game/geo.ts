import type { IslandDef } from './types';
import { angleDiff, TAU, type Vec } from '../util/math';
import { ValueNoise } from '../util/rng';

export interface IslandShape { poly: Vec[]; def: IslandDef; cx: number; cy: number }
export interface Rect { x: number; y: number; w: number; h: number; rot: number } // centre, size, rotation

export function pointInPoly(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const hit = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

export function scalePoly(poly: Vec[], cx: number, cy: number, s: number, dy = 0): Vec[] {
  return poly.map(p => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s + dy }));
}

export function polyArea(poly: Vec[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(a / 2);
}

/** Sample points on the boundary and inside of a rotated rectangle. */
export function rectSamples(r: Rect, step = 24): Vec[] {
  const out: Vec[] = [];
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  for (let u = -r.w / 2; u <= r.w / 2; u += step) for (let v = -r.h / 2; v <= r.h / 2; v += step) {
    out.push({ x: r.x + u * c - v * s, y: r.y + u * s + v * c });
  }
  return out;
}

/**
 * Island coastline: noisy ellipse bulged so that every "must contain" point (runways, airport footprint,
 * named decor) lies comfortably inside.
 */
export function islandPolygon(def: IslandDef, W: number, H: number, mustContain: Vec[]): IslandShape {
  const n = 120;
  const noise = new ValueNoise(def.seed);
  const cx = def.cx * W, cy = def.cy * H, rx = def.rx * W, ry = def.ry * H;
  const samples: Array<{ ang: number; rn: number }> = [];
  for (const p of mustContain) {
    const dx = (p.x - cx) / rx, dy = (p.y - cy) / ry;
    const rn = Math.hypot(dx, dy);
    if (rn > 1.6) continue; // belongs to another island
    samples.push({ ang: Math.atan2(dy, dx), rn });
  }
  for (const d of def.decor) {
    const dx = (d.x * W - cx) / rx, dy = (d.y * H - cy) / ry;
    samples.push({ ang: Math.atan2(dy, dx), rn: Math.hypot(dx, dy) + 0.06 });
  }
  const radii: number[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const f = noise.fbm2(Math.cos(th) * 1.7 + def.seed * 0.01, Math.sin(th) * 1.7, 3);
    let rn = 0.66 + 0.46 * f;
    for (const s of samples) if (Math.abs(angleDiff(th, s.ang)) < 0.22) rn = Math.max(rn, s.rn + 0.1);
    radii.push(rn);
  }
  const sm: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -3; k <= 3; k++) s += radii[(i + k + n) % n];
    sm.push(s / 7);
  }
  const poly = sm.map((rn, i) => { const th = (i / n) * TAU; return { x: cx + Math.cos(th) * rx * rn, y: cy + Math.sin(th) * ry * rn }; });
  return { poly, def, cx, cy };
}
