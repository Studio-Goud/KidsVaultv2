/**
 * Rijmbos' drawing: the clearing, the animals that hold the cards, and one icon per word.
 *
 * Everything is canvas paths, no images. Each icon is written in a box of -50..50 on both axes
 * with the same dark-brown outline and flat colours, so a card reads as one picture book. An icon
 * has to say its word at a glance to a four-year-old, which is why they are simple and why look-
 * alikes (ram and lamb, boat and ship) differ in one big thing: horns, a funnel.
 */

import { vGrad } from '../../render/look';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const INK = '#4a3424';

function fs(c: Ctx, fill: string): void {
  c.fillStyle = fill; c.fill();
  c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
}
const oval = (c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void => {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); fs(c, fill);
};
const circ = (c: Ctx, x: number, y: number, r: number, fill: string): void => oval(c, x, y, r, r, fill);
const box = (c: Ctx, x: number, y: number, bw: number, bh: number, r: number, fill: string): void => {
  c.beginPath(); c.roundRect(x, y, bw, bh, r); fs(c, fill);
};
const poly = (c: Ctx, pts: number[], fill: string): void => {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); fs(c, fill);
};
const line = (c: Ctx, pts: number[], lw = 3, col = INK): void => {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
};
const dot = (c: Ctx, x: number, y: number, r: number, col = INK): void => {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill();
};
const path = (c: Ctx, d: (c: Ctx) => void, fill: string): void => { c.beginPath(); d(c); fs(c, fill); };
const curve = (c: Ctx, d: (c: Ctx) => void, lw: number, col: string): void => {
  c.beginPath(); d(c); c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.stroke();
};
/** a thick coloured stroke with the outline around it */
const tube = (c: Ctx, d: (c: Ctx) => void, lw: number, col: string): void => { curve(c, d, lw + 6, INK); curve(c, d, lw, col); };

function rodent(c: Ctx, body: string, ear: string, big: number, tail: number): void {
  curve(c, k => { k.moveTo(30, 20); k.bezierCurveTo(48, 22, 52, 0, tail, -6); }, 4, INK);
  oval(c, 8, 14, 28, 19, body);
  circ(c, -6, -8, 11 * big, body); circ(c, -6, -8, 6.5 * big, ear);
  oval(c, -24, 8, 16, 13, body);
  dot(c, -38, 9, 3.4, '#d97b8e'); dot(c, -26, 3, 2.6);
  line(c, [-34, 12, -48, 8]); line(c, [-34, 15, -48, 18]);
  oval(c, 8, 18, 12, 9, '#e8e2dc');
}
function sheep(c: Ctx, horns: boolean): void {
  const s = horns ? 1 : 0.9;
  for (const [x, y] of [[-6, 18], [14, 18], [-18, 2], [26, 0], [4, -6], [-4, 10], [16, 8]]) circ(c, x * s, y * s, 15 * s, '#f6f1e8');
  line(c, [-16, 30 * s, -16, 42], 5); line(c, [20, 30 * s, 20, 42], 5);
  oval(c, -30, 2, 13, 15, '#5b4a3f');
  dot(c, -34, -2, 2.4, '#fff'); dot(c, -34, 6, 2.2, '#222');
  if (horns) {
    curve(c, k => { k.arc(-26, -12, 12, Math.PI * 1.1, Math.PI * 0.1 + TAU, false); }, 6, '#a58545');
    curve(c, k => { k.arc(-26, -12, 12, Math.PI * 1.1, Math.PI * 0.1 + TAU, false); }, 3, '#d9bf7a');
  } else {
    oval(c, -42, -2, 8, 4.5, '#5b4a3f', 0.5);
    oval(c, -20, -8, 8, 4.5, '#5b4a3f', -0.5);
  }
}
function hen(c: Ctx, rooster: boolean): void {
  if (rooster) {
    for (const [a, col] of [[-0.9, '#2f9d6e'], [-0.4, '#3b78c8'], [0.1, '#d9553a']] as const) {
      c.save(); c.translate(24, 4); c.rotate(a); oval(c, 22, 0, 22, 8, col); c.restore();
    }
  } else poly(c, [26, 2, 44, -14, 38, 20], '#e4ddd0');
  oval(c, 2, 12, 28, 24, rooster ? '#c9703a' : '#fffaf0');
  oval(c, 8, 14, 14, 9, rooster ? '#9c4f26' : '#eee6d6', -0.4);
  circ(c, -18, -16, 12, rooster ? '#c9703a' : '#fffaf0');
  for (const x of [-24, -18, -12]) circ(c, x, -30, 5, '#e0443a');
  poly(c, [-29, -18, -42, -13, -29, -9], '#f2a93a');
  path(c, k => { k.ellipse(-26, -2, 3.5, 6, 0, 0, TAU); }, '#e0443a');
  dot(c, -21, -19, 2.6);
  line(c, [-6, 34, -6, 46]); line(c, [10, 34, 10, 46]);
  line(c, [-12, 46, -2, 46]); line(c, [4, 46, 14, 46]);
}
function sailing(c: Ctx, big: boolean): void {
  if (big) {
    poly(c, [-44, 8, 44, 8, 32, 36, -32, 36], '#3b6fb6');
    box(c, -22, -16, 44, 24, 4, '#fff7ea');
    box(c, 6, -34, 12, 20, 2, '#d9453a');
    for (const x of [-14, -2, 10]) circ(c, x, -4, 4, '#8ecff0');
    box(c, -26, 20, 52, 5, 2, '#fff');
  } else {
    poly(c, [-40, 12, 40, 12, 28, 36, -28, 36], '#c0562f');
    line(c, [0, 12, 0, -40], 4);
    poly(c, [3, -38, 3, 6, 32, 6], '#fffaf0');
    poly(c, [-3, -26, -3, 6, -26, 6], '#ffe3a0');
  }
  curve(c, k => { k.moveTo(-48, 40); k.quadraticCurveTo(-36, 32, -24, 40); k.quadraticCurveTo(-12, 48, 0, 40); k.quadraticCurveTo(12, 32, 24, 40); k.quadraticCurveTo(36, 48, 48, 40); }, 4, '#5ab4e6');
}

type Icon = (c: Ctx) => void;

