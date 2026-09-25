/**
 * How Moonshot is drawn.
 *
 * A rocket is a stack of cylinders, and a cylinder is the one shape where a flat fill always looks
 * wrong: the eye wants a bright band a third of the way across and a dark edge on both sides. So
 * every tank, every engine and every booster gets the same horizontal gradient, and the whole
 * thing reads as metal without a single texture.
 *
 * The sky is the other half of it. It runs from a bright blue at the pad through a deepening blue
 * to black, driven by the same air-density curve the physics uses, so the moment the colour gives
 * out is the moment the air does.
 */

import { clamp, TAU } from '../../util/math';
import { makeRng } from '../../util/rng';
import {
  blobPath, breathe, CachedLayer, contactShadow, Ctx, grainOver, roundRectPath, shade, vGrad,
} from '../../render/look';
import { airAt, finAnchor, partById, taperSpan, topRow, widthOf, type Design, type Part } from './design';

// ---------------------------------------------------------------- the sky

const skyLayer = new CachedLayer();

/**
 * The colour of the sky at a height, and how much of the stars show through.
 *
 * Below about ten kilometres it is the blue everybody knows. By forty it is the deep navy a
 * high-altitude balloon sees. Past a hundred there is nothing left to scatter the light.
 */
export function skyTone(altM: number): { top: string; bottom: string; stars: number } {
  const a = airAt(altM);
  const k = clamp(Math.pow(a, 0.42), 0, 1);
  const mixc = (c0: number[], c1: number[], t: number): string =>
    `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * t)).join(',')})`;
  return {
    top: mixc([4, 6, 16], [92, 162, 226], k),
    bottom: mixc([8, 12, 28], [186, 224, 246], k),
    stars: 1 - k,
  };
}

/** The star field the rocket climbs into. Fixed, so it does not crawl as the sky changes. */
export function paintStars(ctx: Ctx, w: number, h: number, alpha: number, drift: number): void {
  if (alpha <= 0.01) return;
  const cv = skyLayer.get(w, h, 'stars', (lc, lw, lh) => {
    const rng = makeRng(90210);
    for (let i = 0; i < 260; i++) {
      const x = rng() * lw, y = rng() * lh;
      const r = 0.4 + rng() * rng() * 1.9;
      const b = 0.4 + rng() * 0.6;
      lc.fillStyle = `rgba(${220 + Math.round(rng() * 35)}, ${226 + Math.round(rng() * 29)}, 255, ${b})`;
      lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
    }
  });
  if (!cv) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const off = ((drift % h) + h) % h;
  ctx.drawImage(cv, 0, off - h);
  ctx.drawImage(cv, 0, off);
  ctx.restore();
}

// ---------------------------------------------------------------- the metal

/**
 * The shading every cylinder gets: dark at both edges, a bright band left of the middle where the
 * light lands, and a soft warm bounce on the right. This one gradient is what makes a rectangle
 * read as a tube.
 */
function tube(ctx: Ctx, x: number, w: number, base: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(base, -0.34));
  g.addColorStop(0.12, shade(base, -0.12));
  g.addColorStop(0.32, shade(base, 0.22));
  g.addColorStop(0.55, base);
  g.addColorStop(0.84, shade(base, -0.2));
  g.addColorStop(1, shade(base, -0.4));
  return g;
}

const WHITE = '#eceff3';
const DARK = '#3b4048';
const COPPER = '#c98a52';

/** A ring of rivets and a seam, which is what stops a long tank reading as a blank white bar. */
function seams(ctx: Ctx, x: number, y: number, w: number, h: number, rows: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 48, 60, 0.18)';
  ctx.lineWidth = Math.max(0.6, w * 0.012);
  for (let i = 1; i < rows; i++) {
    const yy = y + (h * i) / rows;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  ctx.restore();
}

/**
 * One part, drawn into a box. `u` is the size of one grid cell in pixels.
 *
 * Every part is drawn from its own bottom edge upwards, because that is how they stack: the thing
 * below decides where the thing above starts.
 */
/**
 * The shapes that are not a tube, a cone or a bell.
 *
 * A hundred parts drawn as five silhouettes is not a hundred parts, so everything that is really a
 * different object - a satellite, a lander, a reactor, a grid fin, a parachute pack - gets its own
 * drawing here. Returns true when it has handled the part.
 */
