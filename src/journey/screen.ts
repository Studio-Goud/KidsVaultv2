/**
 * The screen a discovery journey happens on.
 *
 * One engine, any journey. It knows about travelling, holding, asking for more and browsing; it
 * knows nothing about planets or fish. Everything it draws it gets from the journey's own data:
 * the colour of the world between two stops, the picture at each one, what the gauge counts and
 * what you are riding in.
 *
 * ## Why there is nothing to press while you are moving
 *
 * A leg takes under three seconds and during it the screen has no buttons on it at all. That is
 * deliberate. The whole promise of this format is that it carries you: a child who has to keep
 * pressing to make progress is playing a game, and there is a hub full of games for that. What
 * the moving time is for is watching the next world come up.
 *
 * ## Why the index is not a menu
 *
 * Every stop can be opened straight from the index, including ones never visited. Nothing here is
 * locked, because nothing here is earned - it is a book, and you are allowed to open a book in the
 * middle. What the index shows instead is which ones you have had, which is what a child actually
 * wants to know.
 */

import { clamp, type Vec } from '../util/math';
import { safeArea, uiScale } from '../util/ui';
import { unlockAudio } from '../util/audio';
import { persist, save } from '../util/storage';
import { NL, T } from '../util/lang';
import { speakLine } from '../platform/voice';
import { bleedEdges, chunkyButton, glassPanel, heading, hexA, vignette } from '../render/look';
import { drawCraft } from './craft';
import { credit, drawPicture, loadPictures } from './picture';
import {
  begin, goTo, leftToTell, lineNow, onward, reading, seenAll, setOff, stopById, tellMore, toneAt,
  travel, type Trip,
} from './route';
import type { Journey, Stop } from './types';

type Ctx = CanvasRenderingContext2D;
interface Hit { id: string; x: number; y: number; w: number; h: number }

/** A speck of the world going past, so that moving looks like moving. */
interface Mote { x: number; y: number; r: number; a: number }

export class JourneyScreen {
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

  private trip: Trip = begin();
  private said = '';
  private hits: Hit[] = [];
  private held0: string | null = null;
  private index = false;
  private motes: Mote[] = [];
  /** how bright the engine is: it comes up when you set off and dies away when you stop */
  private burn = 0;
  private arrive = 0;

  constructor(private canvas: HTMLCanvasElement, private j: Journey) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    loadPictures(j);
    this.trip = { ...begin(), seen: [...(save.journeys[j.id] ?? [])] };
    (window as unknown as Record<string, unknown>)['__' + j.id] = this;
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

  /** The index is one step back; from the route itself there is nowhere to go but home. */
  canBack(): boolean { return this.index; }
  back(): void { this.index = false; }

  /** The last thing said, so the guide in the corner can say it again. */
  spoken(): string { return this.said; }

