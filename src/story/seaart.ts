/**
 * The animals and the reef of the deep-sea story, drawn in code.
 *
 * Same contract as `beasts.ts`: a side view in metres, `(x, y)` the screen point of the animal's
 * middle, `s` pixels per metre at its distance, `facing` -1 for left and 1 for right. The sizes are
 * the real ones - a green sea turtle's shell about a metre long, a sperm whale about sixteen metres,
 * the anglerfish Melanocetus about eighteen centimetres - so when the whale goes by at fifteen
 * metres it is still enormous, and the anglerfish has to come within arm's length to be seen at all.
 *
 * Colours: the turtle and the whale are drawn in their known colours. The anglerfish is near black,
 * as it is; the blue-green of its lure is the colour of the light the bacteria in it make.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface SeaLook {
  facing: -1 | 1;
  /** 0..1 around one stroke of the fins or the tail */
  phase: number;
  t: number;
  /** radians, nose down positive: a whale on its way down */
  pitch?: number;
}

function begin(ctx: Ctx, x: number, y: number, s: number, look: SeaLook): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * look.facing, s);
  if (look.pitch) ctx.rotate(look.pitch);
}

function lit(ctx: Ctx, top: string, mid: string, low: string, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(1, low);
  return g;
}

/** A tiny random number from a seed and an index, the same every frame. */
function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

// ---------------------------------------------------------------- green sea turtle

/**
 * A green sea turtle, flying through the water the way they do: the long front flippers beat
 * together like wings, the short back ones steer. The shell is plates (scutes) with the pale
 * radiating streaks green turtles have; the head and flippers are covered in small scales with
 * light edges.
 */
