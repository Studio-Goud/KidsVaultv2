/**
 * Market Day - the counting game in Bramblewood.
 *
 * You keep a fruit stall. Customers come up one at a time with an order card: pictures and a
 * numeral, never a sum. You tap crates to fill the basket, take fruit out again if you overshoot,
 * and ring the bell when you think it is right. A wrong basket is not the end: the customer looks
 * puzzled and the card shows what is off, and you get another go. Take too long and they wander
 * off to another stall.
 *
 * It practises counting out, keeping two counts at once, sharing equally, and how many more.
 * Everything is drawn with canvas paths and every sound is synthesised.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { market, Square } from './marketsfx';
import {
  bleedEdges, breathe, chunkyButton, drawStar as drawStarGem, easeOutBack, easeOutCubic,
  glassPanel, heading, outlinedText, Particles, progressRing, vignette,
} from '../../render/look';
import { paintBasket, paintBell, paintCrate, paintCustomer, paintFruit, paintSquare, paintStall, type Mood } from './paint';
import {
  check, FRUITS, fruitName, LEVELS, makeOrder, rngFor, starsFor,
  type Basket, type Customer, type Fruit, type Level, type Order,
} from './model';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won' | 'failed';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `market:${l.id}`;

const FRUIT_COLOUR: Record<Fruit, string> = { apple: '#e0574a', pear: '#9fc45a', strawberry: '#e04a6a', plum: '#7a5aa8', carrot: '#f08c3a' };

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Pop { x: number; y: number; t0: number; text: string; good: boolean }

export class MarketDay {
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
  private attempt = 0;
  private rng = rngFor(LEVELS[0], 0);
  private orders: Order[] = [];
  private index = 0;
  private order: Order | null = null;
  private baskets: Basket[] = [{}];
  private active = 0;
  private patience = 1;
  private strikes = 0;
  private served = 0;
  private left = 0;
  private wrong = 0;
  private coins = 0;
  private arriveT = 0;
  private leaveT = 0;
  private verdictText = '';
  private verdictT = 0;
  private pops: Pop[] = [];
  private earned = 0;
  private hits: Hit[] = [];
  private square = new Square();
  private note = '';
  private noteT = 0;
  private bounce = new Map<string, number>();
  private ps = new Particles();
  private held0: string | null = null;
  private ringT = 0;
  private mood: Mood = 'waiting';
  private cardPop = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    (window as unknown as { __market?: MarketDay }).__market = this;
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

  destroy(): void { cancelAnimationFrame(this.raf); this.square.stop(); }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, level: this.level.id, index: this.index, order: this.order, baskets: this.baskets, active: this.active,
      served: this.served, left: this.left, wrong: this.wrong, coins: this.coins, patience: Math.round(this.patience * 100) / 100,
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

  // ---------- levels ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.orders = Array.from({ length: this.level.customers }, (_, k) => makeOrder(this.level, this.rng, k));
    this.index = -1;
    this.served = 0; this.left = 0; this.wrong = 0; this.coins = 0;
    this.earned = 0;
    this.phase = 'play'; this.phaseT = 0;
    this.say(NL() ? this.level.hintNl : this.level.hint, 5);
    this.square.start();
    this.nextCustomer();
  }

  private say(text: string, secs = 3): void { this.note = text; this.noteT = secs; }

  private nextCustomer(): void {
    this.index++;
    if (this.index >= this.orders.length) { this.finish(); return; }
    this.order = this.orders[this.index];
    this.baskets = Array.from({ length: this.order.between }, () => ({}));
    if (this.order.kind === 'more') this.baskets[0] = { ...this.order.already };
    this.active = 0;
    this.patience = 1;
    this.strikes = 0;
    this.arriveT = 0.6;
    this.leaveT = 0;
    this.verdictT = 0;
    this.mood = 'waiting';
    market.arrives();
  }

  private finish(): void {
    this.order = null;
    this.earned = starsFor(this.served, this.left, this.wrong, this.level.customers);
    recordLevelResult(saveKey(this.level), this.served, this.earned, this.earned > 0);
    save.coins = Math.max(0, Math.round(save.coins + this.coins)); persist();
    this.phase = this.earned > 0 ? 'won' : 'failed'; this.phaseT = 0;
    this.square.stop();
    if (this.earned > 0) market.complete(); else market.fail();
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.verdictT = Math.max(0, this.verdictT - dt);
    this.arriveT = Math.max(0, this.arriveT - dt);
    this.pops = this.pops.filter(p => this.t - p.t0 < 1.1);
    this.ps.update(dt);
    this.ringT = Math.max(0, this.ringT - dt * 1.6);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    for (const [k, v] of this.bounce) { if (v <= 0) this.bounce.delete(k); else this.bounce.set(k, v - dt); }
    if (this.phase !== 'play' || !this.order) return;
    if (this.leaveT > 0) {
      this.leaveT -= dt;
      if (this.leaveT <= 0) this.nextCustomer();
      return;
    }
    if (this.arriveT > 0) return;
    if (this.mood !== 'waiting' && this.verdictT <= 0 && this.leaveT <= 0) this.mood = 'waiting';
    this.patience -= dt / this.order.patience;
    if (this.patience <= 0) {
      this.left++;
      market.leaves();
      this.say(T('They gave up waiting.', 'Ze zijn het wachten zat.'), 2.5);
      this.leaveT = 0.9;
    }
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
    const p = this.at(e);
    const hit = this.hitAt(p);
    this.held0 = hit;
    setTimeout(() => { this.held0 = null; }, 130);
    if (!hit) return;
    if (hit.startsWith('level:')) { const i = Number(hit.slice(6)); if (this.unlocked(i)) this.start(i); else market.puzzled(); return; }
    if (hit === 'levels') { this.phase = 'levels'; this.square.stop(); market.tap(); return; }
    if (hit === 'retry') { this.start(this.levelIndex); return; }
    if (hit === 'next') { this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); return; }
    if (this.phase !== 'play' || !this.order || this.leaveT > 0 || this.arriveT > 0) return;

    if (hit.startsWith('crate:')) {
      const f = hit.slice(6) as Fruit;
      const b = this.baskets[this.active];
      const total = FRUITS.reduce((s, k) => s + (b[k] ?? 0), 0);
      if (total >= 12) { market.puzzled(); return; }
      b[f] = (b[f] ?? 0) + 1;
      market.drop(total);
      this.bounce.set(`basket:${this.active}`, 0.25);
      this.bounce.set(`drop:${this.active}:${f}:${(b[f] ?? 1) - 1}`, 0.3);
      return;
    }
    if (hit.startsWith('basket:')) {
      const i = Number(hit.slice(7));
      this.active = i;
      market.tap();
      return;
    }
    if (hit.startsWith('take:')) {
      const [, bi, f] = hit.split(':');
      const b = this.baskets[Number(bi)];
      const fruit = f as Fruit;
      if ((b[fruit] ?? 0) > 0) { b[fruit] = (b[fruit] ?? 0) - 1; if (!b[fruit]) delete b[fruit]; market.take(); this.active = Number(bi); }
      return;
    }
    if (hit === 'bell') this.ring();
  }

  private ring(): void {
    if (!this.order) return;
    market.bell();
    this.ringT = 1;
    const v = check(this.order, this.baskets);
    if (v.ok) {
      const n = FRUITS.reduce((s, f) => s + (this.order!.wants[f] ?? 0), 0);
      this.coins += n;
      this.served++;
      market.happy(); market.coins(Math.min(4, n));
      this.mood = 'happy';
      this.pops.push({ x: this.w / 2, y: this.counterTop() - 8 * this.u(), t0: this.t, text: `+${n}`, good: true });
      // coins tumbling onto the counter
      this.ps.spawn('spark', this.w / 2, this.counterTop(), Math.min(10, n + 3),
        { colour: '#f3c14a', speed: 200, size: 9 * this.u(), max: 0.9, spread: 2.2 });
      this.leaveT = 0.9;
      this.verdictText = '';
      return;
    }
    this.wrong++;
    this.strikes++;
    this.mood = 'puzzled';
    market.puzzled();
    // say what is off, in words a four year old can act on
    const parts: string[] = [];
    if (v.unequal) parts.push(T('not the same in every basket', 'niet in elke mand evenveel'));
    for (const f of FRUITS) {
      const d = v.off[f];
      if (!d) continue;
      const n = Math.abs(d);
      parts.push(d > 0
        ? T(`${n} ${fruitName(f, n, false)} too many`, `${n} ${fruitName(f, n, true)} te veel`)
        : T(`${n} more ${fruitName(f, n, false)}`, `nog ${n} ${fruitName(f, n, true)}`));
    }
    this.verdictText = parts.join(' · ');
    this.verdictT = 3.5;
    if (this.strikes >= 2) {
      this.left++;
      market.leaves();
      this.say(T('They went to another stall.', 'Ze zijn naar een andere kraam gegaan.'), 2.5);
      this.leaveT = 1.1;
    }
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }
    paintSquare(ctx, this.w, this.h, this.counterTop(), this.t, this.u());
    if (this.order) this.drawCustomer();
    paintStall(ctx, this.w, this.h, this.counterTop(), this.u());
    if (this.order) { this.drawBaskets(); this.drawCrates(); }
    this.ps.draw(ctx);
    vignette(ctx, this.w, this.h, 0.2);
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  private drawCustomer(): void {
    const ctx = this.ctx, u = this.u(), o = this.order!;
    const slide = this.leaveT > 0 ? (1 - this.leaveT / 1.0) : this.arriveT > 0 ? -(this.arriveT / 0.6) : 0;
    const cx = this.w * 0.24 + slide * this.w * 0.9;
    const r = 42 * u;
    // they stand behind the counter, not under it: on a short screen that means further up
    const cy = Math.min(236 * u, this.counterTop() - r * 1.5);
    // how long they will wait, as a ring behind them, so it never cuts across a face
    progressRing(ctx, cx, cy, r + 13 * u, clamp(this.patience, 0, 1),
      this.patience > 0.35 ? '#5fae6a' : '#e0574a', 6 * u, 'rgba(255,255,255,0.4)');
    paintCustomer(ctx, o.who, cx, cy, r, this.t, this.mood);

    this.drawOrderCard(o, cx, cy, r);
  }

  /**
   * The order, on a scrap of paper pinned up beside the customer. Small counts are shown as that
   * many pieces of fruit, so a child can count the card itself; bigger ones as one piece and a
   * word, so nobody loses their place counting a picture.
   */
  private drawOrderCard(o: Order, cx: number, cy: number, r: number): void {
    const ctx = this.ctx, u = this.u();
    const items = FRUITS.filter(f => o.wants[f]);
    const cardX = Math.min(this.w * 0.46, cx + r * 1.5);
    // on a wide screen the card must not stretch to the far edge; an order is a note, not a banner
    const cardW = Math.min(this.w - cardX - 14 * u, 300 * u);
    const lineH = 34 * u;
    const cardH = 30 * u + items.length * lineH;
    const cardY = Math.max(52 * u, cy - r - 16 * u);
    const tilt = -0.02;

    ctx.save();
    ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
    ctx.rotate(tilt);
    ctx.translate(-(cardX + cardW / 2), -(cardY + cardH / 2));
    ctx.save();
    ctx.shadowColor = 'rgba(30, 20, 10, 0.28)';
    ctx.shadowBlur = 16 * u;
    ctx.shadowOffsetY = 5 * u;
    const paper = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    paper.addColorStop(0, '#fffdf4');
    paper.addColorStop(1, '#f3e9d2');
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 10 * u);
    ctx.fill();
    ctx.restore();
    // a speech tail back towards the customer
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath();
    ctx.moveTo(cardX + 1, cardY + 34 * u);
    ctx.lineTo(cardX - 12 * u, cardY + 44 * u);
    ctx.lineTo(cardX + 1, cardY + 56 * u);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'left';
    items.forEach((f, i) => {
      const y = cardY + 26 * u + i * lineH;
      const n = o.wants[f] ?? 0;
      ctx.fillStyle = '#2d1f10';
      ctx.font = this.font('900', 23);
      ctx.fillText(String(n), cardX + 13 * u, y + 9 * u);
      if (n <= 5) {
        const step = Math.min(23 * u, (cardW - 56 * u) / Math.max(1, n));
        for (let k = 0; k < n; k++) paintFruit(ctx, f, cardX + 48 * u + k * step + step * 0.4, y, step * 0.4, false);
      } else {
        paintFruit(ctx, f, cardX + 54 * u, y, 11 * u, false);
        ctx.fillStyle = 'rgba(45,31,16,0.75)';
        ctx.font = this.font('800', 11.5);
        ctx.fillText(fruitName(f, n, NL()), cardX + 72 * u, y + 4 * u, cardW - 84 * u);
      }
    });
    // what kind of order it is, in one line at the foot of the card
    ctx.fillStyle = 'rgba(45,31,16,0.6)';
    ctx.font = this.font('800', 9.5);
    const kindLine =
      o.kind === 'share' ? T(`shared fairly between ${o.between}`, `eerlijk verdeeld over ${o.between}`) :
      o.kind === 'more' ? T('some are already in the basket', 'er zit al wat in de mand') :
      o.kind === 'mixed' ? T('two kinds', 'twee soorten') : T('please', 'alsjeblieft');
    ctx.fillText(kindLine, cardX + 13 * u, cardY + cardH - 9 * u, cardW - 26 * u);
    ctx.restore();
  }

  /** The crates and the bell live on the counter at the bottom; the counter starts just above them. */
  private crateTop(): number { return this.h - 66 * this.u() - 20 * this.u(); }
  /** The counter is deep enough for the baskets to stand on it rather than float above it. */
  private counterTop(): number { return this.crateTop() - Math.min(156 * this.u(), this.h * 0.3); }

  private basketRects(): Array<{ x: number; y: number; w: number; h: number }> {
    const u = this.u(), n = this.baskets.length;
    // baskets sit in the band between the hint and the counter, no taller than a basket should be
    // the baskets stand on the counter, their feet just over its front edge
    const bandBottom = this.counterTop() + 122 * u;
    const bh = 148 * u;
    const top = bandBottom - bh;
    const gap = 10 * u;
    const bw = Math.min(n === 1 ? 178 * u : 168 * u, (this.w - 24 * u - gap * (n - 1)) / n);
    const total = n * bw + gap * (n - 1);
    const x0 = (this.w - total) / 2;
    return this.baskets.map((_, i) => ({ x: x0 + i * (bw + gap), y: top, w: bw, h: bh }));
  }

  private drawBaskets(): void {
    const ctx = this.ctx, u = this.u();
    const rects = this.basketRects();
    rects.forEach((r, i) => {
      const on = this.active === i && this.baskets.length > 1;
      const bounce = this.bounce.get(`basket:${i}`) ?? 0;
      const lift = Math.sin(bounce * Math.PI * 4) * 3 * u * bounce;
      ctx.save();
      ctx.translate(0, -lift);
      paintBasket(ctx, r, u, on);
      // what is in it, stacked in rows, each piece tappable to take it out again
      const b = this.baskets[i];
      let k = 0;
      const cols = Math.max(3, Math.floor((r.w - 30 * u) / (30 * u)));
      const fr = 13 * u;
      for (const f of FRUITS) {
        for (let q = 0; q < (b[f] ?? 0); q++) {
          const col = k % cols, row = Math.floor(k / cols);
          const x = r.x + 26 * u + col * ((r.w - 52 * u) / (cols - 1 || 1));
          const y = r.y + r.h - 34 * u - row * 27 * u;
          // a piece that has just gone in drops the last little way
          const age = this.bounce.get(`drop:${i}:${f}:${q}`) ?? 0;
          const fall = age > 0 ? -easeOutCubic(1 - age) * 26 * u : 0;
          paintFruit(ctx, f, x, y + fall, fr);
          this.hits.push({ id: `take:${i}:${f}`, x: x - 16 * u, y: y - 16 * u + lift, w: 32 * u, h: 32 * u });
          k++;
        }
      }
      ctx.restore();
      if (this.baskets.length > 1) {
        ctx.textAlign = 'center';
        outlinedText(ctx, `${i + 1}`, r.x + r.w / 2, r.y + 6 * u, this.font('900', 13), '#3d2a14', 'rgba(255,255,255,0.9)', 4);
      }
      this.hits.push({ id: `basket:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
    });
  }

  private drawCrates(): void {
    const ctx = this.ctx, u = this.u();
    const fruits = this.level.fruits;
    const n = fruits.length;
    const bellW = 74 * u;
    const cw = Math.min(82 * u, (this.w - 24 * u - bellW - 8 * u * n) / n), ch = 66 * u;
    const y = this.crateTop();
    let x = 12 * u;
    for (const f of fruits) {
      paintCrate(ctx, x, y, cw, ch, f, u, this.held0 === `crate:${f}`);
      ctx.textAlign = 'center';
      outlinedText(ctx, fruitName(f, 2, NL()), x + cw / 2, y + ch - 7 * u, this.font('800', 9.5), '#fff6e6', 'rgba(60,36,14,0.85)', 3.5);
      this.hits.push({ id: `crate:${f}`, x, y, w: cw, h: ch });
      x += cw + 8 * u;
    }
    const bx = this.w - 12 * u - bellW;
    const ready = !!this.order && this.leaveT === 0 && this.arriveT === 0;
    paintBell(ctx, bx, y, bellW, ch, u, ready, this.ringT);
    ctx.textAlign = 'center';
    outlinedText(ctx, T('Ring', 'Bel'), bx + bellW / 2, y + ch - 7 * u, this.font('900', 10), '#fff6e6', 'rgba(60,36,14,0.85)', 3.5);
    this.hits.push({ id: 'bell', x: bx, y, w: bellW, h: ch });
  }

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    // how far through the day, and the coins taken, on a wooden tally hanging from the awning
    const tw2 = 148 * u, th = 30 * u, tx = this.w / 2 - tw2 / 2, ty = 44 * u;
    ctx.save();
    ctx.shadowColor = 'rgba(30,20,10,0.3)';
    ctx.shadowBlur = 12 * u;
    ctx.shadowOffsetY = 4 * u;
    const board = ctx.createLinearGradient(0, ty, 0, ty + th);
    board.addColorStop(0, '#f6e7c7');
    board.addColorStop(1, '#e0cda4');
    ctx.fillStyle = board;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw2, th, 9 * u);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a3218';
    ctx.font = this.font('900', 12);
    ctx.fillText(`${this.served + this.left} / ${this.level.customers}`, tx + tw2 * 0.28, ty + th * 0.66);
    // a coin, then the number of them
    ctx.save();
    ctx.translate(tx + tw2 * 0.6, ty + th * 0.5);
    const cg = ctx.createLinearGradient(-6 * u, -6 * u, 6 * u, 6 * u);
    cg.addColorStop(0, '#ffe9a0');
    cg.addColorStop(0.5, '#f0c33b');
    cg.addColorStop(1, '#c08f1c');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 8 * u, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,84,20,0.6)';
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a3218';
    ctx.fillText(String(this.coins), tx + tw2 * 0.68, ty + th * 0.66);

    ctx.textAlign = 'center';
    if (this.verdictT > 0 && this.verdictText) {
      ctx.save();
      ctx.globalAlpha = clamp(this.verdictT, 0, 1);
      ctx.font = this.font('900', 12);
      const vw = Math.min(this.w - 28 * u, ctx.measureText(this.verdictText).width + 32 * u);
      const vy = 286 * u;
      ctx.fillStyle = 'rgba(224,87,74,0.96)';
      ctx.beginPath();
      ctx.roundRect(this.w / 2 - vw / 2, vy, vw, 30 * u, 15 * u);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(this.verdictText, this.w / 2, vy + 20 * u, vw - 24 * u);
      ctx.restore();
    } else if (this.noteT > 0 && this.phase === 'play') {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 12);
      const vw = Math.min(this.w - 28 * u, ctx.measureText(this.note).width + 32 * u);
      const vy = 286 * u;
      glassPanel(ctx, this.w / 2 - vw / 2, vy, vw, 30 * u, 15 * u, 0.94);
      ctx.fillStyle = '#123047';
      ctx.fillText(this.note, this.w / 2, vy + 20 * u, vw - 24 * u);
      ctx.restore();
    }

    for (const p of this.pops) {
      const k = (this.t - p.t0) / 1.1;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      const pop = easeOutBack(clamp(k * 4, 0, 1));
      ctx.translate(p.x, p.y - easeOutCubic(k) * 46 * u);
      ctx.scale(pop, pop);
      outlinedText(ctx, p.text, 0, 0, this.font('900', 23), p.good ? '#2c8a54' : '#c9452f', '#ffffff', 6);
      ctx.restore();
    }

    this.button('levels', T('Days', 'Dagen'), 12 * u, 46 * u, 92 * u, 44 * u);
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
    const won = this.phase === 'won';
    ctx.fillStyle = 'rgba(8, 26, 44, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = 276 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, won ? '#f3c14a' : '#f0b27a');
    band.addColorStop(1, won ? 'rgba(243,193,74,0)' : 'rgba(240,178,122,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, won ? T('The stall is sold out', 'De kraam is uitverkocht') : T('A quiet day', 'Een stille dag'),
      this.w / 2, y + 50 * u, this.font('900', 20), '#123047');
    if (won) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + 104 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.fillStyle = 'rgba(18,48,71,0.72)';
    ctx.font = this.font('700', 12);
    ctx.fillText(`${T('served', 'geholpen')} ${this.served}  ·  ${T('walked off', 'weggelopen')} ${this.left}  ·  ${this.coins} ${T('coins', 'munten')}`,
      this.w / 2, y + (won ? 148 : 108) * u, cw - 40 * u);
    if (!won) {
      ctx.fillStyle = 'rgba(18,48,71,0.6)';
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 140 * u, cw - 40 * u);
    }
    ctx.restore();
    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (won && this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next day', 'Volgende dag'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All days', 'Alle dagen'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#8fd2f2');
    bg.addColorStop(0.5, '#d8ecc9');
    bg.addColorStop(1, '#eed8ad');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    heading(ctx, 'Market Day', this.w / 2, 60 * u, this.font('900', 26), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.7)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Fill the basket. Ring the bell.', 'Vul de mand. Bel.'), this.w / 2, 84 * u);

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
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.3)';
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();

      // the day's stall: the awning, the fruit on offer, and who is coming
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u);
      ctx.clip();
      const sky = ctx.createLinearGradient(0, y, 0, y + art);
      sky.addColorStop(0, '#bfe4f6');
      sky.addColorStop(1, '#f0e3c4');
      ctx.fillStyle = sky;
      ctx.fillRect(x, y, cw, art + 12 * u);
      const stripe = 18 * u;
      for (let k = 0; k * stripe < cw; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#e0574a' : '#fff6ea';
        ctx.fillRect(x + k * stripe, y + 6 * u, stripe, 15 * u);
      }
      const shelf = y + art * 0.82;
      ctx.fillStyle = '#b98b5a';
      ctx.fillRect(x, shelf, cw, art);
      ctx.fillStyle = '#d9a86c';
      ctx.fillRect(x, shelf - 4 * u, cw, 6 * u);
      L.fruits.slice(0, 4).forEach((f, k) => {
        const fx = x + 20 * u + k * ((cw - 40 * u) / Math.max(1, Math.min(4, L.fruits.length) - 1 || 1));
        paintFruit(ctx, f, fx, shelf - 10 * u, 11 * u);
      });
      paintCustomer(ctx, (['hedgehog', 'rabbit', 'fox', 'owl', 'badger'] as const)[i % 5],
        x + cw * 0.5, y + art * 0.45, art * 0.2, this.t, 'waiting');
      if (!open) {
        ctx.fillStyle = 'rgba(232, 238, 240, 0.84)';
        ctx.fillRect(x, y, cw, art + 12 * u);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(12,32,52,0.55)';
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);

      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.68)';
      ctx.font = this.font('900', 14);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 28 * u, cw - 28 * u);
      for (let sI = 0; sI < 3; sI++) drawStarGem(ctx, x + 22 * u + sI * 20 * u, y + art + 46 * u, 8 * u, sI < p.stars);

      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
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
}
