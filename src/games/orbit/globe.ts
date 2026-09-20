/**
 * A planet you can actually turn.
 *
 * The photographs elsewhere in Orbit show one face of a world. To let a child spin the Earth and
 * find the Pacific, you need the surface laid out flat as a map, and then you have to wrap it back
 * onto a ball yourself.
 *
 * That is what this does. For every pixel inside the disc it works backwards: from where the pixel
 * sits on screen, to where that is on the sphere, to which point of the map is showing there, and
 * finally how much sunlight falls on it. It is plain arithmetic per pixel, which is why the globe
 * is drawn into a small buffer and then scaled up: at a couple of hundred pixels across it stays
 * smooth on a phone, and nobody can tell.
 *
 * Maps are the Solar System Scope textures, built from NASA imagery, CC BY 4.0.
 */

export interface GlobeMap { data: ImageData; w: number; h: number }

const maps = new Map<string, GlobeMap>();
const pending = new Map<string, Promise<GlobeMap | null>>();

export const MAP_CREDIT = 'Maps: Solar System Scope, from NASA imagery, CC BY 4.0';

/** Which bodies have a surface map, and therefore a globe you can turn. */
export const HAS_MAP = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon']);

export function loadMap(id: string): Promise<GlobeMap | null> {
  const done = maps.get(id);
  if (done) return Promise.resolve(done);
  const running = pending.get(id);
  if (running) return running;
  const p = new Promise<GlobeMap | null>(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const m: GlobeMap = { data: ctx.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height };
        maps.set(id, m);
        resolve(m);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = `./img/maps/${id}.jpg`;
  });
  pending.set(id, p);
  return p;
}

export const globeMap = (id: string): GlobeMap | undefined => maps.get(id);

/** Where the globe is turned to, and how close you are. */
export interface View { lon: number; lat: number; zoom: number }

export const clampView = (v: View): View => ({
  lon: ((v.lon % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
  // stop short of the poles: past them the map smears and there is nothing to see
  lat: Math.max(-1.15, Math.min(1.15, v.lat)),
  zoom: Math.max(1, Math.min(4, v.zoom)),
});

const buffers = new Map<number, { canvas: HTMLCanvasElement; img: ImageData }>();
function buffer(size: number): { canvas: HTMLCanvasElement; img: ImageData } {
  const key = size;
  const got = buffers.get(key);
  if (got) return got;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const img = canvas.getContext('2d')!.createImageData(size, size);
  const made = { canvas, img };
  buffers.set(key, made);
  return made;
}

/**
 * Draw the globe of `id` centred on (cx, cy) with radius r.
 *
 * `lightFrom` turns the terminator: at 0 the sun is straight ahead, which is how a full-disc
 * portrait looks; larger values swing it to the left and give the ball its roundness.
 */
export function drawGlobe(
  ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, r: number,
  view: View, lightFrom = 0.9,
): boolean {
  const map = maps.get(id);
  if (!map || r < 4) return false;

  // one buffer pixel per screen pixel is wasted effort; half that still looks smooth once scaled
  const size = Math.max(48, Math.min(320, Math.round(r * 1.5)));
  const { canvas, img } = buffer(size);
  const out = img.data;
  const src = map.data.data;
  const mw = map.w, mh = map.h;

  const sinLat0 = Math.sin(view.lat), cosLat0 = Math.cos(view.lat);
  const lx = Math.sin(lightFrom), lz = Math.cos(lightFrom);
  const inv = 1 / (size / 2);

  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) * inv - 1;
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      const x = (px + 0.5) * inv - 1;
      const d2 = x * x + y * y;
      if (d2 > 1) { out[i + 3] = 0; continue; }
      const z = Math.sqrt(1 - d2);

      // the point on the unit sphere, then tilted back by the viewing latitude
      const ry = y * cosLat0 - z * sinLat0;
      const rz = y * sinLat0 + z * cosLat0;
      const lat = Math.asin(Math.max(-1, Math.min(1, ry)));
      const lon = Math.atan2(x, rz) + view.lon;

      let u = (lon / (Math.PI * 2)) % 1;
      if (u < 0) u += 1;
      const v = 0.5 + lat / Math.PI;
      const sxp = Math.min(mw - 1, Math.max(0, Math.floor(u * mw)));
      const syp = Math.min(mh - 1, Math.max(0, Math.floor(v * mh)));
      const si = (syp * mw + sxp) * 4;

      // sunlight, plus a rim of atmosphere so the edge does not look cut out
      const lambert = Math.max(0, x * lx + z * lz);
      const shade = 0.16 + 0.94 * Math.pow(lambert, 0.72);
      const rim = Math.pow(d2, 7) * 0.5;

      out[i] = Math.min(255, src[si] * shade + rim * 120);
      out[i + 1] = Math.min(255, src[si + 1] * shade + rim * 150);
      out[i + 2] = Math.min(255, src[si + 2] * shade + rim * 200);
      out[i + 3] = 255;
    }
  }

  const bctx = canvas.getContext('2d')!;
  bctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  return true;
}

/** Turn the globe by a finger drag of (dx, dy) screen pixels over a disc of radius r. */
export function dragView(view: View, dx: number, dy: number, r: number): View {
  const k = 1.1 / Math.max(20, r * view.zoom);
  return clampView({ lon: view.lon - dx * k, lat: view.lat + dy * k, zoom: view.zoom });
}
