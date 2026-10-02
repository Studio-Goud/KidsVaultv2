/**
 * The sound of Liedjesmaker.
 *
 * Five animals each sing one note of a pentatonic scale, and the notes are the whole game, so they
 * are synthesised and nothing else: a recording from a generator cannot be held to the right pitch,
 * and a tune with a flat cat is not a tune. Like Klankhuis' chimes they have no row in sfxspec and
 * are left out of the recordings on purpose. Each animal has its own timbre so a child can tell
 * them apart with closed eyes: the frog is a low square wave with a croak (a fast wobble in the
 * loudness) and a quick slide down onto the note; the dog is a sawtooth through a vowel filter with
 * a short "wo"; the cat is a triangle that slides up into the note; the bird is a plain sine with
 * a vibrato and a bright overtone; the mouse is a small high triangle with a squeak on top.
 *
 * The small sounds around them (a drop onto a slot, taking one off, the end) are ordinary effects
 * and can be recorded. Rows for src/platform/sfxspec.ts, under "// ---- Liedjesmaker":
 *
 *   'liedje.tap': tap(),
 *   'liedje.drop': tap('a small soft wooden block set down on a wooden shelf'),
 *   'liedje.lift': { prompt: `a small wooden toy being lifted and popped off a shelf, ${SOFT}`, secs: 0.5, max: 0.3 },
 *   'liedje.done': done('a gentle little music box phrase ending on a warm closing note, a cosy goodnight'),
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';
import { noteFor, type AnimalId } from './model';

const on = (): boolean => save.sound !== false;

interface Voice {
  type: OscillatorType;
  /** where the pitch starts, as a multiple of the note, before it slides onto it */
  from: number;
  /** how long the slide takes, seconds */
  slide: number;
  dur: number;
  gain: number;
  /** vibrato: rate in Hz and depth as a fraction of the pitch */
  vib?: [number, number];
  /** croak: a fast wobble on the loudness, rate in Hz and depth 0..1 */
  trem?: [number, number];
  /** a lowpass or formant centre, Hz */
  lp?: number;
  /** a quiet overtone as a multiple of the note, and its gain relative */
  over?: [number, number];
}

const VOICES: Record<AnimalId, Voice> = {
  frog: { type: 'square', from: 1.35, slide: 0.07, dur: 0.5, gain: 0.07, trem: [26, 0.55], lp: 900 },
  dog: { type: 'sawtooth', from: 1.22, slide: 0.06, dur: 0.46, gain: 0.07, lp: 1300 },
  cat: { type: 'triangle', from: 0.84, slide: 0.16, dur: 0.55, gain: 0.12, vib: [5, 0.012] },
  bird: { type: 'sine', from: 1, slide: 0, dur: 0.6, gain: 0.14, vib: [6.5, 0.022], over: [2, 0.25] },
  mouse: { type: 'triangle', from: 1.06, slide: 0.05, dur: 0.38, gain: 0.12, vib: [9, 0.01], over: [2, 0.18] },
};

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

/** One animal's note. Exported through the object below as `sing`. */
function sing(animal: AnimalId): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const v = VOICES[animal], f = noteFor(animal).freq, t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = v.type;
  o.frequency.setValueAtTime(f * v.from, t);
  if (v.slide > 0) o.frequency.exponentialRampToValueAtTime(f, t + v.slide);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(v.gain, t + 0.015);
  amp.gain.setValueAtTime(v.gain, t + v.dur * 0.35);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
  let tail: AudioNode = o;
  if (v.lp) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = v.lp; lp.Q.value = 2.5;
    o.connect(lp); tail = lp;
  }
  tail.connect(amp);
  const stops: OscillatorNode[] = [o];
  if (v.vib) {
    const l = ctx.createOscillator(); l.frequency.value = v.vib[0];
    const d = ctx.createGain(); d.gain.value = f * v.vib[1];
    l.connect(d); d.connect(o.frequency); stops.push(l);
  }
  if (v.trem) {
    // the croak: the loudness wobbles fast, between full and (1 - depth)
    const l = ctx.createOscillator(); l.frequency.value = v.trem[0];
    const d = ctx.createGain(); d.gain.value = v.gain * v.trem[1] * 0.5;
    l.connect(d); d.connect(amp.gain); stops.push(l);
  }
  amp.connect(ctx.destination);
  if (v.over) {
    const h = ctx.createOscillator(); h.type = 'sine'; h.frequency.value = f * v.over[0];
    const hg = ctx.createGain(); hg.gain.setValueAtTime(v.gain * v.over[1], t);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + v.dur * 0.8);
    h.connect(hg); hg.connect(ctx.destination); stops.push(h);
  }
  for (const s of stops) { s.start(t); s.stop(t + v.dur + 0.05); }
}

export const liedjeSfx = withSamples('liedje', {
  /** left out of the recordings on purpose: it has to be exactly in tune */
  sing(animal: AnimalId): void { sing(animal); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
  drop(): void { ping(300, 0.09, 0.07, 'triangle', 220); },
  lift(): void { ping(420, 0.08, 0.05, 'triangle', 640); },
  done(): void { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => ping(f, 0.5, 0.055, 'triangle', undefined, i * 0.14)); },
});
