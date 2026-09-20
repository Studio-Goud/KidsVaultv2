/**
 * Night Watch - the second game in Bramblewood.
 *
 * The sky shows a figure, the lines fade, and the child draws it back from memory. That is the
 * whole game. It practises visual working memory: holding a shape in mind while the original is
 * gone. Difficulty grows the way memory span grows, by adding one element at a time: more lines
 * in the figure, more look-alike stars around it, less time to look.
 *
 * Like Cloudhopper it is drawn entirely with canvas paths. No images, no advertising, no tracking.
 */

import { clamp, dist, lerp, TAU, type Vec } from '../../util/math';
import { makeRng } from '../../util/rng';
import { uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { edgeKey, FIGURES, type Figure } from './figures';
import { chunkyButton } from '../../render/look';
import { paintNightSky } from './paint';
import { night } from './nightsfx';

type Ctx = CanvasRenderingContext2D;
type Phase = 'intro' | 'showing' | 'drawing' | 'wrong' | 'solved' | 'finished';

interface Star { pos: Vec; r: number; twinkle: number; figureIndex: number | null }
interface Edge { a: number; b: number; wrong?: boolean; t0: number }

const ROUNDS = 6;
const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);

/** How hard round `i` of `ROUNDS` is. */
function roundPlan(i: number): { figure: Figure; distractors: number; showMs: number } {
  const order = [...FIGURES].sort((a, b) => a.edges.length - b.edges.length);
  const figure = order[Math.min(i, order.length - 1)];
  return {
    figure,
    distractors: Math.round(lerp(5, 16, i / (ROUNDS - 1))),
    showMs: Math.round(lerp(4200, 2500, i / (ROUNDS - 1))),
  };
}

export class NightWatch {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private t = 0;
  private raf = 0;

