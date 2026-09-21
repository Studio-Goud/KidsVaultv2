/**
 * Klokkijken: the ladder of levels, and where each question comes from.
 *
 * The ladder is the order a school teaches it in, not a difficulty curve invented afterwards:
 * whole hours, then the half hour, then the quarters, then five minutes, then setting the hands
 * yourself, then single minutes, then matching a digital time to a face, then the twenty-four hour
 * clock, and last the question a clock is actually for - it is twenty past two and the bus goes in
 * twenty-five minutes, so what time is that.
 *
 * The distractors are the teaching. A wrong answer offered beside 3:30 is 4:30, because "half
 * vier" pulls a Dutch child straight to the four; beside 3:10 it is 2:15, because that is what the
 * hands say if you read the short one as the long one. Nothing here is a random number.
 */

import { makeRng } from '../../util/rng';
import { normalise, plusMinutes, sameTime } from './dutchtime';

export type QKind = 'read' | 'set' | 'match' | 'elapsed';

export interface Time { h: number; m: number }

export interface Question {
  kind: QKind;
  /** the time the question is about */
  t: Time;
  /** for 'elapsed': where you start and how long you wait */
  from?: Time;
  plus?: number;
  /** for 'read', 'match' and 'elapsed': what you may choose between */
  options: Time[];
  /** which of the options is right */
  answer: number;
  /** the hands the clock opens on, for 'set' */
  start?: Time;
}

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  /** how many questions in this level */
  rounds: number;
  /** which question types may come up */
  kinds: QKind[];
  /** the minutes a time may land on */
  steps: number[];
  /** how finely the hands snap when you drag them */
  snap: number;
  /** how many answers to choose between */
  options: number;
  /** times run past midday, and the digital answers are written 00:00 to 23:59 */
  h24: boolean;
  hint: string;
  hintNl: string;
}

/** Every minute of the hour, for the levels that no longer round anything off. */
const EVERY = Array.from({ length: 60 }, (_, i) => i);
const FIVES = Array.from({ length: 12 }, (_, i) => i * 5);

export const LEVELS: Level[] = [
  {
    id: 'hours', name: 'Whole hours', nameNl: 'Hele uren', rounds: 6, kinds: ['read'],
    steps: [0], snap: 5, options: 3, h24: false,
    hint: 'The long hand points straight up. The short hand says which hour it is.',
    hintNl: 'De lange wijzer staat recht omhoog. De korte wijzer zegt hoe laat het is.',
  },
  {
    id: 'half', name: 'Half past', nameNl: 'Half uur', rounds: 7, kinds: ['read'],
    steps: [0, 30], snap: 5, options: 3, h24: false,
    hint: 'Long hand down is half past. Careful: half past three is "half vier" - the short hand is already on its way to the four.',
    hintNl: 'Lange wijzer omlaag is half. Let op: dit is half vier, niet half drie - de korte wijzer is al onderweg naar de vier.',
  },
  {
    id: 'quarters', name: 'The quarters', nameNl: 'De kwartieren', rounds: 8, kinds: ['read'],
    steps: [0, 15, 30, 45], snap: 5, options: 4, h24: false,
    hint: 'Right is quarter past, down is half, left is quarter to.',
    hintNl: 'Rechts is kwart over, onder is half, links is kwart voor.',
  },
  {
    id: 'fives', name: 'Five at a time', nameNl: 'Vijf tegelijk', rounds: 8, kinds: ['read'],
    steps: FIVES, snap: 5, options: 4, h24: false,
    hint: 'Count the long hand round in fives: five, ten, fifteen.',
    hintNl: 'Tel de lange wijzer rond met sprongen van vijf: vijf, tien, vijftien.',
  },
  {
    id: 'setit', name: 'Set the clock', nameNl: 'Zet de klok', rounds: 7, kinds: ['set'],
    steps: FIVES, snap: 5, options: 4, h24: false,
    hint: 'Drag the hands. Move the long one and the short one follows along by itself.',
    hintNl: 'Sleep de wijzers. Verplaats de lange en de korte gaat vanzelf mee.',
  },
  {
    id: 'minutes', name: 'Single minutes', nameNl: 'Losse minuten', rounds: 8, kinds: ['read', 'set'],
    steps: EVERY, snap: 1, options: 4, h24: false,
    hint: 'Every little tick is one minute. Count on from the nearest five.',
    hintNl: 'Elk streepje is een minuut. Tel door vanaf het dichtstbijzijnde vijftal.',
  },
  {
    id: 'match', name: 'Find the clock', nameNl: 'Zoek de klok', rounds: 8, kinds: ['match', 'read'],
    steps: FIVES, snap: 5, options: 4, h24: false,
    hint: 'Now it is the other way round: the figures are given, find the face that matches.',
    hintNl: 'Nu andersom: de cijfers staan er, zoek de klok die erbij hoort.',
  },
  {
    id: 'day', name: 'The whole day', nameNl: 'De hele dag', rounds: 8, kinds: ['read', 'match'],
    steps: FIVES, snap: 5, options: 4, h24: true,
    hint: 'After midday the clock counts on: one in the afternoon is 13:00. The hands look the same, the figures do not.',
    hintNl: 'Na de middag telt de klok door: een uur ’s middags is 13:00. De wijzers staan hetzelfde, de cijfers niet.',
  },
  {
    id: 'later', name: 'How much later', nameNl: 'Hoeveel later', rounds: 8, kinds: ['elapsed'],
    steps: FIVES, snap: 5, options: 4, h24: true,
    hint: 'Start at the time on the clock and count the minutes on.',
    hintNl: 'Begin bij de tijd op de klok en tel de minuten erbij.',
  },
];

