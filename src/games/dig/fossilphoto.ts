/**
 * Real fossil photographs, laid into the rock.
 *
 * Under the dirt lies an actual photograph or an actual museum plate of the animal's skeleton, not
 * a drawing of one. Each image is cropped to the animal, tinted to stone so it sits in the slab,
 * and flipped where the specimen faces the wrong way.
 *
 * Every source is public domain or CC BY; the credits are shown in the game.
 */

export interface FossilSource {
  /** file under public/img/fossils */
  id: string;
  /** crop inside the source image, as fractions of width and height */
  crop: [number, number, number, number];
  /** the specimen faces right and needs mirroring */
  flip?: boolean;
  credit: string;
}

export const FOSSILS: Record<string, FossilSource> = {
  trex: { id: 'trex', crop: [0.47, 0.02, 0.945, 1.0], credit: 'American Museum of Natural History, public domain' },
  stego: { id: 'stego', crop: [0.0, 0.0, 0.93, 0.97], credit: 'Peabody Museum, 1910, public domain' },
  tricera: { id: 'tricera', crop: [0.02, 0.0, 0.90, 0.90], credit: 'Smithsonian National Museum of Natural History, CC BY 4.0' },
  velo: { id: 'velo', crop: [0.0, 0.0, 1.0, 1.0], flip: true, credit: 'Museo Civico di Zoologia, Rome, CC0' },
  para: { id: 'para', crop: [0.0, 0.0, 1.0, 1.0], credit: 'Parks, 1922, public domain' },
  diplo: { id: 'diplo', crop: [0.0, 0.0, 1.0, 1.0], credit: 'Hatcher, 1901, public domain' },
};

const cache = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<HTMLCanvasElement | null>>();

/** Load one fossil, crop it, and tint it to the colour of stone. */
export function loadFossil(key: string): Promise<HTMLCanvasElement | null> {
  const done = cache.get(key);
  if (done) return Promise.resolve(done);
  const running = pending.get(key);
  if (running) return running;
  const src = FOSSILS[key];
  if (!src) return Promise.resolve(null);

  const p = new Promise<HTMLCanvasElement | null>(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const [cx0, cy0, cx1, cy1] = src.crop;
        const sx = cx0 * img.naturalWidth, sy = cy0 * img.naturalHeight;
        const sw = (cx1 - cx0) * img.naturalWidth, sh = (cy1 - cy0) * img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = Math.round(sw); c.height = Math.round(sh);
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        if (src.flip) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);

        // to stone: drop the colour, lift the contrast a little, and warm it towards bone
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          const v = Math.max(0, Math.min(255, (l - 128) * 1.18 + 128));
          px[i] = Math.min(255, v * 1.06 + 12);
          px[i + 1] = Math.min(255, v * 0.98 + 8);
          px[i + 2] = Math.min(255, v * 0.84 + 4);
        }
        ctx.putImageData(data, 0, 0);
        cache.set(key, c);
        resolve(c);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = `./img/fossils/${src.id}.png`;
  });
  pending.set(key, p);
  return p;
}

export const fossilPhoto = (key: string): HTMLCanvasElement | undefined => cache.get(key);

export function loadAllFossils(keys: string[]): Promise<void> {
  return Promise.all(keys.map(loadFossil)).then(() => undefined);
}

/** Draw the fossil to fill the slab, keeping its aspect and centring what does not fit. */
export function drawFossil(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, slab: { x: number; y: number; w: number; h: number }): void {
  const k = Math.min(slab.w / c.width, slab.h / c.height) * 0.98;
  const w = c.width * k, h = c.height * k;
  ctx.drawImage(c, slab.x + (slab.w - w) / 2, slab.y + (slab.h - h) / 2, w, h);
}
