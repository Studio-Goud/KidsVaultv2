/**
 * Tidepool - the sorting game in Bramblewood.
 *
 * Creatures drift in from the sea. Pools wait along the shore. A sign says what the pools mean
 * today: colour, or shape, or size, or how many spots. You drag each creature to its pool before
 * the tide carries it past. Then the sign changes, and the creature you were about to drop is
 * suddenly meant for somewhere else.
 *
 * It practises cognitive flexibility: switching the rule you sort by while the old rule is still
 * pulling at you. Everything is drawn with canvas paths and every sound is synthesised.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  COLOUR_HEX, dimLabel, labelFor, LEVELS, nextRule, poolFor, rngFor, spawnCreature, starsFor,
  type Colour, type Creature, type Dim, type Kind, type Level, type Rule,
} from './model';
import { Sea, tide } from './tidesfx';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won' | 'failed';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `tide:${l.id}`;

/** where the water ends and the pools begin, as a fraction of the field height */
const SHORE = 0.72;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Splash { x: number; y: number; t0: number; good: boolean }

export class Tidepool {
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
  private rng = rngFor(LEVELS[0], 0);
  private attempt = 0;
  private rule: Rule = { dim: 'colour', values: ['red', 'blue'] };
  private previous: Rule | null = null;
  private creatures: Creature[] = [];
  private spawned = 0;
  private resolved = 0;
  private correct = 0;
  private wrong = 0;
  private missed = 0;
  private streak = 0;
  private best = 0;
  private shells = 3;
  private sinceSwitch = 0;
  private switchFlash = 0;
  private spawnIn = 1;
  private nextId = 1;
  private held: Creature | null = null;
  private holdOffset = { x: 0, y: 0 };
  private splashes: Splash[] = [];
  private earned = 0;
  private hits: Hit[] = [];
  private sea = new Sea();
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
    (window as unknown as { __tide?: Tidepool }).__tide = this;
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

