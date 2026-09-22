/**
 * A drawing for every word in the game, and a scene for every sentence.
 *
 * A reading game that has to name the picture for you has already failed, so each of these has to
 * be recognisable to a four year old at the size of a stamp: one clear silhouette, strong colour,
 * the light from the top left like everywhere else in Braambos, and no detail that only works
 * large. Nothing is fetched. Nothing is a photograph. They are all canvas paths.
 *
 * Every drawing works inside a hundred by hundred box and the caller places it, the way
 * `animals/creatures.ts` does.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the little bits of drawing

const col = (g: Ctx, c: string): void => { g.fillStyle = c; };
const circle = (g: Ctx, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const ring = (g: Ctx, x: number, y: number, r: number, w: number, c: string): void => {
  g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
};
const box = (g: Ctx, x: number, y: number, w: number, h: number, r = 0): void => {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
};
const ell = (g: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void => {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
};
const poly = (g: Ctx, pts: number[][]): void => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath(); g.fill();
};
const stroke = (g: Ctx, pts: number[][], w: number, c: string, closed = false): void => {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  if (closed) g.closePath();
  g.stroke();
};
const curve = (g: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, c: string): void => {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
};
/** Two dots and a smile, which is most of what makes a shape into a creature. */
const face = (g: Ctx, x: number, y: number, s: number, ink = '#2a2118'): void => {
  col(g, ink);
  circle(g, x - s, y, s * 0.42); circle(g, x + s, y, s * 0.42);
};
const eye = (g: Ctx, x: number, y: number, r: number): void => {
  col(g, '#ffffff'); circle(g, x, y, r);
  col(g, '#2a2118'); circle(g, x + r * 0.15, y, r * 0.5);
};

const SKIN = '#f3c391', SKIN_D = '#d9a273';
const WOOD = '#b3793c', WOOD_D = '#8a5a28';
const LEAF = '#4f9d4f', LEAF_D = '#357a38';
const SKY = '#8fd0ee', WATER = '#3f93c7', WATER_D = '#2f6f9c';
const GREY = '#9aa7ae', GREY_D = '#6e7d86';

/** A trunk with a round crown: a tree turns up in half a dozen of these. */
function tree(g: Ctx, x: number, y: number, s: number, crown = LEAF): void {
  col(g, WOOD_D); box(g, x - 4 * s, y - 22 * s, 8 * s, 26 * s, 2 * s);
  col(g, crown); circle(g, x, y - 34 * s, 20 * s);
  circle(g, x - 14 * s, y - 24 * s, 13 * s); circle(g, x + 14 * s, y - 24 * s, 13 * s);
  col(g, 'rgba(255,255,255,0.18)'); circle(g, x - 7 * s, y - 42 * s, 8 * s);
}

// ---------------------------------------------------------------- the words

export const PICTURES: Record<string, (g: Ctx) => void> = {
  // ------------------------------------------------ three letters, short vowel
  bus: g => {
    col(g, '#f0b429'); box(g, 8, 26, 84, 46, 10);
    col(g, '#d99416'); box(g, 8, 58, 84, 14, 6);
    col(g, '#cdeaf7'); box(g, 15, 33, 24, 18, 4); box(g, 44, 33, 22, 18, 4); box(g, 70, 33, 15, 18, 4);
    col(g, '#3b3b3b'); circle(g, 28, 74, 11); circle(g, 72, 74, 11);
    col(g, '#b9c2c7'); circle(g, 28, 74, 4.5); circle(g, 72, 74, 4.5);
  },
  kat: g => {
    col(g, '#8d7461'); ell(g, 50, 62, 24, 22);
    poly(g, [[30, 44], [34, 24], [46, 38]]); poly(g, [[70, 44], [66, 24], [54, 38]]);
    col(g, '#a58b74'); circle(g, 50, 44, 20);
    curve(g, 72, 62, 92, 60, 86, 34, 6, '#8d7461');
    eye(g, 43, 43, 5); eye(g, 57, 43, 5);
    col(g, '#e08a8a'); poly(g, [[46, 51], [54, 51], [50, 56]]);
    stroke(g, [[34, 50], [24, 47]], 1.6, '#5c4a3a'); stroke(g, [[34, 54], [24, 56]], 1.6, '#5c4a3a');
    stroke(g, [[66, 50], [76, 47]], 1.6, '#5c4a3a'); stroke(g, [[66, 54], [76, 56]], 1.6, '#5c4a3a');
  },
  pen: g => {
    col(g, '#3f7fbf'); poly(g, [[22, 76], [30, 60], [70, 20], [80, 30], [40, 70]]);
    col(g, '#2b5f94'); poly(g, [[30, 60], [40, 70], [22, 76]]);
    col(g, '#1d3d5c'); poly(g, [[22, 76], [28, 68], [32, 72]]);
    col(g, '#e8c46a'); poly(g, [[64, 14], [80, 30], [86, 24], [70, 8]]);
  },
  vis: g => {
    col(g, '#f08a3c'); poly(g, [[26, 50], [8, 32], [12, 50], [8, 70]]);
    g.beginPath(); g.moveTo(24, 50); g.quadraticCurveTo(48, 20, 76, 36);
    g.quadraticCurveTo(92, 45, 94, 52); g.quadraticCurveTo(84, 70, 58, 74);
    g.quadraticCurveTo(36, 76, 24, 50); g.closePath(); g.fill();
    col(g, '#d76c22'); poly(g, [[48, 30], [58, 12], [70, 34]]);
    eye(g, 80, 46, 5);
    col(g, 'rgba(255,255,255,0.35)'); circle(g, 52, 58, 6); circle(g, 66, 60, 5);
  },
  zon: g => {
    col(g, '#f6c445');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      stroke(g, [[50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30], [50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44]], 6, '#f6c445');
    }
    col(g, '#ffd95e'); circle(g, 50, 50, 28);
    col(g, '#f8e6a0'); circle(g, 42, 42, 10);
    face(g, 50, 48, 7); col(g, '#c98a2c');
    curve(g, 42, 58, 50, 66, 58, 58, 3, '#c98a2c');
  },
  bal: g => {
    col(g, '#e0594a'); circle(g, 50, 52, 32);
    col(g, '#fdf6e8'); g.beginPath(); g.ellipse(50, 52, 10, 32, 0, 0, TAU); g.fill();
    col(g, '#2f6d94'); g.save(); g.beginPath(); g.arc(50, 52, 32, 0, TAU); g.clip();
    box(g, 18, 46, 64, 5); box(g, 18, 56, 64, 5); g.restore();
    col(g, 'rgba(255,255,255,0.4)'); ell(g, 40, 38, 9, 6, -0.5);
  },
  kip: g => {
    col(g, '#e8dfc8'); ell(g, 48, 60, 27, 23);
    col(g, '#fdfaf2'); ell(g, 46, 57, 24, 20);
    col(g, '#e8dfc8'); circle(g, 64, 38, 16);
    col(g, '#fdfaf2'); circle(g, 63, 37, 14);
    col(g, '#e0594a'); circle(g, 58, 22, 5); circle(g, 65, 20, 5); circle(g, 72, 24, 4);
    ell(g, 62, 50, 4, 6);
    col(g, '#f0b429'); poly(g, [[76, 38], [90, 42], [76, 46]]);
    col(g, '#d9cfb4'); poly(g, [[26, 54], [10, 64], [30, 72]]);
    eye(g, 69, 35, 3.6);
    col(g, '#e8a13c');
    stroke(g, [[44, 80], [44, 90]], 4, '#e8a13c'); stroke(g, [[58, 80], [58, 90]], 4, '#e8a13c');
    stroke(g, [[38, 90], [50, 90]], 4, '#e8a13c'); stroke(g, [[52, 90], [64, 90]], 4, '#e8a13c');
  },
  mus: g => {
    col(g, '#a3805c'); ell(g, 48, 54, 24, 19, -0.15);
    col(g, '#8a6846'); poly(g, [[26, 50], [6, 62], [28, 64]]);
    col(g, '#c9a97f'); circle(g, 68, 40, 14);
    col(g, '#6f5233'); ell(g, 44, 50, 14, 9, -0.3);
    col(g, '#e8a13c'); poly(g, [[80, 40], [92, 44], [80, 47]]);
    eye(g, 72, 37, 3.6);
    stroke(g, [[52, 72], [52, 82]], 3, '#e8a13c'); stroke(g, [[62, 72], [62, 82]], 3, '#e8a13c');
  },
  rok: g => {
    col(g, '#d3588f'); poly(g, [[34, 26], [66, 26], [86, 80], [14, 80]]);
    col(g, '#b8447a'); poly(g, [[34, 26], [66, 26], [68, 40], [32, 40]]);
    col(g, 'rgba(255,255,255,0.25)');
    for (const x of [-16, 0, 16]) poly(g, [[48 + x * 0.55, 42], [52 + x * 0.55, 42], [56 + x, 80], [48 + x, 80]]);
  },
  tak: g => {
    stroke(g, [[10, 82], [40, 60], [62, 40], [88, 20]], 8, WOOD_D);
    stroke(g, [[40, 60], [34, 36]], 5, WOOD_D); stroke(g, [[62, 40], [72, 54]], 5, WOOD_D);
    col(g, LEAF); ell(g, 32, 30, 10, 6, -0.9); ell(g, 76, 58, 10, 6, 0.6);
    ell(g, 56, 40, 10, 6, -0.4); ell(g, 84, 22, 9, 6, -0.5);
    col(g, LEAF_D); ell(g, 44, 52, 8, 5, -0.4);
  },
  bos: g => {
    col(g, '#cfe3b4'); box(g, 0, 74, 100, 26, 0);
    tree(g, 26, 78, 0.58); tree(g, 74, 80, 0.54, '#3f8f4a'); tree(g, 50, 72, 0.72);
  },
  pet: g => {
    col(g, '#3f7fbf'); g.beginPath(); g.arc(48, 52, 28, Math.PI, TAU); g.fill();
    box(g, 20, 50, 56, 10, 4);
    col(g, '#2b5f94'); g.beginPath(); g.ellipse(74, 56, 22, 8, 0, Math.PI, TAU); g.fill();
    box(g, 74, 52, 22, 6, 3);
    col(g, '#f0b429'); circle(g, 48, 26, 4);
    col(g, 'rgba(255,255,255,0.22)'); ell(g, 38, 36, 10, 6, -0.5);
  },
  jas: g => {
    col(g, '#4a8f6d'); poly(g, [[34, 20], [66, 20], [82, 34], [82, 82], [18, 82], [18, 34]]);
    col(g, '#3b7659'); box(g, 46, 20, 8, 62, 0);
    poly(g, [[34, 20], [50, 34], [40, 38]]); poly(g, [[66, 20], [50, 34], [60, 38]]);
    col(g, '#f0d79b'); circle(g, 50, 46, 3.2); circle(g, 50, 60, 3.2); circle(g, 50, 74, 3.2);
  },
  mes: g => {
    col(g, '#b3bcc1'); poly(g, [[8, 84], [16, 76], [70, 22], [80, 32], [26, 86], [14, 90]]);
    col(g, '#eef3f6'); poly(g, [[8, 84], [16, 76], [70, 22], [74, 26], [18, 82]]);
    col(g, '#8a9aa3'); poly(g, [[26, 86], [80, 32], [74, 26], [20, 80]]);
    col(g, WOOD_D); box(g, 62, 4, 30, 22, 7); g.save(); g.translate(77, 15); g.rotate(-0.78);
    g.translate(-77, -15); col(g, WOOD_D); box(g, 62, 4, 32, 22, 7);
    col(g, WOOD); box(g, 62, 4, 32, 9, 4);
    col(g, '#6f4a20'); circle(g, 70, 15, 2.6); circle(g, 86, 15, 2.6); g.restore();
  },
  zak: g => {
    col(g, '#d9a96a'); poly(g, [[20, 34], [80, 34], [74, 84], [26, 84]]);
    col(g, '#c2914f'); poly(g, [[20, 34], [80, 34], [78, 44], [22, 44]]);
    col(g, '#a87a3f'); poly(g, [[20, 34], [34, 22], [50, 34]]); poly(g, [[80, 34], [66, 22], [50, 34]]);
    col(g, 'rgba(255,255,255,0.2)'); box(g, 32, 50, 8, 28, 4);
  },
  kam: g => {
    col(g, '#5e4b6b'); box(g, 12, 30, 76, 20, 6);
    for (let i = 0; i < 11; i++) box(g, 14 + i * 7, 48, 4, 26, 2);
    col(g, '#7a648a'); box(g, 12, 30, 76, 8, 4);
  },
  bot: g => {
    col(g, '#f3ecd8');
    circle(g, 26, 34, 12); circle(g, 22, 48, 11); circle(g, 78, 52, 12); circle(g, 82, 66, 11);
    stroke(g, [[28, 42], [76, 58]], 18, '#f3ecd8');
    col(g, '#dcd2b6'); ell(g, 50, 54, 22, 4, 0.3);
  },
  hok: g => {
    col(g, WOOD); box(g, 16, 40, 68, 46, 4);
    col(g, '#a04c3c'); poly(g, [[10, 42], [50, 16], [90, 42]]);
    col(g, WOOD_D); box(g, 34, 52, 32, 34, 3);
    col(g, '#3d2c1c'); box(g, 38, 56, 24, 30, 3);
    col(g, '#e8dfc8'); circle(g, 50, 70, 8);
    col(g, '#2a2118'); circle(g, 47, 68, 1.6); circle(g, 53, 68, 1.6);
  },
  net: g => {
    stroke(g, [[76, 82], [58, 50]], 7, WOOD_D);
    ring(g, 44, 40, 26, 6, '#cfd8dd');
    g.save(); g.beginPath(); g.arc(44, 40, 24, 0, TAU); g.clip();
    for (let i = -3; i < 4; i++) {
      stroke(g, [[44 + i * 12 - 26, 14], [44 + i * 12 + 26, 66]], 2, 'rgba(120,140,150,0.75)');
      stroke(g, [[44 + i * 12 - 26, 66], [44 + i * 12 + 26, 14]], 2, 'rgba(120,140,150,0.75)');
    }
    g.restore();
  },
  pot: g => {
    col(g, '#7fb3a0'); box(g, 22, 36, 56, 50, 10);
    col(g, '#6a9a89'); box(g, 18, 26, 64, 14, 6);
    col(g, '#95c7b5'); box(g, 26, 44, 14, 32, 6);
    col(g, '#f6efdc'); box(g, 34, 54, 32, 20, 3);
  },
  rat: g => {
    col(g, '#98a2a8'); ell(g, 52, 60, 26, 19);
    circle(g, 78, 52, 14);
    col(g, '#b3bcc1'); circle(g, 30, 44, 11); circle(g, 46, 40, 10);
    curve(g, 28, 66, 6, 70, 8, 44, 4, '#98a2a8');
    eye(g, 82, 48, 3.6);
    col(g, '#e08a8a'); circle(g, 91, 54, 3);
    stroke(g, [[86, 58], [96, 62]], 1.4, '#5c4a3a'); stroke(g, [[86, 56], [96, 52]], 1.4, '#5c4a3a');
  },
  zes: g => {
    col(g, '#fdf6e8'); box(g, 16, 16, 68, 68, 12);
    col(g, '#e0594a');
    for (const [x, y] of [[34, 32], [66, 32], [34, 50], [66, 50], [34, 68], [66, 68]]) circle(g, x, y, 7);
    col(g, 'rgba(0,0,0,0.06)'); box(g, 16, 72, 68, 12, 12);
  },
  bel: g => {
    col(g, '#e8b23c'); g.beginPath(); g.moveTo(24, 66); g.quadraticCurveTo(26, 26, 50, 22);
    g.quadraticCurveTo(74, 26, 76, 66); g.closePath(); g.fill();
    col(g, '#d09a24'); box(g, 18, 64, 64, 10, 5);
    circle(g, 50, 80, 7);
    col(g, '#f4d484'); g.beginPath(); g.moveTo(34, 62); g.quadraticCurveTo(36, 32, 48, 28);
    g.quadraticCurveTo(42, 40, 42, 62); g.closePath(); g.fill();
    col(g, '#8a6a20'); box(g, 46, 12, 8, 12, 4);
  },
  pop: g => {
    col(g, '#e08fb0'); poly(g, [[34, 52], [66, 52], [76, 86], [24, 86]]);
    col(g, SKIN); circle(g, 50, 34, 20);
    box(g, 22, 54, 14, 6, 3); box(g, 64, 54, 14, 6, 3);
    col(g, '#c9743f'); g.beginPath(); g.arc(50, 32, 21, Math.PI, TAU); g.fill();
    ell(g, 30, 36, 6, 10); ell(g, 70, 36, 6, 10);
    eye(g, 43, 36, 4); eye(g, 57, 36, 4);
    col(g, '#d3588f'); curve(g, 45, 44, 50, 49, 55, 44, 2.4, '#d3588f');
  },
  sok: g => {
    col(g, '#e0594a'); g.beginPath(); g.moveTo(34, 16); g.lineTo(62, 16); g.lineTo(62, 56);
    g.quadraticCurveTo(62, 70, 46, 72); g.lineTo(22, 72); g.quadraticCurveTo(12, 70, 14, 58);
    g.quadraticCurveTo(18, 48, 34, 48); g.closePath(); g.fill();
    col(g, '#fdf6e8'); box(g, 34, 16, 28, 12, 0);
    col(g, '#c34434'); ell(g, 22, 62, 10, 9);
  },
  tas: g => {
    col(g, '#a0522d'); box(g, 18, 40, 64, 44, 8);
    col(g, '#8a4424'); box(g, 18, 40, 64, 14, 6);
    ring(g, 50, 40, 18, 6, '#8a4424');
    col(g, '#e8c46a'); box(g, 44, 52, 12, 10, 3);
  },
  dak: g => {
    col(g, '#c05a44'); poly(g, [[6, 74], [50, 22], [94, 74]]);
    col(g, '#a84a36');
    for (let r = 0; r < 4; r++) {
      const y = 36 + r * 10, half = (y - 22) * 0.86;
      stroke(g, [[50 - half, y], [50 + half, y]], 2.4, 'rgba(120,50,36,0.6)');
    }
    col(g, '#e8dfc8'); box(g, 6, 74, 88, 10, 3);
  },
  gat: g => {
    col(g, '#b08a5c'); box(g, 0, 56, 100, 44, 0);
    col(g, '#8a6842'); ell(g, 50, 60, 30, 12);
    col(g, '#3a2c1c'); ell(g, 50, 62, 26, 10);
    col(g, '#2a1f12'); ell(g, 50, 65, 22, 7);
    col(g, '#9a7850'); ell(g, 20, 54, 14, 6); ell(g, 80, 54, 12, 5);
  },
  wol: g => {
    col(g, '#d97fa8'); circle(g, 48, 54, 30);
    col(g, '#c26a92');
    for (let i = 0; i < 5; i++) curve(g, 20, 44 + i * 6, 50, 34 + i * 10, 78, 50 + i * 5, 2.4, '#c26a92');
    curve(g, 76, 44, 92, 30, 88, 14, 3.4, '#d97fa8');
    col(g, 'rgba(255,255,255,0.25)'); ell(g, 36, 38, 10, 6, -0.5);
  },
  kop: g => {
    col(g, '#fdf6e8'); box(g, 22, 34, 48, 50, 8);
    col(g, '#e6dcc6'); box(g, 22, 34, 48, 10, 5);
    ring(g, 74, 52, 12, 7, '#fdf6e8');
    col(g, '#8a5a28'); ell(g, 46, 40, 20, 5);
    col(g, 'rgba(255,255,255,0.5)'); box(g, 28, 48, 7, 28, 4);
  },
  man: g => {
    col(g, '#3f7fbf'); box(g, 32, 44, 36, 34, 8);
    box(g, 34, 74, 13, 20, 5); box(g, 53, 74, 13, 20, 5);
    col(g, SKIN); circle(g, 50, 28, 16);
    box(g, 20, 46, 12, 8, 4); box(g, 68, 46, 12, 8, 4);
    col(g, '#5c4632'); g.beginPath(); g.arc(50, 26, 17, Math.PI * 1.08, TAU * 0.98); g.fill();
    eye(g, 44, 29, 3.4); eye(g, 56, 29, 3.4);
    col(g, '#b3603f'); curve(g, 45, 36, 50, 40, 55, 36, 2, '#b3603f');
  },
  mat: g => {
    col(g, '#b3793c'); poly(g, [[10, 46], [90, 46], [98, 80], [2, 80]]);
    col(g, '#8a5a28');
    for (let i = 1; i < 7; i++) stroke(g, [[10 + i * 11.4, 46], [6 + i * 12.3, 80]], 2, 'rgba(90,60,28,0.5)');
    stroke(g, [[6, 63], [94, 63]], 2, 'rgba(90,60,28,0.5)');
    col(g, '#f6efdc'); box(g, 30, 56, 40, 14, 3);
  },
  kom: g => {
    col(g, '#4f9dc4'); g.beginPath(); g.moveTo(14, 44); g.lineTo(86, 44);
    g.quadraticCurveTo(80, 84, 50, 84); g.quadraticCurveTo(20, 84, 14, 44); g.closePath(); g.fill();
    col(g, '#3d85aa'); ell(g, 50, 44, 36, 8);
    col(g, '#fdf6e8'); ell(g, 50, 44, 30, 6);
    col(g, 'rgba(255,255,255,0.3)'); ell(g, 30, 58, 6, 12, 0.3);
  },
  bok: g => {
    col(g, '#cdbfae'); ell(g, 46, 56, 26, 19);
    box(g, 30, 70, 8, 22, 4); box(g, 56, 70, 8, 22, 4);
    circle(g, 74, 42, 14);
    col(g, '#b3a292'); poly(g, [[70, 30], [64, 14], [76, 24]]); poly(g, [[82, 30], [90, 14], [84, 26]]);
    col(g, '#e8e0d4'); poly(g, [[74, 52], [70, 66], [80, 62]]);
    eye(g, 80, 40, 3.4);
    curve(g, 22, 50, 10, 42, 16, 32, 4, '#cdbfae');
  },
  hek: g => {
    col(g, '#cfe3b4'); box(g, 0, 76, 100, 24, 0);
    col(g, '#e8dfc8');
    for (const x of [10, 30, 50, 70, 88]) poly(g, [[x, 84], [x, 36], [x + 6, 28], [x + 12, 36], [x + 12, 84]]);
    col(g, '#d3c9ac'); box(g, 6, 44, 90, 7, 2); box(g, 6, 62, 90, 7, 2);
  },
  vos: g => {
    col(g, '#e07b35'); ell(g, 50, 58, 26, 20);
    poly(g, [[26, 60], [4, 46], [8, 70]]);
    col(g, '#f6efdc'); poly(g, [[12, 50], [2, 47], [6, 60]]);
    col(g, '#e07b35'); circle(g, 72, 44, 16);
    poly(g, [[60, 34], [58, 14], [72, 30]]); poly(g, [[84, 34], [88, 14], [76, 30]]);
    col(g, '#f6efdc'); poly(g, [[72, 48], [62, 60], [84, 60]]);
    eye(g, 66, 42, 3.8); eye(g, 79, 42, 3.8);
    col(g, '#2a2118'); circle(g, 73, 58, 3.4);
    col(g, '#c56628'); box(g, 40, 74, 8, 14, 4); box(g, 60, 74, 8, 14, 4);
  },
};

