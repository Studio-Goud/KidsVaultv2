/**
 * Van cel tot mens - the whole journey, from the first cell to you, under the child's finger.
 *
 * It opens with how evolution works, played rather than told (`moths.ts`), and then the long line:
 * a time line along the bottom that the child drags, and one animal in the middle that becomes the
 * next as they drag. Each stop says what changed and lets the child do the thing that shows it - a
 * cell divides, a fish bites, the X-ray shows the same three bones in a fin and an arm, an egg
 * hatches, Lucy walks and leaves footprints, stones are knapped, a fire is lit, a hand is printed on
 * a cave wall. At the end the whole of it is one day on a clock, and the last seven seconds are ours.
 *
 * Nothing is timed and nothing can be failed (rule 2). The words are in `data.ts`, the bodies in
 * `body.ts`, the first cells in `early.ts`, the worlds in `scene.ts`.
 */

import { unlockAudio } from '../util/audio';
import { GUIDE_KEEP, safeArea, uiScale } from '../util/ui';
import { bleedEdges, chunkyButton, glassPanel, outlinedText, Particles, vignette } from '../render/look';
import { NL, T } from '../util/lang';
import { forgetLine, isSpeaking, sayRecorded, speakLine, stopSpeaking } from '../platform/voice';
import { persist, save } from '../util/storage';
import { BONE, drawBody, extent, mixBody, skeleton, smooth, type Body, type Pose } from './body';
import { MOTH_LINES, secondsInADay, STOPS, type Stop } from './data';
import { drawEarly, type Cell } from './early';
import { drawHandStencil, drawImpact, drawScene } from './scene';
import { drawMoth, drawTrunk, nextGeneration, PER_GENERATION, scatterMoths, type Moth } from './moths';
import { bed, evoSfx, type Bed } from './evosfx';

type Ctx = CanvasRenderingContext2D;
interface Pt { x: number; y: number }
interface Hit { id: string; x: number; y: number; w: number; h: number }
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** How long a line stays up when there is no voice, so a parent reading along still gets it. */
const readSeconds = (text: string): number => Math.max(1.6, text.split(/\s+/).length * 0.34);

/** Where the asteroid falls on the time line: between the first mammals and the first primates. */
const IMPACT_AT = STOPS.findIndex(s => s.id === 'mammal');

type Mode = 'start' | 'moths' | 'line';

export class Evo {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0; private h = 0; private fullW = 0; private fullH = 0;
  private st = 0; private sb = 0; private sl = 0; private sr = 0;
  private t = 0;
  private raf = 0;
  private offscreen: HTMLCanvasElement = document.createElement('canvas');
  private hits: Hit[] = [];
  private held: string | null = null;
  private ps = new Particles();
  private shake = 0;

  private mode: Mode = 'start';
  private line = '';
  private lineMin = 0;
  private lineT = 0;
  private queue: string[] = [];
  private afterQueue: (() => void) | null = null;

  // the moths
  private round = 0;
  private moths: Moth[] = [];
  private gens: Array<{ dark: number; pale: number }> = [];
  private roundOpen = false;

  // the time line
  private pos = 0;
  private glide: { from: number; to: number; t: number; dur: number } | null = null;
  private dragging = false;
  private heard = new Set<number>();
  private narrating = -1;
  private lineIdx = 0;
  private waitingAct = false;
  private done = new Set<string>();
  private phase = 0;
  private scroll = 0;
  private move = 0.35;
  private busyT = 0;

