/**
 * Letterbos: the ladder, and where every question on it comes from.
 *
 * Nine levels, in the order a Dutch school teaches reading and for the same reasons. Nothing here
 * touches a canvas: a level is a rule, a question is a word with a rack of tiles beside it, and
 * both are plain data that the tests can hold to account.
 *
 *  1 klanken        three letters and a short vowel. *bus*, *kat*, *vis*. The rack holds exactly
 *                   what the word needs and one letter that looks like one of them.
 *  2 lange klank    *maan*, *boom*. The rack offers the `aa` as one tile *and* the single `a`
 *                   beside it, because the thing being taught is that `aa` is one sound.
 *  3 tweetekenklank *ui*, *oe*, *eu*, *ie*, *eeuw*: one sound, two letters, one tile.
 *  4 ei of ij       both are /ɛi/ and only the word says which. The word is built except for that
 *                   one place, and the child picks.
 *  5 au of ou       the same trap again.
 *  6 medeklinkers   *schaap*, *straat*, *angst*, *herfst*: consonants stacked up.
 *  7 hakken         backwards: the word is written out, and the child cuts it into its sounds.
 *  8 woordtrap      change one sound: *poot* to *pot*, *kat* to *kam*. The strongest exercise in
 *                   the game, because nothing else makes one sound stand out that clearly.
 *  9 zinnetjes      three or four words into a sentence that then reads itself out loud.
 */

import { makeRng } from '../../util/rng';
import { isDigraph, pickDistractor, sameSound, spellingName } from './phonics';
import { byWord, LADDERS, SENTENCES, SENTENCE_WORDS, stepBetween, WORDS, wordsIn, type Band, type Word } from './words';

export type LevelKind = 'build' | 'choose' | 'chop' | 'ladder' | 'sentence';

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  kind: LevelKind;
  rounds: number;
  /** which words this level draws on */
  bands: Band[];
  /** how many wrong tiles go on the rack beside the right ones */
  extras: number;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  {
    id: 'klanken', name: 'Sounds', nameNl: 'Klanken', kind: 'build', rounds: 6, bands: ['kort'], extras: 1,
    hint: 'Listen to the word, then to each sound. Drag the letters into the boxes.',
    hintNl: 'Luister naar het woord, en dan naar elke klank. Sleep de letters in de vakjes.',
  },
  {
    id: 'lange', name: 'The long sound', nameNl: 'Lange klank', kind: 'build', rounds: 6, bands: ['lang'], extras: 1,
    hint: 'Two letters, one sound: the aa of maan is a single tile.',
    hintNl: 'Twee letters, één klank: de aa van maan is samen één tegel.',
  },
  {
    id: 'tweeteken', name: 'Two letters, one sound', nameNl: 'Tweetekenklank', kind: 'build', rounds: 6, bands: ['duo'], extras: 2,
    hint: 'ui, oe, eu, ie: you cannot hear two letters, so they come as one tile.',
    hintNl: 'ui, oe, eu, ie: je hoort er maar één klank, dus zijn ze samen één tegel.',
  },
  {
    id: 'eiij', name: 'ei or ij', nameNl: 'ei of ij', kind: 'choose', rounds: 8, bands: ['ei', 'ij'], extras: 0,
    hint: 'They sound exactly the same. Only the word itself says which one it is.',
    hintNl: 'Ze klinken precies hetzelfde. Alleen het woord zelf zegt welke het is.',
  },
  {
    id: 'auou', name: 'au or ou', nameNl: 'au of ou', kind: 'choose', rounds: 8, bands: ['au', 'ou'], extras: 0,
    hint: 'au and ou are one sound too. This one has to be learned by heart, word by word.',
    hintNl: 'au en ou zijn ook één klank. Deze moet je uit je hoofd leren, woord voor woord.',
  },
  {
    id: 'cluster', name: 'Letters in a row', nameNl: 'Letters achter elkaar', kind: 'build', rounds: 6, bands: ['cluster'], extras: 2,
    hint: 'Three consonants in a row, and every one of them is heard. Say them slowly.',
    hintNl: 'Drie medeklinkers achter elkaar, en je hoort ze allemaal. Zeg ze langzaam.',
  },
  {
    id: 'hakken', name: 'Chop it up', nameNl: 'Woorden hakken', kind: 'chop', rounds: 6,
    bands: ['lang', 'duo', 'ei', 'ij', 'ou', 'cluster'], extras: 0,
    hint: 'Now the other way round: tap where the word falls apart into sounds.',
    hintNl: 'Nu andersom: tik waar het woord uit elkaar valt in klanken.',
  },
  {
    id: 'trap', name: 'Word ladder', nameNl: 'Van woord naar woord', kind: 'ladder', rounds: 6,
    bands: ['kort', 'lang'], extras: 2,
    hint: 'One sound changes and the word is something else. Listen for which one.',
    hintNl: 'Eén klank verandert, en het is een ander woord. Luister welke het is.',
  },
  {
    id: 'zinnen', name: 'Little sentences', nameNl: 'Zinnetjes', kind: 'sentence', rounds: 5, bands: [], extras: 1,
    hint: 'Put the words in order, and the sentence reads itself out.',
    hintNl: 'Zet de woorden op volgorde, dan leest de zin zichzelf voor.',
  },
];

