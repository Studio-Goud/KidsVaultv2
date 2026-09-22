/**
 * Rekenrijk: the ladder of levels, where every sum comes from, and which wrong answers are worth
 * offering beside the right one.
 *
 * Nothing in this file draws anything. It is the rules of the arithmetic a Dutch school teaches in
 * the order it teaches them - splitsen, erbij, eraf, de tien vol, tientallen, over het tiental,
 * verschil, keersommen, de tafels - and each level has its own generator that can only produce
 * sums inside its own rule. `inRule` says what that rule is, in one place, so the tests can hold
 * every generator to it rather than to a description in a comment.
 *
 * The distractors are the teaching. Beside 27 + 8 = 35 sits 25, because a child who adds 7 and 8,
 * gets 15 and writes down the 5 keeps the two and loses the carry; and 215, because a child who
 * adds the tens and the units separately and writes them side by side gets exactly that. Beside
 * 6 × 7 sits 6 × 6 and 7 × 7, because the neighbouring fact is the one that actually gets said.
 * A wrong answer that is simply a different number teaches nothing and is never offered.
 */

import { makeRng } from '../../util/rng';

export type Op = 'split' | 'add' | 'sub' | 'bridge' | 'tens' | 'cross' | 'diff' | 'times';

/** How the sum is laid out as things you can move. */
export type Stage = 'rack' | 'crates' | 'frame' | 'blocks' | 'line' | 'array';

export interface Step {
  /** the ten the sum steps onto on the way */
  to: number;
  /** how much of b it takes to get there */
  first: number;
  /** and how much of b is left over after it */
  rest: number;
}

export interface Question {
  op: Op;
  stage: Stage;
  /** the two numbers as they are written: the whole and the given part on a split, from and to on
   * a difference, rows and columns on an array, and otherwise simply the two sides of the sum */
  a: number;
  b: number;
  answer: number;
  /** what you may choose between, already shuffled */
  options: number[];
  /** which of the options is right */
  correct: number;
  /** the step over the ten, on the two levels that have one */
  step: Step | null;
  /** the stretch of the number line this question lives on */
  line: { lo: number; hi: number } | null;
}

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  op: Op;
  stage: Stage;
  rounds: number;
  options: number;
  hint: string;
  hintNl: string;
  /** which tables this level drills */
  tables?: number[];
}

export const LEVELS: Level[] = [
  {
    id: 'splitsen', name: 'Splitting to ten', nameNl: 'Splitsen tot 10',
    op: 'split', stage: 'rack', rounds: 8, options: 4,
    hint: 'Slide the divider. What is left on the right is the answer.',
    hintNl: 'Schuif de scheiding. Wat rechts overblijft is het antwoord.',
  },
  {
    id: 'erbij', name: 'Adding to ten', nameNl: 'Erbij tot 10',
    op: 'add', stage: 'crates', rounds: 8, options: 4,
    hint: 'Push the two crates together and count all the apples.',
    hintNl: 'Schuif de twee kisten tegen elkaar en tel alle appels.',
  },
  {
    id: 'eraf', name: 'Taking away to ten', nameNl: 'Eraf tot 10',
    op: 'sub', stage: 'crates', rounds: 8, options: 4,
    hint: 'Take apples out of the crate, one at a time. What stays behind is the answer.',
    hintNl: 'Haal er één voor één appels uit. Wat in de kist blijft is het antwoord.',
  },
  {
    id: 'tienvol', name: 'Filling the ten', nameNl: 'De tien vol',
    op: 'bridge', stage: 'frame', rounds: 8, options: 4,
    hint: 'First make the frame full: ten. Then count on with what is left over.',
    hintNl: 'Maak eerst het tienveld vol: tien. Tel dan door met wat er nog over is.',
  },
  {
    id: 'tientallen', name: 'Tens and ones', nameNl: 'Tientallen',
    op: 'tens', stage: 'blocks', rounds: 8, options: 4,
    hint: 'A rod is ten, a cube is one. Put them on the tray and read the number line.',
    hintNl: 'Een staaf is tien, een blokje is één. Leg ze op de plank en lees de getallenlijn.',
  },
  {
    id: 'overtiental', name: 'Over the ten', nameNl: 'Over het tiental',
    op: 'cross', stage: 'line', rounds: 8, options: 4,
    hint: 'Jump to the next ten first. Then the rest of the jump is easy.',
    hintNl: 'Spring eerst naar het volgende tiental. De rest van de sprong is dan makkelijk.',
  },
  {
    id: 'verschil', name: 'The difference', nameNl: 'Verschil',
    op: 'diff', stage: 'line', rounds: 8, options: 4,
    hint: 'Walk from the first number to the second and count the steps. That is the difference.',
    hintNl: 'Loop van het eerste getal naar het tweede en tel de stappen. Dat is het verschil.',
  },
  {
    id: 'keer', name: 'Times, in rows', nameNl: 'Keersommen',
    op: 'times', stage: 'array', rounds: 8, options: 4, tables: [1, 2, 5, 10],
    hint: 'Drag the corner until the crate has the right number of rows.',
    hintNl: 'Sleep de hoek tot de kist het goede aantal rijen heeft.',
  },
  {
    id: 'tafels', name: 'The tables', nameNl: 'De tafels',
    op: 'times', stage: 'array', rounds: 10, options: 4, tables: [3, 4, 6, 7, 8, 9],
    hint: 'Same crate, harder tables. Count a row at a time: six, twelve, eighteen.',
    hintNl: 'Dezelfde kist, moeilijkere tafels. Tel per rij: zes, twaalf, achttien.',
  },
];

