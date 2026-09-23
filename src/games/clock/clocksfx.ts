/**
 * The sound of a clock room.
 *
 * A dry tick when a hand passes a minute, a small wooden knock on a button, a rising chime when a
 * reading is right, a soft double thud when it is not, and the hour striking when a level is done.
 * All synthesised on the shared WebAudio context, like every other game here.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

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
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** A tick: a very short band of noise, which is what a escapement actually sounds like. */
function click(freq: number, gain: number, dur = 0.035): void {
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
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const clocksfx = withSamples('clock', {
  /** a hand has moved onto a new minute under the finger */
  tick(): void { click(2100, 0.05); },
  /** a hand has landed on a five, which is worth hearing */
  tock(): void { click(1500, 0.07, 0.05); },
  tap(): void { ping(680, 0.06, 0.05, 'sine'); },
  pick(): void { click(1800, 0.04); ping(900, 0.05, 0.03, 'sine'); },
  right(streak: number): void {
    const base = 523 * Math.pow(1.06, Math.min(10, streak));
    [base, base * 1.26, base * 1.5].forEach((f, i) => ping(f, 0.26, 0.055, 'triangle', undefined, i * 0.07));
  },
  wrong(): void { ping(300, 0.22, 0.06, 'triangle', 200); ping(220, 0.3, 0.05, 'sine', 150, 0.12); },
  /** the level is done: the hour striking, softly */
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.5, 0.05, 'triangle', undefined, i * 0.13)); },
});
