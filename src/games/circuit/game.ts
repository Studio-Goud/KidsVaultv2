/**
 * Stroomkring - the twelfth game in Braambos, and Moonshot's nearest relation.
 *
 * A bench with a grid on it, a shelf of real parts, and a circuit that is solved forty times a
 * second whether anybody is watching or not. You drag a battery and a bulb onto the board, draw a
 * line of wire between them with your finger, and the current either goes round or it does not.
 * When it does, the bulb lights as brightly as the sums say it should. When it does not, one line
 * under the board says where the trouble is and points at the part it is in.
 *
 * There are ten puzzles and none of them is a gate: the last one is the open bench, and it can be
 * opened at any time from the list. What the puzzles do is name a thing worth finding out - two
 * bulbs that share a current and go dim, two that each get their own and do not, a switch, a
 * doorbell, a fuse, a diode that only works one way round, and a relay, which is the first time a
 * child meets a circuit whose job is to control another circuit.
 *
 * All the physics lives in `sim.ts` and all the drawing in `paint.ts`. This file is the bench: what
 * is where on the screen, what a finger does, and what the game says about it.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { uiScale, safeArea } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { persist, save } from '../../util/storage';
import {
  bleedEdges, chunkyButton, drawStar, glassPanel, grainOver, handCursor, hexA,
  Particles, Shake, vignette,
} from '../../render/look';
import {
  advance, BATTERY_CHARGE, battVolts, canPlace, cellsOf, chargeFrac, cleanCircuit, COLS, faultLine,
  isSolved, layWire, marksOf, MAX_PARTS, partAt, PUZZLES, renew, ROWS, solve, specOf, startBoard,
  type Board, type Kind, type PartState, type Placed, type Puzzle, type Sim,
} from './sim';
import { centreOf, paintFlow, paintPart, paintWire, wireArms } from './paint';
import { bench, buzzHum, coilHum, motorHum } from './sfx';
import { Coach, type Beat } from '../../platform/coach';

type Ctx = CanvasRenderingContext2D;
interface Rect { x: number; y: number; w: number; h: number }

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (id: Kind): string => (NL() ? specOf(id).nameNl : specOf(id).name);
const noteOf = (id: Kind): string => (NL() ? specOf(id).noteNl : specOf(id).note);
/** A number the way a Dutch child writes it: with a comma. */
const num = (x: number, places: number): string => {
  const s = x.toFixed(places);
  return NL() ? s.replace('.', ',') : s;
};

interface Hit { id: string; x: number; y: number; w: number; h: number }

/**
 * What a part that the solver has not caught up with yet is doing, which is nothing.
 *
 * The board is solved forty times a second, so for up to twenty-five milliseconds after a part is
 * put down there is a part with no answer against its name. It reads as switched off rather than
 * as a crash.
 */
const IDLE: PartState = { i: 0, v: 0, power: 0, duty: 0, on: false };

/** A part on its way from the shelf or from somewhere else on the board. */
interface Drag {
  id: Kind;
  /** where it came from on the board, or -1 for the shelf */
  from: number;
  x: number;
  y: number;
  moved: number;
  col: number;
  row: number;
  rot: number;
  ok: boolean;
}

/** A line of wire being drawn under a finger. */
interface Line { last: [number, number] | null; laid: number }

/**
 * Where everything is.
 *
 * Two shapes, because a phone held upright and a phone held sideways are different rooms. Upright,
 * the shelf is a wide drawer along the bottom. Sideways, it is a column down the right, which is
 * the only way a board that is half as tall gets any bigger.
 */
interface Bands {
  wide: boolean;
  chip: Rect;
  goal: Rect;
  /** the bench panel: a reading strip along its top, the grid in the middle, one line along the foot */
  panel: Rect;
  headH: number;
  footH: number;
  tray: Rect;
  trayDown: boolean;
  bar: Rect;
  /** how big one cell of the grid came out */
  unit: number;
}

export class Circuit {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private st = 0;
  private sb = 0;
  private t = 0;

  private puzzle = 0;
  /** one board per puzzle, kept for as long as the game is open */
  private boards: Board[] = PUZZLES.map(p => startBoard(p));
  /** what has been seen to happen on each board, which is what a puzzle asks for */
  private seen: Array<Set<string>> = PUZZLES.map(() => new Set<string>());
  private sim: Sim;
  private since = 0;
  private flow = 0;
  /** where each motor's rotor has got to */
  private spin = new WeakMap<Placed, number>();

  private hits: Hit[] = [];
  private held: string | null = null;
  private drag: Drag | null = null;
  private line: Line | null = null;
  private pressed = -1;
  private picking = false;
  private page = 0;
  private note = '';
  private noteT = 0;
  private idle = 0;
  private coach = new Coach();
  private teach = false;
  private history: Board[] = [];
  private cheer = 0;
  /** which of the bench's open challenges the goal card is up to */
  private extra = -1;
  private cheerOpen = false;
  private lastLit = false;
  private cam = { ox: 0, oy: 0, unit: 30 };
  /** how wide the numbered chip came out, so the goal card knows where to start beside it */
  private chipW = 0;

  private ps = new Particles();
  private shake = new Shake();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
    window.addEventListener('keydown', e => this.onKey(e));

    const slice = save.circuit;
    const kept = cleanCircuit(slice?.bench);
    if (kept && kept.length) this.boards[PUZZLES.length - 1] = kept;
    this.puzzle = clamp(Math.round(slice?.puzzle ?? 0), 0, PUZZLES.length - 1);
    this.sim = solve(this.board());
    (window as unknown as { __circuit?: Circuit }).__circuit = this;
    // the bench has to have been laid out once before the coach can point at anything on it, so
    // the lesson waits for the first frame rather than starting in the constructor
    this.teach = this.puzzle === 0 && !save.taught.includes('circuit');

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

  // ---------- the state of things ----------

  private board(): Board { return this.boards[this.puzzle]; }
  private partState(i: number): PartState { return this.sim.parts[i] ?? IDLE; }
  private quiz(): Puzzle { return PUZZLES[this.puzzle]; }
  private solvedIds(): string[] { return save.circuit?.solved ?? []; }
  private isDone(i: number): boolean { return this.solvedIds().includes(PUZZLES[i].id); }

  /** One step back means closing the list if it is open, and otherwise opening it. */
  canBack(): boolean { return !this.picking; }
  back(): void { this.picking = true; this.cheerOpen = false; bench.tap(); }

