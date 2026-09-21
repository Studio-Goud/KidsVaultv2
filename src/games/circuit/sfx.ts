/**
 * The noise a bench of parts makes, out of oscillators and nothing else.
 *
 * Three of these are held rather than fired: a motor hum whose pitch and loudness follow the
 * current through it, a buzzer that really is a square wave the way a real one nearly is, and the
 * faint mains-like hum of a relay coil pulling. Everything else is short and dry: a switch clicks,
 * a part clunks down, a fuse snaps.
 */

import { audioContext } from '../../util/audio';
import { save } from '../../util/storage';

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
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
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
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.1, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** A voice that is turned up and down rather than started again and again. */
class Held {
  private osc: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  constructor(private type: OscillatorType, private base: number, private sweep: number, private loud: number) {}

  /** `power` is nought to one; the pitch rides on it, the way a motor's does. */
  set(power: number): void {
    const ctx = audioContext();
    if (!ctx || !on()) { this.stop(); return; }
    if (power <= 0.02) { this.stop(); return; }
    const t = ctx.currentTime;
    if (!this.osc) {
      this.osc = ctx.createOscillator();
      this.osc.type = this.type;
      this.sub = ctx.createOscillator();
      this.sub.type = 'sine';
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain);
      this.sub.connect(this.gain);
      this.gain.connect(ctx.destination);
      this.osc.start(t);
      this.sub.start(t);
    }
    const f = this.base + this.sweep * Math.min(1.2, power);
    this.osc.frequency.setTargetAtTime(f, t, 0.06);
    this.sub?.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.gain?.gain.setTargetAtTime(this.loud * Math.min(1, 0.35 + power * 0.65), t, 0.05);
  }

  stop(): void {
    const ctx = audioContext();
    if (!ctx || !this.osc) return;
    const t = ctx.currentTime;
    this.gain?.gain.setTargetAtTime(0, t, 0.05);
    const o = this.osc, s = this.sub;
    setTimeout(() => { try { o.stop(); s?.stop(); } catch { /* already stopped */ } }, 400);
    this.osc = null; this.sub = null; this.gain = null;
  }
}

/** The motor: a low hum that climbs with the current, the way a small motor speeds up. */
export const motorHum = new Held('sawtooth', 58, 190, 0.055);
/** The buzzer: a square wave, which is near enough what the real thing does to a coil. */
export const buzzHum = new Held('square', 380, 110, 0.035);
/** A relay coil holding in: the faint hum of something magnetic being pulled tight. */
export const coilHum = new Held('triangle', 96, 26, 0.022);

export const bench = {
  /** a part set down on the board */
  clunk(): void { tone(190, 0.08, 0.06, 'square', 128); burst(0.06, 0.04, 1600, 620); },
  tap(): void { tone(660, 0.05, 0.045, 'triangle'); },
  blocked(): void { tone(148, 0.13, 0.06, 'square', 92); },
  /** a switch going over, which is two clicks depending on which way it went */
  click(closed: boolean): void {
    tone(closed ? 1100 : 780, 0.035, 0.07, 'square', closed ? 620 : 430);
    burst(0.04, 0.05, 3200, 900, 1.6);
  },
  /** the length of wire under the finger, one cell at a time */
  draw(n: number): void { tone(420 + (n % 6) * 26, 0.035, 0.028, 'triangle'); },
  /** a bulb catching */
  glow(): void { tone(880, 0.22, 0.04, 'sine', 1320); },
  /** the thread in the fuse letting go */
  blow(): void {
    burst(0.5, 0.16, 5200, 300, 1.2);
    tone(220, 0.35, 0.08, 'square', 60);
  },
  /** current running away down a wire */
  crackle(): void { burst(0.25, 0.07, 900, 2600, 3.2); },
  /** the battery giving up */
  flat(): void { [330, 262].forEach((f, i) => tone(f, 0.45, 0.06, 'sine', undefined, i * 0.16)); },
  /** a puzzle that has just come out right */
  solved(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.45, 0.07, 'triangle', undefined, i * 0.1));
    burst(1.1, 0.04, 800, 3000, 0.6);
  },
  /** everything that was being held, let go at once */
  hush(): void { motorHum.stop(); buzzHum.stop(); coilHum.stop(); },
};
