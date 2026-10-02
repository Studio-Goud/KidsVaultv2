/**
 * The eight animals of Kiekeboe, as round shapes: a head, a shoulder, a face that can be read from
 * across a room by a child of two. Drawn in the same spirit as the silhouettes in
 * `games/animals/creatures.ts` but self-contained, because that module is heavy and a game for the
 * youngest should load fast. Each animal is one colour, one feature that is unmistakable (horns and
 * patches, whiskers, floppy ears, a beak, wool, bulging eyes, big round eyes, a snout) and the same
 * two eyes, so they read as one family.
 */

import { shade, type Ctx } from '../../render/look';
import type { AnimalId } from './model';

const TAU = Math.PI * 2;

function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, rim = 0.07): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (rim > 0) { ctx.lineWidth = Math.max(1, Math.min(rx, ry) * rim * 2); ctx.strokeStyle = shade(fill, -0.28); ctx.stroke(); }
}

function tri(ctx: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, fill: string, lw: number): void {
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = shade(fill, -0.28); ctx.stroke();
}

function eye(ctx: Ctx, x: number, y: number, s: number, blink: number, white = false): void {
  const sy = Math.max(0.12, 1 - blink);
  if (white) ell(ctx, x, y, s * 1.35, s * 1.35 * sy, '#fffdf4', 0, 0.05);
  ell(ctx, x, y, s, s * sy, '#1f2430', 0, 0);
  if (sy > 0.5) ell(ctx, x + s * 0.32, y - s * 0.34, s * 0.32, s * 0.32, '#ffffff', 0, 0);
}

function smile(ctx: Ctx, x: number, y: number, w: number, lw: number): void {
  ctx.beginPath();
  ctx.arc(x, y - w * 0.3, w, Math.PI * 0.2, Math.PI * 0.8);
  ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = '#3a2a2a'; ctx.stroke();
}

/** a blink every few seconds, never together: `seed` is the animal's place */
export const blinkAt = (t: number, seed: number): number => {
  const p = (t + seed * 1.37) % 3.4;
  return p < 0.14 ? Math.sin((p / 0.14) * Math.PI) : 0;
};

/**
 * (x, y) is the middle of the face, `R` the nominal size: the head is 0.72 R across from its
 * middle, the shoulders hang below it. `shift` lets a night scene darken everything.
 */