const ICONS: Record<string, Icon> = {
  mouse: c => rodent(c, '#bdb7b0', '#e9a9b5', 1.2, 46),
  rat: c => rodent(c, '#8a7565', '#d99aa6', 0.85, 50),
  house: c => {
    box(c, 14, -42, 12, 24, 2, '#a85a3a');
    box(c, -30, -6, 60, 46, 3, '#f2c78b');
    poly(c, [-40, -4, 0, -42, 40, -4], '#d0584b');
    box(c, -8, 14, 16, 26, 3, '#8a5a3a'); dot(c, 4, 28, 1.8, '#f2d27a');
    box(c, 14, 6, 12, 12, 2, '#b9e2f5'); line(c, [20, 6, 20, 18], 2); line(c, [14, 12, 26, 12], 2);
    box(c, -26, 6, 12, 12, 2, '#b9e2f5'); line(c, [-20, 6, -20, 18], 2); line(c, [-26, 12, -14, 12], 2);
  },
  bug: c => {
    for (const y of [-2, 10, 22]) { line(c, [-18, y, -36, y - 8]); line(c, [18, y, 36, y - 8]); }
    oval(c, 0, 8, 22, 26, '#6aa84f');
    circ(c, 0, -22, 11, '#3f7a35');
    line(c, [-4, -32, -10, -44]); line(c, [4, -32, 10, -44]);
    dot(c, -4, -24, 2.2, '#fff'); dot(c, 4, -24, 2.2, '#fff');
    line(c, [0, -14, 0, 34], 2);
    for (const [x, y] of [[-10, 4], [10, 10], [-8, 20], [9, 26]]) dot(c, x, y, 4, '#294f22');
  },
  cross: c => {
    box(c, -10, -44, 20, 88, 3, '#c58f4e');
    box(c, -32, -24, 64, 20, 3, '#d6a362');
    line(c, [-4, -38, -4, 38], 2, '#a9743a');
  },
  cat: c => {
    poly(c, [-30, -4, -26, -40, -6, -22], '#f0a24b'); poly(c, [30, -4, 26, -40, 6, -22], '#f0a24b');
    poly(c, [-25, -12, -24, -30, -13, -20], '#f5b8b8'); poly(c, [25, -12, 24, -30, 13, -20], '#f5b8b8');
    oval(c, 0, 6, 34, 30, '#f0a24b');
    for (const x of [-10, 0, 10]) line(c, [x, -22, x, -14], 3, '#c97a2a');
    oval(c, -13, 2, 6, 7, '#fff'); oval(c, 13, 2, 6, 7, '#fff');
    dot(c, -12, 3, 3.2); dot(c, 12, 3, 3.2);
    poly(c, [-5, 14, 5, 14, 0, 20], '#e0707f');
    line(c, [0, 20, 0, 25]); line(c, [0, 25, -6, 28], 2.4); line(c, [0, 25, 6, 28], 2.4);
    line(c, [-20, 20, -42, 16], 2.4); line(c, [-20, 25, -42, 28], 2.4);
    line(c, [20, 20, 42, 16], 2.4); line(c, [20, 25, 42, 28], 2.4);
  },
  mat: c => {
    box(c, -42, -16, 84, 40, 6, '#c4553f');
    box(c, -34, -9, 68, 26, 3, '#f0c05a');
    box(c, -26, -3, 52, 14, 2, '#c4553f');
    for (let i = -36; i <= 36; i += 9) { line(c, [i, 24, i, 34], 3, '#c4553f'); line(c, [i, -16, i, -26], 3, '#c4553f'); }
  },
  barrel: c => {
    path(c, k => { k.moveTo(-26, -36); k.bezierCurveTo(-40, -10, -40, 20, -26, 38); k.lineTo(26, 38); k.bezierCurveTo(40, 20, 40, -10, 26, -36); k.closePath(); }, '#b9783f');
    box(c, -33, -22, 66, 8, 2, '#7f8791'); box(c, -34, 14, 68, 8, 2, '#7f8791');
    line(c, [-10, -36, -13, 38], 2, '#8a5a2c'); line(c, [10, -36, 13, 38], 2, '#8a5a2c');
    oval(c, 0, -36, 26, 7, '#d9a063');
  },
  boat: c => sailing(c, false),
  ship: c => sailing(c, true),
  nut: c => {
    circ(c, 0, 2, 34, '#c99c64');
    curve(c, k => { k.moveTo(0, -32); k.bezierCurveTo(-10, -10, 10, 14, 0, 36); }, 3, INK);
    for (const [x, y] of [[-18, -10], [-20, 8], [18, -6], [20, 12]]) curve(c, k => { k.arc(x, y, 7, 0.4, 2.6); }, 2.4, '#8a6236');
    oval(c, -16, -16, 7, 4, 'rgba(255,255,255,0.45)', -0.7);
  },
  ditch: c => {
    box(c, -48, -30, 96, 78, 4, '#7cc25a');
    poly(c, [-24, -30, 24, -30, 40, 48, -40, 48], '#5db7e8');
    curve(c, k => { k.moveTo(-26, -8); k.quadraticCurveTo(-14, -14, 0, -8); k.quadraticCurveTo(14, -2, 26, -8); }, 3, '#d9f1fb');
    curve(c, k => { k.moveTo(-32, 14); k.quadraticCurveTo(-16, 8, 0, 14); k.quadraticCurveTo(16, 20, 32, 14); }, 3, '#d9f1fb');
    line(c, [-40, -8, -40, -38], 3, '#5d8a3a'); oval(c, -40, -38, 4, 9, '#7a4b2a');
    line(c, [-34, -8, -34, -30], 3, '#5d8a3a'); oval(c, -34, -30, 4, 8, '#7a4b2a');
  },
  ball: c => {
    c.save(); c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.clip();
    c.fillStyle = '#e5493b'; c.fillRect(-40, -40, 80, 80);
    c.fillStyle = '#fff'; c.fillRect(-40, -12, 80, 24);
    c.fillStyle = '#f4c542'; c.fillRect(-12, -40, 24, 80);
    c.restore();
    c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    oval(c, -14, -18, 8, 4, 'rgba(255,255,255,0.6)', -0.7);
  },
  stable: c => {
    box(c, -36, -4, 72, 44, 3, '#c9553c');
    poly(c, [-42, -2, 0, -40, 42, -2], '#8a5a3a');
    box(c, -14, 10, 28, 30, 2, '#f7ecd6');
    line(c, [-14, 10, 14, 40], 3); line(c, [14, 10, -14, 40], 3);
    box(c, -6, -22, 12, 10, 2, '#f7ecd6');
  },
  scarf: c => {
    tube(c, k => { k.arc(0, -8, 24, Math.PI * 0.05, Math.PI * 0.95); }, 18, '#e45c5c');
    box(c, -26, 8, 18, 40, 3, '#e45c5c'); box(c, 4, 14, 18, 34, 3, '#e45c5c');
    for (const y of [18, 30]) { line(c, [-26, y, -8, y], 4, '#fff'); line(c, [4, y + 4, 22, y + 4], 4, '#fff'); }
    for (let x = -24; x <= -10; x += 5) line(c, [x, 48, x, 55], 2.4);
    for (let x = 6; x <= 20; x += 5) line(c, [x, 48, x, 54], 2.4);
  },
  branch: c => {
    tube(c, k => { k.moveTo(-42, 34); k.quadraticCurveTo(-4, 4, 36, -28); }, 9, '#9a6a3e');
    tube(c, k => { k.moveTo(-14, 18); k.quadraticCurveTo(-14, 0, -26, -12); }, 6, '#9a6a3e');
    tube(c, k => { k.moveTo(10, 2); k.quadraticCurveTo(18, 16, 30, 18); }, 6, '#9a6a3e');
    oval(c, -28, -18, 9, 5, '#5fae4a', -1); oval(c, 32, 20, 9, 5, '#5fae4a', 0.2); oval(c, 38, -32, 8, 5, '#5fae4a', -0.6);
  },
  roof: c => {
    box(c, 12, -40, 14, 30, 2, '#a85a3a');
    poly(c, [-46, 22, 0, -32, 46, 22], '#d0584b');
    for (const y of [-6, 8]) line(c, [-30 + (y + 6) * 0.7 - 20, y, 30 - (y + 6) * 0.7 + 20, y], 2.4, '#8e3a30');
    line(c, [0, -32, 0, 22], 2.4, '#8e3a30'); line(c, [-18, -8, -18, 22], 2, '#8e3a30'); line(c, [18, -8, 18, 22], 2, '#8e3a30');
    box(c, -46, 20, 92, 8, 2, '#8e3a30');
  },
  sack: c => {
    path(c, k => { k.moveTo(-10, -28); k.bezierCurveTo(-40, -2, -40, 36, -22, 38); k.lineTo(22, 38); k.bezierCurveTo(40, 36, 40, -2, 10, -28); k.closePath(); }, '#d8b988');
    poly(c, [-10, -28, -18, -42, -4, -36, 0, -44, 4, -36, 18, -42, 10, -28], '#d8b988');
    line(c, [-12, -26, 12, -26], 5, '#b0522f');
    line(c, [-14, 6, -4, 14], 2, '#b8945e'); line(c, [8, 18, 18, 10], 2, '#b8945e');
  },
  comb: c => {
    box(c, -42, -22, 84, 24, 5, '#3aa5d9');
    for (let i = 0; i < 8; i++) box(c, -38 + i * 10.2, 0, 6.5, 30, 3, '#3aa5d9');
    line(c, [-34, -14, 30, -14], 3, 'rgba(255,255,255,0.5)');
  },
  ram: c => sheep(c, true),
  lamb: c => sheep(c, false),
  jar: c => {
    box(c, -24, -22, 48, 60, 10, '#eaf5fa');
    box(c, -22, -4, 44, 40, 8, '#c4284a');
    box(c, -27, -36, 54, 15, 4, '#d9a64a');
    circ(c, 0, 14, 11, '#fff7ea'); poly(c, [-4, 10, 4, 10, 0, 18], '#c4284a');
    line(c, [-16, -14, -16, 4], 3, 'rgba(255,255,255,0.8)');
  },
  skirt: c => {
    box(c, -20, -36, 40, 10, 3, '#a8366a');
    poly(c, [-18, -27, 18, -27, 44, 38, -44, 38], '#d95a8a');
    for (const x of [-22, -8, 8, 22]) line(c, [x * 0.4, -27, x * 1.3, 38], 2.4, '#b03c6c');
  },
  goat: c => {
    line(c, [-14, 28, -14, 44], 5); line(c, [22, 28, 22, 44], 5);
    oval(c, 8, 12, 30, 19, '#f7f3ea');
    poly(c, [36, 6, 46, -2, 42, 14], '#f7f3ea');
    oval(c, -26, -8, 14, 12, '#f7f3ea');
    curve(c, k => { k.moveTo(-26, -18); k.quadraticCurveTo(-30, -38, -18, -42); }, 5, '#a58545');
    curve(c, k => { k.moveTo(-20, -18); k.quadraticCurveTo(-14, -38, -4, -38); }, 5, '#a58545');
    poly(c, [-30, 2, -24, 2, -27, 14], '#e8e0d0');
    dot(c, -32, -10, 2.4); dot(c, -22, -10, 2.4);
  },
  sock: c => {
    poly(c, [-14, -38, 14, -38, 14, 2, 38, 12, 40, 34, -14, 34], '#5aa9e6');
    box(c, -16, -44, 32, 14, 3, '#f7d046');
    box(c, -14, 22, 20, 12, 3, '#e9604a');
    line(c, [-14, -14, 14, -14], 3, '#fff'); line(c, [-14, -2, 14, -2], 3, '#fff');
  },
  chicken: c => hen(c, false),
  rooster: c => hen(c, true),
  lips: c => {
    path(c, k => { k.moveTo(-38, 2); k.bezierCurveTo(-26, -28, -6, -22, 0, -12); k.bezierCurveTo(6, -22, 26, -28, 38, 2); k.bezierCurveTo(14, 8, -14, 8, -38, 2); }, '#e0506c');
    path(c, k => { k.moveTo(-38, 2); k.bezierCurveTo(-14, 8, 14, 8, 38, 2); k.bezierCurveTo(26, 34, -26, 34, -38, 2); }, '#ee6f86');
    oval(c, -6, 20, 10, 3.4, 'rgba(255,255,255,0.4)');
  },
  hand: c => {
    for (const [x, h] of [[-22, 34], [-9, 42], [4, 44], [17, 38]]) box(c, x, -36 + (44 - h) * 0.2 - 4, 12, h, 6, '#f6c79b');
    c.save(); c.translate(-22, 12); c.rotate(-0.9); box(c, -14, -6, 12, 34, 6, '#f6c79b'); c.restore();
    box(c, -24, -2, 52, 42, 14, '#f6c79b');
    line(c, [-10, 14, 6, 20], 2, '#d9a074');
  },
  tooth: c => {
    path(c, k => {
      k.moveTo(-28, -22); k.bezierCurveTo(-28, -42, -8, -40, 0, -32); k.bezierCurveTo(8, -40, 28, -42, 28, -22);
      k.bezierCurveTo(28, -4, 20, 10, 18, 36); k.bezierCurveTo(14, 44, 8, 36, 6, 20);
      k.bezierCurveTo(3, 12, -3, 12, -6, 20); k.bezierCurveTo(-8, 36, -14, 44, -18, 36);
      k.bezierCurveTo(-20, 10, -28, -4, -28, -22);
    }, '#fffdf5');
    curve(c, k => { k.moveTo(-18, -26); k.quadraticCurveTo(-18, -34, -10, -34); }, 3, '#cfe8f5');
  },
  basket: c => {
    curve(c, k => { k.arc(0, -4, 30, Math.PI, TAU); }, 6, INK);
    curve(c, k => { k.arc(0, -4, 30, Math.PI, TAU); }, 3, '#b8803c');
    poly(c, [-38, -6, 38, -6, 30, 38, -30, 38], '#d4a05a');
    for (const y of [4, 16, 28]) line(c, [-36 + (y + 6) * 0.2, y, 36 - (y + 6) * 0.2, y], 2.4, '#a8763a');
    for (const x of [-20, -6, 8, 22]) line(c, [x, -6, x * 0.85, 38], 2.4, '#a8763a');
  },
  sand: c => {
    path(c, k => { k.moveTo(-46, 38); k.bezierCurveTo(-30, 38, -22, -26, 0, -28); k.bezierCurveTo(22, -26, 30, 38, 46, 38); k.closePath(); }, '#ecd08d');
    for (const [x, y] of [[-10, 8], [10, 18], [0, -8], [-22, 28], [24, 30], [-6, 26]]) dot(c, x, y, 2, '#c9a85e');
    line(c, [30, 6, 40, -24], 4, '#8a5a3a'); box(c, 30, -34, 18, 14, 3, '#e9604a');
  },
  wall: c => {
    box(c, -44, -34, 88, 72, 4, '#c9674d');
    for (let r = 0; r < 4; r++) {
      const y = -34 + r * 18;
      if (r) line(c, [-44, y, 44, y], 2.4);
      for (let x = (r % 2 ? -22 : -44) + 22; x < 44; x += 44) line(c, [x, y, x, y + 18], 2.4);
    }
  },
  book: c => {
    box(c, -30, -38, 62, 76, 6, '#3f7fc8');
    box(c, 24, -34, 9, 68, 2, '#fff');
    box(c, -30, -38, 10, 76, 4, '#2f5f9c');
    box(c, -12, -22, 32, 9, 3, '#f7d046'); box(c, -12, -8, 24, 6, 3, '#dfeaf7');
  },
  cookie: c => {
    circ(c, 0, 0, 34, '#d9a15b');
    for (const [x, y] of [[-14, -12], [10, -18], [16, 6], [-8, 12], [-22, 4], [4, 24], [4, -2]]) circ(c, x, y, 5.5, '#5a3820');
  },
  trousers: c => {
    poly(c, [-24, -34, 24, -34, 30, 40, 6, 40, 0, -2, -6, 40, -30, 40], '#3c6fb0');
    box(c, -25, -40, 50, 11, 3, '#e4a034');
    line(c, [0, -30, 0, -2], 2.4); dot(c, -16, -22, 2.4, '#f2d27a');
  },
  cake: c => {
    box(c, -36, 6, 72, 32, 6, '#f2c7d8');
    box(c, -26, -16, 52, 26, 6, '#fbe3ec');
    curve(c, k => { k.moveTo(-26, -14); for (let i = 0; i < 4; i++) k.quadraticCurveTo(-20 + i * 13, 0, -13 + i * 13, -14); }, 5, '#fff');
    circ(c, 0, -24, 7, '#e0443a'); line(c, [0, -30, 4, -40], 3, '#3f7a35');
    line(c, [-36, 22, 36, 22], 2.4, '#e9a3bd');
  },
  card: c => {
    box(c, -26, -40, 52, 80, 8, '#fffdf8');
    path(c, k => { k.moveTo(0, 18); k.bezierCurveTo(-32, -4, -18, -28, 0, -10); k.bezierCurveTo(18, -28, 32, -4, 0, 18); }, '#e0443a');
    dot(c, -16, -30, 3, '#e0443a'); dot(c, 16, 30, 3, '#e0443a');
  },
  tail: c => {
    c.save(); c.rotate(0.6);
    oval(c, 0, 0, 18, 40, '#e8873a');
    path(c, k => { k.ellipse(0, -22, 17, 19, 0, Math.PI * 1.05, Math.PI * 1.95); k.closePath(); }, '#fff');
    path(c, k => { k.ellipse(0, -22, 17, 19, 0, Math.PI * 1.05, Math.PI * 1.95); k.bezierCurveTo(10, -26, -10, -26, -17, -22); }, '#fff');
    c.restore();
  },
  moon: c => {
    const ix = 16, iy = -6, r = 28;
    c.save(); c.beginPath(); c.rect(-60, -60, 120, 120); c.arc(ix, iy, r, 0, TAU); c.clip('evenodd');
    c.beginPath(); c.arc(0, 0, 36, 0, TAU); fs(c, '#f7dc6a'); c.restore();
    c.save(); c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.clip();
    c.beginPath(); c.arc(ix, iy, r, 0, TAU); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore();
    dot(c, -18, -8, 3.4, '#d9bd4a'); dot(c, -12, 14, 2.6, '#d9bd4a');
    poly(c, [34, -30, 37, -22, 45, -22, 39, -17, 41, -9, 34, -14, 27, -9, 29, -17, 23, -22, 31, -22], '#fff3b0');
  },
  tear: c => {
    path(c, k => {
      k.moveTo(0, -42); k.bezierCurveTo(10, -20, 28, -4, 28, 14); k.bezierCurveTo(28, 32, 14, 42, 0, 42);
      k.bezierCurveTo(-14, 42, -28, 32, -28, 14); k.bezierCurveTo(-28, -4, -10, -20, 0, -42);
    }, '#6ec6f2');
    oval(c, -10, 16, 5, 11, 'rgba(255,255,255,0.65)', 0.3);
  },
  doll: c => {
    poly(c, [-14, 0, 14, 0, 30, 42, -30, 42], '#8a63c8');
    line(c, [-14, 6, -34, 24], 7, INK); line(c, [-14, 6, -34, 24], 4, '#f6c79b');
    line(c, [14, 6, 34, 24], 7, INK); line(c, [14, 6, 34, 24], 4, '#f6c79b');
    circ(c, -18, -24, 9, '#e8a838'); circ(c, 18, -24, 9, '#e8a838');
    circ(c, 0, -22, 22, '#f6c79b');
    path(c, k => { k.arc(0, -26, 22, Math.PI, TAU); k.closePath(); }, '#e8a838');
    dot(c, -8, -20, 2.6); dot(c, 8, -20, 2.6);
    curve(c, k => { k.arc(0, -14, 8, 0.2, Math.PI - 0.2); }, 2.4, '#c4505e');
  },
  cup: c => {
    curve(c, k => { k.arc(30, -2, 13, -1.4, 1.5); }, 8, INK);
    curve(c, k => { k.arc(30, -2, 13, -1.4, 1.5); }, 4, '#f4f4f4');
    path(c, k => { k.moveTo(-30, -26); k.lineTo(30, -26); k.lineTo(26, 20); k.quadraticCurveTo(24, 38, 0, 38); k.quadraticCurveTo(-24, 38, -26, 20); k.closePath(); }, '#f4f4f4');
    box(c, -29, -8, 58, 12, 2, '#e9604a');
    oval(c, 0, -26, 30, 6, '#8a5a3a');
  },
  cap: c => {
    const pts: number[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = i % 2 ? 31 : 37; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(c, pts, '#c83c3c');
    circ(c, 0, 0, 22, '#e5604f');
    curve(c, k => { k.arc(0, 0, 14, 3.6, 5.2); }, 4, 'rgba(255,255,255,0.55)');
  },
  coat: c => {
    poly(c, [-22, -34, 22, -34, 28, 40, -28, 40], '#e9852f');
    poly(c, [-22, -32, -44, 18, -32, 24, -20, -6], '#d9741f');
    poly(c, [22, -32, 44, 18, 32, 24, 20, -6], '#d9741f');
    poly(c, [-10, -34, 0, -16, 10, -34], '#f7d9ae');
    line(c, [0, -16, 0, 40], 2.4);
    for (const y of [-4, 10, 24]) dot(c, 5, y, 2.8, '#4a3424');
  },
  handbag: c => {
    curve(c, k => { k.arc(0, -4, 22, Math.PI, TAU); }, 9, INK);
    curve(c, k => { k.arc(0, -4, 22, Math.PI, TAU); }, 4.5, '#a83a52');
    box(c, -34, -6, 68, 44, 10, '#d4506b');
    box(c, -6, 4, 12, 9, 2, '#f4c542');
    line(c, [-34, 12, 34, 12], 2, '#a83a52');
  },
  glass: c => {
    poly(c, [-24, -36, 24, -36, 17, 38, -17, 38], 'rgba(214,240,252,0.85)');
    poly(c, [-20, -6, 20, -6, 16, 36, -16, 36], '#7cc8ee');
    line(c, [-16, -28, -12, 16], 3, 'rgba(255,255,255,0.8)');
  },
  grass: c => {
    const col = ['#4f9d3a', '#69b845', '#3f8a30'];
    [-34, -22, -10, 2, 14, 26, 36].forEach((x, i) => {
      const tip = -30 + ((i * 7) % 5) * 7, lean = (i % 3 - 1) * 8;
      poly(c, [x - 6, 38, x + lean, tip, x + 6, 38], col[i % 3]);
    });
    box(c, -46, 36, 92, 8, 3, '#8a5a3a');
  },
  cupboard: c => {
    box(c, -32, -40, 64, 78, 4, '#b9814f');
    line(c, [0, -40, 0, 38], 3);
    box(c, -26, -34, 24, 66, 2, '#cf9a63'); box(c, 2, -34, 24, 66, 2, '#cf9a63');
    dot(c, -8, 0, 3, '#4a3424'); dot(c, 8, 0, 3, '#4a3424');
    box(c, -30, 38, 10, 8, 2, '#8a5a2c'); box(c, 20, 38, 10, 8, 2, '#8a5a2c');
  },

  // ---- only the English list
  hat: c => {
    oval(c, 0, 20, 44, 12, '#4a79c4');
    path(c, k => { k.moveTo(-26, 20); k.lineTo(-24, -22); k.quadraticCurveTo(0, -34, 24, -22); k.lineTo(26, 20); k.closePath(); }, '#4a79c4');
    box(c, -26, 4, 52, 10, 2, '#e0443a');
  },
  snake: c => {
    tube(c, k => { k.moveTo(-36, 34); k.bezierCurveTo(-36, 14, 16, 34, 20, 8); k.bezierCurveTo(24, -14, -22, -6, -14, -26); }, 15, '#6fbf4a');
    circ(c, -14, -30, 11, '#6fbf4a');
    dot(c, -18, -33, 2.6, '#fff'); dot(c, -10, -33, 2.6, '#fff'); dot(c, -18, -33, 1.2); dot(c, -10, -33, 1.2);
    line(c, [-14, -20, -14, -10], 2.4, '#e0443a'); line(c, [-14, -10, -18, -6], 2.4, '#e0443a'); line(c, [-14, -10, -10, -6], 2.4, '#e0443a');
  },
  lake: c => {
    oval(c, 0, 10, 46, 30, '#7cc25a');
    oval(c, 0, 12, 38, 22, '#4ba3dc');
    curve(c, k => { k.moveTo(-22, 6); k.quadraticCurveTo(-10, 0, 2, 6); }, 3, '#d9f1fb');
    curve(c, k => { k.moveTo(-6, 18); k.quadraticCurveTo(8, 12, 22, 18); }, 3, '#d9f1fb');
    line(c, [-38, -2, -38, -34], 3, '#5d8a3a'); oval(c, -38, -34, 4, 9, '#7a4b2a');
  },
  clock: c => {
    circ(c, 0, 2, 36, '#e0443a'); circ(c, 0, 2, 29, '#fffdf5');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; line(c, [Math.cos(a) * 23, 2 + Math.sin(a) * 23, Math.cos(a) * 26, 2 + Math.sin(a) * 26], 2.4); }
    line(c, [0, 2, 0, -18], 4); line(c, [0, 2, 14, 8], 4); dot(c, 0, 2, 3);
    circ(c, -22, -34, 7, '#f4c542'); circ(c, 22, -34, 7, '#f4c542');
  },
  rock: c => {
    path(c, k => { k.moveTo(-40, 32); k.lineTo(-34, -6); k.lineTo(-14, -30); k.lineTo(14, -26); k.lineTo(38, 2); k.lineTo(42, 32); k.closePath(); }, '#9a9ca2');
    poly(c, [-14, -30, 14, -26, 6, -8, -20, -10], '#b6b8be');
    line(c, [-6, 4, 6, 20], 2.4, '#74767c');
  },
  nail: c => {
    box(c, -46, 24, 92, 18, 3, '#b07a44');
    poly(c, [-4, -14, 4, -14, 4, 30, 0, 38, -4, 30], '#8c929a');
    box(c, -14, -24, 28, 11, 3, '#a4aab2');
  },
  snail: c => {
    oval(c, -2, 30, 40, 11, '#e4c78c');
    poly(c, [30, 24, 40, 4, 46, 6, 40, 30], '#e4c78c');
    line(c, [38, 6, 34, -10], 3); line(c, [44, 8, 48, -8], 3); dot(c, 34, -11, 3.6); dot(c, 48, -9, 3.6);
    circ(c, -8, 0, 28, '#d9904b');
    curve(c, k => { k.arc(-8, 0, 18, 0.4, 5.6); }, 3.4, '#a85f2a');
    curve(c, k => { k.arc(-8, 0, 8, 1, 5.5); }, 3, '#a85f2a');
  },
  pail: c => {
    curve(c, k => { k.arc(0, -16, 26, Math.PI, TAU); }, 5, INK);
    poly(c, [-30, -16, 30, -16, 22, 38, -22, 38], '#e8c33a');
    oval(c, 0, -16, 30, 6, '#f4dd7a');
    line(c, [-12, -10, -10, 32], 3, 'rgba(255,255,255,0.45)');
    box(c, -26, 6, 52, 8, 2, '#e0443a');
  },
  pig: c => {
    poly(c, [-28, -16, -20, -38, -6, -22], '#f08fa5'); poly(c, [28, -16, 20, -38, 6, -22], '#f08fa5');
    circ(c, 0, 0, 36, '#f4a9b8');
    oval(c, 0, 10, 16, 12, '#f08fa5');
    dot(c, -6, 10, 3); dot(c, 6, 10, 3);
    dot(c, -16, -8, 3.4); dot(c, 16, -8, 3.4);
  },
  wig: c => {
    oval(c, 0, 8, 22, 30, '#f6c79b');
    for (const [x, y] of [[-24, -6], [-18, -22], [0, -30], [18, -22], [24, -6], [-30, 14], [30, 14], [-10, -14], [10, -14]]) circ(c, x, y, 13, '#8a4fbf');
    dot(c, -8, 6, 2.6); dot(c, 8, 6, 2.6);
    curve(c, k => { k.arc(0, 14, 8, 0.2, Math.PI - 0.2); }, 2.4, '#c4505e');
  },
  dog: c => {
    oval(c, -32, 0, 11, 26, '#7a4b2a', 0.2); oval(c, 32, 0, 11, 26, '#7a4b2a', -0.2);
    oval(c, 0, -2, 28, 32, '#d9a066');
    oval(c, 0, 14, 17, 14, '#f2d3a3');
    poly(c, [-6, 8, 6, 8, 0, 15], '#3a2a20');
    path(c, k => { k.ellipse(0, 26, 6, 8, 0, 0, Math.PI); }, '#e0707f');
    dot(c, -12, -8, 3.6); dot(c, 12, -8, 3.6);
  },
  log: c => {
    box(c, -42, -20, 66, 40, 8, '#a8743e');
    oval(c, 24, 0, 16, 20, '#e6c08a');
    curve(c, k => { k.ellipse(24, 0, 9, 12, 0, 0, TAU); }, 2.4, '#b88a52');
    curve(c, k => { k.ellipse(24, 0, 3, 5, 0, 0, TAU); }, 2.4, '#b88a52');
    line(c, [-30, -8, -6, -8], 2.4, '#7a5028'); line(c, [-24, 8, 4, 8], 2.4, '#7a5028');
  },
  frog: c => {
    oval(c, 0, 14, 40, 28, '#58b845');
    circ(c, -20, -16, 12, '#58b845'); circ(c, 20, -16, 12, '#58b845');
    circ(c, -20, -16, 7, '#fff'); circ(c, 20, -16, 7, '#fff');
    dot(c, -20, -16, 3.4); dot(c, 20, -16, 3.4);
    curve(c, k => { k.arc(0, 8, 22, 0.25, Math.PI - 0.25); }, 3, INK);
    dot(c, -6, 0, 1.8); dot(c, 6, 0, 1.8);
  },
  star: c => {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 18 : 42; pts.push(Math.cos(a) * r, Math.sin(a) * r + 2); }
    poly(c, pts, '#f7cf3a');
    dot(c, -6, -4, 2.6); dot(c, 6, -4, 2.6);
    curve(c, k => { k.arc(0, 4, 6, 0.3, Math.PI - 0.3); }, 2.4, INK);
  },
  car: c => {
    path(c, k => { k.moveTo(-42, 14); k.lineTo(-38, 0); k.lineTo(-22, -2); k.lineTo(-12, -22); k.lineTo(16, -22); k.lineTo(28, -2); k.lineTo(42, 4); k.lineTo(44, 14); k.closePath(); }, '#e0443a');
    poly(c, [-10, -18, 14, -18, 22, -4, -18, -4], '#cfeaf7');
    line(c, [2, -18, 2, -4], 3);
    circ(c, -22, 18, 11, '#3a3a40'); circ(c, 24, 18, 11, '#3a3a40'); circ(c, -22, 18, 4.4, '#c9ccd2'); circ(c, 24, 18, 4.4, '#c9ccd2');
  },
  rug: c => {
    oval(c, 0, 6, 44, 28, '#3f9a8a');
    oval(c, 0, 6, 33, 20, '#f2d27a');
    oval(c, 0, 6, 22, 12, '#d95a8a');
    oval(c, 0, 6, 10, 5, '#fff');
  },
  ring: c => {
    curve(c, k => { k.arc(0, 12, 24, 0, TAU); }, 13, INK);
    curve(c, k => { k.arc(0, 12, 24, 0, TAU); }, 7, '#f4c542');
    poly(c, [-12, -22, 12, -22, 18, -10, 0, 4, -18, -10], '#7fd0f0');
    line(c, [-18, -10, 18, -10], 2); line(c, [-6, -22, -9, -10, 0, 4], 2);
  },
  king: c => {
    circ(c, 0, 14, 26, '#f6c79b');
    path(c, k => { k.moveTo(-26, -8); k.lineTo(-30, -38); k.lineTo(-14, -22); k.lineTo(0, -42); k.lineTo(14, -22); k.lineTo(30, -38); k.lineTo(26, -8); k.closePath(); }, '#f4c542');
    for (const x of [-30, 0, 30]) circ(c, x, x ? -40 : -44, 4.4, '#e0443a');
    dot(c, -9, 14, 2.8); dot(c, 9, 14, 2.8);
    curve(c, k => { k.arc(0, 22, 9, 0.3, Math.PI - 0.3); }, 2.4, '#c4505e');
  },
  wing: c => {
    for (let i = 0; i < 5; i++) {
      c.save(); c.translate(-30, 30); c.rotate(-0.15 - i * 0.28);
      oval(c, 42, 0, 44 - i * 4, 9, i % 2 ? '#bfe0f5' : '#e4f3fb'); c.restore();
    }
    circ(c, -30, 30, 7, '#8fc4e6');
  },
  bell: c => {
    path(c, k => { k.moveTo(-34, 30); k.bezierCurveTo(-30, 20, -26, 14, -24, -10); k.bezierCurveTo(-22, -34, 22, -34, 24, -10); k.bezierCurveTo(26, 14, 30, 20, 34, 30); k.closePath(); }, '#f4c542');
    circ(c, 0, -34, 6, '#d9a62a'); circ(c, 0, 36, 8, '#8a5a2c');
    line(c, [-14, -12, -16, 10], 3, 'rgba(255,255,255,0.55)');
  },
  well: c => {
    box(c, -30, -2, 60, 42, 4, '#b9b3a8');
    for (const y of [10, 24]) line(c, [-30, y, 30, y], 2.4);
    line(c, [-14, -2, -14, 10], 2.4); line(c, [10, 10, 10, 24], 2.4); line(c, [-6, 24, -6, 40], 2.4);
    line(c, [-24, -2, -24, -34], 5); line(c, [24, -2, 24, -34], 5);
    poly(c, [-36, -30, 0, -48, 36, -30], '#d0584b');
    line(c, [0, -30, 0, 0], 2.4); box(c, -6, 0, 12, 10, 2, '#8a5a2c');
  },
  shell: c => {
    path(c, k => { k.moveTo(0, 36); k.bezierCurveTo(-48, 18, -44, -30, 0, -34); k.bezierCurveTo(44, -30, 48, 18, 0, 36); }, '#f3b6a0');
    for (const x of [-26, -13, 0, 13, 26]) line(c, [0, 34, x * 1.4, -22 + Math.abs(x) * 0.4], 2.4, '#d98a72');
    box(c, -10, 30, 20, 9, 3, '#e29a84');
  },
};

