/**
 * Dino Dig - the fossil game in Bramblewood.
 *
 * A slab of rock hides a skeleton. The child brushes the dirt away with a finger, a little at a
 * time, and the bones appear. When enough of the slab is clear the question comes: which animal is
 * this? Three names, one right. Then the living creature grows over its own skeleton.
 *
 * It practises patience and part-to-whole reasoning: recognising the whole animal from the pieces
 * you have uncovered so far, and resisting the urge to guess before you can see enough.
 *
 * Drawn entirely with canvas paths. No photographs, no advertising, no tracking.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { uiScale } from '../../util/ui';
import { bodyPath, bones, drawCrest } from './anatomy';
import { DINOS, type Dino } from './dinos';
import { drawFossil, fossilPhoto, FOSSILS, loadAllFossils } from './fossilphoto';

type Ctx = CanvasRenderingContext2D;
type Phase = 'digging' | 'asking' | 'wrong' | 'reveal' | 'finished';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (d: Dino): string => (NL() ? d.nameNl : d.name);
const factOf = (d: Dino): string => (NL() ? d.factNl : d.fact);

/** The dirt is a coarse grid of cells; brushing clears the cells under your finger. */
const GRID_BASE = 34;

export class DinoDig {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private t = 0;
  private raf = 0;

