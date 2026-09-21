/**
 * The instrument. This game is its sound, so this is the file that matters most.
 *
 * A chime bar is not a sine wave and it is not a sawtooth either. Hit a real one and you get a
 * short knock from the mallet, a stack of partials that are *not* all whole multiples of the
 * fundamental, and a decay where the high partials die first and the fundamental rings on - which
 * is why a struck bar starts bright and ends warm. All of that is built here by hand: a handful of
 * oscillators per note, each with its own gain and its own decay, a filtered noise burst for the
 * mallet, a second fundamental a few cents off for the shimmer two bars of metal always have, and
 * a synthesised room behind the lot so the notes have somewhere to ring.
 *
 * The room is a ConvolverNode fed an impulse response made out of decaying noise. There is no
 * audio file anywhere in Bramblewood and there is not going to be one.
 *
 * Everything is scheduled against `AudioContext.currentTime` at an absolute moment, never with
 * setTimeout and never off a frame. The frame reads the audio clock, not the other way round.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { freqOfMidi } from './music';

const on = (): boolean => save.sound !== false;

// ---------------------------------------------------------------- voices

export interface Partial {
  /** times the fundamental. Whole numbers are harmonics; the odd ones are what makes it metal */
  ratio: number;
  gain: number;
  /** seconds for this partial to fall away to nothing, on its own */
  decay: number;
}

export interface VoiceDef {
  id: string;
  name: string;
  nameNl: string;
  partials: Partial[];
  /** ADSR, in seconds, with sustain as a fraction of the peak */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** how much of the mallet knock, 0 to 1 */
  mallet: number;
  /** cents the doubled fundamental is detuned by; a pair of them beat against each other */
  detune: number;
  /** how much goes to the room */
  wet: number;
  /** the body filter, as a multiple of the note's own frequency */
  bright: number;
  level: number;
}

/**
 * Four instruments, and the difference between them is real: where the partials sit, how fast
 * each one dies, and how the note starts. Wood has a partial at four times the fundamental and
 * almost nothing above it, which is why a marimba is round and short. Metal has one at five and a
 * half, which is why a chime shimmers. A flute is very nearly a sine with a slow breath in front
 * of it. A plucked string has every harmonic at once and loses them from the top down.
 */
export const VOICES: VoiceDef[] = [
  {
    id: 'chime', name: 'Chimes', nameNl: 'Klokkenspel',
    partials: [
      { ratio: 1, gain: 1, decay: 2.9 },
      { ratio: 2.01, gain: 0.34, decay: 1.7 },
      { ratio: 3.0, gain: 0.12, decay: 0.95 },
      { ratio: 4.16, gain: 0.07, decay: 0.5 },
      { ratio: 5.43, gain: 0.045, decay: 0.26 },
    ],
    attack: 0.004, decay: 0.09, sustain: 0.5, release: 1.25,
    mallet: 0.3, detune: 5, wet: 0.3, bright: 9, level: 0.5,
  },
  {
    id: 'wood', name: 'Wooden bars', nameNl: 'Houten blokjes',
    partials: [
      { ratio: 1, gain: 1, decay: 0.85 },
      { ratio: 3.99, gain: 0.2, decay: 0.3 },
      { ratio: 9.2, gain: 0.05, decay: 0.1 },
    ],
    attack: 0.002, decay: 0.05, sustain: 0.22, release: 0.4,
    mallet: 0.5, detune: 3, wet: 0.16, bright: 7, level: 0.58,
  },
  {
    id: 'flute', name: 'Flute', nameNl: 'Fluit',
    partials: [
      { ratio: 1, gain: 1, decay: 12 },
      { ratio: 2, gain: 0.13, decay: 12 },
      { ratio: 3, gain: 0.05, decay: 12 },
      { ratio: 4, gain: 0.018, decay: 12 },
    ],
    attack: 0.075, decay: 0.12, sustain: 0.85, release: 0.22,
    mallet: 0.1, detune: 7, wet: 0.24, bright: 6, level: 0.4,
  },
  {
    id: 'harp', name: 'Harp', nameNl: 'Harp',
    partials: [
      { ratio: 1, gain: 1, decay: 2.2 },
      { ratio: 2, gain: 0.46, decay: 1.2 },
      { ratio: 3, gain: 0.26, decay: 0.7 },
      { ratio: 4, gain: 0.14, decay: 0.42 },
      { ratio: 5, gain: 0.08, decay: 0.26 },
      { ratio: 6, gain: 0.04, decay: 0.16 },
    ],
    attack: 0.004, decay: 0.07, sustain: 0.3, release: 1.0,
    mallet: 0.22, detune: 4, wet: 0.26, bright: 10, level: 0.44,
  },
];