  debugState(): Record<string, unknown> {
    return {
      at: Math.round(this.trip.at * 100) / 100,
      held: this.trip.held, beat: this.trip.beat, going: this.trip.going, done: this.trip.done,
      seen: this.trip.seen, index: this.index, said: this.said,
      reading: Math.round(reading(this.j, this.trip.at)),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const s = safeArea();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.fullW = Math.floor(window.innerWidth);
    this.fullH = Math.floor(window.innerHeight);
    this.st = Math.round(s.top); this.sb = Math.round(s.bottom);
    this.sl = Math.round(s.left); this.sr = Math.round(s.right);
    this.w = this.fullW - this.sl - this.sr;
    this.h = this.fullH - this.st - this.sb;
    this.canvas.width = Math.floor(this.fullW * this.dpr);
    this.canvas.height = Math.floor(this.fullH * this.dpr);
    this.canvas.style.width = this.fullW + 'px';
    this.canvas.style.height = this.fullH + 'px';
    this.motes = [];
    const rng = (n: number): number => ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1;
    // kept a few pixels off both edges: the safe-area bleed copies the single outermost column of
    // the picture and stretches it under the notch, so one speck sitting on that column comes out
    // as a bar across it. A speck three pixels in looks the same and does not.
    const edge = 6;
    for (let i = 0; i < 44; i++) {
      this.motes.push({
        x: edge + rng(i) * Math.max(1, this.w - edge * 2),
        y: rng(i + 99) * this.h,
        r: 1 + rng(i + 7) * 2.4,
        a: 0.2 + rng(i + 31) * 0.5,
      });
    }
  }

  /** The rail down the left, and how much room that leaves. */
  private rail(): number { return 44 * this.u(); }
  /**
   * The bottom left corner belongs to the guide, in this screen as in every game. The buttons and
   * the spoken line keep out of it rather than sit on top of him: he is in the same place
   * everywhere, and that is worth more than a row being centred on the screen.
   */
  private keepClear(): number { return 58 * this.u(); }
  /** The middle of everything along the bottom, which is not the middle of the screen. */
  private midX(): number { return this.keepClear() + (this.w - this.keepClear() - 12 * this.u()) / 2; }
  private headY(): number { return 32 * this.u(); }
  /** Where the bottom band starts: the buttons and, when held, the line above them. */
  private bandY(): number { return this.h - (this.trip.held ? 148 : 96) * this.u(); }

  private stage(): { x: number; y: number; w: number; h: number } {
    const top = this.headY() + 18 * this.u();
    return { x: this.rail(), y: top, w: this.w - this.rail(), h: Math.max(60 * this.u(), this.bandY() - top) };
  }

  /** Where a point on the route sits on the rail. */
  private railY(at: number): number {
    // clear of the map button at the top and of the spoken line at the bottom. The rail is the
    // one thing on the screen that is always drawn, so it is the one that gives way.
    const top = 66 * this.u();
    const bot = this.h - 160 * this.u();
    return this.j.axis === 'up' ? bot - at * (bot - top) : top + at * (bot - top);
  }

  // ---------- the trip ----------

  private update(dt: number): void {
    const was = this.trip.held;
    if (!this.index) this.trip = travel(this.j, this.trip, dt);
    if (this.trip.held && this.trip.held !== was) {
      this.arrive = 1;
      this.remember();
    }
    this.arrive = Math.max(0, this.arrive - dt * 1.6);
    const want = this.trip.going && !this.trip.held && !this.trip.done ? 1 : 0;
    this.burn += (want - this.burn) * Math.min(1, dt * 4);
    const line = this.trip.done
      ? T(this.j.closing, this.j.closingNl)
      : this.trip.held ? lineNow(this.j, this.trip, NL()) : this.said;
    if (line && line !== this.said) { this.said = line; speakLine(line); }
  }

  /** Which stops have been reached is the one thing a journey keeps. */
  private remember(): void {
    save.journeys[this.j.id] = [...this.trip.seen];
    persist();
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    let id: string | null = null;
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) id = h.id;
    this.held0 = id;
    setTimeout(() => { this.held0 = null; }, 130);
    if (!id) return;
    if (id === 'index') { this.index = !this.index; return; }
    if (id === 'close') { this.index = false; return; }
    if (id.startsWith('stop:')) {
      this.trip = goTo(this.j, this.trip, id.slice(5));
      this.index = false;
      this.arrive = 1;
      this.remember();
      return;
    }
    if (id === 'go') {
      this.trip = setOff(this.trip);
      const open = T(this.j.opening, this.j.openingNl);
      this.said = open; speakLine(open);
      return;
    }
    if (id === 'more') { this.trip = tellMore(this.j, this.trip); return; }
    if (id === 'on') { this.trip = onward(this.j, this.trip); return; }
    if (id === 'again') { this.trip = { ...begin(), seen: this.trip.seen }; this.said = ''; return; }
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return String(weight) + ' ' + Math.round(size * this.u()) + 'px Nunito, system-ui, sans-serif';
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];