  private round = 0;
  private phase: Phase = 'digging';
  private phaseT = 0;
  private dino: Dino = DINOS[0];
  private options: Dino[] = [];
  private cleared: Uint8Array = new Uint8Array(0);
  private cols = 0;
  private rows = 0;
  private brushing = false;
  private wrongId: string | null = null;
  private found: string[] = [];
  private dirt = new ValueNoise(7);
  private hits: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => { this.brushing = false; });
    canvas.addEventListener('pointercancel', () => { this.brushing = false; });
    this.startRound(0);
    void loadAllFossils(DINOS.map(d => d.id));
    (window as unknown as { __dig?: DinoDig }).__dig = this;
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

  debugState(): { phase: Phase; round: number; answer: string; options: string[]; cleared: number; buttons: Array<{ id: string; x: number; y: number }> } {
    return {
      phase: this.phase, round: this.round, answer: this.dino.id,
      options: this.options.map(o => o.id),
      cleared: this.clearedFraction(),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- layout ----------

  private resize(): void {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const slab = this.slab();
    this.cols = Math.ceil(slab.w / this.grid());
    this.rows = Math.ceil(slab.h / this.grid());
    if (this.cleared.length !== this.cols * this.rows) this.cleared = new Uint8Array(this.cols * this.rows);
  }

  /**
   * The slab of rock. A dinosaur is a wide animal, so the slab is landscape: wider than tall,
   * whatever the screen does. The leftover height below it holds the three answers.
   */
  private slab(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const top = 104 * u;
    const bottom = this.h - 200 * u;
    const band = Math.max(150, bottom - top);
    // no fixed ceiling: on a tablet the slab takes the width it is given
    let w = this.w - 28 * u;
    let h = w / 1.75;
    if (h > band) { h = band; w = Math.min(this.w - 28 * u, h * 1.75); }
    return { x: (this.w - w) / 2, y: top + (band - h) / 2, w, h };
  }

  /** How much bigger than a phone this screen is. */
  private u(): number { return uiScale(this.w, this.h); }

  /** Dirt cells grow with the screen, so brushing feels the same on a phone and on a tablet. */
  private grid(): number { return GRID_BASE * this.u(); }

  private clearedFraction(): number {
    let n = 0;
    for (let i = 0; i < this.cleared.length; i++) if (this.cleared[i]) n++;
    return this.cleared.length ? n / this.cleared.length : 0;
  }

  // ---------- rounds ----------

  private startRound(i: number): void {
    this.round = i;
    this.dino = DINOS[i % DINOS.length];
    const rng = makeRng(500 + i * 31);
    const others = DINOS.filter(d => d.id !== this.dino.id).sort(() => rng() - 0.5).slice(0, 2);
    this.options = [this.dino, ...others].sort((a, b) => ((a.id.charCodeAt(0) + i) % 7) - ((b.id.charCodeAt(0) + i) % 7));
    this.cleared = new Uint8Array(this.cols * this.rows);
    this.dirt = new ValueNoise(i * 13 + 3);
    this.wrongId = null;
    this.phase = 'digging'; this.phaseT = 0;
  }

  private update(dt: number): void {
    this.phaseT += dt;
    if (this.phase === 'digging' && this.clearedFraction() > 0.62) { this.phase = 'asking'; this.phaseT = 0; }
    if (this.phase === 'wrong' && this.phaseT > 0.8) { this.wrongId = null; this.phase = 'asking'; }
    if (this.phase === 'reveal' && this.phaseT > 4.2) {
      if (this.round + 1 >= DINOS.length) { this.phase = 'finished'; this.phaseT = 0; }
      else this.startRound(this.round + 1);
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private brush(p: Vec): void {
    const slab = this.slab();
    const cx = (p.x - slab.x) / this.grid(), cy = (p.y - slab.y) / this.grid();
    const rad = 1.6;
    for (let gy = Math.floor(cy - rad); gy <= Math.ceil(cy + rad); gy++) {
      for (let gx = Math.floor(cx - rad); gx <= Math.ceil(cx + rad); gx++) {
        if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) continue;
        if (Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) > rad) continue;
        this.cleared[gy * this.cols + gx] = 1;
      }
    }
  }

  private onDown(e: PointerEvent): void {
    const p = this.at(e);
    for (const h of this.hits) {
      if (p.x < h.x || p.x > h.x + h.w || p.y < h.y || p.y > h.y + h.h) continue;
      if (h.id === 'again') { this.found = []; this.startRound(0); return; }
      if (this.phase !== 'asking') return;
      if (h.id === this.dino.id) {
        this.found.push(nameOf(this.dino));
        this.cleared.fill(1);
        this.phase = 'reveal'; this.phaseT = 0;
      } else {
        this.wrongId = h.id;
        this.phase = 'wrong'; this.phaseT = 0;
      }
      return;
    }
    if (this.phase !== 'digging') return;
    this.brushing = true;
    this.brush(p);
  }

  private onMove(e: PointerEvent): void {
    if (!this.brushing || this.phase !== 'digging') return;
    this.brush(this.at(e));
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#f0e0c4'); g.addColorStop(0.5, '#e2cda8'); g.addColorStop(1, '#cbb188');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];

    if (this.phase === 'finished') { this.drawFinish(); return; }

    const slab = this.slab();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(slab.x, slab.y, slab.w, slab.h, 18); ctx.clip();

    // the rock face under the dirt
    ctx.fillStyle = '#6b5f52'; ctx.fillRect(slab.x, slab.y, slab.w, slab.h);
    for (let i = 0; i < 40; i++) {
      const rr = makeRng(i * 31 + this.round)();
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rr * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(slab.x + rr * slab.w, slab.y + ((i * 97) % 100) / 100 * slab.h, slab.w * 0.12, slab.h * 0.08, rr * 3, 0, TAU);
      ctx.fill();
    }

    const photo = fossilPhoto(this.dino.id);
    if (photo) {
      drawFossil(ctx, photo, slab);
      // a little shade around the edges so the plate sits in the rock instead of on top of it
      const vg = ctx.createRadialGradient(slab.x + slab.w / 2, slab.y + slab.h / 2, slab.h * 0.3,
        slab.x + slab.w / 2, slab.y + slab.h / 2, slab.h * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,10,0.5)');
      ctx.fillStyle = vg; ctx.fillRect(slab.x, slab.y, slab.w, slab.h);
    } else {
      this.drawSkeleton(ctx, slab, 1);
    }
    if (this.phase === 'reveal') this.drawLiving(ctx, slab);
    this.drawDirt(ctx, slab);
    ctx.restore();

    // slab frame
    ctx.strokeStyle = 'rgba(80,60,40,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(slab.x, slab.y, slab.w, slab.h, 18); ctx.stroke();

    this.drawChrome(slab);
  }

  /** Dirt that has not been brushed away yet, one lump per uncleared cell. */
  private drawDirt(ctx: Ctx, slab: { x: number; y: number; w: number; h: number }): void {
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (this.cleared[gy * this.cols + gx]) continue;
        const x = slab.x + gx * this.grid(), y = slab.y + gy * this.grid();
        const n = this.dirt.noise2(gx * 0.6, gy * 0.6);
        ctx.fillStyle = `rgb(${Math.round(176 + n * 26)},${Math.round(146 + n * 24)},${Math.round(104 + n * 22)})`;
        ctx.beginPath();
        ctx.roundRect(x - 1, y - 1, this.grid() + 2, this.grid() + 2, 7);
        ctx.fill();
        ctx.fillStyle = `rgba(120,95,62,${0.12 + n * 0.12})`;
        ctx.beginPath(); ctx.arc(x + this.grid() * 0.35, y + this.grid() * 0.4, this.grid() * 0.16, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + this.grid() * 0.7, y + this.grid() * 0.66, this.grid() * 0.11, 0, TAU); ctx.fill();
      }
    }
  }

  private drawSkeleton(ctx: Ctx, slab: { x: number; y: number; w: number; h: number }, alpha: number): void {
    const d = this.dino;
    const b = bones(d, slab);
    const bone = `rgba(241,234,214,${alpha})`;
    const shade = `rgba(35,26,17,${0.45 * alpha})`;
    const lw = Math.max(1.4, slab.w * 0.009);

    // the impression the body left in the rock, so the shape reads even before every bone is clear
    ctx.save();
    ctx.globalAlpha = 0.55 * alpha;
    bodyPath(ctx, d, slab);
    ctx.fillStyle = '#4b4133'; ctx.fill('nonzero');
    ctx.restore();

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // ribs
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? shade : bone;
      ctx.lineWidth = pass === 0 ? lw * 1.5 : lw;
      for (const r of b.ribs) {
        ctx.beginPath();
        ctx.moveTo(r.from.x, r.from.y);
        ctx.quadraticCurveTo(r.from.x + r.bulge, (r.from.y + r.to.y) / 2, r.to.x, r.to.y);
        ctx.stroke();
      }
    }

    // limbs, two segments with a joint
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? shade : bone;
      for (const l of b.limbs) {
        ctx.lineWidth = (pass === 0 ? 1.9 : 1.25) * Math.max(lw, l.thick * 0.55);
        ctx.beginPath();
        ctx.moveTo(l.hip.x, l.hip.y); ctx.lineTo(l.knee.x, l.knee.y); ctx.lineTo(l.foot.x, l.foot.y);
        ctx.stroke();
        if (pass === 1) {
          ctx.fillStyle = bone;
          ctx.beginPath(); ctx.arc(l.knee.x, l.knee.y, Math.max(lw, l.thick * 0.3), 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(l.foot.x, l.foot.y, l.thick * 0.85, l.thick * 0.36, 0, 0, TAU); ctx.fill();
        }
      }
    }

    // spine, then the vertebrae strung along it
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? shade : bone;
      ctx.lineWidth = (pass === 0 ? 2.4 : 1.7) * lw;
      ctx.beginPath();
      ctx.moveTo(b.spine[0].x, b.spine[0].y);
      for (let i = 1; i < b.spine.length; i++) ctx.lineTo(b.spine[i].x, b.spine[i].y);
      ctx.stroke();
    }
    ctx.fillStyle = bone;
    for (let i = 0; i < b.spine.length - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const f = k / 3;
        const x = b.spine[i].x + (b.spine[i + 1].x - b.spine[i].x) * f;
        const y = b.spine[i].y + (b.spine[i + 1].y - b.spine[i].y) * f;
        const taperK = 1 - (i / b.spine.length) * 0.45;
        ctx.beginPath(); ctx.arc(x, y, lw * 1.15 * taperK, 0, TAU); ctx.fill();
      }
    }

    // skull
    const sk = b.skull;
    ctx.save();
    ctx.translate(sk.at.x, sk.at.y); ctx.rotate(sk.angle);
    const L = sk.len, D = sk.depth;
    ctx.fillStyle = bone;
    ctx.beginPath();
    if (sk.kind === 'frill') {
      ctx.moveTo(L * 0.36, -D * 0.72); ctx.lineTo(L * 0.5, 0); ctx.lineTo(L * 0.36, D * 0.66);
      ctx.lineTo(-L * 0.2, D * 0.6); ctx.lineTo(-L * 0.95, D * 0.1); ctx.lineTo(-L * 0.55, -D * 0.45);
      ctx.lineTo(-L * 0.1, -D * 0.68);
    } else {
      ctx.moveTo(0, -D * 0.62); ctx.lineTo(-L * 0.72, -D * 0.5); ctx.lineTo(-L * 0.96, -D * 0.05);
      ctx.lineTo(-L * 0.8, D * 0.42); ctx.lineTo(-L * 0.18, D * 0.66); ctx.lineTo(0, D * 0.6);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.ellipse(-L * 0.3, -D * 0.12, L * 0.11, D * 0.2, 0, 0, TAU); ctx.fill();
    if (sk.kind === 'jaws' || sk.kind === 'beak') {
      ctx.fillStyle = bone;
      for (let i = 0; i < 5; i++) {
        const tx = -L * (0.3 + i * 0.13);
        ctx.beginPath();
        ctx.moveTo(tx, D * 0.42); ctx.lineTo(tx - L * 0.035, D * 0.72); ctx.lineTo(tx + L * 0.035, D * 0.72);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** The animal itself, growing over its skeleton once the child has named it. */
  private drawLiving(ctx: Ctx, slab: { x: number; y: number; w: number; h: number }): void {
    const d = this.dino;
    const k = clamp(this.phaseT / 1.0, 0, 1);
    const grow = 1 - Math.pow(1 - k, 3);
    const cx = slab.x + slab.w / 2, cy = slab.y + slab.h * 0.6;

    ctx.save();
    ctx.globalAlpha = grow * (fossilPhoto(d.id) ? 0.9 : 1);
    ctx.translate(cx, cy);
    ctx.scale(0.55 + 0.45 * grow, 0.55 + 0.45 * grow);
    ctx.translate(-cx, -cy);

    bodyPath(ctx, d, slab);
    const g = ctx.createLinearGradient(0, slab.y, 0, slab.y + slab.h);
    g.addColorStop(0, d.skin); g.addColorStop(1, d.belly);
    ctx.fillStyle = g; ctx.fill('nonzero');
    ctx.strokeStyle = 'rgba(38,28,18,0.4)'; ctx.lineWidth = Math.max(1.4, slab.w * 0.005);
    ctx.stroke();

    if (d.crest) drawCrest(ctx, d, slab, d.skin, 'rgba(38,28,18,0.4)');

    // an eye, so it looks back at you
    const b = bones(d, slab);
    ctx.fillStyle = '#1d150c';
    ctx.beginPath();
    ctx.arc(b.skull.at.x - b.skull.len * 0.34, b.skull.at.y - b.skull.depth * 0.14, Math.max(2, slab.w * 0.007), 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawChrome(slab: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    const head =
      this.phase === 'digging' ? T('Brush the dirt away', 'Borstel het zand weg') :
      this.phase === 'asking' ? T('Which one is this?', 'Welke is dit?') :
      this.phase === 'wrong' ? T('Look again', 'Kijk nog eens') :
      nameOf(this.dino);
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('900', 22);
    ctx.fillText(head, this.w / 2, 48 * this.u());

    if (this.phase === 'digging') {
      ctx.fillStyle = 'rgba(74,56,35,0.6)'; ctx.font = this.font('700', 13);
      ctx.fillText(T('Take your time, it has waited a long while.', 'Rustig aan, hij heeft lang gewacht.'), this.w / 2, 70 * this.u());
    }
    if (this.phase === 'reveal') {
      ctx.fillStyle = 'rgba(74,56,35,0.78)'; ctx.font = this.font('700', 13);
      ctx.fillText(factOf(this.dino), this.w / 2, 70 * this.u(), this.w - 36);
    }

    // found so far
    const gap = 16 * this.u(), x0 = this.w / 2 - ((DINOS.length - 1) * gap) / 2;
    for (let i = 0; i < DINOS.length; i++) {
      ctx.fillStyle = i < this.found.length ? '#6b8f4e' : i === this.round ? 'rgba(74,56,35,0.75)' : 'rgba(74,56,35,0.25)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, 88 * this.u(), (i < this.found.length ? 4.5 : 3.5) * this.u(), 0, TAU); ctx.fill();
    }

    if (this.phase === 'asking' || this.phase === 'wrong') {
      const u = this.u(), bw = Math.min(360 * u, this.w - 40), bh = 46 * u;
      const y0 = slab.y + slab.h + 16 * u;
      this.options.forEach((o, i) => {
        const x = this.w / 2 - bw / 2, y = y0 + i * (bh + 8 * u);
        const bad = this.wrongId === o.id;
        ctx.fillStyle = bad ? 'rgba(200,90,80,0.9)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
        ctx.strokeStyle = 'rgba(80,60,40,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = bad ? '#fff' : '#4a3823'; ctx.font = this.font('800', 15);
        ctx.fillText(nameOf(o), this.w / 2, y + bh * 0.63, bw - 24);
        this.hits.push({ id: o.id, x, y, w: bw, h: bh });
      });
    }
  }

  private drawFinish(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('900', 25);
    ctx.fillText(T('The whole museum', 'Het hele museum'), this.w / 2, this.h * 0.24);
    ctx.fillStyle = 'rgba(74,56,35,0.65)'; ctx.font = this.font('700', 13);
    ctx.fillText(T('Six skeletons, all named.', 'Zes skeletten, allemaal benoemd.'), this.w / 2, this.h * 0.24 + 26);

    ctx.font = this.font('800', 15);
    this.found.forEach((nm, i) => {
      ctx.fillStyle = '#6b8f4e';
      ctx.fillText(nm, this.w / 2, this.h * 0.36 + 26 * this.u() + i * 26 * this.u());
    });

    const u = this.u(), w = 210 * u, h = 48 * u, x = this.w / 2 - w / 2, y = this.h * 0.36 + 44 * u + this.found.length * 26 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,40,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('800', 15);
    ctx.fillText(T('Dig again', 'Nog een keer graven'), this.w / 2, y + h * 0.63);
    this.hits.push({ id: 'again', x, y, w, h });

    // attribution: one of the fossil photographs is CC BY and the rest are public domain
    ctx.fillStyle = 'rgba(74,56,35,0.55)'; ctx.font = this.font('700', 9);
    ctx.fillText(T('Fossil photographs:', 'Fossielfoto’s:'), this.w / 2, y + h + 26 * u);
    const lines = [...new Set(Object.values(FOSSILS).map(f => f.credit))];
    lines.forEach((c, i) => ctx.fillText(c, this.w / 2, y + h + 40 * u + i * 12 * u, this.w - 24));
  }
}
