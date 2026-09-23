/**
 * The sound of a rocket, made out of noise and a very low sine.
 *
 * A real engine is almost entirely noise: a roar with no pitch in it at all. So the flame is a
 * long band-passed hiss whose filter opens as the throttle comes up, and under it sits a rumble
 * too low to hum along to. The little sounds - a part clicking into the stack, a stage letting go -
 * are short and dry, because everything else here is long and loud.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = Math.floor(ctx.sampleRate * 2);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(dur: number, gain: number, from: number, to: number, q = 0.9, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.12, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/**
 * The engine, held for as long as it burns. It is one voice that is turned up and down rather
 * than a sound started again and again, which is the only way a roar stays a roar.
 */
class Engine {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private low: OscillatorNode | null = null;
  private lowGain: GainNode | null = null;

  start(): void {
    const ctx = audioContext();
    if (!ctx || !on() || this.src) return;
    const t = ctx.currentTime;
    this.src = ctx.createBufferSource();
    this.src.buffer = noise(ctx);
    this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 700;
    this.filter.Q.value = 0.6;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filter).connect(this.gain).connect(ctx.destination);
    this.src.start(t);
    this.low = ctx.createOscillator();
    this.low.type = 'sine';
    this.low.frequency.value = 42;
    this.lowGain = ctx.createGain();
    this.lowGain.gain.value = 0;
    this.low.connect(this.lowGain).connect(ctx.destination);
    this.low.start(t);
  }

  /** `power` is how hard it is burning, `thin` how little air is left to carry the sound. */
  set(power: number, thin: number): void {
    const ctx = audioContext();
    if (!ctx || !this.gain || !this.filter || !this.lowGain) return;
    const t = ctx.currentTime;
    // in vacuum there is nothing to hear, so the roar fades out as the air does
    const carry = 0.25 + 0.75 * (1 - thin);
    this.gain.gain.setTargetAtTime(0.13 * power * carry, t, 0.12);
    this.lowGain.gain.setTargetAtTime(0.05 * power * carry, t, 0.12);
    this.filter.frequency.setTargetAtTime(420 + power * 900, t, 0.2);
  }

  stop(): void {
    const ctx = audioContext();
    if (!ctx || !this.src) return;
    const t = ctx.currentTime;
    this.gain?.gain.setTargetAtTime(0, t, 0.25);
    this.lowGain?.gain.setTargetAtTime(0, t, 0.25);
    const src = this.src, low = this.low;
    setTimeout(() => { try { src.stop(); low?.stop(); } catch { /* already stopped */ } }, 1400);
    this.src = null; this.low = null; this.gain = null; this.lowGain = null; this.filter = null;
  }
}

export const engineSound = new Engine();

export const rocket = withSamples('moonshot', {
  /** a part clicking onto the stack */
  clunk(): void { tone(180, 0.09, 0.07, 'square', 120); burst(0.07, 0.05, 1800, 700); },
  tap(): void { tone(620, 0.06, 0.05, 'triangle'); },
  blocked(): void { tone(150, 0.14, 0.07, 'square', 96); },
  tick(): void { tone(880, 0.09, 0.055, 'square'); },
  /** the moment the engines catch */
  ignite(): void { burst(1.6, 0.16, 300, 1600, 0.7); tone(58, 1.4, 0.07, 'sine', 34); },
  /** a spent stage letting go */
  stage(): void { burst(0.35, 0.13, 2400, 400, 1.4); tone(120, 0.3, 0.06, 'square', 60); },
  /** the last of the fuel */
  burnout(): void { burst(0.9, 0.07, 900, 160, 0.8); },
  /** a flight that did not beat the best */
  land(): void { [392, 330].forEach((f, i) => tone(f, 0.4, 0.07, 'sine', undefined, i * 0.14)); },
  /** a flight that did */
  record(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.5, 0.075, 'triangle', undefined, i * 0.11));
    burst(1.4, 0.05, 700, 3000, 0.6);
  },
});
