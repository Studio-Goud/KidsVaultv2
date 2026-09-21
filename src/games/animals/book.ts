/**
 * Dierenboek - the animal book.
 *
 * Nine shelves, a few thousand animals, and a real photograph of every one of them. A child picks
 * a shelf, scrolls a grid of photographs, and taps one; the page that opens says its name in
 * Dutch, in English and in Latin, draws it beside a child on one ruler so "two hundred and fifty
 * centimetres" becomes something you can see, lights up the continents it has really been recorded
 * on, and says what it eats. There is a keyboard a child can hunt-and-peck at, and a button that
 * opens an animal nobody chose.
 *
 * Everything on the screen is canvas. The photographs come from Wikimedia Commons as they are
 * needed; everything else - the shelves, the map, the silhouettes, the keyboard - is drawn here.
 *
 * The one thing it keeps is which animals have been looked at. Not a score and not a streak: a
 * count, the way a child counts the stickers already in the album.
 */

import { lang, t } from '../../i18n';
import { persist, save } from '../../util/storage';
import { safeArea, uiScale } from '../../util/ui';
import { chunkyButton, contactShadow, easeOutCubic, grainOver, hexA, roundRectPath, shade, vGrad } from '../../render/look';
import { child, creature } from './creatures';
import { drawCover, onPhoto, photo, photoCount, photoUrl } from './photo';
import { worldMap } from './worldmap';
import {
  CONTINENT_EN, CONTINENT_NL, GROUPS, STATUS_EN, STATUS_NL, STATUS_TONE,
  compareToChild, facts, groupById, joinNames, scaleBar, search, shelf, sizeLabel,
  type Animal, type GroupId,
} from './rules';

type Ctx = CanvasRenderingContext2D;
type View = 'loading' | 'shelves' | 'grid' | 'detail' | 'search';

interface Hit { id: string; x: number; y: number; w: number; h: number }

interface Bundle {
  v: number;
  built: string;
  base: string;
  /** the dozen licence names, interned: thousands of photographs share them */
  licences: string[];
  species: Animal[];
}

const NL = (): boolean => lang() === 'nl';
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (a: Animal): string => (NL() ? a.n : a.e);
const otherName = (a: Animal): string => (NL() ? a.e : a.n);

const INK = '#173a4f';
const SOFT = '#4c6f85';
const PAPER = '#f4f0e4';

const KEYS = 'abcdefghijklmnopqrstuvwxyz';

export class AnimalBook {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private st = 0;
  private sb = 0;
  private t = 0;
  private raf = 0;

  private all: Animal[] = [];
  private base = '';
  private licences: string[] = [];
  private text: Record<string, string> = {};
  private loadState: 'loading' | 'ready' | 'failed' = 'loading';
  private loadMsg = '';

  private view: View = 'loading';
  private group: GroupId | null = null;
  private list: Animal[] = [];
  private at = 0;
  private query = '';
  private seen = new Set<number>();

