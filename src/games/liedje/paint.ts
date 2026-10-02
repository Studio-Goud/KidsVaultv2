/**
 * Drawing for Liedjesmaker: five animals, the stage, the slots, the spotlight. All paths, no images.
 *
 * Each animal is one round body with its own ears, eyes and nose, so the five can be told apart by
 * silhouette as well as by colour. `sing` (0..1) opens the mouth; `squash` is the bounce.
 */

import { TAU } from '../../util/math';
import { roundRectPath, shade, hexA, contactShadow, vGrad, type Ctx } from '../../render/look';
import type { AnimalId } from './model';

/** each animal's body colour, also used to tint the note that leaves it */
export const BODY: Record<AnimalId, string> = {
  frog: '#6cc24a', dog: '#d9a066', cat: '#f2955a', bird: '#58a8ec', mouse: '#b9bec9',
};

function eye(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#17304a'; ctx.beginPath(); ctx.arc(x + r * 0.12, y + r * 0.1, r * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.2, 0, TAU); ctx.fill();
}

function mouth(ctx: Ctx, x: number, y: number, w: number, open: number): void {
  ctx.fillStyle = '#7a2330';
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, w * (0.08 + 0.34 * open), 0, 0, TAU); ctx.fill();
  if (open > 0.3) { ctx.fillStyle = '#f0848f'; ctx.beginPath(); ctx.ellipse(x, y + w * 0.12 * open, w * 0.28, w * 0.1 * open, 0, 0, TAU); ctx.fill(); }
}

export interface AnimalLook { sing?: number; squash?: number; ghost?: boolean }

/** An animal centred on (cx, cy), `r` the radius of its body. */
export function drawAnimal(ctx: Ctx, id: AnimalId, cx: number, cy: number, r: number, look: AnimalLook = {}): void {
  const open = look.sing ?? 0, sq = look.squash ?? 0;
  const col = BODY[id];
  ctx.save();
  if (look.ghost) ctx.globalAlpha = 0.55;
  // bounce: taller and thinner going up, wider and flatter landing
  ctx.translate(cx, cy + r * 0.9);
  ctx.scale(1 - sq * 0.14, 1 + sq * 0.18);
  ctx.translate(0, -r * 0.9);

  const body = (x: number, y: number, rx: number, ry: number, c = col): void => {
    const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, rx * 0.1, x, y, rx * 1.1);
    g.addColorStop(0, shade(c, 0.22)); g.addColorStop(1, shade(c, -0.1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  };

  if (id === 'frog') {
    body(-r * 0.55, -r * 0.7, r * 0.34, r * 0.34); body(r * 0.55, -r * 0.7, r * 0.34, r * 0.34);
    body(0, 0, r, r * 0.88);
    eye(ctx, -r * 0.55, -r * 0.74, r * 0.22); eye(ctx, r * 0.55, -r * 0.74, r * 0.22);
    ctx.fillStyle = '#d9f3b8'; ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.62, r * 0.4, 0, 0, TAU); ctx.fill();
    mouth(ctx, 0, r * 0.22, r * 0.9, open);
  } else if (id === 'dog') {
    ctx.fillStyle = shade(col, -0.35);
    ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.1, r * 0.3, r * 0.58, 0.25, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.1, r * 0.3, r * 0.58, -0.25, 0, TAU); ctx.fill();
    body(0, 0, r, r * 0.92);
    ctx.fillStyle = '#f6dfc0'; ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.55, r * 0.4, 0, 0, TAU); ctx.fill();
    eye(ctx, -r * 0.38, -r * 0.2, r * 0.18); eye(ctx, r * 0.38, -r * 0.2, r * 0.18);
    mouth(ctx, 0, r * 0.52, r * 0.55, open);
    ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.ellipse(0, r * 0.14, r * 0.17, r * 0.12, 0, 0, TAU); ctx.fill();
  } else if (id === 'cat') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = shade(col, -0.05);
      ctx.beginPath(); ctx.moveTo(s * r * 0.95, -r * 0.2); ctx.lineTo(s * r * 0.7, -r * 1.12); ctx.lineTo(s * r * 0.2, -r * 0.78); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f9b6b6';
      ctx.beginPath(); ctx.moveTo(s * r * 0.8, -r * 0.4); ctx.lineTo(s * r * 0.68, -r * 0.88); ctx.lineTo(s * r * 0.4, -r * 0.7); ctx.closePath(); ctx.fill();
    }
    body(0, 0, r, r * 0.88);
    ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (const dy of [-0.06, 0.1]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.45, r * (0.22 + dy)); ctx.lineTo(s * r * 1.15, r * (0.12 + dy * 3)); ctx.stroke();
    }
    eye(ctx, -r * 0.38, -r * 0.2, r * 0.18); eye(ctx, r * 0.38, -r * 0.2, r * 0.18);
    ctx.fillStyle = '#f08a8a'; ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.08); ctx.lineTo(r * 0.1, r * 0.08); ctx.lineTo(0, r * 0.2); ctx.closePath(); ctx.fill();
    mouth(ctx, 0, r * 0.45, r * 0.5, open);
  } else if (id === 'bird') {
    ctx.fillStyle = shade(col, -0.25);
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.3); ctx.lineTo(-r * 1.35, r * 0.1); ctx.lineTo(-r * 1.2, r * 0.6); ctx.closePath(); ctx.fill();
    body(0, 0, r * 0.95, r * 0.92);
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.55, r * 0.42, 0, 0, TAU); ctx.fill();
    body(-r * 0.55, r * 0.15, r * 0.3, r * 0.45, shade(col, -0.18));
    eye(ctx, r * 0.18, -r * 0.3, r * 0.2);
    // the beak opens as it sings
    ctx.fillStyle = '#f7b733';
    const bo = r * 0.16 * open;
    ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.1 - bo * 0.3); ctx.lineTo(r * 1.15, -r * 0.05 - bo); ctx.lineTo(r * 0.55, r * 0.05 - bo * 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.05 + bo * 0.3); ctx.lineTo(r * 1.05, r * 0.12 + bo); ctx.lineTo(r * 0.55, r * 0.2 + bo * 0.3); ctx.closePath(); ctx.fill();
  } else {
    for (const s of [-1, 1]) {
      body(s * r * 0.72, -r * 0.62, r * 0.4, r * 0.4, shade(col, -0.05));
      ctx.fillStyle = '#f6b5c4'; ctx.beginPath(); ctx.arc(s * r * 0.72, -r * 0.62, r * 0.24, 0, TAU); ctx.fill();
    }
    body(0, 0, r * 0.92, r * 0.86);
    ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (const dy of [-0.05, 0.12]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.3, r * (0.25 + dy)); ctx.lineTo(s * r * 1.05, r * (0.2 + dy * 2.5)); ctx.stroke();
    }
    eye(ctx, -r * 0.34, -r * 0.18, r * 0.16); eye(ctx, r * 0.34, -r * 0.18, r * 0.16);
    ctx.fillStyle = '#f08aa4'; ctx.beginPath(); ctx.ellipse(0, r * 0.12, r * 0.13, r * 0.1, 0, 0, TAU); ctx.fill();
    mouth(ctx, 0, r * 0.45, r * 0.4, open);
  }
  ctx.restore();
}

