/**
 * Wereldatlas: the shapes, the names and the facts. No canvas, no network, no saved game.
 *
 * Everything here is longitude and latitude, because that is the one coordinate system that lets
 * the same outline be drawn on a map of the Netherlands, a map of Europe and a map of the world
 * without being redrawn. A view says which corner of the globe is on screen; `project` turns a
 * point into pixels inside a box; `pointInRings` answers the only question the game ever asks of
 * a shape, which is whether the child let go of a piece inside it.
 *
 * The outlines are simplified on purpose, the way the outlines in `animals/worldmap.ts` are. A
 * child does not need a coastline accurate to the metre; they need a shape they can recognise and
 * put in the right place. What is *not* simplified is the naming and the facts: a capital here is
 * the real capital, a river really does come from where it says, and the height of the Vaalserberg
 * is the height of the Vaalserberg.
 */

import { CONTINENT_RINGS } from '../animals/worldmap';

// ---------------------------------------------------------------- the frame

/** A point on the globe: longitude east, latitude north. */
export type Pt = readonly [number, number];
export type Ring = readonly Pt[];

/** A box of screen pixels to draw into. */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * A window onto the globe.
 *
 * `kx` squashes the longitude, because a degree of longitude is shorter than a degree of latitude
 * everywhere but the equator. At 52 degrees north it is only 0.62 as long, and a map of the
 * Netherlands drawn without that correction is a third too wide and does not look like the
 * Netherlands at all. The world map keeps kx at 1, which is the flat classroom-wall projection
 * the animal book already uses and a child has already seen.
 */
export interface View { lon0: number; lat0: number; lon1: number; lat1: number; kx: number }

export const NL_VIEW: View = { lon0: 3.15, lat0: 50.65, lon1: 7.45, lat1: 53.65, kx: 0.62 };
export const NEAR_VIEW: View = { lon0: 1.0, lat0: 48.2, lon1: 13.5, lat1: 55.2, kx: 0.64 };
export const EU_VIEW: View = { lon0: -25, lat0: 34, lon1: 45, lat1: 71.5, kx: 0.62 };
export const WORLD_VIEW: View = { lon0: -180, lat0: -85, lon1: 180, lat1: 85, kx: 1 };

/** How one degree of longitude and one of latitude come out in pixels, for this view in this box. */
export function fit(view: View, box: Box): { s: number; x: number; y: number } {
  const dw = (view.lon1 - view.lon0) * view.kx;
  const dh = view.lat1 - view.lat0;
  const s = Math.min(box.w / dw, box.h / dh);
  return { s, x: box.x + (box.w - dw * s) / 2, y: box.y + (box.h - dh * s) / 2 };
}

/** A point on the globe, in pixels. */
export function project(p: Pt, view: View, box: Box): { x: number; y: number } {
  const f = fit(view, box);
  return {
    x: f.x + (p[0] - view.lon0) * view.kx * f.s,
    y: f.y + (view.lat1 - p[1]) * f.s,
  };
}

/** And back again, so a finger on the screen becomes a place on the globe. */
export function unproject(x: number, y: number, view: View, box: Box): Pt {
  const f = fit(view, box);
  return [view.lon0 + (x - f.x) / (view.kx * f.s), view.lat1 - (y - f.y) / f.s];
}

// ---------------------------------------------------------------- shapes

/** Is this point inside this ring? The even-odd ray cast, which is all a drop test needs. */
export function pointInRing(p: Pt, ring: Ring): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside any of a shape's rings. Zeeland is islands and a strip of Flanders, not one lump. */
export function pointInRings(p: Pt, rings: readonly Ring[]): boolean {
  return rings.some(r => pointInRing(p, r));
}

/** The middle of a ring, weighted by area, which is where a label wants to sit. */
export function centroid(rings: readonly Ring[]): Pt {
  let bx = 0, by = 0, ba = 0;
  for (const ring of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f;
      cx += (ring[j][0] + ring[i][0]) * f;
      cy += (ring[j][1] + ring[i][1]) * f;
    }
    const area = Math.abs(a / 2);
    if (area <= 0) continue;
    if (area > ba) { ba = area; bx = cx / (3 * a); by = cy / (3 * a); }
  }
  if (ba === 0 && rings[0]?.length) {
    const r = rings[0];
    return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
  }
  return [bx, by];
}

/** The corners of a shape, for zooming a map onto it. */
export function bounds(rings: readonly Ring[]): { lon0: number; lat0: number; lon1: number; lat1: number } {
  let lon0 = 180, lat0 = 90, lon1 = -180, lat1 = -90;
  for (const r of rings) for (const [lo, la] of r) {
    if (lo < lon0) lon0 = lo;
    if (lo > lon1) lon1 = lo;
    if (la < lat0) lat0 = la;
    if (la > lat1) lat1 = la;
  }
  return { lon0, lat0, lon1, lat1 };
}

/** How far a point is from a line, in degrees. A river is a line, so a drop near it counts. */
export function distanceToPath(p: Pt, path: Ring): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len));
    const d = Math.hypot(p[0] - (ax + dx * t), p[1] - (ay + dy * t));
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------- what a place is

export type FeatureKind = 'province' | 'water' | 'city' | 'country' | 'continent' | 'ocean';

/**
 * A flag, written down rather than photographed.
 *
 * Only the flags this description can tell the truth about are in the game: bands of colour, a
 * cross, a disc. A flag with a coat of arms or a canton full of stars is not in here, because a
 * drawn approximation of one is a wrong flag rather than a simple one.
 */
export type Flag =
  | { kind: 'bands'; dir: 'h' | 'v'; colours: string[]; weights?: number[] }
  // `square` is the Swiss one: a square flag with a cross that stops short of the edges, which is
  // a different flag from the Nordic cross and has to be drawn as one
  | { kind: 'cross'; field: string; cross: string; inner?: string; square?: boolean }
  | { kind: 'disc'; field: string; disc: string; r?: number };

export interface Feature {
  id: string;
  /** Dutch name */
  nl: string;
  /** English name */
  en: string;
  kind: FeatureKind;
  /** an area: one ring, or several where a place really is several */
  rings?: Ring[];
  /** a line: a river, a dyke, a barrier */
  path?: Ring;
  /** a single spot: a city */
  at?: Pt;
  /** the thing worth knowing, which is what a wrong drop is for */
  factNl: string;
  factEn: string;
  /** the continent it sits on, and the key the animal book files its animals under */
  cont?: string;
  capNl?: string;
  capEn?: string;
  flag?: Flag;
  /** how the piece is coloured */
  tone: string;
}

const P = (...pts: Array<[number, number]>): Ring => pts;

// ---------------------------------------------------------------- 1. de provincies

/**
 * The twelve, as outlines a child can recognise.
 *
 * The borders are traced from the real ones at about ten kilometres of detail: Zeeland is islands
 * and a strip south of the Westerschelde, Limburg is the long thin one that reaches further south
 * than anything else, Flevoland is the one with straight edges because it was drawn before it was
 * drained.
 */
export const PROVINCES: Feature[] = [
  {
    id: 'groningen', nl: 'Groningen', en: 'Groningen', kind: 'province', tone: '#e0803f',
    capNl: 'Groningen', capEn: 'Groningen', cont: 'eu',
    rings: [P([6.18, 53.41], [6.60, 53.42], [6.95, 53.33], [7.22, 53.22], [7.20, 53.05],
      [7.05, 52.96], [6.75, 52.99], [6.50, 53.00], [6.25, 53.03], [6.10, 53.12], [6.02, 53.25])],
    factNl: 'Onder Groningen ligt het grootste aardgasveld van Europa. Door het gas beeft de grond, en daarom is de kraan dichtgedraaid.',
    factEn: 'The biggest natural gas field in Europe lies under Groningen. Taking it out shook the ground, so the tap has been turned off.',
  },
  {
    id: 'friesland', nl: 'Friesland', en: 'Friesland', kind: 'province', tone: '#3f8fbf',
    capNl: 'Leeuwarden', capEn: 'Leeuwarden', cont: 'eu',
    rings: [P([5.42, 53.07], [5.35, 53.20], [5.58, 53.33], [5.88, 53.40], [6.18, 53.41],
      [6.02, 53.25], [6.10, 53.12], [6.25, 53.03], [6.20, 52.92], [6.00, 52.85], [5.80, 52.83],
      [5.65, 52.88], [5.48, 52.95])],
    factNl: 'Friesland heeft een eigen taal. Fries is de tweede rijkstaal van Nederland, en op school leren kinderen er allebei.',
    factEn: 'Friesland has a language of its own. Frisian is the second official language of the Netherlands, and children there learn both.',
  },
  {
    id: 'drenthe', nl: 'Drenthe', en: 'Drenthe', kind: 'province', tone: '#7a9c46',
    capNl: 'Assen', capEn: 'Assen', cont: 'eu',
    rings: [P([6.20, 52.92], [6.50, 53.00], [6.75, 52.99], [7.05, 52.96], [7.05, 52.83],
      [6.95, 52.70], [6.80, 52.62], [6.55, 52.58], [6.35, 52.62], [6.20, 52.70], [6.13, 52.80])],
    factNl: 'In Drenthe staan de hunebedden: 52 van de 54 in Nederland. Ze zijn ruim vijfduizend jaar oud, ouder dan de piramides.',
    factEn: 'Drenthe holds the dolmens: 52 of the 54 in the country. They are over five thousand years old, older than the pyramids.',
  },
  {
    id: 'overijssel', nl: 'Overijssel', en: 'Overijssel', kind: 'province', tone: '#c96a8c',
    capNl: 'Zwolle', capEn: 'Zwolle', cont: 'eu',
    rings: [P([6.05, 52.80], [6.20, 52.70], [6.35, 52.62], [6.55, 52.58], [6.80, 52.62],
      [6.95, 52.70], [7.07, 52.60], [7.05, 52.45], [6.90, 52.36], [6.78, 52.28], [6.72, 52.20],
      [6.50, 52.22], [6.30, 52.30], [6.10, 52.30], [5.95, 52.40], [5.90, 52.52], [5.75, 52.60],
      [5.72, 52.70], [5.86, 52.78])],
    factNl: 'In Giethoorn, in Overijssel, zijn de straten grachten. Je komt er met een bootje voor de deur, niet met de auto.',
    factEn: 'In Giethoorn, in Overijssel, the streets are canals. You arrive at the front door by boat, not by car.',
  },
  {
    id: 'flevoland', nl: 'Flevoland', en: 'Flevoland', kind: 'province', tone: '#d8a83c',
    capNl: 'Lelystad', capEn: 'Lelystad', cont: 'eu',
    rings: [P([5.32, 52.55], [5.42, 52.68], [5.58, 52.78], [5.72, 52.83], [5.86, 52.78],
      [5.90, 52.62], [5.90, 52.52], [5.85, 52.42], [5.70, 52.32], [5.50, 52.30], [5.36, 52.38],
      [5.26, 52.46])],
    factNl: 'Flevoland is de jongste provincie, uit 1986, en de bodem is drooggelegde zeebodem. Waar nu akkers liggen voer vroeger een schip.',
    factEn: 'Flevoland is the youngest province, from 1986, and its ground is drained sea floor. Where the fields are now, ships once sailed.',
  },
  {
    id: 'gelderland', nl: 'Gelderland', en: 'Gelderland', kind: 'province', tone: '#5e9e6a',
    capNl: 'Arnhem', capEn: 'Arnhem', cont: 'eu',
    rings: [P([5.20, 52.28], [5.45, 52.32], [5.70, 52.32], [5.90, 52.40], [6.10, 52.30],
      [6.30, 52.30], [6.50, 52.22], [6.72, 52.20], [6.83, 52.12], [6.75, 51.98], [6.40, 51.86],
      [6.20, 51.87], [6.08, 51.86], [5.98, 51.76], [5.82, 51.72], [5.50, 51.83], [5.27, 51.94],
      [5.18, 52.10])],
    factNl: 'Gelderland is de grootste provincie. De Veluwe is het grootste bos van Nederland, en er lopen wilde zwijnen en edelherten.',
    factEn: 'Gelderland is the largest province. The Veluwe is the biggest woodland in the country, with wild boar and red deer in it.',
  },
  {
    id: 'utrecht', nl: 'Utrecht', en: 'Utrecht', kind: 'province', tone: '#b0553f',
    capNl: 'Utrecht', capEn: 'Utrecht', cont: 'eu',
    rings: [P([4.83, 52.12], [5.05, 52.22], [5.20, 52.28], [5.18, 52.10], [5.27, 51.94],
      [5.05, 51.93], [4.94, 52.00], [4.80, 52.02])],
    factNl: 'Utrecht is de kleinste provincie van Nederland. De Domtoren is met 112 meter de hoogste kerktoren van het land.',
    factEn: 'Utrecht is the smallest province in the Netherlands. The Dom Tower, at 112 metres, is the tallest church tower in the country.',
  },
  {
    id: 'noordholland', nl: 'Noord-Holland', en: 'North Holland', kind: 'province', tone: '#e6a13c',
    capNl: 'Haarlem', capEn: 'Haarlem', cont: 'eu',
    rings: [P([4.72, 52.96], [5.02, 52.93], [5.12, 52.85], [5.05, 52.70], [5.32, 52.55],
      [5.26, 52.46], [5.36, 52.38], [5.20, 52.28], [5.05, 52.22], [4.83, 52.12], [4.60, 52.22],
      [4.55, 52.36], [4.58, 52.46], [4.63, 52.65], [4.68, 52.82])],
    factNl: 'Amsterdam ligt in Noord-Holland, maar de hoofdstad van de provincie is Haarlem. Schiphol ligt ruim vier meter onder zeeniveau.',
    factEn: 'Amsterdam is in North Holland, but the provincial capital is Haarlem. Schiphol airport sits over four metres below sea level.',
  },
  {
    id: 'zuidholland', nl: 'Zuid-Holland', en: 'South Holland', kind: 'province', tone: '#cf7b4f',
    capNl: 'Den Haag', capEn: 'The Hague', cont: 'eu',
    rings: [P([4.60, 52.22], [4.83, 52.12], [4.80, 52.02], [4.94, 52.00], [5.05, 51.93],
      [5.02, 51.82], [4.80, 51.78], [4.55, 51.72], [4.30, 51.73], [4.05, 51.80], [3.98, 51.88],
      [4.12, 51.98], [4.30, 52.10], [4.45, 52.20])],
    factNl: 'In Zuid-Holland wonen de meeste mensen van Nederland. De regering en de koning zitten in Den Haag, niet in de hoofdstad.',
    factEn: 'More people live in South Holland than in any other province. The government and the king sit in The Hague, not in the capital.',
  },
  {
    id: 'zeeland', nl: 'Zeeland', en: 'Zeeland', kind: 'province', tone: '#4f9fa8',
    capNl: 'Middelburg', capEn: 'Middelburg', cont: 'eu',
    rings: [
      P([3.42, 51.53], [3.62, 51.62], [3.82, 51.72], [4.05, 51.80], [4.30, 51.73], [4.25, 51.62],
        [4.30, 51.50], [4.14, 51.46], [3.95, 51.44], [3.72, 51.44], [3.55, 51.48]),
      P([3.38, 51.38], [3.62, 51.36], [3.80, 51.34], [4.02, 51.36], [4.24, 51.40], [4.25, 51.30],
        [3.95, 51.23], [3.70, 51.26], [3.45, 51.28]),
    ],
    factNl: 'Zeeland is eilanden. In 1953 brak de zee erdoorheen en verdronken 1836 mensen; daarna zijn de Deltawerken gebouwd.',
    factEn: 'Zeeland is islands. In 1953 the sea broke through and 1,836 people drowned; the Delta Works were built afterwards.',
  },
  {
    id: 'noordbrabant', nl: 'Noord-Brabant', en: 'North Brabant', kind: 'province', tone: '#8f7ab8',
    capNl: "'s-Hertogenbosch", capEn: "'s-Hertogenbosch", cont: 'eu',
    rings: [P([4.30, 51.73], [4.55, 51.72], [4.80, 51.78], [5.02, 51.82], [5.27, 51.94],
      [5.50, 51.83], [5.82, 51.72], [5.75, 51.65], [5.80, 51.55], [5.62, 51.45], [5.52, 51.35],
      [5.35, 51.43], [5.10, 51.43], [4.90, 51.40], [4.75, 51.48], [4.55, 51.42], [4.40, 51.45],
      [4.32, 51.58])],
    factNl: 'Noord-Brabant is na Gelderland de grootste provincie. Het zuiden viert carnaval, en dan heet Den Bosch een week lang Oeteldonk.',
    factEn: 'North Brabant is the second largest province. The south keeps carnival, when Den Bosch is called Oeteldonk for a week.',
  },
  {
    id: 'limburg', nl: 'Limburg', en: 'Limburg', kind: 'province', tone: '#c0ac3a',
    capNl: 'Maastricht', capEn: 'Maastricht', cont: 'eu',
    rings: [P([6.20, 51.87], [6.17, 51.76], [6.10, 51.60], [6.22, 51.50], [6.13, 51.42],
      [6.08, 51.30], [5.95, 51.22], [5.88, 51.12], [5.95, 51.02], [6.02, 50.88], [6.02, 50.75],
      [5.65, 50.78], [5.72, 50.92], [5.78, 51.05], [5.72, 51.18], [5.55, 51.25], [5.52, 51.35],
      [5.62, 51.45], [5.80, 51.55], [5.75, 51.65], [5.82, 51.72], [5.98, 51.76], [6.08, 51.86])],
    factNl: 'Limburg is de enige provincie met heuvels. Het hoogste punt van Nederland is de Vaalserberg, 322 meter, waar drie landen elkaar raken.',
    factEn: 'Limburg is the only province with hills. The highest point in the country is the Vaalserberg, 322 metres, where three countries meet.',
  },
];

