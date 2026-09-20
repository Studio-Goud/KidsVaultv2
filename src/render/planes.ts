import type { PlaneState, PlaneType, Shape } from '../game/types';
import type { Vec } from '../util/math';
import { hexA, shade } from './palette';

export interface PlaneView {
  type: PlaneType;
  pos: Vec;
  heading: number;
  altitude: number;
  bank: number;        // -1..1 (left/right), 1 = full standard-rate bank
  livery: number;
  state: PlaneState;
  id: number;
  landingT?: number;   // 0..1 while rolling out
  boost?: number;      // speed multiplier (visual cue only)
}

const ALT_ACCENTS = ['#f2a541', '#5aa9e6', '#8bd17c', '#ff5f8f', '#7c5cff'];
const OUTLINE = 'rgba(40, 55, 80, 0.55)';
const PANEL = 'rgba(40, 55, 80, 0.16)';
const TAU = Math.PI * 2;

function accentFor(pv: PlaneView): string {
  if (pv.type.military) return pv.type.livery.accent;
  return pv.livery === 0 ? pv.type.livery.accent : ALT_ACCENTS[(pv.livery + pv.id) % ALT_ACCENTS.length];
}

export const planeScale = (alt: number): number => 0.74 + 0.26 * alt;
const isJetFamily = (t: PlaneType): boolean => ['regional', 'narrow', 'wide', 'bizjet', 'fighter'].includes(t.family) || t.engines.startsWith('jet');

// ---------- paths ----------

function fuselagePath(ctx: CanvasRenderingContext2D, g: Shape, jet: boolean): void {
  const L = g.L, w = g.w;
  ctx.beginPath();
  if (jet) {
    // pointed radome, parallel cabin, upswept tail cone
    ctx.moveTo(L / 2, 0);
    ctx.bezierCurveTo(L * 0.48, -w * 0.55, L * 0.36, -w * 0.95, L * 0.26, -w);
    ctx.lineTo(-L * 0.2, -w);
    ctx.bezierCurveTo(-L * 0.36, -w * 0.95, -L * 0.45, -w * 0.6, -L / 2, -w * 0.28);
    ctx.lineTo(-L / 2, w * 0.28);
    ctx.bezierCurveTo(-L * 0.45, w * 0.6, -L * 0.36, w * 0.95, -L * 0.2, w);
    ctx.lineTo(L * 0.26, w);
    ctx.bezierCurveTo(L * 0.36, w * 0.95, L * 0.48, w * 0.55, L / 2, 0);
  } else {
    ctx.moveTo(L / 2, 0);
    ctx.bezierCurveTo(L / 2, -w * 0.9, L * 0.32, -w, L * 0.2, -w);
    ctx.lineTo(-L * 0.25, -w);
    ctx.bezierCurveTo(-L * 0.4, -w * 0.9, -L * 0.47, -w * 0.55, -L / 2, -w * 0.35);
    ctx.lineTo(-L / 2, w * 0.35);
    ctx.bezierCurveTo(-L * 0.47, w * 0.55, -L * 0.4, w * 0.9, -L * 0.25, w);
    ctx.lineTo(L * 0.2, w);
    ctx.bezierCurveTo(L * 0.32, w, L / 2, w * 0.9, L / 2, 0);
  }
  ctx.closePath();
}

function fighterFuselagePath(ctx: CanvasRenderingContext2D, g: Shape): void {
  const L = g.L, w = g.w;
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.lineTo(L * 0.2, -w * 0.9);
  ctx.lineTo(-L * 0.35, -w * 1.05);
  ctx.lineTo(-L / 2, -w * 0.7);
  ctx.lineTo(-L / 2, w * 0.7);
  ctx.lineTo(-L * 0.35, w * 1.05);
  ctx.lineTo(L * 0.2, w * 0.9);
  ctx.closePath();
}

