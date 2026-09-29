/**
 * Suri heeft buikpijn - the body story, on the shared stage (`stage.ts`).
 *
 * The script is in `buikscript.ts`. What is particular to this story is here: Suri's bedroom, and
 * then the inside of him, one place after another in the order food really goes. The mouth, where the
 * child taps to chew; the gullet, a tube of muscle rings that the child helps squeeze by swiping down;
 * the stomach, a bag of muscle with sour juice in it that the child helps knead; the gut, a world round
 * you with a floor of little fingers where the germs are found by looking around; and a blood vessel,
 * where the child drags the white blood cells to the germs and they swallow them.
 *
 * Only the gut is an ordinary world on the stage's ground, because only the gut is a place you stand
 * in and look round. The others are scenes of their own (`drawScene`), each drawn the way you would
 * see it from inside: a tunnel going down, a cave with a pool in it.
 */

import { T } from '../util/lang';
import { drawGuide } from '../platform/guide';
import { isSpeaking } from '../platform/voice';
import { ASIDES, CHAPTERS, CHEWS, GERMS, SQUEEZE, type Chapter } from './buikscript';
import { TAU } from './look';
import { spot, type Palette, type View } from './world';
import { drawAppleBit, drawBedroom, drawBlanket, drawGerm, drawGoodBug, drawRedCell, drawTeethRow, drawVillus, drawWhiteCell } from './buikart';
import { bed, buikSfx, type Bed } from './buiksfx';
import { Stage, type Beast, type Pt } from './stage';

type Scene = 'bed' | 'mouth' | 'gullet' | 'stomach' | 'gut' | 'blood';

interface Bit { x: number; y: number; r: number; seed: number }
interface Villus { x: number; z: number; tall: number; seed: number }
interface Red { a: number; rr: number; z: number; rot: number; tilt: number }
interface White { x: number; y: number; seed: number; full: number }
interface Germ { fx: number; fy: number; eatenT: number; by: number; seed: number }

/** The inside of the gut: warm pink, wet, and no sky, only the folded wall far overhead. */
const GUT: Palette = {
  skyTop: '#5a1d29', skyLow: '#a44d58', sun: '#ffffff', sunAt: 0, sunUp: 0.5, cloud: '#000', clouds: 0,
  far: '#b35b64', mid: '#c2686f', ground: '#e0a09c', groundNear: '#c47a7b', haze: '#b95f68', space: true,
};

export class Buik extends Stage {
  protected readonly id = 'buikpijn';
  protected readonly chapters: Chapter[] = CHAPTERS;
  protected readonly title = { en: 'Suri has a tummy ache', nl: 'Suri heeft buikpijn' };
  protected readonly lookAround = ASIDES.lookAround;

  private scene: Scene = 'bed';
  private morning = false;
  /** zooming into Suri's mouth (1 → big) or back out of it (big → 1) */
  private zoom: { t: number; dur: number; out: boolean } | null = null;
  private fadeIn = 0;

  // the mouth
  private bits: Bit[] = [];
  private chews = 0;
  private jawT = -1;

  // the gullet
  private down_ = 0;
  private scroll = 0;
  private swipeY: number | null = null;
  private squeezeT = -1;

  // the stomach
  private kneads = 0;
  private kneadT = -1;

  // the gut
  private villi: Villus[] = [];
  private goods: Array<{ x: number; z: number; lift: number; seed: number }> = [];

  // the blood
  private reds: Red[] = [];
  private whites: White[] = [];
  private germs: Germ[] = [];
  private carrying: number | null = null;

