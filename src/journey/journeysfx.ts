/**
 * The sounds of a discovery journey: setting off, arriving at a stop, asking for more, moving on,
 * and a background while the craft travels. Until the owner asked for sound everywhere, the
 * journeys were silent apart from the voice ("Geluid op de ontdekreizen" in docs/prompt.md).
 *
 * The set is made per journey, keyed by its id (`reis.go`, `diepzee.go`), because a rocket and a
 * submarine should not sound alike. The synthesised versions underneath are deliberately small.
 */

import { audioContext } from '../util/audio';
import { save } from '../util/storage';
import { loopSample, withSamples } from '../platform/samples';

function ping(freq: number, dur: number, gain: number, to?: number): void {
  const ctx = audioContext();
  if (!ctx || save.sound === false) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export function journeySfx(id: string): {
  go(): void; arrive(): void; more(): void; on(): void; index(): void; done(): void; travelling(on: boolean): void;
} {
  const set = withSamples(id, {
    go(): void { ping(180, 0.6, 0.05, 520); },
    arrive(): void { ping(1046, 0.4, 0.04); },
    more(): void { ping(1320, 0.18, 0.03); },
    on(): void { ping(260, 0.4, 0.04, 480); },
    index(): void { ping(760, 0.06, 0.045); },
    done(): void { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ping(f, 0.4, 0.04), i * 120)); },
  });
  return { ...set, travelling: (on: boolean) => loopSample(`${id}.bed`, on) };
}
