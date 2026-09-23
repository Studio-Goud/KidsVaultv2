/**
 * The sounds of a clear night.
 *
 * Nothing here is loud. A game about holding a shape in your head is a game you play quietly, so
 * the palette is cold and bell-like: a soft chime under the finger when a star is picked up, a
 * note that climbs as the figure is drawn, and a wide, slow shimmer when it is right. Wrong is a
 * low fall rather than a buzz - nothing in Suri tells a child off.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

/** A bell: a sine with a touch of its own fifth above, which is what makes it read as glass. */
function bell(freq: number, dur: number, gain: number, when = 0, detune = 1.5): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(ctx.destination);
  for (const [f, a] of [[freq, 1], [freq * detune, 0.35], [freq * 2, 0.16]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    const og = ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

/** Air: the sound of a wide sky, used under the big moments so they are not just a note. */
function air(dur: number, gain: number, from: number, to: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * Math.min(2, dur + 0.1));
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.03 * w) / 1.03;
    d[i] = last * 3.4;
  }
  const src = ctx.createBufferSource();
  src.buffer = b;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** A pentatonic ladder, so any two notes played together still sound like they belong. */
const LADDER = [523.25, 587.33, 698.46, 783.99, 932.33, 1046.5, 1174.7, 1396.9];

export const night = withSamples('nightwatch', {
  /** a finger lands on a star */
  hold(): void { bell(1174.7, 0.22, 0.05); },
  /** a line is finished; the note climbs with how much of the figure is there */
  line(step: number): void { bell(LADDER[Math.min(step, LADDER.length - 1)], 0.5, 0.075); },
  /**
   * A star locking under a finger that has not lifted.
   *
   * The pitch climbs a rung of the ladder per star, and past the top of the ladder it carries on an
   * octave higher, so a run of nine feels like a run of nine rather than nine of the same note. It
   * is the cheapest satisfying thing in the whole game.
   */
  lock(run: number): void {
    const i = Math.max(0, Math.min(23, Math.round(run)));
    const oct = Math.floor(i / LADDER.length);
    bell(LADDER[i % LADDER.length] * Math.pow(2, Math.min(2, oct)), 0.2, 0.062);
  },
  /** the sky turning over once the lines have gone out */
  turn(): void { air(0.75, 0.03, 2400, 800); bell(587.33, 0.55, 0.035, 0, 1.33); },
  /** a line taken away again */
  undo(): void { bell(392, 0.3, 0.05, 0, 1.33); },
  /** the figure lighting up for you to look at */
  show(): void { air(0.9, 0.035, 500, 2600); bell(659.25, 0.9, 0.045); },
  /** the whole figure, right */
  solved(): void {
    air(1.6, 0.045, 900, 3400);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, 1.5 - i * 0.12, 0.085, i * 0.1));
  },
  /** a line that is not in the figure: a fall, not a buzz */
  wrong(): void { bell(330, 0.55, 0.07, 0, 1.19); bell(247, 0.7, 0.05, 0.08, 1.19); },
  /** asking to see it once more */
  peek(): void { bell(880, 0.3, 0.05, 0, 1.5); },
  tap(): void { bell(784, 0.14, 0.05); },
  /** every figure in the sky */
  complete(): void {
    air(2.4, 0.05, 700, 4200);
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => bell(f, 1.8 - i * 0.1, 0.08, i * 0.13));
  },
});
