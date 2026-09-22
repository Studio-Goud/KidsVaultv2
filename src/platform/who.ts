import { save } from '../util/storage';
import { cleanChild, type Child } from './session';

/**
 * Who is playing, and how old they are.
 *
 * The parent's screen writes a child down once; every game reads it from here. It is one small
 * module rather than a line in each game because the answer decides more than the clock: below
 * `SIMPLE_UPTO` a game shows its simplest shape, and that has to mean the same thing everywhere.
 *
 * ## What "simplest shape" means
 *
 * `docs/research.md` §2.1: a two-year-old points and drags, does not read, does not hold a rule in
 * mind, and cannot tell a mistake from a surprise. So in the simple shape of a game there is:
 *
 *  - one gesture, and no choice of tool or mode before it;
 *  - nothing to read that matters - anything that matters is said out loud;
 *  - no question with a wrong answer, no timer, and no way to lose.
 *
 * It is not a smaller version of the real game. It is the part of the game that already works
 * without any of that, with the rest taken away.
 */

/** Up to and including this age, a game shows its simplest shape. */
export const SIMPLE_UPTO = 3;

/** The child the parent last handed the phone to, or nobody. */
export function playingChild(): Child | null {
  const id = save.family?.playing;
  if (!id) return null;
  const row = (save.family.children ?? []).find(c => c.id === id);
  return row ? cleanChild(row) : null;
}

/** The playing child's age, or null when the parent has not filled anything in. */
export function yearsNow(): number | null {
  // a debug hook, like __insets: the audit and the tests play every age without a profile
  const forced = (window as unknown as { __years?: number }).__years;
  if (typeof forced === 'number') return forced;
  const c = playingChild();
  return c ? c.years : null;
}

/**
 * Pure, so the rule can be checked without a browser.
 *
 * No profile means no simple shape. That is deliberate: someone who opens the app cold gets the
 * whole thing, and a parent who wants the toddler version says how old their child is. Guessing
 * the other way would meet every new grown-up with a game stripped of its game.
 */
export function simpleFor(years: number | null): boolean {
  return years !== null && years <= SIMPLE_UPTO;
}

/** Is the child playing now a toddler? */
export function simpleNow(): boolean { return simpleFor(yearsNow()); }
