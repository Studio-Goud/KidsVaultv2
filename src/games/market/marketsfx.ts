/**
 * The sound of a village market.
 *
 * Fruit dropping into a basket, a bell, coins, a happy customer, a puzzled one, and the low murmur
 * of a square with people in it. Synthesised on the shared WebAudio context.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.2;
  }
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

function burst(freq: number, q: number, dur: number, gain: number, to?: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime;
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

/** The square, murmuring. */
export class Square {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  start(): void {
    const ctx = audioContext();
    if (!ctx || !on() || this.src) return;
    this.src = ctx.createBufferSource();
    this.src.buffer = noise(ctx); this.src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.4;
    this.gain = ctx.createGain(); this.gain.gain.value = 0.028;
    this.src.connect(f); f.connect(this.gain); this.gain.connect(ctx.destination);
    this.src.start();
  }
  stop(): void {
    const ctx = audioContext();
    if (!ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    const s = this.src;
    setTimeout(() => { try { s?.stop(); } catch { /* fine */ } }, 700);
    this.src = null; this.gain = null;
  }
}

export const market = {
  /** fruit into the basket: a soft thud with a bit of body */
  drop(i = 0): void { burst(300 - i * 8, 1.2, 0.09, 0.09, 180); ping(160, 0.08, 0.03, 'sine', 90); },
  take(): void { burst(700, 1.5, 0.07, 0.05, 1100); },
  bell(): void { ping(1568, 0.5, 0.07, 'sine'); ping(2349, 0.45, 0.04, 'sine', undefined, 0.01); ping(3136, 0.35, 0.02, 'sine', undefined, 0.02); },
  coins(n: number): void { for (let i = 0; i < Math.min(n, 4); i++) { ping(1568, 0.12, 0.04, 'square', undefined, i * 0.07); ping(2093, 0.16, 0.035, 'square', undefined, i * 0.07 + 0.05); } },
  happy(): void { [659, 784, 1047].forEach((f, i) => ping(f, 0.22, 0.05, 'triangle', undefined, i * 0.09)); },
  puzzled(): void { ping(330, 0.18, 0.05, 'triangle', 300); ping(280, 0.24, 0.05, 'triangle', 240, 0.16); },
  leaves(): void { ping(260, 0.5, 0.05, 'sine', 140); },
  arrives(): void { burst(900, 2, 0.12, 0.04, 1300); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.42, 0.055, 'triangle', undefined, i * 0.12)); },
  fail(): void { ping(300, 0.6, 0.06, 'sine', 140); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
};
