/**
 * Klankhuis: the ladder, and where each round comes from.
 *
 * Nine levels in the order the thing is actually learnt. First the pulse on its own, because a
 * child who cannot feel a pulse cannot do anything else here. Then long against short, which is
 * what rhythm is made of. Then where the counting starts again - four, and then three, so that
 * "the beat" stops meaning "four". Then the ear: play back what you just heard, say whether the
 * second note was higher, fill in the note missing from a song you already know. Then two things
 * at once. And then the sequencer, which is the only level that asks nothing at all.
 *
 * Nothing in this file touches the canvas or the audio clock. A round is a list of notes at beat
 * positions and a list of the beats the child is asked for; who plays it and who draws it is
 * somebody else's problem.
 */

import { makeRng } from '../../util/rng';
import {
  barBeats, beatsPerBar, CHIME_MIDI, tuneById, tuneEvents, TUNES,
  type Stress, type TimeSig, type Tune,
} from './music';

/** The shared deterministic generator, so a level looks the same every time it is opened. */
type Rng = () => number;

export type LevelKind = 'tap' | 'echo' | 'pitch' | 'tune' | 'together' | 'make';

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  kind: LevelKind;
  /** how many rounds before the level is done; the sequencer has none */
  rounds: number;
  bpm: number;
  sig: TimeSig;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  {
    id: 'pulse', name: 'Clap along', nameNl: 'Klap mee', kind: 'tap', rounds: 5, bpm: 80, sig: '4/4',
    hint: 'The ball bounces on every beat. Tap the moment it touches the line.',
    hintNl: 'De bal stuitert op elke tel. Tik op het moment dat hij de lijn raakt.',
  },
  {
    id: 'longshort', name: 'Long and short', nameNl: 'Lang en kort', kind: 'tap', rounds: 5, bpm: 84, sig: '4/4',
    hint: 'A long block lasts two beats, a short one lasts one. Tap where each block starts.',
    hintNl: 'Een lang blok duurt twee tellen, een kort blok één. Tik waar elk blok begint.',
  },
  {
    id: 'four', name: 'Four to a bar', nameNl: 'Maat van vier', kind: 'tap', rounds: 6, bpm: 92, sig: '4/4',
    hint: 'One, two, three, four, and then one again. The one is the big one.',
    hintNl: 'Eén, twee, drie, vier, en dan weer één. De één is de grote.',
  },
  {
    id: 'three', name: 'Three to a bar', nameNl: 'Drie tellen', kind: 'tap', rounds: 6, bpm: 108, sig: '3/4',
    hint: 'This one counts to three. One, two, three - one, two, three. That is a waltz.',
    hintNl: 'Deze telt tot drie. Eén, twee, drie - eén, twee, drie. Dat is een wals.',
  },
  {
    id: 'echo', name: 'Echo', nameNl: 'Echo', kind: 'echo', rounds: 6, bpm: 88, sig: '4/4',
    hint: 'Listen, then play the same chimes back. Take your time: only the notes count here.',
    hintNl: 'Luister, en speel dezelfde klokjes na. Rustig aan: hier tellen alleen de noten.',
  },
  {
    id: 'highlow', name: 'High and low', nameNl: 'Hoog en laag', kind: 'pitch', rounds: 6, bpm: 84, sig: '4/4',
    hint: 'Two notes. Was the second one higher or lower? Later on: how much higher.',
    hintNl: 'Twee noten. Was de tweede hoger of lager? Later: hoeveel hoger.',
  },
  {
    id: 'song', name: 'The song', nameNl: 'Het liedje', kind: 'tune', rounds: 6, bpm: 92, sig: '4/4',
    hint: 'A song you know, with a note missing. Sing it in your head, then tap the chime that fits.',
    hintNl: 'Een liedje dat je kent, met een gat erin. Zing het in je hoofd en tik het klokje dat past.',
  },
  {
    id: 'together', name: 'Together', nameNl: 'Samen', kind: 'together', rounds: 4, bpm: 96, sig: '4/4',
    hint: 'Keep the drum going while the tune plays over the top. Two things at once.',
    hintNl: 'Hou de trom aan de gang terwijl het liedje eroverheen speelt. Twee dingen tegelijk.',
  },
  {
    id: 'make', name: 'Make your own', nameNl: 'Zelf maken', kind: 'make', rounds: 0, bpm: 100, sig: '4/4',
    hint: 'Tap the squares to write a tune, then press play. It is still here tomorrow.',
    hintNl: 'Tik op de vakjes en schrijf een deuntje. Druk op spelen. Morgen staat het er nog.',
  },
];