export function drawTurtle(ctx: Ctx, x: number, y: number, s: number, look: SeaLook): void {
  const ph = look.phase * TAU;
  const beat = Math.sin(ph);
  begin(ctx, x, y, s, look);
  const skin = '#7d7a4a', skinDark = '#5a5633', scaleEdge = 'rgba(235, 225, 170, 0.55)';

  const flipper = (px: number, py: number, len: number, wid: number, rot: number, colour: string): void => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, -wid * 0.5);
    ctx.quadraticCurveTo(len * 0.5, -wid * 0.9, len, -wid * 0.1);
    ctx.quadraticCurveTo(len * 0.6, wid * 0.5, 0, wid * 0.5);
    ctx.closePath(); ctx.fill();
    // a row of scales along the leading edge
    ctx.fillStyle = 'rgba(235, 225, 170, 0.22)';
    for (let i = 1; i < 6; i++) {
      const k = i / 6;
      ctx.beginPath(); ctx.ellipse(len * k * 0.95, -wid * (0.3 - k * 0.2), wid * 0.1, wid * 0.07, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  // the far flippers, darker, behind the shell
  flipper(0.28, 0.02, 0.62, 0.2, -0.5 - beat * 0.7, skinDark);
  flipper(-0.42, 0.08, 0.22, 0.12, 2.6 + beat * 0.2, skinDark);

  // neck and head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0.5, 0.02, 0.14, 0.09, 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = lit(ctx, '#a39f68', skin, skinDark, -0.1, 0.1);
  ctx.beginPath(); ctx.ellipse(0.66, -0.01, 0.13, 0.085, -0.05, 0, TAU); ctx.fill();
  // the head scales: pale-edged plates, big on top
  ctx.strokeStyle = scaleEdge; ctx.lineWidth = 0.01;
  for (let i = 0; i < 7; i++) {
    const px = 0.58 + (i % 4) * 0.045, py = -0.05 + Math.floor(i / 4) * 0.04;
    ctx.beginPath(); ctx.rect(px, py, 0.04, 0.032); ctx.stroke();
  }
  // the beak and the mouth line
  ctx.strokeStyle = 'rgba(40, 36, 20, 0.7)'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(0.79, 0.0); ctx.quadraticCurveTo(0.72, 0.04, 0.64, 0.03); ctx.stroke();
  ctx.fillStyle = '#20180c';
  ctx.beginPath(); ctx.arc(0.71, -0.03, 0.02, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(0.705, -0.037, 0.006, 0, TAU); ctx.fill();

  // the shell: a low dome over a flat pale underside
  ctx.fillStyle = '#e2d7a0';
  ctx.beginPath(); ctx.ellipse(0, 0.07, 0.5, 0.06, 0, 0, TAU); ctx.fill();
  const shell = new Path2D();
  shell.moveTo(-0.52, 0.06);
  shell.bezierCurveTo(-0.45, -0.22, 0.3, -0.3, 0.52, 0.02);
  shell.quadraticCurveTo(0, 0.12, -0.52, 0.06);
  ctx.fillStyle = lit(ctx, '#8a7a45', '#6a5a2c', '#3f3418', -0.28, 0.1);
  ctx.fill(shell);
  ctx.save();
  ctx.clip(shell);
  // the scutes: a row along the top and a row down the side, each with pale streaks from its middle
  const scute = (cx: number, cy: number, rx: number, ry: number, seed: number): void => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, 'rgba(210, 180, 110, 0.55)'); g.addColorStop(1, 'rgba(60, 45, 20, 0.1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230, 200, 130, 0.35)'; ctx.lineWidth = 0.008;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + seed;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30, 22, 8, 0.55)'; ctx.lineWidth = 0.014;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  };
  for (let i = 0; i < 5; i++) scute(-0.36 + i * 0.18, -0.17 + Math.abs(i - 2) * 0.025, 0.1, 0.07, i);
  for (let i = 0; i < 4; i++) scute(-0.3 + i * 0.2, -0.04, 0.11, 0.06, i + 5);
  // the rim of small marginal plates
  ctx.strokeStyle = 'rgba(30, 22, 8, 0.5)'; ctx.lineWidth = 0.01;
  for (let i = 0; i < 12; i++) { const px = -0.5 + i * 0.09; ctx.beginPath(); ctx.moveTo(px, 0.02); ctx.lineTo(px + 0.02, 0.09); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(25, 20, 8, 0.4)'; ctx.lineWidth = 0.012;
  ctx.stroke(shell);

  // the near flippers, over the shell
  flipper(0.26, 0.06, 0.7, 0.22, -0.3 - beat * 0.8, skin);
  flipper(-0.44, 0.1, 0.24, 0.13, 2.8 - beat * 0.2, skin);
  ctx.restore();
}

// ---------------------------------------------------------------- sperm whale

/**
 * A sperm whale: the biggest animal with teeth, about sixteen metres. A third of it is the huge
 * square head; the lower jaw underneath is narrow as a plank and white inside. The skin behind the
 * head is wrinkled like a prune, there is a low hump instead of a proper back fin and a row of
 * knuckles down to the tail. The body bends in a slow wave that grows towards the flukes.
 */
export function drawSpermWhale(ctx: Ctx, x: number, y: number, s: number, look: SeaLook): void {
  const ph = look.phase * TAU;
  begin(ctx, x, y, s, look);
  const top = '#5b5a62', mid = '#45444c', low = '#302f36';
  // the spine: straight through the head, bending more and more towards the tail
  const n = 30;
  const spine: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, sx = 8 - k * 16;
    const bend = k < 0.35 ? 0 : Math.sin(ph - k * 4) * (k - 0.35) * 1.4;
    spine.push([sx, bend]);
  }
  // half-height of the body along it: the block of the head, then a taper to the tail stock
  const half = (k: number): number => {
    if (k < 0.04) return 1.2 + k * 10;
    if (k < 0.33) return 1.6;
    return 1.6 * Math.pow(1 - (k - 0.33) / 0.67, 1.3) + 0.18;
  };
  const upper: Array<[number, number]> = [], lower: Array<[number, number]> = [];
  spine.forEach(([sx, sy], i) => {
    const k = i / n, hh = half(k);
    // the head's top is flat and square, the belly rounder
    upper.push([sx, sy - hh * (k < 0.33 ? 1.05 : 1)]);
    lower.push([sx, sy + hh * 0.95]);
  });
  // the far flipper
  ctx.fillStyle = low;
  ctx.save(); ctx.translate(2.4, 1.3); ctx.rotate(0.6 + Math.sin(ph) * 0.1);
  ctx.beginPath(); ctx.ellipse(0.6, 0, 0.8, 0.28, 0, 0, TAU); ctx.fill(); ctx.restore();

  const body = new Path2D();
  upper.forEach(([px, py], i) => (i ? body.lineTo(px, py) : body.moveTo(px, py)));
  for (let i = lower.length - 1; i >= 0; i--) body.lineTo(lower[i][0], lower[i][1]);
  body.closePath();
  ctx.fillStyle = lit(ctx, top, mid, low, -1.8, 1.6);
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // the wrinkles behind the head
  ctx.strokeStyle = 'rgba(20, 20, 26, 0.35)'; ctx.lineWidth = 0.05;
  for (let r = 0; r < 9; r++) {
    const yy = -1.1 + r * 0.28;
    ctx.beginPath();
    for (let xx = 2.4; xx > -5; xx -= 0.3) {
      const k = (8 - xx) / 16, i = Math.round(k * n);
      const by = spine[Math.min(n, Math.max(0, i))][1];
      const wy = by + yy * (half(k) / 1.6) + Math.sin(xx * 3 + r) * 0.05;
      if (xx === 2.4) ctx.moveTo(xx, wy); else ctx.lineTo(xx, wy);
    }
    ctx.stroke();
  }
  // pale scars on the head: the marks of fights with giant squid
  ctx.strokeStyle = 'rgba(210, 210, 215, 0.35)'; ctx.lineWidth = 0.04;
  for (let i = 0; i < 8; i++) {
    const px = 3 + hash(i, 2) * 4.6, py = -1.4 + hash(i, 7) * 2.2, len = 0.4 + hash(i, 5) * 0.8;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + len * 0.5, py - 0.1, px + len, py + 0.05); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(245, 240, 230, 0.12)';
  ctx.beginPath(); ctx.ellipse(4.5, -1.3, 3.5, 0.25, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(15, 15, 20, 0.5)'; ctx.lineWidth = 0.05;
  ctx.stroke(body);

  // the hump and the knuckles along the back
  const at = (xx: number): [number, number] => {
    const k = (8 - xx) / 16, i = Math.min(n, Math.max(0, Math.round(k * n)));
    return [xx, upper[i][1]];
  };
  ctx.fillStyle = mid;
  const hump = at(-2.2);
  ctx.beginPath(); ctx.moveTo(hump[0] + 0.9, hump[1] + 0.1); ctx.quadraticCurveTo(hump[0], hump[1] - 0.5, hump[0] - 0.8, hump[1] + 0.1); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const kn = at(-3.4 - i * 0.7);
    ctx.beginPath(); ctx.arc(kn[0], kn[1] + 0.05, 0.13, Math.PI, 0); ctx.fill();
  }

  // the lower jaw: a narrow plank under the head, white along its edge
  ctx.fillStyle = '#e8e4dc';
  ctx.beginPath(); ctx.moveTo(1.9, 1.35); ctx.lineTo(6.8, 1.45); ctx.quadraticCurveTo(7.0, 1.6, 6.7, 1.7); ctx.lineTo(1.9, 1.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = low;
  ctx.beginPath(); ctx.moveTo(1.9, 1.5); ctx.lineTo(6.7, 1.58); ctx.quadraticCurveTo(6.9, 1.68, 6.6, 1.75); ctx.lineTo(1.9, 1.7); ctx.closePath(); ctx.fill();
  // the corner of the mouth, and the small eye just behind it
  ctx.strokeStyle = 'rgba(15, 15, 20, 0.7)'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.moveTo(1.9, 1.4); ctx.quadraticCurveTo(1.6, 1.3, 1.5, 1.15); ctx.stroke();
  ctx.fillStyle = '#15141a';
  ctx.beginPath(); ctx.ellipse(1.35, 0.85, 0.12, 0.08, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(1.32, 0.82, 0.03, 0, TAU); ctx.fill();
  // the blowhole, off to the left at the front of the head, as a sperm whale's is
  ctx.fillStyle = low;
  ctx.beginPath(); ctx.ellipse(7.4, upper[1][1] + 0.05, 0.18, 0.05, 0, 0, TAU); ctx.fill();

  // the near flipper
  ctx.fillStyle = mid;
  ctx.save(); ctx.translate(2.2, 1.2); ctx.rotate(0.5 + Math.sin(ph) * 0.12);
  ctx.beginPath(); ctx.ellipse(0.6, 0, 0.8, 0.28, 0, 0, TAU); ctx.fill(); ctx.restore();

  // the flukes: broad and triangular, seen a little from above as they beat
  const [tx, ty] = spine[n];
  const flap = Math.cos(ph - 4) * 0.5;
  ctx.fillStyle = lit(ctx, top, mid, low, ty - 1, ty + 1);
  ctx.beginPath();
  ctx.moveTo(tx + 0.6, ty);
  ctx.quadraticCurveTo(tx - 0.6, ty - 1.9 * (0.6 + flap), tx - 1.9, ty - 1.7 * (0.6 + flap));
  ctx.quadraticCurveTo(tx - 1.0, ty, tx - 1.9, ty + 1.7 * (0.6 - flap));
  ctx.quadraticCurveTo(tx - 0.6, ty + 1.9 * (0.6 - flap), tx + 0.6, ty);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- anglerfish

/** Where the anglerfish's lure is on screen, for drawing its glow over the dark. */
export function lurePoint(x: number, y: number, s: number, look: SeaLook): { x: number; y: number } {
  const sway = Math.sin(look.t * 1.3) * 0.006;
  return { x: x + look.facing * (0.15 + sway) * s, y: y - 0.115 * s };
}

/**
 * A female Melanocetus, the humpback anglerfish: a round black body the size of a banana, a mouth
 * almost as wide as herself full of long thin see-through teeth, a tiny eye, and on her head a
 * spine grown into a fishing rod with a lamp at the end. The lamp glows because bacteria live in it.
 * `seen` is how much light is on her (the lamps): the teeth catch it first.
 */
export function drawAnglerfish(ctx: Ctx, x: number, y: number, s: number, look: SeaLook, seen = 1): void {
  const ph = look.phase * TAU;
  begin(ctx, x, y, s, look);
  const skin = '#2e2624', skinLit = '#54443d', dark = '#141010';
  // the tail fin, fanning slowly
  const wag = Math.sin(ph) * 0.25;
  ctx.fillStyle = '#3a2f2c';
  ctx.save(); ctx.translate(-0.07, 0.0); ctx.rotate(wag);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.04, -0.028); ctx.quadraticCurveTo(-0.048, 0, -0.04, 0.028); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.002;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.042, i * 0.012); ctx.stroke(); }
  ctx.restore();
  // the body: a ball with a hump on the back, cut open at the front by the enormous mouth
  const upperTip: [number, number] = [0.075, -0.018];
  const lowerTip: [number, number] = [0.088, 0.042];
  const corner: [number, number] = [0.018, 0.012];
  const body = new Path2D();
  body.moveTo(-0.07, 0.0);
  body.bezierCurveTo(-0.07, -0.07, 0.02, -0.095, 0.06, -0.055);
  body.quadraticCurveTo(0.08, -0.04, upperTip[0], upperTip[1]);
  body.lineTo(corner[0], corner[1]);
  body.lineTo(lowerTip[0], lowerTip[1]);
  body.bezierCurveTo(0.075, 0.075, 0.0, 0.08, -0.035, 0.06);
  body.quadraticCurveTo(-0.07, 0.045, -0.07, 0.0);
  ctx.fillStyle = lit(ctx, skinLit, skin, dark, -0.09, 0.08);
  ctx.fill(body);
  ctx.save(); ctx.clip(body);
  // velvety skin: tiny darker specks, and a few pale threads (the lateral line)
  ctx.fillStyle = 'rgba(10, 6, 6, 0.45)';
  for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(-0.07 + hash(i, 1) * 0.16, -0.09 + hash(i, 4) * 0.17, 0.0018 + hash(i, 9) * 0.002, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(200, 180, 170, 0.18)'; ctx.lineWidth = 0.002;
  ctx.beginPath(); ctx.moveTo(-0.06, 0.0); ctx.quadraticCurveTo(-0.01, -0.02, 0.03, -0.03); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 230, 220, 0.09)';
  ctx.beginPath(); ctx.ellipse(-0.01, -0.065, 0.05, 0.014, -0.2, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.002; ctx.stroke(body);
  // the inside of the mouth, dark red-black
  ctx.fillStyle = '#1a0708';
  ctx.beginPath(); ctx.moveTo(upperTip[0], upperTip[1]); ctx.lineTo(corner[0], corner[1]); ctx.lineTo(lowerTip[0], lowerTip[1]); ctx.quadraticCurveTo(0.075, 0.012, upperTip[0], upperTip[1]); ctx.fill();
  // the teeth: long, thin and glassy, pointing back into the mouth, longest at the front
  ctx.strokeStyle = `rgba(235, 242, 248, ${0.3 + 0.65 * seen})`; ctx.lineCap = 'round'; ctx.lineWidth = 0.0028;
  for (let i = 0; i < 7; i++) {
    const k = i / 6, len = 0.024 - k * 0.012;
    const ux = upperTip[0] + (corner[0] - upperTip[0]) * k, uy = upperTip[1] + (corner[1] - upperTip[1]) * k;
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.quadraticCurveTo(ux - 0.002, uy + len * 0.6, ux - 0.007, uy + len); ctx.stroke();
    const lx = lowerTip[0] + (corner[0] - lowerTip[0]) * k, ly = lowerTip[1] + (corner[1] - lowerTip[1]) * k;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx - 0.002, ly - len * 0.6, lx - 0.008, ly - len); ctx.stroke();
  }
  // the tiny eye, high up behind the mouth
  ctx.fillStyle = '#7d98ad';
  ctx.beginPath(); ctx.arc(0.042, -0.04, 0.0065, 0, TAU); ctx.fill();
  ctx.fillStyle = '#05080a';
  ctx.beginPath(); ctx.arc(0.043, -0.04, 0.0038, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(0.041, -0.042, 0.0015, 0, TAU); ctx.fill();
  // the side fin, fanning
  ctx.fillStyle = 'rgba(80, 64, 58, 0.95)';
  ctx.save(); ctx.translate(-0.012, 0.03); ctx.rotate(0.4 + Math.sin(ph * 2) * 0.35);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.035, -0.017); ctx.quadraticCurveTo(-0.042, 0.005, -0.03, 0.022); ctx.closePath(); ctx.fill();
  ctx.restore();
  // the rod, from the top of the head arching forward, and the lamp at its end
  const sway = Math.sin(look.t * 1.3) * 0.006;
  ctx.strokeStyle = skinLit; ctx.lineWidth = 0.0035;
  ctx.beginPath(); ctx.moveTo(0.035, -0.075); ctx.quadraticCurveTo(0.08, -0.16, 0.15 + sway, -0.115); ctx.stroke();
  ctx.fillStyle = '#e4fdff';
  ctx.beginPath(); ctx.arc(0.15 + sway, -0.115, 0.008, 0, TAU); ctx.fill();
  ctx.restore();
}

/** The lamp's glow, drawn over the darkness so it is seen whether the lamps are on or off. */
export function drawLureGlow(ctx: Ctx, x: number, y: number, r: number, k: number): void {
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(215, 255, 255, ${k})`);
  g.addColorStop(0.15, `rgba(120, 240, 255, ${0.7 * k})`);
  g.addColorStop(1, 'rgba(60, 200, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the reef

export type CoralKind = 'branch' | 'brain' | 'fan' | 'tube' | 'anemone';

/**
 * A piece of reef standing on the sand, `(x, y)` its foot and `s` pixels per metre. Staghorn
 * coral, brain coral, a sea fan, tube sponges, and an anemone with two clownfish living in it.
 */
export function drawCoral(ctx: Ctx, x: number, y: number, s: number, kind: CoralKind, seed: number, t: number, size = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * size, s * size);
  const r = (i: number): number => hash(i, seed * 17);
  if (kind === 'branch') {
    const colour = ['#e59a74', '#c77fb5', '#e8c46a'][Math.floor(r(0) * 3)];
    ctx.strokeStyle = colour; ctx.lineCap = 'round';
    const branch = (bx: number, by: number, a: number, len: number, w: number, depth: number, i: number): void => {
      const ex = bx + Math.sin(a) * len, ey = by - Math.cos(a) * len;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      if (depth <= 0) { ctx.fillStyle = '#fff2dc'; ctx.beginPath(); ctx.arc(ex, ey, w * 0.45, 0, TAU); ctx.fill(); return; }
      branch(ex, ey, a - 0.35 - r(i) * 0.3, len * 0.75, w * 0.75, depth - 1, i * 2 + 1);
      branch(ex, ey, a + 0.35 + r(i + 9) * 0.3, len * 0.75, w * 0.75, depth - 1, i * 2 + 2);
    };
    for (let k = 0; k < 3; k++) branch((k - 1) * 0.12, 0, (k - 1) * 0.4, 0.22, 0.06, 3, k + 1);
  } else if (kind === 'brain') {
    const g = ctx.createRadialGradient(-0.08, -0.22, 0.02, 0, -0.1, 0.4);
    g.addColorStop(0, '#e9dca0'); g.addColorStop(1, '#9c8a4a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.36, 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, 0.36, 0.3, 0, Math.PI, 0); ctx.clip();
    // the maze of grooves that gives it its name
    ctx.strokeStyle = 'rgba(90, 70, 30, 0.55)'; ctx.lineWidth = 0.018;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      const yy = -0.28 + k * 0.045;
      for (let xx = -0.38; xx <= 0.38; xx += 0.02) {
        const wy = yy + Math.sin(xx * 30 + k * 2 + seed) * 0.014;
        if (xx === -0.38) ctx.moveTo(xx, wy); else ctx.lineTo(xx, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (kind === 'fan') {
    const sway = Math.sin(t * 0.8 + seed) * 0.06;
    ctx.rotate(sway);
    ctx.strokeStyle = '#b8406a'; ctx.lineWidth = 0.012;
    // a flat lattice: ribs out from the foot, and cross-threads between them
    const ribs = 9;
    const tip = (k: number): [number, number] => { const a = -0.9 + (k / (ribs - 1)) * 1.8; return [Math.sin(a) * 0.55, -Math.cos(a) * 0.6 - 0.1]; };
    for (let k = 0; k < ribs; k++) { const [tx, ty] = tip(k); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(tx * 0.4, ty * 0.6, tx, ty); ctx.stroke(); }
    ctx.lineWidth = 0.006; ctx.strokeStyle = 'rgba(210, 90, 130, 0.8)';
    for (let ring = 1; ring < 6; ring++) {
      const q = ring / 6;
      ctx.beginPath();
      for (let k = 0; k < ribs; k++) { const [tx, ty] = tip(k); const px = tx * q, py = ty * q; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    }
  } else if (kind === 'tube') {
    const colour = ['#f08a3c', '#e8d04a', '#9a6ad0'][Math.floor(r(1) * 3)];
    for (let k = 0; k < 4; k++) {
      const tx = (k - 1.5) * 0.09 + (r(k + 3) - 0.5) * 0.04, th = 0.25 + r(k + 7) * 0.3, tw = 0.035 + r(k) * 0.02;
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.moveTo(tx - tw, 0); ctx.lineTo(tx - tw * 1.2, -th); ctx.lineTo(tx + tw * 1.2, -th); ctx.lineTo(tx + tw, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(40, 20, 10, 0.55)';
      ctx.beginPath(); ctx.ellipse(tx, -th, tw * 1.1, tw * 0.35, 0, 0, TAU); ctx.fill();
    }
  } else {
    // an anemone: a squat column and a crown of waving tentacles, and its two clownfish
    ctx.fillStyle = '#b86a8a';
    ctx.beginPath(); ctx.ellipse(0, -0.05, 0.12, 0.07, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f0b8d0'; ctx.lineCap = 'round'; ctx.lineWidth = 0.028;
    for (let k = 0; k < 16; k++) {
      const a = -1.3 + (k / 15) * 2.6, len = 0.16 + r(k) * 0.06;
      const bx = Math.sin(a) * 0.1, by = -0.08;
      const wv = Math.sin(t * 1.6 + k * 0.7) * 0.05;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.sin(a) * len * 0.5 + wv, by - len * 0.6, bx + Math.sin(a) * len + wv * 1.5, by - len); ctx.stroke();
    }
    for (let f = 0; f < 2; f++) {
      const fx = Math.sin(t * 0.9 + f * 2.5) * 0.18, fy = -0.3 - f * 0.06 + Math.sin(t * 1.4 + f) * 0.03;
      const face = Math.cos(t * 0.9 + f * 2.5) > 0 ? 1 : -1;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(face, 1);
      ctx.fillStyle = '#f07a1e';
      ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.025, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.04, 0); ctx.lineTo(-0.07, -0.02); ctx.lineTo(-0.07, 0.02); ctx.closePath(); ctx.fill();
      // the three white bands, edged in black
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.004;
      for (const bx of [0.025, 0, -0.03]) { ctx.beginPath(); ctx.rect(bx - 0.006, -0.022, 0.012, 0.044); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(0.035, -0.006, 0.005, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}
