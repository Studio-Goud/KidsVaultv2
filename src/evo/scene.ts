/**
 * The world behind the animal at each stop: where it lived, drawn from the side like a museum
 * diorama, in layers that slide past at different speeds while it walks or swims.
 *
 * Every scene is of its own time. Hot springs on the dark sea floor for the first cells; the
 * stromatolite mounds that bacteria built for billions of years; the Cambrian sea of the Chengjiang
 * rocks where Haikouichthys was found, with trilobites and, far off, Anomalocaris; a Devonian
 * riverbank where the water meets the first forests; a Carboniferous swamp of giant club-moss trees
 * with a Meganeura dragonfly as big as a crow; the dry Triassic; a night with a dinosaur walking past
 * in the moonlight; the forest canopy of the first primates; an African forest; the savanna; a fire
 * at dusk; a painted cave; and today.
 *
 * `scroll` is how far the animal has walked, in pixels; each layer moves by its own share of it.
 */

import type { Scene } from './data';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

/** A repeating strip: each item at a fixed place on an endless band, drawn only if on screen. */
function band(w: number, scroll: number, speed: number, gap: number, draw: (x: number, i: number) => void): void {
  const off = scroll * speed;
  const first = Math.floor((off - gap) / gap);
  for (let i = first; i * gap - off < w + gap; i++) draw(i * gap - off, i);
}

function sky(ctx: Ctx, w: number, h: number, top: string, low: string, until: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, until);
  g.addColorStop(0, top); g.addColorStop(1, low);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, until + 1);
}

function hills(ctx: Ctx, w: number, gy: number, scroll: number, speed: number, height: number, colour: string, seed: number): void {
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.moveTo(0, gy + 2);
  for (let x = 0; x <= w + 10; x += 10) {
    const X = x + scroll * speed;
    const y = gy - height * (0.55 + 0.25 * Math.sin(X * 0.004 + seed) + 0.15 * Math.sin(X * 0.011 + seed * 2) + 0.05 * Math.sin(X * 0.03));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, gy + 2); ctx.closePath(); ctx.fill();
}

function ground(ctx: Ctx, w: number, h: number, gy: number, top: string, low: string, scroll: number, speck: string): void {
  const g = ctx.createLinearGradient(0, gy, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, low);
  ctx.fillStyle = g; ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = speck;
  band(w, scroll, 1, 23, (x, i) => {
    const yy = gy + 4 + hash(i, 3) * (h - gy - 8);
    const s = 1 + hash(i, 5) * 3;
    ctx.beginPath(); ctx.ellipse(x + hash(i, 7) * 20, yy, s * 2, s * 0.7, 0, 0, TAU); ctx.fill();
  });
}

