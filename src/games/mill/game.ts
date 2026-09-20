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
 * Everything is drawn with canvas paths and every sound is synthesised. No advertising, no tracking.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { mill, Stream } from './millsfx';
import {
  bankAt, buildValley, digAt, fieldDone, houseFlooded, kindOf, LEVELS, starsFor, stepWater, totalWater,
  wheelDone, type Level, type Valley,
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
  private h = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private phaseT = 0;
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private valley: Valley = buildValley(LEVELS[0]);
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
  private stream = new Stream();
  private sparkleSeed = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => { this.digging = false; });
    canvas.addEventListener('pointercancel', () => { this.digging = false; });
    (window as unknown as { __mill?: Millstream }).__mill = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
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
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** Where the valley sits on screen, and how big a cell is. */
  private grid(): { x: number; y: number; cell: number; w: number; h: number } {
    const u = this.u();
    const top = 112 * u, bottom = this.h - 96 * u;
    const cw = (this.w - 16 * u) / this.valley.cols;
    const ch = (bottom - top) / this.valley.rows;
    const cell = Math.min(cw, ch);
    const w = cell * this.valley.cols, h = cell * this.valley.rows;
    return { x: (this.w - w) / 2, y: top + (bottom - top - h) / 2, cell, w, h };
  }

  // ---------- levels ----------

  private unlocked(i: number): boolean {
    return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed;
  }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.valley = buildValley(this.level);
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
    this.phase = 'play'; this.phaseT = 0;
    this.say(NL() ? this.level.hintNl : this.level.hint, 6);
    mill.spring();
  }

  private say(text: string, secs = 4): void { this.note = text; this.noteT = secs; }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    if (this.phase !== 'play') { this.stream.update(0); return; }

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
    L.fields.forEach((_, i) => { if (!this.done.fields[i] && fieldDone(v, L, i)) { this.done.fields[i] = true; mill.fieldFull(); this.say(T('That field has had enough.', 'Die akker heeft genoeg gehad.'), 2.5); } });
    L.wheels.forEach((_, i) => { if (!this.done.wheels[i] && wheelDone(v, L, i)) { this.done.wheels[i] = true; mill.wheelDone(); this.say(T('The wheel has done its work.', 'Het rad heeft zijn werk gedaan.'), 2.5); } });
    for (let i = 0; i < L.houses.length; i++) {
      if (houseFlooded(v, i)) { this.fail(T('A house flooded.', 'Een huis is ondergelopen.')); mill.flood(); return; }
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

  private win(): void {
    this.earned = starsFor(this.level, this.spade, this.wasted, true);
    recordLevelResult(saveKey(this.level), 1, this.earned, true);
    save.coins = Math.max(0, Math.round(save.coins + 25 + this.earned * 15)); persist();
    this.phase = 'won'; this.phaseT = 0;
    mill.complete();
  }

  private fail(why: string): void {
    this.failWhy = why;
    this.phase = 'failed'; this.phaseT = 0;
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.onHit(hit); return; }
    if (this.phase !== 'play') return;
    this.digging = true;
    this.lastCell = { x: -99, y: -99 };
    this.stroke(p);
  }

  private onMove(e: PointerEvent): void {
    if (!this.digging || this.phase !== 'play') return;
    this.stroke(this.at(e));
  }

  private onHit(id: string): void {
    if (id.startsWith('level:')) { const i = Number(id.slice(6)); if (this.unlocked(i)) { this.start(i); mill.tap(); } else mill.blocked(); return; }
    if (id === 'levels') { this.phase = 'levels'; this.phaseT = 0; mill.tap(); return; }
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
    if (this.spade <= 0) { mill.blocked(); if (this.noteT <= 0) this.say(T('Your spade is worn out.', 'Je schop is op.')); return; }
    const used = this.tool === 'dig' ? digAt(this.valley, cx, cy, 1.55) : bankAt(this.valley, cx, cy, 1.4);
    if (used <= 0) return;
    this.spade = Math.max(0, this.spade - used);
    mill.dig();
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#bfe7ff'); sky.addColorStop(0.5, '#9fd6f4'); sky.addColorStop(1, '#7fc0e6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];

    if (this.phase === 'levels') { this.drawLevels(); return; }

    this.drawValley();
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  /** The land, the water on it, and everything standing in the valley. */
  private drawValley(): void {
    const ctx = this.ctx, v = this.valley, g = this.grid();
    const c = g.cell;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 14 * this.u()); ctx.clip();

    // ground, shaded by which way it faces
    for (let y = 0; y < v.rows; y++) {
      for (let x = 0; x < v.cols; x++) {
        const i = y * v.cols + x;
        const k = kindOf(v, i);
        const hgt = v.ground[i];
        const left = x > 0 ? v.ground[i - 1] : hgt;
        const up = y > 0 ? v.ground[i - v.cols] : hgt;
        const slope = (left - hgt) * 3.2 + (up - hgt) * 2.6;
        const light = clamp(0.78 + slope, 0.5, 1.12);
        let r = 0, gg = 0, b = 0;
        if (k === 'sea') { r = 54; gg = 138; b = 196; }
        else if (k === 'rock') { r = 128; gg = 122; b = 118; }
        else {
          // low ground is lush and dark, high ground pale and dry
          const t = clamp((hgt - 0.05) / 0.85, 0, 1);
          r = 96 + t * 92; gg = 168 + t * 40; b = 82 + t * 50;
          // dug earth shows brown
          const dug = clamp((v.original[i] - hgt) / 0.1, 0, 1);
          r = r * (1 - dug) + 128 * dug; gg = gg * (1 - dug) + 102 * dug; b = b * (1 - dug) + 70 * dug;
          const banked = clamp((hgt - v.original[i]) / 0.1, 0, 1);
          r = r * (1 - banked) + 150 * banked; gg = gg * (1 - banked) + 130 * banked; b = b * (1 - banked) + 96 * banked;
        }
        ctx.fillStyle = `rgb(${Math.round(r * light)},${Math.round(gg * light)},${Math.round(b * light)})`;
        ctx.fillRect(g.x + x * c, g.y + y * c, c + 0.6, c + 0.6);
      }
    }

    // fields: stripes that green up as they drink
    this.level.fields.forEach((f, k) => {
      const cx = g.x + (Math.round(f.x * (v.cols - 1)) + 0.5) * c, cy = g.y + (Math.round(f.y * (v.rows - 1)) + 0.5) * c;
      const fill = clamp(v.filled[k] / f.need, 0, 1);
      const R = 3.4 * c;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      ctx.fillStyle = `rgba(${Math.round(190 - fill * 90)},${Math.round(150 + fill * 40)},${Math.round(70 + fill * 10)},0.85)`;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.strokeStyle = `rgba(60,110,40,${0.35 + fill * 0.4})`; ctx.lineWidth = Math.max(1, c * 0.28);
      for (let yy = -R; yy <= R; yy += c * 0.95) { ctx.beginPath(); ctx.moveTo(cx - R, cy + yy); ctx.lineTo(cx + R, cy + yy); ctx.stroke(); }
      if (fill > 0.15) {
        ctx.fillStyle = `rgba(70,150,60,${fill})`;
        for (let yy = -R + c * 0.5; yy < R; yy += c * 0.95) for (let xx = -R + c * 0.6; xx < R; xx += c * 1.1) {
          ctx.beginPath(); ctx.ellipse(cx + xx, cy + yy - c * 0.2, c * 0.16, c * 0.3, 0, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(90,70,40,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      if (this.done.fields[k]) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = this.font('900', 10); ctx.textAlign = 'center'; ctx.fillText('✓', cx, cy + 3.5 * this.u()); }
    });

    // water
    for (let y = 0; y < v.rows; y++) {
      for (let x = 0; x < v.cols; x++) {
        const i = y * v.cols + x;
        const d = v.water[i];
        if (d < 0.012 || kindOf(v, i) === 'sea') continue;
        const a = clamp((d - 0.01) * 10, 0.08, 0.92);
        ctx.fillStyle = `rgba(52,140,215,${a})`;
        ctx.fillRect(g.x + x * c, g.y + y * c, c + 0.6, c + 0.6);
        if (d > 0.03 && ((x * 7 + y * 13 + Math.floor(this.t * 6)) % 11) === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(g.x + x * c + c * 0.3, g.y + y * c + c * 0.35, c * 0.4, c * 0.18);
        }
      }
    }

    // springs
    for (const [sx, sy] of this.level.springs) {
      const cx = g.x + (Math.round(sx * (v.cols - 1)) + 0.5) * c, cy = g.y + (Math.round(sy * (v.rows - 1)) + 0.5) * c;
      const live = this.springLeft > 0;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        const ph = ((this.t * 0.8 + k / 3) % 1);
        ctx.globalAlpha = (1 - ph) * (live ? 0.8 : 0.3);
        ctx.beginPath(); ctx.arc(cx, cy, c * (0.6 + ph * 2.2), 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = live ? '#e8f7ff' : '#9fb8c8';
      ctx.beginPath(); ctx.arc(cx, cy, c * 0.7, 0, TAU); ctx.fill();
    }

    // houses
    this.level.houses.forEach(([hx, hy], k) => {
      const cx = g.x + (Math.round(hx * (v.cols - 1)) + 0.5) * c, cy = g.y + (Math.round(hy * (v.rows - 1)) + 0.5) * c;
      const wet = clamp(v.wet[k], 0, 1);
      const s = 2.2 * c;
      ctx.fillStyle = `rgb(${Math.round(240 - wet * 80)},${Math.round(226 - wet * 60)},${Math.round(200)})`;
      ctx.fillRect(cx - s * 0.5, cy - s * 0.2, s, s * 0.7);
      ctx.fillStyle = wet > 0.6 ? '#7a5a5a' : '#c9563f';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.62, cy - s * 0.2); ctx.lineTo(cx, cy - s * 0.78); ctx.lineTo(cx + s * 0.62, cy - s * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(cx - s * 0.12, cy + s * 0.12, s * 0.24, s * 0.38);
      if (wet > 0.05) {
        ctx.strokeStyle = `rgba(52,140,215,${0.4 + wet * 0.5})`; ctx.lineWidth = Math.max(1.5, c * 0.3);
        ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy + s * 0.5); ctx.lineTo(cx + s * 0.7, cy + s * 0.5); ctx.stroke();
      }
    });

    // wheels
    this.level.wheels.forEach((wh, k) => {
      const cx = g.x + (Math.round(wh.x * (v.cols - 1)) + 0.5) * c, cy = g.y + (Math.round(wh.y * (v.rows - 1)) + 0.5) * c;
      const R = 2.3 * c;
      const prog = clamp(v.turned[k] / wh.need, 0, 1);
      ctx.save();
      ctx.translate(cx, cy);
      // the mill house behind the wheel
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(R * 0.5, -R * 0.9, R * 1.1, R * 1.8);
      ctx.fillStyle = '#6a4a34';
      ctx.beginPath(); ctx.moveTo(R * 0.4, -R * 0.9); ctx.lineTo(R * 1.05, -R * 1.45); ctx.lineTo(R * 1.7, -R * 0.9); ctx.closePath(); ctx.fill();
      ctx.rotate(this.wheelAngle[k]);
      ctx.strokeStyle = '#5a3d2a'; ctx.lineWidth = Math.max(1.6, c * 0.36); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.stroke();
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
        // paddles
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
        ctx.lineTo(Math.cos(a + 0.22) * R * 1.05, Math.sin(a + 0.22) * R * 1.05);
        ctx.stroke();
      }
      ctx.restore();
      // progress ring
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R + 4 * this.u(), 0, TAU); ctx.stroke();
      ctx.strokeStyle = this.done.wheels[k] ? '#9df7c4' : '#ffe27a';
      ctx.beginPath(); ctx.arc(cx, cy, R + 4 * this.u(), -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    });

    // the sea, with a little foam line
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < v.cols; x += 2) {
      const yy = g.y + (v.rows - 2) * c + Math.sin(this.t * 2 + x * 0.6) * c * 0.2;
      ctx.fillRect(g.x + x * c, yy, c * 1.3, 1.5);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,80,40,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 14 * this.u()); ctx.stroke();
  }

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 19);
    ctx.fillText(nameOf(this.level), (108 * u + this.w - 140 * u) / 2, 40 * u, this.w - 260 * u);

    // meters: spade left, spring left
    const y = 62 * u, bw = Math.min(140 * u, this.w * 0.34), bh = 8 * u;
    const bars: Array<[number, string, string, number]> = [
      [this.spade / this.level.spade, T('spade', 'schop'), '#b07a3a', this.w / 2 - bw - 8 * u],
      [this.springLeft / this.level.springFor, T('spring', 'bron'), '#3a8fd6', this.w / 2 + 8 * u],
    ];
    ctx.textAlign = 'left';
    for (const [v, label, color, x] of bars) {
      ctx.fillStyle = 'rgba(20,50,80,0.18)';
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(bh, bw * clamp(v, 0, 1)), bh, bh / 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('800', 9);
      ctx.fillText(`${label} ${Math.round(v * 100)}%`, x, y - 4 * u);
    }

    // goals as small pips
    ctx.textAlign = 'center';
    const goals = [...this.done.fields.map(d => ({ d, c: '#6b8f4e' })), ...this.done.wheels.map(d => ({ d, c: '#b07a3a' }))];
    const gap = 14 * u, x0 = this.w / 2 - ((goals.length - 1) * gap) / 2;
    goals.forEach((g, i) => {
      ctx.fillStyle = g.d ? g.c : 'rgba(20,50,80,0.22)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, 88 * u, 4 * u, 0, TAU); ctx.fill();
    });

    if (this.noteT > 0 && this.phase === 'play') {
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = this.font('700', 11.5);
      const tw = Math.min(this.w - 24 * u, ctx.measureText(this.note).width + 28 * u);
      ctx.beginPath(); ctx.roundRect(this.w / 2 - tw / 2, 96 * u, tw, 24 * u, 12 * u); ctx.fill();
      ctx.fillStyle = '#14324f';
      ctx.fillText(this.note, this.w / 2, 112 * u, this.w - 44 * u);
      ctx.globalAlpha = 1;
    }

    // tools and the way out
    if (this.phase === 'play') {
      const bw2 = 108 * u, bh2 = 44 * u, yb = this.h - bh2 - 26 * u;
      this.toolButton('tool:dig', T('Dig', 'Graven'), this.w / 2 - bw2 / 2 - 6 * u, yb, bw2, bh2, this.tool === 'dig');
      this.toolButton('tool:bank', T('Bank', 'Ophogen'), this.w / 2 + bw2 / 2 + 6 * u, yb, bw2, bh2, this.tool === 'bank');
    }
    const mw = 84 * u, mh = 30 * u;
    this.button('levels', T('Levels', 'Levels'), 12 * u + mw / 2, 12 * u + mh / 2, mw, mh, false);
    ctx.textAlign = 'left';
  }

  private toolButton(id: string, label: string, cx: number, y: number, w: number, h: number, on: boolean): void {
    const ctx = this.ctx, u = this.u();
    const x = cx - w / 2;
    ctx.fillStyle = on ? 'rgba(58,143,214,0.95)' : 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,80,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    // glyph: a spade, or a little mound
    ctx.save(); ctx.translate(x + 22 * u, y + h / 2);
    ctx.strokeStyle = on ? '#fff' : '#14324f'; ctx.fillStyle = on ? '#fff' : '#14324f'; ctx.lineWidth = 2 * u; ctx.lineCap = 'round';
    if (id === 'tool:dig') {
      ctx.beginPath(); ctx.moveTo(-4 * u, -8 * u); ctx.lineTo(2 * u, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -1 * u); ctx.lineTo(8 * u, 3 * u); ctx.lineTo(4 * u, 8 * u); ctx.lineTo(-2 * u, 4 * u); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-9 * u, 6 * u); ctx.quadraticCurveTo(0, -9 * u, 9 * u, 6 * u); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = on ? '#fff' : '#14324f'; ctx.font = this.font('800', 13);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2 + 12 * u, y + h * 0.65);
    this.hits.push({ id, x, y, w, h });
  }

  private button(id: string, label: string, cx: number, cy: number, w: number, h: number, strong: boolean): void {
    const ctx = this.ctx;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = strong ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,80,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#14324f'; ctx.font = this.font('800', h > 40 * this.u() ? 15 : 11.5);
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + h * 0.16, w - 20);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(10,30,50,0.55)'; ctx.fillRect(0, 0, this.w, this.h);
    const cw = Math.min(340 * u, this.w - 32 * u), ch = 250 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 22 * u); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 22);
    ctx.fillText(this.phase === 'won' ? T('The valley is watered', 'De vallei is bevloeid') : T('Not this time', 'Deze keer niet'), this.w / 2, y + 44 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    if (this.phase === 'won') {
      ctx.fillText(`${T('Earth moved', 'Grond verzet')}: ${Math.round((1 - this.spade / this.level.spade) * 100)}% · ${T('lost to the sea', 'naar zee verloren')}: ${Math.round(this.wasted)}`, this.w / 2, y + 70 * u, cw - 30 * u);
      for (let i = 0; i < 3; i++) drawStar(ctx, this.w / 2 + (i - 1) * 30 * u, y + 108 * u, 12 * u, i < this.earned ? '#e8b437' : 'rgba(20,50,80,0.18)');
    } else {
      ctx.fillText(this.failWhy, this.w / 2, y + 70 * u, cw - 30 * u);
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 100 * u, cw - 30 * u);
    }
    const bw = 130 * u, bh = 44 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw / 2 - 6 * u, y + ch - 72 * u, bw, bh, true);
    if (this.phase === 'won' && this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next valley', 'Volgende vallei'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
    } else {
      this.button('levels', T('All valleys', 'Alle valleien'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
    }
  }

  /** Every valley, with the stars you have earned in it. */
  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 24);
    ctx.fillText('Millstream', this.w / 2, 62 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Dig, and the water finds its way.', 'Graaf, en het water vindt zijn weg.'), this.w / 2, 84 * u);

    const cols = this.w > 700 * u ? 4 : 2;
    const cw = Math.min(170 * u, (this.w - 32 * u - (cols - 1) * 12 * u) / cols), chh = 92 * u;
    const total = cols * cw + (cols - 1) * 12 * u;
    const x0 = (this.w - total) / 2;
    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + 12 * u), y = 112 * u + row * (chh + 12 * u);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      ctx.fillStyle = open ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,80,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = open ? 'rgba(20,50,80,0.55)' : 'rgba(20,50,80,0.3)'; ctx.font = this.font('800', 10);
      ctx.fillText(`${i + 1}`, x + 12 * u, y + 20 * u);
      ctx.fillStyle = open ? '#14324f' : 'rgba(20,50,80,0.4)'; ctx.font = this.font('900', 13);
      ctx.fillText(nameOf(L), x + 12 * u, y + 40 * u, cw - 24 * u);
      ctx.fillStyle = 'rgba(20,50,80,0.6)'; ctx.font = this.font('700', 9.5);
      const bits = [
        L.fields.length ? `${L.fields.length} ${T(L.fields.length === 1 ? 'field' : 'fields', L.fields.length === 1 ? 'akker' : 'akkers')}` : '',
        L.wheels.length ? `${L.wheels.length} ${T(L.wheels.length === 1 ? 'wheel' : 'wheels', L.wheels.length === 1 ? 'rad' : 'raderen')}` : '',
        L.houses.length ? `${L.houses.length} ${T(L.houses.length === 1 ? 'house' : 'houses', L.houses.length === 1 ? 'huis' : 'huizen')}` : '',
      ].filter(Boolean).join(' · ');
      ctx.fillText(bits, x + 12 * u, y + 58 * u, cw - 24 * u);
      for (let s = 0; s < 3; s++) drawStar(ctx, x + 18 * u + s * 16 * u, y + 76 * u, 5.5 * u, s < p.stars ? '#e8b437' : 'rgba(20,50,80,0.18)');
      if (!open) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(20,50,80,0.45)'; ctx.font = this.font('800', 9);
        ctx.fillText(T('finish the one before', 'eerst de vorige'), x + cw - 12 * u, y + 76 * u + 3 * u);
      }
      this.hits.push({ id: `level:${i}`, x, y, w: cw, h: chh });
    });
    ctx.textAlign = 'left';
  }
}

function drawStar(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
