/**
 * How the parts look, and how the current looks going through them.
 *
 * Every part is drawn facing one way - terminal A to the left, terminal B to the right - and the
 * canvas is turned a quarter at a time to put it where it belongs. So there is exactly one drawing
 * of a bulb, and turning a motor round in the game really is turning the same motor round.
 *
 * What lights, spins, buzzes or glows is never decided here: it is handed in from the solver as a
 * duty between nought and one, and the drawing follows it. A bulb at a quarter of its power is a
 * quarter as bright, which is how two bulbs in series can be seen to be dimmer than two in
 * parallel without a single word being written on the screen.
 */

import { TAU, clamp } from '../../util/math';
import { contactShadow, hexA, mix, roundRectPath, shade } from '../../render/look';
import { aFace, cellsOf, linked, specOf, type Board, type PartState, type Placed } from './sim';

type Ctx = CanvasRenderingContext2D;

const COPPER = '#d98a4a';
const COPPER_HI = '#f6bd82';
const METAL = '#bac7d7';
const METAL_DK = '#66768b';
const BODY = '#2f3e53';
const BODY_HI = '#4a5f79';
const GOLD = '#ffd86b';
const EMBER = '#ffcf6b';

/** The centre of a part's footprint, in board pixels. */
export function centreOf(p: Placed, ox: number, oy: number, unit: number): { x: number; y: number } {
  const cells = cellsOf(p);
  let x = 0, y = 0;
  for (const [c, r] of cells) { x += c + 0.5; y += r + 0.5; }
  return { x: ox + (x / cells.length) * unit, y: oy + (y / cells.length) * unit };
}

/**
 * Which arms of a length of wire to draw: the ones the line was drawn through, and any face that
 * is up against a real terminal. A drawn arm with nothing on the end of it is left showing, because
 * that stub is exactly where the gap in the loop is.
 */
export function wireArms(board: Board, i: number): number[] {
  const p = board[i];
  const out: number[] = [];
  for (let f = 0; f < 4; f++) {
    if (linked(p, f)) { out.push(f); continue; }
    const c = p.col + [0, 1, 0, -1][f], r = p.row + [-1, 0, 1, 0][f];
    const k = board.findIndex(q => q.id !== 'wire' && cellsOf(q).some(([qc, qr]) => qc === c && qr === r));
    if (k < 0) continue;
    // a terminal has to be pointing back at this cell for it to count
    const q = board[k];
    const faces = q.id === 'relay'
      ? [aFace(q), q.rot % 4, (q.rot + 1) % 4, (q.rot + 2) % 4]
      : specOf(q.id).len === 2
        ? (q.rot % 2 === 0 ? [3, 1] : [0, 2])
        : [aFace(q), (q.rot + 1) % 4];
    const want = (f + 2) % 4;
    if (!faces.includes(want)) continue;
    if (specOf(q.id).len === 2) {
      // only the far end of a lead has a clip on it
      const [c0, c1] = cellsOf(q);
      const end = want === 3 || want === 0 ? c0 : c1;
      if (end[0] !== c || end[1] !== r) continue;
    }
    out.push(f);
  }
  return out;
}

// ---------------------------------------------------------------- small pieces

function leadStub(ctx: Ctx, from: number, to: number, y: number, w: number): void {
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from, y);
  ctx.lineTo(to, y);
  ctx.stroke();
  ctx.strokeStyle = hexA(COPPER_HI, 0.55);
  ctx.lineWidth = w * 0.38;
  ctx.beginPath();
  ctx.moveTo(from, y - w * 0.22);
  ctx.lineTo(to, y - w * 0.22);
  ctx.stroke();
}

/** The two copper tails every two-terminal part has, out to the edges of its cell. */
function tails(ctx: Ctx, u: number, bodyHalf: number): void {
  leadStub(ctx, -u * 0.5, -bodyHalf, 0, u * 0.11);
  leadStub(ctx, bodyHalf, u * 0.5, 0, u * 0.11);
}

