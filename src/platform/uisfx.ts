/**
 * The sounds of the parts of Suri that are not a game: the front page, the round buttons in every
 * corner, the parent screen, and the Animal Book, which were all silent until the owner asked for
 * "every sound effect, from clicks to animal noises".
 *
 * Each one is an ElevenLabs recording (`ui.*` in src/platform/sfxspec.ts) with a small synthesised
 * click underneath for when the recording is not there, like every game's sound set.
 */

import { audioContext, unlockAudio } from '../util/audio';
import { save } from '../util/storage';
import { withSamples } from './samples';

function ping(freq: number, dur: number, gain: number, to?: number): void {
  const ctx = audioContext();
  if (!ctx || save.sound === false) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const ui = withSamples('ui', {
  tap(): void { ping(760, 0.06, 0.05); },
  open(): void { ping(620, 0.12, 0.05, 990); },
  home(): void { ping(880, 0.12, 0.05); setTimeout(() => ping(660, 0.16, 0.05), 90); },
  back(): void { ping(700, 0.1, 0.045, 480); },
  toggle(): void { ping(1100, 0.04, 0.04); },
  key(): void { ping(900, 0.035, 0.035); },
  page(): void { ping(520, 0.1, 0.035, 700); },
  surprise(): void { [880, 1175, 1568].forEach((f, i) => setTimeout(() => ping(f, 0.18, 0.04), i * 70)); },
  stepper(): void { ping(1300, 0.03, 0.035); },
});

/**
 * A sound for a finger on a page that is not a canvas game. The audio context only exists after
 * a touch, so the first touch both makes it and makes the sound.
 */
export function uiSound(kind: keyof typeof ui): void {
  unlockAudio();
  ui[kind]();
}
