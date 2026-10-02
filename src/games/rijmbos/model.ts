/**
 * Rijmbos: the rules of the rhyming game, with no canvas and no browser in them.
 *
 * Suri says a word and animals in a forest clearing hold up picture cards. The child taps the one
 * that rhymes. What it practises is hearing that two whole words end the same way; it does not
 * claim a child will read or spell better for it (CLAUDE.md rule 3).
 *
 * Decisions, in one place so the tests and the claims list can point at them:
 *
 *  - Rhyme is by SPELLING: two words rhyme when they are different words and everything from the
 *    first vowel on is identical (muis-huis: "uis"; kat-kast: "at" against "ast", so no). That is
 *    strict on purpose. Dutch spells the same sound two ways (pad / kat both end in a "t" sound),
 *    and a strict rule means a parent never sees a pair marked wrong that sounds right, at the
 *    price of leaving some good pairs out. Every family below was also checked by ear, and the two
 *    languages have their own list: an English child does not rhyme Dutch words.
 *  - Only concrete one-syllable nouns that can be drawn in code (paint.ts has an icon for each).
 *  - Only whole words are ever spoken. Never a sound, a syllable or a letter: the owner was
 *    explicit, and a speech voice handed a loose sound guesses.
 *  - A level is ten questions and then it ends. Nothing is lost on the way and a wrong answer is
 *    never counted on screen; stars come from how many questions were right the first time
 *    (`starsFor`, a product decision, not a research figure).
 *  - Words in the level text and rows are written as plain `nl` / `en` / `hint` / `hintNl` fields
 *    so scripts/voice.mjs finds every word and records it as its own line.
 */

import { makeRng } from '../../util/rng';

export type Lang = 'nl' | 'en';

export interface Word {
  /** Dutch word. In the English list this is left empty: those words are only ever said in English. */
  nl: string;
  /** English name of the thing (in the Dutch list) or the English word itself (in the English list). */
  en: string;
  /** the icon paint.ts draws */
  icon: string;
}

const w = (nl: string, en: string, icon: string): Word => ({ nl, en, icon });
const e = (en: string, icon: string): Word => ({ nl: '', en, icon });

/** The Dutch list. Families of three or more that share a spelled ending, plus `kast` as a look-alike. */
export const WORDS: Word[] = [
  w('muis', 'mouse', 'mouse'), w('huis', 'house', 'house'), w('luis', 'louse', 'bug'), w('kruis', 'cross', 'cross'),
  w('kat', 'cat', 'cat'), w('mat', 'mat', 'mat'), w('rat', 'rat', 'rat'), w('vat', 'barrel', 'barrel'),
  w('boot', 'boat', 'boat'), w('noot', 'nut', 'nut'), w('sloot', 'ditch', 'ditch'),
  w('bal', 'ball', 'ball'), w('stal', 'stable', 'stable'), w('schal', 'scarf', 'scarf'),
  w('tak', 'branch', 'branch'), w('dak', 'roof', 'roof'), w('zak', 'sack', 'sack'),
  w('kam', 'comb', 'comb'), w('ram', 'ram', 'ram'), w('lam', 'lamb', 'lamb'), w('jam', 'jam', 'jar'),
  w('rok', 'skirt', 'skirt'), w('bok', 'goat', 'goat'), w('sok', 'sock', 'sock'),
  w('kip', 'chicken', 'chicken'), w('lip', 'lip', 'lips'), w('schip', 'ship', 'ship'),
  w('hand', 'hand', 'hand'), w('tand', 'tooth', 'tooth'), w('mand', 'basket', 'basket'), w('zand', 'sand', 'sand'), w('wand', 'wall', 'wall'),
  w('boek', 'book', 'book'), w('koek', 'biscuit', 'cookie'), w('broek', 'trousers', 'trousers'),
  w('taart', 'cake', 'cake'), w('kaart', 'card', 'card'), w('staart', 'tail', 'tail'),
  w('maan', 'moon', 'moon'), w('haan', 'rooster', 'rooster'), w('traan', 'tear', 'tear'),
  w('pop', 'doll', 'doll'), w('kop', 'cup', 'cup'), w('dop', 'cap', 'cap'),
  w('jas', 'coat', 'coat'), w('tas', 'bag', 'handbag'), w('glas', 'glass', 'glass'), w('gras', 'grass', 'grass'),
  w('kast', 'cupboard', 'cupboard'),
];