  private scroll = 0;
  /** where the grid was left, so coming back out of an animal lands on the same row */
  private gridScroll = 0;
  private scrollMax = 0;
  private vel = 0;
  private dragging = false;
  private dragged = false;
  private lastY = 0;
  private downId: string | null = null;
  private downAt = 0;
  private hits: Hit[] = [];
  private enter = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    for (const id of save.animals.seen) this.seen.add(id);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.dragging = false; this.downId = null; });
    canvas.addEventListener('wheel', e => { this.scroll += e.deltaY; this.vel = 0; e.preventDefault(); }, { passive: false });
    onPhoto(() => { /* a picture landed; the loop is already redrawing */ });

    void this.load();
    (window as unknown as { __animals?: AnimalBook }).__animals = this;

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

  destroy(): void { cancelAnimationFrame(this.raf); }

  // ---------------------------------------------------------------- the data

  private async load(): Promise<void> {
    try {
      const res = await fetch('./animals/animals.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as Bundle;
      this.all = d.species;
      this.base = d.base;
      this.licences = d.licences ?? [];
      this.loadState = 'ready';
      this.view = 'shelves';
      this.enter = 0;
    } catch (e) {
      this.loadState = 'failed';
      this.loadMsg = String((e as Error).message ?? e);
      return;
    }
    // the paragraphs are twice the weight of everything else and are only wanted once an animal
    // is open, so they come afterwards and the book works without them
    try {
      const res = await fetch(`./animals/text-${NL() ? 'nl' : 'en'}.json`);
      if (res.ok) this.text = await res.json() as Record<string, string>;
    } catch { /* the facts are drawn from the data either way */ }
  }

  // ---------------------------------------------------------------- driving it from outside

  debugState(): {
    view: View; group: string | null; count: number; shown: number;
    at: number; open: string | null; query: string; seen: number; photos: number;
    buttons: Array<{ id: string; x: number; y: number }>;
  } {
    return {
      view: this.view,
      group: this.group,
      count: this.all.length,
      shown: this.list.length,
      at: this.at,
      open: this.view === 'detail' ? (this.list[this.at]?.s ?? null) : null,
      query: this.query,
      seen: this.seen.size,
      photos: photoCount(),
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  /** Put the page where a test wants it, without a fling to wait out. */
  scrollTo(v: number): void {
    this.scroll = Math.max(0, Math.min(this.scrollMax, v));
    this.vel = 0;
  }

  /** Press a button by name. The same path a tap takes, without needing to aim. */
  tap(id: string): boolean {
    if (!this.hits.some(b => b.id === id)) return false;
    this.act(id);
    return true;
  }

  canBack(): boolean { return this.view === 'grid' || this.view === 'detail' || this.view === 'search'; }

  back(): void {
    if (this.view === 'detail') {
      if (this.query) { this.go('search'); return; }
      this.go('grid');
      this.scroll = this.gridScroll;
      return;
    }
    if (this.view === 'grid' || this.view === 'search') { this.query = ''; this.go('shelves'); }
  }

  // ---------------------------------------------------------------- moving about

  private go(v: View): void {
    this.view = v;
    this.scroll = 0;
    this.vel = 0;
    this.enter = 0;
  }

  private openGroup(id: GroupId): void {
    this.group = id;
    this.list = shelf(this.all, id);
    this.query = '';
    this.gridScroll = 0;
    this.go('grid');
  }

  private openAnimal(index: number): void {
    if (this.view === 'grid') this.gridScroll = this.scroll;
    this.at = Math.max(0, Math.min(this.list.length - 1, index));
    const a = this.list[this.at];
    if (a && !this.seen.has(a.i)) {
      this.seen.add(a.i);
      save.animals.seen.push(a.i);
      persist();
    }
    this.go('detail');
  }

  private surprise(): void {
    if (!this.all.length) return;
    // the unseen ones first, so the button keeps handing over something new for as long as it can
    const fresh = this.all.filter(a => !this.seen.has(a.i));
    const from = fresh.length ? fresh : this.all;
    const pick = from[Math.floor(Math.random() * from.length)];
    this.group = pick.g;
    this.list = shelf(this.all, pick.g);
    this.query = '';
    this.gridScroll = 0;
    this.view = 'grid';
    this.openAnimal(this.list.indexOf(pick));
  }

  private act(id: string): void {
    if (id === 'back') { this.back(); return; }
    if (id === 'surprise') { this.surprise(); return; }
    if (id === 'search') { this.query = ''; this.list = []; this.go('search'); return; }
    if (id === 'prev') { if (this.at > 0) this.openAnimal(this.at - 1); return; }
    if (id === 'next') { if (this.at < this.list.length - 1) this.openAnimal(this.at + 1); return; }
    if (id === 'taller') { save.animals.childCm = Math.min(180, save.animals.childCm + 5); persist(); return; }
    if (id === 'shorter') { save.animals.childCm = Math.max(80, save.animals.childCm - 5); persist(); return; }
    if (id.startsWith('shelf:')) { this.openGroup(id.slice(6) as GroupId); return; }
    if (id.startsWith('card:')) { this.openAnimal(Number(id.slice(5))); return; }
    if (id.startsWith('key:')) {
      const k = id.slice(4);
      if (k === 'del') this.query = this.query.slice(0, -1);
      else if (k === 'clear') this.query = '';
      else if (this.query.length < 18) this.query += k;
      this.list = search(this.all, this.query, 80);
      this.scroll = 0;
      return;
    }
  }

  // ---------------------------------------------------------------- input

  private point(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top - this.st };
  }

  private onDown(e: PointerEvent): void {
    const p = this.point(e);
    this.dragging = true;
    this.dragged = false;
    this.lastY = p.y;
    this.vel = 0;
    const hit = this.hitAt(p.x, p.y);
    this.downId = hit?.id ?? null;
    this.downAt = this.t;
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const p = this.point(e);
    const dy = p.y - this.lastY;
    this.lastY = p.y;
    if (Math.abs(dy) > 0.4) {
      this.scroll -= dy;
      this.vel = -dy / Math.max(0.008, 1 / 60);
    }
    if (Math.abs(dy) > 2) { this.dragged = true; this.downId = null; }
  }

  private onUp(e: PointerEvent): void {
    this.dragging = false;
    if (this.downId && !this.dragged && this.t - this.downAt < 0.9) {
      const p = this.point(e);
      const hit = this.hitAt(p.x, p.y);
      if (hit && hit.id === this.downId) this.act(hit.id);
    }
    this.downId = null;
  }

  private hitAt(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const b = this.hits[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // ---------------------------------------------------------------- frame

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

  private u(): number { return uiScale(this.w, this.h); }
  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private update(dt: number): void {
    this.enter = Math.min(1, this.enter + dt * 3.2);
    if (!this.dragging && Math.abs(this.vel) > 1) {
      this.scroll += this.vel * dt;
      this.vel *= Math.pow(0.001, dt);
    } else if (!this.dragging) this.vel = 0;
    // the ends are firm rather than sticky: a child who flings the grid should not lose it
    if (this.scroll < 0) { this.scroll = this.dragging ? this.scroll * 0.6 : 0; this.vel = 0; }
    if (this.scroll > this.scrollMax) {
      this.scroll = this.dragging ? this.scrollMax + (this.scroll - this.scrollMax) * 0.6 : this.scrollMax;
      this.vel = 0;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.w, this.fullH);
    ctx.save();
    ctx.translate(0, this.st);
    this.hits = [];
    if (this.view === 'loading') this.drawLoading();
    else if (this.view === 'shelves') this.drawShelves();
    else if (this.view === 'grid') this.drawGrid();
    else if (this.view === 'detail') this.drawDetail();
    else this.drawSearch();
    ctx.restore();
    grainOver(ctx, 0, 0, this.w, this.fullH, 0.035);
  }

  // ---------------------------------------------------------------- shared pieces

  private button(id: string, x: number, y: number, w: number, h: number, label: string, tone: string, ink = '#ffffff', size = 15): void {
    const ctx = this.ctx;
    const pressed = this.downId === id;
    const r = chunkyButton(ctx, x, y, w, h, { tone, pressed, radius: h * 0.34 });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + w / 2, r.y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    this.hits.push({ id, x, y, w, h: h * 1.15 });
  }

  private wrap(text: string, font: string, maxW: number, maxLines = 99): string[] {
    const ctx = this.ctx;
    ctx.font = font;
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) return lines;
      } else line = next;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }

  /**
   * Only three widths are ever asked for - a card in the grid, a row in the search, and the animal
   * you have opened - so the browser's cache is shared instead of holding a bespoke size per card,
   * and a phone downloads a quarter of the pixels a full-size photograph would cost.
   */
  private urlOf(a: Animal, width: number): string { return photoUrl(this.base, a.p, width); }

  /** The photograph, the shimmer while it is coming, or the drawn stand-in if it never does. */
  private picture(a: Animal, x: number, y: number, w: number, h: number, radius: number, width = 320): void {
    const ctx = this.ctx;
    const g = groupById(a.g);
    const tone = g?.tone ?? '#8aa6b8';
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = shade(tone, 0.68);
    ctx.fillRect(x, y, w, h);
    const e = photo(this.urlOf(a, width));
    const done = drawCover(ctx, e, x, y, w, h, this.t);
    if (!done) {
      if (e.state === 'failed') {
        creature(ctx, a.g, x + w * 0.1, y + h * 0.14, w * 0.8, h * 0.72, tone, 0.5);
      } else {
        // a slow sheen travelling across, so waiting looks like waiting rather than broken
        const k = (this.t * 0.55 + (a.i % 97) / 97) % 1;
        const sg = ctx.createLinearGradient(x + (k - 0.4) * w, y, x + (k + 0.4) * w, y + h);
        sg.addColorStop(0, hexA(tone, 0));
        sg.addColorStop(0.5, hexA('#ffffff', 0.5));
        sg.addColorStop(1, hexA(tone, 0));
        ctx.fillStyle = sg;
        ctx.fillRect(x, y, w, h);
        creature(ctx, a.g, x + w * 0.22, y + h * 0.26, w * 0.56, h * 0.48, shade(tone, -0.1), 0.2);
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(23, 58, 79, 0.14)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
    ctx.stroke();
  }

  /** The strip along the top of every screen: where you are, and how much of the book you have seen. */
  private header(title: string, sub: string): number {
    const ctx = this.ctx;
    const u = this.u();
    const h = 62 * u;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.w, h);
    ctx.fillStyle = 'rgba(23, 58, 79, 0.1)';
    ctx.fillRect(0, h - 1, this.w, 1);
    // the round home and back buttons live in the top right corner, so the words keep away from it
    const room = this.w - 132 * Math.min(u, 1.3) - 16 * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 21);
    const line = this.wrap(title, this.font('900', 21), room, 1)[0] ?? title;
    ctx.fillText(line, 16 * u, 28 * u);
    ctx.fillStyle = SOFT;
    ctx.font = this.font('700', 12.5);
    ctx.fillText(sub, 16 * u, 46 * u);
    return h;
  }

  private collectionLine(): string {
    return T(
      `You have looked at ${this.seen.size} of the ${this.all.length} animals`,
      `Je hebt ${this.seen.size} van de ${this.all.length} dieren bekeken`);
  }

  // ---------------------------------------------------------------- loading

  private drawLoading(): void {
    const ctx = this.ctx;
    const u = this.u();
    const cy = this.h * 0.42;
    ctx.fillStyle = vGrad(ctx, 0, this.h, '#eef7fb', PAPER);
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 30);
    ctx.fillText(t('animalsTitle'), this.w / 2, cy - 60 * u);

    // the nine shelf animals walking in a ring while the file comes down
    const r = Math.min(this.w, this.h) * 0.16;
    for (let i = 0; i < GROUPS.length; i++) {
      const a = (i / GROUPS.length) * Math.PI * 2 + this.t * 0.5;
      const s = 34 * u;
      creature(ctx, GROUPS[i].id, this.w / 2 + Math.cos(a) * r - s / 2, cy + Math.sin(a) * r * 0.6 - s / 2, s, s, GROUPS[i].tone, 0.85);
    }
    ctx.fillStyle = SOFT;
    ctx.font = this.font('800', 14);
    ctx.fillText(
      this.loadState === 'failed'
        ? T('The book could not be opened.', 'Het boek kon niet worden geopend.')
        : t('animalsOpening'),
      this.w / 2, cy + 96 * u);
    if (this.loadState === 'failed') {
      ctx.font = this.font('700', 12);
      ctx.fillText(this.loadMsg, this.w / 2, cy + 116 * u);
    }
  }

  // ---------------------------------------------------------------- the shelves

  private drawShelves(): void {
    const ctx = this.ctx;
    const u = this.u();
    const pad = 14 * u;
    const top = this.header(t('animalsTitle'), this.collectionLine());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.w, this.h - top);
    ctx.clip();
    let y = top + pad - this.scroll;

    // the two things you can do without choosing a shelf first
    const bw = (this.w - pad * 3) / 2;
    const bh = 50 * u;
    this.button('search', pad, y, bw, bh, t('animalsSearch'), '#3e7fb0');
    this.button('surprise', pad * 2 + bw, y, bw, bh, t('animalsSurprise'), '#e0913a');
    y += bh + pad * 1.4;

    // the collection, as a bar rather than only a sentence
    const done = this.all.length ? this.seen.size / this.all.length : 0;
    ctx.fillStyle = 'rgba(23, 58, 79, 0.1)';
    roundRectPath(ctx, pad, y, this.w - pad * 2, 10 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = '#5da65f';
    roundRectPath(ctx, pad, y, Math.max(10 * u, (this.w - pad * 2) * done), 10 * u, 5 * u);
    ctx.fill();
    y += 24 * u;

    const cols = this.w > 700 ? (this.w > 1000 ? 4 : 3) : 2;
    const tw = (this.w - pad * (cols + 1)) / cols;
    const th = tw * 0.82;
    GROUPS.forEach((g, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = pad + col * (tw + pad);
      const ty = y + row * (th + pad);
      if (ty > this.h + th || ty < top - th * 2) {
        this.hits.push({ id: `shelf:${g.id}`, x, y: ty, w: tw, h: th });
        return;
      }
      this.shelfTile(g.id, g.tone, NL() ? g.nl : g.en, x, ty, tw, th, i);
    });
    const rows = Math.ceil(GROUPS.length / cols);
    const bottom = y + rows * (th + pad) + 74 * u;

    // who the book is made of
    ctx.textAlign = 'center';
    ctx.fillStyle = SOFT;
    ctx.font = this.font('700', 11.5);
    const credit = T(
      'Names and family trees from iNaturalist, paragraphs from Wikipedia, photographs from Wikimedia Commons, and where they live from GBIF.',
      'Namen en stambomen van iNaturalist, de tekst van Wikipedia, de foto\'s van Wikimedia Commons en waar ze leven van GBIF.');
    const lines = this.wrap(credit, this.font('700', 11.5), this.w - pad * 4);
    lines.forEach((l, i) => ctx.fillText(l, this.w / 2, bottom - 60 * u + i * 15 * u));
    ctx.restore();

    this.scrollMax = Math.max(0, bottom + this.scroll - this.h + pad);
  }

  private shelfTile(id: string, tone: string, label: string, x: number, y: number, w: number, h: number, i: number): void {
    const ctx = this.ctx;
    const u = this.u();
    const pressed = this.downId === `shelf:${id}`;
    const pop = easeOutCubic(Math.max(0, Math.min(1, this.enter * 1.6 - i * 0.06)));
    ctx.save();
    ctx.globalAlpha = pop;
    ctx.translate(x + w / 2, y + h / 2 + (1 - pop) * 14 * u);
    ctx.scale(pressed ? 0.97 : 1, pressed ? 0.97 : 1);
    ctx.translate(-w / 2, -h / 2);
    contactShadow(ctx, w / 2, h - 2 * u, w * 0.42, 7 * u, 0.2);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(tone, 0.24));
    g.addColorStop(1, tone);
    ctx.fillStyle = g;
    roundRectPath(ctx, 0, 0, w, h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, 0.7, 0.7, w - 1.4, h - 1.4, 18 * u);
    ctx.stroke();
    const cs = Math.min(w * 0.62, h * 0.56);
    creature(ctx, id, w / 2 - cs / 2, h * 0.12, cs, cs, 'rgba(255,255,255,0.92)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = this.font('900', w < 150 ? 14 : 16);
    ctx.fillText(label, w / 2, h - 20 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = this.font('800', 11.5);
    const n = this.all.reduce((k, a) => k + (a.g === id ? 1 : 0), 0);
    ctx.fillText(T(`${n} animals`, `${n} dieren`), w / 2, h - 7 * u);
    ctx.restore();
    this.hits.push({ id: `shelf:${id}`, x, y, w, h });
  }

  // ---------------------------------------------------------------- the grid

  private drawGrid(): void {
    const ctx = this.ctx;
    const u = this.u();
    const pad = 12 * u;
    const g = this.group ? groupById(this.group) : null;
    const title = g ? (NL() ? g.nl : g.en) : T('All animals', 'Alle dieren');
    const seenHere = this.list.reduce((k, a) => k + (this.seen.has(a.i) ? 1 : 0), 0);
    const top = this.header(title, T(
      `${seenHere} of ${this.list.length} looked at`,
      `${seenHere} van de ${this.list.length} bekeken`));

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.w, this.h - top);
    ctx.clip();

    const cols = Math.max(2, Math.round(this.w / (168 * Math.min(u, 1.4))));
    const cw = (this.w - pad * (cols + 1)) / cols;
    const ph = cw * 0.76;
    const ch = ph + 32 * u;
    const y0 = top + pad - this.scroll;

    const first = Math.max(0, Math.floor((this.scroll - ch) / (ch + pad)) * cols);
    const last = Math.min(this.list.length, first + cols * (Math.ceil(this.h / (ch + pad)) + 3) * 1);

    for (let i = first; i < last; i++) {
      const a = this.list[i];
      const col = i % cols, row = Math.floor(i / cols);
      const x = pad + col * (cw + pad);
      const cy = y0 + row * (ch + pad);
      this.animalCard(a, i, x, cy, cw, ph, ch);
    }
    ctx.restore();

    const rows = Math.ceil(this.list.length / cols);
    this.scrollMax = Math.max(0, top + pad + rows * (ch + pad) - this.h + pad);
    this.scrollHint(top);
  }

  private animalCard(a: Animal, i: number, x: number, y: number, w: number, ph: number, ch: number): void {
    const ctx = this.ctx;
    const u = this.u();
    const pressed = this.downId === `card:${i}`;
    ctx.save();
    if (pressed) {
      ctx.translate(x + w / 2, y + ch / 2);
      ctx.scale(0.97, 0.97);
      ctx.translate(-(x + w / 2), -(y + ch / 2));
    }
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.shadowColor = 'rgba(16, 44, 62, 0.16)';
    ctx.shadowBlur = 10 * u;
    ctx.shadowOffsetY = 3 * u;
    roundRectPath(ctx, x, y, w, ch, 14 * u);
    ctx.fill();
    ctx.restore();
    this.picture(a, x, y, w, ph, 14 * u);

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    const f = this.font('900', 13.5);
    const line = this.wrap(nameOf(a), f, w - 16 * u, 1)[0] ?? '';
    ctx.font = f;
    ctx.fillText(line, x + 8 * u, y + ph + 20 * u);
    if (this.seen.has(a.i)) {
      const r = 9 * u;
      const cx = x + w - r - 7 * u, cy = y + r + 7 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5da65f';
      ctx.lineWidth = 2.4 * Math.min(u, 1.5);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy);
      ctx.lineTo(cx - r * 0.08, cy + r * 0.36);
      ctx.lineTo(cx + r * 0.46, cy - r * 0.38);
      ctx.stroke();
    }
    ctx.restore();
    this.hits.push({ id: `card:${i}`, x, y, w, h: ch });
  }

  /** A thin bar down the right edge saying how far into a long list you are. */
  private scrollHint(top: number): void {
    if (this.scrollMax < 20) return;
    const ctx = this.ctx;
    const u = this.u();
    const track = this.h - top - 16 * u;
    const kh = Math.max(30 * u, track * (this.h / (this.h + this.scrollMax)));
    const k = Math.max(0, Math.min(1, this.scroll / this.scrollMax));
    ctx.fillStyle = 'rgba(23, 58, 79, 0.18)';
    roundRectPath(ctx, this.w - 6 * u, top + 8 * u + k * (track - kh), 3.5 * u, kh, 2 * u);
    ctx.fill();
  }

  // ---------------------------------------------------------------- one animal

  private drawDetail(): void {
    const a = this.list[this.at];
    if (!a) { this.go('shelves'); return; }
    const ctx = this.ctx;
    const u = this.u();
    const pad = 16 * u;
    const inner = this.w - pad * 2;
    const top = this.header(nameOf(a), otherName(a));

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.w, this.h - top);
    ctx.clip();
    let y = top + pad - this.scroll;

    // the photograph, as big as one thumb-width of scrolling allows
    const ph = Math.min(inner * 0.62, this.h * 0.42);
    this.picture(a, pad, y, inner, ph, 18 * u, this.w > 520 ? 960 : 640);
    // who took it
    ctx.save();
    roundRectPath(ctx, pad, y, inner, ph, 18 * u);
    ctx.clip();
    ctx.fillStyle = 'rgba(8, 24, 36, 0.52)';
    ctx.fillRect(pad, y + ph - 18 * u, inner, 18 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = this.font('700', 9.5);
    const licence = this.licences[a.l] ?? '';
    const credit = this.wrap(`${a.c} · ${licence} · Wikimedia Commons`, this.font('700', 9.5), inner - 16 * u, 1)[0] ?? '';
    ctx.fillText(credit, pad + 8 * u, y + ph - 5.5 * u);
    ctx.restore();
    y += ph + pad;

    // the names
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 26);
    for (const l of this.wrap(nameOf(a), this.font('900', 26), inner, 2)) {
      ctx.fillText(l, pad, y + 20 * u);
      y += 28 * u;
    }
    ctx.fillStyle = SOFT;
    ctx.font = this.font('800', 14);
    ctx.fillText(otherName(a), pad, y + 12 * u);
    y += 20 * u;
    ctx.font = this.font('700', 13);
    ctx.fillStyle = '#7b8f9c';
    ctx.fillText(a.s, pad, y + 12 * u);
    y += 26 * u;

    // how it is doing
    if (a.r) {
      const label = (NL() ? STATUS_NL : STATUS_EN)[a.r] ?? '';
      const tone = STATUS_TONE[a.r] ?? '#7a6b63';
      ctx.font = this.font('800', 12);
      const tw = ctx.measureText(label).width + 22 * u;
      ctx.fillStyle = hexA(tone, 0.16);
      roundRectPath(ctx, pad, y, tw, 24 * u, 12 * u);
      ctx.fill();
      ctx.fillStyle = shade(tone, -0.25);
      ctx.beginPath();
      ctx.arc(pad + 11 * u, y + 12 * u, 4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(label, pad + 19 * u, y + 16 * u);
      y += 34 * u;
    }

    y = this.sizeCard(a, pad, y, inner) + pad;
    y = this.whereCard(a, pad, y, inner) + pad;
    y = this.factsCard(a, pad, y, inner) + pad;

    // one step along the shelf, either way
    const bw = (inner - 10 * u) / 2;
    this.button('prev', pad, y, bw, 46 * u, T('◀ Before', '◀ Vorige'), this.at > 0 ? '#5c8ba8' : '#b9c7cf');
    this.button('next', pad + bw + 10 * u, y, bw, 46 * u, T('Next ▶', 'Volgende ▶'), this.at < this.list.length - 1 ? '#5c8ba8' : '#b9c7cf');
    y += 62 * u;
    this.button('surprise', pad, y, inner, 46 * u, t('animalsSurprise'), '#e0913a');
    y += 70 * u;

    ctx.restore();
    this.scrollMax = Math.max(0, y + this.scroll - this.h);
    this.scrollHint(top);
  }

  private card(x: number, y: number, w: number, h: number, title: string): number {
    const ctx = this.ctx;
    const u = this.u();
    ctx.save();
    ctx.shadowColor = 'rgba(16, 44, 62, 0.12)';
    ctx.shadowBlur = 12 * u;
    ctx.shadowOffsetY = 3 * u;
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, x, y, w, h, 16 * u);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = SOFT;
    ctx.font = this.font('900', 11);
    ctx.fillText(title.toUpperCase(), x + 14 * u, y + 20 * u);
    return y + 30 * u;
  }

  /** The animal and a child on one ruler. The reason the book is worth making. */
  private sizeCard(a: Animal, x: number, y: number, w: number): number {
    const ctx = this.ctx;
    const u = this.u();
    const h = 196 * u;
    const inner = this.card(x, y, w, h, t('animalsHowBig'));
    const childCm = save.animals.childCm;
    // the line they both stand on, with room under it for the sentence
    const floor = y + h - 48 * u;
    const childX = x + 32 * u;
    const animalX = childX + 26 * u;
    const roomW = Math.max(30 * u, x + w - 16 * u - animalX);
    const roomH = Math.max(24 * u, floor - inner - 4 * u);
    // the animal is measured along its length, the child up her height, so each has its own limit
    const bar = scaleBar(a.z || 1, childCm, roomW, roomH);
    const tone = groupById(a.g)?.tone ?? '#8aa6b8';

    child(ctx, childX, floor - bar.childPx, bar.childPx, '#9fb6c4');
    const ch = Math.min(bar.animalPx * 0.82, roomH);
    creature(ctx, a.g, animalX, floor - ch, bar.animalPx, ch, tone);

    ctx.strokeStyle = 'rgba(23, 58, 79, 0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 14 * u, floor + 1);
    ctx.lineTo(x + w - 14 * u, floor + 1);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 16);
    ctx.fillText(a.z ? sizeLabel(a.z, NL()) : T('not known', 'onbekend'), x + 14 * u, floor + 22 * u);
    ctx.fillStyle = SOFT;
    ctx.font = this.font('700', 11.5);
    const note = a.z && !a.x ? T(' (typical for its family)', ' (gemiddeld voor zijn familie)') : '';
    const blown = bar.magnified ? T(` · drawn ${bar.times}× life size`, ` · ${bar.times}× vergroot getekend`) : '';
    const line = this.wrap(`${compareToChild(a.z, childCm, NL())}${note}${blown}`, this.font('700', 11.5), w - 28 * u, 1)[0] ?? '';
    ctx.fillText(line, x + 14 * u, floor + 36 * u);

    // how tall the child on the bar is, because every child is a different size
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93a8b5';
    ctx.font = this.font('800', 11);
    ctx.fillText(`${childCm} cm`, x + w - 78 * u, inner + 12 * u);
    this.tiny('shorter', x + w - 70 * u, inner, '\u2212');
    this.tiny('taller', x + w - 38 * u, inner, '+');
    return y + h;
  }

  private tiny(id: string, x: number, y: number, label: string): void {
    const ctx = this.ctx;
    const u = this.u();
    const s = 26 * u;
    const pressed = this.downId === id;
    ctx.fillStyle = pressed ? '#cfdde6' : '#e8eef2';
    roundRectPath(ctx, x, y, s, s, 8 * u);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + s / 2, y + s / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    this.hits.push({ id, x, y, w: s, h: s });
  }

  private whereCard(a: Animal, x: number, y: number, w: number): number {
    const ctx = this.ctx;
    const u = this.u();
    const mapW = w - 28 * u;
    const mapH = mapW * 0.5;
    const h = mapH + 74 * u;
    const inner = this.card(x, y, w, h, t('animalsWhereLives'));
    worldMap(ctx, x + 14 * u, inner, mapW, mapH, a.w, groupById(a.g)?.tone ?? '#3e7fb0');
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = this.font('800', 13);
    const names = a.w.map(c => (NL() ? CONTINENT_NL : CONTINENT_EN)[c]).filter(Boolean);
    const line = names.length
      ? joinNames(names, NL())
      : T('Nobody has recorded where it lives.', 'Waar hij leeft is niet vastgelegd.');
    const lines = this.wrap(line, this.font('800', 13), mapW, 2);
    lines.forEach((l, i) => ctx.fillText(l, x + 14 * u, inner + mapH + 20 * u + i * 16 * u));
    return y + h;
  }

  private factsCard(a: Animal, x: number, y: number, w: number): number {
    const ctx = this.ctx;
    const u = this.u();
    const list = facts(a, NL(), save.animals.childCm);
    const para = this.text[String(a.i)] ?? '';
    const fFact = this.font('700', 13.5);
    const fPara = this.font('400', 13);
    const inner = w - 28 * u;
    const factLines = list.map(f => this.wrap(f, fFact, inner - 18 * u));
    const paraLines = para ? this.wrap(para, fPara, inner, 6) : [];
    const h = 34 * u
      + factLines.reduce((k, l) => k + l.length * 18 * u + 6 * u, 0)
      + (paraLines.length ? paraLines.length * 17 * u + 12 * u : 0)
      + 12 * u;
    let cy = this.card(x, y, w, h, t('animalsGoodToKnow'));
    ctx.textAlign = 'left';
    const tone = groupById(a.g)?.tone ?? '#3e7fb0';
    factLines.forEach(lines => {
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(x + 18 * u, cy + 7 * u, 3.4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = fFact;
      lines.forEach((l, i) => ctx.fillText(l, x + 30 * u, cy + 12 * u + i * 18 * u));
      cy += lines.length * 18 * u + 6 * u;
    });
    if (paraLines.length) {
      cy += 6 * u;
      ctx.fillStyle = SOFT;
      ctx.font = fPara;
      paraLines.forEach((l, i) => ctx.fillText(l, x + 14 * u, cy + 10 * u + i * 17 * u));
    }
    return y + h;
  }

  // ---------------------------------------------------------------- searching

  private drawSearch(): void {
    const ctx = this.ctx;
    const u = this.u();
    const pad = 12 * u;
    const top = this.header(t('animalsSearch'), this.collectionLine());

    // what has been typed so far
    const boxH = 44 * u;
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, pad, top + pad, this.w - pad * 2, boxH, 12 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(23, 58, 79, 0.16)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, pad + 0.7, top + pad + 0.7, this.w - pad * 2 - 1.4, boxH - 1.4, 12 * u);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = this.query ? INK : '#9fb0bb';
    ctx.font = this.font('900', 20);
    const shown = this.query || t('animalsTypeLetters');
    ctx.fillText(shown, pad + 14 * u, top + pad + boxH * 0.68);
    if (this.query && Math.floor(this.t * 2) % 2 === 0) {
      const cw = ctx.measureText(this.query).width;
      ctx.fillStyle = '#3e7fb0';
      ctx.fillRect(pad + 16 * u + cw, top + pad + 11 * u, 2.4 * u, boxH - 22 * u);
    }

    // the keyboard, at the bottom where a thumb is
    const rows = this.w > 620 ? [9, 9, 8] : [7, 7, 7, 5];
    const keyH = Math.min(46 * u, (this.h * 0.36) / rows.length - 6 * u);
    const kbH = rows.length * (keyH + 6 * u) + 8 * u;
    const kbTop = this.h - kbH;
    let k = 0;
    rows.forEach((n, r) => {
      const kw = (this.w - pad * 2 - (n - 1) * 5 * u) / n;
      const last = r === rows.length - 1;
      const count = last ? Math.min(n, KEYS.length - k) : n;
      for (let c = 0; c < count; c++, k++) {
        this.key(`key:${KEYS[k]}`, pad + c * (kw + 5 * u), kbTop + r * (keyH + 6 * u), kw, keyH, KEYS[k].toUpperCase(), '#ffffff', INK);
      }
      if (last) {
        const left = n - count;
        if (left > 0) {
          const kx = pad + count * (kw + 5 * u);
          this.key('key:del', kx, kbTop + r * (keyH + 6 * u), kw * left + (left - 1) * 5 * u, keyH, '⌫', '#d9e4ea', INK);
        }
      }
    });
    if (KEYS.length % rows[rows.length - 1] === 0) {
      // every row was full, so the backspace gets a row of its own along the bottom
      this.key('key:del', pad, kbTop + rows.length * (keyH + 6 * u), this.w - pad * 2, keyH * 0.8, '⌫', '#d9e4ea', INK);
    }

    // the answers in between
    const listTop = top + pad * 2 + boxH;
    const listH = kbTop - listTop - pad;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, this.w, Math.max(0, listH));
    ctx.clip();
    const rowH = 54 * u;
    if (!this.query) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9fb0bb';
      ctx.font = this.font('800', 13.5);
      ctx.fillText(T('Any animal, in Dutch, English or Latin.', 'Elk dier, in het Nederlands, Engels of Latijn.'), this.w / 2, listTop + 34 * u);
    } else if (!this.list.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9fb0bb';
      ctx.font = this.font('800', 13.5);
      ctx.fillText(t('animalsNotFound'), this.w / 2, listTop + 34 * u);
    }
    const y0 = listTop - this.scroll;
    for (let i = 0; i < this.list.length; i++) {
      const ry = y0 + i * (rowH + 6 * u);
      if (ry > listTop + listH || ry + rowH < listTop) continue;
      this.resultRow(this.list[i], i, pad, ry, this.w - pad * 2, rowH);
    }
    ctx.restore();
    this.scrollMax = Math.max(0, this.list.length * (rowH + 6 * u) - Math.max(0, listH));
  }

  private key(id: string, x: number, y: number, w: number, h: number, label: string, tone: string, ink: string): void {
    const ctx = this.ctx;
    const pressed = this.downId === id;
    const r = chunkyButton(ctx, x, y, w, h, { tone, pressed, radius: h * 0.28 });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', Math.min(17, h * 0.42 / this.u()));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + w / 2, r.y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    this.hits.push({ id, x, y, w, h: h * 1.12 });
  }

  private resultRow(a: Animal, i: number, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const u = this.u();
    const pressed = this.downId === `card:${i}`;
    ctx.fillStyle = pressed ? '#e6eef3' : '#ffffff';
    roundRectPath(ctx, x, y, w, h, 12 * u);
    ctx.fill();
    this.picture(a, x + 5 * u, y + 5 * u, h - 10 * u, h - 10 * u, 9 * u, 160);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = this.font('900', 15);
    const tx = x + h + 4 * u;
    ctx.fillText(this.wrap(nameOf(a), this.font('900', 15), w - h - 20 * u, 1)[0] ?? '', tx, y + h * 0.45);
    ctx.fillStyle = SOFT;
    ctx.font = this.font('700', 11.5);
    ctx.fillText(this.wrap(`${otherName(a)} · ${a.s}`, this.font('700', 11.5), w - h - 20 * u, 1)[0] ?? '', tx, y + h * 0.75);
    this.hits.push({ id: `card:${i}`, x, y, w, h });
  }
}