export interface Question {
  kind: LevelKind;
  /** the word being built, or the sentence written out */
  word: string;
  en: string;
  /** which drawing goes above it: a word's picture, or a sentence's scene */
  pic: string;
  /** what goes in the slots, left to right: sounds, or whole words in a sentence */
  parts: string[];
  /** the tiles on the rack, already shuffled */
  rack: string[];
  /** slots that start filled in. A choosing question is a word with one hole in it. */
  filled: Array<string | null>;
  /** the slot the question is really about, or -1 when the whole word is */
  focus: number;
  /** the word before this one, on the ladder */
  from?: string;
  /** chopping: the letter positions a cut belongs at */
  gaps?: number[];
  /** chopping: how many letters the word has, so the gaps can be laid out */
  letters?: string[];
}

export const rngFor = (level: Level, attempt: number): (() => number) =>
  makeRng(level.id.length * 733 + attempt * 61 + 17);

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * The tiles on the rack: everything the word needs, and `extras` tiles that do not belong.
 *
 * On the long-vowel level one of those extras is fixed rather than chosen: the single letter of
 * the doubled vowel, so `maan` is offered an `a` beside its `aa`. A child who reaches for the `a`
 * is making exactly the mistake the level exists to catch, and the game can then say why.
 */
export function rackFor(word: Word, level: Level, rng: () => number): string[] {
  const tiles = word.parts.slice();
  const extras: string[] = [];
  if (level.id === 'lange') {
    const long = word.parts.find(p => p.length === 2 && p[0] === p[1]);
    if (long) extras.push(long[0]);
  }
  while (extras.length < level.extras) {
    const d = pickDistractor(word.parts, rng, extras);
    if (extras.includes(d)) break;
    extras.push(d);
  }
  return shuffle([...tiles, ...extras], rng);
}