// ------------------------------------------------ the doubled vowel: maan, boom, muur
const LANG: Record<string, (g: Ctx) => void> = {
  maan: g => {
    col(g, '#1e3a5c'); box(g, 0, 0, 100, 100, 0);
    col(g, '#f6e8a8');
    g.beginPath(); g.arc(52, 50, 32, 0, TAU);
    g.arc(38, 44, 28, 0, TAU, true); g.fill();
    col(g, '#e2d089'); circle(g, 68, 60, 5); circle(g, 62, 32, 3.4);
    col(g, '#fdf6c8');
    for (const [x, y, r] of [[16, 18, 3], [86, 22, 2.4], [22, 82, 2.6], [80, 84, 3]]) circle(g, x, y, r);
  },
  boom: g => { col(g, '#cfe3b4'); box(g, 0, 80, 100, 20, 0); tree(g, 50, 84, 1); },
  muur: g => {
    col(g, '#c9705a'); box(g, 6, 20, 88, 68, 3);
    col(g, '#e8dfc8');
    for (let r = 0; r < 5; r++) {
      const off = r % 2 ? 0 : -11;
      for (let c = 0; c < 5; c++) {
        const x = 8 + off + c * 22;
        box(g, Math.max(8, x), 22 + r * 13, Math.min(20, 92 - Math.max(8, x)), 11, 1.5);
      }
    }
    col(g, 'rgba(255,255,255,0.18)'); box(g, 6, 20, 88, 8, 2);
  },
  vuur: g => {
    col(g, WOOD_D); stroke(g, [[22, 82], [74, 74]], 8, WOOD_D); stroke(g, [[26, 74], [78, 82]], 8, WOOD);
    col(g, '#e8672c');
    g.beginPath(); g.moveTo(50, 12); g.quadraticCurveTo(76, 40, 74, 58);
    g.quadraticCurveTo(70, 78, 50, 78); g.quadraticCurveTo(30, 78, 26, 58);
    g.quadraticCurveTo(24, 40, 50, 12); g.fill();
    col(g, '#f6a83c');
    g.beginPath(); g.moveTo(50, 32); g.quadraticCurveTo(64, 48, 62, 60);
    g.quadraticCurveTo(60, 72, 50, 72); g.quadraticCurveTo(40, 72, 38, 60);
    g.quadraticCurveTo(36, 48, 50, 32); g.fill();
    col(g, '#f8dc86'); ell(g, 50, 62, 7, 10);
  },
  been: g => {
    col(g, SKIN); g.beginPath(); g.moveTo(34, 8); g.lineTo(60, 8); g.lineTo(58, 44);
    g.quadraticCurveTo(66, 62, 58, 78); g.lineTo(58, 84); g.lineTo(36, 84);
    g.quadraticCurveTo(40, 62, 38, 44); g.closePath(); g.fill();
    col(g, SKIN_D); g.beginPath(); g.moveTo(58, 78); g.lineTo(58, 86); g.lineTo(84, 86);
    g.quadraticCurveTo(86, 76, 60, 74); g.closePath(); g.fill();
    col(g, '#c9743f'); box(g, 34, 8, 26, 10, 3);
  },
  boot: g => {
    col(g, WATER); box(g, 0, 66, 100, 34, 0);
    col(g, '#fdf6e8'); poly(g, [[18, 66], [82, 66], [70, 84], [30, 84]]);
    col(g, '#e0594a'); box(g, 46, 20, 6, 46, 2);
    col(g, '#fdf6e8'); poly(g, [[52, 22], [84, 62], [52, 62]]);
    col(g, '#e6dcc6'); poly(g, [[44, 26], [18, 62], [44, 62]]);
    col(g, WATER_D); curve(g, 4, 80, 20, 86, 36, 80, 3, WATER_D); curve(g, 60, 88, 76, 82, 94, 88, 3, WATER_D);
  },
  haan: g => {
    col(g, '#c9743f'); ell(g, 44, 58, 24, 22);
    col(g, '#8a4424'); poly(g, [[22, 50], [4, 30], [8, 62]]); poly(g, [[24, 58], [2, 52], [10, 72]]);
    col(g, '#d98a4c'); circle(g, 68, 38, 15);
    col(g, '#e0594a'); circle(g, 62, 22, 6); circle(g, 70, 20, 6); circle(g, 77, 24, 5);
    ell(g, 66, 52, 4, 6);
    col(g, '#f0b429'); poly(g, [[80, 38], [94, 42], [80, 46]]);
    eye(g, 73, 35, 3.6);
    col(g, '#f0b429'); stroke(g, [[40, 78], [40, 90]], 4, '#f0b429'); stroke(g, [[54, 78], [54, 90]], 4, '#f0b429');
  },
  zeep: g => {
    col(g, '#5fb6ac'); box(g, 14, 48, 72, 36, 12);
    col(g, '#8fd0c8'); box(g, 14, 44, 72, 30, 11);
    col(g, '#b3e2db'); box(g, 20, 48, 40, 8, 4);
    col(g, '#7fc0e0');
    for (const [x, y, r] of [[30, 26, 11], [54, 16, 8], [70, 30, 9], [45, 36, 5]]) {
      circle(g, x, y, r);
      col(g, '#cdeaf7'); circle(g, x - r * 0.3, y - r * 0.3, r * 0.45);
      col(g, '#7fc0e0');
    }
  },
  poot: g => {
    col(g, '#8d7461'); ell(g, 50, 62, 24, 20);
    ell(g, 26, 38, 10, 12, -0.3); ell(g, 42, 28, 10, 12, -0.1);
    ell(g, 60, 28, 10, 12, 0.1); ell(g, 75, 38, 10, 12, 0.3);
    col(g, '#e0a898'); ell(g, 50, 62, 15, 12);
    ell(g, 27, 38, 6, 7, -0.3); ell(g, 42, 29, 6, 7, -0.1); ell(g, 60, 29, 6, 7, 0.1); ell(g, 74, 38, 6, 7, 0.3);
  },
  kaas: g => {
    col(g, '#f6c445'); poly(g, [[10, 76], [10, 40], [88, 28], [88, 64]]);
    col(g, '#e8a90e'); poly(g, [[10, 40], [88, 28], [88, 34], [10, 46]]);
    col(g, '#d99416'); circle(g, 30, 60, 6); circle(g, 52, 54, 8); circle(g, 72, 48, 5); circle(g, 42, 70, 4);
  },
  raam: g => {
    col(g, '#b3793c'); box(g, 10, 14, 80, 74, 5);
    col(g, '#9fd8f2'); box(g, 16, 20, 68, 62, 3);
    col(g, 'rgba(255,255,255,0.45)'); poly(g, [[20, 78], [52, 22], [64, 22], [32, 78]]);
    col(g, '#b3793c'); box(g, 46, 14, 8, 74, 0); box(g, 10, 46, 80, 8, 0);
    col(g, '#8a5a28'); box(g, 6, 84, 88, 8, 3);
  },
  teen: g => {
    col(g, SKIN); g.beginPath(); g.moveTo(16, 56); g.quadraticCurveTo(14, 78, 40, 80);
    g.lineTo(76, 80); g.quadraticCurveTo(92, 78, 88, 62); g.quadraticCurveTo(80, 50, 54, 52);
    g.quadraticCurveTo(24, 46, 16, 56); g.fill();
    col(g, SKIN_D);
    ell(g, 84, 56, 8, 7); ell(g, 68, 46, 7, 6); ell(g, 54, 42, 6, 6); ell(g, 41, 42, 5, 5); ell(g, 29, 44, 4.5, 4.5);
    col(g, '#f6e0d0'); ell(g, 86, 53, 4, 3.4);
  },
  noot: g => {
    col(g, '#a0703c'); g.beginPath(); g.moveTo(50, 14); g.quadraticCurveTo(86, 30, 82, 58);
    g.quadraticCurveTo(76, 86, 50, 86); g.quadraticCurveTo(24, 86, 18, 58);
    g.quadraticCurveTo(14, 30, 50, 14); g.fill();
    col(g, '#8a5a28'); box(g, 46, 16, 8, 70, 4);
    col(g, '#b98a54'); curve(g, 34, 32, 26, 54, 34, 74, 3, '#b98a54');
    curve(g, 66, 32, 74, 54, 66, 74, 3, '#b98a54');
    col(g, '#6f4a20'); box(g, 44, 8, 12, 10, 4);
  },
  vaas: g => {
    col(g, LEAF); stroke(g, [[50, 60], [50, 30]], 4, LEAF_D);
    stroke(g, [[34, 62], [30, 36]], 3.4, LEAF_D); stroke(g, [[66, 62], [72, 38]], 3.4, LEAF_D);
    col(g, '#e0594a'); circle(g, 50, 24, 11);
    col(g, '#f0a04b'); circle(g, 29, 30, 9); col(g, '#d3588f'); circle(g, 73, 32, 9);
    col(g, '#f6d55c'); circle(g, 50, 24, 4); circle(g, 29, 30, 3.4); circle(g, 73, 32, 3.4);
    col(g, '#4f9dc4'); g.beginPath(); g.moveTo(36, 56); g.quadraticCurveTo(24, 74, 34, 88);
    g.lineTo(66, 88); g.quadraticCurveTo(76, 74, 64, 56); g.closePath(); g.fill();
    col(g, 'rgba(255,255,255,0.3)'); box(g, 40, 62, 6, 20, 3);
  },
  mees: g => {
    col(g, '#f6d55c'); ell(g, 48, 58, 22, 20);
    col(g, '#3f7fbf'); g.beginPath(); g.arc(60, 40, 15, 0, TAU); g.fill();
    poly(g, [[28, 52], [8, 62], [30, 68]]);
    col(g, '#fdf6e8'); ell(g, 56, 44, 8, 6);
    col(g, '#2f6d94'); ell(g, 48, 50, 14, 8, -0.3);
    col(g, '#3b3b3b'); poly(g, [[72, 38], [84, 42], [72, 45]]);
    eye(g, 64, 36, 3.4);
    col(g, '#8a6a20'); stroke(g, [[46, 76], [46, 86]], 3, '#8a6a20'); stroke(g, [[56, 76], [56, 86]], 3, '#8a6a20');
  },
  roos: g => {
    col(g, LEAF_D); stroke(g, [[50, 88], [50, 46]], 5, LEAF_D);
    col(g, LEAF); ell(g, 30, 62, 14, 7, -0.3); ell(g, 70, 70, 14, 7, 0.3);
    col(g, '#c9344e'); circle(g, 50, 38, 26);
    col(g, '#e0594a'); circle(g, 50, 38, 18);
    col(g, '#c9344e'); ring(g, 50, 38, 11, 4, '#c9344e');
    col(g, '#e8768a'); circle(g, 50, 38, 6);
    col(g, 'rgba(255,255,255,0.25)'); ell(g, 38, 26, 8, 5, -0.5);
  },
  zaag: g => {
    col(g, '#9aa7ae'); poly(g, [[10, 28], [78, 28], [78, 52], [10, 52]]);
    col(g, '#cfd8dd'); box(g, 10, 28, 68, 10, 0);
    col(g, '#8a9aa3');
    for (let i = 0; i < 11; i++) poly(g, [[10 + i * 6.2, 52], [16 + i * 6.2, 52], [13 + i * 6.2, 64]]);
    col(g, '#6e7d86'); stroke(g, [[10, 52], [78, 52]], 2, '#6e7d86');
    col(g, '#8a5a28'); g.beginPath(); g.moveTo(76, 20); g.lineTo(96, 26); g.lineTo(96, 58);
    g.lineTo(76, 60); g.closePath(); g.fill();
    col(g, WOOD); box(g, 78, 26, 14, 10, 4);
    col(g, '#6f4a20'); circle(g, 86, 32, 3); circle(g, 86, 50, 3);
  },
  haar: g => {
    col(g, SKIN); circle(g, 50, 52, 26);
    col(g, '#8a4424'); g.beginPath(); g.arc(50, 48, 30, Math.PI, TAU); g.fill();
    g.beginPath(); g.moveTo(20, 48); g.quadraticCurveTo(12, 84, 24, 92);
    g.quadraticCurveTo(28, 70, 28, 52); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(80, 48); g.quadraticCurveTo(88, 84, 76, 92);
    g.quadraticCurveTo(72, 70, 72, 52); g.closePath(); g.fill();
    col(g, '#a0522d'); curve(g, 26, 34, 50, 22, 74, 34, 5, '#a0522d');
    eye(g, 42, 52, 4); eye(g, 58, 52, 4);
    col(g, '#b3603f'); curve(g, 44, 62, 50, 67, 56, 62, 2.4, '#b3603f');
  },
  peer: g => {
    col(g, '#a8c64f'); g.beginPath(); g.moveTo(50, 20); g.quadraticCurveTo(62, 34, 62, 46);
    g.quadraticCurveTo(84, 58, 78, 74); g.quadraticCurveTo(72, 90, 50, 90);
    g.quadraticCurveTo(28, 90, 22, 74); g.quadraticCurveTo(16, 58, 38, 46);
    g.quadraticCurveTo(38, 34, 50, 20); g.fill();
    col(g, '#8faa38'); ell(g, 66, 72, 10, 16, -0.2);
    col(g, WOOD_D); stroke(g, [[50, 22], [54, 8]], 4, WOOD_D);
    col(g, LEAF); ell(g, 64, 12, 10, 5, -0.4);
    col(g, 'rgba(255,255,255,0.3)'); ell(g, 36, 62, 6, 11, 0.2);
  },
  veer: g => {
    col(g, '#7fb6d8');
    g.beginPath(); g.moveTo(74, 10); g.quadraticCurveTo(36, 30, 20, 84);
    g.quadraticCurveTo(52, 70, 74, 10); g.fill();
    col(g, '#a8cfe6');
    g.beginPath(); g.moveTo(74, 10); g.quadraticCurveTo(86, 46, 58, 76);
    g.quadraticCurveTo(66, 44, 74, 10); g.fill();
    col(g, '#5f96bb');
    for (let i = 0; i < 8; i++) {
      const t = 0.12 + i * 0.1;
      const x = 74 - 54 * t * t - 6 * t, y = 10 + 74 * t;
      stroke(g, [[x + 10 * (1 - t), y - 6 * (1 - t)], [x - 14 * (1 - t), y + 6]], 2, 'rgba(70,120,150,0.45)');
    }
    col(g, '#e8dfc8'); stroke(g, [[74, 8], [20, 88]], 3.4, '#efe7d4');
    col(g, '#cfc6ae'); stroke(g, [[24, 82], [16, 94]], 3, '#cfc6ae');
  },
};
Object.assign(PICTURES, LANG);

