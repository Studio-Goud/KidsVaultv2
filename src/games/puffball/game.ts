/**
 * Stuifzwam - the counting game that is shaped like Bomberman.
 *
 * You walk a grid, put down a puffball, and get out of its way. It reaches a number of squares you
 * can read off its cap, and while it swells those exact squares light up with a dot apiece, so the
 * question "am I far enough away?" is a question about counting rather than about nerve. Pick-ups
 * raise the reach, and the counting starts again with a bigger number.
 *
 * Moving is square by square, not free-roaming: a four year old who presses left goes one square
 * left, which is the only way the counting means anything.
 *
 * Everything is drawn with canvas paths and every sound is synthesised. No advertising, no tracking.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { stepDirections } from './walkrule';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, chunkyButton, drawStar, easeOutBack, easeOutCubic, glassPanel, handCursor, heading,
  outlinedText, Particles, progressRing, Shake, vignette,
} from '../../render/look';
import { puff } from './puffsfx';
import {
  paintBoard, paintHedgehog, paintMole, paintPickup, paintPop, paintPot, paintPuff, paintReach,
  paintShards,
} from './paint';
import {
  at, buildBoard, FUSE, LEVELS, moleStarts, POP_TIME, potsLeft, reachOf, setTile, START, starsFor,
  type Board, type Level, type PickupKind, type Puff,
} from './model';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won' | 'lost';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `puff:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }

/** Anything that walks the grid: the hedgehog and the moles move by exactly the same rules. */
interface Walker {
  /** the square it is on, or the one it is walking off */
  fx: number;
  fy: number;
  /** the square it is walking to; equal to from when standing still */
  tx: number;
  ty: number;
  /** how far along that step it is, 0..1 */
  k: number;
  /** squares per second */
  speed: number;
  /** -1 facing left, 1 facing right */
  facing: number;
  /** how long it has been walking, for the legs */
  walk: number;
  /** seconds of sitting down dizzy */
  dazed: number;
  dir: { x: number; y: number };
  alive: boolean;
  /** a nudge towards a wall just walked into, and which way it went; fades over a fifth of a second */
  bump: number;
  bumpDir: { x: number; y: number };
}

interface Pop { x: number; y: number; age: number }
interface Shard { x: number; y: number; age: number; seed: number }
interface Drop { x: number; y: number; kind: PickupKind }

const walker = (x: number, y: number, speed: number): Walker => ({
  fx: x, fy: y, tx: x, ty: y, k: 1, speed, facing: 1, walk: 0, dazed: 0, dir: { x: 0, y: 0 }, alive: true,
  bump: 0, bumpDir: { x: 0, y: 0 },
});

/**
 * The scrap of board on a level card. It depends on nothing but the level, so it is built once
 * rather than laid out afresh for every card on every frame the list is up.
 */
const minis = new Map<string, Board>();
function miniBoard(l: Level): Board {
  let m = minis.get(l.id);
  if (!m) { m = buildBoard(l); minis.set(l.id, m); }
  return m;
}

/** How much fuse is left when each note of the climb sounds. Deliberately accelerating. */
const TICKS = [2.0, 1.6, 1.25, 0.95, 0.7, 0.5, 0.33, 0.18, 0.07];

