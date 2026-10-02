/**
 * Kiekeboe - peek-a-boo, the first thing in Suri made for a child of two.
 *
 * A meadow, or the farm at night, with eight places an animal can hide. Tap one and it opens, the
 * animal looks out, makes its own sound, and Suri says its name. Tap again and it hides. That is the
 * whole game: one gesture, nothing to get wrong, no score and no stars (the simplest shape of a game
 * and the full game are the same here, see `src/platform/who.ts`). A round ends when every place has
 * been opened once; Suri says so, and "Nog een keer" deals the animals to new places.
 *
 * For four and up there is one gentle extra: Suri asks "Waar is de koe?", and after a few seconds of
 * nothing the right place wiggles. There is no wrong answer; any other place just shows its animal.
 * It practises looking for a named thing among several places, not more.
 *
 * Nothing is saved: there is no progress to keep and the app must not remember a toddler's play.
 * Rules: `./model.ts`. Drawing: `./paint.ts`, `./critters.ts`. Sound: `./kiekeboesfx.ts`.
 */

import { TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { bleedEdges, chunkyButton, easeInOut, glassPanel, heading, Particles, roundRectPath, type Ctx } from '../../render/look';
import { NL, T } from '../../util/lang';
import { forgetLine, speakLine } from '../../platform/voice';
import { yearsNow } from '../../platform/who';
import {
  ANIMALS, DONE_AFTER, HIDES, NEXT_QUESTION_AFTER, SCENES, WIGGLE_AFTER, animalInfo, asksWhere, foundCount, layoutFor,
  newRound, pickTarget, spotRadius, spotRects, tapSpot, type Round, type SceneId,
} from './model';
import { horizonOf, paintHide, paintScene, tinter, foundDot } from './paint';
import { paintAnimal } from './critters';
import { callOf, kiekeboeSfx as sfx } from './kiekeboesfx';

type Phase = 'menu' | 'play' | 'done';
interface Hit { id: string; x: number; y: number; w: number; h: number }

const DUST: Record<string, { kind: 'leaf' | 'crumb' | 'dust' | 'splash' | 'spark'; colour: string }> = {
  bush: { kind: 'leaf', colour: '#6cc46a' },
  barrel: { kind: 'crumb', colour: '#c98d55' },
  blanket: { kind: 'dust', colour: '#f3d9c4' },
  door: { kind: 'dust', colour: '#e8c9a0' },
  haystack: { kind: 'crumb', colour: '#efc95a' },
  rock: { kind: 'dust', colour: '#cfc4b0' },
  wave: { kind: 'splash', colour: '#9ad4f5' },
  cloud: { kind: 'spark', colour: '#ffffff' },
};

export class Kiekeboe {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private st = 0;
  private sb = 0;
  private sl = 0;
  private sr = 0;
  private fullW = 0;
  private fullH = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'menu';
  private scene: SceneId = 'meadow';
  private round: Round = newRound(1);
  private roundNo = 0;
  private seedBase = Math.floor(Math.random() * 1e9);
  /** how open each place is, 0..1, eased in the drawing */
  private amount: number[] = HIDES.map(() => 0);
  private ps = new Particles();
  private hits: Hit[] = [];
  private pressed: string | null = null;
  private note = '';

  /** timed things (an animal's call, its name, the end of the round), on the game's own clock so a
   *  pause or a backgrounded tab does not fire them in a heap */
  private clock = 0;
  private epoch = 0;
  private queue: Array<{ at: number; epoch: number; fn: () => void }> = [];

  // the question, for four and up
  private ask = asksWhere(yearsNow());
  private target = -1;
  private idle = 0;
  private repeated = false;
  private askToken = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    const up = (): void => { this.pressed = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    (window as unknown as { __kiekeboe?: Kiekeboe }).__kiekeboe = this;
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
    this.say(T('Choose where to play.', 'Kies waar je wilt spelen.'));
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  canBack(): boolean { return this.phase !== 'menu'; }
  back(): void {
    if (this.phase === 'menu') return;
    this.phase = 'menu';
    this.epoch++;
    this.target = -1;
    this.ps.clear();
    this.say(T('Choose where to play.', 'Kies waar je wilt spelen.'));
  }

  /** The last thing Suri said, for the guide in the corner to say again. */
  spoken(): string { return this.note; }

  debugState(): Record<string, unknown> {
    const rects = spotRects(this.w, this.h);
    return {
      phase: this.phase, scene: this.scene, ask: this.ask, round: this.roundNo,
      at: this.round.at, open: this.round.open, found: this.round.found, foundCount: foundCount(this.round),
      target: this.target, idle: Math.round(this.idle * 10) / 10, wiggling: this.wiggling(),
      note: this.note, size: { w: this.w, h: this.h },
      spots: rects.map((r, i) => ({ i, hide: HIDES[i], animal: this.round.at[i], x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) })),
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }
  private font(weight: string, size: number): string { return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`; }

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

  // ---------- speech and time ----------

  private say(text: string): void {
    this.note = text;
    // an animal named twice in a row is still named twice: the child asked again by tapping again
    forgetLine();
    speakLine(text);
  }

  private later(secs: number, fn: () => void): void {
    this.queue.push({ at: this.clock + secs, epoch: this.epoch, fn });
  }

  // ---------- a round ----------

  private startScene(s: SceneId): void {
    this.scene = s;
    sfx.tap();
    this.roundNo = 0;
    this.begin(undefined);
  }

  private begin(prev: Round['at'] | undefined): void {
    this.epoch++;
    this.queue = [];
    this.round = newRound(this.seedBase + this.roundNo * 7919, prev);
    this.amount = HIDES.map(() => 0);
    this.phase = 'play';
    this.target = -1;
    this.idle = 0;
    this.ps.clear();
    this.say(T('Who is hiding? Tap and see.', 'Wie zit er verstopt? Tik maar.'));
    if (this.ask) this.scheduleAsk(3.2);
  }

  private again(): void {
    sfx.tap();
    this.roundNo++;
    this.begin(this.round.at);
  }

  private tapSpot(i: number): void {
    const res = tapSpot(this.round, i);
    this.idle = 0;
    this.repeated = false;
    const a = animalInfo(this.round.at[i]);
    if (!res.opened) { sfx.close(); return; }
    sfx.open();
    const pos = layoutFor(this.w, this.h)[i], r = spotRadius(this.w, this.h);
    const d = DUST[HIDES[i]];
    this.ps.spawn(d.kind, pos.x * this.w, pos.y * this.h - r * 0.2, 10, { colour: d.colour, speed: 120 * this.u(), size: 6 * this.u() });
    // the animal answers first, then Suri names it: said on top of each other neither is heard
    this.later(0.3, () => callOf(a.id));
    this.later(1.1, () => this.say(NL() ? a.lineNl : a.line));
    if (res.complete) {
      this.askToken++;
      this.target = -1;
      this.later(DONE_AFTER, () => this.finish());
    } else if (this.ask && i === this.target) {
      this.target = -1;
      this.scheduleAsk(NEXT_QUESTION_AFTER + 1.1);
    }
  }

  private finish(): void {
    if (this.phase !== 'play') return;
    this.phase = 'done';
    this.target = -1;
    sfx.complete();
    this.say(T('You found them all.', 'Je hebt ze allemaal gevonden.'));
  }

  private scheduleAsk(after: number): void {
    const token = ++this.askToken;
    this.later(after, () => { if (token === this.askToken) this.askNext(); });
  }

  private askNext(): void {
    if (this.phase !== 'play') return;
    const rng = (): number => Math.random();
    const t = pickTarget(this.round, rng);
    if (t < 0) return;
    this.target = t;
    this.idle = 0;
    this.repeated = false;
    const a = animalInfo(this.round.at[t]);
    this.say(NL() ? a.askNl : a.ask);
  }

  private wiggling(): boolean {
    return this.phase === 'play' && this.ask && this.target >= 0 && this.idle >= WIGGLE_AFTER && !this.round.open[this.target];
  }

  // ---------- update ----------

  private update(dt: number): void {
    this.clock += dt;
    this.ps.update(dt);
    for (let i = 0; i < this.amount.length; i++) {
      const goal = this.round.open[i] && this.phase !== 'menu' ? 1 : 0;
      const rate = goal ? 2.1 : 3.2;
      this.amount[i] = goal > this.amount[i] ? Math.min(1, this.amount[i] + dt * rate) : Math.max(0, this.amount[i] - dt * rate);
    }
    const due = this.queue.filter(q => q.at <= this.clock);
    if (due.length) {
      this.queue = this.queue.filter(q => q.at > this.clock);
      for (const q of due) if (q.epoch === this.epoch) q.fn();
    }
    if (this.phase === 'play' && this.target >= 0) {
      this.idle += dt;
      // once, at the moment the wiggle starts: the question again, for a child who looked away
      if (this.idle >= WIGGLE_AFTER && !this.repeated) {
        this.repeated = true;
        const a = animalInfo(this.round.at[this.target]);
        this.say(NL() ? a.askNl : a.ask);
      }
    }
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

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const hit = this.hitAt(this.at(e));
    if (!hit) return;
    this.pressed = hit;
    if (hit.startsWith('scene:')) this.startScene(hit.slice(6) as SceneId);
    else if (hit.startsWith('spot:') && this.phase === 'play') this.tapSpot(Number(hit.slice(5)));
    else if (hit === 'again' && this.phase === 'done') this.again();
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    if (this.phase === 'menu') { this.drawMenu(); return; }
    this.drawField();
    if (this.phase === 'done') this.drawEnd();
  }

  /** One place, with its animal, drawn at (cx, cy). */
  private place(ctx: Ctx, i: number, cx: number, cy: number, r: number, w: number, scene: SceneId, round: Round | null, amount: number): void {
    const tint = tinter(scene);
    const kind = round ? round.at[i] : null;
    paintHide(ctx, HIDES[i], cx, cy, r, easeInOut(amount), this.t, tint, (x, y, size) => {
      if (kind && size > 0.5) paintAnimal(ctx, kind, x, y, size, this.t, i, tint);
    });
    void w;
  }

  private drawField(): void {
    const ctx = this.ctx, u = this.u(), w = this.w, h = this.h;
    const tall = h > w;
    paintScene(ctx, w, h, this.scene, this.t, tall);
    const lay = layoutFor(w, h), r = spotRadius(w, h);
    const rects = spotRects(w, h);
    const order = lay.map((p, i) => ({ i, y: p.y })).sort((a, b) => a.y - b.y);
    const wig = this.wiggling();
    for (const { i } of order) {
      const cx = lay[i].x * w, cy = lay[i].y * h;
      ctx.save();
      const press = this.pressed === `spot:${i}` ? 0.95 : 1;
      let rot = 0, grow = 1;
      if (wig && i === this.target) {
        const ph = this.t % 1.6, env = ph < 0.8 ? Math.sin((ph / 0.8) * Math.PI) : 0;
        rot = Math.sin(this.t * 18) * 0.1 * env; grow = 1 + 0.06 * env;
      }
      // pivot on the foot of the place so it rocks rather than swings
      ctx.translate(cx, cy + r * 0.7); ctx.rotate(rot); ctx.scale(grow * press, grow * press); ctx.translate(-cx, -(cy + r * 0.7));
      this.place(ctx, i, cx, cy, r, w, this.scene, this.round, this.amount[i]);
      ctx.restore();
      if (this.phase === 'play') this.hits.push({ id: `spot:${i}`, ...rects[i] });
    }
    this.ps.draw(ctx);

    // the one thing a grown-up may want to read: what Suri last said, and how many are found
    const pw = Math.min(w - 120 * u, 196 * u), ph = 50 * u;
    glassPanel(ctx, 10 * u, 10 * u, pw, ph, 14 * u, 0.82);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#123047';
    ctx.font = this.font('800', 12.5);
    ctx.fillText(this.note, 20 * u, 30 * u, pw - 20 * u);
    for (let i = 0; i < HIDES.length; i++) foundDot(ctx, 24 * u + i * ((pw - 28 * u) / 7.5), 49 * u, 6 * u, this.round.found[i]);
    void horizonOf; void TAU;
  }

  private button(id: string, label: string, x: number, y: number, bw: number, bh: number, tone = '#4fae6e', ink = '#ffffff'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, bw, bh, { tone, pressed: this.pressed === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', 17);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + bw / 2, face.y + bh * 0.63, bw - 18);
    this.hits.push({ id, x, y, w: bw, h: bh });
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(10,30,50,0.32)';
    ctx.fillRect(0, 0, this.w, this.h);
    const cw = Math.min(this.w - 28 * u, 340 * u), ch = 214 * u;
    const x = (this.w - cw) / 2, y = (this.h - ch) / 2;
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, T('You found them all', 'Je hebt ze allemaal gevonden'), this.w / 2, y + 48 * u, this.font('900', 20), '#123047');
    // all eight, side by side: the round, looked at once
    const step = (cw - 28 * u) / ANIMALS.length;
    this.round.at.forEach((a, i) => {
      const cx = x + 14 * u + step * (i + 0.5);
      paintAnimal(ctx, a, cx, y + 98 * u, Math.min(step * 0.42, 16 * u), this.t, i);
    });
    this.button('again', T('One more time', 'Nog een keer'), this.w / 2 - 82 * u, y + ch - 76 * u, 164 * u, 54 * u);
  }

  private drawMenu(): void {
    const ctx = this.ctx, u = this.u(), w = this.w, h = this.h;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#6ec3f2'); bg.addColorStop(0.55, '#b8e6f6'); bg.addColorStop(1, '#8ed47a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    heading(ctx, 'Kiekeboe', w / 2, 46 * u, this.font('900', 28), '#123047');
    ctx.fillStyle = 'rgba(18,48,71,0.75)';
    ctx.font = this.font('700', 13);
    ctx.fillText(T('Tap a place and see who is hiding.', 'Tik op een plek en kijk wie er zit.'), w / 2, 68 * u, w - 24 * u);

    const wide = w >= h;
    const pad = 14 * u, top = 86 * u, bottom = 16 * u;
    const cw = wide ? (w - pad * 3) / 2 : w - pad * 2;
    const ch = wide ? h - top - bottom : (h - top - bottom - pad) / 2;
    const label = 34 * u;
    SCENES.forEach((s, i) => {
      const x = wide ? pad + i * (cw + pad) : pad, y = wide ? top : top + i * (ch + pad);
      const press = this.pressed === `scene:${s.id}` ? 0.97 : 1;
      ctx.save();
      ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(press, press); ctx.translate(-(x + cw / 2), -(y + ch / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(12,40,60,0.3)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = '#fffdf8'; roundRectPath(ctx, x, y, cw, ch, 20 * u); ctx.fill();
      ctx.restore();
      const art = ch - label;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art - 6 * u, 15 * u); ctx.clip();
      ctx.translate(x + 6 * u, y + 6 * u);
      const aw = cw - 12 * u, ah = art - 6 * u;
      paintScene(ctx, aw, ah, s.id, this.t, ah > aw);
      const lay = layoutFor(aw, ah), r = spotRadius(aw, ah);
      lay.map((p, k) => ({ k, y: p.y })).sort((a, b) => a.y - b.y).forEach(({ k }) => this.place(ctx, k, lay[k].x * aw, lay[k].y * ah, r, aw, s.id, null, 0));
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = '#123047'; ctx.font = this.font('900', 16); ctx.textAlign = 'center';
      ctx.fillText(NL() ? s.nameNl : s.name, x + cw / 2, y + ch - 12 * u, cw - 24 * u);
      this.hits.push({ id: `scene:${s.id}`, x, y, w: cw, h: ch });
    });
  }
}