// ------------------------------------------------ two letters, one sound: ui, oe, eu, ie, eeuw
const DUO: Record<string, (g: Ctx) => void> = {
  huis: g => {
    col(g, '#e8dfc8'); box(g, 16, 44, 68, 46, 3);
    col(g, '#c05a44'); poly(g, [[8, 46], [50, 14], [92, 46]]);
    col(g, '#9fd8f2'); box(g, 24, 54, 18, 16, 2); box(g, 58, 54, 18, 16, 2);
    col(g, WOOD_D); box(g, 42, 66, 16, 24, 2);
    col(g, '#f0b429'); circle(g, 54, 78, 2);
    col(g, '#a84a36'); box(g, 66, 22, 10, 16, 2);
  },
  muis: g => {
    col(g, '#b3bcc1'); ell(g, 48, 62, 26, 19);
    circle(g, 30, 46, 13); circle(g, 66, 44, 12);
    col(g, '#cdd5d9'); circle(g, 30, 46, 8); circle(g, 66, 44, 7);
    col(g, '#b3bcc1'); circle(g, 48, 58, 20);
    curve(g, 72, 72, 94, 72, 88, 48, 4, '#b3bcc1');
    eye(g, 42, 56, 4);
    col(g, '#e08a8a'); circle(g, 30, 66, 3.4);
    stroke(g, [[34, 68], [18, 74]], 1.4, '#5c4a3a'); stroke(g, [[34, 64], [18, 60]], 1.4, '#5c4a3a');
  },
  duim: g => {
    // a fist seen from the side, with the thumb standing clear of it
    col(g, SKIN_D); box(g, 24, 42, 50, 44, 16);
    col(g, SKIN); box(g, 24, 38, 50, 44, 16);
    col(g, SKIN_D);
    stroke(g, [[38, 44], [38, 78]], 2, 'rgba(190,140,100,0.55)');
    stroke(g, [[52, 42], [52, 80]], 2, 'rgba(190,140,100,0.55)');
    stroke(g, [[66, 44], [66, 78]], 2, 'rgba(190,140,100,0.55)');
    // the thumb, up and out to the left, with air around it
    col(g, SKIN_D);
    g.save(); g.translate(30, 34); g.rotate(-0.22); g.translate(-30, -34);
    box(g, 18, 6, 24, 38, 12);
    col(g, SKIN); box(g, 18, 2, 24, 38, 12);
    col(g, '#f6e0d0'); ell(g, 30, 12, 7, 9);
    g.restore();
    col(g, '#3f7fbf'); box(g, 20, 84, 58, 14, 7);
    col(g, '#2b5f94'); box(g, 20, 84, 58, 6, 3);
  },
  uil: g => {
    col(g, '#8a6846'); ell(g, 50, 56, 28, 32);
    col(g, '#a3805c'); ell(g, 50, 62, 20, 24);
    col(g, '#6f5233'); poly(g, [[26, 34], [24, 16], [40, 28]]); poly(g, [[74, 34], [76, 16], [60, 28]]);
    col(g, '#f6efdc'); circle(g, 39, 44, 12); circle(g, 61, 44, 12);
    col(g, '#2a2118'); circle(g, 40, 45, 6); circle(g, 60, 45, 6);
    col(g, '#f0b429'); poly(g, [[50, 48], [44, 58], [56, 58]]);
    col(g, '#e8a13c'); stroke(g, [[42, 86], [42, 92]], 4, '#e8a13c'); stroke(g, [[58, 86], [58, 92]], 4, '#e8a13c');
  },
  tuin: g => {
    col(g, '#8fd0ee'); box(g, 0, 0, 100, 72, 0);
    col(g, '#79c05e'); box(g, 0, 62, 100, 38, 0);
    col(g, '#e8dfc8');
    for (const x of [6, 26, 46, 66, 86]) poly(g, [[x, 78], [x, 52], [x + 5, 46], [x + 10, 52], [x + 10, 78]]);
    col(g, '#d3c9ac'); box(g, 2, 58, 96, 6, 2);
    col(g, '#e0594a'); circle(g, 18, 84, 6); col(g, '#f6d55c'); circle(g, 18, 84, 2.4);
    col(g, '#d3588f'); circle(g, 52, 88, 6); col(g, '#f6d55c'); circle(g, 52, 88, 2.4);
    col(g, LEAF_D); stroke(g, [[18, 96], [18, 88]], 2.4, LEAF_D); stroke(g, [[52, 98], [52, 92]], 2.4, LEAF_D);
    col(g, '#f6c445'); circle(g, 84, 14, 10);
  },
  buik: g => {
    col(g, '#f0b429'); box(g, 26, 18, 48, 18, 8);
    col(g, SKIN); circle(g, 50, 14, 13);
    col(g, SKIN); ell(g, 50, 58, 28, 26);
    col(g, '#f6bd78'); ell(g, 50, 60, 20, 19);
    col(g, SKIN_D); circle(g, 50, 62, 4.5);
    ring(g, 50, 62, 6.5, 2, '#d9a273');
    col(g, SKIN); ell(g, 20, 62, 11, 8, -0.4); ell(g, 80, 62, 11, 8, 0.4);
    col(g, '#3f7fbf'); box(g, 22, 82, 56, 16, 7);
    col(g, '#2b5f94'); box(g, 22, 82, 56, 6, 3);
  },
  boek: g => {
    col(g, '#c05a44'); poly(g, [[6, 26], [50, 34], [94, 26], [94, 80], [50, 88], [6, 80]]);
    col(g, '#fdf6e8'); poly(g, [[10, 30], [48, 37], [48, 84], [10, 76]]);
    poly(g, [[90, 30], [52, 37], [52, 84], [90, 76]]);
    col(g, '#c9c0a8');
    for (let i = 0; i < 4; i++) {
      stroke(g, [[16, 44 + i * 9], [42, 48 + i * 9]], 2, '#c9c0a8');
      stroke(g, [[58, 48 + i * 9], [84, 44 + i * 9]], 2, '#c9c0a8');
    }
    col(g, '#a84a36'); box(g, 48, 34, 4, 52, 1);
  },
  koe: g => {
    col(g, '#fdfaf2'); ell(g, 46, 58, 28, 22);
    box(g, 26, 72, 9, 20, 4); box(g, 58, 72, 9, 20, 4);
    col(g, '#3b3b3b'); ell(g, 36, 52, 11, 8, -0.3); ell(g, 58, 64, 9, 7, 0.2);
    col(g, '#fdfaf2'); circle(g, 74, 44, 16);
    col(g, '#3b3b3b'); ell(g, 68, 34, 8, 6, -0.4);
    col(g, '#e0a898'); ell(g, 80, 52, 11, 9);
    col(g, '#c98a8a'); circle(g, 77, 52, 2); circle(g, 84, 52, 2);
    eye(g, 72, 40, 3.4);
    col(g, '#cdbfae'); poly(g, [[62, 32], [56, 22], [68, 28]]); poly(g, [[86, 32], [92, 22], [82, 28]]);
    col(g, '#3b3b3b'); curve(g, 20, 60, 6, 66, 12, 84, 3, '#3b3b3b');
  },
  voet: g => {
    col(g, SKIN); g.beginPath(); g.moveTo(30, 12); g.lineTo(52, 12);
    g.quadraticCurveTo(56, 40, 54, 54); g.quadraticCurveTo(84, 56, 86, 72);
    g.quadraticCurveTo(86, 86, 64, 86); g.lineTo(34, 86);
    g.quadraticCurveTo(22, 84, 24, 66); g.quadraticCurveTo(28, 40, 30, 12); g.fill();
    col(g, SKIN_D);
    ell(g, 80, 66, 6, 5); ell(g, 70, 60, 5, 4.5); ell(g, 61, 57, 4.5, 4); ell(g, 52, 56, 4, 3.6);
    col(g, '#f6e0d0'); ell(g, 81, 64, 3.4, 2.6);
    col(g, SKIN_D); ell(g, 44, 78, 14, 8);
  },
  hoed: g => {
    col(g, '#5e4b6b'); g.beginPath(); g.ellipse(50, 66, 42, 12, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(30, 66); g.quadraticCurveTo(28, 28, 50, 26);
    g.quadraticCurveTo(72, 28, 70, 66); g.closePath(); g.fill();
    col(g, '#3f7fbf'); box(g, 29, 54, 42, 12, 2);
    col(g, 'rgba(255,255,255,0.2)'); ell(g, 40, 40, 6, 12, 0.2);
  },
  poes: g => {
    col(g, '#cdbfae'); circle(g, 50, 54, 30);
    poly(g, [[24, 36], [26, 10], [46, 30]]); poly(g, [[76, 36], [74, 10], [54, 30]]);
    col(g, '#e0a898'); poly(g, [[30, 32], [31, 16], [43, 30]]); poly(g, [[70, 32], [69, 16], [57, 30]]);
    col(g, '#2a2118'); ell(g, 38, 50, 6, 8); ell(g, 62, 50, 6, 8);
    col(g, '#7fc0a8'); ell(g, 38, 50, 4.4, 6.4); ell(g, 62, 50, 4.4, 6.4);
    col(g, '#2a2118'); ell(g, 38, 50, 1.6, 6); ell(g, 62, 50, 1.6, 6);
    col(g, '#e08a8a'); poly(g, [[45, 62], [55, 62], [50, 68]]);
    col(g, '#2a2118'); curve(g, 50, 68, 44, 74, 38, 70, 2, '#2a2118');
    curve(g, 50, 68, 56, 74, 62, 70, 2, '#2a2118');
    stroke(g, [[24, 58], [6, 54]], 1.6, '#8d7461'); stroke(g, [[24, 64], [6, 68]], 1.6, '#8d7461');
    stroke(g, [[76, 58], [94, 54]], 1.6, '#8d7461'); stroke(g, [[76, 64], [94, 68]], 1.6, '#8d7461');
  },
  deur: g => {
    col(g, '#8a5a28'); box(g, 18, 10, 64, 84, 4);
    col(g, WOOD); box(g, 23, 15, 54, 74, 3);
    col(g, '#9a6630'); box(g, 29, 22, 42, 26, 2); box(g, 29, 56, 42, 26, 2);
    col(g, '#f0b429'); circle(g, 69, 54, 4);
    col(g, 'rgba(255,255,255,0.15)'); box(g, 23, 15, 8, 74, 3);
  },
  neus: g => {
    col(g, SKIN);
    g.beginPath(); g.moveTo(18, 6); g.quadraticCurveTo(24, 34, 30, 48);
    g.quadraticCurveTo(24, 58, 32, 62); g.quadraticCurveTo(20, 74, 34, 80);
    g.quadraticCurveTo(50, 90, 74, 88); g.lineTo(74, 6); g.closePath(); g.fill();
    col(g, SKIN_D);
    g.beginPath(); g.moveTo(30, 48); g.quadraticCurveTo(22, 58, 32, 62);
    g.quadraticCurveTo(46, 66, 52, 58); g.quadraticCurveTo(44, 52, 30, 48); g.fill();
    col(g, '#b3603f'); ell(g, 40, 60, 5, 3.4, -0.2);
    col(g, SKIN_D); curve(g, 34, 76, 46, 80, 58, 76, 2.4, '#c98a6a');
    eye(g, 58, 34, 6);
    col(g, '#5c4632'); stroke(g, [[50, 22], [68, 24]], 3.4, '#5c4632');
    col(g, '#8a4424'); g.beginPath(); g.moveTo(74, 4); g.quadraticCurveTo(58, 8, 52, 20);
    g.quadraticCurveTo(62, 14, 74, 16); g.closePath(); g.fill();
  },
  reus: g => {
    col(g, '#4a8f6d'); box(g, 26, 34, 48, 40, 10);
    box(g, 30, 70, 16, 26, 6); box(g, 54, 70, 16, 26, 6);
    box(g, 14, 36, 14, 10, 5); box(g, 72, 36, 14, 10, 5);
    col(g, SKIN); circle(g, 50, 20, 15);
    col(g, '#8a4424'); g.beginPath(); g.arc(50, 18, 16, Math.PI, TAU); g.fill();
    eye(g, 44, 21, 3.2); eye(g, 56, 21, 3.2);
    col(g, '#3f7fbf'); box(g, 4, 76, 10, 20, 4);
    col(g, SKIN); circle(g, 9, 68, 6);
  },
  leeuw: g => {
    col(g, '#c9743f'); circle(g, 50, 52, 34);
    col(g, '#a0522d');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      circle(g, 50 + Math.cos(a) * 32, 52 + Math.sin(a) * 32, 9);
    }
    col(g, '#f0a04b'); circle(g, 50, 52, 24);
    col(g, '#c9743f'); circle(g, 34, 34, 7); circle(g, 66, 34, 7);
    eye(g, 42, 48, 4); eye(g, 58, 48, 4);
    col(g, '#8a4424'); poly(g, [[44, 58], [56, 58], [50, 64]]);
    curve(g, 50, 64, 44, 70, 38, 66, 2, '#8a4424'); curve(g, 50, 64, 56, 70, 62, 66, 2, '#8a4424');
  },
  meeuw: g => {
    col(g, SKY); box(g, 0, 0, 100, 100, 0);
    col(g, '#fdfaf2'); ell(g, 52, 56, 24, 16, -0.1);
    circle(g, 72, 42, 12);
    col(g, '#cfd8dd'); poly(g, [[30, 52], [4, 40], [16, 58]]);
    g.beginPath(); g.moveTo(44, 46); g.quadraticCurveTo(30, 18, 8, 16);
    g.quadraticCurveTo(28, 30, 40, 52); g.fill();
    col(g, '#f0b429'); poly(g, [[82, 42], [96, 46], [82, 50]]);
    eye(g, 76, 39, 3.4);
  },
  fiets: g => {
    col(g, '#3b3b3b'); ring(g, 26, 62, 20, 4, '#3b3b3b'); ring(g, 74, 62, 20, 4, '#3b3b3b');
    col(g, '#9aa7ae'); ring(g, 26, 62, 20, 1.2, '#cfd8dd'); ring(g, 74, 62, 20, 1.2, '#cfd8dd');
    stroke(g, [[26, 62], [46, 62], [58, 34], [74, 62]], 4, '#e0594a');
    stroke(g, [[46, 62], [58, 34]], 4, '#e0594a'); stroke(g, [[26, 62], [40, 34], [58, 34]], 4, '#e0594a');
    stroke(g, [[34, 30], [46, 30]], 3.4, '#3b3b3b');
    col(g, '#2a2118'); box(g, 54, 28, 14, 6, 3);
    col(g, '#3b3b3b'); circle(g, 46, 62, 4);
  },
  wiel: g => {
    col(g, '#3b3b3b'); circle(g, 50, 52, 36);
    col(g, '#5c5c5c'); circle(g, 50, 52, 30);
    col(g, '#cfd8dd'); circle(g, 50, 52, 22);
    col(g, '#9aa7ae');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      stroke(g, [[50, 52], [50 + Math.cos(a) * 21, 52 + Math.sin(a) * 21]], 3.4, '#9aa7ae');
    }
    col(g, '#6e7d86'); circle(g, 50, 52, 7);
    col(g, 'rgba(255,255,255,0.18)'); ell(g, 36, 32, 9, 5, -0.6);
  },
  riem: g => {
    col(g, '#8a5a28'); box(g, 4, 40, 92, 22, 4);
    col(g, WOOD); box(g, 4, 44, 92, 8, 3);
    col(g, '#cfd8dd'); box(g, 38, 32, 26, 38, 5);
    col(g, '#f6efdc'); box(g, 44, 38, 14, 26, 3);
    col(g, '#9aa7ae'); box(g, 50, 44, 22, 5, 2);
    col(g, '#6f4a20'); circle(g, 78, 51, 2.6); circle(g, 88, 51, 2.6);
  },
  dier: g => {
    col(g, '#a3805c'); ell(g, 46, 56, 26, 20);
    box(g, 30, 68, 9, 24, 4); box(g, 56, 68, 9, 24, 4);
    circle(g, 72, 40, 14);
    col(g, '#8a6846'); poly(g, [[64, 28], [60, 10], [72, 24]]); poly(g, [[80, 28], [86, 10], [76, 24]]);
    col(g, '#c9a97f'); ell(g, 74, 48, 9, 7);
    col(g, '#2a2118'); circle(g, 78, 46, 2.6);
    eye(g, 68, 36, 3.4);
    curve(g, 22, 50, 8, 44, 12, 30, 4, '#a3805c');
    col(g, '#f6efdc'); circle(g, 36, 50, 4); circle(g, 52, 46, 3.4);
  },
};
Object.assign(PICTURES, DUO);

