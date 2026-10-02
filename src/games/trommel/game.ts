/**
 * Trommelkring - the rhythm game in Suri.
 *
 * A campfire circle at dusk. Suri sits with a drum and plays a short rhythm: you see his paws hit
 * and hear it, a low "boem" and a high "tik", with the skin lighting on each hit. Then it is the
 * child's turn, on a big drum that fills the lower screen, the left half low and the right half
 * high. For two and three there is one drum and one sound, and Suri simply plays along with
 * whatever the child does; nothing is asked and nothing can go wrong (`src/platform/who.ts`).
 *
 * It practises listening to a short rhythm and playing it back, on the screen. It does not claim
 * to teach rhythm: nobody has measured that. The rules and the scoring are in `model.ts`.
 *
 * Two things that are on purpose. The beat is a dot that pulses, never a countdown: nothing here
 * runs out. And time is counted from the child's own first hit, so starting late costs nothing;
 * the dot then follows the child's hand rather than the other way round.
 */

import { clamp, TAU } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, recordLevelResult } from '../../util/storage';
import {
  beatSeconds, FREE_HITS, hasRest, judge, LEVELS, makePatterns, PATTERNS_PER_LEVEL, roundCredit, score, spanBeats, starsFor, toBeats,
  type Level, type Note, type Side, type Verdict,
} from './model';
import { trommelSfx } from './trommelsfx';
import {
  bleedEdges, chunkyButton, drawStar as drawStarGem, easeOutBack, glassPanel, heading, Particles, vignette,
} from '../../render/look';
import { paintDrum, paintDusk, paintFire, paintMoon, paintSuriDrum, SIDE_L, SIDE_R } from './paint';
import { NL, T } from '../../util/lang';
import { forgetLine, speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';
import { feel } from '../../platform/feel';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'listen' | 'turn' | 'between' | 'won' | 'free';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `trommel:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }

/**
 * Product decisions about pacing, in seconds. Suri says "Luister." and gets a moment of quiet
 * before the first hit; a child who has hit and then stopped is judged after IDLE so a pattern
 * with a missing hit is not left hanging, and it never shows as a clock.
 */
const LEAD_FIRST = 1.4;
const LEAD_AGAIN = 0.8;
const IDLE = 2.6;
const JUDGE_AFTER_LAST = 0.55;

interface Lay {
  u: number; cx: number; cy: number; rx: number; ry: number; depth: number;
  wide: boolean; slotsY: number; ground: number; suri: number; suriX: number; fireX: number; horizon: number;
}

export class Trommel {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private fullW = 0;
  private st = 0;
  private sb = 0;
  private sl = 0;
  private sr = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private phaseT = 0;
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private attempt = 0;
  private patterns: Note[][] = [];
  private round = 0;
  private tries = 1;
  private pattern: Note[] = [];
  private credit = 0;
  private goodRounds = 0;
  private earned = 0;

  // listening
  private noteIdx = 0;
  private lit: boolean[] = [];
  private lead = LEAD_FIRST;
  // the child's turn
  private hitsIn: Note[] = [];
  private times: number[] = [];
  private lastHitT = 0;
  private judgeAt: number | null = null;
  private lastScore = 0;
  private lastVerdict: Verdict | null = null;
  private betweenLen = 2;
  private metroOrigin = 0;
  // the simple shape
  private freeHits = 0;
  private alt: Side = 'L';

  // what is moving
  private pawL = 0;
  private pawR = 0;
  private suriFlashL = 0;
  private suriFlashR = 0;
  private flashL = 0;
  private flashR = 0;
  private cardPop = 0;
  private note = '';
  private noteT = 0;
  private noteSecs = 1;
  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private lay0: Lay | null = null;
  private easy = simpleNow();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointerup', () => { this.held0 = null; });
    canvas.addEventListener('pointercancel', () => { this.held0 = null; });
    (window as unknown as { __trommel?: Trommel }).__trommel = this;
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
    if (this.easy) this.startFree();
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  canBack(): boolean { return this.phase !== 'levels' && !this.easy; }
  back(): void { if (!this.easy) this.phase = 'levels'; }

  /** The last thing Suri said, so the guide button can say it again. */
  spoken(): string { return this.note; }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, easy: this.easy, level: this.level.id, round: this.round, tries: this.tries,
      pattern: this.pattern, beatSec: beatSeconds(this.level.bpm), tolerance: this.level.tolerance,
      hits: this.hitsIn.length, lastScore: this.lastScore, lastVerdict: this.lastVerdict,
      credit: this.credit, goodRounds: this.goodRounds, earned: this.earned, freeHits: this.freeHits,
      note: this.note, w: this.w, h: this.h,
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
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

  /**
   * The big drum sits at the bottom with the whole width, an ellipse so its corners leave the
   * bottom-left free for the guide button. Everything above it is arranged from where it starts.
   */
  private layout(): Lay {
    const u = this.u(), w = this.w, h = this.h;
    const rx = w * 0.46;
    const wide = w > h;
    const ry = Math.min(h * (wide ? 0.15 : 0.2), rx * 0.62);
    const depth = ry * 0.35;
    const cy = h - 10 * u - depth - ry;
    const cx = w / 2;
    const slotsY = cy - ry - 30 * u;
    const ground = slotsY - 14 * u;
    // on its side the chrome sits in the middle strip and Suri stands to the right of it
    const top = this.easy ? 70 * u : wide ? 30 * u : 156 * u;
    const suri = clamp(Math.min(ground - top, w * 0.5, 210 * u), 60, 400);
    return {
      u, wide, cx, cy, rx, ry, depth, slotsY, ground, suri,
      suriX: w * (wide ? 0.72 : 0.68), fireX: w * (wide ? 0.26 : 0.24), horizon: ground - suri * 0.16,
    };
  }

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  // ---------- flow ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private say(text: string, secs = 3): void {
    this.note = text;
    this.noteT = secs;
    this.noteSecs = secs;
    // the same line twice in a row would be swallowed by speakLine; a round starts "Luister." every time
    forgetLine();
    speakLine(text);
  }

  private startLevel(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.patterns = makePatterns(this.level.id, this.attempt++);
    this.round = 0; this.tries = 1; this.credit = 0; this.goodRounds = 0; this.earned = 0;
    this.lastVerdict = null; this.lastScore = 0;
    this.ps.clear();
    this.cardPop = 0;
    this.beginListen(true);
  }

  private startFree(): void {
    this.phase = 'free'; this.phaseT = 0;
    this.freeHits = 0; this.earned = 0;
    this.ps.clear();
    this.cardPop = 0;
    this.say(T('Drum along. I will play with you.', 'Trommel maar mee. Ik speel met je mee.'), 5);
  }

  private beginListen(speak: boolean): void {
    this.pattern = this.patterns[this.round];
    this.phase = 'listen'; this.phaseT = 0;
    this.noteIdx = 0;
    this.lit = this.pattern.map(() => false);
    this.hitsIn = []; this.times = []; this.judgeAt = null;
    this.lead = speak ? LEAD_FIRST : LEAD_AGAIN;
    this.metroOrigin = this.t + this.lead;
    if (speak) this.say(T('Listen.', 'Luister.'), 2);
  }

  private beginTurn(): void {
    this.phase = 'turn'; this.phaseT = 0;
    this.hitsIn = []; this.times = []; this.judgeAt = null;
    this.metroOrigin = this.t;
    this.say(T('Your turn.', 'Nu jij.'), 60);
  }

  private soft(): void {
    trommelSfx.tap();
    setTimeout(() => trommelSfx.tap(), 160);
  }

  private finishTurn(): void {
    const bpm = this.level.bpm;
    const beats = toBeats(this.times, bpm);
    const played: Note[] = this.hitsIn.map((n, i) => ({ beat: beats[i], side: n.side }));
    this.lastScore = score(this.pattern, played, this.level.tolerance);
    const v = judge(this.lastScore);
    this.lastVerdict = v;
    this.phase = 'between'; this.phaseT = 0;
    if (v === 'goed') {
      this.say(T('Well done.', 'Goed zo.'), 2);
      trommelSfx.right();
      this.betweenLen = 1.8;
      this.ps.spawn('spark', this.lay0 ? this.lay0.suriX : this.w / 2, this.lay0 ? this.lay0.ground - this.lay0.suri * 0.6 : 100, 16,
        { colour: '#ffe08a', speed: 150, size: 6 * this.u(), max: 0.9, spread: TAU });
    } else if (this.tries === 1) {
      this.say(v === 'bijna' ? T('Almost. Listen once more.', 'Bijna. Nog een keer luisteren.') : T('Listen once more.', 'Nog een keer luisteren.'), 3);
      this.soft();
      this.betweenLen = 2.8;
    } else {
      this.say(T('Nice try. On we go.', 'Mooi geprobeerd. We gaan door.'), 2.5);
      this.soft();
      this.betweenLen = 2.6;
    }
  }

  private advance(): void {
    const v = this.lastVerdict ?? 'nog een keer';
    if (v !== 'goed' && this.tries === 1) { this.tries = 2; this.beginListen(false); return; }
    this.credit += roundCredit(v, this.tries);
    if (v === 'goed') this.goodRounds++;
    this.round++; this.tries = 1;
    if (this.round >= PATTERNS_PER_LEVEL) { this.finishLevel(); return; }
    this.beginListen(true);
  }

  private finishLevel(): void {
    this.earned = starsFor(this.credit);
    // every circle played to its end is completed: a hard one is not a failed one
    recordLevelResult(saveKey(this.level), this.goodRounds, this.earned, true);
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    trommelSfx.complete();
    this.say(T('All done. That was lovely drumming.', 'Klaar. Dat was mooi getrommeld.'), 4);
  }

  // ---------- suri and the drum ----------

  private suriHit(side: Side, sound: boolean): void {
    if (side === 'L') { this.pawL = 1; this.suriFlashL = 1; } else { this.pawR = 1; this.suriFlashR = 1; }
    if (sound) (side === 'L' ? trommelSfx.boem : trommelSfx.tik)();
    const l = this.lay0;
    if (l) {
      const x = l.suriX + (side === 'L' ? -1 : 1) * l.suri * 0.2, y = l.ground - l.suri * 0.27;
      this.ps.spawn('spark', x, y, 6, { colour: side === 'L' ? '#ffb347' : '#fff0b0', speed: 90, size: 4 * l.u, max: 0.5, spread: 2.2 });
    }
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.pawL = Math.max(0, this.pawL - dt * 5);
    this.pawR = Math.max(0, this.pawR - dt * 5);
    this.suriFlashL = Math.max(0, this.suriFlashL - dt * 4);
    this.suriFlashR = Math.max(0, this.suriFlashR - dt * 4);
    this.flashL = Math.max(0, this.flashL - dt * 4);
    this.flashR = Math.max(0, this.flashR - dt * 4);
    // embers off the fire
    const l = this.lay0;
    if (l && this.phase !== 'levels' && Math.random() < dt * 7) {
      this.ps.spawn('spark', l.fireX + (Math.random() - 0.5) * l.suri * 0.3, l.ground - l.suri * 0.5, 1,
        { colour: '#ffb347', speed: 40, size: 3 * l.u, max: 1.6, spread: 0.7, grav: -26 });
    }

    const bs = beatSeconds(this.level.bpm);
    if (this.phase === 'listen') {
      while (this.noteIdx < this.pattern.length && this.phaseT >= this.lead + this.pattern[this.noteIdx].beat * bs) {
        const n = this.pattern[this.noteIdx];
        this.lit[this.noteIdx] = true;
        this.suriHit(n.side, true);
        this.noteIdx++;
      }
      if (this.noteIdx >= this.pattern.length && this.phaseT >= this.lead + (spanBeats(this.pattern) + 1.3) * bs) this.beginTurn();
    } else if (this.phase === 'turn') {
      if (this.judgeAt !== null && this.phaseT >= this.judgeAt) this.finishTurn();
      else if (this.hitsIn.length > 0 && this.t - this.lastHitT > IDLE) this.finishTurn();
    } else if (this.phase === 'between') {
      if (this.phaseT >= this.betweenLen) this.advance();
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: { x: number; y: number }): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (!hit) return;
    this.held0 = hit;
    if (hit.startsWith('drum')) { this.onDrum(hit === 'drum:R' ? 'R' : 'L', hit === 'drum', e.timeStamp / 1000, p); return; }
    if (hit.startsWith('level:')) { const i = Number(hit.slice(6)); if (this.unlocked(i)) this.startLevel(i); else this.soft(); }
    else if (hit === 'levels') { this.phase = 'levels'; trommelSfx.tap(); }
    else if (hit === 'retry') { if (this.easy) this.startFree(); else this.startLevel(this.levelIndex); }
    else if (hit === 'next') this.startLevel(Math.min(LEVELS.length - 1, this.levelIndex + 1));
    else if (hit === 'again') { trommelSfx.tap(); this.beginListen(true); }
  }

  private onDrum(side: Side, single: boolean, ts: number, p: { x: number; y: number }): void {
    if (single) {
      // the simple shape: one drum, one sound, and Suri's paws take turns
      if (this.phase !== 'free') return;
      trommelSfx.boem();
      feel('medium');
      this.flashL = 1; this.flashR = 1;
      this.sparks(p, '#ffb347');
      this.alt = this.alt === 'L' ? 'R' : 'L';
      this.suriHit(this.alt, false);
      if (++this.freeHits >= FREE_HITS) this.endFree();
      return;
    }
    if (this.phase !== 'turn') return;
    if (this.hitsIn.length === 0) this.metroOrigin = ts;
    this.hitsIn.push({ beat: 0, side });
    this.times.push(ts);
    this.lastHitT = ts;
    (side === 'L' ? trommelSfx.boem : trommelSfx.tik)();
    feel('medium');
    if (side === 'L') this.flashL = 1; else this.flashR = 1;
    this.sparks(p, side === 'L' ? '#ffb347' : '#fff0b0');
    if (this.hitsIn.length >= this.pattern.length && this.judgeAt === null) this.judgeAt = this.phaseT + JUDGE_AFTER_LAST;
  }

  private endFree(): void {
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    // nothing is written down in the simple shape: no stars, no result
    trommelSfx.complete();
    this.say(T('All done. That was lovely drumming.', 'Klaar. Dat was mooi getrommeld.'), 4);
  }

  private sparks(p: { x: number; y: number }, colour: string): void {
    this.ps.spawn('spark', p.x, p.y, 9, { colour, speed: 150, size: 5 * this.u(), max: 0.6, spread: 2.6 });
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }
    const L = this.layout();
    this.lay0 = L;
    const u = L.u;

    paintDusk(ctx, this.w, this.h, L.horizon, this.t);
    paintMoon(ctx, this.w * 0.2, Math.max(96 * u, L.horizon * 0.34), 15 * u);
    paintFire(ctx, L.fireX, L.ground, L.suri * 0.85, this.t);
    const saying = this.noteT > 0 ? clamp(1 - this.noteT / Math.max(0.1, this.noteSecs), 0, 1) : 0;
    paintSuriDrum(ctx, L.suriX, L.ground, L.suri, {
      t: this.t, pawL: this.pawL, pawR: this.pawR, flashL: this.suriFlashL, flashR: this.suriFlashR,
      single: this.easy, saying: this.phase === 'listen' ? 0 : saying,
    });
    if (!this.easy && this.phase !== 'won') this.drawSlots(L);

    const active = this.phase === 'turn' || this.phase === 'free';
    paintDrum(ctx, L.cx, L.cy, L.rx, L.ry, L.depth, {
      flashL: this.flashL, flashR: this.flashR, single: this.easy, dim: active ? 0 : 0.35,
      labels: this.easy ? undefined : [T('boom', 'boem'), T('tick', 'tik')], labelFont: this.font('900', 18),
    });
    this.ps.draw(ctx);
    vignette(ctx, this.w, this.h, 0.2, '10, 8, 30');

    if (active) {
      const top = L.cy - L.ry, bottom = L.cy + L.ry + L.depth;
      if (this.easy) this.hits.push({ id: 'drum', x: L.cx - L.rx, y: top, w: L.rx * 2, h: bottom - top });
      else {
        this.hits.push({ id: 'drum:L', x: L.cx - L.rx, y: top, w: L.rx, h: bottom - top });
        this.hits.push({ id: 'drum:R', x: L.cx, y: top, w: L.rx, h: bottom - top });
      }
    }
    this.drawChrome(L);
    if (this.phase === 'won') this.drawEnd();
  }

  /** The pattern as a row of places, one per beat: lit as Suri plays them, filled as the child does. */
  private drawSlots(L: Lay): void {
    const ctx = this.ctx, u = L.u;
    const span = spanBeats(this.pattern);
    const sp = Math.min(60 * u, (this.w - 48 * u) / (span + 1));
    const x0 = this.w / 2 - span * sp / 2, y = L.slotsY;
    const have = new Set(this.pattern.map(n => n.beat));
    for (let b = 0; b <= span; b++) {
      if (have.has(b)) continue;
      ctx.fillStyle = 'rgba(255,240,210,0.4)';
      ctx.beginPath(); ctx.arc(x0 + b * sp, y, 3.5 * u, 0, TAU); ctx.fill();
      if (hasRest(this.pattern)) {
        ctx.font = this.font('800', 11); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,210,0.85)';
        ctx.fillText(T('rest', 'stilte'), x0 + b * sp, y + 26 * u);
      }
    }
    this.pattern.forEach((n, i) => {
      const x = x0 + n.beat * sp;
      let fill: Side | null = null;
      if (this.phase === 'listen' || this.phase === 'between') fill = (this.lit[i] || this.phase === 'between') ? n.side : null;
      if (this.phase === 'turn') fill = this.hitsIn[i] ? this.hitsIn[i].side : null;
      const r = 15 * u;
      ctx.lineWidth = 3 * u;
      if (fill) {
        ctx.fillStyle = fill === 'L' ? SIDE_L : SIDE_R;
        ctx.beginPath(); ctx.arc(x, y, fill === 'L' ? r : r * 0.74, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,240,210,0.7)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      }
    });
  }

  private drawChrome(L: Lay): void {
    const ctx = this.ctx, u = L.u;
    // the beat: a dot that pulses, and nothing that counts down
    if (!this.easy && this.phase !== 'won') {
      const bs = beatSeconds(this.level.bpm);
      const live = (this.phase === 'listen' || this.phase === 'turn') && this.t >= this.metroOrigin;
      const ph = live ? (((this.t - this.metroOrigin) / bs) % 1 + 1) % 1 : 1;
      const pulse = Math.exp(-ph * 5);
      const cx = this.w / 2, cy = (L.wide ? 34 : 82) * u;
      ctx.fillStyle = `rgba(255,214,120,${0.15 + 0.35 * pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, (13 + 12 * pulse) * u, 0, TAU); ctx.fill();
      ctx.fillStyle = live ? '#ffd25a' : 'rgba(255,214,120,0.55)';
      ctx.beginPath(); ctx.arc(cx, cy, (9 + 4 * pulse) * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(cx, cy, 9 * u, 0, TAU); ctx.stroke();
      // how far through the circle: eight small drops, filled as rounds are played
      for (let i = 0; i < PATTERNS_PER_LEVEL; i++) {
        const x = this.w / 2 + (i - (PATTERNS_PER_LEVEL - 1) / 2) * 15 * u;
        ctx.fillStyle = i < this.round ? '#ffd25a' : 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.arc(x, (L.wide ? 60 : 108) * u, 4.5 * u, 0, TAU); ctx.fill();
      }
    }
    if (this.noteT > 0 && this.phase !== 'won') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 13);
      const lim = Math.min(this.w - 32 * u, 300 * u);
      const tw = Math.min(lim, ctx.measureText(this.note).width + 32 * u);
      const ny = this.easy ? 64 * u : (L.wide ? 76 : 122) * u;
      glassPanel(ctx, this.w / 2 - tw / 2, ny, tw, 30 * u, 15 * u, 0.93);
      ctx.fillStyle = '#123047'; ctx.textAlign = 'center';
      ctx.fillText(this.note, this.w / 2, ny + 20 * u, tw - 22 * u);
      ctx.restore();
    }
    if (this.phase === 'turn' && !this.easy) {
      this.button('again', T('Listen', 'Luister'), this.w / 2 + (L.wide ? 44 : -50) * u, 12 * u, 100 * u, 40 * u);
    }
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fdfbf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 40 * this.u() ? 15 : 13);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 18);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(14, 10, 36, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = Math.min(272 * u, this.h - 24 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    const compact = ch < 250 * u;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2); ctx.scale(pop, pop); ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, '#f0b27a'); band.addColorStop(1, 'rgba(240,178,122,0)');
    ctx.fillStyle = band; ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, this.easy ? T('That was lovely drumming', 'Wat een mooi getrommel') : T('All drummed', 'Klaar met trommelen'),
      this.w / 2, y + (compact ? 38 : 50) * u, this.font('900', 20), '#123047');
    if (!this.easy) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + (compact ? 76 : 104) * u, (compact ? 15 : 18) * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    const line = this.easy
      ? T('Suri played along.', 'Suri speelde mee.')
      : `${T('right', 'goed')} ${this.goodRounds} ${T('of', 'van')} ${PATTERNS_PER_LEVEL}`;
    ctx.fillText(line, this.w / 2, y + (this.easy ? 108 : compact ? 112 : 146) * u, cw - 40 * u);
    ctx.restore();
    const bw = 138 * u, bh = 46 * u, by = y + ch - (compact ? 62 : 78) * u;
    if (this.easy) { this.button('retry', T('One more', 'Nog een keer'), this.w / 2 - bw / 2, by, bw, bh, '#4fae6e', '#ffffff'); return; }
    this.button('retry', T('Again', 'Nog een keer'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next', 'Volgende'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All circles', 'Alle kringen'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#171a49'); bg.addColorStop(0.55, '#4f3a7c'); bg.addColorStop(1, '#c9694f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    heading(ctx, 'Trommelkring', this.w / 2, 60 * u, this.font('900', 26), '#fff4dc');
    ctx.fillStyle = 'rgba(255,244,220,0.8)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Listen to Suri, then drum it back.', 'Luister naar Suri en trommel het na.'), this.w / 2, 84 * u);

    const cols = this.w > 640 * u ? 5 : 2;
    const pad = 12 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.56;
    const chh = art + 62 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 104 * u;
    const rows = Math.ceil(LEVELS.length / cols);
    const needed = rows * chh + (rows - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 20 * u) / needed);

    ctx.save();
    if (squeeze < 1) { ctx.translate(this.w / 2, listTop); ctx.scale(squeeze, squeeze); ctx.translate(-this.w / 2, -listTop); }
    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.05, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2); ctx.scale(appear, appear); ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(10,6,30,0.4)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fff8ee';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();

      // a little scene: the drum, with this level's first pattern above it
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u); ctx.clip();
      const sky = ctx.createLinearGradient(0, y, 0, y + art);
      sky.addColorStop(0, '#24235a'); sky.addColorStop(1, '#a8566a');
      ctx.fillStyle = sky; ctx.fillRect(x, y, cw, art + 12 * u);
      const pat = makePatterns(L.id, 0)[0];
      const sp = Math.min(26 * u, (cw - 40 * u) / 4);
      const span = spanBeats(pat);
      pat.forEach(n => {
        ctx.fillStyle = n.side === 'L' ? SIDE_L : SIDE_R;
        ctx.beginPath(); ctx.arc(x + cw / 2 + (n.beat - span / 2) * sp, y + art * 0.3, n.side === 'L' ? 8 * u : 6 * u, 0, TAU); ctx.fill();
      });
      paintDrum(ctx, x + cw / 2, y + art * 0.68, cw * 0.3, art * 0.15, art * 0.1, { flashL: 0, flashR: 0 });
      if (!open) { ctx.fillStyle = 'rgba(228, 226, 240, 0.84)'; ctx.fillRect(x, y, cw, art + 12 * u); }
      ctx.restore();

      ctx.fillStyle = 'rgba(30,20,60,0.6)';
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = this.font('900', 12); ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#2a1f4a' : 'rgba(42,31,74,0.68)';
      ctx.font = this.font('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 28 * u, cw - 28 * u);
      for (let s = 0; s < 3; s++) drawStarGem(ctx, x + 22 * u + s * 20 * u, y + art + 46 * u, 8 * u, s < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(42,31,74,0.55)'; ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.hits.push({ id: `level:${i}`, x: this.w / 2 + (x - this.w / 2) * squeeze, y: listTop + (y - listTop) * squeeze, w: cw * squeeze, h: chh * squeeze });
    });
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
