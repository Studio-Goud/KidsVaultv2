/**
 * The space Planetarium is played in.
 *
 * The planets are NASA photographs, so the background has to be dark and deep enough not to argue
 * with them: a graded black, a wash of milky way, and stars in the colours and sizes stars come in,
 * with the nearest few bright enough to have spikes. All of it is fixed, so it is painted once.
 */

import { TAU } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { CachedLayer, Ctx } from '../../render/look';

const layer = new CachedLayer();

export function paintSpace(ctx: Ctx, w: number, h: number): void {
  const cv = layer.get(w, h, 'space', (lc, lw, lh) => paintSpaceStill(lc, lw, lh));
  if (cv) ctx.drawImage(cv, 0, 0);
}

function paintSpaceStill(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#03060f');
  g.addColorStop(0.55, '#080e28');
  g.addColorStop(1, '#101740');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // a wash of distant stars, thickest along a diagonal band
  const noise = new ValueNoise(29);
  const rng = makeRng(101);
  for (let i = 0; i < 900; i++) {
    const x = rng() * w, y = rng() * h;
    // the band runs corner to corner; away from it the sky thins out
    const d = Math.abs((y / h) - (0.72 - (x / w) * 0.45));
    const density = Math.max(0, 1 - d * 3.4);
    if (rng() > 0.18 + density * 0.8) continue;
    const n = noise.fbm2(x * 0.01, y * 0.01, 2);
    const r = rng() * (0.5 + density * 0.9) + 0.2;
    const warm = rng();
    const a = (0.1 + n * 0.5) * (0.35 + density * 0.65);
    ctx.fillStyle = warm > 0.9
      ? `rgba(255, 220, 186, ${a})`
      : warm > 0.72
        ? `rgba(198, 216, 255, ${a})`
        : `rgba(232, 240, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // a faint nebula, so the dark is not flat
  for (let i = 0; i < 3; i++) {
    const nx = rng() * w, ny = rng() * h;
    const nr = Math.min(w, h) * (0.2 + rng() * 0.25);
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    const hue = i % 2 === 0 ? '90, 120, 220' : '150, 100, 200';
    ng.addColorStop(0, `rgba(${hue}, 0.07)`);
    ng.addColorStop(1, `rgba(${hue}, 0)`);
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(nx, ny, nr, 0, TAU);
    ctx.fill();
  }

  // a handful of near stars, bright enough to flare
  for (let i = 0; i < 6; i++) {
    const x = rng() * w, y = rng() * h;
    const r = 0.9 + rng() * 0.8;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    glow.addColorStop(0, 'rgba(226, 238, 255, 0.4)');
    glow.addColorStop(1, 'rgba(160, 190, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 242, 255, 0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 4, y); ctx.lineTo(x + r * 4, y);
    ctx.moveTo(x, y - r * 4); ctx.lineTo(x, y + r * 4);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}
