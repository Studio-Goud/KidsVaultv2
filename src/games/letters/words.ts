/**
 * The words Letterbos is built out of, and nothing else.
 *
 * A hundred and forty-one words, every one of them a thing a five year old can point at, because
 * every word in this game has to be a picture before it is a word. No abstractions, no verbs
 * without a scene, nothing that needs a sentence to explain it.
 *
 * The breakdowns are not typed out by hand. Each word is cut into its sounds by `splitWord` from
 * `phonics.ts`, so the list and the sound table cannot drift apart: add a word with a spelling
 * the table has never heard of and the tests say so rather than the game saying "mmm-aa-n-tuh".
 *
 * The bands are the ladder. `kort` is three letters and a short vowel, `lang` is the doubled
 * vowel, `duo` is the two-letter sounds, `ei`/`ij` and `au`/`ou` are the two spelling traps Dutch
 * has, and `cluster` is consonants stacked up against each other.
 */

import { splitWord } from './phonics';

export type Band = 'kort' | 'lang' | 'duo' | 'ei' | 'ij' | 'au' | 'ou' | 'cluster';

export interface Word {
  /** the word as it is written */
  w: string;
  /** what it is in English, for the English half of the game */
  en: string;
  /** which drawing stands for it */
  pic: string;
  band: Band;
  /** the sounds it is made of, in order */
  parts: string[];
}

/** [word, English, band]. The picture is named after the word, and the sounds are worked out. */
const RAW: Array<[string, string, Band]> = [
  // ---- three letters, one short vowel: the first words anybody reads
  ['bus', 'bus', 'kort'], ['kat', 'cat', 'kort'], ['pen', 'pen', 'kort'], ['vis', 'fish', 'kort'],
  ['zon', 'sun', 'kort'], ['bal', 'ball', 'kort'], ['kip', 'hen', 'kort'], ['mus', 'sparrow', 'kort'],
  ['rok', 'skirt', 'kort'], ['tak', 'branch', 'kort'], ['bos', 'wood', 'kort'], ['pet', 'cap', 'kort'],
  ['jas', 'coat', 'kort'], ['mes', 'knife', 'kort'], ['zak', 'bag', 'kort'], ['kam', 'comb', 'kort'],
  ['bot', 'bone', 'kort'], ['hok', 'hutch', 'kort'], ['net', 'net', 'kort'], ['pot', 'pot', 'kort'],
  ['rat', 'rat', 'kort'], ['zes', 'six', 'kort'], ['bel', 'bell', 'kort'], ['pop', 'doll', 'kort'],
  ['sok', 'sock', 'kort'], ['tas', 'handbag', 'kort'], ['dak', 'roof', 'kort'], ['gat', 'hole', 'kort'],
  ['wol', 'wool', 'kort'], ['kop', 'mug', 'kort'], ['man', 'man', 'kort'], ['mat', 'mat', 'kort'],
  ['kom', 'bowl', 'kort'], ['bok', 'goat', 'kort'], ['hek', 'gate', 'kort'], ['vos', 'fox', 'kort'],

  // ---- the doubled vowel: two letters, one long sound
  ['maan', 'moon', 'lang'], ['boom', 'tree', 'lang'], ['muur', 'wall', 'lang'], ['vuur', 'fire', 'lang'],
  ['been', 'leg', 'lang'], ['boot', 'boat', 'lang'], ['haan', 'cockerel', 'lang'], ['zeep', 'soap', 'lang'],
  ['poot', 'paw', 'lang'], ['kaas', 'cheese', 'lang'], ['raam', 'window', 'lang'], ['teen', 'toe', 'lang'],
  ['noot', 'nut', 'lang'], ['vaas', 'vase', 'lang'], ['mees', 'tit', 'lang'], ['roos', 'rose', 'lang'],
  ['zaag', 'saw', 'lang'], ['haar', 'hair', 'lang'], ['peer', 'pear', 'lang'], ['veer', 'feather', 'lang'],

  // ---- the two-letter sounds: ui, oe, eu, ie, eeuw
  ['huis', 'house', 'duo'], ['muis', 'mouse', 'duo'], ['duim', 'thumb', 'duo'], ['uil', 'owl', 'duo'],
  ['tuin', 'garden', 'duo'], ['buik', 'tummy', 'duo'], ['boek', 'book', 'duo'], ['koe', 'cow', 'duo'],
  ['voet', 'foot', 'duo'], ['hoed', 'hat', 'duo'], ['poes', 'cat', 'duo'], ['deur', 'door', 'duo'],
  ['neus', 'nose', 'duo'], ['reus', 'giant', 'duo'], ['leeuw', 'lion', 'duo'], ['meeuw', 'seagull', 'duo'],
  ['fiets', 'bicycle', 'duo'], ['wiel', 'wheel', 'duo'], ['riem', 'belt', 'duo'], ['dier', 'animal', 'duo'],

  // ---- ei: the short ei
  ['ei', 'egg', 'ei'], ['trein', 'train', 'ei'], ['eiland', 'island', 'ei'], ['geit', 'goat', 'ei'],
  ['zeil', 'sail', 'ei'], ['eik', 'oak', 'ei'], ['reis', 'journey', 'ei'], ['plein', 'square', 'ei'],
  ['dweil', 'mop', 'ei'], ['sein', 'signal', 'ei'],

  // ---- ij: the long ij
  ['ijs', 'ice cream', 'ij'], ['rijst', 'rice', 'ij'], ['vijf', 'five', 'ij'], ['bij', 'bee', 'ij'],
  ['zwijn', 'boar', 'ij'], ['dijk', 'dyke', 'ij'], ['pijl', 'arrow', 'ij'], ['lijm', 'glue', 'ij'],
  ['prijs', 'prize', 'ij'], ['krijt', 'chalk', 'ij'],

  // ---- au
  ['blauw', 'blue', 'au'], ['pauw', 'peacock', 'au'], ['saus', 'sauce', 'au'], ['klauw', 'claw', 'au'],
  ['dauw', 'dew', 'au'], ['augurk', 'gherkin', 'au'],

  // ---- ou
  ['koud', 'cold', 'ou'], ['hout', 'wood', 'ou'], ['goud', 'gold', 'ou'], ['zout', 'salt', 'ou'],
  ['fout', 'mistake', 'ou'], ['touw', 'rope', 'ou'], ['kous', 'stocking', 'ou'], ['mouw', 'sleeve', 'ou'],

  // ---- consonants stacked up
  ['schaap', 'sheep', 'cluster'], ['school', 'school', 'cluster'], ['schip', 'ship', 'cluster'],
  ['schoen', 'shoe', 'cluster'], ['straat', 'street', 'cluster'], ['strand', 'beach', 'cluster'],
  ['stoel', 'chair', 'cluster'], ['ster', 'star', 'cluster'], ['spin', 'spider', 'cluster'],
  ['spons', 'sponge', 'cluster'], ['slang', 'snake', 'cluster'], ['slak', 'snail', 'cluster'],
  ['snoep', 'sweets', 'cluster'], ['sneeuw', 'snow', 'cluster'], ['plank', 'plank', 'cluster'],
  ['plant', 'plant', 'cluster'], ['klomp', 'clog', 'cluster'], ['kraan', 'tap', 'cluster'],
  ['krab', 'crab', 'cluster'], ['trap', 'stairs', 'cluster'], ['trui', 'jumper', 'cluster'],
  ['brood', 'bread', 'cluster'], ['bloem', 'flower', 'cluster'], ['druif', 'grape', 'cluster'],
  ['vlag', 'flag', 'cluster'], ['zwaan', 'swan', 'cluster'], ['angst', 'fear', 'cluster'],
  ['herfst', 'autumn', 'cluster'], ['worst', 'sausage', 'cluster'], ['ring', 'ring', 'cluster'],
  ['bank', 'bench', 'cluster'],
];

