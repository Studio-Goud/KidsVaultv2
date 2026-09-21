/**
 * Everything Klankhuis draws: the room, the chimes, and the pieces the levels are built from.
 *
 * Two rules run through all of it. The first is that pitch is a colour, the way real chime bars
 * and boomwhackers are colour-coded - C is red, D orange, E yellow, and so on round to B - so a
 * child who cannot read a note name can still be told which bar to hit, and the same colour means
 * the same note on the bars, on the timeline, on the ladder and in the sequencer grid.
 *
 * The second is that a low bar is a long bar. On a real xylophone the pitch is the length of the
 * bar, so here the low chimes are drawn taller than the high ones and the row slopes away to the
 * right. That is a fact about the instrument, not decoration, and a child works it out by looking.
 */

import { clamp, TAU } from '../../util/math';
import {
  contactShadow, grainOver, hexA, LIGHT, mix, roundRectPath, shade,
} from '../../render/look';
import { colourIndexOfMidi, letterOfMidi } from './music';

type Ctx = CanvasRenderingContext2D;

/** C, D, E, F, G, A, B. The order a boomwhacker set comes in. */
export const PITCH_COLOURS = ['#e05a4b', '#ef8f3f', '#f0c73c', '#6fbe5a', '#38b6ad', '#4a8ed6', '#9a6ccd'];

export const colourOf = (midi: number): string => PITCH_COLOURS[colourIndexOfMidi(midi)];

// ---------------------------------------------------------------- the room

/**
 * The room the instrument stands in: a warm wall with a rail along it, a wooden floor, and the
 * light coming in from the top left like everywhere else in Bramblewood.
 */
export function drawRoom(ctx: Ctx, w: number, h: number, t: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#2c4a63');
  wall.addColorStop(0.42, '#3f6a86');
  wall.addColorStop(0.62, '#7d9aa8');
  wall.addColorStop(0.64, '#a9825a');
  wall.addColorStop(1, '#7a5a3c');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // a pool of light from the top left, so the wall is not a flat sheet
  const lamp = ctx.createRadialGradient(w * 0.24, -h * 0.1, 0, w * 0.24, h * 0.1, Math.max(w, h) * 0.9);
  lamp.addColorStop(0, 'rgba(255, 238, 200, 0.35)');
  lamp.addColorStop(0.4, 'rgba(255, 230, 190, 0.09)');
  lamp.addColorStop(1, 'rgba(255, 230, 190, 0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);

  // the picture rail, and the floorboards under it
  const railY = Math.round(h * 0.63);
  ctx.strokeStyle = 'rgba(38, 24, 12, 0.35)';
  ctx.lineWidth = Math.max(1.5, h * 0.004);
  ctx.beginPath(); ctx.moveTo(0, railY); ctx.lineTo(w, railY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 228, 190, 0.22)';
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.beginPath(); ctx.moveTo(0, railY + ctx.lineWidth * 1.6); ctx.lineTo(w, railY + ctx.lineWidth * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 38, 18, 0.22)';
  ctx.lineWidth = Math.max(1, h * 0.0022);
  for (let i = 1; i < 7; i++) {
    const y = railY + (h - railY) * (i / 7) * (i / 7);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // dust in the light, very slow, so the room is never perfectly still
  ctx.fillStyle = 'rgba(255, 246, 220, 0.16)';
  for (let i = 0; i < 16; i++) {
    const px = ((i * 137.5) % 100) / 100;
    const py = ((i * 61.8) % 100) / 100;
    const x = (px * 1.2 - 0.1) * w + Math.sin(t * 0.22 + i) * w * 0.02;
    const y = ((py + t * 0.008 + i * 0.03) % 1) * railY;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, w * 0.0022 * (0.5 + px)), 0, TAU); ctx.fill();
  }

  grainOver(ctx, 0, 0, w, h, 0.045);
}

// ---------------------------------------------------------------- the chimes

export interface BarLook {
  midi: number;
  /** 0 to 1: just struck */
  glow: number;
  /** a finger is on it now */
  pressed?: boolean;
  /** the game is pointing at this bar */
  point?: boolean;
  /** greyed, because it is not part of this question */
  dim?: boolean;
  /** a tick on the bar, for a note already played back right */
  tick?: boolean;
  /** a cross on the bar, for the one that was wrong */
  cross?: boolean;
}

/**
 * One chime bar: a metal plate on two pegs, over a hollow the sound comes out of.
 *
 * The glow is the whole point of the drawing. A note that has just sounded has to be visible for
 * the third of a second it is ringing, or a child cannot tell which of nine bars the game just
 * played - which is the entire difficulty of the echo levels.
 */