/** The English list: its own rhymes, its own words. Icons are shared with the Dutch list where the thing is the same. */
export const WORDS_EN: Word[] = [
  e('cat', 'cat'), e('hat', 'hat'), e('mat', 'mat'), e('rat', 'rat'),
  e('boat', 'boat'), e('goat', 'goat'), e('coat', 'coat'),
  e('cake', 'cake'), e('snake', 'snake'), e('lake', 'lake'),
  e('sock', 'sock'), e('clock', 'clock'), e('rock', 'rock'),
  e('tail', 'tail'), e('nail', 'nail'), e('snail', 'snail'), e('pail', 'pail'),
  e('pig', 'pig'), e('wig', 'wig'), e('twig', 'branch'),
  e('dog', 'dog'), e('log', 'log'), e('frog', 'frog'),
  e('star', 'star'), e('car', 'car'), e('jar', 'jar'),
  e('rug', 'rug'), e('bug', 'bug'), e('mug', 'cup'),
  e('ring', 'ring'), e('king', 'king'), e('wing', 'wing'),
  e('bell', 'bell'), e('well', 'well'), e('shell', 'shell'),
];

export const wordsFor = (lang: Lang): Word[] => (lang === 'nl' ? WORDS : WORDS_EN);

/** The word as it is spoken and written in this language, always lower case (that is how it is recorded). */
export const textOf = (word: Word, lang: Lang): string => word[lang];

/** Everything from the first vowel on: the part that has to be the same for two words to rhyme. */
export function rime(word: string): string {
  const s = word.trim().toLowerCase();
  const m = s.match(/[aeiouy][a-z]*$/);
  return m ? m[0] : s;
}

/** Do these two different words rhyme, by spelling? */
export function isRhyme(a: string, b: string): boolean {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  return x !== '' && y !== '' && x !== y && rime(x) === rime(y);
}

/** The rhyme families of a language: groups of three or more words with the same ending. */
export function families(lang: Lang): Word[][] {
  const by = new Map<string, Word[]>();
  for (const word of wordsFor(lang)) {
    const k = rime(textOf(word, lang));
    by.set(k, [...(by.get(k) ?? []), word]);
  }
  return [...by.values()].filter(f => f.length >= 3);
}

// ---------------------------------------------------------------- levels

export const QUESTIONS_PER_LEVEL = 10;

/** `one`: tap the one that rhymes. `all`: tap every one that rhymes. `odd`: tap the one that does not. */
export type Mode = 'one' | 'all' | 'odd';

export interface Level {
  id: number;
  name: string;
  nameNl: string;
  hint: string;
  hintNl: string;
  cards: number;
  mode: Mode;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Two cards', nameNl: 'Twee kaarten', hint: 'I say a word. Which picture rhymes with it?', hintNl: 'Ik zeg een woord. Welk plaatje rijmt erop?', cards: 2, mode: 'one' },
  { id: 2, name: 'Three cards', nameNl: 'Drie kaarten', hint: 'Three pictures now. Which one rhymes?', hintNl: 'Nu drie plaatjes. Welke rijmt?', cards: 3, mode: 'one' },
  { id: 3, name: 'Look-alikes', nameNl: 'Bijna hetzelfde', hint: 'Careful: one word starts the same but does not rhyme.', hintNl: 'Pas op: een woord begint hetzelfde, maar rijmt niet.', cards: 3, mode: 'one' },
  { id: 4, name: 'Find them all', nameNl: 'Zoek ze allemaal', hint: 'Five pictures. Tap every one that rhymes.', hintNl: 'Vijf plaatjes. Tik alle plaatjes die rijmen.', cards: 5, mode: 'all' },
  { id: 5, name: 'Odd one out', nameNl: 'Wie hoort er niet bij', hint: 'Three words rhyme. Tap the one that does not.', hintNl: 'Drie woorden rijmen. Tik het woord dat niet rijmt.', cards: 4, mode: 'odd' },
];

export interface Card { word: Word; right: boolean }

