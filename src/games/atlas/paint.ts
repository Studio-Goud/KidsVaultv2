/**
 * Everything Wereldatlas draws.
 *
 * Under every map is the earth as a satellite sees it: NASA's Blue Marble, cut to each view by
 * scripts/atlasimg.mjs and laid under the outlines by longitude and latitude (satellite.json). The
 * owner asked for a real Netherlands and real water rather than a drawn puzzle, and a child who
 * has seen the Wadden islands from space once knows them. The pieces are still outlines, because a
 * shape can be picked up with a finger and carried across the screen and a patch of photograph
 * cannot; on the photograph they are drawn as lines and glass, so the land shows through.
 *
 * The one thing drawn from numbers rather than outlines is the height of the Netherlands, because
 * that is the only honest way to show a child why half their country is behind a wall.
 */

import { TAU } from '../../util/math';
import { contactShadow, grainOver, hexA, mix, roundRectPath, shade } from '../../render/look';
import {
  HEIGHT, bounds, fit, project, type Box, type Flag, type Pt, type Ring, type View,
} from './geo';
import SAT from './satellite.json';

type Ctx = CanvasRenderingContext2D;

export const SEA = '#bfe0ee';
export const DEEP = '#93c6dd';
export const LAND = '#e6dcc0';
export const INK = '#1d4763';

