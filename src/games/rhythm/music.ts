/**
 * Klankhuis: the music itself, with no canvas and no browser anywhere in it.
 *
 * Everything a note is - what it is called, how many hertz that is, how long it lasts against a
 * tempo, which beat of the bar it falls on, how close a tap was to it - is a plain function over
 * plain numbers, so it can be checked without a screen and without an ear. `tests/run.mjs` does
 * exactly that.
 *
 * Three things here are decisions rather than facts, and they are written down as such:
 *  - equal temperament from A4 = 440 Hz. Every other pitch is 440 * 2^(n/12), which is why the
 *    octave below is exactly 220 and why no interval but the octave is a whole ratio;
 *  - a beat is a quarter note. Every other value is counted in beats against that, so the same
 *    table serves 2/4, 3/4 and 4/4 without a special case;
 *  - the tap windows. Sixty milliseconds is about as tight as a five year old's hand goes, so that
 *    is what counts as on the beat; two hundred is where a tap stops belonging to that beat at all.
 */

// ---------------------------------------------------------------- pitch

export const A4_HZ = 440;
export const A4_MIDI = 69;

/** semitones above C, for the seven letters */
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 'A4' -> 69, 'C4' -> 60, 'Bb3' -> 58. MIDI numbering, where C4 is middle C. */
export function midiOf(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`not a note name: ${name}`);
  const step = LETTER[m[1].toUpperCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + step + acc;
}

