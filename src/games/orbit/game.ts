/**
 * Orbit - the planets game in Bramblewood.
 *
 * Four rounds, each one question repeated: which planet comes next? The child taps, the planet
 * flies onto the track and says one true thing about itself. Rounds one and two take the inner and
 * the outer planets in turn, round three takes all eight, and round four asks for them largest
 * first, which is a different ordering and therefore a different piece of knowledge.
 *
 * Everything is drawn with canvas paths. No photographs, no advertising, no tracking.
 */

import { clamp, dist, lerp, TAU, type Vec } from '../../util/math';
import { BODIES, type Body } from './bodies';
import { drawBody, drawSun, radiusFor, reachOf, sizeOrder, starField, sunOrder } from './draw';
import { CREDITS, loadAllPlanets } from './photo';
import { uiScale } from '../../util/ui';

type Ctx = CanvasRenderingContext2D;
type Phase = 'picking' | 'flying' | 'wrong' | 'roundDone' | 'finished';

interface Slot { body: Body; pos: Vec; r: number; placed: boolean }
interface Flyer { body: Body; from: Vec; to: Vec; r0: number; r1: number; t0: number }

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (b: Body): string => (NL() ? b.nameNl : b.name);
const factOf = (b: Body): string => (NL() ? b.factNl : b.fact);

interface Round { title: string; titleNl: string; bodies: Body[]; order: (b: Body[]) => Body[] }

const ROUNDS: Round[] = [
  { title: 'The four rocky planets, nearest the sun first', titleNl: 'De vier rotsplaneten, dichtst bij de zon eerst', bodies: BODIES.slice(0, 4), order: sunOrder },
  { title: 'The four giants, nearest the sun first', titleNl: 'De vier reuzen, dichtst bij de zon eerst', bodies: BODIES.slice(4), order: sunOrder },
  { title: 'All eight, nearest the sun first', titleNl: 'Alle acht, dichtst bij de zon eerst', bodies: BODIES, order: sunOrder },
  { title: 'All eight again, largest first', titleNl: 'Alle acht opnieuw, de grootste eerst', bodies: BODIES, order: sizeOrder },
];

export class Orbit {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private t = 0;
  private raf = 0;

  private round = 0;
  private phase: Phase = 'picking';
  private phaseT = 0;
  private want: Body[] = [];
  private placedCount = 0;
  private choices: Slot[] = [];
  private flyer: Flyer | null = null;
  private fact = '';
  private factT = 0;
  private wrongId: string | null = null;
  private stars = starField(1, 1);
  private photosReady = false;
  private hits: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    this.startRound(0);
    void loadAllPlanets(BODIES.map(b => b.id)).then(() => { this.photosReady = true; this.layout(); });
    (window as unknown as { __orbit?: Orbit }).__orbit = this;
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

  destroy(): void { cancelAnimationFrame(this.raf); }

  debugState(): { phase: Phase; round: number; placed: number; next: string | null; choices: Array<{ id: string; x: number; y: number; placed: boolean }> } {
    return {
      phase: this.phase, round: this.round, placed: this.placedCount,
      next: this.want[this.placedCount]?.id ?? null,
      choices: this.choices.map(c => ({ id: c.body.id, x: Math.round(c.pos.x), y: Math.round(c.pos.y), placed: c.placed })),
    };
  }

  // ---------- layout ----------

  private resize(): void {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.stars = starField(this.w, this.h);
    if (this.want.length) this.layout();
  }

  /** How much bigger than a phone this screen is. */
  private u(): number { return uiScale(this.w, this.h); }

  /** The track along the bottom, and the tray of planets still to place. */
  private trackY(): number { return this.h - 92 * this.u(); }
  /** the sun sits at the start of the track, fully on screen */
  private sunX(): number { return 34 * this.u(); }
  // no hard ceiling: on a tablet the planets should actually fill the room they have
  private maxR(): number { return clamp(Math.min(this.w / 11, this.h / 13), 16, 110); }

  /** How wide a body is on screen, rings included. */
  private halfWidth(b: Body, r: number): number { return r * reachOf(b); }

  /** A planet on the track must fit its slot, so the track radius follows the spacing. */
  private trackR(b: Body, step: number): number {
    return Math.min(radiusFor(b, this.maxR()), step * 0.40);
  }

