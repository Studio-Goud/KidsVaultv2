/**
 * Getijdenpoel - the sorting game in Braambos.
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
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  COLOUR_HEX, dimLabel, labelFor, LEVELS, makeRule, nextRule, poolFor, rngFor, spawnCreature, starsFor,
  type Colour, type Creature, type Dim, type Kind, type Level, type Rule,
} from './model';
import { Sea, tide } from './tidesfx';
import {
  bleedEdges, breathe, chunkyButton, drawStar as drawStarGem, easeOutBack, easeOutCubic,
  glassPanel, heading, outlinedText, Particles, vignette,
} from '../../render/look';
import { creatureShadow, paintCreature, ShoreArt } from './paint';
import { NL, T } from '../../util/lang';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won' | 'failed';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `tide:${l.id}`;

/** where the water ends and the pools begin, as a fraction of the field height */
const SHORE = 0.6;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Splash { x: number; y: number; t0: number; good: boolean }

export class Tidepool {
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
  private art = new ShoreArt(7);
  private ps = new Particles();
  /** how brightly each pool is lit after something landed in it */
  private poolGlow: number[] = [];
  private held0: string | null = null;
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
    (window as unknown as { __tide?: Tidepool }).__tide = this;
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

  destroy(): void { cancelAnimationFrame(this.raf); this.sea.stop(); }

