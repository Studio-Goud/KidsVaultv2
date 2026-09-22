/**
 * Getijdenpoel: creatures come in with the tide, and you sort them into pools. The catch is the rule.
 * First it is colour. Then, without warning, it is shape. Then how many spots. The creature in your
 * hand has not changed; what matters about it has.
 *
 * That switch is the whole point. Holding one rule in mind, then dropping it for another while the
 * old one is still pulling at you, is what the developmental literature calls cognitive flexibility,
 * and the task here is a playable cousin of the standard test for it in young children, the
 * Dimensional Change Card Sort. This game does not claim to improve that ability. It gives it a
 * workout, and it is honest about the difference.
 */

import { makeRng } from '../../util/rng';

export type Kind = 'crab' | 'fish' | 'star' | 'jelly' | 'shell';
export type Colour = 'red' | 'blue' | 'yellow' | 'green';
export type Size = 'small' | 'big';
export type Dim = 'kind' | 'colour' | 'size' | 'spots';

export const KINDS: Kind[] = ['crab', 'fish', 'star', 'jelly', 'shell'];
export const COLOURS: Colour[] = ['red', 'blue', 'yellow', 'green'];
export const COLOUR_HEX: Record<Colour, string> = { red: '#e0574a', blue: '#3f86d6', yellow: '#f0c33b', green: '#5fae6a' };

export interface Creature {
  id: number;
  kind: Kind;
  colour: Colour;
  size: Size;
  spots: 1 | 2 | 3;
  /** position in field units, 0..1 */
  x: number;
  y: number;
  /** drift per second, in field units */
  vy: number;
  wobble: number;
  held: boolean;
  /** set when dropped: where it is going and how far along it is */
  landing: { pool: number; t: number } | null;
  /** set when it reached the shore unsorted */
  gone: boolean;
}

export interface Rule {
  dim: Dim;
  /** one value per pool, in pool order */
  values: string[];
}

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  pools: number;
  /** which dimensions the rule may take in this level */
  dims: Dim[];
  /** how many creatures come in altogether */
  count: number;
  /** how many may be on the water at once */
  atOnce: number;
  /** creatures between rule changes; 0 means the rule never changes */
  switchEvery: number;
  /** field units per second */
  drift: number;
  /** seconds between arrivals */
  every: number;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  { id: 'colours', name: 'By colour', nameNl: 'Op kleur', pools: 2, dims: ['colour'], count: 12, atOnce: 1, switchEvery: 0, drift: 0.045, every: 2.6,
    hint: 'Each colour has its own pool. Drag every creature to the pool that matches it.', hintNl: 'Elke kleur heeft zijn eigen poel. Sleep elk dier naar de poel die erbij past.' },
  { id: 'shapes', name: 'By shape', nameNl: 'Op vorm', pools: 2, dims: ['kind'], count: 12, atOnce: 1, switchEvery: 0, drift: 0.05, every: 2.4,
    hint: 'Now the colour does not matter. Look at what it is.', hintNl: 'Nu doet de kleur er niet toe. Kijk wat het is.' },
  { id: 'firstswitch', name: 'The first switch', nameNl: 'De eerste wissel', pools: 2, dims: ['colour', 'kind'], count: 16, atOnce: 1, switchEvery: 6, drift: 0.05, every: 2.3,
    hint: 'Watch the sign. When it changes, the pools mean something else.', hintNl: 'Let op het bord. Als dat verandert, betekenen de poelen iets anders.' },
  { id: 'threepools', name: 'Three pools', nameNl: 'Drie poelen', pools: 3, dims: ['colour', 'kind'], count: 18, atOnce: 2, switchEvery: 6, drift: 0.055, every: 2.0,
    hint: 'Three pools now, and two creatures on the water at once.', hintNl: 'Drie poelen nu, en twee dieren tegelijk op het water.' },
  { id: 'bigsmall', name: 'Big and small', nameNl: 'Groot en klein', pools: 2, dims: ['size', 'colour', 'kind'], count: 18, atOnce: 2, switchEvery: 5, drift: 0.06, every: 1.9,
    hint: 'A new rule: size. The big ones go one way, the small ones the other.', hintNl: 'Een nieuwe regel: grootte. De grote de ene kant op, de kleine de andere.' },
  { id: 'spots', name: 'Count the spots', nameNl: 'Tel de stippen', pools: 3, dims: ['spots', 'colour', 'kind'], count: 20, atOnce: 2, switchEvery: 5, drift: 0.06, every: 1.8,
    hint: 'One, two or three spots. Count before you drag.', hintNl: 'Een, twee of drie stippen. Tel voordat je sleept.' },
  { id: 'fastwater', name: 'Fast water', nameNl: 'Snel water', pools: 3, dims: ['colour', 'kind', 'size', 'spots'], count: 24, atOnce: 3, switchEvery: 4, drift: 0.075, every: 1.5,
    hint: 'Everything at once, and the tide is quicker.', hintNl: 'Alles tegelijk, en het tij is sneller.' },
  { id: 'springtide', name: 'Spring tide', nameNl: 'Springtij', pools: 4, dims: ['colour', 'kind', 'size', 'spots'], count: 28, atOnce: 3, switchEvery: 4, drift: 0.085, every: 1.35,
    hint: 'Four pools. The rule changes often. Breathe, look at the sign, then move.', hintNl: 'Vier poelen. De regel wisselt vaak. Adem, kijk naar het bord, dan pas slepen.' },
];

