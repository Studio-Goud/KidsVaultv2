/**
 * Postbode Suri: the logic of a street, a bag of letters and the numbers on the doors.
 *
 * A letter says a number, the child finds the house with that number and taps its door. That is the
 * whole game, and it is deliberately the part of counting a child meets on the way to school: the
 * numbers on a street run in order, odd on one side and even on the other, and a house with a tree
 * in front of it still has a number, which you can work out from its neighbour. This file knows
 * nothing about canvases; the street, the letters, the lines Suri says and the stars are all here so
 * a test can play a round without a browser.
 *
 * It practises reading numbers off doors and counting on along a row. It does not claim that a child
 * will learn to count: that would need measuring and nobody has measured this (CLAUDE.md rule 3).
 */

import { makeRng } from '../../util/rng';
// the app already spells Dutch numbers correctly (tweeëntwintig, drieëndertig); one speller, not two
import { numberWord as spell } from '../numbers/numberwords';

export type Lang = 'nl' | 'en';
export type Side = 'near' | 'far';
export type Resident = 'grandma' | 'child' | 'dog' | 'man';
export const RESIDENTS: Resident[] = ['grandma', 'child', 'dog', 'man'];

/** Product decision: ten letters a round, so a round is as long as in the other games (about three minutes). */
export const LETTERS_PER_ROUND = 10;
/** Product decision: the simple shape (age 2 and 3) is the five houses of one screen, one letter each. */
export const EASY_LETTERS = 5;
/** Product decision: first-try deliveries for three stars, and for two. Finishing always earns one: a round has no way to fail. */
export const THREE_STARS_AT = 9;
export const TWO_STARS_AT = 6;
/**
 * Product decision, simple shape only: the right door starts to glow softly this many seconds after the
 * letter is read out, and sooner after a wrong door. Nothing is lost by waiting.
 */
export const GLOW_AFTER = 4;
export const GLOW_AFTER_MISS = 1.5;

export interface Level {
  /** 1-based, and the key in the save is `postbode:<id>` */
  id: number;
  name: string;
  nameNl: string;
  hint: string;
  hintNl: string;
  /** highest house number in the street */
  max: number;
  /** one side of the street, or odd numbers on one side and even on the other like a real Dutch street */
  sides: 'one' | 'two';
  /** share of houses that stand behind a tree, 0 for none */
  hidden: number;
  /** a parcel too big for the slot: find the number, then ring the bell */
  parcel: boolean;
  letters: number;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Short street', nameNl: 'Korte straat', max: 10, sides: 'one', hidden: 0, parcel: false, letters: LETTERS_PER_ROUND,
    hint: 'Find the house with the number on the letter.', hintNl: 'Zoek het huis met het nummer van de brief.' },
  { id: 2, name: 'Long street', nameNl: 'Lange straat', max: 20, sides: 'one', hidden: 0, parcel: false, letters: LETTERS_PER_ROUND,
    hint: 'The street is longer now. Slide it along with your finger.', hintNl: 'De straat is langer. Schuif hem op met je vinger.' },
  { id: 3, name: 'Odd and even', nameNl: 'Even en oneven', max: 20, sides: 'two', hidden: 0, parcel: false, letters: LETTERS_PER_ROUND,
    hint: 'Odd numbers on one side, even numbers on the other.', hintNl: 'Oneven nummers aan de ene kant, even nummers aan de andere.' },
  { id: 4, name: 'Behind the trees', nameNl: 'Achter de bomen', max: 40, sides: 'two', hidden: 0.25, parcel: false, letters: LETTERS_PER_ROUND,
    hint: 'A tree hides some numbers. Count on from the neighbour.', hintNl: 'Een boom verbergt soms een nummer. Tel door vanaf de buren.' },
  { id: 5, name: 'The big parcel', nameNl: 'Het grote pakje', max: 40, sides: 'two', hidden: 0, parcel: true, letters: LETTERS_PER_ROUND,
    hint: 'A parcel does not fit the slot. Find the house, then ring the bell.', hintNl: 'Een pakje past niet door de gleuf. Zoek het huis en druk op de bel.' },
];

/** Age two and three: five houses that fit one screen, no scrolling, nothing to lose (src/platform/who.ts). */
export const SIMPLE_LEVEL: Level = {
  id: 0, name: 'Five houses', nameNl: 'Vijf huizen', max: 5, sides: 'one', hidden: 0, parcel: false, letters: EASY_LETTERS,
  hint: 'Find the house with the number on the letter.', hintNl: 'Zoek het huis met het nummer van de brief.',
};