export function chimeBar(ctx: Ctx, x: number, y: number, w: number, h: number, look: BarLook): void {
  const base = colourOf(look.midi);
  const g = clamp(look.glow, 0, 1);
  const down = look.pressed ? h * 0.02 : 0;
  const r = Math.min(w * 0.3, h * 0.16, 16);

  ctx.save();
  if (look.dim) ctx.globalAlpha = 0.34;

  // the hollow under the bar
  ctx.fillStyle = 'rgba(28, 18, 10, 0.4)';
  roundRectPath(ctx, x + w * 0.1, y + h * 0.06, w * 0.8, h, r);
  ctx.fill();

  const top = y + down;
  // the plate, lit from the top left
  const face = ctx.createLinearGradient(x + LIGHT.x * w, top + LIGHT.y * h, x + w - LIGHT.x * w, top + h);
  const lit = mix(base, '#ffffff', 0.34 + g * 0.42);
  face.addColorStop(0, lit);
  face.addColorStop(0.42, mix(base, '#ffffff', g * 0.5));
  face.addColorStop(1, shade(base, -0.24 + g * 0.3));
  ctx.save();
  if (g > 0.02) {
    ctx.shadowColor = hexA(base, 0.7 * g);
    ctx.shadowBlur = w * 0.7 * g;
  }
  ctx.fillStyle = face;
  roundRectPath(ctx, x, top, w, h, r);
  ctx.fill();
  ctx.restore();

  // a band of light along the top third: what makes it read as metal rather than a card
  ctx.save();
  roundRectPath(ctx, x, top, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, top, 0, top + h * 0.5);
  sheen.addColorStop(0, `rgba(255,255,255,${0.42 + g * 0.3})`);
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, top, w, h * 0.5);
  grainOver(ctx, x, top, w, h, 0.05);
  ctx.restore();

  ctx.strokeStyle = hexA(shade(base, -0.45), 0.55);
  ctx.lineWidth = Math.max(1, w * 0.02);
  roundRectPath(ctx, x + 0.5, top + 0.5, w - 1, h - 1, r);
  ctx.stroke();

  // The two pegs the bar rests on. They sit in the upper half rather than at the ends, so the
  // letter along the foot of a short bar never lands on top of one.
  ctx.fillStyle = 'rgba(52, 34, 18, 0.7)';
  for (const fy of [top + h * 0.26, top + h * 0.58]) {
    ctx.beginPath(); ctx.arc(x + w / 2, fy, Math.max(1.5, w * 0.05), 0, TAU); ctx.fill();
  }

  // the letter, for whoever wants it; the colour is the real label
  const fs = Math.max(9, Math.min(Math.round(w * 0.34), Math.round(h * 0.2), 19));
  ctx.fillStyle = 'rgba(28, 18, 10, 0.52)';
  ctx.font = `900 ${fs}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(letterOfMidi(look.midi), x + w / 2, top + h - fs * 0.75);

  if (look.point) {
    ctx.strokeStyle = '#fff6d2';
    ctx.lineWidth = Math.max(2, w * 0.09);
    ctx.setLineDash([w * 0.22, w * 0.18]);
    roundRectPath(ctx, x - w * 0.06, top - w * 0.06, w * 1.12, h + w * 0.12, r * 1.2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (look.tick || look.cross) {
    const cx = x + w / 2, cy = top + h * 0.2, rr = Math.max(7, w * 0.26);
    ctx.fillStyle = look.tick ? '#4fae6e' : '#e0664a';
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.8, rr * 0.26);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (look.tick) {
      ctx.moveTo(cx - rr * 0.42, cy); ctx.lineTo(cx - rr * 0.08, cy + rr * 0.36); ctx.lineTo(cx + rr * 0.46, cy - rr * 0.36);
    } else {
      ctx.moveTo(cx - rr * 0.36, cy - rr * 0.36); ctx.lineTo(cx + rr * 0.36, cy + rr * 0.36);
      ctx.moveTo(cx + rr * 0.36, cy - rr * 0.36); ctx.lineTo(cx - rr * 0.36, cy + rr * 0.36);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the drum

/** The pad the tapping levels are played on: a skin over a hoop, which dips when it is struck. */
export function drumPad(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, hit: number, pressed: boolean): void {
  const k = clamp(hit, 0, 1);
  const squash = 1 - k * 0.06 - (pressed ? 0.04 : 0);
  ctx.save();
  contactShadow(ctx, cx, cy + ry * 1.05, rx * 1.05, ry * 0.4, 0.34);
  // the shell
  ctx.fillStyle = '#7a4326';
  ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.2, rx * 1.02, ry * squash, 0, 0, TAU); ctx.fill();
  // the hoop
  const hoop = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  hoop.addColorStop(0, '#d8a535');
  hoop.addColorStop(0.5, '#b57b34');
  hoop.addColorStop(1, '#7d4f1c');
  ctx.fillStyle = hoop;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry * squash, 0, 0, TAU); ctx.fill();
  // the skin
  const skin = ctx.createRadialGradient(cx + LIGHT.x * rx * 0.5, cy + LIGHT.y * ry * 0.6, rx * 0.06, cx, cy, rx);
  skin.addColorStop(0, mix('#f6e7cc', '#ffffff', 0.4 + k * 0.5));
  skin.addColorStop(0.7, mix('#ecd6b2', '#ffe9a8', k * 0.7));
  skin.addColorStop(1, '#cdb086');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88 * squash, 0, 0, TAU); ctx.fill();
  if (k > 0.01) {
    ctx.strokeStyle = `rgba(255, 244, 200, ${k * 0.85})`;
    ctx.lineWidth = Math.max(2, rx * 0.05 * k);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * (0.5 + (1 - k) * 0.42), ry * (0.5 + (1 - k) * 0.42) * squash, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the ball

/**
 * The bouncing ball: the pulse made visible before you hear it.
 *
 * Its height is a parabola over the beat, so it is at the top halfway between two beats and
 * touching the line exactly on one. A child watching it knows when the next beat is coming, which
 * is the difference between clapping along and guessing.
 */
export function bounceBall(ctx: Ctx, x: number, lineY: number, rise: number, phase: number, r: number, colour: string): void {
  // 4*p*(1-p) is 0 at both ends and 1 in the middle: one clean hop per beat
  const p = phase - Math.floor(phase);
  const up = 4 * p * (1 - p);
  const squash = p < 0.1 || p > 0.9 ? 1 - (1 - Math.abs(p < 0.5 ? p / 0.1 : (1 - p) / 0.1)) * 0.3 : 1;
  const cy = lineY - r - up * rise;
  ctx.save();
  contactShadow(ctx, x, lineY + r * 0.25, r * (1.4 - up * 0.5), r * 0.36, 0.3 * (1 - up * 0.55));
  const g = ctx.createRadialGradient(x + LIGHT.x * r * 0.5, cy + LIGHT.y * r * 0.5, r * 0.1, x, cy, r);
  g.addColorStop(0, mix(colour, '#ffffff', 0.62));
  g.addColorStop(0.65, colour);
  g.addColorStop(1, shade(colour, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, cy, r / squash, r * squash, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + LIGHT.x * r * 0.42, cy + LIGHT.y * r * 0.42, r * 0.28, r * 0.2, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- how close the tap was

/**
 * The score for one tap, as a ring that tightens.
 *
 * There is no millisecond on this screen. A tap on the beat draws a small tight ring on the mark;
 * a tap that was nearly right draws a wider one; a tap that missed draws a wide pale one with the
 * gap to the beat shown as a line. A child reads "closer" off the size without being told.
 */
export function tapRing(ctx: Ctx, x: number, y: number, r: number, tightness: number, colour: string, fade = 1): void {
  const k = clamp(tightness, 0, 1);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1.6, r * (0.1 + k * 0.2));
  ctx.beginPath();
  ctx.arc(x, y, r * (1.05 - k * 0.62), 0, TAU);
  ctx.stroke();
  if (k > 0.8) {
    ctx.globalAlpha = fade * (k - 0.8) * 5;
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- one note on the timeline

/** A note on the timeline: long notes are long blocks, short notes short ones. */
export function noteBlock(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  colour: string, lit: number, opts: { open?: boolean; strong?: boolean; ghost?: boolean } = {},
): void {
  const k = clamp(lit, 0, 1);
  const r = Math.min(h * 0.3, 12);
  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.4;
  if (opts.open) {
    // an empty slot, for a note that has been taken out of the song
    ctx.setLineDash([Math.max(3, h * 0.2), Math.max(3, h * 0.16)]);
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.85)';
    ctx.lineWidth = Math.max(1.6, h * 0.08);
    roundRectPath(ctx, x + 1, y + 1, Math.max(4, w - 2), h - 2, r);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  ctx.save();
  if (k > 0.02) { ctx.shadowColor = hexA(colour, 0.75 * k); ctx.shadowBlur = h * 0.8 * k; }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mix(colour, '#ffffff', 0.3 + k * 0.45));
  g.addColorStop(1, shade(colour, -0.22 + k * 0.3));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, Math.max(3, w), h, r);
  ctx.fill();
  ctx.restore();
  if (opts.strong) {
    ctx.strokeStyle = 'rgba(255, 250, 225, 0.9)';
    ctx.lineWidth = Math.max(1.4, h * 0.07);
    roundRectPath(ctx, x + 1, y + 1, Math.max(3, w - 2), h - 2, r);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the pitch ladder

/** One rung of the ladder of pitches, for High and low. */
export function rung(ctx: Ctx, x: number, y: number, w: number, h: number, midi: number, state: 'idle' | 'first' | 'right' | 'wrong' | 'press'): void {
  const base = colourOf(midi);
  ctx.save();
  const tone = state === 'right' ? '#4fae6e' : state === 'wrong' ? '#e0664a' : base;
  ctx.globalAlpha = state === 'idle' ? 0.9 : 1;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, mix(tone, '#ffffff', state === 'press' ? 0.5 : 0.28));
  g.addColorStop(1, shade(tone, -0.24));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, Math.min(h * 0.4, 12));
  ctx.fill();
  if (state === 'first') {
    ctx.strokeStyle = '#fff6d2';
    ctx.lineWidth = Math.max(2, h * 0.14);
    ctx.setLineDash([h * 0.4, h * 0.3]);
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(h * 0.4, 12));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(28,18,10,0.55)';
  ctx.font = `900 ${Math.max(9, Math.round(h * 0.5))}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(letterOfMidi(midi), x + w * 0.06, y + h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ---------------------------------------------------------------- the sequencer

/** One square of the grid: off is a hollow, on is a lozenge in the note's own colour. */
export function gridCell(
  ctx: Ctx, x: number, y: number, w: number, h: number, midi: number,
  on: boolean, under: boolean, lit: number,
): void {
  const r = Math.min(w, h) * 0.26;
  ctx.save();
  if (!on) {
    ctx.fillStyle = under ? 'rgba(255, 246, 220, 0.2)' : 'rgba(10, 26, 40, 0.28)';
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 246, 220, 0.16)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const base = colourOf(midi);
  const k = clamp(lit, 0, 1);
  ctx.save();
  if (k > 0.02) { ctx.shadowColor = hexA(base, 0.8 * k); ctx.shadowBlur = w * 0.9 * k; }
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, mix(base, '#ffffff', 0.34 + k * 0.4));
  g.addColorStop(1, shade(base, -0.22 + k * 0.28));
  ctx.fillStyle = g;
  const inset = h * 0.06 * (1 - k);
  roundRectPath(ctx, x, y + inset, w, h - inset * 2, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- a note head, for the cards

/** A quaver, for the level cards and the hub thumbnail. */
export function quaver(ctx: Ctx, cx: number, cy: number, s: number, colour: string): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.25, cy + s * 0.6, s * 0.42, s * 0.31, -0.35, 0, TAU);
  ctx.fill();
  ctx.fillRect(cx + s * 0.06, cy - s * 0.95, s * 0.14, s * 1.6);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.2, cy - s * 0.95);
  ctx.quadraticCurveTo(cx + s * 0.95, cy - s * 0.6, cx + s * 0.55, cy + s * 0.08);
  ctx.quadraticCurveTo(cx + s * 0.7, cy - s * 0.45, cx + s * 0.2, cy - s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}


