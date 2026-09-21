/**
 * The sound of a table with things on it.
 *
 * A bead knocking into the ones beside it, an apple dropping into a crate, a block landing on a
 * tray, a peg hopping along the line, a rising run when a sum comes out right, and a soft double
 * thud when it does not. Nothing is a buzzer: getting one wrong here is the moment the objects
 * explain themselves, and a buzzer would say the opposite.
 *
 * All synthesised on the shared WebAudio context, like every other game here.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

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

/** A knock: a short band of filtered noise, which is what wood on wood actually is. */
function knock(freq: number, gain: number, dur = 0.05, q = 2.2): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const numbersfx = {
  /** a bead slides along the wire and knocks into the next */
  bead(): void { knock(1400, 0.06, 0.04, 3); },
  /** something is picked up off the table */
  lift(): void { ping(760, 0.05, 0.035, 'sine'); },
  /** an apple, a block or a counter lands where it belongs */
  drop(i: number): void {
    knock(520 + (i % 5) * 60, 0.09, 0.055, 1.6);
    ping(400 + (i % 8) * 28, 0.07, 0.03, 'triangle');
  },
  /** the peg hops one place along the number line */
  hop(n: number): void { ping(440 * Math.pow(2, (n % 8) / 12), 0.07, 0.035, 'triangle'); },
  /** the ten-frame just filled up, which is the whole point of that level */
  tenFull(): void { [660, 880].forEach((f, i) => ping(f, 0.2, 0.05, 'triangle', undefined, i * 0.07)); },
  tap(): void { ping(680, 0.06, 0.05, 'sine'); },
  pick(): void { knock(1800, 0.035); ping(900, 0.05, 0.03, 'sine'); },
  right(streak: number): void {
    const base = 523 * Math.pow(1.06, Math.min(10, streak));
    [base, base * 1.26, base * 1.5].forEach((f, i) => ping(f, 0.26, 0.055, 'triangle', undefined, i * 0.07));
  },
  wrong(): void { ping(300, 0.22, 0.055, 'triangle', 200); ping(220, 0.3, 0.045, 'sine', 150, 0.12); },
  /** the level is done */
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.5, 0.05, 'triangle', undefined, i * 0.13)); },
};
