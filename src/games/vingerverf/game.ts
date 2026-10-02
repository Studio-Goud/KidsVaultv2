/**
 * Vingerverf - the painting game in Suri.
 *
 * A sheet of paper, six pots (three for a child of two or three) and a finger. Tap a pot to dip,
 * drag to paint. A dip lasts a certain length; the stroke thins and dries as it goes and then you
 * dip again. Wet strokes mix where they cross, the way paint does. "Klaar" hangs the painting on
 * the wall with Suri looking at it.
 *
 * It practises making marks with a finger and trying colours against each other; it does not
 * claim a child will learn their colours from it. Nothing is saved: a gallery would need a save
 * slice (decisions.md), and a score would be the wrong thing to give a painting.
 */

import { clamp, type Vec } from '../../util/math';
import { safeArea, uiScale, GUIDE_KEEP } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { bleedEdges, chunkyButton, easeInCubic, easeOutBack, grainOver, outlinedText } from '../../render/look';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';
import { drawGuide } from '../../platform/guide';
import {
  colourLine, colourName, DIP_SCREENS, drynessFor, LINES, loadAfter, opacityFor, potsFor, radiusFor, Seen, type ColourName, type Pot,
} from './model';
import { drawFramed, drawPot, drawSheet, paintTable, paintWall, Sheet } from './paint';
import { vingerverfSfx as sfx } from './vingerverfsfx';

type Ctx = CanvasRenderingContext2D;
type Phase = 'paint' | 'done';

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

const line = (l: readonly [string, string]): string => T(l[0], l[1]);

/** the least time between two spoken colour names; a name that has to wait is not marked as seen */
const NAME_GAP = 1.6;
/** mixed pixels it takes before a colour counts as having appeared (about a fingertip of it) */
const MIXED_PX = 40;
/** brush radius in CSS pixels at the reference screen: product decision, thick for a finger */
const BRUSH = { full: 15, simple: 22 };
/** the longest a stroke is walked in one go, so a hitch in the frame rate cannot skip the paper */
const MAX_STEPS = 400;

