/**
 * Braam, the meerkat.
 *
 * Every game in Braambos explains itself in writing to children who mostly cannot read, and the
 * weakest of the four pillars of learning across the whole market is the social one: somebody who
 * responds. A guide is the answer to both, so there is one, and he is the same animal on every
 * screen.
 *
 * A meerkat because the pose is the job. They stand upright and look around - that is what a
 * sentinel does, and a child reads it as "look here" before anyone says a word. He is also a real
 * animal, in an app whose encyclopedia holds three and a half thousand real ones, so the guide
 * does not have to be an invented cartoon.
 *
 * He is drawn, not fetched: canvas paths like everything else here, so he costs nothing to load,
 * scales to any size and can be posed rather than animated frame by frame.
 *
 * What makes him read at the size of a thumb is three things and nothing else: an upright sandy
 * body, a dark mask around the eyes, and a pointed snout. Everything else - the banded back, the
 * pale belly, the tail - is for when he is large.
 *
 * He is deliberately not anybody else's meerkat. Different proportions, our own palette, no
 * shirt, no catchphrase.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** The name a child says. One constant, so it can be changed in one place. */
export const GUIDE_NAME = 'Braam';

const FUR = '#d9a96a';
const FUR_D = '#b9884a';
const BELLY = '#f2dcb4';
const MASK = '#4a3524';
const NOSE = '#2e2119';
const EAR = '#6b4d32';

/**
 * What he is doing.
 *
 * `watch` is the resting pose, and it is the one a child sees most: standing, looking out, paws
 * together. The rest are the four things a guide ever has to do - say something, point at
 * something, be pleased, and go to sleep when the day is over.
 */
export type Pose = 'watch' | 'talk' | 'point' | 'cheer' | 'sleep';

export interface GuideLook {
  pose?: Pose;
  /** seconds, for breathing and blinking; pass the game's clock */
  t?: number;
  /** which way he faces and points: -1 left, 1 right */
  facing?: -1 | 1;
  /** 0 to 1, how far along a spoken line is, so his mouth moves while it plays */
  saying?: number;
}

/**
 * Draw him standing on (x, y), `size` tall.
 *
 * The origin is the ground under his feet, because that is what a caller knows: where he stands.
 */
