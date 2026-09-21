/**
 * How a clock is said out loud, in Dutch and in English.
 *
 * This is the part of Klokkijken that is actually hard, and it is hard in a way that is specific
 * to Dutch. An English child reads half past three and hears three. A Dutch child has to say
 * "half vier" - half *four* - for the same hands, because Dutch counts towards the coming hour
 * rather than away from the one just gone. Everything either side of the half hour is then said
 * relative to that half: 3:20 is "tien voor half vier" and 3:35 is "vijf over half vier". Get that
 * one rule wrong and every answer between twenty past and twenty to is wrong with it.
 *
 * So it lives here, on its own, as plain functions over two numbers, with no canvas and no state,
 * and it is tested hard in `tests/run.mjs`. The rest of the game draws hands; this module decides
 * what those hands are called.
 *
 * The school rule, which is what Dutch children are taught and what this follows:
 *   1..14   over <uur>            (vijf over drie)
 *   15      kwart over <uur>
 *   16..29  <30-m> voor half <uur+1>   (tien voor half vier = 3:20)
 *   30      half <uur+1>          (half vier = 3:30, not 4:30)
 *   31..44  <m-30> over half <uur+1>   (vijf over half vier = 3:35)
 *   45      kwart voor <uur+1>
 *   46..59  <60-m> voor <uur+1>
 */

/** The hour as it is named on a twelve hour face: 0 and 12 are both "twaalf". */
const HOURS_NL = ['twaalf', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf'];
const HOURS_EN = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];

/** Only 1..15 are ever needed: everything further away is counted from the other side. */
const MINS_NL = ['', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
  'elf', 'twaalf', 'dertien', 'veertien', 'kwart'];
const MINS_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'quarter', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
  'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty'];

