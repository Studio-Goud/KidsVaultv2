/**
 * The voice.
 *
 * Letterbos is a game about what words sound like, so it has to be able to say them. It uses the
 * browser's own speech synthesis with a Dutch voice, and it is written so that everything it does
 * is optional: if the machine has no Dutch voice, or no voice at all, or speech throws, the game
 * carries on exactly as before with pictures, tiles and its own sound effects. Nothing here is
 * ever waited on, nothing returns a promise, and no state the game needs lives behind a voice.
 *
 * Two details matter for a child:
 *  - the sounds are spoken slower than the word. A word said at reading speed and then taken
 *    apart at the same speed is not taken apart at all;
 *  - anything new cancels whatever was still being said. A child who taps four tiles in a row
 *    should hear the fourth one, not a queue of the first three.
 */

import { save } from '../../util/storage';
import { noteMiss, recorded, sayRecorded, stopSpeaking as stopRecorded } from '../../platform/voice';
import { sayOf } from './phonics';

type Voices = SpeechSynthesisVoice[];

let voice: SpeechSynthesisVoice | null = null;
let looked = false;
/** true once we have looked and found nothing, so the game can say so once and move on */
let absent = false;

const synth = (): SpeechSynthesis | null => {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch { return null; }
};

/**
 * Pick a Dutch voice.
 *
 * `getVoices()` is empty until the browser has loaded its list, and on some machines it never
 * fills at all, so this is called at startup, again on `voiceschanged`, and again lazily the
 * first few times something is spoken. A Dutch voice of any flavour beats a default voice
 * reading Dutch as if it were English: "maan" in an English voice is not the word.
 */
function findVoice(): void {
  const s = synth();
  if (!s) { absent = true; looked = true; return; }
  let list: Voices = [];
  try { list = s.getVoices(); } catch { list = []; }
  if (!list.length) return;
  looked = true;
  const nl = list.filter(v => (v.lang || '').toLowerCase().startsWith('nl'));
  // nl-NL before nl-BE, and a local voice before one that needs the network
  const best = nl.find(v => v.lang.toLowerCase() === 'nl-nl' && v.localService)
    ?? nl.find(v => v.lang.toLowerCase() === 'nl-nl')
    ?? nl.find(v => v.localService)
    ?? nl[0]
    ?? null;
  voice = best;
  absent = !best;
}

export function initVoice(): void {
  const s = synth();
  if (!s) { absent = true; looked = true; return; }
  findVoice();
  try { s.addEventListener('voiceschanged', findVoice); } catch { /* older Safari */ }
}

/** Has a Dutch voice turned up? The game only uses this to decide what to promise on screen. */
export const hasVoice = (): boolean => voice != null || recorded('nl') > 0;

const on = (): boolean => save.sound !== false;

/**
 * Say something. Nothing is awaited and every failure is swallowed: on a machine without speech
 * this is a no-op that costs nothing.
 */
export function say(text: string, rate = 1, pitch = 1, queue = false): void {
  // Ruth first: every word, sentence and sound in here is recorded (scripts/voice.mjs). On a phone
  // the device voice also went silent once the rest of the app played recordings, which is what
  // the owner heard - "Hoor het woord" doing nothing.
  if (!on() || !text) return;
  if (sayRecorded([text], queue)) return;
  noteMiss(text);
  speakDevice(text, rate, pitch, queue);
}

/** The device's own voice, and nothing else. */
function speakDevice(text: string, rate: number, pitch: number, queue: boolean): void {
  const s = synth();
  if (!s || !on() || !text) return;
  if (!voice && !absent) findVoice();
  try {
    if (!queue) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'nl-NL';
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 1;
    s.speak(u);
  } catch { /* a voice that refuses is no reason to stop the game */ }
}

export function stopSpeaking(): void {
  stopRecorded();
  const s = synth();
  if (!s) return;
  try { s.cancel(); } catch { /* nothing to cancel */ }
}

/** The whole word, at the speed somebody would actually say it. */
export const sayWord = (word: string): void => say(word, 0.85);

/** One sound, slowly, and a little higher so it does not sound like a word. */
export const saySound = (unit: string, queue = false): void => say(sayOf(unit), 0.7, 1.08, queue);

/**
 * The word, and then the word in pieces: *maan*, /m/ /aa/ /n/.
 *
 * That order is the method. The whole word first, so a child knows what they are aiming at, then
 * the sounds one at a time and slower, so they can hear what it is made of. A sentence is read
 * straight through and then word by word, which is the same idea one floor up.
 */
export function sayWordAndParts(word: string, parts: string[], asWords = false): void {
  // the whole run from recordings when every piece has one, so it is never two voices taking turns
  if (on() && sayRecorded([word, ...parts.map(p => (asWords ? p : sayOf(p)))])) return;
  noteMiss([word, ...parts].join(' / '));
  stopSpeaking();
  speakDevice(word, asWords ? 0.8 : 0.85, 1, false);
  for (const p of parts) {
    if (asWords) speakDevice(p, 0.75, 1, true);
    else speakDevice(sayOf(p), 0.7, 1.08, true);
  }
}
