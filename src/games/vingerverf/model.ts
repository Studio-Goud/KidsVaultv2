/**
 * Vingerverf - the logic, with no browser in it.
 *
 * A sheet of paper, six pots of paint and a finger. The only rule is a physical one: a dip of
 * paint makes a stroke of a certain length, and the stroke gets thinner and drier as it runs out.
 * Nothing is lost when it does; you dip again. There is no score, no star and no saved result,
 * and that is a decision (CLAUDE.md rule 2: every session ends, nothing is chased).
 *
 * The one piece of real work is the mixing. Paint is subtractive: yellow over blue is green, not
 * grey, which is what a child expects from a paint box and what an RGB average gets wrong. So
 * `mix` works on reflectance as a weighted geometric mean per channel, the cheapest honest
 * approximation of how pigments absorb light (a Kubelka-Munk mix collapses to this when both paints
 * scatter equally). It is an approximation, not a colour-science claim, and it is chosen
 * because the six pots give the results a paint box gives: see the checks in tests/run.mjs.
 *
 * Every number below says where it comes from. All of them are product decisions, tuned by eye,
 * because nobody has measured how long a toddler wants a dip of paint to last.
 */

export type Rgb = readonly [number, number, number];

export interface Pot { id: string; rgb: Rgb; nl: string; en: string }

/** The six pots, in the order they stand. Product decision: the paint-box six. */
export const POTS: readonly Pot[] = [
  { id: 'red', rgb: [220, 38, 45], nl: 'rood', en: 'red' },
  { id: 'yellow', rgb: [250, 214, 35], nl: 'geel', en: 'yellow' },
  { id: 'blue', rgb: [30, 90, 200], nl: 'blauw', en: 'blue' },
  { id: 'white', rgb: [255, 255, 255], nl: 'wit', en: 'white' },
  { id: 'black', rgb: [28, 28, 32], nl: 'zwart', en: 'black' },
  { id: 'green', rgb: [40, 150, 70], nl: 'groen', en: 'green' },
];

/** The shape for two and three (`src/platform/who.ts`): the three primaries, and bigger pots. */
export const SIMPLE_POT_IDS = ['red', 'yellow', 'blue'] as const;

export function potsFor(simple: boolean): Pot[] {
  return POTS.filter(p => !simple || (SIMPLE_POT_IDS as readonly string[]).includes(p.id));
}

export const potById = (id: string): Pot | undefined => POTS.find(p => p.id === id);

/** The paper. Warm, so that white paint can be seen on it. Product decision. */
export const PAPER: Rgb = [247, 241, 228];

// ---------------------------------------------------------------- mixing

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
// a channel of zero would pull the geometric mean to zero whatever it is mixed with
const FLOOR = 0.02;

/**
 * Mix paint `b` into paint `a`: amount 0 is all `a`, 1 is all `b`, 0.5 is half and half.
 * Weighted geometric mean of each channel (reflectance), rounded to whole numbers.
 */
export function mix(a: Rgb, b: Rgb, amount: number): [number, number, number] {
  const t = clamp01(amount);
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const x = Math.max(FLOOR, a[i] / 255), y = Math.max(FLOOR, b[i] / 255);
    out[i] = Math.round(255 * Math.exp((1 - t) * Math.log(x) + t * Math.log(y)));
  }
  return out;
}

/** How much of the paint that was already on the paper a wet crossing keeps. Product decision. */
export const MIX_KEEP = 0.5;

/** How long a stroke stays wet enough to mix, in seconds. Product decision, by eye. */
export const WET_SECS = 7;

/** The last part of that time in which the mixing fades out rather than stopping dead. */
export const WET_FADE = 2;

/** How wet a stroke laid at `laidAt` still is at `now`: 1 fully, 0 dry. */
export function wetness(laidAt: number, now: number): number {
  return clamp01((laidAt + WET_SECS - now) / WET_FADE);
}

/** The colour a wet crossing gives: `fresh` laid over `under`, where `wet` is 0..1 how wet it is. */
export function crossing(under: Rgb, fresh: Rgb, wet: number): [number, number, number] {
  return mix(under, fresh, 1 - MIX_KEEP * clamp01(wet));
}

// ---------------------------------------------------------------- naming

export interface ColourName { id: string; nl: string; en: string }

