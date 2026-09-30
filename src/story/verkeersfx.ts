/**
 * The sounds of Suri en de fietstocht.
 *
 * Paste these rows into `src/platform/sfxspec.ts` (under a `// ---- Suri en de fietstocht` heading)
 * and add `g === 'verkeer' ? readFileSync('src/story/verkeersfx.ts', 'utf8')` to the lookup in
 * `tests/run.mjs`, so every row is checked against a method below. Then `npm run sfx`.
 *
 *   'verkeer.helmet': { prompt: `a small plastic click of a bicycle helmet buckle closing, ${SOFT}`, secs: 0.6, max: 0.4 },
 *   'verkeer.bell': { prompt: `a bright friendly bicycle bell, two quick rings, tring tring, ${SOFT}`, secs: 1.2, max: 1 },
 *   'verkeer.pedal': tap('a soft bicycle chain tick and a pedal turning, one gentle click'),
 *   'verkeer.carPass': { prompt: `a small quiet car driving past on a street, a soft whoosh from left to right, ${SOFT}`, secs: 2.5, max: 2.2, gain: 0.7 },
 *   'verkeer.carStop': { prompt: `a small quiet car slowing down and stopping, a soft hush of tyres and one gentle brake sigh, ${SOFT}`, secs: 2, max: 1.8, gain: 0.7 },
 *   'verkeer.lightClick': tap('a traffic light switching over, one soft mechanical click'),
 *   'verkeer.green': { prompt: `a gentle two note chime going up, a friendly signal that it is fine to go, ${SOFT}`, secs: 0.9, max: 0.8 },
 *   'verkeer.found': right('a bright soft wooden marimba double note going up, finding something you looked for'),
 *   'verkeer.arrive': { prompt: `a bicycle rolling to a stop on a garden path, a soft tyre crunch and a brake squeak, ${SOFT}`, secs: 1.5, max: 1.3 },
 *   'verkeer.door': { prompt: `a wooden front door opening, a soft creak and a cheerful little greeting chime, ${SOFT}`, secs: 1.5, max: 1.3 },
 *   'verkeer.done': done('a warm cosy ending at grandma\'s house, soft chimes and a happy little flourish'),
 *   'verkeer.homeBed': { prompt: `a quiet sunny morning in front of a house, a few birds singing softly far away, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *   'verkeer.streetBed': { prompt: `a calm quiet residential street in the daytime, distant birds and very faint far away traffic, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *   'verkeer.pathBed': { prompt: `cycling along a cycle path on a breezy day, soft wind, leaves rustling and birds, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *   'verkeer.omaBed': { prompt: `a cosy village garden in the afternoon, soft birdsong and a faint wind chime, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *
 * Soft on purpose, like the other stories: a car is a whoosh, never a horn; the bell is friendly and
 * not a warning. Nothing in this story is allowed to startle, and the sound of the road is the part
 * most likely to, so there is no engine roar, no screech and no horn anywhere.
 */

import { audioContext } from '../util/audio';
import { save } from '../util/storage';
import { loopSample, withSamples } from '../platform/samples';

const on = (): boolean => save.sound !== false;

function ping(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** Noise that swells and fades, for a car going by: `peak` is how far into it the loudest point is. */
function swell(freq: number, q: number, gain: number, dur: number, peak = 0.5, type: BiquadFilterType = 'bandpass', when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const env = k < peak ? k / peak : (1 - k) / (1 - peak);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const verkeerSfx = withSamples('verkeer', {
  /** the helmet buckle */
  helmet(): void { ping(1800, 0.05, 0.04, 'square', 1200); ping(1300, 0.06, 0.03, 'square', 900, 0.07); },
  /** a bicycle bell: two partials that ring a little and die, twice */
  bell(): void {
    for (const at of [0, 0.22]) { ping(2637, 0.5, 0.04, 'sine', undefined, at); ping(3951, 0.35, 0.02, 'sine', undefined, at); }
  },
  /** one turn of the pedals */
  pedal(): void { ping(900, 0.03, 0.02, 'square', 600); },
  /** a small car going by, soft */
  carPass(): void { swell(700, 0.7, 0.07, 2.2, 0.5, 'lowpass'); },
  /** a small car slowing to a stop: the whoosh dies away and a soft sigh ends it */
  carStop(): void { swell(600, 0.7, 0.06, 1.6, 0.25, 'lowpass'); swell(2400, 2, 0.015, 0.4, 0.3, 'bandpass', 1.3); },
  /** a traffic light changing */
  lightClick(): void { ping(500, 0.04, 0.05, 'square', 300); },
  /** it is green: two notes going up */
  green(): void { [659, 880].forEach((f, i) => ping(f, 0.35, 0.04, 'sine', undefined, i * 0.14)); },
  /** the sign, found */
  found(): void { [784, 988].forEach((f, i) => ping(f, 0.3, 0.035, 'triangle', undefined, i * 0.12)); },
  /** rolling to a stop at grandma's gate */
  arrive(): void { swell(1800, 1.5, 0.025, 0.9, 0.3, 'bandpass'); ping(1400, 0.25, 0.012, 'sine', 1200, 0.85); },
  /** grandma's door */
  door(): void { ping(220, 0.25, 0.04, 'sawtooth', 180); [784, 1047].forEach((f, i) => ping(f, 0.4, 0.035, 'triangle', undefined, 0.3 + i * 0.12)); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background that belongs to a place. */
export type Bed = 'home' | 'street' | 'path' | 'oma';
const BEDS: Bed[] = ['home', 'street', 'path', 'oma'];

/** Start one background and stop the others; `null` stops them all. Recordings only: a missing one is quiet. */
export function bed(which: Bed | null): void {
  for (const b of BEDS) loopSample(`verkeer.${b}Bed`, b === which);
}
