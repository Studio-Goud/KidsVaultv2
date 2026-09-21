import { GATE_R, RING_EXTRA, SEP_GAP, World, type Runway } from '../game/world';
import type { Plane } from '../game/types';
import { clamp, dist, TAU, type Vec } from '../util/math';
import { CloudField, drawPuff, drawSeaLife, WindField } from './effects';
import { drawHud, type HudHits, type HudLayout } from './hud';
import { PALETTES, shade, type Palette } from './palette';
import { drawPlane, drawPlaneLights, drawPlaneShadow, type PlaneView } from './planes';
import { buildTerrain, type TerrainData } from './terrain';
import { drawWindmillBlades } from './decor';
import { WeatherFx } from './weatherfx';
import { drawVehicles } from './airportfx';
import { mustContainPoints } from '../game/ground';

type Ctx = CanvasRenderingContext2D;

const lightSprites = new Map<string, HTMLCanvasElement>();
function lightSprite(color: string): HTMLCanvasElement {
  let c = lightSprites.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, color); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  lightSprites.set(color, c);
  return c;
}

export function planeView(p: Plane): PlaneView {
  return { type: p.type, pos: p.pos, heading: p.heading, altitude: p.altitude, bank: p.bank, livery: p.livery, state: p.state, id: p.id, landingT: p.state === 'landing' ? p.landingT : undefined, boost: p.boost };
}

export class Renderer {
  ctx: Ctx;
  dpr = 1;
  sw = 1; sh = 1;
  scale = 1; ox = 0; oy = 0;
  /** camera: zoom factor and pan (screen px) on top of the fitted view */
  zoom = 1; panX = 0; panY = 0;
  W = 800; H = 1600;
  terrain: TerrainData | null = null;
  clouds: CloudField | null = null;
  windField: WindField | null = null;
  wxfx: WeatherFx | null = null;
  pal: Palette = PALETTES.morning;
  hudHits: HudHits | null = null;
  safe = { top: 0, bottom: 0, left: 0, right: 0 };
  private worldRef: World | null = null;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  suggestWorldWidth(): number {
    // the map is 1600 tall; its width follows the screen so phones and tablets both fill the frame
    const w = Math.round(clamp((this.sw / this.sh) * 1600, 700, 2400));
    return Number.isFinite(w) ? w : 800;
  }

  readSafeArea(): void {
    const cs = getComputedStyle(document.documentElement);
    const px = (v: string): number => parseFloat(v) || 0;
    this.safe = { top: px(cs.getPropertyValue('--sat')), bottom: px(cs.getPropertyValue('--sab')), left: px(cs.getPropertyValue('--sal')), right: px(cs.getPropertyValue('--sar')) };
  }

  resize(): void {
    this.sw = Math.max(1, window.innerWidth || 1); this.sh = Math.max(1, window.innerHeight || 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.sw * this.dpr);
    this.canvas.height = Math.round(this.sh * this.dpr);
    this.readSafeArea();
    if (this.worldRef) this.fit(this.worldRef, true);
  }

  private fit(world: World, rebuild: boolean): void {
    this.W = world.W; this.H = world.H;
    this.scale = Math.min(this.sh / this.H, this.sw / this.W);
    this.ox = (this.sw - this.W * this.scale) / 2;
    this.oy = (this.sh - this.H * this.scale) / 2;
    if (rebuild || !this.terrain) {
      const res = Math.min(1.7, Math.sqrt(9e6 / (this.W * this.H * this.scale * this.scale * this.dpr * this.dpr)));
      this.terrain = buildTerrain(world.level, world.runways, this.W, this.H, this.scale * this.dpr * Math.max(1, res), this.pal, mustContainPoints(world), world.shift);
    }
  }

  setWorld(world: World): void {
    this.worldRef = world;
    this.resetView();
    this.pal = PALETTES[world.level.time];
    this.terrain = null;
    this.fit(world, true);
    this.clouds = new CloudField(world.level.clouds, this.W, this.H, world.level.seed, this.pal);
    this.windField = new WindField(this.W, this.H);
    this.wxfx = new WeatherFx(this.W, this.H);
  }

