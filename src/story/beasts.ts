/**
 * The animals of the story journey, drawn in code and made to move.
 *
 * Each is a side view built from a few parts in metres - a body, a tail, a neck and head, legs -
 * and each leg is a real two-bone leg: the foot is put on the ground where a walking animal puts
 * it, and the knee finds its own place between hip and foot. That is what makes a drawn animal
 * walk instead of slide: the feet stay where they land while the body goes over them. The tail
 * swings against the steps and the whole animal breathes, so nothing stands still like a sticker.
 *
 * The sizes are the animals' real ones (a T. rex about twelve metres long with its hips a little
 * over three metres up, a Triceratops about eight metres, a woolly mammoth about three metres at
 * the shoulder, a Mosasaurus about fifteen metres), so side by side in a scene they are as big
 * against each other as they were. The colours are a guess, and nobody knows them: skin does not
 * fossilise its colour. They are chosen to be believable, not claimed.
 *
 * `draw*(ctx, x, y, s, look)`: (x, y) is the point on the ground under the animal's hips, `s` is
 * pixels per metre at its distance, `look.facing` is -1 for left and 1 for right.
 */

type Ctx = CanvasRenderingContext2D;
type P = [number, number];

export interface BeastLook {
  facing: -1 | 1;
  /** 0..1 around one full stride; advance it with the distance walked */
  phase: number;
  /** seconds, for breathing and the idle sway */
  t: number;
  /** 0 shut .. 1 wide, for a roar or a bite */
  jaw?: number;
  /** -1 head down (sniffing, grazing) .. 1 head up */
  head?: number;
  /** a colour to mix in for distance haze, and how much of it */
  haze?: string;
  hazeK?: number;
}

/** Where a knee goes between a hip and a foot, bending the way `bend` says (1 forward, -1 back). */
function knee(h: P, f: P, a: number, b: number, bend: number): P {
  const dx = f[0] - h[0], dy = f[1] - h[1];
  const d = Math.min(Math.hypot(dx, dy), a + b - 1e-4);
  const t = Math.atan2(dy, dx);
  const c = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k = t - bend * c;
  return [h[0] + Math.cos(k) * a, h[1] + Math.sin(k) * a];
}

/** Where a foot is at a point in its stride: back along the ground, then lifted forward again. */
function foot(hipX: number, reach: number, lift: number, phase: number): P {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.6) return [hipX + reach - (p / 0.6) * 2 * reach, 0];
  const k = (p - 0.6) / 0.4;
  return [hipX - reach + k * 2 * reach, -Math.sin(k * Math.PI) * lift];
}

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function paint(look: BeastLook, c: string): string {
  return look.haze && look.hazeK ? mixHex(c, look.haze, look.hazeK) : c;
}

/**
 * Light from above: the top of a part a shade lighter than its colour and the underside a shade
 * darker, which is what turns a flat shape into a round body. `y0`..`y1` is the part's height in
 * the animal's own metres.
 */
function lit(ctx: Ctx, colour: string, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shadeRgb(colour, 0.22));
  g.addColorStop(0.55, colour);
  g.addColorStop(1, shadeRgb(colour, -0.28));
  return g;
}

function shadeRgb(c: string, k: number): string {
  const m = c.match(/\d+/g);
  let r: number, g: number, b: number;
  if (c.startsWith('#')) { const v = parseInt(c.slice(1), 16); r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; }
  else if (m) { [r, g, b] = m.map(Number); } else return c;
  const f = (x: number): number => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function limb(ctx: Ctx, pts: P[], w0: number, w1: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = w0 + (w1 - w0) * (i / Math.max(1, pts.length - 2));
    ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
  }
}

function begin(ctx: Ctx, x: number, y: number, s: number, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);
}

