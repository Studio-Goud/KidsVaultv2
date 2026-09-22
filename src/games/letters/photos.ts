/**
 * The photographs, in the game.
 *
 * A reading game that has to name the picture for you has already failed, and for a good half of
 * this word list a drawing is still the best way to say *every pen* rather than *this pen*. For
 * the other half - a cow, the moon, a rose, a crab - a child should be looking at the real thing,
 * and `scripts/letterwords.mjs` goes and finds one that is free to show, checks who took it, and
 * writes the whole lot into `public/letters/photos.json`.
 *
 * That file is fetched, not bundled: the game is drawing its first frame before the request goes
 * out, and every word keeps its drawing underneath. So there are exactly three things on screen at
 * any moment and all three are correct:
 *
 *   - no data yet, or no photograph for this word: the drawing, as it always was;
 *   - a photograph on its way: the drawing, with the photograph fading in over it when it lands;
 *   - a photograph that will not come - no signal, a file that moved: the drawing, for good.
 *
 * With the network off at the start, nothing ever changes from the first case, which is the whole
 * point: Letterbos is a game a child plays on a train in a tunnel.
 *
 * The loading and the drawing itself are the animal book's - `../animals/photo` already queues
 * requests, retries a flaky one twice and crops to fill - so this file is only the word list's own
 * half: which word has one, whether the record may be shown at all, and the credit line.
 */

import { drawCover, photo, photoState } from '../animals/photo';

/** One word's photograph, as it lies in the data file. */
interface Row {
  /** the word it belongs to, the same id `pictures.ts` draws under */
  w: string;
  /** what this word decided to be. The choice is made in the script, not here */
  a: 'photo' | 'drawn';
  /** the path under `/wikipedia/commons/`, with `{w}` where the width goes */
  p?: string;
  /** who took it */
  c?: string;
  /** which licence, as an index into the file's `licences` */
  l?: number;
}

interface Bundle {
  v: number;
  base: string;
  source: string;
  licences: string[];
  words: Row[];
}

export interface WordPhoto {
  word: string;
  path: string;
  credit: string;
  licence: string;
}

/**
 * The licences this game will put on a screen: public domain, CC0, CC BY and CC BY-SA.
 *
 * The harvesting script applies exactly this test before a photograph is written down, and this
 * one applies it again before a photograph is drawn. Two gates rather than one, because the data
 * file is the sort of thing that gets hand-edited at half past eleven: a record whose licence this
 * does not recognise falls back to the drawing instead of being shown.
 *
 * `-NC` (not for commercial use) and `-ND` (no changes) are out. A photograph cropped to fill a
 * frame is a change, so `-ND` is not arguable, and `-NC` is not a licence to build a shipping
 * pipeline on.
 */
const FREE = /^(cc0|cc by [0-9]|cc by-sa [0-9]|public domain|pd|attribution)/i;
const UNFREE = /\b(nc|nd|noncommercial|non-commercial|noderiv)\b/i;

export function isFreeLicence(name: string | null | undefined): boolean {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim();
  return FREE.test(s) && !UNFREE.test(s);
}

/**
 * Does this row carry everything a photograph needs to be shown?
 *
 * A path, somebody to credit, and a licence this game recognises. Anything less and the word keeps
 * its drawing - the same answer for a row that is half written, a row with an unfree licence and a
 * row that was never meant to be a photograph, which is what makes the fallback predictable rather
 * than a thing that depends on what failed.
 */
export function usableRow(row: Row | null | undefined, licences: string[]): boolean {
  if (!row || row.a !== 'photo') return false;
  if (typeof row.p !== 'string' || row.p.length === 0) return false;
  if (typeof row.c !== 'string' || row.c.trim().length === 0) return false;
  const licence = typeof row.l === 'number' ? licences[row.l] : undefined;
  return isFreeLicence(licence);
}

// ---------------------------------------------------------------- the data file

export type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

let state: LoadState = 'idle';
let base = '';
const byWord = new Map<string, WordPhoto>();

/** How many widths Wikimedia will render. Asking for any other size is answered with a 400. */
export const WIDTHS = { card: 330, page: 960 } as const;

/**
 * Read the data file, once. Never throws and never blocks: the game is already playable when this
 * is called and stays playable whatever comes back.
 */
export async function loadPhotos(fetcher: typeof fetch = fetch): Promise<LoadState> {
  if (state !== 'idle') return state;
  state = 'loading';
  try {
    const res = await fetcher('./letters/photos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as Bundle;
    base = d.base ?? '';
    const licences = d.licences ?? [];
    for (const row of d.words ?? []) {
      if (!usableRow(row, licences)) continue;
      byWord.set(row.w, {
        word: row.w,
        path: row.p as string,
        credit: (row.c as string).trim(),
        licence: licences[row.l as number],
      });
    }
    state = byWord.size ? 'ready' : 'failed';
  } catch {
    // no network, a file that is not there, something that is not JSON: the drawings carry on
    state = 'failed';
  }
  return state;
}

export const photosState = (): LoadState => state;
export const photoCount = (): number => byWord.size;

/** The photograph for a word, or null when this word is one of the drawn ones. */
export function photoFor(word: string): WordPhoto | null {
  return byWord.get(word) ?? null;
}

/** The address of one photograph at one of the two widths the game ever asks for. */
export function urlOf(p: WordPhoto, width: number): string {
  return base + p.path.replace('{w}', String(width));
}

/**
 * `Foto: Erik Jansen · CC BY-SA 4.0` - short enough to sit along the foot of the frame.
 *
 * Where the photographs come from is said once, on the level ladder, rather than repeated in every
 * frame: it is the same answer for all of them and the frame is small.
 */
export function creditLine(p: WordPhoto, label: string): string {
  return `${label}: ${p.credit} · ${p.licence}`;
}

// ---------------------------------------------------------------- drawing one

/**
 * Is the photograph up and fully opaque?
 *
 * The drawing is painted underneath while this is false, so the fade-in crossfades out of the
 * drawing rather than out of the wood, and a photograph that never arrives simply never covers it.
 */
export function photoCovers(p: WordPhoto | null, width: number): boolean {
  if (!p) return false;
  return photoState(urlOf(p, width)) === 'ready';
}

/**
 * Draw a photograph to fill the box, cropped from the middle. Returns true once it is all the way
 * in, which is also the moment the credit line is worth drawing.
 */
export function drawWordPhoto(
  ctx: CanvasRenderingContext2D, p: WordPhoto,
  x: number, y: number, w: number, h: number, t: number, width: number, radius = 0,
): boolean {
  const e = photo(urlOf(p, width));
  ctx.save();
  if (radius > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
  }
  const done = drawCover(ctx, e, x, y, w, h, t);
  ctx.restore();
  return done;
}

/** The credit, in a dark strip along the foot of the photograph, the way the animal book does it. */
export function drawCredit(
  ctx: CanvasRenderingContext2D, p: WordPhoto, label: string,
  x: number, y: number, w: number, h: number, font: string, u: number,
): void {
  const strip = 15 * u;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + h - strip, w, strip);
  ctx.clip();
  ctx.fillStyle = 'rgba(8, 24, 36, 0.5)';
  ctx.fillRect(x, y + h - strip, w, strip);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(creditLine(p, label), x + 6 * u, y + h - 4.5 * u, w - 12 * u);
  ctx.restore();
}

/** Only the debug state uses this: which words ended up with a photograph. */
export const photoWords = (): string[] => [...byWord.keys()];
