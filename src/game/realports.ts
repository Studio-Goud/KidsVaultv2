import { add, dist, fromAngle, mul, type Vec } from '../util/math';
import { AirportBuilder, type Airport, type ApronArea, type Building, type BuildingKind, type Gate, type GateClass } from './airport';
import type { IslandDef, LevelDef, RunwayDef, TimeOfDay } from './types';
import type { WeatherProfile } from './weather';

/**
 * Hand-built layouts of real airports. Coordinates are normalised (x of the map width, y of the map
 * height) and headings are compass degrees in the landing direction, so `18` really lands southbound.
 * Runway lengths are the real ones divided by ten, the scale the rest of the game already uses.
 */

export interface RealRunway { id: string; x: number; y: number; hdg: number; len: number; kind?: 'long' | 'short' | 'water' | 'helipad'; from?: number }
export interface RealTerminal { x: number; y: number; rot: number; w: number; gates: number; kind?: BuildingKind; label?: string; heavy?: boolean }
export interface RealLandmark { kind: 'city' | 'mountain' | 'ridge' | 'village' | 'lighthouse' | 'castle' | 'windmill' | 'forest' | 'beach'; x: number; y: number; w?: number; h?: number; rot?: number }

export interface RealPort {
  id: string; icao: string; iata: string; name: string; city: string; country: string;
  nl: string; en: string;            // one-line character of the field
  base: 'land' | 'sea';
  ground: 'polder' | 'grass' | 'rock' | 'desert' | 'tropic' | 'urban';
  water?: Array<Array<[number, number]>>;   // lakes / bays / rivers when base is land
  land?: Array<Array<[number, number]>>;    // islands / coast when base is sea
  runways: RealRunway[];
  terminals: RealTerminal[];
  landmarks: RealLandmark[];
  fleet: Array<{ type: string; weight: number }>;
  time: TimeOfDay;
  weather: WeatherProfile;
  wind: { kmh: number; gust: number; dirDeg: number; wander: number } | null;
  goal: number;
  /** how many runways are in use per difficulty step (1 = easiest) */
  openRunways: number[];
  seed: number;
  clouds: number;
  stars?: number;      // 1..3 difficulty for the card
  unlockAt: number;    // stars you need before this field opens
}

const JETS = [{ type: 'a320', weight: 3 }, { type: 'b737', weight: 3 }, { type: 'a321', weight: 2 }, { type: 'e195', weight: 2 }, { type: 'crj900', weight: 1 }];
const HEAVIES = [{ type: 'b787', weight: 2 }, { type: 'a350', weight: 2 }, { type: 'b777', weight: 2 }, { type: 'a330', weight: 2 }, { type: 'b747', weight: 1 }];
const REGIONAL = [{ type: 'atr72', weight: 2 }, { type: 'q400', weight: 2 }, { type: 'e175', weight: 2 }];
const LIGHT = [{ type: 'c172', weight: 2 }, { type: 'pa28', weight: 1 }, { type: 'sr22', weight: 1 }, { type: 'kingair', weight: 1 }];

