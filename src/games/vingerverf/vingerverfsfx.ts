/**
 * The sound of Vingerverf: a finger in paint, a brush on paper, a sheet slid away, a small flourish.
 *
 * All synthesised first; recordings from `npm run sfx` replace them when the rows below are in
 * `src/platform/sfxspec.ts`. Nothing here is a mistake sound: running out of paint is a dry brush
 * on paper, not a buzz. The colour names are the guide's voice, not an effect.
 *
 * Rows to paste into SFX in src/platform/sfxspec.ts (SOFT is the constant at the top of that file):
 *
 *   // ---- Vingerverf
 *   'vingerverf.tap': tap('a small soft wooden tap, like a fingertip on a wooden toy'),
 *   'vingerverf.pot': { prompt: `a fingertip dipping into thick soft paint with a tiny wet squelch, ${SOFT}`, secs: 0.5, max: 0.3, gain: 0.8 },
 *   'vingerverf.swish': { prompt: `a soft wet paintbrush swish across paper, very short, ${SOFT}`, secs: 0.6, max: 0.35, gap: 380, gain: 0.5 },
 *   'vingerverf.empty': { prompt: `a dry paintbrush scratching softly on paper, once, ${SOFT}`, secs: 0.6, max: 0.4, gain: 0.6 },
 *   'vingerverf.wipe': { prompt: `a big sheet of paper being slid away across a wooden table, ${SOFT}`, secs: 1, max: 0.7 },
 *   'vingerverf.done': done('a soft warm marimba and glockenspiel flourish, a gentle small celebration'),
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

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

function burst(freq: number, q: number, dur: number, gain: number, to?: number, type: BiquadFilterType = 'bandpass'): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx); src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.linearRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const vingerverfSfx = withSamples('vingerverf', {
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
  /** a finger pressed into paint: a low wet squelch */
  pot(): void { burst(420, 1.2, 0.14, 0.07, 220); ping(190, 0.1, 0.05, 'sine', 120); },
  /** a brush moving across paper */
  swish(): void { burst(2400, 0.7, 0.22, 0.035, 1500, 'highpass'); },
  /** the brush has nothing left: a dry scratch, not a buzz */
  empty(): void { burst(3200, 0.6, 0.18, 0.03, 2200, 'highpass'); },
  /** a sheet slid away */
  wipe(): void { burst(900, 0.5, 0.5, 0.05, 2200, 'bandpass'); },
  done(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.5, 0.05, 'triangle', undefined, i * 0.13)); },
});
