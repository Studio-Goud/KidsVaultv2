/**
 * The sky Night Watch is played under.
 *
 * The game itself is bright points on dark, which is right - anything busy would compete with the
 * figure the child is trying to hold in mind. So the work here is depth rather than decoration: a
 * band of faint stars behind the bright ones, a wash of milky way, and a dark land along the
 * bottom with pines and one lit window, which turns a black rectangle into a night.
 */

import { TAU } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { CachedLayer, Ctx } from '../../render/look';

const skyLayer = new CachedLayer();

/** The sky and the land under it: fixed, so it is drawn once and kept. */
export function paintNightSky(ctx: Ctx, w: number, h: number, t: number, u: number): void {
  const layer = skyLayer.get(w, h, 'night', (lc, lw, lh) => paintNightStill(lc, lw, lh, u));
  if (layer) ctx.drawImage(layer, 0, 0);
  // one shooting star, now and then, low and quick: enough to say the sky is alive
  const period = 13;
  const ph = (t % period) / period;
  if (ph < 0.06) {
    const k = ph / 0.06;
    const seed = Math.floor(t / period);
    const rng = makeRng(seed * 977 + 3);
    const x0 = rng() * w * 0.7, y0 = h * (0.08 + rng() * 0.3);
    const len = w * 0.18;
    const x = x0 + k * len * 1.6, y = y0 + k * len * 0.5;
    const g = ctx.createLinearGradient(x - len * 0.5, y - len * 0.16, x, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, `rgba(233, 244, 255, ${Math.sin(k * Math.PI) * 0.85})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - len * 0.5, y - len * 0.16);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

function paintNightStill(ctx: Ctx, w: number, h: number, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#060d26');
  g.addColorStop(0.5, '#0c1940');
  g.addColorStop(1, '#16305f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // the milky way: a soft diagonal wash with a little structure in it
  const noise = new ValueNoise(17);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(-0.5);
  ctx.translate(-w * 0.5, -h * 0.42);
  for (let i = 0; i < 3; i++) {
    const band = ctx.createLinearGradient(0, h * (0.28 + i * 0.05), 0, h * (0.56 + i * 0.05));
    band.addColorStop(0, 'rgba(150, 178, 255, 0)');
    band.addColorStop(0.5, `rgba(168, 192, 255, ${0.05 - i * 0.012})`);
    band.addColorStop(1, 'rgba(150, 178, 255, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(-w * 0.5, h * (0.28 + i * 0.05), w * 2, h * 0.3);
  }
  // dust lanes
  const dust = makeRng(5);
  for (let i = 0; i < 420; i++) {
    const x = -w * 0.3 + dust() * w * 1.6;
    const y = h * 0.3 + dust() * h * 0.26;
    const n = noise.fbm2(x * 0.004, y * 0.004, 3);
    ctx.fillStyle = `rgba(225, 235, 255, ${0.02 + n * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, dust() * 1.1 + 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // faint stars behind the ones the game uses, in the colours stars actually come in
  const rng = makeRng(23);
  for (let i = 0; i < 260; i++) {
    const x = rng() * w, y = rng() * h * 0.92;
    const r = rng() * 1.1 + 0.25;
    const warm = rng();
    ctx.fillStyle = warm > 0.88
      ? `rgba(255, 226, 190, ${0.2 + rng() * 0.45})`
      : warm > 0.72
        ? `rgba(206, 224, 255, ${0.2 + rng() * 0.45})`
        : `rgba(236, 244, 255, ${0.14 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // the land: two ridges of pines and a cottage with one window still lit
  const horizon = h * 0.9;
  const ridges = [
    { y: horizon - 18 * u, colour: '#0a1430', trees: 26, hgt: 20 * u },
    { y: horizon + 6 * u, colour: '#050b1e', trees: 18, hgt: 30 * u },
  ];
  const trng = makeRng(61);
  for (const r of ridges) {
    ctx.fillStyle = r.colour;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, r.y);
    for (let x = 0; x <= w; x += 10) {
      ctx.lineTo(x, r.y - Math.sin(x * 0.004 + r.trees) * 5 * u);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < r.trees; i++) {
      const x = trng() * w;
      const base = r.y - Math.sin(x * 0.004 + r.trees) * 5 * u + 1;
      const hh = r.hgt * (0.6 + trng() * 0.8);
      const wdt = hh * 0.34;
      ctx.beginPath();
      ctx.moveTo(x - wdt, base);
      ctx.lineTo(x, base - hh);
      ctx.lineTo(x + wdt, base);
      ctx.closePath();
      ctx.fill();
    }
  }
  // the cottage
  const cx = w * 0.78, cy = horizon + 2 * u;
  ctx.fillStyle = '#04091a';
  ctx.beginPath();
  ctx.moveTo(cx - 16 * u, cy);
  ctx.lineTo(cx - 16 * u, cy - 12 * u);
  ctx.lineTo(cx, cy - 22 * u);
  ctx.lineTo(cx + 16 * u, cy - 12 * u);
  ctx.lineTo(cx + 16 * u, cy);
  ctx.closePath();
  ctx.fill();
  const win = ctx.createRadialGradient(cx + 4 * u, cy - 7 * u, 0, cx + 4 * u, cy - 7 * u, 14 * u);
  win.addColorStop(0, 'rgba(255, 214, 138, 0.9)');
  win.addColorStop(0.3, 'rgba(255, 200, 110, 0.35)');
  win.addColorStop(1, 'rgba(255, 200, 110, 0)');
  ctx.fillStyle = win;
  ctx.fillRect(cx - 12 * u, cy - 20 * u, 30 * u, 22 * u);
  ctx.fillStyle = '#ffd68a';
  ctx.fillRect(cx + 1 * u, cy - 10 * u, 6 * u, 6 * u);
}
