/**
 * Rijmbos - the rhyming game in Suri.
 *
 * A forest clearing. Suri says a word and animals hold up picture cards; the child taps the card
 * that rhymes. Five levels (two cards, three, a look-alike, find them all, odd one out), ten
 * questions each, and then it ends with stars for the questions that were right the first time.
 *
 * It practises hearing that two whole words end the same way. It says whole words only - never a
 * sound, a syllable or a letter - and it never counts a wrong answer on screen: a wrong card is
 * two soft taps, the card stays, and Suri says the two words again ("kat. muis. Dat rijmt niet.").
 * Implements the brief in docs/prompt.md; the rules are in model.ts.
 */

import { clamp, TAU } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, recordLevelResult } from '../../util/storage';
import {
  LEVELS, QUESTIONS_PER_LEVEL, makeQuestion, rngFor, starsFor, textOf, toFind,
  type Lang, type Level, type Question,
} from './model';
import { rijmSfx } from './rijmsfx';
import {
  bleedEdges, chunkyButton, drawStar as drawStarGem, easeOutBack, glassPanel, heading, Particles, vignette,
} from '../../render/look';
import { ANIMALS, drawAnimal, drawCard, drawIcon, paintClearing } from './paint';
import { drawGuide } from '../../platform/guide';
import { NL, T } from '../../util/lang';
import { say } from '../../platform/voice';
import { simpleNow } from '../../platform/who';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Cell { cx: number; cy: number; card: number; r: number; paw: number }

const saveKey = (l: Level): string => `rijmbos:${l.id}`;
const lang = (): Lang => (NL() ? 'nl' : 'en');
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const hintOf = (l: Level): string => (NL() ? l.hintNl : l.hint);

/** how long a right answer is celebrated before the next question: long enough to hear the two words */
const CELEBRATE = 2.8;

export class Rijmbos {
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
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private rng = rngFor(1, 0);
  private attempt = 0;
  private qIndex = 0;
  private q: Question | null = null;
  private found: boolean[] = [];
  private shake: number[] = [];
  private cheer: number[] = [];
  private wrongThisQ = false;
  private firstTry = 0;
  private asked: string[] = [];
  /** 'ask': waiting for a tap. 'done': celebrating, taps ignored until the next question. */
  private qState: 'ask' | 'done' = 'ask';
  private doneT = 0;
  private earned = 0;
  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private cardPop = 0;
  /** the question as Suri said it; the guide button in the corner says it again */
  private qLine = '';
  /** the last thing said about an answer, shown small for the parent */
  private caption = '';
  private speakT = 0;

  /**
   * Below four the catalogue hides this game, so there is no simple shape. The call is kept so a
   * child of two who gets here anyway is not shown a broken screen: they play the first level.
   */
  private easy = simpleNow();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointerup', () => { this.held0 = null; });
    canvas.addEventListener('pointercancel', () => { this.held0 = null; });
    (window as unknown as { __rijm?: Rijmbos }).__rijm = this;
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

  canBack(): boolean { return this.phase !== 'levels'; }
  back(): void { this.phase = 'levels'; this.cardPop = 0; }