/** Equal temperament, tuned from A4 = 440 Hz. */
export function freqOfMidi(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function noteFreq(name: string): number { return freqOfMidi(midiOf(name)); }

/** 60 -> 'C4'. Sharps only; nothing in this game is written with a flat. */
export function nameOfMidi(midi: number): string {
  const n = Math.round(midi);
  return `${SHARP_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

/** The letter on the bar, without the octave: what a child reads off a chime. */
export function letterOfMidi(midi: number): string {
  return SHARP_NAMES[((Math.round(midi) % 12) + 12) % 12];
}

/**
 * Which of the seven pitch classes this is, 0 for C.
 *
 * The chimes are coloured by this, the way real chime bars and boomwhackers are: the colour is
 * the note's name, so a child who cannot read yet can still be told which bar to hit.
 */
export function colourIndexOfMidi(midi: number): number {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const order = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  return order[pc];
}

// ---------------------------------------------------------------- duration

export type NoteValue = 'whole' | 'dottedHalf' | 'half' | 'dottedQuarter' | 'quarter' | 'eighth' | 'sixteenth';

/** A beat is a quarter note; everything else is counted against it. */
export const VALUE_BEATS: Record<NoteValue, number> = {
  whole: 4, dottedHalf: 3, half: 2, dottedQuarter: 1.5, quarter: 1, eighth: 0.5, sixteenth: 0.25,
};

export const beatSeconds = (bpm: number): number => 60 / bpm;

export function noteSeconds(value: NoteValue, bpm: number): number {
  return VALUE_BEATS[value] * beatSeconds(bpm);
}

/** The value a length in beats is written as, or null for a length with no single name. */
export function valueOfBeats(beats: number): NoteValue | null {
  const hit = (Object.keys(VALUE_BEATS) as NoteValue[]).find(v => Math.abs(VALUE_BEATS[v] - beats) < 1e-9);
  return hit ?? null;
}

// ---------------------------------------------------------------- the bar

export type TimeSig = '2/4' | '3/4' | '4/4';
export type Stress = 'strong' | 'medium' | 'weak';
export interface Beat { n: number; stress: Stress }

export function beatsPerBar(sig: TimeSig): number { return Number(sig.split('/')[0]); }

/**
 * The beats of one bar and how hard each is leaned on.
 *
 * The one is always the strong beat - that is what a bar *is*, the place the count starts again.
 * Four four has a second, lighter stress on the three, which is why it does not simply sound like
 * two bars of two; three four has none, which is why a waltz leans and a march does not.
 */
export function barBeats(sig: TimeSig): Beat[] {
  const n = beatsPerBar(sig);
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    stress: i === 0 ? 'strong' : (sig === '4/4' && i === 2 ? 'medium' : 'weak'),
  }));
}

/** Which beat of the bar a position in beats falls on, counting from 1. */
export function beatInBar(beat: number, sig: TimeSig): number {
  const n = beatsPerBar(sig);
  return (((Math.round(beat) % n) + n) % n) + 1;
}

// ---------------------------------------------------------------- how close a tap was

export type Grade = 'perfect' | 'good' | 'ok' | 'miss';

/** Milliseconds either side of the beat. Past `ok` a tap does not belong to that beat at all. */
export const TAP_WINDOWS = { perfect: 60, good: 120, ok: 200 } as const;

export function tapGrade(deltaMs: number): Grade {
  const d = Math.abs(deltaMs);
  if (d <= TAP_WINDOWS.perfect) return 'perfect';
  if (d <= TAP_WINDOWS.good) return 'good';
  if (d <= TAP_WINDOWS.ok) return 'ok';
  return 'miss';
}

/**
 * How close, as 1 for dead on and 0 for out of the window altogether.
 *
 * This is the number the ring is drawn from: a tight ring is a tap on the beat. There is no
 * millisecond anywhere on the screen - a child has no use for one - but there is one here.
 */
export function tapTightness(deltaMs: number): number {
  const d = Math.abs(deltaMs);
  if (d >= TAP_WINDOWS.ok) return 0;
  return 1 - d / TAP_WINDOWS.ok;
}

/** Early or late, which is the thing worth telling a child. */
export function tapSide(deltaMs: number): 'early' | 'late' | 'on' {
  if (Math.abs(deltaMs) <= TAP_WINDOWS.perfect) return 'on';
  return deltaMs < 0 ? 'early' : 'late';
}

// ---------------------------------------------------------------- the instrument

/**
 * The nine chimes, low to high: G A B C D E F G A, a C major scale running from the G below
 * middle C to the A above it.
 *
 * It starts on G rather than C for one reason: the last line of Vader Jacob goes *down* to the
 * sol, and a row of chimes that cannot play a tune right is not worth having. Every tune in the
 * game fits inside these nine bars exactly as it is sung, with nothing moved an octave to make
 * it fit - `tests/run.mjs` checks that.
 */
export const CHIME_MIDI = [55, 57, 59, 60, 62, 64, 65, 67, 69];
export const CHIME_LOW = CHIME_MIDI[0];
export const CHIME_HIGH = CHIME_MIDI[CHIME_MIDI.length - 1];

/** Where a pitch sits on the row of chimes, or -1 if the instrument cannot play it. */
export function chimeIndexOf(midi: number): number { return CHIME_MIDI.indexOf(midi); }

// ---------------------------------------------------------------- tunes

export interface Note {
  /** null is a rest */
  midi: number | null;
  beats: number;
}

export interface Tune {
  id: string;
  name: string;
  nameNl: string;
  sig: TimeSig;
  /** the tempo it is meant to go at, which is slower than a grown-up would sing it */
  bpm: number;
  notes: Note[];
}

const n = (midi: number | null, beats: number): Note => ({ midi, beats });

/**
 * Three songs every Dutch child has already heard, all long out of copyright, written here in the
 * key that fits the chimes with no note moved.
 *
 * Kortjakje and In de maneschijn are the Dutch words on two French melodies from the seventeen
 * hundreds - Ah vous dirai-je maman and Au clair de la lune - and Vader Jacob is Frère Jacques.
 */
export const TUNES: Tune[] = [
  {
    id: 'jacob', name: 'Brother John', nameNl: 'Vader Jacob', sig: '4/4', bpm: 96,
    notes: [
      // Vader Jacob, Vader Jacob
      n(60, 1), n(62, 1), n(64, 1), n(60, 1),
      n(60, 1), n(62, 1), n(64, 1), n(60, 1),
      // slaapt gij nog, slaapt gij nog
      n(64, 1), n(65, 1), n(67, 2),
      n(64, 1), n(65, 1), n(67, 2),
      // alle klokken luiden, alle klokken luiden
      n(67, 0.5), n(69, 0.5), n(67, 0.5), n(65, 0.5), n(64, 1), n(60, 1),
      n(67, 0.5), n(69, 0.5), n(67, 0.5), n(65, 0.5), n(64, 1), n(60, 1),
      // bim bam bom, bim bam bom - and the bom drops to the sol below, which is the whole reason
      // the chimes start on a G
      n(60, 1), n(55, 1), n(60, 2),
      n(60, 1), n(55, 1), n(60, 2),
    ],
  },
  {
    id: 'kortjakje', name: 'Twinkle, twinkle', nameNl: 'Altijd is Kortjakje ziek', sig: '4/4', bpm: 100,
    notes: [
      n(60, 1), n(60, 1), n(67, 1), n(67, 1), n(69, 1), n(69, 1), n(67, 2),
      n(65, 1), n(65, 1), n(64, 1), n(64, 1), n(62, 1), n(62, 1), n(60, 2),
      n(67, 1), n(67, 1), n(65, 1), n(65, 1), n(64, 1), n(64, 1), n(62, 2),
      n(67, 1), n(67, 1), n(65, 1), n(65, 1), n(64, 1), n(64, 1), n(62, 2),
      n(60, 1), n(60, 1), n(67, 1), n(67, 1), n(69, 1), n(69, 1), n(67, 2),
      n(65, 1), n(65, 1), n(64, 1), n(64, 1), n(62, 1), n(62, 1), n(60, 2),
    ],
  },
  {
    id: 'maneschijn', name: 'By the light of the moon', nameNl: 'In de maneschijn', sig: '4/4', bpm: 92,
    notes: [
      n(60, 1), n(60, 1), n(60, 1), n(62, 1), n(64, 2), n(62, 2),
      n(60, 1), n(64, 1), n(62, 1), n(62, 1), n(60, 4),
      n(60, 1), n(60, 1), n(60, 1), n(62, 1), n(64, 2), n(62, 2),
      n(60, 1), n(64, 1), n(62, 1), n(62, 1), n(60, 4),
    ],
  },
];

export const tuneById = (id: string): Tune => TUNES.find(t => t.id === id) ?? TUNES[0];

export const tuneBeats = (t: Tune): number => t.notes.reduce((a, x) => a + x.beats, 0);

/** Every note of the tune is a bar the instrument actually has. */
export function tuneInRange(t: Tune, lo = CHIME_LOW, hi = CHIME_HIGH): boolean {
  return t.notes.every(x => x.midi === null || (x.midi >= lo && x.midi <= hi && CHIME_MIDI.includes(x.midi)));
}

/** The tune ends where a bar ends, so it can be looped without a limp. */
export function tuneFillsBars(t: Tune): boolean {
  const per = beatsPerBar(t.sig);
  return Math.abs(tuneBeats(t) % per) < 1e-9;
}

/**
 * The tune as a list of (beat, note), so a player can be driven off absolute positions rather
 * than by adding durations up as it goes - which is how a sequence drifts.
 */
export function tuneEvents(t: Tune): Array<{ beat: number; midi: number | null; beats: number }> {
  let at = 0;
  return t.notes.map(x => { const e = { beat: at, midi: x.midi, beats: x.beats }; at += x.beats; return e; });
}

// ---------------------------------------------------------------- the sequencer

/** Eight steps is two bars of four four, and nine rows is the whole instrument. */
export const SEQ_STEPS = 8;
export const SEQ_PITCHES = CHIME_MIDI.length;
/** one row per chime, so the mask has nine bits and can never exceed this */
export const SEQ_MAX_MASK = (1 << SEQ_PITCHES) - 1;

export type Grid = boolean[][];

/** A grid is `grid[step][pitch]`, with pitch 0 the lowest chime. */
export function emptyGrid(): Grid {
  return Array.from({ length: SEQ_STEPS }, () => Array.from({ length: SEQ_PITCHES }, () => false));
}

/**
 * The grid as one small number per step - a bit per chime - because that is what has to survive
 * in localStorage beside every other game's save, and an array of arrays of booleans does not
 * deserve the room.
 */
export function encodeGrid(grid: Grid): number[] {
  return Array.from({ length: SEQ_STEPS }, (_, s) => {
    let mask = 0;
    for (let p = 0; p < SEQ_PITCHES; p++) if (grid[s]?.[p]) mask |= 1 << p;
    return mask;
  });
}

export function decodeGrid(rows: number[]): Grid {
  const safe = sanitiseSteps(rows);
  return Array.from({ length: SEQ_STEPS }, (_, s) =>
    Array.from({ length: SEQ_PITCHES }, (_, p) => (safe[s] & (1 << p)) !== 0));
}

/**
 * Whatever was in the save turned into eight whole numbers in range.
 *
 * A save is a text file on somebody's phone. It can be truncated, hand-edited, half written by a
 * browser that was killed mid-flush, or left over from a version of the grid that was a different
 * size. None of that may stop the game opening, so nothing here throws and nothing here trusts.
 */
export function sanitiseSteps(v: unknown): number[] {
  const out = Array.from({ length: SEQ_STEPS }, () => 0);
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < SEQ_STEPS; i++) {
    const raw = v[i];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    out[i] = Math.max(0, Math.min(SEQ_MAX_MASK, Math.floor(raw)));
  }
  return out;
}

export const gridNoteCount = (g: Grid): number =>
  g.reduce((a, row) => a + row.reduce((b, on) => b + (on ? 1 : 0), 0), 0);

/** The notes of one step of the grid, low to high. */
export function stepNotes(g: Grid, step: number): number[] {
  const row = g[((step % SEQ_STEPS) + SEQ_STEPS) % SEQ_STEPS] ?? [];
  const out: number[] = [];
  for (let p = 0; p < SEQ_PITCHES; p++) if (row[p]) out.push(CHIME_MIDI[p]);
  return out;
}
