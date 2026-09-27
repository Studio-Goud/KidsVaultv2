/**
 * The stage every story journey plays on.
 *
 * The owner asked for all the journeys - the time drill, the deep sea, space, the body - to become
 * stories you step into, each as elaborate as the first. What they share is most of the work: a
 * world all the way round you that you turn to look at, a script played one step at a time with
 * Ruth saying each line and the story waiting for the child, the words written underneath, an
 * animal somewhere in the circle to be found, the start and end buttons. That is this file.
 *
 * What a story adds is its own: which world each chapter happens in, the things a child does there
 * (brush sand, pull a lever, switch on the lamps), and the cues its script sends. A story is a
 * subclass that fills in the hooks at the bottom; nothing in here knows about teeth or submarines.
 */

import { unlockAudio } from '../util/audio';
import { GUIDE_KEEP, safeArea, uiScale } from '../util/ui';
import { bleedEdges, chunkyButton, glassPanel, outlinedText, Particles, vignette } from '../render/look';
import { NL, T } from '../util/lang';
import { forgetLine, isSpeaking, sayRecorded, speakLine } from '../platform/voice';
import { persist, save } from '../util/storage';
import { nextPlaceIn, readSeconds, type Aside, type Chapter, type Place, type Step } from './tale';
import { Look, wrapAngle } from './look';
import { drawBackdrop, drawProp, makeView, spot, type Palette, type Prop, type View } from './world';
import type { Life } from './life';

export type Ctx = CanvasRenderingContext2D;
export interface Pt { x: number; y: number }
interface Hit { id: string; x: number; y: number; w: number; h: number }

/** An animal somewhere in the circle round the camera: the one the chapter is about. */
export interface Beast {
  kind: string;
  x: number; z: number;
  /** metres per second, and which way (radians, world) */
  speed: number; heading: number;
  /** for animals that go round you in a circle instead of a straight line */
  orbit?: { r: number; a: number; w: number };
  phase: number;
  /** metres per stride, so the feet stay put on the ground */
  stride: number;
  head: number; jaw: number;
  /** metres above the ground: swimmers and fliers */
  lift: number;
}

export abstract class Stage {
  protected ctx: Ctx;
  protected dpr = 1;
  protected w = 0;
  protected h = 0;
  protected st = 0; protected sb = 0; protected sl = 0; protected sr = 0;
  protected fullW = 0; protected fullH = 0;
  protected t = 0;
  private raf = 0;
  protected look: Look;

  protected place: Place = { chapter: 0, step: 0 };
  protected stepT = 0;
  protected started = false;
  protected finished = false;
  protected flags = new Set<string>();
  protected line = '';
  private lineMin = 0;

  protected props: Prop[] = [];
  protected beast: Beast | null = null;
  protected life: Life | null = null;
  protected ps = new Particles();
  protected shake = 0;

  protected seenT = 0;
  protected lostT = 0;
  private hinted = false;
  private guideT = 0;
  protected titleT = 0;

  private hits: Hit[] = [];
  protected held: string | null = null;

  // ---------------------------------------------------------------- what a story supplies

  /** The id the story is saved and debugged under: `tand`, `diep`. */
  protected abstract readonly id: string;
  protected abstract readonly chapters: Chapter[];
  protected abstract readonly title: { en: string; nl: string };
  /** Said when the child has not found the animal after a while. */
  protected abstract readonly lookAround: Aside;
  /** Build the world a chapter happens in; called before its first step. */
  protected abstract setup(c: Chapter): void;
  protected abstract cue(name: string): void;
  protected abstract palette(): Palette;
  protected abstract drawBeast(v: View, b: Beast, pal: Palette): void;
  /** Start the chapter's background sound; also called when the story begins. */
  protected abstract ambience(): void;