export interface Question {
  level: number;
  mode: Mode;
  /** the word Suri says first; null in the odd-one-out level, where there is no prompt */
  prompt: Word | null;
  cards: Card[];
  lang: Lang;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/** length of the shared start of two words */
function prefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * One question for a level, with a prompt chosen by the caller (the tests use this to pin one down).
 *
 * Wrong cards always come from other families, and no two wrong cards come from the same family,
 * so a child can never tap a "wrong" card that rhymes with something on the table.
 */
export function makeQuestionFor(level: number, prompt: Word | null, rng: () => number, lang: Lang = 'nl'): Question {
  const L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
  const fams = families(lang);
  const text = (x: Word): string => textOf(x, lang);
  const famOf = (x: Word): Word[] | undefined => fams.find(f => f.includes(x));
  const famKey = (x: Word): string => rime(text(x));

  if (L.mode === 'odd') {
    const fam = (prompt && famOf(prompt)) ?? pick(fams, rng);
    const three = shuffle(fam, rng).slice(0, 3);
    const others = wordsFor(lang).filter(x => famKey(x) !== rime(text(fam[0])));
    const odd = pick(others, rng);
    const cards = shuffle<Card>([...three.map(x => ({ word: x, right: false })), { word: odd, right: true }], rng);
    // in this level `right` marks the card to tap, which is the one that does NOT rhyme
    return { level: L.id, mode: 'odd', prompt: null, cards, lang };
  }

  const p = prompt ?? pick(fams.flat(), rng);
  const fam = famOf(p) ?? [p];
  const mates = fam.filter(x => x !== p);
  const rightCount = L.mode === 'all' ? (mates.length >= 3 && rng() < 0.35 ? 3 : 2) : 1;
  const rights = shuffle(mates, rng).slice(0, rightCount);
  const need = L.cards - rights.length;

  const pool = wordsFor(lang).filter(x => famKey(x) !== famKey(p));
  const wrongs: Word[] = [];
  const usedKeys = new Set<string>([famKey(p)]);
  const take = (x: Word): void => { wrongs.push(x); usedKeys.add(famKey(x)); };

  if (L.id === 3) {
    // the look-alike: same first letter as the word Suri says, as long a shared start as there is;
    // a word that rhymes with nothing (kast) wins a tie, because it is the nearest to a real trap
    const same = pool.filter(x => text(x)[0] === text(p)[0]);
    if (same.length) {
      const lone = (x: Word): number => (famOf(x) ? 0 : 1);
      const best = [...same].sort((a, b) =>
        prefix(text(b), text(p)) - prefix(text(a), text(p)) || lone(b) - lone(a) || rng() - 0.5)[0];
      take(best);
    }
  }
  const rest = shuffle(pool, rng);
  for (const x of rest) {
    if (wrongs.length >= need) break;
    if (usedKeys.has(famKey(x))) continue;
    take(x);
  }
  const cards = shuffle<Card>([...rights.map(x => ({ word: x, right: true })), ...wrongs.map(x => ({ word: x, right: false }))], rng);
  return { level: L.id, mode: L.mode, prompt: p, cards, lang };
}

/**
 * A question for a level. `avoid` is the prompts already used this round, so ten questions are
 * ten different words; it is a preference, not a rule, and gives way if the list runs short.
 */
export function makeQuestion(level: number, rng: () => number, lang: Lang = 'nl', avoid: string[] = []): Question {
  const fams = families(lang);
  const all = fams.flat();
  const fresh = all.filter(x => !avoid.includes(textOf(x, lang)));
  const p = pick(fresh.length ? fresh : all, rng);
  return makeQuestionFor(level, p, rng, lang);
}

/** The round's seed: the same level played again is a different round. */
export const rngFor = (level: number, attempt: number): (() => number) => makeRng(0x7a11 + level * 977 + attempt * 31337);

/**
 * Stars from the share of questions answered right on the first try. The cut-offs (90 and 70
 * percent) are a product decision; nobody has measured what a four-year-old can be expected to
 * get. Finishing a level is always worth one star: a level cannot be failed, only ended.
 */
export function starsFor(firstTry: number, total: number = QUESTIONS_PER_LEVEL): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.9) return 3;
  if (acc >= 0.7) return 2;
  return 1;
}

/** The cards a child still has to find in a question. */
export const toFind = (q: Question): number => q.cards.filter(c => c.right).length;
