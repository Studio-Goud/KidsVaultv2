/**
 * The bedroom of Suri en het donker, drawn in code.
 *
 * The room is meant to be readable in the dark. A child who cannot see anything has nothing to
 * look at and nothing to find, so "night" here is a dim blue-violet with the shapes still there,
 * never black; the lamp and the night light then change the colours of the whole room (`tones`),
 * which is what a child sees happen at bedtime: the same room, warmer. Nothing in it has a face
 * except Suri. The shadow on the wall is drawn from the very same outline as the coat that makes it,
 * only stretched while it is frightening (`scare` 1) and true once the child has looked (`scare` 0):
 * that is the whole point of the chapter, so both come out of one path.
 *
 * Every function takes a context and pixels. `S` is the size of the room: one unit of furniture
 * scale, chosen by the scene from the screen, and `feetY` is where furniture stands on the floor.
 */

import { hexA, mix, shade } from '../render/look';
import { wrapAngle } from './look';
import { drawGuide } from '../platform/guide';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- light

/** How lit the room is: the bedside lamp (0..1), the night light (0..1) and its colour. */
export interface Light { lamp: number; glow: number; tint: string }

export interface Tones {
  wallTop: string; wallLow: string; floor: string; wood: string; sheet: string; pillow: string;
  blanket: string; curtain: string; coat: string; frame: string;
}

const DARK: Tones = {
  wallTop: '#3f4b78', wallLow: '#323e6a', floor: '#3c3650', wood: '#5a4843', sheet: '#b4b9d6', pillow: '#c7cbe3',
  blanket: '#45669f', curtain: '#5d4d8c', coat: '#6f4f44', frame: '#9aa3c8',
};
const LIT: Tones = {
  wallTop: '#f3dfb4', wallLow: '#ead0a0', floor: '#a27c57', wood: '#9a6a44', sheet: '#fffaf0', pillow: '#fff6e4',
  blanket: '#6ea4dc', curtain: '#c98a9a', coat: '#b4583c', frame: '#ffffff',
};

/** The colours of the room for this much light: dark, cosy under a night light, or bright under the lamp. */
export function tones(l: Light): Tones {
  const out = {} as Tones;
  for (const k of Object.keys(DARK) as Array<keyof Tones>) {
    const lit = mix(DARK[k], LIT[k], l.lamp);
    const cosy = mix(DARK[k], mix(LIT[k], l.tint, 0.5), 0.45);
    out[k] = mix(lit, cosy, l.glow * (1 - l.lamp));
  }
  return out;
}

/** A soft pool of light, for the lamp, the night light and the moon. */
export function drawGlow(ctx: Ctx, x: number, y: number, r: number, colour: string, a: number): void {
  if (a <= 0.005) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(colour, a)); g.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------------------------------------------------------------- the room

/**
 * The walls and the floor all the way round. A wallpaper of small stars repeats every 24 degrees and
 * the floorboards fan out from the wall, so turning the camera visibly turns the room.
 */
export function drawRoomBack(ctx: Ctx, w: number, h: number, yaw: number, f: number, wallY: number, tn: Tones): void {
  const g = ctx.createLinearGradient(0, 0, 0, wallY);
  g.addColorStop(0, tn.wallTop); g.addColorStop(1, tn.wallLow);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, wallY);
  const fl = ctx.createLinearGradient(0, wallY, 0, h);
  fl.addColorStop(0, shade(tn.floor, -0.12)); fl.addColorStop(1, tn.floor);
  ctx.fillStyle = fl; ctx.fillRect(0, wallY, w, h - wallY);
  // floorboards
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; ctx.lineWidth = 1.5;
  const N = 36;
  for (let k = 0; k < N; k++) {
    const x = w / 2 + wrapAngle((k / N) * TAU - yaw) * f;
    if (x < -w || x > w * 2) continue;
    ctx.beginPath(); ctx.moveTo(x, wallY); ctx.lineTo(w / 2 + (x - w / 2) * 2.2, h); ctx.stroke();
  }
  // the wallpaper
  const M = 15;
  ctx.fillStyle = hexA(tn.frame, 0.16);
  for (let k = 0; k < M; k++) {
    const x = w / 2 + wrapAngle((k / M) * TAU - yaw) * f;
    if (x < -30 || x > w + 30) continue;
    for (let r = 0; r < 3; r++) {
      const y = wallY * (0.16 + 0.27 * r + (k % 2) * 0.1);
      const s = f * 0.011;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? s * 0.35 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
  }
  // skirting board
  ctx.fillStyle = shade(tn.wood, 0.1);
  ctx.fillRect(0, wallY - f * 0.014, w, f * 0.014);
}

