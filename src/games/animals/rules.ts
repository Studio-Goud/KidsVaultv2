/**
 * The rules of the animal book: the bits that are plain functions over plain data, and are
 * therefore the bits that can be checked without a browser (`npm test`).
 *
 * Three of them matter. Searching has to forgive a five year old - no accents, no capitals, no
 * whole words, and "zee" has to find the zeehond as well as the zeester. The scale bar has to put
 * an animal and a child on one ruler when the animal is anything from a seven millimetre ladybird
 * to a twenty-five metre whale. And a length has to come out as something you would say out loud:
 * "7 mm", "12 cm", "2,5 m", not "0.7cm".
 *
 * Nothing here touches the canvas, the network or the saved game.
 */

export type GroupId = 'mam' | 'bir' | 'fis' | 'rep' | 'amp' | 'but' | 'ins' | 'spi' | 'sea';

/** One animal, as it comes out of `public/animals/animals.json`. Short keys: there are thousands. */
export interface Animal {
  /** the iNaturalist taxon id, which is also the key the save file remembers */
  i: number;
  /** Dutch name */
  n: string;
  /** English name */
  e: string;
  /** scientific name */
  s: string;
  g: GroupId;
  /** family, in Dutch / in English / in Latin */
  f: string;
  fe: string;
  fs: string;
  /** the photograph's path under Wikimedia Commons' thumb folder */
  p: string;
  /** who took it, and which licence it is under (an index into the bundle's licence list) */
  c: string;
  l: number;
  /** continents it has been recorded on */
  w: string[];
  /** habitat key */
  h: string;
  /** diet key */
  t: string;
  /** typical adult length in centimetres, 0 when nobody has told us */
  z: number;
  /** 1 when that length is this species', 0 when it is its family's */
  x: number;
  /** conservation status */
  r: string;
  /** how often it has been photographed - the order the grid is in */
  o: number;
}

// ---------------------------------------------------------------- searching

const FOLD: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a', å: 'a', é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i', ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u', ý: 'y', ÿ: 'y', ñ: 'n', ç: 'c', ø: 'o', æ: 'ae', œ: 'oe',
};

/** Lower case, no accents, no punctuation: the shape a child's typing and a database name share. */
export function fold(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) out += FOLD[ch] ?? ch;
  return out.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * How well one animal answers one query, or 0 for not at all.
 *
 * A name that starts with what was typed beats a name that merely contains it, the Dutch name
 * beats the English one, and a whole-word hit beats a hit in the middle of a word - so typing
 * "beer" puts the beer at the top and the beervlinder below it.
 */
export function score(a: Animal, q: string): number {
  if (!q) return 0;
  const squashed = q.replace(/ /g, '');
  let best = 0;
  const fields: Array<[string, number]> = [[a.n, 100], [a.e, 80], [a.s, 60], [a.f, 40]];
  for (const [raw, weight] of fields) {
    const f = fold(raw);
    if (!f) continue;
    const shortness = Math.max(0, 20 - f.length / 4);
    const at = f.indexOf(q);
    if (at >= 0) {
      // starts with what was typed, starts a word, or sits somewhere inside one
      const kind = at === 0 ? 3 : f[at - 1] === ' ' ? 2 : 1;
      best = Math.max(best, weight + kind * 30 + shortness);
      continue;
    }
    // a child who has not found the space bar yet, or has put one in the wrong place, should
    // still find the blauwe vinvis by typing "blauwevinvis"
    if (squashed && f.replace(/ /g, '').includes(squashed)) {
      best = Math.max(best, weight + shortness);
    }
  }
  return best;
}

/** The animals that answer a query, best first. An empty query finds nothing, not everything. */
export function search(list: Animal[], query: string, limit = 60): Animal[] {
  const q = fold(query);
  if (q.length < 1) return [];
  const hits: Array<{ a: Animal; s: number }> = [];
  for (const a of list) {
    const s = score(a, q);
    if (s > 0) hits.push({ a, s });
  }
  hits.sort((x, y) => y.s - x.s || y.a.o - x.a.o);
  return hits.slice(0, limit).map(h => h.a);
}

// ---------------------------------------------------------------- how big is it

export interface ScaleBar {
  /** centimetres per drawn pixel, shared by the animal and the child */
  scale: number;
  animalPx: number;
  childPx: number;
  /** true when the animal had to be drawn bigger than life to be visible at all */
  magnified: boolean;
  /** how many times bigger than life, when it was */
  times: number;
}

/**
 * Put an animal and a child on one ruler.
 *
 * Both are drawn at the same scale, chosen so the larger of the two fills the box. A wren next to
 * a child is then honestly tiny - but a ladybird next to a child is a dot, so anything under six
 * pixels is drawn at six and says how much it has been blown up by, which is a fact of its own.
 */