function plate(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function glowAt(ctx: Ctx, x: number, y: number, r: number, colour: string, strength: number): void {
  if (strength <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(colour, Math.min(0.95, 0.75 * strength)));
  g.addColorStop(0.4, hexA(colour, Math.min(0.5, 0.35 * strength)));
  g.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- the parts

function paintBattery(ctx: Ctx, u: number, st: PartState | null, frac: number): void {
  const w = u * 0.76, h = u * 0.46;
  tails(ctx, u, w / 2);
  // the little nub on the plus end
  ctx.fillStyle = METAL;
  roundRectPath(ctx, -w / 2 - u * 0.07, -h * 0.18, u * 0.09, h * 0.36, u * 0.03);
  ctx.fill();
  plate(ctx, -w / 2, -h / 2, w, h, u * 0.07, '#4a6a92', '#22374f');
  // what is left in it, as a band down the side of the cell
  ctx.fillStyle = frac > 0.25 ? '#8ee8ad' : frac > 0 ? '#f0b27a' : '#8f4b4b';
  roundRectPath(ctx, -w / 2 + u * 0.05, h * 0.1, (w - u * 0.1) * clamp(frac, 0, 1), h * 0.16, u * 0.03);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = Math.max(0.6, u * 0.02);
  roundRectPath(ctx, -w / 2 + u * 0.05, h * 0.1, w - u * 0.1, h * 0.16, u * 0.03);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `900 ${Math.round(u * 0.26)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', -w * 0.33, -h * 0.16);
  ctx.fillText('–', w * 0.33, -h * 0.16);
  if (st && st.on) glowAt(ctx, 0, 0, u * 0.6, '#8ee8ad', Math.min(0.5, st.duty));
}

function paintSolar(ctx: Ctx, u: number, st: PartState | null): void {
  const w = u * 0.76, h = u * 0.5;
  tails(ctx, u, w / 2);
  plate(ctx, -w / 2, -h / 2, w, h, u * 0.05, '#2f4f86', '#16294a');
  ctx.strokeStyle = 'rgba(150, 195, 255, 0.5)';
  ctx.lineWidth = Math.max(0.6, u * 0.018);
  for (let i = 1; i < 4; i++) {
    const x = -w / 2 + (w * i) / 4;
    ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
  // a glint, because a panel with no light on it is a black rectangle
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, u * 0.05);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, h / 2); ctx.lineTo(-w * 0.1, -h / 2); ctx.lineTo(w * 0.06, -h / 2);
  ctx.lineTo(-w * 0.29, h / 2);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `900 ${Math.round(u * 0.2)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', -w * 0.38, -h * 0.28);
  if (st && st.on) glowAt(ctx, 0, 0, u * 0.55, GOLD, Math.min(0.4, st.duty * 2));
}

function paintCap(ctx: Ctx, u: number, frac: number): void {
  const w = u * 0.58, h = u * 0.54;
  tails(ctx, u, w / 2);
  plate(ctx, -w / 2, -h / 2, w, h, u * 0.1, '#5a6f8c', '#2c3c53');
  // the dark stripe that marks the minus side on every real one
  ctx.fillStyle = 'rgba(12, 20, 32, 0.8)';
  roundRectPath(ctx, w / 2 - u * 0.15, -h / 2, u * 0.15, h, u * 0.05);
  ctx.fill();
  // how full it is
  const f = clamp(frac, 0, 1);
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, u * 0.1);
  ctx.clip();
  ctx.fillStyle = hexA('#7fd8ff', 0.55);
  ctx.fillRect(-w / 2, h / 2 - h * f, w, h * f);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(0.6, u * 0.02);
  roundRectPath(ctx, -w / 2, -h / 2, w, h, u * 0.1);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `900 ${Math.round(u * 0.2)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', -w * 0.28, 0);
}

function paintBulb(ctx: Ctx, u: number, duty: number, t: number): void {
  const r = u * 0.24;
  tails(ctx, u, u * 0.3);
  const d = clamp(duty, 0, 1.4);
  // the halo first, so the glass sits inside its own light
  glowAt(ctx, 0, -u * 0.04, u * 0.95, EMBER, d);
  // the screw base
  plate(ctx, -u * 0.13, r * 0.55, u * 0.26, u * 0.2, u * 0.03, METAL, METAL_DK);
  ctx.strokeStyle = 'rgba(30,44,60,0.4)';
  ctx.lineWidth = Math.max(0.5, u * 0.015);
  for (let i = 1; i < 3; i++) {
    const y = r * 0.55 + (u * 0.2 * i) / 3;
    ctx.beginPath(); ctx.moveTo(-u * 0.13, y); ctx.lineTo(u * 0.13, y); ctx.stroke();
  }
  // the glass
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, -u * 0.04, r);
  g.addColorStop(0, d > 0.05 ? hexA('#fff6d8', 0.95) : 'rgba(226, 240, 252, 0.5)');
  g.addColorStop(1, d > 0.05 ? hexA(EMBER, 0.35 + 0.4 * d) : 'rgba(150, 178, 204, 0.28)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -u * 0.04, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = d > 0.05 ? hexA('#fff1c4', 0.8) : 'rgba(200, 222, 244, 0.55)';
  ctx.lineWidth = Math.max(0.7, u * 0.022);
  ctx.stroke();
  // the filament, which is the thing that actually gets hot
  const hot = d > 0.02;
  ctx.strokeStyle = hot ? mix('#ffb648', '#fffce8', Math.min(1, d)) : 'rgba(180, 200, 220, 0.6)';
  ctx.lineWidth = Math.max(0.8, u * (hot ? 0.035 + 0.02 * Math.min(1, d) : 0.025));
  ctx.lineCap = 'round';
  ctx.beginPath();
  const fy = -u * 0.02, fw = r * 0.5;
  ctx.moveTo(-fw, fy + r * 0.3);
  for (let i = 0; i <= 4; i++) {
    ctx.lineTo(-fw + (fw * 2 * i) / 4, fy + (i % 2 === 0 ? r * 0.1 : -r * 0.42));
  }
  ctx.lineTo(fw, fy + r * 0.3);
  ctx.stroke();
  if (hot) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 11);
    ctx.strokeStyle = '#fffbe8';
    ctx.lineWidth = Math.max(0.5, u * 0.016);
    ctx.stroke();
    ctx.restore();
  }
}

function paintSwitch(ctx: Ctx, u: number, closed: boolean, spring: boolean, press: number): void {
  const half = u * 0.3;
  tails(ctx, u, half);
  // the two posts
  ctx.fillStyle = METAL_DK;
  for (const x of [-half, half]) {
    ctx.beginPath();
    ctx.arc(x, 0, u * 0.055, 0, TAU);
    ctx.fill();
  }
  plate(ctx, -half - u * 0.06, u * 0.08, half * 2 + u * 0.12, u * 0.13, u * 0.04, BODY_HI, BODY);
  // the lever: flat across when it is closed, tipped up when it is open
  const lift = closed ? 0 : -u * 0.3;
  ctx.save();
  ctx.translate(-half, 0);
  ctx.rotate(closed ? 0 : -0.62);
  const g = ctx.createLinearGradient(0, -u * 0.05, 0, u * 0.05);
  g.addColorStop(0, COPPER_HI);
  g.addColorStop(1, shade(COPPER, -0.3));
  ctx.fillStyle = g;
  roundRectPath(ctx, -u * 0.02, -u * 0.045, half * 2 + u * 0.04, u * 0.09, u * 0.045);
  ctx.fill();
  ctx.restore();
  if (spring) {
    // a push button says so with a cap you can see go down
    ctx.fillStyle = mix('#e0584a', '#8f3228', press);
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.16 + press * u * 0.08, u * 0.15, u * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(0.6, u * 0.02);
    ctx.stroke();
  } else if (!closed) {
    ctx.fillStyle = hexA('#ff9f7a', 0.9);
    ctx.beginPath();
    ctx.arc(half, lift * 0.1, u * 0.03, 0, TAU);
    ctx.fill();
  }
}

function paintMotor(ctx: Ctx, u: number, spin: number, duty: number): void {
  const r = u * 0.28;
  tails(ctx, u, r);
  contactShadow(ctx, 0, r * 0.95, r * 0.9, r * 0.28, 0.25);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#9fb0c4');
  g.addColorStop(0.5, '#6b7c92');
  g.addColorStop(1, '#3c4a5e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 26, 40, 0.5)';
  ctx.lineWidth = Math.max(0.7, u * 0.022);
  ctx.stroke();
  // the rotor, which is the whole reason a motor is worth having
  ctx.save();
  ctx.rotate(spin);
  ctx.strokeStyle = duty > 0.05 ? GOLD : 'rgba(224, 236, 250, 0.55)';
  ctx.lineWidth = Math.max(1, u * 0.05);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#e6eefa';
  ctx.beginPath();
  ctx.arc(0, 0, u * 0.045, 0, TAU);
  ctx.fill();
  if (duty > 0.05) {
    // a puff of motion, so a slow motor and a fast one are not the same picture
    ctx.strokeStyle = hexA(GOLD, 0.35 * Math.min(1, duty));
    ctx.lineWidth = Math.max(0.8, u * 0.025);
    const dir = Math.sign(spin) || 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.22, spin * 0.5, spin * 0.5 + dir * 1.1);
    ctx.stroke();
  }
}

function paintBuzzer(ctx: Ctx, u: number, duty: number, t: number): void {
  const r = u * 0.27;
  tails(ctx, u, r);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#48566b');
  g.addColorStop(1, '#1b2432');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 210, 235, 0.35)';
  ctx.lineWidth = Math.max(0.7, u * 0.022);
  ctx.stroke();
  ctx.fillStyle = '#0c1220';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, TAU);
  ctx.fill();
  if (duty > 0.08) {
    const wob = 0.5 + 0.5 * Math.sin(t * 34);
    ctx.strokeStyle = hexA('#9fe8ff', 0.25 + 0.5 * wob);
    ctx.lineWidth = Math.max(0.9, u * 0.03);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 + i * 0.28) + wob * u * 0.03, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 + i * 0.28) + wob * u * 0.03, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
    }
  }
}

/** Forty-seven ohms, and the bands say so: yellow, violet, black, gold. */
const BANDS = ['#e8c23a', '#8455c8', '#10151c', '#d8a53c'];

function paintResistor(ctx: Ctx, u: number, duty: number): void {
  const w = u * 0.5, h = u * 0.28;
  tails(ctx, u, w / 2);
  plate(ctx, -w / 2, -h / 2, w, h, h * 0.42, '#e5d3b0', '#b99a6d');
  for (let i = 0; i < BANDS.length; i++) {
    ctx.fillStyle = BANDS[i];
    const x = -w * 0.34 + i * w * 0.2;
    ctx.fillRect(x, -h / 2, Math.max(1, w * 0.07), h);
  }
  if (duty > 0.2) glowAt(ctx, 0, 0, u * 0.45, '#ff8a5c', Math.min(0.5, duty * 0.5));
}

function paintLed(ctx: Ctx, u: number, duty: number): void {
  const r = u * 0.21;
  tails(ctx, u, r * 0.95);
  const d = clamp(duty, 0, 1.4);
  glowAt(ctx, 0, 0, u * 0.8, '#ff6a5a', d);
  // the dome, with the flat on the minus side the way a real one has
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.55);
  ctx.lineTo(-r, -r * 0.2);
  ctx.arc(0, -r * 0.2, r, Math.PI, 0);
  ctx.lineTo(r, r * 0.3);
  ctx.lineTo(r * 0.72, r * 0.55);
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, d > 0.05 ? '#ffd9cc' : 'rgba(224, 138, 130, 0.55)');
  g.addColorStop(1, d > 0.05 ? mix('#e8412c', '#ffe9b0', Math.min(1, d)) : 'rgba(150, 70, 66, 0.6)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = d > 0.05 ? 'rgba(255, 226, 198, 0.85)' : 'rgba(210, 160, 156, 0.5)';
  ctx.lineWidth = Math.max(0.7, u * 0.022);
  ctx.stroke();
  // the little arrow that says which way it lets current through
  ctx.fillStyle = d > 0.05 ? 'rgba(90, 20, 14, 0.5)' : 'rgba(240, 220, 216, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.55); ctx.lineTo(r * 0.3, -r * 0.2); ctx.lineTo(-r * 0.4, r * 0.15);
  ctx.closePath();
  ctx.fill();
}

function paintFuse(ctx: Ctx, u: number, blown: boolean, duty: number): void {
  const w = u * 0.56, h = u * 0.3;
  tails(ctx, u, w / 2);
  ctx.fillStyle = METAL;
  roundRectPath(ctx, -w / 2, -h / 2, u * 0.1, h, u * 0.03); ctx.fill();
  roundRectPath(ctx, w / 2 - u * 0.1, -h / 2, u * 0.1, h, u * 0.03); ctx.fill();
  ctx.fillStyle = blown ? 'rgba(40, 30, 34, 0.75)' : 'rgba(216, 236, 255, 0.3)';
  roundRectPath(ctx, -w / 2 + u * 0.08, -h / 2 + u * 0.01, w - u * 0.16, h - u * 0.02, u * 0.03);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226, 240, 255, 0.45)';
  ctx.lineWidth = Math.max(0.5, u * 0.018);
  ctx.stroke();
  // the thread, whole or snapped
  ctx.strokeStyle = blown ? 'rgba(120, 100, 96, 0.9)'
    : duty > 0.6 ? mix(COPPER, '#fff1c4', Math.min(1, duty)) : COPPER;
  ctx.lineWidth = Math.max(0.8, u * 0.026);
  ctx.lineCap = 'round';
  if (blown) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + u * 0.1, 0); ctx.lineTo(-u * 0.07, -u * 0.04);
    ctx.moveTo(u * 0.07, u * 0.04); ctx.lineTo(w / 2 - u * 0.1, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + u * 0.1, 0); ctx.lineTo(w / 2 - u * 0.1, 0);
    ctx.stroke();
    if (duty > 0.6) glowAt(ctx, 0, 0, u * 0.4, EMBER, duty - 0.5);
  }
}

function paintRelay(ctx: Ctx, u: number, pulled: boolean, coil: number): void {
  const s = u * 0.74;
  // the tails: coil to the west and north, contacts to the east and south
  leadStub(ctx, -u * 0.5, -s / 2, -s * 0.22, u * 0.1);
  ctx.save(); ctx.rotate(-Math.PI / 2);
  leadStub(ctx, -u * 0.5, -s / 2, -s * 0.22, u * 0.1);
  ctx.restore();
  ctx.save(); ctx.rotate(Math.PI);
  leadStub(ctx, -u * 0.5, -s / 2, s * 0.22, u * 0.1);
  ctx.restore();
  ctx.save(); ctx.rotate(Math.PI / 2);
  leadStub(ctx, -u * 0.5, -s / 2, s * 0.22, u * 0.1);
  ctx.restore();

  plate(ctx, -s / 2, -s / 2, s, s, u * 0.09, BODY_HI, BODY);
  ctx.strokeStyle = 'rgba(200, 222, 248, 0.25)';
  ctx.lineWidth = Math.max(0.6, u * 0.02);
  roundRectPath(ctx, -s / 2, -s / 2, s, s, u * 0.09);
  ctx.stroke();

  // the coil, in the corner its two terminals meet at
  const cx = -s * 0.22, cy = -s * 0.2;
  ctx.strokeStyle = pulled ? mix(COPPER, GOLD, 0.6) : COPPER;
  ctx.lineWidth = Math.max(0.9, u * 0.032);
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = cy - s * 0.13 + (s * 0.26 * i) / 4;
    ctx.moveTo(cx - s * 0.1, y);
    ctx.lineTo(cx + s * 0.1, y - s * 0.03);
  }
  ctx.stroke();
  if (coil > 0.4) glowAt(ctx, cx, cy, u * 0.34, GOLD, Math.min(0.7, coil));

  // the armature, which is pulled over when the coil has enough in it
  const ax = s * 0.2, ay = s * 0.2;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(pulled ? 0 : -0.55);
  ctx.strokeStyle = pulled ? COPPER_HI : METAL;
  ctx.lineWidth = Math.max(1, u * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.1);
  ctx.lineTo(s * 0.16, s * 0.1);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = pulled ? '#8ee8ad' : 'rgba(200, 216, 236, 0.45)';
  ctx.beginPath();
  ctx.arc(ax + s * 0.18, ay + s * 0.1, u * 0.035, 0, TAU);
  ctx.fill();
}

function paintClip(ctx: Ctx, u: number, len: number): void {
  const half = (u * len) / 2;
  // the cable sags between the clips, because a lead lying on a bench does
  ctx.strokeStyle = shade(COPPER, -0.15);
  ctx.lineWidth = u * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-half + u * 0.2, 0);
  ctx.quadraticCurveTo(0, u * 0.24, half - u * 0.2, 0);
  ctx.stroke();
  ctx.strokeStyle = hexA(COPPER_HI, 0.5);
  ctx.lineWidth = u * 0.04;
  ctx.beginPath();
  ctx.moveTo(-half + u * 0.2, -u * 0.02);
  ctx.quadraticCurveTo(0, u * 0.2, half - u * 0.2, -u * 0.02);
  ctx.stroke();
  // and a clip at each end, jaws open
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * (half - u * 0.16), 0);
    ctx.scale(s, 1);
    ctx.fillStyle = s < 0 ? '#d6494a' : '#3f6fd0';
    ctx.beginPath();
    ctx.moveTo(-u * 0.16, -u * 0.12);
    ctx.lineTo(u * 0.08, -u * 0.05);
    ctx.lineTo(u * 0.08, u * 0.05);
    ctx.lineTo(-u * 0.16, u * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(0.5, u * 0.016);
    ctx.stroke();
    ctx.restore();
  }
}

/** A length of wire: one arm out to each face the line was drawn through. */
export function paintWire(ctx: Ctx, x: number, y: number, u: number, arms: number[], st: PartState | null): void {
  const hot = st && st.i > 1.2 ? Math.min(1, (st.i - 1.2) / 2) : 0;
  ctx.lineCap = 'round';
  for (const f of arms) {
    const dx = [0, 1, 0, -1][f] * u * 0.5, dy = [-1, 0, 1, 0][f] * u * 0.5;
    ctx.strokeStyle = hot > 0 ? mix(COPPER, '#fff0c0', hot) : COPPER;
    ctx.lineWidth = u * 0.13;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    ctx.strokeStyle = hexA(COPPER_HI, 0.5);
    ctx.lineWidth = u * 0.045;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }
  if (arms.length > 2) {
    ctx.fillStyle = hot > 0 ? '#fff0c0' : COPPER_HI;
    ctx.beginPath();
    ctx.arc(x, y, u * 0.085, 0, TAU);
    ctx.fill();
  }
  if (arms.length === 1) {
    // a drawn end with nothing on it: the gap in the loop, showing itself
    ctx.fillStyle = 'rgba(255, 150, 120, 0.8)';
    const dx = [0, 1, 0, -1][arms[0]] * u * 0.5, dy = [-1, 0, 1, 0][arms[0]] * u * 0.5;
    ctx.beginPath();
    ctx.arc(x - dx * 0.75, y - dy * 0.75, u * 0.06, 0, TAU);
    ctx.fill();
  }
  if (hot > 0) glowAt(ctx, x, y, u * 0.7, '#ff9a4a', hot);
}

/**
 * One part, turned to face the way it is pointing.
 *
 * `spin` is where a motor's rotor has got to and `t` is the clock, for the things that flicker.
 * Everything else about the picture comes out of the state the solver handed back.
 */
export function paintPart(
  ctx: Ctx, p: Placed, st: PartState | null, x: number, y: number, u: number, t: number, spin = 0,
): void {
  if (p.id === 'wire') return;          // wires are drawn by their arms, not by their box
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((p.rot % 4) * (Math.PI / 2));
  const duty = st ? st.duty : 0;
  switch (p.id) {
    case 'battery': paintBattery(ctx, u, st, (p.charge ?? 60) / 60); break;
    case 'solar': paintSolar(ctx, u, st); break;
    case 'cap': paintCap(ctx, u, (p.charge ?? 0) / 3); break;
    case 'bulb': paintBulb(ctx, u, duty, t); break;
    case 'switch': paintSwitch(ctx, u, !!p.on, false, 0); break;
    case 'button': paintSwitch(ctx, u, !!p.on, true, p.on ? 1 : 0); break;
    case 'motor': paintMotor(ctx, u, spin, duty); break;
    case 'buzzer': paintBuzzer(ctx, u, duty, t); break;
    case 'resistor': paintResistor(ctx, u, duty); break;
    case 'led': paintLed(ctx, u, duty); break;
    case 'fuse': paintFuse(ctx, u, !!p.blown, duty); break;
    case 'relay': paintRelay(ctx, u, Math.abs(st?.i2 ?? 0) > 0.001 || !!st?.on, duty); break;
    case 'clip': paintClip(ctx, u, 2); break;
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/**
 * The current itself: beads travelling along the wire, faster where there is more of it.
 *
 * This is the one thing on the screen that is not a part, and it is the thing that turns a diagram
 * into a circuit. It runs the way the current really runs, out of the plus terminal and round, so a
 * child watching the beads is watching the answer to "which way does it go".
 */
export function paintFlow(
  ctx: Ctx, board: Board, states: PartState[], ox: number, oy: number, u: number, phase: number,
): void {
  ctx.save();
  board.forEach((p, i) => {
    const st = states[i];
    if (!st) return;
    if (p.id === 'wire') {
      const faces = st.faces;
      if (!faces) return;
      const x = ox + (p.col + 0.5) * u, y = oy + (p.row + 0.5) * u;
      for (let f = 0; f < 4; f++) {
        const amps = faces[f];
        if (Math.abs(amps) < 0.012) continue;
        const dx = [0, 1, 0, -1][f] * u * 0.5, dy = [-1, 0, 1, 0][f] * u * 0.5;
        beads(ctx, x + dx, y + dy, x, y, u, amps, phase);
      }
      return;
    }
    if (Math.abs(st.i) < 0.012) return;
    const spec = specOf(p.id);
    const cells = cellsOf(p);
    const c0 = cells[0], c1 = cells[cells.length - 1];
    const dir = (p.rot + 3) % 4;                  // the face terminal A sits on
    const ax = ox + (c0[0] + 0.5 + [0, 1, 0, -1][dir] * 0.5) * u;
    const ay = oy + (c0[1] + 0.5 + [-1, 0, 1, 0][dir] * 0.5) * u;
    const bd = (p.rot + 1) % 4;
    const bx = ox + (c1[0] + 0.5 + [0, 1, 0, -1][bd] * 0.5) * u;
    const by = oy + (c1[1] + 0.5 + [-1, 0, 1, 0][bd] * 0.5) * u;
    if (spec.len === 2 || p.id === 'clip') beads(ctx, ax, ay, bx, by, u, st.i, phase);
    else beads(ctx, ax, ay, bx, by, u, st.i, phase, 0.26);
  });
  ctx.restore();
}

/** Beads along one straight run, moving from a to b when the current is positive. */
function beads(
  ctx: Ctx, x0: number, y0: number, x1: number, y1: number, u: number, amps: number, phase: number, alpha = 0.85,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const n = Math.max(1, Math.round(len / (u * 0.3)));
  const speed = Math.sign(amps) * Math.min(3.2, 0.5 + Math.abs(amps) * 2.2);
  const bright = clamp(0.25 + Math.abs(amps) * 1.6, 0.25, 1);
  const off = ((phase * speed) % 1 + 1) % 1;
  ctx.fillStyle = hexA(Math.abs(amps) > 1.6 ? '#fff0b8' : '#ffe8a8', alpha * bright);
  for (let i = 0; i < n; i++) {
    const t = (i + off) / n;
    if (t < 0 || t > 1) continue;
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, u * (0.035 + 0.02 * bright), 0, TAU);
    ctx.fill();
  }
}