export const voiceById = (id: string): VoiceDef => VOICES.find(v => v.id === id) ?? VOICES[0];
export const isVoiceId = (id: unknown): boolean => typeof id === 'string' && VOICES.some(v => v.id === id);

// ---------------------------------------------------------------- the graph

interface Rig {
  ctx: AudioContext;
  /** everything goes through here, so a level can be silenced in one move */
  bus: GainNode;
  room: ConvolverNode;
  wet: GainNode;
  noise: AudioBuffer;
}

let rig: Rig | null = null;
/** everything still scheduled, so leaving a level can stop it all */
let live: AudioScheduledSourceNode[] = [];

function impulse(ctx: AudioContext, seconds: number, falloff: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  // a fifteen millisecond gap before the room answers: without it the reverb sits on top of the
  // strike and the note loses its edge
  const pre = Math.floor(ctx.sampleRate * 0.015);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, falloff);
    }
  }
  return buf;
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function ensure(): Rig | null {
  if (rig) return rig;
  const ctx = audioContext();
  if (!ctx) return null;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  // a compressor, because nine chimes at once is nine oscillator stacks at once and a child will
  // absolutely play all nine at once
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 24;
  comp.ratio.value = 3.4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  // the very top of a synthesised partial stack is where the glassiness lives; this takes it off
  const air = ctx.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 7600;
  air.Q.value = 0.6;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 1.9, 3.1);
  const wet = ctx.createGain();
  wet.gain.value = 1;
  room.connect(wet).connect(bus);
  bus.connect(air).connect(comp).connect(ctx.destination);
  rig = { ctx, bus, room, wet, noise: whiteNoise(ctx) };
  return rig;
}

const track = (s: AudioScheduledSourceNode): void => {
  live.push(s);
  if (live.length > 260) live = live.slice(-200);
};

// ---------------------------------------------------------------- the clock

/**
 * The only clock this game has.
 *
 * Every note is scheduled at an absolute moment on it and the drawing is worked out from it, so
 * the ball on the screen and the beat in the ear are the same number and cannot come apart. Until
 * the first touch has unlocked audio there is no such clock, and the wall clock stands in - which
 * only ever happens on the opening screen, where nothing is being timed.
 */
export function audioNow(): number {
  const ctx = audioContext();
  return ctx ? ctx.currentTime : performance.now() / 1000;
}

export const audioReady = (): boolean => !!audioContext();

/**
 * How long after `currentTime` a sound scheduled now actually reaches the ear.
 *
 * It matters: a tap is judged against when the child *heard* the beat, not when the browser
 * queued it. Chrome reports a real figure; anything that does not gets its buffer size, which is
 * the honest floor.
 */
export function outputLatency(): number {
  const ctx = audioContext() as (AudioContext & { outputLatency?: number }) | null;
  if (!ctx) return 0;
  const o = typeof ctx.outputLatency === 'number' && isFinite(ctx.outputLatency) ? ctx.outputLatency : 0;
  return o > 0 ? Math.min(0.2, o) : (ctx.baseLatency || 0);
}

// ---------------------------------------------------------------- one note