/** Hours and minutes, wrapped into a real time of day, so 13:75 and -0:10 cannot be asked about. */
export function normalise(h: number, m: number): { h: number; m: number } {
  const total = ((Math.round(h) * 60 + Math.round(m)) % 1440 + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** The name of the hour a twelve hour face shows for this hour of the day. */
export const hourNameNl = (h: number): string => HOURS_NL[((h % 12) + 12) % 12];
export const hourNameEn = (h: number): string => HOURS_EN[((h % 12) + 12) % 12];

/**
 * The time as a Dutch child says it: "kwart over drie", "half vier", "tien voor half vier".
 * No part of the day: `dayPartNl` adds that where it matters.
 */
export function spokenTime(hIn: number, mIn: number): string {
  const { h, m } = normalise(hIn, mIn);
  const here = hourNameNl(h);
  const next = hourNameNl(h + 1);
  if (m === 0) return `${here} uur`;
  if (m === 15) return `kwart over ${here}`;
  if (m === 30) return `half ${next}`;
  if (m === 45) return `kwart voor ${next}`;
  if (m < 15) return `${MINS_NL[m]} over ${here}`;
  if (m < 30) return `${MINS_NL[30 - m]} voor half ${next}`;
  if (m < 45) return `${MINS_NL[m - 30]} over half ${next}`;
  return `${MINS_NL[60 - m]} voor ${next}`;
}

/** The same clock in English, where the half hour still belongs to the hour just gone. */
export function spokenTimeEn(hIn: number, mIn: number): string {
  const { h, m } = normalise(hIn, mIn);
  const here = hourNameEn(h);
  const next = hourNameEn(h + 1);
  if (m === 0) return `${here} o'clock`;
  if (m === 15) return `quarter past ${here}`;
  if (m === 30) return `half past ${here}`;
  if (m === 45) return `quarter to ${next}`;
  // a round five reads as a number on its own; anything else has to say it is minutes
  const say = (n: number): string => (n % 5 === 0 ? MINS_EN[n] : `${MINS_EN[n]} ${n === 1 ? 'minute' : 'minutes'}`);
  if (m < 30) return `${say(m)} past ${here}`;
  return `${say(60 - m)} to ${next}`;
}

/** Whichever language is in front of the child. */
export const spoken = (h: number, m: number, nl: boolean): string => (nl ? spokenTime(h, m) : spokenTimeEn(h, m));

/** Night until six, morning until midday, afternoon until six, evening after that. */
export function dayPartNl(hIn: number): string {
  const h = ((Math.round(hIn) % 24) + 24) % 24;
  if (h < 6) return "'s nachts";
  if (h < 12) return "'s ochtends";
  if (h < 18) return "'s middags";
  return "'s avonds";
}

export function dayPartEn(hIn: number): string {
  const h = ((Math.round(hIn) % 24) + 24) % 24;
  if (h < 6) return 'at night';
  if (h < 12) return 'in the morning';
  if (h < 18) return 'in the afternoon';
  return 'in the evening';
}

export const dayPart = (h: number, nl: boolean): string => (nl ? dayPartNl(h) : dayPartEn(h));

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** The time in figures. On a twelve hour clock midnight and midday are both 12. */
export function digitalLabel(hIn: number, mIn: number, h24: boolean): string {
  const { h, m } = normalise(hIn, mIn);
  if (h24) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`;
}

/**
 * Where the hands point, in radians clockwise from twelve.
 *
 * The hour hand is the whole reason this is a function and not a multiplication: it moves *between*
 * the numbers as the minutes pass. At half past three it is halfway between the 3 and the 4, which
 * is exactly what children read as four o'clock. A face that snaps the hour hand to the numerals
 * teaches the mistake instead of curing it.
 */
export function handAngles(hIn: number, mIn: number): { hour: number; minute: number } {
  const { h, m } = normalise(hIn, mIn);
  const turn = Math.PI * 2;
  return {
    hour: ((h % 12) + m / 60) * (turn / 12),
    minute: (m / 60) * turn,
  };
}

/** The minute an angle from twelve points at, snapped to a step of `step` minutes. */
export function minuteFromAngle(angle: number, step = 1): number {
  const turn = Math.PI * 2;
  const a = ((angle % turn) + turn) % turn;
  const raw = (a / turn) * 60;
  return (Math.round(raw / step) * step) % 60;
}

/** The hour an angle from twelve points at: 0..11, floor, so between 3 and 4 still reads 3. */
export function hourFromAngle(angle: number): number {
  const turn = Math.PI * 2;
  const a = ((angle % turn) + turn) % turn;
  return Math.floor((a / turn) * 12) % 12;
}

/** Minutes from one time to another, going forwards round the clock. */
export function minutesBetween(h0: number, m0: number, h1: number, m1: number): number {
  const a = normalise(h0, m0), b = normalise(h1, m1);
  return (((b.h * 60 + b.m) - (a.h * 60 + a.m)) % 1440 + 1440) % 1440;
}

/** The time a number of minutes later. */
export function plusMinutes(h: number, m: number, add: number): { h: number; m: number } {
  return normalise(h, m + add);
}

/** Two times are the same reading if they land on the same minute of the day. */
export function sameTime(a: { h: number; m: number }, b: { h: number; m: number }): boolean {
  const x = normalise(a.h, a.m), y = normalise(b.h, b.m);
  return x.h === y.h && x.m === y.m;
}

/** The same hands, read on a twelve hour face: 14:20 and 02:20 are one picture. */
export const sameFace = (a: { h: number; m: number }, b: { h: number; m: number }): boolean =>
  normalise(a.h, a.m).h % 12 === normalise(b.h, b.m).h % 12 && normalise(a.h, a.m).m === normalise(b.h, b.m).m;

/** "25 minuten" / "25 minutes", and an hour said as an hour. */
export function durationLabel(mins: number, nl: boolean): string {
  const n = Math.max(0, Math.round(mins));
  if (n === 60) return nl ? 'een uur' : 'one hour';
  if (n === 90) return nl ? 'anderhalf uur' : 'an hour and a half';
  if (n > 60 && n % 60 === 0) return nl ? `${n / 60} uur` : `${n / 60} hours`;
  if (n > 60) return nl ? `${Math.floor(n / 60)} uur en ${n % 60} minuten` : `${Math.floor(n / 60)} hours and ${n % 60} minutes`;
  return nl ? `${n} minuten` : `${n} minutes`;
}