  debugState(): Record<string, unknown> {
    const cells = this.cells();
    return {
      phase: this.phase, level: this.level.id, levelIndex: this.levelIndex, easy: this.easy,
      qIndex: this.qIndex, qState: this.qState, mode: this.level.mode, lang: this.q?.lang ?? lang(),
      prompt: this.q?.prompt ? textOf(this.q.prompt, this.q.lang) : null,
      cards: this.q ? this.q.cards.map((c, i) => ({
        word: textOf(c.word, this.q!.lang), right: c.right, found: !!this.found[i],
        x: Math.round(cells[i]?.cx ?? 0), y: Math.round(cells[i]?.cy ?? 0),
      })) : [],
      left: this.q ? toFind(this.q) - this.found.filter(Boolean).length : 0,
      firstTry: this.firstTry, stars: this.earned, qLine: this.qLine, caption: this.caption,
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

  private wide(): boolean { return this.w > this.h * 1.1; }

  /** the prompt panel and Suri; the home and back buttons live top right, the guide bottom left */
  private top(): { px: number; py: number; pw: number; ph: number; sx: number; sy: number; ss: number; zone: { x: number; y: number; w: number; h: number } } {
    const u = this.u(), w = this.w, h = this.h;
    if (this.wide()) {
      const lw = Math.min(w * 0.34, 300 * u);
      const ph = 128 * u, py = 44 * u;
      const ss = Math.min(110 * u, h - py - ph - 70 * u);
      return {
        px: 14 * u, py, pw: lw - 14 * u, ph, sx: lw / 2, sy: py + ph + 10 * u + ss, ss,
        zone: { x: lw + 10 * u, y: 64 * u, w: w - lw - 20 * u, h: h - 64 * u - 14 * u },
      };
    }
    const ph = 124 * u, py = 62 * u;
    return {
      px: 92 * u, py, pw: w - 92 * u - 14 * u, ph, sx: 48 * u, sy: py + ph - 6 * u, ss: 104 * u,
      zone: { x: 8 * u, y: py + ph + 14 * u, w: w - 16 * u, h: h - (py + ph + 14 * u) - 68 * u },
    };
  }

  private cells(): Cell[] {
    const q = this.q;
    if (!q) return [];
    const u = this.u(), z = this.top().zone, n = q.cards.length;
    const cols = this.wide() ? n : n <= 3 ? n : n === 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cw = z.w / cols;
    const ch = Math.min(z.h / rows, cw * 1.6);
    const r = Math.min(cw * 0.23, ch * 0.16);
    const card = Math.max(40 * u, Math.min(cw * 0.84, ch - 2.9 * r - 6 * u));
    const content = 2.9 * r + card;
    const blockH = rows * ch;
    const y0 = z.y + (z.h - blockH) / 2;
    const out: Cell[] = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols);
      const col = i - row * cols;
      const x0 = z.x + (z.w - inRow * cw) / 2;
      const top = y0 + row * ch + (ch - content) / 2;
      out.push({ cx: x0 + col * cw + cw / 2, cy: top + 1.95 * r + 0.95 * r + card / 2 - 0.1 * r, card, r, paw: card * 0.4 });
    }
    return out;
  }

