import { lang } from '../util/lang';
import { save } from '../util/storage';

/**
 * The app's voice.
 *
 * Fourteen of the sixteen experiences currently explain themselves in writing, to children who
 * mostly cannot read. Fixing that is the largest single piece of work in the product, and the
 * thing that decides how expensive it is, is not the code - it is where the sound comes from.
 *
 * There are three ways to get a Dutch voice, and this module is built so the choice can be made
 * per line rather than once for the whole app:
 *
 *  1. **The device's own voice.** Free, already installed, works offline on iOS and on most
 *     Android phones, and available today. It is also flat, and on a phone without a Dutch voice
 *     it is absent entirely. Good enough to build against, not good enough to be the product.
 *  2. **Clips rendered before the app ships.** An open-source speech model runs on a developer's
 *     machine, once, and the result is an audio file in `public/voice/`. Consistent on every
 *     device, no model on the phone, no runtime cost, works offline, and each line costs nothing
 *     after it is made. This is where the fixed lines should end up.
 *  3. **A person in a room with a microphone.** The warmest, the most expensive, and the hardest
 *     to change. Right for the guide and the handful of lines a child hears every single day.
 *
 * So `say()` looks for a clip first and falls back to the device. A line can be upgraded from 1 to
 * 2 to 3 by dropping a file in and adding a row to the manifest, and no game has to change. The
 * reasoning behind that order is in `docs/voice.md`.
 *
 * Three rules hold everywhere, taken from Letterbos, which is the only part of the app that
 * already speaks:
 *  - nothing is ever waited on. No game state may live behind a voice that might not exist;
 *  - anything new cancels what was still being said. A child who taps four times hears the fourth;
 *  - if there is no voice at all, everything still works. Speech is an addition, never a gate.
 */

export interface Clip {
  /** the line's id, e.g. `moonshot.tapARocket` */
  id: string;
  /** the file, relative to `public/voice/`, e.g. `nl/moonshot-tap.mp3` */
  file: string;
  /** roughly how long it lasts, in seconds, so a screen can wait for it without loading it */
  secs: number;
}

export interface Manifest {
  nl: Clip[];
  en: Clip[];
}

const EMPTY: Manifest = { nl: [], en: [] };
let clips: Manifest = EMPTY;

/**
 * A manifest that has been hand-edited, truncated or written by an older version.
 *
 * Kept pure and exported so it can be tested without a browser: everything else in this file
 * needs a window.
 */
export function cleanManifest(raw: unknown): Manifest {
  const out: Manifest = { nl: [], en: [] };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['nl', 'en'] as const) {
    const list = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const { id, file, secs } = row as Record<string, unknown>;
      if (typeof id !== 'string' || !id) continue;
      if (typeof file !== 'string' || !file) continue;
      // a line recorded twice is a mistake upstream; the first one wins so it is at least stable
      if (out[key].some(c => c.id === id)) continue;
      out[key].push({ id, file, secs: typeof secs === 'number' && secs > 0 ? secs : 0 });
    }
  }
  return out;
}

/** The recorded clip for a line, if there is one in this language. */
export function clipFor(m: Manifest, which: 'nl' | 'en', id: string): Clip | null {
  return m[which].find(c => c.id === id) ?? null;
}

/**
 * How far the voice has got, as a number anyone can check.
 *
 * `reads` and `speaks` in the catalogue say which experiences still need this. This says how much
 * of the saying is done with real audio rather than the machine's own voice.
 */
export const recorded = (which: 'nl' | 'en' = 'nl'): number => clips[which].length;

// ---------------------------------------------------------------- the device's own voice

let picked: SpeechSynthesisVoice | null = null;
let looked = false;
/** true once we have looked and found nothing, so nothing keeps looking */
let absent = false;

const synth = (): SpeechSynthesis | null => {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch { return null; }
};

/**
 * Pick a voice in the app's language.
 *
 * `getVoices()` is empty until the browser has loaded its list and on some machines never fills at
 * all, so this is asked again on every attempt until it either finds one or gives up. A Dutch
 * voice of any flavour beats a default voice reading Dutch as if it were English.
 */
function findVoice(): SpeechSynthesisVoice | null {
  if (picked && picked.lang.toLowerCase().startsWith(lang())) return picked;
  const s = synth();
  if (!s || absent) return null;
  let all: SpeechSynthesisVoice[] = [];
  try { all = s.getVoices(); } catch { all = []; }
  if (!all.length) return null;
  const want = lang();
  const mine = all.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(want));
  picked = mine.find(v => v.localService) ?? mine[0] ?? null;
  if (!picked && looked) absent = true;
  looked = true;
  return picked;
}

/** Whether anything at all can be said right now. */
export const hasVoice = (): boolean => clips[lang()].length > 0 || findVoice() != null;

export function stopSpeaking(): void {
  try { synth()?.cancel(); } catch { /* nothing to cancel */ }
  if (playing) { try { playing.pause(); } catch { /* ok */ } playing = null; }
}

let playing: HTMLAudioElement | null = null;

/**
 * Say a line.
 *
 * `id` names the line so it can be upgraded to a recording later; `text` is what to fall back to
 * when there is no recording. Passing only text is allowed and means "never worth recording".
 */
export function say(id: string | null, text: string, opts: { rate?: number } = {}): void {
  if (!save.sound) return;
  stopSpeaking();
  const which = lang();

  const clip = id ? clipFor(clips, which, id) : null;
  if (clip) {
    try {
      const a = new Audio(`./voice/${clip.file}`);
      a.play().catch(() => speakOut(text, opts.rate ?? 1));
      playing = a;
      return;
    } catch { /* fall through to the machine */ }
  }
  speakOut(text, opts.rate ?? 1);
}

function speakOut(text: string, rate: number): void {
  const s = synth();
  const v = findVoice();
  if (!s || !v || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = v.lang;
    // a child needs it slower than an adult does, and slower again when something is being
    // taken apart rather than read out
    u.rate = Math.max(0.5, Math.min(1.2, 0.92 * rate));
    u.pitch = 1.05;
    s.speak(u);
  } catch { /* a voice that throws is a voice we do not have */ }
}

/**
 * Load the manifest, once, without blocking anything.
 *
 * A missing or broken manifest is not an error: it means nothing has been recorded yet, which is
 * exactly where the app is today.
 */
export function loadVoice(): void {
  if (typeof fetch !== 'function') return;
  fetch('./voice/clips.json')
    .then(r => (r.ok ? r.json() : null))
    .then(j => { if (j) clips = cleanManifest(j); })
    .catch(() => { /* nothing recorded yet */ });
  // and start the browser looking for its own voices
  const s = synth();
  if (s) {
    findVoice();
    try { s.addEventListener('voiceschanged', () => { picked = null; absent = false; findVoice(); }); } catch { /* ok */ }
  }
}
