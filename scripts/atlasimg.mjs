/**
 * The satellite pictures under the Wereldatlas, fetched once and shipped with the app.
 *
 * The owner asked for a real Netherlands and real water instead of a drawn puzzle. NASA's Blue
 * Marble (Next Generation, a cloud-free composite at 500 m a pixel) is public domain and NASA's
 * GIBS service cuts it to any box of longitude and latitude. The atlas already draws in exactly
 * those coordinates (src/games/atlas/geo.ts), so each picture below is cut to one of its views and
 * lines up with the outlines drawn over it without any fitting by eye.
 *
 * The phone never calls NASA: this runs on the build machine and the files are in public/img/atlas.
 *
 *   node scripts/atlasimg.mjs
 */

import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'suri-atlas-'));
await build({ entryPoints: ['src/games/atlas/geo.ts'], bundle: true, format: 'esm', outfile: join(dir, 'geo.mjs'), logLevel: 'warning' });
const geo = await import(join(dir, 'geo.mjs'));
rmSync(dir, { recursive: true, force: true });

// how wide each picture is; the height follows from the view, so a pixel is square on the map
const VIEWS = { nl: [geo.NL_VIEW, 2000], near: [geo.NEAR_VIEW, 2000], eu: [geo.EU_VIEW, 2400], world: [geo.WORLD_VIEW, 3000] };
/**
 * A view is centred in whatever box the screen has, so there is a strip either side of it or
 * above and below it. Each picture reaches half a view further in every direction, so that strip
 * is real sea and real land too, not a painted colour next to a photograph.
 */
const PAD = 0.5;

mkdirSync('public/img/atlas', { recursive: true });
const bounds = {};
for (const [name, [v, width]] of Object.entries(VIEWS)) {
  const dLon = (v.lon1 - v.lon0) * PAD, dLat = (v.lat1 - v.lat0) * PAD;
  const b = {
    lon0: Math.max(-180, v.lon0 - dLon), lon1: Math.min(180, v.lon1 + dLon),
    lat0: Math.max(-90, v.lat0 - dLat), lat1: Math.min(90, v.lat1 + dLat),
  };
  const height = Math.round(width * (b.lat1 - b.lat0) / ((b.lon1 - b.lon0) * v.kx));
  const url = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0'
    + '&LAYERS=BlueMarble_NextGeneration&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326'
    + `&BBOX=${b.lat0},${b.lon0},${b.lat1},${b.lon1}&WIDTH=${width}&HEIGHT=${height}`;
  bounds[name] = b;
  const r = await fetch(url);
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('image')) throw new Error(`${name}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(`public/img/atlas/${name}.jpg`, buf);
  console.log(`${name}: ${width}x${height}, ${Math.round(buf.length / 1024)} kB`);
}
// where each picture's edges are on the globe, which is all the game needs to lay it under a view
writeFileSync('src/games/atlas/satellite.json', JSON.stringify(bounds, null, 1) + '\n');
