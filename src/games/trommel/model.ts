/**
 * Trommelkring: the rules of a rhythm that is played back, with no browser in sight.
 *
 * Suri plays a short rhythm on his drum; the child plays it back on a big one. What is checked is
 * the order of the hits, which side of the drum each one fell on (low "boem" on the left, high "tik"
 * on the right) and the gaps between them. That is a claim about what happens on the screen, which
 * is all that "oefent" promises: it practises listening to a rhythm and repeating it. Nobody has
 * measured that it teaches anything.
 *
 * Two product decisions sit in this file and are marked where they are used:
 *  - time is counted in BEATS from the child's own first hit, never from a signal. A small hand
 *    that starts late is not wrong, and a pattern is about the gaps, not about when you began.
 *  - nothing is ever lost. A round that goes badly is heard again once; after that the circle
 *    moves on. Every level that is played to its end earns at least one star.
 */

import { makeRng } from '../../util/rng';

/** Left half of the drum is the low sound, right half the high one. */
export type Side = 'L' | 'R';

/** One hit: when, in beats from the start of the pattern, and on which half. */
export interface Note { beat: number; side: Side }

export interface Level {
  id: number;
  name: string;
  nameNl: string;
  hint: string;
  hintNl: string;
  /** product decision: tempo in beats per minute. 70 is a slow walk, 100 a brisk one. */
  bpm: number;
  /** how far off a hit may be and still count as on time, as a fraction of one beat */
  tolerance: number;
}

/** Eight patterns per level, then the circle is done: every session ends. */
export const PATTERNS_PER_LEVEL = 8;

/**
 * Product decisions, not research: no study says what a three-year-old's rhythm error is. 0.25 of
 * a beat at 70 bpm is about 0.21 seconds either side, which is generous on purpose for small hands
 * (the brief for level 1); it tightens a little as the patterns get longer.
 */
export const LEVELS: Level[] = [
  { id: 1, name: 'Two beats', nameNl: 'Twee slagen', hint: 'Listen to two beats and play them back.', hintNl: 'Luister naar twee slagen en speel ze na.', bpm: 70, tolerance: 0.25 },
  { id: 2, name: 'Three beats', nameNl: 'Drie slagen', hint: 'Three beats on the same side.', hintNl: 'Drie slagen op dezelfde kant.', bpm: 70, tolerance: 0.25 },
  { id: 3, name: 'Low and high', nameNl: 'Boem en tik', hint: 'Low and high beats, mixed.', hintNl: 'Lage en hoge slagen door elkaar.', bpm: 72, tolerance: 0.22 },
  { id: 4, name: 'A rest', nameNl: 'Stilte', hint: 'One beat of quiet in the middle.', hintNl: 'Een slag stilte in het midden.', bpm: 72, tolerance: 0.2 },
  { id: 5, name: 'Quicker', nameNl: 'Sneller', hint: 'Four beats in a row, a bit faster.', hintNl: 'Vier slagen achter elkaar, iets sneller.', bpm: 100, tolerance: 0.2 },
];

/** Seconds in one beat. */
export const beatSeconds = (bpm: number): number => 60 / bpm;

// ---------------------------------------------------------------- scoring

/**
 * Product decisions: how much of a pattern must be right to count as "goed" and as "bijna".
 * Below that the pattern is heard once more.
 */
export const GOED_AT = 0.85;
export const BIJNA_AT = 0.5;

export type Verdict = 'goed' | 'bijna' | 'nog een keer';

/**
 * How well the child's hits match the pattern, 0 to 1.
 *
 * `hits` are in beats on any clock; both lists are shifted so their first hit is zero. A hit counts
 * in full when it is on the right side and within `tolerance` of its beat, and fades to nothing at
 * twice the tolerance. A wrong side counts for nothing. Hits that were missed count for nothing,
 * and each hit beyond the pattern costs half a hit, so hammering the whole drum cannot score.
 */