export const REAL_PORTS: RealPort[] = [
  {
    id: 'eham', icao: 'EHAM', iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Nederland',
    nl: 'Vijf grote banen in de polder plus de korte Oostbaan; de Polderbaan ligt kilometers van de terminal.',
    en: 'Five main runways in the polder plus the short Oostbaan; the Polderbaan sits miles from the terminal.',
    base: 'land', ground: 'polder',
    water: [
      [[0.0, 0.355], [0.20, 0.35], [0.20, 0.383], [0.0, 0.39]],
      [[0.78, 0.82], [1.0, 0.80], [1.0, 0.95], [0.76, 0.97], [0.70, 0.89]],
      [[0.0, 0.70], [0.11, 0.685], [0.13, 0.745], [0.0, 0.76]],
    ],
    runways: [
      { id: '18R', x: 0.10, y: 0.035, hdg: 180, len: 380 },             // Polderbaan
      { id: '18C', x: 0.27, y: 0.115, hdg: 180, len: 330, from: 0 },    // Zwanenburgbaan
      { id: '24', x: 0.94, y: 0.085, hdg: 240, len: 350, from: 1 },     // Kaagbaan
      { id: '18L', x: 0.76, y: 0.545, hdg: 180, len: 340, from: 1 },    // Aalsmeerbaan
      { id: '27', x: 0.98, y: 0.285, hdg: 270, len: 345, from: 2 },     // Buitenveldertbaan
      { id: '22', x: 0.88, y: 0.365, hdg: 220, len: 201, kind: 'short', from: 3 }, // Oostbaan: alleen klein verkeer
    ],
    terminals: [
      { x: 0.42, y: 0.50, rot: 0, w: 150, gates: 7, label: 'D', heavy: true },
      { x: 0.42, y: 0.63, rot: 0, w: 130, gates: 6, label: 'E' },
      { x: 0.56, y: 0.565, rot: 90, w: 110, gates: 4, kind: 'satellite', label: 'H' },
    ],
    landmarks: [
      { kind: 'city', x: 0.76, y: 0.93, w: 0.4, h: 0.10 },
      { kind: 'village', x: 0.16, y: 0.80 }, { kind: 'village', x: 0.90, y: 0.70 },
      { kind: 'windmill', x: 0.06, y: 0.55 }, { kind: 'windmill', x: 0.10, y: 0.60 },
      { kind: 'forest', x: 0.26, y: 0.93, w: 0.3, h: 0.10 },
    ],
    fleet: [...JETS, ...HEAVIES, ...REGIONAL.slice(0, 2), { type: 'b747', weight: 2 }, { type: 'a380', weight: 1 }],
    time: 'morning', weather: 'breezy', wind: { kmh: 18, gust: 8, dirDeg: 210, wander: 18 },
    goal: 16, openRunways: [2, 3, 4, 6], seed: 1001, clouds: 6, stars: 3, unlockAt: 58,
  },
  {
    id: 'egll', icao: 'EGLL', iata: 'LHR', name: 'Heathrow', city: 'Londen', country: 'Verenigd Koninkrijk',
    nl: 'Twee parallelle banen, non-stop vol, terminals er middenin.',
    en: 'Two parallel runways, relentlessly busy, terminals in between.',
    base: 'land', ground: 'urban',
    water: [[[0.0, 0.88], [1.0, 0.82], [1.0, 0.90], [0.0, 0.96]]],
    runways: [
      { id: '27R', x: 0.94, y: 0.30, hdg: 270, len: 390 },
      { id: '27L', x: 0.94, y: 0.62, hdg: 270, len: 370, from: 0 },
    ],
    terminals: [
      { x: 0.46, y: 0.42, rot: 0, w: 140, gates: 6, label: 'T2', heavy: true },
      { x: 0.46, y: 0.52, rot: 0, w: 140, gates: 6, label: 'T3', heavy: true },
      { x: 0.76, y: 0.47, rot: 90, w: 120, gates: 4, kind: 'satellite', label: 'T5' },
    ],
    landmarks: [
      { kind: 'city', x: 0.5, y: 0.08, w: 0.9, h: 0.14 },
      { kind: 'city', x: 0.5, y: 0.76, w: 0.9, h: 0.10 },
      { kind: 'city', x: 0.12, y: 0.47, w: 0.2, h: 0.2 },
    ],
    fleet: [...HEAVIES, ...JETS, { type: 'a380', weight: 2 }, { type: 'b747', weight: 2 }],
    time: 'golden', weather: 'showers', wind: { kmh: 22, gust: 10, dirDeg: 260, wander: 14 },
    goal: 18, openRunways: [1, 2, 2, 2], seed: 1002, clouds: 8, stars: 3, unlockAt: 94,
  },
  {
    id: 'kjfk', icao: 'KJFK', iata: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'Verenigde Staten',
    nl: 'Vier banen die elkaar kruisen, met de baai er omheen.',
    en: 'Four runways crossing each other, wrapped by the bay.',
    base: 'sea', ground: 'grass',
    land: [[[0.02, 0.06], [0.98, 0.06], [0.98, 0.72], [0.62, 0.80], [0.28, 0.78], [0.02, 0.66]]],
    runways: [
      { id: '13L', x: 0.06, y: 0.16, hdg: 130, len: 330 },
      { id: '04L', x: 0.10, y: 0.40, hdg: 40, len: 330, from: 1 },
      { id: '13R', x: 0.22, y: 0.09, hdg: 130, len: 310, from: 2 },
      { id: '04R', x: 0.30, y: 0.475, hdg: 40, len: 320, from: 3 },
    ],
    terminals: [
      { x: 0.46, y: 0.62, rot: 130, w: 130, gates: 6, label: '4', heavy: true },
      { x: 0.62, y: 0.70, rot: 130, w: 120, gates: 5, label: '8' },
      { x: 0.30, y: 0.66, rot: 40, w: 100, gates: 4, kind: 'satellite', label: '1' },
    ],
    landmarks: [
      { kind: 'city', x: 0.5, y: 0.94, w: 0.6, h: 0.08 },
      { kind: 'beach', x: 0.5, y: 0.76, w: 0.7, h: 0.025 },
    ],
    fleet: [...HEAVIES, ...JETS, { type: 'b747', weight: 2 }, { type: 'e175', weight: 2 }, { type: 'crj900', weight: 2 }],
    time: 'dusk', weather: 'front', wind: { kmh: 20, gust: 12, dirDeg: 300, wander: 25 },
    goal: 18, openRunways: [2, 2, 3, 4], seed: 1003, clouds: 6, stars: 3, unlockAt: 118,
  },
  {
    id: 'lowi', icao: 'LOWI', iata: 'INN', name: 'Innsbruck', city: 'Innsbruck', country: 'Oostenrijk',
    nl: 'Eén baan in een dal, bergen aan weerszijden en valwinden.',
    en: 'A single runway in a valley, mountains on both sides and downdrafts.',
    base: 'land', ground: 'grass',
    water: [[[0.0, 0.615], [1.0, 0.60], [1.0, 0.635], [0.0, 0.65]]],
    runways: [{ id: '26', x: 0.90, y: 0.52, hdg: 260, len: 200 }],
    terminals: [{ x: 0.42, y: 0.42, rot: 0, w: 96, gates: 4, label: 'T' }],
    landmarks: [
      { kind: 'ridge', x: 0.5, y: 0.13, w: 1.1, h: 0.22 },
      { kind: 'ridge', x: 0.5, y: 0.86, w: 1.1, h: 0.22 },
      { kind: 'mountain', x: 0.18, y: 0.10 }, { kind: 'mountain', x: 0.62, y: 0.07 },
      { kind: 'mountain', x: 0.30, y: 0.92 }, { kind: 'mountain', x: 0.78, y: 0.90 },
      { kind: 'village', x: 0.20, y: 0.70 }, { kind: 'village', x: 0.72, y: 0.72 },
      { kind: 'city', x: 0.30, y: 0.56, w: 0.24, h: 0.06 },
    ],
    fleet: [...REGIONAL, { type: 'a320', weight: 3 }, { type: 'b737', weight: 2 }, { type: 'e195', weight: 2 }, { type: 'citation', weight: 1 }, { type: 'g650', weight: 1 }],
    time: 'morning', weather: 'gusty', wind: { kmh: 26, gust: 16, dirDeg: 260, wander: 30 },
    goal: 12, openRunways: [1, 1, 1, 1], seed: 1004, clouds: 7, stars: 3, unlockAt: 26,
  },
  {
    id: 'lpma', icao: 'LPMA', iata: 'FNC', name: 'Cristiano Ronaldo', city: 'Madeira', country: 'Portugal',
    nl: 'De baan ligt op pilaren boven zee, met wind van de kliffen.',
    en: 'The runway stands on pillars above the sea, with wind off the cliffs.',
    base: 'sea', ground: 'rock',
    land: [[[0.0, 0.52], [0.30, 0.50], [0.58, 0.545], [0.86, 0.58], [1.0, 0.62], [1.0, 1.0], [0.0, 1.0]]],
    runways: [{ id: '05', x: 0.10, y: 0.60, hdg: 50, len: 280 }],
    terminals: [{ x: 0.30, y: 0.72, rot: 50, w: 92, gates: 4, label: 'T' }],
    landmarks: [
      { kind: 'ridge', x: 0.5, y: 0.93, w: 1.2, h: 0.20 },
      { kind: 'mountain', x: 0.22, y: 0.88 }, { kind: 'mountain', x: 0.70, y: 0.92 },
      { kind: 'village', x: 0.74, y: 0.72 }, { kind: 'village', x: 0.16, y: 0.78 },
      { kind: 'lighthouse', x: 0.93, y: 0.40 },
    ],
    fleet: [{ type: 'a320', weight: 3 }, { type: 'b737', weight: 3 }, { type: 'a321', weight: 2 }, { type: 'e195', weight: 2 }, ...REGIONAL.slice(0, 2)],
    time: 'golden', weather: 'gusty', wind: { kmh: 30, gust: 18, dirDeg: 90, wander: 34 },
    goal: 10, openRunways: [1, 1, 1, 1], seed: 1005, clouds: 5, stars: 3, unlockAt: 36,
  },
  {
    id: 'lxgb', icao: 'LXGB', iata: 'GIB', name: 'Gibraltar', city: 'Gibraltar', country: 'Gibraltar',
    nl: 'Een baan dwars door de doorgaande weg, in de luwte van de Rots.',
    en: 'A runway straight across the main road, in the lee of the Rock.',
    base: 'sea', ground: 'rock',
    land: [[[0.30, 0.34], [0.78, 0.30], [0.90, 0.40], [0.92, 0.86], [0.56, 0.96], [0.34, 0.80]]],
    runways: [{ id: '09', x: 0.06, y: 0.44, hdg: 90, len: 180 }],
    terminals: [{ x: 0.62, y: 0.55, rot: 90, w: 80, gates: 3, label: 'T' }],
    landmarks: [
      { kind: 'ridge', x: 0.74, y: 0.66, w: 0.34, h: 0.36, rot: 10 },
      { kind: 'mountain', x: 0.74, y: 0.60 },
      { kind: 'city', x: 0.56, y: 0.78, w: 0.26, h: 0.14 },
      { kind: 'lighthouse', x: 0.66, y: 0.93 },
    ],
    fleet: [{ type: 'a320', weight: 3 }, { type: 'b737', weight: 3 }, { type: 'e195', weight: 1 }, { type: 'citation', weight: 1 }],
    time: 'golden', weather: 'gusty', wind: { kmh: 28, gust: 20, dirDeg: 180, wander: 40 },
    goal: 9, openRunways: [1, 1, 1, 1], seed: 1006, clouds: 5, stars: 3, unlockAt: 46,
  },
  {
    id: 'tncm', icao: 'TNCM', iata: 'SXM', name: 'Princess Juliana', city: 'Sint Maarten', country: 'Koninkrijk der Nederlanden',
    nl: 'De aanvliegroute scheert over Maho Beach heen.',
    en: 'The approach skims right over Maho Beach.',
    base: 'sea', ground: 'tropic',
    land: [[[0.0, 0.42], [0.22, 0.38], [0.52, 0.40], [0.86, 0.36], [1.0, 0.40], [1.0, 1.0], [0.0, 1.0]]],
    water: [[[0.18, 0.62], [0.52, 0.60], [0.60, 0.74], [0.30, 0.82], [0.14, 0.74]]],
    runways: [{ id: '10', x: 0.06, y: 0.475, hdg: 100, len: 230 }],
    terminals: [{ x: 0.60, y: 0.53, rot: 100, w: 86, gates: 4, label: 'T' }],
    landmarks: [
      { kind: 'beach', x: 0.20, y: 0.425, w: 0.3, h: 0.02 },
      { kind: 'village', x: 0.78, y: 0.60 }, { kind: 'village', x: 0.40, y: 0.90 },
      { kind: 'mountain', x: 0.86, y: 0.82 },
      { kind: 'lighthouse', x: 0.06, y: 0.30 },
    ],
    fleet: [{ type: 'b737', weight: 2 }, { type: 'a320', weight: 2 }, ...REGIONAL, { type: 'dhc6', weight: 2 }, { type: 'b747', weight: 1 }, { type: 'b787', weight: 1 }],
    time: 'golden', weather: 'showers', wind: { kmh: 20, gust: 9, dirDeg: 100, wander: 16 },
    goal: 12, openRunways: [1, 1, 1, 1], seed: 1007, clouds: 6, stars: 2, unlockAt: 8,
  },
  {
    id: 'vhhx', icao: 'VHHX', iata: 'HKG', name: 'Kai Tak', city: 'Hongkong', country: 'China',
    nl: 'De beruchte bocht bij het schaakbord, laag over de daken.',
    en: 'The notorious checkerboard turn, low over the rooftops.',
    base: 'sea', ground: 'urban',
    land: [
      [[0.0, 0.0], [1.0, 0.0], [1.0, 0.36], [0.62, 0.42], [0.20, 0.40], [0.0, 0.34]],
      [[0.34, 0.44], [0.86, 0.62], [0.92, 0.72], [0.44, 0.56]],
    ],
    runways: [{ id: '13', x: 0.36, y: 0.46, hdg: 130, len: 330 }],
    terminals: [{ x: 0.44, y: 0.40, rot: 130, w: 100, gates: 5, label: 'T', heavy: true }],
    landmarks: [
      { kind: 'city', x: 0.45, y: 0.22, w: 0.9, h: 0.26 },
      { kind: 'mountain', x: 0.12, y: 0.08 }, { kind: 'mountain', x: 0.84, y: 0.06 },
      { kind: 'city', x: 0.20, y: 0.86, w: 0.34, h: 0.16 },
    ],
    fleet: [...HEAVIES, { type: 'b747', weight: 3 }, ...JETS.slice(0, 3)],
    time: 'dusk', weather: 'front', wind: { kmh: 24, gust: 14, dirDeg: 120, wander: 28 },
    goal: 12, openRunways: [1, 1, 1, 1], seed: 1008, clouds: 7, stars: 3, unlockAt: 106,
  },
  {
    id: 'omdb', icao: 'OMDB', iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'Verenigde Arabische Emiraten',
    nl: 'Twee lange parallelbanen in de woestijn, vol met widebodies.',
    en: 'Two long parallels in the desert, packed with widebodies.',
    base: 'land', ground: 'desert',
    runways: [
      { id: '30R', x: 0.92, y: 0.26, hdg: 300, len: 420 },
      { id: '30L', x: 0.92, y: 0.62, hdg: 300, len: 430, from: 0 },
    ],
    terminals: [
      { x: 0.46, y: 0.40, rot: 300, w: 150, gates: 7, label: '3', heavy: true },
      { x: 0.46, y: 0.52, rot: 300, w: 130, gates: 6, label: '1', heavy: true },
    ],
    landmarks: [
      { kind: 'city', x: 0.22, y: 0.14, w: 0.4, h: 0.12 },
      { kind: 'city', x: 0.72, y: 0.88, w: 0.4, h: 0.10 },
    ],
    fleet: [{ type: 'a380', weight: 3 }, { type: 'b777', weight: 3 }, ...HEAVIES, { type: 'a320', weight: 1 }, { type: 'b737', weight: 1 }],
    time: 'night', weather: 'heat', wind: { kmh: 14, gust: 7, dirDeg: 300, wander: 12 },
    goal: 20, openRunways: [1, 2, 2, 2], seed: 1009, clouds: 3, stars: 2, unlockAt: 70,
  },
  {
    id: 'wsss', icao: 'WSSS', iata: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore',
    nl: 'Drie banen aan zee, met tropische buien in de middag.',
    en: 'Three runways by the sea, with tropical showers in the afternoon.',
    base: 'sea', ground: 'tropic',
    land: [[[0.0, 0.10], [1.0, 0.06], [1.0, 0.94], [0.0, 0.92]]],
    runways: [
      { id: '20C', x: 0.28, y: 0.12, hdg: 200, len: 400 },
      { id: '20R', x: 0.60, y: 0.14, hdg: 200, len: 400, from: 1 },
      { id: '20L', x: 0.88, y: 0.16, hdg: 200, len: 275, from: 2 },
    ],
    terminals: [
      { x: 0.42, y: 0.52, rot: 200, w: 140, gates: 6, label: '3', heavy: true },
      { x: 0.55, y: 0.66, rot: 200, w: 120, gates: 5, label: '1' },
    ],
    landmarks: [
      { kind: 'beach', x: 0.5, y: 0.955, w: 0.9, h: 0.02 },
      { kind: 'city', x: 0.18, y: 0.80, w: 0.3, h: 0.12 },
      { kind: 'forest', x: 0.80, y: 0.80, w: 0.3, h: 0.16 },
    ],
    fleet: [...HEAVIES, { type: 'a380', weight: 2 }, { type: 'b747', weight: 1 }, ...JETS.slice(0, 3), { type: 'atr72', weight: 1 }],
    time: 'golden', weather: 'storm', wind: { kmh: 16, gust: 12, dirDeg: 200, wander: 24 },
    goal: 18, openRunways: [1, 2, 2, 3], seed: 1010, clouds: 8, stars: 2, unlockAt: 82,
  },
  {
    id: 'egpr', icao: 'EGPR', iata: 'BRR', name: 'Barra', city: 'Isle of Barra', country: 'Schotland',
    nl: 'Landen op het strand, tussen twee getijden door.',
    en: 'Landing on the beach, between two tides.',
    base: 'sea', ground: 'grass',
    land: [[[0.10, 0.50], [0.52, 0.44], [0.90, 0.52], [0.96, 0.84], [0.50, 0.96], [0.12, 0.86]]],
    runways: [
      { id: '07', x: 0.18, y: 0.66, hdg: 70, len: 150, kind: 'short' },
      { id: '15', x: 0.30, y: 0.54, hdg: 150, len: 130, kind: 'short', from: 2 },
    ],
    terminals: [{ x: 0.60, y: 0.74, rot: 70, w: 64, gates: 2, label: 'T' }],
    landmarks: [
      { kind: 'beach', x: 0.34, y: 0.62, w: 0.34, h: 0.10, rot: 20 },
      { kind: 'village', x: 0.74, y: 0.84 }, { kind: 'lighthouse', x: 0.92, y: 0.33 },
      { kind: 'mountain', x: 0.78, y: 0.62 },
    ],
    fleet: [{ type: 'dhc6', weight: 3 }, { type: 'c208', weight: 2 }, { type: 'pc12', weight: 2 }, ...LIGHT],
    time: 'dusk', weather: 'fog', wind: { kmh: 22, gust: 12, dirDeg: 70, wander: 30 },
    goal: 8, openRunways: [1, 1, 2, 2], seed: 1011, clouds: 6, stars: 2, unlockAt: 16,
  },
  {
    id: 'vnlk', icao: 'VNLK', iata: 'LUA', name: 'Lukla', city: 'Tenzing-Hillary', country: 'Nepal',
    nl: 'Vijfhonderd meter tegen de berg op, geen tweede kans.',
    en: 'Five hundred metres uphill against the mountain, no second chance.',
    base: 'land', ground: 'rock',
    runways: [
      { id: '06', x: 0.22, y: 0.62, hdg: 60, len: 90, kind: 'short' },
      { id: 'H', x: 0.60, y: 0.80, hdg: 60, len: 1, kind: 'helipad' },
    ],
    terminals: [{ x: 0.46, y: 0.72, rot: 60, w: 56, gates: 2, label: 'T' }],
    landmarks: [
      { kind: 'ridge', x: 0.5, y: 0.12, w: 1.2, h: 0.26 },
      { kind: 'mountain', x: 0.22, y: 0.12 }, { kind: 'mountain', x: 0.56, y: 0.06 }, { kind: 'mountain', x: 0.86, y: 0.14 },
      { kind: 'ridge', x: 0.5, y: 0.94, w: 1.2, h: 0.22 },
      { kind: 'village', x: 0.66, y: 0.56 }, { kind: 'forest', x: 0.18, y: 0.84, w: 0.3, h: 0.14 },
    ],
    fleet: [{ type: 'dhc6', weight: 4 }, { type: 'c208', weight: 3 }, { type: 'h135', weight: 1 }, { type: 'aw139', weight: 1 }],
    time: 'morning', weather: 'fog', wind: { kmh: 18, gust: 14, dirDeg: 60, wander: 36 },
    goal: 8, openRunways: [1, 1, 1, 1], seed: 1012, clouds: 7, stars: 3, unlockAt: 130,
  },
];

