/**
 * Wereldatlas - the map, in Braambos.
 *
 * A drawn map and pieces you drag onto it. Pick up Friesland, put it down where Friesland is, and
 * it clicks home; put it on Drenthe and it springs back, Friesland lights up where it really was,
 * and a line appears that is worth knowing. That is the whole game, nine times over, and the nine
 * work outward from where a Dutch child is standing: the provinces, the water, the cities, the
 * neighbours, Europe, its capitals, the continents and oceans, the world, the flags.
 *
 * Three things it does deliberately:
 *  - the piece is carried at the map's own scale. Once it is off the tray it is exactly as big as
 *    the hole it is going into, so a child can see it nestle in rather than guess;
 *  - a wrong drop is never a dead end. The map explains itself and then puts the piece home by
 *    itself, so nobody is ever stuck on a shape they do not know. The stars count only what went
 *    home first time, before the map showed you;
 *  - a continent or a country offers "welke dieren wonen hier?", which opens the animal book at
 *    that part of the world. The atlas and the animal book are two halves of the same shelf.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, breathe, chunkyButton, drawStar, easeOutBack, easeOutCubic, glassPanel, handCursor,
  heading, hexA, outlinedText, Particles, roundRectPath, shade, Shake, vignette,
} from '../../render/look';
import {
  anchorOf, capitalOf, factOf, fit, nameOf, project, spanOf, unproject, NL_WATERS, PROVINCES,
  type Box, type Feature,
} from './geo';
import {
  boardFor, dropTarget, isRight, LEVELS, nextLevel, outlinable, pieceKindFor, poolFor, rngFor,
  runFor, SEA_OFF, SEA_STORM, starsFor, teachLine, VIEWS, type Level,
} from './model';
import {
  drawDesk, drawFlag, drawGraticule, drawHeightMap, drawLine, drawLineAt, drawPieceAt, drawPin,
  drawSea, drawShape, scaleToFit, INK, SEA,
} from './paint';
import { atlassfx } from './atlassfx';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const levelName = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `atlas:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

interface Layout {
  /** the whole area the map may use */
  area: Rect;
  /** the map itself, fitted inside that area */
  board: Box;
  prompt: Rect;
  hand: Rect;
  /** where the fact card and the correction go */
  card: Rect;
  wide: boolean;
}

/** How long the fact card stays up after a right answer, and after a wrong one. */
const RIGHT_FOR = 4;
const WRONG_FOR = 6.5;

interface Flight { from: Vec; to: Vec; t: number; dur: number; into: boolean }

export class Atlas {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private st = 0;
  private sb = 0;
  /** the notch and the home bar when the phone is on its side, which live left and right */
  private sl = 0;
  private sr = 0;
  private fullW = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'levels';
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private attempt = 0;
  private queue: Feature[] = [];
  private placed: Feature[] = [];
  private round = 0;
  private firstTry = 0;
  private tried = false;
  private streak = 0;
  private earned = 0;

  /** the finger, in screen pixels, while a piece is being carried */
  private drag: Vec | null = null;
  /** 0 in the tray, 1 out on the map: how far the piece has been lifted */
  private lift = 0;
  private flight: Flight | null = null;

  private fb: 'none' | 'right' | 'wrong' = 'none';
  private fbT = 0;
  /** what the child hit instead, for the correction */
  private missed: Feature | null = null;
  /** the feature the map is pointing at right now */
  private shown: Feature | null = null;
  private showT = 0;

  /** the sea level outside the dykes, in metres, or null for dykes on */
  private sea: number | null = null;