export function drawGuide(ctx: Ctx, x: number, y: number, size: number, look: GuideLook = {}): void {
  const pose = look.pose ?? 'watch';
  const t = look.t ?? 0;
  const face = look.facing ?? 1;
  const s = size / 100;                              // everything below is written at 100 tall

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s, s);

  if (pose === 'sleep') { drawSleeping(ctx, t); ctx.restore(); return; }

  // he breathes, always, because a guide that is perfectly still is a sticker
  const breath = 1 + Math.sin(t * 2.1) * 0.012;
  const bob = pose === 'talk' ? Math.sin(t * 7) * 0.7 : 0;

  // ---- the tail. It hangs down and touches the ground, because that is what the animal does:
  // standing on two legs and a tail is a tripod, and it is why the pose holds at all.
  ctx.strokeStyle = FUR_D;
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.quadraticCurveTo(-24, -14, -26, 0);
  ctx.stroke();
  ctx.strokeStyle = MASK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-26, -5);
  ctx.lineTo(-26, 1);
  ctx.stroke();

  // ---- feet
  ctx.fillStyle = FUR_D;
  ctx.beginPath(); ctx.ellipse(-7, -3, 8, 4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -3, 8, 4, 0, 0, TAU); ctx.fill();

  ctx.save();
  ctx.scale(1, breath);

  // ---- body: a pear standing on its point, narrow at the shoulders
  ctx.fillStyle = FUR;
  ctx.beginPath();
  ctx.moveTo(-13, -6);
  ctx.quadraticCurveTo(-18, -30, -11, -46);
  ctx.quadraticCurveTo(0, -56, 11, -46);
  ctx.quadraticCurveTo(18, -30, 13, -6);
  ctx.quadraticCurveTo(0, -1, -13, -6);
  ctx.fill();
  // the pale front, which is what makes him upright rather than a blob
  ctx.fillStyle = BELLY;
  ctx.beginPath();
  ctx.ellipse(1, -24, 9, 18, 0, 0, TAU);
  ctx.fill();
  // three faint bands across the back, the way a real one is marked
  ctx.strokeStyle = 'rgba(150,106,54,0.5)';
  ctx.lineWidth = 2.2;
  for (const by of [-16, -25, -34]) {
    ctx.beginPath();
    ctx.moveTo(-12, by);
    ctx.quadraticCurveTo(-7, by - 2.5, -3, by - 1);
    ctx.stroke();
  }

  // ---- arms
  ctx.strokeStyle = FUR;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  if (pose === 'point') {
    // one paw out, level, which is a point a two-year-old follows
    ctx.beginPath(); ctx.moveTo(6, -40); ctx.quadraticCurveTo(20, -42, 30, -46); ctx.stroke();
    ctx.fillStyle = FUR_D;
    ctx.beginPath(); ctx.arc(32, -46.5, 4.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = FUR;
    ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(-10, -32, -6, -26); ctx.stroke();
  } else if (pose === 'cheer') {
    ctx.beginPath(); ctx.moveTo(7, -42); ctx.quadraticCurveTo(18, -52, 20, -64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, -42); ctx.quadraticCurveTo(-18, -52, -20, -64); ctx.stroke();
    ctx.fillStyle = FUR_D;
    ctx.beginPath(); ctx.arc(20.5, -66, 4.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-20.5, -66, 4.2, 0, TAU); ctx.fill();
  } else {
    // the resting pose: both paws held together in front, which is how they actually stand
    ctx.beginPath(); ctx.moveTo(7, -40); ctx.quadraticCurveTo(9, -30, 2, -25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, -40); ctx.quadraticCurveTo(-9, -30, -2, -25); ctx.stroke();
    ctx.fillStyle = FUR_D;
    ctx.beginPath(); ctx.ellipse(0, -24, 6, 4.5, 0, 0, TAU); ctx.fill();
  }

  // ---- head
  ctx.save();
  ctx.translate(0, -52 + bob);
  ctx.fillStyle = FUR_D;
  ctx.beginPath(); ctx.ellipse(-12.5, -7, 7, 6, -0.35, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12.5, -7, 7, 6, 0.35, 0, TAU); ctx.fill();
  ctx.fillStyle = EAR;
  ctx.beginPath(); ctx.ellipse(-12, -7, 4, 3.4, -0.35, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, -7, 4, 3.4, 0.35, 0, TAU); ctx.fill();

  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(0, -2, 13, 12, 0, 0, TAU); ctx.fill();
  // the snout, pointed, which is the other half of the silhouette
  ctx.beginPath();
  ctx.moveTo(-5, 1);
  ctx.quadraticCurveTo(0, 2, 5, 1);
  ctx.quadraticCurveTo(8, 7, 0, 9);
  ctx.quadraticCurveTo(-8, 7, -5, 1);
  ctx.fill();
  ctx.fillStyle = BELLY;
  ctx.beginPath(); ctx.ellipse(0, 5, 5, 3.6, 0, 0, TAU); ctx.fill();

  // the mask: the one thing that says meerkat at any size
  ctx.fillStyle = MASK;
  ctx.beginPath(); ctx.ellipse(-6, -4, 6, 4.4, -0.22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -4, 6, 4.4, 0.22, 0, TAU); ctx.fill();

  // eyes inside the mask. He blinks on his own clock, rarely, which is what makes him alive
  const blink = Math.sin(t * 0.9) > 0.985 ? 0.12 : 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-6, -4, 2.8, 2.8 * blink, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -4, 2.8, 2.8 * blink, 0, 0, TAU); ctx.fill();
  if (blink > 0.5) {
    ctx.fillStyle = NOSE;
    ctx.beginPath(); ctx.arc(-5.4, -4, 1.7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6.6, -4, 1.7, 0, TAU); ctx.fill();
  }

  ctx.fillStyle = NOSE;
  ctx.beginPath(); ctx.ellipse(0, 3, 2.6, 2, 0, 0, TAU); ctx.fill();

  // the mouth: open while he is saying something, a small smile when he is not
  const open = pose === 'talk' ? 1.4 + Math.sin((look.saying ?? t) * 11) * 1.2 : 0;
  if (open > 0.3) {
    ctx.fillStyle = '#7a3b34';
    ctx.beginPath(); ctx.ellipse(0, 7.5, 2.6, open, 0, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = NOSE;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 6, 2.6, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

/** Curled up, eyes shut. The end of the day, and the only pose that is not standing. */
function drawSleeping(ctx: Ctx, t: number): void {
  const breath = 1 + Math.sin(t * 1.4) * 0.03;
  ctx.save();
  ctx.scale(1, breath);
  ctx.strokeStyle = FUR_D;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, -12);
  ctx.quadraticCurveTo(-34, -8, -28, -2);
  ctx.quadraticCurveTo(-16, 2, -2, -2);
  ctx.stroke();

  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(0, -13, 24, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = BELLY;
  ctx.beginPath(); ctx.ellipse(2, -9, 15, 7, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = EAR;
  ctx.beginPath(); ctx.ellipse(12, -26, 4.5, 3.8, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(16, -20, 12, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = MASK;
  ctx.beginPath(); ctx.ellipse(13, -22, 5, 4.6, -0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(23, -21, 4.6, 4.2, 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(13, -22, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(23, -21, 2.4, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.fillStyle = NOSE;
  ctx.beginPath(); ctx.ellipse(28, -17, 2.4, 1.9, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