// ---------------------------------------------------------------- 2. het water

/** Big water, the rivers, and the two things that were built to keep the sea out. */
export const NL_WATERS: Feature[] = [
  {
    id: 'rijn', nl: 'De Rijn', en: 'The Rhine', kind: 'water', tone: '#2f7fc4',
    path: P([6.16, 51.85], [6.00, 51.90], [5.85, 51.95], [5.60, 51.96], [5.40, 51.97],
      [5.20, 51.95], [5.00, 51.94], [4.80, 51.92], [4.60, 51.91], [4.40, 51.90]),
    factNl: 'De Rijn komt uit Zwitserland, uit de Alpen, en is 1230 kilometer lang. Bij Lobith komt hij Nederland binnen.',
    factEn: 'The Rhine comes out of Switzerland, out of the Alps, and runs 1,230 km. It enters the Netherlands at Lobith.',
  },
  {
    id: 'waal', nl: 'De Waal', en: 'The Waal', kind: 'water', tone: '#3a92d6',
    path: P([6.14, 51.84], [5.95, 51.83], [5.80, 51.83], [5.60, 51.85], [5.40, 51.83],
      [5.20, 51.82], [5.00, 51.81], [4.85, 51.80], [4.70, 51.79]),
    factNl: 'De Waal is de grootste tak van de Rijn en de drukste rivier van Europa: er varen elke dag honderden schepen.',
    factEn: 'The Waal is the biggest branch of the Rhine and the busiest river in Europe: hundreds of ships a day.',
  },
  {
    id: 'maas', nl: 'De Maas', en: 'The Meuse', kind: 'water', tone: '#2a6fae',
    path: P([5.70, 50.78], [5.70, 50.95], [5.80, 51.10], [5.90, 51.20], [6.00, 51.35],
      [6.10, 51.50], [5.95, 51.62], [5.70, 51.70], [5.40, 51.75], [5.10, 51.76], [4.85, 51.74],
      [4.60, 51.73]),
    factNl: 'De Maas begint in Frankrijk en stroomt door België naar Nederland. Hij is een regenrivier: droge zomer, weinig water.',
    factEn: 'The Meuse rises in France and runs through Belgium into the Netherlands. It is a rain river: a dry summer means little water.',
  },
  {
    id: 'ijssel', nl: 'De IJssel', en: 'The IJssel', kind: 'water', tone: '#4aa3d8',
    path: P([5.99, 51.95], [6.10, 52.05], [6.18, 52.15], [6.18, 52.25], [6.15, 52.35],
      [6.10, 52.45], [6.02, 52.52], [5.92, 52.57], [5.88, 52.62]),
    factNl: 'De IJssel is de tak van de Rijn die naar het noorden gaat, naar het IJsselmeer. Vroeger voeren er Hanzeschepen.',
    factEn: 'The IJssel is the branch of the Rhine that turns north, to the IJsselmeer. Hanseatic ships once sailed it.',
  },
  {
    id: 'ijsselmeer', nl: 'Het IJsselmeer', en: 'The IJsselmeer', kind: 'water', tone: '#5fb5e0',
    // the lake stops just short of the Afsluitdijk, because the dyke is a piece of its own and
    // a child who lays it along the top edge should not be told they have found the lake
    rings: [P([5.06, 52.58], [5.06, 52.72], [5.09, 52.87], [5.34, 52.99], [5.46, 52.93],
      [5.62, 52.86], [5.70, 52.81], [5.56, 52.76], [5.40, 52.66], [5.30, 52.54], [5.18, 52.50])],
    factNl: 'Het IJsselmeer was de Zuiderzee, een arm van de zee. Sinds de Afsluitdijk in 1932 dichtging is het zoet water.',
    factEn: 'The IJsselmeer was the Zuiderzee, an arm of the sea. Since the Afsluitdijk closed it in 1932 it has been fresh water.',
  },
  {
    id: 'waddenzee', nl: 'De Waddenzee', en: 'The Wadden Sea', kind: 'water', tone: '#8ac8d8',
    rings: [P([4.80, 53.00], [5.10, 53.10], [5.42, 53.07], [5.58, 53.33], [5.88, 53.40],
      [6.18, 53.41], [6.60, 53.42], [6.95, 53.33], [7.05, 53.52], [6.40, 53.60], [5.60, 53.55],
      [4.95, 53.25])],
    factNl: 'De Waddenzee valt bij eb droog: dan kun je er overheen lopen. Het is werelderfgoed en de kraamkamer van de Noordzee.',
    factEn: 'The Wadden Sea falls dry at low tide, so you can walk across it. It is world heritage and the nursery of the North Sea.',
  },
  {
    id: 'noordzee', nl: 'De Noordzee', en: 'The North Sea', kind: 'water', tone: '#3f86bd',
    rings: [P([3.20, 51.40], [3.20, 53.60], [4.90, 53.25], [4.72, 52.96], [4.58, 52.46],
      [4.30, 52.10], [4.12, 51.98], [3.98, 51.88], [3.60, 51.60], [3.38, 51.36])],
    factNl: 'De Noordzee is ondiep: gemiddeld ongeveer 95 meter, en boven de Doggersbank maar twintig. In de ijstijd liep je er droog naar Engeland.',
    factEn: 'The North Sea is shallow: about 95 metres on average, and only twenty over Dogger Bank. In the ice age you could walk to England.',
  },
  {
    id: 'afsluitdijk', nl: 'De Afsluitdijk', en: 'The Afsluitdijk', kind: 'water', tone: '#8a7f5a',
    path: P([5.02, 52.93], [5.18, 52.99], [5.30, 53.03], [5.42, 53.07]),
    factNl: 'De Afsluitdijk is 32 kilometer lang en ging in 1932 dicht. Daarmee werd de Zuiderzee een meer en hield het stormvloed buiten.',
    factEn: 'The Afsluitdijk runs 32 kilometres and closed in 1932. It turned the Zuiderzee into a lake and shut the storm surge out.',
  },
  {
    id: 'deltawerken', nl: 'De Deltawerken', en: 'The Delta Works', kind: 'water', tone: '#9a8c60',
    path: P([3.68, 51.62], [3.78, 51.68], [3.86, 51.72], [4.00, 51.78], [4.12, 51.83]),
    factNl: 'De Deltawerken sloten na 1953 de zeegaten af. De Oosterscheldekering staat open en gaat alleen bij storm dicht, zodat de natuur blijft.',
    factEn: 'The Delta Works closed the sea inlets after 1953. The Oosterschelde barrier stands open and shuts only in a storm, so the tide still runs.',
  },
  {
    id: 'westerschelde', nl: 'De Westerschelde', en: 'The Western Scheldt', kind: 'water', tone: '#57a6c8',
    path: P([3.40, 51.44], [3.65, 51.42], [3.85, 51.41], [4.05, 51.40], [4.22, 51.38]),
    factNl: 'Over de Westerschelde varen de zeeschepen naar Antwerpen, dat in België ligt. Het water is Nederlands, de haven Belgisch.',
    factEn: 'Sea ships sail up the Western Scheldt to Antwerp, which is in Belgium. The water is Dutch, the port Belgian.',
  },
];

// ---------------------------------------------------------------- how low the land is

/**
 * The height of the land, as honestly as a handful of shapes can say it.
 *
 * A quarter of the Netherlands lies below sea level and about half of it would flood without the
 * dunes and the dykes. That is not a figure of speech, and the only way to show a child what it
 * means is to turn the dykes off and let the water in. Each band is a region with a height in
 * metres; the flood fills every band lower than the water standing outside.
 */
export interface HeightBand { m: number; rings: Ring[] }

export const HEIGHT: HeightBand[] = [
  // the deep polders: the Haarlemmermeer and the Flevo ground, six and five metres down
  {
    m: -6, rings: [
      P([4.58, 52.22], [4.78, 52.30], [4.78, 52.20], [4.62, 52.13]),
      P([5.30, 52.55], [5.42, 52.68], [5.58, 52.78], [5.72, 52.83], [5.84, 52.74], [5.86, 52.54],
        [5.70, 52.34], [5.48, 52.32], [5.32, 52.42]),
      P([4.62, 52.50], [4.90, 52.62], [5.02, 52.52], [4.80, 52.42]),
    ],
  },
  // the low west and north: peat and clay behind the dunes, a metre or two under the sea
  {
    m: -1.5, rings: [
      P([4.45, 52.20], [4.70, 52.90], [5.05, 52.92], [5.10, 52.60], [5.30, 52.30], [5.10, 52.02],
        [4.90, 51.86], [4.55, 51.74], [4.10, 51.82], [4.20, 52.06]),
      P([5.30, 53.05], [5.60, 53.30], [6.15, 53.38], [6.60, 53.36], [6.60, 53.10], [6.10, 53.00],
        [5.60, 52.92]),
      P([3.42, 51.53], [3.62, 51.62], [3.82, 51.72], [4.05, 51.80], [4.30, 51.73], [4.30, 51.44],
        [3.72, 51.44], [3.55, 51.48]),
    ],
  },
  // the dune ridge and the sea dykes, the wall the whole country stands behind
  {
    m: 12, rings: [
      P([4.10, 51.96], [4.28, 52.10], [4.52, 52.30], [4.58, 52.60], [4.66, 52.94], [4.80, 52.94],
        [4.74, 52.58], [4.66, 52.28], [4.40, 52.06], [4.20, 51.90]),
    ],
  },
  // the sandy east and south: Twente, the Achterhoek, the Brabant sand
  {
    m: 18, rings: [
      P([6.00, 52.90], [7.05, 52.95], [7.05, 52.40], [6.80, 52.10], [6.30, 51.90], [5.90, 51.68],
        [5.50, 51.40], [4.90, 51.42], [4.70, 51.62], [5.20, 51.86], [5.40, 52.20], [5.90, 52.60]),
    ],
  },
  // the Veluwe, an ice-age ridge the glaciers pushed up
  {
    m: 60, rings: [P([5.60, 52.40], [6.00, 52.38], [6.05, 52.05], [5.75, 51.98], [5.55, 52.10])],
  },
  // and the hills of south Limburg, which is the only part of the country that is not flat
  {
    m: 200, rings: [P([5.65, 50.78], [6.02, 50.76], [6.02, 50.92], [5.80, 51.02], [5.68, 50.92])],
  },
];

