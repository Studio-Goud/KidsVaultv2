/**
 * The sounds of a wood at night with something about to go off in it.
 *
 * A puffball announces itself twice: a soft thud when you put it down, and a rising note while it
 * swells, so a child who is not looking at it still knows how long they have. The pop itself is
 * breath rather than a bang - this is a mushroom, not an explosion.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = Math.floor(ctx.sampleRate * 1.2);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    d[i] = last * 3.2;
  }
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
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function breath(dur: number, gain: number, from: number, to: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/**
 * A chain reaction sets off several puffballs inside the same frame, and every voice sums at the
 * destination - five of them together clip. So pops that land on top of each other are ducked, and
 * past the third one nothing is added: by then the ear hears one big breath either way.
 */
let popAt = -1;
let popVoices = 0;
function popSlot(): number {
  const ctx = audioContext();
  const now = ctx ? ctx.currentTime : 0;
  if (now - popAt > 0.15) popVoices = 0;
  popAt = now;
  return popVoices++;
}

export const puff = {
  place(): void { tone(180, 0.12, 0.16, 'sine', 120); breath(0.1, 0.05, 700, 300); },
  /** the note that climbs while it swells - the gaps shorten as the pop gets close */
  tick(step: number): void { tone(330 + step * 90, 0.07, 0.06, 'triangle'); },
  pop(): void {
    const slot = popSlot();
    if (slot > 2) return;
    const duck = slot === 0 ? 1 : slot === 1 ? 0.55 : 0.35;
    breath(0.5, 0.16 * duck, 1800, 220);
    tone(90, 0.28, 0.12 * duck, 'sine', 45);
  },
  pot(): void { tone(420, 0.1, 0.1, 'square', 180); breath(0.18, 0.09, 2600, 700); },
  pickup(): void { tone(660, 0.1, 0.12, 'triangle'); tone(880, 0.16, 0.1, 'triangle', undefined, 0.07); tone(1320, 0.2, 0.07, 'sine', undefined, 0.14); },
  knocked(): void { tone(300, 0.4, 0.14, 'sawtooth', 90); breath(0.3, 0.08, 900, 200); },
  mole(): void { tone(520, 0.18, 0.12, 'triangle', 260); tone(200, 0.3, 0.08, 'sine', 120, 0.1); },
  step(): void { tone(150, 0.05, 0.03, 'sine', 110); },
  tap(): void { tone(520, 0.06, 0.07, 'triangle'); },
  blocked(): void { tone(140, 0.1, 0.07, 'square', 100); },
  complete(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 0.11, 'triangle', undefined, i * 0.11));
  },
  fail(): void { [392, 330, 262].forEach((f, i) => tone(f, 0.34, 0.11, 'sine', undefined, i * 0.13)); },
};