export function toHsl(c: Rgb): { h: number; s: number; l: number } {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (mx === r) h = ((g - b) / d + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const BASES: Array<[string, string, string]> = [
  ['red', 'rood', 'red'], ['orange', 'oranje', 'orange'], ['yellow', 'geel', 'yellow'],
  ['green', 'groen', 'green'], ['blue', 'blauw', 'blue'], ['purple', 'paars', 'purple'],
];

/**
 * What a child would call a colour. Thresholds are product decisions tuned against the six pots
 * and their mixes; a name is only ever used to say a colour out loud the first time it shows up.
 */
export function colourName(c: Rgb): ColourName {
  const { h, s, l } = toHsl(c);
  if (l < 0.13) return { id: 'black', nl: 'zwart', en: 'black' };
  if (s < 0.16) {
    if (l > 0.88) return { id: 'white', nl: 'wit', en: 'white' };
    if (l < 0.2) return { id: 'black', nl: 'zwart', en: 'black' };
    return { id: 'grey', nl: 'grijs', en: 'grey' };
  }
  let base: number;
  if (h >= 345 || h < 15) base = 0;
  else if (h < 42) base = 1;
  else if (h < 70) base = 2;
  else if (h < 170) base = 3;
  else if (h < 255) base = 4;
  else base = 5;
  const [id, nl, en] = BASES[base];
  // dark orange and dark yellow are brown, and nobody calls them anything else
  if ((id === 'orange' || id === 'yellow') && l < 0.4) return { id: 'brown', nl: 'bruin', en: 'brown' };
  if (id === 'red' && l > 0.6) return { id: 'pink', nl: 'roze', en: 'pink' };
  if (id === 'purple' && l > 0.7) return { id: 'lilac', nl: 'lila', en: 'lilac' };
  if (l < 0.3 && id !== 'orange' && id !== 'yellow') return { id: `dark-${id}`, nl: `donker${nl}`, en: `dark ${en}` };
  if (l > 0.575 && id !== 'red' && id !== 'purple') return { id: `light-${id}`, nl: `licht${nl}`, en: `light ${en}` };
  return { id, nl, en };
}

/** The line Suri says the first time a colour shows up: one word. */
export function colourLine(name: ColourName, dutch: boolean): string {
  const w = dutch ? name.nl : name.en;
  return w.charAt(0).toUpperCase() + w.slice(1) + '.';
}

/** The colours seen this session, so each is said once. In memory only: nothing is saved. */
export class Seen {
  private names = new Set<string>();
  /** true the first time an id comes by */
  see(id: string): boolean {
    if (this.names.has(id)) return false;
    this.names.add(id);
    return true;
  }
  has(id: string): boolean { return this.names.has(id); }
  list(): string[] { return [...this.names]; }
  clear(): void { this.names.clear(); }
}

// ---------------------------------------------------------------- the brush

/**
 * How far one dip of paint goes, as a multiple of the longer side of the sheet. Product decision:
 * about a screen and a half for a child who reads a pot, two and a half for a child of two, for
 * whom running dry is a lot of lifting the finger for very little.
 */
export const DIP_SCREENS = { full: 1.4, simple: 2.5 } as const;

/** Paint left after the brush has travelled `dist` of a dip that lasts `capacity`. Never below 0. */
export function loadAfter(load: number, dist: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, load - Math.max(0, dist) / capacity);
}

/** The brush radius for the paint left: thinner as it runs out, never thinner than a third. */
export function radiusFor(load: number, base: number): number {
  return base * (0.34 + 0.66 * Math.sqrt(clamp01(load)));
}

/** How solid the stroke is: full while there is plenty, thinning over the last third of a dip. */
export function opacityFor(load: number): number {
  return 0.97 * (0.45 + 0.55 * clamp01(load * 3));
}

/** 0 when the brush is wet, up to 1 when it is nearly dry: how much the bristles show. */
export function drynessFor(load: number): number {
  return 1 - clamp01(load * 2.5);
}

/** Dutch and English strings that are more than one word, kept here so the voice script finds them. */
export const LINES = {
  intro: ['Tap a pot and paint with your finger.', 'Tik op een pot en verf met je vinger.'],
  pickPot: ['Pick a pot first.', 'Kies eerst een pot.'],
  empty: ['The paint has run out. Dip again.', 'De verf is op. Pak nieuwe verf.'],
  fresh: ['A fresh sheet.', 'Een schoon vel.'],
  paintFirst: ['Paint something first.', 'Verf eerst iets.'],
  done: ['Lovely. You made that.', 'Mooi. Dat heb jij gemaakt.'],
  again: ['Once more?', 'Nog een keer?'],
} as const;
