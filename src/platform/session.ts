import type { Domain } from './catalog';

/**
 * How long a child has been at it today, and what happens when the time is up.
 *
 * This is the part of the parent's promise that the app actually keeps, so it is kept here on its
 * own, with no canvas and no storage in it: everything below is a pure function of what it is
 * given, and can be checked without a browser.
 *
 * ## Why there is no countdown
 *
 * The obvious design is a warning a few minutes before the end. `docs/research.md` §3.2 says not
 * to: Hiniker e.a. (CHI 2016) found that a "two more minutes" warning made the handover *harder*
 * for children of one to five, while a natural endpoint, a routine, or an outside cause made it
 * easier. So what happens here instead is:
 *
 *  1. when what is left is shorter than one more sitting, the next thing a child picks is
 *     announced as the last one;
 *  2. it is played to its own end - a rocket lands, a puzzle finishes - rather than cut off;
 *  3. then the same closing every time, and the day is done.
 *
 * A parent who wants the warning anyway can switch it on. It is off by default, and that default
 * is the researched one rather than the intuitive one.
 */

/** Minutes. `perSitting` is one go; `perDay` is everything. */
export interface Limits {
  perDay: number;
  perSitting: number;
}

/**
 * What the guidance says, by age.
 *
 * Two to six comes from the Nederlands Jeugdinstituut, by way of `docs/research.md` §3.1: five to
 * ten minutes a go and half an hour a day for two to four, ten to fifteen and an hour for four to
 * six. The higher end of each is taken, because these are ceilings a parent may lower.
 *
 * **Seven and up has no source.** The research was done for an app for two to six; the age range
 * became two to ten afterwards (`docs/decisions.md`). The numbers below for seven and up are a
 * product decision by me and nothing more, chosen to keep rising gently rather than to match any
 * guideline. They are marked here so that nobody quotes them as advice, and they are the first
 * thing to replace once the older band has been researched.
 */
export function limitsForAge(years: number): Limits {
  if (years <= 4) return { perDay: 30, perSitting: 10 };
  if (years <= 6) return { perDay: 60, perSitting: 15 };
  if (years <= 8) return { perDay: 75, perSitting: 20 };   // not a guideline: see above
  return { perDay: 90, perSitting: 25 };                    // not a guideline: see above
}

/** True where the number above is somebody's advice rather than ours. */
export const limitIsGuidance = (years: number): boolean => years <= 6;

/** One child. A family has several, and they do not share a day. */
export interface Child {
  id: string;
  name: string;
  years: number;
  /** which subjects are on offer; empty means all of them */
  domains: Domain[];
  /** minutes, or null to follow the guidance for the age */
  limits: Limits | null;
  /** the parent asked for a warning before the end, against the research */
  warn: boolean;
}

/** What has been used up, per child, per day. */
export interface Used {
  /** `2026-09-22`, so a new day is a new date and nothing has to be scheduled */
  date: string;
  minutes: number;
  /** how many things have been finished today, for the parent's overview */
  finished: number;
}

export const FRESH_USED: Used = { date: '', minutes: 0, finished: 0 };

/** Today, as the app writes it. Local time, because a child's day is a local thing. */
export function dayKey(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Yesterday's tally, seen today, is an empty one. */
export function useToday(used: Used, today: string): Used {
  return used.date === today ? used : { date: today, minutes: 0, finished: 0 };
}

export const limitsFor = (c: Child): Limits => c.limits ?? limitsForAge(c.years);

/** How many minutes are left today. Never below zero. */
export function leftToday(used: Used, c: Child, today: string): number {
  const u = useToday(used, today);
  return Math.max(0, limitsFor(c).perDay - u.minutes);
}

/**
 * Is there room for one more thing?
 *
 * `typical` is how long that thing usually takes, from the catalogue. Something that needs twelve
 * minutes is not offered when four are left: starting it would guarantee the cut-off the whole
 * design is trying to avoid.
 */
export function roomFor(used: Used, c: Child, today: string, typical: number): boolean {
  return leftToday(used, c, today) >= Math.min(typical, limitsFor(c).perSitting);
}

/**
 * Is the thing a child is about to pick the last one of the day?
 *
 * This is what the guide announces, and it is deliberately generous: anything under two typical
 * sittings counts, so "this is your last one" arrives while there is still a whole game left to
 * enjoy, not in its final seconds.
 */
export function isLastGo(used: Used, c: Child, today: string, typical: number): boolean {
  const left = leftToday(used, c, today);
  return left > 0 && left < Math.max(typical, limitsFor(c).perSitting) * 2;
}

/** Nothing more today. */
export function spent(used: Used, c: Child, today: string): boolean {
  return leftToday(used, c, today) <= 0;
}

/** Count the minutes that have just passed. */
export function spend(used: Used, today: string, minutes: number): Used {
  const u = useToday(used, today);
  return { ...u, minutes: Math.max(0, u.minutes + Math.max(0, minutes)) };
}

/** One more thing played to its end, which is the only kind of progress a parent is shown. */
export function finished(used: Used, today: string): Used {
  const u = useToday(used, today);
  return { ...u, finished: u.finished + 1 };
}

/** Whether a subject is on offer to this child. An empty list means everything. */
export const allows = (c: Pick<Child, 'domains'>, d: Domain[]): boolean =>
  c.domains.length === 0 || d.some(x => c.domains.includes(x));

/** A save that has been hand-edited, truncated or written by an older version. */
export function cleanChild(raw: unknown): Child | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const years = typeof r.years === 'number' && isFinite(r.years)
    ? Math.max(2, Math.min(10, Math.round(r.years))) : 5;
  const lim = r.limits as Record<string, unknown> | null | undefined;
  const limits = lim && typeof lim.perDay === 'number' && typeof lim.perSitting === 'number'
    ? {
      perDay: Math.max(5, Math.min(240, Math.round(lim.perDay))),
      perSitting: Math.max(3, Math.min(60, Math.round(lim.perSitting))),
    }
    : null;
  return {
    id: r.id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 24) : '',
    years,
    domains: Array.isArray(r.domains) ? (r.domains.filter(x => typeof x === 'string') as Domain[]) : [],
    limits,
    warn: r.warn === true,
  };
}

export function cleanUsed(raw: unknown): Used {
  if (!raw || typeof raw !== 'object') return { ...FRESH_USED };
  const r = raw as Record<string, unknown>;
  return {
    date: typeof r.date === 'string' ? r.date : '',
    minutes: typeof r.minutes === 'number' && isFinite(r.minutes) ? Math.max(0, Math.round(r.minutes)) : 0,
    finished: typeof r.finished === 'number' && isFinite(r.finished) ? Math.max(0, Math.round(r.finished)) : 0,
  };
}
