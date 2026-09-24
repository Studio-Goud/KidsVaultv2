/**
 * Het jaar rond - days, months, seasons and the parts of the day, in Suri.
 *
 * Six levels, each with its own picture to explore before it asks anything: a train of seven day
 * wagons, the same week built up in order, a year wheel turning through twelve months, a scene of
 * one tree that changes with the seasons, and a sky a child drags the sun across. Tapping the
 * picture is always free - it only ever says a name out loud - and every round afterwards is three
 * big buttons, answered wrong without penalty: the right one lights up green, the game says its
 * name, and the next question comes. Nobody fails a level; the stars say how many were right the
 * first time, same as `clock`.
 *
 * The picture and the question are deliberately two different things. A child who has only ever
 * tapped wedges of a year wheel has not yet been asked "what comes after maart" - the wheel is
 * where a name is learned, the buttons are where it is practised.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { GUIDE_KEEP, safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, chunkyButton, drawStar, easeOutBack, glassPanel, heading, Particles, Shake, vignette,
} from '../../render/look';
import {
  DAYPARTS, DAYS, LEVELS, MONTHS, SEASONS, dayAfter, isRight, makeQuestion, remainingShuffled, rngFor,
  starsFor, todayIndex, type Level, type Question,
} from './model';
import { drawLoco, drawRails, drawWagon, drawYearWheel, wheelMonthLabel } from './paint';
import { drawWorld, seasonOfMonthValue } from './world';
import { seasons as sfx } from './seasonsfx';
import { NL, T } from '../../util/lang';
import { forgetLine, sayRecorded, speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `seasons:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

const RIGHT_FOR = 1.2;

/** The usual Dutch and English three-letter months; `.slice(0, 3)` gave "Maa" and "Jun" for juni. */
const MONTH_SHORT_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Where today sits on the season scale, so the pictures outside the season level show the real one. */
function seasonNow(): number {
  const d = new Date();
  return seasonOfMonthValue(d.getMonth() + (d.getDate() - 15) / 30);
}

/** The shorter way round the year from `a` to `b`, so going from winter to spring does not pass summer. */
function towards(a: number, b: number, k: number): number {
  let d = ((b - a) % 4 + 4) % 4;
  if (d > 2) d -= 4;
  return a + d * k;
}
const WRONG_FOR = 2.6;

export class Seasons {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private st = 0;
  private sb = 0;
  private sl = 0;
  private sr = 0;
  private fullW = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private rng = () => Math.random();
  private attempt = 0;
  private round = 0;
  private q: Question | null = null;
  private lastPoolIndex = -1;
  private given: number | null = null;
  private fb: 'none' | 'right' | 'wrong' = 'none';
  private fbT = 0;
  private firstTry = 0;
  private wrongCount = 0;
  private streak = 0;
  private earned = 0;

  // "op volgorde": the train built so far, and the shuffled tiles still to place
  private placed: number[] = [0];
  private remaining: number[] = [];
  private orderWrong = -1;
  private orderWrongT = 0;