/** A sum on its own, before the buttons it will be offered with. */
export type SumOnly = Omit<Question, 'options' | 'correct'>;

export const levelById = (id: string): Level => LEVELS.find(l => l.id === id) ?? LEVELS[0];

export const rngFor = (level: Level, attempt: number): (() => number) =>
  makeRng(level.id.length * 811 + attempt * 37 + 101);

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

const tensOf = (n: number): number => Math.floor(n / 10);
const unitsOf = (n: number): number => n % 10;

/** The step over the ten that a sum like 8 + 5 or 27 + 8 takes on the way. */
export function stepOverTen(a: number, b: number): Step {
  const to = (tensOf(a) + 1) * 10;
  const first = to - a;
  return { to, first, rest: b - first };
}

/**
 * Is this question one its level is allowed to ask?
 *
 * Every rule the ladder rests on is written here once, and the generators are held to it by the
 * tests rather than by good intentions. A level that quietly produced 8 + 7 where it promised sums
 * to ten would teach a child that the rule does not mean anything.
 */
export function inRule(level: Level, q: Question): boolean {
  if (q.op !== level.op || q.stage !== level.stage) return false;
  if (!Number.isInteger(q.a) || !Number.isInteger(q.b) || !Number.isInteger(q.answer)) return false;
  switch (level.id) {
    case 'splitsen':
      // a whole from three to ten, split into a part you are shown and a part you work out; both
      // parts are real, so 7 = 0 + 7 never comes up
      return q.a >= 3 && q.a <= 10 && q.b >= 1 && q.b <= q.a - 1 && q.answer === q.a - q.b;
    case 'erbij':
      return q.a >= 1 && q.b >= 1 && q.a + q.b <= 10 && q.answer === q.a + q.b;
    case 'eraf':
      return q.a >= 2 && q.a <= 10 && q.b >= 1 && q.b <= q.a - 1 && q.answer === q.a - q.b;
    case 'tienvol':
      // it has to actually cross the ten, or the level is not about crossing the ten
      return q.a >= 5 && q.a <= 9 && q.b >= 2 && q.b <= 9 && q.a + q.b > 10 && q.a + q.b <= 18
        && q.answer === q.a + q.b
        && q.step != null && q.step.to === 10 && q.step.first === 10 - q.a
        && q.step.rest === q.b - q.step.first && q.step.first >= 1 && q.step.rest >= 1;
    case 'tientallen':
      // whole tens added to whole tens, or a handful of ones onto a two-digit number - and never a
      // sum that crosses a ten, because that is the next level's job
      return q.a >= 10 && q.b >= 1 && q.a + q.b <= 99
        && unitsOf(q.a) + unitsOf(q.b) <= 9
        && q.answer === q.a + q.b
        && (unitsOf(q.b) === 0 || (q.b <= 9 && tensOf(q.b) === 0));
    case 'overtiental':
      return q.a >= 11 && q.a <= 89 && q.b >= 3 && q.b <= 9
        && unitsOf(q.a) >= 1 && unitsOf(q.a) + q.b > 10 && q.a + q.b <= 99
        && q.answer === q.a + q.b
        && q.step != null && q.step.to === (tensOf(q.a) + 1) * 10
        && q.step.first === q.step.to - q.a && q.step.rest === q.b - q.step.first
        && q.step.first >= 1 && q.step.rest >= 1;
    case 'verschil':
      return q.a >= 0 && q.b <= 100 && q.a < q.b && q.answer === q.b - q.a
        && q.answer >= 2 && q.answer <= 30;
    case 'keer':
    case 'tafels': {
      const tables = level.tables ?? [];
      const lo = level.id === 'keer' ? 1 : 2;
      return tables.includes(q.b) && q.a >= lo && q.a <= 10 && q.answer === q.a * q.b;
    }
    default:
      return false;
  }
}

