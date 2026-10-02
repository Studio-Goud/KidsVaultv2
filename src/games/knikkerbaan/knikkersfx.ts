/**
 * The sound of Knikkerbaan: wood and glass.
 *
 * A plank lifted, a plank set down, a click for every notch it is turned, a marble tapping a peg,
 * a bright plink when it drops into the cup, and a soft shrug when it misses. Nothing here is a
 * buzzer: a miss is a low double knock and the board goes on. Synthesised on the shared WebAudio
 * context; the recordings from ElevenLabs replace them when they exist (`withSamples`).
 *
 * Rows to paste into `src/platform/sfxspec.ts` (the prefix is the page id; method names match):
 *
 *   // ---- Knikkerbaan
 *   'knikkerbaan.tap': tap(),
 *   'knikkerbaan.pick': tap('a small wooden plank being lifted off a wooden tray'),
 *   'knikkerbaan.place': { prompt: `a wooden plank set down onto a wooden pegboard, one soft knock, ${SOFT}`, secs: 0.6, max: 0.35 },
 *   'knikkerbaan.remove': { prompt: `a wooden plank sliding back into a wooden tray, ${SOFT}`, secs: 0.6, max: 0.4 },
 *   'knikkerbaan.turn': { prompt: `a tiny wooden click, like a small wooden ratchet turning one notch, very short, ${SOFT}`, secs: 0.5, max: 0.12, gap: 60, gain: 0.7 },
 *   'knikkerbaan.go': { prompt: `a glass marble starting to roll on a wooden board, ${SOFT}`, secs: 1.2, max: 0.9 },
 *   'knikkerbaan.bonk': { prompt: `a glass marble tapping a wooden peg, a single soft click, very short, ${SOFT}`, secs: 0.5, max: 0.15, gap: 90, gain: 0.6 },
 *   'knikkerbaan.landed': { prompt: `a glass marble dropping into a small ceramic cup with one bright soft plink, ${SOFT}`, secs: 1.2, max: 1.0 },
 *   'knikkerbaan.shrug': wrong('a glass marble rolling off a wooden plank and two soft low wooden knocks, a gentle shrug, not a buzzer'),
 *   'knikkerbaan.jingle': done('a short happy wooden xylophone run going up, ending on a bright note'),
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';
import { withSamples } from '../../platform/samples';

const on = (): boolean => save.sound !== false;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
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
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function knock(freq: number, q: number, dur: number, gain: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

export const knikkerbaanSfx = withSamples('knikkerbaan', {
  tap(): void { ping(740, 0.06, 0.05); },
  pick(): void { knock(900, 3, 0.05, 0.12); },
  place(): void { knock(420, 4, 0.09, 0.2); ping(210, 0.1, 0.05, 'triangle'); },
  remove(): void { knock(700, 1.5, 0.14, 0.1); },
  turn(): void { knock(1500, 6, 0.03, 0.1); },
  go(): void { knock(500, 0.8, 0.3, 0.06); },
  /** a marble on a peg: harder knock, higher ring */
  bonk(speed = 3): void { const k = Math.min(1, speed / 9); knock(1800, 5, 0.06, 0.06 + 0.1 * k); ping(1200 + 300 * k, 0.1, 0.02 + 0.03 * k); },
  landed(): void { ping(1318, 0.5, 0.07, 'sine'); ping(1976, 0.35, 0.03, 'sine', undefined, 0.02); knock(2200, 4, 0.05, 0.08); },
  shrug(): void { knock(330, 3, 0.1, 0.16); knock(290, 3, 0.1, 0.14, 0.16); },
  jingle(): void { [523, 659, 784, 1047].forEach((f, i) => ping(f, 0.4, 0.05, 'triangle', undefined, i * 0.12)); },
});