/** How high the land is at a point. Anything the bands do not cover is roughly at sea level. */
export function heightAt(p: Pt): number {
  let h = 0.5;
  for (const band of HEIGHT) if (pointInRings(p, band.rings)) h = band.m;
  return h;
}

/** Would this spot be under water if the sea stood at this level and nothing held it back? */
export function floodedAt(p: Pt, sea: number): boolean { return heightAt(p) < sea; }

// ---------------------------------------------------------------- 3. de steden

const city = (
  id: string, nl: string, en: string, at: Pt, factNl: string, factEn: string,
): Feature => ({ id, nl, en, kind: 'city', at, factNl, factEn, tone: '#d0553c', cont: 'eu' });

export const NL_CITIES: Feature[] = [
  city('amsterdam', 'Amsterdam', 'Amsterdam', [4.89, 52.37],
    'De hoofdstad. Amsterdam staat op palen in het veen, en er liggen ongeveer zeventienhonderd bruggen.',
    'The capital. Amsterdam stands on piles driven into the peat, and about seventeen hundred bridges cross it.'),
  city('denhaag', 'Den Haag', 'The Hague', [4.30, 52.08],
    'Hier zitten de regering, de Tweede Kamer en de koning. Den Haag is geen hoofdstad, maar wel de plek waar het land bestuurd wordt.',
    'The government, parliament and the king are here. The Hague is not the capital, but it is where the country is run.'),
  city('rotterdam', 'Rotterdam', 'Rotterdam', [4.48, 51.92],
    'De grootste haven van Europa. Het centrum is modern omdat het in 1940 gebombardeerd werd.',
    'The largest port in Europe. The centre is modern because it was bombed flat in 1940.'),
  city('utrechtstad', 'Utrecht', 'Utrecht', [5.12, 52.09],
    'Het spoorwegknooppunt van Nederland: bijna elke trein komt er langs. De Domtoren is 112 meter hoog.',
    'The railway junction of the country: nearly every train passes through. The Dom Tower is 112 metres tall.'),
  city('eindhoven', 'Eindhoven', 'Eindhoven', [5.47, 51.44],
    'De stad van Philips en de gloeilamp, en nu van chipmachines die nergens anders gemaakt worden.',
    'The city of Philips and the light bulb, and now of chip machines made nowhere else.'),
  city('groningenstad', 'Groningen', 'Groningen', [6.57, 53.22],
    'De grootste stad van het noorden, en een studentenstad: bijna één op de vier inwoners studeert er.',
    'The biggest city in the north, and a student city: nearly one in four people there is studying.'),
  city('tilburg', 'Tilburg', 'Tilburg', [5.08, 51.56],
    'Tilburg was de stad van de wol: hier werden dekens en stoffen geweven voor het hele land.',
    'Tilburg was the wool town: blankets and cloth for the whole country were woven here.'),
  city('almere', 'Almere', 'Almere', [5.22, 52.37],
    'Almere bestaat pas sinds 1976 en staat op de bodem van de Zuiderzee. Het groeit sneller dan welke stad ook.',
    'Almere has only existed since 1976 and stands on the floor of the Zuiderzee. It grows faster than any other city.'),
  city('breda', 'Breda', 'Breda', [4.78, 51.59],
    'Breda was een vestingstad met een kasteel. In 1590 kwamen er soldaten binnen verstopt in een turfschip.',
    'Breda was a fortress town with a castle. In 1590 soldiers got inside hidden in a peat barge.'),
  city('nijmegen', 'Nijmegen', 'Nijmegen', [5.86, 51.84],
    'De oudste stad van Nederland: de Romeinen hadden hier al een legerkamp, tweeduizend jaar geleden.',
    'The oldest city in the country: the Romans had an army camp here two thousand years ago.'),
  city('arnhem', 'Arnhem', 'Arnhem', [5.90, 51.98],
    'De hoofdstad van Gelderland, aan de Rijn. In 1944 vocht men hier om de brug, een brug te ver.',
    'The capital of Gelderland, on the Rhine. In 1944 they fought here for the bridge: a bridge too far.'),
  city('haarlem', 'Haarlem', 'Haarlem', [4.64, 52.38],
    'De hoofdstad van Noord-Holland, en de stad van de bloembollen: om Haarlem heen liggen de tulpenvelden.',
    'The capital of North Holland, and the town of the flower bulbs: the tulip fields lie all around it.'),
  city('enschede', 'Enschede', 'Enschede', [6.89, 52.22],
    'De grootste stad van Twente, tegen de Duitse grens aan. Hier stonden de katoenfabrieken.',
    'The biggest town in Twente, right against the German border. The cotton mills stood here.'),
  city('amersfoort', 'Amersfoort', 'Amersfoort', [5.39, 52.16],
    'Amersfoort heeft nog middeleeuwse stadspoorten: de Koppelpoort staat half over het water en gaat met een rad open.',
    'Amersfoort still has its medieval town gates: the Koppelpoort stands half over the water and opens with a wheel.'),
  city('zwolle', 'Zwolle', 'Zwolle', [6.09, 52.51],
    'De hoofdstad van Overijssel, met een gracht in de vorm van een ster om de oude stad heen.',
    'The capital of Overijssel, with a star-shaped moat around the old town.'),
  city('apeldoorn', 'Apeldoorn', 'Apeldoorn', [5.97, 52.21],
    'Apeldoorn ligt tegen de Veluwe aan. Paleis Het Loo was driehonderd jaar het huis van de koninklijke familie.',
    'Apeldoorn lies against the Veluwe. Het Loo Palace was the royal family’s house for three hundred years.'),
  city('maastricht', 'Maastricht', 'Maastricht', [5.69, 50.85],
    'De zuidelijkste stad, aan de Maas, met Romeinse wortels en gangen in de mergelberg eronder.',
    'The southernmost city, on the Meuse, with Roman roots and tunnels in the marl hill beneath it.'),
  city('leeuwarden', 'Leeuwarden', 'Leeuwarden', [5.80, 53.20],
    'De hoofdstad van Friesland. De Oldehove is een toren die scheef staat en nooit is afgebouwd.',
    'The capital of Friesland. The Oldehove is a tower that leans and was never finished.'),
  city('middelburg', 'Middelburg', 'Middelburg', [3.61, 51.50],
    'De hoofdstad van Zeeland, op Walcheren. De abdijtoren heet Lange Jan en kijkt over de eilanden uit.',
    'The capital of Zeeland, on Walcheren. The abbey tower is called Lange Jan and looks out over the islands.'),
  city('assen', 'Assen', 'Assen', [6.56, 52.99],
    'De hoofdstad van Drenthe, en de stad van de TT: elk jaar komen er honderdduizend mensen naar de motorraces.',
    'The capital of Drenthe, and the town of the TT: a hundred thousand people come for the motorcycle races each year.'),
  city('lelystad', 'Lelystad', 'Lelystad', [5.48, 52.51],
    'De hoofdstad van Flevoland, genoemd naar Cornelis Lely, die bedacht hoe de Zuiderzee drooggelegd moest worden.',
    'The capital of Flevoland, named after Cornelis Lely, who worked out how to drain the Zuiderzee.'),
  city('denhelder', 'Den Helder', 'Den Helder', [4.76, 52.96],
    'De marinehaven, op de punt van Noord-Holland. Van hier vaart de boot naar Texel.',
    'The navy port, on the tip of North Holland. The ferry to Texel goes from here.'),
];

// ---------------------------------------------------------------- 4. de buren

export const NEIGHBOURS: Feature[] = [
  {
    id: 'nederland_buur', nl: 'Nederland', en: 'The Netherlands', kind: 'country', tone: '#e6772f',
    capNl: 'Amsterdam', capEn: 'Amsterdam', cont: 'eu',
    rings: [P([3.40, 51.45], [4.10, 51.95], [4.60, 52.45], [4.75, 52.98], [5.42, 53.07],
      [6.20, 53.42], [7.20, 53.22], [7.05, 52.60], [6.80, 52.10], [6.20, 51.85], [6.02, 50.75],
      [5.65, 50.78], [5.52, 51.35], [4.55, 51.42], [3.38, 51.30])],
    factNl: 'Hier woon jij. Nederland is klein: je rijdt er in drie uur doorheen, en overal is de zee dichtbij.',
    factEn: 'This is where you live. The Netherlands is small: you can drive across it in three hours, and the sea is never far.',
  },
  {
    id: 'belgie_buur', nl: 'België', en: 'Belgium', kind: 'country', tone: '#d8b53a', cont: 'eu',
    capNl: 'Brussel', capEn: 'Brussels',
    rings: [P([2.55, 51.10], [3.35, 51.38], [4.25, 51.38], [5.05, 51.47], [5.80, 51.16],
      [5.65, 50.78], [6.02, 50.50], [5.85, 50.10], [5.45, 49.50], [4.85, 49.80], [4.20, 49.95],
      [4.20, 50.28], [3.70, 50.32], [3.15, 50.78], [2.60, 50.82])],
    factNl: 'In België spreken ze Nederlands in Vlaanderen, Frans in Wallonië en Duits in een hoekje in het oosten. Drie talen in één land.',
    factEn: 'Belgium speaks Dutch in Flanders, French in Wallonia and German in one corner in the east. Three languages in one country.',
  },
  {
    id: 'duitsland_buur', nl: 'Duitsland', en: 'Germany', kind: 'country', tone: '#c06a4a', cont: 'eu',
    capNl: 'Berlijn', capEn: 'Berlin',
    rings: [P([7.20, 53.20], [8.20, 53.70], [8.90, 54.40], [9.90, 54.80], [11.20, 54.20],
      [12.50, 54.45], [14.20, 53.90], [14.60, 52.60], [14.70, 51.00], [13.50, 50.60],
      [12.20, 50.30], [12.40, 49.30], [13.80, 48.60], [13.00, 47.70], [11.20, 47.40],
      [10.20, 47.30], [8.60, 47.70], [7.60, 47.60], [7.60, 49.00], [6.40, 49.45], [6.20, 50.20],
      [6.05, 50.75], [6.20, 51.85], [6.80, 52.10], [7.05, 52.60], [7.20, 53.20])],
    factNl: 'Duitsland is het buurland in het oosten en het grootste land van de Europese Unie. Er wonen ruim tachtig miljoen mensen.',
    factEn: 'Germany is the neighbour to the east and the largest country in the European Union, with over eighty million people.',
  },
  {
    id: 'noordzee_buur', nl: 'De Noordzee', en: 'The North Sea', kind: 'water', tone: '#3f86bd',
    rings: [P([1.50, 51.40], [1.50, 54.40], [4.20, 54.40], [5.60, 53.55], [4.95, 53.25],
      [4.72, 52.96], [4.58, 52.46], [4.12, 51.98], [3.38, 51.36], [2.55, 51.10])],
    factNl: 'De Noordzee ligt tussen Nederland en Engeland. Er varen meer schepen dan op welke zee ook, en er staan windparken in.',
    factEn: 'The North Sea lies between the Netherlands and England. More ships cross it than any other sea, and wind farms stand in it.',
  },
  {
    id: 'luxemburg_buur', nl: 'Luxemburg', en: 'Luxembourg', kind: 'country', tone: '#6fa8d8', cont: 'eu',
    capNl: 'Luxemburg', capEn: 'Luxembourg',
    rings: [P([5.75, 50.18], [6.15, 50.15], [6.50, 49.80], [6.35, 49.45], [5.85, 49.45],
      [5.73, 49.80])],
    factNl: 'Luxemburg is klein en heeft drie talen: Luxemburgs thuis, Frans in de winkel en Duits in de krant.',
    factEn: 'Luxembourg is tiny and has three languages: Luxembourgish at home, French in the shops and German in the papers.',
  },
];

// ---------------------------------------------------------------- 5 & 6. Europa