  // explore state, shared across levels that have a picture worth playing with
  private wheelRot = 0;
  private wheelHit = -1;
  private wheelHitT = 0;
  private seasonShown: number = 0;
  private seasonSwitch = 1;
  private sunAt = 0.5;
  private draggingSun = false;
  // what the pictures show, easing towards what was chosen, so a change is seen happening
  private seasonView = 0;
  private sunView = 0.5;
  private nightView = 0;
  private draggingSeason = false;
  private dragX0 = 0;
  private dragS0 = 0;
  private lastSeasonStep = 0;
  private lastToggle = 0;

  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private note = '';
  private noteT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __seasons?: Seasons }).__seasons = this;
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

  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.cardPop = 0; }
  /** What the guide in the corner repeats: the line being shown, or else the question. */
  spoken(): string { return this.noteT > 0 && this.note ? this.note : this.question(); }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase,
      level: this.level.id,
      levelIndex: this.levelIndex,
      round: this.round,
      rounds: this.level.rounds,
      question: this.q ? (NL() ? this.q.textNl : this.q.textEn) : null,
      options: this.q ? this.q.options.map(o => (NL() ? o.nl : o.en)) : [],
      answer: this.q?.answer ?? -1,
      given: this.given,
      feedback: this.fb,
      firstTry: this.firstTry,
      wrong: this.wrongCount,
      stars: this.earned,
      placed: this.placed.map(i => DAYS[i].id),
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top; this.sb = safe.bottom; this.sl = safe.left; this.sr = safe.right;
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

  /**
   * The picture takes whatever the question does not need: about half a phone held upright. Upright,
   * the answers sit in one row of three when they fit and are inset at the bottom so none lies under
   * the guide in the corner; sideways, the question column is on the left, starting clear of that
   * corner, and the picture fills the right to the bottom edge.
   */
  private layout(): { art: Rect; prompt: Rect; band: Rect; opts: Rect[]; wide: boolean } {
    const u = this.u(), w = this.w, h = this.h;
    const pad = 14 * u;
    const wide = w > h * 1.25;
    const top = 64 * u;
    const n = this.level.id === 'week' || this.level.id === 'order' ? 0 : this.q ? this.q.options.length : 3;
    const gap = 10 * u;

    if (wide) {
      const colX = Math.max(pad, GUIDE_KEEP);
      const colW = Math.min(300 * u, w * 0.4);
      const art: Rect = { x: colX + colW + pad, y: top, w: w - colX - colW - pad * 2, h: h - top - pad };
      const prompt: Rect = { x: colX, y: top, w: colW, h: 70 * u };
      const band: Rect = { x: colX, y: prompt.y + prompt.h + 8 * u, w: colW, h: 48 * u };
      const optTop = band.y + band.h + 10 * u;
      const optH = Math.min(58 * u, (h - optTop - pad - gap * Math.max(0, n - 1)) / Math.max(1, n));
      const opts: Rect[] = [];
      for (let i = 0; i < n; i++) opts.push({ x: colX, y: optTop + i * (optH + gap), w: colW, h: optH });
      return { art, prompt, band, opts, wide };
    }

    const inner = w - GUIDE_KEEP * 2;
    const row = n > 0 && (inner - gap * (n - 1)) / n >= 78 * u;
    const optH = 58 * u;
    const optsH = n === 0 ? 0 : row ? optH : n * optH * 0.86 + (n - 1) * gap * 0.8;
    // with no answer row the feedback band is the lowest thing, so it stays above the guide
    const bottom = h - (n ? 14 * u : GUIDE_KEEP);
    const promptH = 56 * u, bandH = 42 * u;
    const artH = Math.max(150 * u, bottom - top - optsH - promptH - bandH - (n ? 26 : 12) * u);
    const art: Rect = { x: pad, y: top, w: w - pad * 2, h: artH };
    const prompt: Rect = { x: pad, y: art.y + art.h + 10 * u, w: w - pad * 2, h: promptH };
    const band: Rect = { x: pad, y: prompt.y + prompt.h + 6 * u, w: w - pad * 2, h: bandH };
    const opts: Rect[] = [];
    const optTop = band.y + band.h + 10 * u;
    if (row) {
      const ow = (inner - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) opts.push({ x: GUIDE_KEEP + i * (ow + gap), y: optTop, w: ow, h: optH });
    } else {
      const oh = optH * 0.86;
      for (let i = 0; i < n; i++) opts.push({ x: GUIDE_KEEP, y: optTop + i * (oh + gap * 0.8), w: inner, h: oh });
    }
    return { art, prompt, band, opts, wide };
  }

  // ---------- the run of a level ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.round = 0;
    this.firstTry = 0;
    this.wrongCount = 0;
    this.streak = 0;
    this.earned = 0;
    this.lastPoolIndex = -1;
    this.placed = [0];
    this.remaining = remainingShuffled(this.rng, 1);
    this.ps.clear();
    this.cardPop = 0;
    this.phase = 'play';
    this.nextQuestion();
    this.note = NL() ? this.level.hintNl : this.level.hint;
    this.noteT = 6;
    this.ask(true);
  }

  /** The question on screen, in words; the order level has one question for the whole train. */
  private question(): string {
    if (this.level.id === 'order') return T('Which day comes next?', 'Welke dag komt hierna?');
    return this.q ? (NL() ? this.q.textNl : this.q.textEn) : '';
  }

  /**
   * Say the question out loud, since a four-year-old cannot read it: after the level's hint on the
   * first round, on its own after that. Ruth's two recordings are played back to back when she has
   * both; otherwise the device voice says the two as one line.
   */
  private ask(withHint: boolean): void {
    const lines = withHint ? [this.note, this.question()] : [this.question()];
    if (!sayRecorded(lines)) { forgetLine(); speakLine(lines.join(' ')); }
  }

  private say(text: string, secs = 3.5): void {
    this.note = text;
    this.noteT = secs;
    // a wagon tapped twice is said twice: this game's lines are answers to a tap, not instructions
    forgetLine();
    speakLine(text);
  }

  private nextQuestion(): void {
    if (this.level.id === 'order') {
      this.q = null;
      this.fb = 'none'; this.fbT = 0; this.given = null;
      return;
    }
    const { q, poolIndex } = makeQuestion(this.level, this.rng, this.lastPoolIndex);
    this.q = q;
    this.lastPoolIndex = poolIndex;
    this.fb = 'none'; this.fbT = 0; this.given = null;
    this.cardPop = 0;
  }

  private answer(picked: number): void {
    if (!this.q || this.fb !== 'none') return;
    this.given = picked;
    const ok = isRight(this.q, picked);
    this.settle(ok);
  }

  private settle(ok: boolean): void {
    if (ok) {
      this.fb = 'right'; this.fbT = RIGHT_FOR; this.firstTry++; this.streak++;
      sfx.right(this.streak);
      const L = this.layout();
      this.ps.spawn('spark', L.prompt.x + L.prompt.w / 2, L.prompt.y + L.prompt.h / 2, 14,
        { colour: '#ffd873', speed: 220, size: 12 * this.u(), max: 0.8, spread: TAU });
    } else {
      this.fb = 'wrong'; this.fbT = WRONG_FOR; this.wrongCount++; this.streak = 0;
      this.shake.add(0.4);
      sfx.wrong();
      // the right answer is said as well as lit, for a child who cannot read the green button
      if (this.q) { const o = this.q.options[this.q.answer]; forgetLine(); speakLine(NL() ? o.nl : o.en); }
    }
  }

  private advance(): void {
    this.round++;
    if (this.round >= this.level.rounds) {
      this.earned = starsFor(this.firstTry, this.level.rounds);
      recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
      persist();
      this.phase = 'won';
      this.cardPop = 0;
      sfx.complete();
      return;
    }
    this.nextQuestion();
    this.ask(false);
  }

  // ---------- "op volgorde" ----------

  private tapOrder(dayIndex: number): void {
    // the day that actually comes next in the week, not merely the next tile on offer - the tiles
    // are shuffled for the picking, the calendar underneath them is not
    const target = dayAfter(this.placed[this.placed.length - 1]);
    if (dayIndex === target) {
      sfx.wagon();
      this.placed = [...this.placed, dayIndex];
      this.remaining = this.remaining.filter(d => d !== dayIndex);
      this.say(DAYS[dayIndex].nl);
      this.settle(true);
    } else {
      this.orderWrong = dayIndex;
      this.orderWrongT = 0.5;
      sfx.wrong();
      this.wrongCount++;
      this.streak = 0;
    }
  }

  private orderAdvance(): void {
    this.round++;
    if (this.round >= this.level.rounds || this.remaining.length === 0) {
      this.earned = starsFor(this.firstTry, this.level.rounds);
      recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
      persist();
      this.phase = 'won';
      this.cardPop = 0;
      sfx.complete();
    }
  }

  // ---------- update ----------

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.8);
    this.wheelHitT = Math.max(0, this.wheelHitT - dt);
    this.orderWrongT = Math.max(0, this.orderWrongT - dt);
    if (this.phase !== 'play') return;
    // the wheel of months turns very slowly on its own, so it never sits like a diagram
    if (this.level.id === 'months') this.wheelRot = (this.wheelRot + dt * 0.006) % 1;
    // the pictures ease towards what was chosen, so the change is watched rather than cut to
    if (!this.draggingSeason) this.seasonView = towards(this.seasonView, this.seasonShown, Math.min(1, dt * 2.2));
    const sunTo = this.sunAt < 0 ? 1.18 : this.sunAt;
    if (!this.draggingSun) this.sunView += (sunTo - this.sunView) * Math.min(1, dt * 2.5);
    this.nightView += ((this.sunAt < 0 ? 1 : 0) - this.nightView) * Math.min(1, dt * 1.8);
    // the season scene is heard as well as seen: a leaf, a flake, a bird now and then
    if (this.level.id === 'seasons') this.seasonAmbience(dt);
    if (this.level.id === 'order') {
      if (this.fb === 'right') { this.fbT -= dt; if (this.fbT <= 0) { this.fb = 'none'; this.orderAdvance(); } }
      return;
    }
    if (this.fb !== 'none') {
      this.fbT -= dt;
      if (this.fbT <= 0) this.advance();
    }
  }

  private ambienceIn = 1.5;
  private seasonAmbience(dt: number): void {
    this.ambienceIn -= dt;
    if (this.ambienceIn > 0) return;
    this.ambienceIn = 2.5 + Math.random() * 2.5;
    const id = SEASONS[this.seasonShown].id;
    if (id === 'herfst') sfx.leaves();
    else if (id === 'winter') sfx.snow();
    else sfx.bird();
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
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
    if (hit) { this.held0 = hit; this.press(hit); return; }
    if (this.phase !== 'play') return;
    const L = this.layout(), art = L.art;
    const inArt = p.x >= art.x && p.x <= art.x + art.w && p.y >= art.y && p.y <= art.y + art.h;
    if (this.level.id === 'months') {
      const { cx, cy, r } = this.wheelAt(art);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < r * 1.1 && d > r * 0.2) {
        this.draggingSun = true; // reused as "dragging the wheel" flag for this level
        this.dragWheel(p, cx, cy);
      }
    } else if (this.level.id === 'daypart' && inArt) {
      this.draggingSun = true;
      this.dragSun(p, art);
    } else if (this.level.id === 'seasons' && inArt) {
      // a drag across the picture runs the year through it: half its width is one season
      this.draggingSeason = true;
      this.dragX0 = p.x;
      this.dragS0 = this.seasonView;
      this.lastSeasonStep = Math.round(this.seasonView);
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.at(e);
    const L = this.layout();
    if (this.draggingSeason) {
      this.seasonView = this.dragS0 + (p.x - this.dragX0) / (L.art.w * 0.5);
      const step = Math.round(this.seasonView);
      if (step !== this.lastSeasonStep) { this.lastSeasonStep = step; sfx.turn(); }
      return;
    }
    if (!this.draggingSun) return;
    if (this.level.id === 'months') { const { cx, cy } = this.wheelAt(L.art); this.dragWheel(p, cx, cy); }
    else if (this.level.id === 'daypart') this.dragSun(p, L.art);
  }

  private onUp(_e: PointerEvent): void {
    this.held0 = null;
    if (this.draggingSeason) {
      this.draggingSeason = false;
      const i = ((Math.round(this.seasonView) % 4) + 4) % 4;
      this.seasonShown = i;
      this.say(NL() ? SEASONS[i].explainNl : SEASONS[i].explainEn, 6);
      return;
    }
    if (this.draggingSun) {
      this.draggingSun = false;
      if (this.level.id === 'months') {
        const i = this.wheelMonthUnder();
        if (i >= 0) this.say(NL() ? MONTHS[i].nl : MONTHS[i].en);
      } else if (this.level.id === 'daypart') {
        const i = this.daypartNear(this.sunAt);
        this.say(NL() ? DAYPARTS[i].nl : DAYPARTS[i].en);
      }
    }
  }

  private dragWheel(p: Vec, cx: number, cy: number): void {
    const a = Math.atan2(p.y - cy, p.x - cx);
    const turn = (a + Math.PI / 2) / TAU;
    this.wheelRot = ((turn % 1) + 1) % 1;
    const now = performance.now();
    if (now - this.lastToggle > 180) { this.lastToggle = now; sfx.turn(); }
  }

  private wheelMonthUnder(): number {
    // the month at the fixed pointer, given the wheel's current rotation
    const frac = ((0 - this.wheelRot) % 1 + 1) % 1;
    return Math.floor(frac * 12) % 12;
  }

  private dragSun(p: Vec, art: Rect): void {
    this.sunAt = clamp((p.x - art.x) / art.w, 0, 1);
    this.sunView = this.sunAt;
    const now = performance.now();
    if (now - this.lastToggle > 180) { this.lastToggle = now; sfx.turn(); }
  }

  private daypartNear(x: number): number {
    if (x < 0.28) return 0; // ochtend
    if (x < 0.6) return 1;  // middag
    return 2;               // avond
  }

  private press(id: string): void {
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { sfx.tap(); this.start(i); } else sfx.wrong();
      return;
    }
    if (id === 'levels') { this.phase = 'levels'; this.cardPop = 0; sfx.tap(); return; }
    if (id === 'retry') { sfx.tap(); this.start(this.levelIndex); return; }
    if (id === 'next') { sfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id.startsWith('opt:')) {
      const i = Number(id.slice(4));
      if (this.q && this.q.options[i] && this.fb === 'none') { sfx.pick(); this.answer(i); }
      return;
    }
    if (id.startsWith('wagon:')) {
      const i = Number(id.slice(6));
      // "de week" answers by tapping the wagon itself; every other level with the train on screen
      // (yesterday and tomorrow) only uses it to say a name - the answer there is the button row
      const isAnswerable = this.level.id === 'week' && this.q && this.q.options.some(o => o.nl === DAYS[i].nl);
      if (isAnswerable && this.fb === 'none') {
        sfx.pick();
        this.answer(this.q!.options.findIndex(o => o.nl === DAYS[i].nl));
      } else if (this.fb === 'none') { sfx.wagon(); this.say(DAYS[i].nl); }
      return;
    }
    if (id.startsWith('place:')) {
      const i = Number(id.slice(6));
      this.tapOrder(i);
      return;
    }
    if (id.startsWith('season:')) {
      this.seasonShown = Number(id.slice(7));
      sfx.tap();
      this.say(NL() ? SEASONS[this.seasonShown].explainNl : SEASONS[this.seasonShown].explainEn, 6);
      return;
    }
    if (id.startsWith('daypart:')) {
      const i = Number(id.slice(8));
      // nacht has no place on the sun's arc - the chip sets the sun and brings the dark instead;
      // coming out of the night, the sun comes up from below the left edge rather than going back
      if (this.sunAt < 0 && DAYPARTS[i].sunAt >= 0) this.sunView = -0.2;
      this.sunAt = DAYPARTS[i].sunAt;
      sfx.tap();
      this.say(NL() ? DAYPARTS[i].explainNl : DAYPARTS[i].explainEn, 6);
      return;
    }
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }

    this.backdrop();
    ctx.save();
    this.shake.apply(ctx, 6 * this.u());
    if (this.level.id === 'order') this.drawOrder();
    else this.drawStandard();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.16);
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  private backdrop(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#cdeaf7');
    g.addColorStop(1, '#f4ecd8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawStandard(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();

    if (this.level.id === 'week') this.drawWeekArt(L.art);
    else if (this.level.id === 'yesterday') this.drawWeekArt(L.art, true);
    else if (this.level.id === 'months') this.drawMonthsArt(L.art);
    else if (this.level.id === 'seasons') this.drawSeasonsArt(L.art);
    else if (this.level.id === 'daypart') this.drawDaypartArt(L.art);

    this.ps.draw(ctx);

    if (this.q) {
      glassPanel(ctx, L.prompt.x, L.prompt.y, L.prompt.w, L.prompt.h, 16 * u, 0.93);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#123047';
      ctx.font = this.font('900', 15);
      this.wrapText(NL() ? this.q.textNl : this.q.textEn, L.prompt.x + L.prompt.w / 2, L.prompt.y + L.prompt.h * 0.42, L.prompt.w - 24 * u, 18 * u, 2);
    }

    if (this.fb === 'none' && this.noteT > 0) this.drawNote(L.band);
    else if (this.fb === 'right') this.drawSaid(L.band, '#2f7a4c', T('Right!', 'Goed!'));
    else if (this.fb === 'wrong' && this.q) {
      const label = NL() ? this.q.options[this.q.answer].nl : this.q.options[this.q.answer].en;
      this.drawSaid(L.band, '#a5432a', label);
    }

    if (this.level.id !== 'week') {
      L.opts.forEach((r, i) => this.optionButton(r, i));
    } else {
      // the week's answers are three of the seven wagons themselves - see drawWeekArt - so this
      // level shows no separate button row, which is why its art gets the room the others give
      // to L.opts. A short line says so, since an empty strip could look like something failed.
      if (this.fb === 'none' && this.noteT <= 0) {
        ctx.fillStyle = 'rgba(18,48,71,0.5)';
        ctx.font = this.font('700', 11);
        ctx.fillText(T('Tap the wagon with the answer.', 'Tik op de wagon met het antwoord.'), this.w / 2, L.band.y + L.band.h + 22 * u);
      }
    }
  }

  private optionButton(r: Rect, i: number): void {
    const ctx = this.ctx;
    if (!this.q) return;
    const o = this.q.options[i];
    const isAnswer = i === this.q.answer;
    const isGiven = this.given === i;
    let tone = '#fffdf6', ink = '#1d4763';
    if (this.fb !== 'none') {
      if (isAnswer) { tone = '#4fae6e'; ink = '#ffffff'; }
      else if (isGiven) { tone = '#e0664a'; ink = '#ffffff'; }
    }
    chunkyButton(ctx, r.x, r.y, r.w, r.h, { tone, pressed: this.held0 === `opt:${i}` });
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    // the largest size that fits, rather than squeezing "Donderdag" into a narrow button
    const label = NL() ? o.nl : o.en;
    let size = 16;
    ctx.font = this.font('900', size);
    while (size > 11 && ctx.measureText(label).width > r.w - 14 * this.u()) { size -= 0.5; ctx.font = this.font('900', size); }
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.5 + size * this.u() * 0.36, r.w - 10);
    this.hits.push({ id: `opt:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  // ---------- level art ----------

  /**
   * The week as a train running through today's landscape: a locomotive and seven wagons, in two
   * rows of four on a phone held upright. Today's wagon has a lit window with a star in it, rather
   * than a flag on a pole that stuck up into the buttons above.
   */
  private drawWeekArt(art: Rect, showToday = false): void {
    const ctx = this.ctx, u = this.u();
    this.frame(art, () => drawWorld(ctx, art.x, art.y, art.w, art.h, { season: seasonNow(), sun: 0.45, night: 0, t: this.t, u, bare: true }));
    const rows = art.w < 520 * u ? 2 : 1;
    const cols = rows === 2 ? 4 : 8;
    const gap = 6 * u;
    const cw = Math.min(110 * u, (art.w - 16 * u - gap * (cols - 1)) / cols);
    const ch = Math.min(cw * 0.95, (art.h * 0.62 - gap * 3) / rows);
    const rowGap = ch * 0.5;
    const totalH = rows * ch + (rows - 1) * rowGap;
    const x0 = art.x + (art.w - (cols * cw + (cols - 1) * gap)) / 2;
    const y0 = art.y + art.h - totalH - ch * 0.36 - 8 * u;
    const today = todayIndex();
    const roll = Math.sin(this.t * 6) * u * 0.8;
    for (let row = 0; row < rows; row++) {
      drawRails(ctx, art.x + 4 * u, y0 + row * (ch + rowGap) + ch + ch * 0.14, art.w - 8 * u, u);
    }
    for (let slot = 0; slot < cols * rows; slot++) {
      const col = slot % cols, row = Math.floor(slot / cols);
      const x = x0 + col * (cw + gap);
      const y = y0 + row * (ch + rowGap) + (slot % 2 ? roll : -roll);
      if (slot === 0) { drawLoco(ctx, x, y, cw, ch, this.t, u); continue; }
      const i = slot - 1;
      if (i > 6) break;
      let mood: 'none' | 'right' | 'wrong' = 'none';
      if (this.fb !== 'none' && this.q) {
        const isAns = this.q.options[this.q.answer]?.nl === DAYS[i].nl;
        const isGiv = this.given != null && this.q.options[this.given]?.nl === DAYS[i].nl;
        if (isAns) mood = 'right'; else if (isGiv) mood = 'wrong';
      }
      drawWagon(ctx, x, y, cw, ch, DAYS[i], NL() ? DAYS[i].nl : DAYS[i].en, {
        today: showToday ? false : i === today, pressed: this.held0 === `wagon:${i}`, mood, u,
      });
      this.hits.push({ id: `wagon:${i}`, x, y, w: cw, h: ch + ch * 0.14 });
    }
  }

  /** The picture's rounded frame, with a soft shadow, around whatever `draw` paints. */
  private frame(art: Rect, draw: () => void): void {
    const ctx = this.ctx, u = this.u(), r = 18 * u;
    ctx.save();
    ctx.shadowColor = 'rgba(12,40,60,0.28)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 5 * u;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(art.x, art.y, art.w, art.h, r); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(art.x, art.y, art.w, art.h, r); ctx.clip();
    draw();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.roundRect(art.x + 1 * u, art.y + 1 * u, art.w - 2 * u, art.h - 2 * u, r); ctx.stroke();
  }

  private wheelAt(art: Rect): { cx: number; cy: number; r: number } {
    return { cx: art.x + art.w / 2, cy: art.y + art.h * 0.5, r: Math.min(art.w * 0.42, art.h * 0.36) };
  }

  /** The months level: where on the season scale the wheel's pointer is, fractions and all. */
  private wheelSeason(): number {
    const frac = ((0 - this.wheelRot) % 1 + 1) % 1;
    return seasonOfMonthValue(frac * 12 - 0.5);
  }

  private drawMonthsArt(art: Rect): void {
    const ctx = this.ctx, u = this.u();
    // the landscape behind the wheel is the season of the month under the pointer, so turning the
    // wheel turns the year outside too
    this.frame(art, () => drawWorld(ctx, art.x, art.y, art.w, art.h, { season: this.wheelSeason(), sun: 0.5, night: 0, t: this.t, u, bare: true }));
    const { cx, cy, r } = this.wheelAt(art);
    const under = this.wheelMonthUnder();
    drawYearWheel(ctx, cx, cy, r, this.wheelRot, under, u);
    for (let i = 0; i < 12; i++) {
      wheelMonthLabel(ctx, cx, cy, r, this.wheelRot, i, (NL() ? MONTH_SHORT_NL : MONTH_SHORT_EN)[i], u);
    }
    // the month under the pointer, written out in full above the wheel
    const name = NL() ? MONTHS[under].nl : MONTHS[under].en;
    ctx.font = this.font('900', 16);
    const tw = ctx.measureText(name).width + 28 * u;
    glassPanel(ctx, cx - tw / 2, art.y + 8 * u, tw, 30 * u, 15 * u, 0.9);
    ctx.fillStyle = '#123047';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, art.y + 29 * u);
    ctx.font = this.font('800', 11);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(18,48,71,0.55)';
    ctx.lineWidth = 3 * u;
    const hint = T('Turn the wheel.', 'Draai aan het wiel.');
    ctx.strokeText(hint, cx, art.y + art.h - 10 * u);
    ctx.fillText(hint, cx, art.y + art.h - 10 * u);
    // dragging the wheel is handled in onDown/onMove directly rather than through `hits`, because
    // a hit box here would swallow the pointerdown before the drag-start check below ever runs
  }

  /** A row of chips laid over the top of the picture; the picture underneath stays draggable. */
  private chips(art: Rect, prefix: string, labels: string[], on: number, tones: string[]): void {
    const ctx = this.ctx, u = this.u();
    const gap = 6 * u, n = labels.length;
    const chipW = Math.min(110 * u, (art.w - 16 * u - gap * (n - 1)) / n), chipH = 34 * u;
    const x0 = art.x + (art.w - (chipW * n + gap * (n - 1))) / 2, cy = art.y + 8 * u;
    labels.forEach((label, i) => {
      const x = x0 + i * (chipW + gap);
      const lit = i === on;
      chunkyButton(ctx, x, cy, chipW, chipH, { tone: lit ? tones[i] : '#fffdf6', pressed: this.held0 === `${prefix}:${i}` });
      ctx.fillStyle = lit ? '#ffffff' : '#1d4763';
      let size = 13;
      ctx.font = this.font('900', size);
      while (size > 9 && ctx.measureText(label).width > chipW - 10 * u) { size -= 0.5; ctx.font = this.font('900', size); }
      ctx.textAlign = 'center';
      ctx.fillText(label, x + chipW / 2, cy + chipH * 0.5 + size * u * 0.36);
      this.hits.push({ id: `${prefix}:${i}`, x, y: cy, w: chipW, h: chipH });
    });
  }

  private drawSeasonsArt(art: Rect): void {
    const ctx = this.ctx, u = this.u();
    this.frame(art, () => drawWorld(ctx, art.x, art.y, art.w, art.h, { season: this.seasonView, sun: 0.5, night: 0, t: this.t, u, child: true }));
    const lit = this.draggingSeason ? Math.round(((this.seasonView % 4) + 4) % 4) % 4 : this.seasonShown;
    this.chips(art, 'season', SEASONS.map(s => (NL() ? s.nl : s.en)), lit, SEASONS.map(s => seasonTone(s.id)));
    this.dragHint(art, T('Slide across the picture.', 'Veeg over de tekening.'));
  }

  private drawDaypartArt(art: Rect): void {
    const ctx = this.ctx, u = this.u();
    this.frame(art, () => drawWorld(ctx, art.x, art.y, art.w, art.h, { season: seasonNow(), sun: this.sunView, night: this.nightView, t: this.t, u, child: false }));
    // the picture itself is the drag surface (see onDown/onMove); no hit box for the sun, so a
    // finger anywhere on it moves the sun, which is far easier to land than a small disc
    const on = this.sunAt < 0 ? 3 : this.daypartNear(this.sunAt);
    this.chips(art, 'daypart', DAYPARTS.map(d => (NL() ? d.nl : d.en)), on, ['#f2a35c', '#f7c531', '#e0664a', '#3d5a8c']);
    this.dragHint(art, T('Slide the sun across the sky.', 'Schuif de zon over de hemel.'));
  }

  private dragHint(art: Rect, text: string): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 2);
    ctx.font = this.font('800', 11);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(18,48,71,0.6)';
    ctx.lineWidth = 3 * u;
    ctx.strokeText(text, art.x + art.w / 2, art.y + 58 * u);
    ctx.fillText(text, art.x + art.w / 2, art.y + 58 * u);
    ctx.restore();
  }

  private drawOrder(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();
    glassPanel(ctx, L.prompt.x, L.prompt.y, L.prompt.w, L.prompt.h, 16 * u, 0.93);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#123047';
    ctx.font = this.font('900', 15);
    ctx.fillText(T('Which day comes next?', 'Welke dag komt hierna?'), L.prompt.x + L.prompt.w / 2, L.prompt.y + L.prompt.h * 0.6);

    // the train built so far, behind its locomotive, running through today's landscape
    const art = L.art;
    this.frame(art, () => drawWorld(ctx, art.x, art.y, art.w, art.h, { season: seasonNow(), sun: 0.45, night: 0, t: this.t, u, bare: true }));
    const gap = 4 * u;
    const cw = Math.min((art.w - 12 * u - gap * 7) / 8, 70 * u);
    const ch = cw * 0.95;
    const x0 = art.x + (art.w - (cw * 8 + gap * 7)) / 2;
    const y0 = art.y + art.h * 0.2;
    drawRails(ctx, art.x + 4 * u, y0 + ch * 1.14, art.w - 8 * u, u);
    drawLoco(ctx, x0, y0, cw, ch, this.t, u);
    for (let i = 0; i < 7; i++) {
      const x = x0 + (i + 1) * (cw + gap);
      if (i < this.placed.length) {
        const d = DAYS[this.placed[i]];
        drawWagon(ctx, x, y0, cw, ch, d, (NL() ? d.nl : d.en).slice(0, 2), { today: false, pressed: false, mood: 'none', u });
      } else {
        ctx.save();
        ctx.setLineDash([5 * u, 4 * u]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.roundRect(x, y0, cw, ch, 8 * u); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    // the days still to place, shuffled, as tiles in the field: in two rows when one would squeeze
    // "Donderdag" smaller than a child can read
    const tiles = this.remaining;
    const perRow = Math.max(1, Math.min(tiles.length, Math.floor((art.w - 16 * u + gap) / (92 * u + gap))));
    const rows = Math.ceil(tiles.length / Math.max(1, perRow));
    const tgap = 8 * u;
    const tw = Math.min(120 * u, (art.w - 16 * u - tgap * (perRow - 1)) / perRow);
    const th = 50 * u;
    const top = y0 + ch * 1.4 + 12 * u;
    const ty0 = top + Math.max(0, (art.y + art.h - 10 * u - top - (rows * th + (rows - 1) * tgap)) / 2);
    tiles.forEach((dayIdx, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, tiles.length - row * perRow);
      const col = i % perRow;
      const rx0 = art.x + (art.w - (inRow * tw + (inRow - 1) * tgap)) / 2;
      const x = rx0 + col * (tw + tgap), ty = ty0 + row * (th + tgap);
      const wrong = this.orderWrong === dayIdx && this.orderWrongT > 0;
      chunkyButton(ctx, x, ty, tw, th, { tone: wrong ? '#e0664a' : '#fffdf6', pressed: this.held0 === `place:${dayIdx}` });
      ctx.fillStyle = wrong ? '#ffffff' : '#1d4763';
      const label = NL() ? DAYS[dayIdx].nl : DAYS[dayIdx].en;
      let size = 15;
      ctx.font = this.font('900', size);
      while (size > 10 && ctx.measureText(label).width > tw - 12 * u) { size -= 0.5; ctx.font = this.font('900', size); }
      ctx.textAlign = 'center';
      ctx.fillText(label, x + tw / 2, ty + th * 0.5 + size * u * 0.36);
      this.hits.push({ id: `place:${dayIdx}`, x, y: ty, w: tw, h: th });
    });

    if (this.fb === 'right') this.drawSaid(L.band, '#2f7a4c', T('That is right!', 'Dat klopt!'));
    else if (this.noteT > 0) this.drawNote(L.band);
  }

  // ---------- shared bits ----------

  private drawSaid(b: Rect, colour: string, text: string): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, b.x, b.y, b.w, b.h, 14 * u, 0.94);
    ctx.textAlign = 'center';
    ctx.fillStyle = colour;
    ctx.font = this.font('900', 15);
    ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2 + 5 * u, b.w - 24 * u);
  }

  private drawNote(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    glassPanel(ctx, b.x, b.y, b.w, b.h, 14 * u, 0.9);
    ctx.fillStyle = 'rgba(18,48,71,0.85)';
    ctx.font = this.font('700', 11);
    ctx.textAlign = 'center';
    this.wrapText(this.note, b.x + b.w / 2, b.y + b.h / 2 + 4 * u, b.w - 24 * u, 13 * u, 2);
    ctx.restore();
  }

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

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', T('Levels', 'Niveaus'), 14 * u, 12 * u, 92 * u, 44 * u);
    const n = this.level.id === 'order' ? 7 : this.level.rounds;
    const done = this.level.id === 'order' ? this.placed.length - 1 : this.round;
    const dot = 5 * u, gap = 5 * u;
    const total = n * dot * 2 + (n - 1) * gap;
    const dx = this.w / 2 - total / 2;
    const dy = this.h - 8 * u;
    for (let i = 0; i < n; i++) {
      const isDone = i < done;
      ctx.fillStyle = isDone ? 'rgba(79, 174, 110, 0.95)' : i === done ? 'rgba(18,48,71,0.6)' : 'rgba(18,48,71,0.2)';
      ctx.beginPath();
      ctx.arc(dx + dot + i * (dot * 2 + gap), dy, dot * (i === done ? 1.25 : 1), 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 48 * this.u() ? 16 : 13);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h * 0.63, w - 16);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(12, 32, 52, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(340 * u, this.w - 32 * u);
    const ch = Math.min(260 * u, this.h - 40 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 24 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, nameOf(this.level), this.w / 2, y + 42 * u, this.font('900', 18), '#123047');
    for (let i = 0; i < 3; i++) drawStar(ctx, this.w / 2 + (i - 1) * 40 * u, y + 86 * u, 17 * u, i < this.earned);
    ctx.fillStyle = 'rgba(18,48,71,0.78)';
    ctx.font = this.font('800', 13);
    ctx.fillText(T(`${this.firstTry} of ${this.level.rounds} right first time`,
      `${this.firstTry} van de ${this.level.rounds} in één keer goed`), this.w / 2, y + 122 * u, cw - 40 * u);
    ctx.restore();

    const bw = Math.min(130 * u, (cw - 30 * u) / 2), bh = 48 * u, by = y + ch - 66 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 6 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    this.backdrop();
    ctx.textAlign = 'center';
    heading(ctx, T('Round the year', 'Het jaar rond'), this.w / 2, 46 * u, this.font('900', 23), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    ctx.fillText(T('Days, months, seasons, and the parts of the day.', 'Dagen, maanden, seizoenen, en de delen van de dag.'), this.w / 2, 68 * u);

    const cols = this.w > 620 * u ? 3 : 2;
    const pad = 11 * u;
    const cw = Math.min(200 * u, (this.w - 24 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.6;
    const chh = art + 46 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 84 * u;

    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.28)';
      ctx.shadowBlur = 14 * u;
      ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.4;
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 12 * u); ctx.clip();
      this.cardArt(L.id, x + 6 * u, y + 6 * u, cw - 12 * u, art, i);
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.5)';
      ctx.beginPath(); ctx.arc(x + 20 * u, y + 20 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 11);
      ctx.fillText(`${i + 1}`, x + 20 * u, y + 24 * u);

      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.6)';
      ctx.font = this.font('900', 12.5);
      ctx.fillText(nameOf(L), x + cw / 2, y + art + 16 * u, cw - 16 * u);
      for (let sI = 0; sI < 3; sI++) drawStar(ctx, x + cw / 2 + (sI - 1) * 18 * u, y + art + 34 * u, 7.5 * u, sI < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      this.hits.push({ id: `level:${i}`, x, y, w: cw, h: chh });
    });
    ctx.textAlign = 'left';
  }

  private cardArt(id: string, x: number, y: number, w: number, h: number, seed: number): void {
    const ctx = this.ctx, u = this.u();
    const world = (season: number, sun: number, night: number, bare: boolean): void =>
      drawWorld(ctx, x, y, w, h, { season, sun, night, t: this.t, u: u * 0.5, bare, child: !bare });
    if (id === 'week' || id === 'yesterday' || id === 'order') {
      world(seasonNow(), 0.45, 0, true);
      const cw = w * 0.26, ch = h * 0.34, y0 = y + h * 0.5;
      drawRails(ctx, x, y0 + ch * 1.14, w, u * 0.6);
      drawLoco(ctx, x + w * 0.08, y0, cw, ch, this.t, u * 0.6);
      drawWagon(ctx, x + w * 0.37, y0, cw, ch, DAYS[0], DAYS[0].nl.slice(0, 2), { today: false, pressed: false, mood: 'none', u: u * 0.6 });
      drawWagon(ctx, x + w * 0.66, y0, cw, ch, DAYS[1], DAYS[1].nl.slice(0, 2), { today: false, pressed: false, mood: 'none', u: u * 0.6 });
    } else if (id === 'months') {
      world(seasonNow(), 0.5, 0, true);
      drawYearWheel(ctx, x + w / 2, y + h * 0.52, Math.min(w, h) * 0.36, 0, -1, u);
    } else if (id === 'seasons') {
      // the card itself turns through the year, slowly
      world(this.t * 0.12 + seed, 0.5, 0, false);
    } else {
      const k = (this.t * 0.06) % 1.4;
      world(seasonNow(), k - 0.1, clamp((k - 1.05) * 6, 0, 1), false);
    }
  }
}

function seasonTone(id: string): string {
  return id === 'lente' ? '#8fd66e' : id === 'zomer' ? '#ffd23f' : id === 'herfst' ? '#e8823a' : '#a9d4ec';
}