/** The backdrop: a warm stage with a curtain valance and a wooden floor under the shelf. */
export function drawStage(ctx: Ctx, w: number, h: number, floorY: number, t: number): void {
  ctx.fillStyle = vGrad(ctx, 0, h, '#ffe9bd', '#ffcf94');
  ctx.fillRect(0, 0, w, h);
  // a soft pool of warm light behind the slots
  const g = ctx.createRadialGradient(w / 2, h * 0.25, 10, w / 2, h * 0.25, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(255,250,225,0.8)'); g.addColorStop(1, 'rgba(255,250,225,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the floor
  ctx.fillStyle = vGrad(ctx, floorY, h, '#c98b52', '#a86e3c');
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, floorY, w, 3);
  ctx.strokeStyle = 'rgba(90,50,20,0.16)'; ctx.lineWidth = 1;
  for (let x = -((t * 0) % 60); x < w + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, floorY + 3); ctx.lineTo(x - 18, h); ctx.stroke(); }
}

export interface SlotLook { animal: AnimalId | null; lit: number; target: boolean; sing: number; squash: number; ghost?: boolean }

/** One slot: a tile with an animal in it, or a dashed outline for a rest. */
export function drawSlot(ctx: Ctx, x: number, y: number, s: number, look: SlotLook): void {
  const r = s * 0.2;
  ctx.save();
  ctx.fillStyle = look.target ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.72)';
  ctx.shadowColor = 'rgba(80,40,10,0.22)'; ctx.shadowBlur = s * 0.12; ctx.shadowOffsetY = s * 0.04;
  roundRectPath(ctx, x, y, s, s, r); ctx.fill();
  ctx.restore();
  if (look.lit > 0) {
    // the spotlight: a warm glow that stays a moment after it has moved on
    ctx.save();
    const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.1, x + s / 2, y + s / 2, s * 0.85);
    g.addColorStop(0, `rgba(255,236,150,${0.85 * look.lit})`); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.fillRect(x - s * 0.4, y - s * 0.4, s * 1.8, s * 1.8);
    ctx.restore();
  }
  ctx.lineWidth = Math.max(2, s * 0.04);
  if (look.animal === null) {
    ctx.save();
    ctx.setLineDash([s * 0.1, s * 0.08]);
    ctx.strokeStyle = look.target ? '#d4701c' : 'rgba(150,100,60,0.55)';
    roundRectPath(ctx, x + 2, y + 2, s - 4, s - 4, r); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = hexA(BODY[look.animal], 0.9);
    roundRectPath(ctx, x + 1.5, y + 1.5, s - 3, s - 3, r); ctx.stroke();
    contactShadow(ctx, x + s / 2, y + s * 0.86, s * 0.28, s * 0.06, 0.25);
    drawAnimal(ctx, look.animal, x + s / 2, y + s * 0.5 - look.squash * s * 0.06 - look.lit * s * 0.06, s * 0.31, { sing: look.sing, squash: look.squash, ghost: look.ghost });
  }
  if (look.lit > 0.5) {
    ctx.strokeStyle = '#ffb91f'; ctx.lineWidth = Math.max(3, s * 0.06);
    roundRectPath(ctx, x, y, s, s, r); ctx.stroke();
  }
}

/** A small note symbol that floats up from a singing animal. */
export function drawNote(ctx: Ctx, x: number, y: number, size: number, colour: string, a: number): void {
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = colour; ctx.strokeStyle = colour;
  ctx.lineWidth = size * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, y, size * 0.34, size * 0.26, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + size * 0.3, y - size * 0.05); ctx.lineTo(x + size * 0.3, y - size * 0.95); ctx.lineTo(x + size * 0.7, y - size * 0.7); ctx.stroke();
  ctx.restore();
}
