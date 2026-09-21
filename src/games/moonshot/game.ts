/**
 * Moonshot - the ninth game in Bramblewood.
 *
 * A workshop with every part on the shelf and nothing locked, a grid you can put any of them
 * anywhere on, and a launch button you press when you decide the thing is finished. There are no
 * levels. What stops a child is not a gate, it is the rocket: too heavy and it sits there, too fat
 * and the air eats it, no engine under that tank and it is carrying a boulder.
 *
 * Three readouts say everything the physics is doing. Push against weight decides whether it goes
 * up at all. The sleekness bar decides how hard the air fights on the way. And one line at the
 * bottom names whatever is currently wrong, in the order a builder would notice it.
 *
 * The ladder at the end - birds, clouds, aeroplanes, the edge of the air, the Moon, Mars - hands
 * out nothing. It is a set of names for how far you got, the way pencil marks on a doorframe are
 * names for how tall you are.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { uiScale, safeArea } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { persist, save } from '../../util/storage';
import {
  bleedEdges, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor, heading,
  outlinedText, Particles, Shake, vignette,
} from '../../render/look';
import {
  airAt, buildProblem, canLift, canPlace, clash, cleanDesign, coastHeight, collapse, COLS, deadWeight, densityAt,
  gravityAt, GROUPS, isFlyable, kmLabel, LADDER, MAX_PARTS, nextRung, padThrust,
  padWeight, partById, partsIn, ROWS, rungFor, shapeHint, shapeOf, slipperiness, stagesByColumn,
  STARTER, stillAttached, topRow, totalMass,
  type Design, type Group, type Part, type Placed, type Stage,
} from './design';
import {
  designBounds, paintCloud, paintDesign, paintEarthBelow, paintFlame, paintGrain, paintPad,
  paintPart, paintStars, paintTower, skyTone,
} from './paint';
import { engineSound, rocket } from './rocketsfx';

type Ctx = CanvasRenderingContext2D;
type Phase = 'build' | 'count' | 'fly' | 'coast' | 'done';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (p: Part): string => (NL() ? p.nameNl : p.name);
const noteOf = (p: Part): string => (NL() ? p.noteNl : p.note);

interface Hit { id: string; x: number; y: number; w: number; h: number }

/** A stage that has been let go and is tumbling away below. */
interface Debris { y: number; vy: number; spin: number; a: number; parts: number[]; age: number }

/** One column's worth of burning: which stage it is on and how much is left in it. */
interface Burn { col: number; stages: Stage[]; idx: number; fuel: number }

/** A part on its way from somewhere to somewhere, under a finger. */
interface Drag {
  id: string;
  /** index in the design if it came off the rocket, -1 if it came off the shelf */
  from: number;
  x: number;
  y: number;
  moved: number;
  col: number;
  row: number;
  ok: boolean;
}

/** A place a tapped part could go, and whatever has to be lifted to make room for it. */
interface Spot { col: number; row: number; lift?: Set<number> }

/** The bands the build screen is cut into. */
interface Bands {
  wide: boolean;
  readTop: number; readH: number;
  gridTop: number; gridBottom: number;
  tabsY: number; tabsH: number;
  trayY: number; trayH: number;
  launchY: number; launchH: number;
}

export class Moonshot {
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

  private phase: Phase = 'build';
  private phaseT = 0;
  private hits: Hit[] = [];
  private held: string | null = null;
  private note = '';
  private noteT = 0;
  private idle = 0;

  // the workshop
  private design: Design = [];
  private tab: Group = 'tank';
  private drag: Drag | null = null;
  private history: Design[] = [];
  /** where the grid was last drawn, so a finger can be turned back into a cell */
  private cam = { ox: 0, oy: 0, unit: 24 };

  // the flight
  private burns: Burn[] = [];
  private dropped = new Set<number>();
  private debris: Debris[] = [];
  private fuel0 = 1;
  private alt = 0;
  private vUp = 0;
  private vSide = 0;
  private tilt = 0;
  private wobble = 0;
  private wind = 0;
  private steer = 0;
  private warp = 1;
  private topKm = 0;
  private shownKm = 0;
  /** the foot and the middle of what is still flying, eased so staging does not jolt the camera */
  private camRow = 0;
  private camCol = 4;
  private countdown = 0;
  private lastTick = 9;
  private result = 0;
  private earnedRung = 0;
  private fresh = false;

