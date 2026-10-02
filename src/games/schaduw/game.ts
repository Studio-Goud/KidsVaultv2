/**
 * Schaduwspel - the shadow game in Suri.
 *
 * A dim room: a lamp on the left, a wall on the right, a thing on a turntable between them. On the
 * wall is a shape - the shadow the thing would make from some other side. The child drags to turn
 * it (and, from the third level, to tip it) until its own shadow, drawn live by projecting the model
 * from the lamp, lies on the shape. Then it clicks, Suri says what it is, and the next thing comes.
 *
 * It practises seeing a shape from its outline and turning a thing in the mind. Nothing can be
 * wrong and nothing is timed on screen: after HINT_AFTER seconds an arrow shows which way to turn.
 * Eight things a level (five for the youngest), three levels, and then it ends. The rules are in
 * model.ts, the drawing in paint.ts.
 */

import { clamp, TAU } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, recordLevelResult } from '../../util/storage';
import {
  angleDiff, CLEAN_BELOW, DWELL, hintDirection, hintsAfter, LEVELS, LINE_INSTRUCTION, LINE_YES, makeRound, matchScore, objectById,
  objectsFor, PITCH_MAX, project, rngFor, SIMPLE_LEVEL, starsFor, type Level, type ObjectModel, type Round, type Shadow, type Way,
} from './model';
import { schaduwSfx as sfx } from './schaduwsfx';
import {
  bleedEdges, chunkyButton, drawStar as drawStarGem, easeOutBack, easeOutCubic, glassPanel, handCursor, heading, outlinedText, Particles,
} from '../../render/look';
import { CAM, drawArrow, drawBeam, drawLamp, drawObject, drawRoom, drawShadow, drawTarget, drawTurntable, drawWall, type Panel } from './paint';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';
import { simpleNow } from '../../platform/who';

type Ctx = CanvasRenderingContext2D;
type Phase = 'levels' | 'play' | 'won';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const lineOf = (l: Level): string => (NL() ? l.lineNl : l.line);
const saveKey = (l: Level): string => `schaduw:${l.id}`;
const instruction = (): string => (NL() ? LINE_INSTRUCTION.nl : LINE_INSTRUCTION.en);

/** seconds from the fit to the next thing: the click, "Ja, zo past hij.", the name, a breath */
const SOLVED_HOLD = 3.0;
/** when the name is said, after the yes (the voice cuts off a line that is still going) */
const NAME_AT = 1.5;
/** radians turned per pixel dragged is this over the size of the object on screen: one swipe across it is about a half turn */
const TURN_PER_OBJECT = 1.25;
const NOTCH = 0.35;

const SAMPLE_FOR_CARD = ['teapot', 'duck', 'bicycle'];

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Layout {
  portrait: boolean;
  panel: Panel;
  lampX: number; lampS: number; lampY: number;
  objX: number; objY: number; k: number;
  tableY: number; tableRx: number;
  floorY: number;
}