export function scaleBar(animalCm: number, childCm: number, boxPx: number, childBoxPx = boxPx): ScaleBar {
  const a = Math.max(0.1, animalCm);
  const c = Math.max(1, childCm);
  // the animal is measured along its length and the child up her height, and those two are rarely
  // the same amount of room on a phone - so each gets its own limit and the tighter one wins
  const scale = Math.max(a / Math.max(1, boxPx), c / Math.max(1, childBoxPx));
  const childPx = c / scale;
  const wanted = a / scale;
  const floor = Math.max(6, boxPx * 0.035);
  const magnified = wanted < floor;
  return {
    scale,
    animalPx: magnified ? floor : wanted,
    childPx,
    magnified,
    times: magnified ? Math.round(floor / Math.max(0.0001, wanted)) : 1,
  };
}

/** A length the way you would say it: millimetres, centimetres or metres, never all three. */
export function sizeLabel(cm: number, nl: boolean): string {
  if (!cm) return nl ? 'onbekend' : 'not known';
  if (cm < 1) return `${Math.round(cm * 10)} mm`;
  if (cm < 100) {
    const v = cm < 10 ? Math.round(cm * 10) / 10 : Math.round(cm);
    return `${nl ? String(v).replace('.', ',') : v} cm`;
  }
  const m = cm / 100;
  const v = m < 10 ? Math.round(m * 10) / 10 : Math.round(m);
  return `${nl ? String(v).replace('.', ',') : v} m`;
}

/**
 * The one line that puts the number in the child's own body: taller, shorter, or about the same.
 * Anything within a fifth of the child counts as about the same, because a ruler is not the point.
 */
export function compareToChild(animalCm: number, childCm: number, nl: boolean): string {
  if (!animalCm) return nl ? 'We weten niet hoe groot hij wordt.' : 'We do not know how big it gets.';
  const r = animalCm / Math.max(1, childCm);
  if (r >= 0.8 && r <= 1.25) return nl ? 'Ongeveer even groot als jij.' : 'About the same size as you.';
  if (r > 1.25) {
    // under three times over, a half counts: "one and a half times" is a picture, "one" is not
    const v = r < 3 ? Math.round(r * 10) / 10 : Math.round(r);
    const n = nl ? String(v).replace('.', ',') : String(v);
    return nl ? `Ongeveer ${n} keer zo lang als jij groot bent.` : `About ${n} times as long as you are tall.`;
  }
  const n = Math.round(1 / r);
  return n < 2
    ? (nl ? 'Een stukje kleiner dan jij.' : 'A little smaller than you.')
    : (nl ? `Er passen er ongeveer ${n} naast elkaar over jouw lengte.` : `About ${n} of them fit along your height.`);
}

// ---------------------------------------------------------------- the shelves

export interface Group {
  id: GroupId;
  nl: string;
  en: string;
  tone: string;
}

export const GROUPS: Group[] = [
  { id: 'mam', nl: 'Zoogdieren', en: 'Mammals', tone: '#c98a50' },
  { id: 'bir', nl: 'Vogels', en: 'Birds', tone: '#4fa8dd' },
  { id: 'fis', nl: 'Vissen en haaien', en: 'Fish and sharks', tone: '#2f8fa0' },
  { id: 'rep', nl: 'Reptielen', en: 'Reptiles', tone: '#4f9455' },
  { id: 'amp', nl: 'Amfibieën', en: 'Amphibians', tone: '#8dc63f' },
  { id: 'but', nl: 'Vlinders', en: 'Butterflies', tone: '#e08bb4' },
  { id: 'ins', nl: 'Insecten', en: 'Insects', tone: '#d3a642' },
  { id: 'spi', nl: 'Spinnen', en: 'Spiders', tone: '#8a7ab8' },
  { id: 'sea', nl: 'Zeedieren', en: 'Sea creatures', tone: '#3d64b0' },
];

export const groupById = (id: string): Group | undefined => GROUPS.find(g => g.id === id);

/**
 * Which drawn animal stands in for this one.
 *
 * The shelf is usually the answer - a badger gets the four legged shape, a wren gets the bird.
 * The exceptions are the mammals that went back into the water, because a blue whale drawn as a
 * deer twenty-five metres long next to a child is not a size comparison, it is a joke.
 */
export function shapeOf(a: Animal): string {
  if (a.g === 'mam') {
    if (a.h === 'sea') return 'whale';
    if (a.h === 'coast') return 'seal';
  }
  return a.g;
}

/** Every animal on one shelf, most-photographed first - which is also most-recognisable first. */
export function shelf(list: Animal[], id: GroupId): Animal[] {
  return list.filter(a => a.g === id);
}

// ---------------------------------------------------------------- the words

export const DIET_NL: Record<string, string> = {
  meat: 'vlees', fish: 'vis', plants: 'planten', insects: 'insecten', omnivore: 'alles',
  nectar: 'nectar', plankton: 'plankton', wood: 'hout', blood: 'bloed',
};
export const DIET_EN: Record<string, string> = {
  meat: 'meat', fish: 'fish', plants: 'plants', insects: 'insects', omnivore: 'anything',
  nectar: 'nectar', plankton: 'plankton', wood: 'wood', blood: 'blood',
};

