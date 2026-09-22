/**
 * Klokkijken - reading the clock, in Braambos.
 *
 * A clock on a schoolroom wall, and a ladder of nine levels that goes exactly where a school goes:
 * whole hours, the half hour, the quarters, five minutes at a time, setting the hands yourself,
 * single minutes, finding the face that matches a digital time, the twenty-four hour clock, and
 * finally the question a clock is for - it is twenty past two and the bus goes in twenty-five
 * minutes.
 *
 * Three things it does deliberately:
 *  - the hour hand moves between the numbers. At half past three it is halfway to the four, which
 *    is why Dutch says "half vier" and why children read it as four o'clock. The face never hides
 *    that, and the wrong-answer panel points straight at it;
 *  - a wrong answer is not a loss. The clock explains itself - the hour hand lights up, the slice
 *    it is inside is shaded, the number it has left is circled - and the reading is said out loud
 *    in words. Then the next question comes. There is no way to get stuck;
 *  - the whole spoken layer ("kwart over drie", "tien voor half vier") lives in `dutchtime.ts`, a
 *    plain module with no canvas in it, and is tested.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, breathe, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor,
  heading, outlinedText, Particles, Shake, vignette,
} from '../../render/look';
import {
  dayPart, digitalLabel, durationLabel, handAngles, hourFromAngle, minuteFromAngle, normalise,
  spoken,
} from './dutchtime';
import {
  isRight, LEVELS, makeQuestion, optionsFor, parMsFor, rngFor, starsFor, teachLine,
  type Level, type Question, type Time,
} from './model';
import {
  cleanTopics, nextStep, pickNext, recordTopic, topicOf, type Topics,
} from '../../platform/skill';
import { masteryRing, nextRing } from '../../platform/progress';
import { dialRadius, drawClockFace, drawDigital, drawRoom, HOUR_LEN, MINUTE_LEN } from './paint';
import { clocksfx } from './clocksfx';
import { NL, T } from '../../util/lang';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `clock:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }
interface Disc { cx: number; cy: number; r: number }

interface Layout {
  /** the big clock, or the digital card on a matching question */
  clock: Disc;
  prompt: Rect;
  /**
   * The strip under the question where anything the game says goes: the level's hint at the start,
   * and the correction after a wrong answer. It is reserved whether or not there is anything in it,
   * so the clock never jumps sideways the moment the game has something to say.
   */
  band: Rect;
  /** the answer buttons, or the faces to choose between */
  opts: Rect[];
  /** the check button on a setting question */
  check: Rect;
  wide: boolean;
}

/** How long the right and wrong answers stay on screen before the next question. */
const RIGHT_FOR = 1.25;
const WRONG_FOR = 5.5;

export class Clock {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  /** the safe height: the screen less the notch and the home bar */
  private h = 0;
  /** the whole screen, for the art that runs under them */
  private fullH = 0;
  private st = 0;
  private sb = 0;
  /** the notch and the home bar when the phone is on its side, which live left and right */
  private sl = 0;
  private sr = 0;
  private fullW = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private rng = rngFor(LEVELS[0], 0);
  private attempt = 0;
  private round = 0;
  private q: Question = { kind: 'read', t: { h: 3, m: 0 }, options: [], answer: 0 };
  /** the hands on the face right now: what the child has set, on a setting question */
  private hands: Time = { h: 3, m: 0 };
  private firstTry = 0;
  private wrongCount = 0;
  private streak = 0;
  private earned = 0;
  /** the last few times this level asked about, so it does not ask twice in a row */
  private recent: Time[] = [];
  /**
   * How firm the ground is under each of the nine levels.
   *
   * Reading the quarters and working out how much later are not two sizes of the same thing, so
   * each keeps its own footing and each is asked at its own difficulty.
   */
  private topics: Topics = {};
  /** 0 to 1: how hard this run should be, which here means how many times to choose between */
  private diff = 0.3;
  /** when this question became readable, for judging how long the answer took */
  private askedAt = 0;

