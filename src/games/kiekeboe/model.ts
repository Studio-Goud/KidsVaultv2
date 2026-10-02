/**
 * Kiekeboe: the pure rules, with no canvas and no sound, so a test can play a round.
 *
 * This is the first thing in Suri made for a two-year-old rather than simplified for one
 * (`docs/research.md` §2.1: a child of two points, does not read and cannot tell a mistake from a
 * surprise). So there is one gesture, a tap, and nothing to get wrong: a tap on a hiding place opens
 * it and an animal is there, a second tap hides it again. No score, no stars, nothing to lose.
 *
 * A round ends: every hiding place opened once, then Suri says so and offers "Nog een keer", and
 * the animals are dealt to new places. That is the whole session, which is the point of rule 2.
 *
 * For four and up there is one gentle extra, `pickTarget`: Suri asks where an animal is, and if
 * nothing happens for a few seconds the right place wiggles. Tapping any other place just shows
 * that animal; the question stays. It practises looking for a named thing among several places,
 * and nothing else. It makes no claim to measure it.
 */

import { makeRng } from '../../util/rng';

export type HideId = 'bush' | 'barrel' | 'blanket' | 'door' | 'haystack' | 'rock' | 'wave' | 'cloud';
/** the order is the spot index everywhere: in a round, in a layout, in the debug state */
export const HIDES: HideId[] = ['bush', 'barrel', 'blanket', 'door', 'haystack', 'rock', 'wave', 'cloud'];

export type AnimalId = 'cow' | 'cat' | 'dog' | 'duck' | 'sheep' | 'frog' | 'owl' | 'pig';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  nameNl: string;
  /** what Suri says when it comes out */
  line: string;
  lineNl: string;
  /** the question, for four and up */
  ask: string;
  askNl: string;
}

export const ANIMALS: AnimalInfo[] = [
  { id: 'cow', name: 'cow', nameNl: 'koe', line: 'A cow.', lineNl: 'Een koe.', ask: 'Where is the cow?', askNl: 'Waar is de koe?' },
  { id: 'cat', name: 'cat', nameNl: 'kat', line: 'A cat.', lineNl: 'Een kat.', ask: 'Where is the cat?', askNl: 'Waar is de kat?' },
  { id: 'dog', name: 'dog', nameNl: 'hond', line: 'A dog.', lineNl: 'Een hond.', ask: 'Where is the dog?', askNl: 'Waar is de hond?' },
  { id: 'duck', name: 'duck', nameNl: 'eend', line: 'A duck.', lineNl: 'Een eend.', ask: 'Where is the duck?', askNl: 'Waar is de eend?' },
  { id: 'sheep', name: 'sheep', nameNl: 'schaap', line: 'A sheep.', lineNl: 'Een schaap.', ask: 'Where is the sheep?', askNl: 'Waar is het schaap?' },
  { id: 'frog', name: 'frog', nameNl: 'kikker', line: 'A frog.', lineNl: 'Een kikker.', ask: 'Where is the frog?', askNl: 'Waar is de kikker?' },
  { id: 'owl', name: 'owl', nameNl: 'uil', line: 'An owl.', lineNl: 'Een uil.', ask: 'Where is the owl?', askNl: 'Waar is de uil?' },
  { id: 'pig', name: 'pig', nameNl: 'varken', line: 'A pig.', lineNl: 'Een varken.', ask: 'Where is the pig?', askNl: 'Waar is het varken?' },
];

export const animalInfo = (id: AnimalId): AnimalInfo => ANIMALS.find(a => a.id === id)!;

export type SceneId = 'meadow' | 'farm';
export const SCENES: Array<{ id: SceneId; name: string; nameNl: string }> = [
  { id: 'meadow', name: 'The meadow', nameNl: 'De weide' },
  { id: 'farm', name: 'The farm at night', nameNl: 'De boerderij in de nacht' },
];

// ---------------------------------------------------------------- numbers, and where each comes from

/** Product decision: how long nothing may happen before the right place wiggles. Long enough that a
 *  child who is still looking is not hurried, short enough that one who is stuck is not left. */
export const WIGGLE_AFTER = 5;
/** Product decision: a breath after an animal has been named before the next question, so the
 *  name and the question are never spoken over each other. */
export const NEXT_QUESTION_AFTER = 2.6;
/** Product decision: how long the last animal stays on screen before the round is closed. */
export const DONE_AFTER = 2.6;
/** Product decision: the question is for four and up (`SIMPLE_UPTO` in who.ts is 3). With no child
 *  filled in, the whole game is shown, as in every other game. */
export const ASK_FROM_YEARS = 4;

