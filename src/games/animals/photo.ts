/**
 * The photographs.
 *
 * Orbit ships its eleven planets with the app, because there are eleven of them. There are a few
 * thousand animals, so theirs stay on Wikimedia Commons and are fetched as they are needed. That
 * changes two things and nothing else: a picture can be late, and a picture can fail.
 *
 * So every photograph has three states and all three are drawn. While it is on its way there is a
 * card in the animal's own colour with a soft shimmer over it, so the grid never flashes empty.
 * When it arrives it is drawn to fill its frame, cropped from the middle, which is where the
 * animal is in a lead photograph. When it will not come at all - no signal, a file that has moved -
 * a drawn silhouette of the group takes its place, and the book carries on working with no
 * photographs at all.
 *
 * Nothing is read back out of the canvas, so the images never need to be same-origin, and the
 * browser's own cache means the second look at an animal is instant.
 */

export type PhotoState = 'idle' | 'loading' | 'ready' | 'failed';

interface Entry {
  state: PhotoState;
  img: HTMLImageElement | null;
  /** when it arrived, for the fade-in */
  at: number;
  /** how many times it has been asked for: a flaky connection gets a second and a third go */
  tries: number;
}

const cache = new Map<string, Entry>();
/** how many are in flight: a grid of forty would otherwise open forty connections at once */
let flight = 0;
const queue: Array<() => void> = [];
const MAX_FLIGHT = 6;
/** how many goes one photograph gets before the drawn stand-in takes over for good */
const MAX_TRIES = 3;

let onArrive: (() => void) | null = null;
/** The app asks to be told when a picture lands, so a still screen can redraw itself. */
export function onPhoto(fn: () => void): void { onArrive = fn; }

function pump(): void {
  while (flight < MAX_FLIGHT && queue.length) {
    const next = queue.shift();
    if (next) next();
  }
}

/**
 * The full address of one photograph, at the width it is wanted.
 *
 * Wikimedia's thumbnailer takes the width out of the address itself, so the data file stores the
 * path with a hole in it and the width goes in here: a small one for a grid of cards, a large one
 * for the animal actually open. That saves a phone about nine tenths of the pixels a full-size
 * photograph would cost, and because only three widths are ever asked for, the browser's cache is
 * shared across the whole book.
 *
 * The widths are not free choices. Wikimedia renders thumbnails at a fixed set of sizes and answers
 * 400 to anything else, so only `SIZES` below may be asked for - they are the ones the MediaWiki
 * API itself rounds a request up to.
 */
export const SIZES = { row: 250, card: 330, page: 960 } as const;

export function photoUrl(base: string, path: string, width: number): string {
  // almost every thumbnail is named after its own file, so the data file leaves that half out and
  // it is put back here; the few that are named differently carry the whole thing
  const parts = path.split('/');
  const full = parts.length >= 4 ? path : `${path}/{w}px-${parts[parts.length - 1]}`;
  return base + full.replace('{w}', String(width));
}

/**
 * Ask for a photograph. Returns straight away with whatever is known about it; call it again on
 * the next frame and it will have moved on.
 */
export function photo(url: string): Entry {
  const got = cache.get(url);
  if (got) return got;
  const e: Entry = { state: 'loading', img: null, at: 0, tries: 0 };
  cache.set(url, e);

  const start = (): void => {
    flight++;
    e.tries++;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      flight--;
      e.state = 'ready';
      e.img = img;
      e.at = performance.now() / 1000;
      pump();
      if (onArrive) onArrive();
    };
    img.onerror = () => {
      flight--;
      // a picture that failed once is usually a busy network rather than a missing file, so it
      // gets another go after a moment; only after three does the drawn animal take over
      if (e.tries < MAX_TRIES) {
        setTimeout(() => { if (flight < MAX_FLIGHT) start(); else queue.push(start); }, 700 * e.tries);
      } else {
        e.state = 'failed';
        if (onArrive) onArrive();
      }
      pump();
    };
    img.src = url;
  };

  if (flight < MAX_FLIGHT) start(); else queue.push(start);
  return e;
}

/** Is this one already here? Used to decide whether a card can be drawn without waiting. */
export const photoState = (url: string): PhotoState => cache.get(url)?.state ?? 'idle';

/**
 * Draw a photograph so it fills the rectangle, cropped from the middle and kept in proportion -
 * the same thing `object-fit: cover` does, which is what a grid of cards wants.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number, w: number, h: number, t: number,
): boolean {
  if (e.state !== 'ready' || !e.img) return false;
  const iw = e.img.naturalWidth, ih = e.img.naturalHeight;
  if (!iw || !ih) return false;
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k, dh = ih * k;
  const fade = Math.min(1, (t - e.at) / 0.22);
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(e.img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return fade >= 1;
}

/** How many photographs the book is holding. Only used by the debug state. */
export const photoCount = (): number => cache.size;
