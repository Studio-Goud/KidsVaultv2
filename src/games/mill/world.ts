/**
 * The valley of Millstream: the ground, the water on top of it, and what the water has to reach.
 *
 * The land is a height field. Water sits on top of it as a depth per cell, and every step it moves
 * towards whichever neighbour has the lowest total height, ground plus water together. That one
 * rule gives you streams that find their own way down, pools that fill up and spill over the low
 * side, and channels that keep flowing as long as they stay downhill. Nothing about it is scripted.
 *
 * The player changes the land, not the water. Dragging a finger takes a little earth away, and the
 * water works out the rest. That is the whole game: you are not steering the stream, you are
 * deciding where downhill is.
 */

import { makeRng, ValueNoise } from '../../util/rng';

export type Cell = 'plain' | 'rock' | 'field' | 'house' | 'wheel' | 'sea';

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  seed: number;
  /** how much earth you may move, in stroke units */
  spade: number;
  /** how long the spring runs, in seconds */
  springFor: number;
  /** water per second out of each spring */
  springRate: number;
  /** where the springs sit, as fractions of the grid */
  springs: Array<[number, number]>;
  /** fields that need watering, and how much each one takes */
  fields: Array<{ x: number; y: number; need: number }>;
  /** mill wheels, and how many seconds of steady flow they need */
  wheels: Array<{ x: number; y: number; need: number }>;
  /** houses that must stay dry */
  houses: Array<[number, number]>;
  /** how strongly the valley tilts from the spring side to the far side */
  tilt: number;
  /** how broken up the land is */
  rough: number;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  {
    id: 'firstfurrow', name: 'The first furrow', nameNl: 'De eerste voor',
    seed: 11, spade: 130, springFor: 30, springRate: 2.6,
    springs: [[0.5, 0.06]],
    fields: [{ x: 0.5, y: 0.72, need: 26 }],
    wheels: [], houses: [],
    tilt: 0.55, rough: 0.25,
    hint: 'Drag from the spring towards the field. Water always runs downhill.',
    hintNl: 'Sleep van de bron naar de akker. Water loopt altijd naar beneden.',
  },
  {
    id: 'twofields', name: 'Two fields', nameNl: 'Twee akkers',
    seed: 23, spade: 170, springFor: 36, springRate: 2.8,
    springs: [[0.5, 0.06]],
    fields: [{ x: 0.26, y: 0.66, need: 22 }, { x: 0.74, y: 0.66, need: 22 }],
    wheels: [], houses: [],
    tilt: 0.5, rough: 0.35,
    hint: 'One stream can be split. Dig the fork high up, not low down.',
    hintNl: 'Een stroom kun je splitsen. Graaf de splitsing hoog, niet laag.',
  },
  {
    id: 'firstwheel', name: 'The first wheel', nameNl: 'Het eerste rad',
    seed: 37, spade: 180, springFor: 42, springRate: 3.0,
    springs: [[0.32, 0.06]],
    fields: [{ x: 0.74, y: 0.74, need: 20 }],
    wheels: [{ x: 0.5, y: 0.44, need: 7 }],
    houses: [],
    tilt: 0.6, rough: 0.4,
    hint: 'A wheel needs water passing through it, not standing in it.',
    hintNl: 'Een rad heeft water nodig dat erdoor stroomt, niet dat stilstaat.',
  },
  {
    id: 'drystreet', name: 'The dry street', nameNl: 'De droge straat',
    seed: 51, spade: 180, springFor: 40, springRate: 3.0,
    springs: [[0.5, 0.06]],
    fields: [{ x: 0.2, y: 0.78, need: 20 }, { x: 0.8, y: 0.78, need: 20 }],
    wheels: [],
    houses: [[0.5, 0.62], [0.44, 0.66], [0.56, 0.66]],
    tilt: 0.5, rough: 0.45,
    hint: 'Keep the water away from the houses. A ridge is easier than a dam.',
    hintNl: 'Houd het water bij de huizen weg. Een rug is makkelijker dan een dam.',
  },
  {
    id: 'twosprings', name: 'Two springs', nameNl: 'Twee bronnen',
    seed: 67, spade: 200, springFor: 44, springRate: 2.4,
    springs: [[0.2, 0.06], [0.8, 0.06]],
    fields: [{ x: 0.5, y: 0.8, need: 34 }],
    wheels: [{ x: 0.5, y: 0.5, need: 8 }],
    houses: [[0.22, 0.72]],
    tilt: 0.55, rough: 0.5,
    hint: 'Two small streams joined make one that turns a wheel.',
    hintNl: 'Twee kleine stromen samen maken er een die een rad laat draaien.',
  },
  {
    id: 'highfield', name: 'The high field', nameNl: 'De hoge akker',
    seed: 83, spade: 220, springFor: 48, springRate: 3.2,
    springs: [[0.5, 0.05]],
    fields: [{ x: 0.18, y: 0.5, need: 18 }, { x: 0.82, y: 0.62, need: 22 }],
    wheels: [{ x: 0.5, y: 0.34, need: 9 }],
    houses: [[0.5, 0.78], [0.58, 0.82]],
    tilt: 0.45, rough: 0.6,
    hint: 'You cannot lift water. Reach the high field early, while you are still above it.',
    hintNl: 'Water optillen kan niet. Doe de hoge akker vroeg, zolang je er nog boven zit.',
  },
  {
    id: 'twowheels', name: 'Two wheels', nameNl: 'Twee raderen',
    seed: 97, spade: 230, springFor: 52, springRate: 3.4,
    springs: [[0.3, 0.05], [0.7, 0.05]],
    fields: [{ x: 0.5, y: 0.84, need: 30 }],
    wheels: [{ x: 0.3, y: 0.42, need: 9 }, { x: 0.7, y: 0.42, need: 9 }],
    houses: [[0.5, 0.66]],
    tilt: 0.5, rough: 0.6,
    hint: 'Both wheels at once, or one after the other. You choose.',
    hintNl: 'Allebei de raderen tegelijk, of na elkaar. Jij kiest.',
  },
  {
    id: 'lastdrop', name: 'The last drop', nameNl: 'De laatste druppel',
    seed: 113, spade: 210, springFor: 46, springRate: 3.0,
    springs: [[0.5, 0.05]],
    fields: [{ x: 0.16, y: 0.56, need: 18 }, { x: 0.84, y: 0.56, need: 18 }, { x: 0.5, y: 0.86, need: 24 }],
    wheels: [{ x: 0.5, y: 0.36, need: 10 }],
    houses: [[0.3, 0.74], [0.7, 0.74]],
    tilt: 0.5, rough: 0.7,
    hint: 'Everything, with barely enough. Waste nothing over the edge.',
    hintNl: 'Alles, met net te weinig. Laat niets over de rand weglopen.',
  },
];

