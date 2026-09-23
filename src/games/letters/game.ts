/**
 * Letterbos - building words out of sounds, in Suri.
 *
 * Every other reading game asks a child to *recognise* a word. This one asks them to *make* one:
 * a picture appears, the game says what it is and then says it again in pieces - /m/ /aa/ /n/ -
 * and the letters are lying on a rack waiting to be dragged into place. Nothing is multiple
 * choice, because picking the right picture out of four proves nothing about reading.
 *
 * Three things it does deliberately:
 *
 *  - a child who cannot read yet can always hear their way forward. The picture says the word
 *    when you tap it, a tile says its sound when you pick it up, a slot says its sound again when
 *    you tap it, and the whole word is read back the moment it is finished. There is no screen in
 *    this game where the only way on is to already know something;
 *  - a mistake is never a dead end. The tile bounces back, the slot it belongs in glows, the
 *    sound is said again slowly, and if it goes wrong twice the right tile lifts itself into
 *    place and the word is read out whole. The stars count what was built without help, so
 *    nothing is lost by needing it;
 *  - the sounds are sounds, not letter names. /m/ is "mmm" and never "em", because "em-aa-en"
 *    does not become "maan". The table that does that lives in `phonics.ts`, with no canvas in
 *    it, and it is tested case by case.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { lang, t } from '../../i18n';
import {
  bleedEdges, breathe, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor,
  heading, Particles, Shake, vignette,
} from '../../render/look';
import { exampleLine, isVowelUnit, spellingName } from './phonics';
import {
  firstEmpty, isSolved, LEVELS, makeQuestion, rngFor, sayLabel, starsFor, teachElsewhere,
  teachFor, tileFits,
  type Level, type Question,
} from './model';
import { drawPicture } from './pictures';
import {
  drawCredit, drawWordPhoto, loadPhotos, photoCount, photoCovers, photoFor, photosState, WIDTHS,
} from './photos';
import { drawFrame, drawSlot, drawTile, drawWood, INK } from './paint';
import { lettersfx } from './lettersfx';
import { hasVoice, initVoice, say, saySound, sayWord, sayWordAndParts, stopSpeaking } from './speech';
import { speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const NL = (): boolean => lang() === 'nl';
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `letters:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

interface RackTile {
  id: number;
  unit: string;
  /** gone from the rack because it is in a slot now */
  used: boolean;
  /** where it sits, filled in by the layout each frame */
  r: Rect;
}

interface Layout {
  frame: Rect;
  slots: Rect[];
  rack: Rect[];
  band: Rect;
  prompt: Rect;
  wide: boolean;
  th: number;
}

/** How long a finished word stays up before the next one, and how long a correction stays. */
const SOLVED_FOR = 2.4;
const TEACH_FOR = 4.5;
/** Two wrong tiles on the same word and the game puts one in itself. */
const HELP_AFTER = 2;

/** The picture on each level's card on the ladder. */
const LEVEL_PICS = ['kat', 'maan', 'huis', 'trein', 'pauw', 'schaap', 'fiets', 'boom', 'scene:cow'];

export class Letters {
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
  private filled: Array<string | null> = [];
  private rack: RackTile[] = [];
  private cuts: number[] = [];
  private recent: string[] = [];

  private firstTry = 0;
  /** mistakes on the word in hand; reset the moment the game steps in, so it helps again */
  private wrongHere = 0;
  /** nothing has gone wrong on this word at all, which is the only thing a star counts */
  private clean = true;
  private streak = 0;
  private earned = 0;

  private solved = false;
  private solvedT = 0;
  private teach = '';
  private teachT = 0;
  private glowSlot = -1;
  private glowT = 0;
  private badSlot = -1;
  private note = '';
  private noteT = 0;
  private winPop = 0;

