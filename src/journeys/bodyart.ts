/**
 * The stops on the journey through the body that are drawn rather than photographed.
 *
 * A photograph of a real brain or a real stomach is a thing from an operating theatre, and to a
 * four-year-old it is frightening rather than interesting. So the organs are drawn, the way a
 * children's encyclopaedia draws them: a plain shape in its own colour, with the one detail that
 * makes it recognisable. What can be photographed without that problem - an eye, blood under a
 * microscope, an X-ray of a knee and a foot - is a photograph (`body.ts`).
 *
 * Each one draws inside a circle of radius `r` around the origin; the caller has already clipped to
 * it, so a shape may run past the edge.
 */

type Ctx = CanvasRenderingContext2D;

const LINE = 'rgba(90, 30, 40, 0.35)';

/** Soft highlight on the upper left, the way everything in the house style is lit. */
function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2); ctx.fill();
}

export function brain(ctx: Ctx, r: number): void {
  ctx.fillStyle = '#f2b8c6';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.66, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8a0b2';
  ctx.beginPath(); ctx.ellipse(r * 0.34, r * 0.34, r * 0.24, r * 0.14, 0.3, 0, Math.PI * 2); ctx.fill();
  // the folds, and the line between the two halves
  ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.035; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.52); ctx.quadraticCurveTo(r * 0.05, -r * 0.1, -r * 0.02, r * 0.4); ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = -2.6 + i * 0.75, rr = r * (0.3 + (i % 2) * 0.12);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr * 1.2, Math.sin(a) * rr * 0.9 - r * 0.05, r * 0.12, a, a + 2.2);
    ctx.stroke();
  }
  shine(ctx, -r * 0.3, -r * 0.3, r * 0.18, r * 0.08);
}

export function teeth(ctx: Ctx, r: number): void {
  // an open smile: pink gums above and below, and the milk teeth in them
  ctx.fillStyle = '#d9606e';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.78, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a2230';
  ctx.beginPath(); ctx.ellipse(0, r * 0.02, r * 0.58, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f07c8c';
  ctx.beginPath(); ctx.ellipse(0, r * 0.16, r * 0.3, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbf8f0';
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * r * 0.2, w = r * (i === 2 ? 0.17 : 0.16);
      const y = row === 0 ? -r * 0.3 : r * 0.12;
      ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, r * 0.18, r * 0.05); ctx.fill();
    }
  }
}

export function voice(ctx: Ctx, r: number): void {
  // the throat seen from above: two vocal folds, and the sound coming off them in rings
  ctx.fillStyle = '#b8505c';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 0.56, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a1822';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.quadraticCurveTo(r * 0.12, 0, 0, r * 0.42); ctx.quadraticCurveTo(-r * 0.12, 0, 0, -r * 0.4); ctx.fill();
  ctx.fillStyle = '#f3d6d0';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.02, -r * 0.4);
    ctx.quadraticCurveTo(s * r * 0.22, 0, s * r * 0.02, r * 0.42);
    ctx.quadraticCurveTo(s * r * 0.3, 0, s * r * 0.02, -r * 0.4);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = r * 0.03;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath(); ctx.arc(0, 0, r * (0.56 + k * 0.12), -0.6, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * (0.56 + k * 0.12), Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
  }
}

export function lungs(ctx: Ctx, r: number): void {
  // the windpipe splitting into two, and the left lung smaller for the heart
  ctx.strokeStyle = '#e8d0c8'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.72); ctx.lineTo(0, -r * 0.2); ctx.stroke();
  ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(-r * 0.22, -r * 0.02); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r * 0.22, -r * 0.02); ctx.stroke();
  ctx.fillStyle = '#e98fa0';
  // the child's right lung is on the left of the picture: we are looking at them from the front
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, -r * 0.45);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.5, -r * 0.6, r * 0.15);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.6, -r * 0.1, r * 0.5);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.08, -r * 0.45);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.45, r * 0.52, r * 0.1);
  ctx.quadraticCurveTo(r * 0.54, r * 0.55, r * 0.22, r * 0.5);
  ctx.quadraticCurveTo(r * 0.3, r * 0.25, r * 0.08, r * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.025;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, r * (-0.02 + k * 0.02));
      ctx.lineTo(s * r * (0.36 + k * 0.04), r * (0.05 + k * 0.14));
      ctx.stroke();
    }
  }
  shine(ctx, -r * 0.4, -r * 0.15, r * 0.08, r * 0.14);
}

export function heart(ctx: Ctx, r: number): void {
  // the real shape, not the card-game one: rounded, leaning, with the big vessels on top
  ctx.fillStyle = '#b3364a';
  ctx.beginPath(); ctx.roundRect(-r * 0.22, -r * 0.62, r * 0.14, r * 0.34, r * 0.07); ctx.fill();
  ctx.fillStyle = '#4f78b8';
  ctx.beginPath(); ctx.roundRect(r * 0.02, -r * 0.6, r * 0.14, r * 0.3, r * 0.07); ctx.fill();
  ctx.strokeStyle = '#c8424f'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-r * 0.02, -r * 0.34, r * 0.2, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#d24a5a';
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.62, r * 0.1, -r * 0.1, r * 0.6);
  ctx.quadraticCurveTo(r * 0.12, r * 0.52, r * 0.42, r * 0.02);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.34, r * 0.1, -r * 0.34);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.3); ctx.quadraticCurveTo(-r * 0.05, r * 0.15, -r * 0.08, r * 0.55); ctx.stroke();
  shine(ctx, -r * 0.3, -r * 0.08, r * 0.08, r * 0.16);
}

export function stomach(ctx: Ctx, r: number): void {
  // a bean-shaped bag, with the food pipe coming in at the top left
  ctx.strokeStyle = '#e8b6a8'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.8); ctx.lineTo(-r * 0.2, -r * 0.32); ctx.stroke();
  ctx.fillStyle = '#e39a7a';
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.35);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.6, r * 0.5, r * 0.05);
  ctx.quadraticCurveTo(r * 0.45, r * 0.55, -r * 0.2, r * 0.45);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.38, -r * 0.52, r * 0.52);
  ctx.lineTo(-r * 0.62, r * 0.4);
  ctx.quadraticCurveTo(-r * 0.4, r * 0.18, -r * 0.05, r * 0.2);
  ctx.quadraticCurveTo(r * 0.15, r * 0.05, -r * 0.1, -r * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.025;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath(); ctx.moveTo(r * (0.05 + k * 0.1), -r * 0.3); ctx.quadraticCurveTo(r * (0.1 + k * 0.08), 0, r * (0.02 + k * 0.08), r * 0.3); ctx.stroke();
  }
  shine(ctx, r * 0.15, -r * 0.3, r * 0.14, r * 0.06);
}

export function gut(ctx: Ctx, r: number): void {
  // the small intestine folded up in coils, and the big one round it like a frame
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#c96a5a'; ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.55); ctx.lineTo(-r * 0.55, -r * 0.45); ctx.lineTo(r * 0.55, -r * 0.45); ctx.lineTo(r * 0.5, r * 0.55);
  ctx.stroke();
  ctx.strokeStyle = '#f0a090'; ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  let first = true;
  for (let row = 0; row < 4; row++) {
    const y = -r * 0.25 + row * r * 0.2;
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const x = (row % 2 ? 1 - k : k) * r * 0.66 - r * 0.33;
      const yy = y + Math.sin(k * Math.PI * 4) * r * 0.05;
      if (first) { ctx.moveTo(x, yy); first = false; } else ctx.lineTo(x, yy);
    }
  }
  ctx.stroke();
}