export const COLS = 44;
export const ROWS = 62;

/**
 * A valley shaped to the screen it is played on.
 *
 * The grid used to be a fixed 44 by 62, which on a tall phone left a band of empty sky above and
 * below the land. Everything in a level is placed in fractions of the grid, so the grid itself can
 * take the shape of the window and the valley fills it edge to edge.
 */
export function gridForAspect(aspect: number): { cols: number; rows: number } {
  const rows = ROWS;
  const cols = Math.max(26, Math.min(120, Math.round(rows * aspect)));
  return { cols, rows };
}

export interface Valley {
  cols: number;
  rows: number;
  /** ground height, 0 low to 1 high */
  ground: Float32Array;
  /** how much ground was there before anyone dug */
  original: Float32Array;
  /** water depth on top of the ground */
  water: Float32Array;
  /** what each cell is */
  kind: Uint8Array;
  /** how much water each field has taken */
  filled: number[];
  /** how long each wheel has been turning */
  turned: number[];
  /** how wet each house has got */
  wet: number[];
  fieldAt: Int16Array;
  wheelAt: Int16Array;
  houseAt: Int16Array;
}

export const KINDS: Cell[] = ['plain', 'rock', 'field', 'house', 'wheel', 'sea'];
export const kindOf = (v: Valley, i: number): Cell => KINDS[v.kind[i]];
const kindIndex = (c: Cell): number => KINDS.indexOf(c);

const idx = (v: { cols: number }, x: number, y: number): number => y * v.cols + x;