export function score(pattern: readonly Note[], hits: readonly Note[], tolerance: number): number {
  if (pattern.length === 0) return 1;
  if (hits.length === 0) return 0;
  const p0 = pattern[0].beat, h0 = hits[0].beat;
  let sum = 0;
  for (let i = 0; i < pattern.length && i < hits.length; i++) {
    const want = pattern[i], got = hits[i];
    if (got.side !== want.side) continue;
    const off = Math.abs((got.beat - h0) - (want.beat - p0));
    sum += Math.min(1, Math.max(0, 2 - off / Math.max(1e-6, tolerance)));
  }
  const extra = Math.max(0, hits.length - pattern.length);
  return Math.min(1, Math.max(0, (sum - extra * 0.5) / pattern.length));
}

export function judge(s: number): Verdict {
  if (s >= GOED_AT) return 'goed';
  if (s >= BIJNA_AT) return 'bijna';
  return 'nog een keer';
}

/** Hit times in seconds, as beats from the first of them. */
export function toBeats(seconds: readonly number[], bpm: number): number[] {
  if (seconds.length === 0) return [];
  const b = beatSeconds(bpm);
  return seconds.map(s => (s - seconds[0]) / b);
}

// ---------------------------------------------------------------- patterns

const key = (p: Note[]): string => p.map(n => `${n.beat}${n.side}`).join('.');

function sidesFor(n: number, mixed: boolean, rng: () => number): Side[] {
  if (!mixed) { const s: Side = rng() < 0.5 ? 'L' : 'R'; return Array(n).fill(s); }
  // a mix has at least one of each, or it is not a mix
  for (;;) {
    const a: Side[] = Array.from({ length: n }, () => (rng() < 0.5 ? 'L' : 'R'));
    if (a.includes('L') && a.includes('R')) return a;
  }
}

function build(level: number, rng: () => number): Note[] {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  let beats: number[];
  let mixed = false;
  switch (level) {
    case 1: beats = pick([[0, 1], [0, 2]]); break;
    case 2: beats = pick([[0, 1, 2], [0, 1, 3], [0, 2, 3]]); break;
    case 3: beats = pick([[0, 1, 2], [0, 1, 3], [0, 2, 3]]); mixed = true; break;
    // the rest is the empty beat between hits: 0 1 _ 3, or 0 _ 2 3
    case 4: beats = pick([[0, 1, 3], [0, 2, 3]]); mixed = rng() < 0.7; break;
    default: beats = [0, 1, 2, 3]; mixed = true; break;
  }
  const sides = sidesFor(beats.length, mixed, rng);
  return beats.map((beat, i) => ({ beat, side: sides[i] }));
}

/**
 * The eight patterns of a level, the same for the same `attempt`. No pattern repeats inside a
 * level where the level has room for that, and none follows itself.
 */
export function makePatterns(level: number, attempt = 0): Note[][] {
  const rng = makeRng(level * 7919 + attempt * 104729 + 17);
  const out: Note[][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < PATTERNS_PER_LEVEL; i++) {
    let p = build(level, rng);
    for (let tries = 0; tries < 40; tries++) {
      const k = key(p);
      if (!seen.has(k) && (i === 0 || k !== key(out[i - 1]))) break;
      p = build(level, rng);
    }
    seen.add(key(p));
    out.push(p);
  }
  return out;
}

/** Does the pattern have an empty beat between two hits? (Level 4's "stilte".) */
export function hasRest(p: readonly Note[]): boolean {
  for (let i = 1; i < p.length; i++) if (p[i].beat - p[i - 1].beat > 1) return true;
  return false;
}

/** How long the pattern lasts, in beats from its first hit to its last. */
export const spanBeats = (p: readonly Note[]): number => (p.length ? p[p.length - 1].beat - p[0].beat : 0);

// ---------------------------------------------------------------- credit and stars

/**
 * Product decision: what a round is worth. A pattern got right on the first listen is 1, right on
 * the second 0.5, and a round that was tried twice and not got is 0.25: trying counts, nothing is
 * taken away.
 */
export function roundCredit(verdict: Verdict, attempt: number): number {
  if (verdict === 'goed') return attempt <= 1 ? 1 : 0.5;
  return 0.25;
}

/** One star for playing the circle to its end, two and three for how much was right. */
export function starsFor(credit: number, rounds = PATTERNS_PER_LEVEL): number {
  const r = credit / Math.max(1, rounds);
  return r >= 0.85 ? 3 : r >= 0.55 ? 2 : 1;
}

/** The simple shape (two and three): hits Suri plays along with before the circle is done. */
export const FREE_HITS = 16;
