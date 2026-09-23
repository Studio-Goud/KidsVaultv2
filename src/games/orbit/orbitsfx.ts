/**
 * The sounds of a quiet observatory.
 *
 * Space is silent, which is true but useless to a five-year-old who has just put Mars in the
 * wrong place. So the palette is instruments rather than space: a soft click under the finger,
 * a pure note that climbs as the row fills up, and a slow swell when a planet settles into its
 * orbit. Wrong is a short dip, not a buzzer.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, when = 0): void {
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
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A swell: something large arriving, filtered so it sits under the notes rather than over them. */
function swell(dur: number, gain: number, from: number, to: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Whole tones, so the ladder sounds like it keeps going up however long the row is. */
const STEP = [392, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77];

export const orbit = withSamples('orbit', {
  /** a planet picked up */
  pick(): void { tone(660, 0.07, 0.05, 'triangle'); },
  /** a planet landing in the right place; the note climbs with how many are already out */
  place(step: number): void {
    tone(STEP[Math.min(step, STEP.length - 1)], 0.42, 0.075, 'sine');
    swell(0.5, 0.035, 120, 70);
  },
  /** the wrong place: a dip, and then you try again */
  wrong(): void { tone(300, 0.3, 0.06, 'sine', 190); tone(200, 0.36, 0.04, 'triangle', 140, 0.06); },
  /** the whole row, in order */
  roundDone(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.55, 0.08, 'sine', undefined, i * 0.11));
    swell(1.3, 0.04, 90, 55);
  },
  /** moving between the four ways in */
  tab(): void { tone(880, 0.09, 0.045, 'triangle'); },
  /** turning to the next planet in Explore */
  turn(): void { tone(523.25, 0.2, 0.05, 'sine'); tone(784, 0.26, 0.03, 'sine', undefined, 0.05); },
  /** a moon opened up */
  moon(): void { tone(1174.7, 0.22, 0.045, 'sine'); tone(1567.98, 0.3, 0.025, 'sine', undefined, 0.06); },
  tap(): void { tone(660, 0.08, 0.05, 'triangle'); },
});