export interface House {
  n: number;
  side: Side;
  /** place along its own row, from the start of the street */
  index: number;
  hidden: boolean;
  resident: Resident;
}

export interface Letter { n: number; parcel: boolean }

export const rngFor = (level: Level, attempt: number): (() => number) => makeRng(level.id * 7919 + attempt * 104729 + 11);

/** The number as a spoken word. Dutch "1" is written één, so the sound is not mistaken for the article. */
export function numberWord(n: number, lang: Lang): string {
  const nl = lang === 'nl';
  if (nl && n === 1) return 'één';
  return spell(n, nl);
}

/** Which side of the road a number lives on: everything on one side, or odd near and even far. */
export function sideOf(n: number, level: Level): Side {
  if (level.sides === 'one') return 'near';
  return n % 2 === 1 ? 'near' : 'far';
}

/** The place of a number along its row. 1 and 2 stand opposite each other, so do 3 and 4. */
export function indexOf(n: number, level: Level): number {
  return level.sides === 'one' ? n - 1 : Math.floor((n - 1) / 2);
}

/** How many houses stand along one row. */
export function rowLength(level: Level): number {
  return level.sides === 'one' ? level.max : Math.ceil(level.max / 2);
}

/**
 * The street: every house with its number, its side and who lives in it. A house behind a tree is
 * never next to another one in its own row, so there is always a neighbour with a number you can
 * read and count on from.
 */
export function street(level: Level, rng: () => number): House[] {
  const houses: House[] = [];
  for (let n = 1; n <= level.max; n++) {
    houses.push({ n, side: sideOf(n, level), index: indexOf(n, level), hidden: false, resident: RESIDENTS[Math.floor(rng() * RESIDENTS.length)] });
  }
  if (level.hidden > 0) {
    const want = Math.round(level.max * level.hidden);
    const step = level.sides === 'one' ? 1 : 2;
    const order = houses.map(h => h.n);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let made = 0;
    for (const n of order) {
      if (made >= want) break;
      // the first two houses of the street stay open, so a child always starts from a number they can see
      if (n <= 2) continue;
      const near = houses.find(h => h.n === n - step), far = houses.find(h => h.n === n + step);
      if (near?.hidden || far?.hidden) continue;
      houses[n - 1].hidden = true; made++;
    }
  }
  return houses;
}

/**
 * The next letter in the bag: a house that has not had one this round. With trees in the street
 * about half the letters are for a hidden house, because those are the ones the level is about.
 */
export function nextLetter(level: Level, rng: () => number, houses: House[], used: number[]): Letter {
  const left = houses.filter(h => !used.includes(h.n));
  const pool = left.length ? left : houses;
  let pick = pool;
  if (level.hidden > 0) {
    const wantHidden = rng() < 0.5;
    const some = pool.filter(h => h.hidden === wantHidden);
    if (some.length) pick = some;
  }
  return { n: pick[Math.floor(rng() * pick.length)].n, parcel: level.parcel };
}

/** Is this the house the letter is for? */
export function isRight(letter: Letter, houseNumber: number): boolean { return letter.n === houseNumber; }

/** Stars for a round, by letters delivered at the first try. Product decision, see the constants. */
export function starsFor(firstTry: number): number {
  return firstTry >= THREE_STARS_AT ? 3 : firstTry >= TWO_STARS_AT ? 2 : 1;
}

// ---- what Suri says. Whole lines, so the voice script can render them in advance.

export function askLine(l: Letter, lang: Lang): string {
  const w = numberWord(l.n, lang);
  if (lang === 'nl') return l.parcel ? `Een pakje voor nummer ${w}.` : `Een brief voor nummer ${w}.`;
  return l.parcel ? `A parcel for number ${w}.` : `A letter for number ${w}.`;
}

export function wrongLine(tapped: number, wanted: number, lang: Lang): string {
  const a = numberWord(tapped, lang), b = numberWord(wanted, lang);
  return lang === 'nl' ? `Dat is nummer ${a}. We zoeken ${b}.` : `That is number ${a}. We are looking for ${b}.`;
}

export const PARCEL_LINE = { en: 'This parcel does not fit through the slot. Ring the bell.', nl: 'Dit pakje past niet door de gleuf. Druk op de bel.' };
export const DONE_LINE = { en: 'All the post is delivered.', nl: 'Alle post is bezorgd.' };
