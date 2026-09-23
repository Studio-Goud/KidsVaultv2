/**
 * What a child can do at the moment, and what to ask them next.
 *
 * Every game in Suri used to own a ladder of levels: nine of them, hand-cut, and when you
 * had climbed it there was nothing left. That is fine for a valley of water or a rocket you keep
 * rebuilding, and it is no good at all for the things a child gets steadily better at - reading a
 * clock, splitting a number, holding a pattern in mind. Those want a ladder without a top.
 *
 * So the games stop deciding how hard to be, and say instead *what they asked* and *how it went*.
 * This works out the rest: one number per skill for how firm the ground is, and one number back
 * for how hard the next thing should be. Nothing here knows what a rocket or a clock is.
 *
 * Two rules it is built on, both from the same place - the work is only worth doing at the edge of
 * what a child can already do:
 *
 *  - Aim for about four right out of five. Much more than that and it is a chore; much less and it
 *    is a wall. The engine steers towards that band rather than towards "all correct".
 *  - A wrong answer is not a reason to go back to the beginning. It is a reason to put a smaller
 *    step in between, which is what `bridge` means below.
 *
 * It never decides what a child *is*. There is no clever, no slow, no gifted. The only question it
 * answers is: given what just happened, what is the right next thing to ask?
 */

/** The things the games actually train. A game may train more than one. */
export type SkillId =
  | 'reason' | 'pattern' | 'visualMemory' | 'workingMemory' | 'spatial'
  | 'language' | 'number' | 'problem' | 'planning' | 'reaction';

export const SKILLS: SkillId[] = [
  'reason', 'pattern', 'visualMemory', 'workingMemory', 'spatial',
  'language', 'number', 'problem', 'planning', 'reaction',
];

/** One question, and what the child did with it. */
export interface Attempt {
  correct: boolean;
  /** milliseconds from the question being readable to the answer being given */
  ms: number;
  /** how long this question ought to take at the level it was asked at */
  parMs: number;
  /** how much help was taken before answering */
  hints: number;
  /** how many goes it took, counting the one that worked */
  tries: number;
}

/** How firm the ground is under one skill. */
export interface Mastery {
  /** 0 is the very first question of this skill, 1 is as far as the game goes */
  level: number;
  /** how many questions have been answered at all */
  seen: number;
  /** right answers in a row, first try and without help */
  streak: number;
  /** wrong answers in a row */
  slump: number;
}

export const FRESH: Mastery = { level: 0.08, seen: 0, streak: 0, slump: 0 };

/** The share of questions a child should be getting right. Below this it is a wall, above it a chore. */
export const SWEET_SPOT = 0.78;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * How well one attempt went, as a number between 0 and 1.
 *
 * Right, first try, with no help and inside the time is a 1. Right but slow, or right after help,
 * or right on the third go, are all worth less - because they are all a child who has not got it
 * yet, and asking them something harder next would be unkind.
 */
export function scoreOf(a: Attempt): number {
  if (!a.correct) return 0;
  const speed = a.parMs > 0 ? clamp01(1.35 - (a.ms / a.parMs) * 0.7) : 1;
  const helped = 1 / (1 + a.hints * 0.9);
  const fumbled = 1 / (1 + Math.max(0, a.tries - 1) * 0.6);
  return clamp01(0.35 + 0.65 * speed * helped * fumbled);
}

/**
 * Move the ground under a skill after one attempt.
 *
 * The step is bigger early on, when almost nothing is known about a child, and settles as the
 * picture fills in - the first three answers say far more than the hundredth. A run of right
 * answers is worth more than the same answers scattered about, because that is what knowing
 * something looks like.
 */
export function updateMastery(m: Mastery, a: Attempt): Mastery {
  const score = scoreOf(a);
  const confidence = 1 / (1 + m.seen * 0.22);        // trust one answer less as the picture fills
  const gain = 0.11 + 0.26 * confidence;
  const streak = a.correct && a.hints === 0 && a.tries === 1 ? m.streak + 1 : 0;
  const slump = a.correct ? 0 : m.slump + 1;
  // the target is the sweet spot, not perfection: a child scoring exactly there stays put
  let level = m.level + gain * (score - SWEET_SPOT);
  if (streak >= 3) level += 0.03 * Math.min(streak - 2, 4);   // three in a row is a real signal
  if (slump >= 2) level -= 0.04 * Math.min(slump - 1, 3);
  return { level: clamp01(level), seen: m.seen + 1, streak, slump };
}

/** What to do next, and how hard it should be. */
export interface Step {
  /** 0 is the gentlest this skill goes, 1 the hardest the game has */
  difficulty: number;
  /**
   * `up` - it is going well, push on.
   * `hold` - about right, stay here.
   * `bridge` - it has gone wrong twice; put a smaller step in between rather than starting over.
   * `stretch` - three clean, quick answers in a row; jump rather than creep.
   */
  move: 'up' | 'hold' | 'bridge' | 'stretch';
}

/**
 * The next thing to ask.
 *
 * `recent` is the last handful of attempts, newest last. The engine looks at the run rather than
 * the last answer alone, because one slip in a good run means nothing and two in a row means
 * something.
 */
export function nextStep(m: Mastery, recent: Attempt[] = []): Step {
  const look = recent.slice(-5);
  const rate = look.length ? look.filter(a => a.correct).length / look.length : 1;
  const quick = look.length >= 3 && look.slice(-3).every(a => a.correct && a.hints === 0 && a.ms < a.parMs);

  if (m.slump >= 2) return { difficulty: clamp01(m.level - 0.12), move: 'bridge' };
  if (quick || m.streak >= 4) return { difficulty: clamp01(m.level + 0.14), move: 'stretch' };
  if (rate >= SWEET_SPOT) return { difficulty: clamp01(m.level + 0.05), move: 'up' };
  return { difficulty: clamp01(m.level), move: 'hold' };
}