const FLAG: Record<string, Flag> = {
  nederland: { kind: 'bands', dir: 'h', colours: ['#ae1c28', '#ffffff', '#21468b'] },
  belgie: { kind: 'bands', dir: 'v', colours: ['#000000', '#fdda24', '#ef3340'] },
  duitsland: { kind: 'bands', dir: 'h', colours: ['#000000', '#dd0000', '#ffce00'] },
  frankrijk: { kind: 'bands', dir: 'v', colours: ['#0055a4', '#ffffff', '#ef4135'] },
  italie: { kind: 'bands', dir: 'v', colours: ['#008c45', '#f4f5f0', '#cd212a'] },
  ierland: { kind: 'bands', dir: 'v', colours: ['#169b62', '#ffffff', '#ff883e'] },
  polen: { kind: 'bands', dir: 'h', colours: ['#ffffff', '#dc143c'] },
  oostenrijk: { kind: 'bands', dir: 'h', colours: ['#ed2939', '#ffffff', '#ed2939'] },
  hongarije: { kind: 'bands', dir: 'h', colours: ['#cd2a3e', '#ffffff', '#436f4d'] },
  oekraine: { kind: 'bands', dir: 'h', colours: ['#0057b7', '#ffd700'] },
  roemenie: { kind: 'bands', dir: 'v', colours: ['#002b7f', '#fcd116', '#ce1126'] },
  spanje: { kind: 'bands', dir: 'h', colours: ['#aa151b', '#f1bf00', '#aa151b'], weights: [1, 2, 1] },
  zweden: { kind: 'cross', field: '#006aa7', cross: '#fecc00' },
  noorwegen: { kind: 'cross', field: '#ba0c2f', cross: '#ffffff', inner: '#00205b' },
  denemarken: { kind: 'cross', field: '#c8102e', cross: '#ffffff' },
  finland: { kind: 'cross', field: '#ffffff', cross: '#003580' },
  ijsland: { kind: 'cross', field: '#02529c', cross: '#ffffff', inner: '#dc1e35' },
  // square, and the cross is in the middle with its arms stopping short of the edge - it is not a
  // Nordic cross and drawing it as one would be drawing the wrong flag
  zwitserland: { kind: 'cross', field: '#d52b1e', cross: '#ffffff', square: true },
  japan: { kind: 'disc', field: '#ffffff', disc: '#bc002d', r: 0.3 },
};

const euro = (
  id: string, nl: string, en: string, capNl: string, capEn: string, rings: Ring[],
  factNl: string, factEn: string, tone: string,
): Feature => ({
  id, nl, en, kind: 'country', rings, capNl, capEn, factNl, factEn, tone, cont: 'eu',
  flag: FLAG[id],
});

/**
 * Europe by shape, and every capital is the real one.
 *
 * Coarse where a coastline is fiddly and exact where it matters: Italy is a boot, Norway and
 * Sweden are two halves of one peninsula, Greece has its islands left off and its shape kept.
 */