export class Puffball {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  /** the safe height: the screen less the notch and the home bar */
  private h = 0;
  /** the whole screen, for the art that runs under them */
  private fullH = 0;
  private st = 0;
  private sb = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private phaseT = 0;
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private board: Board = buildBoard(LEVELS[0]);
  private me: Walker = walker(START.x, START.y, 3.2);
  private moles: Walker[] = [];
  private puffs: Puff[] = [];
  private pops: Pop[] = [];
  private shards: Shard[] = [];
  private drops: Drop[] = [];
  private reach = 1;
  private maxPuffs = 1;
  private lives = 3;
  private maxLives = 3;
  private knocks = 0;
  private earned = 0;
  private note = '';
  private noteT = 0;
  private lastTick = -1;
  private hits: Hit[] = [];
  private held = new Map<number, string>();
  private keys = new Set<string>();
  /** a direction that was tapped rather than held, and how long it is still worth one step */
  private nudge = { x: 0, y: 0 };
  private nudgeT = 0;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private wantDrop = false;
  /** a refused tap flashes whatever refused it, because the sound is off on most phones */
  private denyT = 0;
  private denyCard = -1;
  /** how long since the child last touched anything, and whether they have worked out the button */
  private idle = 0;
  private everDropped = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    (window as unknown as { __puff?: Puffball }).__puff = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  /**
   * One step back, for the button every game shares.
   *
   * What "back" means is the game's business; that there is a back at all, in the same corner and
   * the same shape everywhere, is not.
   */
  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, level: this.level.id, reach: this.reach, puffs: this.puffs.length,
      maxPuffs: this.maxPuffs, lives: this.lives, knocks: this.knocks,
      me: { x: this.me.tx, y: this.me.ty, dazed: Math.round(this.me.dazed * 10) / 10 },
      moles: this.moles.filter(m => m.alive).map(m => ({ x: m.tx, y: m.ty })),
      potsLeft: potsLeft(this.board),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    // The picture fills the screen, but nothing a child reads or presses may sit under the notch
    // or the home bar. So w and h are the safe box, the canvas is the whole screen, and draw()
    // shifts everything down by the top inset and carries the art on into the strips.
    const safe = safeArea();
    this.st = safe.top;
    this.sb = safe.bottom;
    this.fullH = Math.max(1, window.innerHeight);
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  /**
   * How much room the thumbs take at the bottom.
   *
   * On a phone held upright the pad sits under the board and needs its own band. On a wide screen
   * there is room beside the board, so the pad moves into the margin and the board gets the height.
   */
  private wide(): boolean { return this.w > this.h * 1.15; }
  private padRoom(): number { return this.wide() ? 40 * this.u() : Math.min(190 * this.u(), this.h * 0.3); }

  private grid(): { x: number; y: number; cell: number } {
    const u = this.u();
    const top = 68 * u;
    const avail = this.h - top - this.padRoom() - 34 * u;
    const cell = Math.min((this.w - 8 * u) / this.board.cols, avail / this.board.rows);
    return {
      x: (this.w - cell * this.board.cols) / 2,
      y: top + Math.max(0, (avail - cell * this.board.rows) * 0.3),
      cell,
    };
  }

  // ---------- a level ----------

