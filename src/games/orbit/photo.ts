/**
 * Real photographs of the planets.
 *
 * Every image is a NASA or ESA/Hubble frame in the public domain, showing the planet against the
 * black of space. Before anything is drawn, each one is run through a small preparation step that
 * turns that black into transparency and measures where the planet's disc sits inside the frame, so
 * the game can place Saturn by its globe rather than by its rings.
 *
 * Credits live in `CREDITS` and are shown in the game, because a public domain image is still
 * somebody's work.
 */

export interface PlanetPhoto {
  /** the prepared image, black knocked out */
  canvas: HTMLCanvasElement;
  /** centre of the planet's globe, in canvas pixels */
  cx: number;
  cy: number;
  /** diameter of the globe, in canvas pixels */
  disc: number;
}

export const CREDITS: Record<string, string> = {
  mercury: 'NASA / Johns Hopkins APL / Carnegie Institution',
  venus: 'NASA / JPL, Mariner 10',
  earth: 'NASA, Apollo 17',
  mars: 'NASA / JPL / USGS, Viking',
  jupiter: 'NASA / ESA / Hubble',
  saturn: 'NASA / JPL / Space Science Institute, Cassini',
  uranus: 'NASA / JPL, Voyager 2',
  neptune: 'NASA / JPL, Voyager 2',
};

const cache = new Map<string, PlanetPhoto>();
const pending = new Map<string, Promise<PlanetPhoto | null>>();

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Load one planet, knock out the black sky, and measure the globe. */
export function loadPlanet(id: string): Promise<PlanetPhoto | null> {
  const done = cache.get(id);
  if (done) return Promise.resolve(done);
  const running = pending.get(id);
  if (running) return running;

  const p = new Promise<PlanetPhoto | null>(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;

        let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            // perceived brightness; space is not perfectly black in a real exposure
            const luma = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
            const a = smooth(9, 38, luma);
            px[i + 3] = Math.round(px[i + 3] * a);
            if (a > 0.5) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        ctx.putImageData(data, 0, 0);

        if (x1 < 0) { resolve(null); return; }
        // the globe's height is a good stand-in for its diameter: rings are wide but shallow,
        // so they stretch the frame sideways far more than they do vertically
        const photo: PlanetPhoto = {
          canvas: c,
          cx: (x0 + x1) / 2,
          cy: (y0 + y1) / 2,
          disc: Math.max(8, (y1 - y0) * 0.97),
        };
        cache.set(id, photo);
        resolve(photo);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    // same origin, so the canvas stays readable
    img.src = `./img/planets/${id}.jpg`;
  });
  pending.set(id, p);
  return p;
}

export const planetPhoto = (id: string): PlanetPhoto | undefined => cache.get(id);

/** Kick off every download at once; resolves when they have all settled. */
export function loadAllPlanets(ids: string[]): Promise<void> {
  return Promise.all(ids.map(loadPlanet)).then(() => undefined);
}

/**
 * Draw a photographed planet so that its globe is exactly 2r across, centred on (x, y).
 * Saturn's rings then fall outside that circle, which is what you want.
 */
export function drawPhoto(ctx: CanvasRenderingContext2D, photo: PlanetPhoto, x: number, y: number, r: number): void {
  const k = (r * 2) / photo.disc;
  const w = photo.canvas.width * k, h = photo.canvas.height * k;
  ctx.drawImage(photo.canvas, x - photo.cx * k, y - photo.cy * k, w, h);
}

/** How far the whole frame reaches from the globe's centre, as a multiple of the globe radius. */
export function photoReach(photo: PlanetPhoto): number {
  const k = 2 / photo.disc;
  return Math.max(photo.cx, photo.canvas.width - photo.cx) * k;
}