  private fb: 'none' | 'right' | 'wrong' = 'none';
  private fbT = 0;
  private given: Time | null = null;
  private dragging: 'hour' | 'minute' | null = null;
  /** where the minute hand was last frame, so passing twelve carries the hour */
  private lastDragM = 0;
  private moved = false;

  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private note = '';
  private noteT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.topics = cleanTopics(save.topics?.clock, LEVELS.map(l => l.id));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __clock?: Clock }).__clock = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h, this.sl, this.sr);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  /**
   * One step back, for the button every game shares. Here there is only one step to take: out of
   * a level and back to the ladder, from the middle of it or from the card at the end.
   */
  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    const L = this.layout();
    return {
      phase: this.phase,
      level: this.level.id,
      levelIndex: this.levelIndex,
      round: this.round,
      rounds: this.level.rounds,
      kind: this.q.kind,
      /** the time being asked about, and the hands as they stand */
      target: { ...normalise(this.q.t.h, this.q.t.m) },
      hands: { ...normalise(this.hands.h, this.hands.m) },
      spokenNl: spoken(this.q.t.h, this.q.t.m, true),
      spokenEn: spoken(this.q.t.h, this.q.t.m, false),
      options: this.q.options.map(o => digitalLabel(o.h, o.m, this.level.h24)),
      answer: this.q.answer,
      feedback: this.fb,
      firstTry: this.firstTry,
      wrong: this.wrongCount,
      streak: this.streak,
      stars: this.earned,
      minuteNumbers: save.clock.minuteNumbers,
      diff: Number(this.diff.toFixed(3)),
      mastery: Number((this.topics[this.level.id]?.level ?? 0).toFixed(3)),
      clock: { x: Math.round(L.clock.cx), y: Math.round(L.clock.cy), r: Math.round(L.clock.r) },
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    // The room fills the screen, but nothing a child reads or presses may sit under the notch or
    // the home bar. So w and h are the safe box, the canvas is the whole screen, and draw() shifts
    // everything down by the top inset and carries the wall on into the strips.
    const safe = safeArea();
    this.st = safe.top;
    this.sb = safe.bottom;
    this.sl = safe.left;
    this.sr = safe.right;
    this.fullH = Math.max(1, window.innerHeight);
    this.fullW = Math.max(1, window.innerWidth);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  /** A row-major grid of equal cells inside a rectangle. */
  private grid(r: Rect, n: number, cols: number, gap: number): Rect[] {
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = (r.w - gap * (cols - 1)) / cols;
    const ch = (r.h - gap * (rows - 1)) / rows;
    const out: Rect[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, row = Math.floor(i / cols);
      out.push({ x: r.x + c * (cw + gap), y: r.y + row * (ch + gap), w: cw, h: ch });
    }
    return out;
  }

  /**
   * Where everything goes.
   *
   * On a phone held upright the clock sits in the middle with the question above it and the
   * answers along the bottom, in reach of a thumb. Turned on its side there is no height for that,
   * so the clock takes the left half and the question and answers stack down the right.
   */
  private layout(): Layout {
    const u = this.u(), w = this.w, h = this.h;
    const pad = 14 * u;
    const wide = w > h * 1.3;
    const n = this.q.kind === 'set' ? 0 : Math.max(1, this.q.options.length);
    const cols = n === 3 ? 3 : 2;
    const rows = Math.max(1, Math.ceil(n / cols));
    const isMatch = this.q.kind === 'match';
    const gap = 9 * u;
    const bandH = 62 * u;
    // the level button, the minute-number switch and the shared house button live across the top,
    // so nothing else starts above this line in either orientation
    const top = 64 * u;

    if (wide) {
      const colX = Math.max(w * 0.46, w - 420 * u);
      const rightW = w - colX - pad;
      const promptH = (this.q.kind === 'elapsed' ? 92 : 70) * u;
      const prompt: Rect = { x: colX, y: top, w: rightW, h: promptH };
      const band: Rect = { x: colX, y: prompt.y + promptH + 8 * u, w: rightW, h: bandH };
      const free = { top: band.y + bandH + 10 * u, bottom: h - 20 * u };
      const cw = colX - pad * 2;
      const check: Rect = { x: colX + rightW / 2 - 90 * u, y: free.top + 16 * u, w: 180 * u, h: 58 * u };
      if (isMatch) {
        // turned on its side the two panes swap over: four faces need the room, and the digital
        // clock they have to be matched against is one short line of figures
        const pane: Rect = { x: pad, y: top, w: cw, h: h - top - 20 * u };
        const dw = Math.min(rightW, 300 * u);
        return {
          clock: { cx: colX + rightW / 2, cy: (free.top + free.bottom) / 2, r: dw / 2 },
          prompt, band, check, wide,
          opts: this.squared(pane, n, 2, gap * 1.6, true),
        };
      }
      const btnH = Math.min(60 * u, (free.bottom - free.top - gap * (rows - 1)) / rows);
      const stackH = btnH * rows + gap * (rows - 1);
      const area: Rect = {
        x: colX, y: free.top + (free.bottom - free.top - stackH) / 2, w: rightW, h: stackH,
      };
      const opts = this.q.kind === 'set' ? [] : this.grid(area, n, cols, gap);
      const r = Math.max(50 * u, Math.min(cw / 2, (h - top - 20 * u) / 2));
      return {
        clock: { cx: pad + cw / 2, cy: top + (h - top - 20 * u) / 2, r },
        prompt, band, opts, check, wide,
      };
    }

    const promptH = (this.q.kind === 'elapsed' ? 92 : 62) * u;
    const prompt: Rect = { x: pad, y: top, w: w - pad * 2, h: promptH };
    const band: Rect = { x: pad, y: prompt.y + promptH + 8 * u, w: w - pad * 2, h: bandH };
    const btnH = isMatch ? Math.min(140 * u, (w - pad * 2 - gap) / 2) : 54 * u;
    const stackH = btnH * rows + gap * (rows - 1);
    const bottom = h - 18 * u;
    const area: Rect = { x: pad, y: bottom - stackH, w: w - pad * 2, h: stackH };
    const opts = this.q.kind === 'set' ? [] : this.squared(area, n, cols, gap, isMatch);
    const check: Rect = { x: w / 2 - 90 * u, y: bottom - 58 * u, w: 180 * u, h: 58 * u };
    const clockTop = band.y + bandH + 8 * u;
    const clockBottom = (this.q.kind === 'set' ? check.y : area.y) - 14 * u;
    const r = Math.max(46 * u, Math.min(w * 0.44, (clockBottom - clockTop) / 2));
    return {
      clock: { cx: w / 2, cy: clockTop + (clockBottom - clockTop) / 2, r },
      prompt, band, opts, check, wide,
    };
  }

  /**
   * The answer grid, with the faces on a matching question pulled in to squares.
   *
   * A clock on a tile twice as wide as it is tall is a clock the height of the tile with a lot of
   * empty card either side of it, which reads as a small clock. Squaring the tiles and centring
   * the row gives the same face a third more diameter for nothing.
   */
  private squared(area: Rect, n: number, cols: number, gap: number, square: boolean): Rect[] {
    const cells = this.grid(area, n, cols, gap);
    if (!square || !cells.length) return cells;
    const side = Math.min(cells[0].w, cells[0].h);
    if (side >= cells[0].w - 1) return cells;
    const rows = Math.ceil(n / cols);
    void rows;
    const usedW = cols * side + gap * (cols - 1);
    const x0 = area.x + (area.w - usedW) / 2;
    return cells.map((c, i) => ({
      x: x0 + (i % cols) * (side + gap), y: c.y + (c.h - side) / 2, w: side, h: side,
    }));
  }

  // ---------- the run of a level ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.diff = nextStep(topicOf(this.topics, this.level.id)).difficulty;
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.round = 0;
    this.firstTry = 0;
    this.wrongCount = 0;
    this.streak = 0;
    this.earned = 0;
    this.recent = [];
    this.ps.clear();
    this.cardPop = 0;
    this.phase = 'play';
    this.nextQuestion();
    this.say(NL() ? this.level.hintNl : this.level.hint, 6);
  }

  private say(text: string, secs = 3.5): void { this.note = text; this.noteT = secs; }

  private nextQuestion(): void {
    this.q = makeQuestion(this.level, this.rng, this.round, this.recent, optionsFor(this.level, this.diff));
    this.askedAt = this.t;
    this.recent.push(this.q.kind === 'elapsed' ? (this.q.from ?? this.q.t) : this.q.t);
    if (this.recent.length > 4) this.recent.shift();
    this.fb = 'none';
    this.fbT = 0;
    this.given = null;
    this.dragging = null;
    this.moved = false;
    this.cardPop = 0;
    // a setting question starts with the hands somewhere else; the rest show the time being read
    this.hands = this.q.kind === 'set'
      ? { ...(this.q.start ?? { h: 12, m: 0 }) }
      : { ...(this.q.kind === 'elapsed' ? (this.q.from ?? this.q.t) : this.q.t) };
  }

  /** The time the face is showing, which is not the answer on an elapsed-time question. */
  private faceTime(): Time {
    if (this.q.kind === 'set') return this.hands;
    if (this.q.kind === 'elapsed') return this.q.from ?? this.q.t;
    return this.q.t;
  }

  private answer(given: Time): void {
    if (this.fb !== 'none') return;
    this.given = given;
    const ok = isRight(this.q, given);
    if (ok) {
      this.fb = 'right';
      this.fbT = RIGHT_FOR;
      this.firstTry++;
      this.streak++;
      clocksfx.right(this.streak);
      const L = this.layout();
      this.ps.spawn('spark', L.clock.cx, L.clock.cy, 16, { colour: '#ffd873', speed: 260, size: L.clock.r * 0.12, max: 0.9, spread: TAU });
      this.ps.spawn('ring', L.clock.cx, L.clock.cy, 2, { colour: 'rgba(120, 220, 160, 0.9)', speed: 0, size: L.clock.r * 0.5, max: 0.8 });
    } else {
      this.fb = 'wrong';
      this.fbT = WRONG_FOR;
      this.wrongCount++;
      this.streak = 0;
      this.shake.add(0.5);
      clocksfx.wrong();
    }
    this.noteAttempt(ok);
  }

  /**
   * What just happened, told to the engine that decides what comes next.
   *
   * Plain facts only - right or wrong, how long it took, whether the ring of fives was up - and
   * nothing about the child. The one thing that comes back is how many times to offer next run.
   */
  private noteAttempt(correct: boolean): void {
    this.topics = recordTopic(this.topics, this.level.id, {
      correct,
      ms: Math.round(Math.max(0, this.t - this.askedAt) * 1000),
      parMs: parMsFor(this.level),
      hints: save.clock.minuteNumbers ? 1 : 0,
      tries: 1,
    });
    save.topics = { ...save.topics, clock: this.topics };
    persist();
  }

  private advance(): void {
    this.round++;
    if (this.round >= this.level.rounds) {
      this.earned = starsFor(this.firstTry, this.level.rounds);
      // finishing is finishing: a level that was hard still opens the next one, because the
      // corrections are where the learning happened. The stars are what say how it went.
      recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
      persist();
      this.phase = 'won';
      this.cardPop = 0;
      clocksfx.complete();
      return;
    }
    this.nextQuestion();
  }

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.8);
    if (this.phase !== 'play') return;
    if (this.fb !== 'none') {
      this.fbT -= dt;
      if (this.fbT <= 0) this.advance();
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) {
      this.held0 = hit;
      this.press(hit);
      return;
    }
    if (this.phase !== 'play' || this.q.kind !== 'set' || this.fb !== 'none') return;
    // grabbing a hand: whichever tip the finger is nearer, and anywhere on the dial counts
    const L = this.layout();
    const d = Math.hypot(p.x - L.clock.cx, p.y - L.clock.cy);
    if (d > L.clock.r * 1.12) return;
    const dr = dialRadius(L.clock.r);
    const a = handAngles(this.hands.h, this.hands.m);
    const tip = (len: number, ang: number): Vec => ({
      x: L.clock.cx + Math.sin(ang) * len, y: L.clock.cy - Math.cos(ang) * len,
    });
    const hTip = tip(dr * HOUR_LEN, a.hour), mTip = tip(dr * MINUTE_LEN, a.minute);
    const dh = Math.hypot(p.x - hTip.x, p.y - hTip.y);
    const dm = Math.hypot(p.x - mTip.x, p.y - mTip.y);
    // out near the rim it can only be the long hand; nearer in, whichever tip is closer
    this.dragging = d > dr * (HOUR_LEN + 0.12) ? 'minute' : (dh < dm ? 'hour' : 'minute');
    this.lastDragM = this.hands.m;
    this.moved = false;
    clocksfx.pick();
    this.dragTo(p);
  }

  private press(id: string): void {
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { clocksfx.tap(); this.start(i); } else clocksfx.wrong();
      return;
    }
    if (id === 'levels') { this.phase = 'levels'; this.cardPop = 0; clocksfx.tap(); return; }
    if (id === 'numbers') {
      save.clock.minuteNumbers = !save.clock.minuteNumbers;
      persist();
      clocksfx.tap();
      this.say(save.clock.minuteNumbers
        ? T('Minute numbers on. Count round in fives.', 'Minuutgetallen aan. Tel rond met vijf tegelijk.')
        : T('Minute numbers off.', 'Minuutgetallen uit.'), 2.2);
      return;
    }
    if (id === 'retry') { clocksfx.tap(); this.start(this.levelIndex); return; }
    if (id === 'next') { clocksfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id === 'go') { if (this.fb !== 'none') this.advance(); return; }
    if (id === 'check') {
      if (this.fb === 'none') this.answer({ ...this.hands });
      return;
    }
    if (id.startsWith('opt:')) {
      const i = Number(id.slice(4));
      const o = this.q.options[i];
      if (o && this.fb === 'none') { clocksfx.pick(); this.answer(o); }
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragTo(this.at(e));
  }

  /**
   * Put the hand the finger holds where the finger is.
   *
   * Moving the long hand moves the short one with it, because on a real clock they are geared
   * together - that is the whole reason the short hand is never exactly on a number. Carrying the
   * minute hand past twelve carries the hour with it, forwards or back.
   */
  private dragTo(p: Vec): void {
    const L = this.layout();
    const angle = Math.atan2(p.x - L.clock.cx, L.clock.cy - p.y);
    if (this.dragging === 'minute') {
      const m = minuteFromAngle(angle, this.level.snap);
      if (m !== this.hands.m) {
        // past twelve in either direction takes the hour with it
        if (this.lastDragM > 45 && m < 15) this.hands.h = (this.hands.h + 1) % 24;
        else if (this.lastDragM < 15 && m > 45) this.hands.h = (this.hands.h + 23) % 24;
        this.hands.m = m;
        this.lastDragM = m;
        this.moved = true;
        if (m % 5 === 0) clocksfx.tock(); else clocksfx.tick();
      }
    } else if (this.dragging === 'hour') {
      const hh = hourFromAngle(angle);
      const keep = this.hands.h >= 12 ? 12 : 0;
      const next = keep + hh;
      if (next !== this.hands.h) {
        this.hands.h = next;
        this.moved = true;
        clocksfx.tock();
      }
    }
  }

  private onUp(_e: PointerEvent): void {
    this.held0 = null;
    this.dragging = null;
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }

    drawRoom(ctx, this.w, this.h, this.t);
    ctx.save();
    this.shake.apply(ctx, 7 * this.u());
    this.drawPlay();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.2);
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  private drawPlay(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();
    const q = this.q;

    // ---- the question
    this.drawPrompt(L.prompt);

    // ---- the clock, or the digital card on a matching question
    if (q.kind === 'match') {
      const cw = L.wide ? L.clock.r * 2 : Math.min(L.clock.r * 2.1, this.w - 56 * u, 300 * u);
      drawDigital(ctx, L.clock.cx, L.clock.cy, cw, cw * 0.42, digitalLabel(q.t.h, q.t.m, this.level.h24));
      if (this.fb === 'wrong') {
        ctx.textAlign = 'center';
        outlinedText(ctx, spoken(q.t.h, q.t.m, NL()), L.clock.cx, L.clock.cy + cw * 0.34,
          this.font('900', 15), '#b0452c', 'rgba(255,255,255,0.95)', 5);
      }
    } else {
      const ft = this.faceTime();
      const wrong = this.fb === 'wrong';
      drawClockFace(ctx, L.clock.cx, L.clock.cy, L.clock.r, {
        h: ft.h, m: ft.m,
        minuteNumbers: save.clock.minuteNumbers,
        // the nail only where the case has room above it; on a short screen the clock fills the
        // space it has and the nail would poke through the card above
        hanging: L.clock.cy - L.clock.r * 1.2 > L.band.y + L.band.h,
        highlight: wrong ? 'hour' : null,
        ghost: wrong && q.kind === 'set' ? { h: q.t.h, m: q.t.m } : null,
        dragging: this.dragging,
        mood: this.fb,
      });
      // a hand showing what to do, on the very first setting question of a level
      if (q.kind === 'set' && !this.moved && this.round === 0 && this.fb === 'none') {
        const a = handAngles(this.hands.h, this.hands.m);
        const dr = dialRadius(L.clock.r);
        const hx = L.clock.cx + Math.sin(a.minute) * dr * MINUTE_LEN;
        const hy = L.clock.cy - Math.cos(a.minute) * dr * MINUTE_LEN;
        ctx.save();
        ctx.globalAlpha = 0.55 + breathe(this.t, 3) * 0.35;
        handCursor(ctx, hx + 10 * u, hy + 12 * u, 13 * u, breathe(this.t, 3));
        ctx.restore();
      }
    }

    this.ps.draw(ctx);

    // ---- what you choose between
    if (q.kind === 'set') {
      // once it is wrong the check button has nothing left to check: the band carries the way on
      if (this.fb !== 'wrong') {
        this.button('check', this.fb === 'right' ? T('Right!', 'Goed!') : T('Done', 'Klaar'),
          L.check.x, L.check.y, L.check.w, L.check.h, '#4fae6e', '#ffffff');
      }
    } else if (q.kind === 'match') {
      L.opts.forEach((r, i) => this.faceTile(r, i));
    } else {
      L.opts.forEach((r, i) => this.optionButton(r, i));
    }

    // ---- the correction, the reading out loud, or whatever the game last had to say
    if (this.fb === 'wrong') this.drawTeach(L);
    else if (this.fb === 'right') this.drawSaid(L.band);
    else if (this.noteT > 0) this.drawNote(L.band);
  }

  /**
   * What the clock said, in words, the moment it was read right.
   *
   * The figures were the answer; the Dutch is the thing worth carrying away, and a child who has
   * just got it right is the one most likely to read it.
   */
  private drawSaid(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    const t = this.q.t;
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.94);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f7a4c';
    ctx.font = this.font('900', 17);
    ctx.fillText(spoken(t.h, t.m, NL()), b.x + b.w / 2, b.y + b.h / 2 + 6 * u, b.w - 24 * u);
  }

  /** The level's own hint, in the same strip the correction uses, fading out on its own. */
  private drawNote(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.92);
    ctx.fillStyle = 'rgba(18,48,71,0.85)';
    ctx.font = this.font('700', 11.5);
    ctx.textAlign = 'center';
    this.wrapText(this.note, b.x + b.w / 2, b.y + b.h / 2 + 4 * u, b.w - 24 * u, 14 * u, 3);
    ctx.restore();
  }

  /** The question, on a card, with the level's own wording. */
  private drawPrompt(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const q = this.q;
    glassPanel(ctx, r.x, r.y, r.w, r.h, 18 * u, 0.93);
    ctx.textAlign = 'center';
    const cx = r.x + r.w / 2;
    const nl = NL();
    if (q.kind === 'elapsed') {
      const from = q.from ?? q.t;
      ctx.fillStyle = '#123047';
      ctx.font = this.font('900', 15);
      ctx.fillText(T(`It is ${digitalLabel(from.h, from.m, true)}.`, `Het is ${digitalLabel(from.h, from.m, true)}.`),
        cx, r.y + 26 * u, r.w - 24 * u);
      ctx.fillStyle = 'rgba(18,48,71,0.82)';
      ctx.font = this.font('800', 13);
      ctx.fillText(T(`The bus goes in ${durationLabel(q.plus ?? 0, false)}.`, `De bus gaat over ${durationLabel(q.plus ?? 0, true)}.`),
        cx, r.y + 50 * u, r.w - 24 * u);
      ctx.fillStyle = 'rgba(18,48,71,0.6)';
      ctx.font = this.font('800', 12.5);
      ctx.fillText(T('What time is that?', 'Hoe laat is dat?'), cx, r.y + 74 * u, r.w - 24 * u);
      return;
    }
    if (q.kind === 'set') {
      ctx.fillStyle = 'rgba(18,48,71,0.62)';
      ctx.font = this.font('800', 12);
      ctx.fillText(T('Set the clock to', 'Zet de klok op'), cx, r.y + 22 * u, r.w - 24 * u);
      ctx.fillStyle = '#123047';
      ctx.font = this.font('900', 17);
      ctx.fillText(spoken(q.t.h, q.t.m, nl), cx, r.y + 46 * u, r.w - 24 * u);
      return;
    }
    if (q.kind === 'match') {
      ctx.fillStyle = '#123047';
      ctx.font = this.font('900', 16);
      ctx.fillText(T('Which clock is this?', 'Welke klok is dit?'), cx, r.y + 28 * u, r.w - 24 * u);
      ctx.fillStyle = 'rgba(18,48,71,0.62)';
      ctx.font = this.font('800', 12);
      ctx.fillText(spoken(q.t.h, q.t.m, nl), cx, r.y + 48 * u, r.w - 24 * u);
      return;
    }
    ctx.fillStyle = '#123047';
    ctx.font = this.font('900', 17);
    ctx.fillText(T('What time is it?', 'Hoe laat is het?'), cx, r.y + 28 * u, r.w - 24 * u);
    ctx.fillStyle = 'rgba(18,48,71,0.62)';
    ctx.font = this.font('800', 12);
    // on the twenty-four hour levels the hands alone cannot say, so the part of the day is given
    ctx.fillText(this.level.h24
      ? T(`It is ${dayPart(q.t.h, false)}.`, `Het is ${dayPart(q.t.h, true)}.`)
      : T('Read the hands, then pick the figures.', 'Lees de wijzers, kies dan de cijfers.'),
    cx, r.y + 49 * u, r.w - 24 * u);
  }

  /** One digital answer, as a chunky button that goes green or red once it has been picked. */
  private optionButton(r: Rect, i: number): void {
    const ctx = this.ctx;
    const o = this.q.options[i];
    if (!o) return;
    const isAnswer = i === this.q.answer;
    const isGiven = this.given != null && this.q.options.indexOf(this.given) === i;
    let tone = '#fffdf6', ink = '#1d4763';
    if (this.fb !== 'none') {
      if (isAnswer) { tone = '#4fae6e'; ink = '#ffffff'; }
      else if (isGiven) { tone = '#e0664a'; ink = '#ffffff'; }
    }
    const face = chunkyButton(ctx, r.x, r.y, r.w, r.h, { tone, pressed: this.held0 === `opt:${i}` });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', Math.min(21, r.h * 0.42 / this.u()));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(digitalLabel(o.h, o.m, this.level.h24), r.x + r.w / 2, face.y + r.h * 0.64, r.w - 16);
    this.hits.push({ id: `opt:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  /** One face to choose between, on a matching question. */
  private faceTile(r: Rect, i: number): void {
    const ctx = this.ctx, u = this.u();
    const o = this.q.options[i];
    if (!o) return;
    const isAnswer = i === this.q.answer;
    const isGiven = this.given != null && this.q.options.indexOf(this.given) === i;
    const pressed = this.held0 === `opt:${i}`;
    let tone = '#fffdf6';
    if (this.fb !== 'none') { if (isAnswer) tone = '#cdeed6'; else if (isGiven) tone = '#f6d3c9'; }
    ctx.save();
    ctx.shadowColor = 'rgba(12,40,60,0.26)';
    ctx.shadowBlur = 12 * u;
    ctx.shadowOffsetY = 4 * u;
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16 * u); ctx.fill();
    ctx.restore();
    const rr = Math.min(r.w, r.h) * (pressed ? 0.36 : 0.38);
    drawClockFace(ctx, r.x + r.w / 2, r.y + r.h / 2, rr, {
      h: o.h, m: o.m, compact: rr < 58,
      mood: this.fb === 'none' ? 'none' : isAnswer ? 'right' : isGiven ? 'wrong' : 'none',
    });
    this.hits.push({ id: `opt:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  /**
   * The moment after a wrong answer, which is the only part of this game that teaches.
   *
   * The face behind has already lit its hour hand and shaded the slice it is inside. This says in
   * words what that means, gives the reading out loud, and offers a button to carry on - and
   * carries on by itself after a few seconds if nobody presses it.
   */
  private drawTeach(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    const t = this.q.t;
    const nl = NL();
    const b = L.band;
    const bw = 84 * u, bh = 42 * u;
    const textW = b.w - bw - 26 * u;
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.95);
    ctx.textAlign = 'center';
    const tx = b.x + 12 * u + textW / 2;
    ctx.fillStyle = '#a5432a';
    ctx.font = this.font('900', 13.5);
    ctx.fillText(`${spoken(t.h, t.m, nl)} · ${digitalLabel(t.h, t.m, this.level.h24)}`,
      tx, b.y + 23 * u, textW);
    ctx.fillStyle = 'rgba(18,48,71,0.78)';
    ctx.font = this.font('700', 11);
    this.wrapText(teachLine(t, nl), tx, b.y + 43 * u, textW, 13.5 * u, 2);
    // the way on, always in the same place, and it presses itself after a few seconds
    this.button('go', T('Next', 'Verder'), b.x + b.w - bw - 10 * u, b.y + (b.h - bh) / 2, bw, bh, '#4fae6e', '#ffffff');
  }

  /**
   * A few lines at most, broken on spaces and centred on `cy`, because a card is not a paragraph.
   * The font has to be set before calling: the break points depend on it.
   */
  private wrapText(text: string, cx: number, cy: number, maxW: number, lh: number, maxLines: number): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
      if (lines.length === maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh, maxW));
  }

  /** The bar across the top, and the row of dots that says how far through the level you are. */
  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', T('Levels', 'Niveaus'), 14 * u, 12 * u, 92 * u, 44 * u);
    // the beginner's switch: the 5, 10, 15 ring on the dial
    const nx = 14 * u + 100 * u;
    const on = save.clock.minuteNumbers;
    const face = chunkyButton(ctx, nx, 12 * u, 56 * u, 44 * u, { tone: on ? '#f0b653' : '#fffdf6', pressed: this.held0 === 'numbers' });
    ctx.fillStyle = on ? '#4a2f10' : '#1d4763';
    ctx.font = this.font('900', 14);
    ctx.textAlign = 'center';
    ctx.fillText('5 10', nx + 28 * u, face.y + 28 * u);
    this.hits.push({ id: 'numbers', x: nx, y: 12 * u, w: 56 * u, h: 44 * u });

    // how far through the level, as a row of dots
    const n = this.level.rounds;
    const dot = 5 * u, gap = 5 * u;
    const total = n * dot * 2 + (n - 1) * gap;
    const dx = this.w / 2 - total / 2;
    const dy = this.h - 8 * u;
    for (let i = 0; i < n; i++) {
      const done = i < this.round;
      ctx.fillStyle = done ? 'rgba(79, 174, 110, 0.95)' : i === this.round ? 'rgba(18,48,71,0.6)' : 'rgba(18,48,71,0.2)';
      ctx.beginPath();
      ctx.arc(dx + dot + i * (dot * 2 + gap), dy, dot * (i === this.round ? 1.25 : 1), 0, TAU);
      ctx.fill();
    }

    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 48 * this.u() ? 16 : 13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 16);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(12, 32, 52, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(352 * u, this.w - 32 * u);
    const ch = Math.min(280 * u, this.h - 40 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 90 * u);
    band.addColorStop(0, this.earned > 0 ? '#8fd6e8' : '#f0c78a');
    band.addColorStop(1, 'rgba(143, 214, 232, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 90 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, nameOf(this.level), this.w / 2, y + 44 * u, this.font('900', 19), '#123047');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 1) * 42 * u, y + 92 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.78)';
    ctx.font = this.font('800', 13);
    ctx.fillText(T(`${this.firstTry} of ${this.level.rounds} right first time`,
      `${this.firstTry} van de ${this.level.rounds} in één keer goed`), this.w / 2, y + 134 * u, cw - 40 * u);
    ctx.fillStyle = 'rgba(18,48,71,0.6)';
    ctx.font = this.font('700', 12);
    ctx.fillText(this.earned === 3
      ? T('Every one read straight off.', 'Allemaal in één keer gelezen.')
      : this.earned === 0
        ? T('The clock showed you each time. Try it once more.', 'De klok liet het elke keer zien. Doe het nog eens.')
        : T('Good. The ones it showed you are the ones to watch.', 'Goed. Let op de klokken die je uitgelegd kreeg.'),
    this.w / 2, y + 158 * u, cw - 40 * u);
    ctx.restore();

    const bw = Math.min(138 * u, (cw - 30 * u) / 2), bh = 50 * u, by = y + ch - 70 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 6 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    drawRoom(ctx, this.w, this.h, this.t);
    ctx.textAlign = 'center';
    heading(ctx, T('Telling the time', 'Klokkijken'), this.w / 2, 46 * u, this.font('900', 24), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    ctx.fillText(T('Read the clock, and set it yourself.', 'Lees de klok, en zet hem zelf.'), this.w / 2, 68 * u);

    const cols = this.w > 620 * u ? 4 : this.w > 430 * u ? 3 : 2;
    const pad = 11 * u;
    const cw = Math.min(190 * u, (this.w - 24 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.66;
    const chh = art + 50 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 84 * u;
    const rowsNeeded = Math.ceil(LEVELS.length / cols);
    const needed = rowsNeeded * chh + (rowsNeeded - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 16 * u) / needed);

    ctx.save();
    if (squeeze < 1) {
      ctx.translate(this.w / 2, listTop);
      ctx.scale(squeeze, squeeze);
      ctx.translate(-this.w / 2, -listTop);
    }
    // the one worth doing now: nearest the edge of what this child can already read, never the
    // one they are worst at
    const suggest = pickNext(this.topics, LEVELS.filter((_, i) => this.unlocked(i)).map(L => L.id));

    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.045, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.28)';
      ctx.shadowBlur = 16 * u;
      ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.restore();

      // the card's own clock, showing a time this level is about
      const shows: Time[] = [
        { h: 3, m: 0 }, { h: 3, m: 30 }, { h: 3, m: 45 }, { h: 4, m: 20 },
        { h: 7, m: 15 }, { h: 9, m: 37 }, { h: 11, m: 5 }, { h: 15, m: 40 }, { h: 14, m: 45 },
      ];
      const t = shows[i % shows.length];
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.42;
      drawClockFace(ctx, x + cw / 2, y + art * 0.55, Math.min(art * 0.42, cw * 0.3), {
        h: t.h, m: t.m, compact: cw < 150 * u,
      });
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.5)';
      ctx.beginPath(); ctx.arc(x + 20 * u, y + 20 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 11);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 20 * u, y + 24 * u);

      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.6)';
      ctx.font = this.font('900', 12.5);
      ctx.fillText(nameOf(L), x + cw / 2, y + art + 14 * u, cw - 16 * u);
      for (let sI = 0; sI < 3; sI++) {
        drawStar(ctx, x + cw / 2 + (sI - 1) * 18 * u, y + art + 32 * u, 7.5 * u, sI < p.stars);
      }

      const m = this.topics[L.id];
      if (open && m && m.seen > 0) masteryRing(ctx, x + cw - 20 * u, y + 20 * u, 11 * u, m.level, u);
      if (open && L.id === suggest) nextRing(ctx, x, y, cw, chh, 19 * u, this.t, u);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.hits.push({
        id: `level:${i}`,
        x: this.w / 2 + (x - this.w / 2) * squeeze,
        y: listTop + (y - listTop) * squeeze,
        w: cw * squeeze, h: chh * squeeze,
      });
    });
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