export const WORDS: Word[] = RAW.map(([w, en, band]) => ({ w, en, pic: w, band, parts: splitWord(w) }));

const INDEX: Record<string, Word> = Object.fromEntries(WORDS.map(x => [x.w, x]));

export const byWord = (w: string): Word | undefined => INDEX[w];

export const wordsIn = (...bands: Band[]): Word[] => WORDS.filter(x => bands.includes(x.band));

/**
 * The word ladders: change one sound and you have a different word and a different picture.
 *
 * Every step differs from the one before it in exactly one sound in the same place, which is the
 * only way the exercise works - and the tests hold the chains to that, so a chain cannot quietly
 * rot when a word is renamed. `poot` to `pot` is the most valuable rung in the game: nothing else
 * makes the difference between a long and a short vowel that plain.
 */
export const LADDERS: string[][] = [
  ['bus', 'bos', 'bot', 'bok', 'hok', 'hek'],
  ['kat', 'kam', 'kom', 'kop', 'pop', 'pot'],
  ['vis', 'vos', 'bos', 'bok'],
  ['pen', 'pet', 'pot', 'pop'],
  ['maan', 'man', 'mat', 'kat', 'kam'],
  ['boom', 'boot', 'poot', 'pot', 'pet', 'pen'],
];

/** Which sound changed between two words of the same shape, or -1 if they are not one step apart. */
export function stepBetween(a: string[], b: string[]): number {
  if (a.length !== b.length) return -1;
  let at = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (at >= 0) return -1;
    at = i;
  }
  return at;
}

export interface Sentence {
  /** the words, in the order they go */
  nl: string[];
  en: string;
  /** the drawn scene that says the same thing without words */
  scene: string;
}

/**
 * Short sentences, three or four words, and each one has a picture of itself.
 *
 * They are the last level because a sentence is the first place reading stops being a trick with
 * letters and starts being something somebody said. The little words - de, het, een, ik - are the
 * ones a child meets a hundred times a day and never sounds out, so they are here whole.
 */
export const SENTENCES: Sentence[] = [
  { nl: ['de', 'zon', 'schijnt'], en: 'the sun is shining', scene: 'sun' },
  { nl: ['de', 'vis', 'zwemt'], en: 'the fish is swimming', scene: 'fish' },
  { nl: ['de', 'boot', 'vaart'], en: 'the boat is sailing', scene: 'boat' },
  { nl: ['de', 'kat', 'slaapt'], en: 'the cat is asleep', scene: 'cat' },
  { nl: ['de', 'koe', 'eet', 'gras'], en: 'the cow is eating grass', scene: 'cow' },
  { nl: ['ik', 'zie', 'een', 'uil'], en: 'I can see an owl', scene: 'owl' },
  { nl: ['de', 'muis', 'eet', 'kaas'], en: 'the mouse is eating cheese', scene: 'mouse' },
  { nl: ['het', 'schaap', 'loopt', 'weg'], en: 'the sheep is walking away', scene: 'sheep' },
  { nl: ['de', 'trein', 'rijdt', 'hard'], en: 'the train is going fast', scene: 'train' },
  { nl: ['de', 'bij', 'vliegt', 'weg'], en: 'the bee is flying away', scene: 'bee' },
];

/** Every word that turns up in a sentence, so the rack can offer a wrong one that still fits. */
export const SENTENCE_WORDS: string[] = Array.from(new Set(SENTENCES.flatMap(s => s.nl))).sort();
