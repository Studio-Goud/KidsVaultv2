/**
 * The voice.
 *
 * Letterbos is a game about what words sound like, so it has to be able to say them. It uses the
 * browser's own speech synthesis with a Dutch voice, and it is written so that everything it does
 * is optional: if the machine has no Dutch voice, or no voice at all, or speech throws, the game
 * carries on exactly as before with pictures, tiles and its own sound effects. Nothing here is
 * ever waited on, nothing returns a promise, and no state the game needs lives behind a voice.
 *
 * It says whole words and nothing smaller. It used to say each sound on its own as well ("mmm",
 * "ah"), and a speech voice handed a loose sound guesses; the owner heard them come out wrong and
 * decided the complete word is the only right thing to say. Anything new cancels whatever was
 * still being said, so a child who taps four times hears the fourth.
 */

import { save } from '../../util/storage';
import { noteMiss, recorded, sayRecorded, stopSpeaking as stopRecorded } from '../../platform/voice';

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

