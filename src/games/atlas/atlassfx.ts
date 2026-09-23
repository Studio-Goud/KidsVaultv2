/**
 * The sound of a map being put together.
 *
 * A piece lifting off the table, a wooden click when it drops into its place, a soft slide when it
 * springs back, gulls over the sea when the dykes come off, and a little fanfare at the end of a
 * level. All synthesised on the shared WebAudio context, like every other game here. No files.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

function tone(
  freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, when = 0,
): void {
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

/** A short band of filtered noise: a knock, a card on a table, water. */
function noise(freq: number, gain: number, dur: number, q = 3, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const atlassfx = withSamples('atlas', {
  /** a button, a tile, anything pressed */
  tap(): void { tone(660, 0.06, 0.05, 'sine'); },
  /** a piece coming off the table into the hand */
  lift(): void { noise(2400, 0.035, 0.05, 2); tone(880, 0.05, 0.03, 'sine'); },
  /** it went home: a wooden click and a rising third */
  snap(streak: number): void {
    noise(900, 0.09, 0.05, 5);
    const base = 523 * Math.pow(1.05, Math.min(10, streak));
    [base, base * 1.25].forEach((f, i) => tone(f, 0.2, 0.05, 'triangle', undefined, i * 0.06));
  },
  /** it did not: two soft thuds, and no sting */
  miss(): void { tone(300, 0.18, 0.055, 'triangle', 210); tone(210, 0.26, 0.045, 'sine', 150, 0.11); },
  /** the piece sliding back to the hand */
  slide(): void { noise(600, 0.04, 0.16, 1.2); },
  /** the dykes come off and the water comes in */
  flood(): void {
    noise(400, 0.05, 0.9, 0.7);
    tone(120, 0.8, 0.05, 'sine', 70);
  },
  /** and back out again */
  drain(): void { noise(700, 0.035, 0.5, 0.9); tone(180, 0.4, 0.035, 'sine', 320); },
  /** the level is done */
  complete(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, 0.05, 'triangle', undefined, i * 0.12));
  },
});
