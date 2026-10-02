/**
 * The hub card for Vingerverf: a sheet on the table with a red and a yellow stroke crossing into
 * orange, a blue one, and a pot of paint. Self contained, like the other thumbnails.
 */

const TAU = Math.PI * 2;

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawPaintThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#e2c697'); bg.addColorStop(1, '#c9a272');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // the sheet
  ctx.save();
  ctx.translate(w * 0.5, h * 0.46); ctx.rotate(-0.05);
  ctx.shadowColor = 'rgba(60,36,12,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#f7f1e4';
  ctx.fillRect(-w * 0.4, -h * 0.36, w * 0.8, h * 0.66);
  ctx.shadowColor = 'transparent';
  ctx.lineCap = 'round';
  const stroke = (col: string, rim: string, pts: number[][], wd: number): void => {
    for (const [colr, lw] of [[rim, wd + 2.4], [col, wd]] as Array<[string, number]>) {
      ctx.strokeStyle = colr; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
      ctx.stroke();
    }
  };
  const k = w / 120;
  stroke('#2f6fd0', '#244f94', [[-38 * k, 14 * k], [-20 * k, -10 * k], [10 * k, 22 * k], [36 * k, 2 * k]], 9 * k);
  stroke('#e0343a', '#a82227', [[-34 * k, -18 * k], [-10 * k, -26 * k], [0, 0], [30 * k, 18 * k]], 9 * k);
  stroke('#f6cf2e', '#c29c14', [[-36 * k, 4 * k], [-14 * k, 16 * k], [10 * k, -24 * k], [34 * k, -14 * k]], 9 * k);
  // where red crosses yellow
  ctx.fillStyle = '#eb5a28';
  ctx.beginPath(); ctx.arc(-4 * k, -4 * k, 5.2 * k, 0, TAU); ctx.fill();
  ctx.restore();
  // a pot at the corner
  ctx.fillStyle = '#faf6ee';
  ctx.beginPath(); ctx.roundRect(w * 0.82, h * 0.72, w * 0.13, h * 0.2, 4); ctx.fill();
  ctx.fillStyle = '#2f6fd0';
  ctx.beginPath(); ctx.ellipse(w * 0.885, h * 0.72, w * 0.062, h * 0.045, 0, 0, TAU); ctx.fill();
}
