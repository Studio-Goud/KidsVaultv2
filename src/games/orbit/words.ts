/**
 * A row of the Verken table, said as one sentence.
 *
 * The table under a planet is honest and complete - 142.984 km, 4331 aardse dagen - and useless to
 * a child who cannot read, which on this app is most of them. So a tap on a row says the row the
 * way a grown-up would say it to a child: "Een dag op Jupiter duurt bijna tien uur", "Jupiter is
 * ruim elf keer zo breed als de aarde". The figures stay on the screen for whoever reads; the
 * sentence is for whoever listens.
 *
 * Numbers are rounded before they are put into words, and the rounding is said out loud: "bijna",
 * "ruim", "ongeveer". A number that has been rounded without saying so is a number that is wrong,
 * and rule 5 of `CLAUDE.md` is that every figure says what it is. The rounding steps (whole numbers
 * under a hundred, fives under a thousand, hundreds and then thousands above that) are a product
 * decision about what a child can hold in one breath, not a measurement.
 *
 * Kept apart from the drawing so the tests can read it without a browser.
 */

import { numberWord } from '../numbers/numberwords';
import type { Body } from './bodies';

/** The rows a world's table has, top to bottom, in the order `explore.ts` draws them. */
export type Row = 'day' | 'year' | 'temp' | 'across' | 'moons' | 'around';

/** A star has no year and no moons; it is asked what goes round it instead. */
export const rowsFor = (b: Body): Row[] =>
  b.kind === 'star' ? ['day', 'temp', 'across', 'around'] : ['day', 'year', 'temp', 'across', 'moons'];

/** The earth's width, the yardstick every other world is measured against. In km, the same as `bodies.ts`. */
export const EARTH_KM = 12756;

export type How = 'exact' | 'about' | 'nearly' | 'over';

/**
 * Round a figure to something sayable, and say which way it was rounded.
 *
 * Under a hundred the step is one and a twelfth either side still counts as exact; above that the
 * step grows with the number, and the word is "about" when the figure is close to the round one.
 */
export function approx(x: number): { n: number; how: How } {
  const a = Math.abs(x);
  const step = a < 100 ? 1 : a < 1000 ? 5 : a < 10000 ? 100 : 1000;
  const n = Math.round(a / step) * step;
  const d = a - n;
  const slack = step === 1 ? 0.08 : step * 0.12;
  const how: How = Math.abs(d) < slack ? (step === 1 ? 'exact' : 'about') : d < 0 ? 'nearly' : 'over';
  return { n, how };
}

const HOW_NL: Record<How, string> = { exact: '', about: 'ongeveer ', nearly: 'bijna ', over: 'ruim ' };
const HOW_EN: Record<How, string> = { exact: '', about: 'about ', nearly: 'nearly ', over: 'just over ' };

/** A whole number in words, into the thousands: `numberWord` stops at a thousand and the sun does not. */
export function bigWord(n: number, nl: boolean): string {
  if (n < 1000) return numberWord(n, nl);
  const th = Math.floor(n / 1000), rest = n % 1000;
  if (nl) return `${th === 1 ? '' : numberWord(th, true)}duizend${rest ? ` ${numberWord(rest, true)}` : ''}`;
  return `${numberWord(th, false)} thousand${rest ? ` ${numberWord(rest, false)}` : ''}`;
}

/** A rounded figure with its rounding word in front: "bijna tien", "about five thousand five hundred". */
export function saidAs(x: number, nl: boolean): string {
  const { n, how } = approx(x);
  return `${(nl ? HOW_NL : HOW_EN)[how]}${bigWord(n, nl)}`;
}

/** The world as the subject of a sentence: "De aarde", "The Sun", "Jupiter". */
function subject(b: Body, nl: boolean): string {
  if (b.id === 'earth') return nl ? 'De aarde' : 'Earth';
  if (b.id === 'sun') return nl ? 'De zon' : 'The Sun';
  return nl ? b.nameNl : b.name;
}

