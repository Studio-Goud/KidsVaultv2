/**
 * The street, the bicycle and everything on it, for Suri en de fietstocht, drawn in code.
 *
 * Drawn for a four-year-old, which decided most things. The road is calm: nothing in it is fast,
 * dark or loud, and the cars are small round cars with a friendly person at the wheel, not machines
 * with faces. The traffic light has exactly the two colours the story is about. The signs are the
 * real ones - a blue round disc with a white bicycle is the real sign for a cycle path - because a
 * child who finds one here and then finds one in the street has been shown the right thing.
 *
 * Every function takes where the thing stands on the screen (`x`, and `y` at its feet) and `s`, how
 * many pixels one metre is at that distance, so the scenes decide the perspective and these only
 * draw a thing at its real size: a wheel is 0.7 m across, a door is 2 m high.
 */

import { blobPath, shade } from '../render/look';
import { fovOf, spot, type View } from './world';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// Suri's own colours, the same as the guide's (platform/guide.ts), so he is the same animal here.
const FUR = '#d9a96a';
const FUR_D = '#b9884a';
const BELLY = '#f2dcb4';
const MASK = '#4a3524';

/** A line width of at least one device-independent pixel, whatever scale the context is drawn at. */
const px = (ctx: Ctx, w: number): number => Math.max(w, 1 / Math.abs(ctx.getTransform().a));

// ---------------------------------------------------------------- the ground

/**
 * Where to cut a span into cells: fine close to the camera at the origin, where a cell seen from
 * a metre away covers a huge angle and would be thrown away, and up to `cell` metres far off.
 */
function breaks(a: number, b: number, cell: number): number[] {
  const out = [a];
  let p = a;
  while (p < b && out.length < 160) {
    const nearest = Math.abs(p);
    p = Math.min(b, p + Math.min(cell, Math.max(0.35, 0.3 * (nearest + 0.8))));
    out.push(p);
  }
  return out;
}

/**
 * A flat rectangle lying on the ground, between x0..x1 and z0..z1 metres, in the stage's own
 * perspective (`world.ts`). Drawn as a grid of small cells because a straight road is not a straight
 * line on a world that turns round you: its edges bend towards the horizon on both sides.
 */
export function groundQuad(ctx: Ctx, v: View, x0: number, x1: number, z0: number, z1: number, fill: string, cell = 1.6): void {
  const lim = fovOf(v) / 2 + 0.5;
  const xs = breaks(x0, x1, cell), zs = breaks(z0, z1, cell);
  ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.lineJoin = 'round';
  for (let i = 0; i + 1 < xs.length; i++) {
    const xa = xs[i], xb = xs[i + 1];
    for (let j = 0; j + 1 < zs.length; j++) {
      const za = zs[j], zb = zs[j + 1];
      const a = spot(v, xa, za), b = spot(v, xb, za), c = spot(v, xb, zb), d = spot(v, xa, zb);
      const offs = [a.off, b.off, c.off, d.off];
      const lo = Math.min(...offs), hi = Math.max(...offs);
      // wholly out of view, or straddling the seam behind you where the angles wrap
      if (lo > lim || hi < -lim || hi - lo > 2.4) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- Suri's gear

/** A bicycle helmet seen from the front, sitting on a head whose top is at `cy`. */
export function drawHelmet(ctx: Ctx, cx: number, cy: number, r: number, colour = '#f2b824'): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.9, 0, Math.PI, 0);
  ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.22, cx, cy + r * 0.2);
  ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 0.22, cx - r, cy);
  ctx.closePath(); ctx.fill();
  // air slots: a helmet has them so the head does not get hot
  ctx.fillStyle = shade(colour, -0.35);
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath(); ctx.ellipse(cx + k * r, cy - r * 0.55, r * 0.09, r * 0.22, k * 0.5, 0, TAU); ctx.fill();
  }
  // a band of light over the top
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = px(ctx, r * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();
  // the edge, and the two straps going down by the ears
  ctx.strokeStyle = shade(colour, -0.4); ctx.lineWidth = px(ctx, r * 0.08);
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx, cy + r * 0.3, cx + r, cy); ctx.stroke();
  ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = px(ctx, r * 0.09);
  ctx.beginPath(); ctx.moveTo(cx - r * 0.8, cy + r * 0.05); ctx.lineTo(cx - r * 0.78, cy + r * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + r * 0.8, cy + r * 0.05); ctx.lineTo(cx + r * 0.78, cy + r * 0.7); ctx.stroke();
  ctx.restore();
}

