/**
 * Turning a Dino description into shapes on screen.
 *
 * One function builds the animal's silhouette, another builds its skeleton, and both read the same
 * description, so the bones always sit inside the body they belong to.
 */

import { TAU, type Vec } from '../../util/math';
import type { Dino, Limb } from './dinos';

type Ctx = CanvasRenderingContext2D;

export interface Box { x: number; y: number; w: number; h: number }

/** Maps a 0..1 point in the animal's own box onto the slab, keeping the aspect sane. */
export function mapper(slab: Box): (p: [number, number]) => Vec {
  const pad = 0.05;
  return ([nx, ny]) => ({
    x: slab.x + (pad + nx * (1 - pad * 2)) * slab.w,
    y: slab.y + (pad + ny * (1 - pad * 2)) * slab.h,
  });
}

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The point where the neck leaves the body, and where the tail does. */
function joints(d: Dino, P: (p: [number, number]) => Vec, S: number): { front: Vec; rear: Vec; head: Vec; tip: Vec; centre: Vec } {
  const c = P([d.body.x, d.body.y]);
  return {
    centre: c,
    front: P([d.body.x - d.body.rx * 0.82, d.body.y - d.body.ry * 0.35]),
    rear: P([d.body.x + d.body.rx * 0.82, d.body.y - d.body.ry * 0.2]),
    head: P(d.neck.to),
    tip: P(d.tail.to),
    // S is only used to keep the signature honest for callers that scale strokes
  } as { front: Vec; rear: Vec; head: Vec; tip: Vec; centre: Vec };
}

/** A tapered limb or tail: a quadratic spine with a width that shrinks along it. */
function taper(ctx: Ctx, a: Vec, b: Vec, ctrl: Vec, w0: number, w1: number): void {
  const steps = 16;
  const pt = (t: number): Vec => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl.y + t * t * b.y,
  });
  const left: Vec[] = [], right: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = pt(t), q = pt(Math.min(1, t + 0.01));
    const dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

function headPath(ctx: Ctx, d: Dino, base: Vec, S: number): void {
  const len = d.head.len * S, dep = d.head.depth * S;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(d.head.tilt);
  switch (d.head.kind) {
    case 'jaws':
      ctx.moveTo(0, -dep * 0.7);
      ctx.lineTo(-len * 0.82, -dep * 0.55);
      ctx.lineTo(-len, -dep * 0.1);
      ctx.lineTo(-len * 0.86, dep * 0.45);
      ctx.lineTo(-len * 0.2, dep * 0.75);
      ctx.lineTo(0, dep * 0.7);
      ctx.closePath();
      break;
    case 'beak':
      ctx.moveTo(0, -dep * 0.7);
      ctx.lineTo(-len * 0.7, -dep * 0.45);
      ctx.lineTo(-len, dep * 0.05);
      ctx.lineTo(-len * 0.62, dep * 0.5);
      ctx.lineTo(0, dep * 0.7);
      ctx.closePath();
      break;
    case 'bill':
      ctx.moveTo(0, -dep * 0.75);
      ctx.lineTo(-len * 0.55, -dep * 0.6);
      ctx.lineTo(-len, -dep * 0.15);
      ctx.lineTo(-len, dep * 0.4);
      ctx.lineTo(-len * 0.5, dep * 0.7);
      ctx.lineTo(0, dep * 0.75);
      ctx.closePath();
      break;
    case 'frill':
      // the bony frill sweeps back from the skull, the face juts forward
      ctx.moveTo(len * 0.36, -dep * 0.72);
      ctx.lineTo(len * 0.52, -dep * 0.1);
      ctx.lineTo(len * 0.40, dep * 0.6);
      ctx.lineTo(-len * 0.1, dep * 0.72);
      ctx.lineTo(-len * 0.7, dep * 0.5);
      ctx.lineTo(-len, dep * 0.05);
      ctx.lineTo(-len * 0.62, -dep * 0.4);
      ctx.lineTo(-len * 0.1, -dep * 0.72);
      ctx.closePath();
      break;
    default:
      ctx.moveTo(0, -dep * 0.7);
      ctx.lineTo(-len * 0.75, -dep * 0.5);
      ctx.lineTo(-len, 0);
      ctx.lineTo(-len * 0.7, dep * 0.6);
      ctx.lineTo(0, dep * 0.7);
      ctx.closePath();
  }
  ctx.restore();
}

