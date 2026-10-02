/**
 * Knikkerbaan - the marble-run game in Suri.
 *
 * A wooden pegboard wall. A marble waits in a hole at the top and a cup at the bottom. The child
 * drags planks from the tray onto the wall, drags them about, turns them by a handle in 15 degree
 * steps, and drags them back to the tray to take them off. "Laat los" drops the marble and the
 * physics in `model.ts` does the rest. A miss is not a failure: Suri says how to try again, the
 * marble comes back to the hole and the planks stay where the child left them.
 *
 * It practises thinking ahead about where a rolling thing will go. Nothing is timed, nothing can be
 * lost, the number of drops is never shown, and a board that lands at all is finished.
 * Simplest shape (`src/platform/who.ts`): for a child of two or three the game opens straight on
 * the first board, with no board list and no stars.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, recordLevelResult } from '../../util/storage';
import {
  H, LEVELS, MARBLE_R, STEP, W, makeWorld, nearestPlacement, placementOk, plankEnds, saveKey, snap, snapDeg, starsForDrops, step,
  type Level, type Plank, type World,
} from './model';
import { knikkerbaanSfx as sfx } from './knikkersfx';
import {
  WallArt, paintCupBack, paintCupFront, paintDropHole, paintHandle, paintMarble, paintMiniBoard, paintPeg, paintPlank, type View,
} from './paint';
import { bleedEdges, chunkyButton, drawStar as drawStarGem, easeOutBack, glassPanel, heading, Particles } from '../../render/look';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'build' | 'rolling' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Placed { id: number; p: Plank }
interface Drag { kind: 'new' | 'move' | 'rotate'; id: number; pose: Plank; before: Plank | null; dx: number; dy: number; end: 'a' | 'b'; changed: boolean }
interface Lay { bx: number; by: number; s: number; colX: number; colY: number; colW: number; colH: number; btn: Hit; slots: Hit[]; ts: number; land: boolean }

/** A drop is a drop whether it takes a second or ten; if the marble has not landed by then the board calls it stuck. */
const GIVE_UP = 45;
const CONFETTI = ['#ffd84a', '#ff7a6b', '#6fd0f0', '#8fe08a', '#ffb3e0'];