/** A picture on the wall: a small crescent moon in a frame. */
export function drawPicture(ctx: Ctx, x: number, y: number, S: number, tn: Tones): void {
  const pw = 0.17 * S, ph = 0.21 * S;
  ctx.fillStyle = tn.frame; ctx.fillRect(x - pw / 2, y - ph / 2, pw, ph);
  ctx.fillStyle = mix('#1e2b59', tn.wallTop, 0.25); ctx.fillRect(x - pw / 2 + 0.012 * S, y - ph / 2 + 0.012 * S, pw - 0.024 * S, ph - 0.024 * S);
  ctx.fillStyle = '#f3e7b4';
  ctx.beginPath(); ctx.arc(x, y, pw * 0.26, 0, TAU); ctx.fill();
  ctx.fillStyle = mix('#1e2b59', tn.wallTop, 0.25);
  ctx.beginPath(); ctx.arc(x + pw * 0.12, y - pw * 0.06, pw * 0.23, 0, TAU); ctx.fill();
}

/** A toy box with a teddy sitting in it, which is on its side of the room to be ordinary. */
export function drawToyBox(ctx: Ctx, x: number, feetY: number, S: number, tn: Tones): void {
  const bw = 0.26 * S, bh = 0.14 * S;
  // teddy
  ctx.fillStyle = mix('#b98a5c', tn.wallLow, 0.25);
  ctx.beginPath(); ctx.arc(x, feetY - bh - 0.06 * S, 0.06 * S, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 0.05 * S, feetY - bh - 0.105 * S, 0.022 * S, 0, TAU); ctx.arc(x + 0.05 * S, feetY - bh - 0.105 * S, 0.022 * S, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(30, 20, 20, 0.7)';
  ctx.beginPath(); ctx.arc(x - 0.02 * S, feetY - bh - 0.07 * S, 0.008 * S, 0, TAU); ctx.arc(x + 0.02 * S, feetY - bh - 0.07 * S, 0.008 * S, 0, TAU); ctx.fill();
  // box
  ctx.fillStyle = mix(tn.wood, '#c86a5a', 0.4);
  ctx.beginPath(); ctx.roundRect(x - bw / 2, feetY - bh, bw, bh, 0.015 * S); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'; ctx.fillRect(x - bw / 2, feetY - bh, bw, 0.02 * S);
}

// ---------------------------------------------------------------- Suri

export interface HeadLook {
  /** 0..1: eyebrows up in the middle and a wobbly mouth */
  worry: number;
  shut?: boolean;
  /** 0..1: a small smile */
  smile?: number;
  t?: number;
}

const FUR = '#d9a96a', FUR_D = '#b9884a', BELLY = '#f2dcb4', MASK = '#4a3524', NOSE = '#2e2119', EAR = '#6b4d32';

/**
 * Suri's head seen from the front, at `s` pixels per unit (his face is 26 units wide). The same
 * parts as the guide, because he has to be the same meerkat; the guide has no pose for a face that
 * is half under a blanket, so this draws only the head.
 */
export function drawSuriHead(ctx: Ctx, x: number, y: number, s: number, o: HeadLook): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = FUR_D;
  ctx.beginPath(); ctx.ellipse(-12.5, -7, 7, 6, -0.35, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12.5, -7, 7, 6, 0.35, 0, TAU); ctx.fill();
  ctx.fillStyle = EAR;
  ctx.beginPath(); ctx.ellipse(-12, -7, 4, 3.4, -0.35, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, -7, 4, 3.4, 0.35, 0, TAU); ctx.fill();
  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(0, -2, 13, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, 1); ctx.quadraticCurveTo(0, 2, 5, 1); ctx.quadraticCurveTo(8, 7, 0, 9); ctx.quadraticCurveTo(-8, 7, -5, 1);
  ctx.fill();
  ctx.fillStyle = BELLY;
  ctx.beginPath(); ctx.ellipse(0, 5, 5, 3.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = MASK;
  ctx.beginPath(); ctx.ellipse(-6, -4, 6, 4.4, -0.22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -4, 6, 4.4, 0.22, 0, TAU); ctx.fill();
  const blink = Math.sin((o.t ?? 0) * 0.9) > 0.985;
  if (o.shut || blink) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-6, -4.6, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, -4.6, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-6, -4, 2.9, 3.1, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -4, 2.9, 3.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = NOSE;
    ctx.beginPath(); ctx.arc(-5.6, -3.6, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6.4, -3.6, 1.8, 0, TAU); ctx.fill();
  }
  if (o.worry > 0.05) {
    // brows going up towards the middle, the way a worried face does
    ctx.strokeStyle = MASK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    const up = 2.6 * o.worry;
    ctx.beginPath(); ctx.moveTo(-10.5, -9.5); ctx.lineTo(-3, -9.5 - up); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10.5, -9.5); ctx.lineTo(3, -9.5 - up); ctx.stroke();
  }
  ctx.fillStyle = NOSE;
  ctx.beginPath(); ctx.ellipse(0, 3, 2.6, 2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = NOSE; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  const sm = o.smile ?? 0;
  ctx.beginPath();
  if (sm > 0.1) ctx.arc(0, 6, 2.6, 0.2, Math.PI - 0.2);
  else { ctx.moveTo(-2.4, 7.4); ctx.quadraticCurveTo(-1, 6.2, 0, 7.2); ctx.quadraticCurveTo(1, 8.2, 2.4, 7); }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the bed

/** Where things are on a bed of this size: the scenes need it to put Suri and the taps on it. */
export function bedSpots(x: number, feetY: number, S: number): { x0: number; yM: number; w: number; head: { x: number; y: number }; sit: { x: number; y: number }; s: number } {
  const w = 0.54 * S, x0 = x - w / 2, yM = feetY - 0.17 * S;
  return { x0, yM, w, head: { x: x0 + 0.11 * S, y: yM - 0.09 * S }, sit: { x: x0 + 0.29 * S, y: yM + 0.02 * S }, s: 0.0046 * S };
}

export type SuriInBed = 'hide' | 'peek' | 'sit' | 'sleep';

/**
 * The bed with Suri in it. Suri is drawn between the pillow and the blanket so the blanket can come
 * up to his nose. `hide` shows only eyes and ears over the edge, `peek` the whole face, `sit` has him
 * upright with the blanket over his legs, `sleep` has his eyes shut.
 */
export function drawBed(ctx: Ctx, x: number, feetY: number, S: number, tn: Tones, who: SuriInBed, worry: number, t: number, talking: number): void {
  const b = bedSpots(x, feetY, S);
  const { x0, yM, w: BW } = b;
  ctx.fillStyle = shade(tn.wood, -0.05);
  ctx.beginPath(); ctx.roundRect(x0 - 0.025 * S, feetY - 0.4 * S, 0.045 * S, 0.4 * S, 0.02 * S); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x0 + BW - 0.02 * S, feetY - 0.26 * S, 0.04 * S, 0.26 * S, 0.02 * S); ctx.fill();
  ctx.fillStyle = tn.wood; ctx.fillRect(x0, yM + 0.08 * S, BW, 0.045 * S);
  ctx.fillStyle = tn.sheet; ctx.beginPath(); ctx.roundRect(x0, yM, BW, 0.09 * S, 0.03 * S); ctx.fill();
  ctx.fillStyle = tn.pillow;
  ctx.beginPath(); ctx.ellipse(x0 + 0.11 * S, yM - 0.012 * S, 0.085 * S, 0.05 * S, 0, 0, TAU); ctx.fill();

  if (who === 'sit') {
    drawGuide(ctx, b.sit.x, b.sit.y, 0.42 * S, { pose: talking > 0 ? 'talk' : 'watch', t, facing: 1, saying: talking });
  } else if (who === 'sleep') {
    drawSuriHead(ctx, b.head.x, b.head.y, b.s, { worry: 0, shut: true, smile: 1, t });
  } else {
    const drop = who === 'hide' ? 0.03 * S : 0;
    // a scared Suri shivers a little; a tucked-in one does not
    const shake = who === 'hide' ? Math.sin(t * 19) * 0.0015 * S : 0;
    drawSuriHead(ctx, b.head.x + shake, b.head.y + drop, b.s, { worry, t });
  }

  // the blanket: up to his nose in bed, over his legs when he sits
  const g = ctx.createLinearGradient(0, yM - 0.09 * S, 0, yM + 0.09 * S);
  g.addColorStop(0, shade(tn.blanket, 0.12)); g.addColorStop(1, shade(tn.blanket, -0.12));
  ctx.fillStyle = g;
  ctx.beginPath();
  const edge = who === 'sit' ? yM - 0.03 * S : yM - 0.05 * S;
  ctx.moveTo(x0 + 0.03 * S, edge);
  ctx.quadraticCurveTo(x0 + 0.2 * S, yM - 0.1 * S, x0 + 0.42 * S, who === 'sit' ? yM - 0.05 * S : yM - 0.065 * S);
  ctx.quadraticCurveTo(x0 + 0.52 * S, yM - 0.05 * S, x0 + BW + 0.01 * S, yM - 0.03 * S);
  ctx.lineTo(x0 + BW + 0.01 * S, yM + 0.085 * S);
  ctx.lineTo(x0 + 0.03 * S, yM + 0.085 * S);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = hexA('#ffffff', 0.14);
  ctx.beginPath(); ctx.roundRect(x0 + 0.03 * S, edge - 0.002 * S, BW * 0.9, 0.02 * S, 0.01 * S); ctx.fill();
  ctx.fillStyle = hexA('#000000', 0.08);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x0 + (0.22 + i * 0.09) * S, yM + 0.03 * S, 0.012 * S, 0.03 * S, 0.3, 0, TAU); ctx.fill(); }
}