export const realPortById = (id: string): RealPort | undefined => REAL_PORTS.find(p => p.id === id);
/** The fields in the order you unlock them. */
export const PORTS_IN_ORDER: RealPort[] = [...REAL_PORTS].sort((a, b) => a.unlockAt - b.unlockAt);

/** Compass degrees (landing direction) to the screen angle used by the simulation. */
export const hdgToRad = (deg: number): number => ((deg - 90) * Math.PI) / 180;

/**
 * Slides a runway along its own axis (and shortens it if it really has to) until the touchdown gate,
 * the final approach and the far end all sit inside the playable map.
 */
function fitRunway(r: RealRunway, W: number, H: number): { x: number; y: number; len: number } {
  const rad = hdgToRad(r.hdg);
  const dir = { x: Math.cos(rad), y: Math.sin(rad) };
  const th0 = { x: r.x * W, y: r.y * H };
  const GATE = 70, FINAL = 230;
  const clampRange = (base: number, d: number, lo: number, hi: number): [number, number] | null => {
    if (Math.abs(d) < 1e-6) return base >= lo && base <= hi ? [-1e9, 1e9] : null;
    const a = (lo - base) / d, b = (hi - base) / d;
    return d > 0 ? [a, b] : [b, a];
  };
  for (const len of [r.len, r.len * 0.9, r.len * 0.8, r.len * 0.7, r.len * 0.6]) {
    const want: Array<[number, number, number, number, number]> = [
      // base value, direction component, offset along dir, lo, hi
      [th0.x, dir.x, -GATE, 58, W - 58], [th0.y, dir.y, -GATE, 80, H - 80],
      [th0.x, dir.x, len, 26, W - 26], [th0.y, dir.y, len, 26, H - 26],
      [th0.x, dir.x, -FINAL, -70, W + 70], [th0.y, dir.y, -FINAL, -150, H + 150],
    ];
    let lo = -1e9, hi = 1e9, ok = true;
    for (const [base, d, off, l, h] of want) {
      const rng = clampRange(base + d * off, d, l, h);
      if (!rng) { ok = false; break; }
      lo = Math.max(lo, rng[0]); hi = Math.min(hi, rng[1]);
    }
    if (!ok || lo > hi) continue;
    const delta = Math.abs(lo) < Math.abs(hi) ? Math.max(lo, Math.min(hi, 0)) : Math.max(lo, Math.min(hi, 0));
    const th = { x: th0.x + dir.x * delta, y: th0.y + dir.y * delta };
    return { x: th.x / W, y: th.y / H, len };
  }
  return { x: r.x, y: r.y, len: r.len };
}

