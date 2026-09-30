/**
 * The sounds of Suri en het donker.
 *
 * As with the other stories: every sound has a row in `src/platform/sfxspec.ts` so it can be
 * recorded once, and the small synthesised version here is what plays until the recording has loaded
 * or if there is none. The backgrounds are recordings only, and a missing one is simply quiet. They
 * are soft on purpose: this is a story about being scared, so nothing in it may startle. The creak
 * is a slow wooden creak, not a bang; the wind is a hush, not a howl.
 *
 * Rows to paste into `SFX` in `src/platform/sfxspec.ts` (not added there; the owner wires it in):
 *
 *   // ---- Suri en het donker: the story about being scared at bedtime
 *   'donker.sit': { prompt: `a soft warm low two-note hum, like a gentle hug, someone sitting down next to you, ${SOFT}`, secs: 1.2, max: 1 },
 *   'donker.found': { prompt: `two soft rising notes that say aha, found it, calm and friendly, ${SOFT}`, secs: 0.8, max: 0.7 },
 *   'donker.lamp': { prompt: `a small soft click of a bedside lamp switch, then a faint warm glow hum, ${SOFT}`, secs: 0.8, max: 0.6 },
 *   'donker.creak': { prompt: `one slow soft creak of an old wooden window frame moving in the wind, gentle, not scary, ${SOFT}`, secs: 1.5, max: 1.3 },
 *   'donker.close': { prompt: `a wooden window sliding shut with a soft thud and a small latch click, then quiet, ${SOFT}`, secs: 1, max: 0.9 },
 *   'donker.breathIn': { prompt: `one slow calm breath in through the nose, soft and airy, a child's bedroom, ${SOFT}`, secs: 3.5, max: 3.5 },
 *   'donker.breathOut': { prompt: `one slow calm breath out, soft and airy, relaxing, ${SOFT}`, secs: 4.5, max: 4.5 },
 *   'donker.glow': { prompt: `a small night light switching on with a soft click and a warm gentle chime, cosy, ${SOFT}`, secs: 1.2, max: 1 },
 *   'donker.goodnight': done('a soft lullaby-like set of chimes settling down, a music box winding to a gentle stop, goodnight'),
 *   'donker.roomBed': { prompt: `a quiet child's bedroom at night, a very soft distant clock ticking slowly and a faint hush of air, calm, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *   'donker.windBed': { prompt: `a soft gentle wind outside a window at night with a faint slow creak now and then, calm not scary, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *   'donker.cosyBed': { prompt: `a cosy quiet bedroom with a night light on, very soft warm room tone and a faint slow music box, sleepy, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.25 },
 *
 * (`done` and `SOFT` are the helpers already defined at the top of sfxspec.ts.)
 */

import { audioContext } from '../util/audio';
import { save } from '../util/storage';
import { loopSample, withSamples } from '../platform/samples';

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
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** Filtered noise whose level swells and fades, which is all a breath or a puff of wind is. */
function breath(freq: number, gain: number, dur: number, swellAt: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * swellAt);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const donkerSfx = withSamples('donker', {
  /** sitting down next to Suri: two warm low notes, a hug */
  sit(): void { [262, 330].forEach((f, i) => ping(f, 0.7, 0.04, 'sine', undefined, i * 0.16)); },
  /** found what made the shape or the sound */
  found(): void { [392, 523].forEach((f, i) => ping(f, 0.3, 0.035, 'triangle', undefined, i * 0.14)); },
  /** the bedside lamp: a small click, then a warm note */
  lamp(): void { ping(1800, 0.03, 0.05, 'square', 900); ping(330, 0.6, 0.03, 'sine', undefined, 0.05); },
  /** a slow wooden creak: a low note that slides up and back, never a bang */
  creak(): void { ping(150, 0.7, 0.03, 'sawtooth', 210); ping(210, 0.5, 0.02, 'sawtooth', 130, 0.65); },
  /** the window sliding shut, a soft thud, a latch */
  close(): void { breath(500, 0.05, 0.4, 0.3); ping(110, 0.2, 0.06, 'sine', 70, 0.4); ping(1400, 0.04, 0.03, 'square', 1000, 0.55); },
  /** one slow breath in: airy noise that swells towards the end */
  breathIn(): void { breath(900, 0.05, 3.5, 0.9); },
  /** one slow breath out: it starts at once and fades away */
  breathOut(): void { breath(700, 0.05, 4.5, 0.12); },
  /** the night light comes on */
  glow(): void { ping(1800, 0.03, 0.04, 'square', 1000); [523, 659, 784].forEach((f, i) => ping(f, 0.6, 0.03, 'sine', undefined, 0.1 + i * 0.12)); },
  /** goodnight: a music box running down */
  goodnight(): void { [784, 659, 587, 523, 440, 392].forEach((f, i) => ping(f, 0.9 + i * 0.1, 0.035, 'triangle', undefined, i * 0.3 + i * i * 0.03)); },
});

/** A background that belongs to a place. */
export type Bed = 'room' | 'wind' | 'cosy';
const BEDS: Bed[] = ['room', 'wind', 'cosy'];

export function bed(which: Bed | null): void {
  for (const b of BEDS) loopSample(`donker.${b}Bed`, b === which);
}