export function paintAnimal(ctx: Ctx, kind: AnimalId, x: number, y: number, R: number, t: number, seed: number, tint: (c: string) => string = c => c): void {
  const k = tint;
  const hr = R * 0.72;
  const hy = y - R * 0.1;
  const bob = Math.sin(t * 5 + seed) * R * 0.025;
  const by = y + bob;
  const hyb = hy + bob;
  const blink = blinkAt(t, seed);
  const lw = Math.max(1.2, R * 0.05);
  ctx.save();
  ctx.lineJoin = 'round';

  const body = (fill: string, rx = 0.9, ry = 0.62): void => ell(ctx, x, by + R * 0.78, R * rx, R * ry, fill);
  const shine = (): void => {
    ctx.save();
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x - hr * 0.3, hyb - hr * 0.55, hr * 0.38, hr * 0.2, -0.5, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const eyes = (dx: number, dy: number, s: number, white = false): void => {
    eye(ctx, x - dx, hyb + dy, s, blink, white); eye(ctx, x + dx, hyb + dy, s, blink, white);
  };

  switch (kind) {
    case 'cow': {
      const white = k('#fbf7ee'), patch = k('#3d3a3c'), pink = k('#f2a9a6');
      body(white);
      ell(ctx, x - R * 0.4, by + R * 0.9, R * 0.28, R * 0.2, patch, 0.4, 0);
      ell(ctx, x - hr * 1.0, hyb - hr * 0.2, hr * 0.28, hr * 0.5, white, 0.5);
      ell(ctx, x + hr * 1.0, hyb - hr * 0.2, hr * 0.28, hr * 0.5, white, -0.5);
      ell(ctx, x - hr * 1.0, hyb - hr * 0.2, hr * 0.14, hr * 0.32, pink, 0.5, 0);
      ell(ctx, x + hr * 1.0, hyb - hr * 0.2, hr * 0.14, hr * 0.32, pink, -0.5, 0);
      ell(ctx, x - hr * 0.55, hyb - hr * 0.95, hr * 0.13, hr * 0.26, k('#f1e2b0'), -0.4);
      ell(ctx, x + hr * 0.55, hyb - hr * 0.95, hr * 0.13, hr * 0.26, k('#f1e2b0'), 0.4);
      ell(ctx, x, hyb, hr, hr * 0.95, white);
      ell(ctx, x - hr * 0.5, hyb - hr * 0.5, hr * 0.32, hr * 0.28, patch, 0.3, 0);
      shine();
      eyes(hr * 0.42, -hr * 0.12, hr * 0.12);
      ell(ctx, x, hyb + hr * 0.42, hr * 0.62, hr * 0.42, pink);
      ell(ctx, x - hr * 0.22, hyb + hr * 0.42, hr * 0.07, hr * 0.1, '#7a4a4a', 0, 0);
      ell(ctx, x + hr * 0.22, hyb + hr * 0.42, hr * 0.07, hr * 0.1, '#7a4a4a', 0, 0);
      break;
    }
    case 'cat': {
      const fur = k('#f0a24c'), inner = k('#f6b9b4');
      body(fur, 0.82, 0.6);
      tri(ctx, x - hr * 0.95, hyb - hr * 0.1, x - hr * 0.78, hyb - hr * 1.2, x - hr * 0.2, hyb - hr * 0.82, fur, lw);
      tri(ctx, x + hr * 0.95, hyb - hr * 0.1, x + hr * 0.78, hyb - hr * 1.2, x + hr * 0.2, hyb - hr * 0.82, fur, lw);
      tri(ctx, x - hr * 0.8, hyb - hr * 0.35, x - hr * 0.74, hyb - hr * 0.95, x - hr * 0.38, hyb - hr * 0.75, inner, 0);
      tri(ctx, x + hr * 0.8, hyb - hr * 0.35, x + hr * 0.74, hyb - hr * 0.95, x + hr * 0.38, hyb - hr * 0.75, inner, 0);
      ell(ctx, x, hyb, hr * 1.02, hr * 0.92, fur);
      ctx.strokeStyle = shade(fur, -0.25); ctx.lineWidth = lw; ctx.lineCap = 'round';
      for (const dx of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(x + hr * dx, hyb - hr * 0.88); ctx.lineTo(x + hr * dx, hyb - hr * 0.55); ctx.stroke(); }
      shine();
      eyes(hr * 0.42, -hr * 0.08, hr * 0.13);
      tri(ctx, x - hr * 0.1, hyb + hr * 0.2, x + hr * 0.1, hyb + hr * 0.2, x, hyb + hr * 0.32, k('#e9808c'), 0);
      smile(ctx, x - hr * 0.1, hyb + hr * 0.32, hr * 0.12, lw * 0.7); smile(ctx, x + hr * 0.1, hyb + hr * 0.32, hr * 0.12, lw * 0.7);
      ctx.strokeStyle = 'rgba(60,40,30,0.55)'; ctx.lineWidth = lw * 0.6;
      for (const s of [-1, 1]) for (const dy of [0.18, 0.34]) { ctx.beginPath(); ctx.moveTo(x + s * hr * 0.4, hyb + hr * dy); ctx.lineTo(x + s * hr * 1.15, hyb + hr * (dy - 0.1 + (dy > 0.2 ? 0.2 : 0))); ctx.stroke(); }
      break;
    }
    case 'dog': {
      const fur = k('#d8a065'), ear = k('#8d5a34'), snout = k('#f2dbb5');
      body(fur);
      ell(ctx, x - hr * 1.0, hyb + hr * 0.1, hr * 0.38, hr * 0.7, ear, 0.25);
      ell(ctx, x + hr * 1.0, hyb + hr * 0.1, hr * 0.38, hr * 0.7, ear, -0.25);
      ell(ctx, x, hyb, hr, hr * 0.95, fur);
      ell(ctx, x + hr * 0.4, hyb - hr * 0.15, hr * 0.3, hr * 0.32, ear, 0, 0);
      shine();
      eyes(hr * 0.4, -hr * 0.15, hr * 0.12);
      ell(ctx, x, hyb + hr * 0.4, hr * 0.5, hr * 0.38, snout);
      ell(ctx, x, hyb + hr * 0.24, hr * 0.19, hr * 0.13, '#2a2226', 0, 0);
      ell(ctx, x, hyb + hr * 0.62, hr * 0.14, hr * 0.17, k('#ee8d94'), 0, 0.05);
      break;
    }
    case 'duck': {
      const yel = k('#ffd94e'), beak = k('#f59a3b');
      body(yel, 0.88, 0.6);
      ell(ctx, x + R * 0.5, by + R * 0.8, R * 0.3, R * 0.4, shade(yel, -0.1), 0.5);
      ell(ctx, x, hyb, hr * 1.02, hr * 0.96, yel);
      ctx.strokeStyle = shade(yel, -0.3); ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, hyb - hr * 0.95); ctx.quadraticCurveTo(x - hr * 0.2, hyb - hr * 1.3, x + hr * 0.18, hyb - hr * 1.28); ctx.stroke();
      shine();
      eyes(hr * 0.45, -hr * 0.18, hr * 0.12);
      ell(ctx, x, hyb + hr * 0.3, hr * 0.62, hr * 0.28, beak);
      ctx.strokeStyle = shade(beak, -0.35); ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.moveTo(x - hr * 0.5, hyb + hr * 0.3); ctx.lineTo(x + hr * 0.5, hyb + hr * 0.3); ctx.stroke();
      break;
    }
    case 'sheep': {
      const wool = k('#f7f1e4'), face = k('#5d5049');
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 0.05 + (i / 6) * Math.PI * 0.9;
        ell(ctx, x + Math.cos(a) * R * 0.62, by + R * 0.62 + Math.sin(a) * R * 0.34, R * 0.38, R * 0.34, wool);
      }
      ell(ctx, x, by + R * 0.78, R * 0.7, R * 0.42, wool);
      ell(ctx, x - hr * 1.0, hyb + hr * 0.05, hr * 0.38, hr * 0.2, face, 0.35);
      ell(ctx, x + hr * 1.0, hyb + hr * 0.05, hr * 0.38, hr * 0.2, face, -0.35);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 1.05 + (i / 5) * Math.PI * 0.9;
        ell(ctx, x + Math.cos(a) * hr * 0.75, hyb - hr * 0.1 + Math.sin(a) * hr * 0.62, hr * 0.38, hr * 0.34, wool);
      }
      ell(ctx, x, hyb - hr * 0.62, hr * 0.5, hr * 0.32, wool);
      ell(ctx, x, hyb + hr * 0.06, hr * 0.62, hr * 0.78, face);
      eyes(hr * 0.26, -hr * 0.02, hr * 0.1, true);
      ell(ctx, x, hyb + hr * 0.4, hr * 0.12, hr * 0.08, '#2b2224', 0, 0);
      break;
    }
    case 'frog': {
      const gr = k('#6cc56a'), belly = k('#d6f0a8');
      body(gr, 0.95, 0.6);
      ell(ctx, x, by + R * 0.9, R * 0.5, R * 0.34, belly, 0, 0);
      ell(ctx, x, hyb + hr * 0.1, hr * 1.12, hr * 0.8, gr);
      for (const s of [-1, 1]) {
        ell(ctx, x + s * hr * 0.55, hyb - hr * 0.62, hr * 0.38, hr * 0.38, gr);
        eye(ctx, x + s * hr * 0.55, hyb - hr * 0.62, hr * 0.17, blink, true);
      }
      shine();
      ell(ctx, x - hr * 0.2, hyb + hr * 0.02, hr * 0.04, hr * 0.04, shade(gr, -0.4), 0, 0);
      ell(ctx, x + hr * 0.2, hyb + hr * 0.02, hr * 0.04, hr * 0.04, shade(gr, -0.4), 0, 0);
      ell(ctx, x - hr * 0.72, hyb + hr * 0.3, hr * 0.17, hr * 0.1, k('#f4a3a0'), 0, 0);
      ell(ctx, x + hr * 0.72, hyb + hr * 0.3, hr * 0.17, hr * 0.1, k('#f4a3a0'), 0, 0);
      ctx.beginPath(); ctx.arc(x, hyb + hr * 0.1, hr * 0.62, Math.PI * 0.12, Math.PI * 0.88);
      ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = '#2f5a35'; ctx.stroke();
      break;
    }
    case 'owl': {
      const br = k('#9b6c46'), chest = k('#e1bf90'), cream = k('#fff4d6');
      body(br, 0.85, 0.64);
      ell(ctx, x, by + R * 0.84, R * 0.5, R * 0.42, chest, 0, 0);
      ctx.strokeStyle = shade(chest, -0.2); ctx.lineWidth = lw * 0.8; ctx.lineCap = 'round';
      for (const [dx, dy] of [[-0.2, 0.7], [0.2, 0.7], [0, 0.88], [-0.28, 0.95], [0.28, 0.95]]) {
        ctx.beginPath(); ctx.arc(x + R * dx, by + R * dy, R * 0.1, 0.1, Math.PI - 0.1); ctx.stroke();
      }
      tri(ctx, x - hr * 0.95, hyb - hr * 0.35, x - hr * 0.7, hyb - hr * 1.15, x - hr * 0.2, hyb - hr * 0.8, br, lw);
      tri(ctx, x + hr * 0.95, hyb - hr * 0.35, x + hr * 0.7, hyb - hr * 1.15, x + hr * 0.2, hyb - hr * 0.8, br, lw);
      ell(ctx, x, hyb, hr * 1.02, hr * 0.98, br);
      shine();
      for (const s of [-1, 1]) {
        ell(ctx, x + s * hr * 0.42, hyb - hr * 0.1, hr * 0.42, hr * 0.42, cream);
        eye(ctx, x + s * hr * 0.42, hyb - hr * 0.1, hr * 0.2, blink);
      }
      tri(ctx, x - hr * 0.13, hyb + hr * 0.22, x + hr * 0.13, hyb + hr * 0.22, x, hyb + hr * 0.5, k('#f3a63e'), lw * 0.6);
      break;
    }
    case 'pig': {
      const pk = k('#f5a6b8'), dk = k('#ee8aa2');
      body(pk, 0.92, 0.62);
      tri(ctx, x - hr * 0.95, hyb - hr * 0.05, x - hr * 0.95, hyb - hr * 0.95, x - hr * 0.2, hyb - hr * 0.78, dk, lw);
      tri(ctx, x + hr * 0.95, hyb - hr * 0.05, x + hr * 0.95, hyb - hr * 0.95, x + hr * 0.2, hyb - hr * 0.78, dk, lw);
      ell(ctx, x, hyb, hr * 1.04, hr * 0.96, pk);
      shine();
      eyes(hr * 0.45, -hr * 0.2, hr * 0.12);
      ell(ctx, x - hr * 0.7, hyb + hr * 0.2, hr * 0.16, hr * 0.1, k('#f27d98'), 0, 0);
      ell(ctx, x + hr * 0.7, hyb + hr * 0.2, hr * 0.16, hr * 0.1, k('#f27d98'), 0, 0);
      ell(ctx, x, hyb + hr * 0.32, hr * 0.5, hr * 0.36, dk);
      ell(ctx, x - hr * 0.17, hyb + hr * 0.32, hr * 0.08, hr * 0.13, '#8c3d55', 0, 0);
      ell(ctx, x + hr * 0.17, hyb + hr * 0.32, hr * 0.08, hr * 0.13, '#8c3d55', 0, 0);
      break;
    }
  }
  ctx.restore();
}
