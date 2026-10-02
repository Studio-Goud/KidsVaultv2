/**
 * Liedjesmaker - the pure rules: the scale, the song, the tempo, the example tunes.
 *
 * A song is a row of slots. A slot holds one animal or nothing, and nothing is a rest. That is the
 * whole idea of a tune, and it is the part a child of four can see: the order of the animals is
 * the order of the notes. There is no score, no star and nothing to get wrong; a song cannot be
 * bad. Everything here is plain data so a test can check it without a browser.
 *
 * It practises listening to a row of notes and putting things in an order. It does not claim a
 * child learns music from it (CLAUDE.md rule 3).
 */

export type AnimalId = 'frog' | 'dog' | 'cat' | 'bird' | 'mouse';
export type Tempo = 'slow' | 'fast';
/** one slot: an animal, or null for a rest */
export type Slot = AnimalId | null;
export type Song = Slot[];

export interface Note {
  animal: AnimalId;
  /** Hz, equal temperament, A4 = 440 */
  freq: number;
  /** the name of the note, for the parent and the debug handle */
  name: string;
  nameNl: string;
  /** what the animal is called, for the label under it */
  label: string;
  labelNl: string;
}

/**
 * A major pentatonic scale, C D E G A. Product decision, and a well-known fact of music: with these
 * five notes there are no two that clash, so any order a child chooses sounds like a tune. That is
 * the reason the game has five animals and not eight (do re mi fa sol la ti do).
 * The frequencies are the standard equal-tempered ones for C4 D4 E4 G4 A4.
 */
export const NOTES: readonly Note[] = [
  { animal: 'frog', freq: 261.63, name: 'C', nameNl: 'do', label: 'Frog', labelNl: 'Kikker' },
  { animal: 'dog', freq: 293.66, name: 'D', nameNl: 're', label: 'Dog', labelNl: 'Hond' },
  { animal: 'cat', freq: 329.63, name: 'E', nameNl: 'mi', label: 'Cat', labelNl: 'Kat' },
  { animal: 'bird', freq: 392.0, name: 'G', nameNl: 'sol', label: 'Bird', labelNl: 'Vogel' },
  { animal: 'mouse', freq: 440.0, name: 'A', nameNl: 'la', label: 'Mouse', labelNl: 'Muis' },
];

export const ANIMAL_IDS: readonly AnimalId[] = NOTES.map(n => n.animal);

/** The full game: eight places. Product decision: eight is a tune a child can hum back. */
export const SLOTS_FULL = 8;
/** The simple shape for two and three (`src/platform/who.ts`): four places, three animals. */
export const SLOTS_SIMPLE = 4;
/** Low, middle and high: three notes that are easy to tell apart by ear. */
export const ANIMALS_SIMPLE: readonly AnimalId[] = ['frog', 'cat', 'bird'];

/**
 * Seconds between two steps. Product decision, not research: slow is about 83 steps a minute, a
 * walking pace a small hand can follow with its eyes; fast is about 140, a skipping pace.
 * Two tempos, not a slider, because a choice of two is a choice a four-year-old can make.
 */
export const TEMPO_SECS: Record<Tempo, number> = { slow: 0.72, fast: 0.43 };

/** A song played this many times ends the session: Suri says it is a lovely song. Product decision. */
export const PLAYS_BEFORE_END = 3;

export const noteFor = (a: AnimalId): Note => NOTES.find(n => n.animal === a)!;
export const isAnimal = (a: unknown): a is AnimalId => typeof a === 'string' && ANIMAL_IDS.includes(a as AnimalId);

/** The animals that sit on the shelf in this shape of the game. */
export const shelfFor = (simple: boolean): readonly AnimalId[] => (simple ? ANIMALS_SIMPLE : ANIMAL_IDS);
export const slotCount = (simple: boolean): number => (simple ? SLOTS_SIMPLE : SLOTS_FULL);

export const emptySong = (n: number = SLOTS_FULL): Song => Array.from({ length: n }, () => null);

/** When each step starts, in seconds from the moment of Speel. Rests take a step too. */
export function stepTimes(tempo: Tempo, n: number): number[] {
  const d = TEMPO_SECS[tempo];
  return Array.from({ length: Math.max(0, n) }, (_, i) => i * d);
}

/** How long the whole song lasts, the last note included. */
export const songLength = (tempo: Tempo, n: number): number => n * TEMPO_SECS[tempo];

/** Which step a time falls in, or -1 before the start and n once it is over. */
export function stepAt(tempo: Tempo, n: number, secs: number): number {
  if (secs < 0) return -1;
  const i = Math.floor(secs / TEMPO_SECS[tempo]);
  return i >= n ? n : i;
}

/**
 * Put an animal in a slot. Pure: returns a new song. A slot that does not exist or an animal that
 * is not one of the five leaves the song as it was, so no gesture can break it.
 */
export function place(song: Song, slot: number, animal: AnimalId): Song {
  if (!Number.isInteger(slot) || slot < 0 || slot >= song.length || !isAnimal(animal)) return song.slice();
  const out = song.slice();
  out[slot] = animal;
  return out;
}

/** Take the animal out of a slot, which makes it a rest. */
export function remove(song: Song, slot: number): Song {
  if (!Number.isInteger(slot) || slot < 0 || slot >= song.length) return song.slice();
  const out = song.slice();
  out[slot] = null;
  return out;
}

/** Move an animal from one slot to another; the one that was there goes. */
export function move(song: Song, from: number, to: number): Song {
  const a = song[from];
  if (!a) return song.slice();
  return place(remove(song, from), to, a);
}

export const isEmpty = (song: Song): boolean => song.every(s => s === null);
export const filled = (song: Song): number => song.filter(s => s !== null).length;
export const firstEmpty = (song: Song): number => song.findIndex(s => s === null);

/** The example tunes, for a child who has not seen what a tune is. All eight places. */
export interface Example { id: string; name: string; nameNl: string; sayNl: string; say: string; song: Song }

const C = 'frog', D = 'dog', E = 'cat', G = 'bird', A = 'mouse';
export const EXAMPLES: readonly Example[] = [
  {
    id: 'suri', name: "Suri's tune", nameNl: "Suri's liedje",
    say: "This is Suri's tune. Three animals, again and again.", sayNl: "Dit is Suri's liedje. Drie dieren, steeds opnieuw.",
    song: [C, E, G, C, E, G, C, E],
  },
  {
    id: 'stairs', name: 'Stairs', nameNl: 'Trap',
    say: 'Up the stairs, one animal after the other.', sayNl: 'De trap op, het ene dier na het andere.',
    song: [C, D, E, G, A, null, A, null],
  },
  {
    id: 'rock', name: 'To and fro', nameNl: 'Heen en weer',
    say: 'To and fro, and a rest at the end.', sayNl: 'Heen en weer, en aan het eind een stilte.',
    song: [C, D, E, D, C, D, E, null],
  },
];

/** An example fitted to the number of places (it is only offered in the full shape, but be safe). */
export function exampleSong(i: number, n: number = SLOTS_FULL): Song {
  const ex = EXAMPLES[Math.max(0, Math.min(EXAMPLES.length - 1, i))].song;
  return Array.from({ length: n }, (_, k) => ex[k] ?? null);
}
