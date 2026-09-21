/**
 * Dutch phonics: how a letter is *said*, which is not what a letter is *called*.
 *
 * A child who is learning to read does not need to know that `m` is called "em". They need to
 * hear /m/ - "mmm" - because that is the noise that goes into *maan*. Saying the letter name at
 * the wrong moment is the single most common way a grown-up makes reading harder: "em-aa-en"
 * never becomes "maan", but "mmm-aa-nnn" does.
 *
 * So this module is a table of how each spelling is spoken, and it is written for a Dutch speech
 * voice rather than for a phonetician. Three things in it are worth knowing:
 *
 *  - a stretchable sound is written stretched. `m` is "mmm", `s` is "sss", `r` is "rrr". A voice
 *    reads those as the sound held, which is exactly what a teacher does;
 *  - a plosive cannot be said on its own - /p/ without a vowel after it is silence with a puff -
 *    so it gets the smallest vowel Dutch has: "puh", "buh", "tuh". Every Dutch reading method
 *    makes that same compromise, and it is written down here rather than hidden;
 *  - a short vowel cannot be written on its own in Dutch either: a bare `a` is the letter name
 *    /aː/, which is the *long* sound. Dutch does have the short vowels written down, in its
 *    interjections - ah, eh, ih, oh, uh - and those are what the table uses.
 *
 * And the point the whole game turns on: `ei` and `ij` are one sound with two spellings, and so
 * are `au` and `ou`, and so are `g` and `ch`. They share a say-string here on purpose, and the
 * tests hold them to it.
 */

/** A sound unit is a spelling that stands for one sound: `m`, `aa`, `ui`, `ng`, `eeuw`. */
export interface Sound {
  /** the text handed to the speech voice, spelled so a Dutch voice says the sound */
  say: string;
  /** which sound this is. Two spellings of one sound share a phoneme, which is the teaching. */
  phoneme: string;
  /** a word a child knows that has this sound in it, for "de aa van maan" */
  example: string;
  kind: 'consonant' | 'vowel';
}