export class Schaduw {
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
  private phaseT = 0;
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private attempt = 0;
  private order: string[] = [];
  private index = 0;
  private round: Round = { id: 'teapot', yaw0: 0, pitch0: 0, yawT: 0, pitchT: 0, threshold: 0.84 };
  private model: ObjectModel = objectById('teapot');
  private yaw = 0;
  private pitch = 0;
  private shadow: Shadow = [];
  private targetShadow: Shadow = [];
  private dirty = true;
  private score = 0;
  private dwell = 0;
  private objT = 0;
  private hints = 0;
  private clean = 0;
  private solved = false;
  private solvedT = 0;
  private snapYaw = 0;
  private snapPitch = 0;
  private nameSaid = false;
  private appear = 1;
  private touched = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private notch = 0;
  private earned = 0;
  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private cardPop = 0;
  private note = '';
  private noteT = 0;
  /**
   * The simplest shape, for a child of two or three (src/platform/who.ts): five things, only
   * turning, a lower bar for "fits", no stars and nothing written to the save. It is the same
   * gesture as the real game; the rest is taken away. It is not in the catalog's age range, but a
   * toddler who is handed the phone gets something that works.
   */
  private easy = simpleNow();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __schaduw?: Schaduw }).__schaduw = this;
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

  canBack(): boolean { return this.phase !== 'levels' && !this.easy; }
  back(): void { if (this.easy) return; this.phase = 'levels'; this.cardPop = 0; this.dragging = false; }

  /** The last thing the game said, so the guide in the corner can say it again. */
  spoken(): string { return this.note || instruction(); }

  private say(text: string, secs = 3): void {
    this.note = text;
    this.noteT = secs;
    speakLine(text);
  }

  debugState(): Record<string, unknown> {
    const lay = this.layout();
    return {
      phase: this.phase, level: this.level.id, easy: this.easy, index: this.index, count: this.order.length || this.level.count,
      object: this.round.id, yaw: this.yaw, pitch: this.pitch, targetYaw: this.round.yawT, targetPitch: this.round.pitchT,
      score: Math.round(this.score * 1000) / 1000, threshold: this.round.threshold, solved: this.solved, hints: this.hints,
      clean: this.clean, earned: this.earned, objT: Math.round(this.objT * 10) / 10,
      hint: this.hintWay(),
      turntable: { x: Math.round(lay.objX), y: Math.round(lay.objY), r: Math.round(lay.k) },
      panel: { x: Math.round(lay.panel.x), y: Math.round(lay.panel.y), size: Math.round(lay.panel.size) },
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  /** For tests and the audit: put the thing exactly where the target is. */
  debugSolve(): void { this.yaw = this.round.yawT; this.pitch = this.round.pitchT; this.dirty = true; this.dwell = DWELL; }

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

  /**
   * Lamp, thing and wall side by side, with the drag area the whole screen. The top 62 px on the
   * right belong to the home and back buttons, the bottom 48 to the progress dots, and the guide
   * sits in the bottom-left corner, so the scene lives between them.
   */
  private layout(): Layout {
    const u = this.u();
    const portrait = this.h > this.w;
    const top = 62, bot = 48;
    let P: number, cy: number;
    if (portrait) { P = Math.min(this.w * 0.5, this.h * 0.4); cy = this.h * 0.45; }
    else { P = Math.min(this.w * 0.4, this.h - top - bot - 4); cy = top + (this.h - top - bot) / 2; }
    const px = this.w - P - (portrait ? 12 : 16 * u);
    const lampS = clamp(P * 0.2, 26, 56 * u);
    const lampX = Math.max(30, this.w * 0.045);
    const gap = px - (lampX + lampS * 0.4);
    const k = Math.min(P * 0.25, gap * 0.36);
    const objX = lampX + lampS * 0.4 + gap / 2;
    const tableY = cy + k * Math.cos(CAM);
    const tableRx = k * 1.25;
    return {
      portrait, panel: { x: px, y: cy - P / 2, size: P }, lampX, lampS, lampY: cy, objX, objY: cy, k, tableY, tableRx,
      floorY: tableY + tableRx * Math.sin(CAM) * 0.6,
    };
  }

  // ---------- levels ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed; }

  private start(i: number): void {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = this.easy ? SIMPLE_LEVEL : LEVELS[this.levelIndex];
    this.attempt++;
    const rng = rngFor(this.level, this.attempt);
    this.order = objectsFor(this.level, rng);
    this.roundRng = rng;
    this.index = 0; this.clean = 0; this.earned = 0;
    this.ps.clear();
    this.phase = 'play'; this.phaseT = 0;
    this.touched = false;
    this.loadObject();
    this.say(instruction(), 5);
  }

  private roundRng: () => number = Math.random;

  private loadObject(): void {
    this.round = makeRound(this.order[this.index], this.level, this.roundRng);
    this.model = objectById(this.round.id);
    this.yaw = this.round.yaw0; this.pitch = this.round.pitch0;
    this.targetShadow = project(this.model, this.round.yawT, this.round.pitchT);
    this.dirty = true;
    this.score = 0; this.dwell = 0; this.objT = 0; this.hints = 0;
    this.solved = false; this.solvedT = 0; this.nameSaid = false;
    this.appear = 0;
    this.dragging = false;
    this.refresh();
  }

  private refresh(): void {
    this.shadow = project(this.model, this.yaw, this.pitch);
    this.score = matchScore(this.shadow, this.targetShadow);
    this.dirty = false;
  }

  private hintWay(): Way | null {
    if (this.phase !== 'play' || this.solved || this.hints < 1) return null;
    return hintDirection(this.yaw, this.pitch, this.round, this.level.tilt);
  }

  private solve(): void {
    this.solved = true; this.solvedT = 0; this.dragging = false;
    this.snapYaw = this.yaw; this.snapPitch = this.pitch;
    if (this.hints < CLEAN_BELOW) this.clean++;
    sfx.click();
    const lay = this.layout();
    const cx = lay.panel.x + lay.panel.size / 2, cy = lay.panel.y + lay.panel.size / 2;
    this.ps.spawn('spark', cx, cy, 18, { colour: '#ffe9a8', speed: 190, size: lay.panel.size * 0.025, max: 1, spread: TAU });
    this.say(NL() ? LINE_YES.nl : LINE_YES.en, 2.5);
  }

  private finish(): void {
    if (this.easy) {
      // nothing written down: the shadows fit, and that is the whole ending
      this.earned = 3;
    } else {
      this.earned = starsFor(this.clean, this.order.length);
      recordLevelResult(saveKey(this.level), this.clean, this.earned, true);
    }
    this.phase = 'won'; this.phaseT = 0; this.cardPop = 0;
    sfx.complete();
    this.say(T('All done. Well done.', 'Klaar. Goed gedaan.'), 4);
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.6);
    this.ps.update(dt);
    if (this.phase !== 'play') return;
    this.appear = Math.min(1, this.appear + dt * 2.2);

    if (this.solved) {
      this.solvedT += dt;
      // it settles exactly onto the target, so what the child sees is the fit it asked for
      const e = easeOutCubic(clamp(this.solvedT / 0.35, 0, 1));
      this.yaw = this.snapYaw + angleDiff(this.snapYaw, this.round.yawT) * e;
      this.pitch = this.snapPitch + (this.round.pitchT - this.snapPitch) * e;
      this.refresh();
      if (!this.nameSaid && this.solvedT >= NAME_AT) {
        this.nameSaid = true;
        this.say(NL() ? this.model.lineNl : this.model.line, 2.5);
      }
      if (this.solvedT >= SOLVED_HOLD) {
        this.index++;
        if (this.index >= this.order.length) this.finish(); else this.loadObject();
      }
      return;
    }

    if (this.dirty) this.refresh();
    this.dwell = this.score >= this.round.threshold ? this.dwell + dt : 0;
    if (this.dwell >= DWELL) { this.solve(); return; }

    this.objT += dt;
    const h = hintsAfter(this.objT);
    if (h > this.hints) {
      this.hints = h;
      sfx.hint();
      this.say(instruction(), 3);
    }
  }

  // ---------- input ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: { x: number; y: number }): string | null {
    for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) {
      this.held0 = hit;
      if (hit.startsWith('level:')) { const i = Number(hit.slice(6)); if (this.unlocked(i)) this.start(i); else sfx.tap(); }
      else if (hit === 'levels') { this.phase = 'levels'; this.cardPop = 0; sfx.tap(); }
      else if (hit === 'retry') this.start(this.levelIndex);
      else if (hit === 'next') this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1));
      return;
    }
    if (this.phase !== 'play' || this.solved) return;
    this.dragging = true; this.touched = true;
    this.lastX = p.x; this.lastY = p.y; this.notch = 0;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
    sfx.grab();
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging || this.solved) return;
    const p = this.at(e);
    const rate = TURN_PER_OBJECT / Math.max(20, this.layout().k);
    const dx = p.x - this.lastX, dy = p.y - this.lastY;
    this.lastX = p.x; this.lastY = p.y;
    this.yaw += dx * rate;
    if (this.level.tilt) this.pitch = clamp(this.pitch + dy * rate * 0.7, -PITCH_MAX, PITCH_MAX);
    this.dirty = true;
    this.notch += Math.abs(dx * rate) + (this.level.tilt ? Math.abs(dy * rate * 0.7) : 0);
    if (this.notch >= NOTCH) { this.notch = 0; sfx.turn(); }
  }

  private onUp(_e: PointerEvent): void { this.held0 = null; this.dragging = false; }

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
    const L = this.layout(), u = this.u();
    drawRoom(ctx, this.w, this.h, L.lampX, L.lampY, 1);
    drawBeam(ctx, L.lampX + L.lampS * 0.4, L.lampY, L.panel.x, L.panel.y, L.panel.size, 1);
    drawLamp(ctx, L.lampX, L.lampY, L.lampS, L.floorY, this.t);
    drawTurntable(ctx, L.objX, L.tableY, L.tableRx, this.yaw);

    // the thing pops up from the turntable when it arrives
    const pop = easeOutBack(clamp(this.appear, 0, 1));
    drawObject(ctx, this.model, this.yaw, this.pitch, L.objX, L.objY + (1 - pop) * L.k * 0.3, L.k * clamp(pop, 0.05, 1.05), clamp(this.appear * 3, 0, 1));

    const glow = this.solved ? clamp(this.solvedT * 3, 0, 1) : 0;
    drawWall(ctx, L.panel, glow);
    const close = clamp((this.score - 0.4) / Math.max(0.05, this.round.threshold - 0.4), 0, 1);
    drawTarget(ctx, this.targetShadow, L.panel, close, this.solved, this.t);
    drawShadow(ctx, this.shadow, L.panel, this.dpr, 1);
    this.ps.draw(ctx);

    this.drawHints(L);
    this.drawNameLabel(L);
    this.drawDots(L);
    this.drawNote(L);
    if (this.phase === 'won') this.drawEnd();
    ctx.textAlign = 'left';
    void u;
  }

  private drawHints(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play' || this.solved) return;
    const way = this.hintWay();
    if (way) {
      const s = L.k * 0.3;
      const y = way === 'up' ? L.objY - L.k * 1.5 : L.tableY + L.tableRx * Math.sin(CAM) + L.k * 0.55;
      drawArrow(ctx, L.objX, y, s, way, 0.9, Math.sin(this.t * 4));
    } else if (!this.touched && this.objT > 1) {
      // before the first touch, a hand shows the whole of the gesture and no word is needed
      const hx = L.objX + Math.sin(this.t * 2.2) * L.k * 0.8;
      ctx.save();
      ctx.globalAlpha = clamp((this.objT - 1) * 2, 0, 0.9);
      handCursor(ctx, hx, L.objY + L.k * 0.2, 13 * u, 1);
      ctx.restore();
    }
  }

  private drawNameLabel(L: Layout): void {
    if (!this.solved || this.solvedT < 0.4) return;
    const ctx = this.ctx, u = this.u();
    const text = NL() ? this.model.lineNl : this.model.line;
    ctx.font = this.font('900', 16);
    // on a narrow screen the wall is where the room under the turntable would be, so the name goes below both
    const cx = L.portrait ? this.w / 2 : L.objX;
    const tw = Math.min(this.w - 24 * u, ctx.measureText(text).width + 34 * u);
    const y = L.portrait ? L.panel.y + L.panel.size + 16 * u : L.tableY + L.tableRx * Math.sin(CAM) + L.k * 0.32;
    ctx.save();
    ctx.globalAlpha = clamp((this.solvedT - 0.4) * 3, 0, 1);
    glassPanel(ctx, cx - tw / 2, y, tw, 34 * u, 17 * u, 0.94);
    ctx.fillStyle = '#2b2140';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, y + 23 * u, tw - 16 * u);
    ctx.restore();
  }

  private drawDots(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    void L;
    const n = this.order.length;
    const gap = 21 * u, y = this.h - 22 * u;
    const x0 = this.w / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const done = i < this.index || (i === this.index && this.solved);
      ctx.beginPath(); ctx.arc(x0 + i * gap, y, 6 * u, 0, TAU);
      ctx.fillStyle = done ? '#ffd86e' : 'rgba(255,255,255,0.16)'; ctx.fill();
      if (i === this.index && !done) { ctx.strokeStyle = 'rgba(255,233,168,0.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }

  private drawNote(L: Layout): void {
    if (this.noteT <= 0 || this.phase !== 'play') return;
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.globalAlpha = clamp(this.noteT, 0, 1);
    ctx.font = this.font('800', 12);
    const room = L.portrait ? this.w - 36 * u : L.panel.x - 24 * u;
    const tw = Math.min(room, ctx.measureText(this.note).width + 32 * u);
    const cx = L.portrait ? this.w / 2 : L.panel.x / 2;
    const ny = L.portrait ? Math.max(70, L.panel.y - 62 * u) : 14;
    glassPanel(ctx, cx - tw / 2, ny, tw, 30 * u, 15 * u, 0.93);
    ctx.fillStyle = '#2b2140';
    ctx.textAlign = 'center';
    ctx.fillText(this.note, cx, ny + 20 * u, tw - 22 * u);
    ctx.restore();
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fdfbf6', ink = '#3a2a5a'): void {
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
    ctx.fillStyle = 'rgba(14, 10, 30, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(360 * u, this.w - 32 * u), ch = Math.min(272 * u, this.h - 24);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 26 * u); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 92 * u);
    band.addColorStop(0, '#ffd986'); band.addColorStop(1, 'rgba(255,217,134,0)');
    ctx.fillStyle = band; ctx.fillRect(x, y, cw, 92 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, T('All done', 'Klaar'), this.w / 2, y + 50 * u, this.font('900', 24), '#2b2140');
    if (!this.easy) {
      for (let i = 0; i < 3; i++) {
        const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
        drawStarGem(ctx, this.w / 2 + (i - 1) * 42 * u, y + 104 * u, 18 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
      }
    }
    ctx.fillStyle = 'rgba(43,33,64,0.72)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Every shadow fits.', 'Alle schaduwen passen.'), this.w / 2, y + (this.easy ? 108 : 146) * u, cw - 40 * u);
    ctx.restore();
    const bw = 138 * u, bh = 50 * u, by = y + ch - 78 * u;
    if (this.easy) { this.button('retry', T('One more', 'Nog een keer'), this.w / 2 - bw / 2, by, bw, bh, '#4fae6e', '#ffffff'); return; }
    this.button('retry', T('Once more', 'Nog een keer'), this.w / 2 - bw - 7 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) this.button('next', T('Next', 'Volgende'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
    else this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 7 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#231f3a'); bg.addColorStop(1, '#3d3360');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    heading(ctx, 'Schaduwspel', this.w / 2, 60 * u, this.font('900', 26), '#fff2c6');
    ctx.fillStyle = 'rgba(255,242,198,0.78)';
    ctx.font = this.font('700', 12.5);
    ctx.fillText(T('Turn the thing until its shadow fits.', 'Draai het ding tot de schaduw past.'), this.w / 2, 84 * u, this.w - 24 * u);
    const cols = this.w > 640 * u ? 3 : 1;
    const pad = 14 * u;
    const cw = Math.min(260 * u, (this.w - 28 * u - (cols - 1) * pad) / cols);
    const art = cw * (cols === 1 ? 0.4 : 0.42);
    const chh = art + 66 * u;
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
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.08, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 18 * u); ctx.fill();
      ctx.restore();
      // a little scene: lamp, a thing, and its shadow on a wall
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 6 * u, cw - 12 * u, art, 13 * u); ctx.clip();
      ctx.translate(x + 6 * u, y + 6 * u);
      const sw = cw - 12 * u;
      drawRoom(ctx, sw, art, sw * 0.06, art * 0.5, 1);
      const sample = objectById(SAMPLE_FOR_CARD[i % 3]);
      const size = art * 0.78;
      const panel = { x: sw - size - art * 0.1, y: (art - size) / 2, size };
      drawBeam(ctx, sw * 0.08, art * 0.5, panel.x, panel.y, size, 1);
      drawLamp(ctx, sw * 0.07, art * 0.5, art * 0.13, art * 0.92, this.t);
      const kk = art * 0.2, ox = (sw * 0.1 + panel.x) / 2 + 4 * u;
      const yaw = 0.7 + i * 0.8, tilt = L.tilt ? 0.45 : 0;
      drawTurntable(ctx, ox, art * 0.5 + kk * 0.96, kk * 1.2, yaw);
      drawObject(ctx, sample, yaw, tilt, ox, art * 0.5, kk);
      drawWall(ctx, panel, 0);
      drawShadow(ctx, project(sample, yaw + (L.mirror ? Math.PI : 0), tilt), panel, this.dpr);
      if (!open) { ctx.fillStyle = 'rgba(30, 24, 52, 0.62)'; ctx.fillRect(0, 0, sw, art); }
      ctx.restore();
      ctx.fillStyle = 'rgba(20,12,40,0.6)';
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 13 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 12);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 24 * u, y + 28.5 * u);
      ctx.textAlign = 'left';
      ctx.fillStyle = open ? '#2b2140' : 'rgba(43,33,64,0.68)';
      ctx.font = this.font('900', 15);
      ctx.fillText(nameOf(L), x + 14 * u, y + art + 30 * u, cw - 90 * u);
      ctx.fillStyle = 'rgba(43,33,64,0.68)';
      ctx.font = this.font('700', 11);
      ctx.fillText(lineOf(L), x + 14 * u, y + art + 50 * u, cw - 28 * u);
      for (let sI = 0; sI < 3; sI++) drawStarGem(ctx, x + cw - 64 * u + sI * 20 * u, y + art + 24 * u, 8 * u, sI < p.stars);
      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(43,33,64,0.55)';
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
    void outlinedText;
  }
}