/** The desk the atlas is open on: paper, a fold, and the grain of the table under it. */
export function drawDesk(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6efdd');
  g.addColorStop(1, '#e6dcc3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  grainOver(ctx, 0, 0, w, h, 0.05);
  // a wash of shadow down the left edge, as though the page were lifting
  const s = ctx.createLinearGradient(0, 0, w * 0.1, 0);
  s.addColorStop(0, 'rgba(110, 88, 50, 0.16)');
  s.addColorStop(1, 'rgba(110, 88, 50, 0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w * 0.1, h);
}

/** A ring of lon/lat as a canvas path in the given box. */
export function ringPath(ctx: Ctx, ring: Ring, view: View, box: Box): void {
  ctx.beginPath();
  ring.forEach((p, i) => {
    const q = project(p, view, box);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
}

export function shapePath(ctx: Ctx, rings: readonly Ring[], view: View, box: Box): void {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach((p, i) => {
      const q = project(p, view, box);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
  }
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  width?: number;
  alpha?: number;
  /** a soft glow, for the shape that is being pointed at */
  glow?: string;
  dash?: number[];
}

export function drawShape(
  ctx: Ctx, rings: readonly Ring[], view: View, box: Box, st: ShapeStyle,
): void {
  ctx.save();
  if (st.alpha != null) ctx.globalAlpha = st.alpha;
  if (st.glow) { ctx.shadowColor = st.glow; ctx.shadowBlur = 18; }
  if (st.fill) { shapePath(ctx, rings, view, box); ctx.fillStyle = st.fill; ctx.fill(); }
  ctx.shadowBlur = 0;
  if (st.stroke) {
    shapePath(ctx, rings, view, box);
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = st.width ?? 1.4;
    ctx.lineJoin = 'round';
    if (st.dash) ctx.setLineDash(st.dash);
    ctx.stroke();
  }
  ctx.restore();
}

/** A river or a dyke: a line with a fatter soft line under it, so it reads at any size. */
export function drawLine(
  ctx: Ctx, path: Ring, view: View, box: Box, colour: string, width: number, halo = true,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (): void => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const q = project(p, view, box);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
  };
  if (halo) {
    trace();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = width * 2.1;
    ctx.stroke();
  }
  trace();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** A city: a pin with a shadow under it, so it sits on the map rather than floating over it. */
export function drawPin(ctx: Ctx, x: number, y: number, s: number, tone: string, lit = false): void {
  ctx.save();
  contactShadow(ctx, x, y + s * 0.1, s * 0.5, s * 0.18, 0.3);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - s * 0.62, y - s * 0.75, x - s * 0.42, y - s * 1.32);
  ctx.arc(x, y - s * 1.45, s * 0.46, Math.PI * 0.86, Math.PI * 0.14, false);
  ctx.quadraticCurveTo(x + s * 0.62, y - s * 0.75, x, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - s * 0.5, y - s * 1.9, x + s * 0.5, y);
  g.addColorStop(0, shade(tone, 0.3));
  g.addColorStop(1, shade(tone, -0.18));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = lit ? '#ffffff' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - s * 1.45, s * 0.19, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- flags

/**
 * A flag from its description.
 *
 * Bands, a cross, a disc: three words, and between them they draw eighteen real flags correctly.
 * A flag that needs more than that - a coat of arms, a canton full of stars - is not in the game,
 * because a drawn approximation of one of those is a wrong flag rather than a simple one.
 */
export function drawFlag(ctx: Ctx, x: number, y: number, w: number, h: number, f: Flag): void {
  // Switzerland's flag is square. A square flag stretched into a rectangle is a different flag, so
  // it is drawn in the middle of the box it was given and the rest of the box is left alone.
  if (f.kind === 'cross' && f.square) {
    const side = Math.min(w, h);
    x += (w - side) / 2;
    y += (h - side) / 2;
    w = side;
    h = side;
  }
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.07);
  ctx.save();
  ctx.clip();
  if (f.kind === 'bands') {
    const n = f.colours.length;
    const weights = f.weights ?? f.colours.map(() => 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const span = weights[i] / total;
      ctx.fillStyle = f.colours[i];
      if (f.dir === 'h') ctx.fillRect(x, y + at * h, w, span * h + 0.6);
      else ctx.fillRect(x + at * w, y, span * w + 0.6, h);
      at += span;
    }
  } else if (f.kind === 'cross' && f.square) {
    // the Swiss cross, by the measurements in its own law: the arms are six parts wide and the
    // whole cross twenty parts across a flag of thirty-two, so it never touches an edge
    ctx.fillStyle = f.field;
    ctx.fillRect(x, y, w, h);
    const bw = h * (6 / 32), arm = h * (20 / 32);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = f.cross;
    ctx.fillRect(cx - arm / 2, cy - bw / 2, arm, bw);
    ctx.fillRect(cx - bw / 2, cy - arm / 2, bw, arm);
  } else if (f.kind === 'cross') {
    ctx.fillStyle = f.field;
    ctx.fillRect(x, y, w, h);
    // a Nordic cross: off to the hoist, which is what makes it a Nordic cross
    const bw = h * 0.22, cx = x + w * 0.36, cy = y + h / 2;
    const inner = f.inner ? bw * 0.42 : 0;
    ctx.fillStyle = f.cross;
    ctx.fillRect(x, cy - bw / 2, w, bw);
    ctx.fillRect(cx - bw / 2, y, bw, h);
    if (f.inner) {
      ctx.fillStyle = f.inner;
      ctx.fillRect(x, cy - inner / 2, w, inner);
      ctx.fillRect(cx - inner / 2, y, inner, h);
    }
  } else {
    ctx.fillStyle = f.field;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f.disc;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, h * (f.r ?? 0.3), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(20, 48, 70, 0.35)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, Math.min(w, h) * 0.07);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the height of the land

const rampFor = (m: number): string => {
  if (m < -4) return '#2f6f52';
  if (m < 0) return '#4e9063';
  if (m < 6) return '#9ec37a';
  if (m < 16) return '#d6cf8a';
  if (m < 40) return '#d4b06a';
  if (m < 120) return '#c08a54';
  return '#a8724a';
};

/**
 * The Netherlands by height, and what happens when the dykes stop being there.
 *
 * Every band that is lower than the water standing outside goes blue. At sea level that is a
 * quarter of the country; at the height the storm reached in 1953 it is most of the west. Nothing
 * here is a scare: it is a height map with a number on it, and the number is the sea.
 */
export function drawHeightMap(
  ctx: Ctx, view: View, box: Box, sea: number | null, clip: readonly Ring[],
): void {
  ctx.save();
  shapePath(ctx, clip, view, box);
  ctx.clip();
  // everything the bands do not cover is ordinary ground a whisker above the sea, so the country
  // is filled with that first and the bands are laid over it - otherwise the map is a handful of
  // patches with the sea showing through the gaps between them
  const base = 0.5;
  shapePath(ctx, clip, view, box);
  ctx.fillStyle = sea != null && base < sea ? '#3f86bd' : rampFor(base);
  ctx.fill();
  // the low ground first, then the high, so the highest band wins where they overlap
  const order = [...HEIGHT].sort((a, b) => a.m - b.m);
  for (const band of order) {
    const flooded = sea != null && band.m < sea;
    drawShape(ctx, band.rings, view, box, {
      fill: flooded ? '#3f86bd' : rampFor(band.m),
      alpha: flooded ? 0.92 : 0.95,
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- a piece in the hand

/**
 * One shape, drawn anywhere at any zoom.
 *
 * A piece is the same drawing whether it is lying in the tray, halfway across the screen under a
 * finger, or home on the map - only the number of pixels per degree changes. Everything is
 * measured out from an anchor point, which for a piece is its own middle, so putting the anchor
 * under the finger means the finger *is* the middle of the piece and a drop can simply ask
 * whether that point is inside the place it belongs.
 */
export function scaledPath(
  ctx: Ctx, rings: readonly Ring[], anchor: Pt, s: number, kx: number, cx: number, cy: number,
): void {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach((p, i) => {
      const x = cx + (p[0] - anchor[0]) * kx * s;
      const y = cy - (p[1] - anchor[1]) * s;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

/**
 * How many pixels a degree of latitude gets, to make this shape fill this box.
 *
 * Measured out from the shape's anchor rather than from the middle of its bounding box, because
 * the anchor is what sits under the finger and therefore what the drawing is centred on. North
 * America's anchor is well west of the middle of North America, and a shape scaled to its box and
 * then drawn round its anchor hangs off the edge of the tray.
 */
export function scaleToFit(
  rings: readonly Ring[], box: Box, kx: number, pad = 0.9, anchor?: Pt,
): number {
  const b = bounds(rings);
  if (!anchor) {
    const dlon = Math.max(0.0001, (b.lon1 - b.lon0) * kx);
    const dlat = Math.max(0.0001, b.lat1 - b.lat0);
    return Math.min(box.w / dlon, box.h / dlat) * pad;
  }
  const hx = Math.max(0.0001, Math.max(anchor[0] - b.lon0, b.lon1 - anchor[0]) * kx);
  const hy = Math.max(0.0001, Math.max(anchor[1] - b.lat0, b.lat1 - anchor[1]));
  return Math.min(box.w / (2 * hx), box.h / (2 * hy)) * pad;
}

/** The piece as though cut from card: a lit face, a white edge, and a shadow that grows as it lifts. */
export function drawPieceAt(
  ctx: Ctx, rings: readonly Ring[], anchor: Pt, s: number, kx: number,
  cx: number, cy: number, tone: string, lifted: number,
): void {
  ctx.save();
  ctx.shadowColor = `rgba(20, 44, 64, ${0.22 + lifted * 0.26})`;
  ctx.shadowBlur = 8 + lifted * 20;
  ctx.shadowOffsetY = 3 + lifted * 9;
  scaledPath(ctx, rings, anchor, s, kx, cx, cy);
  const g = ctx.createLinearGradient(cx - 60, cy - 60, cx + 60, cy + 60);
  g.addColorStop(0, shade(tone, 0.26));
  g.addColorStop(1, shade(tone, -0.14));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  scaledPath(ctx, rings, anchor, s, kx, cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.4, s * 0.012);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** The same for a river or a dyke, which is a line rather than a patch. */
export function drawLineAt(
  ctx: Ctx, path: Ring, anchor: Pt, s: number, kx: number,
  cx: number, cy: number, colour: string, width: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (): void => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const x = cx + (p[0] - anchor[0]) * kx * s;
      const y = cy - (p[1] - anchor[1]) * s;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
  };
  trace();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = width * 2.2;
  ctx.stroke();
  trace();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** The sea, as the backdrop of any board. */
export function drawSea(ctx: Ctx, box: Box, r: number): void {
  const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  g.addColorStop(0, mix(SEA, '#ffffff', 0.18));
  g.addColorStop(1, DEEP);
  ctx.save();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  grainOver(ctx, box.x, box.y, box.w, box.h, 0.05);
  ctx.restore();
  ctx.strokeStyle = hexA(INK, 0.25);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, box.x + 0.75, box.y + 0.75, box.w - 1.5, box.h - 1.5, r);
  ctx.stroke();
}

/** The lines of longitude and latitude, faintly, so a map reads as a map. */
export function drawGraticule(ctx: Ctx, view: View, box: Box, step: number): void {
  const f = fit(view, box);
  ctx.save();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, Math.min(box.w, box.h) * 0.04);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let lon = Math.ceil(view.lon0 / step) * step; lon <= view.lon1; lon += step) {
    const x = f.x + (lon - view.lon0) * view.kx * f.s;
    ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke();
  }
  for (let lat = Math.ceil(view.lat0 / step) * step; lat <= view.lat1; lat += step) {
    const y = f.y + (view.lat1 - lat) * f.s;
    ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the satellite picture

type Board = keyof typeof SAT;
const pics = new Map<string, HTMLImageElement>();
const ready = new Set<string>();
const masks = new Map<string, HTMLCanvasElement>();
let shimmer: HTMLCanvasElement | null = null;

/** The picture for a board, once it has loaded; null until then, and the painted map stands in. */
function picture(board: Board): HTMLImageElement | null {
  let img = pics.get(board);
  if (!img) {
    img = new Image();
    img.onload = () => { ready.add(board); };
    img.src = `./img/atlas/${board}.jpg`;
    pics.set(board, img);
  }
  return ready.has(board) ? img : null;
}

/**
 * Where the water is in a picture, worked out once from its colours. Blue Marble's open sea is
 * nearly black (0,11,13 off the Dutch coast) and its darkest forest is still three times as bright
 * (32,42,17 in the Eifel), so darkness alone tells them apart; the muddy water right along a coast
 * is as bright as the land and is left out. The glitter is drawn only where this says water.
 */
function seaMask(board: Board, img: HTMLImageElement): HTMLCanvasElement | null {
  const have = masks.get(board);
  if (have) return have;
  try {
    const w = 900, h = Math.round(900 * img.naturalHeight / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2];
      const water = r + gg + b < 50 && r < 14;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      d.data[i + 3] = water ? 255 : 0;
    }
    g.putImageData(d, 0, 0);
    masks.set(board, c);
    return c;
  } catch { return null; }
}

/**
 * The earth under a map: the photograph, lightened for a phone held in daylight, and the sea
 * glittering slowly. Returns false while the picture is still loading.
 */
export function drawSatellite(ctx: Ctx, board: Board, view: View, box: Box, t: number): boolean {
  const img = picture(board);
  const b = SAT[board];
  if (!img || !b) return false;
  const a = project([b.lon0, b.lat1], view, box);
  const z = project([b.lon1, b.lat0], view, box);
  const r = Math.min(box.w, box.h) * 0.04;
  ctx.save();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
  ctx.clip();
  ctx.drawImage(img, a.x, a.y, z.x - a.x, z.y - a.y);
  // Blue Marble is a dark picture: lifted a little, the way a screen in the sun needs it
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(70, 82, 74, 0.42)';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalCompositeOperation = 'source-over';

  // the sea: long soft bands of light drifting across it, only where there is water
  const m = seaMask(board, img);
  if (m) {
    const sw = Math.max(1, Math.round(box.w / 2)), sh = Math.max(1, Math.round(box.h / 2));
    shimmer ??= document.createElement('canvas');
    if (shimmer.width !== sw || shimmer.height !== sh) { shimmer.width = sw; shimmer.height = sh; }
    const g = shimmer.getContext('2d');
    if (g) {
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, sw, sh);
      g.drawImage(m, (a.x - box.x) / 2, (a.y - box.y) / 2, (z.x - a.x) / 2, (z.y - a.y) / 2);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = 'rgba(40, 110, 160, 0.55)';
      g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 7; k++) {
        const y = ((k / 7) * sh * 1.4 + t * (6 + k * 1.3)) % (sh * 1.4) - sh * 0.2;
        const band = g.createLinearGradient(0, y - 10, 0, y + 10);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(0.5, `rgba(210,240,255,${0.18 + 0.08 * Math.sin(t * 0.7 + k)})`);
        band.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = band;
        g.save();
        g.translate(0, y);
        g.rotate(-0.08);
        g.fillRect(-20, -12, sw + 40, 24);
        g.restore();
      }
      ctx.globalAlpha = 0.9;
      ctx.drawImage(shimmer, box.x, box.y, box.w, box.h);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  ctx.strokeStyle = hexA(INK, 0.3);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, box.x + 0.75, box.y + 0.75, box.w - 1.5, box.h - 1.5, r);
  ctx.stroke();
  return true;
}

/**
 * A river as water that moves: its own blue, and light running along it from where it rises to
 * where it reaches the sea. Every river in geo.ts is listed that way, source first, so the light
 * always shows which way the water goes - which is the thing a child cannot see on a drawn line.
 * The two dykes are paths too, and are drawn with `drawLine`: a dyke does not flow.
 */
export function drawFlow(ctx: Ctx, path: Ring, view: View, box: Box, colour: string, width: number, t: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (): void => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const q = project(p, view, box);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
  };
  trace();
  ctx.strokeStyle = 'rgba(8, 40, 70, 0.55)';
  ctx.lineWidth = width * 1.9;
  ctx.stroke();
  trace();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
  trace();
  ctx.setLineDash([width * 1.6, width * 3.4]);
  ctx.lineDashOffset = -t * width * 6;
  ctx.strokeStyle = 'rgba(225, 245, 255, 0.85)';
  ctx.lineWidth = width * 0.45;
  ctx.stroke();
  ctx.restore();
}