/**
 * The frame the chimes are slung in: two rails and a pair of end posts.
 *
 * Without it the bars are nine coloured tiles floating on a wall. With it they are an instrument
 * standing in a room, which is the whole difference between a picture of a xylophone and a thing
 * a child wants to hit.
 */
export function chimeStand(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  // the rails are capped: on a wide short screen a rail proportional to the width alone would be
  // thicker than the gap the layout reserved for it and would cut across the strip above
  const post = Math.max(5, Math.min(w * 0.022, h * 0.1, 13));
  const wood = ctx.createLinearGradient(x, y, x, y + h);
  wood.addColorStop(0, '#b0743c');
  wood.addColorStop(0.5, '#8d5a2b');
  wood.addColorStop(1, '#69411d');
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h + post * 0.6, w * 0.52, post * 1.3, 0.34);
  // the rails sit above the longest bar and below it, so the frame is visible rather than hidden
  // behind nine plates
  const topY = y - post * 0.85;
  const botY = y + h + post * 0.75;
  ctx.fillStyle = wood;
  for (const px of [x - post * 1.1, x + w - post * 0.1]) {
    roundRectPath(ctx, px, topY, post * 1.2, botY - topY, post * 0.5);
    ctx.fill();
  }
  for (const ry of [topY, botY]) {
    roundRectPath(ctx, x - post * 1.2, ry - post / 2, w + post * 2.4, post, post * 0.5);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 228, 184, 0.3)';
  ctx.lineWidth = Math.max(1, post * 0.18);
  for (const ry of [topY, botY]) {
    ctx.beginPath();
    ctx.moveTo(x - post, ry - post * 0.28);
    ctx.lineTo(x + w + post, ry - post * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