  /** A scene that is not a world round you (the inside of the drill): draw it and return true. */
  protected drawScene(): boolean { return false; }
  /** More things standing in the world, sorted in with everything else. */
  protected worldItems(_v: View, _pal: Palette): Array<{ d: number; draw: () => void }> { return []; }
  /** Drawn over the world, under the words: light, a box of sand, a lamp beam. */
  protected drawOver(_v: View, _pal: Palette): void { /* nothing by default */ }
  /** Drawn over everything but the start and end buttons: things carried, badges. */
  protected drawUi(): void { /* nothing by default */ }
  /** A line under the chapter title: the years, the depth. */
  protected gauge(): string { return ''; }
  /** Per-frame work of the story's own. */
  protected tick(_dt: number): void { /* nothing by default */ }
  /** A finger down that the story wants; return true to keep it from turning the camera. */
  protected down(_p: Pt): boolean { return false; }
  protected drag(_p: Pt): boolean { return false; }
  protected release(): void { /* nothing by default */ }
  /** The moment the child finds the chapter's animal. */
  protected onFound(_b: Beast): void { /* nothing by default */ }
  /** Which way the animal faces on screen; the default is the way it is moving. */
  protected facingOf(b: Beast): -1 | 1 {
    const v = this.view();
    let nx: number, nz: number;
    if (b.orbit) { const a = b.orbit.a + Math.sign(b.orbit.w) * 0.05; nx = Math.sin(a) * b.orbit.r; nz = Math.cos(a) * b.orbit.r; }
    else { nx = b.x + Math.sin(b.heading); nz = b.z + Math.cos(b.heading); }
    return spot(v, nx, nz).x >= spot(v, b.x, b.z).x ? 1 : -1;
  }
  protected view(): View { return makeView(this.w, this.h, this.look.yaw); }

  // ---------------------------------------------------------------- the frame