export const levelIndexOf = (id: string): number => Math.max(0, LEVELS.findIndex(l => l.id === id));

export function rngFor(level: Level, attempt: number): Rng {
  return makeRng(level.id.length * 7919 + attempt * 104729 + 11);
}

// ---------------------------------------------------------------- a round

/** One thing that sounds, at a position in beats from the start of the pattern. */
export interface Sound {
  beat: number;
  beats: number;
  /** null is the pulse only: a woodblock click, no pitch */
  midi: number | null;
  stress: Stress;
  /** the child is asked to tap here */
  ask: boolean;
}

export interface Round {
  kind: LevelKind;
  sig: TimeSig;
  bpm: number;
  bars: number;
  /** everything the game plays, in order */
  sounds: Sound[];
  /** the beats the child has to hit, in order */
  asks: number[];
  /** echo and song: the chimes to play back, in order */
  answer: number[];
  /** high and low: the two notes, and whether the question is which rung rather than which way */
  pair: { a: number; b: number; exact: boolean } | null;
  /** the song, and which of its notes were taken out */
  tune: Tune | null;
  blanks: number[];
  /**
   * Echo only: the chimes this phrase was built from. The rest of the instrument is greyed out
   * while the phrase is being played back, because picking one of three bars by ear is a fair
   * question for a five year old and picking one of nine is not.
   */
  pool: number[];
  /** what the level says over this round, beyond the level's own hint */
  say: string;
  sayNl: string;
}

const STRESS_OF = (beat: number, sig: TimeSig): Stress => {
  const bars = barBeats(sig);
  const i = Math.round(beat) % bars.length;
  return bars[i].stress;
};

const empty = (level: Level): Round => ({
  kind: level.kind, sig: level.sig, bpm: level.bpm, bars: 2,
  sounds: [], asks: [], answer: [], pair: null, tune: null, blanks: [], pool: [], say: '', sayNl: '',
});

const pick = <T>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];

/** A little figure to hang the pulse on, so a tapping level is music rather than a metronome. */
const FIGURES = [
  [60, 64, 67, 64],
  [60, 62, 64, 62],
  [67, 64, 60, 64],
  [60, 67, 64, 67],
];

// ---------------------------------------------------------------- the tapping levels

function tapRound(level: Level, rng: Rng, i: number): Round {
  const r = empty(level);
  const per = beatsPerBar(level.sig);

  if (level.id === 'pulse') {
    r.bars = 2;
    const fig = pick(rng, FIGURES);
    for (let b = 0; b < r.bars * per; b++) {
      r.sounds.push({ beat: b, beats: 1, midi: fig[b % fig.length], stress: STRESS_OF(b, level.sig), ask: true });
    }
    r.asks = r.sounds.map(s => s.beat);
    return r;
  }

  if (level.id === 'longshort') {
    r.bars = 2;
    const scale = [60, 62, 64, 65, 67];
    let beat = 0;
    let step = Math.floor(rng() * scale.length);
    while (beat < r.bars * per) {
      const left = r.bars * per - beat;
      // a long note only where a whole two beats are left, and never two longs in a row at the
      // start, so a bar still has something short in it to compare against
      const long = left >= 2 && rng() < 0.42;
      const beats = long ? 2 : 1;
      step = Math.max(0, Math.min(scale.length - 1, step + (rng() < 0.5 ? -1 : 1)));
      r.sounds.push({ beat, beats, midi: scale[step], stress: STRESS_OF(beat, level.sig), ask: true });
      beat += beats;
    }
    r.asks = r.sounds.map(s => s.beat);
    return r;
  }

  // four to a bar and three to a bar: every beat sounds, but what is asked for changes halfway
  // through the level - first tap every beat, then tap only the one, which is the whole point
  const onesOnly = i >= Math.floor(level.rounds / 2);
  r.bars = onesOnly ? 4 : 2;
  const fig = pick(rng, FIGURES);
  for (let b = 0; b < r.bars * per; b++) {
    const stress = STRESS_OF(b, level.sig);
    const one = stress === 'strong';
    r.sounds.push({
      beat: b, beats: 1,
      midi: one ? 60 : (onesOnly ? null : fig[b % fig.length]),
      stress, ask: onesOnly ? one : true,
    });
  }
  r.asks = r.sounds.filter(s => s.ask).map(s => s.beat);
  r.say = onesOnly ? 'Only on the one this time.' : 'Every beat.';
  r.sayNl = onesOnly ? 'Nu alleen op de één.' : 'Elke tel.';
  return r;
}