export const HABITAT_NL: Record<string, string> = {
  sea: 'in zee', coast: 'aan de kust', freshwater: 'in en bij zoet water', forest: 'in het bos',
  grass: 'in grasland en open veld', desert: 'in droge, warme streken', mountain: 'in de bergen',
  polar: 'in het poolgebied', town: 'dicht bij mensen', air: 'in de lucht',
  underground: 'onder de grond',
};
export const HABITAT_EN: Record<string, string> = {
  sea: 'in the sea', coast: 'along the coast', freshwater: 'in and around fresh water',
  forest: 'in woodland', grass: 'in grassland and open country', desert: 'in dry, hot places',
  mountain: 'in the mountains', polar: 'in the polar regions', town: 'close to people',
  air: 'on the wing', underground: 'underground',
};

export const CONTINENT_NL: Record<string, string> = {
  eu: 'Europa', af: 'Afrika', as: 'Azië', na: 'Noord-Amerika', sa: 'Zuid-Amerika',
  oc: 'Oceanië', an: 'Antarctica',
};
export const CONTINENT_EN: Record<string, string> = {
  eu: 'Europe', af: 'Africa', as: 'Asia', na: 'North America', sa: 'South America',
  oc: 'Oceania', an: 'Antarctica',
};

export const STATUS_NL: Record<string, string> = {
  lc: 'Er zijn er nog veel', nt: 'Het gaat iets minder goed', vu: 'Kwetsbaar',
  en: 'Bedreigd', cr: 'Ernstig bedreigd', ew: 'Alleen nog in dierentuinen', ex: 'Uitgestorven',
};
export const STATUS_EN: Record<string, string> = {
  lc: 'Still plenty of them', nt: 'Doing a little less well', vu: 'Vulnerable',
  en: 'Endangered', cr: 'Critically endangered', ew: 'Only left in zoos', ex: 'Extinct',
};

export const STATUS_TONE: Record<string, string> = {
  lc: '#5da65f', nt: '#9fbd4a', vu: '#e0b13a', en: '#e08a3a', cr: '#d95a44',
  ew: '#a4553f', ex: '#7a6b63',
};

/** A list of names as a sentence: "Europa, Azië en Afrika". */
export function joinNames(names: string[], nl: boolean): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} ${nl ? 'en' : 'and'} ${names[names.length - 1]}`;
}

/**
 * The two or three things the book says about an animal in its own words, built out of the data
 * rather than written by hand - which is the only way there can be two thousand of them.
 */
export function facts(a: Animal, nl: boolean): string[] {
  const out: string[] = [];
  const fam = nl ? a.f : a.fe;
  if (fam && fold(fam) !== fold(nl ? a.n : a.e)) {
    out.push(nl ? `Hoort bij de familie van de ${fam.toLowerCase()}.` : `One of the ${fam.toLowerCase()} family.`);
  }
  const place = (nl ? HABITAT_NL : HABITAT_EN)[a.h];
  const conts = a.w.map(c => (nl ? CONTINENT_NL : CONTINENT_EN)[c]).filter(Boolean);
  if (place && conts.length) {
    out.push(nl
      ? `Leeft ${place}, in ${joinNames(conts, true)}.`
      : `Lives ${place}, in ${joinNames(conts, false)}.`);
  } else if (place) {
    out.push(nl ? `Leeft ${place}.` : `Lives ${place}.`);
  } else if (conts.length) {
    out.push(nl ? `Komt voor in ${joinNames(conts, true)}.` : `Found in ${joinNames(conts, false)}.`);
  }
  const food = (nl ? DIET_NL : DIET_EN)[a.t];
  if (food) out.push(nl ? `Eet vooral ${food}.` : `Eats mostly ${food}.`);
  // There used to be a last line comparing the animal with the child. It went with the size card,
  // when the child's height stopped being something the child sets: a sentence about "you",
  // measured against a height that is not yours, is not true. The ruler says the size now.
  return out;
}

/**
 * The visible part of a box that scrolls inside a band, or nothing if it has scrolled out.
 *
 * The canvas clips what is drawn, but it does not clip where a tap lands, so a search result half
 * hidden behind the keyboard still took the tap meant for the letter A, and a card scrolled up
 * behind the header took the tap meant for the title. Every box that scrolls inside a band is
 * registered through this, and a sliver too thin to mean anything is dropped.
 */
export function clipBox(y: number, h: number, top: number, bottom: number): { y: number; h: number } | null {
  const y0 = Math.max(y, top);
  const y1 = Math.min(y + h, bottom);
  return y1 - y0 < 6 ? null : { y: y0, h: y1 - y0 };
}
