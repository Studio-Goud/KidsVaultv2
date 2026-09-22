/**
 * The three stops on the dive that no photograph can cover.
 *
 * Below about a kilometre there are very few pictures a child would read: a wreck at four
 * kilometres is a grey smudge in a lamp beam, and the deepest place in the sea looks like
 * nothing at all, because it is dark. So these three are drawn - a silhouette each, in the
 * colour the sea is at that depth - and the rest of the dive is real photographs.
 *
 * Each one draws inside a circle of radius `r` around the origin; the caller has already clipped
 * to that circle, so a shape may run past the edge.
 */

type Ctx = CanvasRenderingContext2D;

/**
 * Everything down here is lit by the lamp you brought, so the shapes are lighter than the water
 * and not darker. Drawn the other way round - a black silhouette on a black sea - they read as a
 * smudge, which is exactly the problem the photographs have at this depth.
 */
const LIT = '#3d6076';
const LIT_EDGE = 'rgba(190, 220, 240, 0.5)';

/** Specks of marine snow, which is what your lamp mostly finds down there. */
function snow(ctx: Ctx, r: number, n: number, seed: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < n; i++) {
    const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
    const b = Math.sin((i + seed) * 78.233) * 43758.5453;
    const x = ((a % 1) + 1) % 1, y = ((b % 1) + 1) % 1;
    ctx.globalAlpha = 0.18 + 0.3 * x;
    ctx.beginPath();
    ctx.arc((x - 0.5) * 2 * r, (y - 0.5) * 2 * r, r * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The bow of a liner, gone down by the head and sitting in its own silt. */
export function wreck(ctx: Ctx, r: number): void {
  snow(ctx, r, 40, 3);
  // the lamp on it, which is the only reason anything is visible at this depth
  const beam = ctx.createLinearGradient(0, -r, 0, r * 0.5);
  beam.addColorStop(0, 'rgba(210, 232, 255, 0.18)');
  beam.addColorStop(1, 'rgba(210, 232, 255, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -r); ctx.lineTo(r * 0.16, -r);
  ctx.lineTo(r * 0.72, r * 0.45); ctx.lineTo(-r * 0.72, r * 0.45);
  ctx.closePath(); ctx.fill();

  ctx.save();
  ctx.rotate(-0.16);
  ctx.fillStyle = LIT;
  // hull: a long wedge with the bow to the left and the deck line above it
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, r * 0.08);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.42, r * 0.62, r * 0.3);
  ctx.lineTo(r * 0.62, -r * 0.04);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.02, -r * 0.82, r * 0.08);
  ctx.closePath(); ctx.fill();
  // the raised forecastle and two funnels, which is what makes it a ship and not a rock
  ctx.beginPath();
  ctx.roundRect(-r * 0.62, -r * 0.2, r * 0.42, r * 0.18, r * 0.03);
  ctx.fill();
  for (const fx of [-r * 0.02, r * 0.26]) {
    ctx.beginPath();
    ctx.roundRect(fx, -r * 0.44, r * 0.11, r * 0.42, r * 0.04);
    ctx.fill();
  }
  ctx.strokeStyle = LIT_EDGE;
  ctx.lineWidth = Math.max(1, r * 0.012);
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.06); ctx.quadraticCurveTo(-r * 0.2, r * 0.0, r * 0.62, -r * 0.03);
  ctx.stroke();
  ctx.restore();

  // the silt it has settled into
  ctx.fillStyle = 'rgba(70, 96, 112, 0.9)';
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.42);
  ctx.quadraticCurveTo(0, r * 0.2, r, r * 0.46);
  ctx.lineTo(r, r); ctx.lineTo(-r, r);
  ctx.closePath(); ctx.fill();
}

/** An anglerfish, with the one lamp anybody down here brings themselves. */
export function angler(ctx: Ctx, r: number): void {
  snow(ctx, r, 26, 11);
  const glow = ctx.createRadialGradient(-r * 0.18, -r * 0.5, 0, -r * 0.18, -r * 0.5, r * 0.62);
  glow.addColorStop(0, 'rgba(180, 255, 235, 0.75)');
  glow.addColorStop(1, 'rgba(120, 220, 210, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.5, r * 0.62, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = LIT;
  // body: a round bag with the tail trailing off to the right
  ctx.beginPath();
  ctx.moveTo(r * 0.34, -r * 0.02);
  ctx.quadraticCurveTo(r * 0.3, r * 0.5, -r * 0.24, r * 0.46);
  ctx.quadraticCurveTo(-r * 0.66, r * 0.4, -r * 0.6, -r * 0.02);
  ctx.quadraticCurveTo(-r * 0.54, -r * 0.34, -r * 0.16, -r * 0.3);
  ctx.quadraticCurveTo(r * 0.16, -r * 0.3, r * 0.34, -r * 0.02);
  ctx.closePath();
  ctx.moveTo(r * 0.3, r * 0.04);
  ctx.lineTo(r * 0.82, -r * 0.24); ctx.lineTo(r * 0.8, r * 0.34);
  ctx.closePath();
  ctx.fill();

  // the rod, and the teeth under it
  ctx.strokeStyle = LIT;
  ctx.lineWidth = Math.max(1.4, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.28);
  ctx.quadraticCurveTo(-r * 0.36, -r * 0.62, -r * 0.2, -r * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200, 255, 240, 0.95)';
  ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.5, r * 0.07, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(235, 245, 250, 0.9)';
  for (let i = 0; i < 5; i++) {
    const x = -r * 0.56 + i * r * 0.1;
    ctx.beginPath();
    ctx.moveTo(x, r * 0.08); ctx.lineTo(x + r * 0.04, r * 0.2); ctx.lineTo(x + r * 0.08, r * 0.08);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.1, r * 0.05, 0, Math.PI * 2); ctx.fill();
}

/** The deepest place there is: two walls, and the dark between them. */
export function trench(ctx: Ctx, r: number): void {
  const dark = ctx.createLinearGradient(0, -r, 0, r);
  dark.addColorStop(0, 'rgba(10, 26, 40, 0.5)');
  dark.addColorStop(1, 'rgba(0, 4, 10, 1)');
  ctx.fillStyle = dark;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  snow(ctx, r, 30, 7);

  ctx.fillStyle = '#31536a';
  ctx.beginPath();
  ctx.moveTo(-r, -r);
  ctx.lineTo(-r * 0.86, -r);
  ctx.quadraticCurveTo(-r * 0.4, r * 0.1, -r * 0.16, r);
  ctx.lineTo(-r, r);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r, -r);
  ctx.lineTo(r * 0.8, -r);
  ctx.quadraticCurveTo(r * 0.36, r * 0.14, r * 0.14, r);
  ctx.lineTo(r, r);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(180, 215, 235, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.014);
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, -r); ctx.quadraticCurveTo(-r * 0.4, r * 0.1, -r * 0.16, r);
  ctx.moveTo(r * 0.8, -r); ctx.quadraticCurveTo(r * 0.36, r * 0.14, r * 0.14, r);
  ctx.stroke();
}
