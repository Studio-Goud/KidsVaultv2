/**
 * Where you are on a journey, and what happens next.
 *
 * This is the whole of a journey's behaviour and none of its appearance: no canvas, no sound, no
 * storage. Everything below takes a trip and gives back a new one, so the rules of the format can
 * be checked without a browser - which matters more here than anywhere else in the app, because
 * this engine is meant to carry five different journeys and a rule that breaks breaks all of them.
 *
 * ## The one rule
 *
 * You are either moving or held. Moving, the route carries you and nothing you do changes that.
 * Held at a stop, nothing moves until you say so. There is no timer anywhere: a child who wants
 * to look at Jupiter for two minutes looks at Jupiter for two minutes, and `docs/research.md`
 * §3.2 is the reason - what ends a sitting should be the end of the thing, not a clock inside it.
 */

import type { Journey, Stop } from './types';

export interface Trip {
  /** how far along, 0..1 */
  at: number;
  /** the stop we are held at, or null while travelling */
  held: string | null;
  /** which line of the held stop is on: 0 is the arrival line, then one per extra beat */
  beat: number;
  /** every stop that has ever been reached, across rides: what the overview colours in */
  seen: string[];
  /**
   * the stops passed on this ride, which is what the route steers by. It used to steer by `seen`,
   * and a journey ridden to its end once was then over the moment it was started again: every stop
   * was already behind it. The owner found that on a phone - Pluto on the screen at 0 km.
   */
  passed: string[];
  /** the route is finished and the last stop has been left */
  done: boolean;
  /** the engine has been started at all */
  going: boolean;
}

/** How long one leg takes, whatever its real length. A journey is a pace, not a distance. */
export const LEG_SECONDS = 2.6;

export function begin(): Trip {
  return { at: 0, held: null, beat: 0, seen: [], passed: [], done: false, going: false };
}

/** Press start. Does nothing to a trip that is already going. */
export function setOff(t: Trip): Trip {
  return t.going ? t : { ...t, going: true };
}

export const stopById = (j: Journey, id: string | null): Stop | null =>
  (id ? j.stops.find(s => s.id === id) ?? null : null);

/** The next stop ahead of `at` that has not been reached. */
export function ahead(j: Journey, t: Trip): Stop | null {
  for (const s of j.stops) if (!t.passed.includes(s.id) && s.at >= t.at - 1e-6) return s;
  return null;
}

/**
 * Let time pass.
 *
 * A leg always takes `LEG_SECONDS`, so the gap between two stops on the screen is a gap in time
 * and not in kilometres. Neptune is thirty times further out than Earth; a child waiting thirty
 * times as long for it would not be learning that, they would be putting the phone down.
 */
export function travel(j: Journey, t: Trip, dt: number): Trip {
  if (!t.going || t.held || t.done) return t;
  const next = ahead(j, t);
  if (!next) return { ...t, done: true };
  const from = lastAt(j, t);
  const span = Math.max(1e-4, next.at - from);
  const at = Math.min(next.at, t.at + (span / LEG_SECONDS) * dt);
  if (at >= next.at - 1e-6) {
    return {
      ...t, at: next.at, held: next.id, beat: 0,
      seen: t.seen.includes(next.id) ? t.seen : [...t.seen, next.id],
      passed: [...t.passed, next.id],
    };
  }
  return { ...t, at };
}

/** Where the last leg started: the stop behind us, or the beginning. */
function lastAt(j: Journey, t: Trip): number {
  let out = 0;
  for (const s of j.stops) if (t.passed.includes(s.id) && s.at <= t.at + 1e-6) out = s.at;
  return out;
}

/** How many more things there are to hear about the stop we are held at. */
export function leftToTell(j: Journey, t: Trip): number {
  const s = stopById(j, t.held);
  return s ? Math.max(0, s.more.length - t.beat) : 0;
}

/** Tap for more. When there is nothing left to tell, the trip comes back unchanged. */
export function tellMore(j: Journey, t: Trip): Trip {
  return leftToTell(j, t) > 0 ? { ...t, beat: t.beat + 1 } : t;
}

/** Go on. From the last stop this ends the journey. */
export function onward(j: Journey, t: Trip): Trip {
  if (!t.held) return t;
  const last = j.stops[j.stops.length - 1];
  if (t.held === last.id) return { ...t, held: null, beat: 0, at: 1, done: true };
  return { ...t, held: null, beat: 0 };
}

/** Jump straight to a stop, which is what the encyclopedia does. Nothing is skipped over: */
export function goTo(j: Journey, t: Trip, id: string): Trip {
  const s = stopById(j, id);
  if (!s) return t;
  return {
    ...t, at: s.at, held: s.id, beat: 0, going: true, done: false,
    seen: t.seen.includes(id) ? t.seen : [...t.seen, id],
    // everything up to the stop jumped to counts as passed, so the ride goes on from there
    passed: j.stops.filter(x => x.at <= s.at + 1e-6).map(x => x.id),
  };
}

/** What the guide is saying right now, or nothing while we are moving. */
export function lineNow(j: Journey, t: Trip, nl: boolean): string {
  const s = stopById(j, t.held);
  if (!s) return '';
  if (t.beat === 0) return nl ? s.sayNl : s.say;
  const b = s.more[t.beat - 1];
  return b ? (nl ? b.sayNl : b.say) : '';
}

/**
 * The number on the gauge at a point along the route.
 *
 * Piecewise between the stops, because the stops are evenly spread on the screen and the real
 * scale is not. Between the surface and two hundred metres the gauge counts in tens; between four
 * thousand and eleven thousand it counts in hundreds. That is the honest reading of an unfair
 * scale, and it is the same shape of lie every map of the solar system tells.
 */
export function reading(j: Journey, at: number): number {
  const s = j.stops;
  if (!s.length) return 0;
  if (at <= s[0].at) return s[0].mark;
  for (let i = 1; i < s.length; i++) {
    if (at <= s[i].at) {
      const span = s[i].at - s[i - 1].at;
      const k = span <= 0 ? 1 : (at - s[i - 1].at) / span;
      return s[i - 1].mark + (s[i].mark - s[i - 1].mark) * k;
    }
  }
  return s[s.length - 1].mark;
}

/** The colour of the world at a point, blended between the stops on either side. */
export function toneAt(j: Journey, at: number): string {
  const s = j.stops;
  if (!s.length) return '#000000';
  if (at <= s[0].at) return s[0].tone;
  for (let i = 1; i < s.length; i++) {
    if (at <= s[i].at) {
      const span = s[i].at - s[i - 1].at;
      return mix(s[i - 1].tone, s[i].tone, span <= 0 ? 1 : (at - s[i - 1].at) / span);
    }
  }
  return s[s.length - 1].tone;
}

const hex = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
];

/** Two colours, k of the way from the first to the second. */
export function mix(a: string, b: string, k: number): string {
  const x = hex(a), y = hex(b), t = Math.max(0, Math.min(1, k));
  const p = (i: number): string => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return '#' + p(0) + p(1) + p(2);
}

/** How much of the journey has been seen, for the hub and for the parent screen. */
export const seenAll = (j: Journey, seen: string[]): boolean =>
  j.stops.every(s => seen.includes(s.id));