  debugState(): Record<string, unknown> {
    const b = this.board();
    const q = this.quiz();
    return {
      puzzle: this.puzzle,
      puzzleId: q.id,
      goal: NL() ? q.goalNl : q.goal,
      parts: b.length,
      board: b.map(p => `${p.id}@${p.col},${p.row}r${p.rot}${p.on ? '+on' : ''}${p.blown ? '+blown' : ''}${p.id === 'wire' ? `l${p.link ?? 0}` : ''}`),
      fault: this.sim.fault ? `${this.sim.fault.kind}@${this.sim.fault.at}` : null,
      faultLine: this.sim.fault ? faultLine(this.sim.fault, false) : null,
      duty: b.map((p, i) => Math.round(this.partState(i).duty * 100) / 100),
      amps: Math.round(this.sim.drawn * 1000) / 1000,
      short: this.sim.short,
      charge: b.filter(p => p.id === 'battery').map(p => Math.round(chargeFrac(p) * 100)),
      marks: [...this.seen[this.puzzle]].sort(),
      needs: q.needs,
      done: isSolved(q, this.seen[this.puzzle]) || this.isDone(this.puzzle),
      solved: this.solvedIds(),
      picking: this.picking,
      cheer: this.cheerOpen,
      note: this.noteT > 0 ? this.note : '',
      grid: { ...this.cam, cols: COLS, rows: ROWS },
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  private remember(): void {
    save.circuit = {
      solved: this.solvedIds(),
      puzzle: this.puzzle,
      bench: this.boards[PUZZLES.length - 1].map(p => ({ ...p })),
    };
    persist();
  }

  private markSolved(id: string): void {
    const list = this.solvedIds();
    if (list.includes(id)) return;
    save.circuit = {
      solved: [...list, id],
      puzzle: this.puzzle,
      bench: this.boards[PUZZLES.length - 1].map(p => ({ ...p })),
    };
    persist();
  }

  private push(): void {
    this.history.push(this.board().map(p => ({ ...p })));
    if (this.history.length > 40) this.history.shift();
  }

  private undo(): void {
    const prev = this.history.pop();
    if (!prev) { bench.blocked(); return; }
    this.boards[this.puzzle] = prev;
    this.drag = null;
    this.line = null;
    bench.clunk();
    this.remember();
  }

  private say(text: string, secs = 4): void { this.note = text; this.noteT = secs; }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
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
   * Where everything goes.
   *
   * The panel is worked out from the grid rather than the other way round: the cells are made as
   * big as the room allows, and then the bench is drawn exactly around them. A frame that hugged
   * nothing left a hand's width of empty board on every side, which is the one thing that makes a
   * workbench look like a screenshot.
   */
  private bands(): Bands {
    const u = this.u();
    const wide = this.w > this.h * 1.25;
    const n = this.quiz().tray.length;
    const inset = 8 * u;
    const headH = 28 * u, footH = 28 * u;
    // the corner the way home and the way back live in, which nothing else may go under. The two
    // round buttons are a fixed forty-six across and sit ten from the top and the right, so the
    // room they take is the same however big the rest of the interface is drawn.
    const corner = 116;
    const cornerH = 62;

    const chip = wide
      ? { x: 8 * u, y: 4 * u, w: Math.min(this.w * 0.28, 160 * u), h: 38 * u }
      : { x: 8 * u, y: 4 * u, w: Math.min(this.w * 0.56, 168 * u), h: 42 * u };
    // sideways the goal card stops short of the corner; upright it runs the whole width, so it
    // starts below the buttons instead - otherwise its first line reads out from under them
    const goal = wide
      ? { x: chip.x + this.chipW + 6 * u, y: chip.y, w: 0, h: chip.h }
      : { x: 8 * u, y: Math.max(chip.y + chip.h + 3 * u, cornerH), w: this.w - 16 * u, h: 34 * u };
    if (wide) goal.w = Math.max(60 * u, this.w - corner - goal.x);
    const top = (wide ? chip.y + chip.h : goal.y + goal.h) + 6 * u;

    let tray: Rect;
    let bar: Rect;
    let availW: number;
    let availH: number;
    if (wide) {
      const trayW = clamp(this.w * 0.15, 96 * u, 130 * u);
      const barH = 42 * u;
      // the shelf is a column down the right, which is the side the two round buttons are on
      const trayY = Math.max(top, cornerH);
      tray = { x: this.w - trayW - 6 * u, y: trayY, w: trayW, h: this.h - trayY - 8 * u };
      const barW = Math.min(tray.x - 16 * u, 520 * u);
      bar = { x: 8 * u + (tray.x - 16 * u - barW) / 2, y: this.h - barH - 8 * u, w: barW, h: barH };
      availW = tray.x - 16 * u;
      availH = bar.y - 8 * u - top;
    } else {
      const barH = 48 * u;
      bar = { x: 8 * u, y: this.h - barH - 8 * u, w: this.w - 16 * u, h: barH };
      const rows = n > 7 ? 2 : 1;
      const room = bar.y - 8 * u - top;
      // The bench is nine cells across, so on a tall phone its height is decided by the width and
      // there is room left over underneath it. That room used to sit there as a band of nothing
      // between the bench and the shelf; the shelf takes it now, which makes the parts bigger to
      // pick up - the thing a child's finger actually needs.
      const benchH = ((availWGuess: number): number => {
        const uu = clamp(Math.min((availWGuess - inset * 2) / COLS, (room - headH - footH - inset * 2) / ROWS), 14, 72 * u);
        return ROWS * uu + headH + footH + inset * 2;
      })(this.w - 16 * u);
      const spare = Math.max(0, room - benchH - 18 * u);
      const trayH = clamp(room * 0.28 + spare * 0.5, rows === 2 ? 140 * u : 92 * u, rows === 2 ? 260 * u : 200 * u);
      tray = { x: 0, y: bar.y - trayH - 8 * u, w: this.w, h: trayH };
      availW = this.w - 16 * u;
      availH = tray.y - 8 * u - top;
    }

    // the cells first, then a bench cut to fit them
    const unit = clamp(Math.min((availW - inset * 2) / COLS, (availH - headH - footH - inset * 2) / ROWS), 14, 72 * u);
    const panelW = Math.min(availW, Math.max(COLS * unit + inset * 2, Math.min(availW, 250 * u)));
    const panelH = Math.min(availH, ROWS * unit + headH + footH + inset * 2);
    const panel = {
      x: wide ? 8 * u + (availW - panelW) / 2 : this.w / 2 - panelW / 2,
      // the bench sits in the middle of what room it has: nine cells across means its height is
      // settled by the width, and pinning it to the top left the leftover as one hole above the
      // shelf rather than as a margin at either end
      y: top + Math.max(0, (availH - panelH) / 2),
      w: panelW, h: panelH,
    };
    return { wide, chip, goal, panel, headH, footH, tray, trayDown: wide, bar, unit };
  }

  /** Where the grid sits inside the bench panel. */
  private camera(b: Bands): { ox: number; oy: number; unit: number } {
    const u = this.u();
    return {
      ox: b.panel.x + b.panel.w / 2 - (COLS * b.unit) / 2,
      oy: b.panel.y + b.headH + 8 * u,
      unit: b.unit,
    };
  }

  private cellAt(p: Vec): { col: number; row: number } | null {
    const { ox, oy, unit } = this.cam;
    const col = Math.floor((p.x - ox) / unit);
    const row = Math.floor((p.y - oy) / unit);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  /** How the shelf is cut up, whichever way round the phone is. */
  private trayGrid(b: Bands): { cols: number; rows: number; per: number; pages: number; page: number; cell: number; rowH: number; offX: number; offY: number } {
    const u = this.u();
    const n = this.quiz().tray.length;
    const pad = 4 * u;
    // room kept clear at both ends for the page arrows, whether or not there is a second page,
    // so the shelf does not shuffle sideways the moment one more part is put on it
    const arrow = b.trayDown ? 0 : 30 * u;
    const vGap = b.trayDown ? 48 * u : 0;
    const alongW = b.tray.w - pad * 2 - arrow * 2;
    const alongH = b.tray.h - pad * 2 - vGap * 2;
    const colsMax = Math.max(1, Math.floor(alongW / (50 * u)));
    const rowsFit = Math.max(1, Math.min(b.trayDown ? 6 : 2, Math.floor(alongH / (54 * u))));
    // a shelf with three things on it puts them in three columns, not in the first three of six,
    // and it does not keep an empty second row open underneath them
    const rows = Math.max(1, Math.min(rowsFit, Math.ceil(n / colsMax)));
    let cols = Math.max(1, Math.min(colsMax, Math.ceil(n / rows)));
    const pages = Math.max(1, Math.ceil(n / Math.max(1, cols * rows)));
    // a shelf that needs a second page splits the parts evenly over the two rather than cramming
    // the first full and leaving two things rattling about on the second
    const even = Math.max(1, Math.min(colsMax, Math.ceil(n / (rows * pages))));
    if (even * rows >= Math.ceil(n / pages)) cols = even;
    const per = Math.max(1, cols * rows);
    // a cell no bigger than a hand, and the block of them centred in what room there is
    const cell = Math.min(alongW / cols, 132 * u);
    const rowH = Math.min(alongH / rows, 122 * u);
    return {
      cols, rows, per, pages, page: clamp(this.page, 0, pages - 1), cell, rowH,
      // the parts sit at the top of the shelf; what room is left over collects underneath them,
      // where it reads as the edge of the shelf rather than as a hole above the parts
      offX: (alongW - cols * cell) / 2, offY: Math.min((alongH - rows * rowH) / 2, 8 * u),
    };
  }

  // ---------- building ----------

  /**
   * Which way up a part wants to go where it has been dropped.
   *
   * A part lands pointing whichever way has something to join onto: drop a bulb between two ends of
   * a line running up and down and it stands up by itself. Only if neither axis has anything does
   * it keep the way it was, so nothing ever turns round for no reason.
   */
  private bestRot(id: Kind, col: number, row: number, rot: number): number {
    if (specOf(id).len !== 1) return rot % 2;
    const b = this.board();
    const reach = (dc: number, dr: number): boolean => {
      const i = partAt(b, col + dc, row + dr);
      if (i < 0) return false;
      if (b[i].id !== 'wire') return true;
      return wireArms(b, i).includes(dc === 1 ? 3 : dc === -1 ? 1 : dr === 1 ? 0 : 2);
    };
    const across = (reach(-1, 0) ? 1 : 0) + (reach(1, 0) ? 1 : 0);
    const down = (reach(0, -1) ? 1 : 0) + (reach(0, 1) ? 1 : 0);
    if (across > down) return rot % 2 === 0 ? rot : (rot + 1) % 4;
    if (down > across) return rot % 2 === 1 ? rot : (rot + 1) % 4;
    return rot;
  }

  private place(id: Kind, col: number, row: number, rot: number, from: number): boolean {
    const b = this.board();
    const spot: Placed = { id, col, row, rot };
    if (id === 'battery') spot.charge = BATTERY_CHARGE;
    if (!canPlace(b, spot, from)) return false;
    if (from < 0 && b.length >= MAX_PARTS) {
      this.say(T('That is as much as this bench will hold.', 'Meer past er niet op deze werkbank.'));
      bench.blocked();
      return false;
    }
    this.push();
    if (from >= 0) {
      const old = b[from];
      if (old.charge !== undefined) spot.charge = old.charge;
      if (old.on) spot.on = old.on;
      if (old.blown) spot.blown = old.blown;
      if (old.link !== undefined) spot.link = old.link;
      b[from] = spot;
    } else b.push(spot);
    bench.clunk();
    this.remember();
    return true;
  }

  private removeAt(i: number): void {
    const b = this.board();
    if (i < 0 || i >= b.length) return;
    this.push();
    this.boards[this.puzzle] = b.filter((_, k) => k !== i);
    bench.clunk();
    this.remember();
  }

  /** A tap on a part does whatever that part does. */
  private tapPart(i: number): void {
    const b = this.board();
    const p = b[i];
    if (!p) return;
    if (p.id === 'wire') { this.removeAt(i); return; }
    if (p.id === 'switch') {
      this.push();
      p.on = !p.on;
      bench.click(!!p.on);
      this.remember();
      return;
    }
    if (p.id === 'button') return;                      // held, not toggled
    const turned: Placed = { ...p, rot: (p.rot + 1) % (specOf(p.id).len === 2 ? 2 : 4) };
    if (!canPlace(b, turned, i)) {
      bench.blocked();
      this.say(T('No room to turn it there.', 'Daar kan hij niet draaien.'));
      return;
    }
    this.push();
    b[i] = turned;
    bench.click(true);
    this.say(specOf(p.id).polar
      ? T(`${nameOf(p.id)} turned. ${noteOf(p.id)}`, `${nameOf(p.id)} gedraaid. ${noteOf(p.id)}`)
      : `${nameOf(p.id)} — ${noteOf(p.id)}`);
    this.remember();
  }

  /** Reach the next cell of a drawn line, one square at a time even if the finger jumped. */
  private drawTo(col: number, row: number): void {
    const l = this.line;
    if (!l) return;
    const b = this.board();
    if (!l.last) {
      const before = b.length;
      layWire(b, col, row);
      if (b.length > before) bench.draw(l.laid++);
      l.last = [col, row];
      return;
    }
    let guard = 0;
    while ((l.last[0] !== col || l.last[1] !== row) && guard++ < 24) {
      const dc = Math.sign(col - l.last[0]), dr = Math.sign(row - l.last[1]);
      const step: [number, number] = Math.abs(col - l.last[0]) >= Math.abs(row - l.last[1])
        ? [l.last[0] + dc, l.last[1]]
        : [l.last[0], l.last[1] + dr];
      const before = b.length;
      const joined = layWire(b, step[0], step[1], l.last);
      if (b.length > before) bench.draw(l.laid++);
      else if (joined) l.laid++;
      l.last = step;
      if (!joined && partAt(b, step[0], step[1]) < 0) break;
    }
  }

  // ---------- the clock ----------

  private update(dt: number): void {
    this.idle += dt;
    if (this.teach && this.cam.unit > 0) { this.teach = false; this.coach.start(this.coachScript(), false); }
    this.coach.update(dt);
    // a child who has sat and looked at it for a while has lost the thread, not lost interest
    if (!this.coach.busy) { this.coach.trouble('idle', dt); this.coach.offer(this.stuckHint()); }
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cheer = clamp(this.cheer + (this.cheerOpen ? dt * 3.5 : -dt * 3.5), 0, 1);

    // the board is solved on its own clock rather than every frame, because nothing on it changes
    // faster than this and the beads carry the motion in between
    this.since += dt;
    if (this.since >= 1 / 40) {
      const b = this.board();
      this.sim = solve(b);
      const tick = advance(b, this.sim, this.since);
      if (tick.blew.length) {
        bench.blow();
        this.shake.add(0.5);
        for (const i of tick.blew) {
          const c = centreOf(b[i], this.cam.ox, this.cam.oy, this.cam.unit);
          this.ps.spawn('spark', c.x, c.y, 14, { colour: '#ffd86b', speed: 130, size: 5 });
        }
        this.say(T('The fuse melted. Everything behind it is safe.',
          'De zekering is gesmolten. Alles erachter is heel gebleven.'), 5);
      }
      if (tick.wentFlat) {
        bench.flat();
        this.say(T('The battery is empty. Tap the battery button for a new one.',
          'De batterij is leeg. Tik op de batterijknop voor een nieuwe.'), 5);
      }
      this.watch();
      this.since = 0;
    }

    // motors keep turning between solves, at the speed the current gives them
    const b = this.board();
    b.forEach((p, i) => {
      if (p.id !== 'motor') return;
      this.spin.set(p, (this.spin.get(p) ?? 0) + this.partState(i).i * 9 * dt);
    });
    this.flow += dt;
    this.hum();
  }

  /** What the board has been seen to do, and whether that finishes the puzzle. */
  private watch(): void {
    const b = this.board();
    const set = this.seen[this.puzzle];
    const before = set.size;
    for (const m of marksOf(b, this.sim)) set.add(m);
    const lit = b.some((p, i) => p.id === 'bulb' && this.partState(i).duty > 0.25);
    if (lit && !this.lastLit) {
      bench.glow();
      const k = b.findIndex((p, i) => p.id === 'bulb' && this.partState(i).duty > 0.25);
      const c = centreOf(b[k], this.cam.ox, this.cam.oy, this.cam.unit);
      this.ps.spawn('spark', c.x, c.y, 7, { colour: '#ffe9a8', speed: 70, size: this.cam.unit * 0.1, max: 0.45 });
    }
    this.lastLit = lit;
    const q = this.quiz();
    if (set.size !== before && isSolved(q, set) && !this.isDone(this.puzzle)) {
      this.markSolved(q.id);
      this.cheerOpen = true;
      bench.solved();
      const cb = this.bands();
      this.ps.spawn('spark', this.cardMid(cb), this.cardTop(cb, 140 * this.u()) + 20 * this.u(), 24,
        { colour: '#8ee8ad', speed: 170, size: 6, max: 1.1 });
    }
  }

  /** The three sounds that are held rather than struck, set from what the solver says. */
  private hum(): void {
    let motor = 0, buzz = 0, coil = 0;
    this.board().forEach((p, i) => {
      const s = this.partState(i);
      if (p.id === 'motor') motor = Math.max(motor, Math.abs(s.duty));
      if (p.id === 'buzzer') buzz = Math.max(buzz, s.duty);
      if (p.id === 'relay' && s.on) coil = Math.max(coil, 0.5);
    });
    motorHum.set(motor);
    buzzHum.set(buzz);
    coilHum.set(coil);
  }

  // ---------- the finger ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
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
    // while the hand is still demonstrating, a tap means "yes, I have seen it" and skips ahead;
    // once it has handed over, the tap is the child's own and goes to the game as usual
    if (this.coach.busy && !this.coach.listening) { if (this.coach.did()) this.taught(); return; }
    if (this.coach.listening) { if (this.coach.did()) this.taught(); }
    const p = this.at(e);
    const hit = this.hitAt(p);
    this.held = hit;
    if (!hit) { this.cancel(); return; }

    if (hit === 'chip' || hit === 'closepick') {
      this.picking = hit === 'chip';
      // the list and the bench have different things to press, and the old list of them is stale
      // the instant the screen changes - a second tap before the next frame must hit nothing
      this.hits = [];
      bench.tap();
      return;
    }
    if (hit.startsWith('pick:')) { this.goTo(Number(hit.slice(5))); return; }
    if (hit === 'goal') {
      const q = this.quiz();
      const more = q.extras ?? [];
      // the bench has nothing to prove, so what its card offers is things worth trying, one per tap
      this.extra = more.length ? (this.extra + 1) % (more.length + 1) : -1;
      const line = this.extra <= 0 ? (NL() ? q.hintNl : q.hint) : (NL() ? more[this.extra - 1][1] : more[this.extra - 1][0]);
      this.say(this.extra > 0 ? `${T('Try this:', 'Probeer dit:')} ${line}` : line, 8);
      bench.tap();
      return;
    }
    if (hit === 'next') { this.goTo(Math.min(PUZZLES.length - 1, this.puzzle + 1)); return; }
    if (hit === 'stay') { this.cheerOpen = false; bench.tap(); return; }
    if (hit === 'undo') { this.undo(); return; }
    if (hit === 'reset') {
      this.push();
      this.boards[this.puzzle] = startBoard(this.quiz());
      bench.clunk();
      this.remember();
      return;
    }
    if (hit === 'renew') {
      this.push();
      renew(this.board());
      bench.click(true);
      this.say(T('Fresh batteries, and a new thread in the fuse.',
        'Nieuwe batterijen, en een nieuw draadje in de zekering.'));
      this.remember();
      return;
    }
    if (hit.startsWith('page:')) {
      const g = this.trayGrid(this.bands());
      this.page = clamp(g.page + Number(hit.slice(5)), 0, g.pages - 1);
      bench.tap();
      return;
    }
    if (hit.startsWith('tray:')) {
      const id = hit.slice(5) as Kind;
      if (id === 'wire') { this.push(); this.line = { last: null, laid: 0 }; bench.tap(); return; }
      const cell = this.cellAt(p);
      this.drag = {
        id, from: -1, x: p.x, y: p.y, moved: 0,
        col: cell?.col ?? 0, row: cell?.row ?? 0, rot: 0, ok: false,
      };
      bench.tap();
      return;
    }
    if (hit.startsWith('part:')) {
      const i = Number(hit.slice(5));
      const b = this.board();
      const part = b[i];
      if (!part) return;
      this.pressed = i;
      if (part.id === 'wire') { this.push(); this.line = { last: [part.col, part.row], laid: 0 }; return; }
      if (part.id === 'button') { part.on = true; bench.click(true); }
      const cell = this.cellAt(p) ?? { col: part.col, row: part.row };
      this.drag = { id: part.id, from: i, x: p.x, y: p.y, moved: 0, col: cell.col, row: cell.row, rot: part.rot, ok: true };
      return;
    }
    if (hit === 'board') {
      const cell = this.cellAt(p);
      if (cell) { this.push(); this.line = { last: null, laid: 0 }; this.drawTo(cell.col, cell.row); }
      return;
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.at(e);
    if (this.line) {
      const cell = this.cellAt(p);
      if (cell) this.drawTo(cell.col, cell.row);
      return;
    }
    const d = this.drag;
    if (!d) return;
    d.moved += Math.hypot(p.x - d.x, p.y - d.y);
    d.x = p.x; d.y = p.y;
    // a button that is being dragged is not being pressed
    if (d.moved >= 9 && d.from >= 0 && this.board()[d.from]?.id === 'button') this.board()[d.from].on = false;
    const cell = this.cellAt(p);
    if (!cell) { d.ok = false; return; }
    d.col = cell.col; d.row = cell.row;
    d.rot = this.bestRot(d.id, cell.col, cell.row, d.rot);
    d.ok = canPlace(this.board(), { id: d.id, col: cell.col, row: cell.row, rot: d.rot }, d.from);
  }

  private onUp(e: PointerEvent): void {
    const p = this.at(e);
    const b = this.bands();
    const line = this.line;
    const d = this.drag;
    const pressed = this.pressed;
    this.held = null;
    this.line = null;
    this.drag = null;
    this.pressed = -1;

    if (line) {
      const step = this.history.pop();
      if (!line.laid) {
        if (pressed >= 0 && this.board()[pressed]?.id === 'wire') {
          if (step) this.history.push(step);
          this.tapPart(pressed);
        }
      } else {
        if (step) this.history.push(step);
        bench.clunk();
        this.remember();
      }
      return;
    }
    if (!d) return;

    const part = d.from >= 0 ? this.board()[d.from] : null;
    if (part && part.id === 'button' && d.moved < 9) { part.on = false; bench.click(false); return; }

    if (d.moved < 9) {
      if (d.from >= 0) { this.tapPart(d.from); return; }
      this.say(`${nameOf(d.id)} — ${noteOf(d.id)}`, 5);
      bench.tap();
      return;
    }
    // let go over the shelf: that is the bin
    const overTray = p.x >= b.tray.x && p.x <= b.tray.x + b.tray.w && p.y >= b.tray.y && p.y <= b.tray.y + b.tray.h;
    if (overTray) {
      if (d.from >= 0) this.removeAt(d.from);
      return;
    }
    if (!this.cellAt(p)) return;
    if (!this.place(d.id, d.col, d.row, d.rot, d.from)) {
      bench.blocked();
      this.say(T('Something is already there.', 'Daar ligt al iets.'));
    }
  }

  private cancel(): void {
    if (this.drag && this.drag.from >= 0) {
      const p = this.board()[this.drag.from];
      if (p && p.id === 'button') p.on = false;
    }
    this.drag = null;
    this.line = null;
    this.held = null;
    this.pressed = -1;
  }

  /** Never teach the same game twice. */
  private taught(): void {
    if (!save.taught.includes('circuit')) { save.taught.push('circuit'); persist(); }
  }

  private goTo(i: number): void {
    this.extra = -1;
    this.puzzle = clamp(i, 0, PUZZLES.length - 1);
    this.picking = false;
    this.hits = [];
    this.cheerOpen = false;
    this.page = 0;
    this.history = [];
    this.sim = solve(this.board());
    // the very first puzzle shows itself off once, and only once, ever
    if (this.puzzle === 0) this.coach.start(this.coachScript(), save.taught.includes('circuit'));
    bench.tap();
    this.remember();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'z') this.undo();
    else if (e.key === 'Escape') this.picking = false;
  }

  // ---------- drawing ----------

  /**
   * The first minute, without a word of explaining.
   *
   * A child who has never seen a circuit does not know that the orange things are wire or that a
   * line has to come back to where it started. Telling them that is useless; showing them takes
   * four seconds. The hand draws the wire out of the battery and into the lamp, the lamp comes on,
   * and then it hands over. After that the coach only ever comes back when a child is plainly
   * stuck, and never twice for the same game.
   */
  private coachScript(): Beat[] {
    const cellOf = (col: number, row: number): { x: number; y: number; r: number } => ({
      x: this.cam.ox + (col + 0.5) * this.cam.unit,
      y: this.cam.oy + (row + 0.5) * this.cam.unit,
      r: this.cam.unit * 0.62,
    });
    const trayWire = (): { x: number; y: number; r: number } | null => {
      const h = this.hits.find(x => x.id === 'tray:wire');
      return h ? { x: h.x + h.w / 2, y: h.y + h.h / 2, r: Math.min(h.w, h.h) * 0.5 } : null;
    };
    const partSpot = (id: string) => (): { x: number; y: number; r: number } | null => {
      const i = this.board().findIndex(q => q.id === id);
      return i < 0 ? null : cellOf(this.board()[i].col, this.board()[i].row);
    };
    return [
      { act: 'watch', hold: 2.2, at: partSpot('battery'),
        say: 'This is the battery. The push comes from here.',
        sayNl: 'Dit is de batterij. Hier komt de duw vandaan.' },
      { act: 'watch', hold: 2.2, at: partSpot('bulb'),
        say: 'And this is the lamp. It wants the push to reach it.',
        sayNl: 'En dit is het lampje. Daar moet de duw naartoe.' },
      { act: 'drag', at: trayWire, to: partSpot('bulb'),
        say: 'Take the wire and draw a line from one to the other.',
        sayNl: 'Pak de draad en trek een lijn van het een naar het ander.' },
    ];
  }

  /** The hand, brought back for one beat when a child has plainly lost the thread. */
  private stuckHint(): Beat | null {
    const f = this.sim?.fault;
    if (!f) return null;
    const at = (): { x: number; y: number; r: number } | null => {
      const p = this.board()[f.at];
      return p ? { x: this.cam.ox + (p.col + 0.5) * this.cam.unit, y: this.cam.oy + (p.row + 0.5) * this.cam.unit, r: this.cam.unit * 0.7 } : null;
    };
    if (f.kind === 'switchoff') {
      return { act: 'tap', at, say: 'Tap the switch to close it.', sayNl: 'Tik op de schakelaar om hem aan te zetten.' };
    }
    if (f.kind === 'ledback') {
      return { act: 'tap', at, say: 'Tap the LED to turn it round.', sayNl: 'Tik op de led om hem om te draaien.' };
    }
    if (f.kind === 'gap' || f.kind === 'loose' || f.kind === 'stray') {
      return { act: 'drag', at, to: at, say: 'Draw the line on from here.', sayNl: 'Trek de lijn hiervandaan verder.' };
    }
    return null;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    this.hits = [];
    const b = this.bands();
    this.cam = this.camera(b);

    this.backdrop();
    ctx.save();
    this.shake.apply(ctx, 5);
    this.drawPanel(b);
    ctx.restore();

    this.drawChip(b);
    this.drawGoal(b);
    this.drawTray(b);
    this.drawBar(b);
    this.ps.draw(ctx);
    this.drawGhost();
    this.drawNote(b);
    if (this.cheer > 0.01) this.drawCheer(b);
    if (this.picking) { this.hits = []; this.drawPicker(); }
    vignette(ctx, this.w, this.h, 0.22, '4, 12, 22');
    this.coach.draw(ctx, this.w, this.h, this.u(), NL(), (weight, size) => this.font(weight, size));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private backdrop(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#101c29');
    g.addColorStop(0.55, '#1a2b3c');
    g.addColorStop(1, '#283c4e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    // a lamp over the bench: without it the board floats in a void instead of lying on a table
    const b = this.bands();
    const cx = b.panel.x + b.panel.w / 2, cy = b.panel.y + b.panel.h / 2;
    const r = Math.max(b.panel.w, b.panel.h) * 0.95;
    const pool = ctx.createRadialGradient(cx, cy - b.panel.h * 0.1, r * 0.2, cx, cy, r);
    pool.addColorStop(0, 'rgba(150, 196, 240, 0.16)');
    pool.addColorStop(0.55, 'rgba(120, 170, 220, 0.06)');
    pool.addColorStop(1, 'rgba(120, 170, 220, 0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, this.w, this.h);
    grainOver(ctx, 0, 0, this.w, this.h, 0.05);
  }

  /**
   * The bench: a reading along the top, the pegboard in the middle, one line of trouble at the foot.
   *
   * Putting the numbers and the trouble inside the same frame as the circuit is the point. The
   * volts, the current and what the battery has left are three readings of the same thing the beads
   * are showing, and they are worth having where the eye already is.
   */
  private drawPanel(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const { x, y, w, h } = b.panel;

    ctx.save();
    ctx.shadowColor = 'rgba(4, 10, 18, 0.55)';
    ctx.shadowBlur = 20 * u;
    ctx.shadowOffsetY = 6 * u;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#1e3242');
    g.addColorStop(1, '#14232f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14 * u);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(180, 214, 248, 0.18)';
    ctx.lineWidth = Math.max(1, 1.4 * u);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14 * u);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(180, 214, 248, 0.1)';
    ctx.lineWidth = Math.max(0.8, 1 * u);
    for (const ly of [y + b.headH, y + h - b.footH]) {
      ctx.beginPath();
      ctx.moveTo(x + 10 * u, ly);
      ctx.lineTo(x + w - 10 * u, ly);
      ctx.stroke();
    }
    this.drawReadout(b);
    this.drawGrid(b);
    this.drawFoot(b);
  }

  /** Volts, amps and what is left in the battery: three numbers along the top of the bench. */
  private drawReadout(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const board = this.board();
    const cells = board.filter(p => p.id === 'battery');
    const volts = cells.length
      ? Math.max(...cells.map(p => battVolts(chargeFrac(p))))
      : board.some(p => p.id === 'solar') ? specOf('solar').volts : 0;
    const frac = cells.length ? Math.min(...cells.map(chargeFrac)) : 1;
    const y = b.panel.y + b.headH / 2 + 2 * u;
    const x0 = b.panel.x + 12 * u;
    const wEach = (b.panel.w - 24 * u) / 3;

    ctx.textBaseline = 'middle';
    const cell = (i: number, label: string, value: string, tone: string): void => {
      const cx = x0 + i * wEach;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(190, 214, 240, 0.5)';
      ctx.font = this.font('900', 8.5);
      const lw = Math.min(wEach * 0.52, ctx.measureText(label).width);
      ctx.fillText(label, cx, y, lw);
      ctx.fillStyle = tone;
      ctx.font = this.font('900', 12);
      ctx.fillText(value, cx + lw + 6 * u, y, wEach - lw - 12 * u);
    };
    cell(0, T('VOLTS', 'SPANNING'), `${num(volts, 1)} V`, volts > 0.1 ? '#e2ecf8' : 'rgba(226,236,248,0.4)');
    cell(1, T('CURRENT', 'STROOM'), `${num(this.sim.drawn, 2)} A`,
      this.sim.short ? '#ff9f7a' : this.sim.drawn > 0.005 ? '#8ee8ad' : 'rgba(226,236,248,0.4)');

    // and the charge, as a bar rather than a number, because a bar empties where a number just drops
    const bx = x0 + 2 * wEach, bw = wEach - 12 * u, bh = 9 * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(190, 214, 240, 0.5)';
    ctx.font = this.font('900', 8.5);
    const lab = T('LEFT', 'OVER');
    const lw = Math.min(wEach * 0.42, ctx.measureText(lab).width + 8 * u);
    ctx.fillText(lab, bx, y, lw);
    ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
    ctx.beginPath();
    ctx.roundRect(bx + lw, y - bh / 2, bw - lw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = frac > 0.25 ? '#8ee8ad' : frac > 0 ? '#ffd86b' : '#ff9f7a';
    ctx.beginPath();
    ctx.roundRect(bx + lw, y - bh / 2, Math.max(bh, (bw - lw) * clamp(frac, 0, 1)), bh, bh / 2);
    ctx.fill();
  }

  /** The pegboard, the parts on it, and the current running through them. */
  private drawGrid(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const { ox, oy, unit } = this.cam;
    const bw = COLS * unit, bh = ROWS * unit;

    ctx.fillStyle = 'rgba(8, 16, 26, 0.35)';
    ctx.beginPath();
    ctx.roundRect(ox - 3 * u, oy - 3 * u, bw + 6 * u, bh + 6 * u, 8 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(160, 200, 240, 0.15)';
    for (let c = 0; c <= COLS; c++) {
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.arc(ox + c * unit, oy + r * unit, Math.max(1, unit * 0.045), 0, TAU);
        ctx.fill();
      }
    }
    this.hits.push({ id: 'board', x: ox, y: oy, w: bw, h: bh });

    // where a held part would land
    const d = this.drag;
    if (d && d.moved >= 9) {
      const cells = cellsOf({ id: d.id, col: d.col, row: d.row, rot: d.rot });
      ctx.fillStyle = d.ok ? 'rgba(142, 232, 173, 0.3)' : 'rgba(255, 140, 120, 0.22)';
      for (const [c, r] of cells) {
        ctx.beginPath();
        ctx.roundRect(ox + c * unit + unit * 0.06, oy + r * unit + unit * 0.06, unit * 0.88, unit * 0.88, unit * 0.16);
        ctx.fill();
      }
    }

    const board = this.board();
    board.forEach((p, i) => {
      if (p.id !== 'wire') return;
      paintWire(ctx, ox + (p.col + 0.5) * unit, oy + (p.row + 0.5) * unit, unit, wireArms(board, i), this.partState(i));
    });
    board.forEach((p, i) => {
      if (p.id === 'wire') return;
      if (d && d.from === i && d.moved >= 9) return;
      const c = centreOf(p, ox, oy, unit);
      paintPart(ctx, p, this.partState(i), c.x, c.y, unit, this.t, this.spin.get(p) ?? 0);
    });
    paintFlow(ctx, board, this.sim.parts, ox, oy, unit, this.flow);

    board.forEach((p, i) => {
      for (const [c, r] of cellsOf(p)) {
        this.hits.push({ id: `part:${i}`, x: ox + c * unit, y: oy + r * unit, w: unit, h: unit });
      }
    });

    // and the trouble is ringed where it actually is
    const f = this.sim.fault;
    if (f && f.at >= 0 && board[f.at]) {
      const c = centreOf(board[f.at], ox, oy, unit);
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 4);
      ctx.strokeStyle = hexA(f.kind === 'short' || f.kind === 'fuse' ? '#ff9f7a' : '#ffd86b', 0.3 + 0.45 * pulse);
      ctx.lineWidth = Math.max(1.5, 2.4 * u);
      ctx.beginPath();
      ctx.arc(c.x, c.y, unit * (0.5 + 0.06 * pulse), 0, TAU);
      ctx.stroke();
    }

    // a hand drawing a line, for a bench nobody has touched in a while
    if (this.idle > 9 && !this.drag && !this.line && !this.picking) {
      const k = (this.t % 2.6) / 2.6;
      const hx = ox + unit * (0.6 + k * 2.4), hy = oy + bh - unit * 0.9;
      ctx.save();
      ctx.globalAlpha = 0.75;
      handCursor(ctx, hx, hy, unit * 0.3, k < 0.12 ? 1 : 0);
      ctx.restore();
    }
  }

  /**
   * The one line along the foot of the bench.
   *
   * Either what is wrong and where, or, when nothing is wrong, what the circuit is doing - because
   * "het lampje brandt" is the reading that makes the next change mean something.
   */
  private drawFoot(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const f = this.sim.fault;
    const board = this.board();
    const y = b.panel.y + b.panel.h - b.footH / 2 - 2 * u;
    let text: string;
    let colour: string;
    if (!board.length) {
      text = T('Drag a part onto the board to start.', 'Sleep een onderdeel op het bord om te beginnen.');
      colour = 'rgba(214, 232, 252, 0.72)';
    } else if (f) {
      text = faultLine(f, NL());
      colour = f.kind === 'short' || f.kind === 'fuse' ? '#ff9f7a' : '#ffd86b';
    } else {
      const lit = board.some((p, i) => specOf(p.id).load && this.partState(i).duty > 0.05);
      text = lit
        ? T('The loop is closed and the current is going round.', 'De kring is rond en de stroom loopt.')
        : T('Draw a line of wire from one part to the next.', 'Trek een lijn draad van het ene deel naar het volgende.');
      colour = lit ? '#8ee8ad' : 'rgba(214, 232, 252, 0.72)';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.font('800', 11.5);
    ctx.fillStyle = colour;
    ctx.fillText(text, b.panel.x + b.panel.w / 2, y, b.panel.w - 20 * u);
  }

  private drawChip(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const q = this.quiz();
    const { y, h } = b.chip;
    const label = q.free ? T('Bench', 'Werkbank') : `${T('Puzzle', 'Opdracht')} ${this.puzzle + 1}`;
    ctx.font = this.font('900', 12.5);
    const w = Math.min(b.chip.w, ctx.measureText(label).width + h * 1.1 + 14 * u);
    this.chipW = w;
    const x = b.chip.x;
    glassPanel(ctx, x, y, w, h, h * 0.34, 0.93);
    drawStar(ctx, x + h * 0.5, y + h / 2, h * 0.28, this.isDone(this.puzzle));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#12233b';
    ctx.font = this.font('900', 12.5);
    ctx.fillText(label, x + h * 0.9, y + h / 2 - 6 * u, w - h - 8 * u);
    ctx.fillStyle = 'rgba(18,35,59,0.55)';
    ctx.font = this.font('800', 9);
    ctx.fillText(`${this.solvedIds().length}/${PUZZLES.length - 1} ${T('done', 'af')}`,
      x + h * 0.9, y + h / 2 + 9 * u, w - h - 8 * u);
    this.hits.push({ id: 'chip', x, y, w, h });
  }

  /** The goal, in one drawn line, on a card you can tap for a nudge. */
  private drawGoal(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const q = this.quiz();
    const x = b.wide ? b.chip.x + this.chipW + 6 * u : b.goal.x;
    const w = b.wide ? Math.max(60 * u, this.w - 116 - x) : b.goal.w;
    const { y, h } = b.goal;
    glassPanel(ctx, x, y, w, h, 12 * u, 0.9);
    // a card you can ask says so, or nobody ever asks it
    const ask = Math.min(h * 0.56, 24 * u);
    ctx.fillStyle = 'rgba(18, 35, 59, 0.12)';
    ctx.beginPath();
    ctx.arc(x + w - ask * 0.72, y + h / 2, ask / 2, 0, TAU);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(18, 35, 59, 0.62)';
    ctx.font = this.font('900', 12);
    ctx.fillText('?', x + w - ask * 0.72, y + h / 2 + u, ask);
    ctx.textAlign = 'left';
    ctx.font = this.font('800', 11.5);
    const room = w - 20 * u - ask;
    const lines = wrap(ctx, NL() ? q.goalNl : q.goal, room).slice(0, 2);
    ctx.fillStyle = '#12233b';
    lines.forEach((ln, i) => {
      ctx.fillText(ln, x + 10 * u, y + h / 2 + (i - (lines.length - 1) / 2) * 14 * u, room);
    });
    this.hits.push({ id: 'goal', x, y, w, h });
  }

  private drawTray(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const r = b.tray;
    const binning = !!this.drag && this.drag.from >= 0 && this.drag.moved >= 9;
    ctx.fillStyle = binning ? 'rgba(62, 18, 26, 0.92)' : 'rgba(8, 16, 26, 0.82)';
    if (b.trayDown) {
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 12 * u);
      ctx.fill();
      ctx.strokeStyle = binning ? 'rgba(255, 150, 140, 0.5)' : 'rgba(180, 214, 248, 0.14)';
      ctx.lineWidth = Math.max(1, 1.2 * u);
      ctx.stroke();
    } else {
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = binning ? 'rgba(255, 150, 140, 0.45)' : 'rgba(180, 214, 248, 0.14)';
      ctx.fillRect(r.x, r.y, r.w, Math.max(1.2, 1.5 * u));
    }

    if (binning) {
      ctx.fillStyle = 'rgba(255, 196, 186, 0.95)';
      ctx.font = this.font('900', b.trayDown ? 11 : 13);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrap(ctx, T('Let go here to take it off', 'Hier loslaten om hem eraf te halen'), r.w - 16 * u);
      lines.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2,
        r.y + r.h / 2 + (i - (lines.length - 1) / 2) * 16 * u, r.w - 16 * u));
      return;
    }

    const all = this.quiz().tray;
    const g = this.trayGrid(b);
    const list = all.slice(g.page * g.per, g.page * g.per + g.per);
    const pad = 4 * u;
    const arrow = b.trayDown ? 0 : 30 * u;
    const vGap = b.trayDown ? 48 * u : 0;
    const left = r.x + pad + arrow + g.offX;
    const top = r.y + pad + vGap + g.offY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // whatever is on this page is centred in the shelf, so a last page with three things on it is
    // three things in the middle of the shelf and not three things in the top left of an empty one
    const usedRows = Math.max(1, Math.ceil(list.length / g.cols));
    const padY = ((g.rows - usedRows) * g.rowH) / 2;
    list.forEach((id, k) => {
      const col = k % g.cols, row = Math.floor(k / g.cols);
      const inRow = Math.min(g.cols, list.length - row * g.cols);
      const x = left + ((g.cols - inRow) * g.cell) / 2 + col * g.cell;
      const y = top + padY + row * g.rowH;
      const len = specOf(id).len;
      const pu = Math.min((g.cell * 0.78) / len, g.rowH * 0.52, 50 * u);
      const cx = x + g.cell / 2, cy = y + g.rowH * 0.38;
      if (id === 'wire') paintWire(ctx, cx, cy, pu, [1, 2, 3], null);
      else {
        paintPart(ctx, { id, col: 0, row: 0, rot: 0, charge: id === 'battery' ? BATTERY_CHARGE : 0 },
          null, cx, cy, pu, this.t, 0.6);
      }
      ctx.fillStyle = 'rgba(222, 238, 252, 0.94)';
      ctx.font = this.font('800', 8.5);
      const said = wrap(ctx, nameOf(id), g.cell - 6 * u).slice(0, 2);
      said.forEach((ln, j) => ctx.fillText(ln, cx, y + g.rowH - 5 * u - (said.length - 1 - j) * 10 * u, g.cell - 4 * u));
      this.hits.push({ id: `tray:${id}`, x, y, w: g.cell, h: g.rowH });
    });

    if (g.pages > 1) {
      ctx.textBaseline = 'middle';
      ctx.font = this.font('900', 16);
      const spots: Array<[string, number, number, string, boolean]> = b.trayDown
        ? [['page:-1', r.x + r.w / 2, r.y + 26 * u, '‹', g.page > 0],
          ['page:1', r.x + r.w / 2, r.y + r.h - 26 * u, '›', g.page < g.pages - 1]]
        : [['page:-1', r.x + 18 * u, r.y + r.h / 2, '‹', g.page > 0],
          ['page:1', r.x + r.w - 18 * u, r.y + r.h / 2, '›', g.page < g.pages - 1]];
      for (const [id, ax, ay, glyph, on] of spots) {
        ctx.save();
        if (b.trayDown) { ctx.translate(ax, ay); ctx.rotate(Math.PI / 2); ctx.translate(-ax, -ay); }
        ctx.fillStyle = on ? 'rgba(226,238,252,0.16)' : 'rgba(226,238,252,0.05)';
        ctx.beginPath();
        ctx.roundRect(ax - 13 * u, ay - 22 * u, 26 * u, 44 * u, 9 * u);
        ctx.fill();
        ctx.fillStyle = on ? '#e2ecf8' : 'rgba(226,238,252,0.25)';
        ctx.fillText(glyph, ax, ay, 24 * u);
        ctx.restore();
        if (on) this.hits.push({ id, x: ax - 22 * u, y: ay - 22 * u, w: 44 * u, h: 44 * u });
      }
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(226,238,252,0.45)';
      ctx.font = this.font('800', 9);
      ctx.fillText(`${g.page + 1}/${g.pages}`, r.x + 10 * u, r.y + 14 * u, 30 * u);
    }
  }

  /** Undo, a fresh battery, and start this one again. */
  private drawBar(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const r = b.bar;
    const side = Math.min(78 * u, r.w * 0.26);
    const gap = 8 * u;
    const midW = r.w - side * 2 - gap * 2;

    ctx.font = this.font('900', 11.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const uf = chunkyButton(ctx, r.x, r.y, side, r.h, { tone: '#46566a', pressed: this.held === 'undo', disabled: !this.history.length });
    ctx.fillStyle = this.history.length ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.45)';
    ctx.fillText(T('Undo', 'Terug'), r.x + side / 2, uf.y + r.h / 2, side - 8 * u);
    this.hits.push({ id: 'undo', x: r.x, y: r.y, w: side, h: r.h });

    const cells = this.board().filter(p => p.id === 'battery');
    const frac = cells.length ? Math.min(...cells.map(chargeFrac)) : 1;
    const flat = cells.length > 0 && frac <= 0.02;
    const mx = r.x + side + gap;
    const mf = chunkyButton(ctx, mx, r.y, midW, r.h, { tone: flat ? '#e0a04a' : '#46566a', pressed: this.held === 'renew' });
    ctx.fillStyle = flat ? '#3b2a05' : 'rgba(255,255,255,0.94)';
    ctx.fillText(T('New battery', 'Nieuwe batterij'), mx + midW / 2, mf.y + r.h / 2, midW - 14 * u);
    this.hits.push({ id: 'renew', x: mx, y: r.y, w: midW, h: r.h });

    const rx = r.x + r.w - side;
    const rf = chunkyButton(ctx, rx, r.y, side, r.h, { tone: '#46566a', pressed: this.held === 'reset' });
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillText(T('Restart', 'Opnieuw'), rx + side / 2, rf.y + r.h / 2, side - 8 * u);
    this.hits.push({ id: 'reset', x: rx, y: r.y, w: side, h: r.h });
  }

  private drawGhost(): void {
    const d = this.drag;
    if (!d || d.moved < 9) return;
    const ctx = this.ctx;
    const unit = this.cam.unit;
    ctx.save();
    ctx.globalAlpha = d.ok ? 0.95 : 0.55;
    paintPart(ctx, { id: d.id, col: 0, row: 0, rot: d.rot, charge: BATTERY_CHARGE }, null, d.x, d.y, unit, this.t, 0.6);
    ctx.restore();
  }

  /** Where a card belongs: in the room under the bench if there is any, over its foot if not. */
  private cardTop(b: Bands, h: number): number {
    const u = this.u();
    const foot = b.panel.y + b.panel.h;
    // sideways there is no room under the bench at all, so the card drops to the very foot of the
    // screen and lies over the row of buttons, which nothing needs while it is up. What it must
    // not lie over is the circuit that has just been built, and down there it does not.
    if (b.trayDown) return Math.max(b.panel.y + 4 * u, this.h - h - 4 * u);
    const below = b.tray.y - foot;
    if (below > h + 12 * u) return foot + (below - h) / 2;
    // a short screen has no room under the bench, so the card sits over the shelf instead and
    // leaves the circuit you have just built where you can still see it
    return Math.max(foot - h * 0.35, b.tray.y + b.tray.h - h - 4 * u);
  }

  /** Cards line up over the bench, not over the middle of a screen the bench is not in. */
  private cardMid(b: Bands): number { return b.panel.x + b.panel.w / 2; }

  private drawNote(b: Bands): void {
    if (this.noteT <= 0) return;
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    ctx.font = this.font('800', 11.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const cw = Math.min(this.w - 32 * u, 400 * u);
    const lines = wrap(ctx, this.note, cw - 28 * u);
    const nh = (lines.length * 16 + 14) * u;
    const ny = this.cardTop(b, nh);
    const mid = this.cardMid(b);
    glassPanel(ctx, mid - cw / 2, ny, cw, nh, 12 * u, 0.95);
    ctx.fillStyle = '#12233b';
    lines.forEach((ln, i) => ctx.fillText(ln, mid, ny + 20 * u + i * 16 * u, cw - 28 * u));
    ctx.restore();
  }

  /** A puzzle that has just come out right: a star, and somewhere to go next. */
  private drawCheer(b: Bands): void {
    const ctx = this.ctx, u = this.u();
    const k = this.cheer;
    const q = this.quiz();
    const last = this.puzzle >= PUZZLES.length - 1;
    const mid = this.cardMid(b);
    const w = Math.min(this.w - 24 * u, b.wide ? 540 * u : 380 * u);
    // sideways it is one low row along the foot of the screen: any taller and its top edge would
    // come up over the line under the bench, which is the one line the game is always saying
    const h = b.wide ? 62 * u : Math.min(140 * u, Math.max(112 * u, b.panel.h - 12 * u));
    const x = mid - w / 2;
    const y = this.cardTop(b, h) + (1 - k) * 26 * u;
    const bw = b.wide ? Math.min(128 * u, (w - 48 * u) * 0.34) : (w - 36 * u) / 2;
    const bh = 34 * u;
    const by = b.wide ? y + h / 2 - bh / 2 : y + h - bh - 12 * u;
    const sx = b.wide ? x + w - bw * 2 - 20 * u : x + 12 * u;
    const nx = x + w - bw - 12 * u;

    ctx.save();
    ctx.globalAlpha = k;
    glassPanel(ctx, x, y, w, h, 16 * u, 0.97);
    ctx.textBaseline = 'alphabetic';
    if (b.wide) {
      drawStar(ctx, x + 28 * u, y + h / 2, 16 * u, true, 0.92 + 0.08 * Math.sin(this.t * 4));
      ctx.textAlign = 'left';
      ctx.fillStyle = '#12233b';
      ctx.font = this.font('900', 14);
      const tw = sx - x - 62 * u;
      ctx.fillText(T('That is it.', 'Zo werkt het.'), x + 50 * u, y + h / 2 - 6 * u, tw);
      ctx.fillStyle = 'rgba(18,35,59,0.65)';
      ctx.font = this.font('800', 9.5);
      const hint = wrap(ctx, NL() ? q.hintNl : q.hint, tw);
      ctx.fillText(hint.length > 1 ? `${hint[0]}…` : hint[0] ?? '', x + 50 * u, y + h / 2 + 12 * u, tw);
    } else {
      drawStar(ctx, mid, y + 28 * u, 17 * u, true, 0.92 + 0.08 * Math.sin(this.t * 4));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#12233b';
      ctx.font = this.font('900', 15);
      ctx.fillText(T('That is it.', 'Zo werkt het.'), mid, y + 60 * u, w - 28 * u);
      ctx.fillStyle = 'rgba(18,35,59,0.65)';
      ctx.font = this.font('800', 10);
      wrap(ctx, NL() ? q.hintNl : q.hint, w - 30 * u).slice(0, 2)
        .forEach((ln, i) => ctx.fillText(ln, mid, y + 77 * u + i * 13 * u, w - 30 * u));
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sf = chunkyButton(ctx, sx, by, bw, bh, { tone: '#46566a', pressed: this.held === 'stay' });
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.font = this.font('900', 11.5);
    ctx.fillText(T('Keep playing', 'Doorspelen'), sx + bw / 2, sf.y + bh / 2, bw - 10 * u);
    const nf = chunkyButton(ctx, nx, by, bw, bh, { tone: '#65d48c', pressed: this.held === 'next' });
    ctx.fillStyle = '#0b2a1c';
    ctx.fillText(last ? T('To the bench', 'Naar de werkbank') : T('Next', 'Volgende'),
      nx + bw / 2, nf.y + bh / 2, bw - 10 * u);
    ctx.restore();
    // the card swallows what lands on it, so a finger aimed at a button and landing beside it does
    // not draw a length of wire on the board underneath
    this.hits.push({ id: 'card', x, y, w, h });
    this.hits.push({ id: 'stay', x: sx, y: by, w: bw, h: bh });
    this.hits.push({ id: 'next', x: nx, y: by, w: bw, h: bh });
  }

  /** The ten of them, with a star on the ones that are done and nothing locked. */
  private drawPicker(): void {
    const ctx = this.ctx, u = this.u();
    // the list covers the bench outright. At a hair short of opaque the white cards underneath
    // ghosted through it, and a heading with half a goal card showing behind it reads as a fault
    const back = ctx.createLinearGradient(0, 0, 0, this.h);
    back.addColorStop(0, '#0a131d');
    back.addColorStop(1, '#101c29');
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, this.w, this.h);
    this.hits.push({ id: 'closepick', x: 0, y: 0, w: this.w, h: this.h });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e2ecf8';
    ctx.font = this.font('900', 16);
    ctx.fillText(T('What shall we build?', 'Wat gaan we maken?'), 14 * u, 76 * u, this.w - 140);

    const cols = this.w > this.h ? 3 : 1;
    const rows = Math.ceil(PUZZLES.length / cols);
    const top = 88 * u;
    const cw = (this.w - 20 * u) / cols;
    const ch = Math.min(76 * u, (this.h - top - 10 * u) / rows);
    PUZZLES.forEach((q, i) => {
      const x = 10 * u + (i % cols) * cw;
      const y = top + Math.floor(i / cols) * ch;
      const on = i === this.puzzle;
      const done = this.isDone(i);
      ctx.fillStyle = on ? 'rgba(142, 232, 173, 0.2)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(x + 2 * u, y, cw - 8 * u, ch - 5 * u, 12 * u);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = 'rgba(142, 232, 173, 0.7)';
        ctx.lineWidth = Math.max(1.2, 1.8 * u);
        ctx.stroke();
      }
      // a socket for the star: the unearned one is a dark shape meant for a pale card, and on a
      // near-black list it is simply invisible, so the list looks as though it has no stars at all
      const my = y + (ch - 5 * u) / 2;
      ctx.fillStyle = done ? 'rgba(255, 216, 107, 0.12)' : 'rgba(226, 238, 252, 0.13)';
      ctx.beginPath();
      ctx.arc(x + 24 * u, my, 15 * u, 0, TAU);
      ctx.fill();
      drawStar(ctx, x + 24 * u, my, 11 * u, done);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? '#8ee8ad' : '#e2ecf8';
      ctx.font = this.font('900', 11);
      ctx.fillText(q.free ? T('The bench', 'De werkbank') : `${i + 1}`, x + 42 * u, my - 9 * u, cw - 58 * u);
      ctx.fillStyle = on ? 'rgba(142,232,173,0.8)' : 'rgba(226,238,252,0.62)';
      ctx.font = this.font('800', 9.5);
      const said = wrap(ctx, NL() ? q.goalNl : q.goal, cw - 58 * u);
      ctx.fillText(said.length > 1 ? `${said[0]}…` : said[0] ?? '', x + 42 * u, my + 9 * u, cw - 58 * u);
      this.hits.push({ id: `pick:${i}`, x, y, w: cw, h: ch });
    });
  }
}

/**
 * A word too long for the line, broken with a hyphen rather than squashed flat.
 *
 * Dutch makes long words out of short ones, and `Krokodillenklem` under a shelf four columns wide
 * is wider than its column. Canvas will squeeze it to fit and it comes out unreadable, so it is
 * cut instead, as near the middle as both halves allow, which is where a compound word breaks.
 */
function chop(ctx: Ctx, word: string, maxW: number): string[] {
  if (word.length < 6 || ctx.measureText(word).width <= maxW) return [word];
  const half = Math.ceil(word.length / 2);
  if (ctx.measureText(`${word.slice(0, half)}-`).width <= maxW
    && ctx.measureText(word.slice(half)).width <= maxW) {
    return [`${word.slice(0, half)}-`, word.slice(half)];
  }
  const out: string[] = [];
  let part = '';
  for (const ch of word) {
    if (part && ctx.measureText(`${part}${ch}-`).width > maxW) { out.push(`${part}-`); part = ''; }
    part += ch;
  }
  if (part) out.push(part);
  return out;
}

/** Break a line to fit a width, so nothing ever runs off its card. */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ').flatMap(w => chop(ctx, w, maxW));
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