// ---------------------------------------------------------------- the nightstand, lamp and night lights

export function nightstandTop(x: number, feetY: number, S: number): { x: number; y: number; w: number } {
  return { x, y: feetY - 0.2 * S, w: 0.17 * S };
}

export function drawNightstand(ctx: Ctx, x: number, feetY: number, S: number, tn: Tones): void {
  const t = nightstandTop(x, feetY, S);
  ctx.fillStyle = tn.wood;
  ctx.beginPath(); ctx.roundRect(t.x - t.w / 2, t.y, t.w, 0.2 * S, 0.012 * S); ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'; ctx.fillRect(t.x - t.w / 2 + 0.012 * S, t.y + 0.05 * S, t.w - 0.024 * S, 0.005 * S);
  ctx.fillStyle = shade(tn.wood, 0.25);
  ctx.beginPath(); ctx.arc(t.x, t.y + 0.1 * S, 0.008 * S, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(tn.wood, 0.12); ctx.fillRect(t.x - t.w / 2 - 0.008 * S, t.y - 0.008 * S, t.w + 0.016 * S, 0.012 * S);
}

/** The bedside lamp, sitting on its table with its foot at (x, y). Returns the middle of the shade. */
export function drawLamp(ctx: Ctx, x: number, y: number, S: number, on: number, tn: Tones): { x: number; y: number } {
  ctx.fillStyle = shade(tn.wood, 0.1);
  ctx.beginPath(); ctx.ellipse(x, y - 0.006 * S, 0.028 * S, 0.01 * S, 0, 0, TAU); ctx.fill();
  ctx.fillRect(x - 0.005 * S, y - 0.07 * S, 0.01 * S, 0.065 * S);
  const sy = y - 0.15 * S;
  ctx.fillStyle = mix('#c9a66e', '#fff0b0', on);
  ctx.beginPath();
  ctx.moveTo(x - 0.03 * S, sy); ctx.lineTo(x + 0.03 * S, sy); ctx.lineTo(x + 0.055 * S, sy + 0.085 * S); ctx.lineTo(x - 0.055 * S, sy + 0.085 * S);
  ctx.closePath(); ctx.fill();
  return { x, y: sy + 0.04 * S };
}

/** A small night light: a low dome on a base. With `on` it glows in its own colour. */
export function drawNightLight(ctx: Ctx, x: number, y: number, size: number, colour: string, on: number): void {
  if (on > 0.01) drawGlow(ctx, x, y - size * 0.4, size * 4.2, colour, 0.55 * on);
  ctx.fillStyle = '#d9d2c4';
  ctx.beginPath(); ctx.roundRect(x - size * 0.5, y - size * 0.18, size, size * 0.18, size * 0.05); ctx.fill();
  ctx.fillStyle = mix(shade(colour, -0.45), colour, 0.25 + 0.75 * on);
  ctx.beginPath(); ctx.arc(x, y - size * 0.18, size * 0.42, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hexA('#ffffff', 0.25 + 0.3 * on);
  ctx.beginPath(); ctx.ellipse(x - size * 0.15, y - size * 0.42, size * 0.1, size * 0.05, -0.5, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- the window

export interface Rect { x: number; y: number; w: number; h: number }

export function windowRect(x: number, feetY: number, S: number): Rect {
  return { x: x - 0.17 * S, y: feetY - 0.78 * S, w: 0.34 * S, h: 0.46 * S };
}

/**
 * A sash window with a curtain either side. `open` is 0 (shut) to 1 (pushed up as far as it goes):
 * the lower pane slides up, the gap shows the night, and the right curtain moves with the wind. The
 * wind is drawn as a few soft curved lines slipping in through the gap, never as anything with a
 * shape to it.
 */
export function drawWindow(ctx: Ctx, x: number, feetY: number, S: number, open: number, tn: Tones, t: number): void {
  const r = windowRect(x, feetY, S);
  const sky = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  sky.addColorStop(0, '#0f1838'); sky.addColorStop(1, '#2d3868');
  ctx.fillStyle = sky; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#f4efd2';
  ctx.beginPath(); ctx.arc(r.x + r.w * 0.3, r.y + r.h * 0.28, r.w * 0.09, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 1.3 + i * 1.9));
    ctx.fillRect(r.x + ((i * 0.37 + 0.11) % 1) * r.w, r.y + ((i * 0.61 + 0.07) % 1) * r.h * 0.6, 2, 2);
  }
  ctx.globalAlpha = 1;
  // the lower sash, slid up by `open`
  const lift = open * r.h * 0.16;
  const sy = r.y + r.h * 0.5 - lift;
  ctx.fillStyle = 'rgba(190, 210, 255, 0.14)'; ctx.fillRect(r.x, sy, r.w, r.h * 0.5);
  const fw = 0.018 * S;
  ctx.strokeStyle = tn.frame; ctx.lineWidth = fw;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.beginPath(); ctx.moveTo(r.x, sy); ctx.lineTo(r.x + r.w, sy); ctx.moveTo(r.x + r.w / 2, r.y); ctx.lineTo(r.x + r.w / 2, r.y + r.h - lift * 0.0); ctx.stroke();
  // a small handle on the sash to take hold of
  ctx.fillStyle = tn.frame;
  ctx.beginPath(); ctx.roundRect(r.x + r.w * 0.38, sy + r.h * 0.44 - 0.0, r.w * 0.24, 0.016 * S, 0.008 * S); ctx.fill();
  // the sill
  ctx.fillStyle = shade(tn.wood, 0.1);
  ctx.fillRect(r.x - 0.02 * S, r.y + r.h, r.w + 0.04 * S, 0.02 * S);
  // the wind: a few lines slipping in through the gap
  if (open > 0.05) {
    ctx.strokeStyle = `rgba(220, 230, 255, ${0.35 * Math.min(1, open * 2)})`; ctx.lineWidth = 0.008 * S; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.45 + i / 3) % 1;
      const yy = r.y + r.h - 0.02 * S - i * 0.03 * S;
      const xx = r.x - 0.08 * S + k * (r.w + 0.12 * S);
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.bezierCurveTo(xx + 0.03 * S, yy - 0.02 * S, xx + 0.05 * S, yy + 0.02 * S, xx + 0.09 * S, yy); ctx.stroke();
    }
  }
  // the curtains; the right one is moved by the wind while the window is open
  const billow = open * Math.sin(t * 1.7) * 0.03 * S + open * 0.018 * S;
  const rod = r.y - 0.03 * S;
  ctx.strokeStyle = shade(tn.wood, 0.2); ctx.lineWidth = 0.008 * S;
  ctx.beginPath(); ctx.moveTo(r.x - 0.07 * S, rod); ctx.lineTo(r.x + r.w + 0.07 * S, rod); ctx.stroke();
  const hem = r.y + r.h + 0.08 * S;
  for (const side of [-1, 1]) {
    const outer = side < 0 ? r.x - 0.05 * S : r.x + r.w + 0.05 * S;
    const inner = side < 0 ? r.x + 0.06 * S : r.x + r.w - 0.06 * S;
    const sway = side > 0 ? billow : 0;
    ctx.fillStyle = tn.curtain;
    ctx.beginPath();
    ctx.moveTo(outer, rod);
    ctx.lineTo(inner, rod);
    ctx.bezierCurveTo(inner - sway, r.y + r.h * 0.4, inner - sway * 2, r.y + r.h * 0.8, inner - sway * 1.4, hem);
    ctx.lineTo(outer, hem);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'; ctx.lineWidth = 0.007 * S;
    for (let i = 1; i < 4; i++) {
      const fx = outer + (inner - outer) * (i / 4);
      ctx.beginPath(); ctx.moveTo(fx, rod); ctx.lineTo(fx - sway * 1.2 * (i / 4), hem); ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- the chair, the coat and its shadow

export function chairSpot(x: number, feetY: number, S: number): { x: number; y: number } {
  // the middle of the chair and coat, which is where the child looks for it
  return { x, y: feetY - 0.26 * S };
}

/**
 * The coat as one outline, in units of its own height with the origin at the top of the hood: a
 * hood, shoulders, a body, and two sleeves hanging. Used for the coat and for its shadow, so the
 * shadow is always the coat's.
 */
function coatPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(0, 0.09, 0.19, 0.13, 0, 0, TAU);
  ctx.moveTo(-0.17, 0.14);
  ctx.quadraticCurveTo(0, 0.24, 0.17, 0.14);
  ctx.lineTo(0.27, 0.22); ctx.lineTo(0.3, 1); ctx.lineTo(-0.3, 1); ctx.lineTo(-0.27, 0.22);
  ctx.closePath();
}

function sleeves(ctx: Ctx, out: number, up: number): void {
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.26, 0.26);
    ctx.lineTo(s * (0.34 + 0.45 * out), 0.82 - 0.72 * up);
    ctx.stroke();
  }
}

