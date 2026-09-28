/**
 * The sounds of Van cel tot mens.
 *
 * As everywhere: each has a row in `src/platform/sfxspec.ts` so it can be recorded, and the small
 * synthesised version here plays until the recording has loaded, or if there is none. The
 * backgrounds are recordings only; a missing one is simply quiet.
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

export const evoSfx = withSamples('evo', {
  /** arriving at a stop on the time line */
  arrive(): void { [523, 784].forEach((f, i) => ping(f, 0.5, 0.04, 'sine', undefined, i * 0.09)); },
  /** a cell splitting in two */
  divide(): void { ping(300, 0.25, 0.05, 'sine', 600); ping(620, 0.2, 0.03, 'sine', undefined, 0.12); },
  stick(): void { ping(200, 0.3, 0.05, 'triangle', 150); },
  xray(): void { ping(1400, 0.25, 0.03, 'square', 700); noise(5000, 1, 0.02, 0.2); },
  bite(): void { noise(1800, 2, 0.08, 0.08); ping(180, 0.1, 0.06, 'square', 90); },
  hatch(): void { noise(3000, 3, 0.05, 0.05); noise(2600, 3, 0.05, 0.05, 'bandpass', 0.15); ping(900, 0.3, 0.03, 'sine', 1200, 0.3); },
  sniff(): void { noise(2500, 2, 0.04, 0.12); noise(2500, 2, 0.04, 0.12, 'bandpass', 0.2); },
  leap(): void { ping(400, 0.3, 0.05, 'sine', 900); },
  step(): void { noise(300, 1, 0.05, 0.08, 'lowpass'); },
  knap(): void { noise(3500, 4, 0.09, 0.05); ping(2400, 0.08, 0.03, 'square'); },
  fire(): void { noise(800, 0.5, 0.08, 0.9, 'lowpass'); },
  hand(): void { noise(1200, 0.4, 0.06, 0.4); },
  /** the asteroid: a rush and a deep boom */
  impact(): void { noise(600, 0.3, 0.08, 0.8, 'lowpass'); ping(50, 1.8, 0.2, 'sine', 25, 0.6); noise(150, 0.5, 0.18, 1.8, 'lowpass', 0.6); },
  /** a moth found, fluttering away */
  flutter(): void { for (let i = 0; i < 4; i++) noise(4000, 2, 0.03, 0.03, 'bandpass', i * 0.05); },
  tick(): void { ping(1800, 0.04, 0.03, 'square'); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background for where the animal is: under water, on land, at night, in the cave. */
export type Bed = 'water' | 'land' | 'night' | 'cave';
const BEDS: Bed[] = ['water', 'land', 'night', 'cave'];

export function bed(which: Bed | null): void {
  for (const b of BEDS) loopSample(`evo.${b}Bed`, b === which);
}