function paintSpecial(
  ctx: Ctx, art: string, part: Part, cx: number, bottomY: number, u: number, t: number,
  side: number, w: number, h: number, x: number, y: number,
): boolean {
  const s = side || 1;
  const band = (yy: number, hh: number, c: string): void => { ctx.fillStyle = c; ctx.fillRect(x, yy, w, hh); };

  switch (art) {
    case 'shield': {
      // a blunt ablative dish, wide and dark
      ctx.fillStyle = tube(ctx, x, w, '#6b5a4e');
      ctx.beginPath();
      ctx.moveTo(x, bottomY);
      ctx.quadraticCurveTo(cx, y - h * 0.5, x + w, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,22,18,0.35)';
      ctx.lineWidth = Math.max(0.8, w * 0.02);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * i) / 4, bottomY);
        ctx.quadraticCurveTo(cx, y + h * 0.1, x + (w * i) / 4, bottomY - h * 0.5);
        ctx.stroke();
      }
      return true;
    }
    case 'sat': {
      // a box with two panels and a dish on top
      ctx.fillStyle = tube(ctx, x + w * 0.28, w * 0.44, '#c9d0d8');
      roundRectPath(ctx, x + w * 0.28, y + h * 0.22, w * 0.44, h * 0.72, w * 0.06);
      ctx.fill();
      ctx.fillStyle = '#2f4a6b';
      ctx.fillRect(x, y + h * 0.36, w * 0.26, h * 0.34);
      ctx.fillRect(x + w * 0.74, y + h * 0.36, w * 0.26, h * 0.34);
      ctx.strokeStyle = 'rgba(180,210,255,0.45)';
      ctx.lineWidth = Math.max(0.6, w * 0.015);
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + h * (0.36 + i * 0.11)); ctx.lineTo(x + w * 0.26, y + h * (0.36 + i * 0.11)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w * 0.74, y + h * (0.36 + i * 0.11)); ctx.lineTo(x + w, y + h * (0.36 + i * 0.11)); ctx.stroke();
      }
      ctx.fillStyle = '#e8eef6';
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.18, w * 0.2, h * 0.16, 0, Math.PI, 0); ctx.fill();
      return true;
    }
    case 'scope': {
      ctx.fillStyle = tube(ctx, x, w, '#b9c2cc');
      roundRectPath(ctx, x, y + h * 0.1, w, h * 0.9, w * 0.08);
      ctx.fill();
      ctx.fillStyle = '#1b2330';
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.12, w * 0.46, h * 0.07, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(140, 200, 255, 0.35)';
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.13, w * 0.34, h * 0.05, 0, 0, TAU); ctx.fill();
      band(y + h * 0.42, Math.max(1, h * 0.05), 'rgba(40,48,60,0.3)');
      band(y + h * 0.7, Math.max(1, h * 0.05), 'rgba(40,48,60,0.3)');
      return true;
    }
    case 'cabin': case 'station': {
      ctx.fillStyle = tube(ctx, x, w, WHITE);
      roundRectPath(ctx, x, y, w, h, w * 0.14);
      ctx.fill();
      const rings = art === 'station' ? 3 : 2;
      for (let i = 0; i < rings; i++) band(y + h * (0.18 + i * 0.28), Math.max(1.2, h * 0.035), 'rgba(190, 62, 48, 0.6)');
      for (let i = 0; i < rings; i++) {
        ctx.fillStyle = '#7fd2f2';
        ctx.beginPath(); ctx.ellipse(cx - w * 0.2, y + h * (0.3 + i * 0.28), w * 0.09, h * 0.045, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.ellipse(cx + w * 0.18, y + h * (0.3 + i * 0.28), w * 0.07, h * 0.035, 0, 0, TAU); ctx.fill();
      }
      if (art === 'station') {
        ctx.fillStyle = shade(DARK, 0.2);
        ctx.fillRect(x - w * 0.08, y + h * 0.44, w * 0.08, h * 0.12);
        ctx.fillRect(x + w, y + h * 0.44, w * 0.08, h * 0.12);
      }
      return true;
    }
    case 'lander': {
      ctx.fillStyle = tube(ctx, x + w * 0.12, w * 0.76, '#d7dde5');
      roundRectPath(ctx, x + w * 0.12, y, w * 0.76, h * 0.7, w * 0.1);
      ctx.fill();
      ctx.fillStyle = '#7fd2f2';
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.24, w * 0.16, h * 0.08, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(DARK, 0.25);
      ctx.lineWidth = Math.max(1.2, w * 0.05);
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * w * 0.3, y + h * 0.66);
        ctx.lineTo(cx + sx * w * 0.5, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + sx * w * 0.38, bottomY);
        ctx.lineTo(cx + sx * w * 0.6, bottomY);
        ctx.stroke();
      }
      return true;
    }
    case 'rover': {
      ctx.fillStyle = tube(ctx, x + w * 0.1, w * 0.8, '#cfd6de');
      roundRectPath(ctx, x + w * 0.1, y + h * 0.16, w * 0.8, h * 0.48, w * 0.06);
      ctx.fill();
      ctx.fillStyle = '#2f4a6b';
      ctx.fillRect(x + w * 0.2, y + h * 0.06, w * 0.6, h * 0.12);
      ctx.fillStyle = shade(DARK, 0.1);
      for (const sx of [0.18, 0.5, 0.82]) {
        ctx.beginPath(); ctx.arc(x + w * sx, bottomY - h * 0.16, w * 0.12, 0, TAU); ctx.fill();
      }
      return true;
    }
    case 'cargo': {
      ctx.fillStyle = tube(ctx, x, w, '#c6ccd4');
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(28, 34, 44, 0.55)';
      ctx.fillRect(x + w * 0.1, y + h * 0.16, w * 0.8, h * 0.68);
      ctx.strokeStyle = 'rgba(210,220,232,0.7)';
      ctx.lineWidth = Math.max(0.8, w * 0.02);
      ctx.beginPath(); ctx.moveTo(cx, y + h * 0.16); ctx.lineTo(cx, y + h * 0.84); ctx.stroke();
      return true;
    }
    case 'ball': {
      ctx.fillStyle = tube(ctx, x, w, WHITE);
      ctx.beginPath(); ctx.ellipse(cx, bottomY - h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(190, 62, 48, 0.7)';
      ctx.fillRect(cx - w * 0.5, bottomY - h / 2 - h * 0.03, w, Math.max(1.2, h * 0.05));
      return true;
    }
    case 'balloon': {
      ctx.fillStyle = tube(ctx, x, w, '#f4f7fa');
      roundRectPath(ctx, x, y, w, h, w * 0.3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 170, 190, 0.5)';
      ctx.lineWidth = Math.max(0.6, w * 0.012);
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + (h * i) / 5); ctx.lineTo(x + w, y + (h * i) / 5); ctx.stroke();
      }
      return true;
    }
    case 'ribbed': {
      ctx.fillStyle = tube(ctx, x, w, '#d9dee6');
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(70, 80, 95, 0.22)';
      const ribs = Math.max(3, part.rows * 3);
      for (let i = 0; i < ribs; i++) ctx.fillRect(x, y + (h * (i + 0.3)) / ribs, w, Math.max(1, h * 0.02));
      ctx.fillStyle = 'rgba(190, 62, 48, 0.8)';
      ctx.fillRect(x, y + h * 0.05, w, Math.max(1.2, h * 0.045));
      return true;
    }
    case 'spike': {
      // an aerospike: a wedge instead of a bell, which is the whole point of it
      ctx.fillStyle = tube(ctx, x, w, WHITE);
      roundRectPath(ctx, x, y, w, h * 0.42, w * 0.05);
      ctx.fill();
      ctx.fillStyle = tube(ctx, x, w, DARK);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.06, y + h * 0.42);
      ctx.lineTo(x + w * 0.94, y + h * 0.42);
      ctx.lineTo(cx, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.42);
      ctx.lineTo(x + w * 0.34, y + h * 0.42);
      ctx.lineTo(cx - w * 0.04, bottomY - h * 0.06);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    case 'reactor': {
      ctx.fillStyle = tube(ctx, x, w, '#bfc6cf');
      roundRectPath(ctx, x, y, w, h * 0.5, w * 0.05);
      ctx.fill();
      ctx.fillStyle = '#e2b03a';
      ctx.fillRect(x, y + h * 0.13, w, h * 0.1);
      ctx.fillStyle = 'rgba(40,44,52,0.7)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.18 + i * 0.26), y + h * 0.14, w * 0.08, h * 0.08);
      ctx.fillStyle = tube(ctx, x + w * 0.1, w * 0.8, DARK);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.22, y + h * 0.5);
      ctx.quadraticCurveTo(cx - w * 0.34, bottomY - h * 0.08, cx - w * 0.48, bottomY);
      ctx.lineTo(cx + w * 0.48, bottomY);
      ctx.quadraticCurveTo(cx + w * 0.34, bottomY - h * 0.08, cx + w * 0.22, y + h * 0.5);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    case 'turbo': {
      ctx.fillStyle = tube(ctx, x, w, '#c8ccd2');
      roundRectPath(ctx, x, y, w, h * 0.46, w * 0.06);
      ctx.fill();
      // the pumps, bolted on the outside where you can see them
      ctx.fillStyle = shade('#8a929c', 0.1);
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + sx * w * 0.36, y + h * 0.22, w * 0.15, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#d96a2c';
      ctx.fillRect(x, y + h * 0.4, w, Math.max(1.2, h * 0.05));
      ctx.fillStyle = tube(ctx, x + w * 0.16, w * 0.68, DARK);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, y + h * 0.46);
      ctx.quadraticCurveTo(cx - w * 0.3, bottomY - h * 0.08, cx - w * 0.42, bottomY);
      ctx.lineTo(cx + w * 0.42, bottomY);
      ctx.quadraticCurveTo(cx + w * 0.3, bottomY - h * 0.08, cx + w * 0.2, y + h * 0.46);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    case 'rcs': {
      ctx.fillStyle = tube(ctx, x + w * 0.3, w * 0.4, '#c6ccd4');
      roundRectPath(ctx, x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.6, w * 0.08);
      ctx.fill();
      ctx.fillStyle = shade(DARK, 0.15);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * w * 0.36, bottomY - h * (dy > 0 ? 0.24 : 0.62), w * 0.12, h * 0.08, dx * 0.6, 0, TAU);
        ctx.fill();
      }
      return true;
    }
    case 'ring': {
      // The whole row, top to bottom: a decoupler is a stretch of the rocket's own skin with the
      // cut in it, not a washer floating between two stages. It used to be drawn at sixty per cent
      // of its height, which left a band of sky above and below it that no real rocket has.
      ctx.fillStyle = tube(ctx, x, w, '#b7bec8');
      ctx.fillRect(x, y, w, h);
      // the separation line near the top, with the little charges along it
      const cutY = y + h * 0.22;
      ctx.fillStyle = 'rgba(30, 34, 42, 0.75)';
      ctx.fillRect(x, cutY - Math.max(0.8, h * 0.025), w, Math.max(1.6, h * 0.05));
      ctx.fillStyle = '#c0392b';
      const n = 6;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x + w * (0.1 + (0.8 * i) / (n - 1)), cutY + h * 0.14, Math.max(1, w * 0.03), 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + w * 0.3, y, w * 0.07, h);
      return true;
    }
    case 'strut': {
      ctx.strokeStyle = shade(COPPER, -0.05);
      ctx.lineWidth = Math.max(1.2, w * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, y + h * 0.12); ctx.lineTo(cx, bottomY - h * 0.12); ctx.stroke();
      return true;
    }
    case 'leg': {
      ctx.strokeStyle = shade(DARK, 0.3);
      ctx.lineWidth = Math.max(1.4, w * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s * w * 0.06, y + h * 0.1);
      ctx.lineTo(cx + s * w * 0.42, bottomY - h * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.28, bottomY - h * 0.1);
      ctx.lineTo(cx + s * w * 0.5, bottomY - h * 0.1);
      ctx.stroke();
      ctx.fillStyle = shade(DARK, 0.45);
      ctx.beginPath(); ctx.ellipse(cx + s * w * 0.4, bottomY - h * 0.06, w * 0.13, h * 0.06, 0, 0, TAU); ctx.fill();
      return true;
    }
    case 'chute': {
      ctx.fillStyle = tube(ctx, x + w * 0.2, w * 0.6, '#d5dbe3');
      roundRectPath(ctx, x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.62, w * 0.1);
      ctx.fill();
      ctx.fillStyle = '#e06a4a';
      ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, Math.max(1.2, h * 0.08));
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + w * 0.3, y + h * 0.2, w * 0.07, h * 0.62);
      return true;
    }
    case 'solar': {
      ctx.fillStyle = shade('#8a929c', 0);
      ctx.fillRect(cx - w * 0.04, y + h * 0.3, w * 0.08, h * 0.4);
      for (const sx of [-1, 1]) {
        const px = sx > 0 ? cx + w * 0.06 : cx - w * 0.46;
        ctx.fillStyle = '#20406b';
        ctx.fillRect(px, y + h * 0.22, w * 0.4, h * 0.56);
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
        ctx.lineWidth = Math.max(0.5, w * 0.008);
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(px + (w * 0.4 * i) / 4, y + h * 0.22);
          ctx.lineTo(px + (w * 0.4 * i) / 4, y + h * 0.78);
          ctx.stroke();
        }
      }
      return true;
    }
    case 'dish': {
      ctx.strokeStyle = shade('#9aa3ae', 0);
      ctx.lineWidth = Math.max(1, w * 0.06);
      ctx.beginPath(); ctx.moveTo(cx, bottomY); ctx.lineTo(cx + s * w * 0.2, y + h * 0.45); ctx.stroke();
      ctx.fillStyle = '#e4e9f0';
      ctx.beginPath();
      ctx.ellipse(cx + s * w * 0.24, y + h * 0.34, w * 0.3, h * 0.26, s * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,140,165,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx + s * w * 0.24, y + h * 0.34, w * 0.2, h * 0.17, s * 0.5, 0, TAU);
      ctx.fill();
      return true;
    }
    case 'lamp': {
      ctx.fillStyle = shade(DARK, 0.25);
      roundRectPath(ctx, cx - w * 0.22, y + h * 0.3, w * 0.44, h * 0.4, w * 0.1);
      ctx.fill();
      const glow = ctx.createRadialGradient(cx, y + h * 0.5, 0, cx, y + h * 0.5, w * 0.7);
      glow.addColorStop(0, 'rgba(255, 244, 190, 0.85)');
      glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, y + h * 0.5, w * 0.7, 0, TAU); ctx.fill();
      return true;
    }
    case 'camera': {
      ctx.fillStyle = shade(DARK, 0.2);
      roundRectPath(ctx, cx - w * 0.3, y + h * 0.28, w * 0.6, h * 0.44, w * 0.08);
      ctx.fill();
      ctx.fillStyle = '#6ec6ef';
      ctx.beginPath(); ctx.arc(cx + s * w * 0.1, y + h * 0.5, w * 0.16, 0, TAU); ctx.fill();
      return true;
    }
    case 'ladder': {
      ctx.strokeStyle = shade('#aeb6c2', 0);
      ctx.lineWidth = Math.max(0.8, w * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, y); ctx.lineTo(cx - w * 0.3, bottomY);
      ctx.moveTo(cx + w * 0.3, y); ctx.lineTo(cx + w * 0.3, bottomY);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.6, w * 0.12);
      const rungs = Math.max(3, part.rows * 3);
      for (let i = 0; i < rungs; i++) {
        const yy = y + (h * (i + 0.5)) / rungs;
        ctx.beginPath(); ctx.moveTo(cx - w * 0.3, yy); ctx.lineTo(cx + w * 0.3, yy); ctx.stroke();
      }
      return true;
    }
    case 'flag': {
      ctx.strokeStyle = shade('#aeb6c2', 0);
      ctx.lineWidth = Math.max(0.8, w * 0.14);
      ctx.beginPath(); ctx.moveTo(cx - s * w * 0.2, y); ctx.lineTo(cx - s * w * 0.2, bottomY); ctx.stroke();
      ctx.fillStyle = '#e06a4a';
      const wave = Math.sin(t * 2.2) * h * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx - s * w * 0.2, y + h * 0.06);
      ctx.quadraticCurveTo(cx + s * w * 0.2, y + h * 0.16 + wave, cx + s * w * 0.6, y + h * 0.1);
      ctx.lineTo(cx + s * w * 0.6, y + h * 0.42);
      ctx.quadraticCurveTo(cx + s * w * 0.2, y + h * 0.48 - wave, cx - s * w * 0.2, y + h * 0.38);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    case 'grid': {
      // a waffle of little blades, which is exactly what a real grid fin is
      for (const sx of [-1, 1]) {
        const gx = cx + sx * w * 0.32, gw = w * 0.3, gh = h * 0.72;
        ctx.fillStyle = 'rgba(150, 160, 175, 0.55)';
        ctx.fillRect(gx - gw / 2, y + h * 0.14, gw, gh);
        ctx.strokeStyle = shade('#8a929c', -0.1);
        ctx.lineWidth = Math.max(0.5, w * 0.012);
        for (let i = 1; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(gx - gw / 2 + (gw * i) / 4, y + h * 0.14); ctx.lineTo(gx - gw / 2 + (gw * i) / 4, y + h * 0.14 + gh); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(gx - gw / 2, y + h * 0.14 + (gh * i) / 4); ctx.lineTo(gx + gw / 2, y + h * 0.14 + (gh * i) / 4); ctx.stroke();
        }
      }
      return true;
    }
    case 'wing': {
      ctx.fillStyle = tube(ctx, x, w, '#c3cad4');
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.1);
      ctx.lineTo(cx + s * w * 0.5, bottomY - h * 0.08);
      ctx.lineTo(cx + s * w * 0.12, bottomY);
      ctx.lineTo(cx, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(40,48,60,0.18)';
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.1);
      ctx.lineTo(cx + s * w * 0.5, bottomY - h * 0.08);
      ctx.lineTo(cx + s * w * 0.42, bottomY - h * 0.05);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    case 'brake': {
      ctx.fillStyle = shade('#aeb6c2', 0);
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + sx * w * 0.3, y + h * 0.5);
        ctx.rotate(sx * 0.5);
        ctx.fillRect(-w * 0.16, -h * 0.34, w * 0.32, h * 0.68);
        ctx.restore();
      }
      ctx.fillStyle = '#e06a4a';
      ctx.fillRect(cx - w * 0.06, y + h * 0.2, w * 0.12, h * 0.6);
      return true;
    }
    default:
      return false;
  }
}

