import type { LevelDef } from './types';

const S = Math.PI / 2; // landing heading: towards the bottom of the screen

export const LEVELS: LevelDef[] = [
  {
    id: 'linden', name: 'Lindeneiland', subtitle: 'Rustige ochtend, kleine toestellen', subtitleEn: 'Calm morning, small aircraft',
    time: 'morning', goal: 8, seed: 11,
    islands: [
      { cx: 0.50, cy: 0.80, rx: 0.56, ry: 0.26, seed: 101, style: 'meadow',
        decor: [ { kind: 'village', x: 0.22, y: 0.86 }, { kind: 'windmill', x: 0.86, y: 0.80 } ] },
      { cx: 0.14, cy: 0.12, rx: 0.13, ry: 0.075, seed: 102, style: 'pine',
        decor: [ { kind: 'lighthouse', x: 0.10, y: 0.10 } ] },
    ],
    runways: [ { id: 'rw1', kind: 'short', x: 0.70, y: 0.67, heading: S, length: 280 } ],
    planes: [ { type: 'c172', weight: 3 }, { type: 'dhc6', weight: 1 } ],
    spawn: { first: 1.2, base: 17, min: 8, step: 0.9, maxConcurrent: 2, maxConcurrentEnd: 3 },
    wind: null, clouds: 4,
  },
  {
    id: 'vuurtoren', name: 'Vuurtorenbaai', subtitle: 'Gouden middag, eerste turboprops', subtitleEn: 'Golden afternoon, first turboprops',
    time: 'golden', goal: 10, seed: 22,
    islands: [
      { cx: 0.58, cy: 0.82, rx: 0.58, ry: 0.24, seed: 201, style: 'meadow',
        decor: [ { kind: 'village', x: 0.36, y: 0.90 }, ] },
      { cx: 0.11, cy: 0.42, rx: 0.10, ry: 0.065, seed: 202, style: 'pine',
        decor: [ { kind: 'lighthouse', x: 0.11, y: 0.41 } ] },
      { cx: 0.86, cy: 0.10, rx: 0.10, ry: 0.06, seed: 203, style: 'tropic', decor: [] },
    ],
    runways: [ { id: 'rw1', kind: 'long', x: 0.76, y: 0.66, heading: S, length: 380 } ],
    planes: [ { type: 'c172', weight: 2 }, { type: 'dhc6', weight: 2 }, { type: 'atr72', weight: 2 }, { type: 'e195', weight: 1 } ],
    spawn: { first: 1.2, base: 15, min: 6.5, step: 0.7, maxConcurrent: 3, maxConcurrentEnd: 4 },
    wind: { kmh: 8, gust: 3, dirDeg: 120, wander: 10 }, clouds: 5,
  },
  {
    id: 'molenrif', name: 'Molenrif', subtitle: 'Stevige zijwind en straalvliegtuigen', subtitleEn: 'Stiff crosswind and jets',
    time: 'morning', goal: 12, seed: 33,
    islands: [
      { cx: 0.50, cy: 0.83, rx: 0.58, ry: 0.23, seed: 301, style: 'meadow',
        decor: [ { kind: 'windmill', x: 0.12, y: 0.80 }, { kind: 'windmill', x: 0.20, y: 0.90 }, { kind: 'windmill', x: 0.84, y: 0.84 }, { kind: 'village', x: 0.30, y: 0.92 } ] },
      { cx: 0.50, cy: 0.30, rx: 0.07, ry: 0.045, seed: 302, style: 'pine', decor: [] },
      { cx: 0.14, cy: 0.16, rx: 0.09, ry: 0.06, seed: 303, style: 'pine', decor: [ { kind: 'lighthouse', x: 0.14, y: 0.15 } ] },
    ],
    runways: [ { id: 'rw1', kind: 'long', x: 0.66, y: 0.67, heading: S, length: 380 } ],
    planes: [ { type: 'c172', weight: 1 }, { type: 'dhc6', weight: 1 }, { type: 'atr72', weight: 2 }, { type: 'e195', weight: 2 }, { type: 'a320', weight: 2 } ],
    spawn: { first: 1.2, base: 14, min: 5.5, step: 0.6, maxConcurrent: 3, maxConcurrentEnd: 5 },
    wind: { kmh: 20, gust: 10, dirDeg: 90, wander: 25 }, clouds: 7,
  },
  {
    id: 'zusters', name: 'Tweelingzusters', subtitle: 'Twee banen, de Jumbo komt eraan', subtitleEn: 'Two runways, the Jumbo arrives',
    time: 'golden', goal: 14, seed: 44,
    islands: [
      { cx: 0.20, cy: 0.76, rx: 0.26, ry: 0.26, seed: 401, style: 'pine',
        decor: [ { kind: 'village', x: 0.10, y: 0.90 }, ] },
      { cx: 0.76, cy: 0.81, rx: 0.34, ry: 0.25, seed: 402, style: 'meadow',
        decor: [ { kind: 'castle', x: 0.60, y: 0.94 } ] },
      { cx: 0.50, cy: 0.12, rx: 0.10, ry: 0.06, seed: 403, style: 'tropic', decor: [ { kind: 'lighthouse', x: 0.50, y: 0.11 } ] },
    ],
    runways: [
      { id: 'rwS', kind: 'short', x: 0.34, y: 0.62, heading: S, length: 260 },
      { id: 'rwL', kind: 'long', x: 0.80, y: 0.66, heading: S, length: 380 },
    ],
    planes: [ { type: 'c172', weight: 2 }, { type: 'dhc6', weight: 1 }, { type: 'atr72', weight: 2 }, { type: 'e195', weight: 1 }, { type: 'a320', weight: 2 }, { type: 'b747', weight: 1 } ],
    spawn: { first: 1.2, base: 13, min: 5, step: 0.55, maxConcurrent: 3, maxConcurrentEnd: 5 },
    wind: { kmh: 10, gust: 5, dirDeg: 200, wander: 15 }, clouds: 6,
  },
  {
    id: 'lagune', name: 'Zeemeerminlagune', subtitle: 'Schemering en watervliegtuigen', subtitleEn: 'Twilight and seaplanes',
    time: 'dusk', goal: 15, seed: 55,
    islands: [
      { cx: 0.66, cy: 0.84, rx: 0.48, ry: 0.22, seed: 501, style: 'tropic',
        decor: [ { kind: 'village', x: 0.40, y: 0.94 }, { kind: 'castle', x: 0.94, y: 0.92 } ] },
      { cx: 0.14, cy: 0.88, rx: 0.13, ry: 0.10, seed: 502, style: 'tropic', decor: [] },
      { cx: 0.84, cy: 0.14, rx: 0.13, ry: 0.08, seed: 503, style: 'tropic', decor: [ { kind: 'lighthouse', x: 0.84, y: 0.13 } ] },
    ],
    runways: [
      { id: 'rwL', kind: 'long', x: 0.78, y: 0.68, heading: S, length: 360 },
      { id: 'rwW', kind: 'water', x: 0.27, y: 0.58, heading: S, length: 300 },
    ],
    planes: [ { type: 'c208a', weight: 3 }, { type: 'c172', weight: 1 }, { type: 'atr72', weight: 2 }, { type: 'a320', weight: 2 }, { type: 'e195', weight: 1 } ],
    spawn: { first: 1.2, base: 12, min: 4.8, step: 0.5, maxConcurrent: 3, maxConcurrentEnd: 6 },
    wind: { kmh: 12, gust: 6, dirDeg: 45, wander: 20 }, clouds: 5,
  },
  {
    id: 'sterren', name: 'Sterrenhaven', subtitle: 'Nachtvluchten, helikopters, alles tegelijk', subtitleEn: 'Night flights, helicopters, everything at once',
    time: 'night', goal: 18, seed: 66,
    islands: [
      { cx: 0.52, cy: 0.82, rx: 0.56, ry: 0.24, seed: 601, style: 'meadow',
        decor: [ { kind: 'castle', x: 0.86, y: 0.72 }, { kind: 'village', x: 0.12, y: 0.92 }, { kind: 'windmill', x: 0.08, y: 0.78 }, ] },
      { cx: 0.84, cy: 0.20, rx: 0.22, ry: 0.13, seed: 602, style: 'pine', decor: [ { kind: 'lighthouse', x: 0.66, y: 0.16 } ] },
    ],
    runways: [
      { id: 'rwL', kind: 'long', x: 0.36, y: 0.66, heading: S, length: 380 },
      { id: 'rwS', kind: 'short', x: 0.84, y: 0.14, heading: S, length: 230 },
      { id: 'rwH', kind: 'helipad', x: 0.86, y: 0.90, heading: S, length: 1 },
    ],
    planes: [ { type: 'h135', weight: 2 }, { type: 'b747', weight: 1 }, { type: 'c172', weight: 1 }, { type: 'dhc6', weight: 1 }, { type: 'atr72', weight: 1 }, { type: 'e195', weight: 1 }, { type: 'a320', weight: 2 } ],
    spawn: { first: 1.2, base: 11, min: 4.2, step: 0.4, maxConcurrent: 4, maxConcurrentEnd: 6 },
    wind: { kmh: 16, gust: 12, dirDeg: 300, wander: 30 }, clouds: 4,
  },
];

export const levelById = (id: string): LevelDef | undefined => LEVELS.find(l => l.id === id);