function shadow(ctx: Ctx, cx: number, rx: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, 0.02, rx, rx * 0.12, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- Tyrannosaurus rex

export function drawTRex(ctx: Ctx, x: number, y: number, s: number, look: BeastLook): void {
  const skin = paint(look, '#6d7446'), back = paint(look, '#4c5332'), belly = paint(look, '#b6a57a');
  const far = paint(look, '#555c37');
  const ph = look.phase, t = look.t;
  const bob = -Math.abs(Math.cos(ph * Math.PI * 2)) * 0.1;
  const breath = Math.sin(t * 1.6) * 0.04;
  const hip: P = [0, -3.25 + bob];
  begin(ctx, x, y, s, look.facing);
  shadow(ctx, 0, 3.4);

  // the far leg first, darker, half a stride out of step
  const legs = (phase: number, colour: string, dx: number): void => {
    const h: P = [hip[0] + dx, hip[1] + 0.25];
    const f = foot(h[0] + 0.25, 1.1, 0.45, phase);
    const k = knee(h, [f[0] - 0.2, f[1] - 0.45], 1.7, 1.6, -1);
    const ankle: P = [f[0] - 0.2, f[1] - 0.45];
    // a thick thigh, a thinner shin, and the long foot with its toes
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.ellipse((h[0] + k[0]) / 2, (h[1] + k[1]) / 2, 0.55, 1.05, Math.atan2(k[1] - h[1], k[0] - h[0]) + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    limb(ctx, [k, ankle], 0.5, 0.35, colour);
    limb(ctx, [ankle, [f[0] + 0.55, f[1]]], 0.3, 0.2, colour);
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.ellipse(f[0] + 0.35, f[1] - 0.05, 0.55, 0.12, 0, 0, Math.PI * 2); ctx.fill();
  };
  legs(ph + 0.5, far, -0.2);

  // the tail, swinging a little against the steps
  const sway = Math.sin(ph * Math.PI * 2) * 0.18 + Math.sin(t * 0.9) * 0.06;
  ctx.fillStyle = lit(ctx, skin, hip[1] - 1.5, hip[1] + 1.1);
  ctx.beginPath();
  ctx.moveTo(-0.6, hip[1] - 0.75);
  ctx.quadraticCurveTo(-3.5, hip[1] - 0.6 + sway * 0.5, -6.8, hip[1] + 0.1 + sway);
  ctx.quadraticCurveTo(-3.5, hip[1] + 0.25 + sway * 0.5, -0.6, hip[1] + 0.55);
  ctx.closePath(); ctx.fill();

  // the body, breathing
  ctx.beginPath();
  ctx.moveTo(-1.2, hip[1] - 0.8);
  ctx.quadraticCurveTo(0.8, hip[1] - 1.45 - breath, 2.6, hip[1] - 0.95);
  ctx.quadraticCurveTo(3.1, hip[1] - 0.2, 2.4, hip[1] + 0.5);
  ctx.quadraticCurveTo(0.8, hip[1] + 1.1 + breath, -1.0, hip[1] + 0.6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(-0.6, hip[1] + 0.55);
  ctx.quadraticCurveTo(0.9, hip[1] + 1.05 + breath, 2.3, hip[1] + 0.45);
  ctx.quadraticCurveTo(1.0, hip[1] + 0.7, -0.6, hip[1] + 0.55);
  ctx.fill();
  // stripes along the back
  ctx.fillStyle = back;
  for (let i = 0; i < 7; i++) {
    const bx = -4.5 + i * 1.05, by = hip[1] - (i < 4 ? 0.62 + i * 0.12 : 1.1 - (i - 4) * 0.12);
    ctx.beginPath(); ctx.ellipse(bx, by, 0.28, 0.14, 0.2, 0, Math.PI * 2); ctx.fill();
  }

  // the neck and the head, which drops to sniff and lifts to roar
  const hd = look.head ?? 0;
  const neckTop: P = [3.0, hip[1] - 1.1 - hd * 0.35];
  ctx.fillStyle = lit(ctx, skin, hip[1] - 1.8, hip[1] + 0.4);
  ctx.beginPath();
  ctx.moveTo(2.0, hip[1] - 0.95);
  ctx.quadraticCurveTo(2.7, hip[1] - 1.5 - hd * 0.3, neckTop[0] + 0.3, neckTop[1] - 0.2);
  ctx.lineTo(neckTop[0] + 0.5, neckTop[1] + 0.6);
  ctx.quadraticCurveTo(2.6, hip[1] - 0.1, 2.2, hip[1] + 0.3);
  ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(neckTop[0] + 0.1, neckTop[1]);
  ctx.rotate(-hd * 0.25);
  // a T. rex skull was about a metre and a half long: most of the animal's front end is head
  ctx.scale(1.25, 1.25);
  const jaw = (look.jaw ?? 0) * 0.5;
  // lower jaw
  ctx.save();
  ctx.translate(0.2, 0.25);
  ctx.rotate(jaw);
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.55, 0.05); ctx.quadraticCurveTo(1.6, 0.3, 1.3, 0.38); ctx.lineTo(0.1, 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2ead2';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0.35 + i * 0.2, 0.02); ctx.lineTo(0.43 + i * 0.2, -0.12); ctx.lineTo(0.5 + i * 0.2, 0.02); ctx.fill(); }
  ctx.restore();
  // skull
  ctx.fillStyle = lit(ctx, skin, -0.75, 0.35);
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.45);
  ctx.quadraticCurveTo(0.7, -0.75, 1.6, -0.35);
  ctx.quadraticCurveTo(1.95, -0.1, 1.85, 0.25);
  ctx.lineTo(0.1, 0.35);
  ctx.quadraticCurveTo(-0.35, 0.1, -0.2, -0.45);
  ctx.fill();
  ctx.fillStyle = '#f2ead2';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(0.3 + i * 0.2, 0.25); ctx.lineTo(0.38 + i * 0.2, 0.42); ctx.lineTo(0.46 + i * 0.2, 0.25); ctx.fill(); }
  ctx.fillStyle = back;
  ctx.beginPath(); ctx.ellipse(0.9, -0.5, 0.45, 0.1, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2016';
  ctx.beginPath(); ctx.arc(0.45, -0.3, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c048';
  ctx.beginPath(); ctx.arc(0.47, -0.32, 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2016';
  ctx.beginPath(); ctx.arc(1.7, -0.18, 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // the famous small arms, which were small but strong
  limb(ctx, [[2.3, hip[1] - 0.2], [2.7, hip[1] + 0.15], [2.95, hip[1] + 0.05]], 0.2, 0.12, far);

  legs(ph, skin, 0.1);
  ctx.restore();
}

// ---------------------------------------------------------------- Triceratops

export function drawTriceratops(ctx: Ctx, x: number, y: number, s: number, look: BeastLook): void {
  const skin = paint(look, '#8a7650'), dark = paint(look, '#66563a'), frill = paint(look, '#b8674a');
  const far = paint(look, '#6f5f40');
  const ph = look.phase, t = look.t;
  const breath = Math.sin(t * 1.3) * 0.04;
  const hipY = -2.0 - Math.abs(Math.sin(ph * Math.PI * 2)) * 0.05;
  begin(ctx, x, y, s, look.facing);
  shadow(ctx, 0.5, 3.4);
  const leg = (hx: number, phase: number, colour: string, len: number): void => {
    const h: P = [hx, hipY + 0.4];
    const f = foot(hx, 0.6, 0.3, phase);
    const k = knee(h, f, len * 0.5, len * 0.55, 1);
    limb(ctx, [h, k, f], 0.55, 0.42, colour);
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.ellipse(f[0] + 0.05, f[1] - 0.06, 0.3, 0.1, 0, 0, Math.PI * 2); ctx.fill();
  };
  leg(-0.9, ph + 0.5, far, 2.0); leg(1.9, ph, far, 1.7);
  // tail
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-1.4, hipY - 0.6);
  ctx.quadraticCurveTo(-3.2, hipY - 0.1 + Math.sin(t) * 0.1, -4.2, hipY + 0.6);
  ctx.quadraticCurveTo(-3.0, hipY + 0.4, -1.4, hipY + 0.6);
  ctx.fill();
  // body: a barrel, highest at the hips
  ctx.fillStyle = lit(ctx, skin, hipY - 1.5, hipY + 1.2);
  ctx.beginPath();
  ctx.moveTo(-1.8, hipY);
  ctx.quadraticCurveTo(-1.6, hipY - 1.5 - breath, 0.6, hipY - 1.4 - breath);
  ctx.quadraticCurveTo(2.4, hipY - 1.2, 2.9, hipY - 0.2);
  ctx.quadraticCurveTo(2.7, hipY + 1.1, 0.6, hipY + 1.15);
  ctx.quadraticCurveTo(-1.6, hipY + 1.0, -1.8, hipY);
  ctx.fill();
  ctx.fillStyle = dark;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-1.2 + i * 0.7, hipY - 1.15 + Math.abs(i - 2.5) * 0.06, 0.22, 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
  // head: the frill, three horns and a beak
  const hd = look.head ?? 0;
  ctx.save();
  ctx.translate(2.9, hipY - 0.2 + (hd < 0 ? -hd * 0.5 : 0));
  ctx.rotate(hd < 0 ? -hd * 0.35 : -hd * 0.15);
  ctx.fillStyle = frill;
  ctx.beginPath(); ctx.ellipse(-0.1, -0.6, 0.75, 1.0, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark;
  for (let i = 0; i < 6; i++) {
    const a = -2.4 + i * 0.36;
    ctx.beginPath(); ctx.arc(-0.1 + Math.cos(a) * 0.95, -0.6 + Math.sin(a) * 1.05, 0.09, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0, -0.6); ctx.quadraticCurveTo(0.9, -0.7, 1.35, 0.05);
  ctx.lineTo(1.5, 0.35); ctx.quadraticCurveTo(0.8, 0.55, 0.1, 0.35);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a3226';
  ctx.beginPath(); ctx.moveTo(1.3, 0.0); ctx.lineTo(1.62, 0.3); ctx.lineTo(1.25, 0.38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#efe5c8';
  ctx.beginPath(); ctx.moveTo(0.35, -0.55); ctx.quadraticCurveTo(0.9, -1.3, 1.6, -1.6); ctx.quadraticCurveTo(1.0, -1.1, 0.6, -0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.55, -0.6); ctx.quadraticCurveTo(1.0, -1.25, 1.75, -1.45); ctx.quadraticCurveTo(1.1, -1.0, 0.75, -0.5); ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(1.0, -0.2); ctx.quadraticCurveTo(1.25, -0.6, 1.2, -0.75); ctx.quadraticCurveTo(1.3, -0.4, 1.2, -0.12); ctx.fill();
  ctx.fillStyle = '#231a12';
  ctx.beginPath(); ctx.arc(0.55, -0.2, 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  leg(-0.7, ph, skin, 2.0); leg(2.1, ph + 0.5, skin, 1.7);
  ctx.restore();
}

// ---------------------------------------------------------------- woolly mammoth

export function drawMammoth(ctx: Ctx, x: number, y: number, s: number, look: BeastLook): void {
  const fur = paint(look, '#6e4a2c'), dark = paint(look, '#4d321d'), farC = paint(look, '#5a3c24');
  const ph = look.phase, t = look.t;
  const breath = Math.sin(t * 1.2) * 0.03;
  const top = -3.1;
  begin(ctx, x, y, s, look.facing);
  shadow(ctx, 0.3, 2.4);
  const leg = (hx: number, phase: number, colour: string): void => {
    const f = foot(hx, 0.45, 0.2, phase);
    const h: P = [hx, -1.6];
    const k = knee(h, f, 0.85, 0.85, 1);
    limb(ctx, [h, k, f], 0.62, 0.55, colour);
    ctx.fillStyle = paint(look, '#3a2818');
    ctx.beginPath(); ctx.ellipse(f[0], f[1] - 0.05, 0.3, 0.08, 0, 0, Math.PI * 2); ctx.fill();
  };
  leg(-1.0, ph + 0.5, farC); leg(1.1, ph, farC);
  // body: a high domed back sloping down to the tail, all fur
  ctx.fillStyle = lit(ctx, fur, top, -0.9);
  ctx.beginPath();
  ctx.moveTo(-1.6, -1.3);
  ctx.quadraticCurveTo(-1.8, -2.8, -0.2, top - breath);
  ctx.quadraticCurveTo(1.4, top - 0.25, 1.9, -2.2);
  ctx.quadraticCurveTo(2.0, -1.0, 1.2, -1.0);
  ctx.lineTo(-1.2, -1.0);
  ctx.closePath(); ctx.fill();
  // shaggy fringe along the belly
  ctx.strokeStyle = dark; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const fx = -1.5 + i * 0.22, sw = Math.sin(t * 2 + i) * 0.05;
    ctx.beginPath(); ctx.moveTo(fx, -1.1); ctx.lineTo(fx + sw, -0.72 - (i % 3) * 0.06); ctx.stroke();
  }
  // head: a dome, a small ear, the trunk swinging, and the tusks
  ctx.fillStyle = lit(ctx, fur, -3.35, -1.75);
  ctx.beginPath(); ctx.ellipse(1.95, -2.55, 0.75, 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(1.55, -2.4, 0.22, 0.32, 0, 0, Math.PI * 2); ctx.fill();
  const swing = Math.sin(t * 1.3 + ph * 2) * 0.25 + (look.head ?? 0) * -0.3;
  ctx.strokeStyle = fur; ctx.lineWidth = 0.34;
  ctx.beginPath(); ctx.moveTo(2.5, -2.3); ctx.quadraticCurveTo(2.9 + swing * 0.3, -1.4, 2.6 + swing, -0.5); ctx.stroke();
  ctx.lineWidth = 0.22;
  ctx.beginPath(); ctx.moveTo(2.6 + swing, -0.5); ctx.lineTo(2.75 + swing, -0.3); ctx.stroke();
  ctx.strokeStyle = '#efe4c6'; ctx.lineWidth = 0.18;
  ctx.beginPath(); ctx.moveTo(2.35, -2.0); ctx.bezierCurveTo(3.0, -1.2, 3.9, -1.6, 3.6, -2.6); ctx.stroke();
  ctx.fillStyle = '#1e140c';
  ctx.beginPath(); ctx.arc(2.25, -2.75, 0.07, 0, Math.PI * 2); ctx.fill();
  leg(-0.8, ph, fur); leg(1.3, ph + 0.5, fur);
  ctx.restore();
}

// ---------------------------------------------------------------- Mosasaurus

/** A swimmer, so `y` is the height of its middle rather than the ground, and `phase` is its wave. */
export function drawMosasaur(ctx: Ctx, x: number, y: number, s: number, look: BeastLook): void {
  const skin = paint(look, '#4a6a7c'), belly = paint(look, '#c9d6c8'), dark = paint(look, '#34505e');
  const ph = look.phase * Math.PI * 2;
  begin(ctx, x, y, s, look.facing);
  // the spine: a wave that grows towards the tail, which is how it swam
  const n = 24, len = 14;
  const spine: P[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, sx = 6 - k * len;
    spine.push([sx, Math.sin(ph - k * 5) * (0.1 + k * 0.7)]);
  }
  const thick = (k: number): number => (k < 0.15 ? 0.3 + k * 4.5 : 0.95 * (1 - (k - 0.15) / 0.85) + 0.06);
  const top: P[] = [], bot: P[] = [];
  spine.forEach((p, i) => { const k = i / n, w = thick(k); top.push([p[0], p[1] - w]); bot.push([p[0], p[1] + w]); });
  // flippers, the far pair first
  const flip = (fx: number, a: number, colour: string): void => {
    ctx.fillStyle = colour;
    ctx.save(); ctx.translate(fx, 0.5); ctx.rotate(0.6 + Math.sin(ph) * 0.3 + a);
    ctx.beginPath(); ctx.ellipse(0.6, 0, 0.8, 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  flip(3.4, 0.4, dark); flip(-0.6, 0.4, dark);
  ctx.fillStyle = lit(ctx, skin, -1.2, 1.0);
  ctx.beginPath();
  top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  bot.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 0.12) : ctx.moveTo(p[0], p[1] - 0.12)));
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath(); ctx.fill();
  // the tail fin, a downturned fluke like a shark's upside down
  const tail = spine[n];
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(tail[0] + 0.6, tail[1]); ctx.lineTo(tail[0] - 0.9, tail[1] + 1.0); ctx.lineTo(tail[0] - 0.4, tail[1] - 0.4); ctx.closePath(); ctx.fill();
  // the long jaws, with teeth that curve back
  const head = spine[0];
  ctx.beginPath(); ctx.moveTo(head[0] - 0.4, head[1] - 0.3); ctx.lineTo(head[0] + 1.6, head[1] - 0.05); ctx.lineTo(head[0] + 1.5, head[1] + 0.2); ctx.lineTo(head[0] - 0.4, head[1] + 0.35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#efe7d0';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(head[0] + i * 0.2, head[1] + 0.07); ctx.lineTo(head[0] + i * 0.2 - 0.06, head[1] + 0.2); ctx.lineTo(head[0] + i * 0.2 + 0.07, head[1] + 0.07); ctx.fill(); }
  ctx.fillStyle = '#16222a';
  ctx.beginPath(); ctx.arc(head[0] + 0.1, head[1] - 0.12, 0.08, 0, Math.PI * 2); ctx.fill();
  flip(3.2, 0, skin); flip(-0.8, 0, skin);
  ctx.restore();
}
