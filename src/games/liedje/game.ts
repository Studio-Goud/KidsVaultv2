/**
 * Liedjesmaker - the song game in Suri.
 *
 * A stage with a row of places, and a shelf of five singing animals. Each animal sings one note of
 * a pentatonic scale. Put animals in the places, press Speel, and a spotlight walks the row while
 * each animal bounces and sings; an empty place is a rest. That is all a tune is, and a child can
 * see it. Nothing is scored, nothing is kept (there is no save slice for songs, see the report),
 * and nothing can be got wrong, because no order of these five notes sounds bad.
 *
 * Every session ends: after a song has been played three times Suri says it is a lovely song and
 * the button becomes "Nog een keer". The child may play on from there; there is simply nothing
 * more to win.
 *
 * The simple shape for two and three (`src/platform/who.ts`): four places, three animals, and the
 * song plays by itself as soon as a place is filled. No tempo, no examples.
 *
 * It practises listening to a row of notes and putting things in an order, not what a child learns.
 */

import { clamp, TAU } from '../../util/math';
import { safeArea, uiScale, GUIDE_KEEP } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import {
  EXAMPLES, PLAYS_BEFORE_END, emptySong, exampleSong, filled, isEmpty, move, noteFor, place, remove,
  shelfFor, slotCount, songLength, stepAt, type AnimalId, type Song, type Tempo,
} from './model';
import { liedjeSfx } from './liedjesfx';
import { bleedEdges, chunkyButton, glassPanel, Particles } from '../../render/look';
import { BODY, drawAnimal, drawNote, drawSlot, drawStage } from './paint';
import { drawGuide } from '../../platform/guide';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';

type Ctx = CanvasRenderingContext2D;
type Phase = 'compose' | 'play' | 'end';
interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }
interface Drag { animal: AnimalId; from: number | null; moved: boolean; sx: number; sy: number; x: number; y: number }
interface Play { t0: number; tempo: Tempo; counted: boolean; last: number }
interface Floater { x: number; y: number; t0: number; colour: string }

/** how long a spotlight glow lingers after the spotlight has moved on, seconds: a look, not a rule */
const GLOW = 0.6;
const SING_SECS = 0.45;

export class Liedjesmaker {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0; private h = 0;
  private fullW = 0; private fullH = 0;
  private st = 0; private sb = 0; private sl = 0; private sr = 0;
  private t = 0;
  private raf = 0;