/**
 * The wrong answers, in the order they are worth offering.
 *
 * Order matters: a level takes the first few, so the mistake that most needs naming has to come
 * first. Everything here is a mistake a child really makes - the count that started on the number
 * it was already standing on, the carry that got dropped, the neighbouring table fact - and the
 * last resort at the bottom only fires if all of that collapsed into duplicates.
 */
export function distractors(q: SumOnly, rng: () => number): number[] {
  const out: number[] = [];
  const add = (v: number): void => {
    if (!Number.isFinite(v)) return;
    const k = Math.round(v);
    if (k < 0 || k > 999) return;
    if (k === q.answer) return;
    if (out.includes(k)) return;
    out.push(k);
  };
  const { a, b, answer, op } = q;

  switch (op) {
    case 'split':
      // the whole itself, because the divider was never moved; the part you were given, read back;
      // and one either side, because the last bead is the one that gets counted twice
      add(a); add(b); add(answer + 1); add(answer - 1); add(a + b);
      break;
    case 'add':
      // counted on starting from the number you are standing on, so one short or one long; the
      // difference, because the wrong operation is the commonest mistake of all
      add(answer - 1); add(answer + 1); add(Math.abs(a - b)); add(answer + 2); add(a); add(b);
      break;
    case 'sub':
      add(answer + 1); add(answer - 1); add(a + b); add(b); add(a);
      break;
    case 'bridge':
      // stopping at the ten, which is exactly the step this level teaches; dropping the ten and
      // keeping only the units; and one either side of the count-on
      add(10); add(answer - 10); add(answer - 1); add(answer + 1); add(Math.abs(a - b));
      break;
    case 'tens':
      // the tens added as if they were units, and the other way round
      add(answer - 10); add(answer + 10); add(answer - 1); add(answer + 1);
      add(tensOf(a) + tensOf(b)); add(a + b * 10);
      break;
    case 'cross': {
      // the carry dropped: 27 + 8 gives 15 in the units, and the 5 is written where the 7 was
      add(tensOf(a) * 10 + unitsOf(unitsOf(a) + b));
      // the tens and the units written down side by side: 27 + 8 = 215. It is offered every round
      // rather than kept in reserve, because it is the mistake the number line actually answers -
      // the line stops at a hundred, and the child can see that the number is not on it
      add(tensOf(a) * 100 + (unitsOf(a) + b));
      // the count that started on the number it was standing on
      add(answer - 1); add(answer + 1);
      add(answer - 10); add(answer + 10);
      break;
    }
    case 'diff':
      // the fence-post mistake, in both directions
      add(answer + 1); add(answer - 1);
      // the units subtracted without looking at the tens: 30 − 23 read as 3
      add(Math.abs(unitsOf(b) - unitsOf(a)));
      add(a + b); add(answer + 10);
      break;
    case 'times': {
      // the neighbouring fact in the same table, and the same fact in the table next door. Nought
      // is left out: "ten times one is nought" is not a mistake anybody makes, it is noise
      const fact = (v: number): void => { if (v > 0) add(v); };
      fact(answer - b); fact(answer + b); fact(answer - a); fact(answer + a);
      fact(a + b); fact(answer + 1);
      break;
    }
  }

  // and, only if all of that collapsed, something in the same part of the number line
  for (let guard = 0; out.length < 6 && guard < 60; guard++) {
    const v = answer + between(rng, -4, 4) * (answer > 20 ? 2 : 1);
    if (op === 'times' && v <= 0) continue;
    add(v);
  }
  return out;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/** What makes two questions "the same sum", for the purpose of not asking it twice in a row. */
export const keyOf = (q: Question): string => `${q.op}:${q.a}:${q.b}`;

/**
 * One question from this level, with its answers already shuffled.
 *
 * `avoid` is the handful of sums the level has already asked. Eight rounds drawn freely from the
 * tables of two will repeat, and a level that asks 5 × 2 three times reads as broken even though
 * it is only chance, so a repeat is rolled again.
 */
export function makeQuestion(
  level: Level, rng: () => number, index: number, avoid: string[] = [], options = level.options,
): Question {
  let q = roll(level, rng, index, options);
  for (let tries = 0; tries < 30 && avoid.includes(keyOf(q)); tries++) q = roll(level, rng, index, options);
  return q;
}

/**
 * How many buttons to put under a question.
 *
 * Two is a coin toss and five is a wall of numbers, so the ends are where the count has to stay
 * away from. A child who has just got here gets three - enough that guessing is not a strategy,
 * few enough to read at a glance - and one who is sure of this gets the level's full set, where
 * the near-misses that make the level worth doing all fit.
 *
 * The sums do not get bigger. The level decides what it is about, and it keeps deciding.
 */
export function optionsFor(level: Level, difficulty: number): number {
  const d = difficulty < 0 ? 0 : difficulty > 1 ? 1 : difficulty;
  return Math.max(3, Math.min(level.options, Math.round(3 + d * (level.options - 3))));
}

/** How long this level's sums ought to take, in milliseconds, for judging a good answer. */
export function parMsFor(level: Level): number {
  return level.op === 'times' ? 9000 : level.stage === 'line' ? 8000 : 6500;
}

function roll(level: Level, rng: () => number, index: number, options: number): Question {
  const base = rollSum(level, rng, index);
  const wrong = distractors(base, rng);
  const shown = shuffle([base.answer, ...wrong.slice(0, Math.max(0, options - 1))], rng);
  return { ...base, options: shown, correct: shown.indexOf(base.answer) };
}

type Bare = SumOnly;

function rollSum(level: Level, rng: () => number, index: number): Bare {
  const shell = (a: number, b: number, answer: number, extra: Partial<Bare> = {}): Bare => ({
    op: level.op, stage: level.stage, a, b, answer, step: null, line: null, ...extra,
  });

  switch (level.id) {
    case 'splitsen': {
      // the whole grows through the level, so it starts at four and ends at ten rather than
      // throwing a ten at a child on the first question
      const lo = index < 2 ? 4 : index < 4 ? 5 : 6;
      const a = between(rng, lo, 10);
      const b = between(rng, 1, a - 1);
      return shell(a, b, a - b);
    }
    case 'erbij': {
      const total = between(rng, index < 2 ? 4 : 5, 10);
      const a = between(rng, 1, total - 1);
      return shell(a, total - a, total);
    }
    case 'eraf': {
      const a = between(rng, index < 2 ? 5 : 6, 10);
      const b = between(rng, 1, a - 1);
      return shell(a, b, a - b);
    }
    case 'tienvol': {
      const a = between(rng, 5, 9);
      // b has to be big enough to pass the ten and small enough to stay a single digit
      const b = between(rng, 11 - a, 9);
      return shell(a, b, a + b, { step: stepOverTen(a, b), line: { lo: 0, hi: 20 } });
    }
    case 'tientallen': {
      if (rng() < 0.5) {
        // whole tens onto whole tens: 30 + 40
        const ta = between(rng, 1, 7);
        const tb = between(rng, 1, Math.min(8, 9 - ta));
        return shell(ta * 10, tb * 10, (ta + tb) * 10, { line: { lo: 0, hi: 100 } });
      }
      // ones onto a two-digit number, staying inside the ten: 34 + 5
      const ta = between(rng, 1, 8);
      const ua = between(rng, 1, 7);
      const a = ta * 10 + ua;
      const b = between(rng, 1, 9 - ua);
      return shell(a, b, a + b, { line: { lo: ta * 10, hi: ta * 10 + 10 } });
    }
    case 'overtiental': {
      const ta = between(rng, 1, 8);
      const ua = between(rng, 2, 9);
      const a = ta * 10 + ua;
      // strictly over the ten: landing exactly on it is the level before this one, and never fewer
      // than three, because two is a step rather than a jump
      const b = between(rng, Math.max(3, 11 - ua), 9);
      const step = stepOverTen(a, b);
      return shell(a, b, a + b, { step, line: { lo: ta * 10 - (ta > 0 ? 10 : 0), hi: Math.min(100, (ta + 2) * 10) } });
    }
    case 'verschil': {
      // most differences cross a ten, because a difference inside one ten does not need a line -
      // and a crossing one starts high in its ten, so the walk stays short enough to count
      const crossing = rng() < 0.7;
      const ta = between(rng, index < 3 ? 0 : 1, index < 3 ? 2 : 7);
      const ua = crossing ? between(rng, 4, 9) : between(rng, 0, 6);
      const a = Math.max(1, ta * 10 + ua);
      const u = unitsOf(a);
      const gap = crossing ? 10 - u + between(rng, 1, 5) : between(rng, 2, Math.max(2, 9 - u));
      const b = Math.min(100, a + gap);
      const lo = Math.max(0, Math.floor((a - 2) / 10) * 10);
      return shell(a, b, b - a, { line: { lo, hi: Math.min(100, Math.ceil((b + 2) / 10) * 10) } });
    }
    case 'keer':
    case 'tafels': {
      const tables = level.tables ?? [2];
      const b = pick(rng, tables);
      const lo = level.id === 'keer' ? 1 : 2;
      // the early rounds stay in the easy half of the table
      const a = between(rng, lo, index < 3 ? 6 : 10);
      return shell(a, b, a * b);
    }
    default:
      return shell(1, 1, 2);
  }
}

/**
 * Stars: what was got right the first time, before the objects showed the answer.
 *
 * A second go always counts as help. Nobody fails and no level locks anybody out - finishing is
 * finishing, and the stars are only what says how it went.
 */
export function starsFor(firstTry: number, total: number): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.75) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