/**
 * One struck note, at an absolute moment on the audio clock.
 *
 * `when` is in the future by however far the scheduler looks ahead. Nothing here reads the
 * current time except to refuse to schedule into the past.
 */
export function play(midi: number, when: number, seconds = 1.2, voiceId = 'chime', level = 1): void {
  const r = ensure();
  if (!r || !on()) return;
  const v = voiceById(voiceId);
  const t = Math.max(r.ctx.currentTime, when);
  const f = freqOfMidi(midi);
  const peak = Math.max(0.0001, v.level * level);

  // the shared envelope: attack, decay to sustain, then release from wherever the note ends
  const env = r.ctx.createGain();
  const relAt = t + Math.max(v.attack + v.decay, seconds);
  const sus = Math.max(0.0008, peak * v.sustain);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(peak, t + v.attack);
  env.gain.exponentialRampToValueAtTime(sus, t + v.attack + v.decay);
  env.gain.setValueAtTime(sus, relAt);
  env.gain.exponentialRampToValueAtTime(0.0001, relAt + v.release);

  // the body: one gentle lowpass tuned to the note itself, so a low chime is not simply a high
  // one played slowly
  const body = r.ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = Math.min(16000, f * v.bright);
  body.Q.value = 0.7;
  env.connect(body);

  const dry = r.ctx.createGain();
  dry.gain.value = 1 - v.wet * 0.5;
  body.connect(dry).connect(r.bus);
  const send = r.ctx.createGain();
  send.gain.value = v.wet;
  body.connect(send).connect(r.room);

  const end = relAt + v.release + 0.05;
  for (const p of v.partials) {
    const pf = f * p.ratio;
    if (pf > 18000) continue;
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(p.gain, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00005, p.gain * 0.0005), t + p.decay);
    g.connect(env);
    const o = r.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pf, t);
    o.connect(g);
    o.start(t);
    o.stop(end);
    track(o);
    // the fundamental is doubled a few cents away. Two bars of metal are never in perfect tune
    // with each other, and that slow beating is most of what "warm" means
    if (p.ratio === 1 && v.detune > 0) {
      const o2 = r.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(pf, t);
      o2.detune.setValueAtTime(v.detune, t);
      const g2 = r.ctx.createGain();
      g2.gain.setValueAtTime(p.gain * 0.42, t);
      g2.gain.exponentialRampToValueAtTime(0.00005, t + p.decay * 0.9);
      o2.connect(g2).connect(env);
      o2.start(t);
      o2.stop(end);
      track(o2);
    }
  }

  // the mallet: a few milliseconds of noise through a band around the fourth partial. It carries
  // no pitch at all, and taking it out makes every voice sound like a synthesiser
  if (v.mallet > 0) {
    const s = r.ctx.createBufferSource();
    s.buffer = r.noise;
    const bp = r.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(14000, f * 4.2);
    bp.Q.value = 1.1;
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak * v.mallet, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(bp).connect(g).connect(dry);
    s.start(t);
    s.stop(t + 0.1);
    track(s);
  }
}

/** A chord, for the sequencer, where a child can light a whole column at once. */
export function playChord(midis: number[], when: number, seconds: number, voiceId: string, level = 1): void {
  // a stack of notes at the same level is louder than one note, so the level comes down with the
  // count - the same thing a mixing desk does
  const l = level / Math.max(1, Math.sqrt(midis.length));
  for (const m of midis) play(m, when, seconds, voiceId, l);
}

// ---------------------------------------------------------------- the count, the drum, the rest