export class Vingerverf {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private fullW = 0;
  private st = 0; private sb = 0; private sl = 0; private sr = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'paint';
  private phaseT = 0;
  private easy = simpleNow();
  private pots: Pot[] = potsFor(this.easy);
  private pot: Pot | null = null;
  private load = 0;
  private sheet: Sheet | null = null;
  private sheetScale = 1;
  private paper: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private wipe: { canvas: HTMLCanvasElement; t0: number } | null = null;
  private seen = new Seen();
  private strokeId = 0;
  private strokes = 0;
  private painting = false;
  private pointer = -1;
  private last: Vec = { x: 0, y: 0 };
  /** mixed pixels laid so far, by the name of the colour they came out as */
  private tally = new Map<string, { n: number; name: ColourName }>();
  private lastName = -10;
  private lastSwish = -10;
  private saidEmpty = false;
  private wobble = 0;
  private note = '';
  private hits: Hit[] = [];
  private pressed: string | null = null;
  private againSaid = false;
  private frame = document.createElement('canvas');

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __verf?: Vingerverf }).__verf = this;
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
    this.say(line(LINES.intro));
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  /** From the klaar screen, back to the sheet to paint on; there is nowhere else to go back to. */
  canBack(): boolean { return this.phase === 'done'; }
  back(): void { if (this.phase === 'done') { this.phase = 'paint'; this.phaseT = 0; } }

  spoken(): string { return this.note; }

  private say(text: string): void {
    this.note = text;
    speakLine(text);
  }

  /** The colour of the sheet at a point in sheet pixels, for a test to read. */
  colourAt(x: number, y: number): number[] { return this.sheet ? [...this.sheet.colourAt(x, y)] : [0, 0, 0]; }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, easy: this.easy, pot: this.pot?.id ?? null, load: Math.round(this.load * 1000) / 1000,
      strokes: this.strokes, seen: this.seen.list(), painting: this.painting,
      paper: { x: Math.round(this.paper.x), y: Math.round(this.paper.y), w: Math.round(this.paper.w), h: Math.round(this.paper.h) },
      sheet: this.sheet ? { w: this.sheet.w, h: this.sheet.h } : null,
      safe: { w: this.w, h: this.h, st: this.st, sl: this.sl },
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }
  private landscape(): boolean { return this.w > this.h; }

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
    this.paper = this.paperRect();
    this.fit();
  }

  /** The paint buffer matches the paper; when the paper changes shape the old picture is carried over. */
  private fit(): void {
    const p = this.paper;
    // one buffer pixel per CSS pixel at most 1.5, and never more than about two million pixels
    const scale = Math.min(1.5, this.dpr, Math.sqrt(2.0e6 / Math.max(1, p.w * p.h)));
    const bw = Math.max(1, Math.round(p.w * scale)), bh = Math.max(1, Math.round(p.h * scale));
    if (this.sheet && this.sheet.w === bw && this.sheet.h === bh) { this.sheetScale = bw / p.w; return; }
    const old = this.sheet;
    this.sheet = new Sheet(bw, bh);
    this.sheetScale = bw / p.w;
    if (old && this.strokes > 0) this.sheet.adopt(old.canvas);
  }

  private topBar(): number { return 60; }

  private potSize(): number {
    const u = this.u(), n = this.pots.length;
    const gap = 8 * u;
    if (this.landscape()) {
      const rows = this.easy ? n : Math.ceil(n / 2);
      const avail = this.h - this.topBar() - 26;
      return Math.min((this.easy ? 104 : 66) * u, (avail - gap * (rows - 1)) / rows);
    }
    const avail = this.w - GUIDE_KEEP - 10;
    return Math.min((this.easy ? 96 : 64) * u, (avail - gap * (n - 1)) / n);
  }

  private potRects(): Rect[] {
    const u = this.u(), n = this.pots.length, s = this.potSize(), gap = 8 * u;
    if (this.landscape()) {
      const cols = this.easy ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const x0 = this.w - 10 - cols * s - (cols - 1) * gap;
      const y0 = this.topBar() + 8 + Math.max(0, (this.h - this.topBar() - 26 - (rows * s + (rows - 1) * gap)) / 2);
      return this.pots.map((_, i) => ({ x: x0 + (i % cols) * (s + gap), y: y0 + Math.floor(i / cols) * (s + gap), w: s, h: s }));
    }
    const total = n * s + (n - 1) * gap;
    const avail = this.w - GUIDE_KEEP - 10;
    const x0 = GUIDE_KEEP + Math.max(0, (avail - total) / 2);
    return this.pots.map((_, i) => ({ x: x0 + i * (s + gap), y: this.h - s - 10, w: s, h: s }));
  }

  private paperRect(): Rect {
    const top = this.topBar();
    if (this.landscape()) {
      const left = GUIDE_KEEP + 6;
      const cols = this.easy ? 1 : 2;
      const panel = cols * this.potSize() + (cols - 1) * 8 * this.u() + 10;
      return { x: left, y: top, w: Math.max(40, this.w - panel - 12 - left), h: Math.max(40, this.h - top - 10) };
    }
    const potsTop = this.h - this.potSize() - 10;
    return { x: 10, y: top, w: Math.max(40, this.w - 20), h: Math.max(40, potsTop - 10 - top) };
  }

  // ---------- painting ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private dip(p: Pot): void {
    this.pot = p;
    this.load = 1;
    this.saidEmpty = false;
    sfx.pot();
    const name = colourName(p.rgb);
    if (this.seen.see(name.id)) { this.say(colourLine(name, NL())); this.lastName = this.t; }
  }

  private capacity(): number {
    const p = this.paper;
    return Math.max(p.w, p.h) * (this.easy ? DIP_SCREENS.simple : DIP_SCREENS.full);
  }

  private dabAt(p: Vec): void {
    if (!this.sheet || !this.pot) return;
    const u = this.u();
    const base = (this.easy ? BRUSH.simple : BRUSH.full) * u;
    const r = radiusFor(this.load, base) * this.sheetScale;
    const res = this.sheet.dab((p.x - this.paper.x) * this.sheetScale, (p.y - this.paper.y) * this.sheetScale, r,
      this.pot.rgb, opacityFor(this.load), drynessFor(this.load), this.strokeId, this.t);
    if (res.mixed >= 6) {
      const name = colourName([res.r / res.mixed, res.g / res.mixed, res.b / res.mixed]);
      const row = this.tally.get(name.id) ?? { n: 0, name };
      row.n += res.mixed;
      this.tally.set(name.id, row);
    }
  }

  private inPaper(p: Vec): boolean {
    const r = this.paper;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  private beginStroke(p: Vec): void {
    if (!this.pot) { this.say(line(LINES.pickPot)); this.wobble = 1; return; }
    if (this.load <= 0) { this.runDry(); return; }
    this.strokeId = this.strokeId >= 65534 ? 1 : this.strokeId + 1;
    if (this.strokeId === 1) this.sheet?.forgetStrokes();
    this.painting = true;
    this.strokes++;
    this.last = p;
    this.load = loadAfter(this.load, 2, this.capacity());
    this.dabAt(p);
  }

  private runDry(): void {
    this.painting = false;
    this.wobble = 1;
    sfx.empty();
    // once a sheet: the line is said, after that the wobbling pot and the dry sound are enough
    if (!this.saidEmpty) { this.saidEmpty = true; this.say(line(LINES.empty)); }
  }

  private moveStroke(p: Vec): void {
    const dx = p.x - this.last.x, dy = p.y - this.last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const u = this.u();
    const spacing = Math.max(1.2, (this.easy ? BRUSH.simple : BRUSH.full) * u * 0.22);
    const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(dist / spacing)));
    const len = dist / steps;
    for (let i = 1; i <= steps; i++) {
      this.load = loadAfter(this.load, len, this.capacity());
      this.dabAt({ x: this.last.x + dx * i / steps, y: this.last.y + dy * i / steps });
      if (this.load <= 0) { this.last = p; this.runDry(); return; }
    }
    this.last = p;
    if (this.t - this.lastSwish > 0.45) { this.lastSwish = this.t; sfx.swish(); }
  }

  private newSheet(withWipe: boolean): void {
    if (this.sheet && withWipe && this.strokes > 0) {
      const c = document.createElement('canvas');
      c.width = this.sheet.w; c.height = this.sheet.h;
      c.getContext('2d')!.drawImage(this.sheet.canvas, 0, 0);
      this.wipe = { canvas: c, t0: this.t };
      sfx.wipe();
    }
    this.sheet?.clear();
    this.strokes = 0; this.painting = false; this.load = 0; this.pot = null; this.saidEmpty = false;
    this.strokeId = 0;
    this.tally.clear();
    this.say(line(LINES.fresh));
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
    // one finger paints; a second one resting on the screen is ignored, and a stale pointer never blocks a new one
    if (!e.isPrimary) return;
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) {
      this.pressed = hit;
      this.pointer = e.pointerId;
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
      return;
    }
    if (this.phase !== 'paint' || !this.inPaper(p)) return;
    this.pointer = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
    this.beginStroke(p);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointer || !this.painting) return;
    const p = this.at(e);
    // the stroke stops at the edge of the paper and carries on if the finger comes back
    const r = this.paper;
    this.moveStroke({ x: clamp(p.x, r.x, r.x + r.w), y: clamp(p.y, r.y, r.y + r.h) });
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    this.pointer = -1;
    this.painting = false;
    const p = this.at(e);
    const was = this.pressed;
    this.pressed = null;
    // a button fires on release over itself, so a finger that slid away has changed its mind
    if (was && e.type === 'pointerup' && this.hitAt(p) === was) this.press(was);
  }

  private press(id: string): void {
    if (id.startsWith('pot:')) {
      const pot = this.pots.find(q => q.id === id.slice(4));
      if (pot) this.dip(pot);
    } else if (id === 'new') {
      sfx.tap();
      this.newSheet(true);
    } else if (id === 'done') {
      if (this.strokes === 0) { this.say(line(LINES.paintFirst)); this.wobble = 1; return; }
      sfx.done();
      this.phase = 'done'; this.phaseT = 0; this.againSaid = false;
      this.frame.width = this.sheet!.w; this.frame.height = this.sheet!.h;
      this.frame.getContext('2d')!.drawImage(this.sheet!.canvas, 0, 0);
      this.say(line(LINES.done));
    } else if (id === 'again') {
      sfx.tap();
      this.newSheet(false);
      this.phase = 'paint'; this.phaseT = 0;
    }
  }

  // ---------- frame ----------

  private update(dt: number): void {
    this.phaseT += dt;
    this.wobble = Math.max(0, this.wobble - dt * 2.2);
    this.sheet?.flush();
    // a mixed colour is named once a fingertip of it exists, and not more often than Suri can say
    // it; one that has to wait stays in the tally and is said when it can be
    if (this.t - this.lastName > NAME_GAP) {
      for (const [id, row] of this.tally) {
        if (row.n < MIXED_PX || this.seen.has(id)) continue;
        this.seen.see(id);
        this.say(colourLine(row.name, NL()));
        this.lastName = this.t;
        break;
      }
    }
    if (this.phase === 'done' && !this.againSaid && this.phaseT > 3.4) { this.againSaid = true; this.say(line(LINES.again)); }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'done') { this.drawDone(); return; }
    this.drawPaint();
  }

  private label(text: string, r: Rect, tone: string, id: string): void {
    const ctx = this.ctx;
    const down = this.pressed === id;
    chunkyButton(ctx, r.x, r.y, r.w, r.h, { tone, pressed: down });
    ctx.save();
    ctx.font = this.font('900', 16);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b2a18';
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + (down ? 2 : 0), r.w - 12);
    ctx.restore();
    this.hits.push({ id, ...r });
  }

  private drawPaint(): void {
    const ctx = this.ctx, u = this.u();
    // the table runs under the notch and home bar too, and bleedEdges carries its edge on
    paintTable(ctx, this.w, this.h);
    grainOver(ctx, 0, 0, this.w, this.h, 0.07);
    const p = this.paper;
    drawSheet(ctx, this.sheet!.canvas, p.x, p.y, p.w, p.h);
    if (this.wipe) {
      const k = (this.t - this.wipe.t0) / 0.6;
      if (k >= 1) this.wipe = null;
      else {
        const dx = -easeInCubic(k) * (p.w + 40 * u);
        ctx.save();
        ctx.globalAlpha = 1 - k * k;
        drawSheet(ctx, this.wipe.canvas, p.x + dx, p.y - k * 10 * u, p.w, p.h);
        ctx.restore();
      }
    }
    // buttons: top left, because the home and back buttons are on the right
    const free = this.w - 124 - 10;
    const bw = Math.min(132 * u, (free - 8) / 2), bh = 44 * u;
    this.label(T('New sheet', 'Nieuw vel'), { x: 10, y: 8, w: bw, h: bh }, '#fff8ea', 'new');
    this.label(T('Done', 'Klaar'), { x: 18 + bw, y: 8, w: bw, h: bh }, '#9bdc8c', 'done');
    // pots
    const rects = this.potRects();
    this.pots.forEach((pot, i) => {
      const r = rects[i];
      drawPot(ctx, pot, r.x, r.y, r.w, { selected: this.pot?.id === pot.id, wobble: this.pot?.id === pot.id ? this.wobble : (this.pot ? 0 : this.wobble * 0.6), t: this.t });
      this.hits.push({ id: `pot:${pot.id}`, ...r });
    });
  }

  private drawDone(): void {
    const ctx = this.ctx, u = this.u();
    const land = this.landscape();
    const floorY = this.h - (land ? 60 : 70) * u;
    paintWall(ctx, this.w, this.h, floorY);
    // the framed painting, as big as the wall allows
    const reg: Rect = land
      ? { x: GUIDE_KEEP + 30, y: 60, w: this.w - GUIDE_KEEP - 30 - 230 * u, h: this.h - 60 - 30 }
      : { x: 34, y: 70, w: this.w - 68, h: this.h - 70 - 190 * u };
    const pad = 36 * u;
    const aw = this.paper.w, ah = this.paper.h;
    const k = Math.max(0.05, Math.min((reg.w - pad) / aw, (reg.h - pad) / ah));
    const fw = aw * k, fh = ah * k;
    const pop = easeOutBack(clamp(this.phaseT / 0.6, 0, 1));
    const cx = reg.x + reg.w / 2, cy = reg.y + reg.h / 2 + 10 * u;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop); ctx.rotate(-0.012);
    drawFramed(ctx, this.frame, -fw / 2, -fh / 2, fw, fh, u);
    ctx.restore();
    // Suri beside it, looking at it
    const sx = land ? this.w - 110 * u : this.w - 62 * u;
    const gy = land ? this.h - 24 : this.h - 18;
    const talking = this.phaseT < 3;
    drawGuide(ctx, sx, gy, (land ? 150 : 130) * u, { pose: talking ? 'talk' : 'watch', t: this.t, facing: -1, saying: talking ? (this.phaseT % 0.6) / 0.6 : 0 });
    // the line, and the way on
    const bw = 170 * u, bh = 54 * u;
    const again = land
      ? { x: this.w - 10 - bw, y: gy - 150 * u - bh - 16, w: bw, h: bh }
      : { x: GUIDE_KEEP + 8, y: this.h - bh - 12, w: bw, h: bh };
    this.label(T('Once more', 'Nog een keer'), again, '#ffd870', 'again');
    ctx.save();
    ctx.textAlign = 'left';
    outlinedText(ctx, line(LINES.done), 12, 40, this.font('900', 17), '#5a3b1e', 'rgba(255,255,255,0.9)', 5);
    ctx.restore();
  }
}
