/**
 * Dino Dig - the excavation game in Bramblewood.
 *
 * You are given a slab of rock with a real fossil inside it and a bag of tools. The rock is not
 * uniform: soft sand comes away under a brush, packed clay needs a chisel, and stone only yields
 * to a hammer. The hammer is also the thing that breaks bone. You cannot see the bone until you
 * are almost through to it, so every stroke near something promising is a judgement: go faster and
 * risk the specimen, or go carefully and spend the daylight you have left.
 *
 * When the rock is off you name the animal, and it takes its place in your museum, on a timeline
 * that fills up as you go.
 *
 * Everything is drawn with canvas paths over real public domain photographs, and every sound is
 * synthesised. No advertising, no tracking.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { makeRng, ValueNoise } from '../../util/rng';
import { uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { bodyPath, bones, drawCrest } from './anatomy';
import { DINOS, ERAS, type Dino } from './dinos';
import { dig } from './digsfx';
import { drawFossil, fossilPhoto, FOSSILS, loadAllFossils } from './fossilphoto';
import { buildSite, MAX_DEPTH, progress, starsFor, strike, TOOLS, toolById, type Site, type Tool } from './site';

type Ctx = CanvasRenderingContext2D;
type Phase = 'dig' | 'ask' | 'wrong' | 'reveal' | 'failed' | 'museum';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (d: Dino): string => (NL() ? d.nameNl : d.name);
const factOf = (d: Dino): string => (NL() ? d.factNl : d.fact);
const eraName = (d: Dino): string => (NL() ? ERAS[d.era].nameNl : ERAS[d.era].name);

/** Sites come in the order a digger would grow into them: soft rock first. */
const SITES: Dino[] = [...DINOS].sort((a, b) => a.hardness - b.hardness);

const saveKey = (d: Dino): string => `dig:${d.id}`;
const foundCount = (): number => SITES.filter(d => levelProgress(saveKey(d)).completed).length;

interface Hit { id: string; x: number; y: number; w: number; h: number }

export class DinoDig {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private t = 0;
  private raf = 0;

  private siteIndex = 0;
  private phase: Phase = 'dig';
  private phaseT = 0;
  private dino: Dino = SITES[0];
  private site: Site | null = null;
  private options: Dino[] = [];
  private tool: Tool = TOOLS[0];
  private stamina = 1;
  private digging = false;
  private lastCell = { x: -99, y: -99 };
  private wrongId: string | null = null;
  private shake = 0;
  private note = '';
  private noteT = 0;
  private earned = 0;
  private hits: Hit[] = [];
  private rng = makeRng(1);
  private grain = new ValueNoise(3);

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', () => { this.digging = false; });
    canvas.addEventListener('pointercancel', () => { this.digging = false; });
    this.startSite(this.firstUnfinished());
    // the bone mask is read out of the photograph, so the site is laid again once it has loaded
    void loadAllFossils(DINOS.map(d => d.id)).then(() => { if (this.phase === 'dig') this.startSite(this.siteIndex); });
    (window as unknown as { __dig?: DinoDig }).__dig = this;
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

  debugState(): Record<string, unknown> {
    const p = this.site ? progress(this.site) : { exposed: 0, chipped: 0 };
    return {
      phase: this.phase, site: this.siteIndex, answer: this.dino.id, tool: this.tool.id,
      stamina: Math.round(this.stamina * 100) / 100,
      exposed: Math.round(p.exposed * 100) / 100, chipped: p.chipped,
      boneCount: this.site?.boneCount ?? 0,
      options: this.options.map(o => o.id),
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
      found: foundCount(),
    };
  }

  /** Test hook: take the rock off without playing, to reach the later phases. */
  debugClear(): void { if (this.site) this.site.depth.fill(0); }

  // ---------- layout ----------

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** The slab of rock: landscape, because a dinosaur is a wide animal. */
  private slab(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const top = 132 * u;
    const bottom = this.h - (this.phase === 'dig' ? 96 * u : 212 * u);
    const band = Math.max(140, bottom - top);
    const w = this.w - 20 * u;
    // fill the room that is there, but never so tall that the slab stops reading as a slab
    const h = clamp(band, w / 2.4, w * 1.3);
    return { x: (this.w - w) / 2, y: top + Math.max(0, (band - h) / 2), w, h };
  }