  private unlocked(i: number): boolean {
    return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed;
  }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.board = buildBoard(this.level);
    this.me = walker(START.x, START.y, 3.2);
    this.moles = moleStarts(this.board).slice(0, this.level.moles)
      .map(s => walker(s.x, s.y, this.level.moleSpeed));
    this.puffs = [];
    this.pops = [];
    this.shards = [];
    this.drops = [];
    this.reach = this.level.reach;
    this.maxPuffs = this.level.puffs;
    // the first three nights have nothing in them that can catch you, so the only way to fail is
    // while still working out what reach means. That deserves more room than a mole night does.
    this.lives = this.maxLives = this.level.moles === 0 ? 5 : 3;
    this.knocks = 0;
    this.earned = 0;
    this.lastTick = -1;
    // a space bar pressed on the menu must not drop a puffball on the first frame of the level
    this.wantDrop = false;
    this.idle = 0;
    this.everDropped = false;
    this.ps.clear();
    this.phase = 'play';
    this.phaseT = 0;
    this.cardPop = 0;
    this.say(NL() ? this.level.hintNl : this.level.hint, 6);
  }

  private say(text: string, secs = 3): void { this.note = text; this.noteT = secs; }

  // ---------- the rules ----------

  private blocked(x: number, y: number): boolean {
    const t = at(this.board, x, y);
    if (t !== 'floor') return true;
    return this.puffs.some(p => p.x === x && p.y === y);
  }

  /** Every square a puffball currently out is going to cover. */
  private danger(): Set<number> {
    const s = new Set<number>();
    for (const p of this.puffs) {
      for (const c of reachOf(this.board, p)) s.add(c.y * this.board.cols + c.x);
    }
    return s;
  }

  private step(e: Walker, dt: number, want: { x: number; y: number }): void {
    if (e.dazed > 0) { e.dazed = Math.max(0, e.dazed - dt); return; }
    if (e.k < 1) {
      e.k = Math.min(1, e.k + dt * e.speed);
      e.walk += dt;
      if (e.k < 1) return;
      e.fx = e.tx; e.fy = e.ty;
    }
    // standing on a square: where to try to go, per the rule in walkrule.ts
    for (const d of stepDirections(e === this.me, want, e.dir)) {
      const nx = e.tx + d.x, ny = e.ty + d.y;
      if (this.blocked(nx, ny)) continue;
      e.dir = { x: d.x, y: d.y };
      if (d.x) e.facing = d.x > 0 ? 1 : -1;
      e.fx = e.tx; e.fy = e.ty;
      e.tx = nx; e.ty = ny;
      e.k = 0;
      return;
    }
    // nothing was walkable: lean into whatever is in the way, so the tap is visibly answered
    const into = (want.x || want.y) ? want : e.dir;
    if ((into.x || into.y) && e.bump <= 0) {
      e.bump = 1;
      e.bumpDir = { x: into.x, y: into.y };
      if (e === this.me) {
        const g = this.grid();
        this.ps.spawn('dust', g.x + (e.tx + 0.5 + into.x * 0.45) * g.cell, g.y + (e.ty + 0.5 + into.y * 0.45) * g.cell,
          3, { spread: 0.7, speed: 40 * g.cell / 46, life: 0.3, size: g.cell * 0.07, colour: '#d9e6c8' });
        puff.blocked();
      }
    }
    e.dir = { x: 0, y: 0 };
    e.walk = 0;
  }

  /** Where a walker is drawn: its square, plus the lean of a wall it has just walked into. */
  private drawPos(e: Walker): Vec {
    const p = this.posOf(e);
    const lean = Math.sin(e.bump * Math.PI) * 0.17;
    return { x: p.x + e.bumpDir.x * lean, y: p.y + e.bumpDir.y * lean };
  }

  /** Where a walker is on screen, in tile units. */
  private posOf(e: Walker): Vec {
    return { x: e.fx + (e.tx - e.fx) * easeOutCubic(e.k), y: e.fy + (e.ty - e.fy) * easeOutCubic(e.k) };
  }

  private dropPuff(): void {
    if (this.phase !== 'play' || this.me.dazed > 0) return;
    if (this.puffs.length >= this.maxPuffs) { this.deny(); return; }
    const x = this.me.k < 0.5 ? this.me.fx : this.me.tx;
    const y = this.me.k < 0.5 ? this.me.fy : this.me.ty;
    if (this.puffs.some(p => p.x === x && p.y === y)) { this.deny(); return; }
    this.puffs.push({ x, y, fuse: FUSE, reach: this.reach, mine: true });
    this.everDropped = true;
    puff.place();
  }

  /** The answer to a tap that cannot be honoured: a flash on the dial, a shake, and a thud. */
  private deny(card = -1): void {
    this.denyT = 0.4;
    this.denyCard = card;
    this.shake.add(0.16);
    puff.blocked();
  }

  private popPuff(p: Puff): void {
    const cells = reachOf(this.board, p);
    for (const c of cells) {
      this.pops.push({ x: c.x, y: c.y, age: 0 });
      const i = c.y * this.board.cols + c.x;
      if (at(this.board, c.x, c.y) === 'pot') {
        setTile(this.board, c.x, c.y, 'floor');
        this.shards.push({ x: c.x, y: c.y, age: 0, seed: i });
        const under = this.board.under[i];
        if (under) { this.drops.push({ x: c.x, y: c.y, kind: under }); this.board.under[i] = null; }
        puff.pot();
      }
      // a puffball caught in the cloud goes off with it
      for (const o of this.puffs) {
        if (o !== p && o.x === c.x && o.y === c.y && o.fuse > 0.02) o.fuse = 0.02;
      }
    }
    puff.pop();
    this.shake.add(0.5);
    const g = this.grid();
    this.ps.spawn('dust', g.x + (p.x + 0.5) * g.cell, g.y + (p.y + 0.5) * g.cell, 10,
      { colour: 'rgba(250, 244, 226, 0.9)', speed: 150, size: g.cell * 0.4, max: 0.6, spread: TAU });
  }

  private knock(e: Walker, mine: boolean): void {
    if (e.dazed > 0 || !e.alive) return;
    e.dazed = mine ? 1.7 : 1.1;
    e.dir = { x: 0, y: 0 };
    e.k = 1;
    e.fx = e.tx; e.fy = e.ty;
    const g = this.grid();
    const p = this.posOf(e);
    this.ps.spawn('spark', g.x + (p.x + 0.5) * g.cell, g.y + (p.y + 0.5) * g.cell, 8,
      { colour: mine ? '#ffd27a' : '#cfe4f2', speed: 140, size: g.cell * 0.22, max: 0.7, spread: TAU });
    if (mine) {
      this.knocks++;
      this.lives--;
      puff.knocked();
      this.shake.add(0.8);
      this.say(this.lives > 0
        ? T('Oof. Count the squares before you stand still.', 'Oef. Tel de vakjes voor je stil gaat staan.')
        : T('That was the last one.', 'Dat was de laatste.'), 3);
    } else {
      puff.mole();
    }
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.idle += dt;
    this.denyT = Math.max(0, this.denyT - dt);
    this.nudgeT = Math.max(0, this.nudgeT - dt);
    if (this.denyT === 0) this.denyCard = -1;
    this.me.bump = Math.max(0, this.me.bump - dt * 5);
    for (const m of this.moles) m.bump = Math.max(0, m.bump - dt * 5);
    for (const s of this.shards) s.age += dt;
    this.shards = this.shards.filter(s => s.age < 0.45);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter(p => p.age < POP_TIME);
    if (this.phase !== 'play') return;

    // the player
    const want = this.wanted();
    const wasAt = `${this.me.tx},${this.me.ty}`;
    this.step(this.me, dt, want);
    // a tapped direction buys one square and is then spent
    if (`${this.me.tx},${this.me.ty}` !== wasAt) this.nudgeT = 0;
    if (this.wantDrop) { this.wantDrop = false; this.dropPuff(); }

    // the moles
    const danger = this.danger();
    for (const m of this.moles) {
      if (!m.alive) continue;
      this.step(m, dt, this.moleWants(m, danger));
    }

    // the puffballs
    for (const p of this.puffs) p.fuse -= dt;
    // The note climbs while it swells. A tick a second left a second and a half of silence right
    // before the pop, which is the moment a child most needs to hear it coming, so the gaps
    // shorten instead: the last four notes fall inside the final half second.
    const left = this.puffs.length ? Math.min(...this.puffs.map(p => p.fuse)) : -1;
    const tick = left > 0 ? TICKS.filter(t => left <= t).length : -1;
    if (tick !== this.lastTick) {
      if (tick > 0) puff.tick(tick - 1);
      this.lastTick = tick;
    }
    const going = this.puffs.filter(p => p.fuse <= 0);
    for (const p of going) this.popPuff(p);
    if (going.length) this.puffs = this.puffs.filter(p => p.fuse > 0);

    // who is standing in a cloud
    const fresh = new Set(this.pops.filter(p => p.age < 0.28).map(p => p.y * this.board.cols + p.x));
    if (fresh.size) {
      const mi = Math.round(this.posOf(this.me).y) * this.board.cols + Math.round(this.posOf(this.me).x);
      if (fresh.has(mi)) this.knock(this.me, true);
      for (const m of this.moles) {
        if (!m.alive || m.dazed > 0) continue;
        const p = this.posOf(m);
        if (fresh.has(Math.round(p.y) * this.board.cols + Math.round(p.x))) this.knock(m, false);
      }
    }
    // a mole that has sat long enough goes home
    for (const m of this.moles) {
      if (m.alive && m.dazed > 0 && m.dazed < 0.05) {
        m.alive = false;
        const g = this.grid();
        this.ps.spawn('dust', g.x + (m.tx + 0.5) * g.cell, g.y + (m.ty + 0.5) * g.cell, 12,
          { colour: 'rgba(230, 226, 236, 0.9)', speed: 120, size: g.cell * 0.3, max: 0.7, spread: TAU });
      }
    }

    // picking things up
    const mp = this.posOf(this.me);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.abs(mp.x - d.x) > 0.5 || Math.abs(mp.y - d.y) > 0.5) continue;
      this.drops.splice(i, 1);
      puff.pickup();
      if (d.kind === 'reach') {
        this.reach = Math.min(5, this.reach + 1);
        this.say(T(`Now it reaches ${this.reach}. Count again.`, `Nu komt hij ${this.reach} ver. Tel opnieuw.`), 3.5);
      } else if (d.kind === 'extra') {
        this.maxPuffs = Math.min(4, this.maxPuffs + 1);
        this.say(T('Two at once now.', 'Nu twee tegelijk.'), 2.5);
      } else {
        this.me.speed = Math.min(5, this.me.speed + 0.9);
        this.say(T('Quicker feet.', 'Snellere voeten.'), 2.5);
      }
    }

    if (this.lives <= 0) { this.finish(false); return; }
    const done = this.level.goal === 'clear'
      ? potsLeft(this.board) === 0
      : this.moles.every(m => !m.alive);
    if (done && !this.puffs.length) this.finish(true);
  }

  private finish(won: boolean): void {
    this.phase = won ? 'won' : 'lost';
    this.phaseT = 0;
    this.cardPop = 0;
    if (won) {
      const left = this.level.goal === 'clear' ? potsLeft(this.board) : this.moles.filter(m => m.alive).length;
      this.earned = starsFor(this.knocks, left);
      recordLevelResult(saveKey(this.level), 1, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 20 + this.earned * 15));
      persist();
      puff.complete();
    } else {
      puff.fail();
    }
  }

  // ---------- what the player and the moles want ----------

  private wanted(): { x: number; y: number } {
    const d = { x: 0, y: 0 };
    const down = (...ids: string[]): boolean =>
      ids.some(id => this.keys.has(id)) || [...this.held.values()].some(v => ids.includes(v));
    if (down('ArrowLeft', 'a', 'pad:left')) d.x = -1;
    else if (down('ArrowRight', 'd', 'pad:right')) d.x = 1;
    else if (down('ArrowUp', 'w', 'pad:up')) d.y = -1;
    else if (down('ArrowDown', 's', 'pad:down')) d.y = 1;
    // A tap can be shorter than the time it takes to walk one square, and a tap that does nothing
    // feels broken. So a fresh press is remembered for a moment and spends itself on one step.
    if (!d.x && !d.y && this.nudgeT > 0) return { ...this.nudge };
    return d;
  }

  /** Remember a direction that was only tapped, so it still buys exactly one square. */
  private tapped(x: number, y: number): void {
    this.nudge = { x, y };
    this.nudgeT = 0.28;
  }

  /**
   * A mole's mind, and it is a small one on purpose: get out of a cloud that is coming, otherwise
   * keep going the way it was going, and turn at random when it cannot. It never corners a child
   * cleverly, which at this age is the point.
   */
  private moleWants(m: Walker, danger: Set<number>): { x: number; y: number } {
    const cols = this.board.cols;
    const here = m.ty * cols + m.tx;
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const open = dirs.filter(d => !this.blocked(m.tx + d.x, m.ty + d.y));
    if (!open.length) return { x: 0, y: 0 };
    const safe = open.filter(d => !danger.has((m.ty + d.y) * cols + (m.tx + d.x)));
    if (danger.has(here)) return (safe[0] ?? open[0]);
    const pool = safe.length ? safe : open;
    const straight = pool.find(d => d.x === m.dir.x && d.y === m.dir.y);
    if (straight && Math.random() < 0.72) return straight;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    this.idle = 0;
    const hit = this.hitAt(this.at(e));
    if (!hit) return;
    this.held.set(e.pointerId, hit);
    if (hit === 'pad:left') this.tapped(-1, 0);
    else if (hit === 'pad:right') this.tapped(1, 0);
    else if (hit === 'pad:up') this.tapped(0, -1);
    else if (hit === 'pad:down') this.tapped(0, 1);
    if (hit.startsWith('pad:')) return;
    if (hit === 'drop') { this.wantDrop = true; return; }
    if (hit.startsWith('level:')) {
      const i = Number(hit.slice(6));
      if (this.unlocked(i)) { this.start(i); puff.tap(); } else this.deny(i);
      return;
    }
    if (hit === 'levels') { this.phase = 'levels'; this.cardPop = 0; puff.tap(); return; }
    if (hit === 'retry') { this.start(this.levelIndex); return; }
    if (hit === 'next') { this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
  }

  private onUp(e: PointerEvent): void { this.held.delete(e.pointerId); }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
    if (down) {
      unlockAudio();
      this.idle = 0;
      if (k === ' ' || k === 'Enter') { this.wantDrop = true; return; }
      if (!this.keys.has(k)) {
        if (k === 'ArrowLeft' || k === 'a') this.tapped(-1, 0);
        else if (k === 'ArrowRight' || k === 'd') this.tapped(1, 0);
        else if (k === 'ArrowUp' || k === 'w') this.tapped(0, -1);
        else if (k === 'ArrowDown' || k === 's') this.tapped(0, 1);
      }
      this.keys.add(k);
    } else this.keys.delete(k);
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size)}px Nunito, system-ui, sans-serif`;
  }
  private fontU(weight: string, size: number): string { return this.font(weight, size * this.u()); }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    this.hits = [];
    const night = ctx.createLinearGradient(0, 0, 0, this.h);
    night.addColorStop(0, '#20364a');
    night.addColorStop(0.5, '#2c4a4a');
    night.addColorStop(1, '#1d3330');
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, this.w, this.h);

    if (this.phase === 'levels') { this.drawLevels(); return; }

    ctx.save();
    this.shake.apply(ctx, 7 * this.u());
    this.drawBoard();
    this.ps.draw(ctx);
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.3);
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'lost') this.drawEnd();
  }

  private drawBoard(): void {
    const ctx = this.ctx, b = this.board, g = this.grid();
    const c = g.cell;
    paintBoard(ctx, b, g.x, g.y, c, this.level.seed);

    for (const s of this.shards) paintShards(ctx, g.x + s.x * c, g.y + s.y * c, c, s.age, s.seed);
    for (let y = 0; y < b.rows; y++) {
      for (let x = 0; x < b.cols; x++) {
        if (at(b, x, y) === 'pot') paintPot(ctx, g.x + x * c, g.y + y * c, c, y * b.cols + x);
      }
    }
    // what a puffball is about to cover, over the pots so a pot in the way still shows its dot
    // the first two nights hold the mark lit; after that it dims once it has counted itself out
    const hold = this.levelIndex < 2;
    for (const p of this.puffs) paintReach(ctx, reachOf(b, p), g.x, g.y, c, p.fuse, this.t, hold);
    for (const d of this.drops) paintPickup(ctx, g.x + (d.x + 0.5) * c, g.y + (d.y + 0.5) * c, c * 0.3, d.kind, this.t);
    // the puffballs themselves sit under whoever is standing on them, so nobody is hidden
    for (const p of this.puffs) paintPuff(ctx, g.x + p.x * c, g.y + p.y * c, c, p.fuse, p.reach, (w, s) => this.font(w, s));

    for (const m of this.moles) {
      if (!m.alive) continue;
      const p = this.drawPos(m);
      paintMole(ctx, g.x + (p.x + 0.5) * c, g.y + (p.y + 0.5) * c, c * 0.44, m.facing, m.walk, m.dazed, this.t);
    }
    const mp = this.drawPos(this.me);
    paintHedgehog(ctx, g.x + (mp.x + 0.5) * c, g.y + (mp.y + 0.5) * c, c * 0.46, this.me.facing, this.me.walk, this.me.dazed, this.t);

    for (const p of this.pops) paintPop(ctx, g.x + p.x * c, g.y + p.y * c, c, p.age, p.x * 7 + p.y * 13);
  }

  // ---------- the interface ----------

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    // how far your puffball reaches, as the number you will see on the cap
    const r = 21 * u;
    const dx = this.w / 2 - 34 * u, dy = 34 * u;
    ctx.save();
    ctx.shadowColor = 'rgba(6, 20, 26, 0.5)';
    ctx.shadowBlur = 10 * u;
    ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#5a3326';
    ctx.font = this.fontU('900', 21);
    ctx.textAlign = 'center';
    ctx.fillText(String(this.reach), dx, dy + 4 * u);
    ctx.font = this.fontU('800', 8);
    ctx.fillStyle = 'rgba(90, 51, 38, 0.7)';
    ctx.fillText(T('reach', 'bereik'), dx, dy + 14 * u);

    // how many puffballs you may have out, and how many knocks are left, side by side
    const px0 = this.w / 2 + 6 * u;
    // a refused drop shakes this row and rings it, because that is the thing that said no
    const deny = this.denyCard < 0 ? this.denyT / 0.4 : 0;
    ctx.save();
    if (deny > 0) ctx.translate(Math.sin(this.t * 46) * 3 * u * deny, 0);
    for (let i = 0; i < this.maxPuffs; i++) {
      const px = px0 + i * 19 * u;
      if (deny > 0) {
        ctx.strokeStyle = `rgba(255, 176, 96, ${0.9 * deny})`;
        ctx.lineWidth = 2.2 * u;
        ctx.beginPath();
        ctx.ellipse(px, dy - 9 * u, 9.5 * u, 8.5 * u, 0, 0, TAU);
        ctx.stroke();
      }
      const used = i < this.puffs.length;
      ctx.fillStyle = used ? 'rgba(255,255,255,0.25)' : '#f6ecd8';
      ctx.beginPath();
      ctx.ellipse(px, dy - 9 * u, 7.5 * u, 6.5 * u, 0, 0, TAU);
      ctx.fill();
      if (!used) {
        ctx.fillStyle = 'rgba(120, 90, 60, 0.35)';
        ctx.beginPath();
        ctx.ellipse(px, dy - 4 * u, 3 * u, 2 * u, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    for (let i = 0; i < this.maxLives; i++) {
      const px = px0 + i * 19 * u;
      const on = i < this.lives;
      ctx.save();
      ctx.translate(px, dy + 11 * u);
      ctx.fillStyle = on ? '#7fbd72' : 'rgba(255,255,255,0.2)';
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k / 3) * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 3.6 * u, Math.sin(a) * 3.6 * u, 3.1 * u, 3.1 * u, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.noteT > 0 && this.phase === 'play') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.fontU('800', 12);
      const tw = Math.min(this.w - 36 * u, ctx.measureText(this.note).width + 32 * u);
      const g = this.grid();
      const ny = Math.min(g.y + g.cell * this.board.rows + 8 * u, this.h - this.padRoom() - 34 * u);
      glassPanel(ctx, this.w / 2 - tw / 2, ny, tw, 30 * u, 15 * u, 0.94);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      ctx.fillText(this.note, this.w / 2, ny + 20 * u, tw - 22 * u);
      ctx.restore();
    }

    if (this.phase === 'play') { this.drawPad(); this.drawHandHint(); }
    this.button('levels', T('Nights', 'Nachten'), 12 * u, 12 * u, 92 * u, 44 * u);
    ctx.textAlign = 'left';
  }

/**
   * The only instruction a four year old gets, and it has no words in it: when nothing has
   * happened for a while a hand comes in and presses the button they need. First the big button,
   * until they have put one down; after that, if they are standing in the cloud, the arrow that
   * walks them out of it. It is only on the first two nights - after that they know.
   */
  private drawHandHint(): void {
    if (this.levelIndex > 1 || this.me.dazed > 0) return;
    const want = this.handWants();
    if (!want) return;
    const hit = this.hits.find(h => h.id === want);
    if (!hit) return;
    const cycle = (this.t % 1.6) / 1.6;
    const press = clamp(Math.sin(cycle * Math.PI) * 1.8, 0, 1);
    const fade = clamp((this.idle - 1.6) / 0.6, 0, 1) * (0.55 + 0.45 * press);
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = fade;
    // a ring that closes in on the button, so the eye is taken there before the hand arrives
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.75)';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(hit.x + hit.w / 2, hit.y + hit.h / 2, hit.w * (0.72 + 0.22 * (1 - press)), 0, TAU);
    ctx.stroke();
    handCursor(ctx, hit.x + hit.w * 0.62, hit.y + hit.h * 0.52, 15 * u, press);
    ctx.restore();
  }

  /** Which button the hand should press, or nothing if the child is getting on with it. */
  private handWants(): string | null {
    if (this.idle < 1.6) return null;
    if (!this.everDropped) return this.puffs.length < this.maxPuffs ? 'drop' : null;
    // Standing where a puffball is about to reach: show the way out. One step is often not enough
    // - at reach two you need three - so each direction is walked until it leaves the cloud, and
    // the one that gets clear soonest wins.
    const danger = this.danger();
    const mx = this.me.tx, my = this.me.ty;
    if (!danger.has(my * this.board.cols + mx)) return null;
    let best: string | null = null;
    let bestSteps = 99;
    for (const [id, dx, dy] of [['pad:down', 0, 1], ['pad:up', 0, -1], ['pad:right', 1, 0], ['pad:left', -1, 0]] as const) {
      for (let n = 1; n <= 6; n++) {
        const nx = mx + dx * n, ny = my + dy * n;
        if (this.blocked(nx, ny)) break;
        if (!danger.has(ny * this.board.cols + nx)) {
          if (n < bestSteps) { bestSteps = n; best = id; }
          break;
        }
      }
    }
    return best;
  }

  /** A cross of arrows under the left thumb and one big button under the right. */
  private drawPad(): void {
    const ctx = this.ctx, u = this.u();
    const held = [...this.held.values()];
    const size = Math.min(56 * u, this.w * 0.15);
    const cx = 16 * u + size * 1.5, cy = this.h - size * 1.6 - 12 * u;
    const arrows: Array<[string, number, number, number]> = [
      ['pad:up', 0, -1, -Math.PI / 2],
      ['pad:down', 0, 1, Math.PI / 2],
      ['pad:left', -1, 0, Math.PI],
      ['pad:right', 1, 0, 0],
    ];
    for (const [id, ax, ay, rot] of arrows) {
      const x = cx + ax * size - size / 2, y = cy + ay * size - size / 2;
      const on = held.includes(id);
      const face = chunkyButton(ctx, x, y, size, size, { tone: on ? '#7fbd72' : '#f3ecdd', radius: size * 0.3, pressed: on });
      ctx.save();
      ctx.translate(x + size / 2, face.y + size / 2);
      ctx.rotate(rot);
      ctx.fillStyle = on ? '#ffffff' : '#344a3a';
      ctx.beginPath();
      ctx.moveTo(size * 0.16, 0);
      ctx.lineTo(-size * 0.1, -size * 0.17);
      ctx.lineTo(-size * 0.1, size * 0.17);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.hits.push({ id, x, y, w: size, h: size });
    }

    const bs = Math.min(96 * u, this.w * 0.26);
    const bx = this.w - bs - 20 * u, by = this.h - bs - 26 * u;
    const on = held.includes('drop');
    const face = chunkyButton(ctx, bx, by, bs, bs, { tone: on ? '#e3b06a' : '#f6d79a', radius: bs / 2, pressed: on });
    // a puffball on the button, so it says what it does without a word
    paintPuff(ctx, bx + bs * 0.18, face.y + bs * 0.1, bs * 0.64, FUSE, this.reach, (w, s) => this.font(w, s));
    this.hits.push({ id: 'drop', x: bx, y: by, w: bs, h: bs });
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#f3ecdd', ink = '#2d4a38'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: [...this.held.values()].includes(id) });
    ctx.fillStyle = ink;
    ctx.font = this.fontU('900', h > 40 * this.u() ? 15 : 12);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 18);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    const won = this.phase === 'won';
    ctx.fillStyle = 'rgba(8, 22, 26, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = 264 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 26 * u);
    ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, won ? '#8fd694' : '#f0b27a');
    band.addColorStop(1, won ? 'rgba(143,214,148,0)' : 'rgba(240,178,122,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, won ? T('The wood is quiet again', 'Het bos is weer stil') : T('All three naps used up', 'Alle drie de dutjes op'),
      this.w / 2, y + 50 * u, this.fontU('900', 19), '#123047');
    if (won) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStar(ctx, this.w / 2 + (i - 1) * 42 * u, y + 106 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
      ctx.fillStyle = 'rgba(18,48,71,0.72)';
      ctx.font = this.fontU('700', 12);
      ctx.fillText(this.knocks === 0
        ? T('Not knocked over once.', 'Geen enkele keer omvergelopen.')
        : T(`Knocked over ${this.knocks} time${this.knocks === 1 ? '' : 's'}.`, `${this.knocks} keer omvergelopen.`),
        this.w / 2, y + 150 * u, cw - 40 * u);
    } else {
      ctx.fillStyle = 'rgba(18,48,71,0.7)';
      ctx.font = this.fontU('700', 12.5);
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 116 * u, cw - 40 * u);
    }
    ctx.restore();
    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (won && this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next night', 'Volgende nacht'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All nights', 'Alle nachten'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#2b4b5e');
    bg.addColorStop(0.55, '#3b6350');
    bg.addColorStop(1, '#4a7546');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    heading(ctx, 'Stuifzwam', this.w / 2, 60 * u, this.fontU('900', 26), '#ffffff');
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = this.fontU('700', 12.5);
    ctx.fillText(T('Count the squares, then step away.', 'Tel de vakjes en stap dan weg.'), this.w / 2, 84 * u);

    const cols = this.w > 640 * u ? 4 : 2;
    const pad = 14 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.5;
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
      // a locked card shakes its head when tapped: the padlock alone answers nothing
      const shrug = this.denyCard === i ? Math.sin(this.t * 44) * 5 * u * (this.denyT / 0.4) : 0;
      ctx.save();
      ctx.translate(x + cw / 2 + shrug, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(6,24,20,0.4)';
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.roundRect(x, y, cw, chh, 18 * u);
      ctx.fill();
      ctx.restore();

      // a scrap of that night's board, with a puffball on it
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u);
      ctx.clip();
      const mini = miniBoard(L);
      const cell = (cw - 12 * u) / 7;
      paintBoard(ctx, { cols: 7, rows: Math.ceil(art / cell) + 1, tiles: mini.tiles.slice(0, 7 * 12), under: [] }, x + 6 * u, y + 6 * u, cell, L.seed);
      paintPuff(ctx, x + cw * 0.3, y + art * 0.3, cell, FUSE * 0.5, L.reach, (wt, s) => this.font(wt, s));
      paintHedgehog(ctx, x + cw * 0.66, y + art * 0.62, cell * 0.36, -1, 0, 0, this.t);
      if (L.moles > 0) paintMole(ctx, x + cw * 0.84, y + art * 0.3, cell * 0.32, -1, 0, 0, this.t);
      if (!open) {
        ctx.fillStyle = 'rgba(228, 238, 242, 0.84)';
        ctx.fillRect(x, y, cw, art + 12 * u);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.55)';
      ctx.beginPath();
      ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.fontU('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.68)';
      ctx.font = this.fontU('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 28 * u, cw - 28 * u);
      for (let s = 0; s < 3; s++) drawStar(ctx, x + 22 * u + s * 20 * u, y + art + 46 * u, 8 * u, s < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(0, -6 * u, 7 * u, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u);
        ctx.fill();
        ctx.stroke();
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
