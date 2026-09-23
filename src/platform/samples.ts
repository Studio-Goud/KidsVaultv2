/**
 * Recorded sound effects in front of the synthesised ones.
 *
 * Every game's sfx object is wrapped once, where it is defined: `withSamples('dig', { ... })`. A
 * method with a row in `src/platform/sfxspec.ts` and a recording in `public/sfx/` plays the
 * recording; anything else - no row, no file, sound not unlocked yet, not decoded yet - falls
 * through to the synthesised method underneath, exactly as before. So a missing file is never a
 * silent game, and taking the files away gives back the old sound.
 *
 * Played through WebAudio rather than an <audio> element, because a tap has to sound when the
 * finger lands, not a tenth of a second later. Each recording is trimmed to its first real sound
 * and cut off at the row's `max`, since the renderer cannot make anything shorter than half a
 * second, and it is levelled by its peak so that recordings made one at a time sit together.
 *
 * `audio.ts` both provides the context and is itself wrapped, so these two modules import each
 * other. That is safe only because nothing here touches module state while a wrapper is being
 * built; the preloading is pushed to a microtask for that reason.
 */

// the spec first: when `audio.ts` is the module that pulls this one in, it calls `withSamples` before
// this file has finished loading, and the spec must already be there by then
import { SFX, type SfxRow } from './sfxspec';
import { audioContext } from '../util/audio';
import { save } from '../util/storage';
import { measure } from './sfxlevel';

interface Ready { buf: AudioBuffer; start: number; level: number }

let files: Record<string, string> | null = null;
let manifestP: Promise<void> | null = null;
const raw = new Map<string, Promise<ArrayBuffer | null>>();
const ready = new Map<string, Ready>();
const decoding = new Set<string>();
const lastAt = new Map<string, number>();

function manifest(): Promise<void> {
  if (manifestP) return manifestP;
  manifestP = typeof fetch !== 'function' ? Promise.resolve() : fetch('./sfx/clips.json')
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      const f = j && typeof j === 'object' ? (j as { files?: unknown }).files : null;
      files = {};
      if (f && typeof f === 'object') {
        for (const [k, v] of Object.entries(f as Record<string, unknown>)) if (typeof v === 'string') files[k] = v;
      }
    })
    .catch(() => { files = {}; });
  return manifestP;
}

/** Fetch this game's recordings in the background, so they are there by the first tap. */
function preload(game: string): void {
  manifest().then(() => {
    for (const [key, file] of Object.entries(files ?? {})) {
      if (!key.startsWith(`${game}.`) || raw.has(key)) continue;
      raw.set(key, fetch(`./sfx/${file}`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
  });
}

/** Decode everything fetched so far, once there is a context to decode into. */
function decodeAll(ctx: AudioContext): void {
  for (const [key, p] of raw) {
    if (ready.has(key) || decoding.has(key)) continue;
    decoding.add(key);
    p.then(ab => (ab ? ctx.decodeAudioData(ab.slice(0)) : null))
      .then(buf => {
        if (!buf) return;
        const m = measure(buf.getChannelData(0), buf.sampleRate);
        ready.set(key, { buf, start: m.start, level: m.level });
      })
      .catch(() => { /* a broken file is a file we do not have */ });
  }
}

/** Play the recording for `key`. False means "not this time", and the synthesised one plays. */
function play(key: string, row: SfxRow, arg: unknown): boolean {
  const ctx = audioContext();
  if (!ctx) return false;
  decodeAll(ctx);
  const r = ready.get(key);
  if (!r) return false;
  // sound off is a sound handled: the synthesised version would be silent too
  if (save.sound === false) return true;
  const now = performance.now();
  if (row.gap && now - (lastAt.get(key) ?? -1e9) < row.gap) return true;
  lastAt.set(key, now);
  try {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = r.buf;
    if (row.step && typeof arg === 'number' && isFinite(arg)) {
      src.playbackRate.value = 2 ** ((row.step * Math.max(0, Math.min(8, arg))) / 12);
    }
    const len = Math.min(row.max, r.buf.duration - r.start);
    const g = ctx.createGain();
    const level = r.level * (row.gain ?? 1);
    g.gain.setValueAtTime(level, t);
    // a short fade at the cut, so a trimmed recording does not end on a click
    const fade = Math.min(0.06, len * 0.3);
    g.gain.setValueAtTime(level, t + Math.max(0, len - fade));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g); g.connect(ctx.destination);
    src.start(t, r.start, len + 0.02);
    return true;
  } catch {
    return false;
  }
}

/** Wrap a game's sfx object so each method with a recording plays it instead. */
export function withSamples<T extends object>(game: string, obj: T): T {
  queueMicrotask(() => preload(game));
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const [name, fn] of Object.entries(obj)) {
    const key = `${game}.${name}`;
    const row = SFX[key];
    if (!row || typeof fn !== 'function') continue;
    out[name] = (...args: unknown[]): unknown => (play(key, row, args[0]) ? undefined : fn.apply(obj, args));
  }
  return out as T;
}

/** The same for one loose function, as Klankhuis keeps its interface sounds. */
export function sampled<A extends unknown[]>(key: string, fn: (...a: A) => void): (...a: A) => void {
  const row = SFX[key];
  if (!row) return fn;
  queueMicrotask(() => preload(key.split('.')[0]));
  return (...a: A): void => { if (!play(key, row, a[0])) fn(...a); };
}

/** For the debug handles: which effects have a recording decoded and ready. */
export const samplesReady = (): string[] => [...ready.keys()].sort();
