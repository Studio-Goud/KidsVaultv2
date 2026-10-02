/**
 * The sound of a quiet street: a tap on a door, a letter through the slot, a door and a bell.
 *
 * A wrong door is two soft knocks, never a buzz (CLAUDE.md, the house rules for a mistake). Every
 * sound is synthesised here and stays underneath as the fallback for the recordings.
 *
 * Rows for src/platform/sfxspec.ts (paste under a "---- Postbode Suri" comment):
 *
 *   'postbode.tap': tap('a fingertip tapping lightly on a wooden front door'),
 *   'postbode.knock': { prompt: `two soft wooden knocks on a door, a gentle shrug, friendly, ${SOFT}`, secs: 0.6, max: 0.5, gain: 0.8 },
 *   'postbode.slot': { prompt: `a letter dropping through a brass letterbox flap with a small clack, ${SOFT}`, secs: 0.8, max: 0.7 },
 *   'postbode.door': { prompt: `a wooden front door opening with a soft creak and a tiny cheerful jingle, ${SOFT}`, secs: 1.5, max: 1.2 },
 *   'postbode.bell': { prompt: `a soft two-tone doorbell, ding dong, ${SOFT}`, secs: 1.5, max: 1.2 },
 *   'postbode.right': right('a bright soft wooden marimba double note going up, a small happy success'),
 *   'postbode.complete': done('a warm gentle marimba and glockenspiel flourish, a small celebration'),
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

export const postSfx = withSamples('postbode', {
  tap(): void { ping(740, 0.06, 0.05); },
  /** two soft low knocks: not this door */
  knock(): void { ping(240, 0.09, 0.07, 'triangle', 190); ping(240, 0.09, 0.06, 'triangle', 190, 0.16); },
  /** the flap of a letterbox */
  slot(): void { ping(1250, 0.05, 0.05, 'square', 900); ping(820, 0.08, 0.04, 'triangle', 600, 0.07); },
  door(): void { ping(150, 0.4, 0.04, 'sawtooth', 210); [784, 988].forEach((f, i) => ping(f, 0.3, 0.04, 'sine', undefined, 0.3 + i * 0.1)); },
  bell(): void { ping(880, 0.5, 0.06, 'sine'); ping(659, 0.7, 0.06, 'sine', undefined, 0.3); },
  right(): void { ping(660, 0.16, 0.06, 'triangle'); ping(880, 0.24, 0.06, 'triangle', undefined, 0.1); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.42, 0.055, 'triangle', undefined, i * 0.12)); },
});