/** A plain wooden chair with a coat hung on the back of it, standing on the floor at `feetY`. */
export function drawChair(ctx: Ctx, x: number, feetY: number, S: number, tn: Tones): void {
  ctx.fillStyle = tn.wood; ctx.strokeStyle = tn.wood;
  const seatY = feetY - 0.17 * S, hw = 0.1 * S;
  for (const dx of [-hw, hw]) {
    ctx.fillRect(x + dx - 0.007 * S, seatY, 0.014 * S, 0.17 * S);
    ctx.fillRect(x + dx - 0.007 * S, feetY - 0.38 * S, 0.014 * S, 0.21 * S);
  }
  ctx.fillRect(x - hw, feetY - 0.385 * S, hw * 2, 0.03 * S);
  for (const k of [-0.5, 0, 0.5]) ctx.fillRect(x + k * hw - 0.004 * S, feetY - 0.35 * S, 0.008 * S, 0.17 * S);
  ctx.fillStyle = shade(tn.wood, 0.1);
  ctx.beginPath(); ctx.roundRect(x - hw - 0.012 * S, seatY - 0.005 * S, hw * 2 + 0.024 * S, 0.028 * S, 0.008 * S); ctx.fill();
  // the coat, over the back, with its hood above it
  drawCoat(ctx, x, feetY - 0.42 * S, 0.3 * S, tn.coat);
}