export const ICON_IDS: string[] = Object.keys(ICONS);

/** Draw an icon centred on (x, y), `size` across. An unknown id draws nothing rather than throwing. */
export function drawIcon(ctx: Ctx, id: string, x: number, y: number, size: number): void {
  const f = ICONS[id];
  if (!f) return;
  ctx.save();
  ctx.translate(x, y);
  const s = size / 100;
  ctx.scale(s, s);
  f(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------- the animals

export type AnimalKind = 'bear' | 'rabbit' | 'fox' | 'hedgehog' | 'owl';
export const ANIMALS: AnimalKind[] = ['bear', 'rabbit', 'fox', 'hedgehog', 'owl'];

/**
 * An animal seen from the front with its paws on the card in front of it. (x, y) is the middle
 * of the head, `r` its radius. `cheer` is 0..1: the paws go up and the whole animal hops.
 */
export function drawAnimal(ctx: Ctx, kind: AnimalKind, x: number, y: number, r: number, t: number, cheer: number, pawX = r): void {
  const hop = cheer > 0 ? -Math.abs(Math.sin(t * 9)) * r * 0.35 * cheer : Math.sin(t * 1.6 + x) * r * 0.025;
  ctx.save();
  ctx.translate(x, y + hop);
  const lw = Math.max(2, r * 0.07);
  const out = (fill: string): void => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); };
  const el = (ex: number, ey: number, rx: number, ry: number, fill: string, rot = 0): void => {
    ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, rot, 0, TAU); out(fill);
  };
  const body: Record<AnimalKind, string> = { bear: '#a8744a', rabbit: '#e9e3da', fox: '#e8873a', hedgehog: '#8a6a50', owl: '#9a7a52' };
  const fur = body[kind];

  // back features first
  if (kind === 'hedgehog') {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.14) * r * 1.0, Math.sin(a - 0.14) * r * 1.0 + r * 0.1);
      ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45 + r * 0.1);
      ctx.lineTo(Math.cos(a + 0.14) * r * 1.0, Math.sin(a + 0.14) * r * 1.0 + r * 0.1);
      out('#5d4636');
    }
  }
  // body below the head, mostly hidden by the card
  el(0, r * 1.55, Math.max(r * 1.1, pawX + r * 0.3), r * 1.25, fur);
  // paws: down on the card, or up in the air
  const py = r * (1.4 - 0.9 * cheer);
  el(-pawX, py, r * 0.34, r * 0.34, fur); el(pawX, py, r * 0.34, r * 0.34, fur);
  // ears
  if (kind === 'bear') { el(-r * 0.72, -r * 0.72, r * 0.3, r * 0.3, fur); el(r * 0.72, -r * 0.72, r * 0.3, r * 0.3, fur); }
  if (kind === 'rabbit') {
    el(-r * 0.4, -r * 1.2, r * 0.22, r * 0.72, fur, -0.1); el(r * 0.4, -r * 1.2, r * 0.22, r * 0.72, fur, 0.1);
    el(-r * 0.4, -r * 1.2, r * 0.1, r * 0.5, '#f2b6c0', -0.1); el(r * 0.4, -r * 1.2, r * 0.1, r * 0.5, '#f2b6c0', 0.1);
  }
  if (kind === 'fox') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.9, -r * 0.3); ctx.lineTo(s * r * 0.75, -r * 1.3); ctx.lineTo(s * r * 0.2, -r * 0.8); ctx.closePath(); out(fur);
    }
  }
  if (kind === 'owl') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.95, -r * 0.2); ctx.lineTo(s * r * 0.8, -r * 1.1); ctx.lineTo(s * r * 0.3, -r * 0.8); ctx.closePath(); out(fur);
    }
  }
  // head
  el(0, 0, r, r * 0.95, fur);
  // face
  if (kind === 'bear') { el(0, r * 0.3, r * 0.42, r * 0.32, '#e8c79b'); ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.12, 0, TAU); ctx.fillStyle = INK; ctx.fill(); }
  if (kind === 'rabbit') { el(0, r * 0.35, r * 0.38, r * 0.28, '#fff'); ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.1, 0, TAU); ctx.fillStyle = '#e07b8e'; ctx.fill(); }
  if (kind === 'fox') {
    ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.15); ctx.lineTo(0, r * 0.95); ctx.lineTo(r * 0.95, r * 0.15); ctx.quadraticCurveTo(0, r * 0.55, -r * 0.95, r * 0.15); out('#fff');
    ctx.beginPath(); ctx.arc(0, r * 0.72, r * 0.1, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  }
  if (kind === 'hedgehog') { el(0, r * 0.38, r * 0.62, r * 0.5, '#e8c79b'); ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.12, 0, TAU); ctx.fillStyle = INK; ctx.fill(); }
  if (kind === 'owl') {
    el(-r * 0.38, -r * 0.05, r * 0.36, r * 0.36, '#f5ecd5'); el(r * 0.38, -r * 0.05, r * 0.36, r * 0.36, '#f5ecd5');
    ctx.beginPath(); ctx.moveTo(-r * 0.12, r * 0.25); ctx.lineTo(r * 0.12, r * 0.25); ctx.lineTo(0, r * 0.55); ctx.closePath(); out('#f2a93a');
  }
  // eyes, shut with happiness while cheering
  const ey = kind === 'owl' ? -r * 0.05 : -r * 0.12, ex = kind === 'owl' ? r * 0.38 : r * 0.38;
  for (const s of [-1, 1]) {
    if (cheer > 0.3) {
      ctx.beginPath(); ctx.arc(s * ex, ey + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(s * ex, ey, r * 0.11, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(s * ex - r * 0.03, ey - r * 0.04, r * 0.035, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the clearing

/**
 * The forest clearing: light sky through the trees, grass underneath, tree trunks at the edges,
 * a few flowers. It is drawn fresh every frame because it is cheap and the safe-area strips are
 * stretched from its first and last row (`bleedEdges`), which must therefore be plain.
 */
export function paintClearing(ctx: Ctx, w: number, h: number, t: number): void {
  ctx.fillStyle = vGrad(ctx, 0, h, '#bfe6c4', '#7fc36a');
  ctx.fillRect(0, 0, w, h);
  // soft light from above
  const g = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.1, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(255,248,200,0.55)'); g.addColorStop(1, 'rgba(255,248,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // trunks at the left and right edges, in front of nothing a child must touch
  for (const [x, tw, col] of [[-w * 0.02, w * 0.1, '#7a5532'], [w * 0.93, w * 0.12, '#6e4b2c'], [w * 0.12, w * 0.04, '#8a6540']] as const) {
    ctx.fillStyle = col; ctx.fillRect(x, 0, tw, h * 0.55);
  }
  // leaves
  for (let i = 0; i < 14; i++) {
    const x = ((i * 137) % 100) / 100 * w, y = ((i * 53) % 40) / 100 * h;
    ctx.fillStyle = i % 2 ? 'rgba(76,160,84,0.55)' : 'rgba(110,190,98,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.07, h * 0.03, 0.3 * Math.sin(t * 0.5 + i), 0, TAU); ctx.fill();
  }
  // the ground
  ctx.fillStyle = vGrad(ctx, h * 0.42, h, '#8fd079', '#5fae4f');
  ctx.beginPath(); ctx.moveTo(0, h * 0.46);
  ctx.quadraticCurveTo(w * 0.5, h * 0.4, w, h * 0.46); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 16; i++) {
    const x = ((i * 89 + 17) % 100) / 100 * w, y = h * (0.52 + ((i * 41) % 46) / 100);
    ctx.fillStyle = ['#fff', '#f9d85b', '#f59ab4'][i % 3];
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.256) * 3.4, y + Math.sin(k * 1.256) * 3.4, 2.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f2b134'; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
  }
}

/** A wooden picture card with an icon on it. `glow` is 0..1 (a right answer), `shake` shifts it sideways. */
export function drawCard(ctx: Ctx, icon: string, x: number, y: number, size: number, o: { glow?: number; shake?: number; pressed?: boolean; wrong?: boolean } = {}): void {
  const r = size * 0.14;
  ctx.save();
  ctx.translate(x + (o.shake ?? 0), y + (o.pressed ? size * 0.02 : 0));
  ctx.shadowColor = 'rgba(30,40,20,0.35)'; ctx.shadowBlur = size * 0.1; ctx.shadowOffsetY = size * 0.05;
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, r); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.strokeStyle = o.glow ? `rgba(70,170,90,${0.5 + 0.5 * o.glow})` : '#d9c9a3';
  ctx.stroke();
  if (o.glow) {
    ctx.fillStyle = `rgba(120,220,140,${0.25 * o.glow})`;
    ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, r); ctx.fill();
  }
  drawIcon(ctx, icon, 0, 0, size * 0.78);
  ctx.restore();
}