export const EU_COUNTRIES: Feature[] = [
  euro('nederland', 'Nederland', 'The Netherlands', 'Amsterdam', 'Amsterdam',
    [P([3.40, 51.45], [4.10, 51.95], [4.60, 52.45], [4.75, 52.98], [5.42, 53.07], [6.20, 53.42],
      [7.20, 53.22], [7.05, 52.60], [6.80, 52.10], [6.20, 51.85], [6.02, 50.75], [5.65, 50.78],
      [5.52, 51.35], [4.55, 51.42], [3.38, 51.30])],
    'Nederland is klein en plat en voor een kwart lager dan de zee. Er wonen bijna achttien miljoen mensen op een stukje zo groot als een provincie elders.',
    'The Netherlands is small and flat and a quarter of it is below the sea. Nearly eighteen million people live on a patch the size of a province elsewhere.',
    '#e6772f'),
  euro('belgie', 'België', 'Belgium', 'Brussel', 'Brussels',
    [P([2.55, 51.10], [3.35, 51.38], [4.25, 51.38], [5.05, 51.47], [5.80, 51.16], [5.65, 50.78],
      [6.02, 50.50], [5.85, 50.10], [5.45, 49.50], [4.85, 49.80], [4.20, 49.95], [4.20, 50.28],
      [3.70, 50.32], [3.15, 50.78], [2.60, 50.82])],
    'België heeft drie talen: Nederlands, Frans en Duits. Brussel is de hoofdstad van België én van de Europese Unie.',
    'Belgium has three languages: Dutch, French and German. Brussels is the capital of Belgium and of the European Union.',
    '#d8b53a'),
  euro('luxemburg', 'Luxemburg', 'Luxembourg', 'Luxemburg', 'Luxembourg',
    [P([5.75, 50.18], [6.15, 50.15], [6.50, 49.80], [6.35, 49.45], [5.85, 49.45], [5.73, 49.80])],
    'Luxemburg is een van de kleinste landen van Europa, en een van de rijkste. De hoofdstad heet net als het land.',
    'Luxembourg is one of the smallest countries in Europe, and one of the richest. The capital has the same name as the country.',
    '#6fa8d8'),
  euro('duitsland', 'Duitsland', 'Germany', 'Berlijn', 'Berlin',
    [P([7.20, 53.20], [8.20, 53.70], [8.90, 54.40], [9.90, 54.80], [11.20, 54.20], [12.50, 54.45],
      [14.20, 53.90], [14.60, 52.60], [14.70, 51.00], [13.50, 50.60], [12.20, 50.30],
      [12.40, 49.30], [13.80, 48.60], [13.00, 47.70], [11.20, 47.40], [10.20, 47.30],
      [8.60, 47.70], [7.60, 47.60], [7.60, 49.00], [6.40, 49.45], [6.20, 50.20], [6.05, 50.75],
      [6.20, 51.85], [6.80, 52.10], [7.05, 52.60])],
    'Duitsland heeft negen buurlanden, meer dan welk ander land van Europa. Berlijn was veertig jaar door een muur in tweeën gedeeld.',
    'Germany has nine neighbours, more than any other country in Europe. Berlin was split in two by a wall for forty years.',
    '#c06a4a'),
  euro('frankrijk', 'Frankrijk', 'France', 'Parijs', 'Paris',
    [P([2.55, 51.05], [3.15, 50.78], [3.70, 50.32], [4.20, 49.95], [5.45, 49.50], [6.20, 49.20],
      [7.60, 49.00], [7.60, 48.00], [6.90, 47.50], [6.00, 46.20], [7.00, 45.30], [6.50, 44.40],
      [7.50, 43.80], [5.00, 43.30], [3.00, 43.00], [3.20, 42.45], [1.70, 42.50], [-1.40, 43.30],
      [-1.20, 45.70], [-2.00, 46.80], [-4.80, 48.00], [-1.30, 48.60], [-1.60, 49.70],
      [0.20, 49.70], [1.60, 50.20])],
    'Frankrijk is het grootste land van West-Europa. De Mont Blanc, op de grens met Italië, is met 4806 meter de hoogste berg van de Alpen.',
    'France is the largest country in western Europe. Mont Blanc, on the Italian border, is the highest mountain in the Alps at 4,806 metres.',
    '#5e9e6a'),
  euro('verenigdkoninkrijk', 'Verenigd Koninkrijk', 'United Kingdom', 'Londen', 'London',
    [P([1.70, 52.95], [1.80, 52.50], [1.30, 51.35], [0.00, 50.75], [-1.90, 50.60], [-3.60, 50.20],
      [-5.70, 50.05], [-5.00, 51.10], [-3.10, 51.35], [-3.00, 51.60], [-4.70, 52.90],
      [-3.00, 53.40], [-3.10, 54.10], [-3.60, 54.90], [-5.10, 55.90], [-5.80, 58.60],
      [-3.00, 58.65], [-2.00, 57.70], [-1.60, 56.00], [0.60, 53.60]),
    P([-6.30, 55.25], [-5.45, 54.50], [-6.00, 54.05], [-7.40, 54.10], [-8.15, 55.15])],
    'Het Verenigd Koninkrijk is een eiland met vier delen: Engeland, Schotland, Wales en Noord-Ierland. Engels is er de taal.',
    'The United Kingdom is an island with four parts: England, Scotland, Wales and Northern Ireland. English is the language.',
    '#8f7ab8'),
  euro('ierland', 'Ierland', 'Ireland', 'Dublin', 'Dublin',
    [P([-6.20, 55.20], [-6.00, 54.05], [-6.00, 53.35], [-6.15, 52.20], [-7.60, 51.95],
      [-9.80, 51.45], [-10.40, 52.15], [-9.50, 53.30], [-9.90, 54.30], [-8.30, 54.65],
      [-7.30, 55.35])],
    'Ierland is groen omdat het er zo vaak regent. Het heeft een eigen taal, het Iers, naast het Engels.',
    'Ireland is green because it rains there so often. It has a language of its own, Irish, alongside English.',
    '#4f9455'),
  euro('spanje', 'Spanje', 'Spain', 'Madrid', 'Madrid',
    [P([-1.80, 43.40], [-4.50, 43.40], [-7.70, 43.75], [-9.30, 43.00], [-8.90, 41.90],
      [-6.90, 41.95], [-6.20, 41.60], [-7.00, 40.20], [-7.50, 38.20], [-7.40, 37.20],
      [-6.30, 36.90], [-5.60, 36.00], [-4.40, 36.70], [-2.20, 36.70], [-0.70, 37.60],
      [0.20, 38.80], [0.70, 40.60], [2.20, 41.30], [3.20, 42.45], [1.70, 42.50], [-1.40, 43.30])],
    'Spanje ligt op een schiereiland met Portugal. Het is er warm en droog, en de Pyreneeën scheiden het van Frankrijk.',
    'Spain sits on a peninsula with Portugal. It is hot and dry, and the Pyrenees cut it off from France.',
    '#d8a13a'),
  euro('portugal', 'Portugal', 'Portugal', 'Lissabon', 'Lisbon',
    [P([-8.90, 41.90], [-8.70, 40.60], [-8.80, 39.40], [-9.50, 38.70], [-8.80, 38.50],
      [-8.90, 37.00], [-7.40, 37.20], [-7.50, 38.20], [-7.00, 40.20], [-6.20, 41.60],
      [-6.90, 41.95])],
    'Portugal kijkt uit op de Atlantische Oceaan. Vanaf hier voeren de eerste schepen die om Afrika heen naar India zochten.',
    'Portugal looks out on the Atlantic. The first ships that sailed round Africa looking for India left from here.',
    '#5e9e6a'),
  euro('italie', 'Italië', 'Italy', 'Rome', 'Rome',
    [P([7.00, 45.30], [8.60, 46.10], [10.40, 46.60], [12.40, 46.70], [13.60, 45.80],
      [12.30, 45.45], [12.60, 44.20], [14.00, 42.20], [15.50, 41.90], [16.10, 41.90],
      [18.40, 40.10], [17.20, 40.40], [16.60, 38.90], [15.70, 37.95], [16.00, 37.90],
      [15.10, 36.70], [12.40, 37.80], [15.20, 38.20], [15.60, 40.00], [14.10, 40.80],
      [12.20, 41.70], [11.00, 42.40], [10.10, 44.00], [8.20, 44.20], [7.50, 43.80], [6.50, 44.40]),
    P([9.70, 40.90], [9.80, 39.20], [9.00, 39.20], [8.40, 39.10], [8.40, 40.90])],
    'Italië heeft de vorm van een laars die naar Sicilië schopt. In Rome ligt Vaticaanstad, het kleinste land ter wereld.',
    'Italy is shaped like a boot kicking Sicily. Inside Rome is Vatican City, the smallest country in the world.',
    '#4f9fa8'),
  euro('zwitserland', 'Zwitserland', 'Switzerland', 'Bern', 'Bern',
    [P([6.00, 46.20], [6.90, 47.50], [8.60, 47.70], [9.60, 47.55], [10.40, 46.90], [9.20, 46.20],
      [7.80, 45.90], [7.00, 45.90])],
    'Zwitserland ligt vol bergen, en de Rijn begint er. Het land heeft vier talen: Duits, Frans, Italiaans en Reto-Romaans.',
    'Switzerland is full of mountains, and the Rhine begins there. It has four languages: German, French, Italian and Romansh.',
    '#c94f4f'),
  euro('oostenrijk', 'Oostenrijk', 'Austria', 'Wenen', 'Vienna',
    [P([9.60, 47.55], [10.20, 47.30], [11.20, 47.40], [13.00, 47.70], [13.80, 48.60],
      [15.00, 49.00], [16.90, 48.70], [17.10, 48.00], [16.00, 46.70], [14.50, 46.40],
      [12.80, 46.65], [11.00, 46.80], [10.40, 46.90])],
    'Oostenrijk is een bergland zonder zee. De Alpen beslaan bijna twee derde van het land.',
    'Austria is a mountain country with no sea. The Alps cover nearly two thirds of it.',
    '#d06a5a'),
  euro('tsjechie', 'Tsjechië', 'Czechia', 'Praag', 'Prague',
    [P([12.20, 50.30], [13.50, 50.60], [14.70, 51.00], [16.50, 50.70], [18.00, 50.00],
      [18.80, 49.50], [17.10, 48.80], [15.00, 49.00], [13.80, 48.60], [12.40, 49.30])],
    'Tsjechië ligt midden in Europa en heeft nergens zee. Praag staat aan de Moldau, met een brug uit 1357.',
    'Czechia sits in the middle of Europe with no coast anywhere. Prague stands on the Vltava, with a bridge from 1357.',
    '#6f9ec4'),
  euro('slowakije', 'Slowakije', 'Slovakia', 'Bratislava', 'Bratislava',
    [P([16.90, 48.70], [18.80, 49.50], [20.10, 49.20], [22.00, 49.10], [22.50, 48.40],
      [21.00, 48.30], [19.00, 48.10], [17.10, 48.00])],
    'Slowakije ontstond in 1993, toen Tsjechoslowakije zich vreedzaam in tweeën splitste.',
    'Slovakia came into being in 1993, when Czechoslovakia peacefully split in two.',
    '#8ab06a'),
  euro('polen', 'Polen', 'Poland', 'Warschau', 'Warsaw',
    [P([14.20, 53.90], [16.00, 54.55], [18.60, 54.70], [19.60, 54.45], [22.80, 54.35],
      [23.50, 53.90], [23.80, 52.10], [23.60, 51.50], [24.10, 50.50], [22.60, 49.50],
      [22.00, 49.10], [20.10, 49.20], [18.80, 49.50], [18.00, 50.00], [16.50, 50.70],
      [14.70, 51.00], [14.60, 52.60])],
    'Polen ligt op de Noord-Europese vlakte en is bijna overal vlak. Het grenst aan zeven landen en aan de Oostzee.',
    'Poland lies on the North European plain and is flat almost everywhere. It borders seven countries and the Baltic.',
    '#c95f7f'),
  euro('denemarken', 'Denemarken', 'Denmark', 'Kopenhagen', 'Copenhagen',
    [P([8.60, 55.50], [8.10, 56.70], [8.60, 57.10], [10.60, 57.75], [10.50, 56.60],
      [9.90, 55.80], [10.10, 55.10], [9.90, 54.85], [8.90, 54.90]),
    P([11.00, 55.95], [12.60, 56.10], [12.60, 55.30], [11.30, 55.10])],
    'Denemarken is een schiereiland met ruim vierhonderd eilanden eromheen. Het hoogste punt is maar 171 meter.',
    'Denmark is a peninsula with over four hundred islands around it. Its highest point is only 171 metres.',
    '#d05a5a'),
  euro('noorwegen', 'Noorwegen', 'Norway', 'Oslo', 'Oslo',
    [P([11.10, 58.98], [10.60, 59.40], [8.00, 58.10], [5.30, 58.95], [5.10, 61.50], [7.50, 63.00],
      [10.50, 64.00], [12.80, 66.00], [15.60, 68.40], [18.20, 69.60], [21.00, 70.20],
      [25.50, 71.10], [28.20, 70.90], [30.90, 69.80], [29.30, 69.30], [27.00, 69.90],
      [24.00, 68.70], [20.50, 68.50], [18.10, 68.55], [17.90, 67.50], [14.50, 66.20],
      [14.10, 64.50], [12.20, 63.00], [12.30, 61.00], [12.60, 60.10], [11.80, 59.30])],
    'Noorwegen is een lange strook langs de kust, ingesneden door fjorden. In het noorden gaat de zon in de zomer weken niet onder.',
    'Norway is a long strip along the coast, cut into by fjords. In the north the sun does not set for weeks in summer.',
    '#4f8fc4'),
  euro('zweden', 'Zweden', 'Sweden', 'Stockholm', 'Stockholm',
    [P([11.80, 59.30], [12.60, 60.10], [12.30, 61.00], [12.20, 63.00], [14.10, 64.50],
      [14.50, 66.20], [17.90, 67.50], [18.10, 68.55], [20.50, 68.50], [23.60, 67.90],
      [24.20, 65.80], [21.60, 64.40], [19.00, 63.00], [17.40, 61.70], [17.90, 60.60],
      [19.00, 59.80], [18.30, 58.70], [16.60, 58.40], [16.50, 56.20], [14.30, 55.40],
      [12.90, 55.40], [12.90, 56.20], [11.30, 58.30])],
    'Zweden is het grootste land van Scandinavië. Meer dan de helft is bos, en er liggen bijna honderdduizend meren in.',
    'Sweden is the largest country in Scandinavia. More than half of it is forest, and it holds nearly a hundred thousand lakes.',
    '#6fa8d8'),
  euro('finland', 'Finland', 'Finland', 'Helsinki', 'Helsinki',
    [P([24.20, 65.80], [23.60, 67.90], [20.50, 68.50], [24.00, 68.70], [27.00, 69.90],
      [29.30, 69.30], [28.60, 68.20], [30.50, 66.20], [29.60, 64.20], [31.50, 62.80],
      [27.80, 60.55], [25.30, 60.15], [22.90, 59.80], [21.40, 61.00], [21.50, 63.30],
      [24.60, 65.10])],
    'Finland heeft 188.000 meren: meer dan enig ander land. In de winter is het er donker en bevriest de zee bij de kust.',
    'Finland has 188,000 lakes, more than any other country. In winter it is dark and the sea freezes along the coast.',
    '#8ac4dd'),
  euro('ijsland', 'IJsland', 'Iceland', 'Reykjavik', 'Reykjavik',
    [P([-14.50, 66.40], [-15.00, 64.20], [-18.00, 63.40], [-22.70, 63.80], [-24.50, 64.80],
      [-22.20, 65.50], [-23.70, 66.20], [-20.00, 66.55], [-16.00, 66.50])],
    'IJsland ligt op de naad tussen twee aardschotsen, en daarom staan er vulkanen en spuiten er geisers.',
    'Iceland sits on the seam between two plates of the earth, which is why it has volcanoes and geysers.',
    '#7ab8c4'),
  euro('estland', 'Estland', 'Estonia', 'Tallinn', 'Tallinn',
    [P([23.50, 59.60], [26.00, 59.60], [28.20, 59.40], [27.80, 57.90], [26.00, 57.50],
      [24.30, 57.90], [23.50, 58.50])],
    'Estland is het noordelijkste van de drie Baltische landen. De taal lijkt op het Fins, niet op die van de buren.',
    'Estonia is the northernmost of the three Baltic countries. Its language is like Finnish, not like its neighbours’.',
    '#8fb8d8'),
  euro('letland', 'Letland', 'Latvia', 'Riga', 'Riga',
    [P([21.00, 57.55], [23.50, 58.50], [24.30, 57.90], [26.00, 57.50], [27.80, 57.90],
      [28.20, 56.20], [26.60, 55.70], [24.40, 56.30], [21.10, 56.10])],
    'Letland ligt aan de Oostzee. In 1989 vormden de drie Baltische landen een menselijke ketting van zeshonderd kilometer.',
    'Latvia lies on the Baltic. In 1989 the three Baltic countries formed a human chain six hundred kilometres long.',
    '#a8b8c8'),
  euro('litouwen', 'Litouwen', 'Lithuania', 'Vilnius', 'Vilnius',
    [P([21.10, 56.10], [24.40, 56.30], [26.60, 55.70], [26.60, 55.20], [25.50, 54.30],
      [23.50, 53.90], [22.80, 54.35], [21.00, 55.30])],
    'Litouwen was ooit met Polen het grootste land van Europa. Nu is het klein, en vol bossen en ooievaars.',
    'Lithuania was once, together with Poland, the biggest country in Europe. Now it is small, and full of forest and storks.',
    '#c4a86a'),
  euro('witrusland', 'Wit-Rusland', 'Belarus', 'Minsk', 'Minsk',
    [P([23.50, 53.90], [25.50, 54.30], [26.60, 55.20], [28.20, 56.20], [30.80, 55.70],
      [31.80, 54.00], [31.60, 52.10], [30.50, 51.30], [27.70, 51.50], [24.10, 51.80],
      [23.60, 52.10])],
    'Wit-Rusland heeft geen zee en wel het oudste oerbos van Europa, waar nog wisenten lopen.',
    'Belarus has no sea and does have the oldest primeval forest in Europe, with wild bison still in it.',
    '#9ab86a'),
  euro('oekraine', 'Oekraïne', 'Ukraine', 'Kyiv', 'Kyiv',
    [P([24.10, 51.80], [27.70, 51.50], [30.50, 51.30], [33.20, 52.35], [35.40, 50.40],
      [38.20, 49.90], [40.20, 49.60], [40.10, 47.80], [38.20, 47.10], [36.60, 45.40],
      [33.60, 46.10], [33.60, 44.40], [32.50, 45.30], [30.50, 46.00], [28.80, 45.30],
      // round the edge of Moldova rather than over it: the border follows the Dniester
      [28.20, 46.60], [29.60, 46.40], [30.10, 47.40], [28.20, 48.20], [26.60, 48.30],
      [24.60, 47.95], [22.50, 48.40], [23.60, 50.40])],
    'Oekraïne is het grootste land dat helemaal in Europa ligt. De zwarte aarde is zo vruchtbaar dat het de graanschuur van Europa heet.',
    'Ukraine is the largest country lying wholly in Europe. Its black soil is so rich it is called the breadbasket of Europe.',
    '#d8c04a'),
  euro('rusland', 'Rusland', 'Russia', 'Moskou', 'Moscow',
    [P([28.20, 59.40], [31.50, 62.80], [29.60, 64.20], [30.50, 66.20], [28.60, 68.20],
      [29.30, 69.30], [33.00, 69.50], [40.00, 66.00], [44.50, 68.00], [46.00, 66.50],
      [44.00, 62.00], [44.50, 57.00], [46.50, 52.00], [44.00, 48.50],
      [40.20, 49.60], [38.20, 49.90], [35.40, 50.40], [33.20, 52.35], [31.60, 52.10],
      [31.80, 54.00], [30.80, 55.70], [28.20, 56.20], [27.80, 57.90], [28.20, 59.40])],
    'Rusland is het grootste land ter wereld en ligt in Europa én in Azië. Dit is het Europese deel; de Oeral is de grens tussen de twee.',
    'Russia is the largest country in the world and lies in both Europe and Asia. This is the European half; the Urals are the border.',
    '#b08fb8'),
  euro('hongarije', 'Hongarije', 'Hungary', 'Boedapest', 'Budapest',
    [P([16.90, 48.70], [17.10, 48.00], [19.00, 48.10], [21.00, 48.30], [22.50, 48.40],
      [22.20, 47.60], [21.50, 46.20], [20.20, 46.10], [18.80, 45.90], [17.30, 45.90],
      [16.50, 46.50], [16.00, 46.70], [17.10, 47.70])],
    'Hongarije heeft een taal die op geen enkele buurtaal lijkt. Het Balatonmeer is het grootste meer van Midden-Europa.',
    'Hungary speaks a language unlike any of its neighbours’. Lake Balaton is the largest lake in central Europe.',
    '#c46a5a'),
  euro('roemenie', 'Roemenië', 'Romania', 'Boekarest', 'Bucharest',
    [P([22.50, 48.40], [24.60, 47.95], [26.60, 48.30], [28.20, 46.60], [28.80, 45.30],
      [29.60, 45.10], [28.60, 44.00], [27.00, 44.10], [25.00, 43.65], [22.70, 44.20],
      [21.50, 44.80], [20.30, 45.70], [21.50, 46.20], [22.20, 47.60])],
    'Door Roemenië lopen de Karpaten. Daarin ligt Transsylvanië, het land van het kasteel waar het verhaal van Dracula speelt.',
    'The Carpathians run through Romania. Transylvania lies in them, the land of the castle in the Dracula story.',
    '#d8a84a'),
  euro('bulgarije', 'Bulgarije', 'Bulgaria', 'Sofia', 'Sofia',
    [P([22.70, 44.20], [25.00, 43.65], [27.00, 44.10], [28.60, 43.75], [27.90, 42.00],
      [26.30, 41.70], [24.50, 41.55], [22.90, 41.35], [22.40, 42.30], [22.98, 43.20])],
    'Bulgarije is een van de oudste landen van Europa: de naam staat al sinds 681 op de kaart. Er groeien rozen voor parfum.',
    'Bulgaria is one of the oldest countries in Europe: the name has been on the map since 681. Roses are grown there for perfume.',
    '#7aa86a'),
  euro('griekenland', 'Griekenland', 'Greece', 'Athene', 'Athens',
    [P([20.00, 39.65], [21.00, 40.70], [22.90, 41.35], [24.50, 41.55], [26.30, 41.70],
      [26.60, 40.90], [24.50, 40.10], [23.40, 40.30], [23.00, 39.20], [24.00, 38.20],
      [23.60, 37.90], [23.20, 36.40], [22.30, 36.60], [21.70, 38.30], [20.90, 38.30],
      [21.10, 39.00])],
    'Griekenland heeft ruim zesduizend eilanden, waarvan er tweehonderd bewoond zijn. De Olympische Spelen zijn er bedacht.',
    'Greece has over six thousand islands, two hundred of them lived on. The Olympic Games were invented there.',
    '#5a9ec4'),
  euro('servie', 'Servië', 'Serbia', 'Belgrado', 'Belgrade',
    [P([18.80, 45.90], [20.20, 46.10], [21.50, 44.80], [22.70, 44.20], [22.40, 42.30],
      [21.50, 42.30], [20.30, 42.90], [19.20, 43.50], [19.40, 44.30], [19.00, 44.90])],
    'Servië heeft geen zee. Belgrado ligt waar de Save in de Donau stroomt, en is een van de oudste steden van Europa.',
    'Serbia has no sea. Belgrade stands where the Sava runs into the Danube, and is one of the oldest cities in Europe.',
    '#b88f6a'),
  euro('kroatie', 'Kroatië', 'Croatia', 'Zagreb', 'Zagreb',
    [P([13.60, 45.45], [15.00, 45.50], [16.50, 46.30], [17.30, 45.90], [18.80, 45.90],
      [19.00, 44.90], [17.80, 45.10], [16.40, 44.20], [17.60, 42.90], [18.50, 42.60],
      [17.20, 42.90], [15.30, 43.90], [14.50, 44.90], [13.60, 45.10])],
    'Kroatië ziet eruit als een boemerang en heeft meer dan duizend eilanden voor de kust liggen.',
    'Croatia looks like a boomerang and has over a thousand islands lying off its coast.',
    '#6ab8a8'),
  euro('slovenie', 'Slovenië', 'Slovenia', 'Ljubljana', 'Ljubljana',
    [P([13.60, 45.80], [14.50, 46.40], [16.00, 46.70], [16.50, 46.30], [15.00, 45.50],
      [13.60, 45.45])],
    'Slovenië is klein en groen: zestig procent is bos. Het heeft maar 47 kilometer kust.',
    'Slovenia is small and green: sixty per cent of it is forest. It has only 47 kilometres of coast.',
    '#8ac46a'),
  euro('bosnie', 'Bosnië en Herzegovina', 'Bosnia and Herzegovina', 'Sarajevo', 'Sarajevo',
    [P([16.50, 45.20], [17.80, 45.10], [19.00, 44.90], [19.40, 44.30], [19.20, 43.50],
      [18.50, 42.60], [17.60, 42.90], [16.40, 44.20])],
    'Bosnië en Herzegovina ligt vol bergen. De brug van Mostar is in de oorlog verwoest en daarna steen voor steen teruggebouwd.',
    'Bosnia and Herzegovina is full of mountains. The bridge at Mostar was destroyed in the war and rebuilt stone by stone.',
    '#a8a86a'),
  euro('montenegro', 'Montenegro', 'Montenegro', 'Podgorica', 'Podgorica',
    [P([18.45, 42.60], [19.20, 43.50], [20.30, 42.90], [20.10, 42.20], [19.30, 41.85],
      [18.50, 42.30])],
    'Montenegro betekent zwarte berg. Het is een van de kleinste landen van Europa, met fjordachtige baaien aan de Adriatische Zee.',
    'Montenegro means black mountain. It is one of the smallest countries in Europe, with fjord-like bays on the Adriatic.',
    '#7a7ab8'),
  euro('albanie', 'Albanië', 'Albania', 'Tirana', 'Tirana',
    [P([19.30, 41.85], [20.10, 42.20], [20.60, 41.90], [21.00, 40.90], [20.00, 39.65],
      [19.30, 40.40], [19.45, 41.30])],
    'Albanië ligt aan de Adriatische Zee, tegenover de hak van Italië. Het land was vijftig jaar lang bijna volledig afgesloten.',
    'Albania faces the Adriatic, across from the heel of Italy. The country was almost completely shut off for fifty years.',
    '#c45a5a'),
  euro('noordmacedonie', 'Noord-Macedonië', 'North Macedonia', 'Skopje', 'Skopje',
    [P([20.60, 41.90], [21.50, 42.30], [22.40, 42.30], [22.90, 41.35], [21.00, 40.90])],
    'Noord-Macedonië heeft geen zee, wel het Ohridmeer: een van de oudste meren ter wereld, ruim een miljoen jaar oud.',
    'North Macedonia has no sea, but it has Lake Ohrid: one of the oldest lakes in the world, over a million years old.',
    '#d8a86a'),
  euro('moldavie', 'Moldavië', 'Moldova', 'Chisinau', 'Chisinau',
    [P([26.60, 48.30], [28.20, 48.20], [30.10, 47.40], [29.60, 46.40], [28.80, 45.30],
      [28.20, 46.60])],
    'Moldavië is klein en heeft geen zee. Er staan meer wijnstokken per persoon dan in welk land ook.',
    'Moldova is small and has no sea. It has more vines per person than any other country.',
    '#c4b86a'),
  euro('turkije', 'Turkije', 'Turkey', 'Ankara', 'Ankara',
    [P([26.10, 41.70], [28.00, 41.95], [29.20, 41.20], [31.40, 41.10], [35.00, 42.00],
      [38.30, 40.90], [41.50, 41.50], [43.50, 41.10], [44.80, 39.70], [44.20, 37.90],
      [42.30, 37.30], [38.60, 36.70], [36.20, 36.00], [34.00, 36.30], [32.00, 36.10],
      [29.70, 36.15], [27.20, 36.70], [26.30, 38.60], [26.60, 40.90])],
    'Turkije ligt in twee werelddelen tegelijk. Istanbul heeft een oever in Europa en een oever in Azië, met de Bosporus ertussen.',
    'Turkey lies in two continents at once. Istanbul has one bank in Europe and one in Asia, with the Bosphorus between them.',
    '#c46a4a'),
];

