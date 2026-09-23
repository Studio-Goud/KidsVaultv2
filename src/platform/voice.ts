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

/** The parts of a `SpeechSynthesisVoice` the ranking looks at, so it can be tested without one. */
export interface VoiceLike { name: string; lang: string; localService: boolean }

/**
 * How good a device voice is likely to sound as Suri, highest first.
 *
 * The owner asked for a voice as natural as possible, and a woman's. A browser does not say either
 * of those things about a voice, so this goes by name, and the names are what the platforms ship:
 * Apple's Dutch voices are Claire and Ellen (women) and Xander (a man); Microsoft's are Fenna,
 * Colette and Dena (women) against Maarten, Arnaud and Frank; Chrome's own is "Google Nederlands",
 * a woman. Apple marks its better downloads "Enhanced" or "Premium", Microsoft its neural ones
 * "Natural". eSpeak, which is what a Linux machine falls back on, is the robot the owner heard, and
 * comes last.
 *
 * A voice that runs on the device always beats one that does not, whatever it sounds like: a
 * network voice sends the line it reads to somebody's server, and nothing is supposed to leave
 * the device (the first rule in `CLAUDE.md`). A network voice is only ever used when there is no
 * Dutch voice on the device at all, which is what this module did before it ranked anything.
 */
export function voiceScore(v: VoiceLike, want: string): number {
  const name = v.name.toLowerCase();
  const tag = v.lang.toLowerCase().replace('_', '-');
  if (!tag.startsWith(want)) return -Infinity;
  let score = v.localService ? 1000 : 0;
  if (/natural|neural|premium|enhanced|verbeterd/.test(name)) score += 100;
  if (/claire|ellen|fenna|colette|dena|google nederlands|female|vrouw/.test(name)) score += 50;
  if (/xander|maarten|arnaud|frank|\bmale\b|\bman\b/.test(name)) score -= 50;
  if (/espeak|compact/.test(name)) score -= 200;
  // Dutch as spoken in the Netherlands, since that is what the app is written in; Flemish next
  if (want === 'nl' && tag === 'nl-nl') score += 5;
  if (want === 'en' && tag === 'en-gb') score += 5;
  return score;
}

/** The best of what the device offers, or null. */
export function bestVoice<T extends VoiceLike>(all: T[], want: string): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const v of all) {
    const sc = voiceScore(v, want);
    if (sc > bestScore) { best = v; bestScore = sc; }
  }
  return best;
}

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
  picked = bestVoice(all, lang());
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
    u.lang = v.lang;
    // Setting the voice is the part that can be refused - not every engine accepts every voice
    // object - and losing the whole line over it would be the wrong trade. The language alone
    // already gets a Dutch reading out of most machines.
    try { u.voice = v; } catch { /* the language will have to do */ }
    // a child needs it slower than an adult does, and slower again when something is being
    // taken apart rather than read out
    u.rate = Math.max(0.5, Math.min(1.2, 0.92 * rate));
    // the voice's own pitch: nudging it up made every voice sound more synthetic, not younger
    u.pitch = 1;
    s.speak(u);
  } catch { /* a voice that throws is a voice we do not have */ }
}

/**
 * Load the manifest, once, without blocking anything.
 *
 * A missing or broken manifest is not an error: it means nothing has been recorded yet, which is
 * exactly where the app is today.
 */
let lastLine = '';

/**
 * Say a line of instruction, once.
 *
 * Games keep their instruction in one place - a note with a countdown on it - and call it from
 * wherever the instruction changes, sometimes more than once for the same words. This speaks a
 * line when it is new and stays quiet when it is not, so a child hears it rather than a stutter.
 */
export function speakLine(text: string, id: string | null = null): void {
  if (!text || text === lastLine) return;
  lastLine = text;
  say(id, text);
}

/** Forget what was last said, so the same words spoken again are spoken again. */
export function forgetLine(): void { lastLine = ''; }

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