  /** the tile under the finger, and where it is */
  private held: { id: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null = null;
  /** the tile that has been tapped and is waiting for a slot */
  private picked = -1;

  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private nextId = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    initVoice();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __letters?: Letters }).__letters = this;
    // the photographs come over the network and every word already has a drawing, so this is
    // started and then forgotten about: the loop is redrawing anyway, and whatever lands, lands
    void loadPhotos();
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

  destroy(): void { cancelAnimationFrame(this.raf); stopSpeaking(); }

  /** One step back: out of a level, to the ladder. */
  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { stopSpeaking(); this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    const L = this.layout();
    return {
      phase: this.phase,
      level: this.level.id,
      levelIndex: this.levelIndex,
      kind: this.q.kind,
      round: this.round,
      rounds: this.level.rounds,
      word: this.q.word,
      parts: this.q.parts,
      filled: this.filled.slice(),
      cuts: this.cuts.slice(),
      gaps: this.q.gaps ?? [],
      solved: this.solved,
      firstTry: this.firstTry,
      wrongHere: this.wrongHere,
      clean: this.clean,
      streak: this.streak,
      stars: this.earned,
      teach: this.teach,
      voice: hasVoice(),
      // the photographs: whether the data file arrived, how many pictures are held, and what this
      // word is actually looking at - so a test can prove the fallback rather than squint at it
      photos: photosState(),
      photosHeld: photoCount(),
      art: this.q.kind !== 'sentence' && photoFor(this.q.pic) ? 'photo' : 'drawn',
      credit: photoFor(this.q.pic)?.credit ?? '',
      licence: photoFor(this.q.pic)?.licence ?? '',
      spell: save.letters.spell,
      picked: this.picked,
      frame: { x: Math.round(L.frame.x + L.frame.w / 2), y: Math.round(L.frame.y + L.frame.h / 2) },
      // centres and sizes both, so a test can drive a drag and check nothing runs off the screen
      slots: L.slots.map((r, i) => ({
        i, want: this.q.parts[i], has: this.filled[i],
        x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2),
        w: Math.round(r.w), h: Math.round(r.h),
      })),
      tiles: this.rack.filter(tl => !tl.used).map(tl => ({
        id: tl.id, unit: tl.unit,
        x: Math.round(tl.r.x + tl.r.w / 2), y: Math.round(tl.r.y + tl.r.h / 2),
        w: Math.round(tl.r.w), h: Math.round(tl.r.h),
      })),
      screen: { w: Math.round(this.w), h: Math.round(this.h) },
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
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

  /** How wide a tile is for what is written on it: one letter, two, or a whole word. */
  private factor(unit: string): number {
    if (this.q.kind === 'sentence') return 0.5 + unit.length * 0.33;
    return unit.length === 1 ? 0.8 : unit.length === 2 ? 1.06 : 1.3;
  }

  /** The tallest tile that lets this row of units fit across the given width. */
  private fitH(units: string[], maxW: number, gap: number): number {
    if (!units.length) return 0;
    const sum = units.reduce((a, u) => a + this.factor(u), 0);
    return (maxW - gap * (units.length - 1)) / sum;
  }

  /** A row of tiles of the given height, centred on cx. */
  private row(units: string[], cx: number, y: number, th: number, gap: number): Rect[] {
    const widths = units.map(u => th * this.factor(u));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
    let x = cx - total / 2;
    return widths.map(wd => { const r = { x, y, w: wd, h: th }; x += wd + gap; return r; });
  }

  /** Split the rack over two rows when one row would make the tiles too small to hit. */
  private rackRows(units: string[], maxW: number, gap: number, minH: number): string[][] {
    if (!units.length) return [];
    if (this.fitH(units, maxW, gap) >= minH) return [units];
    const half = Math.ceil(units.length / 2);
    return [units.slice(0, half), units.slice(half)];
  }

  private layout(): Layout {
    const u = this.u(), w = this.w, h = this.h;
    const pad = 14 * u;
    const wide = w > h * 1.25;
    const top = 62 * u;
    const gap = 7 * u;
    const bandH = 54 * u;
    const units = this.q.parts;
    // every tile the question started with, used or not: the row is measured and placed once, so
    // the word and the rack do not grow under a child's hand as the rack empties
    const all = this.rack.map(x => x.unit);
    const maxTile = (this.q.kind === 'sentence' ? 54 : 76) * u;
    const minTile = 30 * u;

    const colW = wide ? Math.max(w * 0.46, w - 470 * u) : w;
    const areaX = wide ? colW : 0;
    const areaW = (wide ? w - colW : w) - pad * 2;
    const cx = areaX + pad + areaW / 2;

    // the tiles, sized so both the word and the rack fit across whatever room there is. The
    // chopping level is measured on its letters instead, with room kept for every cut it will
    // grow, so a long word like schaap cannot push itself off the side as it falls apart.
    const chopSpan = (this.q.letters ?? []).length * 0.66 + Math.max(0, (this.q.letters ?? []).length - 1) * 0.14
      + Math.max(0, units.length - 1) * 0.34;
    const slotH = this.q.kind === 'chop'
      ? Math.min(maxTile, areaW / Math.max(1, chopSpan))
      : Math.min(maxTile, this.fitH(units, areaW, gap));
    const rows = this.rackRows(all, areaW, gap, minTile);
    const rackH = rows.length ? Math.min(maxTile, ...rows.map(r => this.fitH(r, areaW, gap))) : 0;
    const th = clamp(Math.min(slotH, rackH || maxTile), minTile * 0.7, maxTile);

    const rackTotal = rows.length ? rows.length * th + (rows.length - 1) * gap : 0;
    // the row of dots that counts the level off lives under the rack, so the rack stops short
    const rackTop = h - 22 * u - rackTotal;
    const slotsY = rackTop - (rackTotal > 0 ? 18 * u : 0) - th - (wide ? 8 * u : 6 * u);
    const bandY = slotsY - bandH - 8 * u;

    const slots = this.row(units, cx, slotsY, th, gap);
    const rack: Rect[] = [];
    rows.forEach((r, i) => {
      const y = rackTop + i * (th + gap);
      // the tiles keep the order they were dealt in, so a rack never reshuffles under a finger
      this.row(r, cx, y, th, gap).forEach(rr => rack.push(rr));
    });

    const band: Rect = { x: areaX + pad, y: bandY, w: areaW, h: bandH };
    // the picture is the question, but a picture that fills the whole screen leaves the tiles
    // looking like an afterthought, so it is capped and centred in whatever room is left
    const aspect = this.q.kind === 'sentence' ? 1.6 : 1.04;
    const fit = (top0: number, bottom0: number, maxW: number): Rect => {
      const avail = Math.max(70 * u, bottom0 - top0);
      let fh = Math.min(avail, 340 * u);
      const fw = Math.min(maxW, fh * aspect);
      fh = Math.min(fh, fw / aspect);
      return { x: 0, y: top0 + (avail - fh) / 2, w: fw, h: fh };
    };
    if (wide) {
      const f = fit(top, h - pad, colW - pad * 2);
      const frame: Rect = { ...f, x: pad + (colW - pad * 2 - f.w) / 2 };
      const prompt: Rect = { x: areaX + pad, y: top, w: areaW, h: 44 * u };
      return { frame, slots, rack, band, prompt, wide, th };
    }
    const prompt: Rect = { x: pad, y: top, w: w - pad * 2, h: 40 * u };
    const f = fit(prompt.y + prompt.h + 8 * u, bandY - 8 * u, w - pad * 2);
    const frame: Rect = { ...f, x: w / 2 - f.w / 2 };
    return { frame, slots, rack, band, prompt, wide, th };
  }

  // ---------- running a level ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.round = 0;
    this.firstTry = 0;
    this.streak = 0;
    this.earned = 0;
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
    this.q = makeQuestion(this.level, this.rng, this.round, this.recent);
    this.recent.push(this.q.word);
    if (this.recent.length > 5) this.recent.shift();
    this.filled = this.q.filled.slice();
    this.rack = this.q.rack.map(unit => ({ id: this.nextId++, unit, used: false, r: { x: 0, y: 0, w: 0, h: 0 } }));
    this.cuts = [];
    this.solved = false;
    this.solvedT = 0;
    this.wrongHere = 0;
    this.clean = true;
    this.teach = '';
    this.teachT = 0;
    this.glowSlot = -1;
    this.glowT = 0;
    this.badSlot = -1;
    this.held = null;
    this.picked = -1;
    this.winPop = 0;
    this.speakQuestion();
  }

  /** The word, and then the word in pieces. That order is the method. */
  private speakQuestion(): void {
    sayWordAndParts(this.q.word, this.q.parts, this.q.kind === 'sentence');
  }

  /** What the picture says when it is tapped, which is always the whole thing at speaking speed. */
  private speakWhole(): void {
    if (this.q.kind === 'sentence') say(this.q.word, 0.8);
    else sayWord(this.q.word);
  }

  private place(slot: number, tile: RackTile): void {
    if (this.solved || this.filled[slot] != null) return;
    if (tileFits(this.q, slot, tile.unit)) {
      this.filled[slot] = tile.unit;
      tile.used = true;
      this.picked = -1;
      this.glowSlot = -1;
      this.badSlot = -1;
      lettersfx.land();
      saySound(tile.unit);
      const r = this.layout().slots[slot];
      if (r) this.ps.spawn('dust', r.x + r.w / 2, r.y + r.h, 6, { colour: '#e8dfc8', speed: 90, size: 5, max: 0.5 });
      if (isSolved(this.q, this.filled)) this.onSolved();
      return;
    }
    this.gotItWrong(slot, tile.unit);
  }

  /**
   * A tile that does not fit.
   *
   * It bounces back, the slot it does belong in lights up, and the sound that slot wants is said
   * again slowly. Two of those on one word and the game stops asking: it puts the next tile in
   * itself and reads the word out, because a child stuck on the same word for the third time is
   * learning that they cannot do it.
   */
  private gotItWrong(slot: number, unit: string): void {
    this.wrongHere++;
    this.clean = false;
    this.streak = 0;
    this.shake.add(0.4);
    lettersfx.bounce();
    this.badSlot = slot;
    // a tile that does belong somewhere else in the word is a different lesson from a tile that
    // belongs nowhere in it, and the glow and the words always point at the same box
    const mine = this.q.parts.findIndex((p, i) => p === unit && this.filled[i] == null && i !== slot);
    const elsewhere = mine >= 0;
    this.glowSlot = elsewhere ? mine : slot;
    this.glowT = TEACH_FOR;
    this.teach = elsewhere ? teachElsewhere(unit, NL()) : teachFor(this.q, slot, unit, NL());
    this.teachT = TEACH_FOR;
    const want = elsewhere ? unit : this.q.parts[slot];
    stopSpeaking();
    saySound(want);
    if (want) say(exampleLine(want, NL()), 0.75, 1, true);
    if (this.wrongHere >= HELP_AFTER) this.helpOut();
  }

  /** The game puts one tile in by itself, and says the word whole once it is there. */
  private helpOut(): void {
    const slot = firstEmpty(this.filled);
    if (slot < 0) return;
    const want = this.q.parts[slot];
    const tile = this.rack.find(x => !x.used && x.unit === want);
    this.filled[slot] = want;
    if (tile) tile.used = true;
    this.wrongHere = 0;
    this.glowSlot = slot;
    this.glowT = 1.4;
    // the slot is no longer the place a mistake was made, it is a slot with the right tile in it
    this.badSlot = -1;
    this.teach = NL() ? `Ik zet de ${want} even voor je neer.` : `I will put the ${want} in for you.`;
    this.teachT = 2.6;
    lettersfx.land();
    const r = this.layout().slots[slot];
    if (r) this.ps.spawn('spark', r.x + r.w / 2, r.y + r.h / 2, 8, { colour: '#ffd873', speed: 150, size: 6, max: 0.6 });
    if (isSolved(this.q, this.filled)) this.onSolved();
    else { stopSpeaking(); saySound(want); say(this.q.word, 0.75, 1, true); }
  }

  private onSolved(): void {
    this.solved = true;
    this.solvedT = SOLVED_FOR;
    // the correction has been overtaken by events
    this.teach = '';
    this.teachT = 0;
    this.badSlot = -1;
    this.picked = -1;
    this.held = null;
    // a word the wood had to help with is not a word that was read, whatever the counter says
    if (this.clean) { this.firstTry++; this.streak++; } else this.streak = 0;
    lettersfx.word(this.streak);
    stopSpeaking();
    this.speakWhole();
    const L = this.layout();
    this.ps.spawn('spark', L.frame.x + L.frame.w / 2, L.frame.y + L.frame.h / 2, 18,
      { colour: '#ffd873', speed: 300, size: L.frame.h * 0.08, max: 1, spread: TAU });
    this.ps.spawn('ring', L.frame.x + L.frame.w / 2, L.frame.y + L.frame.h / 2, 2,
      { colour: 'rgba(120, 220, 160, 0.9)', speed: 0, size: L.frame.h * 0.3, max: 0.9 });
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
      lettersfx.complete();
      return;
    }
    this.nextQuestion();
  }

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.teachT = Math.max(0, this.teachT - dt);
    this.glowT = Math.max(0, this.glowT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.8);
    if (this.teachT <= 0) this.badSlot = -1;
    if (this.phase !== 'play') return;
    if (this.solved) {
      this.winPop = Math.min(1, this.winPop + dt * 2.2);
      this.solvedT -= dt;
      if (this.solvedT <= 0) this.advance();
    }
  }

  // ---------- input ----------

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
    if (!hit) { this.picked = -1; return; }
    this.held0 = hit;
    if (hit.startsWith('tile:')) {
      const id = Number(hit.slice(5));
      const tile = this.rack.find(x => x.id === id && !x.used);
      if (!tile || this.solved) return;
      this.picked = id;
      this.held = { id, x: p.x, y: p.y, dx: p.x - (tile.r.x + tile.r.w / 2), dy: p.y - (tile.r.y + tile.r.h / 2), moved: false };
      lettersfx.lift();
      saySound(tile.unit);
      return;
    }
    this.press(hit);
  }

  private press(id: string): void {
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { lettersfx.tap(); this.start(i); } else lettersfx.bounce();
      return;
    }
    if (id === 'levels') { stopSpeaking(); this.phase = 'levels'; this.cardPop = 0; lettersfx.tap(); return; }
    if (id === 'retry') { lettersfx.tap(); this.start(this.levelIndex); return; }
    if (id === 'next') { lettersfx.tap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (id === 'spell') {
      save.letters.spell = !save.letters.spell;
      persist();
      lettersfx.tap();
      this.say(save.letters.spell
        ? T('The word is written under the picture now.', 'Het woord staat nu onder het plaatje.')
        : T('The word is hidden again.', 'Het woord staat er niet meer bij.'), 2.4);
      return;
    }
    if (id === 'frame' || id === 'say') { lettersfx.tap(); this.speakWhole(); return; }
    if (id === 'sounds') { lettersfx.tap(); this.speakQuestion(); return; }
    if (id === 'go') { if (this.solved) this.advance(); return; }
    if (id.startsWith('slot:')) {
      const i = Number(id.slice(5));
      const has = this.filled[i];
      if (has) { saySound(has); return; }
      if (this.picked >= 0) {
        const tile = this.rack.find(x => x.id === this.picked && !x.used);
        if (tile) this.place(i, tile);
      } else {
        // an empty slot still says what it is waiting for, which is the whole point of a slot
        saySound(this.q.parts[i]);
      }
      return;
    }
    if (id.startsWith('gap:')) { this.cut(Number(id.slice(4))); return; }
  }

  /** The chopping level: a tap between two letters either falls on a join or it does not. */
  private cut(at: number): void {
    if (this.solved) return;
    if (this.cuts.includes(at)) return;
    const gaps = this.q.gaps ?? [];
    if (gaps.includes(at)) {
      this.cuts.push(at);
      this.cuts.sort((a, b) => a - b);
      lettersfx.chop();
      const idx = gaps.indexOf(at);
      saySound(this.q.parts[idx]);
      if (this.cuts.length === gaps.length) this.onSolved();
      return;
    }
    this.wrongHere++;
    this.clean = false;
    this.streak = 0;
    this.shake.add(0.4);
    lettersfx.bounce();
    // which sound the two letters either side belong to, so the correction names it
    let run = 0, unit = this.q.parts[0];
    for (const p of this.q.parts) { if (at > run && at < run + p.length) { unit = p; break; } run += p.length; }
    this.teach = NL()
      ? `${unit} hoort bij elkaar: dat is één klank.`
      : `${unit} belongs together: that is one sound.`;
    this.teachT = TEACH_FOR;
    stopSpeaking();
    saySound(unit);
    if (this.wrongHere >= HELP_AFTER) {
      const missing = gaps.find(gp => !this.cuts.includes(gp));
      if (missing != null) {
        this.cuts.push(missing);
        this.cuts.sort((a, b) => a - b);
        this.wrongHere = 0;
        lettersfx.chop();
        if (this.cuts.length === gaps.length) this.onSolved();
      }
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.held) return;
    const p = this.at(e);
    if (Math.hypot(p.x - this.held.x, p.y - this.held.y) > 6) this.held.moved = true;
    this.held.x = p.x;
    this.held.y = p.y;
  }

  private onUp(e: PointerEvent): void {
    const h = this.held;
    this.held0 = null;
    this.held = null;
    if (!h) return;
    const tile = this.rack.find(x => x.id === h.id && !x.used);
    if (!tile) return;
    if (!h.moved) return;   // a tap, not a drag: the tile stays picked up, waiting for a slot
    const p = this.at(e);
    const L = this.layout();
    // the slot the tile was let go over, with a little slack around it
    let best = -1, bestD = Infinity;
    L.slots.forEach((r, i) => {
      if (this.filled[i] != null) return;
      const d = Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
      if (d < bestD && d < Math.max(r.w, r.h) * 1.1) { bestD = d; best = i; }
    });
    if (best >= 0) this.place(best, tile);
    else this.picked = -1;
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }
    drawWood(ctx, this.w, this.h, this.t);
    ctx.save();
    this.shake.apply(ctx, 6 * this.u());
    this.drawPlay();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.18, '30, 50, 24');
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  private drawPlay(): void {
    const ctx = this.ctx, u = this.u();
    const L = this.layout();

    this.drawPrompt(L.prompt);
    this.drawFrameCard(L.frame);

    if (this.q.kind === 'chop') this.drawChop(L);
    else this.drawWordRow(L);

    this.ps.draw(ctx);

    // the rack, and then whatever is under the finger on top of everything
    this.rack.forEach((tile, i) => {
      const r = L.rack[i];
      if (!r) return;
      tile.r = r;
      if (tile.used) return;
      if (this.held && this.held.id === tile.id) return;
      drawTile(ctx, r.x, r.y, r.w, r.h, tile.unit, {
        held: this.picked === tile.id,
        wordTile: this.q.kind === 'sentence',
      });
      this.hits.push({ id: `tile:${tile.id}`, x: r.x - 3 * u, y: r.y - 6 * u, w: r.w + 6 * u, h: r.h + 12 * u });
    });
    if (this.held) {
      const tile = this.rack.find(x => x.id === this.held?.id);
      const r = tile?.r;
      if (tile && r) {
        drawTile(ctx, this.held.x - this.held.dx - r.w / 2, this.held.y - this.held.dy - r.h / 2, r.w, r.h, tile.unit,
          { held: true, pop: 1.08, wordTile: this.q.kind === 'sentence' });
      }
    }

    if (this.teachT > 0) this.drawTeach(L.band);
    else if (this.solved) this.drawSaid(L.band);
    else if (this.noteT > 0) this.drawNote(L.band);
    else this.drawHelpRow(L.band);
  }

  /** The word being built: the slots, and the word written over them when help is switched on. */
  private drawWordRow(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    L.slots.forEach((r, i) => {
      drawSlot(ctx, r.x, r.y, r.w, r.h, {
        filled: this.filled[i],
        glow: this.glowSlot === i && this.glowT > 0 ? 0.35 + breathe(this.t, 5) * 0.4 : 0,
        mood: this.badSlot === i ? 'wrong' : this.solved ? 'right' : 'none',
        focus: this.q.focus === i && !this.solved,
        wordTile: this.q.kind === 'sentence',
      });
      this.hits.push({ id: `slot:${i}`, x: r.x - 3 * u, y: r.y - 5 * u, w: r.w + 6 * u, h: r.h + 10 * u });
    });
  }

  /**
   * The chopping level: the word written out whole, and a pair of scissors between every two
   * letters. A cut that lands on a join pushes the two halves apart, so the word visibly falls
   * into the pieces it is made of.
   */
  private drawChop(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    const letters = this.q.letters ?? this.q.word.split('');
    const th = L.th;
    const lw = th * 0.66, gap = th * 0.14, open = th * 0.34;
    const widths = letters.map((_, i) => lw + (i > 0 && this.cuts.includes(i) ? open : 0));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1);
    let x = (L.wide ? L.band.x + L.band.w / 2 : this.w / 2) - total / 2;
    const y = L.slots[0]?.y ?? this.h * 0.5;
    letters.forEach((ch, i) => {
      if (i > 0 && this.cuts.includes(i)) x += open;
      // which sound this letter is part of, so a finished chop is coloured by sound
      let run = 0, part = 0;
      for (let k = 0; k < this.q.parts.length; k++) {
        if (i < run + this.q.parts[k].length) { part = k; break; }
        run += this.q.parts[k].length;
      }
      const tone = isVowelUnit(this.q.parts[part]) ? '#f0b45e' : '#9fc3d8';
      ctx.fillStyle = this.solved ? tone : 'rgba(255,253,244,0.92)';
      ctx.beginPath();
      ctx.roundRect(x, y, lw, th, th * 0.2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = this.font('900', th * 0.55 / this.u());
      ctx.textAlign = 'center';
      ctx.fillText(ch, x + lw / 2, y + th * 0.68);
      if (i > 0) {
        const gx = x - gap / 2;
        const isCut = this.cuts.includes(i);
        // every gap says it can be cut, which gives nothing away because they all say it; a cut
        // one goes red and pushes the two halves apart
        ctx.strokeStyle = isCut ? '#e0664a' : 'rgba(45, 62, 42, 0.3)';
        ctx.lineWidth = Math.max(2, th * (isCut ? 0.06 : 0.045));
        ctx.setLineDash([th * 0.12, th * 0.1]);
        ctx.beginPath();
        ctx.moveTo(gx - (isCut ? open / 2 : 0), y - 4 * u);
        ctx.lineTo(gx - (isCut ? open / 2 : 0), y + th + 4 * u);
        ctx.stroke();
        ctx.setLineDash([]);
        this.hits.push({ id: `gap:${i}`, x: gx - th * 0.26, y: y - 6 * u, w: th * 0.52, h: th + 12 * u });
      }
      x += lw + gap;
    });
  }

  /** The picture. It is the question, so it is the biggest thing on the screen. */
  private drawFrameCard(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const pop = this.solved ? 1 + easeOutBack(clamp(this.winPop, 0, 1)) * 0.06 + Math.sin(this.t * 7) * 0.012 * (1 - this.winPop) : 1;
    const inner = drawFrame(ctx, r.x, r.y, r.w, r.h, pop);
    const ph = inner.w * this.dpr > 420 ? WIDTHS.page : WIDTHS.card;
    // a sentence is a scene, and a scene is the one thing a photograph cannot be, so those stay
    // drawn whatever the data file says
    const pic = this.q.kind === 'sentence' ? null : photoFor(this.q.pic);
    const picH = inner.h * (this.q.kind === 'sentence' ? 1 : 0.94);
    // the drawing stays underneath until the photograph is all the way in, so the frame is never
    // empty and the fade-in crossfades between the two
    if (!photoCovers(pic, ph)) drawPicture(ctx, this.q.pic, inner.x, inner.y, inner.w, picH);
    if (pic && drawWordPhoto(ctx, pic, inner.x, inner.y, inner.w, picH, this.t, ph)) {
      drawCredit(ctx, pic, t('lettersPhotoBy'), inner.x, inner.y, inner.w, picH, this.font('700', 8), u);
    }
    // the English word under the picture, in the English half of the game: it gives away nothing
    // about the Dutch spelling and it is the only way an English speaker knows what they are
    // looking at
    if (!NL()) this.plate(this.q.en, r.x + r.w / 2, r.y + 20 * u, this.font('800', 12), 'rgba(45,62,42,0.85)', r.w);
    // the word itself: written once it has been built, and written all along for a child who has
    // the help switched on. Both live on the picture, where there is always room for them.
    if (this.solved || (save.letters.spell && this.q.kind !== 'chop')) {
      this.plate(this.q.word, r.x + r.w / 2, r.y + r.h - 16 * u, this.font('900', 17),
        this.solved ? '#2f7a4c' : 'rgba(45,62,42,0.8)', r.w);
    }
    this.hits.push({ id: 'frame', x: r.x, y: r.y, w: r.w, h: r.h });
    // the speaker, in the corner of the frame, because a picture that talks has to say so
    const s = 30 * u;
    const sx = r.x + r.w - s - 6 * u, sy = r.y + 6 * u;
    chunkyButton(ctx, sx, sy, s, s, { tone: '#fffdf4', radius: s * 0.5 });
    this.speaker(sx + s / 2, sy + s / 2, s * 0.46);
    this.hits.push({ id: 'say', x: sx, y: sy, w: s, h: s });
  }

  /** A word on a soft white plate, so it stays readable whatever the picture behind it is doing. */
  private plate(text: string, cx: number, cy: number, font: string, ink: string, maxW: number): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = Math.min(ctx.measureText(text).width, maxW - 30 * u);
    const ph = Number(font.split(' ')[1].replace('px', '')) * 1.5;
    ctx.fillStyle = 'rgba(255, 253, 244, 0.88)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2 - 10 * u, cy - ph / 2, tw + 20 * u, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.fillText(text, cx, cy + 1, maxW - 30 * u);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  private speaker(cx: number, cy: number, r: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#2f6d94';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.3);
    ctx.lineTo(cx - r * 0.3, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.1, cy - r * 0.75);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.75);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.3);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2f6d94';
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + r * 0.1, cy, r * 0.55, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.1, cy, r * 0.9, -0.8, 0.8);
    ctx.stroke();
    ctx.restore();
  }

  /** What to do, in one line, in this level's own words. */
  private drawPrompt(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const q = this.q;
    const line = q.kind === 'chop' ? t('lettersChop')
      : q.kind === 'sentence' ? t('lettersMakeSentence')
        : q.kind === 'ladder' ? t('lettersChangeOne')
          : q.kind === 'choose' ? `${q.parts[q.focus] === 'ij' || q.parts[q.focus] === 'ei' ? 'ei' : 'au'} ${T('or', 'of')} ${q.parts[q.focus] === 'ij' || q.parts[q.focus] === 'ei' ? 'ij' : 'ou'}?`
            : t('lettersMakeWord');
    glassPanel(ctx, r.x, r.y, r.w, r.h, 14 * u, 0.9);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2d3e2a';
    ctx.font = this.font('900', 15);
    const cx = r.x + r.w / 2;
    if (this.q.kind === 'ladder' && this.q.from) {
      ctx.font = this.font('900', 14);
      ctx.fillText(`${this.q.from} →`, r.x + r.w * 0.27, r.y + r.h * 0.66, r.w * 0.4);
      ctx.fillStyle = 'rgba(45,62,42,0.66)';
      ctx.font = this.font('800', 12);
      ctx.fillText(line, r.x + r.w * 0.7, r.y + r.h * 0.64, r.w * 0.55);
      return;
    }
    ctx.fillText(line, cx, r.y + r.h * 0.66, r.w - 20 * u);
  }

  /** The word read back, once it is finished. */
  private drawSaid(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, b.x, b.y, b.w, b.h, 14 * u, 0.94);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f7a4c';
    ctx.font = this.font('900', 16);
    const cx = b.x + (b.w - 86 * u) / 2;
    ctx.fillText(this.q.word, cx, b.y + b.h * 0.44, b.w - 100 * u);
    // and underneath, the sounds it is made of, written the way phonics writes them
    ctx.fillStyle = 'rgba(45,62,42,0.66)';
    ctx.font = this.font('800', 12);
    ctx.fillText(this.q.parts.map(p => (this.q.kind === 'sentence' ? p : sayLabel(p))).join(' '),
      cx, b.y + b.h * 0.82, b.w - 100 * u);
    const bw = 76 * u, bh = 36 * u;
    this.button('go', T('Next', 'Verder'), b.x + b.w - bw - 8 * u, b.y + (b.h - bh) / 2, bw, bh, '#4fae6e', '#ffffff');
  }

  /**
   * The correction.
   *
   * On an ei/ij or au/ou question it writes the word out properly with the right spelling picked
   * out in red, because that is the only thing that can be learned here: there is no rule, there
   * is only this word looking like this.
   */
  private drawTeach(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, b.x, b.y, b.w, b.h, 14 * u, 0.95);
    ctx.textAlign = 'center';
    const cx = b.x + b.w / 2;
    if (this.q.kind === 'choose' && this.q.focus >= 0) {
      const word = this.q.word, unit = this.q.parts[this.q.focus];
      const before = this.q.parts.slice(0, this.q.focus).join('');
      ctx.font = this.font('900', 20);
      const wA = ctx.measureText(before).width;
      const wB = ctx.measureText(unit).width;
      const wC = ctx.measureText(this.q.parts.slice(this.q.focus + 1).join('')).width;
      const x0 = cx - (wA + wB + wC) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(45,62,42,0.85)';
      ctx.fillText(before, x0, b.y + b.h * 0.5);
      ctx.fillStyle = '#c9344e';
      ctx.fillText(unit, x0 + wA, b.y + b.h * 0.5);
      ctx.fillStyle = 'rgba(45,62,42,0.85)';
      ctx.fillText(this.q.parts.slice(this.q.focus + 1).join(''), x0 + wA + wB, b.y + b.h * 0.5);
      ctx.strokeStyle = '#c9344e';
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.beginPath();
      ctx.moveTo(x0 + wA, b.y + b.h * 0.58);
      ctx.lineTo(x0 + wA + wB, b.y + b.h * 0.58);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(45,62,42,0.7)';
      ctx.font = this.font('800', 11);
      ctx.fillText(`${word} — ${spellingName(unit, NL())}`, cx, b.y + b.h * 0.86, b.w - 20 * u);
      return;
    }
    ctx.fillStyle = '#a5432a';
    ctx.font = this.font('800', 12.5);
    this.wrapText(this.teach, cx, b.y + b.h * 0.52, b.w - 24 * u, 15 * u, 2);
  }

  private drawNote(b: Rect): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    glassPanel(ctx, b.x, b.y, b.w, b.h, 14 * u, 0.92);
    ctx.fillStyle = 'rgba(45,62,42,0.85)';
    ctx.font = this.font('700', 11.5);
    ctx.textAlign = 'center';
    this.wrapText(this.note, b.x + b.w / 2, b.y + b.h * 0.52, b.w - 24 * u, 14 * u, 3);
    ctx.restore();
  }

  /** The two buttons that are always there while a word is open: say it, and say the sounds. */
  private drawHelpRow(b: Rect): void {
    const u = this.u();
    const bw = Math.min(150 * u, (b.w - 12 * u) / 2), bh = Math.min(b.h - 6 * u, 42 * u);
    const y = b.y + (b.h - bh) / 2;
    this.button('say', t('lettersListen'), b.x + b.w / 2 - bw - 6 * u, y, bw, bh, '#fffdf4', '#2f6d94');
    this.button('sounds', t('lettersSoundBySound'), b.x + b.w / 2 + 6 * u, y, bw, bh, '#fffdf4', '#2f6d94');
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

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', t('lettersLevels'), 14 * u, 10 * u, 92 * u, 42 * u);
    const nx = 14 * u + 100 * u;
    const on = save.letters.spell;
    const face = chunkyButton(ctx, nx, 10 * u, 56 * u, 42 * u, { tone: on ? '#f0b45e' : '#fffdf4', pressed: this.held0 === 'spell' });
    ctx.fillStyle = on ? '#4a2f10' : '#2f6d94';
    ctx.font = this.font('900', 14);
    ctx.textAlign = 'center';
    ctx.fillText('abc', nx + 28 * u, face.y + 27 * u);
    this.hits.push({ id: 'spell', x: nx, y: 10 * u, w: 56 * u, h: 42 * u });

    const n = this.level.rounds;
    const dot = 4.5 * u, gap = 5 * u;
    const total = n * dot * 2 + (n - 1) * gap;
    const dx = this.w / 2 - total / 2;
    const dy = this.h - 9 * u;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < this.round ? 'rgba(79, 174, 110, 0.95)'
        : i === this.round ? 'rgba(45,62,42,0.6)' : 'rgba(45,62,42,0.2)';
      ctx.beginPath();
      ctx.arc(dx + dot + i * (dot * 2 + gap), dy, dot * (i === this.round ? 1.25 : 1), 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf4', ink = '#2f6d94'): void {
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
    // the card covers the game, so nothing behind it is tappable any more
    this.hits = [];
    ctx.fillStyle = 'rgba(24, 40, 20, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(352 * u, this.w - 32 * u);
    const ch = Math.min(274 * u, this.h - 40 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 24 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 24 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 90 * u);
    band.addColorStop(0, this.earned > 0 ? '#a8d88f' : '#f0c78a');
    band.addColorStop(1, 'rgba(168, 216, 143, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 90 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, nameOf(this.level), this.w / 2, y + 42 * u, this.font('900', 19), '#2d3e2a');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 1) * 42 * u, y + 88 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(45,62,42,0.8)';
    ctx.font = this.font('800', 13);
    ctx.fillText(`${this.firstTry} ${T('of', 'van de')} ${this.level.rounds} ${t('lettersFirstTime')}`,
      this.w / 2, y + 130 * u, cw - 40 * u);
    ctx.fillStyle = 'rgba(45,62,42,0.62)';
    ctx.font = this.font('700', 12);
    ctx.fillText(this.earned === 3
      ? T('Every word built on your own.', 'Elk woord helemaal zelf gemaakt.')
      : this.earned === 0
        ? T('The wood helped every time. Have another go.', 'Het bos hielp elke keer mee. Doe het nog eens.')
        : T('Good. The ones you were helped with are the ones to practise.', 'Goed. Oefen de woorden waar je hulp bij kreeg.'),
    this.w / 2, y + 154 * u, cw - 40 * u);
    ctx.restore();

    const bw = Math.min(138 * u, (cw - 30 * u) / 2), bh = 50 * u, by = y + ch - 68 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 6 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', t('lettersLevels'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    drawWood(ctx, this.w, this.h, this.t);
    ctx.textAlign = 'center';
    heading(ctx, t('lettersTitle'), this.w / 2, 44 * u, this.font('900', 24), '#2d3e2a');
    ctx.fillStyle = 'rgba(45,62,42,0.75)';
    ctx.font = this.font('700', 12);
    // a machine with no Dutch voice says so, once, rather than leaving a child tapping a speaker
    // that never speaks. The list of voices arrives late on some phones, so it waits a moment
    // before deciding there is nothing there.
    const mute = !hasVoice() && this.t > 3;
    ctx.fillText(mute ? t('lettersNoVoice') : t('lettersTag'), this.w / 2, 66 * u, this.w - 40 * u);

    const cols = this.w > 620 * u ? 4 : this.w > 430 * u ? 3 : 2;
    const pad = 11 * u;
    const cw = Math.min(190 * u, (this.w - 24 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.62;
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
      ctx.shadowColor = 'rgba(30,50,24,0.3)';
      ctx.shadowBlur = 15 * u;
      ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 15 * u); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.4;
      // the ladder gets the photographs too, at the small width, so the second look at a word in
      // the game itself is already in the browser's cache
      const lp = photoFor(LEVEL_PICS[i] ?? '');
      const px = x + cw * 0.12, py = y + 6 * u, pw = cw * 0.76, phh = art - 6 * u;
      if (!photoCovers(lp, WIDTHS.card)) drawPicture(ctx, LEVEL_PICS[i] ?? 'kat', px, py, pw, phh);
      if (lp) drawWordPhoto(ctx, lp, px, py, pw, phh, this.t, WIDTHS.card, 9 * u);
      ctx.restore();

      ctx.fillStyle = 'rgba(30,50,24,0.5)';
      ctx.beginPath(); ctx.arc(x + 19 * u, y + 19 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 11);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 19 * u, y + 23 * u);

      ctx.fillStyle = open ? '#2d3e2a' : 'rgba(45,62,42,0.6)';
      ctx.font = this.font('900', 12);
      ctx.fillText(nameOf(L), x + cw / 2, y + art + 13 * u, cw - 14 * u);
      for (let sI = 0; sI < 3; sI++) {
        drawStar(ctx, x + cw / 2 + (sI - 1) * 18 * u, y + art + 31 * u, 7.5 * u, sI < p.stars);
      }
      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(45,62,42,0.55)';
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

    // where the photographs come from, said once and quietly - the frames themselves carry the
    // photographer, and this is the half of the credit that is the same for all of them
    if (photosState() === 'ready') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(45,62,42,0.45)';
      ctx.font = this.font('700', 9);
      ctx.fillText(t('lettersPhotoSource'), this.w / 2, this.h - 7 * u, this.w - 24 * u);
    }

    // a hand pointing at the first level, until something has been played
    if (!levelProgress(saveKey(LEVELS[0])).completed && this.cardPop > 0.9) {
      const first = this.hits.find(hh => hh.id === 'level:0');
      if (first) {
        ctx.save();
        ctx.globalAlpha = 0.5 + breathe(this.t, 3) * 0.35;
        handCursor(ctx, first.x + first.w * 0.68, first.y + first.h * 0.62, 13 * u, breathe(this.t, 3));
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
  }
}
