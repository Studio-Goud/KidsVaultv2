import type { Airport, Building } from '../game/airport';
import type { Vec } from '../util/math';
import type { LightSpot } from './decor';
import { shade, type Palette } from './palette';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * Paints a whole airport complex in world coordinates: aprons, the taxi network with markings and
 * lights, stands with lead-in lines and jet bridges, and every building. Works for both the
 * procedural island airports and the real-world layouts because both are the same data.
 */
export function drawAirport(ctx: Ctx, ap: Airport, pal: Palette, lights: LightSpot[], runwayLights: Array<{ x: number; y: number; color: string }>): void {
  const taxi = pal.taxiway, taxiDark = shade(pal.taxiway, -0.18), apronCol = shade(pal.taxiway, 0.16);
  const poly = (pts: Vec[]): void => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };

  // ---- aprons ----
  for (const a of ap.aprons) {
    ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.6})`;
    ctx.save(); ctx.translate(3, 4); poly(a.poly); ctx.fill(); ctx.restore();
    ctx.fillStyle = a.kind === 'stand' ? apronCol : shade(apronCol, 0.08);
    poly(a.poly); ctx.fill();
    // concrete slab joints
    ctx.save(); poly(a.poly); ctx.clip();
    const xs = a.poly.map(p => p.x), ys = a.poly.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.strokeStyle = 'rgba(60,70,90,0.1)'; ctx.lineWidth = 1;
    for (let x = x0; x < x1; x += 28) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (let y = y0; y < y1; y += 28) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    ctx.restore();
  }

  // ---- taxiways: shoulder, surface, centreline ----
  const widthOf = (cls: string): number => (cls === 'taxi' ? 20 : cls === 'lane' ? 16 : 12);
  ctx.lineCap = 'round';
  for (const pass of [0, 1, 2]) {
    for (const e of ap.edges) {
      const a = ap.nodes[e.a], b = ap.nodes[e.b];
      const w = widthOf(e.cls);
      if (pass === 0) { ctx.strokeStyle = taxiDark; ctx.lineWidth = w + 7; }
      else if (pass === 1) { ctx.strokeStyle = e.cls === 'lane' ? shade(apronCol, -0.08) : taxi; ctx.lineWidth = w; }
      else { ctx.strokeStyle = 'rgba(255,214,90,0.9)'; ctx.lineWidth = 1.4; }
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // edge lights along the main taxiways
  for (const e of ap.edges) {
    if (e.cls !== 'taxi') continue;
    const a = ap.nodes[e.a], b = ap.nodes[e.b];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / (len || 1), uy = (b.y - a.y) / (len || 1);
    for (let d = 10; d < len; d += 36) for (const s of [-1, 1]) {
      runwayLights.push({ x: a.x + ux * d - uy * s * 14, y: a.y + uy * d + ux * s * 14, color: '#7aa8ff' });
    }
  }
  // holding point bars
  for (const id of Object.keys(ap.holds)) {
    const n = ap.nodes[ap.holds[id]];
    const lu = ap.lineUp[id];
    if (!n || !lu) continue;
    const ang = Math.atan2(lu.y - n.y, lu.x - n.x);
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(10, 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1f1f1f'; ctx.fillRect(-6, 16, 14, 7);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-5, 17, 12, 5);
    ctx.restore();
  }

  // ---- stands ----
  for (const g of ap.gates) {
    if (g.cls === 'ga') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(g.pos.x - 10, g.pos.y); ctx.lineTo(g.pos.x + 10, g.pos.y); ctx.moveTo(g.pos.x, g.pos.y - 10); ctx.lineTo(g.pos.x, g.pos.y + 10); ctx.stroke();
      continue;
    }
    const lane = ap.nodes[g.node];
    ctx.strokeStyle = 'rgba(255,214,90,0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(lane.x, lane.y); ctx.lineTo(g.pos.x, g.pos.y); ctx.stroke();
    ctx.save(); ctx.translate(g.pos.x, g.pos.y); ctx.rotate(g.heading);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    const bw = g.cls === 'heavy' ? 70 : 52;
    ctx.strokeRect(-30, -bw / 2, 62, bw);
    // stop bar and stand number
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(26, -10); ctx.lineTo(26, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 10px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(-38, 0); ctx.rotate(-g.heading); ctx.fillText(g.label, 0, 0); ctx.restore();
    if (g.bridge) { ctx.fillStyle = '#c9d1dc'; ctx.fillRect(22, bw / 2 - 4, 34, 7); ctx.fillStyle = '#9aa5b5'; ctx.fillRect(18, bw / 2 - 6, 10, 11); }
    ctx.restore();
    if (pal.lightsOn) lights.push({ x: g.pos.x, y: g.pos.y, r: 26, color: 'rgba(255,235,190,0.28)', kind: 'lamp' });
  }

  // ---- buildings ----
  for (const b of ap.buildings) drawBuilding(ctx, b, pal, lights, ap);
}

function drawBuilding(ctx: Ctx, b: Building, pal: Palette, lights: LightSpot[], ap: Airport): void {
  const { w: bw, h: bh } = b;
  ctx.save(); ctx.translate(b.pos.x, b.pos.y); ctx.rotate(b.rot);
  const shadow = (r = 6): void => { ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.7})`; ctx.beginPath(); ctx.roundRect(-bw / 2 + 3, -bh / 2 + 4, bw, bh, r); ctx.fill(); };
  switch (b.kind) {
    case 'terminal': case 'satellite': {
      shadow(10);
      ctx.fillStyle = pal.wall; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 10); ctx.fill();
      const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, '#9fdcff'); g.addColorStop(1, '#4f9fd8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-bw / 2 + 6, -bh / 2 + 6, bw - 12, bh * 0.42, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const n = Math.max(3, Math.round(bw / 30));
      for (let i = 0; i < n; i++) ctx.fillRect(-bw / 2 + 16 + i * ((bw - 32) / Math.max(1, n - 1)), 4, 8, Math.min(12, bh * 0.3));
      ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 10); ctx.stroke();
      if (pal.lightsOn) for (let i = 0; i < 5; i++) lights.push({ x: b.pos.x + Math.cos(b.rot) * (-bw / 2 + 24 + i * ((bw - 48) / 4)), y: b.pos.y + Math.sin(b.rot) * (-bw / 2 + 24 + i * ((bw - 48) / 4)), r: 18, color: 'rgba(255,214,120,0.32)', kind: 'window' });
      break;
    }
    case 'pier': {
      shadow(8);
      ctx.fillStyle = shade(pal.wall, -0.04); ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 8); ctx.fill();
      ctx.fillStyle = '#7fb8e6'; ctx.beginPath(); ctx.roundRect(-bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.stroke();
      break;
    }
    case 'tower': {
      shadow(8);
      ctx.fillStyle = '#e8e9ee'; ctx.beginPath(); ctx.arc(0, 0, bw / 2 + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2f4f77'; ctx.beginPath(); ctx.arc(0, 0, bw / 2 - 2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,215,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, bw / 2 - 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      lights.push({ x: b.pos.x, y: b.pos.y, r: 12, color: 'rgba(255,90,90,0.6)', kind: 'beacon' });
      break;
    }
    case 'carpark': {
      ctx.fillStyle = shade(pal.taxiway, -0.05); ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 8); ctx.fill();
      const cols = ['#e35d5b', '#5b7fe3', '#f2f2f2', '#2f3542', '#ffcf5a', '#8bd17c'];
      const rows = Math.max(1, Math.floor(bh / 22)), cells = Math.max(2, Math.floor(bw / 12));
      let k = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cells; c++) {
        if ((c * 7 + r * 3) % 5 === 0) continue;
        ctx.fillStyle = cols[k++ % cols.length];
        ctx.fillRect(-bw / 2 + 6 + c * (bw - 12) / cells, -bh / 2 + 6 + r * (bh - 8) / rows, Math.max(4, (bw - 12) / cells - 4), Math.max(7, (bh - 8) / rows - 8));
      }
      if (pal.lightsOn) lights.push({ x: b.pos.x, y: b.pos.y, r: Math.max(bw, bh) * 0.4, color: 'rgba(255,225,150,0.2)', kind: 'lamp' });
      break;
    }
    case 'hangar': {
      shadow(6);
      ctx.fillStyle = '#d8dde6'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      g.addColorStop(0, '#7fa6c9'); g.addColorStop(0.5, '#b8d4ea'); g.addColorStop(1, '#7fa6c9');
      ctx.fillStyle = g; ctx.fillRect(-bw / 2 + 4, -bh / 2 + 4, bw - 8, bh - 8);
      ctx.fillStyle = '#5c7590'; ctx.fillRect(-bw / 2 + 6, -bh / 2 - 3, bw - 12, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-bw / 2 + 6 + i * (bw - 12) / 5, -bh / 2 - 3); ctx.lineTo(-bw / 2 + 6 + i * (bw - 12) / 5, -bh / 2 + 2); ctx.stroke(); }
      break;
    }
    case 'cargo': {
      shadow(6);
      ctx.fillStyle = '#c9c2b4'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = '#a89f8c'; ctx.fillRect(-bw / 2 + 4, -bh / 2 + 4, bw - 8, bh - 8);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#e35d5b', '#5b7fe3', '#ffcf5a', '#8bd17c'][i]; ctx.fillRect(-bw / 2 + 8 + i * 14, -bh / 2 - 12, 10, 8); }
      break;
    }
    case 'fuel': {
      for (let i = 0; i < 3; i++) {
        const cx = -14 + i * 14;
        ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.6})`; ctx.beginPath(); ctx.arc(cx + 2, 3, 7, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(cx - 2, -2, 1, cx, 0, 7); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c4ccd6');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, 0, 7, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(60,70,90,0.4)'; ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      break;
    }
    case 'fire': {
      shadow(5);
      ctx.fillStyle = '#e0413e'; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-bw / 2 + 6, -3, bw - 12, 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-16, bh / 2 + 6, 12, 7); ctx.fillRect(4, bh / 2 + 6, 12, 7);
      break;
    }
  }
  ctx.restore();
  void ap;
}

/** Small ground vehicles that drive around the apron. */
export function drawVehicles(ctx: Ctx, ap: Airport, time: number): void {
  for (const v of ap.vehicles) {
    const total = pathLength(v.path);
    if (total <= 0) continue;
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

function pathLength(p: Vec[]): number { let l = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; l += Math.hypot(b.x - a.x, b.y - a.y); } return l; }
function pointAlong(p: Vec[], d: number): { p: Vec; dir: number } {
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l) { const t = d / (l || 1); return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: Math.atan2(b.y - a.y, b.x - a.x) }; }
    d -= l;
  }
  return { p: p[0], dir: 0 };
}
