/**
 * The sound of a dig.
 *
 * Built on the same WebAudio context Cloudhopper uses, so one tap anywhere in Bramblewood unlocks
 * sound everywhere. Every sound is synthesised: a brush is filtered noise, a chisel is a short
 * click with a pitched ring, a hammer is a thud, and breaking a bone is the one sound in the game
 * that is meant to make you wince.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 0.5;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;   // pink-ish, easier on the ear
    d[i] = last * 3.5;
  }
  noiseBuf = b;
  return b;
}

function burst(freq: number, q: number, dur: number, gain: number, sweepTo?: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  if (sweepTo) f.frequency.linearRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

function ping(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
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

/** Throttle, because a stroke fires many times a second. */
let lastStroke = 0;
function throttled(ms: number): boolean {
  const now = performance.now();
  if (now - lastStroke < ms) return false;
  lastStroke = now;
  return true;
}

export const dig = {
  brush(): void { if (throttled(90)) burst(2600, 0.7, 0.14, 0.05, 1700); },
  chisel(): void { if (throttled(120)) { burst(1500, 3, 0.05, 0.07); ping(880, 0.07, 0.03, 'triangle', 620); } },
  hammer(): void { if (throttled(150)) { burst(340, 1.2, 0.12, 0.10, 180); ping(120, 0.1, 0.05, 'sine', 70); } },
  scribe(): void { if (throttled(70)) burst(4200, 6, 0.09, 0.035); },
  /** the wince */
  crack(): void { burst(900, 1.4, 0.3, 0.16, 260); ping(420, 0.22, 0.06, 'sawtooth', 130); },
  /** a piece of bone comes clear */
  uncover(): void { ping(1320, 0.14, 0.05, 'sine'); ping(1760, 0.18, 0.035, 'sine'); },
  correct(): void { [880, 1174, 1568].forEach((f, i) => setTimeout(() => ping(f, 0.22, 0.05, 'triangle'), i * 90)); },
  wrong(): void { ping(220, 0.22, 0.06, 'sawtooth', 160); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ping(f, 0.4, 0.05, 'triangle'), i * 120)); },
  tired(): void { ping(200, 0.5, 0.05, 'sine', 120); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
};