  /** the simple shape, for a child of two or three: four places, three animals, plays by itself */
  private easy = simpleNow();
  private song: Song = emptySong(slotCount(this.easy));
  private tempo: Tempo = 'slow';
  private selected: AnimalId | null = null;
  private drag: Drag | null = null;
  private pointer: number | null = null;
  private play: Play | null = null;
  private plays = 0;
  private ended = false;
  private spot = -1;
  private litAt: number[] = [];
  private singAt: Partial<Record<string, number>> = {};
  private floaters: Floater[] = [];
  private ps = new Particles();
  private hits: Hit[] = [];
  private slotRects: Rect[] = [];
  private shelfRects: Array<Rect & { animal: AnimalId }> = [];
  private pressed: string | null = null;
  private note = '';
  private noteT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onCancel(e));
    (window as unknown as { __liedje?: Liedjesmaker }).__liedje = this;
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
    this.say(this.easy
      ? T('Drag an animal to a place. Then it sings.', 'Sleep een dier naar een plek. Dan zingt het.')
      : T('Tap an animal, then tap a place. Or drag it there.', 'Tik op een dier en dan op een plek. Of sleep het erheen.'), 6);
  }

  destroy(): void { cancelAnimationFrame(this.raf); }

  /** There is only one screen, so there is nothing to step back out of. */
  canBack(): boolean { return false; }
  back(): void { /* nothing to go back to */ }

  /** The last thing the game said, so the guide in the corner can say it again. */
  spoken(): string { return this.note; }

  private say(text: string, secs = 3): void {
    this.note = text; this.noteT = secs;
    speakLine(text);
  }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase(), easy: this.easy, song: this.song.slice(), tempo: this.tempo, selected: this.selected,
      plays: this.plays, ended: this.ended, playing: this.play !== null, spot: this.spot,
      dragging: this.drag ? { animal: this.drag.animal, from: this.drag.from, moved: this.drag.moved } : null,
      filled: filled(this.song),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  private phase(): Phase { return this.ended ? 'end' : this.play ? 'play' : 'compose'; }

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

  private floorY = 0;
  private ctrlY = 0;
  private exY = 0;
  private cellSize = 0;

  /** Works out every rectangle from the size of the safe box. Called once a frame, before drawing. */
  private layout(): void {
    const u = this.u(), w = this.w, h = this.h;
    const n = this.song.length;
    const animals = shelfFor(this.easy);
    const pad = 12 * u, gap = 8 * u;
    // the shelf lives at the bottom, and the guide button owns the bottom-left corner
    const shelfX = GUIDE_KEEP, shelfW = w - GUIDE_KEEP - 10;
    const cell = Math.min(98 * u, shelfW / animals.length, h * 0.26);
    this.cellSize = cell;
    const shelfH = cell + 16 * u;
    const shelfY = h - 8 * u - shelfH;
    this.floorY = shelfY - 6 * u;
    const gx = shelfX + (shelfW - cell * animals.length) / 2;
    this.shelfRects = animals.map((animal, i) => ({ animal, x: gx + i * cell, y: shelfY, w: cell, h: shelfH }));

    const ch = 44 * u;
    this.ctrlY = shelfY - 10 * u - ch;
    const eh = 34 * u;
    this.exY = this.easy ? this.ctrlY : this.ctrlY - 8 * u - eh;

    const top = 56 * u;
    const availBottom = this.exY - 12 * u;
    const cols = this.easy ? 4 : (w >= 560 ? 8 : 4);
    const rows = Math.ceil(n / cols);
    const avail = Math.max(40, availBottom - top);
    const s = Math.max(36, Math.min(112 * u, (w - 2 * pad - gap * (cols - 1)) / cols, (avail - gap * (rows - 1)) / rows));
    const bw = cols * s + gap * (cols - 1), bh = rows * s + gap * (rows - 1);
    const x0 = (w - bw) / 2, y0 = top + Math.max(0, (avail - bh) / 2);
    this.slotRects = Array.from({ length: n }, (_, i) => ({
      x: x0 + (i % cols) * (s + gap), y: y0 + Math.floor(i / cols) * (s + gap), w: s, h: s,
    }));
  }

  /** The slot a dragged animal is over, by where the animal is drawn; -1 over nothing. */
  private slotNear(x: number, y: number): number {
    const inside = this.slotRects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (inside >= 0) return inside;
    let best = -1, bd = 1e9;
    this.slotRects.forEach((r, i) => {
      const d = Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y);
      if (d < r.w * 0.62 && d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ---------- the song ----------

  private sing(a: AnimalId): void {
    liedjeSfx.sing(a);
    this.singAt[a] = this.t;
  }

  private singFrom(a: AnimalId, x: number, y: number): void {
    this.sing(a);
    this.floaters.push({ x, y, t0: this.t, colour: BODY[a] });
  }

  private startPlay(counted: boolean): void {
    if (isEmpty(this.song)) {
      this.say(T('Put an animal in a place first.', 'Zet eerst een dier op een plek.'), 3);
      return;
    }
    this.play = { t0: this.t + 0.08, tempo: this.tempo, counted, last: -1 };
    this.spot = -1;
  }

  private finishPlay(): void {
    const p = this.play;
    this.play = null; this.spot = -1;
    if (!p || !p.counted) return;
    this.plays++;
    if (this.plays >= PLAYS_BEFORE_END && !this.ended) {
      this.ended = true;
      liedjeSfx.done();
      this.say(T('A lovely song. Another one?', 'Mooi liedje. Nog een?'), 6);
    }
  }

  /** Clear the stage for the next song. The only thing "Nieuw" and "Nog een keer" both do. */
  private clearAll(): void {
    this.song = emptySong(slotCount(this.easy));
    this.play = null; this.spot = -1; this.plays = 0; this.ended = false; this.selected = null;
    this.litAt = [];
    liedjeSfx.lift();
    this.say(T('An empty stage. What will you sing?', 'Een leeg podium. Wat ga jij zingen?'), 4);
  }

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.floaters = this.floaters.filter(f => this.t - f.t0 < 1.1);
    const p = this.play;
    if (!p) return;
    const n = this.song.length;
    const step = stepAt(p.tempo, n, this.t - p.t0);
    while (p.last < Math.min(step, n - 1)) {
      p.last++;
      this.spot = p.last;
      this.litAt[p.last] = this.t;
      const a = this.song[p.last];
      const r = this.slotRects[p.last];
      if (a && r) this.singFrom(a, r.x + r.w / 2, r.y + r.h * 0.2);
    }
    // the last note is let ring for a moment before the spotlight goes out
    if (this.t - p.t0 >= songLength(p.tempo, n) + 0.3) this.finishPlay();
  }

  // ---------- input ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(x: number, y: number): string | null {
    for (const h of this.hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    if (this.pointer !== null) return;
    const p = this.at(e);
    const id = this.hitAt(p.x, p.y);
    if (!id) return;
    if (id.startsWith('animal:')) {
      const a = id.slice(7) as AnimalId;
      this.pointer = e.pointerId;
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
      this.selected = a;
      const r = this.shelfRects.find(s => s.animal === a)!;
      this.singFrom(a, r.x + r.w / 2, r.y + r.h * 0.2);
      this.drag = { animal: a, from: null, moved: false, sx: p.x, sy: p.y, x: p.x, y: p.y };
      return;
    }
    if (id.startsWith('slot:')) {
      const i = Number(id.slice(5));
      const a = this.song[i];
      if (a) {
        this.pointer = e.pointerId;
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
        this.drag = { animal: a, from: i, moved: false, sx: p.x, sy: p.y, x: p.x, y: p.y };
      } else if (this.selected) {
        this.put(i, this.selected);
      } else {
        liedjeSfx.tap();
        this.say(this.easy ? T('Drag an animal to a place.', 'Sleep een dier naar een plek.')
          : T('Tap an animal first.', 'Tik eerst op een dier.'), 3);
      }
      return;
    }
    this.pressed = id;
    if (id === 'play') { liedjeSfx.tap(); this.startPlay(true); }
    else if (id === 'tempo') {
      this.tempo = this.tempo === 'slow' ? 'fast' : 'slow';
      liedjeSfx.tap();
      this.say(this.tempo === 'fast' ? T('Faster.', 'Sneller.') : T('Slower.', 'Langzamer.'), 2);
    }
    else if (id === 'clear' || id === 'again') this.clearAll();
    else if (id.startsWith('ex:')) {
      const i = Number(id.slice(3));
      this.song = exampleSong(i, this.song.length);
      this.play = null; this.spot = -1; this.litAt = [];
      liedjeSfx.drop();
      this.say(NL() ? EXAMPLES[i].sayNl : EXAMPLES[i].say, 4);
    }
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== this.pointer) return;
    const p = this.at(e);
    d.x = p.x; d.y = p.y;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 10 * this.u()) {
      d.moved = true;
      if (d.from !== null) liedjeSfx.lift();
    }
  }

  private onCancel(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    this.drag = null; this.pointer = null; this.pressed = null;
  }

  private onUp(e: PointerEvent): void {
    this.pressed = null;
    const d = this.drag;
    if (!d || e.pointerId !== this.pointer) return;
    this.drag = null; this.pointer = null;
    const p = this.at(e);
    d.x = p.x; d.y = p.y;
    if (!d.moved) {
      // a tap. On the shelf the animal is already selected and has sung; on a place it sings, or
      // swaps for the animal that is selected
      if (d.from !== null) {
        if (this.selected && this.selected !== d.animal) this.put(d.from, this.selected);
        else { const r = this.slotRects[d.from]; this.singFrom(d.animal, r.x + r.w / 2, r.y + r.h * 0.2); }
      }
      return;
    }
    const target = this.slotNear(d.x, d.y - this.dragLift());
    if (d.from === null) {
      if (target >= 0) this.put(target, d.animal);
      return;
    }
    // an animal picked up from a place: onto another place it moves there, anywhere else it is removed
    if (target >= 0 && target !== d.from) {
      this.song = move(this.song, d.from, target);
      this.landed(target, d.animal);
    } else if (target === d.from) {
      this.landed(target, d.animal);
    } else {
      this.song = remove(this.song, d.from);
      liedjeSfx.lift();
    }
  }

  /** How far above the finger the dragged animal is drawn, so the finger does not hide it. */
  private dragLift(): number { return this.cellSize * 0.45; }

  private put(slot: number, a: AnimalId): void {
    this.song = place(this.song, slot, a);
    this.landed(slot, a);
    // for two and three the song plays by itself as soon as a place is filled
    if (this.easy) this.startPlay(false);
  }

  private landed(slot: number, a: AnimalId): void {
    const r = this.slotRects[slot];
    this.singFrom(a, r.x + r.w / 2, r.y + r.h * 0.2);
    this.litAt[slot] = this.t;
    this.ps.spawn('spark', r.x + r.w / 2, r.y + r.h / 2, 7, { colour: '#ffe27a', speed: 110, size: r.w * 0.08, max: 0.6 });
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private singLook(key: string | number): { sing: number; squash: number } {
    const at = this.singAt[String(key)];
    if (at === undefined) return { sing: 0, squash: 0 };
    const s = this.t - at;
    if (s < 0 || s > SING_SECS) return { sing: 0, squash: 0 };
    const k = 1 - s / SING_SECS;
    return { sing: Math.abs(Math.sin(s * TAU * 3)) * k, squash: s < 0.3 ? Math.sin((s / 0.3) * Math.PI) : 0 };
  }

  private draw(): void {
    const ctx = this.ctx, u = this.u();
    this.layout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawStage(ctx, this.fullW, this.fullH, this.st + this.floorY, this.t);
    ctx.translate(this.sl, this.st);
    this.hits = [];

    // the spot on the slot that is being played now; the animal that bounces is the one that sings
    const dragFrom = this.drag && this.drag.moved ? this.drag.from : null;
    const dragTarget = this.drag && this.drag.moved ? this.slotNear(this.drag.x, this.drag.y - this.dragLift()) : -1;
    this.slotRects.forEach((r, i) => {
      const a = dragFrom === i ? null : this.song[i];
      const lit = this.spot === i ? 1 : this.litAt[i] === undefined ? 0 : clamp(1 - (this.t - this.litAt[i]) / GLOW, 0, 1);
      // a slot's animal sings for as long as its own note rings
      const sl = this.spot === i && a ? this.singLookSlot(i) : { sing: 0, squash: 0 };
      drawSlot(ctx, r.x, r.y, r.w, { animal: a, lit, target: dragTarget === i, sing: sl.sing, squash: sl.squash });
      this.hits.push({ id: `slot:${i}`, x: r.x, y: r.y, w: r.w, h: r.h });
    });

    // controls
    this.drawControls();
    this.drawShelf();

    // notes rising from whoever sang
    for (const f of this.floaters) {
      const k = (this.t - f.t0) / 1.1;
      drawNote(ctx, f.x + Math.sin(k * 6) * 6 * u, f.y - k * 46 * u, 15 * u, f.colour, 1 - k);
    }
    this.ps.draw(ctx);

    // the animal in the hand
    if (this.drag && this.drag.moved) {
      const d = this.drag;
      drawAnimal(ctx, d.animal, d.x, d.y - this.dragLift(), this.cellSize * 0.36, { squash: 0.5 });
    }

    this.drawTop();
  }

  private singLookSlot(i: number): { sing: number; squash: number } {
    const a = this.song[i];
    if (!a) return { sing: 0, squash: 0 };
    // the slot's own bounce runs from the moment the spotlight reached it
    const at = this.litAt[i];
    if (at === undefined) return { sing: 0, squash: 0 };
    const s = this.t - at;
    if (s < 0 || s > SING_SECS) return { sing: 0, squash: 0 };
    const k = 1 - s / SING_SECS;
    return { sing: Math.abs(Math.sin(s * TAU * 3)) * k, squash: s < 0.3 ? Math.sin((s / 0.3) * Math.PI) : 0 };
  }

  private drawTop(): void {
    const ctx = this.ctx, u = this.u(), w = this.w;
    // Suri in the corner; the guide button repeats what she said
    const pose = this.ended ? 'cheer' : this.noteT > 0 ? 'talk' : 'watch';
    drawGuide(ctx, 12 * u + 20 * u, 50 * u, 46 * u, { pose, t: this.t, facing: 1, saying: this.noteT > 0 ? 0.5 + 0.5 * Math.sin(this.t * 9) : 0 });
    const px = 12 * u + 46 * u, pw = Math.max(80, w - px - 70 * u), ph = 38 * u, py = 6 * u;
    glassPanel(ctx, px, py, pw, ph, 16 * u, 0.92);
    // two lines at most, and the type shrinks until they fit
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#4a2c0b';
    let size = 14, lines: string[] = [];
    for (; size >= 9; size -= 1) {
      ctx.font = this.font('800', size);
      lines = this.wrap(this.note, pw - 20 * u);
      if (lines.length <= 2 && lines.length * size * 1.2 * u <= ph - 6 * u) break;
    }
    const lh = size * 1.2 * u;
    lines.forEach((l, i) => ctx.fillText(l, px + pw / 2, py + ph / 2 + (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }

  private wrap(text: string, maxW: number): string[] {
    const words = text.split(' '), out: string[] = [];
    let cur = '';
    for (const wd of words) {
      const next = cur ? cur + ' ' + wd : wd;
      if (cur && this.ctx.measureText(next).width > maxW) { out.push(cur); cur = wd; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  }

  private button(id: string, x: number, y: number, w: number, h: number, label: string, tone: string, ink: string, icon = false, size = 16): void {
    const ctx = this.ctx, u = this.u();
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.pressed === id });
    this.hits.push({ id, x, y, w, h });
    ctx.save();
    ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    let fs = size;
    ctx.font = this.font('900', fs);
    const room = w - (icon ? 40 : 16) * u;
    while (fs > 9 && ctx.measureText(label).width > room) { fs--; ctx.font = this.font('900', fs); }
    const tw = ctx.measureText(label).width;
    const cx = x + w / 2 + (icon ? 12 * u : 0), cy = face.y + h / 2;
    ctx.fillText(label, cx, cy + 1);
    if (icon) {
      const ix = cx - tw / 2 - 16 * u, s = 8 * u;
      ctx.beginPath(); ctx.moveTo(ix - s * 0.6, cy - s); ctx.lineTo(ix + s, cy); ctx.lineTo(ix - s * 0.6, cy + s); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  private drawControls(): void {
    const u = this.u(), w = this.w;
    const pad = 12 * u, gap = 8 * u, ch = 44 * u;
    const count = this.easy ? 2 : 3;
    const bw = Math.min(160 * u, (w - 2 * pad - gap * (count - 1)) / count);
    const x0 = (w - (bw * count + gap * (count - 1))) / 2;
    let i = 0;
    const nextX = (): number => x0 + i++ * (bw + gap);
    this.button('play', nextX(), this.ctrlY, bw, ch, T('Play', 'Speel'), '#7ed957', '#16391a', true, 17);
    if (!this.easy) {
      this.button('tempo', nextX(), this.ctrlY, bw, ch,
        this.tempo === 'slow' ? T('Faster', 'Sneller') : T('Slower', 'Langzamer'), '#ffd24a', '#4a3300', false, 16);
    }
    if (this.ended) this.button('again', nextX(), this.ctrlY, bw, ch, T('Another go', 'Nog een keer'), '#ff9f5a', '#4a1f00', false, 16);
    else this.button('clear', nextX(), this.ctrlY, bw, ch, T('New', 'Nieuw'), '#fff6e0', '#4a2c0b', false, 16);

    if (this.easy) return;
    const eh = 34 * u;
    const ew = Math.min(190 * u, (w - 2 * pad - gap * 2) / 3);
    const ex0 = (w - (ew * 3 + gap * 2)) / 2;
    EXAMPLES.forEach((ex, k) => {
      this.button(`ex:${k}`, ex0 + k * (ew + gap), this.exY, ew, eh, NL() ? ex.nameNl : ex.name, '#fff1c9', '#5a3a10', false, 13);
    });
  }

  private drawShelf(): void {
    const ctx = this.ctx, u = this.u();
    if (this.shelfRects.length === 0) return;
    const first = this.shelfRects[0], last = this.shelfRects[this.shelfRects.length - 1];
    // the plank the animals stand on
    ctx.fillStyle = '#e1a868';
    ctx.beginPath();
    ctx.roundRect(first.x - 6 * u, first.y + first.h - 18 * u, last.x + last.w - first.x + 12 * u, 10 * u, 5 * u);
    ctx.fill();
    for (const r of this.shelfRects) {
      const sel = this.selected === r.animal;
      const note = noteFor(r.animal);
      if (sel) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.roundRect(r.x + 3 * u, r.y, r.w - 6 * u, r.h - 4 * u, 18 * u); ctx.fill();
        ctx.strokeStyle = '#ffb91f'; ctx.lineWidth = 3 * u; ctx.stroke();
      }
      const look = this.singLook(r.animal);
      const rad = r.w * 0.31;
      const idle = sel ? Math.sin(this.t * 4) * 0.04 : 0;
      drawAnimal(ctx, r.animal, r.x + r.w / 2, r.y + r.h * 0.42, rad, { sing: look.sing, squash: Math.max(look.squash, idle) });
      ctx.save();
      ctx.font = this.font('900', 11); ctx.textAlign = 'center'; ctx.fillStyle = '#4a2c0b';
      ctx.fillText(NL() ? note.labelNl : note.label, r.x + r.w / 2, r.y + r.h - 19 * u);
      ctx.restore();
      this.hits.push({ id: `animal:${r.animal}`, x: r.x, y: r.y, w: r.w, h: r.h });
    }
  }
}
