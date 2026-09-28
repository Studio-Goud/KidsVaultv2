/**
 * How it works, before the long journey: the child is a bird and the moths on the trees are dinner.
 *
 * This is the peppered moth of the English industrial towns, one of the best-studied cases of
 * natural selection there is. Soot turned the tree trunks black. On a black trunk a pale moth is easy
 * to see and a dark one is not, so the birds took the pale ones, the dark ones lived to lay eggs, and
 * within a few decades nearly every moth round Manchester was dark. The child does the choosing
 * themselves: they can only tap what they can see, and what they cannot see has the next generation.
 * Nobody tells them the answer; the next round of moths simply comes out darker, because of them.
 *
 * `nextGeneration` is plain arithmetic and is tested: the survivors' mix, scaled back up to a full
 * tree's worth, is the mix of the next generation. That is the whole mechanism.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface Moth { x: number; y: number; dark: boolean; rot: number; foundAt: number; seed: number }

/** How many moths there are on the trees each generation: enough to count, few enough to find. */
export const PER_GENERATION = 10;

/**
 * The next generation from the moths nobody found: the same share of dark and pale, scaled up to a
 * full generation. Always at least one of whichever kind survived, so a kind that is still there
 * does not round away to nothing.
 */
export function nextGeneration(survivors: { dark: number; pale: number }, n = PER_GENERATION): { dark: number; pale: number } {
  const total = survivors.dark + survivors.pale;
  if (total === 0) return { dark: Math.round(n / 2), pale: n - Math.round(n / 2) };
  let dark = Math.round((survivors.dark / total) * n);
  if (survivors.dark > 0) dark = Math.max(1, dark);
  if (survivors.pale > 0) dark = Math.min(n - 1, dark);
  return { dark, pale: n - dark };
}

/** Moths placed on the trunks, never on top of each other. */
export function scatterMoths(mix: { dark: number; pale: number }, trunks: number[], trunkW: number, top: number, bottom: number, seed: number): Moth[] {
  let s = seed;
  const r = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const kinds = [...Array(mix.dark).fill(true), ...Array(mix.pale).fill(false)] as boolean[];
  const out: Moth[] = [];
  for (const dark of kinds) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 30; tries++) {
      const t = trunks[Math.floor(r() * trunks.length)];
      x = t + (r() - 0.5) * trunkW * 0.6;
      y = top + r() * (bottom - top);
      if (out.every(m => Math.hypot(m.x - x, m.y - y) > trunkW * 0.55)) break;
    }
    out.push({ x, y, dark, rot: (r() - 0.5) * 0.8, foundAt: -1, seed: Math.floor(r() * 1000) });
  }
  return out;
}

/** A soot-blackened birch trunk. */
export function drawTrunk(ctx: Ctx, x: number, top: number, bottom: number, w: number, soot: number): void {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  const pale = [226, 222, 210], black = [52, 50, 48];
  const c = (k: number): string => `rgb(${pale.map((v, i) => Math.round(v + (black[i] - v) * soot) + k).join(',')})`;
  g.addColorStop(0, c(-20)); g.addColorStop(0.45, c(10)); g.addColorStop(1, c(-30));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, top, w, bottom - top);
  // the dark bands of birch bark, and a little lichen where the soot has not reached
  ctx.fillStyle = `rgba(20, 18, 16, ${0.5 - soot * 0.2})`;
  for (let i = 0; i < 24; i++) {
    const y = top + ((i * 97.3) % 1) * (bottom - top) + i * 23 % (bottom - top);
    ctx.fillRect(x - w / 2 + ((i * 13) % 7), y % (bottom - top) + top, w * (0.2 + ((i * 7) % 5) / 10), 2 + (i % 3));
  }
}

/** A moth resting flat on the bark: a pale one speckled with black, or the all-dark kind. */
export function drawMoth(ctx: Ctx, m: Moth, s: number, t: number): void {
  let x = m.x, y = m.y, a = m.rot, wing = 1;
  if (m.foundAt >= 0) {
    // found: it flutters off up and away
    const k = Math.min(1, (t - m.foundAt) / 1.2);
    x += Math.sin(k * 9) * s * 1.5 + k * s * 4;
    y -= k * k * s * 20;
    wing = Math.abs(Math.sin(t * 30));
    a = 0;
    if (k >= 1) return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(1, 1);
  const base = m.dark ? '#36332f' : '#e6e2d6';
  const speck = m.dark ? 'rgba(58, 55, 50, 0.6)' : 'rgba(30, 28, 26, 0.85)';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * wing, 1);
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(s * 0.9, -s * 0.3, s * 1.0, s * 0.55); ctx.quadraticCurveTo(s * 0.4, s * 0.7, 0, s * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = speck;
    for (let i = 0; i < 14; i++) {
      const px = ((i * 37 + m.seed) % 100) / 100 * s * 0.8 + s * 0.05, py = ((i * 53 + m.seed) % 100) / 100 * s * 0.7 - s * 0.1;
      if (py > s * (0.5 - px / s * 0.1)) continue;
      ctx.beginPath(); ctx.arc(px, py, s * (0.03 + (i % 3) * 0.015), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = m.dark ? '#2a2826' : '#8a8478';
  ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.1, s * 0.4, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = m.dark ? '#1a1816' : '#6a6458'; ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, -s * 0.35, -s * 0.6); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.35, -s * 0.6); ctx.stroke();
  ctx.restore();
}
