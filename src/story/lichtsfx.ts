/**
 * The sounds of Suri en het lichtje in de diepte.
 *
 * As with the tooth (`storysfx.ts`): every sound has a row in `src/platform/sfxspec.ts` so it can
 * be recorded, and the small synthesised version here is what plays until the recording has loaded
 * or if there is none. The backgrounds - the waves against the ship, the reef, the deep, the
 * submarine's motor - are recordings only, and a missing one is simply quiet.
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

export const lichtSfx = withSamples('lichtje', {
  /** the light on the camera screen, tapped */
  spotted(): void { [880, 1320].forEach((f, i) => ping(f, 0.35, 0.04, 'sine', undefined, i * 0.1)); },
  /** the submarine going under */
  splash(): void { noise(900, 0.5, 0.08, 0.7, 'lowpass'); noise(2400, 0.8, 0.03, 0.9, 'bandpass', 0.2); },
  /** a school of fish darting away */
  swish(): void { noise(1800, 0.7, 0.05, 0.35); },
  /** a sperm whale clicking, which is how it finds squid in the dark */
  clicks(): void { for (let i = 0; i < 6; i++) noise(2600, 4, 0.08, 0.02, 'bandpass', i * 0.28); },
  /** the lamps going on or off */
  lamp(): void { ping(140, 0.18, 0.07, 'square', 90); noise(4000, 1, 0.02, 0.08); },
  /** the anglerfish seen in the light */
  reveal(): void { [392, 523, 659, 784].forEach((f, i) => ping(f, 0.8, 0.04, 'triangle', undefined, i * 0.15)); },
  /** back at the surface */
  arrive(): void { ping(330, 0.6, 0.05, 'triangle', 495); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background that belongs to a place, faded in and out as the submarine moves between them. */
export type Bed = 'surface' | 'reef' | 'deep' | 'motor';
const BEDS: Bed[] = ['surface', 'reef', 'deep', 'motor'];

/** One place's background, plus the motor on top of it while the submarine is moving. */
export function bed(which: Bed | null, motor = false): void {
  for (const b of BEDS) loopSample(`lichtje.${b}Bed`, b === which || (b === 'motor' && motor));
}