  private hits: Hit[] = [];
  private held: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private pop = 0;
  private note = '';
  private noteT = 0;
  /** where a name has already been written this frame, so the next one can step out of its way */
  private labels: Rect[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; this.held = null; });
    (window as unknown as { __atlas?: Atlas }).__atlas = this;
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

  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.pop = 0; this.drag = null; this.flight = null; }

  // ---------------------------------------------------------------- driving it from outside

  debugState(): Record<string, unknown> {
    const L = this.layout();
    const piece = this.piece();
    const view = VIEWS[this.level.board];
    const home = piece ? project(anchorOf(piece), view, L.board) : null;
    return {
      phase: this.phase,
      level: this.level.id,
      levelIndex: this.levelIndex,
      round: this.round,
      rounds: this.level.rounds,
      piece: piece ? piece.id : null,
      pieceName: piece ? nameOf(piece, NL()) : null,
      /** the middle of the piece in the tray: where a drag has to start */
      handAt: piece ? { x: Math.round(L.hand.x + L.hand.w / 2), y: Math.round(L.hand.y + L.hand.h / 2) } : null,
      /** and where it belongs on the map: where a correct drag has to end */
      homeAt: home ? { x: Math.round(home.x), y: Math.round(home.y) } : null,
      placed: this.placed.map(f => f.id),
      remaining: this.queue.length,
      feedback: this.fb,
      /** what the finger landed on instead, after a wrong drop */
      missed: this.missed?.id ?? null,
      firstTry: this.firstTry,
      streak: this.streak,
      stars: this.earned,
      sea: this.sea,
      outlines: save.atlas.outlines,
      /** every place this level can be asked about, at its spot on the screen */
      targets: this.phase === 'play' ? poolFor(this.level).map(f => {
        const q = project(anchorOf(f), view, L.board);
        return { id: f.id, x: Math.round(q.x), y: Math.round(q.y) };
      }) : [],
      board: { x: Math.round(L.board.x), y: Math.round(L.board.y), w: Math.round(L.board.w), h: Math.round(L.board.h) },
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  /** Press a button by name: the same path a tap takes, without having to aim. */
  tap(id: string): boolean {
    if (id === 'back') { this.back(); return true; }
    if (!this.hits.some(b => b.id === id)) return false;
    this.press(id);
    return true;
  }

  // ---------------------------------------------------------------- layout

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top;
    this.sb = safe.bottom;
    this.sl = safe.left;
    this.sr = safe.right;
    this.fullH = Math.max(1, window.innerHeight);
    this.fullW = Math.max(1, window.innerWidth);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  /**
   * Where everything goes.
   *
   * Upright: the name of the thing at the top, the map in the middle taking everything it can, the
   * piece in a tray along the bottom where a thumb reaches it. Turned on its side there is no
   * height for three bands, so the map takes the left and the name, the piece and whatever the
   * game has to say stack down the right.
   */
  private layout(): Layout {
    const u = this.u(), w = this.w, h = this.h;
    const pad = 13 * u;
    const wide = w > h * 1.25;
    const top = 58 * u;
    const view = VIEWS[this.level.board];

    if (wide) {
      // Turned on its side, the column beside the map takes whatever the map does not want. A map
      // of the Netherlands is tall and narrow and leaves half the width over; a map of the world
      // is a letterbox and leaves none. Handing the difference to the column is the difference
      // between a fact on four cramped lines and a fact on two.
      const areaH = h - top - 16 * u;
      const aspect = ((view.lon1 - view.lon0) * view.kx) / (view.lat1 - view.lat0);
      const wants = Math.min(areaH * aspect, w * 0.62);
      const colW = clamp(w - wants - pad * 3, 240 * u, 420 * u);
      const colX = w - colW - pad;
      const area: Rect = { x: pad, y: top, w: colX - pad * 2, h: areaH };
      const prompt: Rect = { x: colX, y: top, w: colW, h: 48 * u };
      const handH = Math.min(150 * u, Math.max(84 * u, (h - top - 48 * u - 40 * u) * 0.5));
      const hand: Rect = { x: colX, y: prompt.y + prompt.h + 8 * u, w: colW, h: handH };
      const card: Rect = {
        x: colX, y: hand.y + hand.h + 8 * u, w: colW,
        h: Math.max(84 * u, h - (hand.y + hand.h + 8 * u) - 14 * u),
      };
      return { area, board: this.boardBox(area, view), prompt, hand, card, wide };
    }

    // Upright, the three bands under the map are all reserved whether or not there is anything in
    // them, the way the clock reserves its strip: a card that appeared over the bottom of the map
    // would hide Zeeland and Limburg at the very moment a child was looking for them.
    const prompt: Rect = { x: pad, y: top, w: w - pad * 2, h: 44 * u };
    const handH = Math.min(104 * u, Math.max(76 * u, h * 0.18));
    const cardH = 88 * u;
    const hand: Rect = { x: pad, y: h - 16 * u - handH, w: w - pad * 2, h: handH };
    const card: Rect = { x: pad, y: hand.y - cardH - 6 * u, w: w - pad * 2, h: cardH };
    const area: Rect = {
      x: pad, y: prompt.y + prompt.h + 6 * u, w: w - pad * 2,
      h: card.y - (prompt.y + prompt.h) - 12 * u,
    };
    return { area, board: this.boardBox(area, view), prompt, hand, card, wide };
  }

  /** The map, fitted into the room it has, so the sea is exactly the shape of the world shown. */
  private boardBox(area: Rect, view: { lon0: number; lon1: number; lat0: number; lat1: number; kx: number }): Box {
    const f = fit(view, area);
    return {
      x: f.x, y: f.y,
      w: (view.lon1 - view.lon0) * view.kx * f.s,
      h: (view.lat1 - view.lat0) * f.s,
    };
  }

  // ---------------------------------------------------------------- the run of a level

  private unlocked(i: number): boolean {
    return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed;
  }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.queue = runFor(this.level, rngFor(this.level, this.attempt));
    this.placed = [];
    this.round = 0;
    this.firstTry = 0;
    this.tried = false;
    this.streak = 0;
    this.earned = 0;
    this.fb = 'none';
    this.fbT = 0;
    this.missed = null;
    this.shown = null;
    this.drag = null;
    this.flight = null;
    this.lift = 0;
    this.sea = null;
    this.ps.clear();
    this.pop = 0;
    this.phase = 'play';
    this.say(NL() ? this.level.hintNl : this.level.hint, 6);
  }

  /** The last thing the game said, so the guide in the corner can say it again. */
  spoken(): string { return this.note; }

  private say(text: string, secs = 3.5): void {
    this.note = text;
    this.noteT = secs;
    // audio-first: the note is the game's instruction, so it is heard as well as read.
    // Today that is the machine's own voice; a recording slots in without touching this.
    speakLine(text);
  }

  private piece(): Feature | null { return this.queue[0] ?? null; }

  /** The piece is home. Take it off the queue, and end the level when the queue runs out. */
  private settle(): void {
    const p = this.queue.shift();
    if (p) this.placed.push(p);
    this.round = this.placed.length;
    this.tried = false;
    if (!this.queue.length) {
      this.earned = starsFor(this.firstTry, this.level.rounds);
      recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
      persist();
      this.phase = 'won';
      this.pop = 0;
      atlassfx.complete();
    }
  }

  /** Send the piece flying from where it is to where it belongs, and settle it when it lands. */
  private flyHome(from: Vec): void {
    const p = this.piece();
    if (!p) return;
    const L = this.layout();
    const to = project(anchorOf(p), VIEWS[this.level.board], L.board);
    this.flight = { from, to, t: 0, dur: 0.34, into: true };
    this.drag = null;
  }

  private drop(at: Vec): void {
    const p = this.piece();
    if (!p || this.fb === 'wrong') return;
    const L = this.layout();
    const world = unproject(at.x, at.y, VIEWS[this.level.board], L.board);
    if (isRight(this.level, p, world)) {
      if (!this.tried) { this.firstTry++; this.streak++; }
      this.fb = 'right';
      this.fbT = RIGHT_FOR;
      // no amber outline on a right drop: the piece has just taken its own colour and its name,
      // and the mark the map uses to correct you should never appear when you were correct
      this.shown = p;
      this.showT = 0;
      this.missed = null;
      atlassfx.snap(this.streak);
      const home = project(anchorOf(p), VIEWS[this.level.board], L.board);
      this.ps.spawn('spark', home.x, home.y, 14, {
        colour: '#ffd873', speed: 200, size: 7 * this.u(), max: 0.8, spread: TAU,
      });
      this.ps.spawn('ring', home.x, home.y, 2, {
        colour: 'rgba(120, 220, 160, 0.9)', speed: 0, size: 26 * this.u(), max: 0.7,
      });
      this.flyHome(at);
      return;
    }
    // wrong: back to the tray, and the map says where it really was
    this.tried = true;
    this.streak = 0;
    this.fb = 'wrong';
    this.fbT = WRONG_FOR;
    this.missed = dropTarget(this.level, world);
    if (this.missed?.id === p.id) this.missed = null;
    this.shown = p;
    this.showT = WRONG_FOR;
    this.shake.add(0.45);
    atlassfx.miss();
    this.flight = {
      from: at,
      to: { x: L.hand.x + L.hand.w / 2, y: L.hand.y + L.hand.h / 2 },
      t: 0, dur: 0.32, into: false,
    };
    this.drag = null;
  }

  /** The way on from a correction: the piece goes home by itself, so nobody can get stuck. */
  private carryOn(): void {
    if (this.fb !== 'wrong') return;
    const L = this.layout();
    this.fb = 'none';
    this.fbT = 0;
    this.showT = 0.9;
    atlassfx.slide();
    this.flyHome({ x: L.hand.x + L.hand.w / 2, y: L.hand.y + L.hand.h / 2 });
  }

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.showT = Math.max(0, this.showT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.pop = Math.min(1, this.pop + dt * 2.8);
    this.lift = clamp(this.lift + (this.drag || this.flight ? 1 : -1) * dt * 6, 0, 1);
    if (this.flight) {
      this.flight.t += dt;
      if (this.flight.t >= this.flight.dur) {
        const into = this.flight.into;
        this.flight = null;
        if (into) this.settle();
      }
    }
    if (this.phase !== 'play') return;
    if (this.fb === 'right') {
      this.fbT -= dt;
      if (this.fbT <= 0) this.fb = 'none';
    } else if (this.fb === 'wrong') {
      this.fbT -= dt;
      if (this.fbT <= 0) this.carryOn();
    }
  }

  // ---------------------------------------------------------------- input

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
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
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.held = hit; this.press(hit); return; }
    if (this.phase !== 'play' || this.fb === 'wrong' || this.flight) return;
    // anywhere in the tray picks the piece up, and so does the piece itself wherever it has got to
    const L = this.layout();
    const inHand = p.x >= L.hand.x && p.x <= L.hand.x + L.hand.w
      && p.y >= L.hand.y && p.y <= L.hand.y + L.hand.h;
    if (!inHand) return;
    if (!this.piece()) return;
    // the card after a right drop is a bonus, not a wait: touching the tray takes it away
    if (this.fb === 'right') { this.fb = 'none'; this.fbT = 0; }
    this.drag = p;
    atlassfx.lift();
  }

  private onMove(e: PointerEvent): void {
    if (!this.drag) return;
    this.drag = this.at(e);
  }

  private onUp(e: PointerEvent): void {
    this.held = null;
    if (!this.drag) return;
    const at = this.at(e);
    const L = this.layout();
    const u = this.u();
    this.drag = null;
    // Only a drop on the map is an answer. Let go anywhere else - back in the tray, on the card,
    // out on the desk - and the piece simply goes back, with nothing gained and nothing lost.
    // (This used to ask whether the finger was below the tray's top edge, which is the same thing
    // upright and quite wrong on a phone turned sideways, where the tray is off to the right and
    // most of the map is below its top edge.)
    const b = L.board;
    const onMap = at.x >= b.x - 8 * u && at.x <= b.x + b.w + 8 * u
      && at.y >= b.y - 8 * u && at.y <= b.y + b.h + 8 * u;
    if (!onMap) { atlassfx.slide(); return; }
    this.drop(at);
  }

  private press(id: string): void {
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { atlassfx.tap(); this.start(i); } else atlassfx.miss();
      return;
    }
    if (id === 'levels') { atlassfx.tap(); this.back(); return; }
    if (id === 'outlines') {
      save.atlas.outlines = !save.atlas.outlines;
      persist();
      atlassfx.tap();
      this.say(save.atlas.outlines
        ? T('The empty places are outlined.', 'De lege plekken staan nu omlijnd.')
        : T('Outlines off. Now you have to know.', 'Omlijning uit. Nu moet je het weten.'), 2.4);
      return;
    }
    if (id === 'dykes') {
      atlassfx.tap();
      if (this.sea == null) { this.sea = SEA_OFF; atlassfx.flood(); this.say(T(
        'No dykes, ordinary sea. A quarter of the country is already under.',
        'Geen dijken, gewone zee. Een kwart van het land staat al onder water.'), 5); } else if (this.sea === SEA_OFF) {
        this.sea = SEA_STORM;
        atlassfx.flood();
        this.say(T('And now a storm surge, five metres, as in 1953.',
          'En nu stormvloed, vijf meter, zoals in 1953.'), 5);
      } else { this.sea = null; atlassfx.drain(); this.say(T('Dykes back on.', 'Dijken weer aan.'), 2.4); }
      return;
    }
    if (id === 'go') { this.carryOn(); return; }
    if (id === 'retry') { atlassfx.tap(); this.start(this.levelIndex); return; }
    if (id === 'next') { atlassfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id.startsWith('animals:')) {
      atlassfx.tap();
      // the animal book opens at this part of the world: `animals.html#af` is Africa
      window.location.href = `./animals.html#${id.slice(8)}`;
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    drawDesk(ctx, this.w, this.h);
    if (this.phase === 'levels') { this.drawLevels(); return; }
    ctx.save();
    this.shake.apply(ctx, 6 * this.u());
    this.drawPlay();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.16);
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  private drawPlay(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();
    const view = VIEWS[this.level.board];
    const piece = this.piece();

    this.labels = [];

    // ---- the map
    drawSea(ctx, L.board, Math.min(L.board.w, L.board.h) * 0.04);
    drawGraticule(ctx, view, L.board, this.level.board === 'world' ? 30 : this.level.board === 'eu' ? 10 : 1);

    const board = boardFor(this.level);
    const pool = poolFor(this.level);
    const placedIds = new Set(this.placed.map(f => f.id));

    // everything from here to the end of the map is cut to the sea, because a coarse outline runs
    // off the edge of the window it is drawn in - Germany reaches past a map of the neighbours,
    // Russia past a map of Europe - and a country spilling onto the desk is not a map
    ctx.save();
    roundRectPath(ctx, L.board.x, L.board.y, L.board.w, L.board.h,
      Math.min(L.board.w, L.board.h) * 0.04);
    ctx.clip();

    if (this.level.dykes) {
      drawHeightMap(ctx, view, L.board, this.sea, PROVINCES.flatMap(p => p.rings ?? []));
      for (const f of board) {
        drawShape(ctx, f.rings ?? [], view, L.board, { stroke: 'rgba(255,255,255,0.65)', width: 1 });
      }
    } else {
      for (const f of board) {
        const done = placedIds.has(f.id);
        drawShape(ctx, f.rings ?? [], view, L.board, {
          fill: done ? shade(f.tone, 0.1) : '#d9cfae',
          stroke: 'rgba(255,255,255,0.72)',
          width: 1.2,
        });
      }
      // The IJsselmeer is the hole in the outline of the country, and without it the Netherlands
      // is a lump rather than a shape you would recognise. It is drawn on every map of the
      // Netherlands except the one where finding the water is the game itself.
      if (this.level.board === 'nl' && !this.level.dykes) {
        const lake = NL_WATERS.find(f => f.id === 'ijsselmeer');
        if (lake?.rings) {
          drawShape(ctx, lake.rings, view, L.board, {
            fill: SEA, stroke: 'rgba(255,255,255,0.6)', width: 1,
          });
        }
      }
    }

    // the empty places, outlined, for a child still finding the holes
    if (save.atlas.outlines && outlinable(this.level)) {
      for (const f of pool) {
        if (placedIds.has(f.id) || f.id === piece?.id) continue;
        if (f.rings?.length && this.level.piece === 'shape' && f.kind !== 'ocean') {
          drawShape(ctx, f.rings, view, L.board, {
            stroke: 'rgba(30, 70, 95, 0.3)', width: 1.2, dash: [4, 4],
          });
        } else if (f.at) {
          const q = project(f.at, view, L.board);
          ctx.save();
          ctx.strokeStyle = 'rgba(30, 70, 95, 0.32)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(q.x, q.y, 5 * u, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ---- what is already home
    for (const f of this.placed) this.drawPlaced(f, view, L.board);
    // every name after every shape: Limburg goes down after Noord-Brabant and would otherwise
    // cover the tail of its neighbour's label
    for (const f of this.placed) this.drawPlacedLabel(f, view, L.board);

    // ---- the one the map is pointing at, after a wrong drop
    if (this.shown && this.showT > 0) this.drawPointedAt(this.shown, view, L.board);
    if (this.fb === 'wrong' && this.missed) {
      drawShape(ctx, this.missed.rings ?? [], view, L.board, {
        stroke: '#c0512f', width: 2, dash: [5, 4],
      });
    }
    this.ps.draw(ctx);
    ctx.restore();

    // ---- the tray, the piece, and the piece under the finger
    this.drawPrompt(L.prompt, piece);
    this.drawHand(L.hand, piece);
    if (piece) this.drawCarried(piece, L, view);

    // ---- whatever the game has to say
    if (this.fb === 'wrong') this.drawTeach(L.card);
    else if (this.fb === 'right' && this.shown) this.drawFactCard(L.card, this.shown, true);
    else if (this.noteT > 0) this.drawNote(L.card);

  }

  /** A piece that is home: filled in its own colour, with its name across it. */
  private drawPlaced(f: Feature, view: typeof VIEWS['nl'], box: Box): void {
    const ctx = this.ctx, u = this.u();
    // an ocean is not filled in: its outline is only a region to aim at, and what has been learnt
    // is that the name goes there
    if (f.rings?.length && f.kind !== 'ocean') {
      drawShape(ctx, f.rings, view, box, { fill: f.tone, stroke: 'rgba(255,255,255,0.95)', width: 1.8 });
    } else if (f.path?.length) {
      drawLine(ctx, f.path, view, box, f.tone, Math.max(2.6, 3.4 * u));
    }
    const q = project(anchorOf(f), view, box);
    if (f.at) drawPin(ctx, q.x, q.y, 9 * u, f.tone);
  }

  /** The name over a piece that is home, drawn after every shape so nothing can cover it. */
  private drawPlacedLabel(f: Feature, view: typeof VIEWS['nl'], box: Box): void {
    const ctx = this.ctx, u = this.u();
    const kind = pieceKindFor(this.level, f);
    const q = project(anchorOf(f), view, box);
    if (kind === 'flag' && f.flag) {
      // kept inside the map, the way a name is: Iceland's middle is a hand's breadth from the
      // left edge of a map of Europe, and a flag drawn there is half a flag
      const fw = 34 * u, fh = 22 * u;
      const fx = clamp(q.x, box.x + fw / 2 + 2 * u, box.x + box.w - fw / 2 - 2 * u);
      const fy = clamp(q.y, box.y + fh / 2 + 2 * u, box.y + box.h - fh / 2 - 2 * u);
      drawFlag(ctx, fx - fw / 2, fy - fh / 2, fw, fh, f.flag);
      return;
    }
    // a name is only written where the shape can carry one; on a map of Europe that fits a phone,
    // Albania is twenty pixels across and its label would land squarely on Croatia
    if (f.rings?.length && !f.at && f.kind !== 'ocean') {
      if (spanOf(f, view.kx) * fit(view, box).s < 34 * u) return;
    }
    const label = kind === 'name' && f.capNl ? capitalOf(f, NL()) : nameOf(f, NL());
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = this.font('900', f.kind === 'ocean' ? 11 : this.level.board === 'nl' ? 10 : 9);
    // and it is kept inside the map: a label written at the anchor of the Arctic runs off the edge
    const half = ctx.measureText(label).width / 2 + 4 * u;
    const lx = clamp(q.x, box.x + half, box.x + box.w - half);
    const line = 13 * u;
    // Leeuwarden and Groningen are eighty kilometres apart and their names are longer than that
    // on a phone. A name that would land on one already written steps a line down, then a line
    // up; if both are taken it stays where it belongs and takes the overlap.
    let ly = clamp(q.y + (f.at ? -16 * u : 3 * u), box.y + 13 * u, box.y + box.h - 6 * u);
    const free = (y: number): boolean => !this.labels.some(r =>
      Math.abs(r.x - lx) < (r.w + half * 2) / 2 && Math.abs(r.y - y) < line);
    if (!free(ly)) {
      if (free(ly + line * 1.6)) ly += line * 1.6;
      else if (free(ly - line * 1.6)) ly -= line * 1.6;
    }
    this.labels.push({ x: lx, y: ly, w: half * 2, h: line });
    outlinedText(ctx, label, lx, ly, ctx.font,
      f.kind === 'ocean' ? '#1c5a86' : '#123047', 'rgba(255,255,255,0.95)', 4);
    ctx.restore();
  }

  /** The place the map is pointing at: a bright outline that pulses, with its name beside it. */
  private drawPointedAt(f: Feature, view: typeof VIEWS['nl'], box: Box): void {
    const ctx = this.ctx, u = this.u();
    const beat = 0.55 + breathe(this.t, 5) * 0.45;
    ctx.save();
    ctx.globalAlpha = beat;
    if (f.rings?.length) {
      drawShape(ctx, f.rings, view, box, {
        fill: hexA('#ffe08a', 0.5), stroke: '#e8a020', width: 3, glow: 'rgba(240,180,60,0.9)',
      });
    } else if (f.path?.length) {
      drawLine(ctx, f.path, view, box, '#e8a020', Math.max(4, 5 * u));
    }
    const q = project(anchorOf(f), view, box);
    if (f.at) drawPin(ctx, q.x, q.y, 11 * u, '#e8a020', true);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = this.font('900', 12);
    const half = ctx.measureText(nameOf(f, NL())).width / 2 + 4 * u;
    const lx = clamp(q.x, box.x + half, box.x + box.w - half);
    // The name goes across the shape where the shape is big enough to carry it, and above it
    // where it is not. Switzerland on a map of Europe that fits a phone is seventeen pixels wide
    // and the word Zwitserland is eighty, so writing it at the middle hides the very thing the
    // map has just lit up - which is the one moment the whole correction exists for.
    const wide = !!f.rings?.length && spanOf(f, view.kx) * fit(view, box).s >= 46 * u;
    const dy = f.at || !wide ? -20 * u : 4 * u;
    const ly = clamp(q.y + dy, box.y + 15 * u, box.y + box.h - 7 * u);
    outlinedText(ctx, nameOf(f, NL()), lx, ly,
      this.font('900', 12), '#7a3d10', 'rgba(255,255,255,0.96)', 5);
  }

  /** The instruction and the name of the thing being looked for. */
  private drawPrompt(r: Rect, piece: Feature | null): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, r.x, r.y, r.w, r.h, 16 * u, 0.93);
    ctx.textAlign = 'center';
    const cx = r.x + r.w / 2;
    const kind = piece ? pieceKindFor(this.level, piece) : this.level.piece;
    const small = kind === 'name' && piece?.kind !== 'ocean'
      ? T('Which country has this capital?', 'Welk land heeft deze hoofdstad?')
      : kind === 'flag'
        ? T('Whose flag is this?', 'Van wie is deze vlag?')
        : T('Put it where it belongs', 'Leg het neer waar het hoort');
    ctx.fillStyle = 'rgba(18,48,71,0.6)';
    ctx.font = this.font('800', 11);
    ctx.fillText(small, cx, r.y + 19 * u, r.w - 20 * u);
    ctx.fillStyle = '#123047';
    ctx.font = this.font('900', 17);
    const big = !piece ? '' : (kind === 'name' && piece.kind !== 'ocean') || kind === 'flag'
      ? `${this.placed.length + 1} / ${this.level.rounds}`
      : nameOf(piece, NL());
    ctx.fillText(big, cx, r.y + 40 * u, r.w - 20 * u);
  }

  /** The tray: the piece waiting to be picked up, and a hand showing what to do with it. */
  private drawHand(r: Rect, piece: Feature | null): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.fillStyle = 'rgba(255, 253, 246, 0.72)';
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 70, 95, 0.18)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    roundRectPath(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 18 * u);
    ctx.stroke();
    ctx.restore();
    if (!piece) return;
    // while it is being carried or flying, the tray is empty
    if (this.drag || this.flight) return;
    this.drawPieceIn(piece, r, 0);
    // a hand at the edge of the tray on the very first piece of a level, so nobody has to be told
    // to drag - never over the piece itself, where it reads as a mark on the map
    if (this.placed.length === 0 && this.fb === 'none' && this.noteT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + breathe(this.t, 3) * 0.35;
      handCursor(ctx, r.x + r.w - 30 * u, r.y + r.h * 0.62, 13 * u, breathe(this.t, 3));
      ctx.restore();
    }
  }

  /** The piece drawn to fit a box: its shape, its pin, its flag or its name on a card. */
  private drawPieceIn(f: Feature, r: Rect, lifted: number): void {
    const ctx = this.ctx, u = this.u();
    const kx = VIEWS[this.level.board].kx;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const inner: Box = { x: r.x + 10 * u, y: r.y + 10 * u, w: r.w - 20 * u, h: r.h - 20 * u };
    const kind = pieceKindFor(this.level, f);
    if (kind === 'name') {
      const ocean = f.kind === 'ocean';
      const cw = Math.min(inner.w, 260 * u), ch = Math.min(inner.h, 56 * u);
      chunkyButton(ctx, cx - cw / 2, cy - ch / 2, cw, ch, { tone: ocean ? '#bfe0ee' : '#fff4d8' });
      ctx.fillStyle = ocean ? '#1c5a86' : '#7a3d10';
      ctx.font = this.font('900', ocean ? 15 : 18);
      ctx.textAlign = 'center';
      ctx.fillText(ocean ? nameOf(f, NL()) : capitalOf(f, NL()), cx, cy + 6 * u, cw - 18 * u);
      return;
    }
    if (kind === 'flag' && f.flag) {
      const fh = Math.min(inner.h * 0.9, 72 * u), fw = fh * 1.5;
      drawFlag(ctx, cx - fw / 2, cy - fh / 2, fw, fh, f.flag);
      return;
    }
    if (f.at) {
      drawPin(ctx, cx, cy + 16 * u, 20 * u, f.tone, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#123047';
      ctx.font = this.font('900', 13);
      ctx.fillText(nameOf(f, NL()), cx, cy + 40 * u, inner.w);
      return;
    }
    const rings = f.rings?.length ? f.rings : f.path ? [f.path] : [];
    if (!rings.length) return;
    const a = anchorOf(f);
    const s = scaleToFit(rings, inner, kx, 0.86, a);
    if (f.rings?.length) drawPieceAt(ctx, f.rings, a, s, kx, cx, cy, f.tone, lifted);
    else if (f.path) drawLineAt(ctx, f.path, a, s, kx, cx, cy, f.tone, Math.max(4, 6 * u));
  }

  /**
   * The piece under the finger, or on its way home.
   *
   * Once it is off the tray it is drawn at the map's own scale, so it is exactly as big as the
   * hole it is going into. That is the whole feel of the game: a child can see Zeeland fit.
   */
  private drawCarried(f: Feature, L: Layout, view: typeof VIEWS['nl']): void {
    const ctx = this.ctx, u = this.u();
    let at: Vec | null = null;
    let k = 1;
    if (this.drag) { at = this.drag; k = this.lift; } else if (this.flight) {
      const t = easeOutCubic(clamp(this.flight.t / this.flight.dur, 0, 1));
      at = {
        x: this.flight.from.x + (this.flight.to.x - this.flight.from.x) * t,
        y: this.flight.from.y + (this.flight.to.y - this.flight.from.y) * t,
      };
      k = this.flight.into ? 1 : 1 - t;
    }
    if (!at) return;
    const kx = view.kx;
    const mapS = fit(view, L.board).s;
    const rings = f.rings?.length ? f.rings : f.path ? [f.path] : [];
    const kind = pieceKindFor(this.level, f);
    if (kind === 'name' || kind === 'flag' || f.at) {
      // a card, a flag or a pin has no size on the map, so it simply follows the finger
      const box: Rect = { x: at.x - 90 * u, y: at.y - 34 * u, w: 180 * u, h: 68 * u };
      if (f.at) {
        drawPin(ctx, at.x, at.y, 14 * u, f.tone, true);
        ctx.textAlign = 'center';
        outlinedText(ctx, nameOf(f, NL()), at.x, at.y - 26 * u, this.font('900', 12),
          '#123047', 'rgba(255,255,255,0.95)', 4);
      } else {
        this.drawPieceIn(f, box, 1);
      }
      return;
    }
    if (!rings.length) return;
    const a = anchorOf(f);
    const trayS = scaleToFit(
      rings, { x: 0, y: 0, w: L.hand.w - 20 * u, h: L.hand.h - 20 * u }, kx, 0.86, a);
    const s = trayS + (mapS - trayS) * clamp(k, 0, 1);
    if (f.rings?.length) drawPieceAt(ctx, f.rings, a, s, kx, at.x, at.y, f.tone, 1);
    else if (f.path) drawLineAt(ctx, f.path, a, s, kx, at.x, at.y, f.tone, Math.max(3, 4 * u));
  }

  /**
   * Where the writing sits in the card.
   *
   * Upright the card is a strip just tall enough for a line and a fact. Turned on its side it is
   * a whole column and takes whatever the map does not want, which can be three hundred pixels -
   * and a heading pinned nineteen pixels from its top leaves a card that is two thirds empty. So
   * the heading and the fact are one block, and the block sits in the middle of whatever it got.
   */
  private cardTop(b: Rect): number {
    return b.y + Math.max(0, (b.h - 74 * this.u()) / 2);
  }

  /** The correction: what it really was, why it is worth knowing, and the way on. */
  private drawTeach(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    const p = this.shown;
    if (!p) return;
    const nl = NL();
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.96);
    const bw = 72 * u, bh = 38 * u;
    const textW = b.w - bw - 26 * u;
    const tx = b.x + 12 * u + textW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a5432a';
    ctx.font = this.font('900', 12.5);
    const top = this.cardTop(b);
    ctx.fillText(teachLine(p, this.missed, nl), tx, top + 15 * u, textW);
    ctx.fillStyle = 'rgba(18,48,71,0.8)';
    ctx.font = this.font('700', 10);
    this.wrapText(factOf(p, nl), tx, top + 48 * u, textW, 12 * u, 4);
    this.button('go', T('Next', 'Verder'), b.x + b.w - bw - 10 * u, b.y + (b.h - bh) / 2, bw, bh,
      '#4fae6e', '#ffffff');
  }

  /** After a right drop: the name in green, the fact, and the way into the animal book. */
  private drawFactCard(b: Rect, f: Feature, right: boolean): void {
    const ctx = this.ctx, u = this.u();
    const nl = NL();
    ctx.save();
    ctx.globalAlpha = clamp(this.fbT * 0.8, 0, 1);
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.95);
    // only where the question makes sense: a country or a whole continent
    const hasAnimals = !!f.cont && (f.kind === 'country' || f.kind === 'continent');
    const bw = 78 * u, bh = 36 * u;
    const textW = b.w - (hasAnimals ? bw + 26 * u : 24 * u);
    const tx = b.x + 12 * u + textW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = right ? '#2f7a4c' : '#a5432a';
    ctx.font = this.font('900', 13);
    const top = this.cardTop(b);
    ctx.fillText(nameOf(f, nl), tx, top + 15 * u, textW);
    ctx.fillStyle = 'rgba(18,48,71,0.8)';
    ctx.font = this.font('700', 10);
    this.wrapText(factOf(f, nl), tx, top + 48 * u, textW, 12 * u, 4);
    ctx.restore();
    if (hasAnimals && this.fbT > 0.4) {
      this.button(`animals:${f.cont}`, T('Animals', 'Dieren'),
        b.x + b.w - bw - 10 * u, b.y + (b.h - bh) / 2, bw, bh, '#c98a50', '#ffffff');
    }
  }

  /** The level's own hint, in the same strip, fading out on its own. */
  private drawNote(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    glassPanel(ctx, b.x, b.y, b.w, b.h, 16 * u, 0.9);
    ctx.fillStyle = 'rgba(18,48,71,0.85)';
    ctx.font = this.font('700', 10.5);
    ctx.textAlign = 'center';
    this.wrapText(this.note, b.x + b.w / 2, b.y + b.h / 2 + 3 * u, b.w - 26 * u, 13 * u, 4);
    ctx.restore();
  }

  private wrapText(text: string, cx: number, cy: number, maxW: number, lh: number, maxLines: number): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
      if (lines.length === maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh, maxW));
  }

  /** The bar across the top, and how far through the level you are. */
  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', T('Levels', 'Niveaus'), 13 * u, 9 * u, 82 * u, 40 * u);
    const nx = 13 * u + 89 * u;
    // the outline switch, but only where there is something for it to outline. On the water, the
    // capitals and the flags the piece is a line, a name or a flag, and the places it can go are
    // already drawn on the board - so the button had nothing to do there, and a button that does
    // nothing when a child presses it is worse than no button at all.
    const canOutline = outlinable(this.level);
    if (canOutline) {
      const on = save.atlas.outlines;
      const face = chunkyButton(ctx, nx, 9 * u, 44 * u, 40 * u, {
        tone: on ? '#f0b653' : '#fffdf6', pressed: this.held === 'outlines',
      });
      ctx.save();
      ctx.strokeStyle = on ? '#4a2f10' : '#1d4763';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([3 * u, 3 * u]);
      roundRectPath(ctx, nx + 12 * u, face.y + 12 * u, 20 * u, 16 * u, 4 * u);
      ctx.stroke();
      ctx.restore();
      this.hits.push({ id: 'outlines', x: nx, y: 9 * u, w: 44 * u, h: 40 * u });
    }

    // the dyke switch, beside it, only on the level that has one: a drawn dyke with the sea
    // against it, and the sea climbs as the switch goes round
    if (this.level.dykes) {
      const dx = canOutline ? nx + 51 * u : nx;
      const tone = this.sea == null ? '#fffdf6' : this.sea === SEA_OFF ? '#6fb8d8' : '#3f86bd';
      const df = chunkyButton(ctx, dx, 9 * u, 44 * u, 40 * u, { tone, pressed: this.held === 'dykes' });
      ctx.save();
      ctx.translate(dx + 22 * u, df.y + 20 * u);
      const wet = this.sea == null ? 5 * u : this.sea === SEA_OFF ? 0 : -5 * u;
      ctx.fillStyle = this.sea == null ? '#5fb5e0' : '#1c5a86';
      ctx.beginPath();
      ctx.rect(-16 * u, wet, 13 * u, 12 * u - wet);
      ctx.fill();
      ctx.fillStyle = '#8a7f5a';
      ctx.beginPath();
      ctx.moveTo(-4 * u, 12 * u); ctx.lineTo(-1 * u, -6 * u);
      ctx.lineTo(4 * u, -6 * u); ctx.lineTo(7 * u, 12 * u);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.sea == null ? '#9ec37a' : '#1c5a86';
      ctx.fillRect(6 * u, 4 * u, 10 * u, 8 * u);
      ctx.restore();
      this.hits.push({ id: 'dykes', x: dx, y: 9 * u, w: 44 * u, h: 40 * u });
    }

    const n = this.level.rounds;
    const dot = 4.5 * u, gap = 4.5 * u;
    const total = n * dot * 2 + (n - 1) * gap;
    const dx = this.w / 2 - total / 2;
    const dy = this.h - 9 * u;
    for (let i = 0; i < n; i++) {
      const done = i < this.placed.length;
      ctx.fillStyle = done ? 'rgba(79, 174, 110, 0.95)'
        : i === this.placed.length ? 'rgba(18,48,71,0.6)' : 'rgba(18,48,71,0.2)';
      ctx.beginPath();
      ctx.arc(dx + dot + i * (dot * 2 + gap), dy, dot * (i === this.placed.length ? 1.25 : 1), 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  private button(
    id: string, label: string, x: number, y: number, w: number, h: number,
    tone = '#fffdf6', ink = '#25506e',
  ): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 46 * this.u() ? 15 : 12.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 14);
    this.hits.push({ id, x, y, w, h });
  }

  // ---------------------------------------------------------------- the card at the end

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(12, 32, 52, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.pop, 0, 1));
    const cw = Math.min(348 * u, this.w - 30 * u);
    const ch = Math.min(272 * u, this.h - 36 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 24 * u, 0.97);
    ctx.save();
    ctx.beginPath(); roundRectPath(ctx, x, y, cw, ch, 24 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 86 * u);
    band.addColorStop(0, this.earned > 0 ? '#8fd6e8' : '#f0c78a');
    band.addColorStop(1, 'rgba(143, 214, 232, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 86 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = this.font('900', 16);
    const title = this.wrapOne(levelName(this.level), cw - 36 * u);
    heading(ctx, title, this.w / 2, y + 40 * u, this.font('900', 16), '#123047');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.pop * 1.6 - i * 0.25, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 1) * 40 * u, y + 86 * u, 17 * u,
        i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.78)';
    ctx.font = this.font('800', 12.5);
    ctx.fillText(T(`${this.firstTry} of ${this.level.rounds} right first time`,
      `${this.firstTry} van de ${this.level.rounds} in één keer goed`), this.w / 2, y + 128 * u, cw - 36 * u);
    ctx.fillStyle = 'rgba(18,48,71,0.6)';
    ctx.font = this.font('700', 11.5);
    this.wrapText(this.earned === 3
      ? T('Every one straight onto its place.', 'Allemaal meteen op de goede plek.')
      : this.earned === 0
        ? T('The map showed you most of them. Look once more.', 'De kaart wees de meeste aan. Kijk nog eens.')
        : T('Good. The ones the map showed you are the ones to look at again.',
          'Goed. De plekken die de kaart aanwees zijn de plekken om nog eens te bekijken.'),
    this.w / 2, y + 152 * u, cw - 36 * u, 14 * u, 2);
    ctx.restore();

    const bw = Math.min(136 * u, (cw - 28 * u) / 2), bh = 48 * u, by = y + ch - 66 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 5 * u, by, bw, bh);
    if (nextLevel(this.level.id)) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 5 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 5 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private wrapOne(text: string, maxW: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxW) return text;
    let out = text;
    while (out.length > 4 && ctx.measureText(`${out}…`).width > maxW) out = out.slice(0, -1);
    return `${out}…`;
  }

  // ---------------------------------------------------------------- the ladder

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    heading(ctx, T('World atlas', 'Wereldatlas'), this.w / 2, 44 * u, this.font('900', 23), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 11.5);
    ctx.fillText(T('From your own province outward to the whole world.',
      'Van je eigen provincie naar de hele wereld.'), this.w / 2, 66 * u);

    const cols = this.w > 640 * u ? 4 : this.w > 440 * u ? 3 : 2;
    const pad = 10 * u;
    const cw = Math.min(190 * u, (this.w - 22 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.62;
    const chh = art + 48 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 82 * u;
    const rows = Math.ceil(LEVELS.length / cols);
    const needed = rows * chh + (rows - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 14 * u) / needed);

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
      const appear = easeOutBack(clamp(this.pop * 1.5 - i * 0.045, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.26)';
      ctx.shadowBlur = 14 * u;
      ctx.shadowOffsetY = 4 * u;
      ctx.fillStyle = '#fffdf8';
      roundRectPath(ctx, x, y, cw, chh, 15 * u);
      ctx.fill();
      ctx.restore();

      // the card's own little map: the board this level is played on
      const thumb: Box = { x: x + 8 * u, y: y + 6 * u, w: cw - 16 * u, h: art - 6 * u };
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.45;
      this.drawThumb(L, thumb);
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.5)';
      ctx.beginPath(); ctx.arc(x + 18 * u, y + 18 * u, 11 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 10.5);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 18 * u, y + 22 * u);

      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.6)';
      ctx.font = this.font('900', 11);
      this.wrapText(levelName(L), x + cw / 2, y + art + 13 * u, cw - 12 * u, 12.5 * u, 2);
      for (let s = 0; s < 3; s++) {
        drawStar(ctx, x + cw / 2 + (s - 1) * 17 * u, y + art + 34 * u, 7 * u, s < p.stars);
      }
      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        roundRectPath(ctx, -11 * u, -6 * u, 22 * u, 17 * u, 4 * u);
        ctx.fill(); ctx.stroke();
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

  /** A level card's picture: the board it is played on, with a couple of its pieces already down. */
  private drawThumb(L: Level, box: Box): void {
    const ctx = this.ctx;
    const view = VIEWS[L.board];
    const inner = this.boardBox(box, view);
    drawSea(ctx, inner, Math.min(inner.w, inner.h) * 0.06);
    ctx.save();
    roundRectPath(ctx, inner.x, inner.y, inner.w, inner.h, Math.min(inner.w, inner.h) * 0.06);
    ctx.clip();
    for (const f of boardFor(L)) {
      drawShape(ctx, f.rings ?? [], view, inner, { fill: '#d9cfae', stroke: 'rgba(255,255,255,0.7)', width: 0.8 });
    }
    const pool = poolFor(L);
    const some = pool.slice(0, Math.min(4, pool.length));
    for (const f of some) {
      if (f.rings?.length) {
        drawShape(ctx, f.rings, view, inner, { fill: f.tone, stroke: 'rgba(255,255,255,0.9)', width: 1 });
      } else if (f.path?.length) {
        drawLine(ctx, f.path, view, inner, f.tone, 2, false);
      } else if (f.at) {
        const q = project(f.at, view, inner);
        drawPin(ctx, q.x, q.y, 5, f.tone);
      }
    }
    if (L.piece === 'flag') {
      const f = pool[0];
      if (f?.flag) drawFlag(ctx, inner.x + inner.w * 0.32, inner.y + inner.h * 0.34, inner.w * 0.36, inner.w * 0.24, f.flag);
    }
    ctx.restore();
    ctx.strokeStyle = hexA(INK, 0.2);
    ctx.lineWidth = 1;
    roundRectPath(ctx, inner.x + 0.5, inner.y + 0.5, inner.w - 1, inner.h - 1, Math.min(inner.w, inner.h) * 0.06);
    ctx.stroke();
  }
}