/**
 * One number turned into the knobs a game actually has.
 *
 * A game asks for a difficulty and gets back how many things to put on screen, how fast, how much
 * to hold in mind, how many steps to the answer and how close the wrong answers should sit. It is
 * the same dial everywhere, so a child who is strong at patterns meets a harder pattern in every
 * game that has one, without any game having to know that.
 */
export interface Knobs {
  /** how many things are on screen at once */
  elements: number;
  /** how quickly it moves or how little time there is, 1 being the calmest */
  speed: number;
  /** how much has to be held in mind rather than looked at */
  memory: number;
  /** how many steps between the question and the answer */
  steps: number;
  /** how nearly right the wrong answers are, 0 being obviously wrong */
  distractors: number;
}

export function knobsFor(d: number, cap: { elements: number; steps: number }): Knobs {
  const t = clamp01(d);
  // each knob turns at its own rate: the number of things on screen early, the near-misses late,
  // because a child can count more things long before they can tell two near-identical answers apart
  return {
    elements: Math.max(1, Math.min(cap.elements, Math.round(1 + t * 1.15 * (cap.elements - 1)))),
    speed: 1 + t * 1.4,
    memory: clamp01(t * 1.2 - 0.15),
    steps: Math.max(1, Math.round(1 + Math.pow(t, 1.4) * (cap.steps - 1))),
    distractors: clamp01((t - 0.2) * 1.3),
  };
}

/** Everything the save keeps about one child's skills. Small, and about the work, never about them. */
export type Book = Partial<Record<SkillId, Mastery>>;

export const masteryOf = (book: Book, id: SkillId): Mastery => book[id] ?? { ...FRESH };

export function record(book: Book, id: SkillId, a: Attempt): Book {
  return { ...book, [id]: updateMastery(masteryOf(book, id), a) };
}

/** A saved book that has been hand-edited, truncated or written by an older version. */
export function cleanBook(raw: unknown): Book {
  const out: Book = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of SKILLS) {
    const m = (raw as Record<string, unknown>)[id];
    if (!m || typeof m !== 'object') continue;
    const { level, seen, streak, slump } = m as Record<string, unknown>;
    if (typeof level !== 'number' || !isFinite(level)) continue;
    out[id] = {
      level: clamp01(level),
      seen: typeof seen === 'number' && isFinite(seen) ? Math.max(0, Math.round(seen)) : 0,
      streak: typeof streak === 'number' && isFinite(streak) ? Math.max(0, Math.round(streak)) : 0,
      slump: typeof slump === 'number' && isFinite(slump) ? Math.max(0, Math.round(slump)) : 0,
    };
  }
  return out;
}

/**
 * The same ground, measured per subject rather than per skill.
 *
 * A child can be sure of splitting ten and shaky on the tables of seven, and one number for
 * "number" cannot hold both. So a game that teaches several things keeps a book of its own, keyed
 * by whatever it calls them, and the engine works exactly the same on it. The skill book stays
 * what it is: one line per thing the whole platform trains, for deciding which game to offer next.
 */
export type Topics = Record<string, Mastery>;

export const topicOf = (t: Topics, id: string): Mastery => t[id] ?? { ...FRESH };

export function recordTopic(t: Topics, id: string, a: Attempt): Topics {
  return { ...t, [id]: updateMastery(topicOf(t, id), a) };
}

/** A saved topic book, keeping only the subjects the game still has. */
export function cleanTopics(raw: unknown, allowed: readonly string[]): Topics {
  const out: Topics = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of allowed) {
    const m = (raw as Record<string, unknown>)[id];
    if (!m || typeof m !== 'object') continue;
    const { level, seen, streak, slump } = m as Record<string, unknown>;
    if (typeof level !== 'number' || !isFinite(level)) continue;
    out[id] = {
      level: clamp01(level),
      seen: typeof seen === 'number' && isFinite(seen) ? Math.max(0, Math.round(seen)) : 0,
      streak: typeof streak === 'number' && isFinite(streak) ? Math.max(0, Math.round(streak)) : 0,
      slump: typeof slump === 'number' && isFinite(slump) ? Math.max(0, Math.round(slump)) : 0,
    };
  }
  return out;
}

/**
 * Which of these subjects is worth doing next.
 *
 * Not the weakest one - that is where a child fails, and being sent to what you are worst at every
 * single time is how a game teaches you to dislike it. Not the strongest either. The one nearest
 * the edge: firm enough to stand on, soft enough to still be learning, and among equals the one
 * that has been left alone longest. An untouched subject counts as ready, because you cannot get
 * better at something you have never tried.
 */
export const READY = 0.55;

export function pickNext(t: Topics, ids: readonly string[]): string | null {
  let best: string | null = null, bestScore = -Infinity;
  for (const id of ids) {
    const m = t[id];
    // never tried: worth a lot, but behind anything a child is still in the middle of learning
    if (!m || m.seen === 0) { if (0.45 > bestScore) { bestScore = 0.45; best = id; } continue; }
    // How far from the middle of learning this is. Past it counts double, because there is less
    // left to find out there - but not endlessly, or a subject a child has finished would come
    // last behind one they cannot do at all.
    const gap = m.level > READY
      ? Math.min(0.55, (m.level - READY) * 2.4)
      : (READY - m.level) * 1.9;
    // and between two equals, the one that has been left alone longest
    const worn = Math.min(0.25, m.seen / 120);
    const score = 1 - gap - worn;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}