export const rngFor = (level: Level, attempt: number): (() => number) =>
  makeRng(level.id.length * 397 + attempt * 29 + 11);

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** An hour that suits the level: a twelve hour level never asks about the afternoon. */
function someHour(level: Level, rng: () => number): number {
  if (!level.h24) return 1 + Math.floor(rng() * 12);
  // the afternoon and evening are the point of the twenty-four hour clock, so they come up more
  return rng() < 0.65 ? 13 + Math.floor(rng() * 11) : 1 + Math.floor(rng() * 11);
}

function someTime(level: Level, rng: () => number): Time {
  return { h: someHour(level, rng), m: pick(rng, level.steps) };
}

/**
 * The wrong answers, in the order they are worth offering.
 *
 * Each one is a mistake a child really makes: reading the short hand as if it were the long one,
 * jumping to the hour the half belongs to, counting the minutes to the wrong side, or landing one
 * five short. A distractor that is simply a different number teaches nothing.
 */
export function distractors(t: Time, level: Level, rng: () => number): Time[] {
  const { h, m } = normalise(t.h, t.m);
  const out: Time[] = [];
  const add = (hh: number, mm: number): void => {
    const c = normalise(hh, mm);
    if (sameTime(c, { h, m })) return;
    if (out.some(o => sameTime(o, c))) return;
    // a twelve hour level must not offer an afternoon answer, and vice versa
    if (!level.h24 && (c.h < 1 || c.h > 12)) return;
    // and an answer only ever lands on a minute this level deals in, so a whole-hours question is
    // never answered with 12:15
    if (!level.steps.includes(c.m)) return;
    out.push(c);
  };

  // the Dutch trap: "half vier" is 3:30, so the four is the answer a child reaches for first
  if (m >= 20 && m <= 40) add(h + 1, m);
  // the twenty-four hour trap: the same hands, read as the other half of the day
  if (level.h24) add(h < 12 ? h + 12 : h - 12, m);
  // counted from the wrong side of the hour: quarter to taken for quarter past
  add(h, 60 - m);
  // the hands read the wrong way round: the short hand taken for the long one
  add(Math.floor(m / 5) === 0 ? 12 : Math.floor(m / 5), (h % 12) * 5);
  // one five out, either side
  add(h, m + 5);
  add(h, m - 5);
  // the hour next door, same minutes
  add(h - 1, m);
  add(h + 1, m);
  // and, only if all of that collapsed into nothing, something plainly different
  for (let guard = 0; out.length < 4 && guard < 40; guard++) {
    add(someHour(level, rng), pick(rng, level.steps));
  }
  return out;
}