// ---------------------------------------------------------------- 7. werelddelen en oceanen

/**
 * The continents, with the same codes and the same outlines the animal book uses.
 *
 * The rings come straight out of `animals/worldmap.ts`, because Suri should not have two
 * different Africas in it.
 */
export const CONTINENT_INFO: Array<{
  id: string; nl: string; en: string; tone: string; factNl: string; factEn: string;
}> = [
  {
    id: 'eu', nl: 'Europa', en: 'Europe', tone: '#e6772f',
    factNl: 'Europa is het op een na kleinste werelddeel, maar er wonen ruim zevenhonderd miljoen mensen. Er zijn meer dan vijftig landen.',
    factEn: 'Europe is the second smallest continent, but over seven hundred million people live there, in more than fifty countries.',
  },
  {
    id: 'as', nl: 'Azië', en: 'Asia', tone: '#d8a83c',
    factNl: 'Azië is het grootste werelddeel en er wonen de meeste mensen: meer dan de helft van alle mensen op aarde. De Mount Everest staat er.',
    factEn: 'Asia is the largest continent and holds the most people: more than half of everyone on earth. Mount Everest is there.',
  },
  {
    id: 'af', nl: 'Afrika', en: 'Africa', tone: '#c07a3a',
    factNl: 'Afrika heeft 54 landen, meer dan welk werelddeel ook. De Sahara is de grootste hete woestijn ter wereld.',
    factEn: 'Africa has 54 countries, more than any other continent. The Sahara is the largest hot desert in the world.',
  },
  {
    id: 'na', nl: 'Noord-Amerika', en: 'North America', tone: '#6a9ec4',
    factNl: 'Noord-Amerika loopt van het ijs van Groenland tot de jungle van Panama. Het heeft de Grote Meren, het grootste zoetwater ter wereld.',
    factEn: 'North America runs from the ice of Greenland to the jungle of Panama. It holds the Great Lakes, the largest fresh water on earth.',
  },
  {
    id: 'sa', nl: 'Zuid-Amerika', en: 'South America', tone: '#5e9e6a',
    factNl: 'Door Zuid-Amerika stroomt de Amazone, de rivier met het meeste water ter wereld, door het grootste regenwoud.',
    factEn: 'The Amazon runs through South America: the river with the most water in the world, through the largest rainforest.',
  },
  {
    id: 'oc', nl: 'Oceanië', en: 'Oceania', tone: '#c96a8c',
    factNl: 'Oceanië is bijna allemaal water met eilanden erin. Australië is er het grootste land, en het Groot Barrièrerif ligt ervoor.',
    factEn: 'Oceania is nearly all water with islands in it. Australia is the biggest country there, and the Great Barrier Reef lies off it.',
  },
  {
    id: 'an', nl: 'Antarctica', en: 'Antarctica', tone: '#8ac4dd',
    factNl: 'Antarctica is het koudste werelddeel en niemand woont er vast. Het ijs is er gemiddeld bijna twee kilometer dik.',
    factEn: 'Antarctica is the coldest continent and nobody lives there for good. The ice is nearly two kilometres thick on average.',
  },
];

/**
 * The seven, built out of the animal book's own outlines.
 *
 * `CONTINENT_RINGS` is the very same table `worldmap.ts` has always drawn from, so a continent
 * here has exactly the shape a child already met beside a lion.
 */
export const CONTINENTS: Feature[] = CONTINENT_INFO.map(c => ({
  id: c.id,
  nl: c.nl,
  en: c.en,
  kind: 'continent' as const,
  rings: (CONTINENT_RINGS[c.id] ?? []).map(r => r.map(p => [p[0], p[1]] as Pt)),
  factNl: c.factNl,
  factEn: c.factEn,
  cont: c.id,
  tone: c.tone,
}));

export const OCEANS: Feature[] = [
  {
    id: 'stille', nl: 'De Grote Oceaan', en: 'The Pacific Ocean', kind: 'ocean', tone: '#2f7fc4',
    rings: [
      P([-180, 60], [-130, 50], [-110, 20], [-80, 5], [-80, -55], [-180, -55]),
      P([120, 30], [180, 60], [180, -55], [140, -50], [150, 0], [130, 10]),
    ],
    factNl: 'De Grote Oceaan is de grootste en diepste oceaan: er past al het land van de wereld in. Het diepste punt ligt elf kilometer onder water.',
    factEn: 'The Pacific is the biggest and deepest ocean: all the land in the world would fit in it. Its deepest point is eleven kilometres down.',
  },
  {
    id: 'atlantische', nl: 'De Atlantische Oceaan', en: 'The Atlantic Ocean', kind: 'ocean', tone: '#3f92cc',
    rings: [P([-70, 45], [-20, 60], [-10, 40], [10, 0], [15, -30], [20, -55], [-65, -55],
      [-55, -20], [-40, 0], [-60, 20])],
    factNl: 'De Atlantische Oceaan ligt tussen Europa en Amerika en wordt elk jaar een paar centimeter breder, omdat de bodem er openscheurt.',
    factEn: 'The Atlantic lies between Europe and America and grows a few centimetres wider every year, because its floor is splitting open.',
  },
  {
    id: 'indische', nl: 'De Indische Oceaan', en: 'The Indian Ocean', kind: 'ocean', tone: '#4aa3d8',
    rings: [P([25, 10], [60, 22], [80, 5], [100, 0], [115, -20], [120, -45], [30, -45],
      [40, -20], [45, 0])],
    factNl: 'De Indische Oceaan is de warmste oceaan. De moesson draait er elk halfjaar van richting om, en daarop varen de schepen al duizenden jaren.',
    factEn: 'The Indian Ocean is the warmest ocean. The monsoon turns round there every six months, and ships have sailed on it for thousands of years.',
  },
  {
    id: 'noordelijke', nl: 'De Noordelijke IJszee', en: 'The Arctic Ocean', kind: 'ocean', tone: '#a8d8e8',
    rings: [P([-180, 90], [180, 90], [180, 72], [100, 78], [30, 78], [-10, 80], [-60, 80],
      [-140, 72], [-180, 72])],
    factNl: 'De Noordelijke IJszee is de kleinste en ondiepste oceaan, en de enige die dichtvriest. Er drijft ijs op waar ijsberen op jagen.',
    factEn: 'The Arctic is the smallest and shallowest ocean, and the only one that freezes over. Polar bears hunt on the ice that floats on it.',
  },
  {
    id: 'zuidelijke', nl: 'De Zuidelijke Oceaan', en: 'The Southern Ocean', kind: 'ocean', tone: '#6fb8d8',
    rings: [P([-180, -60], [180, -60], [180, -68], [100, -67], [20, -70], [-60, -65],
      [-140, -74], [-180, -70])],
    factNl: 'De Zuidelijke Oceaan draait rond Antarctica en is als laatste een echte oceaan genoemd, pas in 2000. De stroming erin is de sterkste ter wereld.',
    factEn: 'The Southern Ocean circles Antarctica and was the last to be called an ocean of its own, in 2000. Its current is the strongest on earth.',
  },
];

// ---------------------------------------------------------------- 8. landen van de wereld

const world = (
  id: string, nl: string, en: string, capNl: string, capEn: string, cont: string, rings: Ring[],
  factNl: string, factEn: string, tone: string,
): Feature => ({
  id, nl, en, kind: 'country', rings, capNl, capEn, cont, factNl, factEn, tone, flag: FLAG[id],
});

const ringsOf = (id: string): Ring[] => EU_COUNTRIES.find(c => c.id === id)?.rings ?? [];

/**
 * The big ones, and the ones a child hears about.
 *
 * The European members are the very same outlines as on the Europe board - one shape in lon and
 * lat is one shape everywhere - so Germany is Germany whether it is being placed in Europe or in
 * the world.
 */