// ------------------------------------------------ ei and ij, the pair that sound the same
const EIIJ: Record<string, (g: Ctx) => void> = {
  ei: g => {
    col(g, '#3f7fbf'); g.beginPath(); g.moveTo(28, 60); g.lineTo(72, 60);
    g.quadraticCurveTo(68, 88, 50, 88); g.quadraticCurveTo(32, 88, 28, 60); g.closePath(); g.fill();
    col(g, '#2b5f94'); ell(g, 50, 60, 22, 6);
    col(g, '#fdfaf2'); ell(g, 50, 42, 21, 26);
    col(g, '#efe7d4'); ell(g, 60, 52, 7, 9, 0.3);
    col(g, 'rgba(255,255,255,0.6)'); ell(g, 42, 32, 6, 8, -0.4);
  },
  trein: g => {
    col(g, '#3b3b3b'); box(g, 6, 80, 90, 6, 3);
    col(g, '#e0594a'); box(g, 44, 34, 48, 40, 6);
    col(g, '#c34434'); box(g, 10, 44, 34, 30, 6);
    col(g, '#2b2b2b'); box(g, 16, 26, 14, 20, 3);
    col(g, '#cdeaf7'); box(g, 52, 42, 16, 14, 3); box(g, 74, 42, 12, 14, 3);
    col(g, '#3b3b3b'); circle(g, 30, 78, 9); circle(g, 58, 78, 9); circle(g, 82, 78, 9);
    col(g, '#b9c2c7'); circle(g, 30, 78, 3.4); circle(g, 58, 78, 3.4); circle(g, 82, 78, 3.4);
    col(g, 'rgba(255,255,255,0.7)'); circle(g, 22, 18, 7); circle(g, 32, 10, 5);
  },
  eiland: g => {
    col(g, '#4f9dc4'); box(g, 0, 0, 100, 100);
    col(g, '#7fc0e0');
    for (let i = 0; i < 4; i++) curve(g, 4 + i * 6, 20 + i * 22, 26 + i * 6, 14 + i * 22, 48 + i * 6, 20 + i * 22, 2.4, 'rgba(210,240,255,0.6)');
    col(g, '#f2dfae'); ell(g, 50, 72, 40, 18);
    col(g, '#e6cf96'); ell(g, 50, 76, 34, 12);
    col(g, WOOD_D); stroke(g, [[50, 70], [46, 40]], 5, WOOD_D);
    col(g, LEAF);
    for (const a of [-2.6, -2.0, -1.2, -0.5]) {
      g.beginPath(); g.moveTo(46, 40);
      g.quadraticCurveTo(46 + Math.cos(a) * 24, 40 + Math.sin(a) * 18, 46 + Math.cos(a) * 34, 44 + Math.sin(a) * 12);
      g.quadraticCurveTo(46 + Math.cos(a) * 20, 40 + Math.sin(a) * 6, 46, 40);
      g.closePath(); g.fill();
    }
    col(g, '#8a5a28'); circle(g, 42, 44, 3.4); circle(g, 50, 46, 3);
  },
  geit: g => {
    col(g, '#d9cfb8'); ell(g, 44, 58, 27, 21);
    col(g, '#f6efdc'); ell(g, 43, 56, 24, 18);
    col(g, '#cdbfae'); box(g, 28, 70, 9, 22, 4); box(g, 54, 70, 9, 22, 4);
    col(g, '#e8dfc8'); circle(g, 72, 42, 16);
    col(g, '#b3a292'); g.beginPath(); g.moveTo(66, 30); g.quadraticCurveTo(56, 8, 70, 14);
    g.quadraticCurveTo(72, 22, 72, 30); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(80, 30); g.quadraticCurveTo(92, 8, 92, 20);
    g.quadraticCurveTo(86, 26, 82, 32); g.closePath(); g.fill();
    ell(g, 58, 44, 9, 5, -0.3);
    col(g, '#fdfaf2'); poly(g, [[72, 54], [67, 72], [80, 66]]);
    eye(g, 78, 40, 3.6);
    col(g, '#2a2118'); circle(g, 84, 48, 2.2);
    col(g, '#d9cfb8'); curve(g, 18, 52, 6, 46, 10, 34, 4.5, '#cdbfae');
  },
  zeil: g => {
    col(g, WATER); box(g, 0, 70, 100, 30, 0);
    col(g, '#b3793c'); box(g, 46, 12, 5, 62, 2);
    col(g, '#fdfaf2'); poly(g, [[52, 14], [88, 66], [52, 66]]);
    col(g, '#e6dcc6'); poly(g, [[44, 20], [16, 66], [44, 66]]);
    col(g, '#e0594a'); poly(g, [[52, 14], [72, 42], [52, 42]]);
    col(g, '#8a5a28'); poly(g, [[18, 66], [84, 66], [74, 80], [28, 80]]);
    col(g, WATER_D); curve(g, 4, 86, 22, 92, 40, 86, 3, WATER_D); curve(g, 58, 90, 76, 84, 94, 90, 3, WATER_D);
  },
  eik: g => {
    col(g, '#cfe3b4'); box(g, 0, 82, 100, 18, 0);
    col(g, WOOD_D); box(g, 44, 46, 12, 40, 3);
    stroke(g, [[50, 60], [34, 48]], 5, WOOD_D); stroke(g, [[50, 56], [66, 44]], 5, WOOD_D);
    col(g, '#3f8f4a'); circle(g, 50, 34, 24); circle(g, 28, 44, 15); circle(g, 72, 44, 15);
    col(g, LEAF); circle(g, 44, 28, 12); circle(g, 62, 32, 10);
    col(g, '#b98a54'); ell(g, 76, 66, 6, 8); col(g, '#8a5a28'); ell(g, 76, 60, 6.5, 4);
  },
  reis: g => {
    col(g, '#a0522d'); box(g, 14, 34, 72, 50, 6);
    col(g, '#8a4424'); box(g, 14, 52, 72, 8, 0);
    col(g, '#6f4a20'); box(g, 38, 24, 24, 12, 4);
    col(g, '#a0522d'); box(g, 42, 28, 16, 8, 3);
    col(g, '#e8c46a'); box(g, 44, 50, 12, 12, 3);
    col(g, '#f6efdc'); box(g, 22, 40, 14, 10, 2); box(g, 62, 64, 16, 10, 2);
    col(g, '#e0594a'); box(g, 24, 66, 14, 10, 2);
  },
  plein: g => {
    col(g, '#cfd8dd'); box(g, 0, 40, 100, 60, 0);
    col(g, '#b9c2c7');
    for (let i = 0; i < 6; i++) stroke(g, [[i * 20 - 10, 100], [i * 20 + 6, 40]], 1.6, '#b9c2c7');
    for (let i = 0; i < 4; i++) stroke(g, [[0, 46 + i * 15], [100, 46 + i * 15]], 1.6, '#b9c2c7');
    col(g, SKY); box(g, 0, 0, 100, 40, 0);
    col(g, '#e8dfc8'); box(g, 6, 12, 24, 30, 2); box(g, 70, 8, 26, 34, 2);
    col(g, '#9fd8f2'); box(g, 10, 18, 7, 8, 1); box(g, 20, 18, 7, 8, 1); box(g, 76, 14, 7, 8, 1); box(g, 86, 14, 7, 8, 1);
    col(g, '#4f9dc4'); ell(g, 50, 74, 22, 9);
    col(g, '#7fc0e0'); ell(g, 50, 72, 16, 6);
    col(g, '#cfd8dd'); box(g, 47, 54, 6, 18, 3);
    col(g, '#9fd8f2'); circle(g, 50, 50, 6);
  },
  dweil: g => {
    col(g, WOOD_D); box(g, 46, 6, 8, 46, 4);
    col(g, '#f0b429'); box(g, 34, 48, 32, 10, 4);
    col(g, '#cfd8dd');
    for (let i = 0; i < 9; i++) {
      stroke(g, [[36 + i * 3.6, 56], [30 + i * 5.2, 86]], 4, i % 2 ? '#dfe7ec' : '#c3cdd3');
    }
    col(g, '#4f9dc4'); ell(g, 50, 88, 40, 8);
  },
  sein: g => {
    col(g, '#cfe3b4'); box(g, 0, 86, 100, 14, 0);
    col(g, GREY_D); box(g, 44, 30, 10, 58, 3);
    col(g, '#3b3b3b'); box(g, 32, 8, 34, 52, 8);
    col(g, '#e0594a'); circle(g, 49, 22, 10);
    col(g, '#5c5c5c'); circle(g, 49, 46, 10);
    col(g, 'rgba(255,255,255,0.4)'); circle(g, 46, 19, 3.4);
    col(g, GREY); box(g, 34, 84, 32, 8, 3);
  },
  ijs: g => {
    col(g, '#d9a96a'); poly(g, [[32, 48], [68, 48], [50, 94]]);
    col(g, '#c2914f');
    for (let i = 0; i < 3; i++) stroke(g, [[34 + i * 7, 52 + i * 2], [58 - i * 4, 76 + i * 6]], 1.6, '#a87a3f');
    col(g, '#f6a8c0'); circle(g, 38, 40, 15);
    col(g, '#fdfaf2'); circle(g, 62, 40, 15);
    col(g, '#a8d8a8'); circle(g, 50, 22, 16);
    col(g, '#e0594a'); circle(g, 50, 8, 5);
    col(g, 'rgba(255,255,255,0.35)'); circle(g, 44, 18, 4);
  },
  rijst: g => {
    col(g, '#4f9dc4'); g.beginPath(); g.moveTo(14, 50); g.lineTo(86, 50);
    g.quadraticCurveTo(80, 88, 50, 88); g.quadraticCurveTo(20, 88, 14, 50); g.closePath(); g.fill();
    col(g, '#3d85aa'); ell(g, 50, 50, 36, 8);
    col(g, '#fdfaf2'); g.beginPath(); g.moveTo(18, 50); g.quadraticCurveTo(50, 22, 82, 50); g.closePath(); g.fill();
    ell(g, 50, 50, 32, 7);
    col(g, '#e6dcc6');
    for (const [x, y] of [[34, 40], [46, 34], [60, 38], [68, 44], [40, 46], [56, 46]]) ell(g, x, y, 5, 3, 0.4);
    col(g, WOOD); stroke(g, [[66, 16], [88, 34]], 3, WOOD); stroke(g, [[74, 12], [92, 32]], 3, WOOD);
  },
  vijf: g => {
    col(g, SKIN); box(g, 28, 42, 44, 46, 12);
    for (let i = 0; i < 4; i++) box(g, 28 + i * 11, 14 + (i === 0 || i === 3 ? 8 : 0), 10, 36, 5);
    col(g, SKIN_D); box(g, 16, 50, 16, 22, 8);
    col(g, SKIN); box(g, 14, 46, 16, 22, 8);
    col(g, SKIN_D); stroke(g, [[34, 74], [66, 74]], 2, SKIN_D);
  },
  bij: g => {
    col(g, 'rgba(255,255,255,0.75)'); ell(g, 38, 30, 18, 11, -0.5); ell(g, 62, 30, 18, 11, 0.5);
    col(g, '#f6c445'); ell(g, 50, 56, 28, 22);
    col(g, '#2a2118');
    g.save(); g.beginPath(); g.ellipse(50, 56, 28, 22, 0, 0, TAU); g.clip();
    box(g, 40, 32, 9, 50, 0); box(g, 58, 32, 9, 50, 0); g.restore();
    col(g, '#2a2118'); circle(g, 26, 50, 11);
    poly(g, [[76, 58], [92, 62], [76, 66]]);
    col(g, '#ffffff'); circle(g, 22, 47, 4); col(g, '#2a2118'); circle(g, 23, 47, 2);
    stroke(g, [[22, 40], [16, 30]], 1.6, '#2a2118'); stroke(g, [[28, 40], [30, 28]], 1.6, '#2a2118');
  },
  zwijn: g => {
    col(g, '#6e5d4e'); ell(g, 46, 58, 28, 22);
    box(g, 30, 72, 9, 20, 4); box(g, 58, 72, 9, 20, 4);
    circle(g, 74, 48, 16);
    col(g, '#5c4c3e'); poly(g, [[66, 36], [62, 22], [76, 32]]); poly(g, [[84, 36], [88, 22], [78, 32]]);
    col(g, '#8a7767'); ell(g, 88, 54, 9, 7);
    col(g, '#5c4c3e'); circle(g, 86, 54, 2); circle(g, 91, 54, 2);
    col(g, '#f6efdc'); poly(g, [[80, 60], [84, 68], [86, 58]]);
    eye(g, 70, 44, 3.2);
    col(g, '#4a3c30'); curve(g, 20, 52, 8, 46, 14, 36, 3.4, '#4a3c30');
  },
  dijk: g => {
    col(g, SKY); box(g, 0, 0, 100, 46, 0);
    col(g, WATER); box(g, 0, 40, 100, 34, 0);
    col(g, '#79c05e'); g.beginPath(); g.moveTo(0, 82); g.lineTo(26, 56);
    g.lineTo(76, 56); g.lineTo(100, 82); g.lineTo(100, 100); g.lineTo(0, 100); g.closePath(); g.fill();
    col(g, '#5fa648'); box(g, 26, 56, 50, 6, 2);
    col(g, WATER_D); curve(g, 4, 50, 18, 46, 32, 50, 2.4, WATER_D); curve(g, 60, 48, 74, 44, 90, 48, 2.4, WATER_D);
    col(g, '#e8dfc8'); box(g, 58, 40, 5, 18, 2);
    col(g, '#fdfaf2'); poly(g, [[60, 40], [76, 30], [60, 26]]);
  },
  pijl: g => {
    col(g, '#b3793c'); box(g, 10, 46, 66, 8, 3);
    col(g, GREY_D); poly(g, [[66, 34], [94, 50], [66, 66]]);
    col(g, GREY); poly(g, [[66, 34], [94, 50], [66, 50]]);
    col(g, '#e0594a'); poly(g, [[10, 42], [26, 50], [10, 58], [4, 50]]);
    poly(g, [[20, 40], [34, 48], [20, 56], [16, 50]]);
  },
  lijm: g => {
    col(g, '#f0b429'); g.beginPath(); g.moveTo(32, 34); g.lineTo(68, 34);
    g.lineTo(72, 86); g.lineTo(28, 86); g.closePath(); g.fill();
    col(g, '#fdfaf2'); box(g, 34, 48, 32, 24, 3);
    col(g, '#e0594a'); poly(g, [[42, 34], [58, 34], [56, 16], [44, 16]]);
    col(g, '#c34434'); box(g, 44, 8, 12, 10, 3);
    col(g, '#cdeaf7'); ell(g, 50, 96, 8, 4);
  },
  prijs: g => {
    col(g, '#3f7fbf'); poly(g, [[36, 58], [30, 94], [50, 84], [70, 94], [64, 58]]);
    col(g, '#f6c445'); circle(g, 50, 44, 28);
    col(g, '#e8a90e'); circle(g, 50, 44, 21);
    col(g, '#f8dc86');
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 === 0 ? 14 : 6;
      const x = 50 + Math.cos(a) * r, y = 44 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    col(g, 'rgba(255,255,255,0.35)'); ell(g, 38, 32, 8, 5, -0.5);
  },
  krijt: g => {
    col(g, '#3b5c48'); box(g, 4, 10, 92, 60, 4);
    col(g, '#b3793c'); box(g, 0, 66, 100, 10, 3);
    col(g, '#fdfaf2'); stroke(g, [[18, 30], [30, 46], [42, 22]], 3.4, '#fdfaf2');
    stroke(g, [[52, 24], [52, 46]], 3.4, '#fdfaf2'); stroke(g, [[52, 24], [66, 24]], 3.4, '#fdfaf2');
    col(g, '#f6a8c0'); box(g, 60, 62, 26, 8, 3);
    col(g, '#fdfaf2'); box(g, 16, 62, 22, 8, 3);
  },
};
Object.assign(PICTURES, EIIJ);

