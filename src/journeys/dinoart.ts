/**
 * The one stop on the dinosaur journey that no photograph can cover: the moment the asteroid came.
 *
 * Everything else on this journey is a real fossil in a real museum, because that is what we
 * actually have of the dinosaurs - bones, not pictures. Nobody photographed the impact, so it is
 * drawn: a stone from the sky over a dark sea, and the glow of what is about to happen. A
 * silhouette in the colour the world was then, like the drawn stops on the dive.
 *
 * Draws inside a circle of radius `r` around the origin; the caller has already clipped to it.
 */

type Ctx = CanvasRenderingContext2D;

export function impact(ctx: Ctx, r: number): void {
  // the sky, already going red on the side the stone is coming from
  const sky = ctx.createLinearGradient(-r, -r, r * 0.6, r * 0.4);
  sky.addColorStop(0, '#ffb35c');
  sky.addColorStop(0.35, '#a8443a');
  sky.addColorStop(1, '#2a1a24');
  ctx.fillStyle = sky;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  // the trail, long and bright, and the stone at its head
  const hx = r * 0.18, hy = r * 0.08;
  const trail = ctx.createLinearGradient(-r * 0.9, -r * 0.95, hx, hy);
  trail.addColorStop(0, 'rgba(255, 240, 200, 0)');
  trail.addColorStop(1, 'rgba(255, 240, 200, 0.9)');
  ctx.strokeStyle = trail;
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.95); ctx.lineTo(hx, hy); ctx.stroke();
  const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.32);
  glow.addColorStop(0, 'rgba(255, 250, 225, 1)');
  glow.addColorStop(0.4, 'rgba(255, 190, 110, 0.7)');
  glow.addColorStop(1, 'rgba(255, 140, 70, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.32, 0, Math.PI * 2); ctx.fill();

  // the sea and a coast, black against the glow
  ctx.fillStyle = '#1a2230';
  ctx.fillRect(-r, r * 0.42, r * 2, r);
  ctx.fillStyle = 'rgba(255, 190, 120, 0.35)';
  ctx.fillRect(-r * 0.2, r * 0.44, r * 0.9, r * 0.02);
  ctx.fillStyle = '#10161f';
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.46);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.3, -r * 0.3, r * 0.44);
  ctx.lineTo(-r * 0.3, r);
  ctx.lineTo(-r, r);
  ctx.closePath();
  ctx.fill();

  // a long neck and a tree on the shore, the last of them looking up
  ctx.strokeStyle = '#10161f';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.36);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.1, -r * 0.48, r * 0.02);
  ctx.stroke();
  ctx.fillStyle = '#10161f';
  ctx.beginPath(); ctx.ellipse(-r * 0.46, r * 0.01, r * 0.05, r * 0.03, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-r * 0.7, r * 0.38, r * 0.14, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-r * 0.86, r * 0.1, r * 0.03, r * 0.34);
  ctx.beginPath(); ctx.arc(-r * 0.85, r * 0.08, r * 0.1, 0, Math.PI * 2); ctx.fill();
}