  private viewScale(): number { return this.scale * this.zoom; }
  private viewOx(): number { return this.ox + this.panX; }
  private viewOy(): number { return this.oy + this.panY; }
  toWorld = (sx: number, sy: number): Vec => ({ x: (sx - this.viewOx()) / this.viewScale(), y: (sy - this.viewOy()) / this.viewScale() });
  zoomAt = (sx: number, sy: number, factor: number): void => {
    const before = this.toWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, 1, 3);
    // keep the world point under the finger fixed
    this.panX = sx - before.x * this.viewScale() - this.ox;
    this.panY = sy - before.y * this.viewScale() - this.oy;
    this.clampPan();
  };
  panBy = (dx: number, dy: number): void => { this.panX += dx; this.panY += dy; this.clampPan(); };
  resetView = (): void => { this.zoom = 1; this.panX = 0; this.panY = 0; };
  private clampPan(): void {
    if (this.zoom <= 1.001) { this.panX = 0; this.panY = 0; return; }
    const vw = this.W * this.viewScale(), vh = this.H * this.viewScale();
    const minX = Math.min(0, this.sw - vw - this.ox * 2) , maxX = 0;
    const minY = Math.min(0, this.sh - vh - this.oy * 2), maxY = 0;
    // pan is relative to the fitted offset; allow the zoomed world to slide but never show beyond its edges
    this.panX = clamp(this.panX, minX - this.ox * (this.zoom - 1), maxX + this.ox * 0) ;
    this.panY = clamp(this.panY, minY - this.oy * (this.zoom - 1), maxY);
  }

  hudHit = (sx: number, sy: number): string | null => {
    const inside = (h?: { x: number; y: number; w: number; h: number }): boolean => !!h && sx >= h.x && sx <= h.x + h.w && sy >= h.y && sy <= h.y + h.h;
    if (inside(this.hudHits?.pause)) return 'pause';
    if (inside(this.hudHits?.build)) return 'build';
    if (inside(this.hudHits?.slowmo)) return 'slowmo';
    for (const c of this.hudHits?.commands ?? []) if (inside(c.rect)) return `cmd:${c.id}`;
    if (inside(this.hudHits?.wxToggle)) return 'wxtoggle';
    if (this.hudHits?.panel && inside(this.hudHits.panel)) return 'panel';
    return null;
  };

  private worldTransform(): void {
    const vs = this.viewScale();
    this.ctx.setTransform(this.dpr * vs, 0, 0, this.dpr * vs, this.viewOx() * this.dpr, this.viewOy() * this.dpr);
  }
  private screenTransform(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  frame(world: World, time: number, dt: number, showHud: boolean): void {
    const ctx = this.ctx, pal = this.pal;
    if (!this.terrain) this.fit(world, true);
    const T = this.terrain!;
    const px = 1 / this.viewScale(); // one screen pixel in world units

    this.screenTransform();
    // the open sea runs edge to edge, so a rotated tablet shows more ocean instead of dead bars.
    // the stops match the terrain painter's own sea, and canvas clamps past the ends, so the
    // seam where the map begins is invisible.
    {
      const top = this.viewOy(), bottom = this.viewOy() + this.H * this.viewScale();
      const g = bottom - top > 1
        ? ctx.createLinearGradient(0, top, 0, bottom)
        : null;
      if (g) {
        g.addColorStop(0, pal.seaDeep); g.addColorStop(0.55, pal.seaMid); g.addColorStop(1, shade(pal.seaMid, 0.08));
        ctx.fillStyle = g;
      } else ctx.fillStyle = pal.seaDeep;
      ctx.fillRect(0, 0, this.sw, this.sh);
    }

    this.worldTransform();
    ctx.drawImage(T.canvas, 0, 0, this.W, this.H);
    drawSeaLife(ctx, this.W, this.H, time, pal, T.islands, world.windNoise);

    if (this.clouds) { this.clouds.update(dt, world.wind.vec, this.W, this.H); this.clouds.drawShadows(ctx); }
    if (this.wxfx) this.wxfx.drawCells(ctx, world.weather, time);

    if (this.wxfx) this.wxfx.drawWetRunways(ctx, world.weather, world.runways, time);
    // approach corridors and gates
    for (const rw of world.runways) this.drawGate(ctx, rw, world, time, px);

    for (const rw of world.runways) if (rw.airport && !rw.parallelOf) drawVehicles(ctx, rw.airport, time);
    // animated decor
    const bladeSpeed = 0.5 + world.wind.kmh * 0.09;
    for (const wm of T.windmills) drawWindmillBlades(ctx, wm, time * bladeSpeed);

    // routes
    for (const p of world.planes) if (p.state === 'flying' && p.path.length > 1) this.drawPath(ctx, p, time, px);

    // weather navigation for the selected aircraft: predicted ground track and wind drift
    const selP = world.selected !== null ? world.planeById(world.selected) : undefined;
    if (selP && selP.state === 'flying' && !world.demo) {
      const track = world.predictTrack(selP, 9);
      ctx.strokeStyle = 'rgba(120,230,255,0.9)'; ctx.lineWidth = 2.2 * px; ctx.setLineDash([3 * px, 6 * px]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(selP.pos.x, selP.pos.y); for (const q of track) ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]);
      const wv = world.weather.vec, sens = selP.type.windSensitivity * world.fx.windFactor;
      const wl = Math.hypot(wv.x, wv.y);
      const L = wl * sens * 3;
      if (L > 4) {
        const ux = wv.x / wl, uy = wv.y / wl;
        const ox = selP.pos.x + ux * (selP.type.hull + 34), oy = selP.pos.y + uy * (selP.type.hull + 34);
        ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 3 * px;
        ctx.beginPath(); ctx.moveTo(ox - ux * L, oy - uy * L); ctx.lineTo(ox, oy); ctx.stroke();
        ctx.fillStyle = 'rgba(255,220,120,0.95)';
        ctx.beginPath(); ctx.moveTo(ox + ux * 8 * px, oy + uy * 8 * px); ctx.lineTo(ox - uy * 5 * px, oy + ux * 5 * px); ctx.lineTo(ox + uy * 5 * px, oy - ux * 5 * px); ctx.closePath(); ctx.fill();
      }
    }
    for (const p of world.planes) {
      if (p.state !== 'flying') continue;
      if (p.hold) {
        const R = (p.type.speed * p.boost) / (p.type.turnRate * 0.55);
        const cx = p.pos.x + Math.cos(p.heading + Math.PI / 2) * R, cy = p.pos.y + Math.sin(p.heading + Math.PI / 2) * R;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * px; ctx.setLineDash([6 * px, 6 * px]); ctx.lineDashOffset = -time * 20;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (p.evadeUntil > world.time) {
        ctx.strokeStyle = `rgba(255,170,60,${0.5 + 0.5 * Math.sin(time * 12)})`; ctx.lineWidth = 3 * px;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.type.hull + 18, 0, TAU); ctx.stroke();
      }
    }
    // contrails
    for (const p of world.planes) this.drawTrail(ctx, p);

    // separation rings + distance labels
    this.drawSeparation(ctx, world, time, px);

    // aircraft
    const sorted = world.planes.slice().sort((a, b) => a.altitude - b.altitude);
    for (const p of sorted) if (p.state !== 'crashed' || time - p.landingT < 0.4) drawPlaneShadow(ctx, planeView(p), pal.shadowAlpha);
    for (const p of sorted) {
      if (p.state === 'crashed') continue;
      drawPlane(ctx, planeView(p), time, pal.lightsOn);
      if (p.ice > 0.25) {
        ctx.strokeStyle = `rgba(170,230,255,${0.3 + 0.5 * p.ice})`; ctx.lineWidth = 2 * px;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.type.hull + 4, 0, TAU); ctx.stroke();
      }
      if (p.urgent && p.fuel > 0 && p.state === 'flying') {
        const frac = p.fuel / p.type.fuel;
        const r = p.type.hull + RING_EXTRA + 6;
        const hot = p.fuel < 15;
        ctx.strokeStyle = hot ? `rgba(255,80,80,${0.6 + 0.4 * Math.sin(time * 10)})` : 'rgba(255,190,60,0.9)'; ctx.lineWidth = 3 * px; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
        ctx.font = `900 ${12 * px}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = `${Math.ceil(p.fuel)} s`;
        const w = ctx.measureText(label).width + 12 * px, h = 18 * px;
        ctx.fillStyle = hot ? 'rgba(200,30,60,0.95)' : 'rgba(180,110,10,0.9)';
        ctx.beginPath(); ctx.roundRect(p.pos.x - w / 2, p.pos.y - r - h - 4 * px, w, h, h / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(label, p.pos.x, p.pos.y - r - h / 2 - 4 * px);
      }
      if (world.selected === p.id && world.selectedUntil > world.time && p.state === 'flying') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * px; ctx.setLineDash([6 * px, 5 * px]); ctx.lineDashOffset = -time * 30;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.type.hull + 12 + Math.sin(time * 4) * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (const pf of world.puffs) drawPuff(ctx, pf, world.time, this.W, this.H);

    if (this.windField) { this.windField.update(dt, world.wind.vec); this.windField.draw(ctx, world.wind.vec, world.wind.kmh); }
    if (this.wxfx) this.wxfx.drawPrecip(ctx, world.weather, time, dt);
    if (this.clouds) this.clouds.drawClouds(ctx);

    // time-of-day tint
    if (pal.tint) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = pal.tintAlpha;
      ctx.fillStyle = pal.tint; ctx.fillRect(-10, -10, this.W + 20, this.H + 20); ctx.restore();
    }
    // lights
    if (pal.lightsOn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of T.lights) {
        const r = l.kind === 'beacon' ? l.r * (0.9 + 0.1 * Math.sin(time * 5)) : l.r;
        ctx.drawImage(lightSprite(l.color), l.x - r, l.y - r, r * 2, r * 2);
      }
      for (const l of T.runwayLights) ctx.drawImage(lightSprite(l.color), l.x - 6, l.y - 6, 12, 12);
      // lighthouse beams
      for (const l of T.lights) {
        if (l.kind !== 'beacon' || l.r < 20) continue;
        const a = time * 0.9;
        const g = ctx.createConicGradient(a, l.x, l.y);
        g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(0.06, 'rgba(255,240,180,0)'); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.arc(l.x, l.y, 260, a, a + 0.5); ctx.closePath(); ctx.fill();
      }
      for (const p of world.planes) if (p.state === 'flying' || p.state === 'landing') drawPlaneLights(ctx, planeView(p), time);
      ctx.restore();
    } else {
      // small daylight glints on runway lights
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of T.beacons) ctx.drawImage(lightSprite(((time * 1.2) % 1) < 0.15 ? 'rgba(255,80,80,0.9)' : 'rgba(255,80,80,0.15)'), b.x - 8, b.y - 8, 16, 16);
      ctx.restore();
    }

    // slow motion: cool vignette
    if (world.timeScale < 1) {
      const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.25, this.W / 2, this.H / 2, this.H * 0.75);
      g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(60,110,220,0.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    }
    // no letterbox vignette: the sea already runs edge to edge, and a dark seam at the map border
    // is exactly what a rotated tablet must not show
    this.screenTransform();

    if (this.wxfx) { this.wxfx.drawFog(ctx, world.weather, this.sw, this.sh, time, pal); this.wxfx.drawFlash(ctx, this.sw, this.sh); }

    if (showHud) {
      // a tablet gets a bigger HUD, not a phone HUD floating in a large screen
      const ui = clamp(Math.min(this.sw, this.sh * 0.62) / 400, 0.85, 2.2);
      const layout: HudLayout = { sw: this.sw, sh: this.sh, safeTop: this.safe.top, safeBottom: this.safe.bottom, safeLeft: this.safe.left, safeRight: this.safe.right, ui };
      this.hudHits = drawHud(ctx, world, layout, time, pal);
    } else {
      this.hudHits = null;
    }
  }

  private drawGate(ctx: Ctx, rw: Runway, world: World, time: number, px: number): void {
    if (rw.closed) return;
    const locked = world.planes.some(p => p.lockedRunway === rw.id && p.state === 'flying');
    const busy = rw.occupiedBy !== null;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const col = locked ? `rgba(120,255,170,${0.75 + 0.25 * pulse})` : busy ? 'rgba(255,120,120,0.8)' : `rgba(255,255,255,${0.45 + 0.2 * pulse})`;
    if (rw.kind === 'helipad') {
      ctx.strokeStyle = col; ctx.lineWidth = 2.5 * px; ctx.setLineDash([8 * px, 6 * px]); ctx.lineDashOffset = -time * 20;
      ctx.beginPath(); ctx.arc(rw.gate.x, rw.gate.y, GATE_R * 0.85, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    const back = 250;
    const sx = rw.gate.x - rw.dir.x * back, sy = rw.gate.y - rw.dir.y * back;
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + 0.08 * pulse})`; ctx.lineWidth = 2 * px; ctx.setLineDash([10 * px, 12 * px]); ctx.lineDashOffset = -time * 40;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(rw.gate.x, rw.gate.y); ctx.stroke(); ctx.setLineDash([]);
    // chevrons pointing along the landing direction
    ctx.save(); ctx.translate(rw.gate.x, rw.gate.y); ctx.rotate(rw.heading);
    ctx.strokeStyle = col; ctx.lineWidth = 3.2 * px; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const x = -22 + i * 14 + ((time * 26) % 14);
      const a = 1 - Math.abs(i - 1) * 0.25;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(x - 10, -13); ctx.lineTo(x, 0); ctx.lineTo(x - 10, 13); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // gate ring
    ctx.strokeStyle = col; ctx.lineWidth = 2 * px;
    ctx.beginPath(); ctx.ellipse(0, 0, GATE_R * 0.9, GATE_R * 0.9, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  private drawPath(ctx: Ctx, p: Plane, time: number, px: number): void {
    const start = Math.max(0, Math.min(p.pathIndex, p.path.length - 1));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.pos.x, p.pos.y);
    for (let i = start; i < p.path.length; i++) ctx.lineTo(p.path[i].x, p.path[i].y);
    ctx.strokeStyle = 'rgba(10,40,80,0.28)'; ctx.lineWidth = 7 * px; ctx.stroke();
    if (p.lockedRunway) {
      ctx.strokeStyle = '#7cf7a0'; ctx.lineWidth = 3 * px; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 3 * px; ctx.setLineDash([9 * px, 7 * px]); ctx.lineDashOffset = -time * 40;
    }
    ctx.stroke(); ctx.setLineDash([]);
    const end = p.path[p.path.length - 1];
    if (!p.lockedRunway) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(end.x, end.y, 4 * px, 0, TAU); ctx.fill();
    }
  }

  private drawTrail(ctx: Ctx, p: Plane): void {
    if (p.trail.length < 3 || p.state === 'crashed') return;
    const n = p.trail.length;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = (i / n) * 0.22 * (p.altitude);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1.5, p.type.hull * 0.18) * (i / n);
      ctx.beginPath(); ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y); ctx.stroke();
    }
  }

  private drawSeparation(ctx: Ctx, world: World, time: number, px: number): void {
    const air = world.planes.filter(p => p.state === 'flying' || (p.state === 'landing' && p.altitude > 0.12));
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    for (const p of air) {
      const r = p.type.hull + RING_EXTRA;
      const hot = p.conflictWith.size > 0;
      if (hot) {
        ctx.fillStyle = `rgba(255,70,70,${0.12 + 0.1 * pulse})`; ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, r, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = hot ? `rgba(255,90,90,${0.75 + 0.25 * pulse})` : 'rgba(255,255,255,0.32)';
      ctx.lineWidth = (hot ? 2.2 : 1.3) * px;
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, r, 0, TAU); ctx.stroke();
    }
    // distance labels for pairs that are getting close
    for (let i = 0; i < air.length; i++) {
      for (let j = i + 1; j < air.length; j++) {
        const a = air[i], b = air[j];
        const gap = World.gap(a, b);
        if (gap > world.fx.radarRange) continue;
        const hot = gap < SEP_GAP;
        const col = hot ? 'rgba(255,90,90,0.95)' : 'rgba(255,200,80,0.9)';
        ctx.strokeStyle = col; ctx.lineWidth = 1.6 * px; ctx.setLineDash([5 * px, 5 * px]);
        ctx.beginPath(); ctx.moveTo(a.pos.x, a.pos.y); ctx.lineTo(b.pos.x, b.pos.y); ctx.stroke(); ctx.setLineDash([]);
        const mx = (a.pos.x + b.pos.x) / 2, my = (a.pos.y + b.pos.y) / 2;
        const label = `${Math.max(0, Math.round(gap))} m`;
        ctx.font = `900 ${13 * px}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 14 * px, h = 20 * px;
        ctx.fillStyle = hot ? 'rgba(200,30,60,0.95)' : 'rgba(20,40,70,0.85)';
        ctx.beginPath(); ctx.roundRect(mx - w / 2, my - h / 2 - 14 * px, w, h, h / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(label, mx, my - 14 * px);
      }
    }
  }

  /** Utility for thumbnails: draw only the static terrain of a world into a target canvas. */
  static drawThumbnail(target: HTMLCanvasElement, world: World, pal: Palette): void {
    const cw = target.width, ch = target.height;
    const scale = Math.max(cw / world.W, ch / world.H);
    const T = buildTerrain(world.level, world.runways, world.W, world.H, scale, pal);
    const ctx = target.getContext('2d')!;
    ctx.fillStyle = pal.seaDeep; ctx.fillRect(0, 0, cw, ch);
    const dw = world.W * scale, dh = world.H * scale;
    // anchor to the bottom so the main island with the runway is always in view
    const offX = (cw - dw) / 2, offY = Math.min(0, ch - dh + 10);
    ctx.drawImage(T.canvas, offX, offY, dw, dh);
    if (pal.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = pal.tintAlpha; ctx.fillStyle = pal.tint; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (pal.lightsOn) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.setTransform(scale, 0, 0, scale, offX, offY);
      for (const l of T.lights) ctx.drawImage(lightSprite(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      for (const l of T.runwayLights) ctx.drawImage(lightSprite(l.color), l.x - 7, l.y - 7, 14, 14);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

export const distance = dist;
