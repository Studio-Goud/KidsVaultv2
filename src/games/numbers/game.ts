/**
 * Rekenrijk - arithmetic you can pick up, in Braambos.
 *
 * Marktdag counts to about ten and stops. This is the ladder after that, and the rule it is
 * built on is that every sum is something you can see and move. There is no screen in this game
 * where a row of symbols sits with an empty box at the end and nothing else to go on: the numbers
 * are beads on a rack, apples in a crate, counters in a ten-frame, rods and cubes on a tray, a peg
 * walking a number line, rows of apples in a crate. The child does the sum by moving them, and the
 * written sum underneath fills itself in while they do it, so the figures end up as a description
 * of something they have already done.
 *
 * Three things it does deliberately:
 *  - the answer buttons do not appear until the objects have been arranged. A level where the
 *    numerals could be tapped straight away would be a worksheet with a picture beside it;
 *  - the step over the ten is shown rather than hidden. "8 + 5" fills the frame to ten first and
 *    then counts on the three, and "27 + 8" jumps to thirty on the line before it jumps the rest,
 *    because that is the strategy Dutch schools actually teach and a game that skips to the answer
 *    teaches the child to guess;
 *  - a wrong answer is not a loss. The objects rearrange themselves and count the right answer out
 *    in front of you, the sum is written and said in words, and then you tap on. Stars are for
 *    what was right first time; nothing locks and nothing fails.
 *
 * The arithmetic itself - which sums each level may ask, and which wrong answers are worth putting
 * beside the right one - is in `model.ts`, which has no canvas in it and is tested.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, breathe, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor,
  heading, hexA, outlinedText, Particles, Shake, vignette,
} from '../../render/look';
import {
  inRule, keyOf, LEVELS, makeQuestion, optionsFor, parMsFor, rngFor, starsFor, targetOf, teachLine,
  type Level, type Question,
} from './model';
import {
  cleanTopics, nextStep, pickNext, recordTopic, topicOf, type Topics,
} from '../../platform/skill';
import { masteryRing, nextRing } from '../../platform/progress';
import { numberWord, sumSymbols, sumWords } from './numberwords';
import {
  apple, appleSlot, arrayGeo, arrayHandle, bead, crate, crateFront, cube, drawArray, drawCrateOfApples,
  drawHop, drawNumberLine, drawPeg, drawRack, drawSum, drawTenFrame, drawTray, drawYard, frameGeo,
  frameSlot, lineAt, lineX, piecesOf, rackBeadX, rackDividerX, rackGeo, rackSplitAt, rod, stageMat,
  type ArrayGeo, type FrameGeo, type LineGeo, type RackGeo, type Rect,
} from './paint';
import { numbersfx } from './numbersfx';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `numbers:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
/** Something on the table you can pick up or push. Round things are hit as circles. */
interface Grab { id: string; x: number; y: number; w: number; h: number; round?: boolean }

interface Layout {
  card: Rect;
  stage: Rect;
  caption: Rect;
  opts: Rect[];
  optArea: Rect;
  wide: boolean;
}

/** How long a right answer and a correction stay on screen before the next question. */
const RIGHT_FOR = 1.6;
const WRONG_FOR = 6.5;
/** Answering inside this many seconds counts as fast, on the level that watches for it. */
const FAST_AT = 7;

export class Numbers {
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
  private rng = rngFor(LEVELS[0], 0);
  private attempt = 0;
  private round = 0;
  private q: Question = makeQuestion(LEVELS[0], rngFor(LEVELS[0], 0), 0);
  private recent: string[] = [];
  /**
   * How firm the ground is under each of the nine subjects, and what that says to ask next.
   *
   * The levels are not a staircase - splitting ten and the tables of seven are different things,
   * not harder and easier versions of one thing - so each keeps its own footing, and a child who
   * is sure of one and shaky on another is offered the right next question in both.
   */
  private topics: Topics = {};
  /** 0 to 1: how hard this run of the level should be, which here means how many buttons */
  private diff = 0.3;
  /** how many goes this question has taken, for judging how it went */
  private tries = 0;

  /** what the child has done to the objects */
  private split = 0;
  /** the divider has been moved at least once, so the split on the card means something */
  private touched = false;
  private mergeT = 0;
  private mergeGoal = 0;
  private taken = 0;
  private inFrame = 0;
  private placedRods = 0;
  private placedCubes = 0;
  private at = 0;
  private rows = 1;
  private cols = 1;

  private firstTry = 0;
  private wrongCount = 0;
  private streak = 0;
  private earned = 0;
  private fastStreak = 0;
  private fade = 0;
  private askedAt = 0;
  private lastSecs = 0;

  private fb: 'none' | 'right' | 'wrong' = 'none';
  private fbT = 0;
  private given: number | null = null;
  /** 0 to 1 while the objects show the right answer being made */
  private teachT = 0;

  private drag: string | null = null;
  private dragFrom: Vec = { x: 0, y: 0 };
  private dragBase = 0;
  private moved = false;
  private carry: { id: string; x: number; y: number } | null = null;

