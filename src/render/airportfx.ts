import type { Airport } from '../game/airport';
import type { LightSpot } from './decor';
import { shade, type Palette } from './palette';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * Paints a whole airport complex in the runway's local frame (x along the runway from the threshold,
 * y towards the terminal). Called once into the terrain cache. Runways themselves are painted by the
 * terrain module; this adds taxiways, aprons, stands, terminal, pier, hangars, cargo, fuel farm, fire
 * station, tower, car park and roads.
 */
export function drawAirport(ctx: Ctx, ap: Airport, pal: Palette, lights: LightSpot[], runwayLights: Array<{ x: number; y: number; color: string }>): void {
  const heading = Math.atan2(ap.ux.y, ap.ux.x);
  const flip = ap.side; // local y grows towards the terminal; mirror when the terminal is on the other side
  ctx.save();
  ctx.translate(ap.origin.x, ap.origin.y);
  ctx.rotate(heading);
  ctx.scale(1, flip);
  const L = ap.L, w = ap.w;
  const taxi = pal.taxiway, taxiDark = shade(pal.taxiway, -0.18), apron = shade(pal.taxiway, 0.16);
  const worldOf = (x: number, y: number): { x: number; y: number } => ({ x: ap.origin.x + ap.ux.x * x + ap.uy.x * y, y: ap.origin.y + ap.ux.y * x + ap.uy.y * y });
  const shadowRect = (x: number, y: number, bw: number, bh: number, r = 6): void => { ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.7})`; ctx.beginPath(); ctx.roundRect(x - bw / 2 + 3, y - bh / 2 + 4, bw, bh, r); ctx.fill(); };

  // ---- aprons (drawn first so taxiways sit on top) ----
  const A = ap.apron, G = ap.gaApron;
  shadowRect((A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, A.x1 - A.x0, A.y1 - A.y0, 16);
  ctx.fillStyle = apron; ctx.beginPath(); ctx.roundRect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0, 16); ctx.fill();
  ctx.fillStyle = shade(apron, 0.08); ctx.beginPath(); ctx.roundRect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0, 12); ctx.fill();
  // apron concrete slabs
  ctx.strokeStyle = 'rgba(60,70,90,0.12)'; ctx.lineWidth = 1;
  for (let x = A.x0 + 30; x < A.x1; x += 30) { ctx.beginPath(); ctx.moveTo(x, A.y0); ctx.lineTo(x, A.y1); ctx.stroke(); }
  for (let y = A.y0 + 30; y < A.y1; y += 30) { ctx.beginPath(); ctx.moveTo(A.x0, y); ctx.lineTo(A.x1, y); ctx.stroke(); }

  // ---- taxiways ----
  const tw = 20;
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, color: string): void => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const centre = (x0: number, y0: number, x1: number, y1: number): void => { ctx.setLineDash([]); line(x0, y0, x1, y1, 1.4, 'rgba(255,214,90,0.9)'); };
  // parallel taxiway A with shoulders
  line(-60, ap.taxiwayY, L + 40, ap.taxiwayY, tw + 8, taxiDark);
  line(-60, ap.taxiwayY, L + 40, ap.taxiwayY, tw, taxi);
  // exits, entry, connectors
  for (const e of ap.exits) { line(e, 0, e, ap.taxiwayY, tw + 6, taxiDark); line(e, 0, e, ap.taxiwayY, tw - 2, taxi); }
  line(ap.holdX, ap.taxiwayY, 8, 0, tw + 6, taxiDark); line(ap.holdX, ap.taxiwayY, 8, 0, tw - 2, taxi);
  for (const c of ap.connectors) { line(c, ap.taxiwayY, c, ap.apronLaneY, tw + 6, taxiDark); line(c, ap.taxiwayY, c, ap.apronLaneY, tw - 2, taxi); }
  const gx = G.x0 + 10; line(gx, ap.taxiwayY, gx, G.y0 + 20, tw + 4, taxiDark); line(gx, ap.taxiwayY, gx, G.y0 + 20, tw - 4, taxi);
  // apron lane
  line(A.x0 + 10, ap.apronLaneY, A.x1 - 10, ap.apronLaneY, tw - 4, shade(apron, -0.08));
  // centrelines (yellow)
  centre(-60, ap.taxiwayY, L + 40, ap.taxiwayY);
  for (const e of ap.exits) centre(e, 0, e, ap.taxiwayY);
  centre(ap.holdX, ap.taxiwayY, 8, 0);
  for (const c of ap.connectors) centre(c, ap.taxiwayY, c, ap.apronLaneY);
  centre(A.x0 + 10, ap.apronLaneY, A.x1 - 10, ap.apronLaneY);
  centre(gx, ap.taxiwayY, gx, G.y0 + 20);
  // holding point bars
  ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(ap.holdX - 12, ap.taxiwayY - 12); ctx.lineTo(ap.holdX + 12, ap.taxiwayY - 12); ctx.stroke(); ctx.setLineDash([]);
  // taxiway signs
  ctx.fillStyle = '#1f1f1f'; ctx.fillRect(ap.connectors[0] + 14, ap.taxiwayY + 14, 12, 6);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(ap.connectors[0] + 15, ap.taxiwayY + 15, 10, 4);
  // taxiway edge lights (blue) and apron floodlights
  for (let x = -40; x <= L + 30; x += 34) for (const side of [-1, 1]) runwayLights.push({ ...worldOf(x, ap.taxiwayY + side * (tw / 2 + 4)), color: '#7aa8ff' });

  // ---- stands ----
  for (const g of ap.gates) {
    const x = g.local.x, y = g.local.y;
    if (g.cls === 'ga') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
      continue;
    }
    // lead-in line from the lane to the stop bar, stand box and number
    ctx.strokeStyle = 'rgba(255,214,90,0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, ap.apronLaneY); ctx.lineTo(x, y + 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    const bw = g.cls === 'heavy' ? 70 : 52;
    ctx.strokeRect(x - bw / 2, y - 30, bw, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 9px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(x, y + 42); ctx.scale(1, flip); ctx.rotate(-Math.PI / 2 * flip); ctx.fillText(String(g.id), 0, 3); ctx.restore();
    // jet bridge from the terminal face
    ctx.fillStyle = '#c9d1dc'; ctx.fillRect(x + 8, y + 26, 6, ap.terminalY - (y + 26));
    ctx.fillStyle = '#9aa5b5'; ctx.fillRect(x + 6, y + 22, 10, 8);
    if (pal.lightsOn) lights.push({ ...worldOf(x, y - 8), r: 26, color: 'rgba(255,235,190,0.28)', kind: 'lamp' });
  }

  // ---- buildings ----
  for (const b of ap.buildings) {
    const { x, y, w: bw, h: bh } = b.local;
    switch (b.kind) {
      case 'terminal': {
        shadowRect(x, y, bw, bh, 10);
        ctx.fillStyle = pal.wall; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 10); ctx.fill();
        // glass roof strip along the apron side and skylights
        const g = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
        g.addColorStop(0, '#9fdcff'); g.addColorStop(1, '#4f9fd8');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - bw / 2 + 6, y - bh / 2 + 6, bw - 12, bh * 0.42, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 9; i++) ctx.fillRect(x - bw / 2 + 16 + i * ((bw - 32) / 8), y + 4, 8, 12);
        ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 10); ctx.stroke();
        // gate doors along the apron face
        ctx.fillStyle = pal.lightsOn ? pal.window : '#8fc3e8';
        for (const gt of ap.gates) if (gt.cls !== 'ga') ctx.fillRect(gt.local.x - 5, y - bh / 2 + 1, 10, 4);
        if (pal.lightsOn) for (let i = 0; i < 6; i++) lights.push({ ...worldOf(x - bw / 2 + 24 + i * ((bw - 48) / 5), y), r: 16, color: 'rgba(255,214,120,0.35)', kind: 'window' });
        break;
      }
      case 'pier': {
        shadowRect(x, y, bw, bh, 8);
        ctx.fillStyle = shade(pal.wall, -0.04); ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 8); ctx.fill();
        ctx.fillStyle = '#7fb8e6'; ctx.beginPath(); ctx.roundRect(x - bw / 2 + 8, y - bh / 2 + 8, bw - 16, bh - 16, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.stroke();
        break;
      }
      case 'tower': {
        shadowRect(x, y, bw + 8, bh + 8, 8);
        ctx.fillStyle = '#e8e9ee'; ctx.beginPath(); ctx.arc(x, y, bw / 2 + 3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2f4f77'; ctx.beginPath(); ctx.arc(x, y, bw / 2 - 2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,215,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, bw / 2 - 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
        lights.push({ ...worldOf(x, y), r: 12, color: 'rgba(255,90,90,0.6)', kind: 'beacon' });
        break;
      }
      case 'carpark': {
        ctx.fillStyle = shade(pal.taxiway, -0.05); ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 8); ctx.fill();
        const cols = ['#e35d5b', '#5b7fe3', '#f2f2f2', '#2f3542', '#ffcf5a', '#8bd17c'];
        let k = 0;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) {
          if ((c * 7 + r * 3) % 5 === 0) continue;
          ctx.fillStyle = cols[k++ % cols.length];
          ctx.fillRect(x - bw / 2 + 8 + c * 11.5, y - bh / 2 + 8 + r * 20, 7, 12);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.moveTo(x - bw / 2 + 6, y - bh / 2 + 6 + r * 20); ctx.lineTo(x + bw / 2 - 6, y - bh / 2 + 6 + r * 20); ctx.stroke(); }
        if (pal.lightsOn) lights.push({ ...worldOf(x, y), r: 40, color: 'rgba(255,225,150,0.22)', kind: 'lamp' });
        break;
      }
      case 'hangar': {
        shadowRect(x, y, bw, bh, 6);
        ctx.fillStyle = '#d8dde6'; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
        const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
        g.addColorStop(0, '#7fa6c9'); g.addColorStop(0.5, '#b8d4ea'); g.addColorStop(1, '#7fa6c9');
        ctx.fillStyle = g; ctx.fillRect(x - bw / 2 + 4, y - bh / 2 + 4, bw - 8, bh - 8);
        ctx.fillStyle = '#5c7590'; ctx.fillRect(x - bw / 2 + 6, y - bh / 2 - 3, bw - 12, 5); // doors facing the apron
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - bw / 2 + 6 + i * (bw - 12) / 5, y - bh / 2 - 3); ctx.lineTo(x - bw / 2 + 6 + i * (bw - 12) / 5, y - bh / 2 + 2); ctx.stroke(); }
        break;
      }
      case 'cargo': {
        shadowRect(x, y, bw, bh, 6);
        ctx.fillStyle = '#c9c2b4'; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
        ctx.fillStyle = '#a89f8c'; ctx.fillRect(x - bw / 2 + 4, y - bh / 2 + 4, bw - 8, bh - 8);
        for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#e35d5b', '#5b7fe3', '#ffcf5a', '#8bd17c'][i]; ctx.fillRect(x - bw / 2 + 8 + i * 14, y - bh / 2 - 12, 10, 8); }
        break;
      }
      case 'fuel': {
        for (let i = 0; i < 3; i++) {
          const cx = x - 14 + i * 14, cy = y;
          ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.6})`; ctx.beginPath(); ctx.arc(cx + 2, cy + 3, 7, 0, TAU); ctx.fill();
          const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 7); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c4ccd6');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(60,70,90,0.4)'; ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
        break;
      }
      case 'fire': {
        shadowRect(x, y, bw, bh, 5);
        ctx.fillStyle = '#e0413e'; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - bw / 2 + 6, y - 3, bw - 12, 6);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 16, y + bh / 2 + 6, 12, 7); ctx.fillRect(x + 4, y + bh / 2 + 6, 12, 7);
        break;
      }
    }
  }

  // service road behind the terminal towards the road anchor, and the perimeter fence
  ctx.strokeStyle = shade(pal.sandDark, -0.05); ctx.lineWidth = 8; ctx.lineCap = 'round';
  const roadY = ap.terminalY + 52 + 4;
  ctx.beginPath(); ctx.moveTo(A.x0 + 20, roadY); ctx.lineTo(A.x1 - 20, roadY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(A.x0 + 20, roadY); ctx.lineTo(A.x1 - 20, roadY); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  const fenceBottom = Math.max(...ap.buildings.map(b => b.local.y + b.local.h / 2)) + 26;
  ctx.beginPath(); ctx.roundRect(-72, -(w / 2 + 64), L + 176, fenceBottom + w / 2 + 64, 20); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

/** Small ground vehicles that drive around the apron. */
export function drawVehicles(ctx: Ctx, ap: Airport, time: number): void {
  for (const v of ap.vehicles) {
    const total = pathLength(v.path);
    const d = ((time * v.speed) + v.phase * total) % total;
    const { p, dir } = pointAlong(v.path, d);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(dir);
    ctx.fillStyle = 'rgba(20,40,60,0.3)'; ctx.fillRect(-5, -2, 11, 6);
    if (v.kind === 'tug') {
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(-4, -2.5, 6, 5);
      ctx.fillStyle = '#5b6672'; ctx.fillRect(-11, -2.5, 6, 5); ctx.fillRect(-18, -2.5, 6, 5);
    } else if (v.kind === 'bus') {
      ctx.fillStyle = '#5ad1a5'; ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 3.5, -2, 2, 1.5);
    } else {
      ctx.fillStyle = '#e8ecf2'; ctx.fillRect(-9, -3, 18, 6);
      ctx.fillStyle = '#e0413e'; ctx.fillRect(5, -3, 4, 6);
    }
    ctx.restore();
  }
}

function pathLength(p: Array<{ x: number; y: number }>): number { let l = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; l += Math.hypot(b.x - a.x, b.y - a.y); } return l; }
function pointAlong(p: Array<{ x: number; y: number }>, d: number): { p: { x: number; y: number }; dir: number } {
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l) { const t = d / l; return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: Math.atan2(b.y - a.y, b.x - a.x) }; }
    d -= l;
  }
  return { p: p[0], dir: 0 };
}
