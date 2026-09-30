import { drawGuide, GUIDE_NAME } from './guide';
import { dayKey, cleanUsed, isLastGo, leftToday, limitsFor, spend, spent, type Child } from './session';
import { playingChild } from './who';
import { NL, T } from '../util/lang';
import { persist, save, whenFinished } from '../util/storage';
import { speakLine, stopSpeaking } from './voice';
import { audioContext } from '../util/audio';

/**
 * The part of the promise that is kept rather than written down.
 *
 * The hub tells parents that sessions end. Until now that was true per game - every game has a
 * last round - and not true per day, because nothing counted. This counts.
 *
 * Three rules it works by, and all three are deliberate:
 *
 *  - **It does nothing until a parent has set it up.** A family that never opens the parent area
 *    gets the app exactly as it was. A time limit is a thing a parent chooses, not a thing the
 *    app imposes on someone who did not ask.
 *  - **It counts only while the app is actually in front of somebody.** A phone face-down on a
 *    table is not screen time, and a child who loses ten minutes of their day to a forgotten tab
 *    has been cheated by us.
 *  - **It never interrupts.** The closing appears between things, not in the middle of one. That
 *    is the whole finding from `docs/research.md` §3.2: a natural endpoint works, a cut-off does
 *    not. A game already running keeps running to its own end.
 */

/** How often the tally is written, in seconds. Short enough to be fair, rare enough to be cheap. */
const TICK = 15;

let child: Child | null = null;
let carried = 0;
let timer: number | null = null;
let closed = false;
/** when the last tick ran, so the tail of a visit is counted when the page is left */
let lastAt = 0;
let warned = false;

// who is playing lives in who.ts, because the age decides more than the clock does
const playing = playingChild;

const usedNow = (id: string): ReturnType<typeof cleanUsed> => cleanUsed(save.family.used?.[id]);

/** Minutes spent today by whoever is playing, or nothing when nobody is. */
export function minutesToday(): number {
  const c = playing();
  if (!c) return 0;
  const u = usedNow(c.id);
  return u.date === dayKey(new Date()) ? u.minutes : 0;
}

/** Is this the last thing today? The hub says so out loud; nothing else acts on it. */
export function lastGoNow(typical = 6): boolean {
  const c = playing();
  if (!c) return false;
  return isLastGo(usedNow(c.id), c, dayKey(new Date()), typical);
}

/** Nothing more today. */
export function dayIsDone(): boolean {
  const c = playing();
  if (!c) return false;
  return spent(usedNow(c.id), c, dayKey(new Date()));
}

/**
 * Start counting.
 *
 * Every page calls this. On a page where nobody is playing it costs one function call and stops.
 */
export function startClock(opts: { onDone?: () => void } = {}): void {
  child = playing();
  // every game that records a finished level now tells the day's tally about it
  whenFinished(countFinished);
  if (!child) return;
  if (dayIsDone()) { close(opts.onDone); return; }

  const book = (): void => {
    if (!child || carried < 0.25) return;
    const whole = Math.floor(carried * 4) / 4;
    carried -= whole;
    save.family.used = { ...save.family.used, [child.id]: spend(usedNow(child.id), dayKey(new Date()), whole) };
    persist();
  };
  const tick = (): void => {
    if (!child) return;
    lastAt = Date.now();
    if (document.hidden) return;                      // a phone in a pocket is not screen time
    carried += TICK / 60;
    book();
    // the warning a parent can switch on, against the research (session.ts): once, two minutes out
    if (child.warn && !warned && leftToday(usedNow(child.id), child, dayKey(new Date())) <= 2 && !dayIsDone()) {
      warned = true;
      speakLine(T('Two more minutes, then Suri goes to sleep.', 'Nog twee minuten, dan gaat Suri slapen.'));
    }
    if (dayIsDone()) close(opts.onDone);
  };
  lastAt = Date.now();
  timer = window.setInterval(tick, TICK * 1000);
  // Every game is its own page, so a visit ends between two ticks. What the interval did not get
  // to is counted on the way out, capped at one tick so a stale timestamp cannot charge an hour.
  const flush = (): void => {
    if (!child || closed) return;
    const gone = Math.min(TICK, (Date.now() - lastAt) / 1000);
    lastAt = Date.now();
    if (gone > 1) { carried += gone / 60; book(); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else { lastAt = Date.now(); child = playing(); } });
  window.addEventListener('pagehide', flush);
  // back from the parent screen through the back-forward cache: this page still holds the old
  // save, and its next tick would write the parent's changes away
  window.addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted) location.reload(); });
}

export function stopClock(): void {
  if (timer !== null) { clearInterval(timer); timer = null; }
}

/** One more thing played to its end, which is the only progress a parent is shown. */
export function countFinished(): void {
  const c = playing();
  if (!c) return;
  const u = usedNow(c.id);
  const today = dayKey(new Date());
  const fresh = u.date === today ? u : { date: today, minutes: 0, finished: 0 };
  save.family.used = { ...save.family.used, [c.id]: { ...fresh, finished: fresh.finished + 1 } };
  persist();
}

// ---------------------------------------------------------------- the closing

/**
 * The end of the day: the guide goes to sleep, and the same thing happens every time.
 *
 * A routine is the other half of the research finding. It is the same animation, the same words
 * and the same button every single evening, so that stopping becomes a thing that happens rather
 * than a thing that is decided.
 *
 * There is no cliffhanger, nothing about tomorrow, and nothing to tap that starts anything.
 */
function close(then?: () => void): void {
  if (closed) return;
  closed = true;
  stopClock();
  then?.();
  // whatever was running goes quiet: the story stops reading, the effects and the background stop
  try { stopSpeaking(); } catch { /* nothing was speaking */ }
  try { void audioContext()?.suspend(); } catch { /* no sound engine yet */ }

  const wrap = document.createElement('div');
  wrap.id = 'dayend';
  wrap.innerHTML = `
    <div class="dayend-card">
      <canvas class="dayend-guide" width="360" height="260"></canvas>
      <h2>${T(GUIDE_NAME + ' has gone to sleep', GUIDE_NAME + ' gaat slapen')}</h2>
      <p>${T('Time to give the phone back to a grown-up.', 'Tijd om de telefoon terug te geven aan papa of mama.')}</p>
      <a class="dayend-parents" href="./parents.html">${T('For grown-ups', 'Voor ouders')}</a>
    </div>`;
  document.body.appendChild(wrap);
  // rule 6: a four-year-old hears that the day is done; the sound engine is woken for this one line
  try { void audioContext()?.resume(); } catch { /* not yet unlocked */ }
  speakLine(T(GUIDE_NAME + ' has gone to sleep. Time to give the phone back to a grown-up.', GUIDE_NAME + ' gaat slapen. Tijd om de telefoon terug te geven aan papa of mama.'));

  const c = wrap.querySelector('canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = 360 * dpr; c.height = 260 * dpr;
  let t = 0;
  const draw = (): void => {
    t += 0.016;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 360, 260);
    drawGuide(ctx, 180, 190, 330, { pose: 'sleep', t });
    requestAnimationFrame(draw);
  };
  draw();
}

/** Only for the audit and for tests: forget that the day was closed. */
export function reopenForTesting(): void { closed = false; }

export const guidanceLine = (c: Child): string =>
  NL() ? `${limitsFor(c).perDay} minuten per dag` : `${limitsFor(c).perDay} minutes a day`;