export const WORLD_COUNTRIES: Feature[] = [
  world('rusland_w', 'Rusland', 'Russia', 'Moskou', 'Moscow', 'as',
    [P([30, 70], [40, 66], [50, 69], [60, 70], [75, 73], [90, 76], [105, 77], [125, 73],
      [140, 72], [160, 70], [180, 66], [175, 62], [160, 60], [155, 52], [143, 48], [135, 45],
      [131, 43], [130, 48], [120, 50], [108, 49], [100, 50], [88, 49], [80, 51], [70, 55],
      [60, 52], [52, 51], [48, 50], [40, 50], [38, 52], [32, 53], [31, 56], [28, 59], [30, 62],
      [29, 66], [30, 69])],
    'Rusland is het grootste land ter wereld en beslaat elf tijdzones. Als het in Moskou ochtend is, is het aan de andere kant avond.',
    'Russia is the largest country in the world and spans eleven time zones. When it is morning in Moscow it is evening at the other end.',
    '#b08fb8'),
  world('china', 'China', 'China', 'Peking', 'Beijing', 'as',
    // the northern border dips under Mongolia and comes back up its eastern side, which is what
    // makes Manchuria the shape it is
    [P([73, 39], [80, 45], [88, 49], [91, 46], [97, 43], [105, 42], [112, 44], [119, 46],
      [120, 50], [127, 50], [131, 45], [125, 41], [122, 40], [119, 37], [121, 32], [118, 25],
      [113, 22], [108, 21], [102, 22], [97, 25], [92, 28], [85, 28], [79, 32], [75, 36])],
    'In China wonen ruim anderhalf miljard mensen. De Chinese Muur is duizenden kilometers lang en werd gebouwd om het land te beschermen.',
    'Over one and a half billion people live in China. The Great Wall runs for thousands of kilometres and was built to keep the country safe.',
    '#d8a83c'),
  world('india', 'India', 'India', 'New Delhi', 'New Delhi', 'as',
    [P([68, 24], [70, 28], [74, 32], [78, 35], [81, 30], [88, 27], [92, 28], [94, 27], [92, 22],
      [87, 21], [84, 19], [80, 13], [77, 8], [75, 12], [73, 18], [70, 21])],
    'India krijgt elk jaar de moesson: maanden droogte en dan regen die alles groen maakt. Het is het land met de meeste inwoners ter wereld.',
    'India gets the monsoon every year: months of drought and then rain that turns everything green. It has more people than any other country.',
    '#c46a4a'),
  world('japan', 'Japan', 'Japan', 'Tokio', 'Tokyo', 'as',
    [P([141, 45], [145, 43], [144, 42], [141, 40], [140, 37], [141, 35], [139, 34], [136, 34],
      [132, 34], [130, 33], [129, 33], [131, 31], [131, 34], [134, 35], [137, 36], [140, 42])],
    'Japan is een rij eilanden op de rand van vier aardschotsen. Daarom beeft de grond er vaak en staan er meer dan honderd vulkanen.',
    'Japan is a line of islands on the edge of four plates. That is why the ground shakes so often and why it has over a hundred volcanoes.',
    '#c95f7f'),
  world('indonesie', 'Indonesië', 'Indonesia', 'Jakarta', 'Jakarta', 'as',
    [P([95, 5], [99, 3], [104, 0], [106, -6], [114, -8], [118, -9], [125, -9], [131, -8],
      [141, -9], [141, -3], [132, -1], [128, 2], [125, 1], [119, 0], [117, 4], [109, 2],
      [103, 1], [98, 2])],
    'Indonesië bestaat uit meer dan zeventienduizend eilanden en ligt op de evenaar. Er staan meer actieve vulkanen dan in enig ander land.',
    'Indonesia is made up of more than seventeen thousand islands and sits on the equator. It has more active volcanoes than any other country.',
    '#5e9e6a'),
  world('australie', 'Australië', 'Australia', 'Canberra', 'Canberra', 'oc',
    [P([113, -22], [114, -34], [121, -34], [129, -32], [137, -35], [141, -38], [148, -38],
      [150, -35], [153, -28], [153, -25], [146, -19], [142, -11], [136, -12], [130, -11],
      [126, -14], [122, -18])],
    'Australië is een land én een werelddeel. Het midden is woestijn, en er leven dieren die nergens anders voorkomen: kangoeroes, koala’s, vogelbekdieren.',
    'Australia is a country and a continent at once. The middle is desert, and animals live there that live nowhere else: kangaroos, koalas, platypuses.',
    '#d8a13a'),
  world('nieuwzeeland', 'Nieuw-Zeeland', 'New Zealand', 'Wellington', 'Wellington', 'oc',
    [
      P([172.7, -34.4], [176.2, -37.6], [178.5, -37.6], [177.2, -39.3], [176.9, -41.1],
        [174.8, -41.3], [174.6, -39.1], [173.0, -39.3], [174.5, -37.0]),
      P([172.6, -40.5], [174.3, -41.7], [172.7, -43.9], [171.2, -44.9], [169.9, -46.7],
        [167.0, -46.2], [168.4, -44.1], [170.7, -42.9]),
    ],
    'Nieuw-Zeeland ligt ver van alles vandaan. Voordat de mensen kwamen, leefden er op het land geen zoogdieren behalve vleermuizen: het was van de vogels, zoals de kiwi.',
    'New Zealand lies a long way from everything. Before people came, no land mammal but the bat lived there: it belonged to the birds, like the kiwi.',
    '#6ab8a8'),
  world('verenigdestaten', 'Verenigde Staten', 'United States', 'Washington', 'Washington', 'na',
    [P([-125, 48], [-95, 49], [-83, 46], [-76, 44], [-70, 44], [-70, 41], [-76, 37], [-81, 31],
      [-80, 25], [-85, 30], [-89, 29], [-94, 29], [-97, 26], [-103, 29], [-111, 31], [-117, 32],
      [-121, 35], [-124, 40], [-124, 46])],
    'De Verenigde Staten bestaan uit vijftig staten en zijn zo breed dat de zon er vier uur eerder opkomt in het oosten dan in het westen.',
    'The United States is made of fifty states and is so wide that the sun rises four hours earlier in the east than in the west.',
    '#8f7ab8'),
  world('canada', 'Canada', 'Canada', 'Ottawa', 'Ottawa', 'na',
    [P([-140, 69], [-125, 70], [-110, 69], [-95, 70], [-85, 73], [-73, 79], [-58, 76], [-52, 68],
      [-62, 60], [-55, 52], [-66, 45], [-70, 44], [-76, 44], [-83, 46], [-95, 49], [-125, 48],
      [-130, 54], [-140, 60])],
    'Canada is het op een na grootste land ter wereld en heeft de langste kustlijn: ruim tweehonderdduizend kilometer.',
    'Canada is the second largest country in the world and has the longest coastline: over two hundred thousand kilometres.',
    '#6a9ec4'),
  world('mexico', 'Mexico', 'Mexico', 'Mexico-Stad', 'Mexico City', 'na',
    [P([-117, 32], [-111, 31], [-103, 29], [-97, 26], [-97, 21], [-94, 18], [-91, 18], [-88, 21],
      [-87, 20], [-92, 15], [-96, 16], [-101, 17], [-106, 23], [-110, 24], [-114, 31])],
    'In Mexico stonden de steden van de Azteken en de Maya’s. De naam van het land komt van de Mexica, het volk dat Tenochtitlan bouwde.',
    'The cities of the Aztecs and the Maya stood in Mexico. The country is named after the Mexica, the people who built Tenochtitlan.',
    '#c07a3a'),
  world('brazilie', 'Brazilië', 'Brazil', 'Brasilia', 'Brasilia', 'sa',
    [P([-60, 5], [-51, 4], [-50, -1], [-44, -2], [-38, -5], [-35, -6], [-39, -13], [-48, -25],
      [-53, -34], [-57, -30], [-58, -20], [-60, -16], [-65, -11], [-70, -8], [-73, -7],
      [-70, -2], [-67, 2])],
    'Brazilië is het grootste land van Zuid-Amerika. Het Amazoneregenwoud beslaat er het grootste deel van, en er wordt Portugees gesproken.',
    'Brazil is the largest country in South America. The Amazon rainforest covers most of it, and the language is Portuguese.',
    '#5e9e6a'),
  world('argentinie', 'Argentinië', 'Argentina', 'Buenos Aires', 'Buenos Aires', 'sa',
    [P([-66, -22], [-62, -22], [-58, -25], [-56, -28], [-58, -34], [-62, -39], [-65, -42],
      [-65, -48], [-68, -52], [-68, -55], [-72, -52], [-71, -45], [-72, -38], [-70, -30],
      [-68, -25])],
    'Argentinië loopt van de tropen tot bij Antarctica. In het zuiden ligt Patagonië, met gletsjers, en in het midden de pampa vol koeien.',
    'Argentina runs from the tropics to near Antarctica. Patagonia lies in the south, with glaciers, and the cattle-covered pampas in the middle.',
    '#6fa8d8'),
  world('chili', 'Chili', 'Chile', 'Santiago', 'Santiago', 'sa',
    [P([-70, -18], [-68, -22], [-68, -27], [-70, -30], [-72, -38], [-71, -45], [-72, -52],
      [-75, -50], [-75, -44], [-74, -40], [-73, -32], [-71, -25], [-71, -20])],
    'Chili is meer dan vierduizend kilometer lang en gemiddeld maar honderdtachtig kilometer breed. De Atacama is de droogste woestijn ter wereld.',
    'Chile is over four thousand kilometres long and on average only a hundred and eighty wide. The Atacama is the driest desert in the world.',
    '#c46a5a'),
  world('peru', 'Peru', 'Peru', 'Lima', 'Lima', 'sa',
    [P([-81, -6], [-79, -8], [-76, -14], [-70, -18], [-69, -17], [-69, -11], [-73, -9],
      [-73, -4], [-75, -1], [-80, -3])],
    'In Peru liggen de Andes en de ruïnestad Machu Picchu, die de Inca’s bouwden op 2400 meter hoogte.',
    'Peru holds the Andes and the ruined city of Machu Picchu, which the Incas built at 2,400 metres.',
    '#d8a84a'),
  world('colombia', 'Colombia', 'Colombia', 'Bogota', 'Bogotá', 'sa',
    [P([-77, 8], [-75, 11], [-72, 11], [-71, 12], [-67, 6], [-67, 1], [-70, -2], [-74, -1],
      [-78, 1], [-79, 5])],
    'Colombia grenst aan twee oceanen tegelijk. Er groeien meer soorten vogels dan in welk land ook.',
    'Colombia borders two oceans at once. More kinds of bird live there than in any other country.',
    '#d8c04a'),
  world('egypte', 'Egypte', 'Egypt', 'Caïro', 'Cairo', 'af',
    [P([25, 32], [30, 31], [34, 31], [34, 29], [36, 22], [25, 22])],
    'Door Egypte stroomt de Nijl, een van de langste rivieren ter wereld. De piramides van Gizeh staan er al ruim viereneenhalfduizend jaar.',
    'The Nile runs through Egypt, one of the longest rivers in the world. The pyramids of Giza have stood there for over four and a half thousand years.',
    '#d8b53a'),
  world('marokko', 'Marokko', 'Morocco', 'Rabat', 'Rabat', 'af',
    [P([-5.5, 35.8], [-2, 35], [-1, 32], [-3, 30], [-8.7, 27.7], [-13, 27.7], [-10, 30],
      [-9.8, 32], [-6.9, 34])],
    'Marokko ligt op een steenworp van Europa: bij Gibraltar is de zee maar veertien kilometer breed. De Sahara begint er in het zuiden.',
    'Morocco is a stone’s throw from Europe: at Gibraltar the sea is only fourteen kilometres wide. The Sahara begins in its south.',
    '#c07a3a'),
  world('algerije', 'Algerije', 'Algeria', 'Algiers', 'Algiers', 'af',
    [P([-2, 35], [3, 37], [8, 37], [8, 33], [10, 31], [12, 24], [4, 19], [1, 21], [-5, 23],
      [-8.7, 27.7], [-3, 30], [-1, 32])],
    'Algerije is het grootste land van Afrika, en tachtig procent ervan is Sahara.',
    'Algeria is the largest country in Africa, and eighty per cent of it is Sahara.',
    '#8ab06a'),
  world('nigeria', 'Nigeria', 'Nigeria', 'Abuja', 'Abuja', 'af',
    [P([2.7, 12.5], [8, 13.5], [13, 13.5], [14.5, 12.5], [13, 10], [12, 7], [9, 5], [8, 4.5],
      [5, 5.5], [3, 6.5], [2.7, 9])],
    'Nigeria heeft de meeste inwoners van Afrika: meer dan tweehonderd miljoen mensen, die samen ruim vijfhonderd talen spreken.',
    'Nigeria has more people than any other African country: over two hundred million, between them speaking more than five hundred languages.',
    '#5e9e6a'),
  world('ethiopie', 'Ethiopië', 'Ethiopia', 'Addis Abeba', 'Addis Ababa', 'af',
    [P([33, 14], [38, 15], [40, 14.5], [43, 11], [45, 8], [42, 4], [38, 3.5], [35, 5], [33, 8],
      [34, 11])],
    'Ethiopië is het enige land van Afrika dat nooit gekoloniseerd is. De koffieplant komt er vandaan.',
    'Ethiopia is the only country in Africa never to have been colonised. The coffee plant comes from there.',
    '#c46a4a'),
  world('kenia', 'Kenia', 'Kenya', 'Nairobi', 'Nairobi', 'af',
    [P([34, 4.5], [36, 4.5], [39, 3.5], [41, 4], [41, -1], [40, -3], [38, -3.5], [37, -2],
      [34, -1], [34, 1])],
    'In Kenia lopen de grote kuddes van de savanne: elk jaar trekken meer dan een miljoen gnoes over de vlakte, achter de regen aan.',
    'The great herds of the savannah are in Kenya: over a million wildebeest cross the plain every year, following the rain.',
    '#d8a84a'),
  world('congo', 'Congo', 'DR Congo', 'Kinshasa', 'Kinshasa', 'af',
    [P([12.5, -5], [16, -5], [18, -8], [22, -11], [27, -12], [29, -9], [30, -4], [29, -1],
      [27, 3], [22, 4], [18, 4], [16, 2], [13, -1], [12.2, -4.5])],
    'Door Congo stroomt de Kongorivier, de diepste rivier ter wereld. Het regenwoud eromheen is na de Amazone het grootste dat er is.',
    'The Congo river runs through it, the deepest river in the world. The rainforest around it is the largest after the Amazon.',
    '#4f9455'),
  world('zuidafrika', 'Zuid-Afrika', 'South Africa', 'Pretoria', 'Pretoria', 'af',
    [P([17, -29], [20, -25], [25, -26], [29, -23], [31, -23], [32, -26], [30, -31], [27, -33],
      [22, -34], [18, -34], [17, -32])],
    'Zuid-Afrika heeft twaalf officiële talen, waaronder het Afrikaans, dat uit het Nederlands is gegroeid.',
    'South Africa has twelve official languages, one of them Afrikaans, which grew out of Dutch.',
    '#d8a13a'),
  world('madagaskar', 'Madagaskar', 'Madagascar', 'Antananarivo', 'Antananarivo', 'af',
    [P([49.5, -12.5], [50.5, -15], [50, -18], [48.5, -22], [47, -25], [45, -25], [43.5, -22],
      [43.5, -18], [46, -15], [48, -13])],
    'Madagaskar ligt al meer dan tachtig miljoen jaar los van al het andere land. Negen van de tien dieren die er leven, bestaan nergens anders - zoals de maki.',
    'Madagascar has been cut off from every other piece of land for more than eighty million years. Nine in ten of the animals there live nowhere else - the lemur, for one.',
    '#8ac46a'),
  world('saoediarabie', 'Saoedi-Arabië', 'Saudi Arabia', 'Riyad', 'Riyadh', 'as',
    [P([34.5, 28], [37, 31], [39, 32], [42, 31], [47, 30], [48, 28], [50, 25], [52, 23],
      [55, 22], [55, 20], [52, 19], [47, 17], [43, 17], [42, 19], [39, 21], [37, 25])],
    'Saoedi-Arabië is bijna helemaal woestijn en heeft geen enkele rivier die het hele jaar stroomt. Onder het zand zit olie.',
    'Saudi Arabia is almost entirely desert and has not one river that runs all year. Under the sand lies oil.',
    '#d8b53a'),
  world('iran', 'Iran', 'Iran', 'Teheran', 'Tehran', 'as',
    [P([44, 39], [48, 38], [53, 37], [58, 38], [61, 36], [61, 31], [62, 29], [59, 25], [55, 26],
      [50, 30], [48, 30], [46, 33], [44, 37])],
    'Iran heette vroeger Perzië. Het land ligt hoog en heeft bergen aan de randen en woestijn in het midden.',
    'Iran was once called Persia. The land lies high, with mountains round the edges and desert in the middle.',
    '#8ab06a'),
  world('kazachstan', 'Kazachstan', 'Kazakhstan', 'Astana', 'Astana', 'as',
    [P([47, 50], [52, 51], [60, 52], [70, 55], [76, 54], [80, 51], [85, 49], [81, 45], [76, 43],
      [70, 43], [65, 43], [58, 45], [52, 45], [50, 44], [47, 45])],
    'Kazachstan is het grootste land ter wereld zonder zee. De Aralmeer, dat er lag, is bijna helemaal opgedroogd.',
    'Kazakhstan is the largest landlocked country in the world. The Aral Sea, which lay there, has almost completely dried up.',
    '#c4b86a'),
  world('mongolie', 'Mongolië', 'Mongolia', 'Ulaanbaatar', 'Ulaanbaatar', 'as',
    [P([88, 49], [95, 50], [102, 51], [108, 49], [115, 50], [120, 50], [119, 46], [112, 44],
      [105, 42], [97, 43], [91, 46])],
    'In Mongolië wonen maar twee mensen per vierkante kilometer: nergens ter wereld zijn er minder. Veel families trekken rond met hun kudde.',
    'Only two people per square kilometre live in Mongolia: nowhere in the world is emptier. Many families still move about with their herds.',
    '#c46a5a'),
  world('thailand', 'Thailand', 'Thailand', 'Bangkok', 'Bangkok', 'as',
    [P([98, 19], [100, 20], [103, 18], [105, 15], [103, 14], [102, 13], [100, 13], [100, 10],
      [101, 7], [100, 6], [98, 8], [99, 12], [98, 16])],
    'Thailand is het enige land van Zuidoost-Azië dat nooit een kolonie is geweest. De naam betekent land van de vrijen.',
    'Thailand is the only country in Southeast Asia never to have been a colony. The name means land of the free.',
    '#d8a84a'),
  world('vietnam', 'Vietnam', 'Vietnam', 'Hanoi', 'Hanoi', 'as',
    [P([102, 22], [105, 23], [108, 21], [107, 18], [109, 15], [109, 12], [107, 10], [105, 9],
      [105, 11], [106, 15], [104, 18], [103, 20])],
    'Vietnam is lang en smal en ligt langs de zee. In het zuiden stroomt de Mekong de zee in, door een delta vol rijstvelden.',
    'Vietnam is long and narrow and lies along the sea. In the south the Mekong reaches the sea through a delta full of rice fields.',
    '#5e9e6a'),
  world('filipijnen', 'Filipijnen', 'Philippines', 'Manilla', 'Manila', 'as',
    [P([120, 18], [122, 18], [124, 13], [126, 10], [126, 7], [124, 6], [122, 7], [121, 12],
      [120, 14])],
    'De Filipijnen bestaan uit ruim zevenduizend eilanden. Er komen elk jaar ongeveer twintig tyfoons overheen.',
    'The Philippines is made of over seven thousand islands. About twenty typhoons pass over it every year.',
    '#6ab8a8'),
  world('pakistan', 'Pakistan', 'Pakistan', 'Islamabad', 'Islamabad', 'as',
    [P([61, 25], [66, 25], [68, 24], [71, 24], [74, 32], [77, 35], [75, 37], [71, 36], [69, 32],
      [66, 30], [62, 29])],
    'In Pakistan staat de K2, na de Mount Everest de hoogste berg ter wereld, en de moeilijkste om te beklimmen.',
    'K2 stands in Pakistan: after Everest the highest mountain in the world, and the hardest to climb.',
    '#8ab06a'),
  world('bangladesh', 'Bangladesh', 'Bangladesh', 'Dhaka', 'Dhaka', 'as',
    [P([88.5, 25], [89.5, 26], [92, 25], [92.5, 22], [91, 21.5], [89, 22], [88.5, 23])],
    'Bangladesh ligt bijna helemaal in de delta van twee grote rivieren, en overstroomt elk jaar. Er wonen heel veel mensen op weinig land.',
    'Bangladesh lies almost entirely in the delta of two great rivers, and floods every year. A great many people live on very little land.',
    '#4f9455'),
  world('groenland', 'Groenland', 'Greenland', 'Nuuk', 'Nuuk', 'na',
    [P([-45, 83], [-25, 82], [-20, 76], [-22, 70], [-38, 66], [-43, 60], [-52, 64], [-55, 69],
      [-60, 76], [-58, 80])],
    'Groenland is het grootste eiland ter wereld en ligt voor tachtig procent onder het ijs. Het hoort bij Denemarken en bij Noord-Amerika.',
    'Greenland is the largest island in the world, eighty per cent of it under ice. It belongs to Denmark, and to North America.',
    '#a8d8e8'),
  world('nederland_w', 'Nederland', 'The Netherlands', 'Amsterdam', 'Amsterdam', 'eu',
    ringsOf('nederland'),
    'Vanaf de wereldkaart is Nederland een vlekje aan de Noordzee. Toch komt er na de Verenigde Staten het meeste voedsel vandaan.',
    'On a world map the Netherlands is a speck on the North Sea. Even so, only the United States sells more food abroad.',
    '#e6772f'),
  world('duitsland_w', 'Duitsland', 'Germany', 'Berlijn', 'Berlin', 'eu', ringsOf('duitsland'),
    'Duitsland is het grootste land van de Europese Unie, en het buurland van Nederland in het oosten.',
    'Germany is the largest country in the European Union, and the Netherlands’ neighbour to the east.',
    '#c06a4a'),
  world('frankrijk_w', 'Frankrijk', 'France', 'Parijs', 'Paris', 'eu', ringsOf('frankrijk'),
    'Frankrijk krijgt meer bezoekers uit het buitenland dan welk land ook ter wereld.',
    'France gets more visitors from abroad than any other country in the world.',
    '#5e9e6a'),
  world('spanje_w', 'Spanje', 'Spain', 'Madrid', 'Madrid', 'eu', ringsOf('spanje'),
    'Spanje ligt aan de Middellandse Zee en aan de Atlantische Oceaan tegelijk. Het Spaans wordt door bijna een half miljard mensen gesproken.',
    'Spain lies on the Mediterranean and the Atlantic at once. Spanish is spoken by nearly half a billion people.',
    '#d8a13a'),
  world('italie_w', 'Italië', 'Italy', 'Rome', 'Rome', 'eu', ringsOf('italie'),
    'Italië is de laars van Europa. De Vesuvius bij Napels bedolf in het jaar 79 de stad Pompeii onder de as.',
    'Italy is the boot of Europe. Vesuvius, near Naples, buried the town of Pompeii under ash in the year 79.',
    '#4f9fa8'),
  world('verenigdkoninkrijk_w', 'Verenigd Koninkrijk', 'United Kingdom', 'Londen', 'London', 'eu',
    ringsOf('verenigdkoninkrijk'),
    'Het Verenigd Koninkrijk is een eiland voor de kust van Europa, en had ooit het grootste rijk ter wereld.',
    'The United Kingdom is an island off the coast of Europe, and once held the largest empire in the world.',
    '#8f7ab8'),
  world('turkije_w', 'Turkije', 'Turkey', 'Ankara', 'Ankara', 'as', ringsOf('turkije'),
    'Turkije ligt half in Europa en half in Azië, en is daarmee het land waar de twee werelddelen elkaar raken.',
    'Turkey lies half in Europe and half in Asia, so it is the country where the two continents touch.',
    '#c46a4a'),
];