  private idleT = 0;
  private nagged = false;
  private flashT = 0;
  private playing: Bed | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.run();
  }

  protected debugExtra(): Record<string, unknown> {
    return {
      scene: this.scene, chews: this.chews, down: Math.round(this.down_ * 100) / 100, kneads: this.kneads,
      germsLeft: this.germs.filter(g => g.eatenT < 0).length, zoom: this.zoom ? Math.round((this.zoom.t / this.zoom.dur) * 100) / 100 : null,
    };
  }

  // ---------------------------------------------------------------- where things are, for drivers and tests

  /** The white blood cells and the germs on screen. */
  cells(): { whites: Pt[]; germs: Array<Pt & { alive: boolean }>; r: number } {
    return {
      whites: this.whites.map(c => ({ x: c.x, y: c.y })),
      germs: this.germs.map(g => ({ ...this.germAt(g), alive: g.eatenT < 0 })),
      r: this.cellR(),
    };
  }

  private cellR(): number { return Math.min(this.w, this.h) * 0.075; }
  private germAt(g: Germ): Pt { return { x: g.fx * this.w, y: g.fy * this.h }; }

  // ---------------------------------------------------------------- palettes

  protected palette(): Palette {
    return { ...GUT, sky: (ctx, v) => this.gutCeiling(ctx, v) };
  }

  protected gauge(): string {
    if (this.scene === 'gullet') return `${Math.round(this.down_ * 25)} cm`;
    return '';
  }

  // ---------------------------------------------------------------- chapters and cues

  protected setup(c: Chapter): void {
    this.idleT = 0; this.nagged = false;
    this.zoom = null;
    this.props = []; this.beast = null; this.life = null;
    this.fadeIn = 1;
    if (c.id === 'bed') { this.scene = 'bed'; this.morning = false; this.fadeIn = 0; }
    else if (c.id === 'mouth') {
      this.scene = 'mouth';
      this.chews = 0; this.jawT = -1;
      this.bits = [{ x: 0, y: 0, r: 0.2, seed: 3 }];
    } else if (c.id === 'gullet') { this.scene = 'gullet'; this.down_ = 0; this.scroll = 0; this.squeezeT = -1; buikSfx.swallow(); }
    else if (c.id === 'stomach') { this.scene = 'stomach'; this.kneads = 0; this.kneadT = -1; buikSfx.splash(); this.flashT = 0.5; }
    else if (c.id === 'gut') { this.scene = 'gut'; this.buildGut(); }
    else if (c.id === 'blood') { this.scene = 'blood'; this.buildBlood(); buikSfx.dive(); }
    else if (c.id === 'better') { this.scene = 'bed'; this.morning = true; this.fadeIn = 0; this.flashT = 1; }
  }

  protected cue(name: string): void {
    if (name === 'shrink') { buikSfx.shrink(); this.zoom = { t: 0, dur: 3.2, out: false }; }
    else if (name === 'swallow') { /* the gullet chapter starts with the gulp */ }
    else if (name === 'onward' || name === 'dive') { this.flashT = 0.6; }
    else if (name === 'grow') {
      buikSfx.grow();
      this.scene = 'bed'; this.morning = false;
      this.zoom = { t: 0, dur: 3.2, out: true };
      this.flashT = 1;
    } else if (name === 'end') { buikSfx.done(); this.finished = true; this.markSeen(); }
  }

  protected ambience(): void {
    if (!this.started) return;
    const want: Bed = this.scene === 'bed' ? (this.morning ? 'morning' : 'room')
      : this.scene === 'mouth' ? 'mouth' : this.scene === 'blood' ? 'blood' : 'belly';
    if (want === this.playing) return;
    this.playing = want;
    bed(want);
  }

  destroy(): void { super.destroy(); bed(null); }

  protected onFound(b: Beast): void {
    if (b.kind === 'germs') buikSfx.found();
  }

  // ---------------------------------------------------------------- the places

  private buildGut(): void {
    let a = 41;
    const r = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    this.villi = [];
    for (let i = 0; i < 260; i++) {
      const ang = r() * TAU, d = 1.6 + Math.pow(r(), 1.2) * 16;
      // leave the first view open a little way, so it is a floor you look out over
      if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.25 && d < 3) continue;
      this.villi.push({ x: Math.sin(ang) * d, z: Math.cos(ang) * d, tall: 0.9 + r() * 0.9, seed: i });
    }
    this.goods = [];
    for (let i = 0; i < 14; i++) { const ang = r() * TAU, d = 2 + r() * 8; this.goods.push({ x: Math.sin(ang) * d, z: Math.cos(ang) * d, lift: 1 + r() * 1.5, seed: r() * TAU }); }
    // the germs: behind you and to the right, on a sore red patch of the wall
    const ga = 2.5, gd = 4.5;
    this.beast = { kind: 'germs', x: Math.sin(ga) * gd, z: Math.cos(ga) * gd, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
    this.villi = this.villi.filter(v => Math.hypot(v.x - this.beast!.x, v.z - this.beast!.z) > 1.3);
  }

  private buildBlood(): void {
    this.reds = [];
    for (let i = 0; i < 70; i++) this.reds.push({ a: Math.random() * TAU, rr: 0.15 + Math.random() * 0.8, z: 0.6 + Math.random() * 8, rot: Math.random() * TAU, tilt: Math.random() });
    this.whites = [
      { x: this.w * 0.36, y: this.h * 0.5, seed: 1, full: 0 },
      { x: this.w * 0.5, y: this.h * 0.56, seed: 2.3, full: 0 },
      { x: this.w * 0.64, y: this.h * 0.48, seed: 3.7, full: 0 },
    ];
    const spots: Array<[number, number]> = [[0.16, 0.26], [0.84, 0.24], [0.2, 0.66], [0.8, 0.64], [0.5, 0.2]];
    this.germs = spots.slice(0, GERMS).map(([fx, fy], i) => ({ fx, fy, eatenT: -1, by: -1, seed: i * 1.7 }));
    this.carrying = null;
  }

  // ---------------------------------------------------------------- per frame

  protected tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt * 0.9);
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.2);
    const w = this.waiting();

    if (this.zoom) {
      this.zoom.t += dt;
      if (this.zoom.t >= this.zoom.dur) {
        const out = this.zoom.out;
        this.zoom = null;
        this.flags.add(out ? 'outside' : 'inside');
      }
    }
    if (this.jawT >= 0) { this.jawT += dt; if (this.jawT > 0.4) this.jawT = -1; }
    if (this.squeezeT >= 0) { this.squeezeT += dt; if (this.squeezeT > 0.9) this.squeezeT = -1; }
    if (this.kneadT >= 0) { this.kneadT += dt; if (this.kneadT > 0.7) this.kneadT = -1; }

    // the gullet slides past while a squeeze is carrying the bite down
    if (this.scene === 'gullet') {
      const want = this.down_ * 12;
      this.scroll += (want - this.scroll) * Math.min(1, dt * 3);
      if (w === 'down') this.nudge(dt, ASIDES.swipe);
    }

    if (this.scene === 'blood') {
      for (const r of this.reds) {
        r.z -= dt * 2.2;
        r.rot += dt * 0.6;
        if (r.z < 0.35) { r.z += 8; r.a = Math.random() * TAU; r.rr = 0.15 + Math.random() * 0.8; }
      }
      for (const c of this.whites) c.full = Math.max(0, c.full - dt);
      for (const g of this.germs) if (g.eatenT >= 0) g.eatenT += dt;
      if (w === 'cleared') {
        this.nudge(dt, ASIDES.drag);
        if (this.germs.every(g => g.eatenT > 0.8)) this.flags.add('cleared');
      }
    }
    this.ambience();
  }

  /** Nothing happening for a while on a step that needs the child: say how, once. */
  private nudge(dt: number, a: { say: string; sayNl: string }): void {
    this.idleT += dt;
    if (this.idleT > 9 && !this.nagged && !isSpeaking()) { this.nagged = true; this.aside(a); }
  }

  // ---------------------------------------------------------------- the child's hands

  protected down(p: Pt): boolean {
    const w = this.waiting();
    const u = this.u();
    if (this.scene === 'mouth' && w === 'chewed') { this.chew(); return true; }
    if (this.scene === 'gullet' && w === 'down') { this.swipeY = p.y; return true; }
    if (this.scene === 'stomach' && w === 'kneaded') { this.knead(p); return true; }
    if (this.scene === 'blood' && w === 'cleared') {
      const r = this.cellR();
      for (let i = this.whites.length - 1; i >= 0; i--) {
        const c = this.whites[i];
        if (Math.hypot(p.x - c.x, p.y - c.y) < r * 1.4 + 10 * u) { this.carrying = i; return true; }
      }
      return true;
    }
    return false;
  }

  protected drag(p: Pt): boolean {
    const u = this.u();
    if (this.swipeY != null) {
      // a swipe down far enough is one squeeze of the muscle rings
      if (p.y - this.swipeY > 50 * u) { this.squeeze(); this.swipeY = p.y; }
      return true;
    }
    if (this.carrying != null) {
      const c = this.whites[this.carrying];
      c.x = p.x; c.y = p.y;
      this.tryEat(c, this.carrying);
      return true;
    }
    return false;
  }

  protected release(): void {
    if (this.carrying != null) this.tryEat(this.whites[this.carrying], this.carrying);
    this.carrying = null;
    this.swipeY = null;
  }

  private chew(): void {
    if (this.jawT >= 0) return;
    this.jawT = 0;
    this.idleT = 0;
    buikSfx.chew();
    this.chews++;
    // every bite breaks each piece in two, until they are small enough to swallow
    const next: Bit[] = [];
    for (const b of this.bits) {
      if (b.r > 0.045 && next.length < 24) {
        const k = b.r * 0.62;
        next.push({ x: b.x - k * 0.9, y: b.y + (Math.random() - 0.5) * k, r: k, seed: b.seed * 2 + 1 });
        next.push({ x: b.x + k * 0.9, y: b.y + (Math.random() - 0.5) * k, r: k, seed: b.seed * 2 + 2 });
      } else next.push(b);
    }
    this.bits = next;
    const u = this.u();
    this.ps.spawn('crumb', this.w / 2, this.h * 0.55, 8, { colour: '#f6efcf', speed: 140, size: 4 * u, max: 0.6, spread: TAU, grav: 300 });
    if (this.chews >= CHEWS) this.flags.add('chewed');
  }

  private squeeze(): void {
    if (this.down_ >= 1) return;
    this.idleT = 0;
    this.squeezeT = 0;
    buikSfx.squeeze();
    this.down_ = Math.min(1, this.down_ + SQUEEZE);
    if (this.down_ >= 1) this.flags.add('down');
  }

  private knead(p: Pt): void {
    if (this.kneadT >= 0) return;
    this.kneadT = 0;
    buikSfx.knead();
    this.kneads++;
    const u = this.u();
    this.ps.spawn('splash', p.x, Math.max(p.y, this.h * 0.62), 10, { colour: 'rgba(222, 214, 120, 0.8)', speed: 160, size: 5 * u, max: 0.8, spread: Math.PI, grav: 300 });
    if (this.kneads >= 3) this.flags.add('kneaded');
  }

  private tryEat(c: White, i: number): void {
    const r = this.cellR();
    for (const g of this.germs) {
      if (g.eatenT >= 0) continue;
      const gp = this.germAt(g);
      if (Math.hypot(c.x - gp.x, c.y - gp.y) < r * 1.1) {
        g.eatenT = 0; g.by = i;
        c.full = 1;
        this.idleT = 0;
        buikSfx.gulp();
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  protected drawScene(): boolean {
    if (this.scene === 'gut') return false;
    if (this.scene === 'bed') this.drawBed();
    else if (this.scene === 'mouth') this.drawMouth();
    else if (this.scene === 'gullet') this.drawGullet();
    else if (this.scene === 'stomach') this.drawStomach();
    else if (this.scene === 'blood') this.drawBlood();
    this.drawFades();
    return true;
  }

  private drawFades(): void {
    const ctx = this.ctx;
    if (this.fadeIn > 0) { ctx.fillStyle = `rgba(60, 10, 20, ${this.fadeIn})`; ctx.fillRect(0, 0, this.w, this.h); }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255, 240, 240, ${this.flashT * 0.7})`; ctx.fillRect(0, 0, this.w, this.h); }
  }

  /** The bedroom, and Suri in bed; zooming into his mouth, or back out of it. */
  private drawBed(): void {
    const ctx = this.ctx, u = this.u();
    // where his mouth is, before any zoom, so the zoom can centre on it
    let k = 1, mx = 0, my = 0;
    const probe = this.bedLayout();
    mx = probe.mx; my = probe.my;
    if (this.zoom) {
      const f = Math.min(1, this.zoom.t / this.zoom.dur);
      const e = this.zoom.out ? 1 - f : f;
      k = 1 + Math.pow(e, 2.4) * 30;
    }
    ctx.save();
    ctx.translate(mx, my); ctx.scale(k, k); ctx.translate(-mx, -my);
    const head = drawBedroom(ctx, this.w, this.h, u, this.morning, this.t);
    if (this.morning) {
      // up and about: standing by the bed, pleased
      drawBlanket(ctx, this.w, this.h, u, true);
      drawGuide(ctx, this.w * 0.8, this.h * 0.9, Math.min(this.h * 0.36, this.w * 0.4), { pose: 'cheer', t: this.t, facing: -1, saying: isSpeaking() ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0 });
    } else {
      const s = head.size / 100;
      drawGuide(ctx, head.hx + 18 * s, head.hy + 22 * s, head.size, { pose: 'sleep', t: this.t, facing: -1 });
      drawBlanket(ctx, this.w, this.h, u, false);
      // a small sign of the ache: a wobbly line over his tummy
      ctx.strokeStyle = `rgba(255, 210, 120, ${0.5 + 0.4 * Math.sin(this.t * 3)})`;
      ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
      const tx = head.hx + head.size * 0.45, ty = head.hy - head.size * 0.3;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const x = tx + i * 6 * u, y = ty + (i % 2 ? -5 : 5) * u; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    if (this.zoom) {
      // deep in, it all turns into the warm pink of the inside
      const f = Math.min(1, this.zoom.t / this.zoom.dur);
      const e = this.zoom.out ? 1 - f : f;
      ctx.fillStyle = `rgba(150, 50, 60, ${Math.max(0, (e - 0.55) / 0.45)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /** Where Suri's mouth is in the bedroom, worked out the same way `drawBed` draws him. */
  private bedLayout(): { mx: number; my: number } {
    const bx = this.w * 0.12, by = this.h * 0.52, bw = Math.min(this.w * 0.62, this.h * 1.1), bh = this.h * 0.3;
    const hx = bx + bw * 0.16, hy = by - bh * 0.05, size = bh * 1.3, s = size / 100;
    // the sleeping pose has its snout at about (-24, -18) in its own units, mirrored
    return { mx: hx + 18 * s - 30 * s, my: hy + 22 * s - 15 * s };
  }

  /** Inside the mouth: the palate, the tongue, the teeth above and below, and the apple between them. */
  private drawMouth(): void {
    const ctx = this.ctx, u = this.u();
    const w = this.w, h = this.h;
    const bg = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#3a0d16'); bg.addColorStop(0.35, '#8a2e3c'); bg.addColorStop(1, '#c35b67');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // the ridges on the roof of the mouth
    ctx.strokeStyle = 'rgba(240, 160, 170, 0.35)'; ctx.lineWidth = 4 * u;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(w / 2, -h * 0.1, w * (0.2 + i * 0.07), h * (0.2 + i * 0.05), 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    // the uvula hanging at the back, and the dark of the throat under it
    ctx.fillStyle = '#1c0409';
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.47, w * 0.09, h * 0.08, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9707a';
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.36, w * 0.025, h * 0.07, 0, 0, TAU); ctx.fill();
    // the tongue
    const tg = ctx.createLinearGradient(0, h * 0.5, 0, h);
    tg.addColorStop(0, '#e98891'); tg.addColorStop(1, '#c45b66');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.92, w * 0.46, h * 0.36, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 210, 215, 0.25)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(w / 2 + (((i * 0.37) % 1) - 0.5) * w * 0.7, h * 0.65 + ((i * 0.618) % 1) * h * 0.25, 2 * u, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(160, 50, 60, 0.4)'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.6); ctx.lineTo(w / 2, h); ctx.stroke();
    // the apple on the tongue
    const S = Math.min(w, h);
    for (const b of this.bits) drawAppleBit(ctx, w / 2 + b.x * S, h * 0.64 + b.y * S, b.r * S * 0.55, b.seed, Math.min(1, this.chews / CHEWS));
    // the teeth, above and below; they come together when you tap
    const bite = this.jawT >= 0 ? Math.sin((this.jawT / 0.4) * Math.PI) : 0;
    const rowW = Math.min(w * 1.1, h * 1.5), rowH = S * 0.13;
    drawTeethRow(ctx, w / 2, h * 0.12 + bite * h * 0.3, rowW, rowH, 1);
    drawTeethRow(ctx, w / 2, h * 0.8 - bite * h * 0.15, rowW, rowH, -1);
    // spit: a few wet shines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(w * (0.15 + i * 0.14), h * (0.3 + (i % 2) * 0.1), 6 * u, 2 * u, 0.3, 0, TAU); ctx.fill(); }
    if (this.waiting() === 'chewed') {
      ctx.textAlign = 'center';
      ctx.font = this.font('900', 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`${this.chews} / ${CHEWS}`, w / 2, h * 0.3);
    }
  }

  /** The gullet from inside: rings of muscle going down into the dark, and the bite ahead of you. */
  private drawGullet(): void {
    const ctx = this.ctx, u = this.u();
    const w = this.w, h = this.h, cx = w / 2, cy = h * 0.46;
    ctx.fillStyle = '#1c050a'; ctx.fillRect(0, 0, w, h);
    const R = Math.max(w, h) * 0.75;
    const n = 26;
    // near rings first and far ones over them: each ring is a disc, and the far ones are smaller
    for (let i = 0; i <= n; i++) {
      // each ring at a depth; they come towards you as the bite goes down
      const z = ((i - (this.scroll % 1)) / n) * 9 + 0.35;
      const ringIndex = i + Math.floor(this.scroll);
      let r = R / (z + 0.4);
      // the squeeze: a ring just behind you pulls tight, then the tightness moves on down
      if (this.squeezeT >= 0) {
        const at = this.squeezeT * 10;
        r *= 1 - 0.28 * Math.max(0, 1 - Math.abs(z - at) / 1.3);
      }
      const light = Math.max(0, 1 - z / 9);
      const g = ringIndex % 2 ? [196, 92, 104] : [226, 128, 136];
      ctx.fillStyle = `rgb(${Math.round(g[0] * light + 28 * (1 - light))}, ${Math.round(g[1] * light + 5 * (1 - light))}, ${Math.round(g[2] * light + 10 * (1 - light))})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255, 200, 205, ${0.25 * light})`; ctx.lineWidth = Math.max(1, 3 * u * light);
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.98, r * 0.88, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    }
    // the bite of chewed apple, just ahead and a little below
    const S = Math.min(w, h);
    const bob = Math.sin(this.t * 2) * 3 * u;
    ctx.fillStyle = '#e9dcae';
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.12 + bob, S * 0.11, S * 0.08, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) drawAppleBit(ctx, cx + Math.cos(i * 2.4) * S * 0.07, cy + S * 0.12 + Math.sin(i * 2.4) * S * 0.04 + bob, S * 0.035, i + 5, 1);
    // an arrow showing the swipe, until the child has done it once
    if (this.waiting() === 'down' && this.down_ === 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 4);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6 * u; ctx.lineCap = 'round';
      const ax = w * 0.82, ay = h * 0.25 + ((this.t * 0.8) % 1) * h * 0.2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + h * 0.2); ctx.moveTo(ax - 14 * u, ay + h * 0.2 - 16 * u); ctx.lineTo(ax, ay + h * 0.2); ctx.lineTo(ax + 14 * u, ay + h * 0.2 - 16 * u); ctx.stroke();
      ctx.restore();
    }
  }

  /** The stomach: a cave of muscle with folds in its wall, and the sour pool with the food in it. */
  private drawStomach(): void {
    const ctx = this.ctx, u = this.u();
    const w = this.w, h = this.h;
    const pulse = this.kneadT >= 0 ? Math.sin((this.kneadT / 0.7) * Math.PI) : 0;
    const bg = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#f0a9a8'); bg.addColorStop(0.55, '#c96a72'); bg.addColorStop(1, '#6e2230');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // the folds of the stomach wall, which flatten out as it fills; they squeeze in when it kneads
    ctx.save();
    ctx.translate(w / 2, h * 0.45);
    ctx.scale(1 - pulse * 0.06, 1 - pulse * 0.04);
    ctx.strokeStyle = 'rgba(120, 30, 45, 0.28)'; ctx.lineWidth = 12 * u; ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const d = Math.max(w, h) * (0.22 + k * 0.035);
        const aa = a + Math.sin(k * 0.8 + i + this.t * 0.4) * 0.06;
        const x = Math.cos(aa) * d, y = Math.sin(aa) * d * 0.8;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // the slime on the wall: glossy streaks catching the light
    ctx.strokeStyle = 'rgba(255, 235, 235, 0.3)'; ctx.lineWidth = 3 * u;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.2;
      const d = Math.max(w, h) * 0.34;
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8, 20 * u, a + 1.2, a + 2); ctx.stroke();
    }
    ctx.restore();
    // the pool of stomach juice, with the food floating in it: pieces at first, porridge at the end
    const py = h * 0.62 - pulse * h * 0.03;
    const pool = ctx.createLinearGradient(0, py, 0, h);
    pool.addColorStop(0, 'rgba(226, 216, 120, 0.85)'); pool.addColorStop(1, 'rgba(170, 150, 60, 0.95)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, py + Math.sin(x * 0.02 + this.t * 2) * 5 * u + Math.sin(x * 0.05 - this.t * 3) * 2 * u);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    const S = Math.min(w, h);
    const mush = Math.min(1, this.kneads / 3);
    for (let i = 0; i < 12; i++) {
      const x = w * (0.1 + ((i * 0.37) % 1) * 0.8), y = py + S * (0.04 + ((i * 0.61) % 1) * 0.18) + Math.sin(this.t * 1.5 + i) * 3 * u;
      if (mush < 1) drawAppleBit(ctx, x, y, S * 0.03 * (1 - mush * 0.6), i + 9, 1);
      ctx.fillStyle = `rgba(236, 222, 170, ${0.5 * mush})`;
      ctx.beginPath(); ctx.ellipse(x, y, S * 0.06, S * 0.025, 0, 0, TAU); ctx.fill();
    }
    // bubbles rising in the juice
    ctx.strokeStyle = 'rgba(255, 255, 220, 0.6)'; ctx.lineWidth = 1.5 * u;
    for (let i = 0; i < 14; i++) {
      const k = (this.t * 0.4 + i * 0.137) % 1;
      const x = w * ((i * 0.53) % 1), y = h - k * (h - py);
      ctx.beginPath(); ctx.arc(x, y, (2 + (i % 3)) * u, 0, TAU); ctx.stroke();
    }
  }

  /** A blood vessel from inside: red cells streaming past, the germs on the wall, the white cells. */
  private drawBlood(): void {
    const ctx = this.ctx, u = this.u();
    const w = this.w, h = this.h, cx = w / 2, cy = h * 0.45;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#2a0306'); bg.addColorStop(0.4, '#6a0d14'); bg.addColorStop(1, '#b0343c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // the wall of the vessel, in rings going off into the distance
    ctx.strokeStyle = 'rgba(230, 120, 125, 0.25)'; ctx.lineWidth = 2 * u;
    for (let i = 1; i < 12; i++) { const r = (Math.max(w, h) * 0.9) / (i * 0.6 + 0.3); ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU); ctx.stroke(); }
    // red cells, far to near
    const F = Math.min(w, h) * 0.55;
    const sorted = [...this.reds].sort((a, b) => b.z - a.z);
    for (const r of sorted) {
      const x = cx + (Math.cos(r.a) * r.rr * F) / r.z, y = cy + (Math.sin(r.a) * r.rr * F * 0.8) / r.z, rad = (0.1 * F) / r.z;
      if (x < -rad || x > w + rad || y < -rad || y > h + rad) continue;
      ctx.globalAlpha = Math.min(1, (8.6 - r.z) / 2, (r.z - 0.35) / 0.5);
      drawRedCell(ctx, x, y, rad, r.tilt, r.rot);
    }
    ctx.globalAlpha = 1;
    // the germs on the wall, and the ones being swallowed
    const R = this.cellR();
    for (const g of this.germs) {
      const p = this.germAt(g);
      if (g.eatenT < 0) {
        ctx.fillStyle = 'rgba(255, 120, 90, 0.18)';
        ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.9, 0, TAU); ctx.fill();
        for (let k = 0; k < 3; k++) drawGerm(ctx, p.x + Math.cos(g.seed + k * 2.1) * R * 0.35, p.y + Math.sin(g.seed + k * 2.1) * R * 0.3, R * 0.32, g.seed + k, this.t, g.seed + k);
      } else if (g.eatenT < 0.8) {
        const c = this.whites[g.by];
        const k = g.eatenT / 0.8;
        const x = p.x + (c.x - p.x) * k, y = p.y + (c.y - p.y) * k;
        ctx.globalAlpha = 1 - k;
        drawGerm(ctx, x, y, R * 0.32 * (1 - k * 0.6), g.seed, this.t, g.seed);
        ctx.globalAlpha = 1;
      }
    }
    for (const [i, c] of this.whites.entries()) {
      drawWhiteCell(ctx, c.x, c.y, R, this.t, c.seed, c.full);
      if (this.waiting() === 'cleared' && this.carrying === null && i === 1 && this.germs.every(g => g.eatenT < 0)) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.3 * Math.sin(this.t * 5)})`; ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(c.x, c.y, R * 1.35, 0, TAU); ctx.stroke();
      }
    }
    if (this.waiting() === 'cleared') {
      const left = this.germs.filter(g => g.eatenT < 0).length;
      ctx.textAlign = 'center';
      ctx.font = this.font('900', 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(T(`${left} germs left`, `nog ${left} bacteriën`), w / 2, h * 0.1 + 40 * u);
    }
  }

  // ---------------------------------------------------------------- the gut, a world round you

  /** The gut's ceiling: the folded wall far overhead, and specks drifting in the porridge. */
  private gutCeiling(ctx: CanvasRenderingContext2D, v: View): void {
    const u = this.u();
    ctx.strokeStyle = 'rgba(220, 120, 130, 0.35)'; ctx.lineWidth = 6 * u;
    for (let i = 0; i < 6; i++) {
      const y = v.horizon - v.f * (0.12 + i * 0.12);
      ctx.beginPath();
      for (let x = 0; x <= this.w; x += 16) {
        const a = v.yaw + (x - this.w / 2) / v.f;
        const yy = y + Math.sin(a * 3 + i) * v.f * 0.03;
        if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  }

  protected drawBeast(v: View, b: Beast): void {
    if (b.kind !== 'germs') return;
    const sp = spot(v, b.x, b.z);
    if (!sp.on) return;
    const ctx = this.ctx;
    // the sore patch: the wall red and swollen round them
    const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.s * 1.4);
    g.addColorStop(0, 'rgba(230, 60, 60, 0.55)'); g.addColorStop(1, 'rgba(230, 60, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sp.s * 1.4, sp.s * 0.45, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + Math.sin(this.t * 0.8 + i) * 0.1;
      drawGerm(ctx, sp.x + Math.cos(a) * sp.s * 0.55, sp.y - sp.s * (0.15 + (i % 3) * 0.22) + Math.sin(a) * sp.s * 0.12, sp.s * 0.2, a, this.t, i);
    }
  }

  protected worldItems(v: View): Array<{ d: number; draw: () => void }> {
    const ctx = this.ctx;
    const out: Array<{ d: number; draw: () => void }> = [];
    if (this.scene !== 'gut') return out;
    for (const vl of this.villi) {
      out.push({ d: Math.hypot(vl.x, vl.z), draw: () => {
        const sp = spot(v, vl.x, vl.z);
        if (!sp.on) return;
        drawVillus(ctx, sp.x, sp.y, sp.s, vl.tall, vl.seed, this.t);
      } });
    }
    for (const gb of this.goods) {
      out.push({ d: Math.hypot(gb.x, gb.z), draw: () => {
        const sp = spot(v, gb.x, gb.z, gb.lift + Math.sin(this.t * 0.5 + gb.seed) * 0.1);
        if (!sp.on) return;
        drawGoodBug(ctx, sp.x, sp.y, sp.s * 0.06, gb.seed + this.t * 0.1);
      } });
    }
    return out;
  }

  protected drawOver(): void {
    const ctx = this.ctx;
    // the gut is wet and dim: a warm glow over it all
    ctx.fillStyle = 'rgba(120, 30, 40, 0.12)';
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawFades();
  }

  protected drawUi(): void {
    const ctx = this.ctx, u = this.u();
    const bs = this.beastScreen();
    if (this.beast?.kind === 'germs' && this.flags.has('found') && bs.on) {
      ctx.textAlign = 'center';
      ctx.font = this.font('900', 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(T('germs', 'bacteriën'), bs.sx, Math.min(this.h - 110 * u, bs.sy + 30 * u));
    }
  }

  protected facingOf(): -1 | 1 { return 1; }
}