  destroy(): void { cancelAnimationFrame(this.raf); this.sea.stop(); }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, level: this.level.id, rule: this.rule, spawned: this.spawned, resolved: this.resolved,
      correct: this.correct, wrong: this.wrong, missed: this.missed, shells: this.shells, streak: this.streak,
      creatures: this.creatures.filter(c => !c.gone && !c.landing).map(c => ({ id: c.id, kind: c.kind, colour: c.colour, size: c.size, spots: c.spots, x: Math.round(c.x * 1000) / 1000, y: Math.round(c.y * 1000) / 1000, pool: poolFor(c, this.rule) })),
      pools: this.poolRects().map(r => ({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) })),
      field: this.field(),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
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

  /** The water and the shore, between the sign at the top and the shells at the bottom. */
  private field(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    // the water starts under the sign and the hint, so nothing arrives behind a line of text
    const top = 142 * u, bottom = this.h - 40 * u;
    return { x: 0, y: top, w: this.w, h: Math.max(200, bottom - top) };
  }

  private toScreen(c: { x: number; y: number }): Vec {
    const f = this.field();
    return { x: f.x + c.x * f.w, y: f.y + c.y * f.h };
  }

  private poolRects(): Array<{ x: number; y: number; w: number; h: number }> {
    const f = this.field(), u = this.u();
    const n = this.rule.values.length;
    const gap = 10 * u;
    const pw = (f.w - 24 * u - gap * (n - 1)) / n;
    const top = f.y + f.h * SHORE + 22 * u;
    const ph = f.y + f.h - top - 6 * u;
    return this.rule.values.map((_, i) => ({ x: 12 * u + i * (pw + gap), y: top, w: pw, h: ph }));
  }

  /** How big a creature is on screen. */
  private radius(c: Creature): number {
    const f = this.field();
    return Math.min(f.w, f.h) * (c.size === 'big' ? 0.062 : 0.042) * (this.u() > 1.3 ? 0.9 : 1);
  }

  // ---------- levels ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.previous = null;
    this.rule = nextRule(this.level, null, this.rng);
    this.creatures = [];
    this.spawned = 0; this.resolved = 0; this.correct = 0; this.wrong = 0; this.missed = 0;
    this.streak = 0; this.best = 0; this.shells = 3;
    this.sinceSwitch = 0; this.switchFlash = 0;
    this.spawnIn = 1.2;
    this.held = null;
    this.splashes = [];
    this.earned = 0;
    this.phase = 'play'; this.phaseT = 0;
    this.say(NL() ? this.level.hintNl : this.level.hint, 5);
    this.sea.start();
  }

  private say(text: string, secs = 3): void { this.note = text; this.noteT = secs; }

  private switchRule(): void {
    this.previous = this.rule;
    this.rule = nextRule(this.level, this.rule, this.rng);
    this.sinceSwitch = 0;
    this.switchFlash = 1.6;
    tide.switchRule();
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.switchFlash = Math.max(0, this.switchFlash - dt);
    this.splashes = this.splashes.filter(s => this.t - s.t0 < 0.8);
    if (this.phase !== 'play') return;

    const L = this.level;
    // arrivals
    this.spawnIn -= dt;
    const active = this.creatures.filter(c => !c.gone && !c.landing).length;
    if (this.spawnIn <= 0 && active < L.atOnce && this.spawned < L.count) {
      if (L.switchEvery > 0 && this.sinceSwitch >= L.switchEvery && this.spawned > 0) this.switchRule();
      const c = spawnCreature(this.nextId++, this.rule, this.previous, this.rng);
      // keep new arrivals away from ones already on the water
      for (let k = 0; k < 6; k++) {
        if (!this.creatures.some(o => !o.gone && !o.landing && Math.abs(o.x - c.x) < 0.2 && o.y < 0.25)) break;
        c.x = 0.15 + this.rng() * 0.7;
      }
      this.creatures.push(c);
      this.spawned++;
      this.sinceSwitch++;
      this.spawnIn = L.every;
    }

    // drift and landing
    for (const c of this.creatures) {
      if (c.gone) continue;
      if (c.landing) {
        c.landing.t += dt * 2.6;
        if (c.landing.t >= 1) { c.gone = true; }
        continue;
      }
      if (c.held) continue;
      c.y += L.drift * dt;
      c.x += Math.sin(this.t * 1.3 + c.wobble) * 0.02 * dt;
      c.x = clamp(c.x, 0.06, 0.94);
      if (c.y > SHORE - 0.02) {
        c.gone = true;
        this.missed++; this.resolved++;
        this.streak = 0;
        tide.missed();
        const p = this.toScreen(c);
        this.splashes.push({ x: p.x, y: p.y, t0: this.t, good: false });
      }
    }

    if (this.shells <= 0) { this.phase = 'failed'; this.phaseT = 0; this.sea.stop(); tide.fail(); return; }
    if (this.resolved >= L.count) {
      this.earned = starsFor(this.correct, this.wrong, this.missed, L.count);
      recordLevelResult(saveKey(L), this.correct, this.earned, this.earned > 0);
      save.coins = Math.max(0, Math.round(save.coins + 15 + this.earned * 15)); persist();
      this.phase = this.earned > 0 ? 'won' : 'failed'; this.phaseT = 0;
      this.sea.stop();
      if (this.earned > 0) tide.complete(); else tide.fail();
    }
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
    if (hit) {
      if (hit.startsWith('level:')) { const i = Number(hit.slice(6)); if (this.unlocked(i)) this.start(i); else tide.wrong(); }
      else if (hit === 'levels') { this.phase = 'levels'; this.sea.stop(); tide.tap(); }
      else if (hit === 'retry') this.start(this.levelIndex);
      else if (hit === 'next') this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1));
      return;
    }
    if (this.phase !== 'play') return;
    // the nearest creature under the finger, generous on a phone
    let best: Creature | null = null, bd = 1e9;
    for (const c of this.creatures) {
      if (c.gone || c.landing) continue;
      const s = this.toScreen(c);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < this.radius(c) * 1.9 + 14 * this.u() && d < bd) { bd = d; best = c; }
    }
    if (best) {
      best.held = true;
      this.held = best;
      const s = this.toScreen(best);
      this.holdOffset = { x: s.x - p.x, y: s.y - p.y };
      tide.pick();
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.held) return;
    const p = this.at(e), f = this.field();
    this.held.x = clamp((p.x + this.holdOffset.x - f.x) / f.w, 0.03, 0.97);
    this.held.y = clamp((p.y + this.holdOffset.y - f.y) / f.h, -0.05, 0.98);
  }

  private onUp(e: PointerEvent): void {
    const c = this.held;
    if (!c) return;
    this.held = null;
    c.held = false;
    const p = this.at(e);
    const pools = this.poolRects();
    const over = pools.findIndex(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 12 * this.u() && p.y <= r.y + r.h);
    if (over < 0) {
      // let go over the water: it just carries on, a little back from the shore so it is not lost at once
      if (c.y > SHORE - 0.06) c.y = SHORE - 0.06;
      return;
    }
    const want = poolFor(c, this.rule);
    if (want === over) {
      c.landing = { pool: over, t: 0 };
      this.correct++; this.resolved++;
      this.streak++; this.best = Math.max(this.best, this.streak);
      tide.right(this.streak);
      const r = pools[over];
      this.splashes.push({ x: r.x + r.w / 2, y: r.y + r.h * 0.5, t0: this.t, good: true });
    } else {
      this.wrong++;
      this.streak = 0;
      this.shells--;
      tide.wrong();
      if (this.shells > 0) tide.shellLost();
      const r = pools[over];
      this.splashes.push({ x: r.x + r.w / 2, y: r.y + r.h * 0.5, t0: this.t, good: false });
      // back onto the water, higher up, so there is time to think again
      c.y = Math.min(c.y, SHORE * 0.45);
      this.say(T('Look at the sign: ' + dimLabel(this.rule.dim, false).toLowerCase(), 'Kijk naar het bord: ' + dimLabel(this.rule.dim, true).toLowerCase()), 2.5);
    }
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#bfe7ff'); sky.addColorStop(1, '#8fd0f2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }

    this.drawWater();
    this.drawPools();
    for (const c of this.creatures) if (!c.gone && !c.held) this.drawCreature(c);
    this.drawSplashes();
    if (this.held) this.drawCreature(this.held);
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  private drawWater(): void {
    const ctx = this.ctx, f = this.field(), u = this.u();
    const shoreY = f.y + f.h * SHORE;
    const g = ctx.createLinearGradient(0, f.y, 0, shoreY);
    g.addColorStop(0, '#2f8fd6'); g.addColorStop(1, '#6fc9ea');
    ctx.fillStyle = g; ctx.fillRect(f.x, f.y, f.w, shoreY - f.y);
    // ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      const y = f.y + ((k / 7) + (this.t * 0.03 % (1 / 7))) * (shoreY - f.y);
      ctx.beginPath();
      for (let x = 0; x <= f.w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + this.t * 1.5 + k) * 2.2);
      ctx.stroke();
    }
    // the sand
    const sand = ctx.createLinearGradient(0, shoreY, 0, f.y + f.h);
    sand.addColorStop(0, '#f1dfb4'); sand.addColorStop(1, '#dcc490');
    ctx.fillStyle = sand; ctx.fillRect(f.x, shoreY, f.w, f.y + f.h - shoreY);
    // foam line
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, shoreY);
    for (let x = 0; x <= f.w; x += 8) ctx.lineTo(x, shoreY + Math.sin(x * 0.05 + this.t * 2.2) * 3 * u);
    ctx.lineTo(f.w, shoreY + 6 * u); ctx.lineTo(0, shoreY + 6 * u); ctx.closePath(); ctx.fill();
  }

  private drawPools(): void {
    const ctx = this.ctx, u = this.u();
    const rects = this.poolRects();
    rects.forEach((r, i) => {
      const value = this.rule.values[i];
      ctx.fillStyle = 'rgba(80,160,200,0.55)';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(60,90,80,0.35)'; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.roundRect(r.x + 6 * u, r.y + 6 * u, r.w - 12 * u, r.h * 0.35, 12 * u); ctx.fill();
      // the label: what this pool takes, drawn as a picture
      this.drawLabel(this.rule.dim, value, r.x + r.w / 2, r.y + r.h * 0.5, Math.min(r.w, r.h) * 0.3);
      ctx.fillStyle = 'rgba(20,50,80,0.75)'; ctx.font = this.font('800', 10);
      ctx.textAlign = 'center';
      ctx.fillText(labelFor(this.rule.dim, value, NL()), r.x + r.w / 2, r.y + r.h - 8 * u, r.w - 8 * u);
    });
  }

  /** A picture that says the value without words. */
  private drawLabel(dim: Dim, value: string, cx: number, cy: number, r: number): void {
    const ctx = this.ctx;
    if (dim === 'colour') {
      ctx.fillStyle = COLOUR_HEX[value as Colour];
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    } else if (dim === 'kind') {
      this.drawShape(value as Kind, cx, cy, r * 1.1, '#f4f7fa', 0, false);
    } else if (dim === 'size') {
      const big = value === 'big';
      ctx.fillStyle = '#f4f7fa';
      ctx.beginPath(); ctx.arc(cx, cy, big ? r * 1.15 : r * 0.55, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,80,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    } else {
      const n = Number(value);
      ctx.fillStyle = '#f4f7fa';
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, TAU); ctx.fill();
      ctx.fillStyle = '#24405a';
      const pos = n === 1 ? [[0, 0]] : n === 2 ? [[-0.45, 0], [0.45, 0]] : [[-0.5, 0.25], [0.5, 0.25], [0, -0.45]];
      for (const [dx, dy] of pos) { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, r * 0.22, 0, TAU); ctx.fill(); }
    }
  }

  private drawCreature(c: Creature): void {
    const ctx = this.ctx;
    let s = this.toScreen(c);
    let r = this.radius(c);
    if (c.landing) {
      const pool = this.poolRects()[c.landing.pool];
      const k = c.landing.t, e = 1 - Math.pow(1 - k, 3);
      s = { x: s.x + (pool.x + pool.w / 2 - s.x) * e, y: s.y + (pool.y + pool.h / 2 - s.y) * e };
      r *= 1 - k * 0.6;
      ctx.globalAlpha = 1 - k * 0.7;
    }
    if (c.held) { r *= 1.12; ctx.shadowColor = 'rgba(0,30,60,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; }
    this.drawShape(c.kind, s.x, s.y, r, COLOUR_HEX[c.colour], c.spots, true, this.t + c.wobble);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;
  }

  /** One of the five creatures, drawn from paths. Spots go on the body so they are easy to count. */
  private drawShape(kind: Kind, x: number, y: number, r: number, fill: string, spots: number, alive: boolean, t = 0): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    const outline = 'rgba(30,40,60,0.45)';
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.strokeStyle = outline; ctx.fillStyle = fill;
    const wig = alive ? Math.sin(t * 3) * 0.12 : 0;
    if (kind === 'crab') {
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.72, 0, 0, TAU); ctx.fill(); ctx.stroke();
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const a = (0.35 + i * 0.35) * sx + (sx > 0 ? 0 : Math.PI);
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.9 + r * 0.3); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(sx * r * 1.1, -r * 0.55 + wig * r * sx, r * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#20304a';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.1, 0, TAU); ctx.arc(r * 0.3, -r * 0.25, r * 0.1, 0, TAU); ctx.fill();
    } else if (kind === 'fish') {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.65, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.95, 0); ctx.lineTo(r * 1.5, -r * 0.5 + wig * r); ctx.lineTo(r * 1.5, r * 0.5 + wig * r); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#20304a';
      ctx.beginPath(); ctx.arc(-r * 0.55, -r * 0.12, r * 0.1, 0, TAU); ctx.fill();
    } else if (kind === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2 + wig * 0.3;
        const rr = i % 2 === 0 ? r * 1.15 : r * 0.5;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (kind === 'jelly') {
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r, Math.PI, 0); ctx.lineTo(r, r * 0.15); ctx.lineTo(-r, r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.35, r * 0.15);
        ctx.quadraticCurveTo(i * r * 0.35 + wig * r * 2, r * 0.7, i * r * 0.35 + Math.sin(t * 2 + i) * r * 0.15, r * 1.1);
        ctx.stroke();
      }
    } else {
      // a scallop shell
      ctx.beginPath(); ctx.moveTo(0, r * 0.9);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const rr = r * (i % 2 === 0 ? 1.05 : 0.92);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9 + r * 0.1);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      for (let i = 1; i < 8; i += 2) { const a = Math.PI + (i / 8) * Math.PI; ctx.moveTo(0, r * 0.9); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.85 + r * 0.1); }
      ctx.stroke();
    }
    // spots, in a fixed layout so counting is quick
    if (spots > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const pos = spots === 1 ? [[0, 0.05]] : spots === 2 ? [[-0.32, 0.05], [0.32, 0.05]] : [[-0.36, 0.15], [0.36, 0.15], [0, -0.28]];
      for (const [dx, dy] of pos) {
        ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.16, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(30,40,60,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawSplashes(): void {
    const ctx = this.ctx;
    for (const s of this.splashes) {
      const k = (this.t - s.t0) / 0.8;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = s.good ? 'rgba(157,247,196,0.9)' : 'rgba(255,140,128,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10 + k * 40, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    // the sign
    const sw = Math.min(this.w - 24 * u, 320 * u), sh = 44 * u, sx = this.w / 2 - sw / 2, sy = 58 * u;
    const flash = this.switchFlash > 0 ? 0.5 + 0.5 * Math.sin(this.t * 14) : 0;
    ctx.fillStyle = flash > 0 ? `rgba(255,${Math.round(226 - flash * 60)},${Math.round(122 - flash * 60)},0.98)` : 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 14 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,80,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 15); ctx.textAlign = 'center';
    ctx.fillText(dimLabel(this.rule.dim, NL()), this.w / 2, sy + sh * 0.64, sw - 20 * u);
    if (this.switchFlash > 0) {
      ctx.fillStyle = '#b4543f'; ctx.font = this.font('900', 11);
      ctx.fillText(T('NEW RULE', 'NIEUWE REGEL'), this.w / 2, sy - 6 * u);
    }

    // progress and streak
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('800', 10);
    ctx.textAlign = 'left';
    ctx.fillText(`${this.resolved} / ${this.level.count}`, 14 * u, this.h - 14 * u);
    ctx.textAlign = 'right';
    if (this.streak >= 3) ctx.fillText(`${T('streak', 'reeks')} ${this.streak}`, this.w - 14 * u, this.h - 14 * u);

    // shells: what you have left to lose
    for (let i = 0; i < 3; i++) {
      const on = i < this.shells;
      this.drawShape('shell', this.w / 2 + (i - 1) * 26 * u, this.h - 18 * u, 8 * u, on ? '#f0c33b' : 'rgba(20,50,80,0.18)', 0, false);
    }

    if (this.noteT > 0 && this.phase === 'play') {
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = this.font('700', 11.5);
      const tw = Math.min(this.w - 24 * u, ctx.measureText(this.note).width + 28 * u);
      ctx.beginPath(); ctx.roundRect(this.w / 2 - tw / 2, 112 * u, tw, 24 * u, 12 * u); ctx.fill();
      ctx.fillStyle = '#14324f';
      ctx.fillText(this.note, this.w / 2, 128 * u, this.w - 44 * u);
      ctx.globalAlpha = 1;
    }

    const mw = 84 * u, mh = 30 * u;
    this.button('levels', T('Tides', 'Getijden'), 12 * u + mw / 2, 12 * u + mh / 2, mw, mh, false);
    ctx.textAlign = 'left';
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
    ctx.fillText(this.phase === 'won' ? T('The tide is sorted', 'Het tij is gesorteerd') : T('The tide got away', 'Het tij was te snel'), this.w / 2, y + 44 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(`${T('right', 'goed')} ${this.correct} · ${T('wrong', 'fout')} ${this.wrong} · ${T('missed', 'gemist')} ${this.missed} · ${T('best streak', 'beste reeks')} ${this.best}`, this.w / 2, y + 70 * u, cw - 30 * u);
    if (this.phase === 'won') {
      for (let i = 0; i < 3; i++) drawStar(ctx, this.w / 2 + (i - 1) * 30 * u, y + 108 * u, 12 * u, i < this.earned ? '#e8b437' : 'rgba(20,50,80,0.18)');
    } else {
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 104 * u, cw - 30 * u);
    }
    const bw = 130 * u, bh = 44 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw / 2 - 6 * u, y + ch - 72 * u, bw, bh, true);
    if (this.phase === 'won' && this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next tide', 'Volgend tij'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
    else this.button('levels', T('All tides', 'Alle getijden'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 24);
    ctx.fillText('Tidepool', this.w / 2, 62 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Sort what the tide brings. Mind the sign.', 'Sorteer wat het tij brengt. Let op het bord.'), this.w / 2, 84 * u);
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
      ctx.fillText(`${L.pools} ${T('pools', 'poelen')} · ${L.count} ${T('creatures', 'dieren')}${L.switchEvery ? ' · ' + T('switches', 'wissels') : ''}`, x + 12 * u, y + 58 * u, cw - 24 * u);
      for (let s = 0; s < 3; s++) drawStar(ctx, x + 18 * u + s * 16 * u, y + 76 * u, 5.5 * u, s < p.stars ? '#e8b437' : 'rgba(20,50,80,0.18)');
      if (!open) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(20,50,80,0.45)'; ctx.font = this.font('800', 9); ctx.fillText(T('finish the one before', 'eerst de vorige'), x + cw - 12 * u, y + 79 * u); }
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