/** Lay out a valley: a slope from the springs, ridges across it, and the places that matter. */
export function buildValley(level: Level, size?: { cols: number; rows: number }): Valley {
  const cols = size?.cols ?? COLS, rows = size?.rows ?? ROWS, n = cols * rows;
  const ground = new Float32Array(n);
  const kind = new Uint8Array(n);
  const noise = new ValueNoise(level.seed);
  const rng = makeRng(level.seed * 31 + 5);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ny = y / (rows - 1);
      // the valley falls away from the spring end, with ridges and hollows laid over it
      const slope = (1 - ny) * level.tilt;
      const ridges = noise.fbm2(x * 0.09, y * 0.07, 4) * level.rough;
      const grain = (rng() - 0.5) * 0.012;
      ground[idx({ cols }, x, y)] = Math.max(0.02, slope + ridges * 0.55 + grain + 0.16);
    }
  }

  // the sea takes the bottom two rows: water that reaches it is water you wasted
  for (let y = rows - 2; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = idx({ cols }, x, y);
      ground[i] = 0.02;
      kind[i] = kindIndex('sea');
    }
  }

  const v: Valley = {
    cols, rows, ground, original: Float32Array.from(ground), water: new Float32Array(n), kind,
    filled: level.fields.map(() => 0),
    turned: level.wheels.map(() => 0),
    wet: level.houses.map(() => 0),
    fieldAt: new Int16Array(n).fill(-1),
    wheelAt: new Int16Array(n).fill(-1),
    houseAt: new Int16Array(n).fill(-1),
  };

  const stamp = (fx: number, fy: number, r: number, c: Cell, tag: Int16Array, which: number, flatten: number): void => {
    const cx = Math.round(fx * (cols - 1)), cy = Math.round(fy * (rows - 1));
    let sum = 0, cnt = 0;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      sum += ground[idx({ cols }, x, y)]; cnt++;
    }
    const mean = cnt ? sum / cnt : 0.3;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        if (Math.hypot(x - cx, y - cy) > r + 0.3) continue;
        const i = idx({ cols }, x, y);
        if (kindOf(v, i) === 'sea') continue;
        kind[i] = kindIndex(c);
        tag[i] = which;
        // a field is flat so water can lie on it; a house sits on its own little mound
        ground[i] = mean + flatten;
      }
    }
  };

  level.fields.forEach((f, k) => stamp(f.x, f.y, 3, 'field', v.fieldAt, k, -0.04));
  // a low bank around every field, so water that arrives has a moment to soak in instead of
  // running straight over the far side and down to the sea
  for (const f of level.fields) {
    const cx = Math.round(f.x * (cols - 1)), cy = Math.round(f.y * (rows - 1));
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < 3.3 || d > 4.6) continue;
      const i = idx({ cols }, x, y);
      if (kindOf(v, i) !== 'plain') continue;
      ground[i] += 0.045;
    }
  }
  level.wheels.forEach((w, k) => stamp(w.x, w.y, 2, 'wheel', v.wheelAt, k, -0.02));
  level.houses.forEach(([hx, hy], k) => stamp(hx, hy, 2, 'house', v.houseAt, k, 0.03));

  // a few outcrops you cannot dig through, so the valley has a shape you must respect. They stay
  // off the straight line from each spring to each target, so the obvious route is always open and
  // the rocks make you think about the second field, never about the first.
  const lines: Array<[number, number, number, number]> = [];
  for (const [sx, sy] of level.springs) {
    for (const f of level.fields) lines.push([sx * (cols - 1), sy * (rows - 1), f.x * (cols - 1), f.y * (rows - 1)]);
    for (const w of level.wheels) lines.push([sx * (cols - 1), sy * (rows - 1), w.x * (cols - 1), w.y * (rows - 1)]);
  }
  const nearLine = (px: number, py: number): boolean => lines.some(([ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) < 4.5;
  });
  const rocks = 5 + Math.round(level.rough * 8);
  for (let k = 0; k < rocks; k++) {
    const cx = Math.round(rng() * (cols - 1)), cy = Math.round(4 + rng() * (rows - 12));
    if (nearLine(cx, cy)) continue;
    const r = 1 + Math.round(rng() * 2);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const i = idx({ cols }, x, y);
      if (kindOf(v, i) !== 'plain') continue;
      kind[i] = kindIndex('rock');
      ground[i] += 0.07;
    }
  }
  v.original.set(ground);
  return v;
}

/** How much earth one stroke takes away, and what it costs. */
export const DIG_DEPTH = 0.055;
export const DIG_FLOOR = 0.03;

/** Dig at a cell position. Returns how much spade budget it used. */
export function digAt(v: Valley, cx: number, cy: number, radius: number): number {
  let used = 0;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (x < 0 || y < 0 || x >= v.cols || y >= v.rows) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > radius) continue;
      const i = idx(v, x, y);
      const k = kindOf(v, i);
      if (k === 'rock' || k === 'sea' || k === 'house') continue;
      const floor = k === 'wheel' || k === 'field' ? v.original[i] - 0.02 : DIG_FLOOR;
      if (v.ground[i] <= floor) continue;
      // the middle of the stroke bites deeper than the edge
      const bite = DIG_DEPTH * (1 - (d / radius) * 0.65);
      const before = v.ground[i];
      v.ground[i] = Math.max(floor, before - bite);
      used += (before - v.ground[i]) * 2.2;
    }
  }
  return used;
}