  private layout(): void {
    const n = this.want.length;
    const left = 78 * this.u(), right = this.w - 22 * this.u();
    const step = (right - left) / n;
    const placed = this.choices.filter(c => c.placed);
    const loose = this.choices.filter(c => !c.placed);

    for (const c of placed) {
      const k = this.want.findIndex(b => b.id === c.body.id);
      c.r = this.trackR(c.body, step);
      c.pos = { x: left + step * (k + 0.5), y: this.trackY() };
    }

    if (!loose.length) return;
    const tray = this.trayRect();
    const cols = Math.min(4, loose.length);
    const rows = Math.ceil(loose.length / cols);
    const cellW = tray.w / cols;
    // shrink the whole tray until the widest body, Saturn with its rings, fits inside one cell
    let scale = 1;
    for (const c of loose) {
      const half = this.halfWidth(c.body, radiusFor(c.body, this.maxR()) * 1.3);
      scale = Math.min(scale, (cellW * 0.46) / half);
    }
    const rowH = Math.min(tray.h / rows, this.maxR() * 3.2);
    const y0 = tray.y + (tray.h - rowH * rows) / 2;
    loose.forEach((c, i) => {
      c.r = radiusFor(c.body, this.maxR()) * 1.3 * scale;
      const col = i % cols, row = Math.floor(i / cols);
      // a short final row is centred rather than left over on one side
      const inRow = Math.min(cols, loose.length - row * cols);
      const rowX = tray.x + (tray.w - cellW * inRow) / 2;
      c.pos = { x: rowX + cellW * (col + 0.5), y: y0 + rowH * (row + 0.5) };
    });
  }

  private trayRect(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const top = 118 * u, bottom = this.trackY() - 82 * u;
    return { x: 16 * u, y: top, w: this.w - 32 * u, h: Math.max(110 * u, bottom - top) };
  }

  // ---------- rounds ----------

  private startRound(i: number): void {
    this.round = i;
    const r = ROUNDS[i];
    this.want = r.order(r.bodies);
    this.placedCount = 0;
    this.fact = '';
    // the tray is shuffled, but deterministically, so a child who replays sees the same puzzle
    const shuffled = [...r.bodies].sort((a, b) => ((a.diameter * 7 + i) % 97) - ((b.diameter * 7 + i) % 97));
    this.choices = shuffled.map(b => ({ body: b, pos: { x: 0, y: 0 }, r: 20, placed: false }));
    this.layout();
    this.phase = 'picking'; this.phaseT = 0;
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.factT = Math.max(0, this.factT - dt);
    if (this.flyer && this.t - this.flyer.t0 > 0.55) {
      const c = this.choices.find(x => x.body.id === this.flyer!.body.id)!;
      c.placed = true;
      this.flyer = null;
      this.placedCount++;
      this.layout();
      if (this.placedCount >= this.want.length) { this.phase = 'roundDone'; this.phaseT = 0; }
      else this.phase = 'picking';
    }
    if (this.phase === 'wrong' && this.phaseT > 0.7) { this.wrongId = null; this.phase = 'picking'; }
    if (this.phase === 'roundDone' && this.phaseT > 2.4) {
      if (this.round + 1 >= ROUNDS.length) { this.phase = 'finished'; this.phaseT = 0; }
      else this.startRound(this.round + 1);
    }
  }

  // ---------- input ----------

  private onDown(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    for (const h of this.hits) {
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        if (h.id === 'again') { this.startRound(0); return; }
      }
    }
    if (this.phase !== 'picking') return;
    const want = this.want[this.placedCount];
    for (const c of this.choices) {
      if (c.placed) continue;
      if (dist(c.pos, p) > Math.max(30 * this.u(), c.r * 1.5)) continue;
      if (c.body.id === want.id) {
        const k = this.placedCount;
        const left = 78 * this.u(), step = (this.w - 22 * this.u() - left) / this.want.length;
        this.flyer = {
          body: c.body, from: { ...c.pos }, to: { x: left + step * (k + 0.5), y: this.trackY() },
          r0: c.r, r1: this.trackR(c.body, step), t0: this.t,
        };
        this.fact = `${nameOf(c.body)} - ${factOf(c.body)}`;
        this.factT = 3.2;
        this.phase = 'flying'; this.phaseT = 0;
      } else {
        this.wrongId = c.body.id;
        this.phase = 'wrong'; this.phaseT = 0;
      }
      return;
    }
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#05081c'); g.addColorStop(0.6, '#0b1236'); g.addColorStop(1, '#141c4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(this.t * 0.8 + s.p));
      ctx.fillStyle = '#dbe6ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.hits = [];

    if (this.phase === 'finished') { this.drawFinish(); return; }

    // the track along the bottom with the sun at its left end
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.beginPath(); ctx.moveTo(this.sunX() + 30 * this.u(), this.trackY()); ctx.lineTo(this.w - 14, this.trackY()); ctx.stroke();
    ctx.setLineDash([]);
    drawSun(ctx, this.sunX(), this.trackY(), 22 * this.u(), this.t);

