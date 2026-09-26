/**
 * The sounds of Suri en de reuzentand.
 *
 * Every sound here is also a recording (`tand.*` rows in `src/platform/sfxspec.ts`), and the small
 * synthesised version underneath is what plays until it has loaded or if it never does. The
 * backgrounds - the drill, the wind of the ice age, the sea, the forest - are recordings only, and
 * a missing one is simply quiet.
 */

import { audioContext } from '../util/audio';
import { save } from '../util/storage';
import { loopSample, withSamples } from '../platform/samples';
import { feel } from '../platform/feel';

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

function noise(freq: number, q: number, gain: number, dur = 0.14, type: BiquadFilterType = 'bandpass'): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
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

export const storySfx = withSamples('tand', {
  brush(): void { noise(3200, 0.8, 0.03, 0.12); },
  shine(): void { [1320, 1760, 2093].forEach((f, i) => ping(f, 0.5, 0.03, 'sine', undefined, i * 0.08)); },
  lever(): void { ping(180, 0.25, 0.08, 'square', 90); noise(900, 2, 0.05, 0.2); },
  arrive(): void { ping(220, 0.5, 0.06, 'triangle', 440); },
  step(): void { ping(60, 0.35, 0.18, 'sine', 35); noise(200, 1, 0.1, 0.25, 'lowpass'); },
  roar(): void { ping(110, 1.2, 0.12, 'sawtooth', 55); noise(400, 0.7, 0.08, 1.0, 'lowpass'); },
  sniff(): void { noise(1800, 1.5, 0.05, 0.35); },
  trumpet(): void { ping(330, 0.9, 0.06, 'sawtooth', 520); },
  splash(): void { noise(1400, 0.6, 0.06, 0.5); },
  munch(): void { noise(2400, 1.2, 0.05, 0.1); setTimeout(() => noise(2200, 1.2, 0.05, 0.1), 180); },
  wrong(): void { ping(300, 0.22, 0.06, 'triangle', 200); ping(220, 0.3, 0.05, 'sine', 150, 0.12); },
  match(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.6, 0.05, 'triangle', undefined, i * 0.12)); },
  pick(): void { ping(1200, 0.12, 0.05); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background that belongs to a place, faded in and out as the story moves between them. */
export type Bed = 'drill' | 'wind' | 'sea' | 'forest' | 'garden';
const BEDS: Bed[] = ['drill', 'wind', 'sea', 'forest', 'garden'];

export function bed(which: Bed | null): void {
  for (const b of BEDS) loopSample(`tand.${b}Bed`, b === which);
}

/** A footstep of something very heavy is felt as well as heard. */
export function thud(): void { storySfx.step(); feel('heavy'); }