export function realRunwayDefs(port: RealPort, step: number, W = 739, H = 1600): RunwayDef[] {
  // every runway of the field is always on the map; the ones above this step are simply closed
  const anyOpen = port.runways.some(r => (r.from ?? 0) <= step);
  return port.runways.map((r, i) => {
    const kind = r.kind ?? 'long';
    if (kind === 'helipad' || kind === 'water') {
      return { id: r.id, kind, x: r.x, y: r.y, heading: hdgToRad(r.hdg), length: r.len, closed: false };
    }
    const fit = fitRunway(r, W, H);
    const open = anyOpen ? (r.from ?? 0) <= step : i === 0;
    return { id: r.id, kind, x: fit.x, y: fit.y, heading: hdgToRad(r.hdg), length: fit.len, closed: !open };
  });
}

/** How many runways are in use at a difficulty step. */
export const runwaysAt = (port: RealPort, step: number): number => Math.max(1, port.runways.filter(r => (r.from ?? 0) <= step).length);

// ---------- taxi network ----------

interface RwInfo { id: string; threshold: Vec; dir: Vec; heading: number; length: number; width: number }

/**
 * Builds one airport serving every runway: a parallel taxiway per runway, a lane in front of every
 * terminal, and straight links tying it all together.
 */
export function buildRealAirport(port: RealPort, runways: RwInfo[], W: number, H: number, tier: number): Airport {
  const b = new AirportBuilder();
  const P = (nx: number, ny: number): Vec => ({ x: nx * W, y: ny * H });
  const gates: Gate[] = [];
  const buildings: Building[] = [];
  const aprons: ApronArea[] = [];
  const exits: Airport['exits'] = {};
  const holds: Airport['holds'] = {};
  const lineUp: Airport['lineUp'] = {};
  const departRunways: string[] = [];

  // terminal lanes and stands
  const laneNodes: number[] = [];
  let gateId = 1;
  const terminalCentre = { x: 0, y: 0 };
  for (const t of port.terminals) {
    const pos = P(t.x, t.y);
    terminalCentre.x += pos.x / port.terminals.length;
    terminalCentre.y += pos.y / port.terminals.length;
  }
  for (const t of port.terminals) {
    const pos = P(t.x, t.y);
    const rot = hdgToRad(t.rot);
    const alongDir = fromAngle(rot);                       // terminal face runs this way
    const outDir = { x: -alongDir.y, y: alongDir.x };      // apron side
    // face the apron away from the middle of the field so stands never point into a building
    const flip = (pos.x - terminalCentre.x) * outDir.x + (pos.y - terminalCentre.y) * outDir.y > 0 ? -1 : 1;
    const out = mul(outDir, flip);
    const half = t.w / 2;
    const laneOffset = 78;
    const lanePts: Vec[] = [];
    const n = t.gates;
    for (let i = 0; i < n; i++) {
      const u = -half + (t.w * i) / Math.max(1, n - 1);
      const standPos = add(add(pos, mul(alongDir, u)), mul(out, 30));
      const lanePos = add(add(pos, mul(alongDir, u)), mul(out, laneOffset));
      lanePts.push(lanePos);
      const node = b.node(lanePos);
      const cls: GateClass = t.heavy && (i === 0 || i === n - 1) ? 'heavy' : 'gate';
      gates.push({ id: gateId, label: `${t.label ?? ''}${gateId}`, pos: standPos, heading: Math.atan2(out.y, out.x), cls, occupiedBy: null, node, bridge: true });
      gateId++;
    }
    const laneIds = b.chain(lanePts, 'lane');
    laneNodes.push(laneIds[Math.floor(laneIds.length / 2)]);
    // apron polygon in front of the terminal
    const a0 = add(add(pos, mul(alongDir, -half - 22)), mul(out, 4));
    const a1 = add(add(pos, mul(alongDir, half + 22)), mul(out, 4));
    const a2 = add(a1, mul(out, laneOffset + 36));
    const a3 = add(a0, mul(out, laneOffset + 36));
    aprons.push({ kind: 'stand', poly: [a0, a1, a2, a3] });
    buildings.push({ kind: t.kind ?? 'terminal', pos: add(pos, mul(out, -16)), w: t.w + 34, h: 46, rot });
    if (t.kind !== 'satellite') buildings.push({ kind: 'carpark', pos: add(pos, mul(out, -80)), w: t.w * 0.8, h: 52, rot });
  }
  // link the terminal lanes to each other
  for (let i = 1; i < laneNodes.length; i++) b.link(laneNodes[i - 1], laneNodes[i], 'taxi');

  // one GA / cargo apron near the first terminal
  if (port.terminals.length) {
    const t0 = port.terminals[0];
    const base = P(t0.x, t0.y);
    const rot = hdgToRad(t0.rot);
    const alongDir = fromAngle(rot);
    const gaPos = add(base, mul(alongDir, -(t0.w / 2 + 110)));
    const gaNode = b.node(gaPos);
    b.link(gaNode, laneNodes[0], 'taxi');
    const perp = { x: -alongDir.y, y: alongDir.x };
    aprons.push({ kind: 'ga', poly: [add(gaPos, mul(perp, -46)), add(add(gaPos, mul(alongDir, -60)), mul(perp, -46)), add(add(gaPos, mul(alongDir, -60)), mul(perp, 46)), add(gaPos, mul(perp, 46))] });
    for (let i = 0; i < 4; i++) {
      const gp = add(add(gaPos, mul(alongDir, -16 - (i % 2) * 30)), mul(perp, i < 2 ? -24 : 24));
      gates.push({ id: 200 + i, label: 'GA', pos: gp, heading: rot, cls: 'ga', occupiedBy: null, node: gaNode, bridge: false });
    }
    buildings.push({ kind: 'hangar', pos: add(add(gaPos, mul(alongDir, -34)), mul(perp, 78)), w: 60, h: 42, rot });
    buildings.push({ kind: 'cargo', pos: add(add(gaPos, mul(alongDir, -20)), mul(perp, -84)), w: 74, h: 42, rot });
    buildings.push({ kind: 'tower', pos: add(base, mul(perp, 66)), w: 24, h: 24, rot });
    buildings.push({ kind: 'fuel', pos: add(add(gaPos, mul(alongDir, -70)), mul(perp, 40)), w: 44, h: 40, rot });
  }

  // a parallel taxiway per runway plus links into the terminal lanes
  for (const rw of runways) {
    const perp = { x: -rw.dir.y, y: rw.dir.x };
    const toTerminal = Math.sign((terminalCentre.x - rw.threshold.x) * perp.x + (terminalCentre.y - rw.threshold.y) * perp.y) || 1;
    const off = (rw.width / 2 + 60) * toTerminal;
    const At = (along: number, across = 0): Vec => add(add(rw.threshold, mul(rw.dir, along)), mul(perp, off + across));
    const exitAlongs = [rw.length * 0.32, rw.length * 0.58, rw.length * 0.84];
    const spine = b.chain([At(-50), ...exitAlongs.map(a => At(a)), At(rw.length + 30)], 'taxi');
    exits[rw.id] = [];
    for (const a of exitAlongs) {
      const on = b.node(add(rw.threshold, mul(rw.dir, a)), rw.id);
      const offN = b.node(At(a));
      b.link(on, offN, 'taxi');
      exits[rw.id].push({ along: a, on, off: offN });
    }
    // holding point and line-up
    const hold = b.node(At(-50));
    const lu = add(rw.threshold, mul(rw.dir, 10));
    b.link(hold, b.node(lu, rw.id), 'taxi');
    holds[rw.id] = hold;
    lineUp[rw.id] = lu;
    departRunways.push(rw.id);
    // connect the spine to the nearest terminal lane node
    let bestLane = laneNodes[0], bestNode = spine[0], bestD = Infinity;
    for (const s of spine) for (const l of laneNodes) {
      const d = dist(b.nodes[s], b.nodes[l]);
      if (d < bestD) { bestD = d; bestNode = s; bestLane = l; }
    }
    if (bestLane !== undefined) b.link(bestNode, bestLane, 'taxi');
  }

  const all = [...b.nodes, ...gates.map(g => g.pos)];
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const fx0 = Math.min(...xs), fx1 = Math.max(...xs), fy0 = Math.min(...ys), fy1 = Math.max(...ys);
  const laneLoop = gates.filter(g => g.bridge).slice(0, 4).map(g => b.nodes[g.node]);

  return {
    id: port.id,
    nodes: b.nodes, edges: b.edges, adj: b.adjacency(), nodeRunway: b.nodeRunway,
    gates, buildings, aprons,
    vehicles: laneLoop.length >= 3
      ? [{ path: laneLoop, speed: 10, phase: 0, kind: 'tug' }, { path: laneLoop.slice().reverse(), speed: 8, phase: 0.5, kind: 'bus' }]
      : [],
    exits, holds, lineUp, departRunways,
    footprint: { x: (fx0 + fx1) / 2, y: (fy0 + fy1) / 2, w: fx1 - fx0 + 120, h: fy1 - fy0 + 120, rot: 0 },
    roadAnchor: terminalCentre,
    compact: false,
  };
  void tier;
}