/** Plates, spikes, horns and crest tubes, drawn on top of the silhouette. */
export function drawCrest(ctx: Ctx, d: Dino, slab: Box, fill: string, stroke: string): void {
  const P = mapper(slab);
  const S = slab.w * 0.9;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, slab.w * 0.004);
  if (d.crest === 'plates') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = d.body.x - d.body.rx * 0.9 + t * d.body.rx * 2.0;
      const y = d.body.y - d.body.ry * 0.95 - Math.sin(t * Math.PI) * 0.02;
      const p = P([x, y]);
      const hgt = (0.055 + Math.sin(t * Math.PI) * 0.055) * S;
      const wid = (0.03 + Math.sin(t * Math.PI) * 0.028) * S;
      ctx.beginPath();
      ctx.moveTo(p.x - wid / 2, p.y);
      ctx.quadraticCurveTo(p.x - wid * 0.35, p.y - hgt, p.x, p.y - hgt);
      ctx.quadraticCurveTo(p.x + wid * 0.35, p.y - hgt, p.x + wid / 2, p.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // tail spikes
    const tip = P(d.tail.to);
    for (let i = 0; i < 4; i++) {
      const a = (-0.5 + i * 0.34) - 0.4;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + Math.cos(a) * 0.055 * S, tip.y + Math.sin(a) * 0.055 * S);
      ctx.lineTo(tip.x + Math.cos(a + 0.12) * 0.02 * S, tip.y + Math.sin(a + 0.12) * 0.02 * S);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  if (d.crest === 'horns') {
    const h = P(d.neck.to);
    for (const [dx, dy, len, ang] of [[-0.10, -0.06, 0.085, -2.5], [-0.11, -0.01, 0.08, -2.7], [-0.13, 0.03, 0.035, -2.9]] as Array<[number, number, number, number]>) {
      const b = { x: h.x + dx * S, y: h.y + dy * S };
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 0.012 * S);
      ctx.quadraticCurveTo(b.x + Math.cos(ang) * len * S * 0.6, b.y + Math.sin(ang) * len * S * 0.6,
        b.x + Math.cos(ang) * len * S, b.y + Math.sin(ang) * len * S);
      ctx.lineTo(b.x, b.y + 0.012 * S);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  if (d.crest === 'club') {
    const tip = P(d.tail.to);
    ctx.beginPath();
    ctx.ellipse(tip.x, tip.y, 0.055 * S, 0.042 * S, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
  }
  if (d.crest === 'wings') {
    // one wing swept back from the shoulder, with a fan of primaries
    const sh = P([d.body.x - d.body.rx * 0.3, d.body.y - d.body.ry * 0.7]);
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.quadraticCurveTo(sh.x + 0.16 * S, sh.y - 0.14 * S, sh.x + 0.30 * S, sh.y - 0.04 * S);
    ctx.quadraticCurveTo(sh.x + 0.18 * S, sh.y + 0.06 * S, sh.x, sh.y + 0.03 * S);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1, slab.w * 0.002);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(sh.x + 0.05 * S + t * 0.16 * S, sh.y - 0.01 * S);
      ctx.lineTo(sh.x + 0.12 * S + t * 0.2 * S, sh.y - 0.09 * S + t * 0.05 * S);
      ctx.stroke();
    }
  }
  if (d.crest === 'tube') {
    const h = P(d.neck.to);
    ctx.beginPath();
    ctx.moveTo(h.x + 0.005 * S, h.y - 0.03 * S);
    ctx.quadraticCurveTo(h.x + 0.10 * S, h.y - 0.13 * S, h.x + 0.155 * S, h.y - 0.10 * S);
    ctx.quadraticCurveTo(h.x + 0.10 * S, h.y - 0.075 * S, h.x + 0.02 * S, h.y + 0.005 * S);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/** The living animal, as one merged silhouette. */
export function bodyPath(ctx: Ctx, d: Dino, slab: Box): void {
  const P = mapper(slab);
  const S = slab.w * 0.9;
  const j = joints(d, P, S);
  const c = P([d.body.x, d.body.y]);

  ctx.beginPath();

  // tail
  const tailCtrl = P([(d.body.x + d.tail.to[0]) / 2, (d.body.y + d.tail.to[1]) / 2 + d.tail.sag]);
  taper(ctx, j.rear, j.tip, tailCtrl, d.tail.thick * S, 0.012 * S);

  // legs
  for (const l of d.legs) {
    const hip = P(l.hip), foot = P(l.foot);
    const knee = { x: (hip.x + foot.x) / 2 + 0.03 * S, y: (hip.y + foot.y) / 2 };
    taper(ctx, hip, foot, knee, l.thick * 1.9 * S, l.thick * 0.75 * S);
    // a foot
    ctx.moveTo(foot.x - l.thick * 1.3 * S, foot.y);
    ctx.lineTo(foot.x + l.thick * 0.9 * S, foot.y);
    ctx.lineTo(foot.x + l.thick * 0.9 * S, foot.y + l.thick * 0.6 * S);
    ctx.lineTo(foot.x - l.thick * 1.3 * S, foot.y + l.thick * 0.6 * S);
    ctx.closePath();
  }

  // body
  ctx.moveTo(c.x + d.body.rx * slab.w * 0.9, c.y);
  ctx.ellipse(c.x, c.y, d.body.rx * S, d.body.ry * S, d.body.rot, 0, TAU);

  // neck
  const neckCtrl = lerpV(j.front, j.head, 0.5);
  neckCtrl.y += d.neck.curve * S;
  taper(ctx, j.front, j.head, neckCtrl, d.neck.thick * 2.1 * S, d.neck.thick * 1.25 * S);

  // head
  headPath(ctx, d, j.head, S);
}

export interface Bones {
  spine: Vec[];
  ribs: Array<{ from: Vec; to: Vec; bulge: number }>;
  limbs: Array<{ hip: Vec; knee: Vec; foot: Vec; thick: number }>;
  skull: { at: Vec; angle: number; len: number; depth: number; kind: Dino['head']['kind'] };
}

/** The skeleton, following exactly the same body plan. */
export function bones(d: Dino, slab: Box): Bones {
  const P = mapper(slab);
  const S = slab.w * 0.9;
  const j = joints(d, P, S);
  const c = P([d.body.x, d.body.y]);

  const spine: Vec[] = [];
  const headBase = j.head;
  // head to shoulder along the neck
  const neckCtrl = lerpV(j.front, headBase, 0.5); neckCtrl.y += d.neck.curve * S;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    spine.push({
      x: (1 - t) * (1 - t) * headBase.x + 2 * (1 - t) * t * neckCtrl.x + t * t * j.front.x,
      y: (1 - t) * (1 - t) * headBase.y + 2 * (1 - t) * t * neckCtrl.y + t * t * j.front.y,
    });
  }
  spine.push(c, j.rear);
  // through the tail
  const tailCtrl = P([(d.body.x + d.tail.to[0]) / 2, (d.body.y + d.tail.to[1]) / 2 + d.tail.sag]);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    spine.push({
      x: (1 - t) * (1 - t) * j.rear.x + 2 * (1 - t) * t * tailCtrl.x + t * t * j.tip.x,
      y: (1 - t) * (1 - t) * j.rear.y + 2 * (1 - t) * t * tailCtrl.y + t * t * j.tip.y,
    });
  }

  const ribs: Bones['ribs'] = [];
  for (let i = 0; i < 6; i++) {
    const t = -0.72 + (i / 5) * 1.44;
    const top = P([d.body.x + t * d.body.rx * 0.95, d.body.y - d.body.ry * 0.85]);
    const drop = d.body.ry * (1.55 - Math.abs(t) * 0.45) * S;
    ribs.push({ from: top, to: { x: top.x - 0.012 * S, y: top.y + drop }, bulge: 0.035 * S });
  }

  const limbs: Bones['limbs'] = d.legs.map((l: Limb) => {
    const hip = P(l.hip), foot = P(l.foot);
    return { hip, knee: { x: (hip.x + foot.x) / 2 + 0.032 * S, y: (hip.y + foot.y) / 2 }, foot, thick: l.thick * S };
  });

  return {
    spine, ribs, limbs,
    skull: { at: headBase, angle: d.head.tilt, len: d.head.len * S, depth: d.head.depth * S, kind: d.head.kind },
  };
}