  private hits: Hit[] = [];
  private grabs: Grab[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private note = '';
  private noteT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.topics = cleanTopics(save.topics?.numbers, LEVELS.map(l => l.id));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __numbers?: Numbers }).__numbers = this;
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
  back(): void { this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase,
      level: this.level.id,
      levelIndex: this.levelIndex,
      round: this.round,
      rounds: this.level.rounds,
      op: this.q.op,
      stage: this.q.stage,
      a: this.q.a,
      b: this.q.b,
      answer: this.q.answer,
      options: this.q.options.slice(),
      correct: this.q.correct,
      inRule: inRule(this.level, this.q),
      diff: Number(this.diff.toFixed(3)),
      mastery: Number((this.topics[this.level.id]?.level ?? 0).toFixed(3)),
      sum: sumSymbols(this.q.op, this.q.a, this.q.b, this.q.answer),
      wordsNl: sumWords(this.q.op, this.q.a, this.q.b, this.q.answer, true),
      wordsEn: sumWords(this.q.op, this.q.a, this.q.b, this.q.answer, false),
      ready: this.ready(),
      moved: this.movedSoFar(),
      needs: targetOf(this.q),
      objects: {
        split: this.split, merge: Number(this.mergeT.toFixed(2)), taken: this.taken,
        inFrame: this.inFrame, placed: this.placedRods * 10 + this.placedCubes,
        at: this.at, rows: this.rows, cols: this.cols,
      },
      feedback: this.fb,
      firstTry: this.firstTry,
      wrong: this.wrongCount,
      streak: this.streak,
      stars: this.earned,
      countOn: save.numbers.countOn,
      safeTop: this.st,
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
      grabs: this.grabs.map(g => ({ id: g.id, x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.w / 2) })),
    };
  }

  // ---------- layout ----------

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

  private grid(r: Rect, n: number, cols: number, gap: number): Rect[] {
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = (r.w - gap * (cols - 1)) / cols;
    const ch = (r.h - gap * (rows - 1)) / rows;
    const out: Rect[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, row = Math.floor(i / cols);
      out.push({ x: r.x + c * (cw + gap), y: r.y + row * (ch + gap), w: cw, h: ch });
    }
    return out;
  }

  /**
   * Where everything goes.
   *
   * Upright: the question and the written sum on a card at the top, the objects in the middle
   * where two hands can reach them, a caption strip under them, and the answers along the bottom
   * in reach of a thumb. Turned on its side the objects take the left half and the words stack
   * down the right, because a number line in a 390-pixel-tall window is not a number line.
   */
  private layout(): Layout {
    const u = this.u(), w = this.w, h = this.h;
    const pad = 14 * u;
    const wide = w > h * 1.3;
    const n = Math.max(1, this.q.options.length);
    const gap = 9 * u;
    const top = 62 * u;
    const cardH = (this.q.step ? 118 : 96) * u;
    const capH = 30 * u;

    if (wide) {
      const colX = Math.max(w * 0.48, w - 400 * u);
      const rightW = w - colX - pad;
      const card: Rect = { x: colX, y: top, w: rightW, h: cardH };
      const caption: Rect = { x: colX, y: card.y + cardH + 7 * u, w: rightW, h: capH };
      const optTop = caption.y + capH + 10 * u;
      const optArea: Rect = { x: colX, y: optTop, w: rightW, h: Math.max(60 * u, h - optTop - 16 * u) };
      const rows = Math.ceil(n / 2);
      const btnH = Math.min(58 * u, (optArea.h - gap * (rows - 1)) / rows);
      const stackH = btnH * rows + gap * (rows - 1);
      const area: Rect = { x: optArea.x, y: optArea.y + (optArea.h - stackH) / 2, w: rightW, h: stackH };
      return {
        card, caption, optArea,
        opts: this.grid(area, n, 2, gap),
        stage: { x: pad, y: top, w: colX - pad * 2, h: h - top - 16 * u },
        wide,
      };
    }

    // a tall phone has room to spare once the objects have what they need, and the best place for
    // it is the buttons a thumb has to hit and the card the sum is written on - not more empty mat
    const rows = Math.ceil(n / 2);
    const free = Math.max(0, h - (top + cardH + 8 * u + capH + 8 * u + 16 * u)
      - this.want() - (54 * u * rows + gap * (rows - 1)) - 10 * u);
    const btnH = 54 * u + Math.min((free * 0.5) / rows, 46 * u);
    const cardTall = cardH + Math.min(free * 0.45, 84 * u);
    const card: Rect = { x: pad, y: top, w: w - pad * 2, h: cardTall };
    const stackH = btnH * rows + gap * (rows - 1);
    const bottom = h - 26 * u;
    const optArea: Rect = { x: pad, y: bottom - stackH, w: w - pad * 2, h: stackH };
    const caption: Rect = { x: pad, y: optArea.y - capH - 8 * u, w: w - pad * 2, h: capH };
    return {
      card, caption, optArea,
      opts: this.grid(optArea, n, 2, gap),
      stage: { x: pad, y: card.y + cardTall + 8 * u, w: w - pad * 2, h: caption.y - (card.y + cardTall) - 16 * u },
      wide,
    };
  }

  // ---------- the objects, and where they are ----------

  /**
   * The patch of table this stage actually needs.
   *
   * A bead rack is a wide flat thing and a ten-frame is not, so giving every stage the whole of
   * the middle of the screen leaves one of them floating in a field of empty mat. Each stage says
   * how tall it wants to be, and gets that much, centred.
   */
  private want(): number {
    return ({ rack: 200, crates: 230, frame: 400, blocks: 470, line: 250, array: 620 }[this.q.stage] ?? 300) * this.u();
  }

  private box(s: Rect): Rect {
    const h = Math.min(s.h, this.want());
    // what is left over sits under the objects rather than around them: a rack hanging in the
    // middle of a tall empty field reads as a mistake, a rack sitting up near its sum does not
    return { x: s.x, y: s.y + (s.h - h) * 0.32, w: s.w, h };
  }

  private rackG(s: Rect): RackGeo {
    return rackGeo({ x: s.x + 6, y: s.y + s.h * 0.1, w: s.w - 12, h: s.h * 0.6 }, this.q.a);
  }

  /** The big crate, the little crate and, on a taking-away question, the basket beside it. */
  /** How many rows of five a crate of this many apples needs. */
  private crateRows(): number {
    const n = this.q.op === 'sub' ? this.q.a : this.q.a + this.q.b;
    return Math.max(1, Math.ceil(n / 5));
  }

  private crateG(s: Rect): { big: Rect; small: Rect; smallX0: number; smallX1: number; basket: Rect; rows: number } {
    const u = this.u();
    const rows = this.crateRows();
    if (this.q.op === 'sub') {
      // the crate on the left, the basket the apples go into on the right, standing on the same
      // line: a picture of taking away rather than of two separate boxes
      const bw = Math.min(s.w * 0.54, s.h * 1.7);
      const bh = Math.min(bw * (0.2 + rows * 0.2), s.h * 0.62);
      const big: Rect = { x: s.x + 4 * u, y: s.y + s.h * 0.46 - bh / 2, w: bw, h: bh };
      const per = Math.max(1, Math.min(5, this.q.b));
      const bkRows = Math.max(1, Math.ceil(this.q.b / per));
      const bkw = Math.max(70 * u, s.w - bw - 22 * u);
      const bkh = Math.min(bkw * (0.2 + bkRows * 0.2), bh);
      return {
        big, rows,
        small: { x: s.x + s.w, y: big.y, w: 1, h: 1 },
        smallX0: 0, smallX1: 0,
        basket: { x: s.x + s.w - bkw - 4 * u, y: big.y + bh - bkh, w: bkw, h: bkh },
      };
    }
    const bw = Math.min(s.w * 0.6, s.h * 1.6);
    // a crate is as deep as the apples in it: a sum to five in a two-row crate is half empty box
    const bh = Math.min(bw * (0.2 + rows * 0.18), s.h * 0.5);
    const big: Rect = { x: s.x + (s.w - bw) / 2, y: s.y + s.h * 0.4 - bh / 2, w: bw, h: bh };
    const sw = Math.max(bw * 0.22, (bw * Math.max(1, Math.min(5, this.q.b))) / 9);
    const smallX1 = s.x + s.w - sw;
    const smallX0 = big.x + bw + 5;
    const x = smallX1 + (smallX0 - smallX1) * clamp(this.mergeT, 0, 1);
    return {
      big, rows,
      small: { x, y: big.y + bh * 0.1, w: sw, h: bh * 0.9 },
      smallX0, smallX1,
      basket: { x: s.x + s.w - bw * 0.5, y: big.y, w: bw * 0.5, h: bh },
    };
  }

  private frameG(s: Rect): { frame: FrameGeo; tray: Rect; looseR: number } {
    const frame = frameGeo({ x: s.x, y: s.y + s.h * 0.02, w: s.w, h: s.h * 0.46 });
    const tray: Rect = { x: s.x + s.w * 0.04, y: s.y + s.h * 0.58, w: s.w * 0.92, h: s.h * 0.34 };
    return { frame, tray, looseR: Math.min(frame.cell * 0.34, tray.h * 0.34) };
  }

  private looseSlot(tray: Rect, i: number, n: number, r: number): Vec {
    const per = Math.max(1, Math.min(n, Math.floor(tray.w / (r * 2.4)) || 1));
    const rows = Math.ceil(n / per);
    const col = i % per, row = Math.floor(i / per);
    const usedW = per * r * 2.4;
    return {
      x: tray.x + (tray.w - usedW) / 2 + r * 1.2 + col * r * 2.4,
      y: tray.y + tray.h / 2 + (row - (rows - 1) / 2) * r * 2.3,
    };
  }

  private blockG(s: Rect): { tray: Rect; shelf: Rect; line: LineGeo; cell: number } {
    const tray: Rect = { x: s.x, y: s.y + s.h * 0.02, w: s.w, h: s.h * 0.56 };
    const shelf: Rect = { x: s.x, y: s.y + s.h * 0.62, w: s.w, h: s.h * 0.22 };
    const totalRods = piecesOf(this.q.a).rods + piecesOf(this.q.b).rods + 1;
    const cell = Math.min(tray.w / 11.5, tray.h / Math.max(3.4, totalRods + 1.4));
    const u = this.u();
    return {
      tray, shelf, cell,
      line: { x: s.x + 16 * u, y: s.y + s.h * 0.93, w: s.w - 32 * u, lo: this.q.line?.lo ?? 0, hi: this.q.line?.hi ?? 100 },
    };
  }

  /** Where a piece of a number sits on the tray: rods stacked, cubes in a row under them. */
  private trayPiece(g: { tray: Rect; cell: number }, kind: 'rod' | 'cube', i: number, rodsBefore: number, cubesBefore: number): Rect {
    const c = g.cell;
    const x0 = g.tray.x + c * 0.5;
    if (kind === 'rod') return { x: x0, y: g.tray.y + c * 0.4 + (rodsBefore + i) * c * 1.12, w: c * 10, h: c };
    const per = 10;
    const col = (cubesBefore + i) % per, row = Math.floor((cubesBefore + i) / per);
    return {
      x: x0 + col * c * 1.06,
      y: g.tray.y + c * 0.4 + (rodsBefore) * c * 1.12 + c * 0.35 + row * c * 1.12,
      w: c * 0.9, h: c * 0.9,
    };
  }

  private lineG(s: Rect): LineGeo {
    const u = this.u();
    return {
      x: s.x + 22 * u, y: s.y + s.h * 0.6, w: s.w - 44 * u,
      lo: this.q.line?.lo ?? 0, hi: this.q.line?.hi ?? 100,
    };
  }

  private arrayG(s: Rect): ArrayGeo {
    return arrayGeo({ x: s.x + 8, y: s.y + 6, w: s.w - 16, h: s.h - 12 }, 10, 10);
  }

  // ---------- has the sum been done with the objects yet ----------

  private movedSoFar(): number {
    switch (this.q.stage) {
      case 'rack': return this.split;
      case 'crates': return this.q.op === 'sub' ? this.taken : (this.mergeT >= 0.999 ? 1 : 0);
      case 'frame': return this.inFrame;
      case 'blocks': return this.placedRods * 10 + this.placedCubes;
      case 'line': return this.at;
      case 'array': return this.rows * this.cols;
      default: return 0;
    }
  }

  private ready(): boolean {
    const q = this.q;
    switch (q.stage) {
      case 'rack': return this.split === q.b;
      case 'crates': return q.op === 'sub' ? this.taken === q.b : this.mergeT >= 0.999;
      case 'frame': return q.step ? this.inFrame === q.step.first : this.inFrame === q.b;
      case 'blocks': return this.placedRods * 10 + this.placedCubes === q.b;
      case 'line': return q.step ? this.at >= q.step.to : this.at === q.b;
      case 'array': return this.rows === q.a && this.cols === q.b;
      default: return true;
    }
  }

  /** What to do next, in one line, for the strip where the answers will be. */
  private todo(): string {
    const q = this.q;
    const nl = NL();
    switch (q.stage) {
      case 'rack':
        return nl ? `Schuif de scheiding tot er ${q.b} links liggen.` : `Slide the divider until ${q.b} are on the left.`;
      case 'crates':
        return q.op === 'sub'
          ? (nl ? `Haal er ${q.b} uit de kist. Er zijn er ${this.taken} uit.` : `Take ${q.b} out of the crate. ${this.taken} so far.`)
          : (nl ? 'Schuif de kleine kist tegen de grote aan.' : 'Push the small crate against the big one.');
      case 'frame':
        return nl ? 'Leg er appels bij tot het tienveld vol is.' : 'Move apples in until the ten-frame is full.';
      case 'blocks':
        return nl ? `Leg ${q.b} op de plank: staven van tien, blokjes van één.` : `Put ${q.b} on the tray: rods of ten, cubes of one.`;
      case 'line':
        return q.step
          ? (nl ? `Sleep de pion naar ${q.step.to}.` : `Drag the peg to ${q.step.to}.`)
          : (nl ? `Sleep de pion van ${q.a} naar ${q.b}.` : `Drag the peg from ${q.a} to ${q.b}.`);
      case 'array':
        return nl ? `Maak ${q.a} rijen van ${q.b}.` : `Make ${q.a} rows of ${q.b}.`;
      default:
        return '';
    }
  }

  // ---------- the run of a level ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.diff = nextStep(topicOf(this.topics, this.level.id)).difficulty;
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.round = 0;
    this.firstTry = 0;
    this.wrongCount = 0;
    this.streak = 0;
    this.earned = 0;
    this.fastStreak = 0;
    this.fade = 0;
    this.recent = [];
    this.ps.clear();
    this.cardPop = 0;
    this.phase = 'play';
    this.nextQuestion();
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

  private nextQuestion(): void {
    this.q = makeQuestion(this.level, this.rng, this.round, this.recent, optionsFor(this.level, this.diff));
    this.tries = 0;
    this.recent.push(keyOf(this.q));
    if (this.recent.length > 4) this.recent.shift();
    this.fb = 'none';
    this.fbT = 0;
    this.teachT = 0;
    this.given = null;
    this.drag = null;
    this.carry = null;
    this.cardPop = 0;
    this.askedAt = this.t;
    // the objects, set out as the question asks rather than as the answer
    this.split = this.q.stage === 'rack' ? this.q.a : 0;
    this.touched = false;
    this.mergeT = 0;
    this.mergeGoal = 0;
    this.taken = 0;
    this.inFrame = 0;
    this.placedRods = 0;
    this.placedCubes = 0;
    this.at = this.q.a;
    this.rows = 1;
    this.cols = 1;
  }

  private answer(value: number, index: number): void {
    if (this.fb !== 'none') return;
    this.given = index;
    this.lastSecs = Math.max(0, this.t - this.askedAt);
    const L = this.layout();
    this.tries++;
    if (value === this.q.answer) {
      this.fb = 'right';
      this.fbT = RIGHT_FOR;
      this.firstTry++;
      this.streak++;
      numbersfx.right(this.streak);
      this.ps.spawn('spark', L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h / 2, 16,
        { colour: '#ffd873', speed: 260, size: 12 * this.u(), max: 0.9, spread: TAU });
      // the last level watches how fast, and fades the apples out for a child who no longer needs
      // to count them. It never speeds anything up and never takes a star away.
      if (this.lastSecs <= FAST_AT) this.fastStreak++; else this.fastStreak = 0;
    } else {
      this.fb = 'wrong';
      this.fbT = WRONG_FOR;
      this.wrongCount++;
      this.streak = 0;
      this.fastStreak = 0;
      this.shake.add(0.45);
      numbersfx.wrong();
      // the objects now make the right answer themselves
      this.settle();
    }
    this.noteAttempt(value === this.q.answer);
  }

  /**
   * What just happened, told to the engine that decides what comes next.
   *
   * It is told the plain facts - right or wrong, how long it took, how many goes - and nothing
   * about the child. What comes back is one number for how hard the next run of this subject
   * should be, and the only thing that number touches here is how many answers are on offer.
   */
  private noteAttempt(correct: boolean): void {
    this.topics = recordTopic(this.topics, this.level.id, {
      correct,
      ms: Math.round(this.lastSecs * 1000),
      parMs: parMsFor(this.level),
      // the objects on the table are the whole game, so using them is not taking help; asking for
      // every object to wear its number is
      hints: save.numbers.countOn ? 1 : 0,
      tries: this.tries,
    });
    save.topics = { ...save.topics, numbers: this.topics };
    persist();
  }

  /** Put the objects where the right answer says they should be, for the correction. */
  private settle(): void {
    const q = this.q;
    if (q.stage === 'rack') { this.split = q.b; this.touched = true; }
    if (q.stage === 'crates') { if (q.op === 'sub') this.taken = q.b; else { this.mergeT = 1; this.mergeGoal = 1; } }
    if (q.stage === 'frame' && q.step) this.inFrame = q.step.first;
    if (q.stage === 'blocks') { const p = piecesOf(q.b); this.placedRods = p.rods; this.placedCubes = p.cubes; }
    if (q.stage === 'array') { this.rows = q.a; this.cols = q.b; }
  }

  private advance(): void {
    this.round++;
    if (this.round >= this.level.rounds) {
      this.earned = starsFor(this.firstTry, this.level.rounds);
      recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
      persist();
      this.phase = 'won';
      this.cardPop = 0;
      numbersfx.complete();
      return;
    }
    this.nextQuestion();
  }

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.8);
    // the crate slides home by itself once it is let go
    if (this.drag !== 'crate') {
      const d = this.mergeGoal - this.mergeT;
      if (Math.abs(d) > 0.001) this.mergeT += Math.sign(d) * Math.min(Math.abs(d), dt * 4);
      else this.mergeT = this.mergeGoal;
    }
    const wantFade = this.level.id === 'tafels' && this.fastStreak >= 3 ? 1 : 0;
    this.fade += clamp(wantFade - this.fade, -dt * 0.8, dt * 0.8);
    if (this.phase !== 'play') return;
    if (this.fb !== 'none') {
      this.fbT -= dt;
      this.teachT = Math.min(1, this.teachT + dt / (this.fb === 'wrong' ? 3.2 : 1.1));
      if (this.fbT <= 0) this.advance();
    }
  }

  // ---------- input ----------

  private at2(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private grabAt(p: Vec): Grab | null {
    for (const g of this.grabs) {
      if (g.round) { if (Math.hypot(p.x - g.x, p.y - g.y) <= g.w / 2) return g; }
      else if (p.x >= g.x - g.w / 2 && p.x <= g.x + g.w / 2 && p.y >= g.y - g.h / 2 && p.y <= g.y + g.h / 2) return g;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at2(e);
    const hit = this.hitAt(p);
    if (hit) { this.held0 = hit; this.press(hit); return; }
    if (this.phase !== 'play') return;
    // while the correction is running, a tap anywhere carries on
    if (this.fb === 'wrong') { if (this.fbT < WRONG_FOR - 1.1) this.advance(); return; }
    if (this.fb !== 'none') return;
    const g = this.grabAt(p);
    if (!g) return;
    this.drag = g.id;
    this.dragFrom = p;
    this.moved = false;
    this.dragBase = g.id === 'crate' ? this.mergeT : 0;
    if (g.id.startsWith('loose') || g.id.startsWith('crateapple') || g.id.startsWith('shelf')) {
      this.carry = { id: g.id, x: p.x, y: p.y };
      numbersfx.lift();
    } else {
      numbersfx.pick();
    }
    this.dragTo(p);
  }

  private press(id: string): void {
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { numbersfx.tap(); this.start(i); } else numbersfx.wrong();
      return;
    }
    if (id === 'levels') { this.phase = 'levels'; this.cardPop = 0; numbersfx.tap(); return; }
    if (id === 'count') {
      save.numbers.countOn = !save.numbers.countOn;
      persist();
      numbersfx.tap();
      this.say(save.numbers.countOn
        ? T('Counting on. Every object says its number.', 'Meetellen aan. Elk ding zegt zijn getal.')
        : T('Counting off.', 'Meetellen uit.'), 2.2);
      return;
    }
    if (id === 'retry') { numbersfx.tap(); this.start(this.levelIndex); return; }
    if (id === 'next') { numbersfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id === 'go') { if (this.fb !== 'none') this.advance(); return; }
    if (id.startsWith('opt:')) {
      const i = Number(id.slice(4));
      const o = this.q.options[i];
      if (o != null && this.fb === 'none' && this.ready()) { numbersfx.pick(); this.answer(o, i); }
      return;
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.drag) return;
    const p = this.at2(e);
    if (Math.hypot(p.x - this.dragFrom.x, p.y - this.dragFrom.y) > 6) this.moved = true;
    if (this.carry) { this.carry.x = p.x; this.carry.y = p.y; }
    this.dragTo(p);
  }

  /** Drive whatever is being held from where the finger is. */
  private dragTo(p: Vec): void {
    const L = this.layout();
    const s = this.box(L.stage);
    const id = this.drag;
    if (!id) return;
    if (id === 'divider') {
      const g = this.rackG(s);
      const k = rackSplitAt(g, p.x);
      if (k !== this.split) { this.split = k; this.touched = true; numbersfx.bead(); }
      return;
    }
    if (id === 'crate') {
      const c = this.crateG(s);
      const travel = c.smallX1 - c.smallX0;
      if (Math.abs(travel) < 1) return;
      const k = clamp(this.dragBase + (this.dragFrom.x - p.x) / travel, 0, 1);
      this.mergeT = k;
      this.mergeGoal = k >= 0.999 ? 1 : k;
      return;
    }
    if (id === 'peg') {
      const g = this.lineG(s);
      const k = this.q.step ? clamp(lineAt(g, p.x), this.q.a, g.hi) : lineAt(g, p.x);
      if (k !== this.at) { this.at = k; numbersfx.hop(Math.abs(k - this.q.a)); }
      return;
    }
    if (id === 'handle') {
      const g = this.arrayG(s);
      const c = clamp(Math.round((p.x - g.x) / g.cell), 1, g.maxCols);
      const r = clamp(Math.round((p.y - g.y) / g.cell), 1, g.maxRows);
      if (c !== this.cols || r !== this.rows) {
        this.cols = c; this.rows = r;
        numbersfx.bead();
      }
    }
  }

  private onUp(e: PointerEvent): void {
    const p = this.at2(e);
    const id = this.drag;
    this.held0 = null;
    if (id) this.release(id, p);
    this.drag = null;
    this.carry = null;
  }

  /** What happens when something is let go: a drop that counts, or a tap that counts as a drop. */
  private release(id: string, p: Vec): void {
    const L = this.layout(), s = this.box(L.stage), q = this.q;
    if (id === 'crate') {
      // more than half way and it goes the rest of the way by itself; a tap sends it all the way
      this.mergeGoal = (!this.moved || this.mergeT > 0.45) ? 1 : 0;
      if (this.mergeGoal === 1 && this.mergeT < 1) numbersfx.drop(q.b);
      return;
    }
    if (id.startsWith('crateapple')) {
      const c = this.crateG(s);
      const inBasket = !this.moved || (p.x >= c.basket.x - 20 && p.y >= c.basket.y - 30);
      if (inBasket && this.taken < q.b) {
        this.taken++;
        numbersfx.drop(this.taken);
        this.ps.spawn('crumb', p.x, p.y, 5, { colour: '#e0553f', speed: 90, size: 5 * this.u(), max: 0.5 });
      }
      return;
    }
    if (id.startsWith('basketapple')) {
      if (this.taken > 0) { this.taken--; numbersfx.lift(); }
      return;
    }
    if (id.startsWith('loose')) {
      const g = this.frameG(s);
      const w = g.frame.cell * 5, hh = g.frame.cell * 2;
      const over = p.x >= g.frame.x - 20 && p.x <= g.frame.x + w + 20 && p.y >= g.frame.y - 20 && p.y <= g.frame.y + hh + 20;
      if ((over || !this.moved) && q.a + this.inFrame < 10) {
        this.inFrame++;
        numbersfx.drop(this.inFrame);
        if (q.a + this.inFrame === 10) numbersfx.tenFull();
      }
      return;
    }
    if (id.startsWith('framed')) {
      if (this.inFrame > 0) { this.inFrame--; numbersfx.lift(); }
      return;
    }
    if (id.startsWith('shelf')) {
      const g = this.blockG(s);
      const over = p.y <= g.tray.y + g.tray.h + 18 || !this.moved;
      if (!over) return;
      const isRod = id.startsWith('shelfrod');
      const have = piecesOf(q.b);
      if (isRod && this.placedRods < have.rods) { this.placedRods++; numbersfx.drop(this.placedRods); }
      if (!isRod && this.placedCubes < have.cubes) { this.placedCubes++; numbersfx.drop(this.placedCubes + 4); }
      return;
    }
    if (id.startsWith('tray')) {
      const isRod = id.startsWith('trayrod');
      if (isRod && this.placedRods > 0) { this.placedRods--; numbersfx.lift(); }
      if (!isRod && this.placedCubes > 0) { this.placedCubes--; numbersfx.lift(); }
    }
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    this.grabs = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }

    drawYard(ctx, this.w, this.h, this.t);
    ctx.save();
    this.shake.apply(ctx, 6 * this.u());
    this.drawPlay();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.18);
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  private drawPlay(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();
    stageMat(ctx, this.box(L.stage), u);
    this.drawStage(L);
    this.ps.draw(ctx);
    this.drawCard(L.card);
    this.drawCaption(L.caption);
    if (this.ready() || this.fb !== 'none') L.opts.forEach((r, i) => this.optionButton(r, i));
    else this.drawTodo(L.optArea);
    if (this.carry) this.drawCarried();
  }

  // ---------- the stage ----------

  /** How far through the count-out the correction is, in objects. */
  private lit(n: number): number {
    if (this.fb === 'none') return 0;
    const speed = this.fb === 'right' ? 1 : 1.25;
    return Math.min(n, Math.floor(this.teachT * speed * n + 0.001));
  }

  private drawStage(L: Layout): void {
    const s = this.box(L.stage);
    switch (this.q.stage) {
      case 'rack': return this.stageRack(s);
      case 'crates': return this.q.op === 'sub' ? this.stageTakeAway(s) : this.stageAdd(s);
      case 'frame': return this.stageFrame(s);
      case 'blocks': return this.stageBlocks(s);
      case 'line': return this.stageLine(s);
      case 'array': return this.stageArray(s);
    }
  }

  /** Splitting: one rack, one divider, two bowls' worth of beads. */
  private stageRack(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const g = this.rackG(s);
    const right = q.a - this.split;
    const dx = rackDividerX(g, this.split);
    // the two bowls the beads run into. They are the level in one picture: the whole is up on the
    // wire, and the two numbers underneath are however the divider happens to be standing.
    const by = g.frame.y + g.frame.h + 8 * u, bh = 40 * u;
    const bowl = (x0: number, x1: number, n: number, tone: string, ink: string): void => {
      if (x1 - x0 < 6 * u) return;
      ctx.save();
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(x0, by);
      ctx.lineTo(x1, by);
      ctx.quadraticCurveTo(x1 - (x1 - x0) * 0.16, by + bh, (x0 + x1) / 2 + (x1 - x0) * 0.22, by + bh);
      ctx.lineTo((x0 + x1) / 2 - (x1 - x0) * 0.22, by + bh);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.16, by + bh, x0, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
      ctx.textAlign = 'center';
      outlinedText(ctx, String(n), (x0 + x1) / 2, by + bh * 0.62, this.font('900', 21), ink);
    };
    bowl(g.frame.x + 4 * u, dx - g.d * 0.22, this.split, 'rgba(232, 200, 156, 0.85)', '#b3452c');
    bowl(dx + g.d * 0.22, g.frame.x + g.frame.w - 4 * u, right, 'rgba(186, 216, 232, 0.85)', '#2b5e96');

    drawRack(ctx, g, this.split, this.lit(right), this.drag === 'divider');
    this.grabs.push({ id: 'divider', x: dx, y: g.y, w: g.d * 1.6, h: g.frame.h * 1.7 });
    if (save.numbers.countOn) {
      ctx.fillStyle = hexA('#123047', 0.55);
      ctx.font = this.font('800', 10);
      for (let i = 0; i < q.a; i++) ctx.fillText(String(i + 1), rackBeadX(g, i, this.split), g.y + g.r + 14 * u);
    }
  }

  /** Adding: a big crate, a little one, and a push. */
  private stageAdd(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const c = this.crateG(s);
    const t = clamp(this.mergeT, 0, 1);
    const total = q.a + q.b;
    const lit = this.lit(total);

    crate(ctx, c.big);
    for (let i = 0; i < q.a; i++) {
      const sl = appleSlot(c.big, i, 5, c.rows);
      apple(ctx, sl.x, sl.y, sl.s * 0.44, i < lit ? '#f0a24a' : undefined);
    }
    // the little crate's apples travel to the free slots of the big one as it is pushed home
    for (let j = 0; j < q.b; j++) {
      const from = appleSlot(c.small, j, Math.max(1, Math.min(5, q.b)), Math.ceil(q.b / 5));
      const to = appleSlot(c.big, q.a + j, 5, c.rows);
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      const sz = from.s + (to.s - from.s) * t;
      apple(ctx, x, y, sz * 0.44, q.a + j < lit ? '#f0a24a' : undefined);
    }
    crateFront(ctx, c.big);
    if (t < 0.999) {
      crate(ctx, c.small, '#b9834c');
      crateFront(ctx, c.small, '#b9834c');
      this.grabs.push({ id: 'crate', x: c.small.x + c.small.w / 2, y: c.small.y + c.small.h / 2, w: c.small.w, h: c.small.h * 1.4 });
      // an arrow saying which way it goes
      ctx.save();
      ctx.globalAlpha = 0.35 + breathe(this.t, 3) * 0.4;
      ctx.strokeStyle = '#2f6db0';
      ctx.lineWidth = 3.2 * u;
      ctx.lineCap = 'round';
      const ax = c.small.x - 10 * u, ay = c.small.y + c.small.h / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(ax - 22 * u, ay);
      ctx.moveTo(ax - 22 * u, ay); ctx.lineTo(ax - 14 * u, ay - 7 * u);
      ctx.moveTo(ax - 22 * u, ay); ctx.lineTo(ax - 14 * u, ay + 7 * u);
      ctx.stroke();
      ctx.restore();
    }
    this.countLabel(c.big, t >= 0.999 ? total : q.a, s);
    if (save.numbers.countOn && t >= 0.999) {
      for (let i = 0; i < total; i++) {
        const sl = appleSlot(c.big, i, 5, c.rows);
        outlinedText(ctx, String(i + 1), sl.x, sl.y + sl.s * 0.16, this.font('900', 11), '#7a3418');
      }
    }
  }

  /** Taking away: apples out of the crate and into the basket. */
  private stageTakeAway(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const c = this.crateG(s);
    const left = q.a - this.taken;
    const lit = this.lit(left);
    crate(ctx, c.big);
    for (let i = 0; i < left; i++) {
      const sl = appleSlot(c.big, i, 5, c.rows);
      if (this.carry?.id === `crateapple:${i}`) continue;
      apple(ctx, sl.x, sl.y, sl.s * 0.44, i < lit ? '#f0a24a' : undefined);
      this.grabs.push({ id: `crateapple:${i}`, x: sl.x, y: sl.y, w: sl.s * 0.95, h: sl.s * 0.95, round: true });
      if (save.numbers.countOn || i < lit) {
        outlinedText(ctx, String(i + 1), sl.x, sl.y + sl.s * 0.16, this.font('900', 11), '#7a3418');
      }
    }
    crateFront(ctx, c.big);

    // the basket the apples go into: another crate, so the apples sit in it the same way
    const b = c.basket;
    const per = Math.max(1, Math.min(5, q.b));
    const bkRows = Math.max(1, Math.ceil(q.b / per));
    crate(ctx, b, '#b9834c');
    for (let j = 0; j < this.taken; j++) {
      const sl = appleSlot(b, j, per, bkRows);
      apple(ctx, sl.x, sl.y, sl.s * 0.42, '#c9482f');
      this.grabs.push({ id: `basketapple:${j}`, x: sl.x, y: sl.y, w: sl.s * 0.9, h: sl.s * 0.9, round: true });
    }
    crateFront(ctx, b, '#b9834c');
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA('#123047', 0.7);
    ctx.font = this.font('800', 11);
    ctx.fillText(`${T('out', 'eruit')}: ${this.taken}`, b.x + b.w / 2, b.y + b.h + 16 * u);
    this.countLabel(c.big, left, s);
  }

  /** The count on the front of the crate, which is the whole reason the crate is there. */
  private countLabel(r: Rect, n: number, s: Rect): void {
    const ctx = this.ctx, u = this.u();
    const y = Math.min(r.y + r.h + 24 * u, s.y + s.h - 8 * u);
    ctx.textAlign = 'center';
    outlinedText(ctx, String(n), r.x + r.w / 2, y, this.font('900', 22), '#7a3418');
  }

  /** De tien vol: fill the frame to ten, then see what is left over. */
  private stageFrame(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const g = this.frameG(s);
    const full = q.a + this.inFrame >= 10;
    drawTenFrame(ctx, g.frame, full);
    const lit = this.lit(q.answer);
    for (let i = 0; i < q.a + this.inFrame; i++) {
      const sl = frameSlot(g.frame, i);
      const mine = i >= q.a;
      apple(ctx, sl.x, sl.y, g.frame.cell * 0.34, i < lit ? '#f0a24a' : mine ? '#cf6f3c' : undefined);
      if (mine && this.fb === 'none') {
        this.grabs.push({ id: `framed:${i}`, x: sl.x, y: sl.y, w: g.frame.cell * 0.8, h: g.frame.cell * 0.8, round: true });
      }
      if (save.numbers.countOn || i < lit) {
        outlinedText(ctx, String(i + 1), sl.x, sl.y + g.frame.cell * 0.12, this.font('900', 11), '#7a3418');
      }
    }
    // what is still waiting outside the frame
    const loose = q.b - this.inFrame;
    drawTray(ctx, g.tray, this.drag != null && this.drag.startsWith('loose'));
    for (let j = 0; j < loose; j++) {
      const p = this.looseSlot(g.tray, j, loose, g.looseR);
      if (this.carry?.id === `loose:${j}`) continue;
      const idx = q.a + this.inFrame + j;
      apple(ctx, p.x, p.y, g.looseR, idx < lit ? '#f0a24a' : '#cf6f3c');
      if (this.fb === 'none') this.grabs.push({ id: `loose:${j}`, x: p.x, y: p.y, w: g.looseR * 2.3, h: g.looseR * 2.3, round: true });
      if (save.numbers.countOn || idx < lit) {
        outlinedText(ctx, String(idx + 1), p.x, p.y + g.looseR * 0.35, this.font('900', 11), '#7a3418');
      }
    }
    ctx.textAlign = 'center';
    outlinedText(ctx, full ? T('ten, and', 'tien, en') : String(q.a + this.inFrame),
      g.frame.x + g.frame.cell * 2.5, g.frame.y + g.frame.cell * 2 + 22 * u, this.font('900', full ? 14 : 20),
      full ? '#2f7a4c' : '#7a3418');
    if (loose > 0) {
      outlinedText(ctx, `${loose} ${T('over', 'over')}`, g.tray.x + g.tray.w - 26 * u, g.tray.y - 6 * u,
        this.font('900', 13), '#2f6db0');
    }
  }

  /** Tens and ones: rods and cubes onto a tray, with the number line saying the same thing. */
  private stageBlocks(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const g = this.blockG(s);
    const have = piecesOf(q.b);
    const mine = piecesOf(q.a);
    const placed = this.placedRods * 10 + this.placedCubes;
    drawTray(ctx, g.tray, this.drag != null && this.drag.startsWith('shelf'));

    const lit = this.lit(q.a + placed);
    /** The running total beside a piece, once the count-out has reached it: ten, twenty, thirty. */
    const tally = (r: { x: number; y: number; w: number; h: number }, upTo: number): void => {
      if (lit < upTo) return;
      ctx.fillStyle = hexA('#2f7a4c', 0.95);
      ctx.font = this.font('900', 10);
      ctx.textAlign = 'left';
      ctx.fillText(String(upTo), r.x + r.w + 4 * u, r.y + r.h * 0.85);
    };
    // the number being added to, already on the tray
    for (let i = 0; i < mine.rods; i++) {
      const r = this.trayPiece(g, 'rod', i, 0, 0);
      rod(ctx, r.x, r.y, r.w, r.h);
      tally(r, (i + 1) * 10);
    }
    for (let i = 0; i < mine.cubes; i++) {
      const r = this.trayPiece(g, 'cube', i, mine.rods, 0);
      cube(ctx, r.x, r.y, r.w);
      if (i === mine.cubes - 1) tally(r, q.a);
    }
    // and what has been carried over to it
    for (let i = 0; i < this.placedRods; i++) {
      const r = this.trayPiece(g, 'rod', i, mine.rods, 0);
      rod(ctx, r.x, r.y, r.w, r.h, false, '#4f9d7a');
      tally(r, q.a + (i + 1) * 10);
      if (this.fb === 'none') this.grabs.push({ id: `trayrod:${i}`, x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h * 1.2 });
    }
    for (let i = 0; i < this.placedCubes; i++) {
      const r = this.trayPiece(g, 'cube', i, mine.rods + this.placedRods, mine.cubes);
      cube(ctx, r.x, r.y, r.w, false, '#63c49b');
      if (i === this.placedCubes - 1) tally(r, q.a + placed);
      if (this.fb === 'none') this.grabs.push({ id: `traycube:${i}`, x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w * 1.4, h: r.h * 1.4 });
    }

    // the shelf: what is still waiting to be carried over
    const restRods = have.rods - this.placedRods, restCubes = have.cubes - this.placedCubes;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(g.shelf.x, g.shelf.y, g.shelf.w, g.shelf.h, 10 * u);
    if (restRods + restCubes > 0) { ctx.fillStyle = 'rgba(200, 149, 92, 0.45)'; ctx.fill(); }
    else {
      ctx.strokeStyle = 'rgba(141, 97, 52, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    const c = g.cell;
    for (let i = 0; i < restRods; i++) {
      const x = g.shelf.x + c * 0.6 + i * c * 1.4;
      const y = g.shelf.y + g.shelf.h / 2 - c * 4;
      if (this.carry?.id === `shelfrod:${i}`) continue;
      rod(ctx, x, y, c * 0.9, c * 8, false, '#4f9d7a');
      if (this.fb === 'none') this.grabs.push({ id: `shelfrod:${i}`, x: x + c * 0.45, y: y + c * 4, w: c * 1.3, h: c * 8 });
    }
    for (let i = 0; i < restCubes; i++) {
      const x = g.shelf.x + c * 0.6 + restRods * c * 1.4 + c * 0.6 + i * c * 1.15;
      const y = g.shelf.y + g.shelf.h / 2 - c * 0.45;
      if (this.carry?.id === `shelfcube:${i}`) continue;
      cube(ctx, x, y, c * 0.9, false, '#63c49b');
      if (this.fb === 'none') this.grabs.push({ id: `shelfcube:${i}`, x: x + c * 0.45, y: y + c * 0.45, w: c * 1.3, h: c * 1.3 });
    }
    if (restRods + restCubes > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = hexA('#123047', 0.65);
      ctx.font = this.font('800', 10.5);
      ctx.fillText(T('still to go', 'nog te leggen'), g.shelf.x + 8 * u, g.shelf.y + 12 * u);
    }

    // the same sum on the line, because a number and a pile of blocks should agree
    drawNumberLine(ctx, g.line, u * 0.8);
    drawHop(ctx, g.line, q.a, q.a + placed, u * 0.8, '#2f6db0', placed > 0 ? `+${placed}` : undefined);
    drawPeg(ctx, g.line, q.a + placed, u * 0.8, false, '#3f9d61');
    ctx.textAlign = 'center';
    outlinedText(ctx, String(q.a + placed), g.tray.x + g.tray.w - 34 * u, g.tray.y + g.tray.h - 12 * u,
      this.font('900', 21), '#7a3418');
  }

  /** Over the ten, and the difference: one peg, one line, one or two jumps. */
  private stageLine(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const g = this.lineG(s);
    drawNumberLine(ctx, g, u);

    // where the question starts, and on a difference question where it is going
    const marker = (n: number, colour: string, label: string, words: string): void => {
      const x = lineX(g, n);
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.6 * u;
      ctx.beginPath(); ctx.moveTo(x, g.y + 2 * u); ctx.lineTo(x, g.y + 34 * u); ctx.stroke();
      // a pill wide enough for two digits, kept on screen at either end of the line
      ctx.font = this.font('900', 12);
      const pw = Math.max(30 * u, ctx.measureText(label).width + 16 * u);
      const px = clamp(x - pw / 2, g.x - 18 * u, g.x + g.w + 18 * u - pw);
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.roundRect(px, g.y + 34 * u, pw, 22 * u, 11 * u); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, px + pw / 2, g.y + 49 * u);
      ctx.fillStyle = colour;
      ctx.font = this.font('800', 9.5);
      ctx.fillText(words, px + pw / 2, g.y + 68 * u);
      ctx.restore();
    };
    marker(q.a, '#b3452c', String(q.a), T('from', 'vanaf'));
    if (!q.step) marker(q.b, '#2f6db0', String(q.b), T('to', 'naar'));

    if (q.step) {
      const first = Math.min(this.at, q.step.to);
      drawHop(ctx, g, q.a, first, u, '#2f6db0', first > q.a ? `+${first - q.a}` : undefined);
      if (this.at > q.step.to) drawHop(ctx, g, q.step.to, this.at, u, '#3f9d61', `+${this.at - q.step.to}`, 26 * u);
      if (this.fb !== 'none') {
        const to = q.step.to + Math.round((q.answer - q.step.to) * clamp(this.teachT * 1.6, 0, 1));
        drawHop(ctx, g, q.step.to, to, u, '#3f9d61', `+${to - q.step.to}`, 26 * u);
        drawPeg(ctx, g, to, u, false, '#3f9d61');
      } else {
        drawPeg(ctx, g, this.at, u, this.drag === 'peg');
      }
    } else {
      const to = this.fb === 'none' ? this.at : q.a + Math.round(q.answer * clamp(this.teachT * 1.6, 0, 1));
      drawHop(ctx, g, q.a, to, u, '#3f9d61', to !== q.a ? `${to - q.a}` : undefined);
      drawPeg(ctx, g, to, u, this.drag === 'peg');
    }
    if (this.fb === 'none') {
      const px = lineX(g, this.at);
      this.grabs.push({ id: 'peg', x: px, y: g.y - 12 * u, w: 46 * u, h: 60 * u });
    }
    // a hand showing the peg can be dragged, until it has been
    if (this.fb === 'none' && this.at === q.a) {
      ctx.save();
      ctx.globalAlpha = 0.5 + breathe(this.t, 3) * 0.35;
      handCursor(ctx, lineX(g, q.a) + 12 * u, g.y - 12 * u, 13 * u, breathe(this.t, 3));
      ctx.restore();
    }
  }

  /** Times, as rows you build yourself. */
  private stageArray(s: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const g = this.arrayG(s);
    const lit = this.lit(q.answer);
    drawArray(ctx, g, this.cols, this.rows, this.fb === 'none' ? this.fade : 0, this.drag === 'handle', lit);
    const hd = arrayHandle(g, this.cols, this.rows);
    if (this.fb === 'none') this.grabs.push({ id: 'handle', x: hd.x, y: hd.y, w: g.cell * 1.5, h: g.cell * 1.5, round: true });
    ctx.textAlign = 'center';
    outlinedText(ctx, `${this.rows} × ${this.cols}`, g.x + g.cell * this.cols * 0.5,
      g.y + g.cell * this.rows + 26 * u,
      this.font('900', 16), this.rows === q.a && this.cols === q.b ? '#2f7a4c' : '#7a3418');
    if (this.fb === 'none' && this.rows === 1 && this.cols === 1) {
      ctx.save();
      ctx.globalAlpha = 0.5 + breathe(this.t, 3) * 0.35;
      handCursor(ctx, hd.x + 10 * u, hd.y + 12 * u, 13 * u, breathe(this.t, 3));
      ctx.restore();
    }
  }

  /** Whatever is in the hand right now, drawn at the finger. */
  private drawCarried(): void {
    const ctx = this.ctx, u = this.u();
    const c = this.carry;
    if (!c) return;
    const L = this.layout();
    ctx.save();
    ctx.globalAlpha = 0.95;
    if (c.id.startsWith('shelfrod')) {
      const g = this.blockG(this.box(L.stage));
      rod(ctx, c.x - g.cell * 0.45, c.y - g.cell * 4, g.cell * 0.9, g.cell * 8, false, '#4f9d7a');
    } else if (c.id.startsWith('shelfcube')) {
      const g = this.blockG(this.box(L.stage));
      cube(ctx, c.x - g.cell * 0.45, c.y - g.cell * 0.45, g.cell * 0.9, false, '#63c49b');
    } else {
      apple(ctx, c.x, c.y, 15 * u, '#cf6f3c');
    }
    ctx.restore();
  }

  // ---------- the words ----------

  /**
   * The card: the question in words, and under it the sum as it stands, with a box where the
   * answer goes. Both lines are written from the objects, so the figures never say anything the
   * table is not already showing.
   */
  private drawCard(r: Rect): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    const nl = NL();
    glassPanel(ctx, r.x, r.y, r.w, r.h, 18 * u, 0.93);
    ctx.textAlign = 'center';
    const cx = r.x + r.w / 2;

    if (this.fb !== 'none') {
      ctx.fillStyle = this.fb === 'right' ? '#2f7a4c' : '#a5432a';
      ctx.font = this.font('900', 13.5);
      ctx.fillText(sumWords(q.op, q.a, q.b, q.answer, nl), cx, r.y + 24 * u, r.w - 24 * u);
    } else {
      ctx.fillStyle = 'rgba(18,48,71,0.72)';
      ctx.font = this.font('800', 12.5);
      ctx.fillText(this.questionLine(nl), cx, r.y + 24 * u, r.w - 24 * u);
    }

    const done = this.fb !== 'none';
    const size = Math.min(23 * u, r.w / 11);
    // the card grows on a tall screen, so the sum is placed in the room below the line of words
    // rather than at a fixed offset that would leave it stranded near the top
    const mid = r.y + 34 * u + (r.h - 34 * u) / 2;
    if (q.step) {
      const reached = q.stage === 'frame' ? q.a + this.inFrame : Math.min(this.at, q.step.to);
      const gotTen = q.stage === 'frame' ? this.inFrame === q.step.first : this.at >= q.step.to;
      const firstSoFar = q.stage === 'frame' ? this.inFrame : Math.max(0, Math.min(this.at, q.step.to) - q.a);
      drawSum(ctx, cx, mid - 17 * u, [
        { text: String(q.a), known: true },
        { text: '+', known: true },
        { text: String(firstSoFar), known: firstSoFar > 0 },
        { text: '=', known: true },
        { text: String(gotTen ? q.step.to : reached), known: gotTen, strong: gotTen },
      ], size * 0.86);
      drawSum(ctx, cx, mid + 17 * u, [
        { text: String(q.step.to), known: gotTen },
        { text: '+', known: true },
        { text: String(q.step.rest), known: gotTen },
        { text: '=', known: true },
        { text: String(q.answer), known: done, strong: done },
      ], size * 0.86);
      return;
    }
    drawSum(ctx, cx, mid, this.sumParts(done), size);
  }

  /** The sum as the objects have it at this moment. */
  private sumParts(done: boolean): Array<{ text: string; known: boolean; strong?: boolean }> {
    const q = this.q;
    const tail = { text: String(q.answer), known: done, strong: done };
    switch (q.op) {
      case 'split':
        return [
          { text: String(q.a), known: true }, { text: '=', known: true },
          { text: String(this.split), known: this.touched }, { text: '+', known: true }, tail,
        ];
      case 'sub':
        return [
          { text: String(q.a), known: true }, { text: '−', known: true },
          { text: String(this.taken), known: this.taken > 0 }, { text: '=', known: true }, tail,
        ];
      case 'diff':
        return [
          { text: String(q.b), known: true }, { text: '−', known: true },
          { text: String(q.a), known: true }, { text: '=', known: true }, tail,
        ];
      case 'times':
        return [
          { text: String(this.rows), known: this.rows > 1 || this.ready() }, { text: '×', known: true },
          { text: String(this.cols), known: this.cols > 1 || this.ready() }, { text: '=', known: true }, tail,
        ];
      case 'tens': {
        const placed = this.placedRods * 10 + this.placedCubes;
        return [
          { text: String(q.a), known: true }, { text: '+', known: true },
          { text: String(placed), known: placed > 0 }, { text: '=', known: true }, tail,
        ];
      }
      default:
        return [
          { text: String(q.a), known: true }, { text: '+', known: true },
          { text: String(q.b), known: this.mergeT > 0.5 || this.ready() }, { text: '=', known: true }, tail,
        ];
    }
  }

  private questionLine(nl: boolean): string {
    const q = this.q;
    switch (q.op) {
      case 'split':
        return nl ? `Splits ${q.a} in ${q.b} en hoeveel?` : `Split ${q.a} into ${q.b} and how many?`;
      case 'sub':
        return nl ? `${q.a} appels, er gaan er ${q.b} uit.` : `${q.a} apples, ${q.b} go out.`;
      case 'diff':
        return nl ? `Hoeveel is het van ${q.a} naar ${q.b}?` : `How far is it from ${q.a} to ${q.b}?`;
      case 'times':
        return nl ? `${q.a} rijen van ${q.b}. Hoeveel appels?` : `${q.a} rows of ${q.b}. How many apples?`;
      case 'bridge':
      case 'cross':
        return nl ? `${q.a} + ${q.b}. Eerst de tien vol.` : `${q.a} + ${q.b}. Fill the ten first.`;
      default:
        return nl ? `Hoeveel is ${q.a} + ${q.b}?` : `How much is ${q.a} + ${q.b}?`;
    }
  }

  /** The strip under the objects: the level's hint, the correction, or what was just read out. */
  private drawCaption(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const nl = NL();
    const wrong = this.fb === 'wrong';
    const bw = 77 * u;
    const bar = !wrong && this.level.id === 'tafels' ? 110 * u : 0;
    const textW = r.w - (wrong ? bw + 22 * u : 20 * u) - bar;
    let text = '';
    let tone = 'rgba(18,48,71,0.8)';
    if (wrong) { text = teachLine(this.q, nl); tone = '#a5432a'; }
    else if (this.fb === 'right') { text = T('Right!', 'Goed zo!'); tone = '#2f7a4c'; }
    else if (this.noteT > 0) text = this.note;
    // the panel over the answers is already saying what to do, so the strip does not say it twice
    else text = this.ready() ? T('Now pick the answer.', 'Kies nu het antwoord.') : '';
    if (!text) return;
    ctx.save();
    ctx.globalAlpha = this.fb === 'none' && this.noteT > 0 && this.noteT < 1 ? this.noteT : 1;
    glassPanel(ctx, r.x, r.y, r.w, r.h, 13 * u, 0.9);
    ctx.fillStyle = tone;
    ctx.font = this.font('800', 11);
    ctx.textAlign = 'center';
    const tx = r.x + 10 * u + textW / 2;
    this.fitText(text, tx, r.y + r.h / 2 + 4 * u, textW);
    ctx.restore();
    if (wrong) this.button('go', T('Next', 'Verder'), r.x + r.w - bw - 9 * u, r.y + 3 * u, bw, r.h - 6 * u, '#4fae6e', '#ffffff');
    else if (this.level.id === 'tafels') this.speedBar(r);
  }

  /**
   * "Hoe snel" - a bar that empties while you think.
   *
   * It is not a timer. Nothing happens when it runs out, no star is lost and the question waits as
   * long as it is given. All it does is notice when a table fact is coming back quickly, and that
   * is what fades the apples out - so a child who has learnt the table stops being handed it.
   */
  private speedBar(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const bw = 62 * u, bx = r.x + r.w - bw - 10 * u, by = r.y + r.h / 2 - 4 * u;
    const secs = this.fb === 'none' ? this.t - this.askedAt : this.lastSecs;
    const k = clamp(1 - secs / (FAST_AT * 1.6), 0, 1);
    ctx.fillStyle = 'rgba(18,48,71,0.14)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 8 * u, 4 * u); ctx.fill();
    ctx.fillStyle = k > 0.55 ? '#4fae6e' : k > 0.25 ? '#f0b653' : '#c9b9a4';
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(4 * u, bw * k), 8 * u, 4 * u); ctx.fill();
    ctx.fillStyle = 'rgba(18,48,71,0.6)';
    ctx.font = this.font('800', 9);
    ctx.textAlign = 'right';
    ctx.fillText(T('how fast', 'hoe snel'), bx - 6 * u, by + 8 * u);
  }

  /** One line of type, shrunk until it fits rather than clipped or run off the card. */
  private fitText(text: string, cx: number, cy: number, maxW: number): void {
    const ctx = this.ctx;
    let size = 11 * this.u();
    ctx.font = `800 ${Math.round(size)}px Nunito, system-ui, sans-serif`;
    while (ctx.measureText(text).width > maxW && size > 7.5 * this.u()) {
      size -= 0.5;
      ctx.font = `800 ${Math.round(size)}px Nunito, system-ui, sans-serif`;
    }
    ctx.fillText(text, cx, cy, maxW);
  }

  /** What stands where the answers will be, until the objects have been arranged. */
  private drawTodo(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, r.x, r.y, r.w, r.h, 18 * u, 0.85);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(18,48,71,0.55)';
    ctx.font = this.font('800', 11);
    ctx.fillText(T('Do it with the things first', 'Doe het eerst met de spullen'), r.x + r.w / 2, r.y + 22 * u, r.w - 30 * u);
    ctx.fillStyle = '#1d4763';
    ctx.font = this.font('900', 13);
    this.fitText(this.todo(), r.x + r.w / 2, r.y + 46 * u, r.w - 30 * u);
    ctx.save();
    ctx.globalAlpha = 0.5 + breathe(this.t, 3) * 0.35;
    handCursor(ctx, r.x + r.w / 2, r.y + r.h - 26 * u, 12 * u, breathe(this.t, 3));
    ctx.restore();
  }

  private optionButton(r: Rect, i: number): void {
    const ctx = this.ctx;
    const o = this.q.options[i];
    if (o == null) return;
    const isAnswer = i === this.q.correct;
    const isGiven = this.given === i;
    let tone = '#fffdf6', ink = '#1d4763';
    if (this.fb !== 'none') {
      if (isAnswer) { tone = '#4fae6e'; ink = '#ffffff'; }
      else if (isGiven) { tone = '#e0664a'; ink = '#ffffff'; }
    }
    const face = chunkyButton(ctx, r.x, r.y, r.w, r.h, { tone, pressed: this.held0 === `opt:${i}` });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', Math.min(22, (r.h * 0.44) / this.u()));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(o), r.x + r.w / 2, face.y + r.h * 0.65, r.w - 16);
    this.hits.push({ id: `opt:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  /** The bar across the top, the progress dots, and the speed bar on the last level. */
  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', T('Levels', 'Niveaus'), 12 * u, 10 * u, 88 * u, 42 * u);
    const nx = 12 * u + 96 * u;
    const on = save.numbers.countOn;
    const face = chunkyButton(ctx, nx, 10 * u, 54 * u, 42 * u, { tone: on ? '#f0b653' : '#fffdf6', pressed: this.held0 === 'count' });
    ctx.fillStyle = on ? '#4a2f10' : '#1d4763';
    ctx.font = this.font('900', 13);
    ctx.textAlign = 'center';
    ctx.fillText('1 2 3', nx + 27 * u, face.y + 27 * u);
    this.hits.push({ id: 'count', x: nx, y: 10 * u, w: 54 * u, h: 42 * u });

    const n = this.level.rounds;
    const dot = 4.2 * u, gap = 4.5 * u;
    const total = n * dot * 2 + (n - 1) * gap;
    const dx = this.w / 2 - total / 2;
    const dy = this.h - 10 * u;
    for (let i = 0; i < n; i++) {
      const done = i < this.round;
      ctx.fillStyle = done ? 'rgba(79, 174, 110, 0.95)' : i === this.round ? 'rgba(18,48,71,0.6)' : 'rgba(18,48,71,0.2)';
      ctx.beginPath();
      ctx.arc(dx + dot + i * (dot * 2 + gap), dy, dot * (i === this.round ? 1.25 : 1), 0, TAU);
      ctx.fill();
    }

    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 46 * this.u() ? 15 : 12.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 14);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(12, 32, 52, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(352 * u, this.w - 32 * u);
    const ch = Math.min(286 * u, this.h - 36 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 90 * u);
    band.addColorStop(0, this.earned > 0 ? '#9adba8' : '#f0c78a');
    band.addColorStop(1, 'rgba(154, 219, 168, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 90 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, nameOf(this.level), this.w / 2, y + 44 * u, this.font('900', 19), '#123047');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 1) * 42 * u, y + 92 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.78)';
    ctx.font = this.font('800', 13);
    ctx.fillText(T(`${this.firstTry} of ${this.level.rounds} right first time`,
      `${this.firstTry} van de ${this.level.rounds} in één keer goed`), this.w / 2, y + 134 * u, cw - 40 * u);
    ctx.fillStyle = 'rgba(18,48,71,0.6)';
    ctx.font = this.font('700', 12);
    ctx.fillText(this.earned === 3
      ? T('Every one worked out first time.', 'Allemaal in één keer uitgerekend.')
      : this.earned === 0
        ? T('The apples showed you each time. Have another go.', 'De appels lieten het elke keer zien. Doe het nog eens.')
        : T('Good. The ones it showed you are the ones to watch.', 'Goed. Let op de sommen die je uitgelegd kreeg.'),
    this.w / 2, y + 158 * u, cw - 40 * u);
    ctx.restore();

    const bw = Math.min(138 * u, (cw - 30 * u) / 2), bh = 50 * u, by = y + ch - 70 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 6 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  /** The ladder itself, one card per level, with a little picture of what it is about. */
  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    drawYard(ctx, this.w, this.h, this.t);
    ctx.textAlign = 'center';
    // the house button lives in the top right corner, so the title is only ever as wide as what
    // is left - it shrinks rather than sliding underneath it
    const title = T('Sums you can pick up', 'Rekenrijk');
    let ts = 23;
    ctx.font = this.font('900', ts);
    while (ctx.measureText(title).width > this.w - 132 * u && ts > 13) {
      ts -= 0.5;
      ctx.font = this.font('900', ts);
    }
    heading(ctx, title, this.w / 2, 44 * u, this.font('900', ts), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    ctx.fillText(T('Every sum is something you can move.', 'Elke som is iets wat je kunt verschuiven.'), this.w / 2, 66 * u);

    const cols = this.w > 620 * u ? 4 : this.w > 430 * u ? 3 : 2;
    const pad = 11 * u;
    const cw = Math.min(190 * u, (this.w - 24 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.6;
    const chh = art + 48 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 82 * u;
    const rowsNeeded = Math.ceil(LEVELS.length / cols);
    const needed = rowsNeeded * chh + (rowsNeeded - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 14 * u) / needed);

    ctx.save();
    if (squeeze < 1) {
      ctx.translate(this.w / 2, listTop);
      ctx.scale(squeeze, squeeze);
      ctx.translate(-this.w / 2, -listTop);
    }
    // Which one is worth doing now. Not the weakest - being sent to what you are worst at every
    // time is how a game teaches a child to dislike it - but the one nearest the edge of what they
    // can already do, and only among the ones they are allowed into.
    const suggest = pickNext(this.topics, LEVELS.filter((_, i) => this.unlocked(i)).map(L => L.id));

    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.045, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.28)';
      ctx.shadowBlur = 16 * u;
      ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.42;
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art - 6 * u, 12 * u); ctx.clip();
      this.levelArt(i, { x: x + 6 * u, y: y + 6 * u, w: cw - 12 * u, h: art - 6 * u });
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.5)';
      ctx.beginPath(); ctx.arc(x + 20 * u, y + 20 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 11);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 20 * u, y + 24 * u);

      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.6)';
      ctx.font = this.font('900', 12);
      ctx.fillText(nameOf(L), x + cw / 2, y + art + 14 * u, cw - 14 * u);
      for (let sI = 0; sI < 3; sI++) {
        drawStar(ctx, x + cw / 2 + (sI - 1) * 18 * u, y + art + 31 * u, 7.5 * u, sI < p.stars);
      }

      // A ring that fills as this subject gets firm. It is not a score and there is nothing to
      // collect: it is the answer to "how am I doing at the tables", drawn where the question is.
      const m = this.topics[L.id];
      if (open && m && m.seen > 0) masteryRing(ctx, x + cw - 20 * u, y + 20 * u, 11 * u, m.level, u);
      // and a slow gold breath around the one to do next, which is an invitation, not an order
      if (open && L.id === suggest) nextRing(ctx, x, y, cw, chh, 19 * u, this.t, u);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
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

  /** A stamp of the objects this level is about, on its card. */
  private levelArt(i: number, r: Rect): void {
    const ctx = this.ctx;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.fillStyle = 'rgba(214, 233, 214, 0.55)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const s = Math.min(r.w, r.h);
    switch (i) {
      case 0: {
        const d = r.w / 8;
        for (let k = 0; k < 7; k++) bead(ctx, r.x + d * (k + 0.8) + (k >= 3 ? d * 0.5 : 0), cy, d * 0.4, k < 5);
        ctx.fillStyle = '#4f8f66';
        ctx.fillRect(r.x + d * 3.6, cy - s * 0.3, d * 0.25, s * 0.6);
        break;
      }
      case 1: {
        const cw2 = r.w * 0.42, chh = cw2 * 0.6;
        const A = { x: cx - cw2 - 4, y: cy - chh / 2, w: cw2, h: chh };
        const B = { x: cx + 6, y: cy - chh / 2, w: cw2 * 0.7, h: chh };
        crate(ctx, A); for (let k = 0; k < 3; k++) { const sl = appleSlot(A, k, 3, 1); apple(ctx, sl.x, sl.y, sl.s * 0.4); }
        crateFront(ctx, A);
        crate(ctx, B, '#b9834c'); for (let k = 0; k < 2; k++) { const sl = appleSlot(B, k, 2, 1); apple(ctx, sl.x, sl.y, sl.s * 0.4); }
        crateFront(ctx, B, '#b9834c');
        break;
      }
      case 2: {
        const cw2 = r.w * 0.46, chh = cw2 * 0.55;
        const A = { x: r.x + r.w * 0.04, y: cy - chh / 2, w: cw2, h: chh };
        const B = { x: r.x + r.w * 0.58, y: cy - chh * 0.2, w: r.w * 0.36, h: chh * 0.8 };
        crate(ctx, A); for (let k = 0; k < 2; k++) { const sl = appleSlot(A, k, 3, 1); apple(ctx, sl.x, sl.y, sl.s * 0.4); }
        crateFront(ctx, A);
        crate(ctx, B, '#b9834c'); for (let k = 0; k < 2; k++) { const sl = appleSlot(B, k, 2, 1); apple(ctx, sl.x, sl.y, sl.s * 0.4); }
        crateFront(ctx, B, '#b9834c');
        // one on its way across, so the card says taking away rather than two crates
        apple(ctx, cx + r.w * 0.02, cy - chh * 0.55, s * 0.07);
        break;
      }
      case 3: {
        const g = frameGeo({ x: r.x + r.w * 0.08, y: cy - s * 0.22, w: r.w * 0.84, h: s * 0.44 });
        drawTenFrame(ctx, g, true);
        for (let k = 0; k < 10; k++) { const sl = frameSlot(g, k); apple(ctx, sl.x, sl.y, g.cell * 0.32); }
        break;
      }
      case 4: {
        const c = s * 0.1;
        for (let k = 0; k < 3; k++) rod(ctx, r.x + r.w * 0.1, cy - c * 2 + k * c * 1.3, c * 8, c);
        for (let k = 0; k < 4; k++) cube(ctx, r.x + r.w * 0.1 + k * c * 1.15, cy + c * 2.2, c * 0.9);
        break;
      }
      case 5:
      case 6: {
        const lu = s / 120;
        const g: LineGeo = { x: r.x + r.w * 0.14, y: cy + s * 0.06, w: r.w * 0.72, lo: 20, hi: 40 };
        drawNumberLine(ctx, g, lu);
        drawHop(ctx, g, 27, 30, lu, '#2f6db0');
        drawHop(ctx, g, 30, 35, lu, '#3f9d61');
        break;
      }
      default: {
        const cell = Math.min(r.w / 6.5, r.h / 4.6);
        const gx = cx - cell * 2.5, gy = cy - cell * 1.6;
        // the last level is the same crate with the apples going; the card says so
        const faded = i === 8;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) {
            const x = gx + cell * (col + 0.5), y = gy + cell * (row + 0.5);
            if (faded && col >= 2) {
              ctx.strokeStyle = 'rgba(176, 66, 44, 0.5)';
              ctx.lineWidth = Math.max(1, cell * 0.06);
              ctx.beginPath(); ctx.arc(x, y, cell * 0.28, 0, TAU); ctx.stroke();
            } else {
              apple(ctx, x, y, cell * 0.32);
            }
          }
        }
        break;
      }
    }
  }
}