export const SOUNDS: Record<string, Sound> = {
  // ---- consonants that can be held, written held
  m: { say: 'mmm', phoneme: 'm', example: 'maan', kind: 'consonant' },
  n: { say: 'nnn', phoneme: 'n', example: 'net', kind: 'consonant' },
  l: { say: 'lll', phoneme: 'l', example: 'lamp', kind: 'consonant' },
  r: { say: 'rrr', phoneme: 'r', example: 'roos', kind: 'consonant' },
  s: { say: 'sss', phoneme: 's', example: 'sok', kind: 'consonant' },
  f: { say: 'fff', phoneme: 'f', example: 'fiets', kind: 'consonant' },
  v: { say: 'vvv', phoneme: 'v', example: 'vis', kind: 'consonant' },
  z: { say: 'zzz', phoneme: 'z', example: 'zon', kind: 'consonant' },
  j: { say: 'jjj', phoneme: 'j', example: 'jas', kind: 'consonant' },
  w: { say: 'www', phoneme: 'w', example: 'wol', kind: 'consonant' },
  h: { say: 'hhh', phoneme: 'h', example: 'hok', kind: 'consonant' },
  // g and ch are one sound in Dutch and two spellings. They are said the same on purpose.
  g: { say: 'chhh', phoneme: 'x', example: 'gat', kind: 'consonant' },
  ch: { say: 'chhh', phoneme: 'x', example: 'lach', kind: 'consonant' },
  ng: { say: 'nggg', phoneme: 'ŋ', example: 'ring', kind: 'consonant' },
  nk: { say: 'ngk', phoneme: 'ŋk', example: 'bank', kind: 'consonant' },

  // ---- the plosives, each with the smallest vowel that lets it be heard at all
  b: { say: 'buh', phoneme: 'b', example: 'bus', kind: 'consonant' },
  d: { say: 'duh', phoneme: 'd', example: 'dak', kind: 'consonant' },
  t: { say: 'tuh', phoneme: 't', example: 'tak', kind: 'consonant' },
  k: { say: 'kuh', phoneme: 'k', example: 'kat', kind: 'consonant' },
  p: { say: 'puh', phoneme: 'p', example: 'pen', kind: 'consonant' },

  // ---- the short vowels, spelled the way Dutch spells them when it is not spelling a word
  a: { say: 'ah', phoneme: 'ɑ', example: 'kat', kind: 'vowel' },
  e: { say: 'eh', phoneme: 'ɛ', example: 'pen', kind: 'vowel' },
  i: { say: 'ih', phoneme: 'ɪ', example: 'vis', kind: 'vowel' },
  o: { say: 'oh', phoneme: 'ɔ', example: 'zon', kind: 'vowel' },
  u: { say: 'uh', phoneme: 'ʏ', example: 'bus', kind: 'vowel' },

  // ---- the long vowels: two letters, one sound, and the voice reads them straight
  aa: { say: 'aa', phoneme: 'aː', example: 'maan', kind: 'vowel' },
  ee: { say: 'ee', phoneme: 'eː', example: 'been', kind: 'vowel' },
  oo: { say: 'oo', phoneme: 'oː', example: 'boom', kind: 'vowel' },
  uu: { say: 'uu', phoneme: 'yː', example: 'muur', kind: 'vowel' },

  // ---- the two-letter sounds. One sound each, however many letters it takes to write it.
  ie: { say: 'ie', phoneme: 'i', example: 'fiets', kind: 'vowel' },
  oe: { say: 'oe', phoneme: 'u', example: 'boek', kind: 'vowel' },
  eu: { say: 'eu', phoneme: 'ø', example: 'neus', kind: 'vowel' },
  ui: { say: 'ui', phoneme: 'œy', example: 'huis', kind: 'vowel' },
  // ei and ij: one sound, two spellings, and only the word says which. This is the whole of
  // level four, and it is why they share a phoneme here.
  ei: { say: 'ei', phoneme: 'ɛi', example: 'trein', kind: 'vowel' },
  ij: { say: 'ei', phoneme: 'ɛi', example: 'ijs', kind: 'vowel' },
  // au and ou: the same again
  au: { say: 'ou', phoneme: 'ʌu', example: 'pauw', kind: 'vowel' },
  ou: { say: 'ou', phoneme: 'ʌu', example: 'hout', kind: 'vowel' },
  auw: { say: 'ouw', phoneme: 'ʌu̯', example: 'blauw', kind: 'vowel' },
  ouw: { say: 'ouw', phoneme: 'ʌu̯', example: 'touw', kind: 'vowel' },
  eeuw: { say: 'eeuw', phoneme: 'eːu̯', example: 'leeuw', kind: 'vowel' },
  ieuw: { say: 'ieuw', phoneme: 'iu̯', example: 'nieuw', kind: 'vowel' },
  aai: { say: 'aai', phoneme: 'aːi̯', example: 'haai', kind: 'vowel' },
  ooi: { say: 'ooi', phoneme: 'oːi̯', example: 'kooi', kind: 'vowel' },
  oei: { say: 'oei', phoneme: 'ui̯', example: 'koei', kind: 'vowel' },
};

/** Every spelling the game knows, longest first, which is how a word is cut up. */
export const UNITS: string[] = Object.keys(SOUNDS).sort((a, b) => b.length - a.length || a.localeCompare(b));

export const knownUnit = (u: string): boolean => Object.prototype.hasOwnProperty.call(SOUNDS, u);

/** How to say this sound out loud. Unknown spellings fall back to themselves rather than throw. */
export const sayOf = (unit: string): string => SOUNDS[unit]?.say ?? unit;

export const phonemeOf = (unit: string): string => SOUNDS[unit]?.phoneme ?? unit;

/** Do these two spellings make the same noise? `ei` and `ij` do; `f` and `v` do not. */
export const sameSound = (a: string, b: string): boolean => phonemeOf(a) === phonemeOf(b);

export const isVowelUnit = (unit: string): boolean => SOUNDS[unit]?.kind === 'vowel';

/** Two or more letters for one sound - the thing a child has to stop reading letter by letter. */
export const isDigraph = (unit: string): boolean => knownUnit(unit) && unit.length > 1;

/** The word this sound is borrowed from, for the moment a bare sound is not enough. */
export const exampleOf = (unit: string): string => SOUNDS[unit]?.example ?? '';