/**
 * One question of the given kind, with its answers already shuffled.
 *
 * `avoid` is the handful of times this level has already asked about. Eight rounds drawn freely
 * from twelve hours will repeat, and a level that asks half past nine three times feels broken
 * even though it is only chance, so a repeat is rolled again.
 */
export function makeQuestion(level: Level, rng: () => number, index: number, avoid: Time[] = []): Question {
  for (let tries = 0; tries < 24; tries++) {
    const q = rollQuestion(level, rng, index);
    const asked = q.kind === 'elapsed' ? (q.from ?? q.t) : q.t;
    if (!avoid.some(a => sameTime(a, asked))) return q;
  }
  return rollQuestion(level, rng, index);
}

function rollQuestion(level: Level, rng: () => number, index: number): Question {
  const kind = level.kinds[index % level.kinds.length];
  if (kind === 'set') {
    const t = someTime(level, rng);
    // the hands never open on the answer, and never on twelve o'clock either, which is a free pass
    let start = { h: pick(rng, [2, 5, 7, 10]), m: pick(rng, [0, 20, 40]) };
    if (sameTime(start, t)) start = { h: (start.h + 3) % 12, m: (start.m + 25) % 60 };
    return { kind, t, options: [], answer: 0, start };
  }
  if (kind === 'elapsed') {
    const from = someTime(level, rng);
    const plus = pick(rng, [5, 10, 15, 20, 25, 30, 40, 45, 60, 90]);
    const t = plusMinutes(from.h, from.m, plus);
    const wrong = distractors(t, level, rng);
    // the mistake this question invites: counting the minutes as if they were hours, or landing
    // on the start time, so both are offered
    const pool = [t, ...wrong.slice(0, 2), plusMinutes(from.h, from.m, plus === 60 ? 30 : 60)]
      .filter((x, i, a) => a.findIndex(y => sameTime(x, y)) === i);
    const options = shuffle(pool.slice(0, level.options), rng);
    return { kind, t, from, plus, options, answer: options.findIndex(o => sameTime(o, t)) };
  }
  const t = someTime(level, rng);
  const wrong = distractors(t, level, rng);
  const options = shuffle([t, ...wrong.slice(0, level.options - 1)], rng);
  return { kind, t, options, answer: options.findIndex(o => sameTime(o, t)) };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/** Is this what was asked for? For setting the hands, only the reading counts, not the century. */
export function isRight(q: Question, given: Time): boolean {
  if (q.kind === 'set') {
    const a = normalise(given.h, given.m), b = normalise(q.t.h, q.t.m);
    return a.h % 12 === b.h % 12 && a.m === b.m;
  }
  return sameTime(given, q.t);
}

/**
 * Stars: what you got right the first time, before the clock showed you.
 *
 * A second go always counts as help, so three stars mean the level was read rather than guessed.
 * Nobody fails: every question is answered in the end, so finishing is finishing.
 */
export function starsFor(firstTry: number, total: number): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.75) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

/** A line about what the hands are doing, for the moment after a wrong answer. */
export function teachLine(t: Time, nl: boolean): string {
  const { h, m } = normalise(t.h, t.m);
  const here = h % 12 === 0 ? 12 : h % 12;
  const next = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
  if (m === 0) {
    return nl ? `Korte wijzer precies op de ${here}.` : `Short hand right on the ${here}.`;
  }
  return nl
    ? `Korte wijzer tussen ${here} en ${next}: het uur is ${here}.`
    : `Short hand between ${here} and ${next}: the hour is ${here}.`;
}