/** Pile earth up at a cell position to make a bank. Returns the spade budget it used. */
export function bankAt(v: Valley, cx: number, cy: number, radius: number): number {
  let used = 0;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (x < 0 || y < 0 || x >= v.cols || y >= v.rows) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > radius) continue;
      const i = idx(v, x, y);
      const k = kindOf(v, i);
      if (k !== 'plain') continue;
      const ceiling = v.original[i] + 0.14;
      if (v.ground[i] >= ceiling) continue;
      const lift = DIG_DEPTH * 0.8 * (1 - (d / radius) * 0.65);
      const before = v.ground[i];
      v.ground[i] = Math.min(ceiling, before + lift);
      // banking is slower work than digging
      used += (v.ground[i] - before) * 3.2;
    }
  }
  return used;
}

export interface StepResult { /** water that ran off into the sea this step */ wasted: number; /** total flow through wheels */ wheelFlow: number[] }

/**
 * One step of the water.
 *
 * Each cell hands part of its water to whichever neighbours stand lower, sharing it out by how much
 * lower they are. Doing it in one pass over a copy keeps it stable: nothing can give away water it
 * has already given away.
 */
export function stepWater(v: Valley, dt: number, out: Float32Array): StepResult {
  const { cols, rows, ground, water } = v;
  out.set(water);
  const wheelFlow = v.turned.map(() => 0);
  let wasted = 0;
  // water is not syrup: a good fraction of the drop moves every step
  const flow = Math.min(0.6, dt * 45);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const w = water[i];
      if (w <= 0.0006) continue;
      const here = ground[i] + w;
      let total = 0;
      const dl: number[] = [], ni: number[] = [];
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0);
        const ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        const there = ground[j] + water[j];
        const drop = here - there;
        if (drop <= 0.0005) continue;
        dl.push(drop); ni.push(j); total += drop;
      }
      if (!total) continue;
      // never give away more than half the difference, or the surface oscillates
      const give = Math.min(w, total * 0.5) * flow;
      for (let k = 0; k < ni.length; k++) {
        const part = give * (dl[k] / total);
        out[i] -= part;
        out[ni[k]] += part;
        const wi = v.wheelAt[ni[k]];
        if (wi >= 0) wheelFlow[wi] += part;
      }
    }
  }

  // fields drink, houses get wet, the sea swallows, and a film too thin to see soaks away.
  // only the film: a flat loss per cell turned every damp patch into a sponge that drained the stream.
  const film = 0.008, decay = Math.min(0.9, dt * 3);
  for (let i = 0; i < out.length; i++) {
    if (out[i] < film) out[i] -= out[i] * decay;
    if (out[i] <= 0.00005) { out[i] = 0; continue; }
    const fi = v.fieldAt[i];
    if (fi >= 0) {
      const drink = Math.min(out[i], dt * 2.2);
      out[i] -= drink;
      v.filled[fi] += drink * 3.2;
    }
    const hi = v.houseAt[i];
    if (hi >= 0 && out[i] > 0.02) v.wet[hi] += out[i] * dt * 5;
    if (kindOf(v, i) === 'sea') { wasted += out[i]; out[i] = 0; }
  }

  water.set(out);
  return { wasted, wheelFlow };
}

/** How much water is lying about, for the sound and for the water meter. */
export function totalWater(v: Valley): number {
  let s = 0;
  for (let i = 0; i < v.water.length; i++) s += v.water[i];
  return s;
}

export const fieldDone = (v: Valley, level: Level, k: number): boolean => v.filled[k] >= level.fields[k].need;
export const wheelDone = (v: Valley, level: Level, k: number): boolean => v.turned[k] >= level.wheels[k].need;
export const houseFlooded = (v: Valley, k: number): boolean => v.wet[k] >= 1;

/** Stars: everything working, then how little earth you moved and how little water you lost. */
export function starsFor(level: Level, spadeLeft: number, wasted: number, allDone: boolean): number {
  if (!allDone) return 0;
  const thrift = spadeLeft / level.spade;
  const spill = wasted / (level.springFor * level.springRate * level.springs.length);
  if (thrift > 0.32 && spill < 0.3) return 3;
  if (thrift > 0.12 && spill < 0.55) return 2;
  return 1;
}