/** "de aa van maan" - what a teacher says when the sound on its own has not landed. */
export function exampleLine(unit: string, nl: boolean): string {
  const ex = exampleOf(unit);
  if (!ex) return unit;
  return nl ? `de ${unit} van ${ex}` : `the ${unit} in ${ex}`;
}

/**
 * What this spelling is called when you have to talk *about* it rather than say it.
 *
 * Dutch has real names for the two hard pairs and they are the names a school uses: the ei is the
 * korte ei, the ij is the lange ij. Nothing else here needs a name of its own.
 */
export function spellingName(unit: string, nl: boolean): string {
  const names: Record<string, [string, string]> = {
    ei: ['the short ei', 'de korte ei'],
    ij: ['the long ij', 'de lange ij'],
    au: ['the au of pauw', 'de au van pauw'],
    ou: ['the ou of hout', 'de ou van hout'],
    auw: ['the auw of blauw', 'de auw van blauw'],
    ouw: ['the ouw of touw', 'de ouw van touw'],
  };
  const n = names[unit];
  return n ? (nl ? n[1] : n[0]) : unit;
}

/**
 * Cut a written word into its sounds.
 *
 * Longest spelling first, left to right: that one rule gets *boek* to b-oe-k, *schaap* to
 * s-ch-aa-p, *leeuw* to l-eeuw and *angst* to a-ng-s-t. It is how the word list's breakdowns are
 * made, so the list cannot drift away from the table above.
 */
export function splitWord(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    let took = '';
    for (const u of UNITS) {
      if (u.length <= w.length - i && w.startsWith(u, i)) { took = u; break; }
    }
    if (!took) { out.push(w[i]); i += 1; continue; }
    out.push(took);
    i += took.length;
  }
  return out;
}

/** The sounds put back together. A breakdown that does not spell its word is a broken breakdown. */
export const joinParts = (parts: string[]): string => parts.join('');

/**
 * Letters a child mixes up, and the only wrong tiles worth putting on the rack.
 *
 * A distractor that is nothing like the answer teaches nothing: nobody reaches for a `w` when
 * they are building *kat*. A `d` beside a `b`, an `e` beside an `i`, an `f` beside a `v` - those
 * are the real mistakes, and having to reject one is the exercise.
 */
export const CONFUSED: Record<string, string[]> = {
  b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'd', 'q'], q: ['p'],
  m: ['n', 'w'], n: ['m', 'r'], w: ['m', 'v'],
  a: ['o', 'e'], e: ['i', 'a'], i: ['e', 'j'], o: ['a', 'u'], u: ['o', 'a'],
  aa: ['a', 'oo'], ee: ['e', 'ie'], oo: ['o', 'aa'], uu: ['u', 'oo'],
  f: ['v'], v: ['f', 'w'], s: ['z'], z: ['s'],
  k: ['t', 'h'], t: ['k', 'l'], l: ['t', 'r'], r: ['l', 'n'],
  g: ['ch', 'j'], ch: ['g', 'h'], h: ['k', 'n'], j: ['i', 'g'],
  ie: ['ei', 'ee'], oe: ['eu', 'oo'], eu: ['oe', 'ui'], ui: ['eu', 'ie'],
  ei: ['ij', 'ie'], ij: ['ei', 'ie'], ou: ['au', 'oe'], au: ['ou', 'aa'],
  ng: ['nk', 'n'], nk: ['ng', 'n'],
  ouw: ['auw', 'ou'], auw: ['ouw', 'au'], eeuw: ['ieuw', 'ee'],
};

/**
 * One wrong tile for this rack: something confusable with a sound the word actually uses, and
 * not a sound the word already needs. Deterministic, so a level plays the same way twice.
 */
export function pickDistractor(parts: string[], rng: () => number, taken: string[] = []): string {
  const have = new Set([...parts, ...taken]);
  const pool: string[] = [];
  for (const p of parts) for (const c of CONFUSED[p] ?? []) if (knownUnit(c) && !have.has(c)) pool.push(c);
  if (pool.length) return pool[Math.floor(rng() * pool.length)];
  // nothing confusable is left, so anything the word does not use will have to do
  const rest = UNITS.filter(u => u.length === 1 && !have.has(u));
  return rest[Math.floor(rng() * rest.length)] ?? 'w';
}