/**
 * A nose cone on top of a capsule, drawn as what really sits there: a launch escape tower.
 *
 * A capsule is already pointed, and a second cone balanced on its tip read as two cones stacked on
 * each other, which is not how anything flies. Apollo, Soyuz and Orion all carry a thin tower on
 * the capsule's point instead: a lattice, a small rocket that could pull the crew clear, and a
 * sharp tip. It stands on the capsule's point and is no wider than the point is.
 */
export function paintEscapeTower(ctx: Ctx, cx: number, bottomY: number, w: number, h: number): void {
  const tw = w * 0.34;
  const latticeTop = bottomY - h * 0.42;
  ctx.save();
  ctx.strokeStyle = '#c0473a';
  ctx.lineWidth = Math.max(0.8, w * 0.035);
  ctx.lineCap = 'round';
  // the lattice: two legs and crossed braces
  ctx.beginPath();
  ctx.moveTo(cx - tw * 0.5, bottomY); ctx.lineTo(cx - tw * 0.18, latticeTop);
  ctx.moveTo(cx + tw * 0.5, bottomY); ctx.lineTo(cx + tw * 0.18, latticeTop);
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const k0 = i / steps, k1 = (i + 1) / steps;
    const y0 = bottomY - (bottomY - latticeTop) * k0, y1 = bottomY - (bottomY - latticeTop) * k1;
    const hw0 = tw * (0.5 - 0.32 * k0), hw1 = tw * (0.5 - 0.32 * k1);
    ctx.moveTo(cx - hw0, y0); ctx.lineTo(cx + hw1, y1);
    ctx.moveTo(cx + hw0, y0); ctx.lineTo(cx - hw1, y1);
  }
  ctx.stroke();
  // the escape motor, with its nozzles angled out at the foot
  const mw = tw * 0.42, mTop = bottomY - h * 0.86;
  ctx.fillStyle = tube(ctx, cx - mw / 2, mw, WHITE);
  ctx.fillRect(cx - mw / 2, mTop, mw, latticeTop - mTop);
  ctx.fillStyle = DARK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * mw * 0.3, latticeTop - h * 0.02);
    ctx.lineTo(cx + s * mw * 0.95, latticeTop + h * 0.05);
    ctx.lineTo(cx + s * mw * 0.55, latticeTop + h * 0.07);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#c0473a';
  ctx.fillRect(cx - mw / 2, mTop + (latticeTop - mTop) * 0.35, mw, Math.max(1, h * 0.04));
  // and the sharp tip
  ctx.fillStyle = tube(ctx, cx - mw / 2, mw, WHITE);
  ctx.beginPath();
  ctx.moveTo(cx, bottomY - h);
  ctx.lineTo(cx + mw / 2, mTop);
  ctx.lineTo(cx - mw / 2, mTop);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The interstage: the skin that closes the gap between a decoupler and the stage above it, with
 * that stage's engine inside. On a real rocket you never see the upper engine until the stage
 * under it has gone - it is hidden in this skirt, and the skirt falls away with the decoupler.
 * In the workshop it is drawn as glass, so a child still sees the engine they have just put there.
 */