export function drawCoat(ctx: Ctx, x: number, topY: number, sz: number, colour: string): void {
  ctx.save();
  ctx.translate(x, topY); ctx.scale(sz, sz);
  ctx.fillStyle = colour; ctx.strokeStyle = shade(colour, -0.08);
  coatPath(ctx); ctx.fill();
  ctx.lineWidth = 0.15; sleeves(ctx, 0, 0);
  ctx.fillStyle = shade(colour, 0.12); ctx.beginPath(); ctx.ellipse(0, 0.12, 0.11, 0.07, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(colour, -0.25);
  ctx.fillRect(-0.004, 0.25, 0.008, 0.75);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0.04, 0.36 + i * 0.16, 0.015, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/**
 * The shadow of the coat on the wall. `scare` 1 is the shape in the dark: too tall, the sleeves
 * thrown out like arms, soft at the edges. `scare` 0 is what it really is: the coat's own outline,
 * and the back of the chair under it. There are no eyes and nothing in it moves by itself; it is
 * unsettling only because it is big and unexplained.
 */
export function drawCoatShadow(ctx: Ctx, x: number, topY: number, sz: number, scare: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, topY);
  ctx.scale(sz * (1 + 0.25 * scare), sz * (1 + 0.55 * scare));
  const c = `rgba(8, 10, 30, ${alpha})`;
  ctx.fillStyle = c; ctx.strokeStyle = c;
  ctx.shadowColor = c; ctx.shadowBlur = sz * (0.03 + 0.05 * scare);
  coatPath(ctx); ctx.fill();
  ctx.lineWidth = 0.15; sleeves(ctx, scare, scare);
  if (scare < 1) {
    // the back of the chair, as a real shadow of it would be, fading as the shape grows
    ctx.globalAlpha = 1 - scare;
    ctx.lineWidth = 0.03;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.33, 0.6); ctx.lineTo(s * 0.33, 1.25); ctx.stroke(); }
    ctx.fillRect(-0.33, 0.58, 0.66, 0.06);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- breathing

/**
 * The circle that grows and shrinks. `k` is 0 (smallest) to 1 (biggest). The outer ring always
 * shows how big it will get, so a child can see the end of the in-breath coming; it lights up while a
 * finger is on the circle.
 */
export function drawBreathCircle(ctx: Ctx, x: number, y: number, rMin: number, rMax: number, k: number, held: boolean, t: number): void {
  const r = rMin + (rMax - rMin) * k;
  drawGlow(ctx, x, y, r * 2, '#9fb4ff', 0.35 + 0.2 * k);
  ctx.strokeStyle = held ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = Math.max(2, rMax * 0.03); ctx.setLineDash([rMax * 0.08, rMax * 0.07]);
  ctx.beginPath(); ctx.arc(x, y, rMax * 1.08, t * 0.08, TAU + t * 0.08); ctx.stroke();
  ctx.setLineDash([]);
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#e4ecff'); g.addColorStop(0.6, '#a9bbff'); g.addColorStop(1, '#7f93e6');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = held ? '#ffffff' : 'rgba(255, 255, 255, 0.55)'; ctx.lineWidth = Math.max(2, rMax * 0.04);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}

/** Three little moons in a row, one filled for each slow breath done. */
export function drawBreathCount(ctx: Ctx, x: number, y: number, r: number, done: number, total: number): void {
  for (let i = 0; i < total; i++) {
    const cx = x + (i - (total - 1) / 2) * r * 2.8;
    ctx.fillStyle = i < done ? '#fff3b0' : 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.stroke();
  }
}