  private cell(): number { return this.slab().w / (this.site?.cols ?? 30); }

  // ---------- sites ----------

  private firstUnfinished(): number {
    const i = SITES.findIndex(d => !levelProgress(saveKey(d)).completed);
    return i === -1 ? 0 : i;
  }

  private startSite(i: number): void {
    this.siteIndex = ((i % SITES.length) + SITES.length) % SITES.length;
    this.dino = SITES[this.siteIndex];
    const slab = this.slab();
    const cols = 28, rows = Math.max(12, Math.round(cols * (slab.h / slab.w)));
    this.site = buildSite(cols, rows, this.dino.id.length * 977 + this.siteIndex * 13,
      this.dino.hardness, fossilPhoto(this.dino.id) ?? null);
    this.rng = makeRng(this.siteIndex * 4099 + 11);
    this.grain = new ValueNoise(this.siteIndex * 7 + 5);
    this.stamina = 1;
    this.wrongId = null;
    this.earned = 0;
    this.tool = TOOLS[0];
    const rng = makeRng(500 + this.siteIndex * 31);
    const others = SITES.filter(d => d.id !== this.dino.id).sort(() => rng() - 0.5).slice(0, 2);
    this.options = [this.dino, ...others]
      .sort((a, b) => ((a.id.charCodeAt(0) + this.siteIndex) % 7) - ((b.id.charCodeAt(0) + this.siteIndex) % 7));
    this.phase = 'dig'; this.phaseT = 0;
    this.say(T('Start gently. Soft rock comes away with a brush.',
      'Begin rustig. Zacht gesteente gaat er met een kwast af.'));
  }

  private say(text: string): void { this.note = text; this.noteT = 4; }