  private round = 0;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private stars: Star[] = [];
  private figure: Figure = FIGURES[0];
  /** figure star index -> index into this.stars */
  private figureStars: number[] = [];
  private target = new Set<string>();
  private drawn: Edge[] = [];
  private from: number | null = null;
  private pointer: Vec | null = null;
  private peeks = 0;
  private solvedNames: string[] = [];
  private bg: Array<{ x: number; y: number; r: number; a: number; p: number }> = [];
  private shake = 0;
  private hits: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.from = null; this.pointer = null; });
    this.startRound(0);
    (window as unknown as { __nw?: NightWatch }).__nw = this; // debug handle, same as Cloudhopper's __wh
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

  /** Test view: where the stars are and which of them belong to the figure. */
  debugState(): { phase: Phase; round: number; solved: string[]; stars: Array<{ x: number; y: number; fig: number | null }> } {
    return {
      phase: this.phase, round: this.round, solved: [...this.solvedNames],
      stars: this.stars.map(s => ({ x: Math.round(s.pos.x), y: Math.round(s.pos.y), fig: s.figureIndex })),
    };
  }

  // ---------- layout ----------

  private resize(): void {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.makeBackdrop();
    if (this.stars.length) this.placeStars();
  }

  private makeBackdrop(): void {
    const rng = makeRng(20260920);
    this.bg = [];
    const n = Math.round((this.w * this.h) / 5200);
    for (let i = 0; i < n; i++) {
      this.bg.push({ x: rng() * this.w, y: rng() * this.h, r: 0.4 + rng() * 1.3, a: 0.2 + rng() * 0.6, p: rng() * TAU });
    }
  }

  /** How much bigger than a phone this screen is. */
  private u(): number { return uiScale(this.w, this.h); }

  /**
   * The play field. It follows the screen rather than staying square, so a tablet held sideways
   * actually uses its width, but never stretches further than 1.4 to 1 or the figures would start
   * to look like different figures.
   */
  private field(): { x: number; y: number; w: number; h: number; s: number } {
    const u = this.u();
    const top = 122 * u, bottom = 96 * u;
    const availW = this.w - 40 * u, availH = this.h - top - bottom;
    let w = availW, h = availH;
    if (w / h > 1.4) w = h * 1.4;
    if (h / w > 1.4) h = w * 1.4;
    return { x: (this.w - w) / 2, y: top + (availH - h) / 2, w, h, s: Math.min(w, h) };
  }

  // ---------- rounds ----------

  private startRound(i: number): void {
    this.round = i;
    const plan = roundPlan(i);
    this.figure = plan.figure;
    this.target = new Set(plan.figure.edges.map(([a, b]) => edgeKey(a, b)));
    this.drawn = [];
    this.from = null;
    this.peeks = 0;
    this.placeStars();
    this.setPhase('showing');
  }

  private placeStars(): void {
    const plan = roundPlan(this.round);
    const f = this.field();
    const rng = makeRng(1000 + this.round * 77);
    const stars: Star[] = [];
    this.figureStars = [];
    for (const [nx, ny] of this.figure.stars) {
      this.figureStars.push(stars.length);
      stars.push({ pos: { x: f.x + nx * f.w, y: f.y + ny * f.h }, r: 4.6 * this.u(), twinkle: rng() * TAU, figureIndex: stars.length });
    }
    // look-alike stars, never so close that two stars become one tap target
    let guard = 0;
    while (stars.length < this.figure.stars.length + plan.distractors && guard++ < 4000) {
      const p = { x: f.x + (0.04 + rng() * 0.92) * f.w, y: f.y + (0.04 + rng() * 0.92) * f.h };
      if (stars.some(s => dist(s.pos, p) < f.s * 0.11)) continue;
      stars.push({ pos: p, r: (3.4 + rng() * 1.4) * this.u(), twinkle: rng() * TAU, figureIndex: null });
    }
    this.stars = stars;
  }

  private setPhase(p: Phase): void {
    if (p !== this.phase) {
      if (p === 'showing') night.show();
      else if (p === 'solved') night.solved();
      else if (p === 'wrong') night.wrong();
    }
    this.phase = p;
    this.phaseT = 0;
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    const plan = roundPlan(this.round);
    if (this.phase === 'showing' && this.phaseT > plan.showMs / 1000) this.setPhase('drawing');
    if (this.phase === 'wrong' && this.phaseT > 1.1) {
      this.drawn = this.drawn.filter(e => !e.wrong);
      this.setPhase('drawing');
    }
    if (this.phase === 'solved' && this.phaseT > 2.2) {
      if (this.round + 1 >= ROUNDS) { night.complete(); this.setPhase('finished'); }
      else this.startRound(this.round + 1);
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private starAt(p: Vec): number | null {
    const grab = Math.max(26 * this.u(), this.field().s * 0.055);
    let best: number | null = null, bd = grab;
    this.stars.forEach((s, i) => { const d = dist(s.pos, p); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    const p = this.at(e);
    const hit = this.hitAt(p);
    unlockAudio();
    if (hit === 'peek' && this.phase === 'drawing') { this.peeks++; night.peek(); this.setPhase('showing'); return; }
    if (hit === 'again' && this.phase === 'finished') { night.tap(); this.solvedNames = []; this.startRound(0); return; }
    if (this.phase !== 'drawing') return;
    const s = this.starAt(p);
    if (s !== null) { this.from = s; this.pointer = p; night.hold(); }
  }

  private onMove(e: PointerEvent): void {
    if (this.from === null) return;
    this.pointer = this.at(e);
  }

  private onUp(e: PointerEvent): void {
    if (this.from === null) return;
    const to = this.starAt(this.at(e));
    const from = this.from;
    this.from = null; this.pointer = null;
    if (to === null || to === from) return;
    const key = edgeKey(from, to);
    // tapping an existing line removes it again, so a mistake is never a dead end
    const existing = this.drawn.findIndex(d => edgeKey(d.a, d.b) === key);
    if (existing >= 0) { this.drawn.splice(existing, 1); night.undo(); return; }
    this.drawn.push({ a: from, b: to, t0: this.t });
    night.line(this.drawn.length - 1);
    if (this.drawn.length >= this.target.size) this.check();
  }

  private check(): void {
    let bad = 0;
    for (const e of this.drawn) {
      const fa = this.stars[e.a].figureIndex, fb = this.stars[e.b].figureIndex;
      const ok = fa !== null && fb !== null && this.target.has(edgeKey(fa, fb));
      e.wrong = !ok;
      if (!ok) bad++;
    }
    if (bad === 0) {
      this.solvedNames.push(NL() ? this.figure.nameNl : this.figure.name);
      this.setPhase('solved');
    } else {
      this.shake = 1;
      this.setPhase('wrong');
    }
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // night sky: graded, with a milky way, far stars and a dark land along the bottom
    paintNightSky(ctx, this.w, this.h, this.t, this.u());
    for (const s of this.bg) {
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(this.t * 0.7 + s.p));
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.hits = [];
    if (this.phase === 'finished') { this.drawFinish(); return; }

    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.t * 40) * this.shake * 5, 0);

    this.drawFigureLines();
    this.drawPlayerLines();
    this.drawStars();

    ctx.restore();
    this.drawChrome();
  }

  /** The figure itself, while the sky is showing it or celebrating it. */
  private drawFigureLines(): void {
    const ctx = this.ctx;
    const showing = this.phase === 'showing';
    const solved = this.phase === 'solved';
    if (!showing && !solved) return;
    const plan = roundPlan(this.round);
    // during showing the line draws itself edge by edge, like tracing with a finger
    const per = (plan.showMs / 1000) * 0.62 / this.figure.edges.length;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.figure.edges.forEach(([ia, ib], i) => {
      const a = this.stars[this.figureStars[ia]].pos, b = this.stars[this.figureStars[ib]].pos;
      let k = 1;
      if (showing) {
        k = clamp((this.phaseT - i * per) / per, 0, 1);
        if (k <= 0) return;
      }
      const fade = showing ? clamp((plan.showMs / 1000 - this.phaseT) / 0.5, 0, 1) : 1;
      const px = lerp(a.x, b.x, k), py = lerp(a.y, b.y, k);
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = solved ? '#9df7c4' : '#bcd8ff';
      ctx.lineWidth = solved ? 4 : 3;
      ctx.shadowColor = solved ? 'rgba(120,255,190,0.8)' : 'rgba(150,200,255,0.7)';
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(px, py); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  private drawPlayerLines(): void {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const e of this.drawn) {
      const a = this.stars[e.a].pos, b = this.stars[e.b].pos;
      const grow = clamp((this.t - e.t0) * 6, 0, 1);
      ctx.strokeStyle = e.wrong ? 'rgba(255,120,130,0.95)' : 'rgba(255,238,190,0.92)';
      ctx.lineWidth = 3;
      ctx.shadowColor = e.wrong ? 'rgba(255,90,110,0.7)' : 'rgba(255,220,140,0.6)';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a.x, b.x, grow), lerp(a.y, b.y, grow));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (this.from !== null && this.pointer) {
      const a = this.stars[this.from].pos;
      ctx.strokeStyle = 'rgba(255,238,190,0.55)'; ctx.lineWidth = 2.4;
      ctx.setLineDash([6, 7]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(this.pointer.x, this.pointer.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawStars(): void {
    const ctx = this.ctx;
    const reveal = this.phase === 'showing' || this.phase === 'solved';
    this.stars.forEach((s, i) => {
      const isFigure = s.figureIndex !== null;
      const lit = reveal && isFigure;
      const tw = 0.75 + 0.25 * Math.sin(this.t * 1.7 + s.twinkle);
      const r = s.r * (lit ? 1.5 : 1) * tw;
      const glow = ctx.createRadialGradient(s.pos.x, s.pos.y, 0, s.pos.x, s.pos.y, r * 5);
      glow.addColorStop(0, lit ? 'rgba(200,240,255,0.85)' : 'rgba(180,210,255,0.45)');
      glow.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(s.pos.x, s.pos.y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = this.from === i ? '#ffe9a8' : '#ffffff';
      ctx.beginPath(); ctx.arc(s.pos.x, s.pos.y, r, 0, TAU); ctx.fill();
    });
  }

  /** Header, round dots and the footer button. */
  private drawChrome(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    const head =
      this.phase === 'showing' ? T('Look carefully', 'Kijk goed') :
      this.phase === 'wrong' ? T('Not quite, try again', 'Net niet, probeer opnieuw') :
      this.phase === 'solved' ? (NL() ? this.figure.nameNl : this.figure.name) :
      T('Draw it back', 'Teken hem terug');
    ctx.fillStyle = this.phase === 'solved' ? '#9df7c4' : '#eaf2ff';
    ctx.font = this.font('900', 22);
    ctx.fillText(head, this.w / 2, 64 * this.u());

    if (this.phase === 'drawing') {
      ctx.fillStyle = 'rgba(220,235,255,0.6)'; ctx.font = this.font('700', 13);
      ctx.fillText(T('Connect the stars you remember', 'Verbind de sterren die je onthouden hebt'), this.w / 2, 86 * this.u());
    }

    // round dots
    const n = ROUNDS, gap = 16 * this.u(), x0 = this.w / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const done = i < this.solvedNames.length;
      ctx.fillStyle = done ? '#9df7c4' : i === this.round ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, 104 * this.u(), (done ? 4.5 : 3.5) * this.u(), 0, TAU); ctx.fill();
    }

    if (this.phase === 'drawing') {
      const u = this.u(), w = 196 * u, h = 48 * u, x = this.w / 2 - w / 2, y = this.h - h - 26 * u;
      const face = chunkyButton(ctx, x, y, w, h, { tone: '#2f4a86' });
      ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 14);
      ctx.textAlign = 'center';
      ctx.fillText(T('Show me again', 'Laat nog eens zien'), this.w / 2, face.y + h * 0.62);
      this.hits.push({ id: 'peek', x, y, w, h });
    }
  }

  /** The close of a session: a calm page, not a score screen that begs for one more round. */
  private drawFinish(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 26);
    ctx.fillText(T('The sky is complete', 'De hemel is compleet'), this.w / 2, this.h * 0.3);
    ctx.fillStyle = 'rgba(220,235,255,0.7)'; ctx.font = this.font('700', 14);
    ctx.fillText(T('You brought back every figure tonight.', 'Je hebt vanavond elke figuur teruggebracht.'), this.w / 2, this.h * 0.3 + 30);

    ctx.font = this.font('800', 15);
    this.solvedNames.forEach((nm, i) => {
      ctx.fillStyle = '#9df7c4';
      ctx.fillText(nm, this.w / 2, this.h * 0.4 + 26 * this.u() + i * 26 * this.u());
    });

    const u = this.u(), w = 200 * u, h = 48 * u, x = this.w / 2 - w / 2, y = this.h * 0.4 + 40 * u + this.solvedNames.length * 26 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('800', 15);
    ctx.fillText(T('Watch again', 'Nog een nacht'), this.w / 2, y + h * 0.63);
    this.hits.push({ id: 'again', x, y, w, h });
  }
}
