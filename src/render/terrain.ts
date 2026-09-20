import type { IslandDef, LevelDef } from '../game/types';
import type { Runway } from '../game/world';
import { dist, TAU, type Vec } from '../util/math';
import { islandPolygon, pointInPoly, polyArea, scalePoly, type IslandShape } from '../game/geo';
import { drawAirport } from './airportfx';
import { makeRng } from '../util/rng';
import { drawBoat, drawBush, drawCastle, drawFlowers, drawHangar, drawHouse, drawLighthouse, drawPalm, drawPine, drawTerminal, drawTowerBase, drawTree, drawVillage, drawWindmillBase, type LightSpot } from './decor';
import { hexA, shade, type Palette } from './palette';
import { effects as upgradeEffects } from '../game/upgrades';

export type { IslandShape };
export interface TerrainData {
  canvas: HTMLCanvasElement;
  pixelScale: number;
  islands: IslandShape[];
  lights: LightSpot[];
  windmills: Array<{ x: number; y: number }>;
  beacons: Array<{ x: number; y: number }>;
  runwayLights: Array<{ x: number; y: number; color: string }>;
  boats: Array<{ x: number; y: number; rot: number }>;
  W: number; H: number;
}

type Ctx = CanvasRenderingContext2D;

function tracePoly(ctx: Ctx, poly: Vec[]): void {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

function runwayRectContains(rw: Runway, p: Vec, margin: number): boolean {
  const dx = p.x - rw.threshold.x, dy = p.y - rw.threshold.y;
  const along = dx * rw.dir.x + dy * rw.dir.y;
  const lat = Math.abs(-dx * rw.dir.y + dy * rw.dir.x);
  if (rw.kind === 'helipad') return Math.hypot(dx, dy) < 40 + margin;
  return along > -70 - margin && along < rw.length + 30 + margin && lat < rw.width * 0.5 + margin;
}

function drawSea(ctx: Ctx, W: number, H: number, pal: Palette, rng: () => number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.seaDeep); g.addColorStop(0.55, pal.seaMid); g.addColorStop(1, shade(pal.seaMid, 0.08));
  ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
  // soft depth blotches
  for (let i = 0; i < 9; i++) {
    const x = rng() * W, y = rng() * H, r = 120 + rng() * 260;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = i % 3 === 0;
    rg.addColorStop(0, hexA(dark ? pal.seaDeep : pal.seaShallow, dark ? 0.35 : 0.16));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drawRunway(ctx: Ctx, rw: Runway, pal: Palette, lights: LightSpot[], rl: TerrainData['runwayLights']): void {
  ctx.save();
  ctx.translate(rw.threshold.x, rw.threshold.y);
  ctx.rotate(rw.heading);
  const L = rw.length, w = rw.width;
  if (rw.kind === 'helipad') {
    ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha})`; ctx.beginPath(); ctx.arc(3, 3, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.asphaltEdge; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.asphalt; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.marking; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(-7, 9); ctx.moveTo(7, -9); ctx.lineTo(7, 9); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; rl.push({ x: rw.threshold.x + Math.cos(a) * 25, y: rw.threshold.y + Math.sin(a) * 25, color: '#7cf7a0' }); }
    ctx.restore();
    return;
  }
  if (rw.kind === 'water') {
    // lane on the sea: darker calm strip and buoys
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.roundRect(-20, -w / 2, L + 40, w, 14); ctx.fill();
    ctx.setLineDash([12, 16]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(L - 20, 0); ctx.stroke(); ctx.setLineDash([]);
    for (let x = 0; x <= L; x += 40) {
      for (const side of [-1, 1]) {
        const y = side * (w / 2);
        ctx.fillStyle = 'rgba(0,30,60,0.25)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = x === 0 ? '#3ad36b' : x >= L - 1 ? '#ff5a5a' : '#ff9a3c';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.6, 0, TAU); ctx.fill();
        const wx = rw.threshold.x + rw.dir.x * x - rw.dir.y * y, wy = rw.threshold.y + rw.dir.y * x + rw.dir.x * y;
        rl.push({ x: wx, y: wy, color: x === 0 ? '#7cf7a0' : x >= L - 1 ? '#ff7a7a' : '#ffd27a' });
      }
    }
    ctx.restore();
    return;
  }
  // paved runway
  ctx.fillStyle = `rgba(20,50,40,${pal.shadowAlpha * 0.8})`;
  ctx.beginPath(); ctx.roundRect(-14 + 3, -w / 2 + 4, L + 28, w, 6); ctx.fill();
  ctx.fillStyle = pal.asphaltEdge; ctx.beginPath(); ctx.roundRect(-14, -w / 2, L + 28, w, 6); ctx.fill();
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, shade(pal.asphalt, 0.08)); g.addColorStop(1, shade(pal.asphalt, -0.08));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-10, -w / 2 + 3, L + 20, w - 6, 4); ctx.fill();
  // edge lines
  ctx.strokeStyle = pal.marking; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-6, -w / 2 + 5); ctx.lineTo(L + 6, -w / 2 + 5); ctx.moveTo(-6, w / 2 - 5); ctx.lineTo(L + 6, w / 2 - 5); ctx.stroke();
  // threshold piano keys
  const keys = rw.kind === 'long' ? 8 : 6;
  const kw = (w - 14) / keys;
  for (let i = 0; i < keys; i++) {
    ctx.fillStyle = pal.marking; ctx.fillRect(6, -w / 2 + 7 + i * kw + kw * 0.2, 26, kw * 0.6);
  }
  // runway number
  const num = Math.round((((rw.heading * 180 / Math.PI) + 90 + 360) % 360) / 10) || 36;
  ctx.save(); ctx.translate(58, 0); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = pal.marking; ctx.font = `bold ${Math.round(w * 0.42)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(num.toString().padStart(2, '0'), 0, 0);
  ctx.restore();
  // aiming point bars
  ctx.fillStyle = pal.marking; ctx.fillRect(95, -w * 0.3, 24, w * 0.11); ctx.fillRect(95, w * 0.19, 24, w * 0.11);
  // centre line
  for (let x = 78; x < L - 30; x += 24) ctx.fillRect(x, -1.2, 13, 2.4);
  // far threshold keys
  for (let i = 0; i < keys; i++) ctx.fillRect(L - 30, -w / 2 + 7 + i * kw + kw * 0.2, 22, kw * 0.6);
  // lights along edges
  for (let x = 0; x <= L; x += 30) {
    for (const side of [-1, 1]) {
      const y = side * (w / 2 + 3);
      const wx = rw.threshold.x + rw.dir.x * x - rw.dir.y * y, wy = rw.threshold.y + rw.dir.y * x + rw.dir.x * y;
      rl.push({ x: wx, y: wy, color: x === 0 ? '#7cf7a0' : x >= L - 1 ? '#ff7a7a' : '#ffe9a8' });
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, TAU); ctx.fill();
    }
  }
  // threshold light bar (green) and end (red)
  for (let y = -w / 2 + 4; y <= w / 2 - 4; y += 6) {
    rl.push({ x: rw.threshold.x - rw.dir.x * 4 - rw.dir.y * y, y: rw.threshold.y - rw.dir.y * 4 + rw.dir.x * y, color: '#7cf7a0' });
  }
  ctx.restore();
  void lights;
}

function inFootprint(r: { x: number; y: number; w: number; h: number; rot: number }, p: Vec, margin: number): boolean {
  const dx = p.x - r.x, dy = p.y - r.y;
  const c = Math.cos(-r.rot), s = Math.sin(-r.rot);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) < r.w / 2 + margin && Math.abs(ly) < r.h / 2 + margin;
}