function shafts(ctx: Ctx, w: number, h: number, t: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w * 1.2 - w * 0.1 + Math.sin(t * 0.2 + i) * 20;
    const g = ctx.createLinearGradient(x, 0, x + w * 0.15, h);
    g.addColorStop(0, `rgba(200, 240, 255, ${alpha})`); g.addColorStop(1, 'rgba(200, 240, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 15, 0); ctx.lineTo(x + 25, 0); ctx.lineTo(x + w * 0.2, h); ctx.lineTo(x + w * 0.12, h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function motes(ctx: Ctx, w: number, h: number, t: number, colour: string, n: number, rise: number): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 1) * w + Math.sin(t * 0.3 + i) * 10) % w;
    const y = ((hash(i, 2) * h - t * rise * (0.5 + hash(i, 3))) % h + h) % h;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + hash(i, 4) * 1.6, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- the pieces of scenery

/** A black smoker: a chimney of minerals on the sea floor with hot black water pouring up out of it. */
function smoker(ctx: Ctx, x: number, gy: number, s: number, t: number, seed: number): void {
  const hgt = s * (1.4 + hash(seed, 1) * 1.2);
  const g = ctx.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0);
  g.addColorStop(0, '#1a1410'); g.addColorStop(0.5, '#3a2c22'); g.addColorStop(1, '#120e0a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, gy);
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    ctx.lineTo(x - s * (0.45 - k * 0.3) + Math.sin(k * 9 + seed) * s * 0.06, gy - hgt * k);
  }
  for (let i = 8; i >= 0; i--) {
    const k = i / 8;
    ctx.lineTo(x + s * (0.45 - k * 0.3) + Math.sin(k * 7 + seed * 2) * s * 0.06, gy - hgt * k);
  }
  ctx.closePath(); ctx.fill();
  // the glow of heat at its mouth
  const top = gy - hgt;
  const hg = ctx.createRadialGradient(x, top, 0, x, top, s * 0.5);
  hg.addColorStop(0, 'rgba(255, 150, 60, 0.55)'); hg.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, top, s * 0.5, 0, TAU); ctx.fill();
  // the plume, billowing up
  for (let i = 0; i < 14; i++) {
    const k = ((t * 0.25 + i / 14) % 1);
    const px = x + Math.sin(k * 5 + i + seed) * s * 0.25 * k;
    const py = top - k * s * 3.2;
    const r = s * (0.15 + k * 0.55);
    ctx.fillStyle = `rgba(20, 22, 28, ${0.5 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
}

/** A stromatolite: a mound of layer on layer of mud that mats of bacteria trapped, one of the oldest kinds of fossil. */
function stromatolite(ctx: Ctx, x: number, gy: number, s: number, seed: number): void {
  const w = s * (0.8 + hash(seed, 1) * 0.6), hgt = s * (0.5 + hash(seed, 2) * 0.5);
  const g = ctx.createLinearGradient(0, gy - hgt, 0, gy);
  g.addColorStop(0, '#9aa878'); g.addColorStop(1, '#6a6a48');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.bezierCurveTo(x - w, gy - hgt * 1.2, x + w, gy - hgt * 1.2, x + w, gy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60, 60, 40, 0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const k = i / 6;
    ctx.beginPath(); ctx.moveTo(x - w * (1 - k * 0.2), gy - hgt * k * 0.2);
    ctx.bezierCurveTo(x - w * (1 - k * 0.3), gy - hgt * 1.15 * (1 - k * 0.1) * k * 1.1, x + w * (1 - k * 0.3), gy - hgt * 1.15 * k, x + w * (1 - k * 0.2), gy - hgt * k * 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120, 170, 90, 0.35)';
  ctx.beginPath(); ctx.ellipse(x, gy - hgt * 0.88, w * 0.6, hgt * 0.12, 0, 0, TAU); ctx.fill();
}

function frond(ctx: Ctx, x: number, gy: number, s: number, t: number, seed: number, colour: string): void {
  // a Charnia-like frond of the Ediacaran sea floor, swaying
  const hgt = s * (1 + hash(seed, 1)), sway = Math.sin(t * 0.8 + seed) * 0.08;
  ctx.save(); ctx.translate(x, gy); ctx.rotate(sway);
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.ellipse(0, -hgt * 0.55, s * 0.18, hgt * 0.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40, 60, 40, 0.4)'; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) { const y = -hgt * (0.1 + i * 0.09); ctx.beginPath(); ctx.moveTo(-s * 0.15, y + 3); ctx.lineTo(0, y); ctx.lineTo(s * 0.15, y + 3); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, TAU); ctx.fillStyle = colour; ctx.fill();
  ctx.restore();
}

function trilobite(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#6a5a48';
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.35, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(30, 25, 20, 0.5)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.22, 0); ctx.lineTo(i * s * 0.2, -s * 0.3); ctx.stroke(); }
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath(); ctx.ellipse(s * 0.75, -s * 0.08, s * 0.3, s * 0.2, 0, Math.PI, 0); ctx.fill();
  // little legs going
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.8)';
  for (let i = -3; i <= 3; i++) { const k = Math.sin(t * 8 + i) * s * 0.06; ctx.beginPath(); ctx.moveTo(i * s * 0.22, 0); ctx.lineTo(i * s * 0.22 + k, s * 0.12); ctx.stroke(); }
  ctx.restore();
}

function anomalocaris(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  // the great predator of the Cambrian, far off and hazy: a flat body with flaps down its sides
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(40, 70, 90, 0.55)';
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.22, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const px = -s * 0.8 + i * s * 0.2, f = Math.sin(t * 4 - i * 0.7) * s * 0.08;
    ctx.beginPath(); ctx.ellipse(px, s * 0.12 + f, s * 0.12, s * 0.06, 0.3, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.quadraticCurveTo(s * 1.35, s * 0.1, s * 1.25, s * 0.4); ctx.lineWidth = s * 0.06; ctx.strokeStyle = 'rgba(40, 70, 90, 0.55)'; ctx.stroke();
  ctx.restore();
}

function lycopsid(ctx: Ctx, x: number, gy: number, s: number, seed: number, haze: number): void {
  // Lepidodendron: a club-moss that grew as tall as a house, with a diamond-patterned trunk
  const hgt = s * (3 + hash(seed, 1) * 1.5), w = s * 0.18;
  ctx.fillStyle = `rgba(${Math.round(60 + haze * 80)}, ${Math.round(75 + haze * 80)}, ${Math.round(50 + haze * 80)}, 1)`;
  ctx.fillRect(x - w / 2, gy - hgt, w, hgt);
  ctx.strokeStyle = 'rgba(20, 30, 15, 0.35)'; ctx.lineWidth = 1;
  for (let y = gy - hgt; y < gy; y += w * 0.5) { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y + w * 0.5); ctx.moveTo(x + w / 2, y); ctx.lineTo(x - w / 2, y + w * 0.5); ctx.stroke(); }
  // the crown: forked branches with tufts
  ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = w * 0.5; ctx.lineCap = 'round';
  const fork = (px: number, py: number, a: number, len: number, d: number): void => {
    const ex = px + Math.cos(a) * len, ey = py - Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    if (d <= 0) {
      ctx.fillStyle = `rgba(${Math.round(70 + haze * 70)}, ${Math.round(110 + haze * 60)}, ${Math.round(50 + haze * 70)}, 1)`;
      ctx.beginPath(); ctx.ellipse(ex, ey, len * 0.5, len * 0.28, -a, 0, TAU); ctx.fill();
      return;
    }
    fork(ex, ey, a + 0.45, len * 0.75, d - 1); fork(ex, ey, a - 0.45, len * 0.75, d - 1);
  };
  fork(x, gy - hgt, Math.PI / 2, s * 0.6, 3);
}

function fern(ctx: Ctx, x: number, gy: number, s: number, colour: string, seed: number, t = 0): void {
  ctx.strokeStyle = colour; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.35 + Math.sin(t * 0.8 + seed + i) * 0.03;
    const len = s * (0.7 + hash(seed, i) * 0.5);
    const ex = x + Math.cos(a) * len, ey = gy + Math.sin(a) * len;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo((x + ex) / 2 + Math.cos(a + 1.2) * len * 0.15, (gy + ey) / 2, ex, ey); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    for (let j = 1; j < 9; j++) {
      const k = j / 9, px = x + (ex - x) * k, py = gy + (ey - gy) * k, l = len * 0.18 * (1 - k);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a - 1.2) * l, py + Math.sin(a - 1.2) * l); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + 1.2) * l, py + Math.sin(a + 1.2) * l); ctx.stroke();
    }
  }
}

function conifer(ctx: Ctx, x: number, gy: number, s: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x - s * 0.05, gy - s * 0.6, s * 0.1, s * 0.6);
  for (let i = 0; i < 5; i++) {
    const y = gy - s * (0.4 + i * 0.45), w = s * (0.7 - i * 0.12);
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  }
}

function leafCluster(ctx: Ctx, x: number, y: number, r: number, leaf: string, seed: number): void {
  // a mass of foliage: a dark body, then many small leaves on top, lighter where the light falls
  ctx.fillStyle = leaf;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + hash(seed, i);
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.35);
    ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.35, r * (0.4 + hash(seed, i + 20) * 0.2), 0, TAU);
  }
  ctx.fill();
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.fillStyle = 'rgba(255, 255, 220, 0.35)';
  for (let i = 0; i < 26; i++) {
    const a = hash(seed, i + 40) * TAU, d = Math.sqrt(hash(seed, i + 60)) * r * 0.8;
    const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.7 - r * 0.15;
    if (ly > y + r * 0.1) continue;
    ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.08, r * 0.045, a, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0, 20, 0, 0.3)';
  for (let i = 0; i < 18; i++) {
    const a = hash(seed, i + 80) * TAU, d = Math.sqrt(hash(seed, i + 90)) * r * 0.8;
    const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.7 + r * 0.15;
    ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.09, r * 0.05, a, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function broadTree(ctx: Ctx, x: number, gy: number, s: number, trunk: string, leaf: string, seed: number): void {
  ctx.fillStyle = trunk;
  ctx.beginPath(); ctx.moveTo(x - s * 0.12, gy); ctx.quadraticCurveTo(x - s * 0.04, gy - s * 0.8, x - s * 0.06, gy - s * 1.6); ctx.lineTo(x + s * 0.06, gy - s * 1.6); ctx.quadraticCurveTo(x + s * 0.05, gy - s * 0.8, x + s * 0.12, gy); ctx.fill();
  ctx.strokeStyle = trunk; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, gy - s * 1.2); ctx.lineTo(x - s * 0.5, gy - s * 1.75); ctx.moveTo(x, gy - s * 1.3); ctx.lineTo(x + s * 0.45, gy - s * 1.8); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = hash(seed, i) * TAU, d = s * 0.45 * hash(seed, i + 9);
    leafCluster(ctx, x + Math.cos(a) * d * 1.3, gy - s * 1.9 + Math.sin(a) * d * 0.5, s * (0.55 + hash(seed, i + 3) * 0.25), leaf, seed * 7 + i);
  }
}

function acacia(ctx: Ctx, x: number, gy: number, s: number, colour: string): void {
  // the flat-topped tree of the savanna
  ctx.strokeStyle = colour; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - s * 0.05, gy - s * 0.9); ctx.lineTo(x - s * 0.5, gy - s * 1.4);
  ctx.moveTo(x - s * 0.05, gy - s * 0.9); ctx.lineTo(x + s * 0.45, gy - s * 1.45); ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.ellipse(x, gy - s * 1.5, s * 1.1, s * 0.22, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - s * 0.4, gy - s * 1.58, s * 0.6, s * 0.16, 0, 0, TAU); ctx.fill();
}

function grassTufts(ctx: Ctx, w: number, gy: number, scroll: number, colour: string, hgt: number, t: number): void {
  ctx.strokeStyle = colour; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  band(w, scroll, 1, 9, (x, i) => {
    const hh = hgt * (0.5 + hash(i, 2));
    const lean = Math.sin(t * 1.2 + i * 0.3) * 3;
    ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.quadraticCurveTo(x + lean * 0.5, gy - hh * 0.5, x + lean + (hash(i, 3) - 0.5) * 6, gy - hh); ctx.stroke();
  });
}

function stars(ctx: Ctx, w: number, h: number, t: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = hash(i, 11) * w, y = hash(i, 12) * h;
    ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 0.6 + hash(i, 13) * 1.3, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sauropodSilhouette(ctx: Ctx, x: number, gy: number, s: number, t: number, colour: string): void {
  // a long-necked dinosaur walking past, far off, in silhouette against the moonlit sky
  ctx.save(); ctx.translate(x, gy); ctx.fillStyle = colour; ctx.strokeStyle = colour; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, -s * 1.1, s * 0.9, s * 0.45, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = s * 0.22;
  ctx.beginPath(); ctx.moveTo(s * 0.6, -s * 1.3); ctx.quadraticCurveTo(s * 1.2, -s * 2.4, s * 1.6, -s * 2.6); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(s * 1.7, -s * 2.6, s * 0.2, s * 0.1, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = s * 0.16;
  ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 1.1); ctx.quadraticCurveTo(-s * 1.6, -s * 0.9, -s * 2.2, -s * 0.5); ctx.stroke();
  ctx.lineWidth = s * 0.2;
  for (let i = 0; i < 4; i++) {
    const lx = [-0.5, -0.3, 0.4, 0.6][i] * s, sw = Math.sin(t * 1.2 + i * Math.PI / 2) * s * 0.12;
    ctx.beginPath(); ctx.moveTo(lx, -s * 0.9); ctx.lineTo(lx + sw, 0); ctx.stroke();
  }
  ctx.restore();
}

function meganeura(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  // a griffinfly of the coal forests, with wings seventy centimetres across
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#3a5a50';
  ctx.fillRect(-s, -s * 0.04, s * 2, s * 0.08);
  ctx.beginPath(); ctx.arc(s, 0, s * 0.08, 0, TAU); ctx.fill();
  const buzz = Math.sin(t * 40) * 0.25;
  ctx.fillStyle = 'rgba(210, 230, 240, 0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(s * 0.25, side * s * 0.35 * (1 + buzz), s * 0.7, s * 0.12, side * 0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.55, side * s * 0.3 * (1 - buzz), s * 0.6, s * 0.1, -side * 0.15, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the scenes

export function drawScene(ctx: Ctx, w: number, h: number, gy: number, scene: Scene, t: number, scroll: number): void {
  const u = Math.max(0.6, Math.min(w, h) / 420);
  if (scene === 'vent') {
    sky(ctx, w, h, '#02060c', '#07131e', h);
    motes(ctx, w, h, t, 'rgba(150, 190, 210, 0.25)', 60, 6);
    hills(ctx, w, gy, scroll, 0.2, 60 * u, '#0a1218', 1);
    band(w, scroll, 0.35, 220 * u, (x, i) => smoker(ctx, x + hash(i, 1) * 80 * u, gy - 10 * u, 36 * u * (0.7 + hash(i, 2) * 0.6), t, i));
    ground(ctx, w, h, gy, '#161a1a', '#070a0a', scroll, 'rgba(60, 70, 70, 0.4)');
    band(w, scroll, 1, 150 * u, (x, i) => smoker(ctx, x + hash(i, 3) * 60 * u, gy + 6 * u, 22 * u, t, i + 20));
    return;
  }
  if (scene === 'sea' || scene === 'reef') {
    sky(ctx, w, h, scene === 'reef' ? '#2f8fb0' : '#3a9ab8', scene === 'reef' ? '#0c4a66' : '#135572', h);
    shafts(ctx, w, gy, t, 0.07);
    hills(ctx, w, gy, scroll, 0.15, 50 * u, 'rgba(20, 80, 100, 0.6)', 3);
    if (scene === 'sea') {
      band(w, scroll, 0.4, 120 * u, (x, i) => stromatolite(ctx, x, gy + 2, 40 * u * (0.6 + hash(i, 1) * 0.6), i));
    } else {
      band(w, scroll, 0.12, 700 * u, (x, i) => anomalocaris(ctx, x + hash(i, 1) * 200 * u, gy * 0.35 + hash(i, 2) * gy * 0.3, 40 * u, t));
      band(w, scroll, 0.4, 90 * u, (x, i) => frond(ctx, x, gy + 2, 30 * u, t, i, 'rgba(110, 150, 110, 0.8)'));
      // sponges: tall vases on the sea floor
      band(w, scroll, 0.6, 160 * u, (x, i) => {
        ctx.fillStyle = ['#c89a5a', '#b27a6a', '#d0b070'][i % 3];
        const hh = (40 + hash(i, 4) * 50) * u;
        ctx.beginPath(); ctx.moveTo(x - 8 * u, gy); ctx.lineTo(x - 14 * u, gy - hh); ctx.lineTo(x + 14 * u, gy - hh); ctx.lineTo(x + 8 * u, gy); ctx.fill();
        ctx.fillStyle = 'rgba(40, 20, 10, 0.5)'; ctx.beginPath(); ctx.ellipse(x, gy - hh, 14 * u, 4 * u, 0, 0, TAU); ctx.fill();
      });
    }
    ground(ctx, w, h, gy, '#c8b88a', '#8a7a58', scroll, 'rgba(90, 80, 55, 0.35)');
    if (scene === 'reef') band(w, scroll, 1, 260 * u, (x, i) => trilobite(ctx, x + hash(i, 5) * 80 * u + Math.sin(t * 0.3 + i) * 10, gy + 12 * u + hash(i, 6) * 20 * u, 12 * u, t));
    else band(w, scroll, 1, 200 * u, (x, i) => stromatolite(ctx, x, gy + 20 * u, 26 * u, i + 40));
    motes(ctx, w, h, t, 'rgba(230, 250, 255, 0.35)', 40, 12);
    return;
  }
  if (scene === 'shallows') {
    // the Devonian riverbank: the water surface cuts across, the first forests stand behind
    const wl = gy - 70 * u;
    sky(ctx, w, h, '#8ec2da', '#e8e2c4', wl);
    hills(ctx, w, wl, scroll, 0.08, 40 * u, '#8aa090', 2);
    band(w, scroll, 0.2, 90 * u, (x, i) => {
      // Archaeopteris, one of the first real trees
      const s = (40 + hash(i, 1) * 30) * u;
      ctx.fillStyle = '#4a5a3a'; ctx.fillRect(x - 2 * u, wl - s * 1.6, 4 * u, s * 1.6);
      ctx.fillStyle = '#5a7a44';
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x, wl - s * (0.7 + j * 0.2), s * (0.5 - j * 0.06), s * 0.08, 0, 0, TAU); ctx.fill(); }
    });
    // the water, seen from the side: murky green below the line, a bright band where the light comes in
    const g = ctx.createLinearGradient(0, wl, 0, h);
    g.addColorStop(0, 'rgba(90, 140, 120, 0.9)'); g.addColorStop(1, 'rgba(40, 70, 55, 1)');
    ctx.fillStyle = g; ctx.fillRect(0, wl, w, h - wl);
    ctx.strokeStyle = 'rgba(230, 250, 240, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let x = 0; x <= w; x += 8) { const y = wl + Math.sin(x * 0.03 + t * 2) * 2; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    band(w, scroll, 0.7, 70 * u, (x, i) => {
      ctx.strokeStyle = 'rgba(70, 110, 60, 0.8)'; ctx.lineWidth = 2 * u;
      const hh = (30 + hash(i, 3) * 40) * u;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + Math.sin(t + i) * 8 * u, gy - hh * 0.6, x + Math.sin(t * 0.7 + i) * 12 * u, gy - hh); ctx.stroke();
    });
    ground(ctx, w, h, gy, '#6a5a3e', '#3a3222', scroll, 'rgba(40, 30, 20, 0.4)');
    motes(ctx, w, h - wl, t, 'rgba(220, 240, 220, 0.25)', 25, 5);
    return;
  }
  if (scene === 'swamp') {
    sky(ctx, w, h, '#a8c098', '#dfe6c8', gy);
    band(w, scroll, 0.15, 70 * u, (x, i) => lycopsid(ctx, x, gy, 26 * u * (0.8 + hash(i, 1) * 0.4), i, 0.6));
    ctx.fillStyle = 'rgba(210, 225, 190, 0.45)'; ctx.fillRect(0, 0, w, gy);
    band(w, scroll, 0.4, 110 * u, (x, i) => lycopsid(ctx, x, gy, 40 * u * (0.8 + hash(i, 2) * 0.4), i + 30, 0.15));
    band(w, scroll, 0.25, 900 * u, (x, i) => meganeura(ctx, x + Math.sin(t * 0.7 + i) * 60 * u, gy * 0.45 + Math.sin(t * 1.1 + i) * 30 * u, 26 * u, t));
    ground(ctx, w, h, gy, '#4a5a30', '#2a3218', scroll, 'rgba(20, 30, 10, 0.4)');
    band(w, scroll, 1, 80 * u, (x, i) => fern(ctx, x, gy + 14 * u, 30 * u, '#3a6a2a', i, t));
    return;
  }
  if (scene === 'dunes') {
    sky(ctx, w, h, '#7ab0d8', '#f0dcb0', gy);
    hills(ctx, w, gy, scroll, 0.1, 70 * u, '#c89a6a', 5);
    hills(ctx, w, gy, scroll, 0.25, 40 * u, '#b07a4a', 8);
    band(w, scroll, 0.45, 160 * u, (x, i) => conifer(ctx, x, gy, (28 + hash(i, 1) * 20) * u, '#4a5a34'));
    ground(ctx, w, h, gy, '#b88a5a', '#7a5434', scroll, 'rgba(90, 60, 30, 0.4)');
    band(w, scroll, 1, 140 * u, (x, i) => fern(ctx, x, gy + 10 * u, 20 * u, '#6a7a3a', i + 5, t));
    return;
  }
  if (scene === 'night') {
    sky(ctx, w, h, '#050818', '#1a2440', gy);
    stars(ctx, w, gy, t, 90);
    const mx = w * 0.78, my = gy * 0.25;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 80 * u);
    mg.addColorStop(0, 'rgba(230, 235, 255, 0.35)'); mg.addColorStop(1, 'rgba(230, 235, 255, 0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 80 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eef0f8'; ctx.beginPath(); ctx.arc(mx, my, 18 * u, 0, TAU); ctx.fill();
    hills(ctx, w, gy, scroll, 0.08, 50 * u, '#10182a', 4);
    band(w, scroll, 0.12, 800 * u, (x, i) => sauropodSilhouette(ctx, x + t * 8 * u, gy - 6 * u, 26 * u, t, '#0c1322'));
    band(w, scroll, 0.4, 120 * u, (x, i) => conifer(ctx, x, gy, (40 + hash(i, 1) * 25) * u, '#0a1020'));
    ground(ctx, w, h, gy, '#141c24', '#080c10', scroll, 'rgba(40, 50, 60, 0.4)');
    band(w, scroll, 1, 90 * u, (x, i) => fern(ctx, x, gy + 12 * u, 26 * u, '#1c2a24', i + 9, t));
    return;
  }
  if (scene === 'trees') {
    // up in the canopy: the ground here is a great branch
    sky(ctx, w, h, '#9ccbe0', '#dfeccc', h);
    band(w, scroll, 0.12, 110 * u, (x, i) => broadTree(ctx, x, h, 70 * u, '#5a6a4a', 'rgba(110, 150, 90, 0.7)', i));
    band(w, scroll, 0.3, 150 * u, (x, i) => {
      for (let j = 0; j < 3; j++) leafCluster(ctx, x + hash(i, j) * 120 * u, gy * (0.15 + hash(i, j + 5) * 0.45), (40 + hash(i, j + 9) * 30) * u, 'rgba(70, 120, 60, 0.9)', i * 5 + j);
    });
    // the branch
    const bg = ctx.createLinearGradient(0, gy - 4 * u, 0, gy + 26 * u);
    bg.addColorStop(0, '#8a6a4a'); bg.addColorStop(1, '#4a3424');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(0, gy - 2 * u); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, gy - 2 * u + Math.sin((x + scroll) * 0.01) * 3 * u); ctx.lineTo(w, gy + 24 * u); ctx.lineTo(0, gy + 26 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 25, 15, 0.4)'; ctx.lineWidth = 1;
    band(w, scroll, 1, 30 * u, (x, i) => { ctx.beginPath(); ctx.moveTo(x, gy + 4 * u); ctx.lineTo(x + 20 * u, gy + 6 * u + hash(i, 1) * 10 * u); ctx.stroke(); });
    band(w, scroll, 1, 130 * u, (x, i) => {
      ctx.fillStyle = '#4a8a3a';
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x + j * 9 * u, gy + 24 * u + hash(i, j) * 16 * u, 10 * u, 5 * u, 0.6, 0, TAU); ctx.fill(); }
    });
    band(w, scroll, 1.5, 220 * u, (x, i) => leafCluster(ctx, x + hash(i, 1) * 60 * u, h - 10 * u, 60 * u, 'rgba(50, 100, 45, 0.95)', i + 70));
    return;
  }
  if (scene === 'forest') {
    sky(ctx, w, h, '#86b8a0', '#d8e6c0', gy);
    band(w, scroll, 0.12, 80 * u, (x, i) => broadTree(ctx, x, gy, 55 * u, '#5a6a50', 'rgba(90, 130, 80, 0.8)', i));
    band(w, scroll, 0.35, 130 * u, (x, i) => broadTree(ctx, x, gy, 80 * u, '#4a3a2a', '#3e6a34', i + 20));
    // vines hanging from above
    ctx.strokeStyle = 'rgba(50, 90, 40, 0.7)'; ctx.lineWidth = 2 * u;
    band(w, scroll, 0.6, 90 * u, (x, i) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(t * 0.5 + i) * 10 * u, gy * 0.3, x + 5 * u, gy * (0.3 + hash(i, 1) * 0.3)); ctx.stroke(); });
    ground(ctx, w, h, gy, '#4a5a30', '#2a3218', scroll, 'rgba(30, 40, 15, 0.4)');
    band(w, scroll, 1, 70 * u, (x, i) => fern(ctx, x, gy + 12 * u, 24 * u, '#2e5a24', i + 3, t));
    return;
  }
  if (scene === 'savanna' || scene === 'camp') {
    const dusk = scene === 'camp';
    sky(ctx, w, h, dusk ? '#2a2a5a' : '#8ec4e8', dusk ? '#f09a5a' : '#f4e6c0', gy);
    const sx = w * 0.3, sy = gy - (dusk ? 16 : 120) * u;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 120 * u);
    sg.addColorStop(0, dusk ? 'rgba(255, 200, 120, 0.8)' : 'rgba(255, 250, 220, 0.8)'); sg.addColorStop(1, 'rgba(255, 220, 160, 0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 120 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = dusk ? '#ffd08a' : '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, 16 * u, 0, TAU); ctx.fill();
    // a volcano far off: Lucy's footprints at Laetoli are pressed into its ash
    hills(ctx, w, gy, scroll, 0.05, 60 * u, dusk ? '#4a3a4a' : '#b0a890', 7);
    band(w, scroll, 0.05, 1200 * u, (x) => {
      ctx.fillStyle = dusk ? '#3a2e3a' : '#a09880';
      ctx.beginPath(); ctx.moveTo(x - 120 * u, gy - 20 * u); ctx.lineTo(x - 20 * u, gy - 130 * u); ctx.lineTo(x + 20 * u, gy - 130 * u); ctx.lineTo(x + 130 * u, gy - 20 * u); ctx.fill();
    });
    band(w, scroll, 0.3, 240 * u, (x, i) => acacia(ctx, x + hash(i, 1) * 100 * u, gy, (40 + hash(i, 2) * 20) * u, dusk ? '#2a2020' : '#5a5a34'));
    ground(ctx, w, h, gy, dusk ? '#6a5030' : '#c8aa6a', dusk ? '#3a2a18' : '#8a7040', scroll, 'rgba(90, 70, 30, 0.35)');
    grassTufts(ctx, w, gy + 6 * u, scroll, dusk ? 'rgba(90, 70, 40, 0.9)' : 'rgba(150, 130, 70, 0.9)', 16 * u, t);
    return;
  }
  if (scene === 'cave') {
    const g = ctx.createRadialGradient(w * 0.5, gy * 0.5, 20 * u, w * 0.5, gy * 0.5, Math.max(w, h) * 0.8);
    g.addColorStop(0, '#6a4a30'); g.addColorStop(0.5, '#3a281a'); g.addColorStop(1, '#120c08');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // the rock of the wall, and the paintings on it
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    band(w, scroll, 0.3, 60 * u, (x, i) => { ctx.beginPath(); ctx.ellipse(x, gy * (0.2 + hash(i, 1) * 0.6), 40 * u, 20 * u, hash(i, 2), 0, TAU); ctx.fill(); });
    band(w, scroll, 0.3, 380 * u, (x, i) => paintedAnimal(ctx, x + 60 * u, gy * (0.3 + hash(i, 1) * 0.2), 34 * u, i));
    ground(ctx, w, h, gy, '#3a2a1c', '#140e08', scroll, 'rgba(0, 0, 0, 0.3)');
    return;
  }
  // now: a clear morning over green fields, a town far off
  sky(ctx, w, h, '#6aa8e0', '#e8f0f0', gy);
  hills(ctx, w, gy, scroll, 0.05, 30 * u, '#9ab8a0', 9);
  band(w, scroll, 0.1, 50 * u, (x, i) => {
    ctx.fillStyle = 'rgba(120, 140, 160, 0.6)';
    const hh = (10 + hash(i, 1) * 30) * u;
    ctx.fillRect(x, gy - 20 * u - hh, 18 * u, hh + 20 * u);
  });
  hills(ctx, w, gy, scroll, 0.3, 24 * u, '#6a9a50', 3);
  ground(ctx, w, h, gy, '#7aaa50', '#4a7a30', scroll, 'rgba(60, 90, 30, 0.35)');
  grassTufts(ctx, w, gy + 6 * u, scroll, 'rgba(90, 140, 60, 0.9)', 12 * u, t);
}

/** An aurochs or a horse in red and black ochre, the way they were painted on cave walls. */
function paintedAnimal(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = seed % 2 ? '#8a2a18' : '#2a1a10';
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 1.05, -s * 0.25, s * 0.32, s * 0.2, -0.3, 0, TAU); ctx.fill();
  ctx.lineWidth = s * 0.14; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round';
  for (const lx of [-0.6, -0.35, 0.4, 0.65]) { ctx.beginPath(); ctx.moveTo(lx * s, s * 0.3); ctx.lineTo(lx * s + s * 0.05, s * 0.95); ctx.stroke(); }
  if (seed % 2) {
    ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.moveTo(s * 1.1, -s * 0.4); ctx.quadraticCurveTo(s * 1.3, -s * 0.9, s * 0.9, -s * 0.8); ctx.stroke();
  } else {
    ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(s * 0.7, -s * 0.35); ctx.lineTo(s * 0.9, -s * 0.55); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 1.3, s * 0.2, -s * 1.25, s * 0.6); ctx.stroke();
  ctx.restore();
}

/** A hand stencil: paint blown round a hand pressed on the wall, which leaves the hand's shape. */
export function drawHandStencil(ctx: Ctx, x: number, y: number, s: number, k: number, colour = '140, 40, 25'): void {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, -s * 0.15, s * 0.1, 0, -s * 0.15, s * 1.4);
  g.addColorStop(0, `rgba(${colour}, ${0.9 * k})`); g.addColorStop(0.6, `rgba(${colour}, ${0.6 * k})`); g.addColorStop(1, `rgba(${colour}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, TAU); ctx.fill();
  // the hand itself stays the colour of the rock
  ctx.fillStyle = `rgba(122, 90, 60, ${0.95 * k})`;
  ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.42, s * 0.5, 0, 0, TAU); ctx.fill();
  const fingers: Array<[number, number, number]> = [[-0.55, -0.1, -0.9], [-0.25, -0.62, -0.2], [0.02, -0.72, 0], [0.28, -0.66, 0.15], [0.5, -0.45, 0.35]];
  ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(122, 90, 60, ${0.95 * k})`;
  for (const [fx, fy, a] of fingers) {
    ctx.lineWidth = s * 0.17;
    ctx.beginPath(); ctx.moveTo(fx * s * 0.6, s * 0.0); ctx.lineTo(fx * s + Math.sin(a) * s * 0.1, fy * s); ctx.stroke();
  }
  ctx.restore();
}

/** The asteroid: a streak across the sky, a flash, and the dust that followed. */
export function drawImpact(ctx: Ctx, w: number, h: number, gy: number, k: number): void {
  if (k <= 0 || k >= 1) return;
  if (k < 0.35) {
    const q = k / 0.35;
    const x = w * (0.1 + q * 0.7), y = gy * (0.05 + q * 0.8);
    const g = ctx.createLinearGradient(x - w * 0.3, y - gy * 0.35, x, y);
    g.addColorStop(0, 'rgba(255, 200, 120, 0)'); g.addColorStop(1, 'rgba(255, 230, 180, 0.95)');
    ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - gy * 0.35); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
  } else {
    const q = (k - 0.35) / 0.65;
    const flash = Math.max(0, 1 - q * 5);
    ctx.fillStyle = `rgba(255, 245, 220, ${flash})`;
    ctx.fillRect(0, 0, w, h);
    // then the dust: the sky goes brown and dark, and slowly clears
    const dust = Math.sin(Math.min(1, q * 1.3) * Math.PI) * 0.8;
    ctx.fillStyle = `rgba(70, 45, 30, ${dust})`;
    ctx.fillRect(0, 0, w, h);
  }
}
