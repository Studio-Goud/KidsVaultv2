/** Hub card for Liedjesmaker: a warm stage, a row of slots with three animals in them, a note. */
import { drawAnimal, drawNote, BODY } from '../games/liedje/paint';

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawSongThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffe9bd'); g.addColorStop(1, '#ffcf94');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c98b52'; ctx.fillRect(0, h * 0.8, w, h * 0.2);
  const s = w * 0.2, gap = w * 0.04, x0 = (w - (4 * s + 3 * gap)) / 2, y = h * 0.34;
  const row = ['frog', 'cat', 'bird', null] as const;
  row.forEach((a, i) => {
    const x = x0 + i * (s + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.roundRect(x, y, s, s, s * 0.2); ctx.fill();
    if (a) drawAnimal(ctx, a, x + s / 2, y + s * 0.52, s * 0.32);
    else { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(150,100,60,0.55)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
  });
  drawNote(ctx, x0 + s * 1.5 + gap, y - h * 0.04, h * 0.2, BODY.cat, 0.9);
  drawNote(ctx, x0 + s * 3.1 + gap * 2, y - h * 0.1, h * 0.17, BODY.bird, 0.9);
}
