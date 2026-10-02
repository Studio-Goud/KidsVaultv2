/**
 * The sound of Kiekeboe: a soft rustle when a place opens, a soft thump when it closes, the eight
 * animals' own calls, and a small run of chimes when the round is done.
 *
 * The calls are the part a two-year-old is here for, so each is kept short, round and friendly:
 * a vowel-like tone through a band-pass filter (the throat), a little wobble on the pitch (the
 * life), and a quiet ending. Nothing is loud and nothing is sharp; an animal that startles is the
 * opposite of this game. They are only the fallback: when `npm run sfx` has rendered the rows
 * below, the recordings play instead (`withSamples`). The recorded animal calls in the Dierenboek
 * (`animal.<id>` in `samples.ts`, played with `playOnce`) are not used: they are keyed by that
 * book's own ids, are four seconds long, and would need a network fetch at the moment of the tap.
 *
 * Rows to paste into `src/platform/sfxspec.ts` (the animal rows leave the house suffix's "no voice"
 * out, because a call is a voice, and say so instead):
 *
 *   // ---- Kiekeboe
 *   'kiekeboe.tap': tap('a soft wooden tap on a toy picture book'),
 *   'kiekeboe.open': { prompt: `a soft rustle of leaves and a small gentle creak, a hiding place being opened, ${SOFT}`, secs: 0.8, max: 0.6 },
 *   'kiekeboe.close': { prompt: `a soft padded thump, something being closed gently, ${SOFT}`, secs: 0.5, max: 0.3, gain: 0.8 },
 *   'kiekeboe.complete': done('a warm little celebration: soft wooden chimes rising, a game of hide and seek finished'),
 *   'kiekeboe.cow': { prompt: `a friendly cow mooing once, gentle and not too loud, ${SOFT_CALL}`, secs: 2, max: 1.6 },
 *   'kiekeboe.cat': { prompt: `a friendly cat meowing once, small and gentle, ${SOFT_CALL}`, secs: 1.2, max: 1 },
 *   'kiekeboe.dog': { prompt: `a friendly small dog barking twice, soft and playful, ${SOFT_CALL}`, secs: 1.2, max: 1 },
 *   'kiekeboe.duck': { prompt: `a duck quacking twice, soft and funny, ${SOFT_CALL}`, secs: 1.2, max: 1 },
 *   'kiekeboe.sheep': { prompt: `a sheep bleating once, soft and wobbly, ${SOFT_CALL}`, secs: 1.5, max: 1.3 },
 *   'kiekeboe.frog': { prompt: `a small frog croaking three times, soft and round, ${SOFT_CALL}`, secs: 1.2, max: 1 },
 *   'kiekeboe.owl': { prompt: `an owl hooting softly twice, calm and warm, ${SOFT_CALL}`, secs: 1.8, max: 1.5 },
 *   'kiekeboe.pig': { prompt: `a friendly pig oinking twice, soft and snuffly, ${SOFT_CALL}`, secs: 1.2, max: 1 },
 *
 * with, next to `SOFT` at the top of that file:
 *   const SOFT_CALL = 'soft, warm, gentle, for a calm children\'s game, clean studio recording, no music, no other sounds';
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';
import type { AnimalId } from './model';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
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

function burst(freq: number, q: number, dur: number, gain: number, to?: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx); src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  if (to) f.frequency.linearRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

/**
 * One syllable of a call: a tone that glides from `from` to `to`, wobbles at `vib` Hz, and is shaped
 * by a band-pass throat at `formant`. The envelope rises quickly and falls away, never clicks.
 */
function voice(from: number, to: number, dur: number, gain: number, formant: number, when = 0, type: OscillatorType = 'sawtooth', vib = 0, depth = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  if (vib > 0) {
    const l = ctx.createOscillator(); l.frequency.value = vib;
    const d = ctx.createGain(); d.gain.value = depth;
    l.connect(d); d.connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.05);
  }
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.05, dur * 0.3));
  g.gain.setValueAtTime(gain, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const kiekeboeSfx = withSamples('kiekeboe', {
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
  open(): void { burst(2400, 1.2, 0.18, 0.05, 1200); ping(300, 0.16, 0.03, 'triangle', 380, 0.04); },
  close(): void { ping(170, 0.14, 0.06, 'sine', 120); burst(500, 0.8, 0.08, 0.03); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.42, 0.055, 'triangle', undefined, i * 0.12)); },
  cow(): void { voice(150, 118, 1.0, 0.16, 650, 0, 'sawtooth', 5, 5); voice(300, 236, 0.9, 0.04, 1000, 0, 'triangle', 5, 8); },
  cat(): void { voice(520, 800, 0.22, 0.09, 1500, 0, 'triangle'); voice(800, 430, 0.4, 0.09, 1200, 0.2, 'triangle', 6, 12); },
  dog(): void { for (const w of [0, 0.3]) { voice(330, 190, 0.13, 0.12, 900, w); burst(1400, 1, 0.06, 0.04, undefined, w); } },
  duck(): void { for (const w of [0, 0.25]) voice(560, 330, 0.14, 0.09, 1400, w, 'square'); },
  sheep(): void { voice(400, 330, 0.8, 0.1, 1000, 0, 'sawtooth', 28, 30); },
  frog(): void { for (const w of [0, 0.17, 0.34]) voice(210, 150, 0.11, 0.14, 500, w, 'square', 40, 20); },
  owl(): void { voice(430, 390, 0.3, 0.12, 700, 0, 'sine'); voice(430, 340, 0.55, 0.12, 700, 0.5, 'sine', 4, 6); },
  pig(): void { for (const w of [0, 0.28]) { voice(230, 130, 0.17, 0.12, 750, w, 'sawtooth', 24, 14); burst(800, 1, 0.1, 0.05, 400, w); } },
});

/** The call of one animal, by id. */
export function callOf(id: AnimalId): void { kiekeboeSfx[id](); }