  constructor(protected canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.look = new Look(() => this.w, () => this.w / makeView(this.w, this.h, 0).f);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => this.onUp());
    canvas.addEventListener('pointercancel', () => this.onUp());
  }

  /** Called by the subclass once its own fields exist: hangs the debug handle and starts the loop. */
  protected run(): void {
    (window as unknown as Record<string, unknown>)[`__${this.id}`] = this;
    this.enterChapter(0);
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
  canBack(): boolean { return false; }
  back(): void { /* one story, no screens behind it */ }
  spoken(): string { return this.line || T('Tap to begin.', 'Tik om te beginnen.'); }

  debugState(): Record<string, unknown> {
    const c = this.chapters[this.place.chapter];
    return {
      chapter: c.id, step: this.place.step, started: this.started, finished: this.finished,
      waiting: this.waiting(), flags: [...this.flags], yaw: Math.round(this.look.yaw * 100) / 100,
      line: this.line,
      beast: this.beast ? { kind: this.beast.kind, x: Math.round(this.beast.x), z: Math.round(this.beast.z), ...this.beastScreen() } : null,
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
      ...this.debugExtra(),
    };
  }
  protected debugExtra(): Record<string, unknown> { return {}; }

  /** For the tests and the audit: jump straight to a chapter. */
  jump(i: number): void { this.started = true; this.finished = false; this.enterChapter(i); }
  /** For the tests: set a flag the story is waiting for, as if the child had done it. */
  set(flag: string): void { this.flags.add(flag); }

  protected beastScreen(): { sx: number; sy: number; on: boolean } {
    if (!this.beast) return { sx: 0, sy: 0, on: false };
    const v = this.view();
    const p = spot(v, this.beast.x, this.beast.z, this.beast.lift);
    return { sx: Math.round(p.x), sy: Math.round(p.y), on: Math.abs(p.off) < (v.w / v.f) / 2 };
  }

  protected u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top; this.sb = safe.bottom; this.sl = safe.left; this.sr = safe.right;
    this.fullW = Math.max(1, window.innerWidth);
    this.fullH = Math.max(1, window.innerHeight);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  protected font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  // ---------------------------------------------------------------- the script

  protected enterChapter(i: number): void {
    this.place = { chapter: i, step: 0 };
    this.stepT = 0;
    this.flags.clear();
    this.seenT = 0; this.lostT = 0; this.hinted = false;
    this.titleT = 3;
    this.look.reset();
    this.setup(this.chapters[i]);
    if (this.started) { this.ambience(); this.runStep(); }
  }

  protected step(): Step | undefined {
    return this.chapters[this.place.chapter].steps[this.place.step];
  }

  protected waiting(): string | null {
    const s = this.step();
    return s && 'wait' in s ? s.wait : null;
  }

  protected chapterId(): string { return this.chapters[this.place.chapter].id; }

  private runStep(): void {
    const s = this.step();
    this.stepT = 0;
    if (!s) return;
    if ('say' in s) this.say(NL() ? s.sayNl : s.say);
    else if ('cue' in s) { this.cue(s.cue); this.advance(); }
  }

  private advance(): void {
    const next = nextPlaceIn(this.chapters, this.place);
    if (!next) { this.finished = true; return; }
    if (next.chapter !== this.place.chapter) { this.enterChapter(next.chapter); return; }
    this.place = next;
    this.runStep();
  }

  protected say(text: string): void {
    this.line = text;
    this.lineMin = readSeconds(text) * 0.55;
    if (!sayRecorded([text])) { forgetLine(); speakLine(text); }
  }

  protected aside(a: Aside): void {
    const text = NL() ? a.sayNl : a.say;
    this.line = text;
    if (!sayRecorded([text])) { forgetLine(); speakLine(text); }
  }

  /** Lines are done when Ruth has stopped, waits when the child has done the thing. */
  private stepDone(): boolean {
    const s = this.step();
    if (!s) return false;
    if ('say' in s) return this.stepT > 0.7 && this.stepT >= this.lineMin && !isSpeaking();
    if ('wait' in s) return this.flags.has(s.wait);
    if ('pause' in s) return this.stepT >= s.pause;
    return true;
  }

  /** Turn the camera to something the story is about to talk about, and hand it back afterwards. */
  protected turnTo(angle: number, secs: number): void {
    this.look.guide(angle);
    this.guideT = secs;
  }

  protected markSeen(): void {
    const j = save.journeys as Record<string, string[]>;
    j[this.id] = this.chapters.map(c => c.id);
    persist();
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    this.look.update(dt);
    this.ps.update(dt);
    this.titleT = Math.max(0, this.titleT - dt);
    if (this.guideT > 0) { this.guideT -= dt; if (this.guideT <= 0) this.look.guide(null); }
    this.shake = Math.max(0, this.shake - dt);
    if (!this.started) return;
    this.stepT += dt;
    this.tick(dt);
    this.life?.update(dt);
    this.updateFinding(dt);
    if (this.stepDone() && !this.finished) this.advance();
  }

  /** "Look around and find him": found once he has been in the middle of the view a moment. */
  private updateFinding(dt: number): void {
    if (this.waiting() !== 'found' || !this.beast) return;
    const bs = this.beastScreen();
    const central = bs.on && Math.abs(bs.sx - this.w / 2) < this.w * 0.3;
    if (central) { this.seenT += dt; this.lostT = 0; } else { this.seenT = 0; this.lostT += dt; }
    if (this.seenT > 0.6) { this.flags.add('found'); this.onFound(this.beast); }
    if (this.lostT > 7 && !this.hinted) { this.hinted = true; this.aside(this.lookAround); }
  }

  // ---------------------------------------------------------------- input

  private at(e: PointerEvent): Pt {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Pt): string | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    this.look.askForTilt();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.held = hit; this.press(hit); return; }
    if (!this.started) { this.begin(); return; }
    if (this.down(p)) return;
    if (this.waiting() === 'found' && this.beast) {
      const bs = this.beastScreen();
      if (bs.on && Math.hypot(p.x - bs.sx, p.y - bs.sy) < this.w * 0.35) { this.flags.add('found'); this.onFound(this.beast); return; }
    }
    this.look.down(p.x);
  }

  private onMove(e: PointerEvent): void {
    const p = this.at(e);
    if (this.drag(p)) return;
    this.look.move(p.x);
  }

  private onUp(): void {
    this.held = null;
    this.release();
    this.look.up();
  }

  protected press(id: string): void {
    if (id === 'begin') { this.begin(); return; }
    if (id === 'again') { this.started = true; this.finished = false; this.enterChapter(0); return; }
  }

  private begin(): void {
    this.started = true;
    this.ambience();
    this.runStep();
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const ctx = this.ctx, u = this.u();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 14 * u, (Math.random() - 0.5) * this.shake * 10 * u);
    const inside = this.drawScene();
    if (!inside) this.drawWorld();
    this.ps.draw(ctx);
    ctx.restore();
    vignette(ctx, this.w, this.h, inside ? 0.4 : 0.22);
    this.drawOverlay(inside);
  }

  private drawWorld(): void {
    const ctx = this.ctx, u = this.u();
    const v = this.view();
    const pal = this.palette();
    drawBackdrop(ctx, v, pal, this.t);
    this.life?.drawSky(ctx, v, pal.haze);
    // everything standing in the world, far to near, the animal among them at its own distance
    const items: Array<{ d: number; draw: () => void }> = [];
    for (const p of this.props) items.push({ d: Math.hypot(p.x, p.z), draw: () => drawProp(ctx, v, p, pal, this.t) });
    if (this.life) items.push(...this.life.items(ctx, v, pal.haze));
    if (this.beast) { const b = this.beast; items.push({ d: Math.hypot(b.x, b.z), draw: () => this.drawBeast(v, b, pal) }); }
    items.push(...this.worldItems(v, pal));
    items.sort((a, b) => b.d - a.d).forEach(i => i.draw());
    this.drawOver(v, pal);
    // the hint: an arrow at the edge of the screen pointing the short way round to the animal
    if (this.waiting() === 'found' && this.beast && this.lostT > 3.5 && !this.beastScreen().on) {
      const a = wrapAngle(Math.atan2(this.beast.x, this.beast.z) - this.look.yaw);
      const left = a < 0;
      const x = left ? 26 * u : this.w - 26 * u, y = this.h * 0.45;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + (left ? -12 : 12) * u, y);
      ctx.lineTo(x + (left ? 10 : -10) * u, y - 16 * u);
      ctx.lineTo(x + (left ? 10 : -10) * u, y + 16 * u);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  private drawOverlay(inside: boolean): void {
    const ctx = this.ctx, u = this.u();
    if (!this.started) {
      ctx.fillStyle = 'rgba(10, 20, 30, 0.35)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.textAlign = 'center';
      outlinedText(ctx, NL() ? this.title.nl : this.title.en, this.w / 2, this.h * 0.3, this.font('900', 26), '#ffffff', 'rgba(20, 40, 60, 0.9)', 7);
      const bw = Math.min(240 * u, this.w - 60 * u), bh = 60 * u;
      this.button('begin', T('Start the story', 'Begin het verhaal'), (this.w - bw) / 2, this.h * 0.62, bw, bh, '#4fae6e', '#ffffff');
      return;
    }
    if (this.titleT > 0 && !inside) {
      const c = this.chapters[this.place.chapter];
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.titleT);
      ctx.textAlign = 'center';
      outlinedText(ctx, NL() ? c.titleNl : c.title, this.w / 2, 40 * u, this.font('900', 20), '#ffffff', 'rgba(20, 40, 60, 0.85)', 6);
      ctx.restore();
    }
    const g = this.gauge();
    if (g && !inside) {
      ctx.textAlign = 'center';
      outlinedText(ctx, g, this.w / 2, 64 * u, this.font('800', 12), '#ffffff', 'rgba(20, 40, 60, 0.8)', 4);
    }
    // what Ruth is saying, written underneath for a parent reading along
    if (this.line) {
      const bx = Math.max(GUIDE_KEEP, 14 * u), bw = this.w - bx - 14 * u;
      ctx.font = this.font('800', 13);
      const lines = this.wrap(this.line, bw - 28 * u).slice(0, 3);
      const bh = 22 * u + lines.length * 17 * u;
      const by = this.h - bh - 14 * u;
      glassPanel(ctx, bx, by, bw, bh, 16 * u, 0.9);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 26 * u + i * 17 * u));
    }
    this.drawUi();
    if (this.finished) {
      const bw = Math.min(220 * u, this.w - 80 * u), bh = 56 * u;
      this.button('again', T('Again', 'Nog een keer'), (this.w - bw) / 2, this.h * 0.2, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  protected wrap(text: string, maxW: number): string[] {
    const ctx = this.ctx;
    const out: string[] = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = word; } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  }

  protected button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', 16);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.62, w - 16);
    this.hits.push({ id, x, y, w, h });
  }
}
