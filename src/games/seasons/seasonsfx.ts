/**
 * The sound of a year turning.
 *
 * A wooden knock on a button, a bright chime when an answer is right, a soft double thud when it
 * is not, a little rustle when a day wagon or a month is tapped, and three small sounds that belong
 * to the seasons scene itself - leaves, snow, a bird - so dragging the dial is heard as well as
 * seen. All synthesised on the shared WebAudio context, like every other game here.
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

/** A short burst of filtered noise: a rustle, a crunch, a hush of falling snow. */
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
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

let lastTurn = 0;

export const seasons = withSamples('seasons', {
  tap(): void { ping(680, 0.06, 0.05, 'sine'); },
  pick(): void { ping(900, 0.05, 0.04, 'sine'); noise(2600, 4, 0.03, 0.05); },
  right(streak = 0): void {
    const base = 523 * Math.pow(1.06, Math.min(10, streak));
    [base, base * 1.26, base * 1.5].forEach((f, i) => ping(f, 0.26, 0.055, 'triangle', undefined, i * 0.07));
  },
  wrong(): void { ping(300, 0.22, 0.06, 'triangle', 200); ping(220, 0.3, 0.05, 'sine', 150, 0.12); },
  /** the level is done */
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.5, 0.05, 'triangle', undefined, i * 0.13)); },
  /** the season dial or the sun being dragged; fires at most a few times a second, never a stream */
  turn(): void {
    const now = performance.now();
    if (now - lastTurn < 220) return;
    lastTurn = now;
    noise(1400, 2.4, 0.025, 0.08);
  },
  /** a day wagon tapped in the week train */
  wagon(): void { ping(520, 0.09, 0.045, 'square'); noise(1800, 3, 0.02, 0.05); },
  /** the autumn scene: a dry rustle of leaves */
  leaves(): void { noise(2200, 1.6, 0.03, 0.22, 'bandpass'); },
  /** the winter scene: a soft hush of snow */
  snow(): void { noise(5200, 0.8, 0.018, 0.3, 'lowpass'); },
  /** the spring scene: a bird calling */
  bird(): void { ping(1800, 0.09, 0.035, 'sine', 2400); ping(2000, 0.07, 0.03, 'sine', 2600, 0.1); },
});