    // planets already on the track, and the tray
    for (const c of this.choices) {
      if (this.flyer && c.body.id === this.flyer.body.id) continue;
      const shake = this.wrongId === c.body.id ? Math.sin(this.t * 40) * 5 : 0;
      drawBody(ctx, c.body, c.pos.x + shake, c.pos.y, c.r, this.dpr);
      if (c.placed) {
        // with eight planets the slots are too narrow for eight names, so only the newest is spelled out
        const k = this.want.findIndex(x => x.id === c.body.id);
        const roomy = this.want.length <= 5;
        if (roomy || k === this.placedCount - 1 || this.phase === 'roundDone') {
          ctx.fillStyle = roomy ? 'rgba(226,236,255,0.85)' : 'rgba(226,236,255,0.55)';
          ctx.font = this.font('800', roomy ? 10 : 8.5); ctx.textAlign = 'center';
          ctx.fillText(nameOf(c.body), c.pos.x, this.trackY() + 26 * this.u(), 64 * this.u());
        }
      }
    }
    if (this.flyer) {
      const k = clamp((this.t - this.flyer.t0) / 0.55, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      drawBody(ctx, this.flyer.body,
        lerp(this.flyer.from.x, this.flyer.to.x, e), lerp(this.flyer.from.y, this.flyer.to.y, e),
        lerp(this.flyer.r0, this.flyer.r1, e), this.dpr);
    }

    this.drawChrome();
  }

  private drawChrome(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    const r = ROUNDS[this.round];
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 19);
    ctx.fillText(
      this.phase === 'roundDone' ? T('That is the order', 'Dat is de volgorde')
        : this.phase === 'wrong' ? T('Not that one yet', 'Die nog even niet')
          : T('Which comes next?', 'Welke komt hierna?'),
      this.w / 2, 46 * this.u());
    ctx.fillStyle = 'rgba(214,228,255,0.68)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(NL() ? r.titleNl : r.title, this.w / 2, 70 * this.u(), this.w - 40);

    // progress dots, one per round
    const gap = 16 * this.u(), x0 = this.w / 2 - ((ROUNDS.length - 1) * gap) / 2;
    for (let i = 0; i < ROUNDS.length; i++) {
      ctx.fillStyle = i < this.round ? '#9df7c4' : i === this.round ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, 92 * this.u(), (i < this.round ? 4.5 : 3.5) * this.u(), 0, TAU); ctx.fill();
    }

    if (this.factT > 0 && this.fact) {
      const a = clamp(this.factT / 0.6, 0, 1);
      ctx.globalAlpha = a;
      const u = this.u(), y = this.trackY() - 54 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.roundRect(18 * u, y - 22 * u, this.w - 36 * u, 36 * u, 12 * u); ctx.fill();
      ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('800', 12.5);
      ctx.fillText(this.fact, this.w / 2, y + 2 * u, this.w - 52 * u);
      ctx.globalAlpha = 1;
    }
  }

  private drawFinish(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 24);
    ctx.fillText(T('You know your way around', 'Je kent de weg nu'), this.w / 2, this.h * 0.24);
    ctx.fillStyle = 'rgba(214,228,255,0.7)'; ctx.font = this.font('700', 13);
    ctx.fillText(T('Eight planets, in both orders.', 'Acht planeten, in allebei de volgordes.'), this.w / 2, this.h * 0.24 + 26);

    // a parade of all eight at their real relative sizes, rings and labels given their own room
    const order = sunOrder(BODIES);
    const gap = 6;
    let maxR = clamp(this.w / 13, 12, 90);
    const widths = (mr: number): number[] => order.map(b => Math.max(this.halfWidth(b, radiusFor(b, mr)) * 2 + gap, 40));
    while (maxR > 8 && widths(maxR).reduce((s, x) => s + x, 0) > this.w - 16) maxR -= 1;
    const ws = widths(maxR);
    let x = (this.w - ws.reduce((s, v) => s + v, 0)) / 2;
    order.forEach((b, i) => {
      const rr = radiusFor(b, maxR);
      const cx = x + ws[i] / 2;
      drawBody(ctx, b, cx, this.h * 0.5, rr, this.dpr);
      ctx.fillStyle = 'rgba(226,236,255,0.8)'; ctx.font = this.font('800', 8.5);
      ctx.fillText(nameOf(b), cx, this.h * 0.5 + maxR + 18 * this.u(), ws[i] - 2);
      x += ws[i];
    });

    const u = this.u(), w = 200 * u, h = 48 * u, bx = this.w / 2 - w / 2, by = this.h * 0.68;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('800', 15);
    ctx.fillText(T('Go round again', 'Nog een rondje'), this.w / 2, by + h * 0.63);
    this.hits.push({ id: 'again', x: bx, y: by, w, h });

    // the photographs are somebody's work, even when they are free to use
    ctx.fillStyle = 'rgba(200,214,240,0.45)'; ctx.font = this.font('700', 9);
    ctx.fillText(T('Photographs:', 'Foto’s:') + ' NASA, JPL-Caltech, ESA/Hubble, Cassini, Voyager, Apollo', this.w / 2, by + h + 26 * u, this.w - 24);
    const shown = [...new Set(Object.values(CREDITS))].slice(0, 3).join(' · ');
    ctx.fillText(shown, this.w / 2, by + h + 40 * u, this.w - 24);
  }
}