function wingPath(ctx: CanvasRenderingContext2D, g: Shape, side: 1 | -1): void {
  const half = g.span / 2, c = g.chord, s = g.sweep, x0 = g.wingX;
  ctx.beginPath();
  if (g.delta) {
    ctx.moveTo(x0 + c * 0.9, side * g.w * 0.7);
    ctx.lineTo(x0 - c * 0.55, side * half);
    ctx.lineTo(x0 - c * 0.75, side * half);
    ctx.lineTo(x0 - c * 0.75, side * g.w * 0.7);
    ctx.closePath();
    return;
  }
  // root chord is longer than the tip chord (taper), trailing edge has a slight kink (Yehudi) on jets
  const tipC = c * (s > 0 ? 0.42 : 0.7);
  ctx.moveTo(x0 + c * 0.6, side * g.w * 0.6);
  ctx.lineTo(x0 + c * 0.6 - s, side * half);
  ctx.lineTo(x0 + c * 0.6 - s - tipC, side * half);
  if (s > 0) ctx.lineTo(x0 - c * 0.55 - s * 0.35, side * half * 0.35);
  ctx.lineTo(x0 - c * 0.75, side * g.w * 0.6);
  ctx.closePath();
}

function tailPath(ctx: CanvasRenderingContext2D, g: Shape, side: 1 | -1): void {
  const half = g.tailSpan / 2, x0 = g.tailX, c = g.tailSpan * 0.34, s = g.sweep * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0 + c * 0.5, side * g.w * 0.4);
  ctx.lineTo(x0 + c * 0.4 - s, side * half);
  ctx.lineTo(x0 - c * 0.35 - s, side * half);
  ctx.lineTo(x0 - c * 0.6, side * g.w * 0.4);
  ctx.closePath();
}

function heliBodyPath(ctx: CanvasRenderingContext2D, g: Shape): void {
  const L = g.L, w = g.w;
  ctx.beginPath();
  if (g.rotor === 'tandem') {
    ctx.moveTo(L * 0.5, 0);
    ctx.bezierCurveTo(L * 0.5, -w, L * 0.3, -w, L * 0.2, -w);
    ctx.lineTo(-L * 0.4, -w);
    ctx.bezierCurveTo(-L * 0.5, -w, -L * 0.5, w, -L * 0.4, w);
    ctx.lineTo(L * 0.2, w);
    ctx.bezierCurveTo(L * 0.3, w, L * 0.5, w, L * 0.5, 0);
    ctx.closePath();
    return;
  }
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.5, -w, L * 0.05, -w, -L * 0.1, -w * 0.6);
  ctx.lineTo(-L * 0.75, -w * 0.13);
  ctx.lineTo(-L * 0.75, w * 0.13);
  ctx.lineTo(-L * 0.1, w * 0.6);
  ctx.bezierCurveTo(L * 0.05, w, L * 0.5, w, L * 0.5, 0);
  ctx.closePath();
}

function silhouette(ctx: CanvasRenderingContext2D, g: Shape, jet: boolean): void {
  if (g.rotor) {
    heliBodyPath(ctx, g); ctx.fill();
    if (g.rotor === 'single') { ctx.beginPath(); ctx.ellipse(g.tailX, 0, g.tailSpan * 0.32, g.tailSpan * 0.55, 0, 0, TAU); ctx.fill(); }
    return;
  }
  wingPath(ctx, g, 1); ctx.fill();
  wingPath(ctx, g, -1); ctx.fill();
  tailPath(ctx, g, 1); ctx.fill();
  tailPath(ctx, g, -1); ctx.fill();
  if (g.canopy) fighterFuselagePath(ctx, g); else fuselagePath(ctx, g, jet);
  ctx.fill();
}

export function drawPlaneShadow(ctx: CanvasRenderingContext2D, pv: PlaneView, shadowAlpha: number): void {
  const g = pv.type.shape;
  const s = planeScale(pv.altitude);
  const off = 8 + pv.altitude * 26;
  ctx.save();
  ctx.translate(pv.pos.x + off * 0.55, pv.pos.y + off);
  ctx.rotate(pv.heading);
  ctx.scale(s, s * Math.cos(pv.bank * 0.5));
  ctx.fillStyle = `rgba(10, 30, 60, ${shadowAlpha * (0.55 + 0.45 * (1 - pv.altitude))})`;
  silhouette(ctx, g, isJetFamily(pv.type));
  ctx.restore();
}

// ---------- parts ----------