/** Where a word falls apart: the letter positions a cut belongs at, for the chopping level. */
export function cutsOf(parts: string[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (let i = 0; i < parts.length - 1; i++) { at += parts[i].length; out.push(at); }
  return out;
}

/**
 * One question, with the words this level has already asked about kept out of the way.
 *
 * Eight rounds drawn freely from ten words will ask the same one three times, which feels broken
 * even when it is only chance.
 */
export function makeQuestion(level: Level, rng: () => number, index: number, avoid: string[] = []): Question {
  for (let tries = 0; tries < 30; tries++) {
    const q = roll(level, rng, index);
    if (!avoid.includes(q.word)) return q;
  }
  return roll(level, rng, index);
}

function roll(level: Level, rng: () => number, index: number): Question {
  if (level.kind === 'sentence') return sentenceQuestion(rng);
  if (level.kind === 'ladder') return ladderQuestion(rng, index);
  const pool = wordsIn(...level.bands);
  const word = pick(rng, level.kind === 'chop' ? pool.filter(w => w.parts.length >= 3) : pool);
  if (level.kind === 'chop') {
    return {
      kind: 'chop', word: word.w, en: word.en, pic: word.pic, parts: word.parts,
      rack: [], filled: word.parts.map(() => null), focus: -1,
      gaps: cutsOf(word.parts), letters: word.w.split(''),
    };
  }
  if (level.kind === 'choose') return chooseQuestion(word, rng);
  return {
    kind: 'build', word: word.w, en: word.en, pic: word.pic, parts: word.parts,
    rack: rackFor(word, level, rng), filled: word.parts.map(() => null), focus: -1,
  };
}

/**
 * The ei/ij and au/ou question: the word is already there except for the one place that is the
 * trap, and the two spellings of that one sound are the only tiles on the rack.
 */
export function chooseQuestion(word: Word, rng: () => number): Question {
  const at = word.parts.findIndex(p => ['ei', 'ij', 'au', 'ou', 'auw', 'ouw'].includes(p));
  const right = word.parts[at];
  const twin = right === 'ei' ? 'ij' : right === 'ij' ? 'ei'
    : right === 'au' ? 'ou' : right === 'ou' ? 'au'
      : right === 'auw' ? 'ouw' : 'auw';
  return {
    kind: 'choose', word: word.w, en: word.en, pic: word.pic, parts: word.parts,
    rack: shuffle([right, twin], rng),
    filled: word.parts.map((p, i) => (i === at ? null : p)),
    focus: at,
  };
}

/** A rung of a ladder: the word before it is on the board, and one sound has to change. */
export function ladderQuestion(rng: () => number, index: number): Question {
  const chain = LADDERS[Math.floor(rng() * LADDERS.length)];
  const step = 1 + (index % (chain.length - 1));
  const from = byWord(chain[step - 1]);
  const to = byWord(chain[step]);
  if (!from || !to) throw new Error(`ladder step missing a word: ${chain[step - 1]} -> ${chain[step]}`);
  const at = stepBetween(from.parts, to.parts);
  const extras: string[] = [from.parts[at]];
  while (extras.length < 3) {
    const d = pickDistractor(to.parts, rng, extras);
    if (extras.includes(d)) break;
    extras.push(d);
  }
  return {
    kind: 'ladder', word: to.w, en: to.en, pic: to.pic, parts: to.parts,
    rack: shuffle([to.parts[at], ...extras.filter(e => e !== to.parts[at])], rng),
    filled: to.parts.map((p, i) => (i === at ? null : p)),
    focus: at,
    from: from.w,
  };
}

/** A sentence, cut into its words, with one word on the rack that does not belong in it. */
export function sentenceQuestion(rng: () => number): Question {
  const s = pick(rng, SENTENCES);
  const spare = SENTENCE_WORDS.filter(w => !s.nl.includes(w));
  const extra = spare.length ? pick(rng, spare) : 'de';
  return {
    kind: 'sentence', word: s.nl.join(' '), en: s.en, pic: `scene:${s.scene}`,
    parts: s.nl, rack: shuffle([...s.nl, extra], rng),
    filled: s.nl.map(() => null), focus: -1,
  };
}

/** Does this tile belong in this slot? A repeated sound fits either of its places. */
export function tileFits(q: Question, slot: number, unit: string): boolean {
  return slot >= 0 && slot < q.parts.length && q.parts[slot] === unit;
}

/** The first slot still empty, which is where the game points when it has to help. */
export function firstEmpty(filled: Array<string | null>): number {
  return filled.findIndex(x => x == null);
}

export const isSolved = (q: Question, filled: Array<string | null>): boolean =>
  q.parts.every((p, i) => filled[i] === p);

/**
 * What to say when a tile goes in the wrong place.
 *
 * Never "wrong". Always what the slot wanted, and for the two spelling traps the reason there was
 * nothing to work out: they sound the same, so this one is a word you have to know.
 */
export function teachFor(q: Question, slot: number, given: string, nl: boolean): string {
  const want = q.parts[slot] ?? '';
  if (q.kind === 'sentence') {
    return nl ? `Hier hoort “${want}”.` : `“${want}” goes here.`;
  }
  if (sameSound(want, given) && want !== given) {
    return nl
      ? `${want} en ${given} klinken hetzelfde. In dit woord is het ${spellingName(want, true)}.`
      : `${want} and ${given} sound the same. In this word it is ${spellingName(want, false)}.`;
  }
  if (isDigraph(want) && want.startsWith(given)) {
    return nl
      ? `${want} is één klank: twee letters, samen ${sayLabel(want)}.`
      : `${want} is one sound: two letters saying ${sayLabel(want)}.`;
  }
  return nl ? `Hier hoort de ${want}.` : `The ${want} goes here.`;
}

/**
 * The tile does belong to this word, only somewhere else in it.
 *
 * That is a different mistake from reaching for a letter the word does not use at all, and it
 * deserves a different sentence: not "no", but "yes, and here is where it goes".
 */
export function teachElsewhere(unit: string, nl: boolean): string {
  return nl ? `De ${unit} hoort hier.` : `The ${unit} goes here.`;
}

/** The sound spelled out for a caption, which is the spelling itself between slashes. */
export const sayLabel = (unit: string): string => `/${unit}/`;

/** Stars are first-try only: a word that had to be shown is a word that was not read. */
export function starsFor(firstTry: number, total: number): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.7) return 2;
  if (acc >= 0.45) return 1;
  return 0;
}

/** Every word the game can put on screen, for the tests that check each one has a picture. */
export const ALL_WORDS = WORDS;
