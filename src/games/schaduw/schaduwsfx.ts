/**
 * The sound of a dim room with a lamp in it.
 *
 * Soft wooden things only: a faint tick as the turntable passes a notch, a clicking-into-place
 * when a shadow fits, one questioning note for the hint. Nothing ever sounds wrong, because nothing
 * here can be wrong. Synthesised first, with the ElevenLabs recordings on top (src/platform/samples.ts).
 *
 * Rows for src/platform/sfxspec.ts (paste under a "---- Schaduwspel" heading):
 *
 *   'schaduw.grab': tap('a finger resting on a small wooden turntable, a faint wooden creak'),
 *   'schaduw.turn': { prompt: `a very small soft wooden ratchet tick of a toy turntable passing a notch, very short, ${SOFT}`, secs: 0.5, max: 0.12, gap: 110, gain: 0.5 },
 *   'schaduw.click': { prompt: `a soft wooden click like a puzzle piece fitting into place, followed by one warm little chime, ${SOFT}`, secs: 1, max: 0.9 },
 *   'schaduw.hint': { prompt: `one soft questioning marimba note going gently up, ${SOFT}`, secs: 0.8, max: 0.6, gain: 0.8 },
 *   'schaduw.complete': done('a warm soft celebration of marimba and a small wooden music box, a lamp being switched on gently'),
 *   'schaduw.tap': tap('a small soft wooden tap, like a fingertip on a wooden toy'),
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
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const schaduwSfx = withSamples('schaduw', {
  grab(): void { ping(330, 0.1, 0.04, 'triangle', 260); },
  /** one notch of the turntable */
  turn(): void { ping(900, 0.03, 0.025, 'square', 600); },
  /** it fits: a wooden click, then a small warm chime */
  click(): void {
    ping(520, 0.05, 0.07, 'triangle', 300);
    ping(784, 0.45, 0.05, 'sine', undefined, 0.07);
    ping(1175, 0.5, 0.03, 'sine', undefined, 0.07);
  },
  hint(): void { ping(523, 0.3, 0.045, 'sine', 659); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.5, 0.05, 'triangle', undefined, i * 0.13)); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
});
