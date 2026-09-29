/**
 * The sounds of Suri heeft buikpijn.
 *
 * As with the other stories: every sound has a row in `src/platform/sfxspec.ts` so it can be
 * recorded once, and the small synthesised version here is what plays until the recording has loaded
 * or if there is none. The backgrounds - the quiet bedroom, the wet inside of the mouth, the gurgling
 * belly, the whoosh of the blood - are recordings only, and a missing one is simply quiet. They are
 * soft on purpose: the inside of a body should sound cosy, not like a horror film.
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

function noise(freq: number, q: number, gain: number, dur = 0.14, type: BiquadFilterType = 'bandpass', when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const buikSfx = withSamples('buikpijn', {
  /** shrinking down to smaller than a grain of sand */
  shrink(): void { [1568, 1319, 1047, 784, 659].forEach((f, i) => ping(f, 0.35, 0.03, 'sine', undefined, i * 0.09)); },
  /** growing big again */
  grow(): void { [659, 784, 1047, 1319, 1568].forEach((f, i) => ping(f, 0.35, 0.03, 'sine', undefined, i * 0.09)); },
  /** teeth biting into apple */
  chew(): void { noise(2800, 1.2, 0.08, 0.09); noise(1400, 1, 0.05, 0.12, 'bandpass', 0.04); },
  /** a gulp */
  swallow(): void { ping(260, 0.25, 0.06, 'sine', 120); noise(500, 1, 0.04, 0.2, 'lowpass'); },
  /** a ring of muscle squeezing */
  squeeze(): void { noise(380, 1.5, 0.06, 0.3, 'lowpass'); ping(140, 0.3, 0.03, 'sine', 90); },
  /** landing in the stomach */
  splash(): void { noise(900, 0.6, 0.08, 0.5, 'lowpass'); ping(300, 0.3, 0.03, 'sine', 150, 0.05); },
  /** the stomach kneading */
  knead(): void { for (let i = 0; i < 3; i++) ping(180 + i * 40, 0.18, 0.04, 'sine', 120, i * 0.1); },
  /** the germs, found */
  found(): void { [440, 415].forEach((f, i) => ping(f, 0.3, 0.035, 'triangle', undefined, i * 0.2)); },
  /** into a blood vessel */
  dive(): void { noise(600, 0.6, 0.06, 0.8, 'lowpass'); },
  /** a white blood cell swallowing a germ */
  gulp(): void { ping(520, 0.12, 0.05, 'sine', 260); ping(700, 0.15, 0.03, 'triangle', undefined, 0.1); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background that belongs to a place. */
export type Bed = 'room' | 'mouth' | 'belly' | 'blood' | 'morning';
const BEDS: Bed[] = ['room', 'mouth', 'belly', 'blood', 'morning'];

export function bed(which: Bed | null): void {
  for (const b of BEDS) loopSample(`buikpijn.${b}Bed`, b === which);
}
