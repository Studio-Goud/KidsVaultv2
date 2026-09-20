/**
 * Millstream - the water game in Bramblewood.
 *
 * A spring at the top of a valley. Fields that need watering, wheels that need turning, houses
 * that must stay dry, and the sea at the bottom eating anything you let past. You never touch the
 * water. You dig, and you bank, and the water goes where downhill now is.
 *
 * It practises spatial reasoning and planning ahead: reading which way the land falls, working out
 * where a fork has to be to reach two places, and the hard lesson that water you have let run down
 * can never be brought back up.
 *
 * The valley fills the screen edge to edge and the interface floats over it, because a game that
 * sits in a box in the middle of a phone looks like a form to fill in. Everything is drawn with
 * canvas paths and every sound is synthesised. No advertising, no tracking.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, breathe, chunkyButton, contactShadow, drawStar, easeOutBack, easeOutCubic,
  glassPanel, handCursor, heading, hexA, outlinedText, Particles, progressRing, Shake, vignette,
} from '../../render/look';
import { mill, Stream } from './millsfx';
import { levelThumb, paintHorizon, ValleyArt, type Grid } from './paint';
import {
  bankAt, buildValley, digAt, fieldDone, gridForAspect, houseFlooded, LEVELS, starsFor, stepWater,
  totalWater, wheelDone, type Level, type Valley,
} from './world';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won' | 'failed';
type Tool = 'dig' | 'bank';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `mill:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }

export class Millstream {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  /** the safe height: the screen less the notch and the home bar */
  private h = 0;
  /** the whole screen, for the art that runs under them */
  private fullH = 0;
  private st = 0;
  private sb = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private phaseT = 0;
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private size = { cols: 44, rows: 62 };
  private valley: Valley = buildValley(LEVELS[0]);
  private art: ValleyArt | null = null;
  private scratch = new Float32Array(this.valley.water.length);
  private tool: Tool = 'dig';
  private spade = 0;
  private springLeft = 0;
  private wasted = 0;
  private moving = 0;
  private wheelAngle: number[] = [];
  private wheelSpeed: number[] = [];
  private wheelLastCreak: number[] = [];
  private done = { fields: [] as boolean[], wheels: [] as boolean[] };
  private failWhy = '';
  private earned = 0;
  private digging = false;
  private lastCell = { x: -99, y: -99 };
  private note = '';
  private noteT = 0;
  private settleT = 0;
  private dryFor = 0;
  private hits: Hit[] = [];
  private held: string | null = null;
  private stream = new Stream();
  private ps = new Particles();
  private shake = new Shake();
  /** how long the player has gone without digging, which brings the pointing hand back */
  private idle = 0;
  private cardPop = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    this.reshape();
    window.addEventListener('resize', () => { this.resize(); if (this.phase === 'levels') this.reshape(); });
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => { this.digging = false; this.held = null; });
    canvas.addEventListener('pointercancel', () => { this.digging = false; this.held = null; });
    (window as unknown as { __mill?: Millstream }).__mill = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void { cancelAnimationFrame(this.raf); this.stream.stop(); }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, level: this.level.id, spade: Math.round(this.spade), springLeft: Math.round(this.springLeft),
      filled: this.valley.filled.map(x => Math.round(x)), turned: this.valley.turned.map(x => Math.round(x * 10) / 10),
      wet: this.valley.wet.map(x => Math.round(x * 100) / 100), wasted: Math.round(this.wasted),
      water: Math.round(totalWater(this.valley) * 10) / 10, tool: this.tool,
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
      grid: this.grid(),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    // The picture fills the screen, but nothing a child reads or presses may sit under the notch
    // or the home bar. So w and h are the safe box, the canvas is the whole screen, and draw()
    // shifts everything down by the top inset and carries the art on into the strips.
    const safe = safeArea();
    this.st = safe.top;
    this.sb = safe.bottom;
    this.fullH = Math.max(1, window.innerHeight);
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  /** How much sky sits above the valley, which is also where the interface lives. */
  private topInset(): number { return 92 * this.u(); }

  /** Give the valley the shape of the window, so it can fill it without a letterbox. */
  private reshape(): void {
    const next = gridForAspect(this.w / Math.max(80, this.h - this.topInset()));
    if (next.cols === this.size.cols && next.rows === this.size.rows && this.art) return;
    this.size = next;
    this.valley = buildValley(this.level, this.size);
    this.scratch = new Float32Array(this.valley.water.length);
    this.art = new ValleyArt(this.valley, this.level.seed);
  }

  /** The valley fills everything below the band of sky; nothing is framed by empty background. */
  private grid(): Grid {
    const inset = this.topInset();
    const cell = Math.max(this.w / this.valley.cols, (this.h - inset) / this.valley.rows);
    const w = cell * this.valley.cols, h = cell * this.valley.rows;
    return { x: (this.w - w) / 2, y: inset, cell, w, h };
  }

  // ---------- levels ----------

  private unlocked(i: number): boolean {
    return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed;
  }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.size = gridForAspect(this.w / Math.max(80, this.h - this.topInset()));
    this.valley = buildValley(this.level, this.size);
    this.art = new ValleyArt(this.valley, this.level.seed);
    this.scratch = new Float32Array(this.valley.water.length);
    this.spade = this.level.spade;
    this.springLeft = this.level.springFor;
    this.wasted = 0;
    this.moving = 0;
    this.tool = 'dig';
    this.wheelAngle = this.level.wheels.map(() => 0);
    this.wheelSpeed = this.level.wheels.map(() => 0);
    this.wheelLastCreak = this.level.wheels.map(() => 0);
    this.done = { fields: this.level.fields.map(() => false), wheels: this.level.wheels.map(() => false) };
    this.settleT = 0;
    this.dryFor = 0;
    this.earned = 0;
    this.idle = 0;
    this.ps.clear();
    this.phase = 'play'; this.phaseT = 0;
    this.say(NL() ? this.level.hintNl : this.level.hint, 6);
    mill.spring();
  }

  private say(text: string, secs = 4): void { this.note = text; this.noteT = secs; }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    if (this.phase !== 'play') { this.stream.update(0); return; }
    this.idle += dt;

    const v = this.valley, L = this.level;

    // the spring
    if (this.springLeft > 0) {
      this.springLeft = Math.max(0, this.springLeft - dt);
      for (const [sx, sy] of L.springs) {
        const cx = Math.round(sx * (v.cols - 1)), cy = Math.round(sy * (v.rows - 1));
        v.water[cy * v.cols + cx] += L.springRate * dt;
      }
      if (this.springLeft === 0) { mill.dry(); this.say(T('The spring has run dry.', 'De bron is opgedroogd.')); }
    }

    // the water, in three sub steps for smoothness
    let movedTotal = 0;
    const before = totalWater(v);
    for (let k = 0; k < 3; k++) {
      const r = stepWater(v, dt / 3, this.scratch);
      this.wasted += r.wasted;
      r.wheelFlow.forEach((f, i) => {
        // a wheel turns when enough passes through, and only then does the clock run
        const spin = clamp(f * 60, 0, 1);
        this.wheelSpeed[i] += (spin - this.wheelSpeed[i]) * 0.15;
        if (spin > 0.28) v.turned[i] += dt / 3;
        movedTotal += f;
      });
    }
    const after = totalWater(v);
    this.moving = clamp(Math.abs(before - after) * 6 + movedTotal * 40 + (this.springLeft > 0 ? 0.12 : 0), 0, 1);
    this.stream.update(this.moving);

    this.wheelAngle = this.wheelAngle.map((a, i) => {
      const next = a + this.wheelSpeed[i] * dt * 4;
      if (Math.floor(next / TAU) > Math.floor(a / TAU) && this.wheelSpeed[i] > 0.3) {
        if (this.t - this.wheelLastCreak[i] > 0.6) { mill.creak(); this.wheelLastCreak[i] = this.t; }
      }
      return next;
    });

    // goals
    L.fields.forEach((f, i) => {
      if (!this.done.fields[i] && fieldDone(v, L, i)) {
        this.done.fields[i] = true;
        mill.fieldFull();
        this.burst(f.x, f.y, '#ffe07a');
        this.say(T('That field has had enough.', 'Die akker heeft genoeg gehad.'), 2.5);
      }
    });
    L.wheels.forEach((wh, i) => {
      if (!this.done.wheels[i] && wheelDone(v, L, i)) {
        this.done.wheels[i] = true;
        mill.wheelDone();
        this.burst(wh.x, wh.y, '#c9f0ff');
        this.say(T('The wheel has done its work.', 'Het rad heeft zijn werk gedaan.'), 2.5);
      }
    });
    for (let i = 0; i < L.houses.length; i++) {
      if (houseFlooded(v, i)) { this.fail(T('A house flooded.', 'Een huis is ondergelopen.')); mill.flood(); this.shake.add(0.8); return; }
    }
    const allDone = this.done.fields.every(Boolean) && this.done.wheels.every(Boolean);
    if (allDone) { this.win(); return; }

    // after the spring stops, give the water a moment to settle, then call it. A trickle can go on
    // for a long time, so there is also a hard limit: fourteen seconds after the spring, it is over.
    if (this.springLeft === 0) {
      this.dryFor += dt;
      this.settleT = this.moving < 0.04 ? this.settleT + dt : 0;
      if (this.settleT > 2.2 || (after < 0.3 && this.settleT > 0.6) || this.dryFor > 14) {
        this.fail(T('The water ran out before everything was done.', 'Het water was op voordat alles klaar was.'));
      }
    }
  }

  /** A shower of light where something has just come good. */
  private burst(fx: number, fy: number, colour: string): void {
    const g = this.grid(), v = this.valley;
    const x = g.x + (Math.round(fx * (v.cols - 1)) + 0.5) * g.cell;
    const y = g.y + (Math.round(fy * (v.rows - 1)) + 0.5) * g.cell;
    this.ps.spawn('spark', x, y, 16, { colour, speed: 180, size: g.cell * 1.1, max: 0.9, spread: TAU });
    this.ps.spawn('ring', x, y, 1, { colour, size: g.cell * 3, max: 0.7 });
  }

  private win(): void {
    this.earned = starsFor(this.level, this.spade, this.wasted, true);
    recordLevelResult(saveKey(this.level), 1, this.earned, true);
    save.coins = Math.max(0, Math.round(save.coins + 25 + this.earned * 15)); persist();
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    mill.complete();
  }

  private fail(why: string): void {
    this.failWhy = why;
    this.phase = 'failed'; this.phaseT = 0; this.cardPop = 0;
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.held = hit; this.onHit(hit); return; }
    if (this.phase !== 'play') return;
    this.digging = true;
    this.idle = 0;
    this.lastCell = { x: -99, y: -99 };
    this.stroke(p);
  }

  private onMove(e: PointerEvent): void {
    if (!this.digging || this.phase !== 'play') return;
    this.stroke(this.at(e));
  }

  private onHit(id: string): void {
    if (id.startsWith('level:')) { const i = Number(id.slice(6)); if (this.unlocked(i)) { this.start(i); mill.tap(); } else mill.blocked(); return; }
    if (id === 'levels') { this.phase = 'levels'; this.phaseT = 0; this.cardPop = 0; this.reshape(); mill.tap(); return; }
    if (id === 'retry') { this.start(this.levelIndex); return; }
    if (id === 'next') { this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id === 'tool:dig' || id === 'tool:bank') { this.tool = id.slice(5) as Tool; mill.tap(); return; }
  }

  private stroke(p: Vec): void {
    const g = this.grid();
    const cx = (p.x - g.x) / g.cell, cy = (p.y - g.y) / g.cell;
    if (cx < -1 || cy < -1 || cx > this.valley.cols + 1 || cy > this.valley.rows + 1) return;
    if (Math.abs(cx - this.lastCell.x) < 0.6 && Math.abs(cy - this.lastCell.y) < 0.6) return;
    this.lastCell = { x: cx, y: cy };
    this.idle = 0;
    if (this.spade <= 0) { mill.blocked(); if (this.noteT <= 0) this.say(T('Your spade is worn out.', 'Je schop is op.')); return; }
    const used = this.tool === 'dig' ? digAt(this.valley, cx, cy, 1.55) : bankAt(this.valley, cx, cy, 1.4);
    if (used <= 0) return;
    this.spade = Math.max(0, this.spade - used);
    // earth flying off the spade, thrown the way the stroke is going
    const colour = this.tool === 'dig' ? 'rgba(126,92,58,0.95)' : 'rgba(168,146,108,0.95)';
    this.ps.spawn(this.tool === 'dig' ? 'crumb' : 'dust', p.x, p.y, 2, { colour, speed: 70, size: g.cell * 0.85, max: 0.5 });
    mill.dig();
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    ctx.fillStyle = '#8fc8e8';
    ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];

    if (this.phase === 'levels') { this.drawLevels(); return; }

    ctx.save();
    this.shake.apply(ctx, 10 * this.u());
    paintHorizon(ctx, this.w, this.topInset(), this.t, this.level.seed);
    this.drawValley();
    this.ps.draw(ctx);
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.26);
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  /** The land, the water on it, and everything standing in the valley. */
  private drawValley(): void {
    const ctx = this.ctx, v = this.valley, g = this.grid();
    const art = this.art;
    if (!art) return;
    art.paintGround(ctx, g, v);
    art.paintGrowth(ctx, g, v, this.t);
    art.paintWater(ctx, g, v, this.t);
    art.paintRocks(ctx, g);
    this.level.fields.forEach((f, k) => {
      art.paintField(ctx, g, v, f, clamp(v.filled[k] / f.need, 0, 1), this.done.fields[k], this.t);
    });
    this.level.houses.forEach(([hx, hy], k) => {
      art.paintHouse(ctx, g, v, hx, hy, clamp(v.wet[k], 0, 1), this.t, k);
    });
    this.level.wheels.forEach((wh, k) => {
      art.paintWheel(ctx, g, v, wh, this.wheelAngle[k], this.wheelSpeed[k], clamp(v.turned[k] / wh.need, 0, 1), this.t, this.ps);
    });
    for (const [sx, sy] of this.level.springs) {
      art.paintSpring(ctx, g, v, sx, sy, this.springLeft > 0, this.t, this.ps);
    }
    art.paintSea(ctx, g, v, this.t);
    art.paintGrain(ctx, g);
    if (this.phase === 'play') { this.drawWants(g); this.drawHandHint(g); }
  }

  /**
   * A drop over everything that is still waiting.
   *
   * Without this the valley is a pretty picture with no question in it: a child can see a field
   * and a wheel but nothing says those are the things to get the water to. The drop bobs over
   * each one until it is satisfied, and then it is simply gone.
   */
  private drawWants(g: Grid): void {
    const ctx = this.ctx, v = this.valley, u = this.u();
    const marks: Array<{ x: number; y: number }> = [];
    this.level.fields.forEach((f, i) => { if (!this.done.fields[i]) marks.push(f); });
    this.level.wheels.forEach((wh, i) => { if (!this.done.wheels[i]) marks.push(wh); });
    if (!marks.length) return;
    const r = 15 * u;
    for (const m of marks) {
      const x = g.x + (m.x * (v.cols - 1) + 0.5) * g.cell;
      const y = g.y + (m.y * (v.rows - 1) + 0.5) * g.cell;
      const beat = breathe(this.t, 2.4, x * 0.01);
      const cy = y - Math.max(g.cell * 0.9, 34 * u) - r + Math.sin(this.t * 2.4 + x * 0.01) * 3 * u;
      ctx.save();
      // a ring that opens outward, the way a drop lands in water
      ctx.strokeStyle = `rgba(122, 200, 240, ${0.5 * (1 - beat)})`;
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.arc(x, cy, r * (1 + beat * 0.55), 0, TAU); ctx.stroke();
      contactShadow(ctx, x, cy + r * 1.25, r * 0.85, r * 0.3, 0.3);
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30, 80, 120, 0.25)';
      ctx.lineWidth = 1.4 * u;
      ctx.stroke();
      // the drop itself: a point at the top, round at the bottom
      const dr = r * 0.56;
      const drop = ctx.createLinearGradient(x, cy - dr * 1.3, x, cy + dr);
      drop.addColorStop(0, '#8fd8f7');
      drop.addColorStop(1, '#2a86c4');
      ctx.fillStyle = drop;
      ctx.beginPath();
      ctx.moveTo(x, cy - dr * 1.35);
      ctx.quadraticCurveTo(x + dr * 1.05, cy + dr * 0.1, x, cy + dr);
      ctx.quadraticCurveTo(x - dr * 1.05, cy + dr * 0.1, x, cy - dr * 1.35);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(x - dr * 0.32, cy + dr * 0.08, dr * 0.18, dr * 0.3, -0.35, 0, TAU); ctx.fill();
      // a point down at the thing that wants it
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.moveTo(x - 5.5 * u, cy + r * 0.82);
      ctx.lineTo(x + 5.5 * u, cy + r * 0.82);
      ctx.lineTo(x, cy + r * 1.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  /**
   * When nothing has happened for a while, a hand comes in and shows the stroke: from the spring
   * towards the first thing that still needs water. It is the only instruction a four year old
   * needs, and it costs no words at all. On the first two valleys it comes almost at once,
   * because there the child does not yet know there is a stroke to make.
   */
  private drawHandHint(g: Grid): void {
    const wait = this.levelIndex < 2 ? 1.1 : 2.6;
    if (this.idle < wait || this.spade <= 0) return;
    const L = this.level, v = this.valley;
    const target = L.fields.find((_, i) => !this.done.fields[i]) ?? L.wheels.find((_, i) => !this.done.wheels[i]);
    if (!target || !L.springs.length) return;
    const [sx, sy] = L.springs[0];
    const ax = g.x + (sx * (v.cols - 1) + 0.5) * g.cell, ay = g.y + (sy * (v.rows - 1) + 0.5) * g.cell;
    const bx = g.x + (target.x * (v.cols - 1) + 0.5) * g.cell, by = g.y + (target.y * (v.rows - 1) + 0.5) * g.cell;
    const cycle = ((this.t - wait) % 3) / 3;
    const k = easeOutCubic(clamp(cycle * 1.5, 0, 1));
    const fade = clamp(Math.sin(cycle * Math.PI) * 2.2, 0, 1) * clamp((this.idle - wait) / 0.6, 0, 1);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3.4 * this.u();
    ctx.lineCap = 'round';
    ctx.setLineDash([2 * this.u(), 7 * this.u()]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
    ctx.stroke();
    ctx.setLineDash([]);
    handCursor(ctx, ax + (bx - ax) * k, ay + (by - ay) * k, 13 * this.u(), 1);
    ctx.restore();
  }

  // ---------- the interface over the valley ----------

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    const inset = this.topInset();

    // two dials in the sky, out of the valley's way: spade left, and how long the spring runs
    const r = 19 * u;
    this.dial(this.w / 2 - 52 * u, inset - 28 * u, r, this.spade / this.level.spade, '#e0a552', 'spade');
    this.dial(this.w / 2 + 52 * u, inset - 28 * u, r, this.springLeft / this.level.springFor, '#5ab6ea', 'drop');

    // what still has to happen, as the things themselves
    const goals = [
      ...this.level.fields.map((_, i) => ({ done: this.done.fields[i], kind: 'field' as const })),
      ...this.level.wheels.map((_, i) => ({ done: this.done.wheels[i], kind: 'wheel' as const })),
      ...this.level.houses.map((_, i) => ({ done: this.valley.wet[i] < 0.5, kind: 'house' as const })),
    ];
    const gap = 25 * u, x0 = this.w / 2 - ((goals.length - 1) * gap) / 2;
    goals.forEach((gl, i) => this.goalPip(x0 + i * gap, inset - 2 * u, 9 * u, gl.kind, gl.done));

    // the valley's name, only for the first moments of a level
    if (this.phase === 'play' && this.phaseT < 2.6) {
      const a = clamp(Math.min(this.phaseT * 2.4, (2.6 - this.phaseT) * 1.6), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      const slide = (1 - easeOutCubic(clamp(this.phaseT * 1.6, 0, 1))) * 16 * u;
      heading(ctx, nameOf(this.level), this.w / 2, this.h * 0.34 + slide, this.font('900', 30), '#ffffff');
      ctx.restore();
    }

    if (this.noteT > 0 && this.phase === 'play') {
      const a = clamp(this.noteT, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = this.font('800', 12);
      const tw = Math.min(this.w - 40 * u, ctx.measureText(this.note).width + 34 * u);
      const ny = inset + 12 * u;
      glassPanel(ctx, this.w / 2 - tw / 2, ny, tw, 30 * u, 15 * u, 0.93);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      ctx.fillText(this.note, this.w / 2, ny + 20 * u, tw - 24 * u);
      ctx.restore();
    }

    if (this.phase === 'play') {
      // the tools sit on a shelf at the bottom, over a scrim so they never fight the grass
      const bot = ctx.createLinearGradient(0, this.h - 120 * u, 0, this.h);
      bot.addColorStop(0, 'rgba(8, 28, 48, 0)');
      bot.addColorStop(1, 'rgba(8, 28, 48, 0.42)');
      ctx.fillStyle = bot;
      ctx.fillRect(0, this.h - 120 * u, this.w, 120 * u);
      const bw = 118 * u, bh = 52 * u, yb = this.h - bh - 28 * u;
      this.toolButton('tool:dig', T('Dig', 'Graven'), this.w / 2 - bw - 7 * u, yb, bw, bh, this.tool === 'dig');
      this.toolButton('tool:bank', T('Bank', 'Ophogen'), this.w / 2 + 7 * u, yb, bw, bh, this.tool === 'bank');
    }
    this.smallButton('levels', T('Valleys', 'Valleien'), 14 * u, 12 * u, 92 * u, 44 * u);
    ctx.textAlign = 'left';
  }

  /** A round gauge with a picture in it: no percentage, no word, still perfectly clear. */
  private dial(x: number, y: number, r: number, t: number, colour: string, icon: 'spade' | 'drop'): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.shadowColor = 'rgba(8,28,48,0.35)';
    ctx.shadowBlur = 10 * u;
    ctx.shadowOffsetY = 2 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    const low = t < 0.22;
    progressRing(ctx, x, y, r - 3 * u, clamp(t, 0, 1), low ? '#e8685c' : colour, 5 * u, 'rgba(18,48,71,0.14)');
    ctx.save();
    ctx.translate(x, y);
    const pulse = low ? 1 + breathe(this.t, 7) * 0.12 : 1;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = low ? '#e8685c' : '#2c5570';
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    if (icon === 'spade') {
      ctx.beginPath(); ctx.moveTo(0, -8 * u); ctx.lineTo(0, 1 * u); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4.4 * u, 0);
      ctx.lineTo(4.4 * u, 0);
      ctx.lineTo(3.2 * u, 7 * u);
      ctx.quadraticCurveTo(0, 10 * u, -3.2 * u, 7 * u);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -9 * u);
      ctx.bezierCurveTo(6 * u, -1 * u, 6.4 * u, 3 * u, 6.4 * u, 4 * u);
      ctx.arc(0, 4 * u, 6.4 * u, 0, Math.PI);
      ctx.bezierCurveTo(-6.4 * u, 3 * u, -6 * u, -1 * u, 0, -9 * u);
      ctx.fill();
    }
    ctx.restore();
  }

  /** One goal, drawn as a tiny version of the thing it stands for. */
  private goalPip(x: number, y: number, r: number, kind: 'field' | 'wheel' | 'house', done: boolean): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.translate(x, y);
    const pop = done ? 1 + Math.sin(this.t * 4) * 0.04 : 1;
    ctx.scale(pop, pop);
    ctx.fillStyle = done ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = done ? '#4fae6e' : 'rgba(18,48,71,0.35)';
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    const ink = done ? '#3c8f58' : 'rgba(18,48,71,0.5)';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1.6 * u;
    ctx.lineCap = 'round';
    if (kind === 'field') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 2.6 * u, 4 * u);
        ctx.lineTo(i * 2.6 * u + i * 0.8 * u, -3.6 * u);
        ctx.stroke();
      }
    } else if (kind === 'wheel') {
      ctx.beginPath(); ctx.arc(0, 0, 4.4 * u, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4.4 * u, Math.sin(a) * 4.4 * u);
        ctx.lineTo(-Math.cos(a) * 4.4 * u, -Math.sin(a) * 4.4 * u);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(-4.4 * u, 4.4 * u);
      ctx.lineTo(-4.4 * u, -0.6 * u);
      ctx.lineTo(0, -4.6 * u);
      ctx.lineTo(4.4 * u, -0.6 * u);
      ctx.lineTo(4.4 * u, 4.4 * u);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  private toolButton(id: string, label: string, x: number, y: number, w: number, h: number, on: boolean): void {
    const ctx = this.ctx, u = this.u();
    const face = chunkyButton(ctx, x, y, w, h, {
      tone: on ? '#3f9ee0' : '#fdfbf6',
      pressed: on || this.held === id,
    });
    ctx.save();
    ctx.translate(x + 28 * u, face.y + h / 2);
    const ink = on ? '#ffffff' : '#25506e';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2.6 * u;
    ctx.lineCap = 'round';
    if (id === 'tool:dig') {
      // a spade biting in
      ctx.rotate(0.3);
      ctx.beginPath(); ctx.moveTo(0, -11 * u); ctx.lineTo(0, -1 * u); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5 * u, -1 * u);
      ctx.lineTo(5 * u, -1 * u);
      ctx.lineTo(3.6 * u, 8 * u);
      ctx.quadraticCurveTo(0, 11.5 * u, -3.6 * u, 8 * u);
      ctx.closePath();
      ctx.fill();
    } else {
      // a mound of earth with a shovel-load landing on it
      ctx.beginPath();
      ctx.moveTo(-10 * u, 7 * u);
      ctx.quadraticCurveTo(0, -9 * u, 10 * u, 7 * u);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(2 * u, -9 * u, 3.6 * u, 2.4 * u, 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = on ? '#ffffff' : '#25506e';
    ctx.font = this.font('900', 14);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2 + 14 * u, face.y + h * 0.62, w - 48 * u);
    this.hits.push({ id, x, y, w, h });
  }

  private smallButton(id: string, label: string, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone: '#fdfbf6', pressed: this.held === id });
    ctx.fillStyle = '#25506e';
    ctx.font = this.font('800', 12);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 16);
    this.hits.push({ id, x, y, w, h });
  }

  // ---------- end of a level ----------

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    const won = this.phase === 'won';
    ctx.fillStyle = 'rgba(8, 26, 44, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = 268 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    // a band of colour across the top of the card
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 26 * u);
    ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 90 * u);
    band.addColorStop(0, won ? '#7fd8a4' : '#f0b27a');
    band.addColorStop(1, won ? 'rgba(127,216,164,0)' : 'rgba(240,178,122,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 90 * u);
    ctx.restore();

    ctx.textAlign = 'center';
    heading(ctx, won ? T('The valley is watered', 'De vallei is bevloeid') : T('Not this time', 'Deze keer niet'),
      this.w / 2, y + 52 * u, this.font('900', 21), '#123047');

    if (won) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp((this.cardPop * 1.6) - i * 0.25, 0, 1);
        drawStar(ctx, this.w / 2 + (i - 1) * 42 * u, y + 108 * u, 18 * u, i < this.earned,
          i < this.earned ? easeOutBack(shown) : 1);
      }
      ctx.fillStyle = 'rgba(18,48,71,0.72)';
      ctx.font = this.font('700', 12);
      ctx.fillText(
        `${T('Earth moved', 'Grond verzet')}: ${Math.round((1 - this.spade / this.level.spade) * 100)}%  ·  ${T('lost to the sea', 'naar zee verloren')}: ${Math.round(this.wasted)}`,
        this.w / 2, y + 148 * u, cw - 40 * u);
    } else {
      ctx.fillStyle = 'rgba(18,48,71,0.78)';
      ctx.font = this.font('800', 13);
      ctx.fillText(this.failWhy, this.w / 2, y + 100 * u, cw - 40 * u);
      ctx.fillStyle = 'rgba(18,48,71,0.6)';
      ctx.font = this.font('700', 12);
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 132 * u, cw - 40 * u);
    }
    ctx.restore();

    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    this.bigButton('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 7 * u, by, bw, bh, '#fdfbf6', '#25506e');
    if (won && this.levelIndex + 1 < LEVELS.length) {
      this.bigButton('next', T('Next valley', 'Volgende vallei'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.bigButton('levels', T('All valleys', 'Alle valleien'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private bigButton(id: string, label: string, x: number, y: number, w: number, h: number, tone: string, ink: string): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 20);
    this.hits.push({ id, x, y, w, h });
  }

  // ---------- the list of valleys ----------

  /** Every valley, painted, with the stars you have earned in it. */
  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    // the list has its own quiet backdrop, warmer than the sky in the game
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#9fd8f2');
    bg.addColorStop(0.55, '#bde6c9');
    bg.addColorStop(1, '#e7dcb6');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    heading(ctx, 'Millstream', this.w / 2, 60 * u, this.font('900', 26), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.7)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Dig, and the water finds its way.', 'Graaf, en het water vindt zijn weg.'), this.w / 2, 84 * u);

    const cols = this.w > 640 * u ? 4 : 2;
    const pad = 14 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const thumbH = cw * 0.62;
    const chh = thumbH + 64 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const rowsNeeded = Math.ceil(LEVELS.length / cols);
    const listTop = 104 * u;
    const avail = this.h - listTop - 20 * u;
    const needed = rowsNeeded * chh + (rowsNeeded - 1) * pad;
    const squeeze = Math.min(1, avail / needed);

    ctx.save();
    if (squeeze < 1) {
      ctx.translate(this.w / 2, listTop);
      ctx.scale(squeeze, squeeze);
      ctx.translate(-this.w / 2, -listTop);
    }

    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.05, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));

      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.3)';
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.roundRect(x, y, cw, chh, 18 * u);
      ctx.fill();
      ctx.restore();

      // the valley itself, painted into the top of the card
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, thumbH, 13 * u);
      ctx.clip();
      const thumb = levelThumb(L, (lv, size) => buildValley(lv, size), (cw - 12 * u) * 1.5, thumbH * 1.5);
      ctx.drawImage(thumb, x + 6 * u, y + 6 * u, cw - 12 * u, thumbH);
      if (!open) {
        ctx.fillStyle = 'rgba(232, 238, 240, 0.82)';
        ctx.fillRect(x, y, cw, thumbH + 12 * u);
      }
      ctx.restore();

      // number badge
      ctx.fillStyle = 'rgba(12,32,52,0.55)';
      ctx.beginPath();
      ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.68)';
      ctx.font = this.font('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + thumbH + 28 * u, cw - 28 * u);

      for (let s = 0; s < 3; s++) drawStar(ctx, x + 22 * u + s * 20 * u, y + thumbH + 48 * u, 8 * u, s < p.stars);

      if (!open) {
        // a padlock, rather than a sentence a five year old cannot read
        ctx.save();
        ctx.translate(x + cw / 2, y + thumbH / 2 + 6 * u);
        contactShadow(ctx, 0, 16 * u, 16 * u, 5 * u, 0.25);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(0, -6 * u, 7 * u, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // the list is scaled down when there is not enough room, so the touch targets follow it
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