/** A bicycle bell, the round silver kind, seen from above. `ring` 0..1 makes it shiver. */
export function drawBell(ctx: Ctx, cx: number, cy: number, r: number, ring = 0): void {
  ctx.save();
  ctx.translate(cx + Math.sin(ring * 40) * ring * r * 0.06, cy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#c6d2dc'); g.addColorStop(1, '#8a9aa8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6f7f8c'; ctx.lineWidth = px(ctx, r * 0.08); ctx.stroke();
  ctx.fillStyle = '#6f7f8c';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
  // the little lever on the side that you push
  ctx.strokeStyle = '#6f7f8c'; ctx.lineWidth = px(ctx, r * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * 0.9, r * 0.2); ctx.lineTo(r * 1.25, r * 0.5); ctx.stroke();
  ctx.restore();
  if (ring > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${ring * 0.9})`; ctx.lineWidth = px(ctx, r * 0.1); ctx.lineCap = 'round';
    for (const k of [1.3, 1.7]) {
      ctx.beginPath(); ctx.arc(cx, cy, r * k, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * k, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    }
    ctx.restore();
  }
}

function wheel(ctx: Ctx, x: number, y: number, r: number, phase: number): void {
  ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#c9d3dc'; ctx.lineWidth = px(ctx, r * 0.05);
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke();
  ctx.lineWidth = px(ctx, r * 0.025);
  for (let i = 0; i < 8; i++) {
    const a = phase + (i / 8) * TAU;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke();
  }
  ctx.fillStyle = '#8a97a3';
  ctx.beginPath(); ctx.arc(x, y, r * 0.09, 0, TAU); ctx.fill();
}

export interface BikeLook { phase: number; ring?: number; frame?: string }

/**
 * The bicycle from the side, facing right, standing on (x, y). Red, with a bell on the handlebar,
 * because the story says so. The bell sits at the handlebar's grip: see `bikeBell`.
 */
export function drawBikeSide(ctx: Ctx, x: number, y: number, s: number, o: BikeLook): void {
  const frame = o.frame ?? '#d8402f';
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const R = 0.35, rx = -0.5, fx = 0.5, wy = -R;
  wheel(ctx, rx, wy, R, o.phase); wheel(ctx, fx, wy, R, o.phase);
  // the frame: two triangles
  ctx.strokeStyle = frame; ctx.lineWidth = 0.05;
  const bb = { x: 0, y: -0.32 }, seat = { x: -0.24, y: -0.88 }, head = { x: 0.38, y: -0.86 };
  ctx.beginPath();
  ctx.moveTo(rx, wy); ctx.lineTo(bb.x, bb.y); ctx.lineTo(seat.x, seat.y); ctx.lineTo(rx, wy);
  ctx.moveTo(seat.x, seat.y); ctx.lineTo(head.x, head.y); ctx.lineTo(bb.x, bb.y);
  ctx.stroke();
  // fork and steering column
  ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(fx, wy); ctx.stroke();
  ctx.lineWidth = 0.04; ctx.strokeStyle = '#3a3a44';
  ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(head.x - 0.03, -1.0); ctx.lineTo(head.x + 0.12, -1.04); ctx.stroke();
  // saddle
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath(); ctx.roundRect(seat.x - 0.14, seat.y - 0.09, 0.3, 0.06, 0.03); ctx.fill();
  ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(seat.x, seat.y); ctx.lineTo(seat.x, seat.y - 0.06); ctx.stroke();
  // crank and pedal, turning with the wheels
  const a = o.phase * 0.6;
  ctx.strokeStyle = '#8a97a3'; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(bb.x, bb.y); ctx.lineTo(bb.x + Math.cos(a) * 0.17, bb.y + Math.sin(a) * 0.17); ctx.stroke();
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath(); ctx.roundRect(bb.x + Math.cos(a) * 0.17 - 0.05, bb.y + Math.sin(a) * 0.17 - 0.015, 0.1, 0.03, 0.01); ctx.fill();
  // mudguard and a small light
  ctx.strokeStyle = shade(frame, -0.2); ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.arc(rx, wy, R * 1.12, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  ctx.restore();
  // the bell, drawn in screen units so its ring stays crisp
  const b = bikeBell(x, y, s);
  drawBell(ctx, b.x, b.y, 0.06 * s, o.ring ?? 0);
}

/** Where the bell sits on the side-view bicycle, in screen pixels. */
export function bikeBell(x: number, y: number, s: number): { x: number; y: number } {
  return { x: x + 0.44 * s, y: y - 1.1 * s };
}

export interface RiderLook {
  /** riding: pedalling on the saddle; walking: beside the bike with a paw on it; waiting: on the saddle, feet down */
  mode: 'ride' | 'walk' | 'wait';
  /** how far the wheels and legs have turned, in radians */
  phase: number;
  helmet: boolean;
  t: number;
  ring?: number;
}

/**
 * Suri and his bicycle seen from behind, the way the child sees them: the child is the one
 * following. Drawn behind the bike's own back wheel so that it reads as a thing going away.
 */
export function drawRiderBack(ctx: Ctx, x: number, y: number, s: number, o: RiderLook): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const walking = o.mode !== 'ride';
  // where the bike is: beside him when he is walking it
  const bx = walking ? 0.42 : 0;
  // ---- the back wheel: a thin upright ellipse, with a mudguard over it
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(bx, 0, 0.3, 0.06, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath(); ctx.ellipse(bx, -0.35, 0.05, 0.35, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d8402f';
  ctx.beginPath(); ctx.roundRect(bx - 0.055, -0.74, 0.11, 0.42, 0.05); ctx.fill();
  // spokes flicker: a pale stripe that moves from side to side as the wheel turns
  ctx.strokeStyle = 'rgba(220,230,240,0.7)'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(bx + Math.sin(o.phase * 3) * 0.03, -0.12); ctx.lineTo(bx + Math.sin(o.phase * 3 + 1) * 0.03, -0.3); ctx.stroke();
  // the red light at the back, because that is where it is
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath(); ctx.arc(bx, -0.6, 0.022, 0, TAU); ctx.fill();
  // ---- the frame, the saddle and the handlebar
  ctx.strokeStyle = '#d8402f'; ctx.lineWidth = 0.045;
  ctx.beginPath(); ctx.moveTo(bx, -0.72); ctx.lineTo(bx, -0.95); ctx.stroke();
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath(); ctx.ellipse(bx, -0.98, 0.12, 0.05, 0, 0, TAU); ctx.fill();
  const barY = -1.1;
  ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(bx - 0.29, barY); ctx.lineTo(bx + 0.29, barY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, barY); ctx.lineTo(bx, -0.75); ctx.stroke();
  // the bell on the right grip
  drawBell(ctx, bx + 0.22, barY - 0.03, 0.04, o.ring ?? 0);

  // ---- Suri from behind: the banded back, the tail, the ears, the helmet
  const sx = walking ? -0.2 : bx;
  const bodyBase = walking ? -0.05 : -1.0;
  const tall = walking ? 0.82 : 0.45;
  // legs
  ctx.strokeStyle = FUR_D; ctx.lineWidth = 0.075;
  if (o.mode === 'ride') {
    for (const side of [-1, 1]) {
      const pedal = Math.sin(o.phase * 0.6 + (side > 0 ? 0 : Math.PI));
      const fy = -0.3 - pedal * 0.12;
      ctx.beginPath(); ctx.moveTo(sx + side * 0.09, -0.98); ctx.lineTo(sx + side * 0.2, fy); ctx.stroke();
      ctx.fillStyle = FUR_D; ctx.beginPath(); ctx.ellipse(sx + side * 0.2, fy, 0.06, 0.03, 0, 0, TAU); ctx.fill();
    }
  } else {
    for (const side of [-1, 1]) {
      const lift = o.mode === 'walk' ? Math.max(0, Math.sin(o.phase * 0.6 + (side > 0 ? 0 : Math.PI))) * 0.06 : 0;
      ctx.fillStyle = FUR_D; ctx.beginPath(); ctx.ellipse(sx + side * 0.08, -0.03 - lift, 0.07, 0.03, 0, 0, TAU); ctx.fill();
    }
  }
  // the tail: over the saddle when riding, on the ground when walking
  ctx.strokeStyle = FUR_D; ctx.lineWidth = 0.05;
  ctx.beginPath();
  if (walking) { ctx.moveTo(sx, -0.12); ctx.quadraticCurveTo(sx - 0.06, -0.04, sx - 0.16, -0.02); } else { ctx.moveTo(sx, -0.92); ctx.quadraticCurveTo(sx + 0.12, -0.75, sx + 0.14, -0.6); }
  ctx.stroke();
  // body
  ctx.fillStyle = FUR;
  ctx.beginPath();
  ctx.moveTo(sx - 0.13, bodyBase);
  ctx.quadraticCurveTo(sx - 0.17, bodyBase - tall * 0.6, sx - 0.11, bodyBase - tall);
  ctx.quadraticCurveTo(sx, bodyBase - tall - 0.08, sx + 0.11, bodyBase - tall);
  ctx.quadraticCurveTo(sx + 0.17, bodyBase - tall * 0.6, sx + 0.13, bodyBase);
  ctx.quadraticCurveTo(sx, bodyBase + 0.04, sx - 0.13, bodyBase);
  ctx.fill();
  // the bands across the back
  ctx.strokeStyle = 'rgba(150,106,54,0.55)'; ctx.lineWidth = 0.02;
  for (let i = 1; i <= 3; i++) {
    const by = bodyBase - tall * (i / 4.4);
    ctx.beginPath(); ctx.moveTo(sx - 0.12, by); ctx.quadraticCurveTo(sx, by + 0.03, sx + 0.12, by); ctx.stroke();
  }
  // arms to the handlebar
  ctx.strokeStyle = FUR; ctx.lineWidth = 0.065;
  const shY = bodyBase - tall + 0.08;
  if (walking) {
    ctx.beginPath(); ctx.moveTo(sx + 0.11, shY); ctx.quadraticCurveTo(sx + 0.24, shY + 0.1, bx - 0.25, barY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 0.11, shY); ctx.quadraticCurveTo(sx - 0.15, shY + 0.25, sx - 0.1, shY + 0.4); ctx.stroke();
  } else {
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx + side * 0.11, shY); ctx.quadraticCurveTo(sx + side * 0.27, shY + 0.02, sx + side * 0.27, barY); ctx.stroke(); }
  }
  // head from behind: round, two ears, and the helmet over the top
  const hy = bodyBase - tall - 0.13 + (o.mode === 'ride' ? Math.sin(o.phase * 1.2) * 0.008 : 0);
  ctx.fillStyle = FUR_D;
  ctx.beginPath(); ctx.ellipse(sx - 0.13, hy - 0.03, 0.045, 0.04, -0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + 0.13, hy - 0.03, 0.045, 0.04, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(sx, hy, 0.125, 0.115, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = FUR_D;
  ctx.beginPath(); ctx.ellipse(sx, hy + 0.02, 0.06, 0.06, 0, 0, TAU); ctx.fill();
  if (o.helmet) drawHelmet(ctx, sx, hy - 0.02, 0.14);
  ctx.restore();
}

/** Suri standing beside the bicycle with his helmet on or off; a thin wrapper so the scenes stay short. */
export function helmetOnGuide(ctx: Ctx, x: number, y: number, size: number): void {
  // in the guide's own 100-unit frame the head is centred at (0, -54), 13 wide, so its crown is at -66
  const s = size / 100;
  drawHelmet(ctx, x, y - 61 * s, 15.5 * s);
}

// ---------------------------------------------------------------- signs and lights

/** The round blue sign with a white bicycle: a cycle path, for bikes. */
export function drawBikeSignFace(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1f62c4';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff';
  ctx.lineWidth = r * 0.085; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const wr = r * 0.27, wy = cy + r * 0.2;
  const lx = cx - r * 0.42, rx = cx + r * 0.42;
  ctx.beginPath(); ctx.arc(lx, wy, wr, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(rx, wy, wr, 0, TAU); ctx.stroke();
  // frame, saddle, handlebar
  ctx.beginPath();
  ctx.moveTo(lx, wy); ctx.lineTo(cx - r * 0.08, cy - r * 0.18); ctx.lineTo(cx + r * 0.22, cy - r * 0.18); ctx.lineTo(rx, wy);
  ctx.moveTo(cx - r * 0.08, cy - r * 0.18); ctx.lineTo(cx + r * 0.08, wy); ctx.lineTo(lx, wy);
  ctx.moveTo(cx + r * 0.22, cy - r * 0.18); ctx.lineTo(cx + r * 0.3, cy - r * 0.4); ctx.lineTo(cx + r * 0.46, cy - r * 0.42);
  ctx.moveTo(cx - r * 0.2, cy - r * 0.32); ctx.lineTo(cx - r * 0.02, cy - r * 0.32);
  ctx.stroke();
  ctx.restore();
}

/** A sign on a pole, its face `0.7 m` across at the top of a 2.3 m post. */
export function drawBikeSign(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, y, 0.25 * s, 0.05 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a97a3';
  ctx.fillRect(x - 0.03 * s, y - 2.3 * s, 0.06 * s, 2.3 * s);
  drawBikeSignFace(ctx, x, y - 2.3 * s, 0.35 * s);
  ctx.restore();
}

/** A lamp post: grey pole, a small warm lamp. They are what slide past when you ride. */
export function drawLamp(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, y, 0.22 * s, 0.045 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6f7a85';
  ctx.fillRect(x - 0.04 * s, y - 4.6 * s, 0.08 * s, 4.6 * s);
  ctx.beginPath(); ctx.roundRect(x - 0.05 * s, y - 4.75 * s, 0.75 * s, 0.1 * s, 0.05 * s); ctx.fill();
  ctx.fillStyle = '#fff3c0';
  ctx.beginPath(); ctx.roundRect(x + 0.4 * s, y - 4.68 * s, 0.3 * s, 0.1 * s, 0.05 * s); ctx.fill();
}

export type Lamp = 'red' | 'green' | 'off';

/**
 * A traffic light with a bicycle on it: the red lamp over the green one, on a grey post. The
 * amber lamp is there, dark, because a light with two lamps does not look like one.
 */
export function drawTrafficLight(ctx: Ctx, x: number, y: number, s: number, state: Lamp, t: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, y, 0.25 * s, 0.05 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6f7a85';
  ctx.fillRect(x - 0.05 * s, y - 2.6 * s, 0.1 * s, 2.6 * s);
  // the housing
  const hw = 0.42 * s, hh = 1.1 * s, hy = y - 2.75 * s;
  ctx.fillStyle = '#2b3038';
  ctx.beginPath(); ctx.roundRect(x - hw / 2, hy - hh * 0.5, hw, hh, 0.08 * s); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(x - hw / 2 - 0.02 * s, hy - hh * 0.5 - 0.02 * s, hw + 0.04 * s, 0.05 * s, 0.02 * s); ctx.fill();
  const lamps: Array<[Lamp | 'amber', string, string]> = [['red', '#ff3b30', '#4a1512'], ['amber', '#ffb020', '#4a3512'], ['green', '#3ddc6a', '#12401f']];
  lamps.forEach(([k, bright, dark], i) => {
    const ly = hy - hh * 0.5 + hh * (0.2 + i * 0.3), lit = k === state;
    if (lit) {
      const g = ctx.createRadialGradient(x, ly, 0, x, ly, 0.6 * s);
      g.addColorStop(0, `${bright}aa`); g.addColorStop(1, `${bright}00`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, ly, 0.6 * s * (1 + Math.sin(t * 3) * 0.04), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = lit ? bright : dark;
    ctx.beginPath(); ctx.arc(x, ly, 0.13 * s, 0, TAU); ctx.fill();
    if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - 0.04 * s, ly - 0.04 * s, 0.04 * s, 0, TAU); ctx.fill(); }
  });
  ctx.restore();
}

// ---------------------------------------------------------------- cars

export interface CarLook { colour: string; /** 1 faces right, -1 faces left */ dir: 1 | -1; wheel: number }

/**
 * A small round car from the side, 3.8 m long, with a person at the wheel who is just looking
 * ahead. Nobody in it is cross: a car that stops for you should look like it is glad to.
 */
export function drawCar(ctx: Ctx, x: number, y: number, s: number, o: CarLook): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s * o.dir, s);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 0, 1.9, 0.12, 0, 0, TAU); ctx.fill();
  // body, then the cabin
  ctx.fillStyle = o.colour;
  ctx.beginPath(); ctx.roundRect(-1.9, -0.95, 3.8, 0.7, 0.3); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1.15, -0.9); ctx.quadraticCurveTo(-0.95, -1.5, -0.5, -1.5); ctx.lineTo(0.55, -1.5); ctx.quadraticCurveTo(1.0, -1.45, 1.3, -0.9); ctx.closePath(); ctx.fill();
  // windows, and the person
  ctx.fillStyle = '#cfe8f4';
  ctx.beginPath();
  ctx.moveTo(-0.95, -0.92); ctx.quadraticCurveTo(-0.82, -1.4, -0.45, -1.4); ctx.lineTo(0.05, -1.4); ctx.lineTo(0.05, -0.92); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.2, -0.92); ctx.lineTo(0.2, -1.4); ctx.lineTo(0.52, -1.4); ctx.quadraticCurveTo(0.85, -1.36, 1.05, -0.92); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(0.6, -1.1, 0.17, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6a4a2c';
  ctx.beginPath(); ctx.arc(0.6, -1.17, 0.17, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shade(o.colour, -0.25);
  ctx.fillRect(-1.85, -0.5, 3.7, 0.05);
  // the lights: white in front, red behind
  ctx.fillStyle = '#fff3c0';
  ctx.beginPath(); ctx.ellipse(1.82, -0.68, 0.09, 0.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath(); ctx.ellipse(-1.85, -0.68, 0.07, 0.1, 0, 0, TAU); ctx.fill();
  // wheels
  for (const wx of [-1.2, 1.2]) {
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(wx, -0.3, 0.32, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9d3dc';
    ctx.beginPath(); ctx.arc(wx, -0.3, 0.17, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a97a3'; ctx.lineWidth = 0.03;
    for (let i = 0; i < 4; i++) {
      const a = o.wheel + (i / 4) * TAU;
      ctx.beginPath(); ctx.moveTo(wx, -0.3); ctx.lineTo(wx + Math.cos(a) * 0.16, -0.3 + Math.sin(a) * 0.16); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- houses

export interface HouseLook {
  /** width in metres */
  w: number;
  /** wall height in metres, up to the eaves */
  h: number;
  wall: string;
  roof: string;
  /** 0 shut .. 1 open, for grandma's door */
  door?: number;
  /** grandma standing in the open door */
  grandma?: boolean;
  /** where the door is, as a fraction of the width from the middle: grandma's is to one side, so Suri does not stand in front of her */
  doorAt?: number;
  /** window boxes with flowers, which grandma's house has */
  flowers?: boolean;
  t?: number;
}

/** A Dutch terraced-house front: brick, a pitched roof, a chimney, two windows and a door. */
export function drawHouse(ctx: Ctx, x: number, y: number, s: number, o: HouseLook): void {
  const w = o.w * s, h = o.h * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-w / 2 - 6, -2, w + 12, 4 + 0.06 * s);
  // the wall, with courses of brick drawn as faint lines
  ctx.fillStyle = o.wall;
  ctx.fillRect(-w / 2, -h, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = Math.max(1, s * 0.012);
  for (let k = 1; k < h / (0.12 * s); k++) { ctx.beginPath(); ctx.moveTo(-w / 2, -k * 0.12 * s); ctx.lineTo(w / 2, -k * 0.12 * s); ctx.stroke(); }
  // the roof and the chimney
  ctx.fillStyle = shade(o.roof, -0.1);
  ctx.fillRect(w * 0.22, -h - 0.9 * s, 0.4 * s, 1.0 * s);
  ctx.fillStyle = o.roof;
  ctx.beginPath(); ctx.moveTo(-w / 2 - 0.35 * s, -h + 0.05 * s); ctx.lineTo(0, -h - w * 0.3); ctx.lineTo(w / 2 + 0.35 * s, -h + 0.05 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(0, -h - w * 0.3); ctx.lineTo(w / 2 + 0.35 * s, -h + 0.05 * s); ctx.lineTo(0, -h + 0.05 * s); ctx.closePath(); ctx.fill();
  // windows: frame, glass, a cross bar, curtains
  const win = (cx: number): void => {
    const ww = 1.1 * s, wh = 1.25 * s, wy = -h * 0.72;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - ww / 2 - 0.05 * s, wy - 0.05 * s, ww + 0.1 * s, wh + 0.1 * s);
    ctx.fillStyle = '#a9d3ea'; ctx.fillRect(cx - ww / 2, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - ww / 2, wy, ww * 0.3, wh);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 0.02 * s, wy, 0.04 * s, wh); ctx.fillRect(cx - ww / 2, wy + wh * 0.45, ww, 0.04 * s);
    ctx.fillStyle = 'rgba(255, 230, 200, 0.85)';
    ctx.beginPath(); ctx.moveTo(cx - ww / 2, wy); ctx.lineTo(cx - ww * 0.22, wy); ctx.quadraticCurveTo(cx - ww * 0.3, wy + wh * 0.4, cx - ww / 2, wy + wh * 0.55); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + ww / 2, wy); ctx.lineTo(cx + ww * 0.22, wy); ctx.quadraticCurveTo(cx + ww * 0.3, wy + wh * 0.4, cx + ww / 2, wy + wh * 0.55); ctx.closePath(); ctx.fill();
    if (o.flowers) {
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(cx - ww / 2 - 0.06 * s, wy + wh, ww + 0.12 * s, 0.14 * s);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = ['#e0453a', '#f7c531', '#f07ab0', '#ffffff'][i % 4];
        ctx.beginPath(); ctx.arc(cx - ww / 2 + 0.05 * s + i * (ww / 6.2), wy + wh - 0.04 * s, 0.07 * s, 0, TAU); ctx.fill();
      }
    }
  };
  const da = o.doorAt ?? 0;
  if (da < -0.05) { win(w * 0.02); win(w * 0.32); } else { win(-w * 0.27); win(w * 0.27); }
  // the door
  ctx.translate(da * w, 0);
  const dw = 0.95 * s, dh = 2.05 * s, open = o.door ?? 0;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-dw / 2 - 0.06 * s, -dh - 0.06 * s, dw + 0.12 * s, dh + 0.06 * s);
  ctx.fillStyle = open > 0 ? '#3a2a24' : '#2f6f8f';
  ctx.fillRect(-dw / 2, -dh, dw, dh);
  if (open > 0) {
    // warm light in the hall, and grandma in it
    const g = ctx.createLinearGradient(0, -dh, 0, 0);
    g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, '#f2b872');
    ctx.fillStyle = g; ctx.fillRect(-dw / 2, -dh, dw * open, dh);
    if (o.grandma) drawGrandma(ctx, 0, 0, 1.55 * s, o.t ?? 0);
    // the door swung back, seen edge-on
    ctx.fillStyle = '#2f6f8f';
    ctx.fillRect(-dw / 2 - 0.14 * s * open, -dh, 0.14 * s * open, dh);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-dw / 2 + dw * 0.1, -dh + dh * 0.08, dw * 0.35, dh * 0.4);
    ctx.fillStyle = '#f7c531'; ctx.beginPath(); ctx.arc(dw * 0.3, -dh * 0.5, 0.05 * s, 0, TAU); ctx.fill();
  }
  // the step
  ctx.fillStyle = '#c9c4b8'; ctx.fillRect(-dw / 2 - 0.15 * s, -0.08 * s, dw + 0.3 * s, 0.08 * s);
  ctx.restore();
}

/** Grandma: grey hair in a bun, round glasses, a purple cardigan, one hand raised. `size` is her height. */
export function drawGrandma(ctx: Ctx, x: number, y: number, size: number, t: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  // cardigan
  ctx.fillStyle = '#8a5fb0';
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-24, -40, -14, -62); ctx.lineTo(14, -62); ctx.quadraticCurveTo(24, -40, 20, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9dcf5'; ctx.fillRect(-3, -60, 6, 58);
  // skirt
  ctx.fillStyle = '#4a4a66'; ctx.fillRect(-19, -16, 38, 16);
  // arms: one waving
  ctx.strokeStyle = '#8a5fb0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -56); ctx.quadraticCurveTo(-24, -40, -20, -26); ctx.stroke();
  const wave = Math.sin(t * 6) * 6;
  ctx.beginPath(); ctx.moveTo(14, -56); ctx.quadraticCurveTo(28, -66, 26 + wave * 0.3, -82 + Math.abs(wave) * 0.2); ctx.stroke();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(26 + wave * 0.3, -85, 5, 0, TAU); ctx.fill();
  // head
  ctx.fillStyle = '#d9d9e0';
  ctx.beginPath(); ctx.arc(0, -88, 12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -101, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.ellipse(0, -80, 11, 12.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9d9e0';
  ctx.beginPath(); ctx.ellipse(0, -88, 12, 6, 0, Math.PI, 0); ctx.fill();
  // glasses and a smile
  ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-5, -81, 3.6, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(5, -81, 3.6, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1.4, -81); ctx.lineTo(1.4, -81); ctx.stroke();
  ctx.fillStyle = '#3a2a24';
  ctx.beginPath(); ctx.arc(-5, -81, 1.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -81, 1.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#a04a3a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, -76, 4.5, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.fillStyle = 'rgba(240,122,140,0.35)';
  ctx.beginPath(); ctx.arc(-8, -76, 2.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -76, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}

/** A small garden fence of pointed white boards, `len` metres wide centred on x. */
export function drawFence(ctx: Ctx, x: number, y: number, s: number, len: number): void {
  ctx.fillStyle = '#ffffff';
  const n = Math.max(2, Math.round(len / 0.22));
  for (let i = 0; i < n; i++) {
    const px = x - (len * s) / 2 + (i + 0.5) * ((len * s) / n);
    ctx.beginPath(); ctx.moveTo(px - 0.055 * s, y); ctx.lineTo(px - 0.055 * s, y - 0.75 * s); ctx.lineTo(px, y - 0.85 * s); ctx.lineTo(px + 0.055 * s, y - 0.75 * s); ctx.lineTo(px + 0.055 * s, y); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#e9e5da';
  ctx.fillRect(x - (len * s) / 2, y - 0.55 * s, len * s, 0.05 * s);
  ctx.fillRect(x - (len * s) / 2, y - 0.25 * s, len * s, 0.05 * s);
}

/** A soft round bush, for the gardens. */
export function drawBush(ctx: Ctx, x: number, y: number, s: number, seed: number, flowers = false): void {
  ctx.save();
  ctx.fillStyle = '#3f7a3a';
  blobPath(ctx, x, y - 0.55 * s, 0.7 * s, seed, 0.12, 9); ctx.fill();
  ctx.fillStyle = '#4e8f44';
  blobPath(ctx, x - 0.12 * s, y - 0.65 * s, 0.5 * s, seed + 2, 0.12, 9); ctx.fill();
  if (flowers) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#e0453a', '#f7c531', '#f07ab0'][i % 3];
      ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.1 + seed) * 0.4 * s, y - 0.6 * s + Math.sin(i * 1.7 + seed) * 0.3 * s, 0.07 * s, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

/** The big stop button's face, a red octagon in spirit: drawn as a disc so a child reads it as a button. */
export function drawStopFace(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8342a';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; const px = cx + Math.cos(a) * r * 0.88, py = cy + Math.sin(a) * r * 0.88; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