/** The world after "op" or "on": "op aarde", "on the Sun", "op Jupiter". */
function on(b: Body, nl: boolean): string {
  if (b.id === 'earth') return nl ? 'aarde' : 'Earth';
  if (b.id === 'sun') return nl ? 'de zon' : 'the Sun';
  return nl ? b.nameNl : b.name;
}

/** The sentence for one row of a world's table, in the language asked for. */
export function rowSentence(b: Body, row: Row, nl: boolean): string {
  const star = b.kind === 'star';
  switch (row) {
    case 'day': {
      if (star) {
        const days = saidAs(b.dayHours / 24, nl);
        return nl ? `Een omwenteling van de zon duurt ${days} dagen.` : `One turn of the Sun takes ${days} days.`;
      }
      const inHours = b.dayHours < 48;
      const q = saidAs(inHours ? b.dayHours : b.dayHours / 24, nl);
      const unit = inHours ? (nl ? 'uur' : 'hours') : nl ? 'aardse dagen' : 'Earth days';
      return nl ? `Een dag op ${on(b, nl)} duurt ${q} ${unit}.` : `A day on ${on(b, nl)} lasts ${q} ${unit}.`;
    }
    case 'year': {
      // past six hundred days a year is easier to hear in years: Mars is "bijna twee aardse jaren"
      const inDays = b.yearDays < 600;
      const q = saidAs(inDays ? b.yearDays : b.yearDays / 365.25, nl);
      const unit = inDays ? (nl ? 'aardse dagen' : 'Earth days') : nl ? 'aardse jaren' : 'Earth years';
      return nl ? `Een jaar op ${on(b, nl)} duurt ${q} ${unit}.` : `A year on ${on(b, nl)} lasts ${q} ${unit}.`;
    }
    case 'temp': {
      const q = saidAs(b.tempC, nl);
      if (star) return nl ? `Aan het oppervlak van de zon is het ${q} graden.` : `At the surface of the Sun it is ${q} degrees.`;
      const below = b.tempC < 0 ? (nl ? ' onder nul' : ' below zero') : '';
      return nl ? `Op ${on(b, nl)} is het gemiddeld ${q} graden${below}.` : `On ${on(b, nl)} it is ${q} degrees${below} on average.`;
    }
    case 'across': {
      if (b.id === 'earth') {
        const q = saidAs(b.diameter, nl);
        return nl ? `De aarde is ${q} kilometer breed.` : `Earth is ${q} kilometres across.`;
      }
      const ratio = b.diameter / EARTH_KM;
      const s = subject(b, nl);
      if (ratio >= 1.5) {
        const q = saidAs(ratio, nl);
        return nl ? `${s} is ${q} keer zo breed als de aarde.` : `${s} is ${q} times as wide as Earth.`;
      }
      if (ratio >= 0.85) return nl ? `${s} is ongeveer even breed als de aarde.` : `${s} is about as wide as Earth.`;
      if (ratio >= 0.42) return nl ? `${s} is ongeveer half zo breed als de aarde.` : `${s} is about half as wide as Earth.`;
      if (ratio >= 0.28) return nl ? `${s} is ongeveer een derde zo breed als de aarde.` : `${s} is about a third as wide as Earth.`;
      // a world so small that it is easier to say how many of it fit across the earth
      const q = saidAs(1 / ratio, nl);
      return nl ? `De aarde is ${q} keer zo breed als ${on(b, nl)}.` : `Earth is ${q} times as wide as ${on(b, nl)}.`;
    }
    case 'moons': {
      const s = subject(b, nl);
      if (b.moonCount === 0) return nl ? `${s} heeft geen manen.` : `${s} has no moons.`;
      if (b.moonCount === 1) return nl ? `${s} heeft één maan.` : `${s} has one moon.`;
      return nl ? `${s} heeft minstens ${bigWord(b.moonCount, true)} manen.` : `${s} has at least ${bigWord(b.moonCount, false)} moons.`;
    }
    case 'around':
      return nl ? 'Om de zon draaien acht planeten, en al het andere.' : 'Eight planets go round the Sun, and everything else.';
  }
}