export function paintSkirt(
  ctx: Ctx, cx: number, bottomY: number, wBottom: number, wTop: number, h: number, ghost: boolean,
): void {
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.38;
  const xb = cx - wBottom / 2;
  ctx.fillStyle = tube(ctx, xb, wBottom, '#d9dee5');
  ctx.beginPath();
  ctx.moveTo(cx - wBottom / 2, bottomY);
  ctx.lineTo(cx - wTop / 2, bottomY - h);
  ctx.lineTo(cx + wTop / 2, bottomY - h);
  ctx.lineTo(cx + wBottom / 2, bottomY);
  ctx.closePath();
  ctx.fill();
  // stringers down the skirt, the way an interstage is built
  ctx.strokeStyle = 'rgba(40, 48, 60, 0.18)';
  ctx.lineWidth = Math.max(0.6, wBottom * 0.012);
  for (let k = 1; k < 6; k++) {
    const f = k / 6 - 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + f * wBottom, bottomY);
    ctx.lineTo(cx + f * wTop, bottomY - h);
    ctx.stroke();
  }
  ctx.restore();
}

/** What a part looks like when nothing more specific is asked for. */
const DEFAULT_ART: Record<string, string> = {
  nose: 'cone', pod: 'capsule', tank: 'tank', engine: 'bell', solid: 'solid', fin: 'fin', truss: 'truss',
};

