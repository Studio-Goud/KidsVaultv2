/**
 * Nachtwacht - the sky shows a figure, the lines go out, and you draw it back.
 *
 * That is still the whole game. Two things about it have changed.
 *
 * It used to be six rounds over eight hand-drawn figures and then a card saying the sky was
 * complete, which is a wall with a nice view. It now asks the platform what the next thing should
 * be and gets one number back; the hand-made figures are the opening run, in rising order, and past
 * the last of them the sky goes on making its own out of that number - more stars, more lines,
 * look-alikes crowding closer, less time to look, the lines going out one at a time rather than
 * together, and eventually the whole sky turning over before you draw. There is no top to it. All
 * of that lives in `sky.ts`, which has no canvas in it and can be checked without a browser.
 *
 * And it used to want one press-drag-release per line, which is not how anybody draws a shape. One
 * press now runs through as many stars as the finger reaches: each one locks with a click, a tick
 * under the thumb and a small pop, the note climbing a rung per star, and pulling back over the
 * last one takes it off again. Lifting between stars still works exactly as it did - the star waits
 * and the next tap joins to it - because a child who lifts their finger has not done anything
 * wrong. What a finger means is worked out in `swipe.ts`, also without a canvas.
 */

import { clamp, lerp, TAU, type Vec } from '../../util/math';
import { makeRng } from '../../util/rng';
import { safeArea, uiScale } from '../../util/ui';
import { haptic, unlockAudio } from '../../util/audio';
import { persist, save } from '../../util/storage';
import { countFinished } from '../../platform/clock';
import { t } from '../../i18n';
import { edgeKey } from './figures';
import { bleedEdges, chunkyButton, easeInOut, glassPanel } from '../../render/look';
import { paintNightSky } from './paint';
import { night } from './nightsfx';
import {
  capacity, closestPair, footRoom, grabRadius, headRoom, layoutSky, minStarGap, planNext,
  playField, squareOf, type Field, type Placed, type Plan,
} from './sky';
import { EMPTY_HAND, lift, move, press, runLength, starAt, type Hand } from './swipe';
import { cleanBook, masteryOf, record, type Attempt, type Book } from '../../platform/skill';
import { speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'showing' | 'turning' | 'drawing' | 'wrong' | 'solved' | 'missed' | 'rest';

interface Edge { a: number; b: number; wrong?: boolean; t0: number }

/** How many figures before the sky offers a rest. It is an offer, never an end. */
const REST_EVERY = 6;
/** Two goes at a figure, and then the sky shows it rather than letting a child grind at it. */
const TRIES_PER_FIGURE = 2;
/** How long the sky takes to turn over, in seconds. */
const TURN_SECONDS = 0.7;

export class NightWatch {
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

  private round = 0;
  private phase: Phase = 'showing';
  private phaseT = 0;
  private plan!: Plan;
  private stars: Placed[] = [];
  private figureStars: number[] = [];
  private target = new Set<string>();
  private drawn: Edge[] = [];
  private hand: Hand = EMPTY_HAND;
  private pointer: Vec | null = null;
  /** when a star last locked, so it can pop */
  private pops = new Map<number, number>();
  private peeks = 0;
  private tries = 0;
  private drawT0 = 0;
  private seed = Math.floor(Math.random() * 1e9);

  private book: Book = cleanBook(save.skills);
  private recent: Attempt[] = [];
  private seenMade: string[] = [];
  private tonight: Array<{ name: string; lore: string }> = [];

  private bg: Array<{ x: number; y: number; r: number; a: number; p: number }> = [];
  private shake = 0;
  private hits: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.hand = lift(this.hand); this.pointer = null; });
    this.startRound();
    (window as unknown as { __nw?: NightWatch }).__nw = this; // debug handle, same as Cloudhopper's __wh
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

  /** The rest card is a screen, and the back button leaves it. Nothing else here is a screen. */
  canBack(): boolean { return this.phase === 'rest'; }
  back(): void { if (this.phase === 'rest') this.startRound(); }

  /**
   * Test view.
   *
   * Star positions are in client coordinates - what a pointer event would carry - so a test can
   * drive the game by aiming at them without knowing about the notch. `minGap` and `grab` are the
   * two distances the whole feel rests on, so they can be checked against the sky as drawn.
   */
  debugState(): {
    phase: Phase; round: number; tonight: string[]; difficulty: number; move: Plan['move'];
    figure: string; made: boolean; oneStroke: boolean; showMs: number; fade: string;
    turn: number; mirror: boolean; distractors: number;
    stars: Array<{ x: number; y: number; fig: number | null }>;
    edges: Array<[number, number]>; drawn: Array<[number, number]>; need: number;
    hand: number[]; anchor: number | null; peeks: number; tries: number;
    minGap: number; grab: number; closest: number; room: number;
    skills: { visualMemory: number; pattern: number };
    field: Field;
  } {
    const p = this.plan.puzzle;
    const f = this.field();
    return {
      phase: this.phase, round: this.round, tonight: this.tonight.map(x => x.name),
      difficulty: Math.round(this.plan.difficulty * 1000) / 1000, move: this.plan.move,
      figure: p.id, made: p.made, oneStroke: p.oneStroke, showMs: p.showMs, fade: p.fade,
      turn: p.turn, mirror: p.mirror, distractors: p.distractors,
      stars: this.stars.map(s => ({ x: Math.round(s.x), y: Math.round(s.y + this.st), fig: s.fig })),
      edges: p.edges.map(([a, b]) => [a, b] as [number, number]),
      drawn: this.drawn.map(e => [e.a, e.b] as [number, number]),
      need: this.target.size,
      hand: [...this.hand.path], anchor: this.hand.anchor, peeks: this.peeks, tries: this.tries,
      minGap: Math.round(minStarGap(this.u(), f.s) * 10) / 10,
      grab: Math.round(grabRadius(this.u(), f.s) * 10) / 10,
      closest: Math.round(closestPair(this.stars) * 10) / 10,
      room: capacity(f, this.u()),
      skills: {
        visualMemory: Math.round(masteryOf(this.book, 'visualMemory').level * 1000) / 1000,
        pattern: Math.round(masteryOf(this.book, 'pattern').level * 1000) / 1000,
      },
      field: f,
    };
  }

  // ---------- layout ----------

  private resize(): void {
    // The picture fills the screen, but nothing a child reads or presses may sit under the notch
    // or the home bar. So w and h are the safe box, the canvas is the whole screen, and draw()
    // shifts everything down by the top inset and carries the art on into the strips.
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
    this.makeBackdrop();
    if (this.stars.length) this.place();
  }

  private makeBackdrop(): void {
    const rng = makeRng(20260920);
    this.bg = [];
    const n = Math.round((this.w * this.h) / 5200);
    for (let i = 0; i < n; i++) {
      this.bg.push({ x: rng() * this.w, y: rng() * this.h, r: 0.4 + rng() * 1.3, a: 0.2 + rng() * 0.6, p: rng() * TAU });
    }
  }

  /** How much bigger than a phone this screen is. */
  private u(): number { return uiScale(this.w, this.h); }

  /** The strips above and below the sky, and the sky itself: all three worked out in `sky.ts`. */
  private headRoom(): number { return headRoom(this.u(), this.h); }
  private footRoom(): number { return footRoom(this.u(), this.h); }
  private field(): Field { return playField(this.w, this.h, this.u()); }

  // ---------- rounds ----------

  private startRound(): void {
    this.plan = planNext({
      vm: masteryOf(this.book, 'visualMemory'),
      pattern: masteryOf(this.book, 'pattern'),
      recent: this.recent,
      seenMade: this.seenMade,
      field: this.field(),
      u: this.u(),
      seed: this.seed + this.round * 7919,
    });
    this.target = new Set(this.plan.puzzle.edges.map(([a, b]) => edgeKey(a, b)));
    this.drawn = [];
    this.hand = EMPTY_HAND;
    this.pointer = null;
    this.pops.clear();
    this.peeks = 0;
    this.tries = 0;
    this.place();
    this.setPhase('showing');
  }

  private place(): void {
    const out = layoutSky(this.plan.puzzle, this.field(), this.u(), this.seed + this.round * 104729);
    this.stars = out.stars;
    this.figureStars = out.figureStars;
    this.drawn = this.drawn.filter(e => e.a < this.stars.length && e.b < this.stars.length);
  }

  private setPhase(p: Phase): void {
    if (p !== this.phase) {
      if (p === 'showing') night.show();
      else if (p === 'turning') night.turn();
      else if (p === 'solved') night.solved();
      else if (p === 'wrong' || p === 'missed') night.wrong();
    }
    this.phase = p;
    this.phaseT = 0;
    if (p === 'drawing') this.drawT0 = performance.now();
  }

  private update(dt: number): void {
    speakLine(this.headline());
    this.phaseT += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    const p = this.plan.puzzle;
    if (this.phase === 'showing' && this.phaseT > p.showMs / 1000) {
      this.setPhase(p.turn || p.mirror ? 'turning' : 'drawing');
    }
    if (this.phase === 'turning' && this.phaseT > TURN_SECONDS) this.setPhase('drawing');
    if (this.phase === 'wrong' && this.phaseT > 1.1) {
      this.drawn = this.drawn.filter(e => !e.wrong);
      this.setPhase('drawing');
    }
    if (this.phase === 'solved' && this.phaseT > 2.4) this.nextRound();
    if (this.phase === 'missed' && this.phaseT > 2.6) this.nextRound();
  }

  private nextRound(): void {
    this.round++;
    if (this.tonight.length > 0 && this.tonight.length % REST_EVERY === 0) {
      this.hand = EMPTY_HAND;
      this.pointer = null;
      this.setPhase('rest');
      night.complete();
      return;
    }
    this.startRound();
  }

  /** One figure's worth of evidence, into the book and into the last handful the engine reads. */
  private remember(correct: boolean): void {
    const a: Attempt = {
      correct,
      ms: Math.max(1, performance.now() - this.drawT0),
      parMs: this.plan.puzzle.parMs,
      hints: this.peeks,
      tries: this.tries + 1,
    };
    this.book = record(record(this.book, 'visualMemory', a), 'pattern', a);
    this.recent = [...this.recent, a].slice(-6);
    save.skills = Object.fromEntries(
      Object.entries(this.book).filter(([, m]) => !!m),
    ) as typeof save.skills;
    persist();
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private starAt(p: Vec): number | null {
    return starAt(p, this.stars, grabRadius(this.u(), this.field().s));
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private has(a: number, b: number): boolean {
    const k = edgeKey(a, b);
    return this.drawn.some(e => edgeKey(e.a, e.b) === k);
  }

  private onDown(e: PointerEvent): void {
    const p = this.at(e);
    const hit = this.hitAt(p);
    unlockAudio();
    if (hit === 'peek' && this.phase === 'drawing') { this.peeks++; night.peek(); this.setPhase('showing'); return; }
    if (hit === 'more' && this.phase === 'rest') { night.tap(); this.startRound(); return; }
    if (this.phase !== 'drawing') return;
    this.pointer = p;
    this.apply(press(this.hand, this.starAt(p), (a, b) => this.has(a, b)));
  }

  private onMove(e: PointerEvent): void {
    if (this.phase !== 'drawing') return;
    const p = this.at(e);
    // the leading point of the line is the finger itself, with nothing smoothing it: a line that
    // arrives a frame late does not feel like a line you are drawing
    if (this.hand.path.length) this.pointer = p;
    if (!this.hand.path.length) return;
    this.apply(move(this.hand, this.starAt(p), (a, b) => this.has(a, b)));
  }

  private onUp(e: PointerEvent): void {
    if (this.hand.path.length) this.apply(move(this.hand, this.starAt(this.at(e)), (a, b) => this.has(a, b)));
    this.hand = lift(this.hand);
    this.pointer = null;
  }

  /** What one step of the finger does to the sky: a line on, a line off, a click, a tick, a pop. */
  private apply(m: ReturnType<typeof move>): void {
    const before = this.hand;
    this.hand = m.hand;
    if (m.event === 'start' && m.a !== undefined) {
      night.hold(); haptic('light'); this.pops.set(m.a, this.t);
      return;
    }
    if (m.a === undefined || m.b === undefined) return;
    if (m.event === 'add') {
      this.drawn.push({ a: m.a, b: m.b, t0: this.t });
      this.pops.set(m.b, this.t);
      night.lock(runLength(before) + this.drawn.length - 1);
      haptic('light');
      if (this.drawn.length >= this.target.size) this.check();
      return;
    }
    if (m.event === 'undo' || m.event === 'remove') {
      const k = edgeKey(m.a, m.b);
      const i = this.drawn.findIndex(d => edgeKey(d.a, d.b) === k);
      if (i >= 0) this.drawn.splice(i, 1);
      night.undo();
      haptic('light');
    }
  }

  private check(): void {
    let bad = 0;
    for (const e of this.drawn) {
      const fa = this.stars[e.a].fig, fb = this.stars[e.b].fig;
      const ok = fa !== null && fb !== null && this.target.has(edgeKey(fa, fb));
      e.wrong = !ok;
      if (!ok) bad++;
    }
    if (bad === 0) {
      this.remember(true);
      const p = this.plan.puzzle;
      this.tonight.push({ name: this.nameOf(p), lore: p.lore });
      if (p.made) this.seenMade.push(p.id);
      this.hand = EMPTY_HAND;
      this.pointer = null;
      // a figure drawn back is a thing played to its end, and the overview counts those
      countFinished();
      this.setPhase('solved');
      return;
    }
    this.remember(false);
    this.tries++;
    this.shake = 1;
    if (this.tries >= TRIES_PER_FIGURE) {
      // two goes is enough; the sky shows what it was rather than letting a child grind at it
      if (this.plan.puzzle.made) this.seenMade.push(this.plan.puzzle.id);
      this.hand = EMPTY_HAND;
      this.pointer = null;
      this.setPhase('missed');
    } else {
      this.setPhase('wrong');
    }
  }

  /** A hand-made figure has a name. A made-up one gets its own counts, which is honest. */
  /**
   * The one line that says what to do now.
   *
   * It was worked out inside the drawing, which meant it could be read and never heard. It is its
   * own method now so that it can be spoken as well, and so the guide in the corner can say it
   * again.
   */
  private headline(): string {
    const p = this.plan.puzzle;
    if (this.phase === 'showing') return t('nwLook');
    if (this.phase === 'turning') return p.mirror ? t('nwMirrors') : t('nwTurns');
    if (this.phase === 'wrong') return t('nwNotQuite');
    if (this.phase === 'solved' || this.phase === 'missed') return this.nameOf(p);
    return t('nwDraw');
  }

  /** The last thing the game said, so the guide in the corner can say it again. */
  spoken(): string { return this.headline(); }

  private nameOf(p: Plan['puzzle']): string {
    if (p.made) return t('nwLook') === 'Kijk goed' ? p.nameNl : p.name;
    return `${p.stars.length} ${t('nwStars')}, ${p.edges.length} ${t('nwLines')}`;
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size)}px Nunito, system-ui, sans-serif`; }

  /**
   * The same words, at the biggest size that still fits the width given.
   *
   * A line of sky lore is a sentence somebody wrote, not a number, and Dutch is longer than English
   * about as often as not. Rather than trust that every one of them is short enough on a 320 pixel
   * phone, each is measured and stepped down until it fits. It leaves the font alone when it
   * already does, which is nearly always.
   */
  private fit(text: string, weight: string, size: number, maxW: number): string {
    let s = size;
    for (let i = 0; i < 14 && s > 8; i++) {
      this.ctx.font = this.font(weight, s);
      if (this.ctx.measureText(text).width <= maxW) break;
      s *= 0.93;
    }
    return this.font(weight, s);
  }

  private applyTurn(ctx: Ctx): void {
    const p = this.plan.puzzle;
    if (!p.turn && !p.mirror) return;
    const f = p.turn % 2 === 1 ? squareOf(this.field()) : this.field();
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    const k = this.phase === 'showing' ? 1
      : this.phase === 'turning' ? 1 - easeInOut(clamp(this.phaseT / TURN_SECONDS, 0, 1)) : 0;
    ctx.translate(cx, cy);
    ctx.rotate(-(p.turn % 4) * (Math.PI / 2) * k);
    if (p.mirror) ctx.scale(lerp(1, -1, k), 1);
    ctx.translate(-cx, -cy);
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    // night sky: graded, with a milky way, far stars and a dark land along the bottom
    paintNightSky(ctx, this.w, this.h, this.t, this.u());
    for (const s of this.bg) {
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(this.t * 0.7 + s.p));
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.hits = [];
    if (this.phase === 'rest') { this.drawRest(); return; }

    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.t * 40) * this.shake * 5, 0);
    ctx.save();
    this.applyTurn(ctx);
    this.drawFigureLines();
    this.drawPlayerLines();
    this.drawStars();
    ctx.restore();
    ctx.restore();
    this.drawChrome();
  }

  /** The figure itself, while the sky is showing it or celebrating it. */
  private drawFigureLines(): void {
    const ctx = this.ctx;
    const p = this.plan.puzzle;
    const showing = this.phase === 'showing' || this.phase === 'turning';
    const told = this.phase === 'solved' || this.phase === 'missed';
    if (!showing && !told) return;
    const secs = p.showMs / 1000;
    // during showing the line draws itself edge by edge, like tracing with a finger
    const per = (secs * 0.74) / p.edges.length;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const u = this.u();
    p.edges.forEach(([ia, ib], i) => {
      const a = this.stars[this.figureStars[ia]], b = this.stars[this.figureStars[ib]];
      let k = 1, fade = 1;
      if (showing) {
        k = clamp((this.phaseT - i * per) / (per * 0.72), 0, 1);
        if (k <= 0) return;
        fade = p.fade === 'oneByOne'
          // one at a time: each line goes out again before the next is finished, so the whole
          // figure is never on the screen at once and has to be assembled in the head
          ? clamp(((i + 1.9) * per - this.phaseT) / (per * 0.75), 0, 1)
          : clamp((secs - this.phaseT) / 0.5, 0, 1);
        if (this.phase === 'turning') fade = 0;
      }
      if (fade <= 0) return;
      const px = lerp(a.x, b.x, k), py = lerp(a.y, b.y, k);
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = this.phase === 'solved' ? '#9df7c4' : this.phase === 'missed' ? '#ffd79a' : '#bcd8ff';
      ctx.lineWidth = (told ? 4 : 3) * Math.min(1.6, u);
      ctx.shadowColor = this.phase === 'solved' ? 'rgba(120,255,190,0.8)' : 'rgba(150,200,255,0.7)';
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(px, py); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  private drawPlayerLines(): void {
    const ctx = this.ctx;
    if (this.phase === 'showing' || this.phase === 'turning') return;
    const u = this.u();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const e of this.drawn) {
      const a = this.stars[e.a], b = this.stars[e.b];
      const grow = clamp((this.t - e.t0) * 14, 0, 1);
      ctx.strokeStyle = e.wrong ? 'rgba(255,120,130,0.95)' : 'rgba(255,238,190,0.92)';
      ctx.lineWidth = 3 * Math.min(1.6, u);
      ctx.shadowColor = e.wrong ? 'rgba(255,90,110,0.7)' : 'rgba(255,220,140,0.6)';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a.x, b.x, grow), lerp(a.y, b.y, grow));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // the line under the finger: straight to the fingertip, this frame, with no easing on it
    if (this.hand.path.length && this.pointer) {
      const a = this.stars[this.hand.path[this.hand.path.length - 1]];
      ctx.strokeStyle = 'rgba(255,238,190,0.6)';
      ctx.lineWidth = 2.6 * Math.min(1.6, u);
      ctx.setLineDash([6 * u, 7 * u]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(this.pointer.x, this.pointer.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawStars(): void {
    const ctx = this.ctx;
    const reveal = this.phase === 'showing' || this.phase === 'turning'
      || this.phase === 'solved' || this.phase === 'missed';
    const head = this.hand.path.length ? this.hand.path[this.hand.path.length - 1] : this.hand.anchor;
    this.stars.forEach((s, i) => {
      const lit = reveal && s.fig !== null;
      const tw = 0.75 + 0.25 * Math.sin(this.t * 1.7 + s.twinkle);
      const r = s.r * (lit ? 1.5 : 1) * tw;
      // A lit star may spread; an unlit one may not. At the top of the dial thirty stars sit a
      // fingertip apart, and a halo five radii wide turned that sky into one milky smear.
      const halo = r * (lit ? 4.6 : 3.4);
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, halo);
      glow.addColorStop(0, lit ? 'rgba(200,240,255,0.85)' : 'rgba(180,210,255,0.4)');
      glow.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(s.x, s.y, halo, 0, TAU); ctx.fill();
      // the pop: a ring thrown off the moment the star locks under the finger
      const pop = this.pops.get(i);
      if (pop !== undefined) {
        const k = (this.t - pop) / 0.36;
        if (k < 1) {
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.strokeStyle = '#ffe9a8';
          ctx.lineWidth = 2.2 * Math.min(1.6, this.u());
          ctx.beginPath(); ctx.arc(s.x, s.y, r + k * 22 * this.u(), 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        } else this.pops.delete(i);
      }
      ctx.fillStyle = head === i ? '#ffe9a8' : '#ffffff';
      ctx.beginPath(); ctx.arc(s.x, s.y, r * (head === i ? 1.35 : 1), 0, TAU); ctx.fill();
    });
  }

  /** Header, the dots for this set of six, and the footer button. */
  private drawChrome(): void {
    const ctx = this.ctx;
    const u = this.u();
    const top = this.headRoom();
    const short = top < 100 * u;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    const p = this.plan.puzzle;
    const turning = this.phase === 'turning';
    const head = this.headline();
    const headSize = short ? 17 * u : 22 * u;
    // The way home and the way back are two round buttons in the top right corner, 46 across with
    // 10 of margin. On a narrow screen a centred heading reaches them, so it starts below them
    // instead; on a wide one it never gets near, and sitting that low would look like a mistake.
    const roomy = this.w >= 560 * u;
    const headY = roomy
      ? Math.max(headSize * 1.1, top * 0.42)
      : Math.max(62 * u + headSize * 0.95, top * 0.55);
    ctx.fillStyle = this.phase === 'solved' ? '#9df7c4' : this.phase === 'missed' ? '#ffd79a' : '#eaf2ff';
    ctx.font = this.fit(head, '900', headSize, this.w - 28 * u);
    ctx.fillText(head, this.w / 2, headY);

    const dotsY = Math.max(top - 7 * u, headY + 16 * u);
    if (dotsY - headY >= 30 * u) {
      const line = (this.phase === 'solved' || this.phase === 'missed') && p.lore
        ? t(p.lore)
        : this.phase === 'drawing' ? t(this.drawn.length ? 'nwConnect' : 'nwSwipe') : '';
      if (line) {
        ctx.fillStyle = 'rgba(220,235,255,0.6)';
        ctx.font = this.fit(line, '700', Math.min(13 * u, this.w / 28), this.w - 32 * u);
        ctx.fillText(line, this.w / 2, headY + 22 * u);
      }
    }

    // the dots for this set of six; the sky does not end at six, it only offers a rest there
    const done = this.tonight.length % REST_EVERY;
    const gap = 16 * u, x0 = this.w / 2 - ((REST_EVERY - 1) * gap) / 2;
    for (let i = 0; i < REST_EVERY; i++) {
      ctx.fillStyle = i < done ? '#9df7c4' : i === done ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, dotsY, (i < done ? 4.5 : 3.5) * u, 0, TAU); ctx.fill();
    }

    if (this.phase === 'drawing') {
      const foot = this.footRoom();
      const bh = Math.min(48 * u, foot * 0.62), bw = Math.min(196 * u, this.w - 60 * u);
      const x = this.w / 2 - bw / 2, y = this.h - foot + (foot - bh) / 2;
      const face = chunkyButton(ctx, x, y, bw, bh, { tone: '#2f4a86' });
      ctx.fillStyle = '#eaf2ff';
      ctx.font = this.fit(t('nwShowAgain'), '900', Math.min(14 * u, bw / 13), bw - 22 * u);
      ctx.textAlign = 'center';
      ctx.fillText(t('nwShowAgain'), this.w / 2, face.y + bh * 0.63);
      this.hits.push({ id: 'peek', x, y, w: bw, h: bh });
    }
  }

  /**
   * A resting place every six figures, and it is a place to rest rather than an end.
   *
   * The old card said the sky was complete, which was true of eight hand-drawn figures and is not
   * true of a sky that goes on making them. So it says what you brought back and offers another.
   */
  private drawRest(): void {
    const ctx = this.ctx;
    const u = this.u();
    const set = this.tonight.slice(-REST_EVERY);
    const cols = this.h < 480 ? 2 : 1;
    const rows = Math.ceil(set.length / cols);
    const lineH = 25 * u;
    const cw = Math.min(this.w - 32 * u, 520 * u);
    const ch = 96 * u + rows * lineH + 60 * u;
    const cx = this.w / 2 - cw / 2, cy = Math.max(58 * u, (this.h - ch) / 2);
    glassPanel(ctx, cx, cy, cw, ch, 22 * u, 0.28);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf2ff';
    ctx.font = this.fit(t('nwRest'), '900', Math.min(24 * u, cw / 11), cw - 28 * u);
    ctx.fillText(t('nwRest'), this.w / 2, cy + 38 * u);
    ctx.fillStyle = 'rgba(220,235,255,0.72)';
    ctx.font = this.fit(t('nwRestLine'), '700', Math.min(13 * u, cw / 26), cw - 28 * u);
    ctx.fillText(t('nwRestLine'), this.w / 2, cy + 62 * u);

    const nameW = (cols === 1 ? cw : cw / 2) - 24 * u;
    set.forEach((s, i) => {
      const col = cols === 1 ? 0 : i % cols;
      const row = cols === 1 ? i : Math.floor(i / cols);
      const x = cols === 1 ? this.w / 2 : cx + cw * (col === 0 ? 0.27 : 0.73);
      ctx.fillStyle = '#9df7c4';
      ctx.font = this.fit(s.name, '800', Math.min(15 * u, cw / (cols * 16)), nameW);
      ctx.fillText(s.name, x, cy + 90 * u + row * lineH);
    });

    const bh = Math.min(48 * u, this.h * 0.11), bw = Math.min(200 * u, cw - 40 * u);
    const bx = this.w / 2 - bw / 2, by = cy + ch - bh - 16 * u;
    const face = chunkyButton(ctx, bx, by, bw, bh, { tone: '#2f4a86' });
    ctx.fillStyle = '#eaf2ff';
    ctx.font = this.fit(t('nwMore'), '900', Math.min(15 * u, bw / 12), bw - 22 * u);
    ctx.fillText(t('nwMore'), this.w / 2, face.y + bh * 0.63);
    this.hits.push({ id: 'more', x: bx, y: by, w: bw, h: bh });
  }
}