export function buildTerrain(level: LevelDef, runways: Runway[], W: number, H: number, pixelScale: number, pal: Palette, mustContain: Vec[] = []): TerrainData {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(W * pixelScale); canvas.height = Math.ceil(H * pixelScale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelScale, pixelScale);
  const rng = makeRng(level.seed * 31 + 7);
  const lights: LightSpot[] = [];
  const windmills: TerrainData['windmills'] = [];
  const beacons: TerrainData['beacons'] = [];
  const runwayLights: TerrainData['runwayLights'] = [];
  const boats: TerrainData['boats'] = [];

  drawSea(ctx, W, H, pal, rng);
  const islands = level.islands.map(def => islandPolygon(def, W, H, mustContain));

  // shallow halos first for all islands
  for (const isl of islands) {
    for (const [s, a] of [[1.16, 0.28], [1.09, 0.35], [1.04, 0.45]] as Array<[number, number]>) {
      ctx.fillStyle = hexA(pal.seaShallow, a);
      tracePoly(ctx, scalePoly(isl.poly, isl.cx, isl.cy, s)); ctx.fill();
    }
  }

  const drawables: Array<{ y: number; fn: () => void }> = [];

  for (const isl of islands) {
    const irng = makeRng(isl.def.seed);
    // cliff / thickness
    ctx.fillStyle = pal.cliff; tracePoly(ctx, scalePoly(isl.poly, isl.cx, isl.cy, 1, 16)); ctx.fill();
    ctx.fillStyle = shade(pal.cliff, 0.18); tracePoly(ctx, scalePoly(isl.poly, isl.cx, isl.cy, 1, 8)); ctx.fill();
    // sand
    ctx.fillStyle = pal.sand; tracePoly(ctx, isl.poly); ctx.fill();
    ctx.fillStyle = hexA(pal.sandDark, 0.5); tracePoly(ctx, scalePoly(isl.poly, isl.cx, isl.cy, 0.985, 3)); ctx.fill();
    // grass
    const grassPoly = scalePoly(isl.poly, isl.cx, isl.cy, 0.94, -5);
    ctx.fillStyle = pal.grassDark; tracePoly(ctx, scalePoly(isl.poly, isl.cx, isl.cy, 0.95, -3)); ctx.fill();
    ctx.fillStyle = pal.grass; tracePoly(ctx, grassPoly); ctx.fill();
    // grass texture
    ctx.save(); tracePoly(ctx, grassPoly); ctx.clip();
    const area = polyArea(grassPoly);
    const bx = Math.min(...grassPoly.map(p => p.x)), by = Math.min(...grassPoly.map(p => p.y));
    const bw = Math.max(...grassPoly.map(p => p.x)) - bx, bh = Math.max(...grassPoly.map(p => p.y)) - by;
    const blobs = Math.floor(area / 6000);
    for (let i = 0; i < blobs; i++) {
      const x = bx + irng() * bw, y = by + irng() * bh;
      ctx.fillStyle = hexA(i % 3 === 0 ? pal.grassLight : pal.grassDark, 0.35);
      ctx.beginPath(); ctx.ellipse(x, y, 20 + irng() * 40, 10 + irng() * 22, irng() * Math.PI, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // decor anchors for later
    const islandRunways = runways.filter(rw => rw.kind !== 'water' && pointInPoly(rw.center, isl.poly));
    // named decor is pushed out of any airport footprint so villages never end up on the apron
    const decorPts = isl.def.decor.map(d => {
      let wx = d.x * W, wy = d.y * H;
      for (const rw of islandRunways) {
        const fp = rw.airport?.footprint; if (!fp) continue;
        const margin = d.kind === 'village' ? 90 : 50;
        if (!inFootprint(fp, { x: wx, y: wy }, margin)) continue;
        const dx = wx - fp.x, dy = wy - fp.y; const l = Math.hypot(dx, dy) || 1;
        for (let k = 0; k < 40 && inFootprint(fp, { x: wx, y: wy }, margin); k++) { wx += (dx / l) * 20; wy += (dy / l) * 20; }
      }
      return { ...d, wx, wy };
    });

    // airport complexes (taxiways, aprons, terminal ...) and the access road from the village
    const village = decorPts.find(d => d.kind === 'village');
    let apron: Vec | null = null;
    for (const rw of islandRunways) {
      if (!rw.airport || rw.parallelOf) continue;
      drawAirport(ctx, rw.airport, pal, lights, runwayLights);
      apron = rw.airport.roadAnchor;
      if (village) {
        ctx.strokeStyle = shade(pal.sandDark, -0.05); ctx.lineWidth = 9; ctx.lineCap = 'round';
        const c = { x: (village.wx + apron.x) / 2 + (irng() - 0.5) * 120, y: (village.wy + apron.y) / 2 + (irng() - 0.5) * 80 };
        ctx.beginPath(); ctx.moveTo(village.wx, village.wy); ctx.quadraticCurveTo(c.x, c.y, apron.x, apron.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(village.wx, village.wy); ctx.quadraticCurveTo(c.x, c.y, apron.x, apron.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (const rw of islandRunways) drawRunway(ctx, rw, pal, lights, runwayLights);

    // scatter vegetation
    const style = isl.def.style;
    const treeCount = Math.floor(area / (style === 'pine' ? 5200 : 6800));
    const occupied = (p: Vec, margin: number): boolean => {
      if (!pointInPoly(p, scalePoly(isl.poly, isl.cx, isl.cy, 0.9, -4))) return true;
      for (const rw of islandRunways) { if (runwayRectContains(rw, p, margin + 26)) return true; if (rw.airport && inFootprint(rw.airport.footprint, p, margin + 10)) return true; }
      if (apron && dist(p, apron) < 40 + margin) return true;
      for (const d of decorPts) if (dist(p, { x: d.wx, y: d.wy }) < (d.kind === 'village' ? 78 : d.kind === 'terminal' ? 60 : 44) + margin) return true;
      return false;
    };
    for (let i = 0, tries = 0; i < treeCount && tries < treeCount * 12; tries++) {
      const p = { x: bx + irng() * bw, y: by + irng() * bh };
      if (occupied(p, 6)) continue;
      i++;
      const r = 9 + irng() * 8, variant = Math.floor(irng() * 3);
      const kind = style === 'pine' ? (irng() < 0.75 ? 'pine' : 'tree') : style === 'tropic' ? (irng() < 0.5 ? 'palm' : 'tree') : (irng() < 0.85 ? 'tree' : 'pine');
      drawables.push({ y: p.y, fn: () => { if (kind === 'pine') drawPine(ctx, p.x, p.y, r, pal, variant); else if (kind === 'palm') drawPalm(ctx, p.x, p.y, r, pal, variant); else drawTree(ctx, p.x, p.y, r, pal, variant); } });
    }
    const bushes = Math.floor(treeCount * 0.5);
    for (let i = 0, tries = 0; i < bushes && tries < bushes * 10; tries++) {
      const p = { x: bx + irng() * bw, y: by + irng() * bh };
      if (occupied(p, 0)) continue;
      i++;
      const r = 4 + irng() * 4;
      drawables.push({ y: p.y - 2, fn: () => drawBush(ctx, p.x, p.y, r, pal) });
    }
    const flowers = Math.floor(treeCount * 0.6);
    for (let i = 0, tries = 0; i < flowers && tries < flowers * 10; tries++) {
      const p = { x: bx + irng() * bw, y: by + irng() * bh };
      if (occupied(p, -4)) continue;
      i++;
      const frng = makeRng(Math.floor(p.x * 13 + p.y * 7));
      drawables.push({ y: -1e9, fn: () => drawFlowers(ctx, p.x, p.y, frng, pal) });
    }
    // stray houses
    const houses = Math.floor(area / 90000);
    for (let i = 0, tries = 0; i < houses && tries < 60; tries++) {
      const p = { x: bx + irng() * bw, y: by + irng() * bh };
      if (occupied(p, 18)) continue;
      i++;
      const w = 16 + irng() * 8, h = 9 + irng() * 4, roof = pal.roof[Math.floor(irng() * pal.roof.length)];
      drawables.push({ y: p.y, fn: () => drawHouse(ctx, p.x, p.y, w, h, roof, pal, lights, irng) });
    }
    // named decor
    for (const d of decorPts) {
      const x = d.wx, y = d.wy;
      switch (d.kind) {
        case 'village': drawables.push({ y, fn: () => drawVillage(ctx, x, y, pal, lights, irng) }); break;
        case 'lighthouse': drawables.push({ y, fn: () => drawLighthouse(ctx, x, y, pal, lights) }); break;
        case 'tower': drawables.push({ y, fn: () => { beacons.push(drawTowerBase(ctx, x, y, pal, lights)); } }); break;
        case 'terminal': {
          const tier = upgradeEffects().terminalTier;
          drawables.push({ y, fn: () => { ctx.save(); ctx.translate(x, y); ctx.scale(1 + tier * 0.22, 1 + tier * 0.15); ctx.translate(-x, -y); drawTerminal(ctx, x, y, pal, lights); ctx.restore(); } });
          if (tier >= 2) drawables.push({ y: y + 40, fn: () => drawHangar(ctx, x - 70, y + 40, pal, lights) });
          if (tier >= 3) drawables.push({ y: y + 40, fn: () => drawHangar(ctx, x + 70, y + 40, pal, lights) });
          break;
        }
        case 'hangar': drawables.push({ y, fn: () => drawHangar(ctx, x, y, pal, lights) }); break;
        case 'windmill': drawables.push({ y, fn: () => { windmills.push(drawWindmillBase(ctx, x, y, pal)); } }); break;
        case 'castle': drawables.push({ y, fn: () => drawCastle(ctx, x, y, pal, lights) }); break;
      }
    }
  }

  // water runways are drawn on the sea, under everything on land
  for (const rw of runways) if (rw.kind === 'water') drawRunway(ctx, rw, pal, lights, runwayLights);

  // boats in open water
  const boatCount = 3;
  for (let i = 0, tries = 0; i < boatCount && tries < 60; tries++) {
    const p = { x: 60 + rng() * (W - 120), y: 60 + rng() * (H * 0.62) };
    let onLand = false;
    for (const isl of islands) if (pointInPoly(p, scalePoly(isl.poly, isl.cx, isl.cy, 1.25))) { onLand = true; break; }
    for (const rw of runways) if (rw.kind === 'water' && runwayRectContains(rw, p, 60)) onLand = true;
    if (onLand) continue;
    i++;
    boats.push({ x: p.x, y: p.y, rot: rng() * TAU });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();
  for (const b of boats) drawBoat(ctx, b.x, b.y, b.rot, pal);

  return { canvas, pixelScale, islands, lights, windmills, beacons, runwayLights, boats, W, H };
}
