/**
 * The sound of the drum circle.
 *
 * A low "boem" and a high "tik" are the whole instrument, so they are the two sounds that matter;
 * everything else is a soft tap or a short success. All synthesised on the shared WebAudio context,
 * and replaced by a recording when `src/platform/sfxspec.ts` has the rows and the files exist.
 *
 * Rows to paste into `src/platform/sfxspec.ts` (after the last game's block):
 *
 *   // ---- Trommelkring
 *   'trommel.boem': { prompt: `a single deep warm hand-drum bass hit, round and soft, like the low tone of a djembe, ${SOFT}`, secs: 1, max: 0.8, gap: 60 },
 *   'trommel.tik': { prompt: `a single high light hand-drum slap near the rim, short and clean, like the high tone of a djembe, ${SOFT}`, secs: 0.5, max: 0.3, gap: 60 },
 *   'trommel.tap': tap('a soft knock on the wooden frame of a drum'),
 *   'trommel.right': right('two warm soft marimba notes going up, a small contented answer'),
 *   'trommel.complete': done('a gentle quiet drum roll that settles into three warm soft marimba notes going up, a calm ending by a campfire'),
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate;
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
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function puff(type: BiquadFilterType, freq: number, q: number, dur: number, gain: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const trommelSfx = withSamples('trommel', {
  /** the low half: a round thump that drops in pitch, with a little skin on the front of it */
  boem(): void {
    ping(150, 0.42, 0.34, 'sine', 62);
    ping(95, 0.3, 0.12, 'triangle', 55);
    puff('lowpass', 420, 0.7, 0.06, 0.12);
  },
  /** the high half: a short slap near the rim */
  tik(): void {
    ping(720, 0.14, 0.14, 'triangle', 520);
    puff('bandpass', 2600, 1.4, 0.07, 0.1);
  },
  tap(): void { ping(520, 0.07, 0.05, 'sine'); },
  /** a pattern played back well */
  right(): void { [523, 659].forEach((f, i) => ping(f, 0.3, 0.06, 'triangle', undefined, i * 0.1)); },
  complete(): void { [523, 659, 784].forEach((f, i) => ping(f, 0.5, 0.055, 'triangle', undefined, 0.2 + i * 0.14)); },
});
