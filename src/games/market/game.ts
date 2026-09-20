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
import { uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { market, Square } from './marketsfx';
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
  private h = 0;
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
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
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
    for (const [k, v] of this.bounce) { if (v <= 0) this.bounce.delete(k); else this.bounce.set(k, v - dt); }
    if (this.phase !== 'play' || !this.order) return;
    if (this.leaveT > 0) {
      this.leaveT -= dt;
      if (this.leaveT <= 0) this.nextCustomer();
      return;
    }
    if (this.arriveT > 0) return;
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
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hitAt(p: Vec): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
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
    const v = check(this.order, this.baskets);
    if (v.ok) {
      const n = FRUITS.reduce((s, f) => s + (this.order!.wants[f] ?? 0), 0);
      this.coins += n;
      this.served++;
      market.happy(); market.coins(Math.min(4, n));
      this.pops.push({ x: this.w / 2, y: this.h * 0.36, t0: this.t, text: `+${n}`, good: true });
      this.leaveT = 0.9;
      this.verdictText = '';
      return;
    }
    this.wrong++;
    this.strikes++;
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
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#bfe7ff'); sky.addColorStop(0.45, '#d9efd2'); sky.addColorStop(1, '#e9d9b0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];
    if (this.phase === 'levels') { this.drawLevels(); return; }
    this.drawStall();
    if (this.order) { this.drawCustomer(); this.drawBaskets(); this.drawCrates(); }
    this.drawChrome();
    if (this.phase === 'won' || this.phase === 'failed') this.drawEnd();
  }

  /** The awning and counter, so it reads as a stall before anything is on it. */
  private drawStall(): void {
    const ctx = this.ctx, u = this.u();
    // awning stripes at the very top
    const ah = 26 * u;
    for (let x = 0; x < this.w; x += 28 * u) {
      ctx.fillStyle = Math.round(x / (28 * u)) % 2 === 0 ? '#e0574a' : '#fff7ea';
      ctx.fillRect(x, 0, 28 * u, ah);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, ah, this.w, 3 * u);
    // cobbles of the square between the customer and the counter
    ctx.fillStyle = 'rgba(120,110,90,0.08)';
    for (let y = 70 * u; y < this.counterTop(); y += 16 * u) for (let x = (Math.round(y / (16 * u)) % 2) * 14 * u; x < this.w; x += 28 * u) {
      ctx.beginPath(); ctx.ellipse(x, y, 11 * u, 5 * u, 0, 0, TAU); ctx.fill();
    }
    // counter
    const cy = this.counterTop();
    ctx.fillStyle = '#b98b5a';
    ctx.fillRect(0, cy, this.w, this.h - cy);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = cy + 14 * u; y < this.h; y += 22 * u) ctx.fillRect(0, y, this.w, 2 * u);
    ctx.fillStyle = '#d9a86c'; ctx.fillRect(0, cy - 6 * u, this.w, 8 * u);
  }

  private drawCustomer(): void {
    const ctx = this.ctx, u = this.u(), o = this.order!;
    const slide = this.leaveT > 0 ? (1 - this.leaveT / 1.0) : this.arriveT > 0 ? -(this.arriveT / 0.6) : 0;
    const cx = this.w * 0.24 + slide * this.w * 0.9, cy = 122 * u;
    const r = 34 * u;
    drawCustomer(ctx, o.who, cx, cy, r, this.t);

    // patience, as a ring around the customer
    ctx.strokeStyle = 'rgba(20,50,80,0.15)'; ctx.lineWidth = 4 * u;
    ctx.beginPath(); ctx.arc(cx, cy, r + 8 * u, 0, TAU); ctx.stroke();
    ctx.strokeStyle = this.patience > 0.35 ? '#5fae6a' : '#e0574a';
    ctx.beginPath(); ctx.arc(cx, cy, r + 8 * u, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(this.patience, 0, 1)); ctx.stroke();

    // the order card
    const cardX = this.w * 0.44, cardY = 66 * u, cardW = this.w - cardX - 14 * u, cardH = 112 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,80,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    // a little tail towards the customer
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.moveTo(cardX, cardY + 40 * u); ctx.lineTo(cardX - 10 * u, cardY + 50 * u); ctx.lineTo(cardX, cardY + 60 * u); ctx.closePath(); ctx.fill();

    const items = FRUITS.filter(f => o.wants[f]);
    const lineH = cardH / (items.length + 1);
    ctx.textAlign = 'left';
    items.forEach((f, i) => {
      const y = cardY + lineH * (i + 0.85);
      const n = o.wants[f] ?? 0;
      ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 22);
      ctx.fillText(String(n), cardX + 14 * u, y + 8 * u);
      // for small counts the card shows exactly that many, so it can be counted straight off;
      // for bigger counts one picture and the word, so nobody counts the picture twice
      if (n <= 5) for (let k = 0; k < n; k++) drawFruit(ctx, f, cardX + 50 * u + k * 21 * u, y, 8.5 * u);
      else {
        drawFruit(ctx, f, cardX + 52 * u, y, 11 * u);
        ctx.fillStyle = 'rgba(20,50,80,0.75)'; ctx.font = this.font('800', 11.5);
        ctx.fillText(fruitName(f, n, NL()), cardX + 72 * u, y + 4 * u, cardW - 84 * u);
      }
    });
    // what kind of order it is, in one line at the bottom of the card
    ctx.fillStyle = 'rgba(20,50,80,0.6)'; ctx.font = this.font('800', 9.5);
    const kindLine =
      o.kind === 'share' ? T(`shared fairly between ${o.between}`, `eerlijk verdeeld over ${o.between}`) :
      o.kind === 'more' ? T('some are already in the basket', 'er zit al wat in de mand') :
      o.kind === 'mixed' ? T('two kinds', 'twee soorten') : T('please', 'alsjeblieft');
    ctx.fillText(kindLine, cardX + 14 * u, cardY + cardH - 10 * u, cardW - 28 * u);
  }

  /** The crates and the bell live on the counter at the bottom; the counter starts just above them. */
  private crateTop(): number { return this.h - 62 * this.u() - 18 * this.u(); }
  private counterTop(): number { return this.crateTop() - 16 * this.u(); }

  private basketRects(): Array<{ x: number; y: number; w: number; h: number }> {
    const u = this.u(), n = this.baskets.length;
    // baskets sit in the band between the hint and the counter, no taller than a basket should be
    const bandTop = 222 * u, bandBottom = this.counterTop() - 10 * u;
    const bh = Math.min(bandBottom - bandTop, 175 * u);
    const top = bandTop + Math.max(0, (bandBottom - bandTop - bh) / 2);
    const gap = 10 * u;
    const bw = Math.min(n === 1 ? 210 * u : 200 * u, (this.w - 24 * u - gap * (n - 1)) / n);
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
      // the basket: a woven trapezoid
      ctx.save();
      ctx.translate(0, -lift);
      ctx.fillStyle = '#d3a56a';
      ctx.beginPath();
      ctx.moveTo(r.x + 6 * u, r.y + 20 * u); ctx.lineTo(r.x + r.w - 6 * u, r.y + 20 * u);
      ctx.lineTo(r.x + r.w - 16 * u, r.y + r.h); ctx.lineTo(r.x + 16 * u, r.y + r.h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 1.5;
      for (let y = r.y + 34 * u; y < r.y + r.h - 6 * u; y += 12 * u) { ctx.beginPath(); ctx.moveTo(r.x + 10 * u, y); ctx.lineTo(r.x + r.w - 10 * u, y); ctx.stroke(); }
      ctx.fillStyle = '#b98b5a';
      ctx.beginPath(); ctx.roundRect(r.x, r.y + 12 * u, r.w, 14 * u, 7 * u); ctx.fill();
      if (on) { ctx.strokeStyle = '#3f86d6'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.roundRect(r.x - 4 * u, r.y + 8 * u, r.w + 8 * u, r.h - 4 * u, 12 * u); ctx.stroke(); }
      // contents, in rows, each piece tappable to take it out again
      const b = this.baskets[i];
      let k = 0;
      const cols = Math.max(3, Math.floor((r.w - 24 * u) / (32 * u)));
      const fr = 13 * u;
      for (const f of FRUITS) {
        for (let q = 0; q < (b[f] ?? 0); q++) {
          const col = k % cols, row = Math.floor(k / cols);
          const x = r.x + 20 * u + col * ((r.w - 40 * u) / (cols - 1 || 1));
          const y = r.y + r.h - 24 * u - row * 30 * u;
          drawFruit(ctx, f, x, y, fr);
          this.hits.push({ id: `take:${i}:${f}`, x: x - 15 * u, y: y - 15 * u + lift, w: 30 * u, h: 30 * u });
          k++;
        }
      }
      ctx.restore();
      if (this.baskets.length > 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(20,50,80,0.6)'; ctx.font = this.font('800', 10);
        ctx.fillText(`${i + 1}`, r.x + r.w / 2, r.y + 8 * u);
      }
      // the whole basket is a target for choosing it; pieces sit on top in the hit order
      this.hits.push({ id: `basket:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
    });
  }

  private drawCrates(): void {
    const ctx = this.ctx, u = this.u();
    const fruits = this.level.fruits;
    const n = fruits.length;
    const cw = Math.min(78 * u, (this.w - 24 * u - 76 * u - 8 * u * n) / n), ch = 62 * u;
    const y = this.crateTop();
    let x = 12 * u;
    for (const f of fruits) {
      ctx.fillStyle = '#8a6a44';
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 8 * u); ctx.fill();
      ctx.fillStyle = '#a8845a';
      ctx.fillRect(x + 4 * u, y + 4 * u, cw - 8 * u, ch * 0.45);
      // a heap of that fruit
      drawFruit(ctx, f, x + cw * 0.35, y + ch * 0.36, 9 * u);
      drawFruit(ctx, f, x + cw * 0.62, y + ch * 0.32, 9 * u);
      drawFruit(ctx, f, x + cw * 0.48, y + ch * 0.5, 9 * u);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff7ea'; ctx.font = this.font('800', 9.5);
      ctx.fillText(fruitName(f, 2, NL()), x + cw / 2, y + ch - 8 * u, cw - 6 * u);
      this.hits.push({ id: `crate:${f}`, x, y, w: cw, h: ch });
      x += cw + 8 * u;
    }
    // the bell
    const bx = this.w - 12 * u - 68 * u, by = y;
    const ready = this.order && this.leaveT === 0 && this.arriveT === 0;
    ctx.fillStyle = ready ? '#f0c33b' : 'rgba(240,195,59,0.45)';
    ctx.beginPath(); ctx.roundRect(bx, by, 68 * u, ch, 16 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#6a4a1a';
    ctx.beginPath(); ctx.arc(bx + 34 * u, by + 26 * u, 12 * u, Math.PI, 0); ctx.lineTo(bx + 46 * u, by + 34 * u); ctx.lineTo(bx + 22 * u, by + 34 * u); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 34 * u, by + 38 * u, 3 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('900', 10); ctx.textAlign = 'center';
    ctx.fillText(T('Ring', 'Bel'), bx + 34 * u, by + ch - 8 * u);
    this.hits.push({ id: 'bell', x: bx, y: by, w: 68 * u, h: ch });
  }

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    // progress and coins on the awning line
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(this.w / 2 - 70 * u, 34 * u, 140 * u, 24 * u, 12 * u); ctx.fill();
    ctx.fillStyle = '#14324f'; ctx.font = this.font('800', 11);
    ctx.fillText(`${this.served + this.left} / ${this.level.customers} · ${this.coins} ${T('coins', 'munten')}`, this.w / 2, 50 * u);

    if (this.verdictT > 0 && this.verdictText) {
      ctx.globalAlpha = clamp(this.verdictT, 0, 1);
      ctx.fillStyle = 'rgba(224,87,74,0.95)';
      ctx.font = this.font('800', 11.5);
      const tw = Math.min(this.w - 24 * u, ctx.measureText(this.verdictText).width + 28 * u);
      ctx.beginPath(); ctx.roundRect(this.w / 2 - tw / 2, 186 * u, tw, 26 * u, 13 * u); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(this.verdictText, this.w / 2, 203 * u, this.w - 44 * u);
      ctx.globalAlpha = 1;
    } else if (this.noteT > 0 && this.phase === 'play') {
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = this.font('700', 11.5);
      const tw = Math.min(this.w - 24 * u, ctx.measureText(this.note).width + 28 * u);
      ctx.beginPath(); ctx.roundRect(this.w / 2 - tw / 2, 186 * u, tw, 26 * u, 13 * u); ctx.fill();
      ctx.fillStyle = '#14324f';
      ctx.fillText(this.note, this.w / 2, 203 * u, this.w - 44 * u);
      ctx.globalAlpha = 1;
    }

    for (const p of this.pops) {
      const k = (this.t - p.t0) / 1.1;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.good ? '#2c6a4a' : '#b4543f'; ctx.font = this.font('900', 22);
      ctx.fillText(p.text, p.x, p.y - k * 40 * u);
    }
    ctx.globalAlpha = 1;

    const mw = 84 * u, mh = 30 * u;
    this.button('levels', T('Days', 'Dagen'), 12 * u + mw / 2, 36 * u + mh / 2, mw, mh, false);
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, cx: number, cy: number, w: number, h: number, strong: boolean): void {
    const ctx = this.ctx;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = strong ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,80,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#14324f'; ctx.font = this.font('800', h > 40 * this.u() ? 15 : 11.5);
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + h * 0.16, w - 20);
    this.hits.push({ id, x, y, w, h });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(10,30,50,0.55)'; ctx.fillRect(0, 0, this.w, this.h);
    const cw = Math.min(340 * u, this.w - 32 * u), ch = 250 * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 22 * u); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 22);
    ctx.fillText(this.phase === 'won' ? T('The stall is sold out', 'De kraam is uitverkocht') : T('A quiet day', 'Een stille dag'), this.w / 2, y + 44 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(`${T('served', 'geholpen')} ${this.served} · ${T('walked off', 'weggelopen')} ${this.left} · ${T('wrong baskets', 'foute manden')} ${this.wrong} · ${this.coins} ${T('coins', 'munten')}`, this.w / 2, y + 70 * u, cw - 30 * u);
    if (this.phase === 'won') {
      for (let i = 0; i < 3; i++) drawStar(ctx, this.w / 2 + (i - 1) * 30 * u, y + 108 * u, 12 * u, i < this.earned ? '#e8b437' : 'rgba(20,50,80,0.18)');
    } else {
      ctx.fillText(NL() ? this.level.hintNl : this.level.hint, this.w / 2, y + 104 * u, cw - 30 * u);
    }
    const bw = 130 * u, bh = 44 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw / 2 - 6 * u, y + ch - 72 * u, bw, bh, true);
    if (this.phase === 'won' && this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next day', 'Volgende dag'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
    else this.button('levels', T('All days', 'Alle dagen'), this.w / 2 + bw / 2 + 6 * u, y + ch - 72 * u, bw, bh, true);
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14324f'; ctx.font = this.font('900', 24);
    ctx.fillText('Market Day', this.w / 2, 62 * u);
    ctx.fillStyle = 'rgba(20,50,80,0.7)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Fill the basket. Ring the bell.', 'Vul de mand. Bel.'), this.w / 2, 84 * u);
    const cols = this.w > 700 * u ? 4 : 2;
    const cw = Math.min(170 * u, (this.w - 32 * u - (cols - 1) * 12 * u) / cols), chh = 92 * u;
    const total = cols * cw + (cols - 1) * 12 * u;
    const x0 = (this.w - total) / 2;
    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + 12 * u), y = 112 * u + row * (chh + 12 * u);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      ctx.fillStyle = open ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,80,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = open ? 'rgba(20,50,80,0.55)' : 'rgba(20,50,80,0.3)'; ctx.font = this.font('800', 10);
      ctx.fillText(`${i + 1}`, x + 12 * u, y + 20 * u);
      ctx.fillStyle = open ? '#14324f' : 'rgba(20,50,80,0.4)'; ctx.font = this.font('900', 13);
      ctx.fillText(nameOf(L), x + 12 * u, y + 40 * u, cw - 24 * u);
      ctx.fillStyle = 'rgba(20,50,80,0.6)'; ctx.font = this.font('700', 9.5);
      ctx.fillText(`${L.customers} ${T('customers', 'klanten')} · ${T('up to', 'tot')} ${L.maxCount}`, x + 12 * u, y + 58 * u, cw - 24 * u);
      for (let s = 0; s < 3; s++) drawStar(ctx, x + 18 * u + s * 16 * u, y + 76 * u, 5.5 * u, s < p.stars ? '#e8b437' : 'rgba(20,50,80,0.18)');
      if (!open) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(20,50,80,0.45)'; ctx.font = this.font('800', 9); ctx.fillText(T('finish the one before', 'eerst de vorige'), x + cw - 12 * u, y + 79 * u); }
      this.hits.push({ id: `level:${i}`, x, y, w: cw, h: chh });
    });
    ctx.textAlign = 'left';
  }
}

// ---------- bespoke drawings ----------

/** A piece of fruit, recognisable at ten pixels. */
export function drawFruit(ctx: Ctx, f: Fruit, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = FRUIT_COLOUR[f];
  ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = Math.max(1, r * 0.12);
  if (f === 'apple') {
    ctx.beginPath(); ctx.arc(0, r * 0.1, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.1, -r * 1.3); ctx.stroke();
    ctx.fillStyle = '#5fae6a';
    ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 1.0, r * 0.42, r * 0.2, -0.5, 0, TAU); ctx.fill();
  } else if (f === 'pear') {
    ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.9, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * 0.45, r * 0.58, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.9, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath(); ctx.moveTo(0, -r * 1.0); ctx.lineTo(r * 0.15, -r * 1.45); ctx.stroke();
  } else if (f === 'strawberry') {
    ctx.beginPath(); ctx.moveTo(0, r * 1.15); ctx.quadraticCurveTo(-r * 1.2, r * 0.2, -r * 0.6, -r * 0.6);
    ctx.quadraticCurveTo(0, -r * 1.0, r * 0.6, -r * 0.6); ctx.quadraticCurveTo(r * 1.2, r * 0.2, 0, r * 1.15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    for (const [dx, dy] of [[-0.3, 0.1], [0.3, 0.1], [0, 0.5], [-0.15, -0.3], [0.2, -0.3]]) { ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.1, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#5fae6a';
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { ctx.beginPath(); ctx.ellipse(a * r * 0.5, -r * 0.75, r * 0.32, r * 0.14, a * 0.5, 0, TAU); ctx.fill(); }
  } else if (f === 'plum') {
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,60,0.4)'; ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.quadraticCurveTo(r * 0.25, 0, 0, r * 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.32, -0.6, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.6); ctx.lineTo(r * 0.55, -r * 0.6); ctx.lineTo(r * 0.08, r * 1.2); ctx.lineTo(-r * 0.08, r * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5fae6a';
    for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.ellipse(a * r * 0.4, -r * 0.95, r * 0.16, r * 0.45, a * 0.4, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/** A customer: a woodland animal, head and shoulders, with a blink now and then. */
export function drawCustomer(ctx: Ctx, who: Customer, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  const blink = (t * 0.7 + r) % 4 < 0.12;
  const eye = (ex: number, ey: number): void => {
    ctx.fillStyle = '#20304a';
    if (blink) { ctx.fillRect(ex - r * 0.1, ey - r * 0.02, r * 0.2, r * 0.05); return; }
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.03, ey - r * 0.03, r * 0.035, 0, TAU); ctx.fill();
  };
  const body = (c: string): void => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, r * 1.25, r * 0.95, r * 0.6, 0, Math.PI, 0); ctx.fill(); };
  if (who === 'hedgehog') {
    body('#8a6a4a');
    ctx.fillStyle = '#6a4a34';
    for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.lineTo(Math.cos(a - 0.15) * r * 1.25, Math.sin(a - 0.15) * r * 1.25); ctx.lineTo(Math.cos(a + 0.15) * r * 0.75, Math.sin(a + 0.15) * r * 0.75); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#d9b48a'; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20304a'; ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.12, 0, TAU); ctx.fill();
    eye(-r * 0.3, -r * 0.05); eye(r * 0.3, -r * 0.05);
  } else if (who === 'rabbit') {
    body('#c9c4c0');
    ctx.fillStyle = '#c9c4c0';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.35, -r * 1.05, r * 0.22, r * 0.6, s * 0.15, 0, TAU); ctx.fill(); ctx.fillStyle = '#f0b8c0'; ctx.beginPath(); ctx.ellipse(s * r * 0.35, -r * 1.0, r * 0.1, r * 0.4, s * 0.15, 0, TAU); ctx.fill(); ctx.fillStyle = '#c9c4c0'; }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0b8c0'; ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    eye(-r * 0.3, -r * 0.1); eye(r * 0.3, -r * 0.1);
  } else if (who === 'fox') {
    body('#e08a4a');
    ctx.fillStyle = '#e08a4a';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.25, -r * 0.5); ctx.lineTo(s * r * 0.75, -r * 1.2); ctx.lineTo(s * r * 0.85, -r * 0.3); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff7ea'; ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.5, r * 0.38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20304a'; ctx.beginPath(); ctx.arc(0, r * 0.32, r * 0.12, 0, TAU); ctx.fill();
    eye(-r * 0.32, -r * 0.12); eye(r * 0.32, -r * 0.12);
  } else if (who === 'owl') {
    body('#8a6a4a');
    ctx.fillStyle = '#a07a52'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.95, 0, 0, TAU); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.5, -r * 0.7); ctx.lineTo(s * r * 0.75, -r * 1.15); ctx.lineTo(s * r * 0.2, -r * 0.9); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#f4e8c8';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.32, -r * 0.1, r * 0.32, 0, TAU); ctx.fill(); }
    eye(-r * 0.32, -r * 0.1); eye(r * 0.32, -r * 0.1);
    ctx.fillStyle = '#f0c33b'; ctx.beginPath(); ctx.moveTo(0, r * 0.15); ctx.lineTo(-r * 0.12, r * 0.4); ctx.lineTo(r * 0.12, r * 0.4); ctx.closePath(); ctx.fill();
  } else {
    body('#6a6a72');
    ctx.fillStyle = '#6a6a72'; ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4f4f6'; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.9); ctx.lineTo(r * 0.2, -r * 0.9); ctx.lineTo(r * 0.14, r * 0.85); ctx.lineTo(-r * 0.14, r * 0.85); ctx.closePath(); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.55, -r * 0.85); ctx.lineTo(s * r * 0.85, -r * 0.3); ctx.lineTo(s * r * 0.4, r * 0.7); ctx.lineTo(s * r * 0.3, -r * 0.5); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#20304a'; ctx.beginPath(); ctx.arc(0, r * 0.5, r * 0.12, 0, TAU); ctx.fill();
    eye(-r * 0.34, -r * 0.15); eye(r * 0.34, -r * 0.15);
  }
  ctx.restore();
}

function drawStar(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
