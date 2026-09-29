/**
 * The sounds of Suri en de verloren satelliet.
 *
 * As with the other stories (`storysfx.ts`, `lichtsfx.ts`): every sound has a row in
 * `src/platform/sfxspec.ts` so it can be recorded once, and the small synthesised version here is
 * what plays until the recording has loaded or if there is none. The backgrounds - the launch pad in
 * the morning, the engines, the hum of the cabin, the wind on Mars, the sea - are recordings only,
 * and a missing one is simply quiet.
 *
 * Space itself is silent, and the story does not pretend otherwise: what you hear out there is the
 * inside of the capsule, the motors and the radio, never an explosion outside the window.
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

export const ruimteSfx = withSamples('satelliet', {
  /** Stip found on his last photo */
  spotted(): void { [660, 990].forEach((f, i) => ping(f, 0.3, 0.04, 'sine', undefined, i * 0.1)); },
  /** the hatch closing behind you */
  hatch(): void { noise(300, 1, 0.1, 0.25, 'lowpass'); ping(110, 0.2, 0.06, 'square', 70, 0.05); },
  /** the engines lighting */
  ignite(): void { noise(200, 0.4, 0.12, 1.6, 'lowpass'); noise(900, 0.6, 0.04, 1.2, 'bandpass', 0.1); },
  /** the empty first stage coming loose */
  separate(): void { noise(500, 1.5, 0.1, 0.18, 'lowpass'); ping(180, 0.3, 0.05, 'triangle', 90, 0.05); },
  /** the motor pushing you faster, on the way to the next place */
  boost(): void { noise(400, 0.7, 0.07, 1.0, 'lowpass'); ping(160, 0.8, 0.03, 'sawtooth', 240); },
  /** the radio: a short crackle and two beeps, the way mission control sounds */
  radio(): void { noise(2200, 2, 0.03, 0.2); [1200, 900].forEach((f, i) => ping(f, 0.12, 0.03, 'square', undefined, 0.2 + i * 0.16)); },
  /** little thrusters puffing, to land or to hover */
  thrusters(): void { for (let i = 0; i < 4; i++) noise(1600, 1.2, 0.05, 0.08, 'bandpass', i * 0.14); },
  /** the robot arm moving */
  whir(): void { ping(300, 0.35, 0.03, 'sawtooth', 420); },
  /** the claw closing on something */
  grab(): void { noise(1200, 3, 0.07, 0.06); ping(520, 0.2, 0.04, 'triangle', 780, 0.05); },
  /** a chunk of ice bumping the capsule */
  bump(): void { noise(160, 1, 0.14, 0.3, 'lowpass'); noise(2400, 3, 0.03, 0.1, 'bandpass', 0.02); },
  /** Stip caught, and answering */
  caught(): void { [784, 988, 1175, 1568].forEach((f, i) => ping(f, 0.25, 0.035, 'square', undefined, i * 0.12)); },
  /** the parachutes opening with a soft whump */
  chutes(): void { noise(220, 0.8, 0.12, 0.5, 'lowpass'); noise(600, 0.8, 0.05, 0.9, 'lowpass', 0.2); },
  /** into the sea */
  splash(): void { noise(900, 0.5, 0.1, 0.8, 'lowpass'); noise(2600, 0.8, 0.03, 1.0, 'bandpass', 0.15); },
  done(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.7, 0.05, 'triangle', undefined, i * 0.14)); },
});

/** A background that belongs to a place. */
export type Bed = 'pad' | 'engine' | 'cabin' | 'mars' | 'sea';
const BEDS: Bed[] = ['pad', 'engine', 'cabin', 'mars', 'sea'];

/** One place's background, and the engines on top of it while they burn. */
export function bed(which: Bed | null, engine = false): void {
  for (const b of BEDS) loopSample(`satelliet.${b}Bed`, b === which || (b === 'engine' && engine));
}