/**
 * The line the game says when an answer was wrong, pointing at the step rather than the mistake.
 *
 * On a level with a ten in the middle of it that is the step over the ten, written out. Everywhere
 * else it is what the objects on screen are about to show.
 */
export function teachLine(q: Question, nl: boolean): string {
  if (q.step) {
    return nl
      ? `Eerst de tien vol: ${q.a} + ${q.step.first} = ${q.step.to}. Dan nog ${q.step.rest} erbij.`
      : `Fill the ten first: ${q.a} + ${q.step.first} = ${q.step.to}. Then ${q.step.rest} more.`;
  }
  switch (q.op) {
    case 'split':
      return nl ? `${q.a} beugels: ${q.b} links, de rest rechts.` : `${q.a} beads: ${q.b} on the left, the rest on the right.`;
    case 'sub':
      return nl ? `Er gingen er ${q.b} uit, dus blijven er ${q.answer} over.` : `${q.b} went out, so ${q.answer} stay behind.`;
    case 'diff':
      return nl ? `Van ${q.a} naar ${q.b} is ${q.answer} stappen.` : `From ${q.a} to ${q.b} is ${q.answer} steps.`;
    case 'times':
      return nl ? `${q.a} rijen van ${q.b}: tel per rij.` : `${q.a} rows of ${q.b}: count a row at a time.`;
    case 'tens':
      return nl ? `Tel de staven en dan de blokjes.` : `Count the rods, then the cubes.`;
    default:
      return nl ? `Tel ze allemaal: ${q.a} en nog ${q.b} erbij.` : `Count them all: ${q.a} and ${q.b} more.`;
  }
}

/**
 * How many things the child has to move before the sum has been done, and what the stage looks
 * like when it has been. A level that let the answer be tapped without touching the objects would
 * be a list of sums with a picture beside it.
 */
export function targetOf(q: Question): number {
  switch (q.stage) {
    case 'rack': return q.b;
    case 'crates': return q.op === 'sub' ? q.b : 1;
    case 'frame': return q.step ? q.step.first : q.b;
    case 'blocks': return q.b;
    case 'line': return q.step ? q.step.to : q.b;
    case 'array': return q.a * q.b;
    default: return 0;
  }
}
