/**
 * The door between the child's app and the parent's.
 *
 * The brief asked for "no simple sum a six-year-old can solve". That was the right instinct for an
 * app for two to six. The app is two to *ten* now (`docs/decisions.md`), and that changes the
 * answer completely: **there is no puzzle that stops a ten-year-old.** Any arithmetic, any
 * shape-matching, any "trace this" is something a child at the top of the range does faster than
 * their parent. A gate built out of a puzzle would be a gate that keeps out exactly the children
 * who least need keeping out.
 *
 * So the gate is a number the parent chooses and the child does not know. That is what every app
 * that has actually thought about this ends up with, and it is the only thing that scales across
 * eight years of a child's life.
 *
 * **What this is not.** It is a lock on a door in a house the child already lives in. The code is
 * stored on the device, scrambled rather than written out, and a determined ten-year-old with a
 * desktop browser and an afternoon can get past it. It stops the everyday thing - a child
 * wandering into the settings and turning off their own time limit - and it is honest about not
 * being more. On a phone, which is where this app is used, there is no easy way in at all.
 *
 * The scrambling below is deliberately not presented as security. It exists so the code is not
 * sitting in plain sight in a file anyone can open, and for no other reason.
 */

/** How many wrong tries before the door stops answering for a while. */
export const TRIES = 5;
/** And for how long, in seconds. Long enough to be boring, short enough not to lock a parent out. */
export const COOLDOWN = 60;

/**
 * Scramble a code so it is not stored as itself.
 *
 * A small deterministic digest, not a cryptographic one, and it is not called a hash anywhere in
 * this file for that reason. See the note at the top.
 */
export function scramble(pin: string): string {
  let a = 0x1b3f, b = 0x7e21;
  for (let i = 0; i < pin.length; i++) {
    const c = pin.charCodeAt(i);
    a = (a * 33 + c) >>> 0;
    b = (b ^ (c + i * 131)) * 65599 >>> 0;
  }
  return `${a.toString(36)}.${b.toString(36)}`;
}

/** Is this four digits, and nothing else? */
export const looksLikePin = (pin: string): boolean => /^\d{4}$/.test(pin);

/**
 * Codes a parent should not be allowed to choose.
 *
 * Not because they are guessable in general - a four-digit code has ten thousand answers - but
 * because these are the ones a child watching over a shoulder recognises instantly, and because
 * `1234` is what somebody picks when they have not thought about it.
 */
export const TOO_EASY = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888',
  '9999', '1234', '4321', '2580', '0123'];

export const tooEasy = (pin: string): boolean => TOO_EASY.includes(pin);

export interface GateState {
  /** the scrambled code, or empty when no parent has set one yet */
  code: string;
  /** wrong tries in a row */
  wrong: number;
  /** epoch seconds the door starts answering again */
  until: number;
}

export const FRESH_GATE: GateState = { code: '', wrong: 0, until: 0 };

/** No code has been chosen yet, so the parent area has to ask for one before it opens. */
export const needsSetup = (g: GateState): boolean => !g.code;

/** Seconds before the door answers again. Zero means now. */
export const waitingFor = (g: GateState, nowSecs: number): number =>
  Math.max(0, Math.ceil(g.until - nowSecs));

export type Answer =
  | { ok: true; state: GateState }
  | { ok: false; why: 'wrong' | 'waiting' | 'malformed'; state: GateState };

/** Try a code. */
export function tryPin(g: GateState, pin: string, nowSecs: number): Answer {
  if (waitingFor(g, nowSecs) > 0) return { ok: false, why: 'waiting', state: g };
  if (!looksLikePin(pin)) return { ok: false, why: 'malformed', state: g };
  if (scramble(pin) === g.code) return { ok: true, state: { ...g, wrong: 0, until: 0 } };
  const wrong = g.wrong + 1;
  const until = wrong >= TRIES ? nowSecs + COOLDOWN : 0;
  return { ok: false, why: 'wrong', state: { code: g.code, wrong: until ? 0 : wrong, until } };
}

export type SetResult =
  | { ok: true; state: GateState }
  | { ok: false; why: 'malformed' | 'tooEasy' };

/** Choose a code, or change it. */
export function setPin(g: GateState, pin: string): SetResult {
  if (!looksLikePin(pin)) return { ok: false, why: 'malformed' };
  if (tooEasy(pin)) return { ok: false, why: 'tooEasy' };
  return { ok: true, state: { code: scramble(pin), wrong: 0, until: 0 } };
}

export function cleanGate(raw: unknown): GateState {
  if (!raw || typeof raw !== 'object') return { ...FRESH_GATE };
  const r = raw as Record<string, unknown>;
  return {
    code: typeof r.code === 'string' ? r.code : '',
    wrong: typeof r.wrong === 'number' && isFinite(r.wrong) ? Math.max(0, Math.round(r.wrong)) : 0,
    until: typeof r.until === 'number' && isFinite(r.until) ? Math.max(0, Math.round(r.until)) : 0,
  };
}