// ---------------------------------------------------------------- 9. vlaggen

/** The flags this game draws, each to a country that is already in the atlas. */
export const FLAG_COUNTRIES: string[] = [
  'nederland', 'belgie', 'duitsland', 'frankrijk', 'italie', 'ierland', 'polen', 'oostenrijk',
  'zwitserland', 'zweden', 'noorwegen', 'denemarken', 'finland', 'ijsland', 'spanje',
  'oekraine', 'roemenie', 'hongarije',
];

// ---------------------------------------------------------------- looking things up

/** Every feature in the atlas, by id. */
export const ALL_FEATURES: Feature[] = [
  ...PROVINCES, ...NL_WATERS, ...NL_CITIES, ...NEIGHBOURS, ...EU_COUNTRIES, ...CONTINENTS,
  ...OCEANS, ...WORLD_COUNTRIES,
];

export const featureById = (id: string): Feature | undefined => ALL_FEATURES.find(f => f.id === id);

/** The name in whichever language is set. */
export const nameOf = (f: { nl: string; en: string }, nl: boolean): string => (nl ? f.nl : f.en);
export const factOf = (f: Feature, nl: boolean): string => (nl ? f.factNl : f.factEn);
export const capitalOf = (f: Feature, nl: boolean): string => (nl ? f.capNl : f.capEn) ?? '';

/**
 * A point that is really inside a shape, and as far from its edges as the shape allows.
 *
 * The middle-of-the-area is no good here. Norway is a crescent and its area centroid lands in
 * Sweden; the Netherlands' would land in the Ijsselmeer if the country were drawn hollow. And
 * this point is not decoration: it is where a piece flies home to and where its name is written,
 * so a point outside the shape would send a piece to the wrong country in front of the child.
 *
 * So: sample the bounding box, keep what is inside, and take whichever sample sits furthest from
 * any edge - then do it again on a finer grid around the winner. That is a pole of
 * inaccessibility, roughly, which is exactly what a label wants.
 */
export function innerPoint(rings: readonly Ring[]): Pt {
  const closed = rings.map(r => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])
    ? [...r, r[0]] : r) as Ring);
  const clearance = (p: Pt): number => Math.min(...closed.map(r => distanceToPath(p, r)));
  const b = bounds(rings);
  let best: Pt = centroid(rings);
  let bestD = pointInRings(best, rings) ? clearance(best) : -1;
  const scan = (lon0: number, lat0: number, lon1: number, lat1: number, n: number): void => {
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const p: Pt = [lon0 + ((lon1 - lon0) * i) / n, lat0 + ((lat1 - lat0) * j) / n];
        if (!pointInRings(p, rings)) continue;
        const d = clearance(p);
        if (d > bestD) { bestD = d; best = p; }
      }
    }
  };
  scan(b.lon0, b.lat0, b.lon1, b.lat1, 26);
  if (bestD > 0) {
    const rx = (b.lon1 - b.lon0) / 26, ry = (b.lat1 - b.lat0) / 26;
    scan(best[0] - rx, best[1] - ry, best[0] + rx, best[1] + ry, 8);
  }
  return best;
}

const anchors = new WeakMap<object, Pt>();

/**
 * Where a feature sits on the globe: a spot for a city, the middle of a line for a river, and for
 * a shape the point above. Worked out once per feature and then remembered, because it is asked
 * for every frame.
 */
export function anchorOf(f: Feature): Pt {
  if (f.at) return f.at;
  if (f.rings?.length) {
    const had = anchors.get(f);
    if (had) return had;
    const p = innerPoint(f.rings);
    anchors.set(f, p);
    return p;
  }
  if (f.path?.length) return f.path[Math.floor(f.path.length / 2)];
  return [0, 0];
}

/**
 * How far a drop was from this feature, in degrees, with nought meaning dead on.
 *
 * An area is nought anywhere inside it and its distance from the coast outside it, so a piece let
 * go just off the shore of the right country still counts as aimed at it - and a piece let go
 * squarely inside the wrong country does not, however close the right one was. A city is a spot
 * and a river is a line, and both are simply measured to.
 *
 * The longitudes are squashed by 0.62 before measuring, the way they are on the map, so "near" is
 * the same number of millimetres under the finger in both directions.
 */
export function missDistance(f: Feature, p: Pt): number {
  if (f.rings?.length) {
    if (pointInRings(p, f.rings)) return 0;
    let best = Infinity;
    for (const r of f.rings) {
      const closed: Ring = r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])
        ? [...r, r[0]] : r;
      best = Math.min(best, distanceToPath(p, closed));
    }
    return best;
  }
  if (f.at) return Math.hypot((p[0] - f.at[0]) * 0.62, p[1] - f.at[1]);
  if (f.path?.length) return distanceToPath(p, f.path);
  return Infinity;
}

/** Did a drop land on this feature at all, before anything nearer is taken into account? */
export function hits(f: Feature, p: Pt, near: number): boolean {
  return missDistance(f, p) <= near;
}

/** How wide a shape is, in the degrees a map of it would actually be drawn in. */
export function spanOf(f: Feature, kx: number): number {
  if (!f.rings?.length) return Infinity;
  const b = bounds(f.rings);
  return Math.max((b.lon1 - b.lon0) * kx, b.lat1 - b.lat0);
}