export function paintPart(
  ctx: Ctx, part: Part, cx: number, bottomY: number, u: number, t: number,
  side = 0, wu = part.w, wTop = wu,
): void {
  const w = wu * u, h = part.rows * u;
  const x = cx - w / 2, y = bottomY - h;
  const art = part.art ?? DEFAULT_ART[part.kind] ?? 'tank';
  if (paintSpecial(ctx, art, part, cx, bottomY, u, t, side, w, h, x, y)) return;

  if (art === 'cone' || art === 'needle' || art === 'blunt' || art === 'fairing') {
    if (art === 'fairing') {
      // a two-piece shell with the split line down the middle, which is what a real one looks like
      ctx.fillStyle = tube(ctx, x, w, WHITE);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(x + w * 0.03, y + h * 0.55, x, bottomY);
      ctx.lineTo(x + w, bottomY);
      ctx.quadraticCurveTo(x + w * 0.97, y + h * 0.55, cx, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,48,60,0.3)';
      ctx.lineWidth = Math.max(0.8, w * 0.02);
      ctx.beginPath(); ctx.moveTo(cx, y + h * 0.06); ctx.lineTo(cx, bottomY); ctx.stroke();
      return;
    }
    // a plain cone: a hundred kilos, and the cheapest speed in the game
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.66, x, bottomY);
    ctx.lineTo(x + w, bottomY);
    ctx.quadraticCurveTo(x + w * 0.94, y + h * 0.66, cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0473a';
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.42, y + h * 0.16, x + w * 0.38, y + h * 0.3);
    ctx.lineTo(x + w * 0.62, y + h * 0.3);
    ctx.quadraticCurveTo(x + w * 0.58, y + h * 0.16, cx, y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (art === 'shuttle') {
    // an orbiter seen from the side: a fat white body, a black belly, a swept wing and a fin
    const s = side || 1;
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(s, 1);
    ctx.translate(-cx, 0);
    const bx = cx - w * 0.28;
    ctx.fillStyle = tube(ctx, bx, w * 0.72, WHITE);
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.36, y);
    ctx.quadraticCurveTo(bx + w * 0.72, y + h * 0.2, bx + w * 0.7, y + h * 0.5);
    ctx.lineTo(bx + w * 0.66, bottomY);
    ctx.lineTo(bx + w * 0.06, bottomY);
    ctx.quadraticCurveTo(bx - w * 0.02, y + h * 0.3, bx + w * 0.36, y);
    ctx.closePath();
    ctx.fill();
    // the swept wing
    ctx.fillStyle = shade(WHITE, -0.22);
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.62, y + h * 0.5);
    ctx.lineTo(bx + w * 1.0, bottomY - h * 0.06);
    ctx.lineTo(bx + w * 0.62, bottomY - h * 0.06);
    ctx.closePath();
    ctx.fill();
    // the tail fin
    ctx.fillStyle = shade(WHITE, -0.08);
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.38, y + h * 0.12);
    ctx.lineTo(bx + w * 0.12, y + h * 0.42);
    ctx.lineTo(bx + w * 0.4, y + h * 0.42);
    ctx.closePath();
    ctx.fill();
    // the black belly and the three bells
    ctx.fillStyle = 'rgba(38, 42, 50, 0.9)';
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.36, y + h * 0.02);
    ctx.quadraticCurveTo(bx + w * 0.68, y + h * 0.22, bx + w * 0.66, y + h * 0.5);
    ctx.lineTo(bx + w * 0.62, bottomY);
    ctx.lineTo(bx + w * 0.5, bottomY);
    ctx.quadraticCurveTo(bx + w * 0.54, y + h * 0.3, bx + w * 0.36, y + h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DARK;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(bx + w * (0.2 + i * 0.16), bottomY - h * 0.02, w * 0.07, h * 0.05, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#7fd2f2';
    ctx.beginPath();
    ctx.ellipse(bx + w * 0.34, y + h * 0.12, w * 0.07, h * 0.04, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (art === 'capsule' || art === 'probe') {
    // a cone with a window, and only the very tip dark: a cone that is half black reads as a pencil
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.02, y + h * 0.74, x, bottomY);
    ctx.lineTo(x + w, bottomY);
    ctx.quadraticCurveTo(x + w * 0.98, y + h * 0.74, cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#39404a';
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(x + w * 0.43, y + h * 0.12, x + w * 0.39, y + h * 0.22);
    ctx.lineTo(x + w * 0.61, y + h * 0.22);
    ctx.quadraticCurveTo(x + w * 0.57, y + h * 0.12, cx, y);
    ctx.closePath();
    ctx.fill();
    const wins = part.rows >= 3 ? 2 : 1;
    for (let i = 0; i < wins; i++) {
      const wy = y + h * (wins === 1 ? 0.62 : 0.5 + i * 0.22);
      ctx.fillStyle = '#7fd2f2';
      ctx.beginPath(); ctx.ellipse(cx - w * 0.02, wy, w * 0.14, h * (0.1 / wins), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.07, wy - h * 0.02, w * 0.05, h * (0.035 / wins), -0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = shade(DARK, 0.1);
    roundRectPath(ctx, x, bottomY - h * 0.09, w, h * 0.09, w * 0.02);
    ctx.fill();
    return;
  }

  if (art === 'tank' || art === 'ribbed' || art === 'balloon') {
    ctx.fillStyle = tube(ctx, x, w, WHITE);
    ctx.fillRect(x, y, w, h);
    seams(ctx, x, y, w, h, Math.max(2, part.rows * 2));
    // a painted band, so two tanks on top of each other still read as two
    ctx.fillStyle = 'rgba(190, 62, 48, 0.85)';
    ctx.fillRect(x, y + h * 0.05, w, Math.max(1.5, h * 0.045));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + w * 0.3, y, w * 0.07, h);
    return;
  }

  if (art === 'solid') {
    // Fuel and engine in one casing: a pointed cap, a long body and a small nozzle. A double or a
    // triple is drawn as the two or three tubes it actually is, strapped side by side.
    const n = part.tubes ?? 1;
    const tw = w / n;
    for (let i = 0; i < n; i++) {
      const tx = x + i * tw, tcx = tx + tw / 2;
      ctx.fillStyle = tube(ctx, tx, tw, WHITE);
      roundRectPath(ctx, tx, y + h * 0.12, tw, h * 0.78, tw * 0.16);
      ctx.fill();
      ctx.fillStyle = tube(ctx, tx, tw, '#d9dee6');
      ctx.beginPath();
      ctx.moveTo(tcx, y);
      ctx.quadraticCurveTo(tx + tw * 0.04, y + h * 0.1, tx, y + h * 0.17);
      ctx.lineTo(tx + tw, y + h * 0.17);
      ctx.quadraticCurveTo(tx + tw * 0.96, y + h * 0.1, tcx, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 62, 48, 0.75)';
      ctx.fillRect(tx, y + h * 0.22, tw, Math.max(1.2, h * 0.028));
      ctx.fillStyle = tube(ctx, tx + tw * 0.12, tw * 0.76, DARK);
      ctx.beginPath();
      ctx.moveTo(tx + tw * 0.28, bottomY - h * 0.1);
      ctx.lineTo(tx + tw * 0.72, bottomY - h * 0.1);
      ctx.lineTo(tx + tw * 0.88, bottomY);
      ctx.lineTo(tx + tw * 0.12, bottomY);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  if (art === 'fin') {
    // A fin bolted to the left of the rocket sweeps left and a fin on the right sweeps right, so
    // `side` says which way this one is leaning. In the middle of nothing it grows both ways, the
    // way it does on the shelf.
    const ways = side === 0 ? [-1, 1] : [side];
    ctx.fillStyle = tube(ctx, x, w, COPPER);
    for (const s of ways) {
      ctx.beginPath();
      ctx.moveTo(cx + s * u * 0.2, y);
      ctx.lineTo(cx + s * w * 0.5, bottomY);
      ctx.lineTo(cx + s * u * 0.2, bottomY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = shade(COPPER, -0.26);
    ctx.fillRect(cx - u * 0.1, y, u * 0.2, h);
    return;
  }

  if (art === 'truss' || art === 'taper') {
    if (art === 'taper') {
      // A taper: exactly as wide at the foot as the thing under it and as wide at the shoulder as
      // the thing on top, so a rocket narrows instead of stepping down in ledges.
      // on the shelf there is nothing above or below it, so it shows what it is for
      const tw = (wTop === wu ? wu * 0.6 : wTop) * u;
      ctx.fillStyle = tube(ctx, x, w, '#c3cad4');
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2, y);
      ctx.lineTo(cx + tw / 2, y);
      ctx.lineTo(cx + w / 2, bottomY);
      ctx.lineTo(cx - w / 2, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(40,48,60,0.18)';
      ctx.fillRect(cx - tw / 2, y, tw, Math.max(1, h * 0.08));
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.2, y);
      ctx.lineTo(cx - tw * 0.08, y);
      ctx.lineTo(cx - w * 0.06, bottomY);
      ctx.lineTo(cx - w * 0.2, bottomY);
      ctx.closePath();
      ctx.fill();
      return;
    }
    // open framework: four uprights and a row of crosses, which is what makes it read as weightless
    ctx.strokeStyle = shade(COPPER, -0.1);
    ctx.lineWidth = Math.max(1, w * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y); ctx.lineTo(x + w * 0.12, bottomY);
    ctx.moveTo(x + w * 0.88, y); ctx.lineTo(x + w * 0.88, bottomY);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, w * 0.1);
    const bays = Math.max(2, part.rows * 2);
    for (let i = 0; i < bays; i++) {
      const y0 = y + (h * i) / bays, y1 = y + (h * (i + 1)) / bays;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.12, y0); ctx.lineTo(x + w * 0.88, y1);
      ctx.moveTo(x + w * 0.88, y0); ctx.lineTo(x + w * 0.12, y1);
      ctx.stroke();
    }
    return;
  }

  // an engine: a short body and one or more bells
  const bells = part.bells ?? 1;
  const bellTop = part.exhaust >= 3900 ? 0.3 : 0.46;
  ctx.fillStyle = tube(ctx, x, w, WHITE);
  roundRectPath(ctx, x, y, w, h * (bellTop + 0.04), w * 0.04);
  ctx.fill();
  const bw = (w * 0.94) / bells;
  for (let i = 0; i < bells; i++) {
    const bx = x + w * 0.03 + i * bw + bw / 2;
    const top = y + h * bellTop;
    const flare = part.exhaust >= 3900 ? 0.62 : 0.46;
    ctx.fillStyle = tube(ctx, bx - bw * flare, bw * flare * 2, DARK);
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.2, top);
    ctx.quadraticCurveTo(bx - bw * 0.3, bottomY - h * 0.1, bx - bw * flare, bottomY);
    ctx.lineTo(bx + bw * flare, bottomY);
    ctx.quadraticCurveTo(bx + bw * 0.3, bottomY - h * 0.1, bx + bw * 0.2, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.1, top);
    ctx.quadraticCurveTo(bx - bw * 0.16, bottomY - h * 0.1, bx - bw * 0.26, bottomY);
    ctx.lineTo(bx - bw * 0.14, bottomY);
    ctx.quadraticCurveTo(bx - bw * 0.06, bottomY - h * 0.1, bx - bw * 0.02, top);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(30, 34, 42, 0.5)';
  ctx.fillRect(x, y + h * (bellTop - 0.03), w, Math.max(1, h * 0.03));
}

// ---------------------------------------------------------------- the whole rocket

export interface Box { i: number; x: number; y: number; w: number; h: number }

/** The box one placed part occupies on screen, in the same frame paintDesign draws into. */
export function boxOf(
  part: Part, col: number, row: number, ox: number, oy: number, u: number,
): Box {
  const cx = ox + (col + 0.5) * u;
  const bottom = oy - row * u;
  return { i: -1, x: cx - (part.w * u) / 2, y: bottom - part.rows * u, w: part.w * u, h: part.rows * u };
}

/**
 * Draw a design on the grid.
 *
 * `ox` is the screen x of column zero's left edge and `oy` the screen y of row zero's floor, so a
 * part in column c on row r stands where the grid says it does and nowhere else. Side columns are
 * painted before the middle one, so where a booster meets the core the core is on top and the join
 * disappears - which is the whole trick to making bolted-on parts look bolted on.
 */
export function paintDesign(
  ctx: Ctx, design: Design, ox: number, oy: number, u: number, t: number,
  opts: { dropped?: ReadonlySet<number>; centre?: number; fade?: number; ghostSkirts?: boolean } = {},
): Box[] {
  const boxes: Box[] = [];
  const dropped = opts.dropped;
  const centre = opts.centre ?? 4;
  const order = design
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !dropped?.has(i))
    // furthest from the middle first, and fins behind everything
    .sort((a, b) => {
      const fa = partById(a.p.id).kind === 'fin' ? 1 : 0;
      const fb = partById(b.p.id).kind === 'fin' ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return Math.abs(b.p.col - centre) - Math.abs(a.p.col - centre);
    });
  for (const { p, i } of order) {
    const part = partById(p.id);
    const cx = ox + (part.kind === 'fin' ? finAnchor(design, i, centre) : p.col + 0.5) * u;
    const bottom = oy - p.row * u;
    const side = part.kind === 'fin' || part.id === 'shuttle' ? (Math.sign(p.col - centre) || 1) : 0;
    const wu = widthOf(design, i);
    const wTop = part.id === 'adapter' ? taperSpan(design, i).top : wu;
    const wBottom = part.id === 'adapter' ? taperSpan(design, i).bottom : wu;
    if (opts.fade !== undefined) { ctx.save(); ctx.globalAlpha = opts.fade; }
    const under = below(design, i, dropped);
    const base = under ? partById(under.id) : null;
    if (part.kind === 'nose' && base && POINTED_PODS.has(base.art ?? DEFAULT_ART[base.kind])) {
      paintEscapeTower(ctx, cx, bottom, base.w * u, part.rows * u);
    } else if (part.kind === 'nose' && base && (base.art ?? DEFAULT_ART[base.kind]) === 'solid' && (base.tubes ?? 1) === 1 && (part.art ?? 'cone') === 'cone') {
      // A booster already ends in a pointed cap, so a cone on it used to float over a second
      // point. The cone takes the cap's place instead: one nose, as wide as the casing it closes.
      const cap = base.rows * 0.17;
      paintPart(ctx, { ...part, rows: part.rows + cap }, cx, bottom + cap * u, u, t, side, base.w, base.w);
    } else {
      paintPart(ctx, part, cx, bottom, u, t, side, wBottom, wTop);
    }
    if (opts.fade !== undefined) ctx.restore();
    boxes.push({ i, x: cx - (wu * u) / 2, y: bottom - part.rows * u, w: wu * u, h: part.rows * u });
  }
  // the skirts go on last, over the engines they hide
  design.forEach((p, i) => {
    if (dropped?.has(i) || partById(p.id).art !== 'ring') return;
    const k = design.findIndex((q, j) => j !== i && !dropped?.has(j) && q.col === p.col && q.row === topRow(p) + 1);
    if (k < 0 || partById(design[k].id).kind !== 'engine') return;
    const eng = partById(design[k].id);
    const cx = ox + (p.col + 0.5) * u;
    paintSkirt(ctx, cx, oy - (topRow(p) + 1) * u, widthOf(design, i) * u, eng.w * u, eng.rows * u, !!opts.ghostSkirts);
  });
  return boxes;
}

/** Pods with a point of their own, on which a nose cone is drawn as an escape tower. */
const POINTED_PODS = new Set(['capsule', 'probe']);

/** The part standing directly under this one in its column, if any is still attached. */
function below(design: Design, i: number, dropped?: ReadonlySet<number>): Design[number] | null {
  const p = design[i];
  return design.find((q, j) => j !== i && !dropped?.has(j) && q.col === p.col && topRow(q) + 1 === p.row) ?? null;
}

/** How tall and wide the built rocket is, in grid cells, for fitting it on the screen. */
export function designBounds(design: Design): { c0: number; c1: number; r0: number; r1: number } {
  if (!design.length) return { c0: 4, c1: 4, r0: 0, r1: 1 };
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const p of design) {
    c0 = Math.min(c0, p.col);
    c1 = Math.max(c1, p.col);
    r0 = Math.min(r0, p.row);
    r1 = Math.max(r1, topRow(p) + 1);
  }
  return { c0, c1, r0, r1 };
}

// ---------------------------------------------------------------- fire

/**
 * The flame. Two cones and a glow: a bright white core, a wider orange body that flickers, and a
 * pool of light on whatever is underneath. In thin air the flame spreads out, which is a real
 * thing and looks like the real pictures.
 */
export function paintFlame(
  ctx: Ctx, cx: number, y: number, width: number, power: number, spread: number, t: number,
): void {
  if (power <= 0.01) return;
  const flick = 0.82 + Math.sin(t * 38) * 0.08 + Math.sin(t * 23.7) * 0.06;
  const len = width * (2.6 + spread * 2.2) * power * flick;
  const wide = width * (0.52 + spread * 0.75);
  ctx.save();
  const glow = ctx.createRadialGradient(cx, y + len * 0.25, 0, cx, y + len * 0.25, len * 0.9);
  glow.addColorStop(0, `rgba(255, 226, 150, ${0.5 * power})`);
  glow.addColorStop(0.5, `rgba(255, 150, 60, ${0.18 * power})`);
  glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, y + len * 0.25, len * 0.9, 0, TAU); ctx.fill();

  const body = ctx.createLinearGradient(0, y, 0, y + len);
  body.addColorStop(0, 'rgba(255, 248, 226, 0.95)');
  body.addColorStop(0.35, 'rgba(255, 190, 96, 0.9)');
  body.addColorStop(1, 'rgba(226, 96, 40, 0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - wide, y);
  ctx.quadraticCurveTo(cx - wide * 0.7, y + len * 0.6, cx, y + len);
  ctx.quadraticCurveTo(cx + wide * 0.7, y + len * 0.6, cx + wide, y);
  ctx.closePath();
  ctx.fill();

  const core = ctx.createLinearGradient(0, y, 0, y + len * 0.7);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx - wide * 0.4, y);
  ctx.quadraticCurveTo(cx - wide * 0.24, y + len * 0.4, cx, y + len * 0.7);
  ctx.quadraticCurveTo(cx + wide * 0.24, y + len * 0.4, cx + wide * 0.4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the ground

const padLayer = new CachedLayer();

/** The pad, the tower and the flat country around it: painted once and blitted after that. */
export function paintPad(ctx: Ctx, w: number, groundY: number, u: number): void {
  const h = Math.max(1, Math.round(u * 6));
  const cv = padLayer.get(w, h, `pad${Math.round(u)}`, (lc, lw, lh) => {
    lc.fillStyle = vGrad(lc, 0, lh, '#8a8578', '#57534a');
    lc.fillRect(0, 0, lw, lh);
    // scrub on the plain
    const rng = makeRng(7);
    for (let i = 0; i < 70; i++) {
      const x = rng() * lw, y = lh * (0.05 + rng() * 0.9);
      lc.fillStyle = `rgba(${90 + rng() * 40 | 0}, ${96 + rng() * 40 | 0}, 70, 0.4)`;
      blobPath(lc, x, y, u * (0.1 + rng() * 0.22), i, 0.4, 7);
      lc.fill();
    }
    // the apron
    lc.fillStyle = '#9a968c';
    roundRectPath(lc, lw / 2 - u * 4.2, 0, u * 8.4, lh * 0.5, u * 0.3);
    lc.fill();
    lc.fillStyle = 'rgba(255,255,255,0.14)';
    roundRectPath(lc, lw / 2 - u * 4.2, 0, u * 8.4, u * 0.18, u * 0.08);
    lc.fill();
    // the flame trench: a slot, not a slab
    lc.fillStyle = '#3d3a34';
    roundRectPath(lc, lw / 2 - u * 0.55, 0, u * 1.1, lh * 0.2, u * 0.1);
    lc.fill();
    lc.fillStyle = 'rgba(20, 18, 16, 0.5)';
    roundRectPath(lc, lw / 2 - u * 0.4, 0, u * 0.8, lh * 0.14, u * 0.08);
    lc.fill();
  });
  if (cv) ctx.drawImage(cv, 0, groundY);
}

/** The service tower beside the pad, so the rocket has something to be tall against. */
export function paintTower(ctx: Ctx, x: number, baseY: number, u: number, tall: number): void {
  const w = u * 1.1;
  ctx.save();
  contactShadow(ctx, x, baseY, w * 1.4, u * 0.3, 0.35);
  ctx.strokeStyle = '#6f6a60';
  ctx.lineWidth = Math.max(1.2, u * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY); ctx.lineTo(x - w / 2, baseY - tall);
  ctx.moveTo(x + w / 2, baseY); ctx.lineTo(x + w / 2, baseY - tall);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, u * 0.05);
  const step = u * 0.75;
  for (let y = baseY; y > baseY - tall; y -= step) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y - step * 0.5);
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x - w / 2, y - step * 0.5);
    ctx.moveTo(x - w / 2, y - step * 0.5); ctx.lineTo(x + w / 2, y - step * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Clouds the rocket goes through, drawn as flat lumps because that is how they look from below. */
export function paintCloud(ctx: Ctx, x: number, y: number, r: number, alpha: number, seed: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  for (const [dx, dy, k, a] of [[-0.55, 0.1, 0.62, 0.9], [0.5, 0.14, 0.55, 0.85], [0, -0.1, 0.8, 1]] as const) {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    blobPath(ctx, x + dx * r, y + dy * r, r * k, seed + dx * 10, 0.16);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(206, 220, 236, 0.75)';
  blobPath(ctx, x, y + r * 0.34, r * 0.9, seed + 3, 0.12);
  ctx.fill();
  ctx.restore();
}

/**
 * The things you go past on the way up.
 *
 * A number on the left saying 30 km means very little at six. Going past a flock of birds, then a
 * weather balloon, then a satellite, in that order, means a great deal, and each one is at roughly
 * the height it really flies.
 */
export function paintBirds(ctx: Ctx, x: number, y: number, u: number, alpha: number, t: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.strokeStyle = '#33465f';
  ctx.lineWidth = Math.max(1.4, u * 0.1);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = x + ((i % 3) - 1) * u * 2.4 + (i > 2 ? u * 1.2 : 0);
    const by = y + Math.floor(i / 3) * u * 1.6 + Math.sin(t * 3 + i) * u * 0.22;
    const flap = Math.sin(t * 6 + i * 1.7) * 0.45;
    const wing = u * 0.9;
    ctx.beginPath();
    ctx.moveTo(bx - wing, by + flap * wing);
    ctx.quadraticCurveTo(bx - wing * 0.35, by - wing * 0.35, bx, by);
    ctx.quadraticCurveTo(bx + wing * 0.35, by - wing * 0.35, bx + wing, by + flap * wing);
    ctx.stroke();
  }
  ctx.restore();
}

/** A weather balloon, which really does hang about at thirty kilometres. */
export function paintBalloon(ctx: Ctx, x: number, y: number, u: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const r = u * 1.7;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(212, 228, 244, 0.85)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.86, r, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, u * 0.07);
  ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y + r * 2.1); ctx.stroke();
  ctx.fillStyle = '#f0a33c';
  ctx.beginPath(); ctx.roundRect(x - r * 0.3, y + r * 2.1, r * 0.6, r * 0.5, r * 0.15); ctx.fill();
  ctx.restore();
}

