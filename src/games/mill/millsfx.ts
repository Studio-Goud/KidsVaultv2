/**
 * The sound of a valley with water in it.
 *
 * One continuous stream sound whose loudness and brightness follow how much water is actually
 * moving, so a trickle whispers and a full channel rushes. On top of that: a spade in earth, a
 * wheel creaking round, a chime when a field has had enough, and the low roll of a flooded house.
 * All synthesised on the shared WebAudio context.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 1.5;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.03 * white) / 1.03;
    d[i] = last * 3;
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
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
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
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

/** The stream that runs the whole level. */
export class Stream {
  private src: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private level = 0;

  private ensure(): boolean {
    const ctx = audioContext();
    if (!ctx || !on()) return false;
    if (this.src) return true;
    this.src = ctx.createBufferSource();
    this.src.buffer = noise(ctx); this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass'; this.filter.frequency.value = 900; this.filter.Q.value = 0.6;
    this.gain = ctx.createGain(); this.gain.gain.value = 0;
    this.src.connect(this.filter); this.filter.connect(this.gain); this.gain.connect(ctx.destination);
    this.src.start();
    return true;
  }

  /** `moving` is how much water is on the move, 0 quiet to 1 rushing. */
  update(moving: number): void {
    if (!this.ensure()) return;
    const ctx = audioContext()!;
    this.level += (Math.min(1, moving) - this.level) * 0.08;
    const t = ctx.currentTime;
    this.gain!.gain.setTargetAtTime(0.02 + this.level * 0.11, t, 0.08);
    this.filter!.frequency.setTargetAtTime(700 + this.level * 1900, t, 0.1);
  }

  stop(): void {
    if (this.gain) this.gain.gain.setTargetAtTime(0, audioContext()!.currentTime, 0.2);
    setTimeout(() => { try { this.src?.stop(); } catch { /* already stopped */ } this.src = null; }, 400);
  }
}

let lastDig = 0;
export const mill = {
  dig(): void {
    const now = performance.now();
    if (now - lastDig < 110) return;
    lastDig = now;
    burst(420, 1.1, 0.13, 0.08, 220);
  },
  blocked(): void { ping(180, 0.12, 0.05, 'triangle', 120); },
  /** a wheel turning: a slow creak, called once per revolution */
  creak(): void { burst(260, 4, 0.22, 0.05, 340); ping(140, 0.2, 0.025, 'triangle', 110); },
  fieldFull(): void { [784, 988, 1175].forEach((f, i) => ping(f, 0.28, 0.05, 'triangle', undefined, i * 0.09)); },
  wheelDone(): void { [523, 659, 784].forEach((f, i) => ping(f, 0.3, 0.05, 'sine', undefined, i * 0.1)); },
  flood(): void { burst(120, 0.8, 0.7, 0.11, 60); ping(90, 0.6, 0.06, 'sawtooth', 50); },
  spring(): void { burst(1800, 1.5, 0.5, 0.06, 900); },
  complete(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => ping(f, 0.45, 0.05, 'triangle', undefined, i * 0.11)); },
  dry(): void { ping(300, 0.5, 0.05, 'sine', 160); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
};