/** The values a dimension can take, in the order pools are labelled. */
export function valuesOf(dim: Dim): string[] {
  if (dim === 'kind') return KINDS;
  if (dim === 'colour') return COLOURS;
  if (dim === 'size') return ['small', 'big'];
  return ['1', '2', '3'];
}

export function valueOf(c: Creature, dim: Dim): string {
  if (dim === 'kind') return c.kind;
  if (dim === 'colour') return c.colour;
  if (dim === 'size') return c.size;
  return String(c.spots);
}

/** A rule for `pools` pools on dimension `dim`, picking which values are in play this time. */
export function makeRule(dim: Dim, pools: number, rng: () => number): Rule {
  const all = valuesOf(dim);
  const n = Math.min(pools, all.length);
  const picked = [...all].sort(() => rng() - 0.5).slice(0, n);
  // size and spots read better in their natural order
  if (dim === 'size' || dim === 'spots') picked.sort((a, b) => all.indexOf(a) - all.indexOf(b));
  return { dim, values: picked };
}

/** Pick the next rule: a different dimension from the current one when the level allows it. */
export function nextRule(level: Level, current: Rule | null, rng: () => number): Rule {
  const options = level.dims.filter(d => !current || d !== current.dim || level.dims.length === 1);
  const dim = options[Math.floor(rng() * options.length)];
  return makeRule(dim, level.pools, rng);
}

/**
 * A creature that fits the rule, with the other dimensions chosen so that they would send it to a
 * different pool under the previous rule as often as not. That is what makes a switch bite: the old
 * habit points the wrong way.
 */
export function spawnCreature(id: number, rule: Rule, previous: Rule | null, rng: () => number): Creature {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const target = pick(rule.values);
  const c: Creature = {
    id, kind: pick(KINDS), colour: pick(COLOURS), size: rng() < 0.5 ? 'small' : 'big', spots: pick([1, 2, 3] as const),
    x: 0.15 + rng() * 0.7, y: -0.06, vy: 1, wobble: rng() * Math.PI * 2, held: false, landing: null, gone: false,
  };
  // make it belong to one of the pools under the current rule
  if (rule.dim === 'kind') c.kind = target as Kind;
  else if (rule.dim === 'colour') c.colour = target as Colour;
  else if (rule.dim === 'size') c.size = target as Size;
  else c.spots = Number(target) as 1 | 2 | 3;
  // and, half the time, make it a trap under the previous rule
  if (previous && previous.dim !== rule.dim && rng() < 0.6) {
    const wrong = previous.values.filter(v => rule.values.indexOf(v) !== previous.values.indexOf(v));
    const trap = wrong.length ? pick(wrong) : pick(previous.values);
    if (previous.dim === 'kind') c.kind = trap as Kind;
    else if (previous.dim === 'colour') c.colour = trap as Colour;
    else if (previous.dim === 'size') c.size = trap as Size;
    else c.spots = Number(trap) as 1 | 2 | 3;
  }
  return c;
}

export const poolFor = (c: Creature, rule: Rule): number => rule.values.indexOf(valueOf(c, rule.dim));

export const rngFor = (level: Level, attempt: number): (() => number) => makeRng(level.id.length * 131 + attempt * 17 + 3);

/** Stars: mostly right, and never careless. */
export function starsFor(correct: number, wrong: number, missed: number, total: number): number {
  const acc = total ? correct / total : 0;
  if (acc >= 0.92 && wrong <= 1) return 3;
  if (acc >= 0.75 && wrong <= 3) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

export function labelFor(dim: Dim, value: string, nl: boolean): string {
  const names: Record<string, [string, string]> = {
    crab: ['crab', 'krab'], fish: ['fish', 'vis'], star: ['starfish', 'zeester'], jelly: ['jellyfish', 'kwal'], shell: ['shell', 'schelp'],
    red: ['red', 'rood'], blue: ['blue', 'blauw'], yellow: ['yellow', 'geel'], green: ['green', 'groen'],
    small: ['small', 'klein'], big: ['big', 'groot'],
    '1': ['one spot', 'een stip'], '2': ['two spots', 'twee stippen'], '3': ['three spots', 'drie stippen'],
  };
  const n = names[value];
  return n ? (nl ? n[1] : n[0]) : value;
}

export function dimLabel(dim: Dim, nl: boolean): string {
  const d: Record<Dim, [string, string]> = {
    kind: ['Sort by KIND', 'Sorteer op SOORT'], colour: ['Sort by COLOUR', 'Sorteer op KLEUR'],
    size: ['Sort by SIZE', 'Sorteer op GROOTTE'], spots: ['Sort by SPOTS', 'Sorteer op STIPPEN'],
  };
  return nl ? d[dim][1] : d[dim][0];
}