  /**
   * One step back, for the button every game shares.
   *
   * What "back" means is the game's business; that there is a back at all, in the same corner and
   * the same shape everywhere, is not.
   */
  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.sea.stop(); }

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
  }

  /** The shore fills the screen: sea at the top, sand and the pools at the bottom. */
  private field(): { x: number; y: number; w: number; h: number } {
    return { x: 0, y: 0, w: this.w, h: this.h };
  }

  private toScreen(c: { x: number; y: number }): Vec {
    const f = this.field();
    return { x: f.x + c.x * f.w, y: f.y + c.y * f.h };
  }

  private poolRects(): Array<{ x: number; y: number; w: number; h: number }> {
    const f = this.field(), u = this.u();
    const n = this.rule.values.length;
    const gap = 10 * u;
    const top = f.y + f.h * SHORE + 46 * u;
    const ph = Math.max(60 * u, f.y + f.h - top - 34 * u);
    // a pool is a basin, not a puddle stretched across the beach: on a short wide screen the width
    // is held back to what the height can carry, and the row is centred instead
    const pw = Math.min((f.w - 24 * u - gap * (n - 1)) / n, ph * 1.7);
    const total = n * pw + gap * (n - 1);
    const x0 = f.x + (f.w - total) / 2;
    return this.rule.values.map((_, i) => ({ x: x0 + i * (pw + gap), y: top, w: pw, h: Math.min(ph, pw * 0.88) }));
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
    // a tide opens on the rule its own hint talks about; the switches after that are random
    this.rule = makeRule(this.level.dims[0], this.level.pools, this.rng);
    this.creatures = [];
    this.spawned = 0; this.resolved = 0; this.correct = 0; this.wrong = 0; this.missed = 0;
    this.streak = 0; this.best = 0; this.shells = 3;
    this.sinceSwitch = 0; this.switchFlash = 0;
    this.spawnIn = 1.2;
    this.held = null;
    this.splashes = [];
    this.ps.clear();
    this.poolGlow = [];
    this.cardPop = 0;
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
    this.ps.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.poolGlow = this.poolGlow.map(g => Math.max(0, g - dt * 1.6));
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
      // it comes in far enough down the water to be seen at once, not behind the sign
      c.y = 0.16;
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
        this.ps.spawn('splash', p.x, p.y, 10, { colour: 'rgba(226,246,255,0.95)', speed: 120, size: this.radius(c) * 0.5, max: 0.6 });
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
    this.held0 = null;
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
      this.poolGlow[over] = 1;
      this.ps.spawn('splash', r.x + r.w / 2, r.y + r.h * 0.5, 14, { colour: 'rgba(214,244,255,0.95)', speed: 150, size: r.w * 0.1, max: 0.7 });
      this.ps.spawn('spark', r.x + r.w / 2, r.y + r.h * 0.4, 8, { colour: '#bff5d4', speed: 130, size: r.w * 0.07, max: 0.8, spread: TAU });
    } else {
      this.wrong++;
      this.streak = 0;
      this.shells--;
      tide.wrong();
      if (this.shells > 0) tide.shellLost();
      const r = pools[over];
      this.splashes.push({ x: r.x + r.w / 2, y: r.y + r.h * 0.5, t0: this.t, good: false });
      this.ps.spawn('splash', r.x + r.w / 2, r.y + r.h * 0.5, 10, { colour: 'rgba(255,214,206,0.95)', speed: 120, size: r.w * 0.09, max: 0.6 });
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
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }

    const f = this.field();
    const shoreY = f.y + f.h * SHORE;
    this.art.paintSea(ctx, f, shoreY, this.t);
    this.art.paintSand(ctx, f, shoreY, this.t);
    this.drawPools();
    for (const c of this.creatures) if (!c.gone && !c.held) this.drawCreature(c);
    this.ps.draw(ctx);
    this.drawSplashes();
    if (this.held) this.drawCreature(this.held);
    vignette(ctx, this.w, this.h, 0.22);
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  private drawPools(): void {
    const ctx = this.ctx, u = this.u();
    const rects = this.poolRects();
    rects.forEach((r, i) => {
      const value = this.rule.values[i];
      this.art.paintPool(ctx, r, this.t, i, this.poolGlow[i] ?? 0);
      // what this pool takes, on a pebble sign at its edge
      const lr = Math.min(r.w, r.h) * 0.21;
      const ly = r.y + r.h * 0.38;
      this.drawLabel(this.rule.dim, value, r.x + r.w / 2, ly, lr);
      ctx.textAlign = 'center';
      outlinedText(ctx, labelFor(this.rule.dim, value, NL()), r.x + r.w / 2, r.y + r.h * 0.84,
        this.font('800', 10.5), '#12405c', 'rgba(255,255,255,0.92)', 4);
    });
  }

  /** A picture that says the value without words, sitting on the water of its pool. */
  private drawLabel(dim: Dim, value: string, cx: number, cy: number, r: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(8,32,52,0.35)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.16;
    if (dim === 'colour') {
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, COLOUR_HEX[value as Colour]);
      g.addColorStop(1, COLOUR_HEX[value as Colour]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.stroke();
    } else if (dim === 'kind') {
      ctx.shadowBlur = 0;
      paintCreature(ctx, value as Kind, cx, cy, r * 1.05, 'blue', 0, this.t, false, false);
    } else if (dim === 'size') {
      const big = value === 'big';
      const rr = big ? r * 1.1 : r * 0.55;
      const g = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, 0, cx, cy, rr);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#cfe0ea');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(29,64,86,0.45)'; ctx.lineWidth = Math.max(1.5, rr * 0.1); ctx.stroke();
    } else {
      const n = Number(value);
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#e2eef4');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      const pos = n === 1 ? [[0, 0]] : n === 2 ? [[-0.45, 0], [0.45, 0]] : [[-0.5, 0.25], [0.5, 0.25], [0, -0.45]];
      for (const [dx, dy] of pos) {
        ctx.fillStyle = '#24405a';
        ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, r * 0.22, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawCreature(c: Creature): void {
    const ctx = this.ctx;
    let s = this.toScreen(c);
    let r = this.radius(c);
    let alpha = 1;
    let lift = 0;
    if (c.landing) {
      const pool = this.poolRects()[c.landing.pool];
      const k = c.landing.t, e = easeOutCubic(k);
      s = { x: s.x + (pool.x + pool.w / 2 - s.x) * e, y: s.y + (pool.y + pool.h / 2 - s.y) * e };
      // it arcs up and over on the way in, rather than sliding flat across the sand
      lift = Math.sin(k * Math.PI) * r * 1.6;
      r *= 1 - k * 0.45;
      alpha = 1 - Math.max(0, k - 0.75) * 4;
    }
    if (c.held) { r *= 1.14; lift = r * 0.5; }
    const bob = c.landing || c.held ? 0 : Math.sin(this.t * 1.6 + c.wobble) * r * 0.08;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    creatureShadow(ctx, s.x, s.y + bob, r, lift);
    paintCreature(ctx, c.kind, s.x, s.y + bob - lift, r, c.colour, c.spots, this.t + c.wobble, c.held);
    ctx.restore();
  }

  private drawSplashes(): void {
    const ctx = this.ctx;
    for (const sp of this.splashes) {
      const k = (this.t - sp.t0) / 0.8;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = sp.good ? 'rgba(157,247,196,0.9)' : 'rgba(255,150,138,0.9)';
      ctx.lineWidth = 3.5 * (1 - k * 0.5);
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 12 + k * 46, (12 + k * 46) * 0.42, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    // the sign, swinging a little on its ropes, brighter for a moment when the rule changes
    const sw = Math.min(this.w - 44 * u, 300 * u), sh = 50 * u, sy = 72 * u;
    const flash = this.switchFlash > 0 ? 0.5 + 0.5 * Math.sin(this.t * 14) : 0;
    const swing = Math.sin(this.t * 1.1) * 0.5 + (this.switchFlash > 0 ? Math.sin(this.t * 12) * 1.4 : 0);
    const sx = this.w / 2 - sw / 2 + swing * 3;
    ctx.save();
    ctx.translate(this.w / 2, sy);
    ctx.rotate(swing * 0.004);
    ctx.translate(-this.w / 2, -sy);
    this.art.paintSign(ctx, sx, sy, sw, sh, flash, swing);
    ctx.fillStyle = '#4a2f18';
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.fillText(dimLabel(this.rule.dim, NL()), this.w / 2, sy + sh * 0.63, sw - 24 * u);
    ctx.restore();
    if (this.switchFlash > 0) {
      ctx.textAlign = 'center';
      const pop = easeOutBack(clamp((1.6 - this.switchFlash) * 3, 0, 1));
      ctx.save();
      ctx.translate(this.w / 2, sy + sh + 20 * u);
      ctx.scale(pop, pop);
      outlinedText(ctx, T('NEW RULE', 'NIEUWE REGEL'), 0, 0, this.font('900', 13), '#c9452f', '#ffffff', 5);
      ctx.restore();
    }

    // how far through the tide you are, as a row of drops filling up
    const total = this.level.count;
    const barW = Math.min(150 * u, this.w * 0.36), barH = 9 * u;
    const bx = 14 * u, by = this.h - 28 * u;
    ctx.fillStyle = 'rgba(12,40,60,0.28)';
    ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, barH / 2); ctx.fill();
    ctx.fillStyle = '#6fd0f0';
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(barH, barW * clamp(this.resolved / total, 0, 1)), barH, barH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, barH / 2); ctx.stroke();

    // shells: what you have left to lose
    for (let i = 0; i < 3; i++) {
      const on = i < this.shells;
      const sxx = this.w - 26 * u - (2 - i) * 28 * u;
      const syy = this.h - 24 * u;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.35;
      const wob = on ? 1 + breathe(this.t, 2.4, i) * 0.04 : 1;
      ctx.translate(sxx, syy);
      ctx.scale(wob, wob);
      paintCreature(ctx, 'shell', 0, 0, 11 * u, on ? 'yellow' : 'blue', 0, this.t, false, false);
      ctx.restore();
    }

    if (this.streak >= 3) {
      ctx.textAlign = 'center';
      outlinedText(ctx, `${T('streak', 'reeks')} ${this.streak}`, this.w / 2, this.h - 22 * u,
        this.font('900', 12), '#1d4056', 'rgba(255,255,255,0.9)', 4);
    }

    if (this.noteT > 0 && this.phase === 'play') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 12);
      const tw = Math.min(this.w - 36 * u, ctx.measureText(this.note).width + 32 * u);
      const ny = 140 * u;
      glassPanel(ctx, this.w / 2 - tw / 2, ny, tw, 30 * u, 15 * u, 0.93);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      ctx.fillText(this.note, this.w / 2, ny + 20 * u, tw - 22 * u);
      ctx.restore();
    }

    this.button('levels', T('Tides', 'Getijden'), 14 * u, 12 * u, 92 * u, 44 * u);
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fdfbf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 40 * this.u() ? 15 : 12);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 18);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    const won = this.phase === 'won';
    ctx.fillStyle = 'rgba(8, 26, 44, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = 272 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, won ? '#7fd8e8' : '#f0b27a');
    band.addColorStop(1, won ? 'rgba(127,216,232,0)' : 'rgba(240,178,122,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, won ? T('The tide is sorted', 'Het tij is gesorteerd') : T('The tide got away', 'Het tij was te snel'),
      this.w / 2, y + 50 * u, this.font('900', 20), '#123047');
    if (won) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + 104 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    const line = `${T('right', 'goed')} ${this.correct}  ·  ${T('wrong', 'fout')} ${this.wrong}  ·  ${T('missed', 'gemist')} ${this.missed}`;
    ctx.fillText(line, this.w / 2, y + (won ? 146 : 108) * u, cw - 40 * u);
    if (!won) {
      ctx.fillStyle = 'rgba(18,48,71,0.6)';
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 140 * u, cw - 40 * u);
    }
    ctx.restore();
    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (won && this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next tide', 'Volgend tij'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All tides', 'Alle getijden'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#59b6e8');
    bg.addColorStop(0.5, '#a5dff0');
    bg.addColorStop(1, '#f0e1bb');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    heading(ctx, 'Getijdenpoel', this.w / 2, 60 * u, this.font('900', 26), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.7)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Sort what the tide brings. Mind the sign.', 'Sorteer wat het tij brengt. Let op het bord.'), this.w / 2, 84 * u);

    const cols = this.w > 640 * u ? 4 : 2;
    const pad = 14 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.52;
    const chh = art + 62 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 104 * u;
    const rowsNeeded = Math.ceil(LEVELS.length / cols);
    const needed = rowsNeeded * chh + (rowsNeeded - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 20 * u) / needed);

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
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();

      // a little scene: the pools of this tide, with a creature above them
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u);
      ctx.clip();
      const sea = ctx.createLinearGradient(0, y, 0, y + art);
      sea.addColorStop(0, '#2b90cf');
      sea.addColorStop(0.62, '#78cfe8');
      sea.addColorStop(0.64, '#e9d3a2');
      sea.addColorStop(1, '#f3e3bd');
      ctx.fillStyle = sea;
      ctx.fillRect(x, y, cw, art + 12 * u);
      const pn = L.pools;
      for (let k = 0; k < pn; k++) {
        const pw2 = (cw - 26 * u) / pn;
        const px = x + 13 * u + k * pw2 + pw2 / 2;
        const py = y + art * 0.82;
        this.art.paintPool(ctx, { x: px - pw2 * 0.42, y: py - pw2 * 0.3, w: pw2 * 0.84, h: pw2 * 0.6 }, 0, k, 0);
      }
      paintCreature(ctx, (['crab', 'fish', 'star', 'jelly', 'shell'] as const)[i % 5],
        x + cw * 0.5, y + art * 0.33, art * 0.2, (['red', 'blue', 'yellow', 'green'] as const)[i % 4],
        L.dims.indexOf('spots') >= 0 ? 3 : 0, this.t, false);
      if (!open) {
        ctx.fillStyle = 'rgba(228, 238, 242, 0.84)';
        ctx.fillRect(x, y, cw, art + 12 * u);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.55)';
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.68)';
      ctx.font = this.font('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 28 * u, cw - 28 * u);
      for (let sI = 0; sI < 3; sI++) drawStarGem(ctx, x + 22 * u + sI * 20 * u, y + art + 46 * u, 8 * u, sI < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
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
