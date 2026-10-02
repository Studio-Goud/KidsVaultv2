/** The hub card for Postbode Suri: three doors with numbers on a sunny street and a letter on its way. */

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawPostThumb(c: HTMLCanvasElement): void {
  const ctx = fit(c);
  const w = c.clientWidth || 120, h = c.clientHeight || 90;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8fcff0'); sky.addColorStop(1, '#e6f6fc');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const ground = h * 0.8;
  const walls = ['#e9a38f', '#f3d98b', '#9fc7e8'], doors = ['#c0392b', '#2f8f5b', '#7a4aa3'];
  const hw = w * 0.31, gap = w * 0.025;
  for (let i = 0; i < 3; i++) {
    const x = gap + i * (hw + gap), top = h * 0.26, bodyTop = h * 0.4;
    ctx.fillStyle = '#7a4a3c';
    ctx.beginPath(); ctx.moveTo(x - 2, bodyTop); ctx.lineTo(x + hw / 2, top); ctx.lineTo(x + hw + 2, bodyTop); ctx.fill();
    ctx.fillStyle = walls[i]; ctx.fillRect(x, bodyTop, hw, ground - bodyTop);
    ctx.fillStyle = doors[i]; ctx.beginPath(); ctx.roundRect(x + hw * 0.33, ground - h * 0.22, hw * 0.34, h * 0.22, [4, 4, 0, 0]); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x + hw * 0.27, bodyTop + h * 0.04, hw * 0.46, h * 0.15, 3); ctx.fill();
    ctx.fillStyle = '#123047'; ctx.font = `900 ${Math.round(h * 0.13)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + hw / 2, bodyTop + h * 0.155);
  }
  ctx.fillStyle = '#cfc7bb'; ctx.fillRect(0, ground, w, h - ground);
  // the letter, on its way
  ctx.save();
  ctx.translate(w * 0.8, h * 0.17); ctx.rotate(-0.2);
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-14, -9, 28, 18, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(0, 2); ctx.lineTo(14, -9); ctx.stroke();
  ctx.restore();
}