  private ps = new Particles();
  private shake = new Shake();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => this.cancelDrag());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    this.design = cleanDesign(save.moon?.design) ?? STARTER.map(p => ({ ...p }));
    (window as unknown as { __moon?: Moonshot }).__moon = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  debugState(): Record<string, unknown> {
    const sh = shapeOf(this.design);
    return {
      phase: this.phase,
      parts: this.design.length,
      design: this.design.map(p => `${p.id}@${p.col},${p.row}`),
      mass: Math.round(totalMass(this.design) * 10) / 10,
      thrust: Math.round(padThrust(this.design)),
      weight: Math.round(padWeight(this.design)),
      lifts: canLift(this.design),
      flyable: isFlyable(this.design),
      problem: buildProblem(this.design, false),
      dragArea: Math.round(sh.drag * 100) / 100,
      slip: Math.round(slipperiness(sh) * 100) / 100,
      stages: [...stagesByColumn(this.design)].map(([c, l]) => `${c}:${l.length}`),
      dead: deadWeight(this.design).length,
      tab: this.tab,
      best: this.best(),
      altKm: Math.round(this.alt / 100) / 10,
      vUp: Math.round(this.vUp),
      dropped: this.dropped.size,
      warp: this.warp,
      tilt: Math.round(this.tilt * 100) / 100,
      vSide: Math.round(this.vSide),
      topKm: this.topKm,
      result: this.result,
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- what is kept ----------

  private best(): number { return save.moon?.best ?? 0; }

  private remember(): void {
    save.moon = { best: this.best(), design: this.design.map(p => ({ ...p })) };
    persist();
  }

  private push(): void {
    this.history.push(this.design.map(p => ({ ...p })));
    if (this.history.length > 40) this.history.shift();
  }

  private undo(): void {
    const prev = this.history.pop();
    if (!prev) { rocket.blocked(); return; }
    this.design = prev;
    this.drag = null;
    rocket.clunk();
    this.remember();
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

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  /**
   * How many parts fit across the shelf, and therefore whether it needs a second row.
   *
   * Measured in real pixels rather than scaled ones, because what decides whether a part can be
   * hit is the width of a thumb, and a thumb is the same size on a tablet as on a phone.
   */
  private trayGrid(): { cols: number; rows: number } {
    const n = partsIn(this.tab).length;
    const fits = Math.max(3, Math.floor((this.w - 12 * this.u()) / 58));
    const rows = n > fits ? 2 : 1;
    return { cols: Math.ceil(n / rows), rows };
  }

  private bands(): Bands {
    const u = this.u();
    const wide = this.w > this.h * 1.3;
    const launchH = wide ? 44 * u : 50 * u;
    const launchY = this.h - launchH - 8 * u;
    const { rows } = this.trayGrid();
    const trayH = Math.min(rows === 2 ? 168 * u : 92 * u, this.h * (rows === 2 ? 0.32 : 0.19));
    const trayY = launchY - trayH - 6 * u;
    const tabsH = 28 * u;
    const tabsY = trayY - tabsH - 4 * u;
    // The readouts sit under the grid rather than over it, because the way back to Bramblewood
    // owns the top right corner and a number half hidden behind a link is worse than no number.
    const readH = wide ? 44 * u : 58 * u;
    const readTop = tabsY - readH - 2 * u;
    return {
      wide, readTop, readH,
      gridTop: 6 * u, gridBottom: readTop - 4 * u,
      tabsY, tabsH, trayY, trayH, launchY, launchH,
    };
  }

  /**
   * Where the grid sits on the screen.
   *
   * The view always frames the rocket plus exactly one column either side and one row above -
   * which is provably every cell a part could legally go in, since a part has to touch what is
   * already there. So nothing is ever placeable off-screen, and nobody has to pan or pinch.
   */
  private camera(b: Bands): { ox: number; oy: number; unit: number } {
    const u = this.u();
    const bd = designBounds(this.design);
    const c0 = Math.max(0, bd.c0 - 1), c1 = Math.min(COLS - 1, bd.c1 + 1);
    const cols = Math.max(3, c1 - c0 + 1);
    const rows = Math.max(5, Math.min(ROWS, bd.r1 + 1));
    const bw = this.w - 16 * u, bh = b.gridBottom - b.gridTop - 8 * u;
    const unit = clamp(Math.min(bw / cols, bh / rows), 9, 74 * u);
    const ox = this.w / 2 - ((c0 + c1 + 1) / 2) * unit;
    // the pad sits on the floor of the band; whatever room is left over is sky above the rocket
    const oy = b.gridBottom - 10 * u;
    return { ox, oy, unit };
  }

  /** Turn a point on the screen into the cell a part's foot would land on. */
  private cellAt(p: Vec, part: Part): { col: number; row: number } {
    const { ox, oy, unit } = this.cam;
    const col = Math.round((p.x - ox) / unit - 0.5);
    // the finger holds the middle of the part, so its foot is half its height lower
    const row = Math.round((oy - p.y) / unit - part.rows / 2);
    return { col: clamp(col, 0, COLS - 1), row: clamp(row, 0, ROWS - part.rows) };
  }

  // ---------- building ----------

  /** The lowest part sits on the pad, and anything left hanging in the air falls onto something. */
  private settle(): void {
    if (!this.design.length) return;
    const low = Math.min(...this.design.map(p => p.row));
    if (low > 0) for (const p of this.design) p.row -= low;
    collapse(this.design);
  }

  private place(id: string, col: number, row: number, from: number, joined = false): boolean {
    const spot: Placed = { id, col, row };
    if (!canPlace(this.design, spot, from)) return false;
    if (from < 0 && this.design.length >= MAX_PARTS) {
      this.say(T('That is as much rocket as the crane can hold.', 'Meer raket kan de kraan niet aan.'));
      rocket.blocked();
      return false;
    }
    // a tap that lifted the payload out of the way already pushed its undo step
    if (!joined) this.push();
    if (from >= 0) this.design[from] = spot;
    else this.design = [...this.design, spot];
    this.settle();
    rocket.clunk();
    this.remember();
    return true;
  }

  private removeAt(i: number): void {
    if (i < 0 || i >= this.design.length) return;
    this.push();
    this.design = this.design.filter((_, k) => k !== i);
    this.settle();
    rocket.clunk();
    this.remember();
  }

  /**
   * Where a tapped part goes.
   *
   * Dragging is exact and a tap is a guess, so the guess has to be the one a child means. An
   * engine goes underneath, because that is where engines live. A tank slides in under whatever
   * is riding on top, because the capsule belongs at the point. A booster or a fin goes on the
   * side with fewer of them, so tapping twice gives you a matched pair. And a capsule or a cone
   * goes at the very top, which is the only place for it.
   */
  private autoPlace(id: string): void {
    const part = partById(id);
    const spot: Spot | null = part.kind === 'fin' || part.kind === 'solid'
      ? this.sideSpot(id) : this.spineSpot(id);
    if (!spot) {
      this.say(T('No room for that. Drag it where you want it.', 'Daar is geen plek voor. Sleep hem waar je hem wilt.'));
      rocket.blocked();
      return;
    }
    const lift = spot.lift;
    if (lift) {
      this.push();
      this.design.forEach((p, i) => { if (lift.has(i)) p.row += part.rows; });
    }
    if (this.place(id, spot.col, spot.row, -1, !!lift)) this.say(`${nameOf(part)} - ${noteOf(part)}`);
    else if (lift) this.undo();
  }

  /** The tallest column: what a child thinks of as "the rocket". */
  private coreCol(): number {
    const cols = new Set(this.design.map(p => p.col));
    if (!cols.size) return Math.floor(COLS / 2);
    let best = Math.floor(COLS / 2), tall = -1;
    for (const c of cols) {
      const top = Math.max(...this.design.filter(p => p.col === c).map(p => topRow(p) + 1));
      if (top > tall || (top === tall && Math.abs(c - COLS / 2) < Math.abs(best - COLS / 2))) { best = c; tall = top; }
    }
    return best;
  }

  /** Somewhere in the main stack: under it for an engine, under the payload for anything else. */
  private spineSpot(id: string): Spot | null {
    const part = partById(id);
    const col = this.coreCol();
    const here = this.design
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.col === col)
      .sort((a, b) => a.p.row - b.p.row);
    if (!here.length) return canPlace(this.design, { id, col, row: 0 }) ? { col, row: 0 } : null;

    if (part.kind === 'engine') {
      // The first engine goes under everything, lifting the rocket to make room, because that is
      // where an engine lives. A second one is a second stage, so it goes in above the tanks the
      // first one is drinking from - which is exactly the move it is for.
      const bottom = partById(here[0].p.id).kind;
      if (bottom !== 'engine' && bottom !== 'solid') {
        const top = Math.max(...this.design.map(p => topRow(p) + 1));
        if (top + part.rows > ROWS) return null;
        return { col, row: 0, lift: new Set(this.design.map((_, i) => i)) };
      }
    }
    if (part.kind === 'pod' || part.kind === 'nose') {
      const row = here[here.length - 1].p.row + partById(here[here.length - 1].p.id).rows;
      return row + part.rows <= ROWS && canPlace(this.design, { id, col, row }) ? { col, row } : null;
    }
    // a tank or a collar slides in under the payload cap at the top of the column
    let cut = here.length;
    while (cut > 0) {
      const k = partById(here[cut - 1].p.id).kind;
      if (k === 'pod' || k === 'nose') cut--; else break;
    }
    if (cut === here.length) {
      const row = here[here.length - 1].p.row + partById(here[here.length - 1].p.id).rows;
      return row + part.rows <= ROWS && canPlace(this.design, { id, col, row }) ? { col, row } : null;
    }
    const row = here[cut].p.row;
    const lift = new Set(here.slice(cut).map(e => e.i));
    const top = Math.max(...here.slice(cut).map(e => topRow(e.p) + 1));
    if (top + part.rows > ROWS) return null;
    return { col, row, lift };
  }

  /**
   * Beside the rocket, on whichever side has fewer of these already and as low down as it will go.
   *
   * Never in the core column itself: a booster tapped onto the top of the main stack is not what
   * anybody meant by tapping a booster, and tapping twice has to give you a matched pair.
   */
  private sideSpot(id: string): Spot | null {
    const part = partById(id);
    const core = this.coreCol();
    const on = (s: number): number =>
      this.design.filter(p => p.id === id && Math.sign(p.col - core) === s).length;
    const prefer = on(-1) <= on(1) ? -1 : 1;
    let best: Spot | null = null;
    let bestKey = Infinity;
    for (let col = 0; col < COLS; col++) {
      if (col === core) continue;
      for (let row = 0; row + part.rows <= ROWS; row++) {
        if (!canPlace(this.design, { id, col, row })) continue;
        // as low as possible first, then the emptier side, then nearest the core
        const key = row * 100 + (Math.sign(col - core) === prefer ? 0 : 20) + Math.abs(col - core);
        if (key < bestKey) { bestKey = key; best = { col, row }; }
        break;
      }
    }
    return best;
  }

  private say(text: string, secs = 4): void { this.note = text; this.noteT = secs; }

  // ---------- flying ----------

  private launch(): void {
    if (!isFlyable(this.design)) {
      rocket.blocked();
      this.say(buildProblem(this.design, NL()) ?? T('It will not fly like that.', 'Zo gaat hij niet vliegen.'));
      this.shake.add(0.5);
      return;
    }
    this.burns = [...stagesByColumn(this.design)]
      .filter(([, stages]) => stages.length)
      .map(([col, stages]) => ({ col, stages, idx: 0, fuel: stages[0].fuel }));
    this.fuel0 = Math.max(0.001, this.design.reduce((f, p) => f + partById(p.id).fuel, 0));
    this.dropped = new Set();
    this.debris = [];
    this.alt = 0; this.vUp = 0; this.vSide = 0;
    this.tilt = 0; this.wobble = 0; this.wind = 0; this.steer = 0;
    this.warp = 1;
    this.topKm = 0; this.shownKm = 0;
    const bd0 = designBounds(this.design);
    this.camRow = bd0.r0; this.camCol = (bd0.c0 + bd0.c1 + 1) / 2;
    this.countdown = 3.2; this.lastTick = 9;
    this.result = 0; this.fresh = false;
    this.phase = 'count'; this.phaseT = 0;
    this.drag = null;
    this.ps.clear();
    this.remember();
  }

  /** The stage a column is burning right now, or nothing if it is finished. */
  private live(b: Burn): Stage | null { return b.idx < b.stages.length ? b.stages[b.idx] : null; }

  private thrustNow(): number {
    let n = 0;
    for (const b of this.burns) {
      const s = this.live(b);
      if (s && b.fuel > 0) n += s.thrust;
    }
    return n;
  }

  /** Where the push comes from now, in columns - a lopsided rocket turns. */
  private pushCentreNow(): number {
    let f = 0, x = 0;
    for (const b of this.burns) {
      const s = this.live(b);
      if (!s || b.fuel <= 0) continue;
      f += s.thrust;
      x += s.thrust * s.col;
    }
    return f > 0 ? x / f : this.massCentreNow();
  }

  private massCentreNow(): number {
    let m = 0, x = 0;
    this.design.forEach((p, i) => {
      if (this.dropped.has(i)) return;
      const w = partById(p.id).dry + this.fuelLeftIn(i);
      m += w;
      x += w * p.col;
    });
    return m > 0 ? x / m : COLS / 2;
  }

  /**
   * How much fuel is still in one part.
   *
   * A stage's fuel drains as one pool, so a tank's share of it is its share of that pool. Close
   * enough to move the centre of mass honestly, and nobody is going to check the plumbing.
   */
  private fuelLeftIn(i: number): number {
    const p = this.design[i];
    const part = partById(p.id);
    if (part.fuel <= 0) return 0;
    for (const b of this.burns) {
      if (b.col !== p.col) continue;
      for (let k = 0; k < b.stages.length; k++) {
        if (!b.stages[k].parts.includes(i)) continue;
        if (k < b.idx) return 0;
        if (k > b.idx) return part.fuel;
        return b.stages[k].fuel > 0 ? part.fuel * (b.fuel / b.stages[k].fuel) : 0;
      }
    }
    return part.fuel;
  }

  private liveMass(): number {
    let m = 0;
    this.design.forEach((p, i) => { if (!this.dropped.has(i)) m += partById(p.id).dry; });
    for (const b of this.burns) {
      m += Math.max(0, b.fuel);
      for (let k = b.idx + 1; k < b.stages.length; k++) m += b.stages[k].fuel;
    }
    return Math.max(0.05, m);
  }

  /** Let one column's spent stage go: it drops away and whatever is above it lights. */
  private dropStage(b: Burn): void {
    const s = this.live(b);
    if (!s) return;
    const parts = s.parts.filter(i => !this.dropped.has(i));
    for (const i of parts) this.dropped.add(i);
    if (parts.length) {
      this.debris.push({
        y: 0, vy: -this.vUp * 0.12 - 8, spin: (Math.random() - 0.5) * 2.2, a: 0, parts, age: 0,
      });
    }
    b.idx++;
    b.fuel = this.live(b)?.fuel ?? 0;
    if (this.live(b)) { rocket.stage(); this.shake.add(0.55); }
    this.shed();
  }

  /**
   * Let go of anything that is no longer bolted to what you are sending.
   *
   * Drop the core stage out from between two boosters that are still burning and those boosters
   * are attached to nothing any more. They used to carry on flying in formation beside the rest,
   * which looked exactly like the rocket coming apart in mid-air for no reason. Now they go, the
   * way they would.
   */
  private shed(): void {
    const keep = stillAttached(this.design, this.dropped);
    const loose: number[] = [];
    this.design.forEach((_, i) => { if (!this.dropped.has(i) && !keep.has(i)) loose.push(i); });
    if (!loose.length) return;
    for (const i of loose) this.dropped.add(i);
    let wasBurning = false;
    for (const b of this.burns) {
      if (!this.live(b)) continue;
      if (this.live(b)!.parts.some(i => loose.includes(i))) {
        if (b.fuel > 0) wasBurning = true;
        b.idx = b.stages.length;
        b.fuel = 0;
      }
    }
    // Say why. A piece that had fuel left going over the side needs explaining, or it just looks
    // like the rocket broke.
    this.say(wasBurning
      ? T('That went with the stage — the middle was empty first.', 'Dat ging mee met de trap: het middenstuk was eerder leeg.')
      : T('That piece was not attached to anything any more.', 'Dat stuk zat nergens meer aan vast.'), 3.6);
    this.debris.push({
      y: 0, vy: -this.vUp * 0.1 - 6, spin: (Math.random() - 0.5) * 1.8, a: 0, parts: loose, age: 0,
    });
  }

  private burning(): boolean { return this.burns.some(b => b.fuel > 0 && this.live(b)); }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.idle += dt;

    if (this.phase === 'count') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastTick && c > 0) { this.lastTick = c; rocket.tick(); }
      if (this.countdown <= 0) {
        this.phase = 'fly'; this.phaseT = 0; rocket.ignite(); this.shake.add(1);
        engineSound.start();
      }
      return;
    }
    if (this.phase === 'fly' || this.phase === 'coast') this.easeCamera(dt);
    if (this.phase === 'fly') {
      // Warping the burn must not coarsen the integration, or the rocket flies a different flight
      // at 2x than it does at 1x. Take the same small steps, just more of them per frame. And
      // falling back into thicker air with the clock at 4x would take the steering away.
      if (this.warp > 2 && airAt(this.alt) > 0.02) this.warp = 2;
      const steps = Math.max(1, Math.round(this.warp));
      for (let i = 0; i < steps && this.phase === 'fly'; i++) this.flyStep(dt);
      return;
    }
    if (this.phase === 'coast') {
      // the number climbs to wherever the speed was good for, and slows as it gets there
      const k = 1 - Math.pow(0.12, dt * this.warp);
      this.shownKm += (this.topKm - this.shownKm) * k;
      if (this.phaseT > 2.4 && (this.topKm === 0 || this.shownKm > this.topKm * 0.995)) this.finish();
    }
  }

  /**
   * Keep the camera on what is left of the rocket.
   *
   * A stage falling away takes several rows of rocket with it, and drawing the remainder at its
   * original grid position makes it leap up the screen at the exact moment a child is watching
   * the separation. So the frame follows the live parts, and eases rather than cuts.
   */
  private easeCamera(dt: number): void {
    const live = this.design.filter((_, i) => !this.dropped.has(i));
    if (!live.length) return;
    let r0 = Infinity, c0 = Infinity, c1 = -Infinity;
    for (const p of live) {
      r0 = Math.min(r0, p.row);
      c0 = Math.min(c0, p.col);
      c1 = Math.max(c1, p.col);
    }
    const k = 1 - Math.pow(0.02, dt);
    this.camRow += (r0 - this.camRow) * k;
    this.camCol += ((c0 + c1 + 1) / 2 - this.camCol) * k;
  }

  private flyStep(dt: number): void {
    const m = this.liveMass() * 1000;
    const g = gravityAt(this.alt);
    const air = airAt(this.alt);
    const thrust = this.thrustNow();

    // steering: the rocket leans the way you hold it, and the air fights the lean
    const fins = this.design.some((p, i) => partById(p.id).kind === 'fin' && !this.dropped.has(i));
    const authority = 0.9 + (1 - air) * 0.8;
    this.tilt = clamp(this.tilt + this.steer * authority * dt, -1.2, 1.2);
    // wind and a rocket's own wobble push it off; fins and thick air damp it
    this.wind += (Math.sin(this.t * 0.7) * 0.5 + Math.sin(this.t * 1.9 + 1.3) * 0.5) * dt * 0.35 * air;
    this.wind *= 1 - dt * 0.6;
    const damp = air * (fins ? 2.4 : 0.9);
    this.wobble += (this.wind - this.wobble) * dt * 2;
    this.tilt += this.wobble * dt;
    this.tilt -= this.tilt * damp * dt * 0.55;
    // and a rocket whose push is not under its weight turns all by itself, which is exactly what
    // the two little marks under it on the build screen were warning about
    if (thrust > 0) {
      this.tilt += clamp(this.pushCentreNow() - this.massCentreNow(), -2, 2) * 0.12 * dt;
    }

    let a = -g;
    let ax = 0;
    if (thrust > 0) {
      const acc = (thrust * 1000) / m;
      a += acc * Math.cos(this.tilt);
      ax += acc * Math.sin(this.tilt);
      for (const b of this.burns) {
        const s = this.live(b);
        if (s && b.fuel > 0) b.fuel = Math.max(0, b.fuel - s.burn * dt);
      }
      if (this.alt < 400) this.shake.add(dt * 1.2);
    }
    // the air pushes back, hard and low down, and how hard depends on what the rocket looks like:
    // how wide it is, how long it is for that width, and what is capping each column. Dropping a
    // pair of boosters makes the rocket slipperier the moment they go.
    const speed = Math.hypot(this.vUp, this.vSide);
    if (speed > 1) {
      const shape = shapeOf(this.design, this.dropped);
      const drag = 0.5 * densityAt(this.alt) * shape.drag * speed * speed / m;
      a -= drag * (this.vUp / speed);
      ax -= drag * (this.vSide / speed);
    }
    this.vUp += a * dt;
    this.vSide += ax * dt;
    this.alt = Math.max(0, this.alt + this.vUp * dt);
    if (this.alt <= 0 && this.vUp < 0) this.vUp = 0;

    for (const d of this.debris) { d.age += dt; d.vy -= 9 * dt; d.y += d.vy * dt; d.a += d.spin * dt; }
    this.debris = this.debris.filter(d => d.age < 6);

    engineSound.set(thrust > 0 ? 1 : 0, 1 - air);
    for (const b of this.burns) if (b.fuel <= 0 && this.live(b)) this.dropStage(b);

    if (!this.burning()) {
      // out of fuel: work out where that speed carries the rocket and let the number climb
      const up = Math.max(0, this.vUp);
      this.topKm = coastHeight(up, this.alt / 1000);
      const r = rungFor(up);
      this.result = up;
      this.earnedRung = r.index;
      if (!isFinite(this.topKm)) this.topKm = r.rung.km;
      rocket.burnout();
      engineSound.stop();
      this.phase = 'coast'; this.phaseT = 0;
      this.shownKm = this.alt / 1000;
    }
  }

  private finish(): void {
    const r = rungFor(this.result);
    this.earnedRung = r.index;
    if (r.index > this.best()) {
      save.moon = { best: r.index, design: this.design.map(p => ({ ...p })) };
      persist();
      this.fresh = true;
      rocket.record();
    } else {
      rocket.land();
    }
    this.phase = 'done'; this.phaseT = 0;
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    this.idle = 0;
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (!hit) { this.drag = null; return; }
    this.held = hit;
    if (hit.startsWith('tray:')) { this.startDrag(hit.slice(5), -1, p); return; }
    if (hit.startsWith('part:')) {
      const i = Number(hit.slice(5));
      if (this.design[i]) this.startDrag(this.design[i].id, i, p);
      return;
    }
    if (hit.startsWith('tab:')) { this.tab = hit.slice(4) as Group; rocket.tap(); return; }
    if (hit === 'launch') { this.launch(); return; }
    if (hit === 'undo') { this.undo(); return; }
    if (hit === 'clear') {
      if (!this.design.length) { rocket.blocked(); return; }
      this.push();
      this.design = [];
      this.remember();
      rocket.clunk();
      return;
    }
    if (hit === 'left') { this.steer = -1; return; }
    if (hit === 'right') { this.steer = 1; return; }
    if (hit === 'warp') {
      // While there is air there is something to steer, so the burn goes no faster than 2x. Once
      // the air is gone there is nothing to do but wait out a long nuclear burn, so it goes to 4x
      // like the coast does.
      const cap = this.phase === 'fly' && airAt(this.alt) > 0.02 ? 2 : 4;
      this.warp = this.warp >= cap ? 1 : this.warp * 2;
      rocket.tap();
      return;
    }
    if (hit === 'again') { engineSound.stop(); this.phase = 'build'; this.phaseT = 0; rocket.tap(); return; }
  }

  private startDrag(id: string, from: number, p: Vec): void {
    const cell = this.cellAt(p, partById(id));
    this.drag = {
      id, from, x: p.x, y: p.y, moved: 0, col: cell.col, row: cell.row,
      ok: canPlace(this.design, { id, col: cell.col, row: cell.row }, from),
    };
    rocket.tap();
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const p = this.at(e);
    d.moved += Math.hypot(p.x - d.x, p.y - d.y);
    d.x = p.x; d.y = p.y;
    const cell = this.cellAt(p, partById(d.id));
    d.col = cell.col; d.row = cell.row;
    d.ok = canPlace(this.design, { id: d.id, col: cell.col, row: cell.row }, d.from);
  }

  private onUp(e: PointerEvent): void {
    this.held = null;
    this.steer = 0;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const p = this.at(e);
    const b = this.bands();

    // Barely moved: a tap. From the shelf that means "put it on top of the rocket"; on the rocket
    // it means "tell me what this is", which is how a child finds out what a vacuum engine is for.
    if (d.moved < 9) {
      if (d.from < 0) this.autoPlace(d.id);
      else this.say(`${nameOf(partById(d.id))} - ${noteOf(partById(d.id))}`);
      return;
    }
    // let go over the shelf: that is the bin
    if (p.y > b.tabsY) {
      if (d.from >= 0) this.removeAt(d.from);
      return;
    }
    if (!this.place(d.id, d.col, d.row, d.from)) {
      rocket.blocked();
      this.say(this.taken(d) ? T('Something is already there.', 'Daar staat al iets.')
        : T('It has to touch the rest of the rocket.', 'Hij moet de rest van de raket raken.'));
    }
  }

  /** Was that spot refused because it is occupied, rather than because it touches nothing? */
  private taken(d: Drag): boolean {
    const spot: Placed = { id: d.id, col: d.col, row: d.row };
    return this.design.some((q, i) => i !== d.from && clash(spot, q));
  }

  private cancelDrag(): void { this.drag = null; this.held = null; this.steer = 0; }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (!down) { if (k === 'ArrowLeft' || k === 'ArrowRight') this.steer = 0; return; }
    unlockAudio();
    this.idle = 0;
    if (k === 'ArrowLeft') this.steer = -1;
    else if (k === 'ArrowRight') this.steer = 1;
    else if (k === 'z' && this.phase === 'build') this.undo();
    else if (k === ' ') { if (this.phase === 'build') this.launch(); else if (this.phase === 'done') this.phase = 'build'; }
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    this.hits = [];
    if (this.phase === 'build') { this.drawBuild(); return; }
    this.drawFlight();
  }

  // ---------- the workshop ----------

  private drawBuild(): void {
    const ctx = this.ctx, u = this.u();
    const b = this.bands();
    this.cam = this.camera(b);

    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#16223a');
    sky.addColorStop(0.55, '#263854');
    sky.addColorStop(1, '#3d5170');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawGrid(b);
    this.drawReadouts(b);
    this.drawTabs(b);
    this.drawTray(b);
    this.drawBottom(b);
    this.drawGhost();

    if (this.noteT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 11.5);
      ctx.textAlign = 'center';
      const lines = wrap(ctx, this.note, this.w - 72 * u);
      const nh = (lines.length * 17 + 12) * u;
      const ny = b.gridBottom - nh - 2 * u;
      glassPanel(ctx, 24 * u, ny, this.w - 48 * u, nh, 12 * u, 0.92);
      ctx.fillStyle = '#12233b';
      lines.forEach((ln, i) => ctx.fillText(ln, this.w / 2, ny + 19 * u + i * 17 * u, this.w - 72 * u));
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  /** The hangar floor, the cells a held part could go in, and the rocket standing on it. */
  private drawGrid(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const { ox, oy, unit } = this.cam;

    ctx.fillStyle = 'rgba(10, 16, 28, 0.42)';
    ctx.fillRect(0, oy, this.w, b.gridBottom - oy + 4 * u);
    ctx.fillStyle = 'rgba(180, 210, 255, 0.18)';
    ctx.fillRect(0, oy, this.w, Math.max(1.5, 2 * u));

    // Every cell a held part could legally go in. Only while one is actually in the air: a grid
    // full of dotted squares at rest is noise, and a child who is not holding anything has no use
    // for it. Holding one, it is the whole answer to "where can this go".
    const d = this.drag;
    const ignore = d && d.from >= 0 ? new Set([d.from]) : undefined;
    if (d) {
      const part = partById(d.id);
      const bd = designBounds(this.design);
      const c0 = Math.max(0, bd.c0 - 1), c1 = Math.min(COLS - 1, bd.c1 + 1);
      const rTop = Math.min(ROWS - part.rows, bd.r1 + 1);
      for (let col = c0; col <= c1; col++) {
        for (let row = 0; row <= rTop; row++) {
          if (!canPlace(this.design, { id: d.id, col, row }, d.from)) continue;
          const on = col === d.col && row === d.row;
          ctx.fillStyle = on ? 'rgba(142,232,173,0.34)' : 'rgba(180,210,255,0.1)';
          ctx.beginPath();
          ctx.roundRect(
            ox + col * unit + unit * 0.07, oy - (row + part.rows) * unit + unit * 0.07,
            unit * 0.86, part.rows * unit - unit * 0.14, unit * 0.16,
          );
          ctx.fill();
        }
      }
    }

    const bounds = designBounds(this.design);
    const boxes = paintDesign(ctx, this.design, ox, oy, unit, this.t, {
      dropped: ignore, centre: (bounds.c0 + bounds.c1) / 2,
    });
    for (const box of boxes) {
      // a fin sticks out well past its column, so what you grab it by is its column, not its span
      const col = this.design[box.i].col;
      this.hits.push({
        id: `part:${box.i}`,
        x: Math.max(box.x, ox + col * unit),
        y: box.y,
        w: Math.min(box.w, unit),
        h: box.h,
      });
    }

    // Where the weight sits and where the push comes from. When the arrow is not under the line,
    // the rocket leans all by itself once it is off the pad.
    if (this.design.length > 1 && padThrust(this.design) > 0) {
      const mc = ox + (this.massCentreBuild() + 0.5) * unit;
      const pc = ox + (this.pushCentreBuild() + 0.5) * unit;
      const y = oy + 5 * u;
      const bad = Math.abs(pc - mc) > unit * 0.3;
      ctx.strokeStyle = 'rgba(226,238,252,0.6)';
      ctx.lineWidth = Math.max(1.4, 2 * u);
      ctx.beginPath(); ctx.moveTo(mc, y); ctx.lineTo(mc, y + 10 * u); ctx.stroke();
      ctx.fillStyle = bad ? '#f0b27a' : '#8ee8ad';
      ctx.beginPath();
      ctx.moveTo(pc, y + 2 * u); ctx.lineTo(pc - 5 * u, y + 11 * u); ctx.lineTo(pc + 5 * u, y + 11 * u);
      ctx.closePath(); ctx.fill();
    }
  }

  private massCentreBuild(): number {
    let m = 0, x = 0;
    for (const p of this.design) {
      const part = partById(p.id);
      const w = part.dry + part.fuel;
      m += w; x += w * p.col;
    }
    return m > 0 ? x / m : COLS / 2;
  }

  private pushCentreBuild(): number {
    let f = 0, x = 0;
    for (const [col, list] of stagesByColumn(this.design)) {
      if (!list.length) continue;
      f += list[0].thrust; x += list[0].thrust * col;
    }
    return f > 0 ? x / f : this.massCentreBuild();
  }

  /** Push against weight, how slippery it is, and what is wrong with it: four thin rows. */
  private drawReadouts(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const push = padThrust(this.design), weight = padWeight(this.design);
    const ok = canLift(this.design);
    const sh = shapeOf(this.design);
    const y = b.readTop;
    // in landscape the two bars share the row, with a gap wide enough that the weight reading
    // does not look like it belongs to the one beside it
    const half = b.wide ? (this.w - 56 * u) / 2 : this.w - 20 * u;
    const barW = Math.min(half, 420 * u);
    const bx = b.wide ? 10 * u : this.w / 2 - barW / 2;

    // a tug of war: the push pulling from the left, the weight from the right, a notch in the
    // middle, and whoever is past the notch wins
    const bh = 13 * u;
    const barY = y + 11 * u;
    const share = push + weight > 0 ? push / (push + weight) : 0;
    ctx.fillStyle = 'rgba(8, 16, 30, 0.55)';
    ctx.beginPath(); ctx.roundRect(bx, barY, barW, bh, bh / 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, barY, barW, bh, bh / 2); ctx.clip();
    ctx.fillStyle = ok ? '#8ee8ad' : '#f0b27a';
    ctx.fillRect(bx, barY, barW * clamp(share, 0, 1), bh);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(bx + barW * 0.5 - u, barY - 3 * u, Math.max(1.5, 2 * u), bh + 6 * u);

    ctx.font = this.font('900', 10.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = ok ? '#8ee8ad' : 'rgba(226,238,252,0.8)';
    ctx.fillText(`${T('PUSH', 'DUW')} ${Math.round(push)}`, bx, y + 7 * u, barW * 0.45);
    ctx.textAlign = 'right';
    ctx.fillStyle = ok ? 'rgba(226,238,252,0.8)' : '#f0b27a';
    ctx.fillText(`${T('WEIGHT', 'GEWICHT')} ${Math.round(weight)}`, bx + barW, y + 7 * u, barW * 0.45);

    // and how slippery it is, on its own thinner bar with the label alongside
    const sx = b.wide ? this.w - 10 * u - barW : bx;
    const sy = b.wide ? barY + 2 * u : y + 32 * u;
    ctx.font = this.font('900', 8.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(226,238,252,0.6)';
    const label = T('AIR', 'LUCHT');
    ctx.fillText(label, sx, sy + 8 * u);
    const lw = Math.min(46 * u, ctx.measureText(label).width + 8 * u);
    const slipW = barW - lw;
    const slip = slipperiness(sh);
    ctx.fillStyle = 'rgba(8, 16, 30, 0.5)';
    ctx.beginPath(); ctx.roundRect(sx + lw, sy, slipW, 9 * u, 4.5 * u); ctx.fill();
    const grad = ctx.createLinearGradient(sx + lw, 0, sx + lw + slipW, 0);
    grad.addColorStop(0, '#f0b27a');
    grad.addColorStop(0.55, '#ffd86b');
    grad.addColorStop(1, '#8ee8ad');
    ctx.save();
    ctx.beginPath(); ctx.roundRect(sx + lw, sy, Math.max(9 * u, slipW * slip), 9 * u, 4.5 * u); ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(sx + lw, sy, slipW, 9 * u);
    ctx.restore();

    // one line: whatever is wrong with it, or what the air makes of the shape
    const trouble = this.design.length ? buildProblem(this.design, NL()) : null;
    ctx.textAlign = 'center';
    ctx.font = this.font('800', 11);
    ctx.fillStyle = trouble ? 'rgba(240, 178, 122, 0.95)' : 'rgba(226,238,252,0.66)';
    ctx.fillText(
      this.design.length ? (trouble ?? shapeHint(sh, NL()))
        : T('Drag a part onto the pad to start.', 'Sleep een onderdeel op het platform om te beginnen.'),
      this.w / 2, y + b.readH - 4 * u, this.w - 20 * u,
    );
    ctx.textAlign = 'left';
  }

  private drawTabs(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const gap = 4 * u;
    const cw = (this.w - 12 * u - gap * (GROUPS.length - 1)) / GROUPS.length;
    GROUPS.forEach((g, i) => {
      const x = 6 * u + i * (cw + gap);
      const on = this.tab === g.id;
      ctx.fillStyle = on ? 'rgba(142, 232, 173, 0.9)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.roundRect(x, b.tabsY, cw, b.tabsH, b.tabsH * 0.36); ctx.fill();
      ctx.fillStyle = on ? '#0b2a1c' : 'rgba(226,238,252,0.8)';
      ctx.font = this.font('900', 10.5);
      ctx.textAlign = 'center';
      ctx.fillText(NL() ? g.nameNl : g.name, x + cw / 2, b.tabsY + b.tabsH * 0.66, cw - 6 * u);
      this.hits.push({ id: `tab:${g.id}`, x, y: b.tabsY, w: cw, h: b.tabsH });
    });
    ctx.textAlign = 'left';
  }

  private drawTray(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const binning = !!this.drag && this.drag.from >= 0 && this.drag.moved >= 9;
    ctx.fillStyle = binning ? 'rgba(62, 18, 26, 0.88)' : 'rgba(8, 14, 26, 0.78)';
    ctx.fillRect(0, b.trayY, this.w, b.trayH);
    ctx.fillStyle = binning ? 'rgba(255, 150, 140, 0.45)' : 'rgba(180, 210, 255, 0.12)';
    ctx.fillRect(0, b.trayY, this.w, Math.max(1.2, 1.5 * u));

    if (binning) {
      ctx.fillStyle = 'rgba(255, 196, 186, 0.95)';
      ctx.font = this.font('900', 13);
      ctx.textAlign = 'center';
      ctx.fillText(T('Let go here to take it off', 'Hier loslaten om hem eraf te halen'),
        this.w / 2, b.trayY + b.trayH / 2 + 4 * u, this.w - 24 * u);
      ctx.textAlign = 'left';
      return;
    }

    const list = partsIn(this.tab);
    const { cols, rows } = this.trayGrid();
    const rowH = b.trayH / rows;
    const cell = clamp((this.w - 12 * u) / cols, 56, 96 * u);
    list.forEach((p, k) => {
      const row = Math.floor(k / cols), col = k % cols;
      const inRow = Math.min(cols, list.length - row * cols);
      const x = Math.max(6 * u, (this.w - inRow * cell) / 2) + col * cell;
      const ry = b.trayY + row * rowH;
      const cy = ry + rowH * 0.38;
      const pu = Math.min((cell - 18 * u) / Math.max(1, p.w), (rowH * 0.44) / Math.max(1, p.rows));
      paintPart(ctx, p, x + cell / 2, cy + (p.rows * pu) / 2, pu, this.t);
      ctx.fillStyle = 'rgba(226,238,252,0.92)';
      ctx.font = this.font('800', 8.5);
      ctx.textAlign = 'center';
      ctx.fillText(nameOf(p), x + cell / 2, ry + rowH - 17 * u, cell - 4 * u);
      ctx.fillStyle = '#ffd86b';
      ctx.font = this.font('900', 9.5);
      ctx.fillText(this.tagFor(p), x + cell / 2, ry + rowH - 5 * u, cell - 4 * u);
      this.hits.push({ id: `tray:${p.id}`, x, y: ry, w: cell, h: rowH });
    });
    ctx.textAlign = 'left';
  }

  /** The one number that matters about a part, on its shelf label. */
  private tagFor(p: Part): string {
    if (p.fuel > 0 && p.burn > 0) return `${Math.round(p.burn * p.exhaust)} · ${p.fuel}t`;
    if (p.kind === 'tank') return `${p.fuel} t`;
    if (p.kind === 'engine') return `${Math.round(p.burn * p.exhaust)}`;
    return `${p.dry} t`;
  }

  private drawBottom(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const bh = b.launchH, by = b.launchY;
    const side = 50 * u;
    const bw = Math.min(230 * u, this.w - side * 2 - 28 * u);
    const bx = this.w / 2 - bw / 2;
    const ready = isFlyable(this.design);
    const face = chunkyButton(ctx, bx, by, bw, bh, { tone: ready ? '#65d48c' : '#6d7787', pressed: this.held === 'launch' });
    ctx.fillStyle = ready ? '#0b2a1c' : 'rgba(255,255,255,0.7)';
    ctx.font = this.font('900', 16);
    ctx.textAlign = 'center';
    ctx.fillText(T('Launch', 'Lanceren'), bx + bw / 2, face.y + bh * 0.64, bw - 18 * u);
    this.hits.push({ id: 'launch', x: bx, y: by, w: bw, h: bh });

    ctx.font = this.font('900', 11);
    const uf = chunkyButton(ctx, 8 * u, by, side, bh, { tone: '#46516a', pressed: this.held === 'undo' });
    ctx.fillStyle = this.history.length ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.4)';
    ctx.fillText(T('Undo', 'Terug'), 8 * u + side / 2, uf.y + bh * 0.62, side - 6 * u);
    this.hits.push({ id: 'undo', x: 8 * u, y: by, w: side, h: bh });

    const cf = chunkyButton(ctx, this.w - side - 8 * u, by, side, bh, { tone: '#46516a', pressed: this.held === 'clear' });
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(T('Empty', 'Leeg'), this.w - side / 2 - 8 * u, cf.y + bh * 0.62, side - 6 * u);
    this.hits.push({ id: 'clear', x: this.w - side - 8 * u, y: by, w: side, h: bh });
    ctx.textAlign = 'left';
  }

  /** The part under the finger, drawn where the finger is rather than where it came from. */
  private drawGhost(): void {
    const d = this.drag;
    if (!d || d.moved < 9) return;
    const ctx = this.ctx;
    const part = partById(d.id);
    const unit = this.cam.unit;
    ctx.save();
    ctx.globalAlpha = d.ok ? 0.95 : 0.5;
    paintPart(ctx, part, d.x, d.y + (part.rows * unit) / 2, unit, this.t);
    if (!d.ok) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff8f7a';
      ctx.lineWidth = Math.max(2, unit * 0.09);
      ctx.lineCap = 'round';
      const r = unit * 0.4;
      ctx.beginPath();
      ctx.moveTo(d.x - r, d.y - r); ctx.lineTo(d.x + r, d.y + r);
      ctx.moveTo(d.x + r, d.y - r); ctx.lineTo(d.x - r, d.y + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the flight ----------

  private drawFlight(): void {
    const ctx = this.ctx, u = this.u();
    const tone = skyTone(this.alt);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, tone.top);
    g.addColorStop(1, tone.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    paintStars(ctx, this.w, this.h, tone.stars, this.alt * 0.02);
    paintEarthBelow(ctx, this.w, this.h, this.alt, u);

    ctx.save();
    this.shake.apply(ctx, 7 * u);

    const bd = designBounds(this.design);
    const wide = Math.max(3, bd.c1 - bd.c0 + 1);
    const tall = Math.max(4, bd.r1 - bd.r0);
    const unit = clamp(Math.min(this.h / (tall + 7), this.w / (wide + 3)), 6, 26 * u);

    // The rocket keeps its place on the screen and the ground falls away under it, which is what
    // climbing looks like from a camera that is following you.
    const cx = this.w * 0.5 - this.vSide * 0.0004 * this.w;
    const ry = this.h * 0.64;
    const gy = ry + unit * 0.2 + this.alt * (this.h / 2200);
    if (gy < this.h + 60 * u) {
      paintPad(ctx, this.w, gy, unit);
      paintTower(ctx, this.w * 0.5 - unit * 5.4, gy, unit, unit * 12);
    }

    // clouds going past: a handful of layers at real heights, gone by ten kilometres
    for (let k = 0; k < 5; k++) {
      const band = 900 + k * 1600;
      const d = this.alt - band;
      const yy = this.h * 0.5 + d * 0.1;
      if (yy > -150 && yy < this.h + 150) {
        const fade = clamp(1 - Math.abs(d) / 2600, 0, 1);
        paintCloud(ctx, ((k * 173) % 100) / 100 * this.w, yy, this.w * (0.12 + (k % 3) * 0.035), fade * 0.8, k * 7);
      }
    }

    ctx.save();
    ctx.translate(cx, ry);
    ctx.rotate(this.tilt);
    const ox = -this.camCol * unit;
    const oy = this.camRow * unit;
    const spread = 1 - airAt(this.alt);

    // every engine that is actually burning throws its own flame, so a rocket wearing four
    // boosters lights up like one
    if (this.phase === 'fly') {
      for (const b of this.burns) {
        const s = this.live(b);
        if (!s || b.fuel <= 0) continue;
        const e = this.design[s.engine];
        const part = partById(e.id);
        paintFlame(ctx, ox + (e.col + 0.5) * unit, oy - e.row * unit, part.w * unit * 0.5, 1, spread, this.t + e.col * 0.3);
      }
    }
    paintDesign(ctx, this.design, ox, oy, unit, this.t, { dropped: this.dropped, centre: (bd.c0 + bd.c1) / 2 });

    // The air, when it is pushing hard. This is the same dynamic pressure the drag term above uses,
    // so the streaks and the hot nose are not decoration: they are what is slowing the rocket down,
    // and they thin out on their own as the air does.
    const spd = Math.hypot(this.vUp, this.vSide);
    const qk = Math.sqrt(clamp(0.5 * densityAt(this.alt) * spd * spd / 300000, 0, 1));
    if (qk > 0.08) {
      const shape = shapeOf(this.design, this.dropped);
      const half = shape.width * unit * 0.5;
      const nose = oy - shape.height * unit;
      ctx.save();
      ctx.globalAlpha = qk * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2 * u;
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const off = half * (1.1 + ((i * 37) % 10) / 22);
        const phase = (this.t * (1.3 + qk * 2.4) + i * 0.317) % 1;
        const sy = nose + (oy - nose + unit) * phase;
        const len = unit * (0.7 + qk * 1.5);
        ctx.beginPath(); ctx.moveTo(side * off, sy); ctx.lineTo(side * off, sy + len); ctx.stroke();
      }
      ctx.restore();
      const glow = ctx.createRadialGradient(0, nose, 0, 0, nose, half * 2.6);
      glow.addColorStop(0, `rgba(255, 222, 164, ${0.55 * qk})`);
      glow.addColorStop(0.5, `rgba(255, 158, 88, ${0.22 * qk})`);
      glow.addColorStop(1, 'rgba(255, 130, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, nose, half * 2.6, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // spent stages tumbling away
    for (const d of this.debris) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - d.age / 6, 0, 1) * 0.9;
      ctx.translate(cx + Math.sin(d.a) * 20 * u, ry - d.y * 0.6);
      ctx.rotate(d.a);
      for (const i of d.parts) paintPart(ctx, partById(this.design[i].id), 0, 0, unit * 0.9, this.t);
      ctx.restore();
    }
    ctx.restore();

    this.ps.draw(ctx);
    vignette(ctx, this.w, this.h, 0.22);
    paintGrain(ctx, this.w, this.h);
    this.drawFlightChrome();
  }

  private drawFlightChrome(): void {
    const ctx = this.ctx, u = this.u();

    // Height and speed on the left: the way back to Bramblewood owns the top right corner, and a
    // number sitting under a link nobody can read is worse than no number.
    const shown = this.phase === 'coast' || this.phase === 'done' ? this.shownKm : this.alt / 1000;
    ctx.textAlign = 'left';
    outlinedText(ctx, kmLabel(shown, NL()), 14 * u, 36 * u, this.font('900', 20), '#ffffff', 'rgba(8,16,30,0.6)', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = this.font('800', 10);
    ctx.fillText(T('height', 'hoogte'), 14 * u, 50 * u);
    outlinedText(ctx, `${Math.round(Math.hypot(this.vUp, this.vSide))} m/s`, 14 * u, 76 * u, this.font('900', 15), '#ffffff', 'rgba(8,16,30,0.6)', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = this.font('800', 10);
    ctx.fillText(T('speed', 'snelheid'), 14 * u, 90 * u);

    // the fuel left in the whole rocket, as a column down the left edge
    const left = this.burns.reduce(
      (f, b) => f + Math.max(0, b.fuel) + b.stages.slice(b.idx + 1).reduce((a, s) => a + s.fuel, 0), 0,
    );
    const frac = clamp(left / this.fuel0, 0, 1);
    const bx = 22 * u, by = 110 * u, bh = Math.min(240 * u, this.h * 0.3), bw = 11 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = this.font('800', 10);
    ctx.fillText(T('fuel', 'brandstof'), 14 * u, by - 6 * u);
    ctx.fillStyle = 'rgba(8, 16, 30, 0.45)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bw / 2); ctx.fill();
    ctx.fillStyle = frac > 0.25 ? '#ffd86b' : '#ff9a6b';
    ctx.beginPath(); ctx.roundRect(bx, by + bh * (1 - frac), bw, bh * frac, bw / 2); ctx.fill();

    if (this.phase === 'count') {
      const c = Math.ceil(this.countdown);
      const pop = 1 - (this.countdown - Math.floor(this.countdown));
      ctx.save();
      ctx.globalAlpha = clamp(1.4 - pop, 0, 1);
      ctx.textAlign = 'center';
      outlinedText(ctx, String(Math.max(1, c)), this.w / 2, this.h * 0.32, this.font('900', 64), '#ffffff', 'rgba(8,16,30,0.5)', 6);
      ctx.restore();
    }

    if (this.noteT > 0 && this.phase !== 'done') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 11.5);
      ctx.textAlign = 'center';
      const lines = wrap(ctx, this.note, this.w - 84 * u);
      const nh = (lines.length * 17 + 12) * u;
      glassPanel(ctx, 30 * u, this.h * 0.2, this.w - 60 * u, nh, 12 * u, 0.9);
      ctx.fillStyle = '#12233b';
      lines.forEach((ln, i) => ctx.fillText(ln, this.w / 2, this.h * 0.2 + 19 * u + i * 17 * u, this.w - 84 * u));
      ctx.restore();
      ctx.textAlign = 'left';
    }

    if (this.phase === 'fly') this.drawSteering();
    if (this.phase === 'coast') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = this.font('900', 14);
      ctx.fillText(T('Coasting…', 'Uitzweven…'), this.w / 2, this.h - 34 * u, this.w - 40 * u);
      this.warpButton();
    }
    if (this.phase === 'done') this.drawResult();
    ctx.textAlign = 'left';
  }

  /** Two thumbs and a bubble level, which is all the steering a rocket needs. */
  private drawSteering(): void {
    const ctx = this.ctx, u = this.u();
    const size = Math.min(76 * u, this.w * 0.2);
    const y = this.h - size - 20 * u;
    for (const [id, x, rot] of [['left', 16 * u, Math.PI], ['right', this.w - size - 16 * u, 0]] as const) {
      const on = this.held === id || (id === 'left' ? this.steer < 0 : this.steer > 0);
      const face = chunkyButton(ctx, x, y, size, size, { tone: on ? '#8ee8ad' : '#e9eef6', radius: size * 0.32, pressed: on });
      ctx.save();
      ctx.translate(x + size / 2, face.y + size / 2);
      ctx.rotate(rot);
      ctx.fillStyle = on ? '#0b2a1c' : '#25405e';
      ctx.beginPath();
      ctx.moveTo(size * 0.16, 0);
      ctx.lineTo(-size * 0.1, -size * 0.17);
      ctx.lineTo(-size * 0.1, size * 0.17);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.hits.push({ id, x, y, w: size, h: size });
    }
    // how far off straight up the rocket is leaning
    const lx = this.w / 2, ly = this.h - 42 * u, lw = Math.min(150 * u, this.w * 0.4);
    ctx.fillStyle = 'rgba(8, 16, 30, 0.42)';
    ctx.beginPath(); ctx.roundRect(lx - lw / 2, ly - 7 * u, lw, 14 * u, 7 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(lx - u, ly - 10 * u, 2 * u, 20 * u);
    const k = clamp(this.tilt / 1.2, -1, 1);
    ctx.fillStyle = Math.abs(k) < 0.25 ? '#8ee8ad' : '#ffd86b';
    ctx.beginPath(); ctx.arc(lx + k * (lw / 2 - 8 * u), ly, 6 * u, 0, TAU); ctx.fill();
    this.warpButton();

    // the hand, if nothing has been touched and the rocket is drifting
    if (this.idle > 2 && Math.abs(this.tilt) > 0.22) {
      const want = this.tilt > 0 ? 'left' : 'right';
      const b = this.hits.find(h => h.id === want);
      if (b) {
        const press = clamp(Math.sin((this.t % 1.4) / 1.4 * Math.PI) * 1.8, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4 * press;
        handCursor(ctx, b.x + b.w * 0.62, b.y + b.h * 0.5, 15 * u, press);
        ctx.restore();
      }
    }
  }

  private warpButton(): void {
    const ctx = this.ctx, u = this.u();
    const w = 52 * u, h = 34 * u, x = this.w - w - 14 * u, y = 62 * u;
    const face = chunkyButton(ctx, x, y, w, h, { tone: this.warp > 1 ? '#8ee8ad' : '#e9eef6', pressed: this.held === 'warp' });
    ctx.fillStyle = this.warp > 1 ? '#0b2a1c' : '#25405e';
    ctx.font = this.font('900', 13);
    ctx.textAlign = 'center';
    ctx.fillText(`${this.warp}×`, x + w / 2, face.y + h * 0.66, w - 8 * u);
    this.hits.push({ id: 'warp', x, y, w, h });
  }

  /** The card at the end: how far, what it is called, and whether it beat the last one. */
  private drawResult(): void {
    const ctx = this.ctx, u = this.u();
    const r = LADDER[this.earnedRung];
    ctx.fillStyle = 'rgba(6, 12, 24, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.phaseT * 2.2, 0, 1));
    const cw = Math.min(340 * u, this.w - 32 * u);
    const ch = 262 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, NL() ? r.nameNl : r.name, this.w / 2, y + 46 * u, this.font('900', 20), '#12233b');
    ctx.fillStyle = 'rgba(18,35,59,0.72)';
    ctx.font = this.font('800', 13);
    ctx.fillText(kmLabel(this.topKm, NL()), this.w / 2, y + 72 * u, cw - 40 * u);
    ctx.fillStyle = 'rgba(18,35,59,0.55)';
    ctx.font = this.font('700', 11.5);
    ctx.fillText(T(`${Math.round(this.result)} m/s when the fuel ran out`, `${Math.round(this.result)} m/s toen de brandstof op was`),
      this.w / 2, y + 92 * u, cw - 40 * u);
    for (let i = 0; i < 5; i++) {
      const shown = clamp(this.phaseT * 2.4 - i * 0.2, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 2) * 30 * u, y + 126 * u, 13 * u, i < r.stars, i < r.stars ? easeOutBack(shown) : 1);
    }
    ctx.font = this.font('900', 12);
    if (this.fresh) {
      ctx.fillStyle = '#2f6d46';
      ctx.fillText(T('Your best yet', 'Je beste tot nu toe'), this.w / 2, y + 162 * u, cw - 40 * u);
    } else {
      ctx.fillStyle = 'rgba(18,35,59,0.5)';
      const b = LADDER[this.best()];
      ctx.fillText(T(`Best so far: ${b.name}`, `Beste tot nu toe: ${b.nameNl}`), this.w / 2, y + 162 * u, cw - 40 * u);
    }
    const nxt = nextRung(this.earnedRung);
    if (nxt) {
      ctx.fillStyle = 'rgba(18,35,59,0.55)';
      ctx.font = this.font('700', 11);
      ctx.fillText(T(`Next up: ${nxt.name}, at ${nxt.speed} m/s`, `Hierna: ${nxt.nameNl}, bij ${nxt.speed} m/s`),
        this.w / 2, y + 182 * u, cw - 36 * u);
    }
    // the button grows with the card, so it is drawn inside the same transform
    const bw = Math.min(240 * u, cw - 28 * u), bh = 48 * u;
    const by = y + ch - 62 * u;
    const face = chunkyButton(ctx, this.w / 2 - bw / 2, by, bw, bh, { tone: '#65d48c', pressed: this.held === 'again' });
    ctx.fillStyle = '#0b2a1c';
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.fillText(T('To the workshop', 'Naar de werkplaats'), this.w / 2, face.y + bh * 0.63, bw - 20 * u);
    ctx.restore();
    this.hits.push({ id: 'again', x: this.w / 2 - bw / 2, y: by, w: bw, h: bh });
  }
}

/** Break a line to fit a width, so a part's note never runs off its card. */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