    this.sky();
    this.drawMotes();
    if (this.index) { this.drawIndex(); return; }
    this.drawWorld();
    this.drawRail();
    this.drawBand();
    vignette(ctx, this.w, this.h, 0.26, '4, 8, 20');
    this.button('index', T('Map', 'Overzicht'), 12 * this.u() + 47 * this.u(), 12 * this.u() + 21 * this.u(),
      94 * this.u(), 42 * this.u(), false);
  }

  /** The world's colour where we are, going to black overhead. */
  private sky(): void {
    const ctx = this.ctx;
    const tone = toneAt(this.j, this.trip.at);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    const deep = this.j.axis === 'up' ? '#080c1c' : '#02101d';
    g.addColorStop(0, this.j.axis === 'up' ? deep : hexA(tone, 1));
    g.addColorStop(0.55, hexA(tone, 0.55));
    g.addColorStop(1, this.j.axis === 'up' ? hexA(tone, 0.35) : deep);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawMotes(): void {
    const ctx = this.ctx;
    // they run against the travel, which is the only thing on the screen that says "moving"
    const dir = this.j.axis === 'up' ? 1 : -1;
    const drift = this.trip.at * this.h * 2.4 * dir;
    ctx.fillStyle = '#ffffff';
    for (const m of this.motes) {
      const y = ((m.y + drift) % this.h + this.h) % this.h;
      ctx.globalAlpha = m.a * 0.6;
      ctx.beginPath(); ctx.arc(m.x, y, m.r * this.u() * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The stop we are at, or the one coming up, growing as we near it. */
  private drawWorld(): void {
    const ctx = this.ctx, u = this.u(), st = this.stage();
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const full = Math.max(38 * u, Math.min(st.w * 0.38, st.h * 0.42));

    const here = stopById(this.j, this.trip.held);
    const next = here ?? this.nextAhead();
    if (!next) return;

    // how close we are to it, which is how big it is
    const from = this.legFrom();
    const k = here ? 1 : clamp((this.trip.at - from) / Math.max(1e-4, next.at - from), 0, 1);
    const r = full * (0.2 + 0.8 * k * k);
    const pop = here ? 1 + 0.06 * this.arrive : 1;
    drawPicture(ctx, this.j, next, cx, cy, r * pop, this.t);

    if (here) {
      heading(ctx, NL() ? here.titleNl : here.title, cx, this.headY() + 6 * u,
        this.font('900', 21), '#ffffff');
      const who = credit(here);
      if (who) {
        ctx.font = this.font('700', 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(who, cx, cy + r * pop + 16 * u, st.w - 20 * u);
      }
    }
  }

  private nextAhead(): Stop | null {
    for (const s of this.j.stops) if (s.at >= this.trip.at - 1e-6 && !this.trip.seen.includes(s.id)) return s;
    return this.j.stops[this.j.stops.length - 1] ?? null;
  }

  private legFrom(): number {
    let out = 0;
    for (const s of this.j.stops) if (s.at <= this.trip.at + 1e-6) out = s.at;
    return out;
  }

  /** The route itself, with a pip per stop and the craft riding it. */
  private drawRail(): void {
    const ctx = this.ctx, u = this.u();
    const x = this.rail() * 0.42;
    const y0 = this.railY(this.j.axis === 'up' ? 1 : 0);
    const y1 = this.railY(this.j.axis === 'up' ? 0 : 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();

    for (const s of this.j.stops) {
      const y = this.railY(s.at);
      const seen = this.trip.seen.includes(s.id);
      ctx.fillStyle = seen ? s.tone : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(x, y, (seen ? 4.4 : 3) * u, 0, Math.PI * 2); ctx.fill();
    }

    const cy = this.railY(this.trip.at);
    drawCraft(ctx, this.j.craft, x, cy, 30 * u, this.j.axis === 'up' ? 0 : Math.PI, this.burn);

    // the gauge: what the journey counts, beside the craft
    const n = reading(this.j, this.trip.at);
    const shown = n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
    ctx.textAlign = 'left';
    ctx.font = this.font('900', 11);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(shown, x + 12 * u, cy - 1 * u);
    ctx.font = this.font('700', 8.5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(NL() ? this.j.unitNl : this.j.unit, x + 12 * u, cy + 10 * u);
    ctx.textAlign = 'center';
  }

  /** The bottom of the screen: what is being said, and what you can do about it. */
  private drawBand(): void {
    const ctx = this.ctx, u = this.u();
    const room = this.w - this.keepClear() - 12 * u;
    const bw = Math.min(190 * u, (room - 10 * u) / 2);
    const one = Math.min(240 * u, room);
    const bh = 52 * u;
    const by = this.h - 34 * u;
    const mid = this.midX();

    if (!this.trip.going) {
      this.button('go', T('Off we go', 'We gaan'), mid, by, one, bh, true);
      this.line(T('Press when you are ready. It takes you the whole way.',
        'Druk maar als je klaar bent. Hij brengt je helemaal naar het eind.'), by - bh);
      return;
    }
    if (this.trip.done) {
      this.line(this.said, by - bh);
      this.button('again', T('Again', 'Nog een keer'), mid, by, one, bh, true);
      return;
    }
    if (!this.trip.held) return;

    this.line(this.said, by - bh);
    const more = leftToTell(this.j, this.trip) > 0;
    const last = this.trip.held === this.j.stops[this.j.stops.length - 1].id;
    const onLabel = last ? T('Finish', 'Klaar') : T('On we go', 'Verder');
    if (more) {
      this.button('more', T('Tell me more', 'Vertel meer'), mid - bw / 2 - 5 * u, by, bw, bh, false);
      this.button('on', onLabel, mid + bw / 2 + 5 * u, by, bw, bh, true);
    } else {
      this.button('on', onLabel, mid, by, one, bh, true);
    }
  }

  /** One line of what the guide is saying, wrapped to the screen. */
  private line(text: string, bottom: number): void {
    if (!text) return;
    const ctx = this.ctx, u = this.u();
    // clear of the rail on one side and the screen edge on the other, over the same middle the
    // buttons use, so the line and the buttons read as one thing
    const mid = this.midX();
    const maxW = Math.min(this.w - this.rail() - 20 * u, (this.w - mid) * 2 - 16 * u);
    ctx.font = this.font('800', 12.5);
    const rows = wrap(ctx, text, maxW - 28 * u);
    const lh = 17 * u;
    const ph = rows.length * lh + 18 * u;
    const pw = Math.min(maxW, Math.max(...rows.map(r => ctx.measureText(r).width)) + 28 * u);
    const y = bottom - ph - 12 * u;
    glassPanel(ctx, mid - pw / 2, y, pw, ph, 15 * u, 0.9);
    ctx.fillStyle = '#123047';
    ctx.textAlign = 'center';
    rows.forEach((r, i) => ctx.fillText(r, mid, y + 13 * u + lh * (i + 0.6)));
  }

  /** Every stop at once, and you may open any of them. */
  private drawIndex(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(6, 10, 24, 0.82)';
    ctx.fillRect(0, 0, this.w, this.h);
    // left of the back and home buttons, which live in the top right corner of every page
    heading(ctx, NL() ? this.j.titleNl : this.j.title, (this.w - 120 * u) / 2, 34 * u,
      this.font('900', 17), '#ffffff');

    // everyone whose work is on this page, in full, because some of these licences ask for it.
    // It is measured first because the grid has to leave room for it: three lines of credit on a
    // small phone would otherwise sit on top of the last row of names.
    const owed = [...new Set(this.j.stops.map(credit).filter(Boolean))];
    ctx.font = this.font('700', 8);
    const creditRows = owed.length ? wrap(ctx, owed.join(' \u00b7 '), this.w - 30 * u).slice(0, 3) : [];
    const top = 54 * u, bot = this.h - (78 + creditRows.length * 11) * u;
    const n = this.j.stops.length;
    const cols = Math.max(3, Math.min(5, Math.floor((this.w - 24 * u) / (86 * u))));
    const rows = Math.ceil(n / cols);
    const cw = (this.w - 24 * u) / cols;
    const ch = clamp((bot - top) / rows, 56 * u, 150 * u);
    // the grid sits in the middle of what is left rather than at the top of it: eleven stops on a
    // tall phone otherwise leave half a screen of black under them
    const gridTop = top + Math.max(0, (bot - top - rows * ch) / 2);
    const r = Math.min(cw * 0.3, ch * 0.3);
    this.j.stops.forEach((s, i) => {
      const cx = 12 * u + cw * (i % cols) + cw / 2;
      const cy = gridTop + ch * Math.floor(i / cols) + ch / 2;
      const seen = this.trip.seen.includes(s.id);
      ctx.save();
      // Saturn is drawn by its globe, so its rings hang outside the circle. In one big picture
      // that is exactly right; in a grid it would reach into the next cell, so each cell keeps
      // what it draws.
      ctx.beginPath(); ctx.rect(cx - cw / 2, cy - ch / 2, cw, ch); ctx.clip();
      ctx.globalAlpha = seen ? 1 : 0.62;
      drawPicture(ctx, this.j, s, cx, cy - ch * 0.12, r, this.t);
      ctx.restore();
      ctx.fillStyle = seen ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.font = this.font('800', 10);
      ctx.textAlign = 'center';
      ctx.fillText(NL() ? s.titleNl : s.title, cx, cy + ch * 0.3, cw - 8 * u);
      this.hits.push({ id: 'stop:' + s.id, x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch });
    });

    if (creditRows.length) {
      ctx.font = this.font('700', 8);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      creditRows.forEach((r, i) => ctx.fillText(r, this.w / 2, this.h - 64 * u + (i - creditRows.length + 1) * 11 * u));
    }
    if (seenAll(this.j, this.trip.seen)) {
      ctx.font = this.font('800', 10.5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(T('You have been everywhere.', 'Je bent overal geweest.'), this.w / 2, 48 * u);
    }
    this.button('close', T('Back', 'Terug'), this.w / 2, this.h - 32 * u, Math.min(200 * u, this.w - 80 * u), 48 * u, true);
  }

  private button(id: string, label: string, cx: number, cy: number, w: number, h: number, strong: boolean): void {
    const ctx = this.ctx;
    const x = cx - w / 2, y = cy - h / 2;
    const face = chunkyButton(ctx, x, y, w, h, {
      tone: strong ? '#fdf6e6' : '#e6ecf3',
      pressed: this.held0 === id,
    });
    ctx.fillStyle = '#123047';
    ctx.font = this.font('900', h > 46 * this.u() ? 14.5 : 12.5);
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, face.y + h * 0.63, w - 18);
    this.hits.push({ id, x, y, w, h });
  }
}

/** Break a line into rows that fit. Nothing clever: this is one sentence, not a paragraph. */
export function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const rows: string[] = [];
  let row = '';
  for (const word of words) {
    const test = row ? row + ' ' + word : word;
    if (row && ctx.measureText(test).width > maxW) { rows.push(row); row = word; }
    else row = test;
  }
  if (row) rows.push(row);
  return rows;
}