// ---------------------------------------------------------------- echo

/** the phrase the level played last time, so it never plays the same one twice running */
let lastEcho = '';

function echoRound(level: Level, rng: Rng, i: number): Round {
  const r = empty(level);
  const per = beatsPerBar(level.sig);
  r.bars = 2;
  // the pool opens out as the level goes on: three neighbouring chimes, then five, then seven
  const width = i < 2 ? 3 : i < 4 ? 5 : 7;
  const lo = Math.max(0, Math.min(CHIME_MIDI.length - width, 3 - Math.floor((width - 3) / 2)));
  const pool = CHIME_MIDI.slice(lo, lo + width);
  r.pool = pool;
  const count = i < 2 ? 3 : i < 4 ? 4 : 5;
  // every note is one beat or two, and the phrase is however many bars that comes to. A last
  // note stretched to fill the bar would be six beats long, which is not a phrase a child sings
  const rhythm: number[] = [];
  let beat = 0;
  for (let k = 0; k < count; k++) {
    const beats = k === count - 1 ? 2 : (rng() < 0.3 ? 2 : 1);
    rhythm.push(beats);
    beat += beats;
  }
  r.bars = Math.max(1, Math.ceil(beat / per));
  beat = 0;
  let prev = -1;
  for (let k = 0; k < count; k++) {
    let m = pick(rng, pool);
    // never the same note twice running: an echo of one note teaches nothing
    let guard = 0;
    while (m === prev && guard++ < 8) m = pick(rng, pool);
    prev = m;
    r.sounds.push({ beat, beats: rhythm[k], midi: m, stress: STRESS_OF(beat, level.sig), ask: false });
    r.answer.push(m);
    beat += rhythm[k];
  }
  // two rounds running on the same three notes is not ear training, it is a typing exercise
  const key = r.answer.join(',');
  if (key === lastEcho && pool.length > 2) {
    const swap = r.answer.length - 1;
    const other = pool.filter(m => m !== r.answer[swap] && m !== r.answer[swap - 1]);
    if (other.length) {
      const m = pick(rng, other);
      r.answer[swap] = m;
      r.sounds[swap].midi = m;
    }
  }
  lastEcho = r.answer.join(',');
  return r;
}

// ---------------------------------------------------------------- high and low

function pitchRound(level: Level, rng: Rng, i: number): Round {
  const r = empty(level);
  r.bars = 1;
  const exact = i >= 3;
  const ai = 2 + Math.floor(rng() * 5);
  // early on the two notes are far apart, which is the only fair way to ask a four year old
  // whether one is higher; later they close up to a step
  const reach = exact ? (i >= 5 ? 4 : 3) : (i < 2 ? 4 : 2);
  let step = 1 + Math.floor(rng() * reach);
  if (rng() < 0.5) step = -step;
  let bi = ai + step;
  if (bi < 0 || bi >= CHIME_MIDI.length) bi = ai - step;
  const a = CHIME_MIDI[ai], b = CHIME_MIDI[bi];
  r.pair = { a, b, exact };
  r.sounds.push({ beat: 0, beats: 1, midi: a, stress: 'strong', ask: false });
  r.sounds.push({ beat: 2, beats: 2, midi: b, stress: 'weak', ask: false });
  r.say = exact ? 'Which bar was the second note?' : 'Was the second note higher or lower?';
  r.sayNl = exact ? 'Welk klokje was de tweede noot?' : 'Was de tweede noot hoger of lager?';
  return r;
}

