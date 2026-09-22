/**
 * The picture at a stop, whichever kind it is.
 *
 * A journey draws a world, and where that world's picture comes from is the journey's business,
 * not the engine's. Three kinds: a frame that ships with the app (the planets and moons, which
 * Planetarium already had), a photograph on Wikimedia Commons (everything else), and nothing at
 * all, which is drawn as a soft disc in the world's own colour.
 *
 * All three end up as a circle of the same size in the same place, so the engine never has to
 * know which it got. A picture that has not arrived yet is the circle with a slow shimmer over
 * it, and a picture that will not come is the plain circle - a journey with the network off still
 * runs from end to end, it is just less to look at.
 */

import { drawCover, photo, photoUrl, type PhotoState } from '../platform/photo';
import { CREDITS, drawPhoto, loadPhoto, moonPhoto, planetPhoto } from '../platform/planetphoto';
import { breathe, hexA } from '../render/look';
import type { Journey, Stop } from './types';

type Ctx = CanvasRenderingContext2D;

/** Wikimedia's thumbnail service, the same one the animal book uses. */
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';

const remoteUrl = (j: Journey, path: string, width: number): string =>
  photoUrl(j.photoBase ?? COMMONS, path, width);

/** Ask for everything a journey needs, early, so the first stop is not a blank circle. */
export function loadPictures(j: Journey): void {
  for (const s of j.stops) {
    if (s.picture.kind === 'planet') void loadPhoto(s.picture.id, 'planets');
    else if (s.picture.kind === 'moon') void loadPhoto(s.picture.id, 'moons');
    else if (s.picture.kind === 'remote') photo(remoteUrl(j, s.picture.path, 960));
  }
}

/** Is it here yet? Only the shimmer cares. */
export function pictureState(j: Journey, s: Stop): PhotoState {
  if (s.picture.kind === 'none' || s.picture.kind === 'drawn') return 'ready';
  if (s.picture.kind === 'remote') return photo(remoteUrl(j, s.picture.path, 960)).state;
  const got = s.picture.kind === 'planet' ? planetPhoto(s.picture.id) : moonPhoto(s.picture.id);
  return got ? 'ready' : 'loading';
}

/**
 * Who took it.
 *
 * Shown under the picture, every time the picture is shown, because that is what the licences
 * these photographs carry actually ask for: several of them are CC BY-SA, which wants the name
 * and the licence named with the work rather than on a page nobody opens. The shipped planet
 * frames are public domain and want nothing, and they are credited anyway.
 */
export function credit(s: Stop): string {
  if (s.picture.kind === 'remote') return s.picture.credit;
  if (s.picture.kind === 'planet') return CREDITS[s.picture.id] ?? '';
  return '';
}

/**
 * Draw the stop's picture as a circle of radius `r` at (cx, cy).
 *
 * A shipped planet frame is drawn by its own globe, so Saturn lands on its ball and its rings
 * hang outside the circle where they belong. A Commons photograph is cropped to fill and clipped
 * round, which is what a lead photograph wants.
 */
export function drawPicture(ctx: Ctx, j: Journey, s: Stop, cx: number, cy: number, r: number, t: number): void {
  if (s.picture.kind === 'planet' || s.picture.kind === 'moon') {
    const got = s.picture.kind === 'planet' ? planetPhoto(s.picture.id) : moonPhoto(s.picture.id);
    if (got) { drawPhoto(ctx, got, cx, cy, r); return; }
    waiting(ctx, s, cx, cy, r, t, true);
    return;
  }
  if (s.picture.kind === 'remote') {
    const e = photo(remoteUrl(j, s.picture.path, 960));
    if (e.state === 'ready') {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      drawCover(ctx, e, cx - r, cy - r, r * 2, r * 2, t);
      ctx.restore();
      ring(ctx, cx, cy, r);
      return;
    }
    waiting(ctx, s, cx, cy, r, t, e.state !== 'failed');
    return;
  }
  if (s.picture.kind === 'drawn') {
    // the journey's own art: a silhouette in a circle, on the world's colour. It is clipped to
    // the circle so a stop can draw past the edge without minding where the edge is.
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, hexA(s.tone, 0.95));
    g.addColorStop(1, hexA(s.tone, 0.55));
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.translate(cx, cy);
    s.picture.art(ctx, r);
    ctx.restore();
    ring(ctx, cx, cy, r);
    return;
  }
  waiting(ctx, s, cx, cy, r, t, false);
}

/** The circle in the world's own colour: what stands there before, instead of, or without a photo. */
function waiting(ctx: Ctx, s: Stop, cx: number, cy: number, r: number, t: number, shimmer: boolean): void {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, hexA(s.tone, 0.95));
  g.addColorStop(1, hexA(s.tone, 0.45));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  if (shimmer) {
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.12 * breathe(t, 2.2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ring(ctx, cx, cy, r);
}

function ring(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}
