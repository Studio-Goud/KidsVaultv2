/**
 * Postbode Suri: the street scrolls under a drag, a letter names a number, and the child finds
 * the house and taps its door.
 *
 * It practises reading numbers off doors, the order of numbers along a row, odd and even on the two
 * sides of a street, and counting on from a neighbour when a tree hides a number. A wrong door is two
 * soft knocks, Suri says which number it was and which one we want, and the letter stays: nothing is
 * lost and nothing runs out. Stars are a product decision: letters delivered at the first try.
 *
 * The simple shape for two and three (`src/platform/who.ts`) is five houses on one screen, no
 * scrolling and no stars, and the right door glows softly after a few seconds.
 *
 * Dutch first. Everything that matters is said out loud with `say()`; the card at the top is what a
 * grown-up reads, and tapping it says the line again.
 */

import { clamp, TAU } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, recordLevelResult } from '../../util/storage';
import {
  askLine, DONE_LINE, GLOW_AFTER, GLOW_AFTER_MISS, isRight, LEVELS, nextLetter, PARCEL_LINE, rngFor, rowLength, SIMPLE_LEVEL,
  starsFor, street, wrongLine, type House, type Letter, type Level,
} from './model';
import { postSfx } from './postbodesfx';
import {
  geom, paintBag, paintChevron, paintHouse, paintLetter, paintPavement, paintRoad, paintSky,
} from './paint';
import {
  bleedEdges, chunkyButton, drawStar as drawStarGem, easeInOut, easeOutBack, glassPanel, heading, Particles,
} from '../../render/look';
import { drawGuide } from '../../platform/guide';
import { NL, T, lang } from '../../util/lang';
import { speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `postbode:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Anim { kind: 'fly' | 'open' | 'bounce'; n: number; t: number; dur: number }
interface Lay {
  u: number; pitch: number; hw: number; hh: number; two: boolean; cols: number; left0: number;
  nearBase: number; farBase: number; curbY: number; curbH: number; roadY: number; roadH: number; pavY: number; pavH: number;
}

export class Postbode {
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
  private rng = rngFor(LEVELS[0], 0);
  private attempt = 0;
  private houses: House[] = [];
  private used: number[] = [];
  private letter: Letter | null = null;
  /** parcel only: 0 look for the number, 1 ring the bell */
  private step = 0;
  private missedThis = false;
  private firstTry = 0;
  private delivered = 0;
  private wrongTaps = 0;
  private askIn = 0;
  private anim: Anim | null = null;
  private earned = 0;
  private cardPop = 0;

  private cam = 0;
  private camGoal: number | null = null;
  private vel = 0;
  private walkT = 0;
  private walkPhase = 0;
  private facing: 1 | -1 = 1;
  private drag: { x0: number; cam0: number; id: string | null; moved: boolean; lastX: number; lastT: number } | null = null;
  private shake: Record<number, number> = {};
  private glowT = 0;
  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private note = '';
  private noteT = 0;
  private cardRect = { x: 0, y: 0, w: 0, h: 0 };
  private easy = simpleNow();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __post?: Postbode }).__post = this;
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
    if (this.easy) this.start(0);
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  canBack(): boolean { return this.phase !== 'levels' && !this.easy; }
  back(): void { if (this.easy) return; this.phase = 'levels'; this.cardPop = 0; }

  /** The last thing said, so the guide button in the corner can say it again. */
  spoken(): string { return this.note; }

  private say(text: string, secs = 4): void {
    this.note = text; this.noteT = secs;
    speakLine(text);
  }

  debugState(): Record<string, unknown> {
    const lay = this.lay();
    const target = this.letter ? this.houseRect(lay, this.letter.n) : null;
    return {
      phase: this.phase, level: this.level.id, easy: this.easy, letter: this.letter, step: this.step, delivered: this.delivered,
      firstTry: this.firstTry, wrongTaps: this.wrongTaps, earned: this.earned, cam: Math.round(this.cam), camMax: Math.round(this.camMax(lay)),
      anim: this.anim ? this.anim.kind : null, note: this.note, pitch: Math.round(lay.pitch),
      target: target ? { n: this.letter!.n, x: Math.round(target.x + target.w / 2), y: Math.round(target.y + target.h / 2), visible: target.vis >= 0.35 } : null,
      visibleHouses: this.hits.filter(h => h.id.startsWith('house:') || h.id === 'bell').map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  /** Test hook: put house `n` in the middle of the screen. */
  debugCenter(n: number): void {
    const lay = this.lay();
    const h = this.houses.find(k => k.n === n);
    if (!h) return;
    this.cam = clamp(lay.left0 + h.index * lay.pitch + lay.pitch / 2 - this.w / 2, 0, this.camMax(lay));
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
   * Where the street sits. The height of a house comes from what is left under the letter card, the
   * width of a screen only decides how many houses are in view: at least six on a phone on its side.
   * The block of street is centred in what is left, so a tall screen shows more sky, not stretched houses.
   */
  private lay(): Lay {
    const u = this.u(), w = this.w, h = this.h;
    const two = this.level.sides === 'two';
    const top = 70 * u, bottomM = 8 * u, pavH = 54 * u, roadH = two ? 30 * u : 0, curbH = two ? 8 * u : 0;
    const area = h - top - bottomM;
    const rows = two ? 2 : 1;
    const maxHH = (area - pavH - roadH - curbH) / rows;
    const cols = rowLength(this.level);
    const basePitch = this.easy ? (w - 16 * u) / cols : (w > h ? w / 6.4 : w / 2.8);
    const pitch = Math.min(basePitch, maxHH / 1.25);
    const hh = Math.min(pitch * 1.5, maxHH);
    const hw = pitch * 0.9;
    const blockH = rows * hh + pavH + roadH + curbH;
    const blockTop = top + Math.max(0, (area - blockH) * 0.8);
    const farBase = blockTop + hh;
    const curbY = farBase, roadY = farBase + curbH;
    const nearBase = two ? roadY + roadH + hh : blockTop + hh;
    const left0 = this.easy ? (w - cols * pitch) / 2 : 8 * u;
    return { u, pitch, hw, hh, two, cols, left0, nearBase, farBase, curbY, curbH, roadY, roadH, pavY: nearBase, pavH };
  }

  private camMax(l: Lay): number { return this.easy ? 0 : Math.max(0, 2 * l.left0 + l.cols * l.pitch - this.w); }

  private houseX(l: Lay, index: number): number { return l.left0 + index * l.pitch + (l.pitch - l.hw) / 2 - this.cam; }

  /** A house's tappable box, and how much of it is on screen (0..1). */
  private houseRect(l: Lay, n: number): { x: number; y: number; w: number; h: number; vis: number } | null {
    const hs = this.houses.find(k => k.n === n);
    if (!hs) return null;
    const base = hs.side === 'near' ? l.nearBase : l.farBase;
    const hx = this.houseX(l, hs.index);
    const x0 = Math.max(0, hx), x1 = Math.min(this.w, hx + l.hw);
    return { x: x0, y: base - l.hh, w: Math.max(0, x1 - x0), h: l.hh, vis: Math.max(0, x1 - x0) / l.hw };
  }

  // ---------- rounds ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = this.easy ? SIMPLE_LEVEL : LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.houses = street(this.level, this.rng);
    this.used = []; this.letter = null; this.step = 0; this.missedThis = false;
    this.firstTry = 0; this.delivered = 0; this.wrongTaps = 0; this.earned = 0;
    this.anim = null; this.cam = 0; this.camGoal = null; this.vel = 0; this.shake = {};
    this.ps.clear();
    this.phase = 'play'; this.phaseT = 0; this.cardPop = 0;
    // the rule of a level is said once, the first time it is played; after that the letter is enough
    const seen = !this.easy && levelProgress(saveKey(this.level)).completed;
    if (this.easy || seen) { this.askIn = 0.6; this.note = ''; }
    else { this.say(NL() ? this.level.hintNl : this.level.hint, 5); this.askIn = 4.2; }
  }

  private pickLetter(): void {
    const l = nextLetter(this.level, this.rng, this.houses, this.used);
    this.used.push(l.n);
    this.letter = l; this.step = 0; this.missedThis = false; this.glowT = 0;
    this.say(askLine(l, lang()), 4);
  }

  private finish(): void {
    this.letter = null;
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    this.earned = this.easy ? 3 : starsFor(this.firstTry);
    // stars by letters delivered at the first try; the simple shape writes nothing down
    if (!this.easy) recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
    postSfx.complete();
    this.say(NL() ? DONE_LINE.nl : DONE_LINE.en, 3);
  }

  // ---------- update ----------

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.ps.update(dt);
    for (const k of Object.keys(this.shake)) { const n = Number(k); this.shake[n] = Math.max(0, this.shake[n] - dt * 2.2); }
    if (this.phase !== 'play') return;

    // the street: a drag, a little momentum after it, and the camera that walks to a house by itself
    const lay = this.lay();
    const max = this.camMax(lay);
    const before = this.cam;
    if (!this.drag) {
      if (this.camGoal !== null) {
        this.cam += (this.camGoal - this.cam) * Math.min(1, dt * 6);
        if (Math.abs(this.camGoal - this.cam) < 0.5) this.camGoal = null;
      } else if (Math.abs(this.vel) > 8) {
        this.cam += this.vel * dt; this.vel *= Math.exp(-dt * 4.5);
      } else this.vel = 0;
    }
    this.cam = clamp(this.cam, 0, max);
    const moved = this.cam - before;
    if (Math.abs(moved) > 0.15) { this.walkT = 0.25; this.walkPhase += Math.abs(moved) * 0.1; this.facing = moved > 0 ? 1 : -1; }
    this.walkT = Math.max(0, this.walkT - dt);

    if (this.letter) this.glowT += dt;
    if (!this.letter && !this.anim && this.askIn > 0) {
      this.askIn -= dt;
      if (this.askIn <= 0) this.pickLetter();
    }

    const a = this.anim;
    if (a) {
      a.t += dt;
      if (a.kind === 'fly' && a.t >= a.dur) {
        this.anim = { kind: 'open', n: a.n, t: 0, dur: 2.1 };
        postSfx.door(); postSfx.right();
        const r = this.houseRect(lay, a.n);
        if (r) {
          this.ps.spawn('spark', r.x + r.w / 2, r.y + r.h * 0.7, 12, { colour: '#ffe28a', speed: 140, size: 7, max: 0.8, spread: TAU });
          this.ps.spawn('heart', r.x + r.w / 2, r.y + r.h * 0.55, 3, { colour: '#ff8aa0', speed: 70, size: 10, max: 1.2 });
        }
      } else if (a.kind === 'bounce' && a.t >= a.dur) {
        this.anim = null; this.step = 1;
        const r = this.houseRect(lay, a.n);
        if (r) this.camGoal = clamp(this.cam + (r.x + r.w / 2 - this.w / 2), 0, max);
      } else if (a.kind === 'open' && a.t >= a.dur) {
        this.anim = null; this.letter = null;
        if (this.delivered >= this.level.letters) this.finish(); else this.askIn = 0.5;
      }
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: { x: number; y: number }): string | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const b = this.hits[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b.id;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const id = this.hitAt(p);
    if (id && !id.startsWith('house:') && id !== 'bell') {
      this.held0 = id;
      if (id.startsWith('level:')) { const i = Number(id.slice(6)); if (this.unlocked(i)) this.start(i); else postSfx.knock(); }
      else if (id === 'levels') { this.phase = 'levels'; this.cardPop = 0; postSfx.tap(); }
      else if (id === 'retry') this.start(this.levelIndex);
      else if (id === 'next') this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1));
      else if (id === 'letter') { postSfx.tap(); if (this.note) { this.noteT = 4; speakLine(this.note); } }
      return;
    }
    if (this.phase !== 'play') return;
    this.drag = { x0: p.x, cam0: this.cam, id, moved: false, lastX: p.x, lastT: performance.now() };
    this.camGoal = null; this.vel = 0;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has none */ }
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const p = this.at(e), u = this.u();
    if (Math.abs(p.x - d.x0) > 10 * u) d.moved = true;
    if (!d.moved) return;
    const lay = this.lay();
    const old = this.cam;
    this.cam = clamp(d.cam0 - (p.x - d.x0), 0, this.camMax(lay));
    const now = performance.now(), dtm = Math.max(1, now - d.lastT) / 1000;
    this.vel = this.vel * 0.6 + ((this.cam - old) / dtm) * 0.4;
    d.lastX = p.x; d.lastT = now;
  }

  private onUp(e: PointerEvent): void {
    this.held0 = null;
    const d = this.drag;
    this.drag = null;
    if (!d || this.phase !== 'play') return;
    if (d.moved) { if (performance.now() - d.lastT > 90) this.vel = 0; return; }
    const p = this.at(e);
    const id = this.hitAt(p) ?? d.id;
    if (id === 'bell') this.tapHouse(this.letter ? this.letter.n : -1, true);
    else if (id && id.startsWith('house:')) this.tapHouse(Number(id.slice(6)), false);
  }

  private tapHouse(n: number, bell: boolean): void {
    const L = this.letter;
    if (!L || this.anim || n < 0) return;
    const right = isRight(L, n);
    if (right && (!L.parcel || bell)) {
      this.delivered++;
      if (!this.missedThis) this.firstTry++;
      if (L.parcel) postSfx.bell();
      postSfx.slot();
      this.anim = { kind: 'fly', n, t: 0, dur: 0.75 };
      this.glowT = 0;
      return;
    }
    if (right && L.parcel) {
      // too big for the slot: the parcel bounces back, and the bell is the next thing to press
      postSfx.slot();
      this.anim = { kind: 'bounce', n, t: 0, dur: 1 };
      this.say(NL() ? PARCEL_LINE.nl : PARCEL_LINE.en, 5);
      return;
    }
    // not this one: two soft knocks, the letter stays, and the question is asked again
    this.missedThis = true; this.wrongTaps++;
    this.shake[n] = 0.6;
    postSfx.knock();
    this.glowT = Math.max(this.glowT, GLOW_AFTER - GLOW_AFTER_MISS);
    this.say(wrongLine(n, L.n, lang()), 5);
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }
    const lay = this.lay();
    this.drawStreet(lay);
    this.drawCard(lay);
    if (this.phase === 'won') this.drawEnd();
    ctx.textAlign = 'left';
  }

  private drawStreet(l: Lay): void {
    const ctx = this.ctx, u = l.u, w = this.w;
    paintSky(ctx, w, this.h, this.cam, this.t);
    // the ground under everything, so a short street still stands on something
    ctx.fillStyle = '#e3dccd'; ctx.fillRect(0, l.pavY, w, this.h - l.pavY);
    if (l.two) {
      paintPavement(ctx, 0, l.curbY, w, l.curbH, this.cam, 40 * u);
      paintRoad(ctx, 0, l.roadY, w, l.roadH, this.cam);
    }
    const first = Math.max(0, Math.floor((this.cam - l.left0) / l.pitch) - 1);
    const last = Math.min(l.cols - 1, Math.ceil((this.cam + w - l.left0) / l.pitch) + 1);
    const L = this.letter;
    const a = this.anim;
    const rows: Array<'far' | 'near'> = l.two ? ['far', 'near'] : ['near'];
    for (const side of rows) {
      const base = side === 'near' ? l.nearBase : l.farBase;
      if (side === 'near') paintPavement(ctx, 0, l.pavY, w, l.pavH, this.cam, 54 * u);
      for (let i = first; i <= last; i++) {
        const hs = this.houses.find(k => k.side === side && k.index === i);
        if (!hs) continue;
        const hx = this.houseX(l, i);
        const isTarget = !!L && L.n === hs.n;
        const bellStep = isTarget && L!.parcel && this.step === 1 && !a;
        let open = 0;
        if (a && a.n === hs.n && a.kind === 'open') open = a.t < 0.35 ? easeOutBack(a.t / 0.35) : a.t > a.dur - 0.4 ? clamp((a.dur - a.t) / 0.4, 0, 1) : 1;
        const glow = this.easy && isTarget && !a && this.glowT > GLOW_AFTER ? clamp((this.glowT - GLOW_AFTER) / 1.2, 0, 1) : 0;
        const draw = (): void => paintHouse(ctx, {
          x: hx, base, w: l.hw, h: l.hh, n: hs.n, hidden: hs.hidden && !(a && a.n === hs.n && a.kind === 'open'), open, resident: hs.resident,
          glow, bell: this.level.parcel, bellPulse: bellStep ? 1 : 0, shake: this.shake[hs.n] ?? 0, t: this.t,
        });
        draw();
        // tappable while it is at least a third in view
        const x0 = Math.max(0, hx), x1 = Math.min(w, hx + l.hw);
        if ((x1 - x0) / l.hw >= 0.35) {
          this.hits.push({ id: bellStep ? 'bell' : `house:${hs.n}`, x: x0, y: base - l.hh, w: x1 - x0, h: l.hh });
        }
      }
    }
    // Suri on the pavement, walking when the street moves
    const sx = clamp(w * 0.22, 50 * u, w * 0.35);
    const walking = this.walkT > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkPhase)) * 4 * u : 0;
    const size = Math.min(l.pavH * 1.5, 86 * u);
    const sy = l.pavY + l.pavH * 0.9 - bob;
    const cheer = !!a && a.kind === 'open';
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(walking ? Math.sin(this.walkPhase) * 0.04 : 0); ctx.translate(-sx, -sy);
    drawGuide(ctx, sx, sy, size, { pose: cheer ? 'cheer' : this.noteT > 0 ? 'talk' : 'watch', t: this.t, facing: this.facing });
    paintBag(ctx, sx, sy, size, this.facing);
    ctx.restore();

    this.ps.draw(ctx);

    // the letter in flight, from the card to the slot (the parcel to the door, and back when it does not fit)
    if (a && (a.kind === 'fly' || a.kind === 'bounce') && L) {
      const r = this.houseRect(l, a.n);
      if (r) {
        const hs = this.houses.find(k => k.n === a.n)!;
        const base = hs.side === 'near' ? l.nearBase : l.farBase;
        const g = geom(this.houseX(l, hs.index), base, l.hw, l.hh);
        const tx = L.parcel ? g.door.x + g.door.w / 2 : g.slot.x, ty = L.parcel ? g.door.y + g.door.h * 0.4 : g.slot.y;
        const c = this.cardRect;
        const sx0 = c.x + 8 * u + 32 * u, sy0 = c.y + 7 * u + 21 * u;
        const f = a.kind === 'bounce' ? easeInOut(1 - Math.abs(1 - 2 * clamp(a.t / a.dur, 0, 1))) * 0.92 : easeInOut(clamp(a.t / a.dur, 0, 1));
        const x = sx0 + (tx - sx0) * f, y = sy0 + (ty - sy0) * f - Math.sin(f * Math.PI) * 30 * u;
        const k = 1 - f * 0.62;
        paintLetter(ctx, x - 32 * u * k, y - 21 * u * k, 64 * u * k, 42 * u * k, f < 0.5 ? L.n : null, L.parcel, (1 - f) * -0.2);
      }
    }

    // a hint that there is more street to either side
    if (this.camMax(l) > 0) {
      // on the pavement, where nothing else is, rather than over the numbers
      const my = l.pavY + l.pavH * 0.5;
      const al = 0.55 + 0.25 * Math.sin(this.t * 3);
      if (this.cam > 4) paintChevron(ctx, 16 * u, my, 13 * u, -1, al);
      if (this.cam < this.camMax(l) - 4) paintChevron(ctx, w - 16 * u, my, 13 * u, 1, al);
    }
  }

  /** The card at the top: the letter that is waiting, and the line Suri just said. Tap to hear it again. */
  private drawCard(l: Lay): void {
    const ctx = this.ctx, u = l.u;
    const cw = Math.min(310 * u, this.w - 10 * u - 118), ch = 56 * u;
    const x = 10 * u, y = 6 * u;
    this.cardRect = { x, y, w: cw, h: ch };
    glassPanel(ctx, x, y, cw, ch, 16 * u, 0.94);
    const a = this.anim;
    if (this.letter && !(a && (a.kind === 'fly' || (a.kind === 'bounce' && a.t > 0.05 && a.t < a.dur - 0.05)))) {
      paintLetter(ctx, x + 8 * u, y + 7 * u, 64 * u, 42 * u, this.letter.n, this.letter.parcel);
    } else if (!this.letter) {
      ctx.fillStyle = 'rgba(18,48,71,0.12)'; ctx.beginPath(); ctx.roundRect(x + 8 * u, y + 7 * u, 64 * u, 42 * u, 5 * u); ctx.fill();
    }
    ctx.fillStyle = '#123047'; ctx.textAlign = 'left';
    ctx.font = this.font('800', 12.5);
    const text = this.note || (this.letter ? askLine(this.letter, lang()) : '');
    const maxW = cw - 86 * u;
    const words = text.split(' '), lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const tryLine = cur ? `${cur} ${wd}` : wd;
      if (cur && ctx.measureText(tryLine).width > maxW) { lines.push(cur); cur = wd; } else cur = tryLine;
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 3);
    const lh = 15 * u, y0 = y + ch / 2 - ((shown.length - 1) * lh) / 2 + 4.5 * u;
    shown.forEach((s, i) => ctx.fillText(s, x + 80 * u, y0 + i * lh, maxW));
    this.hits.push({ id: 'letter', x, y, w: cw, h: ch });
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fdfbf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink; ctx.font = this.font('900', 15); ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 18);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(8, 26, 44, 0.5)'; ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(340 * u, this.w - 32 * u), ch = Math.min(262 * u, this.h - 24 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2); ctx.scale(pop, pop); ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, T('All the post is delivered', 'Alle post is bezorgd'), this.w / 2, y + 46 * u, this.font('900', 19), '#123047');
    if (!this.easy) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + 94 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.fillStyle = 'rgba(18,48,71,0.72)'; ctx.font = this.font('700', 12.5);
    const line = this.easy ? T('Every letter has found its house.', 'Elke brief heeft zijn huis gevonden.')
      : T(`${this.firstTry} of ${this.level.letters} at the first try`, `${this.firstTry} van de ${this.level.letters} meteen goed`);
    ctx.fillText(line, this.w / 2, y + (this.easy ? 100 : 140) * u, cw - 40 * u);
    ctx.restore();
    // the buttons are not part of the pop, so a tap lands where it is drawn
    const bw = 138 * u, bh = 48 * u, by = y + ch - 70 * u;
    this.hits = [];
    if (this.easy) { this.button('retry', T('One more', 'Nog een keer'), this.w / 2 - bw / 2, by, bw, bh, '#4fae6e', '#ffffff'); return; }
    this.button('retry', T('One more', 'Nog een keer'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next', 'Volgende'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All streets', 'Alle straten'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    paintSky(ctx, this.w, this.h, 0, this.t);
    ctx.textAlign = 'center';
    heading(ctx, 'Postbode Suri', this.w / 2, 46 * u, this.font('900', 26), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.75)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Find the house with the number on the letter.', 'Zoek het huis met het nummer van de brief.'), this.w / 2, 68 * u, this.w - 24 * u);
    const cols = this.w > 600 ? 3 : 1;
    const pad = 10 * u;
    const cw = Math.min(cols === 1 ? 360 * u : 250 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const chh = 72 * u;
    const rows = Math.ceil(LEVELS.length / cols);
    const needed = rows * chh + (rows - 1) * pad;
    const listTop = 90 * u;
    const squeeze = Math.min(1, (this.h - listTop - 14 * u) / needed);
    const total = cols * cw + (cols - 1) * pad, x0 = (this.w - total) / 2;
    ctx.save();
    ctx.translate(this.w / 2, listTop); ctx.scale(squeeze, squeeze); ctx.translate(-this.w / 2, -listTop);
    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.28)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 4 * u;
      ctx.fillStyle = open ? '#fffdf8' : '#e8eef0';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();
      ctx.fillStyle = open ? '#2f6fb0' : '#9aa9b2';
      ctx.beginPath(); ctx.arc(x + 32 * u, y + chh / 2, 20 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = this.font('900', 20); ctx.textAlign = 'center';
      ctx.fillText(String(L.id), x + 32 * u, y + chh / 2 + 7 * u);
      ctx.textAlign = 'left'; ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.6)';
      ctx.font = this.font('900', 15);
      ctx.fillText(nameOf(L), x + 62 * u, y + 29 * u, cw - 74 * u);
      for (let s = 0; s < 3; s++) drawStarGem(ctx, x + 70 * u + s * 20 * u, y + 51 * u, 8 * u, s < p.stars);
      if (!open) {
        ctx.fillStyle = 'rgba(18,48,71,0.55)'; ctx.font = this.font('700', 11);
        ctx.fillText(T('First the street before it', 'Eerst de vorige straat'), x + 62 * u + 70 * u, y + 55 * u, cw - 150 * u);
      }
      this.hits.push({
        id: `level:${i}`, x: this.w / 2 + (x - this.w / 2) * squeeze, y: listTop + (y - listTop) * squeeze, w: cw * squeeze, h: chh * squeeze,
      });
    });
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