// ------------------------------------------------ au and ou, the other pair
const AUOU: Record<string, (g: Ctx) => void> = {
  blauw: g => {
    col(g, '#3f7fbf'); circle(g, 46, 54, 30);
    circle(g, 70, 40, 14); circle(g, 26, 76, 12);
    col(g, '#2b5f94'); ell(g, 46, 74, 22, 8);
    col(g, '#b3793c'); stroke(g, [[60, 24], [92, 6]], 6, '#b3793c');
    col(g, '#cfd8dd'); stroke(g, [[56, 28], [66, 22]], 8, '#cfd8dd');
    col(g, '#5c9fd6'); ell(g, 36, 40, 10, 6, -0.5);
  },
  pauw: g => {
    col(g, '#2f8fa0');
    for (let i = -4; i <= 4; i++) {
      const a = -Math.PI / 2 + i * 0.28;
      const x = 50 + Math.cos(a) * 40, y = 62 + Math.sin(a) * 40;
      col(g, i % 2 ? '#2f8fa0' : '#3fa8b8'); ell(g, x, y, 9, 13, a + Math.PI / 2);
      col(g, '#2b5f94'); circle(g, x, y, 4.5);
      col(g, '#f6c445'); circle(g, x, y, 2);
    }
    col(g, '#2b5f94'); ell(g, 50, 66, 14, 18);
    circle(g, 50, 42, 10);
    col(g, '#3fa8b8'); stroke(g, [[46, 32], [44, 24]], 2, '#3fa8b8'); stroke(g, [[50, 31], [50, 22]], 2, '#3fa8b8');
    stroke(g, [[54, 32], [56, 24]], 2, '#3fa8b8');
    col(g, '#f0b429'); poly(g, [[58, 42], [68, 45], [58, 48]]);
    eye(g, 53, 39, 3);
  },
  saus: g => {
    col(g, '#e0594a'); g.beginPath(); g.moveTo(32, 30); g.lineTo(68, 30);
    g.quadraticCurveTo(74, 60, 72, 88); g.lineTo(28, 88); g.quadraticCurveTo(26, 60, 32, 30); g.fill();
    col(g, '#fdf6e8'); box(g, 32, 48, 36, 24, 3);
    col(g, '#c34434'); poly(g, [[42, 30], [58, 30], [56, 14], [44, 14]]);
    col(g, '#8a2f24'); box(g, 42, 6, 16, 10, 3);
    col(g, '#e0594a'); ell(g, 74, 92, 10, 4);
  },
  klauw: g => {
    col(g, '#d9a96a'); box(g, 44, 8, 14, 34, 6);
    g.beginPath(); g.moveTo(50, 36); g.quadraticCurveTo(22, 46, 12, 70);
    g.quadraticCurveTo(24, 66, 34, 56); g.quadraticCurveTo(40, 50, 50, 48); g.fill();
    g.beginPath(); g.moveTo(50, 36); g.quadraticCurveTo(78, 46, 88, 70);
    g.quadraticCurveTo(76, 66, 66, 56); g.quadraticCurveTo(60, 50, 50, 48); g.fill();
    g.beginPath(); g.moveTo(50, 40); g.quadraticCurveTo(48, 68, 50, 88);
    g.quadraticCurveTo(58, 68, 56, 40); g.fill();
    col(g, '#2a2118');
    poly(g, [[12, 70], [4, 84], [18, 74]]); poly(g, [[88, 70], [96, 84], [82, 74]]);
    poly(g, [[50, 88], [46, 98], [56, 92]]);
    col(g, '#c2914f'); box(g, 44, 8, 14, 8, 4);
  },
  dauw: g => {
    col(g, LEAF_D); stroke(g, [[4, 88], [26, 74]], 4, LEAF_D);
    col(g, LEAF);
    g.beginPath(); g.moveTo(22, 78); g.quadraticCurveTo(38, 22, 92, 16);
    g.quadraticCurveTo(80, 70, 22, 78); g.fill();
    col(g, '#3f8f4a'); stroke(g, [[22, 78], [90, 18]], 3, '#3f8f4a');
    for (let i = 1; i < 5; i++) {
      stroke(g, [[24 + i * 13, 74 - i * 11], [30 + i * 13, 60 - i * 11]], 2, 'rgba(45,110,52,0.55)');
    }
    for (const [x, y, r] of [[44, 52, 10], [66, 38, 8], [34, 66, 6]]) {
      col(g, 'rgba(255,255,255,0.9)');
      g.beginPath(); g.moveTo(x, y - r * 1.5); g.quadraticCurveTo(x + r, y - r * 0.2, x + r * 0.72, y + r * 0.4);
      g.bezierCurveTo(x + r * 0.72, y + r * 1.3, x - r * 0.72, y + r * 1.3, x - r * 0.72, y + r * 0.4);
      g.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.5); g.fill();
      col(g, 'rgba(160, 210, 235, 0.8)'); circle(g, x + r * 0.2, y + r * 0.5, r * 0.3);
      col(g, '#ffffff'); circle(g, x - r * 0.25, y + r * 0.1, r * 0.22);
    }
  },
  augurk: g => {
    col(g, '#5f9e3f'); g.beginPath(); g.moveTo(22, 82); g.quadraticCurveTo(10, 60, 30, 34);
    g.quadraticCurveTo(52, 8, 74, 16); g.quadraticCurveTo(88, 24, 74, 46);
    g.quadraticCurveTo(58, 72, 40, 86); g.quadraticCurveTo(28, 92, 22, 82); g.fill();
    col(g, '#4a8730');
    for (const [x, y] of [[34, 62], [44, 48], [56, 36], [66, 28], [48, 68], [60, 52]]) ell(g, x, y, 3.4, 2.4, -0.7);
    col(g, '#7ab85a'); curve(g, 28, 74, 44, 50, 70, 24, 4, '#7ab85a');
    col(g, '#4a8730'); box(g, 70, 10, 10, 8, 3);
  },
  koud: g => {
    col(g, '#cfe8f6'); box(g, 0, 0, 100, 100, 0);
    col(g, '#8fd0ee');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      stroke(g, [[50, 50], [50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40]], 6, '#7fc0e0');
      const bx = 50 + Math.cos(a) * 24, by = 50 + Math.sin(a) * 24;
      stroke(g, [[bx, by], [bx + Math.cos(a + 1) * 14, by + Math.sin(a + 1) * 14]], 4, '#7fc0e0');
      stroke(g, [[bx, by], [bx + Math.cos(a - 1) * 14, by + Math.sin(a - 1) * 14]], 4, '#7fc0e0');
    }
    col(g, '#ffffff'); circle(g, 50, 50, 8);
    col(g, '#b3e0f2'); circle(g, 50, 50, 4);
  },
  hout: g => {
    col(g, '#cfe3b4'); box(g, 0, 78, 100, 22, 0);
    col(g, WOOD); box(g, 10, 52, 80, 22, 11);
    col(g, WOOD_D); ell(g, 90, 63, 8, 11);
    col(g, '#d9a96a'); ell(g, 90, 63, 5, 7);
    col(g, WOOD); box(g, 22, 28, 56, 20, 10);
    col(g, WOOD_D); ell(g, 78, 38, 7, 10);
    col(g, '#d9a96a'); ell(g, 78, 38, 4, 6);
    col(g, 'rgba(0,0,0,0.12)'); box(g, 10, 68, 80, 6, 3);
  },
  goud: g => {
    col(g, '#e8a90e'); box(g, 14, 62, 72, 24, 4);
    col(g, '#f6c445'); poly(g, [[14, 62], [24, 52], [78, 52], [86, 62]]);
    col(g, '#d99416'); box(g, 14, 78, 72, 8, 3);
    col(g, '#e8a90e'); box(g, 26, 34, 48, 20, 4);
    col(g, '#f6c445'); poly(g, [[26, 34], [34, 26], [68, 26], [74, 34]]);
    col(g, 'rgba(255,255,255,0.4)'); box(g, 32, 30, 14, 4, 2); box(g, 22, 56, 16, 4, 2);
  },
  zout: g => {
    col(g, '#fdfaf2'); g.beginPath(); g.moveTo(32, 40); g.quadraticCurveTo(28, 76, 30, 88);
    g.lineTo(70, 88); g.quadraticCurveTo(72, 76, 68, 40); g.closePath(); g.fill();
    col(g, '#cfd8dd'); g.beginPath(); g.moveTo(32, 40); g.quadraticCurveTo(50, 22, 68, 40); g.closePath(); g.fill();
    col(g, '#9aa7ae'); circle(g, 44, 34, 2); circle(g, 56, 34, 2); circle(g, 50, 30, 2);
    col(g, '#e6dcc6'); box(g, 30, 58, 40, 10, 2);
    col(g, '#ffffff');
    for (const [x, y] of [[38, 14], [52, 10], [62, 18], [46, 20]]) circle(g, x, y, 2.4);
  },
  fout: g => {
    col(g, '#fdf6e8'); box(g, 10, 10, 80, 80, 12);
    col(g, '#e0594a');
    stroke(g, [[32, 32], [68, 68]], 11, '#e0594a'); stroke(g, [[68, 32], [32, 68]], 11, '#e0594a');
    col(g, 'rgba(0,0,0,0.06)'); box(g, 10, 80, 80, 10, 10);
  },
  touw: g => {
    col(g, '#d9a96a');
    for (let i = 0; i < 3; i++) ring(g, 50, 54, 30 - i * 9, 7, i % 2 ? '#c2914f' : '#d9a96a');
    col(g, '#b98a54');
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      stroke(g, [[50 + Math.cos(a) * 27, 54 + Math.sin(a) * 27], [50 + Math.cos(a + 0.15) * 33, 54 + Math.sin(a + 0.15) * 33]], 2, 'rgba(150,110,60,0.5)');
    }
    col(g, '#d9a96a'); stroke(g, [[74, 34], [94, 14]], 7, '#d9a96a');
  },
  kous: g => {
    col(g, '#a86fb8'); g.beginPath(); g.moveTo(36, 8); g.lineTo(64, 8); g.lineTo(62, 58);
    g.quadraticCurveTo(62, 72, 44, 76); g.lineTo(22, 78); g.quadraticCurveTo(12, 74, 14, 62);
    g.quadraticCurveTo(20, 52, 36, 54); g.closePath(); g.fill();
    col(g, '#8f57a0'); box(g, 36, 8, 28, 10, 0);
    col(g, 'rgba(255,255,255,0.3)'); box(g, 36, 26, 28, 5, 2); box(g, 36, 38, 28, 5, 2);
  },
  mouw: g => {
    col(g, '#4f9dc4'); poly(g, [[30, 14], [56, 14], [58, 40], [30, 44]]);
    g.beginPath(); g.moveTo(56, 16); g.quadraticCurveTo(84, 26, 86, 60);
    g.lineTo(64, 66); g.quadraticCurveTo(60, 40, 52, 34); g.closePath(); g.fill();
    col(g, '#3d85aa'); box(g, 62, 58, 26, 10, 3);
    col(g, SKIN); circle(g, 78, 76, 12);
    col(g, '#3d85aa'); poly(g, [[30, 44], [58, 40], [58, 50], [30, 54]]);
  },
};
Object.assign(PICTURES, AUOU);

