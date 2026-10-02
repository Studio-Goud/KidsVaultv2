/**
 * The sound of Rijmbos: a wooden forest, soft all through.
 *
 * A right card is a small climbing marimba note and a rustle of leaves, a wrong one is two soft
 * low knocks and nothing else (never a buzzer: the card stays and the word is said again), and a
 * finished round is a short warm chime run. Synthesised first; the recordings from ElevenLabs
 * replace these when `npm run sfx` has been run, and these stay underneath as the fallback.
 *
 * Rows to paste into `src/platform/sfxspec.ts` (every method below has one):
 *
 *   // ---- Rijmbos
 *   'rijmbos.tap': tap('a soft wooden tap on a picture card laid on moss'),
 *   'rijmbos.right': right('a bright soft wooden marimba double note going up, with a light rustle of leaves'),
 *   'rijmbos.wrong': wrong('two soft low wooden knocks, a gentle shrug, not a buzzer, friendly'),
 *   'rijmbos.cheer': { prompt: `a small happy woodland flourish, a few soft birdsong notes and a light leaf rustle, ${SOFT}`, secs: 1.5, max: 1.3 },
 *   'rijmbos.complete': done('a warm little celebration: soft wooden chimes rising, finishing a round in a forest'),
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
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const rijmSfx = withSamples('rijmbos', {
  tap(): void { ping(620, 0.07, 0.05, 'triangle'); },
  /** a double note that climbs a little with each card found in a question */
  right(n = 0): void {
    const base = 523 * Math.pow(1.06, Math.min(8, n));
    ping(base, 0.18, 0.06, 'triangle'); ping(base * 1.5, 0.26, 0.055, 'triangle', undefined, 0.09);
  },
  /** two soft low knocks: a shrug */
  wrong(): void { ping(220, 0.1, 0.06, 'sine', 180); ping(210, 0.12, 0.06, 'sine', 170, 0.16); },
  cheer(): void { [784, 988, 1175].forEach((f, i) => ping(f, 0.14, 0.035, 'sine', f * 1.08, i * 0.07)); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.42, 0.055, 'triangle', undefined, i * 0.12)); },
});