export const asksWhere = (years: number | null): boolean => years === null || years >= ASK_FROM_YEARS;

// ---------------------------------------------------------------- layout

export interface Pos { x: number; y: number }

/**
 * Where each hiding place sits, as a fraction of the play area, in `HIDES` order. A tall screen and
 * a wide one get their own arrangement rather than a stretched one; the landscape keeps the cloud
 * clear of the buttons at the top right and the portrait does the same.
 */
export const LAYOUT_WIDE: Pos[] = [
  { x: 0.12, y: 0.56 }, // bush
  { x: 0.28, y: 0.80 }, // barrel
  { x: 0.66, y: 0.74 }, // blanket
  { x: 0.86, y: 0.50 }, // door
  { x: 0.88, y: 0.80 }, // haystack
  { x: 0.50, y: 0.86 }, // rock
  { x: 0.42, y: 0.57 }, // wave
  { x: 0.74, y: 0.17 }, // cloud
];
export const LAYOUT_TALL: Pos[] = [
  { x: 0.20, y: 0.30 }, // bush
  { x: 0.24, y: 0.72 }, // barrel
  { x: 0.72, y: 0.52 }, // blanket
  { x: 0.76, y: 0.30 }, // door
  { x: 0.78, y: 0.74 }, // haystack
  { x: 0.50, y: 0.90 }, // rock
  { x: 0.30, y: 0.50 }, // wave
  { x: 0.50, y: 0.13 }, // cloud
];

export const isTall = (w: number, h: number): boolean => h > w;
export const layoutFor = (w: number, h: number): Pos[] => (isTall(w, h) ? LAYOUT_TALL : LAYOUT_WIDE);

/** The size of a hiding place: from the narrow side, so it fits a phone either way up. */
export const spotRadius = (w: number, h: number): number => Math.min(w * 0.11, h * 0.095);

export interface Rect { x: number; y: number; w: number; h: number }

/** The square a finger may land in, a little bigger than the drawing. */
export function spotRects(w: number, h: number): Rect[] {
  const r = spotRadius(w, h), side = r * 2.2;
  return layoutFor(w, h).map(p => ({ x: p.x * w - side / 2, y: p.y * h - side / 2, w: side, h: side }));
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------------------------------------------------------------- a round

export interface Round {
  /** which animal sits in each place, by spot index */
  at: AnimalId[];
  open: boolean[];
  /** opened at least once this round */
  found: boolean[];
}

/**
 * Deal the eight animals to the eight places. With the last round's deal, every animal lands
 * somewhere new: "the animals shuffle to new places" has to be visible, or "Nog een keer" is the
 * same round again.
 */
export function deal(seed: number, prev?: AnimalId[]): AnimalId[] {
  const rng = makeRng(seed);
  const ids = ANIMALS.map(a => a.id);
  for (let attempt = 0; attempt < 60; attempt++) {
    const d = ids.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    if (!prev || d.every((a, i) => a !== prev[i])) return d;
  }
  // sixty shuffles all kept something in place: a rotation never does
  return prev!.map((_, i) => prev![(i + 1 + (seed % (prev!.length - 1))) % prev!.length]);
}

export function newRound(seed: number, prev?: AnimalId[]): Round {
  const at = deal(seed, prev);
  return { at, open: at.map(() => false), found: at.map(() => false) };
}

export interface TapResult {
  /** the place is open now; false when this tap hid the animal again */
  opened: boolean;
  /** the first time this place was opened this round */
  first: boolean;
  /** that was the last place to find */
  complete: boolean;
}

/** One gesture: a closed place opens, an open one closes. There is no way to tap wrongly. */
export function tapSpot(r: Round, i: number): TapResult {
  if (i < 0 || i >= r.at.length) return { opened: false, first: false, complete: false };
  if (r.open[i]) { r.open[i] = false; return { opened: false, first: false, complete: false }; }
  r.open[i] = true;
  const first = !r.found[i];
  r.found[i] = true;
  return { opened: true, first, complete: first && isComplete(r) };
}

export const foundCount = (r: Round): number => r.found.filter(Boolean).length;
export const isComplete = (r: Round): boolean => r.found.every(Boolean);

/** The place of an animal in this round. */
export const spotOf = (r: Round, a: AnimalId): number => r.at.indexOf(a);

/**
 * Which animal to ask for: one that has not been found yet, so a question is always about
 * something still hidden. -1 when everything has been found.
 */
export function pickTarget(r: Round, rng: () => number): number {
  const left = r.found.map((f, i) => (f ? -1 : i)).filter(i => i >= 0);
  return left.length ? left[Math.floor(rng() * left.length)] : -1;
}