export class Knikkerbaan {
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
  private world: World = makeWorld(LEVELS[0], []);
  private placed: Placed[] = [];
  private drag: Drag | null = null;
  private dragBad = false;
  private drops = 0;
  private acc = 0;
  private endT = 0;
  private resolved = false;
  private seenBumps = 0;
  private lastBonk = 0;
  private earned = 0;
  private missCount = 0;
  private marblePop = 1;
  private cupGlow = 0;
  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private wall = new WallArt();
  private cardPop = 0;
  private note = '';
  private noteT = 0;
  private lay: Lay | null = null;
  /** Simplest shape for a child of two or three: straight onto board one, nothing recorded. */
  private easy = simpleNow();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __knikker?: Knikkerbaan }).__knikker = this;
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
  back(): void { if (this.easy) return; this.drag = null; this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    const L = this.layout();
    const r = (n: number): number => Math.round(n * 100) / 100;
    const trayIds = this.level.tray.map((_, i) => i).filter(i => this.inTray(i));
    return {
      phase: this.phase, level: this.level.id, easy: this.easy, drops: this.drops, result: this.world.result, earned: this.earned,
      marble: { x: r(this.world.marble.x), y: r(this.world.marble.y) },
      board: { x: L.bx, y: L.by, w: W * L.s, h: H * L.s, s: L.s },
      cup: { x: L.bx + this.level.cupX * L.s, y: L.by + (H - 0.7) * L.s },
      drop: { x: L.bx + this.level.drop.x * L.s, y: L.by + this.level.drop.y * L.s },
      /** safe-box coordinates, like `buttons`: add the insets to click */
      planks: this.placed.map(q => { const hp = this.handlePos(q.p); return { id: q.id, deg: q.p.deg, len: q.p.len, x: L.bx + q.p.x * L.s, y: L.by + q.p.y * L.s, hx: L.bx + hp.x * L.s, hy: L.by + hp.y * L.s }; }),
      tray: trayIds.map(i => ({ id: i, len: this.level.tray[i], x: L.slots[i].x + L.slots[i].w / 2, y: L.slots[i].y + L.slots[i].h / 2 })),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
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
   * The wall in the middle, the tray and the "Laat los" button in a column on the right, below the
   * round home and back buttons, and clear of the guide in the bottom-left corner. On a phone on
   * its side there is a strip on the left for the board list button as well.
   */
  private layout(): Lay {
    const u = this.u(), pad = 8 * u;
    const land = this.w > this.h * 1.15;
    const colW = (land ? 120 : 92) * u;
    const colY = 62 * u, colBottom = this.h - 14 * u;
    const leftStrip = land ? 108 * u : 0;
    const topH = land ? 8 * u : 62 * u;
    const bottomH = land ? 8 * u : 70 * u;
    const availW = this.w - leftStrip - colW - 3 * pad;
    const availH = this.h - topH - bottomH;
    const s = Math.max(4, Math.min(availW / W, availH / H));
    const bx = leftStrip + pad + (availW - W * s) / 2;
    const by = topH + (availH - H * s) / 2;
    const colX = this.w - colW - pad;
    const bh = 50 * u;
    const btn: Hit = { id: 'drop', x: colX, y: colBottom - bh, w: colW, h: bh };
    const trayH = btn.y - 10 * u - colY;
    const n = this.level.tray.length;
    const slotH = Math.min(52 * u, (trayH - 16 * u) / Math.max(1, n));
    const maxLen = Math.max(...this.level.tray);
    const ts = Math.min(s, (colW - 28 * u) / maxLen);
    const slots: Hit[] = this.level.tray.map((_, i) => ({ id: `tray:${i}`, x: colX + 6 * u, y: colY + 8 * u + i * slotH, w: colW - 12 * u, h: slotH }));
    return (this.lay = { bx, by, s, colX, colY, colW, colH: trayH, btn, slots, ts, land });
  }

  private view(L: Lay): View { return { ox: L.bx, oy: L.by, s: L.s }; }

  // ---------- state ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private inTray(id: number): boolean { return !this.placed.some(p => p.id === id) && this.drag?.id !== id; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.placed = []; this.drag = null;
    this.drops = 0; this.missCount = 0; this.earned = 0;
    this.world = makeWorld(this.level, []);
    this.ps.clear();
    this.cupGlow = 0; this.marblePop = 0;
    this.phase = 'build'; this.phaseT = 0; this.cardPop = 0;
    this.say(T('Let the marble roll into the cup.', 'Laat de knikker in het bekertje rollen.'), 4);
  }

  /** The plank hint for this board, which the guide in the corner reads on a tap. */
  spoken(): string {
    if (this.phase === 'build' || this.phase === 'rolling') return NL() ? this.level.hintNl : this.level.hint;
    if (this.phase === 'won') return T('In the cup. Well done.', 'In het bekertje. Goed gedaan.');
    return '';
  }

  private say(text: string, secs = 3): void {
    this.note = text; this.noteT = secs;
    speakLine(text);
  }

  private release(): void {
    this.world = makeWorld(this.level, this.placed.map(p => p.p));
    this.phase = 'rolling'; this.acc = 0; this.endT = 0; this.resolved = false; this.seenBumps = 0;
    this.drops++;
    sfx.go();
  }

  private missed(): void {
    this.missCount++;
    sfx.shrug();
    // two lines in turn: the voice does not repeat a line it has only just said
    this.say(this.missCount % 2 === 1 ? T('Almost. Place the plank differently.', 'Bijna. Zet de plank anders.') : T('Not quite. Try the plank another way.', 'Net niet. Probeer de plank eens anders.'), 3.5);
  }

  private landed(): void {
    const L = this.layout();
    sfx.landed();
    this.cupGlow = 1;
    const x = L.bx + this.level.cupX * L.s, y = L.by + (H - 1.6) * L.s;
    for (const c of CONFETTI) this.ps.spawn('spark', x, y, 6, { colour: c, speed: 240, size: L.s * 0.28, max: 1.1, spread: 2.4 });
    this.ps.spawn('ring', x, y, 1, { colour: 'rgba(255,240,170,0.9)', speed: 0, size: L.s * 0.3, max: 0.7, vx: 0, vy: 0 });
    this.say(T('In the cup. Well done.', 'In het bekertje. Goed gedaan.'), 3);
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.cupGlow = Math.max(0, this.cupGlow - dt * 0.8);
    this.marblePop = Math.min(1, this.marblePop + dt * 3);
    this.ps.update(dt);
    if (this.phase !== 'rolling') return;

    // a fixed 1/120 s step, several per frame: the same planks always give the same roll
    this.acc += dt;
    while (this.acc >= STEP && !this.world.result) { step(this.world, STEP); this.acc -= STEP; }
    if (this.world.bumps !== this.seenBumps) {
      this.seenBumps = this.world.bumps;
      if (this.t - this.lastBonk > 0.09) { this.lastBonk = this.t; sfx.bonk(this.world.bumpSpeed); }
    }
    if (!this.world.result && this.world.t > GIVE_UP) this.world.result = 'stuck';
    if (this.world.result && !this.resolved) {
      this.resolved = true; this.endT = 0;
      if (this.world.result === 'cup') this.landed(); else this.missed();
    }
    if (!this.resolved) return;
    this.endT += dt;
    if (this.world.result === 'cup') {
      if (this.endT > 1.4) this.win();
    } else if (this.endT > 1.7) {
      // the planks stay as the child left them; only the marble goes back to the hole
      this.world = makeWorld(this.level, this.placed.map(p => p.p));
      this.phase = 'build'; this.marblePop = 0;
    }
  }

  private win(): void {
    this.earned = this.easy ? 3 : starsForDrops(this.drops);
    // nothing is written down for a child of two or three: the board is done, and that is all
    if (!this.easy) recordLevelResult(saveKey(this.level), 1, this.earned, true);
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    sfx.jingle();
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

  /** Where a plank's turning handle sits: past one end, whichever has room on the board. */
  private handlePos(p: Plank): Vec & { end: 'a' | 'b' } {
    const [a, b] = plankEnds(p);
    const ux = (b.x - a.x) / p.len, uy = (b.y - a.y) / p.len, off = 0.75;
    const hb = { x: b.x + ux * off, y: b.y + uy * off };
    const ok = (q: Vec): boolean => q.x > 0.4 && q.x < W - 0.4 && q.y > 0.6 && q.y < H - 0.4;
    if (ok(hb)) return { ...hb, end: 'b' };
    return { x: a.x - ux * off, y: a.y - uy * off, end: 'a' };
  }

  private toWorld(p: Vec, L: Lay): Vec { return { x: (p.x - L.bx) / L.s, y: (p.y - L.by) / L.s }; }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) {
      this.held0 = hit;
      if (hit.startsWith('level:')) { const i = Number(hit.slice(6)); if (this.unlocked(i)) { sfx.tap(); this.start(i); } else sfx.shrug(); }
      else if (hit === 'levels') { this.phase = 'levels'; this.cardPop = 0; this.drag = null; sfx.tap(); }
      else if (hit === 'retry') { sfx.tap(); this.start(this.levelIndex); }
      else if (hit === 'next') { sfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); }
      else if (hit === 'drop' && this.phase === 'build') this.release();
      return;
    }
    if (this.phase !== 'build' || this.drag) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
    const L = this.layout(), u = this.u(), w = this.toWorld(p, L);
    // the turning handle first, since it sits where a plank end would otherwise be
    const handleR = Math.max(20 * u, 0.5 * L.s) / L.s;
    for (const q of this.placed) {
      const hp = this.handlePos(q.p);
      if (Math.hypot(hp.x - w.x, hp.y - w.y) < handleR) {
        this.placed = this.placed.filter(o => o !== q);
        this.drag = { kind: 'rotate', id: q.id, pose: { ...q.p }, before: { ...q.p }, dx: 0, dy: 0, end: hp.end, changed: false };
        sfx.pick();
        return;
      }
    }
    // a plank on the wall: near its body, generously, since a finger is not a pixel
    const reach = Math.max(0.5, 18 * u / L.s);
    let best: Placed | null = null, bd = 1e9;
    for (const q of this.placed) {
      const [a, b] = plankEnds(q.p);
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((w.x - a.x) * dx + (w.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const d = Math.hypot(a.x + dx * t - w.x, a.y + dy * t - w.y);
      if (d < reach && d < bd) { bd = d; best = q; }
    }
    if (best) {
      this.placed = this.placed.filter(o => o !== best);
      this.drag = { kind: 'move', id: best.id, pose: { ...best.p }, before: { ...best.p }, dx: best.p.x - w.x, dy: best.p.y - w.y, end: 'b', changed: false };
      sfx.pick();
      return;
    }
    // a plank in the tray
    for (let i = 0; i < L.slots.length; i++) {
      const s = L.slots[i];
      if (!this.inTray(i)) continue;
      if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
        this.drag = { kind: 'new', id: i, pose: { x: w.x, y: w.y, deg: 0, len: this.level.tray[i] }, before: null, dx: 0, dy: 0, end: 'b', changed: false };
        sfx.pick();
        return;
      }
    }
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const L = this.layout(), w = this.toWorld(this.at(e), L);
    if (d.kind === 'rotate') {
      const cx = d.pose.x, cy = d.pose.y;
      let ang = (Math.atan2(w.y - cy, w.x - cx) * 180) / Math.PI;
      if (d.end === 'a') ang += 180;
      while (ang > 90) ang -= 180;
      while (ang <= -90) ang += 180;
      const deg = snapDeg(ang);
      if (deg !== d.pose.deg) { d.pose.deg = deg; d.changed = true; sfx.turn(); }
    } else {
      d.pose.x = w.x + d.dx; d.pose.y = w.y + d.dy; d.changed = true;
    }
    this.dragBad = d.kind === 'rotate' ? !placementOk(this.level, this.placed.map(q => q.p), d.pose)
      : !placementOk(this.level, this.placed.map(q => q.p), { ...d.pose, x: snap(d.pose.x), y: snap(d.pose.y) });
  }

  private onUp(e: PointerEvent): void {
    this.held0 = null;
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const L = this.layout(), p = this.at(e), u = this.u();
    const others = this.placed.map(q => q.p);
    const overTray = p.x >= L.colX - 4 * u;
    if (d.kind === 'rotate') {
      const ok = placementOk(this.level, others, d.pose);
      this.placed.push({ id: d.id, p: ok ? d.pose : d.before! });
      if (ok && d.changed) sfx.place();
      return;
    }
    if (overTray) {
      // back to the tray: a plank taken off the wall goes home, a new one never left
      if (d.kind === 'move') sfx.remove();
      return;
    }
    const q = nearestPlacement(this.level, others, d.pose);
    if (q) { this.placed.push({ id: d.id, p: q }); sfx.place(); return; }
    // nowhere to stand: a plank from the wall goes back where it was, a new one back to the tray
    if (d.before) this.placed.push({ id: d.id, p: d.before });
    else sfx.remove();
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

    const L = this.layout(), v = this.view(L), u = this.u();
    // the room behind the wall: a darker floor of wood so the frame stands out
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#8a5a30'); bg.addColorStop(1, '#6e4521');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this.wall.paint(ctx, L.bx, L.by, L.s, this.dpr);

    for (const p of this.level.fixed) paintPlank(ctx, v, p, { fixed: true });
    for (const g of this.level.pegs) paintPeg(ctx, v, g);
    paintDropHole(ctx, v, this.level.drop.x, this.level.drop.y);
    for (const q of this.placed) paintPlank(ctx, v, q.p);
    if (this.phase === 'build') for (const q of this.placed) {
      const hp = this.handlePos(q.p);
      paintHandle(ctx, L.bx + hp.x * L.s, L.by + hp.y * L.s, Math.max(13 * u, 0.42 * L.s), false);
    }
    paintCupBack(ctx, v, this.level.cupX);
    this.drawMarble(L);
    paintCupFront(ctx, v, this.level.cupX, this.cupGlow);
    if (this.drag) {
      const d = this.drag;
      paintPlank(ctx, v, d.pose, { ghost: true, bad: this.dragBad, lift: 5 });
      const hp = this.handlePos(d.pose);
      if (d.kind === 'rotate') paintHandle(ctx, L.bx + hp.x * L.s, L.by + hp.y * L.s, Math.max(13 * u, 0.42 * L.s), true);
    }
    this.ps.draw(ctx);
    this.drawTray(L);
    this.drawChrome(L);
    if (this.phase === 'won') this.drawEnd();
  }

  private drawMarble(L: Lay): void {
    const m = this.world.marble;
    const r = MARBLE_R * L.s;
    let a = 1, y = m.y;
    if (this.phase === 'build') {
      // waiting in the hole, breathing a little so it looks ready
      const pop = easeOutBack(clamp(this.marblePop, 0, 1));
      y += Math.sin(this.t * 3) * 0.04;
      a = clamp(this.marblePop * 2, 0, 1);
      paintMarble(this.ctx, L.bx + m.x * L.s, L.by + y * L.s, r * pop, 0, a);
      return;
    }
    if (this.resolved && this.world.result !== 'cup') a = 1 - clamp((this.endT - 0.5) / 1, 0, 1);
    paintMarble(this.ctx, L.bx + m.x * L.s, L.by + y * L.s, r, m.rot, a);
  }

  private drawTray(L: Lay): void {
    const ctx = this.ctx, u = this.u();
    // the tray: a shallow wooden box with the planks lying in it
    ctx.save();
    ctx.fillStyle = 'rgba(40,22,8,0.35)';
    ctx.beginPath(); ctx.roundRect(L.colX + 2, L.colY + 4, L.colW, L.colH, 14 * u); ctx.fill();
    const g = ctx.createLinearGradient(0, L.colY, 0, L.colY + L.colH);
    g.addColorStop(0, '#a8773c'); g.addColorStop(1, '#8a5c2a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(L.colX, L.colY, L.colW, L.colH, 14 * u); ctx.fill();
    ctx.fillStyle = 'rgba(30,16,4,0.38)';
    ctx.beginPath(); ctx.roundRect(L.colX + 6 * u, L.colY + 6 * u, L.colW - 12 * u, L.colH - 12 * u, 10 * u); ctx.fill();
    ctx.restore();
    const empty = this.placed.length === 0 && !this.drag && this.phase === 'build';
    L.slots.forEach((s, i) => {
      if (!this.inTray(i)) return;
      const len = this.level.tray[i];
      const tv: View = { ox: s.x + s.w / 2, oy: s.y + s.h / 2, s: L.ts };
      if (empty && i === 0) {
        // an invitation: the first plank breathes until a hand has touched one
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.t * 3);
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath(); ctx.roundRect(s.x, s.y + 2, s.w, s.h - 4, 10 * u); ctx.fill();
        ctx.restore();
      }
      paintPlank(ctx, tv, { x: 0, y: 0, deg: 0, len });
    });
  }

  private drawChrome(L: Lay): void {
    const ctx = this.ctx, u = this.u();
    if (!this.easy) this.button('levels', T('Boards', 'Borden'), 14 * u, 12 * u, 92 * u, 44 * u);
    ctx.fillStyle = '#fff3d6';
    ctx.textAlign = 'left';
    ctx.font = this.font('900', 14);
    if (L.land) { if (!this.easy) ctx.fillText(nameOf(this.level), 14 * u, 78 * u, 94 * u); }
    else ctx.fillText(nameOf(this.level), (this.easy ? 14 : 114) * u, 40 * u, Math.max(40, this.w - (this.easy ? 14 : 114) * u - 128 * u));

    // "Laat los" - quiet while the marble is on its way
    const b = L.btn, live = this.phase === 'build';
    const face = chunkyButton(ctx, b.x, b.y, b.w, b.h, { tone: '#4fae6e', pressed: this.held0 === 'drop' && live, disabled: !live });
    ctx.fillStyle = '#ffffff';
    ctx.font = this.font('900', 16);
    ctx.textAlign = 'center';
    ctx.fillText(T('Let go', 'Laat los'), b.x + b.w / 2, face.y + b.h * 0.64, b.w - 16 * u);
    if (live) this.hits.push(b);

    if (this.noteT > 0 && this.phase !== 'won') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 12);
      const maxW = L.s * W - 12 * u;
      const tw = Math.min(maxW, ctx.measureText(this.note).width + 28 * u);
      const ny = L.by + L.s * 1.8;
      glassPanel(ctx, L.bx + (L.s * W - tw) / 2, ny, tw, 30 * u, 15 * u, 0.94);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      ctx.fillText(this.note, L.bx + (L.s * W) / 2, ny + 20 * u, tw - 18 * u);
      ctx.restore();
    }
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
    ctx.fillStyle = 'rgba(40, 22, 8, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = 236 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, '#f1cf8c'); band.addColorStop(1, 'rgba(241,207,140,0)');
    ctx.fillStyle = band; ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, T('In the cup', 'In het bekertje'), this.w / 2, y + 50 * u, this.font('900', 22), '#123047');
    if (!this.easy) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + 102 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.restore();
    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    if (this.easy) { this.button('retry', T('Once more', 'Nog een keer'), this.w / 2 - bw / 2, by, bw, bh, '#4fae6e', '#ffffff'); return; }
    this.button('retry', T('Once more', 'Nog een keer'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next board', 'Volgend bord'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All boards', 'Alle borden'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#9a6a3a'); bg.addColorStop(1, '#6e4521');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    heading(ctx, 'Knikkerbaan', this.w / 2, 60 * u, this.font('900', 26), '#fff3d6');
    ctx.fillStyle = 'rgba(255,243,214,0.85)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Place the planks. Roll the marble into the cup.', 'Zet de planken neer. Rol de knikker in het bekertje.'), this.w / 2, 84 * u, this.w - 24 * u);

    const cols = this.w > 640 * u ? 4 : 2;
    const pad = 14 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.62;
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
      ctx.shadowColor = 'rgba(30,16,4,0.4)';
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u); ctx.clip();
      ctx.fillStyle = '#c9985a'; ctx.fillRect(x, y, cw, art + 12 * u);
      const ms = (art - 8 * u) / H;
      paintMiniBoard(ctx, L, x + cw / 2 - (W * ms) / 2, y + 10 * u, ms);
      if (!open) { ctx.fillStyle = 'rgba(236, 228, 214, 0.84)'; ctx.fillRect(x, y, cw, art + 12 * u); }
      ctx.restore();

      ctx.fillStyle = 'rgba(40,22,8,0.6)';
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#3a2410' : 'rgba(58,36,16,0.68)';
      ctx.font = this.font('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 28 * u, cw - 28 * u);
      for (let sI = 0; sI < 3; sI++) drawStarGem(ctx, x + 22 * u + sI * 20 * u, y + art + 46 * u, 8 * u, sI < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(58,36,16,0.55)';
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