/** A satellite going the other way, out where they actually orbit. */
export function paintSatellite(ctx: Ctx, x: number, y: number, u: number, alpha: number, spin: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = '#cfd9e6';
  ctx.beginPath(); ctx.roundRect(-u * 0.5, -u * 0.7, u, u * 1.4, u * 0.2); ctx.fill();
  ctx.fillStyle = '#3f6fb5';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(side * u * 0.7 - (side < 0 ? u * 1.5 : 0), -u * 0.45, u * 1.5, u * 0.9, u * 0.1); ctx.fill();
  }
  ctx.strokeStyle = '#8fa4bd';
  ctx.lineWidth = Math.max(1, u * 0.08);
  ctx.beginPath(); ctx.moveTo(0, -u * 0.7); ctx.lineTo(0, -u * 1.4); ctx.stroke();
  ctx.restore();
}

/** The Earth falling away below, once there is enough height to see it curve. */
export function paintEarthBelow(ctx: Ctx, w: number, h: number, altM: number, u: number): void {
  const k = clamp((altM - 60000) / 400000, 0, 1);
  if (k <= 0) return;
  const r = w * (2.6 - k * 1.5);
  const cy = h + r - h * 0.1 * k;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.6, 0, 1);
  const g = ctx.createRadialGradient(w * 0.34, cy - r * 0.6, r * 0.05, w / 2, cy, r);
  g.addColorStop(0, '#6fb7e8');
  g.addColorStop(0.55, '#2f79b8');
  g.addColorStop(1, '#12406e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, TAU); ctx.fill();
  // a rim of air on the limb, which is the thing everyone recognises from the photographs
  ctx.strokeStyle = 'rgba(150, 214, 255, 0.75)';
  ctx.lineWidth = Math.max(2, u * 0.16);
  ctx.beginPath(); ctx.arc(w / 2, cy, r + ctx.lineWidth * 0.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}

/** A soft grain over the whole frame, the same one the rest of Suri uses. */
export const paintGrain = (ctx: Ctx, w: number, h: number): void => grainOver(ctx, 0, 0, w, h, 0.045);

export { breathe };
