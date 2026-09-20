/**
 * The sound of a rock pool.
 *
 * A slow wash of sea underneath everything, a plop when a creature lands where it belongs, a duller
 * splash when it does not, a rising three-note call when the rule changes, and a little chain of
 * bubbles that climbs with your streak. All synthesised on the shared WebAudio context.
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

/** The sea, slowly breathing under the whole level. */
export class Sea {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;

  start(): void {
    const ctx = audioContext();
    if (!ctx || !on() || this.src) return;
    this.src = ctx.createBufferSource();
    this.src.buffer = noise(ctx); this.src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.5;
    this.gain = ctx.createGain(); this.gain.gain.value = 0.05;
    // the swell: a very slow wobble on the loudness
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 0.09;
    const depth = ctx.createGain(); depth.gain.value = 0.03;
    this.lfo.connect(depth); depth.connect(this.gain.gain);
    this.src.connect(f); f.connect(this.gain); this.gain.connect(ctx.destination);
    this.src.start(); this.lfo.start();
  }

  stop(): void {
    const ctx = audioContext();
    if (!ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    const s = this.src, l = this.lfo;
    setTimeout(() => { try { s?.stop(); l?.stop(); } catch { /* fine */ } }, 700);
    this.src = null; this.lfo = null; this.gain = null;
  }
}

export const tide = {
  pick(): void { burst(1600, 2, 0.08, 0.05, 900); },
  /** right pool: a clean plop that climbs with the streak */
  right(streak: number): void {
    const base = 520 * Math.pow(1.06, Math.min(12, streak));
    ping(base, 0.16, 0.06, 'sine', base * 1.3);
    burst(1200, 1.5, 0.1, 0.05, 600);
  },
  wrong(): void { burst(380, 0.9, 0.28, 0.1, 160); ping(180, 0.25, 0.05, 'triangle', 120); },
  /** the creature reached the shore before you got to it */
  missed(): void { burst(700, 0.7, 0.35, 0.05, 250); },
  /** the rule has changed: three rising notes you cannot mistake for anything else */
  switchRule(): void { [660, 880, 1175].forEach((f, i) => ping(f, 0.22, 0.06, 'triangle', undefined, i * 0.11)); },
  shellLost(): void { ping(260, 0.4, 0.06, 'sawtooth', 130); },
  complete(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.42, 0.055, 'triangle', undefined, i * 0.12)); },
  fail(): void { ping(300, 0.6, 0.06, 'sine', 140); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
};