/** The count-in, and the quiet pulse under the tapping levels. A woodblock, not a beep. */
export function click(when: number, strong = false): void {
  const r = ensure();
  if (!r || !on()) return;
  const t = Math.max(r.ctx.currentTime, when);
  const o = r.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(strong ? 1180 : 860, t);
  o.frequency.exponentialRampToValueAtTime(strong ? 760 : 620, t + 0.03);
  const g = r.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(strong ? 0.2 : 0.11, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (strong ? 0.09 : 0.06));
  o.connect(g).connect(r.bus);
  o.start(t); o.stop(t + 0.14);
  track(o);
  const s = r.ctx.createBufferSource();
  s.buffer = r.noise;
  const bp = r.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = strong ? 2600 : 3400; bp.Q.value = 1.4;
  const ng = r.ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.linearRampToValueAtTime(strong ? 0.1 : 0.06, t + 0.001);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  s.connect(bp).connect(ng).connect(r.bus);
  s.start(t); s.stop(t + 0.06);
  track(s);
}

export type DrumKind = 'kick' | 'snare' | 'hat';

/** The drum for Samen: a kick with a falling pitch, a snare of noise, a short hat. */
export function drum(kind: DrumKind, when: number, level = 1): void {
  const r = ensure();
  if (!r || !on()) return;
  const t = Math.max(r.ctx.currentTime, when);
  if (kind === 'kick') {
    const o = r.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.65 * level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(r.bus);
    o.start(t); o.stop(t + 0.4);
    track(o);
    return;
  }
  const s = r.ctx.createBufferSource();
  s.buffer = r.noise;
  const f = r.ctx.createBiquadFilter();
  const hat = kind === 'hat';
  f.type = hat ? 'highpass' : 'bandpass';
  f.frequency.value = hat ? 7200 : 1900;
  f.Q.value = hat ? 0.7 : 0.9;
  const g = r.ctx.createGain();
  const dur = hat ? 0.05 : 0.17;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime((hat ? 0.16 : 0.32) * level, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(r.bus);
  s.start(t); s.stop(t + dur + 0.05);
  track(s);
  if (!hat) {
    const o = r.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    const og = r.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.16 * level, t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(r.bus);
    o.start(t); o.stop(t + 0.18);
    track(o);
  }
}

/** Everything scheduled, stopped, for leaving a level in the middle of a bar. */
export function stopAll(): void {
  const r = ensure();
  if (r) {
    const t = r.ctx.currentTime;
    // down and back up again, so the cut is not a click
    r.bus.gain.cancelScheduledValues(t);
    r.bus.gain.setValueAtTime(r.bus.gain.value, t);
    r.bus.gain.linearRampToValueAtTime(0.0001, t + 0.02);
    r.bus.gain.setValueAtTime(0.0001, t + 0.05);
    r.bus.gain.linearRampToValueAtTime(1, t + 0.09);
  }
  for (const s of live) { try { s.stop(); } catch { /* already done */ } }
  live = [];
}

// ---------------------------------------------------------------- the interface

/** A small dry knock for a button, which must never be mistaken for a note of the tune. */
export function uiTap(): void {
  const r = ensure();
  if (!r || !on()) return;
  const t = r.ctx.currentTime;
  const s = r.ctx.createBufferSource();
  s.buffer = r.noise;
  const f = r.ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 2.2;
  const g = r.ctx.createGain();
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  s.connect(f).connect(g).connect(r.bus);
  s.start(t); s.stop(t + 0.08);
  track(s);
}

/** A rising third, for a bar played right. */
export function cheer(step = 0): void {
  const t = audioNow() + 0.01;
  [64, 67, 72].forEach((m, i) => play(m, t + i * 0.08 + step * 0.0, 0.5, 'chime', 0.5));
}

/** Not a buzzer. Two low notes, a step apart, which is a shrug rather than a punishment. */
export function nudge(): void {
  const t = audioNow() + 0.01;
  play(57, t, 0.4, 'wood', 0.5);
  play(55, t + 0.13, 0.6, 'wood', 0.5);
}

/** The level is done: the chimes running up the scale. */
export function fanfare(): void {
  const t = audioNow() + 0.02;
  [60, 64, 67, 72].forEach((m, i) => play(m, t + i * 0.11, 1.1, 'chime', 0.55));
}
