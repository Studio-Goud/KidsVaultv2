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
import { feel, feelFor } from './feel';

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

const decoded = new Map<string, Promise<boolean>>();

/** Decode one recording, once; the promise says whether there is one to play. */
function decodeKey(ctx: AudioContext, key: string): Promise<boolean> {
  const have = decoded.get(key);
  if (have) return have;
  const p = raw.get(key);
  if (!p) return Promise.resolve(false);
  decoding.add(key);
  const d = p.then(ab => (ab ? ctx.decodeAudioData(ab.slice(0)) : null))
    .then(buf => {
      if (!buf) return false;
      const m = measure(buf.getChannelData(0), buf.sampleRate);
      ready.set(key, { buf, start: m.start, level: m.level });
      return true;
    })
    .catch(() => false);   // a broken file is a file we do not have
  decoded.set(key, d);
  return d;
}

/** Decode everything fetched so far, once there is a context to decode into. */
function decodeAll(ctx: AudioContext): void {
  for (const key of raw.keys()) if (!decoding.has(key)) void decodeKey(ctx, key);
}

/**
 * Play the recording, or wait a moment for it. The first tap on a page is also the one that makes
 * the audio context, so its recording cannot have been decoded yet; rather than answer that tap
 * with the old synthesised sound, it waits up to a quarter of a second for the real one.
 */
function playOrWait(key: string, row: SfxRow, arg: unknown, fallback: () => void): void {
  if (play(key, row, arg)) return;
  const ctx = audioContext();
  if (!ctx || !raw.has(key) || ready.has(key)) { fallback(); return; }
  let settled = false;
  const timer = setTimeout(() => { if (!settled) { settled = true; fallback(); } }, 250);
  void decodeKey(ctx, key).then(ok => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (!(ok && play(key, row, arg))) fallback();
  });
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
    const how = feelFor(name);
    out[name] = (...args: unknown[]): void => {
      if (how) feel(how);
      playOrWait(key, row, args[0], () => { fn.apply(obj, args); });
    };
  }
  return out as T;
}

/** The same for one loose function, as Klankhuis keeps its interface sounds. */
export function sampled<A extends unknown[]>(key: string, fn: (...a: A) => void): (...a: A) => void {
  const row = SFX[key];
  if (!row) return fn;
  queueMicrotask(() => preload(key.split('.')[0]));
  const how = feelFor(key.split('.')[1] ?? '');
  return (...a: A): void => { if (how) feel(how); playOrWait(key, row, a[0], () => fn(...a)); };
}

const loops = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
const wanted = new Set<string>();

/**
 * Start or stop a background that repeats: the hum of the rocket, the sea around the submarine.
 * It fades in and out rather than starting and stopping, and there is no synthesised version
 * underneath - a missing background is simply quiet, which is how the journeys always were.
 */
export function loopSample(key: string, on: boolean): void {
  const row = SFX[key];
  const ctx = audioContext();
  if (!row || !ctx) return;
  decodeAll(ctx);
  const cur = loops.get(key);
  if (!on || save.sound === false) {
    wanted.delete(key);
    if (cur) {
      cur.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
      try { cur.src.stop(ctx.currentTime + 1.6); } catch { /* already stopped */ }
      loops.delete(key);
    }
    return;
  }
  if (cur) return;
  wanted.add(key);
  const r = ready.get(key);
  if (!r) {
    // asked for before it was decoded: start it the moment it is, if it is still wanted then
    void decodeKey(ctx, key).then(ok => { if (ok && wanted.has(key) && !loops.has(key)) loopSample(key, true); });
    return;
  }
  try {
    const src = ctx.createBufferSource();
    src.buffer = r.buf;
    src.loop = true;
    src.loopStart = r.start;
    src.loopEnd = r.buf.duration;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.setTargetAtTime(r.level * (row.gain ?? 1), ctx.currentTime, 0.5);
    src.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime, r.start);
    loops.set(key, { src, g });
  } catch { /* no background, no harm */ }
}

/**
 * Play one recording that is not worth fetching in advance - an animal's call, of which there are
 * hundreds and a child hears a handful. It is fetched when asked for and played as soon as it has
 * been decoded, which on a phone is a fraction of a second.
 */
export function playOnce(key: string, row: SfxRow): void {
  const ctx = audioContext();
  if (!ctx) return;
  manifest().then(() => {
    const file = files?.[key];
    if (!file) return;
    if (!raw.has(key)) raw.set(key, fetch(`./sfx/${file}`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    decodeAll(ctx);
    const attempt = (left: number): void => {
      if (ready.has(key)) { play(key, row, undefined); return; }
      if (left > 0) setTimeout(() => attempt(left - 1), 120);
    };
    attempt(25);
  });
}

/** Whether a recording exists for this key, once the list has loaded. */
export const hasSample = (key: string): boolean => !!files?.[key];

/** Ask for a game's recordings to be fetched, for a sound set that has no methods to wrap. */
export function preloadSamples(game: string): void { queueMicrotask(() => preload(game)); }

/** For the debug handles: which effects have a recording decoded and ready. */
export const samplesReady = (): string[] => [...ready.keys()].sort();