// ---------------------------------------------------------------- the song

/**
 * A phrase of a song a Dutch child already knows, with a note or three taken out.
 *
 * The blanks are never the first note - you need somewhere to start from - and never a rest.
 */
function tuneRound(level: Level, rng: Rng, i: number): Round {
  const r = empty(level);
  const tune = TUNES[i % TUNES.length];
  r.tune = tune;
  r.bpm = tune.bpm;
  r.sig = tune.sig;
  const per = beatsPerBar(tune.sig);
  const events = tuneEvents(tune);
  const phraseBeats = 8;
  const phrases = Math.max(1, Math.floor(events[events.length - 1].beat / phraseBeats));
  const from = (Math.floor(rng() * phrases) % phrases) * phraseBeats;
  const slice = events.filter(e => e.beat >= from && e.beat < from + phraseBeats);
  r.bars = Math.max(1, Math.round(phraseBeats / per));
  const holes = i < 2 ? 1 : i < 4 ? 2 : 3;
  const candidates = slice.map((_, k) => k).filter(k => k > 0 && slice[k].midi !== null);
  const chosen: number[] = [];
  while (chosen.length < Math.min(holes, candidates.length)) {
    const k = pick(rng, candidates);
    if (!chosen.includes(k)) chosen.push(k);
  }
  chosen.sort((a, b) => a - b);
  slice.forEach((e, k) => {
    r.sounds.push({
      beat: e.beat - from, beats: e.beats, midi: e.midi,
      stress: STRESS_OF(e.beat - from, r.sig), ask: false,
    });
  });
  r.blanks = chosen;
  r.answer = chosen.map(k => slice[k].midi as number);
  return r;
}

// ---------------------------------------------------------------- two at once

function togetherRound(level: Level, rng: Rng, i: number): Round {
  const r = empty(level);
  const tune = tuneById(i % 2 === 0 ? 'kortjakje' : 'maneschijn');
  r.tune = tune;
  r.bars = 2;
  const per = beatsPerBar(level.sig);
  const total = r.bars * per;
  const events = tuneEvents(tune).filter(e => e.beat < total);
  for (const e of events) {
    r.sounds.push({ beat: e.beat, beats: e.beats, midi: e.midi, stress: STRESS_OF(e.beat, level.sig), ask: false });
  }
  // the drum: on the one and the three to start with, then on every beat
  const everyBeat = i >= 2;
  for (let b = 0; b < total; b++) {
    if (!everyBeat && b % 2 !== 0) continue;
    r.asks.push(b);
  }
  r.say = everyBeat ? 'Now on every beat, and keep the tune going too.' : 'On the one and the three.';
  r.sayNl = everyBeat ? 'Nu op elke tel, en laat het liedje doorgaan.' : 'Op de één en de drie.';
  return r;
}

// ---------------------------------------------------------------- the one entry point

export function makeRound(level: Level, rng: Rng, i: number): Round {
  switch (level.kind) {
    case 'tap': return tapRound(level, rng, i);
    case 'echo': return echoRound(level, rng, i);
    case 'pitch': return pitchRound(level, rng, i);
    case 'tune': return tuneRound(level, rng, i);
    case 'together': return togetherRound(level, rng, i);
    default: return empty(level);
  }
}

/** How long the round's pattern runs, in beats. */
export const roundBeats = (r: Round): number => r.bars * beatsPerBar(r.sig);

// ---------------------------------------------------------------- stars

/**
 * Stars count what went right the first time, before the game played it back slowly or answered
 * a wrong chime with the right one. Half is worth a star, seven tenths two, and everything three.
 * The same ladder Klokkijken uses, so a star means the same thing across Suri.
 */
export function starsFor(right: number, total: number): number {
  if (total <= 0) return 0;
  const f = right / total;
  if (f >= 0.999) return 3;
  if (f >= 0.7) return 2;
  if (f >= 0.45) return 1;
  return 0;
}