function drawRotor(ctx: CanvasRenderingContext2D, cx: number, R: number, time: number, seed: number): void {
  // blur disc with radial streaks + two crisp blades
  const g = ctx.createRadialGradient(cx, 0, R * 0.2, cx, 0, R);
  g.addColorStop(0, 'rgba(225,232,245,0.05)'); g.addColorStop(0.85, 'rgba(225,232,245,0.22)'); g.addColorStop(1, 'rgba(225,232,245,0.02)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, 0, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(cx, 0); ctx.rotate(time * 26 + seed);
  ctx.strokeStyle = 'rgba(40,45,60,0.7)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,45,60,0.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(0.5), R * Math.sin(0.5)); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,45,60,0.7)'; ctx.lineWidth = 2.2;
    ctx.rotate(Math.PI);
  }
  ctx.restore();
  ctx.fillStyle = '#3a4150'; ctx.beginPath(); ctx.arc(cx, 0, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9aa3b2'; ctx.beginPath(); ctx.arc(cx, 0, 1.4, 0, TAU); ctx.fill();
}

function drawJetEngine(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, d: number, body: string, time: number, id: number): void {
  // nacelle
  const grd = ctx.createLinearGradient(0, y - d / 2, 0, y + d / 2);
  grd.addColorStop(0, shade(body, 0.02)); grd.addColorStop(0.5, shade(body, -0.06)); grd.addColorStop(1, shade(body, -0.3));
  ctx.fillStyle = grd; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - len / 2, y - d / 2, len, d, d / 2); ctx.fill(); ctx.stroke();
  // intake lip + fan
  ctx.fillStyle = '#e9edf3'; ctx.beginPath(); ctx.ellipse(x + len / 2 - d * 0.12, y, d * 0.16, d * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b3140'; ctx.beginPath(); ctx.ellipse(x + len / 2 - d * 0.1, y, d * 0.1, d * 0.4, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(x + len / 2 - d * 0.1, y); ctx.rotate(time * 30 + id);
  ctx.strokeStyle = 'rgba(200,210,225,0.45)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, -d * 0.35); ctx.lineTo(0, d * 0.35); ctx.stroke(); ctx.rotate(Math.PI / 3); }
  ctx.restore();
  ctx.fillStyle = '#c8ced8'; ctx.beginPath(); ctx.arc(x + len / 2 - d * 0.1, y, d * 0.09, 0, TAU); ctx.fill();
  // exhaust
  ctx.fillStyle = '#3d4452'; ctx.beginPath(); ctx.ellipse(x - len / 2 + d * 0.08, y, d * 0.1, d * 0.34, 0, 0, TAU); ctx.fill();
}

function drawProp(ctx: CanvasRenderingContext2D, px: number, py: number, R: number, time: number, seed: number, blades: number): void {
  const g = ctx.createRadialGradient(px, py, R * 0.15, px, py, R);
  g.addColorStop(0, 'rgba(230,235,245,0.05)'); g.addColorStop(0.9, 'rgba(230,235,245,0.28)'); g.addColorStop(1, 'rgba(230,235,245,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(px, py); ctx.rotate(time * 38 + seed);
  ctx.strokeStyle = 'rgba(40,45,60,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < blades; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R); ctx.stroke(); ctx.rotate(TAU / blades); }
  ctx.restore();
  ctx.fillStyle = '#e8ecf2'; ctx.beginPath(); ctx.arc(px, py, R * 0.18, 0, TAU); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
}

// ---------- main ----------

export function drawPlane(ctx: CanvasRenderingContext2D, pv: PlaneView, time: number, night: boolean): void {
  const t = pv.type, g = t.shape;
  const jet = isJetFamily(t);
  const s = planeScale(pv.altitude);
  const accent = accentFor(pv);
  const body = t.livery.body;
  const wing = t.military ? shade(body, -0.06) : shade(body, -0.04);
  const bankAng = Math.max(-1, Math.min(1, pv.bank)) * 0.5;
  const onGround = pv.state === 'taxi' || pv.state === 'parked' || pv.state === 'pushback' || pv.state === 'holding' || pv.state === 'takeoff';
  const parked = pv.state === 'parked';
  const gearDown = !g.rotor && (pv.altitude < 0.45 || pv.state === 'landing' || pv.state === 'landed' || onGround);
  const rolling = pv.state === 'landing' && (pv.landingT ?? 0) > 0.03 && pv.altitude < 0.05;

  ctx.save();
  ctx.translate(pv.pos.x, pv.pos.y);
  ctx.rotate(pv.heading);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;

  // ===== helicopters =====
  if (g.rotor) {
    ctx.strokeStyle = 'rgba(60,70,90,0.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(g.L * 0.3, -g.w * 1.1); ctx.lineTo(-g.L * 0.2, -g.w * 1.1); ctx.moveTo(g.L * 0.3, g.w * 1.1); ctx.lineTo(-g.L * 0.2, g.w * 1.1); ctx.stroke();
    if (g.rotor === 'single') {
      // tail boom, fin and tail rotor
      ctx.fillStyle = shade(body, -0.08); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(g.tailX, 0, g.tailSpan * 0.32, g.tailSpan * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.ellipse(g.tailX, 0, g.tailSpan * 0.16, g.tailSpan * 0.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(g.tailX - g.tailSpan * 0.1, -g.tailSpan * 0.5); ctx.rotate(time * 40);
      ctx.strokeStyle = 'rgba(40,45,60,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-g.w * 0.5, 0); ctx.lineTo(g.w * 0.5, 0); ctx.moveTo(0, -g.w * 0.5); ctx.lineTo(0, g.w * 0.5); ctx.stroke();
      ctx.restore();
    }
    heliBodyPath(ctx, g);
    const grd = ctx.createLinearGradient(0, -g.w, 0, g.w);
    grd.addColorStop(0, shade(body, 0.06)); grd.addColorStop(0.5, body); grd.addColorStop(1, shade(body, -0.2));
    ctx.fillStyle = grd; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.stroke();
    // canopy with frame
    ctx.fillStyle = 'rgba(60,110,180,0.9)';
    ctx.beginPath(); ctx.moveTo(g.L * 0.47, 0); ctx.bezierCurveTo(g.L * 0.47, -g.w * 0.8, g.L * 0.2, -g.w * 0.8, g.L * 0.1, -g.w * 0.5); ctx.lineTo(g.L * 0.1, g.w * 0.5); ctx.bezierCurveTo(g.L * 0.2, g.w * 0.8, g.L * 0.47, g.w * 0.8, g.L * 0.47, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(g.L * 0.45, 0); ctx.lineTo(g.L * 0.12, 0); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = g.w * 0.28;
    ctx.beginPath(); ctx.moveTo(g.L * 0.05, -g.w * 0.45); ctx.lineTo(-g.L * 0.7, -g.w * 0.05); ctx.stroke();
    // engine cowling + exhaust
    ctx.fillStyle = shade(body, -0.22); ctx.beginPath(); ctx.roundRect(-g.L * 0.18, -g.w * 0.45, g.L * 0.3, g.w * 0.9, g.w * 0.3); ctx.fill();
    const rt = pv.state === 'parked' ? 0.2 : time;
    if (g.rotor === 'tandem') { drawRotor(ctx, g.L * 0.28, t.hull * 1.25, rt, pv.id); drawRotor(ctx, -g.L * 0.3, t.hull * 1.25, rt * 1.02, pv.id + 2); }
    else drawRotor(ctx, 0, t.hull * 1.65, rt, pv.id);
    ctx.restore();
    return;
  }

  // ===== floats (seaplanes) =====
  if (g.floats) {
    ctx.fillStyle = shade(accent, -0.1); ctx.strokeStyle = OUTLINE;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(-g.L * 0.42, side * g.w * 1.25 - g.w * 0.28, g.L * 0.82, g.w * 0.56, g.w * 0.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-g.L * 0.35, side * g.w * 1.25 - g.w * 0.22, g.L * 0.6, g.w * 0.12); ctx.fillStyle = shade(accent, -0.1);
    }
    ctx.strokeStyle = 'rgba(60,70,90,0.7)'; ctx.lineWidth = 1.2;
    for (const x of [g.L * 0.15, -g.L * 0.2]) { ctx.beginPath(); ctx.moveTo(x, -g.w); ctx.lineTo(x, -g.w * 1.25); ctx.moveTo(x, g.w); ctx.lineTo(x, g.w * 1.25); ctx.stroke(); }
  }

  // ===== wings (banked) =====
  const drawWings = (): void => {
    ctx.save();
    ctx.scale(1, Math.cos(bankAng));
    for (const side of [1, -1] as const) {
      wingPath(ctx, g, side);
      const grd = ctx.createLinearGradient(g.wingX, 0, g.wingX - g.chord, 0);
      grd.addColorStop(0, shade(wing, 0.06)); grd.addColorStop(1, shade(wing, -0.08));
      ctx.fillStyle = grd; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save(); ctx.clip();
      // leading-edge highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(g.wingX + g.chord * 0.58, side * g.w * 0.6); ctx.lineTo(g.wingX + g.chord * 0.58 - g.sweep, side * g.span / 2); ctx.stroke();
      // flap / aileron hinge line + spar panel line
      ctx.strokeStyle = PANEL; ctx.lineWidth = 0.9;
      const tr = (k: number): void => { ctx.beginPath(); ctx.moveTo(g.wingX + g.chord * 0.6 - g.chord * k, side * g.w * 0.6); ctx.lineTo(g.wingX + g.chord * 0.6 - g.sweep - g.chord * k * 0.55, side * g.span / 2); ctx.stroke(); };
      tr(0.75); tr(1.0);
      // aileron split and flap track fairings on jets
      if (jet && !g.delta) {
        ctx.beginPath(); ctx.moveTo(g.wingX - g.chord * 0.4 - g.sweep * 0.72, side * g.span * 0.36); ctx.lineTo(g.wingX - g.chord * 0.7 - g.sweep * 0.72, side * g.span * 0.36); ctx.stroke();
        ctx.fillStyle = shade(wing, -0.12);
        for (const k of [0.16, 0.26, 0.36]) ctx.fillRect(g.wingX - g.chord * 0.85 - g.sweep * k * 2, side * g.span * k - g.w * 0.08, g.chord * 0.5, g.w * 0.16);
      }
      // wingtip accent
      if (!t.military) { ctx.fillStyle = accent; ctx.fillRect(-g.L, side * (g.span / 2 - g.chord * 0.26), g.L * 2, g.chord * 0.32 * side); }
      // spoilers up during roll-out
      if (rolling) { ctx.fillStyle = 'rgba(50,60,80,0.75)'; ctx.fillRect(g.wingX - g.chord * 0.3 - g.sweep * 0.3, side * g.span * 0.14, g.chord * 0.14, side * g.span * 0.16); }
      ctx.restore();
      if (g.winglets) {
        ctx.strokeStyle = accent; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        const tipX = g.wingX + g.chord * 0.6 - g.sweep;
        ctx.beginPath(); ctx.moveTo(tipX - g.chord * 0.05, side * g.span / 2); ctx.lineTo(tipX - g.chord * 0.42, side * g.span / 2); ctx.stroke();
      }
    }
    // wing struts on high-wing light aircraft
    if (g.highWing && !jet && t.family === 'ga') {
      ctx.strokeStyle = 'rgba(60,70,90,0.6)'; ctx.lineWidth = 1;
      for (const side of [1, -1]) { ctx.beginPath(); ctx.moveTo(g.wingX + g.chord * 0.1, side * g.w * 0.9); ctx.lineTo(g.wingX - g.chord * 0.1, side * g.span * 0.32); ctx.stroke(); }
    }
    ctx.restore();
  };
  const drawEngines = (): void => {
    for (const e of g.engines) {
      if (e.kind === 'jet' || e.kind === 'rearjet') {
        const len = e.kind === 'rearjet' ? g.w * 2.2 : g.w * 1.9, d = g.w * 0.95;
        if (e.kind === 'jet') { ctx.strokeStyle = shade(body, -0.25); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(e.x - len * 0.2, e.y); ctx.lineTo(e.x - len * 0.2, e.y * 0.6); ctx.stroke(); }
        drawJetEngine(ctx, e.x, e.y, len, d, body, time, pv.id + e.y);
      } else if (e.x < g.L * 0.45) {
        // wing-mounted turboprop nacelle
        const grd = ctx.createLinearGradient(0, e.y - g.w * 0.4, 0, e.y + g.w * 0.4);
        grd.addColorStop(0, shade(body, 0.02)); grd.addColorStop(1, shade(body, -0.25));
        ctx.fillStyle = grd; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(e.x - g.w * 0.9, e.y - g.w * 0.38, g.w * 1.9, g.w * 0.76, g.w * 0.38); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3d4452'; ctx.fillRect(e.x - g.w * 0.2, e.y - g.w * 0.42, g.w * 0.5, g.w * 0.1);
      }
    }
  };

  if (!g.highWing) { drawWings(); drawEngines(); }

  // ===== empennage =====
  for (const side of [1, -1] as const) {
    tailPath(ctx, g, side);
    ctx.fillStyle = t.military ? shade(body, -0.1) : shade(wing, 0.02); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = PANEL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(g.tailX - g.tailSpan * 0.05, side * g.w * 0.4); ctx.lineTo(g.tailX - g.tailSpan * 0.05 - g.sweep * 0.5, side * g.tailSpan / 2); ctx.stroke();
    ctx.restore();
  }
  // vertical fin: spine plus a leaning fin face so it reads as 3D
  const finCol = t.military ? shade(body, -0.35) : accent;
  if (g.twinTail) {
    ctx.strokeStyle = finCol; ctx.lineWidth = Math.max(1.6, g.w * 0.32); ctx.lineCap = 'round';
    for (const side of [1, -1]) { ctx.beginPath(); ctx.moveTo(g.tailX + g.tailSpan * 0.1, side * g.w * 0.75); ctx.lineTo(g.tailX - g.tailSpan * 0.35, side * g.w * 1.0); ctx.stroke(); }
  } else {
    const fh = g.tTail ? g.w * 1.6 : g.w * 1.2;
    ctx.fillStyle = finCol;
    ctx.beginPath(); ctx.moveTo(g.tailX + g.tailSpan * 0.35, 0); ctx.lineTo(g.tailX - g.tailSpan * 0.2, 0); ctx.lineTo(g.tailX - g.tailSpan * 0.42, fh * 0.55); ctx.lineTo(g.tailX + g.tailSpan * 0.05, fh * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(finCol, 0.35); ctx.fillRect(g.tailX - g.tailSpan * 0.3, fh * 0.15, g.tailSpan * 0.32, fh * 0.14);
    ctx.strokeStyle = shade(finCol, -0.2); ctx.lineWidth = Math.max(1.2, g.w * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(g.tailX - g.tailSpan * 0.3, 0); ctx.lineTo(-g.L * 0.5 + 1, 0); ctx.stroke();
  }

  // ===== fuselage =====
  if (g.canopy) fighterFuselagePath(ctx, g); else fuselagePath(ctx, g, jet);
  const fg = ctx.createLinearGradient(0, -g.w, 0, g.w);
  fg.addColorStop(0, shade(body, -0.02)); fg.addColorStop(0.35, shade(body, 0.06)); fg.addColorStop(0.75, body); fg.addColorStop(1, shade(body, -0.26));
  ctx.fillStyle = fg; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.save(); if (g.canopy) fighterFuselagePath(ctx, g); else fuselagePath(ctx, g, jet); ctx.clip();
  // top highlight spine and belly
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = g.w * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(g.L * 0.38, -g.w * 0.35); ctx.lineTo(-g.L * 0.35, -g.w * 0.35); ctx.stroke();
  // wing root fairing shadow
  if (!g.canopy) { ctx.fillStyle = 'rgba(40,55,80,0.12)'; ctx.beginPath(); ctx.ellipse(g.wingX - g.chord * 0.05, 0, g.chord * 0.9, g.w * 1.1, 0, 0, TAU); ctx.fill(); }
  if (g.hump) { ctx.fillStyle = shade(body, 0.1); ctx.beginPath(); ctx.roundRect(-g.L * 0.02, -g.w * 0.66, g.L * 0.44, g.w * 1.32, g.w * 0.6); ctx.fill(); ctx.strokeStyle = 'rgba(40,55,80,0.28)'; ctx.lineWidth = 0.9; ctx.stroke(); }
  // cheatline or roundel
  if (!t.military) { ctx.fillStyle = hexA(accent, 0.9); ctx.fillRect(-g.L * 0.5, g.w * 0.48, g.L * 0.86, g.w * 0.2); }
  else {
    ctx.fillStyle = '#e0413e'; ctx.beginPath(); ctx.arc(-g.L * 0.08, g.w * 0.45, g.w * 0.28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-g.L * 0.08, g.w * 0.45, g.w * 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f4e8c'; ctx.beginPath(); ctx.arc(-g.L * 0.08, g.w * 0.45, g.w * 0.08, 0, TAU); ctx.fill();
  }
  // doors, windows, panel lines
  if (!g.canopy && g.L > 40) {
    ctx.strokeStyle = PANEL; ctx.lineWidth = 0.8;
    for (const x of [g.L * 0.24, -g.L * 0.3]) { ctx.strokeRect(x, -g.w * 0.98, g.w * 0.3, g.w * 0.55); }
    ctx.beginPath(); ctx.moveTo(-g.L * 0.22, -g.w); ctx.lineTo(-g.L * 0.22, g.w); ctx.moveTo(g.L * 0.28, -g.w); ctx.lineTo(g.L * 0.28, g.w); ctx.stroke();
    if (g.L > 60 && !t.military) {
      ctx.fillStyle = 'rgba(40,70,120,0.8)';
      const n = Math.floor(g.L / 7);
      for (let i = 0; i < n; i++) { const x = g.L * 0.2 - i * 7; if (x < -g.L * 0.4) break; if (Math.abs(x - g.L * 0.24) < 3 || Math.abs(x + g.L * 0.3) < 3) continue; ctx.fillRect(x, -g.w * 0.82, 2.6, 1.8); }
    }
  }
  ctx.restore();
  // cockpit windows
  if (g.canopy) {
    ctx.fillStyle = 'rgba(40,70,120,0.92)';
    ctx.beginPath(); ctx.ellipse(g.L * 0.18, 0, g.L * 0.16, g.w * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)'; ctx.beginPath(); ctx.ellipse(g.L * 0.2, -g.w * 0.15, g.L * 0.08, g.w * 0.22, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(g.L * 0.3, 0); ctx.lineTo(g.L * 0.06, 0); ctx.stroke();
    // intakes
    ctx.fillStyle = '#2b3140'; ctx.fillRect(g.L * 0.02, -g.w * 1.05, g.L * 0.14, g.w * 0.3); ctx.fillRect(g.L * 0.02, g.w * 0.75, g.L * 0.14, g.w * 0.3);
  } else {
    ctx.fillStyle = 'rgba(40,75,135,0.95)';
    ctx.beginPath(); ctx.moveTo(g.L * 0.44, 0); ctx.lineTo(g.L * 0.31, -g.w * 0.8); ctx.lineTo(g.L * 0.25, -g.w * 0.78); ctx.lineTo(g.L * 0.29, 0); ctx.lineTo(g.L * 0.25, g.w * 0.78); ctx.lineTo(g.L * 0.31, g.w * 0.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(g.L * 0.36, -g.w * 0.5); ctx.lineTo(g.L * 0.31, 0); ctx.lineTo(g.L * 0.36, g.w * 0.5); ctx.stroke();
    if (jet) { ctx.fillStyle = shade(body, -0.12); ctx.beginPath(); ctx.moveTo(L2(g) * 0.5, 0); ctx.lineTo(g.L * 0.45, -g.w * 0.3); ctx.lineTo(g.L * 0.45, g.w * 0.3); ctx.closePath(); ctx.fill(); }
  }
  if (g.highWing) { drawWings(); drawEngines(); }

  // ===== propellers =====
  for (const e of g.engines) {
    if (e.kind !== 'prop') continue;
    const onWing = e.x < g.L * 0.45;
    const px = onWing ? e.x + g.w * 1.0 : g.L * 0.5 + 1.5;
    const R = t.hull * (onWing ? 0.55 : 0.6);
    drawProp(ctx, px, e.y, R, parked ? 0.37 : time, e.y + pv.id, t.family === 'ga' ? 2 : 6);
  }
  // ===== landing gear =====
  if (gearDown) {
    ctx.fillStyle = '#2f3542';
    const gy = g.w * 0.72, gx = g.wingX - g.chord * 0.15;
    ctx.beginPath(); ctx.arc(g.L * 0.36, 0, g.w * 0.16, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(gx, -gy, g.w * 0.19, 0, TAU); ctx.arc(gx, gy, g.w * 0.19, 0, TAU); ctx.fill();
  }
  // ===== afterburner =====
  if (g.afterburner && (pv.state === 'flying' || pv.state === 'takeoff' || pv.state === 'departing')) {
    const n = g.afterburners ?? 1;
    const boost = pv.boost && pv.boost > 1 ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : (i === 0 ? -1 : 1) * g.w * 0.45;
      const flick = (0.7 + 0.3 * Math.sin(time * 40 + i)) * boost;
      const gr = ctx.createRadialGradient(-g.L * 0.5, y, 0, -g.L * 0.5, y, g.w * 0.9 * flick);
      gr.addColorStop(0, 'rgba(255,240,200,0.95)'); gr.addColorStop(0.4, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(-g.L * 0.5 - g.w * 0.4, y, g.w * 1.4 * flick, g.w * 0.5, 0, 0, TAU); ctx.fill();
    }
  }
  // ===== lights =====
  const strobe = !parked && (time * 1.4 + pv.id * 0.37) % 1 < 0.08;
  const tipX = g.wingX + g.chord * 0.2 - g.sweep * 0.9;
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(tipX, -g.span / 2 * Math.cos(bankAng), 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4dff7a'; ctx.beginPath(); ctx.arc(tipX, g.span / 2 * Math.cos(bankAng), 1.5, 0, TAU); ctx.fill();
  if (strobe || night) { ctx.fillStyle = strobe ? '#ffffff' : 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-g.L * 0.5 + 1, 0, strobe ? 2.4 : 1.4, 0, TAU); ctx.fill(); }
  if (gearDown && pv.state !== 'landed' && !parked && pv.state !== 'taxi' && pv.state !== 'pushback') { ctx.fillStyle = 'rgba(255,250,220,0.9)'; ctx.beginPath(); ctx.arc(g.L * 0.4, 0, 1.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

const L2 = (g: Shape): number => g.L;

/** Glow pass for night: call with globalCompositeOperation = 'lighter'. */
export function drawPlaneLights(ctx: CanvasRenderingContext2D, pv: PlaneView, time: number): void {
  const g = pv.type.shape;
  const s = planeScale(pv.altitude);
  ctx.save();
  ctx.translate(pv.pos.x, pv.pos.y); ctx.rotate(pv.heading); ctx.scale(s, s);
  const tipX = g.wingX + g.chord * 0.2 - g.sweep * 0.9;
  const glow = (x: number, y: number, r: number, c: string): void => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };
  if (!g.rotor) {
    glow(tipX, -g.span / 2, 9, 'rgba(255,80,80,0.55)');
    glow(tipX, g.span / 2, 9, 'rgba(80,255,140,0.55)');
    glow(g.L * 0.5, 0, 14, 'rgba(255,245,220,0.35)');
    if (pv.altitude < 0.45) glow(g.L * 0.6, 0, 40, 'rgba(255,250,225,0.35)');
    if (g.afterburner) glow(-g.L * 0.5, 0, 22, 'rgba(255,150,60,0.6)');
  } else glow(0, 0, 10, 'rgba(255,90,90,0.5)');
  const strobe = (time * 1.4 + pv.id * 0.37) % 1 < 0.08;
  if (strobe) glow(-g.L * 0.5 + 1, 0, 16, 'rgba(255,255,255,0.8)');
  ctx.restore();
}

/** Small stylised aeroplane used in HUD and menus (nose pointing up). */
export function drawPlaneGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 20, size / 20); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(10, 0); ctx.quadraticCurveTo(8, -2.6, 2, -2.6); ctx.lineTo(-1, -10); ctx.lineTo(-5, -10); ctx.lineTo(-3.5, -2.4);
  ctx.lineTo(-7, -2); ctx.lineTo(-8, -5); ctx.lineTo(-10, -5); ctx.lineTo(-9.5, 0); ctx.lineTo(-10, 5); ctx.lineTo(-8, 5); ctx.lineTo(-7, 2);
  ctx.lineTo(-3.5, 2.4); ctx.lineTo(-5, 10); ctx.lineTo(-1, 10); ctx.lineTo(2, 2.6); ctx.quadraticCurveTo(8, 2.6, 10, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean, color: string): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 20, size / 20);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-12, -3, -6, -12, 0, -6);
  ctx.bezierCurveTo(6, -12, 12, -3, 0, 6);
  ctx.closePath();
  if (filled) { ctx.fillStyle = color; ctx.fill(); }
  ctx.strokeStyle = filled ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}