  // what the child has done at the stops
  private xray = false;
  private xrayK = 0;
  private cells: Cell[] = [{ x: 0, y: 0, hue: 140, born: -9, vx: 0, vy: 0 }];
  private stuck = 0;
  private stuckTo = 0;
  private biteT = 0;
  private sniffT = 0;
  private leapT = -1;
  private hatchK = 0;
  private hatchTo = 0;
  private prints: Array<{ x: number; y: number }> = [];
  private lastFoot = 0;
  private knaps = 0;
  private fireK = 0;
  private fireTo = 0;
  private hands: Array<{ x: number; y: number; k: number }> = [];
  private clockT = -1;
  private boomed = false;
  private replay = false;
  private playing: Bed | null = null;
  private wasStop = -1;
  /** where the animal's feet are, for the things placed beside it */
  private groundY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => this.onUp());
    canvas.addEventListener('pointercancel', () => this.onUp());
    const seen = (save.journeys as Record<string, string[]>).evolutie ?? [];
    STOPS.forEach((s, i) => { if (seen.includes(s.id)) this.heard.add(i); });
    (window as unknown as Record<string, unknown>).__evo = this;
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

  destroy(): void { cancelAnimationFrame(this.raf); bed(null); }
  canBack(): boolean { return false; }
  back(): void { /* one screen */ }
  spoken(): string { return this.line || T('Tap to begin.', 'Tik om te beginnen.'); }

  // ---------------------------------------------------------------- for the tests and the audit

  debugState(): Record<string, unknown> {
    const i = this.stopIndex();
    return {
      mode: this.mode, pos: Math.round(this.pos * 100) / 100, stop: STOPS[i]?.id, narrating: this.narrating,
      line: this.line, waiting: this.waitingAct, heard: [...this.heard].sort((a, b) => a - b), xray: this.xray,
      round: this.round, moths: this.moths.map(m => (m.dark ? 'd' : 'p') + (m.foundAt >= 0 ? '*' : '')).join(''),
      gens: this.gens, cells: this.cells.length, done: [...this.done],
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }
  /** Jump straight to a stop on the time line, as if the moths were done and the way there heard. */
  jump(i: number): void {
    this.mode = 'line';
    for (let k = 0; k < i; k++) this.heard.add(k);
    this.pos = i; this.glide = null; this.narrating = -1; this.wasStop = -1;
  }
  /** Where to tap to do a stop's thing, for the tests. */
  actAt(): Pt { return this.actSpot(); }
  mothAt(k: number): Pt | null { const m = this.moths.filter(q => q.foundAt < 0)[k]; return m ? { x: m.x, y: m.y } : null; }
  trackAt(i: number): Pt { const tr = this.track(); return { x: tr.x + (i / (STOPS.length - 1)) * tr.w, y: tr.y }; }

  // ---------------------------------------------------------------- layout

  private u(): number { return uiScale(this.w, this.h); }
  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top; this.sb = safe.bottom; this.sl = safe.left; this.sr = safe.right;
    this.fullW = Math.max(1, window.innerWidth); this.fullH = Math.max(1, window.innerHeight);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
    this.offscreen.width = this.canvas.width; this.offscreen.height = this.canvas.height;
  }

  /** The time line along the bottom: where it is, left end to right end. */
  private track(): { x: number; y: number; w: number } {
    const u = this.u();
    const x0 = Math.max(GUIDE_KEEP, 16 * u) + 10 * u, x1 = this.w - 74 * u;
    return { x: x0, y: this.h - 30 * u, w: x1 - x0 };
  }
  /** The words panel sits above the time line. */
  private captionTop(): number { return this.h - 60 * this.u() - this.captionH(); }
  private captionH(): number { return 22 * this.u() + (this.w > this.h ? 2 : 3) * 17 * this.u(); }
  /** The stage: between the title and the words, and the ground line the animal stands on. */
  private stage(): { top: number; bottom: number; gy: number } {
    const u = this.u();
    const top = (this.w > this.h ? 66 : 76) * u, bottom = this.captionTop() - 6 * u;
    return { top, bottom, gy: bottom - 4 * u };
  }

  private stopIndex(): number { return clamp(Math.round(this.pos), 0, STOPS.length - 1); }
  private atStop(): boolean { return !this.glide && !this.dragging && Math.abs(this.pos - Math.round(this.pos)) < 0.002; }
  /** As far forward as the child may drag: one past the last stop they have heard, or anywhere once all are heard. */
  private reach(): number {
    let r = 0;
    while (r < STOPS.length - 1 && this.heard.has(r)) r++;
    return r;
  }

  // ---------------------------------------------------------------- speaking

  private say(text: string): void {
    this.line = text;
    this.lineT = 0;
    this.lineMin = readSeconds(text) * 0.55;
    if (!sayRecorded([text])) { forgetLine(); speakLine(text); }
  }
  /** Say several lines one after the other, then do something. */
  private sayAll(lines: string[], then: (() => void) | null): void {
    this.queue = lines.slice(1);
    this.afterQueue = then;
    this.say(lines[0]);
  }
  private lineDone(): boolean { return this.lineT > 0.7 && this.lineT >= this.lineMin && !isSpeaking(); }
  private pick(l: { say: string; sayNl: string }): string { return NL() ? l.sayNl : l.say; }

  // ---------------------------------------------------------------- the flow

  private begin(): void {
    unlockAudio();
    const seen = (save.journeys as Record<string, string[]>).evolutie ?? [];
    if (seen.includes('moths')) { this.startLine(); return; }
    this.startMoths();
  }

  private startMoths(): void {
    this.mode = 'moths';
    this.round = 0;
    this.gens = [{ dark: 2, pale: 8 }];
    this.moths = [];
    this.sayAll([this.pick(MOTH_LINES.intro), this.pick(MOTH_LINES.soot)], () => this.openRound());
  }

  private trunks(): { xs: number[]; w: number; top: number; bottom: number } {
    const u = this.u();
    const st = this.stage();
    const n = this.w > this.h ? 5 : 3;
    const w = Math.min(90 * u, this.w / (n * 2.2));
    const xs = Array.from({ length: n }, (_, i) => this.w * (i + 0.5) / n);
    return { xs, w, top: st.top + 10 * u, bottom: st.gy - 20 * u };
  }

  private openRound(): void {
    const tr = this.trunks();
    this.round++;
    this.moths = scatterMoths(this.gens[this.gens.length - 1], tr.xs, tr.w, tr.top + 20, tr.bottom - 20, 17 + this.round * 31);
    this.roundOpen = true;
  }

  private closeRound(): void {
    this.roundOpen = false;
    const left = this.moths.filter(m => m.foundAt < 0);
    const next = nextGeneration({ dark: left.filter(m => m.dark).length, pale: left.filter(m => !m.dark).length });
    this.gens.push(next);
    if (this.round === 1) {
      this.sayAll([this.pick(MOTH_LINES.next), this.pick(MOTH_LINES.again)], () => this.openRound());
    } else {
      // one more generation, worked out but not played, so the trend is plain to see
      this.round = 3;
      this.moths = [];
      this.sayAll([this.pick(MOTH_LINES.done), this.pick(MOTH_LINES.go)], () => {
        const j = save.journeys as Record<string, string[]>;
        j.evolutie = [...new Set([...(j.evolutie ?? []), 'moths'])];
        persist();
      });
    }
  }

  private startLine(): void {
    this.mode = 'line';
    this.pos = 0;
    this.wasStop = -1;
    this.line = '';
  }

  private glideTo(to: number): void {
    to = clamp(to, 0, Math.max(this.reach(), this.heard.size >= STOPS.length ? STOPS.length - 1 : 0));
    if (Math.abs(to - this.pos) < 0.001) return;
    this.stopNarrating();
    this.glide = { from: this.pos, to, t: 0, dur: clamp(Math.abs(to - this.pos) * 1.6, 0.6, 2.4) };
  }

  private stopNarrating(): void {
    if (this.narrating >= 0) { stopSpeaking(); this.narrating = -1; this.waitingAct = false; this.queue = []; this.afterQueue = null; }
  }

  /** Arriving at a stop: its lines, one by one, pausing where the child has something to do. */
  private arrive(i: number): void {
    evoSfx.arrive();
    this.resetActs(i);
    this.narrating = i;
    this.lineIdx = 0;
    this.say(this.pick(STOPS[i].lines[0]));
  }

  private nextLine(): void {
    const s = STOPS[this.narrating];
    if (s.wait === this.lineIdx && !this.done.has(s.id)) { this.waitingAct = true; return; }
    this.waitingAct = false;
    this.lineIdx++;
    if (this.lineIdx < s.lines.length) { this.say(this.pick(s.lines[this.lineIdx])); return; }
    this.heard.add(this.narrating);
    const j = save.journeys as Record<string, string[]>;
    j.evolutie = [...new Set([...(j.evolutie ?? []), s.id])];
    persist();
    if (s.id === 'now') evoSfx.done();
    this.narrating = -1;
  }

  /** Each stop starts clean: the X-ray off (unless the stop is about it), no cells stuck, no fire. */
  private resetActs(i: number): void {
    const s = STOPS[i];
    this.xray = false;
    this.cells = [{ x: 0, y: 0, hue: 140, born: -9, vx: 0, vy: 0 }];
    this.stuck = 0; this.stuckTo = 0;
    this.hatchK = 0; this.hatchTo = 0;
    this.knaps = 0; this.fireK = 0; this.fireTo = 0;
    this.prints = [];
    this.hands = [];
    this.leapT = -1;
    this.clockT = s.act === 'clock' ? 0 : -1;
    if (s.act === 'tail') { this.xray = true; }
  }

  /** The child did the stop's thing. */
  private did(id: string): void {
    this.done.add(id);
    if (this.waitingAct && STOPS[this.narrating]?.id === id) { this.waitingAct = false; this.lineIdx++; const s = STOPS[this.narrating]; if (this.lineIdx < s.lines.length) this.say(this.pick(s.lines[this.lineIdx])); else this.nextLine(); }
  }

  // ---------------------------------------------------------------- per frame

  private update(dt: number): void {
    this.ps.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.lineT += dt;
    this.xrayK += ((this.xray ? 1 : 0) - this.xrayK) * Math.min(1, dt * 6);
    this.stuck += (this.stuckTo - this.stuck) * Math.min(1, dt * 3);
    this.hatchK = Math.min(this.hatchTo, this.hatchK + dt * 0.8);
    this.fireK += (this.fireTo - this.fireK) * Math.min(1, dt * 2);
    this.biteT = Math.max(0, this.biteT - dt);
    this.sniffT = Math.max(0, this.sniffT - dt);
    this.busyT = Math.max(0, this.busyT - dt);
    for (const hd of this.hands) hd.k = Math.min(1, hd.k + dt * 1.5);
    if (this.clockT >= 0) this.clockT += dt;

    // the queue of lines outside the stops (the moths)
    if (this.line && this.lineDone() && (this.queue.length || this.afterQueue) && this.narrating < 0) {
      if (this.queue.length) this.say(this.queue.shift()!);
      else { const f = this.afterQueue; this.afterQueue = null; f?.(); }
    }
    if (this.mode === 'moths') { this.updateMoths(); return; }
    if (this.mode !== 'line') return;

    if (this.glide) {
      const g = this.glide;
      g.t += dt;
      const k = Math.min(1, g.t / g.dur);
      const was = this.pos;
      this.pos = g.from + (g.to - g.from) * smooth(k);
      this.impactSound(was, this.pos);
      if (k >= 1) { this.pos = g.to; this.glide = null; if (this.replay) this.replay = false; }
    }
    if (this.atStop()) {
      const i = this.stopIndex();
      if (i !== this.wasStop) { this.wasStop = i; this.arrive(i); }
    } else if (!this.atStop()) this.wasStop = -1;
    if (this.narrating >= 0 && !this.waitingAct && this.lineDone()) this.nextLine();

    // the animal moves in place and the world slides past it
    const b = this.bodyAt(this.pos);
    const walkK = this.busyT > 0 ? 1 : 0.35;
    this.move += (walkK - this.move) * Math.min(1, dt * 2);
    const rate = 0.9;
    this.phase += dt * rate * (b ? 1 : 0.3);
    const s = this.fitScale(b);
    const perCycle = b ? (b.leg > 0.2 && b.fin < 0.5 ? b.leg * this.move : 0.9 * this.move) : 0.2;
    this.scroll += perCycle * rate * s * dt;
    if (b && STOPS[this.stopIndex()].act === 'walk' && this.busyT > 0) this.dropPrints(b, s);
    this.ambience();
  }

  private impactSound(was: number, now: number): void {
    const at = IMPACT_AT + 0.4;
    if (was < at && now >= at && !this.boomed) { this.boomed = true; evoSfx.impact(); this.shake = 1.4; }
    if (now < IMPACT_AT + 0.2) this.boomed = false;
  }

  private ambience(): void {
    const sc = STOPS[this.stopIndex()].scene;
    const want: Bed = ['vent', 'sea', 'silurian', 'reef'].includes(sc) ? 'water' : sc === 'night' ? 'night' : sc === 'cave' ? 'cave' : 'land';
    if (want !== this.playing) { this.playing = want; bed(want); }
  }

  private updateMoths(): void {
    if (!this.roundOpen) return;
    const left = this.moths.filter(m => m.foundAt < 0);
    const found = this.moths.length - left.length;
    const paleLeft = left.filter(m => !m.dark).length;
    if ((paleLeft === 0 || found >= 5) && this.moths.every(m => m.foundAt < 0 || this.t - m.foundAt > 0.8)) this.closeRound();
  }

  /** Footprints: when a foot comes down on the ground it leaves a mark there, which slides away behind. */
  private dropPrints(b: Body, s: number): void {
    const sk = skeleton(b, this.pose(b));
    const st = this.stage();
    const { gx, gy } = this.placeAnimal(b, s);
    void st;
    for (const l of sk.limbs) {
      if (l.front) continue;
      if (Math.abs(l.end[1]) < 0.005) {
        const x = gx + l.end[0] * s + this.scroll;
        if (Math.abs(x - this.lastFoot) > s * 0.2) { this.lastFoot = x; this.prints.push({ x, y: gy + 4 }); evoSfx.step(); }
      }
    }
    if (this.prints.length > 30) this.prints.shift();
  }

  // ---------------------------------------------------------------- the animal at a point on the line

  private bodyAt(p: number): Body | null {
    const i = Math.floor(p), k = p - i;
    const a = STOPS[clamp(i, 0, STOPS.length - 1)], b = STOPS[clamp(i + 1, 0, STOPS.length - 1)];
    if (!a.body && !b.body) return null;
    if (!a.body) return k > 0.5 ? b.body! : null;
    if (!b.body || k < 1e-4) return a.body;
    return mixBody(a.body, b.body, smooth(k));
  }

  private fitScale(b: Body | null): number {
    if (!b) return 1;
    const st = this.stage();
    const e = extent(b);
    const wide = this.w > this.h;
    const wAvail = this.w * (this.sidePanel() ? (wide ? 0.5 : 0.6) : (wide ? 0.62 : 0.86)), hAvail = (st.gy - st.top) * 0.78;
    return Math.min(wAvail / (e.right - e.left), hAvail / -e.top, 900 * this.u());
  }

  /** The family tree and the clock sit to the right, so the animal steps to the left for them. */
  private sidePanel(): boolean {
    const a = STOPS[this.stopIndex()].act;
    return (a === 'tree' || a === 'clock') && this.atStop();
  }

  /** Where the animal stands: in the middle, or left of a panel; a long low animal higher up on a tall screen. */
  private placeAnimal(b: Body, s: number): { gx: number; gy: number } {
    const st = this.stage();
    const e = extent(b);
    const cx = this.sidePanel() ? this.w * 0.3 : this.w / 2;
    const gx = cx - (e.left + e.right) / 2 * s;
    const hgt = -e.top * s, room = st.gy - st.top;
    const lift = Math.max(0, room - hgt * 2.2) * 0.4;
    return { gx, gy: st.gy - lift };
  }

  private pose(b: Body): Pose {
    const s = STOPS[this.stopIndex()];
    const leap = this.leapT >= 0 ? Math.max(0, 1 - (this.t - this.leapT) / 0.8) : 0;
    void leap;
    return {
      t: this.t, phase: this.phase, xray: this.xrayK, facing: 1, move: this.move,
      show: this.xray ? (s.show ?? null) : null, bite: this.biteT > 0 ? Math.sin((this.biteT / 0.5) * Math.PI) : 0,
      sniff: this.sniffT > 0 ? Math.sin((this.sniffT / 1.5) * Math.PI) : 0,
    };
  }

  /** Where the stop's thing is to be tapped: the animal, the egg, the stones, the fire, the wall. */
  private actSpot(): Pt {
    const st = this.stage();
    const s = STOPS[this.stopIndex()];
    const b = this.bodyAt(this.pos);
    if (!b) return { x: this.w / 2, y: (st.top + st.gy) / 2 };
    const sc = this.fitScale(b);
    const e = extent(b);
    const { gx, gy } = this.placeAnimal(b, sc);
    const right = Math.min(this.w - 40 * this.u(), gx + e.right * sc);
    if (s.act === 'hatch') return { x: Math.min(this.w - 30 * this.u(), gx + e.right * sc * 0.92), y: gy - 14 * this.u() };
    if (s.act === 'knap') return { x: Math.min(this.w - 40 * this.u(), right + 30 * this.u()), y: gy - 10 * this.u() };
    if (s.act === 'fire') return { x: Math.min(this.w - 44 * this.u(), right + 50 * this.u()), y: gy - 16 * this.u() };
    if (s.act === 'hand') return { x: this.w * 0.25, y: st.top + (gy - st.top) * 0.3 };
    return { x: gx + ((e.left + e.right) / 2) * sc, y: gy + e.top * sc * 0.5 };
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
    const p = this.at(e);
    const hit = this.hitAt(p);
    const u = this.u();
    if (hit) { this.held = hit; this.press(hit); return; }
    if (this.mode === 'start') { this.begin(); return; }
    if (this.mode === 'moths') { this.tapMoth(p); return; }
    // the time line: anywhere near it grabs the knob
    const tr = this.track();
    if (Math.abs(p.y - tr.y) < 26 * u && p.x > tr.x - 20 * u && p.x < tr.x + tr.w + 20 * u) {
      this.dragging = true; this.glide = null; this.stopNarrating(); this.dragTo(p.x); return;
    }
    this.tapStage(p);
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragTo(this.at(e).x);
  }

  private onUp(): void {
    this.held = null;
    if (this.dragging) { this.dragging = false; this.glideTo(Math.round(this.pos)); }
  }

  private dragTo(x: number): void {
    const tr = this.track();
    const was = this.pos;
    const lim = this.heard.size >= STOPS.length ? STOPS.length - 1 : this.reach();
    this.pos = clamp(((x - tr.x) / tr.w) * (STOPS.length - 1), 0, lim);
    this.impactSound(was, this.pos);
  }

  private press(id: string): void {
    if (id === 'begin') { this.begin(); return; }
    if (id === 'moths') { unlockAudio(); this.startMoths(); return; }
    if (id === 'toLine') { this.startLine(); return; }
    if (id === 'next') { this.glideTo(Math.floor(this.pos + 0.01) + 1); return; }
    if (id === 'xray') { this.xray = !this.xray; evoSfx.xray(); if (this.xray) this.did(STOPS[this.stopIndex()].id); return; }
    if (id === 'replay') { this.replay = true; this.pos = 0; this.wasStop = 0; this.stopNarrating(); this.glide = { from: 0, to: STOPS.length - 1, t: 0, dur: 26 }; return; }
  }

  private tapMoth(p: Pt): void {
    if (!this.roundOpen) return;
    // a bird eats its fill and stops: five a round, which leaves some of both kinds to breed
    if (this.moths.filter(m => m.foundAt >= 0).length >= 5) return;
    const s = this.mothSize();
    let best: Moth | null = null, bd = Infinity;
    for (const m of this.moths) {
      if (m.foundAt >= 0) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < s * 1.6 && d < bd) { best = m; bd = d; }
    }
    if (best) { best.foundAt = this.t; evoSfx.flutter(); }
  }

  private tapStage(p: Pt): void {
    const i = this.stopIndex();
    const s = STOPS[i];
    if (!this.atStop()) return;
    const u = this.u();
    const spot = this.actSpot();
    const st = this.stage();
    const near = Math.hypot(p.x - spot.x, p.y - spot.y) < Math.max(90 * u, (st.gy - st.top) * 0.35);
    const onStage = p.y > st.top && p.y < st.gy + 10 * u;
    if (s.act === 'divide' && onStage) {
      if (this.cells.length < 16) {
        const next: Cell[] = [];
        for (const c of this.cells) {
          const a = Math.random() * TAU;
          // each copy is almost, but not quite, the same colour as its mother
          next.push({ ...c, x: c.x + Math.cos(a) * 0.9, y: c.y + Math.sin(a) * 0.7, born: this.t, hue: c.hue + (Math.random() - 0.5) * 16 });
          next.push({ ...c, x: c.x - Math.cos(a) * 0.9, y: c.y - Math.sin(a) * 0.7, born: this.t, hue: c.hue + (Math.random() - 0.5) * 16 });
        }
        // keep them on the stage
        const spread = Math.max(1, ...next.map(c => Math.hypot(c.x, c.y)));
        const room = 2.6;
        if (spread > room) for (const c of next) { c.x *= room / spread; c.y *= room / spread; }
        this.cells = next;
        evoSfx.divide();
      }
      this.did(s.id);
      return;
    }
    if (s.act === 'stick' && onStage) { this.stuckTo = 1; evoSfx.stick(); this.did(s.id); return; }
    if (!near && !['hand', 'clock'].includes(s.act ?? '')) return;
    switch (s.act) {
      case 'bite': this.biteT = 0.5; evoSfx.bite(); this.did(s.id); break;
      case 'fingers': this.xray = true; evoSfx.xray(); this.did(s.id); break;
      case 'xray': this.xray = !this.xray; evoSfx.xray(); if (this.xray) this.did(s.id); break;
      case 'tail': this.xray = !this.xray; evoSfx.xray(); this.did(s.id); break;
      case 'hatch': this.hatchTo = 1; evoSfx.hatch(); this.did(s.id); break;
      case 'sniff': this.sniffT = 1.5; evoSfx.sniff(); this.did(s.id); break;
      case 'leap': this.leapT = this.t; evoSfx.leap(); this.did(s.id); break;
      case 'walk': this.busyT = 4; this.did(s.id); break;
      case 'knap':
        this.knaps++; evoSfx.knap(); this.shake = 0.15;
        this.ps.spawn('spark', spot.x, spot.y, 10, { colour: '#fff2c8', speed: 160, size: 3 * u, max: 0.5 });
        this.did(s.id);
        break;
      case 'fire':
        this.fireTo = 1; evoSfx.fire();
        this.ps.spawn('spark', spot.x, spot.y, 20, { colour: '#ffb050', speed: 120, size: 3 * u, max: 1, grav: -80 });
        this.did(s.id);
        break;
      case 'hand':
        if (p.y < st.gy - 20 * u && this.hands.length < 8) { this.hands.push({ x: p.x, y: p.y, k: 0 }); evoSfx.hand(); this.did(s.id); }
        break;
      case 'tree': this.did(s.id); break;
      case 'clock': this.clockT = 0; evoSfx.tick(); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const ctx = this.ctx, u = this.u();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 12 * u, (Math.random() - 0.5) * this.shake * 9 * u);
    if (this.mode === 'moths' || (this.mode === 'start' && !this.heard.size)) this.drawMothScene();
    else this.drawLine();
    this.ps.draw(ctx);
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.2);
    this.drawOverlay();
  }

  private drawMothScene(): void {
    const ctx = this.ctx;
    const st = this.stage();
    // an English wood near a factory town in the 1800s: smoke in the sky, soot on the bark
    drawScene(ctx, this.w, this.h, st.gy, 'forest', this.t, 0);
    ctx.fillStyle = 'rgba(70, 64, 60, 0.45)';
    ctx.fillRect(0, 0, this.w, this.h);
    const tr = this.trunks();
    for (const x of tr.xs) drawTrunk(ctx, x, 0, st.gy + 20, tr.w, 0.9);
    const s = this.mothSize();
    for (const m of this.moths) drawMoth(ctx, m, s, this.t);
    if (this.round === 3) this.drawGenerations();
  }

  private mothSize(): number { return Math.max(10, 14 * this.u()); }

  /** Three generations side by side: the moths getting darker, because of which ones the bird found. */
  private drawGenerations(): void {
    const ctx = this.ctx, u = this.u();
    const st = this.stage();
    const pw = Math.min(this.w - 32 * u, 420 * u);
    const s0 = Math.min(9 * u, pw / (this.gens.length * 8));
    const ph = Math.min(st.gy - st.top - 20 * u, 44 * u + 5 * s0 * 2.6 + 10 * u);
    const px = (this.w - pw) / 2, py = st.top + 10 * u;
    glassPanel(ctx, px, py, pw, ph, 18 * u, 0.9);
    const cols = this.gens.length;
    const s = Math.min(9 * u, pw / (cols * 8));
    this.gens.forEach((g, c) => {
      const cx = px + pw * (c + 0.5) / cols;
      ctx.fillStyle = '#123047'; ctx.textAlign = 'center'; ctx.font = this.font('900', 12);
      ctx.fillText(T(`Generation ${c + 1}`, `Generatie ${c + 1}`), cx, py + 22 * u);
      const kinds = [...Array(g.dark).fill(true), ...Array(g.pale).fill(false)];
      kinds.forEach((dark, i) => {
        const row = Math.floor(i / 2), col = i % 2;
        drawMoth(ctx, { x: cx + (col - 0.5) * s * 3, y: py + 44 * u + row * s * 2.6, dark, rot: 0, foundAt: -1, seed: i * 13 }, s, this.t);
      });
    });
  }

  private drawLine(): void {
    const ctx = this.ctx, u = this.u();
    const st = this.stage();
    const i = Math.floor(this.pos), k = this.pos - i;
    const A = STOPS[clamp(i, 0, STOPS.length - 1)], B = STOPS[clamp(i + 1, 0, STOPS.length - 1)];
    // the ground the world stands on is the ground the animal stands on
    const b0 = this.bodyAt(this.pos);
    const wy = b0 ? this.placeAnimal(b0, this.fitScale(b0)).gy : st.gy;
    // the world: this stop's, and the next one's fading in over it
    drawScene(ctx, this.w, this.h, wy, A.scene, this.t, this.scroll);
    if (k > 0.001 && B.scene !== A.scene) {
      const bc = this.offscreen.getContext('2d')!;
      bc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      bc.clearRect(0, 0, this.fullW, this.fullH);
      drawScene(bc, this.w, this.h, wy, B.scene, this.t, this.scroll);
      ctx.save();
      ctx.globalAlpha = smooth(clamp((k - 0.2) / 0.6, 0, 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.offscreen, this.sl * this.dpr, this.st * this.dpr, this.w * this.dpr, this.h * this.dpr, this.sl * this.dpr, this.st * this.dpr, this.w * this.dpr, this.h * this.dpr);
      ctx.restore();
    }
    // footprints behind the walker, sliding away
    ctx.fillStyle = 'rgba(40, 25, 10, 0.35)';
    for (const f of this.prints) {
      const x = f.x - this.scroll;
      ctx.beginPath(); ctx.ellipse(x, f.y, 7 * u, 2.5 * u, 0, 0, TAU); ctx.fill();
    }
    // the hand stencils on the cave wall
    for (const hd of this.hands) drawHandStencil(ctx, hd.x, hd.y, 26 * u, hd.k);
    // the asteroid, when the line passes sixty-six million years ago
    if (i === IMPACT_AT) drawImpact(ctx, this.w, this.h, wy, clamp((k - 0.15) / 0.6, 0, 1));
    this.drawAnimal();
    this.drawProps();
    if (A.act === 'tree' && this.atStop()) this.drawFamily();
    if (A.act === 'clock' && this.atStop() && this.clockT >= 0) this.drawClock();
  }

  private drawAnimal(): void {
    const ctx = this.ctx, u = this.u();
    const st = this.stage();
    const i = Math.floor(this.pos), k = this.pos - i;
    const A = STOPS[clamp(i, 0, STOPS.length - 1)], B = STOPS[clamp(i + 1, 0, STOPS.length - 1)];
    const r = Math.min(this.w, st.gy - st.top) * 0.16;
    const cx = this.w / 2, cy = (st.top + st.gy) / 2;
    if (A.early) {
      // before bodies: cells, drawn as under a microscope in a pool of light
      const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 4);
      g.addColorStop(0, 'rgba(200, 255, 240, 0.12)'); g.addColorStop(1, 'rgba(200, 255, 240, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 4, 0, TAU); ctx.fill();
      const kk = B.early ? k : Math.min(1, k * 1.6);
      if (A.early === 'many') drawEarly(ctx, cx, cy, r, 'many', 0, this.t, this.cells, Math.max(this.stuck, B.body ? Math.min(1, k * 3) : 0), B.body ? smooth(Math.min(1, k * 1.6)) : 0);
      else drawEarly(ctx, cx, cy, r, A.early, kk, this.t, this.cells, this.stuck);
      if (!B.body || k < 0.5) return;
      ctx.save(); ctx.globalAlpha = smooth((k - 0.5) * 2);
    }
    const b = this.bodyAt(this.pos);
    if (!b) { if (A.early) ctx.restore(); return; }
    const s = this.fitScale(b);
    const e = extent(b);
    const place = this.placeAnimal(b, s);
    const gx = place.gx;
    const swimmer = b.swim > 0.5 && b.leg < 0.2;
    const leap = this.leapT >= 0 ? Math.max(0, Math.sin(Math.min(1, (this.t - this.leapT) / 0.8) * Math.PI)) : 0;
    const bob = swimmer ? Math.sin(this.t * 0.9) * 6 * u : 0;
    const gy = place.gy - (swimmer ? (st.gy - st.top) * 0.12 : 0) + bob - leap * (st.gy - st.top) * 0.18;
    this.groundY = place.gy;
    const pose = this.pose(b);
    // a warm light on the animal from the fire
    drawBody(ctx, gx, gy, s, b, pose);
    if (this.fireK > 0.02 && A.act === 'fire') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const f = this.actSpot();
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 260 * u);
      g.addColorStop(0, `rgba(255, 150, 60, ${0.3 * this.fireK})`); g.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    if (A.early) ctx.restore();
  }

  /** The things a stop brings: the egg, the stones, the fire. */
  private drawProps(): void {
    const ctx = this.ctx, u = this.u();
    const s = STOPS[this.stopIndex()];
    if (!this.atStop() && !this.glide) return;
    const p = this.actSpot();
    if (s.act === 'hatch' && Math.round(this.pos) === this.stopIndex()) {
      const r = 14 * u;
      if (this.hatchK < 1) {
        ctx.fillStyle = '#efe6cf';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.8, r, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(80, 60, 30, 0.5)'; ctx.lineWidth = 1.2;
        ctx.stroke();
        if (this.hatchK > 0) {
          ctx.beginPath(); ctx.moveTo(p.x - r * 0.7, p.y - r * 0.1);
          for (let q = 0; q < 6; q++) ctx.lineTo(p.x - r * 0.7 + q * r * 0.28, p.y - r * 0.1 + (q % 2 ? -r * 0.2 : r * 0.1) * this.hatchK * 2);
          ctx.stroke();
        }
      } else {
        // the baby, out of its shell
        ctx.fillStyle = '#efe6cf';
        ctx.beginPath(); ctx.ellipse(p.x - r, p.y + r * 0.4, r * 0.8, r * 0.5, 0, 0, Math.PI); ctx.fill();
        const baby = STOPS[this.stopIndex()].body!;
        const bs = this.fitScale(baby) * 0.22;
        drawBody(ctx, p.x + r * 0.5, p.y + r * 0.9, bs, baby, { t: this.t, phase: this.phase * 1.3, xray: 0, facing: 1, move: 0.5 });
      }
      this.ring(p, 22 * u, !this.done.has(s.id));
    }
    if (s.act === 'knap') {
      // a round cobble and the stone it is struck with; each tap takes a flake off
      ctx.fillStyle = '#8a8070';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * u, 11 * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8ae98';
      for (let q = 0; q < Math.min(this.knaps, 6); q++) {
        ctx.beginPath(); ctx.moveTo(p.x + 16 * u - q * 3 * u, p.y - 8 * u + q * 2 * u); ctx.lineTo(p.x + 8 * u - q * 3 * u, p.y - 2 * u + q * 2 * u); ctx.lineTo(p.x + 14 * u - q * 3 * u, p.y + 4 * u + q * 2 * u); ctx.fill();
      }
      if (this.knaps >= 3) {
        ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(p.x + 16 * u, p.y - 8 * u); ctx.lineTo(p.x + 16 * u, p.y + 6 * u); ctx.stroke();
      }
      ctx.fillStyle = '#6a6254';
      ctx.beginPath(); ctx.ellipse(p.x - 22 * u, p.y + 2 * u, 9 * u, 7 * u, 0.3, 0, TAU); ctx.fill();
      this.ring(p, 26 * u, !this.done.has(s.id));
    }
    if (s.act === 'fire') {
      // stones round a pit, sticks, and the flames once it is lit
      ctx.fillStyle = '#4a3a2a';
      for (let q = 0; q < 3; q++) { ctx.save(); ctx.translate(p.x, p.y + 8 * u); ctx.rotate(-0.6 + q * 0.6); ctx.fillRect(-18 * u, -2 * u, 36 * u, 4 * u); ctx.restore(); }
      ctx.fillStyle = '#6a6258';
      for (let q = 0; q < 7; q++) { ctx.beginPath(); ctx.ellipse(p.x - 24 * u + q * 8 * u, p.y + 12 * u, 5 * u, 3.5 * u, 0, 0, TAU); ctx.fill(); }
      if (this.fireK > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let q = 0; q < 9; q++) {
          const fx = p.x + (q - 4) * 3 * u + Math.sin(this.t * 7 + q) * 2 * u;
          const fh = (20 + Math.sin(this.t * 9 + q * 1.7) * 8) * u * this.fireK * (1 - Math.abs(q - 4) / 6);
          const g = ctx.createLinearGradient(fx, p.y + 6 * u, fx, p.y + 6 * u - fh);
          g.addColorStop(0, 'rgba(255, 200, 80, 0.9)'); g.addColorStop(0.6, 'rgba(255, 110, 30, 0.7)'); g.addColorStop(1, 'rgba(200, 40, 10, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(fx - 5 * u, p.y + 6 * u); ctx.quadraticCurveTo(fx, p.y + 6 * u - fh * 1.2, fx + 5 * u, p.y + 6 * u); ctx.fill();
        }
        ctx.restore();
        if (Math.random() < 0.3) this.ps.spawn('spark', p.x, p.y - 10 * u, 1, { colour: '#ffb050', speed: 40, size: 2 * u, max: 1.2, grav: -60 });
      }
      this.ring(p, 30 * u, !this.done.has(s.id));
    }
    if (s.act === 'hand' && !this.done.has(s.id)) this.ring(p, 30 * u, true);
    if (['divide', 'stick', 'bite', 'sniff', 'leap', 'walk', 'fingers'].includes(s.act ?? '') && !this.done.has(s.id) && this.atStop()) this.ring(p, 40 * u, true);
  }

  /** A pulsing ring round the thing to tap. */
  private ring(p: Pt, r: number, on: boolean): void {
    if (!on) return;
    const ctx = this.ctx;
    const k = (this.t * 0.8) % 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - k)})`;
    ctx.lineWidth = 3 * this.u();
    ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.8 + k * 0.6), 0, TAU); ctx.stroke();
  }

  /** The family tree at the fork: we and the chimpanzees on two branches from one trunk. */
  private drawFamily(): void {
    const ctx = this.ctx, u = this.u();
    const st = this.stage();
    const pw = Math.min(260 * u, this.w * 0.5), ph = Math.min(170 * u, (st.gy - st.top) * 0.55);
    const px = this.w - pw - 12 * u, py = st.top + 66 * u;
    glassPanel(ctx, px, py, pw, ph, 16 * u, 0.88);
    const base = { x: px + pw * 0.5, y: py + ph - 18 * u };
    const tips = [
      { x: px + pw * 0.14, name: T('orangutan', 'orang-oetan'), at: 0.35 },
      { x: px + pw * 0.38, name: T('gorilla', 'gorilla'), at: 0.55 },
      { x: px + pw * 0.62, name: T('chimpanzee', 'chimpansee'), at: 0.75 },
      { x: px + pw * 0.86, name: T('us', 'wij'), at: 0.75 },
    ];
    ctx.strokeStyle = '#4a6a4a'; ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
    const top = py + 38 * u;
    tips.forEach((tp, i) => {
      const fork = base.y - (base.y - top) * tp.at;
      const trunkX = base.x + (i === 3 ? 0.12 : 0) * pw * (tp.at > 0.7 ? 1 : 0);
      ctx.strokeStyle = i === 3 ? '#e07a3a' : '#4a6a4a';
      ctx.beginPath(); ctx.moveTo(trunkX, fork); ctx.lineTo(tp.x, top); ctx.stroke();
      ctx.fillStyle = i === 3 ? '#c0501a' : '#123047'; ctx.font = this.font('900', 11); ctx.textAlign = 'center';
      ctx.fillText(tp.name, tp.x, top - (i % 2 ? 6 : 19) * u);
    });
    ctx.strokeStyle = '#4a6a4a';
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x, base.y - (base.y - top) * 0.75); ctx.stroke();
    // the fork where we are now
    const fy = base.y - (base.y - top) * 0.75;
    ctx.fillStyle = '#e07a3a';
    ctx.beginPath(); ctx.arc(base.x, fy, 5 * u * (1 + 0.2 * Math.sin(this.t * 4)), 0, TAU); ctx.fill();
  }

  /** All of time as one day: a clock whose hand goes round once, and people in the last seconds. */
  private drawClock(): void {
    const ctx = this.ctx, u = this.u();
    const st = this.stage();
    const R = Math.min(this.w * 0.24, (st.gy - st.top) * 0.3);
    const cx = this.w - R - 22 * u, cy = st.top + 66 * u + R + 10 * u;
    glassPanel(ctx, cx - R - 10 * u, cy - R - 10 * u, R * 2 + 20 * u, R * 2 + 20 * u, R, 0.9);
    const k = Math.min(1, this.clockT / 8);
    // the day, coloured by what was alive: cells for most of it
    const first = 3.7e9;
    const segs: Array<[number, string]> = [[first, '#8ad0c0'], [6e8, '#6ab0e0'], [3.75e8, '#7ac070'], [2.05e8, '#c0a060'], [6.6e7, '#e0a070'], [7e6, '#e07a3a']];
    segs.forEach(([from, col], i) => {
      const to = i + 1 < segs.length ? segs[i + 1][0] : 0;
      const a0 = -Math.PI / 2 + (1 - from / first) * TAU, a1 = -Math.PI / 2 + (1 - to / first) * TAU;
      const aEnd = Math.min(a1, -Math.PI / 2 + k * TAU);
      if (aEnd <= a0) return;
      ctx.strokeStyle = col; ctx.lineWidth = R * 0.18;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, a0, aEnd); ctx.stroke();
    });
    ctx.fillStyle = '#123047'; ctx.font = this.font('900', 10); ctx.textAlign = 'center';
    for (let hh = 0; hh < 24; hh += 6) {
      const a = -Math.PI / 2 + (hh / 24) * TAU;
      ctx.fillText(String(hh === 0 ? 24 : hh), cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55 + 4 * u);
    }
    const ha = -Math.PI / 2 + k * TAU;
    ctx.strokeStyle = '#123047'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * R * 0.7, cy + Math.sin(ha) * R * 0.7); ctx.stroke();
    if (k >= 1) {
      const secs = Math.round(secondsInADay(3e5));
      ctx.font = this.font('900', 12);
      ctx.fillStyle = '#e07a3a';
      ctx.fillText(T(`people: the last ${secs} seconds`, `mensen: de laatste ${secs} seconden`), cx, cy + R + 26 * u);
    }
  }

  // ---------------------------------------------------------------- over everything

  private drawOverlay(): void {
    const ctx = this.ctx, u = this.u();
    if (this.mode === 'start') {
      ctx.fillStyle = 'rgba(10, 20, 30, 0.45)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.textAlign = 'center';
      outlinedText(ctx, T('From a cell to you', 'Van cel tot mens'), this.w / 2, this.h * 0.3, this.font('900', 28), '#ffffff', 'rgba(20, 40, 60, 0.9)', 7);
      ctx.font = this.font('800', 14); ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(T('The whole story of life, from the very first cell.', 'Het hele verhaal van het leven, vanaf de allereerste cel.'), this.w / 2, this.h * 0.3 + 34 * u, this.w - 40 * u);
      const bw = Math.min(260 * u, this.w - 60 * u), bh = 60 * u;
      this.button('begin', T('Start', 'Begin'), (this.w - bw) / 2, this.h * 0.58, bw, bh, '#4fae6e', '#ffffff');
      const seen = (save.journeys as Record<string, string[]>).evolutie ?? [];
      if (seen.includes('moths')) this.button('moths', T('First: how it works', 'Eerst: hoe het werkt'), (this.w - bw) / 2, this.h * 0.58 + bh + 14 * u, bw, 48 * u);
      return;
    }
    // title and date
    ctx.textAlign = 'center';
    if (this.mode === 'moths') {
      outlinedText(ctx, T('How does an animal change?', 'Hoe verandert een dier?'), this.w / 2, 40 * u, this.font('900', 19), '#ffffff', 'rgba(20, 40, 60, 0.85)', 6);
    } else {
      const s = STOPS[this.stopIndex()];
      outlinedText(ctx, NL() ? s.name.nl : s.name.en, this.w / 2, 38 * u, this.font('900', 20), '#ffffff', 'rgba(20, 40, 60, 0.85)', 6);
      outlinedText(ctx, NL() ? s.when.nl : s.when.en, this.w / 2, 60 * u, this.font('800', 12), '#ffffff', 'rgba(20, 40, 60, 0.8)', 4);
    }
    // the words
    if (this.line) {
      const bx = Math.max(GUIDE_KEEP, 14 * u), bw = this.w - bx - 14 * u;
      ctx.font = this.font('800', 13);
      const lines = this.wrap(this.line, bw - 28 * u).slice(0, this.w > this.h ? 2 : 3);
      const bh = 22 * u + lines.length * 17 * u;
      const by = this.mode === 'line' ? this.captionTop() + this.captionH() - bh : this.h - bh - 14 * u;
      glassPanel(ctx, bx, by, bw, bh, 16 * u, 0.9);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 26 * u + i * 17 * u));
    }
    if (this.mode === 'moths') {
      if (this.round === 3 && !this.queue.length && !this.afterQueue && this.lineDone()) {
        const bw = Math.min(240 * u, this.w - 60 * u);
        this.button('toLine', T('To the beginning', 'Naar het begin'), (this.w - bw) / 2, this.stage().gy - 60 * u, bw, 54 * u, '#4fae6e', '#ffffff');
      }
      return;
    }
    this.drawTimeline();
    // the X-ray button, once the first animal with a backbone has been met
    const i = this.stopIndex();
    const hasBody = !!this.bodyAt(this.pos);
    if (hasBody && i >= STOPS.findIndex(s => s.id === 'backbone')) {
      const r = 28 * u;
      const bx = this.w - r * 2 - 12 * u, by = this.stage().top + 2 * u;
      const want = STOPS[i].act === 'xray' && !this.done.has(STOPS[i].id) && this.atStop();
      if (want) this.ring({ x: bx + r, y: by + r }, r * 1.1, true);
      this.button('xray', T('X-ray', 'Röntgen'), bx, by, r * 2, r * 2, this.xray ? '#5fd4ff' : '#fffdf6', '#123047');
      if (this.xrayK > 0.3 && this.bodyAt(this.pos)!.arm > 0.1) this.drawLegend();
    }
    if (STOPS[i].act === 'clock' && this.atStop() && this.heard.has(i)) {
      const bw = Math.min(220 * u, this.w * 0.5);
      this.button('replay', T('Play it all', 'Speel alles af'), 14 * u + Math.max(GUIDE_KEEP, 0), this.stage().top + 4 * u, bw, 48 * u, '#e07a3a', '#ffffff');
    }
  }

  /** What the three colours of bone are, next to the X-ray. */
  private drawLegend(): void {
    const ctx = this.ctx, u = this.u();
    const x = 14 * u, y = this.stage().top + 4 * u;
    const rows: Array<[string, string]> = [[BONE.upper, T('upper arm', 'bovenarm')], [BONE.lower, T('lower arm', 'onderarm')], [BONE.hand, T('hand', 'hand')]];
    glassPanel(ctx, x, y, 130 * u, 76 * u, 12 * u, 0.85);
    rows.forEach(([c, name], k) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x + 10 * u, y + 12 * u + k * 20 * u, 22 * u, 10 * u, 5 * u); ctx.fill();
      ctx.fillStyle = '#123047'; ctx.font = this.font('800', 12); ctx.textAlign = 'left';
      ctx.fillText(name, x + 40 * u, y + 21 * u + k * 20 * u);
    });
  }

  private drawTimeline(): void {
    const ctx = this.ctx, u = this.u();
    const tr = this.track();
    const n = STOPS.length;
    // the track, the part reached so far lit
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10, 20, 30, 0.55)'; ctx.lineWidth = 12 * u;
    ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + tr.w, tr.y); ctx.stroke();
    const lim = this.heard.size >= n ? n - 1 : this.reach();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 6 * u;
    ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + tr.w * lim / (n - 1), tr.y); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = tr.x + tr.w * i / (n - 1);
      ctx.fillStyle = this.heard.has(i) ? '#ffffff' : i <= lim ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(x, tr.y, (i === IMPACT_AT + 1 ? 3 : 4) * u, 0, TAU); ctx.fill();
    }
    // the asteroid's mark between the mammals and the primates
    const ix = tr.x + tr.w * (IMPACT_AT + 0.4) / (n - 1);
    ctx.fillStyle = '#ff9a5a';
    ctx.beginPath(); ctx.moveTo(ix, tr.y - 9 * u); ctx.lineTo(ix + 4 * u, tr.y - 3 * u); ctx.lineTo(ix - 4 * u, tr.y - 3 * u); ctx.fill();
    // the knob
    const kx = tr.x + tr.w * this.pos / (n - 1);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6 * u;
    ctx.beginPath(); ctx.arc(kx, tr.y, 13 * u, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e07a3a';
    ctx.beginPath(); ctx.arc(kx, tr.y, 7 * u, 0, TAU); ctx.fill();
    this.hits.push({ id: 'track', x: tr.x - 16 * u, y: tr.y - 22 * u, w: tr.w + 32 * u, h: 44 * u });
    this.hits.pop(); // the track is handled by onDown itself, so a drag is never mistaken for a press
    // the arrow on: glide to the next stop
    const i = this.stopIndex();
    if (i < n - 1) {
      const bw = 52 * u, bh = 46 * u, bx = this.w - bw - 12 * u, by = tr.y - bh / 2;
      const ready = this.narrating < 0 && this.atStop() && this.heard.has(i);
      if (ready) this.ring({ x: bx + bw / 2, y: by + bh / 2 }, 26 * u, true);
      this.button('next', '›', bx, by, bw, bh, ready ? '#4fae6e' : '#fffdf6', ready ? '#ffffff' : '#25506e');
    }
  }

  private wrap(text: string, maxW: number): string[] {
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

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', label.length <= 2 ? 26 : 15);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * (label.length <= 2 ? 0.66 : 0.62), w - 12);
    this.hits.push({ id, x, y, w, h });
  }
}

export type { Stop };
export { PER_GENERATION };