// ------------------------------------------------ consonants stacked up: sch-, str-, -ngst
const CLUSTER: Record<string, (g: Ctx) => void> = {
  schaap: g => {
    // the fleece is white, and a white shape on a light card is no shape at all, so it is laid
    // over a slightly darker one of itself
    col(g, '#ddd7c6');
    ell(g, 48, 57, 32, 26);
    circle(g, 25, 44, 13); circle(g, 33, 67, 13); circle(g, 67, 38, 13); circle(g, 71, 67, 13);
    circle(g, 48, 33, 15);
    col(g, '#fdfaf2'); ell(g, 48, 56, 30, 24);
    circle(g, 26, 44, 12); circle(g, 34, 66, 12); circle(g, 66, 38, 12); circle(g, 70, 66, 12);
    circle(g, 48, 34, 14);
    col(g, '#6e5d4e'); box(g, 34, 74, 8, 20, 4); box(g, 58, 74, 8, 20, 4);
    circle(g, 74, 48, 13);
    col(g, '#5c4c3e'); ell(g, 62, 44, 7, 5, -0.4); ell(g, 86, 44, 7, 5, 0.4);
    col(g, '#ffffff'); circle(g, 71, 45, 3.4); circle(g, 79, 45, 3.4);
    col(g, '#2a2118'); circle(g, 72, 45, 1.8); circle(g, 80, 45, 1.8);
    col(g, '#4a3c30'); circle(g, 76, 54, 2);
  },
  school: g => {
    col(g, '#e8dfc8'); box(g, 10, 36, 80, 56, 3);
    col(g, '#c05a44'); poly(g, [[4, 38], [50, 12], [96, 38]]);
    col(g, '#f6c445'); circle(g, 50, 26, 7);
    col(g, '#8a5a28'); box(g, 42, 64, 18, 28, 2);
    col(g, '#9fd8f2'); box(g, 18, 46, 16, 14, 2); box(g, 66, 46, 16, 14, 2);
    col(g, WOOD_D); box(g, 18, 70, 16, 14, 2); box(g, 66, 70, 16, 14, 2);
    col(g, '#f0b429'); circle(g, 56, 78, 2);
  },
  schip: g => {
    col(g, WATER); box(g, 0, 70, 100, 30, 0);
    col(g, '#3b3b3b'); g.beginPath(); g.moveTo(10, 64); g.lineTo(92, 64);
    g.quadraticCurveTo(84, 86, 50, 86); g.quadraticCurveTo(20, 86, 10, 64); g.closePath(); g.fill();
    col(g, '#e0594a'); box(g, 10, 64, 82, 8, 2);
    col(g, '#fdfaf2'); box(g, 30, 42, 42, 22, 3);
    col(g, '#cdeaf7'); box(g, 36, 48, 10, 10, 2); box(g, 52, 48, 10, 10, 2);
    col(g, '#f0b429'); box(g, 64, 22, 10, 22, 3);
    col(g, '#e0594a'); box(g, 64, 22, 10, 7, 2);
    col(g, WATER_D); curve(g, 4, 88, 22, 94, 40, 88, 3, WATER_D); curve(g, 60, 92, 76, 86, 96, 92, 3, WATER_D);
  },
  schoen: g => {
    col(g, '#8a4424'); g.beginPath(); g.moveTo(16, 46); g.lineTo(44, 46);
    g.quadraticCurveTo(48, 62, 74, 66); g.quadraticCurveTo(90, 70, 88, 82);
    g.lineTo(16, 82); g.closePath(); g.fill();
    col(g, '#6f3418'); box(g, 12, 80, 78, 10, 3);
    col(g, '#a0522d'); g.beginPath(); g.moveTo(16, 46); g.lineTo(40, 46);
    g.quadraticCurveTo(38, 58, 44, 64); g.lineTo(16, 64); g.closePath(); g.fill();
    col(g, '#f6efdc'); stroke(g, [[24, 52], [36, 58]], 2.4, '#f6efdc');
    stroke(g, [[24, 60], [36, 52]], 2.4, '#f6efdc');
    stroke(g, [[22, 46], [30, 40], [40, 46]], 2.4, '#f6efdc');
  },
  straat: g => {
    col(g, '#cfe3b4'); box(g, 0, 0, 100, 100, 0);
    col(g, GREY_D); poly(g, [[28, 100], [42, 30], [58, 30], [72, 100]]);
    col(g, '#fdfaf2');
    for (let i = 0; i < 4; i++) box(g, 48 - i * 0.6, 88 - i * 18, 5 + i * 0.4, 10 - i * 1.6, 1);
    col(g, '#e8dfc8'); box(g, 4, 34, 22, 26, 2); box(g, 76, 30, 20, 30, 2);
    col(g, '#c05a44'); poly(g, [[2, 36], [15, 24], [28, 36]]); poly(g, [[74, 32], [86, 20], [98, 32]]);
    col(g, '#9fd8f2'); box(g, 9, 42, 6, 7, 1); box(g, 17, 42, 6, 7, 1); box(g, 81, 38, 6, 7, 1);
    col(g, LEAF); circle(g, 88, 62, 9); col(g, WOOD_D); box(g, 86, 66, 4, 12, 1);
  },
  strand: g => {
    col(g, SKY); box(g, 0, 0, 100, 44, 0);
    col(g, WATER); box(g, 0, 36, 100, 22, 0);
    col(g, '#f2dfae'); box(g, 0, 54, 100, 46, 0);
    col(g, WATER_D); curve(g, 0, 44, 20, 40, 40, 44, 2.4, WATER_D); curve(g, 54, 48, 72, 42, 96, 48, 2.4, WATER_D);
    col(g, '#f6c445'); circle(g, 82, 14, 10);
    col(g, '#e0594a'); g.beginPath(); g.arc(34, 52, 26, Math.PI, TAU); g.fill();
    col(g, '#fdfaf2'); g.beginPath(); g.moveTo(8, 52); g.arc(34, 52, 26, Math.PI, Math.PI * 1.33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(34, 26); g.arc(34, 52, 26, Math.PI * 1.67, TAU); g.lineTo(34, 52); g.closePath(); g.fill();
    col(g, WOOD_D); box(g, 32, 50, 4, 34, 2);
    col(g, '#d9a96a'); ell(g, 74, 84, 16, 6);
  },
  stoel: g => {
    col(g, WOOD); box(g, 24, 14, 12, 58, 4); box(g, 64, 14, 12, 58, 4);
    box(g, 24, 20, 52, 9, 4); box(g, 24, 36, 52, 9, 4);
    col(g, '#c9743f'); box(g, 16, 52, 68, 12, 4);
    col(g, WOOD_D); box(g, 22, 62, 10, 32, 4); box(g, 68, 62, 10, 32, 4);
    col(g, 'rgba(255,255,255,0.18)'); box(g, 16, 52, 68, 4, 2);
  },
  ster: g => {
    col(g, '#1e3a5c'); box(g, 0, 0, 100, 100, 0);
    col(g, '#f6d55c');
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 === 0 ? 38 : 16;
      const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    col(g, '#fdf6c8'); circle(g, 44, 42, 8);
    col(g, '#fdf6c8'); circle(g, 14, 16, 2.4); circle(g, 88, 24, 2); circle(g, 80, 84, 2.6);
  },
  spin: g => {
    col(g, '#2a2118');
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 8;
        stroke(g, [[50, y], [50 + s * 24, y - 8 + i * 5], [50 + s * 40, y + 4 + i * 6]], 3.4, '#2a2118');
      }
    }
    col(g, '#3b3b3b'); ell(g, 50, 58, 20, 18);
    col(g, '#2a2118'); circle(g, 50, 36, 12);
    col(g, '#e0594a'); ell(g, 50, 60, 10, 9);
    col(g, '#ffffff'); circle(g, 45, 34, 4); circle(g, 55, 34, 4);
    col(g, '#2a2118'); circle(g, 45, 35, 2); circle(g, 55, 35, 2);
  },
  spons: g => {
    col(g, '#f6c445'); box(g, 12, 30, 76, 44, 10);
    col(g, '#e8a90e'); box(g, 12, 60, 76, 14, 8);
    col(g, '#d99416');
    for (const [x, y, r] of [[28, 44, 5], [46, 38, 4], [62, 48, 6], [76, 40, 4], [36, 56, 4], [58, 62, 5], [74, 62, 3.4]]) circle(g, x, y, r);
    col(g, 'rgba(255,255,255,0.7)'); circle(g, 22, 22, 6); circle(g, 34, 16, 4); circle(g, 14, 14, 3.4);
  },
  slang: g => {
    col(g, '#5f9e3f'); g.lineCap = 'round'; g.lineJoin = 'round';
    stroke(g, [[10, 82], [34, 72], [26, 54], [50, 44], [74, 52], [70, 30], [86, 22]], 14, '#5f9e3f');
    col(g, '#4a8730');
    for (const [x, y] of [[22, 76], [30, 62], [40, 48], [60, 46], [72, 42], [78, 26]]) circle(g, x, y, 3.4);
    col(g, '#5f9e3f'); circle(g, 88, 20, 9);
    col(g, '#e0594a'); stroke(g, [[94, 20], [100, 16]], 2, '#e0594a'); stroke(g, [[94, 20], [100, 24]], 2, '#e0594a');
    col(g, '#f6d55c'); circle(g, 88, 17, 2.6);
    col(g, '#2a2118'); circle(g, 88, 17, 1.3);
  },
  slak: g => {
    col(g, '#cfe3b4'); box(g, 0, 78, 100, 22, 0);
    col(g, '#d9a96a'); g.beginPath(); g.moveTo(16, 78); g.quadraticCurveTo(10, 62, 26, 62);
    g.lineTo(74, 62); g.quadraticCurveTo(84, 70, 74, 78); g.closePath(); g.fill();
    col(g, '#c2914f'); circle(g, 44, 50, 24);
    col(g, '#b3793c');
    g.strokeStyle = '#8a5a28'; g.lineWidth = 3.4; g.beginPath();
    for (let a = 0; a < TAU * 2.4; a += 0.2) {
      const r = 3 + a * 3.2, x = 44 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    col(g, '#d9a96a'); circle(g, 78, 66, 8);
    stroke(g, [[78, 60], [82, 46]], 2.4, '#d9a96a'); stroke(g, [[74, 60], [68, 46]], 2.4, '#d9a96a');
    col(g, '#2a2118'); circle(g, 82, 45, 2.4); circle(g, 68, 45, 2.4);
  },
  snoep: g => {
    col(g, '#e0594a'); ell(g, 50, 52, 24, 20);
    col(g, '#fdfaf2');
    g.save(); g.beginPath(); g.ellipse(50, 52, 24, 20, 0, 0, TAU); g.clip();
    for (let i = -2; i < 3; i++) poly(g, [[38 + i * 14, 30], [46 + i * 14, 30], [56 + i * 14, 74], [48 + i * 14, 74]]);
    g.restore();
    col(g, '#d3588f'); poly(g, [[26, 52], [8, 36], [12, 52], [8, 68]]);
    poly(g, [[74, 52], [92, 36], [88, 52], [92, 68]]);
    col(g, 'rgba(255,255,255,0.35)'); ell(g, 42, 42, 8, 5, -0.5);
  },
  sneeuw: g => {
    col(g, '#cfe8f6'); box(g, 0, 0, 100, 100, 0);
    col(g, '#fdfaf2'); box(g, 0, 76, 100, 24, 0);
    circle(g, 50, 62, 22); circle(g, 50, 36, 16); circle(g, 50, 16, 11);
    col(g, '#2a2118'); circle(g, 46, 14, 1.8); circle(g, 54, 14, 1.8);
    col(g, '#f0a04b'); poly(g, [[50, 18], [64, 21], [50, 23]]);
    col(g, '#2a2118'); circle(g, 50, 32, 2.4); circle(g, 50, 40, 2.4);
    col(g, WOOD_D); stroke(g, [[32, 34], [14, 22]], 3, WOOD_D); stroke(g, [[68, 34], [86, 22]], 3, WOOD_D);
    col(g, '#ffffff');
    for (const [x, y, r] of [[16, 50, 3], [84, 58, 2.6], [26, 14, 2.4], [74, 10, 3]]) circle(g, x, y, r);
  },
  plank: g => {
    col(g, WOOD); box(g, 4, 36, 92, 30, 4);
    col(g, WOOD_D); box(g, 4, 58, 92, 8, 4);
    col(g, '#c2914f');
    for (let i = 0; i < 4; i++) curve(g, 10, 42 + i * 5, 50, 38 + i * 6, 92, 44 + i * 5, 1.6, 'rgba(120,80,36,0.4)');
    col(g, '#8a5a28'); ell(g, 24, 50, 5, 3.4); ell(g, 70, 46, 4, 2.6);
  },
  plant: g => {
    col(g, '#c9743f'); g.beginPath(); g.moveTo(28, 62); g.lineTo(72, 62);
    g.lineTo(66, 92); g.lineTo(34, 92); g.closePath(); g.fill();
    col(g, '#a0522d'); box(g, 24, 56, 52, 10, 3);
    col(g, LEAF_D); stroke(g, [[50, 62], [50, 30]], 4, LEAF_D);
    col(g, LEAF); ell(g, 32, 40, 15, 8, -0.5); ell(g, 68, 34, 15, 8, 0.5);
    ell(g, 36, 22, 12, 7, -0.9); ell(g, 64, 50, 13, 7, 0.4);
    col(g, '#3f8f4a'); ell(g, 50, 18, 9, 12);
  },
  klomp: g => {
    col(g, '#f0b429'); g.beginPath(); g.moveTo(14, 44); g.quadraticCurveTo(12, 76, 30, 80);
    g.lineTo(62, 80); g.quadraticCurveTo(88, 74, 88, 50);
    g.quadraticCurveTo(86, 34, 70, 42); g.quadraticCurveTo(50, 52, 14, 44); g.fill();
    col(g, '#d99416'); g.beginPath(); g.moveTo(14, 44); g.quadraticCurveTo(38, 54, 52, 50);
    g.quadraticCurveTo(44, 62, 16, 58); g.closePath(); g.fill();
    col(g, '#e0594a'); circle(g, 66, 54, 6);
    col(g, LEAF); ell(g, 76, 58, 6, 4, 0.5);
    col(g, '#c98a2c'); box(g, 16, 76, 70, 6, 3);
  },
  kraan: g => {
    col(g, '#cfd8dd'); box(g, 18, 20, 14, 40, 4);
    g.beginPath(); g.moveTo(18, 24); g.lineTo(66, 24); g.quadraticCurveTo(76, 26, 76, 40);
    g.lineTo(62, 40); g.quadraticCurveTo(62, 36, 54, 36); g.lineTo(18, 36); g.closePath(); g.fill();
    col(g, '#9aa7ae'); box(g, 60, 38, 18, 10, 3);
    col(g, '#e0594a'); box(g, 12, 12, 26, 10, 5);
    col(g, '#b9c2c7'); box(g, 12, 58, 26, 8, 3);
    col(g, '#7fc0e0'); ell(g, 69, 60, 5, 8); ell(g, 69, 78, 4, 6); circle(g, 69, 90, 3.4);
  },
  krab: g => {
    col(g, '#e0594a'); ell(g, 50, 56, 30, 20);
    for (const s of [-1, 1]) {
      stroke(g, [[50 + s * 20, 68], [50 + s * 32, 78], [50 + s * 38, 86]], 4, '#e0594a');
      stroke(g, [[50 + s * 24, 60], [50 + s * 40, 64], [50 + s * 46, 74]], 4, '#e0594a');
      stroke(g, [[50 + s * 26, 48], [50 + s * 42, 40]], 4.5, '#e0594a');
      col(g, '#c34434');
      poly(g, [[50 + s * 40, 42], [50 + s * 54, 30], [50 + s * 44, 44], [50 + s * 54, 46]]);
      col(g, '#e0594a');
    }
    col(g, '#c34434'); ell(g, 50, 60, 20, 10);
    col(g, '#ffffff'); circle(g, 42, 44, 5); circle(g, 58, 44, 5);
    col(g, '#2a2118'); circle(g, 42, 45, 2.4); circle(g, 58, 45, 2.4);
    col(g, '#c34434'); curve(g, 42, 60, 50, 66, 58, 60, 2.4, '#8a2f24');
  },
  trap: g => {
    col(g, '#b3793c');
    for (let i = 0; i < 4; i++) {
      box(g, 10 + i * 20, 84 - i * 18, 90 - i * 20, 8, 2);
      col(g, '#8a5a28'); box(g, 10 + i * 20, 92 - i * 18, 80 - i * 20 + 10, 10, 1);
      col(g, '#b3793c');
    }
    col(g, 'rgba(255,255,255,0.18)'); box(g, 10, 84, 90, 3, 1);
  },
  trui: g => {
    col(g, '#3f7fbf'); g.beginPath(); g.moveTo(30, 26); g.lineTo(70, 26);
    g.lineTo(88, 40); g.lineTo(78, 56); g.lineTo(72, 50); g.lineTo(72, 84);
    g.lineTo(28, 84); g.lineTo(28, 50); g.lineTo(22, 56); g.lineTo(12, 40); g.closePath(); g.fill();
    col(g, '#2b5f94'); box(g, 28, 76, 44, 8, 0);
    g.beginPath(); g.arc(50, 26, 11, 0, Math.PI); g.fill();
    col(g, '#fdfaf2');
    for (let i = 0; i < 3; i++) box(g, 34, 48 + i * 10, 32, 4, 2);
  },
  brood: g => {
    col(g, '#c2914f'); g.beginPath(); g.moveTo(12, 78); g.quadraticCurveTo(6, 44, 34, 34);
    g.quadraticCurveTo(66, 24, 86, 42); g.quadraticCurveTo(98, 58, 88, 78); g.closePath(); g.fill();
    col(g, '#d9a96a'); g.beginPath(); g.moveTo(14, 72); g.quadraticCurveTo(10, 46, 36, 38);
    g.quadraticCurveTo(64, 30, 82, 46); g.quadraticCurveTo(92, 58, 86, 72); g.closePath(); g.fill();
    col(g, '#a87a3f');
    for (let i = 0; i < 3; i++) stroke(g, [[30 + i * 18, 40 + i * 2], [40 + i * 18, 54 + i * 2]], 3, '#a87a3f');
    col(g, '#8a5a28'); box(g, 10, 76, 80, 6, 3);
  },
  bloem: g => {
    col(g, LEAF_D); stroke(g, [[50, 92], [50, 48]], 5, LEAF_D);
    col(g, LEAF); ell(g, 32, 70, 14, 7, -0.4); ell(g, 68, 78, 14, 7, 0.4);
    col(g, '#d3588f');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ell(g, 50 + Math.cos(a) * 18, 42 + Math.sin(a) * 18, 12, 9, a);
    }
    col(g, '#f6c445'); circle(g, 50, 42, 11);
    col(g, '#e8a90e'); circle(g, 50, 42, 6);
  },
  druif: g => {
    col(g, WOOD_D); stroke(g, [[50, 22], [54, 8]], 3.4, WOOD_D);
    col(g, LEAF); ell(g, 66, 14, 12, 7, -0.3);
    col(g, '#8f57a0');
    const rows = [[50], [38, 62], [30, 50, 70], [38, 62], [50]];
    rows.forEach((r, ri) => r.forEach(x => circle(g, x, 30 + ri * 14, 10)));
    col(g, '#a86fb8');
    rows.forEach((r, ri) => r.forEach(x => circle(g, x - 3, 27 + ri * 14, 4)));
  },
  vlag: g => {
    col(g, '#8a5a28'); box(g, 16, 8, 8, 86, 4);
    col(g, '#e0594a'); g.beginPath(); g.moveTo(24, 14); g.lineTo(88, 14);
    g.quadraticCurveTo(80, 32, 88, 50); g.lineTo(24, 50); g.closePath(); g.fill();
    col(g, '#fdfaf2'); box(g, 24, 26, 62, 12, 0);
    col(g, '#3f7fbf'); g.beginPath(); g.moveTo(24, 38); g.lineTo(87, 38);
    g.quadraticCurveTo(83, 44, 88, 50); g.lineTo(24, 50); g.closePath(); g.fill();
    col(g, '#f6c445'); circle(g, 20, 8, 5);
  },
  zwaan: g => {
    col(g, WATER); box(g, 0, 70, 100, 30, 0);
    col(g, '#fdfaf2'); ell(g, 44, 66, 30, 18);
    g.beginPath(); g.moveTo(58, 56); g.quadraticCurveTo(76, 52, 74, 32);
    g.quadraticCurveTo(72, 18, 84, 18); g.quadraticCurveTo(76, 24, 80, 34);
    g.quadraticCurveTo(84, 58, 62, 64); g.closePath(); g.fill();
    circle(g, 80, 20, 8);
    col(g, '#e6dcc6'); ell(g, 30, 58, 16, 10, -0.3);
    col(g, '#f0b429'); poly(g, [[86, 18], [98, 22], [86, 25]]);
    col(g, '#2a2118'); circle(g, 82, 17, 2.4);
    col(g, WATER_D); curve(g, 8, 84, 26, 90, 44, 84, 3, WATER_D); curve(g, 58, 88, 74, 82, 94, 88, 3, WATER_D);
  },
  angst: g => {
    col(g, '#f6c445'); circle(g, 50, 50, 34);
    col(g, '#e8a90e'); ring(g, 50, 50, 33, 2, '#e8a90e');
    col(g, '#ffffff'); ell(g, 38, 42, 8, 10); ell(g, 62, 42, 8, 10);
    col(g, '#2a2118'); circle(g, 38, 44, 4); circle(g, 62, 44, 4);
    ell(g, 50, 68, 10, 13);
    col(g, '#8a2f24'); ell(g, 50, 72, 6, 7);
    col(g, '#c98a2c'); stroke(g, [[28, 28], [42, 32]], 3, '#c98a2c'); stroke(g, [[72, 28], [58, 32]], 3, '#c98a2c');
    col(g, '#7fc0e0'); ell(g, 22, 56, 4, 7); ell(g, 78, 60, 3.4, 6);
  },
  herfst: g => {
    col(g, '#e8a13c'); g.beginPath(); g.moveTo(50, 10);
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * TAU;
      const lobe = 1 + 0.22 * Math.cos(a * 5);
      g.lineTo(50 + Math.cos(a) * 34 * lobe, 52 + Math.sin(a) * 32 * lobe);
    }
    g.closePath(); g.fill();
    col(g, '#c96a22');
    stroke(g, [[50, 88], [50, 26]], 3.4, '#c96a22');
    stroke(g, [[50, 46], [28, 30]], 2.4, '#c96a22'); stroke(g, [[50, 46], [72, 30]], 2.4, '#c96a22');
    stroke(g, [[50, 62], [30, 52]], 2.4, '#c96a22'); stroke(g, [[50, 62], [70, 52]], 2.4, '#c96a22');
  },
  worst: g => {
    col(g, '#a8462f'); g.lineCap = 'round';
    stroke(g, [[16, 74], [40, 50], [64, 46], [86, 26]], 26, '#a8462f');
    col(g, '#c26248');
    stroke(g, [[22, 66], [42, 44], [64, 40], [80, 24]], 9, 'rgba(240,180,160,0.4)');
    col(g, '#8f3a26');
    for (const [x, y] of [[32, 60], [48, 50], [64, 48], [78, 38]]) ell(g, x, y, 3.4, 2.4, -0.5);
    col(g, '#7a3120'); ell(g, 16, 74, 12, 11, -0.7); ell(g, 86, 26, 12, 11, -0.7);
    col(g, '#e8dfc8'); circle(g, 14, 77, 3.4); circle(g, 88, 23, 3.4);
    col(g, '#cfe3b4'); ell(g, 50, 90, 34, 7);
  },
  ring: g => {
    col(g, '#f6c445'); ring(g, 50, 60, 26, 9, '#f6c445');
    col(g, '#e8a90e'); ring(g, 50, 60, 26, 3, '#e8a90e');
    col(g, '#9fd8f2'); poly(g, [[50, 14], [64, 28], [50, 44], [36, 28]]);
    col(g, '#cdeaf7'); poly(g, [[50, 14], [64, 28], [50, 28]]);
    col(g, '#7fc0e0'); poly(g, [[36, 28], [50, 44], [50, 28]]);
    col(g, 'rgba(255,255,255,0.5)'); circle(g, 44, 26, 3);
  },
  bank: g => {
    col(g, '#cfe3b4'); box(g, 0, 84, 100, 16, 0);
    col(g, WOOD);
    box(g, 10, 54, 80, 8, 3); box(g, 10, 66, 80, 8, 3);
    box(g, 12, 20, 76, 8, 3); box(g, 12, 32, 76, 8, 3);
    col(g, WOOD_D); box(g, 14, 20, 8, 66, 3); box(g, 78, 20, 8, 66, 3);
    box(g, 6, 74, 12, 14, 3); box(g, 82, 74, 12, 14, 3);
  },
};
Object.assign(PICTURES, CLUSTER);