  private unlocked(t: Tool): boolean { return foundCount() >= t.unlockAt; }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.phase === 'wrong' && this.phaseT > 0.8) { this.wrongId = null; this.phase = 'ask'; }
    if (this.phase === 'dig' && this.site) {
      const p = progress(this.site);
      if (this.stamina <= 0) {
        this.phase = p.exposed >= 0.55 ? 'ask' : 'failed';
        this.phaseT = 0;
        if (this.phase === 'failed') dig.tired();
      } else if (p.exposed >= 0.985) {
        this.phase = 'ask'; this.phaseT = 0; dig.complete();
      }
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
    if (hit) { this.onHit(hit); return; }
    if (this.phase !== 'dig') return;
    this.digging = true;
    this.lastCell = { x: -99, y: -99 };
    this.stroke(p);
  }

  private onMove(e: PointerEvent): void {
    if (!this.digging || this.phase !== 'dig') return;
    this.stroke(this.at(e));
  }

  private onHit(id: string): void {
    if (id.startsWith('tool:')) {
      const t = toolById(id.slice(5));
      if (!this.unlocked(t)) {
        dig.wrong();
        this.say(T('Find ' + t.unlockAt + ' fossils first.', 'Vind eerst ' + t.unlockAt + ' fossielen.'));
        return;
      }
      this.tool = t; dig.tap();
      return;
    }
    if (id === 'museum') { this.phase = this.phase === 'museum' ? 'dig' : 'museum'; this.phaseT = 0; dig.tap(); return; }
    if (id === 'retry') { this.startSite(this.siteIndex); dig.tap(); return; }
    if (id === 'next') { this.startSite(this.siteIndex + 1); dig.tap(); return; }
    if (this.phase !== 'ask') return;
    if (id === this.dino.id) {
      const p = progress(this.site!);
      const stars = starsFor(p.exposed, p.chipped, this.site!.boneCount);
      this.earned = stars;
      recordLevelResult(saveKey(this.dino), Math.round(p.exposed * 100), stars, true);
      save.coins = Math.max(0, Math.round(save.coins + 20 + stars * 15)); persist();
      this.phase = 'reveal'; this.phaseT = 0;
      dig.correct();
    } else {
      this.wrongId = id;
      this.phase = 'wrong'; this.phaseT = 0;
      this.shake = 1;
      dig.wrong();
    }
  }

  /** A tool touching the rock. */
  private stroke(p: Vec): void {
    if (!this.site) return;
    const slab = this.slab(), c = this.cell();
    const cx = (p.x - slab.x) / c, cy = (p.y - slab.y) / c;
    if (cx < -2 || cy < -2 || cx > this.site.cols + 2 || cy > this.site.rows + 2) return;
    // one stroke per cell, so a slow drag is not punished and a fast one is not rewarded
    if (Math.abs(cx - this.lastCell.x) < 0.5 && Math.abs(cy - this.lastCell.y) < 0.5) return;
    this.lastCell = { x: cx, y: cy };

    const r = strike(this.site, this.tool, cx, cy, this.rng);
    if (r.removed === 0) {
      if (r.blocked && this.noteT <= 0) {
        this.say(T('That rock is too hard for this tool.', 'Dat gesteente is te hard voor dit gereedschap.'));
        dig.tap();
      }
      return;
    }
    this.stamina = Math.max(0, this.stamina - this.tool.cost);
    if (this.tool.id === 'brush') dig.brush();
    else if (this.tool.id === 'chisel') dig.chisel();
    else if (this.tool.id === 'hammer') dig.hammer();
    else dig.scribe();
    if (r.chipped) {
      dig.crack(); this.shake = 0.7;
      this.say(T('You broke a piece off. Something gentler here.',
        'Je hebt er een stuk afgeslagen. Iets zachters hier.'));
    } else if (r.uncovered) dig.uncover();
  }

  // ---------- drawing ----------

  private font(weight: string, size: number): string {
    return String(weight) + ' ' + Math.round(size * this.u()) + 'px Nunito, system-ui, sans-serif';
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#f2e3c8'); g.addColorStop(0.5, '#e2cda8'); g.addColorStop(1, '#c9ad83');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];

    if (this.phase === 'museum') { this.drawMuseum(); return; }

    const slab = this.slab();
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.t * 44) * this.shake * 5, 0);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(slab.x, slab.y, slab.w, slab.h, 16 * this.u()); ctx.clip();

    ctx.fillStyle = '#6b5f52'; ctx.fillRect(slab.x, slab.y, slab.w, slab.h);
    const photo = fossilPhoto(this.dino.id);
    if (photo) {
      drawFossil(ctx, photo, slab);
      const vg = ctx.createRadialGradient(slab.x + slab.w / 2, slab.y + slab.h / 2, slab.h * 0.3,
        slab.x + slab.w / 2, slab.y + slab.h / 2, slab.h * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,10,0.45)');
      ctx.fillStyle = vg; ctx.fillRect(slab.x, slab.y, slab.w, slab.h);
    }
    this.drawChips(slab);
    if (this.phase === 'reveal') this.drawLiving(ctx, slab);
    this.drawRock(slab);
    ctx.restore();

    ctx.strokeStyle = 'rgba(80,60,40,0.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(slab.x, slab.y, slab.w, slab.h, 16 * this.u()); ctx.stroke();
    ctx.restore();

    this.drawChrome(slab);
  }

  /** The rock still lying on the fossil, one lump per cell, coloured by how hard it is. */
  private drawRock(slab: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx, s = this.site;
    if (!s) return;
    const c = this.cell();
    for (let gy = 0; gy < s.rows; gy++) {
      for (let gx = 0; gx < s.cols; gx++) {
        const i = gy * s.cols + gx;
        const d = s.depth[i];
        if (d === 0) continue;
        const x = slab.x + gx * c, y = slab.y + gy * c;
        const hard = s.hard[i];
        // soft rock is sandy and warm, hard rock is grey and cold
        const warm = 1 - hard;
        const base = 116 + warm * 70 + this.grain.noise2(gx * 0.7, gy * 0.7) * 16;
        const rr = Math.round(base * (0.86 + warm * 0.22));
        const gg = Math.round(base * (0.8 + warm * 0.2));
        const bb = Math.round(base * (0.66 + warm * 0.18));
        ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
        ctx.globalAlpha = d >= MAX_DEPTH ? 1 : 0.72;
        ctx.beginPath(); ctx.roundRect(x - 0.6, y - 0.6, c + 1.2, c + 1.2, c * 0.22); ctx.fill();
        ctx.globalAlpha = (d === 1 ? 0.5 : 0.85) * (0.12 + hard * 0.22);
        ctx.fillStyle = '#4d4034';
        ctx.beginPath(); ctx.arc(x + c * 0.36, y + c * 0.42, c * 0.15, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + c * 0.7, y + c * 0.68, c * 0.1, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Where the specimen has been damaged: a scar you cannot undo. */
  private drawChips(slab: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx, s = this.site;
    if (!s) return;
    const c = this.cell();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,140,128,0.9)';
    ctx.lineWidth = Math.max(1, c * 0.2);
    ctx.lineCap = 'round';
    for (let i = 0; i < s.chip.length; i++) {
      if (!s.chip[i]) continue;
      const gx = i % s.cols, gy = Math.floor(i / s.cols);
      const x = slab.x + gx * c, y = slab.y + gy * c;
      ctx.beginPath();
      ctx.moveTo(x + c * 0.2, y + c * 0.25); ctx.lineTo(x + c * 0.78, y + c * 0.72);
      ctx.moveTo(x + c * 0.74, y + c * 0.24); ctx.lineTo(x + c * 0.26, y + c * 0.76);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The animal itself, growing over its own bones once you have named it. */
  private drawLiving(ctx: Ctx, slab: { x: number; y: number; w: number; h: number }): void {
    const d = this.dino;
    const k = clamp(this.phaseT / 1.0, 0, 1);
    const grow = 1 - Math.pow(1 - k, 3);
    const cx = slab.x + slab.w / 2, cy = slab.y + slab.h * 0.6;
    ctx.save();
    ctx.globalAlpha = grow * 0.88;
    ctx.translate(cx, cy);
    ctx.scale(0.6 + 0.4 * grow, 0.6 + 0.4 * grow);
    ctx.translate(-cx, -cy);
    bodyPath(ctx, d, slab);
    const g = ctx.createLinearGradient(0, slab.y, 0, slab.y + slab.h);
    g.addColorStop(0, d.skin); g.addColorStop(1, d.belly);
    ctx.fillStyle = g; ctx.fill('nonzero');
    ctx.strokeStyle = 'rgba(38,28,18,0.4)'; ctx.lineWidth = Math.max(1.4, slab.w * 0.004);
    ctx.stroke();
    if (d.crest) drawCrest(ctx, d, slab, d.skin, 'rgba(38,28,18,0.4)');
    const b = bones(d, slab);
    ctx.fillStyle = '#1d150c';
    ctx.beginPath();
    ctx.arc(b.skull.at.x - b.skull.len * 0.34, b.skull.at.y - b.skull.depth * 0.14, Math.max(2, slab.w * 0.006), 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- interface ----------

  private drawChrome(slab: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx, u = this.u();
    const p = this.site ? progress(this.site) : { exposed: 0, chipped: 0 };
    ctx.textAlign = 'center';

    const head =
      this.phase === 'dig' ? T('Get the rock off', 'Haal het gesteente eraf') :
      this.phase === 'ask' ? T('Which one is this?', 'Welke is dit?') :
      this.phase === 'wrong' ? T('Look again', 'Kijk nog eens') :
      this.phase === 'failed' ? T('The light went', 'Het licht was op') :
      nameOf(this.dino);
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('900', 21);
    ctx.fillText(head, this.w / 2, 66 * u, this.w - 230 * u > 120 * u ? this.w - 230 * u : this.w - 40 * u);

    if (this.phase === 'dig') this.drawMeters(p.exposed, p.chipped);
    if (this.phase === 'reveal') this.drawCard();
    if (this.phase === 'failed') {
      ctx.fillStyle = 'rgba(74,56,35,0.7)'; ctx.font = this.font('700', 12.5);
      ctx.fillText(T('Too much is still buried. Spend the brush where the rock is soft.',
        'Er zit nog te veel onder. Gebruik de kwast waar het gesteente zacht is.'),
        this.w / 2, 88 * u, this.w - 36 * u);
      this.button('retry', T('Dig again', 'Opnieuw graven'), this.w / 2, slab.y + slab.h + 46 * u, 210 * u, 48 * u, true);
    }

    if (this.noteT > 0 && this.phase === 'dig') {
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(74,56,35,0.62)'; ctx.font = this.font('700', 11.5);
      ctx.fillText(this.note, this.w / 2, 118 * u, this.w - 30 * u);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'ask' || this.phase === 'wrong') {
      const bw = Math.min(360 * u, this.w - 40 * u), bh = 46 * u;
      const y0 = slab.y + slab.h + 14 * u;
      this.options.forEach((o, i) => {
        const bad = this.wrongId === o.id;
        this.button(o.id, nameOf(o), this.w / 2, y0 + i * (bh + 8 * u) + bh / 2, bw, bh, !bad, bad);
      });
    }
    if (this.phase === 'reveal') {
      this.button('next', T('Next site', 'Volgende vindplaats'), this.w / 2, this.h - 36 * u, 220 * u, 46 * u, true);
    }
    if (this.phase === 'dig') this.drawTools();

    const mw = 86 * u, mh = 30 * u;
    this.button('museum', T('Museum', 'Museum'), 12 * u + mw / 2, 12 * u + mh / 2, mw, mh, false);
    ctx.textAlign = 'left';
  }

  private button(id: string, label: string, cx: number, cy: number, w: number, h: number, strong: boolean, bad = false): void {
    const ctx = this.ctx;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = bad ? 'rgba(200,90,80,0.92)' : strong ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.62)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,40,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = bad ? '#fff' : '#4a3823';
    ctx.font = this.font('800', h > 40 * this.u() ? 15 : 11.5);
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + h * 0.16, w - 20);
    this.hits.push({ id, x, y, w, h });
  }

  /** How much is out, how much is broken, and how much daylight is left. */
  private drawMeters(exposed: number, chipped: number): void {
    const ctx = this.ctx, u = this.u();
    const y = 96 * u, bw = Math.min(150 * u, this.w * 0.34), bh = 8 * u;
    const bars: Array<[number, string, string, number]> = [
      [exposed, T('uncovered', 'vrijgelegd'), '#6b8f4e', this.w / 2 - bw - 8 * u],
      [this.stamina, T('daylight', 'daglicht'), '#c9903f', this.w / 2 + 8 * u],
    ];
    ctx.textAlign = 'left';
    for (const [v, label, color, x] of bars) {
      ctx.fillStyle = 'rgba(74,56,35,0.18)';
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(bh, bw * clamp(v, 0, 1)), bh, bh / 2); ctx.fill();
      ctx.fillStyle = 'rgba(74,56,35,0.62)'; ctx.font = this.font('800', 9);
      ctx.fillText(label + ' ' + Math.round(v * 100) + '%', x, y - 5 * u);
    }
    if (chipped > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#b4543f'; ctx.font = this.font('800', 9.5);
      ctx.fillText(chipped + ' ' + T('broken', 'gebroken'), this.w / 2 + bw + 8 * u, y - 5 * u);
    }
    ctx.textAlign = 'center';
  }

  /** The tool belt. Locked tools show how many finds they cost. */
  private drawTools(): void {
    const ctx = this.ctx, u = this.u();
    const n = TOOLS.length;
    const bw = Math.min(84 * u, (this.w - 24 * u) / n - 6 * u), bh = 54 * u;
    const gap = 6 * u;
    const total = n * bw + (n - 1) * gap;
    let x = (this.w - total) / 2;
    const y = this.h - bh - 26 * u;
    for (const t of TOOLS) {
      const open = this.unlocked(t);
      const on = this.tool.id === t.id;
      ctx.fillStyle = on ? 'rgba(107,143,78,0.92)' : open ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.32)';
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 14 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,40,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      drawToolGlyph(ctx, t.id, x + bw / 2, y + 19 * u, 11 * u, on ? '#fff' : open ? '#4a3823' : 'rgba(74,56,35,0.4)');
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? '#fff' : open ? '#4a3823' : 'rgba(74,56,35,0.45)';
      ctx.font = this.font('800', 9.5);
      ctx.fillText(NL() ? t.nameNl : t.name, x + bw / 2, y + 42 * u, bw - 8 * u);
      if (!open) {
        ctx.fillStyle = 'rgba(74,56,35,0.55)'; ctx.font = this.font('800', 8);
        ctx.fillText(T('after ' + t.unlockAt, 'na ' + t.unlockAt), x + bw / 2, y + 51 * u);
      }
      this.hits.push({ id: 'tool:' + t.id, x, y, w: bw, h: bh });
      x += bw + gap;
    }
  }

  /** After a correct answer: the era, the size next to a person, and the one true thing. */
  private drawCard(): void {
    const ctx = this.ctx, u = this.u();
    const d = this.dino;
    const y = this.h - 134 * u;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(74,56,35,0.78)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(factOf(d), this.w / 2, 88 * u, this.w - 36 * u);

    const era = ERAS[d.era];
    const label = eraName(d) + ' · ' + d.maFrom + '–' + d.maTo + ' ' + T('million years ago', 'miljoen jaar geleden');
    ctx.font = this.font('800', 11);
    const pw = ctx.measureText(label).width + 26 * u, ph = 24 * u;
    ctx.fillStyle = era.color;
    ctx.beginPath(); ctx.roundRect(this.w / 2 - pw / 2, y - ph, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, this.w / 2, y - ph * 0.3);

    // size against a person
    const scaleY = y + 44 * u;
    const left = 26 * u;
    const maxLen = this.w - left * 2 - 24 * u;
    const metresShown = Math.max(d.lengthM, 2.4);
    const pxPerM = maxLen / metresShown;
    drawHuman(ctx, left, scaleY, Math.min(1.7 * pxPerM, 42 * u), 'rgba(74,56,35,0.5)');
    ctx.strokeStyle = 'rgba(74,56,35,0.5)'; ctx.lineWidth = 2;
    const bx = left + 18 * u;
    ctx.beginPath(); ctx.moveTo(bx, scaleY + 5 * u); ctx.lineTo(bx + d.lengthM * pxPerM, scaleY + 5 * u); ctx.stroke();
    for (const ex of [0, d.lengthM * pxPerM]) {
      ctx.beginPath(); ctx.moveTo(bx + ex, scaleY - 2 * u); ctx.lineTo(bx + ex, scaleY + 12 * u); ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('800', 11);
    ctx.fillText(d.lengthM + ' m', bx + 6 * u, scaleY - 7 * u);

    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      drawStar(ctx, this.w / 2 + (i - 1) * 24 * u, y + 76 * u, 9 * u, i < this.earned ? '#e8b437' : 'rgba(74,56,35,0.22)');
    }
  }

  /** Everything you have dug up, on the timeline it belongs to. */
  private drawMuseum(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a3823'; ctx.font = this.font('900', 22);
    ctx.fillText(T('Your museum', 'Jouw museum'), this.w / 2, 62 * u);
    const found = SITES.filter(d => levelProgress(saveKey(d)).completed);
    ctx.fillStyle = 'rgba(74,56,35,0.62)'; ctx.font = this.font('700', 12.5);
    ctx.fillText(found.length + ' / ' + SITES.length + ' ' + T('found', 'gevonden'), this.w / 2, 84 * u);

    const x0 = 24 * u, x1 = this.w - 24 * u, y = 118 * u, hgt = 22 * u;
    const from = 252, to = 66;
    const px = (ma: number): number => x0 + ((from - ma) / (from - to)) * (x1 - x0);
    for (const key of ['triassic', 'jurassic', 'cretaceous'] as const) {
      const e = ERAS[key];
      const a = px(e.from), b = px(e.to);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.roundRect(a, y, Math.max(4, b - a - 2), hgt, 5 * u); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.font = this.font('800', 9.5);
      ctx.fillText(NL() ? e.nameNl : e.name, (a + b) / 2, y + hgt * 0.68, Math.max(20, b - a - 8 * u));
    }
    ctx.fillStyle = 'rgba(74,56,35,0.5)'; ctx.font = this.font('700', 9);
    ctx.textAlign = 'left'; ctx.fillText(String(from), x0, y + hgt + 12 * u);
    ctx.textAlign = 'right';
    ctx.fillText(to + ' ' + T('million years ago', 'mln jaar geleden'), x1, y + hgt + 12 * u);

    ctx.textAlign = 'center';
    const rows: number[] = [];
    const ry = y + hgt + 30 * u;
    for (const d of SITES) {
      const got = levelProgress(saveKey(d)).completed;
      const mx = px((d.maFrom + d.maTo) / 2);
      let row = 0;
      while (rows[row] !== undefined && mx - rows[row] < 78 * u) row++;
      rows[row] = mx;
      const my = ry + row * 30 * u;
      ctx.strokeStyle = 'rgba(74,56,35,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, y + hgt); ctx.lineTo(mx, my - 5 * u); ctx.stroke();
      ctx.fillStyle = got ? ERAS[d.era].color : 'rgba(74,56,35,0.18)';
      ctx.beginPath(); ctx.arc(mx, my, 4.5 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = got ? '#4a3823' : 'rgba(74,56,35,0.35)';
      ctx.font = this.font('800', 9.5);
      ctx.fillText(got ? nameOf(d) : '???', mx, my + 15 * u, 86 * u);
      if (got) {
        const st = levelProgress(saveKey(d)).stars;
        for (let i = 0; i < 3; i++) {
          drawStar(ctx, mx + (i - 1) * 8 * u, my + 25 * u, 3 * u, i < st ? '#e8b437' : 'rgba(74,56,35,0.18)');
        }
      }
    }

    this.button('museum', T('Back to the dig', 'Terug naar de opgraving'), this.w / 2, this.h - 40 * u, 230 * u, 46 * u, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(74,56,35,0.45)'; ctx.font = this.font('700', 8.5);
    const lines = [...new Set(Object.values(FOSSILS).map(f => f.credit))];
    ctx.fillText(T('Fossil photographs:', 'Fossielfoto’s:'), this.w / 2, this.h - 90 * u);
    lines.slice(0, 3).forEach((c, i) => ctx.fillText(c, this.w / 2, this.h - 78 * u + i * 10 * u, this.w - 24 * u));
    ctx.textAlign = 'left';
  }
}

// ---------- small bespoke drawings ----------

function drawToolGlyph(ctx: Ctx, id: string, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (id === 'brush') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.7); ctx.lineTo(r * 0.25, -r * 0.3); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.45); ctx.lineTo(r * 0.75, -r * 0.9); ctx.lineTo(r * 0.95, -r * 0.35);
    ctx.lineTo(r * 0.4, -r * 0.05); ctx.closePath(); ctx.fill();
  } else if (id === 'chisel') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.9); ctx.lineTo(r * 0.3, -r * 0.9); ctx.lineTo(r * 0.16, r * 0.55);
    ctx.lineTo(0, r * 0.95); ctx.lineTo(-r * 0.16, r * 0.55); ctx.closePath(); ctx.fill();
  } else if (id === 'hammer') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(0, r * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-r * 0.9, -r * 0.95, r * 1.8, r * 0.62, r * 0.18); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.7); ctx.lineTo(r * 0.5, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.72, r * 0.3, 0, TAU); ctx.fill();
    ctx.lineWidth = r * 0.12;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.72, r * (0.3 + i * 0.28), -0.9, 0.9); ctx.stroke();
    }
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

/** A person, for scale. Deliberately plain: this is a ruler, not a character. */
function drawHuman(ctx: Ctx, x: number, baseY: number, h: number, color: string): void {
  const w = h * 0.3;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + w * 0.5, baseY - h * 0.88, h * 0.1, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, baseY - h * 0.78);
  ctx.lineTo(x + w * 0.9, baseY - h * 0.46);
  ctx.lineTo(x + w * 0.72, baseY - h * 0.44);
  ctx.lineTo(x + w * 0.68, baseY - h * 0.02);
  ctx.lineTo(x + w * 0.54, baseY);
  ctx.lineTo(x + w * 0.5, baseY - h * 0.3);
  ctx.lineTo(x + w * 0.46, baseY);
  ctx.lineTo(x + w * 0.32, baseY - h * 0.02);
  ctx.lineTo(x + w * 0.28, baseY - h * 0.44);
  ctx.lineTo(x + w * 0.1, baseY - h * 0.46);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