/** Turn a real port into a playable level at one of four difficulty steps. */
export function realLevel(port: RealPort, step: number, nl: boolean, W = 739, H = 1600): LevelDef & { port: RealPort; step: number } {
  const open = runwaysAt(port, step);
  const goal = Math.round(port.goal * (0.7 + step * 0.12));
  const style: IslandDef['style'] = port.ground === 'grass' ? 'meadow' : port.ground;
  const decor = port.landmarks.map(l => ({ kind: l.kind, x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot }));
  // the whole map is land unless the port lists explicit coastlines
  const shapes: Array<Array<[number, number]>> = port.base === 'land'
    ? [[[-0.45, -0.25], [1.45, -0.25], [1.45, 1.25], [-0.45, 1.25]]]
    : (port.land ?? []);
  const islands = shapes.map((poly, i) => ({
    cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, seed: port.seed + i, style,
    poly, decor: i === 0 ? decor : [],
  }));
  return {
    id: `real:${port.id}:${step}`,
    // a real airport is called the same thing in both languages
    name: `${port.name} ${step + 1}`,
    nameEn: `${port.name} ${step + 1}`,
    subtitle: nl ? port.nl : port.en,
    subtitleEn: port.en,
    time: port.time,
    goal,
    seed: port.seed,
    islands,
    water: port.water,
    ground: port.ground,
    runways: realRunwayDefs(port, step, W, H),
    planes: port.fleet,
    spawn: {
      first: 1.2,
      base: Math.max(6, 15 - step * 1.4 - (open - 1) * 1.2),
      min: Math.max(3.6, 6.5 - step * 0.5),
      step: 0.55,
      maxConcurrent: 2 + open,
      maxConcurrentEnd: 3 + open + step,
    },
    wind: port.wind,
    clouds: port.clouds,
    port, step,
  };
}