// ---------------------------------------------------------------- scenes, for the sentences

/** Put one of the drawings above into a scene, at a size and a place. */
function place(g: Ctx, id: string, x: number, y: number, s: number): void {
  const d = PICTURES[id];
  if (!d) return;
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  d(g);
  g.restore();
}

const grassField = (g: Ctx): void => {
  const sky = g.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, '#7fc4ea'); sky.addColorStop(1, '#cfe8f6');
  g.fillStyle = sky; box(g, 0, 0, 160, 70);
  col(g, '#79c05e'); box(g, 0, 62, 160, 38);
  col(g, '#5fa648'); for (let i = 0; i < 18; i++) stroke(g, [[i * 9 + 3, 96], [i * 9 + 6, 86]], 2, '#5fa648');
};
const seaField = (g: Ctx): void => {
  const sky = g.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, '#7fc4ea'); sky.addColorStop(1, '#dff0f8');
  g.fillStyle = sky; box(g, 0, 0, 160, 60);
  col(g, WATER); box(g, 0, 52, 160, 48);
  col(g, WATER_D);
  for (let i = 0; i < 5; i++) curve(g, i * 34, 74 + (i % 2) * 10, i * 34 + 16, 68 + (i % 2) * 10, i * 34 + 32, 74 + (i % 2) * 10, 2.4, 'rgba(30,90,140,0.5)');
};
const nightField = (g: Ctx): void => {
  const sky = g.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, '#16294a'); sky.addColorStop(1, '#2f4b74');
  g.fillStyle = sky; box(g, 0, 0, 160, 100);
  col(g, '#fdf6c8');
  for (const [x, y, r] of [[18, 16, 2], [46, 10, 1.6], [120, 18, 2.2], [142, 40, 1.6], [90, 24, 1.8]]) circle(g, x, y, r);
  col(g, '#f6e8a8'); circle(g, 132, 20, 10);
  col(g, '#2f4b74'); circle(g, 126, 16, 9);
  col(g, '#243a2a'); box(g, 0, 78, 160, 22);
};
const roomField = (g: Ctx): void => {
  col(g, '#f2e3c6'); box(g, 0, 0, 160, 70);
  col(g, '#c9a97f'); box(g, 0, 64, 160, 36);
  col(g, '#b3946a'); for (let i = 0; i < 6; i++) stroke(g, [[i * 30 - 10, 100], [i * 30 + 6, 64]], 1.6, '#b3946a');
  col(g, 'rgba(255,255,255,0.35)'); box(g, 0, 60, 160, 5);
};