  // ---------- rounds ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level.id, this.attempt);
    this.qIndex = 0; this.firstTry = 0; this.asked = []; this.earned = 0;
    this.phase = 'play';
    this.cardPop = 0;
    this.ps.clear();
    this.ask(true);
  }

  private ask(first = false): void {
    const q = makeQuestion(this.level.id, this.rng, lang(), this.asked);
    this.q = q;
    if (q.prompt) this.asked.push(textOf(q.prompt, q.lang));
    this.found = q.cards.map(() => false);
    this.shake = q.cards.map(() => 0);
    this.cheer = q.cards.map(() => 0);
    this.wrongThisQ = false;
    this.qState = 'ask';
    this.doneT = 0;
    this.caption = '';
    const words = q.cards.map(c => `${textOf(c.word, q.lang)}.`).join(' ');
    const p = q.prompt ? `${textOf(q.prompt, q.lang)}.` : '';
    const ask = q.mode === 'odd' ? T('Which word does not rhyme?', 'Welk woord rijmt niet?')
      : q.mode === 'all' ? T('Which pictures rhyme?', 'Welke plaatjes rijmen?')
        : T('Which picture rhymes?', 'Welk plaatje rijmt?');
    // the level's own instruction comes first, once, with the first question
    const intro = first ? `${hintOf(this.level)} ` : '';
    this.qLine = q.mode === 'odd' ? `${words} ${ask}` : `${p} ${ask} ${words}`;
    this.speak(`${intro}${this.qLine}`);
  }

  /** The last question said, so the guide in the corner can say it again. */
  spoken(): string { return this.qLine; }

  private speak(text: string): void {
    this.speakT = 2.4;
    say(null, text);
  }

  private wordOf(i: number): string { return this.q ? textOf(this.q.cards[i].word, this.q.lang) : ''; }

  private update(dt: number): void {
    this.speakT = Math.max(0, this.speakT - dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.ps.update(dt);
    this.shake = this.shake.map(s => Math.max(0, s - dt));
    this.cheer = this.cheer.map(c => Math.max(0, c - dt * 0.45));
    if (this.phase !== 'play' || this.qState !== 'done') return;
    this.doneT += dt;
    if (this.doneT < CELEBRATE) return;
    this.qIndex++;
    if (this.qIndex >= QUESTIONS_PER_LEVEL) { this.finish(); return; }
    this.ask();
  }

  private finish(): void {
    this.earned = starsFor(this.firstTry, QUESTIONS_PER_LEVEL);
    recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
    this.phase = 'won'; this.cardPop = 0;
    this.q = null; this.found = []; this.shake = []; this.cheer = [];
    rijmSfx.complete();
    this.speak(T('All done. Well done.', 'Klaar. Goed gedaan.'));
  }

  // ---------- input ----------

  private hitAt(x: number, y: number): string | null {
    for (const h of this.hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const r = this.canvas.getBoundingClientRect();
    const hit = this.hitAt(e.clientX - r.left - this.sl, e.clientY - r.top - this.st);
    if (!hit) return;
    this.held0 = hit;
    if (hit.startsWith('level:')) {
      const i = Number(hit.slice(6));
      if (this.unlocked(i)) this.start(i); else rijmSfx.wrong();
    } else if (hit.startsWith('card:')) this.pickCard(Number(hit.slice(5)));
    else if (hit === 'hear') { rijmSfx.tap(); this.speak(this.qLine); }
    else if (hit === 'retry') this.start(this.levelIndex);
    else if (hit === 'next') this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1));
    else if (hit === 'levels') { rijmSfx.tap(); this.phase = 'levels'; this.cardPop = 0; }
  }

  private pickCard(i: number): void {
    const q = this.q;
    if (!q || this.phase !== 'play' || this.qState !== 'ask' || this.found[i]) return;
    const card = q.cards[i];
    const no = T('That does not rhyme.', 'Dat rijmt niet.'), yes = T('That rhymes.', 'Dat rijmt.');
    const word = this.wordOf(i);
    const prompt = q.prompt ? textOf(q.prompt, q.lang) : '';
    const cell = this.cells()[i];

    if (q.mode === 'odd') {
      // the right card is the one that does not rhyme; the two words said are it and one that does
      const mate = q.cards.findIndex(c => !c.right);
      const mateWord = this.wordOf(mate);
      if (card.right) {
        this.cheerFor(i, cell);
        this.speak(`${word}. ${mateWord}. ${no}`);
        this.caption = `${word} - ${mateWord}: ${no}`;
        this.done();
      } else {
        this.slip(i);
        const other = q.cards.findIndex((c, k) => !c.right && k !== i);
        const otherWord = this.wordOf(other);
        this.speak(`${word}. ${otherWord}. ${yes}`);
        this.caption = `${word} - ${otherWord}: ${yes}`;
      }
      return;
    }

    if (card.right) {
      this.found[i] = true;
      this.cheerFor(i, cell);
      this.speak(`${prompt}. ${word}. ${yes}`);
      this.caption = `${prompt} - ${word}: ${yes}`;
      if (this.found.filter(Boolean).length >= toFind(q)) this.done();
    } else {
      this.slip(i);
      this.speak(`${word}. ${prompt}. ${no}`);
      this.caption = `${word} - ${prompt}: ${no}`;
    }
  }

  /** the card stays, two soft taps, and nothing is lost; only the first-try credit is gone */
  private slip(i: number): void {
    this.wrongThisQ = true;
    this.shake[i] = 0.45;
    rijmSfx.wrong();
  }

  private cheerFor(i: number, cell: Cell | undefined): void {
    this.cheer[i] = 1;
    rijmSfx.right(this.found.filter(Boolean).length);
    rijmSfx.cheer();
    if (cell) {
      this.ps.spawn('spark', cell.cx, cell.cy - cell.card * 0.3, 10, { colour: '#fff3a8', speed: 150, size: cell.card * 0.09, max: 0.9, spread: TAU });
      this.ps.spawn('leaf', cell.cx, cell.cy - cell.card * 0.5, 7, { colour: '#6bbf5a', speed: 120, size: cell.card * 0.08, max: 1.1 });
    }
  }

  private done(): void {
    this.qState = 'done'; this.doneT = 0;
    if (!this.wrongThisQ) this.firstTry++;
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
    paintClearing(ctx, this.w, this.h, this.t);
    this.drawPlay();
    vignette(ctx, this.w, this.h, 0.16, '20, 50, 24');
    if (this.phase === 'won') this.drawEnd();
  }

  private drawPlay(): void {
    const ctx = this.ctx, u = this.u(), q = this.q;
    if (!q) return;
    const tp = this.top();

    // how far through the round: ten dots, no numbers
    for (let i = 0; i < QUESTIONS_PER_LEVEL; i++) {
      ctx.fillStyle = i < this.qIndex || (i === this.qIndex && this.qState === 'done') ? '#3f9a4a' : 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = 'rgba(40,80,40,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(20 * u + i * 15 * u, 24 * u, 5 * u, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Suri, who says the word, and the panel that shows it
    drawGuide(ctx, tp.sx, tp.sy, tp.ss, { pose: this.speakT > 0 ? 'talk' : 'watch', t: this.t, facing: 1, saying: this.speakT > 0 ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0 });
    const down = this.held0 === 'hear';
    glassPanel(ctx, tp.px, tp.py + (down ? 2 : 0), tp.pw, tp.ph, 22 * u, 0.94);
    ctx.textAlign = 'center';
    if (q.prompt) {
      const icon = Math.min(tp.ph * 0.56, tp.pw * 0.5);
      drawIcon(ctx, q.prompt.icon, tp.px + tp.pw / 2, tp.py + 10 * u + icon / 2, icon);
      ctx.fillStyle = '#25506e';
      ctx.font = this.font('900', 22);
      ctx.fillText(textOf(q.prompt, q.lang), tp.px + tp.pw / 2, tp.py + tp.ph - 30 * u, tp.pw - 16 * u);
    } else {
      ctx.fillStyle = '#25506e';
      ctx.font = this.font('900', 17);
      ctx.fillText(T('Which does not rhyme?', 'Wat rijmt niet?'), tp.px + tp.pw / 2, tp.py + tp.ph * 0.42, tp.pw - 16 * u);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.62)';
    ctx.font = this.font('700', 11.5);
    const cap = this.caption || (q.mode === 'all' ? T('Tap every card that rhymes', 'Tik alle kaarten die rijmen') : q.mode === 'odd' ? T('Tap the odd one', 'Tik de vreemde eend') : T('Tap the card that rhymes', 'Tik de kaart die rijmt'));
    ctx.fillText(cap, tp.px + tp.pw / 2, tp.py + tp.ph - 10 * u, tp.pw - 14 * u);
    this.hits.push({ id: 'hear', x: tp.px, y: tp.py, w: tp.pw, h: tp.ph });

    // the animals and their cards
    const cells = this.cells();
    q.cards.forEach((c, i) => {
      const cell = cells[i];
      const sx = this.shake[i] > 0 ? Math.sin(this.shake[i] * 38) * cell.card * 0.05 * (this.shake[i] / 0.45) : 0;
      const kind = ANIMALS[(this.qIndex + i * 2) % ANIMALS.length];
      const cheer = this.cheer[i] > 0.5 ? 1 : this.found[i] ? 0 : this.cheer[i] * 2;
      const headY = cell.cy - cell.card / 2 - 0.95 * cell.r;
      drawAnimal(ctx, kind, cell.cx + sx, headY, cell.r, this.t + i, cheer, cell.paw);
      drawCard(ctx, c.word.icon, cell.cx, cell.cy, cell.card, { glow: this.found[i] || (q.mode === 'odd' && c.right && this.qState === 'done') ? 1 : 0, shake: sx, pressed: this.held0 === `card:${i}` });
      // the word is written for the parent once the card has been answered, never before: a card
      // that spells its ending would turn a question about hearing into one about reading
      if (this.found[i] || (this.qState === 'done')) {
        ctx.fillStyle = '#25506e';
        ctx.font = this.font('900', 14);
        ctx.textAlign = 'center';
        ctx.fillText(this.wordOf(i), cell.cx, cell.cy + cell.card / 2 + 16 * u, cell.card + 10 * u);
      }
      this.hits.push({ id: `card:${i}`, x: cell.cx - cell.card / 2, y: cell.cy - cell.card / 2, w: cell.card, h: cell.card });
    });
    this.ps.draw(ctx);
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, x: number, y: number, bw: number, bh: number, tone = '#fdfbf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, bw, bh, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + bw / 2, face.y + bh * 0.63, bw - 18);
    this.hits.push({ id, x, y, w: bw, h: bh });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(14, 40, 22, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(340 * u, this.w - 32 * u), ch = Math.min(250 * u, this.h - 40 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2); ctx.scale(pop, pop); ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, T('All done', 'Klaar'), this.w / 2, y + 46 * u, this.font('900', 24), '#123047');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
      drawStarGem(ctx, this.w / 2 + (i - 1) * 44 * u, y + 94 * u, 19 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 13);
    ctx.fillText(T('Ten questions done.', 'Tien vragen gedaan.'), this.w / 2, y + 134 * u, cw - 40 * u);
    ctx.restore();
    const bw = Math.min(140 * u, (cw - 36 * u) / 2), bh = 50 * u, by = y + ch - 74 * u;
    this.button('retry', T('Again', 'Nog een keer'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next', 'Volgende'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    paintClearing(ctx, this.w, this.h, this.t);
    ctx.textAlign = 'center';
    heading(ctx, 'Rijmbos', this.w / 2, 60 * u, this.font('900', 28), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.74)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Which word rhymes? Listen and tap.', 'Welk woord rijmt? Luister en tik.'), this.w / 2, 84 * u);

    const cols = this.w > 640 * u ? 5 : 2;
    const pad = 12 * u;
    const cw = Math.min(210 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.56;
    const chh = art + 58 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 104 * u;
    const rows = Math.ceil(LEVELS.length / cols);
    const needed = rows * chh + (rows - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 16 * u) / needed);
    const samples = ['mouse', 'house', 'cat', 'boat', 'ball'];

    ctx.save();
    if (squeeze < 1) { ctx.translate(this.w / 2, listTop); ctx.scale(squeeze, squeeze); ctx.translate(-this.w / 2, -listTop); }
    LEVELS.forEach((L, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, LEVELS.length - row * cols);
      const rx0 = (this.w - (inRow * cw + (inRow - 1) * pad)) / 2;
      const x = (inRow === cols ? x0 : rx0) + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.05, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2); ctx.scale(appear, appear); ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,20,0.3)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();

      // a little picture of the level: as many cards as it has
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u); ctx.clip();
      const bg = ctx.createLinearGradient(0, y, 0, y + art);
      bg.addColorStop(0, '#cdeccb'); bg.addColorStop(1, '#8fd079');
      ctx.fillStyle = bg; ctx.fillRect(x, y, cw, art + 12 * u);
      const n = Math.min(L.cards, 5);
      const cs = Math.min(art * 0.62, (cw - 16 * u) / n * 0.86);
      for (let k = 0; k < n; k++) drawIcon(ctx, samples[k], x + cw / 2 + (k - (n - 1) / 2) * (cs * 1.1), y + art / 2 + 2 * u, cs);
      if (!open) { ctx.fillStyle = 'rgba(228, 238, 232, 0.86)'; ctx.fillRect(x, y, cw, art + 12 * u); }
      ctx.restore();

      ctx.fillStyle = 'rgba(12,40,20,0.55)';
      ctx.beginPath(); ctx.arc(x + 22 * u, y + 22 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = this.font('900', 12); ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 22 * u, y + 26.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.68)';
      ctx.font = this.font('900', 13);
      ctx.fillText(nameOf(L), x + 12 * u, y + art + 26 * u, cw - 24 * u);
      for (let s = 0; s < 3; s++) drawStarGem(ctx, x + 20 * u + s * 19 * u, y + art + 43 * u, 7.5 * u, s < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(18,48,71,0.55)'; ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-11 * u, -6 * u, 22 * u, 17 * u, 4 * u); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.hits.push({
        id: `level:${i}`,
        x: this.w / 2 + (x - this.w / 2) * squeeze, y: listTop + (y - listTop) * squeeze,
        w: cw * squeeze, h: chh * squeeze,
      });
    });
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
