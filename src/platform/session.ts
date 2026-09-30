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
 * became two to ten afterwards, and two to eight on 2026-09-30 (`docs/decisions.md`). The numbers below for seven and up are a
 * product decision by me and nothing more, chosen to keep rising gently rather than to match any
 * guideline. They are marked here so that nobody quotes them as advice, and they are the first
 * thing to replace once the older band has been researched.
 */
export function limitsForAge(years: number): Limits {
  if (years <= 4) return { perDay: 30, perSitting: 10 };
  if (years <= 6) return { perDay: 60, perSitting: 15 };
  return { perDay: 75, perSitting: 20 };                    // not a guideline: see above
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

/**
 * What was played, day by day: `{ '2026-09-30': { dig: 4.25, reis: 6 } }` for one child.
 *
 * This is the other half of "see what your child practises". The day's tally says how long; the
 * log says on what, so the parent's screen can put the catalogue's "practises" line next to it. It
 * keeps the last `LOG_DAYS` days and nothing more: it is a week's view, not a record, and it never
 * leaves the device (rule 1). No streaks, no totals over time, no comparison between children.
 */
export type DayLog = Record<string, number>;
export type ChildLog = Record<string, DayLog>;
export const LOG_DAYS = 28;

/** A log read back from disk: only dates, only known-looking ids, only finite minutes, recent only. */
export function cleanLog(raw: unknown, today: string): ChildLog {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ChildLog = {};
  const floor = shiftDay(today, -LOG_DAYS);
  for (const [date, day] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < floor || !day || typeof day !== 'object' || Array.isArray(day)) continue;
    const d: DayLog = {};
    for (const [id, m] of Object.entries(day as Record<string, unknown>)) {
      if (/^[a-z]+$/.test(id) && typeof m === 'number' && isFinite(m) && m > 0) d[id] = Math.round(m * 4) / 4;
    }
    if (Object.keys(d).length) out[date] = d;
  }
  return out;
}

/** The same log with `minutes` more on `id` for `today`. */
export function logMinutes(log: ChildLog, today: string, id: string, minutes: number): ChildLog {
  const day = { ...(log[today] ?? {}) };
  day[id] = Math.round(((day[id] ?? 0) + minutes) * 4) / 4;
  return { ...log, [today]: day };
}

/** The last seven days up to and including today, summed per thing, most played first. */
export function weekOf(log: ChildLog, today: string): Array<{ id: string; minutes: number; days: number }> {
  const from = shiftDay(today, -6);
  const sum = new Map<string, { minutes: number; days: number }>();
  for (const [date, day] of Object.entries(log)) {
    if (date < from || date > today) continue;
    for (const [id, m] of Object.entries(day)) {
      const s = sum.get(id) ?? { minutes: 0, days: 0 };
      sum.set(id, { minutes: s.minutes + m, days: s.days + 1 });
    }
  }
  return [...sum.entries()].map(([id, s]) => ({ id, minutes: Math.round(s.minutes), days: s.days })).sort((a, b) => b.minutes - a.minutes);
}

/** A day key moved by `n` days, so "seven days ago" needs no Date arithmetic elsewhere. */
export function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return dayKey(t);
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
    // to the quarter minute, because that is what the clock writes every fifteen seconds: rounding
    // to whole minutes here read 0.25 back as 0 every tick, and the day never ran out
    minutes: typeof r.minutes === 'number' && isFinite(r.minutes) ? Math.max(0, Math.round(r.minutes * 4) / 4) : 0,
    finished: typeof r.finished === 'number' && isFinite(r.finished) ? Math.max(0, Math.round(r.finished)) : 0,
  };
}