export const SCENES: Record<string, (g: Ctx) => void> = {
  sun: g => {
    grassField(g);
    place(g, 'zon', 86, -4, 74);
    place(g, 'boom', 6, 30, 62);
    col(g, '#f6d55c'); for (let i = 0; i < 4; i++) stroke(g, [[100 + i * 6, 46], [90 + i * 6, 62]], 2, 'rgba(246,213,92,0.7)');
  },
  fish: g => {
    seaField(g);
    place(g, 'vis', 40, 32, 74);
    col(g, LEAF_D); for (const x of [16, 132, 146]) curve(g, x, 100, x + 8, 82, x, 66, 5, '#2f8f5a');
    col(g, 'rgba(255,255,255,0.6)'); circle(g, 108, 56, 4); circle(g, 116, 46, 3); circle(g, 112, 36, 2);
  },
  boat: g => { seaField(g); place(g, 'boot', 34, 6, 92); place(g, 'zon', 118, 2, 44); },
  cat: g => {
    roomField(g);
    place(g, 'mat', 34, 30, 92);
    place(g, 'kat', 44, 12, 72);
    col(g, '#5c7a8f'); g.font = '900 16px Nunito, system-ui, sans-serif';
    g.fillText('z', 104, 34); g.font = '900 12px Nunito, system-ui, sans-serif'; g.fillText('z', 114, 24);
  },
  cow: g => { grassField(g); place(g, 'koe', 30, 16, 84); col(g, '#5fa648'); for (const x of [16, 132]) { stroke(g, [[x, 96], [x + 3, 82]], 3, '#4a8730'); stroke(g, [[x + 6, 96], [x + 4, 84]], 3, '#4a8730'); } },
  owl: g => { nightField(g); place(g, 'boom', 96, 16, 78); place(g, 'uil', 20, 24, 66); },
  mouse: g => { roomField(g); place(g, 'muis', 10, 24, 76); place(g, 'kaas', 90, 30, 64); },
  sheep: g => { grassField(g); place(g, 'schaap', 16, 18, 78); place(g, 'hek', 96, 30, 62); },
  train: g => {
    const sky = g.createLinearGradient(0, 0, 0, 100);
    sky.addColorStop(0, '#7fc4ea'); sky.addColorStop(1, '#dff0f8');
    g.fillStyle = sky; box(g, 0, 0, 160, 100);
    col(g, '#cfe3b4'); box(g, 0, 74, 160, 26);
    col(g, WOOD_D); for (let i = 0; i < 11; i++) box(g, i * 15 + 2, 84, 9, 6, 1);
    col(g, GREY_D); box(g, 0, 82, 160, 3); box(g, 0, 92, 160, 3);
    place(g, 'trein', 26, 4, 96);
  },
  bee: g => { grassField(g); place(g, 'bloem', 86, 22, 76); place(g, 'bij', 8, 10, 60); },
};

/** Scenes are drawn wide, single words square. */
export const boxOf = (id: string): { w: number; h: number } =>
  (id.startsWith('scene:') ? { w: 160, h: 100 } : { w: 100, h: 100 });

export const hasPicture = (id: string): boolean =>
  (id.startsWith('scene:') ? !!SCENES[id.slice(6)] : !!PICTURES[id]);

/**
 * Draw a word's picture, or a sentence's scene, as large as it will go inside the given box.
 *
 * Nothing here knows what the picture is of: the caller says where the box is and this fits the
 * drawing into it, so the same drawing serves the big card, a thumbnail and a scene.
 */
export function drawPicture(ctx: Ctx, id: string, x: number, y: number, w: number, h: number): void {
  const nat = boxOf(id);
  const s = Math.min(w / nat.w, h / nat.h);
  ctx.save();
  ctx.translate(x + (w - nat.w * s) / 2, y + (h - nat.h * s) / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, nat.w, nat.h);
  ctx.clip();
  const draw = id.startsWith('scene:') ? SCENES[id.slice(6)] : PICTURES[id];
  if (draw) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx);
  } else {
    // a word with no drawing yet is a question mark rather than an empty hole
    col(ctx, '#cfd8dd');
    box(ctx, 10, 10, nat.w - 20, nat.h - 20, 12);
    col(ctx, '#8a9aa3');
    ctx.font = '900 44px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', nat.w / 2, nat.h / 2 + 16);
  }
  ctx.restore();
}
